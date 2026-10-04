// Ship classes, artillery, ammunition and shipyard modules.
// Speeds are in game meters/second (the world is compressed ~6x relative to real nautical scale
// so a fast ship crosses the 96 km ocean in roughly 100 minutes).

import type { UnitId } from './army.ts';
import { BOSS_MONSTERS } from './bossmonsters.ts';
import type { BossClassId } from './bossmonsters.ts';
import type { Flag, StatMods } from './stats.ts';

export type ShipClassId =
  | 'sloop' | 'cutter' | 'schooner' | 'brigantine' | 'fluyt' | 'brig' | 'frigate' | 'galleon' | 'man_o_war' | 'ghost_ship'
  | 'xebec' | 'bomb_ketch' | 'fireship' | 'fishing_ketch' | 'harpoon_whaler'
  // The fleet of eighty (owner, 2026-10-03; docs/02 §1.A.9): the sixty-six hulls beside the fourteen above, by list.
  | FleetClassId
  // The beasts of the sea (docs/12 P4): monsters with a level like a ship's.
  | 'orca' | 'white_orca' | 'humpback' | 'sperm_whale' | 'narwhal' | 'shark' | 'young_serpent'
  // World bosses and their parts (docs/02 §11.A.4): never sold, never sailed by a captain.
  | 'leviathan' | 'kraken' | 'kraken_tentacle' | 'drowned_whale' | 'whale_heart' | 'lantern_maw' | 'black_serpent'
  | 'mother_of_wrecks' | 'wreck_core' | 'storm_widow'
  // PvE locations (expeditions.ts): the rotten hulks of a ship graveyard.
  | 'hulk'
  // The Abyss: the Eye at its heart.
  | 'abyss_eye'
  // The six new world bosses at sea and their parts (owner, 2026-10-03; shared/src/data/bossmonsters.ts).
  | BossClassId
  // The zone bosses (owner, 2026-10-04; docs/21): one great warship for each sea, sailed by nobody but the sea.
  | ZoneBossClassId;

/** The eight great ships of the seas (docs/21), one for each region: `zb_<region>`. */
export type ZoneBossClassId =
  | 'zb_black_coast' | 'zb_gravewater' | 'zb_whispering' | 'zb_ashen_isles'
  | 'zb_leviathan_reach' | 'zb_dead_mans_expanse' | 'zb_drowned_crown' | 'zb_the_abyss';

/** Is this hull one of the zone bosses (docs/21)? Never sold, never boarded, in no list and no tree. */
export function isZoneBossClass(id: string): id is ZoneBossClassId {
  return id.startsWith('zb_');
}

/** The sixty-six new hulls of the fleet of eighty (tools/art/ships.py paints them): the warships, the traders, the
 *  runners and the haulers, the premium ten of each list among them — and the eight silver hulls that make the lines
 *  whole (2026-10-04, tools/art/fleet_next.py), and the third batch's eight premium hulls (2026-10-04,
 *  tools/art/fleet_b3.py). The Hulk sails as `holk`: `hulk` is the rotten wreck of the ship graveyards (her art is
 *  `ship.hulk` all the same). */
export type FleetClassId =
  | 'gunboat' | 'war_galley' | 'corvette' | 'razee' | 'ship_of_the_line'
  | 'black_corsair' | 'dragon_junk' | 'iron_ram' | 'thunderer' | 'wyvern_galleass' | 'kraken_hunter' | 'crimson_tide' | 'phantom_brig' | 'storm_reaver' | 'sun_galleon'
  | 'tartane' | 'hoy' | 'pinnace' | 'snow' | 'barque' | 'carrack' | 'east_indiaman'
  | 'golden_carrack' | 'spice_dhow' | 'silk_junk' | 'smugglers_lugger' | 'pearl_schooner' | 'floating_bazaar' | 'rum_runner' | 'ledger_galleon' | 'tea_clipper' | 'treasure_fluyt'
  | 'felucca' | 'lugger' | 'galiot' | 'topsail_schooner' | 'baltimore_clipper'
  | 'sea_hawk' | 'wind_dancer' | 'shark_cutter' | 'ghost_clipper' | 'flying_fish' | 'albatross_xebec' | 'silver_arrow' | 'storm_petrel' | 'mermaid_grace' | 'viper'
  | 'cog' | 'buss' | 'pink' | 'holk' | 'collier' | 'storeship' | 'cargo_frigate' | 'plate_galleon' | 'great_galleon'
  | 'leviathan_ark' | 'turtle_barge' | 'floating_fortress' | 'menagerie' | 'whale_mother' | 'coral_hulk' | 'drowned_cathedral' | 'treasure_junk' | 'pirate_haven' | 'iron_whale'
  // The eight that make the lines whole (owner, 2026-10-04; docs/20): silver hulls where a list had none of its own.
  | 'sloop_of_war' | 'great_indiaman' | 'manila_galleon' | 'polacre' | 'dunkirk_frigate' | 'great_xebec' | 'race_galleon' | 'armed_fluyt'
  // The third batch (owner, 2026-10-04: «еще больше … кораблей»): eight premium hulls where a list's premium choice
  // was thinnest — two a list.
  | 'bulldog' | 'saint_elmo' | 'lantern_sampan' | 'golden_lion' | 'dolphin' | 'sailfish' | 'mimic_barge' | 'icebound_hulk';

export type Rig = 'square' | 'fore_aft' | 'mixed';

/** The fleet's four lists (owner, 2026-10-03: «20 боевых, 20 торговых, 20 быстрых, 20 медленных но с большой
 *  вместимостью»): the warships, built round their guns, their hull and their crew; the traders, a good hold on a
 *  hull that is cheap to run; the runners, all speed and handiness and little else; and the haulers, slow and sturdy
 *  round a very large hold. Twenty in each, the old hulls among them, and ten of each sold for doubloons. */
export type FleetList = 'combat' | 'trade' | 'fast' | 'hauler';
export const FLEET_LISTS: FleetList[] = ['combat', 'trade', 'fast', 'hauler'];

/** A hull's own trait. Its `id` is the mechanic some system reads (several hulls share one: every hull with oars
 *  rows as the xebec does); `mods` and `flags` are lines and switches on her stats as a captain's passive's are. */
export interface ShipPassive {
  id: string;
  name: string;
  description: string;
  mods?: StatMods;
  flags?: Flag[];
}

export interface ShipClassDef {
  id: ShipClassId;
  name: string;
  tier: number;
  rig: Rig;
  role: string;
  length: number;
  beam: number;
  hull: number;
  armor: number; // fraction of hull damage absorbed
  maxSpeed: number;
  accel: number;
  turnRate: number; // deg/s at full steerage
  draft: number; // meters; deep ships cannot cross shoals
  holdVolume: number;
  holdWeight: number;
  crewMin: number; // below this the ship cannot be handled well
  crewMax: number;
  gunPortsPerSide: number;
  bowChasers: number;
  sternChasers: number;
  sailHp: number;
  repairRate: number; // multiplier
  detection: number; // meters
  price: number;
  purchasable: boolean;
  /** Rare hulls are built only by yards of these factions. */
  factions?: string[];
  /** Mount that comes fitted and cannot be changed. */
  fixedMount?: MountId;
  /** A creature of the deep, not a hull: drawn by the monster renderer, moved by the boss stepper. */
  monster?: boolean;
  sprite: string; // asset id in assets/manifest.json
  passive: ShipPassive;
  /** Her list in the fleet of eighty (docs/02 §1.A.9). Absent: no hull a captain buys (the Dutchman's, the deep's). */
  list?: FleetList;
  /** Sold for doubloons in the premium shop (shared/src/data/premium.ts, docs/01 P7): such a hull is never
   *  `purchasable` for silver at a yard (tests/premium.test.ts holds it). */
  premium?: PremiumShip;
}

/** A hull sold for doubloons (owner, 2026-10-03): bought in port, she is delivered to its quay and the ship the
 *  captain sailed in is berthed there, as a hull built to order is (server/src/game/premium.ts). */
export interface PremiumShip {
  /** Doubloons. */
  price: number;
  /** What sets her apart, the line on her card: English, Russian. */
  note: [string, string];
  /** Creatures that come aboard with her (the one way besides the shop a premium kind is had); with no room for
   *  them in her she is not sold. */
  beasts?: { u: UnitId; n: number }[];
}

const ship = (d: ShipClassDef): ShipClassDef => d;

/** The zone bosses' hulls (docs/21 §4): weighed by the squad sim (tests/zonebosses.test.ts) so ten captains of her
 *  level on ships of her level sink her in 15–20 minutes and five in 35–45. */
export const ZB_HULL: Record<ZoneBossClassId, number> = {
  zb_black_coast: 60000, zb_gravewater: 90000, zb_whispering: 90000, zb_leviathan_reach: 110000,
  zb_ashen_isles: 130000, zb_dead_mans_expanse: 150000, zb_drowned_crown: 180000, zb_the_abyss: 210000,
};

/** A zone boss (docs/21): a great warship of her sea at one level, in no fleet list and no tree, never sold. Her hull
 *  is what the squad sim (tests/zonebosses.test.ts) weighed; her guns are drawn as a ship's, but her broadsides are
 *  her own (server/src/game/zonebosses.ts: the damage of each spread over every captain who fires on her). */
function zoneBoss(id: ZoneBossClassId, name: string, tier: number, role: string, hull: number, armor: number, ports: number, passive: string, text: string): ShipClassDef {
  return {
    id, name, tier, rig: 'square', role, length: 74, beam: 24, hull, armor, maxSpeed: 9, accel: 0.6, turnRate: 7, draft: 6.5,
    holdVolume: 400, holdWeight: 500, crewMin: 200, crewMax: 900, gunPortsPerSide: ports, bowChasers: 4, sternChasers: 4,
    sailHp: 900, repairRate: 0, detection: 2600, price: 0, purchasable: false, sprite: `ship.${id}`,
    passive: { id: 'zone_boss', name: passive, description: text },
  };
}

function monster(id: ShipClassId, name: string, role: string, length: number, beam: number, hull: number, armor: number, maxSpeed: number, passive: string): ShipClassDef {
  return {
    id, name, tier: 6, rig: 'mixed', role, length, beam, hull, armor, maxSpeed, accel: 3, turnRate: 20, draft: 0,
    holdVolume: 0, holdWeight: 0, crewMin: 0, crewMax: 400, gunPortsPerSide: 0, bowChasers: 0, sternChasers: 0,
    sailHp: 1, repairRate: 0, detection: 2500, price: 0, purchasable: false, monster: true, sprite: `monster.${id}`,
    passive: { id: 'monster', name: 'Monster', description: passive },
  };
}

