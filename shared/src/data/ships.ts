// Ship classes, artillery, ammunition and shipyard modules.
// Speeds are in game meters/second (the world is compressed ~6x relative to real nautical scale
// so a fast ship crosses the 96 km ocean in roughly 100 minutes).

import type { UnitId } from './army.ts';
import type { Flag, StatMods } from './stats.ts';

export type ShipClassId =
  | 'sloop' | 'cutter' | 'schooner' | 'brigantine' | 'fluyt' | 'brig' | 'frigate' | 'galleon' | 'man_o_war' | 'ghost_ship'
  | 'xebec' | 'bomb_ketch' | 'fireship' | 'fishing_ketch' | 'harpoon_whaler'
  // The beasts of the sea (docs/12 P4): monsters with a level like a ship's.
  | 'orca' | 'white_orca' | 'humpback' | 'sperm_whale' | 'narwhal' | 'shark' | 'young_serpent'
  // World bosses and their parts (docs/02 §11.A.4): never sold, never sailed by a captain.
  | 'leviathan' | 'kraken' | 'kraken_tentacle' | 'drowned_whale' | 'whale_heart' | 'lantern_maw' | 'black_serpent'
  | 'mother_of_wrecks' | 'wreck_core' | 'storm_widow'
  // PvE locations (expeditions.ts): the rotten hulks of a ship graveyard.
  | 'hulk'
  // The Abyss: the Eye at its heart.
  | 'abyss_eye';

