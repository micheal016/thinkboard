// ─────────────────────────────────────────────────────────────
// Operation Log — Append-only, ordered log of CRDT operations
// ─────────────────────────────────────────────────────────────
// The operation log is the source of truth for a room's canvas state.
// It supports:
//   - Appending new operations (with Lamport ordering)
//   - Undo/Redo via tombstoning (marking ops as undone)
//   - Snapshotting for new client sync
//   - Compaction to prevent unbounded growth

const Operation = require('./operation');
const VectorClock = require('./vector-clock');

class OperationLog {
  constructor(maxOperations = 10000) {
    /** @type {Operation[]} */
    this.operations = [];
    this.maxOperations = maxOperations;

    // Lamport clock for this log (server-side)
    this.lamportCounter = 0;

    // Vector clock tracking all clients
    this.vectorClock = new VectorClock();

    // Per-client undo stacks: clientId -> [operationId, ...]
    this.undoStacks = new Map();
    this.redoStacks = new Map();
  }

  /**
   * Append an operation to the log.
   * Assigns a Lamport timestamp if not already set.
   * Returns the finalized operation.
   */
  append(opData) {
    // Advance Lamport clock
    this.lamportCounter = Math.max(this.lamportCounter, opData.lamport || 0) + 1;

    // Merge incoming vector clock
    if (opData.vectorClock) {
      this.vectorClock.merge(opData.vectorClock);
    }
    this.vectorClock.increment(opData.clientId);

    const op = new Operation({
      ...opData,
      lamport: this.lamportCounter,
      vectorClock: this.vectorClock.toJSON(),
    });

    this.operations.push(op);

    // Track in undo stack for this client
    if (!this.undoStacks.has(op.clientId)) {
      this.undoStacks.set(op.clientId, []);
      this.redoStacks.set(op.clientId, []);
    }
    this.undoStacks.get(op.clientId).push(op.id);
    // Clear redo stack on new operation
    this.redoStacks.set(op.clientId, []);

    // Compact if necessary
    if (this.operations.length > this.maxOperations) {
      this._compact();
    }

    return op;
  }

  /**
   * Undo the last operation by a specific client.
   * Uses tombstoning — marks the op as undone rather than deleting it.
   */
  undo(clientId) {
    const stack = this.undoStacks.get(clientId);
    if (!stack || stack.length === 0) return null;

    const opId = stack.pop();
    const op = this.operations.find(o => o.id === opId);
    if (!op) return null;

    op.undone = true;

    // Push to redo stack
    if (!this.redoStacks.has(clientId)) {
      this.redoStacks.set(clientId, []);
    }
    this.redoStacks.get(clientId).push(opId);

    return op;
  }

  /**
   * Redo a previously undone operation by a specific client.
   */
  redo(clientId) {
    const stack = this.redoStacks.get(clientId);
    if (!stack || stack.length === 0) return null;

    const opId = stack.pop();
    const op = this.operations.find(o => o.id === opId);
    if (!op) return null;

    op.undone = false;

    // Push back to undo stack
    this.undoStacks.get(clientId).push(opId);

    return op;
  }

  /**
   * Clear all operations (used for canvas clear)
   */
  clear() {
    this.operations = [];
    this.undoStacks.clear();
    this.redoStacks.clear();
    // Keep the Lamport counter to maintain causal ordering
  }

  /**
   * Get all active (non-undone) operations, sorted by Lamport timestamp.
   * This is the "current state" of the canvas.
   */
  getActiveOperations() {
    return this.operations
      .filter(op => !op.undone)
      .sort(Operation.compare);
  }

  /**
   * Get all operations (including undone) for full state transfer
   */
  getAllOperations() {
    return [...this.operations].sort(Operation.compare);
  }

  /**
   * Get a snapshot for syncing a new client
   */
  getSnapshot() {
    return {
      operations: this.getAllOperations().map(op => op.toJSON()),
      lamportCounter: this.lamportCounter,
      vectorClock: this.vectorClock.toJSON(),
    };
  }

  /**
   * Compact the log by removing old undone operations
   * Keeps the log size bounded while preserving active state
   */
  _compact() {
    // Remove the oldest 20% of undone operations
    const undone = this.operations.filter(op => op.undone);
    const toRemove = Math.floor(undone.length * 0.2);
    if (toRemove === 0 && this.operations.length > this.maxOperations) {
      // If no undone ops to remove, remove the oldest 10% of all ops
      const removeCount = Math.floor(this.operations.length * 0.1);
      this.operations = this.operations.slice(removeCount);
    } else {
      const removeIds = new Set(undone.slice(0, toRemove).map(op => op.id));
      this.operations = this.operations.filter(op => !removeIds.has(op.id));
    }
  }
}

module.exports = OperationLog;
