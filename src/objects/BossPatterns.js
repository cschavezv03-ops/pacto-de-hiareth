/** Deterministic repertoire; all shots share the scene's prewarmed pool/emitter. */
const TAU = Math.PI * 2;
const SEQUENCES = [
  [],
  ['fan', 'ring', 'lance', 'fan', 'ring', 'lance'],
  ['spiral', 'wall', 'fan', 'wall', 'fan'],
  ['spiral', 'wall', 'lance', 'double', 'spiral', 'lance', 'wall'],
];
export const PATTERN_COLORS = Object.freeze({
  fan: 0xff6589, ring: 0xc18aff, lance: 0xffbd68,
  spiral: 0xb18bff, wall: 0x77e6e0, double: 0xff719d,
});

export default class BossPatterns {
  constructor(scene, tuning) {
    this.scene = scene;
    this.tuning = tuning;
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
    track.kind = kind;
    track.warning = kind === 'lance' ? this.tuning.LANCE_WARNING_MS
      : kind === 'wall' ? this.tuning.WALL_WARNING_MS : this.tuning.TELEGRAPH_MS;
    track.age = 0;
    track.pulse = 0;
    track.emitted = 0;
    track.secondary = false;
    // Aim locks at the start of the warning: moving away always works.
    track.angle = Math.atan2(s.player.y - s.boss.y, s.player.x - (s.boss.x - 45));
    track.speed = p.speed + p.speedRise * s.intensity;
    track.count = p.fan + Math.floor(2 * s.intensity);
    track.interval = p.spiralInterval;
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
        const sequence = SEQUENCES[s.phase];
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
      if (i === 0 && track.kind === 'spiral' && s.phase === 3
        && track.age >= this.tuning.SPIRAL_COMBINE_AT_MS && !track.secondary) {
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
    const x = s.boss.x - 45;
    const y = s.boss.y;
    switch (t.kind) {
      case 'fan':
        this.shoot(x, y, t.count, t.speed, t.angle - tuning.FAN_SPREAD / 2, tuning.FAN_SPREAD);
        t.kind = '';
        break;
      case 'ring':
      case 'double': {
        const double = t.kind === 'double';
        const count = p.ring + Math.floor(2 * s.intensity);
        this.shoot(x, y, count, t.speed * 0.9,
          this.ringAngle + (t.emitted ? Math.PI / count : 0), TAU, true);
        t.emitted += 1;
        t.pulse = tuning.DOUBLE_RING_DELAY_MS;
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
        if (t.emitted === tuning.LANCE_COUNT) t.kind = '';
        break;
      case 'wall':
        // Bounds match Aidan's flight area. Hole edges include orb hit radius.
        for (let orbY = 66; orbY <= 506; orbY += tuning.WALL_SPACING) {
          if (Math.abs(orbY - t.gap) < tuning.WALL_GAP / 2 + tuning.BULLET_RADIUS) continue;
          this.shoot(932, orbY, 1, p.wallSpeed + 15 * s.intensity, Math.PI, 0, true);
        }
        t.kind = '';
        break;
      case 'spiral':
        this.shoot(x, y, 2, t.speed, this.ringAngle, TAU, true);
        this.ringAngle = (this.ringAngle + tuning.SPIRAL_ROTATION) % TAU;
        t.pulse = t.interval - 15 * s.intensity;
        if (t.age >= tuning.SPIRAL_DURATION_MS) t.kind = '';
        break;
      default:
        t.kind = '';
    }
    s.patternSound();
  }

  destroy() {
    // DisplayList may already have destroyed the warning graphics at shutdown.
    for (const track of this.tracks) track.kind = '';
    this.scene = null;
  }
}
