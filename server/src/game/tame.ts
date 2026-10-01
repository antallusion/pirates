// docs/18 IV on the server, the creatures as a family of the army (items 36–39, 41, 42): what each captain keeps of
// her creatures — their hunger and their wins, kind by kind; their own food at sea (fish for the sea's and the land's,
// rum or bone for the deep's — never the crew's provisions) eaten every tenth second with the crew's; the starving and
// the unhappy slipping over the side; the fed and victorious rising in rank; the morale of a mixed army and the ranks
// on the stacks she brings to a battle; the beaten who follow her after a fight won; the pen of her island that keeps
// those beyond her slots; the tamers of some ports who buy and sell them. Every roll here is on this system's own Rng.

import { UNITS } from '../../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../../shared/src/data/army.ts';
import { BEAST_PLURAL, isCreature } from '../../../shared/src/data/bestiary.ts';
import type { CreatureId } from '../../../shared/src/data/bestiary.ts';
import { FOOD_GOODS, HUNGRY_AFTER, LOW_MORALE, LOW_SLIP_CHANCE, LOW_SLIP_SHARE, NATIVE, PEN_STOCK, RANK_MAX, RANK_WINS, SLIP_AFTER, SLIP_CHANCE, SLIP_SHARE, armyPeoples, captureCount, captureShare, foodOf, foodPerMin, hasTamer, mixMorale, peopleOf, penLoad, rankFor, tamerAsks, tamerPays, tamerStock, upkeepHour } from '../../../shared/src/data/drifts.ts';
import type { Food } from '../../../shared/src/data/drifts.ts';
import { rankOf } from '../../../shared/src/data/hero.ts';
import type { CaptureOffer, TameStack, TameView } from '../../../shared/src/driftproto.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import { lyingOff, mine as ownBase } from './base.ts';
import type { Yard } from './base.ts';
import { thisWeek } from './calendar.ts';
import { reconcile } from './crew.ts';
import type { Game } from './Game.ts';
import { heroOf } from './hero.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { keepsDeep, townLevel, townState } from './town.ts';
import type { TacArmyEntry } from './tacbattle.ts';

/** What a captain keeps of her creatures, kind by kind: wins (fed) and seconds unfed. */
export interface TameRec {
  w: number;
  h: number;
  /** Told she is hungry this time (once an episode). */
  t?: boolean;
}
export interface TameProfile {
  k: Partial<Record<UnitId, TameRec>>;
  /** The land's bone eaten in fractions (a deep kind's rum run out). */
  bone: number;
  /** The next minute her creatures are looked at for slipping away. */
  next: number;
}

export function tameOf(p: Profile): TameProfile {
  const t = (p.tame ??= { k: {}, bone: 0, next: 0 });
  t.k ??= {};
  if (!Number.isFinite(t.bone)) t.bone = 0;
  if (!Number.isFinite(t.next)) t.next = 0;
  for (const [u, r] of Object.entries(t.k) as [UnitId, TameRec][]) {
    if (!isCreature(u) || !r) delete t.k[u];
    else {
      r.w = Math.max(0, Math.floor(r.w ?? 0));
      r.h = Math.max(0, r.h ?? 0);
    }
  }
  return t;
}

const recOf = (p: Profile, u: UnitId): TameRec => (tameOf(p).k[u] ??= { w: 0, h: 0 });

/** The creatures a ship carries, and the men (who alone eat the provisions). */
export function creaturesAboard(ship: ShipEntity): number {
  let n = 0;
  for (const s of ship.army) if (UNITS[s.u]?.beast) n += s.n;
  return n;
}

export const beastsName = (u: UnitId): string => (isCreature(u) ? BEAST_PLURAL[u][0] : u);

const all = new WeakMap<Game, Rng>();
/** This system's own dice. */
export function tameRng(game: Game): Rng {
  let r = all.get(game);
  if (!r) all.set(game, (r = new Rng(0x7a3e18)));
  return r;
}

