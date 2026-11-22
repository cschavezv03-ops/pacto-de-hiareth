import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { LEVEL_DATA } from '../levels/levels.js';
import { GameState } from '../managers/GameState.js';
import { AudioManager } from '../managers/AudioManager.js';
import { drawBackdrop } from '../ui/Backdrop.js';
import { FONT_TITLE, FONT_UI, COLORS, panel } from '../ui/UiKit.js';

/** Consejo por nivel (se muestra en su pantalla de carga). */
const TIPS = {
  act1: 'Los slimes de lava avisan antes de saltar y dejan fuego al caer: no te quedes encima.',
  act2: 'No hay suelo: las plataformas tiemblan antes de romperse. Salta a la siguiente y sal del haz de los platillos.',
  act3: 'Agáchate (S / ↓) ante el tajo alto y salta el barrido bajo. No te fíes de todas las plataformas.',
  act4: 'Un lugar tranquilo… pero el hielo no perdona.',
  boss: 'El dash (Shift / L) te vuelve intocable un instante. La media luna (K) borra orbes.',
};

/**
 * Pantalla de carga de un nivel o del jefe. La genera el router SOLO para el paso que
 * realmente viene después, así que la del Acto 4 únicamente aparece en la ruta pacifista.
 * init({ step }) con step = { type: 'level', id } | { type: 'boss' }.
 */
export default class LoadingScene extends Phaser.Scene {
  constructor() {
    super(SCENES.LOADING);
  }

  init(data) {
    this.step = data?.step ?? { type: 'level', id: 'act1' };
    this.leaving = false; // la instancia de la escena se reutiliza
  }

  create() {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const isBoss = this.step.type === 'boss';
    const id = isBoss ? 'boss' : this.step.id;
    const title = isBoss ? 'Acto final — Hiraeth' : (LEVEL_DATA[id]?.title ?? '');
    AudioManager.fadeOutMusic(this, 400);

    drawBackdrop(this, id, 0.5);
    this.add.text(W / 2, H / 2 - 70, title, {
      fontFamily: FONT_TITLE, fontSize: '44px', color: COLORS.ink, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 - 24, GameState.isDev ? `${GameState.difficulty.label} · Modo desarrollador` : GameState.difficulty.label, {
      fontFamily: FONT_UI, fontSize: '16px', color: '#ffd9a8', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);

    panel(this, W / 2, H - 112, W - 160, 70, 0.85);
    this.add.text(W / 2, H - 112, TIPS[id] ?? '', {
      fontFamily: FONT_UI, fontSize: '18px', color: COLORS.ink, align: 'center', wordWrap: { width: W - 200 },
    }).setOrigin(0.5);

    // Barra de "carga" breve (los assets ya están en caché: es una transición).
    const barW = 360;
    this.add.rectangle(W / 2, H - 46, barW + 6, 12, 0x140e24).setStrokeStyle(2, 0xff9a3c);
    const bar = this.add.rectangle(W / 2 - barW / 2, H - 46, 0, 6, 0xff9a3c).setOrigin(0, 0.5);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.tweens.add({
      targets: bar, width: barW, duration: 1300, ease: 'Sine.InOut',
      onComplete: () => this.go(),
    });
    this.input.keyboard.once('keydown-ENTER', () => this.go());
  }

  go() {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this.step.type === 'boss') this.scene.start(SCENES.BOSS, {});
      else this.scene.start(SCENES.LEVEL, { levelId: this.step.id });
    });
  }
}
