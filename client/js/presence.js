// ─────────────────────────────────────────────────────────────
// Presence UI — Renders remote cursors and user avatars
// ─────────────────────────────────────────────────────────────

class PresenceUI {
  constructor() {
    this.users = new Map(); // userId -> user data
    this.cursors = new Map(); // userId -> cursor DOM element
    this.myUserId = null;
  }

  setMyUserId(id) { this.myUserId = id; }

  /** Add or update a user */
  updateUser(user) {
    if (user.userId === this.myUserId) return;
    this.users.set(user.userId, user);
    this._renderAvatars();
  }

  /** Remove a user */
  removeUser(userId) {
    this.users.delete(userId);
    this._removeCursor(userId);
    this._renderAvatars();
  }

  /** Set full user list */
  setUsers(users) {
    this.users.clear();
    for (const u of users) {
      if (u.userId !== this.myUserId) {
        this.users.set(u.userId, u);
      }
    }
    this._renderAvatars();
  }

  /** Update a remote cursor position */
  updateCursor(userId, x, y, color, username) {
    if (userId === this.myUserId) return;

    let el = this.cursors.get(userId);
    if (!el) {
      el = document.createElement('div');
      el.className = 'remote-cursor';
      el.innerHTML = `
        <div class="cursor-pointer" style="color:${color}"></div>
        <div class="cursor-label" style="background:${color}">${username || 'User'}</div>
      `;
      document.getElementById('cursors-layer').appendChild(el);
      this.cursors.set(userId, el);
    }

    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  /** Remove a cursor */
  _removeCursor(userId) {
    const el = this.cursors.get(userId);
    if (el) {
      el.remove();
      this.cursors.delete(userId);
    }
  }

  /** Render avatar pills in the top bar */
  _renderAvatars() {
    const container = document.getElementById('presence-avatars');
    if (!container) return;
    container.innerHTML = '';

    for (const [, user] of this.users) {
      const avatar = document.createElement('div');
      avatar.className = 'presence-avatar';
      avatar.style.background = user.color || '#555';
      avatar.textContent = Utils.getInitials(user.username || 'U');

      const tooltip = document.createElement('span');
      tooltip.className = 'avatar-tooltip';
      tooltip.textContent = user.username || 'User';
      avatar.appendChild(tooltip);

      container.appendChild(avatar);
    }
  }

  /** Clear all presence data */
  clear() {
    this.users.clear();
    for (const [, el] of this.cursors) el.remove();
    this.cursors.clear();
    this._renderAvatars();
  }
}