export const SHIP_CLASSES: Record<ShipClassId, ShipClassDef> = {
  sloop: ship({
    id: 'sloop', name: 'Sloop', tier: 1, rig: 'fore_aft', role: 'Starter raider. Fast, nimble, fragile.',
    length: 20, beam: 6, hull: 900, armor: 0.05, maxSpeed: 17, accel: 2.6, turnRate: 26, draft: 2.0,
    holdVolume: 30, holdWeight: 32, crewMin: 8, crewMax: 28, gunPortsPerSide: 3, bowChasers: 1, sternChasers: 0,
    sailHp: 100, repairRate: 1.2, detection: 1400, price: 1500, purchasable: true, sprite: 'ship.sloop', list: 'fast',
    passive: { id: 'shallow_runner', name: 'Shallow Runner', description: 'Can cross reefs and shoals that tear the keel out of bigger ships.' },
  }),
  cutter: ship({
    id: 'cutter', name: 'Cutter', tier: 1, rig: 'fore_aft', role: 'Courier and interceptor.',
    length: 18, beam: 5, hull: 720, armor: 0.0, maxSpeed: 18.5, accel: 3.0, turnRate: 30, draft: 1.6,
    holdVolume: 20, holdWeight: 20, crewMin: 6, crewMax: 20, gunPortsPerSide: 2, bowChasers: 1, sternChasers: 0,
    sailHp: 90, repairRate: 1.2, detection: 1500, price: 1800, purchasable: true, sprite: 'ship.cutter', list: 'fast',
    passive: { id: 'dispatch', name: 'Dispatch Runner', description: 'Courier contracts pay 20% more; +10% acceleration.' },
  }),
  schooner: ship({
    id: 'schooner', name: 'Schooner', tier: 2, rig: 'fore_aft', role: 'Best upwind sailer. Smuggler favourite.',
    length: 26, beam: 7, hull: 1300, armor: 0.05, maxSpeed: 17.5, accel: 2.3, turnRate: 22, draft: 2.4,
    holdVolume: 60, holdWeight: 62, crewMin: 12, crewMax: 40, gunPortsPerSide: 4, bowChasers: 1, sternChasers: 1,
    sailHp: 120, repairRate: 1.1, detection: 1500, price: 4800, purchasable: true, sprite: 'ship.schooner', list: 'fast',
    passive: { id: 'weatherly', name: 'Weatherly', description: 'Loses 40% less speed when sailing close-hauled.' },
  }),
  brigantine: ship({
    id: 'brigantine', name: 'Brigantine', tier: 2, rig: 'mixed', role: 'All-round raider.',
    length: 30, beam: 8, hull: 1800, armor: 0.1, maxSpeed: 15.5, accel: 1.9, turnRate: 19, draft: 3.0,
    holdVolume: 80, holdWeight: 90, crewMin: 20, crewMax: 70, gunPortsPerSide: 6, bowChasers: 1, sternChasers: 1,
    sailHp: 140, repairRate: 1.0, detection: 1400, price: 7500, purchasable: true, sprite: 'ship.brigantine', list: 'fast',
    passive: { id: 'raider_rig', name: 'Raider Rig', description: 'Boarding range +10%; changing sail level is 20% faster.' },
  }),
  fluyt: ship({
    id: 'fluyt', name: 'Fluyt', tier: 2, rig: 'square', role: 'Merchant hauler with an enormous hold.',
    length: 32, beam: 10, hull: 1700, armor: 0.05, maxSpeed: 11.5, accel: 1.2, turnRate: 13, draft: 3.4,
    holdVolume: 220, holdWeight: 260, crewMin: 14, crewMax: 50, gunPortsPerSide: 3, bowChasers: 0, sternChasers: 1,
    sailHp: 130, repairRate: 0.9, detection: 1200, price: 6800, purchasable: true, sprite: 'ship.fluyt', list: 'trade',
    passive: { id: 'deep_hold', name: 'Deep Hold', description: 'Cargo is 50% less likely to be destroyed by hull hits.' },
  }),
  brig: ship({
    id: 'brig', name: 'Brig', tier: 3, rig: 'square', role: 'Sturdy warship.',
    length: 32, beam: 9, hull: 2400, armor: 0.15, maxSpeed: 14, accel: 1.6, turnRate: 17, draft: 3.4,
    holdVolume: 90, holdWeight: 110, crewMin: 30, crewMax: 110, gunPortsPerSide: 8, bowChasers: 2, sternChasers: 1,
    sailHp: 160, repairRate: 1.0, detection: 1400, price: 12500, purchasable: true, sprite: 'ship.brig', list: 'combat',
    passive: { id: 'gun_brig', name: 'Gun Brig', description: 'Broadside reload 8% faster when both batteries are loaded.' },
  }),
  frigate: ship({
    id: 'frigate', name: 'Frigate', tier: 3, rig: 'square', role: 'The hunter.',
    length: 42, beam: 11, hull: 3400, armor: 0.2, maxSpeed: 14.5, accel: 1.4, turnRate: 15, draft: 4.2,
    holdVolume: 120, holdWeight: 150, crewMin: 60, crewMax: 220, gunPortsPerSide: 13, bowChasers: 2, sternChasers: 2,
    sailHp: 200, repairRate: 0.9, detection: 1700, price: 24000, purchasable: true, sprite: 'ship.frigate', list: 'combat',
    passive: { id: 'hunter', name: 'Hunter', description: '+15% detection radius; targets you damaged are revealed on the minimap for 30s.' },
  }),
  galleon: ship({
    id: 'galleon', name: 'Galleon', tier: 4, rig: 'square', role: 'Floating fortress and treasure hauler.',
    length: 46, beam: 14, hull: 4800, armor: 0.25, maxSpeed: 10.5, accel: 0.9, turnRate: 10.5, draft: 5.2,
    holdVolume: 320, holdWeight: 400, crewMin: 60, crewMax: 260, gunPortsPerSide: 10, bowChasers: 2, sternChasers: 2,
    sailHp: 220, repairRate: 0.8, detection: 1300, price: 32000, purchasable: true, sprite: 'ship.galleon', list: 'hauler',
    passive: { id: 'castle', name: 'Stern Castle', description: 'Defenders gain +25% boarding power.' },
  }),
  man_o_war: ship({
    id: 'man_o_war', name: 'Man-o-War', tier: 5, rig: 'square', role: 'Ship of the line. Needs a small town of crew.',
    length: 58, beam: 16, hull: 7600, armor: 0.3, maxSpeed: 11.5, accel: 0.8, turnRate: 9, draft: 6.0,
    holdVolume: 130, holdWeight: 160, crewMin: 180, crewMax: 600, gunPortsPerSide: 20, bowChasers: 2, sternChasers: 2,
    sailHp: 300, repairRate: 0.7, detection: 1600, price: 90000, purchasable: true, sprite: 'ship.man_o_war', list: 'combat',
    passive: { id: 'line', name: 'Ship of the Line', description: 'Immune to raking bonus damage from the bow.' },
  }),
  xebec: ship({
    id: 'xebec', name: 'Xebec', tier: 2, rig: 'fore_aft', role: 'Rare. Lateen-rigged corsair with sweeps: flies in light airs, rows through calms.',
    length: 30, beam: 7, hull: 1500, armor: 0.05, maxSpeed: 17, accel: 2.4, turnRate: 21, draft: 2.2,
    holdVolume: 55, holdWeight: 60, crewMin: 20, crewMax: 80, gunPortsPerSide: 5, bowChasers: 2, sternChasers: 1,
    sailHp: 120, repairRate: 1.1, detection: 1500, price: 9500, purchasable: true, sprite: 'ship.xebec', list: 'fast', factions: ['brokers', 'confederacy', 'free'],
    passive: { id: 'sweeps', name: 'Sweeps', description: '+25% speed in winds under half strength; oars give at least 3 m/s on any heading, even head to wind.' },
  }),
  fishing_ketch: ship({
    id: 'fishing_ketch', name: 'Fishing Ketch', tier: 2, rig: 'fore_aft', role: 'A fishing hull: a big wet well and ice in the hold.',
    length: 24, beam: 8, hull: 1400, armor: 0.05, maxSpeed: 14.5, accel: 2.0, turnRate: 20, draft: 2.4,
    holdVolume: 110, holdWeight: 120, crewMin: 10, crewMax: 36, gunPortsPerSide: 3, bowChasers: 0, sternChasers: 1,
    sailHp: 120, repairRate: 1.1, detection: 1450, price: 5600, purchasable: true, sprite: 'ship.fishing_ketch', list: 'trade',
    passive: { id: 'wet_well', name: 'Iced Well', description: 'Nets take twice the catch; fish in the hold spoils three times slower.' },
  }),
  harpoon_whaler: ship({
    id: 'harpoon_whaler', name: 'Harpoon Whaler', tier: 3, rig: 'mixed', role: 'Rare. A whaling hull of the Order: a winch on the bow, a flensing deck, try-works amidships.',
    length: 30, beam: 9, hull: 2000, armor: 0.12, maxSpeed: 14, accel: 1.6, turnRate: 17, draft: 3.0,
    holdVolume: 150, holdWeight: 170, crewMin: 22, crewMax: 70, gunPortsPerSide: 4, bowChasers: 1, sternChasers: 0,
    sailHp: 140, repairRate: 1.0, detection: 1700, price: 14000, purchasable: true, sprite: 'ship.harpoon_whaler', list: 'trade', factions: ['harpoon'], fixedMount: 'harpoon',
    passive: { id: 'flensing_deck', name: 'Flensing Deck', description: 'Flenses a carcass twice as fast; her line stands a third more strain; shy whales hear her a third less.' },
  }),
  bomb_ketch: ship({
    id: 'bomb_ketch', name: 'Bomb Ketch', tier: 3, rig: 'mixed', role: 'Rare. A floating mortar battery for sieges and ambushes.',
    length: 30, beam: 10, hull: 2700, armor: 0.2, maxSpeed: 12, accel: 1.2, turnRate: 13, draft: 3.2,
    holdVolume: 70, holdWeight: 110, crewMin: 30, crewMax: 100, gunPortsPerSide: 4, bowChasers: 0, sternChasers: 1,
    sailHp: 150, repairRate: 0.9, detection: 1400, price: 16000, purchasable: true, sprite: 'ship.bomb_ketch', list: 'combat', factions: ['crown', 'confederacy'], fixedMount: 'mortar',
    passive: { id: 'bomb_vessel', name: 'Bomb Vessel', description: 'Twin mortar wells: the fitted mortar reloads 50% faster and throws two bombs.' },
  }),
  fireship: ship({
    id: 'fireship', name: 'Fireship', tier: 1, rig: 'square', role: 'Rare. A hulk of tar and powder you sail into the enemy line and abandon.',
    length: 24, beam: 8, hull: 800, armor: 0.0, maxSpeed: 13, accel: 1.8, turnRate: 17, draft: 2.6,
    holdVolume: 10, holdWeight: 20, crewMin: 6, crewMax: 20, gunPortsPerSide: 0, bowChasers: 0, sternChasers: 0,
    sailHp: 90, repairRate: 0.8, detection: 1300, price: 900, purchasable: true, sprite: 'ship.fireship', list: 'combat', factions: ['confederacy', 'free'], fixedMount: 'fire_charge',
    passive: { id: 'fireship', name: 'Fire Hulk', description: 'No guns. RMB lights the charges: 8 s later she explodes (700 damage in 90 m, fires). The crew rows away; you are carried to port like a wreck.' },
  }),
  ghost_ship: ship({
    id: 'ghost_ship', name: 'Ghost Ship', tier: 5, rig: 'mixed', role: 'Something the sea gave back.',
    length: 40, beam: 11, hull: 4200, armor: 0.2, maxSpeed: 15, accel: 1.4, turnRate: 16, draft: 4.0,
    holdVolume: 100, holdWeight: 120, crewMin: 40, crewMax: 160, gunPortsPerSide: 11, bowChasers: 1, sternChasers: 1,
    sailHp: 220, repairRate: 1.3, detection: 1500, price: 0, purchasable: false, sprite: 'ship.ghost_ship',
    passive: { id: 'dead_crew', name: 'Dead Crew', description: 'Crew does not lose morale. Sails ignore storms.' },
  }),

  // ------------------------------------------------------------------ the fleet of eighty (owner, 2026-10-03)
  // The sixty-six new hulls, list by list, the yard's first and the premium ten after them (docs/02 §1.A.9). Each list
  // keeps its trade at every tier: a warship more guns, hull and men than a hull of her tier in any other list; a
  // trader a merchant's hold (two and a half times a warship's of her level, as the ladder asks) on a hull cheap to
  // run; a runner the speed and the helm; a hauler the greatest hold of her tier on a slow, stout hull. A premium hull
  // is a good hull of her tier and no giant: what sets her apart is her gift (shared/src/data/shipgifts.ts) and the
  // creatures that come aboard with her (shared/src/data/shipbeasts.ts). Her silver `price` is what she is reckoned at
  // for the salvage fee, the insurance and the yard's repairs; no yard sells her, takes her in trade nor buys her.

  // The warships.
  gunboat: ship({
    id: 'gunboat', name: 'Gunboat', tier: 1, rig: 'fore_aft', role: 'A small broad hull built round one heavy long gun at the bow.',
    length: 18, beam: 6, hull: 1000, armor: 0.08, maxSpeed: 14.5, accel: 2.0, turnRate: 21, draft: 1.8,
    holdVolume: 22, holdWeight: 28, crewMin: 10, crewMax: 32, gunPortsPerSide: 3, bowChasers: 2, sternChasers: 0,
    sailHp: 90, repairRate: 1.1, detection: 1400, price: 1600, purchasable: true, sprite: 'ship.gunboat', list: 'combat',
    passive: { id: 'bow_gun', name: 'Long Gun on a Slide', description: 'Her bow chasers hit 35% harder and train 20° wider.', mods: { chaserDamage: 0.35, chaserArc: 20 } },
  }),
  war_galley: ship({
    id: 'war_galley', name: 'War Galley', tier: 2, rig: 'fore_aft', role: 'Rare. Oars, a bronze ram, light guns between the benches and heavy guns at the bow: deadly in a calm.',
    length: 36, beam: 6, hull: 1700, armor: 0.1, maxSpeed: 15.5, accel: 2.6, turnRate: 20, draft: 1.6,
    holdVolume: 40, holdWeight: 50, crewMin: 50, crewMax: 140, gunPortsPerSide: 6, bowChasers: 3, sternChasers: 0,
    sailHp: 110, repairRate: 1.0, detection: 1400, price: 8000, purchasable: true, sprite: 'ship.war_galley', list: 'combat', factions: ['confederacy', 'free', 'brokers'],
    passive: { id: 'sweeps', name: 'Oars and Ram', description: '+25% speed in winds under half strength; oars give at least 3 m/s on any heading; her bronze ram strikes 30% harder.', mods: { ramDealt: 0.3 } },
  }),
  corvette: ship({
    id: 'corvette', name: 'Corvette', tier: 3, rig: 'square', role: 'A flush-decked warship, quick for her weight of shot.',
    length: 36, beam: 9, hull: 2700, armor: 0.16, maxSpeed: 15.5, accel: 1.7, turnRate: 18, draft: 3.4,
    holdVolume: 90, holdWeight: 110, crewMin: 50, crewMax: 170, gunPortsPerSide: 10, bowChasers: 2, sternChasers: 2,
    sailHp: 180, repairRate: 1.0, detection: 1600, price: 18500, purchasable: true, sprite: 'ship.corvette', list: 'combat',
    passive: { id: 'flush_deck', name: 'Flush Deck', description: 'One clear gun deck: her broadsides reload 6% faster.', mods: { reloadMul: -0.06 } },
  }),
  razee: ship({
    id: 'razee', name: 'Razee', tier: 4, rig: 'square', role: 'A ship of the line cut down a deck: heavy guns on a hull that can still run.',
    length: 50, beam: 13, hull: 5200, armor: 0.3, maxSpeed: 13, accel: 1.0, turnRate: 11.5, draft: 5.4,
    holdVolume: 110, holdWeight: 150, crewMin: 140, crewMax: 420, gunPortsPerSide: 16, bowChasers: 2, sternChasers: 2,
    sailHp: 250, repairRate: 0.85, detection: 1600, price: 52000, purchasable: true, sprite: 'ship.razee', list: 'combat',
    passive: { id: 'line', name: 'Cut-down Line', description: 'Immune to raking bonus damage from the bow.' },
  }),
  ship_of_the_line: ship({
    id: 'ship_of_the_line', name: 'Ship of the Line', tier: 5, rig: 'square', role: 'A seventy-four: two gun decks and the crew of a village.',
    length: 60, beam: 16, hull: 8200, armor: 0.32, maxSpeed: 11, accel: 0.75, turnRate: 8.5, draft: 6.4,
    holdVolume: 140, holdWeight: 180, crewMin: 220, crewMax: 680, gunPortsPerSide: 22, bowChasers: 2, sternChasers: 2,
    sailHp: 320, repairRate: 0.7, detection: 1600, price: 100000, purchasable: true, sprite: 'ship.ship_of_the_line', list: 'combat',
    passive: { id: 'line', name: 'Seventy-Four', description: 'Immune to raking bonus damage from the bow; her crew loses a tenth less morale.', mods: { moraleLoss: -0.1 } },
  }),
  black_corsair: ship({
    id: 'black_corsair', name: 'Black Corsair', tier: 4, rig: 'square', role: 'A corsair frigate under crimson sails, built to run prizes down.',
    length: 44, beam: 11, hull: 4600, armor: 0.24, maxSpeed: 15.5, accel: 1.5, turnRate: 15, draft: 4.2,
    holdVolume: 110, holdWeight: 130, crewMin: 100, crewMax: 300, gunPortsPerSide: 14, bowChasers: 2, sternChasers: 2,
    sailHp: 230, repairRate: 1.0, detection: 1700, price: 46000, purchasable: false, sprite: 'ship.black_corsair', list: 'combat',
    passive: { id: 'corsair_lines', name: 'Corsair Lines', description: 'Built to run prizes down: +10% acceleration and +15% boarding range.', mods: { accel: 0.1, boardingRange: 0.15 } },
    premium: { price: 2600, note: ['Fast for a frigate and built to run prizes down; the Black Flag turns her guns red-hot when she is hurt.', 'Быстрая для фрегата, строена догонять призы; Чёрный флаг раскаляет её пушки, когда она ранена.'], beasts: [{ u: 'corsair_phantom', n: 14 }] },
  }),
  dragon_junk: ship({
    id: 'dragon_junk', name: 'Dragon Junk', tier: 3, rig: 'mixed', role: 'An eastern battle junk bristling with fire lances.',
    length: 34, beam: 10, hull: 2800, armor: 0.16, maxSpeed: 14, accel: 1.6, turnRate: 16, draft: 3.0,
    holdVolume: 90, holdWeight: 110, crewMin: 50, crewMax: 160, gunPortsPerSide: 9, bowChasers: 2, sternChasers: 1,
    sailHp: 170, repairRate: 1.0, detection: 1500, price: 18000, purchasable: false, sprite: 'ship.dragon_junk', list: 'combat',
    passive: { id: 'bulkheads', name: 'Watertight Bulkheads', description: 'A junk\'s bulkheads: leaks let in a quarter less water, and never more than two stand open.', mods: { leakInflow: -0.25, bulkheads: 1 } },
    premium: { price: 1400, note: ['An eastern battle junk: watertight bulkheads, and fire lances that set her enemies alight.', 'Восточная боевая джонка: водонепроницаемые переборки и огненные копья, что поджигают врага.'], beasts: [{ u: 'dragon_lancer', n: 16 }] },
  }),
  iron_ram: ship({
    id: 'iron_ram', name: 'Iron Ram', tier: 4, rig: 'square', role: 'A heavy ram ship sheathed in black iron from the bow back.',
    length: 44, beam: 12, hull: 5600, armor: 0.32, maxSpeed: 12.5, accel: 1.1, turnRate: 12, draft: 4.6,
    holdVolume: 100, holdWeight: 150, crewMin: 110, crewMax: 340, gunPortsPerSide: 12, bowChasers: 2, sternChasers: 1,
    sailHp: 220, repairRate: 0.85, detection: 1500, price: 48000, purchasable: false, sprite: 'ship.iron_ram', list: 'combat',
    passive: { id: 'iron_bow', name: 'Iron Bow', description: 'Her iron-sheathed ram strikes 80% harder, and a collision does her half the harm.', mods: { ramDealt: 0.8, ramTaken: -0.5 } },
    premium: { price: 2500, note: ['Iron from the bow back: a ram that breaks hulls, and marines in iron who come over it.', 'Железо от носа до кормы: таран, что ломает корпуса, и морпехи в железе, что идут через него.'], beasts: [{ u: 'iron_marine', n: 14 }] },
  }),
  thunderer: ship({
    id: 'thunderer', name: 'Thunderer', tier: 4, rig: 'square', role: 'A storm frigate with copper rods on every masthead.',
    length: 46, beam: 12, hull: 5000, armor: 0.26, maxSpeed: 13.5, accel: 1.2, turnRate: 13, draft: 4.6,
    holdVolume: 110, holdWeight: 140, crewMin: 120, crewMax: 360, gunPortsPerSide: 15, bowChasers: 2, sternChasers: 2,
    sailHp: 240, repairRate: 0.9, detection: 1650, price: 50000, purchasable: false, sprite: 'ship.thunderer', list: 'combat',
    passive: { id: 'copper_rods', name: 'Copper Rods', description: 'Copper down every mast to the sea: lightning strikes do 60% less damage.', flags: ['lightning_rod'] },
    premium: { price: 2700, note: ['Copper rods on every masthead: the storm fights for her.', 'Медные громоотводы на каждой мачте: буря сражается за неё.'], beasts: [{ u: 'storm_caller', n: 12 }] },
  }),
  wyvern_galleass: ship({
    id: 'wyvern_galleass', name: 'Wyvern Galleass', tier: 5, rig: 'fore_aft', role: 'A great galleass: banks of oars and a heavy battery at the bow.',
    length: 56, beam: 13, hull: 8000, armor: 0.3, maxSpeed: 12, accel: 1.0, turnRate: 10, draft: 4.6,
    holdVolume: 140, holdWeight: 170, crewMin: 220, crewMax: 700, gunPortsPerSide: 18, bowChasers: 4, sternChasers: 2,
    sailHp: 300, repairRate: 0.8, detection: 1650, price: 105000, purchasable: false, sprite: 'ship.wyvern_galleass', list: 'combat',
    passive: { id: 'sweeps', name: 'Banks of Oars', description: '+25% speed in winds under half strength; oars give at least 3 m/s on any heading; her bow battery hits 25% harder.', mods: { chaserDamage: 0.25 } },
    premium: { price: 4200, note: ['Banks of oars and a heavy bow battery; a wyvern rides in her shadow.', 'Ряды вёсел и тяжёлая носовая батарея; в её тени летит виверна.'], beasts: [{ u: 'sea_wyvern', n: 3 }] },
  }),
  kraken_hunter: ship({
    id: 'kraken_hunter', name: 'Kraken Hunter', tier: 5, rig: 'mixed', role: 'A warship-whaler with harpoon guns along both sides.',
    length: 56, beam: 15, hull: 8400, armor: 0.32, maxSpeed: 11.5, accel: 0.9, turnRate: 9.5, draft: 5.6,
    holdVolume: 140, holdWeight: 180, crewMin: 200, crewMax: 640, gunPortsPerSide: 20, bowChasers: 2, sternChasers: 2,
    sailHp: 310, repairRate: 0.8, detection: 1800, price: 108000, purchasable: false, sprite: 'ship.kraken_hunter', list: 'combat',
    passive: { id: 'flensing_deck', name: 'Whaler\'s Frames', description: 'Flenses a carcass twice as fast; her line stands a third more strain; shy whales hear her a third less.' },
    premium: { price: 4400, note: ['A warship-whaler: her harpoons hook ships and monsters alike, and war orcas swim with her.', 'Военный китобой: её гарпуны цепляют и корабли, и чудовищ, а с ней плывут боевые косатки.'], beasts: [{ u: 'war_orca', n: 3 }] },
  }),
  crimson_tide: ship({
    id: 'crimson_tide', name: 'Crimson Tide', tier: 5, rig: 'square', role: 'A three-decker pirate flagship under deep red sails.',
    length: 62, beam: 17, hull: 8800, armor: 0.33, maxSpeed: 11, accel: 0.8, turnRate: 8.5, draft: 6.2,
    holdVolume: 140, holdWeight: 170, crewMin: 240, crewMax: 720, gunPortsPerSide: 24, bowChasers: 2, sternChasers: 2,
    sailHp: 330, repairRate: 0.7, detection: 1650, price: 120000, purchasable: false, sprite: 'ship.crimson_tide', list: 'combat',
    passive: { id: 'line', name: 'Pirate Flagship', description: 'Immune to raking bonus damage from the bow; her crew loses 15% less morale.', mods: { moraleLoss: -0.15 } },
    premium: { price: 4800, note: ['The pirate flagship: a hundred guns, a crimson guard, and a crew that fights as one tide.', 'Пиратский флагман: сотня пушек, багровая гвардия и команда, что бьётся единым приливом.'], beasts: [{ u: 'crimson_guard', n: 12 }] },
  }),
  phantom_brig: ship({
    id: 'phantom_brig', name: 'Phantom Brig', tier: 3, rig: 'square', role: 'A pale brig with torn grey sails and mist in her rigging.',
    length: 32, beam: 9, hull: 2500, armor: 0.14, maxSpeed: 15.5, accel: 1.8, turnRate: 18, draft: 3.2,
    holdVolume: 80, holdWeight: 100, crewMin: 40, crewMax: 140, gunPortsPerSide: 8, bowChasers: 2, sternChasers: 1,
    sailHp: 160, repairRate: 1.2, detection: 1600, price: 16000, purchasable: false, sprite: 'ship.phantom_brig', list: 'combat',
    passive: { id: 'pale_timbers', name: 'Pale Timbers', description: 'Weathered silver-grey wood: her signature is a fifth smaller and her crew loses a tenth less morale.', mods: { signature: -0.2, moraleLoss: -0.1 } },
    premium: { price: 1300, note: ['A pale brig that is hard to see and harder to finish: she fades into mist.', 'Бледный бриг, которого трудно заметить и ещё труднее добить: она растворяется в тумане.'], beasts: [{ u: 'mist_wraith', n: 10 }] },
  }),
  storm_reaver: ship({
    id: 'storm_reaver', name: 'Storm Reaver', tier: 4, rig: 'square', role: 'A raider brig with spiked bulwarks and a boarding beak at the bow.',
    length: 40, beam: 10, hull: 4800, armor: 0.25, maxSpeed: 14, accel: 1.4, turnRate: 14, draft: 4.0,
    holdVolume: 100, holdWeight: 130, crewMin: 130, crewMax: 400, gunPortsPerSide: 13, bowChasers: 2, sternChasers: 1,
    sailHp: 230, repairRate: 0.95, detection: 1600, price: 44000, purchasable: false, sprite: 'ship.storm_reaver', list: 'combat',
    passive: { id: 'raider_rig', name: 'Boarding Beak', description: 'Boarding range +10%; changing sail level is 20% faster; her boarders strike 10% harder.', mods: { meleeDamage: 0.1 } },
    premium: { price: 2500, note: ['A raider made for boarding: her men go over in a fury.', 'Рейдер для абордажа: её люди идут на чужую палубу в ярости.'], beasts: [{ u: 'storm_berserker', n: 16 }] },
  }),
  sun_galleon: ship({
    id: 'sun_galleon', name: 'Sun Galleon', tier: 5, rig: 'square', role: 'A gilded war galleon of the Crown, her stern carved with golden suns.',
    length: 60, beam: 17, hull: 9000, armor: 0.34, maxSpeed: 10.5, accel: 0.8, turnRate: 8.5, draft: 6.0,
    holdVolume: 140, holdWeight: 200, crewMin: 200, crewMax: 620, gunPortsPerSide: 21, bowChasers: 2, sternChasers: 2,
    sailHp: 320, repairRate: 0.75, detection: 1600, price: 115000, purchasable: false, sprite: 'ship.sun_galleon', list: 'combat',
    passive: { id: 'castle', name: 'Castle of Suns', description: 'Defenders gain +25% boarding power.' },
    premium: { price: 4500, note: ['The Crown\'s gilded war galleon: a castle of suns that mends herself in a fight.', 'Золочёный военный галеон Короны: замок солнц, что чинит себя в бою.'], beasts: [{ u: 'sun_guard', n: 12 }] },
  }),

  // The traders.
  tartane: ship({
    id: 'tartane', name: 'Tartane', tier: 1, rig: 'fore_aft', role: 'A small lateen coaster: cheap to sail, quick to load.',
    length: 20, beam: 7, hull: 800, armor: 0.03, maxSpeed: 14, accel: 1.8, turnRate: 19, draft: 1.8,
    holdVolume: 100, holdWeight: 110, crewMin: 6, crewMax: 20, gunPortsPerSide: 1, bowChasers: 0, sternChasers: 1,
    sailHp: 90, repairRate: 1.1, detection: 1300, price: 1300, purchasable: true, sprite: 'ship.tartane', list: 'trade',
    passive: { id: 'coaster', name: 'Coaster', description: 'A small crew and a short haul: wages and provisions cost a fifth less.', mods: { wages: -0.2, provisionUse: -0.2 } },
  }),
  hoy: ship({
    id: 'hoy', name: 'Hoy', tier: 1, rig: 'fore_aft', role: 'A stubby coastal hoy with leeboards: she goes where deep keels cannot.',
    length: 20, beam: 7, hull: 900, armor: 0.04, maxSpeed: 13, accel: 1.5, turnRate: 17, draft: 1.4,
    holdVolume: 110, holdWeight: 130, crewMin: 6, crewMax: 18, gunPortsPerSide: 1, bowChasers: 0, sternChasers: 1,
    sailHp: 90, repairRate: 1.1, detection: 1250, price: 1400, purchasable: true, sprite: 'ship.hoy', list: 'trade',
    passive: { id: 'shallow_runner', name: 'Leeboards', description: 'Can cross reefs and shoals that tear the keel out of bigger ships.' },
  }),
  pinnace: ship({
    id: 'pinnace', name: 'Pinnace', tier: 1, rig: 'square', role: 'A light two-master that carries the mail and a little cargo.',
    length: 22, beam: 6, hull: 850, armor: 0.04, maxSpeed: 15, accel: 2.0, turnRate: 20, draft: 1.9,
    holdVolume: 95, holdWeight: 100, crewMin: 8, crewMax: 24, gunPortsPerSide: 2, bowChasers: 1, sternChasers: 0,
    sailHp: 95, repairRate: 1.1, detection: 1400, price: 1500, purchasable: true, sprite: 'ship.pinnace', list: 'trade',
    passive: { id: 'dispatch', name: 'Packet Runner', description: 'Courier contracts pay 20% more; +10% acceleration.' },
  }),
  snow: ship({
    id: 'snow', name: 'Snow', tier: 2, rig: 'square', role: 'A roomy two-masted merchant, handier than she looks.',
    length: 30, beam: 9, hull: 1600, armor: 0.06, maxSpeed: 12.5, accel: 1.3, turnRate: 14, draft: 3.2,
    holdVolume: 215, holdWeight: 240, crewMin: 14, crewMax: 48, gunPortsPerSide: 3, bowChasers: 0, sternChasers: 1,
    sailHp: 130, repairRate: 1.0, detection: 1250, price: 6200, purchasable: true, sprite: 'ship.snow', list: 'trade',
    passive: { id: 'trysail', name: 'Trysail Mast', description: 'Her gaff trysail eases a turn: +10% turning, and she bleeds a fifth less way in a hard turn.', mods: { turnRate: 0.1, turnDrag: -0.2 } },
  }),
  barque: ship({
    id: 'barque', name: 'Barque', tier: 2, rig: 'mixed', role: 'A deep merchant hull on a thrifty rig.',
    length: 34, beam: 10, hull: 1800, armor: 0.06, maxSpeed: 12, accel: 1.2, turnRate: 13, draft: 3.6,
    holdVolume: 240, holdWeight: 280, crewMin: 16, crewMax: 56, gunPortsPerSide: 3, bowChasers: 0, sternChasers: 1,
    sailHp: 140, repairRate: 0.95, detection: 1250, price: 7200, purchasable: true, sprite: 'ship.barque', list: 'trade',
    passive: { id: 'thrifty', name: 'Thrifty Rig', description: 'A fore-and-aft mizzen and a small crew: wages a fifth less, provisions a tenth less.', mods: { wages: -0.2, provisionUse: -0.1 } },
  }),
  carrack: ship({
    id: 'carrack', name: 'Carrack', tier: 3, rig: 'mixed', role: 'A tall-castled carrack of the old spice runs.',
    length: 38, beam: 12, hull: 2600, armor: 0.1, maxSpeed: 11.5, accel: 1.0, turnRate: 11, draft: 4.2,
    holdVolume: 300, holdWeight: 340, crewMin: 30, crewMax: 90, gunPortsPerSide: 5, bowChasers: 1, sternChasers: 1,
    sailHp: 170, repairRate: 0.9, detection: 1300, price: 15000, purchasable: true, sprite: 'ship.carrack', list: 'trade',
    passive: { id: 'castle', name: 'High Castles', description: 'Defenders gain +25% boarding power.' },
  }),
  east_indiaman: ship({
    id: 'east_indiaman', name: 'East Indiaman', tier: 4, rig: 'square', role: 'A great armed merchantman of the company trade.',
    length: 48, beam: 13, hull: 4200, armor: 0.2, maxSpeed: 11.5, accel: 0.9, turnRate: 10, draft: 5.0,
    holdVolume: 360, holdWeight: 420, crewMin: 60, crewMax: 200, gunPortsPerSide: 9, bowChasers: 2, sternChasers: 2,
    sailHp: 220, repairRate: 0.85, detection: 1350, price: 36000, purchasable: true, sprite: 'ship.east_indiaman', list: 'trade',
    passive: { id: 'deep_hold', name: 'Company Hold', description: 'Cargo is 50% less likely to be destroyed by hull hits; perishables spoil a third slower.', mods: { spoilage: -0.33 } },
  }),
  golden_carrack: ship({
    id: 'golden_carrack', name: 'Golden Carrack', tier: 4, rig: 'mixed', role: 'A carrack in gold leaf from castle to castle.',
    length: 44, beam: 13, hull: 4400, armor: 0.2, maxSpeed: 11.5, accel: 0.9, turnRate: 10, draft: 5.0,
    holdVolume: 360, holdWeight: 420, crewMin: 60, crewMax: 200, gunPortsPerSide: 9, bowChasers: 1, sternChasers: 2,
    sailHp: 220, repairRate: 0.85, detection: 1350, price: 38000, purchasable: false, sprite: 'ship.golden_carrack', list: 'trade',
    passive: { id: 'castle', name: 'Gilded Castles', description: 'Defenders gain +25% boarding power.' },
    premium: { price: 2400, note: ['Gold leaf from castle to castle: every port pays her more.', 'Сусальное золото от бака до юта: любой порт платит ей больше.'], beasts: [{ u: 'gilded_golem', n: 2 }] },
  }),
  spice_dhow: ship({
    id: 'spice_dhow', name: 'Spice Dhow', tier: 2, rig: 'fore_aft', role: 'An Arabian dhow under saffron lateens, heavy with spice.',
    length: 28, beam: 8, hull: 1500, armor: 0.05, maxSpeed: 14, accel: 1.7, turnRate: 17, draft: 2.6,
    holdVolume: 210, holdWeight: 220, crewMin: 12, crewMax: 40, gunPortsPerSide: 2, bowChasers: 1, sternChasers: 1,
    sailHp: 130, repairRate: 1.1, detection: 1350, price: 6500, purchasable: false, sprite: 'ship.spice_dhow', list: 'trade',
    passive: { id: 'sewn_hull', name: 'Sewn Hull', description: 'A sewn teak hull rides the swell: a heavy sea slows her a quarter less.', mods: { seaPenalty: -0.25 } },
    premium: { price: 750, note: ['A dhow of the spice road, a djinn of saffron smoke aboard.', 'Доу пряного пути с джинном шафранового дыма на борту.'], beasts: [{ u: 'spice_djinn', n: 1 }] },
  }),
  silk_junk: ship({
    id: 'silk_junk', name: 'Silk Junk', tier: 3, rig: 'mixed', role: 'A trading junk under blue silk, her hold full of bolts of it.',
    length: 36, beam: 10, hull: 2400, armor: 0.08, maxSpeed: 13, accel: 1.2, turnRate: 13, draft: 3.4,
    holdVolume: 300, holdWeight: 320, crewMin: 24, crewMax: 80, gunPortsPerSide: 4, bowChasers: 1, sternChasers: 1,
    sailHp: 180, repairRate: 1.0, detection: 1400, price: 15000, purchasable: false, sprite: 'ship.silk_junk', list: 'trade',
    passive: { id: 'batten_sails', name: 'Batten Sails', description: 'Silk on bamboo battens: +15% sail strength, and storms tear them 30% less.', mods: { sailHpMax: 0.15, stormSailDamage: -0.3 } },
    premium: { price: 1200, note: ['A junk under blue silk: her silk sells dear and pays no duty.', 'Джонка под синим шёлком: её шёлк дорог и без пошлин.'], beasts: [{ u: 'silk_blade', n: 10 }] },
  }),
  smugglers_lugger: ship({
    id: 'smugglers_lugger', name: "Smuggler's Lugger", tier: 2, rig: 'fore_aft', role: 'A low black lugger with hidden hatches.',
    length: 26, beam: 7, hull: 1400, armor: 0.05, maxSpeed: 16, accel: 2.2, turnRate: 21, draft: 1.8,
    holdVolume: 210, holdWeight: 200, crewMin: 12, crewMax: 40, gunPortsPerSide: 2, bowChasers: 1, sternChasers: 1,
    sailHp: 120, repairRate: 1.1, detection: 1500, price: 6800, purchasable: false, sprite: 'ship.smugglers_lugger', list: 'trade',
    passive: { id: 'hidden_hatches', name: 'Hidden Hatches', description: 'Contraband takes a quarter less room in her hold.', mods: { contrabandVolumeMul: -0.25 } },
    premium: { price: 800, note: ['A low black lugger with hidden hatches that vanishes in fog.', 'Низкий чёрный люггер с тайными люками, что исчезает в тумане.'], beasts: [{ u: 'night_smuggler', n: 10 }] },
  }),
  pearl_schooner: ship({
    id: 'pearl_schooner', name: 'Pearl Schooner', tier: 3, rig: 'fore_aft', role: 'A pearl-white schooner of the diving grounds.',
    length: 30, beam: 8, hull: 2200, armor: 0.07, maxSpeed: 15, accel: 1.6, turnRate: 18, draft: 2.6,
    holdVolume: 300, holdWeight: 310, crewMin: 20, crewMax: 70, gunPortsPerSide: 4, bowChasers: 1, sternChasers: 1,
    sailHp: 170, repairRate: 1.05, detection: 1500, price: 14500, purchasable: false, sprite: 'ship.pearl_schooner', list: 'trade',
    passive: { id: 'weatherly', name: 'Diver\'s Rig', description: 'Loses 40% less speed when sailing close-hauled.' },
    premium: { price: 1200, note: ['A pearl-white schooner of the diving grounds, sirens in her wake.', 'Жемчужно-белая шхуна с отмелей ныряльщиков, за кормой — сирены.'], beasts: [{ u: 'pearl_siren', n: 6 }] },
  }),
  floating_bazaar: ship({
    id: 'floating_bazaar', name: 'Floating Bazaar', tier: 4, rig: 'mixed', role: 'A broad barge with a market under striped awnings on her deck.',
    length: 44, beam: 16, hull: 4000, armor: 0.14, maxSpeed: 10.5, accel: 0.8, turnRate: 9.5, draft: 3.6,
    holdVolume: 380, holdWeight: 400, crewMin: 40, crewMax: 160, gunPortsPerSide: 6, bowChasers: 1, sternChasers: 1,
    sailHp: 200, repairRate: 0.9, detection: 1300, price: 34000, purchasable: false, sprite: 'ship.floating_bazaar', list: 'trade',
    passive: { id: 'market_deck', name: 'Market Deck', description: 'A broad flat deck of stalls and cookfires: provisions last a tenth longer and her crew\'s morale mends faster.', mods: { provisionUse: -0.1, moraleRegen: 0.1 } },
    premium: { price: 2200, note: ['A market afloat: she buys cheaper than any trader at sea.', 'Плавучий рынок: покупает дешевле любого торговца в море.'], beasts: [{ u: 'bazaar_monkeys', n: 30 }] },
  }),
  rum_runner: ship({
    id: 'rum_runner', name: 'Rum Runner', tier: 2, rig: 'fore_aft', role: 'A fast schooner loaded with rum under nets.',
    length: 28, beam: 7, hull: 1500, armor: 0.05, maxSpeed: 15.5, accel: 2.0, turnRate: 19, draft: 2.4,
    holdVolume: 210, holdWeight: 230, crewMin: 12, crewMax: 44, gunPortsPerSide: 3, bowChasers: 1, sternChasers: 1,
    sailHp: 125, repairRate: 1.05, detection: 1400, price: 6800, purchasable: false, sprite: 'ship.rum_runner', list: 'trade',
    passive: { id: 'weatherly', name: 'Schooner Rig', description: 'Loses 40% less speed when sailing close-hauled.' },
    premium: { price: 700, note: ['A fast schooner of rum and nerve: no port takes duty on her barrels.', 'Быстрая шхуна рома и отваги: ни один порт не берёт пошлину с её бочек.'], beasts: [{ u: 'rum_brawler', n: 12 }] },
  }),
  ledger_galleon: ship({
    id: 'ledger_galleon', name: 'Ledger Galleon', tier: 4, rig: 'square', role: 'A black and silver galleon of the Brokers, her stern carved as an open ledger.',
    length: 48, beam: 14, hull: 4600, armor: 0.24, maxSpeed: 10.5, accel: 0.85, turnRate: 9.5, draft: 5.2,
    holdVolume: 380, holdWeight: 440, crewMin: 60, crewMax: 220, gunPortsPerSide: 10, bowChasers: 2, sternChasers: 2,
    sailHp: 220, repairRate: 0.85, detection: 1400, price: 40000, purchasable: false, sprite: 'ship.ledger_galleon', list: 'trade',
    passive: { id: 'strongboxes', name: 'Chained Strongboxes', description: 'When she sinks, her boats save a fifth of the lawful cargo and fewer of her men are lost.', mods: { lifeboats: 1 } },
    premium: { price: 2400, note: ['The Brokers\' own galleon: their seal on her hold, no duty anywhere.', 'Собственный галеон Брокеров: их печать на трюме — нигде никаких пошлин.'], beasts: [{ u: 'ledger_enforcer', n: 10 }] },
  }),
  tea_clipper: ship({
    id: 'tea_clipper', name: 'Tea Clipper', tier: 3, rig: 'square', role: 'A tall clipper that races the season home with the first of the cargo.',
    length: 44, beam: 9, hull: 2300, armor: 0.07, maxSpeed: 16.5, accel: 1.6, turnRate: 15, draft: 3.6,
    holdVolume: 300, holdWeight: 300, crewMin: 26, crewMax: 90, gunPortsPerSide: 4, bowChasers: 1, sternChasers: 1,
    sailHp: 190, repairRate: 1.0, detection: 1500, price: 16000, purchasable: false, sprite: 'ship.tea_clipper', list: 'trade',
    passive: { id: 'clipper_bow', name: 'Clipper Bow', description: 'A long sharp bow: a heavy sea slows her a third less.', mods: { seaPenalty: -0.33 } },
    premium: { price: 1300, note: ['A clipper that races the season home: fast in open water, and her cargo keeps twice as long.', 'Клипер, что обгоняет сезон: быстр в открытом море, а груз её хранится вдвое дольше.'], beasts: [{ u: 'jade_guard', n: 8 }] },
  }),
  treasure_fluyt: ship({
    id: 'treasure_fluyt', name: 'Treasure Fluyt', tier: 3, rig: 'square', role: 'An iron-bound fluyt with barred hatches over her strongroom.',
    length: 36, beam: 11, hull: 2800, armor: 0.14, maxSpeed: 11, accel: 1.0, turnRate: 11, draft: 3.8,
    holdVolume: 300, holdWeight: 360, crewMin: 24, crewMax: 80, gunPortsPerSide: 4, bowChasers: 0, sternChasers: 2,
    sailHp: 160, repairRate: 0.9, detection: 1250, price: 16000, purchasable: false, sprite: 'ship.treasure_fluyt', list: 'trade',
    passive: { id: 'deep_hold', name: 'Iron-bound Hold', description: 'Cargo is 50% less likely to be destroyed by hull hits.' },
    premium: { price: 1250, note: ['An iron-bound fluyt with a strongroom that shuts under fire.', 'Окованный флейт с кладовой, что запирается под огнём.'], beasts: [{ u: 'vault_crab', n: 2 }] },
  }),

  // The runners.
  felucca: ship({
    id: 'felucca', name: 'Felucca', tier: 1, rig: 'fore_aft', role: 'A narrow lateen runner, light and quick.',
    length: 18, beam: 4, hull: 760, armor: 0.02, maxSpeed: 18.5, accel: 2.9, turnRate: 28, draft: 1.5,
    holdVolume: 26, holdWeight: 26, crewMin: 6, crewMax: 22, gunPortsPerSide: 2, bowChasers: 1, sternChasers: 0,
    sailHp: 90, repairRate: 1.2, detection: 1450, price: 1600, purchasable: true, sprite: 'ship.felucca', list: 'fast',
    passive: { id: 'shallow_runner', name: 'Shallow Keel', description: 'Can cross reefs and shoals that tear the keel out of bigger ships.' },
  }),
  lugger: ship({
    id: 'lugger', name: 'Lugger', tier: 1, rig: 'fore_aft', role: 'A three-masted lugger under dark sails: seen late, gone early.',
    length: 20, beam: 5, hull: 820, armor: 0.03, maxSpeed: 18, accel: 2.8, turnRate: 27, draft: 1.7,
    holdVolume: 28, holdWeight: 30, crewMin: 8, crewMax: 26, gunPortsPerSide: 2, bowChasers: 1, sternChasers: 1,
    sailHp: 95, repairRate: 1.2, detection: 1500, price: 1800, purchasable: true, sprite: 'ship.lugger', list: 'fast',
    passive: { id: 'lug_sails', name: 'Dark Lugsails', description: 'Dark lugsails are seen late: her signature is a sixth smaller.', mods: { signature: -0.16 } },
  }),
  galiot: ship({
    id: 'galiot', name: 'Galiot', tier: 2, rig: 'fore_aft', role: 'Rare. A low oared runner under two lateens.',
    length: 26, beam: 6, hull: 1350, armor: 0.05, maxSpeed: 16.5, accel: 2.5, turnRate: 22, draft: 1.8,
    holdVolume: 50, holdWeight: 55, crewMin: 24, crewMax: 90, gunPortsPerSide: 4, bowChasers: 2, sternChasers: 0,
    sailHp: 115, repairRate: 1.1, detection: 1450, price: 7800, purchasable: true, sprite: 'ship.galiot', list: 'fast', factions: ['confederacy', 'free', 'brokers'],
    passive: { id: 'sweeps', name: 'Sweeps', description: '+25% speed in winds under half strength; oars give at least 3 m/s on any heading, even head to wind.' },
  }),
  topsail_schooner: ship({
    id: 'topsail_schooner', name: 'Topsail Schooner', tier: 2, rig: 'fore_aft', role: 'A schooner with a square topsail forward: quick off the wind and on it.',
    length: 26, beam: 7, hull: 1400, armor: 0.05, maxSpeed: 17.5, accel: 2.4, turnRate: 23, draft: 2.4,
    holdVolume: 60, holdWeight: 65, crewMin: 14, crewMax: 46, gunPortsPerSide: 5, bowChasers: 1, sternChasers: 1,
    sailHp: 125, repairRate: 1.1, detection: 1550, price: 6400, purchasable: true, sprite: 'ship.topsail_schooner', list: 'fast',
    passive: { id: 'weatherly', name: 'Weatherly', description: 'Loses 40% less speed when sailing close-hauled.' },
  }),
  baltimore_clipper: ship({
    id: 'baltimore_clipper', name: 'Baltimore Clipper', tier: 3, rig: 'fore_aft', role: 'A long low clipper with raked masts: the fastest thing in the Reach for her size.',
    length: 30, beam: 7, hull: 2000, armor: 0.08, maxSpeed: 18, accel: 2.2, turnRate: 21, draft: 2.8,
    holdVolume: 80, holdWeight: 90, crewMin: 30, crewMax: 100, gunPortsPerSide: 7, bowChasers: 1, sternChasers: 1,
    sailHp: 160, repairRate: 1.05, detection: 1600, price: 15500, purchasable: true, sprite: 'ship.baltimore_clipper', list: 'fast',
    passive: { id: 'raked_masts', name: 'Raked Masts', description: 'Huge fore-and-aft sails: +10% acceleration, and she bleeds a fifth less way in a hard turn.', mods: { accel: 0.1, turnDrag: -0.2 } },
  }),
  sea_hawk: ship({
    id: 'sea_hawk', name: 'Sea Hawk', tier: 3, rig: 'fore_aft', role: 'A raider schooner painted with a hawk\'s wings.',
    length: 30, beam: 7, hull: 2100, armor: 0.08, maxSpeed: 18, accel: 2.2, turnRate: 21, draft: 2.6,
    holdVolume: 75, holdWeight: 85, crewMin: 30, crewMax: 100, gunPortsPerSide: 7, bowChasers: 2, sternChasers: 1,
    sailHp: 165, repairRate: 1.05, detection: 1700, price: 16000, purchasable: false, sprite: 'ship.sea_hawk', list: 'fast',
    passive: { id: 'hunter', name: 'Hawk Eyes', description: '+15% detection radius; targets you damaged are revealed on the minimap for 30s.' },
    premium: { price: 1400, note: ['A raider with hawk eyes: she sees far, and her shot tears canvas.', 'Рейдер с ястребиным глазом: видит далеко, и её ядра рвут парусину.'], beasts: [{ u: 'giant_hawk', n: 6 }] },
  }),
  wind_dancer: ship({
    id: 'wind_dancer', name: 'Wind Dancer', tier: 2, rig: 'fore_aft', role: 'A racing sloop with a huge plan of pale canvas.',
    length: 24, beam: 6, hull: 1350, armor: 0.05, maxSpeed: 18, accel: 2.5, turnRate: 24, draft: 2.2,
    holdVolume: 55, holdWeight: 60, crewMin: 12, crewMax: 40, gunPortsPerSide: 4, bowChasers: 1, sternChasers: 1,
    sailHp: 130, repairRate: 1.1, detection: 1550, price: 6800, purchasable: false, sprite: 'ship.wind_dancer', list: 'fast',
    passive: { id: 'weatherly', name: 'Racing Rig', description: 'Loses 40% less speed when sailing close-hauled.' },
    premium: { price: 750, note: ['A racing sloop that dances in the lightest airs.', 'Гоночный шлюп, что танцует при самом слабом ветре.'], beasts: [{ u: 'wind_sprite', n: 8 }] },
  }),
  shark_cutter: ship({
    id: 'shark_cutter', name: 'Shark Cutter', tier: 2, rig: 'fore_aft', role: 'A lean cutter with a shark\'s jaw carved on her bow.',
    length: 22, beam: 6, hull: 1400, armor: 0.06, maxSpeed: 18, accel: 2.8, turnRate: 26, draft: 1.8,
    holdVolume: 45, holdWeight: 50, crewMin: 12, crewMax: 44, gunPortsPerSide: 4, bowChasers: 2, sternChasers: 0,
    sailHp: 120, repairRate: 1.15, detection: 1600, price: 7000, purchasable: false, sprite: 'ship.shark_cutter', list: 'fast',
    passive: { id: 'dispatch', name: 'Cutter Hull', description: 'Courier contracts pay 20% more; +10% acceleration.' },
    premium: { price: 850, note: ['A shark-jawed cutter: her shot opens wounds, and great whites follow her.', 'Катер с акульей пастью: её ядра вскрывают раны, а за ней идут большие белые.'], beasts: [{ u: 'great_white', n: 2 }] },
  }),
  ghost_clipper: ship({
    id: 'ghost_clipper', name: 'Ghost Clipper', tier: 4, rig: 'square', role: 'A pale clipper whose thin grey sails drift like mist.',
    length: 42, beam: 9, hull: 3400, armor: 0.12, maxSpeed: 17.5, accel: 1.7, turnRate: 17, draft: 3.8,
    holdVolume: 110, holdWeight: 120, crewMin: 50, crewMax: 170, gunPortsPerSide: 10, bowChasers: 2, sternChasers: 1,
    sailHp: 220, repairRate: 1.15, detection: 1700, price: 40000, purchasable: false, sprite: 'ship.ghost_clipper', list: 'fast',
    passive: { id: 'ghost_timbers', name: 'Ghost Timbers', description: 'Pale timbers that should not float: her crew loses a tenth less morale, and she mends 15% faster.', mods: { moraleLoss: -0.1, repairRate: 0.15 } },
    premium: { price: 2500, note: ['A pale clipper that owns the night.', 'Бледный клипер, которому принадлежит ночь.'], beasts: [{ u: 'ghost_navigator', n: 12 }] },
  }),
  flying_fish: ship({
    id: 'flying_fish', name: 'Flying Fish', tier: 1, rig: 'fore_aft', role: 'A tiny sloop with wing-like sails spread to both sides.',
    length: 16, beam: 5, hull: 800, armor: 0.03, maxSpeed: 19, accel: 3.1, turnRate: 30, draft: 1.4,
    holdVolume: 26, holdWeight: 26, crewMin: 6, crewMax: 22, gunPortsPerSide: 2, bowChasers: 1, sternChasers: 0,
    sailHp: 95, repairRate: 1.2, detection: 1500, price: 1900, purchasable: false, sprite: 'ship.flying_fish', list: 'fast',
    passive: { id: 'wing_booms', name: 'Wing Booms', description: 'Sails spread to both sides like fins: +15% acceleration.', mods: { accel: 0.15 } },
    premium: { price: 450, note: ['The smallest of them: a tiny swift sloop that skips out of trouble.', 'Самый маленький из них: крошечный быстрый шлюп, что выпрыгивает из беды.'], beasts: [{ u: 'flying_fish', n: 6 }] },
  }),
  albatross_xebec: ship({
    id: 'albatross_xebec', name: 'Albatross', tier: 3, rig: 'fore_aft', role: 'A long xebec under three great white lateens.',
    length: 34, beam: 8, hull: 2100, armor: 0.07, maxSpeed: 17.5, accel: 2.3, turnRate: 20, draft: 2.4,
    holdVolume: 75, holdWeight: 80, crewMin: 30, crewMax: 110, gunPortsPerSide: 7, bowChasers: 2, sternChasers: 1,
    sailHp: 160, repairRate: 1.1, detection: 1600, price: 15000, purchasable: false, sprite: 'ship.albatross_xebec', list: 'fast',
    passive: { id: 'sweeps', name: 'Sweeps', description: '+25% speed in winds under half strength; oars give at least 3 m/s on any heading, even head to wind.' },
    premium: { price: 1350, note: ['A xebec under albatross wings: a good omen in open water.', 'Шебека на крыльях альбатроса: добрый знак в открытом море.'], beasts: [{ u: 'white_albatross', n: 3 }] },
  }),
  silver_arrow: ship({
    id: 'silver_arrow', name: 'Silver Arrow', tier: 4, rig: 'square', role: 'A long silver-sheathed clipper with a needle bow.',
    length: 46, beam: 9, hull: 3300, armor: 0.1, maxSpeed: 18.5, accel: 1.8, turnRate: 16, draft: 4.0,
    holdVolume: 110, holdWeight: 115, crewMin: 50, crewMax: 160, gunPortsPerSide: 10, bowChasers: 2, sternChasers: 1,
    sailHp: 220, repairRate: 1.05, detection: 1700, price: 42000, purchasable: false, sprite: 'ship.silver_arrow', list: 'fast',
    passive: { id: 'needle_bow', name: 'Needle Bow', description: 'A needle-sharp bow: a heavy sea slows her a third less.', mods: { seaPenalty: -0.33 } },
    premium: { price: 2600, note: ['The fastest hull at sea: a needle bow, and silver archers aboard.', 'Самый быстрый корпус в море: игольчатый нос и серебряные лучники на борту.'], beasts: [{ u: 'silver_archer', n: 16 }] },
  }),
  storm_petrel: ship({
    id: 'storm_petrel', name: 'Storm Petrel', tier: 3, rig: 'mixed', role: 'A brigantine built for storms, under black storm canvas.',
    length: 32, beam: 8, hull: 2300, armor: 0.1, maxSpeed: 16.5, accel: 1.9, turnRate: 19, draft: 3.0,
    holdVolume: 85, holdWeight: 100, crewMin: 34, crewMax: 110, gunPortsPerSide: 7, bowChasers: 1, sternChasers: 1,
    sailHp: 180, repairRate: 1.0, detection: 1550, price: 15500, purchasable: false, sprite: 'ship.storm_petrel', list: 'fast',
    passive: { id: 'storm_canvas', name: 'Storm Canvas', description: 'Black storm sails: storms tear them 40% less, and a heavy sea slows her a quarter less.', mods: { stormSailDamage: -0.4, seaPenalty: -0.25 } },
    premium: { price: 1300, note: ['A brigantine built for storms: the worse the weather, the faster she goes.', 'Бригантина для бурь: чем хуже погода, тем быстрее она идёт.'], beasts: [{ u: 'storm_petrels', n: 16 }] },
  }),
  mermaid_grace: ship({
    id: 'mermaid_grace', name: "Mermaid's Grace", tier: 2, rig: 'fore_aft', role: 'A sea-green schooner with a mermaid at her bow.',
    length: 26, beam: 7, hull: 1450, armor: 0.05, maxSpeed: 17.5, accel: 2.3, turnRate: 22, draft: 2.2,
    holdVolume: 60, holdWeight: 62, crewMin: 14, crewMax: 46, gunPortsPerSide: 4, bowChasers: 1, sternChasers: 1,
    sailHp: 125, repairRate: 1.15, detection: 1500, price: 6800, purchasable: false, sprite: 'ship.mermaid_grace', list: 'fast',
    passive: { id: 'sea_blessed', name: 'Shell-set Rails', description: 'A ship the sea likes: her crew\'s morale mends a fifth faster.', mods: { moraleRegen: 0.08 } },
    premium: { price: 900, note: ['A sea-green schooner the sea loves, with a mermaid queen aboard.', 'Зелёная шхуна, которую любит море, с королевой русалок на борту.'], beasts: [{ u: 'mermaid_queen', n: 1 }] },
  }),
  viper: ship({
    id: 'viper', name: 'Viper', tier: 3, rig: 'fore_aft', role: 'A black galley-raider with a serpent\'s head at the bow.',
    length: 30, beam: 6, hull: 2000, armor: 0.08, maxSpeed: 17.5, accel: 2.5, turnRate: 22, draft: 1.8,
    holdVolume: 70, holdWeight: 75, crewMin: 40, crewMax: 130, gunPortsPerSide: 6, bowChasers: 2, sternChasers: 0,
    sailHp: 150, repairRate: 1.05, detection: 1550, price: 14500, purchasable: false, sprite: 'ship.viper', list: 'fast',
    passive: { id: 'sweeps', name: 'Serpent Oars', description: '+25% speed in winds under half strength; oars give at least 3 m/s on any heading, even head to wind.' },
    premium: { price: 1350, note: ['A black serpent-raider on oars: her shot chokes the enemy\'s guns.', 'Чёрный змей-рейдер на вёслах: её ядра душат вражеские пушки.'], beasts: [{ u: 'sea_viper', n: 4 }] },
  }),

  // The haulers.
  cog: ship({
    id: 'cog', name: 'Cog', tier: 1, rig: 'square', role: 'A round-bellied cog: one square sail and a hold like a barn.',
    length: 22, beam: 8, hull: 1100, armor: 0.08, maxSpeed: 11.5, accel: 1.0, turnRate: 13, draft: 2.4,
    holdVolume: 140, holdWeight: 170, crewMin: 8, crewMax: 26, gunPortsPerSide: 1, bowChasers: 0, sternChasers: 1,
    sailHp: 90, repairRate: 0.95, detection: 1200, price: 1800, purchasable: true, sprite: 'ship.cog', list: 'hauler',
    passive: { id: 'castle', name: 'Fore and Aft Castles', description: 'Defenders gain +25% boarding power.' },
  }),
  buss: ship({
    id: 'buss', name: 'Herring Buss', tier: 1, rig: 'square', role: 'A broad herring buss full of barrels.',
    length: 22, beam: 8, hull: 1050, armor: 0.06, maxSpeed: 11, accel: 1.0, turnRate: 12, draft: 2.6,
    holdVolume: 135, holdWeight: 160, crewMin: 10, crewMax: 30, gunPortsPerSide: 1, bowChasers: 0, sternChasers: 1,
    sailHp: 90, repairRate: 0.95, detection: 1200, price: 1700, purchasable: true, sprite: 'ship.buss', list: 'hauler',
    passive: { id: 'wet_well', name: 'Herring Well', description: 'Nets take twice the catch; fish in the hold spoils three times slower.' },
  }),
  pink: ship({
    id: 'pink', name: 'Pink', tier: 2, rig: 'square', role: 'A narrow-sterned pink with a big round hold.',
    length: 30, beam: 10, hull: 1900, armor: 0.08, maxSpeed: 11, accel: 1.0, turnRate: 12, draft: 3.4,
    holdVolume: 280, holdWeight: 320, crewMin: 14, crewMax: 50, gunPortsPerSide: 3, bowChasers: 0, sternChasers: 1,
    sailHp: 130, repairRate: 0.9, detection: 1200, price: 7000, purchasable: true, sprite: 'ship.pink', list: 'hauler',
    passive: { id: 'deep_hold', name: 'Narrow Stern', description: 'Cargo is 50% less likely to be destroyed by hull hits.' },
  }),
  holk: ship({
    id: 'holk', name: 'Hulk', tier: 2, rig: 'square', role: 'A massive round-ended hulk with high sides and a huge hold.',
    length: 34, beam: 12, hull: 2200, armor: 0.1, maxSpeed: 10, accel: 0.9, turnRate: 10.5, draft: 3.8,
    holdVolume: 320, holdWeight: 380, crewMin: 16, crewMax: 56, gunPortsPerSide: 3, bowChasers: 0, sternChasers: 1,
    sailHp: 130, repairRate: 0.85, detection: 1150, price: 7600, purchasable: true, sprite: 'ship.hulk', list: 'hauler',
    passive: { id: 'high_sides', name: 'High Sides', description: 'High round sides: the first ten seconds of an enemy boarding come 15% weaker.', mods: { boardingNets: 0.15 } },
  }),
  collier: ship({
    id: 'collier', name: 'Collier', tier: 2, rig: 'square', role: 'A blunt flat-bottomed collier: cheap, sooty and full.',
    length: 32, beam: 11, hull: 2000, armor: 0.08, maxSpeed: 10.5, accel: 0.9, turnRate: 11, draft: 3.0,
    holdVolume: 300, holdWeight: 400, crewMin: 14, crewMax: 50, gunPortsPerSide: 2, bowChasers: 0, sternChasers: 1,
    sailHp: 125, repairRate: 0.9, detection: 1150, price: 6600, purchasable: true, sprite: 'ship.collier', list: 'hauler',
    passive: { id: 'flat_bottom', name: 'Flat Bottom', description: 'She takes the ground without harm: reefs and shoals do her half the damage.', mods: { reefDamage: -0.5 } },
  }),
  storeship: ship({
    id: 'storeship', name: 'Storeship', tier: 3, rig: 'square', role: 'A naval storeship: few guns and a deep hold of stores.',
    length: 40, beam: 12, hull: 3000, armor: 0.14, maxSpeed: 10.5, accel: 0.85, turnRate: 10, draft: 4.4,
    holdVolume: 380, holdWeight: 460, crewMin: 30, crewMax: 110, gunPortsPerSide: 4, bowChasers: 1, sternChasers: 1,
    sailHp: 170, repairRate: 0.85, detection: 1250, price: 17000, purchasable: true, sprite: 'ship.storeship', list: 'hauler',
    passive: { id: 'naval_stores', name: 'Naval Stores', description: 'Planks, sailcloth and provisions take a quarter less room in her hold.', mods: { materialVolume: -0.25, storesVolume: -0.25 } },
  }),
  cargo_frigate: ship({
    id: 'cargo_frigate', name: 'Cargo Frigate', tier: 3, rig: 'square', role: 'A frigate whose gun deck was turned into hold.',
    length: 42, beam: 12, hull: 3200, armor: 0.16, maxSpeed: 11, accel: 0.9, turnRate: 10.5, draft: 4.6,
    holdVolume: 360, holdWeight: 430, crewMin: 40, crewMax: 140, gunPortsPerSide: 6, bowChasers: 2, sternChasers: 1,
    sailHp: 180, repairRate: 0.85, detection: 1350, price: 18000, purchasable: true, sprite: 'ship.cargo_frigate', list: 'hauler',
    passive: { id: 'gun_brig', name: 'Frigate Frames', description: 'Broadside reload 8% faster when both batteries are loaded.' },
  }),
  plate_galleon: ship({
    id: 'plate_galleon', name: 'Plate Galleon', tier: 4, rig: 'square', role: 'A four-masted plate galleon built to carry silver.',
    length: 52, beam: 15, hull: 5200, armor: 0.27, maxSpeed: 10, accel: 0.8, turnRate: 9.5, draft: 5.6,
    holdVolume: 450, holdWeight: 560, crewMin: 70, crewMax: 280, gunPortsPerSide: 10, bowChasers: 2, sternChasers: 2,
    sailHp: 230, repairRate: 0.8, detection: 1300, price: 40000, purchasable: true, sprite: 'ship.plate_galleon', list: 'hauler',
    passive: { id: 'castle', name: 'Towering Stern', description: 'Defenders gain +25% boarding power.' },
  }),
  great_galleon: ship({
    id: 'great_galleon', name: 'Great Galleon', tier: 5, rig: 'square', role: 'An enormous galleon with three decks of hold.',
    length: 62, beam: 18, hull: 7600, armor: 0.3, maxSpeed: 9.5, accel: 0.7, turnRate: 8, draft: 6.4,
    holdVolume: 680, holdWeight: 800, crewMin: 110, crewMax: 420, gunPortsPerSide: 14, bowChasers: 2, sternChasers: 2,
    sailHp: 300, repairRate: 0.75, detection: 1300, price: 85000, purchasable: true, sprite: 'ship.great_galleon', list: 'hauler',
    passive: { id: 'deep_hold', name: 'Three Decks of Hold', description: 'Cargo is 50% less likely to be destroyed by hull hits.' },
  }),
  leviathan_ark: ship({
    id: 'leviathan_ark', name: 'Leviathan Ark', tier: 5, rig: 'square', role: 'A colossal ark with sea-water pens where young sea creatures swim.',
    length: 68, beam: 22, hull: 8400, armor: 0.3, maxSpeed: 9, accel: 0.65, turnRate: 7.5, draft: 6.6,
    holdVolume: 760, holdWeight: 880, crewMin: 120, crewMax: 440, gunPortsPerSide: 12, bowChasers: 2, sternChasers: 2,
    sailHp: 320, repairRate: 0.75, detection: 1350, price: 95000, purchasable: false, sprite: 'ship.leviathan_ark', list: 'hauler',
    passive: { id: 'wet_well', name: 'Sea Pens', description: 'Nets take twice the catch; fish in the hold spoils three times slower.' },
    premium: { price: 4000, note: ['A colossal ark with pens of sea water, where leviathan calves grow back.', 'Колоссальный ковчег с загонами морской воды, где снова подрастают детёныши левиафана.'], beasts: [{ u: 'leviathan_calf', n: 2 }] },
  }),
  turtle_barge: ship({
    id: 'turtle_barge', name: 'Turtle Barge', tier: 4, rig: 'mixed', role: 'A barge built on the back of a colossal ancient sea turtle.',
    length: 46, beam: 20, hull: 6000, armor: 0.34, maxSpeed: 9, accel: 0.7, turnRate: 8.5, draft: 3.4,
    holdVolume: 520, holdWeight: 600, crewMin: 60, crewMax: 220, gunPortsPerSide: 8, bowChasers: 1, sternChasers: 1,
    sailHp: 200, repairRate: 0.9, detection: 1250, price: 42000, purchasable: false, sprite: 'ship.turtle_barge', list: 'hauler',
    passive: { id: 'turtle_shell', name: 'Living Shell', description: 'The shell of an ancient turtle: +10% hull, and leaks let in a third less water.', mods: { hullMax: 0.1, leakInflow: -0.33 } },
    premium: { price: 2400, note: ['A barge on a living shell: slow, roomy and very hard to break.', 'Баржа на живом панцире: медленная, вместительная и очень крепкая.'], beasts: [{ u: 'turtle_knight', n: 14 }] },
  }),
  floating_fortress: ship({
    id: 'floating_fortress', name: 'Floating Fortress', tier: 5, rig: 'square', role: 'A square fortress-ship with stone-grey battlements and gun towers.',
    length: 56, beam: 24, hull: 10500, armor: 0.4, maxSpeed: 8, accel: 0.55, turnRate: 7, draft: 6.0,
    holdVolume: 640, holdWeight: 760, crewMin: 160, crewMax: 560, gunPortsPerSide: 18, bowChasers: 3, sternChasers: 3,
    sailHp: 260, repairRate: 0.7, detection: 1500, price: 110000, purchasable: false, sprite: 'ship.floating_fortress', list: 'hauler',
    passive: { id: 'castle', name: 'Battlements', description: 'Defenders gain +25% boarding power.' },
    premium: { price: 4600, note: ['A fortress afloat: battlements, corner towers and a garrison of gunners.', 'Плавучая крепость: зубцы, угловые башни и гарнизон канониров.'], beasts: [{ u: 'bastion_gunner', n: 20 }] },
  }),
  menagerie: ship({
    id: 'menagerie', name: 'Menagerie', tier: 4, rig: 'square', role: 'A big galleon with iron-barred cages along her deck.',
    length: 50, beam: 15, hull: 5000, armor: 0.25, maxSpeed: 9.5, accel: 0.75, turnRate: 9, draft: 5.2,
    holdVolume: 480, holdWeight: 560, crewMin: 70, crewMax: 260, gunPortsPerSide: 10, bowChasers: 2, sternChasers: 2,
    sailHp: 230, repairRate: 0.8, detection: 1350, price: 40000, purchasable: false, sprite: 'ship.menagerie', list: 'hauler',
    passive: { id: 'feeding_pails', name: 'Feeding Pails', description: 'A ship that feeds a zoo feeds her crew well: provisions last a fifth longer.', mods: { provisionUse: -0.2 } },
    premium: { price: 2600, note: ['A floating zoo: when the cages open, boarders run.', 'Плавучий зверинец: когда открываются клетки, абордажники бегут.'], beasts: [{ u: 'sea_chimera', n: 1 }] },
  }),
  whale_mother: ship({
    id: 'whale_mother', name: 'Whale Mother', tier: 5, rig: 'mixed', role: 'A whaling mothership with boats on davits all round her.',
    length: 66, beam: 18, hull: 8000, armor: 0.28, maxSpeed: 9.5, accel: 0.7, turnRate: 8, draft: 6.2,
    holdVolume: 740, holdWeight: 860, crewMin: 140, crewMax: 480, gunPortsPerSide: 12, bowChasers: 2, sternChasers: 2,
    sailHp: 320, repairRate: 0.8, detection: 1700, price: 92000, purchasable: false, sprite: 'ship.whale_mother', list: 'hauler', fixedMount: 'harpoon',
    passive: { id: 'flensing_deck', name: 'Try-works', description: 'Flenses a carcass twice as fast; her line stands a third more strain; shy whales hear her a third less.' },
    premium: { price: 3600, note: ['A whaling mothership: her try-works, her boats and whale calves of her own.', 'Китобойная матка: салотопки, вельботы и свои китята.'], beasts: [{ u: 'whale_calf', n: 3 }] },
  }),
  coral_hulk: ship({
    id: 'coral_hulk', name: 'Coral Hulk', tier: 4, rig: 'square', role: 'A great old hulk overgrown with living coral.',
    length: 48, beam: 15, hull: 6200, armor: 0.3, maxSpeed: 8.5, accel: 0.65, turnRate: 8, draft: 5.4,
    holdVolume: 540, holdWeight: 620, crewMin: 60, crewMax: 220, gunPortsPerSide: 9, bowChasers: 1, sternChasers: 2,
    sailHp: 210, repairRate: 1.1, detection: 1250, price: 40000, purchasable: false, sprite: 'ship.coral_hulk', list: 'hauler',
    passive: { id: 'coral_skin', name: 'Coral Skin', description: 'Coral grows over every breach: she mends 20% faster.', mods: { repairRate: 0.2 } },
    premium: { price: 2300, note: ['An old hulk the coral took: it grows over every breach.', 'Старый хольк, которым завладел коралл: он зарастает каждую пробоину.'], beasts: [{ u: 'coral_elemental', n: 2 }] },
  }),
  drowned_cathedral: ship({
    id: 'drowned_cathedral', name: 'Drowned Cathedral', tier: 5, rig: 'square', role: 'A ship of the Choir built like a drowned cathedral, bells in her rigging.',
    length: 64, beam: 18, hull: 8800, armor: 0.3, maxSpeed: 9, accel: 0.65, turnRate: 7.5, draft: 6.4,
    holdVolume: 700, holdWeight: 820, crewMin: 140, crewMax: 500, gunPortsPerSide: 14, bowChasers: 2, sternChasers: 2,
    sailHp: 300, repairRate: 0.8, detection: 1450, price: 98000, purchasable: false, sprite: 'ship.drowned_cathedral', list: 'hauler',
    passive: { id: 'belfry', name: 'Belfry', description: 'Bells of the Choir in her rigging: their toll drowns the Song of the Drowned Whale for every ship within 400 m.', flags: ['choir_bell'] },
    premium: { price: 4200, note: ['A cathedral of the Choir afloat: her bells break the enemy\'s heart.', 'Собор Хора на плаву: её колокола ломают дух врага.'], beasts: [{ u: 'bell_priest', n: 16 }] },
  }),
  treasure_junk: ship({
    id: 'treasure_junk', name: 'Treasure Junk', tier: 4, rig: 'mixed', role: 'A nine-masted treasure junk in red and gold.',
    length: 64, beam: 18, hull: 5400, armor: 0.24, maxSpeed: 10, accel: 0.8, turnRate: 9, draft: 5.0,
    holdVolume: 560, holdWeight: 640, crewMin: 80, crewMax: 280, gunPortsPerSide: 10, bowChasers: 2, sternChasers: 2,
    sailHp: 260, repairRate: 0.85, detection: 1400, price: 44000, purchasable: false, sprite: 'ship.treasure_junk', list: 'hauler',
    passive: { id: 'batten_sails', name: 'Nine Batten Masts', description: '+15% sail strength, and storms tear her sails 30% less.', mods: { sailHpMax: 0.15, stormSailDamage: -0.3 } },
    premium: { price: 2500, note: ['Nine masts of treasure, and a jade dragon to keep it.', 'Девять мачт сокровищ и нефритовый дракон, что их стережёт.'], beasts: [{ u: 'jade_dragon', n: 1 }] },
  }),
  pirate_haven: ship({
    id: 'pirate_haven', name: 'Pirate Haven', tier: 5, rig: 'square', role: 'A floating pirate town on an old hull: shacks, a tavern and rope bridges.',
    length: 60, beam: 20, hull: 8600, armor: 0.28, maxSpeed: 9, accel: 0.65, turnRate: 7.5, draft: 6.2,
    holdVolume: 720, holdWeight: 840, crewMin: 180, crewMax: 640, gunPortsPerSide: 14, bowChasers: 2, sternChasers: 2,
    sailHp: 300, repairRate: 0.85, detection: 1400, price: 90000, purchasable: false, sprite: 'ship.pirate_haven', list: 'hauler',
    passive: { id: 'tavern', name: 'Tavern Aboard', description: 'A tavern with a crooked chimney: morale stands 8 higher and wages are a tenth less.', mods: { moraleBase: 8, wages: -0.1 } },
    premium: { price: 4000, note: ['A pirate town afloat: hands sign on at sea, and pirate lords drink in her tavern.', 'Пиратский город на плаву: люди нанимаются прямо в море, а в её таверне пьют пиратские лорды.'], beasts: [{ u: 'pirate_lord', n: 4 }] },
  }),
  iron_whale: ship({
    id: 'iron_whale', name: 'Iron Whale', tier: 5, rig: 'square', role: 'A colossal whale-shaped hull of riveted iron plates.',
    length: 66, beam: 18, hull: 9800, armor: 0.38, maxSpeed: 8.5, accel: 0.6, turnRate: 7, draft: 6.6,
    holdVolume: 700, holdWeight: 900, crewMin: 130, crewMax: 460, gunPortsPerSide: 14, bowChasers: 2, sternChasers: 2,
    sailHp: 280, repairRate: 0.7, detection: 1350, price: 100000, purchasable: false, sprite: 'ship.iron_whale', list: 'hauler',
    passive: { id: 'iron_plates', name: 'Riveted Plates', description: 'Iron plates over her timbers: a ram does her half the harm, and her own strikes 50% harder.', mods: { ramTaken: -0.5, ramDealt: 0.5 } },
    premium: { price: 4300, note: ['A whale of riveted iron: she closes her plates and shrugs off the fire.', 'Кит из клёпаного железа: смыкает плиты и не замечает огня.'], beasts: [{ u: 'bell_diver', n: 16 }] },
  }),

  // ------------------------------------------------------------------ the lines made whole (owner, 2026-10-04)
  // «Еще больше … кораблей» (owner, 2026-10-04), and the yard's tree of hulls (docs/20): the runners had no silver hull
  // of their own above the third tier and the traders none above the fourth, so their lines handed over to the
  // warships' and the haulers' (research.ts CROSS_LINES). Eight silver hulls of the 1720s fill the gaps and the thin
  // tiers — a sloop-of-war among the warships, a thousand-ton Indiaman and a Manila galleon among the traders, a polacre,
  // a Dunkirk frigate, a great xebec and a race-built galleon among the runners, an armed fluyt among the haulers — each
  // of her list's trade and priced among the hulls of her tier; no faction's yard alone builds her.
  sloop_of_war: ship({
    id: 'sloop_of_war', name: 'Sloop-of-War', tier: 2, rig: 'square', role: 'A small ship-rigged man-of-war of the station: fourteen guns and a navy\'s drilled crew.',
    length: 28, beam: 8, hull: 1900, armor: 0.12, maxSpeed: 15.5, accel: 1.9, turnRate: 19, draft: 3.0,
    holdVolume: 40, holdWeight: 55, crewMin: 30, crewMax: 90, gunPortsPerSide: 7, bowChasers: 2, sternChasers: 1,
    sailHp: 140, repairRate: 1.0, detection: 1500, price: 7200, purchasable: true, sprite: 'ship.sloop_of_war', list: 'combat',
    passive: { id: 'navy_drill', name: 'Navy Gun Drill', description: 'A navy\'s drilled gun crews: her broadsides reload 5% faster and fly 5% tighter.', mods: { reloadMul: -0.05, spreadMul: -0.05 } },
  }),
  great_indiaman: ship({
    id: 'great_indiaman', name: 'Great Indiaman', tier: 5, rig: 'square', role: 'A company ship of a thousand tons: two decks of cargo over a gun deck, built for the longest runs.',
    length: 54, beam: 14, hull: 5600, armor: 0.22, maxSpeed: 11.5, accel: 0.85, turnRate: 9.5, draft: 5.6,
    holdVolume: 460, holdWeight: 540, crewMin: 80, crewMax: 260, gunPortsPerSide: 13, bowChasers: 2, sternChasers: 2,
    sailHp: 260, repairRate: 0.85, detection: 1400, price: 72000, purchasable: true, sprite: 'ship.great_indiaman', list: 'trade',
    passive: { id: 'company_ship', name: 'Company Ship', description: 'A company\'s hull and a company\'s men: wages a tenth less, and perishables spoil a fifth slower.', mods: { wages: -0.1, spoilage: -0.2 } },
  }),
  manila_galleon: ship({
    id: 'manila_galleon', name: 'Manila Galleon', tier: 5, rig: 'square', role: 'The great galleon of the long ocean run, laden with silk, porcelain and silver.',
    length: 56, beam: 15, hull: 6000, armor: 0.24, maxSpeed: 10.5, accel: 0.8, turnRate: 9, draft: 5.8,
    holdVolume: 500, holdWeight: 600, crewMin: 90, crewMax: 300, gunPortsPerSide: 14, bowChasers: 2, sternChasers: 2,
    sailHp: 270, repairRate: 0.85, detection: 1400, price: 78000, purchasable: true, sprite: 'ship.manila_galleon', list: 'trade',
    passive: { id: 'long_run', name: 'Long Run', description: 'A thrifty purser for a half-year passage: provisions last a fifth longer and wages are a tenth less.', mods: { provisionUse: -0.2, wages: -0.1 } },
  }),
  polacre: ship({
    id: 'polacre', name: 'Polacre', tier: 4, rig: 'mixed', role: 'A Mediterranean three-master on pole masts: her sails are set and struck from the deck in a moment.',
    length: 38, beam: 9, hull: 3200, armor: 0.1, maxSpeed: 17.5, accel: 1.9, turnRate: 18, draft: 3.4,
    holdVolume: 100, holdWeight: 110, crewMin: 50, crewMax: 160, gunPortsPerSide: 9, bowChasers: 2, sternChasers: 1,
    sailHp: 210, repairRate: 1.1, detection: 1650, price: 36000, purchasable: true, sprite: 'ship.polacre', list: 'fast',
    passive: { id: 'pole_masts', name: 'Pole Masts', description: 'Masts of a single spar and no tops: sails are set and struck 30% faster, and +10% acceleration.', mods: { sailChangeRate: 0.3, accel: 0.1 } },
  }),
  dunkirk_frigate: ship({
    id: 'dunkirk_frigate', name: 'Dunkirk Frigate', tier: 4, rig: 'square', role: 'A long, low privateer frigate of the Flemish banks, built light to run prizes down and outrun cruisers.',
    length: 42, beam: 10, hull: 3600, armor: 0.12, maxSpeed: 17, accel: 1.7, turnRate: 16, draft: 3.8,
    holdVolume: 110, holdWeight: 130, crewMin: 70, crewMax: 220, gunPortsPerSide: 12, bowChasers: 2, sternChasers: 2,
    sailHp: 230, repairRate: 1.05, detection: 1700, price: 38000, purchasable: true, sprite: 'ship.dunkirk_frigate', list: 'fast',
    passive: { id: 'light_scantlings', name: 'Light Scantlings', description: 'Light frames and fine lines: she bleeds a fifth less way in a hard turn, and a heavy sea slows her a fifth less.', mods: { turnDrag: -0.2, seaPenalty: -0.2 } },
  }),
  great_xebec: ship({
    id: 'great_xebec', name: 'Great Xebec', tier: 5, rig: 'fore_aft', role: 'A three-masted war xebec of the corsair coasts: thirty-odd guns, three great lateens and a bank of sweeps.',
    length: 46, beam: 10, hull: 4800, armor: 0.14, maxSpeed: 16.5, accel: 1.9, turnRate: 16, draft: 3.6,
    holdVolume: 120, holdWeight: 140, crewMin: 120, crewMax: 340, gunPortsPerSide: 14, bowChasers: 3, sternChasers: 1,
    sailHp: 250, repairRate: 1.05, detection: 1700, price: 64000, purchasable: true, sprite: 'ship.great_xebec', list: 'fast',
    passive: { id: 'sweeps', name: 'Great Sweeps', description: '+25% speed in winds under half strength; oars give at least 3 m/s on any heading, even head to wind.' },
  }),
  race_galleon: ship({
    id: 'race_galleon', name: 'Race-built Galleon', tier: 5, rig: 'square', role: 'A galleon razed low fore and aft and long for her beam: a great ship on a runner\'s lines.',
    length: 52, beam: 12, hull: 5400, armor: 0.18, maxSpeed: 16, accel: 1.4, turnRate: 13.5, draft: 4.6,
    holdVolume: 150, holdWeight: 180, crewMin: 140, crewMax: 380, gunPortsPerSide: 16, bowChasers: 2, sternChasers: 2,
    sailHp: 280, repairRate: 0.95, detection: 1700, price: 70000, purchasable: true, sprite: 'ship.race_galleon', list: 'fast',
    passive: { id: 'low_castles', name: 'Low Castles', description: 'Her castles razed: her signature is a tenth smaller, and a heavy sea slows her a quarter less.', mods: { signature: -0.1, seaPenalty: -0.25 } },
  }),
  armed_fluyt: ship({
    id: 'armed_fluyt', name: 'Armed Fluyt', tier: 3, rig: 'square', role: 'A fluyt pierced for guns on her upper deck: a navy\'s transport, armed en flûte.',
    length: 40, beam: 12, hull: 3100, armor: 0.15, maxSpeed: 10.5, accel: 0.85, turnRate: 10, draft: 4.2,
    holdVolume: 400, holdWeight: 470, crewMin: 30, crewMax: 110, gunPortsPerSide: 6, bowChasers: 1, sternChasers: 2,
    sailHp: 170, repairRate: 0.85, detection: 1250, price: 17500, purchasable: true, sprite: 'ship.armed_fluyt', list: 'hauler',
    passive: { id: 'pierced_for_guns', name: 'Pierced for Guns', description: 'A transport that can fight back: her chasers hit 25% harder and train 15° wider.', mods: { chaserDamage: 0.25, chaserArc: 15 } },
  }),

  // ------------------------------------------------------------------ the third batch (owner, 2026-10-04)
  // «Еще больше … кораблей» (owner, 2026-10-04): eight more hulls for doubloons, two a list, at the tiers where her
  // list's premium choice was thinnest — the warships had none below the third tier, the traders none at the first or
  // the fifth, the runners one at the first and none at the fifth, the haulers none below the fourth. Each a good hull
  // of her tier and of her list's trade, not a giant; each with a gift of one of the seven kinds (shipgifts.ts) and a
  // creature kind of her own (shipbeasts.ts); none sold for silver (`price` is her reckoning for salvage and repairs).
  bulldog: ship({
    id: 'bulldog', name: 'Bulldog', tier: 1, rig: 'fore_aft', role: 'A stubby, broad little gun-sloop with a heavy bow chaser and spiked iron-bound bulwarks.',
    length: 20, beam: 7, hull: 1100, armor: 0.1, maxSpeed: 14, accel: 1.9, turnRate: 21, draft: 2.0,
    holdVolume: 24, holdWeight: 32, crewMin: 10, crewMax: 36, gunPortsPerSide: 3, bowChasers: 2, sternChasers: 1,
    sailHp: 100, repairRate: 1.1, detection: 1400, price: 2000, purchasable: false, sprite: 'ship.bulldog', list: 'combat',
    passive: { id: 'spiked_bulwarks', name: 'Spiked Bulwarks', description: 'Iron-bound bulwarks bristling with spikes: boarders find her 20% harder to take.', mods: { boardingNets: 0.2 } },
    premium: { price: 500, note: ['The smallest warship of them: a stubby gun-sloop, and her war mastiffs go over the rail first.', 'Самый маленький из боевых: коренастый пушечный шлюп, и её боевые мастифы первыми прыгают через борт.'], beasts: [{ u: 'war_mastiff', n: 8 }] },
  }),
  saint_elmo: ship({
    id: 'saint_elmo', name: 'Saint Elmo', tier: 2, rig: 'square', role: 'A navy brig-sloop with copper-sheathed masts on which the corposant burns blue in every storm.',
    length: 28, beam: 8, hull: 1800, armor: 0.12, maxSpeed: 15.5, accel: 1.9, turnRate: 19, draft: 2.9,
    holdVolume: 40, holdWeight: 52, crewMin: 30, crewMax: 90, gunPortsPerSide: 7, bowChasers: 2, sternChasers: 1,
    sailHp: 150, repairRate: 1.0, detection: 1550, price: 7600, purchasable: false, sprite: 'ship.saint_elmo', list: 'combat',
    passive: { id: 'copper_masts', name: 'Copper-sheathed Masts', description: 'Copper down her masts and a crew that takes the blue fire for a blessing: storms bite 20% less into her hull, and morale falls 10% slower.', mods: { stormHull: -0.2, moraleLoss: -0.1 } },
    premium: { price: 800, note: ['A navy brig-sloop that the saint\'s blue fire keeps: when she bleeds, her guns run hot.', 'Флотский бриг-шлюп под защитой голубого огня святого: когда ей худо, её пушки раскаляются.'], beasts: [{ u: 'corposant', n: 8 }] },
  }),
  lantern_sampan: ship({
    id: 'lantern_sampan', name: 'Lantern Sampan', tier: 1, rig: 'fore_aft', role: 'A small eastern river trader under a batten sail, a woven bamboo cabin hung with red paper lanterns.',
    length: 18, beam: 6, hull: 850, armor: 0.03, maxSpeed: 14.5, accel: 1.9, turnRate: 20, draft: 1.3,
    holdVolume: 105, holdWeight: 110, crewMin: 6, crewMax: 20, gunPortsPerSide: 1, bowChasers: 1, sternChasers: 0,
    sailHp: 95, repairRate: 1.15, detection: 1350, price: 1600, purchasable: false, sprite: 'ship.lantern_sampan', list: 'trade',
    passive: { id: 'shallow_runner', name: 'River Keel', description: 'A flat river keel: she crosses reefs and shoals that tear the keel out of bigger ships, and a bowl of rice keeps her crew — provisions last 15% longer.', mods: { provisionUse: -0.15 } },
    premium: { price: 400, note: ['A river trader of the lanterns, her fishing cormorants on the cabin roof.', 'Речной торговец под фонарями, с ручными бакланами на крыше каюты.'], beasts: [{ u: 'cormorant', n: 6 }] },
  }),
  golden_lion: ship({
    id: 'golden_lion', name: 'Golden Lion', tier: 5, rig: 'fore_aft', role: 'A gilded great merchant galleass of the lagoon republic, a winged lion at her bow, three lateens and banks of oars.',
    length: 52, beam: 13, hull: 5800, armor: 0.22, maxSpeed: 11.5, accel: 0.95, turnRate: 10, draft: 5.0,
    holdVolume: 480, holdWeight: 560, crewMin: 120, crewMax: 360, gunPortsPerSide: 12, bowChasers: 3, sternChasers: 2,
    sailHp: 260, repairRate: 0.85, detection: 1450, price: 82000, purchasable: false, sprite: 'ship.golden_lion', list: 'trade',
    passive: { id: 'sweeps', name: 'Free Rowers', description: '+25% speed in winds under half strength; oars give at least 3 m/s on any heading; her rowers are free men of the lagoon, paid 10% less.', mods: { wages: -0.1 } },
    premium: { price: 3400, note: ['The merchant republic\'s great galleass: every port deals with her on better terms.', 'Великая галеаса торговой республики: каждый порт торгует с ней на лучших условиях.'], beasts: [{ u: 'winged_lion', n: 3 }] },
  }),
  dolphin: ship({
    id: 'dolphin', name: 'Dolphin', tier: 1, rig: 'fore_aft', role: 'A slim lateen-rigged felucca with a dolphin carved at her bow and dolphins riding her bow wave.',
    length: 18, beam: 5, hull: 820, armor: 0.03, maxSpeed: 18.5, accel: 2.8, turnRate: 27, draft: 1.5,
    holdVolume: 28, holdWeight: 28, crewMin: 8, crewMax: 24, gunPortsPerSide: 2, bowChasers: 1, sternChasers: 1,
    sailHp: 95, repairRate: 1.2, detection: 1500, price: 1700, purchasable: false, sprite: 'ship.dolphin', list: 'fast',
    passive: { id: 'dolphin_lines', name: 'Dolphin Lines', description: 'A hull shaped like a dolphin\'s back: a heavy sea slows her 20% less.', mods: { seaPenalty: -0.2 } },
    premium: { price: 420, note: ['A slim felucca the dolphins love: in open water they carry her along.', 'Стройная фелука, которую любят дельфины: в открытом море они несут её вперёд.'], beasts: [{ u: 'dolphin_pod', n: 6 }] },
  }),
  sailfish: ship({
    id: 'sailfish', name: 'Sailfish', tier: 5, rig: 'mixed', role: 'A long razor-bowed war frigate under a great fan of a mainsail, built to run down anything that floats.',
    length: 52, beam: 11, hull: 5000, armor: 0.15, maxSpeed: 17, accel: 1.6, turnRate: 14, draft: 4.4,
    holdVolume: 140, holdWeight: 160, crewMin: 120, crewMax: 360, gunPortsPerSide: 15, bowChasers: 2, sternChasers: 2,
    sailHp: 290, repairRate: 1.0, detection: 1750, price: 74000, purchasable: false, sprite: 'ship.sailfish', list: 'fast',
    passive: { id: 'sail_fin', name: 'Sail-fin Rig', description: 'A great fan of a mainsail like a sailfish\'s fin: sails are set and struck 25% faster, and a heavy sea slows her 20% less.', mods: { sailChangeRate: 0.25, seaPenalty: -0.2 } },
    premium: { price: 3400, note: ['The fastest of the great runners: her balls run a ship through, and blue marlins hunt in her wake.', 'Самый быстрый из больших бегунов: её ядра пронзают корабль, а в её кильватере охотятся синие марлины.'], beasts: [{ u: 'marlin', n: 3 }] },
  }),
  mimic_barge: ship({
    id: 'mimic_barge', name: 'Mimic Barge', tier: 2, rig: 'square', role: 'A broad, crooked cargo barge whose hold is full of barrels that are not all barrels.',
    length: 32, beam: 11, hull: 2100, armor: 0.1, maxSpeed: 10.5, accel: 0.9, turnRate: 11, draft: 3.2,
    holdVolume: 330, holdWeight: 380, crewMin: 14, crewMax: 50, gunPortsPerSide: 3, bowChasers: 0, sternChasers: 1,
    sailHp: 125, repairRate: 0.9, detection: 1150, price: 7400, purchasable: false, sprite: 'ship.mimic_barge', list: 'hauler',
    passive: { id: 'deep_hold', name: 'Hold of Odd Corners', description: 'A crooked hold full of odd corners: cargo is 50% less likely to be destroyed by hull hits, and contraband takes 15% less room.', mods: { contrabandVolumeMul: -0.15 } },
    premium: { price: 700, note: ['A barge with a living cargo: her cask mimics breed back in the hold.', 'Баржа с живым грузом: её бочки-мимики снова заводятся в трюме.'], beasts: [{ u: 'cask_mimic', n: 6 }] },
  }),
  icebound_hulk: ship({
    id: 'icebound_hulk', name: 'Icebound Hulk', tier: 3, rig: 'square', role: 'A broad northern hulk sheathed in ice that never melts, frost on her rigging and white bears on her deck.',
    length: 40, beam: 13, hull: 3400, armor: 0.18, maxSpeed: 9.5, accel: 0.8, turnRate: 9.5, draft: 4.4,
    holdVolume: 400, holdWeight: 460, crewMin: 30, crewMax: 110, gunPortsPerSide: 5, bowChasers: 1, sternChasers: 1,
    sailHp: 170, repairRate: 0.85, detection: 1250, price: 18500, purchasable: false, sprite: 'ship.icebound_hulk', list: 'hauler',
    passive: { id: 'ice_hold', name: 'Ice in the Hold', description: 'Her hold is packed with ice that never melts: perishables spoil 40% slower, and her iced bow takes 20% less from a ram.', mods: { spoilage: -0.4, ramTaken: -0.2 } },
    premium: { price: 1100, note: ['A hulk of the frozen north: frost falls on every ship that fights her.', 'Халк ледяного севера: на каждый корабль, что бьётся с ней, ложится изморозь.'], beasts: [{ u: 'ice_bear', n: 4 }] },
  }),

  // The zone bosses (owner, 2026-10-04; docs/21): one great warship for each sea, rising every twelve hours by the
  // server's clock and sailing her sea for an hour. Guns only: her decks cannot be taken. Hull and armour from the
  // squad sim (tests/zonebosses.test.ts).
  zb_black_coast: zoneBoss('zb_black_coast', 'The Iron Lion', 2, 'A rogue privateer man-of-war of three gun decks, her black hull banded with rusted iron, a crowned lion on her bow.', ZB_HULL.zb_black_coast, 0.2, 24, 'Lion of the Coast', 'Her decks cannot be taken: only her guns answer, at every ship that fires on her.'),
  zb_gravewater: zoneBoss('zb_gravewater', 'The Gilded Leviathan', 3, 'A monstrous armed treasure galleon of the trade routes: a gilded stern gallery, four masts of dark sails, brass swivels crowding her rails.', ZB_HULL.zb_gravewater, 0.22, 26, 'Gilded Gallery', 'Her decks cannot be taken: only her guns answer, at every ship that fires on her.'),
  zb_whispering: zoneBoss('zb_whispering', 'The Fog Mother', 3, "A huge black smugglers' ship of the line under charcoal sails, dozens of dim green lanterns along her rails.", ZB_HULL.zb_whispering, 0.22, 26, 'Mother of Fogs', 'Her decks cannot be taken: only her guns answer, at every ship that fires on her.'),
  zb_leviathan_reach: zoneBoss('zb_leviathan_reach', 'The White Harrow', 3, 'An ice-armoured whaling dreadnought: plates of white ice along her hull, rows of harpoon guns and a great ram at her bow.', ZB_HULL.zb_leviathan_reach, 0.24, 28, 'Ice Plating', 'Her decks cannot be taken: only her guns answer, at every ship that fires on her.'),
  zb_ashen_isles: zoneBoss('zb_ashen_isles', 'The Cinder Throne', 4, 'A colossal fire-galleon of the volcanic isles: forges glowing on her deck, squat mortars in iron rings, smoke-blackened sails.', ZB_HULL.zb_ashen_isles, 0.25, 30, 'Forge Deck', 'Her decks cannot be taken: only her guns answer, at every ship that fires on her.'),
  zb_dead_mans_expanse: zoneBoss('zb_dead_mans_expanse', 'The Stitched Hulk', 4, 'A vast patchwork hulk stitched together from wrecks lashed side by side: crooked masts and mismatched sails.', ZB_HULL.zb_dead_mans_expanse, 0.26, 32, 'Many Hulls', 'Her decks cannot be taken: only her guns answer, at every ship that fires on her.'),
  zb_drowned_crown: zoneBoss('zb_drowned_crown', 'The Drowned Regent', 5, 'An ancient royal galleon risen from the sea, her hull crusted with grey coral, water pouring from her gun ports, torn purple and gold banners.', ZB_HULL.zb_drowned_crown, 0.28, 34, 'Coral Crust', 'Her decks cannot be taken: only her guns answer, at every ship that fires on her.'),
  zb_the_abyss: zoneBoss('zb_the_abyss', 'The Abyssal Ark', 5, 'A colossal black three-masted ark with pale green lights in her gun ports and sails like grey smoke.', ZB_HULL.zb_the_abyss, 0.3, 36, 'Ark of the Deep', 'Her decks cannot be taken: only her guns answer, at every ship that fires on her.'),

  leviathan: monster('leviathan', 'Leviathan', 'The oldest hunger in the Reach.', 118, 26, 60000, 0.25, 16, 'Gills that open only while the harpoons hold it.'),
  kraken: monster('kraken', 'Kraken', 'A mantle the size of a harbour; the arms do the killing.', 46, 34, 30000, 0.2, 5, 'The body opens once four arms are cut away.'),
  kraken_tentacle: monster('kraken_tentacle', 'Kraken Arm', 'An arm of the Kraken. It grips, it drags, it drowns.', 44, 6, 2600, 0.05, 0, 'Cut it away to free the ship it holds.'),
  drowned_whale: monster('drowned_whale', 'The Drowned Whale', 'A rotting colossus with a drowned town on its back.', 112, 30, 52000, 0.2, 3, 'In its last hour only boarders can reach its heart.'),
  whale_heart: monster('whale_heart', 'Heart of the Whale', 'The black heart in the drowned town, and the dead who guard it.', 14, 10, 9000, 0.9, 0, 'Board it: cannon cannot reach it.'),
  lantern_maw: monster('lantern_maw', 'The Lantern Maw', 'A great angler in the dark. Its lights lie.', 70, 44, 26000, 0.15, 11, 'Lanterns draw it; inside it, every gun hits thrice.'),
  black_serpent: monster('black_serpent', 'The Black Serpent', 'Coils like a sea wall; bile that eats canvas.', 150, 12, 36000, 0.2, 19, 'It flees through shoals where only small ships follow.'),
  mother_of_wrecks: monster('mother_of_wrecks', 'Mother of Wrecks', 'A living reef of a thousand wrecks — a hermit crab the size of an island.', 150, 120, 70000, 0.35, 0, 'Its cores lie in a maze only shallow keels can enter.'),
  wreck_core: monster('wreck_core', 'Wreck Core', 'A pulsing heart of the reef, deep in the maze.', 12, 12, 6000, 0.1, 0, 'Reachable only from within the maze.'),
  abyss_eye: monster('abyss_eye', 'The Eye of the Abyss', 'A hole in the sea that looks back.', 110, 110, 120000, 0.3, 0, 'It can only be hurt from its rim once it has begun to fall.'),
  hulk: monster('hulk', 'Rotten Hulk', 'A dead ship wedged in the graveyard. Mortars bring it down.', 44, 12, 1800, 0.55, 0, 'Cannon glance off its sodden timbers; bombs break it.'),
  orca: monster('orca', 'Orca', 'A pack hunter of the cold seas: it goes for the rudder and the boats.', 8, 2.6, 320, 0.05, 16, 'A pod loses heart when half of it is gone.'),
  white_orca: monster('white_orca', 'The White Orca', 'A scarred white queen of the Reach; she rams and dives under keels.', 11, 3.2, 6600, 0.1, 17, 'She calls her pod when she is hurt.'),
  humpback: monster('humpback', 'Humpback Whale', 'A great slow singer of the warm seas. It flees a loud ship.', 15, 4.4, 2100, 0.1, 8, 'Shy: a quiet approach or none.'),
  sperm_whale: monster('sperm_whale', 'Sperm Whale', 'A blunt-headed giant of the open sea. Harpooned, it turns and rams.', 18, 5, 2200, 0.15, 9, 'Rams the boat that struck it; ambergris in one of twelve.'),
  narwhal: monster('narwhal', 'Narwhal', 'A spotted whale of the ice with a spiral tusk.', 5, 1.4, 480, 0.05, 11, 'The tusk goes through planking.'),
  shark: monster('shark', 'Shark', 'Comes to blood. Takes men from the water.', 5, 1.2, 250, 0.05, 12, 'Blood in the water brings more.'),
  young_serpent: monster('young_serpent', 'Young Sea Serpent', 'Not yet the size of its mother. Big enough to coil round a brig.', 30, 3, 2400, 0.2, 13, 'Its coils crush a hull caught in them.'),
  storm_widow: monster('storm_widow', 'The Storm Widow', 'A widow of wind and lightning walking on the waves.', 60, 60, 40000, 0.2, 6, 'She can only be hurt from inside the moving eye.'),
  ...BOSS_MONSTERS,
};

