"""Cut a painted sheet of twelve flags (4 columns × 3 rows on flat magenta) into flag.fNN assets and register them.

    python tools/art/slice_flags.py <sheet letter a..e> <higgsfield stem hf_..._<job>>

Sheet a holds flags 0–11, b 12–23 … e 48–59, f the holidays' four 60–63 in a 2×2 grid (shared/src/data/looks.ts
FLAGS, in reading order). The magenta is keyed
out (with its fringe), every flag is found as a large connected shape, trimmed, and set on a 240×160 (3:2) transparent
canvas so the whole set sits the same way in the editor and at the masthead.
"""

import json
import os
import sys
import urllib.request

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW = os.path.join(ROOT, 'assets', 'raw')
OUT = os.path.join(ROOT, 'assets', 'flags')
sys.path.insert(0, os.path.dirname(__file__))
from register import MANIFEST, write_manifest  # noqa: E402

W, H = 240, 160


def fetch(stem: str, cdn: str) -> str:
    p = os.path.join(RAW, stem + '.png')
    if not os.path.exists(p):
        req = urllib.request.Request(cdn + stem + '.png', headers={'User-Agent': 'gravetide-art'})
        with urllib.request.urlopen(req, timeout=120) as r, open(p, 'wb') as f:
            f.write(r.read())
    return p


def key_magenta(a: np.ndarray) -> np.ndarray:
    """Alpha from the distance to pure magenta; the magenta cast is pulled out of the edge pixels."""
    rgb = a[:, :, :3].astype(np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    # Magenta: red and blue high, green low. How far a pixel is from it.
    mag = np.clip(((r + b) / 2 - g) / 255.0, 0, 1) * np.clip(1 - np.abs(r - b) / 255.0, 0, 1)
    alpha = np.clip((0.55 - mag) / 0.25, 0, 1)
    # De-fringe: remove the magenta share from half-keyed pixels.
    spill = np.clip(np.minimum(r, b) - g, 0, None) * (1 - alpha)
    rgb[:, :, 0] -= spill
    rgb[:, :, 2] -= spill
    # The rim: a two-pixel band inside the edge loses what magenta cast is left, and the edge itself softens by a
    # pixel, so no hairline of pink shows on a dark sea.
    solid = alpha > 0.5
    band = solid & ~ndimage.binary_erosion(solid, iterations=2)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    cast = np.clip(np.minimum(r, b) - g, 0, None)
    fix = band & (cast > 6)
    r[fix] -= cast[fix] * 0.9
    b[fix] -= cast[fix] * 0.9
    alpha = np.minimum(alpha, 0.5 * alpha + 0.5 * ndimage.grey_erosion(alpha, size=(3, 3)))
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    return out


def main(letter: str, stem: str) -> None:
    with open(MANIFEST, encoding='utf-8') as f:
        m = json.load(f)
    src = fetch(stem, m['cdn'])
    a = key_magenta(np.array(Image.open(src).convert('RGBA')))
    solid = a[:, :, 3] > 128
    solid = ndimage.binary_closing(solid, iterations=3)
    lab, n = ndimage.label(solid)
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    rows_n, cols_n = (2, 2) if letter == 'f' else (3, 4)
    count = rows_n * cols_n
    order = np.argsort(sizes)[::-1][:count]
    boxes = []
    for k in order:
        sl = ndimage.find_objects((lab == k + 1).astype(int))[0]
        boxes.append((sl[0].start, sl[0].stop, sl[1].start, sl[1].stop))
    if len(boxes) < count:
        raise SystemExit(f'only {len(boxes)} flags found')
    # Reading order: rows by the top edge, then left to right.
    boxes.sort(key=lambda b: b[0])
    rows = [sorted(boxes[i * cols_n:(i + 1) * cols_n], key=lambda b: b[2]) for i in range(rows_n)]
    base = 'abcdef'.index(letter) * 12
    os.makedirs(OUT, exist_ok=True)
    im = Image.fromarray(a)
    job = stem.split('_', 3)[3]
    for i, (y0, y1, x0, x1) in enumerate([b for r in rows for b in r]):
        piece = im.crop((x0, y0, x1, y1))
        scale = min(W / piece.width, H / piece.height)
        piece = piece.resize((max(1, round(piece.width * scale)), max(1, round(piece.height * scale))), Image.LANCZOS)
        canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        canvas.alpha_composite(piece, ((W - piece.width) // 2, (H - piece.height) // 2))
        name = f'f{base + i:02d}'
        canvas.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=92, method=6)
        m['assets'][f'flag.{name}'] = {'local': f'flags/{name}.webp', 'remote': stem + '.png', 'job': job, 'fit': f'sheet:{letter}{i}'}
        print('flag', name, (x0, y0, x1, y1))
    write_manifest(m)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
