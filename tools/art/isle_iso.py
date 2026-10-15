"""The island screen's isometric art (assets/future/isle_iso/HANDOFF_PROMPT.md §3): the four maps and the 43 building
sheets, cut and baked into assets/isle/ and registered in assets/manifest.json as `isle.map.<kind>` and
`isle.<id>.<stage>`.

    python tools/art/isle_iso.py            # bake everything (runs at below-normal priority)
    python tools/art/isle_iso.py hall mine  # only these sheets
    python tools/art/isle_iso.py --sheet out.png   # a contact sheet of the baked cells, for a look

Each sheet is 4 x 2 cells on flat magenta: s0 (the plot marked out), s1 (the frame in scaffolding), l1..l5, up (level
3 in scaffolding). The cells are not cut on a grid: the sheet is keyed (process.py chroma_key) and its shapes found
whole; a shape is the cell its plate's bottom stands in, and the small bits (smoke, a flag) join the nearest shape.
Every cell is scaled so one cell of its plot's diamond is UNIT px wide, and its anchor is the diamond's bottom
vertex — written into the manifest entry as `anchor: [x, y]` in the baked file's pixels, with `foot` its plot.
"""

import ctypes
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
from process import chroma_key, clean_alpha, save  # noqa: E402
from register import write_manifest  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ASSETS = os.path.join(ROOT, 'assets')
SRC = os.path.join(ASSETS, 'future', 'isle_iso')
OUT = os.path.join(ASSETS, 'isle')
MANIFEST = os.path.join(ASSETS, 'manifest.json')

STAGES = ['s0', 's1', 'l1', 'l2', 'l3', 'l4', 'l5', 'up']
MAPS = ['temperate', 'volcanic', 'ice', 'jungle']
# One cell of a plot's diamond in the baked file (a 3 x 3 plot about 256 px wide, the brief's phone size).
UNIT = 86
FOOT4 = {'hall', 'keep', 'fort', 'dry_dock'}
FOOT2 = {'battery', 'residents_house', 'smokehouse', 'lighthouse', 'signal_tower', 'chart_house', 'smuggler_store'}
# The sheets whose chimneys smoke (the magenta shows through the smoke): its faint part is cleared harder.
SMOKY = {'dw4', 'tar', 'smokehouse', 'distillery', 'forge', 'try_works', 'powder_mill'}


def foot(sid):
    return 4 if sid in FOOT4 else 2 if sid in FOOT2 else 3


def below_normal():
    try:
        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x4000)
    except Exception:
        pass


