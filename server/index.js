// ─────────────────────────────────────────────────────────────
// Entry Point — Bootstrap all server components
// ─────────────────────────────────────────────────────────────

const http = require('http');
const config = require('./config');
const { createHttpServer } = require('./http-server');
const { createWebSocketServer } = require('./ws/server');
const { createPubSub } = require('./pubsub/index');
const { createStateStore } = require('./state/index');
const RoomManager = require('./rooms/manager');
const PresenceTracker = require('./presence/tracker');

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   ThinkBoard — Real-Time Collaborative Whiteboard   ║');
  console.log('║   Distributed Systems Demo                          ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log();

  // Initialize components
  const pubsub = createPubSub();
  const stateStore = createStateStore();
  const roomManager = new RoomManager();
  const presenceTracker = new PresenceTracker();

  // Create HTTP server (Express)
  const app = createHttpServer(roomManager, presenceTracker);
  const httpServer = http.createServer(app);

  // Attach WebSocket server
  createWebSocketServer(httpServer, roomManager, presenceTracker, pubsub);

  // Start listening
  httpServer.listen(config.port, () => {
    console.log();
    console.log(`[Server] Listening on http://localhost:${config.port}`);
    console.log(`[Server] WebSocket endpoint: ws://localhost:${config.port}/ws`);
    console.log(`[Server] Health check: http://localhost:${config.port}/health`);
    console.log(`[Server] Mode: ${config.adapterMode}`);
    console.log(`[Server] PID: ${process.pid}`);
    console.log();
    console.log('Open your browser to start collaborating!');
    console.log();
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Server] Shutting down gracefully...');
    presenceTracker.destroy();
    await pubsub.destroy();
    await stateStore.destroy();
    httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
