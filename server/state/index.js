// ─────────────────────────────────────────────────────────────
// State Store Factory
// ─────────────────────────────────────────────────────────────

const config = require('../config');

function createStateStore() {
  if (config.adapterMode === 'redis') {
    const RedisStateStore = require('./redis');
    return new RedisStateStore();
  }
  const MemoryStateStore = require('./memory');
  return new MemoryStateStore();
}

module.exports = { createStateStore };
