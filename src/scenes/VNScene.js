import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, VN_SCENES } from '../config/constants.js';
import { AudioManager } from '../managers/AudioManager.js';
import { muteButton } from '../ui/UiKit.js';
import DialogueRunner from '../visual-novel/DialogueRunner.js';
import DialogueRenderer from '../visual-novel/DialogueRenderer.js';
import CharacterPresenter from '../visual-novel/CharacterPresenter.js';
import BackgroundPresenter from '../visual-novel/BackgroundPresenter.js';
import VNInput from '../visual-novel/VNInput.js';
import VNTransitions from '../visual-novel/VNTransitions.js';
import { VN_SCRIPTS } from '../visual-novel/dialogue/index.js';
import {
  VN_BACKGROUNDS,
  VN_MUSIC,
  VN_SFX,
  characterForSpeaker,
  portraitPath,
  portraitTexture,
  voiceForSpeaker,
} from '../visual-novel/assetManifest.js';

const FAST_ADVANCE_MS = 280;
const SKIP_RELEASE_MS = 460;

/** VN integrada en la instancia y el flujo narrativo existentes. */
export default class VNScene extends Phaser.Scene {
  constructor() {
    super(SCENES.VN);
  }

  init(data) {
    this.sceneId = data?.sceneId ?? VN_SCENES.INTRO;
    this.isEnding = Boolean(data?.isEnding);
  }

  preload() {
    const commands = VN_SCRIPTS[this.sceneId] ?? VN_SCRIPTS[VN_SCENES.INTRO];
    const backgroundKeys = new Set();
    const portraits = new Set();
    const queuedAudio = new Set();
    const queueAudio = (key, path) => {
      if (!path || this.cache.audio.exists(key) || queuedAudio.has(key)) return;
      queuedAudio.add(key);
      this.load.audio(key, path);
    };

    commands.forEach((command) => {
      if (command.type === 'background' && !command.key.startsWith('gameplay:')) backgroundKeys.add(command.key);
      if (command.type === 'showCharacter') portraits.add(`${command.character}:${command.expression ?? 'neutral'}`);
      if (command.type === 'setExpression') portraits.add(`${command.character}:${command.expression}`);
      if (command.type === 'dialogue') {
        const character = characterForSpeaker(command.speaker);
        if (character) portraits.add(`${character}:${command.expression ?? 'neutral'}`);
        const voice = voiceForSpeaker(command.speaker);
        if (voice) queueAudio(voice.key, voice.path);
      }
      if (command.type === 'music') {
        const key = `vn_music_${command.key}`;
        queueAudio(key, VN_MUSIC[command.key]);
      }
      if (command.type === 'sfx') {
        const key = `vn_sfx_${command.key}`;
        queueAudio(key, VN_SFX[command.key]);
      }
    });

    backgroundKeys.forEach((key) => {
      if (!this.textures.exists(`vn_bg_${key}`) && VN_BACKGROUNDS[key]) {
        this.load.image(`vn_bg_${key}`, VN_BACKGROUNDS[key]);
      }
    });
    portraits.forEach((entry) => {
      const [character, expression] = entry.split(':');
      const key = portraitTexture(character, expression);
      const path = portraitPath(character, expression);
      if (path && !this.textures.exists(key)) this.load.image(key, path);
    });
    this.load.on('loaderror', (file) => console.warn('[VN] No se pudo cargar el recurso', file.key, file.src));
  }

  create() {
    if (!this.isEnding) AudioManager.stopMusic();
    AudioManager.stopAmbience();

    this.backgroundPresenter = new BackgroundPresenter(this);
    this.characterPresenter = new CharacterPresenter(this);
    this.dialogueRenderer = new DialogueRenderer(this);
    this.transitions = new VNTransitions(this);
    muteButton(this, GAME_WIDTH - 12, 12);

    const commands = VN_SCRIPTS[this.sceneId] ?? VN_SCRIPTS[VN_SCENES.INTRO];
    this.runner = new DialogueRunner(commands, {
      onLine: (command) => this.dialogueRenderer.show(command, this.characterPresenter),
      onCommand: (command) => this.runCommand(command),
      onComplete: () => this.transitions.finish({ isEnding: this.isEnding }),
    });
    this.inputController = new VNInput(this, () => this.advance());
    this.cameras.main.fadeIn(380, 0, 0, 0);
    this.runner.start();

    this.events.once('shutdown', () => this.destroyVN());
  }

