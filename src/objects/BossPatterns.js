/** Deterministic repertoire; all shots share the scene's prewarmed pool/emitter. */
const TAU = Math.PI * 2;

/**
 * Repertorio del jefe según la dificultad (además de bossSpeedMult/bossRestMult).
 *  sequences[fase]  orden de patrones de cada fase.
 *  combineFrom      fase desde la que una espiral lanza un segundo patrón a la vez (0 = nunca).
 *  warnMult         duración de los avisos (nunca desaparecen; en Difícil son más cortos).
 *  wallGap          hueco libre de los muros; wallSpacing separación de sus orbes.
 *  fanExtra/ringExtra  orbes extra en abanicos y anillos.
 *  spiralArms       brazos de la espiral ('spiral4' usa el doble).
 *  drift            movimiento del jefe: 'still' | 'sway' (oscila) | 'hunt' (sigue a Aidan en vertical).
 * Patrones exclusivos de Difícil: 'burst' (tres abanicos cerrados apuntados seguidos),
 * 'wall2' (dos muros encadenados con el hueco desplazado, cada uno con su aviso) y
 * 'spiral4' (espiral de cuatro brazos).
 */
export const BOSS_PROFILES = Object.freeze({
  easy: Object.freeze({
    sequences: [[], ['fan', 'ring', 'fan', 'lance'], ['fan', 'wall', 'ring', 'lance'], ['spiral', 'fan', 'wall', 'ring', 'lance']],
    combineFrom: 0, warnMult: 1.3, wallGap: 150, wallSpacing: 28, fanExtra: -1, ringExtra: -3,
    lanceCount: 2, spiralArms: 2, spiralIntervalMult: 1.3, spiralRotation: 0.32, doubleRingDelay: 620,
    drift: 'still', driftSpeed: 0,
  }),
  normal: Object.freeze({
    sequences: [[], ['fan', 'ring', 'lance', 'fan', 'ring', 'lance'], ['spiral', 'wall', 'fan', 'wall', 'fan'],
      ['spiral', 'wall', 'lance', 'double', 'spiral', 'lance', 'wall']],
    combineFrom: 3, warnMult: 1, wallGap: 116, wallSpacing: 24, fanExtra: 0, ringExtra: 0,
    lanceCount: 3, spiralArms: 2, spiralIntervalMult: 1, spiralRotation: 0.24, doubleRingDelay: 460,
    drift: 'sway', driftSpeed: 45,
  }),
  hard: Object.freeze({
    sequences: [[], ['burst', 'ring', 'lance', 'double', 'fan', 'burst', 'ring'],
      ['spiral', 'wall2', 'burst', 'double', 'lance', 'wall', 'burst'],
      ['spiral4', 'wall2', 'burst', 'double', 'spiral', 'lance', 'wall2', 'burst']],
    combineFrom: 2, warnMult: 0.8, wallGap: 100, wallSpacing: 20, fanExtra: 2, ringExtra: 4,
    lanceCount: 5, spiralArms: 3, spiralIntervalMult: 0.85, spiralRotation: 0.21, doubleRingDelay: 340,
    drift: 'hunt', driftSpeed: 70,
  }),
});

export const PATTERN_COLORS = Object.freeze({
  fan: 0xff6589, ring: 0xc18aff, lance: 0xffbd68,
  spiral: 0xb18bff, wall: 0x77e6e0, double: 0xff719d,
  burst: 0xff4f6e, wall2: 0x5fe0ff, spiral4: 0xd08bff,
});

export default class BossPatterns {
  constructor(scene, tuning, profile = BOSS_PROFILES.normal) {
    this.scene = scene;
    this.tuning = tuning;
    this.profile = profile;
    this.index = 0;
    this.ringAngle = 0;
    this.rest = tuning.INTRO_MS;
    this.tracks = [this.makeTrack(), this.makeTrack()];
    // Reused descriptor: no per-projectile objects or timers in the firing loop.
    this.shot = { x: 0, y: 0, count: 1, speed: 0, angleStart: 0, angleSpread: 0, texture: '' };
  }

