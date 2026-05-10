// ─────────────────────────────────────────────────────────────
// WebSocket Client — Manages server connection with reconnect
// ─────────────────────────────────────────────────────────────

class WsClient {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this._roomId = null;
    this._userId = null;
    this._username = null;
    this._intentionalClose = false;
  }

  /** Connect to the WebSocket server */
  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws`;

    this.ws = new WebSocket(url);
    this._intentionalClose = false;

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
      this._updateStatus('connected');
      this._emit('open');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._emit(msg.type, msg);
      } catch (e) {
        console.warn('[WS] Bad message:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this._updateStatus('disconnected');
      this._emit('close');
      if (!this._intentionalClose) this._reconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      this._updateStatus('disconnected');
    };
  }

  /** Send a JSON message */
  send(type, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, ...payload }));
  }

  /** Register an event handler */
  on(type, handler) {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(handler);
  }

  /** Remove an event handler */
  off(type, handler) {
    if (!this.handlers[type]) return;
    this.handlers[type] = this.handlers[type].filter(h => h !== handler);
  }

  /** Join a room */
  joinRoom(roomId, username) {
    this._roomId = roomId;
    this._username = username;
    this._userId = Utils.uuid();
    this.send('join_room', {
      roomId,
      username,
      userId: this._userId,
    });
  }

  /** Leave current room */
  leaveRoom() {
    this.send('leave_room', {});
    this._intentionalClose = true;
    if (this.ws) this.ws.close();
  }

  /** Disconnect */
  disconnect() {
    this._intentionalClose = true;
    if (this.ws) this.ws.close();
  }

  // ── Private ──

  _emit(type, data) {
    const cbs = this.handlers[type];
    if (cbs) cbs.forEach(cb => cb(data));
  }

  _reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      Utils.notify('Connection lost. Please refresh.', 'warning');
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      this.connect();
      // Re-join room after reconnect
      if (this._roomId) {
        setTimeout(() => this.joinRoom(this._roomId, this._username), 500);
      }
    }, delay);
  }

  _updateStatus(status) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    el.className = 'connection-status ' + status;
    el.querySelector('.status-text').textContent =
      status === 'connected' ? 'Connected' :
      status === 'disconnected' ? 'Reconnecting...' : 'Connecting...';
  }
}
