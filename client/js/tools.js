// ─────────────────────────────────────────────────────────────
// Tools — Drawing tool implementations (input → operations)
// ─────────────────────────────────────────────────────────────

class ToolManager {
  constructor(canvas, wsClient) {
    this.canvas = canvas;
    this.ws = wsClient;
    this.activeTool = 'pen';
    this.color = '#ffffff';
    this.strokeWidth = 3;
    this.lamportCounter = 0;

    this._startPoint = null;
    this._drawing = false;
    this._currentPoints = [];

    this._bindEvents();
  }

  setTool(tool) {
    this.activeTool = tool;
    const container = document.getElementById('canvas-container');
    container.style.cursor = tool === 'eraser' ? 'cell' :
                             tool === 'text' ? 'text' : 'crosshair';
  }

  setColor(color) { this.color = color; }
  setStrokeWidth(w) { this.strokeWidth = w; }

  _bindEvents() {
    const container = document.getElementById('canvas-container');

    container.addEventListener('mousedown', (e) => this._onPointerDown(e));
    container.addEventListener('mousemove', (e) => this._onPointerMove(e));
    container.addEventListener('mouseup', (e) => this._onPointerUp(e));
    container.addEventListener('mouseleave', (e) => { if (this._drawing) this._onPointerUp(e); });

    // Touch support
    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._onPointerDown(this._touchToMouse(e));
    }, { passive: false });
    container.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this._onPointerMove(this._touchToMouse(e));
    }, { passive: false });
    container.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._onPointerUp(this._touchToMouse(e));
    });

    // Zoom with mouse wheel
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = container.getBoundingClientRect();
      this.canvas.setZoom(this.canvas.scale * delta, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    // Middle mouse button pan
    let panning = false, panStart = null;
    container.addEventListener('mousedown', (e) => {
      if (e.button === 1) { panning = true; panStart = { x: e.clientX, y: e.clientY }; e.preventDefault(); }
    });
    container.addEventListener('mousemove', (e) => {
      if (panning && panStart) {
        this.canvas.pan(e.clientX - panStart.x, e.clientY - panStart.y);
        panStart = { x: e.clientX, y: e.clientY };
      }
    });
    container.addEventListener('mouseup', (e) => {
      if (e.button === 1) { panning = false; panStart = null; }
    });
  }

  _touchToMouse(e) {
    const t = e.touches[0] || e.changedTouches[0];
    return { clientX: t.clientX, clientY: t.clientY, button: 0 };
  }

  _getCanvasPos(e) {
    const rect = this.canvas.canvas.parentElement.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return this.canvas.screenToCanvas(sx, sy);
  }

  _onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const pos = this._getCanvasPos(e);
    this._drawing = true;
    this._startPoint = pos;
    this._currentPoints = [pos];

    if (this.activeTool === 'text') {
      this._showTextInput(e.clientX, e.clientY, pos);
      this._drawing = false;
      return;
    }

    if (this.activeTool === 'pen' || this.activeTool === 'eraser') {
      this.canvas.currentOp = {
        tool: this.activeTool,
        data: { points: [pos], color: this.color, width: this.strokeWidth }
      };
    }
  }

  _onPointerMove(e) {
    // Send presence update (throttled in app.js)
    const rect = this.canvas.canvas.parentElement.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (this._onCursorMove) this._onCursorMove(sx, sy);

    if (!this._drawing) return;
    const pos = this._getCanvasPos(e);

    if (this.activeTool === 'pen' || this.activeTool === 'eraser') {
      this._currentPoints.push(pos);
      this.canvas.currentOp = {
        tool: this.activeTool,
        data: { points: [...this._currentPoints], color: this.color, width: this.strokeWidth }
      };
      this.canvas.render();
    } else if (this.activeTool === 'line') {
      this.canvas.currentOp = {
        tool: 'line',
        data: { x1: this._startPoint.x, y1: this._startPoint.y, x2: pos.x, y2: pos.y, color: this.color, width: this.strokeWidth }
      };
      this.canvas.render();
    } else if (this.activeTool === 'rectangle') {
      const x = Math.min(this._startPoint.x, pos.x);
      const y = Math.min(this._startPoint.y, pos.y);
      const w = Math.abs(pos.x - this._startPoint.x);
      const h = Math.abs(pos.y - this._startPoint.y);
      this.canvas.currentOp = {
        tool: 'rectangle',
        data: { x, y, w, h, color: this.color, width: this.strokeWidth }
      };
      this.canvas.render();
    } else if (this.activeTool === 'circle') {
      const cx = (this._startPoint.x + pos.x) / 2;
      const cy = (this._startPoint.y + pos.y) / 2;
      const rx = Math.abs(pos.x - this._startPoint.x) / 2;
      const ry = Math.abs(pos.y - this._startPoint.y) / 2;
      this.canvas.currentOp = {
        tool: 'circle',
        data: { cx, cy, rx, ry, color: this.color, width: this.strokeWidth }
      };
      this.canvas.render();
    }
  }

  _onPointerUp(e) {
    if (!this._drawing) return;
    this._drawing = false;

    const op = this.canvas.currentOp;
    this.canvas.currentOp = null;

    if (!op) return;

    // Skip tiny accidental clicks for shapes
    if (op.tool === 'line' || op.tool === 'rectangle' || op.tool === 'circle') {
      const pos = this._getCanvasPos(e);
      if (Utils.distance(this._startPoint.x, this._startPoint.y, pos.x, pos.y) < 3) {
        this.canvas.render();
        return;
      }
    }

    // Finalize: add to local operations and send to server
    this.lamportCounter++;
    this.canvas.addOperation(op);
    this.ws.send('draw_op', {
      tool: op.tool,
      data: op.data,
      lamport: this.lamportCounter,
    });
  }

  _showTextInput(screenX, screenY, canvasPos) {
    const input = document.getElementById('text-input-overlay');
    input.classList.remove('hidden');
    input.style.left = screenX + 'px';
    input.style.top = screenY + 'px';
    input.style.color = this.color;
    input.value = '';
    input.focus();

    const commit = () => {
      const text = input.value.trim();
      input.classList.add('hidden');
      input.removeEventListener('blur', commit);
      input.removeEventListener('keydown', onKey);
      if (!text) return;

      const op = {
        tool: 'text',
        data: { text, x: canvasPos.x, y: canvasPos.y, color: this.color, fontSize: 16 }
      };
      this.lamportCounter++;
      this.canvas.addOperation(op);
      this.ws.send('draw_op', { tool: op.tool, data: op.data, lamport: this.lamportCounter });
    };

    const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', onKey);
  }
}
