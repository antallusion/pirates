"""The expansion's icons (owner, 2026-10-03: twenty new orders, a hundred things for the ships, …): each set laid out in
4×4 (or smaller) icon sheets in the house style of the spell icons (tools/art/battle_sheets.py), worded for ChatGPT.

    python tools/art/expansion.py      # sheets into tools/art/sheets.json, ChatGPT jobs into assets/raw/q_expansion.json
"""

import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))
from gpt_more import LOOK  # noqa: E402

SHEETS = os.path.join(ROOT, 'tools', 'art', 'sheets.json')
JOBS = os.path.join(ROOT, 'assets', 'raw', 'q_expansion.json')

# The twenty new battle orders (shared/src/data/paths.ts BOOK_PAGES): their painted icons.
SPELLS = [
    ('sp_stinkpot', 'a cracked clay pot spewing thick yellow sulphur smoke, a smouldering rag fuse in its neck'),
    ('sp_heated_shot', 'a glowing red-hot cannonball held in iron tongs over a brazier of coals'),
    ('sp_raking_fire', 'a row of musket barrels and a swivel gun firing in one straight line down a ship\'s deck'),
    ('sp_hammock_nettings', 'rolled canvas hammocks packed in rope netting along a ship\'s rail, a musket ball lodged in one'),
    ('sp_nail_colours', 'a hammer driving iron nails through a tattered red ensign into a mast'),
    ('sp_belaying_pin', 'a heavy wooden belaying pin with a coil of rope looped over it, in a pin rail'),
    ('sp_double_grog', 'two dented pewter tankards of steaming grog beside a small rum keg with a brass tap'),
    ('sp_swing_aboard', 'a pirate silhouette swinging on a rope across the gap between two hulls, cutlass raised'),
    ('sp_no_quarter', 'a plain black flag snapping above two crossed cutlasses driven into a deck'),
    ('sp_st_elmos_fire', 'pale blue St Elmo\'s fire glowing on the mast tips and yardarms against a storm sky'),
    ('sp_clearing_wind', 'a strong gust sweeping grey smoke and fog off a deck, blue sky breaking through'),
    ('sp_rain_squall', 'slanting rain over a deck, a soaked powder horn and a hissing doused lantern in front'),
    ('sp_forked_lightning', 'a jagged three-branched lightning bolt over a dark sea striking a mast'),
    ('sp_foul_water', 'a split water cask leaking murky green water, flies over it'),
    ('sp_kelp_poultice', 'dark green kelp wound as a bandage round a sailor\'s forearm, a brine bucket beside it'),
    ('sp_siren_song', 'a seaweed-wrapped siren silhouette singing on a wet rock under the moon, faint rings of song drifting to a distant ship'),
    ('sp_jonah', 'a lone hooded sailor apart at the rail in fog, shadowy shipmates glancing at him'),
    ('sp_muffled_oars', 'rag-wrapped oars dipping silently into black water under a thin crescent moon in fog'),
    ('sp_silent_fog', 'signal flags hanging limp in thick grey fog, a brass speaking trumpet lying on the deck'),
    ('sp_fog_madness', 'a sailor in thick fog swinging a cutlass at blurred, distorted silhouettes of his own shipmates'),
]

HEAD = ('Draw a square image: a game icon sheet of {n} square battle-spell icons in a strict {g} by {g} grid of equal square tiles '
        'separated by thin pure black gutters, in the painterly style of the spell icons of Heroes of Might and Magic III and the '
        'ability icons of World of Warcraft but grim and realistic. Each tile is its own icon: one dramatic scene filling the whole '
        'tile edge to edge, a strong focal point readable at a small size, the same lighting and finish across all of them. No '
        'blood, no wounds, no gore, no corpses, no skulls anywhere. The icons, left to right and top to bottom: ')


def sheet_jobs(key_base, items, start, sheets, jobs):
    """Sixteen to a 4×4 sheet; a short last set on a 2×2 (four) sheet."""
    k = start
    for i in range(0, len(items), 16):
        chunk = items[i:i + 16]
        g = 4 if len(chunk) > 4 else 2
        ids = [f'icon.{iid}' for iid, _ in chunk] + [None] * (g * g - len(chunk))
        rows = ' '.join(f'{j + 1}. {desc};' for j, (_, desc) in enumerate(chunk))
        p = HEAD.format(n=len(chunk), g=g) + rows + f' {LOOK} No text, no letters, no numbers, no frames inside the tiles.'
        key = f'{key_base}_{k}'
        old = sheets.get(key, {})
        sheets[key] = {'grid': [g, g], 'mode': 'tiles', 'px': 192, 'square': True, 'dir': 'icons', 'aspect': '1:1', 'ids': ids, 'prompt': p}
        if old.get('cut'):
            sheets[key]['cut'] = old['cut']
        else:
            sheets[key]['painting'] = True
            jobs.append({'name': f'sheet.{key}', 'prompt': p})
        k += 1


def main() -> None:
    sheets = json.load(open(SHEETS, encoding='utf-8'))
    jobs = []
    sheet_jobs('spells', SPELLS, 5, sheets, jobs)
    with open(SHEETS, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '\n')
    with open(JOBS, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    print(len(jobs), 'jobs:', [j['name'] for j in jobs])


if __name__ == '__main__':
    main()
