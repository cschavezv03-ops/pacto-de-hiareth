# El Pacto de Hiareth

Videojuego narrativo para navegador que combina **Visual Novel**, **plataformas 2D lateral** y un **combate final Bullet Hell**. El jugador acompaña a Aidan, un mago de fuego que ha perdido a su familia, mientras conoce a Aine, una elfa que ha sufrido una pérdida semejante pero comprende la muerte de otra manera. La historia alterna escenas narrativas con niveles jugables y termina en un enfrentamiento contra Morrigannus.

La **Visual Novel** la implementa **Frank**; el **gameplay** (plataformas, física, combate, enemigos, jefe y sistemas compartidos) lo implementa **Sebas**. El proyecto está construido con **Phaser 3.90** y **Vite**.

## Requisitos

- **Node.js 18 o superior** (recomendado 20 LTS) y `npm`.
- Navegador moderno con WebGL/Canvas y `localStorage` (Chrome, Firefox, Edge o Safari recientes).
- Para las pruebas E2E: Chromium de Playwright (se instala con un comando, ver más abajo).
- Para volver a generar assets (opcional): Python 3 con Pillow y NumPy.

## Instalación y ejecución

```bash
npm install        # instala dependencias (Phaser, Vite y Playwright)
npm run dev        # servidor de desarrollo con recarga en caliente (http://localhost:5173)
npm run build      # compila la versión de producción en dist/
npm run preview    # sirve localmente la compilación de dist/
```

El juego arranca en el menú principal. Los assets se cargan desde `public/assets` y la escena de precarga muestra una barra de progreso.

## Pruebas

### Pruebas unitarias de reglas

```bash
npm test
```

Ejecuta `node --test tests/*.test.js`. Cubren la progresión de la historia, la ruta pacifista y la convencional, la persistencia de las muertes, la existencia del Acto 4 solo como paso pacifista y el guardado de la puntuación máxima y del nivel alcanzado. No necesitan navegador.

### Pruebas end-to-end con Playwright

```bash
npx playwright install chromium
npm run dev                     # en otra terminal, dejar corriendo
node tests/smoke.mjs http://localhost:5173
node tests/rules.e2e.mjs http://localhost:5173
```

- `tests/smoke.mjs` recorre menú, los cuatro niveles y el jefe, comprueba que Aidan aterriza, mide FPS, detecta errores de consola y guarda capturas en `tests/screenshots/`.
- `tests/rules.e2e.mjs` verifica en el navegador las reglas de gameplay: resistencia de enemigos, un impacto por golpe, muertes ambientales que no cuentan, daño por contacto con 1 s de invulnerabilidad, reinicio de nivel tras Game Over, pausa, proyectiles del alien y daño al jefe.

## Controles

| Acción | Plataformas — teclado/ratón | Plataformas — táctil | Jefe — teclado/ratón | Jefe — táctil |
| --- | --- | --- | --- | --- |
| Moverse a la izquierda / derecha | `A` / `D` o `←` / `→` | Botones `◀` / `▶` | `WASD` o flechas (vuelo libre en 4 direcciones) | Cruceta `▲ ◀ ▶ ▼` |
| Saltar | `Espacio` (también `W` / `↑`) | Botón `⤒` | — | — |
| Agacharse | `S` / `↓` (mantener) | Botón `▼` | — | — |
| Ataque en el aire | `J` / clic izquierdo mientras salta | Botón `🔥` en el aire | — | — |
| Atacar / disparar | `J` o clic izquierdo | Botón `🔥` | `J` (también `Espacio` o clic izquierdo); un disparo por pulsación | Botón `🔥` |
| Fuego fantasma (especial de nivel) | `K` o clic derecho | Botón `✦` | — | — |
| Media luna de fuego (especial del jefe) | — | — | `K` o clic derecho | Botón `☾` |
| Esquivar (dash, solo jefe) | — | — | `Shift` o `L` | Botón `»` |
| Pausa | `Esc` o `P` | Botón `❚❚` en la esquina | `Esc` o `P` | Botón `❚❚` |
| Silenciar / activar sonido | `M` o botón `🔊` / `🔇` | Botón `🔊` / `🔇` | `M` o botón `🔊` / `🔇` | Botón `🔊` / `🔇` |

