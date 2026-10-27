// Dwellings and recruiting (docs/17 H3 item 11): HoMM3's recruit window for the ship's army. A port keeps the
// dwellings of what it is (shared/src/data/town.ts): its tavern's waterfront is the first tier's — the same men the
// tavern signs on, at the tavern's price, so the old hiring and the new window draw on one pool — and its barracks,
// shooters' guild, gun foundry, veterans' den, admiralty and drowned shrine grow men week by week for every captain
// who calls (the first come take them). One's own island grows them in the dwellings of her town. The men go into the
// ship's stacks: a kind already aboard joins its stack, a new kind takes a free slot, and the hammocks (crewMax) are
// the limit. An upgraded dwelling trains a stack of its tier's plain kind up for the difference in price.

import { lackHammocks, lackMore, lackSlot } from '../../../shared/src/data/buyfail.ts';
import { BOSS_UNIT_IDS, BOSS_UNIT_NAMES } from '../../../shared/src/data/bossunits.ts';
import { TITAN_IDS, TITAN_NAMES } from '../../../shared/src/data/titans.ts';
import type { TitanId } from '../../../shared/src/data/titans.ts';
import type { BossUnitId } from '../../../shared/src/data/bossunits.ts';
import { FACTION_KIND_IDS, FACTION_NAMES } from '../../../shared/src/data/factionunits.ts';
import type { FactionKindId } from '../../../shared/src/data/factionunits.ts';
import { PREMIUM_BEAST_IDS, PREMIUM_PLURAL } from '../../../shared/src/data/premiumbeasts.ts';
import type { PremiumBeastId } from '../../../shared/src/data/premiumbeasts.ts';
import { SHIP_BEAST_IDS, SHIP_BEAST_PLURAL } from '../../../shared/src/data/shipbeasts.ts';
import type { ShipBeastId } from '../../../shared/src/data/shipbeasts.ts';
import { UNITS, armyWeight } from '../../../shared/src/data/army.ts';
import { recruitLift } from './throne.ts';
import { BEAST_PLURAL, CREATURE_IDS } from '../../../shared/src/data/bestiary.ts';
import type { CreatureId } from '../../../shared/src/data/bestiary.ts';
import type { ArmyStack, UnitId } from '../../../shared/src/data/army.ts';
import { PICKED_TIER, mightCap, mightRoom, POOL_WEEKS, TIER_SHIP_LEVEL, TIER_UNIT, pickedShare, UNIT_GOODS, dwellingOf, portDwellings, portGrowth, recruitPrice, upgradePrice, PORT_MARKUP } from '../../../shared/src/data/town.ts';
import type { Price } from '../../../shared/src/data/town.ts';
import { weekGrowth } from '../../../shared/src/data/week.ts';
import type { Profession } from '../../../shared/src/data/crew.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { DwellRow, DwellUp, DwellView } from '../../../shared/src/h3proto.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { lacking, lyingOff, mine as ownBase, takeGoods } from './base.ts';
import type { Yard } from './base.ts';
import { kindOfWeek, thisWeek, weekNow, weekView } from './calendar.ts';
import { recruitCost, reconcile } from './crew.ts';
import type { Game } from './Game.ts';
import type { Holding } from './holdings.ts';
import type { PlayerSession } from './player.ts';
import { islePools, isleWeekGrowth, keepsDeep, townHave, townLevel } from './town.ts';
import { DWELL_UP_LEVEL } from '../../../shared/src/data/isletree.ts';
import { freeCargo, jobCargo, questEvent } from './quests.ts'; // playthrough C: her jobs' cargo is not hers to spend
import { mooredAt } from './waystations.ts';
import { captainAdvice } from './armyadvice.ts';

// Owner, 2026-10-28: «качаешь остров — открываются новые бойцы рангом выше, нанимать можно в портах или плавучих
// портах. ключ — это остров». Her island's dwellings open their tiers in every port and at every floating waystation
// ('way'): the men are the island's own pool (a port's own dwelling of the tier adds its men), at the port's price.
type Src = 'port' | 'isle' | 'way';

