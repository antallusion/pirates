"""The owner's UI art pack (2026-10-17, painted in ChatGPT and approved by him): baked into the game's files.

    python tools/art/ui_pack.py [step ...]     steps: logo title load wheel icon icons way scout titans avif (all by default)

The originals lie in assets/raw/gt_ui/src/ (gitignored, copied from Downloads/gravetide_ui_pack); only what this
writes is kept in git. Nothing is generated: each picture is keyed, cut, graded and resized.

  logo    gt_logo.png (magenta)          -> ui/logo_{1024,512,256}.webp       keyed, despilled, trimmed
  title   gt_title_{wide,mobile}.png     -> art/title_{wide,mobile}.webp (+ AVIF)
  load    gt_load_{start,island,battle,sea}.png -> art/load_{start,isle,battle,sea}.webp (+ a phone's .m.webp, + AVIF)
  wheel   gt_loader_wheel.png (magenta)  -> ui/loader_wheel.webp               keyed, toned down to the game's brass
  icon    gt_icon.png                    -> client/favicon-32.png, icon-192/512.png, apple-touch-icon.png,
                                            assets/brand/bot_avatar_512.png
  icons   gt_icons.png (magenta, 4 x 4)  -> icons/<id>.webp (ICONS below)      keyed, cut, toned down
  way     gt_waystations.png (magenta)   -> props/way_{tavern,chapel,market}.webp
  scout   gt_scout.png (magenta)         -> ships/scout_cutter.webp
  titans  gt_titans_{1,2}.png            -> tools/art/bt_harvest.py (sheets anim_titans_1, anim_titans_2)
  avif    the AVIF twins of everything above (tools/art/pack_assets.py's rule: kept when 12 % smaller)

Run at a low priority (it sets its own process to «below normal» on Windows).
"""

import io
import json
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from register import MANIFEST, write_manifest  # noqa: E402
from slice_flags import key_magenta  # noqa: E402
from slice_sheet import cuts  # noqa: E402

SRC = os.path.join(ROOT, 'assets', 'raw', 'gt_ui', 'src')
A = os.path.join(ROOT, 'assets')
CLIENT = os.path.join(ROOT, 'client')
REV = 20261017200000
JOB = 'gpt-ui_pack'

# The icon sheet, in reading order: the asset id each cell becomes (None: not kept — the current one is better).
# The doubloon and the silver stack lose to the game's own (icons/doubloon.webp, icons/coin.webp: the crowned coins,
# darker and of one hand with the shop's prices) — compared side by side and not kept.
ICONS = [
    None, None, 'icon.ui_hourglass', 'icon.ui_scroll',
    'icon.ui_phial', 'icon.ui_spyglass', 'icon.ui_compass', 'icon.ui_chest',
    'icon.ui_brigade', 'icon.ui_anchor', 'icon.ui_cutlasses', 'icon.ui_cannon',
    'icon.ui_lighthouse', 'icon.ui_quill', 'icon.ui_gift', 'icon.ui_bell',
]


def below_normal() -> None:
    if os.name == 'nt':
        import ctypes
        k = ctypes.windll.kernel32
        k.SetPriorityClass(k.GetCurrentProcess(), 0x4000)


def src(name: str) -> Image.Image:
    return Image.open(os.path.join(SRC, name))


def keyed(name: str) -> np.ndarray:
    """Magenta keyed out (tools/art/slice_flags.py), and the magenta cast pulled out of every pixel whose red and blue
    stand alike above its green (slice_sheet.py's `despill`): no pink rim on the dark sea or the dark screens."""
    k = key_magenta(np.array(src(name).convert('RGBA')))
    f = k[:, :, :3].astype(np.int16)
    cast = np.clip(np.minimum(f[:, :, 0], f[:, :, 2]) - f[:, :, 1], 0, None) * (np.abs(f[:, :, 0] - f[:, :, 2]) <= 40)
    f[:, :, 0] -= cast
    f[:, :, 2] -= cast
    k[:, :, :3] = np.clip(f, 0, 255).astype(np.uint8)
    return k


def specks(k: np.ndarray, share: float = 0.002) -> np.ndarray:
    """Loose specks of the key (a stray dot of paint in the magenta) dropped: shapes under `share` of the largest."""
    lab, n = ndimage.label(k[:, :, 3] > 24)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        k[np.isin(lab, [q + 1 for q in range(n) if sizes[q] < share * sizes.max()]), 3] = 0
    return k


