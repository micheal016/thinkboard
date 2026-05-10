// ─────────────────────────────────────────────────────────────
// WebSocket Server — Connection lifecycle management
// ─────────────────────────────────────────────────────────────

const { WebSocketServer } = require('ws');
const { parseMessage } = require('./protocol');
const MessageHandler = require('./handler');

function createWebSocketServer(httpServer, roomManager, presenceTracker, pubsub) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    // Ping/pong for connection health (detect dead connections)
    clientTracking: true,
  });

  const handler = new MessageHandler(roomManager, presenceTracker, pubsub);

  wss.on('connection', (ws, req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[WS] New connection from ${ip}`);

    // Heartbeat for dead connection detection
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Message handling
    ws.on('message', (raw) => {
      const msg = parseMessage(raw.toString());
      if (!msg) {
        console.warn('[WS] Received invalid message');
        return;
      }
      handler.handle(ws, msg);
    });

    // Disconnection
    ws.on('close', () => {
      handler.handleDisconnect(ws);
    });

    // Error handling
    ws.on('error', (err) => {
      console.error('[WS] Connection error:', err.message);
      handler.handleDisconnect(ws);
    });
  });

  // Ping interval to detect dead connections (every 30s)
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        handler.handleDisconnect(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  console.log(`[WS] WebSocket server ready on path /ws`);
  return wss;
}

module.exports = { createWebSocketServer };
