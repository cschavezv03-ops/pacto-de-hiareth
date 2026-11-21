/**
 * Audio global (música + SFX + mute). Un único punto de control para que la VN
 * y el gameplay no dupliquen interfaces de audio.
 *
 * Uso: AudioManager.init(game) una vez (PreloadScene); luego
 *   AudioManager.playMusic(scene, 'music_level1');
 *   AudioManager.sfx(scene, 'sfx_jump');
 *   AudioManager.toggleMute();
 */
import { SaveManager } from './SaveManager.js';

let game = null;
let currentMusic = null;
let currentKey = null;
const listeners = new Set();

export const AudioManager = {
  init(phaserGame) {
    game = phaserGame;
    const { muted } = SaveManager.getAudio();
    game.sound.mute = muted;
    // Evita que el audio siga sonando con la pestaña oculta.
    game.sound.pauseOnBlur = true;
  },

  get muted() {
    return game ? game.sound.mute : SaveManager.getAudio().muted;
  },

  setMuted(value) {
    if (game) game.sound.mute = value;
    SaveManager.setAudio({ muted: value });
    listeners.forEach((fn) => fn(value));
  },

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  },

  /** Suscripción para iconos de mute (devuelve función para desuscribir). */
  onMuteChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Reproduce música en bucle; si ya suena la misma pista no la reinicia. */
  playMusic(scene, key, { volume } = {}) {
    if (!game || !scene.cache.audio.exists(key)) return;
    if (currentKey === key && currentMusic?.isPlaying) return;
    this.stopMusic();
    const vol = volume ?? SaveManager.getAudio().musicVolume;
    currentMusic = game.sound.add(key, { loop: true, volume: vol });
    currentMusic.play();
    currentKey = key;
  },

  stopMusic() {
    if (currentMusic) {
      currentMusic.stop();
      currentMusic.destroy();
    }
    currentMusic = null;
    currentKey = null;
  },

  sfx(scene, key, config = {}) {
    if (!game || !scene.cache.audio.exists(key)) return;
    const vol = (config.volume ?? 1) * SaveManager.getAudio().sfxVolume;
    game.sound.play(key, { ...config, volume: vol });
  },
};
