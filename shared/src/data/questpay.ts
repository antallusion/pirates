// The pay of one's choice (docs/11 P6), as a quest giver in WoW lays out the rewards: a job for a port is paid all
// in silver, or a part of it in fine shot from the port's magazine (heavy and fire shot worth more than the silver
// forgone), or a part of it in the port's favour (standing with its faction, doubled and more). Chosen when the
// job is taken; the experience is the same whichever way.

import { AMMO } from './ships.ts';

export type QuestPay = 'silver' | 'stores' | 'favour';
export const QUEST_PAYS: QuestPay[] = ['silver', 'stores', 'favour'];

/** The share of the silver kept when a part is taken in shot or favour. */
export const PAY_KEPT = 0.7;
/** Fine shot is worth this much more than the silver forgone for it. */
export const STORES_WORTH = 1.6;

/** Standing with the port's faction for a job done, by the job's level (docs/11 P6). */
export function questRep(level: number): number {
  return 2 + Math.min(6, Math.round(level / 10));
}

/** What a job pays by the choice: silver, standing, and the heavy and fire shot put aboard. */
export function questPayOf(pay: QuestPay, silver: number, level: number): { silver: number; rep: number; heavy: number; incendiary: number } {
  const rep = questRep(level);
  if (pay === 'silver') return { silver, rep, heavy: 0, incendiary: 0 };
  const kept = Math.round(silver * PAY_KEPT);
  if (pay === 'favour') return { silver: kept, rep: rep * 2 + 2, heavy: 0, incendiary: 0 };
  const worth = (silver - kept) * STORES_WORTH;
  return { silver: kept, rep, heavy: Math.floor(worth / 2 / AMMO.heavy.price), incendiary: Math.floor(worth / 2 / AMMO.incendiary.price) };
}

/**
 * A job's silver for the captain who does it (docs/16 P2: reasons to come back to the low waters): a port pays a
 * veteran more for the same work — 2.5% for every level she stands above the job, up to twice the job's own pay.
 */
export function veteranPay(captainLevel: number, jobLevel: number): number {
  return 1 + Math.min(1, Math.max(0, captainLevel - jobLevel) * 0.025);
}
