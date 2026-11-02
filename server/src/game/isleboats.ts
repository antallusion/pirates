// «Шлюпы с острова» (owner, 2026-11-02; the numbers and the reasons in shared/src/data/islandboats.ts). Far from her
// island she opens its hire window (src 'boat'): the men of its dwellings at the island's own prices, the yard and the
// store paying the resources; what she picks goes into the boats and «Отправить шлюпы» sends them.
//
//  - Asked: an island of her own with its town hall; at sea (not in port — the tavern hires her island's men there — not
//    lying off the island, where she takes them aboard herself), not in a boarding, not under fire, no mutiny; no trip
//    under way and the hall's wait since the last one over; the trip's load (the hall's kinds and men), each kind's
//    dwelling built (its upgrade for the upgraded kind), her ship's level for the tier, the men waiting, room aboard for
//    all of them together (roomIn: the hammocks, the hands who would row back, the picked men's berths, the might cap,
//    a slot), the purse and the island's resources. Paid once, at the sending: the men's price and the fee; the men leave
//    the dwellings' pools then.
//  - The trip: the boats put out from the island's shore on her side and run her down at BOAT_MUL × her hull's top
//    speed, the way planned round the land (nav.ts findPath, again every 2 s and when she has moved), carried in steps of
//    STEP metres each sounded for land (a step onto land turned aside). Nobody can touch them: they are no ship of the
//    sea, only her own HUD's (PrivateState.boats).
//  - Within ARRIVE_M of her hull (PORT_M of her berth in port) they come alongside: the men sign on as a hire (dwell.ts
//    signOn — the stacks merged by the army's rules, the gift stacks untouched); the hands make room as at a hire (they
//    row back to the island). What no longer fits (she hired elsewhere since) goes back to the dwellings, its silver and
//    resources back. A boarding, her ship lost: they lie by till she is free.
//  - Kept in her save (profile.isleBoats: the men, what was paid, the boats' place and the wall clock of it): a restart
//    or her logging off holds nothing up — at her return the boats are carried on by the time gone (and come alongside
//    at once if it was enough).

import { NAV_CELL, SPEED_SCALE } from '../../../shared/src/constants.ts';
import { ARRIVE_M, PORT_M, boatCooldown, boatCount, boatFee, boatFeeShare, boatMen, boatSpeed, boatStacks, boatsClock } from '../../../shared/src/data/islandboats.ts';
import type { BoatsInfo, BoatsView } from '../../../shared/src/data/islandboats.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../../shared/src/data/army.ts';
import { TIER_SHIP_LEVEL, recruitPrice } from '../../../shared/src/data/town.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { lackMore } from '../../../shared/src/data/buyfail.ts';
import type { DwellView } from '../../../shared/src/h3proto.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { lacking, lyingOff, mine as ownBase, takeGoods, yardOf } from './base.ts';
import type { Yard } from './base.ts';
import { busy, dwellView, isleDwell, menName, roomFor, roomIn, sendAshore, signOn } from './dwell.ts';
import { ownIsland } from './estate.ts';
import { findPath } from './nav.ts';
import { recruitLift } from './throne.ts';
import { questEvent } from './quests.ts';
import { isleFirstHire } from './islefirst.ts';
import { islePools, keepsDeep, townLevel } from './town.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** A trip in her save. */
export interface BoatsRec {
  /** The men aboard the boats, each kind with what was paid for it. */
  units: { u: UnitId; n: number; silver: number; goods: Partial<Record<GoodId, number>> }[];
  fee: number;
  hall: number;
  /** m/s */
  v: number;
  boats: number;
  /** The island they put out from. */
  isle: number;
  /** Their place, and the wall clock (ms) it was reckoned at. */
  x: number;
  y: number;
  at: number;
  /** The wall clock (ms) they put out at. */
  started: number;
}

/** The tests' eye on every step the boats take (null: none). */
export const boatsHooks: { trace: ((x: number, y: number) => void) | null } = { trace: null };

/** Her trip's live reckoning forgotten (the tests' restart: the save alone is left). */
export function forgetBoats(game: Game): void {
  liveOf(game).clear();
}