Notas:

- El ataque cuerpo a cuerpo y el Fuego fantasma se pueden usar en el suelo o en pleno salto; en el jefe se dispara en cualquier momento.
- El **Fuego fantasma** de los niveles también exige estar en el suelo: lanza un proyectil violeta de 3 de daño con 560 px de alcance y **6.5 s de recarga**. La recarga se ve bajo la placa de corazones y en el botón `✦`.
- La **Media luna de fuego** y el **dash** son exclusivos del jefe. La media luna atraviesa y borra balas enemigas; el dash concede invulnerabilidad breve y tiene su propia recarga. El HUD muestra ambas recargas (medidor y símbolo `»`).
- El salto es **simple** (sin doble salto). Soltar `Espacio` durante la subida acorta el salto.
- En móvil los controles son una **capa HTML** sobre el canvas: se muestran solos en dispositivos táctiles y no dependen del escalado del juego.
- El botón de mute es único y compartido por menú, niveles, pausa, HUD y Visual Novel.

## Estructura de carpetas

```text
src/
├── main.js                     # configura Phaser (960x540, FIT, Arcade, orden de escenas) e instala el router
├── style.css                   # estilos de la página, del contenedor del juego y de los controles táctiles
├── config/
│   ├── constants.js            # resolución, claves de escena (SCENES), niveles, escenas VN, RULES y clave de guardado
│   └── assets.js               # manifiesto de spritesheets, fondos, música y SFX que carga PreloadScene
├── levels/
│   └── levels.js               # diseño de los actos 1-4 en tiles: suelo, fosos, plataformas, enemigos, obstáculos y meta
├── managers/
│   ├── GameState.js            # estado global y secuencia de la historia; decide la ruta y el final
│   ├── SaveManager.js          # persistencia en localStorage con respaldo en memoria
│   ├── AudioManager.js         # música, SFX y mute globales, con notificación a los iconos
│   ├── InputManager.js         # entrada unificada (teclado, ratón y táctil); acciones attack, special y dash
│   └── StoryRouter.js          # traduce `story:goto` a la escena correcta y detiene las escenas activas
├── objects/
│   ├── Player.js               # Aidan: movimiento, salto, ataque melee, Fuego fantasma, daño y muerte
│   ├── Enemy.js                # enemigos (slime, alien, esqueleto): patrulla por zona, salto, tajo y abanico
│   ├── BossPatterns.js         # repertorio determinista de patrones del jefe por fase
│   ├── Animations.js           # animaciones globales creadas una vez a partir de los spritesheets
│   └── ProceduralTextures.js   # texturas generadas por código: terreno, plataformas, orbes, corazones y metas
├── scenes/
│   ├── BootScene.js            # arranque mínimo; pasa a la precarga
│   ├── PreloadScene.js         # barra de progreso, carga de assets, texturas y animaciones, inicio de AudioManager
│   ├── MenuScene.js            # título, Nueva partida / Continuar / Controles, mejor puntuación y mute
│   ├── VNScene.js              # escena VN PROVISIONAL (placeholder) que Frank debe reemplazar
│   ├── LevelScene.js           # nivel de plataformas genérico construido desde LEVEL_DATA
│   ├── BossScene.js            # combate Bullet Hell contra Morrigannus: 3 fases, dash y media luna
│   ├── HudScene.js             # HUD superpuesto: corazones, puntos, título del acto, barra del jefe y recargas
│   ├── PauseScene.js           # pausa superpuesta: continuar, silenciar, reiniciar nivel o volver al menú
│   ├── GameOverScene.js        # derrota: reintentar el nivel o volver al menú
│   └── BossDefeatScene.js      # tarjeta de derrota del jefe: progreso por fases, mejor avance y reintento
└── ui/
    ├── UiKit.js                # panel, lista de menús navegable y botón de mute reutilizables
    └── TouchControls.js        # botones táctiles HTML; incluye ✦ (especial), ☾ (media luna) y » (dash)
```

## Dificultad, checkpoints y audio

