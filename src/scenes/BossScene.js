import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, RULES, SCENES } from '../config/constants.js';
import { GameState } from '../managers/GameState.js';
import { AudioManager } from '../managers/AudioManager.js';
import { InputManager } from '../managers/InputManager.js';

export const BOSS_TUNING = Object.freeze({
  // 300 impactos / 1.5 impactos efectivos por segundo = 200 s (3 min 20 s).
  HEALTH: 3000,
  SHOT_DAMAGE: 10,
  PLAYER_SPEED: 245,
  PLAYER_SCALE: 0.95,
  PLAYER_HIT_RADIUS: 7, // Radio en pantalla; setCircle recibe píxeles del spritesheet.
  PLAYER_SHOT_SPEED: 520,
  PLAYER_SHOT_COOLDOWN_MS: 120,
  PLAYER_POOL_SIZE: 40,
  BOSS_POOL_SIZE: 384,
  INTENSITY_DURATION_MS: 180000,
  INTRO_MS: 2600,
  INTERVAL_START_MS: 1600,
  INTERVAL_END_MS: 550,
  FAN_COUNT_START: 3,
  FAN_COUNT_END: 9,
  RING_COUNT_START: 8,
  RING_COUNT_END: 22,
  BULLET_SPEED_START: 110,
  BULLET_SPEED_END: 210,
  FAN_SPREAD: Math.PI * 0.52,
  RING_ROTATION: 0.37,
  COMBINATION_START: 0.45,
  VICTORY_DELAY_MS: 2000,
  SCORE_BASE: 5000,
  SCORE_PER_HEART: 1000,
  TIME_BONUS_LIMIT_SECONDS: 240,
  SCORE_PER_SECOND: 10,
});

const ORBS = Object.freeze({
  FIRE: 'boss-orb-fire',
  RED: 'boss-orb-red',
  VIOLET: 'boss-orb-violet',
});
const FLY_ANIMATION = 'boss-aidan-fly';
const CAST_ANIMATION = 'boss-aidan-cast';

