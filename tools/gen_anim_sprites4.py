#!/usr/bin/env python3
"""Native UFO / tractor-beam pixel family for El Pacto de Hiareth, batch 4.

Run: tools/.venv/bin/python tools/gen_anim_sprites4.py
Writes ONLY three fx strips, anim_sprites4.json, and tools/anim_preview4.png.
Like gen_anim_sprites3: sample project inks, draw on native integer pixels,
lock anchors, pack deterministic strips, verify sources and review NEAREST.

Art brief: Level2's rose-grey saucer, stepped 1px mauve contour, compact violet
pilot and turquoise alien technology. 48x28 native craft, emitter at (24,24),
32x96 repeating column. Display scale is the background's 540/324, not a
character sprite scale. Glass uses discrete alpha; beam has FOUR alpha levels.
No generated/external imagery; project palette inherited from source artwork.

Art review 1 -> 2: keep the shallow rose-grey silhouette and violet pilot;
broaden the warning's underside reflection; narrow the beam's opaque-looking
core and soften its width with discrete alpha steps. Preview includes source
alien, native composite, game-scale context and dark tests; validation proves
lossless vertical repeats and the final-to-first animation seam.
"""
from __future__ import annotations

from collections import Counter
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets/sprites'
BG = ROOT / 'public/assets/bg/Level2'
NEAREST = Image.Resampling.NEAREST
OUTPUTS = ['fx/ufo.png', 'fx/ufo_charge.png', 'fx/tractor_beam.png']
WRITABLE = {ASSETS / p for p in OUTPUTS} | {
    ASSETS / 'anim_sprites4.json', ROOT / 'tools/anim_preview4.png',
    ROOT / 'tools/gen_anim_sprites4.py'}
HASHES, MANIFEST = {}, {}
BEAM_ALPHA = (40, 80, 128, 192)


def canvas(w, h):
    return Image.new('RGBA', (w, h))


def source(path):
    HASHES[path] = hashlib.sha256(path.read_bytes()).hexdigest()
    with Image.open(path) as im:
        return im.convert('RGBA')


LAYERS = [source(BG / f'{i}.png') for i in range(1, 6)]
ALIEN = source(ASSETS / 'alien/idle.png')
SCENE = canvas(576, 324)
for layer in LAYERS:
    SCENE.alpha_composite(layer)


def ink(target, images):
    colors = Counter(p for im in images for p in im.get_flattened_data() if p[3] == 255)
    return min(colors, key=lambda p: (sum((p[k] - target[k])**2 for k in range(3)), -colors[p]))


# Hull inks come from the actual foreground saucer, not the city masonry.
HULL_SOURCE = LAYERS[4].crop((342, 30, 569, 100))
OUTLINE = ink((103, 87, 87), [HULL_SOURCE])
SHADOW = ink((117, 103, 103), [HULL_SOURCE])
MAUVE = ink((138, 118, 118), [HULL_SOURCE])
METAL = ink((187, 172, 172), [HULL_SOURCE])
HIGHLIGHT = ink((199, 181, 181), [HULL_SOURCE])
RED = ink((255, 61, 61), [HULL_SOURCE])
ROSE = ink((255, 133, 133), [HULL_SOURCE])
WHITE = ink((255, 255, 255), [HULL_SOURCE])
PILOT_SOURCE = ALIEN.crop((78, 30, 177, 137))
TECH_SOURCE = ALIEN.crop((60, 168, 195, 201))
PURPLE = ink((162, 153, 232), [PILOT_SOURCE])
VIOLET = ink((100, 82, 175), [PILOT_SOURCE])
EYE = ink((17, 12, 48), [PILOT_SOURCE])
TEAL = ink((0, 100, 117), [TECH_SOURCE])
CYAN = ink((18, 206, 197), [TECH_SOURCE])
MINT = ink((139, 245, 218), [ALIEN.crop((55, 15, 205, 66))])


def alpha(color, value):
    return (*color[:3], value)