- Al pulsar **Nueva partida** se elige **Fácil**, **Intermedio** (valores originales) o **Difícil**. Solo cambia cuántos golpes aguantan los enemigos y el jefe; en Difícil no hay puntos de control.
- Cada nivel tiene braseros de **punto de control**: al morir se reaparece en el último encendido.
- **Opciones** (menú principal o pausa): volumen de música y efectos, silencio y la opción **«Enemigos derrotados»** (apagada por defecto) que muestra un contador en el HUD para quien quiera saber si va por la ruta sin muertes. El icono de altavoz (arriba a la derecha) silencia con un clic; la tecla `M` también.

## Orbes y vidas

- Los enemigos derrotados sueltan **orbes** (slime 3, alien 4, esqueleto 5) y cada nivel tiene 5 grupos de orbes flotantes en zonas altas o difíciles (también se consiguen sin derrotar a nadie). En cuanto Aidan pasa cerca, el orbe le persigue hasta recogerse, aunque siga corriendo.
- El número del HUD son los orbes. Cada **50 orbes** Aidan recupera un corazón o, si los tiene todos, gana un **corazón extra dorado** (máximo 1). La barra ámbar indica el progreso.
- **Al perder todas las vidas (Game Over), reiniciar desde la pausa o caer ante el jefe, los orbes vuelven a 0**, así no se pueden acumular corazones muriendo y repitiendo. Cada orbe suma además 50 puntos a la puntuación (High Score).

## Flujo de escenas

```text
Menú
 └─ VN introducción
     └─ Acto 1 (plataformas, slimes)
         └─ VN (Aidan conoce a Aine)
             └─ Acto 2 (sin suelo: plataformas que se rompen, aliens, platillos)
                 └─ VN (en el portal, Aine alcanza a Aidan)
                     └─ Acto 3 (plataformas, esqueletos)
                         └─ VN (casa abandonada / refugio)
                             ├─ [solo ruta pacifista] Acto 4 (sin enemigos) → VN del campamento
                             └─ VN previa al jefe (páramo de cristal)
                                 └─ Jefe: Morrigannus (Bullet Hell, 3 fases)
                                     ├─ [derrota] BossDefeat → reintento del jefe (J / Enter)
                                     └─ Final (convencional o IF)
```

El orden vive en `STORY` (`src/managers/GameState.js`). Los pasos marcados como `pacifistOnly` se omiten en cuanto Aidan derrota directamente a un enemigo. Toda transición pasa por `GameState.advanceStory()` y por el evento `story:goto`, que atiende `StoryRouter`. El detalle del contrato está en [`docs/INTEGRACION.md`](docs/INTEGRACION.md).

## Persistencia en localStorage

Clave: **`pactoHiareth.save.v1`**. Todos los accesos están protegidos con `try/catch`; si `localStorage` no está disponible (modo privado, iframes), se mantiene una copia en memoria durante la sesión.

| Campo | Contenido |
| --- | --- |
| `highScore` | Mejor puntuación conseguida |
| `maxStoryIndex` | Índice máximo de la historia alcanzado |
| `audio.muted` | Estado del mute |
| `audio.musicVolume` | Volumen de música (0.6 por defecto) |
| `audio.sfxVolume` | Volumen de efectos (0.8 por defecto) |
| `run.enemiesKilled` | Muertes directas acumuladas en la partida en curso |
| `run.storyIndex` | Paso actual de la historia (permite «Continuar») |
| `run.score` | Puntuación de la partida en curso |

«Continuar» solo aparece si hay una partida guardada con un paso intermedio (`storyIndex > 0` y distinto del último). La partida se guarda al iniciarla, al avanzar la historia y al registrar muertes; la mejor puntuación se actualiza en cada suma de puntos.

El jefe usa además una clave independiente, **`pactoHiareth.bossBest.v1`**: guarda la mayor fracción de vida quitada a Morrigannus (0..1) entre todos los intentos. La escriben `BossScene` al cambiar de fase, al vencer y al perder; `BossDefeatScene` la muestra como marca en la barra de progreso y como «Tu mejor avance». No forma parte de `pactoHiareth.save.v1` y no modifica la partida en curso.

## Herramientas de assets

