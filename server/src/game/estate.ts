// A captain's own island and her outposts (docs/12 P7). The island is bought outright (a lease bought out, or any
// wild island that is not a port's, priced by its size and waters — docs/15 item 6, baseclaim.ts): it is never besieged and grows through ten levels on goods from all
// over the sea, each level more slots, outposts, caravans and residents. Residents — souls rescued at sea,
// prisoners freed from pirate lairs, hands hired in the island's tavern — each work a building or an outpost for
// +40% and a knack of their trade. Outposts on wild islands take a resource by the hour without their owner, up
// to their store; they are claimed a week at a time (held by the flag in lawless water), guarded or not, raided by
// pirates when their store is fat — ten minutes' warning to come and fight — and robbed by captains in lawless
// water. A trophy hall shows a hunter's heads, a whaler's skulls and a fisher's records, and lends each trade a
// little; guests may look round it.

import { welcome } from './guests.ts';
import { isCitadelIsland } from '../../../shared/src/data/citadels.ts'; // docs/19 E4
import {
  CLAIM_DAYS, GUARDS, HANDS_BONUS, HANDS_WAGE, HOME_COOLDOWN, ISLE_LEVELS, ISLE_MAX, OUTPOSTS, OUTPOST_BUILD, OUTPOST_KINDS, OUTPOST_MAX_LEVEL,
  PROFESSIONS, PROFESSION_DEFS, RAID_DAY, RAID_MIN, RESIDENT_BONUS, RESIDENT_HIRE, ROB_SEC, TROPHY_MAX, TROPHY_STEP, claimCost, outpostCap, outpostFits, outpostGood,
  outpostRate, outpostUpgrade, residentName,
} from '../../../shared/src/data/estate.ts';
import type { Guard, OutpostKind, Profession, TrophyKind } from '../../../shared/src/data/estate.ts';
import { islandSize } from '../../../shared/src/data/holdings.ts';
import { claimPrice, isleTax } from '../../../shared/src/data/baseclaim.ts';
import { claimTerms, claimWhy, leaseCredit, newClaim, robView, stepIsleRobbers, watersOf } from './baseclaim.ts';
import type { BuildingId } from '../../../shared/src/data/holdings.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { dist } from '../../../shared/src/math.ts';
import type { EstateView, OutpostView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island, Port } from '../../../shared/src/world/worldgen.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import { GRACE_MS, has, island, islandNear, islePort, mayUse, strength } from './holdings.ts';
import type { Holding } from './holdings.ts';
import { spawnPirate } from './npc.ts';
import { changeRep } from './player.ts';
import type { PlayerSession, Profile } from './player.ts';
import { deliver } from './post.ts';
import type { ShipEntity } from './ship.ts';
import { sagaNote } from './saga.ts';
import { powerOf } from './base.ts';
import { ISLE_POWER } from '../../../shared/src/data/baseships.ts';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const FAR_FUTURE = 4_102_444_800_000; // 2100: an island bought outright has no lease to run out

export interface Resident {
  id: number;
  prof: Profession;
  /** A building of the island (by id) or an outpost (by id), or idle. */
  at: { b: BuildingId } | { o: string } | null;
  since: number;
}

export interface Outpost {
  id: string;
  owner: number;
  ownerName: string;
  island: number;
  kind: OutpostKind;
  level: number;
  store: Cargo;
  claimUntil: number;
  workers: 'none' | 'hands';
  guard: Guard;
  lastWork: number;
  raid: { until: number; ships: number[]; x: number; y: number } | null;
  lastRaidRoll: number;
  auto: number | null;
}

interface EstateState {
  outposts: Record<string, Outpost> | null;
  robbing: Map<number, { outpost: string; until: number }>;
  rng: Rng;
  dirty: boolean;
  seq: number;
}

const states = new WeakMap<Game, EstateState>();

function es(game: Game): EstateState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { outposts: null, robbing: new Map(), rng: new Rng(game.world.seed ^ 0xe57a7e), dirty: false, seq: 1 }));
  return s;
}

export function outposts(game: Game): Record<string, Outpost> {
  const S = es(game);
  S.outposts ??= game.db.getKv<Record<string, Outpost>>('outposts') ?? {};
  return S.outposts;
}

function touch(game: Game): void {
  es(game).dirty = true;
}

function save(game: Game): void {
  const S = es(game);
  if (!S.dirty || !S.outposts) return;
  S.dirty = false;
  game.db.setKv('outposts', S.outposts);
}

// ------------------------------------------------------------------------------------------------ the island

/** A captain's own island (bought outright), if she has one. */
export function ownIsland(game: Game, account: number): Holding | undefined {
  return Object.values(game.holdings.map(game)).find((h) => h.owned && h.owner.kind === 'player' && h.owner.id === account);
}

/** The price of an island claimed as one's own: by its size and its waters (docs/15 item 6). */
export function buyPrice(isl: Island): number {
  return claimPrice(islandSize(isl.radius), watersOf(isl));
}

/** Claim an island outright (docs/15 item 6): any wild island that is not a port's, held, worked or a lair — or one's
 *  own leased island bought out (the lease still to run counts against the price); one island of one's own. */
