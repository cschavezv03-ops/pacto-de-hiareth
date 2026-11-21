# Balance y parámetros de gameplay

Registro de los valores elegidos para *El Pacto de Hiareth* y de las decisiones técnicas que los acompañan. Todos los datos están tomados del código: `src/objects/Player.js`, `src/objects/Enemy.js`, `src/scenes/BossScene.js`, `src/scenes/LevelScene.js`, `src/levels/levels.js` y `src/config/constants.js`.

Unidades: píxeles (px) y segundos (s). Un **tile** mide **32 px**. La gravedad del mundo es **900 px/s²**.

## 1. Reglas confirmadas

Estas reglas vienen del Documento Maestro y de las Instrucciones de Sebas; no se modifican sin aprobación del equipo.

| Regla | Valor | Constante |
| --- | --- | --- |
| Corazones de Aidan | 3 | `RULES.PLAYER_HEARTS` |
| Invulnerabilidad tras un impacto | 1000 ms | `RULES.INVULNERABILITY_MS` |
| Golpes para derrotar a un slime | 4 | `RULES.ENEMY_HITS.slime` |
| Golpes para derrotar a un alien | 6 | `RULES.ENEMY_HITS.alien` |
| Golpes para derrotar a un esqueleto | 8 | `RULES.ENEMY_HITS.skeleton` |
| Daño por contacto o proyectil | 1 corazón | `Player.takeHit()` |

No se recuperan corazones durante un nivel. Al llegar a 0 se produce Game Over y el nivel se reinicia completo, con todos sus enemigos.

## 1.1 Niveles de dificultad (cambio aprobado por el equipo tras las pruebas manuales)

Se elige al pulsar **Nueva partida** y se guarda con la partida. Solo cambian la resistencia de los enemigos, la vida del jefe y la disponibilidad de checkpoints; la IA, la velocidad y los 3 corazones de Aidan son idénticos.

| Dificultad | Golpes slime / alien / esqueleto | Vida de Morrigannus | Checkpoints |
| --- | --- | --- | --- |
| Fácil | 2 / 3 / 4 (×0.5) | 1950 (×0.65) | Sí |
| Intermedio | 4 / 6 / 8 (valores del documento) | 3000 | Sí |
| Difícil | 6 / 9 / 12 (×1.5) | 3750 (×1.25) | No |

> **Desviación respecto a las Instrucciones de Sebas (§5.3 y §13):** el documento original fijaba los golpes por enemigo y no definía checkpoints. Ambos cambios los pidió el equipo después de jugar; Intermedio conserva exactamente los valores originales.

### Checkpoints

- 2-3 braseros por nivel (`checkpoints` en `levels.js`), sobre suelo firme y fuera de las zonas de patrulla y de los peligros (validado en `tests/levels.test.js`).
- Al tocarlos se encienden, se guarda el progreso (`GameState.setCheckpoint`) y aparece el aviso «Punto de control».
- Game Over / Reintentar reaparece en el último checkpoint activado con 3 corazones; **todos los enemigos del nivel reaparecen** y `enemiesKilled` se conserva.
- Se borran al terminar el nivel. No existen en Difícil ni en el combate final.

## 2. Movimiento de Aidan (`PLAYER_TUNING`)

| Parámetro | Valor | Comentario |
| --- | --- | --- |
| `scale` | 1.0 | Escala del sprite en plataformas |
| `runSpeed` | 250 px/s | Velocidad horizontal máxima (≈7.8 tiles/s) |
| `groundAccel` | 3200 px/s² | Alcanza la velocidad máxima en ~0.08 s |
| `groundDecel` | 3600 px/s² | Frenada algo más rápida que la aceleración |
| `airAccelMult` | 0.7 | 70 % de aceleración y frenada en el aire |
| `jumpHeight` | 150 px | Valor de diseño; apex medido en el motor ≈4.1 tiles (la gravedad de caída lo recorta) |
| `timeToApex` | 0.38 s | Tiempo hasta el punto más alto |
| `fallGravityMult` | 1.7 | Gravedad de caída 1.7× la de subida |
| `jumpCut` | 0.5 | Al soltar el salto, la velocidad vertical se reduce a la mitad |
| `maxFall` | 820 px/s | Menos de medio tile por tick a 60 Hz |
| `coyoteMs` | 100 ms | Margen para saltar justo después de dejar el suelo |
| `bufferMs` | 120 ms | Margen para registrar un salto pulsado antes de aterrizar |
| `attackMoveMult` | 0.35 | Velocidad horizontal mientras ataca en el suelo |
| `attackActiveFrom` / `attackActiveTo` | 2 / 5 | Frames activos del golpe, de 8 totales |
| `attackReach` | 66 px | Ancho de la zona de golpe |
| `attackHeight` | 64 px | Alto de la zona de golpe |
| `knockbackX` | 200 px/s | Retroceso horizontal al recibir daño |
| `knockbackY` | −260 px/s | Retroceso vertical al recibir daño |
| `hitAnimUntil` | 200 ms | Animación Take hit tras el daño; solo visual, no bloquea controles (§5.3) |
| Parpadeo de invulnerabilidad | cada 70 ms | Alterna alfa 0.35 / 1 |

