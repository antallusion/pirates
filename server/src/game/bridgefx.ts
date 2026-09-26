// Bridge talents (docs/03 §5): rules that reward two roles at once. Each helper is called from the
// system it bends (combat, boarding, trade, customs, fleet, landing).

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { MODULES } from '../../../shared/src/data/ships.ts';
import type { ModuleId, ShipClassId } from '../../../shared/src/data/ships.ts';
import type { StatMods } from '../../../shared/src/data/stats.ts';
import { dist } from '../../../shared/src/math.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

// ------------------------------------------------------------------ Storm Gunner

/** The swell rises and falls on a seven-second cycle; the crest is the top quarter of it. */
export function onCrest(now: number, shipId: number): boolean {
  return Math.sin((now * Math.PI * 2) / 7 + shipId) > 0.75;
}

export function stormGunnerRange(game: Game, ship: ShipEntity): number {
  if (!ship.hasFlag('storm_gunner')) return 1;
  return game.windFor(ship).strength >= 0.9 && onCrest(game.now, ship.id) ? 1.15 : 1;
}

// ------------------------------------------------------------------ Ghost Trader

export function ghostTraderMul(ship: ShipEntity): number {
  if (!ship.hasFlag('ghost_trader')) return 1;
  let legal = 0;
  for (const id in ship.cargo) if (!GOODS[id as GoodId].contraband) legal += ship.cargo[id as GoodId] ?? 0;
  return 1 - Math.min(0.25, Math.floor(legal / 10) * 0.01);
}

// ------------------------------------------------------------------ boarding bridges

/** Blood and Salt: the victors' hands patch the hull. */
export function bloodAndSalt(ship: ShipEntity, kills: number): void {
  if (!ship.hasFlag('blood_and_salt') || ship.hasFlag('iron_coffin') || kills <= 0 || !ship.boarding) return;
  const cap = ship.stats.hullMax * 0.1;
  const heal = Math.min(ship.stats.hullMax * 0.003 * kills, cap - (ship.boarding.healed ?? 0));
  if (heal <= 0) return;
  ship.boarding.healed = (ship.boarding.healed ?? 0) + heal;
  ship.hull = Math.min(ship.stats.hullMax, ship.hull + heal);
}

/** Drowned Boarders: five rise from the water if none are aboard. */
export function drownedBoardersRise(game: Game, ship: ShipEntity): void {
  if (!ship.hasFlag('drowned_boarders') || ship.drownedCrew.length) return;
  const n = Math.min(5, Math.max(0, ship.stats.crewMax - ship.crew));
  if (n <= 0) return;
  ship.crew += n;
  ship.drownedCrew.push({ n, until: game.now + 180 });
  game.toastShip(ship, 'Five drowned men climb the side and go over the rail ahead of the living.', 'info');
}

/** The first six seconds: the dead take the losses. Returns the living losses that remain. */
export function drownedTakeLosses(game: Game, ship: ShipEntity, losses: number): number {
  if (!ship.hasFlag('drowned_boarders') || !ship.boarding || game.now - ship.boarding.startedAt > 6 || losses <= 0) return losses;
  let left = losses;
  for (const d of ship.drownedCrew) {
    const k = Math.min(d.n, left);
    d.n -= k;
    left -= k;
    if (left <= 0) break;
  }
  ship.drownedCrew = ship.drownedCrew.filter((d) => d.n > 0);
  // The dead that fall are still crew in the tally; the living are spared.
  return left;
}

// ------------------------------------------------------------------ Flagship Yard

/** Half of the flagship's fitting bonuses, as modifiers for her escorts. */
export function flagshipYardMods(owner: ShipEntity): StatMods {
  if (!owner.hasFlag('flagship_yard')) return {};
  const m: StatMods = {};
  const add = (k: keyof StatMods, v: number) => (m[k] = (m[k] ?? 0) + v * 0.5);
  for (const id in owner.loadout.modules) {
    const lvl = owner.loadout.modules[id as ModuleId] ?? 0;
    const pl = MODULES[id as ModuleId]?.perLevel;
    if (!pl || lvl <= 0) continue;
    if ((pl.hullMul ?? 0) > 0) add('hullMax', pl.hullMul! * lvl);
    if ((pl.speedMul ?? 0) > 0) add('maxSpeed', pl.speedMul! * lvl);
    if ((pl.turnMul ?? 0) > 0) add('turnRate', pl.turnMul! * lvl);
    if ((pl.sailHpMul ?? 0) > 0) add('sailHpMax', pl.sailHpMul! * lvl);
    if ((pl.boardingMul ?? 0) > 0) add('boardingPower', pl.boardingMul! * lvl);
  }
  return m;
}

// ------------------------------------------------------------------ Exotic Goods

export function noteExoticPurchase(p: Profile, port: Port, good: GoodId, qty: number): void {
  if (REGIONS[port.region].safety !== 'lawless') return;
  p.exotic[good] = (p.exotic[good] ?? 0) + qty;
}

