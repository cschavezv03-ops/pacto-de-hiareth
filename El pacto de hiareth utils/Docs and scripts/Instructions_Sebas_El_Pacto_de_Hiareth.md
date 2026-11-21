EL PACTO DE HIARETH

Instrucciones de implementación para Sebas

Gameplay · Platformer 2D · Combate · Enemigos · Boss Bullet Hell


## 1. Propósito y alcance

Este documento especifica el trabajo de Sebas en El Pacto de Hiareth. Su responsabilidad comprende el gameplay de plataformas y exploración, las físicas, el combate, los enemigos, los obstáculos, las colisiones, el sistema de daño y el enfrentamiento final Bullet Hell contra Morrigannus.

La experiencia alterna escenas de Visual Novel (VN) y niveles de plataformas. La implementación de diálogos, retratos, fondos narrativos, presentación de escenas VN y su interfaz corresponde a Frank. Sebas debe integrar su gameplay con esas escenas mediante interfaces y contratos compartidos, sin modificar unilateralmente los sistemas globales.


## 2. Tecnologías y criterios generales

- Motor: Phaser.js. Lenguaje: JavaScript. Plataforma: navegador web.

- Usar Phaser Arcade Physics para movimiento, gravedad, colisiones, overlaps y proyectiles, salvo que exista una razón técnica documentada para otra solución.

- Mantener el código modular, legible y reutilizable. Evitar IA compleja y sistemas que no aporten al alcance del proyecto.

- Priorizar una implementación funcional, estable y sencilla. Los valores de balance no definidos expresamente en este documento quedan a criterio de Sebas.

- No agregar contenido, enemigos, secciones o mecánicas solo para alargar los niveles.


## 3. Estructura de progresión

La progresión es lineal, de izquierda a derecha, y contiene un nivel por acto cuando corresponde. No se deben crear subdivisiones artificiales.


## 4. Escenarios y construcción de niveles

Los fondos proporcionados para cada acto representan el escenario visual completo del nivel; no son mapas jugables ni definen por sí solos la geometría de colisión. El suelo jugable, plataformas, obstáculos y colisiones deben construirse por separado.

- Acto 1: fondo de campo verde, bosque de coníferas, montañas nevadas, rocas y vegetación.

- Acto 2: fondo de ciudad devastada, edificios, ovnis y haces de luz alienígenas.

- Acto 3: fondo de aldea medieval oscura, casas, árboles secos y camino, con paleta morada/violeta.

- Acto 4: fondo de paisaje nevado nocturno, árboles cubiertos de nieve, montañas y luna.

- Acto final: fondo de cielo nocturno azul/violeta, luna roja y árboles secos; se utiliza como arena del jefe.

El recorrido de los niveles será lineal. El terreno jugable no necesita reproducir exactamente los desniveles dibujados en el fondo. Sebas define la cantidad y distribución de plataformas, obstáculos y enemigos, respetando el escenario, la progresión y una dificultad razonable.


## 5. Aidan: movimiento, ataque y supervivencia


### 5.1. Personaje y animaciones

Aidan es el protagonista controlable y es un mago de fuego. Los sprites incluidos en Sprites.rar se consideran definitivos.

Animaciones disponibles: Idle, Run, Jump, Fall, Attack 1, Attack 2, Take hit y Death.

Attack 1 y Attack 2 se consideran variantes de la misma acción de ataque, no dos habilidades independientes. No se han solicitado combos ni habilidades adicionales.


### 5.2. Movimiento y controles

- Platformer: desplazamiento lateral con A/D o flechas; salto con Espacio.

- Ataque en niveles: J o clic izquierdo. Debe existir una única acción de ataque cuerpo a cuerpo.

- El salto es simple: no implementar doble salto.

- Aidan puede moverse, saltar y atacar desde el suelo.

- El dash no está decidido como requisito: Sebas decidirá durante la implementación si conviene incluirlo, según el diseño de niveles y el alcance.

- En el Bullet Hell: WASD para movimiento libre en cuatro direcciones y J para disparar.


### 5.3. Combate y vida

- Aidan dispone de 3 corazones.

- Cada impacto válido resta 1 corazón.

- Tras recibir daño, Aidan obtiene 1 segundo de invulnerabilidad. Durante ese tiempo puede seguir moviéndose y atacando.

- Puede utilizarse la animación Take hit y un efecto visual de parpadeo para representar el daño/invulnerabilidad.

- No se recuperan corazones durante un nivel.

