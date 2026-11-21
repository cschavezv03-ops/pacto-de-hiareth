import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../config/constants.js';
import { AudioManager } from '../managers/AudioManager.js';
import { FONT_TITLE, FONT_UI, COLORS, panel, menuList } from '../ui/UiKit.js';

const ENCOURAGEMENT = [
  'Ya conoces su próximo movimiento.',
  'Respira. El siguiente hueco es tuyo.',
  'Cada intento te acerca a la luna.',
  'Guarda la media luna para abrirte paso.',
  'El dash te vuelve intocable un instante.',
];

/**
 * Tarjeta de derrota del jefe (estilo "¿otra vez?"): progreso del combate con las
 * tres fases, mejor avance guardado y reintento inmediato.
 * init({ progress, best }) con valores normalizados 0..1.
 */
export default class BossDefeatScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOSS_DEFEAT);
  }

  init(data = {}) {
    this.progress = Phaser.Math.Clamp(Number(data.progress) || 0, 0, 1);
    this.best = Phaser.Math.Clamp(Math.max(this.progress, Number(data.best) || 0), 0, 1);
    this.leaving = false;
  }

  create() {
    AudioManager.stopMusic();
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const cx = W / 2;

    // Fondo: la arena de la luna roja, oscurecida.
    [1, 2, 3].forEach((i) => this.add.image(0, 0, `bg_boss_${i}`).setOrigin(0).setDisplaySize(W, H));
    this.add.rectangle(0, 0, W, H, 0x07040d, 0.72).setOrigin(0);
    panel(this, cx, H / 2, 720, 440, 0.94);

    const text = (x, y, value, size, color = COLORS.ink, font = FONT_UI) => this.add.text(x, y, value, {
      fontFamily: font, fontSize: `${size}px`, color, align: 'center', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);

    const title = text(cx, 92, 'La luna sigue en pie', 40, '#ff8fa8', FONT_TITLE);
    title.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 420, ease: 'Back.Out' });
    text(cx, 138, ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)], 18, COLORS.dim);

    // Barra de progreso con marcas de fase.
    const left = cx - 280;
    const width = 560;
    const y = 222;
    const g = this.add.graphics();
    g.fillStyle(0x07040d, 0.9).fillRoundedRect(left - 8, y - 14, width + 16, 28, 8);
    g.lineStyle(2, 0xb48cff, 0.9).strokeRoundedRect(left - 8, y - 14, width + 16, 28, 8);
    const fill = this.add.rectangle(left, y, 0, 14, 0xc0204a).setOrigin(0, 0.5);
    // El mejor avance como marca tenue.
    this.add.rectangle(left + width * this.best, y, 3, 22, 0xffd9a8, 0.8);
    for (const mark of [1 / 3, 2 / 3]) this.add.rectangle(left + width * mark, y, 3, 26, 0xf4ecff, 0.85);
    text(left + width / 6, y + 34, 'I · Raíces', 16, COLORS.dim);
    text(left + width / 2, y + 34, 'II · Astas', 16, COLORS.dim);
    text(left + (width * 5) / 6, y + 34, 'III · Luna roja', 16, COLORS.dim);

    // Icono de Aidan avanzando hasta donde llegó (como en los jefes de Cuphead).
    const icon = this.add.sprite(left, y - 34, 'aidan_fly', 0).setScale(0.42);
    if (this.anims.exists('aidan-fly')) icon.play('aidan-fly');
    const pct = text(cx, 296, '0 %', 26, COLORS.accent);
    this.tweens.addCounter({
      from: 0, to: this.progress, duration: 900, ease: 'Cubic.Out',
      onUpdate: (tw) => {
        const v = tw.getValue();
        fill.width = width * v;
        icon.x = left + width * v;
        pct.setText(`Vida quitada: ${Math.floor(v * 100)} %`);
      },
    });
    text(cx, 330, `Tu mejor avance: ${Math.floor(this.best * 100)} %`, 17, '#ffd9a8');

    menuList(this, cx, 386, [
      { label: 'Reintentar', onSelect: () => this.retry() },
      { label: 'Menú principal', onSelect: () => this.menu() },
    ], { spacing: 48, fontSize: 26 });
    text(cx, H - 72, 'J / Enter: reintentar al instante', 14, COLORS.dim);
    this.input.keyboard.once('keydown-ESC', () => this.menu());
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  retry() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start(SCENES.BOSS);
  }

  menu() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start(SCENES.MENU);
  }
}
