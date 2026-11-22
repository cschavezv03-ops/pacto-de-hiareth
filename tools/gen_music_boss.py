#!/usr/bin/env python3
"""Morrigannus: La última luna. Deterministic original symphonic metal loop.

Run: tools/.venv/bin/python tools/gen_music_boss.py
Only the new OGG, report and explicitly requested spectrogram are published.
All intermediate files live in /tmp. No samples or external compositions.
"""
from __future__ import annotations

import sys
sys.dont_write_bytecode = True
import argparse
import json
from pathlib import Path
import subprocess
import tempfile

import numpy as np
import gen_music_level3 as u

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/assets/music/BossMetal.ogg'
REPORT = ROOT / 'tools/boss_music_report.txt'
IMAGE = ROOT / 'tools/boss_music_spectrogram.png'
REFERENCE = ROOT / 'public/assets/music/BOSSFIGTH.ogg'
SR, BPM, BARS = u.SR, 180, 96
BEAT = 60 / BPM
LENGTH = BARS * 4 * BEAT
N = round(LENGTH * SR)
# Reuse the existing circular engine, choir, room, mastering and codec helpers
# without changing the source module on disk or invoking its main().
u.BPM, u.BEAT, u.BARS, u.LENGTH, u.N = BPM, BEAT, BARS, LENGTH, N
SECTIONS = [('Invocación', 0, 4), ('A / Raíces', 4, 20),
            ('A2 / Raíces se cierran', 20, 36), ('B / Astas', 36, 52),
            ('Puente / Quebrar las raíces', 52, 64), ('Ascenso', 64, 72),
            ('Clímax / Luna roja', 72, 92), ('Retorno a la cacería', 92, 96)]


def filter_voice(x, lo=0, hi=20000, rate=SR):
    f = np.fft.rfftfreq(len(x), 1/rate)
    eq = 1 / np.sqrt(1 + (f/hi)**8)
    if lo:
        eq *= f**2 / (f**2 + lo**2)
    return np.fft.irfft(np.fft.rfft(x) * eq, len(x))


