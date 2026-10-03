"""Twenty new ports (owner, 2026-10-03: «около 20 городов (портов)»): each with its sea, its faction, its size, its yard and
its trade, its names and its line in both languages, and how it is painted — the town on the chart (one sprite each, cut
from magenta like the faction towns in assets/props/port_<faction>.webp) and its harbour seen from the water (one
painting each, like assets/art/port_<faction>.webp).

    python tools/art/ports.py      # sheets into tools/art/sheets.json, ChatGPT jobs into assets/raw/q_ports.json

The game's side (placing them on the chart after appendIsles, their markets and quests) reads PORTS below through
shared/src/world/newports.ts; this file only paints.
"""

import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHEETS = os.path.join(ROOT, 'tools', 'art', 'sheets.json')
JOBS = os.path.join(ROOT, 'assets', 'raw', 'q_ports.json')

P = []


def p(pid, region, faction, size, yard, black, en, ru, line_en, line_ru, produces, consumes, town, harbour):
    P.append({'id': pid, 'region': region, 'faction': faction, 'size': size, 'yard': yard, 'black': black, 'en': en, 'ru': ru,
              'line': [line_en, line_ru], 'produces': produces, 'consumes': consumes, 'town': town, 'harbour': harbour})


# ---- The Black Coast ----------------------------------------------------------------------------------------------------
p('bellhaven', 'black_coast', 'crown', 3, 4, False, 'Bellhaven', 'Колокольная Гавань',
  "The Crown's dockyard. Two stone dry docks, a ropewalk a quarter-mile long, the Admiralty bell.",
  'Королевская верфь. Два каменных сухих дока, канатная мастерская в четверть мили и колокол Адмиралтейства.',
  ['planks', 'sailcloth', 'weapons'], ['timber', 'iron', 'provisions', 'rum'],
  'a grey stone naval dockyard town: two long stone dry docks each holding a half-built hull on its stocks, a very long narrow ropewalk shed, slate-roofed storehouses, a tall bell tower and a small star-shaped bastion at one corner',
  'a grey stone naval dockyard town: two half-built warships on their stocks in stone dry docks, a tall bell tower, cranes and slate roofs')
p('gallowsmouth', 'black_coast', 'crown', 2, 2, False, 'Gallowsmouth', 'Висельная Губа',
  "The Crown's prison port. A star fort on the rock, the prison hulks rotting at their moorings.",
  'Тюремный порт Короны. Звёздный форт на скале, гниющие на якорях плавучие тюрьмы.',
  ['salt', 'provisions'], ['weapons', 'gunpowder', 'medicine', 'cloth'],
  'a grim walled prison town on a black rock: a dark star fort with thick walls, a square stone gaol with barred windows, a few huddled slate-roofed houses and two old dismasted prison hulks moored at the end of the piers',
  'a grim prison town on a black rock: a dark star fort above, a square stone gaol with barred windows, two old dismasted prison hulks moored in the harbour')
# ---- Gravewater ---------------------------------------------------------------------------------------------------------
p('copperhook', 'gravewater', 'league', 2, 3, False, 'Copperhook', 'Медный Крюк',
  "League counting houses on canals. Copper roofs gone green, cranes over every quay.",
  'Конторы Лиги над каналами. Позеленевшие медные крыши, краны над каждой пристанью.',
  ['cloth', 'spices', 'medicine'], ['sugar', 'iron', 'timber', 'provisions'],
  'a rich merchant town cut by narrow canals: tall narrow brick counting houses with verdigris-green copper roofs, wooden cargo cranes over the quays, little arched bridges and a domed guildhall in the middle',
  'a rich merchant town of tall narrow brick houses with green copper roofs along canals, wooden cargo cranes over the quays, a domed guildhall')
