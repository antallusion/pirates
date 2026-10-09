// «≈ 13 залпов» (docs/25 item 12): how many of her broadsides sink the ship in the target card — by her guns, her ⚓ and
// the ladder, and the mark's hull, armour and «less damage» as her ShipInfo tells them. An estimate for the captain's
// choice (sink her or board her), held to the measured broadsides by tests/balance/sea.test.ts.

import { AMMO, GUNS } from '../data/ships.ts';
import type { ShipClassId } from '../data/ships.ts';
import { combatLevelOf, ladder, onLadder, shipLevelOf } from '../data/shiplevel.ts';
import { ALPHA_OVER, IRON_RAIN_PIERCE, alphaShare, seaHullPace } from '../data/seabalance.ts';
import type { ShipLoadout, ShipStats } from './shipstats.ts';

/** A ball's fall-off over the close fight's distance (combat.ts resolveHit: 1 − 0.3 × flown / reach), and the share of
 *  a laid broadside's balls that strike her there. */
export const EST_FALLOFF = 0.91;
export const EST_HITS = 0.95;

export interface VolleyMark {
  classId: ShipClassId;
  shipLevel: number;
  isPlayer: boolean;
  hullMax: number;
  armor: number;
  inc: number;
  /** Her hull left, as a share. */
  hullFrac: number;
}

/** Her broadsides to sink the mark from where she stands (round shot, her heavier side), or null off the table. */
export function volleysToSink(st: ShipStats, loadout: ShipLoadout, me: { isPlayer: boolean; ironRain: boolean }, t: VolleyMark): number | null {
  if (!onLadder(t.classId) || !onLadder(loadout.classId) || t.hullMax <= 0) return null;
  const mine = combatLevelOf(loadout.classId, shipLevelOf(loadout)), theirs = combatLevelOf(t.classId, t.shipLevel);
  const pace = mine === theirs ? seaHullPace(theirs) : Math.sqrt(seaHullPace(theirs) * seaHullPace(mine));
  const lad = ladder(mine, theirs, me.isPlayer && t.isPlayer, false, true).dealt;
  let best = 0;
  for (const side of ['port', 'starboard'] as const) {
    const gun = GUNS[loadout.guns[side]];
    const armor = Math.min(0.85, t.armor * (1 - (gun.pierce ?? 0)) * (1 - (me.ironRain ? IRON_RAIN_PIERCE : 0)));
    const ball = gun.damage * st.gunDamageMul * pace * AMMO.round.hullMul * EST_FALLOFF * (1 - armor) * t.inc * lad;
    best = Math.max(best, st.gunsPerSide * ball * EST_HITS);
  }
  if (best <= 0) return null;
  const cap = t.hullMax * alphaShare(theirs);
  const volley = best > cap ? cap + (best - cap) * ALPHA_OVER : best;
  return Math.max(1, Math.ceil((Math.max(0, Math.min(1, t.hullFrac)) * t.hullMax) / volley));
}
