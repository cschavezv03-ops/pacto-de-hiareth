#!/usr/bin/env python3
"""Genera la segunda tanda de efectos de El Pacto de Hiareth.

Sintetiza WAV mono, 16-bit, 22050 Hz usando solo la biblioteca estandar
de Python (wave, struct, math, random). Los archivos se escriben en
public/assets/sfx/ sobrescribiendo los existentes.

Efectos: orbes de experiencia, muerte de enemigo, brasero de control,
nivel superado y derrota del jefe final.
"""

import math
import os
import random
import struct
import wave

SR = 22050
TWO_PI = 2.0 * math.pi
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX_DIR = os.path.join(BASE_DIR, "public", "assets", "sfx")


# ---------------------------------------------------------------------------
# Utilidades de sintesis
# ---------------------------------------------------------------------------

def _samples(seconds):
    """Convierte segundos a numero de muestras."""
    return max(1, int(round(seconds * SR)))


def _at(seconds):
    """Convierte segundos a un indice de muestra."""
    return int(round(seconds * SR))


def _buffer(seconds):
    """Buffer de mezcla de la duracion exacta pedida."""
    return [0.0] * _samples(seconds)


def _add(dst, src, offset=0, gain=1.0):
    """Suma una pista dentro de un buffer en la posicion indicada."""
    start = int(offset)
    n = len(dst)
    for i, value in enumerate(src):
        j = start + i
        if 0 <= j < n:
            dst[j] += value * gain


def _apply(samples, env):
    return [s * e for s, e in zip(samples, env)]


def _gain(samples, gain):
    return [s * gain for s in samples]


def _mix(*tracks):
    n = max(len(track) for track in tracks)
    out = [0.0] * n
    for track in tracks:
        for i, value in enumerate(track):
            out[i] += value
    return out


def _normalize(samples, peak):
    top = max((abs(s) for s in samples), default=0.0)
    if top > 0.0:
        samples = [s * (peak / top) for s in samples]
    return [max(-1.0, min(1.0, s)) for s in samples]


def _fade_edges(samples, fade_in=0.0005, fade_out=0.006):
    """Micro-fundidos en los extremos para garantizar cero clics."""
    n = len(samples)
    a = min(int(round(fade_in * SR)), n)
    r = min(int(round(fade_out * SR)), n)
    for i in range(a):
        samples[i] *= (i + 1) / a
    for i in range(r):
        samples[n - 1 - i] *= (i + 1) / r
    return samples


def _dc_block(samples, r=0.999):
    """Paso-alto suave (~3.5 Hz) para quitar la deriva del ruido grave."""
    out = []
    prev_x = 0.0
    prev_y = 0.0
    for x in samples:
        y = x - prev_x + r * prev_y
        out.append(y)
        prev_x = x
        prev_y = y
    return out


# ---------------------------------------------------------------------------
# Envolventes (siempre empiezan y acaban en cero)
# ---------------------------------------------------------------------------

def _env_perc(n, attack=0.003, tau=0.08, release=0.01):
    """Ataque lineal + caida exponencial + release lineal."""
    a = max(1, min(int(round(attack * SR)), n))
    r = max(0, min(int(round(release * SR)), n))
    k = 1.0 / max(1.0, tau * SR)
    env = []
    for i in range(n):
        if i < a:
            e = (i + 1) / a
        else:
            e = math.exp(-(i - a) * k)
        rem = n - i
        if r and rem <= r:
            e *= rem / r
        env.append(e)
    return env


def _env_note(n, attack=0.01, decay=0.05, sustain=0.7, release=0.05):
    """Envolvente tipo ADSR para notas sostenidas."""
    a = max(0, min(int(round(attack * SR)), n))
    d = max(0, min(int(round(decay * SR)), n - a))
    r = max(0, min(int(round(release * SR)), n - a - d))
    s = n - a - d - r

    env = []
    for i in range(a):
        env.append((i + 1) / a)
    for i in range(d):
        t = (i + 1) / d
        env.append(1.0 + (sustain - 1.0) * t)
    env.extend([sustain] * s)
    for i in range(r):
        env.append(sustain * (1.0 - (i + 1) / r))

    if len(env) < n:
        env.extend([0.0] * (n - len(env)))
    return env[:n]


