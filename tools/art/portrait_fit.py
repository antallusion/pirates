"""The faces of the portraits in their round frames (owner, 2026-10-26: «все лица должны находиться четко во фрейме»).

    python -I tools/art/portrait_fit.py            # measure, write shared/src/data/portraitfaces.ts, draw the sheets
    python -I tools/art/portrait_fit.py --no-sheets

What it does:
  faces     every portrait in assets/portraits/*.webp has a face box: its middle (x, y as shares of the picture's width
            and height) and its height (the hairline or the hat's brim to the chin, a beard's top half counted, as a
            share of the picture's height). No face detector is installed offline (OpenCV here is built without its
            cascades, there is no YuNet model), so the boxes are a table read off the paintings by eye on 10 % grids
            (assets/raw/faces/grid_*.png) and checked on the contact sheets this script draws: every face whole and in
            the middle of its ring at three sizes. FACES below is that table.
  sizes     each portrait's pixel size is read from its file (the CSS keeps the picture's own aspect; the size is only
            for the sheets and the tests).
  rings     the stock rings (the game's `ui.ring`, the HUD's `ui.portrait_ring`, the site's `ring_round`) and the nine
            cosmetic frames (`cos.frame_*`): the hole is the transparent region round the picture's middle (alpha < 0.5,
            the connected region holding the centre); its middle is that region's centroid, its radius the largest
            radius round that middle whose disc is at most 3 % covered by the frame (a spike or a ribbon at the rim may
            lie over the portrait's edge, never over the face, which takes the middle two thirds).
  output    shared/src/data/portraitfaces.ts (the tables); shared/src/data/portraitfit.ts does the arithmetic the
            game and the site share. The sheets go to assets/raw/faces/ (fit_*.png: every portrait in the stock ring at
            three sizes; frames_*.png: the nine frames round two portraits) — the same arithmetic as portraitfit.ts.
"""

import glob
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_TS = os.path.join(ROOT, 'shared', 'src', 'data', 'portraitfaces.ts')
SHEETS = os.path.join(ROOT, 'assets', 'raw', 'faces')