Todas las herramientas ya se ejecutaron y su salida está incluida en `public/assets`; solo hay que volver a lanzarlas si se reemplazan los originales.

- **`tools/gen_sfx.py`** genera los efectos de sonido del juego (12 archivos WAV mono, 16 bits, 22050 Hz) usando únicamente la biblioteca estándar de Python: salto, ataque, golpe y muerte de enemigo, daño y muerte de Aidan, disparos de alien, de Aidan y del jefe, impacto al jefe, nivel superado y selección de menú. Escribe en `public/assets/sfx/`.

  ```bash
  python3 tools/gen_sfx.py
  ```

- **`tools/gen_anim_sprites.py`** deriva las animaciones nuevas de los sprites originales, sin arte externo y con muestreo NEAREST: `aidan/Cast_GhostFire.png` (8 frames de 250×250; la llamarada sale en el frame 4), `fx/ghostfire.png` (6 frames de 48×32), `fx/ghostfire_burst.png` (7 de 64×64), `slime/Slime3_Leap.png` (8 de 64×64), `skeleton/windup.png` (4 de 256×256), `alien/charge.png` (4 de 256×256) y `fx/crescent.png` (4 de 96×96). Escribe también `public/assets/sprites/anim_sprites.json` (manifiesto con fuentes, línea base y notas) y `tools/anim_preview.png` para revisión. `PreloadScene` lee el manifiesto y carga las tiras automáticamente; si falta alguna, el juego usa animaciones o texturas de respaldo.

  ```bash
  tools/.venv/bin/python tools/gen_anim_sprites.py
  ```

  Requiere Pillow y NumPy.

- **`tools/slice_sheets.py`** recorta los JPG originales de alien, esqueleto y jefe (`El pacto de hiareth utils/Sprites/Characters`) y produce tiras PNG horizontales con transparencia en `public/assets/sprites/`: frames de 256×256 para alien y esqueleto (walk, attack, idle, hurt, death) y 8 frames de 352×608 para el idle de Morrigannus. Mide el color de fondo, aplica un matte por distancia de color, elimina halos y conserva interiores. También escribe `slice_report.json` y `tools/slice_preview.png`.

  ```bash
  tools/.venv/bin/python tools/slice_sheets.py
  ```

  Requiere Pillow y NumPy.

### Props pixel art

`tools/gen_props.py` genera por código las metas de nivel (cartel, portal, casa abandonada, campamento), el brasero de checkpoint y los iconos de sonido en `public/assets/props/`, con la paleta de cada fondo. `public/assets/props/props.json` describe sus frames y la escena de carga los lee automáticamente.

```bash
tools/.venv/bin/python tools/gen_props.py
```

## Créditos

- **Equipo:** Frank — Visual Novel; Sebas — gameplay (plataformas, física, combate, enemigos, jefe y sistemas compartidos).
- **Sprites y soundtrack:** proporcionados por el equipo (temas de los Actos 1, 2 y 4).
- **Música generada para el proyecto** (síntesis con NumPy + FFmpeg, regenerable):
  - Menú: `tools/gen_music_menu.py` → `Menu.ogg` (si menor → re mayor, 75 BPM; leitmotiv Si–Re–Do♯–Fa♯–Mi).
  - Acto 3 «Los nombres olvidados»: `tools/gen_music_level3.py` → `Level3.ogg` (el original del equipo era idéntico al del Acto 1).
  - Jefe final: se usa el tema original del equipo, `BOSSFIGTH.ogg`. El tema metal generado (`tools/gen_music_boss.py`) se descartó tras escucharlo.
