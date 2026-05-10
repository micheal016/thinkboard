// ─────────────────────────────────────────────────────────────
// Room Manager — Creates, retrieves, and cleans up rooms
// ─────────────────────────────────────────────────────────────

const Room = require('./room');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  /**
   * Get or create a room
   */
  getOrCreate(roomId) {
    if (!this.rooms.has(roomId)) {
      const room = new Room(roomId);
      this.rooms.set(roomId, room);
      console.log(`[Room] Created room: ${roomId}`);
    }
    return this.rooms.get(roomId);
  }

  /**
   * Get an existing room (returns null if not found)
   */
  get(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Remove a room
   */
  remove(roomId) {
    if (this.rooms.has(roomId)) {
      this.rooms.delete(roomId);
      console.log(`[Room] Removed room: ${roomId}`);
    }
  }

  /**
   * Get all room IDs
   */
  getRoomIds() {
    return Array.from(this.rooms.keys());
  }

  /**
   * Get stats for all rooms
   */
  getStats() {
    const stats = [];
    for (const [id, room] of this.rooms) {
      stats.push({
        id,
        connections: room.getConnectionCount(),
        operations: room.operationLog.operations.length,
        createdAt: room.createdAt,
      });
    }
    return stats;
  }

  /**
   * Cleanup empty rooms (called periodically)
   */
  cleanupEmpty() {
    const emptyRooms = [];
    for (const [id, room] of this.rooms) {
      if (room.isEmpty()) {
        emptyRooms.push(id);
      }
    }
    // Don't immediately delete — keep state for reconnections
    // Only delete rooms that have been empty for 5 minutes
    return emptyRooms;
  }
}

module.exports = RoomManager;
