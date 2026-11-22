/**
 * Diseño de los niveles (decisión de Sebas). Unidades en TILES de 32 px.
 *
 *  ground:    tramos de suelo [inicio, fin) — los huecos entre tramos son fosos.
 *  platforms: { x, h, w, type }  h = altura en tiles sobre el suelo (top de la plataforma)
 *             type: 'static' | 'moving' (dx/dy en tiles, ms) | 'crumble'
 *  enemies:   { type, x, zone: [min, max], h?, ambush? }  h = sobre plataforma (tiles sobre suelo)
 *             ambush: esqueleto que espera como montón de huesos y se levanta al acercarse Aidan
 *  hazards:   { type: 'spikes', x, w }  |  { type: 'icicle', x }  (estalactita que cae)
 *  goal:      { x, texture, label }  — al tocarlo termina el nivel
 *  orbs:      [{ x, h, n }] — grupos de orbes flotantes (recompensan explorar; también sin matar)
 *  ufos:      [{ x, zone: [min, max] }] — platillos abductores (peligro, no enemigo)
 *  moverTrap: 'fragile' | 'phantom' | 'cycle' — trampa de las plataformas móviles del nivel
 *             (cycle: se rompen y reaparecen por ciclos, sin necesidad de pisarlas)
 *  moving:    dx/dy en tiles, ms = periodo, phase 0..1 opcional; cycleOffset (ms) opcional
 *  checkpoints: [x, ...] — puntos de control sobre suelo firme, fuera de zonas de patrulla
 *             (no se usan en dificultad Difícil)
 *
 * Alcance del salto de Aidan: ~4.4 tiles de altura y ~5 tiles de distancia.
 * Ruta crítica: huecos ≤ 4 tiles, escalones ≤ 3.5 tiles.
 * Siempre hay forma de esquivar a cada enemigo (saltando por encima o por plataformas).
 */

