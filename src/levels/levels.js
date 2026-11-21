/**
 * Diseño de los niveles (decisión de Sebas). Unidades en TILES de 32 px.
 *
 *  ground:    tramos de suelo [inicio, fin) — los huecos entre tramos son fosos.
 *  platforms: { x, h, w, type }  h = altura en tiles sobre el suelo (top de la plataforma)
 *             type: 'static' | 'moving' (dx/dy en tiles, ms) | 'crumble'
 *  enemies:   { type, x, zone: [min, max], h? }  h = sobre plataforma (tiles sobre suelo)
 *  hazards:   { type: 'spikes', x, w }  |  { type: 'icicle', x }  (estalactita que cae)
 *  goal:      { x, texture, label }  — al tocarlo termina el nivel
 *
 * Alcance del salto de Aidan: ~4.4 tiles de altura y ~5 tiles de distancia.
 * Ruta crítica: huecos ≤ 4 tiles, escalones ≤ 3.5 tiles.
 * Siempre hay forma de esquivar a cada enemigo (saltando por encima o por plataformas).
 */

export const LEVEL_DATA = {
  act1: {
    title: 'Acto 1 — Tierra, mar y cielo',
    bg: 'act1',
    music: 'music_act1',
    tile: 'tile_act1',
    width: 190,
    parallax: [0.05, 0.15, 0.3, 0.5],
    ground: [[0, 34], [37, 62], [66, 96], [100, 128], [131, 190]],
    platforms: [
      { x: 18, h: 3, w: 4 },
      { x: 25, h: 5, w: 3 },
      { x: 34, h: 2, w: 3 },
      { x: 46, h: 3, w: 5 },
      { x: 54, h: 6, w: 4 },
      { x: 62, h: 3, w: 4 },
      { x: 78, h: 3, w: 4 },
      { x: 84, h: 6, w: 5 },
      { x: 96, h: 3, w: 4 },
      { x: 108, h: 4, w: 6 },
      { x: 118, h: 3, w: 3 },
      { x: 127, h: 2, w: 4 },
      { x: 142, h: 3, w: 4 },
      { x: 150, h: 6, w: 6 },
      { x: 160, h: 3, w: 4 },
    ],
    enemies: [
      { type: 'slime', x: 14, zone: [9, 20] },
      { type: 'slime', x: 44, zone: [39, 55] },
      { type: 'slime', x: 56, zone: [54, 58], h: 6 },
      { type: 'slime', x: 72, zone: [67, 82] },
      { type: 'slime', x: 90, zone: [86, 95] },
      { type: 'slime', x: 110, zone: [102, 116] },
      { type: 'slime', x: 138, zone: [133, 147] },
      { type: 'slime', x: 152, zone: [150, 156], h: 6 },
      { type: 'slime', x: 168, zone: [161, 176] },
    ],
    hazards: [],
    goal: { x: 184, texture: 'goal_sign' },
  },

  act2: {
    title: 'Acto 2 — Vuela alto',
    bg: 'act2',
    music: 'music_act2',
    tile: 'tile_act2',
    width: 200,
    parallax: [0.03, 0.1, 0.2, 0.35, 0.55],
    ground: [[0, 30], [34, 58], [63, 88], [93, 118], [122, 150], [155, 200]],
    platforms: [
      { x: 20, h: 3, w: 4 },
      { x: 30, h: 2, w: 4 },
      { x: 42, h: 4, w: 5 },
      { x: 58, h: 3, w: 2, type: 'moving', dx: 3, ms: 2200 },
      { x: 70, h: 3, w: 4 },
      { x: 77, h: 6, w: 5 },
      { x: 88, h: 3, w: 2, type: 'moving', dx: 3, ms: 2000 },
      { x: 100, h: 4, w: 5 },
      { x: 108, h: 7, w: 4 },
      { x: 118, h: 2, w: 4 },
      { x: 130, h: 3, w: 4 },
      { x: 137, h: 6, w: 5 },
      { x: 150, h: 3, w: 2, type: 'moving', dx: 3, ms: 1900 },
      { x: 165, h: 3, w: 5 },
      { x: 175, h: 5, w: 4 },
    ],
    enemies: [
      { type: 'alien', x: 16, zone: [10, 24] },
      { type: 'alien', x: 46, zone: [37, 54] },
      { type: 'alien', x: 74, zone: [66, 84] },
      { type: 'alien', x: 104, zone: [96, 114] },
      { type: 'alien', x: 134, zone: [125, 146] },
      { type: 'alien', x: 166, zone: [158, 178] },
    ],
    hazards: [
      { type: 'spikes', x: 52, w: 2 },
      { type: 'spikes', x: 113, w: 2 },
      { type: 'spikes', x: 182, w: 2 },
    ],
    goal: { x: 193, texture: 'goal_portal' },
  },

  act3: {
    title: 'Acto 3 — Limbo',
    bg: 'act3',
    music: 'music_act3',
    tile: 'tile_act3',
    width: 205,
    parallax: [0.03, 0.1, 0.2, 0.35, 0.55],
    ground: [[0, 28], [32, 55], [59, 80], [85, 110], [114, 140], [145, 170], [174, 205]],
    platforms: [
      { x: 16, h: 3, w: 4 },
      { x: 28, h: 3, w: 2, type: 'moving', dx: 2, ms: 1800 },
      { x: 40, h: 3, w: 4 },
      { x: 46, h: 6, w: 5 },
      { x: 55, h: 2, w: 3 },
      { x: 66, h: 4, w: 6 },
      { x: 80, h: 3, w: 2, type: 'moving', dx: 3, ms: 2000 },
      { x: 92, h: 3, w: 4 },
      { x: 99, h: 6, w: 6 },
      { x: 110, h: 3, w: 2, type: 'moving', dx: 2, ms: 1700 },
      { x: 122, h: 4, w: 5 },
      { x: 130, h: 7, w: 4 },
      { x: 140, h: 3, w: 2, type: 'moving', dx: 3, ms: 1900 },
      { x: 152, h: 3, w: 4 },
      { x: 159, h: 6, w: 5 },
      { x: 170, h: 3, w: 2, type: 'moving', dx: 2, ms: 1700 },
      { x: 182, h: 3, w: 5 },
    ],
    enemies: [
      { type: 'skeleton', x: 12, zone: [7, 24] },
      { type: 'skeleton', x: 44, zone: [35, 52] },
      { type: 'skeleton', x: 70, zone: [61, 78] },
      { type: 'skeleton', x: 96, zone: [87, 107] },
      { type: 'skeleton', x: 126, zone: [116, 138] },
      { type: 'skeleton', x: 156, zone: [147, 168] },
      { type: 'skeleton', x: 186, zone: [176, 194] },
    ],
    hazards: [
      { type: 'spikes', x: 36, w: 2 },
      { type: 'spikes', x: 118, w: 2 },
    ],
    goal: { x: 198, texture: 'goal_house' },
  },

  // Acto 4 (solo ruta pacifista): SIN ENEMIGOS. Reto de desplazamiento y entorno.
  act4: {
    title: 'Acto 4 — Don\'t Try… (IF)',
    bg: 'act4',
    music: 'music_act4',
    tile: 'tile_act4',
    width: 175,
    parallax: [0.0, 0.12, 0.18, 0.25, 0.35, 0.45, 0.6], // capa 0 = far.png (1-4 fusionadas)
    ground: [[0, 26], [30, 48], [53, 70], [76, 96], [101, 122], [128, 148], [152, 175]],
    platforms: [
      { x: 14, h: 3, w: 4 },
      { x: 26, h: 2, w: 3, type: 'crumble' },
      { x: 38, h: 3, w: 5 },
      { x: 48, h: 3, w: 2, type: 'crumble' },
      { x: 51, h: 5, w: 2, type: 'crumble' },
      { x: 60, h: 4, w: 5 },
      { x: 70, h: 3, w: 2, type: 'moving', dx: 3, ms: 2200 },
      { x: 84, h: 3, w: 4 },
      { x: 96, h: 2, w: 2, type: 'crumble' },
      { x: 99, h: 4, w: 2, type: 'crumble' },
      { x: 110, h: 4, w: 5 },
      { x: 122, h: 3, w: 2, type: 'moving', dx: 3, ms: 2000 },
      { x: 136, h: 3, w: 4 },
      { x: 148, h: 2, w: 3, type: 'crumble' },
    ],
    enemies: [],
    hazards: [
      { type: 'spikes', x: 20, w: 2 },
      { type: 'icicle', x: 34 },
      { type: 'icicle', x: 42 },
      { type: 'spikes', x: 64, w: 3 },
      { type: 'icicle', x: 80 },
      { type: 'icicle', x: 88 },
      { type: 'spikes', x: 106, w: 2 },
      { type: 'icicle', x: 116 },
      { type: 'spikes', x: 140, w: 3 },
      { type: 'icicle', x: 158 },
      { type: 'icicle', x: 163 },
    ],
    goal: { x: 168, texture: 'goal_camp' },
  },
};
