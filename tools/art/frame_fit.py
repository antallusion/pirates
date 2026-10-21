"""Fit every battle figure's poses to its idle pose: the same body height, the same feet, the same place.

    python -I tools/art/frame_fit.py            # analyse, write shared/src/data/framefit.ts + the report + contact sheets
    python -I tools/art/frame_fit.py --no-sheets

Owner, 2026-10-21: «при атаке моделька была такой же по высоте как фактическая фигурка». A kind's four poses (idle,
idle a breath later `_b`, the blow `_atk`, the flinch `_hit`) were painted as separate figures, so the body is drawn at
a different size and place in each, and the creature shrinks or jumps as its frames swap. Nothing is re-encoded: this
measures the frames and writes a table that the renderers apply at draw time (client/src/ui/tactical.ts, the site's
shop window and bestiary pages).

The measure, per frame (all from the alpha channel of the asset as it is in assets/, see tools/art/sheets.json):
  effects     bright saturated blobs (fire, flashes, lightning, glows) are taken out of the alpha first.
  silhouette  alpha above a threshold taken from the cumulative alpha (the faint glow and soft shadow that hold the
              lowest 5 % of the alpha mass are dropped; the threshold is kept within 0.30-0.60), opened 3x3; the body is
              the largest blob plus the blobs near it or big beside it (a spark or a missile flown off is not body).
  core rows   rows whose filled width is at least 35 % of the median filled row: a raised sword, a spear, a tail, a
              whip of tendrils are thin and fall out. The core block is the longest run of core rows (small gaps
              bridged); its height is the core body height, its lowest row the ground line.
  estimates   the scale that brings the frame to the idle (a) core height, (b) sqrt of the body's area, (c) sqrt of the
              core rows' area. The scale is their median, held within +-3 % of (a) (the height is what the owner sees).
              If they disagree by more than 15 % the pose changed (a crouch, a kneeling shot, wings up, arms raised):
              the frame is flagged and gets the smaller of the height's and the mass's corrections (the conservative
              one; for nearly all it is the mass's — fitting a kneeling man to the standing one's height makes him a
              third bigger).
  the loop    the fitted frame is resampled and placed as the renderer will, measured again from scratch and the rest
              taken out (up to 5 times); a frame still more than 4 % off is flagged as unstable.
  anchor      vertical: the ground line (walkers, swimmers rising out of their water); the core's mass-middle for
              fliers (UNITS[...].specials 'flying' or unitart body 'fly'). Horizontal: the core's mass-median column, so
              a sword thrust forward stays forward and the body does not teleport.

The table (shared/src/data/framefit.ts), keyed by asset id: [scale, dx, dy, hr, ar]
  scale  times the frame's own pixels, on top of the idle's pixel scale;
  dx, dy where the frame's box bottom-centre goes, from the idle box's bottom-centre, in idle heights (y down);
  hr     the frame's native height / the idle's;  ar  the frame's width / height.
The idle pose has [1, 0, 0, 1, ar]. A frame with no entry is drawn as before.
"""

import ctypes
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ASSETS = os.path.join(ROOT, 'assets')
OUT_TS = os.path.join(ROOT, 'shared', 'src', 'data', 'framefit.ts')
OUT_DIR = os.path.join(ROOT, 'tools', 'art', 'framefit')
POSES = ('_b', '_atk', '_hit')

CORE_FRAC = 0.15       # a core row's filled width beside the median's (on the thick body)
THIN = 0.022           # what is thinner than this share of the height is not body (an opening by a disk)
THINS = (0.016, 0.022, 0.03)
FRACS = (0.1, 0.15, 0.22)
GROUND_Q = 0.003
COL_FRAC = 0.4
GLOW_MASS = 0.05       # the share of alpha mass a faint glow / soft shadow may hold
DISAGREE = 0.15        # estimates apart by more than this: flagged, height only
NEAR_H = 0.03          # the median's hold around the height estimate
CLAMP = (0.55, 1.8)
RENDER_H = 160         # the render height the ground line is checked at (px of the idle figure)


def below_normal() -> None:
    """The owner's PC is busy: this runs at BelowNormal priority."""
    if os.name == 'nt':
        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x4000)
    else:
        os.nice(5)