/** Ciclo de las plataformas que se rompen solas (moverTrap 'cycle', Acto 2). */
export const MOVER_CYCLE = Object.freeze({
  solidMs: 3600,   // firme
  warnMs: 1000,    // tiembla y se agrieta: hora de saltar
  brokenMs: 1500,  // rota (sin colisión)
  stagger: 2000,   // desfase entre plataformas consecutivas (la siguiente rompe más tarde)
});

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
      { x: 46, h: 3, w: 5 },
      { x: 54, h: 6, w: 4 },
      { x: 78, h: 3, w: 4 },
      { x: 84, h: 6, w: 5 },
      { x: 108, h: 4, w: 6 },
      { x: 118, h: 3, w: 3 },
      { x: 142, h: 3, w: 4 },
      { x: 150, h: 6, w: 6 },
      { x: 160, h: 3, w: 4 },
    ],
    enemies: [
      { type: 'slime', x: 14, zone: [9, 20] },
      { type: 'slime', x: 29, zone: [25, 33] },
      { type: 'slime', x: 44, zone: [39, 55] },
      { type: 'slime', x: 56, zone: [54, 58], h: 6 },
      { type: 'slime', x: 72, zone: [67, 82] },
      { type: 'slime', x: 90, zone: [86, 95] },
      { type: 'slime', x: 110, zone: [102, 116] },
      { type: 'slime', x: 138, zone: [133, 147] },
      { type: 'slime', x: 152, zone: [150, 156], h: 6 },
      { type: 'slime', x: 168, zone: [161, 172] },
      { type: 'slime', x: 179, zone: [176, 182] }, // guardián antes de la meta
    ],
    hazards: [],
    goal: { x: 184, texture: 'goal_sign' },
    checkpoints: [60, 124],
    orbs: [{ x: 26, h: 6.5 }, { x: 56, h: 7.5 }, { x: 86, h: 7.5 }, { x: 110, h: 5.5 }, { x: 153, h: 7.5 }],
  },

  // Acto 2 — Vuela alto: ciudad en ruinas SIN SUELO. Solo hay cuatro islotes firmes
  // (inicio, dos checkpoints y meta); entre ellos todo son plataformas móviles que se
  // rompen por ciclos (moverTrap 'cycle', ver LevelScene.MOVER_CYCLE). Cada plataforma
  // va desfasada respecto a la anterior: cuando la tuya tiembla, la siguiente está firme.
  // Ritmo: H = horizontal (dx), V = vertical (dy < 0 sube). Las H seguidas comparten
  // periodo para que el hueco entre ellas sea constante (≈3 tiles).
  act2: {
    title: 'Acto 2 — Vuela alto',
    bg: 'act2',
    music: 'music_act2',
    tile: 'tile_act2',
    width: 158,
    parallax: [0.03, 0.1, 0.2, 0.35, 0.55],
    ground: [[0, 7], [46, 52], [96, 102], [146, 158]],
    moverTrap: 'cycle',
    platforms: [
      // Tramo 1: introducción (gaps cortos, alturas suaves)
      { x: 9, h: 2, w: 3, type: 'moving', dx: 3, ms: 3600 },
      { x: 15, h: 3, w: 3, type: 'moving', dx: 3, ms: 3600 },
      { x: 21, h: 4, w: 3, type: 'moving', dy: -2, ms: 3000 },
      { x: 27, h: 3, w: 3, type: 'moving', dx: 3, ms: 3400 },
      { x: 33, h: 2, w: 3, type: 'moving', dx: 3, ms: 3400 },
      { x: 41, h: 2, w: 3, type: 'moving', dy: -2, ms: 3000 },
      // Tramo 2: más verticales y alturas mayores
      { x: 54, h: 2, w: 3, type: 'moving', dx: 3, ms: 3400 },
      { x: 60, h: 4, w: 3, type: 'moving', dx: 3, ms: 3400 },
      { x: 66, h: 5, w: 3, type: 'moving', dy: -2, ms: 2800 },
      { x: 72, h: 3, w: 3, type: 'moving', dx: 3, ms: 3000 },
      { x: 78, h: 4, w: 3, type: 'moving', dx: 3, ms: 3000 },
      { x: 85, h: 3, w: 3, type: 'moving', dy: -2, ms: 3200 },
      { x: 91, h: 2, w: 3, type: 'moving', dx: 2, ms: 3000 },
      // Tramo 3: plataformas más estrechas y ritmo más rápido
      { x: 104, h: 2, w: 3, type: 'moving', dx: 3, ms: 3200 },
      { x: 110, h: 3, w: 3, type: 'moving', dx: 3, ms: 3200 },
      { x: 116, h: 5, w: 3, type: 'moving', dy: -2, ms: 2600 },
      { x: 122, h: 3, w: 2, type: 'moving', dx: 3, ms: 3000 },
      { x: 127, h: 4, w: 3, type: 'moving', dx: 3, ms: 3000 },
      { x: 133, h: 2, w: 3, type: 'moving', dx: 3, ms: 3000 },
      { x: 140, h: 2, w: 3, type: 'moving', dy: -2, ms: 2800 },
    ],
    // Los aliens flotan alto, disparando hacia las plataformas; se pueden esquivar.
    enemies: [
      { type: 'alien', x: 24, zone: [18, 30], h: 8 },
      { type: 'alien', x: 38, zone: [33, 43], h: 8 },
      { type: 'alien', x: 64, zone: [57, 70], h: 9 },
      { type: 'alien', x: 84, zone: [78, 92], h: 8 },
      { type: 'alien', x: 114, zone: [107, 120], h: 9 },
      { type: 'alien', x: 136, zone: [130, 143], h: 8 },
    ],
    hazards: [],
    goal: { x: 153, texture: 'goal_portal' },
    checkpoints: [48, 98],
    // Platillos abductores: uno por tramo; si te abducen pierdes 1 corazón y vuelves
    // a la última plataforma pisada (no se suma la caída al vacío).
    ufos: [{ x: 30, zone: [20, 40] }, { x: 76, zone: [64, 88] }, { x: 126, zone: [114, 138] }],
    orbs: [{ x: 16, h: 5.5 }, { x: 42, h: 6 }, { x: 67, h: 9 }, { x: 92, h: 5 }, { x: 117, h: 8.5 }, { x: 141, h: 6 }],
  },

  act3: {
    title: 'Acto 3 — Limbo',
    bg: 'act3',
    music: 'music_act3',
    tile: 'tile_act3',
    width: 205,
    parallax: [0.03, 0.1, 0.2, 0.35, 0.55],
    // Fosos de 4 tiles: las plataformas móviles del Limbo son trampas sin colisión.
    ground: [[0, 28], [32, 55], [59, 80], [84, 110], [114, 140], [144, 170], [174, 205]],
    platforms: [
      { x: 16, h: 3, w: 4 },
      { x: 28, h: 3, w: 2, type: 'moving', dx: 2, ms: 3100 },
      { x: 40, h: 3, w: 4 },
      { x: 46, h: 6, w: 5 },
      { x: 66, h: 4, w: 6 },
      { x: 80, h: 3, w: 2, type: 'moving', dx: 3, ms: 3500 },
      { x: 92, h: 3, w: 4 },
      { x: 99, h: 6, w: 6 },
      { x: 110, h: 3, w: 2, type: 'moving', dx: 2, ms: 2900 },
      { x: 122, h: 4, w: 5 },
      { x: 130, h: 7, w: 4 },
      { x: 140, h: 3, w: 2, type: 'moving', dx: 3, ms: 3300 },
      { x: 152, h: 3, w: 4 },
      { x: 159, h: 6, w: 5 },
      { x: 170, h: 3, w: 2, type: 'moving', dx: 2, ms: 2900 },
      { x: 182, h: 3, w: 5 },
    ],
    enemies: [
      { type: 'skeleton', x: 11, zone: [7, 15] },
      { type: 'skeleton', x: 21, zone: [20, 22], ambush: true }, // 6 tiles libres tras él antes del foso
      { type: 'skeleton', x: 44, zone: [35, 52] },
      { type: 'skeleton', x: 48, zone: [46, 51], h: 6 }, // la ruta alta también está vigilada
      { type: 'skeleton', x: 70, zone: [64, 78] },
      { type: 'skeleton', x: 96, zone: [87, 104] },
      { type: 'skeleton', x: 101, zone: [99, 105], h: 6 },
      { type: 'skeleton', x: 121, zone: [116, 126] },
      { type: 'skeleton', x: 132, zone: [131, 133], ambush: true },
      { type: 'skeleton', x: 131, zone: [130, 134], h: 7 },
      { type: 'skeleton', x: 156, zone: [147, 163] },
      { type: 'skeleton', x: 186, zone: [176, 193] },
      { type: 'skeleton', x: 196, zone: [195.5, 196.5], ambush: true }, // guardián de la casa
    ],
    hazards: [
      { type: 'spikes', x: 36, w: 2 },
      { type: 'spikes', x: 118, w: 2 },
    ],
    goal: { x: 198, texture: 'goal_house' },
    checkpoints: [60, 107, 167],
    moverTrap: 'phantom', // Limbo: las plataformas móviles se desvanecen al pisarlas
    orbs: [{ x: 48, h: 7.5 }, { x: 69, h: 5.5 }, { x: 102, h: 7.5 }, { x: 132, h: 8.5 }, { x: 161, h: 7.5 }],
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
      { x: 70, h: 3, w: 2, type: 'moving', dx: 3, ms: 3800 },
      { x: 84, h: 3, w: 4 },
      { x: 96, h: 2, w: 2, type: 'crumble' },
      { x: 99, h: 4, w: 2, type: 'crumble' },
      { x: 110, h: 4, w: 5 },
      { x: 122, h: 3, w: 2, type: 'moving', dx: 3, ms: 3500 },
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
    checkpoints: [57, 131],
    orbs: [{ x: 40, h: 4.5 }, { x: 62, h: 5.5 }, { x: 86, h: 4.5 }, { x: 112, h: 5.5 }, { x: 138, h: 4.5 }],
  },
};
