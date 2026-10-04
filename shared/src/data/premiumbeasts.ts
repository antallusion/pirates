// The shop's creatures (owner, 2026-10-03: «нужно еще премиум существ за премиум валюту много»; docs/01 P7, docs/18
// VII; a second dozen 2026-10-04, «еще больше … существ», painted four to a sheet by tools/art/fleet_next.py, and a
// third dozen the same day, tools/art/fleet_b3.py): forty-four kinds sold for doubloons and found nowhere at sea — no
// tamer, lair, drift, roaming stack, capture nor egg ever hands one out (premium.ts, tests/premium and tests/beasts100
// keep it so). Their figures are painted by
// tools/art/creatures.py (faction 'premium'); till a sheet is cut a painted kind of the same body stands in for it
// (unitart.ts).
//
// They are creatures as the land's and the sea's are (`beast`: they eat, they rank up with their wins, they split a
// mixed army's morale by their people), with two differences: they never slip away — bought, not tamed — and the tamer
// will not buy one back (doubloons never turn into silver). The bestiary's album is not theirs: it lists what the sea
// offers to every captain.
//
// Their strength (tests/beasts100): each head is worth a tenth to a half again as much as the best of the sea's own of
// its tier in a boarding (armyWeight), and stays below the best of the next tier — the seventh's below the legends. Worth the money, not an
// auto-win: a tier is sold from a ship level (PREMIUM_FROM, the dwellings' rule), and one purchase — a single great
// beast of the seventh tier, a pair of the others — is a sixth to a quarter of the army a ship of that level carries,
// and less as she grows (a captain who wants more buys again: a kind aboard joins its stack). Each has one craft the
// sea's kinds of its tier lack or seldom have. The price follows the might of the purchase, dearer a point of it the
// higher the tier (about 7, 9, 15, 23 and 40 doubloons a deckhand's worth): a single great beast costs more than a pair
// of small ones of the same might, as the hammocks it saves are worth. The third dozen opened the third tier (sold
// from ⚓2: a pair of them is over three tenths of a ⚓1 sloop's army).

import type { PremiumUnit, UnitDef } from './army.ts';
import type { Tr } from './estate.ts';

export type PremiumBeastId =
  | 'golden_crab' | 'giant_manta' | 'ember_salamander' | 'sea_wolf'
  | 'hippocampus' | 'coral_basilisk'
  | 'kraken_spawn' | 'storm_eagle' | 'abyssal_angler' | 'frost_serpent' | 'nautilus_knight' | 'siren_queen' | 'tidal_elemental' | 'obsidian_golem' | 'lava_drake' | 'sea_griffin'
  | 'sea_dragon' | 'dragon_turtle' | 'thunderbird' | 'abyss_knight'
  // The second dozen (owner, 2026-10-04: «еще больше … существ»): the thin tiers filled — three of the fourth, four of
  // the fifth, two of the sixth, three of the seventh.
  | 'lantern_jelly' | 'mantis_shrimp' | 'hammerhead'
  | 'walrus_bull' | 'merrow_warden' | 'sea_naga' | 'brass_automaton'
  | 'storm_giant' | 'ember_phoenix'
  | 'megalodon' | 'marid' | 'ice_wyvern'
  // The third dozen (owner, 2026-10-04: «еще больше … существ»): the third tier opened with three, two of the fourth,
  // three of the fifth, one of the sixth, three of the seventh — each body and craft no other kind of the shop has.
  | 'war_parrot' | 'electric_eel' | 'sea_otter'
  | 'flying_squid' | 'selkie'
  | 'kelp_golem' | 'giant_lobster' | 'manticore'
  | 'sea_cyclops'
  | 'sea_hydra' | 'coral_colossus' | 'cloud_whale';

export const PREMIUM_BEAST_IDS: PremiumBeastId[] = [
  'golden_crab', 'giant_manta', 'ember_salamander', 'sea_wolf',
  'hippocampus', 'coral_basilisk',
  'kraken_spawn', 'storm_eagle', 'abyssal_angler', 'frost_serpent', 'nautilus_knight', 'siren_queen', 'tidal_elemental', 'obsidian_golem', 'lava_drake', 'sea_griffin',
  'sea_dragon', 'dragon_turtle', 'thunderbird', 'abyss_knight',
  'lantern_jelly', 'mantis_shrimp', 'hammerhead',
  'walrus_bull', 'merrow_warden', 'sea_naga', 'brass_automaton',
  'storm_giant', 'ember_phoenix',
  'megalodon', 'marid', 'ice_wyvern',
  'war_parrot', 'electric_eel', 'sea_otter',
  'flying_squid', 'selkie',
  'kelp_golem', 'giant_lobster', 'manticore',
  'sea_cyclops',
  'sea_hydra', 'coral_colossus', 'cloud_whale',
];

type Stats = Omit<UnitDef, 'id' | 'tier' | 'up' | 'base' | 'upgrade' | 'beast' | 'art' | 'premium'>;
const P = (id: PremiumBeastId, tier: number, s: Stats, premium: PremiumUnit): UnitDef => ({ id, tier, up: false, base: id, upgrade: null, beast: true, art: `unit.${id}`, ...s, premium });

