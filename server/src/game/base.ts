// One's own island as a base (docs/15_PERSONAL_ISLAND.md, items 1–3). The island bought outright (estate.ts) is laid
// out in plots by its level; each plot takes a building of the island (holdings.ts, which keeps working as before)
// or a producer that works the land by the island's biome. Building and raising a level take real time, reckoned on
// the wall clock and kept with the holding: one crew of builders, a second at a set island level. The work can be
// finished now for silver or provisions by the time left, or shortened a quarter of an hour by a free token (the
// daily welcome, the daily orders). Producers yield by the hour, also while their owner is away, into the island's
// yard up to its caps (the island's level and its warehouse widen them); the yard, then the island's store, then
// the hold of a ship lying off the island pay for the building.

import {
  BASE_RES, BIOME_YIELD, PLOT_CELLS, PRODUCERS, TOKEN_MAX, TOKEN_SECS, baseCost, crewsAt, isProducer, levelGate, maxLevel, nextCrewAt, plotsOf, producerFits,
  producerLimit, producerOf, producerRate, speedupGoods, speedupSilver, yardCap,
} from '../../../shared/src/data/base.ts';
import type { BaseRes, ProducerKind } from '../../../shared/src/data/base.ts';
import { ISLE_LEVELS, ISLE_MAX } from '../../../shared/src/data/estate.ts';
import { BUILDINGS, islandSize } from '../../../shared/src/data/holdings.ts';
import type { BuildingId } from '../../../shared/src/data/holdings.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { BaseCellView, BaseView } from '../../../shared/src/protocol.ts';
import { ISLE_POWER, POWER_CREW, islePower } from '../../../shared/src/data/baseships.ts';
import { finishShipJob, ownYardView } from './baseships.ts';
import type { OwnShip } from './baseships.ts';
import { isleLevelWhy } from './estate.ts';
import { claimView } from './baseclaim.ts';
import { gyardView } from './guildyard.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { ownIsland } from './estate.ts';
import { has, island, islandNear, slotsOf, slotsUsed } from './holdings.ts';
import type { Building, Holding } from './holdings.ts';
import type { PlayerSession, Profile } from './player.ts';
import { finishTown, townView } from './town.ts';
import type { TownState } from './town.ts';
import { townOf } from '../../../shared/src/data/town.ts';

const HOUR = 3_600_000;
/** Production is reckoned for three days at most at once (the yard is full long before). */
const MAX_HOURS = 72;

export interface Producer {
  kind: ProducerKind;
  plot: number;
  level: number;
}

export interface BaseJob {
  id: number;
  plot: number;
  /** A BuildingId or 'p:<producer>'. */
  what: string;
  /** The level it is raised to (1: founded). */
  level: number;
  start: number;
  end: number;
  /** The shipyard's work on one of her own ships (docs/15 item 4): no plot (-1), no builders' crew. */
  ship?: string;
  kind?: 'build' | 'upgrade' | 'repair';
}

export interface Yard {
  res: Partial<Record<GoodId, number>>;
  /** Fractions of a unit not yet whole. */
  carry: Partial<Record<GoodId, number>>;
  /** Yielded since the owner last collected (the bubbles over the producers). */
  fresh: Partial<Record<GoodId, number>>;
  producers: Producer[];
  jobs: BaseJob[];
  lastYield: number;
  seq: number;
  /** Her own ships of the island's shipyard (docs/15 item 4). */
  ships?: OwnShip[];
  /** The town of the Heroes over the base (docs/17 H3 item 13). */
  town?: TownState;
}

// ------------------------------------------------------------------------------------------------ the yard

export function yardOf(game: Game, h: Holding): Yard {
  h.yard ??= { res: {}, carry: {}, fresh: {}, producers: [], jobs: [], lastYield: game.wallNow(), seq: 1 };
  const y = h.yard;
  y.res ??= {};
  y.carry ??= {};
  y.fresh ??= {};
  y.producers ??= [];
  y.jobs ??= [];
  y.seq ??= 1;
  y.ships ??= [];
  placeLoose(game, h, y);
  return y;
}

