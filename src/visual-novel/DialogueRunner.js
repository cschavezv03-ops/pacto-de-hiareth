const LINE_TYPES = new Set(['dialogue', 'narration', 'action']);

/** Interpreta comandos de contenido sin depender de Phaser ni de la presentación. */
export default class DialogueRunner {
  constructor(commands, { onLine, onCommand, onComplete }) {
    this.commands = commands ?? [];
    this.onLine = onLine;
    this.onCommand = onCommand;
    this.onComplete = onComplete;
    this.index = 0;
    this.waitingForLine = false;
    this.waitingForCommand = false;
    this.finished = false;
    this.destroyed = false;
  }

  start() {
    this.advance();
  }

  advance() {
    if (this.destroyed || this.finished || this.waitingForLine || this.waitingForCommand) return;

    while (this.index < this.commands.length) {
      const command = this.commands[this.index++];
      if (LINE_TYPES.has(command.type)) {
        this.waitingForLine = true;
        this.onLine?.(command);
        return;
      }

      const result = this.onCommand?.(command);
      if (result && typeof result.then === 'function') {
        this.waitingForCommand = true;
        result.then(() => {
          if (this.destroyed) return;
          this.waitingForCommand = false;
          this.advance();
        }).catch((error) => {
          this.waitingForCommand = false;
          throw error;
        });
        return;
      }
    }

    this.finished = true;
    this.onComplete?.();
  }

  next() {
    if (this.destroyed || this.finished || !this.waitingForLine) return;
    this.waitingForLine = false;
    this.advance();
  }

  destroy() {
    this.destroyed = true;
    this.onLine = null;
    this.onCommand = null;
    this.onComplete = null;
  }
}
