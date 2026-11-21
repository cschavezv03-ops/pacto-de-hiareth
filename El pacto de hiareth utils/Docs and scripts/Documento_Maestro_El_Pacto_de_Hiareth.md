# DOCUMENTO MAESTRO DEL PROYECTO

# El Pacto de Hiareth

**Proyecto:** Videojuego web para la asignatura Aplicaciones Web\
**Tecnología principal:** Phaser.js + JavaScript\
**Género:** Visual Novel + Platformer 2D + Bullet Hell\
**Estado:** Diseño general y división inicial del equipo definidos\
**Versión:** 1.0

------------------------------------------------------------------------

# 1. Propósito del documento

Este documento constituye la fuente central de información del
videojuego *El Pacto de Hiareth*.

Su propósito es establecer una visión común del proyecto, documentar las
decisiones aprobadas y servir como referencia compartida para todos los
integrantes y agentes de IA que participen en su desarrollo.

**Este mismo documento será utilizado por Frank y Sebas.** No existirán
dos versiones distintas de la visión general. Cada agente recibirá este
documento maestro junto con instrucciones adicionales específicas de su
responsabilidad.

## 1.1 Reglas de trabajo

1.  No modificar la historia original sin autorización.
2.  No inventar acontecimientos, diálogos, personajes o motivaciones
    para completar vacíos narrativos.
3.  Diferenciar las decisiones confirmadas de las propuestas y
    pendientes.
4.  No implementar mecánicas que contradigan las animaciones
    disponibles.
5.  No asumir que un recurso gráfico está descargado, integrado o tiene
    licencia verificada.
6.  Mantener coherencia entre la Visual Novel y los niveles.
7.  Priorizar la calidad visual y narrativa sin introducir complejidad
    técnica innecesaria.
8.  Explicar y documentar las decisiones de implementación.
9.  Ningún agente debe modificar unilateralmente los sistemas
    compartidos.
10. Si una decisión afecta a ambos desarrollos, debe comunicarse y
    aprobarse antes de implementarla.

------------------------------------------------------------------------

# 2. Visión general

## 2.1 Concepto

*El Pacto de Hiareth* es un videojuego narrativo que combina Visual
Novel y plataformas 2D lateral.

El jugador acompaña a Aidan, un mago de fuego que ha perdido a su
familia y se encuentra atrapado en el dolor, la culpa y la venganza.

Durante su misión conoce a Aine, una elfa que también ha sufrido una
pérdida familiar, pero cuya manera de comprender la muerte y la
naturaleza es diferente.

La experiencia alterna escenas narrativas con niveles jugables. La
historia conserva su importancia, mientras que los niveles permiten
experimentar los conflictos del mundo mediante exploración, saltos,
enemigos y enfrentamientos.

El enfrentamiento final tendrá una estructura Bullet Hell inspirada en
*Touhou Project*.

## 2.2 Identidad del videojuego

  Característica                    Definición
  --------------------------------- ----------------------------------------
  Nombre                            El Pacto de Hiareth
  Motor                             Phaser.js
  Lenguaje                          JavaScript
  Plataforma                        Navegador web
  Perspectiva                       2D lateral
  Géneros                           Visual Novel, Platformer y Bullet Hell
  Estructura                        Narrativa intercalada con gameplay
  Protagonista                      Aidan
  Personaje principal acompañante   Aine
  Antagonista final                 Morrigannus
  Rutas                             Pacifista y convencional

## 2.3 Experiencia buscada

El videojuego debe ofrecer:

-   Una historia emocional centrada en sus personajes.
-   Escenas narrativas visualmente atractivas.
-   Niveles de plataformas que complementen los acontecimientos.
-   Exploración y encuentros con enemigos.
-   Una diferencia significativa entre las rutas.
-   Un enfrentamiento final que contraste con el gameplay habitual.

La sencillez buscada corresponde a la implementación y a las reglas del
juego, no a sacrificar su presentación visual.

------------------------------------------------------------------------

# 3. Estructura general del videojuego

## 3.1 Modelo narrativo

Se utilizará una estructura de narrativa intercalada.

La historia no se presentará íntegramente antes del gameplay. En su
lugar, el jugador alternará entre escenas de Visual Novel y niveles de
plataformas.

La proporción será equilibrada: la narrativa conservará el peso de la
historia original y los niveles tendrán suficiente duración para ofrecer
una experiencia jugable.

