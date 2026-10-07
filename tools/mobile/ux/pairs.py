# Before and after side by side (owner, 2026-10-07): for each size, language and screen measured by ux.mjs, one picture —
# «до» on the left, «после» on the right, each with its numbers (things to touch, pictures cut, the popup share) — in
# assets/raw/audit/ux/pairs/, and a small selection for the owner in docs/img/ux/ (the 1500×600 desk and the
# 812×375 phone, the sea after leaving port, a mark, a world boss, the battle).
#   python tools/mobile/ux/pairs.py [run dir]
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

RUN = sys.argv[1] if len(sys.argv) > 1 else 'assets/raw/audit/ux/run'
OUT = os.path.join(os.path.dirname(RUN), 'pairs')
DOCS = 'docs/img/ux'
os.makedirs(OUT, exist_ok=True)
os.makedirs(DOCS, exist_ok=True)

def font(n):
    for f in ['C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf']:
        if os.path.exists(f):
            return ImageFont.truetype(f, n)
    return ImageFont.load_default()

def rows(tag, name):
    p = os.path.join(RUN, f'{tag}_{name}.json')
    if not os.path.exists(p):
        return {}
    return {r['screen']: r for r in json.load(open(p, encoding='utf8'))['rows']}

def label(img, text, sub, color):
    d = ImageDraw.Draw(img)
    f1, f2 = font(max(14, img.width // 48)), font(max(11, img.width // 70))
    pad = 6
    w = max(d.textlength(text, font=f1), d.textlength(sub, font=f2)) + pad * 2
    h = f1.size + f2.size + pad * 3
    d.rectangle([0, 0, w, h], fill=(8, 9, 11))
    d.rectangle([0, h - 3, w, h], fill=color)
    d.text((pad, pad), text, font=f1, fill=(232, 220, 196))
    d.text((pad, pad * 2 + f1.size), sub, font=f2, fill=(170, 176, 182))

made = []
names = sorted({f[len('after_'):-len('.json')] for f in os.listdir(RUN) if f.startswith('after_') and f.endswith('.json')})
for name in names:
    b, a = rows('before', name), rows('after', name)
    for screen in ['sea', 'target', 'boss', 'menu', 'battle']:
        pb, pa = os.path.join(RUN, f'before_{name}_{screen}.png'), os.path.join(RUN, f'after_{name}_{screen}.png')
        if not (os.path.exists(pb) and os.path.exists(pa)):
            continue
        ib, ia = Image.open(pb).convert('RGB'), Image.open(pa).convert('RGB')
        def nums(r):
            if not r:
                return ''
            return f"{r['controls']} controls · {len(r['crop'])} cut · popups {r['pop']}%"
        ru = name.endswith('_ru')
        label(ib, 'ДО' if ru else 'BEFORE', nums(b.get(screen)), (150, 60, 50))
        label(ia, 'ПОСЛЕ' if ru else 'AFTER', nums(a.get(screen)), (120, 160, 90))
        gap = 8
        pair = Image.new('RGB', (ib.width + ia.width + gap, max(ib.height, ia.height)), (20, 18, 15))
        pair.paste(ib, (0, 0))
        pair.paste(ia, (ib.width + gap, 0))
        out = os.path.join(OUT, f'{name}_{screen}.png')
        pair.save(out, optimize=True)
        made.append(out)
        # the owner's selection: the desk he plays on and the phone, RU
        if name in ('1500x600_mouse_ru', '812x375_touch_ru') and screen in ('sea', 'target', 'boss', 'battle'):
            small = pair if pair.width <= 2000 else pair.resize((2000, round(pair.height * 2000 / pair.width)), Image.LANCZOS)
            small.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(os.path.join(DOCS, f'{name.split("_")[0]}_{screen}.png'), optimize=True)
print(len(made), 'pairs in', OUT)
