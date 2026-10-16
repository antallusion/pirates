// The sea's own traffic in more hulls (owner, 2026-10-16: «чуть больше разных кораблей … надо добавить»). The local
// ships about a captain (server/src/game/traffic.ts) sailed a handful of hulls a role (shiplevel.ts ROLE_HULLS: the
// merchants a sloop, a schooner, a fluyt or a galleon, the fishers a cutter). Now half of them are of the fleet's other
// hulls (shared/src/data/ships.ts — painted, sold in the yards, never the doubloons' own), by the role, the level and
// the waters: coasters and cogs off the home ports, carracks and plate galleons on the old trade of the Drowned Crown,
// the Confederacy's galleys and xebecs in the Ashen Isles, the smugglers' luggers in the fog, sloops of war and
// corvettes on the Crown's stations, the Order's whalers on the ice. Only the hull changes: her level, her guns'
// weight (setNpcLevel's seaScale: a common ship of the sea as a captain in half gear of her ⚓ whatever her hull), her
// purse, her cargo and her brain are the role's as before — the balance stands.

import { SHIP_CLASSES } from './ships.ts';
import type { ShipClassId } from './ships.ts';
import { hullsFor, levelRange } from './shiplevel.ts';
import type { RegionId } from '../world/regions.ts';

export type TrafficRole = 'merchant' | 'fisher' | 'patrol' | 'pirate' | 'hunter';

/** The fleet's other hulls each role may sail, wherever. */
const MORE: Record<TrafficRole, ShipClassId[]> = {
  merchant: ['tartane', 'hoy', 'cog', 'pinnace', 'snow', 'barque', 'pink', 'collier', 'storeship', 'cargo_frigate', 'armed_fluyt', 'carrack', 'east_indiaman', 'plate_galleon', 'great_galleon', 'great_indiaman'],
  fisher: ['buss', 'hoy', 'fishing_ketch'],
  patrol: ['gunboat', 'sloop_of_war', 'corvette', 'razee', 'ship_of_the_line'],
  pirate: ['felucca', 'lugger', 'topsail_schooner', 'galiot', 'baltimore_clipper', 'corvette', 'polacre', 'dunkirk_frigate', 'great_xebec'],
  hunter: ['harpoon_whaler', 'corvette', 'razee'],
};

/** The waters' own: twice as likely there (and some only there). */
const LOCAL: Partial<Record<RegionId, Partial<Record<TrafficRole, ShipClassId[]>>>> = {
  black_coast: { merchant: ['tartane', 'hoy', 'cog', 'pinnace'], fisher: ['buss', 'hoy'], patrol: ['gunboat', 'sloop_of_war'] },
  gravewater: { merchant: ['snow', 'barque', 'armed_fluyt', 'cargo_frigate', 'east_indiaman'], pirate: ['topsail_schooner', 'baltimore_clipper', 'dunkirk_frigate'], patrol: ['corvette'] },
  whispering: { merchant: ['pink', 'snow'], pirate: ['lugger', 'felucca', 'topsail_schooner'], fisher: ['fishing_ketch'] },
  ashen_isles: { merchant: ['collier', 'storeship'], pirate: ['galiot', 'war_galley', 'xebec', 'great_xebec'] },
  leviathan_reach: { hunter: ['harpoon_whaler', 'razee'], fisher: ['fishing_ketch'], merchant: ['storeship'], patrol: ['razee'] },
  dead_mans_expanse: { pirate: ['polacre', 'dunkirk_frigate', 'baltimore_clipper'], merchant: ['great_indiaman'] },
  drowned_crown: { merchant: ['carrack', 'plate_galleon', 'manila_galleon'], pirate: ['great_xebec', 'polacre'] },
  the_abyss: { pirate: ['great_xebec', 'race_galleon'], merchant: ['manila_galleon', 'great_galleon'] },
};

/** A hull that sails at this level (her ⚓ is never held off the square's by her hull's range), not the doubloons'. */
function fits(c: ShipClassId, level: number): boolean {
  const def = SHIP_CLASSES[c];
  if (!def || def.premium) return false;
  const [lo, hi] = levelRange(c);
  return level >= lo && level <= hi;
}

/** The hulls a local ship of the role may put out in, at this level, in these waters, with their weights: the role's
 *  usual hulls as before (hullsFor) at half the draw, the fleet's others and the waters' own the other half. */
export function trafficHulls(role: TrafficRole, level: number, region: RegionId): [ShipClassId, number][] {
  const base: ShipClassId[] = role === 'fisher' ? ['cutter'] : role === 'hunter' && level <= 5 ? ['harpoon_whaler'] : hullsFor(role, level);
  const out = new Map<ShipClassId, number>();
  for (const c of base) out.set(c, (out.get(c) ?? 0) + 1 / base.length);
  const local = LOCAL[region]?.[role] ?? [];
  const more = [...new Set([...MORE[role], ...local])].filter((c) => fits(c, level));
  if (more.length) {
    let tot = 0;
    const w = more.map((c) => {
      const x = local.includes(c) ? 2 : 1;
      tot += x;
      return [c, x] as const;
    });
    for (const [c, x] of w) out.set(c, (out.get(c) ?? 0) + x / tot);
  }
  return [...out.entries()];
}