También podrán aparecer conversaciones breves durante los niveles o
entre acontecimientos. Estas utilizarán cuadros de diálogo sencillos y
no necesitarán convertirse en escenas completas de Visual Novel.

## 3.2 Estructura de actos

El videojuego tendrá un nivel principal por acto, sin subdividir
artificialmente los niveles.

  -----------------------------------------------------------------------
  Sección                             Contenido
  ----------------------------------- -----------------------------------
  Introducción                        Presentación del Pacto y comienzo
                                      de la misión

  Acto 1 --- Tierra, mar y cielo      Nivel 1

  Acto 2 --- Vuela alto               Nivel 2

  Acto 3 --- Limbo                    Nivel 3

  Acto 4 --- Don't Try... (IF)        Nivel 4, exclusivo de la ruta
                                      pacifista

  Acto final --- Hiraeth              Nivel final y enfrentamiento contra
                                      Morrigannus
  -----------------------------------------------------------------------

La ruta convencional no tendrá el nivel del Acto 4.

La ruta pacifista sí incluirá este acto.

## 3.3 Duración y alcance

La historia original tiene una duración aproximada de 15 minutos.

El videojuego no pretende convertirse en una experiencia excesivamente
larga. La prioridad es adaptar la historia de manera adecuada,
conservando sus momentos importantes y proporcionando niveles con
contenido suficiente.

La duración total de juego todavía está pendiente de establecerse.

------------------------------------------------------------------------

# 4. Historia y universo narrativo

**Fuente primaria:** documento narrativo original entregado por el
equipo.

Esta sección organiza la información conocida para facilitar su uso
durante el desarrollo. No sustituye al documento narrativo original.

## 4.1 Premisa

Aidan es un mago que perdió a su esposa Blair y a sus hijos Callum y
Ciara durante una guerra.

Después de perder a su familia, buscó venganza contra los responsables y
terminó asesinando al antiguo mago de fuego perteneciente al Pacto de
Hiareth.

Posteriormente acepta completar una misión relacionada con el Pacto y la
piedra Lia Fáil.

Durante su viaje conoce a Aine, una elfa que acaba de perder a su padre
y a su hermana.

Ambos personajes comparten el dolor de haber perdido a sus seres
queridos, pero tienen perspectivas distintas sobre la muerte, los
recuerdos y la posibilidad de continuar viviendo.

## 4.2 Personajes principales

### Aidan

-   Protagonista controlable.
-   Mago especializado en fuego.
-   Anteriormente trabajaba como cocinero y panadero.
-   Perdió a su esposa Blair y a sus hijos Callum y Ciara.
-   Buscó venganza contra el responsable de la tragedia.
-   Mató al antiguo mago de fuego del Pacto.
-   Su motivación inicial está marcada por el duelo, la culpa y el deseo
    de terminar su sufrimiento.

### Aine

-   Elfa.
-   Personaje principal acompañante.
-   Está vinculada a la naturaleza.
-   Era perfumista.
-   Perdió a su padre y a su hermana durante el ataque a su aldea.
-   Considera que los fallecidos vuelven a formar parte de la
    naturaleza.
-   Quiere acompañar a Aidan y ayudarlo a continuar viviendo.

### Blair

Esposa de Aidan y madre de Callum y Ciara.

### Callum

Hijo de Aidan y Blair. Le gustaban los robots y soñaba con ser aviador o
ingeniero.

### Ciara

Hija de Aidan y Blair. Padecía una enfermedad que debilitaba su piel.
Aidan trabajaba como panadero para poder pagar su tratamiento.

### Morrigannus

Antagonista del enfrentamiento final.

Su papel está relacionado con la muerte y constituye el enemigo del acto
final.

Su diseño, comportamiento y patrones de combate deberán respetar la
historia aprobada.

## 4.3 Otros elementos del universo

### El Pacto de Hiareth

Un pacto de magos que persiguen la excelencia y el reconocimiento
mediante sacrificios extremos.

Sus integrantes buscan superar sus límites sin importar necesariamente
las consecuencias morales.

La misión de Aidan está relacionada con atravesar portales y encontrar
fragmentos de la piedra Lia Fáil.

### Los slimes

Su conflicto con los elfos comenzó después de la muerte de la reina
slime, por la cual el rey slime declaró la guerra.

Los slimes de menor rango fueron utilizados como carnada por sus propios
comandantes para sobrevivir.

Su historia muestra que los enemigos no necesariamente son responsables
individuales de todos los acontecimientos violentos.

