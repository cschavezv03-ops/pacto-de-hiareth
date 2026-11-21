#!/usr/bin/env python3
"""Deterministic pixel-derived animation assets for El Pacto de Hiareth.

Run from any directory with tools/.venv/bin/python tools/gen_anim_sprites.py.
Only the seven new strips, anim_sprites.json and tools/anim_preview.png are written.
No resampling other than NEAREST; no blur, generated gradients or external images.
Source artwork and its existing licence/provenance remain with the project.
"""
from __future__ import annotations

from collections import Counter
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets/sprites'
NEAREST = Image.Resampling.NEAREST
SOURCE_HASHES: dict[str, str] = {}
MANIFEST: dict[str, dict] = {}
PREVIEWS = []


def frame(path, index=0, size=250, row=0):
    p = ASSETS / path
    SOURCE_HASHES[path] = hashlib.sha256(p.read_bytes()).hexdigest()
    with Image.open(p) as source:
        f = source.convert('RGBA').crop((index * size, row * size,
                                          (index + 1) * size, (row + 1) * size))
        if path.startswith(('skeleton/', 'alien/')):
            # The sliced reference has isolated resampling-alpha flecks. Drop those
            # flecks, retaining all original fully opaque pixel colours verbatim.
            a = np.array(f)
            a[a[:, :, 3] != 255] = 0
            f = Image.fromarray(a)
        return f


def canvas(w, h=None):
    return Image.new('RGBA', (w, w if h is None else h))


