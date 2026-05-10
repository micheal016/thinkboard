// ─────────────────────────────────────────────────────────────
// In-Memory State Store — Map-based for single instance
// ─────────────────────────────────────────────────────────────

class MemoryStateStore {
  constructor() {
    this.store = new Map();
    console.log('[State] Using in-memory store (single instance mode)');
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async set(key, value) {
    this.store.set(key, value);
  }

  async delete(key) {
    this.store.delete(key);
  }

  async exists(key) {
    return this.store.has(key);
  }

  async keys(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter(k => regex.test(k));
  }

  async destroy() {
    this.store.clear();
  }
}

module.exports = MemoryStateStore;