- Al perder los 3 corazones, se produce Game Over y se reinicia el nivel actual desde el principio. No hay checkpoints definidos.


## 6. Rutas y contador de enemigos derrotados

Existen dos rutas narrativas: pacifista y convencional. El jugador no debe recibir información explícita sobre cuál está siguiendo.

- La ruta pacifista exige que Aidan no mate ningún enemigo durante toda la partida.

- La ruta convencional se activa cuando Aidan mata al menos un enemigo.

- Regla interna: enemiesKilled == 0 implica ruta pacifista; enemiesKilled > 0 implica ruta convencional.

- No mostrar contador, mensajes, avisos, indicadores ni retroalimentación explícita sobre la ruta.

- El jugador conserva la libertad de atacar. No deshabilitar el ataque en la ruta pacifista.

- Esquivar, recibir daño, escapar o dejar enemigos atrás no incrementa el contador.

- Un enemigo que cae fuera del escenario o desaparece por una circunstancia ambiental no cuenta como una muerte causada por Aidan.

- Solo incrementa enemiesKilled cuando Aidan derrota directamente a un enemigo.

- El contador se conserva entre escenas y niveles, y se reinicia únicamente al iniciar una partida nueva.

- Al reiniciar el nivel por Game Over, todos los enemigos de ese nivel reaparecen en su estado inicial; sin embargo, enemiesKilled conserva las muertes acumuladas previamente en la partida. Morir no debe permitir recuperar la ruta pacifista.

Importante: el Acto 4 existe únicamente en la ruta pacifista. La ruta convencional no debe acceder a ese nivel. El desenlace se determina internamente y sus consecuencias se revelan mediante la narrativa.


## 7. Enemigos normales

Hay tres tipos de enemigos normales, asociados a los tres primeros actos. Sus comportamientos deben ser sencillos, diferenciados y reutilizables; no se requiere IA compleja.


### 7.1. Reglas compartidas

- Cada enemigo inflige 1 corazón de daño a Aidan por impacto.

- El contacto con un enemigo provoca daño, sujeto al segundo de invulnerabilidad de Aidan.

- Aidan debe poder evitar matar enemigos saltándolos o esquivándolos; el contacto sigue siendo peligroso.

- Los enemigos que Aidan deja atrás permanecen en su zona y no lo persiguen indefinidamente.

- Los enemigos derrotados no reaparecen al retroceder dentro del mismo nivel.

- Si Aidan reinicia el nivel tras Game Over, todos los enemigos de ese nivel reaparecen.

- Los enemigos que caigan o desaparezcan por causas ambientales no incrementan enemiesKilled.


### 7.2. Comportamiento y proyectiles del alien

- Solo el alien utiliza ataques a distancia.

- Los proyectiles del alien deben ser lentos y relativamente fáciles de esquivar.

- Al disparar, el alien calcula la posición actual de Aidan y lanza el proyectil en esa dirección.

- La trayectoria es fija: el proyectil no corrige su rumbo ni persigue a Aidan.

- El alien dispara mediante un temporizador de intervalo fijo. No se requiere un sistema complejo de detección de proximidad.

- El disparo puede ejecutarse mediante temporizador sin comprobar si Aidan está cerca o visible; priorizar la solución más sencilla.

- Los proyectiles desaparecen al salir de los límites del escenario.

- Si Aidan recibe daño, los proyectiles continúan su trayectoria. La invulnerabilidad de Aidan impide recibir daño adicional durante ese segundo.

Los valores exactos del intervalo de disparo, velocidad del proyectil y alcance se dejan a criterio de Sebas durante las pruebas de balance.


## 8. Acto 4: recorrido pacifista

El Acto 4 — Don't Try… (IF) es exclusivo de la ruta pacifista. Es un recorrido tranquilo y no contiene enemigos. Su desafío se basa en el desplazamiento y los obstáculos/elementos ambientales que Sebas considere adecuados. No añadir enemigos a este acto.


## 9. Jefe final: Morrigannus (Bullet Hell)

El acto final consiste únicamente en el enfrentamiento contra Morrigannus. No debe añadirse un nivel de plataformas previo. La referencia de diseño es el género Bullet Hell, inspirado en la estructura de patrones de Touhou Project, sin copiar personajes, patrones visuales o contenido protegido.


### 9.1. Presentación y movimiento

- Morrigannus permanece fijo en una posición de la arena.

- Su única animación es Idle, compuesta por 8 fotogramas. No implementar animaciones de ataque, daño ni muerte.