/** The trade each tier's men are counted under in the company's pools (the tavern's professions). */
const POOL_OF: Profession[] = ['sailor', 'sailor', 'marine', 'gunner', 'gunner', 'marine', 'marine', 'sailor'];

// ------------------------------------------------------------------------------------------------ the ports' pools

interface PortPool {
  w: number;
  p: number[];
}

const KEY = 'h3:dwell';
const ports = new WeakMap<Game, { st: Record<string, PortPool>; dirty: boolean }>();

function portState(game: Game): { st: Record<string, PortPool>; dirty: boolean } {
  let x = ports.get(game);
  if (!x) {
    x = { st: game.db.getKv<Record<string, PortPool>>(KEY) ?? {}, dirty: false };
    ports.set(game, x);
  }
  return x;
}

export function saveDwellings(game: Game): void {
  const x = portState(game);
  if (!x.dirty) return;
  x.dirty = false;
  game.db.setKv(KEY, x.st);
}

const portCap = (game: Game, port: Port, tier: number) => POOL_WEEKS * portGrowth(tier, port.size) * Math.max(1, weekGrowth(weekNow(game), tier));

/** A port's pools grown to this week (a port first looked at opens with a week's men). */
export function portPools(game: Game, port: Port): number[] {
  const x = portState(game);
  const w = thisWeek(game);
  const tiers = portDwellings(port).map((d) => d.tier).filter((t) => t > 1);
  let e = x.st[port.id];
  if (!e) {
    e = x.st[port.id] = { w, p: [0, 0, 0, 0, 0, 0, 0, 0] };
    for (const t of tiers) e.p[t] = portGrowth(t, port.size) * weekGrowth(kindOfWeek(game, w), t);
    x.dirty = true;
  } else if (e.w < w) {
    for (let k = Math.max(e.w + 1, w - POOL_WEEKS + 1); k <= w; k++) {
      for (const t of tiers) e.p[t] = Math.min(portCap(game, port, t), (e.p[t] ?? 0) + portGrowth(t, port.size) * weekGrowth(kindOfWeek(game, k), t));
    }
    e.w = w;
    x.dirty = true;
  }
  return e.p;
}

// ------------------------------------------------------------------------------------------------ where she recruits

interface Here {
  src: Src;
  place: string;
  port: Port | null;
  h: Holding | null;
  y: Yard | null;
  /** tier → the upgraded kind too (and stacks trained up here) */
  dwell: Map<number, boolean>;
  why: string | null;
  /** Her island's yard (a port's or a waystation's tiers opened by it draw on its pools). */
  own: Yard | null;
  /** The tiers here opened by her island (2 and up), and the port's own among them. */
  remote: Set<number>;
  native: Set<number>;
}

/** Her island's dwellings, as the tiers they open (tier → the upgraded kind too). */
function isleDwell(y: Yard): Map<number, boolean> {
  const dwell = new Map<number, boolean>();
  for (let t = 1; t <= 7; t++) {
    const L = townLevel(y, dwellingOf(t));
    if (L > 0) dwell.set(t, L >= DWELL_UP_LEVEL); // docs/29: the upgraded kind from the dwelling's third level
  }
  return dwell;
}

/** The tiers her island opens far from it (the hands are every tavern's and every waystation's own). */
function remoteOf(game: Game, s: PlayerSession): { y: Yard; dwell: Map<number, boolean> } | null {
  const m = ownBase(game, s);
  if (typeof m === 'string') return null;
  const dwell = isleDwell(m.y);
  dwell.delete(1);
  return { y: m.y, dwell };
}

