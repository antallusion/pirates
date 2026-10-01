// The captain's own island as a town of the Heroes (docs/17 H3 item 13), over the isometric base (docs/15): the town
// hall's silver each dawn into the island's treasury, the keep → citadel → castle for +50% / +100% growth, a dwelling
// of each tier and its upgrade, the market's poor rates, the guild of orders (five floors of orders, docs/17 H5). The town's
// buildings stand apart from the plots — HoMM3's own town screen — and are raised by the same builders' crews, on the
// same timers and speed-ups (their work is a job of the yard with no plot). Paid from the purse and the yard (then the
// island's store, then the hold of a ship lying off the island).

import { TOWN, TOWN_IDS, HALL_INCOME, KEEP_GROWTH, MARKET_GOODS, POOL_WEEKS, TIER_UNIT, deepAllowed, dwellingOf, isleGrowth, marketBuy, marketSell, townCost, townGate, townOf } from '../../../shared/src/data/town.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import { speedupGoods, speedupSilver } from '../../../shared/src/data/base.ts';
import { weekBuy, weekGrowth, weekHall, weekSell } from '../../../shared/src/data/week.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { TownThingView, TownView } from '../../../shared/src/h3proto.ts';
import { ORDERS, isOrder, isleGuildOrders, orderLevelCap, rankOf } from '../../../shared/src/data/hero.ts';
import { heroOf, learnOrder } from './hero.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { crewFree, lacking, lyingOff, mine as ownBase, reckonBase, takeGoods } from './base.ts';
import type { BaseJob, Yard } from './base.ts';
import { kindOfWeek, thisWeek, weekNow, weekView } from './calendar.ts';
import type { Game } from './Game.ts';
import type { Holding } from './holdings.ts';
import { minesDailyOf, ownMines } from './mines.ts';
import type { PlayerSession } from './player.ts';
import { GRAIL_GROWTH, GRAIL_SILVER } from '../../../shared/src/data/advmap.ts';
import { grailRaised, grailToRaise } from './grail.ts';

export interface TownState {
  /** Each town building's level. */
  b: Partial<Record<TownId, number>>;
  /** Each tier's men waiting in its dwelling (index: the tier; fractions grow into men). */
  pool: number[];
  /** The week the pools were last grown to. */
  w: number;
}

export function townState(y: Yard): TownState {
  y.town ??= { b: {}, pool: [0, 0, 0, 0, 0, 0, 0, 0], w: -1 };
  const t = y.town;
  t.b ??= {};
  if (!Array.isArray(t.pool) || t.pool.length < 8) t.pool = [0, 0, 0, 0, 0, 0, 0, 0];
  if (!Number.isFinite(t.w)) t.w = -1;
  return t;
}

export const townLevel = (y: Yard, id: TownId): number => Math.max(0, Math.floor(y.town?.b[id] ?? 0));

/** The name of a town building at a level (the English the server speaks). */
export const townName = (id: TownId, level: number): string => TOWN[id].names[Math.max(0, Math.min(TOWN[id].names.length, level) - 1)][0];

/** Her ship keeps the drowned: the Choir's favour, a cursed hull, a crew of the drowned. */
export function keepsDeep(s: PlayerSession): boolean {
  const ship = s.ship;
  return deepAllowed(ship?.curse ?? 0, s.profile?.reputation.choir ?? 0, !!ship?.hasFlag('crew_of_drowned'));
}

// ------------------------------------------------------------------------------------------------ the dwellings' men

/** A dwelling's men a week on this island now. */
export function isleWeekGrowth(game: Game, y: Yard, tier: number, week = thisWeek(game)): number {
  if (townLevel(y, dwellingOf(tier)) <= 0) return 0;
  return isleGrowth(tier, townLevel(y, 'keep'), weekGrowth(kindOfWeek(game, week), tier)) * grailGrowth(y);
}

/** The Grail over the town (docs/17 H4): every dwelling grows half as many men again. */
export const grailGrowth = (y: Yard): number => (townLevel(y, 'grail') > 0 ? GRAIL_GROWTH : 1);

function poolCap(game: Game, y: Yard, tier: number): number {
  return POOL_WEEKS * isleGrowth(tier, townLevel(y, 'keep'), Math.max(1, weekGrowth(weekNow(game), tier))) * grailGrowth(y);
}

