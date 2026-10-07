// The island's own ships (docs/15_PERSONAL_ISLAND.md, item 4). The shipyard of a captain's own island builds up to
// two ships of her own (warship, merchant, fisher, scout) from the island's yard and silver, on the base's clock and
// with its speed-ups; the work is the shipwrights' (one hull on the slipway at a time), not the builders'. A ship
// of her own is kept with the island (the yard's `ships`); taken to sea, she joins the squadron as an escort that
// is her own (fleet.ts: `own`), so she keeps station in the formation, fights with the escorts' brain, anchors and
// sails with her captain from port to port. She grows seasoned from what she helps sink, fish and sell, and is
// raised a level at the island's shipyard (as far as its level lets). Sunk, she is towed home and laid up, to be
// mended for timber, tar and silver; a port's yard mends a damaged one for silver alone.
//
// While she sails with her captain: a merchant adds half her hold to the flagship's, a fisher nets the shoals they
// pass into the flagship's hold, a scout widens her sight. See shared/src/data/baseships.ts for the numbers and
// the squadron's rule (two of her own at most, and they take the hired escorts' berths first).

import {
  FISH_EVERY, OWN_NAMES, OWN_ROLE_DEFS, OWN_ROLES, OWN_SHIPS_MAX, XP_FIGHT, XP_FIGHT_LEVEL, XP_FISH, XP_SEA_EVERY, XP_TRADE_MAX, XP_TRADE_SILVER, YARD_SHIP_LEVEL,
  fisherHaul, hullFor, merchantHold, nextOwnLevel, ownBuildCost, ownPortRepair, ownRepairCost, ownUpgradeCost, ownXpNext, scoutSight, yardLevelFor,
} from '../../../shared/src/data/baseships.ts';
import type { OwnRole } from '../../../shared/src/data/baseships.ts';
import { FISH } from '../../../shared/src/data/fishing.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { levelScale } from '../../../shared/src/data/shiplevel.ts';
import { speedupGoods, speedupSilver } from '../../../shared/src/data/base.ts';
import { dist } from '../../../shared/src/math.ts';
import type { OwnShipView, OwnYardView } from '../../../shared/src/protocol.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { baseView, capOf, lyingOff, mine, payCost } from './base.ts';
import type { BaseJob, Yard } from './base.ts';
import { giveGoods } from './director.ts';
import { ownIsland } from './estate.ts';
import { escortSlots, escortsOf, spawnEscortShip } from './fleet.ts';
import type { FleetEscort } from './fleet.ts';
import { shoalsOf } from './fishing.ts';
import type { Game } from './Game.ts';
import { has, island } from './holdings.ts';
import type { Holding } from './holdings.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

export interface OwnShip {
  id: string;
  role: OwnRole;
  classId: ShipClassId;
  level: number;
  xp: number;
  /** Her name: an index into OWN_NAMES. */
  name: number;
  /** Her hull (a share of the whole) while she lies at the island (at sea, her squadron record keeps it). */
  hull: number;
  state: 'building' | 'home' | 'sea' | 'laid_up' | 'refit';
  /** Catch aboard her, for the island's yard when she comes home. */
  catch?: number;
}

const nameOf = (x: OwnShip): string => OWN_NAMES[x.name % OWN_NAMES.length][0];

function shipsOf(h: Holding): OwnShip[] {
  if (!h.yard) return [];
  h.yard.ships ??= [];
  // Her hull is her role's at her level (the warship's frigate from ⚓8 only since docs/15 item 8).
  for (const x of h.yard.ships) if (OWN_ROLE_DEFS[x.role]) x.classId = hullFor(x.role, x.level);
  return h.yard.ships;
}

/** The island's shipyard level (0: none built). */
export function shipyardLevel(h: Holding): number {
  const b = has(h, 'shipyard');
  return b ? Math.max(1, b.level ?? 1) : 0;
}

function slipwayBusy(y: Yard): boolean {
  return y.jobs.some((j) => !!j.ship);
}

function jobOf(y: Yard, x: OwnShip): BaseJob | undefined {
  return y.jobs.find((j) => j.ship === x.id);
}

/** Her squadron record, if she is at sea (or anchored with her captain in a port). */
function entryOf(s: PlayerSession, x: OwnShip): FleetEscort | undefined {
  return s.profile!.fleet.escorts.find((e) => e.own === x.id);
}

