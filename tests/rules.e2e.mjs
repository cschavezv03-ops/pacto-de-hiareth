/**
 * Verificación E2E de reglas de gameplay en el navegador.
 * Uso: node tests/rules.e2e.mjs http://localhost:5173
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const url = process.argv[2] ?? 'http://localhost:5173';
// GPU (Vulkan/ANGLE) para FPS realistas; PW_GPU=0 fuerza WebGL por software.
const GPU_ARGS = process.env.PW_GPU === '0' ? [] : ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({ args: GPU_ARGS });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.game?.scene.isActive('Menu'), null, { timeout: 20000 });

const results = {};
const step = async (name, fn) => {
  try { results[name] = await fn(); } catch (e) { results[name] = `FALLO: ${e.message}`; }
};

// Partida nueva desde el menú: Nueva partida -> Intermedio -> VN intro -> Acto 1
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.game.scene.isActive('VisualNovel'), null, { timeout: 5000 });
await page.waitForTimeout(600);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__level?.levelId === 'act1', null, { timeout: 5000 });
await page.waitForTimeout(800);

await step('kill slime with 4 hits', async () => {
  const r = await page.evaluate(async () => {
    const s = window.__level;
    const GameState = window.__GameState;
    const before = GameState.enemiesKilled;
    const slime = s.enemies.getChildren()[0];
    const hitsTo = [];
    for (let i = 1; i <= slime.maxHp; i += 1) hitsTo.push(slime.hit(1000 + i, slime.x - 50));
    // El mismo golpe no puede dañar dos veces
    return { before, after: GameState.enemiesKilled, hitsTo, alive: slime.alive, difficulty: GameState.difficulty.id };
  });
  assert.equal(r.difficulty, 'normal', 'el menú eligió Intermedio');
  assert.deepEqual(r.hitsTo, [false, false, false, true]);
  assert.equal(r.after, r.before + 1);
  return r;
});

await step('real melee attack damages enemy once per swing', async () => {
  const r = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level;
    const enemy = s.enemies.getChildren().find((e) => e.alive);
    const p = s.player;
    p.body.reset(enemy.x - 50, enemy.y);
    p.facing = 1;
    p.invulnerableUntil = p.clock + 5000; // evitar el daño por contacto durante la prueba
    enemy.minX = enemy.maxX = enemy.x; // inmóvil
    const hp0 = enemy.hp;
    s.time.delayedCall(100, () => p.startAttack());
    s.time.delayedCall(700, () => resolve({ hp0, hp1: enemy.hp }));
  }));
  assert.equal(r.hp1, r.hp0 - 1);
  return r;
});

await step('environmental death does not count', async () => {
  return page.evaluate(async () => {
    const s = window.__level;
    const GameState = window.__GameState;
    const before = GameState.enemiesKilled;
    const e = s.enemies.getChildren().find((x) => x.alive);
    e.kill(false);
    return { before, after: GameState.enemiesKilled, ok: before === GameState.enemiesKilled };
  });
});

await step('contact damage + 1s invulnerability', async () => {
  const r = await page.evaluate(() => {
    const p = window.__level.player;
    p.invulnerableUntil = 0;
    const h0 = p.hearts;
    const a = p.takeHit(p.x + 10);
    const b = p.takeHit(p.x + 10); // durante la invulnerabilidad
    return { h0, h1: p.hearts, a, b };
  });
  assert.equal(r.h1, r.h0 - 1);
  assert.equal(r.b, false);
  return r;
});

await step('game over restarts level, respawns enemies, keeps kills', async () => {
  const before = await page.evaluate(async () => {
    const GameState = window.__GameState;
    const p = window.__level.player;
    GameState.addOrbs(12); // orbes que deben perderse con el Game Over
    p.invulnerableUntil = 0; p.hearts = 1; p.takeHit(p.x);
    return GameState.enemiesKilled;
  });
  await page.waitForFunction(() => window.game.scene.isActive('GameOver'), null, { timeout: 6000 });
  await page.keyboard.press('Enter'); // Reintentar
  await page.waitForFunction(() => window.__level?.player && window.game.scene.isActive('Level'), null, { timeout: 6000 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(async () => {
    const GameState = window.__GameState;
    const s = window.__level;
    return { kills: GameState.enemiesKilled, enemies: s.enemies.getChildren().filter((e) => e.alive).length, expected: s.def.enemies.length, hearts: s.player.hearts, orbs: GameState.orbs };
  });
  assert.equal(after.kills, before);
  assert.equal(after.enemies, after.expected);
  assert.equal(after.hearts, 3);
  assert.equal(after.orbs, 0, 'los orbes vuelven a 0 al perder todas las vidas');
  return { before, ...after };
});

await step('ghost fire: ranged, 3 damage, cooldown, counts as direct kill', async () => {
  const r = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level;
    const GS = window.__GameState;
    const p = s.player;
    const enemy = s.enemies.getChildren().find((e) => e.alive);
    p.invulnerableUntil = p.clock + 99999;
    enemy.minX = enemy.maxX = enemy.x;
    enemy.nextAction = s.time.now + 99999; // que no salte durante la prueba
    p.body.reset(enemy.x - 300, enemy.y);
    p.facing = 1;
    p.specialReadyAt = 0;
    const hp0 = enemy.hp;
    const kills0 = GS.enemiesKilled;
    s.time.delayedCall(150, () => {
      p.startSpecial();
      const blocked = p.specialReady; // justo tras usarlo no debe estar listo
      s.time.delayedCall(1300, () => resolve({
        hp0, hp1: enemy.hp, blocked, ratio: p.specialRatio, kills0, kills1: GS.enemiesKilled,
        alive: enemy.alive,
      }));
    });
  }));
  assert.equal(r.blocked, false);
  assert.ok(r.ratio < 1);
  assert.equal(r.hp1, Math.max(0, r.hp0 - 3));
  if (!r.alive) assert.equal(r.kills1, r.kills0 + 1);
  return r;
});

await step('slime telegraphs and leaps toward a nearby Aidan (stays in zone)', async () => {
  const r = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level;
    const slime = s.enemies.getChildren().find((e) => e.alive && e.kind === 'slime' && !e.cfg.flying);
    const p = s.player;
    p.invulnerableUntil = p.clock + 99999;
    slime.nextAction = 0;
    p.body.reset(Math.min(slime.maxX, slime.x + 120), slime.y);
    const seen = new Set();
    let minY = slime.y;
    const tick = s.time.addEvent({ delay: 16, loop: true, callback: () => {
      if (slime.action) seen.add(slime.action);
      minY = Math.min(minY, slime.y);
    } });
    s.time.delayedCall(1800, () => { tick.remove(); resolve({ actions: [...seen], rise: Math.round(slime.y - minY), inZone: slime.x >= slime.minX - 5 && slime.x <= slime.maxX + 5 }); });
  }));
  assert.ok(r.actions.includes('windup') && r.actions.includes('leap'), JSON.stringify(r));
  assert.ok(r.rise > 30);
  assert.ok(r.inZone);
  return r;
});

await step('reaching the goal advances to the next VN (conventional route skips act 4 later)', async () => {
  await page.evaluate(() => {
    const s = window.__level;
    s.player.invulnerableUntil = s.player.clock + 99999;
    s.player.body.reset(s.goal.x - 30, s.goal.y - 5);
  });
  await page.waitForFunction(() => window.game.scene.isActive('VisualNovel'), null, { timeout: 6000 });
  return page.evaluate(() => window.game.scene.getScene('VisualNovel').sceneId);
});

await step('pause menu opens and resumes', async () => {
  await page.evaluate(() => window.game.events.emit('story:goto', { type: 'level', id: 'act2' }));
  await page.waitForFunction(() => window.__level?.levelId === 'act2', null, { timeout: 6000 });
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.game.scene.isActive('Pause'), null, { timeout: 3000 });
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter'); // Continuar
  await page.waitForFunction(() => !window.game.scene.isActive('Pause') && !window.game.scene.isPaused('Level'), null, { timeout: 3000 });
  return 'ok';
});

await step('alien projectiles: fixed trajectory, slow, disappear off-bounds', async () => {
  const r = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level;
    const alien = s.enemies.getChildren()[0];
    s.player.invulnerableUntil = s.player.clock + 99999;
    s.player.body.reset(alien.x - 250, s.player.y);
    alien.shoot(s.player);
    const orb = s.alienShots.getChildren().find((o) => o.active);
    const v0 = { x: orb.body.velocity.x, y: orb.body.velocity.y };
    s.player.body.reset(alien.x + 300, s.player.y - 100); // Aidan se mueve: la bala no debe corregir
    s.time.delayedCall(400, () => resolve({
      v0, v1: { x: orb.body.velocity.x, y: orb.body.velocity.y },
      speed: Math.hypot(v0.x, v0.y),
    }));
  }));
  assert.ok(Math.abs(r.v0.x - r.v1.x) < 0.01 && Math.abs(r.v0.y - r.v1.y) < 0.01);
  assert.ok(r.speed <= 200);
  return r;
});

await step('alien orb keeps its trajectory after hitting Aidan', async () => {
  const r = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level;
    const p = s.player;
    p.invulnerableUntil = 0;
    const orb = s.alienShots.get(p.x - 40, p.y - 36, 'orb_alien');
    orb.enableBody(true, p.x - 40, p.y - 36, true, true);
    orb.body.setAllowGravity(false);
    orb.body.setVelocity(150, 0);
    orb.expireAt = s.time.now + 6000;
    const h0 = p.hearts;
    s.time.delayedCall(500, () => resolve({ h0, h1: p.hearts, orbActive: orb.active }));
  }));
  assert.equal(r.h1, r.h0 - 1);
  assert.equal(r.orbActive, true);
  return r;
});

await step('pit respects invulnerability and respawns on safe ground', async () => {
  const r = await page.evaluate(() => {
    const p = window.__level.player;
    p.invulnerableUntil = p.clock + 800;
    const h0 = p.hearts;
    p.body.reset(p.x, 700);
    p.fellIntoPit();
    return { h0, h1: p.hearts, y: Math.round(p.y), safe: p.lastSafe };
  });
  assert.equal(r.h1, r.h0);
  assert.ok(r.y < 500);
  return r;
});

await step('crumbling platform respawns without errors (act 4)', async () => {
  await page.evaluate(() => window.game.events.emit('story:goto', { type: 'level', id: 'act4' }));
  await page.waitForFunction(() => window.__level?.levelId === 'act4', null, { timeout: 6000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const s = window.__level;
    const plat = s.crumbles.getChildren()[0];
    s.player.invulnerableUntil = s.player.clock + 99999;
    s.player.body.reset(plat.x + plat.width / 2, plat.y - 2);
  });
  await page.waitForTimeout(4200);
  const r = await page.evaluate(() => {
    const plat = window.__level.crumbles.getChildren()[0];
    return { enabled: plat.body.enable, alpha: plat.alpha, crumbling: plat.crumbling };
  });
  assert.equal(r.enabled, true);
  return r;
});

await step('skeleton swing hurts Aidan standing in front; alien fires a 3-way spread', async () => {
  await page.evaluate(() => window.game.events.emit('story:goto', { type: 'level', id: 'act3' }));
  await page.waitForFunction(() => window.__level?.levelId === 'act3' && window.__level.player, null, { timeout: 6000 });
  await page.waitForTimeout(300);
  const zonesAtSpawn = await page.evaluate(() => window.__level.enemyHitboxes.getChildren().filter((z) => z.body.enable).length);
  assert.equal(zonesAtSpawn, 0, 'ninguna zona de tajo activa al aparecer (sin daño invisible)');
  const sk = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level;
    const e = s.enemies.getChildren()[0];
    const p = s.player;
    e.minX = e.maxX = e.x;
    e.nextAction = 0;
    p.invulnerableUntil = 0;
    p.body.reset(e.x + 60, e.y);
    p.controls.update = () => {}; // sin entrada
    const h0 = p.hearts;
    const seen = new Set();
    const tick = s.time.addEvent({ delay: 16, loop: true, callback: () => { if (e.action) seen.add(e.action); p.body.setVelocityX(0); } });
    s.time.delayedCall(1500, () => { tick.remove(); resolve({ h0, h1: p.hearts, actions: [...seen] }); });
  }));
  assert.ok(sk.actions.includes('swing'), JSON.stringify(sk));
  assert.ok(sk.h1 < sk.h0, 'el tajo resta un corazón');
  await page.evaluate(() => window.game.events.emit('story:goto', { type: 'level', id: 'act2' }));
  await page.waitForFunction(() => window.__level?.levelId === 'act2' && window.__level.player, null, { timeout: 6000 });
  const al = await page.evaluate(() => {
    const s = window.__level;
    const a = s.enemies.getChildren()[0];
    s.player.body.reset(a.x - 200, s.player.y);
    a.shotCount = 2; // el siguiente es el 3.º
    const before = s.alienShots.countActive(true);
    a.shoot(s.player);
    return { spawned: s.alienShots.countActive(true) - before };
  });
  assert.equal(al.spawned, 3);
  return { sk, al };
});

await step('kill counter: hidden by default, visible only when enabled in options', async () => {
  await page.evaluate(() => window.game.events.emit('story:goto', { type: 'level', id: 'act1' }));
  await page.waitForFunction(() => window.__level?.levelId === 'act1' && window.game.scene.isActive('Hud'), null, { timeout: 6000 });
  await page.waitForTimeout(300);
  const hidden = await page.evaluate(() => window.game.scene.getScene('Hud').killText.visible);
  // Activar con el panel real: pausa -> Opciones -> fila 4 -> alternar
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.game.scene.isActive('Pause'), null, { timeout: 3000 });
  await page.waitForTimeout(150);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); // Opciones
  await page.waitForTimeout(200);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight'); // alterna 'Enemigos derrotados'
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); // Continuar
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const hud = window.game.scene.getScene('Hud');
    return { visible: hud.killText.visible, text: hud.killText.text, kills: window.__GameState.enemiesKilled };
  });
  // Dejarlo apagado para no afectar a otras pruebas
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('pactoHiareth.save.v1')); d.settings.showKills = false; localStorage.setItem('pactoHiareth.save.v1', JSON.stringify(d)); });
  assert.equal(hidden, false, 'oculto por defecto');
  assert.equal(r.visible, true, 'visible tras activarlo en Opciones');
  assert.ok(r.text.endsWith(String(r.kills)));
  return { hidden, ...r };
});

await step('act 3: crouch dodges the high slash, sweep hits a crouched Aidan, charge stays in zone, ambush rises', async () => {
  await page.evaluate(() => { window.__GameState.newGame('normal'); window.game.events.emit('story:goto', { type: 'level', id: 'act3' }); });
  await page.waitForFunction(() => window.__level?.levelId === 'act3' && window.__level.player, null, { timeout: 6000 });
  await page.waitForTimeout(300);
  const strike = (kind, crouch) => page.evaluate(([kind, crouch]) => new Promise((resolve) => {
    const s = window.__level;
    const e = s.enemies.getChildren().find((x) => x.alive && x.action !== 'hidden' && !x.cfg.flying && x.y > 400);
    const p = s.player;
    const cfg = e.cfg;
    const prevChance = cfg.sweepChance;
    cfg.sweepChance = kind === 'sweep' ? 1 : 0;
    e.minX = e.maxX = e.x;
    e.nextAction = 0;
    e.nextCharge = 1e12;
    e.action = null;
    p.invulnerableUntil = 0;
    p.body.reset(e.x + 55, e.y); // dentro del margen de 60 px de su zona
    p.controls.update = () => {};
    p.controls.isDown = (a) => (a === 'down' ? crouch : false);
    p.controls.justPressed = () => false;
    p.controls.justReleased = () => false;
    p.controls.axisX = () => 0;
    const h0 = p.hearts;
    e.attackedKinds = [];
    const t = s.time.addEvent({ delay: 16, loop: true, callback: () => { if (e.action === 'swing' && !e.attackedKinds.length) e.attackedKinds.push(e.anims.currentAnim?.key); } });
    s.time.delayedCall(1300, () => {
      t.remove();
      cfg.sweepChance = prevChance;
      resolve({ kind, crouch, crouching: p.crouching, bodyH: Math.round(p.body.height), h0, h1: p.hearts, attacked: e.attackedKinds });
    });
  }), [kind, crouch]);
  const highCrouched = await strike('high', true);
  const highStanding = await strike('high', false);
  const sweepCrouched = await strike('sweep', true);
  assert.ok(highCrouched.attacked.length && highStanding.attacked.length && sweepCrouched.attacked.length, 'los tres ataques se lanzaron');
  assert.equal(highCrouched.crouching, true);
  assert.equal(highCrouched.bodyH, 44);
  assert.equal(highCrouched.h1, highCrouched.h0, 'agachado esquiva el tajo alto');
  assert.ok(highStanding.h1 < highStanding.h0, 'de pie recibe el tajo alto');
  assert.ok(sweepCrouched.h1 < sweepCrouched.h0, 'el barrido golpea aunque esté agachado (hay que saltar)');

  const charge = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level;
    const e = s.enemies.getChildren().find((x) => x.alive && x.action !== 'hidden' && (x.maxX - x.minX) > 300);
    const p = s.player;
    p.invulnerableUntil = p.clock + 1e6;
    e.action = null; e.nextAction = 0; e.nextCharge = 0;
    e.body.reset((e.minX + e.maxX) / 2 - 60, e.y);
    p.body.reset(e.x + 230, e.y);
    const seen = new Set(); let maxX = -1; let minX = 1e9;
    const t = s.time.addEvent({ delay: 16, loop: true, callback: () => { if (e.action) seen.add(e.action); maxX = Math.max(maxX, e.x); minX = Math.min(minX, e.x); } });
    s.time.delayedCall(1600, () => { t.remove(); resolve({ actions: [...seen], inZone: minX >= e.minX - 3 && maxX <= e.maxX + 3 }); });
  }));
  assert.ok(charge.actions.includes('chargeWindup') && charge.actions.includes('charge'), JSON.stringify(charge));
  assert.ok(charge.inZone);

  const ambush = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level;
    const e = s.enemies.getChildren().find((x) => x.action === 'hidden');
    const before = { action: e.action, body: e.body.enable };
    s.player.invulnerableUntil = s.player.clock + 1e6;
    s.player.body.reset(e.x - 120, e.y);
    s.time.delayedCall(1400, () => resolve({ before, after: { action: e.action, body: e.body.enable, alive: e.alive } }));
  }));
  assert.equal(ambush.before.action, 'hidden');
  assert.equal(ambush.before.body, false, 'oculto no hace daño ni se puede golpear');
  assert.equal(ambush.after.body, true);
  assert.notEqual(ambush.after.action, 'hidden');
  return { highCrouched, highStanding, sweepCrouched, charge, ambush };
});

await step('new mechanics: fragile/phantom movers, air attack, orbs + extra life, slime lava', async () => {
  const out = {};
  // Plataforma frágil (Acto 2): se rompe tras ~0.5 s de pie encima.
  await page.evaluate(() => { window.__GameState.newGame('normal'); window.game.events.emit('story:goto', { type: 'level', id: 'act2' }); });
  await page.waitForFunction(() => window.__level?.levelId === 'act2' && window.__level.player, null, { timeout: 6000 });
  await page.waitForTimeout(300);
  out.fragile = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level; const m = s.movers.getChildren()[0]; const p = s.player;
    p.invulnerableUntil = p.clock + 1e6;
    p.controls.update = () => {}; p.controls.isDown = () => false; p.controls.justPressed = () => false; p.controls.justReleased = () => false; p.controls.axisX = () => 0;
    p.body.reset(m.body.center.x, m.body.top - 4); // cae sobre ella y la plataforma lo arrastra
    let landedAt = null;
    const watch = s.time.addEvent({ delay: 16, loop: true, callback: () => { if (landedAt === null && m.touchedAt !== null) landedAt = s.levelClock; } });
    s.time.delayedCall(120, () => { const mid = m.broken; s.time.delayedCall(700, () => { watch.remove(); resolve({ brokenAt330: mid, brokenAt1130: m.broken, trap: m.trap, landed: m.touchedAt !== null || m.broken }); }); });
  }));
  assert.equal(out.fragile.trap, 'fragile');
  assert.equal(out.fragile.landed, true, 'Aidan aterrizó sobre la plataforma');
  assert.equal(out.fragile.brokenAt330, false, 'no se rompe al instante');
  assert.equal(out.fragile.brokenAt1130, true, 'se rompe ~0.35 s después del primer toque');

  // Ataque en el aire golpea a un enemigo.
  out.air = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level; const p = s.player; const e = s.enemies.getChildren().find((x) => x.alive);
    e.minX = e.maxX = e.x;
    const restore = Object.getPrototypeOf(p.controls);
    p.controls.isDown = restore.isDown.bind(p.controls); p.controls.justPressed = restore.justPressed.bind(p.controls);
    p.controls.justReleased = restore.justReleased.bind(p.controls); p.controls.axisX = restore.axisX.bind(p.controls); p.controls.update = restore.update.bind(p.controls);
    p.body.reset(e.x - 60, e.y - 70); p.facing = 1; p.body.setVelocity(0, -200);
    const hp0 = e.hp;
    s.time.delayedCall(60, () => { const air = !p.onGround; p.startAirAttack(); s.time.delayedCall(400, () => resolve({ air, anim: p.anims.currentAnim?.key, hp0, hp1: e.hp })); });
  }));
  assert.equal(out.air.air, true);
  assert.equal(out.air.hp1, out.air.hp0 - 1);

  // Orbes: matar suelta orbes; recogerlos suma puntos; cruzar 10000 cura un corazón.
  out.orbs = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level; const p = s.player; const GS = window.__GameState;
    const e = s.enemies.getChildren().find((x) => x.alive);
    const active0 = s.orbs.countActive(true);
    for (let i = 0; i < e.maxHp; i += 1) e.hit(9000 + i, e.x - 40);
    const dropped = s.orbs.countActive(true) - active0;
    const orbs0 = GS.orbs;
    const orb = s.orbs.getChildren().find((o) => o.active && !o.placed);
    s.collectOrb(orb);
    const gained = GS.orbs - orbs0;
    p.hearts = 2; s.registry.set('hearts', 2);
    s.awardOrbs(50 - (GS.orbs % 50));
    const healed = p.hearts;
    // Persecución: pasar corriendo cerca de un orbe fijo hace que lo siga y se recoja.
    const placed = s.orbs.getChildren().find((o) => o.placed && o.active);
    p.body.reset(placed.x - 60, placed.baseY + 40);
    p.body.setVelocityX(250);
    const orbs1 = GS.orbs;
    s.time.delayedCall(900, () => resolve({ dropped, gained, heartsAfter: healed, homed: GS.orbs > orbs1, placedLeft: s.orbs.getChildren().filter((o) => o.placed && o.active).length }));
  }));
  assert.ok(out.orbs.dropped >= 3, 'el enemigo suelta orbes');
  assert.equal(out.orbs.gained, 1);
  assert.equal(out.orbs.heartsAfter, 3, 'llegar a 50 orbes cura un corazón');
  assert.equal(out.orbs.homed, true, 'el orbe persigue a Aidan y se recoge aunque siga corriendo');

  // Plataforma fantasma (Acto 3) y lava del slime (Acto 1).
  await page.evaluate(() => window.game.events.emit('story:goto', { type: 'level', id: 'act3' }));
  await page.waitForFunction(() => window.__level?.levelId === 'act3' && window.__level.player, null, { timeout: 6000 });
  out.phantom = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level; const m = s.movers.getChildren()[0]; const p = s.player;
    p.invulnerableUntil = p.clock + 1e6;
    p.body.reset(m.body.center.x, m.body.top - 2);
    const y0 = p.y;
    s.time.delayedCall(500, () => resolve({ trap: m.trap, broken: m.broken || m.fading, fellThrough: p.y > y0 + 40 }));
  }));
  assert.equal(out.phantom.trap, 'phantom');
  assert.equal(out.phantom.broken, true, 'se desvanece al tocarla');
  assert.equal(out.phantom.fellThrough, true, 'no sostiene a Aidan: es una trampa');
  await page.evaluate(() => window.game.events.emit('story:goto', { type: 'level', id: 'act1' }));
  await page.waitForFunction(() => window.__level?.levelId === 'act1' && window.__level.player, null, { timeout: 6000 });
  out.lava = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level; const p = s.player;
    const e = s.enemies.getChildren().find((x) => x.alive && x.kind === 'slime' && !x.cfg.flying && x.y > 400);
    p.invulnerableUntil = p.clock + 1e6;
    s.spawnLava(e.x, true);
    const f = s.lava.getChildren().find((x) => x.active);
    const harmfulAtSpawn = f?.harmful;
    s.time.delayedCall(400, () => {
      p.invulnerableUntil = 0; const h0 = p.hearts;
      p.body.reset(f.x, f.y - 2);
      s.time.delayedCall(150, () => resolve({ exists: !!f, harmfulAtSpawn, harmful: f.harmful, h0, h1: p.hearts }));
    });
  }));
  assert.equal(out.lava.exists, true);
  assert.equal(out.lava.harmfulAtSpawn, false, 'aparece con aviso, sin dañar');
  assert.ok(out.lava.h1 < out.lava.h0, 'la lava quema');
  return out;
});

await step('pacifist easter egg: no kills -> act 4 loads after act 3; one kill -> skipped', async () => {
  const pac = await page.evaluate(async () => {
    const GS = window.__GameState;
    GS.newGame('normal');
    while (GS.currentStep().id !== 'act3') GS.advanceStory();
    window.game.events.emit('story:goto', GS.currentStep());
    return GS.enemiesKilled;
  });
  await page.waitForFunction(() => window.__level?.levelId === 'act3' && window.__level.player, null, { timeout: 6000 });
  await page.evaluate(() => { const s = window.__level; s.player.invulnerableUntil = s.player.clock + 1e6; s.player.body.reset(s.goal.x - 10, s.goal.y - 4); });
  await page.waitForFunction(() => window.game.scene.isActive('VisualNovel'), null, { timeout: 6000 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter'); // after_act3 -> siguiente paso
  await page.waitForFunction(() => window.__level?.levelId === 'act4' || window.game.scene.getScene('VisualNovel').sceneId === 'before_boss', null, { timeout: 6000 });
  const pacNext = await page.evaluate(() => (window.game.scene.isActive('Level') ? window.__level.levelId : window.game.scene.getScene('VisualNovel').sceneId));
  const conv = await page.evaluate(() => {
    const GS = window.__GameState;
    GS.newGame('normal');
    while (GS.currentStep().id !== 'act3') GS.advanceStory();
    GS.registerKill();
    GS.advanceStory(); // after_act3
    return GS.advanceStory().id;
  });
  assert.equal(pac, 0);
  assert.equal(pacNext, 'act4', 'sin muertes aparece el Acto 4');
  assert.equal(conv, 'before_boss', 'con una muerte se salta el Acto 4');
  return { pacNext, conv };
});

await step('boss: player shot damages boss; boss scene restarts on death', async () => {
  await page.evaluate(() => window.game.events.emit('story:goto', { type: 'boss' }));
  await page.waitForFunction(() => window.__boss?.player, null, { timeout: 6000 });
  await page.waitForTimeout(300);
  const hp0 = await page.evaluate(() => window.__boss.bossHealth);
  await page.evaluate(() => { const b = window.__boss; b.player.body.reset(b.boss.x - 200, b.boss.y); });
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const b = window.__boss;
    return { hp1: b.bossHealth, bossActive: b.boss.active, bossVisible: b.boss.visible, bodyEnabled: b.boss.body.enable };
  });
  assert.ok(r.hp1 < hp0, `boss hp ${hp0} -> ${r.hp1}`);
  // Regresión: el impacto no debe desactivar/ocultar al jefe.
  assert.ok(r.bossActive && r.bossVisible && r.bodyEnabled, 'Morrigannus sigue activo tras el impacto');
  const mult = await page.evaluate(() => ({ speed: window.__boss.speedMult, rest: window.__boss.restMult, diff: window.__GameState.difficulty.id }));
  const expected = { easy: 1.0, normal: 1.25, hard: 1.45 }[mult.diff];
  assert.equal(mult.speed, expected, 'velocidad de los orbes del jefe según la dificultad');
  // Varios impactos seguidos siguen restando vida.
  for (let i = 0; i < 4; i += 1) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(160); }
  await page.waitForTimeout(700);
  const hp2 = await page.evaluate(() => window.__boss.bossHealth);
  assert.ok(hp2 < r.hp1, `boss hp ${r.hp1} -> ${hp2}`);
  return { hp0, ...r, hp2 };
});

await step('difficulty scales enemy hits and checkpoints', async () => {
  return page.evaluate(async () => {
    const GameState = window.__GameState;
    const { enemyHits } = await import('/src/config/constants.js');
    const out = {};
    for (const d of ['easy', 'normal', 'hard']) {
      out[d] = ['slime', 'alien', 'skeleton'].map((t) => enemyHits(t, d));
    }
    GameState.newGame('hard');
    GameState.setCheckpoint('act1', 1);
    out.hardCheckpoint = GameState.checkpointFor('act1');
    GameState.newGame('normal');
    GameState.advanceStory();
    GameState.setCheckpoint('act1', 1);
    out.normalCheckpoint = GameState.checkpointFor('act1');
    return out;
  }).then((r) => {
    assert.deepEqual(r.normal, [4, 6, 8]);
    assert.deepEqual(r.easy, [2, 3, 4]);
    assert.deepEqual(r.hard, [6, 9, 12]);
    assert.equal(r.hardCheckpoint, -1);
    assert.equal(r.normalCheckpoint, 1);
    return r;
  });
});

await step('checkpoint: activating it and dying respawns there; enemies reset', async () => {
  await page.evaluate(async () => {
    const GameState = window.__GameState;
    GameState.newGame('normal');
    GameState.advanceStory(); // paso del Acto 1, sin checkpoint guardado
    window.game.events.emit('story:goto', { type: 'level', id: 'act1' });
  });
  await page.waitForFunction(() => window.__level?.levelId === 'act1' && window.__level.player, null, { timeout: 6000 });
  await page.waitForTimeout(400);
  const cpX = await page.evaluate(() => {
    const s = window.__level;
    const cp = s.checkpoints.getChildren()[0];
    s.player.invulnerableUntil = s.player.clock + 99999;
    s.player.body.reset(cp.x, cp.y - 4);
    return cp.x;
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const p = window.__level.player; p.invulnerableUntil = 0; p.hearts = 1; p.takeHit(p.x); });
  await page.waitForFunction(() => window.game.scene.isActive('GameOver'), null, { timeout: 6000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__level?.player && window.game.scene.isActive('Level'), null, { timeout: 6000 });
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({
    x: Math.round(window.__level.player.x),
    enemies: window.__level.enemies.getChildren().filter((e) => e.alive).length,
    expected: window.__level.def.enemies.length,
    lit: window.__level.checkpoints.getChildren()[0].anims.currentAnim?.key,
  }));
  assert.ok(Math.abs(r.x - cpX) < 40, `reaparece en el checkpoint (${r.x} vs ${cpX})`);
  assert.equal(r.enemies, r.expected);
  return { cpX, ...r };
});

await step('moving platforms move smoothly (no velocity spikes)', async () => {
  await page.evaluate(() => window.game.events.emit('story:goto', { type: 'level', id: 'act2' }));
  await page.waitForFunction(() => window.__level?.levelId === 'act2' && window.__level.player, null, { timeout: 6000 });
  const r = await page.evaluate(() => new Promise((resolve) => {
    const s = window.__level;
    const m = s.movers.getChildren()[0];
    const xs = [];
    const onStep = () => xs.push(m.body.x);
    s.physics.world.on('worldstep', onStep);
    s.time.delayedCall(4000, () => {
      s.physics.world.off('worldstep', onStep);
      const steps = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
      const jumps = steps.slice(1).map((d, i) => Math.abs(d - steps[i]));
      resolve({ maxStep: Math.max(...steps), maxJerk: Math.max(...jumps), range: Math.max(...xs) - Math.min(...xs), n: xs.length });
    });
  }));
  assert.ok(r.maxStep < 3.5, `paso máximo ${r.maxStep}px por tick`);
  assert.ok(r.maxJerk < 1, `cambio brusco ${r.maxJerk}`);
  assert.ok(r.range > 80, `recorrido ${r.range}`);
  return r;
});

await browser.close();
console.log(JSON.stringify({ results, errors }, null, 2));
const failed = Object.values(results).some((v) => typeof v === 'string' && v.startsWith('FALLO')) || errors.length;
process.exit(failed ? 1 : 0);
