// Derived ship statistics: class base × shipyard modules × captain passive × talents × temporary effects.
// Both server (authoritative) and client (HUD, shipyard previews) use this, so previews never lie.

import { CAPTAINS } from '../data/captains.ts';
import type { CaptainId } from '../data/captains.ts';
import { GOODS } from '../data/goods.ts';
import type { GoodId } from '../data/goods.ts';
import { AMMO, GUNS, MODULES, SHIP_CLASSES } from '../data/ships.ts';
import type { AmmoId, GunId, ModuleId, MountId, Rig, ShipClassId } from '../data/ships.ts';
import { mod, sumMods } from '../data/stats.ts';
import type { Flag, ModifierSource } from '../data/stats.ts';
import { talentModifiers } from '../data/talents.ts';
import type { TalentRanks } from '../data/talents.ts';
import { baseNoGo } from './sailing.ts';
import { DEG } from '../math.ts';

export interface ShipLoadout {
  classId: ShipClassId;
  name: string;
  guns: { port: GunId; starboard: GunId };
  modules: Partial<Record<ModuleId, number>>;
  mount?: MountId;
}

export interface ShipStats {
  classId: ShipClassId;
  rig: Rig;
  length: number;
  beam: number;
  maxSpeed: number;
  accel: number;
  turnRate: number; // rad/s
  noGoDeg: number;
  sailChangeRate: number;
  currentMul: number;
  nightSpeed: number;
  hullMax: number;
  armor: number;
  sailHpMax: number;
  repairRate: number;
  battleRepairRate: number;
  crewMin: number;
  crewMax: number;
  holdVolume: number;
  holdWeight: number;
  detection: number;
  gunsPerSide: number;
  reloadMul: number;
  spreadMul: number;
  gunDamageMul: number;
  rangeMul: number;
  doubleShotChance: number;
  crewKillMul: number;
  sailDamageMul: number;
  boardingRange: number;
  boardingPower: number;
  boardingCargoLoss: number; // fraction of cargo destroyed by a boarding (before aggression)
  moraleOnBoard: number;
  enemyMoraleCollapse: number;
  provisionUse: number;
  buyMul: number;
  sellMul: number;
  contrabandVolumeMul: number;
  incomingDamageMul: number;
  moraleRegen: number;
  flags: Set<Flag>;
}

export function computeShipStats(
  loadout: ShipLoadout,
  captain: CaptainId,
  talents: TalentRanks,
  effects: ModifierSource[] = [],
): ShipStats {
  const cls = SHIP_CLASSES[loadout.classId];
  const cap = CAPTAINS[captain];
  const sources: ModifierSource[] = [
    { mods: cap.passive.mods, flags: cap.passive.flags },
    ...talentModifiers(talents),
    ...effects,
  ];
  const { mods, flags } = sumMods(sources);

  // Modules.
  let hullMul = 0, armorAdd = 0, speedMul = 0, sailHpMul = 0, turnMul = 0, holdMul = 0, crewMul = 0, boardingMul = 0;
  for (const id in loadout.modules) {
    const lvl = loadout.modules[id as ModuleId] ?? 0;
    const pl = MODULES[id as ModuleId]?.perLevel;
    if (!pl || lvl <= 0) continue;
    hullMul += (pl.hullMul ?? 0) * lvl;
    armorAdd += (pl.armorAdd ?? 0) * lvl;
    speedMul += (pl.speedMul ?? 0) * lvl;
    sailHpMul += (pl.sailHpMul ?? 0) * lvl;
    turnMul += (pl.turnMul ?? 0) * lvl;
    holdMul += (pl.holdMul ?? 0) * lvl;
    crewMul += (pl.crewMul ?? 0) * lvl;
    boardingMul += (pl.boardingMul ?? 0) * lvl;
  }

  const passive = cls.passive.id;
  const baseRange = 34 + cls.length * 0.5;

  return {
    classId: cls.id,
    rig: cls.rig,
    length: cls.length,
    beam: cls.beam,
    maxSpeed: cls.maxSpeed * (1 + speedMul + mod(mods, 'maxSpeed')),
    accel: cls.accel * (1 + mod(mods, 'accel') + (passive === 'dispatch' ? 0.1 : 0)),
    turnRate: cls.turnRate * DEG * (1 + turnMul + mod(mods, 'turnRate')),
    noGoDeg: baseNoGo(cls.rig) + mod(mods, 'noGoDeg'),
    sailChangeRate: 0.45 * (1 + mod(mods, 'sailChangeRate') + (passive === 'raider_rig' ? 0.2 : 0)),
    currentMul: mod(mods, 'currentMul'),
    nightSpeed: mod(mods, 'nightSpeed'),
    hullMax: Math.round(cls.hull * (1 + hullMul + mod(mods, 'hullMax'))),
    armor: Math.min(0.6, cls.armor + armorAdd + mod(mods, 'armor')),
    sailHpMax: Math.round(cls.sailHp * (1 + sailHpMul + mod(mods, 'sailHpMax'))),
    repairRate: cls.repairRate * (1 + mod(mods, 'repairRate')),
    battleRepairRate: mod(mods, 'battleRepairRate'),
    crewMin: cls.crewMin,
    crewMax: Math.round(cls.crewMax * (1 + crewMul + mod(mods, 'crewMax'))),
    holdVolume: cls.holdVolume * (1 + holdMul + mod(mods, 'holdVolume')),
    holdWeight: cls.holdWeight * (1 + holdMul),
    detection: cls.detection * (1 + mod(mods, 'detection') + (passive === 'hunter' ? 0.15 : 0)),
    gunsPerSide: cls.gunPortsPerSide,
    reloadMul: Math.max(0.2, 1 + mod(mods, 'reloadMul')),
    spreadMul: Math.max(0.2, 1 + mod(mods, 'spreadMul')),
    gunDamageMul: 1 + mod(mods, 'gunDamageMul'),
    rangeMul: 1 + mod(mods, 'rangeMul'),
    doubleShotChance: mod(mods, 'doubleShotChance'),
    crewKillMul: 1 + mod(mods, 'crewKillMul'),
    sailDamageMul: 1 + mod(mods, 'sailDamageMul'),
    boardingRange: baseRange * (1 + mod(mods, 'boardingRange') + (passive === 'raider_rig' ? 0.1 : 0)),
    boardingPower: 1 + boardingMul + mod(mods, 'boardingPower'),
    boardingCargoLoss: Math.max(0.02, 0.18 + mod(mods, 'boardingCargoLoss')),
    moraleOnBoard: mod(mods, 'moraleOnBoard'),
    enemyMoraleCollapse: mod(mods, 'enemyMoraleCollapse'),
    provisionUse: Math.max(0.1, 1 + mod(mods, 'provisionUse')),
    buyMul: 1 + mod(mods, 'buyMul'),
    sellMul: 1 + mod(mods, 'sellMul'),
    contrabandVolumeMul: Math.max(0.3, 1 + mod(mods, 'contrabandVolumeMul')),
    incomingDamageMul: Math.max(0.2, 1 + mod(mods, 'incomingDamageMul')),
    moraleRegen: 0.4 + mod(mods, 'moraleRegen'),
    flags,
  };
}

