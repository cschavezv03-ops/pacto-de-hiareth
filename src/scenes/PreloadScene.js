import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { SPRITESHEETS, BACKGROUNDS, MUSIC, SFX } from '../config/assets.js';
import { AudioManager } from '../managers/AudioManager.js';
import { generateProceduralTextures } from '../objects/ProceduralTextures.js';
import { createAnimations } from '../objects/Animations.js';

/** Carga todos los assets con barra de progreso y crea las animaciones globales. */
export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.PRELOAD);
  }

  preload() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.text(cx, cy - 50, 'El Pacto de Hiareth', {
      fontFamily: 'Georgia, serif', fontSize: '36px', color: '#f4ecff',
    }).setOrigin(0.5);
    const barBg = this.add.rectangle(cx, cy + 10, 420, 16, 0x2a2040).setStrokeStyle(2, 0xff9a3c);
    const bar = this.add.rectangle(cx - 208, cy + 10, 0, 10, 0xff9a3c).setOrigin(0, 0.5);
    const label = this.add.text(cx, cy + 44, 'Cargando… 0%', {
      fontFamily: 'monospace', fontSize: '16px', color: '#d9cdea',
    }).setOrigin(0.5);
    this.load.on('progress', (v) => {
      bar.width = 416 * v;
      label.setText(`Cargando… ${Math.round(v * 100)}%`);
    });
    this.load.on('loaderror', (file) => console.warn('[Preload] No se pudo cargar', file.key, file.src));
    barBg.setDepth(1);

    SPRITESHEETS.forEach(({ key, url, frameWidth, frameHeight }) =>
      this.load.spritesheet(key, url, { frameWidth, frameHeight }));

    Object.entries(BACKGROUNDS).forEach(([id, { folder, files }]) => {
      files.forEach((file, i) => this.load.image(`bg_${id}_${i + 1}`, `assets/bg/${folder}/${file}.png`));
    });

    MUSIC.forEach(({ key, url }) => this.load.audio(key, url));
    SFX.forEach(({ key, url }) => this.load.audio(key, url));
  }

  create() {
    generateProceduralTextures(this);
    createAnimations(this);
    AudioManager.init(this.game);
    this.scene.start(SCENES.MENU);
  }
}
