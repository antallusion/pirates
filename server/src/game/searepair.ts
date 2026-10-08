// Repairs at sea (docs/16 #15): her carpenters mend a few hundredths of the hull and the sails a minute from the planks
// and the sailcloth in her hold, out of the fight; the yard in port does it all at once for silver. This reckons what
// the carpenters would need, for the screens that set the two side by side.

import { HULL_PER_PLANK, SAILS_PER_CLOTH, SEA_HULL_PER_MIN, SEA_SAILS_PER_MIN, STORES_SILVER_SHARE } from '../../../shared/src/data/dealings.ts';
import type { SeaRepairView } from '../../../shared/src/protocol.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { trade } from './ports.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
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

// ------------------------------------------------------------------ the order (owner, 2026-10-07)
// «нажимая на ремонт ничего не происходит вообще абсолютно, появляется только "хватит чинить" и всё»: the button
// turned to «Хватит чинить» and the hull gained a point a second (six hundredths a minute), with no word when the hold
// had no planks. Now a third of the hull in half a minute; pressed with nothing to mend it with, she is told in plain
// words what is wanted and the button does not change; under fire the carpenters wait and go back to it by themselves;
// leaving port hurt, her quartermaster takes on what they need.

/** Hurt where the carpenters can mend her (the hull, the sails, the rudder). */
export function hurt(ship: ShipEntity): { hull: boolean; sails: boolean; rudder: boolean } {
  const st = ship.stats;
  return { hull: ship.hull < st.hullMax - 0.5, sails: ship.sails < st.sailHpMax - 0.5, rudder: ship.rudderHp < 1 };
}

/** What the carpenters lack for the harm she has, in plain words; null when they have what they need. */
export function repairLack(ship: ShipEntity, cove = false): string | null {
  if (cove || ship.hasFlag('old_salt')) return null; // the cove's timber, the old salt's makeshifts
  const h = hurt(ship);
  const planks = (ship.cargo.planks ?? 0) >= 0.2, cloth = (ship.cargo.sailcloth ?? 0) >= 0.2;
  const noPlanks = (h.hull || h.rudder) && !planks, noCloth = h.sails && !cloth;
  // One of the two to mend with is enough to set them to work on that part.
  if (noPlanks && noCloth) return NO_STORES;
  if (noPlanks && !h.sails) return NO_PLANKS;
  if (noCloth && !h.hull && !h.rudder) return NO_CLOTH;
  return null;
}

export const NO_PLANKS = 'No planks aboard: the carpenters mend the hull with planks, one plank for 40 points of it. Buy planks in port, or have the yard mend her.';
export const NO_CLOTH = 'No sailcloth aboard: the carpenters mend the sails with sailcloth, one bolt for 20 points of them. Buy sailcloth in port, or have the yard mend her.';
export const NO_STORES = 'No planks or sailcloth aboard: the carpenters mend her with them. Buy them in port, or have the yard mend her.';
export const SOUND = 'She is already sound.';

/** «Чинить» / «Хватит чинить». At sea: to work, unless there is nothing to mend or nothing to mend it with (said in
 *  plain words, and the button stays as it was). In port: the yard mends her whole for silver. */
export function repairOrder(game: Game, s: PlayerSession, on: boolean, cove = false): void {
  const ship = s.ship!;
  if (!on) {
    ship.repairing = false;
    return;
  }
  const h = hurt(ship);
  if (!h.hull && !h.sails && !h.rudder) {
    ship.repairing = false;
    game.sendTo(s, { t: 'toast', msg: SOUND, kind: 'info' });
    return;
  }
  const lack = repairLack(ship, cove);
  if (lack) {
    ship.repairing = false;
    game.sendTo(s, { t: 'toast', msg: lack, kind: 'info' });
    return;
  }
  ship.repairing = true;
}

/** Leaving port hurt: the quartermaster takes on the planks and the sailcloth her carpenters need to mend her at sea, as
 *  far as the market, the hold and a quarter of her silver go. What was bought, or null. */
export function takeOnStores(game: Game, s: PlayerSession, port: Port): { planks: number; cloth: number; silver: number } | null {
  const ship = s.ship!;
  const p = s.profile!;
  const st = ship.stats;
  const use = Math.max(0.3, 1 + tx(st, 'materialUse'));
  const wantP = Math.max(0, Math.ceil(((st.hullMax - ship.hull) / HULL_PER_PLANK) * use + (ship.rudderHp < 1 ? 1 : 0) - (ship.cargo.planks ?? 0)));
  const wantC = Math.max(0, Math.ceil(((st.sailHpMax - ship.sails) / SAILS_PER_CLOTH) * use - (ship.cargo.sailcloth ?? 0)));
  if (!wantP && !wantC) return null;
  const gold0 = p.gold;
  const budget = Math.floor(p.gold * STORES_SILVER_SHARE);
  const got = { planks: 0, cloth: 0 };
  for (const [good, want, key] of [['planks', wantP, 'planks'], ['sailcloth', wantC, 'cloth']] as const) {
    // The most of it the stock, the hold and what is left of the quarter allow (halving down on a refusal): the silver
    // past the quarter is held back from the purse while it buys.
    for (let n = want; n > 0; n = Math.floor(n / 2)) {
      const held = Math.max(0, p.gold - Math.max(0, budget - (gold0 - p.gold)));
      p.gold -= held;
      const why = trade(game, s, port, good, n);
      p.gold += held;
      if (why === null) {
        got[key] += n;
        break;
      }
    }
  }
  if (!got.planks && !got.cloth) return null;
  return { ...got, silver: gold0 - p.gold };
}
