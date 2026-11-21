/**
 * Texturas generadas con Phaser (sin sprites adicionales): terreno, plataformas,
 * proyectiles, corazones, pinchos, portal, etc. Se generan una sola vez al cargar.
 */

/** Paleta de terreno por acto, coherente con cada fondo. */
export const TERRAIN_PALETTES = {
  act1: { top: 0x6fb44a, topLight: 0x9ad464, body: 0x6b4a2f, bodyDark: 0x4a321f, speck: 0x8a6440 },
  act2: { top: 0x7d8691, topLight: 0xa6afb9, body: 0x4b4f58, bodyDark: 0x33363d, speck: 0x5e6470 },
  act3: { top: 0x6a4f8a, topLight: 0x9273b8, body: 0x372a4a, bodyDark: 0x241b31, speck: 0x4b3a63 },
  act4: { top: 0xeef6ff, topLight: 0xffffff, body: 0x5a6f8e, bodyDark: 0x3e4f69, speck: 0x8aa0c0 },
};

export const TILE = 32;

function terrainTile(scene, key, p) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(p.body).fillRect(0, 0, TILE, TILE);
  g.fillStyle(p.bodyDark).fillRect(0, TILE - 4, TILE, 4);
  g.fillStyle(p.speck);
  [[5, 14], [20, 10], [12, 22], [26, 24], [3, 27]].forEach(([x, y]) => g.fillRect(x, y, 3, 3));
  g.fillStyle(p.top).fillRect(0, 0, TILE, 8);
  g.fillStyle(p.topLight).fillRect(0, 0, TILE, 3);
  g.fillStyle(p.top);
  [2, 9, 17, 25].forEach((x) => g.fillRect(x, 8, 4, 3));
  g.generateTexture(key, TILE, TILE);
  g.destroy();

  // Variante "relleno" para filas inferiores del suelo.
  const f = scene.make.graphics({ x: 0, y: 0 }, false);
  f.fillStyle(p.body).fillRect(0, 0, TILE, TILE);
  f.fillStyle(p.speck);
  [[7, 6], [22, 15], [13, 26], [28, 4]].forEach(([x, y]) => f.fillRect(x, y, 3, 3));
  f.generateTexture(`${key}_fill`, TILE, TILE);
  f.destroy();
}

function circleTexture(scene, key, radius, core, glow) {
  const size = radius * 4;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const c = size / 2;
  g.fillStyle(glow, 0.18).fillCircle(c, c, radius * 2);
  g.fillStyle(glow, 0.35).fillCircle(c, c, radius * 1.5);
  g.fillStyle(glow, 1).fillCircle(c, c, radius);
  g.fillStyle(core, 1).fillCircle(c - radius * 0.2, c - radius * 0.2, radius * 0.55);
  g.generateTexture(key, size, size);
  g.destroy();
}