export function buyIsland(game: Game, s: PlayerSession, islandId: number): string | null {
  const isl = island(game, islandId);
  if (!isl || isl.portId) return 'No such island';
  const ship = s.ship!;
  const near = ship.docked ? game.portById(ship.docked)?.region === isl.region : islandNear(game, ship)?.id === isl.id;
  if (!near) return `Sail to ${isl.name}, or ask at a harbour office in ${REGIONS[isl.region].name}`;
  const p = s.profile!;
  const cur = game.holdings.get(game, islandId);
  const why = claimWhy(game, s, isl);
  if (why) return why;
  let price = buyPrice(isl);
  price -= leaseCredit(game, s, isl, price);
  if (p.gold < price) return `The island costs ${price} silver.`;
  p.gold -= price;
  game.db.ledger(s.accountId, 'island_buy', -price, String(isl.id));
  const now = game.wallNow();
  const h: Holding = cur ?? {
    island: isl.id, owner: { kind: 'player', id: s.accountId, name: s.name }, since: now, until: now, lastDays: 30, autoRenew: false,
    treasury: 0, store: {}, buildings: [], lastUpkeep: now, lastWork: now, toll: { day: 0, paid: 0 }, warned: false,
    window: 19, windowNext: null, shieldUntil: FAR_FUTURE, lastSiege: 0,
  };
  h.owned = true;
  h.level = Math.max(1, h.level ?? 1);
  h.until = FAR_FUTURE;
  h.autoRenew = false;
  h.shieldUntil = FAR_FUTURE;
  h.residents ??= [];
  h.claim = newClaim(game, price);
  game.holdings.map(game)[isl.id] = h;
  game.holdings.touch();
  changeRep(p, game.holdings.factionOf(game, isl.region), 5);
  game.sendTo(s, { t: 'toast', msg: `${isl.name} is yours for ever. Its upkeep is paid from its treasury, day by day.`, kind: 'gold' });
  const tax = isleTax(watersOf(isl), 1);
  if (tax > 0) game.sendTo(s, { t: 'toast', msg: `The harbour office taxes it ${tax} silver a week for each of its levels, from its treasury.`, kind: 'info' });
  sagaNote(game, s, 'island', [isl.name]); // the saga (docs/12 P10 #20)
  return null;
}

/** An owned island's slots: by its level, and one or two more on a middling or a large island. */
export function ownedSlots(h: Holding, isl?: Island): number {
  const size = isl ? islandSize(isl.radius) : 'small';
  return ISLE_LEVELS[Math.max(1, Math.min(ISLE_MAX, h.level ?? 1))].slots + (size === 'large' ? 2 : size === 'medium' ? 1 : 0);
}

/** What stands in the way of the island's next level (null: nothing): its power (docs/15 item 5), then the goods of
 *  its store and yard, then the treasury's silver. */
export function isleLevelWhy(h: Holding): string | null {
  const lvl = h.level ?? 1;
  if (lvl >= ISLE_MAX) return 'Your island is at its greatest.';
  const need = ISLE_LEVELS[lvl + 1];
  const power = powerOf(h);
  if (power < ISLE_POWER[lvl + 1]) return `The island’s power is ${power} of the ${ISLE_POWER[lvl + 1]} its next level asks: raise its buildings and its ships.`;
  // The store first, then the island's yard (docs/15: its timber and iron count too).
  const yard = h.yard?.res ?? {};
  const have = (g: GoodId) => (h.store[g] ?? 0) + (yard[g] ?? 0);
  const lack = (Object.entries(need.goods) as [GoodId, number][]).filter(([g, n]) => have(g) < n);
  if (lack.length) return `The island’s store lacks ${lack.map(([g, n]) => `${n - have(g)} ${GOODS[g].name.toLowerCase()}`).join(', ')}.`;
  if (h.treasury < need.silver) return `The treasury lacks ${need.silver - h.treasury} silver.`;
  return null;
}

export function isleLevelUp(game: Game, s: PlayerSession, islandId: number): string | null {
  const h = game.holdings.get(game, islandId);
  if (!h || !h.owned || !mayUse(game, h, s.accountId)) return 'You have no island of your own.';
  const lvl = h.level ?? 1;
  const why = isleLevelWhy(h);
  if (why) return why;
  const need = ISLE_LEVELS[lvl + 1];
  const yard = h.yard?.res ?? {};
  h.treasury -= need.silver;
  for (const [g, n] of Object.entries(need.goods) as [GoodId, number][]) {
    const fromStore = Math.min(n, h.store[g] ?? 0);
    h.store[g] = (h.store[g] ?? 0) - fromStore;
    if (!h.store[g]) delete h.store[g];
    if (n > fromStore) {
      yard[g] = (yard[g] ?? 0) - (n - fromStore);
      if (!yard[g]) delete yard[g];
    }
  }
  h.level = lvl + 1;
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: `${island(game, islandId)!.name} grows: ${need.name[0]}.`, kind: 'gold' });
  return null;
}