class Metal(u.Orchestra):
    def __init__(self):
        super().__init__()
        self.rng = np.random.default_rng(20261121)
        self.cache = {}
        self.spectra = {}
        self.bus = 'other'

    def add(self, signal, seconds, gain, pan=0, wet=.08):
        # Aggregate instrument energy before mixing for independent band checks.
        f = np.fft.rfftfreq(len(signal), 1/SR)
        power = np.abs(np.fft.rfft(signal * gain))**2 / len(signal)
        bands = [(0,35),(35,120),(120,350),(350,2000),(2000,6000),(6000,16000),(16000,22051)]
        energy = np.array([power[(f>=a)&(f<b)].sum() for a,b in bands])
        self.spectra[self.bus] = self.spectra.get(self.bus, np.zeros(7)) + energy
        super().add(signal, seconds, gain, pan, wet)

    def guitar(self, midi, beat, beats=.43, palm=True, velocity=1):
        self.bus = 'guitars'
        for side in range(2):
            variant = int(self.rng.integers(3))
            key = ('g', midi, round(beats,3), palm, side, variant)
            if key not in self.cache:
                duration = beats*BEAT + (.035 if palm else .12)
                rate = SR*2  # Distort oversampled, cabinet-filter, then decimate.
                t = np.arange(round(duration*rate)) / rate
                voice = np.zeros_like(t)
                for interval, amp in [(0,1),(7,.63),(12,.37)]:
                    freq = u.hz(midi+interval)*(1+[-.0017,.0014][side]+variant*.00012)
                    phase = 2*np.pi*freq*t + .018*np.sin(2*np.pi*5.2*t)
                    string = np.zeros_like(t)
                    for h in range(1, min(25,int(13000/freq))):
                        string += (np.sin(h*.21*np.pi)/h**.85
                                   * np.sin(h*phase+.09*variant)
                                   * np.exp(-t*h*(.8 if palm else .22)))
                    voice += amp*string
                voice += .035*self.rng.normal(size=len(t))*np.exp(-t/.008)
                env = u.edge_envelope(t,duration,.0015,.025)
                env *= np.exp(-t/(.09 if palm else .85))
                f = np.fft.rfftfreq(len(t),1/rate)
                # Preamp presence prevents bass monopolizing the distortion.
                preamp = f**2/(f**2+120**2) * (.5+np.minimum(f/420,4))
                voice = np.fft.irfft(np.fft.rfft(voice)*preamp,len(t))
                driven = np.tanh(5.5*voice*env) + .13*np.tanh(2.5*voice*env)**3
                # Closed cabinet: low cut, broad mid body, cone rolloff and notch.
                f = np.fft.rfftfreq(len(t),1/rate)
                cabinet = ((f**2/(f**2+120**2)) / np.sqrt(1+(f/4600)**8)
                           * (1+.22*np.exp(-((f-850)/650)**2)
                              +1.2*np.exp(-((f-1800)/900)**2))
                           * (1-.38*np.exp(-((f-3100)/650)**2)))
                result = np.fft.irfft(np.fft.rfft(driven)*cabinet,len(t))[::2]
                result *= u.edge_envelope(np.arange(len(result))/SR,len(result)/SR,.001,.012)
                self.cache[key] = result.astype(np.float32)
            timing = (.003 if side else -.002) + variant*.0007
            self.add(self.cache[key], beat*BEAT+timing, .195*velocity,
                     -.91 if side==0 else .91, .025 if palm else .09)

    def bass(self, midi, beat, beats=.44, velocity=1):
        self.bus = 'bass'
        length = beats*BEAT+.035
        t = np.arange(round(length*SR))/SR
        phase = 2*np.pi*u.hz(midi)*t
        x = (np.sin(phase)+.29*np.sin(2*phase)+.12*np.sin(3*phase))
        x = .8*np.sin(phase)+.32*np.tanh(2.4*x)
        x *= u.edge_envelope(t,length,.006,.035)*np.exp(-t/1.1)
        self.add(filter_voice(x,38,1900),beat*BEAT,.235*velocity,0,.015)

    def hit(self, kind, beat, velocity=1, pan=0):
        self.bus = 'drums'
        variant = int(self.rng.integers(5))
        key = (kind,variant)
        if key not in self.cache:
            length = {'kick':.25,'snare':.30,'hat':.10,'ride':.38,'crash':1.7,'tom':.34}[kind]
            t = np.arange(round(length*SR))/SR
            noise = self.rng.normal(size=len(t))
            if kind=='kick':
                phase=2*np.pi*(57*t+100*.017*(1-np.exp(-t/.017)))
                x=np.sin(phase)*np.exp(-t/.068)
                x+=.28*filter_voice(noise,2200,7500)*np.exp(-t/.007)
                gain=.56
            elif kind=='snare':
                x=.68*filter_voice(noise,850,8800)*np.exp(-t/.072)
                x+=.60*np.sin(2*np.pi*(185+variant)*t)*np.exp(-t/.038)
                x+=.22*np.sin(2*np.pi*335*t)*np.exp(-t/.026)
                gain=.42
            elif kind=='tom':
                x=np.sin(2*np.pi*(106*t+20*.04*(1-np.exp(-t/.04))))*np.exp(-t/.095)
                x+=.15*filter_voice(noise,600,5000)*np.exp(-t/.025)
                gain=.38
            else:
                decay={'hat':.024,'ride':.13,'crash':.44}[kind]
                x=.55*noise
                for f in (3151,4317,5971,7339,8923):
                    x+=.11*np.sin(2*np.pi*f*(1+.002*variant)*t)
                x=filter_voice(x,4200 if kind=='hat' else 2400,11500)
                x*=np.exp(-t/decay)
                gain={'hat':.105,'ride':.105,'crash':.19}[kind]
            x*=u.edge_envelope(t,length,.0008,.015)
            self.cache[key]=(x.astype(np.float32),gain)
        x,gain=self.cache[key]
        self.add(x,beat*BEAT,gain*velocity,pan,.09 if kind in ('snare','tom') else .025)

    def lead(self, midi, beat, beats, velocity=1, harmony=False):
        self.bus='lead'
        length=beats*BEAT+.12
        t=np.arange(round(length*SR))/SR
        f=u.hz(midi)
        phase=2*np.pi*f*t + .075*np.sin(2*np.pi*5.8*t)*np.minimum(t/.14,1)
        # Singing, pick-excited lead with a fifth-free melodic line.
        x=sum(np.sin(h*phase+.03*h)*np.exp(-h*t*.5)/h**1.4 for h in range(1,15))
        x=filter_voice(np.tanh(2*x),180,4200)
        x*=u.edge_envelope(t,length,.009,.12)*(.85+.15*np.exp(-t/.06))
        pan=-.22 if harmony else .15
        self.add(x,beat*BEAT,.105*velocity if harmony else .19*velocity,pan,.26)
        self.add(x,(beat+.75)*BEAT,.028*velocity,-pan,.42)

    def organ(self, notes, beat, beats, velocity=.6):
        self.bus='organ/choir'
        for i,midi in enumerate(notes):
            length=beats*BEAT+.22
            t=np.arange(round(length*SR))/SR
            phase=2*np.pi*u.hz(midi)*t
            x=sum(a*np.sin(h*phase) for h,a in [(1,.6),(2,.3),(3,.18),(4,.09),(6,.05)])
            x*=u.edge_envelope(t,length,.06,.24)
            self.add(x,beat*BEAT,.065*velocity,(i-1)*.42,.48)


