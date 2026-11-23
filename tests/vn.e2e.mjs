/** node tests/vn.e2e.mjs [http://localhost:5179]; PW_GPU=0 desactiva los args GPU. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { VN_SCENES } from '../src/config/constants.js';
import { STORY } from '../src/managers/GameState.js';
import { VN_SCRIPTS } from '../src/visual-novel/dialogue/index.js';

const url = process.argv[2] ?? 'http://localhost:5179';
const GPU_ARGS = process.env.PW_GPU === '0' ? [] : [
  '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu',
];
const LOAD_TIMEOUT = 120_000;
const LINE_TYPES = new Set(['dialogue', 'narration', 'action']);
const caseNames = [
  ...Object.values(VN_SCENES).map(id => `a.${id}`),
  'a.after_act3_convencional', 'b.escritura_progresiva', 'c.saltar_boton',
  'd.tab_doble', 'd.tab_caduca',
  ...[VN_SCENES.ENDING_CONVENTIONAL, VN_SCENES.ENDING_IF].map(id => `e.saltar_${id}`),
  'f.reutilizacion', 'g.mute_no_avanza',
];
const results = Object.fromEntries(caseNames.map(name => [name, {
  estado: 'NO_EJECUTADO', pulsaciones: 0, clics: 0, pageerrors: [], vnConsole: [],
}]));
const pageerrors = [];
const vnConsole = [];
let browser;
let page;
let currentCase = 'arranque';
let result;

async function snapshot() {
  return page.evaluate(() => {
    const game = window.game;
    const s = game?.scene.getScene('VisualNovel');
    const r = s?.runner;
    const d = s?.dialogueRenderer;
    return {
      active: game?.scene.isActive('VisualNovel'), sceneId: s?.sceneId,
      scenes: game?.scene.getScenes(true).map(x => x.sys.settings.key),
      currentStep: window.__GameState?.currentStep(),
      index: r?.index, waiting: r?.waitingForLine, busy: r?.waitingForCommand,
      finished: r?.finished, leaving: s?.transitions?.leaving,
      page: d?.pageIndex, pages: d?.pages.length, done: d?.pageDone,
      reveal: d?.revealIndex, total: d?.revealSteps.length,
      text: d?.runObjects.map(x => x.text).join(''),
      target: d?.runObjects.map(x => x.vnTargetText).join(''),
      armed: s?.skipArmed, skipLabel: s?.skipButton?.text,
      listeners: s?.inputController ? {
        keydown: s.input.keyboard.listenerCount('keydown'),
        mute: s.input.keyboard.listenerCount('keydown-M'),
        pointerup: s.input.listenerCount('pointerup'),
        loaderror: s.load.listenerCount('loaderror'),
        shutdown: s.events.listenerCount('shutdown'),
      } : null,
    };
  });
}

async function press(key = 'Enter') {
  result.pulsaciones += 1;
  await page.keyboard.press(key);
  // Dejar que Phaser procese el evento nativo y limpie su cola de teclado.
  await page.waitForTimeout(80);
}

async function startVN(id, { conventional = id === VN_SCENES.ENDING_CONVENTIONAL } = {}) {
  const ending = id === VN_SCENES.ENDING_CONVENTIONAL || id === VN_SCENES.ENDING_IF;
  const index = STORY.findIndex(s => ending ? s.type === 'ending' : s.type === 'vn' && s.id === id);
  assert.ok(index >= 0, `paso STORY para ${id}`);
  // Cerrar primero la escena anterior evita confundir una instancia reutilizada con su reinicio.
  await page.evaluate(() => window.game.events.emit('story:goto', { type: 'menu' }));
  await page.waitForFunction(() => window.game.scene.isActive('Menu') && !window.game.scene.isActive('VisualNovel'), null, { timeout: LOAD_TIMEOUT });
  await page.evaluate(({ index, conventional }) => {
    const gs = window.__GameState;
    gs.newGame(); // Contexto de navegador aislado: no afecta al guardado del usuario.
    if (conventional) gs.registerKill();
    gs.debugJumpTo(index); // startDev devolvería { type: 'dev' } al finalizar.
    window.__vnQA.trace = [];
    window.__vnQA.routes = [];
    window.__vnQA.advanceCalls = 0;
    window.game.events.emit('story:goto', gs.currentStep());
  }, { index, conventional });
  await page.waitForFunction(id => {
    const s = window.game.scene.getScene('VisualNovel');
    return s.sys.isActive() && s.sceneId === id && s.runner?.waitingForLine && !s.transitions.leaving;
  }, id, { timeout: LOAD_TIMEOUT });
  const state = await snapshot();
  assert.equal(state.currentStep.id, id);
  assert.equal(state.index, VN_SCRIPTS[id].findIndex(c => LINE_TYPES.has(c.type)) + 1);
  let nextIndex = index + 1;
  while (STORY[nextIndex]?.pacifistOnly && conventional) nextIndex += 1;
  return { id, ending, expected: ending ? { type: 'menu' } : STORY[nextIndex], current: state.currentStep };
}

async function destination(spec) {
  await page.waitForFunction(({ id, expected }) => {
    const sm = window.game.scene;
    if (expected.type === 'menu') return sm.isActive('Menu') && !sm.isActive('VisualNovel');
    if (expected.type === 'vn') {
      const vn = sm.getScene('VisualNovel');
      return vn.sys.isActive() && vn.sceneId === expected.id && vn.sceneId !== id && vn.runner?.waitingForLine;
    }
    if (expected.type === 'level') return sm.isActive('Level') && sm.getScene('Level').levelId === expected.id;
    return expected.type === 'boss' && sm.isActive('Boss');
  }, spec, { timeout: LOAD_TIMEOUT });
  // Detectar un segundo avance tardío además del estado inmediatamente tras el fade.
  await page.waitForTimeout(650);
  const state = await snapshot();
  const observation = await page.evaluate(() => ({
    advanceCalls: window.__vnQA.advanceCalls,
    routes: window.__vnQA.routes,
    trace: window.__vnQA.trace,
  }));
  result.destino = { expected: spec.expected, currentStep: state.currentStep, scenes: state.scenes, ...observation };
  assert.deepEqual(state.currentStep, spec.ending ? spec.current : spec.expected, 'currentStep debe avanzar exactamente un paso válido');
  assert.equal(observation.advanceCalls, spec.ending ? 0 : 1, 'número de llamadas reales a advanceStory');
  assert.equal(observation.routes.length, spec.ending ? 1 : 2, 'una ruta de entrada y, salvo final, una de salida');
  if (!spec.ending) assert.deepEqual(observation.routes[1], spec.expected);
  if (spec.expected.type === 'level' || spec.expected.type === 'boss') {
    assert.ok(observation.trace.some(x => x.scene === 'Loading' && x.step?.id === spec.expected.id), 'Loading debe recibir el destino correcto');
  }
  const target = { menu: 'Menu', vn: 'VisualNovel', level: 'Level', boss: 'Boss' }[spec.expected.type];
  assert.ok(state.scenes.includes(target), `destino activo: ${target}`);
}

async function clickUI(kind) {
  const point = await page.evaluate(kind => {
    const s = window.game.scene.getScene('VisualNovel');
    const object = kind === 'skip' ? s.skipButton : s.children.list.find(x => x.input?.enabled && /^icon_sound_/.test(x.texture?.key));
    if (!object) throw new Error(`botón ${kind} no encontrado`);
    const bounds = object.getBounds();
    const canvas = window.game.canvas.getBoundingClientRect();
    return {
      x: canvas.left + bounds.centerX * canvas.width / s.scale.gameSize.width,
      y: canvas.top + bounds.centerY * canvas.height / s.scale.gameSize.height,
    };
  }, kind);
  result.clics += 1;
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(100);
}

async function caseOf(name, fn) {
  currentCase = name;
  result = results[name] = { estado: 'OK', pulsaciones: 0, clics: 0 };
  const started = Date.now();
  const e0 = pageerrors.length;
  const c0 = vnConsole.length;
  try { await fn(); } catch (error) {
    result.estado = 'FALLO';
    result.error = error.stack ?? error.message;
    result.ultimoEstado = await snapshot().catch(() => null);
  }
  result.pageerrors = pageerrors.slice(e0);
  result.vnConsole = vnConsole.slice(c0);
  if (result.pageerrors.length || result.vnConsole.length) result.estado = 'FALLO';
  result.duracionMs = Date.now() - started;
  console.error(`${name}: ${result.estado} (${result.pulsaciones} teclas)`);
}

try {
  browser = await chromium.launch({ args: GPU_ARGS });
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(LOAD_TIMEOUT);
  page.on('pageerror', e => pageerrors.push({ caso: currentCase, message: e.message, stack: e.stack }));
  page.on('console', m => {
    if (['warning', 'warn', 'error'].includes(m.type()) && m.text().includes('[VN]')) {
      vnConsole.push({ caso: currentCase, type: m.type(), text: m.text(), location: m.location() });
    }
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.game?.scene.isActive('Menu') && window.__GameState, null, { timeout: LOAD_TIMEOUT });
  await page.evaluate(() => {
    window.__vnQA = { trace: [], routes: [], advanceCalls: 0 };
    const gs = window.__GameState;
    const originalAdvance = gs.advanceStory;
    // Spy que delega al método real, sin alterar retornos, timers ni transiciones.
    gs.advanceStory = function (...args) {
      window.__vnQA.advanceCalls += 1;
      return originalAdvance.apply(this, args);
    };
    window.game.events.on('story:goto', step => window.__vnQA.routes.push({ ...step }));
    for (const scene of window.game.scene.scenes) {
      scene.events.on('create', () => window.__vnQA.trace.push({
        scene: scene.sys.settings.key, step: scene.step ? { ...scene.step } : undefined,
        sceneId: scene.sceneId, levelId: scene.levelId,
      }));
    }
  });

  for (const id of Object.values(VN_SCENES)) {
    await caseOf(`a.${id}`, async () => {
      const spec = await startVN(id);
      const seen = new Set();
      const deadline = Date.now() + 240_000;
      while (Date.now() < deadline) {
        const s = await snapshot();
        if (!s.active || s.sceneId !== id || s.leaving) break;
        if (s.waiting && !s.busy) {
          seen.add(s.index - 1);
          await press();
        } else await page.waitForTimeout(40); // fondo asíncrono; no enviar Enter al siguiente destino
      }
      result.lineasVisitadas = seen.size;
      assert.ok(Date.now() < deadline, 'timeout recorriendo la VN');
      assert.deepEqual([...seen].sort((a, b) => a - b), VN_SCRIPTS[id].flatMap((c, i) => LINE_TYPES.has(c.type) ? [i] : []), 'ninguna línea debe omitirse');
      await destination(spec);
    });
  }

  await caseOf('a.after_act3_convencional', async () => {
    const spec = await startVN(VN_SCENES.AFTER_ACT3, { conventional: true });
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
      const s = await snapshot();
      if (s.leaving || !s.active || s.sceneId !== spec.id) break;
      if (s.waiting && !s.busy) await press();
      else await page.waitForTimeout(40);
    }
    assert.ok(Date.now() < deadline, 'timeout en ruta convencional');
    await destination(spec);
  });

  await caseOf('b.escritura_progresiva', async () => {
    await startVN(VN_SCENES.INTRO);
    await page.waitForFunction(() => window.game.scene.getScene('VisualNovel').dialogueRenderer.revealIndex > 0);
    const before = await snapshot();
    assert.equal(before.pages, 1, 'línea inicial de una sola página');
    assert.equal(before.done, false);
    assert.ok(before.reveal > 0 && before.reveal < before.total);
    await press();
    const completed = await snapshot();
    assert.equal(completed.index, before.index, 'primer Enter no avanza');
    assert.equal(completed.page, before.page);
    assert.equal(completed.done, true);
    assert.equal(completed.text, completed.target, 'texto completo visible');
    await press();
    const advanced = await snapshot();
    assert.equal(advanced.index, before.index + 1, 'segundo Enter avanza una línea');
    result.indices = [before.index, completed.index, advanced.index];
  });

  await caseOf('c.saltar_boton', async () => {
    const spec = await startVN(VN_SCENES.INTRO);
    const before = await snapshot();
    await clickUI('skip');
    const armed = await snapshot();
    assert.equal(armed.index, before.index, 'clic en Saltar no avanza el runner');
    assert.equal(armed.page, before.page);
    assert.equal(armed.done, false, 'clic tampoco completa la escritura');
    assert.equal(armed.armed, true);
    assert.equal(armed.skipLabel, '¿Saltar escena? ⏭');
    assert.equal(armed.leaving, false);
    await clickUI('skip'); // recalcular bounds: el botón crece al armarse
    await destination(spec);
  });

  await caseOf('d.tab_doble', async () => {
    const spec = await startVN(VN_SCENES.INTRO);
    const before = await snapshot();
    await press('Tab');
    const armed = await snapshot();
    assert.equal(armed.armed, true);
    assert.equal(armed.leaving, false);
    assert.equal(armed.index, before.index);
    await press('Tab');
    await destination(spec);
  });

  await caseOf('d.tab_caduca', async () => {
    const spec = await startVN(VN_SCENES.INTRO);
    const before = await snapshot();
    await press('Tab');
    assert.equal((await snapshot()).armed, true);
    await page.waitForTimeout(3000);
    const expired = await snapshot();
    assert.equal(expired.active, true);
    assert.equal(expired.index, before.index);
    assert.equal(expired.leaving, false);
    assert.equal(expired.armed, false);
    assert.equal(expired.skipLabel, 'Saltar ⏭');
    assert.deepEqual(expired.currentStep, spec.current);
    assert.equal(await page.evaluate(() => window.__vnQA.advanceCalls), 0);
    await press('Tab');
    assert.equal((await snapshot()).leaving, false, 'tras caducar vuelve a armar, no salta');
    await press('Tab');
    await destination(spec);
  });

  for (const id of [VN_SCENES.ENDING_CONVENTIONAL, VN_SCENES.ENDING_IF]) {
    await caseOf(`e.saltar_${id}`, async () => {
      const spec = await startVN(id);
      await clickUI('skip');
      assert.equal((await snapshot()).armed, true);
      await clickUI('skip');
      await destination(spec);
    });
  }

  await caseOf('f.reutilizacion', async () => {
    const rounds = result.rondas = [];
    await page.evaluate(() => { window.__vnQA.instance = window.game.scene.getScene('VisualNovel'); });
    for (let i = 0; i < 4; i += 1) {
      const spec = await startVN(VN_SCENES.INTRO);
      assert.equal(await page.evaluate(() => window.__vnQA.instance === window.game.scene.getScene('VisualNovel')), true);
      const before = await snapshot();
      if (i) assert.deepEqual(before.listeners, rounds[0].listeners, 'listeners estables al reentrar');
      await press();
      const completed = await snapshot();
      assert.equal(completed.index, before.index, 'Enter completa sin saltar línea');
      assert.equal(completed.done, true);
      await press();
      await page.waitForTimeout(150);
      const advanced = await snapshot();
      assert.equal(advanced.index, before.index + 1, 'un Enter, una sola línea incluso tras varios frames');
      rounds.push({ listeners: before.listeners, indices: [before.index, completed.index, advanced.index] });
      await press('Tab');
      await press('Tab');
      await destination(spec);
    }
  });

  await caseOf('g.mute_no_avanza', async () => {
    await startVN(VN_SCENES.INTRO);
    const muteState = () => page.evaluate(async () => (await import('/src/managers/AudioManager.js')).AudioManager.muted);
    const mutedBefore = await muteState();
    const before = await snapshot();
    await clickUI('mute');
    const after = await snapshot();
    assert.equal(await muteState(), !mutedBefore, 'clic cambia realmente mute');
    assert.equal(after.index, before.index);
    assert.equal(after.page, before.page);
    assert.equal(after.done, false, 'mute tampoco completa la línea');
    assert.equal(after.armed, false);
    await clickUI('mute');
    assert.equal(await muteState(), mutedBefore);
    assert.equal((await snapshot()).index, before.index);
  });
} catch (error) {
  results.infraestructura = { estado: 'FALLO', error: error.stack ?? error.message };
} finally {
  if (browser) await browser.close();
}

const failed = Object.values(results).some(r => r.estado !== 'OK') || pageerrors.length > 0 || vnConsole.length > 0;
console.log(JSON.stringify({ url, gpu: process.env.PW_GPU !== '0', estado: failed ? 'FALLO' : 'OK', results, pageerrors, vnConsole }, null, 2));
process.exitCode = failed ? 1 : 0;
