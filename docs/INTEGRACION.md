# Contrato de integración con la Visual Novel

Documento para **Frank**. Describe todo lo que la escena de Visual Novel necesita respetar para encajar con el gameplay de Sebas sin duplicar ni romper el estado compartido. Todo lo indicado aquí ya está implementado y probado en el repositorio.

La regla general: **la VN no crea estado propio de partida**. Lee y avanza el `GameState`, reproduce audio con `AudioManager` y deja que `StoryRouter` decida qué escena sigue.

---

## 1. Claves de escena (`SCENES`)

Definidas en `src/config/constants.js` y congeladas con `Object.freeze`. No renombrar sin acuerdo del equipo.

| Constante | Clave real | Responsable | `init()` que recibe |
| --- | --- | --- | --- |
| `SCENES.BOOT` | `Boot` | Sebas | — |
| `SCENES.PRELOAD` | `Preload` | Sebas | — |
| `SCENES.MENU` | `Menu` | Sebas | — |
| `SCENES.VN` | `VisualNovel` | **Frank** | `{ sceneId, isEnding }` |
| `SCENES.LEVEL` | `Level` | Sebas | `{ levelId }` |
| `SCENES.BOSS` | `Boss` | Sebas | `{}` |
| `SCENES.HUD` | `Hud` | Sebas | `{ mode: 'level' \| 'boss' }` |
| `SCENES.PAUSE` | `Pause` | Sebas | `{ from }` |
| `SCENES.GAME_OVER` | `GameOver` | Sebas | `{ retryScene, retryData }` |
| `SCENES.BOSS_DEFEAT` | `BossDefeat` | Sebas | `{ progress, best }` |
| `SCENES.ENDING` | `Ending` | — | Reservada; el desenlace se sirve por `SCENES.VN` |

Importa siempre las claves desde `constants.js`; no escribas cadenas sueltas.

## 2. Escenas narrativas (`VN_SCENES`)

| Constante | `sceneId` | Momento |
| --- | --- | --- |
| `VN_SCENES.INTRO` | `intro` | Introducción: Aidan conversa con el líder del Pacto de Hiareth (misión, portales, piedra Lia Fáil). |
| `VN_SCENES.AFTER_ACT1` | `after_act1` | Tras el Acto 1: Aidan conoce a Aine (fogata). |
| `VN_SCENES.AFTER_ACT2` | `after_act2` | Tras el Acto 2: en el portal, Aine alcanza a Aidan. |
| `VN_SCENES.AFTER_ACT3` | `after_act3` | Tras el Acto 3: casa abandonada / refugio; pérdidas, familias y esperanza. |
| `VN_SCENES.AFTER_ACT4` | `after_act4` | Tras el Acto 4 (**solo ruta pacifista**): campamento, chocolate, auroras boreales e historias de las razas. |
| `VN_SCENES.BEFORE_BOSS` | `before_boss` | Páramo de cristal bajo la luna roja, antes del combate. |
| `VN_SCENES.ENDING_CONVENTIONAL` | `ending_conventional` | Final de la ruta convencional. |
| `VN_SCENES.ENDING_IF` | `ending_if` | Final de la ruta pacifista. |

`AFTER_ACT4` nunca llega si el jugador ha derrotado a algún enemigo: el router omite los pasos `pacifistOnly`.

## 3. Qué recibe la escena VN

```js
init(data) {
  this.sceneId = data?.sceneId ?? VN_SCENES.INTRO; // uno de VN_SCENES
  this.isEnding = Boolean(data?.isEnding);         // true solo en los dos finales
}
```

- `sceneId`: identifica el tramo narrativo. La escena debe tener contenido para **los ocho** identificadores.
- `isEnding`: `true` únicamente cuando `sceneId` es `ending_conventional` o `ending_if`.
- No llega ningún otro dato: el progreso se consulta en `GameState`.

## 4. Cómo avanzar

Cuando la VN termina su tramo (último diálogo, elección o fundido):

```js
import { GameState } from '../managers/GameState.js';

const next = GameState.advanceStory();       // devuelve el siguiente paso ya resuelto
this.game.events.emit('story:goto', next);   // lo ejecuta StoryRouter
```

`StoryRouter` escucha `story:goto`, detiene las escenas gestionadas (`VN`, `LEVEL`, `BOSS`, `HUD`, `PAUSE`, `GAME_OVER`, `BOSS_DEFEAT`, `MENU`, `ENDING`) y arranca la que corresponda:

