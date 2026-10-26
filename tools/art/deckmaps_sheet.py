"""The boarding's deck paintings as the field lays them (shared/src/data/deckmaps.ts), the half-deck's hex grid over
each, the hexes with no planks under them red: a contact sheet to author and check the maps by eye.

    python tools/art/deckmaps_sheet.py OUT.png [name,name,...] [cols]
"""
import json, math, os, subprocess, sys
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = sys.argv[1]
names = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else sorted(f[5:-5] for f in os.listdir(f'{ROOT}/assets/art') if f.startswith('deck_') and f.endswith('.webp'))
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 10
TW = int(os.environ.get('TW', '200'))
js = ("import('./shared/src/data/deckmaps.ts').then((m) => { const o = {}; for (const n of JSON.parse(process.argv[1])) "
      "o[n] = { ...m.deckMap('x'), ...m.DECK_MAPS[n] }; o.PW = m.DECK_PW; console.log(JSON.stringify(o)); })")
maps = json.loads(subprocess.check_output(['node', '--disable-warning=ExperimentalWarning', '-e', js, json.dumps(names)], cwd=ROOT))
PW = maps['PW']
SQ3 = math.sqrt(3); BW, BH = 5.0, 14.0 / SQ3; r = 1 / SQ3

def tile(name):
    m = maps[name]
    im = Image.open(f'{ROOT}/assets/art/deck_{name}.webp').convert('RGB')
    k = max(PW / (2 * m['hw'] * im.size[0]), BW / im.size[0], BH / im.size[1])
    dw, dh = im.size[0] * k, im.size[1] * k
    oy = max(BH - dh, min(0, (BH - dh) / 2 + m['dy'] * BH))
    sc = TW / BW
    t = Image.new('RGB', (TW, int(BH * sc) + 1))
    t.paste(im.resize((int(dw * sc), int(dh * sc))), (int((BW - dw) / 2 * sc), int(oy * sc)))
    d = ImageDraw.Draw(t, 'RGBA')
    for y in range(9):
        n = 5 if y % 2 == 0 else 4
        v = min(1 if y == 8 else 2, int(m['void'][y]))
        for c in range(n):
            cx, cy = c + 0.5 + (0.5 if y % 2 else 0), r + y * 1.5 * r
            bad = c < v or c >= n - v
            pts = [((cx + r * math.cos(math.radians(60 * j - 30))) * sc, (cy + r * math.sin(math.radians(60 * j - 30))) * sc) for j in range(6)]
            d.polygon(pts, outline=(255, 60, 60, 255) if bad else (150, 255, 150, 190), fill=(255, 0, 0, 100) if bad else None)
    d.rectangle((0, 0, TW, 12), fill=(0, 0, 0, 180))
    d.text((3, 0), name, fill=(255, 230, 90, 255))
    return t

tiles = [tile(n) for n in names]
th = tiles[0].size[1]
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * TW, rows * th), (12, 12, 12))
for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * TW, (i // cols) * th))
sheet.save(OUT)
print(len(tiles), sheet.size)