export type Cargo = Partial<Record<GoodId, number>>;
export type AmmoStock = Record<AmmoId, number>;

export function cargoVolume(cargo: Cargo, contrabandVolumeMul = 1): number {
  let v = 0;
  for (const id in cargo) {
    const g = GOODS[id as GoodId];
    const n = cargo[id as GoodId] ?? 0;
    v += n * g.volume * (g.contraband ? contrabandVolumeMul : 1);
  }
  return v;
}

export function cargoWeight(cargo: Cargo, ammo?: AmmoStock): number {
  let w = 0;
  for (const id in cargo) w += (cargo[id as GoodId] ?? 0) * GOODS[id as GoodId].weight;
  if (ammo) for (const a in ammo) w += ((ammo[a as AmmoId] ?? 0) / 10) * AMMO[a as AmmoId].weightPer10;
  return w;
}

export function cargoValue(cargo: Cargo): number {
  let v = 0;
  for (const id in cargo) v += (cargo[id as GoodId] ?? 0) * GOODS[id as GoodId].basePrice;
  return v;
}

export function gunWeight(loadout: ShipLoadout): number {
  const n = SHIP_CLASSES[loadout.classId].gunPortsPerSide;
  return n * (GUNS[loadout.guns.port].weight + GUNS[loadout.guns.starboard].weight);
}

/** Speed multiplier from how heavily the ship is loaded (guns count half, they're designed in). */
export function loadFactor(loadout: ShipLoadout, stats: ShipStats, cargo: Cargo, ammo: AmmoStock): number {
  const w = cargoWeight(cargo, ammo) + gunWeight(loadout) * 0.25;
  const ratio = Math.min(1.4, w / Math.max(1, stats.holdWeight));
  return 1 - ratio * 0.14;
}

export function crewFactor(stats: ShipStats, crew: number): number {
  if (crew <= 0) return 0;
  const needed = Math.max(stats.crewMin, stats.crewMax * 0.55);
  return Math.min(1, crew / needed);
}

/** Crew needed to man every gun on one side plus the sailing crew. */
export function gunCrewFactor(stats: ShipStats, loadout: ShipLoadout, crew: number): number {
  const perGun = Math.max(GUNS[loadout.guns.port].crewPerGun, GUNS[loadout.guns.starboard].crewPerGun);
  const needed = stats.crewMin + stats.gunsPerSide * perGun;
  return Math.max(0.3, Math.min(1, crew / needed));
}
