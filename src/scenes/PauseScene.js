import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { AudioManager } from '../managers/AudioManager.js';
import { FONT_TITLE, FONT_UI, COLORS, menuList, panel } from '../ui/UiKit.js';

/** Menú de pausa superpuesto. init({ from }) indica la escena pausada. */
export default class PauseScene extends Phaser.Scene {
  constructor() {
    super(SCENES.PAUSE);
  }

  init(data) {
    this.from = data?.from ?? SCENES.LEVEL;
  }

  create() {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive();
    panel(this, W / 2, H / 2, 420, 330, 0.95);
    this.add.text(W / 2, H / 2 - 120, 'Pausa', {
      fontFamily: FONT_TITLE, fontSize: '42px', color: COLORS.ink,
    }).setOrigin(0.5);

    const muteLabel = () => (AudioManager.muted ? 'Activar sonido' : 'Silenciar');
    const list = menuList(this, W / 2, H / 2 - 40, [
      { label: 'Continuar', onSelect: () => this.resume() },
      { label: muteLabel(), onSelect: () => { AudioManager.toggleMute(); list.items[1].setText(muteLabel()); } },
      { label: 'Reiniciar nivel', onSelect: () => this.restart() },
      { label: 'Menú principal', onSelect: () => this.toMenu() },
    ], { fontSize: 24, spacing: 48 });

    this.input.keyboard.once('keydown-ESC', () => this.resume());
    this.input.keyboard.once('keydown-P', () => this.resume());
    this.game.sound.pauseAll();
  }

  resume() {
    this.game.sound.resumeAll();
    this.scene.resume(this.from);
    this.scene.stop();
  }

  restart() {
    this.game.sound.resumeAll();
    const target = this.scene.get(this.from);
    const data = target?.sys.settings.data ?? {};
    this.scene.stop(SCENES.HUD);
    this.scene.stop(this.from);
    this.scene.start(this.from, data);
  }

  toMenu() {
    this.game.sound.resumeAll();
    AudioManager.stopMusic();
    this.scene.stop(SCENES.HUD);
    this.scene.stop(this.from);
    this.scene.start(SCENES.MENU);
  }
}