def components(im):
    """Four-connected source-pixel islands, largest first, at original positions."""
    a = np.asarray(im)
    mask = a[:, :, 3] > 0
    seen = np.zeros(mask.shape, dtype=bool)
    islands = []
    for y, x in zip(*np.where(mask)):
        if seen[y, x]:
            continue
        todo, points = [(int(x), int(y))], []
        seen[y, x] = True
        while todo:
            px, py = todo.pop()
            points.append((px, py))
            for xx, yy in ((px-1, py), (px+1, py), (px, py-1), (px, py+1)):
                if 0 <= xx < im.width and 0 <= yy < im.height and mask[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    todo.append((xx, yy))
        layer = np.zeros_like(a)
        xs, ys = zip(*points)
        layer[ys, xs] = a[ys, xs]
        islands.append((len(points), Image.fromarray(layer)))
    return [im for _, im in sorted(islands, key=lambda p: -p[0])]


def cut(im):
    return im.crop(im.getbbox())


def composite_at(dest, im, xy):
    dest.alpha_composite(im, tuple(map(int, xy)))


def nearest_colour(im, target, predicate=lambda p: True):
    colours = Counter(map(tuple, np.asarray(im).reshape(-1, 4)))
    choices = [p for p in colours if p[3] == 255 and predicate(p)]
    return min(choices, key=lambda p: (sum((int(p[k])-target[k])**2 for k in range(3)), -colours[p]))


A1 = frame('aidan/Attack1.png', 3)
A2 = frame('aidan/Attack2.png', 0)
IDLE = frame('aidan/Idle.png')
FLY = frame('aidan/Vuelo_Ataque2_MediaLunaDeFuego.png', 4)
# All fire inks are sampled, not approximated: the native two violet inks and red eye.
INK = nearest_colour(A1, (41, 7, 47))
VIOLET = nearest_colour(A1, (77, 12, 79))
RED = nearest_colour(A1, (242, 37, 37))
DARK_RED = nearest_colour(A1, (59, 14, 32))
PALETTE = [INK, VIOLET, RED, DARK_RED]


def stamp_spark(im, x, y, colour, size=1, direction=(1, -1)):
    """Stepped, asymmetrical spark cluster. Integer pixels only."""
    d = ImageDraw.Draw(im)
    d.rectangle((x, y, x+size-1, y+size-1), fill=colour)
    if size > 1:
        dx, dy = direction
        d.rectangle((x+dx*size, y+dy*size, x+dx*size+size-1,
                     y+dy*size+size-1), fill=colour)


# Source Attack1's detached ghost: retain its silhouette, ink clusters and red eyes.
GHOST_SOURCE = cut(components(A1)[1])
GHOST_RIGHT = cut(GHOST_SOURCE.rotate(-58, resample=NEAREST, expand=True))
GHOST_SEED = GHOST_RIGHT.resize((40, 25), NEAREST)


def ghost_projectiles():
    result = []
    for phase in range(6):
        f = canvas(48, 32)
        a = np.asarray(GHOST_SEED)
        # Ripple only the tail; the forward red eye and nose remain registered.
        for y in range(a.shape[0]):
            for x in range(a.shape[1]):
                p = a[y, x]
                if not p[3]:
                    continue
                weight = max(0, 24-x) / 24
                dy = round(math.sin(phase*math.tau/6 + x*.24) * 2 * weight)
                f.putpixel((x+4, y+3+dy), tuple(p))
        # Reuse narrow source flame fragments for the trailing wisps.
        d = ImageDraw.Draw(f)
        for k in range(3):
            yy = 9 + k*6 + round(2*math.sin(phase*math.tau/6+k))
            d.line([(2+k, yy+1), (5+k, yy), (9+k, yy+1)], fill=INK, width=1)
            if (phase+k) % 3 != 0:
                d.point((3+k, yy), fill=VIOLET)
        result.append(f)
    return result


GHOST_FRAMES = ghost_projectiles()


def burst_frames():
    result = []
    # Uneven, directional flame islands peel away; opacity stays binary throughout.
    shard = cut(GHOST_FRAMES[0].crop((4, 3, 29, 25)))
    sizes = [(16, 15), (30, 28), (40, 38), (32, 33), (21, 24), (10, 12), (0, 0)]
    for i, (w, h) in enumerate(sizes):
        f = canvas(64)
        if w:
            body = GHOST_RIGHT.resize((w, h), NEAREST)
            if i >= 3:
                # Break source clusters apart instead of shrinking a complete face.
                a = np.array(body)
                yy, xx = np.mgrid[:h, :w]
                missing = ((xx//3*7+yy//3*11) % 13) < (i-2)*3
                a[missing] = 0
                body = Image.fromarray(a)
            composite_at(f, body, (32-w//2, 32-h//2))
        for k in range(8):
            angle = k*math.tau/8 + .14
            radius = [8, 13, 19, 23, 25, 27, 28][i]
            x = round(32+math.cos(angle)*radius)
            y = round(32+math.sin(angle)*radius*.83)
            if i < 5:
                sw = [6, 10, 11, 8, 5][i] + (k % 2)
                sh = [4, 7, 8, 6, 4][i]
                bit = cut(shard.rotate(-math.degrees(angle), resample=NEAREST, expand=True))
                bit = bit.resize((sw, sh), NEAREST)
                composite_at(f, bit, (x-sw//2, y-sh//2))
            if i < 6 or k % 2 == 0:
                stamp_spark(f, x, y, RED if i < 4 else VIOLET,
                            2 if 1 <= i <= 3 else 1, (1 if k%2 else -1, -1))
        if i in (1, 2):
            d = ImageDraw.Draw(f)
            # Core is broken into hard-edged fissures rather than a soft light disk.
            d.line([(27, 29), (31, 31), (35, 28), (37, 29)], fill=RED, width=2)
            d.line([(32, 31), (30, 36), (32, 39)], fill=DARK_RED, width=2)
        result.append(f)
    return result


def aidan_cast():
    forward = components(A1)[0]  # no detached ghost from the old attack
    result = []
    recoil = components(frame('aidan/Attack1.png', 7))[0]
    poses = [IDLE, A2, forward, forward, forward, recoil, A2, IDLE]
    for i, pose in enumerate(poses):
        f = pose.copy()  # body pixels are never scaled, sheared or warped
        # Directional flame sitting on the actual source staff head.
        tip = [(148, 101), (160, 90), (175, 112), (178, 112),
               (179, 114), (175, 111), (160, 90), (148, 101)][i]
        if i <= 3:
            w, h = [(10, 9), (14, 11), (18, 15), (25, 20)][i]
            flame = GHOST_FRAMES[i].crop((1, 2, 45, 29)).resize((w, h), NEAREST)
            composite_at(f, flame, (tip[0]-w//2, tip[1]-h//2))
            for k in range(i):
                stamp_spark(f, tip[0]+8+k*4, tip[1]-12+(k%2)*8, VIOLET, 1)
        if i == 3:
            d = ImageDraw.Draw(f)
            d.line([(tip[0]-4, tip[1]), (tip[0]+6, tip[1])], fill=RED, width=1)
            d.line([(tip[0]+1, tip[1]-4), (tip[0]+1, tip[1]+4)], fill=RED, width=1)
        if i == 4:
            # Release registered at y=120: dark envelope, violet tongues, red eye.
            flame = GHOST_FRAMES[1].resize((63, 38), NEAREST)
            composite_at(f, flame, (180, 101))
            d = ImageDraw.Draw(f)
            d.line([(178, 113), (185, 116), (193, 117)], fill=VIOLET, width=3)
            for x, y in [(194, 96), (213, 98), (241, 109), (238, 138), (200, 144)]:
                stamp_spark(f, x, y, RED if x == 241 else VIOLET, 2)
        if i == 5:
            # Recoil reads in the flame withdrawing into the unchanged staff/arm.
            d = ImageDraw.Draw(f)
            d.line([(172, 109), (167, 112), (169, 116)], fill=RED, width=1)
            for x, y in [(189, 119), (199, 111), (210, 127)]:
                stamp_spark(f, x, y, VIOLET)
        result.append(f)
    return result


def slime_leap():
    idle = [frame('slime/Slime3_Idle_with_shadow.png', i, 64, 3) for i in range(6)]
    walk = [frame('slime/Slime3_Walk_with_shadow.png', i, 64, 3) for i in range(8)]
    original = np.asarray(idle[0])
    shadow = original.copy()
    shadow[shadow[:, :, 3] == 255] = 0
    shadow = Image.fromarray(shadow)
    # Separate rising flame islands by colour and position; preserve the rock's texture.
    yy, xx = np.mgrid[:64, :64]
    flame_mask = (original[:, :, 3] == 255) & ((yy < 24) | ((yy < 28) & (xx < 29)))
    rock = original.copy()
    rock[flame_mask | (rock[:, :, 3] < 255)] = 0
    rock = cut(Image.fromarray(rock))
    flame = original.copy()
    flame[~flame_mask] = 0
    flame = cut(Image.fromarray(flame))
    ember = nearest_colour(idle[0], (237, 170, 51))
    hot = nearest_colour(idle[0], (255, 255, 140))
    dust = nearest_colour(idle[0], (107, 86, 77))
    result = []
    # x centre is constant. Only squash/stretch and the intended vertical jump move.
    sizes = [(22, 13), (25, 11), (16, 23), (17, 22), (18, 21), (18, 20), (29, 10), rock.size]
    bottoms = [40, 40, 35, 26, 24, 32, 40, 40]
    for i, ((w, h), bottom) in enumerate(zip(sizes, bottoms)):
        f = canvas(64)
        if i in (0, 1, 6, 7):
            composite_at(f, shadow, (0, 0))
        else:
            # The source shadow is partly covered by the rock. Reconstruct its
            # hidden middle when airborne: shrinking only visible pixels makes a U.
            sw = [15, 12, 11, 14][i-2]
            sh = canvas(sw, 3)
            colour = Counter(map(tuple, np.asarray(shadow).reshape(-1, 4))).most_common(2)[1][0]
            for sy in range(3):
                for sx in range(sw):
                    if ((sx-(sw-1)/2)/(sw/2))**2+((sy-1)/1.6)**2 <= 1:
                        sh.putpixel((sx, sy), colour)
            composite_at(f, sh, (32-sw//2, 39))
        body = rock.resize((w, h), NEAREST)
        composite_at(f, body, (32-w//2, bottom-h))
        if i in (0, 1):
            fl = flame.resize((12+i*2, 17+i*3), NEAREST)
            composite_at(f, fl, (25-fl.width//2, bottom-h-14-i*2))
            stamp_spark(f, 37+i*2, 16-i*3, hot)
        elif i in (2, 3, 4, 5):
            # Source flame swept backwards; never displace the body sideways.
            fl = cut(flame.rotate(38 if i != 5 else 18, resample=NEAREST, expand=True))
            fl = fl.resize((15, 13), NEAREST)
            composite_at(f, fl, (17, max(1, bottom-h-7)))
            for k in range(2):
                stamp_spark(f, 12+k*4, max(2, bottom-h+3+k*3), ember)
        elif i == 6:
            fl = flame.resize((12, 14), NEAREST)
            composite_at(f, fl, (25, 17))
            for x, y, c in [(12, 36, dust), (17, 31, ember), (46, 33, ember), (51, 38, dust)]:
                stamp_spark(f, x, y, c, 2 if c == dust else 1)
        else:
            # Exact source silhouette in recovery; source animation loops from here.
            f = idle[0].copy()
        result.append(f)
    return result, idle[0], walk[0]


def lock_shadow(source, reference):
    # Character pixels stop above this scanline; anchor the original ground ellipse.
    source = source.copy()
    source.paste(reference.crop((0, 235, 256, 256)), (0, 235))
    return source


def skeleton_windup():
    result = []
    eyes = [((120, 108, 13, 16), (161, 107, 8, 14)),
            ((126, 111, 9, 13), (163, 101, 10, 15)),
            ((129, 112, 10, 13), (165, 103, 10, 15)),
            ((129, 112, 10, 13), (165, 103, 10, 15))]
    for i, source_index in enumerate([0, 1, 2, 2]):
        f = lock_shadow(frame('skeleton/attack.png', source_index, 256),
                        frame('skeleton/attack.png', 0, 256))
        a = np.array(f)
        for cx, cy, rx, ry in eyes[i]:
            for y in range(cy-ry, cy+ry+1):
                for x in range(cx-rx, cx+rx+1):
                    norm = ((x-cx)/rx)**2+((y-cy)/ry)**2
                    r, g, b, alpha = map(int, a[y, x])
                    if norm <= 1 and alpha == 255 and max(r, g, b) < 75:
                        a[y, x] = RED if norm < [.08, .18, .32, .48][i] else DARK_RED
        # Restrained red heat on the original branch highlights, preserving its grain.
        for y in range(13, 84):
            for x in range(15, 185):
                r, g, b, alpha = map(int, a[y, x])
                if alpha and r > g+9 and g > b+7 and r > 75 and .32*x-5 <= y <= .36*x+16:
                    if ((x//3)+(y//3)) % 7 < i:
                        a[y, x] = DARK_RED if i < 3 else (RED if (x//3+y//3) % 11 == 0 else DARK_RED)
        f = Image.fromarray(a)
        if i >= 2:
            stamp_spark(f, 66, 15, DARK_RED, 2)
            stamp_spark(f, 91, 9, RED if i == 3 else DARK_RED, 2)
        result.append(f)
    return result


ALIEN_REF = frame('alien/attack.png', 0, 256)
CYAN_DARK = nearest_colour(ALIEN_REF, (0, 101, 127))
CYAN = nearest_colour(ALIEN_REF, (30, 204, 209))
CYAN_LIGHT = nearest_colour(ALIEN_REF, (170, 244, 231))


def pixel_aura(im, cx, cy, radius, phase, core=False):
    """Clustered four-way light, no blended pixels or translucent halo."""
    d = ImageDraw.Draw(im)
    q = 3
    for k in range(8):
        ang = k*math.tau/8+phase*.15
        x = cx+round(math.cos(ang)*radius/q)*q
        y = cy+round(math.sin(ang)*radius/q)*q
        if (k+phase) % 3:
            d.rectangle((x-1, y-1, x+1, y+1), fill=CYAN if k % 2 else CYAN_DARK)
    if core:
        d.rectangle((cx-4, cy-3, cx+4, cy+3), fill=CYAN)
        d.rectangle((cx-2, cy-5, cx+2, cy+5), fill=CYAN)
        d.rectangle((cx-1, cy-2, cx+2, cy+1), fill=CYAN_LIGHT)


def alien_charge():
    result = []
    for i, source_index in enumerate([0, 2, 3, 3]):
        source = lock_shadow(frame('alien/attack.png', source_index, 256), ALIEN_REF)
        tips = [(92, 35), (147, 34)] if source_index < 3 else [(84, 16), (138, 16)]
        palm = (157, 153) if source_index < 3 else (170, 125)
        f = canvas(256)
        for x, y in tips:
            pixel_aura(f, x, y, 5+i*2, i)
        pixel_aura(f, *palm, 6+i*3, i)
        composite_at(f, source, (0, 0))
        d = ImageDraw.Draw(f)
        for x, y in tips:
            # Highlight follows source antenna caps, with the dark stalk still visible.
            d.rectangle((x-3, y-3, x+3, y-1), fill=CYAN if i < 2 else CYAN_LIGHT)
            if i >= 2:
                d.rectangle((x-2, y-5, x+1, y-4), fill=CYAN)
        pixel_aura(f, *palm, 5+i*3, i, core=True)
        if i == 3:
            # Three discrete motes advertise the triple-shot without a muzzle flash.
            for x, y in [(186, 110), (193, 124), (186, 139)]:
                d.rectangle((x-2, y-2, x+2, y+2), fill=CYAN_DARK)
                d.rectangle((x-1, y-1, x+1, y+1), fill=CYAN_LIGHT)
        result.append(f)
    return result


def crescent_frames():
    # Trace the source arc's inside boundary, excluding the staff flame and body.
    mask = Image.new('L', FLY.size)
    ImageDraw.Draw(mask).polygon([(137, 27), (249, 27), (249, 139), (208, 139),
        (199, 131), (198, 111), (205, 109), (205, 100), (197, 92), (194, 94),
        (190, 96), (182, 90), (177, 81), (175, 71), (171, 62), (174, 57),
        (189, 54), (194, 53), (187, 48), (177, 42), (161, 36), (145, 34)], fill=255)
    a = np.array(FLY)
    a[np.asarray(mask) == 0] = 0
    seed = cut(Image.fromarray(a)).resize((79, 78), NEAREST)
    result = []
    for i in range(4):
        f = canvas(96)
        # Arc stays registered. Only its detached trailing embers and hot edge travel.
        composite_at(f, seed, (8, 9))
        a = np.array(f)
        for y in range(24, 77):
            xs = np.flatnonzero(a[y, :, 3])
            if len(xs) and (y//5+i) % 4 != 0:
                x = int(xs[-1])
                if x > 62:
                    a[y, x] = INK
                    a[y, x-1] = RED
                    if (y//6+i) % 3 == 0:
                        a[y, x-2] = DARK_RED
        f = Image.fromarray(a)
        # Two source-textured tongues flicker along the inner, concave edge.
        # Root positions stay fixed while their tips shed small clusters.
        tongue_source = GHOST_SOURCE.crop((0, 23, 25, 59))
        for k, (x, y) in enumerate([(49, 40), (61, 61)]):
            tongue = cut(tongue_source.rotate([12, -8, 18, 0][(i+k)%4], resample=NEAREST, expand=True))
            tongue = tongue.resize((8+(i+k)%3, 14+(i+2*k)%4), NEAREST)
            composite_at(f, tongue, (x-tongue.width, y-tongue.height//2))
        for k in range(4):
            x = 10+k*9 - (i*2+k) % 5
            y = 26+k*13 + round(2*math.sin(i*math.pi/2+k))
            stamp_spark(f, x, y, VIOLET if k % 2 else INK, 2)
        result.append(f)
    return result


def save_strip(path, frames, sources, reference, crop, baseline, notes):
    w, h = frames[0].size
    strip = canvas(w*len(frames), h)
    for i, f in enumerate(frames):
        assert f.size == (w, h)
        assert f.getbbox() is not None
        composite_at(strip, f, (w*i, 0))
    p = ASSETS / path
    p.parent.mkdir(parents=True, exist_ok=True)
    # Canonical transparent RGB: no hidden white matte from the slime source.
    a = np.array(strip)
    a[a[:, :, 3] == 0] = 0
    strip = Image.fromarray(a)
    strip.save(p, optimize=False, compress_level=9)
    MANIFEST[path] = {'frameWidth': w, 'frameHeight': h, 'frames': len(frames),
        'source': {'kind': 'deterministic-pixel-derivative', 'files': sources},
        'license': 'Inherited from project source artwork; no external artwork added.',
        'baseline': baseline, 'notes': notes, 'technical_checks_passed': False}
    PREVIEWS.append((path, frames, reference, crop, baseline, notes))


def preview():
    font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    try:
        font = ImageFont.truetype(font_path, 17)
        title_font = ImageFont.truetype(font_path, 21)
    except OSError:
        font = title_font = ImageFont.load_default()
    panels = []
    for path, frames, ref, crop, baseline, notes in PREVIEWS:
        # Consistent crop shared by ALL cells; no per-frame re-centering hides jitter.
        scale = 2 if frames[0].width == 256 else 3
        cw, frame_ch = (crop[2]-crop[0])*scale, (crop[3]-crop[1])*scale
        ref_view = ref.crop(crop) if ref.size == frames[0].size else ref
        rw, rh = ref_view.width*scale, ref_view.height*scale
        ch = max(frame_ch, rh)
        gap, label = 10, 30
        panel_w = max(rw+gap+len(frames)*(cw+gap)+gap, 1380)
        panel = Image.new('RGB', (panel_w, 82+2*(ch+label+gap)), '#202632')
        d = ImageDraw.Draw(panel)
        d.text((12, 8), path, font=title_font, fill='#ecded0')
        d.text((12, 38), f'{len(frames)} frames | {frames[0].width} x {frames[0].height} | nearest x{scale} | fixed crop {crop}', font=font, fill='#aebac7')
        for row, (bg, fg) in enumerate([('#191724', '#bab3ca'), ('#e5dfce', '#655a61')]):
            y0 = 76+row*(ch+label+gap)
            for j, f in enumerate([ref]+frames):
                x0 = gap if j == 0 else gap+rw+gap+(j-1)*(cw+gap)
                cell_w = rw if j == 0 else cw
                d.rectangle((x0, y0, x0+cell_w-1, y0+ch-1), fill=bg)
                view = ref_view if j == 0 else f.crop(crop)
                enlarged = view.resize((view.width*scale, view.height*scale), NEAREST)
                panel.paste(enlarged, (x0, y0+(ch-enlarged.height)//2), enlarged)
                # Dashed baseline outside pixels: helps compare feet and shadows.
                if baseline is not None and crop[1] <= baseline < crop[3]:
                    by = y0+(ch-frame_ch)//2+(baseline-crop[1])*scale
                    for bx in range(x0, x0+cw, 15):
                        d.line((bx, by, min(bx+4, x0+cw-1), by), fill='#847a73')
                text = 'ORIGINAL' if j == 0 else f'{j-1:02d}' + ('  RELEASE' if 'Cast_' in path and j == 5 else '')
                d.text((x0+5, y0+ch+4), text, font=font, fill=fg if row == 0 else '#c0c9d0')
        panels.append(panel)
    out = Image.new('RGB', (max(p.width for p in panels), sum(p.height+14 for p in panels)+65), '#10141d')
    d = ImageDraw.Draw(out)
    d.text((14, 10), 'EL PACTO DE HIARETH / ANIMATION REVIEW / ORIGINAL + ALL FRAMES', font=title_font, fill='#f2dfca')
    d.text((14, 38), 'Dark + light backgrounds. Fixed crops, integer pixels, native source palettes. Dashed line = baseline.', font=font, fill='#a7b6c8')
    y = 65
    for panel in panels:
        out.paste(panel, (0, y))
        y += panel.height+14
    out.save(ROOT / 'tools/anim_preview.png', compress_level=9)


def validate():
    for path, entry in MANIFEST.items():
        with Image.open(ASSETS/path) as im:
            assert im.mode == 'RGBA'
            assert im.size == (entry['frameWidth']*entry['frames'], entry['frameHeight'])
            a = np.asarray(im)
            assert np.any(a[:, :, 3] == 0)
            if path.startswith('fx/'):
                assert set(np.unique(a[:, :, 3])) == {0, 255}, path
            # There must be transparent padding around the content in every frame.
            for i in range(entry['frames']):
                f = im.crop((i*entry['frameWidth'], 0, (i+1)*entry['frameWidth'], entry['frameHeight']))
                box = f.getbbox()
                assert box and box[0] > 0 and box[1] > 0 and box[2] < f.width and box[3] < f.height, (path, i, box)
        entry['technical_checks_passed'] = True
    # All eight cast poses retain the source's ground-contact scanline, exactly.
    cast = PREVIEWS[0][1]
    for f in cast:
        assert f.crop((0, 150, 250, 180)).getbbox()[3]+150 == 167
    # Lowest shadow scanlines are byte-identical through every enemy preparation frame.
    for path, frames, _, _, _, _ in PREVIEWS:
        if path in ('skeleton/windup.png', 'alien/charge.png'):
            assert len({hashlib.sha256(f.crop((0, 235, 256, 256)).tobytes()).hexdigest() for f in frames}) == 1
    # Every new fully opaque RGB ink is present in one of its listed source images.
    for path, entry in MANIFEST.items():
        palette = set()
        for source in entry['source']['files']:
            with Image.open(ASSETS/source) as im:
                palette.update(map(tuple, np.asarray(im.convert('RGBA')).reshape(-1, 4)))
        if path.startswith('skeleton/'):
            palette.update(PALETTE)  # same red warning ink as Aidan
        with Image.open(ASSETS/path) as im:
            colours = set(map(tuple, np.asarray(im).reshape(-1, 4)))
        new_inks = {p for p in colours-palette if p[3] == 255}
        assert not new_inks, (path, new_inks)
    for source, sha in SOURCE_HASHES.items():
        assert hashlib.sha256((ASSETS/source).read_bytes()).hexdigest() == sha
    (ASSETS/'anim_sprites.json').write_text(json.dumps(MANIFEST, indent=2, ensure_ascii=False)+'\n')


def main():
    cast = aidan_cast()
    leap, slime_ref, _ = slime_leap()
    save_strip('aidan/Cast_GhostFire.png', cast,
        ['aidan/Idle.png', 'aidan/Attack1.png', 'aidan/Attack2.png'], IDLE,
        (96, 42, 248, 174), 167,
        'Ground cast; release at frame 4, projectile centre y=120. Character pixels unscaled.')
    save_strip('fx/ghostfire.png', GHOST_FRAMES, ['aidan/Attack1.png'], GHOST_SOURCE,
        (0, 0, 48, 32), None, 'Right-facing source ghost with registered head and waving tail.')
    # FX references are cropped original effect pixels, without compositing new art.
    save_strip('fx/ghostfire_burst.png', burst_frames(), ['aidan/Attack1.png'],
        GHOST_SOURCE, (0, 0, 64, 64), None,
        'Seven expanding/fragmenting poses, hard alpha; final embers intentionally sparse.')
    save_strip('slime/Slime3_Leap.png', leap,
        ['slime/Slime3_Idle_with_shadow.png', 'slime/Slime3_Walk_with_shadow.png'],
        slime_ref, (0, 0, 64, 64), 42,
        'Right-facing row 3. Fixed ground shadow; takeoff 2, apex 3-4, landing 6.')
    save_strip('skeleton/windup.png', skeleton_windup(),
        ['skeleton/attack.png', 'aidan/Attack1.png'], frame('skeleton/attack.png', 0, 256),
        (0, 0, 256, 256), 248,
        'Attack source frames 0/1/2/2, red socket cores and restrained heat on branch.')
    save_strip('alien/charge.png', alien_charge(), ['alien/attack.png'], ALIEN_REF,
        (0, 0, 256, 256), 248,
        'Attack source frames 0/2/3/3; stepped cyan antenna and palm charge, three final motes.')
    save_strip('fx/crescent.png', crescent_frames(),
        ['aidan/Vuelo_Ataque2_MediaLunaDeFuego.png', 'aidan/Attack1.png'],
        FLY.crop((125, 20, 250, 165)),
        (0, 0, 96, 96), None,
        'Source airborne crescent isolated by pixel mask; right edge red, registered arc.')
    validate()
    preview()
    for path, e in MANIFEST.items():
        print(f"PASS {path}: {e['frameWidth']*e['frames']}x{e['frameHeight']} / {e['frames']} frames")
    print('PASS source hashes, native palettes, alpha, padding, fixed cast/enemy bases')


if __name__ == '__main__':
    main()