function entityOf(game: Game, s: PlayerSession, id: string): ShipEntity | undefined {
  return s.ship ? escortsOf(game, s.ship).find((e) => e.fleetId === id) : undefined;
}

/** Her hull now: at sea from her ship, anchored from her squadron record, at home from her own. */
function hullNow(game: Game, s: PlayerSession, x: OwnShip): number {
  if (x.state !== 'sea') return x.hull;
  const ent = entityOf(game, s, x.id);
  if (ent) return Math.max(0, ent.hull / ent.stats.hullMax);
  return entryOf(s, x)?.hull ?? x.hull;
}

/** Her records and her squadron's kept in step (a save taken between the two, a ship gone). */
export function syncOwnShips(game: Game, s: PlayerSession, h: Holding): void {
  const p = s.profile!;
  const ships = shipsOf(h);
  const before = p.fleet.escorts.length;
  p.fleet.escorts = p.fleet.escorts.filter((e) => {
    if (!e.own) return true;
    const x = ships.find((k) => k.id === e.own);
    if (x && x.state === 'sea') return true;
    const ent = entityOf(game, s, e.id);
    if (ent) game.removeShip(ent.id);
    return false;
  });
  for (const x of ships) if (x.state === 'sea' && !entryOf(s, x)) x.state = 'home';
  if (p.fleet.escorts.length !== before) reindex(game, s);
}

function reindex(game: Game, s: PlayerSession): void {
  if (!s.ship) return;
  const list = s.profile!.fleet.escorts;
  for (const ent of escortsOf(game, s.ship)) {
    const i = list.findIndex((e) => e.id === ent.fleetId);
    if (i >= 0) ent.escortIndex = i;
  }
}

/** Her own ships at sea with her now, and the berths of her whole squadron (docs/15 item 4). */
export function squadronOf(s: PlayerSession): { own: number; hired: number; berths: number } {
  const p = s.profile!;
  const own = p.fleet.escorts.filter((e) => e.own).length;
  const hired = p.fleet.escorts.length - own;
  const slots = s.ship ? escortSlots(p, s.ship) : 0;
  return { own, hired, berths: Math.max(OWN_SHIPS_MAX, slots) };
}

// ------------------------------------------------------------------------------------------------ seasoning

function season(game: Game, s: PlayerSession | undefined, x: OwnShip, n: number): void {
  if (n <= 0 || x.state === 'building' || x.state === 'laid_up') return;
  const need = ownXpNext(x.level);
  if (x.xp >= need || nextOwnLevel(x.role, x.level) === null) {
    x.xp = Math.min(x.xp, need);
    return;
  }
  x.xp = Math.min(need, x.xp + n);
  game.holdings.touch();
  if (x.xp >= need && s) game.sendTo(s, { t: 'toast', msg: `${nameOf(x)} is seasoned: raise her a level at your island’s shipyard.`, kind: 'good' });
}

/** Her own ships at sea and whole, with their records. */
function afloat(game: Game, s: PlayerSession): { x: OwnShip; ent: ShipEntity }[] {
  const h = ownIsland(game, s.accountId);
  if (!h || !s.ship) return [];
  const ships = shipsOf(h);
  const out: { x: OwnShip; ent: ShipEntity }[] = [];
  for (const ent of escortsOf(game, s.ship)) {
    const e = s.profile!.fleet.escorts.find((k) => k.id === ent.fleetId && k.own);
    const x = e ? ships.find((k) => k.id === e.own && k.state === 'sea') : undefined;
    if (x && ent.alive && !ent.sinkingUntil) out.push({ x, ent });
  }
  return out;
}

/** A ship sunk or taken near her own ships: each of them within two kilometres shares in it. */
export function ownShipsKill(game: Game, s: PlayerSession, victim: ShipEntity): void {
  const lvl = victim.onLadder ? victim.shipLevel : 1;
  for (const { x, ent } of afloat(game, s)) {
    if (dist(ent.state.x, ent.state.y, victim.state.x, victim.state.y) > 2000) continue;
    season(game, s, x, XP_FIGHT + XP_FIGHT_LEVEL * lvl);
  }
}