/** Buildings raised before the plots (or by the old ways) take the first free plots. */
function placeLoose(game: Game, h: Holding, y: Yard): void {
  const n = plotCount(game, h);
  const taken = new Set<number>();
  for (const p of y.producers) taken.add(p.plot);
  for (const j of y.jobs) if (!y.producers.some((p) => p.plot === j.plot) && !h.buildings.some((b) => b.plot === j.plot)) taken.add(j.plot);
  const loose: Building[] = [];
  for (const b of h.buildings) {
    if (b.plot === undefined || b.plot < 0 || b.plot >= n || taken.has(b.plot)) loose.push(b);
    else taken.add(b.plot);
  }
  for (const b of loose) {
    let k = 0;
    while (k < n && taken.has(k)) k++;
    if (k >= n) {
      b.plot = undefined;
      continue;
    }
    b.plot = k;
    taken.add(k);
  }
}

export function plotCount(game: Game, h: Holding): number {
  const isl = island(game, h.island);
  return plotsOf(h.level ?? 1, isl ? islandSize(isl.radius) : 'small');
}

function warehouseLevel(h: Holding): number {
  const b = has(h, 'warehouse');
  return b ? Math.max(1, b.level ?? 1) : 0;
}

export function capOf(h: Holding): number {
  return yardCap(h.level ?? 1, warehouseLevel(h));
}

/** The yard's yield by the hour of each resource. */
export function ratesOf(h: Holding, isl: Island): Partial<Record<GoodId, number>> {
  const out: Partial<Record<GoodId, number>> = {};
  for (const p of h.yard?.producers ?? []) {
    const g = PRODUCERS[p.kind].good;
    out[g] = (out[g] ?? 0) + producerRate(p.kind, p.level, isl.biome);
  }
  return out;
}

/** The producers at work from the last reckoning to `to`, into the yard up to its cap. */
function produce(h: Holding, y: Yard, isl: Island, to: number): void {
  const hours = Math.min(MAX_HOURS, Math.max(0, (to - y.lastYield) / HOUR));
  y.lastYield = Math.max(y.lastYield, to);
  if (hours <= 0) return;
  const cap = capOf(h);
  for (const [g, rate] of Object.entries(ratesOf(h, isl)) as [GoodId, number][]) {
    const have = y.res[g] ?? 0;
    if (have >= cap) {
      y.carry[g] = 0;
      continue;
    }
    const sum = (y.carry[g] ?? 0) + rate * hours;
    const whole = Math.floor(sum);
    const k = Math.min(whole, cap - have);
    y.carry[g] = k < whole ? 0 : sum - whole;
    if (k > 0) {
      y.res[g] = have + k;
      y.fresh[g] = (y.fresh[g] ?? 0) + k;
    }
  }
}

/** Bring the island up to the wall clock: work finished in its order, production in between. */
export function reckonBase(game: Game, h: Holding): void {
  if (!h.owned) return;
  const isl = island(game, h.island);
  if (!isl) return;
  const y = yardOf(game, h);
  const now = game.wallNow();
  if (y.lastYield > now) y.lastYield = now; // a clock set back
  const due = y.jobs.filter((j) => j.end <= now).sort((a, b) => a.end - b.end || a.id - b.id);
  for (const j of due) {
    produce(h, y, isl, Math.max(y.lastYield, j.end));
    finish(game, h, y, isl, j);
  }
  const before = y.lastYield;
  produce(h, y, isl, now);
  if (due.length || y.lastYield !== before) game.holdings.touch();
}

function finish(game: Game, h: Holding, y: Yard, isl: Island, j: BaseJob): void {
  y.jobs = y.jobs.filter((x) => x.id !== j.id);
  if (j.ship) return finishShipJob(game, h, y, isl, j);
  if (townOf(j.what)) return finishTown(game, h, y, isl, j);
  const kind = producerOf(j.what);
  let name = '';
  if (kind) {
    const p = y.producers.find((x) => x.plot === j.plot && x.kind === kind);
    if (j.level <= 1 && !p) y.producers.push({ kind, plot: j.plot, level: 1 });
    else if (p) p.level = Math.max(p.level, j.level);
    else return;
    name = PRODUCERS[kind].name[0];
  } else {
    const id = j.what as BuildingId;
    const b = h.buildings.find((x) => x.plot === j.plot && x.id === id);
    if (j.level <= 1 && !b) h.buildings.push({ id, condition: 1, unpaid: false, plot: j.plot, level: 1 });
    else if (b) b.level = Math.max(b.level ?? 1, j.level);
    else return; // pulled down while it was being raised
    name = BUILDINGS[id].name;
  }
  game.holdings.touch();
  const s = h.owner.kind === 'player' ? game.sessionByAccount(h.owner.id) : undefined;
  if (!s) return;
  if (j.level <= 1) game.sendTo(s, { t: 'toast', msg: `The ${name.toLowerCase()} on ${isl.name} is finished.`, kind: 'good' });
  else game.sendTo(s, { t: 'toast', msg: `${name} on ${isl.name}: level ${j.level}.`, kind: 'good' });
  game.sendTo(s, { t: 'base', view: baseView(game, s) });
}