### Los extraterrestres

La muerte del hijo del rey alienígena está relacionada con el conflicto
entre extraterrestres y humanos.

La historia presenta las pérdidas y consecuencias de ambos bandos.

### Los esqueletos

Son almas del limbo que permanecen atrapadas en la soledad y el olvido.

Su trasfondo está relacionado con los recuerdos y la ausencia de
personas que los recuerden.

------------------------------------------------------------------------

# 5. Desarrollo narrativo por actos

## Introducción

Aidan conversa con el líder del Pacto de Hiareth.

Se explica la misión, los portales y la búsqueda de la piedra Lia Fáil.
El líder recuerda que Aidan ya asesinó al antiguo mago de fuego del
Pacto.

Aidan afirma que quiere completar el trato y desaparecer.

El líder le advierte sobre el sacrificio, la ambición y las exigencias
del Pacto.

## Acto 1 --- Tierra, mar y cielo

Aidan llega a un llano de trigo y descubre una aldea en llamas.

Encuentra a Aine llorando sobre los cuerpos calcinados de su padre y su
hermana.

Aidan la ayuda, apaga las llamas y decide acompañarla.

Durante el acto se introduce el conflicto de los slimes y se presenta
una decisión relacionada con matar o esquivar a uno de ellos.

Posteriormente, Aidan y Aine descansan junto a una fogata y conversan
sobre sus familias, la guerra y sus pérdidas.

Aidan cuenta su historia y Aine intenta ayudarlo a enfrentar su dolor.

## Acto 2 --- Vuela alto

Aidan y Aine llegan a una antigua federación humana devastada por
extraterrestres.

Exploran las ruinas y encuentran una antigua escuela.

Durante sus conversaciones, Aine explica su perspectiva sobre la muerte
y Aidan recuerda a su familia.

Aidan intenta separarse de Aine para protegerla, pero ella consigue
seguirlo.

Al final quedan rodeados por esqueletos.

## Acto 3 --- Limbo

Aidan y Aine llegan a un entorno oscuro y peligroso.

La historia profundiza en sus pérdidas, sus recuerdos y la manera en que
ambos enfrentan la muerte.

El desarrollo completo de las escenas deberá respetar el texto narrativo
aprobado.

## Acto 4 --- Don't Try... (IF)

Acto exclusivo de la ruta pacifista.

Presenta un lugar pacífico, nieve, auroras boreales y un campamento.

Las auroras representan las historias de slimes, extraterrestres y
esqueletos.

Aidan comprende que los conflictos no pueden reducirse a una división
simple entre buenos y malos.

El acto representa un cambio importante en su perspectiva.

## Acto final --- Hiraeth

Aidan y Aine llegan a un páramo de cristal bajo una luna roja.

Se enfrentan a Morrigannus.

Durante el acontecimiento final, Aine cae por el impacto de un retumbo.
Aidan decide salvarla mediante un hechizo de desplazamiento y la lanza
hacia el portal, sacrificándose.

Morrigannus absorbe a Aidan.

## Final convencional

Aine sobrevive y continúa su vida.

Trabaja en una biblioteca y escribe historias para mantener vivos los
recuerdos de sus seres queridos.

Visita una panadería y descubre el pan llamado «mariposa de fuego»,
relacionado con Aidan.

## Final IF

Aine escribe y comparte la historia de Aidan, Blair, Ciara, Callum, su
padre y su hermana.

Los slimes, extraterrestres y esqueletos conocen la historia y comparten
su leyenda.

La historia de Aidan se convierte en un relato sobre la bondad, las
guerras, la memoria y la vida.

------------------------------------------------------------------------

# 6. Sistema de rutas

El videojuego tendrá dos rutas:

-   Ruta convencional.
-   Ruta pacifista.

## 6.1 Condición de la ruta pacifista

El jugador debe terminar toda la partida sin matar a ningún enemigo.

La detección se realizará mediante un contador global:

`enemiesKilled`

Reglas:

-   Si `enemiesKilled === 0`, se mantiene la posibilidad de obtener la
    ruta pacifista.
-   Si `enemiesKilled > 0`, la partida pasa a la ruta convencional.
-   Matar a un enemigo incrementa el contador.
-   Esquivar ataques no incrementa el contador.
-   Recibir daño no incrementa el contador.
-   Escapar de un enemigo no incrementa el contador.
-   El contador persiste entre escenas y niveles.
-   El contador se reinicia al comenzar una partida nueva.

