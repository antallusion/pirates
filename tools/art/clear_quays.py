"""Clear the boats painted between the piers of the port paintings (the quays at the image's foot).

Ships in port are the game's own sprites at the true scale; the painted boats were larger than a frigate. Down every
column of the foot, from the quay line, what hangs on to the quay without a break (the quay wall, a pier) is kept, and
everything after the first stretch of open water (a boat, a carcass, a buoy) is cleared. The originals are kept in
assets/raw/port_orig/. process.py runs this after baking a port, so a re-bake never brings the boats back.

    python tools/art/clear_quays.py            # all seven factions
    python tools/art/clear_quays.py crown      # one
"""

import os
import shutil
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
FACTIONS = ['crown', 'league', 'confederacy', 'harpoon', 'brokers', 'choir', 'free']
QUAY = 0.735  # where the renderer's foot slice begins
SOLID = 40  # alpha at or above: part of the quay
GAP = 4  # open water this many pixels long ends the quay in a column
# Where a painting moors its boats end to end with the walkways, the walkways end here (a share of the height).
PIER_END = {'brokers': 0.815}


def clear(path: str, faction: str, fresh: bool = False) -> None:
    orig_dir = os.path.join(ROOT, 'assets', 'raw', 'port_orig')
    os.makedirs(orig_dir, exist_ok=True)
    orig = os.path.join(orig_dir, os.path.basename(path))
    if fresh or not os.path.exists(orig):
        shutil.copyfile(path, orig)
    im = Image.open(orig).convert('RGBA')
    a = np.array(im)
    h, w = a.shape[:2]
    y0 = int(h * QUAY)
    alpha = a[:, :, 3]
    # Down every column from the quay line: how far the quay holds without a break.
    run = np.zeros(w, dtype=int)
    for x in range(w):
        col = alpha[y0:, x] >= SOLID
        gap = 0
        end = len(col)
        for i, solid in enumerate(col):
            if solid:
                gap = 0
                continue
            gap += 1
            if gap >= GAP:
                end = i - gap + 1
                break
        run[x] = end
    if faction in PIER_END:
        run = np.minimum(run, int(h * PIER_END[faction]) - y0)
    top = int(run.max())
    short = run[(run > 0) & (run < top * 0.5)]
    wall = int(np.median(short)) if len(short) else 0
    # The piers: columns that reach well past the wall, grouped in bands; a band much wider than the rest carries a
    # boat alongside, and keeps only its deepest pier-wide window.
    pier = run >= wall + 0.35 * (top - wall)
    bands = []
    x = 0
    while x < w:
        if pier[x]:
            s0 = x
            while x < w and pier[x]:
                x += 1
            bands.append((s0, x))
        else:
            x += 1
    widths = sorted(e - s0 for s0, e in bands if e - s0 >= w * 0.02) or sorted(e - s0 for s0, e in bands)
    wmed = widths[len(widths) // 2] if widths else 0
    cols = np.zeros(w, dtype=bool)
    for s0, e in bands:
        # A ship moored at a quay stub: her band comes to a point (a bow), where a pier ends square.
        deep = run[s0:e].max()
        if (run[s0:e] >= deep * 0.92).mean() < 0.4:
            continue
        # A mast, a pole, a mooring line: too thin to be a pier.
        if wmed and e - s0 < 0.4 * wmed:
            continue
        if wmed and e - s0 > 1.4 * wmed:
            best, at = -1, s0
            for k in range(s0, e - wmed + 1):
                v = int(run[k:k + wmed].sum())
                if v > best:
                    best, at = v, k
            s0, e = at, at + wmed
        cols[s0:e] = True
    # The slips between the kept piers (their middle, as a share of the width) and how deep they run (as a share of
    # the height below the quay line): where the Floating Bazaar's moored shadows lie (docs/12 P10 #19).
    kept = [x for x in range(w) if cols[x]]
    groups = []
    for x in kept:
        if groups and x - groups[-1][1] <= 1:
            groups[-1][1] = x
        else:
            groups.append([x, x])
    global SLIPS
    SLIPS = []
    for (a0, a1), (b0, b1) in zip(groups, groups[1:]):
        depth = min(run[a0:a1 + 1].max(), run[b0:b1 + 1].max()) - wall
        if 8 < b0 - a1 < w * 0.3 and depth > 8:
            SLIPS.append([round((a1 + b0) / 2 / w, 4), round((b0 - a1) / w, 4), round((y0 + wall) / h, 4), round(float(depth) / h, 4)])
    keep = np.zeros((h, w), dtype=bool)
    keep[:y0 + wall + 2, :] = True
    for x in range(w):
        if cols[x]:
            keep[y0:y0 + run[x], x] = True
        else:
            keep[y0:y0 + min(run[x], wall + 2), x] = True
    # Soften the cut: a pixel's alpha falls off over two pixels past the kept run.
    mask = keep.astype(np.float32)
    soft = mask.copy()
    for dy in (1, 2):
        shifted = np.zeros_like(mask)
        shifted[dy:, :] = mask[:-dy, :]
        soft = np.maximum(soft, shifted * (1 - dy / 3))
    a[:, :, 3] = (alpha.astype(np.float32) * soft).clip(0, 255).astype(np.uint8)
    Image.fromarray(a).save(path, 'WEBP', quality=92, method=6)
    print('cleared', path)


SLIPS: list = []


def main() -> None:
    names = sys.argv[1:] or FACTIONS
    sys.path.insert(0, os.path.dirname(__file__))
    from register import MANIFEST, write_manifest
    import json
    with open(MANIFEST, encoding='utf-8') as fh:
        m = json.load(fh)
    for f in names:
        clear(os.path.join(ROOT, 'assets', 'props', f'port_{f}.webp'), f)
        # The slips: [middle x, width, top y, depth] as shares of the painting.
        m['assets'][f'prop.port_{f}']['slips'] = SLIPS
        print(f, SLIPS)
    write_manifest(m)


if __name__ == '__main__':
    main()
