// docs/16 #38: a piece of gear beside what is worn in its slot — every line of either, the two values and the
// difference, green where the new piece is better and red where it is worse (some lines are better lower).

import { gearSource } from '../../../shared/src/data/items.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import type { StatKey } from '../../../shared/src/data/stats.ts';

/** Stats where less is better (a green minus). */
export const LOWER_BETTER = new Set<StatKey>(['reloadMul', 'spreadMul', 'fireRisk', 'leakInflow', 'signature', 'moraleLoss', 'sanityLoss', 'spoilage', 'stormSailDamage', 'stormHull', 'dutyMul', 'buyMul', 'provisionUse', 'incomingDamageMul']);

export interface CmpRow {
  /** A ship stat, or a captain's (`cap`). */
  kind: 'stat' | 'cap';
  key: string;
  /** This piece's value, the worn one's, and this less that. */
  a: number;
  b: number;
  d: number;
  /** Whether the difference is a gain for her; null when there is none. */
  good: boolean | null;
}

/** The rows of the comparison: every line either piece has, gains first then losses then the equal, each by size. */
export function compareRows(it: Item, cur: Item | undefined | null): CmpRow[] {
  const a = gearSource([it]), b = gearSource(cur ? [cur] : []);
  const rows: CmpRow[] = [];
  const keys = new Set([...Object.keys(a.mods), ...Object.keys(b.mods)]) as Set<StatKey>;
  for (const k of keys) {
    const va = a.mods[k] ?? 0, vb = b.mods[k] ?? 0;
    if (Math.abs(va) < 1e-9 && Math.abs(vb) < 1e-9) continue;
    const d = va - vb;
    rows.push({ kind: 'stat', key: k, a: va, b: vb, d, good: Math.abs(d) < 1e-6 ? null : LOWER_BETTER.has(k) ? d < 0 : d > 0 });
  }
  const caps = new Set([...Object.keys(a.cap), ...Object.keys(b.cap)]);
  for (const c of caps) {
    const va = a.cap[c as never] ?? 0, vb = b.cap[c as never] ?? 0;
    if (!va && !vb) continue;
    const d = va - vb;
    rows.push({ kind: 'cap', key: c, a: va, b: vb, d, good: d === 0 ? null : d > 0 });
  }
  const rank = (r: CmpRow) => (r.good === true ? 0 : r.good === false ? 1 : 2);
  return rows.sort((x, y) => rank(x) - rank(y) || Math.abs(y.d) - Math.abs(x.d) || x.key.localeCompare(y.key));
}

/** The balance of it: how many lines gain and how many lose. */
export function compareTally(rows: CmpRow[]): { up: number; down: number } {
  return { up: rows.filter((r) => r.good === true).length, down: rows.filter((r) => r.good === false).length };
}
