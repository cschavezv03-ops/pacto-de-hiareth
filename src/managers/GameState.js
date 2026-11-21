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

const state = {
  enemiesKilled: 0,
  storyIndex: 0,
  score: 0,
  difficulty: 'normal',
  checkpoint: null, // { levelId, index } — último punto de control activado
};

export const GameState = {
  /** Inicia una partida nueva: único punto donde enemiesKilled vuelve a 0. */
  newGame(difficulty = 'normal') {
    state.enemiesKilled = 0;
    state.storyIndex = 0;
    state.score = 0;
    state.difficulty = DIFFICULTIES[difficulty] ? difficulty : 'normal';
    state.checkpoint = null;
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

  addScore(points) {
    state.score += Math.max(0, Math.round(points));
    SaveManager.submitHighScore(state.score);
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