  makeTrack() {
    return { kind: '', warning: 0, age: 0, pulse: 0, emitted: 0, angle: 0,
      speed: 0, count: 0, gap: 270, interval: 0, secondary: false };
  }

  reset() {
    for (const track of this.tracks) track.kind = '';
    this.index = 0;
    this.rest = this.tuning.PHASE_RECOVERY_MS;
    this.scene.clearTelegraphs();
  }

  begin(track, kind) {
    const s = this.scene;
    const p = this.tuning.PHASES[s.phase - 1];
    const pr = this.profile;
    track.kind = kind;
    const baseWarn = kind === 'lance' ? this.tuning.LANCE_WARNING_MS
      : kind === 'wall' || kind === 'wall2' ? this.tuning.WALL_WARNING_MS : this.tuning.TELEGRAPH_MS;
    track.warning = baseWarn * pr.warnMult;
    track.age = 0;
    track.pulse = 0;
    track.emitted = 0;
    track.secondary = false;
    // Aim locks at the start of the warning: moving away always works.
    track.angle = Math.atan2(s.player.y - s.boss.y, s.player.x - (s.boss.x - 45));
    track.speed = p.speed + p.speedRise * s.intensity;
    track.count = Math.max(2, p.fan + pr.fanExtra + Math.floor(2 * s.intensity));
    track.interval = p.spiralInterval * pr.spiralIntervalMult;
    // Random, but reachable even when a previous pattern drove Aidan to an edge.
    const low = Math.max(124, s.player.y - this.tuning.WALL_GAP_REACH);
    const high = Math.min(448, s.player.y + this.tuning.WALL_GAP_REACH);
    track.gap = low + Math.random() * Math.max(0, high - low);
    this.scene.showTelegraph(track, PATTERN_COLORS[kind]);
  }

  update(delta) {
    const s = this.scene;
    const main = this.tracks[0];
    const side = this.tracks[1];
    if (!main.kind && !side.kind) {
      this.rest -= delta;
      if (this.rest <= 0) {
        const sequence = this.profile.sequences[s.phase];
        this.begin(main, sequence[this.index++ % sequence.length]);
      }
    }
    for (let i = 0; i < this.tracks.length; i += 1) {
      const track = this.tracks[i];
      if (!track.kind) continue;
      if (track.warning > 0) {
        track.warning -= delta;
        if (track.warning > 0) continue;
        s.hideTelegraph(track);
        // Never recover missed emissions after a slow frame.
        track.pulse = 0;
      }
      track.age += delta;
      track.pulse -= delta;
      if (track.pulse <= 0) this.emit(track);
      const combine = this.profile.combineFrom;
      if (i === 0 && (track.kind === 'spiral' || track.kind === 'spiral4') && combine && s.phase >= combine
        && track.age >= this.tuning.SPIRAL_COMBINE_AT_MS && !track.secondary && !side.kind) {
        track.secondary = true;
        this.begin(side, this.index % 2 ? 'wall' : 'lance');
      }
      if (!track.kind && i === 0) {
        const p = this.tuning.PHASES[s.phase - 1];
        this.rest = (p.rest - p.restReduction * s.intensity) * (s.restMult ?? 1);
      }
    }
  }

  shoot(x, y, count, speed, direction, spread = 0, violet = false) {
    const shot = this.shot;
    shot.x = x;
    shot.y = y;
    shot.count = count;
    shot.speed = speed;
    shot.angleStart = direction;
    shot.angleSpread = spread;
    shot.texture = violet ? 'boss-orb-violet' : 'boss-orb-red';
    return this.scene.spawnBullets(shot);
  }

