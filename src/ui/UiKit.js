/**
 * Componentes de UI reutilizables con alto contraste: botones de texto navegables
 * con teclado/ratón/táctil, botón de mute (control de audio único del juego) y
 * panel de audio con volumen de música y efectos.
 */
import { AudioManager } from '../managers/AudioManager.js';

export const FONT_TITLE = 'Georgia, "Times New Roman", serif';
export const FONT_UI = '"Trebuchet MS", system-ui, sans-serif';

/**
 * Envuelve un manejador de teclado para que procese cada evento nativo UNA sola vez.
 * Phaser puede reemitir el mismo KeyboardEvent en más de un paso del bucle (se observó
 * en pruebas: una flecha avanzaba dos opciones y M silenciaba y reactivaba a la vez).
 */
export function oncePerKeyEvent(handler) {
  const seen = new WeakSet();
  return (event, ...rest) => {
    const native = event?.originalEvent ?? event;
    if (native && typeof native === 'object') {
      if (seen.has(native)) return;
      seen.add(native);
    }
    handler(event, ...rest);
  };
}

export const COLORS = {
  ink: '#f4ecff',
  dim: '#bfb2d6',
  accent: '#ff9a3c',
  panel: 0x140e24,
  panelBorder: 0xff9a3c,
};

/** Panel semitransparente con borde doble (estilo coherente con el HUD). */
export function panel(scene, x, y, w, h, alpha = 0.82) {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.panel, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  g.lineStyle(2, COLORS.panelBorder, 0.9).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
  g.lineStyle(1, 0xffd9a8, 0.25).strokeRoundedRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 10, 9);
  return g;
}

/**
 * Lista vertical de botones con foco por teclado (↑/↓/W/S + Enter/Espacio/J).
 * @returns {{ destroy: Function, items: Phaser.GameObjects.Text[], setEnabled: Function, setLabel: Function }}
 */
