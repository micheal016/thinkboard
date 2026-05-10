// ─────────────────────────────────────────────────────────────
// Operation — A single drawing operation with CRDT metadata
// ─────────────────────────────────────────────────────────────
// Each operation is immutable and carries enough metadata
// for conflict-free replication across distributed nodes.

const { v4: uuidv4 } = require('uuid');

class Operation {
  /**
   * @param {Object} params
   * @param {string} params.id          - Unique operation ID
   * @param {string} params.clientId    - ID of the client that created this op
   * @param {string} params.roomId      - Room this operation belongs to
   * @param {string} params.tool        - Tool used (pen, rectangle, circle, line, eraser, text)
   * @param {Object} params.data        - Tool-specific data (points, color, width, etc.)
   * @param {number} params.lamport     - Lamport timestamp for total ordering
   * @param {Object} params.vectorClock - Vector clock snapshot at creation time
   * @param {number} params.wallClock   - Wall clock time (for display purposes)
   * @param {boolean} params.undone     - Whether this operation has been undone
   */
  constructor({
    id = uuidv4(),
    clientId,
    roomId,
    tool,
    data,
    lamport = 0,
    vectorClock = {},
    wallClock = Date.now(),
    undone = false,
  }) {
    this.id = id;
    this.clientId = clientId;
    this.roomId = roomId;
    this.tool = tool;
    this.data = data;
    this.lamport = lamport;
    this.vectorClock = vectorClock;
    this.wallClock = wallClock;
    this.undone = undone;
  }

  /**
   * Compare two operations for total ordering.
   * Uses Lamport timestamp first, then clientId as tiebreaker.
   * This ensures a deterministic, consistent order across all nodes.
   */
  static compare(a, b) {
    if (a.lamport !== b.lamport) return a.lamport - b.lamport;
    return a.clientId < b.clientId ? -1 : a.clientId > b.clientId ? 1 : 0;
  }

  toJSON() {
    return {
      id: this.id,
      clientId: this.clientId,
      roomId: this.roomId,
      tool: this.tool,
      data: this.data,
      lamport: this.lamport,
      vectorClock: this.vectorClock,
      wallClock: this.wallClock,
      undone: this.undone,
    };
  }

  static fromJSON(json) {
    return new Operation(json);
  }
}

module.exports = Operation;
