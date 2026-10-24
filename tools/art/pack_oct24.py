"""The owner's 56 ChatGPT sheets of 2026-10-24 (docs/ART_TODO.md §4-§6), cut into 242 cells by cut_todo_sheets.py, baked
into the game's files and registered in assets/manifest.json.

    python -I tools/art/pack_oct24.py [--check] [--only <prefix>]

The cells are read from assets/raw/art2026-10-24/_cells/ (gitignored; copied from Downloads/gravetide_art) with their
index.json (sheet and box of each). Nothing is generated: each cell is trimmed, keyed or squared, resized and encoded
(WebP + an AVIF twin when it is smaller, skills_pack.save). The few places the owner's content rule forbids (no blood,
no skulls, no bones) are retouched by code here (FIXES), so a re-run gives the same files.

  panel  bg.port_* / bg.* / card.*   the dark gutter's last pixels trimmed, longest side <= 1536, opaque
  green  prop.port_* (towns)         keyed off the chroma green (cosmetics_pack.key_green: Vlahos + despill), trimmed,
                                     set on a square with the piers at its foot (renderer.ts drawPorts draws the
                                     painting square, its lowest 0.265 over the water), the painted boats between
                                     the piers cleared (clear_quays.py, its slips registered); then run quay_piers.py
         prop.citadel/lookout/castaways, isle.pen   keyed, trimmed, longest side <= 640
  icon   icon.*                      the black gutter trimmed, the middle square cut, 192 x 192 (the game's icon size)
  map    isle.map.dry / drowned      1536 x 1024 JPEG like the other four maps (ISO_CORNERS set by eye in isleiso.ts)

--check only reports the keyed sprites' fringe (rim pixels with a green cast) and writes nothing.
Run at a low priority (it sets its own process to «below normal» on Windows).
"""

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
from skills_pack import below_normal, despill_out, fringe, neighbours_off, save, trim  # noqa: E402
from cosmetics_pack import key_green  # noqa: E402

SRC = os.path.join(ROOT, 'assets', 'raw', 'art2026-10-24', '_cells')
A = os.path.join(ROOT, 'assets')
REV = 20261024120000
JOB = 'gpt-art_oct24'
PANEL_MAX = 1536
SPRITE_MAX = 640
ICON = 192
RING = 0.49  # the chart marks' brass ring's outer radius, a share of the icon's side

FOLDER = {'bg': 'art', 'card': 'cards', 'icon': 'icons', 'prop': 'props', 'isle': 'isle'}


def rel_of(aid: str) -> str:
    kind, name = aid.split('.', 1)
    if aid.startswith('isle.map.'):
        return f'isle/map_{name.split(".", 1)[1]}.jpg'
    return f'{FOLDER[kind]}/{name.replace(".", "_")}.webp'


# ---- the owner's content rule, retouched by code -----------------------------------------------------------------------

def inpaint(rgb: np.ndarray, box: tuple, bright: int) -> np.ndarray:
    """A flag's pale emblem (a skull and crossbones) painted out: what is lighter than `bright` inside `box` is filled
    from the dark cloth around it (OpenCV's Telea inpainting)."""
    import cv2
    x0, y0, x1, y1 = box
    lum = rgb.astype(np.float32) @ np.array([0.3, 0.59, 0.11], np.float32)
    mask = np.zeros(lum.shape, np.uint8)
    sub = lum[y0:y1, x0:x1] > bright
    mask[y0:y1, x0:x1] = sub.astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)
    return cv2.inpaint(np.ascontiguousarray(rgb), mask, 3, cv2.INPAINT_TELEA)


