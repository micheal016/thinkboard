// ─────────────────────────────────────────────────────────────
// HTTP Server — Express static files + health/status endpoints
// ─────────────────────────────────────────────────────────────

const express = require('express');
const path = require('path');

function createHttpServer(roomManager, presenceTracker) {
  const app = express();

  // ── Serve static client files ──
  app.use(express.static(path.join(__dirname, '..', 'client')));

  // ── Health check endpoint (for load balancers & Docker) ──
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: Date.now(),
      pid: process.pid,
      memory: process.memoryUsage(),
    });
  });

  // ── Room stats endpoint ──
  app.get('/api/rooms', (req, res) => {
    const rooms = roomManager.getStats();
    res.json({ rooms, count: rooms.length });
  });

  // ── Room info endpoint ──
  app.get('/api/rooms/:roomId', (req, res) => {
    const room = roomManager.get(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const users = presenceTracker.getRoomUsers(req.params.roomId);
    res.json({
      roomId: room.id,
      connections: room.getConnectionCount(),
      operations: room.operationLog.operations.length,
      activeOperations: room.operationLog.getActiveOperations().length,
      users: users.map(u => ({ userId: u.userId, username: u.username, color: u.color })),
      createdAt: room.createdAt,
    });
  });

  // ── Catch-all: serve index.html for client-side routing ──
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
  });

  return app;
}

module.exports = { createHttpServer };