function here(game: Game, s: PlayerSession, src: Src): Here | string {
  const ship = s.ship;
  if (!ship) return 'No ship';
  if (src === 'port') {
    const port = ship.docked ? game.portById(ship.docked) : undefined;
    if (!port) return 'You must be in port';
    const dwell = new Map(portDwellings(port).map((d) => [d.tier, d.up]));
    const native = new Set(dwell.keys());
    const r = remoteOf(game, s);
    const remote = new Set<number>();
    if (r) for (const [t, up] of r.dwell) {
      remote.add(t);
      dwell.set(t, (dwell.get(t) ?? false) || up);
    }
    return { src, place: port.name, port, h: null, y: null, dwell, why: null, own: r?.y ?? null, remote, native };
  }
  if (src === 'way') {
    const w = mooredAt(game, s);
    if (!w) return 'Moor at a floating waystation first.';
    const r = remoteOf(game, s);
    if (!r) return 'You have no island of your own.';
    return { src, place: w.kind, port: null, h: null, y: null, dwell: r.dwell, why: null, own: r.y, remote: new Set(r.dwell.keys()), native: new Set() };
  }
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const { h, y, isl } = m;
  const dwell = isleDwell(y);
  const why = lyingOff(game, s, h) ? null : 'Bring your ship to the island to take the men aboard.';
  return { src, place: isl.name, port: null, h, y, dwell, why, own: y, remote: new Set(), native: new Set(dwell.keys()) };
}

/** Far from the island (a port, a waystation): the port's price, the hold's resources. */
const far = (at: Here) => at.src !== 'isle';

function poolsOf(game: Game, at: Here): number[] {
  const own = at.own && at.remote.size ? islePools(game, at.own) : null;
  if (at.port) {
    const p = [...portPools(game, at.port)];
    p[1] = Math.floor(game.tavernCrew.get(at.port.id) ?? 0);
    for (let t = 2; t <= 7; t++) p[t] = (at.native.has(t) ? p[t] ?? 0 : 0) + (own && at.remote.has(t) ? own[t] ?? 0 : 0);
    return p;
  }
  if (at.src === 'way') return [0, 0, ...[2, 3, 4, 5, 6, 7].map((t) => (own && at.remote.has(t) ? own[t] ?? 0 : 0))];
  return islePools(game, at.y!);
}

function growthOf(game: Game, at: Here, tier: number): number {
  const own = at.own && at.remote.has(tier) ? isleWeekGrowth(game, at.own, tier) : 0;
  if (at.port) return tier === 1 ? 0 : (at.native.has(tier) ? portGrowth(tier, at.port.size) * weekGrowth(weekNow(game), tier) : 0) + own;
  if (at.src === 'way') return own;
  return isleWeekGrowth(game, at.y!, tier);
}

/** Silver a man of a kind here: a port's tavern asks its own price for its deckhands (half as much again for seasoned
 *  sailors); the rest what the man is worth, a quarter more in a port. */
function perMan(game: Game, s: PlayerSession, at: Here, u: UnitId): number {
  if (at.port && UNITS[u].tier === 1) {
    const base = recruitCost(game, at.port, s.profile!, 'sailor', s.ship);
    return u === 'sailor' ? Math.round(base * 1.5) : base;
  }
  return UNITS[u].cost * (far(at) ? PORT_MARKUP : 1);
}

function priceOf(game: Game, s: PlayerSession, at: Here, u: UnitId, n: number): Price {
  const p = recruitPrice(u, n, far(at));
  if (at.port && UNITS[u].tier === 1) p.silver = Math.round(n * perMan(game, s, at, u));
  const off = recruitLift(s.profile); // docs/19 E2: the Merchant's recruiter's purse
  if (off > 0) p.silver = Math.round(p.silver * (1 - off));
  return p;
}

function have(game: Game, s: PlayerSession, at: Here): Partial<Record<GoodId, number>> {
  if (at.h && at.y) return townHave(game, s, at.h, at.y);
  const out: Partial<Record<GoodId, number>> = {};
  for (const g of Object.keys(s.ship?.cargo ?? {}) as GoodId[]) out[g] = Math.floor(freeCargo(s, g));
  return out;
}

