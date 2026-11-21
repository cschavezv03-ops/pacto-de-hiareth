/**
 * Verificación E2E de reglas de gameplay en el navegador.
 * Uso: node tests/rules.e2e.mjs http://localhost:5173
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const url = process.argv[2] ?? 'http://localhost:5173';
const browser = await chromium.launch();
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
    return { kills: GameState.enemiesKilled, enemies: s.enemies.getChildren().filter((e) => e.alive).length, hearts: s.player.hearts };
  });
  assert.equal(after.kills, before);
  assert.equal(after.enemies, 9);
  assert.equal(after.hearts, 3);
  return { before, ...after };
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
    lit: window.__level.checkpoints.getChildren()[0].anims.currentAnim?.key,
  }));
  assert.ok(Math.abs(r.x - cpX) < 40, `reaparece en el checkpoint (${r.x} vs ${cpX})`);
  assert.equal(r.enemies, 9);
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
