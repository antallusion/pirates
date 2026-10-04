// The premium hulls' own creatures (owner, 2026-10-03: «уникальные существа для этого корабля»): one kind for each of
// the forty premium hulls of the fleet of eighty (shared/src/data/ships.ts) and of the third batch's eight
// (2026-10-04), painted with the battle's creatures (tools/art/creatures.py, faction `premium_ship`; the eight four
// to a sheet, tools/art/fleet_b3.py). A kind comes aboard with its hull when she is bought for doubloons
// and is had nowhere else: no tamer, lair, drift, roaming stack, capture nor egg hands it out, and the shop does not
// sell it apart from her (shared/src/data/premium.ts). Lost in a fight, it comes back to her — in port, and at sea
// aboard the hulls whose gift is to muster their own (shared/src/data/shipgifts.ts) — up to the number she came with.
//
// They are units as the men are (UNITS takes them in): each with HoMM3's numbers a little over the upgraded kind of its
// tier, two specials, and its own painted figure (`unit.<kind>`, four poses) — till that is painted, a figure of the
// same body stands in for it (shared/src/data/fleet.ts). They are the ship's company, not the docs/18 creatures of the
// tamers and the pens: they eat with the crew, they never slip over the side, no tamer buys them.

import type { UnitDef, UnitSpecial } from './army.ts';
import type { Tr } from './estate.ts';
import { SHIP_CLASSES } from './ships.ts';
import type { ShipClassId } from './ships.ts';

export type ShipBeastId =
  // The warships'.
  | 'corsair_phantom' | 'dragon_lancer' | 'iron_marine' | 'storm_caller' | 'sea_wyvern' | 'war_orca' | 'crimson_guard' | 'mist_wraith' | 'storm_berserker' | 'sun_guard'
  // The traders'.
  | 'gilded_golem' | 'spice_djinn' | 'silk_blade' | 'night_smuggler' | 'pearl_siren' | 'bazaar_monkeys' | 'rum_brawler' | 'ledger_enforcer' | 'jade_guard' | 'vault_crab'
  // The runners'.
  | 'giant_hawk' | 'wind_sprite' | 'great_white' | 'ghost_navigator' | 'flying_fish' | 'white_albatross' | 'silver_archer' | 'storm_petrels' | 'mermaid_queen' | 'sea_viper'
  // The haulers'.
  | 'leviathan_calf' | 'turtle_knight' | 'bastion_gunner' | 'sea_chimera' | 'whale_calf' | 'coral_elemental' | 'bell_priest' | 'jade_dragon' | 'pirate_lord' | 'bell_diver'
  // The third batch's premium hulls (owner, 2026-10-04), two a list: the warships', the traders', the runners', the
  // haulers'.
  | 'war_mastiff' | 'corposant' | 'cormorant' | 'winged_lion' | 'dolphin_pod' | 'marlin' | 'cask_mimic' | 'ice_bear';

/** How a figure stands in its four poses (tools/art/creatures.py): on its feet, a large one on its feet, a beast on its
 *  feet or belly, in the air, rising out of a patch of sea. */
export type Body = 'man' | 'big' | 'beast' | 'fly' | 'water';

export interface ShipBeastDef {
  /** The premium hull it comes aboard with. */
  hull: ShipClassId;
  tier: number;
  body: Body;
  atk: number;
  def: number;
  dmin: number;
  dmax: number;
  hp: number;
  speed: number;
  init: number;
  shots: number;
  specials: UnitSpecial[];
  /** Silver a creature is reckoned at (a ransom, the sea's reckoning of an army). */
  cost: number;
  /** Its name and what it is, as the army's screen says them: English, Russian, English, Russian. */
  names: [string, string, string, string];
  /** How tall it stands beside a hex's width on the battle's field (the men 1.28, the great beasts up to 1.75). */
  fig: number;
  /** The painted figure of the same body that stands in for its own till that is painted (`unit.<kind>`). */
  stand: string;
  /** What it throws or fires on the field (a shooter's missile; muskets when absent). */
  missile?: string;
}