def _env_swell(n, attack=0.5, release=0.3, curve=1.0):
    """Ataque largo con curva, sostenido y release hasta cero."""
    a = max(1, min(int(round(attack * SR)), n))
    r = max(0, min(int(round(release * SR)), n - a))
    s = n - a - r

    env = []
    for i in range(a):
        env.append(((i + 1) / a) ** curve)
    env.extend([1.0] * s)
    for i in range(r):
        env.append(1.0 - (i + 1) / r)
    return env[:n]


def _env_rise_fall(n, attack=0.2, tau=0.1, release=0.05):
    """Subida lineal y caida exponencial (whooshes, fwoomps)."""
    a = max(1, min(int(round(attack * SR)), n))
    r = max(0, min(int(round(release * SR)), n))
    k = 1.0 / max(1.0, tau * SR)
    env = []
    for i in range(n):
        if i < a:
            e = (i + 1) / a
        else:
            e = math.exp(-(i - a) * k)
        rem = n - i
        if r and rem <= r:
            e *= rem / r
        env.append(e)
    return env


# ---------------------------------------------------------------------------
# Osciladores y timbres
# ---------------------------------------------------------------------------

def _sweep(n, f0, f1, shape="sine", duty=0.5, vib_hz=0.0, vib_depth=0.0):
    """Oscilador con barrido exponencial de frecuencia y vibrato opcional."""
    out = []
    phase = 0.0

    for i in range(n):
        t = i / max(1, n - 1)
        if f0 > 0.0 and f1 > 0.0:
            freq = f0 * (f1 / f0) ** t
        else:
            freq = f0 + (f1 - f0) * t

        if vib_hz:
            freq += vib_depth * math.sin(TWO_PI * vib_hz * i / SR)

        phase += freq / SR
        p = phase % 1.0

        if shape == "square":
            out.append(1.0 if p < duty else -1.0)
        elif shape == "triangle":
            out.append(1.0 - 4.0 * abs(p - 0.5))
        else:
            out.append(math.sin(TWO_PI * p))

    return out


def _filtered_noise(n, cutoff_start, cutoff_end=None):
    """Ruido blanco pasado por un filtro paso-bajo de un polo."""
    if cutoff_end is None:
        cutoff_end = cutoff_start

    out = []
    y = 0.0
    for i in range(n):
        t = i / max(1, n - 1)
        cutoff = cutoff_start * (cutoff_end / cutoff_start) ** t
        alpha = 1.0 - math.exp(-TWO_PI * cutoff / SR)
        x = random.uniform(-1.0, 1.0)
        y += alpha * (x - y)
        out.append(y)

    return out


# Parciales inarmonicos de campana: (ratio, amplitud, factor de caida).
_BELL_PARTIALS = (
    (1.00, 1.00, 1.00),
    (2.00, 0.50, 0.72),
    (2.76, 0.30, 0.52),
    (4.07, 0.16, 0.36),
    (5.43, 0.09, 0.24),
    (6.80, 0.05, 0.16),
)


def _bell(n, freq, tau=0.1, brightness=1.0, detune=0.0):
    """Campana aditiva con parciales inarmonicos y caidas por parcial."""
    out = [0.0] * n
    limit = SR * 0.45

    for ratio, amp, decay_mul in _BELL_PARTIALS:
        f = freq * ratio
        if f >= limit:
            continue
        a = amp * (brightness ** (ratio - 1.0))
        w = TWO_PI * f * (1.0 + detune) / SR
        k = 1.0 / max(1.0, tau * decay_mul * SR)
        phase = 0.0
        for i in range(n):
            out[i] += a * math.exp(-i * k) * math.sin(phase)
            phase += w

    return out


# Armonicos de metal/organo: (ratio, amplitud).
_BRASS_PARTIALS = (
    (1.0, 1.00),
    (2.0, 0.50),
    (3.0, 0.30),
    (4.0, 0.18),
    (5.0, 0.11),
    (6.0, 0.07),
)


def _brass(n, freq, vib_hz=5.0, vib_depth=0.004, detune=0.0):
    """Metal sintetizado: pila armonica con vibrato y detune opcional."""
    out = [0.0] * n
    phase = 0.0
    base = freq * (1.0 + detune)
    limit = SR * 0.45

    for i in range(n):
        f = base * (1.0 + vib_depth * math.sin(TWO_PI * vib_hz * i / SR))
        phase += f / SR
        value = 0.0
        for ratio, amp in _BRASS_PARTIALS:
            if base * ratio < limit:
                value += amp * math.sin(TWO_PI * ratio * phase)
        out[i] = value

    return out