export default class BossScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOSS });
  }

  init() {
    this.hearts = RULES.PLAYER_HEARTS;
    this.bossHealth = BOSS_TUNING.HEALTH;
    this.elapsedMs = 0;
    this.intensity = 0;
    this.patternRemainingMs = BOSS_TUNING.INTRO_MS;
    this.patternIndex = 0;
    this.ringAngle = 0;
    this.combinationBudget = 0;
    this.nextShotAt = 0;
    this.invulnerableUntil = 0;
    this.bossFlashUntil = 0;
    this.nextBossFlashAt = 0;
    this.finished = false;
    this.backgrounds = [];
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
    this.boss.body.setAllowGravity(false);
    this.boss.body.setImmovable(true);
    this.boss.body.setSize(220, 500, true);
    this.boss.body.updateFromGameObject();

    // El torso está alrededor de (125, 132) en los frames de 250 x 250.
    // El origen coincide con la hitbox, también durante el lanzamiento.
    this.player = this.physics.add.sprite(170, GAME_HEIGHT / 2, 'aidan_fly')
      .setOrigin(125 / 250, 132 / 250).setScale(BOSS_TUNING.PLAYER_SCALE)
      .setDepth(5).play(FLY_ANIMATION);
    const radius = BOSS_TUNING.PLAYER_HIT_RADIUS / BOSS_TUNING.PLAYER_SCALE;
    this.player.body.setAllowGravity(false);
    this.player.body.setCircle(radius, 125 - radius, 132 - radius);
    this.player.body.setBoundsRectangle(new Phaser.Geom.Rectangle(
      32, 64, GAME_WIDTH * 2 / 3 - 32, GAME_HEIGHT - 96,
    ));
    this.player.setCollideWorldBounds(true);
    this.player.body.updateFromGameObject();
    this.player.on(`animationcomplete-${CAST_ANIMATION}`, this.finishCast, this);
    this.hitPoint = this.add.circle(this.player.x, this.player.y, 3, 0xfff9cf)
      .setStrokeStyle(2, 0xff8b32).setDepth(8);
    // postupdate sigue al sprite después de que Arcade sincronice cuerpo y dibujo.
    this.events.on('postupdate', this.syncHitPoint, this);

    this.playerBullets = this.createBulletPool(ORBS.FIRE, BOSS_TUNING.PLAYER_POOL_SIZE);
    this.bossBullets = this.createBulletPool(ORBS.RED, BOSS_TUNING.BOSS_POOL_SIZE);
    this.physics.add.overlap(this.playerBullets, this.boss, this.hitBoss, undefined, this);
    this.physics.add.overlap(this.player, this.bossBullets, this.hitPlayer, undefined, this);

    this.controls = new InputManager(this, 'boss');
    this.registry.set('hearts', this.hearts);
    this.publishBossHealth();
    this.scene.launch(SCENES.HUD, { mode: 'boss' });
    AudioManager.playMusic(this, 'music_boss');

    const instructions = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 52,
      'WASD: volar · J: disparar · Esquiva los orbes', {
        fontFamily: 'Arial, sans-serif', fontSize: '21px', color: '#ffffff',
        backgroundColor: '#160d28', padding: { x: 18, y: 12 },
      }).setOrigin(0.5).setDepth(10);
    this.tweens.add({
      targets: instructions, alpha: 0, delay: 2300, duration: 300,
      onComplete: () => instructions.destroy(),
    });

    if (import.meta.env.DEV) window.__boss = this;
  }

  createAnimations() {
    const definitions = [
      ['boss-idle', 'boss_idle', 8, -1],
      [FLY_ANIMATION, 'aidan_fly', 10, -1],
      [CAST_ANIMATION, 'aidan_fly_cast', 32, 0],
    ];
    for (const [key, texture, frameRate, repeat] of definitions) {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key, frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 7 }),
          frameRate, repeat,
        });
      }
    }
  }

  createOrbTextures() {
    const palettes = [
      [ORBS.FIRE, 0xff681d, 0xffba32, 0xfff5ba],
      [ORBS.RED, 0xe81762, 0xff496c, 0xffdcf0],
      [ORBS.VIOLET, 0x792eff, 0xc070ff, 0xf4dcff],
    ];
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
    graphics.destroy();
  }

  createBulletPool(texture, maxSize) {
    const group = this.physics.add.group({ defaultKey: texture, maxSize });
    // Precalentar evita crear sprites/cuerpos durante los patrones o update().
    group.createMultiple({ key: texture, quantity: maxSize, active: false, visible: false });
    const bullets = group.getChildren();
    for (let i = 0; i < bullets.length; i += 1) {
      const bullet = bullets[i];
      bullet.body.setAllowGravity(false);
      bullet.body.setCircle(6, 10, 10);
      bullet.setDepth(6);
      bullet.disableBody(true, true);
    }
    return group;
  }

  update(_time, delta) {
    const seconds = delta / 1000;
    for (let i = 0; i < this.backgrounds.length; i += 1) {
      this.backgrounds[i].tilePositionX += seconds * (4 + i * 6);
    }
    if (this.finished) return;

    this.controls.update();
    if (this.controls.justPressed('pause')) {
      this.scene.launch(SCENES.PAUSE, { from: SCENES.BOSS });
      this.scene.pause();
      return;
    }

    // Tiempo de simulación: la pausa no acelera patrones, cooldown ni invulnerabilidad.
    this.elapsedMs += delta;
    this.intensity = Phaser.Math.Clamp(this.elapsedMs / BOSS_TUNING.INTENSITY_DURATION_MS, 0, 1);
    this.player.body.setVelocity(this.controls.axisX(), this.controls.axisY());
    this.player.body.velocity.normalize().scale(BOSS_TUNING.PLAYER_SPEED);
    if (this.controls.justPressed('attack')) this.firePlayerShot();

    if (this.elapsedMs < this.invulnerableUntil) {
      const progress = (this.invulnerableUntil - this.elapsedMs) / RULES.INVULNERABILITY_MS;
      this.player.setAlpha(0.4 + 0.6 * Math.pow(Math.cos(progress * Math.PI * 3), 2));
    } else {
      this.player.setAlpha(1);
    }
    if (this.bossFlashUntil && this.elapsedMs >= this.bossFlashUntil) {
      this.boss.clearTint();
      this.bossFlashUntil = 0;
    }

    this.patternRemainingMs -= delta;
    if (this.patternRemainingMs <= 0) {
      this.fireBossPattern();
      // Sin ráfagas de recuperación si un frame se demora.
      this.patternRemainingMs = Phaser.Math.Linear(
        BOSS_TUNING.INTERVAL_START_MS, BOSS_TUNING.INTERVAL_END_MS, this.intensity,
      );
    }
    this.recycleBullets(this.playerBullets);
    this.recycleBullets(this.bossBullets);
  }

  syncHitPoint() {
    this.hitPoint.setPosition(this.player.x, this.player.y);
  }

  finishCast() {
    if (!this.finished) this.player.play(FLY_ANIMATION);
  }

  firePlayerShot() {
    if (this.finished || this.elapsedMs < this.nextShotAt) return;
    const bullet = this.playerBullets.getFirstDead(false);
    if (!bullet) return;
    bullet.enableBody(true, this.player.x + 28, this.player.y, true, true);
    bullet.body.setAllowGravity(false);
    bullet.setVelocity(BOSS_TUNING.PLAYER_SHOT_SPEED, 0);
    this.nextShotAt = this.elapsedMs + BOSS_TUNING.PLAYER_SHOT_COOLDOWN_MS;
    this.player.play(CAST_ANIMATION);
    AudioManager.sfx(this, 'sfx_player_shot');
  }

  /** Ángulos en radianes; un círculo completo excluye el extremo duplicado. */
  spawnBullets({ x, y, count, speed, angleStart, angleSpread, texture = ORBS.RED }) {
    if (this.finished || count < 1) return 0;
    const fullCircle = Math.abs(angleSpread) >= Math.PI * 2 - 0.0001;
    const step = angleSpread / (fullCircle ? count : Math.max(1, count - 1));
    let spawned = 0;
    for (let i = 0; i < count; i += 1) {
      const bullet = this.bossBullets.getFirstDead(false);
      if (!bullet) break;
      const angle = angleStart + i * step;
      bullet.setTexture(texture);
      bullet.enableBody(true, x, y, true, true);
      bullet.body.setAllowGravity(false);
      bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      spawned += 1;
    }
    return spawned;
  }

  fireBossPattern() {
    const tuning = BOSS_TUNING;
    const speed = Phaser.Math.Linear(tuning.BULLET_SPEED_START, tuning.BULLET_SPEED_END, this.intensity);
    const fanCount = Math.round(Phaser.Math.Linear(tuning.FAN_COUNT_START, tuning.FAN_COUNT_END, this.intensity));
    const ringCount = Math.round(Phaser.Math.Linear(tuning.RING_COUNT_START, tuning.RING_COUNT_END, this.intensity));
    // Acumulador continuo: las combinaciones aparecen cada vez más a menudo.
    this.combinationBudget += Phaser.Math.Clamp(
      (this.intensity - tuning.COMBINATION_START) / (1 - tuning.COMBINATION_START), 0, 1,
    );
    const combine = this.combinationBudget >= 1;
    if (combine) this.combinationBudget -= 1;
    const isRing = this.patternIndex % 3 === 2;
    let spawned = 0;
    const x = this.boss.x - 45;
    const y = this.boss.y;
    if (!isRing || combine) {
      const aim = Math.atan2(this.player.y - y, this.player.x - x);
      spawned += this.spawnBullets({
        x, y, count: fanCount, speed, angleStart: aim - tuning.FAN_SPREAD / 2,
        angleSpread: tuning.FAN_SPREAD, texture: ORBS.RED,
      });
    }
    if (isRing || combine) {
      spawned += this.spawnBullets({
        x, y, count: ringCount, speed: speed * 0.9, angleStart: this.ringAngle,
        angleSpread: Math.PI * 2, texture: ORBS.VIOLET,
      });
      this.ringAngle = (this.ringAngle + tuning.RING_ROTATION) % (Math.PI * 2);
    }
    this.patternIndex += 1;
    if (spawned) AudioManager.sfx(this, 'sfx_boss_shot');
  }

  recycleBullets(group) {
    const bullets = group.getChildren();
    for (let i = 0; i < bullets.length; i += 1) {
      const bullet = bullets[i];
      if (bullet.active && (bullet.x < -32 || bullet.x > GAME_WIDTH + 32
        || bullet.y < -32 || bullet.y > GAME_HEIGHT + 32)) {
        bullet.disableBody(true, true);
      }
    }
  }

  publishBossHealth() {
    this.registry.set('bossHealth', {
      current: this.bossHealth, max: BOSS_TUNING.HEALTH, name: 'Morrigannus',
    });
  }

  hitBoss(bullet) {
    if (this.finished || !bullet.active) return;
    bullet.disableBody(true, true);
    this.bossHealth = Math.max(0, this.bossHealth - BOSS_TUNING.SHOT_DAMAGE);
    this.publishBossHealth();
    AudioManager.sfx(this, 'sfx_boss_hit');
    // Como máximo 3 destellos/s incluso si el jugador dispara muy rápido.
    if (this.elapsedMs >= this.nextBossFlashAt) {
      this.boss.setTintFill(0xffe6ff);
      this.bossFlashUntil = this.elapsedMs + 70;
      this.nextBossFlashAt = this.elapsedMs + 360;
    }
    if (this.bossHealth === 0) this.win();
  }

  hitPlayer(_player, bullet) {
    if (this.finished || !bullet.active || this.elapsedMs < this.invulnerableUntil) return;
    bullet.disableBody(true, true);
    this.hearts = Math.max(0, this.hearts - 1);
    this.registry.set('hearts', this.hearts);
    this.invulnerableUntil = this.elapsedMs + RULES.INVULNERABILITY_MS;
    AudioManager.sfx(this, 'sfx_player_hurt');
    if (this.hearts === 0) {
      this.finished = true;
      this.player.body.stop();
      AudioManager.sfx(this, 'sfx_player_die');
      this.scene.stop(SCENES.HUD);
      this.scene.start(SCENES.GAME_OVER, { retryScene: SCENES.BOSS, retryData: {} });
    }
  }

  dissolveBullets(group) {
    const active = [];
    const bullets = group.getChildren();
    for (let i = 0; i < bullets.length; i += 1) {
      const bullet = bullets[i];
      if (!bullet.active) continue;
      bullet.body.stop();
      bullet.body.enable = false;
      active.push(bullet);
    }
    if (!active.length) return;
    this.tweens.add({
      targets: active, alpha: 0, scaleX: 0.15, scaleY: 0.15,
      duration: 550, ease: 'Sine.easeOut',
      onComplete: () => {
        for (const bullet of active) {
          bullet.disableBody(true, true);
          bullet.setAlpha(1).setScale(1);
        }
      },
    });
  }

  win() {
    if (this.finished) return;
    this.finished = true;
    this.player.body.stop();
    this.player.setAlpha(1).play(FLY_ANIMATION);
    this.boss.body.enable = false;
    this.boss.clearTint();
    this.dissolveBullets(this.playerBullets);
    this.dissolveBullets(this.bossBullets);
    this.tweens.add({ targets: this.boss, alpha: 0, duration: 1200, ease: 'Sine.easeIn' });
    AudioManager.sfx(this, 'sfx_level_clear');
    const timeBonus = Math.max(0, Math.floor(
      BOSS_TUNING.TIME_BONUS_LIMIT_SECONDS - this.elapsedMs / 1000,
    )) * BOSS_TUNING.SCORE_PER_SECOND;
    GameState.addScore(BOSS_TUNING.SCORE_BASE + this.hearts * BOSS_TUNING.SCORE_PER_HEART + timeBonus);
    // El jefe obligatorio no altera el contador de enemigos de la ruta narrativa.
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
    this.time.removeAllEvents();
    this.tweens.killAll();
    // Arcade elimina sus pools/overlaps y InputManager limpia sus listeners al shutdown.
    this.registry.set('bossHealth', null);
    if (import.meta.env.DEV && window.__boss === this) delete window.__boss;
  }
}
