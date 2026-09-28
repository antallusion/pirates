"""Cut a painted sheet of sixteen item icons (4 × 4 tiles with dark gutters) into icon.item_<id> assets and register them.

    python tools/art/slice_icons.py <sheet 1..4> <higgsfield stem hf_..._<job>>

The ids come from shared/src/data/itemart.ts (ITEM_ART, sixteen to a sheet in reading order). The gutters are found as
the darkest bands near each expected cut; every tile is trimmed a little inside its gutter and saved at 192 px, opaque,
like the other painted icons.
"""

import json
import os
import re
import sys
import urllib.request

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW = os.path.join(ROOT, 'assets', 'raw')
OUT = os.path.join(ROOT, 'assets', 'icons')
sys.path.insert(0, os.path.dirname(__file__))
from register import MANIFEST, write_manifest  # noqa: E402

PX = 192


def ids() -> list:
    src = open(os.path.join(ROOT, 'shared', 'src', 'data', 'itemart.ts'), encoding='utf-8').read()
    return re.findall(r"\['([a-z_]+)', '", src)


def fetch(stem: str, cdn: str) -> str:
    p = os.path.join(RAW, stem + '.png')
    if not os.path.exists(p):
        req = urllib.request.Request(cdn + stem + '.png', headers={'User-Agent': 'gravetide-art'})
        with urllib.request.urlopen(req, timeout=120) as r, open(p, 'wb') as f:
            f.write(r.read())
    return p


def cuts(profile: np.ndarray, n: int) -> list:
    """Where the gutters lie: the darkest band within a tenth of each expected cut."""
    size = len(profile)
    out = [0]
    for k in range(1, n):
        c = round(size * k / n)
        w = size // (n * 10)
        lo, hi = max(1, c - w), min(size - 1, c + w)
        out.append(lo + int(np.argmin(profile[lo:hi])))
    out.append(size)
    return out


def main(sheet: int, stem: str) -> None:
    with open(MANIFEST, encoding='utf-8') as f:
        m = json.load(f)
    im = Image.open(fetch(stem, m['cdn'])).convert('RGB')
    a = np.asarray(im).astype(np.float32).mean(axis=2)
    xs = cuts(a.mean(axis=0), 4)
    ys = cuts(a.mean(axis=1), 4)
    names = ids()[(sheet - 1) * 16:sheet * 16]
    os.makedirs(OUT, exist_ok=True)
    job = stem.split('_', 3)[3]
    for i, name in enumerate(names):
        r, c = divmod(i, 4)
        x0, x1, y0, y1 = xs[c], xs[c + 1], ys[r], ys[r + 1]
        pad = round(min(x1 - x0, y1 - y0) * 0.04)
        tile = im.crop((x0 + pad, y0 + pad, x1 - pad, y1 - pad))
        side = min(tile.size)
        tile = tile.crop(((tile.width - side) // 2, (tile.height - side) // 2, (tile.width - side) // 2 + side, (tile.height - side) // 2 + side))
        tile = tile.resize((PX, PX), Image.LANCZOS)
        tile.save(os.path.join(OUT, f'item_{name}.webp'), 'WEBP', quality=90, method=6)
        m['assets'][f'icon.item_{name}'] = {'local': f'icons/item_{name}.webp', 'remote': stem + '.png', 'job': job, 'fit': f'sheet:items{sheet}.{i}'}
        print('icon', name)
    write_manifest(m)


if __name__ == '__main__':
    main(int(sys.argv[1]), sys.argv[2])
