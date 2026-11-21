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
    // Los navegadores bloquean el audio hasta la primera interacción: reintentar entonces.
    if (game.sound.locked) {
      game.sound.once('unlocked', () => { if (scene.sys.isActive()) this.playMusic(scene, key, { volume }); });
      return;
    }
    if (currentKey === key && currentMusic?.isPlaying) return;
    this.stopMusic();
    const vol = volume ?? SaveManager.getAudio().musicVolume;
    currentMusic = game.sound.add(key, { loop: true, volume: vol });
    currentMusic.play();
    currentKey = key;
  },

  /** Baja la música hasta silenciarla (para que se oigan las fanfarrias). */
  fadeOutMusic(scene, ms = 600) {
    const m = currentMusic;
    if (!m) return;
    currentMusic = null;
    currentKey = null;
    let done = false;
    const end = () => { if (done) return; done = true; m.stop(); m.destroy(); };
    scene.tweens.add({ targets: m, volume: 0, duration: ms, onComplete: end });
    setTimeout(end, ms + 100); // por si la escena se cierra antes de acabar el tween
  },

  stopMusic() {
    if (currentMusic) {
      currentMusic.stop();
      currentMusic.destroy();
    }
    currentMusic = null;
    currentKey = null;
  },

  get musicVolume() {
    return SaveManager.getAudio().musicVolume;
  },

  get sfxVolume() {
    return SaveManager.getAudio().sfxVolume;
  },

  /** Volumen de música 0..1; se aplica en vivo a la pista actual y se guarda. */
  setMusicVolume(v) {
    const vol = Math.round(Math.min(1, Math.max(0, v)) * 10) / 10;
    SaveManager.setAudio({ musicVolume: vol });
    if (currentMusic) currentMusic.setVolume(vol);
    listeners.forEach((fn) => fn(this.muted));
    return vol;
  },

  /** Volumen de efectos 0..1 (se guarda). */
  setSfxVolume(v) {
    const vol = Math.round(Math.min(1, Math.max(0, v)) * 10) / 10;
    SaveManager.setAudio({ sfxVolume: vol });
    listeners.forEach((fn) => fn(this.muted));
    return vol;
  },

  sfx(scene, key, config = {}) {
    if (!game || !scene.cache.audio.exists(key)) return;
    const vol = (config.volume ?? 1) * SaveManager.getAudio().sfxVolume;
    game.sound.play(key, { ...config, volume: vol });
  },
};
