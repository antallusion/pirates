// Derived ship statistics: class base × shipyard modules × captain passive × talents × temporary effects.
// Both server (authoritative) and client (HUD, shipyard previews) use this, so previews never lie.

import { CAPTAINS } from '../data/captains.ts';
import type { CaptainId } from '../data/captains.ts';
import { GOODS } from '../data/goods.ts';
import type { GoodId } from '../data/goods.ts';
import { AMMO, GUNS, MODULES, SHIP_CLASSES } from '../data/ships.ts';
import type { AmmoId, GunId, ModuleId, MountId, Rig, ShipClassId } from '../data/ships.ts';
import { mod, sumMods } from '../data/stats.ts';
import type { Flag, ModifierSource, StatKey } from '../data/stats.ts';
import { talentModifiers } from '../data/talents.ts';
import type { TalentRanks } from '../data/talents.ts';
import { baseNoGo, rowSpeed } from './sailing.ts';
import { buildSources } from '../data/shipbuild.ts';
import type { ShipBuild } from '../data/shipbuild.ts';
import type { SailTalents } from './sailing.ts';
import { DEG } from '../math.ts';

export interface ShipLoadout {
  classId: ShipClassId;
  name: string;
  guns: { port: GunId; starboard: GunId };
  modules: Partial<Record<ModuleId, number>>;
  mount?: MountId;
  /** Master Fitter: this fitting may go one level beyond its limit. */
  overfit?: ModuleId;
  /** Masterwork: fittings that came out Excellent (bonus +50%). */
  excellent?: ModuleId[];
  /** Legendary Keel on this hull. */
  keel?: boolean;
  /** A guild's hull on loan (docs/02 §12). */
  guild?: { g: number; id: number };
  /** Built to order at a yard (docs/02 §3). */
  build?: ShipBuild;
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
  materialVolumeMul: number; // Spare Timber
  provisionVolumeMul: number; // Expedition Stores
  cursedVolumeMul: number; // Cursed Cargo
  bowChasers: number;
  incomingDamageMul: number;
  moraleRegen: number;
  cooldownMul: number;
  /** Raw summed talent/effect values for situational keys (see tx()). */
  x: Record<StatKey, number>;
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
  // Permanent sources (captain passive, talents) are capped per 03 §3.3; temporary effects stack on top.
  const { mods, flags } = sumMods([{ mods: cap.passive.mods, flags: cap.passive.flags }, ...talentModifiers(talents)]);
  const m0 = (x: Record<StatKey, number>, k: StatKey) => mod(x, k);
  const eff = sumMods([...effects, ...buildSources(loadout.build, cls.armor)]);
  for (const f of eff.flags) flags.add(f);
  const has = (id: string) => (talents[id] ?? 0) > 0;
  const e = (k: StatKey) => mod(eff.mods, k);
  // Iron Tiller: turn-slowing effects are 40% weaker.
  const effTurn = e('turnRate') < 0 && flags.has('iron_tiller') ? e('turnRate') * 0.6 : e('turnRate');

  // Modules (Perfect Balance scales their bonuses; Excellent work +50%; Trim the Ballast eases their weight).
  let hullMul = 0, armorAdd = 0, speedMul = 0, sailHpMul = 0, turnMul = 0, holdMul = 0, crewMul = 0, boardingMul = 0, sigMod = 0;
  const fit = 1 + m0(mods, 'fittings');
  const ballast = Math.max(0, 1 + m0(mods, 'ballast'));
  for (const id in loadout.modules) {
    const lvl = loadout.modules[id as ModuleId] ?? 0;
    const pl = MODULES[id as ModuleId]?.perLevel;
    if (!pl || lvl <= 0) continue;
    const q = fit * (loadout.excellent?.includes(id as ModuleId) ? 1.5 : 1);
    const pos = (v: number | undefined) => (v ?? 0) * lvl * ((v ?? 0) > 0 ? q : ballast);
    hullMul += pos(pl.hullMul);
    armorAdd += pos(pl.armorAdd);
    speedMul += pos(pl.speedMul);
    sailHpMul += pos(pl.sailHpMul);
    turnMul += pos(pl.turnMul);
    holdMul += pos(pl.holdMul);
    crewMul += pos(pl.crewMul);
    boardingMul += pos(pl.boardingMul);
    sigMod += (pl.signature ?? 0) * lvl;
  }
  // Legendary Keel.
  if (loadout.keel) {
    hullMul += 0.05;
    holdMul += 0.05;
    speedMul += 0.03;
  }

