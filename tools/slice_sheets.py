#!/usr/bin/env python3
"""Deterministically extract the supplied JPEG character sheets (Pillow + NumPy).

Run from any directory with tools/.venv/bin/python tools/slice_sheets.py.
Only the three sprite directories, slice_report.json and slice_preview.png are written.
Background colour is measured, alpha is colour-distance keyed and decontaminated,
and animation anchors use the character body rather than detached visual effects.
"""
from collections import Counter
from pathlib import Path
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "El pacto de hiareth utils/Sprites/Characters"
OUT = ROOT / "public/assets/sprites"
STATES = ("walk", "attack", "idle", "hurt", "death")


def runs(values):
    padded = np.r_[False, values, False].astype(np.int8)
    return list(zip(np.flatnonzero(np.diff(padded) == 1),
                    np.flatnonzero(np.diff(padded) == -1)))


def components(mask):
    """8-connected run-length union-find; no scipy dependency."""
    parent, spans, previous = [], [], []

    def find(n):
        while parent[n] != n:
            parent[n] = parent[parent[n]]
            n = parent[n]
        return n

    for y, row in enumerate(mask):
        current = []
        j = 0
        for x0, x1 in runs(row):
            n = len(parent)
            parent.append(n)
            spans.append((y, int(x0), int(x1)))
            current.append(n)
            while j < len(previous) and spans[previous[j]][2] < x0:
                j += 1
            k = j
            while k < len(previous) and spans[previous[k]][1] <= x1:
                parent[find(previous[k])] = find(n)
                k += 1
        previous = current
    groups = {}
    for n, span in enumerate(spans):
        groups.setdefault(find(n), []).append(span)
    result = []
    for group in groups.values():
        size = sum(x1 - x0 for y, x0, x1 in group)
        bbox = (min(s[1] for s in group), group[0][0],
                max(s[2] for s in group), group[-1][0] + 1)
        result.append({"area": size, "bbox": bbox, "runs": group})
    return sorted(result, key=lambda c: c["area"], reverse=True)


def measured_background(rgb):
    # The modal triplet is unaffected by labels, figures or sparse particles.
    sample = rgb[::6, ::6].reshape(-1, 3)
    return np.array(Counter(map(tuple, sample)).most_common(1)[0][0], dtype=float)


def make_matte(rgb, bg, boss=False):
    distance = np.linalg.norm(rgb.astype(float) - bg, axis=2)
    # The boss's dark robe needs a substantially tighter key than the pale sheets.
    lo, hi = (8.0, 23.0) if boss else (13.0, 38.0)
    t = np.clip((distance - lo) / (hi - lo), 0, 1)
    alpha = t * t * (3 - 2 * t)
    # Reject isolated JPEG ringing; retain even small genuine sparks/embers.
    support = np.zeros(distance.shape, dtype=bool)
    for c in components(distance > hi):
        if c["area"] >= (3 if boss else 5):
            for y, x0, x1 in c["runs"]:
                support[y, x0:x1] = True
    support = np.array(Image.fromarray(support).filter(ImageFilter.MaxFilter(5)))
    alpha *= support
    return rgba_from_alpha(rgb, bg, alpha), distance


def rgba_from_alpha(rgb, bg, alpha):
    # Remove the old matte colour from partial alpha rather than retaining a halo.
    colour = (rgb.astype(float) - (1 - alpha[..., None]) * bg) / np.maximum(
        alpha[..., None], 1 / 255)
    result = np.dstack((np.clip(colour, 0, 255), np.rint(alpha * 255))).astype(np.uint8)
    result[result[..., 3] == 0, :3] = 0
    return result


