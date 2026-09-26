// Damage control: leaks, flooding, pumps and crew stations. Hull points are not the only way to
// lose a ship — a hold full of seawater founders her. Crew orders trade gunnery for pumping and seamanship.

import type { StatMods } from '../../../shared/src/data/stats.ts';
import type { Station } from '../../../shared/src/protocol.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';

export const STATION_MODS: Record<Station, StatMods> = {
  balanced: {},
  gunnery: { reloadMul: -0.15, sailChangeRate: -0.3 },
  sailing: { sailChangeRate: 0.4, maxSpeed: 0.03, turnRate: 0.08, reloadMul: 0.15 },
  damage_control: { reloadMul: 0.3, sailChangeRate: -0.2 },
};

export const STATION_NAMES: Record<Station, string> = {
  balanced: 'Balanced watch', gunnery: 'All hands to the guns', sailing: 'All hands to the braces', damage_control: 'Damage control',
};

export const MAX_LEAKS = 8;

/** Tonnes of seawater she can hold before she founders. */
export function floodCapacity(ship: ShipEntity): number {
  return ship.stats.holdWeight * 0.5 + ship.stats.length * 2;
}

export function setStation(game: Game, ship: ShipEntity, station: Station): void {
  ship.station = station;
  ship.effects = ship.effects.filter((e) => e.id !== 'station');
  if (station !== 'balanced') ship.effects.push({ id: 'station', until: Infinity, mods: STATION_MODS[station] });
  ship.recompute(game.now);
}

/** Chance that a solid hull hit opens a leak below the waterline. */
export function leakChance(ship: ShipEntity, heavy: boolean): number {
  let p = 0.08;
  if (ship.hull < ship.stats.hullMax * 0.5) p += 0.1;
  if (heavy) p *= 1.5;
  return p;
}

/** Per-second flooding, pumping and plugging. Returns true if the ship foundered. */
export function stepFlooding(game: Game, ship: ShipEntity): boolean {
  const cap = floodCapacity(ship);
  const tierF = 0.6 + ship.cls.tier * 0.2;
  const dc = ship.station === 'damage_control';
  ship.water += ship.leaks * 0.3 * tierF;
  if (ship.water > 0) {
    const pumpers = Math.min(1, ship.crew / Math.max(1, ship.stats.crewMax));
    const pump = pumpers * 1.1 * tierF * (dc ? 2 : ship.station === 'gunnery' ? 0.5 : 1);
    ship.water = Math.max(0, ship.water - pump);
  }
  // Carpenters plug leaks with planks — damage control does it fast, even under fire.
  if (ship.leaks > 0 && (ship.cargo.planks ?? 0) >= 0.5 && game.now - ship.lastPlug >= (dc ? 6 : 20)) {
    ship.leaks--;
    ship.lastPlug = game.now;
    ship.cargo.planks = Math.round(((ship.cargo.planks ?? 0) - 0.5) * 100) / 100;
    if ((ship.cargo.planks ?? 0) <= 0.01) delete ship.cargo.planks;
  }
  // Fire parties.
  if (dc) {
    const fire = ship.effects.find((e) => e.id === 'fire');
    if (fire) fire.until -= 1;
  }
  if (ship.water > cap * 0.5) ship.morale = Math.max(0, ship.morale - 0.5);
  if (ship.water >= cap) {
    game.toastShip(ship, 'She is full of water — she founders!', 'bad');
    ship.hull = 0;
    game.beginSinking(ship);
    return true;
  }
  return false;
}

/** Speed multiplier from water in the hold (heavy, sluggish, listing). */
export function floodSpeedFactor(ship: ShipEntity): number {
  return 1 - 0.4 * Math.min(1, ship.water / floodCapacity(ship));
}