export const SHIP_CLASS_IDS = Object.keys(SHIP_CLASSES) as ShipClassId[];

// ---------------------------------------------------------------- Artillery

export type GunId = 'light_6' | 'long_9' | 'medium_12' | 'heavy_18' | 'carronade_24'
  // The yard's wider battery (owner, 2026-10-03): each a gun with a trade of its own, not a bigger number.
  | 'minion_4' | 'perrier' | 'culverin_8' | 'whaling_gun' | 'gunbreaker_14' | 'shell_gun' | 'drowned_bronze' | 'demi_cannon_32';

export interface GunDef {
  id: GunId;
  name: string;
  damage: number;
  range: number;
  reload: number; // seconds with a full gun crew
  spreadDeg: number;
  weight: number;
  crewPerGun: number;
  price: number;
  minTier: number;
  description: string;
  /** Cast only by the yards of these factions (absent: any yard of its rank). */
  factions?: string[];
  // What sets a gun apart, on every ball of its broadside:
  /** share of the target's armour the ball ignores */
  pierce?: number;
  /** men struck down a ball, × */
  crewMul?: number;
  /** canvas torn a ball, × */
  sailMul?: number;
  /** chance a hull hit starts a fire (any shot but grape and chain) */
  fire?: number;
  /** extra chance a round shot dismounts a gun (a heavy shot: this alone) */
  dismount?: number;
  /** morale the target loses a hit, over the shot's own */
  morale?: number;
  /** damage × against monsters, beasts and the dead */
  monster?: number;
  /** the ball flies this much faster: less drift, less lead */
  shotSpeed?: number;
}

