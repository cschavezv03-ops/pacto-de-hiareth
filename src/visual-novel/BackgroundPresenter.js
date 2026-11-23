import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { drawBackdrop } from '../ui/Backdrop.js';
import { VN_BACKGROUNDS } from './assetManifest.js';

export default class BackgroundPresenter {
  constructor(scene) {
    this.scene = scene;
    this.current = null;
  }

  set(key, { sunrise = false } = {}) {
    const scene = this.scene;
    const next = scene.add.container(0, 0).setDepth(0).setAlpha(0);
    if (key.startsWith('gameplay:')) {
      const id = key.slice('gameplay:'.length);
      const { layers, veil } = drawBackdrop(scene, id, 0.18);
      next.add([...layers, veil]);
    } else {
      const path = VN_BACKGROUNDS[key];
      if (!path || !scene.textures.exists(`vn_bg_${key}`)) {
        next.destroy(true);
        console.warn(`[VN] Falta el fondo narrativo: ${key}`);
        return Promise.resolve();
      }
      const image = scene.add.image(0, 0, `vn_bg_${key}`).setOrigin(0);
      if (key === 'pactHall') {
        // Mantiene la proporción del arte aportado y recorta el sobrante al centro.
        const coverScale = Math.max(GAME_WIDTH / image.width, GAME_HEIGHT / image.height);
        image.setOrigin(0.5).setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2).setScale(coverScale);
      } else {
        image.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      }
      next.add(image);
      if (sunrise) {
        const warmth = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffa45e, 0.19).setOrigin(0);
        const horizonGlow = scene.add.ellipse(GAME_WIDTH * 0.55, GAME_HEIGHT * 0.63, 750, 330, 0xffc278, 0.2);
        next.add([warmth, horizonGlow]);
      }
    }

    const previous = this.current;
    this.current = next;
    return new Promise((resolve) => {
      scene.tweens.add({
        targets: next,
        alpha: 1,
        duration: previous ? 300 : 140,
        onComplete: () => {
          previous?.destroy(true);
          resolve();
        },
      });
      if (previous) scene.tweens.add({ targets: previous, alpha: 0, duration: 300 });
    });
  }

  destroy() {
    this.current?.destroy(true);
    this.current = null;
  }
}