/** Home from a port to one's own island, once in half an hour, with an empty hold. */
export function goHome(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  const h = ownIsland(game, s.accountId);
  if (!h) return 'You have no island of your own.';
  if (!ship.docked || cargoVolume(ship.cargo) > 0.01) return 'Home is only from a port, with an empty hold.';
  const wait = (p.homeAt ?? -1e9) + HOME_COOLDOWN - game.now;
  if (wait > 0) return `Home again in ${Math.ceil(wait / 60)} min.`;
  const isl = island(game, h.island)!;
  let x = isl.x, y = isl.y;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const px = isl.x + Math.sin(a) * (isl.radius + 150), py = isl.y - Math.cos(a) * (isl.radius + 150);
    if (!isLand(game.world, px, py) && !isLand(game.world, px + Math.sin(a) * 60, py - Math.cos(a) * 60)) {
      x = px;
      y = py;
      break;
    }
  }
  p.homeAt = game.now;
  const why = game.undock(s);
  if (why) return why;
  ship.state = { ...ship.state, x, y, speed: 0, sail: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.region = isl.region;
  game.grid.upsert(ship.id, x, y);
  game.pushSelf(s, true);
  game.sendTo(s, { t: 'toast', msg: `Home: ${isl.name}.`, kind: 'good' });
  return null;
}

// ------------------------------------------------------------------------------------------------ residents

export function residentCap(h: Holding): number {
  return ISLE_LEVELS[Math.max(1, Math.min(ISLE_MAX, h.level ?? 1))].residents + (has(h, 'residents_house') ? 4 : 0);
}

function newResident(game: Game, h: Holding, prof?: Profession): Resident {
  const S = es(game);
  const id = (h.residents?.reduce((a, r) => Math.max(a, r.id), 0) ?? 0) + 1;
  return { id, prof: prof ?? S.rng.pick(PROFESSIONS), at: null, since: game.wallNow() };
}

/** Someone comes to live on the island (rescued, freed or hired): she settles if there is a roof. */
export function settle(game: Game, h: Holding, prof?: Profession): Resident | null {
  h.residents ??= [];
  if (h.residents.length >= residentCap(h)) return null;
  const r = newResident(game, h, prof);
  h.residents.push(r);
  game.holdings.touch();
  if (h.owner.kind === 'player') {
    const s = game.sessionByAccount(h.owner.id);
    if (s) game.sendTo(s, { t: 'toast', msg: `${residentName(r.id * 7 + h.island)[0]} settles on your island: ${PROFESSION_DEFS[r.prof].name[0]}.`, kind: 'good' });
  }
  return r;
}

/** Hands hired in the island's own tavern come to live there. */
export function hireResident(game: Game, s: PlayerSession): string | null {
  const h = ownIsland(game, s.accountId);
  if (!h) return 'You have no island of your own.';
  if (!has(h, 'tavern')) return 'Build a tavern on the island to hire there';
  if ((h.residents?.length ?? 0) >= residentCap(h)) return 'The houses are full: build a Residents’ House or raise the island.';
  const p = s.profile!;
  if (p.gold < RESIDENT_HIRE) return `Needs ${RESIDENT_HIRE} silver`;
  p.gold -= RESIDENT_HIRE;
  game.db.ledger(s.accountId, 'resident', -RESIDENT_HIRE, String(h.island));
  settle(game, h);
  return null;
}

/** A resident to work: a building of the island, an outpost, or nothing. */
export function assignResident(game: Game, s: PlayerSession, id: number, where: string): string | null {
  const h = ownIsland(game, s.accountId);
  const r = h?.residents?.find((x) => x.id === id);
  if (!h || !r) return 'No such resident';
  if (where === 'none') r.at = null;
  else if (where.startsWith('o:')) {
    const o = outposts(game)[where.slice(2)];
    if (!o || o.owner !== s.accountId) return 'No such outpost';
    r.at = { o: o.id };
  } else {
    if (!has(h, where as BuildingId)) return 'No such building on the island';
    r.at = { b: where as BuildingId };
  }
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: `${residentName(r.id * 7 + h.island)[0]} goes to work: ${where === 'none' ? '—' : where}.`, kind: 'info' });
  return null;
}

/** A building's hands: +40% for each resident working it. */
export function residentMul(h: Holding, id: BuildingId): number {
  const n = h.residents?.filter((r) => r.at && 'b' in r.at && r.at.b === id).length ?? 0;
  return 1 + RESIDENT_BONUS * n;
}

function residentsAt(game: Game, o: Outpost): Resident[] {
  const h = ownIsland(game, o.owner);
  return h?.residents?.filter((r) => r.at && 'o' in r.at && r.at.o === o.id) ?? [];
}

// ------------------------------------------------------------------------------------------------ the new buildings

