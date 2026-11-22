import Phaser from 'phaser';
import { AudioManager } from '../managers/AudioManager.js';

/**
 * Pequeño platillo abductor del Acto 2 (peligro ambiental, NO es un enemigo: no se puede
 * destruir, no suelta orbes y no cuenta para enemiesKilled, así que no afecta a la ruta).
 * Persigue despacio a Aidan dentro de su zona, se coloca encima, avisa cargando el
 * emisor y lanza un haz tractor: quien se queda dentro es elevado y, si no escapa a
 * tiempo, abducido (pierde 1 corazón y cae).
 */
export const UFO_TUNING = Object.freeze({
  altitude: 150,        // y del platillo (px de mundo)
  speed: 85,            // px/s persiguiendo (Aidan corre a 250: siempre puede escapar)
  alignRange: 26,       // |dx| para empezar a cargar
  chargeMs: 650,        // aviso antes del haz
  beamMs: 1500,
  beamWidth: 60,
  liftSpeed: 170,       // velocidad hacia arriba dentro del haz
  abductMs: 800,        // tiempo dentro del haz hasta ser abducido
  cooldownMs: [2400, 3200],
  scale: 1.6667,        // misma densidad de píxel que el fondo
});

export class Ufo {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ x: number, minX: number, maxX: number, groundY: number }} spec
   */
  constructor(scene, spec) {
    this.scene = scene;
    this.minX = spec.minX;
    this.maxX = spec.maxX;
    this.groundY = spec.groundY;
    const T = UFO_TUNING;
    this.sprite = scene.add.sprite(spec.x, T.altitude, 'fx_ufo', 0).setScale(T.scale).setDepth(9);
    if (scene.anims.exists('ufo-hover')) this.sprite.play('ufo-hover');
    const beamH = this.groundY - T.altitude;
    this.beam = scene.add.tileSprite(spec.x, T.altitude + 10, T.beamWidth, beamH, 'fx_beam', 0)
      .setOrigin(0.5, 0).setDepth(8).setVisible(false)
      .setTileScale(T.beamWidth / 32, T.scale); // una columna del haz, con la densidad del fondo
    if (scene.anims.exists('beam-flow')) {
      // Animar el haz cambiando el frame de la textura del TileSprite.
      this.beamFrame = 0;
    }
    this.state = 'hunt';
    this.stateUntil = 0;
    this.nextBeam = 0;
    this.inBeamMs = 0;
    this.t0 = Math.random() * 1000;
  }

  /** @param {number} now reloj del nivel (ms) */
  update(now, delta, player) {
    const T = UFO_TUNING;
    const s = this.sprite;
    s.y = T.altitude + Math.sin((now + this.t0) / 420) * 5;

    if (this.state === 'hunt') {
      const target = Phaser.Math.Clamp(player.x, this.minX, this.maxX);
      const dx = target - s.x;
      s.x += Math.sign(dx) * Math.min(Math.abs(dx), T.speed * (delta / 1000));
      const inZone = player.x > this.minX - 40 && player.x < this.maxX + 40;
      if (inZone && !player.dead && Math.abs(player.x - s.x) < T.alignRange && now >= this.nextBeam) {
        this.state = 'charge';
        this.stateUntil = now + T.chargeMs;
        if (this.scene.anims.exists('ufo-charge')) s.play('ufo-charge');
        this.beam.setVisible(true).setAlpha(0.18);
        AudioManager.sfx(this.scene, 'sfx_alien_shot', { volume: 0.4, rate: 0.55 });
      }
    } else if (this.state === 'charge') {
      // Aviso: el haz parpadea tenue antes de activarse.
      this.beam.setAlpha(Math.floor(now / 90) % 2 ? 0.1 : 0.28);
      if (now >= this.stateUntil) {
        this.state = 'beam';
        this.stateUntil = now + T.beamMs;
        this.beam.setAlpha(1);
        this.inBeamMs = 0;
        AudioManager.sfx(this.scene, 'sfx_boss_shot', { volume: 0.6, rate: 0.7 });
      }
    } else if (this.state === 'beam') {
      this.updateBeam(delta, player);
      if (now >= this.stateUntil) this.endBeam(now);
    }

    this.beam.x = s.x;
    this.beam.y = s.y + 10;
    if (this.beam.visible && this.scene.textures.get('fx_beam').frameTotal > 2) {
      this.beamFrame = (this.beamFrame + delta / 90) % 4;
      this.beam.setFrame(Math.floor(this.beamFrame));
    }
  }

  updateBeam(delta, player) {
    const T = UFO_TUNING;
    const b = player.body;
    const inside = !player.dead && Math.abs(player.x - this.sprite.x) < T.beamWidth / 2 + b.width / 2 - 6
      && b.bottom > this.sprite.y;
    if (inside) {
      this.inBeamMs += delta;
      b.setVelocityY(-T.liftSpeed); // te eleva: hay que salir de la luz
      if (this.inBeamMs >= T.abductMs) {
        // Abducido: pierde 1 corazón y el platillo lo "suelta" en la última plataforma
        // segura (en el Acto 2 no hay suelo: así no se suma además la caída al vacío).
        if (player.takeHit(this.sprite.x)) {
          if (this.scene.returnToSafe) this.scene.returnToSafe();
          else b.setVelocityY(260);
        }
        this.endBeam(this.scene.levelClock);
      }
    } else {
      this.inBeamMs = Math.max(0, this.inBeamMs - delta * 2);
    }
  }

  endBeam(now) {
    this.state = 'hunt';
    this.nextBeam = now + Phaser.Math.Between(...UFO_TUNING.cooldownMs);
    this.beam.setVisible(false);
    this.inBeamMs = 0;
    if (this.scene.anims.exists('ufo-hover')) this.sprite.play('ufo-hover');
  }

  destroy() {
    this.sprite.destroy();
    this.beam.destroy();
  }
}
