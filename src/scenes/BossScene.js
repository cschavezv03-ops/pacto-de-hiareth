import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, RULES, SCENES } from '../config/constants.js';
import { GameState } from '../managers/GameState.js';
import { AudioManager } from '../managers/AudioManager.js';
import { InputManager } from '../managers/InputManager.js';
import BossPatterns, { PATTERN_COLORS } from '../objects/BossPatterns.js';

export const BOSS_TUNING = Object.freeze({
  // Intermedio: 1.2–1.5 impactos normales/s + 85% de especiales acertados
  // = 19.6–22.6 DPS => 186–215 s, más entrada/transiciones. Objetivo 3–4 min.
  // Es una hipótesis de balance, no un límite de duración: disparar mejor se premia.
  // Fácil 2730 / Intermedio 4200 / Difícil 5250; solo se escala la vida.
  HEALTH: 4200,
  SHOT_DAMAGE: 10,
  PLAYER_SPEED: 245,
  PLAYER_SCALE: 0.95,
  PLAYER_HIT_RADIUS: 7, // Radio real en pantalla, torso de Aidan.
  PLAYER_SHOT_SPEED: 520,
  PLAYER_SHOT_COOLDOWN_MS: 120,
  PLAYER_POOL_SIZE: 40,
  BOSS_POOL_SIZE: 384, // Precalentado; pico esperado <160, sin texturas por bala.
  BULLET_RADIUS: 6,
  SPECIAL_POOL_SIZE: 3,
  SPECIAL_DAMAGE_MULT: 8,
  SPECIAL_SPEED: 460,
  SPECIAL_COOLDOWN_MS: 9000,
  SPECIAL_FRAME: 5, // Índice del spritesheet (0..7); evento animationupdate.
  DASH_DISTANCE: 170,
  DASH_DURATION_MS: 150,
  DASH_INVULNERABILITY_MS: 200,
  DASH_COOLDOWN_MS: 800,
  TRAIL_COUNT: 8,
  TRAIL_INTERVAL_MS: 24,
  TRAIL_LIFE_MS: 180,
  INTRO_MS: 2600,
  PHASE_THRESHOLD_2: 0.66,
  PHASE_THRESHOLD_3: 0.33,
  PHASE_TRANSITION_MS: 1200, // El jefe sigue recibiendo daño durante la transición.
  PHASE_RECOVERY_MS: 350, // Después del cambio, aún se anuncia el próximo ataque.
  INTENSITY_DURATION_MS: 70000, // Rampa local en cada fase; saturada, nunca imposible.
  TELEGRAPH_MS: 450,
  LANCE_WARNING_MS: 600,
  WALL_WARNING_MS: 700,
  LANCE_COUNT: 3,
  LANCE_INTERVAL_MS: 115,
  WALL_GAP: 116, // Hueco libre mínimo, excluyendo el radio de las balas.
  WALL_GAP_REACH: 130, // Desplazamiento máximo del centro respecto a Aidan al avisar.
  WALL_SPACING: 24,
  FAN_SPREAD: Math.PI * 0.52,
  RING_ROTATION: 0.37,
  DOUBLE_RING_DELAY_MS: 460,
  SPIRAL_DURATION_MS: 3400,
  SPIRAL_ROTATION: 0.24, // Dos brazos; separación suficiente para atravesarlos.
  SPIRAL_COMBINE_AT_MS: 1500, // Una sola combinación anunciada por espiral, fase 3.
  PHASES: Object.freeze([
    // rest = respiro TRAS el patrón, más su aviso. speedRise/2 balas extra
    // suben continuamente con el tiempo local; la rampa nunca elimina el aviso.
    Object.freeze({ name: 'Raíces', speed: 120, speedRise: 35, fan: 3, ring: 10,
      rest: 1450, restReduction: 350, lanceSpeed: 340, wallSpeed: 140, spiralInterval: 180 }),
    Object.freeze({ name: 'Astas', speed: 145, speedRise: 35, fan: 5, ring: 12,
      rest: 1100, restReduction: 250, lanceSpeed: 370, wallSpeed: 155, spiralInterval: 170 }),
    Object.freeze({ name: 'Luna roja', speed: 170, speedRise: 30, fan: 5, ring: 14,
      rest: 850, restReduction: 200, lanceSpeed: 400, wallSpeed: 175, spiralInterval: 150 }),
  ]),
  DISSOLVE_MS: 350,
  HIT_STOP_MS: 70, // Física, animaciones y reloj de combate; UI/cámara siguen vivas.
  HIT_SHAKE: 0.003,
  PHASE_SHAKE: 0.005,
  BOSS_FLASH_MS: 70,
  BOSS_FLASH_INTERVAL_MS: 360, // Máximo <3 hit-flashes/s; avisos usan tint normal.
  COOLDOWN_UI_MS: 100, // DOM/registry a 10 Hz, no en cada frame.
  VICTORY_DELAY_MS: 2000,
  SCORE_BASE: 5000,
  SCORE_PER_HEART: 1000,
  TIME_BONUS_LIMIT_SECONDS: 240,
  SCORE_PER_SECOND: 10,
});

