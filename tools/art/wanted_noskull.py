# The wanted icon without the skull (owner's rule: no skulls): the parchment inpainted over the skull and bones, the
# (It reads assets/icons/wanted.webp: run it on the original, git show 3e4aa6a1:assets/icons/wanted.webp, not on its own output.)
# wanted captain's face from deed_wanted_legend pressed into it in sepia ink. The dagger stays.
from PIL import Image, ImageFilter, ImageOps, ImageDraw
import numpy as np, cv2, sys
S = 4
src = Image.open('assets/icons/wanted.webp').convert('RGBA')
W, H = src.size
big = src.resize((W * S, H * S), Image.LANCZOS)
a = np.array(big).astype(int)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
yy, xx = np.mgrid[0:H * S, 0:W * S]
box = (xx >= 12 * S) & (xx <= 82 * S) & (yy >= 34 * S) & (yy <= 104 * S)
ink = box & (al > 100) & (r - g > 45) & (g < 95)
m = cv2.dilate(ink.astype('uint8') * 255, np.ones((7, 7), np.uint8))
bgr = cv2.cvtColor(a[..., :3].astype('uint8'), cv2.COLOR_RGB2BGR)
fill = cv2.inpaint(bgr, m, 9, cv2.INPAINT_TELEA)
rgb = cv2.cvtColor(fill, cv2.COLOR_BGR2RGB).astype(float)
# a little grain back where the paint was
rng = np.random.default_rng(7)
grain = cv2.GaussianBlur(rng.normal(0, 7, rgb.shape[:2]).astype('float32'), (0, 0), 1.2)
rgb[m > 0] += grain[m > 0][:, None]
# The face: sepia ink, an oval vignette, multiplied into the paper.
deed = Image.open('assets/icons/deed_wanted_legend.webp').convert('RGB')
dw, dh = deed.size
face = deed.crop((int(dw * 0.22), int(dh * 0.0), int(dw * 0.86), int(dh * 0.66)))
fw, fh = 54 * S, 60 * S
face = face.resize((fw, fh), Image.LANCZOS)
gray = ImageOps.autocontrast(ImageOps.grayscale(face), cutoff=3)
sep = np.array(ImageOps.colorize(gray, black=(58, 26, 12), white=(255, 246, 225))).astype(float) / 255.0
mask = Image.new('L', (fw, fh), 0)
ImageDraw.Draw(mask).ellipse((13 * S, 10 * S, fw - 13 * S, fh - 10 * S), fill=255)
mask = np.array(mask.filter(ImageFilter.GaussianBlur(3 * S))).astype(float) / 255.0 * 1.0
cx, cy = 47 * S, 68 * S
x0, y0 = cx - fw // 2, cy - fh // 2
reg = rgb[y0:y0 + fh, x0:x0 + fw]
rgb[y0:y0 + fh, x0:x0 + fw] = reg * (1 - mask[..., None]) + reg * sep * mask[..., None]
out = np.dstack([np.clip(rgb, 0, 255), a[..., 3]]).astype('uint8')
res = Image.fromarray(out, 'RGBA').resize((W, H), Image.LANCZOS)
res.save(sys.argv[1])
Image.fromarray(out, 'RGBA').save(sys.argv[1].replace('.png', '_x4.png'))
