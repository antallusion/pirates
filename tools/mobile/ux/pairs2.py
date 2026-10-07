# The painted HUD's return, before and after side by side (owner, 2026-10-07: «ты удалил всё, что было… возвращай
# иконки, обводки графические… сделать круче»). «До» is the rebuild's line of keys (ux.mjs, tag before), «после» this
# branch (hud2.mjs, tag after); the screens new in it — the mouse or a finger on a target (the attack mark and the
# target's choices), «Атаковать» under way — stand alone with their numbers. All in assets/raw/audit/hud2/pairs/; a
# selection for the owner (the 1500×600 desk and the 812×375 phone) in docs/img/hud2/.
#   python tools/mobile/ux/pairs2.py [run dir]
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

RUN = sys.argv[1] if len(sys.argv) > 1 else 'assets/raw/audit/hud2'
OUT = os.path.join(RUN, 'pairs')
DOCS = 'docs/img/hud2'
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

BAND = 34
WORDS = {'sea': 'море после порта', 'target': 'цель', 'hover': 'наведение на цель', 'fight': 'бой', 'battle': 'бой на гексах'}

def label(img, text, sub, color):
    out = Image.new('RGB', (img.width, img.height + BAND), (8, 9, 11))
    out.paste(img, (0, BAND))
    d = ImageDraw.Draw(out)
    f1, f2 = font(18), font(13)
    d.rectangle([0, BAND - 3, img.width, BAND], fill=color)
    d.text((8, 6), text, font=f1, fill=(232, 220, 196))
    d.text((8 + d.textlength(text, font=f1) + 14, 10), sub, font=f2, fill=(170, 176, 182))
    return out

def numbers(r):
    if not r:
        return ''
    bits = [f"{r['controls']} controls", f"{len(r['crop'])} cut", f"popups {r['pop']}%"]
    if r.get('tm'):
        bits.append(f"choices {r['menu']}%")
    if r.get('cur'):
        bits.append(f"cursor {r['cur']}")
    return ' · '.join(bits)

made = []
for name in sorted({f[len('after_'):-len('.json')] for f in os.listdir(RUN) if f.startswith('after_') and f.endswith('.json')}):
    before, after = rows('before', name), rows('after', name)
    for screen in ['sea', 'target', 'hover', 'fight', 'battle']:
        a = os.path.join(RUN, f'after_{name}_{screen}.png')
        if not os.path.exists(a):
            continue
        b = os.path.join(RUN, f'before_{name}_{screen}.png')
        right = label(Image.open(a).convert('RGB'), 'ПОСЛЕ', f"{WORDS[screen]} · {numbers(after.get(screen))}", (98, 160, 92))
        if os.path.exists(b):
            left = label(Image.open(b).convert('RGB'), 'ДО', f"{WORDS[screen]} · {numbers(before.get(screen))}", (176, 64, 56))
            pic = Image.new('RGB', (left.width + right.width + 8, max(left.height, right.height)), (8, 9, 11))
            pic.paste(left, (0, 0))
            pic.paste(right, (left.width + 8, 0))
        else:
            pic = right
        out = os.path.join(OUT, f'{name}_{screen}.png')
        pic.save(out)
        made.append(out)

# for the owner: the desk at his size and the phone held sideways, Russian
PICK = [('1500x600_mouse_ru', 'sea'), ('1500x600_mouse_ru', 'target'), ('1500x600_mouse_ru', 'hover'), ('1500x600_mouse_ru', 'battle'),
        ('812x375_touch_ru', 'sea'), ('812x375_touch_ru', 'target'), ('812x375_touch_ru', 'hover'), ('812x375_touch_ru', 'fight')]
for name, screen in PICK:
    src = os.path.join(OUT, f'{name}_{screen}.png')
    if os.path.exists(src):
        size = name.split('_')[0]
        # (a palette of 256 for the repository: a third of the bytes, the frames and words as they are)
        Image.open(src).convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(os.path.join(DOCS, f'{size}_{screen}.png'), optimize=True)
print(f'{len(made)} pictures in {OUT}; {len(os.listdir(DOCS))} in {DOCS}')
