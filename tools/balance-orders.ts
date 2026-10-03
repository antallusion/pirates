// The order book's common orders weighed one against another (docs/17's and the pages after docs/18, BOOK_PAGES in
// shared/src/data/paths.ts): a captain with one order in her book against her twin with none — the same army, the same
// primaries, both ways round, and her side a tenth fewer men (the battle is steep: an even fight is all but won by any
// order). What an order is worth is how many of those fights it wins, and how much of her strength it keeps; an order
// should sit among those of its level. `--foe=sea`: the twin gives the sea's book of her waters (npcBook), so the
// orders against hers (the clearing wind, the silent fog) are weighed too.
//   node tools/balance-orders.ts [battles an order] [--level=30] [--short=0.1] [--foe=sea] [--only=id,id]

import { Rng } from '../shared/src/rng.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { LEARNABLE, ORDERS, heroBattle, npcBook, orderRes, zeroPrims } from '../shared/src/data/hero.ts';
import type { OrderId } from '../shared/src/data/hero.ts';
import { isBookPage } from '../shared/src/data/paths.ts';
import { newBattle, quickFinish, tacStats } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput } from '../server/src/game/tacbattle.ts';
import { HAMMOCKS } from './balance-paths.ts';

const N = Number(process.argv[2] ?? 120);
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const LEVEL = Number(arg('level', '30'));
const SHORT = Number(arg('short', '0.1'));
const ONLY = arg('only', '').split(',').filter(Boolean);
const FOE = arg('foe', '');

const sl = Math.min(10, Math.ceil(LEVEL / 6));
const army = armyForLevel(sl, HAMMOCKS[sl], 7, 'player');
const fewer: ArmyStack[] = army.map((x) => ({ ...x, n: Math.max(1, Math.round(x.n * (1 - SHORT))) }));
/** A captain of her level with an even hand of primaries (a fifth of her levels in each, as the sea's), no path. */
const hero = (book: OrderId[]) => {
  const p = Math.round(LEVEL / 5) + 1;
  const prim = { ...zeroPrims(), atk: p, def: p, pow: p, will: p };
  return heroBattle(prim, [], null, book, 10 * p, { path: null, level: LEVEL });
};
const side = (a: ArmyStack[], book: OrderId[]): TacSideInput => ({
  name: 'C', ship: 'W', captain: null, hands: 0, marines: 0, gunners: 0, army: a, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1,
  extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, hero: hero(book),
});
const left = (bt: TacBattle, s: 0 | 1) => bt.stacks.filter((x) => x.side === s).reduce((n, x) => n + Math.max(0, x.count), 0) / Math.max(1, bt.heroes[s].startMen);

function weigh(book: OrderId[]): { win: number; keep: number } {
  let win = 0, keep = 0;
  for (let k = 0; k < N; k++) {
    const rng = new Rng(4000 + k * 31);
    const flip = k % 2 === 1;
    const A = side(fewer, book), B = side(army, FOE === 'sea' ? npcBook(sl) : []);
    const bt = newBattle(flip ? B : A, flip ? A : B, k + 1, 0, rng);
    quickFinish(bt, 0, rng);
    const me = flip ? 1 : 0;
    if (bt.over!.winner === me) win++;
    keep += left(bt, me) - left(bt, (1 - me) as 0 | 1);
  }
  return { win: win / N, keep: keep / N };
}

const list = (ONLY.length ? ONLY as OrderId[] : LEARNABLE).filter((id) => ORDERS[id].use === 'battle').sort((a, b) => ORDERS[a].level - ORDERS[b].level || ORDERS[a].school.localeCompare(ORDERS[b].school));
const base = weigh([]);
console.log(`Level ${LEVEL} (⚓${sl}, ${HAMMOCKS[sl]} men, her side ${Math.round(SHORT * 100)}% fewer${FOE === 'sea' ? ", the twin with the sea's book" : ''}), ${N} battles an order. No order: wins ${Math.round(base.win * 100)}%, keeps ${base.keep.toFixed(2)}.`);
tacStats.on = true;
for (const id of list) {
  tacStats.casts.clear();
  const r = weigh([id]);
  const casts = [...tacStats.casts].reduce((n, [k, x]) => n + (k.endsWith(`:${id}`) ? x : 0), 0) / N;
  const d = ORDERS[id];
  console.log(`  L${d.level} ${d.school.padEnd(5)} ${(isBookPage(id) ? '+' : ' ')}${id.padEnd(18)} ${String(d.cost).padStart(2)} ${orderRes(id).padEnd(4)}  wins ${String(Math.round(r.win * 100)).padStart(3)}%  keeps ${r.keep >= 0 ? ' ' : ''}${r.keep.toFixed(2)}  casts ${casts.toFixed(1)}`);
}
