// ─────────────────────────────────────────────────────────────
// Presence Tracker — Real-time user presence with heartbeats
// ─────────────────────────────────────────────────────────────
// Tracks which users are in which rooms, their cursor positions,
// active tools, and colors. Uses heartbeat-based timeout detection.

const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Predefined user colors for visual distinction
const USER_COLORS = [
  '#e94560', '#533483', '#16c79a', '#f7b731', '#3867d6',
  '#eb3b5a', '#8854d0', '#20bf6b', '#f5a623', '#4b7bec',
  '#fc5c65', '#a55eea', '#26de81', '#fed330', '#45aaf2',
  '#fd9644', '#2bcbba', '#778ca3', '#d1d8e0', '#a5b1c2',
];

class PresenceTracker {
  constructor() {
    // roomId -> Map<userId, UserPresence>
    this.rooms = new Map();
    this.colorIndex = 0;

    // Start cleanup interval
    this._cleanupInterval = setInterval(() => this._cleanup(), config.presence.timeout);
  }

  /**
   * Register a new user in a room
   */
  addUser(roomId, userId, username) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }

    const room = this.rooms.get(roomId);
    const color = USER_COLORS[this.colorIndex % USER_COLORS.length];
    this.colorIndex++;

    const presence = {
      userId,
      username: username || `User-${userId.slice(0, 4)}`,
      color,
      cursor: { x: 0, y: 0 },
      tool: 'pen',
      lastSeen: Date.now(),
      joinedAt: Date.now(),
    };

    room.set(userId, presence);
    return presence;
  }

  /**
   * Remove a user from a room
   */
  removeUser(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const presence = room.get(userId);
    room.delete(userId);

    // Clean up empty rooms
    if (room.size === 0) {
      this.rooms.delete(roomId);
    }

    return presence;
  }

  /**
   * Update a user's presence (cursor, tool, heartbeat)
   */
  updatePresence(roomId, userId, update) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const presence = room.get(userId);
    if (!presence) return null;

    if (update.cursor) presence.cursor = update.cursor;
    if (update.tool) presence.tool = update.tool;
    presence.lastSeen = Date.now();

    return presence;
  }

  /**
   * Get all users in a room
   */
  getRoomUsers(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.values());
  }

  /**
   * Get a specific user's presence
   */
  getUser(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return room.get(userId) || null;
  }

  /**
   * Get the count of users in a room
   */
  getRoomUserCount(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.size : 0;
  }

  /**
   * Cleanup stale users (heartbeat timeout)
   */
  _cleanup() {
    const now = Date.now();
    const staleUsers = [];

    for (const [roomId, room] of this.rooms) {
      for (const [userId, presence] of room) {
        if (now - presence.lastSeen > config.presence.timeout) {
          staleUsers.push({ roomId, userId });
        }
      }
    }

    for (const { roomId, userId } of staleUsers) {
      this.removeUser(roomId, userId);
    }

    return staleUsers;
  }

  /**
   * Destroy the tracker (cleanup interval)
   */
  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
  }
}

module.exports = PresenceTracker;
