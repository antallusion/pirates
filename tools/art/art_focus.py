"""The focus of every banner painting (owner, 2026-10-28: «большинство картинок в таких окошках отрезаны поверху, надо
все выставить правильно и четко чтобы лица попадали в окошки и на мобиле и на десктопе и везде»).

    python -I tools/art/art_focus.py            # write shared/src/data/artfocus.ts and draw the sheets
    python -I tools/art/art_focus.py --no-sheets

What it does:
  focus     every painting shown cropped in a wide window (the island games, the trek, the encounters, the holidays,
            the legendary ships, the campaign book and news, the zone bosses, the sea beasts' bar, the waystation and
            endgame headers) has a focus: [x, y, top] — the middle of its subject (a face, the beast's head, the ship)
            as shares of the picture's width and height, and the top of what must stay in the frame (the hat's crown,
            the top of the head, the mast's flag). Read by eye on 10 % grids and checked on the sheets this script
            draws. shared/src/data/artaim.ts artAim() turns it into a background/object position for a box of any
            size: the subject's middle at 42 % of the window's height, the top never cut, the subject never off the
            window's bottom; sideways its middle as near the window's middle as the picture allows.
  output    shared/src/data/artfocus.ts (the table and the pictures' aspects), assets/raw/focus/focus_*.png (each
            painting with its focus and the windows it is shown in: 2.4:1, 4:1 and 5:1 at its focus).
"""

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_TS = os.path.join(ROOT, 'shared', 'src', 'data', 'artfocus.ts')
SHEETS = os.path.join(ROOT, 'assets', 'raw', 'focus')

