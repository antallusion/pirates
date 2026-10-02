"""Cut a painted sheet from tools/art/sheets.json into its assets and register them.

    python tools/art/slice_sheet.py <sheet name, e.g. tattoos_1> <higgsfield stem hf_..._<job>>

A like family (the tattoos, the catch, the goods and pets, the beasts) is painted as one sheet so the set is of one hand
(docs/06 §17.4). Two kinds of sheet:

  tiles  — opaque tiles in a grid with dark gutters; the gutters are found as the darkest bands near each expected
           cut, each tile is trimmed a little inside them and saved opaque, `px` high, `ratio` (width / height, 1 by
           default) wide.
  keyed  — separate objects on flat magenta; the cuts are the emptiest bands near each expected cut, each cell is keyed
           (with its fringe), trimmed to what is painted in it and saved on transparency: set square on a `px` canvas
           for icons, or at its own shape with the longest side `px` for sprites (or at one scale for the whole sheet,
           `uniform`, so the figures keep their sizes beside each other).

A null id in the sheet is a spare tile, not kept.
"""

import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))
from register import MANIFEST, rev_of, write_manifest  # noqa: E402
from slice_flags import fetch, key_magenta  # noqa: E402

SHEETS = os.path.join(os.path.dirname(__file__), 'sheets.json')


