# The numbers of the before/after runs (tools/mobile/ux/ux.mjs) in one table: per size and language, the things to touch
# on each screen, the pictures cut in round frames, the popup share and what lay in the middle, audit() and center().
#   python tools/mobile/ux/summary.py [run dir]
import json, os, sys

RUN = sys.argv[1] if len(sys.argv) > 1 else 'assets/raw/audit/ux/final'
SCREENS = ['sea', 'target', 'boss', 'menu', 'battle']
ORDER = ['1500x600_mouse', '812x375_touch', '1280x720_mouse', '1440x900_mouse', '640x360_touch', '1024x768_touch', '1180x820_touch']

def load(tag, name):
    p = os.path.join(RUN, f'{tag}_{name}.json')
    return {r['screen']: r for r in json.load(open(p, encoding='utf8'))['rows']} if os.path.exists(p) else {}

out = []
tot = {'before': {'crop': 0, 'checked': 0, 'audit': 0, 'centre': 0}, 'after': {'crop': 0, 'checked': 0, 'audit': 0, 'centre': 0}}
for size in ORDER:
    for lg in ['ru', 'en']:
        name = f'{size}_{lg}'
        b, a = load('before', name), load('after', name)
        if not a and not b:
            continue
        cells = []
        for s in SCREENS:
            rb, ra = b.get(s), a.get(s)
            cells.append(f"{rb['controls'] if rb else '–'}→{ra['controls'] if ra else '–'}")
        def agg(rows, k):
            return sum(len(r[k]) if isinstance(r[k], list) else r[k] for r in rows.values())
        for tag, rows in (('before', b), ('after', a)):
            tot[tag]['crop'] += agg(rows, 'crop') if rows else 0
            tot[tag]['checked'] += sum(r['cropChecked'] for r in rows.values()) if rows else 0
            tot[tag]['audit'] += agg(rows, 'audit') if rows else 0
            tot[tag]['centre'] += agg(rows, 'centre') if rows else 0
        popb = max((r['pop'] for r in b.values()), default=0)
        popa = max((r['pop'] for r in a.values()), default=0)
        cb = sum(len(r['crop']) for r in b.values())
        ca = sum(len(r['crop']) for r in a.values())
        cen_b = sum(len(r['center']) for r in b.values()); cen_a = sum(len(r['center']) for r in a.values())
        aud_b = sum(len(r['audit']) for r in b.values()); aud_a = sum(len(r['audit']) for r in a.values())
        mid_b = sum(len(r['centre']) for r in b.values()); mid_a = sum(len(r['centre']) for r in a.values())
        out.append(f"| {size.replace('_', ' ')} {lg.upper()} | {' | '.join(cells)} | {cb}→{ca} | {popb}→{popa}% · {mid_b}→{mid_a} | {aud_b}→{aud_a} · {cen_b}→{cen_a} |")
print('| size | sea after port | mark | boss | menu | battle | cut pictures | popups max · in the middle | audit · center |')
print('|---|---|---|---|---|---|---|---|---|')
print('\n'.join(out))
print()
print('totals', json.dumps(tot))