/** The longest step of the boats (metres): a tick's way at ×14 is cut into these, each sounded for land. */
export const STEP = 8;
/** The way ahead planned again this often (s), and at once when she has moved this far from its end (m). */
const REPLAN_S = 2;
const REPLAN_M = 200;
/** Off the land by this (m) where the boats put out. */
const SHORE_OFF = 40;

interface Live {
  path: [number, number][];
  i: number;
  planAt: number;
  tx: number;
  ty: number;
  /** World seconds: the trip carried on here from (its start or her return), and the latest the boats may take. */
  since: number;
  until: number;
  wait: boolean;
}

const lives = new WeakMap<Game, Map<number, Live>>();
function liveOf(game: Game): Map<number, Live> {
  let m = lives.get(game);
  if (!m) lives.set(game, (m = new Map()));
  return m;
}

/** Her hull's top speed, m/s. */
export const shipTop = (ship: ShipEntity): number => ship.stats.maxSpeed * SPEED_SCALE;
const hallOf = (y: Yard): number => townLevel(y, 'hall');

/** The trip under way (tests). */
export const boatsRec = (s: PlayerSession): BoatsRec | null => s.profile?.isleBoats ?? null;

// ------------------------------------------------------------------------------------------------ may they go

/** Seconds until the island's boats may put out again (0: now). */
export function boatsReadyIn(game: Game, s: PlayerSession, hall: number): number {
  const at = s.profile?.isleBoatsAt;
  if (!at) return 0;
  return Math.max(0, Math.ceil((at + boatCooldown(hall) * 1000 - game.wallNow()) / 1000));
}

/** Why the island's boats may not be loaded now (null: they may). */
export function boatsWhy(game: Game, s: PlayerSession): string | null {
  const ship = s.ship;
  if (!ship || !s.profile) return 'No ship';
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const hall = hallOf(m.y);
  if (hall < 1) return 'Raise the town hall on your island first: its boats carry the men.';
  if (ship.docked) return 'In port the tavern hires your island\'s men: no boats needed.';
  if (lyingOff(game, s, m.h)) return 'You lie off your island: take the men aboard from its dwellings.';
  const b = busy(game, s);
  if (b) return b;
  if (s.profile.isleBoats) return 'The island\'s boats are already on their way to you.';
  const wait = boatsReadyIn(game, s, hall);
  if (wait > 0) return `The island's boats put out again in ${boatsClock(wait)}.`;
  return null;
}

/** Where the boats put out: the island's shore on her side (off the land by SHORE_OFF), else round it. */
export function launchPoint(game: Game, isl: Island, tx: number, ty: number): [number, number] {
  const w = game.world;
  const base = Math.atan2(ty - isl.y, tx - isl.x);
  for (const off of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 1.9, -1.9, 2.5, -2.5, Math.PI]) {
    const a = base + off;
    const cx = Math.cos(a), cy = Math.sin(a);
    for (let r = 10; r < isl.radius * 2.5 + 400; r += 15) {
      const x = isl.x + cx * r, y = isl.y + cy * r;
      if (isLand(w, x, y)) continue;
      const px = x + cx * SHORE_OFF, py = y + cy * SHORE_OFF;
      if (!isLand(w, px, py) && !isLand(w, px + cx * 20, py + cy * 20)) return [px, py];
      break;
    }
  }
  return [isl.x + Math.cos(base) * (isl.radius + 200), isl.y + Math.sin(base) * (isl.radius + 200)];
}

/** The hire window's boats' line: the hall's load, way, fee and wait. */
export function boatsInfo(game: Game, s: PlayerSession): BoatsInfo | null {
  const ship = s.ship;
  const m = ownBase(game, s);
  if (!ship || typeof m === 'string') return null;
  const hall = Math.max(1, hallOf(m.y));
  const v = boatSpeed(hall, shipTop(ship));
  const from = launchPoint(game, m.isl, ship.state.x, ship.state.y);
  const km = Math.hypot(ship.state.x - from[0], ship.state.y - from[1]) / 1000;
  return {
    hall, level: ship.shipLevel, stacks: boatStacks(hall), men: boatMen(hall, ship.stats.crewMax), boats: boatCount(hall), mul: Math.round((v / Math.max(1, shipTop(ship))) * 10) / 10,
    v: Math.round(v), km: Math.round(km * 10) / 10, eta: Math.round((km * 1000) / v), fee: Math.round(boatFeeShare(hall, km) * 1000) / 1000,
    cooldown: boatCooldown(hall), readyIn: boatsReadyIn(game, s, hall), busy: !!s.profile?.isleBoats,
  };
}

