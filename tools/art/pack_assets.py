"""Asset delivery (docs/33 §Ассеты): texture sheets and AVIF twins, re-encoded from the pictures already in assets/
(nothing is generated, nothing painted).

  python tools/art/pack_assets.py            sheets + AVIF twins (only what is missing or older than its source)
  python tools/art/pack_assets.py --sheets   sheets only
  python tools/art/pack_assets.py --avif     AVIF twins only

Sheets (assets/sheets/<name>.webp, the map in assets/sheets/index.json: id -> [sheet, x, y, w, h]) — only the groups a
scene always asks for together and draws on its canvas (client/src/assets.ts cuts them back into one picture per id,
so the game's code keeps its ids):
  - a battle figure's four poses: unit.<kind>, _b, _atk, _hit (tactical.ts tacArt asks for all four);
  - the battle's effects: fx.bt_* (tacArt: all of them).
The DOM's pictures (<img>: icons, portraits, the island's buildings) stay one file each: a screen shows a few of a
family, and a sheet of the family would cost more bytes than it saves requests on HTTP/2.

AVIF twins: <file>.avif beside every .webp/.png/.jpg (and the sheets) when it is at least 12 % smaller; the client
asks for it when the browser decodes AVIF (assets.ts), the .webp otherwise.
Run it at a low priority: it encodes a few thousand pictures (`start /LOW` on Windows).
"""
import io
import json
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'assets'
SHEETS = ROOT / 'sheets'
PAD = 2
MAX_W = 2048
AVIF_Q = 68
AVIF_GAIN = 0.88  # kept only when at most 88 % of the source's bytes


def manifest():
    return json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['assets']


def groups(m):
    out = {}
    units = {}
    for id in m:
        if id.startswith('unit.'):
            base = id[5:]
            for suf in ('_b', '_atk', '_hit'):
                if base.endswith(suf):
                    base = base[: -len(suf)]
                    break
            units.setdefault(base, []).append(id)
    for k, ids in units.items():
        if len(ids) >= 2:
            out[f'unit-{k}'] = sorted(ids)
    out['fx-bt'] = sorted(i for i in m if i.startswith('fx.bt_'))
    # (part.* stay apart: the sea draws a few of them from its first frame, and their sheet cost the start 120 KB more
    #  on «Slow 4G» than the battle saves in requests — docs/33)
    return {k: v for k, v in out.items() if len(v) >= 2}


def pack(sizes):
    """Shelf packing, tallest first: [(x, y)] per input and the sheet's size."""
    order = sorted(range(len(sizes)), key=lambda i: -sizes[i][1])
    width = min(MAX_W, max(sum(w + PAD for w, _ in sizes), max(w for w, _ in sizes) + PAD))
    # a squarish sheet: rows about as wide as the pictures' total area wants
    area = sum((w + PAD) * (h + PAD) for w, h in sizes)
    width = max(max(w for w, _ in sizes) + PAD, min(width, int(area ** 0.5 * 1.15) + 1))
    pos = [None] * len(sizes)
    x = y = row = 0
    for i in order:
        w, h = sizes[i]
        if x + w + PAD > width:
            x, y, row = 0, y + row, 0
        pos[i] = (x, y)
        x += w + PAD
        row = max(row, h + PAD)
    return pos, width, y + row


def newer(out, *srcs):
    return out.exists() and all(out.stat().st_mtime >= s.stat().st_mtime for s in srcs)


def make_sheets(m):
    SHEETS.mkdir(exist_ok=True)
    index = {'version': 1, 'sheets': {}, 'ids': {}}
    for name, ids in groups(m).items():
        files = [ROOT / m[i]['local'] for i in ids]
        out = SHEETS / f'{name}.webp'
        ims = [Image.open(f) for f in files]
        sizes = [im.size for im in ims]
        pos, W, H = pack(sizes)
        if not newer(out, *files):
            sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            for im, (x, y) in zip(ims, pos):
                sheet.paste(im.convert('RGBA'), (x, y))
            sheet.save(out, 'WEBP', quality=90, method=6)
        index['sheets'][name] = {'file': f'sheets/{name}.webp', 'w': W, 'h': H}
        for i, im, (x, y) in zip(ids, ims, pos):
            index['ids'][i] = [name, x, y, im.size[0], im.size[1]]
    (SHEETS / 'index.json').write_text(json.dumps(index, separators=(',', ':')), encoding='utf-8')
    print(f"sheets: {len(index['sheets'])}, ids: {len(index['ids'])}")


def make_avif(paths):
    made = kept = skipped = 0
    saved = 0
    for p in paths:
        out = p.with_suffix('.avif')
        if newer(out, p):
            kept += 1
            continue
        try:
            im = Image.open(p)
            im.load()
            b = io.BytesIO()
            im.save(b, 'AVIF', quality=AVIF_Q, speed=6)
        except Exception as e:  # a picture Pillow cannot read: left as it is
            print('skip', p, e)
            continue
        src = p.stat().st_size
        if b.tell() <= src * AVIF_GAIN:
            out.write_bytes(b.getvalue())
            made += 1
            saved += src - b.tell()
        else:
            if out.exists():
                out.unlink()
            skipped += 1
        if (made + skipped) % 200 == 0:
            print(f'… {made + skipped} encoded', flush=True)
    print(f'avif: {made} made ({saved / 1e6:.1f} MB smaller than their sources), {kept} up to date, {skipped} not smaller')


def main():
    m = manifest()
    args = set(sys.argv[1:])
    if not args or '--sheets' in args:
        make_sheets(m)
    if not args or '--avif' in args:
        paths = []
        for e in m.values():
            p = ROOT / e['local']
            if p.suffix.lower() in ('.webp', '.png', '.jpg') and p.exists():
                paths.append(p)
                half = p.with_name(p.stem + '.m.webp')
                if p.suffix == '.webp' and half.exists():
                    paths.append(half)
        paths += sorted(SHEETS.glob('*.webp'))
        make_avif(sorted(set(paths)))


if __name__ == '__main__':
    main()
