// The mines of the Heroes (docs/17 H3 item 12): sites on wild islands (shared/src/data/mines.ts), taken by planting
// one's flag — a short landing — and paying every dawn of the sea's calendar: into the holder's island (the yard for
// the goods, the treasury for silver) or, for a captain without one, into a pile at the mine that her boats haul
// aboard at the next landing. Another captain's flag over it takes it (and the pile); the sea's raiders take the
// unwatched ones by their waters (a mine's own dice for each day, never the sea's rng), and must be beaten ashore
// before a flag goes up again. Half the lawless waters' mines start in the raiders' hands.

import { FLAG_HOLD_SECS, FLAG_SECS, MINES, MINES_MAX, MINE_STOCK_DAYS, RAID_DAY, buildMines, mineDaily, raidersGarrison } from '../../../shared/src/data/mines.ts';
import type { MineSite } from '../../../shared/src/data/mines.ts';
import { weekMines } from '../../../shared/src/data/week.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { MineView } from '../../../shared/src/h3proto.ts';
import { closestOnPolygon, dist } from '../../../shared/src/math.ts';
import { Rng, hashString } from '../../../shared/src/rng.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { depthAt } from '../../../shared/src/world/worldgen.ts';
import { capOf, yardOf } from './base.ts';
import { weekNow } from './calendar.ts';
import { ownIsland } from './estate.ts';
import type { Landing } from './exploration.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';
import type { ShipEntity } from './ship.ts';

/** RAIDERS: the sea's raiders hold it. */
const RAIDERS = -1;
const LAND_RANGE = 260;
const KEY = 'h3:mines';

interface MineState {
  /** The holder's account (RAIDERS; absent: nobody). */
  owner?: number;
  name?: string;
  /** World seconds: when the flag went up. */
  since?: number;
  /** What piled up for a holder with no island, and the fractions of a day's yield. */
  stock?: Partial<Record<GoodId | 'silver', number>>;
  carry?: number;
}

interface Mines {
  sites: MineSite[];
  st: Record<string, MineState>;
  ver: number;
}

const all = new WeakMap<Game, Mines>();

function mines(game: Game): Mines {
  let m = all.get(game);
  if (!m) {
    const sites = buildMines(game.world);
    const saved = game.db.getKv<Record<string, MineState>>(KEY);
    const st: Record<string, MineState> = saved ?? {};
    if (!saved) {
      // Half the lawless waters' mines are the raiders' when the sea begins (by each mine's own hash).
      for (const x of sites) if (REGIONS[x.region].safety === 'lawless' && hashString(`raiders:${x.id}`) % 2 === 0) st[x.id] = { owner: RAIDERS, since: 0 };
    }
    m = { sites, st, ver: 1 };
    all.set(game, m);
  }
  return m;
}

function save(game: Game): void {
  const m = mines(game);
  m.ver++;
  game.db.setKv(KEY, m.st);
}

export function mineSites(game: Game): MineSite[] {
  return mines(game).sites;
}

export function mineState(game: Game, id: string): MineState {
  return mines(game).st[id] ?? {};
}

export const minesVersion = (game: Game): number => mines(game).ver;

const goodOf = (x: MineSite): GoodId | 'silver' => (x.kind === 'silver' ? 'silver' : x.kind);

function holderOf(game: Game, s: PlayerSession, st: MineState): string | null {
  if (st.owner === undefined) return null;
  if (st.owner === RAIDERS) return 'raiders';
  if (st.owner === s.accountId) return 'you';
  return st.name ?? 'a captain';
}

function stockOf(st: MineState): number {
  return Math.floor(Object.values(st.stock ?? {}).reduce((a, n) => a + (n ?? 0), 0));
}

function view(game: Game, s: PlayerSession, x: MineSite): MineView {
  const st = mineState(game, x.id);
  const mine = st.owner === s.accountId;
  return {
    id: x.id, x: x.x, y: x.y, kind: x.kind, island: x.name, holder: holderOf(game, s, st), daily: Math.round(mineDaily(x.kind, x.region, weekMines(weekNow(game))) * 10) / 10,
    ...(mine ? { stock: stockOf(st) } : {}),
  };
}

/** Every mine for the chart: who holds it. */
export function minesView(game: Game, s: PlayerSession): MineView[] {
  return mines(game).sites.map((x) => view(game, s, x));
}

