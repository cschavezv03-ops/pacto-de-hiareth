import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT } from '../config/constants.js';
import { SPRITESHEETS, BACKGROUNDS, MUSIC, SFX } from '../config/assets.js';
import { AudioManager } from '../managers/AudioManager.js';
import { generateProceduralTextures } from '../objects/ProceduralTextures.js';
import { createAnimations } from '../objects/Animations.js';

/** Nombre de archivo en public/assets/props -> clave de textura en el juego. */
const PROP_KEYS = {
  goal_house: 'goal_house',
  goal_sign: 'goal_sign',
  goal_portal: 'goal_portal',
  goal_camp: 'goal_camp',
  checkpoint: 'prop_checkpoint',
  icon_sound_on: 'icon_sound_on',
  icon_sound_off: 'icon_sound_off',
};

/** Archivo (relativo a assets/sprites) -> clave de textura de las animaciones nuevas. */
const ANIM_KEYS = {
  'aidan/Cast_GhostFire.png': 'aidan_cast',
  'fx/ghostfire.png': 'fx_ghostfire',
  'fx/ghostfire_burst.png': 'fx_ghostfire_burst',
  'slime/Slime3_Leap.png': 'slime_leap',
  'skeleton/windup.png': 'skeleton_windup',
  'alien/charge.png': 'alien_charge',
  'fx/crescent.png': 'fx_crescent',
  'aidan/Crouch.png': 'aidan_crouch',
  'skeleton/sweep.png': 'skeleton_sweep',
  'skeleton/charge.png': 'skeleton_charge',
  'aidan/JumpAttack.png': 'aidan_jump_attack',
  'fx/orb.png': 'fx_orb',
  'fx/orb_pickup.png': 'fx_orb_pickup',
  'fx/lava_trail.png': 'fx_lava',
  'fx/platform_crack.png': 'fx_crack',
};

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

    // Props pixel art (metas, checkpoint, iconos): sus tamaños vienen de props.json,
    // así que se encolan cuando ese JSON termina de cargar.
    this.load.json('props_meta', 'assets/props/props.json');
    this.load.once('filecomplete-json-props_meta', (_key, _type, meta) => {
      Object.entries(meta ?? {}).forEach(([file, info]) => {
        const name = file.replace(/\.png$/, '');
        const key = PROP_KEYS[name] ?? name;
        this.load.spritesheet(key, `assets/props/${file}`, {
          frameWidth: info.frameWidth, frameHeight: info.frameHeight,
        });
      });
    });

    // Animaciones nuevas (Fuego fantasma, salto del slime, avisos de enemigos...).
    // anim_sprites.json describe cada archivo; si falta, se usan respaldos procedurales.
    const queueAnimSheets = (_key, _type, meta) => {
      const entries = Array.isArray(meta) ? meta : Object.entries(meta?.files ?? meta ?? {})
        .map(([file, info]) => ({ file, ...info }));
      entries.forEach((info) => {
        const file = (info.file ?? info.path ?? '').replace(/^.*sprites\//, '');
        const key = ANIM_KEYS[file];
        if (!key || !info.frameWidth) return;
        this.load.spritesheet(key, `assets/sprites/${file}`, {
          frameWidth: info.frameWidth, frameHeight: info.frameHeight,
        });
      });
    };
    this.load.json('anim_meta', 'assets/sprites/anim_sprites.json');
    this.load.once('filecomplete-json-anim_meta', queueAnimSheets);
    this.load.json('anim_meta2', 'assets/sprites/anim_sprites2.json');
    this.load.once('filecomplete-json-anim_meta2', queueAnimSheets);
    this.load.json('anim_meta3', 'assets/sprites/anim_sprites3.json');
    this.load.once('filecomplete-json-anim_meta3', queueAnimSheets);

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