export const GUNS: Record<GunId, GunDef> = {
  light_6: { id: 'light_6', name: '6-pdr Gun', damage: 40, range: 320, reload: 8, spreadDeg: 3.5, weight: 1, crewPerGun: 3, price: 300, minTier: 1, description: 'Light, quick, cheap.' },
  long_9: { id: 'long_9', name: '9-pdr Long Gun', damage: 46, range: 460, reload: 10, spreadDeg: 2, weight: 1.5, crewPerGun: 4, price: 700, minTier: 1, description: 'Long barrel, long reach, accurate.' },
  medium_12: { id: 'medium_12', name: '12-pdr Gun', damage: 60, range: 380, reload: 11, spreadDeg: 3, weight: 2, crewPerGun: 5, price: 1000, minTier: 2, description: 'The workhorse of every navy.' },
  heavy_18: { id: 'heavy_18', name: '18-pdr Gun', damage: 80, range: 400, reload: 13.5, spreadDeg: 3, weight: 3, crewPerGun: 6, price: 1800, minTier: 3, description: 'Hull-breaker. Heavy and slow.' },
  carronade_24: { id: 'carronade_24', name: '24-pdr Carronade', damage: 110, range: 220, reload: 10, spreadDeg: 5, weight: 1.6, crewPerGun: 4, price: 1200, minTier: 2, description: 'Smasher. Devastating at pistol range, useless beyond it.' },
  minion_4: { id: 'minion_4', name: '4-pdr Minion', damage: 26, range: 300, reload: 5.5, spreadDeg: 3.8, weight: 0.6, crewPerGun: 2, price: 200, minTier: 1, description: 'A little gun two hands can serve: quick to load and light on the deck, for a ship short of men.' },
  perrier: { id: 'perrier', name: 'Stone Perrier', damage: 30, range: 260, reload: 8.5, spreadDeg: 5, weight: 1, crewPerGun: 3, price: 450, minTier: 1, factions: ['free', 'confederacy', 'brokers'], crewMul: 1.4, sailMul: 1.5, description: 'Throws stone shot that shatters on the side: men struck down ×1.4 and canvas torn ×1.5 a ball, the hull barely scratched. Cast in the free ports.' },
  culverin_8: { id: 'culverin_8', name: '8-pdr Culverin', damage: 36, range: 560, reload: 12, spreadDeg: 1.4, weight: 2, crewPerGun: 4, price: 1300, minTier: 2, shotSpeed: 0.25, description: 'A long, slender bore: the longest reach of any gun, and the ball flies 25% faster (less drift, less lead). A light ball, slow to load.' },
  whaling_gun: { id: 'whaling_gun', name: 'Bomb-Lance Gun', damage: 52, range: 340, reload: 11, spreadDeg: 3, weight: 1.8, crewPerGun: 4, price: 1400, minTier: 2, factions: ['harpoon', 'free'], monster: 1.5, description: "The Order's whaling gun: 1.5 times the damage against monsters, beasts and the dead, a little light against a ship's oak." },
  gunbreaker_14: { id: 'gunbreaker_14', name: '14-pdr Gunbreaker', damage: 58, range: 340, reload: 12, spreadDeg: 3, weight: 2.2, crewPerGun: 5, price: 1700, minTier: 3, factions: ['crown', 'league'], dismount: 0.12, description: 'Short and stout, laid low across the enemy gun deck: round shot dismounts a gun three times as often (+12% a hit).' },
  shell_gun: { id: 'shell_gun', name: 'Shell Gun', damage: 66, range: 360, reload: 14, spreadDeg: 3.2, weight: 2.6, crewPerGun: 6, price: 2400, minTier: 3, factions: ['crown', 'confederacy'], fire: 0.06, description: 'Fires hollow shells packed with powder: 6% of hull hits start a fire, with any shot but grape and chain.' },
  drowned_bronze: { id: 'drowned_bronze', name: 'Drowned Bronze', damage: 60, range: 380, reload: 12, spreadDeg: 3.2, weight: 2.2, crewPerGun: 4, price: 2600, minTier: 2, factions: ['choir'], morale: 1.2, description: "Bronze raised from the Choir's wrecks, green with the sea: each hit costs her crew 1.2 more morale, and four hands serve a gun." },
  demi_cannon_32: { id: 'demi_cannon_32', name: '32-pdr Demi-Cannon', damage: 118, range: 380, reload: 17.5, spreadDeg: 3.4, weight: 4.4, crewPerGun: 8, price: 3600, minTier: 4, pierce: 0.25, description: 'The heaviest long gun afloat: its ball ignores a quarter of any armour. Eight hands a gun, and the weight of a small chapel.' },
};

