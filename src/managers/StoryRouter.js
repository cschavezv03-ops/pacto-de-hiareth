/**
 * Router global de la historia (CONTRATO DE INTEGRACIÓN).
 *
 * Cualquier escena (VN o gameplay) que termine hace:
 *     const next = GameState.advanceStory();
 *     this.game.events.emit('story:goto', next);
 * El router detiene las escenas activas de juego y arranca la escena del paso:
 *   { type: 'vn', id }     -> SCENES.VN     con { sceneId: id }
 *   { type: 'level', id }  -> SCENES.LOADING -> SCENES.LEVEL con { levelId: id }
 *   { type: 'boss' }       -> SCENES.LOADING -> SCENES.BOSS
 *   { type: 'ending', id } -> SCENES.VN     con { sceneId: id, isEnding: true }
 */
import { SCENES } from '../config/constants.js';
import { AudioManager } from './AudioManager.js';

const MANAGED = [SCENES.VN, SCENES.LEVEL, SCENES.BOSS, SCENES.HUD, SCENES.PAUSE, SCENES.GAME_OVER, SCENES.BOSS_DEFEAT, SCENES.LOADING, SCENES.MENU, SCENES.ENDING];

export function goToStep(game, step) {
  const sm = game.scene;
  // Las operaciones del SceneManager se encolan: primero detener, luego arrancar.
  for (const key of MANAGED) {
    if (sm.isActive(key) || sm.isPaused(key) || sm.isSleeping(key)) sm.stop(key);
  }
  switch (step.type) {
    case 'vn':
      sm.start(SCENES.VN, { sceneId: step.id });
      break;
    // Niveles y jefe pasan por su pantalla de carga (solo la del paso real siguiente).
    case 'level':
      sm.start(SCENES.LOADING, { step });
      break;
    case 'boss':
      sm.start(SCENES.LOADING, { step });
      break;
    case 'ending':
      AudioManager.stopMusic();
      sm.start(SCENES.VN, { sceneId: step.id, isEnding: true });
      break;
    default:
      sm.start(SCENES.MENU);
  }
}

export function installStoryRouter(game) {
  let pending = null;
  game.events.on('story:goto', (step) => {
    // Diferido: el evento suele emitirse desde un callback dentro del paso de una
    // escena (p. ej. fin de un fade de cámara). Parar escenas ahí mismo las destruye
    // a mitad de su ciclo. Se ejecuta fuera del bucle de Phaser y solo el último paso.
    const first = pending === null;
    pending = step;
    if (first) {
      setTimeout(() => {
        const next = pending;
        pending = null;
        goToStep(game, next);
      }, 0);
    }
  });
}