/** A sale in port: a merchant of her own in the squadron shares in the trade. */
export function ownShipsTrade(game: Game, s: PlayerSession, price: number): void {
  const h = ownIsland(game, s.accountId);
  if (!h || price <= 0) return;
  for (const x of shipsOf(h)) if (x.role === 'merchant' && x.state === 'sea' && entryOf(s, x)) season(game, s, x, Math.min(XP_TRADE_MAX, Math.floor(price / XP_TRADE_SILVER)));
}

// ------------------------------------------------------------------------------------------------ at sea

const told = new WeakMap<OwnShip, number>();

/** Once a second: what her own ships lend her (hold, sight), the fisher's nets, time at sea. */
export function stepOwnShips(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  const p = s.profile;
  if (!ship || !p) return;
  const now = game.now;
  const own = p.fleet.escorts.filter((e) => e.own);
  const cur = ship.effects.find((e) => e.id === 'own_ships');
  if (!own.length) {
    if (cur) {
      ship.effects = ship.effects.filter((e) => e.id !== 'own_ships');
      ship.recompute(now);
    }
    return;
  }
  const h = ownIsland(game, s.accountId);
  if (!h) return;
  const ships = shipsOf(h);
  const out = afloat(game, s);
  // In port they lie at anchor with her and still carry for her; at sea, only those afloat.
  let hold = 0, sight = 0;
  for (const e of own) {
    const x = ships.find((k) => k.id === e.own);
    if (!x || (!ship.docked && !out.some((o) => o.x === x))) continue;
    if (x.role === 'merchant') hold += merchantHold(x.classId, x.level);
    if (x.role === 'scout') sight = Math.max(sight, scoutSight(x.level));
  }
  const base = SHIP_CLASSES[ship.loadout.classId].holdVolume * levelScale(ship.loadout.classId, ship.shipLevel).hold;
  const mods = { holdVolume: Math.round((hold / Math.max(1, base)) * 1000) / 1000, detection: sight };
  if (!cur || cur.mods?.holdVolume !== mods.holdVolume || cur.mods?.detection !== mods.detection || cur.until - now < 2) {
    ship.addEffect({ id: 'own_ships', until: now + 5, mods }, now);
  }
  if (ship.docked) return;
  const sec = Math.floor(now);
  for (const { x, ent } of out) {
    if (sec % XP_SEA_EVERY === 0) season(game, s, x, x.role === 'scout' ? 2 : 1);
    if (x.role !== 'fisher' || sec % FISH_EVERY !== 0 || ent.inCombat(now)) continue;
    const sh = shoalsOf(game).find((k) => k.stock > 0 && (dist(k.x, k.y, ent.state.x, ent.state.y) <= k.r + 150 || dist(k.x, k.y, ship.state.x, ship.state.y) <= k.r + 150));
    if (!sh) continue;
    const n = Math.min(sh.stock, fisherHaul(x.level));
    if (n <= 0) continue;
    sh.stock -= n;
    const good = FISH[sh.fish].good as GoodId;
    const got = giveGoods(ship, good, n);
    const room = SHIP_CLASSES[x.classId].holdVolume;
    if (n > got) x.catch = Math.min(room, (x.catch ?? 0) + (n - got));
    season(game, s, x, n * XP_FISH);
    if (now - (told.get(x) ?? -1e9) >= 60) {
      told.set(x, now);
      game.sendTo(s, { t: 'toast', msg: got > 0 ? `${nameOf(x)} brings aboard ${got} ${GOODS[good].name.toLowerCase()}.` : `${nameOf(x)} keeps her catch in her own hold: yours is full.`, kind: 'good' });
    }
  }
}

/** Her own ship went down: the crew is picked up and the hull towed home, to lie up until she is mended. */
export function ownShipLost(game: Game, s: PlayerSession, esc: ShipEntity): void {
  const p = s.profile!;
  const e = p.fleet.escorts.find((k) => k.id === esc.fleetId);
  p.fleet.escorts = p.fleet.escorts.filter((k) => k.id !== esc.fleetId);
  reindex(game, s);
  const h = ownIsland(game, s.accountId);
  const x = h ? shipsOf(h).find((k) => k.id === e?.own) : undefined;
  if (!h || !x) return;
  x.state = 'laid_up';
  x.hull = 0;
  x.catch = 0;
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: `${nameOf(x)} goes down. Her crew is picked up and her hull towed home to ${island(game, h.island)?.name ?? 'your island'}: laid up until she is mended.`, kind: 'bad' });
}

