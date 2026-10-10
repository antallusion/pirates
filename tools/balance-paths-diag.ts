// A diagnostic for tools/balance-paths.ts (docs/25 item 70): each path's wins against all under the boarding's rules
// (real builds: her level's skills and kit, tests/balance/boardlen.ts) with parts of her path taken away — what each
// part is worth to her at a level. (In her mirror the innate move goes from both sides.)
//   node tools/balance-paths-diag.ts [battles a pairing] [--levels=5,30] [--paths=navigator,admiral] [--variants=full,noKit]
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import type { HeroBattle } from '../shared/src/data/hero.ts';
import { INNATE, isPathPage } from '../shared/src/data/paths.ts';
import { TAC_BOOK } from '../shared/src/data/tactical.ts';
import { playBoard, sidesAt } from '../tests/balance/boardlen.ts';

const arg = (k: string): string | undefined => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const n = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 24);
const LEVELS = (arg('levels') ?? '5,15,30,45,60').split(',').map(Number);
const WHO = (arg('paths')?.split(',') ?? CAPTAIN_IDS) as CaptainId[];

type Variant = { hero?: (h: HeroBattle, p: CaptainId) => HeroBattle; innate?: boolean };
const VARIANTS: Record<string, Variant> = {
  full: {},
  noInnate: { innate: false },
  noUlt: { hero: (h) => ({ ...h, ult: false }) },
  noPages: { hero: (h) => ({ ...h, book: h.book.filter((id) => !isPathPage(id)) }) },
  noOwnOrder: { hero: (h, p) => ({ ...h, book: h.book.filter((id) => id !== TAC_BOOK[p][0]) }) },
  noCommon: { hero: (h, p) => ({ ...h, book: h.book.filter((id) => isPathPage(id) || id === TAC_BOOK[p][0]) }) },
  // docs/25 item 70: her whole path kit — the innate move, the ultimate and her path's pages.
  noKit: { innate: false, hero: (h) => ({ ...h, ult: false, book: h.book.filter((id) => !isPathPage(id)) }) },
};
const ONLY = arg('variants')?.split(',');

/** Her wins against every path (`n` a pairing, the sides swapped by turns), the variant on her side alone. */
function winsOf(p: CaptainId, L: number, v: Variant): number {
  const keep = INNATE[p].fx;
  if (v.innate === false) INNATE[p].fx = { target: 'none' };
  let w = 0, k = 0;
  CAPTAIN_IDS.forEach((q, j) => {
    for (let i = 0; i < n; i++) {
      const flip = i % 2 === 1;
      const [a, b] = sidesAt(L, true, flip ? q : p, flip ? p : q, 9000 + i * 13 + j * 7);
      const mine = flip ? b : a;
      if (v.hero && mine.hero) mine.hero = v.hero(mine.hero, p);
      if ((playBoard(a, b, 9000 + i * 31 + j * 5 + L).winner === 0) !== flip) w++;
      k++;
    }
  });
  INNATE[p].fx = keep;
  return w / k;
}

for (const L of LEVELS) {
  console.log(`\nLevel ${L}: her wins against all (${n * 6} battles), parts of her path taken away`);
  for (const p of WHO) console.log(`  ${p.padEnd(10)} ${Object.entries(VARIANTS).filter(([name]) => !ONLY || ONLY.includes(name)).map(([name, v]) => `${name} ${Math.round(winsOf(p, L, v) * 100)}%`).join(' · ')}`);
}