function lack(game: Game, s: PlayerSession, at: Here, goods: Partial<Record<GoodId, number>>): string | null {
  if (at.h && at.y) return lacking(at.h, at.y, s, lyingOff(game, s, at.h), goods);
  const owed = jobCargo(s.profile);
  for (const [g, n] of Object.entries(goods) as [GoodId, number][]) {
    if (freeCargo(s, g) >= n) continue;
    // (what her jobs carry is not hers to spend, and she is told so)
    return owed[g] ? `The hold lacks ${Math.ceil(n - freeCargo(s, g))} ${GOODS[g].name.toLowerCase()}: ${owed[g]} of it is a job's cargo.` : `The hold lacks ${Math.ceil(n - freeCargo(s, g))} ${GOODS[g].name.toLowerCase()}.`;
  }
  return null;
}

function take(game: Game, s: PlayerSession, at: Here, goods: Partial<Record<GoodId, number>>): void {
  if (at.h && at.y) return takeGoods(at.h, at.y, s, lyingOff(game, s, at.h), goods);
  const hold = s.ship!.cargo;
  for (const [g, n] of Object.entries(goods) as [GoodId, number][]) {
    hold[g] = (hold[g] ?? 0) - n;
    if ((hold[g] ?? 0) <= 0) delete hold[g];
  }
}

/** docs/19 E10: goods paid at her island as its recruit window pays them (its store, and her hold lying off it): why
 *  not (null: paid). */
export function islePay(game: Game, s: PlayerSession, goods: Partial<Record<GoodId, number>>, pay: boolean): string | null {
  const at = here(game, s, 'isle');
  if (typeof at === 'string') return at;
  const why = lack(game, s, at, goods);
  if (why || !pay) return why;
  take(game, s, at, goods);
  return null;
}

function busy(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  if (!ship.alive) return 'Not now';
  if (ship.boarding || ship.grappled) return 'Not in the middle of a boarding';
  if (!ship.docked && ship.underFire(game.now)) return 'Not while under fire';
  if (s.profile!.company.mutiny) return 'The crew holds the ship: nobody signs on now';
  return null;
}

// ------------------------------------------------------------------------------------------------ recruiting

