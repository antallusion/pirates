// The Heroes' town and its dwellings (docs/17 H3 items 11–13). Men of the seven tiers grow week by week in dwellings —
// in the ports by what each port is (its tavern, a barracks, a shooters' guild, a gun foundry, a veterans' den, an
// admiralty, a drowned shrine) and on a captain's own island as buildings of her town — and are recruited into the
// ship's stacks for silver and, from the fourth tier up, for the sea's scarcer resources. An upgraded dwelling also
// trains the plain kind of its tier into the upgraded kind for the difference in price.
//
// The island's town stands over the isometric base (docs/15) as HoMM3's town screen: a town hall (daily silver into
// the island's treasury), a keep that becomes a citadel and a castle (+50% / +100% growth), a dwelling of each tier and
// its upgrade, a market that trades the resources at poor rates, and a guild of orders (the captain's orders come with
// docs/17 H2). The island's shipyard stays what it is.
//
// Balance (tests/balance/recruit.test.ts): a man costs what the sea reckons him worth (UNITS[].cost) — a quarter more
// in a port — so a week of an island's dwellings (all seven built, no keep) is worth ~3 500 silver of men, about half
// an hour at sea at ⚓6 (seaHour, tests/balance/island.ts), and a castle doubles it; a pool keeps two weeks' growth at
// most, so a captain who looks in once a day finds two weeks and not four.

import { UNITS, armyForLevel, armyWeight } from './army.ts';
import type { ArmyStack, UnitId } from './army.ts';
import type { BaseCost } from './base.ts';
import { BUILD_MAX_SECS } from './base.ts';
import type { Tr } from './estate.ts';
import { GOODS } from './goods.ts';
import type { GoodId } from './goods.ts';
import type { Port } from '../world/worldgen.ts';
import { REGIONS } from '../world/regions.ts';

export const TIERS = [1, 2, 3, 4, 5, 6, 7] as const;
/** The plain kind of each tier (index: the tier). */
export const TIER_UNIT: UnitId[] = ['deckhand', 'deckhand', 'marine', 'musketeer', 'gunner', 'boarder', 'guard', 'drowned'];

/** Men a dwelling grows a week (HoMM3's castle: 14 pikemen … 1 angel). */
export const GROWTH = [0, 14, 9, 7, 5, 3, 2, 1];
/** A pool keeps this many weeks of growth at most (the MMO's cap on HoMM3's endless accumulation). */
export const POOL_WEEKS = 2;
/** A port's dwellings by its size: a village's, a town's half as many again, a great port's twice. */
export const PORT_GROWTH = [0, 1, 1.5, 2];
/** The ship's level each tier serves from — the ladder's own spread of an army (shared/src/data/army.ts tierShares:
 *  gunners from ⚓3, boarders from ⚓4, the drowned from ⚓5, the officers' guard from ⚓6). Canon D12: a green hull
 *  is not crewed with a veteran army bought outright. */
export const TIER_SHIP_LEVEL = [0, 1, 1, 1, 3, 4, 6, 5];

/** Picked men — tier 4 and up — a ship of ⚓L berths, as a share of her hammocks: 15% at ⚓1, a third at ⚓7, 42% at
 *  ⚓10 (the ladder's own armies carry 5–25%: a town-bred crew is better than the sea's usual, not a different game). */
export function pickedShare(shipLevel: number): number {
  return Math.min(0.45, 0.12 + 0.03 * Math.max(1, Math.min(10, shipLevel)));
}
export const PICKED_TIER = 4;

/** The picked men's might cap (docs/17 H5): the trained men a ship signs on from the dwellings (tier 2 and up) and the
 *  upgrades she pays for keep her army's weight in a boarding (armyWeight, the square law) to this many times the
 *  ladder's own crew of her level and hammocks — the empty hammocks counted as deckhands, so nothing is gamed by
 *  signing the deckhands on last. A month of a castle's men was three times the sea's armies of her level (every
 *  boarding of a pirate of her level won); under the cap about four in five. Deckhands and seasoned sailors (tier 1)
 *  are never held back. */
export const MIGHT_CAP = [1, 1, 1, 1, 1, 1.05, 1.05, 1.15, 1.25, 1.25, 1.3];

export function mightCap(level: number, crewMax: number, slots: number, k = MIGHT_CAP[Math.max(1, Math.min(10, Math.round(level)))]): number {
  return k * armyWeight(armyForLevel(level, crewMax, slots, 'player'));
}