# C minor, occasional harmonic-minor B natural over G7 and bII (crystal/death).
ROOTS=[36,36,44,43,36,46,41,43]
CHORDS={36:[60,63,67],44:[60,63,68],43:[59,62,67],46:[62,65,70],
        41:[60,65,68],37:[61,65,68],39:[58,63,67]}
# Antler motif: C-G-Ab-G-Eb-D-C, with the first three pitches as a recurring hook.
THEME=[[(0,72,1),(1,79,.5),(1.5,80,.5),(2,79,1),(3,75,.5),(3.5,74,.5)],
       [(0,72,1.5),(1.5,75,.5),(2,74,1),(3,70,1)],
       [(0,72,.75),(.75,75,.75),(1.5,80,.5),(2,79,1.5),(3.5,75,.5)],
       [(0,74,1),(1,71,1),(2,67,1),(3,71,.5),(3.5,74,.5)],
       [(0,79,1),(1,80,.5),(1.5,79,.5),(2,75,1),(3,72,1)],
       [(0,77,1.5),(1.5,75,.5),(2,74,1),(3,70,1)],
       [(0,72,.5),(.5,77,.5),(1,80,1),(2,79,.5),(2.5,77,.5),(3,75,1)],
       [(0,74,1),(1,71,.5),(1.5,74,.5),(2,79,1),(3,74,.5),(3.5,71,.5)]]


