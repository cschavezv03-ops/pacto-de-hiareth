#!/usr/bin/env python3
"""Compose Limbo without samples; NumPy + FFmpeg, deterministic and self-verifying.

Run with tools/.venv/bin/python tools/gen_music_level3.py.
Only Level3.ogg and level3_music_report.txt are written (intermediates use /tmp).
Use --analyze-only to print reference measurements without writing either output.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MUSIC = ROOT / "public/assets/music"
REPORT = ROOT / "tools/level3_music_report.txt"
REFERENCES = ("Level1", "Level2", "Level4", "BOSSFIGTH")
SR = 44100
EPS = 1e-15
BPM = 80
BEAT = 60 / BPM
BARS = 32
LENGTH = BARS * 4 * BEAT
N = round(LENGTH * SR)
FADE_MS = 12


def db(value):
    return float(20 * np.log10(max(float(value), EPS)))


def fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path):
    result = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
         "-af", "ebur128=peak=true:framelog=quiet", "-ar", str(SR), "-ac", "2",
         "-f", "f32le", "pipe:1"], capture_output=True, check=True)
    pcm = np.frombuffer(result.stdout, dtype="<f4").reshape(-1, 2)
    log = result.stderr.decode(errors="replace")
    loudness = re.findall(r"I:\s*([-\d.]+) LUFS", log)
    true_peaks = re.findall(r"Peak:\s*([-\d.]+) dBFS", log)
    metrics = {
        "duration_s": len(pcm) / SR,
        "samples_per_channel": len(pcm),
        "rms_dbfs": db(np.sqrt(np.mean(pcm.astype(np.float64) ** 2))),
        "sample_peak_dbfs": db(np.max(np.abs(pcm))),
        "integrated_lufs": float(loudness[-1]),
        "true_peak_dbtp": float(true_peaks[-1]),
    }
    return pcm, metrics


def musical_estimates(pcm):
    """Spectral-flux autocorrelation and peak chroma/profile correlation.

    Estimates are intentionally labelled uncertain: half/double tempo and relative
    major/minor are ambiguous without a score. No package or network is required.
    """
    rate = SR / 4
    mono = pcm.mean(axis=1)[::4].astype(np.float64)
    hop, size = 256, 2048
    frames = np.lib.stride_tricks.sliding_window_view(mono, size)[::hop]
    flux = []
    previous = None
    for begin in range(0, len(frames), 256):
        spec = np.abs(np.fft.rfft(frames[begin:begin+256] * np.hanning(size)))
        spec = np.log1p(10 * spec[:, 8:900])
        predecessor = spec[:1] if previous is None else previous[None, :]
        differences = np.diff(np.concatenate((predecessor, spec)), axis=0)
        flux.extend(np.maximum(differences, 0).mean(axis=1))
        previous = spec[-1]
    onset = np.asarray(flux)
    onset -= onset.mean()
    nfft = 1 << (2 * len(onset) - 1).bit_length()
    ac = np.fft.irfft(np.abs(np.fft.rfft(onset, nfft)) ** 2, nfft)[:len(onset)]
    ac /= np.maximum(len(onset) - np.arange(len(onset)), 1)
    lo, hi = int(rate / hop * 60 / 190), int(rate / hop * 60 / 48)
    peaks = [i for i in range(lo + 1, hi)
             if ac[i] > ac[i-1] and ac[i] >= ac[i+1]]
    peaks.sort(key=lambda i: ac[i], reverse=True)
    tempo = [{"bpm": round(60 * rate / (hop * i), 1),
              "autocorrelation": round(float(ac[i] / max(ac[0], EPS)), 3)}
             for i in peaks[:5]]

    size, hop = 8192, 4096
    frequencies = np.fft.rfftfreq(size, 1 / rate)
    frames = np.lib.stride_tricks.sliding_window_view(mono, size)[::hop]
    chroma = np.zeros(12)
    for begin in range(0, len(frames), 128):
        spectrum = np.abs(np.fft.rfft(frames[begin:begin+128] * np.hanning(size)))
        # Local peaks avoid assigning broad noise/formants as pitched notes.
        peaks_mask = (spectrum[:, 1:-1] > spectrum[:, :-2]) & (spectrum[:, 1:-1] > spectrum[:, 2:])
        frame_ix, bin_ix = np.where(peaks_mask)
        bin_ix += 1
        good = (frequencies[bin_ix] >= 65) & (frequencies[bin_ix] <= 2200)
        frame_ix, bin_ix = frame_ix[good], bin_ix[good]
        a, b, c = (spectrum[frame_ix, bin_ix + offset] for offset in (-1, 0, 1))
        offset = 0.5 * (a - c) / (a - 2 * b + c - EPS)
        freq = (bin_ix + offset) * rate / size
        midi = 69 + 12 * np.log2(freq / 440)
        weight = b ** 0.65 * np.exp(-0.5 * ((midi - np.round(midi)) / .25) ** 2)
        np.add.at(chroma, np.round(midi).astype(int) % 12, weight)
    profiles = {
        "mayor": np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]),
        "menor": np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]),
    }
    names = ["Do", "Do#", "Re", "Mib", "Mi", "Fa", "Fa#", "Sol", "Lab", "La", "Sib", "Si"]
    keys = []
    for mode, profile in profiles.items():
        for root in range(12):
            score = np.corrcoef(chroma, np.roll(profile, root))[0, 1]
            keys.append({"key": f"{names[root]} {mode}", "correlation": round(float(score), 3)})
    keys.sort(key=lambda x: x["correlation"], reverse=True)
    return {"tempo_candidates": tempo, "key_candidates": keys[:3],
            "chroma": [round(float(x), 4) for x in chroma / chroma.sum()]}


def analyze_references():
    measurements = {}
    for name in REFERENCES:
        pcm, stats = decode(MUSIC / f"{name}.ogg")
        stats.update(musical_estimates(pcm))
        stats["sha256"] = fingerprint(MUSIC / f"{name}.ogg")
        measurements[name] = stats
        print(name, json.dumps(stats, ensure_ascii=False), flush=True)
    return measurements


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def edge_envelope(t, duration, attack=.008, release=.04):
    return (np.sin(np.clip(t / attack, 0, 1) * np.pi / 2) ** 2
            * np.sin(np.clip((duration - t) / release, 0, 1) * np.pi / 2) ** 2)


class Orchestra:
    """Modal instruments, voiced ensemble and circular, stereo reverb sends."""

    def __init__(self):
        self.rng = np.random.default_rng(197903)
        self.dry = np.zeros((N, 2), dtype=np.float32)
        self.send = np.zeros((N, 2), dtype=np.float32)

    def add(self, signal, seconds, gain, pan=0, wet=.35):
        signal = (signal * gain).astype(np.float32)
        start = round(seconds * SR) % N
        # Every voice tail wraps into the beginning; no end-of-file truncation.
        panning = [np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)]
        for offset in range(0, len(signal), N):
            piece = signal[offset:offset+N]
            first = min(len(piece), N - start)
            for ch, value in enumerate(panning):
                self.dry[start:start+first, ch] += piece[:first] * value
                self.send[start:start+first, ch] += piece[:first] * value * wet
                if first < len(piece):
                    self.dry[:len(piece)-first, ch] += piece[first:] * value
                    self.send[:len(piece)-first, ch] += piece[first:] * value * wet

    def celesta(self, midi, beat, velocity=.8, pan=.12, length=3.8):
        t = np.arange(round(length * SR)) / SR
        f = hz(midi)
        voice = np.zeros_like(t)
        # Tine modes: gentle detuning and non-harmonic upper resonances, not a sine beep.
        for ratio, level, decay in [(1,1,1.45),(2.003,.32,.78),(3.997,.12,.4),
                                     (5.41,.075,.24),(7.12,.025,.12)]:
            voice += level * np.sin(2*np.pi*f*ratio*t) * np.exp(-t/decay)
        voice += .06 * np.sin(2*np.pi*f*.9991*t) * np.exp(-t/1.15)
        voice *= edge_envelope(t, length, .005, .15)
        self.add(voice, beat*BEAT, .115*velocity, pan, .52)

    def pluck(self, midi, beat, velocity=.7, pan=-.35):
        length = 2.5
        t = np.arange(round(length * SR)) / SR
        f = hz(midi)
        voice = np.zeros_like(t)
        for harmonic in range(1, 15):
            # Pluck-position comb and faster decay of the upper string modes.
            level = np.sin(harmonic*np.pi*.22) / harmonic**1.18
            decay = 1.1 / (1 + .19*harmonic)
            voice += level * np.sin(2*np.pi*f*harmonic*(1+.000045*harmonic)*t) * np.exp(-t/decay)
        pick = self.rng.normal(size=len(t))
        pick[1:] -= .85 * pick[:-1].copy()
        voice += .009 * pick * np.exp(-t/.012)
        voice *= edge_envelope(t, length, .004, .12)
        self.add(voice, beat*BEAT, .125*velocity, pan, .28)

    def choir(self, midi, beat, duration, velocity=.7, pan=0):
        length = duration*BEAT + 1.1
        t = np.arange(round(length * SR)) / SR
        voice = np.zeros_like(t)
        f = hz(midi)
        for detune in (-.0025, .0003, .0021):
            phase = self.rng.uniform(0, 2*np.pi)
            fundamental = (2*np.pi*f*(1+detune)*t + .022*np.sin(2*np.pi*4.7*t+phase)
                           + .11*np.sin(2*np.pi*.19*t+phase))
            for h in range(1, min(28, int(5000/f))):
                freq = f*h
                # Dark 'oo/ah' vowel formants; low harmonics carry the body.
                formant = (.18*np.exp(-((freq-360)/250)**2)
                           + .7*np.exp(-((freq-720)/300)**2)
                           + .24*np.exp(-((freq-1150)/350)**2)
                           + .08*np.exp(-((freq-2450)/500)**2))
                level = (.13/h**1.3 + formant/h**.8) / 3
                voice += level * np.sin(h*fundamental + .11*h)
        voice *= edge_envelope(t, length, .65, 1.1)
        voice *= .88 + .12*np.sin(2*np.pi*.27*t + .3)
        self.add(voice, beat*BEAT-.23, .2*velocity, pan, .75)

    def bell(self, midi, beat, velocity=.6, pan=.6):
        length = 8
        t = np.arange(round(length * SR)) / SR
        f = hz(midi)
        voice = np.zeros_like(t)
        for ratio, level, decay in [(1,.55,2.6),(2.01,.3,2),(2.76,.16,1.5),
                                    (4.07,.12,.9),(5.43,.06,.6)]:
            voice += level*np.sin(2*np.pi*f*ratio*t)*np.exp(-t/decay)
        voice *= edge_envelope(t, length, .022, .4)
        self.add(voice, beat*BEAT, .09*velocity, pan, 1.4)

    def drum(self, beat, velocity=.6, high=False):
        length = .7
        t = np.arange(round(length * SR)) / SR
        pitch = 109 if high else 69
        # Membrane's falling fundamental + two inharmonic modes and brush noise.
        phase = 2*np.pi*(pitch*t + 18*.018*(1-np.exp(-t/.018)))
        voice = np.sin(phase)*np.exp(-t/.15)
        voice += .25*np.sin(phase*1.59)*np.exp(-t/.08)
        voice += .12*np.sin(phase*2.14)*np.exp(-t/.055)
        noise = self.rng.normal(size=len(t))
        noise = np.convolve(noise, np.ones(9)/9, mode="same")
        voice += .12*noise*np.exp(-t/.04)
        voice *= edge_envelope(t, length, .007, .05)
        self.add(voice, beat*BEAT, .095*velocity, -.08 if high else .06, .18)

    def drone(self):
        t = np.arange(N) / SR
        voice = np.zeros((N, 2), dtype=np.float32)
        # Integer cycle counts make the sustained pedal and its breathing periodic.
        for ch in range(2):
            for midi, level in [(38,.036),(45,.015),(50,.011)]:
                freq = round(hz(midi)*(1 + (ch*2-1)*.0009)*LENGTH)/LENGTH
                phase = 2*np.pi*freq*t + .15*np.sin(2*np.pi*17*t/LENGTH+ch)
                wave = np.sin(phase) + .18*np.sin(2*phase) + .07*np.sin(3*phase)
                breath = .88 + .08*np.sin(2*np.pi*5*t/LENGTH+ch*.25)
                voice[:,ch] += (level*wave*breath).astype(np.float32)
        self.dry += voice
        self.send += voice*.4

    def mix(self):
        """A small stone chapel: early reflections plus a diffused 3.6 s tail.

        Circular convolution includes the preceding cycle's reverberation from
        sample zero. This is a steady-state loop, not a tail faded into silence.
        """
        wet = np.zeros_like(self.dry)
        ir_n = round(3.6*SR)
        t = np.arange(ir_n) / SR
        for ch in range(2):
            noise = self.rng.normal(size=ir_n)
            spectrum = np.fft.rfft(noise)
            freq = np.fft.rfftfreq(ir_n, 1/SR)
            spectrum *= 1 / np.sqrt(1 + (freq/2300)**6)
            diffuse = np.fft.irfft(spectrum, ir_n)
            diffuse *= np.exp(-t/ .55) * np.minimum(t/.09,1)
            diffuse *= .38 / np.sqrt(np.sum(diffuse**2))
            ir = diffuse
            for delay, level in [( .029,.26),(.047,.22),(.073,.17),(.109,.13),(.151,.10),(.211,.07)]:
                ir[round((delay+ch*.0043)*SR)] += level
            padded = np.zeros(N)
            padded[:ir_n] = ir
            source = self.send[:,ch] + .32*self.send[:,1-ch]
            wet[:,ch] = np.fft.irfft(np.fft.rfft(source)*np.fft.rfft(padded), N)
        mix = self.dry + wet*.72
        # Remove subsonic energy and soften the synthesized top end, periodically.
        freq = np.fft.rfftfreq(N, 1/SR)
        eq = (freq**2/(freq**2+32**2)) / np.sqrt(1+(freq/7600)**6)
        for ch in range(2):
            mix[:,ch] = np.fft.irfft(np.fft.rfft(mix[:,ch])*eq, N)
        return mix


CHORDS = {
    "Dm(add9)": (38,[50,53,57,64]),
    "Bbmaj7/D": (38,[50,53,57,58]),
    "Gm(add9)": (43,[50,55,58,69]),
    "Dm/A": (45,[50,53,57,62]),
    "Ebmaj7": (39,[51,55,58,62]),
    "Bbmaj7": (46,[50,53,57,58]),
    "Asus4(b9)": (45,[52,55,58,62]),
    "C(add9)/D": (38,[48,52,55,62]),
    "Ebmaj7/G": (43,[51,55,58,62]),
    "Dm/F": (41,[50,53,57,62]),
    "Fmaj7/A": (45,[48,52,53,57]),
    "A7(b9)": (45,[49,55,58,64]),
    "Gm6": (43,[50,52,55,58]),
}
PROGRESSION = [
    "Dm(add9)","Bbmaj7/D","Gm(add9)","Dm/A","Ebmaj7","Bbmaj7","Asus4(b9)","Dm(add9)",
    "Dm(add9)","C(add9)/D","Bbmaj7","Gm(add9)","Ebmaj7/G","Dm/F","Asus4(b9)","Dm(add9)",
    "Bbmaj7","Fmaj7/A","Gm(add9)","Dm/F","Ebmaj7","Gm(add9)","Asus4(b9)","A7(b9)",
    "Dm(add9)","Bbmaj7/D","Gm(add9)","Dm/A","Ebmaj7","Gm6","Asus4(b9)","Dm(add9)",
]

# (beat within bar, MIDI note, velocity). Rests and falling seconds describe
# forgotten names; B climbs before A' returns to the opening falling third.
MELODY_A = [
    [( .5,74,.86),(2,69,.67),(3,77,.74)],
    [( .5,76,.72),(2,74,.85)],
    [( .5,74,.8),(1.5,70,.64),(3,69,.68)],
    [(1,65,.73),(2.5,69,.76)],
    [( .5,75,.72),(2,74,.82),(3.5,70,.6)],
    [( .5,69,.7),(2,65,.73)],
    [( .5,67,.7),(2,70,.62),(3,69,.66)],
    [( .5,65,.75),(2,62,.74)],
]
MELODY_B = [
    [( .5,77,.82),(2,81,.73),(3,79,.7)],
    [( .5,76,.79),(2.5,72,.68)],
    [( .5,74,.81),(1.5,77,.72),(3,79,.75)],
    [( .5,77,.82),(2,76,.7),(3,74,.75)],
    [( .5,75,.79),(2,79,.72),(3.5,77,.62)],
    [( .5,74,.77),(2,70,.7)],
    [( .5,74,.77),(2,70,.7),(3,69,.65)],
    [( .5,73,.7),(2,76,.65),(3,69,.6)],
]


def compose():
    orch = Orchestra()
    orch.drone()
    for bar, chord in enumerate(PROGRESSION):
        beat = bar*4
        bass, tones = CHORDS[chord]
        section = bar//8
        strength = [ .8,.88,1,.83][section]
        # Broken lute/harp eighths maintain movement without driving the scene.
        patterns = ([0,2,1,3,2,1],[0,1,2,3,1,2],[0,2,3,1,2,3],[0,2,1,3,2,1])
        positions = [.15,.75,1.5,2.15,2.75,3.5]
        for step,(position,index) in enumerate(zip(positions,patterns[section])):
            velocity = strength*(.62 if step%3 else .82)
            # Alternating hands and very small timing shifts avoid rigid repetition.
            jitter = orch.rng.uniform(-.012,.012)
            orch.pluck(tones[index], beat+position+jitter, velocity,
                       -.42 if step%2==0 else .32)
        orch.pluck(bass, beat+.09, .78*strength, -.14)
        if bar%2==1:
            orch.pluck(bass+12, beat+2.1, .32*strength, .2)
        for i,note in enumerate(tones[:3]):
            orch.choir(note, beat, 4, .75*strength, [-.45,.05,.48][i])
        melody = MELODY_B[bar%8] if section==2 else MELODY_A[bar%8]
        for pos,note,velocity in melody:
            # A2 changes the response; A' has a quiet lower octave shadow.
            if section==1 and bar%8 in (1,3,7):
                note += 12 if bar%8==3 else 0
            if section==3 and bar%8==7:
                note = 74 if pos==.5 else 62
            orch.celesta(note, beat+pos, velocity*strength,
                         .12+.12*np.sin(bar*.7))
            if section==3 and bar%8 in (0,2,4) and pos==.5:
                orch.celesta(note-12, beat+pos+.04, .19, -.38)
        # The last dominant leaves a tonic breath and a continuing D/A pedal.
        orch.drum(beat+.12, .52*strength)
        orch.drum(beat+2.12, .32*strength, high=True)
        if section in (1,2) and bar%2:
            orch.drum(beat+3.55, .16, high=True)
    for bar,note,velocity in [(4,63,.4),(14,69,.32),(20,75,.38),(28,63,.32)]:
        orch.bell(note, bar*4+.1, velocity, .6 if bar<16 else -.6)
    return orch.mix()


def master(mix, target_db):
    # Balance adjacent 100 ms seam windows using a smooth, modest local gain.
    window = round(.1*SR)
    first = np.sqrt(np.mean(mix[:window].astype(float)**2))
    last = np.sqrt(np.mean(mix[-window:].astype(float)**2))
    adjustment = float(np.clip(np.sqrt(first/max(last,EPS)), .7,1.4))
    width = round(.6*SR)
    ramp = .5+.5*np.cos(np.linspace(0,np.pi,width))
    mix[:width] *= (1+(1/adjustment-1)*ramp)[:,None]
    mix[-width:] *= (1+(adjustment-1)*ramp[::-1])[:,None]
    ceiling, knee = 10**(-1.8/20), .52
    def saturate(gain):
        x = mix*gain
        a = np.abs(x)
        return np.sign(x)*np.where(a<=knee,a,knee+(ceiling-knee)*np.tanh((a-knee)/(ceiling-knee)))
    target = 10**(target_db/20)
    low, high = 0., 16.
    for _ in range(22):
        mid = (low+high)/2
        trial = saturate(mid)
        rms = np.sqrt(np.mean(trial.astype(float)**2))
        if rms < target:
            low = mid
        else:
            high = mid
    return saturate((low+high)/2).astype('<f4')


def encode(pcm, output, quality):
    subprocess.run(
        ["ffmpeg","-hide_banner","-loglevel","error","-y",
         "-f","f32le","-ar",str(SR),"-ac","2","-i","pipe:0",
         "-c:a","libvorbis","-q:a",str(quality),"-map_metadata","-1",
         "-metadata","title=Limbo - Los nombres olvidados",
         "-metadata","artist=El Pacto de Hiareth",
         "-metadata",f"BPM={BPM}","-metadata","LOOPSTART=0",
         "-metadata",f"LOOPLENGTH={N}",str(output)], input=pcm.tobytes(), check=True)


def continuity(pcm):
    jumps = np.abs(np.diff(pcm.astype(np.float64), axis=0))
    jump = float(np.max(np.abs(pcm[0]-pcm[-1])))
    result = {"boundary_sample_difference": jump, "boundary_difference_dbfs": db(jump),
              "interior_step_p99": float(np.quantile(jumps,.99))}
    for ms in (10,50,100,1000):
        size = round(ms*SR/1000)
        a = db(np.sqrt(np.mean(pcm[:size].astype(float)**2)))
        b = db(np.sqrt(np.mean(pcm[-size:].astype(float)**2)))
        result[f"window_{ms}ms"] = {"start_rms_dbfs":a,"end_rms_dbfs":b,"difference_db":a-b}
    result["stereo_correlation"] = float(np.corrcoef(pcm.T)[0,1])
    return result


def write_report(references, final, seam, target, fade_ms, quality):
    average = float(np.mean([x["rms_dbfs"] for x in references.values()]))
    lines = [
        "EL PACTO DE HIARETH — ACTO 3: LIMBO / Los nombres olvidados",
        "Generado exclusivamente con NumPy y codificado con FFmpeg/libvorbis.",
        "", "REFERENCIAS (OGG decodificado a PCM float32 estéreo, 44.1 kHz)",
        "RMS de ambos canales con NumPy; LUFS integrados y true peak con FFmpeg",
        "ebur128/BS.1770. Valores de pico positivos pertenecen a las referencias.",
        "No se ha modificado ninguna referencia.",
    ]
    for name, stats in references.items():
        lines.append(f"{name}: {stats['duration_s']:.6f} s; RMS {stats['rms_dbfs']:.2f} dBFS; "
                     f"I {stats['integrated_lufs']:.1f} LUFS; pico {stats['sample_peak_dbfs']:.2f} dBFS; "
                     f"true peak {stats['true_peak_dbtp']:.1f} dBTP.")
        lines.append("  Tempo aprox. (candidatos): " + ", ".join(f"{x['bpm']} BPM (r={x['autocorrelation']})" for x in stats['tempo_candidates'][:3]))
        lines.append("  Tonalidad aprox.: " + "; ".join(f"{x['key']} (r={x['correlation']})" for x in stats['key_candidates']))
        lines.append(f"  SHA-256 conservado: {stats['sha256']}")
    lines += [
        "Estimaciones musicales: autocorrelación de flujo espectral (FFT 2048, salto 256,",
        "11.025 kHz); cromas de picos interpolados (FFT 8192) frente a perfiles",
        "Krumhansl. Tempo susceptible a medio/doble pulso; tonalidad relativa o modal",
        "ambigua. Son estimaciones, no transcripciones. Level4 y BOSSFIGTH tienen",
        "candidatos de tempo muy próximos en puntuación.",
        f"Media aritmética de RMS en dB: {average:.3f} dBFS; objetivo: {target:.3f} dBFS.",
        "", "COMPOSICIÓN ORIGINAL",
        "Re menor con color frigio (Mib y bIImaj7) y dominante A7(b9) puntual.",
        "80 BPM, 4/4, 32 compases, 96 segundos exactos; melodía original sin samples.",
        "A (0–24 s): motivo descendente de celesta, arpegio sobrio, aldea vacía.",
        "A2 (24–48 s): respuestas cambiadas y registro ocasionalmente más alto.",
        "B (48–72 s): expansión hacia Sib/Fa, melodía ascendente y mayor pulso.",
        "A' (72–96 s): regreso del motivo con sombra grave y reposo final en Re.",
        "Progresión por compás (todos 4/4):",
    ]
    for section, start in [("A",0),("A2",8),("B",16),("A'",24)]:
        lines.append(f"  {section}: " + " | ".join(PROGRESSION[start:start+8]))
    lines += [
        "Celesta de modos resonantes con decaimiento por parcial; laúd/harpa con",
        "posición de pulsación y amortiguación de armónicos; coro de tres voces",
        "desafinadas por nota, formantes y vibrato; bordón Re/La periódico; cuatro",
        "campanas lejanas; tambor de marco de membrana y ruido suave. Paneo moderado.",
        "Reverb de capilla: reflexiones tempranas + cola difusa amortiguada de 3.6 s.",
        "Convolución circular y colas de instrumentos envueltas sobre el inicio;",
        f"bordón con número entero de ciclos. Ataque/salida técnicos de solo {fade_ms} ms.",
        f"OGG Vorbis calidad {quality}; se selecciona el fundido mínimo que supera",
        "las verificaciones después de la compresión con pérdida.",
        "Control suave de picos por encima de 0.52; sin normalizar a 0 dBFS.",
        "Se prioriza el RMS del soundtrack existente, según el requisito del proyecto.",
        "", "VERIFICACIÓN DEL OGG FINAL REDECODIFICADO (no del render previo)",
        f"Estéreo, {SR} Hz; {final['samples_per_channel']} muestras/canal; duración {final['duration_s']:.6f} s.",
        f"Pico de muestra {final['sample_peak_dbfs']:.3f} dBFS < -1 dBFS.",
        f"True peak {final['true_peak_dbtp']:.1f} dBTP; sonoridad integrada {final['integrated_lufs']:.1f} LUFS.",
        f"RMS {final['rms_dbfs']:.3f} dBFS; diferencia frente a la media {final['rms_dbfs']-average:+.3f} dB (tolerancia ±3 dB).",
        f"Unión última/primera muestra: diferencia máxima {seam['boundary_sample_difference']:.9f} FS "
        f"({seam['boundary_difference_dbfs']:.2f} dBFS).",
        f"Paso interior absoluto percentil 99: {seam['interior_step_p99']:.9f} FS.",
    ]
    for ms in (10,50,100,1000):
        m = seam[f"window_{ms}ms"]
        lines.append(f"Ventanas adyacentes de {ms} ms: inicio {m['start_rms_dbfs']:.3f}, "
                     f"final {m['end_rms_dbfs']:.3f} dBFS; diferencia {m['difference_db']:+.3f} dB.")
    lines += [
        f"Correlación estéreo global: {seam['stereo_correlation']:.4f}.",
        "Criterios automáticos: duración 80–110 s, pico y true peak < -1 dB, RMS ±3 dB,",
        "salto de unión < 0.001 FS y menor que p99 interior, energía en 100 ms ±1 dB.",
        "Todos los criterios anteriores: PASS.",
        "La compresión con pérdida no conserva igualdad exacta de muestras; se miden",
        "sus errores tras decodificar. No se ha realizado escucha humana; las",
        "verificaciones de continuidad y sonoridad aquí son numéricas.",
        "Reproducir: tools/.venv/bin/python tools/gen_music_level3.py",
        "Dependencias: NumPy del venv, FFmpeg con libvorbis; semilla fija 197903.",
        "", "MÉTRICAS COMPLETAS (JSON)",
        json.dumps({"references":references,"final":final,"loop":seam},ensure_ascii=False,indent=2),
    ]
    REPORT.write_text("\n".join(lines)+"\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--analyze-only", action="store_true")
    args = parser.parse_args()
    references = analyze_references()
    if args.analyze_only:
        return
    target = float(np.mean([x['rms_dbfs'] for x in references.values()])) - .8
    print(f"Rendering {LENGTH} s, {BPM} BPM; RMS target {target:.2f} dBFS", flush=True)
    pcm = master(compose(), target)
    with tempfile.TemporaryDirectory(prefix="hiareth-limbo-") as directory:
        candidate = Path(directory)/"Level3.ogg"
        for fade_ms, quality in [(FADE_MS,9),(FADE_MS,10),(24,10),(36,10),(48,10),(64,10)]:
            # Vorbis quantization/windowing can ring beyond a zero-valued source
            # endpoint. Test the actual decoded seam, and keep the shortest fade
            # that works, trying higher precision before lengthening the fade.
            trial = pcm.copy()
            fade_n = round(fade_ms*SR/1000)
            fade = np.sin(np.linspace(0,np.pi/2,fade_n))**2
            trial[:fade_n] *= fade[:,None]
            trial[-fade_n:] *= fade[::-1,None]
            encode(trial, candidate, quality)
            decoded, final = decode(candidate)
            seam = continuity(decoded)
            print(f"Vorbis q{quality}, fade {fade_ms} ms", "Final",json.dumps(final),"Seam",json.dumps(seam),flush=True)
            if (final['true_peak_dbtp'] < -1.1 and final['sample_peak_dbfs'] < -1.1
                    and seam['boundary_sample_difference'] < .001):
                break
            if final['true_peak_dbtp'] >= -1.1 or final['sample_peak_dbfs'] >= -1.1:
                pcm *= 10**(-.5/20)
        average = target+.8
        assert len(decoded)==N, "Vorbis sample count differs from the composed loop"
        assert 80 <= final['duration_s'] <= 110
        assert final['sample_peak_dbfs'] < -1 and final['true_peak_dbtp'] < -1
        assert abs(final['rms_dbfs']-average) <= 3
        assert seam['boundary_sample_difference'] < min(.001,seam['interior_step_p99'])
        assert abs(seam['window_100ms']['difference_db']) < 1
        for name in REFERENCES:
            assert fingerprint(MUSIC/f"{name}.ogg")==references[name]['sha256']
        # Publish only a verified candidate; original references are read-only.
        (MUSIC/"Level3.ogg").write_bytes(candidate.read_bytes())
        write_report(references, final, seam, target, fade_ms, quality)
    print(f"Verified and wrote {MUSIC/'Level3.ogg'} and {REPORT}",flush=True)


if __name__ == "__main__":
    main()
