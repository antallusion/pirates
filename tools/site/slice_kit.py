"""Cut the website UI-kit sheets (ChatGPT, magenta #FF00FF background) into trimmed transparent webp pieces.

    python tools/site/slice_kit.py <src dir with the sheet PNGs>

Each sheet is a strict grid; every cell's piece is keyed off the magenta, despilled, trimmed and written to
site/img/<group>/<name>.webp no larger than its max size. Textures and hero art are copied as opaque webp.
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'site', 'img')

SHEETS = {
    'w_buttons': (3, 4, 'ui', 520, ['btn_gold', 'btn_gold_hot', 'btn_oak', 'btn_rope', 'ribbon', 'scroll', 'coin', 'coin_hot', 'coin_iron', 'tab', 'tag', 'toggle']),
    'w_frames': (4, 4, 'ui', 360, ['corner_tl', 'corner_tr', 'corner_bl', 'corner_br', 'ring_round', 'ring_square', 'ring_hex', 'div_anchor',
                                    'div_compass', 'bar_gold', 'nameplate', 'notice', 'seal', 'wreath', 'lantern', 'knot']),
    'w_icons_nav': (4, 4, 'ico', 160, ['home', 'creatures', 'captains', 'ships', 'world', 'boarding', 'island', 'forum',
                                        'news', 'guides', 'trade', 'bugs', 'offtopic', 'search', 'messages', 'bell']),
    'w_icons_forum': (4, 4, 'ico', 160, ['pinned', 'official', 'hot', 'locked', 'reply', 'edit', 'quote', 'link',
                                          'report', 'hide', 'clock', 'star', 'rep', 'mention', 'achievements', 'new']),
    'w_ranks': (4, 2, 'rank', 200, ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']),
    'gt_icons': (4, 4, 'ico', 160, ['doubloon', 'silver', 'hourglass', 'scroll', 'phial', 'spyglass', 'compass', 'chest',
                                     'tools', 'anchor', 'cutlasses', 'cannon', 'lighthouse', 'quest', 'gift', 'bell2']),
    'gt_logo': (1, 1, 'brand', 900, ['logo']),
    'gt_loader_wheel': (1, 1, 'brand', 256, ['wheel']),
    'w_medals': (4, 4, 'medal', 200, ['kraken', 'ship', 'cannon', 'chest', 'compass', 'wave', 'storm', 'lighthouse',
                                       'island', 'coins', 'cutlass', 'flag', 'chart', 'bell', 'pearl', 'crown']),
}
OPAQUE = {'w_tex_wood': ('tex', 'wood', 512), 'w_tex_parchment': ('tex', 'parchment', 512),
          'w_hero_forum': ('hero', 'forum', 1920), 'gt_title_wide': ('hero', 'home', 1920), 'gt_title_mobile': ('hero', 'home_m', 1600),
          'gt_load_sea': ('hero', 'sea', 1920), 'gt_load_island': ('hero', 'island', 1920), 'gt_load_battle': ('hero', 'battle', 1920),
          'gt_load_start': ('hero', 'cabin', 1920), 'gt_icon': ('brand', 'icon', 512), 'w_hero_bestiary': ('hero', 'bestiary', 1920)}


def key(rgb: np.ndarray) -> np.ndarray:
    """RGBA from RGB on magenta: alpha by how magenta a pixel is, the magenta spill pulled out of the edges."""
    r, g, b = (rgb[..., i].astype(np.float32) for i in range(3))
    m = np.minimum(r, b) - g  # magenta-ness: high on the background, ~0 on the painting
    a = np.clip(1.0 - (m - 60.0) / 110.0, 0.0, 1.0)  # m<=60 opaque, m>=170 clear
    spill = np.clip(m, 0, None) * (1.0 - a * 0.35)
    out = np.stack([np.clip(r - spill, 0, 255), g, np.clip(b - spill, 0, 255), a * 255.0], -1)
    return out.astype(np.uint8)


def trim(im: Image.Image) -> Image.Image:
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > 24)
    if not len(xs):
        return im
    pad = 2
    return im.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + pad + 1), min(im.height, ys.max() + pad + 1)))


def main(src: str) -> None:
    for name, (cols, rows, group, px, ids) in SHEETS.items():
        p = os.path.join(src, name + '.png')
        if not os.path.exists(p):
            print('missing', name)
            continue
        rgba = Image.fromarray(key(np.asarray(Image.open(p).convert('RGB'))), 'RGBA')
        W, H = rgba.size
        os.makedirs(os.path.join(OUT, group), exist_ok=True)
        for k, pid in enumerate(ids):
            c, r = k % cols, k // cols
            cell = rgba.crop((c * W // cols, r * H // rows, (c + 1) * W // cols, (r + 1) * H // rows))
            piece = trim(cell)
            piece.thumbnail((px, px), Image.LANCZOS)
            piece.save(os.path.join(OUT, group, pid + '.webp'), 'WEBP', quality=88, method=6)
        print(name, len(ids))
    for name, (group, pid, px) in OPAQUE.items():
        p = os.path.join(src, name + '.png')
        if not os.path.exists(p):
            print('missing', name)
            continue
        im = Image.open(p).convert('RGB')
        im.thumbnail((px, px), Image.LANCZOS)
        os.makedirs(os.path.join(OUT, group), exist_ok=True)
        im.save(os.path.join(OUT, group, pid + '.webp'), 'WEBP', quality=82, method=6)
        print(name, im.size)


if __name__ == '__main__':
    main(sys.argv[1])