/** The island's own trades by the hour (from the holdings' calendar): the smokehouse, the try-works, the herbalist. */
export function estateProduce(game: Game, h: Holding, hours: number, add: (g: GoodId, n: number) => void, convert: (from: Partial<Record<GoodId, number>>, to: GoodId, out: number, batches: number) => void): void {
  const smoke = strength(h, 'smokehouse') * residentMul(h, 'smokehouse');
  if (smoke > 0) {
    convert({ fish: 3 }, 'smoked_fish', 1, Math.floor(6 * hours * smoke));
    convert({ fish: 2, salt: 1 }, 'salted_fish', 2, Math.floor(6 * hours * smoke));
  }
  const tw = strength(h, 'try_works') * residentMul(h, 'try_works');
  if (tw > 0) convert({ orca_tooth: 2, whalebone: 1 }, 'scrimshaw', 1, Math.floor(2 * hours * tw));
  const herbs = h.residents?.filter((r) => r.prof === 'herbalist').length ?? 0;
  if (herbs) add('medicine', (2 * herbs * hours) / 24);
}

/** The island's forge serves gear (tempering, reforging, mending) to its owner lying off it. */
export function isleForge(game: Game, s: PlayerSession): Port | null {
  const ship = s.ship;
  const h = ownIsland(game, s.accountId);
  if (!ship || !h || !has(h, 'forge')) return null;
  const isl = island(game, h.island)!;
  if (ship.docked || dist(isl.x, isl.y, ship.state.x, ship.state.y) - isl.radius > 400) return null;
  const port = islePort(game, h);
  return { ...port, shipyardTier: Math.max(2, port.shipyardTier) };
}

// ------------------------------------------------------------------------------------------------ trophies

export function trophies(game: Game, p: Profile, name: string): Record<TrophyKind, number> {
  const records = game.db.getKv<Record<string, { name: string; kg: number }>>('fish_records') ?? {};
  return {
    flag: p.hunter?.captains ?? 0,
    skull: (p.beasts?.orca ?? 0) + (p.beasts?.white_orca ?? 0) * 10,
    fish: Object.values(records).filter((r) => r.name === name).length,
  };
}

/** A trophy hall's share of a trade (half a percent a trophy, to a tenth). */
export function trophyBonus(game: Game, account: number | null, kind: TrophyKind): number {
  if (account === null) return 0;
  const h = ownIsland(game, account);
  if (!h || !has(h, 'trophy_hall')) return 0;
  const s = game.sessionByAccount(account);
  if (!s?.profile) return 0;
  return Math.min(TROPHY_MAX, trophies(game, s.profile, s.name)[kind] * TROPHY_STEP);
}

/** A guest looks round a captain's trophy hall (from off her island). */
export function visitHall(game: Game, s: PlayerSession, islandId: number): { owner: string; flag: number; skull: number; fish: number } | string {
  const h = game.holdings.get(game, islandId);
  if (!h || !h.owned || !has(h, 'trophy_hall') || h.owner.kind !== 'player') return 'No trophy hall there';
  const ship = s.ship!;
  const isl = island(game, islandId)!;
  if (ship.docked || dist(isl.x, isl.y, ship.state.x, ship.state.y) - isl.radius > 800) return `Sail to ${isl.name}, or ask at a harbour office in ${REGIONS[isl.region].name}`;
  const owner = game.sessionByAccount(h.owner.id);
  h.visitors = (h.visitors ?? 0) + (h.owner.id === s.accountId ? 0 : 1);
  game.holdings.touch();
  const t = owner?.profile ? trophies(game, owner.profile, owner.name) : { flag: 0, skull: 0, fish: 0 };
  if (owner && h.owner.id !== s.accountId) game.sendTo(owner, { t: 'toast', msg: `Visitors to your trophy hall: ${h.visitors}.`, kind: 'info' });
  return { owner: h.owner.name, ...t };
}

// ------------------------------------------------------------------------------------------------ outposts

function outpostsOf(game: Game, account: number): Outpost[] {
  return Object.values(outposts(game)).filter((o) => o.owner === account);
}

export function outpostLimit(game: Game, account: number): number {
  const h = ownIsland(game, account);
  return h ? ISLE_LEVELS[Math.max(1, Math.min(ISLE_MAX, h.level ?? 1))].outposts : 0;
}

/** Found an outpost on a wild island within reach: materials from the hold, a week's claim from the region's
 *  faction (nothing in lawless water, where the flag holds it). */