export const GUN_IDS = Object.keys(GUNS) as GunId[];

export type AmmoId = 'round' | 'chain' | 'grape' | 'incendiary' | 'heavy' | 'cursed'
  // The rarer shot (owner, 2026-10-03): after the six, so the keys 1–5 and the order on the wire stay as they were.
  | 'bar' | 'long_shot' | 'star' | 'salt' | 'stinkpot' | 'drag';

export interface AmmoDef {
  id: AmmoId;
  name: string;
  hullMul: number;
  sailMul: number;
  crewKill: number; // crew killed per ball hit (before modifiers)
  rangeMul: number;
  speed: number; // m/s
  price: number; // per shot
  weightPer10: number;
  /** Reload time multiplier (docs/02 §4.A.2). */
  reloadMul?: number;
  /** Sold only where one of these holds (absent: in every port): a port of these factions, a yard of this rank, a black market. */
  sold?: { factions?: string[]; yard?: number; black?: boolean };
  description: string;
}

export const AMMO: Record<AmmoId, AmmoDef> = {
  round: { id: 'round', name: 'Round Shot', hullMul: 1, sailMul: 0.08, crewKill: 0.5, rangeMul: 1, speed: 190, price: 2, weightPer10: 0.5, description: 'Solid iron. Breaks hulls.' },
  chain: { id: 'chain', name: 'Chain Shot', hullMul: 0.25, sailMul: 0.45, crewKill: 0.25, rangeMul: 0.72, speed: 160, price: 4, weightPer10: 0.5, description: 'Two balls on a chain. Shreds sails and rigging.' },
  grape: { id: 'grape', name: 'Grapeshot', hullMul: 0.12, sailMul: 0.06, crewKill: 2.4, rangeMul: 0.55, speed: 170, price: 3, weightPer10: 0.5, description: 'A bag of musket balls. Clears decks before a boarding.' },
  incendiary: { id: 'incendiary', name: 'Fire Shot', hullMul: 0.55, sailMul: 0.2, crewKill: 0.4, rangeMul: 0.8, speed: 175, price: 9, weightPer10: 0.6, description: 'Heated shot and pitch pots. A quarter of hull hits start a fire. Dangerous to carry.' },
  heavy: { id: 'heavy', name: 'Heavy Shot', hullMul: 1.15, sailMul: 0.05, crewKill: 0.5, rangeMul: 0.85, speed: 170, price: 7, weightPer10: 0.9, description: 'Forged armour-piercing shot: ignores most of an armoured hull.' },
  cursed: { id: 'cursed', name: 'Cursed Shot', hullMul: 0.8, sailMul: 0.1, crewKill: 0.8, rangeMul: 1, speed: 180, price: 14, weightPer10: 0.6, reloadMul: 1.15, description: 'Iron cast in drowned moulds. Rot: the struck hull cannot be mended for 20 s; −3 morale a hit. The crew hates loading it (−1 morale a volley) and the Crown hates seeing it.' },
  bar: { id: 'bar', name: 'Bar Shot', hullMul: 0.5, sailMul: 0.3, crewKill: 0.35, rangeMul: 0.8, speed: 165, price: 5, weightPer10: 0.55, description: 'Two half-balls on an iron bar: it cuts rigging and still breaks planking, and a hit astern fouls the rudder twice as often.' },
  long_shot: { id: 'long_shot', name: 'Long Shot', hullMul: 0.75, sailMul: 0.06, crewKill: 0.35, rangeMul: 1.2, speed: 215, price: 4, weightPer10: 0.45, sold: { yard: 2 }, description: 'A lighter ball on a double wad: it carries 20% further and truer, and strikes a quarter softer.' },
  star: { id: 'star', name: 'Star Shot', hullMul: 0.35, sailMul: 0.12, crewKill: 0.2, rangeMul: 0.9, speed: 175, price: 8, weightPer10: 0.5, sold: { yard: 2 }, description: "A ball packed with a burning star: the ship it strikes burns bright for 20 s — her signature +50%, smoke and the dark no longer hide her, and every gunner's shot at her flies tighter for 10 s." },
  salt: { id: 'salt', name: 'Blessed Salt', hullMul: 0.6, sailMul: 0.06, crewKill: 0.4, rangeMul: 0.95, speed: 185, price: 10, weightPer10: 0.6, sold: { factions: ['choir', 'harpoon'] }, description: 'Iron crusted with salt the Choir has sung over: weak against a ship, but monsters, beasts and the dead take it 2.5 times as hard. Sold by the Choir and the Order.' },
  stinkpot: { id: 'stinkpot', name: 'Stinkpots', hullMul: 0.1, sailMul: 0.05, crewKill: 0.3, rangeMul: 0.6, speed: 150, price: 6, weightPer10: 0.6, sold: { factions: ['confederacy'], black: true }, description: 'Clay pots of sulphur and pitch: no damage to speak of, but her gun crews choke — her reloads run 30% slower for 6 s, and each pot costs her 2 morale.' },
  drag: { id: 'drag', name: 'Drag Shot', hullMul: 0.45, sailMul: 0.1, crewKill: 0.3, rangeMul: 0.7, speed: 160, price: 6, weightPer10: 0.7, sold: { factions: ['harpoon', 'free', 'confederacy'] }, description: 'A hooked ball on a short chain: it bites into her planking and trails in the water — she loses 15% of her way for 8 s.' },
};