def shapes(alpha):
    """The sheet's eight shapes: each the cell its bottom stands in, the small bits joined to the nearest."""
    solid = alpha > 24
    lab, n = ndimage.label(ndimage.binary_closing(solid, iterations=2))
    if n == 0:
        return {}
    H, W = alpha.shape
    cw, ch = W / 4, H / 2
    # Neighbours touching (smoke, a crane's rope): a shape wider than a cell is cut at its emptiest column near each
    # cells' line it spans.
    for _ in range(12):
        wide = [(k, xs) for k, b in enumerate(ndimage.find_objects(lab)) if b is not None for xs in [b[1]] if xs.stop - xs.start > 1.2 * cw]
        if not wide:
            break
        k, xs = wide[0]
        lines = [m * cw for m in (1, 2, 3) if xs.start + 0.25 * cw < m * cw < xs.stop - 0.25 * cw]
        if not lines:
            break
        line = lines[0]
        lo, hi = int(line - 70), int(line + 70)
        cols = (lab[:, lo:hi] == k + 1).sum(0)
        cut = lo + int(np.argmin(cols))
        n += 1
        right = lab == k + 1
        right[:, :cut] = False
        lab[right] = n
        print(f'  two shapes touched: split at x {cut}')
    idx = range(1, n + 1)
    sizes = np.asarray(ndimage.sum(np.ones_like(lab), lab, idx))
    boxes = ndimage.find_objects(lab)
    cells = {}
    small = []
    for k in range(n):
        if sizes[k] < 4000:
            small.append(k)
            continue
        ys, xs = boxes[k]
        m = lab[ys, xs] == k + 1
        rows = np.nonzero(m.any(1))[0]
        yb = ys.start + rows.max()
        xb = xs.start + np.nonzero(m[rows.max()])[0].mean()
        c = int(min(3, xb // cw)) + 4 * int(min(1, (yb - 4) // ch))
        cells.setdefault(c, []).append(k)
    # the bits: to the shape whose box (widened) holds them, else dropped
    for k in small:
        if sizes[k] < 30:
            continue
        ys, xs = boxes[k]
        cy, cx = (ys.start + ys.stop) / 2, (xs.start + xs.stop) / 2
        best, bd = None, 1e9
        for c, ks in cells.items():
            for q in ks:
                by, bx = boxes[q]
                dx = max(bx.start - cx, 0, cx - bx.stop)
                dy = max(by.start - cy, 0, cy - by.stop)
                d = dx + dy
                if d < bd:
                    best, bd = c, d
        if best is not None and bd < 40:
            cells[best].append(k)
    out = {}
    for c, ks in cells.items():
        out[c] = np.isin(lab, [k + 1 for k in ks])
    return out


def diamond(mask):
    """The plate's diamond in a cell's mask: its width, the x of its middle and the y of its bottom vertex."""
    rows = np.nonzero(mask.sum(1) >= 3)[0]
    yb = rows.max()
    best, bx, flat = 0, None, 0
    for d in range(0, 320):
        y = yb - d
        if y < 0:
            break
        xs = np.nonzero(mask[y])[0]
        flat += 1
        if len(xs) >= 2:
            w = xs.max() - xs.min()
            if w > best + 1:
                flat = 0
            if w > best:
                best, bx = w, (xs.max() + xs.min()) / 2
        # past the side vertices the width stops growing (the plates are not all drawn at 2:1)
        if flat > 18 and d > 30:
            break
    return best, bx, yb


def bake_sheet(sid, man):
    src = os.path.join(SRC, f'isle_{sid}.png')
    img = Image.open(src)
    img.load()
    keyed = chroma_key(img, np.array([255, 0, 255], np.float32))
    a = np.asarray(keyed).copy()
    if sid in SMOKY:
        # the smoke's faint, pink-tinted veil goes; its denser part stays
        al = a[..., 3].astype(np.float32)
        a[..., 3] = np.clip((al - 70) * (255 / 185), 0, 255).astype(np.uint8)
    keyed = clean_alpha(Image.fromarray(a, 'RGBA'))
    alpha = np.asarray(keyed.getchannel('A'))
    cells = shapes(alpha)
    if len(cells) != 8:
        print(f'{sid}: {len(cells)} shapes, not 8 (cells {sorted(cells)})')
    f = foot(sid)
    notes = []
    found = {}
    for c in cells:
        m = cells[c]
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        found[c] = diamond(alpha[y0:y1, x0:x1] * m[y0:y1, x0:x1] > 128)
    med = float(np.median([w for w, _, _ in found.values()]))
    for c, stage in enumerate(STAGES):
        if c not in cells:
            continue
        m = cells[c]
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        piece = np.asarray(keyed)[y0:y1, x0:x1].copy()
        piece[..., 3] = np.where(m[y0:y1, x0:x1], piece[..., 3], 0)
        w, cx, yb = found[c]
        if abs(w - med) > 0.1 * med:
            notes.append('!')
            w = med
        k = f * UNIT / max(1, w)
        im = Image.fromarray(piece, 'RGBA')
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        aid = f'isle.{sid}.{stage}'
        local = f'isle/{sid}_{stage}.webp'
        save(im, os.path.join(ASSETS, local), 86)
        man['assets'][aid] = {
            'local': local,
            'remote': f'future/isle_iso/isle_{sid}.png',
            'fit': f'isle:{f}',
            'anchor': [round(cx * k), round(yb * k)],
            'foot': f,
            'rev': 20261015,
        }
        notes.append(f'{stage}:{w}')
    print(f'{sid:18s} foot {f}  diamond widths ' + ' '.join(notes))


def bake_map(kind, man):
    img = Image.open(os.path.join(SRC, f'isle_map_{kind}.png')).convert('RGB')
    local = f'isle/map_{kind}.jpg'
    save(img, os.path.join(ASSETS, local), 80)
    man['assets'][f'isle.map.{kind}'] = {'local': local, 'remote': f'future/isle_iso/isle_map_{kind}.png', 'fit': 'opaque:1536', 'rev': 20261015}
    print(f'map {kind}: {img.width}x{img.height} {os.path.getsize(os.path.join(ASSETS, local)) // 1024}KB')


def contact(out):
    man = json.load(open(MANIFEST, encoding='utf-8'))
    ids = [i for i in man['assets'] if i.startswith('isle.') and not i.startswith('isle.map.')]
    cell = 200
    cols = 8
    rows = (len(ids) + cols - 1) // cols
    canvas = Image.new('RGB', (cols * cell, rows * cell), (40, 46, 52))
    from PIL import ImageDraw
    d = ImageDraw.Draw(canvas)
    for n, aid in enumerate(ids):
        e = man['assets'][aid]
        im = Image.open(os.path.join(ASSETS, e['local'])).convert('RGBA')
        k = 0.42
        ax, ay = e['anchor']
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))))
        x, y = (n % cols) * cell, (n // cols) * cell
        bx, by = x + cell // 2, y + cell - 22
        canvas.paste(im, (round(bx - ax * k), round(by - ay * k)), im)
        hw = e['foot'] * UNIT * k / 2
        d.line([(bx - hw, by - hw / 2), (bx, by), (bx + hw, by - hw / 2)], fill=(0, 255, 255))
        d.text((x + 3, y + cell - 14), aid[5:], fill=(230, 220, 200))
    canvas.save(out)
    print(f'contact: {len(ids)} -> {out}')


def main(argv):
    below_normal()
    if argv[:1] == ['--sheet']:
        return contact(argv[1])
    os.makedirs(OUT, exist_ok=True)
    man = json.load(open(MANIFEST, encoding='utf-8'))
    sheets = sorted(f[5:-4] for f in os.listdir(SRC) if f.startswith('isle_') and f.endswith('.png') and not f.startswith('isle_map_'))
    only = [a for a in argv if not a.startswith('--')]
    for sid in sheets:
        if only and sid not in only:
            continue
        bake_sheet(sid, man)
    if not only:
        for kind in MAPS:
            bake_map(kind, man)
    write_manifest(man)


if __name__ == '__main__':
    main(sys.argv[1:])