/** A kind's rank as it stands. */
export function rankOfKind(p: Profile | null | undefined, u: UnitId): number {
  if (!p || !UNITS[u]?.beast) return 0;
  return rankFor(tameOf(p).k[u]?.w ?? 0);
}

// ------------------------------------------------------------------------------------------------ 37. the food

/** Her creatures' own food, every tenth second of her ship (with the crew's provisions): fish for the sea's and the
 *  land's (fresh first, it spoils; then salted and smoked, two units a barrel), rum for the deep's — then the land's
 *  bone from her store. The fed lose their hunger; the unfed gather it. */
export function feedCreatures(game: Game, ship: ShipEntity, secs = 10): void {
  const s = game.sessionOf(ship);
  const p = s?.profile;
  if (!s || !p || !ship.army.some((x) => UNITS[x.u]?.beast)) return;
  const t = tameOf(p);
  const need: Record<Food, number> = { fish: 0, rum: 0 };
  for (const x of ship.army) if (UNITS[x.u]?.beast) need[foodOf(x.u)] += (foodPerMin(x.u, x.n) * secs) / 60;
  const fed: Record<Food, boolean> = { fish: true, rum: true };
  for (const f of ['fish', 'rum'] as Food[]) {
    let left = need[f];
    if (left <= 0) continue;
    for (const [g, per] of FOOD_GOODS[f]) {
      if (left <= 1e-9) break;
      const have = ship.cargo[g] ?? 0;
      if (have <= 0) continue;
      const take = Math.min(have, left / per);
      const rest = Math.round((have - take) * 1000) / 1000;
      if (rest <= 0.001) delete ship.cargo[g];
      else ship.cargo[g] = rest;
      left -= take * per;
    }
    // The deep's own gnaw the land's bone when the rum is gone.
    if (f === 'rum' && left > 1e-9 && p.lairs && (p.lairs.res.bone ?? 0) > 0) {
      t.bone += left;
      left = 0;
      const whole = Math.floor(t.bone);
      if (whole > 0) {
        p.lairs.res.bone = Math.max(0, p.lairs.res.bone - whole);
        t.bone -= whole;
      }
    }
    fed[f] = left <= 1e-6;
  }
  for (const x of ship.army) {
    if (!UNITS[x.u]?.beast) continue;
    const r = recOf(p, x.u);
    if (fed[foodOf(x.u)]) {
      r.h = Math.max(0, r.h - secs * 3);
      if (r.h === 0) r.t = false;
    } else {
      r.h += secs;
      if (r.h >= HUNGRY_AFTER && !r.t) {
        r.t = true;
        game.toastShip(ship, foodOf(x.u) === 'rum' ? `The ${beastsName(x.u)} want rum: there is none aboard, nor bone in your store.` : `The ${beastsName(x.u)} are hungry: fish for them in the hold, or they will slip away.`, 'bad');
      }
    }
  }
}

/** Every second: the creatures of each captain at sea looked at once a minute — the starving and, with the crew's
 *  heart low, the unhappy slip over the side (docs/18 #39). */
export function stepTame(game: Game): void {
  const rng = tameRng(game);
  for (const s of game.sessions) {
    const ship = s.ship, p = s.profile;
    if (!ship || !p || !ship.alive || ship.docked || ship.boarding) continue;
    if (!ship.army.some((x) => UNITS[x.u]?.beast)) continue;
    const t = tameOf(p);
    if (game.now < t.next) continue;
    t.next = game.now + 60;
    for (const x of [...ship.army]) {
      if (!UNITS[x.u]?.beast) continue;
      const r = recOf(p, x.u);
      let share = 0;
      if (r.h >= SLIP_AFTER && rng.chance(SLIP_CHANCE)) share = SLIP_SHARE;
      else if (ship.morale < LOW_MORALE && !UNITS[x.u].legend && rng.chance(LOW_SLIP_CHANCE)) share = LOW_SLIP_SHARE;
      if (share <= 0) continue;
      const n = Math.max(1, Math.round(x.n * share));
      const gone = ship.loseFrom(x.u, n);
      if (gone <= 0) continue;
      reconcile(game, p.company, ship.crew);
      ship.companyKey = '';
      if (!ship.army.some((y) => y.u === x.u)) delete t.k[x.u];
      game.toastShip(ship, r.h >= SLIP_AFTER ? `${gone} of the ${beastsName(x.u)} slip over the side in the night: they were starving.` : `${gone} of the ${beastsName(x.u)} slip away: the crew’s heart is low and they feel it.`, 'bad');
      game.pushSelf(s, true);
    }
  }
}

