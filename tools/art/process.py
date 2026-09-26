"""Art pass tool: fetch Higgsfield originals and bake the game-ready files in assets/.

    python tools/art/process.py                 # every manifest entry whose local file is missing
    python tools/art/process.py --force ids...  # rebuild the given ids (or all with --force alone)
    python tools/art/process.py --sheet out.png ids-prefix...   # contact sheet for review

Originals are cached in assets/raw/ (not committed). What each entry becomes is decided by its `fit`
field in assets/manifest.json, or by its kind when absent:

    sprite:<px>   trim to the alpha box + 4% margin, longest side <= px, PNG (ships, monsters, props, icons)
    overlay:<px>  keep the frame (curse overlays are stretched over the hull), longest side <= px, PNG
    opaque:<px>   no alpha, longest side <= px, JPEG q86 (portraits, textures, backgrounds, key art)

The client prefers the local file and falls back to the CDN original, so the local copy may be smaller.
Needs Pillow and numpy (dev only; the game itself has no dependencies).
"""

import json
import os
import sys
import urllib.request

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ASSETS = os.path.join(ROOT, 'assets')
RAW = os.path.join(ASSETS, 'raw')

DEFAULT_FIT = {
    'ship': 'sprite:768',
    'monster': 'sprite:1024',
    'creature': 'sprite:1024',
    'prop': 'sprite:768',
    'build': 'sprite:384',
    'icon': 'sprite:192',
    'fx': 'overlay:768',
    'part': 'sprite:512',
    'ui': 'sprite:1024',
    'tex': 'opaque:1024',
    'portrait': 'opaque:560',
    'card': 'opaque:960',
    'art': 'opaque:1920',
    'bg': 'opaque:1920',
}


def load_manifest():
    with open(os.path.join(ASSETS, 'manifest.json'), encoding='utf-8') as f:
        return json.load(f)


def fit_of(aid, entry):
    return entry.get('fit') or DEFAULT_FIT.get(aid.split('.')[0], 'sprite:768')


def raw_path(entry):
    return os.path.join(RAW, entry['remote'])


def fetch_raw(cdn, entry):
    p = raw_path(entry)
    if os.path.exists(p):
        return p
    os.makedirs(RAW, exist_ok=True)
    req = urllib.request.Request(cdn + entry['remote'], headers={'User-Agent': 'gravetide-art'})
    with urllib.request.urlopen(req, timeout=120) as r, open(p, 'wb') as f:
        f.write(r.read())
    return p


def shrink(img, longest):
    w, h = img.size
    k = longest / max(w, h)
    if k >= 1:
        return img
    return img.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)


def clean_alpha(img):
    """Drop the faint haze a generator leaves around a cut-out, keep soft edges."""
    a = np.asarray(img.getchannel('A')).astype(np.float32)
    a = np.clip((a - 10) * (255 / 245), 0, 255)
    out = img.copy()
    out.putalpha(Image.fromarray(a.astype(np.uint8)))
    return out


def trim(img, margin=0.04):
    a = np.asarray(img.getchannel('A'))
    ys, xs = np.nonzero(a > 24)
    if len(xs) == 0:
        return img
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    m = round(max(x1 - x0, y1 - y0) * margin)
    x0, y0 = max(0, x0 - m), max(0, y0 - m)
    x1, y1 = min(img.width, x1 + m), min(img.height, y1 + m)
    return img.crop((x0, y0, x1, y1))


def transparency(img):
    """Share of fully clear pixels: a sprite with none came back on a painted background."""
    if img.mode != 'RGBA':
        return 0.0
    a = np.asarray(img.getchannel('A'))
    return float((a < 16).mean())


def bake(aid, entry, cdn):
    src = fetch_raw(cdn, entry)
    mode, px = fit_of(aid, entry).split(':')
    px = int(px)
    img = Image.open(src)
    img.load()
    target = os.path.join(ASSETS, entry['local'])
    os.makedirs(os.path.dirname(target), exist_ok=True)
    note = ''
    if mode == 'opaque':
        img = shrink(img.convert('RGB'), px)
        if target.lower().endswith(('.jpg', '.jpeg')):
            img.save(target, 'JPEG', quality=86, optimize=True, progressive=True)
        else:
            img.save(target, 'PNG', optimize=True)
    else:
        img = img.convert('RGBA')
        clear = transparency(img)
        if clear < 0.02:
            note = f'  !! no transparent background ({clear:.1%} clear)'
        img = clean_alpha(img)
        if mode == 'sprite':
            img = trim(img)
        img = shrink(img, px)
        img.save(target, 'PNG', optimize=True)
    kb = os.path.getsize(target) // 1024
    print(f'{aid:34s} {img.width}x{img.height} {kb}KB -> assets/{entry["local"]}{note}')


def sheet(out, prefixes):
    m = load_manifest()
    ids = [i for i in m['assets'] if any(i.startswith(p) for p in prefixes)]
    cell = 256
    cols = min(6, max(1, len(ids)))
    rows = (len(ids) + cols - 1) // cols
    canvas = Image.new('RGB', (cols * cell, rows * (cell + 18)), (58, 66, 74))
    from PIL import ImageDraw
    d = ImageDraw.Draw(canvas)
    for k, aid in enumerate(ids):
        p = os.path.join(ASSETS, m['assets'][aid]['local'])
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGBA')
        im.thumbnail((cell - 8, cell - 8))
        x, y = (k % cols) * cell, (k // cols) * (cell + 18)
        # Checker behind alpha so halos and leftover backgrounds show.
        for cy in range(0, cell, 16):
            for cx in range(0, cell, 16):
                if (cx // 16 + cy // 16) % 2:
                    d.rectangle([x + cx, y + cy, x + cx + 15, y + cy + 15], fill=(74, 84, 94))
        canvas.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2), im)
        d.text((x + 4, y + cell + 2), aid, fill=(230, 220, 200))
    canvas.save(out)
    print(f'sheet: {len(ids)} assets -> {out}')


def main(argv):
    if argv[:1] == ['--sheet']:
        return sheet(argv[1], argv[2:] or [''])
    force = '--force' in argv
    only = [a for a in argv if not a.startswith('--')]
    m = load_manifest()
    failed = 0
    for aid, entry in m['assets'].items():
        if only and not any(aid == o or aid.startswith(o.rstrip('*')) and o.endswith('*') for o in only):
            continue
        if os.path.exists(os.path.join(ASSETS, entry['local'])) and not force:
            continue
        try:
            bake(aid, entry, m['cdn'])
        except Exception as e:  # keep going: one bad download must not stop the batch
            failed += 1
            print(f'{aid:34s} FAILED: {e}')
    if failed:
        sys.exit(1)


if __name__ == '__main__':
    main(sys.argv[1:])
