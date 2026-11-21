/**
 * Persistencia en localStorage: High Score, nivel alcanzado, configuración de audio
 * y la partida en curso. Todos los accesos van protegidos con try/catch porque
 * localStorage puede no estar disponible (modo privado, iframes, etc.).
 */
import { STORAGE_KEY } from '../config/constants.js';

const DEFAULTS = Object.freeze({
  highScore: 0,
  maxStoryIndex: 0,
  audio: { muted: false, musicVolume: 0.6, sfxVolume: 0.8 },
  run: null,
});

let memoryCopy = null; // respaldo si localStorage falla

function read() {
  if (memoryCopy) return memoryCopy;
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    memoryCopy = { ...DEFAULTS, ...parsed, audio: { ...DEFAULTS.audio, ...(parsed.audio || {}) } };
  } catch {
    memoryCopy = structuredClone(DEFAULTS);
  }
  return memoryCopy;
}

function write(data) {
  memoryCopy = data;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* sin persistencia disponible: se mantiene en memoria */
  }
}

export const SaveManager = {
  load() {
    return read();
  },

  saveRun(run) {
    write({ ...read(), run });
  },

  submitHighScore(score) {
    const data = read();
    if (score > data.highScore) write({ ...data, highScore: score });
  },

  submitReached(storyIndex) {
    const data = read();
    if (storyIndex > data.maxStoryIndex) write({ ...data, maxStoryIndex: storyIndex });
  },

  getAudio() {
    return { ...read().audio };
  },

  setAudio(partial) {
    const data = read();
    write({ ...data, audio: { ...data.audio, ...partial } });
  },

  /** Utilidad para pruebas. */
  _reset() {
    memoryCopy = null;
    try {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      /* ignorar */
    }
  },
};