| `step.type` | Acción del router |
| --- | --- |
| `vn` | `start(SCENES.VN, { sceneId: step.id })` |
| `level` | `start(SCENES.LEVEL, { levelId: step.id })` |
| `boss` | `start(SCENES.BOSS, {})` |
| `ending` | `stopMusic()` y `start(SCENES.VN, { sceneId: step.id, isEnding: true })` |

`BossDefeat` **no es un paso de `STORY`**: lo arranca `BossScene` al quedarse Aidan sin corazones, con `{ progress, best }` (ambos normalizados 0..1). El router lo incluye entre las escenas gestionadas para detenerlo al reintentar, volver al menú o avanzar la historia. La VN no debe arrancarlo.

Reglas:

- **Nunca** llames a `this.scene.start(SCENES.LEVEL, …)` ni a `SCENES.BOSS` desde la VN: rompe el orden de la historia y el estado.
- Emite `story:goto` **una sola vez** por tramo (protege con una bandera tipo `leaving`).
- Emítelo al final de un fundido o desde un callback, no en medio de la creación de la escena. El router ya difiere la operación con `setTimeout(0)`, pero la buena práctica es no destruir la escena mientras se está dibujando.
- La VN **no** modifica `GameState.enemiesKilled` ni llama a `registerKill()`.

## 5. Qué hacer en los finales

Cuando `isEnding === true`, la VN muestra el desenlace y la puntuación final (`GameState.score`). Al terminar:

```js
this.scene.start(SCENES.MENU);
```

Es la única salida directa permitida, porque ya no queda ningún paso en la historia. `StoryRouter` ya detuvo la música antes de arrancar la escena de final; no hace falta llamar a `advanceStory()`.

Recomendaciones:

- Mostrar la puntuación final y, si se desea, el `highScore` leído con `SaveManager.load()`.
- No reiniciar el estado: al volver al menú, «Nueva partida» llamará a `GameState.newGame()` y «Continuar» a `GameState.loadGame()`.

## 6. Estado global (`GameState`)

Módulo puro (`src/managers/GameState.js`), sin dependencias de Phaser. La secuencia vive en `STORY`.

### API pública

| Miembro | Tipo | Uso |
| --- | --- | --- |
| `newGame()` | método | Reinicia todo (incluido `enemiesKilled`) y devuelve el primer paso. Solo lo llama el menú. |
| `loadGame()` | método | Carga la partida guardada y devuelve el paso actual. Si no hay, actúa como `newGame()`. |
| `hasSavedRun()` | método | `true` si hay una partida con paso intermedio; el menú lo usa para mostrar «Continuar». |
| `registerKill()` | método | **Solo gameplay.** Incrementa `enemiesKilled` cuando Aidan derrota directamente a un enemigo. |
| `enemiesKilled` | getter | Muertes directas acumuladas. **No mostrarlo nunca al jugador.** |
| `isPacifist()` | método | `enemiesKilled === 0`. Uso interno; no revelarlo en pantalla. |
| `score` | getter | Puntuación de la partida. Se puede mostrar. |
| `addScore(points)` | método | Suma puntos (redondea y descarta negativos) y actualiza el High Score. |
| `currentStep()` | método | Paso actual; si es `ending`, devuelve `{ type: 'ending', id }` con el final resuelto. |
| `advanceStory()` | método | Avanza al siguiente paso válido (salta los `pacifistOnly` si no hay ruta pacifista) y lo devuelve. |
| `debugJumpTo(index)` | método | Solo depuración y pruebas manuales. No usarlo en producción. |
| `persist()` | método | Guarda el estado. `advanceStory()` ya lo hace. |

### Reglas

1. `enemiesKilled` **solo** lo incrementa el gameplay, mediante `registerKill()` al recibir el evento `enemy:killed`. La VN nunca lo toca.
2. El contador persiste entre escenas, niveles y Game Over; solo `newGame()` lo reinicia.
3. Por defecto la ruta **no** se muestra al jugador: ni mensajes, ni iconos, ni pistas en el HUD o en los diálogos. Única excepción aprobada por el equipo: la opción «Enemigos derrotados» (`SaveManager.getSettings().showKills`, apagada por defecto) muestra el contador en el HUD. La VN no debe mostrar la ruta aunque esa opción esté activa.
4. La VN puede consultar `isPacifist()` para adaptar detalles internos, pero el desenlace ya viene decidido en `sceneId`.
5. No guardar estado propio en `localStorage` desde la VN: usa `GameState` y `SaveManager`.

### Dificultad y checkpoints