export const AMMO_IDS: AmmoId[] = ['round', 'chain', 'grape', 'incendiary', 'heavy', 'cursed', 'bar', 'long_shot', 'star', 'salt', 'stinkpot', 'drag'];

/** Shot that answers to the number keys (1–5); cursed shot has its own key, the rarer kinds none. */
export const KEYED_AMMO = 5;

/** Fraction of target armour that an ammo type ignores. */
export const ARMOR_PIERCE: Partial<Record<AmmoId, number>> = { heavy: 0.6 };

export function emptyAmmo(): Record<AmmoId, number> {
  return { round: 0, chain: 0, grape: 0, incendiary: 0, heavy: 0, cursed: 0, bar: 0, long_shot: 0, star: 0, salt: 0, stinkpot: 0, drag: 0 };
}

/** Bow and stern chasers: long guns that fire along the keel, aimed within a cone. */
export const CHASER_GUN: GunId = 'long_9';
export const CHASER_CONE = (35 * Math.PI) / 180;
export const CHASER_RELOAD = 12;
export type ChaserEnd = 'bow' | 'stern';

// ---------------------------------------------------------------- Shipyard modules

export type ModuleId = 'hull_plating' | 'sail_plan' | 'rudder' | 'hold_expansion' | 'crew_quarters' | 'figurehead_kraken' | 'ghost_timbers'
  | 'choir_bell' | 'lightning_rod' | 'false_bulwark'
  // Plans taken from world bosses (docs/02 §11.A.4).
  | 'bone_culverin' | 'kraken_beak' | 'lantern_cannon' | 'serpent_scale' | 'crown_old_pattern' | 'galleass_sweeps' | 'storm_glass' | 'lantern_gland'
  // The yard's wider trade (owner, 2026-10-03): fittings for the gun deck, the well, the tops and the waist.
  | 'gun_carriages' | 'powder_hoists' | 'shot_furnace' | 'chain_pumps' | 'fire_engine' | 'carpenters_walk' | 'boarding_nets' | 'lookout_top'
  | 'galley' | 'magazine_lining' | 'iron_masts' | 'davits' | 'sail_locker' | 'bilge_keels' | 'mortar_bed'
  // And more plans out of the bosses' hoards.
  | 'leviathan_ribs' | 'ink_sacs' | 'serpent_spine' | 'drowned_gunlocks' | 'wreck_bulwarks' | 'tiller_chains' | 'eye_lantern' | 'maw_grapnels' | 'widow_ribbons';