// ------------------------------------------------------------------------------------------------ plots

type Occupant = { b: Building } | { p: Producer } | { j: BaseJob } | null;

function occupant(h: Holding, y: Yard, plot: number): Occupant {
  const b = h.buildings.find((x) => x.plot === plot);
  if (b) return { b };
  const p = y.producers.find((x) => x.plot === plot);
  if (p) return { p };
  const j = y.jobs.find((x) => x.plot === plot && x.level <= 1);
  return j ? { j } : null;
}

function whatOf(o: Occupant): string | null {
  if (!o) return null;
  if ('b' in o) return o.b.id;
  if ('p' in o) return `p:${o.p.kind}`;
  return o.j.what;
}

function freePlot(game: Game, h: Holding, y: Yard): number | null {
  const n = plotCount(game, h);
  for (let k = 0; k < n; k++) if (!occupant(h, y, k)) return k;
  return null;
}

// ------------------------------------------------------------------------------------------------ paying

/** What is to hand for a cost: the yard, the island's store, and the hold of a ship lying off the island. */
function stock(h: Holding, y: Yard, s: PlayerSession, near: boolean, g: GoodId): number {
  return (y.res[g] ?? 0) + (h.store[g] ?? 0) + (near ? (s.ship?.cargo[g] ?? 0) : 0);
}

export function lacking(h: Holding, y: Yard, s: PlayerSession, near: boolean, goods: Partial<Record<GoodId, number>>): string | null {
  const lack = (Object.entries(goods) as [GoodId, number][]).filter(([g, n]) => stock(h, y, s, near, g) < n);
  if (!lack.length) return null;
  const [g, n] = lack[0];
  return `The yard lacks ${Math.ceil(n - stock(h, y, s, near, g))} ${GOODS[g].name.toLowerCase()}.`;
}

export function takeGoods(h: Holding, y: Yard, s: PlayerSession, near: boolean, goods: Partial<Record<GoodId, number>>): void {
  for (const [g, n0] of Object.entries(goods) as [GoodId, number][]) {
    let n = n0;
    const from = (bag: Partial<Record<GoodId, number>>) => {
      const k = Math.min(n, bag[g] ?? 0);
      if (k <= 0) return;
      bag[g] = (bag[g] ?? 0) - k;
      if (!bag[g]) delete bag[g];
      n -= k;
    };
    from(y.res);
    if (n > 0) from(h.store);
    if (n > 0 && near && s.ship) from(s.ship.cargo);
  }
}

export function lyingOff(game: Game, s: PlayerSession, h: Holding): boolean {
  return !!s.ship && islandNear(game, s.ship)?.id === h.island;
}

export function mine(game: Game, s: PlayerSession): { h: Holding; y: Yard; isl: Island } | string {
  const h = ownIsland(game, s.accountId);
  const isl = h ? island(game, h.island) : undefined;
  if (!h || !isl) return 'You have no island of your own.';
  reckonBase(game, h);
  return { h, y: yardOf(game, h), isl };
}

// ------------------------------------------------------------------------------------------------ what may be raised

/** Why a plot may not take this thing now (null: it may). */
function whyNot(h: Holding, y: Yard, isl: Island, what: string): string | null {
  const lvl = h.level ?? 1;
  const kind = producerOf(what);
  if (kind) {
    if (!producerFits(kind, isl.biome)) return 'The island’s land does not bear it.';
    const n = y.producers.filter((p) => p.kind === kind).length + y.jobs.filter((j) => j.what === what && j.level <= 1).length;
    if (n >= producerLimit(lvl)) return `The island keeps ${producerLimit(lvl)} of these at its level.`;
    return null;
  }
  const id = what as BuildingId;
  const def = BUILDINGS[id];
  if (!def) return 'Unknown building';
  const pending = y.jobs.filter((j) => j.level <= 1 && !isProducer(j.what));
  if (id !== 'battery' && (has(h, id) || pending.some((j) => j.what === id))) return `${isl.name} already has a ${def.name.toLowerCase()}`;
  const used = slotsUsed(h) + pending.reduce((a, j) => a + (BUILDINGS[j.what as BuildingId]?.slots ?? 0), 0);
  if (used + def.slots > slotsOf(isl, h)) return `No room: ${isl.name} has ${slotsOf(isl, h)} slots`;
  if (def.needs && !has(h, def.needs)) return `Needs a ${BUILDINGS[def.needs].name.toLowerCase()} first`;
  if (def.notSafe && REGIONS[isl.region].safety === 'safe') return 'Not on the Crown’s own coast';
  if (def.feature === 'mine' && !isl.features.includes('mine')) return 'There is no ore in this rock';
  if (def.biomes && !def.biomes.includes(isl.biome)) return 'Nothing like that grows here';
  return null;
}

