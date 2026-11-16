"""The masts painted apart from the hulls (owner 2026-11-16, tools/art/ships_nomast.py): one yard with its sail seen from
straight above, in four states — set, reefed, furled, bare — for each rig, cut from a Higgsfield sheet (2 columns ×
4 rows: set·reefed / set·reefed / furled·bare / furled·bare on magenta).

    python tools/art/masts.py <rig square|fore_aft|lateen> <hf_stem>

Writes assets/masts/<rig>_<state>.webp, registers mast.<rig>_<state>, and the pivot (the round mast top: x the
picture's middle, y the widest row of its top half, as a fraction of the height) in shared/src/data/maststeps.json
under "_pivot".
"""
import json
import os
import sys
import urllib.request

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))
from register import MANIFEST, rev_of, write_manifest  # noqa: E402
from slice_flags import key_magenta  # noqa: E402

RAW = os.path.join(os.path.expanduser('~'), 'Downloads', 'gravetide_art', 'ships2')
STEPS = os.path.join(ROOT, 'shared', 'src', 'data', 'maststeps.json')
CELLS = {'full': (0, 0), 'reef': (0, 1), 'furl': (2, 0), 'bare': (2, 1)}  # (row, col)
WIDTH = 480  # px: a yard's width in the asset


def main(rig: str, stem: str) -> None:
    with open(MANIFEST, encoding='utf-8') as f:
        m = json.load(f)
    p = os.path.join(RAW, stem + '.png')
    if not os.path.exists(p):
        req = urllib.request.Request(m['cdn'] + stem + '.png', headers={'User-Agent': 'gravetide-art'})
        with urllib.request.urlopen(req, timeout=120) as r, open(p, 'wb') as f:
            f.write(r.read())
    sheet = Image.fromarray(key_magenta(np.array(Image.open(p).convert('RGBA'))))
    W, H = sheet.size
    os.makedirs(os.path.join(ROOT, 'assets', 'masts'), exist_ok=True)
    steps = json.load(open(STEPS, encoding='utf-8')) if os.path.exists(STEPS) else {}
    piv = steps.setdefault('_pivot', {})
    for state, (r, c) in CELLS.items():
        cell = sheet.crop((c * W // 2 + 12, r * H // 4 + 12, (c + 1) * W // 2 - 12, (r + 1) * H // 4 - 12))
        a = np.array(cell)
        solid = a[:, :, 3] > 128
        lab, n = ndimage.label(solid)
        if n:  # the largest piece only (the grid's dark rules and stray specks out)
            k = int(np.argmax(ndimage.sum(solid, lab, range(1, n + 1)))) + 1
            a[:, :, 3] = np.where(lab == k, a[:, :, 3], 0)
        cell = Image.fromarray(a)
        cell = cell.crop(cell.getbbox())
        s = WIDTH / cell.width
        cell = cell.convert('RGBa').resize((WIDTH, max(1, round(cell.height * s))), Image.LANCZOS).convert('RGBA')
        rows = (np.array(cell)[:, :, 3] > 128).sum(axis=1)
        py = int(np.argmax(rows[: max(1, int(len(rows) * 0.45))]))
        local = f'masts/{rig}_{state}.webp'
        cell.save(os.path.join(ROOT, 'assets', local), 'WEBP', quality=90, method=6)
        m['assets'][f'mast.{rig}_{state}'] = {'local': local, 'remote': stem + '.png', 'job': stem.split('_', 3)[3], 'fit': f'sheet:{rig}{r}{c}', 'rev': rev_of(stem)}
        piv[f'{rig}_{state}'] = round(py / cell.height, 4)
        print(rig, state, cell.size, 'pivot y', piv[f'{rig}_{state}'])
    write_manifest(m)
    with open(STEPS, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(steps.items())), f, ensure_ascii=False, indent=0)
        f.write('\n')
    from ships_nomast import write_ts
    write_ts(steps)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
