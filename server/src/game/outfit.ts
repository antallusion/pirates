// A captain outfitted for her level at one stroke (the admin's /kit build, and the mentors' climb — owner, 2026-11-19:
// «каждые 10 уровней новый корабль, новая команда… также должны быть экипированы их командиры»): the hull of her ⚓
// from a ladder of classes, refitted to that ⚓, the heaviest long gun her tier carries, the reference kit of her ⚓ on
// the captain and on the ship (what she wore goes to her locker), her full crew aboard and the company's pools in step.

import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { CAPTAIN_SLOTS, ITEM_BASES } from '../../../shared/src/data/items.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import { referenceKit } from '../../../shared/src/data/seabalance.ts';
import { clampLevel } from '../../../shared/src/data/shiplevel.ts';
import { reconcile } from './crew.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

/** The warship of each ⚓ (index = ⚓, 0 unused): the admin's ladder. */
export const WAR_LADDER: readonly ShipClassId[] = ['sloop', 'sloop', 'sloop', 'schooner', 'brigantine', 'brig', 'brig', 'frigate', 'frigate', 'man_o_war', 'man_o_war'];

export interface Outfitted {
  cls: ShipClassId;
  anchor: number;
  gun: string;
}

/** Her ship, guns, gear and crew made those of ⚓`anchor` (1–10) from `ladder`. Talents are not touched. */
export function outfitCaptain(game: Game, s: PlayerSession, anchor: number, ladder: readonly ShipClassId[] = WAR_LADDER): Outfitted {
  const p = s.profile!, ship = s.ship!;
  const a = Math.max(1, Math.min(10, Math.round(anchor)));
  const cls = ladder[a] ?? WAR_LADDER[a];
  ship.loadout.classId = cls;
  ship.loadout.level = clampLevel(cls, a);
  ship.loadout.modules ??= {};
  const tier = SHIP_CLASSES[cls].tier;
  const gun = tier >= 4 ? 'demi_cannon_32' : tier >= 3 ? 'heavy_18' : tier >= 2 ? 'medium_12' : 'light_6';
  ship.loadout.guns = { port: gun, starboard: gun } as typeof ship.loadout.guns;
  const shipGear: Record<string, Item> = {};
  const captainGear: Record<string, Item> = {};
  for (const it of referenceKit(a)) {
    const sl = ITEM_BASES[it.base].slot;
    (CAPTAIN_SLOTS as readonly string[]).includes(sl) ? (captainGear[sl] = { ...it, uid: p.itemSeq++ }) : (shipGear[sl] = { ...it, uid: p.itemSeq++ });
  }
  // What she wore goes to her locker, not overboard.
  for (const it of [...Object.values(p.captainGear ?? {}), ...Object.entries(ship.loadout.gear ?? {}).filter(([sl]) => sl !== 'tackle').map(([, it]) => it)]) if (it) p.stash.push(it as Item);
  ship.loadout.gear = { ...(ship.loadout.gear?.tackle ? { tackle: ship.loadout.gear.tackle } : {}), ...shipGear };
  p.captainGear = captainGear as never;
  p.loadout = ship.loadout;
  ship.worn = Object.values(captainGear);
  ship.gunsDisabled = { port: 0, starboard: 0 };
  ship.recompute(game.now);
  ship.hull = ship.stats.hullMax;
  ship.sails = ship.stats.sailHpMax;
  ship.rudderHp = 1;
  ship.crew = ship.stats.crewMax;
  if (p.company) reconcile(game, p.company, ship.crew);
  return { cls, anchor: a, gun };
}