def axe_rust(rgb: np.ndarray) -> np.ndarray:
    """The red-hook axe's blade: its red lacquer read as blood (owner, 2026-10-24) — every red pixel on the blade turned to
    a dark rusted brass of its own brightness, the change feathered so no edge shows."""
    f = rgb.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    h, w = r.shape
    red = np.clip((r - np.maximum(g, b) * 1.25) / 40, 0, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    blade = (xx > w * 0.42) & (yy < h * 0.62)
    m = ndimage.gaussian_filter(red * blade, 1.2)[..., None]
    v = np.maximum(r, np.maximum(g, b))[..., None] * 0.62 + f.mean(axis=2, keepdims=True) * 0.38
    rust = np.concatenate([v * 0.78, v * 0.56, v * 0.34], axis=2)
    return (f * (1 - m) + rust * m).clip(0, 255).astype(np.uint8)


FIXES = {
    # the Jolly Roger on the black flag top left (a skull over crossed bones)
    'card.ch_22': lambda c: inpaint(c, (36, 32, 62, 72), 60),
    # the small black flag over the fort with a pale skull on it
    'bg.port_gen_dead_confederacy': lambda c: inpaint(c, (526, 70, 545, 97), 45),
    'icon.art_red_hook_axe': axe_rust,
}


# ---- the kinds ----------------------------------------------------------------------------------------------------------

def edge_trim(rgb: np.ndarray, dark: float = 16, most: int = 10) -> np.ndarray:
    """The black gutter's last rows and columns cut off the cell's edges (at most `most` px a side)."""
    lum = rgb.astype(np.float32).mean(axis=2)
    t, b, l, r = 0, lum.shape[0], 0, lum.shape[1]
    while t < most and lum[t, l:r].mean() < dark:
        t += 1
    while lum.shape[0] - b < most and lum[b - 1, l:r].mean() < dark:
        b -= 1
    while l < most and lum[t:b, l].mean() < dark:
        l += 1
    while lum.shape[1] - r < most and lum[t:b, r - 1].mean() < dark:
        r -= 1
    return rgb[t:b, l:r]


def shrink(im: Image.Image, longest: int) -> Image.Image:
    k = longest / max(im.size)
    if k >= 1:
        return im
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def panel(aid: str, rgb: np.ndarray) -> Image.Image:
    rgb = edge_trim(rgb)
    if aid in FIXES:
        rgb = FIXES[aid](rgb)
    return shrink(Image.fromarray(rgb), PANEL_MAX)


def icon(aid: str, rgb: np.ndarray) -> Image.Image:
    rgb = edge_trim(rgb, dark=22, most=24)
    h, w = rgb.shape[:2]
    s = min(h, w)
    y0, x0 = (h - s) // 2, (w - s) // 2
    rgb = np.ascontiguousarray(rgb[y0:y0 + s, x0:x0 + s])
    if aid in FIXES:
        rgb = FIXES[aid](rgb)
    im = Image.fromarray(rgb).resize((ICON, ICON), Image.LANCZOS)
    if aid.startswith('icon.map_port_'):
        # the chart's marks: the painting inside its brass ring only (the dark square round it would sit on the chart
        # as a tile), the ring's outer edge feathered over a pixel and a half
        yy, xx = np.mgrid[0:ICON, 0:ICON]
        r = np.hypot(xx - (ICON - 1) / 2, yy - (ICON - 1) / 2)
        a = np.clip((ICON * RING - r) / 1.5, 0, 1)
        im = im.convert('RGBA')
        im.putalpha(Image.fromarray((a * 255).astype(np.uint8)))
    return im


def keyed(aid: str, rgb: np.ndarray) -> np.ndarray:
    d = rgb[:, :, 1].astype(np.int16) - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    bg = d > 200
    key = rgb[bg].astype(np.float32).mean(axis=0)
    kd = float(np.median(d[bg])) - 1
    # (a painted body keeps a little green of its own deep inside — the copper roofs, the Choir's lanterns, the moss stand
    #  at a dominance under 40 — and the key's shaded pockets between the piers (60–200) go; the castaways' foam was
    #  painted see-through over the key, so it keeps none)
    cell = key_green(rgb, key, kd, 0 if aid == 'prop.castaways' else 40, 160)
    return neighbours_off(cell)


def town(cell: np.ndarray) -> Image.Image:
    """Square, the town centred across and standing on the foot: its piers reach the painting's lowest quarter, which
    the renderer lays over the water."""
    im = trim(Image.fromarray(cell), 2)
    w, h = im.size
    s = max(w, h) + 8
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sq.alpha_composite(im, ((s - w) // 2, s - h - 2))
    return shrink(sq.convert('RGBa'), SPRITE_MAX).convert('RGBA')


def sprite(cell: np.ndarray) -> Image.Image:
    im = trim(Image.fromarray(cell), 4)
    return shrink(im.convert('RGBa'), SPRITE_MAX).convert('RGBA')


def main(argv: list) -> None:
    below_normal()
    check = '--check' in argv
    only = argv[argv.index('--only') + 1] if '--only' in argv else ''
    index = json.load(open(os.path.join(SRC, 'index.json'), encoding='utf-8'))
    with open(MANIFEST, encoding='utf-8') as f:
        m = json.load(f)
    tot_e = tot_g = 0
    n = 0
    for aid, meta in index.items():
        if only and not aid.startswith(only):
            continue
        rgb = np.asarray(Image.open(os.path.join(SRC, aid + '.png')).convert('RGB'))
        sheet = os.path.splitext(os.path.basename(meta['sheet']))[0]
        rel = rel_of(aid)
        if meta['kind'] == 'green':
            cell = keyed(aid, rgb)
            out = town(cell) if aid.startswith('prop.port_') else sprite(cell)
            out = Image.fromarray(despill_out(np.asarray(out), True))
            ke, kg = fringe(np.asarray(out))
            tot_e += ke
            tot_g += kg
            print(f'  {aid}: fringe {kg}/{ke} at {out.size[0]}x{out.size[1]}')
        elif aid.startswith('icon.'):
            out = icon(aid, rgb)
        elif aid.startswith('isle.map.'):
            out = Image.fromarray(rgb).resize((1536, 1024), Image.LANCZOS) if rgb.shape[:2] != (1024, 1536) else Image.fromarray(rgb)
        else:
            out = panel(aid, rgb)
        if check:
            continue
        os.makedirs(os.path.join(A, os.path.dirname(rel)), exist_ok=True)
        if rel.endswith('.jpg'):
            p = os.path.join(A, rel)
            out.convert('RGB').save(p, 'JPEG', quality=86, optimize=True, progressive=True)
            import io
            from pack_assets import AVIF_GAIN, AVIF_Q
            b = io.BytesIO()
            out.convert('RGB').save(b, 'AVIF', quality=AVIF_Q, speed=6)
            if b.tell() <= os.path.getsize(p) * AVIF_GAIN:
                open(p[:-4] + '.avif', 'wb').write(b.getvalue())
            print(f'{rel}: {out.size[0]}x{out.size[1]}')
        else:
            save(out, rel, 88 if out.mode == 'RGBA' else 84)
        entry = {'local': rel, 'remote': sheet + '.png', 'job': JOB, 'fit': f'sheet:{sheet}', 'rev': REV}
        if aid.startswith('prop.port_'):
            # The painted boats between the piers go, as process.py does for every town: ships in port are the game's
            # own (clear_quays.py, which keeps the original in assets/raw/port_orig/ and finds the slips between the piers,
            # where ships in port are moored); the cleared painting is encoded again with its AVIF twin.
            import clear_quays
            p = os.path.join(A, rel)
            clear_quays.clear(p, aid.split('_', 1)[1], fresh=True)
            cleared = Image.open(p)
            cleared.load()
            save(cleared.convert('RGBA'), rel, 88)
            if clear_quays.SLIPS:
                entry['slips'] = clear_quays.SLIPS
        m['assets'][aid] = entry
        n += 1
    print(f'fringe: {tot_g} of {tot_e} rim pixels keep a green cast')
    if not check:
        write_manifest(m)
        print(n, 'assets registered')


if __name__ == '__main__':
    main(sys.argv[1:])
