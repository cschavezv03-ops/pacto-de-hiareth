import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config/constants.js';
import { FONT_TITLE } from '../ui/UiKit.js';
import { startStoryStep } from '../managers/StoryRouter.js';

const BLACK = 0x000000;
const TEXT = '#f4f1eb';

/** Intertítulo minimalista para señalar la entrada a un acto o lugar clave. */
export default class ChapterCardScene extends Phaser.Scene {
  constructor() {
    super(SCENES.CHAPTER_CARD);
  }

  init(data) {
    this.step = data?.step;
    this.chapterCard = data?.chapterCard;
    this.leaving = false;
  }

  create() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, BLACK)
      .setDepth(0);

    const chapter = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 26, this.chapterCard?.chapter ?? '', {
      fontFamily: FONT_TITLE,
      fontSize: '39px',
      color: TEXT,
      align: 'center',
      letterSpacing: 1,
    }).setOrigin(0.5);
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 31, this.chapterCard?.title ?? '', {
      fontFamily: FONT_TITLE,
      fontSize: '39px',
      color: TEXT,
      align: 'center',
      letterSpacing: 1,
      wordWrap: { width: GAME_WIDTH - 72, useAdvancedWrap: true },
    }).setOrigin(0.5);

    this.titleGroup = this.add.container(0, 0, [chapter, title]).setAlpha(0).setDepth(1);
    this.tweens.add({
      targets: this.titleGroup,
      alpha: 1,
      duration: 680,
      ease: 'Sine.Out',
      onComplete: () => this.time.delayedCall(1150, () => this.fadeTitleOut()),
    });
  }

  fadeTitleOut() {
    if (this.leaving) return;
    this.leaving = true;
    this.tweens.add({
      targets: this.titleGroup,
      alpha: 0,
      duration: 300,
      ease: 'Sine.In',
      onComplete: () => this.time.delayedCall(180, () => this.openNextScene()),
    });
  }

  openNextScene() {
    const { step } = this;
    setTimeout(() => {
      this.scene.stop(SCENES.CHAPTER_CARD);
      if (step) startStoryStep(this.game, step);
    }, 0);
  }
}