// ------------------------------------------------------------------------------------------------ 38–39. the battle

/** Her army as it comes to a battle: each creature kind's rank on its stack (docs/18 #39). */
export function rankArmy(p: Profile | null | undefined, army: TacArmyEntry[]): TacArmyEntry[] {
  if (!p) return army;
  for (const e of army) {
    const r = rankOfKind(p, e.u);
    if (r > 0) e.rank = r;
  }
  return army;
}

/** The mixed army's morale for her (docs/18 #38). */
export function mixedOf(p: Profile | null | undefined, army: readonly { u: UnitId; n: number }[]): number {
  if (!p) return 0;
  return mixMorale(army, p.captain);
}

/** A battle won: each creature kind of hers that fought in it, fed, has a win; a third, seventh, twelfth win raises
 *  its rank (docs/18 #39). */
export function creaturesWon(game: Game, ship: ShipEntity, fought: readonly UnitId[]): void {
  const s = game.sessionOf(ship);
  const p = s?.profile;
  if (!s || !p) return;
  for (const u of new Set(fought)) {
    if (!UNITS[u]?.beast || !ship.army.some((x) => x.u === u)) continue;
    const r = recOf(p, u);
    if (r.h >= HUNGRY_AFTER) continue;
    const was = rankFor(r.w);
    r.w++;
    const now = rankFor(r.w);
    if (now > was) game.toastShip(ship, `Your ${beastsName(u)} have fought well and grown: they are ${RANK_EN[now]} now.`, 'gold');
  }
}
const RANK_EN = ['', 'seasoned', 'hardened', 'elder'];

/** New creatures of a kind into her army: their wins thinned by the newcomers (a rank is earned by the stack). */
function thinWins(p: Profile, u: UnitId, had: number, added: number): void {
  const r = tameOf(p).k[u];
  if (!r || had + added <= 0) return;
  r.w = Math.floor((r.w * had) / (had + added));
}

// ------------------------------------------------------------------------------------------------ joining

/** How many of a kind her army has room for: a slot of their own (or the stack aboard) and the hammocks. */
export function creatureRoom(ship: ShipEntity, u: UnitId): number {
  const own = ship.army.some((x) => x.u === u);
  if (!own && ship.army.length >= ship.armySlots) return 0;
  return Math.max(0, ship.stats.crewMax - ship.crew);
}

/** Creatures of a kind into her army, as far as the room goes; how many came aboard. */
export function joinCreatures(game: Game, s: PlayerSession, u: UnitId, n: number): number {
  const ship = s.ship!;
  const k = Math.max(0, Math.min(Math.floor(n), creatureRoom(ship, u)));
  if (k <= 0) return 0;
  const had = ship.army.find((x) => x.u === u)?.n ?? 0;
  const c = s.profile!.company;
  reconcile(game, c, ship.crew);
  ship.addMen(u, k);
  c.pools.sailor += k;
  ship.companyKey = '';
  thinWins(s.profile!, u, had, k);
  recOf(s.profile!, u);
  return k;
}

// ------------------------------------------------------------------------------------------------ 41. the pen

type PenTown = ReturnType<typeof townState> & { penStock?: Partial<Record<CreatureId, number>> };