/** The island's pools grown to this week (two weeks' growth at most wait in a dwelling). */
export function islePools(game: Game, y: Yard): number[] {
  const t = townState(y);
  const w = thisWeek(game);
  if (t.w < 0) t.w = w;
  if (t.w < w) {
    for (let k = Math.max(t.w + 1, w - POOL_WEEKS + 1); k <= w; k++) {
      for (let tier = 1; tier <= 7; tier++) {
        const g = isleWeekGrowth(game, y, tier, k);
        if (g > 0) t.pool[tier] = Math.min(poolCap(game, y, tier), (t.pool[tier] ?? 0) + g);
      }
    }
    t.w = w;
    game.holdings.touch();
  }
  return t.pool;
}

// ------------------------------------------------------------------------------------------------ building

/** Why a town building may not rise a level now (null: it may). */
export function townWhy(game: Game, s: PlayerSession, h: Holding, y: Yard, id: TownId): string | null {
  const L = townLevel(y, id);
  const def = TOWN[id];
  if (L >= def.max) return 'It is at its greatest';
  if (y.jobs.some((j) => j.what === `t:${id}`)) return 'The builders are already at work there.';
  const g = townGate(id, L + 1);
  if ((h.level ?? 1) < g.isle) return `Raise the island to level ${g.isle} first.`;
  if (g.keep && townLevel(y, 'keep') < g.keep) return g.keep >= 3 ? 'Raise the keep to a castle first.' : 'Build the keep first.';
  if (id === 'dw7' && !keepsDeep(s)) return 'Only a captain of the Choir or of a cursed ship keeps the drowned.';
  if (id === 'grail' && !grailToRaise(s)) return 'Dig up the Grail first: the obelisks’ chart shows where.';
  return crewFree(h, y);
}

/** Raise a town building a level (its first: founded). */
export function buildTown(game: Game, s: PlayerSession, id: TownId): string | null {
  if (!TOWN_IDS.includes(id)) return 'Unknown building';
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const { h, y } = m;
  const why = townWhy(game, s, h, y, id);
  if (why) return why;
  const level = townLevel(y, id) + 1;
  const cost = townCost(id, level);
  const p = s.profile!;
  const near = lyingOff(game, s, h);
  const lack = lacking(h, y, s, near, cost.goods);
  if (lack) return lack;
  if (p.gold < cost.silver) return `Needs ${cost.silver} silver`;
  p.gold -= cost.silver;
  takeGoods(h, y, s, near, cost.goods);
  game.db.ledger(s.accountId, 'isle_town', -cost.silver, `${h.island}:${id}:${level}`);
  const now = game.wallNow();
  y.jobs.push({ id: y.seq++, plot: -1, what: `t:${id}`, level, start: now, end: now + cost.secs * 1000 });
  if (id === 'grail') grailRaised(s); // the Grail is the town's now (docs/17 H4)
  game.holdings.touch();
  return null;
}

/** The builders are done with a town building (called from the base's reckoning). */
export function finishTown(game: Game, h: Holding, y: Yard, isl: Island, j: BaseJob): void {
  const id = townOf(j.what);
  if (!id) return;
  const t = townState(y);
  t.b[id] = Math.max(townLevel(y, id), j.level);
  // A new dwelling opens with its first week's men, as HoMM3's do.
  const tier = TOWN[id].tier;
  if (tier && j.level <= 1) {
    islePools(game, y);
    t.pool[tier] = (t.pool[tier] ?? 0) + isleWeekGrowth(game, y, tier);
  }
  game.holdings.touch();
  const s = h.owner.kind === 'player' ? game.sessionByAccount(h.owner.id) : undefined;
  if (!s) return;
  game.sendTo(s, { t: 'toast', msg: `${townName(id, j.level)} rises on ${isl.name}.`, kind: 'good' });
}

// ------------------------------------------------------------------------------------------------ the town hall

/** Each dawn: the town halls' silver into their islands' treasuries (the week of silver half as much again). */
export function hallsDay(game: Game, _day: number): void {
  const mul = weekHall(weekNow(game));
  let any = false;
  for (const h of Object.values(game.holdings.map(game))) {
    if (!h.owned || !h.yard?.town) continue;
    const lvl = townLevel(h.yard, 'hall');
    const grail = townLevel(h.yard, 'grail') > 0 ? GRAIL_SILVER : 0; // the Grail's silver (docs/17 H4)
    if (lvl <= 0 && !grail) continue;
    h.treasury += Math.round(HALL_INCOME[lvl] * mul) + grail;
    any = true;
  }
  if (any) game.holdings.touch();
}