# Armonicos suaves de pad/coro.
_PAD_PARTIALS = (
    (1.0, 1.00),
    (2.0, 0.30),
    (3.0, 0.13),
    (4.0, 0.06),
    (5.0, 0.03),
)


def _pad(n, freq, vib_hz=3.4, vib_depth=0.0025, detune=0.0):
    """Voz de pad/coro con vibrato lento y detune."""
    out = [0.0] * n
    phase = 0.0
    base = freq * (1.0 + detune)
    limit = SR * 0.45

    for i in range(n):
        f = base * (1.0 + vib_depth * math.sin(TWO_PI * vib_hz * i / SR))
        phase += f / SR
        value = 0.0
        for ratio, amp in _PAD_PARTIALS:
            if base * ratio < limit:
                value += amp * math.sin(TWO_PI * ratio * phase)
        out[i] = value

    return out


def _crackle(n, count, amp=0.2):
    """Chispas sueltas de fuego: pequenos bursts de ruido agudo."""
    out = [0.0] * n
    for _ in range(count):
        pos = random.randrange(0, max(1, n))
        length = min(n - pos, _samples(0.018))
        if length <= 2:
            continue
        burst = _filtered_noise(length, 6500.0, 2500.0)
        env = _env_perc(length, attack=0.0006, tau=0.004, release=0.002)
        g = amp * random.uniform(0.25, 1.0)
        for i in range(length):
            out[pos + i] += burst[i] * env[i] * g
    return out


def _transpose(freq, semitones):
    return freq * (2.0 ** (semitones / 12.0))