p('rotgut_landing', 'gravewater', 'free', 1, 1, True, 'Rotgut Landing', 'Сивушная Пристань',
  'Stills on stilts over the mud. Everyone drinks, nobody asks.',
  'Перегонные кубы на сваях над илом. Пьют все, не спрашивает никто.',
  ['rum', 'sugar'], ['provisions', 'weapons', 'cloth', 'iron'],
  'a ramshackle free town on stilts over grey mudflats: leaning plank shacks and taverns joined by rope walkways, copper stills with smoking chimneys, barrels stacked everywhere, rickety jetties',
  'a ramshackle town of leaning plank shacks and taverns on stilts over mudflats, copper stills smoking, rope walkways, rickety jetties')
p('sugarloaf', 'gravewater', 'league', 2, 2, False, 'Sugarloaf', 'Сахарная Голова',
  'League cane fields to the hills. The mills turn day and night, the bells ring the shifts.',
  'Плантации Лиги до самых холмов. Мельницы крутятся днём и ночью, колокол отбивает смены.',
  ['sugar', 'rum', 'tobacco'], ['provisions', 'iron', 'cloth', 'medicine'],
  'a plantation port town under a conical green hill: white-walled warehouses with red tile roofs, three stone windmills for crushing cane, a boiling house with tall chimneys, rows of cane fields behind',
  'a plantation port under a conical green hill: white warehouses with red tile roofs, stone windmills, boiling-house chimneys, cane fields up the slopes')
# ---- The Whispering Sea -------------------------------------------------------------------------------------------------
p('hushwater', 'whispering', 'brokers', 2, 2, True, 'Hushwater', 'Тихая Вода',
  'Houseboats lashed round a drowned bell tower. The lanterns are shuttered; trade is done in whispers.',
  'Плавучие дома вокруг затопленной колокольни. Фонари закрыты ставнями, торгуют шёпотом.',
  ['dreamleaf', 'pearls'], ['rum', 'weapons', 'medicine', 'tobacco'],
  'a town of dark wooden houseboats lashed together in rings around a half-sunken stone bell tower, plank walkways between them, shuttered lanterns, wisps of fog drifting over the roofs',
  'a town of dark houseboats lashed together around a half-sunken stone bell tower in thick fog, shuttered lanterns glowing faintly')
p('mirrorfen', 'whispering', 'brokers', 1, 1, True, 'Mirrorfen', 'Зеркальная Топь',
  'Huts in the mangrove roots. Mirror towers send the Brokers\' messages through the fog.',
  'Хижины в корнях мангров. Зеркальные башни передают вести Маклеров сквозь туман.',
  ['dreamleaf', 'provisions'], ['cloth', 'rum', 'iron', 'medicine'],
  'a small mangrove town: dark huts built high in the tangled roots of huge mangrove trees, rope bridges between them, two thin wooden signal towers topped with tilted round bronze mirrors, a narrow plank jetty',
  'a small town of huts high in the roots of huge mangroves, rope bridges, thin signal towers with round bronze mirrors catching the moon')
p('widows_wick', 'whispering', 'free', 1, 1, False, "Widow's Wick", 'Вдовий Фитиль',
  'A cliff village round the tallest lighthouse in the fog. The keeper is a widow; so is half the village.',
  'Деревня на утёсе у самого высокого маяка в тумане. Смотритель — вдова; полдеревни — тоже.',
  ['provisions', 'whale_oil'], ['timber', 'rum', 'cloth', 'medicine'],
  'a small grey cliff-top fishing village of stone cottages clustered around a very tall striped lighthouse, nets drying on poles, a steep stair cut down the cliff to a single stone jetty',
  'a grey cliff-top village around a very tall lighthouse sweeping its beam through fog, stone cottages, a steep stair down to a single jetty')
