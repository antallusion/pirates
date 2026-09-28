// Islands and holdings (docs/01 §9): rent an island for 7, 14 or 30 days, build on it, keep it supplied.
//  - Rent is paid to the faction that holds the region's ports (+standing with them), from your purse — at the
//    island itself or at a harbour office in the region — or, when the lease runs out, from the island's own
//    treasury (automatically, a week at a time). One personal island per captain.
//  - Upkeep is daily and real: silver from the treasury plus materials from the island's store (powder for the
//    guns, oil for the lighthouse, provisions for the garrison). An unpaid building loses 10% condition a day
//    and works at half strength. 72 h past the end of a lease the rights return to the faction; the buildings
//    fall to ruin and 30% of the store is left on the beach for anyone.
//  - Buildings (shared/src/data/holdings.ts): the store, a pier where ships mend, a shipyard (builds to tier III,
//    the dry dock to IV) and a tavern to hire from, a workshop, a hidden cove, a smugglers' store, batteries and
//    a fort that fire on pirates and on whoever fires on you, a lighthouse (sight, witness, toll), farms, mines,
//    plantations, a sawmill, a distillery, a powder mill, a chapel, a chart house, barracks.

import { estateProduce, ownedSlots, residentMul } from './estate.ts';
import type { Resident } from './estate.ts';
import { BUILDINGS, ISLAND_CACHE_VOLUME, LIMIT_PERSONAL, RENT, RENT_DAYS, WAREHOUSE_ISLAND_VOLUME, islandSize, islandSlots, rentZoneMul } from '../../../shared/src/data/holdings.ts';
import type { BuildingId, RentDays } from '../../../shared/src/data/holdings.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { dist } from '../../../shared/src/math.ts';
import type { HoldingView, IslandOffer, SiegeView } from '../../../shared/src/protocol.ts';
import { cargoValue, cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island, Port } from '../../../shared/src/world/worldgen.ts';
import { siegesFor } from './siege.ts';
import type { Siege } from './siege.ts';
import { hireTrade } from './crew.ts';
import { baseUpkeepPerDay, guildCanLease, guildPay } from './guilds.ts';
import type { Game } from './Game.ts';
import { changeRep } from './player.ts';
import type { PlayerSession } from './player.ts';
import { deliver } from './post.ts';
import { repairCost } from './ports.ts';
import type { ShipEntity } from './ship.ts';
import { SPEED_SCALE } from '../../../shared/src/constants.ts';

const DAY = 86_400_000;
const HOUR = 3_600_000;
export const GRACE_MS = 72 * HOUR;
export const REACH = 800; // metres beyond the shore to deal with the island from your deck
export const MOOR = 300;

export interface Owner {
  kind: 'player' | 'guild';
  id: number;
  name: string;
}

export interface Building {
  id: BuildingId;
  condition: number; // 0..1
  unpaid: boolean;
}

export interface Holding {
  island: number;
  owner: Owner;
  since: number;
  until: number; // wall ms: the lease runs to here
  lastDays: RentDays;
  autoRenew: boolean;
  treasury: number;
  store: Cargo;
  buildings: Building[];
  lastUpkeep: number;
  lastWork: number;
  toll: { day: number; paid: number };
  warned: boolean;
  window: number; // UTC hour the daily two-hour vulnerability window opens (sieges)
  windowNext: { hour: number; from: number } | null;
  shieldUntil: number; // wall ms: no siege before
  lastSiege: number;
  base?: number; // guild base level (docs/02 §12.A.3): +2 slots a level
  siege?: Siege;
  /** A captain's own island, bought outright (docs/12 P7): its level 1..10, its residents, its guests. */
  owned?: boolean;
  level?: number;
  residents?: Resident[];
  visitors?: number;
}

export class HoldingsHub {
  private all: Record<string, Holding> | null = null;
  aggressors = new Map<number, Map<number, number>>(); // island -> ship id -> world time until
  nextSalvo = new Map<number, number>();
  private dirty = false;
  private regionFaction = new Map<string, FactionId>();

  map(game: Game): Record<string, Holding> {
    this.all ??= game.db.getKv<Record<string, Holding>>('holdings') ?? {};
    return this.all;
  }

  get(game: Game, island: number): Holding | undefined {
    return this.map(game)[island];
  }

  touch(): void {
    this.dirty = true;
  }

  /** Another zone rewrote the record: reload it on next use. */
  drop(): void {
    if (!this.dirty) this.all = null;
  }

  save(game: Game): void {
    if (!this.dirty || !this.all) return;
    game.db.setKv('holdings', this.all);
    this.dirty = false;
  }

  /** The faction that holds most of the region's ports takes the rent. */
  factionOf(game: Game, region: string): FactionId {
    let f = this.regionFaction.get(region);
    if (!f) {
      const count = new Map<FactionId, number>();
      for (const p of game.world.ports) if (p.region === region) count.set(p.faction, (count.get(p.faction) ?? 0) + 1);
      f = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'free';
      this.regionFaction.set(region, f);
    }
    return f;
  }
}