  const passive = cls.passive.id;
  const baseRange = 34 + cls.length * 0.5;
  // Caps (§3.3): a keystone lifts the cap of its own characteristic.
  const speedCap = has('nav_windborn') ? 0.35 : 0.2;
  const dmgCap = has('gun_iron_rain') ? 0.5 : 0.25;
  const reloadFloor = has('gun_red_hot_barrels') ? -0.45 : -0.25;
  const armorCap = has('shp_iron_coffin') ? 0.9 : 0.5;
  const detectCap = has('exp_beyond_the_edge') ? 0.35 : 0.2;
  const m = (k: StatKey) => mod(mods, k);
  const extra = {} as Record<StatKey, number>;
  for (const k in mods) extra[k as StatKey] = mods[k as StatKey] + e(k as StatKey);
  if (sigMod) extra.signature = (extra.signature ?? 0) + sigMod;
  for (const k in eff.mods) if (!(k in extra)) extra[k as StatKey] = e(k as StatKey);

  return {
    classId: cls.id,
    rig: cls.rig,
    length: cls.length,
    beam: cls.beam,
    maxSpeed: cls.maxSpeed * Math.max(0.2, 1 + Math.min(speedCap, speedMul + m('maxSpeed')) + e('maxSpeed')),
    accel: cls.accel * (1 + m('accel') + e('accel') + (passive === 'dispatch' ? 0.1 : 0)),
    turnRate: cls.turnRate * DEG * Math.max(0.2, 1 + Math.min(0.4, turnMul + m('turnRate')) + effTurn),
    noGoDeg: baseNoGo(cls.rig) + m('noGoDeg') + e('noGoDeg'),
    sailChangeRate: 0.45 * (1 + m('sailChangeRate') + e('sailChangeRate') + (passive === 'raider_rig' ? 0.2 : 0)),
    currentMul: m('currentMul') + e('currentMul'),
    nightSpeed: m('nightSpeed') + e('nightSpeed'),
    hullMax: Math.round(cls.hull * Math.max(0.3, 1 + hullMul + m('hullMax') + e('hullMax'))),
    armor: Math.min(0.75, (cls.armor + armorAdd) * (1 + Math.min(armorCap, m('armorPct'))) + m('armor') + e('armor')),
    sailHpMax: Math.round(cls.sailHp * (1 + sailHpMul + m('sailHpMax') + e('sailHpMax'))),
    repairRate: cls.repairRate * (1 + m('repairRate') + e('repairRate')),
    battleRepairRate: m('battleRepairRate') + e('battleRepairRate'),
    crewMin: cls.crewMin,
    crewMax: Math.round(cls.crewMax * (1 + crewMul + m('crewMax') + e('crewMax'))),
    holdVolume: cls.holdVolume * (1 + holdMul + m('holdVolume') + e('holdVolume')),
    holdWeight: cls.holdWeight * (1 + holdMul),
    detection: cls.detection * (1 + Math.min(detectCap, m('detection') + (passive === 'hunter' ? 0.15 : 0)) + e('detection')),
    gunsPerSide: cls.gunPortsPerSide + (flags.has('overgunned') ? 2 : 0),
    bowChasers: cls.bowChasers + (flags.has('overgunned') ? 1 : 0),
    reloadMul: Math.max(0.2, 1 + Math.max(reloadFloor, m('reloadMul')) + e('reloadMul')),
    spreadMul: Math.max(0.2, 1 + m('spreadMul') + e('spreadMul')),
    gunDamageMul: Math.max(0.1, 1 + Math.min(dmgCap, m('gunDamageMul')) + e('gunDamageMul')),
    rangeMul: 1 + m('rangeMul') + e('rangeMul'),
    doubleShotChance: m('doubleShotChance') + e('doubleShotChance'),
    crewKillMul: 1 + m('crewKillMul') + e('crewKillMul'),
    sailDamageMul: 1 + m('sailDamageMul') + e('sailDamageMul'),
    boardingRange: baseRange * (1 + m('boardingRange') + e('boardingRange') + (passive === 'raider_rig' ? 0.1 : 0)),
    boardingPower: 1 + boardingMul + m('boardingPower') + e('boardingPower'),
    boardingCargoLoss: Math.max(0.02, 0.18 + m('boardingCargoLoss') + e('boardingCargoLoss')),
    moraleOnBoard: m('moraleOnBoard') + e('moraleOnBoard'),
    enemyMoraleCollapse: m('enemyMoraleCollapse') + e('enemyMoraleCollapse'),
    provisionUse: Math.max(0.1, 1 + m('provisionUse') + e('provisionUse')),
    buyMul: 1 + Math.max(-0.15, m('buyMul') + e('buyMul')),
    sellMul: 1 + Math.min(0.25, m('sellMul') + e('sellMul')),
    contrabandVolumeMul: Math.max(0.4, 1 + m('contrabandVolumeMul') + e('contrabandVolumeMul')),
    materialVolumeMul: Math.max(0.4, 1 + m('materialVolume')),
    provisionVolumeMul: Math.max(0.4, 1 + m('storesVolume')),
    cursedVolumeMul: Math.max(0.4, 1 - 0.25 * m('cursedCargo')),
    incomingDamageMul: Math.max(0.2, 1 + m('incomingDamageMul') + e('incomingDamageMul')),
    moraleRegen: 0.4 + m('moraleRegen') + e('moraleRegen'),
    cooldownMul: Math.max(0.6, 1 + m('cooldownMul') + e('cooldownMul')),
    x: extra,
    flags,
  };
}

