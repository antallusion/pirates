// Talent trees — MVP subset of the full 10-tree design in docs/03_TALENT_TREES.md.
// Five trees are playable in the prototype. Each talent is data: stat modifiers per rank plus
// optional flags that systems check. Keystones radically change play and carry a real downside.

import type { Flag, StatMods } from './stats.ts';

export type TreeId =
  | 'navigation' | 'gunnery' | 'boarding' | 'command' | 'trade'
  | 'smuggling' | 'survival' | 'shipwright' | 'exploration' | 'abyssal';

export interface TreeDef {
  id: TreeId;
  name: string;
  motto: string;
  playableInMvp: boolean;
}

export const TREES: Record<TreeId, TreeDef> = {
  navigation: { id: 'navigation', name: 'Navigation', motto: 'The wind is a weapon.', playableInMvp: true },
  gunnery: { id: 'gunnery', name: 'Gunnery', motto: 'Speak in iron.', playableInMvp: true },
  boarding: { id: 'boarding', name: 'Boarding', motto: 'Steel, rope and nerve.', playableInMvp: true },
  command: { id: 'command', name: 'Command', motto: 'A crew is a blade — keep it sharp.', playableInMvp: false },
  trade: { id: 'trade', name: 'Trade', motto: 'Every port is a ledger.', playableInMvp: true },
  smuggling: { id: 'smuggling', name: 'Smuggling', motto: 'What the Crown does not see, the Crown does not tax.', playableInMvp: false },
  survival: { id: 'survival', name: 'Survival', motto: 'Stay afloat. Everything else is luxury.', playableInMvp: true },
  shipwright: { id: 'shipwright', name: 'Shipwright', motto: 'The hull remembers every hand.', playableInMvp: false },
  exploration: { id: 'exploration', name: 'Exploration', motto: 'Beyond the last lighthouse.', playableInMvp: false },
  abyssal: { id: 'abyssal', name: 'Abyssal', motto: 'The deep answers those who call.', playableInMvp: false },
};

export interface TalentDef {
  id: string;
  tree: TreeId;
  name: string;
  tier: number; // 1..3 in the MVP; tier N requires (N-1)*TIER_STEP points in the tree
  maxRank: number;
  keystone: boolean;
  requires?: string;
  description: string;
  perRank?: StatMods; // multiplied by rank
  fixed?: StatMods; // applied once when rank >= 1
  flags?: Flag[];
}

export const TIER_STEP = 2;
export const KEYSTONE_REQUIREMENT = 5;

const t = (d: TalentDef): TalentDef => d;

