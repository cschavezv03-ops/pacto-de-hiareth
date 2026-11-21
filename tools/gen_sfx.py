#!/usr/bin/env python3
"""Genera los efectos de sonido retro de El Pacto de Hiareth.

Sintetiza WAV mono, 16-bit, 22050 Hz usando solo la biblioteca estandar
de Python. Los archivos se escriben en public/assets/sfx/.
"""

import math
import os
import random
import struct
import wave

SR = 22050
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX_DIR = os.path.join(BASE_DIR, "public", "assets", "sfx")


# ---------------------------------------------------------------------------
# Utilidades de sintesis
# ---------------------------------------------------------------------------

def _samples(seconds):
    """Convierte segundos a numero de muestras."""
    return max(1, int(round(seconds * SR)))


def _adsr(n, attack=0.005, decay=0.05, sustain=0.0, release=0.01):
    """Envolvente ADSR con ataque/release lineales y decay exponencial."""
    a = max(0, min(int(round(attack * SR)), n))
    r = max(0, min(int(round(release * SR)), n - a))
    d = max(0, min(int(round(decay * SR)), n - a - r))
    s = n - a - d - r

    env = []
    if a:
        env.extend((i + 1) / a for i in range(a))
    if d:
        k = 1.0 - math.exp(-5.0)
        for i in range(d):
            t = i / max(1, d - 1)
            env.append(1.0 + (sustain - 1.0) * (1.0 - math.exp(-5.0 * t)) / k)
    if s:
        env.extend([sustain] * s)
    if r:
        env.extend(sustain * (1.0 - (i + 1) / r) for i in range(r))

    # Proteccion ante redondeos: la envolvente debe medir exactamente n.
    if len(env) < n:
        env.extend([0.0] * (n - len(env)))
    return env[:n]


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
            freq += vib_depth * math.sin(2.0 * math.pi * vib_hz * i / SR)

        phase += freq / SR
        p = phase % 1.0

        if shape == "square":
            out.append(1.0 if p < duty else -1.0)
        elif shape == "triangle":
            out.append(1.0 - 4.0 * abs(p - 0.5))
        else:
            out.append(math.sin(2.0 * math.pi * p))

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
        alpha = 1.0 - math.exp(-2.0 * math.pi * cutoff / SR)
        x = random.uniform(-1.0, 1.0)
        y += alpha * (x - y)
        out.append(y)

    return out


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


def _concat(parts):
    out = []
    for part in parts:
        out.extend(part)
    return out


def _normalize(samples, peak):
    top = max((abs(s) for s in samples), default=0.0)
    if top > 0.0:
        gain = peak / top
        samples = [s * gain for s in samples]
    return [max(-1.0, min(1.0, s)) for s in samples]


def _write_wav(name, samples, peak=0.8):
    samples = _normalize(samples, peak)
    path = os.path.join(SFX_DIR, name)

    with wave.open(path, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SR)

        data = bytearray()
        for s in samples:
            value = int(round(s * 32767.0))
            value = max(-32768, min(32767, value))
            data.extend(struct.pack("<h", value))

        wav.writeframes(bytes(data))

    print(f"{name}: {len(samples) / SR:.2f} s")


# ---------------------------------------------------------------------------
# Efectos
# ---------------------------------------------------------------------------

def gen_jump():
    n = _samples(0.18)
    tone = _sweep(n, 220.0, 900.0, "square", duty=0.5)
    env = _adsr(n, attack=0.005, decay=0.17, sustain=0.0, release=0.005)
    _write_wav("jump.wav", _apply(tone, env))


def gen_attack():
    n = _samples(0.2)
    noise = _filtered_noise(n, 6500.0, 800.0)
    tone = _sweep(n, 320.0, 75.0, "sine")
    body = _mix(_gain(noise, 1.1), _gain(tone, 0.45))
    env = _adsr(n, attack=0.004, decay=0.196, sustain=0.0, release=0.0)
    _write_wav("attack.wav", _apply(body, env))


def gen_enemy_hit():
    n = _samples(0.12)
    noise = _filtered_noise(n, 3800.0, 900.0)
    tone = _sweep(n, 150.0, 55.0, "square", duty=0.5)
    body = _mix(_gain(noise, 1.0), _gain(tone, 0.9))
    env = _adsr(n, attack=0.002, decay=0.118, sustain=0.0, release=0.0)
    _write_wav("enemy_hit.wav", _apply(body, env))