// ------------------------------------------------------------------------------------------ helpers

export function island(game: Game, id: number): Island | undefined {
  return game.world.islands[id];
}

export function has(h: Holding, id: BuildingId): Building | undefined {
  return h.buildings.find((b) => b.id === id);
}

/** How well a building works: condition, halved while unpaid. */
export function strength(h: Holding, id: BuildingId): number {
  const list = h.buildings.filter((b) => b.id === id);
  return list.reduce((a, b) => a + b.condition * (b.unpaid ? 0.5 : 1), 0);
}

export function slotsOf(isl: Island, h: Holding | undefined): number {
  if (h?.owned) return ownedSlots(h, isl);
  return islandSlots(isl.radius, isl.region) + 2 * (h?.base ?? 0);
}

export function storeCapacity(h: Holding): number {
  return ISLAND_CACHE_VOLUME + (has(h, 'warehouse') ? WAREHOUSE_ISLAND_VOLUME : 0);
}

export function slotsUsed(h: Holding): number {
  return h.buildings.reduce((a, b) => a + BUILDINGS[b.id].slots, 0);
}

/** Whether this captain may use the holding (its owner; a guild's members once guilds hold islands). */
export function mayUse(game: Game, h: Holding, accountId: number): boolean {
  if (h.owner.kind === 'player') return h.owner.id === accountId;
  return game.guildMember?.(h.owner.id, accountId) ?? false;
}

export function rentable(isl: Island): string | null {
  if (isl.portId) return 'Port islands are not for rent';
  const mul = rentZoneMul(isl.region);
  if (mul === null) return 'Nobody rents out land in the Abyss';
  if (isl.region === 'black_coast' && islandSize(isl.radius) === 'large') return 'The Crown leases only small and middling islands on its coast';
  return null;
}

export function rentPrice(isl: Island, days: RentDays): number {
  return Math.round(RENT[islandSize(isl.radius)][days] * (rentZoneMul(isl.region) ?? 1));
}

/** The island within reach of this ship (at sea, near its shore). */
export function islandNear(game: Game, ship: ShipEntity): Island | null {
  if (ship.docked) return null;
  let best: Island | null = null, bd = Infinity;
  for (const isl of game.world.islands) {
    if (isl.portId) continue;
    const d = dist(isl.x, isl.y, ship.state.x, ship.state.y) - isl.radius;
    if (d < REACH && d < bd) {
      bd = d;
      best = isl;
    }
  }
  return best;
}

function moored(game: Game, ship: ShipEntity, isl: Island): boolean {
  return !ship.docked && ship.alive && Math.abs(ship.state.speed) < 1.2 && !ship.inCombat(game.now) && dist(isl.x, isl.y, ship.state.x, ship.state.y) - isl.radius < MOOR;
}

/** Where a captain may deal with this island: at it, or at a harbour office in its region. */
function atHand(game: Game, s: PlayerSession, isl: Island): boolean {
  const ship = s.ship!;
  if (ship.docked) return game.portById(ship.docked)?.region === isl.region;
  return islandNear(game, ship)?.id === isl.id;
}

/** The island as a yard and a tavern for the shipbuilding and crew code. */
export function islePort(game: Game, h: Holding): Port {
  const isl = island(game, h.island)!;
  return {
    id: `isle:${h.island}`, name: isl.name, region: isl.region, faction: 'free', x: isl.x, y: isl.y, islandId: isl.id, size: 1,
    // A guild's fortress (base level 4+) with a dry dock builds ships of the line (canon D12: the fifth tier).
    shipyardTier: has(h, 'dry_dock') ? ((h.base ?? 0) >= 4 ? 5 : 4) : has(h, 'shipyard') ? 3 : 0, blackMarket: false, profile: { produces: {}, consumes: {} }, description: '', key: false,
  };
}

function ownedBy(game: Game, accountId: number): Holding[] {
  return Object.values(game.holdings.map(game)).filter((h) => h.owner.kind === 'player' && h.owner.id === accountId);
}

// ------------------------------------------------------------------------------------------ renting

