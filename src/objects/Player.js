import Phaser from 'phaser';
import { RULES } from '../config/constants.js';
import { AudioManager } from '../managers/AudioManager.js';

/**
 * Parámetros de movimiento (decididos por Sebas; ver docs/BALANCE.md).
 * Unidades: px y segundos. Tile = 32 px. Gravedad del mundo = 900 px/s².
 */
export const PLAYER_TUNING = Object.freeze({
  scale: 1.0,
  runSpeed: 250,
  groundAccel: 3200,      // llega a velocidad máxima en ~0.08 s
  groundDecel: 3600,
  airAccelMult: 0.7,
  jumpHeight: 150,        // apex medido ≈4.1 tiles (la caída asimétrica recorta algo)
  timeToApex: 0.38,
  fallGravityMult: 1.7,
  jumpCut: 0.5,           // al soltar Espacio mientras sube
  maxFall: 820,           // < medio tile por tick a 60 Hz
  coyoteMs: 100,
  bufferMs: 120,
  attackMoveMult: 0.35,   // velocidad mientras ataca
  attackActiveFrom: 2,    // frames activos del golpe (de 8)
  attackActiveTo: 5,
  attackReach: 66,
  attackHeight: 64,
  // Fuego fantasma (ataque a distancia con recarga; pedido del equipo tras las pruebas)
  specialCooldownMs: 6500,
  specialSpawnFrame: 4,   // frame de Attack2 en el que sale la llamarada
  // Agacharse (S / ↓ / botón ▼): hitbox más baja para esquivar ataques altos.
  standBody: { w: 38, h: 76, ox: 106, oy: 91 },
  crouchBody: { w: 40, h: 44, ox: 105, oy: 123 },
  knockbackX: 200,
  knockbackY: -260,
});

const WORLD_GRAVITY = 900;
const RISE_GRAVITY = (2 * PLAYER_TUNING.jumpHeight) / PLAYER_TUNING.timeToApex ** 2;
const JUMP_VELOCITY = -(2 * PLAYER_TUNING.jumpHeight) / PLAYER_TUNING.timeToApex;