const ORBS = Object.freeze({ FIRE: 'boss-orb-fire', RED: 'boss-orb-red', VIOLET: 'boss-orb-violet' });
const CRESCENT_TEXTURE = 'boss-fire-crescent';
const FLY_ANIMATION = 'boss-aidan-fly';
const CAST_ANIMATION = 'boss-aidan-cast';
const SPECIAL_ANIMATION = 'aidan-fly-crescent';
const BEST_KEY = 'pactoHiareth.bossBest.v1';

export default class BossScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOSS });
  }

  init() {
    // Una vida ganada con orbes antes del combate da un corazón extra (solo el primer intento).
    this.hearts = RULES.PLAYER_HEARTS + (GameState.consumeBonusHeart() ? 1 : 0);
    this.maxHealth = Math.round(BOSS_TUNING.HEALTH * GameState.difficulty.bossHealthMult);
    this.bossHealth = this.maxHealth;
    this.phase = 1;
    this.elapsedMs = 0;
    this.phaseElapsedMs = 0;
    this.intensity = 0;
    this.transitionRemaining = 0;
    this.freezeRemaining = 0;
    this.nextShotAt = 0;
    this.nextSpecialAt = 0;
    this.nextDashAt = 0;
    this.dashUntil = 0;
    this.dashInvulnerableUntil = 0;
    this.dashX = 1;
    this.dashY = 0;
    this.invulnerableUntil = 0;
    this.bossFlashUntil = 0;
    this.nextBossFlashAt = 0;
    this.nextPatternSoundAt = 0;
    this.nextUiAt = 0;
    this.nextTrailAt = 0;
    this.trailIndex = 0;
    this.specialCasting = false;
    this.specialFired = false;
    this.bufferAttack = false;
    this.bufferSpecial = false;
    this.bufferDash = false;
    this.finished = false;
    this.pendingDefeat = false;
    this.backgrounds = [];
    this.trails = [];
    this.telegraphs = [];
    this.colliders = [];
  }

  create() {
    this.events.once('shutdown', this.onShutdown, this);
    this.createOrbTextures();
    this.createAnimations();
    for (let layer = 1; layer <= 3; layer += 1) {
      const background = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, `bg_boss_${layer}`)
        .setOrigin(0).setDepth(layer - 4);
      background.setTileScale(Math.max(GAME_WIDTH / 576, GAME_HEIGHT / 324));
      this.backgrounds.push(background);
    }
    this.boss = this.physics.add.sprite(GAME_WIDTH - 170, GAME_HEIGHT / 2, 'boss_idle')
      .setScale(300 / 608).setDepth(3).play('boss-idle');
    this.boss.body.setAllowGravity(false).setImmovable(true).setSize(220, 500, true);
    this.boss.body.updateFromGameObject();
    this.player = this.physics.add.sprite(170, GAME_HEIGHT / 2, 'aidan_fly')
      .setOrigin(125 / 250, 132 / 250).setScale(BOSS_TUNING.PLAYER_SCALE)
      .setDepth(5).play(FLY_ANIMATION);
    const radius = BOSS_TUNING.PLAYER_HIT_RADIUS / BOSS_TUNING.PLAYER_SCALE;
    this.player.body.setAllowGravity(false).setCircle(radius, 125 - radius, 132 - radius);
    this.player.body.setBoundsRectangle(new Phaser.Geom.Rectangle(
      32, 64, GAME_WIDTH * 2 / 3 - 32, GAME_HEIGHT - 96,
    ));
    this.player.setCollideWorldBounds(true);
    this.player.body.updateFromGameObject();
    this.player.on(`animationcomplete-${CAST_ANIMATION}`, this.finishCast, this);
    this.player.on(`animationcomplete-${SPECIAL_ANIMATION}`, this.finishSpecial, this);
    this.player.on('animationupdate', this.onAnimationFrame, this);
    this.hitPoint = this.add.circle(this.player.x, this.player.y, 3, 0xfff9cf)
      .setStrokeStyle(2, 0xff8b32).setDepth(8);
    this.events.on('postupdate', this.syncHitPoint, this);

    this.playerBullets = this.createBulletPool(ORBS.FIRE, BOSS_TUNING.PLAYER_POOL_SIZE);
    this.bossBullets = this.createBulletPool(ORBS.RED, BOSS_TUNING.BOSS_POOL_SIZE);
    // Sprite pixel art de la media luna (tools/gen_anim_sprites.py) o textura de respaldo.
    this.crescentKey = this.textures.exists('fx_crescent') ? 'fx_crescent' : CRESCENT_TEXTURE;
    this.specialBullets = this.createBulletPool(this.crescentKey, BOSS_TUNING.SPECIAL_POOL_SIZE, true);
    // Always resolve the group member by identity, never rely on overlap argument order.
    this.colliders.push(this.physics.add.overlap(this.playerBullets, this.boss, this.hitBoss, undefined, this));
    this.colliders.push(this.physics.add.overlap(this.specialBullets, this.boss, this.hitBoss, undefined, this));
    // Clear bullets BEFORE the player's hurt overlap is processed this physics step.
    this.colliders.push(this.physics.add.overlap(this.specialBullets, this.bossBullets, this.eraseBullet, undefined, this));
    this.colliders.push(this.physics.add.overlap(this.player, this.bossBullets, this.hitPlayer, undefined, this));
    for (let i = 0; i < BOSS_TUNING.TRAIL_COUNT; i += 1) {
      const trail = this.add.image(0, 0, 'aidan_fly').setOrigin(this.player.originX, this.player.originY)
        .setScale(BOSS_TUNING.PLAYER_SCALE).setTint(0xc18aff).setDepth(4).setVisible(false);
      trail.life = 0;
      this.trails.push(trail);
    }
    for (let i = 0; i < 2; i += 1) this.telegraphs.push(this.add.graphics().setDepth(2));
    this.patterns = new BossPatterns(this, BOSS_TUNING);
    this.phaseText = this.add.text(GAME_WIDTH / 2, 118, 'I · Raíces', {
      fontFamily: 'Georgia, serif', fontSize: '28px', color: '#ffe0ef',
      stroke: '#160d28', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(10);
    this.damageText = this.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '32px', color: '#ffb8fc',
      stroke: '#230d30', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(9).setVisible(false);
    this.controls = new InputManager(this, 'boss');
    this.publishCooldowns();
    this.registry.set('hearts', this.hearts);
    this.publishBossHealth();
    this.scene.launch(SCENES.HUD, { mode: 'boss' });
    AudioManager.playMusic(this, 'music_boss');
    const instructions = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 68,
      'WASD: volar · J: disparar · Shift/L: dash · K: media luna', {
        fontFamily: 'Arial, sans-serif', fontSize: '19px', color: '#ffffff',
        backgroundColor: '#160d28', padding: { x: 18, y: 12 },
      }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: instructions, alpha: 0, delay: 2300, duration: 300,
      onComplete: () => instructions.destroy() });
    if (import.meta.env.DEV) window.__boss = this;
  }

  createAnimations() {
    const definitions = [
      ['boss-idle', 'boss_idle', 8, -1],
      [FLY_ANIMATION, 'aidan_fly', 10, -1],
      [CAST_ANIMATION, 'aidan_fly_cast', 32, 0],
      [SPECIAL_ANIMATION, 'aidan_fly_crescent', 18, 0],
    ];
    for (const [key, texture, frameRate, repeat] of definitions) {
      if (!this.anims.exists(key)) this.anims.create({
        key, frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 7 }), frameRate, repeat,
      });
    }
  }

  createOrbTextures() {
    const palettes = [[ORBS.FIRE, 0xff681d, 0xffba32, 0xfff5ba],
      [ORBS.RED, 0xe81762, 0xff496c, 0xffdcf0], [ORBS.VIOLET, 0x792eff, 0xc070ff, 0xf4dcff]];
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    for (const [key, halo, core, highlight] of palettes) {
      if (this.textures.exists(key)) continue;
      graphics.clear();
      graphics.fillStyle(halo, 0.12).fillCircle(16, 16, 15);
      graphics.fillStyle(halo, 0.26).fillCircle(16, 16, 11);
      graphics.fillStyle(core, 1).fillCircle(16, 16, 7);
      graphics.fillStyle(highlight, 1).fillCircle(14, 14, 3);
      graphics.generateTexture(key, 32, 32);
    }
    if (!this.textures.exists(CRESCENT_TEXTURE)) {
      graphics.clear().fillStyle(0xa34fff, 0.95).lineStyle(3, 0xff699d, 1).beginPath();
      for (let i = 0; i <= 32; i += 1) {
        const a = -Math.PI / 2 + Math.PI * i / 32;
        const x = 32 + 52 * Math.cos(a);
        const y = 64 + 56 * Math.sin(a);
        if (i === 0) graphics.moveTo(x, y); else graphics.lineTo(x, y);
      }
      for (let i = 32; i >= 0; i -= 1) {
        const a = -Math.PI / 2 + Math.PI * i / 32;
        graphics.lineTo(32 + 22 * Math.cos(a), 64 + 56 * Math.sin(a));
      }
      graphics.closePath().fillPath().strokePath();
      graphics.generateTexture(CRESCENT_TEXTURE, 96, 128);
    }
    graphics.destroy();
  }

  createBulletPool(texture, maxSize, special = false) {
    const group = this.physics.add.group({ defaultKey: texture, maxSize });
    group.createMultiple({ key: texture, quantity: maxSize, active: false, visible: false });
    for (const bullet of group.getChildren()) {
      bullet.body.setAllowGravity(false);
      if (special && texture === 'fx_crescent') {
        bullet.setScale(1.35);
        bullet.body.setSize(54, 84).setOffset(30, 6); // arco de la media luna (frame 96x96)
      } else if (special) bullet.body.setSize(52, 112).setOffset(32, 8);
      else bullet.body.setCircle(BOSS_TUNING.BULLET_RADIUS, 10, 10);
      bullet.isCrescent = special;
      bullet.hitBossOnce = false;
      bullet.dissolveRemaining = 0;
      bullet.setDepth(special ? 7 : 6).disableBody(true, true);
    }
    return group;
  }

  update(_time, delta) {
    this.updateEffects(delta);
    if (this.pendingDefeat && this.freezeRemaining <= 0) {
      this.pendingDefeat = false;
      this.scene.stop(SCENES.HUD);
      this.scene.start('BossDefeat', { progress: 1 - this.bossHealth / this.maxHealth, best: this.saveBest() });
      return;
    }
    if (this.finished) return;
    this.controls.update();
    if (this.controls.justPressed('pause')) {
      this.scene.launch(SCENES.PAUSE, { from: SCENES.BOSS });
      this.scene.pause();
      return;
    }
    this.bufferAttack ||= this.controls.justPressed('attack');
    this.bufferSpecial ||= this.controls.justPressed('special');
    this.bufferDash ||= this.controls.justPressed('dash');
    if (this.freezeRemaining > 0) return;
    // Simulation clock stops with pause/hit-stop; no overdue attack bursts.
    this.elapsedMs += delta;
    this.phaseElapsedMs += delta;
    this.intensity = Phaser.Math.Clamp(this.phaseElapsedMs / BOSS_TUNING.INTENSITY_DURATION_MS, 0, 1);
    if (this.bufferDash) this.startDash();
    if (this.elapsedMs < this.dashUntil) {
      const speed = BOSS_TUNING.DASH_DISTANCE * 1000 / BOSS_TUNING.DASH_DURATION_MS;
      this.player.body.setVelocity(this.dashX * speed, this.dashY * speed);
      if (this.elapsedMs >= this.nextTrailAt) this.emitTrail();
    } else {
      this.player.body.setVelocity(this.controls.axisX(), this.controls.axisY());
      this.player.body.velocity.normalize().scale(BOSS_TUNING.PLAYER_SPEED);
    }
    if (this.bufferSpecial) this.startSpecial();
    if (this.bufferAttack) this.firePlayerShot();
    this.bufferAttack = this.bufferDash = this.bufferSpecial = false;
    if (this.elapsedMs < this.dashInvulnerableUntil) this.player.setAlpha(0.65).setTint(0xd9a5ff);
    else {
      this.player.clearTint();
      this.player.setAlpha(this.elapsedMs < this.invulnerableUntil
        ? 0.45 + 0.55 * Math.pow(Math.cos(this.elapsedMs / 110), 2) : 1);
    }
    if (this.transitionRemaining > 0) {
      this.transitionRemaining = Math.max(0, this.transitionRemaining - delta);
      this.phaseText.setAlpha(0.6 + 0.4 * this.transitionRemaining / BOSS_TUNING.PHASE_TRANSITION_MS);
    } else this.patterns.update(delta);
    this.updateBossTint();
    if (this.elapsedMs >= this.nextUiAt) this.publishCooldowns();
  }

  updateEffects(delta) {
    for (let i = 0; i < this.backgrounds.length; i += 1) {
      this.backgrounds[i].tilePositionX += delta / 1000 * (4 + i * 6);
    }
    if (this.freezeRemaining > 0) {
      this.freezeRemaining = Math.max(0, this.freezeRemaining - delta);
      if (!this.freezeRemaining) {
        this.physics.world.resume();
        this.player.anims.resume();
        this.boss.anims.resume();
      }
    }
    for (const trail of this.trails) {
      if (trail.life <= 0) continue;
      trail.life -= delta;
      trail.setAlpha(Math.max(0, trail.life / BOSS_TUNING.TRAIL_LIFE_MS) * 0.45);
      if (trail.life <= 0) trail.setVisible(false);
    }
    this.recycleBullets(this.playerBullets, delta);
    this.recycleBullets(this.bossBullets, delta);
    this.recycleBullets(this.specialBullets, delta);
  }

  syncHitPoint() {
    this.hitPoint.setPosition(this.player.x, this.player.y);
  }

  finishCast() {
    if (!this.finished && !this.specialCasting) this.player.play(FLY_ANIMATION);
  }

  finishSpecial() {
    this.specialCasting = false;
    if (!this.finished) this.player.play(FLY_ANIMATION);
  }

  onAnimationFrame(animation, frame) {
    if (animation.key === SPECIAL_ANIMATION && Number(frame.textureFrame) === BOSS_TUNING.SPECIAL_FRAME
      && this.specialCasting && !this.specialFired && !this.finished) this.fireSpecial();
  }

  firePlayerShot() {
    if (this.finished || this.elapsedMs < this.nextShotAt) return;
    const bullet = this.playerBullets.getFirstDead(false);
    if (!bullet) return;
    bullet.enableBody(true, this.player.x + 28, this.player.y, true, true);
    bullet.body.setAllowGravity(false);
    bullet.setAlpha(1).setScale(1).setVelocity(BOSS_TUNING.PLAYER_SHOT_SPEED, 0);
    this.nextShotAt = this.elapsedMs + BOSS_TUNING.PLAYER_SHOT_COOLDOWN_MS;
    if (!this.specialCasting) this.player.play(CAST_ANIMATION);
    AudioManager.sfx(this, 'sfx_player_shot');
  }

  startDash() {
    if (this.elapsedMs < this.nextDashAt) return;
    let x = this.controls.axisX();
    const y = this.controls.axisY();
    if (!x && !y) x = 1; // Aidan always faces right, towards Morrigannus.
    const length = Math.hypot(x, y);
    this.dashX = x / length;
    this.dashY = y / length;
    this.dashUntil = this.elapsedMs + BOSS_TUNING.DASH_DURATION_MS;
    this.dashInvulnerableUntil = this.elapsedMs + BOSS_TUNING.DASH_INVULNERABILITY_MS;
    this.nextDashAt = this.elapsedMs + BOSS_TUNING.DASH_COOLDOWN_MS;
    this.emitTrail();
    this.publishCooldowns();
  }

  emitTrail() {
    const trail = this.trails[this.trailIndex++ % this.trails.length];
    trail.setTexture(this.player.texture.key, this.player.frame.name)
      .setPosition(this.player.x, this.player.y).setVisible(true).setAlpha(0.45);
    trail.life = BOSS_TUNING.TRAIL_LIFE_MS;
    this.nextTrailAt = this.elapsedMs + BOSS_TUNING.TRAIL_INTERVAL_MS;
  }

  startSpecial() {
    if (this.specialCasting || this.elapsedMs < this.nextSpecialAt) return;
    this.specialCasting = true;
    this.specialFired = false;
    this.nextSpecialAt = this.elapsedMs + BOSS_TUNING.SPECIAL_COOLDOWN_MS;
    this.player.play(SPECIAL_ANIMATION);
    this.publishCooldowns();
  }

  fireSpecial() {
    this.specialFired = true;
    const bullet = this.specialBullets.getFirstDead(false);
    if (!bullet) return;
    bullet.hitBossOnce = false;
    bullet.enableBody(true, this.player.x + 32, this.player.y, true, true);
    bullet.setAlpha(1).setScale(this.crescentKey === 'fx_crescent' ? 1.35 : 1).setVelocity(BOSS_TUNING.SPECIAL_SPEED, 0);
    if (this.crescentKey === 'fx_crescent' && this.anims.exists('crescent-spin')) bullet.play('crescent-spin');
    AudioManager.sfx(this, 'sfx_player_shot');
  }

  publishCooldowns() {
    const special = Phaser.Math.Clamp(1 - (this.nextSpecialAt - this.elapsedMs) / BOSS_TUNING.SPECIAL_COOLDOWN_MS, 0, 1);
    const dash = Phaser.Math.Clamp(1 - (this.nextDashAt - this.elapsedMs) / BOSS_TUNING.DASH_COOLDOWN_MS, 0, 1);
    // El HUD dibuja ambas recargas (medidor del especial + indicador de dash).
    this.registry.set('special', { ratio: special, ready: special >= 1, label: 'Media luna', icon: 'crescent', dash });
    this.controls.touch.setCooldown('special', special);
    this.controls.touch.setCooldown('dash', dash);
    this.nextUiAt = this.elapsedMs + BOSS_TUNING.COOLDOWN_UI_MS;
  }

  /** All patterns use this pooled emitter; full circles exclude the repeated endpoint. */
  spawnBullets({ x, y, count, speed, angleStart, angleSpread, texture = ORBS.RED }) {
    if (this.finished || count < 1) return 0;
    const fullCircle = Math.abs(angleSpread) >= Math.PI * 2 - 0.0001;
    const step = angleSpread / (fullCircle ? count : Math.max(1, count - 1));
    let spawned = 0;
    for (let i = 0; i < count; i += 1) {
      const bullet = this.bossBullets.getFirstDead(false);
      if (!bullet) break;
      const angle = angleStart + i * step;
      bullet.setTexture(texture).setAlpha(1).setScale(1);
      bullet.enableBody(true, x, y, true, true);
      bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      spawned += 1;
    }
    return spawned;
  }

  patternSound() {
    if (this.elapsedMs < this.nextPatternSoundAt) return;
    AudioManager.sfx(this, 'sfx_boss_shot');
    this.nextPatternSoundAt = this.elapsedMs + 260;
  }

  showTelegraph(track, color) {
    const g = this.telegraphs[this.patterns.tracks.indexOf(track)];
    g.clear().setVisible(true).lineStyle(2, color, 0.75);
    const x = this.boss.x - 45;
    const y = this.boss.y;
    if (track.kind === 'lance') {
      g.lineBetween(x, y, x + Math.cos(track.angle) * 1100, y + Math.sin(track.angle) * 1100);
      g.strokeCircle(x, y, 20);
    } else if (track.kind === 'wall') {
      const half = BOSS_TUNING.WALL_GAP / 2;
      g.fillStyle(color, 0.09).fillRect(32, track.gap - half, 900, half * 2);
      g.lineBetween(32, track.gap - half, 932, track.gap - half);
      g.lineBetween(32, track.gap + half, 932, track.gap + half);
      g.lineStyle(4, color, 0.85).lineBetween(932, 64, 932, track.gap - half);
      g.lineBetween(932, track.gap + half, 932, 508);
    } else if (track.kind === 'fan') {
      for (const a of [track.angle - BOSS_TUNING.FAN_SPREAD / 2, track.angle + BOSS_TUNING.FAN_SPREAD / 2]) {
        g.lineBetween(x, y, x + Math.cos(a) * 160, y + Math.sin(a) * 160);
      }
    } else {
      g.strokeCircle(x, y, 42);
      if (track.kind === 'double' || track.kind === 'spiral') g.strokeCircle(x, y, 60);
    }
  }

  hideTelegraph(track) {
    this.telegraphs[this.patterns.tracks.indexOf(track)].clear();
  }

  clearTelegraphs() {
    for (const g of this.telegraphs) g.clear();
  }

  updateBossTint() {
    if (this.elapsedMs < this.bossFlashUntil) return;
    if (this.transitionRemaining > 0) { this.boss.setTint(0xf2b8ff); return; }
    for (const track of this.patterns.tracks) {
      if (track.kind && track.warning > 0) { this.boss.setTint(PATTERN_COLORS[track.kind]); return; }
    }
    this.boss.clearTint();
  }

  recycleBullets(group, delta) {
    for (const bullet of group.getChildren()) {
      if (!bullet.active) continue;
      if (bullet.dissolveRemaining > 0) {
        bullet.dissolveRemaining = Math.max(0, bullet.dissolveRemaining - delta);
        const ratio = bullet.dissolveRemaining / BOSS_TUNING.DISSOLVE_MS;
        bullet.setAlpha(ratio).setScale(0.15 + ratio * 0.85);
        if (!bullet.dissolveRemaining) bullet.disableBody(true, true);
      } else if (bullet.x < -80 || bullet.x > GAME_WIDTH + 80 || bullet.y < -80 || bullet.y > GAME_HEIGHT + 80) {
        bullet.disableBody(true, true);
      }
    }
  }

  publishBossHealth() {
    this.registry.set('bossHealth', { current: this.bossHealth, max: this.maxHealth, name: 'Morrigannus' });
  }

  hitBoss(a, b) {
    const bullet = a === this.boss ? b : a;
    if (this.finished || !bullet.active || !bullet.body.enable || bullet === this.boss || bullet.hitBossOnce) return;
    const special = bullet.isCrescent;
    if (special) bullet.hitBossOnce = true;
    else bullet.disableBody(true, true);
    const damage = BOSS_TUNING.SHOT_DAMAGE * (special ? BOSS_TUNING.SPECIAL_DAMAGE_MULT : 1);
    this.bossHealth = Math.max(0, this.bossHealth - damage);
    this.publishBossHealth();
    AudioManager.sfx(this, 'sfx_boss_hit');
    if (this.elapsedMs >= this.nextBossFlashAt) {
      this.boss.setTintFill(0xffe6ff);
      this.bossFlashUntil = this.elapsedMs + BOSS_TUNING.BOSS_FLASH_MS;
      this.nextBossFlashAt = this.elapsedMs + BOSS_TUNING.BOSS_FLASH_INTERVAL_MS;
    }
    if (special) {
      this.tweens.killTweensOf(this.damageText);
      this.damageText.setText(`−${damage}`).setPosition(this.boss.x - 80, this.player.y - 20)
        .setVisible(true).setAlpha(1);
      this.tweens.add({ targets: this.damageText, y: this.damageText.y - 55, alpha: 0, duration: 650 });
    }
    if (this.bossHealth === 0) this.win();
    else {
      const ratio = this.bossHealth / this.maxHealth;
      const phase = ratio <= BOSS_TUNING.PHASE_THRESHOLD_3 ? 3 : ratio <= BOSS_TUNING.PHASE_THRESHOLD_2 ? 2 : 1;
      if (phase > this.phase) this.changePhase(phase);
    }
  }

  eraseBullet(a, b) {
    const bullet = a.isCrescent ? b : a;
    if (!this.finished && bullet.active && bullet.body.enable) this.dissolveBullet(bullet);
  }

  hitPlayer(a, b) {
    const bullet = a === this.player ? b : a;
    if (this.finished || !bullet.active || !bullet.body.enable
      || this.elapsedMs < this.invulnerableUntil || this.elapsedMs < this.dashInvulnerableUntil) return;
    bullet.disableBody(true, true);
    this.hearts = Math.max(0, this.hearts - 1);
    this.registry.set('hearts', this.hearts);
    this.invulnerableUntil = this.elapsedMs + RULES.INVULNERABILITY_MS;
    AudioManager.sfx(this, 'sfx_player_hurt');
    this.cameras.main.shake(130, BOSS_TUNING.HIT_SHAKE);
    this.hitStop();
    if (this.hearts === 0) {
      this.finished = true;
      this.pendingDefeat = true;
      this.player.body.stop();
      this.patterns.reset();
      AudioManager.sfx(this, 'sfx_player_die');
    }
  }

  changePhase(phase) {
    this.phase = phase;
    this.phaseElapsedMs = 0;
    this.intensity = 0;
    this.transitionRemaining = BOSS_TUNING.PHASE_TRANSITION_MS;
    this.patterns.reset();
    this.dissolveBullets(this.bossBullets);
    this.dissolveBullets(this.playerBullets);
    this.dissolveBullets(this.specialBullets);
    this.phaseText.setText(`${phase === 2 ? 'II' : 'III'} · ${BOSS_TUNING.PHASES[phase - 1].name}`).setAlpha(1);
    this.cameras.main.flash(160, 90, 25, 65);
    this.cameras.main.shake(220, BOSS_TUNING.PHASE_SHAKE);
    this.hitStop();
    this.saveBest();
  }

  hitStop() {
    this.freezeRemaining = Math.max(this.freezeRemaining, BOSS_TUNING.HIT_STOP_MS);
    this.physics.world.pause();
    this.player.anims.pause();
    this.boss.anims.pause();
  }

  dissolveBullet(bullet) {
    if (!bullet.active || bullet.dissolveRemaining > 0) return;
    bullet.body.stop();
    bullet.body.enable = false;
    bullet.dissolveRemaining = BOSS_TUNING.DISSOLVE_MS;
  }

  dissolveBullets(group) {
    for (const bullet of group.getChildren()) this.dissolveBullet(bullet);
  }

  saveBest() {
    let best = 1 - this.bossHealth / this.maxHealth;
    try {
      const stored = Number(localStorage.getItem(BEST_KEY));
      if (Number.isFinite(stored)) best = Math.max(best, Phaser.Math.Clamp(stored, 0, 1));
      localStorage.setItem(BEST_KEY, String(best));
    } catch { /* Private mode / storage full: retry remains available. */ }
    return best;
  }

  win() {
    if (this.finished) return;
    this.finished = true;
    this.patterns.reset();
    this.player.body.stop();
    this.player.setAlpha(1).clearTint().play(FLY_ANIMATION);
    this.boss.body.enable = false;
    this.boss.clearTint();
    this.dissolveBullets(this.playerBullets);
    this.dissolveBullets(this.bossBullets);
    this.dissolveBullets(this.specialBullets);
    this.tweens.add({ targets: this.boss, alpha: 0, duration: 1200, ease: 'Sine.easeIn' });
    AudioManager.sfx(this, 'sfx_level_clear');
    this.saveBest();
    const timeBonus = Math.max(0, Math.floor(BOSS_TUNING.TIME_BONUS_LIMIT_SECONDS - this.elapsedMs / 1000))
      * BOSS_TUNING.SCORE_PER_SECOND;
    GameState.addScore(BOSS_TUNING.SCORE_BASE + this.hearts * BOSS_TUNING.SCORE_PER_HEART + timeBonus);
    // Morrigannus never contributes to enemiesKilled.
    this.time.delayedCall(BOSS_TUNING.VICTORY_DELAY_MS, () => {
      this.scene.stop(SCENES.HUD);
      const next = GameState.advanceStory();
      this.game.events.emit('story:goto', next);
    });
  }

  onShutdown() {
    this.finished = true;
    this.events.off('postupdate', this.syncHitPoint, this);
    this.player?.off(`animationcomplete-${CAST_ANIMATION}`, this.finishCast, this);
    this.player?.off(`animationcomplete-${SPECIAL_ANIMATION}`, this.finishSpecial, this);
    this.player?.off('animationupdate', this.onAnimationFrame, this);
    this.patterns?.destroy();
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.physics.world?.resume();
    this.freezeRemaining = 0;
    // KeyboardPlugin already destroys scene-owned Keys/listeners on shutdown.
    // ArcadePhysics can run its shutdown before ours and null out world.
    for (const collider of this.colliders) {
      if (collider.world?.scene) collider.destroy();
    }
    this.colliders.length = 0;
    this.backgrounds.length = this.trails.length = this.telegraphs.length = 0;
    this.registry.set('bossHealth', null);
    this.registry.set('special', null);
    if (import.meta.env.DEV && window.__boss === this) delete window.__boss;
    // Arcade/display-list shutdown owns bodies, pooled sprites and graphics.
  }
}