def rhythm(o,bar,root,style):
    beat=bar*4
    if style=='intro':
        pattern=[(0,root,1.5,False),(2,root,.42,True),(2.75,root,.18,True),(3.5,root+7,.42,True)]
    elif style=='break':
        pattern=[(0,root,.25,True),(.75,root,.23,True),(1.5,root+1,.35,True),
                 (2.5,root,.24,True),(3.25,root+7,.43,False)]
    elif style in ('melody','climax'):
        pattern=[(0,root,.9,False),(1,root,.2,True),(1.25,root,.2,True),
                 (1.5,root,.42,True),(2,root,.7,False),(2.75,root,.2,True),
                 (3,root+7,.42,True),(3.5,root+10,.42,True)]
    else:
        # Syncopated low-C gallop; the last two bars answer in contrary motion.
        pattern=[(0,root,.42,True),(.5,root,.2,True),(.75,root,.2,True),
                 (1.25,root,.42,True),(1.75,root+7,.2,True),(2,root,.42,True),
                 (2.5,root+([3,2,7,1][bar%4]),.42,False),(3.25,root,.2,True),(3.5,root+7,.42,True)]
    for j,(pos,note,dur,palm) in enumerate(pattern):
        v=.88 if j%3 else 1
        o.guitar(note,beat+pos,dur,palm,v)
        o.bass(note-12,beat+pos,dur,.88*v)
    if style=='intro':
        kicks=[0,2,3.5] if bar<2 else [0,.75,1.5,2,2.75,3.5]
    elif style=='break':
        kicks=[0,.75,1.5,2.5,3.25,3.5]
    elif style=='climax':
        kicks=[0,.25,.5,.75,1.5,1.75,2,2.25,2.5,2.75,3.5,3.75]
    else:
        kicks=[0,.5,.75,1.5,2,2.5,2.75,3.5]
    for i,p in enumerate(kicks):
        o.hit('kick',beat+p,.94 if i%2==0 else .78)
    for p in ([2] if style=='break' else [1,3]):
        o.hit('snare',beat+p,1 if p==3 else .94,.04)
    step=1 if style=='break' else .5
    for i,p in enumerate(np.arange(0,4,step)):
        cym='ride' if style in ('melody','climax') else 'hat'
        o.hit(cym,beat+p,.82 if i%2 else 1,.40 if cym=='ride' else -.35)
    if bar%4==0 or style=='intro' and bar==0:
        o.hit('crash',beat,.9,-.55 if bar%8==0 else .55)
    if bar%8==7:
        for i,p in enumerate([3,3.25,3.5,3.75]):
            o.hit('tom' if i>1 else 'snare',beat+p,.55+i*.10,-.4+i*.25)


def compose():
    o=Metal()
    for bar in range(BARS):
        if bar<4:
            root=36 if bar<3 else 43
            style='intro'
        elif bar<36:
            root=ROOTS[(bar-4)%8]
            style='riff'
        elif bar<52:
            root=ROOTS[(bar-36)%8]
            style='melody'
        elif bar<64:
            root=[36,36,37,43][(bar-52)%4]
            style='break'
        elif bar<72:
            root=[44,46,41,43][(bar-64)%4]
            style='riff' if bar<68 else 'climax'
        elif bar<92:
            root=ROOTS[(bar-72)%8]
            style='climax'
        else:
            root=[44,41,43,43][bar-92]
            style='intro'
        rhythm(o,bar,root,style)
        tones=CHORDS[root]
        # Choir enters in long phrases; reduced during the rhythmic breakdown.
        if bar%2==0:
            o.organ(tones,bar*4,7.7,.42 if style=='break' else .75)
            o.bus='organ/choir'
            for i,note in enumerate(tones):
                o.choir(note-12,bar*4,7.5,.20 if style=='break' else .47,[-.5,0,.5][i])
        if style in ('melody','climax') or 20<=bar<36 and bar%4 in (0,1):
            index=(bar-(36 if bar<52 else 72))%8
            for p,note,dur in THEME[index]:
                o.lead(note,bar*4+p,dur,.88 if style=='climax' else 1)
                if style=='climax' and bar>=80:
                    # Diatonic lower thirds, with leading tone only on G7.
                    scale=[60,62,63,65,67,68,70,72,74,75,77,79,80,82,84]
                    lower=scale[max(0,scale.index(note)-2)] if note in scale else note-3
                    o.lead(lower,bar*4+p+.012,dur,.70,True)
        if 64<=bar<72:
            for i,p in enumerate(np.arange(0,4,.5 if bar<68 else .25)):
                o.lead([72,74,75,79,80,79,75,74][i%8]+(12 if bar>=70 else 0),
                       bar*4+p,.20,.53)
        if bar in (0,36,52,72,88):
            o.bus='crystal bell'
            o.bell(72 if bar!=52 else 73,bar*4,.55,.55)
        if bar%8==0:
            print(f'  compás {bar+1}/{BARS}: {style}',flush=True)
    band_stats={name:(100*values/max(values.sum(),u.EPS)).tolist()
                for name,values in o.spectra.items()}
    print('Convolución circular de reverb y EQ...',flush=True)
    return o.mix(),band_stats


