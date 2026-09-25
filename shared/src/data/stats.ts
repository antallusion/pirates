// Stat modifier vocabulary shared by talents, captain passives, abilities, modules and status effects.
// Multiplicative stats (…Mul) combine additively inside their bucket, then multiply the base: base * (1 + Σ).
// Flags are boolean switches consumed by specific systems (e.g. 'battle_repair').

export type StatKey =
  | 'maxSpeed' | 'accel' | 'turnRate' | 'noGoDeg' | 'sailChangeRate' | 'currentMul' | 'nightSpeed'
  | 'reloadMul' | 'spreadMul' | 'gunDamageMul' | 'rangeMul' | 'doubleShotChance' | 'crewKillMul' | 'sailDamageMul'
  | 'hullMax' | 'armor' | 'sailHpMax' | 'repairRate' | 'battleRepairRate'
  | 'boardingRange' | 'boardingPower' | 'boardingCargoLoss' | 'moraleOnBoard' | 'enemyMoraleCollapse'
  | 'holdVolume' | 'crewMax' | 'detection' | 'provisionUse' | 'buyMul' | 'sellMul' | 'contrabandVolumeMul'
  | 'moraleRegen' | 'incomingDamageMul';

export type Flag =
  | 'battle_repair' | 'market_sense' | 'honest_merchant' | 'tangled_rigging' | 'unsinkable' | 'blood_tide'
  | 'terror' | 'false_bottom' | 'dark_running' | 'hidden' | 'boarding_anywhere' | 'personal_wind';

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