export function foundOutpost(game: Game, s: PlayerSession, kind: OutpostKind): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  const def = OUTPOSTS[kind];
  if (!def) return 'Unknown order';
  const isl = islandNear(game, ship);
  if (!isl || isl.portId || game.holdings.get(game, isl.id)) return 'An outpost stands on a wild island, not a port’s or another’s.';
  if (Object.values(outposts(game)).some((o) => o.island === isl.id)) return 'Someone already works this island.';
  if (isCitadelIsland(isl)) return 'A citadel of the Throne war stands on that island.'; // docs/19 E4
  if (!outpostFits(kind, isl)) return `This island does not suit a ${def.name[0]}.`;
  const limit = outpostLimit(game, s.accountId);
  if (!limit) return 'You have no island of your own.';
  if (outpostsOf(game, s.accountId).length >= limit) return `Your island allows ${limit} outposts; raise it for more.`;
  const lack = (Object.entries(OUTPOST_BUILD) as [GoodId, number][]).filter(([g, n]) => (ship.cargo[g] ?? 0) < n);
  if (lack.length) return `Bring ${Object.entries(OUTPOST_BUILD).map(([g, n]) => `${n} ${GOODS[g as GoodId].name.toLowerCase()}`).join(', ')} in the hold to found it.`;
  const safety = REGIONS[isl.region].safety;
  const fee = claimCost(safety);
  if (p.gold < fee) return `Needs ${fee} silver`;
  p.gold -= fee;
  for (const [g, n] of Object.entries(OUTPOST_BUILD) as [GoodId, number][]) {
    ship.cargo[g] = (ship.cargo[g] ?? 0) - n;
    if (!ship.cargo[g]) delete ship.cargo[g];
  }
  if (fee) changeRep(p, game.holdings.factionOf(game, isl.region), 1);
  const S = es(game);
  const id = `op_${s.accountId}_${isl.id}_${S.seq++}`;
  const wall = game.wallNow();
  outposts(game)[id] = { id, owner: s.accountId, ownerName: s.name, island: isl.id, kind, level: 1, store: {}, claimUntil: wall + CLAIM_DAYS * DAY, workers: 'none', guard: 'none', lastWork: wall, raid: null, lastRaidRoll: wall, auto: null };
  touch(game);
  game.sendTo(s, { t: 'toast', msg: `An outpost is founded on ${isl.name}: ${def.name[0]}.`, kind: 'gold' });
  return null;
}

function nearOutpost(game: Game, ship: ShipEntity, o: Outpost): boolean {
  const isl = island(game, o.island);
  return !!isl && !ship.docked && dist(isl.x, isl.y, ship.state.x, ship.state.y) - isl.radius < 800;
}

export function outpostOrder(game: Game, s: PlayerSession, id: string, action: string, arg?: string): string | null {
  const o = outposts(game)[id];
  const ship = s.ship!;
  const p = s.profile!;
  if (!o) return 'No such outpost';
  if (action === 'rob') return robOutpost(game, s, o);
  if (o.owner !== s.accountId) return 'Not your outpost';
  const isl = island(game, o.island)!;
  switch (action) {
    case 'upgrade': {
      if (o.level >= OUTPOST_MAX_LEVEL) return 'It is at its greatest';
      if (!nearOutpost(game, ship, o)) return `Sail to ${isl.name}, or ask at a harbour office in ${REGIONS[isl.region].name}`;
      const c = outpostUpgrade(o.level, o.kind);
      const lack = (Object.entries(c.goods) as [GoodId, number][]).filter(([g, n]) => (ship.cargo[g] ?? 0) < n);
      if (lack.length) return `Bring ${Object.entries(c.goods).map(([g, n]) => `${n} ${GOODS[g as GoodId].name.toLowerCase()}`).join(', ')} in the hold to found it.`;
      if (p.gold < c.silver) return `Needs ${c.silver} silver`;
      p.gold -= c.silver;
      for (const [g, n] of Object.entries(c.goods) as [GoodId, number][]) {
        ship.cargo[g] = (ship.cargo[g] ?? 0) - n;
        if (!ship.cargo[g]) delete ship.cargo[g];
      }
      o.level++;
      touch(game);
      game.sendTo(s, { t: 'toast', msg: `${OUTPOSTS[o.kind].name[0]} on ${isl.name}: level ${o.level}.`, kind: 'good' });
      return null;
    }
    case 'workers':
      o.workers = arg === 'hands' ? 'hands' : 'none';
      touch(game);
      return null;
    case 'guard': {
      const g = (arg ?? 'none') as Guard;
      if (!GUARDS[g]) return 'Unknown order';
      const cost = GUARDS[g].cost;
      if (p.gold < cost) return `Needs ${cost} silver`;
      p.gold -= cost;
      o.guard = g;
      touch(game);
      return null;
    }
    case 'haul': {
      if (!nearOutpost(game, ship, o)) return `Sail to ${isl.name}, or ask at a harbour office in ${REGIONS[isl.region].name}`;
      let moved = 0;
      for (const [g, n] of Object.entries(o.store) as [GoodId, number][]) {
        const room = Math.floor((ship.stats.holdVolume - cargoVolume(ship.cargo)) / GOODS[g].volume);
        const k = Math.min(room, Math.floor(n));
        if (k <= 0) continue;
        ship.cargo[g] = (ship.cargo[g] ?? 0) + k;
        o.store[g] = n - k;
        if (o.store[g]! < 1) delete o.store[g];
        moved += k;
      }
      touch(game);
      if (moved) game.sendTo(s, { t: 'toast', msg: `The store of your ${OUTPOSTS[o.kind].name[0]} is in the hold.`, kind: 'good' });
      return null;
    }
    case 'renew': {
      const fee = claimCost(REGIONS[isl.region].safety);
      if (p.gold < fee) return `Needs ${fee} silver`;
      p.gold -= fee;
      o.claimUntil = Math.max(o.claimUntil, game.wallNow()) + CLAIM_DAYS * DAY;
      touch(game);
      game.sendTo(s, { t: 'toast', msg: `The claim on ${isl.name} is renewed for a week.`, kind: 'good' });
      return null;
    }
    case 'auto':
      o.auto = arg === 'off' ? null : 0.7;
      touch(game);
      return null;
  }
  return 'Unknown order';
}