export const TALENTS: TalentDef[] = [
  // ------------------------------------------------------------- Navigation
  t({ id: 'nav_close_hauled', tree: 'navigation', name: 'Close-Hauled', tier: 1, maxRank: 3, keystone: false, description: 'Point higher into the wind: the no-go zone shrinks by 4° per rank.', perRank: { noGoDeg: -4 } }),
  t({ id: 'nav_quick_trim', tree: 'navigation', name: 'Quick Trim', tier: 1, maxRank: 2, keystone: false, description: 'Sail changes are 25% faster per rank.', perRank: { sailChangeRate: 0.25 } }),
  t({ id: 'nav_night_runner', tree: 'navigation', name: 'Night Runner', tier: 2, maxRank: 2, keystone: false, description: '+6% speed per rank while sailing at night.', perRank: { nightSpeed: 0.06 } }),
  t({ id: 'nav_current_reader', tree: 'navigation', name: 'Current Reader', tier: 2, maxRank: 1, keystone: false, description: 'Ocean currents push you 50% harder.', fixed: { currentMul: 0.5 } }),
  t({ id: 'nav_windborn', tree: 'navigation', name: 'Windborn', tier: 3, maxRank: 1, keystone: true, description: 'KEYSTONE. +15% maximum speed, but −25% maximum hull. You live by never being caught.', fixed: { maxSpeed: 0.15, hullMax: -0.25 } }),

  // ------------------------------------------------------------- Gunnery
  t({ id: 'gun_fast_hands', tree: 'gunnery', name: 'Fast Hands', tier: 1, maxRank: 3, keystone: false, description: 'Reload time −5% per rank.', perRank: { reloadMul: -0.05 } }),
  t({ id: 'gun_steady_aim', tree: 'gunnery', name: 'Steady Aim', tier: 1, maxRank: 3, keystone: false, description: 'Broadside spread −8% per rank.', perRank: { spreadMul: -0.08 } }),
  t({ id: 'gun_tangled_rigging', tree: 'gunnery', name: 'Tangled Rigging', tier: 2, maxRank: 1, keystone: false, description: 'Chain-shot hits apply Tangled Rigging: target turn rate −35% for 6 s.', flags: ['tangled_rigging'] }),
  t({ id: 'gun_double_charge', tree: 'gunnery', name: 'Double Charge', tier: 2, maxRank: 1, keystone: false, description: 'Each cannon has a 20% chance to fire two balls.', fixed: { doubleShotChance: 0.2 } }),
  t({ id: 'gun_iron_rain', tree: 'gunnery', name: 'Iron Rain', tier: 3, maxRank: 1, keystone: true, description: 'KEYSTONE. +25% cannon damage, but reloading is 20% slower. Every broadside must count.', fixed: { gunDamageMul: 0.25, reloadMul: 0.2 } }),

  // ------------------------------------------------------------- Boarding
  t({ id: 'brd_grapples', tree: 'boarding', name: 'Long Grapples', tier: 1, maxRank: 2, keystone: false, description: 'Boarding range +15% per rank.', perRank: { boardingRange: 0.15 } }),
  t({ id: 'brd_careful_hands', tree: 'boarding', name: 'Careful Hands', tier: 1, maxRank: 3, keystone: false, description: 'Cargo destroyed during boarding −5 percentage points per rank.', perRank: { boardingCargoLoss: -0.05 } }),
  t({ id: 'brd_victory_cheer', tree: 'boarding', name: 'Victory Cheer', tier: 2, maxRank: 1, keystone: false, description: 'A successful boarding restores 25 morale.', fixed: { moraleOnBoard: 25 } }),
  t({ id: 'brd_terror', tree: 'boarding', name: 'Terror', tier: 2, maxRank: 1, keystone: false, description: 'Enemy crews below 30% lose morale twice as fast.', flags: ['terror'], fixed: { enemyMoraleCollapse: 1 } }),
  t({ id: 'brd_blood_tide', tree: 'boarding', name: 'Blood Tide', tier: 3, maxRank: 1, keystone: true, description: 'KEYSTONE. Each successful boarding heals 15% hull, but maximum crew −20%.', flags: ['blood_tide'], fixed: { crewMax: -0.2 } }),

  // ------------------------------------------------------------- Trade
  t({ id: 'trd_haggler', tree: 'trade', name: 'Haggler', tier: 1, maxRank: 3, keystone: false, description: 'Buy prices −2% and sell prices +2% per rank.', perRank: { buyMul: -0.02, sellMul: 0.02 } }),
  t({ id: 'trd_packer', tree: 'trade', name: 'Master Packer', tier: 1, maxRank: 2, keystone: false, description: 'Hold volume +8% per rank.', perRank: { holdVolume: 0.08 } }),
  t({ id: 'trd_false_bottom', tree: 'trade', name: 'False Bottom', tier: 2, maxRank: 1, keystone: false, description: 'Contraband uses 30% less hold volume.', fixed: { contrabandVolumeMul: -0.3 }, flags: ['false_bottom'] }),
  t({ id: 'trd_market_sense', tree: 'trade', name: 'Market Sense', tier: 2, maxRank: 1, keystone: false, description: 'See price trends of every port you have visited on the world map.', flags: ['market_sense'] }),
  t({ id: 'trd_honest_merchant', tree: 'trade', name: 'Honest Merchant', tier: 3, maxRank: 1, keystone: true, description: 'KEYSTONE. You can never attack non-hostile ships; legal goods sell for +12%.', flags: ['honest_merchant'], fixed: { sellMul: 0.12 } }),

  // ------------------------------------------------------------- Survival
  t({ id: 'srv_carpenters', tree: 'survival', name: 'Ship Carpenters', tier: 1, maxRank: 3, keystone: false, description: 'Repair speed +15% per rank.', perRank: { repairRate: 0.15 } }),
  t({ id: 'srv_iron_hull', tree: 'survival', name: 'Iron Hull', tier: 1, maxRank: 3, keystone: false, description: 'Maximum hull +5% per rank.', perRank: { hullMax: 0.05 } }),
  t({ id: 'srv_battle_repair', tree: 'survival', name: 'Battle Repair', tier: 2, maxRank: 1, keystone: false, description: 'Carpenters can repair the hull during combat at 40% speed.', flags: ['battle_repair'], fixed: { battleRepairRate: 0.4 } }),
  t({ id: 'srv_ration_master', tree: 'survival', name: 'Ration Master', tier: 2, maxRank: 2, keystone: false, description: 'Provisions consumption −15% per rank.', perRank: { provisionUse: -0.15 } }),
  t({ id: 'srv_unsinkable', tree: 'survival', name: 'Unsinkable', tier: 3, maxRank: 1, keystone: true, description: 'KEYSTONE. Once per 5 minutes survive lethal damage with 1 hull for 6 s. Maximum sail level −10%.', flags: ['unsinkable'], fixed: { maxSpeed: -0.1 } }),
];

