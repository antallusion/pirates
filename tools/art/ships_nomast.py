"""Ships without masts (owner 2026-11-16: «все корабли переделать без мачт и флагов, отдельно мачты с парусами, чтобы
анимировать»). Each ship's painting was edited on Higgsfield (Nano Banana Pro, Unlimited) into its bare hull with a
round mast step where each mast stood; the masts are painted once per rig and set on the steps by the renderer.

    python tools/art/ships_nomast.py '<json {name: hf_stem}>'   download, key, register ship.<name>_hull, find the steps

Writes assets/ships/<name>_hull.webp (the same size and centring as ship.<name>, so the renderer swaps it in place)
and the steps' places (fractions of the picture's height from its top, on its centreline) in
shared/src/data/maststeps.json.
"""
import json
import os
import sys
import urllib.request

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))
from register import MANIFEST, rev_of, write_manifest  # noqa: E402
from slice_flags import key_magenta  # noqa: E402

RAW = os.path.join(os.path.expanduser('~'), 'Downloads', 'gravetide_art', 'ships2', 'out')
STEPS = os.path.join(ROOT, 'shared', 'src', 'data', 'maststeps.json')


def write_ts(steps: dict) -> None:
    """The same data for the client (no JSON imports there): shared/src/data/maststeps.ts."""
    piv = steps.get('_pivot', {})
    ships = {k: v for k, v in sorted(steps.items()) if not k.startswith('_')}
    lines = ["// Written by tools/art/ships_nomast.py and tools/art/masts.py (2026-11-16): where each mastless hull's mast steps are",
             "// (fractions of its picture's height from the top, on its centreline), and each mast picture's pivot (its round top).",
             'export const MAST_STEPS: Record<string, number[]> = ' + json.dumps(ships, separators=(',', ':')) + ';',
             'export const MAST_PIVOT: Record<string, number> = ' + json.dumps(piv, separators=(',', ':')) + ';', '']
    with open(os.path.join(ROOT, 'shared', 'src', 'data', 'maststeps.ts'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def fetch(name: str, stem: str, cdn: str) -> str:
    os.makedirs(RAW, exist_ok=True)
    p = os.path.join(RAW, f'{name}.png')
    if not os.path.exists(p) or os.path.getsize(p) < 10000:
        req = urllib.request.Request(cdn + stem + '.png', headers={'User-Agent': 'gravetide-art'})
        with urllib.request.urlopen(req, timeout=120) as r, open(p, 'wb') as f:
            f.write(r.read())
    return p


def steps_of(a: np.ndarray) -> list[float]:
    """The mast steps: dark round spots on the hull's centreline, each ringed by lighter wood (fractions of the height)."""
    al = a[:, :, 3] > 128
    ys, xs = np.where(al)
    if not len(ys):
        return []
    y0, y1 = ys.min(), ys.max()
    cx = int(np.median(xs))
    W = xs.max() - xs.min()
    rgb = a[:, :, :3].astype(np.float32)
    lum = rgb.mean(axis=2)
    brass = np.clip((rgb[:, :, 0] - rgb[:, :, 2]) - 15, 0, None) * (lum > 70)
    # a dark disc ringed by lighter wood and brass, on the centreline, at any radius from 2.5 % to 6 % of the beam
    best = []
    for r in range(max(3, int(W * 0.025)), int(W * 0.06) + 1):
        yy, xx = np.mgrid[-2 * r:2 * r + 1, -2 * r:2 * r + 1]
        d = np.hypot(yy, xx)
        disk = (d <= r * 0.7).astype(np.float32)
        ring = ((d > r * 0.8) & (d <= r * 1.25)).astype(np.float32)
        disk /= disk.sum()
        ring /= ring.sum()
        sl, sb = lum[:, cx - 2 * r:cx + 2 * r + 1], brass[:, cx - 2 * r:cx + 2 * r + 1]
        best.append(ndimage.correlate(sl, ring)[:, 2 * r] - ndimage.correlate(sl, disk)[:, 2 * r] + 0.8 * ndimage.correlate(sb, ring)[:, 2 * r])
    sc = np.max(np.array(best), axis=0)
    sc[:y0 + int((y1 - y0) * 0.12)] = 0
    sc[y1 - int((y1 - y0) * 0.1):] = 0
    out: list[int] = []
    for y in np.argsort(sc)[::-1]:
        if sc[y] < sc.max() * 0.7:
            break
        if all(abs(int(y) - o) > (y1 - y0) * 0.07 for o in out):
            out.append(int(y))
        if len(out) >= 4:
            break
    return sorted(y / a.shape[0] for y in out)


def main(pairs: dict[str, str]) -> None:
    with open(MANIFEST, encoding='utf-8') as f:
        m = json.load(f)
    steps = json.load(open(STEPS, encoding='utf-8')) if os.path.exists(STEPS) else {}
    for name, stem in pairs.items():
        src = fetch(name, stem, m['cdn'])
        old = m['assets'].get(f'ship.{name}')
        ow, oh = Image.open(os.path.join(ROOT, 'assets', old['local'])).size if old else (320, 768)
        im = Image.fromarray(key_magenta(np.array(Image.open(src).convert('RGBA'))))
        # the painting keeps its source's frame (1024×1536 with the old sprite fitted in it): that fitted box cut back
        W, H = im.size
        s = min(1000 / ow, 1500 / oh)
        fw, fh = ow * s * W / 1024, oh * s * H / 1536
        box = ((W - fw) / 2, (H - fh) / 2, (W + fw) / 2, (H + fh) / 2)
        im = im.crop(tuple(round(v) for v in box)).convert('RGBa').resize((ow, oh), Image.LANCZOS).convert('RGBA')
        local = f'ships/{name}_hull.webp'
        im.save(os.path.join(ROOT, 'assets', local), 'WEBP', quality=90, method=6)
        m['assets'][f'ship.{name}_hull'] = {'local': local, 'remote': stem + '.png', 'job': stem.split('_', 3)[3], 'rev': rev_of(stem)}
        steps[name] = [round(v, 4) for v in steps_of(np.array(im))]
        print(name, (ow, oh), 'steps', steps[name])
    write_manifest(m)
    with open(STEPS, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(steps.items())), f, ensure_ascii=False, indent=0)
        f.write('\n')
    write_ts(steps)


if __name__ == '__main__':
    main(json.loads(sys.argv[1]))
