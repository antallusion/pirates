"""The cosmetics' art (owner, 2026-10-19: five sheets painted on a flat chroma green, docs/32 §12): baked into the
game's files.

    python tools/art/cosmetics_pack.py [--check]

The originals lie in assets/raw/cosmetics/ (gitignored, copied from Downloads/gravetide_cosmetics); only what this
writes is kept in git. Nothing is generated: each cell is keyed, cut, trimmed, padded and resized. The few things the
owner's content rule (no skulls, no blood, no bones) forbids are painted out by code here (see FIXES), so a re-run
gives the same files.

  titles.png          (1536 x 1024, 2 x 4) -> cosmetics/plate_<id>.webp   512 x 144, the plate centred (text by code)
  frames.png          (1254 x 1254, 3 x 3) -> cosmetics/frame_<id>.webp   256 x 256, centred on the hole (keyed too)
  emblems.png         (1254 x 1254, 4 x 4) -> cosmetics/emblem_<id>.webp  128 x 128, ivory (tinted by code)
  emotes.png          (1254 x 1254, 4 x 4) -> cosmetics/emote_<id>.webp   128 x 128
  shop_cosmetics.png  (1774 x  887, 4 x 2) -> icons/cos_<id>.webp         192 x 192 (the shop's section icons)

The key is skills_pack.py's (Vlahos: the green's dominance over red and blue gives the alpha, the key unmixed from the
colour, what green is left pulled down to the pixel's own red or blue near the edge), measured per sheet: the sheets'
greens differ (the emblems' and emotes' key stands at a dominance of ~241, the others' at ~248). --check only counts
the fringe (edge pixels with a green cast left) and writes nothing.

Run at a low priority (it sets its own process to «below normal» on Windows).
"""

import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from register import MANIFEST, write_manifest  # noqa: E402
from skills_pack import below_normal, despill_out, fringe, neighbours_off, save, trim  # noqa: E402
from slice_sheet import cuts  # noqa: E402

SRC = os.path.join(ROOT, 'assets', 'raw', 'cosmetics')
A = os.path.join(ROOT, 'assets')
REV = 20261019180000
JOB = 'gpt-cosmetics_pack'
CLEAR = 200  # a pixel this green is the key itself
RIM = 10     # px (at the sheet's size) over which a picture's own green comes back from the edge inward

# Each sheet: its grid, the output kind and, in reading order, the id each cell becomes (None: not kept).
# emblems' 9th cell (shark jaws) is dropped: painted as a jaw's whole bone with its hinges, it reads as a bone trophy
# (the owner's rule: no bones).
SHEETS = {
    'titles': ((2, 4), 'plate', [
        'driftwood', 'bronze', 'silver', 'gold', 'coral', 'corsair', 'ghost', 'abyss',
    ]),
    'frames': ((3, 3), 'frame', [
        'rope', 'copper', 'gold', 'coral', 'kraken', 'ghost', 'wheel', 'admiral', 'abyss',
    ]),
    'emblems': ((4, 4), 'emblem', [
        'hook', 'cannon', 'kraken', 'anchor',
        'crown', 'hourglass', 'heart', 'raven',
        None, 'trident', 'compass', 'bell',
        'serpent', 'pistols', 'moon', 'dagger',
    ]),
    'emotes': ((4, 4), 'emote', [
        'parrot', 'rum', 'salute', 'chest',
        'cannon', 'sinking', 'kraken', 'coin',
        'spyglass', 'heartbreak', 'gull', 'keg',
        'hook', 'ghost', 'dizzy', 'trophy',
    ]),
    'shop_cosmetics': ((4, 2), 'shop', [
        'titles', 'frames', 'flags', 'trails', 'emotes', 'bundle', 'halloween', 'winter',
    ]),
}

# How much green dominance a painted body keeps deep inside (0 by default): the Halloween deck's green fire and the
# winter bell's pine sprig.
GREEN = {'shop.halloween': 200, 'shop.winter': 90, 'frame.ghost': 40, 'plate.ghost': 40}