- `GameState.newGame(difficulty)` con `'easy' | 'normal' | 'hard'` (por defecto `'normal'`). `GameState.difficulty` devuelve `{ id, label, hitMult, bossHealthMult, checkpoints }`.
- `GameState.checkpointFor(levelId)` / `setCheckpoint(levelId, index)`: los usa solo el gameplay; `advanceStory()` borra el checkpoint al cambiar de paso. La VN no necesita tocarlos.

## 7. Audio global (`AudioManager`)

Un único punto de control para música, efectos y mute. Se inicializa una vez en `PreloadScene` con `AudioManager.init(game)`.

| Función | Firma | Comportamiento |
| --- | --- | --- |
| `playMusic` | `playMusic(scene, key, { volume }?)` | Reproduce en bucle. Si la misma pista ya suena, no la reinicia. |
| `stopMusic` | `stopMusic()` | Detiene y destruye la música actual. |
| `sfx` | `sfx(scene, key, config?)` | Reproduce un efecto aplicando el volumen de SFX guardado. |
| `toggleMute` | `toggleMute()` | Alterna el mute y devuelve el estado. |
| `setMuted` | `setMuted(value)` | Fija el mute. |
| `muted` | getter | Estado actual. |
| `onMuteChange` | `onMuteChange(fn)` | Suscribe un callback; devuelve la función para desuscribir. |

Claves disponibles: `music_act1`…`music_act4`, `music_boss`; `sfx_jump`, `sfx_attack`, `sfx_enemy_hit`, `sfx_enemy_die`, `sfx_player_hurt`, `sfx_player_die`, `sfx_alien_shot`, `sfx_player_shot`, `sfx_boss_shot`, `sfx_boss_hit`, `sfx_level_clear`, `sfx_ui_select`.

Reglas:

- La música de gameplay la gestionan `LevelScene` y `BossScene`. Al entrar en una escena VN, llama a `AudioManager.stopMusic()` para que no quede sonando la pista del acto anterior (la escena provisional ya lo hace).
- Si la VN tiene música propia, añádela al manifiesto y reprodúcela con `playMusic`; no crees objetos `sound` sueltos.
- **No dupliques el botón de mute.** Usa el único botón compartido: `muteButton(this, GAME_WIDTH - 12, 12)` de `src/ui/UiKit.js`. Ya se sincroniza con `onMuteChange` y con la tecla `M`.
- El mute se guarda en `SaveManager` y se restaura al arrancar.

### Volumen y panel de audio

- `AudioManager.setMusicVolume(v)` / `setSfxVolume(v)` (0..1, pasos de 0.1, se guardan) y los getters `musicVolume` / `sfxVolume`.
- `audioPanel(scene, onClose)` en `src/ui/UiKit.js` abre el panel modal de audio (música, efectos, silencio). La VN puede reutilizarlo en vez de crear otra interfaz de audio.
- `muteButton(scene, x, y, { onOpenAudio })` dibuja el icono de altavoz pixel art (sin recuadro).
- Para manejadores de teclado propios, envolverlos con `oncePerKeyEvent(handler)` (Phaser puede reemitir el mismo evento).

### Pantallas de carga y fondos

- `SCENES.LOADING` (`LoadingScene`): el router la muestra antes de cada nivel y del jefe con `{ step }`. La VN de Frank no necesita gestionarla.
- `drawBackdrop(scene, id, dim)` en `src/ui/Backdrop.js` dibuja el escenario completo de un acto (`'act1'…'act4' | 'boss'`). Úsalo como fondo de cualquier pantalla: algunas capas sueltas son solo cielo.

## 8. Registry usado por el HUD

`HudScene` se lanza en paralelo a `LEVEL` y `BOSS` y solo lee del registry global:

| Clave | Tipo | Quién la escribe |
| --- | --- | --- |
| `hearts` | `number` | `LevelScene` (al crear y al cambiar la vida) y `BossScene` |
| `bossHealth` | `{ current, max, name } \| null` | `BossScene`; `null` fuera del combate |
| `levelTitle` | `string \| null` | `LevelScene`; se muestra unos segundos al empezar |
| `special` | `{ ratio, ready, label, icon?, dash? } \| null` | `LevelScene` (Fuego fantasma) y `BossScene` (Media luna y dash); `null` al salir |
| `toast` | `{ text, t? } \| null` | `LevelScene`; aviso breve como «Punto de control» |

El objeto `special` es el contrato del medidor de recarga:

- `ratio`: 0..1 (0 = recién usado, 1 = listo). `ready`: atajo de `ratio >= 1`. `label`: texto descriptivo («Fuego fantasma» o «Media luna»).
- `icon`: opcional; `'crescent'` hace que el HUD use `fx_crescent` (con respaldo `boss-fire-crescent`). Sin `icon`, usa `fx_ghostfire`.
- `dash`: opcional, 0..1; solo el jefe lo envía y el HUD dibuja el indicador `»` junto al medidor.
- `HudScene` dibuja el medidor bajo la placa de corazones (a la izquierda) y lo oculta cuando la clave es `null`. `LevelScene` actualiza con resolución del 2 % y `BossScene` a 10 Hz (`COOLDOWN_UI_MS`).
- El gameplay también llama a `TouchControls.setCooldown(action, ratio)` para pintar la misma recarga en los botones `✦` / `☾` / `»`.

La puntuación **no** va por registry: `HudScene` lee `GameState.score` en cada frame. El HUD no muestra información de rutas ni de enemigos derrotados.

La VN no debe escribir estas claves ni lanzar `HudScene`. Si en el futuro la VN necesita HUD propio, que sea un elemento suyo, no una reutilización de `HudScene`.

## 9. Resolución y escalado

- Resolución interna: **960 × 540** (16:9). Los fondos originales son 576 × 324 y se escalan a la altura del juego.
- `Phaser.Scale.FIT` con `autoCenter: CENTER_BOTH`: se respeta la proporción y aparecen bandas si la ventana no es 16:9.
- `pixelArt: true`, gravedad Arcade de 900 px/s² y objetivo de 60 FPS.
- El canvas vive en `<main id="game">`. `index.html` incluye un aviso de rotación (`#rotate-hint`) para móvil en vertical.
- Diseña la VN en coordenadas de 960 × 540 y con márgenes seguros: en pantallas pequeñas el texto se reduce, pero no se recorta.

## 10. Controles táctiles (`TouchControls`)

- Es una **capa HTML** sobre el canvas (clase `touch-ui`), no objetos de Phaser: se ve nítida y no sufre el escalado.
- Solo se crea en dispositivos táctiles (`ontouchstart` o `maxTouchPoints > 0`).
- La crea `InputManager`; la VN no debe instanciarla.
- Modo `platformer`: `◀` / `▶` a la izquierda; `✦` (Fuego fantasma), `🔥` (atacar) y `⤒` (saltar) a la derecha; `❚❚` de pausa en la esquina.
- Modo `boss`: cruceta de cuatro direcciones y `»` (dash), `☾` (Media luna de fuego) y `🔥` (disparar); `❚❚` de pausa.
- Los botones escriben en `TouchControls.state` y `InputManager` los mezcla con teclado y ratón. `InputManager` expone las acciones `special` y `dash` además de `attack`:
  - `special`: `K` o clic derecho en ambos modos; en niveles lanza el Fuego fantasma y en el jefe la Media luna.
  - `dash`: solo en el jefe, con `Shift` o `L`.
- `TouchControls.setCooldown(action, ratio)` pinta la recarga de `special` o `dash` en su botón: `ratio` va de 0 (vacío) a 1 (listo) y se dibuja con un `conic-gradient` (`--cd`) y la clase `cooling`. Lo llaman `LevelScene` y `BossScene`.
- Si la VN añade botones propios, usa HTML con la clase `touch-ui` para que el clic no se interprete como ataque, o detén la propagación del evento.

## 11. La escena VN actual es un placeholder

`src/scenes/VNScene.js` es **provisional**. No contiene diálogos: muestra el título del tramo, una descripción breve tomada del Documento Maestro y un aviso de que falta la integración. Sirve para que el flujo completo sea jugable de principio a fin.

Frank debe **reemplazar su contenido manteniendo**:

1. La clave de escena `SCENES.VN` (`'VisualNovel'`).
2. El `init({ sceneId, isEnding })` con esos nombres.
3. La salida mediante `GameState.advanceStory()` + `this.game.events.emit('story:goto', next)`.
4. La vuelta al menú con `this.scene.start(SCENES.MENU)` cuando `isEnding` sea `true`.
5. El uso de `muteButton` y `AudioManager` para el audio.
6. La prohibición de tocar `enemiesKilled`.

Se puede cambiar libremente todo lo demás: composición, retratos, cajas de diálogo, efectos, elecciones, guardado de líneas leídas, etc. Si se necesita un dato nuevo del gameplay, se acuerda con Sebas y se añade a `GameState`, no a un módulo paralelo.