No se implementará un sistema adicional de moralidad, reputación o
karma.

## 6.2 Diferencia entre rutas

  -----------------------------------------------------------------------
  Elemento                Convencional            Pacifista
  ----------------------- ----------------------- -----------------------
  Condición               Se ha eliminado al      Ningún enemigo
                          menos un enemigo        eliminado

  Acto 4                  No aparece              Aparece

  Nivel del Acto 4        No disponible           Disponible

  Final                   Final convencional      Final IF
  -----------------------------------------------------------------------

No añadir consecuencias narrativas adicionales sin aprobación.

------------------------------------------------------------------------

# 7. Gameplay y controles

## 7.1 Tipo de gameplay

El gameplay principal será un plataformas 2D lateral.

El jugador controlará a Aidan durante los niveles, desplazándose por
escenarios, saltando, esquivando peligros y enfrentándose a enemigos.

## 7.2 Combate de Aidan

**Decisiones confirmadas:**

-   El combate de Aidan será cuerpo a cuerpo (melee).
-   Tendrá un único botón de ataque.
-   El sprite disponible cuenta con una animación de ataque terrestre.
-   No se diseñarán múltiples botones de ataque ni ataques
    direccionales.
-   No se asumirá que existe una animación de ataque aéreo.

La implementación debe ajustarse a las animaciones reales del sprite.

No inventar combos, habilidades especiales, ataques mágicos adicionales
o animaciones que no estén disponibles.

## 7.3 Movimiento

El movimiento y los saltos son parte central del género.

La velocidad, aceleración, altura del salto, gravedad, doble salto y
demás parámetros todavía deben definirse a partir del sprite y de las
pruebas de gameplay.

## 7.4 Enemigos

Los enemigos estarán vinculados a los conflictos narrativos de cada
acto.

Su comportamiento, daño, patrones, resistencia y animaciones están
pendientes de definición.

No asumir que todos los enemigos deben ser eliminados. La ruta pacifista
requiere que el jugador pueda evitar matar enemigos.

## 7.5 Jefe final

El enfrentamiento contra Morrigannus tendrá inspiración Bullet Hell,
tomando como referencia el estilo de *Touhou Project*.

El diseño detallado de la arena, ataques, patrones, fases, hitboxes y
condiciones de victoria todavía debe aprobarse.

------------------------------------------------------------------------

# 8. Dirección artística y presentación

## 8.1 Objetivo visual

El videojuego debe tener una presentación visual cuidada y coherente.

La calidad artística es importante para la experiencia narrativa y para
la identidad del proyecto.

No se busca simplificar la estética, sino mantener las mecánicas y la
implementación dentro de un alcance realizable.

## 8.2 Visual Novel

La Visual Novel deberá utilizar:

-   Retratos de personajes.
-   Fondos ilustrados.
-   Cuadros de diálogo.
-   Presentación de nombres.
-   Transiciones entre escenas.
-   Interfaz narrativa coherente.

Existe una dirección artística de referencia previamente explorada:
ilustración anime semirrealista pintada digitalmente, sombreado cel
shading con degradados suaves, acentos violetas, dorados y naranjas, y
una interfaz narrativa azul estilizada.

Esta referencia deberá validarse antes de considerarse una guía visual
definitiva para todos los elementos del juego.

## 8.3 Platformer

Los niveles deberán mantener coherencia entre:

-   Personajes.
-   Enemigos.
-   Escenarios.
-   Plataformas.
-   Efectos.
-   Animaciones.

La perspectiva debe mantenerse lateral.

------------------------------------------------------------------------

# 9. División del equipo

El equipo está formado por tres integrantes.

## 9.1 Frank --- Visual Novel

**Responsable principal de la experiencia narrativa.**

Responsabilidades:

-   Implementación del sistema de diálogos.
-   Gestión de personajes y retratos.
-   Integración de fondos e ilustraciones.
-   Construcción de escenas narrativas.
-   Interfaz de Visual Novel.
-   Transiciones narrativas.
-   Presentación de decisiones y acontecimientos narrativos aprobados.

Frank deberá respetar el orden de acontecimientos y el contenido de la
historia.

## 9.2 Sebas --- Platformer

**Responsable principal del gameplay.**

Responsabilidades:

-   Implementación del movimiento de Aidan.
-   Saltos y físicas.
-   Sistema de combate melee.
-   Diseño de niveles.
-   Plataformas y obstáculos.
-   Integración de enemigos.
-   Colisiones y daño.
-   Implementación del enfrentamiento final Bullet Hell.

