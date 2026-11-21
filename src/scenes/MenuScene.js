import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT, DIFFICULTIES } from '../config/constants.js';
import { GameState } from '../managers/GameState.js';
import { SaveManager } from '../managers/SaveManager.js';
import { AudioManager } from '../managers/AudioManager.js';
import { FONT_TITLE, FONT_UI, COLORS, menuList, muteButton, panel, audioPanel, oncePerKeyEvent } from '../ui/UiKit.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENES.MENU);
  }

  create() {
    // La instancia de la escena se reutiliza: reiniciar el estado en cada visita.
    this.starting = false;
    this.audioOpen = false;
    this.list = null;
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

    this.menuPanel = panel(this, W / 2, 292, 420, 236);
    this.subtitle = this.add.text(W / 2, 428, '', {
      fontFamily: FONT_UI, fontSize: '16px', color: COLORS.dim, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.showMainMenu();

    const { highScore } = SaveManager.load();
    this.add.text(W / 2, H - 70, `Mejor puntuación: ${highScore}`, {
      fontFamily: FONT_UI, fontSize: '18px', color: COLORS.accent, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.add.text(W / 2, H - 38, '↑/↓ elegir · Enter confirmar · M silenciar', {
      fontFamily: FONT_UI, fontSize: '16px', color: COLORS.ink, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);

    muteButton(this, W - 16, 14, { onOpenAudio: () => this.openAudio() });
    this.helpPanel = null;
  }

  showMainMenu() {
    this.list?.destroy();
    this.subtitle.setText('');
    const options = [{ label: 'Nueva partida', onSelect: () => this.showDifficultyMenu() }];
    if (GameState.hasSavedRun()) {
      const d = GameState.difficultyOfSave?.() ?? '';
      options.unshift({ label: `Continuar${d ? ` (${d})` : ''}`, onSelect: () => this.startGame(true) });
    }
    options.push({ label: 'Opciones', onSelect: () => this.openAudio() });
    options.push({ label: 'Controles', onSelect: () => this.toggleHelp() });
    this.list = menuList(this, GAME_WIDTH / 2, 292 - ((options.length - 1) * 48) / 2, options, { spacing: 48 });
  }

  /** Selección de dificultad al empezar (solo cambia resistencia y checkpoints). */
  showDifficultyMenu() {
    this.list?.destroy();
    const diffs = Object.values(DIFFICULTIES);
    const options = diffs.map((d) => ({ label: d.label, onSelect: () => this.startGame(false, d.id) }));
    options.push({ label: 'Volver', onSelect: () => this.showMainMenu() });
    this.list = menuList(this, GAME_WIDTH / 2, 292 - ((options.length - 1) * 46) / 2, options, { spacing: 46 });
    this.subtitle.setText('Elige la dificultad');
    // Descripción de la opción enfocada.
    this.list.items.forEach((t, i) => t.on('pointerover', () => this.subtitle.setText(diffs[i]?.desc ?? 'Volver al menú')));
    const diffList = this.list;
    const onKey = () => this.time.delayedCall(0, () => {
      if (this.list !== diffList) return; // ya se volvió al menú principal
      const i = this.list.items.findIndex((t) => t.style.color === COLORS.accent);
      if (i >= 0) this.subtitle.setText(diffs[i]?.desc ?? 'Volver al menú');
    });
    this.input.keyboard.on('keydown', onKey);
    const off = () => this.input.keyboard.off('keydown', onKey);
    const origDestroy = this.list.destroy;
    this.list.destroy = () => { off(); origDestroy(); };
    this.list.items[1] && this.subtitle.setText(diffs[0].desc);
  }

  openAudio() {
    if (this.audioOpen) return;
    this.audioOpen = true;
    this.list?.setEnabled(false);
    audioPanel(this, () => { this.audioOpen = false; this.list?.setEnabled(true); });
  }

  toggleHelp() {
    if (this.helpPanel) {
      this.helpPanel.destroy(true);
      this.helpPanel = null;
      this.input.keyboard.off('keydown', this.helpKeys);
      this.list?.setEnabled(true);
      return;
    }
    // Con la ayuda abierta el menú de debajo no responde; Esc/Enter la cierran.
    this.list?.setEnabled(false);
    this.helpKeys = oncePerKeyEvent((e) => {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') this.time.delayedCall(0, () => this.helpPanel && this.toggleHelp());
    });
    this.time.delayedCall(0, () => this.input.keyboard.on('keydown', this.helpKeys));
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const c = this.add.container(0, 0).setDepth(500);
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive();
    const g = panel(this, W / 2, H / 2, 680, 420, 0.95);
    const text = this.add.text(W / 2, H / 2 - 14, [
      'PLATAFORMAS',
      'Mover: A / D o ← / →     Saltar: Espacio',
      'Agacharse: S / ↓     Atacar: J o clic (también en el aire)',
      'Fuego fantasma: K o clic derecho (se recarga)',
      '',
      'COMBATE FINAL',
      'Volar: W A S D     Disparar: J (una vez por pulsación)',
      'Media luna de fuego: K     Esquivar (dash): Shift o L',
      '',
      'Pausa: Esc o P     Silenciar: M     Móvil: botones en pantalla',
    ].join('\n'), {
      fontFamily: FONT_UI, fontSize: '19px', color: COLORS.ink, align: 'center', lineSpacing: 5,
    }).setOrigin(0.5);
    const close = this.add.text(W / 2, H / 2 + 180, 'Cerrar', {
      fontFamily: FONT_UI, fontSize: '22px', color: COLORS.accent,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.toggleHelp());
    bg.on('pointerup', () => this.toggleHelp());
    c.add([bg, g, text, close]);
    this.helpPanel = c;
  }

  startGame(resume, difficulty = 'normal') {
    if (this.starting) return;
    this.starting = true;
    const step = resume ? GameState.loadGame() : GameState.newGame(difficulty);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.game.events.emit('story:goto', step));
  }

  update(_t, delta) {
    this.layers.forEach((l, i) => { l.tilePositionX += (i + 1) * 0.004 * delta; });
  }
}