/** The island's power (docs/15 item 5): its buildings' and producers' levels, and three times each ship's of its own
 *  that is afloat (a laid-up hull counts nothing until she is mended). */
export function powerOf(h: Holding): number {
  const things = [...h.buildings.map((b) => b.level ?? 1), ...(h.yard?.producers ?? []).map((p) => p.level), ...Object.values(h.yard?.town?.b ?? {}).filter((n) => (n ?? 0) > 0) as number[]];
  const ships = (h.yard?.ships ?? []).filter((x) => x.state !== 'building' && x.state !== 'laid_up').map((x) => x.level);
  return islePower(things, ships);
}

/** The builders' crews: by the island's level, and one more for an island of great power. */
export function crewsOf(h: Holding): number {
  return crewsAt(h.level ?? 1, powerOf(h) >= POWER_CREW ? 1 : 0);
}

/** The builders' work (the shipwrights' on her ships is apart). */
export function buildersBusy(y: Yard): number {
  return y.jobs.filter((j) => !j.ship).length;
}

export function crewFree(h: Holding, y: Yard): string | null {
  return buildersBusy(y) >= crewsOf(h) ? 'All your builders are at work.' : null;
}

/** Lay a thing on a plot (null: the first free plot). */
export function startBuild(game: Game, s: PlayerSession, plot: number | null, what: string): string | null {
  const m = mine(game, s);
  if (typeof m === 'string') return m;
  const { h, y, isl } = m;
  if (!isProducer(what) && !BUILDINGS[what as BuildingId]) return 'Unknown building';
  const at = plot === null ? freePlot(game, h, y) : Math.trunc(plot);
  if (at === null || !Number.isFinite(at) || at < 0 || at >= plotCount(game, h)) return 'No free plot on the island.';
  if (occupant(h, y, at)) return 'That plot is taken.';
  const why = whyNot(h, y, isl, what) ?? crewFree(h, y);
  if (why) return why;
  return pay(game, s, h, y, at, what, 1);
}

function pay(game: Game, s: PlayerSession, h: Holding, y: Yard, plot: number, what: string, level: number): string | null {
  const p = s.profile!;
  const cost = baseCost(what, level);
  const near = lyingOff(game, s, h);
  const lack = lacking(h, y, s, near, cost.goods);
  if (lack) return lack;
  if (p.gold < cost.silver) return `Needs ${cost.silver} silver`;
  p.gold -= cost.silver;
  takeGoods(h, y, s, near, cost.goods);
  game.db.ledger(s.accountId, 'isle_base', -cost.silver, `${h.island}:${what}:${level}`);
  const now = game.wallNow();
  y.jobs.push({ id: y.seq++, plot, what, level, start: now, end: now + cost.secs * 1000 });
  game.holdings.touch();
  return null;
}

/** Pay a cost from the purse and the yard (null: paid), as the builders' work does. */
export function payCost(game: Game, s: PlayerSession, h: Holding, y: Yard, cost: { silver: number; goods: Partial<Record<GoodId, number>> }, tag: string): string | null {
  const p = s.profile!;
  const near = lyingOff(game, s, h);
  const lack = lacking(h, y, s, near, cost.goods);
  if (lack) return lack;
  if (p.gold < cost.silver) return `Needs ${cost.silver} silver`;
  p.gold -= cost.silver;
  takeGoods(h, y, s, near, cost.goods);
  game.db.ledger(s.accountId, 'isle_ship', -cost.silver, `${h.island}:${tag}`);
  game.holdings.touch();
  return null;
}

