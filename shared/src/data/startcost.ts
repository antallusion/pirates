// The island's cheap start (owner, 2026-10-28: «может там никто не строит потому что ресурсов надо дофига? может до 2
// уровня зданий сделать все почти бесплатно? прям оч мало ресурсов»). The live server's island owners (a copy of
// 2026-10-28: 28 islands, 23 with the hall alone) held 200–4 000 silver aboard, 0–3 000+ in the treasury, a yard of
// 30–200 timber and next to no coal, tar or iron. So every island building's first two levels cost next to nothing:
//   - level 1: 40–300 silver and 3–8 timber (the first logging camp silver alone) (what only the sea has — powder, pearls, rum, weapons — a quarter of before);
//   - level 2: 100–600 silver (never above the hall's own second level), 5–25 timber and a few of the yard's coal, tar and iron where the building asked them;
//   - level 3: halfway (geometrically) between the new level 2 and the old level 4, so the curve has no cliff;
//   - level 4 and up: as before. The building times stay as they were.
// The whole first-level set of an island (the town and the base) comes to ~2 500 silver and ~90 timber.

import type { GoodId } from './goods.ts';

export interface StartCost {
  silver: number;
  goods: Partial<Record<GoodId, number>>;
  secs: number;
}

const YARD: GoodId[] = ['timber', 'coal', 'tar', 'iron'];
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const r10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);
const r50 = (n: number) => Math.max(50, Math.round(n / 50) * 50);
const sum = (g: Partial<Record<GoodId, number>>) => Object.values(g).reduce((a, n) => a + (n ?? 0), 0);

/** Level 1 from the old level 1 (a free one — the claim's hall — stays free). */
export function startL1(o1: StartCost): StartCost {
  if (o1.silver <= 0 && sum(o1.goods) <= 0) return { silver: 0, goods: {}, secs: o1.secs };
  // (what asked nothing but silver — the first logging camp — still asks no timber: an island with an empty yard starts)
  const goods: Partial<Record<GoodId, number>> = sum(o1.goods) > 0 ? { timber: clamp(Math.ceil(Math.max(o1.goods.timber ?? 0, 20) * 0.12), 3, 8) } : {};
  for (const [g, n] of Object.entries(o1.goods) as [GoodId, number][]) if (!YARD.includes(g) && n > 0) goods[g] = Math.max(1, Math.ceil(n * 0.25));
  return { silver: r10(clamp(o1.silver * 0.1, 40, 300)), goods, secs: o1.secs };
}

/** Level 2 from the old level 2, above the new level 1. */
export function startL2(o2: StartCost, l1: StartCost): StartCost {
  const t = l1.goods.timber ?? 3;
  const goods: Partial<Record<GoodId, number>> = { timber: clamp(Math.ceil((o2.goods.timber ?? 20) * 0.2), t + 2, 25) };
  if (o2.goods.coal) goods.coal = clamp(Math.ceil(o2.goods.coal * 0.2), 3, 12);
  if (o2.goods.tar) goods.tar = clamp(Math.ceil(o2.goods.tar * 0.2), 2, 8);
  if (o2.goods.iron) goods.iron = clamp(Math.ceil(o2.goods.iron * 0.2), 2, 6);
  for (const [g, n] of Object.entries(o2.goods) as [GoodId, number][]) if (!YARD.includes(g) && n > 0) goods[g] = Math.max(1, Math.ceil(n * 0.25));
  // (what level 1 brought from the sea is not asked again: its sum may fall — the guns' weapons — as it did before)
  return { silver: Math.max(l1.silver + 50, r10(clamp(o2.silver * 0.1, 100, 600))), goods, secs: o2.secs };
}

/** Level 3: the geometric middle of the new level 2 and the old level 4 (no cliff), its own time. */
export function startL3(o3: StartCost, o4: StartCost, l2: StartCost): StartCost {
  const goods: Partial<Record<GoodId, number>> = {};
  for (const [g, n] of Object.entries(o3.goods) as [GoodId, number][]) {
    const hi = o4.goods[g] ?? n;
    goods[g] = Math.max(l2.goods[g] ?? 1, Math.ceil(Math.sqrt(Math.max(1, l2.goods[g] ?? 1) * hi)));
  }
  for (const [g, n] of Object.entries(l2.goods) as [GoodId, number][]) goods[g] = Math.max(goods[g] ?? 0, n);
  const silver = Math.min(Math.max(o4.silver - 50, l2.silver + 50), Math.max(l2.silver + 50, r50(Math.sqrt(l2.silver * o4.silver))));
  return { silver, goods, secs: o3.secs };
}

/** A building's cost at a level with the cheap start laid over its old costs (`old(L)`). */
export function cheapStart(old: (level: number) => StartCost, level: number): StartCost {
  const L = Math.max(1, Math.round(level));
  if (L >= 4) return old(L);
  const l1 = startL1(old(1));
  if (L === 1) return l1;
  const l2 = startL2(old(2), l1);
  if (L === 2) return l2;
  return startL3(old(3), old(4), l2);
}
