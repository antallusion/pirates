"""The creatures' ability icons and the two action buttons' (owner, 2026-10-19: three sheets painted in ChatGPT on a flat
chroma green): baked into the game's files.

    python tools/art/skills_pack.py [--check]

The originals lie in assets/raw/skills/ (gitignored, copied from Downloads/gravetide_skills); only what this writes is
kept in git. Nothing is generated: each cell is keyed, cut, trimmed, padded to a square and resized.

  skills_1.png (1254 x 1254, 4 x 4)  -> icons/sk_<id>.webp   the mending, warding and binding abilities
  skills_2.png (1254 x 1254, 4 x 4)  -> icons/sk_<id>.webp   the curses, the rots and the harm at once
  skills_3.png (1774 x  887, 4 x 2)  -> icons/sk_<id>.webp + icons/act_attack.webp, icons/act_inspect.webp

The key: the green's dominance over a pixel's red and blue (d = g - max(r, b)) gives its alpha (Vlahos: the clear key
at d ~ 247 is 0, d <= t is 1), the key's share is taken out of the colour (unpremultiplied from the key), and what green
is left is pulled down to the pixel's own red or blue. Next to the cleared green t is 0 — no green survives at an edge
or in a glow over the key — and it grows to the icon's own `t` deeper in, so a painted green body (the miasma's
cloud, the snare's vines, the Greek fire's flame) keeps its colour. --check counts the edge pixels with a green cast
left (the report's fringe number).

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
from slice_sheet import cuts  # noqa: E402

SRC = os.path.join(ROOT, 'assets', 'raw', 'skills')
A = os.path.join(ROOT, 'assets')
REV = 20261019120000
JOB = 'gpt-skills_pack'
PX = 192

# Each sheet: its grid and, in reading order, the asset id each cell becomes (None: not kept).
# skills_1's 7th cell («Cleanse»: a swirl of clean water washing a purple stain away) is a second painting of the same
# ability as its 4th («Holy Water», the flask): the game's `cleanse` is «Святая вода» / Holy Water (docs/37), so the
# flask is it and the swirl is not kept.
SHEETS = {
    'skills_1': ((4, 4), [
        'sk_mend', 'sk_mass_mend', 'sk_raise', 'sk_cleanse',
        'sk_ward', 'sk_bulwark', None, 'sk_haste',
        'sk_rally', 'sk_toast', 'sk_fear', 'sk_stun',
        'sk_freeze', 'sk_slow', 'sk_entangle', 'sk_siren',
    ]),
    'skills_2': ((4, 4), [
        'sk_curse', 'sk_mark', 'sk_ink', 'sk_taunt',
        'sk_rot', 'sk_miasma', 'sk_chain', 'sk_fireball',
        'sk_firepot', 'sk_cone', 'sk_pierce', 'sk_volley',
        'sk_aimed', 'sk_drain', 'sk_devour', 'sk_toll',
    ]),
    'skills_3': ((4, 2), [
        'sk_grapple', 'sk_tidal', 'sk_blink', 'sk_summon',
        'sk_frenzy', 'sk_death_blast', 'act_attack', 'act_inspect',
    ]),
}

# How much green dominance a painted body keeps deep inside (0: none — the default: nothing of these is green).
GREEN = {'sk_mend': 70, 'sk_miasma': 120, 'sk_entangle': 90, 'sk_rot': 60, 'sk_firepot': 90, 'sk_cleanse': 30}

KEY = np.array([2.0, 250.0, 3.0])
KD = 246.0   # the clear key's dominance (a hair under its 247: the painter's noise)
CLEAR = 200  # a pixel this green is the key itself
RIM = 10     # px (at the sheet's size) over which an icon's own green comes back from the edge inward


def below_normal() -> None:
    if os.name == 'nt':
        import ctypes
        k = ctypes.windll.kernel32
        k.SetPriorityClass(k.GetCurrentProcess(), 0x4000)


def key_green(rgb: np.ndarray, t_body: float) -> np.ndarray:
    """RGBA from an RGB cell on the chroma green (the module's note)."""
    c = rgb.astype(np.float32)
    d = c[:, :, 1] - np.maximum(c[:, :, 0], c[:, :, 2])
    clear = d > CLEAR
    dist = ndimage.distance_transform_edt(~clear)
    t = t_body * np.clip((dist - 2) / RIM, 0, 1)
    alpha = np.clip((KD - d) / np.maximum(KD - t, 1), 0, 1)
    alpha[clear] = 0
    a3 = np.maximum(alpha, 1e-3)[:, :, None]
    f = (c - (1 - alpha)[:, :, None] * KEY) / a3
    f = np.clip(f, 0, 255)
    # What green is left over the pixel's red or blue: none at all near the edge, the body's own `t` deep inside.
    allow = t
    m = np.maximum(f[:, :, 0], f[:, :, 2])
    f[:, :, 1] = np.minimum(f[:, :, 1], m + allow)
    # Loose specks (a dot of noise in the key) dropped; the edge softened by half a pixel.
    solid = alpha > 0.1
    lab, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        alpha[np.isin(lab, [q + 1 for q in range(n) if sizes[q] < 6])] = 0
    alpha = np.minimum(alpha, 0.5 * alpha + 0.5 * ndimage.grey_erosion(alpha, size=(3, 3)))
    return np.dstack([f, alpha * 255]).round().clip(0, 255).astype(np.uint8)


def neighbours_off(cell: np.ndarray) -> np.ndarray:
    """A neighbour's glow reaching over the cut: shapes touching the cell's edge and small beside the icon go."""
    a = cell[:, :, 3] > 24
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=3))
    if n <= 1:
        return cell
    sizes = ndimage.sum(a, lab, range(1, n + 1))
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    drop = [q + 1 for q in range(n) if (q + 1) in edge and sizes[q] < sizes.max() * 0.3]
    cell[np.isin(lab, drop)] = 0
    return cell


