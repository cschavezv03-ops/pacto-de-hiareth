# Balance y parámetros de gameplay

Registro de los valores elegidos para *El Pacto de Hiareth* y de las decisiones técnicas que los acompañan. Todos los datos están tomados del código: `src/objects/Player.js`, `src/objects/Enemy.js`, `src/objects/BossPatterns.js`, `src/scenes/BossScene.js`, `src/scenes/BossDefeatScene.js`, `src/scenes/LevelScene.js`, `src/levels/levels.js` y `src/config/constants.js`.

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
| Fácil | 2 / 3 / 4 (×0.5) | 2730 (×0.65) | Sí |
| Intermedio | 4 / 6 / 8 (valores del documento) | 4200 | Sí |
| Difícil | 6 / 9 / 12 (×1.5) | 5250 (×1.25) | No |

> **Desviación respecto a las Instrucciones de Sebas (§5.3 y §13):** el documento original fijaba los golpes por enemigo y no definía checkpoints. Ambos cambios los pidió el equipo después de jugar; Intermedio conserva exactamente los golpes originales (4/6/8). La vida del jefe sí cambió al añadir las tres fases (4200 en Intermedio).

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
| `specialCooldownMs` | 6500 ms | Recarga del Fuego fantasma (6.5 s) |
| `specialSpawnFrame` | 4 | Frame de `Cast_GhostFire` en el que sale la llamarada |
| Parpadeo de invulnerabilidad | cada 70 ms | Alterna alfa 0.35 / 1 |

Valores derivados de la fórmula del salto:

- `RISE_GRAVITY = 2 · jumpHeight / timeToApex²` ≈ **2078 px/s²** (subida).
- Gravedad de caída = 2078 · 1.7 ≈ **3532 px/s²**.
- `JUMP_VELOCITY = −2 · jumpHeight / timeToApex` ≈ **−789 px/s**.
- Medición real (Chromium headless, con jumpHeight 140): apex 122 px y distancia horizontal 163 px a velocidad máxima; con 150 px el apex sube a ≈130 px. `tests/levels.test.js` valida los niveles con márgenes conservadores (subida ≤ 3.6 tiles, hueco ≤ 4.5 tiles).

Hitbox del jugador: cuerpo de **38×76 px** con origen en los pies (`y = 167/250` del frame de 250×250) y offset `(106, 91)`. `maxVelocity` horizontal = `runSpeed · 2`.

## 2.1 Fuego fantasma (especial de niveles)

Ataque a distancia con recarga, pedido por el equipo tras las pruebas. Se lanza con `K`, clic derecho o el botón táctil `✦`; **solo desde el suelo** y solo si la recarga está lista.

| Parámetro | Valor | Constante / origen |
| --- | --- | --- |
| Velocidad del proyectil | 470 px/s | `GHOST_FIRE.speed` (`LevelScene`) |
| Alcance | 560 px | `GHOST_FIRE.range` |
| Daño | 3 | `GHOST_FIRE.damage` (equivale a 3 golpes cuerpo a cuerpo) |
| Recarga | 6500 ms | `PLAYER_TUNING.specialCooldownMs` |
| Pool simultáneo | 3 proyectiles | `LevelScene.buildGhostFire` |
| Frame de salida | 4 | `PLAYER_TUNING.specialSpawnFrame` |
| Animación | `Cast_GhostFire`, 8 frames a 18 fps, sin bucle | `aidan-cast` |
| Efectos | `fx_ghostfire` (6 frames) y `fx_ghostfire_burst` (7 frames) | `tools/gen_anim_sprites.py` |

Notas:

