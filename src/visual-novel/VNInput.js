import { GAME_WIDTH } from '../config/constants.js';
import { oncePerKeyEvent } from '../ui/UiKit.js';

export default class VNInput {
  constructor(scene, advance) {
    this.scene = scene;
    this.advance = advance;
    this.keyHandler = oncePerKeyEvent((event) => {
      if (event?.repeat) return;
      if (event?.code === 'Enter' || event?.code === 'Space') this.advance?.();
    });
    this.pointerHandler = (pointer) => {
      if (scene.isUiPointer ? scene.isUiPointer(pointer) : (pointer.y < 60 && pointer.x > GAME_WIDTH - 76)) return;
      this.advance?.();
    };
    scene.input.keyboard.on('keydown', this.keyHandler);
    scene.input.on('pointerup', this.pointerHandler);
    scene.events.once('shutdown', () => this.destroy());
  }

  destroy() {
    this.scene?.input?.keyboard?.off('keydown', this.keyHandler);
    this.scene?.input?.off('pointerup', this.pointerHandler);
    this.advance = null;
    this.scene = null;
  }
}
