/**
 * Prueba de humo end-to-end en Chromium headless.
 * Uso: npm run dev  (en otra terminal)  y luego  node tests/smoke.mjs http://localhost:5173
 * Recorre: menú -> VN -> cada nivel -> jefe; comprueba errores de consola,
 * que Aidan aterriza, el FPS y guarda capturas en tests/screenshots/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173';
const outDir = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

// GPU (Vulkan/ANGLE) para FPS realistas; PW_GPU=0 fuerza WebGL por software.
const GPU_ARGS = process.env.PW_GPU === '0' ? [] : ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', ...GPU_ARGS] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });

await page.goto(url);
await page.waitForFunction(() => window.game?.scene.isActive('Menu'), null, { timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}01-menu.png` });

const report = {};
const goto = (step) => page.evaluate((s) => window.game.events.emit('story:goto', s), step);

for (const id of ['act1', 'act2', 'act3', 'act4']) {
  await goto({ type: 'level', id });
  await page.waitForFunction(() => window.__level?.player, null, { timeout: 10000 });
  await page.waitForTimeout(1500);
  // Correr a la derecha y saltar un poco.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(800);
  report[id] = await page.evaluate(() => {
    const s = window.__level;
    return {
      onFloor: s.player.body.blocked.down || s.player.body.touching.down,
      x: Math.round(s.player.x), y: Math.round(s.player.y),
      hearts: s.player.hearts,
      enemies: s.enemies.getLength(),
      fps: Math.round(window.game.loop.actualFps),
    };
  });
  await page.screenshot({ path: `${outDir}level-${id}.png` });
}

await goto({ type: 'boss' });
await page.waitForFunction(() => window.__boss?.player, null, { timeout: 10000 });
await page.waitForTimeout(9000);
for (let i = 0; i < 6; i += 1) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(150); }
report.boss = await page.evaluate(() => {
  const b = window.__boss;
  return {
    hearts: b.hearts, bossHealth: b.bossHealth,
    activeBullets: b.bossBullets.countActive(true),
    fps: Math.round(window.game.loop.actualFps),
  };
});
await page.screenshot({ path: `${outDir}boss.png` });

await browser.close();
console.log(JSON.stringify({ report, errors }, null, 2));
process.exit(errors.filter((e) => !e.startsWith('[warning]')).length ? 1 : 0);
