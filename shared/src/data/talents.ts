// Talent trees — docs/03_TALENT_TREES.md. Ten trees of 24–26 talents with 1–3 ranks, gated by points invested
// in the tree (T1 0, T2 5, T3 10, T4 15, T5 20, keystone 25 + captain level 25), two mutually exclusive
// keystones per tree and at most two per build, plus bridge talents between trees (§5, at most three).
// Trees still marked `complete: false` run on the prototype's compressed gates until their full content lands.
// Each talent is data: stat modifiers per rank plus optional flags; situational rules live in the systems.

import type { CaptainId } from './captains.ts';
import type { Flag, StatMods } from './stats.ts';
import { BOARDING } from './trees/boarding.ts';
import { GUNNERY } from './trees/gunnery.ts';
import { NAVIGATION } from './trees/navigation.ts';
import { SMUGGLING } from './trees/smuggling.ts';
import { SURVIVAL } from './trees/survival.ts';
import { TRADE } from './trees/trade.ts';

export type TreeId =
  | 'navigation' | 'gunnery' | 'boarding' | 'command' | 'trade'
  | 'smuggling' | 'survival' | 'shipwright' | 'exploration' | 'abyssal';

export interface TreeDef {
  id: TreeId;
  name: string;
  motto: string;
  /** Full 03 content and gates. Incomplete trees use the prototype gates (TIER_STEP / KEYSTONE_REQUIREMENT). */
  complete: boolean;
  /** Playable at all (has talents). */
  playable: boolean;
  native: CaptainId[];
}

export const TREES: Record<TreeId, TreeDef> = {
  navigation: { id: 'navigation', name: 'Navigation', motto: 'The wind is a weapon.', complete: true, playable: true, native: ['corsair', 'navigator'] },
  gunnery: { id: 'gunnery', name: 'Gunnery', motto: 'Speak in iron.', complete: true, playable: true, native: ['corsair'] },
  boarding: { id: 'boarding', name: 'Boarding', motto: 'Steel, rope and nerve.', complete: true, playable: true, native: ['reaver'] },
  command: { id: 'command', name: 'Command', motto: 'A crew is a blade — keep it sharp.', complete: false, playable: false, native: ['admiral'] },
  trade: { id: 'trade', name: 'Trade', motto: 'Every port is a ledger.', complete: true, playable: true, native: ['smuggler'] },
  smuggling: { id: 'smuggling', name: 'Smuggling', motto: 'What the Crown does not see, the Crown does not tax.', complete: true, playable: true, native: ['smuggler'] },
  survival: { id: 'survival', name: 'Survival', motto: 'Stay afloat. Everything else is luxury.', complete: true, playable: true, native: ['reaver', 'drowned'] },
  shipwright: { id: 'shipwright', name: 'Shipwright', motto: 'The hull remembers every hand.', complete: false, playable: false, native: ['admiral'] },
  exploration: { id: 'exploration', name: 'Exploration', motto: 'Beyond the last lighthouse.', complete: false, playable: false, native: ['navigator'] },
  abyssal: { id: 'abyssal', name: 'Abyssal', motto: 'The deep answers those who call.', complete: false, playable: false, native: ['drowned'] },
};

/** Clockwise order of the rays on the Wind Rose (§2.10). */
export const ROSE_ORDER: TreeId[] = ['navigation', 'exploration', 'abyssal', 'survival', 'shipwright', 'command', 'gunnery', 'boarding', 'smuggling', 'trade'];

export interface TalentDef {
  id: string;
  tree: TreeId | 'bridge';
  name: string;
  /** 1..5; 6 = keystone ring. Incomplete trees use 1..3 with the prototype gates. */
  tier: number;
  maxRank: number;
  keystone: boolean;
  requires?: string;
  requiresRank?: number;
  /** The other keystone of the same tree. */
  excludes?: string;
  /** Bridges: the two trees and the points required in each. */
  bridge?: { trees: [TreeId, TreeId]; min: number };
  description: string;
  perRank?: StatMods; // multiplied by rank
  fixed?: StatMods; // applied once when rank >= 1
  flags?: Flag[];
  /** Active talents are used from the talent bar (keys 6–0). */
  active?: { cooldown: number };
}

export const TIER_GATE = 5;
export const KEYSTONE_GATE = 25;
export const KEYSTONE_LEVEL = 25;
export const MAX_KEYSTONES = 2;
export const MAX_BRIDGES = 3;
// Prototype gates for trees whose full content has not landed yet.
export const TIER_STEP = 2;
export const KEYSTONE_REQUIREMENT = 5;

export const TALENTS: TalentDef[] = [...NAVIGATION, ...GUNNERY, ...BOARDING, ...TRADE, ...SMUGGLING, ...SURVIVAL];

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

/** Points in `tree` spent on talents of a lower tier than `tier` — what opens the gate of `tier`. */
export function pointsBelowTier(ranks: TalentRanks, tree: TreeId, tier: number): number {
  let n = 0;
  for (const id in ranks) {
    const def = TALENTS_BY_ID[id];
    if (def && def.tree === tree && def.tier < tier) n += ranks[id];
  }
  return n;
}

export function totalPointsSpent(ranks: TalentRanks): number {
  let n = 0;
  for (const id in ranks) n += ranks[id] ?? 0;
  return n;
}

