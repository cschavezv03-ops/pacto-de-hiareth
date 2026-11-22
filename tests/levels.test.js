/**
 * Validación estática de los niveles: la meta es alcanzable desde el inicio con el
 * salto de Aidan (≈4.4 tiles de alto, ≈5 tiles de distancia), con margen de seguridad,
 * y el Acto 4 no contiene enemigos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_DATA } from '../src/levels/levels.js';

// Márgenes conservadores para la ruta crítica (en tiles).
const MAX_UP = 3.6;          // subir hasta 3.6 tiles
const MAX_GAP_FLAT = 4.5;    // hueco horizontal al mismo nivel
const MAX_GAP_DOWN = 6;      // hueco cayendo a una superficie más baja
const MAX_GAP_UP = 3.5;      // hueco subiendo

function surfaces(def) {
  const list = def.ground.map(([a, b]) => ({ a, b, h: 0, kind: 'ground' }));
  for (const p of def.platforms) {
    // Las plataformas fantasma (trampa) no tienen colisión: no cuentan como apoyo.
    if (p.type === 'moving' && (p.trap ?? def.moverTrap) === 'phantom') continue;
    const extra = p.type === 'moving' ? Math.abs(p.dx ?? 0) : 0;
    list.push({ a: p.x, b: p.x + p.w + extra, h: p.h, kind: p.type ?? 'static' });
  }
  return list;
}

function canReach(from, to) {
  const dy = to.h - from.h;
  const gap = Math.max(0, to.a - from.b, from.a - to.b);
  if (dy > MAX_UP) return false;
  if (dy > 0) return gap <= MAX_GAP_UP;
  if (dy === 0) return gap <= MAX_GAP_FLAT;
  return gap <= MAX_GAP_DOWN; // bajar: también desde plataformas (atravesables)
}

for (const [id, def] of Object.entries(LEVEL_DATA)) {
  test(`${id}: la meta es alcanzable desde el inicio`, () => {
    const s = surfaces(def);
    const start = s.find((x) => x.kind === 'ground' && x.a <= 3 && x.b > 3);
    const goal = s.find((x) => x.kind === 'ground' && x.a <= def.goal.x && x.b > def.goal.x);
    assert.ok(start && goal, 'inicio/meta sobre suelo');
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      for (const n of s) if (!seen.has(n) && canReach(cur, n)) { seen.add(n); queue.push(n); }
    }
    assert.ok(seen.has(goal), `${id}: meta inalcanzable`);
  });

  test(`${id}: pinchos sobre suelo y saltables`, () => {
    for (const h of def.hazards.filter((x) => x.type === 'spikes')) {
      assert.ok(h.w <= 3, 'pinchos de como mucho 3 tiles');
      assert.ok(def.ground.some(([a, b]) => h.x >= a && h.x + h.w <= b), `pinchos en x=${h.x} fuera del suelo`);
    }
  });

  test(`${id}: los enemigos terrestres patrullan sobre suelo firme`, () => {
    for (const e of def.enemies.filter((x) => x.type !== 'alien' && !x.h)) {
      const [min, max] = e.zone;
      assert.ok(def.ground.some(([a, b]) => min >= a && max <= b), `${e.type} en x=${e.x} con zona ${min}-${max} sobre un foso`);
    }
  });
}

test('el Acto 4 no tiene enemigos', () => {
  assert.equal(LEVEL_DATA.act4.enemies.length, 0);
});

test('cada acto usa su enemigo correspondiente', () => {
  const kinds = (id) => new Set(LEVEL_DATA[id].enemies.map((e) => e.type));
  assert.deepEqual([...kinds('act1')], ['slime']);
  assert.deepEqual([...kinds('act2')], ['alien']);
  assert.deepEqual([...kinds('act3')], ['skeleton']);
});

test('los checkpoints están sobre suelo, lejos de pinchos y de zonas de patrulla', () => {
  for (const [id, def] of Object.entries(LEVEL_DATA)) {
    assert.ok(def.checkpoints?.length >= 2, `${id}: al menos 2 checkpoints`);
    for (const c of def.checkpoints) {
      assert.ok(def.ground.some(([a, b]) => c >= a + 1 && c + 1 <= b - 1), `${id}: checkpoint ${c} sin suelo`);
      for (const h of def.hazards) assert.ok(Math.abs(h.x - c) >= 3, `${id}: checkpoint ${c} junto a peligro en ${h.x}`);
      for (const e of def.enemies.filter((x) => x.type !== 'alien' && !x.h)) {
        assert.ok(c < e.zone[0] - 2 || c > e.zone[1] + 2, `${id}: checkpoint ${c} dentro de la zona de un ${e.type}`);
      }
    }
  }
});

test('no quedan plataformas estáticas que regalen el paso sobre fosos saltables (Actos 1-3)', () => {
  for (const id of ['act1', 'act2', 'act3']) {
    const d = LEVEL_DATA[id];
    const gaps = d.ground.slice(1).map(([a], i) => [d.ground[i][1], a]);
    for (const p of d.platforms.filter((q) => (q.type ?? 'static') === 'static')) {
      const over = gaps.filter(([g0, g1]) => p.x < g1 && p.x + p.w > g0 && g1 - g0 <= 4);
      assert.equal(over.length, 0, `${id}: plataforma en x=${p.x} sobre un foso saltable`);
    }
  }
});

/**
 * Acto 2 (sin suelo): simulación en el tiempo de las plataformas que se mueven y se
 * rompen por ciclos, con la física real del salto de Aidan y márgenes conservadores
 * (solo el 80 % del alcance horizontal, subidas de como mucho 3.5 tiles, aterrizar con
 * al menos 0.25 s de plataforma firme por delante). Debe poder llegarse de islote en
 * islote hasta la meta.
 */