- El proyectil es violeta, avanza en horizontal, impacta al primer enemigo y explota; se disipa al superar los 560 px.
- El daño se aplica con `enemy.hit('fire-<id>', x, 3)`, así que respeta la regla de un impacto por golpe y no daña dos veces al mismo enemigo.
- **Si el Fuego fantasma mata a un enemigo, cuenta como muerte directa**: `Enemy.kill(true)` emite `enemy:killed` y `GameState.registerKill()` incrementa `enemiesKilled`, igual que el cuerpo a cuerpo. No es una muerte ambiental.
- El HUD dibuja la recarga bajo la placa de corazones y `TouchControls.setCooldown('special', ratio)` la dibuja en el botón `✦`.
- Con 3 de daño, en Intermedio hacen falta 2 impactos para un slime (4), 2 para un alien (6) y 3 para un esqueleto (8).

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
| Ataque especial | Salto (`leap`) | Abanico cada 3.er disparo | Tajo (`swing`) |
| Alcance del ataque | 170 px | 460 px | 95 px |
| Aviso previo | 450 ms (tinte naranja + se agacha) | 450 ms (carga cian) | 250 ms (ojos rojos) + frames 4-5 del tajo |
| Parámetros | `vy` −430 px/s, `maxVx` 200 px/s, calma 2300–3000 ms | `spreadEvery` 3, `spreadAngle` 0.28 rad, 3 orbes | `reach` 74 px, `height` 70 px, frames activos 4-5, calma 1600–2200 ms |

Reglas de comportamiento comunes:

- Patrullan dentro de una zona fija `[minX, maxX]` y **nunca la abandonan**, ni siquiera al atacar o perseguir.
- Pausa ocasional: probabilidad `0.003` por frame, con duración aleatoria de 500–1200 ms.
- Al recibir un golpe: 260 ms de aturdimiento y retroceso de 140 px/s. Golpear a un enemigo **interrumpe su ataque** y reinicia su calma.
- Un mismo golpe (`attackId`) solo puede dañar una vez a cada enemigo.
- Si un enemigo cae fuera del escenario, se elimina **sin** contar como muerte de Aidan.
- **Todos los ataques ofensivos avisan antes y se pueden esquivar sin matar**: el slime se puede pasar por debajo del salto, el tajo del esqueleto se salta por encima y el abanico del alien se esquiva lateralmente. La ruta pacifista sigue siendo viable.
- El slime avisa agachándose con tinte naranja y salta hacia Aidan si está a menos de 170 px y a menos de 80 px en vertical; tras aterrizar hay 2.3–3 s de calma. El salto alcanza unos 100 px de alto.
- El esqueleto solo persigue si Aidan está dentro de su zona (con 40 px de margen), a menos de 230 px en horizontal y a menos de 120 px en vertical. Su tajo tiene un aviso de 250 ms (ojos rojos) y la zona de daño se activa en los frames 4-5 de `skeleton-attack`.
- El alien flota con una oscilación vertical de ±6 px y dispara con temporizador fijo **solo si está dentro de la cámara**; la trayectoria se fija hacia la posición de Aidan en el momento del disparo y no corrige el rumbo. **Cada 3.er disparo** es un abanico de 3 orbes (±0.28 rad) si Aidan está a menos de 460 px, precedido de una carga cian de 450 ms.

### 3.1 Comportamiento ofensivo (anti-speedrun)

Los enemigos dejaron de ser obstáculos pasivos: ahora presionan para que no baste con correr hacia la meta. Todos los ataques tienen aviso visual y se pueden esquivar **sin matar**.

| Enemigo | Aviso | Ataque | Esquiva sin matar | Cadencia / calma |
| --- | --- | --- | --- | --- |
| Slime | Se agacha y se tiñe de naranja durante 450 ms | Salto hacia Aidan: `vy` −430 px/s, `vx` hasta 200 px/s, ≈100 px de alto | Pasar por debajo mientras está en el aire | 2300–3000 ms tras aterrizar |
| Esqueleto | Ojos rojos durante 250 ms | Tajo de 74×70 px, activo en los frames 4-5 de `skeleton-attack` | Saltar por encima o salir del alcance | 1600–2200 ms |
| Alien | Carga cian de 450 ms | Abanico de 3 orbes (±0.28 rad) cada 3.er disparo si Aidan está a menos de 460 px | Moverse en lateral o usar plataformas | Disparo normal cada 2600 ms |
| Guardián del Acto 1 | Igual que un slime | Slime adicional en x = 179, justo antes de la meta | Igual que un slime | Igual que un slime |
| Guardián del Acto 2 | Igual que un alien | Alien adicional en x = 186, justo antes del portal | Igual que un alien | Igual que un alien |