def trim(im: Image.Image, margin: int = 2) -> Image.Image:
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.nonzero(a > 8)
    return im.crop((max(0, xs.min() - margin), max(0, ys.min() - margin), min(im.width, xs.max() + 1 + margin), min(im.height, ys.max() + 1 + margin)))


def square(im: Image.Image, px: int, inner: float) -> Image.Image:
    """Even padding all round: the trimmed icon scaled to `inner` of the square (its longer side), centred."""
    s = px * inner / max(im.size)
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    piece = im.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')
    out = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    out.alpha_composite(piece, ((px - w) // 2, (px - h) // 2))
    return out


def rim(a: np.ndarray, px: int = 3) -> np.ndarray:
    """The outer rim: seen pixels within `px` of a clear one."""
    seen = a > 12
    return seen & ndimage.binary_dilation(~seen, iterations=px)


def despill_out(k: np.ndarray, body: bool) -> np.ndarray:
    """After the resize: the green the filter mixed back in at the rim (and anywhere in an icon with no green body)
    pulled down to the pixel's red or blue again."""
    f = k[:, :, :3].astype(np.int16)
    m = np.maximum(f[:, :, 0], f[:, :, 2])
    where = rim(k[:, :, 3]) if body else np.ones(m.shape, bool)
    f[:, :, 1] = np.where(where, np.minimum(f[:, :, 1], m), f[:, :, 1])
    # (the rim a little under: the codecs' half-size colour planes (WebP's 4:2:0) mix a hair of the neighbour's
    #  colour back in, and the rim stays neutral after it)
    edge = rim(k[:, :, 3], 4)
    f[:, :, 1] = np.where(edge, np.minimum(f[:, :, 1], np.clip(m - 12, 0, None)), f[:, :, 1])
    out = k.copy()
    out[:, :, :3] = f.clip(0, 255).astype(np.uint8)
    return out


def fringe(k: np.ndarray) -> tuple:
    """The rim's pixels (seen, within 3 px of a clear one) and how many keep a green cast (g over max(r, b) by more
    than 8)."""
    f = k[:, :, :3].astype(np.int16)
    edge = rim(k[:, :, 3])
    cast = (f[:, :, 1] - np.maximum(f[:, :, 0], f[:, :, 2])) > 8
    return int(edge.sum()), int((edge & cast).sum())


def save(im: Image.Image, rel: str, q: int = 88) -> None:
    p = os.path.join(A, rel)
    im.save(p, 'WEBP', quality=q, method=6)
    from pack_assets import AVIF_GAIN, AVIF_Q
    b = io.BytesIO()
    im.save(b, 'AVIF', quality=AVIF_Q, speed=6)
    out = p[:-5] + '.avif'
    if b.tell() <= os.path.getsize(p) * AVIF_GAIN:
        open(out, 'wb').write(b.getvalue())
    elif os.path.exists(out):
        os.remove(out)
    av = f', avif {os.path.getsize(out) / 1024:.1f} K' if os.path.exists(out) else ''
    print(f'{rel}: {im.size[0]}x{im.size[1]} {os.path.getsize(p) / 1024:.1f} K{av}')


def main(argv: list) -> None:
    below_normal()
    check = '--check' in argv
    with open(MANIFEST, encoding='utf-8') as f:
        m = json.load(f)
    tot_e = tot_g = 0
    for sheet, ((cols, rows), ids) in SHEETS.items():
        rgb = np.asarray(Image.open(os.path.join(SRC, sheet + '.png')).convert('RGB'))
        d = rgb[:, :, 1].astype(np.int16) - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
        solid = (d < 120).astype(np.float32)
        xs, ys = cuts(solid.sum(axis=0), cols), cuts(solid.sum(axis=1), rows)
        for i, aid in enumerate(ids):
            if not aid:
                continue
            r, c = divmod(i, cols)
            cell = key_green(rgb[ys[r]:ys[r + 1], xs[c]:xs[c + 1]], GREEN.get(aid, 0))
            cell = neighbours_off(cell)
            im = trim(Image.fromarray(cell), 2)
            out = square(im, PX, 0.94 if aid.startswith('sk_') else 0.96)
            out = Image.fromarray(despill_out(np.asarray(out), aid in GREEN))
            ke, kg = fringe(np.asarray(out))
            fe, fg = fringe(cell)
            tot_e += ke
            tot_g += kg
            print(f'  {aid}: fringe {kg}/{ke} at {PX} px, {fg}/{fe} at the sheet\'s size')
            if check:
                continue
            rel = f'icons/{aid}.webp'
            save(out, rel)
            m['assets'][f'icon.{aid}'] = {'local': rel, 'remote': sheet + '.png', 'job': JOB, 'fit': f'sheet:{sheet}.{i}', 'rev': REV}
    print(f'fringe: {tot_g} of {tot_e} edge pixels keep a green cast')
    if not check:
        write_manifest(m)


if __name__ == '__main__':
    main(sys.argv[1:])
