// ─────────────────────────────────────────────────────────────
// Toolbar Controller — UI bindings for toolbar interactions
// ─────────────────────────────────────────────────────────────

class ToolbarController {
  constructor(toolManager) {
    this.tools = toolManager;
    this._bindToolButtons();
    this._bindColorPicker();
    this._bindStrokeWidth();
    this._bindActions();
    this._bindKeyboard();
  }

  _bindToolButtons() {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tools.setTool(btn.dataset.tool);
      });
    });
  }

  _bindColorPicker() {
    const picker = document.getElementById('color-picker');
    const preview = document.getElementById('color-preview');

    picker.addEventListener('input', (e) => {
      this.tools.setColor(e.target.value);
      preview.style.background = e.target.value;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    });

    document.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        this.tools.setColor(color);
        picker.value = color;
        preview.style.background = color;
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      });
    });
  }

  _bindStrokeWidth() {
    const slider = document.getElementById('stroke-width');
    const display = document.getElementById('stroke-width-value');

    slider.addEventListener('input', () => {
      this.tools.setStrokeWidth(parseInt(slider.value, 10));
      display.textContent = slider.value;
    });
  }

  _bindActions() {
    document.getElementById('undo-btn').addEventListener('click', () => {
      this.tools.ws.send('undo', {});
    });

    document.getElementById('redo-btn').addEventListener('click', () => {
      this.tools.ws.send('redo', {});
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
      if (confirm('Clear the entire canvas for all users?')) {
        this.tools.ws.send('clear_canvas', {});
      }
    });
  }

  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Don't capture when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.tools.ws.send('undo', {}); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this.tools.ws.send('redo', {}); }

      // Tool shortcuts
      const toolMap = { p: 'pen', l: 'line', r: 'rectangle', c: 'circle', t: 'text', e: 'eraser' };
      if (!e.ctrlKey && !e.altKey && toolMap[e.key]) {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`[data-tool="${toolMap[e.key]}"]`);
        if (btn) btn.classList.add('active');
        this.tools.setTool(toolMap[e.key]);
      }
    });
  }
}
