import Phaser from 'phaser';
import { SCENES, GAME_WIDTH, RULES } from '../config/constants.js';
import { GameState } from '../managers/GameState.js';
import { SaveManager } from '../managers/SaveManager.js';
import { FONT_UI, FONT_TITLE, COLORS, muteButton } from '../ui/UiKit.js';

/**
 * HUD paralelo a LEVEL / BOSS. Lee del registry:
 *   'hearts'      -> número de corazones restantes
 *   'bossHealth'  -> { current, max, name } o null
 *   'levelTitle'  -> título del acto (se anuncia unos segundos)
 *   'toast'       -> { text } aviso breve (p. ej. punto de control)
 * La puntuación y la dificultad se leen de GameState.
 * No muestra NINGUNA información de rutas ni enemigos derrotados.
 */
export default class HudScene extends Phaser.Scene {
  constructor() {
    super(SCENES.HUD);
  }

  init(data) {
    this.mode = data?.mode ?? 'level';
  }

  create() {
    this.extraShown = false; // la instancia de la escena se reutiliza
    this.buildPlate();
    this.buildSpecialGauge();
    this.buildKillCounter();
    this.buildBossBar();
    // En pantallas táctiles el botón de pausa ocupa esa esquina (el silencio está en
    // Pausa → Opciones), así que el icono de sonido solo se muestra con ratón/teclado.
    if (!this.sys.game.device.input.touch) muteButton(this, GAME_WIDTH - 16, 14);

    // Phaser emite 'changedata-<clave>' al cambiar un valor, pero el PRIMER set de una
    // clave solo emite el evento genérico 'setdata' (parent, key, value).
    const watch = (key, fn) => {
      const onChange = (_p, v) => fn(v);
      const onSet = (_p, k, v) => { if (k === key) fn(v); };
      this.registry.events.on(`changedata-${key}`, onChange);
      this.registry.events.on('setdata', onSet);
      this.events.once('shutdown', () => {
        this.registry.events.off(`changedata-${key}`, onChange);
        this.registry.events.off('setdata', onSet);
      });
    };
    watch('hearts', (v) => this.drawHearts(v));
    watch('bossHealth', (v) => this.drawBoss(v));
    watch('levelTitle', (v) => this.announce(v));
    watch('toast', (v) => this.toast(v?.text));
    watch('special', (v) => this.drawSpecial(v));

    this.drawHearts(this.registry.get('hearts') ?? RULES.PLAYER_HEARTS, true);
    this.drawBoss(this.registry.get('bossHealth'));
    this.drawSpecial(this.registry.get('special'));
    const title = this.registry.get('levelTitle');
    if (title && this.mode === 'level') this.announce(title);
    this.lastScore = -1;
  }

