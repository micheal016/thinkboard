// ─────────────────────────────────────────────────────────────
// Redis State Store — For shared state in scaled deployments
// ─────────────────────────────────────────────────────────────

const Redis = require('ioredis');
const config = require('../config');

class RedisStateStore {
  constructor() {
    this.client = new Redis(config.redis.url);
    this.client.on('connect', () => console.log('[State] Redis store connected'));
    this.client.on('error', (err) => console.error('[State] Redis error:', err.message));
    console.log('[State] Using Redis store (horizontal scaling mode)');
  }

  async get(key) {
    const val = await this.client.get(key);
    return val ? JSON.parse(val) : null;
  }

  async set(key, value) {
    await this.client.set(key, JSON.stringify(value));
  }

  async delete(key) {
    await this.client.del(key);
  }

  async exists(key) {
    return (await this.client.exists(key)) === 1;
  }

  async keys(pattern) {
    return this.client.keys(pattern);
  }

  async destroy() {
    await this.client.quit();
  }
}

module.exports = RedisStateStore;