- La arena utiliza el fondo proporcionado de la luna roja.

- Aidan vuela y se mueve libremente en cuatro direcciones dentro de los límites de la arena.

- Controles: WASD para moverse y J para disparar.


### 9.2. Ataques y patrones

- Aidan dispara proyectiles mágicos de fuego. Cada pulsación de J lanza un único proyectil; no es un disparo automático ni requiere mantener pulsado el botón.

- Aidan puede moverse y disparar simultáneamente.

- Los proyectiles de Aidan pueden representarse con esferas sencillas de fuego generadas por Phaser; no se requieren sprites adicionales.

- Morrigannus utiliza proyectiles Bullet Hell representados mediante esferas mágicas rojas o violetas generadas por Phaser; no se requieren sprites adicionales.

- Patrones base: abanico (varios proyectiles en distintas direcciones) y círculo (proyectiles distribuidos alrededor del jefe).

- No implementar el patrón de lluvia por ahora.

- Usar una función reutilizable para generar proyectiles, parametrizando dirección, velocidad y cantidad.


### 9.3. Dificultad, vida y derrota

- La dificultad aumenta de forma progresiva y continua durante el combate. No se requieren fases ni transiciones entre fases.

- Comenzar con pocos proyectiles y aumentar gradualmente la cantidad, velocidad o intensidad.

- Objetivo de duración: aproximadamente 3–4 minutos.

- Dificultad intermedia: patrones variados, velocidad moderada al inicio y margen razonable para esquivar.

- Morrigannus tiene una barra de vida visible que disminuye al recibir impactos de los proyectiles de Aidan.

- Aidan conserva 3 corazones y 1 segundo de invulnerabilidad, igual que en los niveles.

- Al perder los 3 corazones, se reinicia el enfrentamiento.

La vida exacta del jefe, el daño por proyectil, la cadencia de disparo de Aidan, la velocidad de movimiento, las velocidades de proyectiles, las hitboxes y los intervalos de patrones quedan a criterio de Sebas. Deben balancearse mediante pruebas para aproximarse a la duración y dificultad indicadas.


## 10. Audio y recursos

- El proyecto contará con el soundtrack que proporcione el equipo.

- Sebas debe integrar el soundtrack en los segmentos de gameplay que correspondan y coordinar cambios de música con las transiciones de escena.

- La selección, obtención e implementación de efectos de sonido del gameplay queda a cargo de Sebas.

- El proyecto académico requiere música de fondo, al menos dos efectos de sonido y un control de mute. Coordinar la ubicación del control de audio con Frank para evitar duplicar interfaces.


## 11. Integración con Frank y sistemas compartidos

Frank implementa la Visual Novel. Sebas implementa el gameplay. Ambos deben coordinar los siguientes contratos:

- Transiciones entre escenas VN y niveles, incluyendo el orden de los actos y el acceso condicional al Acto 4.

- Estado global de partida y contador enemiesKilled, con persistencia entre escenas/niveles.

- Inicio de partida nueva, pausa, Game Over, reinicio de nivel y desenlace.

- Resolución, escalado, carga de recursos y comportamiento responsive.

- Audio global: soundtrack, efectos y mute.

- Evitar que cualquiera de los dos sobrescriba o cambie unilateralmente la arquitectura o el estado compartido.

Antes de integrar, acordar nombres de escenas, funciones de entrada/salida y estructura del estado global. El gameplay debe exponer puntos claros de transición hacia las escenas VN y recibir el estado de partida sin duplicar ni reiniciar indebidamente enemiesKilled.


## 12. Requisitos técnicos y académicos que debe cubrir el gameplay

- Escenas Phaser organizadas y flujo completo de menú, juego, pausa, Game Over y reinicio, coordinado con Frank.

- Movimiento del jugador, físicas, colisiones, overlaps, triggers y proyectiles.

- HUD visible para la vida de Aidan y, durante el boss, la vida de Morrigannus.

- Enemigos y retos funcionales, condiciones de victoria y derrota.

- Persistencia localStorage de High Score, nivel alcanzado y configuración de audio, coordinada con el sistema global.

- Controles de teclado/mouse y controles táctiles equivalentes para dispositivos móviles, coordinados con la integración general.

- Diseño responsive para escritorio, tablet y móvil.

- Objetivo de rendimiento mínimo de 45 FPS, evitando congelamientos y cargas innecesarias.

- Instrucciones visibles y contraste suficiente en la interfaz de gameplay.