/** Her island's hire window from afar, loading the boats: its dwellings' men at the island's prices. */
export function boatsDwellView(game: Game, s: PlayerSession): DwellView | null {
  const v = dwellView(game, s, 'isle');
  const info = boatsInfo(game, s);
  if (!v || !info) return null;
  // (her dwellings only: the pen's creatures and the titans are not for the boats; nothing trained up from afar)
  return { ...v, src: 'boat', rows: v.rows.filter((r) => /^dw\d$/.test(r.name)), ups: [], why: boatsWhy(game, s), boat: info };
}

// ------------------------------------------------------------------------------------------------ sending them

/** «Отправить шлюпы»: the men loaded into the island's boats and sent to her. Null, or why not. */
export function sendBoats(game: Game, s: PlayerSession, picks: readonly { u: UnitId; n: number }[]): string | null {
  const why = boatsWhy(game, s);
  if (why) return why;
  const ship = s.ship!;
  const p = s.profile!;
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const { h, y, isl } = m;
  const hall = hallOf(m.y);
  // the kinds as one each, whole men
  const want = new Map<UnitId, number>();
  for (const x of Array.isArray(picks) ? picks : []) {
    const u = String(x?.u) as UnitId;
    const n = Math.floor(Number(x?.n));
    if (!UNITS[u]) return 'Unknown kind of man';
    if (!Number.isFinite(n) || n <= 0) continue;
    want.set(u, (want.get(u) ?? 0) + n);
  }
  if (!want.size) return 'Pick the men for the boats first.';
  if (want.size > boatStacks(hall)) return `The boats carry ${boatStacks(hall)} kinds of men at your town hall's level.`;
  const men = [...want.values()].reduce((a, n) => a + n, 0);
  const cap = boatMen(hall, ship.stats.crewMax);
  if (men > cap) return `The boats carry ${cap} men at your town hall's level.`;
  const dwell = isleDwell(y);
  const pools = islePools(game, y);
  const left = [...pools];
  let army: ArmyStack[] = ship.army.map((x) => ({ ...x }));
  const units: BoatsRec['units'] = [];
  const goods: Partial<Record<GoodId, number>> = {};
  let silver = 0;
  const off = recruitLift(p); // the Merchant's recruiter's purse, as at a hire
  for (const [u, n] of want) {
    const d = UNITS[u];
    const up = dwell.get(d.tier);
    if (up === undefined || d.beast || d.titan) return 'No dwelling of theirs on your island.';
    if (d.up && !up) return 'Only an upgraded dwelling trains those.';
    if (d.deep && !keepsDeep(s)) return 'Only a captain of the Choir or of a cursed ship keeps the drowned.';
    if (ship.shipLevel < TIER_SHIP_LEVEL[d.tier]) return `Men of tier ${d.tier} serve a ship of level ${TIER_SHIP_LEVEL[d.tier]} and up.`;
    if (Math.floor(left[d.tier] ?? 0) < n) return 'Not that many men wait in the dwelling this week.';
    left[d.tier] = (left[d.tier] ?? 0) - n;
    const room = roomIn(army, ship.shipLevel, ship.stats.crewMax, ship.armySlots, u);
    if (room < n) return 'No room aboard for them all: the hammocks, the stacks or the crew\'s might.';
    const free = Math.max(0, ship.stats.crewMax - army.reduce((a, x) => a + x.n, 0));
    if (n > free) army = sendAshore(army, n - free);
    const own = army.find((x) => x.u === u && !x.g);
    if (own) own.n += n;
    else army.push({ u, n });
    const price = recruitPrice(u, n, false);
    if (off > 0) price.silver = Math.round(price.silver * (1 - off));
    silver += price.silver;
    for (const [g, k] of Object.entries(price.goods) as [GoodId, number][]) goods[g] = (goods[g] ?? 0) + k;
    units.push({ u, n, silver: price.silver, goods: price.goods });
  }
  const from = launchPoint(game, isl, ship.state.x, ship.state.y);
  const km = Math.hypot(ship.state.x - from[0], ship.state.y - from[1]) / 1000;
  const fee = boatFee(hall, km, silver);
  const l = lacking(h, y, s, false, goods);
  if (l) return l;
  if (p.gold < silver + fee) return lackMore(`Needs ${silver + fee} silver`, silver + fee, p.gold);
  // paid once, here
  p.gold -= silver + fee;
  takeGoods(h, y, s, false, goods);
  game.db.ledger(s.accountId, 'recruit', -(silver + fee), `boats:${units.map((x) => `${x.u}:${x.n}`).join(',')}:fee${fee}`);
  for (const x of units) pools[UNITS[x.u].tier] = Math.max(0, (pools[UNITS[x.u].tier] ?? 0) - x.n);
  game.holdings.touch();
  const v = boatSpeed(hall, shipTop(ship));
  const now = game.wallNow();
  p.isleBoats = { units, fee, hall, v, boats: boatCount(hall), isle: isl.id, x: from[0], y: from[1], at: now, started: now };
  p.isleBoatsAt = now;
  startLive(game, s, p.isleBoats);
  game.sendTo(s, { t: 'toast', msg: `The island's boats put out with ${men} men: about ${boatsClock((km * 1000) / v)} to you.`, kind: 'info' });
  game.log(`[boats] ${s.name} ${units.map((x) => `${x.n} ${x.u}`).join(', ')} hall ${hall} ${Math.round(km * 1000)} m at ${Math.round(v)} m/s, ${silver}+${fee} silver`);
  return null;
}