  runCommand(command) {
    switch (command.type) {
      case 'background':
        return this.backgroundPresenter.set(command.key, { sunrise: command.sunrise });
      case 'showCharacter':
        this.characterPresenter.show(command.character, command.expression, command.position);
        break;
      case 'hideCharacter':
        this.characterPresenter.hide(command.character);
        break;
      case 'setExpression':
        this.characterPresenter.setExpression(command.character, command.expression);
        break;
      case 'music':
        AudioManager.playMusic(this, `vn_music_${command.key}`, {
          gain: command.gain,
          loop: command.loop,
          fadeMs: command.fadeMs,
        });
        break;
      case 'stopMusic':
        AudioManager.fadeOutMusic(this, command.fadeMs);
        break;
      case 'sfx':
        AudioManager.vnSfx(this, `vn_sfx_${command.key}`, command);
        break;
      case 'ambience':
        this.playVNAmbience(command);
        break;
      case 'stopAmbience':
        this.cancelPendingAmbience(command.key);
        AudioManager.fadeOutAmbience(this, command.key ? `vn_sfx_${command.key}` : null, command.fadeMs);
        break;
      default:
        console.warn(`[VN] Comando narrativo desconocido: ${command.type}`);
    }
    return null;
  }

  playVNAmbience(command) {
    const key = `vn_sfx_${command.key}`;
    if (this.cache.audio.exists(key)) {
      AudioManager.playAmbience(this, key, command);
      return;
    }

    const path = VN_SFX[command.key];
    if (!path) return;
    this.pendingAmbiences ??= new Map();
    if (this.pendingAmbiences.has(key)) return;
    const token = Symbol(key);
    this.pendingAmbiences.set(key, token);

    const onError = (file) => {
      if (file.key !== key) return;
      if (this.pendingAmbiences.get(key) === token) this.pendingAmbiences.delete(key);
      this.load.off('loaderror', onError);
    };
    this.load.on('loaderror', onError);
    this.load.once(`filecomplete-audio-${key}`, () => {
      this.load.off('loaderror', onError);
      if (this.pendingAmbiences.get(key) !== token) return;
      this.pendingAmbiences.delete(key);
      if (this.sys.isActive()) AudioManager.playAmbience(this, key, command);
    });
    this.load.audio(key, path);
    this.load.start();
  }

  cancelPendingAmbience(key) {
    if (key) this.pendingAmbiences?.delete(`vn_sfx_${key}`);
    else this.pendingAmbiences?.clear();
  }

  advance() {
    const now = this.time.now;
    if (this.lastAdvanceAt !== undefined && now - this.lastAdvanceAt <= FAST_ADVANCE_MS) {
      this.setSkipping(true);
    }
    this.lastAdvanceAt = now;
    if (this.skipping) this.refreshSkipReleaseTimer();

    if (this.transitions.leaving) return;
    const pageState = this.dialogueRenderer.completeLine();
    if (pageState === 'done') this.runner.next();
  }

  setSkipping(value) {
    if (this.skipping === value) return;
    this.skipping = value;
    AudioManager.setVNSkipMode(value);
  }

  refreshSkipReleaseTimer() {
    this.skipReleaseTimer?.remove(false);
    this.skipReleaseTimer = this.time.delayedCall(SKIP_RELEASE_MS, () => {
      this.skipReleaseTimer = null;
      this.setSkipping(false);
    });
  }

  destroyVN() {
    this.skipReleaseTimer?.remove(false);
    this.skipReleaseTimer = null;
    this.setSkipping(false);
    AudioManager.stopVNSfx();
    this.pendingAmbiences?.clear();
    this.runner?.destroy();
    this.dialogueRenderer?.destroy();
    this.characterPresenter?.destroy();
    this.backgroundPresenter?.destroy();
    this.inputController?.destroy();
    this.runner = null;
    this.dialogueRenderer = null;
    this.characterPresenter = null;
    this.backgroundPresenter = null;
    this.inputController = null;
  }
}