/** Raise the thing on a plot a level. */
export function upgradeAt(game: Game, s: PlayerSession, plot: number): string | null {
  const m = mine(game, s);
  if (typeof m === 'string') return m;
  const { h, y } = m;
  const o = occupant(h, y, Math.trunc(plot));
  if (!o) return 'Nothing stands there.';
  if ('j' in o) return 'The builders are already at work there.';
  const what = whatOf(o)!;
  const level = 'b' in o ? (o.b.level ?? 1) : o.p.level;
  if (y.jobs.some((j) => j.plot === Math.trunc(plot))) return 'The builders are already at work there.';
  if (level >= maxLevel(what)) return 'It is at its greatest';
  const gate = levelGate(level + 1);
  if ((h.level ?? 1) < gate) return `Raise the island to level ${gate} first.`;
  const busy = crewFree(h, y);
  if (busy) return busy;
  return pay(game, s, h, y, Math.trunc(plot), what, level + 1);
}

/** Move what stands on a plot to a free one (the work on it moves too). */
export function moveTo(game: Game, s: PlayerSession, plot: number, to: number): string | null {
  const m = mine(game, s);
  if (typeof m === 'string') return m;
  const { h, y } = m;
  const from = Math.trunc(plot), dest = Math.trunc(to);
  if (!Number.isFinite(dest) || dest < 0 || dest >= plotCount(game, h)) return 'No such plot.';
  const o = occupant(h, y, from);
  if (!o) return 'Nothing stands there.';
  if (from === dest) return null;
  if (occupant(h, y, dest)) return 'That plot is taken.';
  if ('b' in o) o.b.plot = dest;
  else if ('p' in o) o.p.plot = dest;
  for (const j of y.jobs) if (j.plot === from) j.plot = dest;
  game.holdings.touch();
  return null;
}

/** Finish the work now (silver, provisions) or a quarter of an hour sooner (a token). */
export function speedup(game: Game, s: PlayerSession, jobId: number, payWith: string): string | null {
  const m = mine(game, s);
  if (typeof m === 'string') return m;
  const { h, y } = m;
  const p = s.profile!;
  const j = y.jobs.find((x) => x.id === Math.trunc(jobId));
  if (!j) return 'That work is done.';
  const now = game.wallNow();
  const left = Math.max(0, (j.end - now) / 1000);
  if (payWith === 'token') {
    if ((p.speedups ?? 0) <= 0) return 'No speed-up tokens left.';
    p.speedups = (p.speedups ?? 0) - 1;
    j.end = Math.max(now, j.end - TOKEN_SECS * 1000);
  } else if (payWith === 'res') {
    const goods = speedupGoods(left);
    const near = lyingOff(game, s, h);
    const lack = lacking(h, y, s, near, goods);
    if (lack) return lack;
    takeGoods(h, y, s, near, goods);
    j.end = now;
  } else if (payWith === 'silver') {
    const price = speedupSilver(left);
    if (p.gold < price) return `Needs ${price} silver`;
    p.gold -= price;
    game.db.ledger(s.accountId, 'isle_speedup', -price, `${h.island}:${j.what}`);
    j.end = now;
  } else return 'Unknown order';
  game.holdings.touch();
  reckonBase(game, h);
  return null;
}

/** The yard's yield since the last look, taken in (the producers' bubbles). */
export function collectYard(game: Game, s: PlayerSession): string | null {
  const m = mine(game, s);
  if (typeof m === 'string') return m;
  const { y } = m;
  const n = Object.values(y.fresh).reduce((a, x) => a + (x ?? 0), 0);
  y.fresh = {};
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: n > 0 ? `Into the island’s yard: ${n} units.` : 'Nothing new in the yard yet.', kind: n > 0 ? 'good' : 'info' });
  return null;
}

// ------------------------------------------------------------------------------------------------ tokens

/** Free speed-up tokens (the daily welcome, the daily orders), to twenty at most. */
export function grantSpeedups(p: Profile, n: number): number {
  const before = p.speedups ?? 0;
  p.speedups = Math.max(0, Math.min(TOKEN_MAX, before + n));
  return p.speedups - before;
}

// ------------------------------------------------------------------------------------------------ what she sees

