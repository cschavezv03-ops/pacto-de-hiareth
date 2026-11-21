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
    // Salto hacia Aidan (anti-speedrun): aviso visible y luego un brinco esquivable.
    // Pensado para poder esquivarse sin matar (ruta pacifista): aviso de 0.45 s, se puede pasar
    // por debajo durante el salto (≈100 px de alto) y hay 2.3-3 s de calma tras aterrizar.
    leap: { range: 170, windupMs: 450, vy: -430, maxVx: 200, cooldownMs: [2300, 3000] },
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
    spreadEvery: 3,            // cada 3.er disparo: abanico de 3 si Aidan está cerca
    spreadRange: 460,
    spreadAngle: 0.28,         // rad entre proyectiles
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
    // Tajo con la rama (anti-speedrun): aviso rojo, luego zona de daño frente a él.
    // Aviso total ≈0.54 s (tinte rojo + preparación) y 1.6-2.2 s de calma: se salta por encima.
    swing: { range: 95, windupMs: 250, reach: 74, height: 70, activeFrames: [4, 5], cooldownMs: [1600, 2200] },
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
    this.action = null;         // null | 'windup' | 'leap' | 'swing'
    this.actionUntil = 0;
    this.nextAction = scene.time.now + Phaser.Math.Between(600, 1400);

    // Zona de daño del tajo del esqueleto (overlap con Aidan en LevelScene).
    if (cfg.swing && spec.hitboxes) {
      this.swingZone = scene.add.zone(spec.x, spec.y, cfg.swing.reach, cfg.swing.height);
      scene.physics.add.existing(this.swingZone);
      this.swingZone.body.setAllowGravity(false);
      this.swingZone.body.enable = false;
      this.swingZone.owner = this;
      spec.hitboxes.add(this.swingZone);
      this.swingZone.body.setAllowGravity(false);
      this.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAttackFrame, this);
    }

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
    if (this.updateAction(time, player)) return;

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
    const landing = time < (this.landingUntil ?? 0);
    const busy = landing || ((cur === cfg.anims.attack || cur === 'alien-charge') && this.anims.isPlaying);
    if (!busy) {
      const want = speed === 0 ? cfg.anims.idle : cfg.anims.move;
      if (cur !== want) this.play(want, true);
    }
  }

  /**
   * Acciones ofensivas sencillas (slime: salto, esqueleto: tajo). Siempre con aviso
   * previo, y sin salir nunca de su zona. Devuelve true si controla el movimiento.
   */
  updateAction(time, player) {
    const cfg = this.cfg;
    const body = this.body;
    if (!player || player.dead || cfg.flying) return false;
    const dx = player.x - this.x;
    const dy = Math.abs(player.y - this.y);
    const inZone = player.x >= this.minX - 60 && player.x <= this.maxX + 60;

    if (this.action === null) {
      const a = cfg.leap ?? cfg.swing;
      if (!a || time < this.nextAction || !inZone || dy > 80 || Math.abs(dx) > a.range) return false;
      if (cfg.leap && !(body.blocked.down || body.touching.down)) return false;
      this.action = 'windup';
      this.actionUntil = time + a.windupMs;
      this.dir = Math.sign(dx) || this.dir;
      this.setFlipX(this.dir < 0);
      body.setVelocityX(0);
      this.telegraph(a.windupMs, cfg.leap ? 0xffb347 : 0xff4d4d);
      if (cfg.swing) this.play(this.scene.anims.exists('skeleton-windup') ? 'skeleton-windup' : cfg.anims.idle, true);
      if (cfg.leap) this.useLeapFrame(0);
      return true;
    }

    if (this.action === 'windup') {
      body.setVelocityX(0);
      if (cfg.leap) this.useLeapFrame((this.actionUntil - time) < cfg.leap.windupMs / 2 ? 1 : 0);
      if (time < this.actionUntil) return true;
      if (cfg.leap) {
        this.action = 'leap';
        const vx = Phaser.Math.Clamp(dx * 1.6, -cfg.leap.maxVx, cfg.leap.maxVx);
        body.setVelocity(vx, cfg.leap.vy);
        this.actionUntil = time + 180; // margen antes de comprobar el aterrizaje
      } else {
        this.action = 'swing'; // el daño lo activan los frames 4-5 del ataque (≈0.29 s después)
        this.play(cfg.anims.attack, true);
      }
      return true;
    }

    if (this.action === 'leap') {
      // Frames del salto ligados a la velocidad vertical (no a un temporizador).
      const vy = body.velocity.y;
      this.useLeapFrame(vy < -220 ? 2 : vy < -40 ? 3 : vy < 120 ? 4 : 5);
      // No sale de su zona aunque esté en el aire.
      if ((this.x <= this.minX && body.velocity.x < 0) || (this.x >= this.maxX && body.velocity.x > 0)) body.setVelocityX(0);
      if (time > this.actionUntil && (body.blocked.down || body.touching.down)) {
        this.endAction(time, cfg.leap.cooldownMs);
        this.playLanding();
      }
      return true;
    }

    if (this.action === 'swing') {
      body.setVelocityX(0);
      if (!this.anims.isPlaying || this.anims.currentAnim?.key !== cfg.anims.attack) this.endAction(time, cfg.swing.cooldownMs);
      return true;
    }
    return false;
  }

  /** Muestra un frame concreto de la animación de salto del slime (si existe el sprite). */
  useLeapFrame(i) {
    if (!this.scene.textures.exists('slime_leap')) return;
    if (this.anims.isPlaying) this.anims.stop();
    if (this.texture.key !== 'slime_leap' || this.frame.name !== i) this.setTexture('slime_leap', i);
  }

  playLanding() {
    if (!this.scene.textures.exists('slime_leap')) return;
    this.landingUntil = this.scene.time.now + 220;
    this.setTexture('slime_leap', 6);
    this.scene.time.delayedCall(110, () => { if (this.alive && this.texture.key === 'slime_leap') this.setTexture('slime_leap', 7); });
  }

  endAction(time, [min, max]) {
    this.action = null;
    this.nextAction = time + Phaser.Math.Between(min, max);
    if (this.swingZone) this.swingZone.body.enable = false;
  }

  /** Aviso visual: parpadeo de color + "agacharse" (squash) antes de atacar. */
  telegraph(ms, color) {
    const sx = this.scaleX;
    const sy = this.scaleY;
    this.setTint(color);
    this.scene.tweens.add({
      targets: this, scaleX: sx * 1.12, scaleY: sy * 0.86, duration: ms * 0.8, yoyo: false, ease: 'Sine.Out',
      onComplete: () => { if (this.active) this.setScale(sx, sy); },
    });
    this.scene.time.delayedCall(ms, () => { if (this.alive) this.clearTint(); });
  }

  onAttackFrame(anim, frame) {
    if (!this.swingZone || anim.key !== this.cfg.anims.attack) return;
    const [a, b] = this.cfg.swing.activeFrames;
    const i = frame.index - 1;
    const active = this.alive && this.action === 'swing' && i >= a && i <= b;
    this.swingZone.body.enable = active;
    if (active) {
      this.swingZone.setPosition(this.x + this.dir * (this.cfg.swing.reach / 2 + 14), this.y - 40);
      this.swingZone.body.reset(this.swingZone.x, this.swingZone.y);
    }
  }

  /**
   * Golpe de Aidan. Devuelve true si este golpe mató al enemigo.
   * @param {number} attackId identificador del golpe (un impacto por golpe)
   * @param {number} fromX posición de Aidan
   */
  hit(attackId, fromX, damage = 1) {
    if (!this.alive || attackId === this.lastHitAttackId) return false;
    this.lastHitAttackId = attackId;
    this.hp -= damage;
    const away = Math.sign(this.x - fromX) || 1;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.alive && this.clearTint());

    if (this.hp <= 0) {
      this.kill(true);
      return true;
    }
    AudioManager.sfx(this.scene, 'sfx_enemy_hit');
    this.state = 'hurt';
    if (this.action) this.endAction(this.scene.time.now, [700, 1100]); // golpearle interrumpe su ataque
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
    if (this.swingZone) this.swingZone.body.enable = false;
    this.action = null;
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

  preDestroy() {
    this.swingZone?.destroy();
    super.preDestroy?.();
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
    this.shotCount = 0;
  }

  update(time, player) {
    super.update(time, player);
    if (!this.alive || !player || player.dead) return;
    // Aviso del disparo triple: carga visible ~0.45 s antes.
    const nextIsSpread = (this.shotCount + 1) % this.cfg.spreadEvery === 0
      && Math.abs(player.x - this.x) < this.cfg.spreadRange;
    if (nextIsSpread && !this.charging && time >= this.nextShot - 450 && this.scene.anims.exists('alien-charge')) {
      this.charging = true;
      this.play('alien-charge', true);
    }
    if (time >= this.nextShot) {
      this.charging = false;
      this.nextShot = time + this.cfg.shootIntervalMs; // intervalo fijo
      // Solo dispara si Aidan está en pantalla (evita balas "invisibles" desde lejos).
      if (this.scene.cameras.main.worldView.contains(this.x, this.y)) this.shoot(player);
    }
  }

  shoot(player) {
    const muzzleY = this.y - this.displayHeight * 0.55;
    // Trayectoria fija hacia la posición actual de Aidan; no corrige el rumbo.
    const angle = Phaser.Math.Angle.Between(this.x, muzzleY, player.x, player.y - 36);
    this.shotCount += 1;
    const near = Math.abs(player.x - this.x) < this.cfg.spreadRange;
    const spread = near && this.shotCount % this.cfg.spreadEvery === 0;
    const offsets = spread ? [-this.cfg.spreadAngle, 0, this.cfg.spreadAngle] : [0];
    for (const off of offsets) this.fireOrb(muzzleY, angle + off);
    this.setFlipX(player.x < this.x);
    if (this.cfg.anims.attack) this.play(this.cfg.anims.attack, true);
  }

  fireOrb(muzzleY, angle) {
    const orb = this.projectiles.get(this.x, muzzleY, 'orb_alien');
    if (!orb) return;
    orb.enableBody(true, this.x, muzzleY, true, true);
    orb.body.setAllowGravity(false);
    orb.body.setCircle(6, 6, 6);
    this.scene.physics.velocityFromRotation(angle, this.cfg.projectileSpeed, orb.body.velocity);
    orb.expireAt = this.scene.time.now + this.cfg.projectileLifeMs;
    AudioManager.sfx(this.scene, 'sfx_alien_shot', { volume: 0.5 });
  }
}
