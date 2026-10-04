"""The next batch for the painter (owner, 2026-10-04: «еще больше роликов генерируй, существ и кораблей»): the eight
silver hulls that make the lines of the yard's tree whole (tools/art/ships.py NEXT; docs/20 §6) — their top-down
sprites four to a sheet and their decks — and the second dozen of the shop's creatures and of the world's armies
(tools/art/creatures.py QUADS), four kinds to a sheet, a row of four poses each. Everything in ChatGPT's wording.

    python tools/art/fleet_next.py    # sheets into tools/art/sheets.json (marked `painting`), jobs into
                                      # assets/raw/q_gpt_fleet_next.json ({name, prompt}, in the order they are wanted)

A sheet already cut keeps its cut and is not queued again. The game draws a painted stand-in for every one of them
till then (shared/src/data/fleet.ts HULL_STAND_IN, shared/src/data/unitart.ts FIGURES).
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from creatures import FRAMES, QUADS, kind, quad_gpt_prompt, quad_prompt  # noqa: E402
from ships import NEXT, deck_prompt, sprite_prompt  # noqa: E402

SHEETS = os.path.join(ROOT, 'tools', 'art', 'sheets.json')
JOBS = os.path.join(ROOT, 'assets', 'raw', 'q_gpt_fleet_next.json')

# The hulls' sheets: the runners together, then the warship, the hauler and the two great traders. They follow the
# sixty-six's ships_1–ships_18 (and the redone ships_17b).
SHIP_SHEETS = {
    'ships_19': ['polacre', 'dunkirk_frigate', 'great_xebec', 'race_galleon'],
    'ships_20': ['sloop_of_war', 'armed_fluyt', 'great_indiaman', 'manila_galleon'],
}

# The creatures' sheets, in QUADS' order; the ghosts and the pale jellyfish come out tinted through with the magenta
# without `despill`.
QUAD_SHEETS = [f'anim4_{i + 1}' for i in range(len(QUADS))]
DESPILL = {'anim4_3', 'anim4_4'}


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
    by_id = {x['id']: x for x in NEXT}
    assert sorted(by_id) == sorted(c for g in SHIP_SHEETS.values() for c in g), 'every hull of NEXT on a sheet, once'
    for key, ids in SHIP_SHEETS.items():
        group = [by_id[c] for c in ids]
        p = sprite_prompt(group)
        put(sheets, key, {'grid': [len(group), 1], 'mode': 'keyed', 'whole': True, 'px': 768, 'square': False, 'dir': 'ships', 'aspect': '3:2',
                          'ids': [f'ship.{c}' for c in ids], 'prompt': p}, jobs, p)
    # The decks: one tall painting each, baked by bt_harvest.py (bg.deck_<hull>, 1536 high).
    for x in NEXT:
        jobs.append({'name': f"bg.deck_{x['id']}", 'prompt': deck_prompt(x)})
    for key, group in zip(QUAD_SHEETS, QUADS):
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
    with open(SHEETS, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '\n')
    os.makedirs(os.path.dirname(JOBS), exist_ok=True)
    with open(JOBS, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False, indent=1)
    print(len(jobs), 'jobs:', [j['name'] for j in jobs], '; longest prompt', max(len(j['prompt']) for j in jobs))


if __name__ == '__main__':
    main()