Valores derivados de la fórmula del salto:

- `RISE_GRAVITY = 2 · jumpHeight / timeToApex²` ≈ **2078 px/s²** (subida).
- Gravedad de caída = 2078 · 1.7 ≈ **3532 px/s²**.
- `JUMP_VELOCITY = −2 · jumpHeight / timeToApex` ≈ **−789 px/s**.
- Medición real (Chromium headless, con jumpHeight 140): apex 122 px y distancia horizontal 163 px a velocidad máxima; con 150 px el apex sube a ≈130 px. `tests/levels.test.js` valida los niveles con márgenes conservadores (subida ≤ 3.6 tiles, hueco ≤ 4.5 tiles).

Hitbox del jugador: cuerpo de **38×76 px** con origen en los pies (`y = 167/250` del frame de 250×250) y offset `(106, 91)`. `maxVelocity` horizontal = `runSpeed · 2`.

## 3. Enemigos (`ENEMY_TYPES`)

| Parámetro | Slime | Alien | Esqueleto |
| --- | --- | --- | --- |
| Acto | 1 | 2 | 3 |
| Golpes (`hits`) | 4 | 6 | 8 |
| Textura base | `slime_idle` | `alien_idle` | `skeleton_idle` |
| Escala | 2.7 | 0.5 | 0.5 |
| Cuerpo (w×h) | 22×16 | 90×150 | 80×160 |
| Offset del cuerpo | (21, 26) | (83, 90) | (88, 88) |
| Línea de pies (`footY`) | 42 | 248 | 248 |
| Velocidad de patrulla | 55 px/s | 60 px/s | 50 px/s |
| Velocidad de persecución | — | — | 95 px/s |
| Radio de detección | — | — | 230 px |
| Vuela (sin gravedad) | No | Sí | No |
| Intervalo de disparo | — | 2600 ms | — |
| Velocidad del proyectil | — | 150 px/s | — |
| Vida del proyectil | — | 6000 ms | — |

Reglas de comportamiento comunes:

- Patrullan dentro de una zona fija `[minX, maxX]` y **nunca la abandonan**.
- Pausa ocasional: probabilidad `0.003` por frame, con duración aleatoria de 500–1200 ms.
- Al recibir un golpe: 260 ms de aturdimiento y retroceso de 140 px/s.
- Un mismo golpe (`attackId`) solo puede dañar una vez a cada enemigo.
- Si un enemigo cae fuera del escenario, se elimina **sin** contar como muerte de Aidan.
- El esqueleto solo persigue si Aidan está dentro de su zona (con 40 px de margen), a menos de 230 px en horizontal y a menos de 120 px en vertical.
- El alien flota con una oscilación vertical de ±6 px y dispara con temporizador fijo **solo si está dentro de la cámara**; la trayectoria se fija hacia la posición de Aidan en el momento del disparo y no corrige el rumbo.

## 4. Jefe: Morrigannus (`BOSS_TUNING`)

