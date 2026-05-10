// ─────────────────────────────────────────────────────────────
// Vector Clock — Causal ordering for distributed operations
// ─────────────────────────────────────────────────────────────
// Each client maintains a counter. The vector clock captures
// the "happened-before" relationship across all clients.

class VectorClock {
  constructor(clock = {}) {
    this.clock = { ...clock };
  }

  /**
   * Increment the counter for a given client ID
   */
  increment(clientId) {
    this.clock[clientId] = (this.clock[clientId] || 0) + 1;
    return this;
  }

  /**
   * Get the counter for a given client ID
   */
  get(clientId) {
    return this.clock[clientId] || 0;
  }

  /**
   * Merge with another vector clock (take max of each entry)
   */
  merge(other) {
    const otherClock = other instanceof VectorClock ? other.clock : other;
    const allKeys = new Set([...Object.keys(this.clock), ...Object.keys(otherClock)]);
    for (const key of allKeys) {
      this.clock[key] = Math.max(this.clock[key] || 0, otherClock[key] || 0);
    }
    return this;
  }

  /**
   * Check if this clock happened before another
   * Returns true if all entries in this clock are <= the other
   * and at least one entry is strictly <
   */
  happenedBefore(other) {
    const otherClock = other instanceof VectorClock ? other.clock : other;
    const allKeys = new Set([...Object.keys(this.clock), ...Object.keys(otherClock)]);
    let strictlyLess = false;

    for (const key of allKeys) {
      const a = this.clock[key] || 0;
      const b = otherClock[key] || 0;
      if (a > b) return false;
      if (a < b) strictlyLess = true;
    }

    return strictlyLess;
  }

  /**
   * Check if two clocks are concurrent (neither happened before the other)
   */
  isConcurrent(other) {
    return !this.happenedBefore(other) && !other.happenedBefore(this);
  }

  toJSON() {
    return { ...this.clock };
  }

  static fromJSON(json) {
    return new VectorClock(json || {});
  }
}

module.exports = VectorClock;
