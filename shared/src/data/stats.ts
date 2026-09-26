// Stat modifier vocabulary shared by talents, captain passives, abilities, modules and status effects.
// Multiplicative stats (…Mul) combine additively inside their bucket, then multiply the base: base * (1 + Σ).
// Flags are boolean switches consumed by specific systems (e.g. 'battle_repair').

export type StatKey =
  | 'maxSpeed' | 'accel' | 'turnRate' | 'noGoDeg' | 'sailChangeRate' | 'currentMul' | 'nightSpeed'
  | 'reloadMul' | 'spreadMul' | 'gunDamageMul' | 'rangeMul' | 'doubleShotChance' | 'crewKillMul' | 'sailDamageMul'
  | 'hullMax' | 'armor' | 'sailHpMax' | 'repairRate' | 'battleRepairRate'
  | 'boardingRange' | 'boardingPower' | 'boardingCargoLoss' | 'moraleOnBoard' | 'enemyMoraleCollapse'
  | 'holdVolume' | 'crewMax' | 'detection' | 'provisionUse' | 'buyMul' | 'sellMul' | 'contrabandVolumeMul'
  | 'moraleRegen' | 'incomingDamageMul' | 'cooldownMul' | 'armorPct'
  // navigation
  | 'turnDrag' | 'runningFreeAccel' | 'seaPenalty' | 'tackDrill' | 'draftMul' | 'reefDamage' | 'stormSailDamage' | 'evasion' | 'polarBoost'
  // gunnery
  | 'chainSail' | 'chainRange' | 'fireRisk' | 'grapeCrew' | 'grapeMorale' | 'heatedShot' | 'gunCrewDrill' | 'swivels' | 'rakingFire'
  | 'mastBreak' | 'breachChance' | 'quickSwap' | 'chaserDamage' | 'chaserArc' | 'shotSpeed'
  // boarding
  | 'meleeDamage' | 'boardingNets' | 'matchSpeed' | 'marines' | 'transferSpeed' | 'boardingAxes' | 'prizeCrew' | 'blooded'
  | 'ironGrip' | 'holdTheLine';

export type Flag =
  | 'battle_repair' | 'market_sense' | 'honest_merchant' | 'tangled_rigging' | 'unsinkable' | 'blood_tide'
  | 'terror' | 'false_bottom' | 'dark_running' | 'hidden' | 'boarding_anywhere' | 'personal_wind'
  // navigation
  | 'weather_gauge' | 'sweeps_drill' | 'wake_rider' | 'dead_reckoning' | 'lee_shore' | 'stolen_wind' | 'trade_winds' | 'second_wind'
  | 'iron_tiller' | 'storm_rider'
  // gunnery
  | 'rolling_broadside' | 'skipping_shot' | 'spotter' | 'splinter_storm' | 'mortar_lore' | 'thunder_broadside' | 'crossfire' | 'red_hot'
  // boarding
  | 'pistol_volley' | 'bow_and_stern' | 'first_over_rail' | 'surrender_terms' | 'hull_to_hull' | 'warlord' | 'ransom' | 'no_quarter';

export type StatMods = Partial<Record<StatKey, number>>;

export interface ModifierSource {
  mods?: StatMods;
  flags?: Flag[];
}

export function sumMods(sources: Iterable<ModifierSource>): { mods: Record<StatKey, number>; flags: Set<Flag> } {
  const mods = {} as Record<StatKey, number>;
  const flags = new Set<Flag>();
  for (const s of sources) {
    if (s.mods) {
      for (const k in s.mods) {
        const key = k as StatKey;
        mods[key] = (mods[key] ?? 0) + (s.mods[key] ?? 0);
      }
    }
    if (s.flags) for (const f of s.flags) flags.add(f);
  }
  return { mods, flags };
}

export function mod(mods: Record<StatKey, number>, key: StatKey): number {
  return mods[key] ?? 0;
}
