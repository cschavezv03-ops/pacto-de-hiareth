import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT, RULES } from '../config/constants.js';
import { BACKGROUNDS } from '../config/assets.js';
import { LEVEL_DATA } from '../levels/levels.js';
import { GameState } from '../managers/GameState.js';
import { AudioManager } from '../managers/AudioManager.js';
import { InputManager } from '../managers/InputManager.js';
import { Player } from '../objects/Player.js';
import { Enemy, Alien } from '../objects/Enemy.js';
import { TILE } from '../objects/ProceduralTextures.js';

const GROUND_ROWS = 2;

/** Fuego fantasma (ataque a distancia con recarga, ver Player.PLAYER_TUNING.specialCooldownMs). */
const GHOST_FIRE = Object.freeze({
  speed: 470,   // px/s
  range: 560,   // px antes de disiparse (algo más de media pantalla)
  damage: 3,    // equivale a 3 golpes cuerpo a cuerpo
});
const GROUND_Y = GAME_HEIGHT - GROUND_ROWS * TILE; // borde superior del suelo
const PIT_Y = GAME_HEIGHT + 60;                    // por debajo = cayó al foso

/**
 * Nivel de plataformas genérico construido a partir de LEVEL_DATA.
 * init({ levelId }) — al reiniciar (Game Over) se reconstruye todo desde cero,
 * por lo que todos los enemigos reaparecen; GameState.enemiesKilled se conserva.
 */
export default class LevelScene extends Phaser.Scene {
  constructor() {
    super(SCENES.LEVEL);
  }

  init(data) {
    this.levelId = data?.levelId ?? 'act1';
    this.def = LEVEL_DATA[this.levelId];
    this.finished = false;
    this.startTime = 0;
    this.levelClock = 0;
    this.lastSpecialRatio = -1;
    // Punto de control desde el que se empieza (-1 = inicio). En Difícil siempre -1.
    this.checkpointIndex = GameState.checkpointFor(this.levelId);
  }

  create() {
    const def = this.def;
    const worldW = def.width * TILE;
    this.worldW = worldW;
    this.physics.world.setBounds(0, -200, worldW, GAME_HEIGHT + 400);
    this.physics.world.checkCollision.down = false; // permitir caer a los fosos
    this.cameras.main.setBounds(0, 0, worldW, GAME_HEIGHT);
    this.startTime = this.time.now;

    this.buildBackground();
    this.buildTerrain();
    this.input2 = new InputManager(this, 'platformer');

    const cps = this.def.checkpoints ?? [];
    const spawnX = this.checkpointIndex >= 0 ? (cps[this.checkpointIndex] + 0.5) * TILE : 3 * TILE;
    this.player = new Player(this, spawnX, GROUND_Y, this.input2);
    this.player.lastSafe = { x: spawnX, y: GROUND_Y };
    this.player.setDepth(10);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, 40);
    this.cameras.main.setDeadzone(120, 80);

    this.buildHazards();
    this.buildGhostFire();
    this.buildEnemies();
    this.buildGoal();
    this.buildCheckpoints();
    this.wireCollisions();

    // HUD y estado compartido
    this.registry.set('hearts', this.player.hearts);
    this.registry.set('bossHealth', null);
    this.registry.set('levelTitle', null);
    if (!this.scene.isActive(SCENES.HUD)) this.scene.launch(SCENES.HUD, { mode: 'level' });
    this.time.delayedCall(50, () => this.registry.set('levelTitle', def.title));

    this.events.on('player:hearts', (n) => this.registry.set('hearts', n));
    this.events.on('player:dead', () => this.gameOver());
    this.events.on('enemy:killed', () => GameState.registerKill()); // solo muertes directas
    this.events.once('shutdown', () => this.cleanup());

    AudioManager.playMusic(this, def.music);
    this.cameras.main.fadeIn(350, 0, 0, 0);
    this.showHint();

