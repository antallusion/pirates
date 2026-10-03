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
        # solid nearly end to end is no part of anything — it goes. Not on a sheet of one thing that fills the picture
        # edge to edge (a town on the chart: `whole`), where such a row is the town itself.
        solid0 = keyed[:, :, 3] > 128
        for axis in (() if sh.get('whole') else (0, 1)):
            full = solid0.mean(axis=axis) > 0.97
            idx = np.nonzero(full)[0]
            for k in idx:
                if axis == 0:
                    keyed[:, max(0, k - 2):k + 3, 3] = 0
                else:
                    keyed[max(0, k - 2):k + 3, :, 3] = 0
        # A ground line ruled under a row of figures (asked not to, now and then does): a run of solid pixels along a row
        # longer than a third of the picture can be no figure (the figures stand apart) — it goes.
        if sh.get('split') == 'blobs':
            a = keyed[:, :, 3] > 128
            W = a.shape[1]
            for y in range(a.shape[0]):
                row = a[y]
                if row.mean() < 0.3:
                    continue
                d = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
                starts, ends = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
                for x0_, x1_ in zip(starts, ends):
                    # Only a thin line: a few pixels above and below it the run is mostly empty (a musket held
                    # across two touching figures is no line).
                    if x1_ - x0_ > W / 3 and a[max(0, y - 6), x0_:x1_].mean() < 0.3 and a[min(a.shape[0] - 1, y + 6), x0_:x1_].mean() < 0.3:
                        keyed[max(0, y - 1):y + 2, x0_:x1_, 3] = 0
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
            # Poses that touch (a bayonet reaching the next figure) make one wide shape: it is split at its emptiest
            # column in its middle, as often as it takes to have as many large shapes as poses.
            for _ in range(want):
                bigs = [int(k) + 1 for k in np.argsort(sizes)[::-1] if sizes[k] >= 0.3 * sizes.max()]
                if len(bigs) >= want or picks:
                    break
                boxes = {k: ndimage.find_objects((lab == k).astype(int))[0] for k in bigs}
                k = max(bigs, key=lambda q: boxes[q][1].stop - boxes[q][1].start)
                x0_, x1_ = boxes[k][1].start, boxes[k][1].stop
                cols_ = (lab[:, x0_:x1_] == k).sum(axis=0)
                lo_, hi_ = int((x1_ - x0_) * 0.3), int((x1_ - x0_) * 0.7)
                cut_ = x0_ + lo_ + int(np.argmin(cols_[lo_:hi_]))
                n += 1
                right = lab == k
                right[:, :cut_] = False
                lab[right] = n
                print(f'{sheet_name}: two poses touched — split at x {cut_}')
                sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
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
            # A part come loose (a tusk, a fin tip) joins the shape nearest it — if it lies within that shape's box (it
            # overlaps it); a thing thrown and in flight (a spear, a flask) is no part of any pose and goes.
            boxes_ = {t: ndimage.find_objects((lab == t).astype(int))[0] for t in big}
            grow = 0
            for k in range(1, n + 1):
                if k in cm or sizes[k - 1] < 400:
                    continue
                ky, kx = ndimage.center_of_mass(lab == k)
                near = min(big, key=lambda t: (cm[t][0] - ky) ** 2 + (cm[t][1] - kx) ** 2)
                sl = ndimage.find_objects((lab == k).astype(int))[0]
                b = boxes_[near]
                inside = sl[0].start < b[0].stop + grow and sl[0].stop > b[0].start - grow and sl[1].start < b[1].stop + grow and sl[1].stop > b[1].start - grow
                lab[lab == k] = near if inside else 0
            top = [order[j] for j in picks] if picks else order
            blobs = (lab, top)
            # A figure broken into pieces (one far shorter than the rest): then the row is cut at its emptiest columns
            # instead. (A lunge is wide; that is no fault.)
            boxes = [ndimage.find_objects((lab == k).astype(int))[0] for k in top]
            ws = [b[1].stop - b[1].start for b in boxes]
            hs = [b[0].stop - b[0].start for b in boxes]
            if not picks and min(hs) < 0.6 * float(np.median(hs)):
                print(f'{sheet_name}: shapes run together — cut by columns')
                blobs = None
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
            # A sliver left over from a split (the tip of the next pose's bayonet) is no part of this one.
            sub, sn = ndimage.label(only[:, :, 3] > 24)
            if sn > 1:
                ss = ndimage.sum(np.ones_like(sub), sub, range(1, sn + 1))
                only[np.isin(sub, [q + 1 for q in range(sn) if ss[q] < 0.04 * ss.max()]), 3] = 0
            ys_, xs_ = np.nonzero(only[:, :, 3] > 8)
            piece = Image.fromarray(only).crop((xs_.min(), ys_.min(), xs_.max() + 1, ys_.max() + 1))
            if sh['square']:
                s = round(px * 0.9) / max(piece.size)
                piece = piece.convert('RGBa').resize((max(1, round(piece.width * s)), max(1, round(piece.height * s))), Image.LANCZOS).convert('RGBA')
                out = Image.new('RGBA', (px, px), (0, 0, 0, 0))
                out.alpha_composite(piece, ((px - piece.width) // 2, (px - piece.height) // 2))
            else:
                # One scale for the sheet, reckoned for Higgsfield's 1536-high paintings (ChatGPT's are 1024 high).
                s = sh['uniform'] * 1536 / im.height if sh.get('uniform') else px / max(piece.size)
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
            f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + chr(10))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
