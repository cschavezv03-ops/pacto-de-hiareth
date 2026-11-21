import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, RULES } from '../config/constants.js';
import { GameState } from '../managers/GameState.js';
import { FONT_UI, COLORS, muteButton } from '../ui/UiKit.js';

/**
 * HUD paralelo a LEVEL / BOSS. Lee del registry:
 *   'hearts'      -> número de corazones restantes
 *   'bossHealth'  -> { current, max, name } o null
 *   'levelTitle'  -> título del acto (se muestra unos segundos)
 *   'score'       -> se lee de GameState
 * No muestra NINGUNA información de rutas ni enemigos derrotados.
 */
export default class HudScene extends Phaser.Scene {
  constructor() {
    super(SCENES.HUD);
  }

  init(data) {
    this.mode = data?.mode ?? 'level';
  }

  create() {
    this.hearts = [];
    for (let i = 0; i < RULES.PLAYER_HEARTS; i += 1) {
      this.hearts.push(this.add.image(20 + i * 42, 20, 'heart_full').setOrigin(0).setScale(1.1));
    }
    this.scoreText = this.add.text(20, 62, '', {
      fontFamily: FONT_UI, fontSize: '18px', color: COLORS.ink, stroke: '#000', strokeThickness: 4,
    });
    muteButton(this, GAME_WIDTH - 72, 12);

    // Barra del jefe
    this.bossGroup = this.add.container(GAME_WIDTH / 2, 30).setVisible(false);
    const barW = 420;
    this.bossBarW = barW;
    const back = this.add.rectangle(0, 10, barW + 6, 22, 0x000000, 0.75).setStrokeStyle(2, 0xd9c2ff);
    this.bossFill = this.add.rectangle(-barW / 2, 10, barW, 16, 0xc0204a).setOrigin(0, 0.5);
    this.bossName = this.add.text(0, -10, 'Morrigannus', {
      fontFamily: FONT_UI, fontSize: '18px', color: '#ffd6e0', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.bossGroup.add([back, this.bossFill, this.bossName]);

    this.onHearts = (_p, v) => this.drawHearts(v);
    this.onBoss = (_p, v) => this.drawBoss(v);
    this.onTitle = (_p, v) => this.showTitle(v);
    this.registry.events.on('changedata-hearts', this.onHearts);
    this.registry.events.on('setdata-hearts', this.onHearts);
    this.registry.events.on('changedata-bossHealth', this.onBoss);
    this.registry.events.on('setdata-bossHealth', this.onBoss);
    this.registry.events.on('changedata-levelTitle', this.onTitle);
    this.events.once('shutdown', () => {
      this.registry.events.off('changedata-hearts', this.onHearts);
      this.registry.events.off('setdata-hearts', this.onHearts);
      this.registry.events.off('changedata-bossHealth', this.onBoss);
      this.registry.events.off('setdata-bossHealth', this.onBoss);
      this.registry.events.off('changedata-levelTitle', this.onTitle);
    });

    this.drawHearts(this.registry.get('hearts') ?? RULES.PLAYER_HEARTS);
    this.drawBoss(this.registry.get('bossHealth'));
    const title = this.registry.get('levelTitle');
    if (title && this.mode === 'level') this.showTitle(title);
  }

  drawHearts(n) {
    this.hearts.forEach((h, i) => {
      const full = i < n;
      const wasFull = h.texture.key === 'heart_full';
      h.setTexture(full ? 'heart_full' : 'heart_empty');
      if (wasFull && !full) {
        this.tweens.add({ targets: h, scale: { from: 1.6, to: 1.1 }, duration: 250, ease: 'Back.Out' });
      }
    });
  }

  drawBoss(info) {
    if (!info) {
      this.bossGroup.setVisible(false);
      return;
    }
    this.bossGroup.setVisible(true);
    this.bossName.setText(info.name ?? 'Morrigannus');
    const ratio = Phaser.Math.Clamp(info.current / info.max, 0, 1);
    this.bossFill.width = this.bossBarW * ratio;
  }

  showTitle(title) {
    if (!title) return;
    const t = this.add.text(GAME_WIDTH / 2, 120, title, {
      fontFamily: 'Georgia, serif', fontSize: '36px', color: COLORS.ink, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.chain({
      targets: t,
      tweens: [
        { alpha: 1, duration: 500 },
        { alpha: 1, duration: 1800 },
        { alpha: 0, duration: 600, onComplete: () => t.destroy() },
      ],
    });
  }

  update() {
    this.scoreText.setText(`Puntos: ${GameState.score}`);
  }
}
