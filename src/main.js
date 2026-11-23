import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config/constants.js';
import { installStoryRouter } from './managers/StoryRouter.js';
import { GameState } from './managers/GameState.js';
import BootScene from './scenes/BootScene.js';
import PreloadScene from './scenes/PreloadScene.js';
import MenuScene from './scenes/MenuScene.js';
import VNScene from './scenes/VNScene.js';
import LevelScene from './scenes/LevelScene.js';
import BossScene from './scenes/BossScene.js';
import HudScene from './scenes/HudScene.js';
import PauseScene from './scenes/PauseScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import BossDefeatScene from './scenes/BossDefeatScene.js';
import LoadingScene from './scenes/LoadingScene.js';
import ChapterCardScene from './scenes/ChapterCardScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0d0a18',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 900 },
      debug: false,
    },
  },
  fps: { target: 60 },
  // El orden define el dibujo: HUD, Pausa y Game Over por encima del gameplay.
  scene: [BootScene, PreloadScene, MenuScene, ChapterCardScene, VNScene, LevelScene, BossScene, HudScene, PauseScene, GameOverScene, BossDefeatScene, LoadingScene],
};

const game = new Phaser.Game(config);
installStoryRouter(game);

if (import.meta.env.DEV) {
  window.game = game; // depuración y pruebas automatizadas
  window.__GameState = GameState; // misma instancia que usa el juego
}
