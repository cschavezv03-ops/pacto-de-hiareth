import Phaser from 'phaser';
import { RULES, enemyHits } from '../config/constants.js';
import { AudioManager } from '../managers/AudioManager.js';
import { GameState } from '../managers/GameState.js';

/**
 * Configuración por tipo de enemigo. La resistencia (golpes) es una decisión
 * confirmada (RULES.ENEMY_HITS); el resto son parámetros de balance de Sebas.
 */
export const ENEMY_TYPES = {
  slime: {
    hits: RULES.ENEMY_HITS.slime,
    texture: 'slime_idle',
    scale: 2.7,
    body: { w: 22, h: 16, ox: 21, oy: 26 },  // en px del frame 64x64
    footY: 42,                               // línea base dentro del frame
    speed: 55,
    anims: { idle: 'slime-idle', move: 'slime-walk', hurt: 'slime-hurt', death: 'slime-death' },
    flying: false,
  },
  alien: {
    hits: RULES.ENEMY_HITS.alien,
    texture: 'alien_idle',
    scale: 0.5,
    body: { w: 90, h: 150, ox: 83, oy: 90 }, // en px del frame 256x256
    footY: 248,
    speed: 60,
    anims: { idle: 'alien-idle', move: 'alien-walk', hurt: 'alien-hurt', death: 'alien-death', attack: 'alien-attack' },
    flying: true,              // flota sobre su plataforma voladora
    shootIntervalMs: 2600,     // temporizador fijo
    projectileSpeed: 150,      // lento y esquivable
    projectileLifeMs: 6000,
  },
  skeleton: {
    hits: RULES.ENEMY_HITS.skeleton,
    texture: 'skeleton_idle',
    scale: 0.5,
    body: { w: 80, h: 160, ox: 88, oy: 88 },
    footY: 248,
    speed: 50,
    chaseSpeed: 95,
    aggroRange: 230,           // se acerca a Aidan solo dentro de su zona
    anims: { idle: 'skeleton-idle', move: 'skeleton-walk', hurt: 'skeleton-hurt', death: 'skeleton-death', attack: 'skeleton-attack' },
    flying: false,
  },
};

