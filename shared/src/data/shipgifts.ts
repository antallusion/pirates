// The premium hulls' gifts (owner, 2026-10-03: «по 10 кораблей из каждого списка должны быть премиум, с какими-то
// уникальными фишками, типа специальная способность»): each of the forty hulls sold for doubloons has one ability of
// her own. They are not forty pieces of code but seven kinds of mechanic, each one system's, every hull's gift that
// kind with its own numbers (server/src/game/shipgifts.ts carries them out; docs/02 §1.A.9 lists them):
//
//   rally  — sea combat: in a fight, when her hull falls below a share of its whole, she gains an effect for a while
//            (her guns, her armour, a cloud of mist, a hull mended at once), and not again before its cooldown;
//   strike — sea combat: a ball of her broadside that strikes home brings an effect on the ship it struck now and then
//            (fire, a hook, torn canvas, choking smoke), not oftener than its cooldown;
//   toll   — sea combat: in a fight, every so many seconds every enemy within her reach and engaged with her takes it
//            (lightning, a wyvern's shadow, her towers' guns, her bells);
//   deck   — the boarding battle on the hexes: her side fights some rounds (or the whole battle) with a gift, and the
//            other side with a curse;
//   sail   — sailing: while the sea is as she likes it (a storm, light airs, the night, fog, open water away from any
//            fight) she sails with a gift;
//   trade  — the market: the goods of her trade sell dearer from her hold, cost her less, or pay no duty;
//   muster — her company: her own kind grows back aboard her at sea, or hands sign on out of a fight.
//
// Beside it a gift may carry an `aura`: lines and switches always on her stats, as a hull's passive's are. Every hull's
// own creatures come back to her in port up to the number she came with, whatever her gift (that is the creatures',
// not a gift).

import type { GoodId } from './goods.ts';
import type { BtMods } from './paths.ts';
import type { FleetClassId, ShipClassId } from './ships.ts';
import type { Flag, StatMods } from './stats.ts';

type Tr = [string, string];

export type GiftKind = 'rally' | 'strike' | 'toll' | 'deck' | 'sail' | 'trade' | 'muster';
export const GIFT_KINDS: GiftKind[] = ['rally', 'strike', 'toll', 'deck', 'sail', 'trade', 'muster'];

/** When a `sail` gift holds: a storm, winds under half strength, the night, fog, or open water (no fight, no enemy
 *  within OPEN_WATER metres). */
export type SailWhen = 'storm' | 'calm' | 'night' | 'fog' | 'open';
export const OPEN_WATER = 1500;

interface GiftBase {
  /** Its name and what it does, as her card and her ship's screen say them: English, Russian. */
  name: Tr;
  text: Tr;
  /** Always on: lines and switches on her stats. */
  aura?: StatMods;
  flags?: Flag[];
}

export interface RallyGift extends GiftBase {
  kind: 'rally';
  /** Her hull below this share of its whole, in a fight. */
  below: number;
  /** Seconds the effect holds (0: only what comes at once), and seconds before it can come again. */
  secs: number;
  cd: number;
  self?: StatMods;
  selfFlags?: Flag[];
  /** Hull mended at once (a share of its whole); every leak closed with it. */
  mend?: number;
  /** What her crew cries when it comes (her toast): English, Russian. */
  cry: Tr;
  /** The sight of it at sea, round her (a client fx). */
  fx?: 'war_cry' | 'smoke' | 'ink';
}

export interface StrikeGift extends GiftBase {
  kind: 'strike';
  /** The chance a ball of hers that strikes home brings it, and the seconds before it can again. */
  chance: number;
  cd: number;
  /** Seconds the effect on her target holds. */
  secs: number;
  foe?: StatMods;
  /** Sets her target afire (for `secs`). */
  fire?: boolean;
  /** Her target's sails torn (a share of their whole) and morale lost. */
  sails?: number;
  morale?: number;
}

export interface TollGift extends GiftBase {
  kind: 'toll';
  /** Every `cd` seconds in a fight, every enemy engaged with her within `r` metres. */
  cd: number;
  r: number;
  secs: number;
  foe?: StatMods;
  /** Hull taken (a share of the target's whole, armour and all) and morale lost. */
  hull?: number;
  morale?: number;
  /** The sight of it at sea: a ring round her (`war_cry`, `song`) or a stroke on each ship it falls on (`lightning`, `mortar`). */
  fx: 'war_cry' | 'song' | 'lightning' | 'mortar';
}

