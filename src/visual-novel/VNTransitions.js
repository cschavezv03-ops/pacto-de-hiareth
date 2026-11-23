import { SCENES } from '../config/constants.js';
import { GameState } from '../managers/GameState.js';
import { AudioManager } from '../managers/AudioManager.js';

export default class VNTransitions {
  constructor(scene) {
    this.scene = scene;
    this.leaving = false;
  }

  finish({ isEnding = false } = {}) {
    if (this.leaving) return;
    this.leaving = true;
    AudioManager.fadeOutMusic(this.scene, 380);
    AudioManager.fadeOutAmbience(this.scene, null, 380);
    this.scene.cameras.main.fadeOut(380, 0, 0, 0);
    this.scene.cameras.main.once('camerafadeoutcomplete', () => {
      if (isEnding) {
        this.scene.scene.start(SCENES.MENU);
        return;
      }
      const next = GameState.advanceStory();
      this.scene.game.events.emit('story:goto', next);
    });
  }
}
