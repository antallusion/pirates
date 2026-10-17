// The island's loot from the creatures that live on islands (owner, 2026-10-17: «ускорители построек надо раскладывать
// как лут в существах, которые на островах обитают, то есть сражаясь с ними всякие плюшки для острова выпадают с
// разным шансом»). The lairs of the land (the shore lair, the grotto, the guardian: shared/src/data/lairs.ts) and the
// great ones ashore (shorebosses.ts) drop, beside their own spoils:
//  - build speed-ups: minutes into her store of speed-ups (5 min, 15 min, 1 h, 3 h — the bigger the rarer);
//  - a bundle of the island's goods (timber, coal, iron, tar) into her island's yard;
//  - a production booster: the island's harvest (+PROD_BOOST, the shop's own) for a few hours;
//  - rarely, a hired brigade for a day (the shop's own, up to its TEMP_MAX).
// The chances grow with the lair's size, its role in the island's chain and its level. The sea's creatures (the roaming
// stacks, the guards of the adventure map: ships and packs of the water) drop none of this.
// Balance (docs/29 §9): ≈ 7 minutes of speed-ups a lair at the middle levels — about the daily gift's share a day for an
// hour of lairs; a 290-doubloon pack of the shop is eight hours. Nothing here is power in a fight.
// Pure: the server rolls (server/src/game/isleloot.ts, its own Rng), the client shows the chances on the lair's card.

import type { LairRole, LairSize } from './lairs.ts';

export type IsleLootRes = 'timber' | 'coal' | 'iron' | 'tar';
export const ISLE_LOOT_RES: IsleLootRes[] = ['timber', 'coal', 'iron', 'tar'];
const RES_W = [35, 30, 20, 15];

export type IsleDrop =
  | { k: 'speed'; min: number }
  | { k: 'res'; good: IsleLootRes; n: number }
  | { k: 'prod'; hours: number }
  | { k: 'builder'; hours: number };

/** Where the drop comes from: a lair of the land, or a great one ashore. */
export type IsleLootSrc = { src: 'lair'; size: LairSize; role: LairRole; level: number } | { src: 'shore'; level: number };

/** The speed-up tokens (minutes into the store). */
export const SPEED_TOKENS = [5, 15, 60, 180] as const;
/** A day's hired brigade from the loot. */
export const LOOT_BUILDER_H = 24;

const SIZE_K: Record<LairSize, number> = { weak: 0, avg: 1, strong: 2 };
const ROLE_MUL: Record<LairRole, number> = { shore: 1, grotto: 1.15, guardian: 1.3 };
const SPEED_P = [0.2, 0.35, 0.5];
const RES_P = [0.25, 0.35, 0.45];
const PROD_P = [0.03, 0.05, 0.08];
const PROD_H = [2, 3, 4];
const BUILDER_P = [0.005, 0.01, 0.02];
const RES_MUL = [0.8, 1, 1.3];

export interface IsleLootTable {
  speed: number;
  /** Each token's weight (SPEED_TOKENS' order). */
  speedW: number[];
  res: number;
  resN: number;
  prod: number;
  prodH: number;
  builder: number;
}

const lv = (n: number) => Math.max(1, Math.min(10, Math.round(n)));

/** The token weights at a level: the higher, the more of the big ones. */
export function speedWeights(level: number): number[] {
  const L = Math.max(1, Math.min(14, level));
  return [64 - 3 * Math.min(10, L), 28, 6 + 1.2 * L, 1 + 0.3 * L];
}

/** The chances of a source. */
export function isleLootTable(s: IsleLootSrc): IsleLootTable {
  if (s.src === 'shore') {
    const L = lv(s.level);
    return { speed: 1, speedW: speedWeights(L + 4), res: 0.8, resN: 2 * (15 + 6 * L), prod: 0.25, prodH: 4, builder: 0.08 };
  }
  const k = SIZE_K[s.size], m = ROLE_MUL[s.role], L = lv(s.level);
  const cap = (p: number) => Math.min(0.95, p);
  return {
    speed: cap(SPEED_P[k] * m), speedW: speedWeights(L), res: cap(RES_P[k] * m), resN: Math.round(((15 + 6 * L) * RES_MUL[k] * m) / 5) * 5,
    prod: cap(PROD_P[k] * m), prodH: PROD_H[k], builder: cap(BUILDER_P[k] * (s.role === 'guardian' ? 2 : 1)),
  };
}

const pickW = (w: number[], r: number) => {
  const sum = w.reduce((a, x) => a + x, 0);
  let x = r * sum;
  for (let i = 0; i < w.length; i++) {
    x -= w[i];
    if (x < 0) return i;
  }
  return w.length - 1;
};

/** A roll of the drops (`rnd`: the server's own Rng); `thin` (the day's count past: shared/src/data/seahaul.ts) scales
 *  every chance. */
export function rollIsleLoot(s: IsleLootSrc, rnd: () => number, thin = 1): IsleDrop[] {
  const t = isleLootTable(s);
  const out: IsleDrop[] = [];
  const k = Math.max(0, Math.min(1, thin));
  if (rnd() < t.speed * k) out.push({ k: 'speed', min: SPEED_TOKENS[pickW(t.speedW, rnd())] });
  if (rnd() < t.res * k) out.push({ k: 'res', good: ISLE_LOOT_RES[pickW(RES_W, rnd())], n: t.resN });
  if (rnd() < t.prod * k) out.push({ k: 'prod', hours: t.prodH });
  if (rnd() < t.builder * k) out.push({ k: 'builder', hours: LOOT_BUILDER_H });
  return out;
}

/** The minutes of speed-ups a source gives on average. */
export function expectedMinutes(s: IsleLootSrc): number {
  const t = isleLootTable(s);
  const sum = t.speedW.reduce((a, x) => a + x, 0);
  return t.speed * t.speedW.reduce((a, w, i) => a + w * SPEED_TOKENS[i], 0) / sum;
}

/** The card's «Возможная добыча»: each kind of drop and its chance (the speed-up's most likely token). */
export function lootChances(s: IsleLootSrc): { k: IsleDrop['k']; p: number; min?: number[]; n?: number; hours?: number }[] {
  const t = isleLootTable(s);
  const sum = t.speedW.reduce((a, x) => a + x, 0);
  const tokens = SPEED_TOKENS.filter((_, i) => t.speedW[i] / sum >= 0.01);
  return [
    { k: 'speed', p: t.speed, min: [...tokens] },
    { k: 'res', p: t.res, n: t.resN },
    { k: 'prod', p: t.prod, hours: t.prodH },
    { k: 'builder', p: t.builder, hours: LOOT_BUILDER_H },
  ];
}