| Parámetro | Valor | Comentario |
| --- | --- | --- |
| `HEALTH` | 3000 | 300 impactos a 10 de daño |
| `SHOT_DAMAGE` | 10 | Daño de cada proyectil de Aidan |
| `PLAYER_SPEED` | 245 px/s | Vuelo libre normalizado en 4 direcciones |
| `PLAYER_SCALE` | 0.95 | Escala del sprite de vuelo |
| `PLAYER_HIT_RADIUS` | 7 px | Radio en pantalla de la hitbox de Aidan |
| `PLAYER_SHOT_SPEED` | 520 px/s | Velocidad del proyectil de fuego |
| `PLAYER_SHOT_COOLDOWN_MS` | 120 ms | Cadencia máxima (≈8.3 disparos/s) |
| `PLAYER_POOL_SIZE` | 40 | Pool de proyectiles del jugador |
| `BOSS_POOL_SIZE` | 384 | Pool de proyectiles del jefe |
| `INTENSITY_DURATION_MS` | 180000 ms | Tiempo hasta la intensidad máxima |
| `INTRO_MS` | 2600 ms | Retardo del primer patrón |
| `INTERVAL_START_MS` → `INTERVAL_END_MS` | 1600 → 550 ms | Intervalo entre patrones según intensidad |
| `FAN_COUNT_START` → `FAN_COUNT_END` | 3 → 9 | Proyectiles del abanico |
| `RING_COUNT_START` → `RING_COUNT_END` | 8 → 22 | Proyectiles del círculo |
| `BULLET_SPEED_START` → `BULLET_SPEED_END` | 110 → 210 px/s | Velocidad de los orbes del jefe |
| `FAN_SPREAD` | 0.52π rad | Apertura total del abanico |
| `RING_ROTATION` | 0.37 rad | Giro acumulado de cada círculo |
| `COMBINATION_START` | 0.45 | Intensidad a partir de la cual pueden combinarse patrones |
| `VICTORY_DELAY_MS` | 2000 ms | Pausa antes de pasar al desenlace |
| `SCORE_BASE` | 5000 | Puntos base por vencer |
| `SCORE_PER_HEART` | 1000 | Puntos por corazón restante |
| `TIME_BONUS_LIMIT_SECONDS` | 240 s | Tiempo de referencia para el bonus |
| `SCORE_PER_SECOND` | 10 | Puntos por segundo ahorrado |

Lectura de diseño:

- 3000 / 10 = **300 impactos**; a 1.5 impactos efectivos por segundo, el combate dura unos **200 s** (3 min 20 s), dentro del objetivo de 3–4 minutos.
- La intensidad crece linealmente de 0 a 1 durante 180 s; después se mantiene al máximo.
- Cada tercer patrón es un círculo; los demás son abanicos dirigidos a la posición de Aidan.
- Cuando el presupuesto de combinación llega a 1, el patrón lanza **abanico y círculo a la vez**; ese presupuesto crece más rápido cuanto mayor es la intensidad.
- Hitbox del jefe: 220×500 px sobre el sprite escalado a 300 px de alto. El jugador está limitado a los dos tercios izquierdos de la arena.

## 5. Puntuación

### Nivel de plataformas (`LevelScene.completeLevel`)

```text
puntos = 1000 + corazones_restantes · 300 + max(0, round((300 − segundos) · 5))
```

- 1000 puntos fijos por completar.
- 300 por cada corazón que quede (máximo 900).
- Bonus de tiempo: 5 puntos por cada segundo ahorrado respecto a 300 s; se anula al superar los 300 s.

### Jefe (`BossScene.win`)

```text
puntos = 5000 + corazones_restantes · 1000 + max(0, floor(240 − segundos)) · 10
```

- 5000 puntos base, 1000 por corazón (máximo 3000).
- Bonus de tiempo: 10 puntos por segundo ahorrado respecto a 240 s; se anula al superar los 240 s.

La puntuación **no depende de matar enemigos**. Así no premia ni delata la ruta: completar, conservar corazones y ser rápido es lo que suma. `GameState.addScore()` redondea, ignora valores negativos y actualiza el High Score.

## 6. Dimensiones de los niveles (`LEVEL_DATA`)

| Nivel | Ancho (tiles) | Ancho (px) | Enemigos | Fosos | Plataformas | Obstáculos | Meta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Acto 1 — Tierra, mar y cielo | 190 | 6080 | 9 slimes | 4 | 15 estáticas | 0 | `goal_sign` (x = 184) |
| Acto 2 — Vuela alto | 200 | 6400 | 6 aliens | 5 | 12 estáticas + 3 móviles | 3 pinchos | `goal_portal` (x = 193) |
| Acto 3 — Limbo | 205 | 6560 | 7 esqueletos | 6 | 12 estáticas + 5 móviles | 2 pinchos | `goal_house` (x = 198) |
| Acto 4 — Don't Try… (IF) | 175 | 5600 | 0 | 6 | 6 estáticas + 6 quebradizas + 2 móviles | 5 pinchos + 6 estalactitas | `goal_camp` (x = 168) |

Los **fosos** son los huecos entre los tramos de `ground`; no hay suelo en esos intervalos y el mundo no colisiona por abajo. Un foso resta 1 corazón y devuelve a Aidan al último suelo seguro.

