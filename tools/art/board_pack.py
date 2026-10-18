"""The owner's boarding pack (2026-10-18, painted in ChatGPT and approved by him): the gangplanks and the deck props of
the hex battle, baked into the game's files.

    python tools/art/board_pack.py [step ...]     steps: planks props avif (all by default); `measure` prints only

The originals lie in assets/raw/gt_boarding/src/ (gitignored, copied from Downloads/gravetide_boarding; its
`rejected/` folder is not used); only what this writes is kept in git. Nothing is generated: each picture is keyed off
its flat magenta, cut out by its blobs (the shapes themselves, not a blind grid: a shape belongs to the cell its
centre falls in, a loose hook or rope end to the shape it is nearest), graded to the battle's own props
(props/bt_*.webp: the existing mast, gun, barrels and crates) and resized.

  planks  gt_gangplanks_wide.png (3 x 2: six, ~3.4–4.3 : 1)  -> props/plank_w<k>.webp   (prop.plank_w<k>)
          gt_gangplanks.png      (4 x 2: eight, ~4–6 : 1)    -> props/plank_l<k>.webp   (prop.plank_l<k>)
          — not the long sheet's eighth (its barnacles read as skulls: the owner's rule).
  props   gt_deck_props_{cover,cargo,cursed2}.png (4 x 4 each) -> props/bd_<name>.webp (prop.bd_<name>)
          — not cursed2's 13th (the shell: skull-like knobs at its base) nor its 16th (the anchor: a skull on its
          crown, seen at full size).
  avif    the AVIF twins (tools/art/pack_assets.py's rule: kept when 12 % smaller)

The ratio of each plank (its length over its width, as cut) is printed for shared/src/data/tacprops.ts PLANKS.
Run at a low priority (it sets its own process to «below normal» on Windows).
"""

import io
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from register import MANIFEST, write_manifest  # noqa: E402
from slice_flags import key_magenta  # noqa: E402
from ui_pack import below_normal, fit, grade, specks, trim  # noqa: E402

SRC = os.path.join(ROOT, 'assets', 'raw', 'gt_boarding', 'src')
A = os.path.join(ROOT, 'assets')
REV = 20261018120000
JOB = 'gpt-board_pack'

# The prop sheets in reading order: the name each cell becomes (None: not kept).
SHEETS = {
    'gt_deck_props_cover.png': [
        'table', 'barrel_wall', 'sandbags', 'shields',
        'chest', 'rope', 'shot', 'powder',
        'capstan', 'grate', 'bucket', 'lantern',
        'stump', 'yard', 'nets', 'bell',
    ],
    'gt_deck_props_cargo.png': [
        'sacks', 'rum_rack', 'arms_rack', 'swivel',
        'musket_crate', 'lumber', 'tar', 'blocks',
        'stove', 'coop', 'chain', 'staves',
        'hammocks', 'wheel', 'rowboat', 'binnacle',
    ],
    'gt_deck_props_cursed2.png': [
        'coral_barrels', 'kelp_crates', 'ghost_lamp', 'gold_chest',
        'ice_barrels', 'fire_barrel', 'fuse_keg', 'sunk_gun',
        'wreckage', 'torn_flag', 'mermaid', 'silk',
        None, 'cage', 'harpoons', None,
    ],
}
PLANKS = {
    'gt_gangplanks_wide.png': (2, 3, ['w1', 'w2', 'w3', 'w4', 'w5', 'w6']),
    'gt_gangplanks.png': (2, 4, ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', None]),
}

# The battle's props (props/bt_*.webp) as measured: the mean value (HSV) of their opaque pixels ~0.22–0.31, the mean
# saturation ~0.40–0.47. A new prop lighter or more saturated than that is toned down toward it (never brightened).
VAL_MAX = 0.31
SAT_MAX = 0.46
# What glows of itself keeps more of its light (a lantern, a fire, gold): toned down by half the gap only.
GLOW = {'lantern', 'ghost_lamp', 'fire_barrel', 'gold_chest', 'fuse_keg', 'bell', 'binnacle', 'stove'}

MADE: list = []


def src(name: str) -> np.ndarray:
    """Magenta keyed out with a soft edge (slice_flags.key_magenta), the magenta cast pulled out of every pixel whose red
    and blue stand alike above its green (despill, as ui_pack.keyed), loose specks dropped."""
    k = key_magenta(np.array(Image.open(os.path.join(SRC, name)).convert('RGBA')))
    f = k[:, :, :3].astype(np.int16)
    cast = np.clip(np.minimum(f[:, :, 0], f[:, :, 2]) - f[:, :, 1], 0, None) * (np.abs(f[:, :, 0] - f[:, :, 2]) <= 40)
    f[:, :, 0] -= cast
    f[:, :, 2] -= cast
    k[:, :, :3] = np.clip(f, 0, 255).astype(np.uint8)
    return specks(k, 0.0004)


def stats(k: np.ndarray) -> tuple:
    a = k[:, :, 3] > 128
    rgb = k[:, :, :3][a].astype(np.float32) / 255
    if not len(rgb):
        return 0.0, 0.0
    mx, mn = rgb.max(1), rgb.min(1)
    return float(((mx - mn) / np.maximum(mx, 1e-6)).mean()), float(mx.mean())


def tone(k: np.ndarray, name: str) -> np.ndarray:
    s, v = stats(k)
    half = name in GLOW
    sat = 1.0 if s <= SAT_MAX else SAT_MAX / s
    gain = 1.0 if v <= VAL_MAX else VAL_MAX / v
    if half:
        sat, gain = (1 + sat) / 2, (1 + gain) / 2
    # (a step more muted all round: the sheets are cleaner and crisper than the battle's older paintings)
    return grade(k, min(1.0, sat) * 0.92, min(1.0, gain) * 0.96, 1.05)


def blobs(k: np.ndarray, cols: int, rows: int) -> list:
    """The sheet's shapes grouped into its cells: [(cell index, mask)], a shape to the cell its centre of mass falls in.
    Shapes under 0.3 % of the largest are dust; the rest join their cell (a hook, a rope's end, a coin)."""
    solid = k[:, :, 3] > 24
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=3))
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    centres = ndimage.center_of_mass(solid, lab, range(1, n + 1))
    H, W = solid.shape
    cells: dict = {}
    for q in range(n):
        if sizes[q] < sizes.max() * 0.003:
            continue
        cy, cx = centres[q]
        c = min(cols - 1, int(cx / W * cols)) + cols * min(rows - 1, int(cy / H * rows))
        cells.setdefault(c, np.zeros_like(solid))
        cells[c] |= lab == q + 1
    return sorted(cells.items())