def _write_wav(name, samples, peak=0.8):
    """Funde extremos, normaliza al pico pedido y escribe el WAV."""
    _fade_edges(samples)
    samples = _normalize(samples, peak)
    path = os.path.join(SFX_DIR, name)

    top = 0
    data = bytearray()
    for s in samples:
        value = int(round(s * 32767.0))
        value = max(-32768, min(32767, value))
        top = max(top, abs(value))
        data.extend(struct.pack("<h", value))

    with wave.open(path, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(bytes(data))

    print(f"{name}: {len(samples) / SR:.2f} s, pico {top / 32767.0:.3f}")


# ---------------------------------------------------------------------------
# Efectos
# ---------------------------------------------------------------------------

def gen_orb_pickup(name, semitones):
    """Tintineo brillante de dos notas ascendentes (Mi6 -> Si6) + brillo."""
    total = 0.18
    out = _buffer(total)
    e6 = _transpose(1318.51, semitones)
    b6 = _transpose(1975.53, semitones)

    # Primera nota: Mi6.
    n = _samples(0.145)
    note = _bell(n, e6, tau=0.055, brightness=0.95)
    env = _env_perc(n, attack=0.002, tau=0.05, release=0.025)
    _add(out, _apply(note, env), 0, 0.95)

    # Segunda nota: Si6, un poco mas fuerte.
    n = _samples(0.125)
    note = _bell(n, b6, tau=0.065, brightness=1.0)
    env = _env_perc(n, attack=0.002, tau=0.06, release=0.012)
    _add(out, _apply(note, env), _at(0.055), 1.0)

    # Brillo final: dos campanitas agudas muy cortas (Mi7 y Si7).
    for freq, gain in ((e6 * 2.0, 0.22), (b6 * 2.0, 0.30)):
        n = _samples(0.07)
        shimmer = _bell(n, freq, tau=0.028, brightness=1.0)
        env = _env_perc(n, attack=0.002, tau=0.025, release=0.008)
        _add(out, _apply(shimmer, env), _at(0.108), gain)

    _write_wav(name, out, peak=0.55)


def gen_enemy_die():
    """Impacto seco + puf magico descendente + chispa ascendente."""
    total = 0.5
    out = _buffer(total)

    # Impacto seco.
    n = _samples(0.14)
    noise = _filtered_noise(n, 5200.0, 700.0)
    thump = _sweep(n, 170.0, 48.0, "sine")
    body = _mix(_gain(noise, 1.0), _gain(thump, 0.85))
    env = _env_perc(n, attack=0.0015, tau=0.035, release=0.01)
    _add(out, _apply(body, env), 0, 1.0)

    # Puf magico: ruido filtrado que cae.
    n = _samples(0.42)
    puff = _dc_block(_filtered_noise(n, 3200.0, 220.0))
    env = _env_perc(n, attack=0.018, tau=0.11, release=0.03)
    _add(out, _apply(puff, env), _at(0.02), 1.5)

    # Tono magico descendente que da cuerpo al puf.
    n = _samples(0.30)
    tone = _sweep(n, 720.0, 180.0, "sine", vib_hz=14.0, vib_depth=25.0)
    env = _env_perc(n, attack=0.01, tau=0.09, release=0.03)
    _add(out, _apply(tone, env), _at(0.03), 0.22)

    # Chispa ascendente final.
    n = _samples(0.13)
    spark = _sweep(n, 950.0, 2900.0, "sine")
    env = _env_perc(n, attack=0.004, tau=0.055, release=0.012)
    _add(out, _apply(spark, env), _at(0.355), 0.5)

    # Campanita que remata la chispa.
    n = _samples(0.10)
    bell = _bell(n, 2637.0, tau=0.035, brightness=1.0)
    env = _env_perc(n, attack=0.002, tau=0.03, release=0.008)
    _add(out, _apply(bell, env), _at(0.40), 0.45)

    _write_wav("enemy_die.wav", out, peak=0.8)


def gen_checkpoint():
    """Brasero: whoosh de fuego que prende + acorde suave de campanas."""
    total = 0.9
    out = _buffer(total)

    # Whoosh: ruido con filtro que sube, con subida y caida de amplitud.
    n = _samples(0.42)
    whoosh = _filtered_noise(n, 260.0, 5200.0)
    hiss = _filtered_noise(n, 1400.0, 7200.0)
    env = _env_rise_fall(n, attack=0.20, tau=0.11, release=0.06)
    _add(out, _apply(whoosh, env), 0, 2.2)
    _add(out, _apply(hiss, env), 0, 0.45)

    # Fwoomp grave del fuego al prender.
    n = _samples(0.32)
    rumble = _sweep(n, 95.0, 52.0, "sine")
    env = _env_rise_fall(n, attack=0.10, tau=0.09, release=0.05)
    _add(out, _apply(rumble, env), _at(0.03), 0.35)

    # Chispas.
    _add(out, _crackle(_samples(0.5), 16, amp=0.22), _at(0.02), 1.0)

    # Acorde mayor de campanas (Do5-Mi5-Sol5-Do6), ligeramente arpegiado.
    notes = (
        (523.25, 0.55),   # Do5
        (659.25, 0.50),   # Mi5
        (783.99, 0.45),   # Sol5
        (1046.50, 0.36),  # Do6
    )
    for idx, (freq, gain) in enumerate(notes):
        off = 0.30 + idx * 0.012
        n = _samples(total - off)
        tone = _bell(n, freq, tau=0.22, brightness=0.9, detune=0.0008 * idx)
        env = _env_perc(n, attack=0.015, tau=0.24, release=0.12)
        _add(out, _apply(tone, env), _at(off), gain)

    _write_wav("checkpoint.wav", out, peak=0.75)


def gen_level_clear():
    """Redoble + fanfarria Do-Mi-Sol-Do' + acorde mayor sostenido."""
    total = 2.2
    out = _buffer(total)

    # Redoble suave al inicio.
    n = _samples(0.62)
    roll = _filtered_noise(n, 2400.0, 1200.0)
    roll_env = _env_rise_fall(n, attack=0.02, tau=0.45, release=0.06)
    for i in range(n):
        trem = 0.55 + 0.45 * (0.5 + 0.5 * math.sin(TWO_PI * 21.0 * i / SR))
        roll[i] *= roll_env[i] * trem
    _add(out, roll, 0, 1.3)

    # Fanfarria: arpegio ascendente con timbre de metales.
    fanfare = (
        (523.25, 0.18, 0.60),   # Do5
        (659.25, 0.34, 0.62),   # Mi5
        (783.99, 0.50, 0.64),   # Sol5
        (1046.50, 0.66, 0.66),  # Do6
    )
    for freq, start, gain in fanfare:
        n = _samples(0.34)
        voice_a = _brass(n, freq, vib_hz=5.4, vib_depth=0.0045)
        voice_b = _brass(n, freq, vib_hz=5.4, vib_depth=0.0045, detune=0.002)
        body = _mix(voice_a, _gain(voice_b, 0.45))
        env = _env_note(n, attack=0.012, decay=0.06, sustain=0.72, release=0.06)
        _add(out, _apply(body, env), _at(start), gain)

    # Acorde mayor final sostenido, con vibrato y voces ligeramente desafinadas.
    start = 0.84
    n = _samples(total - start)
    env = _env_note(n, attack=0.025, decay=0.0, sustain=1.0, release=0.45)
    chord = (
        (261.63, 0.42),  # Do4
        (523.25, 0.60),  # Do5
        (659.25, 0.56),  # Mi5
        (783.99, 0.50),  # Sol5
        (1046.50, 0.42), # Do6
    )
    for freq, gain in chord:
        voice_a = _brass(n, freq, vib_hz=5.1, vib_depth=0.004)
        voice_b = _brass(n, freq, vib_hz=5.1, vib_depth=0.004, detune=0.0018)
        body = _mix(voice_a, _gain(voice_b, 0.5))
        _add(out, _apply(body, env), _at(start), gain)

    # Brillo de campanas sobre el acorde.
    for freq, gain in ((1046.50, 0.16), (1318.51, 0.13), (1567.98, 0.10)):
        n = _samples(0.9)
        shimmer = _bell(n, freq, tau=0.35, brightness=0.95)
        env = _env_perc(n, attack=0.01, tau=0.3, release=0.15)
        _add(out, _apply(shimmer, env), _at(0.86), gain)

    _write_wav("level_clear.wav", out, peak=0.8)


def gen_boss_defeat():
    """Explosion grave larga + acorde epico creciente + campana grave."""
    total = 4.5
    out = _buffer(total)

    # Explosion: ruido grave con cola + sub que cae.
    n = _samples(3.6)
    low = _dc_block(_filtered_noise(n, 1100.0, 55.0))
    sub = _sweep(n, 82.0, 26.0, "sine")
    env = _env_perc(n, attack=0.01, tau=0.85, release=0.5)
    boom = _mix(_gain(low, 6.0), _gain(sub, 0.9))
    _add(out, _apply(boom, env), 0, 1.0)

    # Crack agudo del impacto.
    n = _samples(0.30)
    crack = _filtered_noise(n, 7500.0, 900.0)
    env = _env_perc(n, attack=0.002, tau=0.06, release=0.05)
    _add(out, _apply(crack, env), 0, 0.55)

    # Segunda cola de retumbe.
    n = _samples(2.8)
    rumble = _dc_block(_filtered_noise(n, 350.0, 45.0))
    env = _env_perc(n, attack=0.15, tau=0.75, release=0.5)
    _add(out, _apply(rumble, env), _at(0.25), 3.2)

    # Acorde epico que crece: Do mayor abierto, tres voces desafinadas.
    start = 0.7
    n = _samples(total - start)
    env = _env_swell(n, attack=1.7, release=0.75, curve=1.6)
    chord = (
        (65.41, 0.55),    # Do2
        (130.81, 0.62),   # Do3
        (196.00, 0.50),   # Sol3
        (261.63, 0.55),   # Do4
        (329.63, 0.50),   # Mi4
        (392.00, 0.45),   # Sol4
        (523.25, 0.38),   # Do5
    )
    for freq, gain in chord:
        voice = [0.0] * n
        for detune in (-0.0035, 0.0, 0.0035):
            part = _pad(n, freq, vib_hz=3.3, vib_depth=0.0025, detune=detune)
            for i in range(n):
                voice[i] += part[i]
        _add(out, _apply(voice, env), _at(start), gain * 0.33)

    # Campana grave que resuena.
    n = _samples(3.2)
    bell = _bell(n, 130.81, tau=1.5, brightness=0.75)
    sub = _sweep(n, 65.41, 65.41, "sine")
    body = _mix(bell, _gain(sub, 0.35))
    env = _env_perc(n, attack=0.02, tau=1.6, release=0.6)
    _add(out, _apply(body, env), _at(1.15), 0.6)

    # Brillo magico lejano sobre el acorde.
    n = _samples(1.8)
    shimmer = _bell(n, 1046.50, tau=0.5, brightness=0.8)
    env = _env_perc(n, attack=0.02, tau=0.6, release=0.4)
    _add(out, _apply(shimmer, env), _at(2.3), 0.18)

    _write_wav("boss_defeat.wav", out, peak=0.85)


def main():
    random.seed(2024)
    os.makedirs(SFX_DIR, exist_ok=True)

    gen_orb_pickup("orb_pickup.wav", 0)
    gen_orb_pickup("orb_pickup2.wav", 1)
    gen_orb_pickup("orb_pickup3.wav", 2)
    gen_enemy_die()
    gen_checkpoint()
    gen_level_clear()
    gen_boss_defeat()


if __name__ == "__main__":
    main()
