// The shop's creatures (owner, 2026-10-03: «нужно еще премиум существ за премиум валюту много»; docs/01 P7, docs/18
// VII): twenty kinds sold for doubloons and found nowhere at sea — no tamer, lair, drift, roaming stack, capture nor egg
// ever hands one out (premium.ts, tests/premium and tests/beasts100 keep it so). Their figures are painted by
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
// higher the tier (about 9, 15, 23 and 40 doubloons a deckhand's worth): a single great beast costs more than a pair
// of small ones of the same might, as the hammocks it saves are worth.

import type { PremiumUnit, UnitDef } from './army.ts';
import type { Tr } from './estate.ts';

export type PremiumBeastId =
  | 'golden_crab' | 'giant_manta' | 'ember_salamander' | 'sea_wolf'
  | 'hippocampus' | 'coral_basilisk'
  | 'kraken_spawn' | 'storm_eagle' | 'abyssal_angler' | 'frost_serpent' | 'nautilus_knight' | 'siren_queen' | 'tidal_elemental' | 'obsidian_golem' | 'lava_drake' | 'sea_griffin'
  | 'sea_dragon' | 'dragon_turtle' | 'thunderbird' | 'abyss_knight';

export const PREMIUM_BEAST_IDS: PremiumBeastId[] = [
  'golden_crab', 'giant_manta', 'ember_salamander', 'sea_wolf',
  'hippocampus', 'coral_basilisk',
  'kraken_spawn', 'storm_eagle', 'abyssal_angler', 'frost_serpent', 'nautilus_knight', 'siren_queen', 'tidal_elemental', 'obsidian_golem', 'lava_drake', 'sea_griffin',
  'sea_dragon', 'dragon_turtle', 'thunderbird', 'abyss_knight',
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
};

/** Their people (docs/18 #38): the sea's, but for the beach's crab, the volcanoes' salamander, golem and drake. None is
 *  the deep's own — the shop sells to every captain. */
export const PREMIUM_PEOPLE: Record<PremiumBeastId, 'sea' | 'land'> = {
  golden_crab: 'land', giant_manta: 'sea', ember_salamander: 'land', sea_wolf: 'sea', hippocampus: 'sea', coral_basilisk: 'sea',
  kraken_spawn: 'sea', storm_eagle: 'sea', abyssal_angler: 'sea', frost_serpent: 'sea', nautilus_knight: 'sea', siren_queen: 'sea',
  tidal_elemental: 'sea', obsidian_golem: 'land', lava_drake: 'land', sea_griffin: 'sea',
  sea_dragon: 'sea', dragon_turtle: 'sea', thunderbird: 'sea', abyss_knight: 'sea',
};

export const isPremiumBeast = (u: string): u is PremiumBeastId => Object.hasOwn(PREMIUM_BEASTS, u);

/** The shop sells a tier's creatures from the ship level a captain signs that tier on (the dwellings' rule, monotone):
 *  the fourth from ⚓3, the fifth from ⚓4, the sixth from ⚓5, the seventh from ⚓6. */
export const PREMIUM_FROM = [1, 1, 1, 1, 3, 4, 5, 6];
export const premiumFrom = (tier: number): number => PREMIUM_FROM[Math.max(0, Math.min(PREMIUM_FROM.length - 1, Math.round(tier)))];

/** Their plural in English as the server's sentences count them (lower case), with the Russian twin. */
export const PREMIUM_PLURAL: Record<PremiumBeastId, Tr> = Object.fromEntries(PREMIUM_BEAST_IDS.map((id) => [id, [PREMIUM_NAMES[id][0].toLowerCase(), PREMIUM_NAMES[id][1].toLowerCase()]])) as Record<PremiumBeastId, Tr>;