function startLive(game: Game, s: PlayerSession, rec: BoatsRec): Live {
  const ship = s.ship!;
  const d = Math.hypot(ship.state.x - rec.x, ship.state.y - rec.y);
  const lv: Live = { path: [], i: 0, planAt: -Infinity, tx: ship.state.x, ty: ship.state.y, since: game.now, until: game.now + 3 * (d / rec.v) + 120, wait: false };
  liveOf(game).set(s.accountId, lv);
  plan(game, rec, lv, ship);
  return lv;
}

/** The way ahead from the boats to her: straight when the water is clear, else round the land. */
function plan(game: Game, rec: BoatsRec, lv: Live, ship: ShipEntity): void {
  const tx = ship.state.x, ty = ship.state.y;
  lv.planAt = game.now;
  lv.tx = tx;
  lv.ty = ty;
  lv.i = 0;
  if (clearRun(game, rec.x, rec.y, tx, ty)) {
    lv.path = [[tx, ty]];
    return;
  }
  const p = findPath(game.world, rec.x, rec.y, tx, ty, 60000);
  lv.path = p && p.length > 1 ? p.slice(1) : [[tx, ty]];
}

/** No land on the straight run (sounded every STEP × 2). */
function clearRun(game: Game, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d > NAV_CELL * 20) return false; // (a long run is planned: the sounding would cost more than the plan)
  const n = Math.ceil(d / (STEP * 2));
  for (let k = 1; k <= n; k++) if (isLand(game.world, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n)) return false;
  return true;
}

/** One step of the boats toward (tx, ty), turned aside from the land; false: no water anywhere ahead. */
function stepTo(game: Game, rec: BoatsRec, tx: number, ty: number, step: number): boolean {
  const d = Math.hypot(tx - rec.x, ty - rec.y);
  if (d <= 1e-6) return true;
  const k = Math.min(step, d);
  const a = Math.atan2(ty - rec.y, tx - rec.x);
  for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, 2.2, -2.2, 2.7, -2.7]) {
    const x = rec.x + Math.cos(a + off) * k, y = rec.y + Math.sin(a + off) * k;
    if (isLand(game.world, x, y)) continue;
    rec.x = x;
    rec.y = y;
    boatsHooks.trace?.(x, y);
    return true;
  }
  return false;
}

