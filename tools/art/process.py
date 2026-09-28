"""Art pass tool: fetch Higgsfield originals and bake the game-ready files in assets/.

    python tools/art/process.py                 # every manifest entry whose local file is missing
    python tools/art/process.py --force ids...  # rebuild the given ids (or all with --force alone)
    python tools/art/process.py --sheet out.png ids-prefix...   # contact sheet for review

Originals are cached in assets/raw/ (not committed). What each entry becomes is decided by its `fit`
field in assets/manifest.json, or by its kind when absent:

    sprite:<px>   trim to the alpha box + 4% margin, longest side <= px (ships, monsters, props, icons)
    overlay:<px>  keep the frame (curse overlays are stretched over the hull), longest side <= px
    opaque:<px>   no alpha, longest side <= px (portraits, textures, backgrounds, key art)
    keyed:<px>:#rrggbb  a sprite painted on a flat chroma-key colour (web-UI generations have no alpha): the key
                  colour (sampled from the border, near the given one) becomes transparent, edges are unmixed
    ...:<gain>    a numeric extra part lifts brightness (1.3 = +30%), for textures that read too dark in play
    ...:seam      make an opaque texture tile without seams (the half-shifted copy blended in at the edges)

An entry may also carry "crop": [x0, y0, x1, y1] in fractions of the original, to cut one cell of a sheet.

Files are written as WebP (lossy with alpha; a tenth of the PNG) unless the local path says .png or .jpg.
`--webp` moves every manifest entry to a .webp local path first (and removes the old baked file).

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
    'tex.chart': 'opaque:2048',
    'art.reference_captain': 'opaque:1024',
    'portrait': 'opaque:560',
    'card': 'opaque:960',
    'art': 'opaque:1920',
    'bg': 'opaque:1920',
}


def load_manifest():
    with open(os.path.join(ASSETS, 'manifest.json'), encoding='utf-8') as f:
        return json.load(f)


def fit_of(aid, entry):
    return entry.get('fit') or DEFAULT_FIT.get(aid) or DEFAULT_FIT.get(aid.split('.')[0], 'sprite:768')


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


def save(img, target, quality):
    low = target.lower()
    if low.endswith('.webp'):
        img.save(target, 'WEBP', quality=quality, method=6)
    elif low.endswith(('.jpg', '.jpeg')):
        img.convert('RGB').save(target, 'JPEG', quality=quality, optimize=True, progressive=True)
    else:
        img.save(target, 'PNG', optimize=True)


def to_webp(m):
    for entry in m['assets'].values():
        base, ext = os.path.splitext(entry['local'])
        if ext.lower() == '.webp':
            continue
        old = os.path.join(ASSETS, entry['local'])
        if os.path.exists(old):
            os.remove(old)
        entry['local'] = base + '.webp'
    sys.path.insert(0, os.path.dirname(__file__))
    from register import write_manifest
    write_manifest(m)


def chroma_key(img, hint):
    """Flat key colour -> alpha, by colour difference: how far the key's own channels stand above the others.
    The real key is the border's median (generators drift off the asked colour). A shadow on the key comes out as
    part-clear black; part-clear pixels are unmixed from the key, and edges lose the key's spill."""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    near = border[np.sqrt(((border - hint) ** 2).sum(-1)) < 120]
    key = np.median(near if len(near) > 50 else border, axis=0)
    hi = np.argsort(key)[::-1]
    one = key[hi[0]] - key[hi[1]] > 100  # green, blue or red; else two channels (magenta, cyan, yellow)
    own, rest = ([hi[0]], [hi[1], hi[2]]) if one else ([hi[0], hi[1]], [hi[2]])
    diff = lambda px: px[..., own].min(-1) - px[..., rest].max(-1)
    k = max(1.0, float(diff(key)))
    share = np.clip(diff(a) / k, 0, 1)  # how much of the key shows through
    # Colours are unmixed with the true (linear) cover, or smoke and nets keep a tint; the alpha itself is firmed up
    # so the sprite's body is solid and the flat key is clear.
    cover = (1 - share)[..., None]
    rgb = np.clip((a - (1 - cover) * key) / np.maximum(cover, 0.05), 0, 255)
    alpha = 1 - np.clip((share - 0.14) / 0.72, 0, 1)
    edge = alpha < 0.999
    # Despill the edges: the key's channels no higher than the others there.
    ex = np.clip(rgb[..., own].min(-1) - rgb[..., rest].max(-1), 0, None) * edge
    for c in own:
        rgb[..., c] -= ex
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def seamless(img):
    """Blend a half-shifted copy in toward the edges: the wrap then meets itself."""
    a = np.asarray(img).astype(np.float32)
    h, w = a.shape[:2]
    shifted = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    ys = np.minimum(np.arange(h), h - 1 - np.arange(h)) / (h / 2)
    xs = np.minimum(np.arange(w), w - 1 - np.arange(w)) / (w / 2)
    wgt = np.clip(np.minimum.outer(ys, xs) * 3, 0, 1)[..., None]
    return Image.fromarray((a * wgt + shifted * (1 - wgt)).astype(np.uint8), img.mode)


def bake(aid, entry, cdn):
    if fit_of(aid, entry).startswith('sheet:'):
        print(f'{aid}: cut from a sheet (tools/art/slice_flags.py), not baked here')
        return
    src = fetch_raw(cdn, entry)
    parts = fit_of(aid, entry).split(':')
    mode, px = parts[0], int(parts[1])
    extra = parts[2:]
    gain = next((float(p) for p in extra if p[:1].isdigit()), 1.0)
    key = next((p for p in extra if p.startswith('#')), '#00ff00')
    img = Image.open(src)
    img.load()
    if entry.get('crop'):
        x0, y0, x1, y1 = entry['crop']
        img = img.crop((round(x0 * img.width), round(y0 * img.height), round(x1 * img.width), round(y1 * img.height)))
    target = os.path.join(ASSETS, entry['local'])
    os.makedirs(os.path.dirname(target), exist_ok=True)
    note = ''
    if mode == 'opaque':
        img = img.convert('RGB')
        if 'seam' in extra:
            img = seamless(img)
        img = shrink(img, px)
        if gain != 1.0:
            from PIL import ImageEnhance
            img = ImageEnhance.Brightness(img).enhance(gain)
        save(img, target, 84)
    else:
        if mode == 'keyed':
            img = chroma_key(img, np.array([int(key[i:i + 2], 16) for i in (1, 3, 5)], np.float32))
            mode = 'sprite'
        img = img.convert('RGBA')
        clear = transparency(img)
        if clear < 0.02:
            note = f'  !! no transparent background ({clear:.1%} clear)'
        img = clean_alpha(img)
        if mode == 'sprite':
            img = trim(img)
        img = shrink(img, px)
        save(img, target, 88)
        if aid.startswith('prop.port_'):
            # The painted boats between the piers go: ships in port are the game's own (clear_quays.py).
            from clear_quays import clear as clear_quays
            clear_quays(target, aid.split('_', 1)[1], fresh=True)
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
    if '--webp' in argv:
        to_webp(m)
        force = True
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
