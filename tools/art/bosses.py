"""The ten bosses of 2026-10-03 (owner: «еще больше всяких там боссов»; docs/02 §11.A.4, the second table and «Боссы
на суше»): how each is painted.

The six world bosses at sea are monsters on the sea map: each a top-down sprite `monster.<class>` on magenta, cut like
the old `monster.*` (shared/src/data/bossmonsters.ts names the classes; the Drowned Prelate's bell spires are a class of
their own, the Rime Twins two of one class). The four great ones ashore fight on the hex battle: each a four-pose
animation sheet like the creatures' (tools/art/creatures.py) — idle, idle a breath later, its attack, flinching from a
hit — in the high three-quarter view of HoMM3's battle creatures, facing right, on magenta (`unit.<id>`, `_b`, `_atk`,
`_hit`; shared/src/data/bossunits.ts).

Until a painting is registered the game draws a stand-in (a monster or a creature of like shape, tinted: BOSS_STAND_IN,
BOSS_UNIT_STAND_IN); once it is in the manifest the game draws it instead, with no change to any code.

    python tools/art/bosses.py      # sheets into tools/art/sheets.json, ChatGPT jobs into assets/raw/q_bosses.json

The prompts are ChatGPT's wording (plain words, no names of games in the sprite prompts, one sheet per job), as
tools/art/ships.py's are; no blood, no gore, no skeletons anywhere.
"""

import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHEETS = os.path.join(ROOT, 'tools', 'art', 'sheets.json')
JOBS = os.path.join(ROOT, 'assets', 'raw', 'q_bosses.json')

# ---- The six at sea: (class id, the boss it serves, English, Russian, how it looks from straight above) ----------------
SEA = [
    ('old_moorings', 'old_moorings', 'Old Moorings', 'Старый Швартов',
     'a colossal conger eel as thick as a ship\'s mainmast, a long sinuous grey-brown body in a gentle S-curve, its blunt head at the top with small pale eyes and a jutting underjaw, rusted mooring chains and frayed hawsers wound about its middle, grey silt and weed clinging along its back'),
    ('old_tithe', 'old_tithe', 'The Tithe-Taker', 'Сборщица Десятины',
     'a huge old grey shark as long as a frigate, its pale scarred hide crusted with barnacles and old broken harpoon heads, swept-back pectoral fins, a tall tail fin at the bottom, a scrap of torn sailcloth caught on one fin'),
    ('fog_changeling', 'fog_changeling', 'The Fog Changeling', 'Подменыш туманов',
     'a giant cuttlefish the size of a brig, a broad oval mantle edged on both sides with a fine rippling fin, its short arms gathered in a bunch at the top, its skin banded in shifting pale grey, mother-of-pearl and faint violet, two large eyes with W-shaped pupils'),
    ('rime_narwhal', 'rime_twins', 'Rime Narwhal (the Rime Twins)', 'Инеевый нарвал (Инеевые близнецы)',
     'a white narwhal as long as a frigate, its hide bone-white mottled with pale grey, a very long spiral ivory tusk pointing straight up past its head, white rime frost along its back and on its tail flukes'),
    ('cinder_ray', 'cinder_ray', 'The Cinder Ray', 'Пепельный скат',
     'a colossal manta ray with its broad wings spread wide to both sides, black glassy hide crazed all over with thin glowing orange ember cracks, two curled horn-fins at the front, a long thin tail trailing straight down'),
    ('drowned_prelate', 'drowned_prelate', 'The Drowned Prelate', 'Утонувший Прелат',
     'a vast hunched shape rising from the sea, seen from directly above: the point of a tall bishop\'s mitre of pale coral at the top, a cope of dark kelp and barnacled cloth spreading round it in a wide ragged circle, two long pale hands at its sides gripping a crozier of drowned driftwood, no face to be seen from above'),
    ('bell_spire', 'drowned_prelate', 'Bell Spire', 'Колокольня',
     'the top of a drowned church spire standing out of the sea, seen from directly above: an octagonal roof of dark slates crusted with barnacles and weed around an open belfry where an old bronze bell hangs, green with age'),
]

# Four to a sheet where they are long and narrow, three where they are broad: a sheet's monsters are painted at one scale.
SEA_SHEETS = [['old_moorings', 'old_tithe', 'fog_changeling', 'rime_narwhal'], ['cinder_ray', 'drowned_prelate', 'bell_spire']]

SEA_STYLE = ('Every creature is viewed STRICTLY TOP-DOWN: an orthographic view from directly overhead at exactly 90 degrees, no '
             'perspective, no tilt; each swims straight UP the picture, its head at the top and its tail at the bottom, perfectly '
             'vertical and centred in its own part of the image, filling most of the image height, its whole body in frame. Wet, '
             'weathered, heavy, grounded Pirate Gothic, painterly; muted palette of charcoal, graphite, slate grey, bone white, cold '
             'blue-grey and old brass, low saturation. Neutral soft even light from overhead, no cast shadows. Solid flat magenta '
             '#FF00FF background: no water, no waves, no wake, no foam, no reflections, no border, no text, no letters. No blood, no '
             'gore, no skeletons, no bones.')


def sea_prompt(group):
    rows = ' '.join(f'{i + 1}) {x[4]};' for i, x in enumerate(group))
    n = ['one', 'two', 'three', 'four'][len(group) - 1]
    part = 'quarter' if len(group) == 4 else 'third' if len(group) == 3 else 'half'
    return (f'Draw a wide 3:2 image: a game sprite sheet of {n} different sea monsters for a dark pirate sea map, side by side in '
            f'one row, left to right, each alone in its own {part} of the image with wide empty gaps between them so that nothing '
            f'touches: {rows} {SEA_STYLE}')