## 13. Decisiones delegadas y límites

Para no bloquear el desarrollo, Sebas puede decidir los siguientes detalles técnicos:

- Si conviene implementar dash, según el diseño de niveles y el tiempo disponible.

- Velocidad, aceleración, gravedad, altura de salto y demás parámetros de movimiento.

- Distribución de plataformas, obstáculos, slimes, aliens y esqueletos.

- Patrones de patrulla y aproximación sencillos de cada enemigo, manteniendo las reglas confirmadas.

- Intervalo fijo de disparo del alien y parámetros de sus proyectiles.

- Valores de vida/daño del jefe, cadencia de disparo de Aidan, velocidades, hitboxes e intervalos de patrones.

- Selección e implementación de efectos de sonido.

La delegación no autoriza a cambiar decisiones confirmadas: número de corazones, golpes necesarios para derrotar cada enemigo, regla de rutas, actos, ausencia de enemigos en el Acto 4, comportamiento básico de proyectiles del alien ni alcance del boss.


## 14. Criterios de aceptación

- Los niveles 1, 2 y 3 son recorridos laterales lineales con sus enemigos correspondientes y transiciones narrativas previstas.

- El Acto 4 solo se carga en la ruta pacifista y no contiene enemigos.

- El jugador puede completar los niveles sin matar enemigos; el contacto sigue causando daño.

- La ruta se determina por muertes directas causadas por Aidan, sin mostrar información explícita al jugador.

- Morir reinicia el nivel y sus enemigos, pero no borra las muertes acumuladas en la partida.

- Los enemigos dejados atrás no persiguen indefinidamente; los derrotados no reaparecen al retroceder en el mismo intento.

- Solo los aliens lanzan proyectiles normales; son lentos, de trayectoria fija y no persiguen al jugador.

- El Acto final es un Bullet Hell de 3–4 minutos aproximados, con Morrigannus fijo, patrones de abanico y círculo, y dificultad progresiva.

- El jugador puede perder y reiniciar el enfrentamiento; al ganar, el juego continúa al desenlace narrativo.

- El gameplay se integra con la VN de Frank sin duplicar ni romper el estado global.


## 15. Comunicación y entregables de Sebas

- Implementación funcional del gameplay descrito en este documento.

- Código organizado y modular, con instrucciones para ejecutar el proyecto.

- Lista de escenas y contratos de integración utilizados para conectar gameplay y VN.

- Registro breve de parámetros de balance que Sebas haya elegido y de cualquier desviación técnica necesaria.

- Pruebas manuales de movimiento, colisiones, daño, rutas, reinicio, enemigos, proyectiles y boss.

- Avisar al equipo antes de modificar sistemas compartidos o decisiones confirmadas.

Fin del documento



| Motor y lenguaje | Phaser.js + JavaScript |

| --- | --- |

| Plataforma objetivo | Navegador web |

| Responsabilidad | Implementación integral del gameplay |



| Sección | Implementación requerida |

| --- | --- |

| Prólogo / introducción | Escena narrativa. Sin nivel de plataformas. |

| Acto 1 — Tierra, mar y cielo | Nivel 1 de plataformas. Enemigos: slimes. Al terminar, transición a VN donde Aidan conoce a Aine. |

| Acto 2 — Vuela alto | Nivel 2 de plataformas. Enemigos: aliens. Al llegar al portal, termina el gameplay y se pasa a VN; Aine alcanza a Aidan. |

| Acto 3 — Limbo | Nivel 3 de plataformas. Enemigos: esqueletos. Al llegar a la casa abandonada/refugio, transición a VN sobre pérdidas, familias y esperanza. |

| Acto 4 — Don't Try… (IF) | Solo en la ruta pacifista. Recorrido tranquilo sin enemigos, con obstáculos/elementos ambientales. Al llegar al campamento, transición a VN sobre chocolate, auroras boreales e historias de las razas. |

| Acto final — Hiraeth | No hay nivel de plataformas previo. Consiste únicamente en el combate Bullet Hell contra Morrigannus y luego la transición narrativa al desenlace. |



| Enemigo | Acto | Resistencia | Ataque |

| --- | --- | --- | --- |

| Slime | Acto 1 | 4 golpes | Ataque por contacto. Sin proyectiles. |

| Alien | Acto 2 | 6 golpes | Ataque por contacto y proyectiles a distancia. |

| Esqueleto | Acto 3 | 8 golpes | Ataque por contacto. Sin proyectiles. |