# Where a cell's own glow is nearly as green as the key: only a purer green is the key there (the Halloween deck's
# green fire and the pumpkin's eyes).
CLEAR_AT = {'shop.halloween': 232}

OUT = {'plate': (512, 144), 'frame': (256, 256), 'emblem': (128, 128), 'emote': (128, 128), 'shop': (192, 192)}
FOLDER = {'plate': 'cosmetics', 'frame': 'cosmetics', 'emblem': 'cosmetics', 'emote': 'cosmetics', 'shop': 'icons'}


def asset_id(kind: str, cid: str) -> str:
    return f'icon.cos_{cid}' if kind == 'shop' else f'cos.{kind}_{cid}'


def rel_of(kind: str, cid: str) -> str:
    return f'icons/cos_{cid}.webp' if kind == 'shop' else f'cosmetics/{kind}_{cid}.webp'


def key_green(rgb: np.ndarray, key: np.ndarray, kd: float, t_body: float, clear_at: float = CLEAR) -> np.ndarray:
    """RGBA from an RGB cell on the chroma green: skills_pack.key_green with the sheet's own key colour and
    dominance."""
    c = rgb.astype(np.float32)
    d = c[:, :, 1] - np.maximum(c[:, :, 0], c[:, :, 2])
    clear = d > clear_at
    dist = ndimage.distance_transform_edt(~clear)
    t = t_body * np.clip((dist - 2) / RIM, 0, 1)
    alpha = np.clip((kd - d) / np.maximum(kd - t, 1), 0, 1)
    alpha[clear] = 0
    a3 = np.maximum(alpha, 1e-3)[:, :, None]
    f = (c - (1 - alpha)[:, :, None] * key) / a3
    f = np.clip(f, 0, 255)
    m = np.maximum(f[:, :, 0], f[:, :, 2])
    f[:, :, 1] = np.minimum(f[:, :, 1], m + t)
    solid = alpha > 0.1
    lab, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        alpha[np.isin(lab, [q + 1 for q in range(n) if sizes[q] < 6])] = 0
    alpha = np.minimum(alpha, 0.5 * alpha + 0.5 * ndimage.grey_erosion(alpha, size=(3, 3)))
    return np.dstack([f, alpha * 255]).round().clip(0, 255).astype(np.uint8)


# ---- the owner's content rule, painted out by code -------------------------------------------------------------------

