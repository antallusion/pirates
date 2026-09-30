// Repairs at sea (docs/16 #15): her carpenters mend a few hundredths of the hull and the sails a minute from the planks
// and the sailcloth in her hold, out of the fight; the yard in port does it all at once for silver. This reckons what
// the carpenters would need, for the screens that set the two side by side.

import { HULL_PER_PLANK, SAILS_PER_CLOTH, SEA_HULL_PER_MIN, SEA_SAILS_PER_MIN } from '../../../shared/src/data/dealings.ts';
import type { SeaRepairView } from '../../../shared/src/protocol.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import type { ShipEntity } from './ship.ts';

/** The share of the carpenters' pace her hands allow: full with twice the least crew aboard. */
export function seaCrewShare(ship: ShipEntity): number {
  return Math.min(1, ship.crew / Math.max(1, ship.stats.crewMin * 2));
}

export function seaRepairView(ship: ShipEntity): SeaRepairView {
  const st = ship.stats;
  const k = st.repairRate * seaCrewShare(ship);
  const hullPerMin = SEA_HULL_PER_MIN * k, sailsPerMin = SEA_SAILS_PER_MIN * k;
  const hullLeft = Math.max(0, st.hullMax - ship.hull), sailsLeft = Math.max(0, st.sailHpMax - ship.sails);
  const use = Math.max(0.3, 1 + tx(st, 'materialUse'));
  const minutes = Math.max(hullPerMin > 0 ? hullLeft / (st.hullMax * hullPerMin) : 0, sailsPerMin > 0 ? sailsLeft / (st.sailHpMax * sailsPerMin) : 0);
  return {
    hullPerMin: Math.round(hullPerMin * 1000) / 10,
    sailsPerMin: Math.round(sailsPerMin * 1000) / 10,
    minutes: Math.ceil(minutes),
    planks: Math.ceil((hullLeft / HULL_PER_PLANK) * use),
    cloth: Math.ceil((sailsLeft / SAILS_PER_CLOTH) * use),
    havePlanks: Math.floor(ship.cargo.planks ?? 0),
    haveCloth: Math.floor(ship.cargo.sailcloth ?? 0),
  };
}
