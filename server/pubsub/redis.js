// ─────────────────────────────────────────────────────────────
// Redis Pub/Sub — For horizontal scaling across instances
// ─────────────────────────────────────────────────────────────
// When running multiple server instances behind a load balancer,
// Redis Pub/Sub ensures that drawing operations and presence
// updates are broadcast to ALL connected clients, regardless
// of which instance they are connected to.

const Redis = require('ioredis');
const config = require('../config');

class RedisPubSub {
  constructor() {
    // Redis requires separate connections for pub and sub
    this.pub = new Redis(config.redis.url);
    this.sub = new Redis(config.redis.url);
    this.handlers = new Map(); // channel -> Set<handler>

    this.sub.on('message', (channel, message) => {
      const channelHandlers = this.handlers.get(channel);
      if (channelHandlers) {
        const parsed = JSON.parse(message);
        for (const handler of channelHandlers) {
          handler(parsed);
        }
      }
    });

    this.pub.on('connect', () => console.log('[PubSub] Redis publisher connected'));
    this.sub.on('connect', () => console.log('[PubSub] Redis subscriber connected'));
    this.pub.on('error', (err) => console.error('[PubSub] Redis pub error:', err.message));
    this.sub.on('error', (err) => console.error('[PubSub] Redis sub error:', err.message));

    console.log('[PubSub] Using Redis adapter (horizontal scaling mode)');
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel, handler) {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      this.sub.subscribe(channel);
    }
    this.handlers.get(channel).add(handler);
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel, handler) {
    const channelHandlers = this.handlers.get(channel);
    if (channelHandlers) {
      channelHandlers.delete(handler);
      if (channelHandlers.size === 0) {
        this.handlers.delete(channel);
        this.sub.unsubscribe(channel);
      }
    }
  }

  /**
   * Publish a message to a channel
   */
  publish(channel, message) {
    this.pub.publish(channel, JSON.stringify(message));
  }

  /**
   * Cleanup connections
   */
  async destroy() {
    await this.pub.quit();
    await this.sub.quit();
    this.handlers.clear();
  }
}

module.exports = RedisPubSub;
