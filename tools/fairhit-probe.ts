// Owner, 2026-10-10: «9 матросов убили 20 моих матросов с одного удара … чини атаку всем»: one blow's fallen by level,
// beside what the two stack cards say (men × a man's mean roll × Attack − Defense × her side's lift on the card ÷ a man's
// hit points; the lift — her ship, her captain's skills and kit, backs to the rail — since 2026-10-10, stackBonus).
//
//   node --disable-warning=ExperimentalWarning tools/fairhit-probe.ts
//
// - sea 9→20: a ship of the sea's 9 deckhands strike her 20 (her captain of the level, the sea's of her waters);
// - sea 30→30 / pvp 30→30: 30 marines strike 30 marines, against the sea and between two captains of the level.

import { Rng } from '../shared/src/rng.ts';
import type { UnitId } from '../shared/src/data/army.ts';
import { flankOf, hexNeighbors } from '../shared/src/data/tactical.ts';
import { npcHeroBattle } from '../shared/src/data/hero.ts';
import { adMod, blow, newBattle, stackBonus } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacStack } from '../server/src/game/tacbattle.ts';
import { captainAt, side, slOf } from '../tests/balance/boardlen.ts';

function duel(L: number, u: UnitId, mine: number, theirs: number, pvp: boolean): TacBattle {
  const me = side([{ u, n: mine }], captainAt('corsair', L, 11), 'corsair', true);
  const foe = pvp ? side([{ u, n: theirs }], captainAt('admiral', L, 5), 'admiral', true) : side([{ u, n: theirs }], npcHeroBattle(slOf(L), null), null, false);
  return newBattle(me, foe, 7, 0, new Rng(7), { len: 'board', level: L });
}
const fells = (t: TacStack, dmg: number): number => {
  const hp = (t.count - 1) * t.hpMax + t.hpTop;
  return dmg >= hp ? t.count : t.count - Math.ceil((hp - dmg) / t.hpMax);
};
function one(L: number, u: UnitId, mine: number, theirs: number, pvp: boolean, foeStrikes: boolean): string {
  const bt = duel(L, u, mine, theirs, pvp);
  const a = bt.stacks.find((s) => s.side === (foeStrikes ? 1 : 0))!, t = bt.stacks.find((s) => s.side === (foeStrikes ? 0 : 1))!;
  const from = hexNeighbors(t.hex).find((h) => flankOf(t.face, t.hex, h) === 0)!;
  const dmg = blow(bt, a, t, 'melee', null, from).dmg;
  const stats = (a.count * (a.dmin + a.dmax)) / 2 * adMod(a.atk, t.def) * stackBonus(bt, a).melee * stackBonus(bt, t).taken;
  return `${fells(t, dmg)} (${dmg} hp; cards ${fells(t, stats)})`;
}

console.log('| L | sea 9 deckhands → her 20 | sea 30 marines → 30 | captain 30 marines → 30 |');
console.log('|---|---|---|---|');
for (const L of [1, 5, 10, 15, 20, 30, 40, 45, 50, 60]) {
  console.log(`| ${L} | ${one(L, 'deckhand', 20, 9, false, true)} | ${one(L, 'marine', 30, 30, false, true)} | ${one(L, 'marine', 30, 30, true, true)} |`);
}
