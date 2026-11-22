import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT, VN_SCENES } from '../config/constants.js';
import { GameState } from '../managers/GameState.js';
import { AudioManager } from '../managers/AudioManager.js';
import { FONT_TITLE, FONT_UI, COLORS, muteButton, panel, oncePerKeyEvent } from '../ui/UiKit.js';
import { drawBackdrop } from '../ui/Backdrop.js';

/**
 * ESCENA VN PROVISIONAL (placeholder de integración).
 *
 * La Visual Novel completa es responsabilidad de Frank. Esta escena solo existe para
 * que el flujo del juego sea jugable de principio a fin mientras tanto. NO contiene
 * diálogos: muestra el título del tramo narrativo y la descripción del Documento
 * Maestro / Instrucciones de Sebas, sin inventar contenido.
 *
 * Contrato que la escena de Frank debe respetar (misma clave SCENES.VN):
 *   init({ sceneId, isEnding })  -> sceneId es uno de VN_SCENES
 *   al terminar:  const next = GameState.advanceStory();
 *                 this.game.events.emit('story:goto', next);
 *   en finales (isEnding): volver al menú con this.scene.start(SCENES.MENU)
 *   No modificar GameState.enemiesKilled.
 */
const CARDS = {
  [VN_SCENES.INTRO]: {
    title: 'Introducción',
    text: 'Aidan conversa con el líder del Pacto de Hiareth: la misión, los portales y la piedra Lia Fáil.',
    bg: 'boss',
  },
  [VN_SCENES.AFTER_ACT1]: {
    title: 'Acto 1 — Tierra, mar y cielo',
    text: 'Aidan conoce a Aine.',
    bg: 'act1',
  },
  [VN_SCENES.AFTER_ACT2]: {
    title: 'Acto 2 — Vuela alto',
    text: 'En el portal, Aine alcanza a Aidan.',
    bg: 'act2',
  },
  [VN_SCENES.AFTER_ACT3]: {
    title: 'Acto 3 — Limbo',
    text: 'En la casa abandonada: pérdidas, familias y esperanza.',
    bg: 'act3',
  },
  [VN_SCENES.AFTER_ACT4]: {
    title: 'Acto 4 — Don\'t Try… (IF)',
    text: 'En el campamento: chocolate, auroras boreales e historias de las razas.',
    bg: 'act4',
  },
  [VN_SCENES.BEFORE_BOSS]: {
    title: 'Acto final — Hiraeth',
    text: 'Aidan y Aine llegan a un páramo de cristal bajo una luna roja.',
    bg: 'boss',
  },
  [VN_SCENES.ENDING_CONVENTIONAL]: {
    title: 'Final',
    text: 'Desenlace narrativo (Visual Novel).',
    bg: 'boss',
  },
  [VN_SCENES.ENDING_IF]: {
    title: 'Final IF',
    text: 'Desenlace narrativo (Visual Novel).',
    bg: 'act4',
  },
};

export default class VNScene extends Phaser.Scene {
  constructor() {
    super(SCENES.VN);
  }

  init(data) {
    this.sceneId = data?.sceneId ?? VN_SCENES.INTRO;
    this.isEnding = Boolean(data?.isEnding);
    this.leaving = false;
  }

  create() {
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    const card = CARDS[this.sceneId] ?? { title: this.sceneId, text: '', bg: 'boss' };
    if (!this.isEnding) AudioManager.stopMusic();

    drawBackdrop(this, card.bg, 0.55); // todas las capas del escenario, nunca solo el cielo

    this.add.text(W / 2, H / 2 - 90, card.title, {
      fontFamily: FONT_TITLE, fontSize: '44px', color: COLORS.ink, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5);

    panel(this, W / 2, H - 120, W - 120, 130);
    this.add.text(W / 2, H - 135, card.text, {
      fontFamily: FONT_UI, fontSize: '22px', color: COLORS.ink, align: 'center',
      wordWrap: { width: W - 180 },
    }).setOrigin(0.5);
    this.add.text(W / 2, H - 78, '[ Escena de Visual Novel — pendiente de integración (Frank) ]', {
      fontFamily: FONT_UI, fontSize: '15px', color: COLORS.dim,
    }).setOrigin(0.5);

    if (this.isEnding) {
      this.add.text(W / 2, H / 2 - 30, `Puntuación: ${GameState.score}`, {
        fontFamily: FONT_UI, fontSize: '24px', color: COLORS.accent, stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5);
    }

    const prompt = this.add.text(W / 2, H - 28, this.isEnding ? 'Enter / toque: volver al menú' : 'Enter / toque: continuar', {
      fontFamily: FONT_UI, fontSize: '18px', color: COLORS.accent, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.35, yoyo: true, repeat: -1, duration: 700 });

    muteButton(this, W - 12, 12);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.input.keyboard.on('keydown-ENTER', oncePerKeyEvent(() => this.next()));
    this.input.keyboard.on('keydown-SPACE', oncePerKeyEvent(() => this.next()));
    this.input.on('pointerup', (p) => { if (p.y > 60) this.next(); });
  }

  next() {
    if (this.leaving) return;
    this.leaving = true;
    AudioManager.sfx(this, 'sfx_ui_select');
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this.isEnding) {
        this.scene.start(SCENES.MENU);
        return;
      }
      const next = GameState.advanceStory();
      this.game.events.emit('story:goto', next);
    });
  }
}
