#!/usr/bin/env python3
"""Original title theme: Memoria bajo la luna roja.

Run: tools/.venv/bin/python -B tools/gen_music_menu.py
Writes only Menu.ogg and menu_music_report.txt; working audio stays in /tmp.
Reuses gen_music_level3's measurement, synthesis and circular reverb utilities.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile

# Importing the existing generator must not create a fourth workspace file.
sys.dont_write_bytecode = True
import numpy as np
import gen_music_level3 as base

ROOT = Path(__file__).resolve().parents[1]
MUSIC = ROOT / "public/assets/music"
OUTPUT = MUSIC / "Menu.ogg"
REPORT = ROOT / "tools/menu_music_report.txt"
REFERENCES = ("Level1", "Level2", "Level3", "Level4", "BOSSFIGTH")
SR = base.SR
BPM = 75
BEAT = 60 / BPM
BARS = 32
LENGTH = BARS * 4 * BEAT
N = round(LENGTH * SR)
SEED = 20261121

# Configure the imported orchestra's timebase in memory, never its source file.
base.BPM, base.BEAT, base.BARS, base.LENGTH, base.N = BPM, BEAT, BARS, LENGTH, N
db, hz, edge = base.db, base.hz, base.edge_envelope

# Close, voice-led middle strings, bass in a separate octave. Every four bars
# form a sentence, rather than a random selection of notes from a scale.
CHORDS = {
    "Bm(add9)": (35, (54, 59, 62, 73)),
    "Gmaj7": (31, (54, 59, 62, 67)),
    "D/F#": (30, (54, 57, 62, 66)),
    "Asus4": (33, (52, 57, 62, 69)),
    "Em9": (28, (55, 59, 62, 66)),
    "Bm/F#": (30, (54, 59, 62, 66)),
    "F#7sus4": (30, (54, 59, 61, 64)),
    "F#7": (30, (54, 58, 61, 64)),
    "Dmaj9": (38, (54, 57, 61, 64)),
    "A/C#": (37, (52, 57, 61, 64)),
    "G6": (31, (55, 59, 62, 64)),
    "A(add9)": (33, (52, 57, 59, 61)),
    "Bm7": (35, (54, 57, 59, 62)),
    "Dmaj9/A": (33, (54, 57, 61, 64)),
    "Bm(add9)/F#": (30, (54, 59, 62, 73)),
}
PROGRESSION = [
    "Bm(add9)", "Gmaj7", "D/F#", "Asus4", "Em9", "Bm/F#", "F#7sus4", "F#7",
    "Bm(add9)", "Gmaj7", "D/F#", "A(add9)", "Em9", "Gmaj7", "F#7sus4", "F#7",
    "Dmaj9", "A/C#", "Bm7", "Gmaj7", "D/F#", "Em9", "A(add9)", "Dmaj9/A",
    "Bm(add9)", "Gmaj7", "D/F#", "Em9", "G6", "F#7sus4", "Bm/F#", "Bm(add9)/F#",
]

# Beat, MIDI pitch, sounding duration in beats, touch. Five-note identity:
# B4 D5 C#5 F#5 E5; onsets 0, 1.5, 2, 3, 5; rest after beat 7.
MOTIF = [(0, 71, 1.4, .88), (1.5, 74, .45, .75), (2, 73, .9, .77),
         (3, 78, 1.9, .91), (5, 76, 2, .79)]
MELODY_A = MOTIF + [
    (8, 74, 1.8, .79), (10, 73, .9, .70), (11, 69, 1.8, .76), (13, 71, 1.8, .73),
    (16, 71, 1.4, .83), (17.5, 74, .45, .72), (18, 73, .9, .73),
    (19, 78, 1.8, .85), (21, 74, 1.9, .75),
    (24, 73, 1.9, .75), (26, 71, .9, .68), (27, 70, 2.8, .72),
]
MELODY_A2 = MOTIF + [
    (8, 74, 1.4, .84), (9.5, 76, .45, .73), (10, 78, 1.9, .89),
    (12, 76, 1, .78), (13.5, 73, 1.9, .77),
    (16, 71, .9, .78), (17, 74, .9, .81), (18, 78, 1.8, .88),
    (20, 79, 1.5, .85), (22, 78, 1.7, .81),
    (24, 76, 1.8, .83), (26, 73, .9, .76), (27, 70, 2, .77), (30, 73, 1, .72),
]
MELODY_B = [
    (0, 74, 1.4, .92), (1.5, 78, .45, .83), (2, 76, .9, .84),
    (3, 81, 1.9, .96), (5, 78, 2, .86),
    (8, 78, 1.4, .90), (9.5, 76, .45, .79), (10, 74, 1.8, .84),
    (12, 71, .9, .80), (13, 74, 2, .85),
    (16, 78, 1.4, .93), (17.5, 81, .45, .86), (18, 83, 1.9, .95),
    (20, 81, 1, .88), (21.5, 79, 1.5, .84),
    (24, 78, 1, .87), (25.5, 76, 1.4, .81), (27, 73, 1.8, .78),
    (29, 74, 2.5, .82),
]
MELODY_RETURN = MOTIF + [
    (8, 74, 1.7, .77), (10, 73, .9, .68), (11, 71, 1.8, .72),
    (13, 66, 1.8, .66),
    (16, 67, 1.8, .72), (18, 66, 1.8, .68), (20, 64, 1.8, .66),
    (22, 61, 1.8, .64), (24, 62, 1.9, .69), (26.5, 61, 1.2, .60),
    (28, 59, 3.2, .66),
]


class MenuOrchestra(base.Orchestra):
    def __init__(self):
        super().__init__()
        self.rng = np.random.default_rng(SEED)
        self.piano_cache = {}
        self.string_cache = {}

    def piano(self, midi, beat, duration=1.6, touch=.8, pan=.05, weight=1):
        """Soft hammer, imperfect unisons and damped, inharmonic string modes."""
        key = (midi, round(duration, 3))
        if key not in self.piano_cache:
            length = duration * BEAT + 2.7
            t = np.arange(round(length * SR)) / SR
            f = hz(midi)
            voice = np.zeros_like(t)
            brightness = .000035 * 2 ** ((midi - 60) / 24)
            for h in range(1, min(22, int(9500 / f))):
                amp = np.exp(-h / 5.5) / h ** 1.32
                decay = (2.35 * 2 ** ((60 - midi) / 36)) / (1 + .19 * h)
                for cents, level in [(-.65, .30), (0, .45), (.85, .25)]:
                    freq = f * h * np.sqrt(1 + brightness * h * h) * 2 ** (cents / 1200)
                    voice += level * amp * np.sin(2*np.pi*freq*t) * np.exp(-t/decay)
            # A low, brief soundboard mode adds wood without a bright click.
            voice += .012 * np.sin(2*np.pi*175*t) * np.exp(-t/.025)
            damper = np.exp(-np.maximum(t - duration*BEAT, 0) / .36)
            voice *= edge(t, length, .006, .15) * damper
            self.piano_cache[key] = voice.astype(np.float32)
        self.add(self.piano_cache[key], beat*BEAT, .205*touch*weight, pan, .34)

    def strings(self, midi, beat, duration, intensity=.6, pan=0):
        """Five bowed unisons: mellow spectrum, independent vibrato, slow bow."""
        key = (midi, duration)
        if key not in self.string_cache:
            length = duration*BEAT + .95
            t = np.arange(round(length*SR)) / SR
            f = hz(midi)
            voice = np.zeros_like(t)
            for i, cents in enumerate((-6.3, -2.8, .4, 3.5, 6.1)):
                ph = .71 + i*1.25 + midi*.17
                phase = (2*np.pi*f*2**(cents/1200)*t
                         + .20*np.sin(2*np.pi*(4.8+i*.19)*t+ph)
                         + .09*np.sin(2*np.pi*.33*t+ph))
                bow = .94 + .06*np.sin(2*np.pi*(.65+i*.09)*t+ph)
                for h in range(1, min(24, int(6200/f))):
                    body = .75 + .30*np.exp(-((f*h-850)/500)**2)
                    level = body * np.exp(-f*h/2100) / (h**1.15 * 5)
                    voice += level*np.sin(h*phase+.13*h)*bow
            voice *= edge(t, length, .65, .95)
            # Gentle bow swell inside each bar; no sharp pad retriggers.
            voice *= .86 + .14*np.sin(np.pi*np.clip(t/length, 0, 1))
            self.string_cache[key] = voice.astype(np.float32)
        self.add(self.string_cache[key], beat*BEAT-.22, .071*intensity, pan, .56)


def compose():
    orch = MenuOrchestra()
    for bar, chord in enumerate(PROGRESSION):
        beat = bar*4
        bass, tones = CHORDS[chord]
        # A single broad arch, mirrored by orchestration rather than a compressor.
        strength = float(np.interp(bar, [0, 7, 8, 15, 16, 20, 23, 24, 28, 31],
                                  [.73, .77, .81, .90, 1.03, 1.10, .95, .83, .74, .73]))
        # Clear low root and a fifth; piano supplies the warm left hand.
        orch.piano(bass+12, beat+.04, 3.1, .52*strength, -.15, .86)
        if bar % 2 == 0:
            orch.piano(bass+19, beat+2.05, 1.65, .29*strength, -.12, .72)
        # Harp enters around, rather than on, the melody's first attack.
        positions = [.48, 1.03, 2.48, 3.10]
        indices = [0, 2, 1, 3] if bar % 2 == 0 else [0, 1, 2, 3]
        if 12 <= bar < 24:
            positions, indices = [.48, 1.03, 1.55, 2.48, 3.10, 3.55], [0, 2, 1, 3, 2, 1]
        for step, (pos, index) in enumerate(zip(positions, indices)):
            orch.pluck(tones[index], beat+pos+orch.rng.uniform(-.009, .009),
                       (.30 if step % 2 else .40)*strength,
                       -.38 if step % 2 == 0 else .34)
        for i, note in enumerate(tones[:3]):
            orch.strings(note, beat, 4, strength*(.82 if bar < 8 else 1), [-.50, .04, .50][i])
        orch.strings(bass, beat, 4, .67*strength, -.14)
        # Choir is supporting harmony, never the leading voice.
        for i, note in enumerate(tones[:3]):
            orch.choir(note+12, beat, 4, .24*strength, [-.35, 0, .35][i])
        if 16 <= bar < 24:
            orch.strings(tones[2]+12, beat, 4, .52*strength, .25)
            # Rare deep, muted frame-drum strokes underline the modest epic rise.
            if bar in (16, 18, 20, 22):
                orch.drum(beat+.05, .19)
    for section, melody in enumerate((MELODY_A, MELODY_A2, MELODY_B, MELODY_RETURN)):
        for pos, note, duration, touch in melody:
            strength = [1, 1.03, 1.08, .96][section]
            orch.piano(note, section*32+pos+.07, duration, touch*strength, .07)
            # Only the middle of the climax blooms into an octave string answer.
            if section == 2 and pos in (3, 18):
                orch.strings(note-12, section*32+pos+.15, duration, .52, -.28)
    for bar, note, touch, pan in [(0, 83, .16, .5), (8, 78, .15, -.5),
                                  (16, 86, .23, .5), (20, 83, .18, -.5),
                                  (24, 78, .14, .45)]:
        orch.bell(note, bar*4+.15, touch, pan)
    # base.mix performs circular reverb/EQ; every instrument's release wraps via add.
    return orch.mix()


def analyze_references():
    references = {}
    for name in REFERENCES:
        pcm, stats = base.decode(MUSIC / f"{name}.ogg")
        stats.update(base.musical_estimates(pcm))
        stats["sha256"] = base.fingerprint(MUSIC / f"{name}.ogg")
        # Broad tonal balance helps choose warm timbres without copying melodies.
        mono = pcm.mean(axis=1)[::4].astype(float)
        size = 8192
        frames = np.lib.stride_tricks.sliding_window_view(mono, size)[::size]
        spec = np.mean(np.abs(np.fft.rfft(frames*np.hanning(size)))**2, axis=0)
        f = np.fft.rfftfreq(size, 4/SR)
        stats["spectral_energy_percent"] = {
            label: round(float(100*spec[(f >= low) & (f < high)].sum()/spec.sum()), 2)
            for label, low, high in [("bass_0_250Hz", 0, 250), ("body_250_2000Hz", 250, 2000),
                                      ("air_2000_5512Hz", 2000, SR/8+1)]}
        stats["stereo_correlation"] = float(np.corrcoef(pcm[::8].T)[0, 1])
        references[name] = stats
        print(f"{name}: {stats['integrated_lufs']:.1f} LUFS, "
              f"{stats['sample_peak_dbfs']:.2f} dBFS; {stats['key_candidates'][0]}", flush=True)
    return references


def encode(pcm, output):
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "f32le",
        "-ar", str(SR), "-ac", "2", "-i", "pipe:0", "-c:a", "libvorbis", "-q:a", "10",
        "-map_metadata", "-1", "-metadata", "title=Memoria bajo la luna roja",
        "-metadata", "artist=El Pacto de Hiareth", "-metadata", f"BPM={BPM}",
        "-metadata", "LOOPSTART=0", "-metadata", f"LOOPLENGTH={N}", str(output)
    ], input=np.asarray(pcm, dtype="<f4").tobytes(), check=True)


def probe(path):
    result = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                             "-of", "json", str(path)], capture_output=True, check=True)
    return json.loads(result.stdout)


def choose_pickup(pcm):
    """Place the file join inside the final held chord, before the first theme.

    A roughly three-beat pickup avoids putting a fresh piano attack directly at
    the decoder boundary. No audio is removed, stretched or duplicated.
    Find a low-amplitude stereo crossing near this musical position, subject
    to energy continuity on both 100 ms and 1 s scales.
    """
    centre = N-round(3*BEAT*SR)
    radius = round(.35*BEAT*SR)
    energy = np.mean(pcm.astype(float)**2, axis=1)
    cumulative = np.concatenate(([0.], np.cumsum(energy)))
    choices = []
    for index in range(centre-radius, centre+radius, 32):
        differences = []
        for seconds in (.1, 1.):
            size = round(seconds*SR)
            before = (cumulative[index]-cumulative[index-size])/size
            after = (cumulative[index+size]-cumulative[index])/size
            differences.append(10*np.log10(max(after, 1e-15)/max(before, 1e-15)))
        if abs(differences[0]) < 1.1 and abs(differences[1]) < 1.7:
            near_zero = float(np.sum(pcm[index].astype(float)**2))
            score = near_zero + .00002*((index-centre)/radius)**2
            choices.append((score, index))
    assert choices, "No musically stable pickup position"
    _, index = min(choices)
    return np.roll(pcm, -index, axis=0), (N-index)/SR


def master(pcm):
    # Gentle memoryless peak rounding is periodic, so it cannot reset at the loop.
    # Keep plenty of crest factor; integrated loudness is calibrated after Vorbis.
    pcm /= max(float(np.max(np.abs(pcm))), 1e-12)
    pcm = .87*np.tanh(pcm*1.32)/np.tanh(1.32)
    return pcm.astype(np.float32)


def loop_stats(pcm):
    result = base.continuity(pcm)
    size = round(.025*SR)
    neighborhood = np.concatenate((pcm[-size:], pcm[:size]))
    steps = np.diff(neighborhood.astype(float), axis=0)
    result["local_step_p99"] = float(np.quantile(np.abs(steps), .99))
    result["local_step_rms"] = float(np.sqrt(np.mean(steps**2)))
    # Sample equality alone is not sufficient: also check the adjacent slopes.
    seam_step = pcm[0].astype(float)-pcm[-1]
    slopes = np.vstack((pcm[-1].astype(float)-pcm[-2], pcm[1].astype(float)-pcm[0]))
    result["boundary_slope_error_fs"] = float(np.max(np.abs(slopes-seam_step)))
    result["clipped_samples"] = int(np.count_nonzero(np.abs(pcm) >= 1))
    result["dc_offset_per_channel"] = [float(x) for x in pcm.mean(axis=0, dtype=float)]
    result["side_to_mid_db"] = db(np.sqrt(np.mean((pcm[:, 0]-pcm[:, 1])**2)) /
                                   max(np.sqrt(np.mean((pcm[:, 0]+pcm[:, 1])**2)), 1e-15))
    result["section_rms_dbfs"] = [db(np.sqrt(np.mean(pcm[i*N//4:(i+1)*N//4].astype(float)**2)))
                                     for i in range(4)]
    result["bar_rms_dbfs"] = [db(np.sqrt(np.mean(pcm[i*N//32:(i+1)*N//32].astype(float)**2)))
                                 for i in range(32)]
    return result


def passes(final, seam, target):
    return (final["samples_per_channel"] == N and 70 <= final["duration_s"] <= 110
            and final["sample_peak_dbfs"] < -1.1 and final["true_peak_dbtp"] < -1.1
            and abs(final["integrated_lufs"]-target) <= .2
            and seam["clipped_samples"] == 0
            and seam["boundary_sample_difference"] < min(.001, seam["local_step_p99"])
            and seam["boundary_slope_error_fs"] < .005
            and abs(seam["window_100ms"]["difference_db"]) < 1.5
            and abs(seam["window_1000ms"]["difference_db"]) < 2)


def write_report(references, final, seam, target, guard_ms, stream, source_hash, pickup_s):
    average = float(np.mean([x["integrated_lufs"] for x in references.values()]))
    level_average = float(np.mean([references[f"Level{i}"]["integrated_lufs"] for i in range(1, 5)]))
    lines = [
        "EL PACTO DE HIARETH — MENÚ PRINCIPAL",
        "Memoria bajo la luna roja · Una historia de pérdida, memoria y fuego",
        "Composición original, síntesis determinista sin samples ni material externo.",
        "", "CONCEPTO Y PARTITURA",
        "La primera voz de piano recuerda a Blair y a los hijos de Aidan; la respuesta",
        "de arpa evoca a Aine. Cuerdas y coro sin palabras sostienen el duelo bajo la",
        "luna roja. El desarrollo abre un espacio de esperanza; el regreso conserva",
        "esa luz sin resolver la pérdida. Épica contenida, sin batería protagonista.",
        f"Si menor → Re mayor (relativa mayor, compases 17–24) → Si menor.",
        f"Tempo {BPM} BPM; 4/4; {BARS} compases; {LENGTH:.6f} segundos.",
        "Leitmotiv de 5 notas: Si4–Re5–Do#5–Fa#5–Mi5 (MIDI 71,74,73,78,76).",
        "Intervalos en semitonos: +3, −1, +5, −2. Nombre: «La memoria del fuego».",
        "Ataques relativos: 0, 1.5, 2, 3, 5 pulsos; duraciones de partitura",
        "1.5, 0.5, 1, 2, 2 pulsos; silencio de 1 pulso al terminar los dos compases.",
        "Las notas se acortan ligeramente al tocar para dejar respirar el piano.",
        "Se expone en compases 1–2, vuelve en 9–10 y 25–26; 5–6 varían la respuesta.",
        "En 17–18 se abre a Re5–Fa#5–Mi5–La5–Fa#5, con el mismo ritmo; el giro",
        "tercera/vecina/salto funciona también aislado para futuros recuerdos o stingers.",
        "A  (0.0–25.6 s): exposición íntima; piano cercano, arpa y cuerdas oscuras.",
        "A2 (25.6–51.2 s): respuesta ascendente y mayor movimiento del arpa.",
        "B  (51.2–76.8 s): cadencia en Re mayor; cuerdas más altas, coro y campanas.",
        "A' (76.8–102.4 s): motivo original; descenso al Si3, respiración y vuelta.",
        f"Tiempos de partitura: el archivo empieza con una anacrusa de {pickup_s:.6f} s",
        "del acorde final; el compás 1 comienza después de ella. Se rota el ciclo",
        "completo sin eliminar, repetir ni estirar muestras; duración inalterada.",
        "Progresión (un acorde por compás):",
    ]
    for label, offset in [("A", 0), ("A2", 8), ("B", 16), ("A'", 24)]:
        lines.append(f"  {label}: " + " | ".join(PROGRESSION[offset:offset+8]))
    lines += [
        "", "ORQUESTACIÓN, COHERENCIA Y MEZCLA",
        "Piano de martillo suave: parciales inarmónicos, tres cuerdas ligeramente",
        "desafinadas y apagador. Arpa de modos amortiguados. Cuerdas de cinco unísonos",
        "con vibrato independiente y arco lento; coro suave de formantes oo/ah.",
        "Cinco campanas lejanas y cuatro golpes graves muy discretos en el clímax.",
        "Registro grave centrado, piano casi central, arpa y cuerdas a ambos lados.",
        "Se reutilizan de gen_music_level3.py: hz, db, edge_envelope, Orchestra.add,",
        "pluck, choir, bell, drum, mix, decode, continuity, musical_estimates y fingerprint.",
        "Colas de notas y reverb circular de 3.6 s conservadas entre vueltas; EQ",
        "periódica a 32 Hz / 7.6 kHz. La paleta arpa/coro/reverb enlaza con Level3;",
        "Si menor enlaza con los candidatos tonales de Level2 y Level4.",
        "Las pistas existentes se analizaron en su totalidad: LUFS, true peak, RMS,",
        "croma, pulso aproximado, balance espectral y correlación estéreo.",
        "Croma/perfiles y autocorrelación son estimaciones, no transcripciones:",
        "son posibles ambigüedades de relativa mayor/menor y medio/doble tempo.",
    ]
    for name, x in references.items():
        lines += [
            f"{name}: {x['duration_s']:.6f} s; {x['integrated_lufs']:.1f} LUFS; "
            f"RMS {x['rms_dbfs']:.3f} dBFS; pico {x['sample_peak_dbfs']:.3f} dBFS; "
            f"true peak {x['true_peak_dbtp']:.1f} dBTP.",
            "  Tonalidad candidata: " + "; ".join(f"{k['key']} (r={k['correlation']})" for k in x['key_candidates']),
            "  Pulso candidato: " + ", ".join(str(k['bpm'])+" BPM" for k in x['tempo_candidates'][:3]),
            "  Energía espectral (%): " + json.dumps(x['spectral_energy_percent']),
            f"  Correlación estéreo {x['stereo_correlation']:.4f}; SHA-256 {x['sha256']}",
        ]
    lines += [
        f"Media aritmética de las cinco pistas: {average:.2f} LUFS.",
        f"Media de Level1–4: {level_average:.2f} LUFS.",
        f"Objetivo menú: {target:.2f} LUFS (2.5 LU por debajo de las cinco referencias).",
        f"Diferencia final respecto a Level1–4: {final['integrated_lufs']-level_average:+.2f} LU.",
        "Los picos positivos de algunas referencias son preexistentes; no se copian.",
        "Redondeo suave de picos, ganancia fija calibrada sobre el OGG decodificado,",
        "sin compresor que bombee ni normalización dinámica que altere el crescendo.",
        "", "VERIFICACIÓN SOBRE MENU.OGG DECODIFICADO",
        f"Códec {stream['codec_name']}; {stream['sample_rate']} Hz; {stream['channels']} canales estéreo.",
        f"Duración {final['duration_s']:.9f} s; {final['samples_per_channel']} muestras/canal.",
        f"Pico de muestra {final['sample_peak_dbfs']:.4f} dBFS < −1 dBFS.",
        f"True peak {final['true_peak_dbtp']:.1f} dBTP < −1 dBTP (FFmpeg ebur128).",
        f"Sonoridad integrada {final['integrated_lufs']:.1f} LUFS; RMS {final['rms_dbfs']:.3f} dBFS.",
        f"Muestras con |x| ≥ 1: {seam['clipped_samples']}; todas las muestras finitas.",
        f"Salto final/inicio {seam['boundary_sample_difference']:.9f} FS "
        f"({seam['boundary_difference_dbfs']:.2f} dBFS).",
        f"Paso local p99 {seam['local_step_p99']:.9f} FS; "
        f"error de pendiente en unión {seam['boundary_slope_error_fs']:.9f} FS.",
    ]
    for ms in (10, 50, 100, 1000):
        x = seam[f"window_{ms}ms"]
        lines.append(f"Ventanas {ms} ms: inicio {x['start_rms_dbfs']:.3f}, final "
                     f"{x['end_rms_dbfs']:.3f} dBFS; diferencia {x['difference_db']:+.3f} dB.")
    lines += [
        f"Correlación estéreo {seam['stereo_correlation']:.4f}; side/mid {seam['side_to_mid_db']:.2f} dB.",
        "RMS por cuartos del archivo (anacrusa incluida): " + ", ".join(f"{x:.2f}" for x in seam['section_rms_dbfs'])+" dBFS.",
        f"Protección técnica de extremos: {guard_ms} ms por lado; no se añade silencio ni cola extra.",
        "La armonía Bm/F#→Bm y la envoltura circular mantienen el retorno musical.",
        "Vorbis es con pérdida: «bucle perfecto» aquí significa duración exacta, sin",
        "pausa añadida, colas preservadas y discontinuidad por debajo del paso local",
        "normal y de 0.001 FS (−60 dBFS), verificada tras codificar y decodificar.",
        "También se verifica diferencia energética <1.5 dB en 100 ms, <2 dB en 1 s,",
        "error de pendiente <0.005 FS, pico/true peak <−1.1 dB y objetivo LUFS ±0.2.",
        "Todos los criterios: PASS. Se vuelve a decodificar la salida publicada.",
        "No se ha realizado escucha humana: la comprobación es numérica y estructural.",
        "", "REPRODUCIBILIDAD Y ALCANCE",
        "Ejecutar: tools/.venv/bin/python -B tools/gen_music_menu.py",
        "Solo análisis: tools/.venv/bin/python -B tools/gen_music_menu.py --analyze-only",
        f"NumPy {np.__version__}, FFmpeg/libvorbis q10; semilla {SEED}.",
        f"SHA-256 generador reutilizado sin modificar: {source_hash}",
        f"SHA-256 Menu.ogg: {base.fingerprint(OUTPUT)}",
        "Las cinco referencias y gen_music_level3.py conservan sus SHA-256 iniciales.",
        "Únicos destinos: tools/gen_music_menu.py, tools/menu_music_report.txt,",
        "public/assets/music/Menu.ogg. No se ha modificado código de Phaser.",
        "", "MÉTRICAS COMPLETAS (JSON)",
        json.dumps({"references": references, "final": final, "loop": seam,
                    "target_lufs": target, "guard_ms": guard_ms,
                    "pickup_s": pickup_s}, ensure_ascii=False, indent=2),
    ]
    REPORT.write_text("\n".join(lines)+"\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analyze-only", action="store_true")
    args = parser.parse_args()
    source_hash = base.fingerprint(Path(base.__file__))
    references = analyze_references()
    if args.analyze_only:
        print(json.dumps(references, ensure_ascii=False, indent=2))
        return
    target = float(np.mean([x["integrated_lufs"] for x in references.values()])) - 2.5
    print(f"Composing {LENGTH:.3f}s at {BPM} BPM; target {target:.2f} LUFS", flush=True)
    pcm, pickup_s = choose_pickup(master(compose()))
    print(f"Circular pickup: {pickup_s:.6f}s before first downbeat", flush=True)
    with tempfile.TemporaryDirectory(prefix="hiareth-menu-") as directory:
        candidate = Path(directory) / "Menu.ogg"
        gain = 1.
        success = False
        # Try the untouched circular render first. The smallest necessary endpoint
        # guard mitigates standalone Vorbis window/quantisation errors only.
        for guard_ms in (0, 4, 8, 12, 20, 28, 36, 48):
            trial = pcm.copy()
            if guard_ms:
                size = round(guard_ms*SR/1000)
                ramp = np.sin(np.linspace(0, np.pi/2, size))**2
                trial[:size] *= ramp[:, None]
                trial[-size:] *= ramp[::-1, None]
            for attempt in range(4):
                encode(trial*gain, candidate)
                decoded, final = base.decode(candidate)
                seam = loop_stats(decoded)
                error = target-final["integrated_lufs"]
                print(f"guard={guard_ms}ms gain={gain:.4f} I={final['integrated_lufs']} "
                      f"peak={final['sample_peak_dbfs']:.3f} TP={final['true_peak_dbtp']} "
                      f"seam={seam['boundary_sample_difference']:.7f} "
                      f"100ms={seam['window_100ms']['difference_db']:+.3f}dB "
                      f"1s={seam['window_1000ms']['difference_db']:+.3f}dB", flush=True)
                if abs(error) <= .12:
                    break
                gain *= 10**(error/20)
            if passes(final, seam, target):
                success = True
                break
        assert success, json.dumps({"final": final, "seam": seam}, indent=2)
        assert np.isfinite(decoded).all()
        stream = probe(candidate)["streams"][0]
        assert stream["codec_name"] == "vorbis" and stream["channels"] == 2
        assert int(stream["sample_rate"]) == SR
        assert all(base.fingerprint(MUSIC/f"{name}.ogg") == x["sha256"]
                   for name, x in references.items()), "Reference was modified"
        assert base.fingerprint(Path(base.__file__)) == source_hash
        OUTPUT.write_bytes(candidate.read_bytes())
        # Check the actual delivered file, not just a render or temporary encode.
        delivered, final = base.decode(OUTPUT)
        seam = loop_stats(delivered)
        assert passes(final, seam, target) and np.isfinite(delivered).all()
        write_report(references, final, seam, target, guard_ms, stream, source_hash, pickup_s)
    print(f"PASS: {OUTPUT}; {REPORT}", flush=True)


if __name__ == "__main__":
    main()
