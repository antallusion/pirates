"""Contact sheet of downloaded future art: python review.py <out.png> <family|glob> ... (thumbs on grey to show alpha)."""
import sys, glob, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
out, pats = sys.argv[1], sys.argv[2:]
fs = []
for p in pats:
    fs += sorted(glob.glob(os.path.join(HERE, p if '*' in p else f'{p}/*.png')))
W, cols = 300, 8
rows = (len(fs) + cols - 1) // cols
sheet = Image.new('RGB', (W * cols, W * rows), (30, 30, 30))
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGBA'); im.thumbnail((W - 8, W - 8))
    bg = Image.new('RGB', im.size, (110, 110, 110)); bg.paste(im, (0, 0), im)
    sheet.paste(bg, ((i % cols) * W + 4, (i // cols) * W + 4))
sheet.save(out)
print(len(fs), 'tiles:', ' '.join(os.path.basename(f)[:-4] for f in fs))
