/**
 * Pruebas de las reglas confirmadas de rutas y progresión (sin navegador).
 * Ejecutar: npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, STORY } from '../src/managers/GameState.js';
import { SaveManager } from '../src/managers/SaveManager.js';
import { LEVELS, VN_SCENES } from '../src/config/constants.js';

function walk() {
  const steps = [GameState.currentStep()];
  while (steps.at(-1).type !== 'ending') steps.push(GameState.advanceStory());
  return steps;
}

beforeEach(() => {
  SaveManager._reset();
  GameState.newGame();
});

test('ruta pacifista: sin muertes incluye el Acto 4 y termina en el final IF', () => {
  const steps = walk();
  assert.ok(steps.some((s) => s.id === LEVELS.ACT4));
  assert.ok(steps.some((s) => s.id === VN_SCENES.AFTER_ACT4));
  assert.equal(steps.at(-1).id, VN_SCENES.ENDING_IF);
});

test('ruta convencional: una muerte salta el Acto 4 y lleva al final convencional', () => {
  GameState.advanceStory(); // act1
  GameState.registerKill();
  const steps = walk();
  assert.ok(!steps.some((s) => s.id === LEVELS.ACT4));
  assert.ok(!steps.some((s) => s.id === VN_SCENES.AFTER_ACT4));
  assert.equal(steps.at(-1).id, VN_SCENES.ENDING_CONVENTIONAL);
});

test('el orden de la historia es el especificado', () => {
  const ids = walk().map((s) => s.id ?? s.type);
  assert.deepEqual(ids, [
    VN_SCENES.INTRO, LEVELS.ACT1, VN_SCENES.AFTER_ACT1, LEVELS.ACT2, VN_SCENES.AFTER_ACT2,
    LEVELS.ACT3, VN_SCENES.AFTER_ACT3, LEVELS.ACT4, VN_SCENES.AFTER_ACT4,
    VN_SCENES.BEFORE_BOSS, LEVELS.BOSS, VN_SCENES.ENDING_IF,
  ]);
});

test('enemiesKilled persiste entre niveles y al recargar; solo newGame lo reinicia', () => {
  GameState.registerKill();
  GameState.registerKill();
  GameState.advanceStory();
  assert.equal(GameState.enemiesKilled, 2);
  // Simula recargar la página / "Continuar"
  GameState.loadGame();
  assert.equal(GameState.enemiesKilled, 2);
  assert.equal(GameState.isPacifist(), false);
  GameState.newGame();
  assert.equal(GameState.enemiesKilled, 0);
  assert.equal(GameState.isPacifist(), true);
});

test('el acto 4 solo existe en la historia como paso exclusivo pacifista', () => {
  const act4 = STORY.find((s) => s.id === LEVELS.ACT4);
  assert.equal(act4.pacifistOnly, true);
});

test('la puntuación máxima y el nivel alcanzado se guardan', () => {
  GameState.addScore(1234);
  GameState.advanceStory();
  GameState.advanceStory();
  const save = SaveManager.load();
  assert.ok(save.highScore >= 1234);
  assert.ok(save.maxStoryIndex >= 2);
});

test('el contador de enemigos derrotados está oculto por defecto (no revela la ruta)', () => {
  assert.equal(SaveManager.getSettings().showKills, false);
  SaveManager.setSettings({ showKills: true });
  assert.equal(SaveManager.getSettings().showKills, true);
});

test('cada 10000 puntos se concede una vida; las vidas fuera del nivel se guardan', async () => {
  const { LIFE_EVERY } = await import('../src/managers/GameState.js');
  assert.equal(GameState.addScore(LIFE_EVERY - 1), 0);
  assert.equal(GameState.addScore(1), 1);
  assert.equal(GameState.addScore(LIFE_EVERY * 2), 2);
  assert.ok(GameState.lifeProgress >= 0 && GameState.lifeProgress < 1);
  GameState.grantBonusHeart();
  assert.equal(GameState.consumeBonusHeart(), true);
  assert.equal(GameState.consumeBonusHeart(), false);
});