/** Extra silver for a sale: lawless goods sold in safe ports +10%; relics and ore of the deep +15%. */
export function exoticBonus(ship: ShipEntity, p: Profile, port: Port, good: GoodId, n: number, price: number): number {
  const had = Math.min(n, p.exotic[good] ?? 0);
  if (had > 0) p.exotic[good] = (p.exotic[good] ?? 0) - had;
  if (!p.exotic[good]) delete p.exotic[good];
  if (!ship.hasFlag('exotic_goods') || n <= 0) return 0;
  const per = price / n;
  let bonus = 0;
  if (REGIONS[port.region].safety === 'safe') bonus += per * had * 0.1;
  if (good === 'cursed_relics' || good === 'abyssal_ore') bonus += price * 0.15;
  return Math.floor(bonus);
}

// ------------------------------------------------------------------ Night Raider

/** At night or in fog, against a ship that has not traded shot with you for 10 s. */
export function nightRaider(game: Game, ship: ShipEntity, target: ShipEntity | null, hiding: boolean): number {
  if (!target || !hiding || !ship.hasFlag('night_raider')) return 1;
  const now = game.now;
  if ((ship.attackers.get(target.id) ?? -999) > now - 10 || (target.attackers.get(ship.id) ?? -999) > now - 10) return 1;
  ship.addEffect({ id: 'night_raider', until: now + 5, mods: { maxSpeed: 0.1 } }, now);
  return 1.25;
}

// ------------------------------------------------------------------ Grand Battery

/** You and two allies hit her within two seconds: +10% and her nerve cracks. */
export function grandBattery(game: Game, shooter: ShipEntity, target: ShipEntity): boolean {
  const flagship = shooter.hasFlag('grand_battery') ? shooter : shooter.ownerId !== null ? game.ships.get(shooter.ownerId) : undefined;
  if (!flagship || !flagship.hasFlag('grand_battery')) return false;
  const now = game.now;
  const group = new Set<number>([shooter.id]);
  for (const h of target.recentHits) {
    if (now - h.t > 2) continue;
    const o = game.ships.get(h.shooter);
    if (!o) continue;
    if (o.id === flagship.id || o.ownerId === flagship.id || game.areAllies(o, flagship)) group.add(o.id);
  }
  return group.size >= 3 && group.has(flagship.id);
}

// ------------------------------------------------------------------ Salvage King

export interface SunkHull {
  classId: ShipClassId;
  name: string;
  x: number;
  y: number;
  t: number;
}

export function salvageTarget(game: Game, s: PlayerSession): SunkHull | null {
  const ship = s.ship!;
  if (!ship.hasFlag('salvage_king')) return null;
  const day = Math.floor(game.now / 7200);
  if (s.profile!.salvageDay === day) return null;
  for (const h of game.sunkHulls) if (game.now - h.t < 600 && dist(h.x, h.y, ship.state.x, ship.state.y) < 200) return h;
  return null;
}

/** Raise her whole and put a tow line on her. */
export function raiseHull(game: Game, s: PlayerSession, h: SunkHull): void {
  const ship = s.ship!;
  s.profile!.salvageDay = Math.floor(game.now / 7200);
  game.sunkHulls = game.sunkHulls.filter((x) => x !== h);
  const raised = game.spawnNpcShip('merchant', h.classId, 'free', h.x, h.y, ship.state.heading, { ship: `Raised ${h.name}`, captain: 'Tow Line' });
  raised.hull = raised.stats.hullMax * 0.1;
  raised.crew = 2;
  raised.cargo = {};
  raised.purse = 0;
  raised.prize = true;
  raised.towed = true;
  raised.ownerId = ship.id;
  const brain = game.npcs.get(raised.id);
  if (brain) {
    brain.active = true;
    brain.path = null;
  }
  game.grid.upsert(raised.id, raised.state.x, raised.state.y);
  game.toastShip(ship, `Casks and cables: the ${h.name} breaks the surface. Tow her to any yard.`, 'good');
}

// ------------------------------------------------------------------ per second

export function stepBridges(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  const now = game.now;
  // Iron Will.
  if (ship.hasFlag('iron_will')) {
    const mods: StatMods = {};
    if (ship.morale > 60) mods.incomingDamageMul = -0.08;
    if (ship.hull > ship.stats.hullMax * 0.6) mods.moraleLoss = -0.25;
    if (Object.keys(mods).length) ship.addEffect({ id: 'iron_will', until: now + 1.6, mods }, now);
  }
  // Salvage King: a hull on the tow line slows you.
  let towing = false;
  for (const o of game.ships.values()) if (o.towed && o.ownerId === ship.id && o.alive) towing = true;
  if (towing) ship.addEffect({ id: 'towing', until: now + 1.6, mods: { maxSpeed: -0.4 } }, now);
}