/** Men of a kind into the ship's army from the dwelling here. */
export function recruit(game: Game, s: PlayerSession, src: Src, u: UnitId, want: number): string | null {
  const at = here(game, s, src);
  if (typeof at === 'string') return at;
  if (at.why) return at.why;
  const b = busy(game, s);
  if (b) return b;
  const d = UNITS[u];
  if (!d) return 'Unknown kind of man';
  const up = at.dwell.get(d.tier);
  if (up === undefined) return 'No dwelling of theirs here.';
  if (d.up && !up) return 'Only an upgraded dwelling trains those.';
  if (d.deep && !keepsDeep(s)) return 'Only a captain of the Choir or of a cursed ship keeps the drowned.';
  const ship = s.ship!;
  const p = s.profile!;
  if (ship.shipLevel < TIER_SHIP_LEVEL[d.tier]) return tierWhy(d.tier);
  const pools = poolsOf(game, at);
  const picked = d.tier >= PICKED_TIER ? pickedRoom(s) : Infinity;
  // Owner, 2026-10-28: the hands go ashore to make room for better men (a full hold of deckhands hired nothing).
  const swap = swapOf(ship.army, d.tier);
  const might = mightRoom(swap ? sansHands(ship.army) : ship.army, u, ship.shipLevel, ship.stats.crewMax, ship.armySlots);
  const free = ship.stats.crewMax - ship.crew;
  const n = Math.min(Math.floor(Number(want)), Math.floor(pools[d.tier] ?? 0), free + swap, picked, might);
  if (!Number.isFinite(n) || n <= 0) {
    if (ship.crew >= ship.stats.crewMax && !swap) return lackHammocks(1, ship.crew, ship.stats.crewMax);
    if (picked <= 0) return `A ship of level ${ship.shipLevel} berths ${pickedMax(s)} picked men (tier 4 and up) at most.`;
    if (might <= 0) return mightWhy(ship.shipLevel);
    return 'Nobody waiting in that dwelling this week.';
  }
  const ashore = Math.max(0, n - Math.max(0, free));
  const after = ashore > 0 ? sendAshore(ship.army, ashore) : ship.army;
  if (!after.some((x) => x.u === u) && after.length >= ship.armySlots) return lackSlot(after.length, ship.armySlots);
  const price = priceOf(game, s, at, u, n);
  const l = lack(game, s, at, price.goods);
  if (l) return l;
  if (p.gold < price.silver) return lackMore(`Needs ${price.silver} silver`, price.silver, p.gold);
  p.gold -= price.silver;
  take(game, s, at, price.goods);
  game.db.ledger(s.accountId, 'recruit', -price.silver, `${src}:${u}:${n}`);
  if (ashore > 0) {
    ship.setArmy(after);
    ship.companyKey = '';
  }
  // Taken from the pool: the tavern's waterfront, the port's dwelling, the island's (her island's from afar: the
  // port's own dwelling first).
  if (at.port && d.tier === 1) game.tavernCrew.set(at.port.id, Math.max(0, (game.tavernCrew.get(at.port.id) ?? 0) - n));
  else if (at.port || at.src === 'way') {
    let rest = n;
    if (at.port && at.native.has(d.tier)) {
      const e = portState(game);
      const had = portPools(game, at.port)[d.tier] ?? 0;
      const k = Math.min(rest, Math.floor(had));
      e.st[at.port.id].p[d.tier] = Math.max(0, had - k);
      e.dirty = true;
      rest -= k;
    }
    if (rest > 0 && at.own && at.remote.has(d.tier)) {
      const pool = islePools(game, at.own);
      pool[d.tier] = Math.max(0, (pool[d.tier] ?? 0) - rest);
      game.holdings.touch();
    }
  } else {
    at.y!.town!.pool[d.tier] = Math.max(0, (at.y!.town!.pool[d.tier] ?? 0) - n);
    game.holdings.touch();
  }
  signOn(game, s, u, n);
  game.toastShip(ship, ashore > 0 ? `${n} ${plural(u, n)} sign on for ${price.silver} silver; ${ashore} hands go ashore to make room.` : `${n} ${plural(u, n)} sign on for ${price.silver} silver.`, 'good');
  questEvent(game, s, { k: 'recruit', n }); // docs/36: men signed on (the campaign's step)
  return null;
}

/** The hands (tier 1) aboard who may go ashore for men of `tier` (2 and up) when the hammocks are full. */
const isHand = (u: UnitId) => UNITS[u]?.tier === 1 && !UNITS[u].beast;
export function swapOf(army: readonly ArmyStack[], tier: number): number {
  return tier >= 2 ? army.filter((x) => isHand(x.u)).reduce((a, x) => a + x.n, 0) : 0;
}
/** The army without its hands (the might cap counts the empty hammocks as deckhands: the same weight). */
export const sansHands = (army: readonly ArmyStack[]): ArmyStack[] => army.filter((x) => !isHand(x.u)).map((x) => ({ ...x }));
/** `n` hands ashore: the deckhands first, then the seasoned sailors, then any other hands (a copy). */
export function sendAshore(army: readonly ArmyStack[], n: number): ArmyStack[] {
  const out = army.map((x) => ({ ...x }));
  const order = (x: ArmyStack) => (x.u === 'deckhand' ? 0 : x.u === 'sailor' ? 1 : 2);
  for (const x of [...out].filter((y) => isHand(y.u)).sort((a, b) => order(a) - order(b))) {
    if (n <= 0) break;
    const k = Math.min(n, x.n);
    x.n -= k;
    n -= k;
  }
  return out.filter((x) => x.n > 0);
}

