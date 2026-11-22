import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { BACKGROUNDS } from '../config/assets.js';

/**
 * Dibuja el escenario completo de un acto (todas sus capas de parallax apiladas) a
 * pantalla completa. Algunas capas lejanas son solo cielo liso, así que nunca debe
 * usarse una sola capa como fondo de una pantalla.
 * @param {Phaser.Scene} scene
 * @param {'act1'|'act2'|'act3'|'act4'|'boss'} id
 * @param {number} dim opacidad del velo oscuro encima (0..1)
 */
export function drawBackdrop(scene, id, dim = 0.45) {
  const bg = BACKGROUNDS[id] ?? BACKGROUNDS.boss;
  const layers = [];
  bg.files.forEach((_f, i) => {
    const key = `bg_${id in BACKGROUNDS ? id : 'boss'}_${i + 1}`;
    if (scene.textures.exists(key)) {
      layers.push(scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT));
    }
  });
  const veil = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0a18, dim).setOrigin(0);
  return { layers, veil };
}