Animaciones nuevas asociadas: `Slime3_Leap` (8 frames de 64×64), `skeleton/windup` (4 de 256×256) y `alien/charge` (4 de 256×256), generadas por `tools/gen_anim_sprites.py`. Si faltan, el código usa las animaciones existentes como respaldo. Ningún enemigo abandona su zona.

## 4. Jefe: Morrigannus (`BOSS_TUNING`)

El combate final tiene **tres fases** (Raíces, Astas y Luna roja), aviso previo para cada patrón, dash y Media luna de fuego. La vida escala con la dificultad; el resto de valores es común.

| Parámetro | Valor | Comentario |
| --- | --- | --- |
| `HEALTH` | 4200 | Vida base en Intermedio (Fácil 2730, Difícil 5250); 420 impactos a 10 de daño |
| `SHOT_DAMAGE` | 10 | Daño de cada proyectil normal de Aidan |
| `PLAYER_SPEED` | 245 px/s | Vuelo libre normalizado en 4 direcciones |
| `PLAYER_SCALE` | 0.95 | Escala del sprite de vuelo |
| `PLAYER_HIT_RADIUS` | 7 px | Radio en pantalla de la hitbox de Aidan |
| `PLAYER_SHOT_SPEED` | 520 px/s | Velocidad del proyectil de fuego |
| `PLAYER_SHOT_COOLDOWN_MS` | 120 ms | Cadencia máxima (≈8.3 disparos/s) |
| `PLAYER_POOL_SIZE` | 40 | Pool de proyectiles del jugador |
| `BOSS_POOL_SIZE` | 384 | Pool de proyectiles del jefe |
| `BULLET_RADIUS` | 6 px | Radio de colisión de los orbes |
| `SPECIAL_POOL_SIZE` | 3 | Media lunas simultáneas |
| `SPECIAL_DAMAGE_MULT` | 8 | 80 de daño por media luna (8 × 10) |
| `SPECIAL_SPEED` | 460 px/s | Velocidad de la media luna |
| `SPECIAL_COOLDOWN_MS` | 9000 ms | Recarga de la Media luna de fuego |
| `SPECIAL_FRAME` | 5 | Frame de `Vuelo_Ataque2_MediaLunaDeFuego` en el que sale la media luna |
| Animación de la media luna | `Vuelo_Ataque2_MediaLunaDeFuego` (`aidan-fly-crescent`), 8 frames a 18 fps | `BossScene.createAnimations` |
| Sprite de la media luna | `fx/crescent`, 4 frames de 96×96; animación `crescent-spin` a 14 fps | `tools/gen_anim_sprites.py` |
| `DASH_DISTANCE` | 170 px | Distancia del dash (≈1133 px/s durante 150 ms) |
| `DASH_DURATION_MS` | 150 ms | Duración del desplazamiento |
| `DASH_INVULNERABILITY_MS` | 200 ms | Invulnerabilidad; cubre el dash completo |
| `DASH_COOLDOWN_MS` | 800 ms | Recarga del dash |
| `TRAIL_COUNT` / `TRAIL_INTERVAL_MS` / `TRAIL_LIFE_MS` | 8 / 24 ms / 180 ms | Estela del dash |
| `INTRO_MS` | 2600 ms | Retardo del primer patrón |
| `PHASE_THRESHOLD_2` / `PHASE_THRESHOLD_3` | 0.66 / 0.33 | Vida restante para pasar a fase II / III |
| `PHASE_TRANSITION_MS` | 1200 ms | Transición; el jefe sigue recibiendo daño |
| `PHASE_RECOVERY_MS` | 350 ms | Respiro tras el cambio, antes del siguiente aviso |
| `INTENSITY_DURATION_MS` | 70000 ms | Rampa de intensidad local de cada fase |
| `TELEGRAPH_MS` | 450 ms | Aviso de `fan`, `ring`, `spiral` y `double` |
| `LANCE_WARNING_MS` | 600 ms | Aviso de la lanza |
| `WALL_WARNING_MS` | 700 ms | Aviso del muro |
| `LANCE_COUNT` / `LANCE_INTERVAL_MS` | 3 / 115 ms | Lanzas por ráfaga y separación entre ellas |
| `WALL_GAP` / `WALL_GAP_REACH` / `WALL_SPACING` | 116 / 130 / 24 px | Hueco del muro, desplazamiento máximo del hueco y separación de orbes |
| `FAN_SPREAD` | 0.52π rad | Apertura total del abanico (≈93.6°) |
| `RING_ROTATION` | 0.37 rad | Giro acumulado de cada círculo |
| `DOUBLE_RING_DELAY_MS` | 460 ms | Separación entre los dos anillos |
| `SPIRAL_DURATION_MS` | 3400 ms | Duración de la espiral |
| `SPIRAL_ROTATION` | 0.24 rad | Giro entre emisiones de la espiral |
| `SPIRAL_COMBINE_AT_MS` | 1500 ms | En fase III, momento en que la espiral combina un patrón secundario |
| `DISSOLVE_MS` | 350 ms | Disolución de balas al cambiar de fase o vencer |
| `HIT_STOP_MS` | 70 ms | Congelación breve al recibir daño |
| `HIT_SHAKE` / `PHASE_SHAKE` | 0.003 / 0.005 | Intensidad de la sacudida de cámara |
| `BOSS_FLASH_MS` / `BOSS_FLASH_INTERVAL_MS` | 70 / 360 ms | Destello del jefe y límite de frecuencia |
| `COOLDOWN_UI_MS` | 100 ms | Actualización de recargas en el HUD (10 Hz) |
| `VICTORY_DELAY_MS` | 2000 ms | Pausa antes de pasar al desenlace |
| `SCORE_BASE` | 5000 | Puntos base por vencer |
| `SCORE_PER_HEART` | 1000 | Puntos por corazón restante |
| `TIME_BONUS_LIMIT_SECONDS` | 240 s | Tiempo de referencia para el bonus |
| `SCORE_PER_SECOND` | 10 | Puntos por segundo ahorrado |