def cut(k: np.ndarray, mask: np.ndarray) -> np.ndarray:
    out = k.copy()
    out[~mask, 3] = 0
    ys, xs = np.nonzero(mask)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def save(im: Image.Image, rel: str, q: int = 88) -> str:
    p = os.path.join(A, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    print(f'{rel}: {im.size[0]}x{im.size[1]} {os.path.getsize(p) // 1024} K')
    return rel


def reg(m: dict, aid: str, rel: str, fit_: str, remote: str) -> None:
    m['assets'][aid] = {'local': rel, 'remote': remote, 'job': JOB, 'fit': fit_, 'rev': REV}
    MADE.append(rel)


def planks(m: dict, dry: bool = False) -> None:
    for sheet, (cols, rows, names) in PLANKS.items():
        k = src(sheet)
        for c, mask in blobs(k, cols, rows):
            name = names[c] if c < len(names) else None
            if not name:
                continue
            piece = cut(k, mask)
            s, v = stats(piece)
            # The plank's own ratio: its boards' length over their width, from the solid rows and columns (a hook or a
            # rope post standing off the boards widens the box, not the walkway).
            a = piece[:, :, 3] > 128
            rows_ = np.nonzero(a.sum(1) > a.shape[1] * 0.5)[0]
            ratio = piece.shape[1] / max(1, (rows_.max() - rows_.min() + 1) if len(rows_) else piece.shape[0])
            print(f'plank_{name}: {piece.shape[1]}x{piece.shape[0]} ratio {piece.shape[1] / piece.shape[0]:.2f} boards {ratio:.2f} sat {s:.2f} val {v:.2f}')
            if dry:
                continue
            im = trim(Image.fromarray(tone(piece, 'plank')), 2)
            reg(m, f'prop.plank_{name}', save(fit(im, 512), f'props/plank_{name}.webp', 86), 'keyed:512', 'gt_boarding_pack.png')


def props(m: dict, dry: bool = False) -> None:
    for sheet, names in SHEETS.items():
        k = src(sheet)
        for c, mask in blobs(k, 4, 4):
            name = names[c]
            if not name:
                continue
            piece = cut(k, mask)
            s, v = stats(piece)
            print(f'bd_{name}: {piece.shape[1]}x{piece.shape[0]} sat {s:.2f} val {v:.2f}')
            if dry:
                continue
            im = trim(Image.fromarray(tone(piece, name)), 2)
            reg(m, f'prop.bd_{name}', save(fit(im, 256), f'props/bd_{name}.webp', 86), 'keyed:256', 'gt_boarding_pack.png')


def avif(m: dict) -> None:
    from pack_assets import AVIF_GAIN, AVIF_Q
    files = set(MADE) | {e['local'] for e in m['assets'].values() if e.get('job') == JOB}
    for rel in sorted(files):
        p = os.path.join(A, rel)
        if not os.path.exists(p):
            continue
        im = Image.open(p)
        im.load()
        b = io.BytesIO()
        im.save(b, 'AVIF', quality=AVIF_Q, speed=6)
        out = p[:-5] + '.avif'
        if b.tell() <= os.path.getsize(p) * AVIF_GAIN:
            open(out, 'wb').write(b.getvalue())
            print(f'{rel[:-5]}.avif {b.tell() // 1024} K (webp {os.path.getsize(p) // 1024} K)')
        elif os.path.exists(out):
            os.remove(out)


def measure(m: dict) -> None:
    for n in ('bt_mast', 'bt_cannon', 'bt_barrels', 'bt_crates'):
        k = np.array(Image.open(os.path.join(A, 'props', n + '.webp')).convert('RGBA'))
        print(n, 'sat %.2f val %.2f' % stats(k))
    planks(m, True)
    props(m, True)


STEPS = {'planks': planks, 'props': props, 'avif': avif, 'measure': measure}


def main(argv: list) -> None:
    below_normal()
    with open(MANIFEST, encoding='utf-8') as f:
        m = json.load(f)
    for step in argv or ['planks', 'props', 'avif']:
        STEPS[step](m)
        if step != 'measure':
            write_manifest(m)


if __name__ == '__main__':
    main(sys.argv[1:])