/** A captain in lawless water robs someone's outpost: five minutes ashore, the owner warned. */
function robOutpost(game: Game, s: PlayerSession, o: Outpost): string | null {
  const ship = s.ship!;
  const isl = island(game, o.island)!;
  if (o.owner === s.accountId) return 'Not your outpost';
  if (REGIONS[isl.region].safety !== 'lawless') return 'An outpost is robbed only in lawless waters.';
  if (!nearOutpost(game, ship, o) || ship.state.speed > 1.5) return 'Heave to alongside the carcass first.';
  const S = es(game);
  S.robbing.set(s.accountId, { outpost: o.id, until: game.now + ROB_SEC });
  alert(game, o.owner, `Your ${OUTPOSTS[o.kind].name[0]} on ${isl.name} is being robbed!`, `${s.name} has landed at your ${OUTPOSTS[o.kind].name[0]} on ${isl.name}. Five minutes and the store is theirs.`);
  return null;
}

function alert(game: Game, account: number, toast: string, mail: string): void {
  const s = game.sessionByAccount(account);
  if (s) game.sendTo(s, { t: 'toast', msg: toast, kind: 'bad' });
  deliver(game, account, { from: 'Outposts', subject: toast, body: mail, gold: 0, goods: null });
}

function addStore(o: Outpost, g: GoodId, n: number, cap: number): void {
  const used = Object.values(o.store).reduce((a, x) => a + (x ?? 0), 0);
  const k = Math.max(0, Math.min(cap - used, n));
  if (k > 0) o.store[g] = (o.store[g] ?? 0) + k;
}

function fillOf(o: Outpost): number {
  return Object.values(o.store).reduce((a, x) => a + (x ?? 0), 0) / Math.max(1, outpostCap(o.kind, o.level));
}

/** Every ten seconds: the outposts work by the hour, claims lapse, raids come and are fought or lost, robbers finish. */
export function stepEstate(game: Game): void {
  const S = es(game);
  const wall = game.wallNow();
  const list = Object.values(outposts(game));
  for (const o of list) {
    const isl = island(game, o.island);
    if (!isl || (game.zone && !game.zone.regions.has(isl.region))) continue;
    // Work: whole minutes since the last reckoning, up to the store.
    const mins = Math.min(72 * 60, Math.floor((wall - o.lastWork) / 60_000));
    if (mins >= 1) {
      const res = residentsAt(game, o).length;
      const mul = 1 + (o.workers === 'hands' ? HANDS_BONUS : 0) + RESIDENT_BONUS * res;
      // The deep shaft's workers lose their minds now and then: an hour without a yield.
      const mad = o.kind === 'deep_shaft' && S.rng.chance(0.1 * (mins / 60)) ? 0 : 1;
      const good = outpostGood(o.kind, isl.biome);
      const cap = outpostCap(o.kind, o.level);
      addStore(o, good, (outpostRate(o.kind, o.level) * mul * mad * mins) / 60, cap);
      const ex = OUTPOSTS[o.kind].extra;
      if (ex && S.rng.chance(Math.min(1, ex.chance * (mins / 60)))) addStore(o, ex.good, 1, cap);
      // A sulphur pit's mountain rumbles: now and then a fall buries part of the store.
      if (o.kind === 'sulfur' && S.rng.chance(0.01 * (mins / 60))) for (const g of Object.keys(o.store) as GoodId[]) o.store[g] = Math.floor((o.store[g] ?? 0) * 0.7);
      o.lastWork += mins * 60_000;
      touch(game);
    }
    // Hired hands are paid a day at a time from the island's treasury.
    // The claim.
    if (wall > o.claimUntil + (REGIONS[isl.region].safety === 'lawless' ? 30 * DAY : GRACE_MS)) {
      alert(game, o.owner, `The claim on your ${OUTPOSTS[o.kind].name[0]} on ${isl.name} has lapsed: the outpost is abandoned.`, `The claim ran out and was not renewed. The outpost on ${isl.name} is abandoned, and its store with it.`);
      for (const r of residentsAt(game, o)) r.at = null;
      delete outposts(game)[o.id];
      touch(game);
      continue;
    }
    stepRaid(game, o, isl);
  }
  // Robbers ashore.
  for (const [acc, r] of [...S.robbing]) {
    const s = game.sessionByAccount(acc);
    const o = outposts(game)[r.outpost];
    if (!s?.ship || !o || !nearOutpost(game, s.ship, o) || s.ship.state.speed > 1.5) {
      S.robbing.delete(acc);
      continue;
    }
    if (game.now < r.until) continue;
    S.robbing.delete(acc);
    let n = 0;
    for (const [g, k] of Object.entries(o.store) as [GoodId, number][]) {
      const take = Math.min(Math.floor(k / 2), Math.floor((s.ship.stats.holdVolume - cargoVolume(s.ship.cargo)) / GOODS[g].volume));
      if (take <= 0) continue;
      s.ship.cargo[g] = (s.ship.cargo[g] ?? 0) + take;
      o.store[g] = k - take;
      n += take;
    }
    s.profile!.infamy += 10;
    touch(game);
    game.sendTo(s, { t: 'toast', msg: `The store of ${o.ownerName}’s outpost is yours: ${n} units.`, kind: 'gold' });
  }
  stepIsleRobbers(game); // robbers on captains' islands (docs/15 item 6)
  if (Math.floor(game.now) % 60 === 0) {
    payWages(game);
    save(game);
  }
}

