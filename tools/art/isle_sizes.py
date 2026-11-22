"""The island screen's maps by the island's size (owner 2026-11-22: «три разных острова, маленький, средний, большой»).
The middling island keeps its biome's map; the large is the map's middle 76 % brought to the full frame and repainted
in full detail on Higgsfield, the small the map at 70 % in a blank frame whose sea Higgsfield painted round it. The
plateau's corners follow from the biome's own by the same crop or shrink (the model keeps the composition).

    python tools/art/isle_sizes.py '<json {"temperate_large": hf_stem, ...}>'

Writes assets/isle/map_<view>.jpg (1536 × 1024), registers isle.map.<view>, and the corners into
shared/src/data/isleiso.ts (ISO_CORNERS, after the biome's own).
"""
import json
import os
import re
import sys
import urllib.request

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))
from register import MANIFEST, rev_of, write_manifest  # noqa: E402

RAW = os.path.join(os.path.expanduser('~'), 'Downloads', 'gravetide_art', 'isles3')
ISO = os.path.join(ROOT, 'shared', 'src', 'data', 'isleiso.ts')
W, H = 1536, 1024
LARGE_K, SMALL_K = 0.76, 0.70  # the crop's share (large) and the shrink (small): as the sources were made


def corners_of(src: str, m: str) -> dict:
    c = re.search(m + r': \{ t: \[(\d+), (\d+)\], r: \[(\d+), (\d+)\], b: \[(\d+), (\d+)\], l: \[(\d+), (\d+)\] \}', src)
    v = list(map(int, c.groups()))
    return {k: (v[2 * i], v[2 * i + 1]) for i, k in enumerate('trbl')}


def sized(pt: tuple, size: str) -> tuple:
    x, y = pt
    if size == 'large':
        cw, ch = int(W * LARGE_K), int(H * LARGE_K)
        x0, y0 = (W - cw) // 2, 0  # from the top: the plateau sits low enough for the hall's spire
        return round((x - x0) / LARGE_K), round((y - y0) / LARGE_K)
    return round(W / 2 + (x - W / 2) * SMALL_K), round(H / 2 + (y - H / 2) * SMALL_K)


def main(pairs: dict) -> None:
    with open(MANIFEST, encoding='utf-8') as f:
        man = json.load(f)
    src = open(ISO, encoding='utf-8').read()
    for view, stem in pairs.items():
        m, size = view.rsplit('_', 1)
        p = os.path.join(RAW, stem + '.png')
        if not os.path.exists(p):
            req = urllib.request.Request(man['cdn'] + stem + '.png', headers={'User-Agent': 'gravetide-art'})
            with urllib.request.urlopen(req, timeout=120) as r, open(p, 'wb') as f:
                f.write(r.read())
        im = Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)
        local = f'isle/map_{view}.jpg'
        im.save(os.path.join(ROOT, 'assets', local), quality=88, optimize=True, progressive=True)
        man['assets'][f'isle.map.{view}'] = {'local': local, 'remote': stem + '.png', 'job': stem.split('_', 3)[3], 'fit': 'opaque:1536', 'rev': rev_of(stem)}
        c = {k: sized(v, size) for k, v in corners_of(src, m).items()}
        line = f"  {view}: {{ t: [{c['t'][0]}, {c['t'][1]}], r: [{c['r'][0]}, {c['r'][1]}], b: [{c['b'][0]}, {c['b'][1]}], l: [{c['l'][0]}, {c['l'][1]}] }},"
        src = re.sub(r'\n  ' + view + r': \{[^\n]*\},', '', src)
        src = re.sub(r'(\n  ' + m + r': \{ t: [^\n]*\},)', lambda mm: mm.group(1) + '\n' + line, src, count=1)
        print(view, c)
    write_manifest(man)
    open(ISO, 'w', encoding='utf-8').write(src)


if __name__ == '__main__':
    main(json.loads(sys.argv[1]))
