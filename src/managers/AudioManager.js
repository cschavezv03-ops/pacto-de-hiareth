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
let currentMusicGain = 1;
let currentMusicFollowsSlider = true;
const fadingMusic = new Set();
const ambientSounds = new Map();
const pendingAmbience = new Map();
const vnOneShots = new Set();
const listeners = new Set();
let vnSkipMode = false;

function destroySound(sound) {
  if (!sound) return;
  fadingMusic.delete(sound);
  sound.stop();
  sound.destroy();
}

function fadeSound(scene, sound, duration) {
  if (!sound) return;
  if (!duration || !scene?.tweens) {
    destroySound(sound);
    return;
  }
  fadingMusic.add(sound);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    destroySound(sound);
  };
  scene.tweens.add({ targets: sound, volume: 0, duration, onComplete: finish });
  setTimeout(finish, duration + 120); // Fallback if the scene ends during the fade.
}

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

  /** Reproduce o cambia música; permite ganancia narrativa y fundido entre pistas. */
  playMusic(scene, key, { volume, gain = 1, loop = true, fadeMs = 0 } = {}) {
    if (!game || !scene.cache.audio.exists(key)) return;
    // Los navegadores bloquean el audio hasta la primera interacción: reintentar entonces.
    if (game.sound.locked) {
      game.sound.once('unlocked', () => {
        if (scene.sys.isActive()) this.playMusic(scene, key, { volume, gain, loop, fadeMs });
      });
      return;
    }
    if (currentKey === key && currentMusic?.isPlaying) return;

    const previous = currentMusic;
    currentMusic = null;
    currentKey = null;
    if (previous) fadeSound(scene, previous, fadeMs);

    const targetVolume = volume ?? SaveManager.getAudio().musicVolume * gain;
    const next = game.sound.add(key, { loop, volume: fadeMs ? 0 : targetVolume });
    next.once('complete', () => {
      if (currentMusic === next) {
        currentMusic = null;
        currentKey = null;
        currentMusicGain = 1;
        currentMusicFollowsSlider = true;
      }
      next.destroy();
    });
    next.play();
    currentMusic = next;
    currentKey = key;
    currentMusicGain = volume === undefined ? gain : 1;
    currentMusicFollowsSlider = volume === undefined;
    if (fadeMs) scene.tweens.add({ targets: next, volume: targetVolume, duration: fadeMs });
  },

  /** Baja la música hasta silenciarla (para que se oigan las fanfarrias). */
  fadeOutMusic(scene, ms = 600) {
    const m = currentMusic;
    if (!m) return;
    currentMusic = null;
    currentKey = null;
    currentMusicGain = 1;
    currentMusicFollowsSlider = true;
    fadeSound(scene, m, ms);
  },

  /** Reproduce una capa de ambiente en bucle, independiente de música y efectos puntuales. */
  playAmbience(scene, key, { volume, gain = 0.24, loop = true, fadeMs = 700 } = {}) {
    if (!game || !scene.cache.audio.exists(key)) return;
    if (game.sound.locked) {
      const token = Symbol(key);
      pendingAmbience.set(key, token);
      game.sound.once('unlocked', () => {
        if (pendingAmbience.get(key) !== token) return;
        pendingAmbience.delete(key);
        if (scene.sys.isActive()) this.playAmbience(scene, key, { volume, gain, loop, fadeMs });
      });
      return;
    }
    pendingAmbience.delete(key);

    const targetVolume = volume ?? SaveManager.getAudio().sfxVolume * gain;
    const existing = ambientSounds.get(key);
    if (existing?.sound.isPlaying) {
      existing.gain = gain;
      existing.followsSlider = volume === undefined;
      if (fadeMs) scene.tweens.add({ targets: existing.sound, volume: targetVolume, duration: fadeMs });
      else existing.sound.setVolume(targetVolume);
      return existing.sound;
    }

    const sound = game.sound.add(key, { loop, volume: fadeMs ? 0 : targetVolume });
    sound.once('complete', () => {
      if (ambientSounds.get(key)?.sound === sound) ambientSounds.delete(key);
      sound.destroy();
    });
    sound.play();
    ambientSounds.set(key, { sound, gain, followsSlider: volume === undefined });
    if (fadeMs) scene.tweens.add({ targets: sound, volume: targetVolume, duration: fadeMs });
    return sound;
  },

  /** Detiene un ambiente o todos los ambientes activos con un fundido corto. */
  fadeOutAmbience(scene, key = null, ms = 650) {
    if (key) pendingAmbience.delete(key);
    else pendingAmbience.clear();
    const targets = key
      ? [[key, ambientSounds.get(key)]]
      : [...ambientSounds.entries()];
    targets.forEach(([ambientKey, entry]) => {
      if (!entry) return;
      ambientSounds.delete(ambientKey);
      fadeSound(scene, entry.sound, ms);
    });
  },

  stopAmbience() {
    pendingAmbience.clear();
    [...ambientSounds.values()].forEach(({ sound }) => destroySound(sound));
    ambientSounds.clear();
  },

  /** Los sonidos puntuales de la VN se cortan al avanzar rápidamente el diálogo. */
  vnSfx(scene, key, config = {}) {
    if (!game || vnSkipMode || !scene.cache.audio.exists(key)) return null;
    const volume = (config.volume ?? 1) * SaveManager.getAudio().sfxVolume;
    const sound = game.sound.add(key, { ...config, volume, loop: false });
    vnOneShots.add(sound);
    sound.once('complete', () => {
      vnOneShots.delete(sound);
      sound.destroy();
    });
    sound.play();
    return sound;
  },

  setVNSkipMode(value) {
    vnSkipMode = Boolean(value);
    if (vnSkipMode) {
      [...vnOneShots].forEach((sound) => {
        vnOneShots.delete(sound);
        destroySound(sound);
      });
    }
  },

  stopVNSfx() {
    [...vnOneShots].forEach((sound) => {
      vnOneShots.delete(sound);
      destroySound(sound);
    });
  },

  stopMusic() {
    if (currentMusic) destroySound(currentMusic);
    [...fadingMusic].forEach(destroySound);
    currentMusic = null;
    currentKey = null;
    currentMusicGain = 1;
    currentMusicFollowsSlider = true;
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
    if (currentMusic) currentMusic.setVolume(currentMusicFollowsSlider ? vol * currentMusicGain : vol);
    listeners.forEach((fn) => fn(this.muted));
    return vol;
  },

  /** Volumen de efectos 0..1 (se guarda). */
  setSfxVolume(v) {
    const vol = Math.round(Math.min(1, Math.max(0, v)) * 10) / 10;
    SaveManager.setAudio({ sfxVolume: vol });
    ambientSounds.forEach(({ sound, gain, followsSlider }) => {
      sound.setVolume(followsSlider ? vol * gain : vol);
    });
    listeners.forEach((fn) => fn(this.muted));
    return vol;
  },

  sfx(scene, key, config = {}) {
    if (!game || !scene.cache.audio.exists(key)) return;
    const vol = (config.volume ?? 1) * SaveManager.getAudio().sfxVolume;
    game.sound.play(key, { ...config, volume: vol });
  },
};