/** One of each kind, and what one purchase of it brings. */
export const PREMIUM_BEASTS: Record<PremiumBeastId, UnitDef> = {
  // Tier 4, from ⚓3: a pair to a purchase.
  golden_crab: P('golden_crab', 4, { atk: 9, def: 14, dmin: 3, dmax: 6, hp: 26, speed: 3, init: 5, shots: 0, specials: ['shell', 'fortune'], cost: 200 },
    { price: 100, n: 2, note: ['Shells of old gold: shot barely scratches them, and luck sails with the side that keeps them.', 'Панцири старого золота: пули их едва царапают, а стороне, что их держит, везёт.'] }),
  giant_manta: P('giant_manta', 4, { atk: 11, def: 8, dmin: 3, dmax: 7, hp: 24, speed: 9, init: 10, shots: 0, specials: ['flying', 'no_retaliation'], cost: 190 },
    { price: 100, n: 2, note: ['They glide over the whole field and strike from above: no one answers them.', 'Скользят над всем полем и бьют сверху: им никто не отвечает.'] }),
  ember_salamander: P('ember_salamander', 4, { atk: 12, def: 8, dmin: 4, dmax: 7, hp: 22, speed: 5, init: 8, shots: 0, specials: ['poison', 'regen'], cost: 195 },
    { price: 100, n: 2, note: ['Embers that go on burning in the stack they spit at; their own cracks close over.', 'Угли, что продолжают тлеть в отряде, по которому они плюнули; их собственные трещины затягиваются.'] }),
  sea_wolf: P('sea_wolf', 4, { atk: 12, def: 7, dmin: 3, dmax: 6, hp: 22, speed: 7, init: 10, shots: 0, specials: ['diving', 'double_strike'], cost: 185 },
    { price: 100, n: 2, note: ['A pack out of the surf: two bites for every one of yours.', 'Стая из прибоя: два укуса на каждый ваш удар.'] }),
  // Tier 5, from ⚓4: a pair.
  hippocampus: P('hippocampus', 5, { atk: 14, def: 10, dmin: 5, dmax: 8, hp: 34, speed: 9, init: 11, shots: 0, specials: ['diving', 'no_retaliation'], cost: 380 },
    { price: 230, n: 2, note: ['Sea horses swifter than anything ashore: they strike from the surf and are gone before the answer.', 'Морские кони быстрее всего на суше: бьют из прибоя и уходят прежде ответа.'] }),
  coral_basilisk: P('coral_basilisk', 5, { atk: 13, def: 13, dmin: 5, dmax: 8, hp: 36, speed: 4, init: 7, shots: 0, specials: ['bind'], cost: 390 },
    { price: 240, n: 2, note: ['Its pale stone stare: one bite in four turns a stack to stone for its next turn.', 'Бледный каменный взгляд: раз в четыре укуса отряд каменеет и теряет следующий ход.'] }),
  // Tier 6, from ⚓5: a pair.
  kraken_spawn: P('kraken_spawn', 6, { atk: 17, def: 14, dmin: 7, dmax: 12, hp: 40, speed: 5, init: 8, shots: 0, specials: ['diving', 'sweep'], cost: 560 },
    { price: 540, n: 2, note: ['Eight arms out of the water: it strikes every foe about it, and none answers.', 'Восемь щупалец из воды: бьёт всех врагов вокруг, и никто не отвечает.'] }),
  storm_eagle: P('storm_eagle', 6, { atk: 18, def: 12, dmin: 7, dmax: 11, hp: 38, speed: 10, init: 12, shots: 0, specials: ['flying', 'double_strike'], cost: 540 },
    { price: 560, n: 2, note: ['Talons, then the lightning on its wings: two blows for every one of yours, from anywhere on the field.', 'Когти, а следом молния с крыльев: два удара на каждый ваш, с любого места поля.'] }),
  abyssal_angler: P('abyssal_angler', 6, { atk: 17, def: 13, dmin: 8, dmax: 12, hp: 38, speed: 4, init: 7, shots: 0, specials: ['diving', 'drain'], cost: 560 },
    { price: 520, n: 2, note: ['The lure draws them, the jaws feed it: half the harm it does the living comes back to it.', 'Приманка манит, пасть кормит: половина урона, нанесённого живым, возвращается к нему.'] }),
  frost_serpent: P('frost_serpent', 6, { atk: 17, def: 14, dmin: 7, dmax: 12, hp: 42, speed: 6, init: 9, shots: 0, specials: ['diving', 'chill'], cost: 560 },
    { price: 530, n: 2, note: ['Freezing breath: the stack it strikes walks shorter and acts later to the end of the next round.', 'Ледяное дыхание: до конца следующего раунда отряд-цель ходит короче и позже.'] }),
  nautilus_knight: P('nautilus_knight', 6, { atk: 16, def: 20, dmin: 7, dmax: 10, hp: 44, speed: 5, init: 8, shots: 0, specials: ['shell', 'leader'], cost: 560 },
    { price: 550, n: 2, note: ['Armour of great spiral shells that shot barely scratches; the whole side fights with morale +1 beside them.', 'Доспех из больших спиральных раковин, который пули едва царапают; вся сторона бьётся рядом с ними с духом +1.'] }),
  siren_queen: P('siren_queen', 6, { atk: 16, def: 12, dmin: 7, dmax: 11, hp: 40, speed: 9, init: 11, shots: 0, specials: ['flying', 'bind'], cost: 540 },
    { price: 520, n: 2, note: ['Her song over the waves: one stroke in four holds a stack spellbound through its next turn.', 'Её песня над волнами: раз в четыре удара отряд замирает и теряет следующий ход.'] }),
  tidal_elemental: P('tidal_elemental', 6, { atk: 15, def: 16, dmin: 7, dmax: 11, hp: 44, speed: 5, init: 7, shots: 0, specials: ['mend', 'steady'], cost: 560 },
    { price: 540, n: 2, note: ['The sea made to walk: every stack of yours near it takes back its strength as each of its turns comes.', 'Море, ставшее на ноги: каждый ваш отряд рядом с ним в начале его хода возвращает себе силы.'] }),
  obsidian_golem: P('obsidian_golem', 6, { atk: 17, def: 22, dmin: 7, dmax: 11, hp: 40, speed: 3, init: 5, shots: 0, specials: ['shell', 'steady'], cost: 560 },
    { price: 540, n: 2, note: ['Black volcanic glass: shot barely scratches it, and nothing frightens it.', 'Чёрное вулканическое стекло: пули его едва царапают, и ничто его не пугает.'] }),
  lava_drake: P('lava_drake', 6, { atk: 18, def: 13, dmin: 7, dmax: 12, hp: 38, speed: 9, init: 11, shots: 0, specials: ['flying', 'breath'], cost: 560 },
    { price: 530, n: 2, note: ['A gout of fire from above: it scalds the stack it strikes and the one behind it.', 'Струя огня сверху: обжигает отряд-цель и того, кто стоит за ним.'] }),
  sea_griffin: P('sea_griffin', 6, { atk: 17, def: 14, dmin: 7, dmax: 11, hp: 40, speed: 10, init: 11, shots: 0, specials: ['flying', 'retaliate_all'], cost: 560 },
    { price: 520, n: 2, note: ['Eagle and sea lion in one: it answers every blow of the round.', 'Орёл и морской лев в одном: отвечает на каждый удар раунда.'] }),
  // Tier 7, from ⚓6: one great beast to a purchase.
  sea_dragon: P('sea_dragon', 7, { atk: 24, def: 20, dmin: 14, dmax: 22, hp: 72, speed: 10, init: 12, shots: 0, specials: ['flying', 'breath'], cost: 1300 },
    { price: 980, n: 1, note: ['The sea’s own dragon: over everything on the field, and its scalding jet strikes the stack behind the one it hits.', 'Дракон самого моря: летит над всем полем, а его обжигающая струя бьёт и отряд позади цели.'] }),
  dragon_turtle: P('dragon_turtle', 7, { atk: 20, def: 28, dmin: 12, dmax: 18, hp: 80, speed: 3, init: 5, shots: 0, specials: ['shell', 'sweep'], cost: 1250 },
    { price: 940, n: 1, note: ['A reef that walks: shot barely scratches its shell, and its steam scalds every foe about it unanswered.', 'Ходячий риф: пули едва царапают его панцирь, а пар обжигает всех врагов вокруг без ответа.'] }),
  thunderbird: P('thunderbird', 7, { atk: 22, def: 16, dmin: 12, dmax: 20, hp: 64, speed: 10, init: 13, shots: 4, specials: ['flying', 'shooter', 'chain'], cost: 1200 },
    { price: 950, n: 1, note: ['It hurls the storm from afar: each bolt leaps on to a second foe beside the one it strikes.', 'Мечет бурю издалека: каждая молния перескакивает на второго врага рядом с целью.'] }),
  abyss_knight: P('abyss_knight', 7, { atk: 25, def: 22, dmin: 14, dmax: 20, hp: 70, speed: 6, init: 10, shots: 0, specials: ['drain', 'steady'], cost: 1250 },
    { price: 960, n: 1, note: ['He walked up out of the abyss: half the harm he does the living comes back to him, and he knows no fear.', 'Он вышел из бездны: половина урона, нанесённого живым, возвращается к нему, и страха он не знает.'] }),

  // The second dozen (owner, 2026-10-04: «еще больше … существ»), on the same rules: a head a tenth to a half over the
  // sea's best of its tier and under the next tier's, a craft of its own, priced by the might of a purchase.
  // Tier 4, from ⚓3: a pair.
  lantern_jelly: P('lantern_jelly', 4, { atk: 11, def: 8, dmin: 3, dmax: 7, hp: 24, speed: 6, init: 9, shots: 0, specials: ['diving', 'bind'], cost: 190 },
    { price: 100, n: 2, note: ['Pale jellyfish out of the surf: one sting in four holds a stack spellbound through its next turn.', 'Бледные медузы из прибоя: раз в четыре ожога отряд замирает и теряет следующий ход.'] }),
  mantis_shrimp: P('mantis_shrimp', 4, { atk: 12, def: 11, dmin: 3, dmax: 5, hp: 20, speed: 5, init: 10, shots: 0, specials: ['shell', 'double_strike'], cost: 195 },
    { price: 100, n: 2, note: ['Club-fisted shrimps in armour: shot barely scratches them, and they punch twice for every blow of yours.', 'Раки-богомолы с булавами вместо лап: пули их едва царапают, и бьют они дважды на каждый ваш удар.'] }),
  hammerhead: P('hammerhead', 4, { atk: 12, def: 7, dmin: 4, dmax: 7, hp: 22, speed: 7, init: 9, shots: 0, specials: ['diving', 'terror'], cost: 190 },
    { price: 100, n: 2, note: ['Hammer-headed sharks out of the surf: the living beside them may freeze in terror.', 'Акулы-молоты из прибоя: живые рядом с ними могут оцепенеть от ужаса.'] }),
  // Tier 5, from ⚓4: a pair.
  walrus_bull: P('walrus_bull', 5, { atk: 12, def: 14, dmin: 4, dmax: 8, hp: 40, speed: 3, init: 5, shots: 0, specials: ['shell', 'retaliate_all'], cost: 390 },
    { price: 250, n: 2, note: ['Bulls of the ice floes: shot barely scratches their hide, and their tusks answer every blow of the round.', 'Вожаки ледяных полей: пули едва царапают их шкуру, а бивни отвечают на каждый удар раунда.'] }),
  merrow_warden: P('merrow_warden', 5, { atk: 13, def: 13, dmin: 5, dmax: 7, hp: 34, speed: 5, init: 9, shots: 0, specials: ['diving', 'leader'], cost: 380 },
    { price: 230, n: 2, note: ['Sea-folk wardens in shell armour: out of the surf anywhere, and the whole side fights with morale +1 beside them.', 'Стражи морского народа в доспехах из раковин: выходят из прибоя где угодно, и вся сторона бьётся рядом с ними с духом +1.'] }),
  sea_naga: P('sea_naga', 5, { atk: 14, def: 10, dmin: 5, dmax: 8, hp: 32, speed: 6, init: 10, shots: 0, specials: ['diving', 'poison'], cost: 380 },
    { price: 230, n: 2, note: ['Serpent-tailed swordswomen: their bronze blades poison, and the stack they cut loses men again on its next two turns.', 'Мечницы со змеиным хвостом: их бронзовые клинки отравлены, и задетый отряд снова теряет бойцов в два следующих хода.'] }),
  brass_automaton: P('brass_automaton', 5, { atk: 12, def: 16, dmin: 5, dmax: 7, hp: 38, speed: 3, init: 5, shots: 0, specials: ['steady', 'shield_wall'], cost: 390 },
    { price: 250, n: 2, note: ['Marines of riveted brass with a furnace in the chest: shot does them half the harm, and nothing frightens them.', 'Морпехи из клёпаной латуни с топкой в груди: пули вредят им вдвое меньше, и ничто их не пугает.'] }),
  // Tier 6, from ⚓5: a pair.
  storm_giant: P('storm_giant', 6, { atk: 17, def: 15, dmin: 8, dmax: 12, hp: 46, speed: 5, init: 8, shots: 0, specials: ['chain', 'steady'], cost: 560 },
    { price: 580, n: 2, note: ['Giants of the gale: every blow of the anchor-hook leaps on to a second foe as lightning, and nothing frightens them.', 'Великаны бури: каждый удар якорного крюка молнией перескакивает на второго врага, и ничто их не пугает.'] }),
  ember_phoenix: P('ember_phoenix', 6, { atk: 17, def: 12, dmin: 8, dmax: 12, hp: 40, speed: 9, init: 12, shots: 0, specials: ['flying', 'regen'], cost: 540 },
    { price: 530, n: 2, note: ['Birds of smouldering embers over the field: what is burnt out of them kindles again as each of their turns comes.', 'Птицы тлеющих углей над полем: выгоревшее в них разгорается вновь в начале каждого их хода.'] }),
  // Tier 7, from ⚓6: one great beast.
  megalodon: P('megalodon', 7, { atk: 24, def: 18, dmin: 14, dmax: 22, hp: 76, speed: 7, init: 11, shots: 0, specials: ['diving', 'terror', 'retaliate_all'], cost: 1300 },
    { price: 990, n: 1, note: ['The ancient shark of the open sea: the living beside it freeze in terror, and its jaws answer every blow of the round.', 'Древняя акула открытого моря: живые рядом с ней цепенеют от ужаса, а её пасть отвечает на каждый удар раунда.'] }),
  marid: P('marid', 7, { atk: 22, def: 20, dmin: 12, dmax: 18, hp: 70, speed: 8, init: 12, shots: 0, specials: ['diving', 'mend', 'steady'], cost: 1250 },
    { price: 920, n: 1, note: ['The djinn of the sea out of the surf: every stack of yours near it takes back its strength as its turn comes, and it knows no fear.', 'Джинн моря из прибоя: каждый ваш отряд рядом с ним в начале его хода возвращает себе силы, и страха он не знает.'] }),
  ice_wyvern: P('ice_wyvern', 7, { atk: 23, def: 19, dmin: 13, dmax: 20, hp: 68, speed: 10, init: 12, shots: 0, specials: ['flying', 'chill'], cost: 1250 },
    { price: 930, n: 1, note: ['A wyvern of the frozen north: its freezing breath slows the stack it strikes to the end of the next round.', 'Виверна ледяного севера: её морозное дыхание замедляет отряд-цель до конца следующего раунда.'] }),

  // The third dozen (owner, 2026-10-04: «еще больше … существ»), on the same rules, the third tier opened.
  // Tier 3, from ⚓2: a pair.
  war_parrot: P('war_parrot', 3, { atk: 9, def: 5, dmin: 3, dmax: 5, hp: 22, speed: 9, init: 11, shots: 0, specials: ['flying', 'fortune'], cost: 140 },
    { price: 60, n: 2, note: ['Great pirate macaws in red, gold and blue: they fly over the field, and luck sails with the side that keeps them.', 'Огромные пиратские ара в красном, золотом и синем: летят над полем, и стороне, что их держит, везёт.'] }),
  electric_eel: P('electric_eel', 3, { atk: 10, def: 6, dmin: 3, dmax: 5, hp: 20, speed: 5, init: 9, shots: 0, specials: ['diving', 'chain'], cost: 140 },
    { price: 60, n: 2, note: ['Great eels out of the surf: every shock leaps on to a second foe beside the struck one.', 'Огромные угри из прибоя: каждый разряд перескакивает на второго врага рядом с целью.'] }),
  sea_otter: P('sea_otter', 3, { atk: 9, def: 7, dmin: 2, dmax: 4, hp: 26, speed: 6, init: 10, shots: 0, specials: ['diving', 'no_retaliation'], cost: 135 },
    { price: 60, n: 2, note: ['Giant sea otters in a raiding band: out of the surf, a bite, and back under before the answer.', 'Гигантские калании шайкой налётчиков: из прибоя, укус — и снова под воду прежде ответа.'] }),
  // Tier 4, from ⚓3: a pair.
  flying_squid: P('flying_squid', 4, { atk: 11, def: 8, dmin: 3, dmax: 6, hp: 24, speed: 8, init: 10, shots: 0, specials: ['flying', 'poison'], cost: 200 },
    { price: 100, n: 2, note: ['Squids that glide over the sea on finned mantles: their ink burns, and the stack they lash loses men again on its next two turns.', 'Кальмары, что парят над морем на плавниках: их чернила жгут, и задетый отряд снова теряет бойцов в два следующих хода.'] }),
  selkie: P('selkie', 4, { atk: 11, def: 9, dmin: 3, dmax: 6, hp: 24, speed: 6, init: 9, shots: 0, specials: ['diving', 'mend'], cost: 200 },
    { price: 100, n: 2, note: ['Seal-folk in their sealskin cloaks: out of the surf anywhere, and every stack of yours near them takes back its strength as their turn comes.', 'Тюлений народ в плащах из тюленьей шкуры: выходят из прибоя где угодно, и каждый ваш отряд рядом с ними в начале их хода возвращает себе силы.'] }),
  // Tier 5, from ⚓4: a pair.
  kelp_golem: P('kelp_golem', 5, { atk: 12, def: 15, dmin: 4, dmax: 7, hp: 40, speed: 3, init: 5, shots: 0, specials: ['regen', 'retaliate_all'], cost: 400 },
    { price: 250, n: 2, note: ['Giants of wet kelp round a heart of driftwood: what is torn from them grows back, and they answer every blow of the round.', 'Великаны из мокрой ламинарии вокруг сердцевины из плавника: вырванное отрастает, и они отвечают на каждый удар раунда.'] }),
  giant_lobster: P('giant_lobster', 5, { atk: 13, def: 15, dmin: 4, dmax: 7, hp: 36, speed: 4, init: 7, shots: 0, specials: ['bind', 'shell'], cost: 390 },
    { price: 240, n: 2, note: ['Lobsters as big as a longboat: shot barely scratches them, and one grip of the claws in four holds a stack through its next turn.', 'Омары величиной со шлюпку: пули их едва царапают, и раз в четыре хватки клешни отряд не может сделать следующий ход.'] }),
  manticore: P('manticore', 5, { atk: 14, def: 11, dmin: 5, dmax: 8, hp: 32, speed: 6, init: 10, shots: 0, specials: ['poison', 'terror'], cost: 385 },
    { price: 230, n: 2, note: ['Lions of the volcanic isles with a scorpion\'s tail: its sting poisons, and the living beside it may freeze in terror.', 'Львы вулканических островов со скорпионьим хвостом: жало отравлено, а живые рядом могут оцепенеть от ужаса.'] }),
  // Tier 6, from ⚓5: a pair.
  sea_cyclops: P('sea_cyclops', 6, { atk: 18, def: 14, dmin: 8, dmax: 12, hp: 46, speed: 5, init: 7, shots: 0, specials: ['sweep', 'terror'], cost: 580 },
    { price: 580, n: 2, note: ['One-eyed giants of the sea caves with a broken mast for a club: a swing strikes every foe about them unanswered, and the living may freeze at the sight.', 'Одноглазые великаны морских пещер с обломком мачты вместо дубины: взмах бьёт всех врагов вокруг без ответа, и живые могут оцепенеть от их вида.'] }),
  // Tier 7, from ⚓6: one great beast.
  sea_hydra: P('sea_hydra', 7, { atk: 23, def: 18, dmin: 12, dmax: 18, hp: 74, speed: 6, init: 10, shots: 0, specials: ['diving', 'regen', 'sweep'], cost: 1250 },
    { price: 920, n: 1, note: ['Five heads out of the surf: they strike every foe about it unanswered, and what is cut from it grows back.', 'Пять голов из прибоя: бьют всех врагов вокруг без ответа, а отсечённое отрастает.'] }),
  coral_colossus: P('coral_colossus', 7, { atk: 20, def: 26, dmin: 12, dmax: 16, hp: 82, speed: 3, init: 5, shots: 0, specials: ['mend', 'shell', 'steady'], cost: 1300 },
    { price: 950, n: 1, note: ['A reef that stood up and walked: shot barely scratches it, nothing frightens it, and every stack of yours near it takes back its strength as its turn comes.', 'Риф, что встал и пошёл: пули его едва царапают, ничто его не пугает, а каждый ваш отряд рядом с ним в начале его хода возвращает себе силы.'] }),
  cloud_whale: P('cloud_whale', 7, { atk: 21, def: 20, dmin: 13, dmax: 19, hp: 80, speed: 8, init: 9, shots: 0, specials: ['flying', 'sweep', 'steady'], cost: 1300 },
    { price: 940, n: 1, note: ['A pale whale that swims through the storm clouds: it sweeps down on every foe about it unanswered, and nothing frightens it.', 'Бледный кит, что плывёт сквозь грозовые тучи: обрушивается на всех врагов вокруг без ответа, и ничто его не пугает.'] }),
};