## 12. Pruebas manuales recomendadas

| Prueba | Pasos | Resultado esperado |
| --- | --- | --- |
| Movimiento | `A`/`D` y flechas en un nivel | Aidan acelera, frena y cambia de orientación sin deslizarse |
| Salto | Saltar, soltar `Espacio` a media subida, saltar al borde | Salto variable; el coyote y el buffer permiten saltar al ras del borde |
| Colisiones | Subir a plataformas desde abajo, usar plataformas móviles | Las plataformas son atravesables desde abajo; Aidan viaja con la móvil |
| Daño | Tocar un enemigo y un pincho | −1 corazón, parpadeo y 1 s sin recibir más daño |
| Foso | Caer a un hueco del suelo | −1 corazón y reaparición en el último suelo seguro |
| Enemigos | Golpear 4/6/8 veces slime/alien/esqueleto en Intermedio | Mueren en el número exacto; un mismo golpe no daña dos veces |
| Fuego fantasma | `K`, clic derecho o `✦`, en el suelo o en pleno salto; esperar la recarga y volver a lanzar | Proyectil violeta, 3 de daño y 560 px de alcance; 6.5 s de recarga; medidor en el HUD y en el botón; si mata, cuenta como muerte directa |
| Ataques enemigos | Acercarse a un slime, un esqueleto y un alien y esperar | Aviso naranja + salto, ojos rojos + tajo y carga cian + abanico; se esquivan sin matar y no abandonan su zona |
| Rutas | Completar sin matar y repetir matando uno (cuerpo a cuerpo o con Fuego fantasma) | Sin muertes: aparece el Acto 4 y el final IF. Con una muerte: se omite y va al final convencional |
| Reinicio | Perder los 3 corazones en un nivel | Game Over, «Reintentar» reconstruye el nivel con todos los enemigos y 3 corazones |
| Proyectiles | Provocar disparos de un alien y alejarse; esperar el tercer disparo cerca | Trayectoria recta, sin corrección; cada tercer disparo es un abanico de 3; caducan a los 6 s o al salir del escenario |
| Jefe: fases | Bajar la vida a 66 % y 33 % | Cambia a «II · Astas» y «III · Luna roja»; cada patrón avisa antes y las balas se disuelven en la transición |
| Jefe: dash y media luna | `Shift`/`L` y `K`/clic derecho/`☾` | El dash es invulnerable 200 ms; la media luna borra balas y quita 80; ambas recargas se ven en el HUD |
| Jefe: combate | Volar, disparar, recibir un orbe y ganar | Barra de vida baja; −1 corazón con invulnerabilidad; al vencer pasa a la VN del final |
| Derrota del jefe | Perder los 3 corazones en el jefe | `BossDefeat` muestra la barra por fases y el mejor avance; `J`/`Enter` reintenta al instante |
| Pausa y audio | `Esc`/`P` y `M` en nivel, jefe y VN | La pausa congela el juego; el mute afecta a música y SFX y persiste al recargar |
| Táctil | Abrir en móvil o emular táctil | Aparecen `◀ ▶ ⤒ 🔥 ✦` en niveles y cruceta + `» ☾ 🔥` en el jefe; se puede jugar y pausar sin teclado |
| Continuar | Avanzar, recargar y pulsar «Continuar» | Se retoma el paso guardado y se conserva la puntuación |

Pruebas automatizadas equivalentes: `npm test`, `node tests/smoke.mjs <url>` y `node tests/rules.e2e.mjs <url>` (ver el README).

### Modo desarrollador

`GameState.startDev(stepIndex, difficulty, { god })` arranca un nivel suelto sin tocar el guardado (`persist()` no escribe mientras `GameState.isDev`). En ese modo `advanceStory()` devuelve `{ type: 'dev' }` y el router vuelve al menú con `{ dev: true }` (selector de niveles). `newGame()` y `loadGame()` salen del modo desarrollador. Frank: si la VN necesita probar escenas sueltas, puede reutilizar el mismo mecanismo con pasos de tipo `vn`.

### Acto 2 sin suelo

El Acto 2 no tiene suelo continuo: islotes en el inicio, los checkpoints y la meta, y entre ellos plataformas móviles con `moverTrap: 'cycle'` (se rompen y reaparecen solas). `LevelScene.prepareRespawn()` recoloca a Aidan tras una caída sobre la última plataforma pisada; `LevelScene.returnToSafe()` lo usa el platillo al abducir. Detalles y tiempos en `docs/BALANCE.md` §11.