### 4.1 Fases

| Fase | Nombre | Umbral de vida | `speed` | `speedRise` | `fan` | `ring` | `rest` | `restReduction` | `lanceSpeed` | `wallSpeed` | `spiralInterval` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| I | Raíces | 100 %–66 % | 120 | 35 | 3 | 10 | 1450 ms | 350 ms | 340 | 140 | 180 ms |
| II | Astas | 66 %–33 % | 145 | 35 | 5 | 12 | 1100 ms | 250 ms | 370 | 155 | 170 ms |
| III | Luna roja | 33 %–0 % | 170 | 30 | 5 | 14 | 850 ms | 200 ms | 400 | 175 | 150 ms |

Secuencias deterministas de `BossPatterns`:

- **Fase I:** `fan` → `ring` → `lance` → `fan` → `ring` → `lance`.
- **Fase II:** `spiral` → `wall` → `fan` → `wall` → `fan`.
- **Fase III:** `spiral` → `wall` → `lance` → `double` → `spiral` → `lance` → `wall`.

### 4.2 Patrones (`BossPatterns`)

| Patrón | Aviso | Color | Comportamiento |
| --- | --- | --- | --- |
| `fan` | 450 ms | Rosa (`0xff6589`) | Abanico dirigido a Aidan: `fan + floor(2 · intensidad)` orbes en 0.52π |
| `ring` | 450 ms | Violeta claro (`0xc18aff`) | Círculo completo de `ring + floor(2 · intensidad)` orbes; gira 0.37 rad por anillo |
| `double` | 450 ms | Rosa (`0xff719d`) | Dos anillos separados 460 ms; el segundo va desfasado medio paso |
| `lance` | 600 ms | Naranja (`0xffbd68`) | 3 lanzas seguidas (115 ms), dirigidas a la posición fijada al empezar el aviso |
| `wall` | 700 ms | Cian (`0x77e6e0`) | Muro de orbes desde la derecha cada 24 px, con un hueco de 116 px cerca de Aidan (±130 px) |
| `spiral` | 450 ms | Violeta (`0xb18bff`) | 2 orbes por emisión durante 3.4 s; gira 0.24 rad; en fase III combina muro o lanza a los 1.5 s |