def trim(im: Image.Image, margin: int = 2) -> Image.Image:
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.nonzero(a > 8)
    return im.crop((max(0, xs.min() - margin), max(0, ys.min() - margin), min(im.width, xs.max() + 1 + margin), min(im.height, ys.max() + 1 + margin)))


def grade(k: np.ndarray, sat: float, gain: float, gamma: float = 1.0) -> np.ndarray:
    """Toned toward the game's muted Pirate Gothic palette (docs/06: saturation under ~35 %): the colour pulled toward
    its own grey by `sat`, the light lowered by `gain` (and `gamma` > 1 deepens the mid-tones)."""
    f = k[:, :, :3].astype(np.float32) / 255
    y = (0.299 * f[:, :, 0] + 0.587 * f[:, :, 1] + 0.114 * f[:, :, 2])[:, :, None]
    f = y + (f - y) * sat
    f = np.clip(f, 0, 1) ** gamma * gain
    out = k.copy()
    out[:, :, :3] = np.clip(f * 255 + 0.5, 0, 255).astype(np.uint8)
    return out


def fit(im: Image.Image, longest: int) -> Image.Image:
    s = longest / max(im.size)
    if s >= 1:
        return im
    if im.mode == 'RGBA':
        return im.convert('RGBa').resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS).convert('RGBA')
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def square(im: Image.Image, px: int, inner: float = 0.9) -> Image.Image:
    piece = fit(im, round(px * inner)) if max(im.size) > px * inner else im
    out = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    out.alpha_composite(piece, ((px - piece.width) // 2, (px - piece.height) // 2))
    return out


def save(im: Image.Image, rel: str, q: int = 88) -> str:
    p = os.path.join(A, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    print(f'{rel}: {im.size[0]}x{im.size[1]} {os.path.getsize(p) // 1024} K')
    return rel


MADE: list = []


def avif_twin(im: Image.Image, rel: str, q: int = 52) -> None:
    """An opaque painting's AVIF twin, encoded from the original (not from the lossy WebP: at pack_assets.py's quality
    68 a twin of the WebP came out no smaller); kept only when at most 88 % of the WebP's bytes, as there."""
    p = os.path.join(A, rel)
    out = p[:-5] + '.avif'
    b = io.BytesIO()
    im.save(b, 'AVIF', quality=q, speed=6)
    if b.tell() <= os.path.getsize(p) * 0.88:
        open(out, 'wb').write(b.getvalue())
        print(f'{rel[:-5]}.avif {b.tell() // 1024} K')
    elif os.path.exists(out):
        os.remove(out)


def reg(m: dict, aid: str, rel: str, fit_: str) -> None:
    m['assets'][aid] = {'local': rel, 'remote': 'gt_ui_pack.png', 'job': JOB, 'fit': fit_, 'rev': REV}
    MADE.append(rel)


# ------------------------------------------------------------------------------------------------ the steps

def logo(m: dict) -> None:
    k = specks(keyed('gt_logo.png'), 0.0005)
    im = trim(Image.fromarray(k), 4)
    # (the title's first bytes on a phone: a little lower quality than the icons, the AVIF twin from the keyed original)
    for px in (1024, 512, 256):
        rel = save(fit(im, px), f'ui/logo_{px}.webp', 82)
        reg(m, 'ui.logo' if px == 512 else f'ui.logo_{px}', rel, f'keyed:{px}')
        avif_twin(fit(im, px), rel, 56)


def title(m: dict) -> None:
    for name in ('wide', 'mobile'):
        im = src(f'gt_title_{name}.png').convert('RGB')
        # (one size: the page itself chooses the painting by the screen's shape, index.html, and a phone's title is
        #  its first look at the game — no half-size copy)
        rel = save(fit(im, 1536), f'art/title_{name}.webp', 82)
        reg(m, f'art.title_{name}', rel, 'opaque:1536')
        avif_twin(fit(im, 1536), rel)


LOADS = {'start': 'start', 'isle': 'island', 'battle': 'battle', 'sea': 'sea'}


def load(m: dict) -> None:
    for kind, f in LOADS.items():
        im = src(f'gt_load_{f}.png').convert('RGB')
        rel = save(fit(im, 1536), f'art/load_{kind}.webp', 80)
        save(fit(im, 1024), f'art/load_{kind}.m.webp', 78)
        avif_twin(fit(im, 1536), rel)
        avif_twin(fit(im, 1024), f'art/load_{kind}.m.webp')
        MADE.append(f'art/load_{kind}.m.webp')
        reg(m, f'art.load_{kind}', rel, 'opaque:1536')


def wheel(m: dict) -> None:
    k = grade(specks(keyed('gt_loader_wheel.png')), 0.5, 0.86, 1.1)
    im = trim(Image.fromarray(k), 2)
    reg(m, 'ui.loader_wheel', save(square(im, 256, 0.98), 'ui/loader_wheel.webp', 90), 'keyed:256')


def icon(m: dict) -> None:
    im = src('gt_icon.png').convert('RGB')
    S = im.width
    # The painting's rounded square stands on black: the corners outside it go clear (a tab's mark), or take the
    # storm's own dark blue where a square is wanted (the home screen's mark, the bot's picture: they round it
    # themselves).
    R = round(S * 0.175)
    big = Image.new('L', (S * 4, S * 4), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(big).rounded_rectangle((6, 6, S * 4 - 7, S * 4 - 7), radius=R * 4, fill=255)
    mask = big.resize((S, S), Image.LANCZOS)
    clear = im.convert('RGBA')
    clear.putalpha(mask)
    flat = Image.new('RGBA', (S, S), (10, 22, 34, 255))
    flat.alpha_composite(clear)
    flat = flat.convert('RGB')
    os.makedirs(os.path.join(A, 'brand'), exist_ok=True)
    out = {
        os.path.join(CLIENT, 'favicon-32.png'): fit(clear, 32),
        os.path.join(CLIENT, 'icon-192.png'): fit(clear, 192),
        os.path.join(CLIENT, 'icon-512.png'): fit(clear, 512),
        os.path.join(CLIENT, 'apple-touch-icon.png'): fit(flat, 180),
        os.path.join(A, 'brand', 'bot_avatar_512.png'): fit(flat, 512),
        os.path.join(A, 'brand', 'og_image.jpg'): None,
    }
    for p, pic in out.items():
        if pic is None:
            continue
        if pic.width > 32:
            pic = pic.quantize(256, method=Image.Quantize.FASTOCTREE if pic.mode == 'RGBA' else Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        pic.save(p, 'PNG', optimize=True)
        print(os.path.relpath(p, ROOT), pic.size, os.path.getsize(p) // 1024, 'K')
    # The link's picture (og:image, 1200 x 630): the title's wide painting under the logo.
    bg = src('gt_title_wide.png').convert('RGB')
    s = 1200 / bg.width
    bg = bg.resize((1200, round(bg.height * s)), Image.LANCZOS)
    top = max(0, (bg.height - 630) // 3)
    og = bg.crop((0, top, 1200, top + 630)).convert('RGBA')
    shade = np.zeros((630, 1200, 4), np.uint8)
    yy = np.linspace(0, 1, 630)[:, None]
    shade[:, :, 3] = (np.clip(0.55 - yy * 0.5, 0, 1) * 255).astype(np.uint8)
    og.alpha_composite(Image.fromarray(shade))
    lg = fit(Image.open(os.path.join(A, 'ui', 'logo_1024.webp')).convert('RGBA'), 520)
    og.alpha_composite(lg, ((1200 - lg.width) // 2, max(0, (630 - lg.height) // 2 - 10)))
    p = os.path.join(A, 'brand', 'og_image.jpg')
    og.convert('RGB').save(p, 'JPEG', quality=84, optimize=True, progressive=True)
    print('assets/brand/og_image.jpg', og.size, os.path.getsize(p) // 1024, 'K')


def icons(m: dict) -> None:
    k = keyed('gt_icons.png')
    solid = k[:, :, 3].astype(np.float32) / 255
    xs, ys = cuts(solid.sum(axis=0), 4), cuts(solid.sum(axis=1), 4)
    for i, aid in enumerate(ICONS):
        if not aid:
            continue
        r, c = divmod(i, 4)
        cell = k[ys[r]:ys[r + 1], xs[c]:xs[c + 1]].copy()
        alpha = cell[:, :, 3] > 24
        lab, n = ndimage.label(ndimage.binary_dilation(alpha, iterations=4))
        sizes = ndimage.sum(alpha, lab, range(1, n + 1))
        cell[~np.isin(lab, [q + 1 for q in range(n) if sizes[q] >= sizes.max() * 0.08]), 3] = 0
        # Brighter and more saturated than the game's icons (the green phial, the red ribbon, polished brass):
        # toned down a step, the strongest colours most.
        tone = {'icon.ui_phial': (0.36, 0.76), 'icon.ui_gift': (0.42, 0.78), 'icon.ui_lighthouse': (0.62, 0.8)}.get(aid, (0.58, 0.8))
        cell = grade(cell, tone[0], tone[1], 1.15)
        im = trim(Image.fromarray(cell), 1)
        name = aid.split('.', 1)[1]
        reg(m, aid, save(square(im, 192), f'icons/{name}.webp', 88), f'sheet:ui_pack.{i}')


def way(m: dict) -> None:
    k = specks(keyed('gt_waystations.png'), 0.004)
    solid = k[:, :, 3].astype(np.float32) / 255
    xs = cuts(solid.sum(axis=0), 3)
    for j, name in enumerate(('tavern', 'chapel', 'market')):
        cell = k[:, xs[j]:xs[j + 1]].copy()
        alpha = cell[:, :, 3] > 24
        lab, n = ndimage.label(ndimage.binary_dilation(alpha, iterations=3))
        sizes = ndimage.sum(alpha, lab, range(1, n + 1))
        cell[~np.isin(lab, [q + 1 for q in range(n) if sizes[q] >= sizes.max() * 0.02]), 3] = 0
        cell = grade(cell, 0.85, 0.94)
        im = trim(Image.fromarray(cell), 2)
        reg(m, f'prop.way_{name}', save(fit(im, 384), f'props/way_{name}.webp', 88), 'keyed:384')


def scout(m: dict) -> None:
    k = grade(specks(keyed('gt_scout.png'), 0.004), 0.85, 0.94)
    im = trim(Image.fromarray(k), 2)
    reg(m, 'ship.scout_cutter', save(fit(im, 256), 'ships/scout_cutter.webp', 88), 'keyed:256')


def titans(m: dict) -> None:
    # bt_harvest.py takes Downloads' «hf_<date>_<time>_gpt-<sheet>» name (its date is the asset's rev).
    pairs = []
    for n, sheet in ((1, 'anim_titans_1'), (2, 'anim_titans_2')):
        stem = f'hf_20261017_2001{n:02d}_gpt-{sheet}'
        dst = os.path.join(A, 'raw', stem + '.png')
        if not os.path.exists(dst):
            shutil.copyfile(os.path.join(SRC, f'gt_titans_{n}.png'), dst)
        pairs.append([f'sheet.{sheet}', stem])
    write_manifest(m)
    subprocess.run([sys.executable, os.path.join(HERE, 'bt_harvest.py'), json.dumps(pairs)], cwd=ROOT, check=True)
    with open(MANIFEST, encoding='utf-8') as f:
        m.update(json.load(f))
    for aid, e in m['assets'].items():
        if aid.startswith('unit.titan_'):
            MADE.append(e['local'])


def avif(m: dict) -> None:
    """AVIF twins of what this made (pack_assets.py's rule), the phone copies too."""
    from pack_assets import AVIF_GAIN, AVIF_Q
    files = set(MADE) | {e['local'] for aid, e in m['assets'].items() if e.get('job') == JOB or aid.startswith('unit.titan_')}
    for rel in sorted(files):
        if rel.startswith(('art/', 'ui/logo_')):
            continue  # (the paintings and the logo have theirs from the original: avif_twin)
        for r in (rel, rel.replace('.webp', '.m.webp')):
            p = os.path.join(A, r)
            if not os.path.exists(p) or not p.endswith('.webp'):
                continue
            im = Image.open(p)
            im.load()
            b = io.BytesIO()
            im.save(b, 'AVIF', quality=AVIF_Q, speed=6)
            out = p[:-5] + '.avif'
            if b.tell() <= os.path.getsize(p) * AVIF_GAIN:
                open(out, 'wb').write(b.getvalue())
                print(f'{r[:-5]}.avif {b.tell() // 1024} K (webp {os.path.getsize(p) // 1024} K)')
            elif os.path.exists(out):
                os.remove(out)


STEPS = {'logo': logo, 'title': title, 'load': load, 'wheel': wheel, 'icon': icon, 'icons': icons, 'way': way, 'scout': scout, 'titans': titans, 'avif': avif}


def main(argv: list) -> None:
    below_normal()
    with open(MANIFEST, encoding='utf-8') as f:
        m = json.load(f)
    for step in argv or list(STEPS):
        STEPS[step](m)
        if step != 'titans':
            write_manifest(m)


if __name__ == '__main__':
    main(sys.argv[1:])