let lastWagesDay = -1;
function payWages(game: Game): void {
  const day = Math.floor(game.wallNow() / DAY);
  if (day === lastWagesDay) return;
  lastWagesDay = day;
  for (const o of Object.values(outposts(game))) {
    if (o.workers !== 'hands') continue;
    const h = ownIsland(game, o.owner);
    if (h && h.treasury >= HANDS_WAGE) {
      h.treasury -= HANDS_WAGE;
      game.holdings.touch();
    } else o.workers = 'none';
  }
}

/** A raid: rolled by the hour; ten minutes' warning (fifteen with a signal tower); fought, or lost. */
function stepRaid(game: Game, o: Outpost, isl: Island): void {
  const S = es(game);
  const wall = game.wallNow();
  if (o.raid) {
    const owner = game.sessionByAccount(o.owner);
    const alive = o.raid.ships.filter((id) => game.ships.get(id)?.alive);
    if (o.raid.ships.length && !alive.length) {
      // Driven off (their ships sunk or gone): the owner keeps the store and their plunder.
      o.raid = null;
      touch(game);
      if (owner?.profile) {
        owner.profile.gold += 300 + 100 * o.level;
        game.sendTo(owner, { t: 'toast', msg: `The raiders at your ${OUTPOSTS[o.kind].name[0]} are driven off. Their plunder is yours.`, kind: 'gold' });
      }
      return;
    }
    if (wall < o.raid.until) return;
    // Time: the fort holds; otherwise a third to three fifths of the store is gone.
    for (const id of o.raid.ships) game.removeShip(id);
    o.raid = null;
    if (GUARDS[o.guard].holds) {
      if (owner) game.sendTo(owner, { t: 'toast', msg: `The fort at your ${OUTPOSTS[o.kind].name[0]} beat the raiders off.`, kind: 'good' });
      touch(game);
      return;
    }
    const loss = S.rng.range(0.3, 0.6);
    for (const g of Object.keys(o.store) as GoodId[]) o.store[g] = Math.floor((o.store[g] ?? 0) * (1 - loss));
    alert(game, o.owner, `The raiders stripped your ${OUTPOSTS[o.kind].name[0]} on ${isl.name}: ${Math.round(loss * 100)}% of its store is gone.`, `Nobody came in time. The raiders took ${Math.round(loss * 100)}% of the store at ${isl.name}.`);
    touch(game);
    return;
  }
  const hours = (wall - o.lastRaidRoll) / HOUR;
  if (hours < 1) return;
  o.lastRaidRoll = wall;
  if (!game.directorOn) return;
  const safety = REGIONS[isl.region].safety;
  const chance = (RAID_DAY[safety] / 24) * hours * (0.5 + fillOf(o)) * OUTPOSTS[o.kind].risk * GUARDS[o.guard].chance;
  if (!S.rng.chance(Math.min(0.9, chance))) return;
  raid(game, o, isl);
}

/** Pirates land at an outpost: ten minutes (fifteen with the island's signal tower) for its owner to come. */
export function raid(game: Game, o: Outpost, isl: Island): void {
  const h = ownIsland(game, o.owner);
  const mins = RAID_MIN + (h && has(h, 'signal_tower') ? 5 : 0);
  const ships: number[] = [];
  const a = es(game).rng.float() * Math.PI * 2;
  const x = isl.x + Math.sin(a) * (isl.radius + 350), y = isl.y - Math.cos(a) * (isl.radius + 350);
  // The raiders are at sea only for an owner who can come (in this zone); otherwise the raid is reckoned on the clock.
  if (game.sessionByAccount(o.owner) && !isLand(game.world, x, y)) {
    for (let i = 0; i < 2; i++) {
      const sp = spawnPirate(game);
      if (!sp) break;
      sp.state.x = x + i * 80;
      sp.state.y = y;
      sp.region = isl.region;
      game.grid.upsert(sp.id, sp.state.x, sp.state.y);
      const b = game.npcs.get(sp.id);
      if (b) {
        b.area = { x: isl.x, y: isl.y, r: isl.radius + 1500 };
        b.expiresAt = game.now + mins * 60 + 120;
      }
      ships.push(sp.id);
    }
  }
  o.raid = { until: game.wallNow() + mins * 60_000, ships, x, y };
  touch(game);
  alert(game, o.owner, `Pirates have landed at your ${OUTPOSTS[o.kind].name[0]} on ${isl.name} — ${mins} minutes before it is ruined!`, `Pirates came ashore at ${isl.name}. Come and drive them off within ${mins} minutes, or lose a good part of the store.`);
}

// ------------------------------------------------------------------------------------------------ what she sees