/** In a port's yard her own damaged ships are mended for silver, if her purse bears it. */
export function ownPortRepairFleet(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const h = ownIsland(game, s.accountId);
  if (!h) return;
  for (const e of p.fleet.escorts) {
    if (!e.own || e.hull >= 0.999) continue;
    const x = shipsOf(h).find((k) => k.id === e.own);
    if (!x) continue;
    const cost = ownPortRepair(x.role, x.level, e.hull);
    if (cost <= 0 || p.gold < cost) continue;
    p.gold -= cost;
    game.db.ledger(s.accountId, 'own_ship_repair', -cost, nameOf(x));
    e.hull = 1;
    x.hull = 1;
    game.sendTo(s, { t: 'toast', msg: `The port’s yard mends ${nameOf(x)} for ${cost} silver.`, kind: 'info' });
  }
}

// ------------------------------------------------------------------------------------------------ the shipyard's orders

function queue(game: Game, y: Yard, x: OwnShip, kind: 'build' | 'upgrade' | 'repair', level: number, secs: number): void {
  const now = game.wallNow();
  y.jobs.push({ id: y.seq++, plot: -1, what: `ship:${x.role}`, level, start: now, end: now + secs * 1000, ship: x.id, kind });
  game.holdings.touch();
}

function buildWhy(h: Holding, y: Yard, role: OwnRole): string | null {
  if (!OWN_ROLE_DEFS[role]) return 'Unknown ship';
  if (!shipyardLevel(h)) return 'Build a shipyard on the island first.';
  if (shipsOf(h).length >= OWN_SHIPS_MAX) return `The island keeps ${OWN_SHIPS_MAX} ships of its own.`;
  if (slipwayBusy(y)) return 'The shipyard’s slipway is busy.';
  return null;
}

export function shipBuild(game: Game, s: PlayerSession, role: OwnRole): string | null {
  const m = mine(game, s);
  if (typeof m === 'string') return m;
  const { h, y } = m;
  if (!OWN_ROLES.includes(role)) return 'Unknown ship';
  const why = buildWhy(h, y, role);
  if (why) return why;
  const cost = ownBuildCost(role);
  const paid = payCost(game, s, h, y, cost, `build:${role}`);
  if (paid) return paid;
  const ships = shipsOf(h);
  let name = h.island % OWN_NAMES.length;
  for (let k = 0; k < OWN_NAMES.length && ships.some((x) => x.name === name); k++) name = (name + 1) % OWN_NAMES.length;
  const x: OwnShip = { id: `o${h.island}_${y.seq}`, role, classId: hullFor(role, 1), level: 1, xp: 0, name, hull: 1, state: 'building' };
  ships.push(x);
  queue(game, y, x, 'build', 1, cost.secs);
  return null;
}

function findShip(game: Game, s: PlayerSession, id: string): { h: Holding; y: Yard; isl: Island; x: OwnShip } | string {
  const m = mine(game, s);
  if (typeof m === 'string') return m;
  const x = shipsOf(m.h).find((k) => k.id === String(id));
  if (!x) return 'No such ship of yours.';
  syncOwnShips(game, s, m.h);
  return { ...m, x };
}

function upWhy(h: Holding, y: Yard, x: OwnShip): string | null {
  if (x.state === 'building' || x.state === 'refit') return 'The shipwrights are at work on her.';
  if (x.state === 'sea') return 'Bring her home to the island first.';
  if (x.state === 'laid_up') return 'Mend her first.';
  const next = nextOwnLevel(x.role, x.level);
  if (next === null) return 'She is at her greatest.';
  const yl = shipyardLevel(h);
  if (!yl) return 'Build a shipyard on the island first.';
  if (next > YARD_SHIP_LEVEL[yl]) return `Raise the shipyard to level ${yardLevelFor(next)} first.`;
  if (x.xp < ownXpNext(x.level)) return `She needs more seasoning at sea: ${Math.floor(x.xp)} of ${ownXpNext(x.level)}.`;
  if (slipwayBusy(y)) return 'The shipyard’s slipway is busy.';
  return null;
}