export interface ModuleDef {
  id: ModuleId;
  name: string;
  maxLevel: number;
  baseCost: number; // multiplied by level and ship tier
  description: string;
  perLevel: { hullMul?: number; armorAdd?: number; speedMul?: number; sailHpMul?: number; turnMul?: number; holdMul?: number; crewMul?: number; boardingMul?: number; signature?: number };
  /** Not sold: fitted only from plans found at sea. */
  blueprint?: boolean;
  /** A yard of this rank or better fits it (Modular Refit: any yard). */
  yard?: number;
  /** Stat modifiers and switches per level, beyond the hull-shape lines above. */
  mods?: StatMods;
  flags?: Flag[];
}

export const MODULES: Record<ModuleId, ModuleDef> = {
  hull_plating: { id: 'hull_plating', name: 'Black Oak Plating', maxLevel: 3, baseCost: 900, description: 'Extra layer of black oak and iron knees. Tougher, slower.', perLevel: { hullMul: 0.08, armorAdd: 0.03, speedMul: -0.02 } },
  sail_plan: { id: 'sail_plan', name: 'Tailored Sail Plan', maxLevel: 3, baseCost: 800, description: 'Better canvas cut for this hull.', perLevel: { speedMul: 0.04, sailHpMul: 0.08 } },
  rudder: { id: 'rudder', name: 'Balanced Rudder', maxLevel: 2, baseCost: 700, description: 'Deeper, balanced rudder blade.', perLevel: { turnMul: 0.08 } },
  hold_expansion: { id: 'hold_expansion', name: 'Hold Expansion', maxLevel: 2, baseCost: 1000, description: 'Rebuilt bulkheads and orlop storage.', perLevel: { holdMul: 0.12, speedMul: -0.01 } },
  crew_quarters: { id: 'crew_quarters', name: 'Crew Quarters', maxLevel: 2, baseCost: 850, description: 'More hammocks, more hands.', perLevel: { crewMul: 0.12 } },
  ghost_timbers: { id: 'ghost_timbers', name: 'Ghost Timbers', maxLevel: 1, baseCost: 2200, blueprint: true, description: 'Pale wood from the boneyards of the Expanse, fitted to the plans of a ship that should not float. Light, quiet, uncanny.', perLevel: { speedMul: 0.04, sailHpMul: 0.1, signature: -0.06 } },
  choir_bell: { id: 'choir_bell', name: 'Choir Bell', maxLevel: 1, baseCost: 500, flags: ['choir_bell'], description: 'A bronze bell of the Choir on the forecastle. Its toll drowns the Song of the Drowned Whale for every ship within 400 m.', perLevel: {} },
  false_bulwark: { id: 'false_bulwark', name: 'False Bulwark', maxLevel: 1, baseCost: 900, flags: ['false_bulwark'], description: 'Painted canvas over the gun ports: to a pirate she is a fat merchant — a full hold draws the named ones — and her first broadside out of a minute\'s quiet strikes a quarter harder.', perLevel: {} },
  lightning_rod: { id: 'lightning_rod', name: 'Lightning Rod', maxLevel: 1, baseCost: 450, flags: ['lightning_rod'], description: 'Copper down the mainmast to the sea: lightning strikes do 60% less damage.', perLevel: {} },
  bone_culverin: { id: 'bone_culverin', name: 'Bone Culverins', maxLevel: 1, baseCost: 3800, blueprint: true, mods: { gunDamageMul: 0.06, rangeMul: 0.05 }, description: 'Barrels bored from leviathan bone, to plans taken from its hoard: +6% gun damage, +5% range.', perLevel: {} },
  kraken_beak: { id: 'kraken_beak', name: "Kraken's Beak", maxLevel: 1, baseCost: 3200, blueprint: true, mods: { ramDealt: 0.35, ramTaken: -0.2 }, description: 'The beak of a Kraken sheathed on the stem: rams +35%, ramming damage taken −20%.', perLevel: {} },
  lantern_cannon: { id: 'lantern_cannon', name: 'Lantern Cannon', maxLevel: 1, baseCost: 3400, blueprint: true, mods: { chaserDamage: 0.3, chaserArc: 0.2 }, description: 'Chasers cast around a glowing gland of the Maw: +30% chaser damage, wider arc.', perLevel: {} },
  serpent_scale: { id: 'serpent_scale', name: 'Serpent-Scale Belt', maxLevel: 1, baseCost: 3600, blueprint: true, mods: { leakInflow: -0.2 }, description: 'Scales of the Black Serpent nailed along the waterline: +6% armour, leaks −20%.', perLevel: { armorAdd: 0.06 } },
  crown_old_pattern: { id: 'crown_old_pattern', name: 'Old-Pattern Crown Frames', maxLevel: 1, baseCost: 3000, blueprint: true, description: "Frames drawn to the Admiralty's lost plans of Drey's day: +6% hull, +4% turning.", perLevel: { hullMul: 0.06, turnMul: 0.04 } },
  galleass_sweeps: { id: 'galleass_sweeps', name: 'Galleass Sweeps', maxLevel: 1, baseCost: 3000, blueprint: true, mods: { accel: 0.12 }, description: 'Old galleass oar-ports cut to plans found in the Mother of Wrecks: +12% acceleration, +3% speed.', perLevel: { speedMul: 0.03 } },
  storm_glass: { id: 'storm_glass', name: 'Storm Glass Sails', maxLevel: 1, baseCost: 3300, blueprint: true, mods: { stormSailDamage: -0.5 }, description: 'Canvas treated with storm glass of the Widow: storms tear half as much, +10% sail strength.', perLevel: { sailHpMul: 0.1 } },
  lantern_gland: { id: 'lantern_gland', name: 'Glowing Gland', maxLevel: 1, baseCost: 2600, blueprint: true, flags: ['lantern_gland'], mods: { detection: 0.12 }, description: 'The lure of the Lantern Maw hung at the bow: +12% sight; ghosts and monsters show on the chart at night.', perLevel: {} },
  figurehead_kraken: { id: 'figurehead_kraken', name: 'Kraken Figurehead', maxLevel: 1, baseCost: 2500, description: 'A carved horror on the bow. Enemy crews flinch when you close in.', perLevel: { boardingMul: 0.1 } },
  // The gun deck.
  gun_carriages: { id: 'gun_carriages', name: 'Truck Carriages', maxLevel: 2, baseCost: 900, mods: { gunTrain: 4 }, description: 'Iron-shod trucks and side tackles: the broadside trains 4° a level toward where you aim.', perLevel: {} },
  powder_hoists: { id: 'powder_hoists', name: 'Powder Hoists', maxLevel: 2, baseCost: 1100, mods: { reloadMul: -0.04, fireRisk: 0.1 }, description: 'Hoists from the magazine to the guns: reload −4% a level, but powder kept close to them — fire risk +10% a level.', perLevel: {} },
  shot_furnace: { id: 'shot_furnace', name: 'Shot Furnace', maxLevel: 1, baseCost: 1400, yard: 2, mods: { heatedShot: 0.06, fireRisk: 0.15 }, description: 'A brick furnace in the waist heats round shot red: 6% of round-shot hits on a hull start a fire; fire risk aboard +15%.', perLevel: {} },
  mortar_bed: { id: 'mortar_bed', name: 'Mortar Bed', maxLevel: 1, baseCost: 1500, yard: 2, flags: ['mortar_lore'], description: 'A timbered well amidships: any hull may carry a sea mortar, which reloads 20% faster and bursts a quarter wider.', perLevel: {} },
  // The well, the hold and damage control.
  chain_pumps: { id: 'chain_pumps', name: 'Chain Pumps', maxLevel: 2, baseCost: 700, mods: { leakInflow: -0.15 }, description: 'Chain pumps in the well: leaks let in 15% less water a level.', perLevel: {} },
  fire_engine: { id: 'fire_engine', name: 'Fire Engine', maxLevel: 2, baseCost: 650, mods: { fireRisk: -0.2 }, description: 'A hand-pumped engine and wet sand by every hatch: fires catch and burn 20% less a level.', perLevel: {} },
  carpenters_walk: { id: 'carpenters_walk', name: "Carpenter's Walk", maxLevel: 2, baseCost: 900, mods: { damageControl: 0.15 }, description: 'A passage along the inside of the waterline: breaches close, fires die and a shot-away rudder is mended 15% faster a level.', perLevel: {} },
  magazine_lining: { id: 'magazine_lining', name: 'Lined Magazine', maxLevel: 1, baseCost: 900, flags: ['sealed_magazine'], description: 'Copper sheet and wet felt round the powder room: the chance of her magazine going up −75%.', perLevel: {} },
  davits: { id: 'davits', name: 'Davits and Longboats', maxLevel: 1, baseCost: 500, mods: { lifeboats: 1 }, description: 'Two longboats in davits at the stern: when she sinks, 20% of the lawful cargo is saved and 30% fewer of her crew are lost.', perLevel: {} },
  // The tops, the rigging and the decks.
  boarding_nets: { id: 'boarding_nets', name: 'Boarding Nets', maxLevel: 1, baseCost: 700, mods: { boardingNets: 0.25 }, description: 'Nets triced up over the rails: the first ten seconds of an enemy boarding come 25% weaker.', perLevel: {} },
  lookout_top: { id: 'lookout_top', name: "Lookout's Top", maxLevel: 2, baseCost: 600, mods: { detection: 0.06, fogSight: 0.1 }, description: 'A railed top and a lookout who never sleeps: +6% sight, and +10% sight in fog, a level.', perLevel: {} },
  iron_masts: { id: 'iron_masts', name: 'Ironbound Masts', maxLevel: 1, baseCost: 1500, yard: 2, flags: ['ironbound_masts'], description: 'Iron hoops on every mast: no shot brings a mast down (the sails still suffer). −1% speed.', perLevel: { speedMul: -0.01 } },
  sail_locker: { id: 'sail_locker', name: 'Sail Locker', maxLevel: 1, baseCost: 800, flags: ['spare_rigging'], description: 'Spare canvas and cordage at hand: the sails are mended under fire at 30% of the pace.', perLevel: {} },
  bilge_keels: { id: 'bilge_keels', name: 'Bilge Keels', maxLevel: 2, baseCost: 700, mods: { seaPenalty: -0.25 }, description: 'Keels along the turn of her bilge: she rolls less, and a heavy sea slows her 25% less a level.', perLevel: {} },
  galley: { id: 'galley', name: 'Copper Galley', maxLevel: 2, baseCost: 600, mods: { provisionUse: -0.08, moraleRegen: 0.05 }, description: 'A copper stove and a cook who knows his trade: provisions last 8% longer and morale mends a little faster, a level.', perLevel: {} },
  // Plans out of the bosses' hoards.
  leviathan_ribs: { id: 'leviathan_ribs', name: 'Leviathan Ribs', maxLevel: 1, baseCost: 3600, blueprint: true, mods: { ramTaken: -0.25, bulkheads: 1 }, description: 'Frames doubled with the ribs of a leviathan: +5% hull, ramming damage taken −25%, and never more than two leaks open at once.', perLevel: { hullMul: 0.05 } },
  ink_sacs: { id: 'ink_sacs', name: 'Kraken Ink Sacs', maxLevel: 1, baseCost: 3000, blueprint: true, flags: ['kraken_ink'], description: 'Ink sacs of the Kraken in a tank under the bow: when her hull falls below 30% she vanishes in a black cloud — hidden, and half the shot at her flies wide, for 6 s. Once in 2 minutes.', perLevel: {} },
  serpent_spine: { id: 'serpent_spine', name: 'Serpent-Spine Keel', maxLevel: 1, baseCost: 3400, blueprint: true, mods: { turnDrag: -0.3 }, description: 'A keel stiffened with the spine of the Black Serpent: +6% turning, and she bleeds 30% less way in a hard turn.', perLevel: { turnMul: 0.06 } },
  drowned_gunlocks: { id: 'drowned_gunlocks', name: 'Drowned Gunlocks', maxLevel: 1, baseCost: 3500, blueprint: true, mods: { reloadMul: -0.05, doubleShotChance: 0.04 }, description: "Gunlocks taken off the Hollow Admiral's dead gun crews: reload −5%, and 4% of the balls fly double-shotted.", perLevel: {} },
  wreck_bulwarks: { id: 'wreck_bulwarks', name: 'Wreck-Plate Bulwarks', maxLevel: 1, baseCost: 3200, blueprint: true, mods: { strapping: 0.5 }, description: 'Plates of a hundred wrecks riveted along her sides: +4% armour, +4% hull, −2% speed; heavy shot finds her armour half again as hard.', perLevel: { armorAdd: 0.04, hullMul: 0.04, speedMul: -0.02 } },
  tiller_chains: { id: 'tiller_chains', name: 'Tiller Chains', maxLevel: 1, baseCost: 2800, blueprint: true, flags: ['iron_tiller'], description: 'The rudder hung on chains, to plans found in the Mother of Wrecks: it cannot be shot away, and whatever slows her turning is 40% weaker.', perLevel: {} },
  eye_lantern: { id: 'eye_lantern', name: 'Eye-Shard Lantern', maxLevel: 1, baseCost: 4000, blueprint: true, mods: { sanityLoss: -0.3, detection: 0.08 }, flags: ['fog_sense'], description: 'A shard of the Eye in a lantern at the masthead: sanity drains 30% slower, +8% sight, and in fog she sees half again as far.', perLevel: {} },
  maw_grapnels: { id: 'maw_grapnels', name: 'Maw-Tooth Grapnels', maxLevel: 1, baseCost: 2800, blueprint: true, mods: { matchSpeed: 0.5, ironGrip: 5 }, description: 'Grapnels forged round the teeth of the Lantern Maw: you may board at half again the closing speed, and once they bite she cannot cut free for 5 s.', perLevel: {} },
  widow_ribbons: { id: 'widow_ribbons', name: "Widow's Black Ribbons", maxLevel: 1, baseCost: 3000, blueprint: true, flags: ['second_wind'], description: "Black ribbons of the Storm Widow tied in the shrouds: when her hull falls below 30%, +25% speed and acceleration for 8 s, once in 90 s.", perLevel: {} },
};