# ---- The Ashen Isles ----------------------------------------------------------------------------------------------------
p('slagport', 'ashen_isles', 'confederacy', 3, 3, True, 'Slagport', 'Шлаковый Порт',
  'Foundries on black sand under the smoking cone. The Confederacy casts its guns here.',
  'Литейни на чёрном песке под дымящимся конусом. Здесь Конфедерация отливает свои пушки.',
  ['iron', 'weapons', 'gunpowder', 'coal'], ['provisions', 'rum', 'timber', 'cloth'],
  'a soot-black foundry town on black volcanic sand: brick furnaces with glowing open mouths, tall smoking chimneys, rows of cast cannon barrels laid out in a yard, slag heaps, iron-roofed sheds, heavy stone quays',
  'a soot-black foundry town on black sand under a smoking volcanic cone, glowing furnaces and tall chimneys, cannon barrels stacked on the quays')
p('brimstone_bay', 'ashen_isles', 'confederacy', 2, 2, True, 'Brimstone Bay', 'Серная Бухта',
  'Yellow terraces of sulphur and the men who dig them. The air bites; the powder is the best on the sea.',
  'Жёлтые террасы серы и люди, что её копают. Воздух жжёт; порох — лучший на море.',
  ['gunpowder', 'sulfur_iron'], ['provisions', 'medicine', 'rum', 'timber'],
  'a mining town on terraced slopes of bright yellow sulphur crusted rock, steaming vents, wooden ore chutes running down to the quay, low stone huts, carts of yellow lumps on rails',
  'a mining town on terraced slopes of yellow sulphur rock, steaming vents and wooden ore chutes running down to the harbour')
# ---- Leviathan Reach ----------------------------------------------------------------------------------------------------
p('frostgate', 'leviathan_reach', 'harpoon', 3, 3, False, 'Frostgate', 'Ледяные Ворота',
  'The Order\'s walled town in the fjord. The try-works never go out; the ice never quite lets go.',
  'Обнесённый стеной город Ордена во фьорде. Салотопни не гаснут; лёд никогда не отпускает до конца.',
  ['whale_oil', 'leviathan_bone', 'provisions'], ['salt', 'rum', 'weapons', 'timber'],
  'a snow-covered walled whaling town in a fjord: steep dark timber longhouses with snow on the roofs, a stone wall with a gate of two crossed whale jawbones, smoking try-works with big iron pots, flensing platforms, ice along the piers',
  'a snow-covered walled whaling town in a fjord, a gate of crossed whale jawbones, smoking try-works, ice floes along the piers, dark mountains behind')
p('sealhold', 'leviathan_reach', 'free', 1, 1, False, 'Sealhold', 'Тюленья Крепь',
  'Turf huts on the ice shelf. Sealskins on every frame, and the smell carries a mile.',
  'Дерновые хижины на шельфовом льду. На каждой раме — тюленьи шкуры, запах слышно за милю.',
  ['provisions', 'whale_oil'], ['salt', 'rum', 'timber', 'weapons'],
  'a tiny sealers\' settlement on an ice shelf: low round turf-roofed huts half buried in snow, wooden frames hung with stretched sealskins, sledges, a cut channel in the ice with a short timber jetty',
  'a tiny settlement of turf huts on an ice shelf under the aurora, frames of stretched sealskins, a channel cut in the ice')
# ---- Dead Man's Expanse -------------------------------------------------------------------------------------------------
p('saltglass', 'dead_mans_expanse', 'league', 2, 2, False, 'Saltglass', 'Соляное Стекло',
  'White salt pans and the glassworks that burn day and night. The League sells both by the shipload.',
  'Белые солеварни и стекловарни, что горят днём и ночью. Лига продаёт и то, и другое трюмами.',
  ['salt', 'cloth'], ['provisions', 'timber', 'rum', 'coal'],
  'a sun-bleached white town of flat-roofed adobe houses beside a chequerboard of shallow white salt pans, two domed brick glass kilns glowing, windmill pumps, a long stone mole',
  'a sun-bleached white town of flat-roofed adobe houses beside shimmering salt pans under the moon, glowing domed glass kilns')