Sebas deberá respetar la historia y las condiciones de las rutas.

## 9.3 Tercer integrante --- Apoyo

Su disponibilidad para asumir tareas principales todavía no está
confirmada.

Posibles responsabilidades:

-   Pruebas.
-   Organización de recursos.
-   Efectos de sonido.
-   Documentación.
-   Apoyo en UI.
-   Apoyo en integración.

No asignarle una carga de desarrollo principal hasta confirmar su
disponibilidad.

------------------------------------------------------------------------

# 10. Sistemas compartidos e integración

Aunque Frank y Sebas desarrollen partes diferentes, ambas
implementaciones deben integrarse en una sola aplicación.

Los siguientes elementos requieren coordinación:

1.  Sistema de escenas.
2.  Transiciones entre Visual Novel y niveles.
3.  Resolución y escalado.
4.  Estado global de la partida.
5.  Contador `enemiesKilled`.
6.  Selección y persistencia de la ruta.
7.  Gestión de audio.
8.  Configuración y persistencia.
9.  Identidad visual.
10. Flujo de inicio, pausa, derrota y finalización.

Ninguno de los dos agentes debe crear sistemas incompatibles para estos
elementos.

La arquitectura concreta se definirá en los documentos individuales y en
el diseño técnico conjunto.

------------------------------------------------------------------------

# 11. Requisitos académicos

**Fuente:** Proyecto Final de Primer Bimestre --- Desarrollo de
Videojuegos con Phaser.js, asignatura Aplicaciones Web.

## 11.1 Tecnologías

Obligatorias:

-   Phaser.js.
-   JavaScript.

Recomendadas:

-   Vite.
-   Visual Studio Code.
-   Git.

## 11.2 Arquitectura

El proyecto debe contemplar:

-   Escenas Phaser.
-   Loader de assets.
-   Sistema de estados.
-   Menú principal.
-   Pausa.
-   Pantalla Game Over.
-   Reinicio del juego.

Estructura sugerida:

``` text
src/
├── scenes/
├── objects/
├── ui/
├── managers/
├── assets/
├── physics/
├── audio/
└── main.js
```

## 11.3 Mecánicas obligatorias

-   Movimiento.
-   Colisiones.
-   Sistema de puntaje.
-   HUD.
-   Enemigos o retos.
-   Condición de victoria.
-   Condición de derrota.
-   Persistencia de progreso.

**Pendiente:** definir cómo se integrará el sistema de puntaje con la
experiencia narrativa y el contador de enemigos eliminados. No asumir
que ambos sistemas representan lo mismo.

## 11.4 Física y colisiones

-   Phaser Arcade Physics.
-   Detección de colisiones.
-   Triggers.
-   Overlaps.
-   Rebotes o gravedad según el tipo de juego.

## 11.5 Audio

-   Música de fondo.
-   Mínimo dos efectos de sonido.
-   Botón de mute.

## 11.6 Persistencia

Utilizar `localStorage` para guardar:

-   High Score.
-   Nivel alcanzado.
-   Configuración de audio.

## 11.7 Responsive y controles

El juego debe funcionar correctamente en:

-   Escritorio.
-   Tablets.
-   Resoluciones móviles.

Controles:

-   Desktop: teclado y mouse opcional.
-   Mobile: controles táctiles equivalentes.

## 11.8 Rendimiento

-   Objetivo mínimo de 45 FPS.
-   Evitar congelamientos.
-   Cargar los assets eficientemente.

## 11.9 Accesibilidad mínima

-   Contraste adecuado.
-   Instrucciones visibles.
-   Controles documentados.
-   Opción de mute.

## 11.10 Calidad del código

-   Modularidad.
-   Reutilización.
-   Separación de responsabilidades.
-   Buenas prácticas.
-   Comentarios explicativos.
-   Nombres descriptivos.
-   Organización clara.
-   Uso adecuado de funciones, clases o módulos.

## 11.11 Entregables

  -----------------------------------------------------------------------
  Entregable                          Criterio
  ----------------------------------- -----------------------------------
  Repositorio GitHub                  Código completo, accesible e
                                      historial de commits

  Proyecto ZIP                        Ejecutable localmente

  Video demo                          45--90 segundos

  Capturas                            Entre 4 y 6 imágenes

  README.md                           Ejecución, controles, estructura y
                                      créditos

  Autoevaluación                      Fortalezas, limitaciones y mejoras
                                      futuras
  -----------------------------------------------------------------------

