/**
 * Entrada unificada: teclado + ratón + controles táctiles.
 *
 * Acciones: left, right, up, down, jump, attack, pause.
 *   input.isDown('left')       -> mantenido
 *   input.justPressed('jump')  -> flanco de bajada en este frame
 *   input.justReleased('jump') -> flanco de subida en este frame
 * Llamar input.update() al inicio de update() de la escena, antes de consultar.
 *
 * Modo 'platformer': A/D o flechas, Espacio salta, J o clic izquierdo ataca.
 * Modo 'boss':       WASD o flechas (4 direcciones), J (o Espacio/clic) dispara.
 */
import Phaser from 'phaser';
import { TouchControls } from '../ui/TouchControls.js';

const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'pause'];

export class InputManager {
  /**
   * @param {Phaser.Scene} scene
   * @param {'platformer'|'boss'} mode
   */
  constructor(scene, mode = 'platformer') {
    this.scene = scene;
    this.mode = mode;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const kb = scene.input.keyboard;
    this.keys = {
      left: [kb.addKey(K.A), kb.addKey(K.LEFT)],
      right: [kb.addKey(K.D), kb.addKey(K.RIGHT)],
      up: [kb.addKey(K.W), kb.addKey(K.UP)],
      down: [kb.addKey(K.S), kb.addKey(K.DOWN)],
      jump: mode === 'platformer' ? [kb.addKey(K.SPACE), kb.addKey(K.W), kb.addKey(K.UP)] : [],
      attack: mode === 'platformer' ? [kb.addKey(K.J)] : [kb.addKey(K.J), kb.addKey(K.SPACE)],
      pause: [kb.addKey(K.ESC), kb.addKey(K.P)],
    };
    // Evita que Espacio/flechas desplacen la página.
    kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT]);

    this.mouseAttack = false;
    this.onPointerDown = (pointer) => {
      // El clic izquierdo ataca, salvo que sea un toque sobre la UI táctil.
      if (pointer.wasTouch || pointer.button !== 0) return;
      if (pointer.event?.target?.closest?.('.touch-ui')) return;
      this.mouseAttack = true;
    };
    scene.input.on('pointerdown', this.onPointerDown);

    this.touch = new TouchControls(scene, mode);

    // Latch de pulsaciones: una tecla pulsada y soltada dentro del mismo frame
    // no se pierde (el sondeo de isDown no la vería).
    this.latch = {};
    for (const action of ACTIONS) {
      for (const key of this.keys[action]) key.on('down', () => { this.latch[action] = true; });
    }

    this.prev = Object.fromEntries(ACTIONS.map((a) => [a, false]));
    this.curr = { ...this.prev };

    scene.events.once('shutdown', () => this.destroy());
  }

  update() {
    const touch = this.touch.state;
    for (const action of ACTIONS) {
      this.prev[action] = this.curr[action];
      const keyDown = this.keys[action].some((k) => k.isDown);
      // Si el frame anterior ya estaba pulsado, el latch no genera un nuevo flanco.
      const tapped = this.latch[action] && !this.prev[action];
      this.curr[action] = keyDown || Boolean(touch[action]) || tapped;
      this.latch[action] = false;
    }
    if (this.mouseAttack) {
      this.curr.attack = true;
      this.mouseAttack = false;
    }
  }

  isDown(action) {
    return this.curr[action];
  }

  justPressed(action) {
    return this.curr[action] && !this.prev[action];
  }

  justReleased(action) {
    return !this.curr[action] && this.prev[action];
  }

  /** Eje horizontal (-1, 0, 1). */
  axisX() {
    return (this.curr.right ? 1 : 0) - (this.curr.left ? 1 : 0);
  }

  /** Eje vertical (-1, 0, 1); y crece hacia abajo. */
  axisY() {
    return (this.curr.down ? 1 : 0) - (this.curr.up ? 1 : 0);
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.touch.destroy();
  }
}
