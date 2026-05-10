// ─────────────────────────────────────────────────────────────
// Utilities — Shared helper functions
// ─────────────────────────────────────────────────────────────

const Utils = {
  /** Generate a short random ID */
  generateId() {
    return Math.random().toString(36).substring(2, 10);
  },

  /** Generate a UUID v4 */
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  /** Throttle a function */
  throttle(fn, ms) {
    let last = 0;
    let timer = null;
    return function (...args) {
      const now = Date.now();
      const remaining = ms - (now - last);
      if (remaining <= 0) {
        if (timer) { clearTimeout(timer); timer = null; }
        last = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  },

  /** Show a notification toast */
  notify(message, type = 'info') {
    const container = document.getElementById('notifications');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  },

  /** Distance between two points */
  distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  },

  /** Get initials from a name */
  getInitials(name) {
    return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
};
