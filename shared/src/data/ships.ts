// Ship classes, artillery, ammunition and shipyard modules.
// Speeds are in game meters/second (the world is compressed ~6x relative to real nautical scale
// so a fast ship crosses the 96 km ocean in roughly 100 minutes).

export type ShipClassId =
  | 'sloop' | 'cutter' | 'schooner' | 'brigantine' | 'fluyt' | 'brig' | 'frigate' | 'galleon' | 'man_o_war' | 'ghost_ship';

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
  sprite: string; // asset id in assets/manifest.json
  passive: { id: string; name: string; description: string };
}

const ship = (d: ShipClassDef): ShipClassDef => d;

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
    holdVolume: 160, holdWeight: 200, crewMin: 180, crewMax: 600, gunPortsPerSide: 20, bowChasers: 2, sternChasers: 2,
    sailHp: 300, repairRate: 0.7, detection: 1600, price: 90000, purchasable: true, sprite: 'ship.man_o_war',
    passive: { id: 'line', name: 'Ship of the Line', description: 'Immune to raking bonus damage from the bow.' },
  }),
  ghost_ship: ship({
    id: 'ghost_ship', name: 'Ghost Ship', tier: 5, rig: 'mixed', role: 'Something the sea gave back.',
    length: 40, beam: 11, hull: 4200, armor: 0.2, maxSpeed: 15, accel: 1.4, turnRate: 16, draft: 4.0,
    holdVolume: 100, holdWeight: 120, crewMin: 40, crewMax: 160, gunPortsPerSide: 11, bowChasers: 1, sternChasers: 1,
    sailHp: 220, repairRate: 1.3, detection: 1500, price: 0, purchasable: false, sprite: 'ship.ghost_ship',
    passive: { id: 'dead_crew', name: 'Dead Crew', description: 'Crew does not lose morale. Sails ignore storms.' },
  }),
};

export const SHIP_CLASS_IDS = Object.keys(SHIP_CLASSES) as ShipClassId[];

// ---------------------------------------------------------------- Artillery

export type GunId = 'light_6' | 'long_9' | 'medium_12' | 'heavy_18' | 'carronade_24';

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
}

export const GUNS: Record<GunId, GunDef> = {
  light_6: { id: 'light_6', name: '6-pdr Gun', damage: 40, range: 320, reload: 8, spreadDeg: 3.5, weight: 1, crewPerGun: 3, price: 300, minTier: 1, description: 'Light, quick, cheap.' },
  long_9: { id: 'long_9', name: '9-pdr Long Gun', damage: 46, range: 460, reload: 10, spreadDeg: 2, weight: 1.5, crewPerGun: 4, price: 700, minTier: 1, description: 'Long barrel, long reach, accurate.' },
  medium_12: { id: 'medium_12', name: '12-pdr Gun', damage: 60, range: 380, reload: 11, spreadDeg: 3, weight: 2, crewPerGun: 5, price: 1000, minTier: 2, description: 'The workhorse of every navy.' },
  heavy_18: { id: 'heavy_18', name: '18-pdr Gun', damage: 80, range: 400, reload: 13.5, spreadDeg: 3, weight: 3, crewPerGun: 6, price: 1800, minTier: 3, description: 'Hull-breaker. Heavy and slow.' },
  carronade_24: { id: 'carronade_24', name: '24-pdr Carronade', damage: 110, range: 220, reload: 10, spreadDeg: 5, weight: 1.6, crewPerGun: 4, price: 1200, minTier: 2, description: 'Smasher. Devastating at pistol range, useless beyond it.' },
};

export const GUN_IDS = Object.keys(GUNS) as GunId[];

export type AmmoId = 'round' | 'chain' | 'grape';

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
  description: string;
}

export const AMMO: Record<AmmoId, AmmoDef> = {
  round: { id: 'round', name: 'Round Shot', hullMul: 1, sailMul: 0.08, crewKill: 0.5, rangeMul: 1, speed: 190, price: 2, weightPer10: 0.5, description: 'Solid iron. Breaks hulls.' },
  chain: { id: 'chain', name: 'Chain Shot', hullMul: 0.25, sailMul: 0.45, crewKill: 0.25, rangeMul: 0.72, speed: 160, price: 4, weightPer10: 0.5, description: 'Two balls on a chain. Shreds sails and rigging.' },
  grape: { id: 'grape', name: 'Grapeshot', hullMul: 0.12, sailMul: 0.06, crewKill: 2.4, rangeMul: 0.55, speed: 170, price: 3, weightPer10: 0.5, description: 'A bag of musket balls. Clears decks before a boarding.' },
};

export const AMMO_IDS: AmmoId[] = ['round', 'chain', 'grape'];

// ---------------------------------------------------------------- Shipyard modules

export type ModuleId = 'hull_plating' | 'sail_plan' | 'rudder' | 'hold_expansion' | 'crew_quarters' | 'figurehead_kraken';

export interface ModuleDef {
  id: ModuleId;
  name: string;
  maxLevel: number;
  baseCost: number; // multiplied by level and ship tier
  description: string;
  perLevel: { hullMul?: number; armorAdd?: number; speedMul?: number; sailHpMul?: number; turnMul?: number; holdMul?: number; crewMul?: number; boardingMul?: number };
}

export const MODULES: Record<ModuleId, ModuleDef> = {
  hull_plating: { id: 'hull_plating', name: 'Black Oak Plating', maxLevel: 3, baseCost: 900, description: 'Extra layer of black oak and iron knees. Tougher, slower.', perLevel: { hullMul: 0.08, armorAdd: 0.03, speedMul: -0.02 } },
  sail_plan: { id: 'sail_plan', name: 'Tailored Sail Plan', maxLevel: 3, baseCost: 800, description: 'Better canvas cut for this hull.', perLevel: { speedMul: 0.04, sailHpMul: 0.08 } },
  rudder: { id: 'rudder', name: 'Balanced Rudder', maxLevel: 2, baseCost: 700, description: 'Deeper, balanced rudder blade.', perLevel: { turnMul: 0.08 } },
  hold_expansion: { id: 'hold_expansion', name: 'Hold Expansion', maxLevel: 2, baseCost: 1000, description: 'Rebuilt bulkheads and orlop storage.', perLevel: { holdMul: 0.12, speedMul: -0.01 } },
  crew_quarters: { id: 'crew_quarters', name: 'Crew Quarters', maxLevel: 2, baseCost: 850, description: 'More hammocks, more hands.', perLevel: { crewMul: 0.12 } },
  figurehead_kraken: { id: 'figurehead_kraken', name: 'Kraken Figurehead', maxLevel: 1, baseCost: 2500, description: 'A carved horror on the bow. Enemy crews flinch when you close in.', perLevel: { boardingMul: 0.1 } },
};

export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

export function moduleCost(id: ModuleId, nextLevel: number, tier: number): number {
  return Math.round(MODULES[id].baseCost * nextLevel * (0.6 + tier * 0.4));
}

export function defaultGunFor(cls: ShipClassDef): GunId {
  if (cls.tier >= 3) return 'medium_12';
  return 'light_6';
}