export function outpostView(game: Game, o: Outpost, account: number): OutpostView {
  const isl = island(game, o.island)!;
  const cap = outpostCap(o.kind, o.level);
  const used = Object.values(o.store).reduce((a, x) => a + (x ?? 0), 0);
  const res = residentsAt(game, o).length;
  const rate = outpostRate(o.kind, o.level) * (1 + (o.workers === 'hands' ? HANDS_BONUS : 0) + RESIDENT_BONUS * res);
  return {
    id: o.id, kind: o.kind, island: o.island, name: isl.name, region: isl.region, x: Math.round(isl.x), y: Math.round(isl.y), level: o.level, good: outpostGood(o.kind, isl.biome),
    rate: Math.round(rate * 10) / 10, store: Math.floor(used), cap, fullIn: used >= cap ? 0 : Math.round(((cap - used) / Math.max(0.01, rate)) * 3600), claimUntil: o.claimUntil,
    workers: o.workers, residents: res, guard: o.guard, raid: o.raid ? Math.max(0, Math.round((o.raid.until - game.wallNow()) / 1000)) : null, mine: o.owner === account, owner: o.ownerName,
    auto: o.auto !== null,
  };
}

export function estateView(game: Game, s: PlayerSession): EstateView {
  const p = s.profile!;
  const h = ownIsland(game, s.accountId);
  const isl = h ? island(game, h.island) : undefined;
  const lvl = h?.level ?? 0;
  const next = h && lvl < ISLE_MAX ? ISLE_LEVELS[lvl + 1] : null;
  const ship = s.ship;
  // Others' outposts within reach (to rob in lawless water).
  const near: OutpostView[] = [];
  if (ship && !ship.docked) for (const o of Object.values(outposts(game))) if (o.owner !== s.accountId && nearOutpost(game, ship, o)) near.push(outpostView(game, o, s.accountId));
  const nearIsle = ship ? islandNear(game, ship) : null;
  return {
    isle: h && isl ? {
      island: h.island, name: isl.name, level: lvl, levelName: ISLE_LEVELS[lvl].name[0], slots: ownedSlots(h, isl),
      next: next ? { name: next.name[0], silver: next.silver, goods: next.goods, power: ISLE_POWER[lvl + 1] } : null, power: powerOf(h),
      residents: (h.residents ?? []).map((r) => ({ id: r.id, name: residentName(r.id * 7 + h.island)[0], prof: r.prof, at: r.at ? ('b' in r.at ? r.at.b : `o:${r.at.o}`) : null, line: PROFESSION_DEFS[r.prof].lines[(r.id + Math.floor(game.wallNow() / HOUR)) % PROFESSION_DEFS[r.prof].lines.length][0] })),
      cap: residentCap(h), refugees: p.refugees ?? 0, outposts: ISLE_LEVELS[lvl].outposts, trophies: has(h, 'trophy_hall') ? trophies(game, p, s.name) : null, visitors: h.visitors ?? 0,
    } : null,
    outposts: outpostsOf(game, s.accountId).map((o) => outpostView(game, o, s.accountId)),
    near,
    homeIn: Math.max(0, Math.ceil(((p.homeAt ?? -1e9) + HOME_COOLDOWN - game.now) / 60)),
    buy: nearIsle && !h && !claimWhy(game, s, nearIsle) ? { island: nearIsle.id, name: nearIsle.name, price: buyPrice(nearIsle) - leaseCredit(game, s, nearIsle, buyPrice(nearIsle)) } : null,
    // The terms of the island off the bow (docs/15 item 6): shown whether or not she may claim it now.
    claim: nearIsle && !h && (!game.holdings.get(game, nearIsle.id) || mayUse(game, game.holdings.get(game, nearIsle.id)!, s.accountId)) ? claimTerms(game, s, nearIsle) : null,
    rob: robView(game, s),
    kinds: nearIsle && !nearIsle.portId && !game.holdings.get(game, nearIsle.id) && !Object.values(outposts(game)).some((o) => o.island === nearIsle.id) ? OUTPOST_KINDS.filter((k) => outpostFits(k, nearIsle)) : [],
    hall: ((hh) => (hh && hh.owned && hh.owner.kind === 'player' && hh.owner.id !== s.accountId && welcome(game, s, hh) ? { island: hh.island, owner: hh.owner.name } : null))(nearIsle ? game.holdings.get(game, nearIsle.id) : undefined),
  };
}

/** Refugees (the rescued, the freed) waiting aboard settle when their captain lies off her own island. */
export function settleRefugees(game: Game, s: PlayerSession): void {
  const p = s.profile;
  const ship = s.ship;
  if (!p || !ship || !(p.refugees ?? 0)) return;
  const h = ownIsland(game, s.accountId);
  if (!h) return;
  const isl = island(game, h.island)!;
  if (ship.docked || dist(isl.x, isl.y, ship.state.x, ship.state.y) - isl.radius > 600) return;
  while ((p.refugees ?? 0) > 0 && settle(game, h)) p.refugees! -= 1;
}

export function clearOutposts(game: Game): void {
  const S = es(game);
  S.outposts = {};
  S.robbing.clear();
}

export function outpostById(game: Game, id: string): Outpost | undefined {
  return outposts(game)[id];
}