export function rentIsland(game: Game, s: PlayerSession, islandId: number, days: number, forGuild = false): string | null {
  const isl = island(game, islandId);
  if (!isl) return 'No such island';
  const why = rentable(isl);
  if (why) return why;
  if (!RENT_DAYS.includes(days as RentDays)) return 'A lease runs 7, 14 or 30 days';
  if (!atHand(game, s, isl)) return `Sail to ${isl.name}, or ask at a harbour office in ${REGIONS[isl.region].name}`;
  const p = s.profile!;
  const now = game.wallNow();
  const cur = game.holdings.get(game, islandId);
  if (cur && !mayUse(game, cur, s.accountId) && cur.until + GRACE_MS > now) return `${isl.name} is leased to ${cur.owner.name}`;
  // A guild lease is paid from the guild's treasury; a captain's from their purse.
  const guild = forGuild ? guildCanLease(game, s) : null;
  if (typeof guild === 'string') return guild;
  if (!guild && (!cur || !mayUse(game, cur, s.accountId))) {
    if (ownedBy(game, s.accountId).length >= LIMIT_PERSONAL) return 'A captain may hold one island of their own';
  }
  const price = rentPrice(isl, days as RentDays);
  if (guild) {
    if (cur && mayUse(game, cur, s.accountId) && !(cur.owner.kind === 'guild' && cur.owner.id === guild.gid)) return 'That island is your own, not the guild’s';
    if (!guildPay(game, guild.gid, price)) return `The lease is ${price} from the guild treasury`;
    game.db.ledger(s.accountId, 'island_rent_guild', 0, `${isl.id}:${days}:${price}`);
  } else {
    if (cur && cur.owner.kind === 'guild' && mayUse(game, cur, s.accountId)) return 'That island is the guild’s: lease it for the guild';
    if (p.gold < price) return `The lease is ${price} silver`;
    p.gold -= price;
    game.db.ledger(s.accountId, 'island_rent', -price, `${isl.id}:${days}`);
  }
  const faction = game.holdings.factionOf(game, isl.region);
  changeRep(p, faction, 3);
  let h = cur && mayUse(game, cur, s.accountId) ? cur : undefined;
  if (!h) {
    h = {
      island: isl.id, owner: guild ? { kind: 'guild', id: guild.gid, name: guild.name } : { kind: 'player', id: s.accountId, name: s.name }, since: now, until: now, lastDays: days as RentDays, autoRenew: true,
      treasury: 0, store: {}, buildings: [], lastUpkeep: now, lastWork: now, toll: { day: 0, paid: 0 }, warned: false,
      window: 19, windowNext: null, shieldUntil: now + 72 * HOUR, lastSiege: 0,
    };
    game.holdings.map(game)[isl.id] = h;
  }
  h.until = Math.max(h.until, now) + days * DAY;
  h.lastDays = days as RentDays;
  h.warned = false;
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: `${isl.name} is yours until ${new Date(h.until).toUTCString().slice(5, 22)} UTC.`, kind: 'good' });
  return null;
}

export function setAutoRenew(game: Game, s: PlayerSession, islandId: number, on: boolean): string | null {
  const h = game.holdings.get(game, islandId);
  if (!h || !mayUse(game, h, s.accountId)) return 'Not your island';
  h.autoRenew = !!on;
  game.holdings.touch();
  return null;
}

export function treasuryMove(game: Game, s: PlayerSession, islandId: number, amount: number): string | null {
  const h = game.holdings.get(game, islandId);
  const isl = island(game, islandId);
  if (!h || !isl || !mayUse(game, h, s.accountId)) return 'Not your island';
  if (!atHand(game, s, isl)) return `At ${isl.name}, or a harbour office in its region`;
  const p = s.profile!;
  const n = Math.trunc(Number(amount));
  if (!Number.isFinite(n) || n === 0) return 'Bad amount';
  if (n > 0) {
    if (p.gold < n) return 'Not that much silver aboard';
    p.gold -= n;
    h.treasury += n;
  } else {
    if (h.treasury < -n) return 'Not that much in the treasury';
    h.treasury += n;
    p.gold -= n;
  }
  game.holdings.touch();
  return null;
}

// ------------------------------------------------------------------------------------------ building

export function build(game: Game, s: PlayerSession, islandId: number, id: BuildingId): string | null {
  const h = game.holdings.get(game, islandId);
  const isl = island(game, islandId);
  if (!h || !isl || !mayUse(game, h, s.accountId)) return 'Not your island';
  const def = BUILDINGS[id];
  if (!def) return 'Unknown building';
  if (islandNear(game, s.ship!)?.id !== isl.id) return `The builders must be landed at ${isl.name}`;
  if (id !== 'battery' && has(h, id)) return `${isl.name} already has a ${def.name.toLowerCase()}`;
  if (slotsUsed(h) + def.slots > slotsOf(isl, h)) return `No room: ${isl.name} has ${slotsOf(isl, h)} slots`;
  if (def.needs && !has(h, def.needs)) return `Needs a ${BUILDINGS[def.needs].name.toLowerCase()} first`;
  if (def.notSafe && REGIONS[isl.region].safety === 'safe') return 'Not on the Crown’s own coast';
  if (def.feature === 'mine' && !isl.features.includes('mine')) return 'There is no ore in this rock';
  if (def.biomes && !def.biomes.includes(isl.biome)) return 'Nothing like that grows here';
  const p = s.profile!;
  if (p.gold < def.cost) return `${def.name}: ${def.cost} silver`;
  // Materials from the hold first, then the island's store.
  const ship = s.ship!;
  for (const [g, n] of Object.entries(def.materials)) {
    if ((ship.cargo[g as GoodId] ?? 0) + (h.store[g as GoodId] ?? 0) < (n ?? 0)) return `Needs ${n} ${GOODS[g as GoodId].name.toLowerCase()} in your hold or the island's store`;
  }
  for (const [g, n] of Object.entries(def.materials)) {
    const good = g as GoodId;
    const fromHold = Math.min(n ?? 0, ship.cargo[good] ?? 0);
    ship.cargo[good] = (ship.cargo[good] ?? 0) - fromHold;
    if (!ship.cargo[good]) delete ship.cargo[good];
    const rest = (n ?? 0) - fromHold;
    if (rest > 0) {
      h.store[good] = (h.store[good] ?? 0) - rest;
      if (!h.store[good]) delete h.store[good];
    }
  }
  p.gold -= def.cost;
  game.db.ledger(s.accountId, 'island_build', -def.cost, `${isl.id}:${id}`);
  h.buildings.push({ id, condition: 1, unpaid: false });
  game.holdings.touch();
  game.sendTo(s, { t: 'toast', msg: `The ${def.name.toLowerCase()} on ${isl.name} is finished.`, kind: 'good' });
  return null;
}