  // ------------------------------------------------------------------ placa
  buildPlate() {
    const x = 14;
    const y = 12;
    const w = 236;
    const h = 78;
    const g = this.add.graphics();
    g.fillStyle(0x0d0918, 0.72).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, 0xff9a3c, 0.85).strokeRoundedRect(x, y, w, h, 10);
    g.lineStyle(1, 0xffd9a8, 0.22).strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 7);
    g.fillStyle(0xff9a3c, 0.35).fillRect(x + 12, y + 48, w - 24, 1);

    // 3 corazones + 1 hueco para el corazón extra dorado (orbes).
    this.hearts = [];
    for (let i = 0; i < RULES.PLAYER_HEARTS + 1; i += 1) {
      this.hearts.push(this.add.image(x + 28 + i * 35, y + 26, 'heart_full').setScale(0.85));
    }
    const diff = GameState.difficulty;
    this.diffText = this.add.text(x + w - 12, y + 26, diff.label, {
      fontFamily: FONT_UI, fontSize: '12px', color: '#ffd9a8',
      backgroundColor: '#2a1d3c', padding: { x: 4, y: 3 },
    }).setOrigin(1, 0.5);

    const flame = this.textures.exists('fx_orb')
      ? this.add.sprite(x + 22, y + 63, 'fx_orb', 0).setScale(0.9)
      : this.add.image(x + 22, y + 63, 'orb_fire').setScale(0.55);
    if (this.anims.exists('orb-spin') && flame.play) flame.play('orb-spin');
    void flame;
    this.scoreText = this.add.text(x + 36, y + 61, '0', {
      fontFamily: FONT_UI, fontSize: '17px', color: COLORS.ink, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    // Progreso hacia la siguiente vida (cada 10 000 puntos).
    this.add.rectangle(x + 36, y + 74, 96, 4, 0x2a1d3c).setOrigin(0, 0.5);
    this.lifeBar = this.add.rectangle(x + 36, y + 74, 0, 4, 0xffb347).setOrigin(0, 0.5);
    const short = (this.registry.get('levelTitle') ?? '').split('—')[0].trim();
    this.actText = this.add.text(x + w - 14, y + 63, this.mode === 'boss' ? 'Acto final' : short, {
      fontFamily: FONT_UI, fontSize: '14px', color: COLORS.dim,
    }).setOrigin(1, 0.5);
  }

  drawHearts(n, instant = false) {
    this.tweens.killTweensOf(this.hearts);
    const base = RULES.PLAYER_HEARTS;
    this.hearts.forEach((h, i) => {
      const full = i < n;
      const wasFull = h.visible && h.texture.key === 'heart_full';
      if (i >= base) {
        // Hueco del corazón extra: solo visible cuando se tiene (dorado).
        h.setVisible(full).setTexture(this.textures.exists('heart_gold') ? 'heart_gold' : 'heart_full').setScale(0.85).setAlpha(1);
        if (full && !instant && !this.extraShown) this.tweens.add({ targets: h, scale: { from: 1.8, to: 0.85 }, duration: 380, ease: 'Back.Out' });
        this.extraShown = full;
        return;
      }
      h.setTexture(full ? 'heart_full' : 'heart_empty').setScale(0.85).setAlpha(1);
      if (!instant && wasFull && !full) {
        this.tweens.add({ targets: h, scale: { from: 1.6, to: 0.85 }, duration: 260, ease: 'Back.Out' });
      } else if (!instant && !wasFull && full) {
        this.tweens.add({ targets: h, scale: { from: 1.6, to: 0.85 }, duration: 300, ease: 'Back.Out' }); // curación
      }
    });
    // Último corazón: latido para avisar sin texto.
    if (n === 1) {
      this.tweens.add({ targets: this.hearts[0], scale: 1.02, yoyo: true, repeat: -1, duration: 380, ease: 'Sine.InOut' });
    }
  }

  // ------------------------------------------------------------------ especial
  /** Medidor de recarga del ataque especial (Fuego fantasma / Media luna). */
  buildSpecialGauge() {
    const x = 14;
    const y = 96;
    const c = this.add.container(x, y).setVisible(false);
    const g = this.add.graphics();
    g.fillStyle(0x0d0918, 0.72).fillRoundedRect(0, 0, 236, 34, 8);
    g.lineStyle(2, 0xb05cff, 0.8).strokeRoundedRect(0, 0, 236, 34, 8);
    const icon = this.add.image(22, 17, 'fx_ghostfire', 0).setScale(0.8);
    const barBg = this.add.rectangle(44, 17, 130, 10, 0x231633).setOrigin(0, 0.5).setStrokeStyle(1, 0x6a4a8a);
    this.specialFill = this.add.rectangle(45, 17, 0, 8, 0xb05cff).setOrigin(0, 0.5);
    this.specialKey = this.add.text(222, 17, 'K', {
      fontFamily: FONT_UI, fontSize: '15px', color: '#f4ecff', backgroundColor: '#3a2654', padding: { x: 6, y: 2 },
    }).setOrigin(1, 0.5);
    // Indicador de dash (solo en el jefe): se ilumina cuando está disponible.
    this.dashPip = this.add.text(188, 17, '»', {
      fontFamily: FONT_UI, fontSize: '18px', color: '#f4ecff',
    }).setOrigin(0.5).setVisible(false);
    c.add([g, icon, barBg, this.specialFill, this.dashPip, this.specialKey]);
    this.specialGauge = c;
    this.specialIcon = icon;
    this.specialIconScale = icon.scale; // la instancia de la escena se reutiliza
    this.specialWasReady = false;
  }

  drawSpecial(info) {
    if (!info) {
      this.specialGauge.setVisible(false);
      return;
    }
    this.specialGauge.setVisible(true);
    this.specialFill.width = 128 * Phaser.Math.Clamp(info.ratio, 0, 1);
    this.specialFill.setFillStyle(info.ready ? 0xe2b8ff : 0x7a3cc0);
    const iconKey = info.icon === 'crescent'
      ? (this.textures.exists('fx_crescent') ? 'fx_crescent' : 'boss-fire-crescent')
      : 'fx_ghostfire';
    if (this.specialIcon.texture.key !== iconKey && this.textures.exists(iconKey)) {
      this.specialIcon.setTexture(iconKey, 0);
      const src = this.specialIcon.frame;
      this.specialIcon.setScale(24 / Math.max(src.width, src.height));
      this.specialIconScale = this.specialIcon.scale;
    }
    this.specialIcon.setAlpha(info.ready ? 1 : 0.45);
    // Brillo del medidor cuando está listo (sin texto: no se solapa con la tecla).
    this.specialKey.setBackgroundColor(info.ready ? '#7a3cc0' : '#3a2654');
    if (info.dash !== undefined) {
      this.dashPip.setVisible(true).setAlpha(info.dash >= 1 ? 1 : 0.3).setColor(info.dash >= 1 ? '#ffd9a8' : '#bfb2d6');
    } else {
      this.dashPip.setVisible(false);
    }
    if (info.ready && !this.specialWasReady) {
      // Destello al completarse la recarga.
      const base = this.specialIconScale ?? 0.8;
      this.tweens.add({ targets: this.specialIcon, scale: { from: base * 1.8, to: base }, duration: 320, ease: 'Back.Out' });
    }
    this.specialWasReady = info.ready;
  }

  // ------------------------------------------------------------------ contador opcional
  /**
   * Contador de enemigos derrotados. SOLO visible si el jugador lo activa en Opciones
   * (apagado por defecto para no revelar la ruta, como pide el documento).
   */
  buildKillCounter() {
    this.killText = this.add.text(14, 136, '', {
      fontFamily: FONT_UI, fontSize: '14px', color: COLORS.ink,
      backgroundColor: '#0d0918b8', padding: { x: 10, y: 5 },
    }).setVisible(false);
    this.lastKills = -1;
  }

  updateKillCounter() {
    const show = SaveManager.getSettings().showKills;
    this.killText.setVisible(show);
    if (!show) return;
    // Debajo del medidor del especial si está visible; si no, bajo la placa.
    this.killText.setY(this.specialGauge.visible ? 136 : 98);
    const k = GameState.enemiesKilled;
    if (k !== this.lastKills) {
      this.lastKills = k;
      this.killText.setText(`Enemigos derrotados: ${k}`);
      if (k > 0) this.tweens.add({ targets: this.killText, scale: { from: 1.15, to: 1 }, duration: 200 });
    }
  }

  // ------------------------------------------------------------------ jefe
  buildBossBar() {
    const barW = 400; // deja libre la placa del HUD a la izquierda
    this.bossBarW = barW;
    const c = this.add.container(GAME_WIDTH / 2, 34).setVisible(false);
    const g = this.add.graphics();
    g.fillStyle(0x07040d, 0.85).fillRoundedRect(-barW / 2 - 10, -4, barW + 20, 28, 8);
    g.lineStyle(2, 0xb48cff, 0.9).strokeRoundedRect(-barW / 2 - 10, -4, barW + 20, 28, 8);
    // Remates del marco
    g.fillStyle(0xb48cff).fillTriangle(-barW / 2 - 18, 10, -barW / 2 - 8, 2, -barW / 2 - 8, 18);
    g.fillTriangle(barW / 2 + 18, 10, barW / 2 + 8, 2, barW / 2 + 8, 18);
    this.bossTrail = this.add.rectangle(-barW / 2, 10, barW, 14, 0xffffff, 0.7).setOrigin(0, 0.5);
    this.bossFill = this.add.rectangle(-barW / 2, 10, barW, 14, 0xc0204a).setOrigin(0, 0.5);
    this.bossShine = this.add.rectangle(-barW / 2, 5, barW, 3, 0xff8fa8, 0.6).setOrigin(0, 0.5);
    this.bossName = this.add.text(0, -16, 'Morrigannus', {
      fontFamily: FONT_TITLE, fontSize: '20px', color: '#ffd6e0', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    c.add([g, this.bossTrail, this.bossFill, this.bossShine, this.bossName]);
    this.bossGroup = c;
  }

  drawBoss(info) {
    if (!info) {
      this.bossGroup.setVisible(false);
      return;
    }
    this.bossGroup.setVisible(true);
    this.bossName.setText(info.name ?? 'Morrigannus');
    const ratio = Phaser.Math.Clamp(info.current / info.max, 0, 1);
    const w = this.bossBarW * ratio;
    this.bossFill.width = w;
    this.bossShine.width = w;
    // Color según la vida restante: rojo -> violeta oscuro.
    const col = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x6a1fb0), Phaser.Display.Color.ValueToColor(0xd0243f), 100, Math.round(ratio * 100));
    this.bossFill.setFillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b));
    // Estela blanca que alcanza a la barra con retraso (lectura del daño).
    this.tweens.killTweensOf(this.bossTrail);
    this.tweens.add({ targets: this.bossTrail, width: w, duration: 450, delay: 150, ease: 'Quad.Out' });
  }

  // ------------------------------------------------------------------ avisos
  announce(title) {
    if (!title) return;
    if (this.actText && this.mode === 'level') this.actText.setText(title.split('—')[0].trim());
    const t = this.add.text(GAME_WIDTH / 2, 132, title, {
      fontFamily: FONT_TITLE, fontSize: '38px', color: COLORS.ink, stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);
    const line = this.add.rectangle(GAME_WIDTH / 2, 160, Math.min(520, t.width + 40), 2, 0xff9a3c)
      .setAlpha(0.9).setScale(0, 1); // crece desde el centro
    this.tweens.add({ targets: line, scaleX: 1, duration: 700, ease: 'Quad.Out' });
    this.tweens.chain({
      targets: t,
      tweens: [
        { alpha: 1, y: 128, duration: 500 },
        { alpha: 1, duration: 1800 },
        { alpha: 0, duration: 600, onComplete: () => { t.destroy(); line.destroy(); } },
      ],
    });
  }

  toast(text) {
    if (!text) return;
    const t = this.add.text(GAME_WIDTH / 2, 104, `🔥  ${text}`, {
      fontFamily: FONT_UI, fontSize: '20px', color: '#ffe2b8',
      backgroundColor: '#1a1028dd', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.chain({
      targets: t,
      tweens: [
        { alpha: 1, y: 96, duration: 250 },
        { alpha: 1, duration: 1400 },
        { alpha: 0, duration: 400, onComplete: () => t.destroy() },
      ],
    });
  }

  update() {
    this.updateKillCounter();
    // El contador del HUD son los ORBES (la puntuación se ve en el menú y el final).
    const o = GameState.orbs;
    if (o !== this.lastScore) {
      if (o > this.lastScore && this.lastScore >= 0) {
        this.tweens.add({ targets: this.scoreText, scale: { from: 1.25, to: 1 }, duration: 160 });
      }
      this.lastScore = o;
      this.scoreText.setText(`${o}`);
      this.lifeBar.width = 96 * Phaser.Math.Clamp(GameState.lifeProgress, 0, 1);
    }
  }
}
