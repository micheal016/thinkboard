// ─────────────────────────────────────────────────────────────
// Configuration — Environment-based with sensible defaults
// ─────────────────────────────────────────────────────────────

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // 'memory' for single-instance local dev, 'redis' for horizontal scaling
  adapterMode: process.env.ADAPTER_MODE || 'memory',

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  presence: {
    heartbeatInterval: parseInt(process.env.PRESENCE_HEARTBEAT_INTERVAL, 10) || 2000,
    timeout: parseInt(process.env.PRESENCE_TIMEOUT, 10) || 5000,
  },

  room: {
    maxOperations: parseInt(process.env.MAX_OPERATIONS_PER_ROOM, 10) || 10000,
    maxUsers: parseInt(process.env.MAX_USERS_PER_ROOM, 10) || 50,
  },
};

module.exports = config;
