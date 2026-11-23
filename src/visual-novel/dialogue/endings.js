import { a, bg, d, hide, music, n, sfx, show } from './lines.js';

const sacrifice = [
  bg('crystal'),
  music('protectYou', { gain: 0.58, loop: false, fadeMs: 1400 }),
  show('aine', 'llorando'),
  n('Puedes oler el exhalo de la bestia atrás tuyo. Volteas. Está a varios metros, pero corre hacia ti.'),
  n('En un instante de desesperación volteas hacia Aine. Ella te regresa la mirada. Sonríes, y comienzas a llorar.'),
  d('Aidan', 'Aine... no es tu culpa. Gracias por todo.', 'triste'),
  d('Aine', 'Que... ¡¿Qué pasa?!', 'sorprendida'),
  n('De tu bolsa mágica, sacas un hechizo de desplazamiento. Un hechizo que puede desplazar objetos grandes distancias... sin embargo, debe tener un punto de anclaje.'),
  n('La piedra está muy lejos como para usarla... no hay nada en el suelo.'),
  n('Cargas a Aine rápido. Nunca pudiste dominar el hechizo, puesto que los nervios siempre te hacían fallar el impulso. Sin embargo, durante un instante, recuerdas todo lo que viviste con Aine. La ves y aprecias su rostro, y te imaginas que quizás, aunque Blair ya no esté aquí, ver el rostro de Aine cada mañana no hubiera estado tan mal. Te centras en su peso, en su calidez, en su miedo. Sientes el retumbar de la planta de tus pies poco a poco volverse un hormigueo. Y todo eso, que en instantes parece una eternidad, te trae calma.', 'triste'),
  n('Vuelves al instante presente, tal como te aconsejó Aine.'),
  n('Conjuras unas palabras.'),
  n('Aine voltea, y parece conocer el hechizo. Trata de aferrarse a ti con ojos desesperados.'),
  sfx('teleport', { volume: 0.38 }),
  n('El impulso del hechizo surte efecto....'),
  n('Aine sale disparada hacia el portal antes de que te sujetara, y tú ves cómo se aleja, mientras una presión en el pecho te dispara hacia la bestia.'),
  d('Aine', '¡Aidaaaaaaan!', 'llorando'),
  n('Ves a Aine mirarte con lágrimas, y tú, al recordar a Blair a través de sus ojos, le regresas la misma sonrisa que ella expresó contigo.'),
  n('Aine atraviesa el portal.'),
  sfx('portal', { volume: 0.4 }),
  hide('aine'),
  n('Ya no la logras ver, y una lágrima se te escapa.'),
  n('Te golpeas contra la bestia. Pero ella parece detenerse.'),
  d('Morrigannus', 'Qué inútil, Aidan.'),
  a('Volteas consternado a la bestia.'),
  d('Aidan', '¿Conoces mi nombre?', 'sorprendido'),
  d('Morrigannus', 'Me llevas buscando durante gran parte de tu vida... y justo cuando me encuentras, no me quieres ver más... qué inútil.'),
  n('Sonríes. Y cierras los ojos.'),
  d('Aidan', 'Solo espero poder verlos una vez más... llegó la hora, supongo.', 'triste'),
  n('Escuchas un estruendo.'),
  hide('aidan'),
  n('...'),
];

const wheatDawn = bg('wheat', { sunrise: true });