- **Motor:** [Phaser 3.90](https://phaser.io), licencia MIT.
- **Efectos de sonido:** sintetizados por procedimiento con `tools/gen_sfx.py` y `tools/gen_sfx2.py` (orbes con tono ascendente en cadena, derrota de enemigo, checkpoint, fin de nivel y victoria sobre el jefe).

## Autoevaluación

### Fortalezas

- Flujo completo y jugable de principio a fin: menú, precarga, cuatro actos, jefe de tres fases, tarjeta de derrota del jefe, pausa, Game Over, final y reinicio.
- Separación clara de responsabilidades: configuración, managers, objetos, escenas y UI, con un contrato de integración explícito para la Visual Novel.
- Física y combate ajustados con reglas verificables: 3 corazones, 1 s de invulnerabilidad, resistencia por enemigo, un impacto por golpe y patrulla limitada a una zona.
- Enemigos con ataques telegrafiados (salto del slime, tajo del esqueleto y abanico del alien) y jefe con avisos previos a cada patrón: todos se pueden esquivar **sin matar**, así que la ruta pacifista sigue siendo viable.
- Dos rutas narrativas reales: la pacifista añade el Acto 4 y un final distinto, sin revelar al jugador qué ruta sigue.
- Rendimiento cuidado: texturas procedurales, pools de proyectiles precalentados, capas de parallax fusionadas en el Acto 4 y objetivo de 60 FPS.
- Controles equivalentes en teclado, ratón y táctil, incluidos el especial (`K` / clic derecho / `✦`), la media luna (`☾`) y el dash (`Shift` / `L` / `»`), con mute único y persistencia de la configuración de audio.
- Documentación de balance e integración, más pruebas unitarias y E2E automatizadas.

### Limitaciones

- **La Visual Novel es un placeholder** hasta integrar el trabajo de Frank: `src/scenes/VNScene.js` muestra el título y una descripción de cada tramo, sin diálogos ni retratos.
- **La duración real del jefe debe validarse jugando**: el objetivo es 3–4 min, pero depende de la puntería, del uso de la media luna y del dash. La vida base (4200) y los multiplicadores por dificultad son una hipótesis de balance, no un límite.
- Los checkpoints y la dificultad se añadieron tras las pruebas manuales del equipo (ver docs/BALANCE.md §1.1); en Difícil no hay checkpoints.
- **Los sprites de alien, esqueleto y jefe provienen de JPG** y presentan leves artefactos en los bordes tras el recorte con transparencia.
- Las siete animaciones nuevas se derivaron de los sprites originales con `tools/gen_anim_sprites.py`; no hay arte externo, pero su lectura depende de la calidad de las fuentes recortadas.
- El Acto 4 depende de plataformas móviles y quebradizas: un error de salto obliga a repetir el tramo desde el último suelo seguro.

### Mejoras futuras

- Integrar la Visual Novel definitiva manteniendo la clave `SCENES.VN` y el contrato de `init`/`advanceStory`.
- Repintar o reexportar los sprites de alien, esqueleto y jefe desde fuentes con canal alfa para eliminar los artefactos de borde.
- Ajustar la curva del jefe con datos de partidas reales (vida, recargas y densidad de balas) y valorar patrones nuevos sin romper los avisos previos.
- Revisar el equilibrio del Fuego fantasma y de los ataques anti-speedrun con partidas de prueba, manteniendo siempre la posibilidad de esquivar sin matar.
- Guardado de la posición exacta dentro del nivel y ajustes de accesibilidad (remap de teclas, tamaño de texto, reducción de parpadeo).

## Regla interna del equipo (no visible al jugador)

> Esta sección es documentación para el equipo. Por defecto el juego **no** muestra el contador de enemigos ni la ruta. El contador solo aparece si el jugador activa «Enemigos derrotados» en Opciones (decisión aprobada por el equipo; así el Acto 4 sigue siendo una sorpresa para quien no la active).

`GameState.enemiesKilled` solo aumenta cuando Aidan derrota **directamente** a un enemigo (`GameState.registerKill()` desde el evento `enemy:killed` del gameplay). Esquivar, huir, recibir daño, dejar enemigos atrás, que un enemigo caiga a un foso o que desaparezca por una causa ambiental **no** incrementa el contador. El contador se conserva entre escenas, niveles y reinicios por Game Over, y solo `GameState.newGame()` lo devuelve a cero. El jefe no cuenta: es obligatorio y contarlo haría imposible la ruta pacifista. `enemiesKilled === 0` mantiene la ruta pacifista; cualquier valor mayor activa la convencional y omite el Acto 4.

Más detalle en [`docs/BALANCE.md`](docs/BALANCE.md) y [`docs/INTEGRACION.md`](docs/INTEGRACION.md).