/** Picked men (tier 4 and up) she may still berth, and at most. */
export const pickedMax = (s: PlayerSession): number => Math.floor(s.ship!.stats.crewMax * pickedShare(s.ship!.shipLevel));
export function pickedRoom(s: PlayerSession): number {
  const aboard = s.ship!.army.filter((x) => UNITS[x.u].tier >= PICKED_TIER).reduce((a, x) => a + x.n, 0);
  return Math.max(0, pickedMax(s) - aboard);
}

/** The picked men's might cap (docs/17 H5): her army is as strong as a ship of her level carries. */
const mightWhy = (level: number) => `Your crew is as strong as a ship of level ${level} carries: raise her level for better men.`;

/** How many more men of a kind her army's might has room for (the cap of docs/17 H5). */
export function mightLeft(s: PlayerSession, u: UnitId, from?: UnitId): number {
  const ship = s.ship!;
  return mightRoom(ship.army, u, ship.shipLevel, ship.stats.crewMax, ship.armySlots, from);
}

const tierWhy = (tier: number) => `Men of tier ${tier} serve a ship of level ${TIER_SHIP_LEVEL[tier]} and up.`;

const NAMES: Record<UnitId, string> = {
  deckhand: 'deckhands', sailor: 'seasoned sailors', marine: 'marines', sea_guard: 'sea guards', musketeer: 'musketeers', sharpshooter: 'sharpshooters',
  gunner: 'gunners', bombardier: 'bombardiers', boarder: 'boarders', cutthroat: 'cutthroats', guard: 'officers’ guards', life_guard: 'life guards',
  drowned: 'drowned', deep_spawn: 'spawn of the deep',
  ...(Object.fromEntries(CREATURE_IDS.map((b) => [b, BEAST_PLURAL[b][0]])) as Record<CreatureId, string>), // docs/18 II, IV
  ...(Object.fromEntries(FACTION_KIND_IDS.map((k) => [k, FACTION_NAMES[k][0].toLowerCase()])) as Record<FactionKindId, string>), // the world's armies
  ...(Object.fromEntries(PREMIUM_BEAST_IDS.map((k) => [k, PREMIUM_PLURAL[k][0]])) as Record<PremiumBeastId, string>), // the shop's creatures
  ...(Object.fromEntries(SHIP_BEAST_IDS.map((u) => [u, SHIP_BEAST_PLURAL[u][0]])) as Record<ShipBeastId, string>), // the premium hulls' own (docs/02 §1.A.9)
  ...(Object.fromEntries(BOSS_UNIT_IDS.map((k) => [k, BOSS_UNIT_NAMES[k].name[0]])) as Record<BossUnitId, string>), // the great ones ashore (never hired)
  ...(Object.fromEntries(TITAN_IDS.map((k) => [k, TITAN_NAMES[k].name[0]])) as Record<TitanId, string>), // docs/19 E10: the titans
};
const plural = (u: UnitId, _n: number) => NAMES[u];

/** New men aboard: into their stack, their trade's pool; they bring the morale and the loyalty of the newly signed,
 *  and the veterancy of their tier. */
function signOn(game: Game, s: PlayerSession, u: UnitId, n: number): void {
  const ship = s.ship!;
  const c = s.profile!.company;
  reconcile(game, c, ship.crew);
  const d = UNITS[u];
  const total = ship.crew + n;
  ship.morale = (ship.morale * ship.crew + 62 * n) / total;
  c.loyalty = (c.loyalty * ship.crew + 50 * n) / total;
  c.skill = (c.skill * ship.crew + Math.min(4.5, 1.5 + 0.4 * d.tier + (d.up ? 0.3 : 0)) * n) / total;
  if (n > ship.crew * 0.2) c.fights = 0;
  ship.addMen(u, n);
  c.pools[POOL_OF[d.tier]] += n;
  s.profile!.stats.recruited = (s.profile!.stats.recruited ?? 0) + n;
  ship.companyKey = '';
}

