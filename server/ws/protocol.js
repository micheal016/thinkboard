// ─────────────────────────────────────────────────────────────
// WebSocket Protocol — Message type definitions
// ─────────────────────────────────────────────────────────────
// All messages are JSON-encoded with a `type` field.
// This module defines the contract between client and server.

const MessageType = {
  // ── Connection lifecycle ──
  JOIN_ROOM:      'join_room',       // Client → Server: join a room
  ROOM_JOINED:    'room_joined',     // Server → Client: room join confirmed
  LEAVE_ROOM:     'leave_room',      // Client → Server: leave a room
  ERROR:          'error',           // Server → Client: error message

  // ── Drawing operations (CRDT) ──
  DRAW_OPERATION: 'draw_op',         // Bidirectional: a drawing operation
  DRAW_BATCH:     'draw_batch',      // Server → Client: batch of operations (state sync)
  UNDO:           'undo',            // Client → Server: undo last operation
  REDO:           'redo',            // Client → Server: redo undone operation
  CLEAR_CANVAS:   'clear_canvas',    // Bidirectional: clear all operations

  // ── Presence ──
  PRESENCE_UPDATE:'presence_update', // Client → Server: cursor position, tool, etc.
  PRESENCE_STATE: 'presence_state',  // Server → Client: full presence state for room
  USER_JOINED:    'user_joined',     // Server → Client: a user joined the room
  USER_LEFT:      'user_left',       // Server → Client: a user left the room

  // ── Sync ──
  STATE_SNAPSHOT:  'state_snapshot',  // Server → Client: full room state on join
  SYNC_REQUEST:    'sync_request',   // Client → Server: request full state
};

/**
 * Create a protocol message
 */
function createMessage(type, payload = {}) {
  return JSON.stringify({ type, ...payload, ts: Date.now() });
}

/**
 * Parse an incoming message safely
 */
function parseMessage(raw) {
  try {
    const msg = JSON.parse(raw);
    if (!msg.type) return null;
    return msg;
  } catch {
    return null;
  }
}

module.exports = { MessageType, createMessage, parseMessage };