export function demolish(game: Game, s: PlayerSession, islandId: number, index: number): string | null {
  const h = game.holdings.get(game, islandId);
  if (!h || !mayUse(game, h, s.accountId)) return 'Not your island';
  const b = h.buildings[index];
  if (!b) return 'No such building';
  if (h.buildings.some((x) => BUILDINGS[x.id].needs === b.id) && h.buildings.filter((x) => x.id === b.id).length === 1) return 'Something else stands on it';
  h.buildings.splice(index, 1);
  game.holdings.touch();
  return null;
}

// ------------------------------------------------------------------------------------------ the store

export function storeMove(game: Game, s: PlayerSession, islandId: number, good: GoodId, qty: number): string | null {
  const h = game.holdings.get(game, islandId);
  const isl = island(game, islandId);
  if (!h || !isl || !mayUse(game, h, s.accountId)) return 'Not your island';
  const ship = s.ship!;
  if (islandNear(game, ship)?.id !== isl.id) return `Lie off ${isl.name} to use the store`;
  if (!GOODS[good] || !Number.isInteger(qty) || qty === 0 || Math.abs(qty) > 5000) return 'Bad order';
  if (qty > 0) {
    const n = Math.min(qty, Math.floor(ship.cargo[good] ?? 0));
    if (n <= 0) return 'You do not carry that';
    if (GOODS[good].contraband && !has(h, 'smuggler_store')) return 'Contraband needs a smugglers’ store';
    if (cargoVolume(h.store) + n * GOODS[good].volume > storeCapacity(h) + 1e-6) return 'The store is full';
    ship.cargo[good] = (ship.cargo[good] ?? 0) - n;
    if (!ship.cargo[good]) delete ship.cargo[good];
    h.store[good] = (h.store[good] ?? 0) + n;
    const p = s.profile!;
    const hot = Math.min(p.stolen[good] ?? 0, n);
    if (hot > 0) p.stolen[good] = (p.stolen[good] ?? 0) - hot; // at rest ashore, no longer traceable
  } else {
    const st = ship.stats;
    const free = st.holdVolume - cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
    const n = Math.min(-qty, Math.floor(h.store[good] ?? 0), Math.floor((free + 1e-6) / GOODS[good].volume));
    if (n <= 0) return (h.store[good] ?? 0) <= 0 ? 'None of that in the store' : 'No room in the hold';
    h.store[good] = (h.store[good] ?? 0) - n;
    if (!h.store[good]) delete h.store[good];
    ship.cargo[good] = (ship.cargo[good] ?? 0) + n;
  }
  game.holdings.touch();
  return null;
}

// ------------------------------------------------------------------------------------------ services