/** Train `want` men of a stack's plain kind into its upgrade (the upgraded dwelling of its tier). */
export function train(game: Game, s: PlayerSession, src: Src, u: UnitId, want: number): string | null {
  const at = here(game, s, src);
  if (typeof at === 'string') return at;
  if (at.why) return at.why;
  const b = busy(game, s);
  if (b) return b;
  const d = UNITS[u];
  if (!d || !d.upgrade) return 'They cannot be trained further.';
  if (!at.dwell.get(d.tier)) return 'Only an upgraded dwelling trains those.';
  const to = d.upgrade;
  if (UNITS[to].deep && !keepsDeep(s)) return 'Only a captain of the Choir or of a cursed ship keeps the drowned.';
  const ship = s.ship!;
  const stack = ship.army.find((x) => x.u === u);
  const might = mightRoom(ship.army, to, ship.shipLevel, ship.stats.crewMax, ship.armySlots, u);
  const n = Math.min(Math.floor(Number(want)), stack?.n ?? 0, might);
  if (stack && might <= 0) return mightWhy(ship.shipLevel);
  if (!stack || !Number.isFinite(n) || n <= 0) return 'None of them aboard.';
  if (n < stack.n && !ship.army.some((x) => x.u === to) && ship.army.length >= ship.armySlots) return lackSlot(ship.army.length, ship.armySlots);
  const price = upgradePrice(u, n, far(at))!;
  const l = lack(game, s, at, price.goods);
  if (l) return l;
  const p = s.profile!;
  if (p.gold < price.silver) return lackMore(`Needs ${price.silver} silver`, price.silver, p.gold);
  p.gold -= price.silver;
  take(game, s, at, price.goods);
  game.db.ledger(s.accountId, 'train', -price.silver, `${src}:${u}:${n}`);
  const army: ArmyStack[] = ship.army.map((x) => ({ ...x }));
  const own = army.find((x) => x.u === u)!;
  own.n -= n;
  const up = army.find((x) => x.u === to);
  if (up) up.n += n;
  else if (own.n <= 0) {
    own.u = to;
    own.n = n;
  } else army.push({ u: to, n });
  ship.setArmy(army.filter((x) => x.n > 0));
  ship.companyKey = '';
  game.toastShip(ship, `${n} ${NAMES[u]} trained up into ${NAMES[to]} for ${price.silver} silver.`, 'good');
  return null;
}

// ------------------------------------------------------------------------------------------------ the window

/** docs/18 #20: the island's recruit window takes the grown kinds of her town's pen too (set by beastlairs.ts). */
export const dwellHooks: { isleRows: ((game: Game, s: PlayerSession) => DwellRow[]) | null } = { isleRows: null };