const B = (hull: ShipClassId, tier: number, body: Body, s: [atk: number, def: number, dmin: number, dmax: number, hp: number, speed: number, init: number, shots: number], specials: UnitSpecial[], cost: number, names: [string, string, string, string], fig: number, stand: string, missile?: string): ShipBeastDef => ({
  hull, tier, body, atk: s[0], def: s[1], dmin: s[2], dmax: s[3], hp: s[4], speed: s[5], init: s[6], shots: s[7], specials, cost, names, fig, stand, ...(missile ? { missile } : {}),
});

/** One of each kind (the HoMM3 scale beside the men: a cutthroat 12/9 5–7 18 hp at tier 5, a life guard 15/14 7–10 30
 *  at tier 6, the ape king 19/15 11–17 64 at tier 7). */
export const SHIP_BEAST_DEFS: Record<ShipBeastId, ShipBeastDef> = {
  // The warships'.
  corsair_phantom: B('black_corsair', 5, 'man', [14, 10, 5, 8, 20, 7, 12, 0], ['double_strike', 'no_retaliation'], 280,
    ['Corsair Phantoms', 'Фантомы корсара', 'Duellists of the Black Corsair in smoke and crimson: they strike twice and are never answered.', 'Дуэлянты «Чёрного корсара» в дыму и багрянце: бьют дважды, и им не отвечают.'], 1.28, 'unit.cutthroat'),
  dragon_lancer: B('dragon_junk', 4, 'man', [11, 8, 4, 7, 15, 5, 8, 3], ['shooter', 'no_penalty'], 170,
    ['Dragon Lancers', 'Драконьи копейщики', 'Marines of the battle junk: their fire lances reach across the deck, and no foe is too close for them.', 'Морпехи боевой джонки: огненные копья бьют через палубу, и вплотную им не хуже.'], 1.3, 'unit.lancer', 'part.ms_rocket'),
  iron_marine: B('iron_ram', 5, 'man', [12, 16, 5, 8, 26, 4, 7, 0], ['shield_wall', 'steady'], 280,
    ['Ironclad Marines', 'Закованные морпехи', 'Men in riveted iron who come over the ram: a wall of plate, and they never break.', 'Люди в клёпаном железе, что идут через таран: стена брони, и они не дрогнут.'], 1.35, 'unit.crown_ironclad'),
  storm_caller: B('thunderer', 5, 'man', [12, 9, 5, 8, 18, 5, 9, 4], ['shooter', 'blast'], 280,
    ['Storm Callers', 'Призыватели бури', 'Copper rods that crackle with the storm: their bolts burst over a stack and those beside it.', 'Медные жезлы трещат грозой: их молнии рвутся над отрядом и над соседними.'], 1.3, 'unit.storm_witch', 'part.ms_brine'),
  sea_wyvern: B('wyvern_galleass', 6, 'fly', [17, 12, 7, 11, 36, 9, 12, 0], ['flying', 'poison'], 420,
    ['Sea Wyverns', 'Морские виверны', 'The wyvern of the galleass: over every rank, and its bite poisons.', 'Виверна галеаса: над любым строем, и укус её ядовит.'], 1.6, 'unit.storm_roc'),
  war_orca: B('kraken_hunter', 6, 'water', [18, 13, 8, 12, 42, 7, 10, 0], ['diving', 'sweep'], 440,
    ['War Orcas', 'Боевые косатки', 'Harnessed orcas of the kraken hunter: out of the surf, they sweep all about them.', 'Косатки в сбруе охотника на кракенов: выходят из прибоя и метут всё вокруг.'], 1.6, 'unit.white_whale'),
  crimson_guard: B('crimson_tide', 6, 'man', [16, 15, 7, 11, 32, 6, 10, 0], ['leader', 'retaliate_all'], 420,
    ['Crimson Guard', 'Багровая гвардия', 'The flagship\'s own guard: the crew fights harder with them aboard, and they answer every blow.', 'Гвардия флагмана: с ними команда бьётся злее, и на каждый удар они отвечают.'], 1.32, 'unit.life_guard'),
  mist_wraith: B('phantom_brig', 4, 'fly', [10, 9, 3, 6, 16, 8, 10, 0], ['flying', 'undead'], 170,
    ['Mist Wraiths', 'Туманные призраки', 'Sailors of mist off the phantom brig: they fly over everything, and no fear touches them.', 'Матросы из тумана с брига-фантома: пролетают над всем, и страх их не берёт.'], 1.25, 'unit.lantern_wraith'),
  storm_berserker: B('storm_reaver', 5, 'man', [15, 8, 5, 9, 22, 6, 10, 0], ['double_strike', 'steady'], 270,
    ['Storm Berserkers', 'Штормовые берсерки', 'Painted raiders who strike twice and never freeze.', 'Раскрашенные налётчики: бьют дважды и не цепенеют.'], 1.32, 'unit.boarder'),
  sun_guard: B('sun_galleon', 6, 'man', [15, 17, 7, 10, 34, 5, 9, 0], ['shield_wall', 'steady'], 420,
    ['Sun Guard', 'Солнечная стража', 'Knight-marines of the Crown behind golden suns: half the harm from shots, and they never break.', 'Рыцари-морпехи Короны за золотыми солнцами: вполовину меньше урона от выстрелов, и они не дрогнут.'], 1.32, 'unit.crown_cuirassier'),
  // The traders'.
  gilded_golem: B('golden_carrack', 6, 'big', [16, 18, 8, 12, 50, 4, 6, 0], ['retaliate_all', 'steady'], 450,
    ['Gilded Golems', 'Позолоченные големы', 'Brass and gold with a furnace for a heart: it answers every blow and never flinches.', 'Латунь и золото, вместо сердца — топка: отвечает на каждый удар и не дрогнет.'], 1.6, 'unit.basalt_guardian'),
  spice_djinn: B('spice_dhow', 6, 'fly', [15, 11, 6, 10, 32, 9, 12, 4], ['flying', 'shooter'], 430,
    ['Spice Djinn', 'Пряный джинн', 'Smoke of saffron and cinnamon: it flies over everything and hurls burning spice from afar.', 'Дым шафрана и корицы: летит над всем и швыряет горящие пряности издали.'], 1.45, 'unit.lantern_wraith', 'part.ms_flask'),
  silk_blade: B('silk_junk', 4, 'man', [12, 8, 3, 6, 15, 6, 11, 0], ['double_strike', 'no_retaliation'], 180,
    ['Silk Blades', 'Шёлковые клинки', 'Duellists in blue silk: two blades, two blows, and no answer.', 'Дуэлянты в синем шёлке: два клинка, два удара — и без ответа.'], 1.28, 'unit.duelist'),
  night_smuggler: B('smugglers_lugger', 3, 'man', [8, 5, 2, 5, 9, 5, 9, 4], ['shooter', 'blast'], 110,
    ['Night Smugglers', 'Ночные контрабандисты', 'Blunderbusses from the dark: a burst that hits a stack and those beside it.', 'Мушкетоны из темноты: заряд бьёт по отряду и по соседним.'], 1.28, 'unit.smuggler'),
  pearl_siren: B('pearl_schooner', 5, 'water', [11, 9, 4, 7, 20, 6, 10, 4], ['shooter', 'diving'], 260,
    ['Pearl Sirens', 'Жемчужные сирены', 'Pearl-white sirens: coral spears thrown from the surf, and back under.', 'Жемчужно-белые сирены: коралловые копья из прибоя — и снова под воду.'], 1.4, 'unit.mermaid', 'part.ms_spear'),
  bazaar_monkeys: B('floating_bazaar', 1, 'beast', [5, 3, 1, 3, 5, 7, 10, 0], ['swarm', 'no_retaliation'], 30,
    ['Bazaar Monkeys', 'Базарные мартышки', 'Thieving monkeys in red fezzes: a swarm that bites and is gone before the answer.', 'Воришки в красных фесках: рой, что кусает и исчезает прежде ответа.'], 1.0, 'unit.jaguar'),
  rum_brawler: B('rum_runner', 3, 'man', [9, 6, 3, 5, 14, 5, 7, 0], ['double_strike', 'steady'], 105,
    ['Rum Brawlers', 'Ромовые драчуны', 'A bottle in one fist and a pin in the other: two blows, and rum knows no fear.', 'В одном кулаке бутылка, в другом нагель: два удара, а ром страха не знает.'], 1.28, 'unit.dock_bruiser'),
  ledger_enforcer: B('ledger_galleon', 5, 'man', [12, 10, 4, 8, 20, 5, 9, 4], ['shooter', 'no_penalty'], 270,
    ['Ledger Enforcers', 'Взыскатели', 'The Brokers\' collectors: a brace of pistols that misses nothing near or far.', 'Взыскатели Брокеров: пара пистолетов, что не промахнётся ни вблизи, ни издали.'], 1.28, 'unit.enforcer'),
  jade_guard: B('tea_clipper', 5, 'man', [13, 13, 5, 8, 24, 5, 9, 0], ['retaliate_all', 'steady'], 280,
    ['Jade Guards', 'Нефритовая стража', 'Guards in green lacquer with long glaives: they answer every blow and never break.', 'Стражи в зелёном лаке с длинными глефами: отвечают на каждый удар и не дрогнут.'], 1.3, 'unit.ledger_halberdier'),
  vault_crab: B('treasure_fluyt', 5, 'beast', [10, 18, 4, 8, 40, 3, 5, 0], ['shell', 'retaliate_all'], 300,
    ['Vault Crabs', 'Крабы-хранители', 'A crab whose shell is a strongbox: shot rings off the iron, and it answers every blow.', 'Краб с сундуком вместо панциря: пули звенят о железо, и он отвечает на каждый удар.'], 1.35, 'unit.crab_queen'),
  // The runners'.
  giant_hawk: B('sea_hawk', 4, 'fly', [12, 6, 3, 7, 16, 10, 12, 0], ['flying', 'no_retaliation'], 170,
    ['Giant Sea Hawks', 'Гигантские морские ястребы', 'Hawks of the raider schooner: down out of the sky and up again before the answer.', 'Ястребы шхуны-рейдера: падают с неба и взмывают прежде ответа.'], 1.2, 'unit.albatross'),
  wind_sprite: B('wind_dancer', 3, 'fly', [8, 6, 2, 4, 11, 10, 12, 0], ['flying', 'no_retaliation'], 105,
    ['Wind Sprites', 'Духи ветра', 'Whirls of air and spray: the quickest of all, and never answered.', 'Вихри воздуха и брызг: быстрее всех, и им не отвечают.'], 1.1, 'unit.lantern_wraith'),
  great_white: B('shark_cutter', 5, 'water', [16, 9, 6, 10, 28, 7, 11, 0], ['diving', 'double_strike'], 300,
    ['Great Whites', 'Большие белые акулы', 'Out of the surf with jaws wide: two bites, and back under.', 'Из прибоя с разинутой пастью: два укуса — и снова под воду.'], 1.35, 'unit.reef_shark'),
  ghost_navigator: B('ghost_clipper', 4, 'man', [10, 8, 3, 6, 15, 5, 9, 4], ['shooter', 'undead'], 170,
    ['Ghost Navigators', 'Призрачные штурманы', 'Pale navigators with long pistols: no fear, no morale, and they shoot from afar.', 'Бледные штурманы с длинными пистолетами: ни страха, ни духа, и стреляют издали.'], 1.28, 'unit.ghost_musketeer'),
  flying_fish: B('flying_fish', 1, 'fly', [5, 2, 1, 3, 5, 8, 11, 0], ['flying', 'swarm'], 28,
    ['Flying Fish', 'Летучие рыбы', 'A silver shoal over the rail: everywhere at once.', 'Серебряная стайка над бортом: везде сразу.'], 0.95, 'unit.gull'),
  white_albatross: B('albatross_xebec', 5, 'fly', [13, 10, 5, 8, 24, 11, 12, 0], ['flying', 'leader'], 290,
    ['White Albatrosses', 'Белые альбатросы', 'A good omen on great white wings: over everything, and the crew fights harder for it.', 'Добрый знак на огромных белых крыльях: над всем, и команда бьётся злее.'], 1.25, 'unit.albatross'),
  silver_archer: B('silver_arrow', 4, 'man', [11, 7, 3, 6, 14, 5, 10, 8], ['shooter', 'no_penalty'], 180,
    ['Silver Archers', 'Серебряные лучники', 'Archers in silver-grey scale: arrows from any range, and at arm\'s length alike.', 'Лучники в серебристой чешуе: стрелы на любой дистанции и вплотную.'], 1.28, 'unit.island_archer', 'part.ms_arrow'),
  storm_petrels: B('storm_petrel', 2, 'fly', [7, 4, 2, 4, 9, 9, 11, 0], ['flying', 'swarm'], 70,
    ['Storm Petrels', 'Буревестники', 'A sooty flock out of the storm: over every rank, everywhere at once.', 'Тёмная стая из бури: над любым строем, везде сразу.'], 1.0, 'unit.gull'),
  mermaid_queen: B('mermaid_grace', 6, 'water', [15, 13, 6, 10, 34, 7, 11, 5], ['shooter', 'diving'], 440,
    ['Mermaid Queen', 'Королева русалок', 'A queen of the sea in coral and pearl: water from her trident, and the surf hides her.', 'Морская королева в кораллах и жемчуге: струя из трезубца, и прибой её прячет.'], 1.5, 'unit.mermaid', 'part.ms_brine'),
  sea_viper: B('viper', 4, 'water', [12, 8, 3, 7, 18, 6, 10, 0], ['poison', 'diving'], 180,
    ['Sea Vipers', 'Морские гадюки', 'Banded vipers of the raider: a poisoned bite, and back into the surf.', 'Полосатые гадюки рейдера: ядовитый укус — и снова в прибой.'], 1.45, 'unit.young_serpent'),
  // The haulers'.
  leviathan_calf: B('leviathan_ark', 6, 'water', [18, 15, 8, 12, 46, 5, 8, 0], ['diving', 'sweep'], 460,
    ['Leviathan Calves', 'Детёныши левиафана', 'Young of the deep from the ark\'s pens: they sweep all about them and dive.', 'Детёныши бездны из загонов ковчега: метут всё вокруг и ныряют.'], 1.6, 'unit.shoal_leviathan'),
  turtle_knight: B('turtle_barge', 5, 'man', [11, 16, 4, 7, 26, 4, 7, 0], ['shield_wall', 'retaliate_all'], 280,
    ['Turtle Knights', 'Черепашьи рыцари', 'Armour of turtle shell: half the harm from shots, and they answer every blow.', 'Доспехи из черепашьего панциря: вполовину меньше урона от выстрелов, и они отвечают на каждый удар.'], 1.32, 'unit.baleen_knight'),
  bastion_gunner: B('floating_fortress', 5, 'man', [12, 11, 5, 9, 20, 4, 7, 3], ['shooter', 'blast'], 290,
    ['Bastion Gunners', 'Бастионные канониры', 'Hand-cannons from the battlements: a burst over a stack and those beside it.', 'Ручные пушки с бастиона: залп по отряду и по соседним.'], 1.3, 'unit.harpoon_gunner', 'part.ms_cannonball'),
  sea_chimera: B('menagerie', 7, 'big', [21, 16, 11, 17, 62, 7, 11, 0], ['terror', 'sweep'], 820,
    ['Sea Chimera', 'Морская химера', 'Lion, shark and eagle out of the menagerie\'s cage: the living freeze, and it sweeps all about it.', 'Лев, акула и орёл из клетки зверинца: живые цепенеют, а она метёт всё вокруг.'], 1.7, 'unit.mangrove_hydra'),
  whale_calf: B('whale_mother', 5, 'water', [13, 13, 5, 8, 40, 4, 6, 0], ['diving', 'regen'], 300,
    ['Whale Calves', 'Китята', 'Calves of the mothership: a hide that heals, and the surf is their road.', 'Китята плавучей матки: шкура, что заживает, и прибой — их дорога.'], 1.55, 'unit.white_whale'),
  coral_elemental: B('coral_hulk', 6, 'big', [15, 17, 7, 11, 46, 4, 6, 0], ['regen', 'retaliate_all'], 450,
    ['Coral Elementals', 'Коралловые элементали', 'Living coral that walks: it grows back and answers every blow.', 'Живой коралл, что ходит: отрастает и отвечает на каждый удар.'], 1.6, 'unit.abyss_herald'),
  bell_priest: B('drowned_cathedral', 5, 'man', [11, 10, 4, 7, 20, 4, 8, 3], ['shooter', 'terror'], 270,
    ['Bell Priests', 'Колокольные жрецы', 'Priests of the Choir with hand bells: their toll carries far, and the living beside them freeze.', 'Жрецы Хора с колокольцами: звон летит далеко, а живые рядом цепенеют.'], 1.28, 'unit.choir_bellringer', 'part.ms_bell'),
  jade_dragon: B('treasure_junk', 7, 'fly', [22, 18, 12, 18, 70, 10, 12, 0], ['flying', 'terror'], 900,
    ['Jade Dragon', 'Нефритовый дракон', 'The dragon of the treasure junk: over everything, and the living freeze at the sight.', 'Дракон сокровищницы-джонки: над всем, и живые цепенеют от одного вида.'], 1.75, 'unit.storm_roc'),
  pirate_lord: B('pirate_haven', 7, 'man', [20, 17, 10, 16, 55, 6, 11, 0], ['leader', 'double_strike'], 800,
    ['Pirate Lords', 'Пиратские лорды', 'Lords of the floating town: the crew fights harder with them, and they strike twice.', 'Лорды плавучего города: с ними команда бьётся злее, а бьют они дважды.'], 1.4, 'unit.hero_corsair'),
  bell_diver: B('iron_whale', 5, 'man', [12, 14, 5, 8, 24, 4, 7, 2], ['shooter', 'diving'], 280,
    ['Bell Divers', 'Водолазы', 'Divers in brass helmets with harpoon guns: they shoot, and the surf is their road.', 'Водолазы в латунных шлемах с гарпунными ружьями: стреляют, и прибой — их дорога.'], 1.3, 'unit.harpoon_gunner', 'part.ms_harpoon'),
  // The third batch (owner, 2026-10-04: «еще больше … кораблей»), painted four to a sheet (tools/art/fleet_b3.py).
  war_mastiff: B('bulldog', 2, 'beast', [8, 5, 2, 4, 12, 7, 9, 0], ['no_retaliation', 'steady'], 70,
    ['War Mastiffs', 'Боевые мастифы', 'Broad-chested ship\'s dogs in spiked iron collars: they bite and are back before the answer, and nothing frightens them.', 'Широкогрудые корабельные псы в шипастых железных ошейниках: кусают и отскакивают прежде ответа, и ничто их не пугает.'], 1.1, 'unit.sea_wolf'),
  corposant: B('saint_elmo', 3, 'fly', [8, 6, 2, 4, 11, 9, 11, 0], ['flying', 'chain'], 105,
    ['Corposants', 'Огни святого Эльма', 'Balls of blue fire that run down the masts in a storm: they fly over every rank, and each touch leaps on to a second foe.', 'Шары голубого огня, что сбегают по мачтам в грозу: летят над любым строем, и каждое касание перескакивает на второго врага.'], 1.05, 'unit.lantern_wraith'),
  cormorant: B('lantern_sampan', 2, 'fly', [6, 4, 2, 3, 10, 8, 10, 0], ['flying', 'fortune'], 55,
    ['Fishing Cormorants', 'Ручные бакланы', 'Black cormorants with rings at their throats, the river fishermen\'s birds: they fly over every rank, and luck sails with the side that keeps them.', 'Чёрные бакланы с кольцами на шее, птицы речных рыбаков: летят над любым строем, и стороне, что их держит, везёт.'], 1.0, 'unit.albatross'),
  winged_lion: B('golden_lion', 6, 'fly', [17, 14, 7, 11, 38, 9, 11, 0], ['flying', 'steady'], 430,
    ['Winged Lions', 'Крылатые львы', 'Gilded lions of the lagoon on eagle\'s wings: they fly over every rank, and nothing frightens them.', 'Золочёные львы лагуны на орлиных крыльях: летят над любым строем, и ничто их не пугает.'], 1.55, 'unit.sea_griffin'),
  dolphin_pod: B('dolphin', 2, 'water', [7, 4, 2, 4, 10, 7, 10, 0], ['diving', 'leader'], 60,
    ['Dolphins', 'Дельфины', 'Grey dolphins that ride her bow wave: out of the surf anywhere, and the crew fights with a lighter heart beside them.', 'Серые дельфины, что идут на её носовой волне: выходят из прибоя где угодно, и команда рядом с ними бьётся веселее.'], 1.2, 'unit.whale_calf'),
  marlin: B('sailfish', 6, 'water', [18, 12, 7, 11, 36, 8, 12, 0], ['diving', 'no_retaliation'], 430,
    ['Blue Marlins', 'Синие марлины', 'Great blue billfish out of the surf: their spears strike and they are gone before the answer.', 'Огромные синие копьеносы из прибоя: их клювы-копья разят, и они уходят прежде ответа.'], 1.5, 'unit.barracuda'),
  cask_mimic: B('mimic_barge', 3, 'beast', [9, 9, 2, 5, 16, 3, 6, 0], ['shell', 'no_retaliation'], 110,
    ['Cask Mimics', 'Бочки-мимики', 'Barrels in the hold that are not barrels: oak staves the shot barely scratches, and a lid that bites before anyone can answer.', 'Бочки в трюме, что вовсе не бочки: дубовые клёпки, которые пули едва царапают, и крышка, что кусает прежде ответа.'], 1.0, 'unit.bell_hermit'),
  ice_bear: B('icebound_hulk', 4, 'beast', [11, 9, 3, 6, 22, 5, 7, 0], ['steady', 'terror'], 160,
    ['Ice Bears', 'Ледяные медведи', 'Great white bears of the ice that sail with the hulk: the living beside them may freeze in terror, and nothing frightens them.', 'Огромные белые медведи льдов, что ходят с халком: живые рядом с ними могут оцепенеть от ужаса, а их самих ничто не пугает.'], 1.35, 'unit.wild_boar'),
};