/**
 * Aidan en los niveles de plataformas.
 * Emite eventos en la escena:
 *   'player:hearts' (n)       -> cambia la vida
 *   'player:dead'             -> terminó la animación de muerte
 *   'player:attack-hit' (enemy) se gestiona desde la escena con overlap del hitbox.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, input) {
    super(scene, x, y, 'aidan_idle', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.controls = input;

    this.setScale(PLAYER_TUNING.scale);
    this.setOrigin(0.5, 167 / 250); // origen en los pies
    // Hitbox en coordenadas del frame (250x250): cuerpo ~40x78, pies en y=167.
    this.body.setSize(PLAYER_TUNING.standBody.w, PLAYER_TUNING.standBody.h);
    this.body.setOffset(PLAYER_TUNING.standBody.ox, PLAYER_TUNING.standBody.oy);
    this.crouching = false;
    this.body.setMaxVelocity(PLAYER_TUNING.runSpeed * 2, PLAYER_TUNING.maxFall);
    this.setCollideWorldBounds(true);
    this.body.onWorldBounds = false;

    this.hearts = RULES.PLAYER_HEARTS;
    this.invulnerableUntil = 0;
    this.facing = 1;
    this.attacking = false;
    this.attackVariant = 0;
    this.attackId = 0;
    this.hitAnimUntil = 0;
    // Reloj propio: solo avanza mientras la escena se actualiza, así la pausa
    // no consume la invulnerabilidad ni las ventanas de coyote/buffer.
    this.clock = 0;
    this.specialReadyAt = 0; // listo desde el inicio del nivel
    this.casting = false;
    this.dead = false;
    this.lastGroundTime = -Infinity;
    this.lastJumpPress = -Infinity;
    this.lastSafe = { x, y }; // lo actualiza LevelScene solo sobre suelo firme

    // Zona de golpe melee (sin gravedad, solo overlap).
    this.attackZone = scene.add.zone(x, y, PLAYER_TUNING.attackReach, PLAYER_TUNING.attackHeight);
    scene.physics.add.existing(this.attackZone);
    this.attackZone.body.setAllowGravity(false);
    this.attackZone.body.enable = false;

    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAnimFrame, this);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onAnimComplete, this);
    this.play('aidan-idle');
  }

  get isInvulnerable() {
    return this.clock < this.invulnerableUntil;
  }

  get onGround() {
    return this.body.blocked.down || this.body.touching.down;
  }

  update(_time, delta) {
    if (this.dead) return;
    this.clock += delta;
    const time = this.clock;
    const dt = delta / 1000;
    const T = PLAYER_TUNING;
    const input = this.controls;
    const body = this.body;

    if (this.onGround && body.velocity.y >= 0) this.lastGroundTime = time;
    if (input.justPressed('jump')) this.lastJumpPress = time;

    // --- Agacharse: solo en el suelo y sin atacar; no se desplaza mientras tanto ---
    const wantCrouch = input.isDown('down') && this.onGround && !this.attacking;
    if (wantCrouch !== this.crouching) this.setCrouch(wantCrouch);

    // --- Movimiento horizontal con aceleración ---
    // §5.3: durante la invulnerabilidad Aidan puede seguir moviéndose y atacando.
    const dir = this.crouching ? 0 : input.axisX();
    if (this.crouching && input.axisX() !== 0) this.facing = input.axisX(); // puede girarse
    let target = dir * T.runSpeed;
    if (this.attacking && this.onGround) target *= T.attackMoveMult;
    const accel = (dir !== 0 ? T.groundAccel : T.groundDecel) * (this.onGround ? 1 : T.airAccelMult);
    const vx = body.velocity.x;
    const diff = target - vx;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), accel * dt);
    body.setVelocityX(vx + step);
    if (dir !== 0 && !this.attacking) this.facing = dir;
    this.setFlipX(this.facing < 0);

    // --- Salto: buffer + coyote, simple (sin doble salto) ---
    const canCoyote = time - this.lastGroundTime <= T.coyoteMs;
    const buffered = time - this.lastJumpPress <= T.bufferMs;
    if (buffered && canCoyote && !this.attacking) {
      if (this.crouching) this.setCrouch(false); // saltar levanta a Aidan
      body.setVelocityY(JUMP_VELOCITY);
      this.lastJumpPress = -Infinity;
      this.lastGroundTime = -Infinity;
      if (!input.isDown('jump')) body.setVelocityY(JUMP_VELOCITY * T.jumpCut);
      AudioManager.sfx(this.scene, 'sfx_jump', { volume: 0.6 });
    }
    if (input.justReleased('jump') && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y * T.jumpCut);
    }
    // Gravedad asimétrica: subida rápida, caída más pesada.
    const g = body.velocity.y > 0 ? RISE_GRAVITY * T.fallGravityMult : RISE_GRAVITY;
    body.setGravityY(g - WORLD_GRAVITY);

    // --- Ataque (solo desde el suelo; un único botón) ---
    if (input.justPressed('attack') && !this.attacking && this.onGround && !this.crouching) {
      this.startAttack();
    }
    // --- Fuego fantasma: a distancia, con recarga, desde el suelo ---
    if (input.justPressed('special') && !this.attacking && this.onGround && !this.crouching && this.specialReady) {
      this.startSpecial();
    }

    this.positionAttackZone();
    this.updateAnimation(time);

    // Parpadeo de invulnerabilidad.
    this.setAlpha(this.isInvulnerable ? (Math.floor(time / 70) % 2 ? 0.35 : 1) : 1);
  }

  /** Cambia entre la hitbox de pie y la de agachado (los pies no se mueven). */
  setCrouch(on) {
    this.crouching = on;
    const b = on ? PLAYER_TUNING.crouchBody : PLAYER_TUNING.standBody;
    this.body.setSize(b.w, b.h, false);
    this.body.setOffset(b.ox, b.oy);
  }

  get specialReady() {
    return this.clock >= this.specialReadyAt;
  }

  /** 0 = recién usado, 1 = listo. */
  get specialRatio() {
    const left = this.specialReadyAt - this.clock;
    return left <= 0 ? 1 : 1 - left / PLAYER_TUNING.specialCooldownMs;
  }

  startSpecial() {
    this.attacking = true;
    this.casting = true;
    this.specialReadyAt = this.clock + PLAYER_TUNING.specialCooldownMs;
    // Animación propia de lanzamiento si existe (tools/gen_anim_sprites.py); si no, Attack2.
    this.play(this.scene.anims.exists('aidan-cast') ? 'aidan-cast' : 'aidan-attack2', true);
    AudioManager.sfx(this.scene, 'sfx_player_shot', { volume: 0.9 });
  }

  startAttack() {
    this.attacking = true;
    this.attackId += 1; // cada golpe solo daña una vez a cada enemigo
    this.attackVariant = 1 - this.attackVariant; // alterna Attack1/Attack2 (misma acción)
    this.play(this.attackVariant ? 'aidan-attack1' : 'aidan-attack2', true);
    AudioManager.sfx(this.scene, 'sfx_attack', { volume: 0.7 });
  }

  positionAttackZone() {
    const T = PLAYER_TUNING;
    this.attackZone.setPosition(this.x + this.facing * (T.attackReach / 2 + 10), this.y - 38);
  }

  onAnimFrame(anim, frame) {
    if (!anim.key.startsWith('aidan-attack') && anim.key !== 'aidan-cast') return;
    const i = frame.index - 1;
    if (this.casting) {
      // El lanzamiento no golpea cuerpo a cuerpo: emite la llamarada en su frame.
      this.attackZone.body.enable = false;
      if (i === PLAYER_TUNING.specialSpawnFrame) {
        this.scene.events.emit('player:special', this.x + this.facing * 40, this.y - 46, this.facing);
      }
      return;
    }
    const active = i >= PLAYER_TUNING.attackActiveFrom && i <= PLAYER_TUNING.attackActiveTo;
    this.attackZone.body.enable = active;
  }

  onAnimComplete(anim) {
    if (anim.key.startsWith('aidan-attack') || anim.key === 'aidan-cast') {
      this.attacking = false;
      this.casting = false;
      this.attackZone.body.enable = false;
    } else if (anim.key === 'aidan-death') {
      this.scene.events.emit('player:dead');
    }
  }

  updateAnimation(time) {
    if (this.attacking) return;
    const cur = this.anims.currentAnim?.key;
    if (time < this.hitAnimUntil) {
      if (cur !== 'aidan-hit') this.play('aidan-hit', true);
      return;
    }
    let key;
    if (this.crouching) {
      key = this.scene.anims.exists('aidan-crouch') ? 'aidan-crouch' : 'aidan-idle';
      if (cur !== key) this.play(key, true);
      return; // 'aidan-crouch' se queda en su último frame
    }
    if (!this.onGround) key = this.body.velocity.y < 0 ? 'aidan-jump' : 'aidan-fall';
    else key = Math.abs(this.body.velocity.x) > 20 ? 'aidan-run' : 'aidan-idle';
    if (cur !== key) this.play(key, true);
  }

  /**
   * Recibe un impacto válido: resta 1 corazón y concede 1 s de invulnerabilidad.
   * @param {number} fromX posición X de la fuente del daño (para el retroceso)
   * @returns {boolean} si el daño se aplicó
   */
  takeHit(fromX = this.x) {
    if (this.dead || this.isInvulnerable) return false;
    this.hearts -= 1;
    this.invulnerableUntil = this.clock + RULES.INVULNERABILITY_MS;
    this.scene.events.emit('player:hearts', this.hearts);
    this.scene.cameras.main.shake(140, 0.006);

    if (this.hearts <= 0) {
      this.die();
      return true;
    }
    AudioManager.sfx(this.scene, 'sfx_player_hurt');
    const away = Math.sign(this.x - fromX) || -this.facing;
    this.body.setVelocity(away * PLAYER_TUNING.knockbackX, PLAYER_TUNING.knockbackY);
    this.hitAnimUntil = this.clock + 200; // solo visual; no bloquea los controles
    return true;
  }

  die() {
    if (this.crouching) this.setCrouch(false);
    this.dead = true;
    this.attacking = false;
    this.attackZone.body.enable = false;
    this.setAlpha(1);
    this.body.setVelocity(0, 0);
    this.body.setAcceleration(0, 0);
    this.body.setGravityY(0);
    AudioManager.sfx(this.scene, 'sfx_player_die');
    this.play('aidan-death', true);
  }

  /** Caída a un foso: pierde 1 corazón y reaparece en el último suelo seguro. */
  fellIntoPit() {
    if (this.dead) return;
    // Respeta la invulnerabilidad: si sigue activa, solo se recoloca sin daño.
    this.takeHit(this.x);
    if (this.dead) {
      this.setVisible(false);
      return;
    }
    this.body.reset(this.lastSafe.x, this.lastSafe.y - 4);
    this.body.setVelocity(0, 0);
  }

  destroy(fromScene) {
    this.attackZone?.destroy();
    super.destroy(fromScene);
  }
}