export type Rig = 'square' | 'fore_aft' | 'mixed';

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
  passive: { id: string; name: string; description: string };
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
    sailHp: 100, repairRate: 1.2, detection: 1400, price: 1500, purchasable: true, sprite: 'ship.sloop',
    passive: { id: 'shallow_runner', name: 'Shallow Runner', description: 'Can cross reefs and shoals that tear the keel out of bigger ships.' },
  }),
  cutter: ship({
    id: 'cutter', name: 'Cutter', tier: 1, rig: 'fore_aft', role: 'Courier and interceptor.',
    length: 18, beam: 5, hull: 720, armor: 0.0, maxSpeed: 18.5, accel: 3.0, turnRate: 30, draft: 1.6,
    holdVolume: 20, holdWeight: 20, crewMin: 6, crewMax: 20, gunPortsPerSide: 2, bowChasers: 1, sternChasers: 0,
    sailHp: 90, repairRate: 1.2, detection: 1500, price: 1800, purchasable: true, sprite: 'ship.cutter',
    passive: { id: 'dispatch', name: 'Dispatch Runner', description: 'Courier contracts pay 20% more; +10% acceleration.' },
  }),
  schooner: ship({
    id: 'schooner', name: 'Schooner', tier: 2, rig: 'fore_aft', role: 'Best upwind sailer. Smuggler favourite.',
    length: 26, beam: 7, hull: 1300, armor: 0.05, maxSpeed: 17.5, accel: 2.3, turnRate: 22, draft: 2.4,
    holdVolume: 60, holdWeight: 62, crewMin: 12, crewMax: 40, gunPortsPerSide: 4, bowChasers: 1, sternChasers: 1,
    sailHp: 120, repairRate: 1.1, detection: 1500, price: 4800, purchasable: true, sprite: 'ship.schooner',
    passive: { id: 'weatherly', name: 'Weatherly', description: 'Loses 40% less speed when sailing close-hauled.' },
  }),
  brigantine: ship({
    id: 'brigantine', name: 'Brigantine', tier: 2, rig: 'mixed', role: 'All-round raider.',
    length: 30, beam: 8, hull: 1800, armor: 0.1, maxSpeed: 15.5, accel: 1.9, turnRate: 19, draft: 3.0,
    holdVolume: 80, holdWeight: 90, crewMin: 20, crewMax: 70, gunPortsPerSide: 6, bowChasers: 1, sternChasers: 1,
    sailHp: 140, repairRate: 1.0, detection: 1400, price: 7500, purchasable: true, sprite: 'ship.brigantine',
    passive: { id: 'raider_rig', name: 'Raider Rig', description: 'Boarding range +10%; changing sail level is 20% faster.' },
  }),
  fluyt: ship({
    id: 'fluyt', name: 'Fluyt', tier: 2, rig: 'square', role: 'Merchant hauler with an enormous hold.',
    length: 32, beam: 10, hull: 1700, armor: 0.05, maxSpeed: 11.5, accel: 1.2, turnRate: 13, draft: 3.4,
    holdVolume: 220, holdWeight: 260, crewMin: 14, crewMax: 50, gunPortsPerSide: 3, bowChasers: 0, sternChasers: 1,
    sailHp: 130, repairRate: 0.9, detection: 1200, price: 6800, purchasable: true, sprite: 'ship.fluyt',
    passive: { id: 'deep_hold', name: 'Deep Hold', description: 'Cargo is 50% less likely to be destroyed by hull hits.' },
  }),
  brig: ship({
    id: 'brig', name: 'Brig', tier: 3, rig: 'square', role: 'Sturdy warship.',
    length: 32, beam: 9, hull: 2400, armor: 0.15, maxSpeed: 14, accel: 1.6, turnRate: 17, draft: 3.4,
    holdVolume: 90, holdWeight: 110, crewMin: 30, crewMax: 110, gunPortsPerSide: 8, bowChasers: 2, sternChasers: 1,
    sailHp: 160, repairRate: 1.0, detection: 1400, price: 12500, purchasable: true, sprite: 'ship.brig',
    passive: { id: 'gun_brig', name: 'Gun Brig', description: 'Broadside reload 8% faster when both batteries are loaded.' },
  }),
  frigate: ship({
    id: 'frigate', name: 'Frigate', tier: 3, rig: 'square', role: 'The hunter.',
    length: 42, beam: 11, hull: 3400, armor: 0.2, maxSpeed: 14.5, accel: 1.4, turnRate: 15, draft: 4.2,
    holdVolume: 120, holdWeight: 150, crewMin: 60, crewMax: 220, gunPortsPerSide: 13, bowChasers: 2, sternChasers: 2,
    sailHp: 200, repairRate: 0.9, detection: 1700, price: 24000, purchasable: true, sprite: 'ship.frigate',
    passive: { id: 'hunter', name: 'Hunter', description: '+15% detection radius; targets you damaged are revealed on the minimap for 30s.' },
  }),
  galleon: ship({
    id: 'galleon', name: 'Galleon', tier: 4, rig: 'square', role: 'Floating fortress and treasure hauler.',
    length: 46, beam: 14, hull: 4800, armor: 0.25, maxSpeed: 10.5, accel: 0.9, turnRate: 10.5, draft: 5.2,
    holdVolume: 320, holdWeight: 400, crewMin: 60, crewMax: 260, gunPortsPerSide: 10, bowChasers: 2, sternChasers: 2,
    sailHp: 220, repairRate: 0.8, detection: 1300, price: 32000, purchasable: true, sprite: 'ship.galleon',
    passive: { id: 'castle', name: 'Stern Castle', description: 'Defenders gain +25% boarding power.' },
  }),
  man_o_war: ship({
    id: 'man_o_war', name: 'Man-o-War', tier: 5, rig: 'square', role: 'Ship of the line. Needs a small town of crew.',
    length: 58, beam: 16, hull: 7600, armor: 0.3, maxSpeed: 11.5, accel: 0.8, turnRate: 9, draft: 6.0,
    holdVolume: 130, holdWeight: 160, crewMin: 180, crewMax: 600, gunPortsPerSide: 20, bowChasers: 2, sternChasers: 2,
    sailHp: 300, repairRate: 0.7, detection: 1600, price: 90000, purchasable: true, sprite: 'ship.man_o_war',
    passive: { id: 'line', name: 'Ship of the Line', description: 'Immune to raking bonus damage from the bow.' },
  }),
  xebec: ship({
    id: 'xebec', name: 'Xebec', tier: 2, rig: 'fore_aft', role: 'Rare. Lateen-rigged corsair with sweeps: flies in light airs, rows through calms.',
    length: 30, beam: 7, hull: 1500, armor: 0.05, maxSpeed: 17, accel: 2.4, turnRate: 21, draft: 2.2,
    holdVolume: 55, holdWeight: 60, crewMin: 20, crewMax: 80, gunPortsPerSide: 5, bowChasers: 2, sternChasers: 1,
    sailHp: 120, repairRate: 1.1, detection: 1500, price: 9500, purchasable: true, sprite: 'ship.xebec', factions: ['brokers', 'confederacy', 'free'],
    passive: { id: 'sweeps', name: 'Sweeps', description: '+25% speed in winds under half strength; oars give at least 3 m/s on any heading, even head to wind.' },
  }),
  fishing_ketch: ship({
    id: 'fishing_ketch', name: 'Fishing Ketch', tier: 2, rig: 'fore_aft', role: 'A fishing hull: a big wet well and ice in the hold.',
    length: 24, beam: 8, hull: 1400, armor: 0.05, maxSpeed: 14.5, accel: 2.0, turnRate: 20, draft: 2.4,
    holdVolume: 110, holdWeight: 120, crewMin: 10, crewMax: 36, gunPortsPerSide: 3, bowChasers: 0, sternChasers: 1,
    sailHp: 120, repairRate: 1.1, detection: 1450, price: 5600, purchasable: true, sprite: 'ship.fishing_ketch',
    passive: { id: 'wet_well', name: 'Iced Well', description: 'Nets take twice the catch; fish in the hold spoils three times slower.' },
  }),
  harpoon_whaler: ship({
    id: 'harpoon_whaler', name: 'Harpoon Whaler', tier: 3, rig: 'mixed', role: 'Rare. A whaling hull of the Order: a winch on the bow, a flensing deck, try-works amidships.',
    length: 30, beam: 9, hull: 2000, armor: 0.12, maxSpeed: 14, accel: 1.6, turnRate: 17, draft: 3.0,
    holdVolume: 150, holdWeight: 170, crewMin: 22, crewMax: 70, gunPortsPerSide: 4, bowChasers: 1, sternChasers: 0,
    sailHp: 140, repairRate: 1.0, detection: 1700, price: 14000, purchasable: true, sprite: 'ship.harpoon_whaler', factions: ['harpoon'], fixedMount: 'harpoon',
    passive: { id: 'flensing_deck', name: 'Flensing Deck', description: 'Flenses a carcass twice as fast; her line stands a third more strain; shy whales hear her a third less.' },
  }),
  bomb_ketch: ship({
    id: 'bomb_ketch', name: 'Bomb Ketch', tier: 3, rig: 'mixed', role: 'Rare. A floating mortar battery for sieges and ambushes.',
    length: 30, beam: 10, hull: 2700, armor: 0.2, maxSpeed: 12, accel: 1.2, turnRate: 13, draft: 3.2,
    holdVolume: 70, holdWeight: 110, crewMin: 30, crewMax: 100, gunPortsPerSide: 4, bowChasers: 0, sternChasers: 1,
    sailHp: 150, repairRate: 0.9, detection: 1400, price: 16000, purchasable: true, sprite: 'ship.bomb_ketch', factions: ['crown', 'confederacy'], fixedMount: 'mortar',
    passive: { id: 'bomb_vessel', name: 'Bomb Vessel', description: 'Twin mortar wells: the fitted mortar reloads 50% faster and throws two bombs.' },
  }),
  fireship: ship({
    id: 'fireship', name: 'Fireship', tier: 1, rig: 'square', role: 'Rare. A hulk of tar and powder you sail into the enemy line and abandon.',
    length: 24, beam: 8, hull: 800, armor: 0.0, maxSpeed: 13, accel: 1.8, turnRate: 17, draft: 2.6,
    holdVolume: 10, holdWeight: 20, crewMin: 6, crewMax: 20, gunPortsPerSide: 0, bowChasers: 0, sternChasers: 0,
    sailHp: 90, repairRate: 0.8, detection: 1300, price: 900, purchasable: true, sprite: 'ship.fireship', factions: ['confederacy', 'free'], fixedMount: 'fire_charge',
    passive: { id: 'fireship', name: 'Fire Hulk', description: 'No guns. RMB lights the charges: 8 s later she explodes (700 damage in 90 m, fires). The crew rows away; you are carried to port like a wreck.' },
  }),
  ghost_ship: ship({
    id: 'ghost_ship', name: 'Ghost Ship', tier: 5, rig: 'mixed', role: 'Something the sea gave back.',
    length: 40, beam: 11, hull: 4200, armor: 0.2, maxSpeed: 15, accel: 1.4, turnRate: 16, draft: 4.0,
    holdVolume: 100, holdWeight: 120, crewMin: 40, crewMax: 160, gunPortsPerSide: 11, bowChasers: 1, sternChasers: 1,
    sailHp: 220, repairRate: 1.3, detection: 1500, price: 0, purchasable: false, sprite: 'ship.ghost_ship',
    passive: { id: 'dead_crew', name: 'Dead Crew', description: 'Crew does not lose morale. Sails ignore storms.' },
  }),

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