def saucer_base():
    f = canvas(48, 28)
    d = ImageDraw.Draw(f)
    # The dome's side is stepped, with a translucent window and 1px rim.
    dome = [(15,12),(15,8),(17,8),(17,5),(20,5),(20,3),
            (27,3),(27,4),(30,4),(30,7),(32,7),(32,12)]
    d.polygon(dome, fill=alpha(TEAL,160))
    d.line(dome[:9], fill=MAUVE)
    d.line([(30,7),(32,7),(32,12)], fill=SHADOW)
    d.line([(18,7),(18,6),(21,6),(21,4),(26,4)], fill=alpha(MINT,224))
    # Seven-pixel pilot: violet head, deep eyes and a torso in the glass.
    d.rectangle((21,7,26,10), fill=VIOLET)
    d.rectangle((22,6,25,7), fill=PURPLE)
    d.rectangle((22,7,26,9), fill=PURPLE)
    d.point((22,8), fill=EYE)
    d.point((25,8), fill=EYE)
    d.line((22,11,26,11), fill=VIOLET)
    d.line((20,5,20,6), fill=alpha(MINT,160))
    d.point((28,9), fill=alpha(MINT,96))
    # Wide, shallow perspective ellipse, matching the Level2 saucer silhouette.
    hull = [(3,14),(6,14),(6,12),(13,12),(13,11),(34,11),
            (34,12),(41,12),(41,13),(44,13),(44,15),(46,15),
            (46,17),(43,17),(43,19),(37,19),(37,21),(10,21),
            (10,20),(6,20),(6,18),(3,18),(3,17),(1,17),(1,15),(3,15)]
    d.polygon(hull, fill=OUTLINE)
    d.polygon([(4,14),(8,14),(8,13),(14,13),(14,12),(33,12),
               (33,13),(40,13),(40,14),(43,14),(43,15),(45,15),
               (45,16),(3,16),(3,15),(4,15)], fill=METAL)
    d.line((14,12,33,12), fill=HIGHLIGHT)
    d.line((7,14,13,14), fill=HIGHLIGHT)
    d.line((4,17,43,17), fill=MAUVE)
    d.rectangle((7,18,40,18), fill=SHADOW)
    d.rectangle((11,19,36,20), fill=SHADOW)
    d.line((13,20,34,20), fill=MAUVE)
    # Circular underside assembly: dark recessed socket and turquoise aperture.
    d.rectangle((18,21,29,22), fill=OUTLINE)
    d.rectangle((20,23,27,24), fill=OUTLINE)
    d.line((20,21,27,21), fill=TEAL)
    d.rectangle((21,22,26,23), fill=TEAL)
    d.line((22,23,25,23), fill=CYAN)
    return f


def ufo_frames(charging=False):
    result = []
    for phase in range(4):
        f = saucer_base()
        d = ImageDraw.Draw(f)
        # Positions and hull never move: perceived motion comes from a chase of lamps.
        lamps = [(9,17),(18,18),(29,18),(38,17)]
        for k,(x,y) in enumerate(lamps):
            active = (k - phase * (2 if charging else 1)) % 4
            color = (RED, ROSE, TEAL, CYAN)[active]
            if charging and active in (0,3):
                color = CYAN if phase < 2 else MINT
            d.line((x,y,x+2,y), fill=color)
            if active == 0:
                d.point((x+1,y), fill=ROSE if not charging else WHITE)
        if charging:
            # Fixed centre, widening aperture / discrete halo, no blurry glow.
            radius = phase * 2 + 3
            halo = canvas(48,28)
            hd = ImageDraw.Draw(halo)
            hd.rectangle((24-radius,24,23+radius,24), fill=alpha(CYAN,96))
            if phase > 0:
                hd.line((20-phase,25,27+phase,25), fill=alpha(MINT,160))
            if phase > 1:
                hd.line((20,26,27,26), fill=alpha(CYAN,96))
            # Glow occupies transparent pixels only: keep native source RGB inks.
            body, glow = np.array(f), np.array(halo)
            use = (body[:,:,3] == 0) & (glow[:,:,3] > 0)
            body[use] = glow[use]
            f = Image.fromarray(body)
            d = ImageDraw.Draw(f)
            d.line((18,20,29,20), fill=[TEAL,CYAN,MINT,WHITE][phase])
            d.rectangle((20,21,27,22), fill=[TEAL,CYAN,MINT,WHITE][phase])
            d.line((21,23,26,23), fill=[CYAN,MINT,WHITE,WHITE][phase])
            if phase >= 2:
                d.point((17,23), fill=CYAN)
                d.point((30,23), fill=CYAN)
        result.append(f)
    return result


def beam_frames():
    """A periodic column: four six-pixel steps form one 24px upward cycle.

    The silhouette and all events are y-periodic; vertical repeats are lossless.
    Features do not abruptly reset at the animation wrap (3 -> 0).
    """
    result = []
    for phase in range(4):
        f = canvas(32,96)
        for y in range(96):
            t = (y + phase*6) % 24
            for x in range(4,28):
                distance = min(x-4,27-x)
                # Three stepped edge/core zones; no smooth gradients or filtering.
                opacity = 40 if distance < 2 else 80 if distance < 8 else 128
                color = CYAN
                # Short segmented arcing bands flow upward around the column.
                bend = abs(x-15)//5
                if (t-bend) % 24 in (8,9) and 5 <= x <= 26:
                    opacity = 192 if 9 <= x <= 22 else 128
                    color = MINT
                # Open vertical filaments, broken into 3px runs to avoid solid rails.
                if x in (7,24) and t in (15,16,17):
                    opacity, color = 128, MINT
                f.putpixel((x,y), alpha(color,opacity))
        # Staggered pixel motes, repeated every 24px, travel exactly with the bands.
        d = ImageDraw.Draw(f)
        for base_y in range(-24,120,24):
            for x,offset in [(11,2),(20,13)]:
                y = base_y+offset-phase*6
                d.line((x,y,x,y+2), fill=alpha(MINT,192))
                d.point((x+1,y+2), fill=alpha(CYAN,128))
        result.append(f)
    return result