export interface DeckGift extends GiftBase {
  kind: 'deck';
  /** The rounds it holds from the first (99: the whole battle). */
  rounds: number;
  /** On every stack of her side, and of the other's. */
  mine?: BtMods;
  theirs?: BtMods;
}

export interface SailGift extends GiftBase {
  kind: 'sail';
  when: SailWhen;
  self: StatMods;
  selfFlags?: Flag[];
}

export interface TradeGift extends GiftBase {
  kind: 'trade';
  goods: GoodId[] | 'all';
  /** × on what a port pays her for them, × on what she pays, and the share of the port's duty on them waived. */
  sell?: number;
  buy?: number;
  duty?: number;
}

export interface MusterGift extends GiftBase {
  kind: 'muster';
  /** One more every `every` seconds at sea out of a fight: of her own kind (up to the number she came with), or a
   *  deckhand of her roster (up to `upTo` of her hammocks). */
  every: number;
  who: 'own' | 'hands';
  upTo?: number;
  cry: Tr;
}

export type ShipGift = RallyGift | StrikeGift | TollGift | DeckGift | SailGift | TradeGift | MusterGift;

/** The forty, list by list (the order of shared/src/data/ships.ts). */
export const SHIP_GIFTS: Partial<Record<FleetClassId, ShipGift>> = {
  // ---- the warships
  black_corsair: {
    kind: 'rally', below: 0.5, secs: 12, cd: 90, self: { reloadMul: -0.25, gunDamageMul: 0.15 }, fx: 'war_cry',
    name: ['Black Flag', 'Чёрный флаг'],
    text: ['In a fight, below half her hull she hoists the black flag: for 12 s her guns reload 25% faster and hit 15% harder. Once in 90 s.', 'В бою, когда корпус ниже половины, она поднимает чёрный флаг: 12 с её орудия перезаряжаются на 25% быстрее и бьют на 15% сильнее. Раз в 90 с.'],
    cry: ['The black flag goes up: the guns run hot!', 'Поднят чёрный флаг: пушки раскаляются!'],
  },
  dragon_junk: {
    kind: 'strike', chance: 0.2, cd: 20, secs: 12, fire: true,
    name: ['Fire Lances', 'Огненные копья'],
    text: ['A ball of hers that strikes home sets the ship afire one time in five; once in 20 s.', 'Её ядро, попавшее в цель, в одном случае из пяти поджигает корабль; раз в 20 с.'],
  },
  iron_ram: {
    kind: 'deck', rounds: 2, mine: { melee: 0.25 }, theirs: { melee: -0.15 },
    name: ['Over the Iron Bow', 'Через железный нос'],
    text: ['In a boarding her men come over the ram: for the first 2 rounds their blows strike 25% harder and the other side\'s 15% softer.', 'При абордаже её люди идут через таран: первые 2 раунда их удары на 25% сильнее, а удары врага на 15% слабее.'],
  },
  thunderer: {
    kind: 'toll', cd: 25, r: 350, secs: 4, hull: 0.03, foe: { reloadMul: 0.15 }, fx: 'lightning',
    name: ['Lightning Rods', 'Громоотводы'],
    text: ['In a fight, every 25 s lightning leaps from her rods to every enemy engaged with her within 350 m: 3% of its hull, and its gun crews reel — reloads 15% slower for 4 s.', 'В бою каждые 25 с молния бьёт с её громоотводов в каждого врага, что бьётся с ней, в 350 м: 3% корпуса, и расчёты оглушены — перезарядка на 15% медленнее 4 с.'],
  },
  wyvern_galleass: {
    kind: 'toll', cd: 30, r: 400, secs: 6, morale: 6, foe: { turnRate: -0.25 }, fx: 'war_cry',
    name: ['Wyvern\'s Shadow', 'Тень виверны'],
    text: ['In a fight, every 30 s the wyvern\'s shadow passes over every enemy engaged with her within 400 m: −6 morale, and it turns 25% slower for 6 s.', 'В бою каждые 30 с тень виверны проходит над каждым врагом, что бьётся с ней, в 400 м: −6 к боевому духу, и 6 с он поворачивает на 25% медленнее.'],
  },
  kraken_hunter: {
    kind: 'strike', chance: 0.25, cd: 15, secs: 8, foe: { maxSpeed: -0.2, turnRate: -0.2 },
    name: ['Iron Harpoons', 'Железные гарпуны'],
    text: ['A ball of hers that strikes home hooks the ship one time in four: −20% speed and turning for 8 s; once in 15 s.', 'Её ядро, попавшее в цель, в одном случае из четырёх цепляет корабль: −20% к скорости и повороту на 8 с; раз в 15 с.'],
  },
  crimson_tide: {
    kind: 'deck', rounds: 99, mine: { morale: 1, melee: 0.1 }, theirs: { morale: -1 },
    name: ['Crimson Banner', 'Багровое знамя'],
    text: ['In a boarding her whole side fights with +1 morale and 10% harder blows, and the other side with −1 morale, the whole battle.', 'При абордаже вся её сторона бьётся с духом +1 и ударами на 10% сильнее, а сторона врага — с духом −1, весь бой.'],
  },
  phantom_brig: {
    kind: 'rally', below: 0.4, secs: 6, cd: 100, selfFlags: ['hidden', 'evasive'], fx: 'smoke',
    name: ['Mist Shroud', 'Туманный саван'],
    text: ['In a fight, below 40% hull she fades into mist: hidden, and half the shot at her flies wide, for 6 s. Once in 100 s.', 'В бою, когда корпус ниже 40%, она растворяется в тумане: скрыта, и половина ядер летит мимо, 6 с. Раз в 100 с.'],
    cry: ['The mist takes her.', 'Её укрывает туман.'],
  },
  storm_reaver: {
    kind: 'deck', rounds: 2, mine: { melee: 0.3, init: 3 },
    name: ['Berserk Boarding', 'Абордаж берсерков'],
    text: ['In a boarding her side\'s first 2 rounds are a fury: blows 30% harder and +3 initiative.', 'При абордаже первые 2 раунда её сторона в ярости: удары на 30% сильнее и +3 к инициативе.'],
  },
  sun_galleon: {
    kind: 'rally', below: 0.5, secs: 15, cd: 150, mend: 0.15, self: { armor: 0.1 },
    name: ['Noon Sun', 'Полуденное солнце'],
    text: ['In a fight, below half her hull the Crown\'s carpenters work as at noon: 15% of her hull mended at once, every leak closed, and her armour +10% for 15 s. Once in 150 s.', 'В бою, когда корпус ниже половины, плотники Короны работают как в полдень: 15% корпуса чинится сразу, все течи закрыты, и 15 с броня +10%. Раз в 150 с.'],
    cry: ['The carpenters work as at noon: the breaches close.', 'Плотники работают как в полдень: пробоины закрываются.'],
  },
  // ---- the traders
  golden_carrack: {
    kind: 'trade', goods: 'all', sell: 1.08,
    name: ['Gilded Credit', 'Золочёный кредит'],
    text: ['Every port pays her 8% more for every good she sells.', 'Любой порт платит ей на 8% больше за любой проданный товар.'],
  },
  spice_dhow: {
    kind: 'trade', goods: ['spices', 'sugar'], sell: 1.18, buy: 0.92,
    name: ['Spice Road', 'Пряный путь'],
    text: ['Spices and sugar sell 18% dearer from her hold, and cost her 8% less.', 'Пряности и сахар из её трюма продаются на 18% дороже и обходятся ей на 8% дешевле.'],
  },
  silk_junk: {
    kind: 'trade', goods: ['cloth', 'drowned_silk'], sell: 1.18, duty: 1,
    name: ['Silk Road', 'Шёлковый путь'],
    text: ['Cloth and drowned silk sell 18% dearer from her hold, and no port takes duty on them.', 'Ткани и утопший шёлк из её трюма продаются на 18% дороже, и ни один порт не берёт с них пошлину.'],
  },
  smugglers_lugger: {
    kind: 'sail', when: 'fog', self: { signature: -0.3, maxSpeed: 0.06 },
    name: ['Dark Water', 'Тёмная вода'],
    text: ['In fog she runs dark: her signature is 30% smaller, the most any hull’s can be, and she sails 6% faster.', 'В тумане она идёт без огней: её заметность на 30% меньше — меньше не бывает ни у кого, — и она на 6% быстрее.'],
  },
  pearl_schooner: {
    kind: 'trade', goods: ['pearls', 'fish', 'prime_fish'], sell: 1.2,
    name: ['Pearl Grounds', 'Жемчужные отмели'],
    text: ['Pearls and fish sell 20% dearer from her hold.', 'Жемчуг и рыба из её трюма продаются на 20% дороже.'],
  },
  floating_bazaar: {
    kind: 'trade', goods: 'all', buy: 0.94,
    name: ['Market Afloat', 'Плавучий рынок'],
    text: ['She buys every good 6% cheaper: the stalls on her deck trade for her.', 'Любой товар она покупает на 6% дешевле: за неё торгуют лавки на палубе.'],
  },
  rum_runner: {
    kind: 'trade', goods: ['rum', 'sugar', 'tobacco'], sell: 1.15, duty: 1,
    name: ['Rum Run', 'Ромовый рейс'],
    text: ['Rum, sugar and tobacco sell 15% dearer from her hold, and no port takes duty on them.', 'Ром, сахар и табак из её трюма продаются на 15% дороже, и ни один порт не берёт с них пошлину.'],
  },
  ledger_galleon: {
    kind: 'trade', goods: 'all', duty: 1,
    name: ['The Brokers\' Seal', 'Печать Брокеров'],
    text: ['No port takes duty on anything she sells.', 'Ни один порт не берёт пошлину ни с чего, что она продаёт.'],
  },
  tea_clipper: {
    kind: 'sail', when: 'open', self: { maxSpeed: 0.1, accel: 0.1 }, aura: { spoilage: -0.5 },
    name: ['Tea Race', 'Чайная гонка'],
    text: ['Away from a fight, with no enemy within 1500 m, she sails 10% faster and gathers way 10% quicker; perishables in her hold keep twice as long.', 'Вдали от боя, когда врагов нет ближе 1500 м, она идёт на 10% быстрее и на 10% быстрее набирает ход; скоропортящийся груз в её трюме хранится вдвое дольше.'],
  },
  treasure_fluyt: {
    kind: 'rally', below: 0.4, secs: 10, cd: 120, self: { incomingDamageMul: -0.2, armor: 0.15 }, aura: { lifeboats: 2.5 },
    name: ['Strongroom', 'Запертая кладовая'],
    text: ['In a fight, below 40% hull she shuts her strongroom: 20% less damage taken and armour +15% for 10 s. Once in 120 s. If she sinks, her boats save half her lawful cargo.', 'В бою, когда корпус ниже 40%, она запирает кладовую: на 20% меньше урона и броня +15% на 10 с. Раз в 120 с. Если она тонет, шлюпки спасают половину законного груза.'],
    cry: ['The strongroom is shut and barred.', 'Кладовая заперта на засов.'],
  },
  // ---- the runners
  sea_hawk: {
    kind: 'strike', chance: 0.33, cd: 12, secs: 6, sails: 0.05, foe: { maxSpeed: -0.15 },
    name: ['Hawk\'s Stoop', 'Бросок ястреба'],
    text: ['A ball of hers that strikes home one time in three tears 5% of the ship\'s sails and slows her 15% for 6 s; once in 12 s.', 'Её ядро, попавшее в цель, в одном случае из трёх рвёт 5% парусов и на 6 с замедляет корабль на 15%; раз в 12 с.'],
  },
  wind_dancer: {
    kind: 'sail', when: 'calm', self: { maxSpeed: 0.2, turnRate: 0.15 },
    name: ['Dancing Wind', 'Танец ветра'],
    text: ['In winds under half strength she sails 20% faster and turns 15% quicker.', 'При ветре слабее половины силы она идёт на 20% быстрее и поворачивает на 15% живее.'],
  },
  shark_cutter: {
    kind: 'strike', chance: 0.25, cd: 15, secs: 6, morale: 3, foe: { incomingDamageMul: 0.12 },
    name: ['Shark\'s Bite', 'Акулья хватка'],
    text: ['A ball of hers that strikes home one time in four opens the wound: the ship takes 12% more damage for 6 s and loses 3 morale; once in 15 s.', 'Её ядро, попавшее в цель, в одном случае из четырёх вскрывает рану: 6 с корабль получает на 12% больше урона и теряет 3 боевого духа; раз в 15 с.'],
  },
  ghost_clipper: {
    kind: 'sail', when: 'night', self: { maxSpeed: 0.12, signature: -0.3 }, flags: ['fog_sense'],
    name: ['Ghost Wind', 'Призрачный ветер'],
    text: ['At night she sails 12% faster and her signature is 30% smaller; in fog she sees half again as far.', 'Ночью она идёт на 12% быстрее, и её заметность на 30% меньше; в тумане она видит в полтора раза дальше.'],
  },
  flying_fish: {
    kind: 'rally', below: 0.5, secs: 6, cd: 60, self: { maxSpeed: 0.35, accel: 0.35 },
    name: ['Skip Away', 'Прыжок'],
    text: ['In a fight, below half her hull she skips away: +35% speed and acceleration for 6 s. Once in 60 s.', 'В бою, когда корпус ниже половины, она выпрыгивает из беды: +35% к скорости и ускорению на 6 с. Раз в 60 с.'],
    cry: ['She skips over the swell like a flying fish!', 'Она скачет по волнам, как летучая рыба!'],
  },
  albatross_xebec: {
    kind: 'sail', when: 'open', self: { maxSpeed: 0.12 }, aura: { moraleBase: 5 },
    name: ['Albatross Wings', 'Крылья альбатроса'],
    text: ['Away from a fight, with no enemy within 1500 m, she sails 12% faster; the albatross aboard keeps her crew\'s morale 5 higher.', 'Вдали от боя, когда врагов нет ближе 1500 м, она идёт на 12% быстрее; альбатрос на борту держит боевой дух команды на 5 выше.'],
  },
  silver_arrow: {
    kind: 'deck', rounds: 99, mine: { shot: 0.25 }, aura: { shotSpeed: 0.2 },
    name: ['Silver Volleys', 'Серебряные залпы'],
    text: ['In a boarding her shooters\' shots strike 25% harder the whole battle; at sea her balls fly 20% faster.', 'При абордаже выстрелы её стрелков весь бой бьют на 25% сильнее; в море её ядра летят на 20% быстрее.'],
  },
  storm_petrel: {
    kind: 'sail', when: 'storm', self: { maxSpeed: 0.15, accel: 0.15 },
    name: ['Storm Rider', 'Оседлавший бурю'],
    text: ['In a storm she sails 15% faster and gathers way 15% quicker.', 'В шторм она идёт на 15% быстрее и на 15% быстрее набирает ход.'],
  },
  mermaid_grace: {
    kind: 'deck', rounds: 2, theirs: { init: -3, morale: -1 },
    name: ['Siren\'s Song', 'Песня сирены'],
    text: ['In a boarding the other side hears the song: −3 initiative and −1 morale for the first 2 rounds.', 'При абордаже сторона врага слышит песню: −3 к инициативе и −1 к боевому духу первые 2 раунда.'],
  },
  viper: {
    kind: 'strike', chance: 0.33, cd: 10, secs: 6, morale: 3, foe: { reloadMul: 0.15 },
    name: ['Venom', 'Яд'],
    text: ['A ball of hers that strikes home one time in three chokes the gun deck: reloads 15% slower for 6 s and −3 morale; once in 10 s.', 'Её ядро, попавшее в цель, в одном случае из трёх душит орудийную палубу: перезарядка на 15% медленнее 6 с и −3 к боевому духу; раз в 10 с.'],
  },
  // ---- the haulers
  leviathan_ark: {
    kind: 'muster', every: 120, who: 'own',
    name: ['Sea Pens', 'Морские загоны'],
    text: ['Her leviathan calves grow back aboard her at sea too: one every 120 s out of a fight, up to the number she came with.', 'Детёныши левиафана подрастают у неё и в море: по одному каждые 120 с вне боя, до числа, с которым она пришла.'],
    cry: ['A leviathan calf rises in the sea pens.', 'В морских загонах поднимается детёныш левиафана.'],
  },
  turtle_barge: {
    kind: 'deck', rounds: 99, mine: { shotTaken: -0.3, taken: -0.1 },
    name: ['Shell Wall', 'Стена панцирей'],
    text: ['In a boarding her side takes 30% less from shots and 10% less from blows, the whole battle.', 'При абордаже её сторона весь бой получает на 30% меньше от выстрелов и на 10% меньше от ударов.'],
  },
  floating_fortress: {
    kind: 'toll', cd: 20, r: 300, secs: 0, hull: 0.02, morale: 2, fx: 'mortar',
    name: ['Corner Towers', 'Угловые башни'],
    text: ['In a fight, every 20 s her tower guns fire on every enemy engaged with her within 300 m: 2% of its hull and −2 morale.', 'В бою каждые 20 с пушки её башен бьют по каждому врагу, что бьётся с ней, в 300 м: 2% корпуса и −2 к боевому духу.'],
  },
  menagerie: {
    kind: 'deck', rounds: 2, mine: { init: 2 }, theirs: { morale: -2 },
    name: ['Cages Open', 'Клетки открыты'],
    text: ['In a boarding the cages open: the other side fights the first 2 rounds with −2 morale, and her side with +2 initiative.', 'При абордаже открываются клетки: первые 2 раунда сторона врага бьётся с духом −2, а её сторона — с инициативой +2.'],
  },
  whale_mother: {
    kind: 'muster', every: 150, who: 'own',
    name: ['Whale Nursery', 'Китовые ясли'],
    text: ['Her whale calves grow back aboard her at sea too: one every 150 s out of a fight, up to the number she came with.', 'Китята подрастают у неё и в море: по одному каждые 150 с вне боя, до числа, с которым она пришла.'],
    cry: ['A whale calf is born alongside.', 'У борта родился китёнок.'],
  },
  coral_hulk: {
    kind: 'rally', below: 0.5, secs: 0, cd: 150, mend: 0.15,
    name: ['Living Coral', 'Живой коралл'],
    text: ['In a fight, below half her hull the coral grows over the breaches: 15% of her hull mended at once and every leak closed. Once in 150 s.', 'В бою, когда корпус ниже половины, коралл зарастает пробоины: 15% корпуса чинится сразу, и все течи закрыты. Раз в 150 с.'],
    cry: ['The coral grows over the breaches.', 'Коралл зарастает пробоины.'],
  },
  drowned_cathedral: {
    kind: 'toll', cd: 30, r: 450, secs: 10, morale: 8, foe: { moraleRegen: -0.12 }, fx: 'song',
    name: ['The Drowned Bells', 'Колокола утопших'],
    text: ['In a fight, every 30 s her bells toll over every enemy engaged with her within 450 m: −8 morale, and its morale mends 30% slower for 10 s.', 'В бою каждые 30 с её колокола звонят над каждым врагом, что бьётся с ней, в 450 м: −8 к боевому духу, и 10 с дух его восстанавливается на 30% медленнее.'],
  },
  treasure_junk: {
    kind: 'trade', goods: ['spices', 'cloth', 'drowned_silk', 'pearls', 'medicine'], sell: 1.12,
    name: ['Nine Masts of Treasure', 'Девять мачт сокровищ'],
    text: ['Spices, cloth, drowned silk, pearls and medicine sell 12% dearer from her hold.', 'Пряности, ткани, утопший шёлк, жемчуг и лекарства из её трюма продаются на 12% дороже.'],
  },
  pirate_haven: {
    kind: 'muster', every: 15, who: 'hands', upTo: 0.75,
    name: ['Free Town', 'Вольный город'],
    text: ['Hands sign on at sea: one deckhand every 15 s out of a fight, up to three quarters of her hammocks.', 'Люди нанимаются прямо в море: по юнге каждые 15 с вне боя, пока не заняты три четверти коек.'],
    cry: ['Hands from the floating town sign on.', 'Люди из плавучего города нанимаются в команду.'],
  },
  iron_whale: {
    kind: 'rally', below: 0.45, secs: 12, cd: 120, self: { incomingDamageMul: -0.3 },
    name: ['Close the Plates', 'Сомкнуть плиты'],
    text: ['In a fight, below 45% hull she closes her iron plates: 30% less damage taken for 12 s. Once in 120 s.', 'В бою, когда корпус ниже 45%, она смыкает железные плиты: на 30% меньше урона на 12 с. Раз в 120 с.'],
    cry: ['The iron plates close over her.', 'Железные плиты смыкаются над ней.'],
  },
  // ---- the third batch (owner, 2026-10-04: «еще больше … кораблей»), two a list
  bulldog: {
    kind: 'deck', rounds: 2, mine: { melee: 0.15 }, theirs: { init: -2 },
    name: ['Loose the Dogs', 'Спустить псов'],
    text: ['In a boarding her war mastiffs go over the rail first: for the first 2 rounds the other side is thrown into disorder, −2 initiative, and her side\'s blows strike 15% harder.', 'При абордаже первыми через борт идут её боевые мастифы: первые 2 раунда сторона врага в смятении, −2 к инициативе, а удары её стороны на 15% сильнее.'],
  },
  saint_elmo: {
    kind: 'rally', below: 0.5, secs: 10, cd: 100, self: { reloadMul: -0.2, armor: 0.08 }, fx: 'war_cry',
    name: ['Fire on the Masts', 'Огонь на мачтах'],
    text: ['In a fight, below half her hull the saint\'s blue fire runs down her masts and the crew takes heart: for 10 s her guns reload 20% faster and her armour is 8% higher. Once in 100 s.', 'В бою, когда корпус ниже половины, голубой огонь святого сбегает по её мачтам, и команда воспряла духом: 10 с её орудия перезаряжаются на 20% быстрее, а броня на 8% выше. Раз в 100 с.'],
    cry: ['Saint Elmo\'s fire on the masts: the saint is with us!', 'Огни святого Эльма на мачтах: святой с нами!'],
  },
  lantern_sampan: {
    kind: 'trade', goods: ['provisions', 'salt', 'cloth'], sell: 1.15, buy: 0.95,
    name: ['River Market', 'Речной рынок'],
    text: ['Provisions, salt and cloth sell 15% dearer from her hold, and cost her 5% less.', 'Провизия, соль и ткани из её трюма продаются на 15% дороже и обходятся ей на 5% дешевле.'],
  },
  golden_lion: {
    kind: 'trade', goods: 'all', sell: 1.05, buy: 0.95,
    name: ['Charter of the Lagoon', 'Хартия лагуны'],
    text: ['Every port pays her 5% more for every good she sells, and sells her every good 5% cheaper: the republic\'s charter.', 'Любой порт платит ей на 5% больше за любой проданный товар и продаёт ей любой товар на 5% дешевле: хартия республики.'],
  },
  dolphin: {
    kind: 'sail', when: 'open', self: { maxSpeed: 0.08, turnRate: 0.1 },
    name: ['Bow Riders', 'На носовой волне'],
    text: ['Away from a fight, with no enemy within 1500 m, the dolphins ride her bow wave: she sails 8% faster and turns 10% quicker.', 'Вдали от боя, когда врагов нет ближе 1500 м, дельфины идут на её носовой волне: она на 8% быстрее и поворачивает на 10% живее.'],
  },
  sailfish: {
    kind: 'strike', chance: 0.25, cd: 14, secs: 8, foe: { incomingDamageMul: 0.1, maxSpeed: -0.1 },
    name: ['Marlin\'s Spear', 'Копьё марлина'],
    text: ['A ball of hers that strikes home one time in four runs the ship through: for 8 s it takes 10% more damage and sails 10% slower; once in 14 s.', 'Её ядро, попавшее в цель, в одном случае из четырёх пронзает корабль: 8 с он получает на 10% больше урона и идёт на 10% медленнее; раз в 14 с.'],
  },
  mimic_barge: {
    kind: 'muster', every: 90, who: 'own',
    name: ['Live Cargo', 'Живой груз'],
    text: ['Her cask mimics come back aboard her at sea too: one every 90 s out of a fight, up to the number she came with.', 'Бочки-мимики заводятся у неё и в море: по одной каждые 90 с вне боя, до числа, с которым она пришла.'],
    cry: ['A cask in the hold opens one eye.', 'Бочка в трюме открывает один глаз.'],
  },
  icebound_hulk: {
    kind: 'toll', cd: 30, r: 300, secs: 6, foe: { turnRate: -0.2, reloadMul: 0.1 }, fx: 'song',
    name: ['Hoarfrost', 'Изморозь'],
    text: ['In a fight, every 30 s frost falls on every enemy engaged with her within 300 m: its rigging stiffens and its gun crews numb — it turns 20% slower and reloads 10% slower for 6 s.', 'В бою каждые 30 с изморозь ложится на каждого врага, что бьётся с ней, в 300 м: снасти дубеют, руки расчётов немеют — 6 с он поворачивает на 20% медленнее и перезаряжается на 10% медленнее.'],
  },
};

/** A hull's gift (none for a hull not sold for doubloons). */
export function giftOf(classId: ShipClassId): ShipGift | undefined {
  return Object.hasOwn(SHIP_GIFTS, classId) ? SHIP_GIFTS[classId as FleetClassId] : undefined;
}

/** What her gift lays on her stats always (the aura), for computeShipStats. */
export function giftSource(classId: ShipClassId): { mods?: StatMods; flags?: Flag[] } | null {
  const g = giftOf(classId);
  return g && (g.aura || g.flags) ? { mods: g.aura, flags: g.flags } : null;
}