# The face boxes: [x, y, height] — the middle of the face as shares of the picture's width and height, the face's height
# (hairline or hat brim to chin) as a share of the picture's height. Read by eye, checked on the sheets.
FACES = {
    # the six captains (whole figures, 422×560)
    'corsair': (0.470, 0.178, 0.100),
    'smuggler': (0.500, 0.180, 0.110),
    'reaver': (0.490, 0.086, 0.095),
    'navigator': (0.520, 0.115, 0.090),
    'drowned': (0.700, 0.295, 0.200),
    'admiral': (0.450, 0.106, 0.095),
    # the barons (busts to the waist, 448×560)
    'baron_ashen_isles': (0.490, 0.210, 0.175),
    'baron_black_coast': (0.490, 0.200, 0.190),
    'baron_dead_mans_expanse': (0.510, 0.215, 0.200),
    'baron_drowned_crown': (0.500, 0.290, 0.160),
    'baron_gravewater': (0.500, 0.215, 0.190),
    'baron_leviathan_reach': (0.500, 0.210, 0.190),
    'baron_whispering': (0.500, 0.237, 0.215),
    # the quest givers (451×560)
    'giver_apothecary_f': (0.520, 0.205, 0.140),
    'giver_apothecary_m': (0.520, 0.190, 0.160),
    'giver_bosun_m': (0.490, 0.200, 0.180),
    'giver_cartographer_f': (0.520, 0.205, 0.170),
    'giver_cartographer_m': (0.460, 0.210, 0.180),
    'giver_cultist_f': (0.410, 0.275, 0.130),
    'giver_cultist_m': (0.490, 0.200, 0.160),
    'giver_envoy_f': (0.480, 0.190, 0.150),
    'giver_envoy_m': (0.530, 0.195, 0.170),
    'giver_fence_f': (0.480, 0.235, 0.190),
    'giver_fence_m': (0.510, 0.200, 0.160),
    'giver_fishwife_f': (0.480, 0.205, 0.160),
    'giver_garrison_captain_m': (0.500, 0.190, 0.160),
    'giver_harbour_master_f': (0.490, 0.205, 0.160),
    'giver_harbour_master_m': (0.480, 0.200, 0.170),
    'giver_hermit_f': (0.520, 0.215, 0.170),
    'giver_hermit_m': (0.500, 0.200, 0.170),
    'giver_lighthouse_keeper_f': (0.530, 0.220, 0.160),
    'giver_lighthouse_keeper_m': (0.480, 0.215, 0.160),
    'giver_merchant_f': (0.500, 0.210, 0.160),
    'giver_merchant_m': (0.460, 0.215, 0.160),
    'giver_old_needle': (0.450, 0.210, 0.150),
    'giver_old_salt_m': (0.470, 0.220, 0.160),
    'giver_pearl_diver_f': (0.470, 0.200, 0.160),
    'giver_pearl_diver_m': (0.500, 0.190, 0.160),
    'giver_priest_f': (0.450, 0.210, 0.160),
    'giver_priest_m': (0.480, 0.200, 0.170),
    'giver_shipwright_f': (0.470, 0.205, 0.160),
    'giver_shipwright_m': (0.510, 0.200, 0.170),
    'giver_smuggler_f': (0.480, 0.210, 0.150),
    'giver_smuggler_m': (0.490, 0.195, 0.140),
    'giver_tavern_keeper_m': (0.490, 0.180, 0.150),
    'giver_whaler_m': (0.520, 0.185, 0.150),
    'giver_widow_f': (0.430, 0.215, 0.160),
    # the ship's officers (320×400)
    'officer_anwen_coil': (0.540, 0.200, 0.160),
    'officer_ezekiel_thorne': (0.520, 0.215, 0.150),
    'officer_iron_jaw': (0.520, 0.175, 0.160),
    'officer_old_bones': (0.420, 0.231, 0.200),
    'officer_ruy_ketch': (0.460, 0.165, 0.190),
    'officer_tallow_marsh': (0.480, 0.231, 0.190),
    # the 24 pirate faces (head-and-shoulders, 448×560)
    'pirate_00': (0.490, 0.340, 0.360),
    'pirate_01': (0.470, 0.410, 0.280),
    'pirate_02': (0.530, 0.410, 0.280),
    'pirate_03': (0.470, 0.330, 0.310),
    'pirate_04': (0.500, 0.330, 0.300),
    'pirate_05': (0.470, 0.300, 0.300),
    'pirate_06': (0.470, 0.310, 0.300),
    'pirate_07': (0.490, 0.300, 0.310),
    'pirate_08': (0.480, 0.320, 0.340),
    'pirate_09': (0.470, 0.360, 0.300),
    'pirate_10': (0.500, 0.360, 0.300),
    'pirate_11': (0.480, 0.360, 0.300),
    'pirate_12': (0.470, 0.370, 0.280),
    'pirate_13': (0.470, 0.300, 0.300),
    'pirate_14': (0.500, 0.390, 0.250),
    'pirate_15': (0.470, 0.330, 0.320),
    'pirate_16': (0.460, 0.350, 0.300),
    'pirate_17': (0.420, 0.290, 0.310),
    'pirate_18': (0.430, 0.330, 0.360),
    'pirate_19': (0.400, 0.310, 0.320),
    'pirate_20': (0.400, 0.310, 0.300),
    'pirate_21': (0.320, 0.310, 0.260),
    'pirate_22': (0.460, 0.300, 0.300),
    'pirate_23': (0.450, 0.290, 0.300),
    # the island's residents (448×560)
    'res_carpenter_f': (0.550, 0.186, 0.210),
    'res_carpenter_m': (0.510, 0.220, 0.170),
    'res_cartographer_f': (0.310, 0.220, 0.150),
    'res_cartographer_m': (0.500, 0.210, 0.160),
    'res_cook_f': (0.580, 0.146, 0.210),
    'res_cook_m': (0.520, 0.190, 0.180),
    'res_fisher_f': (0.520, 0.146, 0.210),
    'res_fisher_m': (0.520, 0.220, 0.170),
    'res_gunner_f': (0.500, 0.156, 0.210),
    'res_gunner_m': (0.500, 0.203, 0.200),
    'res_herbalist_f': (0.530, 0.186, 0.190),
    'res_herbalist_m': (0.500, 0.200, 0.180),
    'res_pilot_f': (0.530, 0.156, 0.210),
    'res_pilot_m': (0.500, 0.190, 0.180),
    'res_smith_f': (0.550, 0.176, 0.210),
    'res_smith_m': (0.500, 0.193, 0.190),
    # a turned skipper
    'skipper_1': (0.500, 0.200, 0.180),
}

# The share of the hole's height the face takes, and the most it may take when a face painted near the picture's edge
# needs a closer view to stand in the middle with no bare edge (shared/src/data/portraitfit.ts: the same numbers).
AIM = 0.6
AIM_MAX = 0.84