/** Carried `dist` metres along the way ahead, in steps of STEP each sounded for land. */
function carry(game: Game, rec: BoatsRec, lv: Live, dist: number, stopAt: { x: number; y: number; r: number }): void {
  let left = dist;
  while (left > 1e-6 && lv.i < lv.path.length) {
    if (Math.hypot(stopAt.x - rec.x, stopAt.y - rec.y) <= stopAt.r) return;
    const [qx, qy] = lv.path[lv.i];
    const d = Math.hypot(qx - rec.x, qy - rec.y);
    if (d < 4) {
      lv.i++;
      continue;
    }
    const k = Math.min(STEP, left);
    const before = Math.hypot(qx - rec.x, qy - rec.y);
    if (!stepTo(game, rec, qx, qy, k)) {
      lv.planAt = -Infinity;
      return;
    }
    left -= k;
    // turned aside and losing the mark: the way planned again from here
    if (Math.hypot(qx - rec.x, qy - rec.y) > before - k * 0.2) lv.planAt = Math.min(lv.planAt, game.now - REPLAN_S + 0.5);
  }
}

// ------------------------------------------------------------------------------------------------ each tick

/** Each tick: the boats under way carried on, and alongside her the men aboard. */
export function stepIsleBoats(game: Game, dt: number): void {
  const live = liveOf(game);
  for (const s of game.sessions) {
    const rec = s.profile?.isleBoats;
    if (!rec) continue;
    const ship = s.ship;
    if (s.disconnectedAt !== null || !ship) {
      live.delete(s.accountId);
      continue;
    }
    const lv = live.get(s.accountId) ?? resume(game, s, rec);
    const wall = game.wallNow();
    const r = ship.docked ? PORT_M : ARRIVE_M + ship.cls.length / 2;
    const tx = ship.state.x, ty = ship.state.y;
    lv.wait = !ship.alive || !!ship.boarding || !!ship.grappled || ship.boardAlly !== null;
    if (Math.hypot(tx - rec.x, ty - rec.y) > r) {
      if (game.now - lv.planAt >= REPLAN_S || Math.hypot(tx - lv.tx, ty - lv.ty) > REPLAN_M || lv.i >= lv.path.length) plan(game, rec, lv, ship);
      carry(game, rec, lv, rec.v * dt, { x: tx, y: ty, r });
      rec.at = wall;
    }
    const near = Math.hypot(tx - rec.x, ty - rec.y) <= r;
    // (lost on the way past all reason: they find her all the same — the men paid for are never lost)
    if ((near || game.now > lv.until) && !lv.wait) arrive(game, s, rec);
  }
}

/** Back at the helm (her return, a restart): the boats carried on from their last place by the time gone, along the
 *  way planned afresh, step by sounded step (the men never wait for nothing: the time gone counts). */
function resume(game: Game, s: PlayerSession, rec: BoatsRec): Live {
  const ship = s.ship!;
  const gone = Math.max(0, (game.wallNow() - rec.at) / 1000);
  const lv = startLive(game, s, rec);
  if (gone > 0) {
    const r = ship.docked ? PORT_M : ARRIVE_M + ship.cls.length / 2;
    carry(game, rec, lv, Math.min(rec.v * gone, 200_000), { x: ship.state.x, y: ship.state.y, r });
    rec.at = game.wallNow();
    plan(game, rec, lv, ship);
  }
  return lv;
}