export const TALENTS_BY_ID: Record<string, TalentDef> = Object.fromEntries(TALENTS.map((x) => [x.id, x]));

export type TalentRanks = Record<string, number>;

export function pointsInTree(ranks: TalentRanks, tree: TreeId): number {
  let n = 0;
  for (const id in ranks) {
    const def = TALENTS_BY_ID[id];
    if (def && def.tree === tree) n += ranks[id];
  }
  return n;
}

export function totalPointsSpent(ranks: TalentRanks): number {
  let n = 0;
  for (const id in ranks) n += ranks[id] ?? 0;
  return n;
}

export function tierRequirement(def: TalentDef): number {
  if (def.keystone) return KEYSTONE_REQUIREMENT;
  return (def.tier - 1) * TIER_STEP;
}

/** Validates spending one more point; returns an error string or null. Server-authoritative. */
export function canLearn(ranks: TalentRanks, talentId: string, available: number): string | null {
  const def = TALENTS_BY_ID[talentId];
  if (!def) return 'Unknown talent';
  if (!TREES[def.tree].playableInMvp) return 'Tree not available yet';
  const cur = ranks[talentId] ?? 0;
  if (cur >= def.maxRank) return 'Already at max rank';
  if (available <= 0) return 'No talent points available';
  // Points invested in the tree excluding this talent's own ranks.
  const inTree = pointsInTree(ranks, def.tree) - cur;
  if (inTree < tierRequirement(def)) return `Requires ${tierRequirement(def)} points in ${TREES[def.tree].name}`;
  if (def.requires && !(ranks[def.requires] > 0)) return `Requires ${TALENTS_BY_ID[def.requires]?.name ?? def.requires}`;
  if (def.keystone) {
    const keystones = Object.keys(ranks).filter((id) => ranks[id] > 0 && TALENTS_BY_ID[id]?.keystone).length;
    if (keystones >= 2) return 'At most two keystones may be active';
  }
  return null;
}

export function talentModifiers(ranks: TalentRanks): { mods?: StatMods; flags?: Flag[] }[] {
  const out: { mods?: StatMods; flags?: Flag[] }[] = [];
  for (const id in ranks) {
    const rank = ranks[id];
    const def = TALENTS_BY_ID[id];
    if (!def || rank <= 0) continue;
    const mods: StatMods = {};
    if (def.perRank) for (const k in def.perRank) mods[k as keyof StatMods] = (def.perRank[k as keyof StatMods] ?? 0) * rank;
    if (def.fixed) for (const k in def.fixed) mods[k as keyof StatMods] = (mods[k as keyof StatMods] ?? 0) + (def.fixed[k as keyof StatMods] ?? 0);
    out.push({ mods, flags: def.flags });
  }
  return out;
}