RINGS = {
    'ui': 'assets/ui/ring.webp',
    'portrait': 'assets/ui/portrait_ring.webp',
    'site': 'site/img/ui/ring_round.webp',
}
FRAME_IDS = ['abyss', 'admiral', 'copper', 'coral', 'ghost', 'gold', 'kraken', 'rope', 'wheel']
for f in FRAME_IDS:
    RINGS[f'frame.{f}'] = f'assets/cosmetics/frame_{f}.webp'


def measure_ring(path):
    """The hole of a ring picture: its middle (shares of the width and the height) and its diameter (share of the width)."""
    a = np.array(Image.open(os.path.join(ROOT, path)).convert('RGBA'))[:, :, 3].astype(float) / 255
    h, w = a.shape
    lab, _ = ndimage.label(a < 0.5)
    hole = lab == lab[h // 2, w // 2]
    cy, cx = ndimage.center_of_mass(hole)
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot(yy - cy, xx - cx)
    r = 0.05 * w
    while (1 - hole[d <= r + 0.25].mean()) <= 0.03:
        r += 0.25
    return {'x': round(cx / w, 4), 'y': round(cy / h, 4), 'd': round(2 * r / w, 4), 'aspect': round(h / w, 4)}


def fit(face, aspect, aim=AIM):
    """The portrait in a hole 1 wide: its width and height and its offset (the same as faceFit in portraitfit.ts)."""
    cx, cy, fh = face
    best = None
    t = aim
    while True:
        ih = t / fh
        iw = ih / aspect
        k = max(1.0, 1 / iw, 1 / ih)
        iw, ih = iw * k, ih * k
        ox, oy = 0.5 - cx * iw, 0.5 - cy * ih
        ok = (1 - iw) - 1e-9 <= ox <= 1e-9 and (1 - ih) - 1e-9 <= oy <= 1e-9
        best = (iw, ih, min(0.0, max(1 - iw, ox)), min(0.0, max(1 - ih, oy)))
        if ok or t >= AIM_MAX - 1e-9:
            return best
        t = min(AIM_MAX, t + 0.02)


def ring_box(ring, stock):
    """A ring's picture in an avatar 1 wide whose stock ring is `stock`: (side, left, top, hole diameter)."""
    if ring is stock:
        s = 1.0
    else:
        s = min(1.35, stock['d'] / ring['d'])
    return s, 0.5 - ring['x'] * s, 0.5 - ring['y'] * ring['aspect'] * s, ring['d'] * s


def write_ts(sizes, rings):
    fam = {}
    lines = [
        '// GENERATED by tools/art/portrait_fit.py — do not edit by hand (the face boxes are its FACES table).',
        '// The face of every portrait and the hole of every round frame (owner, 2026-10-26: «все лица должны находиться четко',
        '// во фрейме»); shared/src/data/portraitfit.ts sets a portrait in a ring with them.',
        '',
        '/** A face box: its middle (shares of the picture\'s width and height) and its height (share of the picture\'s height). */',
        'export type FaceBox = readonly [x: number, y: number, h: number];',
        '',
        '/** Every portrait in assets/portraits: [face x, face y, face height, the picture\'s height over its width]. */',
        'export const PORTRAIT_FACES: Readonly<Record<string, readonly [number, number, number, number]>> = {',
    ]
    for k in sorted(FACES):
        x, y, h = FACES[k]
        w_, h_ = sizes[k]
        lines.append(f"  {k}: [{x}, {y}, {h}, {round(h_ / w_, 4)}],")
    lines += [
        '};',
        '',
        '/** A ring\'s hole: its middle (shares of the ring picture\'s width and height), its diameter (share of the width), the',
        ' *  picture\'s height over its width. `ui` the game\'s ring, `portrait` the HUD\'s unit-frame ring, `site` the site\'s',
        ' *  brass porthole, `frame.*` the cosmetic frames. */',
        'export interface RingHole { readonly x: number; readonly y: number; readonly d: number; readonly aspect: number }',
        'export const RING_HOLES: Readonly<Record<string, RingHole>> = {',
    ]
    for k, v in rings.items():
        lines.append(f"  '{k}': {{ x: {v['x']}, y: {v['y']}, d: {v['d']}, aspect: {v['aspect']} }},")
    lines += ['};', '']
    with open(OUT_TS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))


