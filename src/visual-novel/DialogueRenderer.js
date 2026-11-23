import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { AudioManager } from '../managers/AudioManager.js';
import { FONT_UI, COLORS, panel } from '../ui/UiKit.js';
import { splitStoryRuns } from './storyHighlights.js';
import { voiceForSpeaker } from './assetManifest.js';

const KEYWORD_COLOR = '#ff5865';
const PANEL_X = 24;
const PANEL_WIDTH = GAME_WIDTH - PANEL_X * 2;
const CONTENT_X = PANEL_X + 30;
const CONTENT_WIDTH = PANEL_WIDTH - 60;

/** Panel de VN con paginación breve, escritura progresiva y palabras clave rojas. */
export default class DialogueRenderer {
  constructor(scene) {
    this.scene = scene;
    this.pageIndex = 0;
    this.pages = [];
    this.revealSteps = [];
    this.revealIndex = 0;
    this.runObjects = [];
    this.timer = null;
    this.voice = null;
    this.lastVoiceAt = 0;
    this.voiceCount = 0;
    this.pageDone = false;
    this.destroyed = false;

    this.panel = panel(scene, GAME_WIDTH / 2, GAME_HEIGHT - 96, PANEL_WIDTH, 176, 1)
      .setDepth(20);
    this.nameText = scene.add.text(CONTENT_X, GAME_HEIGHT - 170, '', {
      fontFamily: FONT_UI, fontSize: '17px', color: COLORS.accent,
      fontStyle: 'bold', stroke: '#140e24', strokeThickness: 3,
    }).setDepth(22);
    this.pageText = scene.add.text(GAME_WIDTH - CONTENT_X, GAME_HEIGHT - 44, '', {
      fontFamily: FONT_UI, fontSize: '13px', color: COLORS.dim,
      align: 'right', stroke: '#140e24', strokeThickness: 2,
    }).setOrigin(1, 0.5).setDepth(22);
    this.promptText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 27, 'Enter / clic para continuar · Tab saltar escena', {
      fontFamily: FONT_UI, fontSize: '12px', color: COLORS.dim,
      align: 'center', stroke: '#140e24', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(22).setAlpha(0.8);

    this.measureText = scene.add.text(0, 0, '', {
      fontFamily: FONT_UI, fontSize: '21px', color: COLORS.ink,
      wordWrap: { width: CONTENT_WIDTH, useAdvancedWrap: false },
      lineSpacing: 2,
    }).setVisible(false).setDepth(-1);
  }

  show(command, characterPresenter) {
    this.stopTimer();
    this.clearRunObjects();
    this.pageIndex = 0;
    this.revealIndex = 0;
    this.pageDone = false;
    this.commandType = command.type;
    this.characterPresenter = characterPresenter;
    this.voice = command.type === 'dialogue' ? voiceForSpeaker(command.speaker) : null;
    this.voiceCount = 0;
    this.lastVoiceAt = 0;

    if (command.type === 'dialogue') {
      this.nameText.setText(command.speaker ?? '').setVisible(Boolean(command.speaker));
      this.nameText.setColor(String(command.speaker).toLocaleLowerCase('es') === 'morrigannus' ? KEYWORD_COLOR : COLORS.accent);
      characterPresenter?.speak(command.speaker, command.expression ?? null);
    } else {
      this.nameText.setText('').setVisible(false);
    }

    const isDialogue = command.type === 'dialogue';
    this.fontSize = isDialogue ? 21 : 19;
    this.maxLines = isDialogue ? 3 : 4;
    this.lineHeight = isDialogue ? 28 : 26;
    this.measureText.setFontSize(this.fontSize);
    this.measureText.setStyle({ wordWrap: { width: CONTENT_WIDTH, useAdvancedWrap: false } });
    this.pages = this.paginate(command.text ?? '');
    if (!this.pages.length) this.pages = [[]];
    this.renderPage();
  }

  paginate(text) {
    const wrapped = this.measureText.getWrappedText(String(text));
    const lines = (Array.isArray(wrapped) ? wrapped : String(wrapped).split('\n'))
      .map((line) => String(line));
    const pages = [];
    for (let index = 0; index < lines.length; index += this.maxLines) {
      pages.push(lines.slice(index, index + this.maxLines));
    }
    return pages;
  }

  renderPage() {
    this.clearRunObjects();
    const lines = this.pages[this.pageIndex] ?? [];
    const yStart = GAME_HEIGHT - 145;
    this.revealSteps = [];

    lines.forEach((line, lineIndex) => {
      const y = yStart + lineIndex * this.lineHeight;
      let x = CONTENT_X;
      splitStoryRuns(line).forEach((run) => {
        const style = {
          fontFamily: FONT_UI,
          fontSize: `${this.fontSize}px`,
          color: run.highlighted ? KEYWORD_COLOR : COLORS.ink,
          stroke: '#140e24',
          strokeThickness: 1,
          lineSpacing: 0,
        };
        const textObject = this.scene.add.text(x, y, '', style)
          .setOrigin(0, 0).setDepth(22);
        this.runObjects.push(textObject);
        textObject.vnTargetText = run.text;

        this.measureText.setText(run.text);
        const width = this.measureText.width;
        for (const character of run.text) {
          if (character !== '\n') {
            this.revealSteps.push({ object: textObject, character });
          }
        }
        textObject.vnFullText = '';
        x += width;
      });
    });

    this.pageText.setText(this.pages.length > 1 ? `${this.pageIndex + 1} / ${this.pages.length}` : '');
    this.revealIndex = 0;
    this.pageDone = this.revealSteps.length === 0;
    this.startTimer();
  }

  startTimer() {
    this.stopTimer();
    if (this.pageDone || this.destroyed) return;
    this.timer = this.scene.time.addEvent({
      delay: 24,
      loop: true,
      callback: () => this.revealOne(),
    });
  }

  stopTimer() {
    this.timer?.remove(false);
    this.timer = null;
  }

  revealOne() {
    const step = this.revealSteps[this.revealIndex];
    if (!step) {
      this.finishPage();
      return;
    }
    step.object.vnFullText += step.character;
    step.object.setText(step.object.vnFullText);
    this.revealIndex += 1;

    if (/\p{L}/u.test(step.character)) {
      this.voiceCount += 1;
      if (this.voice && this.voiceCount % 4 === 1) {
        const now = this.scene.time.now;
        if (now - this.lastVoiceAt >= 58) {
          AudioManager.vnSfx(this.scene, this.voice.key, {
            volume: 0.14,
            detune: Math.round((Math.random() - 0.5) * 54),
          });
          this.lastVoiceAt = now;
        }
      }
    }
    if (this.revealIndex >= this.revealSteps.length) this.finishPage();
  }

  finishPage() {
    this.stopTimer();
    this.pageDone = true;
  }

  /** Return 'revealed', 'page', or 'done'. */
  completeLine() {
    if (!this.pageDone) {
      this.runObjects.forEach((object) => { object.vnFullText = object.vnTargetText; });
      this.runObjects.forEach((object) => object.setText(object.vnFullText ?? ''));
      this.revealIndex = this.revealSteps.length;
      this.finishPage();
      return 'revealed';
    }
    if (this.pageIndex < this.pages.length - 1) {
      this.pageIndex += 1;
      this.renderPage();
      return 'page';
    }
    return 'done';
  }

  clearRunObjects() {
    this.runObjects.forEach((object) => object.destroy());
    this.runObjects = [];
    this.revealSteps = [];
  }

  destroy() {
    this.destroyed = true;
    this.stopTimer();
    this.clearRunObjects();
    this.panel?.destroy();
    this.nameText?.destroy();
    this.pageText?.destroy();
    this.promptText?.destroy();
    this.measureText?.destroy();
    this.characterPresenter = null;
  }
}
