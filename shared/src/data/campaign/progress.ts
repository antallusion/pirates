// A captain's place in the campaign (docs/36): the number of its quests behind her, the ways she chose at its branches,
// whether it has begun, and where it began for her (a captain of the days before it starts at her level's chapter).
// Pure: the save's sanitizer (server/src/game/player.ts) and the client both read it.

import type { RegionId } from '../../world/regions.ts';
import { campaignPaces } from './pacing.ts';
import { CAMPAIGN_SIZE, PLAN } from './plan.ts';

export interface CampaignState {
  /** Quests of the campaign behind her: the next is this slot (CAMPAIGN_SIZE: all done). */
  at: number;
  /** The ways chosen at the branches, by their keys. */
  picks: Record<string, 'a' | 'b'>;
  /** Begun: its next quest comes to her by itself (after one is done, at a new level, on coming aboard). */
  started: boolean;
  /** The slot it began at for her (a migrated captain's chapter; 0 for one who began at the beginning). */
  from: number;
}

export function newCampaignState(): CampaignState {
  return { at: 0, picks: {}, started: true, from: 0 };
}

/** The first slot of each chapter (by chapter − 1). */
export const FIRST_SLOT: number[] = (() => {
  const out: number[] = [];
  let s = 0;
  for (const p of PLAN) {
    out.push(s);
    s += p.size;
  }
  return out;
})();

/** The chapter of a slot (1-based), its place in it (0-based) and its size. */
export function chapterOfSlot(slot: number): { ch: number; k: number; size: number } {
  const i = Math.max(0, Math.min(CAMPAIGN_SIZE - 1, slot));
  let c = PLAN.length - 1;
  while (c > 0 && FIRST_SLOT[c] > i) c--;
  return { ch: PLAN[c].n, k: i - FIRST_SLOT[c], size: PLAN[c].size };
}

/** The gate of a slot (the level a campaign-only captain stands at when she comes to it). */
export const gateOf = (slot: number): number => campaignPaces()[Math.max(0, Math.min(CAMPAIGN_SIZE - 1, slot))].gate;

/**
 * Where a captain of the days before the campaign begins it (owner: «мигрировать существующих игроков»): at the start
 * of the last chapter her level has reached (its first quest's gate at or below her level) — what she has done at sea
 * stands for the chapters before it. A captain who has walked most of a sea's old story arcs (questarcs.ts, `a_<sea>_…`)
 * may begin a chapter further on in that sea, up to three levels above hers. A captain of the first level begins at the
 * beginning, not yet started.
 */
export function migrateCampaign(level: number, done: readonly string[]): CampaignState {
  let c = 0;
  for (let i = 0; i < PLAN.length; i++) if (gateOf(FIRST_SLOT[i]) <= level) c = i;
  // the old arcs: six chapters and more done in a sea
  const arcs = new Map<string, number>();
  for (const id of done) {
    if (!id.startsWith('a_')) continue;
    const sea = PLAN.find((p) => id.startsWith(`a_${p.region}_`))?.region;
    if (sea) arcs.set(sea, (arcs.get(sea) ?? 0) + 1);
  }
  for (const [sea, n] of arcs) {
    if (n < 6) continue;
    for (let i = c + 1; i < PLAN.length; i++) if (PLAN[i].region === (sea as RegionId) && gateOf(FIRST_SLOT[i]) <= level + 3) c = i;
  }
  const at = level <= 1 && c === 0 ? 0 : FIRST_SLOT[c];
  return { at, picks: {}, started: true, from: at };
}

/** A saved place made sound (a save of before the campaign is migrated). */
export function sanitizeCampaign(raw: CampaignState | undefined, level: number, done: readonly string[]): CampaignState {
  if (!raw || typeof raw !== 'object' || typeof raw.at !== 'number') return migrateCampaign(level, done);
  const at = Math.max(0, Math.min(CAMPAIGN_SIZE, Math.floor(raw.at)));
  const picks: Record<string, 'a' | 'b'> = {};
  for (const [k, v] of Object.entries(raw.picks ?? {})) if (v === 'a' || v === 'b') picks[k] = v;
  return { at, picks, started: true, from: Math.max(0, Math.min(at, Math.floor(raw.from ?? 0))) };
}