p('wreckhold', 'dead_mans_expanse', 'free', 2, 2, True, 'Wreckhold', 'Обломная Крепь',
  'A town built of the ships the reef took. Every house was a hull once; every door was a hatch.',
  'Город из кораблей, что забрал риф. Каждый дом был корпусом, каждая дверь — люком.',
  ['timber', 'planks', 'weapons'], ['provisions', 'rum', 'medicine', 'cloth'],
  'a town built from shipwrecks on a coral reef: overturned hulls used as roofs, houses made of ship sterns with their gallery windows, broken masts as poles, rope bridges, a beached galleon turned into a tavern',
  'a town built from wrecks on a reef: upturned hulls as roofs, a beached galleon turned tavern, broken masts, lanterns in old gallery windows')
p('lotus_anchorage', 'dead_mans_expanse', 'free', 2, 3, False, 'Lotus Anchorage', 'Лотосовая Стоянка',
  'The eastern traders\' enclave. Junks at anchor, silk under awnings, a pagoda bell for the tide.',
  'Анклав восточных купцов. Джонки на якоре, шёлк под навесами, колокол пагоды отбивает прилив.',
  ['spices', 'cloth', 'medicine'], ['iron', 'sugar', 'rum', 'pearls'],
  'an eastern trading enclave: dark wooden houses with curved tiled roofs, a five-storey pagoda, red lacquered gateways, awnings over market stalls, a stone quay with two moored junks with batten sails',
  'an eastern trading enclave: curved tiled roofs, a tall pagoda, red lacquered gates, moored junks with batten sails, paper lanterns glowing')
# ---- The Drowned Crown --------------------------------------------------------------------------------------------------
p('steeplewater', 'drowned_crown', 'choir', 2, 2, False, 'Steeplewater', 'Шпилевая Вода',
  'A cathedral town half under the sea. They live in the upper floors and ring the drowned bells at low tide.',
  'Соборный город, наполовину ушедший под воду. Живут на верхних этажах и звонят в утопленные колокола в отлив.',
  ['pearls', 'kraken_ink'], ['provisions', 'timber', 'rum', 'cloth'],
  'a half-drowned gothic cathedral town: the upper storeys and spires of grey stone churches and houses rising out of shallow water, wooden walkways between upper windows, green weed on the stones, a great cathedral with a rose window in the middle',
  'a half-drowned gothic cathedral town, spires and upper storeys rising out of black water, wooden walkways between windows, a pale green glow in the rose window')
p('tidehallow', 'drowned_crown', 'choir', 1, 1, False, 'Tidehallow', 'Приливная Обитель',
  'The Choir\'s monastery on its causeway. Twice a day the sea closes the road.',
  'Монастырь Хора на насыпи. Дважды в день море закрывает дорогу.',
  ['medicine', 'provisions'], ['cloth', 'timber', 'rum', 'iron'],
  'a walled grey-stone monastery on a small rocky island with a long stone causeway across tidal flats, a cloister, a squat bell tower, kelp-hung walls, a small stone harbour',
  'a grey-stone monastery on a rocky islet, a long causeway half covered by the tide, a squat bell tower, kelp on the walls')
p('crownfall', 'drowned_crown', 'free', 2, 2, True, 'Crownfall', 'Павшая Корона',
  'Salvagers in the drowned capital\'s palace. Cranes over the flooded courts; everything is for sale.',
  'Ныряльщики-добытчики во дворце утонувшей столицы. Краны над затопленными дворами; всё на продажу.',
  ['pearls', 'weapons', 'cloth'], ['provisions', 'rum', 'timber', 'medicine'],
  'a salvagers\' town in the ruins of a drowned palace: broken marble colonnades and a cracked dome rising from flooded courtyards, wooden cranes and diving platforms, salvage heaped on rafts, shacks built against the palace walls',
  'a salvagers\' town in a drowned marble palace, a cracked dome and colonnades rising from flooded courts, wooden cranes and diving platforms')