function stockOf(y: Yard): Partial<Record<CreatureId, number>> {
  const t = townState(y) as PenTown;
  t.penStock ??= {};
  for (const [u, n] of Object.entries(t.penStock) as [CreatureId, number][]) if (!isCreature(u) || !(n > 0)) delete t.penStock[u];
  return t.penStock;
}

/** Her pen's room (heads by tier) for a kind, wherever she is: 0 with no pen or none to spare. */
export function penRoom(game: Game, s: PlayerSession, u: UnitId): number {
  if (!isCreature(u) || UNITS[u].legend) return UNITS[u]?.legend ? penRoomLegend(game, s) : 0;
  const m = ownBase(game, s);
  if (typeof m === 'string') return 0;
  const lv = townLevel(m.y, 'pen');
  if (lv <= 0) return 0;
  const free = PEN_STOCK[Math.min(PEN_STOCK.length - 1, lv)] - penLoad(stockOf(m.y));
  return Math.max(0, Math.floor(free / UNITS[u].tier));
}
function penRoomLegend(game: Game, s: PlayerSession): number {
  const m = ownBase(game, s);
  if (typeof m === 'string' || townLevel(m.y, 'pen') < 2) return 0;
  const free = PEN_STOCK[2] - penLoad(stockOf(m.y));
  return free >= 7 ? 1 : 0;
}

/** Creatures sent home to her pen (from a rescue, a capture, or her army lying off the island); how many went. */
export function sendToPen(game: Game, s: PlayerSession, u: UnitId, n: number): number {
  if (!isCreature(u)) return 0;
  const k = Math.max(0, Math.min(Math.floor(n), penRoom(game, s, u)));
  if (k <= 0) return 0;
  const m = ownBase(game, s);
  if (typeof m === 'string') return 0;
  const st = stockOf(m.y);
  st[u] = (st[u] ?? 0) + k;
  game.holdings.touch();
  return k;
}

/** Her army's creatures of a kind into the pen (lying off her island). */
export function toPen(game: Game, s: PlayerSession, u: UnitId, n: number): string | null {
  const ship = s.ship;
  if (!ship || !isCreature(u)) return 'No such creatures aboard';
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  if (townLevel(m.y, 'pen') <= 0) return 'Build a pen in your town first.';
  if (!lyingOff(game, s, m.h)) return 'Bring your ship to the island to carry it ashore.';
  const have = ship.army.find((x) => x.u === u)?.n ?? 0;
  const want = Math.min(have, Math.floor(Number(n)));
  if (!(want > 0)) return 'No such creatures aboard';
  if (ship.army.length <= 1 && want >= have) return 'Keep at least one stack aboard';
  const k = Math.min(want, penRoom(game, s, u));
  if (k <= 0) return 'The pen is full: raise it a level for more room.';
  ship.loseFrom(u, k);
  sendToPen(game, s, u, k);
  reconcile(game, s.profile!.company, ship.crew);
  ship.companyKey = '';
  if (!ship.army.some((x) => x.u === u)) delete tameOf(s.profile!).k[u];
  game.toastShip(ship, `${k} ${beastsName(u)} go ashore to the pen of your island.`, 'good');
  return null;
}

/** Creatures of a kind out of the pen into her army (lying off her island). */
export function fromPen(game: Game, s: PlayerSession, u: UnitId, n: number): string | null {
  const ship = s.ship;
  if (!ship || !isCreature(u)) return 'None of them in the pen.';
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  if (!lyingOff(game, s, m.h)) return 'Bring your ship to the island to take the men aboard.';
  const st = stockOf(m.y);
  const have = st[u] ?? 0;
  if (have <= 0) return 'None of them in the pen.';
  const room = creatureRoom(ship, u);
  if (room <= 0) return ship.army.length >= ship.armySlots && !ship.army.some((x) => x.u === u) ? 'No free slot in the army for a new kind of man.' : 'No hammocks left aboard';
  const k = joinCreatures(game, s, u, Math.min(have, Math.floor(Number(n)) || have));
  if (k <= 0) return 'No hammocks left aboard';
  st[u] = have - k;
  if (!st[u]) delete st[u];
  game.holdings.touch();
  game.toastShip(ship, `${k} ${beastsName(u)} come aboard from the pen.`, 'good');
  return null;
}

