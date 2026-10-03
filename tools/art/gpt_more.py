"""The rest of the battle's pictures in ChatGPT's wording (2026-10-03: Higgsfield turns to films, ChatGPT paints every
picture). ChatGPT refuses the long technical prompts and the names of games, so each job here says the same in plain,
shorter words. Same sheets and ids as tools/art/battle_sheets.py and battle_more.py.

    python tools/art/gpt_more.py    # assets/raw/q_gpt_more.json, in the order they are wanted
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from battle_more import COMMANDS, DECKS, FX, MISSILES, STATUSES  # noqa: E402
from battle_sheets import FIELDS, PROPS, SPELLS  # noqa: E402

LOOK = ('Smooth painterly digital painting like the hand-painted battle art of 1990s fantasy strategy games, grim and weathered; '
        'muted colours: charcoal, weathered oak, tar black, rust, old brass, cold blue-grey, with small warm lantern highlights.')


def listing(rows):
    return ' '.join(f'{i + 1}) {r};' for i, r in enumerate(rows))


def deck(ship, details):
    return (f'Draw a tall 2:3 image: a painted game battlefield — the open main deck of {ship}, seen from high above at a steep angle, '
            'the bow end at the top and the stern end at the bottom, the deck filling the whole picture, its two rails running straight '
            'down both sides with a sliver of dark night sea beyond the right rail. The middle of the deck is open and uncluttered — wet '
            'worn planks running top to bottom, a flush hatch grating, ring bolts, a coil of rope — with no masts, no cannons, no barrels, '
            f'no crates and no people in it; only along the rails: {details}. Night, warm lantern light on the rails and cool moonlight on '
            f'the wet planks. {LOOK} No text, no letters, no frames.')


def field(desc):
    return ('Draw a wide 16:9 image: a painted game battlefield background seen from a high three-quarter angle — '
            f'{desc[0].lower() + desc[1:]}. The ground fills the whole picture, flat and open in the middle two thirds where troops will stand, '
            f'with scenery only along the top edge and the far left and right edges; no people, no creatures. {LOOK} No text, no letters, no frames.')


def icons(rows):
    return ('Draw a square image: a 4 by 4 grid of sixteen square game icons separated by thin black lines; each icon is one small '
            'dramatic painted scene filling its square, readable at a small size. No blood, no wounds, no gore, no corpses, no skulls, no zombies '
            f'anywhere. The icons, row by row: {listing(rows)} {LOOK} '
            'No text, no letters, no numbers, no frames inside the squares.')


def keyed(rows, what):
    return (f'Draw a square image: sixteen separate {what} laid out in a 4 by 4 grid, each centred in its own cell with wide empty gaps '
            f'between them, all seen from the same high three-quarter angle: {listing(rows)} {LOOK} Solid flat magenta #FF00FF background, '
            'no floor, no shadows, no lines, no text.')


def fx(desc):
    return ('Draw a wide 16:9 image on a pure black background: four frames of one game visual effect side by side in one row, evenly '
            f'spaced with gaps between them, growing and then fading from left to right — {desc}. Painterly, glowing, no text, no lines.')


BOOK = ("Draw a wide 16:9 image: an old captain's spell book lying open on a dark wooden table, seen from directly above and filling most "
        'of the picture — two large facing pages of aged cream parchment, completely blank with no writing and no drawings on them, a '
        'worn black leather cover with tarnished brass corners and clasps, three ribbon bookmarks (dark red, sea green, faded blue) hanging '
        f'out at the bottom, warm candlelight from the upper left. {LOOK} No text, no letters, no symbols anywhere.')


def main() -> None:
    jobs = []
    later = {'brig', 'frigate', 'galleon', 'man_o_war', 'xebec', 'ghost_ship', 'bomb_ketch', 'fireship', 'fishing_ketch', 'harpoon_whaler'}
    for sid, ship, details in DECKS:
        if sid in later:
            jobs.append({'name': f'bg.deck_{sid}', 'prompt': deck(ship, details)})
    for fid, desc in FIELDS:
        if fid != 'bg.field_deck':
            jobs.append({'name': fid, 'prompt': field(desc)})
    for k in range(4):
        jobs.append({'name': f'sheet.spells_{k + 1}', 'prompt': icons([d for _, d in SPELLS[k * 16:(k + 1) * 16]])})
    jobs.append({'name': 'sheet.battle_props', 'prompt': keyed([d for _, d in PROPS], 'battlefield props for a game')})
    jobs.append({'name': 'sheet.bt_commands', 'prompt': icons([d for _, d in COMMANDS])})
    jobs.append({'name': 'sheet.bt_statuses', 'prompt': icons([d for _, d in STATUSES])})
    jobs.append({'name': 'sheet.bt_missiles', 'prompt': keyed([d for _, d in MISSILES], 'small flying missiles for a game, each flying toward the right and seen from the side,')})
    jobs.append({'name': 'bg.spellbook', 'prompt': BOOK})
    for fid, desc in FX:
        jobs.append({'name': fid, 'prompt': fx(desc)})
    with open(os.path.join(ROOT, 'assets', 'raw', 'q_gpt_more.json'), 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    print(len(jobs), 'jobs; longest', max(len(j['prompt']) for j in jobs))


if __name__ == '__main__':
    main()