export function islandService(game: Game, s: PlayerSession, islandId: number, what: string, arg: string | number): string | null {
  const h = game.holdings.get(game, islandId);
  const isl = island(game, islandId);
  if (!h || !isl || !mayUse(game, h, s.accountId)) return 'Not your island';
  const ship = s.ship!;
  if (!moored(game, ship, isl)) return `Heave to off ${isl.name} first (within ${MOOR} m, stopped, not in a fight)`;
  const p = s.profile!;
  switch (what) {
    case 'repair': {
      if (!has(h, 'shipyard')) return 'No shipyard here';
      if (ship.cls.tier > (has(h, 'dry_dock') ? 4 : 3)) return `This yard cannot take a tier ${ship.cls.tier} hull`;
      const cost = Math.ceil(repairCost(ship) * (has(h, 'dry_dock') ? 0.75 : 1));
      if (cost <= 0) return 'She is already sound';
      if (p.gold < cost) return `Repairs cost ${cost} silver`;
      p.gold -= cost;
      h.treasury += Math.round(cost * 0.3); // your yard, your hands: part of the bill stays on the island
      ship.hull = ship.stats.hullMax;
      ship.sails = ship.stats.sailHpMax;
      ship.rudderHp = 1;
      ship.gunsDisabled = { port: 0, starboard: 0 };
      if (ship.hasEffect('broken_mast')) ship.effects = ship.effects.filter((e) => e.id !== 'broken_mast' && e.id !== 'mast_wreck');
      ship.recompute(game.now);
      game.db.ledger(s.accountId, 'repair', -cost, `isle:${isl.id}`);
      break;
    }
    case 'hire': {
      if (!has(h, 'tavern')) return 'No tavern here';
      return hireTrade(game, s, islePort(game, h), 'sailor', Math.trunc(Number(arg)));
    }
    case 'craft': {
      if (!has(h, 'workshop')) return 'No workshop here';
      const from: GoodId = arg === 'sailcloth' ? 'cloth' : 'timber';
      const to: GoodId = arg === 'sailcloth' ? 'sailcloth' : 'planks';
      const pairs = Math.floor((h.store[from] ?? 0) / 2);
      if (pairs <= 0) return `Needs ${GOODS[from].name.toLowerCase()} in the store`;
      const made = pairs * 3;
      if (cargoVolume(h.store) - pairs * 2 * GOODS[from].volume + made * GOODS[to].volume > storeCapacity(h) + 1e-6) return 'The store is too full';
      h.store[from] = (h.store[from] ?? 0) - pairs * 2;
      if (!h.store[from]) delete h.store[from];
      h.store[to] = (h.store[to] ?? 0) + made;
      game.sendTo(s, { t: 'toast', msg: `The workshop turns out ${made} ${GOODS[to].name.toLowerCase()}.`, kind: 'good' });
      break;
    }
    case 'copy_map': {
      if (!has(h, 'chart_house')) return 'No chart house here';
      const m = p.explore.maps.find((x) => x.id === String(arg));
      if (!m) return 'No such map';
      if (p.gold < 500) return 'A copy costs 500 silver';
      if (p.explore.maps.length >= 12) return 'Your chart chest is full';
      p.gold -= 500;
      p.explore.maps.push({ ...m, id: `m${game.allocId()}`, hoard: m.hoard ?? m.id, copy: true, verdict: undefined, sealed: undefined }); // a copy leads to the same chest
      game.db.ledger(s.accountId, 'chart_copy', -500, m.name);
      break;
    }
    default:
      return 'Unknown service';
  }
  game.holdings.touch();
  return null;
}

/** A hull laid down at the island's yard uses the shipbuilding code with the island as its port. */
export function islandYard(game: Game, s: PlayerSession, islandId: number): Port | string {
  const h = game.holdings.get(game, islandId);
  const isl = island(game, islandId);
  if (!h || !isl || !mayUse(game, h, s.accountId)) return 'Not your island';
  if (!has(h, 'shipyard')) return 'No shipyard here';
  if (!moored(game, s.ship!, isl)) return `Heave to off ${isl.name} first`;
  return islePort(game, h);
}

/** Owners may choose the daily siege window (UTC hour); a change takes effect in 48 h. */
export function setWindow(game: Game, s: PlayerSession, islandId: number, hour: number): string | null {
  const h = game.holdings.get(game, islandId);
  if (!h || !mayUse(game, h, s.accountId)) return 'Not your island';
  const hr = Math.trunc(Number(hour));
  if (!(hr >= 16 && hr <= 22)) return 'The window opens between 16:00 and 22:00 UTC';
  h.windowNext = { hour: hr, from: game.wallNow() + 48 * HOUR };
  game.holdings.touch();
  return null;
}

// ------------------------------------------------------------------------------------------ the world

/** Every second: moorings, lighthouses, guns; every ten, the calendar (production, upkeep, leases). */
export function stepHoldings(game: Game): void {
  const hub = game.holdings;
  // In a multi-zone world each zone keeps the islands in its own waters.
  const holdings = Object.values(hub.map(game)).filter((h) => !game.zone || game.zone.regions.has(game.world.islands[h.island]?.region));
  if (!holdings.length) return;
  const now = game.now;
  for (const h of holdings) {
    const isl = island(game, h.island);
    if (!isl) continue;
    const owners: ShipEntity[] = [];
    game.forShipsNear(isl.x, isl.y, isl.radius + 6000, (o) => {
      if (!o.alive || o.docked) return;
      const acct = o.accountId ?? (o.ownerId !== null ? game.ships.get(o.ownerId)?.accountId ?? null : null);
      if (acct !== null && mayUse(game, h, acct)) owners.push(o);
    });
    for (const o of owners) {
      const d = dist(o.state.x, o.state.y, isl.x, isl.y) - isl.radius;
      // The lighthouse: 50% farther within 6 km.
      if (strength(h, 'lighthouse') > 0 && d < 6000) o.addEffect({ id: 'isle_light', until: now + 1.6, mods: { detection: 0.5 * Math.min(1, strength(h, 'lighthouse')) } }, now);
      if (!moored(game, o, isl)) continue;
      // Moorings: the pier mends, the tavern cheers, the chapel steadies, the cove hides.
      const pier = Math.min(1, strength(h, 'pier'));
      if (pier > 0) o.hull = Math.min(o.stats.hullMax, o.hull + o.stats.hullMax * 0.05 / 600 * pier);
      if (strength(h, 'tavern') > 0) o.addEffect({ id: 'isle_tavern', until: now + 1.6, mods: { moraleBase: 10 } }, now);
      const chapel = Math.min(1, strength(h, 'chapel'));
      if (chapel > 0) {
        o.sanity = Math.min(100, o.sanity + (30 / 600) * chapel);
        o.curse = Math.max(0, o.curse - (5 / 600) * chapel);
      }
      if (strength(h, 'hidden_cove') > 0) o.addEffect({ id: 'isle_cove', until: now + 1.6, flags: ['hidden'] }, now);
    }
    // The guns.
    const guns = 8 * strength(h, 'battery') + 24 * strength(h, 'fort');
    if (guns > 0 && (hub.nextSalvo.get(h.island) ?? 0) <= now) fireShoreGuns(game, h, isl, guns);
    // Whoever fires on the owner's ships near the island is marked for the guns.
    for (const o of owners) {
      for (const [id, t] of o.attackers) {
        if (t < now - 30 || dist(o.state.x, o.state.y, isl.x, isl.y) > isl.radius + 2500) continue;
        let m = hub.aggressors.get(h.island);
        if (!m) hub.aggressors.set(h.island, (m = new Map()));
        m.set(id, now + 600);
      }
    }
    // Island taverns keep a few hands looking for a berth.
    if (has(h, 'tavern') && Math.floor(now) % 60 === 0) {
      const k = `isle:${h.island}`;
      game.tavernCrew.set(k, Math.min(20, (game.tavernCrew.get(k) ?? 0) + 1));
    }
  }
  if (Math.floor(now) % 10 === 0) for (const h of holdings) stepCalendar(game, h);
  if (Math.floor(now) % 60 === 0) {
    stepTolls(game, holdings);
    hub.save(game);
  }
}

