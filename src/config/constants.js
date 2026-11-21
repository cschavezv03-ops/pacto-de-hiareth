/**
 * Constantes compartidas entre gameplay (Sebas) y Visual Novel (Frank).
 * CONTRATO DE INTEGRACIÓN: no renombrar claves sin acordarlo con el equipo.
 */

/** Resolución interna (16:9). Los fondos originales son 576x324. */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Claves de escena. Frank puede sustituir VN por su propia escena con la misma clave. */
export const SCENES = Object.freeze({
  BOOT: 'Boot',
  PRELOAD: 'Preload',
  MENU: 'Menu',
  VN: 'VisualNovel',     // escena VN (Frank). Recibe { sceneId } en init().
  LEVEL: 'Level',        // nivel de plataformas. Recibe { levelId } en init().
  BOSS: 'Boss',          // Bullet Hell contra Morrigannus.
  HUD: 'Hud',            // HUD paralelo a LEVEL/BOSS.
  PAUSE: 'Pause',
  GAME_OVER: 'GameOver',
  BOSS_DEFEAT: 'BossDefeat',
  LOADING: 'Loading',        // pantalla de carga de cada nivel / del jefe // tarjeta de derrota del jefe (progreso + reintento)
  ENDING: 'Ending',      // placeholder del desenlace (Frank lo reemplaza por VN).
});

/** Identificadores de nivel de gameplay. */
export const LEVELS = Object.freeze({
  ACT1: 'act1',
  ACT2: 'act2',
  ACT3: 'act3',
  ACT4: 'act4',
  BOSS: 'boss',
});

/** Identificadores de escenas narrativas (VN) que Frank implementa. */
export const VN_SCENES = Object.freeze({
  INTRO: 'intro',
  AFTER_ACT1: 'after_act1',   // Aidan conoce a Aine / fogata
  AFTER_ACT2: 'after_act2',   // Portal: Aine alcanza a Aidan
  AFTER_ACT3: 'after_act3',   // Casa abandonada / refugio
  AFTER_ACT4: 'after_act4',   // Campamento, chocolate, auroras (solo pacifista)
  BEFORE_BOSS: 'before_boss', // Páramo de cristal bajo la luna roja
  ENDING_CONVENTIONAL: 'ending_conventional',
  ENDING_IF: 'ending_if',
});

/** Reglas confirmadas (no modificar sin aprobación del equipo). */
export const RULES = Object.freeze({
  PLAYER_HEARTS: 3,
  INVULNERABILITY_MS: 1000,
  ENEMY_HITS: { slime: 4, alien: 6, skeleton: 8 },
});

/**
 * Niveles de dificultad (aprobados por el equipo tras las pruebas manuales).
 * Solo cambian la resistencia de los enemigos/jefe y los checkpoints: la IA y los
 * corazones de Aidan (3) son iguales en todas. 'normal' = valores del documento.
 */
export const DIFFICULTIES = Object.freeze({
  // bossSpeedMult / bossRestMult: velocidad de los orbes del jefe y respiro entre patrones.
  easy: { id: 'easy', label: 'Fácil', hitMult: 0.5, bossHealthMult: 0.65, checkpoints: true,
    bossSpeedMult: 1.0, bossRestMult: 1.05,
    desc: 'Enemigos más frágiles · con puntos de control' },
  normal: { id: 'normal', label: 'Intermedio', hitMult: 1, bossHealthMult: 1, checkpoints: true,
    bossSpeedMult: 1.25, bossRestMult: 0.85,
    desc: 'Experiencia original · con puntos de control' },
  hard: { id: 'hard', label: 'Difícil', hitMult: 1.5, bossHealthMult: 1.25, checkpoints: false,
    bossSpeedMult: 1.45, bossRestMult: 0.72,
    desc: 'Enemigos más resistentes · sin puntos de control' },
});

/** Golpes necesarios para derrotar a un enemigo según la dificultad. */
export function enemyHits(type, difficultyId) {
  const d = DIFFICULTIES[difficultyId] ?? DIFFICULTIES.normal;
  return Math.max(1, Math.round(RULES.ENEMY_HITS[type] * d.hitMult));
}

export const STORAGE_KEY = 'pactoHiareth.save.v1';