Lectura de diseño:

- 4200 / 10 = **420 impactos**. El comentario de `BOSS_TUNING` estima 1.2–1.5 impactos normales por segundo y un 85 % de aciertos con la media luna: **19.6–22.6 DPS**, es decir, **186–215 s** más entrada y transiciones, dentro del objetivo de 3–4 minutos. Es una **hipótesis de balance**: disparar mejor acorta el combate.
- La intensidad de cada fase es `phaseElapsedMs / 70000`, limitada a 1. Sube la velocidad, añade orbes y reduce el descanso (`rest − restReduction · intensidad`), pero **nunca elimina el aviso**.
- La media luna hace 80 de daño, atraviesa al jefe, borra balas enemigas y solo puede dañarlo una vez por lanzamiento; su recarga es de 9 s.
- El dash recorre 170 px en 150 ms, concede 200 ms de invulnerabilidad y tiene 800 ms de recarga. Sin dirección pulsada, Aidan avanza hacia la derecha, hacia Morrigannus.
- Al cambiar de fase se disuelven todas las balas y el jefe queda invulnerable solo visualmente: **sigue recibiendo daño durante los 1200 ms de transición**.
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
| Acto 1 — Tierra, mar y cielo | 190 | 6080 | 11 slimes (incluye guardián en x = 179) | 4 | 15 estáticas | 0 | `goal_sign` (x = 184) |
| Acto 2 — Vuela alto | 200 | 6400 | 7 aliens (incluye guardián en x = 186) | 5 | 12 estáticas + 3 móviles | 3 pinchos | `goal_portal` (x = 193) |
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

