// ─────────────────────────────────────────────────────────────
// Room — A collaborative whiteboard room
// ─────────────────────────────────────────────────────────────
// Each room has its own operation log (CRDT state) and
// set of connected users. Rooms are lazily created on first join.

const OperationLog = require('../crdt/operation-log');
const config = require('../config');

class Room {
  constructor(roomId) {
    this.id = roomId;
    this.operationLog = new OperationLog(config.room.maxOperations);
    this.createdAt = Date.now();

    // Set of WebSocket connections in this room (local instance only)
    // In a scaled deployment, each instance has its own set of connections
    this.connections = new Set();
  }

  /**
   * Add a WebSocket connection to this room
   */
  addConnection(ws) {
    this.connections.add(ws);
  }

  /**
   * Remove a WebSocket connection from this room
   */
  removeConnection(ws) {
    this.connections.delete(ws);
  }

  /**
   * Broadcast a message to all connections in this room
   * @param {string} message - JSON string to send
   * @param {WebSocket} [exclude] - Connection to exclude (the sender)
   */
  broadcast(message, exclude = null) {
    for (const ws of this.connections) {
      if (ws !== exclude && ws.readyState === 1) { // 1 = OPEN
        ws.send(message);
      }
    }
  }

  /**
   * Get room state snapshot for new client sync
   */
  getSnapshot() {
    return {
      roomId: this.id,
      ...this.operationLog.getSnapshot(),
      createdAt: this.createdAt,
    };
  }

  /**
   * Check if room is empty (no local connections)
   */
  isEmpty() {
    return this.connections.size === 0;
  }

  /**
   * Get the number of local connections
   */
  getConnectionCount() {
    return this.connections.size;
  }
}

module.exports = Room;