export function ownMines(game: Game, s: PlayerSession): MineView[] {
  return mines(game).sites.filter((x) => mineState(game, x.id).owner === s.accountId).map((x) => view(game, s, x));
}

/** What a captain's mines yield a day, by resource. */
export function minesDailyOf(game: Game, account: number): Partial<Record<GoodId | 'silver', number>> {
  const out: Partial<Record<GoodId | 'silver', number>> = {};
  const mul = weekMines(weekNow(game));
  for (const x of mines(game).sites) {
    if (mineState(game, x.id).owner !== account) continue;
    const g = goodOf(x);
    out[g] = Math.round(((out[g] ?? 0) + mineDaily(x.kind, x.region, mul)) * 10) / 10;
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ each dawn

/** Each dawn: every held mine pays its holder; the raiders try the unwatched ones. */
export function minesDay(game: Game, day: number, raids = true): void {
  const m = mines(game);
  const mul = weekMines(weekNow(game));
  let changed = false;
  for (const x of m.sites) {
    const st = m.st[x.id];
    if (!st || st.owner === undefined || st.owner === RAIDERS) continue;
    // The raiders' dice for this mine and this day.
    const r = new Rng(hashString(`mine:${x.id}:${day}`));
    if (raids && r.chance(RAID_DAY[REGIONS[x.region].safety])) {
      const was = st.owner;
      m.st[x.id] = { owner: RAIDERS, since: game.now };
      changed = true;
      tell(game, was, 'Raiders have taken your mine', `Raiders have taken your ${MINES[x.kind].name[0]} on ${x.name}. Beat them ashore and plant your flag again.`);
      continue;
    }
    pay(game, x, st, mineDaily(x.kind, x.region, mul));
    changed = true;
  }
  if (changed) save(game);
}

function pay(game: Game, x: MineSite, st: MineState, amount: number): void {
  const g = goodOf(x);
  const sum = (st.carry ?? 0) + amount;
  const whole = Math.floor(sum);
  st.carry = sum - whole;
  if (whole <= 0) return;
  const h = ownIsland(game, st.owner!);
  if (h) {
    if (g === 'silver') {
      h.treasury += whole;
      game.holdings.touch();
      return;
    }
    const y = yardOf(game, h);
    const room = Math.max(0, capOf(h) - (y.res[g] ?? 0));
    const k = Math.min(room, whole);
    if (k > 0) {
      y.res[g] = (y.res[g] ?? 0) + k;
      y.fresh[g] = (y.fresh[g] ?? 0) + k;
      game.holdings.touch();
    }
    if (whole - k <= 0) return;
    // A full yard: the rest waits at the mine.
    return pile(st, g, whole - k, mineDaily(x.kind, x.region) * MINE_STOCK_DAYS);
  }
  pile(st, g, whole, mineDaily(x.kind, x.region) * MINE_STOCK_DAYS);
}

function pile(st: MineState, g: GoodId | 'silver', n: number, cap: number): void {
  st.stock ??= {};
  st.stock[g] = Math.min(Math.ceil(cap), (st.stock[g] ?? 0) + n);
}

function tell(game: Game, account: number, subject: string, body: string): void {
  if (account < 0) return;
  deliver(game, account, { from: 'The mine’s overseer', subject, body, gold: 0, goods: null });
  const s = game.sessionByAccount(account);
  if (s) game.sendTo(s, { t: 'toast', msg: body, kind: 'bad' });
}

// ------------------------------------------------------------------------------------------------ the flag

/** The mine within reach of her boats, if any. */
export function mineNear(game: Game, ship: ShipEntity): MineSite | null {
  for (const x of mines(game).sites) {
    const is = game.world.islands[x.islandId];
    if (!is || dist(is.x, is.y, ship.state.x, ship.state.y) > is.radius + LAND_RANGE) continue;
    if (Math.sqrt(closestOnPolygon(ship.state.x, ship.state.y, is.poly).d2) <= LAND_RANGE) return x;
  }
  return null;
}

const flagParty = (ship: ShipEntity) => Math.max(3, Math.min(24, Math.round(ship.crew * 0.3)));

/** What a landing at the mine is for: her flag over another's (or the raiders'), or her own pile hauled. */
export function mineLandable(game: Game, s: PlayerSession): { island: string; feature: string; blocked?: string } | null {
  const ship = s.ship;
  if (!ship || ship.docked || ship.landing) return null;
  const x = mineNear(game, ship);
  if (!x) return null;
  const st = mineState(game, x.id);
  const name = MINES[x.kind].name[0];
  if (st.owner === s.accountId) return stockOf(st) > 0 ? { island: x.name, feature: `${name} (your pile: ${stockOf(st)})` } : null;
  const why = flagWhy(game, s, x);
  if (st.owner === RAIDERS) return { island: x.name, feature: `${name} (held by raiders, ${raidersGarrison(x.region)} men)`, ...(why ? { blocked: why } : {}) };
  return { island: x.name, feature: `${name} (plant your flag)`, ...(why ? { blocked: why } : {}) };
}

function flagWhy(game: Game, s: PlayerSession, x: MineSite): string | null {
  const ship = s.ship!;
  const st = mineState(game, x.id);
  if (st.owner !== undefined && st.owner !== RAIDERS && st.owner !== s.accountId && game.now - (st.since ?? 0) < FLAG_HOLD_SECS) return 'A flag was planted there only minutes ago.';
  if (st.owner !== s.accountId && mines(game).sites.filter((y) => mineState(game, y.id).owner === s.accountId).length >= MINES_MAX) return `A captain holds ${MINES_MAX} mines at most.`;
  if (st.owner === RAIDERS && flagParty(ship) < raidersGarrison(x.region)) return `Too few hands to beat the raiders ashore (${raidersGarrison(x.region)} of them).`;
  return null;
}

/** The boats row for the mine (undefined: no mine here, the landing is for something else). */
export function startFlag(game: Game, s: PlayerSession): string | null | undefined {
  const ship = s.ship!;
  const x = mineNear(game, ship);
  if (!x) return undefined;
  const st = mineState(game, x.id);
  if (st.owner === s.accountId && stockOf(st) <= 0) return undefined;
  const why = st.owner === s.accountId ? null : flagWhy(game, s, x);
  if (why) return why;
  const party = flagParty(ship);
  if (ship.crew - party < ship.stats.crewMin * 0.4) return 'Too few hands to spare a landing party';
  ship.landing = { islandId: x.islandId, feature: 'flag', siteId: x.id, until: game.now + FLAG_SECS, started: game.now, party };
  ship.input = { rudder: 0, sailTarget: 0 };
  const name = MINES[x.kind].name[0];
  game.toastShip(ship, st.owner === s.accountId ? `Boats away to haul the pile at the ${name} on ${x.name} (${FLAG_SECS}s).` : `Boats away: ${party} hands row for the ${name} on ${x.name} with your flag (${FLAG_SECS}s).`, 'info');
  return null;
}

/** The party is back from the mine. */
export function flagLanded(game: Game, s: PlayerSession, ship: ShipEntity, l: Landing, recalled: boolean): void {
  const x = mines(game).sites.find((m) => m.id === l.siteId);
  if (!x) return;
  const name = MINES[x.kind].name[0];
  if (recalled) {
    game.toastShip(ship, `The party is back before the flag went up on the ${name}.`, 'bad');
    return;
  }
  const m = mines(game);
  const st = m.st[x.id] ?? {};
  if (st.owner === s.accountId) {
    haul(game, s, ship, x, st);
    save(game);
    return;
  }
  const why = flagWhy(game, s, x);
  if (why) {
    game.toastShip(ship, why, 'bad');
    return;
  }
  if (st.owner === RAIDERS) {
    // The raiders are beaten ashore: some of the party fall (two in five of the raiders' number, fewer for a bigger party).
    const g = raidersGarrison(x.region);
    const lost = Math.max(1, Math.min(l.party - 1, Math.round((g * 0.4 * g) / Math.max(g, l.party))));
    ship.loseMen(lost);
    game.toastShip(ship, `The raiders on ${x.name} are beaten off; ${lost} of the party fell.`, 'bad');
  }
  const was = st.owner;
  const pileWas = st.stock;
  m.st[x.id] = { owner: s.accountId, name: s.name, since: game.now, stock: pileWas };
  if (was !== undefined && was !== RAIDERS) tell(game, was, 'Your mine is taken', `${s.name} has planted a flag over your ${name} on ${x.name}.`);
  game.toastShip(ship, `Your flag flies over the ${name} on ${x.name}: ${Math.round(mineDaily(x.kind, x.region))} ${x.kind === 'silver' ? 'silver' : GOODS[x.kind].name.toLowerCase()} a day.`, 'good');
  if (stockOf(m.st[x.id]) > 0) haul(game, s, ship, x, m.st[x.id]);
  save(game);
}

/** Her pile at the mine into the hold (silver into the purse). */
function haul(game: Game, s: PlayerSession, ship: ShipEntity, x: MineSite, st: MineState): void {
  const p = s.profile!;
  let moved = 0;
  for (const [g, n0] of Object.entries(st.stock ?? {}) as [GoodId | 'silver', number][]) {
    const n = Math.floor(n0 ?? 0);
    if (n <= 0) continue;
    if (g === 'silver') {
      p.gold += n;
      game.db.ledger(s.accountId, 'mine', n, x.id);
      st.stock![g] = 0;
      moved += n;
      continue;
    }
    const free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
    const k = Math.max(0, Math.min(n, Math.floor((free + 1e-6) / GOODS[g].volume)));
    if (k > 0) {
      ship.cargo[g] = (ship.cargo[g] ?? 0) + k;
      st.stock![g] = n - k;
      moved += k;
    }
  }
  game.toastShip(ship, moved > 0 ? `Hauled the pile at the ${MINES[x.kind].name[0]}: ${moved}.` : 'No room in the hold for the pile.', moved > 0 ? 'good' : 'bad');
}

// ------------------------------------------------------------------------------------------------ the admin

/** For the admin: her ship off an island's farthest headland, clear of the rocks, hove to. */
export function offIsland(game: Game, s: PlayerSession, islandId: number): void {
  const ship = s.ship!;
  const is = game.world.islands[islandId];
  let bx = is.x, by = is.y, bd = -1;
  for (let i = 0; i < is.poly.length; i += 2) {
    const d = Math.hypot(is.poly[i] - is.x, is.poly[i + 1] - is.y);
    if (d > bd) [bx, by, bd] = [is.poly[i], is.poly[i + 1], d];
  }
  // Out from the headland until the water is deep enough for her keel (still within the boats' reach).
  let d = 120;
  for (; d < 240; d += 20) {
    const k = d / Math.max(1, bd);
    if (depthAt(game.world, bx + (bx - is.x) * k, by + (by - is.y) * k) > ship.cls.draft + 1) break;
  }
  const k = d / Math.max(1, bd);
  if (ship.docked) game.undock(s);
  ship.state = { ...ship.state, x: bx + (bx - is.x) * k, y: by + (by - is.y) * k, speed: 0, sail: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
}

/** `/mine`: the mines near and hers; `take` the nearest is hers; `lose` the raiders take it; `pay` a dawn's pay. */
export function adminMine(game: Game, s: PlayerSession, arg: string): string {
  const ship = s.ship!;
  const m = mines(game);
  const near = [...m.sites].sort((a, b) => dist(a.x, a.y, ship.state.x, ship.state.y) - dist(b.x, b.y, ship.state.x, ship.state.y))[0];
  if (arg === 'take' || arg === 'lose' || arg === 'free') {
    if (!near) return 'No mines in this sea.';
    m.st[near.id] = arg === 'take' ? { owner: s.accountId, name: s.name, since: game.now - FLAG_HOLD_SECS } : arg === 'lose' ? { owner: RAIDERS, since: game.now } : {};
    save(game);
    return `The ${MINES[near.kind].name[0]} on ${near.name} is now ${arg === 'take' ? 'yours' : arg === 'lose' ? 'the raiders’' : 'nobody’s'}.`;
  }
  if (arg === 'pay') {
    minesDay(game, -1, false);
    return 'The mines have paid a day.';
  }
  if (arg === 'go' && near) {
    offIsland(game, s, near.islandId);
    return `Off ${near.name}, by the ${MINES[near.kind].name[0]}.`;
  }
  const mine = m.sites.filter((x) => mineState(game, x.id).owner === s.accountId);
  if (!near) return 'No mines in this sea.';
  return `Mines: ${m.sites.length}; yours ${mine.length}. Nearest: the ${MINES[near.kind].name[0]} on ${near.name}, ${Math.round(dist(near.x, near.y, ship.state.x, ship.state.y))} m away.`;
}