export const SHIP_BEAST_IDS = Object.keys(SHIP_BEAST_DEFS) as ShipBeastId[];

export const isShipBeast = (u: string): u is ShipBeastId => Object.hasOwn(SHIP_BEAST_DEFS, u);

/** The hull a kind comes aboard with (undefined: not a ship's own kind). */
export const shipBeastHull = (u: string): ShipClassId | undefined => (isShipBeast(u) ? SHIP_BEAST_DEFS[u].hull : undefined);

/** How many of her own kind a premium hull comes with, and musters back to. */
export function ownCount(u: ShipBeastId): number {
  const d = SHIP_BEAST_DEFS[u];
  return SHIP_CLASSES[d.hull].premium?.beasts?.find((b) => b.u === u)?.n ?? 0;
}

/** Their names on the army's screen, as the world's armies' are (FACTION_NAMES): English, Russian, and what each is. */
export const SHIP_BEAST_NAMES = Object.fromEntries(SHIP_BEAST_IDS.map((u) => [u, SHIP_BEAST_DEFS[u].names])) as Record<ShipBeastId, [string, string, string, string]>;

/** The English and Russian words the server's sentences name them by. */
export const SHIP_BEAST_PLURAL = Object.fromEntries(SHIP_BEAST_IDS.map((u) => [u, [SHIP_BEAST_DEFS[u].names[0].toLowerCase(), SHIP_BEAST_DEFS[u].names[1].toLowerCase()]])) as Record<ShipBeastId, Tr>;

/** As units: a premium kind (`premium`: had only with its hull, at her price and in her number), its own figure. */
export const SHIP_BEASTS = Object.fromEntries(SHIP_BEAST_IDS.map((u): [ShipBeastId, UnitDef] => {
  const d = SHIP_BEAST_DEFS[u];
  const hull = SHIP_CLASSES[d.hull];
  return [u, {
    id: u, tier: d.tier, up: false, base: u, upgrade: null, atk: d.atk, def: d.def, dmin: d.dmin, dmax: d.dmax, hp: d.hp, speed: d.speed, init: d.init, shots: d.shots,
    specials: d.specials, art: `unit.${u}`, cost: d.cost,
    premium: { price: hull.premium?.price ?? 0, n: ownCount(u), note: ['Comes only aboard her own hull, and comes back to her.', 'Приходит только вместе со своим кораблём и к нему же возвращается.'] },
  }];
})) as Record<ShipBeastId, UnitDef>;
