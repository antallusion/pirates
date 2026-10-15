"""Half-size copies of the sea's tiled textures for phones (owner, 2026-10-15: «все должно подгружаться быстро»).

The sea draws these tiles at 60-450 screen px each (renderer.ts tiled(): metres x zoom, scaled by the picture's own
width), on a phone's canvas capped at 1.5x: a 512 px tile is as sharp there as the 1024 px one and a quarter of its bytes.
Each `assets/textures/<name>.webp` of LIST gets `<name>.m.webp` beside it; the server's manifest (server/src/net/
static.ts) offers it as `m`, and the client takes it on a touch screen (client/src/assets.ts). No new art: a resize.

    python tools/art/small_tex.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'assets' / 'textures'
LIST = ['land', 'sand', 'rock', 'reef', 'shore_black', 'shore_coral', 'shore_ice'] + [p.stem for p in ROOT.glob('land_*.webp') if not p.stem.endswith('.m')]

for name in sorted(set(LIST)):
    src = ROOT / f'{name}.webp'
    if not src.exists():
        continue
    im = Image.open(src)
    im.load()
    half = im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.LANCZOS)
    out = ROOT / f'{name}.m.webp'
    half.save(out, 'WEBP', quality=86, method=6)
    print(f'{name}: {src.stat().st_size // 1000} K -> {out.stat().st_size // 1000} K')