import { MOVER_CYCLE } from '../src/levels/levels.js';

const T_APEX = 0.38;
const JUMP_H = 150;                       // px (PLAYER_TUNING.jumpHeight)
const G_FALL = ((2 * JUMP_H) / T_APEX ** 2) * 1.7;
const RUN = 250;                          // px/s
const TILE_PX = 32;

function jumpTime(dyTiles) {              // dy > 0 = subir
  const dy = dyTiles * TILE_PX;
  if (dy > JUMP_H) return null;
  return T_APEX + Math.sqrt((2 * (JUMP_H - dy)) / G_FALL);
}

function cycleSim(def, { reachMult = 0.8, maxUp = 3.5 } = {}) {
  const C = MOVER_CYCLE;
  const total = C.solidMs + C.warnMs + C.brokenMs;
  const movers = def.platforms.filter((p) => p.type === 'moving');
  const surf = [
    ...def.ground.map(([a, b]) => ({ island: true, span: () => ({ a, b, h: 0 }), ok: () => true })),
    ...movers.map((p, i) => {
      const off = p.cycleOffset ?? -i * C.stagger;
      const w = (Math.PI * 2) / (p.ms ?? 2000);
      return {
        island: false,
        span: (t) => {
          const k = (1 - Math.cos(w * t + Math.PI * 2 * (p.phase ?? 0))) / 2;
          const x = p.x + (p.dx ?? 0) * k;
          return { a: x, b: x + p.w, h: p.h - (p.dy ?? 0) * k };
        },
        ok: (t) => ((((t + off) % total) + total) % total) < C.solidMs + C.warnMs,
      };
    }),
  ];
  const goalIdx = surf.findIndex((s) => s.island && s.span(0).a <= def.goal.x && s.span(0).b > def.goal.x);
  const DT = 50;
  const HORIZON = 240000;
  const reachedAt = new Array(surf.length).fill(Infinity);
  reachedAt[0] = 0;
  let cur = new Set([0]);
  for (let t = 0; t < HORIZON && reachedAt[goalIdx] === Infinity; t += DT) {
    const next = new Set();
    for (const i of cur) {
      const from = surf[i];
      if (!from.ok(t)) continue; // se rompió bajo los pies
      if (from.ok(t + DT)) next.add(i);
      const sa = from.span(t);
      surf.forEach((to, j) => {
        if (j === i) return;
        const dy = to.span(t).h - sa.h;
        if (dy > maxUp) return;
        const T = jumpTime(dy);
        if (T === null) return;
        const land = t + T * 1000;
        if (!to.ok(land) || !to.ok(land + 250)) return;
        const sb = to.span(land);
        const gap = Math.max(0, sb.a - sa.b, sa.a - sb.b) + 0.5; // pisar al menos medio tile
        if (gap * TILE_PX <= RUN * T * reachMult) pending.push([Math.ceil(land / DT) * DT, j]);
      });
    }
    // aterrizajes que ocurren en este paso
    for (let k = pending.length - 1; k >= 0; k -= 1) {
      if (pending[k][0] <= t + DT) { next.add(pending[k][1]); reachedAt[pending[k][1]] = Math.min(reachedAt[pending[k][1]], pending[k][0]); pending.splice(k, 1); }
    }
    // los islotes, una vez alcanzados, lo están para siempre
    surf.forEach((s, j) => { if (s.island && reachedAt[j] <= t + DT) next.add(j); });
    cur = next;
  }
  return { reachedGoal: reachedAt[goalIdx] < Infinity, goalAt: reachedAt[goalIdx], reachedAt };
}
let pending = [];

test('act2: sin suelo, la meta se alcanza saltando entre plataformas que se rompen', () => {
  const def = LEVEL_DATA.act2;
  assert.equal(def.moverTrap, 'cycle');
  assert.ok(def.ground.length <= 4 && def.ground.every(([a, b]) => b - a <= 12), 'solo islotes cortos');
  assert.ok(def.platforms.every((p) => p.type === 'moving'), 'todas las plataformas se mueven');
  pending = [];
  const r = cycleSim(def);
  assert.ok(r.reachedGoal, `meta inalcanzable; alcanzadas: ${r.reachedAt.map((x) => (x < Infinity ? 1 : 0)).join('')}`);
  // Debe poder completarse en un tiempo razonable (no exige esperas absurdas).
  assert.ok(r.goalAt < 120000, `demasiado lento: ${r.goalAt} ms`);
});
