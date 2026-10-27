// The floating waystations and the resurrection of the fallen (owner, 2026-10-17; docs/35_RESURRECTION.md).
//
// - The fallen record (her profile's `fallen`): every battle's dead past the wounded who stood again — a boarding's and
//   a lair's from the battle's own losses (hero.ts afterBattle), the guns' and the beasts' from the shot (combat.ts
//   killMen, the wounded below counted out). Kept a day and twenty battles.
// - Where she raises them: moored at a waystation, in port (the tavern's surgeon), at sea within reach of either (the
//   result screen's quick «Воскресить», the field surgeon's fee), anywhere for doubloons (the shop's infirmary) or a
//   scroll of resurrection. Never in a fight: a captain's battle is fought with what she brought to it.
// - The prices (shared/src/data/resurrect.ts): the line kinds and the sea's creatures for silver by tier, the shop's
//   creatures for doubloons only, at half their price a head.
// - The room: the hammocks, the army's slots, the might cap and the picked men's berths for the trained men (as the
//   dwellings sign them on), the hammocks and the slots for the creatures (as the tamers and the shop do).
// - Her request's id: the same id twice raises once (the record's `done`; a doubloon's spend its ledger row).
//
// The waystations themselves (shared/src/world/waystations.ts) are the world's data: streamed with the chunks; a captain
// within WAY_MOOR_RANGE moors with «Причалить к плавучему дому» (never by herself), and the window offers the fallen, a
// small rotating hire of the waters' kinds (the recruit window, src 'way'), a quick repair dearer than a yard's, and
// «В море». She drifts off past WAY_LEAVE_RANGE, or a fight finds her: the window shuts.

import { REACH_SLACK, hullOf } from '../../../shared/src/data/reach.ts';
import { lackHammocks, lackMore, lackSlot } from '../../../shared/src/data/buyfail.ts';
import { UNITS, armyWeight } from '../../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../../shared/src/data/army.ts';
import { PICKED_TIER, TIER_SHIP_LEVEL, mightCap, mightRoom } from '../../../shared/src/data/town.ts';
import type { DwellRow, DwellView } from '../../../shared/src/h3proto.ts';
import {
  FALLEN_BATTLES, FIELD_RANGE, RES_OFFER_SILVER, RES_OFFER_STACKS, RSCROLL_MAX, fallenByKind, fallenTrim, resKeeps, resPremium, resPrice,
} from '../../../shared/src/data/resurrect.ts';
import type { FallenRec, ResPlace } from '../../../shared/src/data/resurrect.ts';
import { PRICE_MAX, PRICE_MIN, REFILL_RATE, dayOf } from '../../../shared/src/data/shop.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { WAY_LEAVE_RANGE, WAY_MOOR_RANGE, WAY_SIZE, wayInReach, wayNear, waysOfChunk, waystations } from '../../../shared/src/world/waystations.ts';
import type { Waystation } from '../../../shared/src/world/waystations.ts';
import type { ResRow, ResView, WayClientMsg, WayData, WayView } from '../../../shared/src/wayproto.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { landFightOn } from './beastlairs.ts';
import { reconcile } from './crew.ts';
import { dwellView, pickedMax, pickedRoom, recruit as dwellRecruit } from './dwell.ts';
import type { Game } from './Game.ts';
import { trackEvent } from './liveops.ts';
import type { PlayerSession } from './player.ts';
import { repairLowMul, yardMul } from './ports.ts';
import { sendBalance } from './premium.ts';
import { joinCreatures } from './tame.ts';
import { rscrollsOf, spendRScroll } from './shop.ts';
import { weekView } from './calendar.ts';
import { keepsDeep } from './town.ts';
import { approach } from './approach.ts';

const H = 3_600_000;

// ------------------------------------------------------------------------------------------------ the record

type WithFallen = { fallen?: FallenRec };

/** Her record (made on first need), trimmed to its window. */
export function fallenOf(game: Game, s: PlayerSession): FallenRec {
  const p = s.profile as unknown as WithFallen;
  const rec = (p.fallen ??= { list: [], battles: [], done: [] });
  rec.list ??= [];
  rec.battles ??= [];
  rec.done ??= [];
  fallenTrim(rec, game.wallNow());
  return rec;
}

/** A battle's dead on her record: `lost` by kind, less those that stood again (`raised` by kind). `gunfight`: the guns'
 *  dead of one engagement are one battle (a broadside a minute after the last joins it). */
