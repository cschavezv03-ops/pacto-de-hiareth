import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { AudioManager } from '../managers/AudioManager.js';
import { FONT_TITLE, FONT_UI, COLORS, menuList } from '../ui/UiKit.js';

/**
 * Game Over. init({ retryScene, retryData }) -> reinicia el nivel/enfrentamiento
 * actual desde el principio. enemiesKilled NO se modifica (regla confirmada).
 */
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SCENES.GAME_OVER);
  }

  init(data) {
    this.retryScene = data?.retryScene ?? SCENES.LEVEL;
    this.retryData = data?.retryData ?? {};
  }

  create() {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    AudioManager.stopMusic();
    this.add.rectangle(0, 0, W, H, 0x0a0410, 1).setOrigin(0);
    const title = this.add.text(W / 2, H / 2 - 90, 'Has caído', {
      fontFamily: FONT_TITLE, fontSize: '56px', color: '#ff5470', stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: title.y + 10, duration: 700 });
    this.add.text(W / 2, H / 2 - 30, 'El nivel se reiniciará desde el principio.', {
      fontFamily: FONT_UI, fontSize: '18px', color: COLORS.dim,
    }).setOrigin(0.5);

    menuList(this, W / 2, H / 2 + 40, [
      { label: 'Reintentar', onSelect: () => this.retry() },
      { label: 'Menú principal', onSelect: () => this.scene.start(SCENES.MENU) },
    ]);
  }

  retry() {
    this.scene.start(this.retryScene, this.retryData);
  }
}
