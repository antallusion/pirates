// Resource sites and logistics: temporary extraction rights to mines, groves and pearl banks.
// The site produces into a stockpile on the island; the rights holder must physically sail there,
// anchor and haul it with the boats — then carry it to a port, a warehouse, or a shipyard.
// Every step is a ship at sea that can be robbed, which is how the economy makes PvP by itself.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { closestOnPolygon, dist } from '../../../shared/src/math.ts';
import type { ResourceSiteView } from '../../../shared/src/protocol.ts';
import { cargoVolume, tx } from '../../../shared/src/sim/shipstats.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Island, Port, World } from '../../../shared/src/world/worldgen.ts';
import { ECON_HOUR } from './economy.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

export interface ResourceSite {
  id: string;
  islandId: number;
  name: string;
  good: GoodId;
  rate: number; // units per economy hour
  capacity: number;
  stock: number;
  holder: number | null; // account id
  holderName: string;
  until: number; // rights expiry (world time)
}

export const RIGHTS_SEC = 2 * 3600;
const HAUL_RANGE = 300;
export const WAREHOUSE_VOLUME = 120;
export const WAREHOUSE_RENT = 300;

export function buildSites(world: World): ResourceSite[] {
  const out: ResourceSite[] = [];
  for (const is of world.islands) {
    if (is.portId) continue;
    for (const f of is.features) {
      let good: GoodId | null = null;
      if (f === 'mine') good = is.biome === 'volcanic' ? 'iron' : REGIONS[is.region].strangeness > 0.3 ? 'abyssal_ore' : 'coal';
      else if (f === 'grove') good = 'timber';
      else if (f === 'pearl_bank') good = 'pearls';
      if (!good) continue;
      const scale = Math.min(2, is.radius / 400);
      const rate = Math.round((good === 'pearls' ? 3 : good === 'abyssal_ore' ? 2 : 10) * (0.7 + scale * 0.5));
      out.push({ id: `${is.id}:${good}`, islandId: is.id, name: is.name, good, rate, capacity: rate * 8, stock: rate * 2, holder: null, holderName: '', until: 0 });
    }
  }
  return out;
}

export function rightsCost(site: ResourceSite): number {
  return Math.round(site.rate * GOODS[site.good].basePrice * 2.2 + 150);
}

/** Harbour masters sell rights to sites within 25 km. */
export function sitesNearPort(game: Game, port: Port): ResourceSite[] {
  return game.sites.filter((s) => {
    const is = game.world.islands[s.islandId];
    return dist(is.x, is.y, port.x, port.y) < 25000;
  });
}

export function siteView(game: Game, s: PlayerSession, site: ResourceSite): ResourceSiteView {
  const is = game.world.islands[site.islandId];
  const mine = site.holder === s.accountId && site.until > game.now;
  return {
    id: site.id, island: site.name, x: Math.round(is.x), y: Math.round(is.y), good: site.good, rate: site.rate,
    stock: mine ? Math.floor(site.stock) : -1, capacity: site.capacity, cost: rightsCost(site),
    holder: site.until > game.now ? site.holderName : null, until: site.until, mine,
  };
}

export function tickSites(game: Game, dt: number): void {
  for (const site of game.sites) {
    if (site.until <= game.now) {
      site.holder = null;
      site.holderName = '';
    }
    site.stock = Math.min(site.capacity, site.stock + (site.rate * dt) / ECON_HOUR);
  }
}

export function buyRights(game: Game, s: PlayerSession, port: Port, siteId: string): string | null {
  const site = sitesNearPort(game, port).find((x) => x.id === siteId);
  if (!site) return 'This harbour master has no say over that site';
  if (site.until > game.now && site.holder !== s.accountId) return `${site.holderName} holds those rights until they lapse`;
  const cost = rightsCost(site);
  if (s.profile!.gold < cost) return `Rights cost ${cost} silver`;
  s.profile!.gold -= cost;
  site.holder = s.accountId;
  site.holderName = s.name;
  site.until = Math.max(game.now, site.until) + RIGHTS_SEC;
  game.db.ledger(s.accountId, 'rights', -cost, site.id);
  game.sendTo(s, { t: 'toast', msg: `Rights to the ${GOODS[site.good].name.toLowerCase()} on ${site.name} are yours for two hours. Sail there and haul (L).`, kind: 'good' });
  const is = game.world.islands[site.islandId];
  game.chartIsland(s, is);
  return null;
}