export function generateProceduralTextures(scene) {
  if (scene.textures.exists('fx_pixel')) return;

  Object.entries(TERRAIN_PALETTES).forEach(([act, p]) => terrainTile(scene, `tile_${act}`, p));

  // Píxel blanco para partículas.
  const px = scene.make.graphics({ x: 0, y: 0 }, false);
  px.fillStyle(0xffffff).fillRect(0, 0, 4, 4);
  px.generateTexture('fx_pixel', 4, 4);
  px.destroy();

  // Proyectiles.
  circleTexture(scene, 'orb_alien', 6, 0xeaffff, 0x37f0c8);   // láser alien (cian verdoso)
  circleTexture(scene, 'orb_fire', 7, 0xfff3b0, 0xff8a1f);    // fuego de Aidan
  circleTexture(scene, 'orb_red', 7, 0xffd6d6, 0xe0203a);     // jefe
  circleTexture(scene, 'orb_violet', 7, 0xf1dcff, 0x9a3cff);  // jefe

  // Corazón del HUD (lleno y vacío).
  const heart = (key, fill, stroke) => {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const shape = [
      '..XX...XX..',
      '.XXXX.XXXX.',
      'XXXXXXXXXXX',
      'XXXXXXXXXXX',
      'XXXXXXXXXXX',
      '.XXXXXXXXX.',
      '..XXXXXXX..',
      '...XXXXX...',
      '....XXX....',
      '.....X.....',
    ];
    const s = 3;
    g.fillStyle(stroke);
    shape.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === 'X') g.fillRect(x * s + 1, y * s + 1, s + 1, s + 1);
    }));
    g.fillStyle(fill);
    shape.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === 'X') g.fillRect(x * s + 1, y * s + 1, s, s);
    }));
    g.fillStyle(0xffffff, fill === 0xe8344e ? 0.7 : 0).fillRect(2 * s + 1, 1 * s + 1, s, s);
    g.generateTexture(key, 11 * s + 3, 10 * s + 3);
    g.destroy();
  };
  heart('heart_full', 0xe8344e, 0x3a0a14);
  heart('heart_empty', 0x3b2a40, 0x14091a);

  // Pinchos de hielo / estalactitas (obstáculo ambiental del Acto 4 y otros).
  const spikes = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let i = 0; i < 4; i += 1) {
    spikes.fillStyle(0xbfe6ff).fillTriangle(i * 8, 16, i * 8 + 4, 0, i * 8 + 8, 16);
    spikes.fillStyle(0xffffff).fillTriangle(i * 8 + 3, 14, i * 8 + 4, 3, i * 8 + 5, 14);
  }
  spikes.generateTexture('hazard_spikes', 32, 16);
  spikes.destroy();

  // Bloque de hielo resbaladizo/plataforma que se desmorona (Acto 4).
  const ice = scene.make.graphics({ x: 0, y: 0 }, false);
  ice.fillStyle(0x9fd3f5).fillRect(0, 0, TILE, 14);
  ice.fillStyle(0xe6f6ff).fillRect(0, 0, TILE, 4);
  ice.fillStyle(0x6fa8d0).fillRect(0, 11, TILE, 3);
  ice.generateTexture('platform_ice', TILE, 14);
  ice.destroy();

  // Portal (meta del Acto 2) y destino genérico.
  const portal = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let r = 0; r < 6; r += 1) {
    portal.lineStyle(4, [0x7a3cff, 0x9c5bff, 0xbf8cff, 0x5be0ff, 0x9c5bff, 0x3d1a7a][r], 1);
    portal.strokeEllipse(40, 64, 70 - r * 10, 120 - r * 16);
  }
  portal.fillStyle(0x1a0a33, 0.85).fillEllipse(40, 64, 16, 28);
  portal.generateTexture('goal_portal', 80, 128);
  portal.destroy();

  // Casa abandonada / refugio (meta del Acto 3).
  const house = scene.make.graphics({ x: 0, y: 0 }, false);
  house.fillStyle(0x2b2236).fillRect(10, 60, 140, 90);
  house.fillStyle(0x1b1524).fillTriangle(0, 64, 80, 0, 160, 64);
  house.fillStyle(0x3d3150).fillRect(22, 74, 116, 6);
  house.fillStyle(0x120d18).fillRect(64, 96, 32, 54);
  house.fillStyle(0xffc46b, 0.9).fillRect(26, 92, 22, 18);
  house.fillStyle(0xffc46b, 0.9).fillRect(112, 92, 22, 18);
  house.lineStyle(2, 0x120d18).strokeRect(26, 92, 22, 18).strokeRect(112, 92, 22, 18);
  house.generateTexture('goal_house', 160, 150);
  house.destroy();

  // Campamento con fogata (meta del Acto 4).
  const camp = scene.make.graphics({ x: 0, y: 0 }, false);
  camp.fillStyle(0x6b3f2a).fillTriangle(0, 90, 50, 10, 100, 90);
  camp.fillStyle(0x8a5638).fillTriangle(20, 90, 50, 30, 80, 90);
  camp.fillStyle(0x2a1810).fillTriangle(40, 90, 50, 60, 60, 90);
  camp.fillStyle(0x5a3a22).fillRect(118, 84, 34, 6);
  camp.fillStyle(0xff7a1a).fillTriangle(122, 84, 135, 52, 148, 84);
  camp.fillStyle(0xffd34a).fillTriangle(128, 84, 135, 64, 142, 84);
  camp.generateTexture('goal_camp', 160, 92);
  camp.destroy();

  // Campo de trigo / poste del Acto 1 (meta: aldea, se representa con un cartel).
  const sign = scene.make.graphics({ x: 0, y: 0 }, false);
  sign.fillStyle(0x5a3a22).fillRect(28, 20, 8, 80);
  sign.fillStyle(0x8a5a32).fillRect(0, 10, 64, 30);
  sign.fillStyle(0x5a3a22).fillRect(0, 36, 64, 4);
  sign.fillStyle(0xff9a3c).fillTriangle(44, 18, 58, 25, 44, 32);
  sign.generateTexture('goal_sign', 64, 100);
  sign.destroy();
}