def restore_interiors(rgb, alpha, bg, body, boss=False):
    """Preserve flat grey faces and dark robe folds enclosed by the silhouette.

    Exterior background stays transparent. Large enclosed gaps below a mob's
    head (between arms/legs and shadows) must remain transparent as well.
    """
    kernel = 5 if boss else 3
    silhouette = Image.fromarray(alpha > .35).filter(ImageFilter.MaxFilter(kernel)) \
        .filter(ImageFilter.MinFilter(kernel))
    closed = np.array(silhouette)
    # Dark one-pixel seams are part of the robe, including seams which connect
    # to the exterior. Closing alone is not enough: restore its interior pixels.
    interior = np.array(silhouette.filter(ImageFilter.MinFilter(3)))
    alpha[interior] = 1
    head_limit = body[1] + .55 * (body[3] - body[1])
    for hole in components(~closed):
        x0, y0, x1, y1 = hole["bbox"]
        if x0 == 0 or y0 == 0 or x1 == alpha.shape[1] or y1 == alpha.shape[0]:
            continue
        should_fill = hole["area"] <= (180 if boss else 90)
        if not boss and (y0 + y1) / 2 < head_limit:
            should_fill = True
        if should_fill:
            for y, left, right in hole["runs"]:
                alpha[y, left:right] = 1
    return rgba_from_alpha(rgb, bg, alpha)


def row_edges(distance):
    projection = (distance[:, 465:] > 45).sum(axis=1)
    edges = [0]
    for expected in np.linspace(0, distance.shape[0], 6)[1:-1]:
        low, high = int(expected - 65), int(expected + 65)
        gaps = runs(projection[low:high] < 30)
        if gaps:
            a, b = max(gaps, key=lambda pair: pair[1] - pair[0])
            edges.append(low + (a + b) // 2)
        else:
            edges.append(int(expected))
    return edges + [distance.shape[0]]


def body_groups(distance, count, boss=False):
    mask = distance > (30 if boss else 45)
    candidates = components(mask)
    # Merge horizontal projection islands: a smoke plume and its bones are ONE
    # death frame, even when no individual bone is a large connected component.
    bodies = []
    if not boss:
        islands = sorted((c for c in candidates if c["area"] >= 20), key=lambda c: c["bbox"][0])
        for c in islands:
            if bodies and c["bbox"][0] <= bodies[-1]["bbox"][2] + 22:
                group = bodies[-1]
                a, b = group["bbox"], c["bbox"]
                group["bbox"] = (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))
                group["area"] += c["area"]
                group["runs"].extend(c["runs"])
            else:
                bodies.append({"area": c["area"], "bbox": c["bbox"], "runs": list(c["runs"])})
        bodies = [c for c in bodies if c["area"] > 700]
    else:
        bodies = [c for c in candidates if c["area"] > 700 and
                  c["bbox"][3] - c["bbox"][1] > 38]
        bodies = sorted(bodies[:count], key=lambda c: c["bbox"][0])
    if len(bodies) != count:
        # Uniform grid is only a fallback; extract its largest real component.
        occupied = np.flatnonzero(mask.sum(axis=0) > 5)
        if not len(occupied):
            raise ValueError("No foreground detected")
        edges = np.linspace(occupied[0], occupied[-1] + 1, count + 1).astype(int)
        bodies = []
        for left, right in zip(edges[:-1], edges[1:]):
            c = components(mask[:, left:right])[0]
            c["bbox"] = tuple(v + left if i % 2 == 0 else v
                              for i, v in enumerate(c["bbox"]))
            c["runs"] = [(y, x0 + left, x1 + left) for y, x0, x1 in c["runs"]]
            bodies.append(c)
    return bodies


