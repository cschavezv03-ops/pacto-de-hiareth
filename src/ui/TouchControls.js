/**
 * Controles táctiles como capa HTML sobre el canvas (más nítidos y accesibles
 * que dibujarlos en Phaser, y no se ven afectados por el escalado del juego).
 * Solo se muestran en dispositivos con pantalla táctil.
 */

const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const LAYOUTS = {
  platformer: {
    left: [
      { action: 'left', label: '◀' },
      { action: 'right', label: '▶' },
    ],
    right: [
      { action: 'special', label: '✦', title: 'Fuego fantasma' },
      { action: 'attack', label: '🔥', title: 'Atacar' },
      { action: 'jump', label: '⤒', title: 'Saltar' },
    ],
  },
  boss: {
    dpad: true,
    right: [
      { action: 'dash', label: '»', title: 'Esquivar' },
      { action: 'special', label: '☾', title: 'Media luna de fuego' },
      { action: 'attack', label: '🔥', title: 'Disparar' },
    ],
  },
};

export class TouchControls {
  constructor(scene, mode) {
    this.state = {};
    this.root = null;
    if (!isTouchDevice()) return;

    const layout = LAYOUTS[mode] ?? LAYOUTS.platformer;
    const root = document.createElement('div');
    root.className = `touch-ui touch-${mode}`;

    const leftGroup = document.createElement('div');
    leftGroup.className = 'touch-group touch-left';
    if (layout.dpad) {
      leftGroup.classList.add('touch-dpad');
      for (const [action, label] of [['up', '▲'], ['left', '◀'], ['right', '▶'], ['down', '▼']]) {
        leftGroup.appendChild(this.makeButton({ action, label }));
      }
    } else {
      layout.left.forEach((b) => leftGroup.appendChild(this.makeButton(b)));
    }

    const rightGroup = document.createElement('div');
    rightGroup.className = 'touch-group touch-right';
    layout.right.forEach((b) => rightGroup.appendChild(this.makeButton(b)));

    const pause = this.makeButton({ action: 'pause', label: '❚❚', title: 'Pausa' });
    pause.classList.add("tb-pause-corner");

    root.append(leftGroup, rightGroup, pause);
    (document.getElementById('game') ?? document.body).appendChild(root);
    this.root = root;
  }

  makeButton({ action, label, title }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `touch-btn tb-${action}`;
    btn.textContent = label;
    btn.setAttribute('aria-label', title ?? action);
    const down = (e) => {
      e.preventDefault();
      this.state[action] = true;
      btn.classList.add('active');
    };
    const up = (e) => {
      e.preventDefault();
      this.state[action] = false;
      btn.classList.remove('active');
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    return btn;
  }

  /**
   * Muestra la recarga de una acción en su botón (0 = vacío, 1 = listo).
   * Se pinta con un conic-gradient para que sea legible en móvil.
   */
  setCooldown(action, ratio) {
    const btn = this.root?.querySelector(`.tb-${action}`);
    if (!btn) return;
    const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
    btn.style.setProperty('--cd', `${pct}%`);
    btn.classList.toggle('cooling', pct < 100);
  }

  destroy() {
    this.root?.remove();
    this.root = null;
    this.state = {};
  }
}