export function hallDaily(game: Game, y: Yard): number {
  return Math.round(HALL_INCOME[townLevel(y, 'hall')] * weekHall(weekNow(game))) + (townLevel(y, 'grail') > 0 ? GRAIL_SILVER : 0);
}

// ------------------------------------------------------------------------------------------------ the market

type Side = GoodId | 'silver';

export function marketRates(game: Game, y: Yard): { level: number; sell: Partial<Record<GoodId, number>>; buy: Partial<Record<GoodId, number>> } | null {
  const level = townLevel(y, 'market');
  if (level <= 0) return null;
  const k = weekNow(game);
  const sell: Partial<Record<GoodId, number>> = {}, buy: Partial<Record<GoodId, number>> = {};
  for (const g of MARKET_GOODS) {
    sell[g] = Math.round(marketSell(g, level, weekSell(k)) * 100) / 100;
    buy[g] = Math.round(marketBuy(g, level, weekBuy(k)) * 100) / 100;
  }
  return { level, sell, buy };
}

/** Trade at the island's market: `n` of what is given (silver or a resource) for what it buys of the other. */
export function marketTrade(game: Game, s: PlayerSession, give: Side, get: Side, n: number): string | null {
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const { h, y } = m;
  const rates = marketRates(game, y);
  if (!rates) return 'The island has no market.';
  const ok = (x: Side) => x === 'silver' || MARKET_GOODS.includes(x);
  n = Math.floor(Number(n));
  if (!ok(give) || !ok(get) || give === get || !Number.isFinite(n) || n <= 0 || n > 1_000_000) return 'Bad order';
  const p = s.profile!;
  const near = lyingOff(game, s, h);
  if (give === 'silver') {
    const price = rates.buy[get as GoodId]!;
    const k = Math.floor(Math.min(n, p.gold) / price);
    if (k <= 0) return `Needs ${Math.ceil(price)} silver`;
    const cost = Math.ceil(k * price);
    p.gold -= cost;
    y.res[get as GoodId] = (y.res[get as GoodId] ?? 0) + k;
    game.db.ledger(s.accountId, 'isle_market', -cost, `${get}:${k}`);
    game.holdings.touch();
    game.sendTo(s, { t: 'toast', msg: `The market sells you ${k} ${GOODS[get as GoodId].name.toLowerCase()} for ${cost} silver.`, kind: 'good' });
    return null;
  }
  const lack = lacking(h, y, s, near, { [give]: n });
  if (lack) return lack;
  const value = n * rates.sell[give]!;
  if (get === 'silver') {
    const k = Math.floor(value);
    if (k <= 0) return 'The market will not trade so little.';
    takeGoods(h, y, s, near, { [give]: n });
    p.gold += k;
    game.db.ledger(s.accountId, 'isle_market', k, `${give}:${n}`);
    game.holdings.touch();
    game.sendTo(s, { t: 'toast', msg: `The market pays ${k} silver for ${n} ${GOODS[give].name.toLowerCase()}.`, kind: 'good' });
    return null;
  }
  const k = Math.floor(value / rates.buy[get]!);
  if (k <= 0) return 'The market will not trade so little.';
  takeGoods(h, y, s, near, { [give]: n });
  y.res[get] = (y.res[get] ?? 0) + k;
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: `The market takes ${n} ${GOODS[give].name.toLowerCase()} for ${k} ${GOODS[get].name.toLowerCase()}.`, kind: 'good' });
  return null;
}

// ------------------------------------------------------------------------------------------------ the guild of orders

/** Each floor's orders of her island's guild (docs/17 H5), whether she knows them, and why she may not learn one. */
function guildRows(game: Game, s: PlayerSession, h: Holding, y: Yard): NonNullable<TownThingView['orders']> {
  const p = s.profile!;
  const hero = heroOf(p);
  const near = lyingOff(game, s, h);
  const cap = orderLevelCap(p.level, rankOf(hero.skills, 'mysticism'));
  return isleGuildOrders(h.island, townLevel(y, 'guild')).flatMap((list, i) => list.map((id) => {
    const known = hero.orders.includes(id);
    const why = known ? null : ORDERS[id].level > cap ? `Orders of level ${ORDERS[id].level} are beyond you yet (Deep Mysticism or more levels open them)` : !near ? LIE_OFF : null;
    return { id, floor: i + 1, known, why };
  }));
}

