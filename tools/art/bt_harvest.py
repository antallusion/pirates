"""Bake what the battle's painting queue has given (tools/art/battle_more.py's order).

    python tools/art/bt_harvest.py '[["sheet.anim_sailor", "hf_..."], ["bg.deck_brig", "hf_..."], ["fx.bt_blast", "hf_..."]]'

sheet.<name> — cut by tools/art/slice_sheet.py (the figures' four poses, the icon and missile sheets);
bg.<name>    — one opaque painting: a ground or the sea (16:9, 1920 wide), a ship's deck (2:3, 1536 high), the spell book;
fx.<name>    — four frames of an effect on black in a row, cut where the row is darkest, each set square on black.
"""

import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from register import MANIFEST, rev_of, write_manifest  # noqa: E402
from slice_flags import fetch  # noqa: E402
import slice_sheet  # noqa: E402


def bg(aid: str, stem: str, m: dict) -> None:
    src = Image.open(fetch(stem, m['cdn'])).convert('RGB')
    name = aid.split('.', 1)[1]
    longest = 1536 if name.startswith('deck_') else 1920
    s = min(1.0, longest / max(src.size))
    out = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
    out.save(os.path.join(ROOT, 'assets', 'art', name + '.webp'), 'WEBP', quality=86, method=6)
    m['assets'][aid] = {'local': f'art/{name}.webp', 'remote': stem + '.png', 'job': stem.split('_', 3)[3], 'fit': f'opaque:{longest}', 'rev': rev_of(stem)}
    print(aid, out.size)


def fx(aid: str, stem: str, m: dict) -> None:
    src = Image.open(fetch(stem, m['cdn'])).convert('RGB')
    a = np.asarray(src).astype(np.float32).max(axis=2)
    cols = a.mean(axis=0)
    cuts = slice_sheet.cuts(cols, 4)
    name = aid.split('.', 1)[1]
    os.makedirs(os.path.join(ROOT, 'assets', 'fx'), exist_ok=True)
    for k in range(4):
        x0, x1 = cuts[k], cuts[k + 1]
        part = a[:, x0:x1]
        ys, xs = np.nonzero(part > 24)
        if len(xs) == 0:
            raise SystemExit(f'{aid}: frame {k} is empty')
        # Square round the light's middle, as big as the largest frame needs (the same box for all four keeps them aligned).
        cx, cy = x0 + (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        half = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 + 12
        box = (round(cx - half), round(cy - half), round(cx + half), round(cy + half))
        tile = Image.new('RGB', (box[2] - box[0], box[3] - box[1]))
        tile.paste(src.crop((max(0, box[0]), max(0, box[1]), min(src.width, box[2]), min(src.height, box[3]))), (max(0, -box[0]), max(0, -box[1])))
        tile = tile.resize((256, 256), Image.LANCZOS)
        fid = f'{aid}_{k}'
        tile.save(os.path.join(ROOT, 'assets', 'fx', f'{name}_{k}.webp'), 'WEBP', quality=88, method=6)
        m['assets'][fid] = {'local': f'fx/{name}_{k}.webp', 'remote': stem + '.png', 'job': stem.split('_', 3)[3], 'fit': f'fxrow:{k}', 'rev': rev_of(stem)}
        print(fid, box)


def main(pairs: list) -> None:
    for aid, stem in pairs:
        if aid.startswith('sheet.'):
            slice_sheet.main(aid.split('.', 1)[1], stem)
            continue
        with open(MANIFEST, encoding='utf-8') as f:
            m = json.load(f)
        if aid.startswith('bg.'):
            bg(aid, stem, m)
        elif aid.startswith('fx.'):
            fx(aid, stem, m)
        else:
            raise SystemExit(f'{aid}: no rule')
        write_manifest(m)


if __name__ == '__main__':
    main(json.loads(sys.argv[1]))