function hostileToIsland(game: Game, h: Holding, o: ShipEntity): boolean {
  if (!o.alive || o.docked) return false;
  const acct = o.accountId ?? (o.ownerId !== null ? game.ships.get(o.ownerId)?.accountId ?? null : null);
  if (acct !== null && mayUse(game, h, acct)) return false;
  if (o.npcRole === 'pirate' || o.npcRole === 'ghost') return true;
  if ((game.holdings.aggressors.get(h.island)?.get(o.id) ?? 0) > game.now) return true;
  return game.islandHostile?.(h, o) ?? false; // sieges and wars
}

function fireShoreGuns(game: Game, h: Holding, isl: Island, guns: number): void {
  let target: ShipEntity | null = null, bd = Infinity;
  game.forShipsNear(isl.x, isl.y, isl.radius + 1200, (o) => {
    const d = dist(o.state.x, o.state.y, isl.x, isl.y) - isl.radius;
    if (d < 1200 && d < bd && hostileToIsland(game, h, o)) {
      bd = d;
      target = o;
    }
  });
  if (!target) return;
  const t = target as ShipEntity;
  // A salvo from every gun that bears, aimed where she will be; the more guns, the tighter the fall of shot.
  const lead = 1.4;
  const v = { x: Math.sin(t.state.heading) * t.state.speed * SPEED_SCALE, y: -Math.cos(t.state.heading) * t.state.speed * SPEED_SCALE };
  game.strikes.push({ at: game.now + lead, x: t.state.x + v.x * lead, y: t.state.y + v.y * lead, radius: Math.max(22, 60 - guns * 1.2), hull: 45, rudder: 0, owner: 0, slow: 0, shells: Math.max(1, Math.round(guns)), fx: 'barrage' });
  game.holdings.nextSalvo.set(h.island, game.now + 12);
  game.emit({ k: 'fx', fx: 'war_cry', x: Math.round(isl.x), y: Math.round(isl.y), r: 60 }, isl.x, isl.y);
}

/** Merchants passing a lighthouse within 3 km pay 2% of their cargo (to 3 000 a day). */
function stepTolls(game: Game, holdings: Holding[]): void {
  const day = Math.floor(game.wallNow() / DAY);
  for (const h of holdings) {
    const light = Math.min(1, strength(h, 'lighthouse'));
    if (light <= 0) continue;
    const isl = island(game, h.island)!;
    if (h.toll.day !== day) h.toll = { day, paid: 0 };
    game.forShipsNear(isl.x, isl.y, isl.radius + 3000, (o) => {
      if (o.npcRole !== 'merchant' || !o.alive || h.toll.paid >= 3000) return;
      const brain = game.npcs.get(o.id);
      if (!brain || brain.tolled === h.island) return;
      brain.tolled = h.island;
      const fee = Math.min(3000 - h.toll.paid, Math.round(cargoValue(o.cargo) * 0.02 * light));
      if (fee <= 0) return;
      h.toll.paid += fee;
      h.treasury += fee;
      game.holdings.touch();
    });
  }
}