export function tierRequirement(def: TalentDef): number {
  if (def.tree === 'bridge') return 0;
  if (TREES[def.tree].complete) return def.keystone ? KEYSTONE_GATE : (def.tier - 1) * TIER_GATE;
  return def.keystone ? KEYSTONE_REQUIREMENT : (def.tier - 1) * TIER_STEP;
}

export interface LearnContext {
  level: number;
  /** The Abyssal tree is open to drowned captains, and to others who have gone down into the deep. */
  abyssOpen: boolean;
}

const ANY: LearnContext = { level: 999, abyssOpen: true };

/** Whether `def` at its current rank is still supported by the rest of the build (gates, parents, bridges). */
function supported(ranks: TalentRanks, def: TalentDef, ctx: LearnContext): string | null {
  if (def.tree === 'bridge') {
    const b = def.bridge!;
    for (const tr of b.trees) if (pointsInTree(ranks, tr) < b.min) return `Requires ${b.min} points in ${TREES[tr].name} and ${TREES[b.trees[0] === tr ? b.trees[1] : b.trees[0]].name}`;
  } else {
    const need = tierRequirement(def);
    const tierForGate = def.keystone ? 6 : def.tier;
    if (pointsBelowTier(ranks, def.tree, tierForGate) < need) return `Requires ${need} points in ${TREES[def.tree].name}`;
  }
  if (def.requires && (ranks[def.requires] ?? 0) < (def.requiresRank ?? 1)) {
    return `Requires ${TALENTS_BY_ID[def.requires]?.name ?? def.requires}${(def.requiresRank ?? 1) > 1 ? ` rank ${def.requiresRank}` : ''}`;
  }
  if (def.keystone && TREES[def.tree as TreeId]?.complete && ctx.level < KEYSTONE_LEVEL) return `Keystones need captain level ${KEYSTONE_LEVEL}`;
  return null;
}

/** Validates spending one more point; returns an error string or null. Server-authoritative, client previews. */
export function canLearn(ranks: TalentRanks, talentId: string, available: number, ctx: LearnContext = ANY): string | null {
  const def = TALENTS_BY_ID[talentId];
  if (!def) return 'Unknown talent';
  if (def.tree !== 'bridge' && !TREES[def.tree].playable) return 'Tree not available yet';
  if (def.tree === 'abyssal' && !ctx.abyssOpen) return 'The Abyss has not answered you yet';
  const cur = ranks[talentId] ?? 0;
  if (cur >= def.maxRank) return 'Already at max rank';
  if (available <= 0) return 'No talent points available';
  const why = supported(ranks, def, ctx);
  if (why) return why;
  if (def.keystone && cur === 0) {
    if (def.excludes && (ranks[def.excludes] ?? 0) > 0) return `Cannot be combined with ${TALENTS_BY_ID[def.excludes]?.name ?? def.excludes}`;
    const keystones = Object.keys(ranks).filter((id) => ranks[id] > 0 && TALENTS_BY_ID[id]?.keystone).length;
    if (keystones >= MAX_KEYSTONES) return 'At most two keystones may be active';
  }
  if (def.tree === 'bridge' && cur === 0) {
    const bridges = Object.keys(ranks).filter((id) => ranks[id] > 0 && TALENTS_BY_ID[id]?.tree === 'bridge').length;
    if (bridges >= MAX_BRIDGES) return 'At most three bridges';
  }
  return null;
}

/** Retention rule (§2.3): removing every rank of `talentId` must leave every other talent supported. */
export function canUnlearn(ranks: TalentRanks, talentId: string, ctx: LearnContext = ANY): string | null {
  if (!(ranks[talentId] > 0)) return 'Not learned';
  const next = { ...ranks };
  delete next[talentId];
  for (const id in next) {
    const def = TALENTS_BY_ID[id];
    if (!def || next[id] <= 0) continue;
    const why = supported(next, def, ctx);
    if (why) return `${def.name} depends on it — remove the higher talents first`;
  }
  return null;
}

/** Full validation of a stored build (loadouts, migrations). Returns null when every talent holds. */
export function validateBuild(ranks: TalentRanks, points: number, ctx: LearnContext = ANY): string | null {
  if (totalPointsSpent(ranks) > points) return 'More points spent than available';
  let keystones = 0, bridges = 0;
  for (const id in ranks) {
    const def = TALENTS_BY_ID[id];
    if (!def) return `Unknown talent ${id}`;
    if (ranks[id] <= 0) continue;
    if (ranks[id] > def.maxRank) return `${def.name} above max rank`;
    const why = supported(ranks, def, ctx);
    if (why) return `${def.name}: ${why}`;
    if (def.keystone) {
      keystones++;
      if (def.excludes && (ranks[def.excludes] ?? 0) > 0) return `${def.name} excludes ${def.excludes}`;
    }
    if (def.tree === 'bridge') bridges++;
  }
  if (keystones > MAX_KEYSTONES) return 'Too many keystones';
  if (bridges > MAX_BRIDGES) return 'Too many bridges';
  return null;
}

export function rankOf(ranks: TalentRanks, id: string): number {
  return ranks[id] ?? 0;
}

export function activeTalents(ranks: TalentRanks): TalentDef[] {
  return TALENTS.filter((d) => d.active && (ranks[d.id] ?? 0) > 0);
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