## 11.12 Rúbrica

  Criterio                               Porcentaje
  ------------------------------------ ------------
  Funcionalidad principal                       20%
  Mecánicas de juego                            15%
  Física y colisiones                           10%
  Arquitectura y modularidad                    15%
  Rendimiento y optimización                    10%
  UX/UI                                         10%
  Audio e inmersión                              5%
  Responsividad y controles táctiles             5%
  Código y documentación                         5%
  README, video y presentación                   5%

------------------------------------------------------------------------

# 12. Registro de decisiones pendientes

Los siguientes puntos no deben tratarse como decisiones definitivas.

## Gameplay

-   Velocidad y aceleración de Aidan.
-   Altura y duración del salto.
-   Esquema definitivo de controles.
-   Vida y daño.
-   Invulnerabilidad temporal.
-   Checkpoints.
-   Sistema de puntaje.
-   Condiciones específicas de victoria y derrota.
-   Comportamiento de enemigos.
-   Ataques de los enemigos.
-   Interacciones y objetos.

## Narrativa e integración

-   Duración total de la experiencia jugable.
-   Duración de cada nivel.
-   Distribución exacta de escenas y diálogos.
-   Transiciones concretas entre escenas.
-   Detalles finales de los actos que requieran aprobación narrativa.
-   Detalles de la implementación del final.

## Visual y audiovisual

-   Resolución interna.
-   Escalado.
-   Dirección artística definitiva.
-   Sprite y recursos finales de Aine.
-   Música autorizada para distribución.
-   Efectos de sonido.
-   Licencias y atribuciones de los assets.

## Técnica

-   Arquitectura definitiva.
-   Estructura exacta de carpetas.
-   Estrategia de integración.
-   Gestión de estados globales.
-   Esquema de guardado.
-   Herramientas de pruebas.

------------------------------------------------------------------------

# 13. Protocolo para los agentes de IA

Todo agente que reciba este documento deberá:

1.  Leer el documento completo antes de proponer una implementación.
2.  Identificar su responsabilidad dentro del equipo mediante las
    instrucciones adicionales que reciba.
3.  No asumir responsabilidades del otro integrante.
4.  Respetar las decisiones confirmadas.
5.  Preguntar antes de modificar decisiones compartidas.
6.  Señalar las contradicciones que encuentre.
7.  No completar vacíos narrativos por iniciativa propia.
8.  Mantener el código modular y comprensible.
9.  Documentar las interfaces necesarias para integrar su trabajo.
10. Comunicar los cambios que puedan afectar al otro módulo.

## 13.1 Diferencia entre estados

-   **CANÓNICO:** información perteneciente a la historia original.
-   **CONFIRMADO:** decisión aprobada por el equipo.
-   **REQUISITO ACADÉMICO:** obligación del docente.
-   **PENDIENTE:** falta una decisión.
-   **PROPUESTA:** alternativa todavía no aprobada.
-   **NO VERIFICADO:** recurso o afirmación que requiere comprobación.
-   **IMPLEMENTADO:** existe en el código.
-   **PROBADO:** fue ejecutado y comprobado.
-   **APROBADO:** el equipo aceptó el resultado.

No confundir estos estados.

------------------------------------------------------------------------

# 14. Fuentes de referencia

1.  **Documento narrativo original:** *El pacto de hiraeth.docx*. Es la
    fuente primaria para personajes, acontecimientos, diálogos y lore.
2.  **Documento académico:** *ProyectoPrimerBimestre-2026-A (2).docx*.
    Es la fuente primaria para los requisitos de Aplicaciones Web, la
    rúbrica y los entregables.
3.  **Decisiones del equipo:** conversaciones y aprobaciones posteriores
    que actualizan el diseño del videojuego.

En caso de contradicción entre una sinopsis de este documento y la
historia original, prevalece la fuente narrativa. En caso de
contradicción entre una propuesta técnica y el documento académico, debe
informarse al equipo y respetarse el requisito del docente.

------------------------------------------------------------------------

# FIN DEL DOCUMENTO MAESTRO

Este documento constituye la base común para Frank y Sebas. Cada uno
recibirá este mismo archivo, acompañado de instrucciones específicas
sobre su área de trabajo. No representa una declaración de que todas las
mecánicas estén implementadas o que todas las decisiones de diseño estén
cerradas.