/**
 * Enemigo genérico con patrulla dentro de una zona fija [minX, maxX].
 * Nunca abandona su zona, así que no persigue indefinidamente a Aidan.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} spec { type, x, y, minX, maxX }
   */
  constructor(scene, spec) {
    const cfg = ENEMY_TYPES[spec.type];
    super(scene, spec.x, spec.y, cfg.texture, 0);
    this.cfg = cfg;
    this.kind = spec.type;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(cfg.scale);
    // Origen en los pies para colocar al enemigo sobre el suelo con precisión.
    this.setOrigin(0.5, cfg.footY / this.height);
    this.body.setSize(cfg.body.w, cfg.body.h);
    this.body.setOffset(cfg.body.ox, cfg.body.oy);
    // No usar setImmovable: dos cuerpos inmóviles (enemigo + suelo estático) no se separan.
    this.body.pushable = false;

    if (cfg.flying) {
      this.body.setAllowGravity(false);
      this.baseY = spec.y;
    }

    // Resistencia según la dificultad (Intermedio = valores del documento: 4/6/8).
    this.hp = enemyHits(spec.type, GameState.difficulty.id);
    this.maxHp = this.hp;
    this.minX = spec.minX;
    this.maxX = spec.maxX;
    this.dir = Phaser.Math.Between(0, 1) ? 1 : -1;
    this.state = 'patrol';
    this.stunUntil = 0;
    this.lastHitAttackId = -1;
    this.pauseUntil = 0;
    this.alive = true;
    this.spawnTime = scene.time.now;

    this.play(cfg.anims.move);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onAnimComplete, this);
  }

  /** IA sencilla: patrulla, pausa ocasional y (esqueleto) aproximación en zona. */
  update(time, player) {
    if (!this.alive) return;
    const cfg = this.cfg;
    const body = this.body;

    if (time < this.stunUntil) {
      body.setVelocityX(body.velocity.x * 0.9);
      return;
    }
    if (this.state === 'hurt') {
      this.state = 'patrol';
      this.play(cfg.anims.move, true);
    }

    let speed = cfg.speed;
    const px = player?.x ?? -9999;
    const inZone = px >= this.minX - 40 && px <= this.maxX + 40;
    const dx = px - this.x;

    if (cfg.aggroRange && player && !player.dead && inZone && Math.abs(dx) < cfg.aggroRange
        && Math.abs(player.y - this.y) < 120) {
      // Aproximación sencilla, limitada a su zona.
      this.dir = Math.sign(dx) || this.dir;
      speed = cfg.chaseSpeed;
    } else if (time < this.pauseUntil) {
      speed = 0;
    } else if (Math.random() < 0.003) {
      this.pauseUntil = time + Phaser.Math.Between(500, 1200);
    }

    // Límites de la zona.
    if (this.x <= this.minX) this.dir = 1;
    else if (this.x >= this.maxX) this.dir = -1;
    if ((this.x <= this.minX && this.dir < 0) || (this.x >= this.maxX && this.dir > 0)) speed = 0;

    body.setVelocityX(this.dir * speed);
    this.setFlipX(this.dir < 0);

    if (cfg.flying) {
      // Flotación suave sobre la plataforma voladora.
      this.y = this.baseY + Math.sin((time - this.spawnTime) / 380) * 6;
    }

    const cur = this.anims.currentAnim?.key;
    const busy = cur === cfg.anims.attack && this.anims.isPlaying;
    if (!busy) {
      const want = speed === 0 ? cfg.anims.idle : cfg.anims.move;
      if (cur !== want) this.play(want, true);
    }
  }

  /**
   * Golpe de Aidan. Devuelve true si este golpe mató al enemigo.
   * @param {number} attackId identificador del golpe (un impacto por golpe)
   * @param {number} fromX posición de Aidan
   */
  hit(attackId, fromX) {
    if (!this.alive || attackId === this.lastHitAttackId) return false;
    this.lastHitAttackId = attackId;
    this.hp -= 1;
    const away = Math.sign(this.x - fromX) || 1;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.alive && this.clearTint());

    if (this.hp <= 0) {
      this.kill(true);
      return true;
    }
    AudioManager.sfx(this.scene, 'sfx_enemy_hit');
    this.state = 'hurt';
    this.stunUntil = this.scene.time.now + 260;
    this.body.setVelocityX(away * 140);
    this.play(this.cfg.anims.hurt, true);
    return false;
  }

  /**
   * Muerte del enemigo.
   * @param {boolean} byPlayer true solo si Aidan lo derrotó directamente.
   */
  kill(byPlayer) {
    if (!this.alive) return;
    this.alive = false;
    this.body.enable = false;
    this.clearTint();
    if (byPlayer) {
      AudioManager.sfx(this.scene, 'sfx_enemy_die');
      this.scene.events.emit('enemy:killed', this);
    }
    if (this.anims.animationManager.exists(this.cfg.anims.death)) {
      this.play(this.cfg.anims.death, true);
    } else {
      this.onAnimComplete({ key: this.cfg.anims.death });
    }
  }

  onAnimComplete(anim) {
    if (anim.key === this.cfg.anims.death) {
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 400, onComplete: () => this.destroy() });
    }
  }
}

/** Alien: patrulla flotando y dispara cada X ms hacia la posición ACTUAL de Aidan. */
export class Alien extends Enemy {
  constructor(scene, spec, projectiles) {
    super(scene, { ...spec, type: 'alien' });
    this.projectiles = projectiles;
    // Desfase aleatorio para que no disparen todos a la vez.
    this.nextShot = scene.time.now + Phaser.Math.Between(800, this.cfg.shootIntervalMs);
  }

  update(time, player) {
    super.update(time, player);
    if (!this.alive || !player || player.dead) return;
    if (time >= this.nextShot) {
      this.nextShot = time + this.cfg.shootIntervalMs; // intervalo fijo
      // Solo dispara si Aidan está en pantalla (evita balas "invisibles" desde lejos).
      if (this.scene.cameras.main.worldView.contains(this.x, this.y)) this.shoot(player);
    }
  }

  shoot(player) {
    const muzzleY = this.y - this.displayHeight * 0.55;
    const orb = this.projectiles.get(this.x, muzzleY, 'orb_alien');
    if (!orb) return;
    orb.enableBody(true, this.x, muzzleY, true, true);
    orb.body.setAllowGravity(false);
    orb.body.setCircle(6, 6, 6);
    // Trayectoria fija hacia la posición actual de Aidan; no corrige el rumbo.
    const angle = Phaser.Math.Angle.Between(this.x, muzzleY, player.x, player.y - 36);
    this.scene.physics.velocityFromRotation(angle, this.cfg.projectileSpeed, orb.body.velocity);
    orb.expireAt = this.scene.time.now + this.cfg.projectileLifeMs;
    this.setFlipX(player.x < this.x);
    if (this.cfg.anims.attack) this.play(this.cfg.anims.attack, true);
    AudioManager.sfx(this.scene, 'sfx_alien_shot', { volume: 0.5 });
  }
}