/** A situational talent number (sum of ranks × value from talents and effects), 0 when absent. */
export function tx(st: ShipStats, k: StatKey): number {
  return st.x[k] ?? 0;
}

export type Cargo = Partial<Record<GoodId, number>>;
export type AmmoStock = Record<AmmoId, number>;

export function cargoVolume(cargo: Cargo, contrabandVolumeMul = 1, materialVolumeMul = 1, provisionVolumeMul = 1, cursedVolumeMul = 1): number {
  let v = 0;
  for (const id in cargo) {
    const g = GOODS[id as GoodId];
    const n = cargo[id as GoodId] ?? 0;
    v += n * g.volume * (g.contraband ? contrabandVolumeMul : id === 'planks' || id === 'sailcloth' ? materialVolumeMul : id === 'provisions' ? provisionVolumeMul : 1) * (id === 'cursed_relics' ? cursedVolumeMul : 1);
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
  const w = cargoWeight(cargo, ammo) + gunWeight(loadout) * 0.25 * Math.max(0, 1 + tx(stats, 'ballast'));
  const ratio = Math.min(1.4, w / Math.max(1, stats.holdWeight));
  return 1 - ratio * 0.14 * Math.max(0, 1 + tx(stats, 'loadPenalty'));
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

export function sailTalents(st: ShipStats): SailTalents {
  const storm = st.flags.has('storm_rider');
  return {
    turnDrag: tx(st, 'turnDrag'),
    runningFree: tx(st, 'runningFreeAccel'),
    seaPenalty: tx(st, 'seaPenalty'),
    tackDrill: tx(st, 'tackDrill'),
    polarBoost: tx(st, 'polarBoost'),
    rowSpeed: rowSpeed(st.classId, st.flags.has('sweeps_drill'), storm),
    stormRider: storm,
    silentRunning: tx(st, 'silentRunning'),
  };
}
