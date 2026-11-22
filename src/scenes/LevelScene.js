import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, GAME_HEIGHT, RULES } from '../config/constants.js';
import { BACKGROUNDS } from '../config/assets.js';
import { LEVEL_DATA, MOVER_CYCLE } from '../levels/levels.js';
import { GameState } from '../managers/GameState.js';
import { AudioManager } from '../managers/AudioManager.js';
import { InputManager } from '../managers/InputManager.js';
import { Player } from '../objects/Player.js';
import { Enemy, Alien } from '../objects/Enemy.js';
import { Ufo } from '../objects/Ufo.js';
import { TILE } from '../objects/ProceduralTextures.js';

const GROUND_ROWS = 2;

/**
 * Plataformas móviles con trampa (ya no "tapan" los fosos):
 *  'fragile' — se agrieta y se rompe 0.35 s después del PRIMER toque, aunque saltes.
 *  'phantom' — (Acto 3, Limbo) es una trampa: no tiene colisión; al tocarla se desvanece
 *              mientras Aidan cae. Un leve brillo espectral la delata al jugador atento.
 *  'cycle'   — (Acto 2, sin suelo) se rompen solas por ciclos: firmes → tiemblan y se
 *              agrietan (aviso) → caen → reaparecen. Cada plataforma va desfasada
 *              `stagger` ms por detrás de la anterior, así cuando la tuya avisa la
 *              siguiente está firme.
 */
const MOVER_TRAP = Object.freeze({
  fragileMs: 350,        // desde el primer toque hasta que se rompe
  phantomFadeMs: 300,
  respawnMs: 3000,
});

const CYCLE_TOTAL = MOVER_CYCLE.solidMs + MOVER_CYCLE.warnMs + MOVER_CYCLE.brokenMs;

/**
 * Orbes: cuántos suelta cada enemigo. Cada orbe cuenta 1 (vida cada GameState.LIFE_EVERY).
 * En cuanto Aidan pasa cerca, el orbe le persigue hasta recogerse (ignora el terreno).
 */