def cuts(profile: np.ndarray, n: int, lowest: bool = True) -> list:
    """The cut near each expected line: the lowest (or highest) value within a tenth of a cell of it."""
    size = len(profile)
    out = [0]
    for k in range(1, n):
        c = round(size * k / n)
        w = max(2, size // (n * 5))
        lo, hi = max(1, c - w), min(size - 1, c + w)
        seg = profile[lo:hi]
        out.append(lo + int(np.argmin(seg) if lowest else np.argmax(seg)))
    out.append(size)
    return out


def name_of(aid: str) -> str:
    return aid.split('.', 1)[1]


def main(sheet_name: str, stem: str) -> None:
    sheets = json.load(open(SHEETS, encoding='utf-8'))
    sh = sheets[sheet_name]
    cols, rows = sh['grid']
    with open(MANIFEST, encoding='utf-8') as f:
        m = json.load(f)
    src = fetch(stem, m['cdn'])
    job = stem.split('_', 3)[3]
    out_dir = os.path.join(ROOT, 'assets', sh['dir'])
    os.makedirs(out_dir, exist_ok=True)
    px = sh['px']
    if sh['mode'] == 'tiles':
        im = Image.open(src).convert('RGB')
        a = np.asarray(im).astype(np.float32).mean(axis=2)
        xs, ys = cuts(a.mean(axis=0), cols), cuts(a.mean(axis=1), rows)
    else:
        keyed = key_magenta(np.array(Image.open(src).convert('RGBA')))
        # Hairlines the painter rules between the cells (asked not to, now and then does): a column or row that is
        # solid nearly end to end is no part of anything — it goes.
        solid0 = keyed[:, :, 3] > 128
        for axis in (0, 1):
            full = solid0.mean(axis=axis) > 0.97
            idx = np.nonzero(full)[0]
            for k in idx:
                if axis == 0:
                    keyed[:, max(0, k - 2):k + 3, 3] = 0
                else:
                    keyed[max(0, k - 2):k + 3, :, 3] = 0
        im = Image.fromarray(keyed)
        solid = keyed[:, :, 3].astype(np.float32) / 255
        xs, ys = cuts(solid.sum(axis=0), cols), cuts(solid.sum(axis=1), rows)
        blobs = None
        if sh.get('split') == 'blobs':
            # Shapes of unequal size in a row (a whale beside a shark): each is found whole as a shape of its own,
            # the largest few, in reading order, rather than cut at even intervals.
            lab, n = ndimage.label(ndimage.binary_closing(keyed[:, :, 3] > 24, iterations=2))
            sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
            # The painter may give a shape too many (or lay them out unevenly): `picks` names, for a given painting,
            # which shape in reading order each id takes.
            picks = sh.get('picks', {}).get(stem)
            want = (max(picks) + 1) if picks else len(sh['ids'])
            big = [int(k) + 1 for k in np.argsort(sizes)[::-1][:want]]
            cm = {k: ndimage.center_of_mass(lab == k) for k in big}
            # Reading order: rows by height (a new row where the gap is more than half a shape's height), then left
            # to right.
            hts = {k: (lambda sl: sl[0].stop - sl[0].start)(ndimage.find_objects((lab == k).astype(int))[0]) for k in big}
            by_y = sorted(big, key=lambda k: cm[k][0])
            rows_, cur = [], [by_y[0]]
            for k in by_y[1:]:
                if cm[k][0] - cm[cur[-1]][0] > 0.5 * np.median(list(hts.values())):
                    rows_.append(cur)
                    cur = [k]
                else:
                    cur.append(k)
            rows_.append(cur)
            order = [k for row in rows_ for k in sorted(row, key=lambda k: cm[k][1])]
            # A part come loose (a tusk, a fin tip) joins the shape nearest it.
            for k in range(1, n + 1):
                if k in cm or sizes[k - 1] < 400:
                    continue
                ky, kx = ndimage.center_of_mass(lab == k)
                lab[lab == k] = min(big, key=lambda t: (cm[t][0] - ky) ** 2 + (cm[t][1] - kx) ** 2)
            top = [order[j] for j in picks] if picks else order
            blobs = (lab, top)
    for i, aid in enumerate(sh['ids']):
        if not aid:
            continue
        r, c = divmod(i, cols)
        if sh['mode'] != 'tiles' and blobs:
            lab, top = blobs
            sl = ndimage.find_objects((lab == top[i]).astype(int))[0]
            y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
            only = np.array(im.crop((x0, y0, x1, y1)))
            only[lab[y0:y1, x0:x1] != top[i], 3] = 0
            ys_, xs_ = np.nonzero(only[:, :, 3] > 8)
            piece = Image.fromarray(only).crop((xs_.min(), ys_.min(), xs_.max() + 1, ys_.max() + 1))
            if sh['square']:
                s = round(px * 0.9) / max(piece.size)
                piece = piece.convert('RGBa').resize((max(1, round(piece.width * s)), max(1, round(piece.height * s))), Image.LANCZOS).convert('RGBA')
                out = Image.new('RGBA', (px, px), (0, 0, 0, 0))
                out.alpha_composite(piece, ((px - piece.width) // 2, (px - piece.height) // 2))
            else:
                s = sh['uniform'] if sh.get('uniform') else px / max(piece.size)
                out = piece.convert('RGBa').resize((max(1, round(piece.width * s)), max(1, round(piece.height * s))), Image.LANCZOS).convert('RGBA')
            fname = name_of(aid)
            out.save(os.path.join(out_dir, fname + '.webp'), 'WEBP', quality=90, method=6)
            m['assets'][aid] = {'local': f"{sh['dir']}/{fname}.webp", 'remote': stem + '.png', 'job': job, 'fit': f'sheet:{sheet_name}.{i}', 'rev': rev_of(stem)}
            print(aid, (x0, y0, x1, y1), out.size)
            continue
        x0, x1, y0, y1 = xs[c], xs[c + 1], ys[r], ys[r + 1]
        if sh['mode'] == 'tiles':
            pad = round(min(x1 - x0, y1 - y0) * 0.04)
            tile = im.crop((x0 + pad, y0 + pad, x1 - pad, y1 - pad))
            # The tile's shape: square icons, or upright panels (portraits) at `ratio` = width / height.
            ratio = sh.get('ratio', 1)
            zoom = sh.get('zoom', {}).get(stem, 1)
            w = min(tile.width, round(tile.height / zoom * ratio))
            h = round(w / ratio)
            # Centred, or pushed to one side where a painting put something cut in half at the other edge
            # (`align`: {painting: 'left' | 'right'}).
            side = sh.get('align', {}).get(stem)
            left = 0 if side == 'left' else tile.width - w if side == 'right' else (tile.width - w) // 2
            # And from the top where a caption was painted along the foot of every panel (`valign`: 'top').
            top = 0 if sh.get('valign', {}).get(stem) == 'top' else (tile.height - h) // 2
            tile = tile.crop((left, top, left + w, top + h))
            out = tile.resize((round(px * ratio), px), Image.LANCZOS)
        else:
            cell = np.array(im.crop((x0, y0, x1, y1)))
            alpha = cell[:, :, 3] > 24
            # Only what belongs to the cell's object: the largest shapes, not a neighbour's stray tip at the edge.
            lab, n = ndimage.label(ndimage.binary_dilation(alpha, iterations=4))
            if n == 0:
                raise SystemExit(f'{aid}: empty cell')
            sizes = ndimage.sum(alpha, lab, range(1, n + 1))
            keep = np.isin(lab, [k + 1 for k in range(n) if sizes[k] >= sizes.max() * 0.08])
            cell[~keep, 3] = 0
            ys_, xs_ = np.nonzero(cell[:, :, 3] > 8)
            piece = Image.fromarray(cell).crop((xs_.min(), ys_.min(), xs_.max() + 1, ys_.max() + 1))
            if sh['square']:
                inner = round(px * 0.9)
                s = inner / max(piece.size)
                piece = piece.convert('RGBa').resize((max(1, round(piece.width * s)), max(1, round(piece.height * s))), Image.LANCZOS).convert('RGBA')
                out = Image.new('RGBA', (px, px), (0, 0, 0, 0))
                out.alpha_composite(piece, ((px - piece.width) // 2, (px - piece.height) // 2))
            else:
                # Figures of one sheet keep their sizes beside each other (a man kneeling is shorter than one standing):
                # `uniform` is one scale for every cell; otherwise the longest side is `px`.
                s = sh['uniform'] if sh.get('uniform') else px / max(piece.size)
                out = piece.convert('RGBa').resize((max(1, round(piece.width * s)), max(1, round(piece.height * s))), Image.LANCZOS).convert('RGBA')
        fname = name_of(aid)
        path = os.path.join(out_dir, fname + '.webp')
        out.save(path, 'WEBP', quality=90, method=6)
        m['assets'][aid] = {'local': f"{sh['dir']}/{fname}.webp", 'remote': stem + '.png', 'job': job, 'fit': f'sheet:{sheet_name}.{i}', 'rev': rev_of(stem)}
        print(aid, (x0, y0, x1, y1), out.size)
    write_manifest(m)
    # Cut: the sheet is no longer with the painter.
    if sh.pop('painting', None) is not None or not sh.get('cut'):
        sh['cut'] = stem
        with open(SHEETS, 'w', encoding='utf-8') as f:
            f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '
')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