const conventional = [
  wheatDawn,
  music('endingTitle', { gain: 0.46, fadeMs: 1200 }),
  n('En un llano de trigo, lejos de su ciudad natal, Aine vislumbra un amanecer más triste que otros días. Sin embargo, al recordar a Aidan, logra conciliar la tragedia que vivió.'),
  n('Han pasado meses desde que Aidan murió; al igual que su hermana y su padre.'),
  bg('library'),
  n('Aine logró conseguir un trabajo en la biblioteca del pueblo, y descubrió su afición por escribir: quisiera escribir historias sobre Aidan, Blair, Ciara y Callum, y sobre su padre y su hermana, así, compartirlas con el mundo para mantener su recuerdo.'),
  bg('bakery'),
  n('Por las tardes, al caer la noche, visita una panadería cercana al pueblo. Compró el pan más difícil de hacer, que lleva el nombre de “mariposa de fuego”; en honor a los animales de las mismas especies que viven solo un año, y mueren al caer el invierno.'),
  n('Aine preguntó por la maravillosa historia de aquel pan, y tras comprarlo, preguntó al panadero quién había sido el autor de ese nombre.'),
  n('Sonrió con tristeza cuando le contestaron'),
  d('???', 'Aidan.'),
  bg('mountainCamp'),
  n('Hoy comienza el invierno, y Aine se prepara para acampar en la cima de una montaña. No sabe qué camino escoger: ¿ira o aceptación? Pues, a pesar de que todo ya pasó, a pesar de la resiliencia, no puede dejar de pensar en lo injusto de la vida a veces.'),
  n('Esta noche, Aine se prepara para un viaje a la montaña, y lo único que ronda por su mente, es que le vendría bien un mago de fuego...'),
];

const ifEnding = [
  wheatDawn,
  music('endingTitle', { gain: 0.46, fadeMs: 1200 }),
  n('En un llano de trigo, lejos de su ciudad natal, Aine vislumbra un amanecer más triste que otros días. Sin embargo, al recordar a Aidan, logra conciliar la tragedia que vivió.'),
  n('Han pasado meses desde que Aidan murió; al igual que su hermana y su padre.'),
  bg('library'),
  n('Aine logró conseguir un trabajo en la biblioteca del pueblo, y descubrió su afición por escribir. Escribió historias sobre Aidan, Blair, Ciara y Callum. Sobre su padre y su hermana. Las compartió con el mundo para que su recuerdo se mantuviera vivo.'),
  n('Una mañana, tras dar a conocer la historia de Aidan, varios slimes, aliens y esqueletos visitaron su tienda para comprar el libro de su leyenda, y ellos la esparcieron a sus hijos. Una leyenda que hablaba de varias guerras, externas e internas, pero también de bondad, y en especial, la historia de un hombre que, buscando la muerte, encontró la vida.'),
  bg('bakery'),
  n('Por las tardes, al caer la noche, Aine visita una panadería cercana al pueblo. Compró el pan más difícil de hacer, que lleva el nombre de “mariposa de fuego”; en honor a los animales de las mismas especies que viven solo un año, y mueren al caer el invierno.'),
  n('Aine preguntó por la maravillosa historia de aquel pan, y tras comprarlo, preguntó al panadero quién había sido el autor de ese nombre.'),
  n('Sonrió con tristeza cuando le contestaron:'),
  d('???', 'Aidan.'),
  bg('mountainCamp'),
  n('Hoy comienza el invierno, y Aine se prepara para acampar en la cima de una montaña. Llevó chocolate en polvo, y agua.'),
  n('Mira expectante las increíbles auroras que quizás puedan aparecer esa noche. En el cielo hay varias estrellas. Aine se pregunta si Aidan se habría convertido en una de ellas.'),
  n('Si siguiera aquí... ¿qué haría?'),
  n('Esta noche, Aine se prepara para un viaje a la montaña, y aunque le vendría bien un mago de fuego, aunque con añoranza quisiera probar los labios de Aidan de nuevo, aunque suele llorar por las noches, recuerda el consejo de Aidan para evitar el frío.'),
  n('Y así, sonríe. Y piensa que debe seguir su vida, que debe continuar. Solo así mantendría el recuerdo de Aidan vivo.'),
  n('El atardecer no se hace esperar, y aunque Aine no fue buena con los animales nunca, durante el camino, una mariposa de fuego decide acompañarla...'),
];

export const conventionalEnding = [...sacrifice, ...conventional];
export const ifEndingScript = [...sacrifice, ...ifEnding];

