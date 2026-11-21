/**
 * Manifiesto de assets del gameplay. PreloadScene carga todo lo listado aquí.
 * Rutas relativas a /public. Los spritesheets son tiras horizontales de un solo renglón
 * (salvo el slime, que tiene 4 filas de dirección).
 */

const A = 'assets';

export const SPRITESHEETS = [
  // Aidan: frames de 250x250, pies en y≈167, mirando a la derecha.
  { key: 'aidan_idle', url: `${A}/sprites/aidan/Idle.png`, frameWidth: 250, frameHeight: 250 },
  { key: 'aidan_run', url: `${A}/sprites/aidan/Run.png`, frameWidth: 250, frameHeight: 250 },
  { key: 'aidan_jump', url: `${A}/sprites/aidan/Jump.png`, frameWidth: 250, frameHeight: 250 },
  { key: 'aidan_fall', url: `${A}/sprites/aidan/Fall.png`, frameWidth: 250, frameHeight: 250 },
  { key: 'aidan_attack1', url: `${A}/sprites/aidan/Attack1.png`, frameWidth: 250, frameHeight: 250 },
  { key: 'aidan_attack2', url: `${A}/sprites/aidan/Attack2.png`, frameWidth: 250, frameHeight: 250 },
  { key: 'aidan_hit', url: `${A}/sprites/aidan/TakeHit.png`, frameWidth: 250, frameHeight: 250 },
  { key: 'aidan_death', url: `${A}/sprites/aidan/Death.png`, frameWidth: 250, frameHeight: 250 },
  { key: 'aidan_fly', url: `${A}/sprites/aidan/Vuelo_Idle.png`, frameWidth: 250, frameHeight: 250 },
  { key: 'aidan_fly_cast', url: `${A}/sprites/aidan/Vuelo_Ataque1_FuegoFantasma.png`, frameWidth: 250, frameHeight: 250 },

  // Slime: frames 64x64, 4 filas (direcciones). Ver SLIME_ROWS.
  { key: 'slime_idle', url: `${A}/sprites/slime/Slime3_Idle_with_shadow.png`, frameWidth: 64, frameHeight: 64 },
  { key: 'slime_walk', url: `${A}/sprites/slime/Slime3_Walk_with_shadow.png`, frameWidth: 64, frameHeight: 64 },
  { key: 'slime_hurt', url: `${A}/sprites/slime/Slime3_Hurt_with_shadow.png`, frameWidth: 64, frameHeight: 64 },
  { key: 'slime_death', url: `${A}/sprites/slime/Slime3_Death_with_shadow.png`, frameWidth: 64, frameHeight: 64 },

  // Alien y esqueleto: generados por tools/slice_sheets.py desde los JPG originales.
  // Frames 256x256, figura centrada horizontalmente y apoyada en el borde inferior.
  { key: 'alien_walk', url: `${A}/sprites/alien/walk.png`, frameWidth: 256, frameHeight: 256 },
  { key: 'alien_attack', url: `${A}/sprites/alien/attack.png`, frameWidth: 256, frameHeight: 256 },
  { key: 'alien_idle', url: `${A}/sprites/alien/idle.png`, frameWidth: 256, frameHeight: 256 },
  { key: 'alien_hurt', url: `${A}/sprites/alien/hurt.png`, frameWidth: 256, frameHeight: 256 },
  { key: 'alien_death', url: `${A}/sprites/alien/death.png`, frameWidth: 256, frameHeight: 256 },
  { key: 'skeleton_walk', url: `${A}/sprites/skeleton/walk.png`, frameWidth: 256, frameHeight: 256 },
  { key: 'skeleton_attack', url: `${A}/sprites/skeleton/attack.png`, frameWidth: 256, frameHeight: 256 },
  { key: 'skeleton_idle', url: `${A}/sprites/skeleton/idle.png`, frameWidth: 256, frameHeight: 256 },
  { key: 'skeleton_hurt', url: `${A}/sprites/skeleton/hurt.png`, frameWidth: 256, frameHeight: 256 },
  { key: 'skeleton_death', url: `${A}/sprites/skeleton/death.png`, frameWidth: 256, frameHeight: 256 },

  // Morrigannus: 8 frames Idle, 352x608, generados por tools/slice_sheets.py.
  { key: 'boss_idle', url: `${A}/sprites/boss/idle.png`, frameWidth: 352, frameHeight: 608 },
];

/**
 * Capas de parallax por nivel (de la más lejana a la más cercana).
 * Se cargan como `bg_<id>_<n>` con n = 1..files.length.
 * Level4IF/far.png = capas 1-4 fusionadas (casi estáticas) para ahorrar fill-rate.
 */
export const BACKGROUNDS = {
  act1: { folder: 'Level1', files: ['1', '2', '3', '4'] },
  act2: { folder: 'Level2', files: ['1', '2', '3', '4', '5'] },
  act3: { folder: 'Level3', files: ['1', '2', '3', '4', '5'] },
  act4: { folder: 'Level4IF', files: ['far', '5', '6', '7', '8', '9', '10'] },
  boss: { folder: 'BOSSFIGTH', files: ['1', '2', '3'] },
};

export const MUSIC = [
  { key: 'music_act1', url: `${A}/music/Level1.ogg` },
  { key: 'music_act2', url: `${A}/music/Level2.ogg` },
  { key: 'music_act3', url: `${A}/music/Level3.ogg` },
  { key: 'music_act4', url: `${A}/music/Level4.ogg` },
  { key: 'music_boss', url: `${A}/music/BOSSFIGTH.ogg` },
];

/** Efectos de sonido generados por tools/gen_sfx.py (WAV mono 22050 Hz). */
export const SFX = [
  'jump', 'attack', 'enemy_hit', 'enemy_die', 'player_hurt', 'player_die',
  'alien_shot', 'player_shot', 'boss_shot', 'boss_hit', 'level_clear', 'ui_select',
].map((name) => ({ key: `sfx_${name}`, url: `${A}/sfx/${name}.wav` }));
