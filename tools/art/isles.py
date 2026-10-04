"""The islands' own things (owner, 2026-10-04: «я бы еще больше ассетов для островов сгенерировал и закинул на разные
острова все»): eight small top-down props for each of the fourteen kinds of island, painted two kinds to a ChatGPT
sheet on magenta, so no two islands of a kind are dressed alike (the renderer picks among a kind's eight by the
island's own seed: client/src/render/renderer.ts).

    python tools/art/isles.py    # sheets isle_1..isle_7 into tools/art/sheets.json, the queue into assets/raw/q_gpt_isles.json

Bake a finished sheet with: python tools/art/bt_harvest.py '[["sheet.isle_1", "hf_..._gpt-isle_1"]]'
No people, no animals, no skulls or bones, no blood (the owner's rule for all art).
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

PROPS = {
    'temperate': ['a round crown of a broad oak tree', 'two dark pine trees side by side', 'a thicket of brambles',
                  'a small stone cottage with a grey slate roof', 'a round stone well with a little wooden roof', 'a haystack',
                  'a wooden windmill with its four sails in a cross', 'a cluster of grey boulders in tufts of grass'],
    'mossy': ['a big boulder furred with green moss', 'a stand of dark spruce trees', 'a fallen mossy log', 'a patch of tall ferns',
              'a ring of mossy standing stones', 'the moss-grown slate roof of a small old chapel', 'the drooping crown of a willow',
              'a small dark peat pond with reeds at its edge'],
    'volcanic': ['a smoking vent crusted with yellow sulphur', 'a cluster of sharp black obsidian spires', 'a glowing pool of lava crusted black at its rim',
                 'a charred dead tree', 'a patch of black basalt columns with their hexagonal tops', 'a cooled tongue of rippled black lava',
                 'a ruined stone watchtower half buried in grey ash', 'a heap of grey volcanic boulders'],
    'ice': ['a cluster of tall blue ice spires', 'a fir tree heavy with snow', 'a frozen pond with white cracks', 'a small wooden boat frozen into the ice',
            'a wind-carved snow drift', 'an arch of blue ice', 'a cairn of snowy stones', 'a small hide tent with snow on its roof'],
    'ruins': ['a broken round colonnade', 'a toppled stone statue of a robed figure', 'a cracked fragment of an old mosaic floor',
              'a ruined stone archway', 'the corner of a collapsed stone wall', 'an overgrown stone stairway',
              'a fallen column broken into three drums', 'the broken top of a round stone tower'],
    'bone': ['a dead white tree with bare branches', 'a weathered grey stone obelisk', 'a cluster of pale grey rocks', 'a dried thorn bush',
             'a lone weathered stone marker', 'a rusted iron anchor half sunk in grey sand', 'the stump of a broken ship\'s mast', 'a heap of grey ash-covered stones'],
    'barren': ['a cracked rock outcrop', 'a dry dead bush', 'a pile of flat slate stones', 'a lone twisted juniper', 'a dusty dry gully',
               'a small stone cairn', 'a weather-beaten wooden signpost', 'a scatter of grey pebbles'],
    'jungle': ['a single tall palm tree', 'a broad banana plant', 'a giant fern', 'the thatched roof of a hut on stilts',
               'a carved stone idol head lying in vines', 'a thicket of bamboo', 'a fallen palm trunk wrapped in vines', 'the crown of a strangler fig tree'],
    'mangrove': ['a mangrove tree on arched roots', 'a tangle of mangrove roots in dark water', 'a bed of tall reeds', 'a fisher\'s hut on stilts',
                 'a rotting rowboat caught in roots', 'a dark pond with lily pads', 'a cypress tree with knobbly knees around it', 'a fish trap of wooden stakes'],
    'atoll': ['a coconut palm', 'a pink-grey coral head', 'a white sand bar strewn with shells', 'a pile of bleached driftwood',
              'a lean-to of palm leaves', 'a giant clam shell', 'a ring of stones of a fish weir', 'a small clear tide pool'],
    'saltflat': ['a glittering white mound of salt crystals', 'a salt pan with a white cracked crust', 'a dead bush crusted with salt', 'a pile of salt sacks',
                 'a salt worker\'s plank shack', 'a stack of cut salt blocks', 'a rusted iron cauldron for boiling brine', 'a pillar of white rock'],
    'blacksand': ['a black volcanic rock streaked with white salt', 'a beached black log', 'a tuft of dark dune grass', 'a rippled black sand dune',
                  'a tar-black boulder', 'a ruined hut of black stone', 'a heap of dark kelp', 'a smoking driftwood fire pit'],
    'fungal': ['a giant pale mushroom cap', 'a cluster of glowing purple mushroom caps', 'a log covered in shelf fungus', 'a ring of round puffballs',
               'a tall thin-stalked mushroom', 'a rock furred with white mycelium', 'a purple mushroom puffing a little cloud of spores', 'a tree stump crowned with fungus'],
    'crystal': ['a cluster of blue-white crystals', 'a single tall crystal spire', 'a boulder studded with crystals', 'a ring of small crystals',
                'an open geode with violet crystals inside', 'a crystal growing out of a ruined pillar', 'a pale tree of crystal', 'a field of small glowing crystal shards'],
}

# The second eight of each kind (the same day: «ещё больше ассетов для островов»), ids _9.._16.
PROPS_B = {
    'temperate': ['an orchard of four apple trees', 'a wooden barn with a mossy roof', 'a stone sheepfold', 'a duck pond with reeds',
                  'a woodpile and a chopping block', 'a vegetable garden in rows', 'a stone bridge over a brook', 'a tall lone elm'],
    'mossy': ['a mossy stone cross', 'a ring of toadstools in moss', 'a hollow tree trunk furred with moss', 'a moss-covered ruined well',
              'a thicket of dark holly', 'a mossy stone footbridge', 'a pile of mossy logs', 'a grey marsh pool with cotton grass'],
    'volcanic': ['a crack in the ground glowing with lava', 'a steaming hot spring', 'a fallen obsidian pillar', 'a field of grey pumice stones',
                 'a hardened lava bubble split open', 'a sulphur-yellow pool', 'a blackened stone shrine', 'a column of grey smoke from a vent'],
    'ice': ['a frozen waterfall seen from above', 'a snowed-under wooden hut', 'a cracked ice floe', 'a heap of frozen barrels',
            'a snow-covered stone tower stump', 'a ring of ice crystals', 'a sledge half buried in snow', 'a stand of frosted birches'],
    'ruins': ['a broken stone fountain', 'a headless stone statue on a plinth', 'a sunken stone courtyard', 'a toppled bell in rubble',
              'a ruined chapel apse', 'a row of broken arches', 'a cracked stone sarcophagus lid', 'a fallen stone lion'],
    'bone': ['a grey dead oak', 'a leaning grey menhir', 'a dry cracked pond bed', 'a rusted iron cage, empty',
             'a ring of grey stones around ash', "a broken ship's wheel half buried", 'a grey thorn hedge', 'a leaning grey stone cross'],
    'barren': ['a lone grey boulder split in two', 'a dry stony riverbed', 'a scrubby gorse bush', 'a ruined stone wall line',
               'a cracked clay pan', 'a heap of rusted chain', 'a dry thistle patch', 'a weathered wooden post'],
    'jungle': ['a giant leafy tree crown', 'a vine-covered stone stele', 'a heap of coconuts', 'a jungle pool with lotus',
               'a rope bridge between two trees', 'a ruined step pyramid top', 'a clump of red jungle flowers', 'a mangrove-like tangle of lianas'],
    'mangrove': ['a narrow dugout canoe in reeds', 'a mudflat crossed by roots', 'a stilt platform of planks', 'a cluster of nipa palms',
                 'a sunken wooden pier', 'a drying rack of nets', 'a swamp cypress stump', 'a tangle of floating weed'],
    'atoll': ['a palm grove of three palms', 'a beached outrigger canoe', 'a shell midden', 'a coral ridge in shallow water',
              'a small thatched shelter', 'a heap of fishing floats and nets', 'a sand mound above the tide line', 'a lone sea-almond tree'],
    'saltflat': ['a row of salt evaporation pans', 'a cracked salt crust with blue water', 'a wooden salt rake and barrow', 'a white salt cairn',
                 "a salt worker's tent", 'a stranded salt barge', 'a ring of salt-crusted stones', 'a dry salt-white tree'],
    'blacksand': ['a black rock arch', 'a smoking black fissure', 'a beached barrel half buried in black sand', 'a cluster of black boulders',
                  'a ruined black lighthouse base', 'a dune of black sand with grass', 'a black driftwood pile', 'a tide-cut black rock shelf'],
    'fungal': ['a giant bracket fungus on a dead trunk', 'a cluster of tall grey mushrooms', 'a glowing blue mushroom ring', 'a fungus-choked ruined hut',
               'a field of tiny white caps', 'a pale puffball the size of a boulder', 'a red-capped mushroom cluster', 'a slime-mould covered stone'],
    'crystal': ['a crystal arch', 'a cluster of rose-grey crystals', 'a crystal-veined rock wall', 'a shallow crystal pool',
                'a fallen crystal spire', 'a crystal growing through a stone altar', 'a ring of pale crystal shards', 'a single dark smoky crystal'],
}

# One landmark for a great island (r ≥ 600 m): sixteen set pieces, bigger than the props, one each by the island's id.
LANDMARKS = ['a great ruined stone lighthouse on a rocky knoll', 'a ruined hilltop temple with a broken dome', 'a colossal toppled stone statue of a sea king lying in the grass',
             'a ring fort of grey stone with a ruined keep', 'a stepped stone pyramid overgrown with vines', 'a huge hollow ancient tree with a hut built in it',
             'a wrecked galleon lying on its side on dry land, overgrown', 'a cliff carved into a giant weathered stone face', 'a sunken cathedral spire rising from a pond',
             'a stone circle of tall menhirs around an altar stone', 'a ruined windmill and granary farm', 'a smoking crater with a ruined observatory on its rim',
             'a frozen shipwreck locked in a glacier', 'a giant crystal pillar wrapped around a ruined tower', 'a giant mushroom grove around a ruined chapel',
             'a ruined pirate fort with a broken palisade and a rusted cannon']


def landmark_prompt() -> str:
    listing = ' '.join(f'{i + 1}) {r};' for i, r in enumerate(LANDMARKS))
    return ('Draw a square image: sixteen separate large landmarks for the map of a dark pirate game, each a whole set piece seen from straight '
            'above as a bird would see it, laid out in a 4 by 4 grid, each centred in its own cell and filling about four fifths of it, with wide '
            'even gaps of empty background between them so that no two touch. A grim, weathered, realistic painted style with muted colours — '
            'dark greens, charcoal, weathered wood, tar black, rust, old brass, cold blue-grey — soft light from the upper left, one consistent hand '
            f'for all sixteen: {listing} No people, no animals, no skulls, no bones, no blood. Solid flat magenta #FF00FF background, no ground '
            'around the landmarks, no lines, no text, no letters.')


PAIRS = [('temperate', 'mossy'), ('volcanic', 'ice'), ('ruins', 'bone'), ('barren', 'jungle'), ('mangrove', 'atoll'), ('saltflat', 'blacksand'), ('fungal', 'crystal')]


def art(word: str) -> str:
    return 'an' if word[0] in 'aeiou' else 'a'


def prompt(a: str, b: str, props: dict) -> str:
    rows = props[a] + props[b]
    listing = ' '.join(f'{i + 1}) {r};' for i, r in enumerate(rows))
    return ('Draw a square image: sixteen separate small objects for the map of a dark pirate game, each seen from straight above as '
            'a bird would see it, laid out in a 4 by 4 grid, each centred in its own cell and filling about two thirds of it, with wide '
            'even gaps of empty background between them so that no two touch. A grim, weathered, realistic painted style with muted '
            'colours — dark greens, charcoal, weathered wood, tar black, rust, old brass, cold blue-grey — soft light from the upper left, '
            f'one consistent hand for all sixteen. The first two rows are things of {art(a)} {a} island, the last two of {art(b)} {b} '
            f'island: {listing} No people, no animals, no skulls, no bones, no blood. '
            'Solid flat magenta #FF00FF background, no ground around the objects, no lines, no text, no letters.')


def main() -> None:
    path = os.path.join(HERE, 'sheets.json')
    with open(path, encoding='utf-8') as f:
        sheets = json.load(f)
    jobs = []
    for k, (a, b) in enumerate(PAIRS + PAIRS):
        second = k >= len(PAIRS)
        name = f'isle_{k + 1}'
        base = 9 if second else 1
        ids = [f'prop.isle_{a}_{i + base}' for i in range(8)] + [f'prop.isle_{b}_{i + base}' for i in range(8)]
        sheets[name] = {**sheets.get(name, {}), 'grid': [4, 4], 'mode': 'keyed', 'px': 256, 'square': False, 'dir': 'props', 'aspect': '1:1',
                        'uniform': 0.67, 'ids': ids, 'prompt': prompt(a, b, PROPS_B if second else PROPS)}
        # The magenta's cast out of leaves and stone (it tinted the ferns and the willow pink); not out of the fungal and
        # crystal isles, whose purples are their own.
        if 'fungal' not in (a, b):
            sheets[name]['despill'] = True
        if not sheets[name].get('cut'):
            sheets[name]['painting'] = True  # still in the painter's queue: slice_sheet.py takes this off when it cuts it
        jobs.append({'name': f'sheet.{name}', 'prompt': prompt(a, b, PROPS_B if second else PROPS)})
    lm = 'isle_landmarks'
    sheets[lm] = {**sheets.get(lm, {}), 'grid': [4, 4], 'mode': 'keyed', 'px': 384, 'square': False, 'dir': 'props', 'aspect': '1:1',
                  'uniform': 1.0, 'despill': True, 'ids': [f'prop.landmark_{i + 1}' for i in range(16)], 'prompt': landmark_prompt()}
    if not sheets[lm].get('cut'):
        sheets[lm]['painting'] = True
    jobs.append({'name': f'sheet.{lm}', 'prompt': landmark_prompt()})
    with open(path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '\n')
    with open(os.path.join(ROOT, 'assets', 'raw', 'q_gpt_isles.json'), 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    print(len(jobs), 'jobs; longest', max(len(j['prompt']) for j in jobs))


if __name__ == '__main__':
    main()
