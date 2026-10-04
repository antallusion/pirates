"""The zone bosses' warships (owner, 2026-10-04: «на каждую зону свой босс… корабли плавающие по всей карте»; docs/21):
one great hull for each of the eight seas, painted top-down four to a ChatGPT sheet on magenta.

    python tools/art/zbosses.py    # sheets zboss_1, zboss_2 into tools/art/sheets.json
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SEAS = ['black_coast', 'gravewater', 'whispering', 'ashen_isles', 'leviathan_reach', 'dead_mans_expanse', 'drowned_crown', 'the_abyss']


def main() -> None:
    path = os.path.join(HERE, 'sheets.json')
    with open(path, encoding='utf-8') as f:
        sheets = json.load(f)
    for k in range(2):
        name = f'zboss_{k + 1}'
        ids = [f'ship.zb_{s}' for s in SEAS[k * 4:(k + 1) * 4]]
        sheets[name] = {**sheets.get(name, {}), 'grid': [4, 1], 'mode': 'keyed', 'whole': True, 'px': 768, 'square': False, 'dir': 'ships',
                        'aspect': '3:2', 'despill': True, 'ids': ids}
        if not sheets[name].get('cut'):
            sheets[name]['painting'] = True
    with open(path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '\n')
    print('sheets zboss_1, zboss_2')


if __name__ == '__main__':
    main()
