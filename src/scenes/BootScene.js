import Phaser from 'phaser';
import { SCENES } from '../config/constants.js';

/** Arranque mínimo: genera texturas procedurales y pasa a la carga de assets. */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT);
  }

  create() {
    this.scene.start(SCENES.PRELOAD);
  }
}