export function baseView(game: Game, s: PlayerSession): BaseView | null {
  const h = ownIsland(game, s.accountId);
  const isl = h ? island(game, h.island) : undefined;
  if (!h || !isl) return null;
  reckonBase(game, h);
  const y = yardOf(game, h);
  const p = s.profile!;
  const lvl = Math.max(1, Math.min(ISLE_MAX, h.level ?? 1));
  const size = islandSize(isl.radius);
  const n = plotCount(game, h);
  const now = game.wallNow();
  const cap = capOf(h);
  const rates = ratesOf(h, isl);
  const busy = crewFree(h, y);
  const power = powerOf(h);
  const jobView = (j: BaseJob) => {
    const left = Math.max(0, (j.end - now) / 1000);
    return { id: j.id, level: j.level, start: j.start, end: j.end, silver: speedupSilver(left), goods: speedupGoods(left) };
  };
  const cells: BaseCellView[] = [];
  for (let k = 0; k < n; k++) {
    const o = occupant(h, y, k);
    const what = whatOf(o);
    const job = y.jobs.find((j) => j.plot === k && !j.ship) ?? null;
    const level = !o ? 0 : 'b' in o ? (o.b.level ?? 1) : 'p' in o ? o.p.level : 0;
    let up: BaseCellView['up'] = null;
    if (what && o && !('j' in o) && level < maxLevel(what)) {
      const c = baseCost(what, level + 1);
      const gate = levelGate(level + 1);
      const why = job ? 'The builders are already at work there.' : lvl < gate ? `Raise the island to level ${gate} first.` : busy;
      up = { ...c, level: level + 1, why };
    }
    const kind = what ? producerOf(what) : null;
    cells.push({
      plot: k, what, level, condition: o && 'b' in o ? Math.round(o.b.condition * 100) / 100 : 1, unpaid: !!(o && 'b' in o && o.b.unpaid),
      job: job ? jobView(job) : null, up,
      fresh: kind && o && 'p' in o ? Math.floor(y.fresh[PRODUCERS[kind].good] ?? 0) : 0,
      idle: !!(kind && o && 'p' in o && (y.res[PRODUCERS[kind].good] ?? 0) >= cap),
    });
  }
  const locked: { plot: number; level: number }[] = [];
  for (let k = n; k < PLOT_CELLS.length; k++) {
    let at = 0;
    for (let l = lvl + 1; l <= ISLE_MAX; l++) if (plotsOf(l, size) > k) {
      at = l;
      break;
    }
    locked.push({ plot: k, level: at });
  }
  const catalog: BaseView['catalog'] = [];
  for (const kind of Object.keys(PRODUCERS) as ProducerKind[]) {
    const what = `p:${kind}`;
    catalog.push({ what, ...baseCost(what, 1), why: whyNot(h, y, isl, what) });
  }
  // What stands in the way of each thing itself (the crews at work are the window's to show, over the whole list).
  for (const id of Object.keys(BUILDINGS) as BuildingId[]) catalog.push({ what: id, ...baseCost(id, 1), why: whyNot(h, y, isl, id) });
  return {
    island: h.island, name: isl.name, biome: isl.biome, level: lvl, levelName: ISLE_LEVELS[lvl].name[0], size, plots: n, locked, cells,
    store: BASE_RES.map((g: BaseRes) => ({ good: g, n: Math.floor(y.res[g] ?? 0), cap, rate: Math.round((rates[g] ?? 0) * 10) / 10 })),
    crews: { n: crewsOf(h), busy: buildersBusy(y), next: nextCrewAt(lvl) },
    speedups: p.speedups ?? 0, tokenSecs: TOKEN_SECS, catalog,
    slots: { used: slotsUsed(h), total: slotsOf(isl, h) },
    now, near: lyingOff(game, s, h),
    power: { now: power, need: lvl < ISLE_MAX ? ISLE_POWER[lvl + 1] : null, crew: POWER_CREW, crewHas: power >= POWER_CREW },
    levelUp: lvl < ISLE_MAX ? {
      level: lvl + 1, silver: ISLE_LEVELS[lvl + 1].silver, goods: ISLE_LEVELS[lvl + 1].goods, secs: 0, treasury: h.treasury, power: ISLE_POWER[lvl + 1],
      why: isleLevelWhy(h),
    } : null,
    shipyard: ownYardView(game, s, h, y),
    claim: claimView(game, s, h),
    guildYard: game.guilds.of(game, s.accountId) ? gyardView(game, s) : null,
    town: townView(game, s, h, y),
  };
}

/** For tests and the admin: how rich the island's biome is. */
export function biomeYield(isl: Island): Record<BaseRes, number> {
  return BIOME_YIELD[isl.biome];
}