const LIE_OFF = 'Lie off your island to learn at its guild.';

/** An order learnt at her island's guild of orders: free, as HoMM3's mage guild teaches its hero. */
export function learnAtIsle(game: Game, s: PlayerSession, id: string): string | null {
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const { h, y } = m;
  const floors = townLevel(y, 'guild');
  if (floors <= 0) return 'Your island has no guild of orders.';
  if (!isOrder(id) || !isleGuildOrders(h.island, floors).some((l) => l.includes(id))) return 'Your guild does not teach that order';
  if (!lyingOff(game, s, h)) return LIE_OFF;
  return learnOrder(game, s, id);
}

// ------------------------------------------------------------------------------------------------ what she sees

/** The resources to hand for the town: the yard with the store (and the hold lying off the island). */
export function townHave(game: Game, s: PlayerSession, h: Holding, y: Yard): Partial<Record<GoodId, number>> {
  const near = lyingOff(game, s, h);
  const out: Partial<Record<GoodId, number>> = {};
  for (const g of [...MARKET_GOODS, 'provisions'] as GoodId[]) out[g] = Math.floor((y.res[g] ?? 0) + (h.store[g] ?? 0) + (near ? (s.ship?.cargo[g] ?? 0) : 0));
  return out;
}

/** docs/18 #20: the pen's view on its card (set by beastlairs.ts). */
export const townHooks: { pen: ((game: Game, s: PlayerSession, y: Yard) => NonNullable<TownThingView['pen']>) | null } = { pen: null };

export function townView(game: Game, s: PlayerSession, h: Holding, y: Yard): TownView {
  const now = game.wallNow();
  const pools = islePools(game, y);
  const keep = townLevel(y, 'keep');
  const things = TOWN_IDS.map((id) => {
    const level = townLevel(y, id);
    const j = y.jobs.find((x) => x.what === `t:${id}`);
    const left = j ? Math.max(0, (j.end - now) / 1000) : 0;
    const next = level < TOWN[id].max ? { level: level + 1, ...townCost(id, level + 1), why: townWhy(game, s, h, y, id) } : null;
    const tier = TOWN[id].tier;
    return {
      id, level, max: TOWN[id].max, job: j ? { id: j.id, level: j.level, start: j.start, end: j.end, silver: speedupSilver(left), goods: speedupGoods(left) } : null, next,
      ...(tier ? { pool: Math.floor(pools[tier] ?? 0), growth: Math.round(isleWeekGrowth(game, y, tier) * 10) / 10 } : {}),
      ...(id === 'guild' && level > 0 ? { orders: guildRows(game, s, h, y) } : {}),
      ...(id === 'pen' && level > 0 && townHooks.pen ? { pen: townHooks.pen(game, s, y) } : {}),
    };
  });
  const have = townHave(game, s, h, y);
  const mines = ownMines(game, s);
  return {
    things, keep, growthMul: KEEP_GROWTH[keep], hall: hallDaily(game, y), mines, minesDaily: minesDailyOf(game, s.accountId),
    treasury: Math.floor(h.treasury), res: MARKET_GOODS.map((g) => ({ good: g, n: have[g] ?? 0 })), market: marketRates(game, y),
    deep: keepsDeep(s), near: lyingOff(game, s, h), week: weekView(game),
  };
}

/** For the admin and the tests: every town building at its greatest (or the given level), the pools full. */
export function adminTown(game: Game, s: PlayerSession, level?: number): string {
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const { h, y } = m;
  const t = townState(y);
  for (const id of TOWN_IDS) if (id !== 'grail') t.b[id] = Math.min(TOWN[id].max, level ?? TOWN[id].max); // the Grail is dug up, not raised by decree
  islePools(game, y);
  for (let tier = 1; tier <= 7; tier++) t.pool[tier] = poolCap(game, y, tier);
  reckonBase(game, h);
  game.holdings.touch();
  return `Town raised: ${TOWN_IDS.filter((id) => id !== 'grail').map((id) => `${id} ${t.b[id]}`).join(', ')}; the dwellings full (${TIER_UNIT.slice(1).map((u, i) => `${u} ${Math.floor(t.pool[i + 1])}`).join(', ')}).`;
}

