// The fleet of eighty (owner, 2026-10-03; docs/02 §1.A.9): the sailable hulls by their four lists, the silver hull that
// stands in for a premium one wherever the sea itself would sail her, and the painted art that stands in for the new
// hulls, their decks and the premium hulls' creatures while tools/art paints their own.
//
// The art's stand-ins work as the yard's icons' do (shared/src/data/armsart.ts, client/src/assets.ts): the client asks
// for `ship.<hull>`, `bg.deck_<hull>` or `unit.<kind>` as ever, and only while that is not in the manifest does it draw
// the stand-in named here. A hull, deck or figure once painted shows itself, with no change to the code.

import { SHIP_BEAST_DEFS, SHIP_BEAST_IDS } from './shipbeasts.ts';
import { FLEET_LISTS, SHIP_CLASSES, SHIP_CLASS_IDS } from './ships.ts';
import type { FleetClassId, FleetList, ShipClassId } from './ships.ts';

/** Every hull a captain sails, by list: twenty a list, the fourteen old hulls among them, and the eight that make the
 *  lines whole (2026-10-04). */
export const FLEET: Record<FleetList, ShipClassId[]> = Object.fromEntries(FLEET_LISTS.map((l) => [l, SHIP_CLASS_IDS.filter((c) => SHIP_CLASSES[c].list === l)])) as Record<FleetList, ShipClassId[]>;

/** The eighty, and the eight. */
export const FLEET_HULLS: ShipClassId[] = FLEET_LISTS.flatMap((l) => FLEET[l]);

/** The fourteen hulls that sailed before the fleet of eighty: always painted, they stand in for the new. */
export const OLD_HULLS: ShipClassId[] = ['sloop', 'cutter', 'schooner', 'brigantine', 'fluyt', 'brig', 'frigate', 'galleon', 'man_o_war', 'xebec', 'bomb_ketch', 'fireship', 'fishing_ketch', 'harpoon_whaler'];

/** The silver hull the sea sails in place of a premium one (her list, her tier or the nearest below it): no captain of
 *  the sea ever sails a hull sold for doubloons, so none is ever a prize (docs/01 P7). Any other hull is itself. */
export function silverKin(c: ShipClassId): ShipClassId {
  const cls = SHIP_CLASSES[c];
  if (!cls?.premium || !cls.list) return c;
  const pool = FLEET[cls.list].filter((x) => !SHIP_CLASSES[x].premium && SHIP_CLASSES[x].purchasable);
  const gap = (x: ShipClassId) => {
    const d = SHIP_CLASSES[x].tier - cls.tier;
    return d <= 0 ? -d * 2 : d * 2 + 1; // the same tier, then one below, one above, two below…
  };
  return pool.sort((a, b) => gap(a) - gap(b))[0] ?? 'brig';
}

/** Each new hull's stand-in among the old fourteen: of her own list, and no more than a tier off where her list has
 *  one that near (a fast fourth-tier hull draws as the brigantine; every hauler as the galleon, the only one). */
export const HULL_STAND_IN: Record<FleetClassId, ShipClassId> = {
  gunboat: 'fireship', war_galley: 'brig', corvette: 'frigate', razee: 'man_o_war', ship_of_the_line: 'man_o_war', black_corsair: 'frigate',
  dragon_junk: 'bomb_ketch', iron_ram: 'frigate', thunderer: 'frigate', wyvern_galleass: 'man_o_war', kraken_hunter: 'man_o_war', crimson_tide: 'man_o_war',
  phantom_brig: 'brig', storm_reaver: 'brig', sun_galleon: 'man_o_war',
  tartane: 'fishing_ketch', hoy: 'fluyt', pinnace: 'fishing_ketch', snow: 'fluyt', barque: 'fluyt', carrack: 'fluyt', east_indiaman: 'harpoon_whaler',
  golden_carrack: 'harpoon_whaler', spice_dhow: 'fishing_ketch', silk_junk: 'fluyt', smugglers_lugger: 'fishing_ketch', pearl_schooner: 'fishing_ketch',
  floating_bazaar: 'harpoon_whaler', rum_runner: 'fishing_ketch', ledger_galleon: 'harpoon_whaler', tea_clipper: 'fluyt', treasure_fluyt: 'fluyt',
  felucca: 'sloop', lugger: 'cutter', galiot: 'xebec', topsail_schooner: 'schooner', baltimore_clipper: 'schooner', sea_hawk: 'schooner',
  wind_dancer: 'sloop', shark_cutter: 'cutter', ghost_clipper: 'brigantine', flying_fish: 'sloop', albatross_xebec: 'xebec', silver_arrow: 'schooner',
  storm_petrel: 'brigantine', mermaid_grace: 'schooner', viper: 'xebec',
  cog: 'galleon', buss: 'galleon', pink: 'galleon', holk: 'galleon', collier: 'galleon', storeship: 'galleon', cargo_frigate: 'galleon',
  plate_galleon: 'galleon', great_galleon: 'galleon', leviathan_ark: 'galleon', turtle_barge: 'galleon', floating_fortress: 'galleon', menagerie: 'galleon',
  whale_mother: 'galleon', coral_hulk: 'galleon', drowned_cathedral: 'galleon', treasure_junk: 'galleon', pirate_haven: 'galleon', iron_whale: 'galleon',
  // The eight that make the lines whole (2026-10-04): the polacre and the great xebec as the xebec, the frigate-built
  // runners as the brigantine, the great traders as the whaler (the traders' highest old hull), the armed fluyt as the
  // galleon, the sloop-of-war as the brig.
  sloop_of_war: 'brig', great_indiaman: 'harpoon_whaler', manila_galleon: 'harpoon_whaler', polacre: 'xebec', dunkirk_frigate: 'brigantine',
  great_xebec: 'xebec', race_galleon: 'brigantine', armed_fluyt: 'galleon',
};

/** The art id of a hull's painting as it is named (`ship.<x>`): her deck is `bg.deck_<x>` (the Hulk sails as `holk`
 *  and is painted as `hulk`). */
const artName = (c: ShipClassId): string => SHIP_CLASSES[c]?.sprite.replace(/^ship\./, '') ?? c;

/** The painted deck a hull's men fight on in a boarding (its stand-in, if any, is in FLEET_STAND_IN). */
export function deckArt(c: string): string {
  return `bg.deck_${artName(c as ShipClassId)}`;
}

/** The four poses of a figure (tools/art/creatures.py). */
const FRAMES = ['', '_b', '_atk', '_hit'];

/** Art id → its painted stand-in, while the art itself is not painted: every new hull's sprite and deck, every
 *  premium hull's creature in its four poses. */
export const FLEET_STAND_IN: Record<string, string> = {
  ...Object.fromEntries((Object.entries(HULL_STAND_IN) as [FleetClassId, ShipClassId][]).flatMap(([c, s]) => [
    [`ship.${artName(c)}`, `ship.${s}`],
    [`bg.deck_${artName(c)}`, `bg.deck_${s}`],
  ])),
  ...Object.fromEntries(SHIP_BEAST_IDS.flatMap((u) => FRAMES.map((f) => [`unit.${u}${f}`, `${SHIP_BEAST_DEFS[u].stand}${f}`]))),
};