def body_anchor(body, boss=False):
    # Projection groups identify cells, but only the largest connected figure
    # defines the pivot; detached smoke/particles cannot pull it sideways.
    x0, y0, x1, y1 = body["bbox"]
    local = np.zeros((y1 - y0, x1 - x0), dtype=bool)
    for y, left, right in body["runs"]:
        local[y - y0, left - x0:right - x0] = True
    largest = components(local)[0]
    if largest["area"] < 2000:
        # Final scattered bones have no single body component; use their cluster.
        return (x0 + x1) / 2
    body = {"bbox": (largest["bbox"][0] + x0, largest["bbox"][1] + y0,
                     largest["bbox"][2] + x0, largest["bbox"][3] + y0),
            "runs": [(y + y0, left + x0, right + x0) for y, left, right in largest["runs"]]}
    x0, y0, x1, y1 = body["bbox"]
    height = y1 - y0
    # Upper-middle body avoids boards, shadows, hands and floating effects.
    a, b = ((.40, .69) if boss else (.20, .55))
    band = [(left, right) for y, left, right in body["runs"]
            if y0 + a * height <= y <= y0 + b * height]
    if not boss:
        rows = {}
        for y, left, right in body["runs"]:
            if y0 + a * height <= y <= y0 + b * height:
                l, r = rows.get(y, (left, right))
                rows[y] = (min(l, left), max(r, right))
        if rows:
            return float(np.median([(l + r) / 2 for l, r in rows.values()]))
    weights = np.zeros(x1 - x0, dtype=int)
    for left, right in band:
        weights[left - x0:right - x0] += 1
    if not weights.sum():
        return (x0 + x1) / 2
    return float(x0 + np.searchsorted(np.cumsum(weights), weights.sum() / 2))


def extract_frames(rgba, distance, rgb, bg, count, origin_y, boss=False):
    bodies = body_groups(distance, count, boss)
    centers = [body_anchor(c, boss) for c in bodies]
    # Midpoints in the gaps divide whole effects with their nearest character.
    edges = [0] + [round((a + b) / 2) for a, b in zip(centers[:-1], centers[1:])]
    edges += [rgba.shape[1]]
    # Move midpoint cuts into actual projection gaps. A long laser or a raised
    # weapon can cross the nominal midpoint and must never be split into two cells.
    occupancy = (rgba[..., 3] > 16).sum(axis=0)
    safe = np.maximum.reduce([np.roll(occupancy, offset) for offset in range(-2, 3)])
    for i in range(1, len(edges) - 1):
        target = edges[i]
        low, high = max(edges[i - 1] + 1, target - 40), min(rgba.shape[1] - 1, target + 41)
        candidates = np.arange(low, high)
        values = safe[low:high]
        best = candidates[values == values.min()]
        edges[i] = int(best[np.argmin(abs(best - target))])
    frames = []
    for i, (left, right) in enumerate(zip(edges[:-1], edges[1:])):
        tile = Image.fromarray(rgba[:, left:right])
        bbox = tile.getbbox()
        if not bbox:
            raise ValueError(f"Empty frame {i}")
        raw = rgb[bbox[1]:bbox[3], left + bbox[0]:left + bbox[2]]
        alpha = np.array(tile.crop(bbox).getchannel("A"), dtype=float) / 255
        # Use the principal connected body for head location, excluding its shadow.
        principal = components(distance[:, left:right] > (30 if boss else 45))[0]
        body = principal["bbox"]
        body = (body[0] - bbox[0], body[1] - bbox[1], body[2] - bbox[0], body[3] - bbox[1])
        cutout = Image.fromarray(restore_interiors(raw, alpha, bg, body, boss))
        frames.append({"image": cutout, "anchor": centers[i] - left - bbox[0],
                       "source_bbox": [int(left + bbox[0]), int(origin_y + bbox[1]),
                                       int(left + bbox[2]), int(origin_y + bbox[3])],
                       "body_bbox": list(bodies[i]["bbox"])})
    return frames


