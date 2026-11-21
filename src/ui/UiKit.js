/**
 * Componentes de UI reutilizables con alto contraste: botones de texto navegables
 * con teclado/ratón/táctil y botón de mute (control de audio único del juego).
 */
import { AudioManager } from '../managers/AudioManager.js';

export const FONT_TITLE = 'Georgia, "Times New Roman", serif';
export const FONT_UI = '"Trebuchet MS", system-ui, sans-serif';

export const COLORS = {
  ink: '#f4ecff',
  dim: '#bfb2d6',
  accent: '#ff9a3c',
  panel: 0x140e24,
  panelBorder: 0xff9a3c,
};

/** Panel semitransparente con borde. */
export function panel(scene, x, y, w, h, alpha = 0.82) {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.panel, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  g.lineStyle(2, COLORS.panelBorder, 0.9).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  return g;
}

/**
 * Lista vertical de botones con foco por teclado (↑/↓/W/S + Enter/Espacio/J).
 * @returns {{ destroy: Function, items: Phaser.GameObjects.Text[] }}
 */
export function menuList(scene, x, y, options, { spacing = 52, fontSize = 28 } = {}) {
  let index = 0;
  const items = options.map((opt, i) => {
    const t = scene.add.text(x, y + i * spacing, opt.label, {
      fontFamily: FONT_UI, fontSize: `${fontSize}px`, color: COLORS.ink,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => { index = i; refresh(); });
    t.on('pointerup', () => choose(i));
    return t;
  });

  function refresh() {
    items.forEach((t, i) => {
      const active = i === index;
      t.setColor(active ? COLORS.accent : COLORS.ink);
      t.setText(active ? `›  ${options[i].label}  ‹` : options[i].label);
      t.setScale(active ? 1.06 : 1);
    });
  }

  function choose(i) {
    AudioManager.sfx(scene, 'sfx_ui_select');
    options[i].onSelect();
  }

  const kb = scene.input.keyboard;
  const onKey = (event) => {
    const k = event.code;
    if (k === 'ArrowDown' || k === 'KeyS') { index = (index + 1) % items.length; refresh(); }
    else if (k === 'ArrowUp' || k === 'KeyW') { index = (index - 1 + items.length) % items.length; refresh(); }
    else if (k === 'Enter' || k === 'Space' || k === 'KeyJ') choose(index);
  };
  kb.on('keydown', onKey);
  const destroy = () => kb.off('keydown', onKey);
  scene.events.once('shutdown', destroy);
  refresh();
  return { items, destroy };
}

/** Botón de mute en la esquina; sincronizado con AudioManager (tecla M también). */
export function muteButton(scene, x, y) {
  const label = () => (AudioManager.muted ? '🔇' : '🔊');
  const t = scene.add.text(x, y, label(), {
    fontFamily: FONT_UI, fontSize: '26px', color: COLORS.ink,
    backgroundColor: '#140e24cc', padding: { x: 8, y: 4 },
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
  t.on('pointerup', (pointer, lx, ly, event) => {
    event?.stopPropagation?.();
    AudioManager.toggleMute();
  });
  const unsubscribe = AudioManager.onMuteChange(() => t.setText(label()));
  const onM = () => AudioManager.toggleMute();
  scene.input.keyboard.on('keydown-M', onM);
  scene.events.once('shutdown', () => {
    unsubscribe();
    scene.input.keyboard.off('keydown-M', onM);
  });
  return t;
}
