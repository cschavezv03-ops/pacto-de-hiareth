import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { availableExpression, characterForSpeaker, portraitTexture } from './assetManifest.js';

const POSITIONS = Object.freeze({
  aidan: { x: GAME_WIDTH * 0.25, align: 'left' },
  aine: { x: GAME_WIDTH * 0.75, align: 'right' },
  leader: { x: GAME_WIDTH * 0.75, align: 'right' },
});

export default class CharacterPresenter {
  constructor(scene) {
    this.scene = scene;
    this.sprites = new Map();
  }

  show(character, expression = 'neutral', position = null) {
    if (!availableExpression(character, expression)) expression = 'neutral';
    const texture = portraitTexture(character, expression);
    if (!this.scene.textures.exists(texture)) return null;

    const current = this.sprites.get(character);
    if (current) {
      current.image.setTexture(texture);
      current.expression = expression;
      this.setPosition(character, current, position);
      return current.image;
    }

    const image = this.scene.add.image(0, GAME_HEIGHT - 118, texture)
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setAlpha(0);
    const source = this.scene.textures.get(texture).getSourceImage();
    const scale = Math.min(300 / source.width, 336 / source.height);
    image.setScale(scale);
    const entry = { image, expression, position: null };
    this.sprites.set(character, entry);
    this.setPosition(character, entry, position);
    this.scene.tweens.add({ targets: image, alpha: 1, duration: 180 });
    return image;
  }

  setPosition(character, entry, position = null) {
    const fallback = POSITIONS[character] ?? { x: GAME_WIDTH / 2, align: 'center' };
    const spec = position ? { x: position, align: 'center' } : fallback;
    entry.position = spec;
    entry.image.setX(spec.x);
  }

  setExpression(character, expression) {
    const entry = this.sprites.get(character);
    if (!entry || !availableExpression(character, expression)) return;
    const texture = portraitTexture(character, expression);
    if (!this.scene.textures.exists(texture)) return;
    entry.image.setTexture(texture);
    entry.expression = expression;
  }

  speak(speaker, expression = null) {
    const character = characterForSpeaker(speaker);
    if (!character) return;
    if (!this.sprites.has(character)) this.show(character, expression ?? 'neutral');
    else if (expression) this.setExpression(character, expression);
  }

  hide(character) {
    const entry = this.sprites.get(character);
    if (!entry) return;
    this.sprites.delete(character);
    this.scene.tweens.add({
      targets: entry.image,
      alpha: 0,
      duration: 160,
      onComplete: () => entry.image.destroy(),
    });
  }

  destroy() {
    this.sprites.forEach(({ image }) => image.destroy());
    this.sprites.clear();
  }
}
