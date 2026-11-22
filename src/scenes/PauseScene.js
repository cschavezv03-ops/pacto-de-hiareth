import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { AudioManager } from '../managers/AudioManager.js';
import { GameState } from '../managers/GameState.js';
import { FONT_TITLE, COLORS, menuList, panel, audioPanel, oncePerKeyEvent } from '../ui/UiKit.js';

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
    panel(this, W / 2, H / 2, 420, 340, 0.95);
    this.add.text(W / 2, H / 2 - 126, 'Pausa', {
      fontFamily: FONT_TITLE, fontSize: '42px', color: COLORS.ink,
    }).setOrigin(0.5);

    this.audioOpen = false;
    const restartLabel = this.from === SCENES.BOSS ? 'Reiniciar combate' : 'Reintentar';
    this.list = menuList(this, W / 2, H / 2 - 50, [
      { label: 'Continuar', onSelect: () => this.resume() },
      { label: 'Opciones', onSelect: () => this.openAudio() },
      { label: restartLabel, onSelect: () => this.restart() },
      { label: 'Menú principal', onSelect: () => this.toMenu() },
    ], { fontSize: 24, spacing: 48 });

    const onEsc = oncePerKeyEvent(() => { if (!this.audioOpen) this.resume(); });
    this.input.keyboard.on('keydown-ESC', onEsc);
    this.input.keyboard.on('keydown-P', onEsc);
    // La música se mantiene (con su volumen) para poder ajustar el audio en pausa;
    // solo se detienen los efectos en curso.
  }

  openAudio() {
    this.audioOpen = true;
    this.list.setEnabled(false);
    audioPanel(this, () => {
      // Esperar un tick para que el Esc que cierra el panel no reanude el juego.
      this.time.delayedCall(0, () => { this.audioOpen = false; this.list.setEnabled(true); });
    });
  }

  resume() {
    this.scene.resume(this.from);
    this.scene.stop();
  }

  restart() {
    GameState.resetOrbs(); // reiniciar a mano cuenta como perder (evita acumular orbes)
    const target = this.scene.get(this.from);
    const data = target?.sys.settings.data ?? {};
    this.scene.stop(SCENES.HUD);
    this.scene.stop(this.from);
    this.scene.start(this.from, data);
  }

  toMenu() {
    AudioManager.stopMusic();
    this.scene.stop(SCENES.HUD);
    this.scene.stop(this.from);
    this.scene.start(SCENES.MENU);
  }
}