def gen_enemy_die():
    n = _samples(0.45)
    tone = _sweep(n, 700.0, 65.0, "square", duty=0.5)
    noise = _filtered_noise(n, 4500.0, 500.0)

    tone_env = _adsr(n, attack=0.005, decay=0.44, sustain=0.0, release=0.005)
    noise_env = _adsr(n, attack=0.003, decay=0.22, sustain=0.0, release=0.0)

    body = _mix(
        _apply(tone, tone_env),
        _gain(_apply(noise, noise_env), 0.6),
    )
    _write_wav("enemy_die.wav", body)


def gen_player_hurt():
    n = _samples(0.3)
    tone = _sweep(
        n, 420.0, 85.0, "square", duty=0.35, vib_hz=30.0, vib_depth=18.0
    )
    noise = _filtered_noise(n, 3000.0, 700.0)
    body = _mix(_gain(tone, 1.0), _gain(noise, 0.35))
    env = _adsr(n, attack=0.003, decay=0.29, sustain=0.0, release=0.007)
    _write_wav("player_hurt.wav", _apply(body, env))


def gen_player_die():
    notes = [
        (440.00, 0.20),  # A4
        (349.23, 0.20),  # F4
        (293.66, 0.22),  # D4
        (220.00, 0.28),  # A3
    ]

    parts = []
    for freq, duration in notes:
        n = _samples(duration)
        tone = _sweep(
            n, freq, freq * 0.985, "square", duty=0.5,
            vib_hz=5.0, vib_depth=2.5,
        )
        env = _adsr(n, attack=0.008, decay=0.06, sustain=0.45, release=0.05)
        parts.append(_apply(tone, env))

    _write_wav("player_die.wav", _concat(parts))


def gen_alien_shot():
    n = _samples(0.22)
    tone = _sweep(n, 1600.0, 300.0, "sine")
    env = _adsr(n, attack=0.003, decay=0.21, sustain=0.0, release=0.007)
    _write_wav("alien_shot.wav", _apply(tone, env))


def gen_player_shot():
    n = _samples(0.15)
    noise = _filtered_noise(n, 5000.0, 1200.0)
    tone = _sweep(n, 700.0, 200.0, "sine")

    tone_env = _adsr(n, attack=0.002, decay=0.14, sustain=0.0, release=0.008)
    noise_env = _adsr(n, attack=0.002, decay=0.06, sustain=0.0, release=0.0)

    body = _mix(
        _apply(tone, tone_env),
        _gain(_apply(noise, noise_env), 0.6),
    )
    _write_wav("player_shot.wav", body)


def gen_boss_shot():
    n = _samples(0.25)
    tone = _sweep(
        n, 180.0, 120.0, "sine", vib_hz=6.0, vib_depth=7.0
    )
    env = _adsr(n, attack=0.02, decay=0.05, sustain=0.65, release=0.12)
    _write_wav("boss_shot.wav", _apply(tone, env), peak=0.45)


def gen_boss_hit():
    n = _samples(0.12)
    tone_a = _sweep(n, 620.0, 590.0, "sine")
    tone_b = _sweep(n, 890.0, 850.0, "sine")
    body = _mix(_gain(tone_a, 0.65), _gain(tone_b, 0.5))
    env = _adsr(n, attack=0.002, decay=0.118, sustain=0.0, release=0.0)
    _write_wav("boss_hit.wav", _apply(body, env))


def gen_level_clear():
    notes = [
        (523.25, 0.18),  # Do5
        (659.25, 0.18),  # Mi5
        (783.99, 0.18),  # Sol5
        (1046.50, 0.26), # Do6
    ]

    parts = []
    for freq, duration in notes:
        n = _samples(duration)
        tone = _sweep(n, freq, freq, "square", duty=0.5)
        env = _adsr(n, attack=0.005, decay=0.06, sustain=0.55, release=0.04)
        parts.append(_apply(tone, env))

    _write_wav("level_clear.wav", _concat(parts))


def gen_ui_select():
    n = _samples(0.08)
    tone = _sweep(n, 1300.0, 1700.0, "square", duty=0.5)
    env = _adsr(n, attack=0.002, decay=0.075, sustain=0.0, release=0.003)
    _write_wav("ui_select.wav", _apply(tone, env))


def main():
    random.seed(7)
    os.makedirs(SFX_DIR, exist_ok=True)

    gen_jump()
    gen_attack()
    gen_enemy_hit()
    gen_enemy_die()
    gen_player_hurt()
    gen_player_die()
    gen_alien_shot()
    gen_player_shot()
    gen_boss_shot()
    gen_boss_hit()
    gen_level_clear()
    gen_ui_select()


if __name__ == "__main__":
    main()
