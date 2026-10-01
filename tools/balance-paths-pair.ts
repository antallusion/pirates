// One pair of paths at a level, with parts of the second's path taken away: node tools/balance-paths-pair.ts a b level [n]
import { Rng } from '../shared/src/rng.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import type { HeroBattle } from '../shared/src/data/hero.ts';
import { isPathPage } from '../shared/src/data/paths.ts';
import { newBattle, quickFinish } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { HAMMOCKS, pathHero } from './balance-paths.ts';

const [a, b] = [process.argv[2] as CaptainId, process.argv[3] as CaptainId];
const level = Number(process.argv[4] ?? 55), n = Number(process.argv[5] ?? 300);
const sl = Math.min(10, Math.ceil(level / 6));
const army = armyForLevel(sl, HAMMOCKS[sl], 7, 'player');
const side = (hero: HeroBattle, c: CaptainId): TacSideInput => ({ name: 'C', ship: 'W', captain: c, hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, hero });
const variants: Record<string, (h: HeroBattle) => HeroBattle> = {
  full: (h) => h, noUlt: (h) => ({ ...h, ult: false }), noMoves: (h) => ({ ...h, ult: false, path: null }), noPages: (h) => ({ ...h, book: h.book.filter((id) => !isPathPage(id)) }),
};
for (const [name, f] of Object.entries(variants)) {
  let w = 0;
  for (let k = 0; k < 2 * n; k++) {
    const rng = new Rng(1000 + k * 17);
    const flip = k % 2 === 1;
    const A = side(pathHero(a, level, 11 + k * 7), a), B = side(f(pathHero(b, level, 5 + k * 13)), b);
    const bt = newBattle(flip ? B : A, flip ? A : B, k + 1, 0, rng);
    quickFinish(bt, 0, rng);
    if ((bt.over!.winner === 0) !== flip) w++;
  }
  console.log(`${a} vs ${b} (${name}) at ${level}: ${Math.round((w / (2 * n)) * 100)}%`);
}