def export_character(name, source_name, counts, size):
    source = next(SOURCES.rglob(source_name))
    rgb = np.array(Image.open(source).convert("RGB"))
    bg = measured_background(rgb)
    boss = name == "boss"
    rgba, distance = make_matte(rgb, bg, boss)
    states = {}
    if boss:
        # Numbers end near y=240; the highest antlers begin at y=255.
        top, bottom = 250, 880
        states["idle"] = extract_frames(rgba[top:bottom], distance[top:bottom], rgb[top:bottom], bg, 8, top, True)
    else:
        edges = row_edges(distance)
        # Exclude all black labels before component detection and effect assignment.
        rgba[:, :465] = 0
        distance[:, :465] = 0
        for state, n, top, bottom in zip(STATES, counts, edges[:-1], edges[1:]):
            states[state] = extract_frames(rgba[top:bottom], distance[top:bottom], rgb[top:bottom], bg, n, top)
    all_frames = [f for frames in states.values() for f in frames]
    width, height = size
    max_height = max(f["image"].height for f in all_frames)
    max_side = max(max(f["anchor"], f["image"].width - f["anchor"]) for f in all_frames)
    scale = np.floor(min(1, (height - 16) / max_height,
                         (width - 16) / (2 * max_side)) * 10000) / 10000
    report, previews = {}, []
    (OUT / name).mkdir(parents=True, exist_ok=True)
    for state, frames in states.items():
        strip = Image.new("RGBA", (width * len(frames), height))
        diagnostics = []
        for i, frame in enumerate(frames):
            im = frame["image"]
            scaled = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.NEAREST)
            # Nearest-neighbour reduction can discard an outermost faint row.
            # Trim after resizing so the actual alpha base is identical in every cell.
            scaled_bbox = scaled.getbbox()
            x = round(width / 2 - frame["anchor"] * scale) + scaled_bbox[0]
            scaled = scaled.crop(scaled_bbox)
            y = height - 8 - scaled.height
            assert x >= 0 and y >= 0 and x + scaled.width <= width, (name, state, i)
            strip.paste(scaled, (i * width + x, y))
            alpha = np.array(scaled.getchannel("A"))
            assert np.count_nonzero(alpha > 128) > 20, (name, state, i, "empty")
            diagnostics.append({"source_bbox": frame["source_bbox"], "body_anchor_x": frame["anchor"],
                                "opaque_pixels": int(np.count_nonzero(alpha > 128))})
        relative = f"{name}/{state}.png"
        strip.save(OUT / relative)
        report[relative] = {"frames": len(frames), "frame_size": list(size), "scale": float(scale),
                            "baseline_y": height - 8, "background_rgb": bg.astype(int).tolist(),
                            "source": str(source.relative_to(ROOT)), "frame_details": diagnostics}
        previews.append((relative, strip, size))
    print(f"{name}: background={bg.astype(int).tolist()}, scale={scale}, frames="
          + str({state: len(frames) for state, frames in states.items()}))
    return report, previews


def main():
    report, strips = {}, []
    for args in [("alien", "Sprites_Aliens_Full.jpg", (9, 9, 6, 3, 7), (256, 256)),
                 ("skeleton", "Sprites_Skeletons_Full.jpg", (9, 9, 6, 4, 7), (256, 256)),
                 ("boss", "Morriganus_IDLE_SPRITE.jpg", (8,), (352, 608))]:
        r, p = export_character(*args)
        report.update(r)
        strips.extend(p)
    (OUT / "slice_report.json").write_text(json.dumps(report, indent=2) + "\n")
    # Every complete strip appears, with cell boundaries and a strong alpha-test backdrop.
    preview = Image.new("RGB", (max(im.width for _, im, _ in strips),
                               sum(im.height + 30 for _, im, _ in strips)), "#ff00ff")
    draw = ImageDraw.Draw(preview)
    y = 0
    for label, strip, size in strips:
        draw.rectangle((0, y, preview.width, y + 29), fill="#202020")
        draw.text((8, y + 7), f"{label} | {strip.width // size[0]} frames | {size[0]}x{size[1]}", fill="white")
        y += 30
        preview.paste(strip, (0, y), strip)
        for x in range(0, strip.width, size[0]):
            draw.line((x, y, x, y + size[1] - 1), fill="#920092")
        y += size[1]
    preview.save(ROOT / "tools/slice_preview.png")
    print("Wrote 11 strips, slice_report.json and tools/slice_preview.png")


if __name__ == "__main__":
    main()