# [x, y, top]: the subject's middle and the top that must stay in, shares of the picture's width and height.
FOCUS = {
    'abyss_eye': [0.70, 0.50, 0.25],
    'ancient_leviathan': [0.65, 0.32, 0.10],
    'black_serpent': [0.72, 0.20, 0.04],
    'ch_01': [0.36, 0.13, 0.03],
    'ch_02': [0.60, 0.30, 0.05],
    'ch_03': [0.15, 0.42, 0.30],
    'ch_04': [0.20, 0.27, 0.14],
    'ch_05': [0.50, 0.55, 0.45],
    'ch_06': [0.50, 0.55, 0.35],
    'ch_07': [0.50, 0.50, 0.30],
    'ch_08': [0.60, 0.45, 0.36],
    'ch_09': [0.30, 0.22, 0.10],
    'ch_10': [0.80, 0.20, 0.12],
    'ch_11': [0.30, 0.50, 0.45],
    'ch_12': [0.40, 0.55, 0.40],
    'ch_13': [0.70, 0.47, 0.38],
    'ch_14': [0.60, 0.72, 0.55],
    'ch_15': [0.55, 0.45, 0.20],
    'ch_16': [0.65, 0.42, 0.20],
    'ch_17': [0.60, 0.50, 0.25],
    'ch_18': [0.85, 0.60, 0.52],
    'ch_19': [0.45, 0.58, 0.48],
    'ch_20': [0.50, 0.50, 0.30],
    'ch_21': [0.60, 0.50, 0.30],
    'ch_22': [0.30, 0.32, 0.18],
    'ch_23': [0.50, 0.50, 0.25],
    'ch_24': [0.50, 0.45, 0.10],
    'ch_25': [0.50, 0.45, 0.20],
    'ch_26': [0.55, 0.45, 0.30],
    'ch_27': [0.50, 0.45, 0.20],
    'ch_28': [0.60, 0.35, 0.15],
    'ch_29': [0.50, 0.50, 0.20],
    'ch_30': [0.50, 0.45, 0.25],
    'ch_31': [0.40, 0.45, 0.25],
    'ch_32': [0.50, 0.45, 0.05],
    'ch_33': [0.40, 0.40, 0.10],
    'ch_34': [0.50, 0.50, 0.30],
    'ch_35': [0.55, 0.50, 0.25],
    'ch_36': [0.50, 0.45, 0.20],
    'cinder_ray': [0.55, 0.38, 0.08],
    'drop_cove': [0.55, 0.45, 0.35],
    'drop_hamlet': [0.70, 0.58, 0.48],
    'drop_waystation': [0.55, 0.40, 0.20],
    'drowned_prelate': [0.55, 0.45, 0.05],
    'drowned_whale': [0.60, 0.45, 0.15],
    'enc_albatross': [0.62, 0.25, 0.12],
    'enc_ambush': [0.65, 0.20, 0.08],
    'enc_barrel': [0.50, 0.50, 0.25],
    'enc_bird_shoal': [0.40, 0.50, 0.25],
    'enc_bottle': [0.60, 0.45, 0.15],
    'enc_burning_ship': [0.50, 0.45, 0.15],
    'enc_calm': [0.40, 0.45, 0.25],
    'enc_convict': [0.45, 0.27, 0.17],
    'enc_derelict': [0.50, 0.40, 0.05],
    'enc_deserters': [0.45, 0.30, 0.07],
    'enc_dolphins': [0.50, 0.55, 0.35],
    'enc_fishermen': [0.55, 0.50, 0.25],
    'enc_flotsam': [0.45, 0.60, 0.35],
    'enc_galley_fire': [0.50, 0.45, 0.32],
    'enc_ghost_bargain': [0.62, 0.45, 0.35],
    'enc_giant_turtle': [0.60, 0.45, 0.10],
    'enc_glowing_sea': [0.50, 0.55, 0.30],
    'enc_iceberg': [0.50, 0.40, 0.05],
    'enc_mapmaker': [0.50, 0.33, 0.19],
    'enc_mine': [0.30, 0.50, 0.35],
    'enc_mutiny_brewing': [0.60, 0.35, 0.15],
    'enc_orcas_whale': [0.40, 0.50, 0.30],
    'enc_patrol_search': [0.55, 0.50, 0.30],
    'enc_peddler': [0.50, 0.42, 0.30],
    'enc_pilgrims': [0.45, 0.45, 0.32],
    'enc_pilot': [0.45, 0.15, 0.06],
    'enc_raft': [0.55, 0.42, 0.28],
    'enc_rats': [0.50, 0.55, 0.30],
    'enc_sharks': [0.45, 0.60, 0.40],
    'enc_signal_fire': [0.45, 0.50, 0.25],
    'enc_sinking_merchant': [0.55, 0.40, 0.15],
    'enc_sirens': [0.80, 0.36, 0.28],
    'enc_skeleton_raft': [0.55, 0.32, 0.18],
    'enc_smuggler': [0.70, 0.52, 0.45],
    'enc_squall': [0.50, 0.50, 0.20],
    'enc_sunken_bell': [0.50, 0.50, 0.30],
    'enc_tentacle': [0.60, 0.40, 0.10],
    'enc_voice_in_fog': [0.60, 0.50, 0.40],
    'enc_waterspout': [0.50, 0.40, 0.05],
    'enc_wisps': [0.50, 0.45, 0.20],
    'fog_changeling': [0.60, 0.30, 0.08],
    'holiday_drowned_night': [0.40, 0.40, 0.15],
    'holiday_herring_run': [0.35, 0.45, 0.20],
    'holiday_league_day': [0.55, 0.50, 0.20],
    'holiday_powder_night': [0.50, 0.40, 0.05],
    'hollow_admiral': [0.55, 0.50, 0.20],
    'kraken': [0.60, 0.45, 0.10],
    'lantern_maw': [0.75, 0.45, 0.15],
    'leg_crowns_sorrow': [0.50, 0.50, 0.20],
    'leg_first_rib': [0.50, 0.50, 0.15],
    'leg_lamplighter': [0.60, 0.50, 0.15],
    'leg_saint_maws_bell': [0.50, 0.40, 0.10],
    'leg_widows_lament': [0.50, 0.45, 0.10],
    'leviathan': [0.60, 0.35, 0.10],
    'lore_epilogue': [0.45, 0.45, 0.15],
    'lore_prologue': [0.50, 0.50, 0.25],
    'mg_beach_trader': [0.45, 0.28, 0.18],
    'mg_bosun_whistle': [0.68, 0.28, 0.12],
    'mg_bosuns_lore': [0.55, 0.25, 0.13],
    'mg_castaway_coin': [0.62, 0.27, 0.08],
    'mg_compass_needle': [0.45, 0.50, 0.15],
    'mg_crown_anchor': [0.50, 0.50, 0.25],
    'mg_cursed_idol': [0.50, 0.48, 0.30],
    'mg_drowned_ferryman': [0.55, 0.25, 0.11],
    'mg_flag_hoist': [0.45, 0.30, 0.05],
    'mg_harpoon_lagoon': [0.30, 0.15, 0.04],
    'mg_liars_dice': [0.60, 0.55, 0.30],
    'mg_marooned_sailor': [0.48, 0.28, 0.16],
    'mg_mutineers_grave': [0.45, 0.35, 0.10],
    'mg_old_parrot': [0.45, 0.20, 0.02],
    'mg_smugglers_cave': [0.45, 0.50, 0.25],
    'mg_split_map': [0.50, 0.24, 0.09],
    'mg_star_bearing': [0.28, 0.22, 0.09],
    'mg_talking_skull': [0.38, 0.27, 0.08],
    'mg_three_levers': [0.50, 0.35, 0.05],
    'mg_three_shells': [0.45, 0.52, 0.40],
    'mother_of_wrecks': [0.55, 0.40, 0.05],
    'old_moorings': [0.65, 0.35, 0.08],
    'old_tithe': [0.60, 0.45, 0.20],
    'rime_twins': [0.50, 0.40, 0.15],
    'storm_widow': [0.70, 0.35, 0.10],
    'trek_lush': [0.55, 0.42, 0.30],
    'trek_stark': [0.55, 0.50, 0.25],
    'zb_ashen_isles': [0.55, 0.45, 0.10],
    'zb_black_coast': [0.60, 0.40, 0.08],
    'zb_dead_mans_expanse': [0.50, 0.45, 0.08],
    'zb_drowned_crown': [0.50, 0.40, 0.05],
    'zb_gravewater': [0.55, 0.40, 0.05],
    'zb_leviathan_reach': [0.55, 0.40, 0.05],
    'zb_the_abyss': [0.50, 0.50, 0.10],
    'zb_whispering': [0.50, 0.45, 0.10],
    'way_tavern': [0.60, 0.45, 0.30],
    'way_chapel': [0.55, 0.40, 0.20],
    'way_market': [0.40, 0.40, 0.15],
    'descent': [0.50, 0.55, 0.20],
    'abyss_raid': [0.50, 0.45, 0.10],
    'throne': [0.50, 0.35, 0.05],
    'citadel': [0.50, 0.40, 0.10],
}

