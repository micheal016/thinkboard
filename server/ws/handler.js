// ─────────────────────────────────────────────────────────────
// WebSocket Message Handler — Routes and processes messages
// ─────────────────────────────────────────────────────────────
// This is the core message router that handles all incoming
// WebSocket messages, applies CRDT operations, updates presence,
// and broadcasts to other clients via pub/sub.

const { MessageType, createMessage } = require('./protocol');
const Operation = require('../crdt/operation');

class MessageHandler {
  constructor(roomManager, presenceTracker, pubsub) {
    this.roomManager = roomManager;
    this.presence = presenceTracker;
    this.pubsub = pubsub;

    // Subscribe to pub/sub channels for cross-instance broadcasting
    this._setupPubSubListeners();
  }

  /**
   * Handle an incoming message from a WebSocket client
   */
  handle(ws, msg) {
    switch (msg.type) {
      case MessageType.JOIN_ROOM:
        this._handleJoinRoom(ws, msg);
        break;
      case MessageType.LEAVE_ROOM:
        this._handleLeaveRoom(ws);
        break;
      case MessageType.DRAW_OPERATION:
        this._handleDrawOperation(ws, msg);
        break;
      case MessageType.UNDO:
        this._handleUndo(ws, msg);
        break;
      case MessageType.REDO:
        this._handleRedo(ws, msg);
        break;
      case MessageType.CLEAR_CANVAS:
        this._handleClearCanvas(ws, msg);
        break;
      case MessageType.PRESENCE_UPDATE:
        this._handlePresenceUpdate(ws, msg);
        break;
      case MessageType.SYNC_REQUEST:
        this._handleSyncRequest(ws, msg);
        break;
      default:
        ws.send(createMessage(MessageType.ERROR, { message: `Unknown message type: ${msg.type}` }));
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(ws) {
    if (!ws._roomId || !ws._userId) return;

    const room = this.roomManager.get(ws._roomId);
    if (room) {
      room.removeConnection(ws);
    }

    const presence = this.presence.removeUser(ws._roomId, ws._userId);
    if (presence) {
      // Broadcast user left to room
      const leaveMsg = createMessage(MessageType.USER_LEFT, {
        userId: ws._userId,
        username: presence.username,
      });

      if (room) {
        room.broadcast(leaveMsg);
      }

      // Publish to pub/sub for cross-instance notification
      this.pubsub.publish(`room:${ws._roomId}:presence`, {
        type: MessageType.USER_LEFT,
        userId: ws._userId,
        username: presence.username,
      });
    }

    console.log(`[WS] User ${ws._userId} left room ${ws._roomId}`);
  }

  // ── Private handlers ──────────────────────────────────────

  _handleJoinRoom(ws, msg) {
    const { roomId, username } = msg;
    if (!roomId) {
      ws.send(createMessage(MessageType.ERROR, { message: 'roomId is required' }));
      return;
    }

    // Store user info on the WebSocket object
    ws._roomId = roomId;
    ws._userId = msg.userId || require('uuid').v4();
    ws._username = username || `User-${ws._userId.slice(0, 4)}`;

    // Get or create room
    const room = this.roomManager.getOrCreate(roomId);
    room.addConnection(ws);

    // Register presence
    const presence = this.presence.addUser(roomId, ws._userId, ws._username);

    // Send room joined confirmation with user info
    ws.send(createMessage(MessageType.ROOM_JOINED, {
      roomId,
      userId: ws._userId,
      username: ws._username,
      color: presence.color,
    }));

    // Send current state snapshot to new client
    const snapshot = room.getSnapshot();
    ws.send(createMessage(MessageType.STATE_SNAPSHOT, snapshot));

    // Send current presence state
    const users = this.presence.getRoomUsers(roomId);
    ws.send(createMessage(MessageType.PRESENCE_STATE, { users }));

    // Broadcast user joined to others in room
    const joinMsg = createMessage(MessageType.USER_JOINED, {
      userId: ws._userId,
      username: ws._username,
      color: presence.color,
    });
    room.broadcast(joinMsg, ws);

    // Publish to pub/sub for cross-instance notification
    this.pubsub.publish(`room:${roomId}:presence`, {
      type: MessageType.USER_JOINED,
      userId: ws._userId,
      username: ws._username,
      color: presence.color,
    });

    console.log(`[WS] User ${ws._username} (${ws._userId}) joined room ${roomId}`);
  }

  _handleLeaveRoom(ws) {
    this.handleDisconnect(ws);
  }

  _handleDrawOperation(ws, msg) {
    if (!ws._roomId) return;

    const room = this.roomManager.get(ws._roomId);
    if (!room) return;

    // Create and append operation to the CRDT log
    const op = room.operationLog.append({
      clientId: ws._userId,
      roomId: ws._roomId,
      tool: msg.tool,
      data: msg.data,
      lamport: msg.lamport || 0,
      vectorClock: msg.vectorClock || {},
    });

    // Broadcast to all other local clients
    const opMsg = createMessage(MessageType.DRAW_OPERATION, { operation: op.toJSON() });
    room.broadcast(opMsg, ws);

    // Publish to pub/sub for cross-instance broadcasting
    this.pubsub.publish(`room:${ws._roomId}:ops`, {
      type: MessageType.DRAW_OPERATION,
      operation: op.toJSON(),
      sourceInstance: process.pid,
    });
  }

  _handleUndo(ws) {
    if (!ws._roomId) return;

    const room = this.roomManager.get(ws._roomId);
    if (!room) return;

    const op = room.operationLog.undo(ws._userId);
    if (!op) return;

    // Broadcast the full updated operation list
    const ops = room.operationLog.getActiveOperations().map(o => o.toJSON());
    const batchMsg = createMessage(MessageType.DRAW_BATCH, { operations: ops });

    // Send to all clients including sender (they need the confirmed state)
    for (const conn of room.connections) {
      if (conn.readyState === 1) {
        conn.send(batchMsg);
      }
    }

    this.pubsub.publish(`room:${ws._roomId}:ops`, {
      type: MessageType.DRAW_BATCH,
      operations: ops,
      sourceInstance: process.pid,
    });
  }

  _handleRedo(ws) {
    if (!ws._roomId) return;

    const room = this.roomManager.get(ws._roomId);
    if (!room) return;

    const op = room.operationLog.redo(ws._userId);
    if (!op) return;

    const ops = room.operationLog.getActiveOperations().map(o => o.toJSON());
    const batchMsg = createMessage(MessageType.DRAW_BATCH, { operations: ops });

    for (const conn of room.connections) {
      if (conn.readyState === 1) {
        conn.send(batchMsg);
      }
    }

    this.pubsub.publish(`room:${ws._roomId}:ops`, {
      type: MessageType.DRAW_BATCH,
      operations: ops,
      sourceInstance: process.pid,
    });
  }

  _handleClearCanvas(ws) {
    if (!ws._roomId) return;

    const room = this.roomManager.get(ws._roomId);
    if (!room) return;

    room.operationLog.clear();

    const clearMsg = createMessage(MessageType.CLEAR_CANVAS, {
      clearedBy: ws._userId,
    });

    for (const conn of room.connections) {
      if (conn.readyState === 1) {
        conn.send(clearMsg);
      }
    }

    this.pubsub.publish(`room:${ws._roomId}:ops`, {
      type: MessageType.CLEAR_CANVAS,
      clearedBy: ws._userId,
      sourceInstance: process.pid,
    });
  }

  _handlePresenceUpdate(ws, msg) {
    if (!ws._roomId) return;

    const presence = this.presence.updatePresence(ws._roomId, ws._userId, {
      cursor: msg.cursor,
      tool: msg.tool,
    });

    if (!presence) return;

    const room = this.roomManager.get(ws._roomId);
    if (!room) return;

    // Broadcast presence update to other local clients
    const presenceMsg = createMessage(MessageType.PRESENCE_UPDATE, {
      userId: ws._userId,
      cursor: presence.cursor,
      tool: presence.tool,
      color: presence.color,
      username: presence.username,
    });
    room.broadcast(presenceMsg, ws);

    // Publish to pub/sub (throttled on client side)
    this.pubsub.publish(`room:${ws._roomId}:presence`, {
      type: MessageType.PRESENCE_UPDATE,
      userId: ws._userId,
      cursor: presence.cursor,
      tool: presence.tool,
      color: presence.color,
      username: presence.username,
    });
  }

  _handleSyncRequest(ws) {
    if (!ws._roomId) return;

    const room = this.roomManager.get(ws._roomId);
    if (!room) return;

    const snapshot = room.getSnapshot();
    ws.send(createMessage(MessageType.STATE_SNAPSHOT, snapshot));

    const users = this.presence.getRoomUsers(ws._roomId);
    ws.send(createMessage(MessageType.PRESENCE_STATE, { users }));
  }

  // ── Pub/Sub listeners for cross-instance communication ────

  _setupPubSubListeners() {
    // In a scaled setup, messages from other instances arrive here
    // and get broadcast to local connections.
    // For single-instance (memory adapter), this is a no-op since
    // the local broadcast already handles it.
  }
}

module.exports = MessageHandler;