    if (import.meta.env.DEV) window.__level = this;
  }

  // ---------------------------------------------------------------- construcción
  buildBackground() {
    const layers = BACKGROUNDS[this.def.bg].files.length;
    const scale = GAME_HEIGHT / 324;
    this.bgLayers = [];
    for (let i = 1; i <= layers; i += 1) {
      const ts = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, `bg_${this.def.bg}_${i}`)
        .setOrigin(0).setScrollFactor(0).setTileScale(scale).setDepth(-100 + i);
      ts.parallax = this.def.parallax[i - 1] ?? 0.5;
      this.bgLayers.push(ts);
    }
  }

  buildTerrain() {
    const def = this.def;
    this.solids = this.physics.add.staticGroup();
    // Suelo: una imagen por tile para el dibujo, y un único cuerpo por tramo (sin costuras).
    for (const [from, to] of def.ground) {
      const w = (to - from) * TILE;
      const strip = this.add.tileSprite(from * TILE, GROUND_Y, w, TILE, def.tile).setOrigin(0).setDepth(2);
      this.add.tileSprite(from * TILE, GROUND_Y + TILE, w, TILE * 2, `${def.tile}_fill`).setOrigin(0).setDepth(2);
      this.physics.add.existing(strip, true);
      this.solids.add(strip);
    }

    this.oneWay = this.physics.add.staticGroup();
    this.movers = this.physics.add.group({ allowGravity: false, immovable: true });
    this.crumbles = this.physics.add.staticGroup();

    for (const p of def.platforms) {
      const x = p.x * TILE;
      const y = GROUND_Y - p.h * TILE;
      const w = p.w * TILE;
      const type = p.type ?? 'static';
      if (type === 'moving') {
        const plat = this.add.tileSprite(x, y, w, 16, def.tile).setOrigin(0).setDepth(3);
        this.physics.add.existing(plat);
        this.movers.add(plat);
        plat.body.setAllowGravity(false).setImmovable(true);
        plat.body.checkCollision.down = false;
        plat.body.checkCollision.left = false;
        plat.body.checkCollision.right = false;
        plat.originX0 = x;
        plat.originY0 = y;
        plat.dx = (p.dx ?? 0) * TILE;
        plat.dy = (p.dy ?? 0) * TILE;
        plat.period = p.ms ?? 2000;
        plat.prevX = x;
      } else if (type === 'crumble') {
        const plat = this.add.tileSprite(x, y, w, 14, 'platform_ice').setOrigin(0).setDepth(3);
        this.physics.add.existing(plat, true);
        plat.body.checkCollision.down = false;
        plat.body.checkCollision.left = false;
        plat.body.checkCollision.right = false;
        plat.crumbling = false;
        plat.home = { x, y };
        this.crumbles.add(plat);
      } else {
        const plat = this.add.tileSprite(x, y, w, 16, def.tile).setOrigin(0).setDepth(3);
        this.physics.add.existing(plat, true);
        // Plataformas atravesables desde abajo (one-way).
        plat.body.checkCollision.down = false;
        plat.body.checkCollision.left = false;
        plat.body.checkCollision.right = false;
        this.oneWay.add(plat);
      }
    }
  }

  buildHazards() {
    this.hazards = this.physics.add.staticGroup();
    this.icicles = this.physics.add.group({ allowGravity: false });
    for (const h of this.def.hazards) {
      if (h.type === 'spikes') {
        const s = this.add.tileSprite(h.x * TILE, GROUND_Y, h.w * TILE, 16, 'hazard_spikes')
          .setOrigin(0, 1).setDepth(4);
        this.physics.add.existing(s, true);
        s.body.setSize(h.w * TILE - 8, 10).setOffset(4, 6);
        this.hazards.add(s);
      } else if (h.type === 'icicle') {
        // Estalactita que cae cuando Aidan pasa cerca (obstáculo ambiental).
        const ic = this.icicles.create(h.x * TILE + 16, 0, 'hazard_spikes');
        ic.setFlipY(true).setDepth(4).setScale(1, 2);
        ic.body.setAllowGravity(false);
        ic.body.setSize(20, 14).setOffset(6, 1);
        ic.armed = true;
        ic.homeX = ic.x;
      }
    }
  }

  /** Pool del Fuego fantasma (máximo 3 en pantalla; la recarga ya limita el uso). */
  buildGhostFire() {
    this.ghostFires = this.physics.add.group({ allowGravity: false, maxSize: 3, defaultKey: 'fx_ghostfire' });
    this.ghostFireShot = 0;
    this.events.on('player:special', (x, y, dir) => this.spawnGhostFire(x, y, dir));
  }

  spawnGhostFire(x, y, dir) {
    const fire = this.ghostFires.get(x, y, 'fx_ghostfire');
    if (!fire) return;
    this.ghostFireShot += 1;
    fire.shotId = this.ghostFireShot;
    fire.enableBody(true, x, y, true, true);
    fire.body.setAllowGravity(false);
    fire.setDepth(9).setFlipX(dir < 0).setScale(1.3).setAlpha(1);
    fire.body.setCircle(12, fire.width / 2 - 12, fire.height / 2 - 12);
    fire.body.setVelocity(dir * GHOST_FIRE.speed, 0);
    fire.startX = x;
    if (this.anims.exists('ghostfire-burn')) fire.play('ghostfire-burn');
    // Estela de chispas violetas que sigue a la llamarada.
    fire.trail = this.add.particles(0, 0, 'fx_pixel', {
      follow: fire, lifespan: 380, speed: { min: 10, max: 50 }, scale: { start: 1.1, end: 0 },
      tint: [0xb05cff, 0x6a1fb0, 0xff3b5c], frequency: 22, alpha: { start: 0.9, end: 0 },
    }).setDepth(8);
  }

  explodeGhostFire(fire) {
    if (!fire.active) return;
    if (this.anims.exists('ghostfire-burst')) {
      const fx = this.add.sprite(fire.x, fire.y, 'fx_ghostfire_burst', 0).setDepth(10).setScale(1.4);
      fx.play('ghostfire-burst');
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    }
    const burst = this.add.particles(fire.x, fire.y, 'fx_pixel', {
      speed: { min: 60, max: 220 }, lifespan: 420, scale: { start: 1.6, end: 0 },
      tint: [0xb05cff, 0xff3b5c, 0xffd6ff], quantity: 22, emitting: false,
    }).setDepth(9);
    burst.explode(22);
    this.time.delayedCall(500, () => burst.destroy());
    this.cameras.main.shake(90, 0.004);
    AudioManager.sfx(this, 'sfx_enemy_hit', { volume: 0.9 });
    fire.trail?.destroy();
    fire.trail = null;
    fire.disableBody(true, true);
  }

  buildEnemies() {
    this.enemies = this.add.group({ runChildUpdate: false });
    this.enemyHitboxes = this.physics.add.group({ allowGravity: false });
    this.alienShots = this.physics.add.group({ allowGravity: false, maxSize: 30, defaultKey: 'orb_alien' });
    for (const e of this.def.enemies) {
      const baseY = GROUND_Y - (e.h ?? 0) * TILE;
      let [minT, maxT] = e.zone;
      if (e.h) {
        // Sobre plataforma: limitar la zona al ancho de la plataforma.
        const plat = this.def.platforms.find((p) => p.h === e.h && e.x >= p.x && e.x <= p.x + p.w);
        if (plat) { minT = plat.x + 0.6; maxT = plat.x + plat.w - 0.6; }
      }
      const spec = {
        type: e.type,
        x: e.x * TILE,
        y: e.type === 'alien' ? baseY - 10 : baseY,
        minX: minT * TILE,
        maxX: maxT * TILE,
        hitboxes: this.enemyHitboxes,
      };
      const enemy = e.type === 'alien' ? new Alien(this, spec, this.alienShots) : new Enemy(this, spec);
      enemy.setDepth(8);
      this.enemies.add(enemy);
    }
  }

  buildGoal() {
    const g = this.def.goal;
    const texture = this.textures.get(g.texture);
    // Los props pixel art se dibujan a la resolución nativa de los fondos (576x324):
    // se escalan igual que ellos para que el tamaño de píxel coincida.
    const meta = this.cache.json.get('props_meta') ?? {};
    const scale = meta[`${g.texture}.png`] ? GAME_HEIGHT / 324 : 1;
    this.goal = this.add.sprite(g.x * TILE, GROUND_Y, g.texture, 0).setOrigin(0.5, 1).setDepth(5).setScale(scale);
    if (this.anims.exists(`${g.texture}-anim`) && texture.frameTotal > 2) this.goal.play(`${g.texture}-anim`);
    this.physics.add.existing(this.goal, true);
    // Cuerpo estrecho y centrado (px de mundo): hay que llegar al objeto, no rozarlo.
    this.goal.body.setSize(Math.max(40, this.goal.displayWidth * 0.4), this.goal.displayHeight, true);
  }

  /** Braseros de punto de control (no existen en dificultad Difícil). */
  buildCheckpoints() {
    this.checkpoints = this.physics.add.staticGroup();
    if (!GameState.difficulty.checkpoints) return;
    const scale = GAME_HEIGHT / 324;
    (this.def.checkpoints ?? []).forEach((cx, i) => {
      const cp = this.checkpoints.create((cx + 0.5) * TILE, GROUND_Y, 'prop_checkpoint', 0);
      cp.setOrigin(0.5, 1).setScale(scale).setDepth(4).refreshBody();
      cp.index = i;
      if (i <= this.checkpointIndex) cp.play('checkpoint-lit');
    });
  }

  activateCheckpoint(cp) {
    if (cp.index <= this.checkpointIndex || this.player.dead) return;
    this.checkpointIndex = cp.index;
    GameState.setCheckpoint(this.levelId, cp.index);
    for (const other of this.checkpoints.getChildren()) {
      if (other.index <= cp.index && other.anims.currentAnim?.key !== 'checkpoint-lit') other.play('checkpoint-lit');
    }
    AudioManager.sfx(this, 'sfx_level_clear', { volume: 0.5 });
    this.registry.set('toast', { text: 'Punto de control', t: this.time.now });
    const burst = this.add.particles(cp.x, cp.y - cp.displayHeight, 'fx_pixel', {
      speed: { min: 40, max: 140 }, angle: { min: 200, max: 340 }, lifespan: 600,
      scale: { start: 1.2, end: 0 }, tint: [0xffd34a, 0xff7a1a], quantity: 18, emitting: false,
    }).setDepth(6);
    burst.explode(18);
    this.time.delayedCall(800, () => burst.destroy());
  }

  wireCollisions() {
    const p = this.player;
    this.physics.add.collider(p, this.solids);
    this.physics.add.collider(p, this.oneWay);
    this.physics.add.collider(p, this.movers);
    this.physics.add.collider(p, this.crumbles, (_pl, plat) => this.startCrumble(plat));
    this.physics.add.collider(this.enemies, this.solids);
    this.physics.add.collider(this.enemies, this.oneWay);

    // Contacto con enemigos: daño (sujeto a la invulnerabilidad de 1 s).
    this.physics.add.overlap(p, this.enemies, (pl, enemy) => {
      if (enemy.alive) pl.takeHit(enemy.x);
    });
    // Proyectiles del alien: dañan y desaparecen.
    // Proyectiles del alien: dañan pero siguen su trayectoria (§7.2); la invulnerabilidad
    // impide daño adicional. Desaparecen solo al salir del escenario o caducar.
    this.physics.add.overlap(p, this.alienShots, (pl, orb) => {
      if (orb.active) pl.takeHit(orb.x);
    });
    this.physics.add.overlap(p, this.hazards, (pl, hz) => pl.takeHit(hz.x + hz.width / 2));
    this.physics.add.overlap(p, this.icicles, (pl, ic) => {
      if (ic.falling && pl.takeHit(ic.x)) ic.disableBody(true, true);
    });

    // Tajo del esqueleto (zona activa solo en los frames del golpe).
    this.physics.add.overlap(p, this.enemyHitboxes, (pl, zone) => {
      if (zone.body.enable && zone.owner?.alive) pl.takeHit(zone.owner.x);
    });

    // Fuego fantasma: atraviesa el aire, impacta al primer enemigo y explota.
    this.physics.add.overlap(this.ghostFires, this.enemies, (a, b) => {
      const fire = this.ghostFires.contains(a) ? a : b;
      const enemy = fire === a ? b : a;
      if (!fire.active || !enemy.alive) return;
      enemy.hit(`fire-${fire.shotId}`, fire.x, GHOST_FIRE.damage);
      this.explodeGhostFire(fire);
    });

    // Golpe melee de Aidan.
    this.physics.add.overlap(p.attackZone, this.enemies, (_zone, enemy) => {
      enemy.hit(p.attackId, p.x);
    });

    this.physics.add.overlap(p, this.checkpoints, (_pl, cp) => this.activateCheckpoint(cp));

    // Meta del nivel.
    this.physics.add.overlap(p, this.goal, () => this.completeLevel());
  }

  // ---------------------------------------------------------------- lógica
  startCrumble(plat) {
    if (plat.crumbling || !this.player.body.touching.down) return;
    plat.crumbling = true;
    this.tweens.add({ targets: plat, x: plat.x + 2, yoyo: true, repeat: 6, duration: 50 });
    this.time.delayedCall(550, () => {
      plat.body.enable = false;
      this.tweens.add({ targets: plat, alpha: 0, y: plat.y + 30, duration: 300 });
      // Reaparece tras un tiempo para no bloquear el avance.
      this.time.delayedCall(2600, () => {
        plat.setPosition(plat.home.x, plat.home.y).setAlpha(1);
        plat.body.enable = true;
        plat.body.updateFromGameObject(); // TileSprite no tiene refreshBody()
        plat.crumbling = false;
      });
    });
  }

  update(time, delta) {
    this.input2.update();
    if (this.input2.justPressed('pause') && !this.finished) {
      this.scene.launch(SCENES.PAUSE, { from: SCENES.LEVEL });
      this.scene.pause();
      return;
    }

    // Plataformas móviles: velocidad analítica de un movimiento senoidal suave
    // (derivada exacta) + una pequeña corrección de deriva. No se deriva la velocidad
    // de la diferencia de posición entre frames: Arcade integra a paso fijo y eso
    // producía oscilaciones bruscas.
    this.levelClock += delta;
    for (const m of this.movers.getChildren()) {
      const w = (Math.PI * 2) / m.period;          // rad/ms
      const t = this.levelClock;
      const k = (1 - Math.cos(w * t)) / 2;          // 0..1
      const dk = (Math.sin(w * t) * w * 1000) / 2;  // derivada por segundo
      const tx = m.originX0 + m.dx * k;
      const ty = m.originY0 + m.dy * k;
      m.body.setVelocity(m.dx * dk + (tx - m.body.x) * 4, m.dy * dk + (ty - m.body.y) * 4);
    }

    // El arrastre sobre plataformas móviles lo hace Arcade (body.friction.x = 1 por defecto).
    this.player.update(time, delta);
    this.updateSafeSpot();

    for (const e of this.enemies.getChildren()) {
      e.update(time, this.player);
      // Caída ambiental: desaparece SIN contar como muerte causada por Aidan.
      if (e.alive && e.y > PIT_Y) e.kill(false);
    }

    // Proyectiles fuera de los límites del escenario o caducados.
    const view = this.cameras.main.worldView;
    for (const orb of this.alienShots.getChildren()) {
      if (!orb.active) continue;
      if (time > orb.expireAt || orb.x < 0 || orb.x > this.worldW || orb.y < -50 || orb.y > GAME_HEIGHT + 50
          || orb.x < view.x - 200 || orb.x > view.right + 200) {
        orb.disableBody(true, true);
      }
    }

    // Estalactitas: caen cuando Aidan se acerca.
    for (const ic of this.icicles.getChildren()) {
      if (ic.armed && Math.abs(this.player.x - ic.homeX) < 90) {
        ic.armed = false;
        this.tweens.add({ targets: ic, x: ic.x + 2, yoyo: true, repeat: 4, duration: 45,
          onComplete: () => { ic.falling = true; ic.body.setAllowGravity(true); } });
      }
      if (ic.active && ic.y > GROUND_Y) ic.disableBody(true, true);
    }

    // Fuego fantasma: alcance máximo
    for (const fire of this.ghostFires.getChildren()) {
      if (fire.active && Math.abs(fire.x - fire.startX) > GHOST_FIRE.range) {
        fire.trail?.destroy();
        fire.trail = null;
        this.tweens.add({ targets: fire, alpha: 0, duration: 120, onComplete: () => fire.disableBody(true, true) });
        fire.body.setVelocity(0, 0);
        fire.startX = fire.x + 1e9; // evitar repetir el fade
      }
    }
    // Recarga del especial para el HUD y el botón táctil.
    const ratio = Math.round(this.player.specialRatio * 50) / 50; // 2 % de resolución
    if (ratio !== this.lastSpecialRatio) {
      this.lastSpecialRatio = ratio;
      this.registry.set('special', { ratio, ready: ratio >= 1, label: 'Fuego fantasma' });
      this.input2.touch.setCooldown('special', ratio);
    }

    // Foso
    if (!this.player.dead && this.player.y > PIT_Y) this.player.fellIntoPit();

    // Parallax
    const sx = this.cameras.main.scrollX;
    const scale = GAME_HEIGHT / 324;
    for (const l of this.bgLayers) l.tilePositionX = (sx * l.parallax) / scale;
  }

  /**
   * Último punto seguro para reaparecer tras caer a un foso: solo sobre un tramo de
   * suelo firme (no plataformas móviles/quebradizas), con margen respecto al borde.
   */
  updateSafeSpot() {
    const p = this.player;
    if (p.dead || !p.body.blocked.down || p.body.velocity.y < 0) return;
    const margin = 40;
    const footY = p.body.bottom;
    if (Math.abs(footY - GROUND_Y) > 2) return;
    const onSolid = this.def.ground.some(([a, b]) => p.body.left >= a * TILE + margin && p.body.right <= b * TILE - margin);
    const onSpikes = this.def.hazards.some((h) => h.type === 'spikes'
      && p.x > h.x * TILE - margin && p.x < (h.x + h.w) * TILE + margin);
    if (onSolid && !onSpikes) {
      p.lastSafe.x = p.x;
      p.lastSafe.y = p.y;
    }
  }

  completeLevel() {
    if (this.finished || this.player.dead) return;
    this.finished = true;
    this.player.body.setVelocity(0, 0);
    this.player.body.enable = false;
    this.player.play('aidan-idle', true);
    AudioManager.sfx(this, 'sfx_level_clear');

    const seconds = (this.time.now - this.startTime) / 1000;
    const timeBonus = Math.max(0, Math.round((300 - seconds) * 5));
    GameState.addScore(1000 + this.player.hearts * 300 + timeBonus);

    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop(SCENES.HUD);
      const next = GameState.advanceStory();
      this.game.events.emit('story:goto', next);
    });
  }

  gameOver() {
    if (this.finished) return;
    this.finished = true;
    this.time.delayedCall(500, () => {
      this.scene.stop(SCENES.HUD);
      this.scene.start(SCENES.GAME_OVER, { retryScene: SCENES.LEVEL, retryData: { levelId: this.levelId } });
    });
  }

  showHint() {
    const isTouch = this.sys.game.device.input.touch;
    const msg = isTouch
      ? 'Usa los botones: ◀ ▶ moverse · ⤒ saltar · 🔥 atacar'
      : 'A/D o ←/→ moverse · Espacio saltar · J o clic atacar · Esc pausa';
    const t = this.add.text(GAME_WIDTH / 2, 214, msg, {
      fontFamily: '"Trebuchet MS", sans-serif', fontSize: '18px', color: '#ffffff',
      backgroundColor: '#140e24cc', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.tweens.add({ targets: t, alpha: 0, delay: 5000, duration: 800, onComplete: () => t.destroy() });
  }

  cleanup() {
    this.events.off('player:hearts');
    this.events.off('player:dead');
    this.events.off('enemy:killed');
    this.events.off('player:special');
    this.registry.set('special', null);
    if (import.meta.env.DEV && window.__level === this) window.__level = null;
  }
}

export { GROUND_Y, RULES };