export function recordFallen(game: Game, s: PlayerSession | null, lost: readonly { u: string; n: number }[], raised: ReadonlyMap<string, number> | null = null, gunfight = false): void {
  if (!s?.authed || !s.profile) return;
  const now = game.wallNow();
  const add: { u: UnitId; n: number }[] = [];
  for (const x of lost) {
    const u = x.u as UnitId;
    const n = Math.max(0, Math.floor(x.n) - (raised?.get(u) ?? 0));
    if (n > 0 && resKeeps(u)) add.push({ u, n });
  }
  if (!add.length) return;
  const rec = fallenOf(game, s);
  const last = rec.battles[rec.battles.length - 1];
  const at = gunfight && last !== undefined && now - last < 120_000 ? last : now;
  if (at === now) rec.battles.push(now);
  for (const x of add) {
    const e = rec.list.find((y) => y.u === x.u && y.at === at);
    if (e) e.n += x.n;
    else rec.list.push({ u: x.u, n: x.n, at });
  }
  // (a gunfight's battle keeps its first moment; the record still holds FALLEN_BATTLES at most)
  if (rec.battles.length > FALLEN_BATTLES) fallenTrim(rec, now);
  // (the guns' dead come shot by shot: told once a second, waySecond)
  if (gunfight) dirty.add(s);
  else pushFallen(game, s);
}

const dirty = new WeakSet<PlayerSession>();

/** The guns' dead (combat.ts killMen): what each stack lost, less the wounded carried below (they come back to duty as
 *  hands — the cheapest kinds counted out first). */
export function recordShot(game: Game, s: PlayerSession | null, lost: readonly ArmyStack[], wounded: number): void {
  if (!s?.authed || !lost.length) return;
  const sorted = [...lost].sort((a, b) => (UNITS[a.u]?.tier ?? 0) - (UNITS[b.u]?.tier ?? 0));
  const raised = new Map<string, number>();
  let w = Math.max(0, Math.floor(wounded));
  for (const x of sorted) {
    if (w <= 0) break;
    const k = Math.min(w, x.n);
    raised.set(x.u, (raised.get(x.u) ?? 0) + k);
    w -= k;
  }
  recordFallen(game, s, lost, raised, true);
}

// ------------------------------------------------------------------------------------------------ where she stands

const moored = new WeakMap<PlayerSession, number>();

/** The waystation she is moored at, or null. */
export function mooredAt(game: Game, s: PlayerSession): Waystation | null {
  const id = moored.get(s);
  if (id === undefined) return null;
  return waystations(game.world).list[id] ?? null;
}

/** Shot flying, a boarding, a party ashore fighting: no raising, no hire. */
export function resBusy(game: Game, s: PlayerSession): string | null {
  const ship = s.ship;
  if (!ship || !ship.alive) return 'Not now';
  if (ship.boarding || ship.grappled) return 'Not in the middle of a boarding';
  if (!ship.docked && ship.underFire(game.now)) return 'Not while under fire';
  if (landFightOn(game, s)) return 'Your party is ashore already.';
  return null;
}

/** Where she may raise her fallen now (the price's place): moored, in port, near either, or nowhere. */
export function resPlace(game: Game, s: PlayerSession): ResPlace {
  const ship = s.ship;
  if (!ship) return 'none';
  if (ship.docked) return 'port';
  if (mooredAt(game, s)) return 'way';
  const { x, y } = ship.state;
  if (wayNear(game.world, x, y, FIELD_RANGE)) return 'field';
  const port = game.nearestPort(x, y);
  return port && Math.hypot(port.x - x, port.y - y) <= FIELD_RANGE ? 'field' : 'none';
}

// ------------------------------------------------------------------------------------------------ the room

interface Plan {
  u: UnitId;
  n: number;
  room: number;
  prem: boolean;
  why?: string;
}

/** Who of the record may come back now, kind by kind in the record's order, each counted on the army as the ones
 *  before it would leave it: the hammocks, the slots, the might cap and the picked men's berths. */