# the same arithmetic as shared/src/data/artaim.ts artAim()
FACE_AT, TOP_PAD, LOW_MAX = 0.42, 0.04, 0.9


def aim(f, ar, bw, bh):
    """The window [left, top, width, height] (shares of the picture) a box bw x bh shows of a cover-fitted picture."""
    x, y, top = f
    s = max(bw / ar, bh)  # the picture's height in box units, cover
    v, u = min(1.0, bh / s), min(1.0, bw / (s * ar))
    t = min(y - FACE_AT * v, top - TOP_PAD * v)
    t = max(t, y - LOW_MAX * v)
    t = min(max(t, 0.0), 1.0 - v)
    l = min(max(x - u / 2, 0.0), 1.0 - u)
    return l, t, u, v


def main():
    manifest = json.load(open(os.path.join(ROOT, 'assets', 'manifest.json'), encoding='utf-8'))['assets']
    files = {}
    for k, e in manifest.items():
        if k.startswith('card.') or k.startswith('bg.'):
            stem = os.path.splitext(os.path.basename(e['local']))[0]
            if stem in FOCUS:
                files[stem] = os.path.join(ROOT, 'assets', e['local'])
    missing = sorted(set(FOCUS) - set(files))
    if missing:
        sys.exit(f'no picture for {missing}')
    unfocused = sorted(os.path.splitext(os.path.basename(e['local']))[0] for k, e in manifest.items() if k.startswith('card.') and os.path.splitext(os.path.basename(e['local']))[0] not in FOCUS)
    if unfocused:
        sys.exit(f'cards with no focus: {unfocused}')
    sizes = {k: Image.open(p).size for k, p in files.items()}
    lines = [
        '// GENERATED by tools/art/art_focus.py — do not edit by hand (the focus points are its FOCUS table).',
        '// The subject of every banner painting (owner, 2026-10-28: «большинство картинок в таких окошках отрезаны поверху,',
        '// надо все выставить правильно и четко чтобы лица попадали в окошки и на мобиле и на десктопе и везде»).',
        '',
        '/** Every banner painting by its file name: [x, y, top, width over height] — the subject\'s middle (a face, a beast\'s',
        ' *  head, a ship) and the top that must stay in the frame (a hat\'s crown), shares of the picture. */',
        'export const ART_FOCUS: Readonly<Record<string, readonly [number, number, number, number]>> = {',
    ]
    for k in sorted(FOCUS):
        x, y, top = FOCUS[k]
        w, h = sizes[k]
        lines.append(f"  {k}: [{x}, {y}, {top}, {round(w / h, 4)}],")
    lines += ['};']
    with open(OUT_TS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'{len(FOCUS)} paintings -> {os.path.relpath(OUT_TS, ROOT)}')
    if '--no-sheets' in sys.argv:
        return
    os.makedirs(SHEETS, exist_ok=True)
    try:
        font = ImageFont.truetype('arial.ttf', 14)
    except OSError:
        font = ImageFont.load_default()
    keys = sorted(FOCUS)
    W, per = 300, 16
    windows = [(2.4, (255, 220, 60)), (4.0, (80, 220, 255)), (5.0, (255, 90, 200))]
    for p in range(0, len(keys), per):
        chunk = keys[p:p + per]
        cols = 4
        rows = (len(chunk) + cols - 1) // cols
        ch = int(W * 0.72) + 26
        sheet = Image.new('RGB', (cols * (W + 12) + 12, rows * ch + 12), (24, 24, 24))
        d = ImageDraw.Draw(sheet)
        for i, k in enumerate(chunk):
            im = Image.open(files[k]).convert('RGB')
            w, h = im.size
            th = int(W * h / w)
            im = im.resize((W, th))
            dd = ImageDraw.Draw(im)
            ar = w / h
            for bar, col in windows:
                l, t, u, v = aim(FOCUS[k], ar, bar, 1.0)
                dd.rectangle([l * W, t * th, (l + u) * W - 1, (t + v) * th - 1], outline=col, width=2)
            x, y, top = FOCUS[k]
            dd.line([(0, top * th), (W, top * th)], fill=(255, 60, 60), width=1)
            dd.ellipse([x * W - 6, y * th - 6, x * W + 6, y * th + 6], outline=(0, 255, 0), width=3)
            cx, cy = 12 + (i % cols) * (W + 12), 6 + (i // cols) * ch
            d.text((cx, cy), k, fill=(240, 240, 240), font=font)
            sheet.paste(im, (cx, cy + 20))
        sheet.save(os.path.join(SHEETS, f'focus_{p // per + 1:02d}.png'))
    print(f'sheets -> {os.path.relpath(SHEETS, ROOT)}')


if __name__ == '__main__':
    main()