- **El dash existe solo en el jefe.** En los niveles no se implementó: no es necesario para el diseño de plataformas y mantiene el alcance bajo control (el documento lo dejaba a criterio de Sebas). En el combate final recorre 170 px en 150 ms, concede 200 ms de invulnerabilidad y tiene 800 ms de recarga.
- **Coyote time (100 ms) y jump buffer (120 ms)**, con salto variable al soltar `Espacio`. Sigue siendo un salto simple: **no hay doble salto**.
- **El ataque cuerpo a cuerpo y el Fuego fantasma solo se ejecutan desde el suelo**, porque no existe animación de ataque aéreo. `Attack1` y `Attack2` se alternan como **variantes visuales de la misma acción**, no como habilidades distintas. El Fuego fantasma usa `Cast_GhostFire` (8 frames) y una recarga de 6.5 s.
- **Fuego fantasma y fases del jefe: cambio pedido por el equipo tras las pruebas.** El Documento Maestro decía no inventar ataques mágicos adicionales y las Instrucciones no requerían fases; el equipo pidió ambos después de jugar y quedan **aprobados**. El Fuego fantasma es un ataque a distancia con recarga y las tres fases del jefe son una extensión del combate final, no una regla nueva de la historia.
- **Animaciones nuevas derivadas de los sprites originales.** `tools/gen_anim_sprites.py` genera `Cast_GhostFire`, `fx/ghostfire`, `fx/ghostfire_burst`, `Slime3_Leap`, `skeleton/windup`, `alien/charge` y `fx/crescent` con muestreo NEAREST y paletas nativas, sin arte externo. El manifiesto `public/assets/sprites/anim_sprites.json` registra fuentes, línea base y notas; `tools/anim_preview.png` sirve para revisarlas. Si una tira falta, el código usa respaldos.
- **La regla de rutas NO cambia.** El Acto 4 (el «easter egg» de la ruta pacifista) solo aparece si `enemiesKilled === 0`, y **todos los enemigos siguen siendo esquivables sin matar**: los ataques nuevos tienen aviso y ventana de esquiva. El Fuego fantasma **sí** cuenta como muerte directa porque es un ataque de Aidan, igual que el cuerpo a cuerpo.
- **Caer a un foso resta 1 corazón** (respetando la invulnerabilidad) y reaparece en el último punto seguro sobre suelo firme, lejos de bordes y pinchos. No sustituye a los checkpoints: el Game Over reinicia desde el último checkpoint (o desde el inicio en Difícil).
- **Los aliens disparan con temporizador fijo**, pero solo si están dentro de la cámara, para que no lleguen balas desde fuera de la pantalla. Cada tercer disparo es un abanico de 3 orbes si Aidan está cerca, precedido de una carga cian de 450 ms. Si un proyectil impacta a Aidan, sigue su trayectoria (§7.2). Sus proyectiles caducan a los 6 s o al salir del escenario (incluido un margen de 200 px respecto a la vista).
- **Los esqueletos se acercan a Aidan solo si está dentro de su zona**; nunca la abandonan, ni siquiera al perseguir o al ejecutar su tajo. El tajo avisa con ojos rojos y solo daña en los frames activos.
- **Los slimes saltan hacia Aidan** si lo tienen cerca, con aviso naranja y agachándose; el salto se puede esquivar pasando por debajo y deja una calma de 2.3–3 s. Tampoco abandonan su zona.
- **Guardianes antes de la meta:** un slime adicional en el Acto 1 (x = 179) y un alien adicional en el Acto 2 (x = 186) para que no baste con correr hasta el final.
- **El jefe no cuenta para `enemiesKilled`**: es obligatorio y contarlo haría imposible la ruta pacifista.
- **Derrota del jefe y mejor avance:** al quedarse sin corazones se abre `BossDefeat` con una barra de progreso por fases, el porcentaje de vida quitada y el mejor avance histórico. Este se guarda en la clave independiente `pactoHiareth.bossBest.v1` (0..1) y el reintento es inmediato con `J` / `Enter` (o desde el menú de la tarjeta).
- **Acto 4 con obstáculos ambientales**: pinchos de hielo, estalactitas que caen al acercarse Aidan, plataformas de hielo que se desmoronan y reaparecen, y plataformas móviles. **Sin enemigos.**
- **Puntuación independiente de las muertes**: no debe premiar ni revelar la ruta. Solo suma completar el nivel, los corazones restantes y el bonus de tiempo.
- **Fondos del Acto 4**: las capas 1–4 se fusionaron en `far.png` por rendimiento (menos fill-rate y menos texturas activas).
- **Plataformas móviles**: velocidad analítica (derivada exacta de un movimiento senoidal) con corrección de deriva y periodos de 2,9-3,8 s. La versión anterior derivaba la velocidad de la diferencia de posición entre frames y oscilaba bruscamente con el paso fijo de Arcade.
- **Teclado de la UI**: Phaser puede reemitir el mismo `KeyboardEvent` en más de un paso; los manejadores de menús usan `oncePerKeyEvent` (UiKit) para procesarlo una sola vez.
- **Volumen**: música y efectos ajustables de 0 a 100 % en pasos de 10 % (menú → Audio y pausa → Audio); se guarda en localStorage.
- **Phaser 3.90 en lugar de 4.x** por estabilidad y por la documentación disponible para el equipo.

- **Reloj propio de Aidan**: la invulnerabilidad, el coyote time y el buffer de salto usan un reloj que solo avanza durante el juego activo, para que la pausa no consuma la invulnerabilidad.
- **Latch de pulsaciones** en `InputManager`: una pulsación más corta que un frame no se pierde.
- **Contador de enemigos derrotados opcional**: las Instrucciones (§6) prohíben mostrar el contador. El equipo pidió poder verlo; se implementó como opción «Enemigos derrotados» en Opciones, **apagada por defecto**, para conservar la sorpresa del Acto 4 (ruta pacifista) a quien no la active.