/** Their names as a stack and a line on each — English, Russian (as the world's armies are named, FACTION_NAMES). */
export const PREMIUM_NAMES: Record<PremiumBeastId, [string, string, string, string]> = {
  golden_crab: ['Golden crabs', 'Золотые крабы', 'Crabs whose shells shine like old gold under their patina: shot barely scratches them, and their side fights with luck +1.', 'Крабы, чьи панцири горят старым золотом под патиной: пули их едва царапают, а их сторона бьётся с удачей +1.'],
  giant_manta: ['Giant mantas', 'Гигантские скаты', 'Mantas gliding over the sea as if it were sky: they fly over the field, and no one answers their blows.', 'Скаты, что скользят над морем, как по небу: перелетают поле, и на их удары не отвечают.'],
  ember_salamander: ['Ember salamanders', 'Огненные саламандры', 'Black salamanders cracked with glowing embers: their spit burns on in a stack, and their own cracks close over.', 'Чёрные саламандры в трещинах тлеющих углей: их плевок тлеет в отряде, а свои трещины затягиваются.'],
  sea_wolf: ['Sea wolves', 'Морские волки', 'Grey wolves with finned backs and webbed paws: they hunt in the surf and bite twice.', 'Серые волки с плавником на спине и перепончатыми лапами: охотятся в прибое и кусают дважды.'],
  hippocampus: ['Hippocampi', 'Гиппокампы', 'Horses before, fish behind: the swiftest things on the field, out of the surf and away before the answer.', 'Спереди кони, сзади рыбы: быстрее всех на поле, из прибоя — и прочь прежде ответа.'],
  coral_basilisk: ['Coral basilisks', 'Коралловые василиски', 'Six-legged lizards grown over with coral: their pale stare turns a stack to stone for a turn, one bite in four.', 'Шестиногие ящеры, обросшие кораллом: их бледный взгляд обращает отряд в камень на ход — раз в четыре укуса.'],
  kraken_spawn: ['Kraken spawn', 'Отпрыски кракена', 'A young kraken risen from the water: its arms strike every foe about it, and none answers.', 'Молодой кракен из воды: его щупальца бьют всех врагов вокруг, и никто не отвечает.'],
  storm_eagle: ['Storm eagles', 'Грозовые орлы', 'Eagles with sparks running on their wings: over the field, two blows for every one of yours.', 'Орлы с искрами на крыльях: над полем, два удара на каждый ваш.'],
  abyssal_angler: ['Abyssal anglers', 'Глубинные удильщики', 'A pale blue lure over a mouth of needles: half the harm it does the living feeds it.', 'Бледно-голубая приманка над пастью игл: половина урона, нанесённого живым, идёт ему впрок.'],
  frost_serpent: ['Frost serpents', 'Ледяные змеи', 'Ice-blue serpents of the cold seas: their breath slows the stack they strike to the end of the next round.', 'Ледяные змеи холодных морей: их дыхание замедляет отряд-цель до конца следующего раунда.'],
  nautilus_knight: ['Nautilus knights', 'Рыцари-наутилусы', 'Knights of the deep courts in armour of spiral shells: shot barely scratches them, and their side fights with morale +1.', 'Рыцари глубинных дворов в доспехах из спиральных раковин: пули их едва царапают, а их сторона бьётся с духом +1.'],
  siren_queen: ['Siren queens', 'Королевы сирен', 'Winged queens of the sirens: one stroke of their song in four holds a stack spellbound through its next turn.', 'Крылатые королевы сирен: раз в четыре удара их песня завораживает отряд на следующий ход.'],
  tidal_elemental: ['Tidal elementals', 'Приливные элементали', 'The sea risen into a shape: the stacks of their side near them take back their strength as their turn comes.', 'Море, принявшее облик: свои отряды рядом с ними в начале их хода возвращают себе силы.'],
  obsidian_golem: ['Obsidian golems', 'Обсидиановые големы', 'Volcanic glass and basalt with a red light in the cracks: shot barely scratches them, and nothing frightens them.', 'Вулканическое стекло и базальт с красным светом в трещинах: пули их едва царапают, и ничто их не пугает.'],
  lava_drake: ['Lava drakes', 'Лавовые драконы', 'Drakes with ember wings: their fire scalds the stack they strike and the one behind it.', 'Драконы с тлеющими крыльями: их огонь обжигает отряд-цель и того, кто за ним.'],
  sea_griffin: ['Sea griffins', 'Морские грифоны', 'Eagle-headed sea lions on grey wings: they answer every blow of the round.', 'Морские львы с орлиной головой на серых крыльях: отвечают на каждый удар раунда.'],
  sea_dragon: ['Sea dragons', 'Морские драконы', 'The great dragon of the sea, over everything on the field: its scalding jet strikes the stack behind the one it hits too.', 'Великий дракон моря над всем полем: его обжигающая струя бьёт и отряд позади цели.'],
  dragon_turtle: ['Dragon turtles', 'Драконьи черепахи', 'A coral-crusted shell with a dragon’s head: shot barely scratches it, and its steam scalds every foe about it unanswered.', 'Панцирь в кораллах и голова дракона: пули его едва царапают, а пар обжигает всех врагов вокруг без ответа.'],
  thunderbird: ['Thunderbirds', 'Громовые птицы', 'The storm’s own bird: it hurls lightning from afar, and every bolt leaps on to a second foe.', 'Птица самой бури: мечет молнии издалека, и каждая перескакивает на второго врага.'],
  abyss_knight: ['Abyss knights', 'Рыцари бездны', 'A knight in barnacled plate with turquoise light in the visor: he drinks the strength of the living he strikes, and knows no fear.', 'Рыцарь в латах в ракушках с бирюзовым светом в забрале: пьёт силы живых, кого разит, и не знает страха.'],
  lantern_jelly: ['Lantern jellies', 'Фонарные медузы', 'Great pale jellyfish with a light inside them, out of the surf anywhere along the shore: one sting in four holds a stack spellbound through its next turn.', 'Огромные бледные медузы со светом внутри, что выходят из прибоя где угодно вдоль берега: раз в четыре ожога отряд замирает и теряет следующий ход.'],
  mantis_shrimp: ['Giant mantis shrimps', 'Гигантские раки-богомолы', 'Armoured shrimps as big as hounds with club-like forelimbs: shot barely scratches them, and they strike twice faster than the eye can follow.', 'Закованные раки величиной с собаку с булавами передних лап: пули их едва царапают, и бьют они дважды быстрее, чем видит глаз.'],
  hammerhead: ['Hammerhead sharks', 'Акулы-молоты', 'Hammer-headed sharks that come up out of the surf: the living beside them may freeze in terror.', 'Акулы с головой-молотом, что выходят из прибоя: живые рядом с ними могут оцепенеть от ужаса.'],
  walrus_bull: ['Walrus bulls', 'Моржи-вожаки', 'Scarred bulls of the ice floes with tusks like spears: shot barely scratches their hide, and they answer every blow of the round.', 'Израненные вожаки ледяных полей с бивнями, как копья: пули едва царапают их шкуру, и они отвечают на каждый удар раунда.'],
  merrow_warden: ['Merrow wardens', 'Стражи мерроу', 'Sea-folk warriors in shell armour with coral tridents: out of the surf anywhere along the shore, and their side fights with morale +1.', 'Воины морского народа в доспехах из раковин с коралловыми трезубцами: выходят из прибоя где угодно вдоль берега, а их сторона бьётся с духом +1.'],
  sea_naga: ['Sea nagas', 'Морские наги', 'Serpent-tailed swordswomen of the deep: the stack their bronze blades cut loses men again on its next two turns.', 'Мечницы глубин со змеиным хвостом: отряд, задетый их бронзовыми клинками, снова теряет бойцов в два следующих хода.'],
  brass_automaton: ['Brass automatons', 'Латунные автоматы', 'Riveted marines of brass with a furnace glowing in the chest: shot does them half the harm, and nothing frightens them.', 'Клёпаные морпехи из латуни с топкой, что светится в груди: пули вредят им вдвое меньше, и ничто их не пугает.'],
  storm_giant: ['Storm giants', 'Штормовые великаны', 'Giants of the gale with an anchor-hook for a weapon: each blow leaps on to a second foe beside the struck one as lightning, and nothing frightens them.', 'Великаны бури с якорным крюком вместо оружия: каждый удар молнией перескакивает на второго врага рядом с целью, и ничто их не пугает.'],
  ember_phoenix: ['Ember phoenixes', 'Угольные фениксы', 'Birds of smouldering embers over the field: what is burnt out of them kindles again as each of their turns comes.', 'Птицы тлеющих углей над полем: выгоревшее в них разгорается вновь в начале каждого их хода.'],
  megalodon: ['Megalodons', 'Мегалодоны', 'The ancient shark of the open sea: out of the surf anywhere along the shore, the living beside it freeze in terror, and its jaws answer every blow of the round.', 'Древняя акула открытого моря: выходит из прибоя где угодно вдоль берега, живые рядом с ней цепенеют от ужаса, а её пасть отвечает на каждый удар раунда.'],
  marid: ['Marids', 'Мариды', 'The djinn of the sea risen out of the surf: every stack of its side near it takes back its strength as its turn comes, and nothing frightens it.', 'Джинн моря, поднявшийся из прибоя: каждый свой отряд рядом с ним в начале его хода возвращает себе силы, и ничто его не пугает.'],
  ice_wyvern: ['Ice wyverns', 'Ледяные виверны', 'A wyvern of the frozen north over the field: its freezing breath slows the stack it strikes to the end of the next round.', 'Виверна ледяного севера над полем: её морозное дыхание замедляет отряд-цель до конца следующего раунда.'],
  war_parrot: ['War parrots', 'Боевые попугаи', 'Great macaws of the pirate coasts in red, gold and blue: they fly over the field, and their side fights with luck +1.', 'Огромные ара пиратских берегов в красном, золотом и синем: летят над полем, и их сторона бьётся с удачей +1.'],
  electric_eel: ['Electric eels', 'Электрические угри', 'Thick dark eels out of the surf with a pale blue glow along their flanks: every shock leaps on to a second foe beside the struck one.', 'Толстые тёмные угри из прибоя с бледно-голубым свечением по бокам: каждый разряд перескакивает на второго врага рядом с целью.'],
  sea_otter: ['Giant sea otters', 'Гигантские калании', 'Sleek otters as big as a man in a raiding band: out of the surf anywhere along the shore, a bite, and gone before the answer.', 'Гладкие калании ростом с человека, шайкой налётчиков: выходят из прибоя где угодно вдоль берега, кусают — и исчезают прежде ответа.'],
  flying_squid: ['Flying squids', 'Летучие кальмары', 'Squids that glide over the sea on finned mantles: their burning ink poisons, and the stack they lash loses men again on its next two turns.', 'Кальмары, что парят над морем на плавниках: их жгучие чернила отравлены, и задетый отряд снова теряет бойцов в два следующих хода.'],
  selkie: ['Selkies', 'Селки', 'Seal-folk in sealskin cloaks with spears of pale driftwood: out of the surf anywhere, and the stacks of their side near them take back their strength as their turn comes.', 'Тюлений народ в плащах из тюленьей шкуры с копьями из белёсого плавника: выходят из прибоя где угодно, и свои отряды рядом с ними в начале их хода возвращают себе силы.'],
  kelp_golem: ['Kelp golems', 'Келповые големы', 'Giants of wet kelp and weed round a heart of driftwood: what is torn from them grows back, and they answer every blow of the round.', 'Великаны из мокрой ламинарии и водорослей вокруг сердцевины из плавника: вырванное отрастает, и они отвечают на каждый удар раунда.'],
  giant_lobster: ['Giant lobsters', 'Гигантские омары', 'Dark-blue lobsters as big as a longboat: shot barely scratches them, and one grip of the claws in four holds a stack through its next turn.', 'Тёмно-синие омары величиной со шлюпку: пули их едва царапают, и раз в четыре хватки клешни отряд не может сделать следующий ход.'],
  manticore: ['Manticores', 'Мантикоры', 'Red-maned lions of the volcanic isles with a scorpion\'s tail: the sting poisons, and the living beside them may freeze in terror.', 'Рыжегривые львы вулканических островов со скорпионьим хвостом: жало отравлено, а живые рядом могут оцепенеть от ужаса.'],
  sea_cyclops: ['Sea cyclopes', 'Морские циклопы', 'One-eyed giants of the sea caves with a broken mast for a club: a swing strikes every foe about them unanswered, and the living may freeze at the sight.', 'Одноглазые великаны морских пещер с обломком мачты вместо дубины: взмах бьёт всех врагов вокруг без ответа, и живые могут оцепенеть от их вида.'],
  sea_hydra: ['Sea hydras', 'Морские гидры', 'Five green-black heads out of the surf: they strike every foe about it unanswered, and what is cut from it grows back.', 'Пять зелёно-чёрных голов из прибоя: бьют всех врагов вокруг без ответа, а отсечённое отрастает.'],
  coral_colossus: ['Coral colossi', 'Коралловые колоссы', 'A reef that stood up and walked: shot barely scratches it, nothing frightens it, and the stacks of its side near it take back their strength as its turn comes.', 'Риф, что встал и пошёл: пули его едва царапают, ничто его не пугает, а свои отряды рядом с ним в начале его хода возвращают себе силы.'],
  cloud_whale: ['Cloud whales', 'Облачные киты', 'A pale whale that swims through the storm clouds over the field: it sweeps down on every foe about it unanswered, and nothing frightens it.', 'Бледный кит, что плывёт сквозь грозовые тучи над полем: обрушивается на всех врагов вокруг без ответа, и ничто его не пугает.'],
};