def gold_boss(cell: np.ndarray, cx: float, cy: float, r: float) -> None:
    """A round gold boss (a sword-knot's medallion) painted over (cx, cy): the crimson plate's two little skulls under
    the crossed sabres' hilts."""
    s = 4
    big = Image.new('RGBA', (int(r * 2 * s) + 8, int(r * 2 * s) + 8), (0, 0, 0, 0))
    g = ImageDraw.Draw(big)
    R = r * s
    o = 4
    g.ellipse((o, o, o + 2 * R, o + 2 * R), fill=(40, 24, 8, 255))
    rings = [(0.86, (122, 84, 30)), (0.74, (176, 128, 52)), (0.58, (214, 170, 82)), (0.36, (238, 206, 128)), (0.16, (250, 232, 170))]
    for k, col in rings:
        rr = R * k
        dx = -R * (1 - k) * 0.25
        g.ellipse((o + R - rr + dx, o + R - rr + dx, o + R + rr + dx, o + R + rr + dx), fill=col + (255,))
    small = big.resize((big.width // s, big.height // s), Image.LANCZOS)
    x0, y0 = int(round(cx - small.width / 2)), int(round(cy - small.height / 2))
    base = Image.fromarray(cell)
    base.alpha_composite(small, (x0, y0))
    cell[:] = np.asarray(base)


def clone_wood(cell: np.ndarray, boxes: list) -> None:
    """Each box painted over with the plank's own wood from `dx` to the side (OpenCV's Poisson clone: the patch takes
    the light of its new place): the driftwood plate's barnacles, whose dark holes read as little skulls."""
    import cv2
    rgb = np.ascontiguousarray(cell[:, :, :3])
    for (x0, y0, x1, y1, dx) in boxes:
        mask = np.zeros(cell.shape[:2], np.uint8)
        cv2.ellipse(mask, ((x0 + x1) // 2 + dx, (y0 + y1) // 2), ((x1 - x0) // 2 + 3, (y1 - y0) // 2 + 3), 0, 0, 360, 255, -1)
        rgb = cv2.seamlessClone(rgb, rgb, mask, ((x0 + x1) // 2, (y0 + y1) // 2), cv2.NORMAL_CLONE)
    cell[:, :, :3] = rgb


def no_blood(cell: np.ndarray) -> None:
    """The broken heart: every red drop that is not the heart itself goes (the falling drops are loose shapes; the
    drips hanging off the heart's lower rim are the thin red bits an opening of the heart's shape cuts off), and the
    dagger's blade keeps no red smear: a red pixel on the steel is turned to the steel's grey."""
    a = cell[:, :, 3] > 40
    f = cell[:, :, :3].astype(np.int16)
    red = (f[:, :, 0] > 110) & (f[:, :, 0] > f[:, :, 1] * 1.8) & (f[:, :, 0] > f[:, :, 2] * 1.8)
    lab, n = ndimage.label(a)
    sizes = ndimage.sum(a, lab, range(1, n + 1))
    main = 1 + int(np.argmax(sizes))
    for q in range(1, n + 1):
        if q != main:
            cell[lab == q] = 0
    # the drips: what an opening of the shape cuts off, red and small, below the heart's middle
    body = lab == main
    opened = ndimage.binary_opening(body, structure=np.ones((3, 3)), iterations=6)
    rest = body & ~opened
    rl, rn = ndimage.label(rest)
    h = cell.shape[0]
    for q in range(1, rn + 1):
        part = rl == q
        ys = np.nonzero(part)[0]
        if part.sum() < 900 and ys.mean() > h * 0.5 and (red & part).sum() > part.sum() * 0.25:
            grow = ndimage.binary_dilation(part, iterations=2) & ~opened
            cell[grow] = 0
    # the steel: grey pixels' neighbourhood — a red pixel among grey ones is the smear
    grey = (np.abs(f[:, :, 0] - f[:, :, 2]) < 22) & (np.abs(f[:, :, 1] - f[:, :, 2]) < 22) & (f.sum(axis=2) > 300)
    near = ndimage.uniform_filter(grey.astype(np.float32), 9) > 0.35
    smear = red & near
    v = f[smear].mean(axis=1, keepdims=True) if smear.any() else None
    if v is not None:
        cell[:, :, :3][smear] = np.repeat(np.clip(v * 1.15, 0, 255), 3, axis=1).astype(np.uint8)


# Applied to the keyed cell, in the cell's own pixels (offsets from the cell's top left), before the trim.
FIXES = {
    # the two little skulls where the sabres cross (cells 5: x 768.., y 512..)
    'plate.corsair': lambda c, o: (gold_boss(c, 869 - o[0], 641 - o[1], 13), gold_boss(c, 1432 - o[0], 642 - o[1], 13)),
    # the barnacles with two dark holes each (left and right of the plank)
    'plate.driftwood': lambda c, o: clone_wood(c, [
        (x0 - o[0], y0 - o[1], x1 - o[0], y1 - o[1], dx) for (x0, y0, x1, y1, dx) in [
            (42, 137, 71, 171, 190), (49, 181, 71, 203, 190),
            (700, 133, 730, 155, -250), (701, 178, 724, 200, -250), (588, 164, 624, 200, -180),
        ]
    ]),
    'emote.heartbreak': lambda c, o: no_blood(c),
}


# ---- fitting ---------------------------------------------------------------------------------------------------------

def contain(im: Image.Image, w: int, h: int, inner: float) -> Image.Image:
    s = min(w * inner / im.width, h * inner / im.height)
    pw, ph = max(1, round(im.width * s)), max(1, round(im.height * s))
    piece = im.convert('RGBa').resize((pw, ph), Image.LANCZOS).convert('RGBA')
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.alpha_composite(piece, ((w - pw) // 2, (h - ph) // 2))
    return out


def around_hole(cell: np.ndarray, px: int) -> tuple:
    """A frame: the square centred on its hole (the clear region round the cell's middle), wide enough for all of the
    frame; and the hole's radius as a share of the square's side (the avatar is drawn inside it)."""
    a = cell[:, :, 3]
    clear = a < 16
    h, w = a.shape
    lab, _ = ndimage.label(clear)
    mid = lab[h // 2, w // 2]
    hole = lab == mid
    ys, xs = np.nonzero(hole)
    cy, cx = ys.mean(), xs.mean()
    seen = np.nonzero(a > 8)
    half = max(np.abs(seen[0] - cy).max(), np.abs(seen[1] - cx).max()) + 3
    r_in = ndimage.distance_transform_edt(hole)[int(round(cy)), int(round(cx))]
    im = Image.fromarray(cell)
    box = (int(round(cx - half)), int(round(cy - half)), int(round(cx + half)), int(round(cy + half)))
    sq = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    sq.alpha_composite(im.crop((max(0, box[0]), max(0, box[1]), min(w, box[2]), min(h, box[3]))), (max(0, -box[0]), max(0, -box[1])))
    out = sq.convert('RGBa').resize((px, px), Image.LANCZOS).convert('RGBA')
    return out, r_in / (2 * half)


def main(argv: list) -> None:
    below_normal()
    check = '--check' in argv
    with open(MANIFEST, encoding='utf-8') as f:
        m = json.load(f)
    os.makedirs(os.path.join(A, 'cosmetics'), exist_ok=True)
    tot_e = tot_g = 0
    holes = {}
    for sheet, ((cols, rows), kind, ids) in SHEETS.items():
        rgb = np.asarray(Image.open(os.path.join(SRC, sheet + '.png')).convert('RGB'))
        d = rgb[:, :, 1].astype(np.int16) - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
        bg = d > CLEAR
        key = rgb[bg].astype(np.float32).mean(axis=0)
        kd = float(np.median(d[bg])) - 1
        solid = (d < 120).astype(np.float32)
        xs, ys = cuts(solid.sum(axis=0), cols), cuts(solid.sum(axis=1), rows)
        print(f'{sheet}: {rgb.shape[1]}x{rgb.shape[0]}, key {key.round(0)}, dominance {kd:.0f}')
        for i, cid in enumerate(ids):
            if not cid:
                continue
            r, c = divmod(i, cols)
            name = f'{kind}.{cid}'
            x0, y0 = xs[c], ys[r]
            cell_rgb = rgb[y0:ys[r + 1], x0:xs[c + 1]]
            cell = key_green(cell_rgb, key, kd, GREEN.get(name, 0), CLEAR_AT.get(name, CLEAR))
            cell = neighbours_off(cell)
            if name in FIXES:
                FIXES[name](cell, (x0, y0))
            w, h = OUT[kind]
            if kind == 'frame':
                out, hole = around_hole(cell, w)
                holes[cid] = round(hole, 3)
            else:
                im = trim(Image.fromarray(cell), 2)
                inner = {'plate': 0.98, 'emblem': 0.92, 'emote': 0.96, 'shop': 0.96}[kind]
                out = contain(im, w, h, inner)
            out = Image.fromarray(despill_out(np.asarray(out), name in GREEN))
            ke, kg = fringe(np.asarray(out))
            tot_e += ke
            tot_g += kg
            print(f'  {name}: fringe {kg}/{ke} at {w}x{h}')
            if check:
                continue
            rel = rel_of(kind, cid)
            save(out, rel)
            m['assets'][asset_id(kind, cid)] = {'local': rel, 'remote': sheet + '.png', 'job': JOB, 'fit': f'sheet:{sheet}.{i}', 'rev': REV}
    print(f'fringe: {tot_g} of {tot_e} edge pixels keep a green cast')
    print('frame holes (radius / side):', json.dumps(holes))
    if not check:
        write_manifest(m)


if __name__ == '__main__':
    main(sys.argv[1:])
