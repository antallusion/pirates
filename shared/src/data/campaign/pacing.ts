// The campaign's pace (docs/36 §4): its 720 quests take a captain who does nothing else from the first level to the
// sixtieth, the last quest bringing the 60th, on the curve of docs/26 (shared/src/constants.ts xpForLevel). The share
// of the road done after quest i is t = (i+1)/N, and the level reached there ℓ(t) = 1 + 59·t^γ: with γ = 0.85 the
// first level takes six quests, the 30th twelve, the 59th fourteen — early quests are quick steps, the late ones long
// (each is worth more ships of her level). A quest's experience is the curve's between its two points, so the sum is
// the curve's whole road exactly; its level is the level she stands at when she comes to it — the gate, monotonic.
//
// The silver is modest (docs/36 §4, beside the board's jobs: another hand trims the sea's silver — docs/26 §11): the
// campaign pays its road in experience; a little silver for the powder, more at a chapter's end.

import { MAX_LEVEL, xpForLevel } from '../../constants.ts';
import { CAMPAIGN_SIZE } from './plan.ts';

export const CAMPAIGN_GAMMA = 0.85;

/** The experience from the first level to the 60th (the campaign's whole road). */
export function roadXp(): number {
  let x = 0;
  for (let l = 1; l < MAX_LEVEL; l++) x += xpForLevel(l);
  return x;
}

/** The experience from the first level to the fractional level `l` (1 ≤ l ≤ 60). */
function xpTo(l: number): number {
  const f = Math.floor(l);
  let x = 0;
  for (let k = 1; k < Math.min(f, MAX_LEVEL); k++) x += xpForLevel(k);
  if (f >= MAX_LEVEL) return x;
  return x + (l - f) * xpForLevel(f);
}

/** The level reached after the share t of the road (0..1). */
export const levelAt = (t: number): number => 1 + (MAX_LEVEL - 1) * Math.pow(Math.max(0, Math.min(1, t)), CAMPAIGN_GAMMA);

export interface SlotPace {
  /** The level she stands at when she comes to it: the quest's gate. */
  gate: number;
  /** Its experience. */
  xp: number;
  /** Its silver. */
  silver: number;
}

let paces: SlotPace[] | null = null;

/** Every quest's gate, experience and silver, in the campaign's order. */
export function campaignPaces(n = CAMPAIGN_SIZE): SlotPace[] {
  if (paces && paces.length === n) return paces;
  const out: SlotPace[] = [];
  let before = 0;
  for (let i = 0; i < n; i++) {
    const after = i === n - 1 ? roadXp() : Math.round(xpTo(levelAt((i + 1) / n)));
    const gate = Math.max(1, Math.min(MAX_LEVEL, Math.floor(levelAt(i / n) + 1e-9)));
    out.push({ gate, xp: after - before, silver: campaignSilver(gate) });
    before = after;
  }
  paces = out;
  return out;
}

/** A campaign quest's silver at its level: some shot and wages, no fortune (a board's job of the level pays several times it). */
export function campaignSilver(level: number): number {
  return Math.round((30 + 9 * level) / 5) * 5;
}

/** A chapter's end: a purse a few quests' worth. */
export function chapterPurse(level: number): number {
  return campaignSilver(level) * 4;
}