export function menuList(scene, x, y, options, { spacing = 52, fontSize = 28 } = {}) {
  let index = 0;
  let enabled = true;
  const items = options.map((opt, i) => {
    const t = scene.add.text(x, y + i * spacing, opt.label, {
      fontFamily: FONT_UI, fontSize: `${fontSize}px`, color: COLORS.ink,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => { if (enabled) { index = i; refresh(); } });
    t.on('pointerup', () => { if (enabled) choose(i); });
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
  const onKey = oncePerKeyEvent((event) => {
    if (!enabled) return;
    const k = event.code;
    if (k === 'ArrowDown' || k === 'KeyS') { index = (index + 1) % items.length; refresh(); }
    else if (k === 'ArrowUp' || k === 'KeyW') { index = (index - 1 + items.length) % items.length; refresh(); }
    else if (k === 'Enter' || k === 'Space' || k === 'KeyJ') choose(index);
  });
  kb.on('keydown', onKey);
  const destroy = () => {
    kb.off('keydown', onKey);
    items.forEach((t) => t.destroy());
  };
  scene.events.once('shutdown', () => kb.off('keydown', onKey));
  refresh();
  return {
    items,
    destroy,
    setEnabled(v) { enabled = v; items.forEach((t) => t.setAlpha(v ? 1 : 0.35)); },
    setLabel(i, label) { options[i].label = label; refresh(); },
  };
}

/** Clave de textura del icono de sonido (sprite de Codex o respaldo procedural). */
function soundIcon(muted) {
  return muted ? 'icon_sound_off' : 'icon_sound_on';
}

/**
 * Botón de mute en la esquina: icono pixel art SIN recuadro, con halo al pasar el
 * ratón. Clic = silenciar; tecla M también. Mantener pulsado / clic derecho abre
 * el panel de volumen si se pasa `onOpenAudio`.
 */
export function muteButton(scene, x, y, { onOpenAudio } = {}) {
  const icon = scene.add.image(x, y, soundIcon(AudioManager.muted))
    .setOrigin(1, 0).setScrollFactor(0).setDepth(1000)
    .setScale(32 / scene.textures.get('icon_sound_on').getSourceImage().height)
    .setInteractive({ useHandCursor: true, pixelPerfect: false });
  icon.on('pointerover', () => icon.setTint(0xffd9a8));
  icon.on('pointerout', () => icon.clearTint());
  icon.on('pointerup', (pointer, _lx, _ly, event) => {
    event?.stopPropagation?.();
    if (pointer.rightButtonReleased?.() && onOpenAudio) onOpenAudio();
    else AudioManager.toggleMute();
  });
  const unsubscribe = AudioManager.onMuteChange((m) => icon.setTexture(soundIcon(m)));
  const onM = oncePerKeyEvent(() => AudioManager.toggleMute());
  scene.input.keyboard.on('keydown-M', onM);
  scene.events.once('shutdown', () => {
    unsubscribe();
    scene.input.keyboard.off('keydown-M', onM);
  });
  return icon;
}

/**
 * Panel modal de audio: volumen de música, volumen de efectos y silencio.
 * Teclado: ↑/↓ elegir fila, ←/→ ajustar, Esc/Enter cerrar. Ratón/táctil: botones − / +.
 * @param {Phaser.Scene} scene
 * @param {Function} onClose
 */
export function audioPanel(scene, onClose) {
  const W = scene.scale.gameSize.width;
  const H = scene.scale.gameSize.height;
  const c = scene.add.container(0, 0).setDepth(2000).setScrollFactor(0);
  const shade = scene.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setInteractive();
  const g = panel(scene, W / 2, H / 2, 520, 300, 0.97);
  const title = scene.add.text(W / 2, H / 2 - 112, 'Audio', {
    fontFamily: FONT_TITLE, fontSize: '34px', color: COLORS.ink,
  }).setOrigin(0.5);
  c.add([shade, g, title]);

  const rows = [
    { label: 'Música', get: () => AudioManager.musicVolume, set: (v) => AudioManager.setMusicVolume(v) },
    { label: 'Efectos', get: () => AudioManager.sfxVolume, set: (v) => { AudioManager.setSfxVolume(v); AudioManager.sfx(scene, 'sfx_ui_select'); } },
    { label: 'Silencio', toggle: true, get: () => AudioManager.muted, set: () => AudioManager.toggleMute() },
  ];
  let sel = 0;
  const views = rows.map((row, i) => {
    const y = H / 2 - 44 + i * 58;
    const name = scene.add.text(W / 2 - 210, y, row.label, {
      fontFamily: FONT_UI, fontSize: '22px', color: COLORS.ink,
    }).setOrigin(0, 0.5);
    const barBg = scene.add.rectangle(W / 2 - 52, y, 200, 14, 0x2a2040).setOrigin(0, 0.5).setStrokeStyle(2, 0x6b5a8a);
    const bar = scene.add.rectangle(W / 2 - 50, y, 0, 10, 0xff9a3c).setOrigin(0, 0.5);
    const value = scene.add.text(W / 2 + 184, y, '', {
      fontFamily: FONT_UI, fontSize: '20px', color: COLORS.ink,
    }).setOrigin(0.5);
    const minus = scene.add.text(W / 2 - 76, y, '−', {
      fontFamily: FONT_UI, fontSize: '30px', color: COLORS.accent,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const plus = scene.add.text(W / 2 + 226, y, '+', {
      fontFamily: FONT_UI, fontSize: '30px', color: COLORS.accent,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    minus.on('pointerup', () => { sel = i; adjust(-1); });
    plus.on('pointerup', () => { sel = i; adjust(1); });
    if (row.toggle) {
      barBg.setVisible(false); bar.setVisible(false); minus.setVisible(false); plus.setVisible(false);
      value.setX(W / 2 + 60).setInteractive({ useHandCursor: true }).on('pointerup', () => { sel = i; adjust(1); });
    }
    c.add([name, barBg, bar, value, minus, plus]);
    return { name, bar, value };
  });

  const close = scene.add.text(W / 2, H / 2 + 118, 'Cerrar', {
    fontFamily: FONT_UI, fontSize: '22px', color: COLORS.accent, stroke: '#000', strokeThickness: 3,
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  close.on('pointerup', () => finish());
  c.add(close);

  function render() {
    rows.forEach((row, i) => {
      const v = views[i];
      v.name.setColor(i === sel ? COLORS.accent : COLORS.ink);
      if (row.toggle) v.value.setText(row.get() ? 'Activado' : 'Desactivado');
      else {
        const val = row.get();
        v.bar.width = 196 * val;
        v.value.setText(`${Math.round(val * 100)}%`);
      }
    });
  }

  function adjust(dir) {
    const row = rows[sel];
    if (row.toggle) row.set();
    else row.set(row.get() + dir * 0.1);
    render();
  }

  const kb = scene.input.keyboard;
  const onKey = oncePerKeyEvent((e) => {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') sel = (sel + 1) % rows.length;
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') sel = (sel - 1 + rows.length) % rows.length;
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') adjust(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') adjust(1);
    else if (e.code === 'Escape' || e.code === 'Enter') { finish(); return; }
    render();
  });
  // Se registra en el siguiente tick para no capturar el Enter que abrió el panel.
  scene.time.delayedCall(0, () => kb.on('keydown', onKey));
  const unsubscribe = AudioManager.onMuteChange(() => render());

  let done = false;
  function finish() {
    if (done) return;
    done = true;
    kb.off('keydown', onKey);
    unsubscribe();
    c.destroy(true);
    onClose?.();
  }
  scene.events.once('shutdown', () => { if (!done) { kb.off('keydown', onKey); unsubscribe(); } });
  render();
  return { close: finish };
}
