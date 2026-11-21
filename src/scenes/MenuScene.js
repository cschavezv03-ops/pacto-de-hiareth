import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { GameState } from '../managers/GameState.js';
import { SaveManager } from '../managers/SaveManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { FONT_TITLE, FONT_UI, COLORS, menuList, muteButton, panel } from '../ui/UiKit.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENES.MENU);
  }

  create() {
    AudioManager.stopMusic();
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;

    // Fondo: arena de la luna roja con parallax lento.
    this.layers = [1, 2, 3].map((i) =>
      this.add.tileSprite(0, 0, W, H, `bg_boss_${i}`).setOrigin(0).setTileScale(H / 324));
    this.add.rectangle(0, 0, W, H, 0x0d0a18, 0.35).setOrigin(0);

    this.add.text(W / 2, 92, 'El Pacto de Hiareth', {
      fontFamily: FONT_TITLE, fontSize: '58px', color: COLORS.ink,
      stroke: '#2a0f3a', strokeThickness: 8,
    }).setOrigin(0.5).setShadow(0, 4, '#000', 8, true, true);
    this.add.text(W / 2, 148, 'Una historia de pérdida, memoria y fuego', {
      fontFamily: FONT_UI, fontSize: '18px', color: COLORS.dim, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);

    panel(this, W / 2, 290, 380, 200);
    const options = [{ label: 'Nueva partida', onSelect: () => this.startGame(false) }];
    if (GameState.hasSavedRun()) options.unshift({ label: 'Continuar', onSelect: () => this.startGame(true) });
    options.push({ label: 'Controles', onSelect: () => this.toggleHelp() });
    menuList(this, W / 2, 290 - ((options.length - 1) * 52) / 2, options);

    const { highScore } = SaveManager.load();
    this.add.text(W / 2, H - 92, `Mejor puntuación: ${highScore}`, {
      fontFamily: FONT_UI, fontSize: '18px', color: COLORS.accent, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.add.text(W / 2, H - 56, '↑/↓ elegir · Enter confirmar · M silenciar', {
      fontFamily: FONT_UI, fontSize: '16px', color: COLORS.ink, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);

    muteButton(this, W - 12, 12);
    this.helpPanel = null;
  }

  toggleHelp() {
    if (this.helpPanel) {
      this.helpPanel.destroy(true);
      this.helpPanel = null;
      return;
    }
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const c = this.add.container(0, 0).setDepth(500);
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive();
    const g = panel(this, W / 2, H / 2, 640, 360, 0.95);
    const text = this.add.text(W / 2, H / 2 - 10, [
      'PLATAFORMAS',
      'Mover: A / D o ← / →     Saltar: Espacio',
      'Atacar: J o clic izquierdo',
      '',
      'COMBATE FINAL',
      'Volar: W A S D     Disparar: J (una vez por pulsación)',
      '',
      'Pausa: Esc o P     Silenciar: M',
      'Móvil: botones táctiles en pantalla',
    ].join('\n'), {
      fontFamily: FONT_UI, fontSize: '20px', color: COLORS.ink, align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);
    const close = this.add.text(W / 2, H / 2 + 150, 'Cerrar', {
      fontFamily: FONT_UI, fontSize: '22px', color: COLORS.accent,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.toggleHelp());
    bg.on('pointerup', () => this.toggleHelp());
    c.add([bg, g, text, close]);
    this.helpPanel = c;
  }

  startGame(resume) {
    const step = resume ? GameState.loadGame() : GameState.newGame();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.game.events.emit('story:goto', step));
  }

  update(_t, delta) {
    this.layers.forEach((l, i) => { l.tilePositionX += (i + 1) * 0.004 * delta; });
  }
}