# ---- The Abyss ----------------------------------------------------------------------------------------------------------
p('last_light', 'the_abyss', 'harpoon', 2, 3, False, 'Last Light', 'Последний Огонь',
  'The lighthouse fortress at the edge of the deep. Beyond its beam, the Order says, there is nothing to come back from.',
  'Маяк-крепость на краю глубины. За его лучом, говорит Орден, возвращаться уже неоткуда.',
  ['whale_oil', 'leviathan_bone'], ['provisions', 'weapons', 'gunpowder', 'medicine'],
  'a fortress lighthouse on a sheer black sea stack: a massive iron-banded stone tower with a great lantern at the top, curtain walls with heavy guns, giant pale whale ribs used as buttresses, a fortified harbour cut into the rock',
  'a fortress lighthouse on a sheer black sea stack at the edge of a dark abyss, its great beam cutting the night, giant pale whale ribs as buttresses')
p('marrowdeep', 'the_abyss', 'choir', 1, 1, True, 'Marrowdeep', 'Костный Омут',
  'A Choir enclave on a reef of old bone. The singing never stops, and the water glows where they sing.',
  'Анклав Хора на рифе из старых костей. Пение не смолкает, и вода светится там, где поют.',
  ['kraken_ink', 'pearls'], ['provisions', 'rum', 'timber', 'cloth'],
  'a dark enclave built on a reef of huge pale fossil whale bones: chapels of black stone and bone arches, faint pale green glowing pools, hanging bronze bells, a narrow bone jetty',
  'a dark enclave on a reef of huge pale fossil whale bones, black stone chapels and bone arches, faint green glowing water')

STYLE = ('Smooth painterly digital painting like the town sprites on the adventure map of Heroes of Might and Magic III, grim and '
         'weathered; night, warm lantern light in the windows and cold moonlight on the wet roofs; muted colours: charcoal, slate, '
         'tarred black wood, rust, old brass, cold blue-grey, with small warm highlights.')
BG = ('Dark Pirate Gothic, oil-painting texture over photographic realism, deep chiaroscuro: cold blue moonlight behind thin clouds '
      'and warm amber lantern light reflected in the black water, low fog. Muted palette: charcoal, graphite, cold blue-grey, old '
      'brass, very dark burgundy.')


def town_prompt(x):
    return (f'Draw a square image: a game map sprite of one port town — {x["town"]}. Seen from high above at a steep angle, the '
            'whole town compact on its own patch of shore filling most of the picture, its piers and jetties reaching straight down '
            f'toward the bottom edge. {STYLE} The town alone on a solid flat magenta #FF00FF background: no sea around it, no '
            'shadows on the background, no frame, no text, no letters, no labels.')


def harbour_prompt(x):
    return (f'Draw a wide 16:9 image: a painted game background — the harbour of {x["harbour"]}, seen from the water at night from '
            'the deck of an arriving ship, the town spread across the whole width, a few moored ships. The lower third of the '
            f'picture is calm dark water with nothing in it. {BG} No people in the foreground, no text, no letters, no frames.')


def main() -> None:
    sheets = json.load(open(SHEETS, encoding='utf-8'))
    jobs = []
    for x in P:
        key = f'port_{x["id"]}'
        p_ = town_prompt(x)
        old = sheets.get(key, {})
        sheets[key] = {'grid': [1, 1], 'mode': 'keyed', 'px': 1024, 'square': False, 'dir': 'props', 'aspect': '1:1', 'ids': [f'prop.port_{x["id"]}'], 'prompt': p_}
        if old.get('cut'):
            sheets[key]['cut'] = old['cut']
        else:
            sheets[key]['painting'] = True
            jobs.append({'name': f'sheet.{key}', 'prompt': p_})
        jobs.append({'name': f'bg.port_{x["id"]}', 'prompt': harbour_prompt(x)})
    with open(SHEETS, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sheets, indent=1, ensure_ascii=False) + '\n')
    with open(JOBS, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False)
    by = {}
    for x in P:
        by[x['region']] = by.get(x['region'], 0) + 1
    print(len(P), 'ports', by, '·', len(jobs), 'jobs')


if __name__ == '__main__':
    main()