export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

export function moduleCost(id: ModuleId, nextLevel: number, tier: number): number {
  return Math.round(MODULES[id].baseCost * nextLevel * (0.6 + tier * 0.4));
}

export function defaultGunFor(cls: ShipClassDef): GunId {
  if (cls.tier >= 3) return 'medium_12';
  return 'light_6';
}

// ---------------------------------------------------------------- Deck mounts (special weapons, right mouse)

export type MountId = 'mortar' | 'harpoon' | 'chain_gun' | 'abyssal_lance' | 'fire_charge'
  // More for the pivot (owner, 2026-10-03): guns, rockets, fire, nets, smoke, kegs and drums.
  | 'swivel_gun' | 'long_tom' | 'rocket_frame' | 'fire_siphon' | 'net_thrower' | 'smoke_pots' | 'powder_kegs' | 'war_drums';

export interface MountDef {
  id: MountId;
  name: string;
  minTier: number;
  minRange: number;
  range: number;
  reload: number;
  price: number;
  /** Only sold by ports of these factions (empty = any shipyard). */
  factions: string[];
  description: string;
}

export const MOUNTS: Record<MountId, MountDef> = {
  mortar: { id: 'mortar', name: 'Sea Mortar', minTier: 2, minRange: 250, range: 900, reload: 25, price: 3200, factions: [], description: 'Lobs a bomb at a point: 3 s flight, 55 m blast, heavy hull damage, poor accuracy at long range. Useless against ships that keep moving.' },
  harpoon: { id: 'harpoon', name: 'Harpoon Gun', minTier: 1, minRange: 0, range: 190, reload: 20, price: 1800, factions: ['harpoon', 'free', 'confederacy'], description: 'Whaler\'s harpoon on a cable: tethers the target for 20 s so it cannot escape. Sets up boardings. The line snaps if strained too long.' },
  chain_gun: { id: 'chain_gun', name: 'Swivel Chain Gun', minTier: 1, minRange: 0, range: 260, reload: 7, price: 1400, factions: [], description: 'A pivoting swivel that fires three chain balls in any direction. Uses chain shot from the hold.' },
  fire_charge: { id: 'fire_charge', name: 'Fire Charges', minTier: 99, minRange: 0, range: 0, reload: 999, price: 0, factions: ['__fixed__'], description: 'Tar, brushwood and powder. Light them and row away.' },
  abyssal_lance: { id: 'abyssal_lance', name: 'Abyssal Lance', minTier: 2, minRange: 0, range: 320, reload: 30, price: 6000, factions: ['choir'], description: 'A spine from the deep that answers to a cursed hull. A lance of cold light: hull and crew damage, terror. Needs curse stage 1+, deepens your curse.' },
  swivel_gun: { id: 'swivel_gun', name: 'Swivel Musketoons', minTier: 1, minRange: 0, range: 220, reload: 9, price: 1200, factions: [], description: 'Three musketoons on the rail that fire grape in any direction: they clear a deck before a boarding. Each blast takes 2 grapeshot from the hold.' },
  long_tom: { id: 'long_tom', name: 'Long Tom', minTier: 2, minRange: 0, range: 640, reload: 16, price: 2800, factions: [], description: 'One long, heavy gun on a pivot amidships: a single ball (130 damage) on any bearing out to 640 m. Takes round shot from the hold.' },
  rocket_frame: { id: 'rocket_frame', name: 'Rocket Frame', minTier: 2, minRange: 200, range: 800, reload: 30, price: 3600, factions: ['crown', 'confederacy'], description: 'Six war rockets fired at a point: they scatter over 90 m, each that strikes a ship does light damage and sets her afire one time in three. Poor against a single ship, cruel against a crowd.' },
  fire_siphon: { id: 'fire_siphon', name: 'Fire Siphon', minTier: 2, minRange: 0, range: 140, reload: 24, price: 3000, factions: ['confederacy', 'free'], description: 'A bronze siphon spraying burning oil in a 30° cone out to 140 m: every ship in it catches fire and loses men. Each spray burns 2 whale oil from the hold.' },
  net_thrower: { id: 'net_thrower', name: 'Net Thrower', minTier: 1, minRange: 0, range: 240, reload: 20, price: 1600, factions: ['harpoon', 'free', 'brokers'], description: 'Throws a weighted net into her rigging: for 8 s she loses 30% of her speed and 40% of her turning. No damage; works on beasts too.' },
  smoke_pots: { id: 'smoke_pots', name: 'Smoke Pots', minTier: 1, minRange: 0, range: 0, reload: 45, price: 1400, factions: ['brokers', 'free', 'confederacy'], description: 'Pots of wet straw and saltpetre lit along the rail: for 8 s she is hidden in the smoke, and for the first 4 half the shot at her flies wide. Fired where she lies.' },
  powder_kegs: { id: 'powder_kegs', name: 'Keg Droppers', minTier: 1, minRange: 0, range: 0, reload: 35, price: 1500, factions: ['free', 'confederacy', 'brokers'], description: 'Two kegs over the stern on short fuses: they burst 5 and 6 s later behind her (220 damage, 45 m), for whoever follows in her wake. Each pair takes 2 gunpowder from the hold.' },
  war_drums: { id: 'war_drums', name: 'War Drums', minTier: 1, minRange: 0, range: 0, reload: 60, price: 1000, factions: ['confederacy', 'free'], description: 'The drums beat to quarters: her crew +10 morale, +15% boarding and +10% in the melee for 15 s; every enemy within 300 m loses 6 morale.' },
};

export const MOUNT_IDS = Object.keys(MOUNTS) as MountId[];
