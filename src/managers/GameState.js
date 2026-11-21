/**
 * Estado global de la partida (módulo puro, sin dependencia de Phaser).
 *
 * CONTRATO COMPARTIDO Sebas/Frank:
 *  - enemiesKilled: solo lo incrementa el gameplay con registerKill() cuando Aidan
 *    derrota DIRECTAMENTE a un enemigo. Se conserva entre escenas, niveles y Game Over.
 *    Solo newGame() lo reinicia.
 *  - La ruta NUNCA se muestra al jugador. isPacifist() se consulta internamente.
 *  - El orden de la historia se resuelve con nextStep(); VN y gameplay llaman a
 *    advanceStory() al terminar y reciben el siguiente paso.
 */
import { LEVELS, VN_SCENES, STORAGE_KEY, DIFFICULTIES } from '../config/constants.js';
import { SaveManager } from './SaveManager.js';

/** Secuencia de la historia. `pacifistOnly` se omite en la ruta convencional. */
export const STORY = Object.freeze([
  { type: 'vn', id: VN_SCENES.INTRO },
  { type: 'level', id: LEVELS.ACT1 },
  { type: 'vn', id: VN_SCENES.AFTER_ACT1 },
  { type: 'level', id: LEVELS.ACT2 },
  { type: 'vn', id: VN_SCENES.AFTER_ACT2 },
  { type: 'level', id: LEVELS.ACT3 },
  { type: 'vn', id: VN_SCENES.AFTER_ACT3 },
  { type: 'level', id: LEVELS.ACT4, pacifistOnly: true },
  { type: 'vn', id: VN_SCENES.AFTER_ACT4, pacifistOnly: true },
  { type: 'vn', id: VN_SCENES.BEFORE_BOSS },
  { type: 'boss', id: LEVELS.BOSS },
  { type: 'ending' }, // se resuelve a ENDING_CONVENTIONAL o ENDING_IF
]);

/** Cada LIFE_EVERY puntos (orbes + niveles) Aidan recupera un corazón o gana uno extra. */
export const LIFE_EVERY = 10000;

const state = {
  enemiesKilled: 0,
  storyIndex: 0,
  score: 0,
  difficulty: 'normal',
  checkpoint: null, // { levelId, index } — último punto de control activado
  nextLifeAt: LIFE_EVERY,  // puntuación a la que se concede la siguiente vida
  bonusHeart: false,       // vida ganada fuera del juego activo: se usa al iniciar el siguiente tramo
};

export const GameState = {
  /** Inicia una partida nueva: único punto donde enemiesKilled vuelve a 0. */
  newGame(difficulty = 'normal') {
    state.enemiesKilled = 0;
    state.storyIndex = 0;
    state.score = 0;
    state.difficulty = DIFFICULTIES[difficulty] ? difficulty : 'normal';
    state.checkpoint = null;
    state.nextLifeAt = LIFE_EVERY;
    state.bonusHeart = false;
    this.persist();
    return this.currentStep();
  },

  /** Continúa desde el último paso guardado (nivel alcanzado). */
  loadGame() {
    const save = SaveManager.load();
    if (!save.run) return this.newGame();
    state.enemiesKilled = save.run.enemiesKilled ?? 0;
    state.storyIndex = save.run.storyIndex ?? 0;
    state.score = save.run.score ?? 0;
    state.difficulty = DIFFICULTIES[save.run.difficulty] ? save.run.difficulty : 'normal';
    state.checkpoint = save.run.checkpoint ?? null;
    state.nextLifeAt = save.run.nextLifeAt ?? (Math.floor(state.score / LIFE_EVERY) + 1) * LIFE_EVERY;
    state.bonusHeart = Boolean(save.run.bonusHeart);
    return this.currentStep();
  },

  /** Etiqueta de la dificultad de la partida guardada (para el botón Continuar). */
  difficultyOfSave() {
    const run = SaveManager.load().run;
    return DIFFICULTIES[run?.difficulty]?.label ?? '';
  },

  hasSavedRun() {
    const run = SaveManager.load().run;
    return Boolean(run && run.storyIndex > 0 && run.storyIndex < STORY.length - 1);
  },

  /** Llamar SOLO cuando Aidan derrota directamente a un enemigo. */
  registerKill() {
    state.enemiesKilled += 1;
    this.persist();
  },

  get enemiesKilled() {
    return state.enemiesKilled;
  },

  isPacifist() {
    return state.enemiesKilled === 0;
  },

  /** Configuración de la dificultad elegida al iniciar la partida. */
  get difficulty() {
    return DIFFICULTIES[state.difficulty];
  },

  /** Índice del checkpoint guardado para un nivel (o -1). Sin checkpoints en Difícil. */
  checkpointFor(levelId) {
    if (!this.difficulty.checkpoints) return -1;
    return state.checkpoint?.levelId === levelId ? state.checkpoint.index : -1;
  },

  setCheckpoint(levelId, index) {
    if (!this.difficulty.checkpoints) return;
    state.checkpoint = { levelId, index };
    this.persist();
  },

  get score() {
    return state.score;
  },

  /**
   * Suma puntos y devuelve cuántas vidas se han ganado al cruzar umbrales de LIFE_EVERY.
   * Quien llama decide cómo aplicarlas (curar en vivo o guardarlas con grantBonusHeart).
   */
  addScore(points) {
    state.score += Math.max(0, Math.round(points));
    SaveManager.submitHighScore(state.score);
    let lives = 0;
    while (state.score >= state.nextLifeAt) {
      lives += 1;
      state.nextLifeAt += LIFE_EVERY;
    }
    return lives;
  },

  /** Progreso hacia la siguiente vida (0..1), para el HUD. */
  get lifeProgress() {
    return 1 - (state.nextLifeAt - state.score) / LIFE_EVERY;
  },

  /** Guarda una vida ganada cuando no hay nivel activo (p. ej. al completar un nivel). */
  grantBonusHeart() {
    state.bonusHeart = true;
    this.persist();
  },

  /** Consume la vida guardada al empezar un nivel o el jefe (true = empieza con 4 corazones). */
  consumeBonusHeart() {
    const had = state.bonusHeart;
    state.bonusHeart = false;
    if (had) this.persist();
    return had;
  },

  /** Paso actual de la historia con el final ya resuelto. */
  currentStep() {
    const step = STORY[state.storyIndex] ?? STORY[STORY.length - 1];
    if (step.type === 'ending') {
      return {
        type: 'ending',
        id: this.isPacifist() ? VN_SCENES.ENDING_IF : VN_SCENES.ENDING_CONVENTIONAL,
      };
    }
    return step;
  },

  /** Avanza al siguiente paso válido según la ruta y lo devuelve. */
  advanceStory() {
    let i = state.storyIndex + 1;
    while (i < STORY.length && STORY[i].pacifistOnly && !this.isPacifist()) i += 1;
    state.storyIndex = Math.min(i, STORY.length - 1);
    state.checkpoint = null; // los checkpoints son por nivel
    this.persist();
    return this.currentStep();
  },

  /** Solo para depuración / pruebas manuales. */
  debugJumpTo(stepIndex) {
    state.storyIndex = Math.max(0, Math.min(stepIndex, STORY.length - 1));
    return this.currentStep();
  },

  persist() {
    SaveManager.saveRun({ ...state });
    const step = STORY[state.storyIndex];
    if (step) SaveManager.submitReached(state.storyIndex);
  },

  _storageKey: STORAGE_KEY,
};