  emit(t) {
    const s = this.scene;
    const tuning = this.tuning;
    const p = tuning.PHASES[s.phase - 1];
    const pr = this.profile;
    const x = s.boss.x - 45;
    const y = s.boss.y;
    switch (t.kind) {
      case 'burst': {
        // Tres abanicos cerrados seguidos, cada uno apuntado a donde está Aidan ahora.
        const aim = Math.atan2(s.player.y - y, s.player.x - x);
        this.shoot(x, y, 3, t.speed * 1.1, aim - 0.17, 0.34);
        t.emitted += 1;
        t.pulse = 280;
        if (t.emitted === 3) t.kind = '';
        break;
      }
      case 'wall2':
        // Primer muro y, a continuación, un segundo muro con su propio aviso y el hueco
        // desplazado (siempre alcanzable desde el primero).
        this.emitWall(t, p, pr, s);
        t.kind = 'wall';
        t.warning = tuning.WALL_WARNING_MS * pr.warnMult; // ≈0.56 s entre muros en Difícil
        t.age = 0;
        t.pulse = 0;
        {
          const shift = (Math.random() < 0.5 ? -1 : 1) * tuning.WALL_GAP_REACH * 0.75; // ≈100 px: alcanzable volando en ese margen
          let gap = t.gap + shift;
          if (gap < 124 || gap > 448) gap = t.gap - shift;
          t.gap = Math.max(124, Math.min(448, gap));
        }
        this.scene.showTelegraph(t, PATTERN_COLORS.wall);
        break;
      case 'spiral4':
        this.shoot(x, y, pr.spiralArms + 1, t.speed * 0.95, this.ringAngle, TAU, true);
        this.ringAngle = (this.ringAngle + pr.spiralRotation * 0.8) % TAU;
        t.pulse = t.interval * 1.15 - 15 * s.intensity;
        if (t.age >= tuning.SPIRAL_DURATION_MS) t.kind = '';
        break;
      case 'fan':
        this.shoot(x, y, t.count, t.speed, t.angle - tuning.FAN_SPREAD / 2, tuning.FAN_SPREAD);
        t.kind = '';
        break;
      case 'ring':
      case 'double': {
        const double = t.kind === 'double';
        const count = Math.max(6, p.ring + pr.ringExtra + Math.floor(2 * s.intensity));
        this.shoot(x, y, count, t.speed * 0.9,
          this.ringAngle + (t.emitted ? Math.PI / count : 0), TAU, true);
        t.emitted += 1;
        t.pulse = pr.doubleRingDelay;
        if (!double || t.emitted === 2) {
          this.ringAngle = (this.ringAngle + tuning.RING_ROTATION) % TAU;
          t.kind = '';
        }
        break;
      }
      case 'lance':
        this.shoot(x, y, 1, p.lanceSpeed, t.angle);
        t.emitted += 1;
        t.pulse = tuning.LANCE_INTERVAL_MS;
        if (t.emitted >= pr.lanceCount) t.kind = '';
        break;
      case 'wall':
        this.emitWall(t, p, pr, s);
        t.kind = '';
        break;
      case 'spiral':
        this.shoot(x, y, pr.spiralArms, t.speed, this.ringAngle, TAU, true);
        this.ringAngle = (this.ringAngle + pr.spiralRotation) % TAU;
        t.pulse = t.interval - 15 * s.intensity;
        if (t.age >= tuning.SPIRAL_DURATION_MS) t.kind = '';
        break;
      default:
        t.kind = '';
    }
    s.patternSound();
  }

  emitWall(t, p, pr, s) {
    // Bounds match Aidan's flight area. Hole edges include orb hit radius.
    for (let orbY = 66; orbY <= 506; orbY += pr.wallSpacing) {
      if (Math.abs(orbY - t.gap) < pr.wallGap / 2 + this.tuning.BULLET_RADIUS) continue;
      this.shoot(932, orbY, 1, p.wallSpeed + 15 * s.intensity, Math.PI, 0, true);
    }
  }

  destroy() {
    // DisplayList may already have destroyed the warning graphics at shutdown.
    for (const track of this.tracks) track.kind = '';
    this.scene = null;
  }
}
