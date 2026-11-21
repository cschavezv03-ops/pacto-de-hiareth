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

export const STORAGE_KEY = 'pactoHiareth.save.v1';