/** Production by the hour, upkeep by the day, the end of a lease. */
function stepCalendar(game: Game, h: Holding): void {
  const wall = game.wallNow();
  const isl = island(game, h.island)!;
  if (h.windowNext && wall >= h.windowNext.from) {
    h.window = h.windowNext.hour;
    h.windowNext = null;
    game.holdings.touch();
  }
  // Production: whole hours since the last reckoning (at most three days at once).
  const hours = Math.min(72, (wall - h.lastWork) / HOUR);
  if (hours >= 1) {
    produce(game, h, isl, Math.floor(hours));
    h.lastWork += Math.floor(hours) * HOUR;
    game.holdings.touch();
  }
  // Upkeep: one reckoning per day due.
  while (wall - h.lastUpkeep >= DAY) {
    upkeep(game, h, isl);
    h.lastUpkeep += DAY;
    game.holdings.touch();
  }
  // The lease (an island bought outright has none to run out).
  if (h.owned || wall < h.until) return;
  const price = rentPrice(isl, 7);
  if (h.autoRenew && h.treasury >= price) {
    h.treasury -= price;
    h.until += 7 * DAY;
    notify(game, h, `${isl.name}: lease renewed`, `A week's rent of ${price} silver was paid from the island's treasury.`);
    game.holdings.touch();
    return;
  }
  if (!h.warned) {
    h.warned = true;
    notify(game, h, `${isl.name}: the lease has run out`, `Renew within 72 hours or the rights return to the ${game.holdings.factionOf(game, isl.region)} and the buildings fall to ruin. (The treasury holds ${h.treasury}; a week is ${price}.)`);
    game.holdings.touch();
  }
  if (wall >= h.until + GRACE_MS) forfeit(game, h, isl);
}

function notify(game: Game, h: Holding, subject: string, body: string): void {
  if (h.owner.kind === 'player') deliver(game, h.owner.id, { from: `Harbour office, ${REGIONS[island(game, h.island)!.region].name}`, subject, body, gold: 0, goods: null });
  else game.guildNotify?.(h.owner.id, subject, body);
}

function produce(game: Game, h: Holding, isl: Island, hours: number): void {
  const add = (g: GoodId, n: number) => {
    const room = Math.floor((storeCapacity(h) - cargoVolume(h.store)) / GOODS[g].volume);
    const k = Math.max(0, Math.min(room, Math.floor(n)));
    if (k > 0) h.store[g] = (h.store[g] ?? 0) + k;
  };
  const convert = (from: Partial<Record<GoodId, number>>, to: GoodId, out: number, batches: number) => {
    let n = batches;
    for (const [g, k] of Object.entries(from)) n = Math.min(n, Math.floor((h.store[g as GoodId] ?? 0) / (k ?? 1)));
    if (n <= 0) return;
    for (const [g, k] of Object.entries(from)) {
      h.store[g as GoodId] = (h.store[g as GoodId] ?? 0) - n * (k ?? 1);
      if (!h.store[g as GoodId]) delete h.store[g as GoodId];
    }
    add(to, n * out);
  };
  const perDay = hours / 24;
  // A resident at work: +40% a building (docs/12 P7).
  const k = (id: BuildingId) => strength(h, id) * residentMul(h, id);
  add('provisions', 20 * perDay * k('farm') + 10 * perDay * k('fishing_village'));
  // A mine gives six tons an hour of what the rock holds.
  const ore: GoodId = isl.biome === 'volcanic' || isl.biome === 'blacksand' || isl.biome === 'crystal' ? 'iron' : 'coal';
  add(ore, (6 / GOODS[ore].weight) * hours * k('mine'));
  const crop: GoodId = isl.biome === 'mossy' ? 'tobacco' : isl.biome === 'jungle' ? 'spices' : 'sugar';
  add(crop, (1.5 / GOODS[crop].weight) * hours * k('plantation'));
  // Mills turn what is in the store.
  convert({ timber: 10 }, 'planks', 13, Math.floor(6 * hours * k('sawmill')));
  convert({ sugar: 2 }, 'rum', 1, Math.floor(10 * hours * k('distillery')));
  convert({ salt: 2, coal: 1 }, 'gunpowder', 2, Math.floor(5 * hours * k('powder_mill')));
  estateProduce(game, h, hours, add, convert);
}

function upkeep(game: Game, h: Holding, isl: Island): void {
  // Income first: the tavern and the village.
  h.treasury += Math.round((200 + game.rng.float() * 400) * strength(h, 'tavern') + 300 * strength(h, 'fishing_village'));
  // A guild base costs its weekly keep; unpaid, it slips a level.
  if (h.owner.kind === 'guild' && (h.base ?? 0) > 0) {
    const keep = baseUpkeepPerDay(game, h.owner.id, h.base!, h.island);
    if (h.treasury >= keep) h.treasury -= keep;
    else {
      h.base = h.base! - 1;
      notify(game, h, `${isl.name}: the base slips`, `Its keep of ${keep} a day went unpaid; it is a level lower now.`);
    }
  }
  for (const b of h.buildings) {
    const def = BUILDINGS[b.id];
    const goodsOk = Object.entries(def.upkeepGoods).every(([g, n]) => (h.store[g as GoodId] ?? 0) >= (n ?? 0));
    if (h.treasury >= def.upkeep && goodsOk) {
      h.treasury -= def.upkeep;
      for (const [g, n] of Object.entries(def.upkeepGoods)) {
        h.store[g as GoodId] = (h.store[g as GoodId] ?? 0) - (n ?? 0);
        if (!h.store[g as GoodId]) delete h.store[g as GoodId];
      }
      b.unpaid = false;
      b.condition = Math.min(1, b.condition + 0.1);
    } else {
      b.unpaid = true;
      b.condition = Math.max(0, b.condition - 0.1);
    }
  }
  const unpaid = h.buildings.filter((b) => b.unpaid);
  if (unpaid.length) notify(game, h, `${isl.name}: upkeep unpaid`, `${unpaid.map((b) => BUILDINGS[b.id].name).join(', ')} went unpaid today and work at half strength. Bring silver for the treasury${unpaid.some((b) => Object.keys(BUILDINGS[b.id].upkeepGoods).length) ? ' and supplies for the store' : ''}.`);
  // Ruins: a building at nothing falls down.
  h.buildings = h.buildings.filter((b) => b.condition > 0);
}