def kinds_info() -> dict:
    out = subprocess.run(['node', '--disable-warning=ExperimentalWarning', os.path.join('tools', 'art', 'frame_kinds.ts')],
                         cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout
    return json.loads(out)


def frame_sets() -> dict:
    """Every animated figure in the sheets (tools/art/sheets.json) whose frames are in the manifest: kind -> {pose: file}."""
    sheets = json.load(open(os.path.join(ROOT, 'tools', 'art', 'sheets.json'), encoding='utf-8'))
    man = json.load(open(os.path.join(ASSETS, 'manifest.json'), encoding='utf-8'))['assets']
    ids = set()
    for sh in sheets.values():
        for i in sh.get('ids') or []:
            if i and i.startswith('unit.'):
                ids.add(i)
    # The manifest's too (a sheet cut before sheets.json kept its ids).
    ids |= {k for k in man if k.startswith('unit.')}
    kinds = {}
    for i in ids:
        if i not in man:
            continue
        pose = next((p for p in POSES if i.endswith(p)), '')
        kind = i[5:len(i) - len(pose)] if pose else i[5:]
        kinds.setdefault(kind, {})[pose] = os.path.join(ASSETS, man[i]['local'])
    # A pose's name may be a kind's own (unit.x_b where x_b is a kind): only kinds with an idle and a pose count.
    return {k: v for k, v in sorted(kinds.items()) if '' in v and len(v) > 1}


# ---------------------------------------------------------------------------------------------------- the measure

def silhouette(alpha: np.ndarray) -> tuple:
    a = alpha.astype(np.float32) / 255.0
    nz = np.sort(a[a > 0.02])
    if nz.size == 0:
        return np.zeros_like(a, bool), 0.5
    c = np.cumsum(nz)
    t = float(nz[min(len(nz) - 1, int(np.searchsorted(c, GLOW_MASS * c[-1])))])
    t = min(0.6, max(0.3, t))
    m = ndimage.binary_opening(a >= t, np.ones((3, 3), bool))
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        big = int(np.argmax(sizes)) + 1
        ys = np.nonzero(m.any(1))[0]
        near = ndimage.binary_dilation(lab == big, iterations=max(2, int(0.04 * (ys[-1] - ys[0] + 1))))
        keep = np.zeros(n + 1, bool)
        for j in range(1, n + 1):
            s = sizes[j - 1]
            if j == big or s >= 0.12 * sizes[big - 1] or (s >= 30 and near[lab == j].any()):
                keep[j] = True
        m = keep[lab]
    return m, t


def disk(r: int) -> np.ndarray:
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r + r


def core_extent(m: np.ndarray, bh: int, thin: float, frac: float) -> tuple:
    """The core block of one setting: (top, ground, thick mask, core rows)."""
    h = m.shape[0]
    # The thick body: an opening by a disk of ~2 % of the figure's height takes off what is thin — a spear's shaft,
    # a sword's blade, a whip of tendrils, a thin tail — and keeps a leg, an arm, a trunk.
    r = max(2, round(thin * bh))
    tm = ndimage.binary_opening(np.pad(m, r + 1), disk(r))[r + 1:-r - 1, r + 1:-r - 1]
    if tm.sum() < 0.2 * m.sum():
        tm = m
    # The trunk's columns too: a breath of fire, a thrust spear, a lashed tail held out level are thick but short
    # in their columns beside the body's; columns under 40 % of the tall ones' (90th percentile) height fall out.
    colc = tm.sum(0)
    dense = colc >= COL_FRAC * np.percentile(colc[colc > 0], 90)
    dense = ndimage.binary_dilation(dense, iterations=r)
    tm = tm & dense[None, :]
    rows = tm.sum(1)
    med = float(np.median(rows[rows > 0]))
    core = rows >= frac * med
    # The runs of core rows, gaps of up to 3 % of the height bridged.
    gap = max(2, int(0.03 * bh))
    runs, start, last = [], None, None
    for y in np.nonzero(core)[0]:
        if start is None or y - last > gap + 1:
            if start is not None:
                runs.append((start, last))
            start = y
        last = y
    runs.append((start, last))
    # The biggest by the body it holds (a long thin run of a tail never outweighs the trunk).
    top, bot = (int(v) for v in max(runs, key=lambda q: rows[q[0]:q[1] + 1].sum()))
    # The ground: the feet, the legs' tips, the foot of its water — the lowest rows of the whole silhouette under the
    # thick body's columns, from the bottom up until 0.3 % of its mass (a stray speck or a frayed hem is not the ground).
    cols = ndimage.binary_dilation(tm[top:bot + 1].any(0), iterations=2 * r)
    rm = (m & cols).sum(1)
    suffix = np.cumsum(rm[::-1])[::-1]
    y = int(np.nonzero(suffix >= GROUND_Q * suffix[0])[0][-1])
    y = max(y, bot - r)
    return top, y, tm, core, dense


def measure(alpha: np.ndarray) -> dict:
    m_full, t = silhouette(alpha)
    h, w = m_full.shape
    ys0 = np.nonzero(m_full.any(1))[0]
    xs0 = np.nonzero(m_full.any(0))[0]
    if ys0.size == 0:
        return None
    # Work on the figure's own box (the verifier's canvas is wide).
    y0, x0 = int(ys0[0]), int(xs0[0])
    m = m_full[y0:ys0[-1] + 1, x0:xs0[-1] + 1]
    bh = m.shape[0]
    # A grid of settings round the middle one; the block's top and ground are the medians over it, so no single
    # threshold decides (a row at the edge of one is not at the edge of the others).
    tops, bots, mid = [], [], None
    for thin in THINS:
        for frac in FRACS:
            top, bot, tm, core, dense = core_extent(m, bh, thin, frac)
            tops.append(top)
            bots.append(bot)
            if thin == THIN and frac == CORE_FRAC:
                mid = (top, bot, tm, core, dense)
    top, bot = float(np.median(tops)), float(np.median(bots))
    t0, b0, tm, core, dense = mid
    band = tm[t0:b0 + 1] & core[t0:b0 + 1, None]
    ys, xs = np.nonzero(band)
    return {
        'w': w, 'h': h, 't': round(t, 3),
        'top': top + y0, 'ground': bot + y0, 'core_h': bot - top + 1,
        'area': int((m & dense[None, :]).sum()), 'core_area': int(band.sum()),
        'cx': float(np.median(xs)) + 0.5 + x0, 'cy': float(np.median(ys)) + t0 + y0 + 0.5,
        'mask': m_full,
    }


def body_alpha(rgba: np.ndarray) -> np.ndarray:
    """The alpha with the painted effects taken out: a breath of fire, a muzzle flash, a crackle of lightning, a magic
    glow are bright and saturated (value over 0.8, saturation over 0.5) where a body's paint, foam and steel are not.
    Taken out with a 2 px fringe when they make a blob (a glint on brass is left alone)."""
    rgb = rgba[:, :, :3].astype(np.float32) / 255.0
    mx, mn = rgb.max(2), rgb.min(2)
    fx = (mx > 0.8) & ((mx - mn) / np.maximum(mx, 1e-3) > 0.5) & (rgba[:, :, 3] > 40)
    fx = ndimage.binary_opening(fx, np.ones((3, 3), bool))
    lab, n = ndimage.label(fx)
    if n:
        sizes = ndimage.sum(fx, lab, range(1, n + 1))
        fx = np.isin(lab, np.nonzero(sizes >= 0.004 * (rgba[:, :, 3] > 40).sum())[0] + 1)
        fx = ndimage.binary_dilation(fx, iterations=2)
    a = rgba[:, :, 3].copy()
    # A creature of fire itself (a phoenix, a lava drake's hide): its effects are its body; nothing is taken.
    if a[fx].astype(np.float64).sum() <= 0.3 * a.astype(np.float64).sum():
        a[fx] = 0
    return a


def load_alpha(path: str) -> np.ndarray:
    return body_alpha(np.asarray(Image.open(path).convert('RGBA')))


def fit(idle: dict, f: dict, fly: bool) -> dict:
    s_h = idle['core_h'] / f['core_h']
    s_m = (idle['area'] / max(1, f['area'])) ** 0.5
    s_c = (idle['core_area'] / max(1, f['core_area'])) ** 0.5
    est = [s_h, s_m, s_c]
    spread = max(est) / min(est) - 1
    flags, basis = [], 'height'
    if spread > DISAGREE:
        # The height and the mass disagree: the pose changed, not the painter's scale (a lunge in a crouch, a kneeling
        # shot, wings up or down, arms raised, a tentacle curled). The conservative correction is the smaller one —
        # nearly always the mass's (the contact sheets show it): a kneeling rifleman fitted to the standing one's
        # height would be drawn a third bigger, his head too.
        s_mass = (s_m * s_c) ** 0.5
        s, basis = (s_h, 'height') if abs(np.log(s_h)) <= abs(np.log(s_mass)) else (s_mass, 'mass')
        flags.append(f'pose: estimates apart {spread * 100:.0f}% (h {s_h:.2f}, area {s_m:.2f}, core {s_c:.2f}) -> {basis}')
    else:
        s = min(s_h * (1 + NEAR_H), max(s_h * (1 - NEAR_H), float(np.median(est))))
    if not CLAMP[0] <= s <= CLAMP[1]:
        flags.append(f'scale {s:.2f} clamped')
        s = min(CLAMP[1], max(CLAMP[0], s))
    return place_fit(idle, f, fly, s, est, spread, flags, basis)


def place_fit(idle, f, fly, s, est, spread, flags, basis, cor=(0.0, 0.0)) -> dict:
    """Where the frame's top-left goes in the idle's pixels (plus a measured correction), and the table's numbers."""
    ox = idle['cx'] - s * f['cx'] + cor[0]
    oy = (idle['cy'] - s * f['cy'] if fly else (idle['ground'] + 1) - s * (f['ground'] + 1)) + cor[1]
    hi, wi = idle['h'], idle['w']
    dx = (ox + s * f['w'] / 2 - wi / 2) / hi
    dy = (oy + s * f['h'] - hi) / hi
    return {'scale': s, 'dx': dx, 'dy': dy, 'est': est, 'spread': spread, 'flags': flags, 'basis': basis,
            'ox': ox, 'oy': oy, 'cor': cor}


def refine(idle: dict, f: dict, fly: bool, alpha_i, alpha_f, r: dict) -> tuple:
    """The closed loop: draw the fitted frame as the renderer will (resampled, placed), measure it again from scratch
    and take out what is left — the height (for a height fit), the ground or the middle, the column — up to 5 times.
    What a frame's measure does at the edge of a threshold is caught here, not on the field."""
    v = verify(alpha_i, idle, alpha_f, r)
    best = (r, v)
    for _ in range(5):
        k = idle['h'] / RENDER_H
        err_h = v['core_ratio'] - 1 if r['basis'] == 'height' else v['area_ratio'] - 1
        err_y = (v['cy_px'] if fly else v['ground_px']) * k
        err_x = v['cx_px'] * k
        if abs(err_h) <= 0.015 and abs(err_y) * RENDER_H / idle['h'] <= 1 and abs(err_x) * RENDER_H / idle['h'] <= 1.5:
            break
        s = r['scale'] / (1 + max(-0.06, min(0.06, err_h)))
        r = place_fit(idle, f, fly, s, r['est'], r['spread'], r['flags'], r['basis'], (r['cor'][0] - err_x, r['cor'][1] - err_y))
        v = verify(alpha_i, idle, alpha_f, r)
        if _score(v, r, fly) < _score(best[1], best[0], fly):
            best = (r, v)
    r, v = best
    off = (v['core_ratio'] if r['basis'] == 'height' else v['area_ratio']) - 1
    if abs(off) > 0.04:
        r['flags'] = r['flags'] + [f'unstable measure: {r["basis"]} off {off * 100:+.0f}% after the fit']
    pos = v['cy_px'] if fly else v['ground_px']
    if abs(pos) > 3:
        r['flags'] = r['flags'] + [f'unstable measure: {"middle" if fly else "ground"} off {pos:+.1f} px after the fit']
    return r, v


def _score(v, r, fly) -> float:
    e = abs((v['core_ratio'] if r['basis'] == 'height' else v['area_ratio']) - 1) * 100
    return e + abs(v['cy_px'] if fly else v['ground_px']) + 0.5 * abs(v['cx_px'])


def place(alpha: np.ndarray, s: float, ox: float, oy: float, pad: int) -> tuple:
    """The frame resampled by s and set at (ox, oy) in the idle's pixels, on a canvas padded by `pad`."""
    h, w = alpha.shape
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    im = Image.fromarray(alpha).resize((nw, nh), Image.LANCZOS)
    return im, int(round(ox)) + pad, int(round(oy)) + pad


def verify(idle_alpha: np.ndarray, idle: dict, alpha: np.ndarray, r: dict) -> dict:
    """Re-measure the fitted frame from scratch (resampled and placed as the renderer does) against the idle's."""
    h, w = alpha.shape
    im = Image.fromarray(alpha).resize((max(1, round(w * r['scale'])), max(1, round(h * r['scale']))), Image.LANCZOS)
    x, y = int(round(r['ox'])), int(round(r['oy']))
    # The canvas: the idle's box and the frame's, with a margin.
    x0, y0 = min(0, x) - 8, min(0, y) - 8
    x1, y1 = max(idle['w'], x + im.width) + 8, max(idle['h'], y + im.height) + 8
    canvas = Image.new('L', (x1 - x0, y1 - y0), 0)
    canvas.paste(im, (x - x0, y - y0))
    m = measure(np.asarray(canvas))
    k = RENDER_H / idle['h']
    return {
        'core_ratio': m['core_h'] / idle['core_h'],
        'area_ratio': (m['area'] / idle['area']) ** 0.5,
        'ground_px': (m['ground'] + y0 - idle['ground']) * k,
        'cy_px': (m['cy'] + y0 - idle['cy']) * k,
        'cx_px': (m['cx'] + x0 - idle['cx']) * k,
    }


# ---------------------------------------------------------------------------------------------------- the review

def outline(m: np.ndarray) -> np.ndarray:
    return m & ~ndimage.binary_erosion(m, iterations=2)


def panel(rgba_idle, rgba_f, idle, f, mode, r, PH=220, PW=300):
    """One cell of the contact sheet: the idle (mode 'idle'), the frame as drawn now ('before': the idle's pixel scale,
    its feet on the line, centred) or fitted ('after'); the idle's outline in cyan, its core top and ground in lines."""
    k = PH * 0.78 / idle['h']
    base_y = PH * 0.9
    cell = Image.new('RGBA', (PW, PH), (22, 26, 38, 255))
    ix0 = PW / 2 - idle['w'] * k / 2
    iy0 = base_y - idle['h'] * k
    if mode == 'idle':
        src, s, x0, y0 = rgba_idle, 1.0, ix0, iy0
    elif mode == 'before':
        src, s = rgba_f, 1.0
        x0, y0 = PW / 2 - f['w'] * k / 2, base_y - f['h'] * k
    else:
        src, s = rgba_f, r['scale']
        x0, y0 = ix0 + r['ox'] * k, iy0 + r['oy'] * k
    im = src.resize((max(1, round(src.width * k * s)), max(1, round(src.height * k * s))), Image.LANCZOS)
    cell.alpha_composite(im, (int(round(x0)), int(round(y0)))) if 0 <= x0 and 0 <= y0 and x0 + im.width <= PW and y0 + im.height <= PH else _paste_clip(cell, im, x0, y0)
    d = ImageDraw.Draw(cell)
    if mode != 'idle':
        o = outline(idle['mask'])
        ys, xs = np.nonzero(o)
        for yy, xx in zip(ys[::3], xs[::3]):
            px, py = ix0 + xx * k, iy0 + yy * k
            d.point((px, py), fill=(80, 230, 255, 255))
    for yy, col in ((idle['top'], (255, 210, 90, 200)), (idle['ground'] + 1, (255, 120, 90, 220))):
        py = iy0 + yy * k
        d.line([(0, py), (PW, py)], fill=col, width=1)
    return cell


def _paste_clip(cell, im, x0, y0):
    x0, y0 = int(round(x0)), int(round(y0))
    cx0, cy0 = max(0, -x0), max(0, -y0)
    crop = im.crop((cx0, cy0, min(im.width, cell.width - x0), min(im.height, cell.height - y0)))
    if crop.width > 0 and crop.height > 0:
        cell.alpha_composite(crop, (max(0, x0), max(0, y0)))


def contact_sheets(rows: list, data: dict, name: str, per_page: int = 10) -> list:
    font = ImageFont.load_default()
    paths = []
    cols = ['idle', 'atk before', 'atk after', 'hit before', 'hit after']
    PW, PH, LW = 300, 220, 230
    for p in range(0, len(rows), per_page):
        chunk = rows[p:p + per_page]
        sheet = Image.new('RGB', (LW + PW * len(cols), 24 + PH * len(chunk)), (10, 12, 18))
        d = ImageDraw.Draw(sheet)
        for i, c in enumerate(cols):
            d.text((LW + i * PW + 8, 6), c, fill=(230, 220, 190), font=font)
        for j, kind in enumerate(chunk):
            k = data[kind]
            y = 24 + j * PH
            note = [kind] + [f"{pp[1:]}: x{k['fit'][pp]['scale']:.2f}{' FLAG' if k['fit'][pp]['flags'] else ''}"
                             for pp in POSES if pp in k['fit']]
            d.multiline_text((8, y + 8), '\n'.join(note), fill=(230, 220, 190), font=font, spacing=4)
            sheet.paste(panel(k['rgba'][''], k['rgba'][''], k['m'][''], k['m'][''], 'idle', None).convert('RGB'), (LW, y))
            for i, pp in enumerate(('_atk', '_hit')):
                if pp not in k['fit']:
                    continue
                for jj, mode in enumerate(('before', 'after')):
                    cell = panel(k['rgba'][''], k['rgba'][pp], k['m'][''], k['m'][pp], mode, k['fit'][pp])
                    sheet.paste(cell.convert('RGB'), (LW + PW * (1 + i * 2 + jj), y))
        path = os.path.join(OUT_DIR, f'{name}_{p // per_page + 1}.jpg')
        sheet.save(path, quality=70, optimize=True)
        paths.append(os.path.relpath(path, ROOT).replace('\\', '/'))
    return paths


# ---------------------------------------------------------------------------------------------------- the run

def main() -> None:
    below_normal()
    sheets = '--no-sheets' not in sys.argv
    info = kinds_info()
    sets = frame_sets()
    os.makedirs(OUT_DIR, exist_ok=True)
    table, report, data = {}, {}, {}
    for kind, files in sets.items():
        fly = bool(info.get(kind, {}).get('fly'))
        rgba = {p: Image.open(f).convert('RGBA') for p, f in files.items()}
        alpha = {p: body_alpha(np.asarray(im)) for p, im in rgba.items()}
        m = {p: measure(a) for p, a in alpha.items()}
        idle = m['']
        table[f'unit.{kind}'] = [1, 0, 0, 1, round(idle['w'] / idle['h'], 4)]
        rep = {'fly': fly, 'idle': {k: v for k, v in idle.items() if k != 'mask'}, 'frames': {}}
        fits = {}
        for p in POSES:
            if p not in m or m[p] is None:
                continue
            f = m[p]
            r, v = refine(idle, f, fly, alpha[''], alpha[p], fit(idle, f, fly))
            fits[p] = r
            table[f'unit.{kind}{p}'] = [round(r['scale'], 4), round(r['dx'], 4), round(r['dy'], 4),
                                        round(f['h'] / idle['h'], 4), round(f['w'] / f['h'], 4)]
            rep['frames'][p] = {
                'scale': round(r['scale'], 4), 'dx': round(r['dx'], 4), 'dy': round(r['dy'], 4),
                'est': [round(e, 4) for e in r['est']], 'spread': round(r['spread'], 4), 'flags': r['flags'], 'basis': r['basis'],
                # Before: the core height beside the idle's as the battle drew it (one pixel scale for all frames).
                'before_core_ratio': round(f['core_h'] / idle['core_h'], 4),
                'before_ground_px': round((f['h'] - f['ground'] - (idle['h'] - idle['ground'])) * RENDER_H / idle['h'], 2),
                'after': {k2: round(v2, 4) for k2, v2 in v.items()},
                'measure': {k2: v2 for k2, v2 in f.items() if k2 != 'mask'},
            }
        report[kind] = rep
        data[kind] = {'rgba': rgba, 'm': m, 'fit': fits}
        print(kind, ' '.join(f"{p}:x{fits[p]['scale']:.2f}" for p in fits), flush=True)

    # The table.
    lines = [
        '// Generated by tools/art/frame_fit.py — do not edit by hand; re-run it after a sheet is cut.',
        '// Every battle figure\'s poses fitted to its idle pose (owner, 2026-10-21: the blow\'s figure as tall as the',
        '// figure itself). Keyed by asset id: [scale, dx, dy, hr, ar] —',
        '//   scale  times the frame\'s own pixels, on top of the idle\'s pixel scale;',
        '//   dx, dy where the frame\'s box bottom-centre goes from the idle box\'s bottom-centre, in idle heights (y down);',
        '//   hr     the frame\'s native height / the idle\'s;  ar  the frame\'s width / height.',
        '// The idle pose is [1, 0, 0, 1, ar]. A frame with no entry is drawn as before.',
        '',
        'export type FitRow = readonly [scale: number, dx: number, dy: number, hr: number, ar: number];',
        '',
        'export const FRAME_FIT: Readonly<Record<string, FitRow>> = {',
    ]
    for k in sorted(table):
        lines.append(f"  '{k}': [{', '.join(_num(x) for x in table[k])}],")
    lines.append('};')
    lines.append('')
    body = open(OUT_TS, encoding='utf-8').read() if os.path.exists(OUT_TS) else ''
    tail = body.split('// ---- helpers', 1)[1] if '// ---- helpers' in body else ''
    with open(OUT_TS, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(lines) + ('// ---- helpers' + tail if tail else ''))

    # The report.
    allf = [(k, p, rep['frames'][p]) for k, rep in report.items() for p in rep['frames']]
    corr = lambda fr: abs(fr['scale'] - 1)  # noqa: E731
    per_kind = {k: max((corr(fr) for p, fr in rep['frames'].items() if p != '_b'), default=0) for k, rep in report.items()}
    flagged = sorted({k for k, p, fr in allf if fr['flags']})
    summary = {
        'kinds': len(report), 'frames': len(allf),
        'kinds_over_5pct': sum(v > 0.05 for v in per_kind.values()),
        'kinds_over_15pct': sum(v > 0.15 for v in per_kind.values()),
        'frames_over_5pct': sum(corr(fr) > 0.05 for _, _, fr in allf),
        'frames_over_15pct': sum(corr(fr) > 0.15 for _, _, fr in allf),
        'max': max(((corr(fr), f'{k}{p}', fr['scale']) for k, p, fr in allf), default=None),
        'worst': sorted(per_kind, key=lambda k: -per_kind[k])[:12],
        'flagged': {k: {p: fr['flags'] for p, fr in report[k]['frames'].items() if fr['flags']} for k in flagged},
        'after_worst_core': max(abs(fr['after']['core_ratio'] - 1) for _, _, fr in allf),
        'after_worst_ground_px': max(abs(fr['after']['ground_px']) for k, _, fr in allf if not report[k]['fly']),
    }
    if sheets:
        for old in os.listdir(OUT_DIR):
            if old.endswith('.jpg'):
                os.remove(os.path.join(OUT_DIR, old))
        top = sorted(per_kind, key=lambda k: -per_kind[k])[:20]
        summary['contact_worst'] = contact_sheets(top, data, 'worst')
        summary['contact_flagged'] = contact_sheets(flagged, data, 'flagged') if flagged else []
        summary['contact_merrow'] = contact_sheets(['merrow_warden'], data, 'merrow_warden')
    json.dump({'summary': summary, 'kinds': report}, open(os.path.join(OUT_DIR, 'report.json'), 'w', encoding='utf-8'), indent=1)
    print(json.dumps(summary, indent=1))


def _num(x) -> str:
    if x == int(x):
        return str(int(x))
    return f'{x:.4f}'.rstrip('0').rstrip('.')


if __name__ == '__main__':
    main()
