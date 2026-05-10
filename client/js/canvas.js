// ─────────────────────────────────────────────────────────────
// Canvas Engine — Drawing, rendering, and viewport management
// ─────────────────────────────────────────────────────────────

class CanvasEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Viewport / pan-zoom state
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Operations to render
    this.operations = [];

    // Current drawing state
    this.isDrawing = false;
    this.currentPath = [];
    this.currentOp = null;

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  /** Resize canvas to fill container */
  _resize() {
    const container = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = container.clientWidth * dpr;
    this.canvas.height = container.clientHeight * dpr;
    this.canvas.style.width = container.clientWidth + 'px';
    this.canvas.style.height = container.clientHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  /** Convert screen coordinates to canvas coordinates */
  screenToCanvas(sx, sy) {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale,
    };
  }

  /** Set zoom level */
  setZoom(newScale, centerX, centerY) {
    const oldScale = this.scale;
    this.scale = Math.max(0.1, Math.min(5, newScale));
    // Zoom towards center point
    if (centerX !== undefined) {
      this.offsetX = centerX - (centerX - this.offsetX) * (this.scale / oldScale);
      this.offsetY = centerY - (centerY - this.offsetY) * (this.scale / oldScale);
    }
    this.render();
    this._updateZoomDisplay();
  }

  /** Pan the viewport */
  pan(dx, dy) {
    this.offsetX += dx;
    this.offsetY += dy;
    this.render();
  }

  /** Reset viewport */
  resetViewport() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.render();
    this._updateZoomDisplay();
  }

  /** Load operations from server snapshot */
  loadOperations(ops) {
    this.operations = ops || [];
    this.render();
  }

  /** Add a single operation */
  addOperation(op) {
    this.operations.push(op);
    this.render();
  }

  /** Replace all operations (after undo/redo batch) */
  replaceOperations(ops) {
    this.operations = ops || [];
    this.render();
  }

  /** Clear all operations */
  clearAll() {
    this.operations = [];
    this.render();
  }

  /** Full render pass */
  render() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Render all operations
    for (const op of this.operations) {
      this._renderOperation(ctx, op);
    }

    // Render current in-progress operation
    if (this.currentOp) {
      this._renderOperation(ctx, this.currentOp);
    }

    ctx.restore();
  }

  /** Render a single operation */
  _renderOperation(ctx, op) {
    if (!op || !op.data) return;
    const d = op.data;
    ctx.strokeStyle = d.color || '#ffffff';
    ctx.fillStyle = d.color || '#ffffff';
    ctx.lineWidth = d.width || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (op.tool) {
      case 'pen':
        this._renderPen(ctx, d);
        break;
      case 'line':
        this._renderLine(ctx, d);
        break;
      case 'rectangle':
        this._renderRect(ctx, d);
        break;
      case 'circle':
        this._renderCircle(ctx, d);
        break;
      case 'text':
        this._renderText(ctx, d);
        break;
      case 'eraser':
        this._renderEraser(ctx, d);
        break;
    }
  }

  _renderPen(ctx, d) {
    if (!d.points || d.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(d.points[0].x, d.points[0].y);
    for (let i = 1; i < d.points.length; i++) {
      const p0 = d.points[i - 1];
      const p1 = d.points[i];
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
    }
    const last = d.points[d.points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  _renderLine(ctx, d) {
    ctx.beginPath();
    ctx.moveTo(d.x1, d.y1);
    ctx.lineTo(d.x2, d.y2);
    ctx.stroke();
  }

  _renderRect(ctx, d) {
    ctx.beginPath();
    ctx.rect(d.x, d.y, d.w, d.h);
    if (d.fill) ctx.fill();
    ctx.stroke();
  }

  _renderCircle(ctx, d) {
    ctx.beginPath();
    ctx.ellipse(d.cx, d.cy, Math.abs(d.rx), Math.abs(d.ry), 0, 0, Math.PI * 2);
    if (d.fill) ctx.fill();
    ctx.stroke();
  }

  _renderText(ctx, d) {
    ctx.font = `${d.fontSize || 16}px Inter, sans-serif`;
    ctx.fillText(d.text, d.x, d.y);
  }

  _renderEraser(ctx, d) {
    if (!d.points || d.points.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = d.width || 20;
    ctx.beginPath();
    ctx.moveTo(d.points[0].x, d.points[0].y);
    for (let i = 1; i < d.points.length; i++) {
      ctx.lineTo(d.points[i].x, d.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _updateZoomDisplay() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = Math.round(this.scale * 100) + '%';
  }
}