/** Let a kind go (into the sea, or ashore). */
export function release(game: Game, s: PlayerSession, u: UnitId, n: number): string | null {
  const ship = s.ship;
  if (!ship || !UNITS[u]?.beast) return 'No such creatures aboard';
  if (ship.boarding) return 'Not in the middle of a boarding';
  const have = ship.army.find((x) => x.u === u)?.n ?? 0;
  const k = Math.min(have, Math.floor(Number(n)) || have);
  if (!(k > 0)) return 'No such creatures aboard';
  if (ship.army.length <= 1 && k >= have) return 'Keep at least one stack aboard';
  ship.loseFrom(u, k);
  reconcile(game, s.profile!.company, ship.crew);
  ship.companyKey = '';
  if (!ship.army.some((x) => x.u === u)) delete tameOf(s.profile!).k[u];
  game.toastShip(ship, `You let ${k} ${beastsName(u)} go.`, 'info');
  return null;
}

// ------------------------------------------------------------------------------------------------ 36. the capture

/** The offer of the beaten after a fight won (docs/18 #36): of their largest kind that may serve her, the share by
 *  her might over theirs, her Leadership, her path and her crew's morale, as her room goes (and her pen's). `rule`:
 *  'never' (a grotto's, a guardian's, a legend), 'deep' (the drowned and the Choir only with their own). */
export function captureOffer(game: Game, s: PlayerSession, beaten: readonly ArmyStack[], ratio: number, rule: 'yes' | 'deep' | 'never'): CaptureOffer | undefined {
  if (rule === 'never') return undefined;
  const ship = s.ship!, p = s.profile!;
  const deepOk = keepsDeep(s) || p.captain === 'drowned';
  const kinds = beaten.filter((x) => x.n > 0 && UNITS[x.u]?.beast && !UNITS[x.u].legend && (peopleOf(x.u) !== 'deep' || deepOk) && !(rule === 'deep' && !deepOk)).sort((a, b) => b.n * UNITS[b.u].cost - a.n * UNITS[a.u].cost);
  const best = kinds[0];
  if (!best) return undefined;
  const leadership = rankOf(heroOf(p).skills, 'leadership');
  const native = !!p.captain && NATIVE[p.captain] === peopleOf(best.u);
  const share = captureShare({ ratio, leadership, native, morale: ship.morale });
  const n = captureCount(best.n, share);
  if (n <= 0) return undefined;
  return { u: best.u, n, share: Math.round(share * 100) / 100, room: Math.min(n, creatureRoom(ship, best.u)), pen: Math.min(n, penRoom(game, s, best.u)) };
}

/** Her choice on the offer: aboard (as far as the room goes, the rest to the pen if there is one), home to the pen,
 *  or let them go. */
export function captureTake(game: Game, s: PlayerSession, o: CaptureOffer, choice: 'take' | 'pen' | 'free'): string | null {
  if (o.done) return 'Chosen already';
  const ship = s.ship!;
  if (choice === 'free') {
    o.done = 'free';
    game.toastShip(ship, `You let the beaten ${beastsName(o.u)} go.`, 'info');
    return null;
  }
  if (choice === 'pen') {
    const k = sendToPen(game, s, o.u, o.n);
    if (k <= 0) return 'Your pen has no room for them.';
    o.done = 'pen';
    game.toastShip(ship, `${k} ${beastsName(o.u)} are sent home to the pen of your island.`, 'good');
    return null;
  }
  const k = joinCreatures(game, s, o.u, o.n);
  if (k <= 0) return creatureRoom(ship, o.u) <= 0 && !ship.army.some((x) => x.u === o.u) && ship.army.length >= ship.armySlots ? 'No free slot in the army for a new kind of man.' : 'No hammocks left aboard';
  const rest = o.n - k;
  const home = rest > 0 ? sendToPen(game, s, o.u, rest) : 0;
  o.done = 'take';
  game.toastShip(ship, home > 0 ? `${k} ${beastsName(o.u)} follow you aboard; ${home} more go home to your pen.` : `${k} ${beastsName(o.u)} follow you aboard.`, 'good');
  game.pushSelf(s, true);
  return null;
}

