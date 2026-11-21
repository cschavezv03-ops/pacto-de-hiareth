/**
 * Animaciones globales (se crean una vez y las comparten todas las escenas).
 * Los conteos de frames de alien/esqueleto se leen de la textura, porque esas
 * tiras se generan con tools/slice_sheets.py.
 */

/** Filas del spritesheet del slime (4 direcciones). Se usa la fila "derecha" + flipX. */
export const SLIME_ROW_RIGHT = 3;

function strip(scene, key, textureKey, frameRate, repeat = -1, frames = null) {
  if (scene.anims.exists(key) || !scene.textures.exists(textureKey)) return;
  const total = scene.textures.get(textureKey).frameTotal - 1; // sin el frame __BASE
  if (total <= 0) return;
  scene.anims.create({
    key,
    frames: frames ?? scene.anims.generateFrameNumbers(textureKey, { start: 0, end: total - 1 }),
    frameRate,
    repeat,
  });
}

function slimeRow(scene, key, textureKey, frameRate, repeat = -1) {
  if (scene.anims.exists(key) || !scene.textures.exists(textureKey)) return;
  const tex = scene.textures.get(textureKey);
  const perRow = tex.source[0].width / 64;
  const start = SLIME_ROW_RIGHT * perRow;
  scene.anims.create({
    key,
    frames: scene.anims.generateFrameNumbers(textureKey, { start, end: start + perRow - 1 }),
    frameRate,
    repeat,
  });
}

export function createAnimations(scene) {
  // Aidan (plataformas)
  strip(scene, 'aidan-idle', 'aidan_idle', 10);
  strip(scene, 'aidan-run', 'aidan_run', 14);
  strip(scene, 'aidan-jump', 'aidan_jump', 8);
  strip(scene, 'aidan-fall', 'aidan_fall', 8);
  strip(scene, 'aidan-attack1', 'aidan_attack1', 24, 0);
  strip(scene, 'aidan-attack2', 'aidan_attack2', 24, 0);
  strip(scene, 'aidan-hit', 'aidan_hit', 14, 0);
  strip(scene, 'aidan-death', 'aidan_death', 9, 0);
  // Aidan (vuelo, jefe)
  strip(scene, 'aidan-fly', 'aidan_fly', 10);
  strip(scene, 'aidan-fly-cast', 'aidan_fly_cast', 24, 0);

  // Slime
  slimeRow(scene, 'slime-idle', 'slime_idle', 8);
  slimeRow(scene, 'slime-walk', 'slime_walk', 10);
  slimeRow(scene, 'slime-hurt', 'slime_hurt', 14, 0);
  slimeRow(scene, 'slime-death', 'slime_death', 12, 0);

  // Alien y esqueleto
  for (const kind of ['alien', 'skeleton']) {
    strip(scene, `${kind}-idle`, `${kind}_idle`, 8);
    strip(scene, `${kind}-walk`, `${kind}_walk`, 10);
    strip(scene, `${kind}-attack`, `${kind}_attack`, 14, 0);
    strip(scene, `${kind}-hurt`, `${kind}_hurt`, 12, 0);
    strip(scene, `${kind}-death`, `${kind}_death`, 10, 0);
  }

  // Morrigannus
  strip(scene, 'boss-idle', 'boss_idle', 8);

  // Fuego fantasma y animaciones nuevas (sprites de tools/gen_anim_sprites.py;
  // si no están, fx_ghostfire es procedural y el resto usa animaciones existentes).
  strip(scene, 'ghostfire-burn', 'fx_ghostfire', 14);
  strip(scene, 'ghostfire-burst', 'fx_ghostfire_burst', 20, 0);
  strip(scene, 'aidan-cast', 'aidan_cast', 18, 0);
  strip(scene, 'slime-leap', 'slime_leap', 12, 0);
  strip(scene, 'skeleton-windup', 'skeleton_windup', 14, 0);
  strip(scene, 'alien-charge', 'alien_charge', 12, 0);
  strip(scene, 'crescent-spin', 'fx_crescent', 14);
  strip(scene, 'aidan-crouch', 'aidan_crouch', 16, 0); // termina en el último frame (agachado)
  strip(scene, 'skeleton-sweep', 'skeleton_sweep', 14, 0);
  strip(scene, 'skeleton-charge', 'skeleton_charge', 14);
  strip(scene, 'aidan-jump-attack', 'aidan_jump_attack', 20, 0);
  strip(scene, 'orb-spin', 'fx_orb', 12);
  strip(scene, 'orb-pickup', 'fx_orb_pickup', 18, 0);
  strip(scene, 'lava-burn', 'fx_lava', 10);
  // Esqueleto emboscado: se levanta reproduciendo su muerte al revés (sprite original).
  if (!scene.anims.exists('skeleton-rise') && scene.textures.exists('skeleton_death')) {
    const n = scene.textures.get('skeleton_death').frameTotal - 1;
    scene.anims.create({
      key: 'skeleton-rise',
      frames: Array.from({ length: n }, (_, i) => ({ key: 'skeleton_death', frame: n - 1 - i })),
      frameRate: 11,
      repeat: 0,
    });
  }

  // Props animados (si el PNG trae varios frames)
  strip(scene, 'goal_portal-anim', 'goal_portal', 8);
  strip(scene, 'goal_camp-anim', 'goal_camp', 8);
  if (!scene.anims.exists('checkpoint-lit') && scene.textures.exists('prop_checkpoint')) {
    scene.anims.create({
      key: 'checkpoint-lit',
      frames: scene.anims.generateFrameNumbers('prop_checkpoint', { start: 1, end: 4 }),
      frameRate: 9,
      repeat: -1,
    });
  }
}
