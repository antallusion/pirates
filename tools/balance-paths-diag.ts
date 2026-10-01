// A diagnostic for tools/balance-paths.ts: each path against the sea of her level with parts of her path taken away.
// node tools/balance-paths-diag.ts [n] [level]
import { Rng } from '../shared/src/rng.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import type { HeroBattle } from '../shared/src/data/hero.ts';
import { isPathPage } from '../shared/src/data/paths.ts';
import { newBattle, quickFinish } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { HAMMOCKS, pathHero, seaHero } from './balance-paths.ts';

const n = Number(process.argv[2] ?? 60);
const level = Number(process.argv[3] ?? 30);
const sl = Math.min(10, Math.ceil(level / 6));
const army = armyForLevel(sl, HAMMOCKS[sl], 7, 'player'), pir = armyForLevel(sl, HAMMOCKS[sl], 7, 'pirate');
const side = (a: typeof army, hero: HeroBattle): TacSideInput => ({ name: 'C', ship: 'W', captain: null, hands: 0, marines: 0, gunners: 0, army: a, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, hero });
const variants: Record<string, (h: HeroBattle) => HeroBattle> = {
  full: (h) => h,
  ...(process.argv.includes('--quick') ? {} : { noUlt: (h: HeroBattle) => ({ ...h, ult: false }),
  noInnateUlt: (h: HeroBattle) => ({ ...h, ult: false, path: null }),
  noPages: (h: HeroBattle) => ({ ...h, book: h.book.filter((id) => !isPathPage(id)) }),
  noStam: (h: HeroBattle) => ({ ...h, stam: 0, stamRegen: 0 }) }),
  bare: (h) => ({ ...h, ult: false, path: null, book: h.book.filter((id) => !isPathPage(id)) }),
};
for (const c of CAPTAIN_IDS) {
  const row: string[] = [];
  for (const [name, f] of Object.entries(variants)) {
    let w = 0;
    for (let k = 0; k < 2 * n; k++) {
      const rng = new Rng(1000 + k * 17);
      const flip = k % 2 === 1;
      const A = side(army, f(pathHero(c, level, 11 + k * 7))), B = side(pir, seaHero(sl));
      const bt = newBattle(flip ? B : A, flip ? A : B, k + 1, 0, rng);
      quickFinish(bt, 0, rng);
      if ((bt.over!.winner === 0) !== flip) w++;
    }
    row.push(`${name} ${Math.round((w / (2 * n)) * 100)}%`);
  }
  console.log(`${c.padEnd(10)} ${row.join(' · ')}`);
}
