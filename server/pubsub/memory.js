// ─────────────────────────────────────────────────────────────
// In-Memory Pub/Sub — EventEmitter-based for single instance
// ─────────────────────────────────────────────────────────────

const EventEmitter = require('events');

class MemoryPubSub {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(1000); // Support many rooms
    console.log('[PubSub] Using in-memory adapter (single instance mode)');
  }

  /**
   * Subscribe to a channel
   * @param {string} channel
   * @param {Function} handler
   */
  subscribe(channel, handler) {
    this.emitter.on(channel, handler);
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel, handler) {
    this.emitter.off(channel, handler);
  }

  /**
   * Publish a message to a channel
   */
  publish(channel, message) {
    this.emitter.emit(channel, message);
  }

  /**
   * Cleanup
   */
  async destroy() {
    this.emitter.removeAllListeners();
  }
}

module.exports = MemoryPubSub;