def encode(pcm,path,tmp):
    # Reuse libvorbis encoding/loop tags; replace the old composition's title.
    raw=tmp/'encoded.ogg'
    u.encode(pcm,raw,10)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),
                    '-c:a','copy','-metadata:s:a:0','title=Morrigannus - La última luna',
                    '-metadata','LOOPEND='+str(N),str(path)],check=True)


def normalize(pcm,tmp,target):
    # Two-pass loudnorm meters LUFS, rather than assuming equal RMS = equal level.
    source=tmp/'mix.f32'
    pcm.astype('<f4').tofile(source)
    base=['ffmpeg','-hide_banner','-nostats','-f','f32le','-ar',str(SR),'-ac','2','-i',str(source)]
    result=subprocess.run(base+['-af',f'loudnorm=I={target}:TP=-1.8:LRA=9:print_format=json',
                                '-f','null','-'],capture_output=True,check=True)
    log=result.stderr.decode()
    stats=json.loads(log[log.rfind('{'):log.rfind('}')+1])
    filt=(f'loudnorm=I={target}:TP=-1.8:LRA=9:measured_I={stats["input_i"]}:'
          f'measured_TP={stats["input_tp"]}:measured_LRA={stats["input_lra"]}:'
          f'measured_thresh={stats["input_thresh"]}:offset={stats["target_offset"]}:linear=true')
    result=subprocess.run(base+['-af',filt,'-ar',str(SR),'-f','f32le','pipe:1'],
                          capture_output=True,check=True)
    return np.frombuffer(result.stdout,dtype='<f4').reshape(-1,2).copy(),stats


def spectrogram(path):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(path),
                    '-lavfi','showspectrumpic=s=1600x900:legend=1:mode=combined:'
                    'color=intensity:scale=log:fscale=log:win_func=hann:drange=85',
                    '-frames:v','1',str(IMAGE)],check=True)


