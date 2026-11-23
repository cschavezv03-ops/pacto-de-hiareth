import { a, bg, d, hide, music, n, show } from './lines.js';

// Llegada al páramo y el primer rugido. El combate queda en BossScene (PDF, p. 20).
export default [
  bg('crystal'),
  music('calamity', { gain: 0.48, fadeMs: 900 }),
  show('aine', 'determinada'),
  show('aidan', 'determinado'),
  n('En el páramo de cristal, la lucha contra la bestia se intensifica. Aunque Aine quiere ayudarte, procuras que ella salga primero del lugar.'),
  n('Volteas, y la luna del cielo, tan extrañamente grande, se vuelve roja.'),
  n('La bestia produce un sonido gutural, similar al de un ciervo, y ruge hacia ella.'),
  n('El suelo parece desmoronarse.'),
  n('Ya no te importa la piedra, tan solo quieres salir del lugar.'),
  n('Ves el portal a lo lejos, tras el monolito fragmentado de la piedra Lia Fáil. Sostienes a Aine de la mano con mucha fuerza, y corres junto a ella hacia él. El retumbe llega hasta tu cabeza, y logras esquivar un desnivel. Al rato, otro retumbe los aleja de la piedra, pero logran seguir. Sin embargo, a unos metros del portal, Aine cae por culpa del retumbe. Tú te detienes.'),
  hide('aine'),
  hide('aidan'),
];