export function dwellView(game: Game, s: PlayerSession, src: Src): DwellView | null {
  const at = here(game, s, src);
  if (typeof at === 'string') return null;
  const ship = s.ship!;
  const pools = poolsOf(game, at);
  const deep = keepsDeep(s);
  const rows: DwellRow[] = [];
  for (const [tier, up] of [...at.dwell].sort((a, b) => a[0] - b[0])) {
    const base = TIER_UNIT[tier];
    const kinds: UnitId[] = up ? [base, UNITS[base].upgrade!] : [base];
    const swap = swapOf(ship.army, tier);
    rows.push({
      tier, name: at.port && tier === 1 ? 'tavern' : dwellingOf(tier), up, pool: Math.floor(pools[tier] ?? 0), growth: Math.round(growthOf(game, at, tier) * 10) / 10,
      units: kinds.map((u) => { const room = mightRoom(swap ? sansHands(ship.army) : ship.army, u, ship.shipLevel, ship.stats.crewMax, ship.armySlots); return { u, per: Math.round(perMan(game, s, at, u) * 100) / 100, goods: UNIT_GOODS[u] ?? {}, room: Number.isFinite(room) ? room : -1 }; }),
      why: UNITS[base].deep && !deep ? 'Only a captain of the Choir or of a cursed ship keeps the drowned.' : ship.shipLevel < TIER_SHIP_LEVEL[tier] ? tierWhy(tier) : null,
      ...(at.remote.has(tier) ? { isle: true } : {}), ...(swap ? { swap } : {}),
    });
  }
  if (src === 'isle' && dwellHooks.isleRows) rows.push(...dwellHooks.isleRows(game, s));
  const ups: DwellUp[] = [];
  for (const x of ship.army) {
    const d = UNITS[x.u];
    if (!d.upgrade || !at.dwell.get(d.tier)) continue;
    if (UNITS[d.upgrade].deep && !deep) continue;
    const one = upgradePrice(x.u, 1, far(at))!;
    const per = (UNITS[d.upgrade].cost - d.cost) * (far(at) ? PORT_MARKUP : 1);
    const goods: Partial<Record<GoodId, number>> = {};
    for (const g of Object.keys(one.goods) as GoodId[]) goods[g] = Math.max(0, (UNIT_GOODS[d.upgrade]?.[g] ?? 0) - (UNIT_GOODS[x.u]?.[g] ?? 0));
    ups.push({ u: x.u, to: d.upgrade, n: x.n, per, goods, room: Math.min(x.n, mightLeft(s, d.upgrade, x.u)) });
  }
  return {
    src, place: at.place, rows, ups, army: ship.army.map((x) => ({ ...x })), slots: ship.armySlots, crew: ship.crew, crewMax: ship.stats.crewMax,
    gold: Math.floor(s.profile!.gold), have: have(game, s, at), why: at.why ?? busy(game, s), week: weekView(game), picked: pickedRoom(s), pickedMax: pickedMax(s),
    might: Math.round(armyWeight(ship.army)), mightMax: Math.round(mightCap(ship.shipLevel, ship.stats.crewMax, ship.armySlots)),
    best: captainAdvice(game, s)?.best ?? null,
  };
}

/** For the admin: the dwellings here and on her island full (two weeks' men). */
export function adminDwell(game: Game, s: PlayerSession, arg: string): string {
  const out: string[] = [];
  const ship = s.ship!;
  const port = ship.docked ? game.portById(ship.docked) : undefined;
  if (port) {
    const p = portPools(game, port);
    if (arg === 'fill') {
      for (const d of portDwellings(port)) if (d.tier > 1) p[d.tier] = portCap(game, port, d.tier);
      game.tavernCrew.set(port.id, Math.max(game.tavernCrew.get(port.id) ?? 0, 60));
      portState(game).dirty = true;
    }
    out.push(`${port.name}: ${portDwellings(port).map((d) => `${TIER_UNIT[d.tier]}${d.up ? '+' : ''} ${d.tier === 1 ? Math.floor(game.tavernCrew.get(port.id) ?? 0) : Math.floor(p[d.tier])}`).join(', ')}`);
  }
  const m = ownBase(game, s);
  if (typeof m !== 'string') {
    const pools = islePools(game, m.y);
    if (arg === 'fill') for (let t = 1; t <= 7; t++) if (townLevel(m.y, dwellingOf(t)) > 0) pools[t] = POOL_WEEKS * isleWeekGrowth(game, m.y, t);
    game.holdings.touch();
    out.push(`${m.isl.name}: ${[1, 2, 3, 4, 5, 6, 7].filter((t) => townLevel(m.y, dwellingOf(t)) > 0).map((t) => `${TIER_UNIT[t]} ${Math.floor(pools[t])}`).join(', ') || 'no dwellings'}`);
  }
  if (!out.length) return 'No dwellings here: dock in a port or build them on your island.';
  return arg === 'fill' ? 'The dwellings here and on your island are full: two weeks of men.' : `Dwellings — ${out.join(' · ')}.`;
}