/** Alongside: the men aboard as a hire; what no longer fits back to the island, its price back. */
function arrive(game: Game, s: PlayerSession, rec: BoatsRec): void {
  const ship = s.ship!;
  const p = s.profile!;
  liveOf(game).delete(s.accountId);
  p.isleBoats = null;
  const h = ownIsland(game, s.accountId);
  const y = h && h.island === rec.isle ? yardOf(game, h) : null;
  const pools = y ? islePools(game, y) : null;
  const came: [number, string][] = [];
  const hired: [number, number][] = [];
  let back = 0, refund = 0;
  for (const x of rec.units) {
    const k = Math.min(x.n, roomFor(s, x.u));
    if (k > 0) {
      const free = Math.max(0, ship.stats.crewMax - ship.crew);
      if (k > free) {
        // the hands make room as at a hire: they row back to the island in the boats
        const ashore = k - free;
        ship.setArmy(sendAshore(ship.army, ashore));
        ship.companyKey = '';
        if (pools) pools[1] = (pools[1] ?? 0) + ashore;
      }
      signOn(game, s, x.u, k);
      hired.push([k, UNITS[x.u].tier]);
      came.push([k, menName(x.u)]);
    }
    if (k < x.n) {
      const rest = x.n - k;
      back += rest;
      const part = rest / x.n;
      const silver = Math.floor(x.silver * part);
      refund += silver;
      if (pools) pools[UNITS[x.u].tier] = (pools[UNITS[x.u].tier] ?? 0) + rest;
      if (y) for (const [g, n] of Object.entries(x.goods) as [GoodId, number][]) y.res[g] = (y.res[g] ?? 0) + Math.floor(n * part);
    }
  }
  if (refund > 0) {
    p.gold += refund;
    game.db.ledger(s.accountId, 'recruit', refund, 'boats:back');
  }
  game.holdings.touch();
  if (came.length) game.sendTo(s, { t: 'toast', msg: alongside(came), kind: 'good' });
  // a hire as any other (after the boats' own word): the campaign's step, the island's first steps («Наймите морпехов»)
  for (const [n, tier] of hired) {
    questEvent(game, s, { k: 'recruit', n });
    isleFirstHire(game, s, tier);
  }
  if (back > 0) game.sendTo(s, { t: 'toast', msg: `No room aboard for ${back} of them: they row back to the island, ${refund} silver returned.`, kind: 'info' });
  game.pushSelf(s, true);
}


/** «Шлюпы с острова пришвартовались: …» — each kind's men and name its own part (the client's words translate them). */
function alongside(c: [number, string][]): string {
  const [[a, an], [b, bn] = [0, ''], [d, dn] = [0, '']] = c;
  if (c.length >= 3) return `The island's boats come alongside: ${a} ${an}, ${b} ${bn} and ${d} ${dn}.`;
  if (c.length === 2) return `The island's boats come alongside: ${a} ${an} and ${b} ${bn}.`;
  return `The island's boats come alongside: ${a} ${an}.`;
}

// ------------------------------------------------------------------------------------------------ her HUD

/** The boats under way for her HUD (null: none). */
export function boatsView(game: Game, s: PlayerSession): BoatsView | null {
  const rec = s.profile?.isleBoats;
  const ship = s.ship;
  if (!rec || !ship) return null;
  const lv = liveOf(game).get(s.accountId);
  const path: [number, number][] = lv ? lv.path.slice(lv.i, lv.i + 24).map(([x, y]) => [Math.round(x), Math.round(y)]) : [];
  if (!path.length || Math.hypot(path[path.length - 1][0] - ship.state.x, path[path.length - 1][1] - ship.state.y) > 1) path.push([Math.round(ship.state.x), Math.round(ship.state.y)]);
  let left = 0, px = rec.x, py = rec.y;
  for (const [x, y] of path) {
    left += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  const r = ship.docked ? PORT_M : ARRIVE_M + ship.cls.length / 2;
  left = Math.max(0, left - r);
  return {
    x: Math.round(rec.x), y: Math.round(rec.y), at: game.now, v: Math.round(rec.v), path, left: Math.round(left), eta: Math.round(left / rec.v),
    started: game.now - (game.wallNow() - rec.started) / 1000, boats: rec.boats, men: rec.units.reduce((a, x) => a + x.n, 0),
    units: rec.units.map((x) => ({ u: x.u, n: x.n })), ...(lv?.wait ? { wait: true } : {}),
  };
}

/** For the admin and the tests: the boats' wait over at once. */
export function boatsReady(s: PlayerSession): void {
  if (s.profile) s.profile.isleBoatsAt = 0;
}
