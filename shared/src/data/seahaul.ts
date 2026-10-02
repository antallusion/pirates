// docs/19 D1–D4 (owner, 2026-10-02: «увеличь всё ровно в 2 раза»; the rule: where twice as many finds would make a
// captain twice as rich, a cap on the captain, not fewer finds). Each source keeps the captain's count of the day: so
// many finds at their full worth for every hour she has been at sea that day (one hour's worth from the first), the
// rest at a quarter. Every find is still there and still pays. The counts are what a captain who sails for the finds
// alone took in an hour before the sea was doubled (tests/balance/density.ts), so the day's income from them stays
// between what it was and a quarter more: twice the finds at most come to 1 + ¼ of them.

export type HaulSource = 'marks' | 'life' | 'finds' | 'adv' | 'lairs' | 'roam';
export const HAUL_SOURCES: HaulSource[] = ['marks', 'life', 'finds', 'adv', 'lairs', 'roam'];

/** Finds at their full worth for each hour at sea in a day, by source (the sim's gleaner before D: marks 5–7, flotsam
 *  36–44, lairs 1–2.5, the map's open chests and mills under one; D5's small things are new: a day's modest share; D7's
 *  roaming stacks: about a steady hour's fights, past which their silver and spoils are half — the lesson never). */
export const HAUL: Record<HaulSource, number> = { marks: 5, life: 38, finds: 8, adv: 1, lairs: 1.2, roam: 20 };
/** What a find pays past the count. */
export const HAUL_THIN = 0.5;
/** A day of the real calendar (UTC) by the wall clock (ms). */
export const haulDay = (wallMs: number): number => Math.floor(wallMs / 86_400_000);

/** The share of its worth the next find of a source pays: `n` taken at their full worth already today, `seaSec` her
 *  seconds at sea today. */
export function haulMul(n: number, src: HaulSource, seaSec = 0): number {
  return n < HAUL[src] * Math.max(1, seaSec / 3600) ? 1 : HAUL_THIN;
}
