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