export function shipUpgrade(game: Game, s: PlayerSession, id: string): string | null {
  const f = findShip(game, s, id);
  if (typeof f === 'string') return f;
  const { h, y, x } = f;
  const why = upWhy(h, y, x);
  if (why) return why;
  const next = nextOwnLevel(x.role, x.level)!;
  const cost = ownUpgradeCost(x.role, next);
  const paid = payCost(game, s, h, y, cost, `up:${x.id}:${next}`);
  if (paid) return paid;
  x.state = 'refit';
  queue(game, y, x, 'upgrade', next, cost.secs);
  return null;
}

function repairWhy(h: Holding, y: Yard, x: OwnShip, hull: number): string | null {
  if (x.state === 'building' || x.state === 'refit') return 'The shipwrights are at work on her.';
  if (x.state === 'sea') return 'Bring her home to the island, or put in at a port with a yard.';
  if (hull >= 0.999) return 'She is whole.';
  if (!shipyardLevel(h)) return 'Build a shipyard on the island first.';
  if (slipwayBusy(y)) return 'The shipyard’s slipway is busy.';
  return null;
}

export function shipRepair(game: Game, s: PlayerSession, id: string): string | null {
  const f = findShip(game, s, id);
  if (typeof f === 'string') return f;
  const { h, y, x } = f;
  const why = repairWhy(h, y, x, x.hull);
  if (why) return why;
  const cost = ownRepairCost(x.role, x.level, x.hull, x.state === 'laid_up');
  const paid = payCost(game, s, h, y, cost, `mend:${x.id}`);
  if (paid) return paid;
  x.state = 'refit';
  queue(game, y, x, 'repair', x.level, cost.secs);
  return null;
}

function launchWhy(game: Game, s: PlayerSession, h: Holding, x: OwnShip): string | null {
  if (x.state === 'sea') return 'She is at sea with you.';
  if (x.state === 'building' || x.state === 'refit') return 'The shipwrights are at work on her.';
  if (x.state === 'laid_up') return 'She is laid up: mend her first.';
  if (x.hull < 0.25) return 'She is too badly holed to sail: mend her first.';
  const ship = s.ship;
  if (!ship || !ship.alive || ship.docked || !lyingOff(game, s, h)) return 'She lies at your island: come and lie off it to take her out.';
  const sq = squadronOf(s);
  if (sq.own >= OWN_SHIPS_MAX) return `No more than ${OWN_SHIPS_MAX} of your own ships sail with you.`;
  if (sq.own + sq.hired >= sq.berths) return `Your squadron is full (${sq.berths}): pay off a hired escort in port first.`;
  return null;
}

/** Take her out: she joins the squadron and sails at her station. */
export function shipLaunch(game: Game, s: PlayerSession, id: string): string | null {
  const f = findShip(game, s, id);
  if (typeof f === 'string') return f;
  const { h, x } = f;
  const why = launchWhy(game, s, h, x);
  if (why) return why;
  const p = s.profile!;
  const e: FleetEscort = { id: x.id, classId: x.classId, name: nameOf(x), hull: Math.max(0.25, x.hull), own: x.id, level: x.level };
  p.fleet.escorts.push(e);
  x.state = 'sea';
  spawnEscortShip(game, s, e, p.fleet.escorts.length - 1);
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: `${nameOf(x)} weighs anchor and takes her station in your squadron.`, kind: 'good' });
  return null;
}

function recallWhy(game: Game, s: PlayerSession, x: OwnShip): string | null {
  if (x.state !== 'sea') return 'She is not at sea.';
  if (s.ship?.underFire(game.now) && entityOf(game, s, x.id)) return 'Not with shot flying';
  return null;
}