def write_report(reference,final,seam,bands,fade_ms,normalization):
    lines=['EL PACTO DE HIARETH — MORRIGANNUS: LA ÚLTIMA LUNA',
           'Composición original por síntesis; sin samples ni melodías de terceros.',
           '', 'ANÁLISIS PREVIO DEL ORIGINAL',
           f'BOSSFIGTH: {reference["duration_s"]:.3f} s; {reference["integrated_lufs"]:.1f} LUFS;',
           f'RMS {reference["rms_dbfs"]:.3f} dBFS; pico {reference["sample_peak_dbfs"]:.3f} dBFS;',
           f'true peak {reference["true_peak_dbtp"]:.1f} dBTP.',
           'Croma/perfiles: '+json.dumps(reference['key_candidates'],ensure_ascii=False),
           'Flujo espectral/autocorrelación: '+json.dumps(reference['tempo_candidates']),
           'Estimaciones, no transcripción: do menor r=0.901; 89.1 BPM puede representar',
           'medio pulso (~178.2 BPM); otros candidatos 136.0 y 52.7 BPM. Se adopta',
           'do menor y 180 BPM, coherencia tonal directa y pulso próximo al doble.',
           'Se conserva el original, incluido su SHA-256: '+reference['sha256'],
           '', 'COMPOSICIÓN Y ARREGLO',
           '180 BPM, 4/4, 96 compases, 128 s; do menor, afinación grave C2 / bajo C1.',
           'Do–Lab–Sol7 / Do–Sib–Fa menor–Sol7; Reb en el breakdown, Si natural',
           'sobre Sol7. Motivo recurrente Do–Sol–Lab–Sol–Mib–Re–Do; respuesta ascendente.',
           'Intensidad obstinada y teatral de reintento; sin citar temas de Cuphead.',
           'Las fases son secciones del único OGG; no se cambia código Phaser.']
    for name,start,end in SECTIONS:
        lines.append(f'  {start*4*BEAT:7.3f}–{end*4*BEAT:7.3f} s | cc. {start+1}–{end}: {name}')
    lines += ['Raíces: pedal de Do y galope sincopado con respuestas cromáticas.',
              'Astas: tema cantabile en registro alto, órgano abierto y ride.',
              'Puente: batería a medio tiempo, chugs separados y fricción de Reb.',
              'Ascenso: secuencias y semicorcheas; Luna roja: doble bombo, tema y terceras.',
              'Últimos cuatro compases: dominante Sol7 y galope de retorno a Do menor.',
              '', 'SÍNTESIS Y MEZCLA',
              'Doble guitarra independiente L/R ±0.91: cuerdas armónicas Do/quinta/octava,',
              'desafinación, variación de púa y microtiempo; palm mute por decaimiento modal;',
              'tanh + waveshaping cúbico a 88.2 kHz, filtro cabinet antes de reducir a 44.1 kHz.',
              'Preamp con corte a 120 Hz y énfasis de presencia previo a distorsión.',
              'Cabinet: corte grave 120 Hz, cuerpo 850 Hz, presencia 1.8 kHz,',
              'rebaje 3.1 kHz y caída 4.6 kHz.',
              'Bajo central con seno y saturación paralela; corte 38 Hz y caída 1.9 kHz.',
              'Bombo 57 Hz con ataque 2.2–7.5 kHz; caja 185/335 Hz y ruido filtrado;',
              'tom con caída de tono, hats/ride/crash con ruido y modos inarmónicos.',
              'Lead con vibrato, delay de corchea con puntillo y armonía diatónica en clímax.',
              'Coros formánticos, órgano por registros y campanas de cristal.',
              'Se reutilizan hz, edge_envelope, Orchestra.add/choir/bell/mix (reverb circular),',
              'master, musical_estimates, encode, decode, continuity y fingerprint de',
              'tools/gen_music_level3.py, importado sin modificar ni crear __pycache__.',
              'Reverb circular amortiguada, envíos de guitarra/bajo muy bajos y coro amplio.',
              'EQ circular de master: control subsónico 32 Hz y agudos 7.6 kHz.',
              'Master suave reutilizado + loudnorm de dos pasos; objetivo −11.4 LUFS,',
              'cercano al original, techo −1.8 dBTP previo a Vorbis. Sin normalizar a 0 dBFS.',
              '', 'VERIFICACIÓN DEL OGG FINAL DECODIFICADO',
              json.dumps(final,ensure_ascii=False,indent=2),
              f'Diferencia respecto al original: {final["integrated_lufs"]-reference["integrated_lufs"]:+.2f} LU.',
              'Continuidad: '+json.dumps(seam,ensure_ascii=False,indent=2),
              'Colas instrumentales y convolución envueltas; no hay un final musical en silencio.',
              f'Microfundido técnico de {fade_ms} ms en extremos para controlar error Vorbis.',
              'LOOPSTART=0; LOOPLENGTH=5644800; LOOPEND=5644800. Duración exacta al decodificar.',
              'Sol7→Do menor cierra la armonía; la reverb del ciclo anterior existe desde muestra 0.',
              'Criterios: 120–160 s, N exacto, estéreo 44100 Hz, sample/true peak < −1 dB,',
              '|LUFS-original| <= 1.5 LU, cero muestras recortadas, |DC| < 0.0001 FS,',
              'salto unión < 0.001 FS y p99 interior; energía 100 ms adyacentes dentro de 3 dB.',
              'Todos los criterios automáticos: PASS.',
              '', 'ESPECTROGRAMA Y DISTRIBUCIÓN',
              'tools/boss_music_spectrogram.png: FFmpeg showspectrumpic del OGG final,',
              'frecuencia logarítmica y escala de intensidad logarítmica, rango 85 dB.',
              'Bandas (% energía de voces antes de sumar/reverb/master; no stems exportados):',
              '             0–35 |35–120 |120–350 |350–2000 |2–6k |6–16k |16–22.05k Hz']
    for name,values in bands.items():
        lines.append(f'{name:14s} '+ ' | '.join(f'{v:.3f}' for v in values))
    lines += ['Revisión visual: estructura rítmica de graves, líneas armónicas del lead/cuerdas',
              'en medios, transitorios de caja/platos y caída progresiva por encima de 8 kHz.',
              'No se afirma escucha humana: verificación numérica y revisión visual del espectrograma.',
              '', 'REPRODUCIBILIDAD',
              'tools/.venv/bin/python tools/gen_music_boss.py',
              'Dependencias: NumPy del venv, FFmpeg/libvorbis. Semilla 20261121.',
              'Sólo se publican el script, BossMetal.ogg, este informe y el PNG solicitado.',
              'Intermedios temporales en /tmp; BOSSFIGTH y El pacto de hiareth utils intactos.',
              '', 'MEDICIÓN LOUDNORM PREVIA',json.dumps(normalization,indent=2)]
    REPORT.write_text('\n'.join(lines)+'\n',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--analyze-only',action='store_true')
    args=parser.parse_args()
    ref_pcm,reference=u.decode(REFERENCE)
    reference.update(u.musical_estimates(ref_pcm))
    reference['sha256']=u.fingerprint(REFERENCE)
    del ref_pcm
    print('Referencia:',json.dumps(reference,ensure_ascii=False),flush=True)
    if args.analyze_only:
        return
    mix,bands=compose()
    print('Master y normalización LUFS...',flush=True)
    pcm=u.master(mix,reference['rms_dbfs']-.5)
    del mix
    with tempfile.TemporaryDirectory(prefix='hiareth-boss-',dir='/tmp') as directory:
        tmp=Path(directory)
        pcm,normalization=normalize(pcm,tmp,reference['integrated_lufs']-.5)
        assert len(pcm)==N
        candidate=tmp/'BossMetal.ogg'
        for fade_ms in (8,12,20,32):
            trial=pcm.copy()
            fade_n=round(fade_ms*SR/1000)
            fade=np.sin(np.linspace(0,np.pi/2,fade_n))**2
            trial[:fade_n]*=fade[:,None]
            trial[-fade_n:]*=fade[::-1,None]
            encode(trial,candidate,tmp)
            decoded,final=u.decode(candidate)
            seam=u.continuity(decoded)
            final['dc_per_channel']=np.mean(decoded.astype(float),axis=0).tolist()
            final['clipped_samples']=int(np.count_nonzero(np.abs(decoded)>=1))
            final['sample_rate_hz']=SR
            final['channels']=2
            print('Final:',json.dumps(final),'Loop:',json.dumps(seam),flush=True)
            if seam['boundary_sample_difference']<.001 and final['true_peak_dbtp']< -1.1:
                break
            if final['true_peak_dbtp']>=-1.1:
                pcm*=10**(-.4/20)
        assert len(decoded)==N and 120<=final['duration_s']<=160
        assert final['sample_peak_dbfs']< -1 and final['true_peak_dbtp']< -1
        assert abs(final['integrated_lufs']-reference['integrated_lufs'])<=1.5
        assert final['clipped_samples']==0
        assert max(abs(v) for v in final['dc_per_channel'])<.0001
        assert seam['boundary_sample_difference']<min(.001,seam['interior_step_p99'])
        assert abs(seam['window_100ms']['difference_db'])<3
        assert u.fingerprint(REFERENCE)==reference['sha256']
        spectrogram(candidate)
        OUTPUT.write_bytes(candidate.read_bytes())
        write_report(reference,final,seam,bands,fade_ms,normalization)
    print('PASS:',OUTPUT,REPORT,IMAGE,flush=True)


if __name__=='__main__':
    main()
