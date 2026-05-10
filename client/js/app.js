// ─────────────────────────────────────────────────────────────
// App — Main application orchestrator
// ─────────────────────────────────────────────────────────────

(function () {
  // ── State ──
  let ws, canvas, tools, toolbar, presence;

  // ── Join Screen Logic ──
  const joinScreen = document.getElementById('join-screen');
  const whiteboardScreen = document.getElementById('whiteboard-screen');
  const usernameInput = document.getElementById('username-input');
  const roomInput = document.getElementById('room-input');
  const joinBtn = document.getElementById('join-btn');
  const generateRoomBtn = document.getElementById('generate-room-btn');
  const leaveBtn = document.getElementById('leave-btn');
  const copyRoomBtn = document.getElementById('copy-room-btn');

  // Pre-fill from URL hash
  const hashRoom = location.hash.slice(1);
  if (hashRoom) roomInput.value = hashRoom;

  generateRoomBtn.addEventListener('click', () => {
    roomInput.value = 'room-' + Utils.generateId();
  });

  joinBtn.addEventListener('click', joinRoom);
  usernameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
  roomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });

  function joinRoom() {
    const username = usernameInput.value.trim() || 'Anonymous';
    let roomId = roomInput.value.trim();
    if (!roomId) {
      roomId = 'room-' + Utils.generateId();
      roomInput.value = roomId;
    }

    // Initialize everything
    initWhiteboard(roomId, username);
  }

  function initWhiteboard(roomId, username) {
    // Show whiteboard, hide join
    joinScreen.classList.add('hidden');
    whiteboardScreen.classList.remove('hidden');
    document.getElementById('room-id-display').textContent = roomId;
    location.hash = roomId;

    // Create components
    ws = new WsClient();
    canvas = new CanvasEngine('whiteboard-canvas');
    tools = new ToolManager(canvas, ws);
    presence = new PresenceUI();
    toolbar = new ToolbarController(tools);

    // Throttled cursor broadcast
    const sendCursor = Utils.throttle((x, y) => {
      ws.send('presence_update', { cursor: { x, y }, tool: tools.activeTool });
    }, 50);

    tools._onCursorMove = (x, y) => sendCursor(x, y);

    // ── WebSocket Event Handlers ──

    ws.on('room_joined', (msg) => {
      presence.setMyUserId(msg.userId);
      Utils.notify(`Joined room "${msg.roomId}" as ${msg.username}`, 'success');
    });

    ws.on('state_snapshot', (msg) => {
      // Load existing operations from CRDT log
      const ops = (msg.operations || []).filter(op => !op.undone);
      canvas.loadOperations(ops);
    });

    ws.on('presence_state', (msg) => {
      presence.setUsers(msg.users || []);
    });

    ws.on('draw_op', (msg) => {
      if (msg.operation) {
        canvas.addOperation(msg.operation);
      }
    });

    ws.on('draw_batch', (msg) => {
      canvas.replaceOperations(msg.operations || []);
    });

    ws.on('clear_canvas', () => {
      canvas.clearAll();
      Utils.notify('Canvas cleared', 'info');
    });

    ws.on('user_joined', (msg) => {
      presence.updateUser(msg);
      Utils.notify(`${msg.username} joined`, 'info');
    });

    ws.on('user_left', (msg) => {
      presence.removeUser(msg.userId);
      Utils.notify(`${msg.username} left`, 'info');
    });

    ws.on('presence_update', (msg) => {
      presence.updateCursor(msg.userId, msg.cursor.x, msg.cursor.y, msg.color, msg.username);
      presence.updateUser(msg);
    });

    ws.on('error', (msg) => {
      Utils.notify(msg.message || 'An error occurred', 'warning');
    });

    // Connect and join
    ws.connect();
    ws.on('open', () => {
      ws.joinRoom(roomId, username);
    });

    // ── Zoom Controls ──
    document.getElementById('zoom-in-btn').addEventListener('click', () => {
      canvas.setZoom(canvas.scale * 1.2);
    });
    document.getElementById('zoom-out-btn').addEventListener('click', () => {
      canvas.setZoom(canvas.scale * 0.8);
    });
    document.getElementById('zoom-fit-btn').addEventListener('click', () => {
      canvas.resetViewport();
    });

    // ── Leave Room ──
    leaveBtn.addEventListener('click', leaveRoom);

    // ── Copy Room Link ──
    copyRoomBtn.addEventListener('click', () => {
      const url = `${location.origin}${location.pathname}#${roomId}`;
      navigator.clipboard.writeText(url).then(() => {
        Utils.notify('Room link copied!', 'success');
      });
    });
  }

  function leaveRoom() {
    if (ws) ws.leaveRoom();
    if (presence) presence.clear();

    whiteboardScreen.classList.add('hidden');
    joinScreen.classList.remove('hidden');
    location.hash = '';
  }

  // ── Auto-join if URL has room hash ──
  if (hashRoom) {
    // Small delay to let the page render
    setTimeout(() => {
      const name = usernameInput.value.trim() || 'Anonymous';
      initWhiteboard(hashRoom, name);
    }, 300);
  }
})();
