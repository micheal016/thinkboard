// ─────────────────────────────────────────────────────────────
// Pub/Sub Factory — Selects adapter based on configuration
// ─────────────────────────────────────────────────────────────

const config = require('../config');

function createPubSub() {
  if (config.adapterMode === 'redis') {
    const RedisPubSub = require('./redis');
    return new RedisPubSub();
  }
  const MemoryPubSub = require('./memory');
  return new MemoryPubSub();
}

module.exports = { createPubSub };