// ------------------------------------------------------------------------------------------------ 42. the tamer

interface TamerStore {
  /** Each port's week and what she has sold of her pens this week. */
  [port: string]: { w: number; sold: Partial<Record<CreatureId, number>> };
}
const TKEY = 'h18:tamer';
const stores = new WeakMap<Game, TamerStore>();
function tamerStore(game: Game): TamerStore {
  let x = stores.get(game);
  if (!x) stores.set(game, (x = game.db.getKv<TamerStore>(TKEY) ?? {}));
  return x;
}

function tamerPort(game: Game, s: PlayerSession) {
  const port = s.ship?.docked ? game.portById(s.ship.docked) : undefined;
  return port && hasTamer(port) ? port : undefined;
}

function tamerPens(game: Game, s: PlayerSession, portId: string): { u: CreatureId; n: number }[] {
  const port = game.portById(portId)!;
  const w = thisWeek(game);
  const st = tamerStore(game);
  const rec = st[portId] && st[portId].w === w ? st[portId] : (st[portId] = { w, sold: {} });
  const level = sectorAt(game.world, port.x, port.y).level;
  return tamerStock(portId, level, w, keepsDeep(s) || s.profile?.captain === 'drowned').map((x) => ({ u: x.u, n: Math.max(0, x.n - (rec.sold[x.u] ?? 0)) }));
}

export function tamerSell(game: Game, s: PlayerSession, u: UnitId, n: number): string | null {
  const port = tamerPort(game, s);
  if (!port) return 'No tamer in this port.';
  const ship = s.ship!;
  if (!UNITS[u]?.beast) return 'The tamer buys creatures, not men.';
  if (UNITS[u].legend) return 'Not even a tamer would put a price on a legend.';
  const have = ship.army.find((x) => x.u === u)?.n ?? 0;
  const k = Math.min(have, Math.floor(Number(n)) || have);
  if (!(k > 0)) return 'No such creatures aboard';
  if (ship.army.length <= 1 && k >= have) return 'Keep at least one stack aboard';
  const price = tamerPays(u, rankOfKind(s.profile, u)) * k;
  ship.loseFrom(u, k);
  reconcile(game, s.profile!.company, ship.crew);
  ship.companyKey = '';
  if (!ship.army.some((x) => x.u === u)) delete tameOf(s.profile!).k[u];
  s.profile!.gold += price;
  game.db.ledger(s.accountId, 'tamer', price, `sell:${u}:${k}`);
  game.toastShip(ship, `The tamer takes ${k} ${beastsName(u)} for ${price} silver.`, 'gold');
  return null;
}

export function tamerBuy(game: Game, s: PlayerSession, u: UnitId, n: number): string | null {
  const port = tamerPort(game, s);
  if (!port) return 'No tamer in this port.';
  const ship = s.ship!;
  const pens = tamerPens(game, s, port.id);
  const row = pens.find((x) => x.u === u);
  if (!row || row.n <= 0) return 'The tamer has none of them this week.';
  const room = creatureRoom(ship, u);
  if (room <= 0) return ship.army.length >= ship.armySlots && !ship.army.some((x) => x.u === u) ? 'No free slot in the army for a new kind of man.' : 'No hammocks left aboard';
  const per = tamerAsks(u);
  const k = Math.min(row.n, room, Math.floor(Number(n)) || 1, Math.floor(s.profile!.gold / per));
  if (k <= 0) return `Needs ${per} silver`;
  s.profile!.gold -= k * per;
  game.db.ledger(s.accountId, 'tamer', -k * per, `buy:${u}:${k}`);
  joinCreatures(game, s, u, k);
  const st = tamerStore(game);
  st[port.id].sold[u as CreatureId] = (st[port.id].sold[u as CreatureId] ?? 0) + k;
  game.db.setKv(TKEY, st);
  game.toastShip(ship, `${k} ${beastsName(u)} join your army from the tamer’s pens for ${k * per} silver.`, 'good');
  return null;
}