def save(path, frames, notes, baseline=None):
    w,h = frames[0].size
    strip = canvas(w*4,h)
    for i,f in enumerate(frames):
        strip.paste(f,(i*w,0))  # Preserve partial alpha; do not apply alpha twice.
    a = np.array(strip)
    a[a[:,:,3] == 0] = 0
    Image.fromarray(a).save(ASSETS/path,compress_level=9)
    MANIFEST[path] = {
        'frameWidth':w, 'frameHeight':h, 'frames':4,
        'source':{'kind':'deterministic-pixel-derivative',
                  'files':['../bg/Level2/'+str(i)+'.png' for i in range(1,6)] + ['alien/idle.png']},
        'license':'Inherited from project source artwork; no external artwork added.',
        'baseline':baseline, 'notes':notes, 'technical_checks_passed':False}


def preview(idle, charge, beam):
    font = ImageFont.load_default(size=13)
    title = ImageFont.load_default(size=17)
    out = Image.new('RGB',(1264,1566),'#171922')
    d = ImageDraw.Draw(out)
    d.text((16,10),'EL PACTO DE HIARETH / ACTO 2 / UFO + TRACTOR / REV 2',font=title,fill='#eee1dc')
    d.text((16,36),'Native pixels | rose-grey Level2 hull + violet/cyan alien inks | discrete alpha | no interpolation',font=font,fill='#b7b8c5')
    out.paste(SCENE.convert('RGB'),(16,62))
    d.text((16,392),'REFERENCE: all five Level2 layers, native 576x324',font=font,fill='#cdc5c7')
    # Hero contextual panel at the actual background display factor (540/324).
    hero = SCENE.crop((100,40,448,230))
    hero.alpha_composite(beam[2],(158,65))
    hero.alpha_composite(charge[3],(150,42))
    hero = hero.resize((580,317),NEAREST)
    out.paste(hero.convert('RGB'),(654,62))
    d.text((654,392),'GAME SCALE x1.667 / same scale as Level2',font=font,fill='#cdc5c7')

    def section(y, name, frames):
        d.text((16,y),name+' / x3 NEAREST / frames 0 1 2 3',font=title,fill='#eee1dc')
        d.text((16,y+24),'COMPOSED LEVEL2 CROP',font=font,fill='#b7b8c5')
        d.text((640,y+24),'DARK BACKGROUND',font=font,fill='#b7b8c5')
        h = 100 if frames[0].height == 96 else 36
        for row in range(2):
            for i,f in enumerate(frames):
                tile = SCENE.crop((190,110,238,110+h)) if row == 0 else Image.new('RGBA',(48,h),'#11151e')
                tile.alpha_composite(f,((48-f.width)//2,2 if h == 100 else 4))
                xx = 16+(row*4+i)*156
                out.paste(tile.resize((144,h*3),NEAREST).convert('RGB'),(xx,y+46))
                d.text((xx,y+49+h*3),f'{i:02}',font=font,fill='#b7b8c5')

    section(424,'UFO / 48x28 / red-cyan running lights',idle)
    section(608,'CHARGE / 48x28 / increasing emitter energy',charge)
    section(792,'TRACTOR / 32x96 / upward 6px per frame / alpha 40 80 128 192',beam)
    d.text((16,1164),'ASSEMBLED LOOP / x3 NEAREST / emitter + column / 4 synchronized phases',font=title,fill='#eee1dc')
    # Beam begins at the emitter y24, not at the craft frame's bottom y28.
    for i in range(4):
        tile = SCENE.crop((120,100,192,220))
        tile.alpha_composite(beam[i],(20,24))
        tile.alpha_composite(charge[3],(12,0))
        out.paste(tile.resize((216,360),NEAREST).convert('RGB'),(16+i*260,1194))
    # Source pilot and real palette alongside the assembled craft, at native 1x.
    d.text((1060,1194),'ALIEN REFERENCE',font=font,fill='#b7b8c5')
    pilot = ALIEN.crop((60,22,197,207))
    pilot_bg = Image.new('RGBA',pilot.size,'#11151e')
    pilot_bg.alpha_composite(pilot)
    out.paste(pilot_bg.convert('RGB'),(1076,1218))
    d.text((1060,1412),'PROJECT INKS',font=font,fill='#b7b8c5')
    for i,color in enumerate([OUTLINE,SHADOW,MAUVE,METAL,HIGHLIGHT,RED,ROSE,PURPLE,VIOLET,TEAL,CYAN,MINT]):
        xx,yy = 1060+(i%6)*28,1437+(i//6)*24
        d.rectangle((xx,yy,xx+21,yy+17),fill=color[:3])
    out.save(ROOT/'tools/anim_preview4.png',compress_level=9)


def validate(idle, charge, beam):
    palette = {p[:3] for im in [HULL_SOURCE,PILOT_SOURCE,TECH_SOURCE,ALIEN]
               for p in im.get_flattened_data() if p[3] == 255}
    for path, entry in MANIFEST.items():
        with Image.open(ASSETS/path) as im:
            assert im.mode == 'RGBA'
            w,h = entry['frameWidth'],entry['frameHeight']
            assert im.size == (w*4,h)
            a = np.array(im)
            assert not np.any(a[a[:,:,3] == 0,:3])
            assert {tuple(p) for p in a[a[:,:,3] > 0,:3]} <= palette
            allowed = {0,*BEAM_ALPHA} if 'beam' in path else {0,96,160,224,255}
            assert set(np.unique(a[:,:,3])) <= allowed, (path,np.unique(a[:,:,3]))
            if 'beam' in path:
                assert set(np.unique(a[:,:,3])) == {0,*BEAM_ALPHA}
            assert len({im.crop((i*w,0,(i+1)*w,h)).tobytes() for i in range(4)}) == 4
            for i in range(4):
                box = im.crop((i*w,0,(i+1)*w,h)).getbbox()
                assert box and box[0] > 0 and box[2] < w
                if 'beam' not in path:
                    assert box[1] > 0 and box[3] < h
        print(f'PASS {path}: {w*4}x{h}, four native frames, sampled inks, explicit alpha')
    # All craft geometry stays stable; changes are confined to lamps / emitter.
    for f in idle[1:]+charge:
        assert f.crop((0,0,48,17)).tobytes() == idle[0].crop((0,0,48,17)).tobytes()
    energies = [int(np.array(f)[21:24,20:28,:3].sum()) for f in charge]
    assert energies == sorted(energies) and len(set(energies)) == 4
    # Vertical tiling and the final -> first temporal join are exactly periodic.
    for i,f in enumerate(beam):
        a = np.array(f)
        assert np.array_equal(a[:24],a[24:48])
        assert np.array_equal(a[24:48],a[48:72])
        assert np.array_equal(np.roll(a,-6,axis=0),np.array(beam[(i+1)%4]))
    for path,digest in HASHES.items():
        assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
    for entry in MANIFEST.values():
        entry['technical_checks_passed'] = True
    (ASSETS/'anim_sprites4.json').write_text(json.dumps(MANIFEST,indent=2,ensure_ascii=False)+'\n')
    print('PASS fixed hull, monotonic charge, seamless vertical/temporal beam cycle, source integrity')


def main():
    protected = {p:hashlib.sha256(p.read_bytes()).hexdigest()
                 for folder in [ROOT/'public/assets',ROOT/'tools']
                 for p in folder.rglob('*')
                 if p.is_file() and p not in WRITABLE and '.venv' not in p.parts}
    idle,charge,beam = ufo_frames(),ufo_frames(True),beam_frames()
    save(OUTPUTS[0],idle,'48x28 native Level2 scale (display x1.667); fixed rose-grey hull, translucent dome, violet pilot. Four sequential red/cyan light phases. Emitter centre (24,24). Suggested 7fps loop.',24)
    save(OUTPUTS[1],charge,'Same locked hull/dome as ufo.png. Four increasing cyan/mint/white charge states; stepped halo. Play once at 10-12fps, then hold frame 3. Emitter centre (24,24).',24)
    save(OUTPUTS[2],beam,'32x96 native column; centre x16. Place top at craft emitter y24. Four alpha levels (40,80,128,192), cyan/mint source RGB. Bands and motes rise 6px/frame, exact 24px period; repeat vertically or stretch. Suggested 10fps loop. No end cap, seamless 3->0.',None)
    validate(idle,charge,beam)
    preview(idle,charge,beam)
    assert all(hashlib.sha256(p.read_bytes()).hexdigest() == digest for p,digest in protected.items())
    print('PASS existing project assets/tools unchanged; preview: tools/anim_preview4.png')


if __name__ == '__main__':
    main()