# ---- The four ashore: (id, English, Russian, body, look, idle a breath later, attack, hit) -----------------------------
HIT = {
    'big': 'reeling back from a heavy blow while still facing right: leaning back, shoulders hunched, still holding the same thing',
    'beast': 'recoiling from a blow while still facing right: head pulled back, body hunched low',
}

SHORE = [
    ('mire_mother', 'Mire Mother', 'Мать Трясины', 'beast',
     'a colossal toad-queen the size of a longboat, mottled olive and black warty hide, her broad back heaped with clusters of pale glistening spawn, a crown-like ridge of horny knobs over her huge golden eyes, a wide mouth, squatting on thick legs, her head toward the right',
     'her throat swelling and the spawn on her back glistening', 'lashing her long sticky tongue far out toward the right, her mouth wide', ''),
    ('cinder_salamander', 'Cinder Salamander', 'Пепельная саламандра', 'beast',
     'a great salamander as long as a pinnace, black hide cracked all over with thin glowing orange embers, a broad flat head with small fierce eyes, a long heavy tail, thick short legs, faint sparks rising off its back, its head toward the right',
     'the ember cracks along its back glowing brighter, a few more sparks rising', 'rearing its head and breathing a gout of orange fire toward the right', ''),
    ('drowned_abbess', 'Abbess of the Drowned Bell', 'Аббатиса Утонувшего Колокола', 'big',
     'a tall drowned abbess risen from the sea: grey waterlogged skin, a nun\'s habit and veil of dark weed and pale coral, kelp hanging from her long sleeves, water dripping from her, an old bronze church bell hung on a rusted chain held in both hands',
     'the bell swinging a little on its chain, her veil stirring', 'swinging the great bronze bell on its chain in a wide heavy arc toward the right', ''),
    ('walrus_tyrant', 'Walrus Tyrant', 'Морж-тиран', 'beast',
     'a colossal old walrus bull as big as a rowing boat, wrinkled scarred brown hide, a huge bristled moustache and two long yellowed tusks like a ship\'s knees, propped up on his front flippers, his head toward the right',
     'his head lifted high, breath steaming from his nostrils', 'lunging forward and stabbing down hard with both tusks toward the right', ''),
]

FRAMES = ('', '_b', '_atk', '_hit')


def shore_prompt(k):
    cid, en, ru, body, look, idle2, attack, hit = k
    who = 'character' if body == 'big' else 'creature'
    hit = hit or HIT[body]
    idle = 'standing ready, looming' if body == 'big' else 'poised and alert'
    return (
        f'Draw a wide 3:2 image: a game sprite sheet with four poses of the same {who} side by side in one row, left to right: '
        f'1) idle, {idle}; 2) the same pose a breath later, {idle2}; 3) attack, {attack}; 4) hit, {hit}. '
        f'The {who}: {look}. '
        f'All four poses show exactly the same {who} — the same face, build, colours and size; all face right in three-quarter view from '
        'slightly above; the whole body is visible; the figures are large, about three quarters of the image height, with wide empty '
        'gaps between them. Smooth painterly digital painting with soft edges and no ink outlines, like the hand-painted unit sprites of '
        '1990s fantasy strategy games, grim and weathered; muted colours: charcoal, tarred leather, wool, rust, old brass, faded red, cold '
        'blue-grey. No blood, no wounds, no red stains, no skeletons and no bones anywhere. '
        'Solid flat magenta #FF00FF background, no floor, no shadows, no lines, no frames, no text.'
    )


def main() -> None:
    sheets = json.load(open(SHEETS, encoding='utf-8'))
    jobs = []
    by = {x[0]: x for x in SEA}
    for n, ids in enumerate(SEA_SHEETS, 1):
        group = [by[i] for i in ids]
        key = f'bosses_sea_{n}'
        p = sea_prompt(group)
        old = sheets.get(key, {})
        sheets[key] = {'grid': [len(group), 1], 'mode': 'keyed', 'split': 'blobs', 'px': 768, 'square': False, 'dir': 'monsters', 'aspect': '3:2',
                       'ids': [f'monster.{x[0]}' for x in group], 'prompt': p}
        if old.get('cut'):
            sheets[key]['cut'] = old['cut']
        else:
            sheets[key]['painting'] = True
            jobs.append({'name': f'sheet.{key}', 'prompt': p})
    for k in SHORE:
        cid = k[0]
        key = f'anim_{cid}'
        p = shore_prompt(k)
        old = sheets.get(key, {})
        sheets[key] = {'grid': [4, 1], 'mode': 'keyed', 'split': 'blobs', 'px': 512, 'square': False, 'uniform': 0.45, 'dir': 'units', 'aspect': '3:2',
                       'ids': [f'unit.{cid}{f}' for f in FRAMES], 'creature': {'faction': 'boss', 'tier': 7, 'en': k[1], 'ru': k[2], 'body': k[3]}, 'prompt': p}
        if old.get('cut'):
            sheets[key]['cut'] = old['cut']
        else:
            sheets[key]['painting'] = True
            jobs.append({'name': f'sheet.{key}', 'aspect': '3:2', 'prompt': p})
    with open(SHEETS, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '\n')
    with open(JOBS, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    print(len(SEA), 'sea monsters on', len(SEA_SHEETS), 'sheets ·', len(SHORE), 'great ones ashore ·', len(jobs), 'jobs')


if __name__ == '__main__':
    main()