// ------------------------------------------------------------------------------------------------ the window

export function tameView(game: Game, s: PlayerSession): TameView {
  const ship = s.ship!, p = s.profile!;
  const t = tameOf(p);
  const stacks: TameStack[] = ship.army.filter((x) => UNITS[x.u]?.beast).map((x) => {
    const r = t.k[x.u] ?? { w: 0, h: 0 };
    const rank = rankFor(r.w);
    return { u: x.u, n: x.n, people: peopleOf(x.u), food: foodOf(x.u), perMin: Math.round(foodPerMin(x.u, x.n) * 100) / 100, hunger: Math.round(r.h), rank, wins: r.w, next: rank >= RANK_MAX ? 0 : RANK_WINS[rank + 1] - r.w };
  });
  const units = (f: Food) => FOOD_GOODS[f].reduce((a, [g, per]) => a + (ship.cargo[g] ?? 0) * per, 0);
  const perHour = { fish: 0, rum: 0 };
  for (const x of stacks) perHour[x.food] += x.perMin * 60;
  let pen: TameView['pen'] = null;
  const m = ownBase(game, s);
  if (typeof m !== 'string' && townLevel(m.y, 'pen') > 0) {
    const lv = townLevel(m.y, 'pen');
    const st = stockOf(m.y);
    pen = { here: lyingOff(game, s, m.h), level: lv, load: penLoad(st), cap: PEN_STOCK[Math.min(PEN_STOCK.length - 1, lv)], stock: (Object.entries(st) as [CreatureId, number][]).map(([u, n]) => ({ u, n })) };
  }
  let tamer: TameView['tamer'] = null;
  const port = tamerPort(game, s);
  if (port) {
    tamer = {
      port: port.name,
      buys: ship.army.filter((x) => UNITS[x.u]?.beast && !UNITS[x.u].legend).map((x) => ({ u: x.u, n: x.n, price: tamerPays(x.u, rankOfKind(p, x.u)) })),
      sells: tamerPens(game, s, port.id).map((x) => ({ u: x.u, n: x.n, price: tamerAsks(x.u) })),
    };
  }
  return {
    stacks, food: { fish: Math.floor(units('fish')), rum: Math.floor(units('rum')), bone: p.lairs?.res.bone ?? 0 },
    perHour: { fish: Math.round(perHour.fish * 10) / 10, rum: Math.round(perHour.rum * 10) / 10 }, silverHour: Math.round(upkeepHour(ship.army)),
    morale: mixMorale(ship.army, p.captain), peoples: armyPeoples(ship.army, p.captain), path: p.captain ?? null,
    slots: ship.armySlots, stacksN: ship.army.length, crew: ship.crew, crewMax: ship.stats.crewMax, pen, tamer, gold: Math.floor(p.gold),
  };
}

export function sendTame(game: Game, s: PlayerSession): void {
  if (!s.ship || !s.profile) return;
  game.sendTo(s, { t: 'tame', view: tameView(game, s) });
}

/** Whether the port she lies in keeps a tamer (the harbour's card). */
export function tamerHere(game: Game, s: PlayerSession): boolean {
  return !!tamerPort(game, s);
}

// ------------------------------------------------------------------------------------------------ the tester's console