/** An owned site within reach of the boats, or null. */
export function ownSiteNear(game: Game, s: PlayerSession): { site: ResourceSite; island: Island } | null {
  const ship = s.ship!;
  for (const site of game.sites) {
    if (site.holder !== s.accountId || site.until <= game.now || site.stock < 1) continue;
    const is = game.world.islands[site.islandId];
    if (dist(is.x, is.y, ship.state.x, ship.state.y) > is.radius + HAUL_RANGE) continue;
    if (Math.sqrt(closestOnPolygon(ship.state.x, ship.state.y, is.poly).d2) <= HAUL_RANGE) return { site, island: is };
  }
  return null;
}

/** Load as much of the stockpile as fits. */
export function haulSite(game: Game, ship: ShipEntity, site: ResourceSite): number {
  const def = GOODS[site.good];
  const free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul);
  const n = Math.max(0, Math.min(Math.floor(site.stock), Math.floor((free + 1e-6) / def.volume)));
  if (n > 0) {
    ship.cargo[site.good] = (ship.cargo[site.good] ?? 0) + n;
    site.stock -= n;
  }
  return n;
}

// ------------------------------------------------------------------ warehouses

export function warehouseVolume(c: Cargo): number {
  return cargoVolume(c);
}

export function warehouseAction(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  if (!GOODS[good] || !Number.isInteger(qty) || qty === 0 || Math.abs(qty) > 1000) return 'Bad order';
  let wh = p.warehouses[port.id];
  if (!wh) {
    const rent = Math.round(WAREHOUSE_RENT * Math.max(0, 1 + tx(ship.stats, 'dutyMul')));
    if (p.gold < rent) return `Renting a warehouse here costs ${rent} silver`;
    p.gold -= rent;
    wh = p.warehouses[port.id] = {};
    game.db.ledger(s.accountId, 'warehouse', -rent, port.id);
  }
  if (qty > 0) {
    // Deposit from the hold.
    const have = ship.cargo[good] ?? 0;
    const n = Math.min(qty, have);
    if (n <= 0) return 'You do not carry that';
    if (warehouseVolume(wh) + n * GOODS[good].volume > WAREHOUSE_VOLUME + 1e-6) return 'The warehouse is full';
    ship.cargo[good] = have - n;
    if (!ship.cargo[good]) delete ship.cargo[good];
    wh[good] = (wh[good] ?? 0) + n;
    // Goods at rest in a warehouse are no longer traceable plunder.
    const stolen = p.stolen[good] ?? 0;
    if (stolen > 0) p.stolen[good] = Math.max(0, stolen - n);
    return null;
  }
  const n = Math.min(-qty, wh[good] ?? 0);
  if (n <= 0) return 'Nothing of that kind stored here';
  const free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul);
  const fit = Math.min(n, Math.floor((free + 1e-6) / GOODS[good].volume));
  if (fit <= 0) return 'No room in the hold';
  wh[good] = (wh[good] ?? 0) - fit;
  if (!wh[good]) delete wh[good];
  ship.cargo[good] = (ship.cargo[good] ?? 0) + fit;
  return null;
}

// ------------------------------------------------------------------ shipyard materials

/** Materials a yard accepts toward each module; each unit supplied knocks a share off the price. */
export const MODULE_MATERIALS: Record<string, { good: GoodId; units: number }> = {
  hull_plating: { good: 'timber', units: 20 },
  sail_plan: { good: 'sailcloth', units: 12 },
  rudder: { good: 'iron', units: 8 },
  hold_expansion: { good: 'timber', units: 16 },
  crew_quarters: { good: 'timber', units: 10 },
  figurehead_kraken: { good: 'timber', units: 6 },
};

/** Take materials from hold then warehouse; returns the fraction of materials supplied (0..1). */
export function supplyMaterials(s: PlayerSession, port: Port, module: string): number {
  const need = MODULE_MATERIALS[module];
  if (!need) return 0;
  const ship = s.ship!;
  const wh = s.profile!.warehouses[port.id] ?? {};
  let left = need.units;
  const fromHold = Math.min(left, Math.floor(ship.cargo[need.good] ?? 0));
  ship.cargo[need.good] = (ship.cargo[need.good] ?? 0) - fromHold;
  if (!ship.cargo[need.good]) delete ship.cargo[need.good];
  left -= fromHold;
  const fromWh = Math.min(left, Math.floor(wh[need.good] ?? 0));
  wh[need.good] = (wh[need.good] ?? 0) - fromWh;
  if (!wh[need.good]) delete wh[need.good];
  left -= fromWh;
  return (need.units - left) / need.units;
}