/** How many men of kind `u` (trained up from `from`, if given) may join `army` under the cap. */
export function mightRoom(army: readonly ArmyStack[], u: UnitId, level: number, crewMax: number, slots: number, from?: UnitId, k?: number): number {
  if (UNITS[u].tier <= 1) return Infinity;
  const cap = mightCap(level, crewMax, slots, k);
  const men = army.reduce((a, x) => a + x.n, 0);
  const trial = (n: number): ArmyStack[] => {
    const out = army.map((x) => ({ ...x }));
    if (from) {
      const f = out.find((x) => x.u === from);
      if (f) f.n -= n;
    }
    out.push({ u, n });
    const room = Math.max(0, crewMax - men - (from ? 0 : n));
    if (room > 0) out.push({ u: 'deckhand', n: room });
    return out.filter((x) => x.n > 0);
  };
  let lo = 0, hi = from ? army.find((x) => x.u === from)?.n ?? 0 : Math.max(0, crewMax - men);
  if (armyWeight(trial(0)) > cap) return 0;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (armyWeight(trial(mid)) <= cap) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** A man bought in a port costs a quarter more than at one's own dwellings. */
export const PORT_MARKUP = 1.25;

/** The resources a man of the higher tiers asks besides his silver (powder for the shooters and the guns, rum for the
 *  boarders, pearls for the guard and the drowned — HoMM3's crystals and gems), per man. */
export const UNIT_GOODS: Partial<Record<UnitId, Partial<Record<GoodId, number>>>> = {
  musketeer: { gunpowder: 0.25 },
  sharpshooter: { gunpowder: 0.35 },
  gunner: { gunpowder: 0.5, iron: 0.25 },
  bombardier: { gunpowder: 0.75, iron: 0.35 },
  boarder: { rum: 1 },
  cutthroat: { rum: 1.5 },
  guard: { pearls: 0.2 },
  life_guard: { pearls: 0.3 },
  drowned: { pearls: 0.5 },
  deep_spawn: { pearls: 0.75 },
};

export interface Price {
  silver: number;
  goods: Partial<Record<GoodId, number>>;
}

const whole = (x: number) => Math.ceil(x - 1e-9);

/** What `n` men of a kind cost: in a port or at one's own dwellings. */
export function recruitPrice(u: UnitId, n: number, port: boolean): Price {
  n = Math.max(0, Math.floor(n));
  const goods: Partial<Record<GoodId, number>> = {};
  for (const [g, per] of Object.entries(UNIT_GOODS[u] ?? {}) as [GoodId, number][]) if (n > 0) goods[g] = whole(per * n);
  return { silver: Math.round(n * UNITS[u].cost * (port ? PORT_MARKUP : 1)), goods };
}

/** What training `n` men of a plain kind into its upgrade costs: the difference in silver and in resources. */
export function upgradePrice(u: UnitId, n: number, port: boolean): Price | null {
  const up = UNITS[u]?.upgrade;
  if (!up) return null;
  n = Math.max(0, Math.floor(n));
  const goods: Partial<Record<GoodId, number>> = {};
  const a = UNIT_GOODS[u] ?? {}, b = UNIT_GOODS[up] ?? {};
  for (const g of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<GoodId>) {
    const d = (b[g] ?? 0) - (a[g] ?? 0);
    if (d > 0 && n > 0) goods[g] = whole(d * n);
  }
  return { silver: Math.round(n * (UNITS[up].cost - UNITS[u].cost) * (port ? PORT_MARKUP : 1)), goods };
}

/** The most men a purse and a store pay for (and the pool, the hammocks and the slots allow). */
export function affordable(u: UnitId, price: (n: number) => Price, gold: number, have: Partial<Record<GoodId, number>>, cap: number): number {
  let lo = 0, hi = Math.max(0, Math.floor(cap));
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const p = price(mid);
    const ok = p.silver <= gold && (Object.entries(p.goods) as [GoodId, number][]).every(([g, k]) => (have[g] ?? 0) >= k);
    if (ok) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Only the Choir's captains and the cursed ships keep the drowned (docs/17 H1: the deep's own). */
export function deepAllowed(curse: number, choirRep: number, drownedCrew: boolean): boolean {
  return curse >= 50 || choirRep >= 20 || drownedCrew;
}

// ------------------------------------------------------------------------------------------------ the ports' dwellings

export interface PortDwelling {
  tier: number;
  /** The upgraded kind is had here too, and stacks are trained up (an upgrade building). */
  up: boolean;
}

/** What each port keeps (ports list no buildings: what they are says it). The tavern's waterfront is the first tier's
 *  dwelling everywhere; the rest by the port's size, flag, waters and trade. */
export function portDwellings(port: Pick<Port, 'size' | 'faction' | 'region' | 'shipyardTier' | 'blackMarket' | 'key' | 'raft'>): PortDwelling[] {
  const up = !!port.key && port.size >= 2;
  const out: PortDwelling[] = [{ tier: 1, up: up || port.size >= 2 }];
  if (port.raft) return out;
  const f = port.faction;
  const lawless = REGIONS[port.region]?.safety === 'lawless';
  if (port.size >= 2 || f === 'crown' || f === 'league') out.push({ tier: 2, up });
  if (port.size >= 2 || f === 'confederacy') out.push({ tier: 3, up });
  if (port.shipyardTier >= 3 || port.region === 'ashen_isles') out.push({ tier: 4, up });
  if (port.blackMarket || lawless) out.push({ tier: 5, up });
  if (port.key && port.size >= 2 && (f === 'crown' || f === 'league' || f === 'confederacy' || f === 'harpoon')) out.push({ tier: 6, up });
  if (f === 'choir' || port.region === 'drowned_crown') out.push({ tier: 7, up });
  return out;
}

/** A port dwelling's men a week. */
export function portGrowth(tier: number, size: number): number {
  return GROWTH[tier] * (PORT_GROWTH[Math.max(1, Math.min(3, size))] ?? 1);
}

// ------------------------------------------------------------------------------------------------ the island's town

export type TownId = 'hall' | 'keep' | 'dw1' | 'dw2' | 'dw3' | 'dw4' | 'dw5' | 'dw6' | 'dw7' | 'market' | 'guild' | 'grail';
export const TOWN_IDS: TownId[] = ['hall', 'keep', 'dw1', 'dw2', 'dw3', 'dw4', 'dw5', 'dw6', 'dw7', 'market', 'guild', 'grail'];

export interface TownDef {
  id: TownId;
  /** Its name at each level (1, 2, 3…). */
  names: Tr[];
  text: Tr;
  /** Its picture (an existing isometric building). */
  art: string;
  max: number;
  /** A dwelling's tier. */
  tier?: number;
}

const dw = (tier: number, plain: Tr, up: Tr, text: Tr, art: string): TownDef => ({ id: `dw${tier}` as TownId, names: [plain, up], text, art, max: 2, tier });

export const TOWN: Record<TownId, TownDef> = {
  hall: { id: 'hall', names: [['Town Hall', 'Ратуша'], ['City Hall', 'Городская управа'], ['Capitol', 'Капитолий']], text: ['Silver every day into the island’s treasury: 60, then 125, then 250.', 'Серебро каждый день в казну острова: 60, потом 125, потом 250.'], art: 'trophy_hall', max: 3 },
  keep: { id: 'keep', names: [['Keep', 'Крепость'], ['Citadel', 'Цитадель'], ['Castle', 'Замок']], text: ['Walls for the town: the citadel grows half as many men again in every dwelling, the castle twice as many.', 'Стены города: цитадель даёт всем жилищам +50% прироста, замок — вдвое больше.'], art: 'fort', max: 3 },
  dw1: dw(1, ['Bunkhouse', 'Кубрик'], ['Sailors’ Hall', 'Матросский дом'], ['Deckhands sign on here; upgraded, it trains them into seasoned sailors.', 'Здесь нанимаются юнги; улучшенный — учит их в бывалых матросов.'], 'residents_house'),
  dw2: dw(2, ['Marine Barracks', 'Казарма морпехов'], ['Guard House', 'Караульня'], ['Marines muster here; upgraded, sea guards.', 'Здесь собираются морпехи; улучшенная — морская гвардия.'], 'barracks'),
  dw3: dw(3, ['Shooting Range', 'Стрельбище'], ['Shooters’ Guild', 'Гильдия стрелков'], ['Musketeers practise here; upgraded, sharpshooters. They want powder.', 'Здесь упражняются мушкетёры; улучшенное — меткие стрелки. Им нужен порох.'], 'kennel'),
  dw4: dw(4, ['Gun Foundry', 'Пушечный двор'], ['Bombard Works', 'Бомбардирская'], ['Gunners with their swivels; upgraded, bombardiers. Powder and iron.', 'Канониры с фальконетами; улучшенный — бомбардиры. Порох и железо.'], 'forge'),
  dw5: dw(5, ['Veterans’ Den', 'Притон ветеранов'], ['Cutthroats’ Den', 'Логово головорезов'], ['Boarders who have taken ships; upgraded, cutthroats. They drink rum.', 'Абордажники, бравшие корабли; улучшенный — головорезы. Пьют ром.'], 'smuggler_store'),
  dw6: dw(6, ['Admiralty', 'Адмиралтейство'], ['Admiralty Court', 'Адмиралтейский двор'], ['The officers’ guard; upgraded, the life guard. Paid in pearls as well.', 'Офицерская гвардия; улучшенное — лейб-гвардия. Платят и жемчугом.'], 'chart_house'),
  dw7: dw(7, ['Drowned Shrine', 'Святилище утопленников'], ['Abyssal Altar', 'Алтарь бездны'], ['The drowned rise for the Choir and the cursed; upgraded, the deep’s spawn. Pearls for the sea.', 'Утопленники встают для Хора и проклятых; улучшенное — порождения бездны. Жемчуг — морю.'], 'chapel'),
  market: { id: 'market', names: [['Marketplace', 'Рынок'], ['Exchange', 'Биржа'], ['Merchants’ Guild', 'Гильдия купцов']], text: ['Trades the island’s resources for silver and for each other — at poor rates, better with each level.', 'Меняет ресурсы острова на серебро и друг на друга — по плохому курсу, с каждым уровнем чуть лучше.'], art: 'caravan_office', max: 3 },
  // docs/17 H5: HoMM3's mage guild — five floors, each teaching a fixed list of its level's orders free.
  guild: {
    id: 'guild', names: [['Guild of Orders', 'Гильдия приказов'], ['Hall of Orders', 'Зал приказов'], ['School of Orders', 'Школа приказов'], ['College of Orders', 'Коллегия приказов'], ['Tower of Orders', 'Башня приказов']],
    text: ['Teaches the captain its orders free, as far as her level allows: each floor a fixed list of its level’s orders (three, three, two, one, one). Lie off the island to learn.', 'Учит капитана своим приказам даром, насколько позволяет её уровень: на каждом ярусе свой список приказов его уровня (три, три, два, один, один). Чтобы учиться, встаньте у острова.'],
    art: 'lighthouse', max: 5,
  },
  // docs/17 H4 item 16: the legendary treasure the obelisks' chart leads to, raised over the town.
  grail: { id: 'grail', names: [['The Grail', 'Грааль']], text: ['The legendary treasure raised over the town: every dwelling grows half as many men again, 500 silver a day into the treasury, and the captain’s will runs deeper.', 'Легендарное сокровище над городом: все жилища дают в полтора раза больше бойцов, 500 серебра в день в казну, а воля капитана глубже.'], art: 'signal_tower', max: 1 },
};

export const townWhat = (id: TownId): string => `t:${id}`;
export function townOf(what: string): TownId | null {
  return what.startsWith('t:') && (what.slice(2) as TownId) in TOWN ? (what.slice(2) as TownId) : null;
}

/** A dwelling's town id by its tier. */
export const dwellingOf = (tier: number): TownId => `dw${tier}` as TownId;

/** The town hall's silver a day by its level. */
export const HALL_INCOME = [0, 60, 125, 250];
/** Growth by the keep's level: none, the keep, the citadel (+50%), the castle (+100%). */
export const KEEP_GROWTH = [1, 1, 1.5, 2];

/** The market: what it pays for a unit (by its base price) and what it asks, by its level. HoMM3's poor rates — the
 *  most it pays lies under the cheapest port's price, the least it asks over most ports' dearest. */
export const MARKET_SELL = [0, 0.2, 0.25, 0.3];
export const MARKET_BUY = [0, 3.4, 3.1, 2.8];
/** What the market deals in: the six resources besides silver, and the island's stone. */
export const MARKET_GOODS: GoodId[] = ['timber', 'iron', 'tar', 'gunpowder', 'pearls', 'rum', 'coal'];

export function marketSell(good: GoodId, level: number, weekSell = 1): number {
  return GOODS[good].basePrice * MARKET_SELL[Math.max(0, Math.min(3, level))] * weekSell;
}
export function marketBuy(good: GoodId, level: number, weekBuy = 1): number {
  return GOODS[good].basePrice * MARKET_BUY[Math.max(0, Math.min(3, level))] * weekBuy;
}

const round50 = (n: number) => Math.max(50, Math.round(n / 50) * 50);

/** What raising a town building to a level costs (level 1: founding it). */
export function townCost(id: TownId, level: number): BaseCost {
  const L = Math.max(1, level);
  const secs = (s: number) => Math.min(BUILD_MAX_SECS, s);
  switch (id) {
    case 'hall':
      return [
        { silver: 4_000, goods: { timber: 30, coal: 20 }, secs: 600 },
        { silver: 20_000, goods: { timber: 80, coal: 60, iron: 30, tar: 20 }, secs: 1800 },
        { silver: 60_000, goods: { timber: 150, coal: 120, iron: 60, tar: 40, pearls: 10, rum: 20 }, secs: 3600 },
      ][Math.min(2, L - 1)];
    case 'keep':
      return [
        { silver: 5_000, goods: { timber: 40, coal: 40 }, secs: 900 },
        { silver: 15_000, goods: { timber: 60, coal: 80, iron: 40, tar: 10 }, secs: 2400 },
        { silver: 40_000, goods: { timber: 100, coal: 150, iron: 80, tar: 30, gunpowder: 30 }, secs: 3600 },
      ][Math.min(2, L - 1)];
    case 'market':
      return [
        { silver: 3_000, goods: { timber: 30, coal: 20 }, secs: 600 },
        { silver: 8_000, goods: { timber: 50, coal: 40, iron: 10 }, secs: 1200 },
        { silver: 20_000, goods: { timber: 80, coal: 60, iron: 30, pearls: 4 }, secs: 2400 },
      ][Math.min(2, L - 1)];
    case 'guild':
      return [
        { silver: 6_000, goods: { timber: 40, coal: 30, tar: 20, pearls: 3 }, secs: 1200 },
        { silver: 10_000, goods: { timber: 50, coal: 40, tar: 30, pearls: 5 }, secs: 1800 },
        { silver: 16_000, goods: { timber: 60, coal: 50, tar: 40, pearls: 8, rum: 10 }, secs: 2400 },
        { silver: 25_000, goods: { timber: 80, coal: 60, tar: 50, pearls: 12, rum: 20 }, secs: 3000 },
        { silver: 40_000, goods: { timber: 100, coal: 80, tar: 60, pearls: 18, rum: 30 }, secs: 3600 },
      ][Math.min(4, L - 1)];
    case 'grail':
      return { silver: 5_000, goods: { timber: 40, coal: 40, pearls: 6 }, secs: 1800 };
    default: {
      const t = TOWN[id].tier ?? 1;
      const goods: Partial<Record<GoodId, number>> = { timber: 20 + 10 * t, coal: 10 + 8 * t };
      if (t >= 3) goods.iron = 6 * t;
      if (t >= 4) goods.gunpowder = 5 * t;
      if (t >= 5) goods.rum = 6 * t;
      if (t >= 6) goods.pearls = 2 * t;
      const silver = 1500 * t ** 1.5;
      if (L <= 1) return { silver: round50(silver), goods, secs: secs(600 + 400 * t) };
      const g2: Partial<Record<GoodId, number>> = {};
      for (const [g, n] of Object.entries(goods) as [GoodId, number][]) g2[g] = Math.ceil(n * 1.5);
      g2.tar = (g2.tar ?? 0) + 5 * t;
      return { silver: round50(silver * 1.6), goods: g2, secs: secs(Math.round((600 + 400 * t) * 1.5)) };
    }
  }
}

/** What a level of a town building asks first: the island's level and the town's other buildings. */
export interface TownGate {
  isle: number;
  keep?: number;
}

export function townGate(id: TownId, level: number): TownGate {
  const L = Math.max(1, level);
  switch (id) {
    case 'hall':
      return L >= 3 ? { isle: 6, keep: 3 } : { isle: L >= 2 ? 3 : 1 };
    case 'keep':
      return { isle: [1, 3, 5][Math.min(2, L - 1)] };
    case 'market':
      return { isle: [1, 3, 5][Math.min(2, L - 1)] };
    case 'guild':
      return { isle: [2, 3, 5, 7, 9][Math.min(4, L - 1)] };
    case 'grail':
      return { isle: 1 };
    default: {
      const t = TOWN[id].tier ?? 1;
      return { isle: Math.min(10, L >= 2 ? t + 1 : t), keep: 1 };
    }
  }
}

/** A dwelling's men a week on the island (the keep's walls, the week's name). */
export function isleGrowth(tier: number, keepLevel: number, weekMul = 1): number {
  return GROWTH[tier] * KEEP_GROWTH[Math.max(0, Math.min(3, keepLevel))] * weekMul;
}