/** The rights return to the faction: ruins, and 30% of the store left on the beach. */
function forfeit(game: Game, h: Holding, isl: Island): void {
  const left: Cargo = {};
  for (const [g, n] of Object.entries(h.store)) {
    const k = Math.floor((n ?? 0) * 0.3);
    if (k > 0) left[g as GoodId] = k;
  }
  if (Object.keys(left).length) {
    const id = game.allocId();
    const a = game.rng.float() * Math.PI * 2;
    game.loot.set(id, { id, x: isl.x + Math.sin(a) * (isl.radius + 60), y: isl.y - Math.cos(a) * (isl.radius + 60), cargo: left, gold: 0, expires: game.now + 3600 });
  }
  notify(game, h, `${isl.name} is lost`, `The lease lapsed and the rights went back to the ${game.holdings.factionOf(game, isl.region)}. The buildings are ruins; what was left in the store lies on the beach.`);
  delete game.holdings.map(game)[h.island];
  game.holdings.touch();
}

/** A lighthouse (6 km) or a fishing village (3 km) sees what happens off its island. */
export function shoreWitness(game: Game, x: number, y: number): boolean {
  for (const h of Object.values(game.holdings.map(game))) {
    const isl = island(game, h.island);
    if (!isl) continue;
    const d = dist(isl.x, isl.y, x, y) - isl.radius;
    if ((d < 6000 && strength(h, 'lighthouse') > 0) || (d < 3000 && strength(h, 'fishing_village') > 0)) return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------------ views

export function holdingView(game: Game, h: Holding, accountId: number): HoldingView {
  const isl = island(game, h.island)!;
  return {
    island: h.island, name: isl.name, region: isl.region, x: Math.round(isl.x), y: Math.round(isl.y), size: islandSize(isl.radius), slots: slotsOf(isl, h),
    owner: h.owner.name, mine: mayUse(game, h, accountId), until: h.until, autoRenew: h.autoRenew, treasury: h.treasury, store: h.store, storeCap: storeCapacity(h),
    buildings: h.buildings.map((b) => ({ id: b.id, condition: Math.round(b.condition * 100) / 100, unpaid: b.unpaid })),
    upkeep: h.buildings.reduce((a, b) => a + BUILDINGS[b.id].upkeep, 0),
    renew: rentPrice(isl, 7), window: h.window, windowNext: h.windowNext?.hour ?? null, shieldUntil: h.shieldUntil, base: h.base ?? 0, guild: h.owner.kind === 'guild', owned: !!h.owned,
  };
}

export function islandOffer(game: Game, isl: Island): IslandOffer {
  const h = game.holdings.get(game, isl.id);
  return {
    island: isl.id, name: isl.name, region: isl.region, x: Math.round(isl.x), y: Math.round(isl.y), size: islandSize(isl.radius), slots: islandSlots(isl.radius, isl.region), biome: isl.biome,
    mine: isl.features.includes('mine'), price: { 7: rentPrice(isl, 7), 14: rentPrice(isl, 14), 30: rentPrice(isl, 30) }, held: h ? h.owner.name : null, why: rentable(isl),
  };
}

/** For the Company screen: your holdings, the island off your bow, and in port the region's islands for lease. */
export function holdingsFor(game: Game, s: PlayerSession): { mine: HoldingView[]; here: IslandOffer | null; region: IslandOffer[]; sieges: SiegeView[] } {
  const ship = s.ship;
  const mine = Object.values(game.holdings.map(game)).filter((h) => mayUse(game, h, s.accountId)).map((h) => holdingView(game, h, s.accountId));
  const near = ship ? islandNear(game, ship) : null;
  const here = near ? islandOffer(game, near) : null;
  let region: IslandOffer[] = [];
  if (ship?.docked) {
    const port = game.portById(ship.docked);
    if (port) region = game.world.islands.filter((i) => i.region === port.region && !i.portId).map((i) => islandOffer(game, i)).filter((o) => !o.why).sort((a, b) => dist(a.x, a.y, port.x, port.y) - dist(b.x, b.y, port.x, port.y)).slice(0, 20);
  }
  return { mine, here, region, sieges: siegesFor(game, s) };
}
