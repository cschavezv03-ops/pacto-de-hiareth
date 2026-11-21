#!/usr/bin/env python3
"""Deterministic, native-resolution pixel props for El Pacto de Hiareth.

Run from anywhere with tools/.venv/bin/python tools/gen_props.py.
All art is authored here with Pillow integer primitives; no external assets,
resampling, antialiasing, image generation service, or downloaded artwork.

Art direction: side view, upper-left key light, selective 1px outlines,
3–4 material values and clustered wear. Palettes sampled from the supplied
background layers. Native player height is ~60px; world sprites use the same
1.6667 nearest-neighbour game scale as the 576x324 backgrounds.
The preview is diagnostic only: native scene crops enlarged exactly 3x.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/props"
BG = ROOT / "public/assets/bg"
NEAREST = Image.Resampling.NEAREST
MANIFEST = {}


def canvas(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def layer_polygon(im, points, color, outline=None, width=1):
    d = ImageDraw.Draw(im)
    d.polygon(points, fill=color)
    if outline:
        d.line(points + [points[0]], fill=outline, width=width)


def clipped(im, mask, paint):
    """Paint texture into a silhouette without bleeding over a stepped edge."""
    texture = canvas(*im.size)
    paint(ImageDraw.Draw(texture))
    texture.putalpha(Image.composite(texture.getchannel("A"), Image.new("L", im.size), mask))
    im.alpha_composite(texture)


def mask_polygon(size, points):
    mask = Image.new("L", size)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask


def house():
    im = canvas(110, 100)
    d = ImageDraw.Draw(im)
    edge, dark, wood, grain, worn = "#312a39", "#3e2e3e", "#4f364f", "#665063", "#796477"
    # The chimney is behind the roof; its left face catches the ambient light.
    d.polygon([(25, 27), (25, 5), (36, 5), (36, 31)], fill="#494253")
    d.rectangle((26, 7, 30, 25), fill="#665d6a")
    d.rectangle((24, 3, 37, 6), fill=edge)
    d.line((25, 3, 36, 3), fill="#807280")
    for x, y in [(27, 10), (32, 14), (26, 19), (31, 24)]:
        d.line((x, y, x + 3, y), fill="#3a3344")
        d.point((x, y - 1), fill="#796c7c")
    # Side elevation and front gable. Front is a little lighter than the side.
    d.polygon([(12, 48), (55, 48), (55, 94), (12, 94)], fill="#494253")
    d.polygon([(54, 50), (76, 17), (99, 51), (99, 95), (54, 95)], fill="#665d6a")
    d.polygon([(57, 51), (76, 24), (93, 51)], fill="#6d6875")
    rng = random.Random(31)
    # Exposed masonry in tight clusters rather than uniform pixel noise.
    for origin, count in [((16, 82), 10), ((88, 81), 11), ((58, 57), 6), ((35, 69), 5)]:
        for _ in range(count):
            x, y = origin[0] + rng.randrange(9), origin[1] + rng.randrange(9)
            d.line((x, y, x + rng.randrange(2, 5), y), fill=rng.choice(["#52495e", "#5c5368", "#796b7b"]))
    # Structural timbers, with inset grain and diagonal braces.
    for x in [13, 52, 96]:
        d.rectangle((x, 51, x + 3, 93), fill=dark)
        d.line((x, 53, x, 88), fill=grain)
    for y in [55, 77]:
        d.rectangle((15, y, 96, y + 2), fill=wood)
        d.line((15, y, 95, y), fill=grain)
    d.line((55, 73, 66, 58), fill=dark, width=3)
    d.line((86, 58, 95, 71), fill=dark, width=3)
    d.line((55, 72, 65, 58), fill=grain)
    d.line((86, 58, 94, 70), fill=grain)
    d.line((76, 24, 76, 49), fill=wood, width=3)
    d.line((64, 43, 88, 43), fill=wood, width=2)
    d.line((15, 91, 30, 79), fill=dark, width=3)
    d.line((35, 58, 50, 73), fill=dark, width=3)
    # Heavy slate roof, individually staggered shingle courses.
    roof = [(5, 51), (34, 12), (77, 12), (55, 55)]
    d.polygon(roof, fill="#3a3344")
    mask = mask_polygon(im.size, roof)

    def tiles(t):
        for row, y in enumerate(range(16, 55, 5)):
            for x in range(-10 + (row % 2) * 5, 85, 10):
                shift = rng.choice([-1, 0, 0, 1])
                t.line((x + 1, y, x + 8, y + shift), fill=rng.choice(["#52495e", "#4f4959", "#494253"]))
                t.line((x + 2, y + 1, x + 8, y + 1 + shift), fill="#433b4f")
                t.line((x + 8, y + 2, x + 10, y + 4), fill="#312b3b")
                if (x + row) % 3 == 0:
                    t.line((x + 3, y + 3, x + 6, y + 3), fill="#5c5368")

    clipped(im, mask, tiles)
    # A few missing tiles expose the rafters underneath, not random black dots.
    d.polygon([(31, 31), (38, 31), (39, 35), (35, 39), (28, 38)], fill="#292431")
    d.line((31, 37, 37, 33), fill=wood)
    d.line((30, 39, 36, 39), fill="#665063")
    d.polygon([(51, 19), (57, 19), (55, 23), (49, 23)], fill="#292431")
    d.line((50, 23, 54, 23), fill=grain)
    # Ridge and gable fascia: irregular tips, thin upper highlight.
    d.line((4, 51, 55, 56), fill=edge, width=3)
    d.line((5, 50, 54, 54), fill=grain)
    d.line((33, 11, 78, 11), fill=wood, width=3)
    d.line((34, 10, 77, 10), fill=grain)
    d.line((54, 54, 76, 14, 103, 54), fill=dark, width=5)
    d.line((53, 52, 76, 12, 103, 52), fill=grain, width=2)
    d.line((76, 14, 102, 53), fill=wood, width=2)
    d.rectangle((74, 9, 79, 12), fill=wood)
    d.point((75, 9), fill=worn)
    # Recessed plank door, stone jambs and low golden light under the lintel.
    d.rectangle((66, 63, 85, 95), fill="#52495e")
    d.rectangle((68, 65, 83, 95), fill="#292431")
    d.rectangle((70, 67, 82, 94), fill="#54414e")
    for x in [70, 74, 78, 82]:
        d.line((x, 68, x, 93), fill=dark)
        d.line((x + 1, 69, x + 1, 91), fill="#725561")
    d.line((70, 69, 81, 69), fill="#9e755f")
    d.rectangle((70, 74, 81, 75), fill=dark)
    d.line((71, 88, 80, 79), fill=grain, width=2)
    d.rectangle((79, 80, 81, 82), fill=edge)
    d.point((79, 80), fill="#c49b70")
    d.line((70, 94, 82, 94), fill="#b58a65")

    def window(x, y, w, h):
        d.rectangle((x - 2, y - 2, x + w + 1, y + h + 2), fill=dark)
        d.rectangle((x, y, x + w - 1, y + h - 1), fill="#9d6d59")
        d.rectangle((x + 1, y + 1, x + w - 2, y + h - 2), fill="#c3966a")
        d.rectangle((x + 2, y + 2, x + w - 3, y + h - 4), fill="#ddba7e")
        d.line((x + w // 2, y, x + w // 2, y + h), fill=wood)
        d.line((x, y + h // 2, x + w - 1, y + h // 2), fill=wood)
        d.line((x - 2, y + h + 2, x + w + 2, y + h + 2), fill=grain)
        d.point((x - 1, y + h + 1), fill="#9e755f")

    window(25, 61, 11, 12)
    window(70, 36, 10, 11)
    window(88, 62, 6, 10)
    # Broken shutter hangs at an angle; the other shutter has split slats.
    d.polygon([(18, 60), (22, 61), (21, 74), (17, 72)], fill=wood)
    d.line((18, 61, 17, 70), fill=grain)
    d.line((18, 66, 21, 67), fill=edge)
    d.polygon([(38, 60), (42, 59), (42, 69), (40, 68), (40, 73), (38, 73)], fill=wood)
    d.line((39, 61, 39, 67), fill=grain)
    d.line((38, 64, 41, 63), fill=dark)
    # Foundation: offset stones with a shared grounded baseline.
    d.polygon([(10, 92), (98, 92), (103, 97), (101, 99), (8, 99), (8, 96)], fill=edge)
    for row, y in enumerate([92, 96]):
        for x in range(11 - row * 3, 101, 10):
            d.polygon([(x + 1, y + 1), (x + 7, y), (x + 9, y + 2), (x + 7, y + 3), (x, y + 3)], fill="#52495e")
            d.line((x + 2, y + 1, x + 6, y + 1), fill="#6d6875")
    d.rectangle((65, 96, 85, 98), fill="#796c7c")
    d.line((64, 99, 87, 99), fill="#494253")
    d.line((68, 96, 82, 96), fill="#9e817a")
    # Dead vines climb the cool, unlit corner.
    d.line((15, 96, 19, 86, 17, 81, 20, 75, 18, 70), fill="#312b3b")
    d.line((19, 85, 24, 81, 23, 78), fill="#3e2e3e")
    for x, y in [(17, 88), (20, 82), (17, 76), (23, 80)]:
        d.line((x, y, x - 2, y - 2), fill="#796477")
    return im


def sign():
    im = canvas(44, 60)
    d = ImageDraw.Draw(im)
    outline, dark, mid, light = "#293423", "#59432f", "#815c3e", "#ad8956"
    d.polygon([(18, 8), (24, 7), (25, 58), (17, 58)], fill=outline)
    d.polygon([(19, 9), (23, 8), (23, 57), (19, 57)], fill=mid)
    d.line((19, 10, 19, 55), fill=light)
    d.line((22, 12, 22, 55), fill=dark)
    d.line((20, 37, 20, 42, 21, 44, 21, 51), fill="#b39460")
    # Rough split-plank arrow with raised grain and a chipped tail.
    arrow = [(3, 14), (28, 13), (28, 8), (41, 21), (29, 33), (29, 28), (3, 29), (4, 24), (2, 22)]
    layer_polygon(im, arrow, mid, outline)
    d.polygon([(4, 15), (28, 14), (29, 11), (38, 20), (5, 20)], fill="#a07b4d")
    d.line((5, 15, 27, 14), fill="#c1a06b")
    d.line((29, 12, 38, 21), fill=light)
    d.line((4, 22, 36, 22), fill=dark)
    d.line((5, 27, 28, 26, 29, 29), fill=dark)
    for points in [[(6, 18), (13, 17), (17, 18)], [(7, 25), (13, 24), (18, 25)], [(26, 18), (30, 18), (33, 20)]]:
        d.line(points, fill=light)
    d.line((8, 15, 10, 17, 9, 19), fill=dark)
    d.ellipse((23, 23, 27, 25), fill=dark)
    d.point((24, 23), fill=light)
    for x, y in [(20, 17), (20, 25)]:
        d.rectangle((x, y, x + 1, y + 1), fill="#364356")
        d.point((x, y), fill="#9ba2a1")
    # Olive moss and grasses borrow the foreground vegetation palette.
    d.line((4, 28, 10, 28), fill="#4c5f21")
    d.point((5, 27), fill="#7c7b1b")
    d.polygon([(10, 58), (14, 55), (19, 56), (24, 55), (32, 58), (30, 59), (10, 59)], fill="#233613")
    for x, y in [(13, 58), (16, 59), (25, 58), (28, 59), (9, 59), (32, 59)]:
        d.line((x, y, x - 2, y - 5), fill="#40511b")
        d.line((x, y, x + 1, y - 7), fill="#4c5f21")
        d.point((x + 1, y - 7), fill="#7c7b1b")
    d.polygon([(23, 57), (25, 55), (28, 56), (30, 58), (24, 59)], fill="#303b4c")
    d.line((24, 56, 27, 56), fill="#535e63")
    return im


def portal(frame):
    im = canvas(56, 84)
    d = ImageDraw.Draw(im)
    # An asymmetric, damaged stone arch. All masonry stays fixed in animation.
    d.ellipse((4, 2, 51, 79), fill="#3e343e")
    d.ellipse((5, 3, 50, 77), fill="#675757")
    d.ellipse((8, 6, 48, 75), fill="#906d6d")
    d.ellipse((11, 10, 45, 73), fill="#4b3947")
    for j in range(15):
        a = math.pi * 2 * j / 15
        x, y = round(27.5 + 22 * math.cos(a)), round(40 + 36 * math.sin(a))
        u, v = round(27.5 + 17 * math.cos(a)), round(40 + 30 * math.sin(a))
        d.line((x, y, u, v), fill="#4e4048", width=2)
        if j in [8, 9, 10, 11]:
            d.line((x, y - 1, u, v - 1), fill="#bbacac")
    d.ellipse((12, 11, 44, 72), fill="#2f2938")
    mask = Image.new("L", im.size)
    ImageDraw.Draw(mask).ellipse((12, 11, 44, 72), fill=255)

    def vortex(t):
        # Flat palette bands follow an elliptical spiral; rotating bright heads
        # move through fixed bounds without moving the arch or its ground anchor.
        t.ellipse((15, 15, 42, 69), fill="#493144")
        t.ellipse((18, 21, 40, 65), fill="#60384b")
        t.ellipse((20, 27, 37, 59), fill="#402c3e")
        phase = frame * math.tau / 4
        for arm in range(3):
            points = []
            for i in range(85):
                u = i / 84
                a = u * math.tau * 1.05 + phase + arm * math.tau / 3
                r = 1.5 + 15 * u
                points.append((round(28 + r * math.cos(a)), round(42 + r * 1.83 * math.sin(a))))
            t.line(points, fill="#a75a6c", width=3)
            t.line(points[25:], fill="#dd7987", width=1)
            t.line(points[66:79], fill="#ffc1c1", width=2)
        t.ellipse((25, 37, 30, 46), fill="#302838")
        t.line((25, 39, 26, 37, 29, 37), fill="#ff8585")

    clipped(im, mask, vortex)
    # Inner red seam follows the arch in discrete pixel clusters.
    d.arc((10, 9, 46, 74), 180, 338, fill="#ff8585", width=1)
    d.arc((11, 10, 45, 73), 12, 105, fill="#b55d70", width=1)
    # Chipped crown, cracks, carved runes and their restrained red reflection.
    d.polygon([(24, 1), (32, 1), (34, 7), (31, 12), (25, 12), (22, 7)], fill="#4e4048")
    d.line((24, 2, 31, 2, 32, 5), fill="#bbacac")
    d.line((26, 5, 29, 5, 28, 8, 27, 7), fill="#ff8585")
    for points in [[(7, 29), (9, 31), (7, 34), (9, 36)], [(47, 43), (49, 45), (47, 48)], [(13, 14), (16, 15), (14, 18)]]:
        d.line(points, fill="#c78388")
    d.line((43, 16, 45, 21, 43, 24, 46, 28), fill="#3e343e")
    d.line((9, 53, 7, 59, 9, 63), fill="#3e343e")
    # Larger chipped facets interrupt the regular oval and give the arch weight.
    d.polygon([(11, 17), (15, 11), (19, 9), (16, 14), (14, 18)], fill="#9a8585")
    d.line((12, 16, 15, 12, 17, 11), fill="#bbacac")
    d.polygon([(5, 35), (8, 32), (9, 38), (7, 42), (5, 41)], fill="#785a5a")
    d.line((5, 35, 7, 33), fill="#bbacac")
    d.polygon([(45, 20), (48, 24), (49, 30), (46, 28)], fill="#4e4048")
    d.polygon([(48, 54), (50, 51), (49, 62), (46, 66), (47, 60)], fill="#4e4048")
    d.line((47, 57, 48, 54), fill="#9a8585")
    d.line((8, 57, 10, 60, 9, 63), fill="#aa858a")
    d.rectangle((4, 69, 13, 78), fill="#675757")
    d.line((5, 69, 12, 69), fill="#b28f94")
    d.rectangle((43, 69, 51, 78), fill="#675757")
    d.line((43, 70, 49, 70), fill="#aa858a")
    d.line((13, 70, 13, 76), fill="#c78388")
    # Broad stone feet sit on the last row; loose rubble breaks symmetry.
    d.polygon([(3, 78), (50, 78), (54, 81), (52, 83), (2, 83), (1, 81)], fill="#4e4048")
    d.line((4, 79, 49, 79), fill="#9a8585")
    d.line((17, 80, 39, 80), fill="#b55d70")
    d.line((9, 81, 13, 81), fill="#675757")
    d.point((42, 82), fill="#906d6d")
    d.polygon([(1, 75), (5, 74), (7, 78), (2, 79)], fill="#785a5a")
    d.point((2, 75), fill="#bbacac")
    d.polygon([(50, 77), (53, 76), (55, 81), (51, 81)], fill="#906d6d")
    for i in range(3):
        k = (i + frame) % 4
        x, y = [(7, 14), (50, 32), (3, 49), (48, 10)][k]
        d.line((x, y, x, y + 1), fill="#ff8585")
        if i == 0:
            d.point((x + 1, y), fill="#ffc1c1")
    return im


def flame(im, x, floor, frame, small=False):
    """Four hand-keyed tongues; integer contour changes, no blurred glow."""
    d = ImageDraw.Draw(im)
    if small:
        shapes = [
            [(0, 0), (-4, -3), (-4, -6), (-2, -5), (-2, -10), (0, -13), (0, -8), (3, -6), (4, -3), (2, 0)],
            [(0, 0), (-4, -2), (-3, -7), (-1, -6), (1, -12), (3, -14), (2, -8), (4, -5), (3, -1)],
            [(-2, 0), (-4, -4), (-2, -8), (-3, -12), (0, -10), (2, -6), (3, -8), (4, -3), (2, 0)],
            [(-2, 0), (-4, -3), (-4, -8), (-2, -7), (0, -14), (1, -9), (4, -5), (4, -2), (2, 0)],
        ]
        pts = [(x + u, floor + v) for u, v in shapes[frame]]
        d.polygon(pts, fill="#ad503c")
        d.polygon([(x - 2, floor - 1), (x - 3, floor - 4), (x - 1, floor - 8), (x + frame % 2, floor - 10), (x + 1, floor - 5), (x + 2, floor - 4), (x + 2, floor - 1)], fill="#ec8648")
        d.polygon([(x - 1, floor - 1), (x - 1, floor - 4), (x, floor - 7), (x + 1, floor - 3), (x + 1, floor - 1)], fill="#ffd183")
        d.point((x, floor - 2), fill="#ffe9b0")
    else:
        shapes = [
            [(-5, 0), (-8, -4), (-7, -10), (-4, -8), (-4, -15), (0, -23), (-1, -14), (3, -10), (4, -15), (7, -9), (8, -4), (5, 0)],
            [(-5, 0), (-8, -5), (-5, -12), (-2, -10), (0, -18), (4, -24), (3, -16), (5, -12), (7, -14), (8, -5), (5, 0)],
            [(-5, 0), (-8, -5), (-7, -11), (-4, -10), (-5, -21), (-2, -18), (1, -12), (3, -15), (5, -10), (7, -6), (5, 0)],
            [(-5, 0), (-8, -4), (-6, -13), (-3, -9), (-1, -18), (1, -24), (3, -18), (2, -14), (6, -10), (8, -4), (5, 0)],
        ]
        d.polygon([(x + u, floor + v) for u, v in shapes[frame]], fill="#a4483d")
        d.polygon([(x - 4, floor - 1), (x - 5, floor - 6), (x - 2, floor - 12), (x + frame % 2, floor - 17), (x + 1, floor - 10), (x + 4, floor - 7), (x + 5, floor - 3), (x + 3, floor - 1)], fill="#e18149")
        d.polygon([(x - 2, floor - 1), (x - 3, floor - 5), (x, floor - 10), (x + 1, floor - 6), (x + 3, floor - 2)], fill="#ffca7a")
        d.line((x, floor - 2, x, floor - 5), fill="#ffe9b0")


def camp(frame):
    im = canvas(100, 60)
    d = ImageDraw.Draw(im)
    # Snow islands: irregular silhouette, blue shadow and a lit upper crust.
    d.polygon([(1, 55), (8, 52), (28, 52), (39, 54), (65, 53), (73, 51), (91, 51), (98, 56), (94, 59), (9, 59)], fill="#4e616f")
    d.polygon([(2, 55), (10, 53), (30, 54), (41, 56), (62, 54), (75, 52), (91, 53), (96, 56), (86, 57), (58, 57), (48, 59), (13, 58)], fill="#9cafbd")
    d.line((10, 53, 28, 54), fill="#c5cace")
    # Ridge tent: a broad cold side plane and a warmer fire-facing entrance.
    d.polygon([(3, 50), (24, 10), (44, 14), (68, 51), (31, 54)], fill="#17202c")
    d.polygon([(5, 49), (24, 12), (43, 15), (30, 50)], fill="#54697c")
    d.polygon([(24, 14), (27, 15), (10, 48), (6, 49)], fill="#8598a8")
    d.polygon([(30, 50), (43, 16), (65, 50)], fill="#8c8784")
    d.polygon([(43, 17), (48, 27), (61, 49), (56, 49), (43, 24), (34, 49), (31, 50)], fill="#b0a59a")
    d.polygon([(43, 25), (56, 49), (34, 50)], fill="#26313e")
    d.polygon([(46, 35), (54, 48), (44, 49)], fill="#51454b")
    d.line((38, 48, 52, 48), fill="#a17c63")
    d.line((43, 23, 43, 49), fill="#3e3940")
    d.line((43, 23, 43, 29), fill="#d0b99b")
    # Cloth folds, seam stitches, frayed lower edge. Long clusters follow tension.
    d.line((26, 18, 17, 43, 15, 49), fill="#344d5f")
    d.line((29, 18, 24, 36, 20, 47), fill="#677d92")
    d.line((36, 19, 28, 46), fill="#344d5f")
    d.line((37, 22, 30, 44), fill="#7c8992")
    d.line((49, 27, 58, 44), fill="#726c70")
    d.line((49, 29, 55, 40), fill="#c1b09b")
    # A sewn repair and a short torn hem make the canvas a used shelter.
    d.polygon([(20, 30), (24, 31), (21, 39), (17, 38)], fill="#677d92")
    d.line((20, 30, 23, 31), fill="#9cafbd")
    d.line((17, 38, 21, 39, 24, 31), fill="#344d5f")
    for x, y in [(20, 31), (22, 32), (20, 37), (18, 36)]:
        d.point((x, y), fill="#9cafbd")
    d.line((60, 46, 62, 49), fill="#c1b09b")
    d.line((6, 49, 30, 51), fill="#2c3841", width=2)
    for x, y in [(25, 19), (22, 25), (19, 31), (16, 37), (13, 43)]:
        d.point((x, y), fill="#c5cace")
    # Frost along ridge and a lumpy dusting, not a white outline around the tent.
    d.line((24, 10, 43, 14), fill="#c5cace", width=2)
    d.polygon([(23, 12), (29, 12), (32, 15), (26, 14), (25, 17), (22, 17)], fill="#9cafbd")
    d.polygon([(6, 49), (13, 47), (16, 49), (25, 49), (30, 51), (28, 53), (7, 52)], fill="#9cafbd")
    d.line((8, 49, 12, 48), fill="#c5cace")
    # Guy ropes and individual pegs ground the shelter.
    d.line((24, 13, 1, 52), fill="#7c8992")
    d.line((44, 17, 70, 53), fill="#9b9186")
    d.line((1, 51, 2, 55), fill="#344d5f", width=2)
    d.line((70, 51, 69, 55), fill="#344d5f", width=2)
    d.line((43, 12, 43, 17), fill="#c1b09b")
    # Hearth stones, glowing coals and two crossed charred logs stay fixed.
    d.ellipse((72, 48, 94, 56), fill="#4e616f")
    d.ellipse((76, 49, 91, 54), fill="#704e4b")
    for x, y in [(74, 50), (78, 53), (85, 54), (91, 51), (88, 48)]:
        d.polygon([(x - 2, y), (x, y - 2), (x + 3, y - 1), (x + 3, y + 1), (x, y + 2)], fill="#677d92")
        d.line((x - 1, y - 1, x + 1, y - 1), fill="#9cafbd")
    d.line((77, 50, 89, 45), fill="#332e38", width=4)
    d.line((76, 45, 89, 51), fill="#4d3e41", width=4)
    d.line((77, 44, 88, 49), fill="#98664f")
    d.line((79, 49, 88, 46), fill="#bd7751")
    flame(im, 83, 49, frame)
    # Sparse drifting embers; their movement does not change the tent silhouette.
    for x, y in [(80 + frame, 20 - frame * 2), (88 - frame, 29 - frame)]:
        d.point((x, y), fill="#e18149")
    d.line((73, 56, 77, 56), fill="#c5cace")
    d.line((88, 56, 92, 56), fill="#c5cace")
    # Firelight is local and stepped, leaving the snow's cool shadow readable.
    d.line((78, 56, 85, 56), fill="#b0a59a")
    d.line((82, 57, 88, 57), fill="#8c8784")
    return im


def checkpoint(frame):
    im = canvas(16, 30)
    d = ImageDraw.Draw(im)
    # Neutral violet-grey carved stone, a metal bowl, and inset fire sigil.
    d.polygon([(4, 20), (11, 20), (10, 26), (12, 28), (12, 29), (3, 29), (3, 27), (5, 25)], fill="#343442")
    d.polygon([(5, 20), (9, 20), (8, 26), (5, 26)], fill="#73717b")
    d.line((5, 21, 5, 25), fill="#a5a0a1")
    d.rectangle((4, 27, 11, 28), fill="#73717b")
    d.line((4, 27, 10, 27), fill="#a5a0a1")
    d.line((7, 23, 8, 22, 8, 24), fill="#494253" if frame == 0 else "#d28c59")
    d.polygon([(1, 15), (14, 15), (13, 19), (10, 21), (5, 21), (2, 19)], fill="#343442")
    d.line((3, 18, 5, 20, 10, 20), fill="#73717b")
    d.line((11, 17, 11, 19), fill="#514a57")
    d.line((1, 15, 14, 15), fill="#a5a0a1")
    d.line((3, 16, 12, 16), fill="#292934")
    if frame:
        flame(im, 8, 14, frame - 1, small=True)
        d.line((4, 15, 11, 15), fill="#d28c59")
        d.point((5, 16), fill="#f1b76e")
    else:
        d.line((4, 14, 6, 13, 8, 14, 10, 13, 12, 14), fill="#514a57")
        d.point((6, 13), fill="#a5a0a1")
        d.point((10, 14), fill="#73717b")
    return im


def sound(on):
    im = canvas(14, 14)
    d = ImageDraw.Draw(im)
    edge, ivory, shade = "#343442", "#eee5ce", "#b9b5b1"
    shape = [(0, 5), (3, 5), (6, 2), (7, 2), (7, 11), (6, 11), (3, 8), (0, 8)]
    layer_polygon(im, shape, ivory, edge)
    d.line((1, 6, 3, 6), fill=ivory)
    d.line((5, 4, 6, 3, 6, 9), fill=ivory)
    d.point((5, 9), fill=shade)
    if on:
        for points in [[(8, 4), (9, 5), (9, 8), (8, 9)], [(10, 2), (12, 4), (12, 9), (10, 11)]]:
            d.line(points, fill=edge, width=3)
            d.line(points, fill=ivory, width=1)
    else:
        d.line((9, 5, 12, 9), fill=edge, width=3)
        d.line((12, 5, 9, 9), fill=edge, width=3)
        d.line((9, 5, 12, 9), fill="#cd8585")
        d.line((12, 5, 9, 9), fill="#cd8585")
        d.point((9, 5), fill="#edb0a6")
    return im


def save(name, frames, level, palette_limit=48):
    w, h = frames[0].size
    sheet = canvas(w * len(frames), h)
    for i, f in enumerate(frames):
        assert f.size == (w, h)
        assert f.getchannel("A").getextrema() == (0, 255)
        assert set(f.getchannel("A").get_flattened_data()) <= {0, 255}, "No soft pixel edges"
        if not name.startswith("icon_"):
            assert f.getchannel("A").crop((0, h - 1, w, h)).getbbox(), "Floating ground anchor"
        sheet.alpha_composite(f, (i * w, 0))
    colors = sheet.getcolors(10000)
    assert colors and len(colors) <= palette_limit, (name, len(colors or []))
    sheet.save(OUT / name, optimize=True)
    MANIFEST[name] = {
        "frameWidth": w, "frameHeight": h, "frames": len(frames),
        "layout": "horizontal", "margin": 0, "spacing": 0,
        "origin": {"x": 0.5, "y": 0.5 if name.startswith("icon_") else 1.0},
        "background": level, "filter": "nearest", "paletteColors": len(colors),
        "source": {"kind": "procedural", "path": "tools/gen_props.py", "seed": 31},
        "license": "Original project artwork; no third-party asset inputs.",
        "technical_checks_passed": True,
    }
    return sheet


def background(level):
    # Level4IF/10 is already the flattened set; far.png is the distant composite.
    if level == "Level4IF":
        return Image.open(BG / level / "10.png").convert("RGBA")
    base = canvas(576, 324)
    for path in sorted((BG / level).glob("*.png")):
        base.alpha_composite(Image.open(path).convert("RGBA"))
    return base


def preview():
    """Context contact sheet: every frame, 3x nearest, genuine level crops."""
    sheet = Image.new("RGB", (1440, 1210), "#1c1d29")
    d = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=15)
    d.text((22, 15), "EL PACTO DE HIARETH  /  PROPS  /  3x NEAREST", font=font, fill="#eee5ce")

    def panel(name, title, level, crop, xy, frame=0, base=None, placement=None):
        info = MANIFEST[name]
        w, h = info["frameWidth"], info["frameHeight"]
        sprite = Image.open(OUT / name).crop((frame * w, 0, (frame + 1) * w, h))
        scene = background(level).crop(crop) if base is None else base.copy()
        sx, sy = placement or ((scene.width - w) // 2, scene.height - h - 5)
        scene.alpha_composite(sprite, (sx, sy))
        x, y = xy
        d.text((x, y), title, fill="#d5ced8", font=font)
        sheet.paste(scene.convert("RGB").resize((scene.width * 3, scene.height * 3), NEAREST), (x, y + 25))

    panel("goal_house.png", "LIMBO / refugio - 110x100", "Level3", (328, 140, 484, 257), (22, 52), placement=(23, 17))
    panel("goal_sign.png", "ACTO I / madera y musgo - 44x60", "Level1", (210, 205, 322, 322), (516, 52), placement=(34, 57))
    panel("goal_camp.png", "ACTO IV / lona, nieve y fuego - 100x60", "Level4IF", (170, 215, 350, 324), (876, 52), placement=(40, 49))
    for i in range(4):
        panel("goal_portal.png", f"ACTO II / portal {i + 1}", "Level2", (270, 204, 378, 312), (22 + i * 354, 452), frame=i)
    for i in range(4):
        panel("goal_camp.png", f"CAMPAMENTO / llama {i + 1}", "Level4IF", (220, 249, 328, 324), (22 + i * 354, 818), frame=i)
    # Ground a row of all five checkpoint states on both contrasting contexts.
    for col, color in enumerate(["#c5cace", "#312b3b"]):
        x0, y0 = 22 + col * 708, 1108
        d.text((x0, y0 - 24), "CHECKPOINT 0-4 + SONIDO / " + ("CLARO" if col == 0 else "OSCURO"), fill="#d5ced8", font=font)
        row = Image.new("RGBA", (228, 31), color)
        cp = Image.open(OUT / "checkpoint.png")
        for f in range(5):
            row.alpha_composite(cp.crop((f * 16, 0, f * 16 + 16, 30)), (8 + 28 * f, 1))
        for j, name in enumerate(["icon_sound_on.png", "icon_sound_off.png"]):
            row.alpha_composite(Image.open(OUT / name), (165 + j * 30, 9))
        sheet.paste(row.convert("RGB").resize((684, 93), NEAREST), (x0, y0))
    sheet.save(ROOT / "tools/props_preview.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    save("goal_house.png", [house()], "Level3")
    save("goal_sign.png", [sign()], "Level1")
    save("goal_portal.png", [portal(f) for f in range(4)], "Level2")
    save("goal_camp.png", [camp(f) for f in range(4)], "Level4IF")
    save("checkpoint.png", [checkpoint(f) for f in range(5)], "neutral")
    save("icon_sound_on.png", [sound(True)], "UI", 8)
    save("icon_sound_off.png", [sound(False)], "UI", 8)
    (OUT / "props.json").write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    preview()
    for name, info in MANIFEST.items():
        print(f"{name}: {info['frameWidth']}x{info['frameHeight']} x {info['frames']} frames; {info['paletteColors']} colors")
    print("Preview: tools/props_preview.png")


if __name__ == "__main__":
    main()