def avatar(img_path, face, ring_img, ring, stock, px):
    """An avatar px wide as the browser draws it (the stock ring's outer side = px)."""
    pic = Image.open(img_path).convert('RGB')
    w, h = pic.size
    s, rl, rt, hd = ring_box(ring, stock)
    big = px * 4
    canvas = Image.new('RGBA', (int(big * 1.8), int(big * 1.8)), (0, 0, 0, 0))
    o = int(big * 0.4)  # the canvas has room for a frame wider than the avatar
    D = hd * big
    iw, ih, ox, oy = fit(face, h / w)
    scaled = pic.resize((max(1, round(iw * D)), max(1, round(ih * D))), Image.LANCZOS)
    holeimg = Image.new('RGB', (round(D), round(D)))
    holeimg.paste(scaled, (round(ox * D), round(oy * D)))
    mask = Image.new('L', holeimg.size, 0)
    ImageDraw.Draw(mask).ellipse([0, 0, holeimg.size[0] - 1, holeimg.size[1] - 1], fill=255)
    hx = o + (big - D) / 2
    canvas.paste(holeimg, (round(hx), round(hx)), mask)
    rimg = ring_img.resize((round(s * big), round(s * big * ring['aspect'])), Image.LANCZOS)
    canvas.alpha_composite(rimg, (round(o + rl * big), round(o + rt * big)))
    return canvas.resize((canvas.size[0] // 4, canvas.size[1] // 4), Image.LANCZOS), (o // 4)


def sheets(sizes, rings):
    os.makedirs(SHEETS, exist_ok=True)
    stock = rings['ui']
    ring_img = {k: Image.open(os.path.join(ROOT, p)).convert('RGBA') for k, p in RINGS.items()}
    keys = sorted(FACES)
    pxs = (24, 48, 112)
    cell_w, cell_h = 330, 200
    cols = 4
    per = 24
    for p in range(0, len(keys), per):
        chunk = keys[p:p + per]
        rows = (len(chunk) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * cell_w, rows * cell_h), (58, 52, 44))
        d = ImageDraw.Draw(sheet)
        for i, k in enumerate(chunk):
            x0, y0 = (i % cols) * cell_w, (i // cols) * cell_h
            d.text((x0 + 8, y0 + 4), k, fill=(255, 235, 190))
            x = x0 + 8
            for px in pxs:
                av, o = avatar(os.path.join(ROOT, 'assets', 'portraits', f'{k}.webp'), FACES[k], ring_img['ui'], stock, stock, px)
                av = av.crop((o, o, o + px, o + px))
                sheet.paste(av, (x, y0 + 24 + (112 - px) // 2), av)
                x += px + 16
        sheet.save(os.path.join(SHEETS, f'fit_{p // per + 1}.png'))
    # the nine frames round two portraits (a captain's whole figure and a pirate's bust), at two sizes
    who = ['reaver', 'admiral', 'pirate_07']
    sheet = Image.new('RGB', (len(FRAME_IDS) * 170, len(who) * 2 * 150 + 20), (58, 52, 44))
    d = ImageDraw.Draw(sheet)
    for j, f in enumerate(FRAME_IDS):
        d.text((j * 170 + 10, 4), f, fill=(255, 235, 190))
        for i, k in enumerate(who):
            for n, px in enumerate((96, 40)):
                av, o = avatar(os.path.join(ROOT, 'assets', 'portraits', f'{k}.webp'), FACES[k], ring_img[f'frame.{f}'], rings[f'frame.{f}'], stock, px)
                y = 20 + (i * 2 + n) * 150 + (150 - av.size[1]) // 2
                sheet.paste(av, (j * 170 + (170 - av.size[0]) // 2, y), av)
    sheet.save(os.path.join(SHEETS, 'frames.png'))


def main():
    files = sorted(glob.glob(os.path.join(ROOT, 'assets', 'portraits', '*.webp')))
    sizes = {os.path.basename(f)[:-5]: Image.open(f).size for f in files}
    missing = sorted(set(sizes) - set(FACES))
    extra = sorted(set(FACES) - set(sizes))
    if missing or extra:
        sys.exit(f'face table out of step: missing {missing}, extra {extra}')
    rings = {k: measure_ring(p) for k, p in RINGS.items()}
    write_ts(sizes, rings)
    print(f'{len(FACES)} faces, {len(rings)} rings -> {os.path.relpath(OUT_TS, ROOT)}')
    if '--no-sheets' not in sys.argv:
        sheets(sizes, rings)
        print('sheets ->', os.path.relpath(SHEETS, ROOT))


if __name__ == '__main__':
    main()