Tramos de suelo y huecos:

- **Acto 1:** `[0,34] [37,62] [66,96] [100,128] [131,190]`.
- **Acto 2:** `[0,30] [34,58] [63,88] [93,118] [122,150] [155,200]`.
- **Acto 3:** `[0,28] [32,55] [59,80] [85,110] [114,140] [145,170] [174,205]`.
- **Acto 4:** `[0,26] [30,48] [53,70] [76,96] [101,122] [128,148] [152,175]`.

Parallax por nivel (de la capa más lejana a la más cercana):

- Acto 1: `[0.05, 0.15, 0.3, 0.5]` (4 capas).
- Acto 2: `[0.03, 0.1, 0.2, 0.35, 0.55]` (5 capas).
- Acto 3: `[0.03, 0.1, 0.2, 0.35, 0.55]` (5 capas).
- Acto 4: `[0.0, 0.12, 0.18, 0.25, 0.35, 0.45, 0.6]` (7 capas; la primera es `far.png`).
- Jefe: 3 capas con desplazamiento continuo.

Plataformas móviles: movimiento senoidal con período de 1700–2200 ms y desplazamiento de 2–3 tiles en horizontal. Plataformas quebradizas del Acto 4: aviso de 550 ms, desaparecen 300 ms y reaparecen a los 2600 ms en su posición original.

## 7. Decisiones y desviaciones técnicas

- **No se implementa dash.** No es necesario para el diseño de niveles y mantiene el alcance bajo control. El documento lo dejaba a criterio de Sebas.
- **Coyote time (100 ms) y jump buffer (120 ms)**, con salto variable al soltar `Espacio`. Sigue siendo un salto simple: **no hay doble salto**.
- **El ataque solo se ejecuta desde el suelo**, porque no existe animación de ataque aéreo. `Attack1` y `Attack2` se alternan como **variantes visuales de la misma acción**, no como habilidades distintas.
- **Caer a un foso resta 1 corazón** (respetando la invulnerabilidad) y reaparece en el último punto seguro sobre suelo firme, lejos de bordes y pinchos. No sustituye a los checkpoints: el Game Over reinicia desde el último checkpoint (o desde el inicio en Difícil).
- **Los aliens disparan con temporizador fijo**, pero solo si están dentro de la cámara, para que no lleguen balas desde fuera de la pantalla. Si un proyectil impacta a Aidan, sigue su trayectoria (§7.2). Sus proyectiles caducan a los 6 s o al salir del escenario (incluido un margen de 200 px respecto a la vista).
- **Los esqueletos se acercan a Aidan solo si está dentro de su zona**; nunca la abandonan, ni siquiera al perseguir.
- **El jefe no cuenta para `enemiesKilled`**: es obligatorio y contarlo haría imposible la ruta pacifista.
- **Acto 4 con obstáculos ambientales**: pinchos de hielo, estalactitas que caen al acercarse Aidan, plataformas de hielo que se desmoronan y reaparecen, y plataformas móviles. **Sin enemigos.**
- **Puntuación independiente de las muertes**: no debe premiar ni revelar la ruta. Solo suma completar el nivel, los corazones restantes y el bonus de tiempo.
- **Fondos del Acto 4**: las capas 1–4 se fusionaron en `far.png` por rendimiento (menos fill-rate y menos texturas activas).
- **Plataformas móviles**: velocidad analítica (derivada exacta de un movimiento senoidal) con corrección de deriva y periodos de 2,9-3,8 s. La versión anterior derivaba la velocidad de la diferencia de posición entre frames y oscilaba bruscamente con el paso fijo de Arcade.
- **Teclado de la UI**: Phaser puede reemitir el mismo `KeyboardEvent` en más de un paso; los manejadores de menús usan `oncePerKeyEvent` (UiKit) para procesarlo una sola vez.
- **Volumen**: música y efectos ajustables de 0 a 100 % en pasos de 10 % (menú → Audio y pausa → Audio); se guarda en localStorage.
- **Phaser 3.90 en lugar de 4.x** por estabilidad y por la documentación disponible para el equipo.

- **Reloj propio de Aidan**: la invulnerabilidad, el coyote time y el buffer de salto usan un reloj que solo avanza durante el juego activo, para que la pausa no consuma la invulnerabilidad.
- **Latch de pulsaciones** en `InputManager`: una pulsación más corta que un frame no se pierde.