function planOf(s: PlayerSession, rows: readonly { u: UnitId; n: number }[]): Plan[] {
  const ship = s.ship!;
  const army = ship.army.map((x) => ({ ...x }));
  let hammocks = Math.max(0, ship.stats.crewMax - ship.crew);
  let picked = pickedRoom(s);
  const out: Plan[] = [];
  const deep = keepsDeep(s) || s.profile!.captain === 'drowned';
  for (const r of rows) {
    const d = UNITS[r.u];
    const prem = resPremium(r.u);
    let room = Math.min(r.n, hammocks);
    let why: string | undefined;
    if (d.deep && !deep) {
      room = 0;
      why = 'Only a captain of the Choir or of a cursed ship keeps the drowned.';
    }
    const own = army.some((x) => x.u === r.u);
    if (room > 0 && !own && army.length >= ship.armySlots) {
      room = 0;
      why = 'No free slot in the army for a new kind of man.';
    }
    // The trained men by the dwellings' rules (the might cap, the picked berths); the creatures by the tamers'.
    if (room > 0 && !d.beast && !prem && !d.titan) {
      const might = mightRoom(army, r.u, ship.shipLevel, ship.stats.crewMax, ship.armySlots);
      if (might < room) {
        room = Math.max(0, might);
        if (!room) why = `Your crew is as strong as a ship of level ${ship.shipLevel} carries: raise her level for better men.`;
      }
      if (d.tier >= PICKED_TIER && picked < room) {
        room = Math.max(0, picked);
        if (!room) why = `A ship of level ${ship.shipLevel} berths ${pickedMax(s)} picked men (tier 4 and up) at most.`;
      }
    }
    if (room <= 0 && !why) why = 'No hammocks left aboard';
    if (room > 0) {
      hammocks -= room;
      if (!d.beast && !prem && d.tier >= PICKED_TIER) picked -= room;
      const st = army.find((x) => x.u === r.u);
      if (st) st.n += room;
      else army.push({ u: r.u, n: room });
    }
    out.push({ u: r.u, n: r.n, room, prem, ...(why ? { why } : {}) });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the views

/** The infirmary's price (doubloons, anywhere) for the line kinds that may come back now, and who. */
export function resInstant(game: Game, s: PlayerSession): { units: { u: UnitId; n: number }[]; n: number; price: number; until: number } | null {
  if (!s.ship || !s.profile) return null;
  const rec = fallenOf(game, s);
  const plan = planOf(s, fallenByKind(rec)).filter((x) => !x.prem && x.room > 0);
  if (!plan.length) return null;
  const units = plan.map((x) => ({ u: x.u, n: x.room }));
  const n = units.reduce((a, x) => a + x.n, 0);
  const worth = units.reduce((a, x) => a + x.n * UNITS[x.u].cost, 0);
  return { units, n, price: Math.min(PRICE_MAX, Math.max(PRICE_MIN, Math.ceil((worth / 1000) * REFILL_RATE))), until: untilOf(rec) };
}

function untilOf(rec: FallenRec): number {
  const first = rec.list.reduce((a, e) => Math.min(a, e.at), Infinity);
  return Number.isFinite(first) ? first + 24 * H : 0;
}

/** Her fallen and what raising them costs where she stands. */
export function resView(game: Game, s: PlayerSession): ResView {
  const rec = fallenOf(game, s);
  const place = resPlace(game, s);
  const rows: ResRow[] = [];
  let silver = 0, doubloons = 0, n = 0, fallen = 0;
  const why = resBusy(game, s);
  for (const x of planOf(s, fallenByKind(rec))) {
    const at = x.prem ? 'way' : place === 'none' ? 'way' : place;
    const p = resPrice(x.u, x.room, at);
    const one = resPrice(x.u, x.n, at);
    rows.push({ u: x.u, n: x.n, room: x.room, prem: x.prem, silver: x.room ? p.silver : one.silver, doubloons: x.room ? p.doubloons : one.doubloons, ...(x.why ? { why: x.why } : {}) });
    fallen += x.n;
    if (x.room > 0 && (x.prem || place !== 'none')) {
      silver += p.silver;
      doubloons += p.doubloons;
      n += x.room;
    }
  }
  const inst = resInstant(game, s);
  const gold = Math.floor(s.profile!.gold);
  const regular = rows.filter((r) => !r.prem && r.room > 0).reduce((a, r) => a + resPrice(r.u, r.room, 'way').silver, 0);
  return {
    place, rows, silver, doubloons, n, fallen, gold, balance: game.db.doubloons(s.accountId), scrolls: scrollsOf(game, s),
    instant: inst?.price ?? 0, until: untilOf(rec),
    offer: regular > Math.max(RES_OFFER_SILVER, gold) || rows.filter((r) => !r.prem).length >= RES_OFFER_STACKS,
    why,
  };
}

/** Her fallen sent (the result screen, the waystation's and the port's windows keep it). */
export function pushFallen(game: Game, s: PlayerSession): void {
  if (!s.ship || !s.profile) return;
  const v = resView(game, s);
  told.set(s, `${v.why}|${v.place}`);
  game.sendTo(s, { t: 'fallen', view: v });
}

/** What her last view said of the fight and the place: told again when it changes (the boarding over, the result's
 *  «Воскресить» comes alive; she sailed off the waystations' waters). */
const told = new WeakMap<PlayerSession, string>();

// ------------------------------------------------------------------------------------------------ raising

/** Men of a kind back aboard: into their stack (the creatures as the tamers bring them). */
function raiseAboard(game: Game, s: PlayerSession, u: UnitId, n: number): number {
  const ship = s.ship!;
  if (n <= 0) return 0;
  if (UNITS[u].beast) return joinCreatures(game, s, u, n);
  if (!ship.army.some((x) => x.u === u) && ship.army.length >= ship.armySlots) return 0;
  const k = Math.min(n, Math.max(0, ship.stats.crewMax - ship.crew));
  if (k <= 0) return 0;
  const c = s.profile!.company;
  reconcile(game, c, ship.crew);
  ship.addMen(u, k);
  c.pools.sailor += k;
  ship.companyKey = '';
  return k;
}

/** The raised taken off the record (the oldest of the kind first). */
function takeOff(rec: FallenRec, u: UnitId, n: number): void {
  const list = rec.list.filter((e) => e.u === u).sort((a, b) => a.at - b.at);
  for (const e of list) {
    if (n <= 0) break;
    const k = Math.min(n, e.n);
    e.n -= k;
    n -= k;
  }
  rec.list = rec.list.filter((e) => e.n > 0);
}

const RID = /^[A-Za-z0-9_-]{6,40}$/;

/** The infirmary's units raised (shop.ts grant 'refill'): aboard, and off the record. */
export function raiseInstant(game: Game, s: PlayerSession, units: readonly { u: UnitId; n: number }[]): number {
  const rec = fallenOf(game, s);
  let n = 0;
  for (const x of units) {
    const k = raiseAboard(game, s, x.u, x.n);
    takeOff(rec, x.u, k);
    n += k;
  }
  if (n > 0) trackEvent(game, s.accountId, 'resurrect', { product: 'instant' });
  dirty.add(s); // (her fallen told at the next second)
  return n;
}

/** Raise one kind or all with silver (the doubloons for the shop's creatures) where she stands, or one kind with a
 *  scroll anywhere out of a fight. Null: done (or done already by this request's id); else why not. */
export function resurrect(game: Game, s: PlayerSession, u: UnitId | undefined, via: 'silver' | 'scroll', rid: string): string | null {
  if (!s.authed || !s.profile || !s.ship) return 'Not now';
  if (!RID.test(String(rid ?? ''))) return 'Not now';
  const rec = fallenOf(game, s);
  if (rec.done.includes(rid)) return null;
  const busy = resBusy(game, s);
  if (busy) return busy;
  const p = s.profile;
  const rows = fallenByKind(rec).filter((x) => u === undefined || x.u === u);
  if (!rows.length) return 'None of your fallen to raise.';
  const plan = planOf(s, rows);
  if (via === 'scroll') {
    if (u === undefined) return 'A scroll raises one stack: choose it.';
    const x = plan[0];
    if (x.prem) return 'The shop’s creatures stand again for doubloons only.';
    if (x.room <= 0) return x.why ?? 'No hammocks left aboard';
    if (scrollsOf(game, s) <= 0) return 'No scrolls of resurrection: the shop sells them.';
    const k = raiseAboard(game, s, x.u, x.room);
    if (k <= 0) return lackHammocks(1, s.ship!.crew, s.ship!.stats.crewMax);
    takeOff(rec, x.u, k);
    spendScroll(game, s);
    rec.done.push(rid);
    game.db.ledger(s.accountId, 'resurrect_scroll', 0, `${x.u}:${k}`);
    trackEvent(game, s.accountId, 'resurrect', { product: `scroll:${x.u}` });
    game.toastShip(s.ship, `A scroll of resurrection: ${k} of your fallen stand again.`, 'good');
    return done(game, s);
  }
  const place = resPlace(game, s);
  let silverLeft = Math.floor(p.gold);
  let balance = game.db.doubloons(s.accountId);
  let raised = 0, paidS = 0, paidD = 0, short: string | null = null;
  for (const x of plan) {
    if (x.room <= 0) continue;
    if (!x.prem && place === 'none') {
      short ??= 'Bring her to a floating waystation or a port, or raise them at once for doubloons.';
      continue;
    }
    if (x.prem) {
      // The shop's creatures: doubloons only, every one of the stack or none (the spend and the ledger's row together).
      const price = resPrice(x.u, x.room, 'way').doubloons;
      if (balance < price) {
        short ??= `Needs ${price} doubloons`;
        continue;
      }
      let k = 0;
      game.db.transaction(() => {
        if (game.db.addDoubloons(s.accountId, -price) === null) return;
        game.db.ledger(s.accountId, 'doubloons_res', -price, `res:${rid}:${x.u}:${x.room}`);
        k = raiseAboard(game, s, x.u, x.room);
      });
      if (k <= 0) {
        short ??= 'No hammocks left aboard';
        continue;
      }
      takeOff(rec, x.u, k);
      balance -= price;
      paidD += price;
      raised += k;
      trackEvent(game, s.accountId, 'resurrect', { amount: price, product: `premium:${x.u}` });
      continue;
    }
    // The line kinds: as many as her silver pays for.
    const per = resPrice(x.u, 1, place).silver;
    let k = Math.min(x.room, per > 0 ? Math.floor(silverLeft / per) : x.room);
    // (the price of k as a whole, rounded once: a head or two less if the rounding tips it)
    while (k > 0 && resPrice(x.u, k, place).silver > silverLeft) k--;
    if (k <= 0) {
      short ??= `Needs ${resPrice(x.u, x.room, place).silver} silver`;
      continue;
    }
    const cost = resPrice(x.u, k, place).silver;
    const got = raiseAboard(game, s, x.u, k);
    if (got <= 0) continue;
    const paid = got === k ? cost : resPrice(x.u, got, place).silver;
    p.gold -= paid;
    silverLeft -= paid;
    paidS += paid;
    takeOff(rec, x.u, got);
    raised += got;
    game.db.ledger(s.accountId, 'resurrect', -paid, `${place}:${x.u}:${got}`);
  }
  if (raised <= 0) return short ?? plan.find((x) => x.why)?.why ?? 'No hammocks left aboard';
  rec.done.push(rid);
  if (paidS > 0) trackEvent(game, s.accountId, 'resurrect', { amount: paidS, product: `silver:${place}` });
  game.toastShip(s.ship, paidS > 0 && paidD > 0 ? `${raised} of your fallen stand again for ${paidS} silver and ${paidD} doubloons.` : paidD > 0 ? `${raised} of your fallen stand again for ${paidD} doubloons.` : `${raised} of your fallen stand again for ${paidS} silver.`, 'good');
  if (paidD > 0) sendBalance(game, s);
  return done(game, s);
}

function done(game: Game, s: PlayerSession): null {
  game.saveSession(s);
  game.pushSelf(s, true);
  pushFallen(game, s);
  const w = mooredAt(game, s);
  if (w) game.sendTo(s, { t: 'way', view: wayView(game, s, w) });
  return null;
}

// ------------------------------------------------------------------------------------------------ the scrolls

/** Her scrolls of resurrection (the shop's store, shop.ts `rscroll`). */
const scrollsOf = (game: Game, s: PlayerSession): number => Math.min(RSCROLL_MAX, rscrollsOf(game, s.accountId));
const spendScroll = (game: Game, s: PlayerSession): void => spendRScroll(game, s.accountId);

// ------------------------------------------------------------------------------------------------ the waystation

/** The quick repair: hull and canvas to WAY_REPAIR_TO of their whole, at WAY_REPAIR_MUL a yard's bill. */
export const WAY_REPAIR_TO = 0.75;
export const WAY_REPAIR_MUL = 1.6;

export function wayRepairCost(s: PlayerSession): number {
  const ship = s.ship!;
  const hull = Math.max(0, ship.stats.hullMax * WAY_REPAIR_TO - ship.hull) * (0.45 + ship.cls.tier * 0.1);
  const sails = Math.max(0, ship.stats.sailHpMax * WAY_REPAIR_TO - ship.sails) * 1.4;
  return Math.ceil((hull + sails) * yardMul(ship) * repairLowMul(ship.shipLevel) * WAY_REPAIR_MUL);
}

function wayRepair(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  const busy = resBusy(game, s);
  if (busy) return busy;
  const cost = wayRepairCost(s);
  if (cost <= 0) return 'The waystation’s carpenters mend no further: a yard does the rest.';
  if (s.profile!.gold < cost) return lackMore(`Repairs cost ${cost} silver`, cost, s.profile!.gold);
  s.profile!.gold -= cost;
  ship.hull = Math.max(ship.hull, ship.stats.hullMax * WAY_REPAIR_TO);
  ship.sails = Math.max(ship.sails, ship.stats.sailHpMax * WAY_REPAIR_TO);
  game.db.ledger(s.accountId, 'repair', -cost, `way:${ship.loadout.classId}`);
  game.toastShip(ship, `The waystation’s carpenters patch her up for ${cost} silver.`, 'good');
  return null;
}

export function wayView(game: Game, s: PlayerSession, w: Waystation): WayView {
  const cost = wayRepairCost(s);
  return { id: w.id, kind: w.kind, res: resView(game, s), repair: cost > 0 ? { cost, to: WAY_REPAIR_TO } : null, hire: hireKinds(game, w).length };
}

/** Moor at a waystation within reach (her own tap: never by herself). */
export function moor(game: Game, s: PlayerSession, id: number): string | null {
  const ship = s.ship;
  if (!ship || ship.docked) return 'Not now';
  const w = waystations(game.world).list[Math.trunc(Number(id))];
  if (!w) return 'No waystation there';
  // (owner, 2026-10-19: «штуки … должны включать автоплавание и плыть автоматом туда куда надо»): far off, the helmsman
  // takes her to it and she moors on arrival
  if (!wayInReach(hullOf(ship), w, REACH_SLACK)) return approach(game, s, { x: w.x, y: w.y, reach: WAY_MOOR_RANGE, r: WAY_SIZE / 2, slow: 3 }, 'Sail closer to the waystation to moor.');
  const busy = resBusy(game, s);
  if (busy) return busy;
  moored.set(s, w.id);
  ship.input = { rudder: 0, sailTarget: 0 };
  s.sailHold = s.lastSail;
  game.sendTo(s, { t: 'way', view: wayView(game, s, w) });
  pushFallen(game, s);
  return null;
}

/** Cast off (her «В море», or the window shut by drifting off or a fight). */
export function castOff(game: Game, s: PlayerSession, say = false): void {
  if (!moored.has(s)) return;
  moored.delete(s);
  game.sendTo(s, { t: 'way', view: null });
  if (say) game.sendTo(s, { t: 'toast', msg: 'Cast off from the waystation.', kind: 'info' });
}

/** Once a second: a moored captain drifted off or found by a fight is cast off. */
export function waySecond(game: Game, s: PlayerSession): void {
  if (dirty.has(s)) {
    dirty.delete(s);
    pushFallen(game, s);
  } else if (told.has(s) && s.profile && ((s.profile as unknown as WithFallen).fallen?.list.length ?? 0) > 0 && told.get(s) !== `${resBusy(game, s)}|${resPlace(game, s)}`) pushFallen(game, s);
  const w = mooredAt(game, s);
  const ship = s.ship;
  if (!w || !ship) return;
  if (!ship.alive || ship.docked || ship.boarding || ship.grappled || ship.underFire(game.now) || Math.hypot(w.x - ship.state.x, w.y - ship.state.y) > WAY_LEAVE_RANGE) castOff(game, s, true);
}

/** The chunk's waystations as the wire carries them. */
export function waysForChunk(game: Game, key: number): WayData[] {
  return waysOfChunk(game.world, key).map((w) => ({ id: w.id, kind: w.kind, x: w.x, y: w.y, rot: w.rot }));
}

// ------------------------------------------------------------------------------------------------ the hire

/** Silver a man at a waystation: his worth half again (no resources asked: a raft has no magazine to fill). */
export const WAY_HIRE_MUL = 1.5;
/** Men of a tier a waystation has for hire a day. */
export const WAY_HIRE_DAY = [0, 12, 8, 6, 4, 3, 2, 1];
const LINE: UnitId[][] = [[], ['deckhand', 'sailor'], ['marine', 'sea_guard'], ['musketeer', 'sharpshooter'], ['gunner', 'bombardier'], ['boarder', 'cutthroat'], ['guard', 'life_guard'], ['drowned', 'deep_spawn']];

/** The kinds a waystation has today: the hands always, and two of the higher tiers its waters allow — the safe seas'
 *  to the third, the contested to the fifth, the lawless to the seventh — rolled anew each day. */
export function hireKinds(game: Game, w: Waystation): UnitId[] {
  const safety = REGIONS[w.region].safety;
  const top = safety === 'safe' ? 3 : safety === 'contested' ? 5 : 7;
  const r = new Rng(((w.id * 2_654_435_761) ^ (dayOf(game.wallNow()) * 40_503) ^ 0x35a7) >>> 0);
  const out: UnitId[] = [LINE[1][r.float() < 0.7 ? 0 : 1]];
  const tiers = Array.from({ length: top - 1 }, (_, i) => i + 2);
  for (let k = 0; k < 2 && tiers.length; k++) {
    const t = tiers.splice(Math.floor(r.float() * tiers.length), 1)[0];
    // (the drowned are a chapel's alone)
    if (t === 7 && w.kind !== 'chapel') continue;
    out.push(LINE[t][r.float() < 0.75 ? 0 : 1]);
  }
  return out.sort((a, b) => UNITS[a].tier - UNITS[b].tier);
}

const taken = new WeakMap<Game, Map<string, number>>();
function takenOf(game: Game): Map<string, number> {
  let m = taken.get(game);
  if (!m) taken.set(game, (m = new Map()));
  return m;
}
const poolKey = (game: Game, w: Waystation, u: UnitId) => `${w.id}:${dayOf(game.wallNow())}:${u}`;

export function hirePool(game: Game, w: Waystation, u: UnitId): number {
  return Math.max(0, WAY_HIRE_DAY[UNITS[u].tier] - (takenOf(game).get(poolKey(game, w, u)) ?? 0));
}

const hirePer = (u: UnitId) => Math.round(UNITS[u].cost * WAY_HIRE_MUL);

/** The recruit window at the waystation she is moored at (src 'way'). */
export function wayDwellView(game: Game, s: PlayerSession): DwellView | null {
  const w = mooredAt(game, s);
  const ship = s.ship;
  if (!w || !ship) return null;
  const deep = keepsDeep(s);
  const rows: DwellRow[] = hireKinds(game, w).map((u) => {
    const d = UNITS[u];
    const room = mightRoom(ship.army, u, ship.shipLevel, ship.stats.crewMax, ship.armySlots);
    return {
      tier: d.tier, name: 'lair', up: d.up, pool: hirePool(game, w, u), growth: 0, label: WAY_LABEL[w.kind], art: WAY_ART[w.kind],
      units: [{ u, per: hirePer(u), goods: {}, room: Number.isFinite(room) ? room : -1 }],
      why: d.deep && !deep ? 'Only a captain of the Choir or of a cursed ship keeps the drowned.' : ship.shipLevel < TIER_SHIP_LEVEL[d.tier] ? `Men of tier ${d.tier} serve a ship of level ${TIER_SHIP_LEVEL[d.tier]} and up.` : null,
    };
  });
  // Owner, 2026-10-28: her island's dwellings open their tiers at every waystation too (dwell.ts, src 'way').
  const own = dwellView(game, s, 'way');
  // (a kind the waystation has of its own today stays its own row: one row a kind)
  const here = new Set(rows.flatMap((r) => r.units.map((x) => x.u)));
  if (own) for (const r of own.rows) {
    const units = r.units.filter((x) => !here.has(x.u));
    if (units.length) rows.push({ ...r, units });
  }
  return {
    src: 'way', place: w.kind, rows, ups: [], best: own?.best ?? null, army: ship.army.map((x) => ({ ...x })), slots: ship.armySlots, crew: ship.crew, crewMax: ship.stats.crewMax,
    gold: Math.floor(s.profile!.gold), have: {}, why: resBusy(game, s), week: weekView(game), picked: pickedRoom(s), pickedMax: pickedMax(s),
    might: Math.round(armyWeight(ship.army)), mightMax: Math.round(mightCap(ship.shipLevel, ship.stats.crewMax, ship.armySlots)),
  };
}

export const WAY_LABEL: Record<Waystation['kind'], [string, string]> = {
  tavern: ['Raft tavern', 'Плот-таверна'],
  chapel: ['Hulk chapel', 'Часовня на остове'],
  market: ['Floating market', 'Плавучий рынок'],
};
const WAY_ART: Record<Waystation['kind'], string> = { tavern: 'build_tavern', chapel: 'build_chapel', market: 'tab_market' };

/** Men of a kind hired at the waystation she is moored at. */
export function wayRecruit(game: Game, s: PlayerSession, u: UnitId, want: number): string | null {
  const w = mooredAt(game, s);
  const ship = s.ship;
  if (!w || !ship) return 'Moor at a floating waystation first.';
  const busy = resBusy(game, s);
  if (busy) return busy;
  if (!hireKinds(game, w).includes(u)) {
    // her island's men (dwell.ts): the island's pool, the port's price
    const e = dwellRecruit(game, s, 'way', u, want);
    if (e === 'No dwelling of theirs here.' || e === 'You have no island of your own.') return 'Nobody of that kind waits here today.';
    if (!e) {
      game.sendTo(s, { t: 'way', view: wayView(game, s, w) });
      pushFallen(game, s);
    }
    return e;
  }
  const d = UNITS[u];
  if (d.deep && !keepsDeep(s)) return 'Only a captain of the Choir or of a cursed ship keeps the drowned.';
  if (ship.shipLevel < TIER_SHIP_LEVEL[d.tier]) return `Men of tier ${d.tier} serve a ship of level ${TIER_SHIP_LEVEL[d.tier]} and up.`;
  const picked = d.tier >= PICKED_TIER ? pickedRoom(s) : Infinity;
  const might = mightRoom(ship.army, u, ship.shipLevel, ship.stats.crewMax, ship.armySlots);
  const per = hirePer(u);
  const n = Math.min(Math.floor(Number(want)), hirePool(game, w, u), ship.stats.crewMax - ship.crew, picked, might, Math.floor(s.profile!.gold / per));
  if (!Number.isFinite(n) || n <= 0) {
    if (hirePool(game, w, u) <= 0) return 'Nobody left for hire here today.';
    if (ship.crew >= ship.stats.crewMax) return lackHammocks(1, ship.crew, ship.stats.crewMax);
    if (picked <= 0) return `A ship of level ${ship.shipLevel} berths ${pickedMax(s)} picked men (tier 4 and up) at most.`;
    if (might <= 0) return `Your crew is as strong as a ship of level ${ship.shipLevel} carries: raise her level for better men.`;
    return `Needs ${per} silver`;
  }
  if (!ship.army.some((x) => x.u === u) && ship.army.length >= ship.armySlots) return lackSlot(ship.army.length, ship.armySlots);
  const cost = n * per;
  const got = raiseAboard(game, s, u, n);
  if (got <= 0) return lackHammocks(1, ship.crew, ship.stats.crewMax);
  s.profile!.gold -= got * per;
  takenOf(game).set(poolKey(game, w, u), (takenOf(game).get(poolKey(game, w, u)) ?? 0) + got);
  s.profile!.stats.recruited = (s.profile!.stats.recruited ?? 0) + got;
  game.db.ledger(s.accountId, 'recruit', -got * per, `way:${u}:${got}`);
  game.toastShip(ship, `${got} men sign on at the waystation for ${got === n ? cost : got * per} silver.`, 'good');
  game.sendTo(s, { t: 'way', view: wayView(game, s, w) });
  pushFallen(game, s);
  return null;
}

// ------------------------------------------------------------------------------------------------ the wire

export function wayMessage(game: Game, s: PlayerSession, msg: WayClientMsg): void {
  const err = (m: string | null) => {
    if (m) game.refuse(s, m, 'way');
  };
  switch (msg.action) {
    case 'moor':
      return err(moor(game, s, Number(msg.id)));
    case 'leave':
      return castOff(game, s);
    case 'view': {
      const w = mooredAt(game, s);
      if (w) game.sendTo(s, { t: 'way', view: wayView(game, s, w) });
      return pushFallen(game, s);
    }
    case 'repair': {
      const w = mooredAt(game, s);
      if (!w) return err('Moor at a floating waystation first.');
      err(wayRepair(game, s));
      game.pushSelf(s, true);
      return void game.sendTo(s, { t: 'way', view: wayView(game, s, w) });
    }
    case 'res': {
      const u = msg.u !== undefined && Object.hasOwn(UNITS, String(msg.u)) ? (String(msg.u) as UnitId) : undefined;
      if (msg.u !== undefined && !u) return err('Not now');
      if (msg.via === 'instant') return; // (the infirmary is the shop's: premium 'shop' with the offer 'refill')
      const e = resurrect(game, s, u, msg.via === 'scroll' ? 'scroll' : 'silver', String(msg.rid ?? ''));
      err(e);
      if (e) pushFallen(game, s);
      return;
    }
  }
}

// ------------------------------------------------------------------------------------------------ the admin

/** `/way [go|fallen [kind n]|clear|list]`: the QA's hand on the waystations and the record. */
export function adminWay(game: Game, s: PlayerSession, args: string[]): string {
  const ship = s.ship!;
  const sub = args[0] ?? 'go';
  if (sub === 'go') {
    const w = wayNear(game.world, ship.state.x, ship.state.y, 6000);
    if (!w) return 'No waystation within 6 km.';
    ship.state.x = w.x - 120;
    ship.state.y = w.y + 40;
    ship.state.speed = 0;
    return `At waystation #${w.id}, a cable off.`;
  }
  if (sub === 'fallen') {
    const u = (args[1] && Object.hasOwn(UNITS, args[1]) ? args[1] : null) as UnitId | null;
    const n = Math.max(1, Math.min(9999, Math.trunc(Number(args[2])) || 12));
    const lost: { u: UnitId; n: number }[] = u ? [{ u, n }] : ship.army.map((x) => ({ u: x.u, n: Math.max(1, Math.round(x.n * 0.3)) }));
    for (const x of lost) ship.loseFrom(x.u, Math.min(x.n, ship.army.find((y) => y.u === x.u)?.n ?? 0));
    recordFallen(game, s, lost);
    game.pushSelf(s, true);
    return `${lost.reduce((a, x) => a + x.n, 0)} fallen on the record.`;
  }
  if (sub === 'clear') {
    (s.profile as unknown as WithFallen).fallen = { list: [], battles: [], done: [] };
    pushFallen(game, s);
    return 'The record of the fallen cleared.';
  }
  const v = resView(game, s);
  return `${v.fallen} fallen on the record; ${v.n} may stand again here for ${v.silver} silver and ${v.doubloons} doubloons.`;
}