/** Send her home: she leaves the squadron and lies at the island; her catch goes into its yard. */
export function shipRecall(game: Game, s: PlayerSession, id: string): string | null {
  const f = findShip(game, s, id);
  if (typeof f === 'string') return f;
  const { h, y, isl, x } = f;
  const why = recallWhy(game, s, x);
  if (why) return why;
  x.hull = Math.max(0.05, Math.min(1, hullNow(game, s, x)));
  const ent = entityOf(game, s, x.id);
  if (ent) game.removeShip(ent.id);
  const p = s.profile!;
  p.fleet.escorts = p.fleet.escorts.filter((e) => e.own !== x.id);
  reindex(game, s);
  x.state = 'home';
  if (x.catch) {
    const cap = capOf(h);
    y.res.provisions = Math.min(cap, (y.res.provisions ?? 0) + x.catch);
    x.catch = 0;
  }
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: `${nameOf(x)} sails home to ${isl.name}.`, kind: 'info' });
  return null;
}

/** The shipwrights' work done (base.ts reckons it on the wall clock with the rest). */
export function finishShipJob(game: Game, h: Holding, _y: Yard, isl: Island, j: BaseJob): void {
  const x = shipsOf(h).find((k) => k.id === j.ship);
  if (!x) return;
  let msg = '';
  if (j.kind === 'build') {
    x.state = 'home';
    x.hull = 1;
    msg = `${nameOf(x)} is launched at ${isl.name}: a ship of your own.`;
  } else if (j.kind === 'upgrade') {
    x.level = Math.max(x.level, j.level);
    x.classId = hullFor(x.role, x.level);
    x.xp = 0;
    x.hull = 1;
    x.state = 'home';
    msg = `${nameOf(x)} comes off the slipway at ${isl.name}: level ${x.level}.`;
  } else {
    x.hull = 1;
    x.state = 'home';
    msg = `${nameOf(x)} is mended at ${isl.name}.`;
  }
  game.holdings.touch();
  const s = h.owner.kind === 'player' ? game.sessionByAccount(h.owner.id) : undefined;
  if (!s) return;
  game.sendTo(s, { t: 'toast', msg, kind: 'good' });
  game.sendTo(s, { t: 'base', view: baseView(game, s) });
}

// ------------------------------------------------------------------------------------------------ what she sees

export function ownYardView(game: Game, s: PlayerSession, h: Holding, y: Yard): OwnYardView {
  syncOwnShips(game, s, h);
  const yl = shipyardLevel(h);
  const now = game.wallNow();
  const ships: OwnShipView[] = shipsOf(h).map((x) => {
    const j = jobOf(y, x);
    const hull = hullNow(game, s, x);
    const next = nextOwnLevel(x.role, x.level);
    const left = j ? Math.max(0, (j.end - now) / 1000) : 0;
    const whole = hull >= 0.999 && x.state !== 'laid_up';
    return {
      id: x.id, role: x.role, name: OWN_NAMES[x.name % OWN_NAMES.length], classId: x.classId, level: x.level, xp: Math.floor(x.xp), xpNext: ownXpNext(x.level),
      hull: Math.round(hull * 100) / 100, state: x.state,
      job: j ? { id: j.id, kind: j.kind ?? 'build', level: j.level, start: j.start, end: j.end, silver: speedupSilver(left), goods: speedupGoods(left) } : null,
      up: next === null ? null : { ...ownUpgradeCost(x.role, next), level: next, classId: hullFor(x.role, next), why: upWhy(h, y, x) },
      repair: whole || x.state === 'building' ? null : { ...ownRepairCost(x.role, x.level, hull, x.state === 'laid_up'), why: repairWhy(h, y, x, hull) },
      launchWhy: launchWhy(game, s, h, x), recallWhy: recallWhy(game, s, x),
      bonus: { hold: x.role === 'merchant' ? merchantHold(x.classId, x.level) : 0, sight: x.role === 'scout' ? scoutSight(x.level) : 0, haul: x.role === 'fisher' ? fisherHaul(x.level) : 0 },
      catch: x.catch ?? 0,
    };
  });
  const sq = squadronOf(s);
  const b = h.buildings.find((k) => k.id === 'shipyard');
  return {
    level: yl, plot: b?.plot ?? null, shipMax: yl ? YARD_SHIP_LEVEL[yl] : 0, max: OWN_SHIPS_MAX, ships,
    offers: OWN_ROLES.map((role) => ({ role, classId: hullFor(role, 1), ...ownBuildCost(role), why: buildWhy(h, y, role) })),
    squadron: { own: sq.own, ownMax: OWN_SHIPS_MAX, hired: sq.hired, berths: sq.berths },
    busy: slipwayBusy(y),
  };
}
