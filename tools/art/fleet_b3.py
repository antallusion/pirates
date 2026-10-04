"""The third batch for the painter (owner, 2026-10-04: «еще больше … существ и кораблей»): the eight premium hulls, two a
list where her list's premium choice was thinnest (tools/art/ships.py B3) — their top-down sprites four to a sheet and
their decks — and thirty-two creatures four kinds to a sheet, a row of four poses each (tools/art/creatures.py QUADS5):
the islands' third dozen for the new lairs, the shop's third dozen and the eight hulls' own kinds. Everything in
ChatGPT's wording, no game named, and no blood, bones, skulls nor gore in the words.

    python tools/art/fleet_b3.py      # sheets into tools/art/sheets.json (marked `painting`), jobs into
                                      # assets/raw/q_gpt_b3.json ({name, prompt}, in the order they are wanted)

A sheet already cut keeps its cut and is not queued again. The game draws a painted stand-in for every one of them
till then (shared/src/data/fleet.ts HULL_STAND_IN and the hulls' own kinds' `stand`, shared/src/data/unitart.ts
FIGURES).
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from creatures import FRAMES, QUADS5, kind, quad_gpt_prompt, quad_prompt  # noqa: E402
from ships import B3, deck_prompt, sprite_prompt  # noqa: E402

SHEETS = os.path.join(ROOT, 'tools', 'art', 'sheets.json')
JOBS = os.path.join(ROOT, 'assets', 'raw', 'q_gpt_b3.json')

# The hulls' sheets, the small with the small: the three first-tier hulls and the brig-sloop, then the barge, the hulk
# and the two great hulls. They follow ships_19 and ships_20 of the lines made whole.
SHIP_SHEETS = {
    'ships_21': ['bulldog', 'lantern_sampan', 'dolphin', 'saint_elmo'],
    'ships_22': ['mimic_barge', 'icebound_hulk', 'sailfish', 'golden_lion'],
}

# The creatures' sheets, in QUADS5's order; the pale ones (the ghost crabs, the banshee, the cloud whale, the corposant)
# come out tinted through with the magenta without `despill`.
QUAD_SHEETS = [f'anim5_{i + 1}' for i in range(len(QUADS5))]
DESPILL = {'anim5_1', 'anim5_3', 'anim5_6', 'anim5_8'}

# The words the owner keeps out of every prompt (2026-10-04): no blood, bones, skulls, skeletons nor gore, and no game
# named — but for the house prompts' own clauses that forbid them to the painter.
BANNED = re.compile(r'blood|bone|skull|skelet|gore|corpse|heroes of might|warcraft|homm', re.I)
FORBIDDING = re.compile(r'No blood, no wounds and no red stains anywhere|Avoid: [^.]*\.$')


def clean(prompt: str) -> bool:
    return not BANNED.search(FORBIDDING.sub('', prompt))


def put(sheets: dict, key: str, entry: dict, jobs: list, gpt: str) -> None:
    """A sheet into sheets.json: painting until it is cut (a cut one keeps its cut and is not asked for again)."""
    old = sheets.get(key, {})
    if old.get('cut'):
        entry['cut'] = old['cut']
    else:
        entry['painting'] = True
        jobs.append({'name': f'sheet.{key}', 'prompt': gpt})
    sheets[key] = entry


def main() -> None:
    sheets = json.load(open(SHEETS, encoding='utf-8'))
    jobs = []
    by_id = {x['id']: x for x in B3}
    assert sorted(by_id) == sorted(c for g in SHIP_SHEETS.values() for c in g), 'every hull of B3 on a sheet, once'
    for key, ids in SHIP_SHEETS.items():
        group = [by_id[c] for c in ids]
        p = sprite_prompt(group)
        put(sheets, key, {'grid': [len(group), 1], 'mode': 'keyed', 'whole': True, 'px': 768, 'square': False, 'dir': 'ships', 'aspect': '3:2',
                          'ids': [f'ship.{c}' for c in ids], 'prompt': p}, jobs, p)
    # The decks: one tall painting each, baked by bt_harvest.py (bg.deck_<hull>, 1536 high).
    for x in B3:
        jobs.append({'name': f"bg.deck_{x['id']}", 'prompt': deck_prompt(x)})
    for key, group in zip(QUAD_SHEETS, QUADS5):
        ks = [kind(c) for c in group]
        entry = {'grid': [4, 4], 'mode': 'keyed', 'split': 'blobs', 'px': 512, 'square': False,
                 # One scale for the sheet, about the painting's own (slice_sheet.py reckons `uniform` for 1536-high paintings).
                 'uniform': 0.8, 'dir': 'units', 'aspect': '1:1',
                 'ids': [f"unit.{k['id']}{f}" for k in ks for f in FRAMES],
                 'creatures': [{x: k[x] for x in ('id', 'faction', 'tier', 'en', 'ru', 'body')} for k in ks],
                 'prompt': quad_prompt(ks)}
        if key in DESPILL:
            entry['despill'] = True
        put(sheets, key, entry, jobs, quad_gpt_prompt(ks))
    for j in jobs:
        assert clean(j['prompt']), j['name']
    for key in list(SHIP_SHEETS) + QUAD_SHEETS:
        assert clean(sheets[key]['prompt']), key
    with open(SHEETS, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '\n')
    os.makedirs(os.path.dirname(JOBS), exist_ok=True)
    with open(JOBS, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False, indent=1)
    print(len(jobs), 'jobs:', [j['name'] for j in jobs], '; longest prompt', max(len(j['prompt']) for j in jobs))


if __name__ == '__main__':
    main()