/** `/tame [kind] [wins N|hunger S|rank R|pen N]`: a creature kind's record (the first of her army's without a kind). */
export function adminTame(game: Game, s: PlayerSession, args: string[]): string {
  const ship = s.ship!, p = s.profile!;
  const u = (args.find((a) => isCreature(a)) as UnitId | undefined) ?? ship.army.find((x) => UNITS[x.u]?.beast)?.u;
  if (!u) return 'No creatures in your army: /creature kind n first.';
  const r = recOf(p, u);
  const at = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? Number(args[i + 1]) : NaN;
  };
  if (Number.isFinite(at('wins'))) r.w = Math.max(0, Math.floor(at('wins')));
  if (Number.isFinite(at('rank'))) r.w = RANK_WINS[Math.max(0, Math.min(RANK_MAX, Math.floor(at('rank'))))];
  if (Number.isFinite(at('hunger'))) r.h = Math.max(0, at('hunger'));
  if (Number.isFinite(at('pen'))) {
    const k = sendToPen(game, s, u, Math.max(1, Math.floor(at('pen'))));
    return k > 0 ? `${k} ${beastsName(u)} into your pen.` : 'Your pen has no room for them.';
  }
  if (args.includes('slip')) {
    tameOf(p).next = 0;
    r.h = Math.max(r.h, SLIP_AFTER);
  }
  sendTame(game, s);
  game.pushSelf(s, true);
  return `${beastsName(u)}: ${r.w} wins, rank ${rankFor(r.w)}, ${Math.round(r.h)} s unfed; morale of the army ${mixMorale(ship.army, p.captain)}.`;
}

/** `/feed [N|starve]`: N units of fish and of rum into the hold (20 without), or every creature's hunger at the edge. */
export function adminFeed(game: Game, s: PlayerSession, args: string[]): string {
  const ship = s.ship!, p = s.profile!;
  if (args[0] === 'starve') {
    for (const g of ['fish', 'salted_fish', 'smoked_fish', 'prime_fish', 'rum'] as const) delete ship.cargo[g];
    for (const x of ship.army) if (UNITS[x.u]?.beast) recOf(p, x.u).h = SLIP_AFTER;
    tameOf(p).next = 0;
    sendTame(game, s);
    game.pushSelf(s, true);
    return 'No fish nor rum aboard; your creatures are starving.';
  }
  const n = Math.max(1, Math.min(2000, Math.round(Number(args[0] ?? 20)) || 20));
  ship.cargo.fish = (ship.cargo.fish ?? 0) + n;
  ship.cargo.rum = (ship.cargo.rum ?? 0) + n;
  for (const x of ship.army) if (UNITS[x.u]?.beast) {
    const r = recOf(p, x.u);
    r.h = 0;
    r.t = false;
  }
  sendTame(game, s);
  game.pushSelf(s, true);
  return `${n} fish and ${n} rum into your hold; your creatures are fed.`;
}

/** `/tamer [go]`: the nearest port that keeps a tamer (go: set down in it and make port). */
export function adminTamer(game: Game, s: PlayerSession, args: string[]): string {
  const ship = s.ship!;
  let best: (typeof game.world.ports)[number] | undefined, bd = Infinity;
  for (const pt of game.world.ports) {
    if (!hasTamer(pt)) continue;
    const d = Math.hypot(pt.x - ship.state.x, pt.y - ship.state.y);
    if (d < bd) [best, bd] = [pt, d];
  }
  if (!best) return 'No port keeps a tamer.';
  if (args[0] !== 'go') return `The nearest tamer: ${best.name}, ${Math.round(bd / 100) / 10} km.`;
  if (ship.docked) game.undock(s);
  const is = game.world.islands[best.islandId];
  const d = Math.hypot(best.x - is.x, best.y - is.y) || 1;
  const x = best.x + ((best.x - is.x) / d) * 150, y = best.y + ((best.y - is.y) / d) * 150;
  ship.state = { ...ship.state, x, y, speed: 0, sail: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, x, y);
  const why = (game as unknown as { tryDock(s: PlayerSession): string | null }).tryDock(s);
  game.pushSelf(s, true);
  if (why) return why;
  sendTame(game, s);
  return `In port at ${best.name}: the tamer's pens are open.`;
}