/** Their people (docs/18 #38): the sea's, but for the beach's crab, the volcanoes' salamander, golem, drake, phoenix and
 *  manticore, the jungle's parrot, and the brass automaton of the land's workshops. None is the deep's own — the shop
 *  sells to every captain. */
export const PREMIUM_PEOPLE: Record<PremiumBeastId, 'sea' | 'land'> = {
  golden_crab: 'land', giant_manta: 'sea', ember_salamander: 'land', sea_wolf: 'sea', hippocampus: 'sea', coral_basilisk: 'sea',
  kraken_spawn: 'sea', storm_eagle: 'sea', abyssal_angler: 'sea', frost_serpent: 'sea', nautilus_knight: 'sea', siren_queen: 'sea',
  tidal_elemental: 'sea', obsidian_golem: 'land', lava_drake: 'land', sea_griffin: 'sea',
  sea_dragon: 'sea', dragon_turtle: 'sea', thunderbird: 'sea', abyss_knight: 'sea',
  lantern_jelly: 'sea', mantis_shrimp: 'sea', hammerhead: 'sea', walrus_bull: 'sea', merrow_warden: 'sea', sea_naga: 'sea', brass_automaton: 'land',
  storm_giant: 'sea', ember_phoenix: 'land', megalodon: 'sea', marid: 'sea', ice_wyvern: 'sea',
  // The third dozen: the jungle's parrot and the volcanoes' manticore the land's, the rest the sea's.
  war_parrot: 'land', electric_eel: 'sea', sea_otter: 'sea', flying_squid: 'sea', selkie: 'sea', kelp_golem: 'sea', giant_lobster: 'sea', manticore: 'land',
  sea_cyclops: 'sea', sea_hydra: 'sea', coral_colossus: 'sea', cloud_whale: 'sea',
};

export const isPremiumBeast = (u: string): u is PremiumBeastId => Object.hasOwn(PREMIUM_BEASTS, u);

/** The shop sells a tier's creatures from the ship level a captain signs that tier on (the dwellings' rule, monotone):
 *  the fourth from ⚓3, the fifth from ⚓4, the sixth from ⚓5, the seventh from ⚓6 — and the third (2026-10-04) from
 *  ⚓2, not ⚓1: a pair of them would be over three tenths of a ⚓1 sloop's army (tests/beasts100 holds a purchase to a
 *  tenth–three tenths of the army it is first sold to). */
export const PREMIUM_FROM = [1, 1, 1, 2, 3, 4, 5, 6];
export const premiumFrom = (tier: number): number => PREMIUM_FROM[Math.max(0, Math.min(PREMIUM_FROM.length - 1, Math.round(tier)))];

/** Their plural in English as the server's sentences count them (lower case), with the Russian twin. */
export const PREMIUM_PLURAL: Record<PremiumBeastId, Tr> = Object.fromEntries(PREMIUM_BEAST_IDS.map((id) => [id, [PREMIUM_NAMES[id][0].toLowerCase(), PREMIUM_NAMES[id][1].toLowerCase()]])) as Record<PremiumBeastId, Tr>;