const ORBS = Object.freeze({
  drop: { slime: 3, alien: 4, skeleton: 5 },
  lifeMs: 9000,          // los soltados desaparecen si nadie se acerca (parpadean al final)
  magnetRange: 130,
  homingSpeed: 520,      // velocidad inicial de persecución
  homingAccel: 1800,     // px/s² extra: siempre acaba alcanzando a Aidan
  pickupRange: 30,
});

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
    this.safeMover = null;
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
    this.buildLava();
    this.buildEnemies();
    this.buildUfos();
    this.buildOrbs();
    this.buildGoal();
    this.buildCheckpoints();
    this.wireCollisions();

    // HUD y estado compartido
    if (GameState.consumeBonusHeart()) this.player.hearts = RULES.PLAYER_HEARTS + 1; // vida guardada
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
        plat.phase = p.phase ?? 0;
        plat.prevX = x;
        plat.trap = p.trap ?? def.moverTrap ?? 'fragile';
        if (plat.trap === 'cycle') {
          // Desfase: la siguiente plataforma va por detrás en su ciclo (rompe más tarde).
          plat.cycleOffset = p.cycleOffset ?? -this.movers.getLength() * MOVER_CYCLE.stagger;
          plat.cycleShift = 0;
          plat.cycleState = null; // se fija en el primer update sin efectos
        }
        plat.touchedAt = null;
        plat.broken = false;
        if (plat.trap === 'phantom') {
          // Aspecto espectral para que se lea como "no fiable".
          // Casi idéntica a una normal: solo un leve parpadeo espectral la delata.
          plat.setTint(0xe6dcff).setAlpha(0.95);
          this.tweens.add({ targets: plat, alpha: 0.8, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.InOut' });
        }
        if (plat.trap !== 'phantom' && this.textures.exists('fx_crack')) {
          plat.crack = this.add.tileSprite(x, y, w, 16, 'fx_crack', 0).setOrigin(0).setDepth(3.5).setVisible(false);
        }
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

  /** Platillos abductores (peligro ambiental del Acto 2). */
  buildUfos() {
    this.ufos = [];
    if (!this.textures.exists('fx_ufo') || !this.textures.exists('fx_beam')) return;
    for (const u of this.def.ufos ?? []) {
      this.ufos.push(new Ufo(this, {
        x: u.x * TILE, minX: u.zone[0] * TILE, maxX: u.zone[1] * TILE, groundY: GAME_HEIGHT,
      }));
    }
  }

  /** Trampas de las plataformas móviles (frágil / fantasma). */
  updateMoverTrap(m, delta, tx, ty) {
    if (m.crack) m.crack.setPosition(m.x, m.y);
    if (m.trap === 'cycle') { this.updateCycleMover(m); return; }
    if (m.broken) return;
    void delta;
    if (m.trap === 'phantom') {
      if (m.touchedAt !== null && !m.fading) {
        m.fading = true;
        this.tweens.killTweensOf(m);
        AudioManager.sfx(this, 'sfx_ui_select', { volume: 0.4, rate: 0.6 });
        this.tweens.add({ targets: m, alpha: 0, duration: MOVER_TRAP.phantomFadeMs, onComplete: () => this.breakMover(m, tx, ty, false) });
      }
      return;
    }
    // Frágil: grietas progresivas y rotura 0.35 s después del primer toque.
    if (m.touchedAt === null) return;
    const ratio = Math.min(1, (this.levelClock - m.touchedAt) / MOVER_TRAP.fragileMs);
    if (m.crack) {
      m.crack.setVisible(ratio > 0);
      if (ratio > 0) m.crack.setFrame(Math.min(3, Math.floor(ratio * 4)));
    }
    if (ratio > 0) m.setTint(Phaser.Display.Color.GetColor(255, Math.round(255 - ratio * 90), Math.round(255 - ratio * 90)));
    if (ratio >= 1) this.breakMover(m, tx, ty, true);
  }

  /** Momento del ciclo de rotura (0..CYCLE_TOTAL) de una plataforma 'cycle'. */
  cycleTime(m) {
    const t = this.levelClock + m.cycleOffset + m.cycleShift;
    return ((t % CYCLE_TOTAL) + CYCLE_TOTAL) % CYCLE_TOTAL;
  }

  updateCycleMover(m) {
    const C = MOVER_CYCLE;
    const t = this.cycleTime(m);
    const state = t < C.solidMs ? 'solid' : t < C.solidMs + C.warnMs ? 'warn' : 'broken';
    if (state === 'warn') {
      const ratio = (t - C.solidMs) / C.warnMs;
      if (m.crack) m.crack.setVisible(true).setFrame(Math.min(3, Math.floor(ratio * 4)));
      m.setTint(Phaser.Display.Color.GetColor(255, Math.round(255 - ratio * 110), Math.round(255 - ratio * 110)));
      // Temblor visual (el cuerpo no se mueve: no descoloca a Aidan).
      const shake = Math.floor(this.levelClock / 45) % 2 ? 1.5 : -1.5;
      m.setDisplayOrigin(shake, 0);
      m.crack?.setDisplayOrigin(shake, 0);
      if (m.cycleState === 'solid' && this.onScreen(m)) AudioManager.sfx(this, 'sfx_enemy_hit', { volume: 0.25, rate: 0.5 });
    } else if (m.cycleState === 'warn' || (state === 'solid' && m.cycleState !== 'solid')) {
      m.setDisplayOrigin(0, 0);
      m.crack?.setDisplayOrigin(0, 0);
    }
    if (state === m.cycleState) return;
    const prev = m.cycleState;
    m.cycleState = state;
    if (prev === null) { // estado inicial: sin partículas ni sonido
      if (state === 'broken') { m.broken = true; m.body.enable = false; m.setAlpha(0); }
      return;
    }
    if (state === 'broken') {
      this.breakMover(m, 0, 0, true, { respawn: false, sound: this.onScreen(m) });
    } else if (state === 'solid' && prev === 'broken') {
      this.restoreCycleMover(m, true);
    } else if (state === 'solid') {
      this.restoreCycleMover(m, false);
    }
  }

  /** Devuelve una plataforma 'cycle' a su estado firme (con fundido si venía rota). */
  restoreCycleMover(m, fade) {
    this.tweens.killTweensOf(m);
    m.broken = false;
    m.clearTint();
    m.crack?.setVisible(false);
    m.setDisplayOrigin(0, 0);
    m.crack?.setDisplayOrigin(0, 0);
    if (!m.body.enable) {
      const w = (Math.PI * 2) / m.period;
      const k = (1 - Math.cos(w * this.levelClock + Math.PI * 2 * m.phase)) / 2;
      m.body.enable = true;
      m.body.reset(m.originX0 + m.dx * k, m.originY0 + m.dy * k);
    }
    if (fade) {
      m.setAlpha(0);
      this.tweens.add({ targets: m, alpha: 1, duration: 300 });
    } else m.setAlpha(1);
  }

  onScreen(obj) {
    return Phaser.Geom.Rectangle.Overlaps(this.cameras.main.worldView, obj.getBounds());
  }

  /**
   * Tras caer al vacío (o ser abducido) en un nivel sin suelo: Aidan vuelve a la última
   * plataforma 'cycle' que pisó, que se repara al instante (empieza su fase firme).
   * Si pisó suelo firme después, se usa el punto seguro normal.
   */
  prepareRespawn() {
    const m = this.safeMover;
    if (!m || !m.active) return;
    m.cycleShift -= this.cycleTime(m); // ciclo a 0: firme durante solidMs
    m.cycleState = 'solid';
    this.restoreCycleMover(m, false);
    this.player.lastSafe = { x: m.body.x + m.body.width / 2, y: m.body.y };
  }

  /** Abducción del platillo: el corazón ya se ha restado; recolocar sin más daño. */
  returnToSafe() {
    const p = this.player;
    if (p.dead) return;
    this.prepareRespawn();
    p.body.reset(p.lastSafe.x, p.lastSafe.y - 4);
  }

  breakMover(m, tx, ty, crumble, { respawn = true, sound = true } = {}) {
    m.broken = true;
    m.body.enable = false;
    m.crack?.setVisible(false);
    if (crumble) {
      if (sound) AudioManager.sfx(this, 'sfx_enemy_hit', { volume: 0.6, rate: 0.7 });
      const dust = this.add.particles(m.x + m.width / 2, m.y + 8, 'fx_pixel', {
        speed: { min: 30, max: 120 }, angle: { min: 20, max: 160 }, gravityY: 500, lifespan: 600,
        scale: { start: 1.2, end: 0 }, tint: [0x8a8f99, 0x5a5f69, 0xc9ccd4], quantity: 20, emitting: false,
      }).setDepth(6);
      dust.explode(20);
      this.time.delayedCall(700, () => dust.destroy());
      this.tweens.add({ targets: m, y: m.y + 40, alpha: 0, duration: 380, ease: 'Quad.In' });
    }
    if (!respawn) return;
    this.time.delayedCall(MOVER_TRAP.respawnMs, () => {
      if (!m.active) return;
      m.broken = false;
      m.fading = false;
      m.touchedAt = null;
      m.clearTint();
      // Reaparece en la posición que le toca en su recorrido.
      const w = (Math.PI * 2) / m.period;
      const k = (1 - Math.cos(w * this.levelClock + Math.PI * 2 * m.phase)) / 2;
      m.body.enable = true;
      m.body.reset(m.originX0 + m.dx * k, m.originY0 + m.dy * k);
      m.setAlpha(0);
      const targetAlpha = m.trap === 'phantom' ? 0.95 : 1;
      if (m.trap === 'phantom') m.setTint(0xe6dcff);
      this.tweens.add({ targets: m, alpha: targetAlpha, duration: 300, onComplete: () => {
        if (m.trap === 'phantom') this.tweens.add({ targets: m, alpha: 0.8, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.InOut' });
      } });
    });
  }

  // ---------------------------------------------------------------- orbes
  buildOrbs() {
    this.orbs = this.physics.add.group({ maxSize: 80 });
    this.events.on('enemy:killed', (enemy) => this.dropOrbs(enemy));
    // Orbes repartidos por el nivel (también para quien no derrota enemigos).
    for (const c of this.def.orbs ?? []) {
      const n = c.n ?? 5;
      for (let i = 0; i < n; i += 1) {
        const ox = (c.x + 0.5) * TILE + (i - (n - 1) / 2) * 22;
        const oy = GROUND_Y - (c.h ?? 2) * TILE - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 18;
        const orb = this.spawnOrb(ox, oy, false);
        if (orb) orb.placed = true;
      }
    }
  }

  spawnOrb(x, y, dropped) {
    const key = this.textures.exists('fx_orb') ? 'fx_orb' : 'orb_fire';
    const orb = this.orbs.get(x, y, key);
    if (!orb) return null;
    orb.enableBody(true, x, y, true, true);
    orb.setDepth(7).setAlpha(1).setScale(key === 'fx_orb' ? 1.2 : 0.8);
    orb.body.setCircle(8, orb.width / 2 - 8, orb.height / 2 - 8);
    orb.placed = false;
    orb.collected = false;
    orb.homing = false;
    if (this.anims.exists('orb-spin')) orb.play({ key: 'orb-spin', startFrame: Phaser.Math.Between(0, 5) });
    if (dropped) {
      orb.body.setAllowGravity(true).setBounce(0.45).setDrag(60, 0);
      orb.body.setVelocity(Phaser.Math.Between(-140, 140), Phaser.Math.Between(-380, -220));
      orb.expireAt = this.levelClock + ORBS.lifeMs;
    } else {
      orb.body.setAllowGravity(false).setVelocity(0, 0);
      orb.baseY = y;
      orb.expireAt = Infinity;
    }
    return orb;
  }

  dropOrbs(enemy) {
    const n = ORBS.drop[enemy.kind] ?? 3;
    for (let i = 0; i < n; i += 1) this.spawnOrb(enemy.x, enemy.y - 30, true);
  }

  collectOrb(orb) {
    if (orb.collected || !orb.active) return;
    orb.collected = true;
    orb.disableBody(true, true);
    // Cadena de orbes: cada recogida seguida sube de tono (orb_pickup → 2 → 3).
    const chained = this.levelClock - (this.lastOrbAt ?? -1e9) < 450;
    this.orbChain = chained ? Math.min(2, (this.orbChain ?? 0) + 1) : 0;
    this.lastOrbAt = this.levelClock;
    AudioManager.sfx(this, ['sfx_orb_pickup', 'sfx_orb_pickup2', 'sfx_orb_pickup3'][this.orbChain], { volume: 0.8 });
    if (this.anims.exists('orb-pickup')) {
      const fx = this.add.sprite(orb.x, orb.y, 'fx_orb_pickup', 0).setDepth(8);
      fx.play('orb-pickup');
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    }
    this.awardOrbs(1);
  }

  /** Suma orbes y aplica las vidas ganadas (cura o corazón extra). */
  awardOrbs(n) {
    const lives = GameState.addOrbs(n);
    for (let i = 0; i < lives; i += 1) {
      const kind = this.player.heal();
      if (kind) {
        AudioManager.sfx(this, 'sfx_level_clear', { volume: 0.7 });
        this.registry.set('toast', { text: kind === 'heal' ? '¡Corazón recuperado!' : '¡Corazón extra!', t: this.time.now });
      } else {
        GameState.grantBonusHeart(); // ya tiene 4: se guarda para el siguiente tramo
      }
    }
  }

  updateOrbs() {
    const p = this.player;
    for (const orb of this.orbs.getChildren()) {
      if (!orb.active || orb.collected) continue;
      const dx = p.x - orb.x;
      const dy = (p.y - 38) - orb.y;
      const d = Math.hypot(dx, dy) || 1;
      if (!orb.homing && d < ORBS.magnetRange && !p.dead) {
        orb.homing = true; // a partir de aquí persigue a Aidan hasta recogerse
        orb.homingSpeed = ORBS.homingSpeed;
        orb.body.setAllowGravity(false);
        orb.setAlpha(1);
      }
      if (orb.homing) {
        orb.homingSpeed += ORBS.homingAccel * (this.game.loop.delta / 1000);
        orb.body.setVelocity((dx / d) * orb.homingSpeed, (dy / d) * orb.homingSpeed);
        if (d < ORBS.pickupRange) this.collectOrb(orb);
        continue;
      }
      if (orb.placed) orb.y = orb.baseY + Math.sin((this.levelClock + orb.x) / 300) * 4;
      if (orb.expireAt !== Infinity) {
        const left = orb.expireAt - this.levelClock;
        if (left < 2000) orb.setAlpha(Math.floor(left / 120) % 2 ? 0.3 : 1);
        if (left <= 0 || orb.y > PIT_Y) orb.disableBody(true, true);
      }
    }
  }

  // ---------------------------------------------------------------- lava (slimes)
  buildLava() {
    this.lava = this.physics.add.group({ allowGravity: false, maxSize: 24 });
    this.events.on('enemy:lava', (x, big, y) => this.spawnLava(x, big, y));
  }

  /**
   * Charco de lava en la superficie sobre la que está el slime (suelo o plataforma).
   * @param {number} y pies del slime; si falta, se asume el suelo.
   */
  spawnLava(x, big, y = GROUND_Y) {
    if (!this.textures.exists('fx_lava')) return;
    const tx = x / TILE;
    let surfaceY = null;
    if (Math.abs(y - GROUND_Y) < 6) {
      if (this.def.ground.some(([a, b]) => tx >= a && tx <= b)) surfaceY = GROUND_Y; // nunca sobre un foso
    } else {
      // Sobre una plataforma: la de la altura del slime que esté bajo él.
      const plat = this.def.platforms.find((p) => (p.type ?? 'static') === 'static'
        && Math.abs(GROUND_Y - p.h * TILE - y) < 8 && tx >= p.x && tx <= p.x + p.w);
      if (plat) surfaceY = GROUND_Y - plat.h * TILE;
    }
    if (surfaceY === null) return;
    const fire = this.lava.get(x, surfaceY, 'fx_lava');
    if (!fire) return;
    fire.enableBody(true, x, surfaceY, true, true);
    fire.body.setAllowGravity(false).setImmovable(true);
    const scale = big ? 1.5 : 0.95;
    fire.setOrigin(0.5, 1).setScale(scale).setDepth(5).setAlpha(0.55);
    fire.body.setSize(fire.width * 0.75, 10).setOffset(fire.width * 0.125, fire.height - 11);
    if (this.anims.exists('lava-burn')) fire.play('lava-burn');
    // Aparece sin dañar (aviso) y luego quema hasta que se apaga.
    fire.harmful = false;
    fire.expireAt = this.levelClock + (big ? 2600 : 1800);
    fire.armAt = this.levelClock + 260;
  }

  updateLava() {
    for (const f of this.lava.getChildren()) {
      if (!f.active) continue;
      if (!f.harmful && this.levelClock >= f.armAt) { f.harmful = true; f.setAlpha(1); }
      const left = f.expireAt - this.levelClock;
      if (left < 400) f.setAlpha(Math.max(0, left / 400));
      if (left <= 0) f.disableBody(true, true);
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
        ambush: Boolean(e.ambush),
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
    AudioManager.sfx(this, 'sfx_checkpoint', { volume: 0.9 });
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
    // Las fantasma no colisionan (proceso = false): solo se detecta el contacto.
    this.physics.add.collider(p, this.movers, (pl, plat) => {
      if (pl.body.touching.down && plat.body.touching.up && plat.trap === 'cycle') this.safeMover = plat;
      if (pl.body.touching.down && plat.body.touching.up && plat.touchedAt === null) plat.touchedAt = this.levelClock;
    }, (_pl, plat) => plat.trap !== 'phantom');
    this.physics.add.overlap(p, this.movers, (_pl, plat) => {
      if (plat.trap === 'phantom' && plat.touchedAt === null) plat.touchedAt = this.levelClock;
    }, (_pl, plat) => plat.trap === 'phantom');
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

    // Los orbes soltados rebotan en el suelo, salvo cuando ya persiguen a Aidan.
    const orbBlocks = (orb) => !orb.homing && !orb.placed;
    this.physics.add.collider(this.orbs, this.solids, null, orbBlocks);
    this.physics.add.collider(this.orbs, this.oneWay, null, orbBlocks);
    this.physics.add.overlap(p, this.orbs, (_pl, orb) => this.collectOrb(orb));
    this.physics.add.overlap(p, this.lava, (pl, f) => { if (f.harmful) pl.takeHit(f.x); });

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
      const a = w * this.levelClock + Math.PI * 2 * m.phase;
      const k = (1 - Math.cos(a)) / 2;              // 0..1
      const dk = (Math.sin(a) * w * 1000) / 2;      // derivada por segundo
      const tx = m.originX0 + m.dx * k;
      const ty = m.originY0 + m.dy * k;
      m.body.setVelocity(m.dx * dk + (tx - m.body.x) * 4, m.dy * dk + (ty - m.body.y) * 4);
      this.updateMoverTrap(m, delta, tx, ty);
    }

    // El arrastre sobre plataformas móviles lo hace Arcade (body.friction.x = 1 por defecto).
    this.player.update(time, delta);
    this.updateOrbs();
    this.updateLava();
    for (const u of this.ufos) u.update(this.levelClock, delta, this.player);
    this.updateSafeSpot();

    for (const e of this.enemies.getChildren()) {
      e.update(this.levelClock, this.player); // reloj que no avanza en pausa
      // Caída ambiental: desaparece SIN contar como muerte causada por Aidan.
      if (e.alive && e.y > PIT_Y) e.kill(false);
    }

    // Proyectiles fuera de los límites del escenario o caducados.
    const view = this.cameras.main.worldView;
    for (const orb of this.alienShots.getChildren()) {
      if (!orb.active) continue;
      if (this.levelClock > orb.expireAt || orb.x < 0 || orb.x > this.worldW || orb.y < -50 || orb.y > GAME_HEIGHT + 50
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
    if (!this.player.dead && this.player.y > PIT_Y) {
      this.prepareRespawn();
      this.player.fellIntoPit();
    }

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
      this.safeMover = null; // el suelo firme manda sobre la última plataforma pisada
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
    AudioManager.fadeOutMusic(this, 400);
    AudioManager.sfx(this, 'sfx_level_clear');

    const seconds = (this.time.now - this.startTime) / 1000;
    const timeBonus = Math.max(0, Math.round((300 - seconds) * 5));
    GameState.addScore(1000 + Math.min(3, this.player.hearts) * 300 + timeBonus);

    // Espera a que suene la fanfarria antes de cambiar de escena.
    this.cameras.main.fadeOut(1800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop(SCENES.HUD);
      const next = GameState.advanceStory();
      this.game.events.emit('story:goto', next);
    });
  }

  gameOver() {
    if (this.finished) return;
    this.finished = true;
    GameState.resetOrbs(); // al perder todas las vidas los orbes vuelven a 0
    this.time.delayedCall(500, () => {
      this.scene.stop(SCENES.HUD);
      this.scene.start(SCENES.GAME_OVER, { retryScene: SCENES.LEVEL, retryData: { levelId: this.levelId } });
    });
  }

  showHint() {
    const isTouch = this.sys.game.device.input.touch;
    const msg = isTouch
      ? 'Botones: ◀ ▶ moverse · ⤒ saltar · 🔥 atacar · ✦ fuego fantasma'
      : 'A/D moverse · Espacio saltar · J/clic atacar · K/clic der. fuego fantasma · Esc pausa';
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
    this.events.off('enemy:lava');
    this.registry.set('special', null);
    if (import.meta.env.DEV && window.__level === this) window.__level = null;
  }
}

export { GROUND_Y, RULES };
