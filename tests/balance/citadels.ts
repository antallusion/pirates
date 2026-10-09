// docs/19 E4–E8: the siege of a citadel — the ladder's ⚓10 crew (times `gear`: her hero, glory, mastery and artifacts as
// a share of men) assaults the garrison before its walls, fresh for every assault, against what is left of the garrison
// and the wall line from the assault before (a siege wears both down within its window); both sides played by the sea's
// mind. The ship's broadside before each assault (`bombard` balls), the catapult (a stone a round), the two towers.
//
// The table: node --disable-warning=ExperimentalWarning -e "import('./tests/balance/citadels.ts').then((m) => console.log(m.siegeTable(1.3, 40)))"

import { armyForLevel } from '../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../shared/src/data/army.ts';
import { CIT_TOWER, citGarrison, citSpellHp } from '../../shared/src/data/citadels.ts';
import { Rng } from '../../shared/src/rng.ts';
import { newBattle, quickFinish, siegeLeft } from '../../server/src/game/tacbattle.ts';
import type { SiegeInput, TacSideInput } from '../../server/src/game/tacbattle.ts';

const side = (army: ArmyStack[], captain: TacSideInput['captain']): TacSideInput => ({
  name: 'x', ship: 'y', captain, hands: 0, marines: 0, gunners: 0, army: army.map((x) => ({ u: x.u, n: x.n, src: x.u })), officers: [], skill: 3,
  morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false,
});

/** A captain of the cap's crew, `gear` times the ladder's ⚓10. */
export const capCrew = (gear: number): ArmyStack[] => armyForLevel(10, 600, 7, 'player').map((x) => ({ ...x, n: Math.round(x.n * gear) }));

export interface SiegeOpts {
  bombard?: number;
  catapult?: number;
  tower?: number;
  type?: string;
}

/** One assault: her crew against the garrison as it stands and the wall line as it was left. */
export function assault(me: ArmyStack[], garrison: ArmyStack[], hp: number[] | undefined, seed: number, o: SiegeOpts = {}): { won: boolean; left: ArmyStack[]; hp: number[]; rounds: number } {
  const rng = new Rng(seed);
  const siege: SiegeInput = { type: o.type ?? 'rocky', ...(hp ? { hp } : {}), bombard: o.bombard ?? 2, catapult: o.catapult ?? 1, tower: o.tower ?? CIT_TOWER };
  const bt = newBattle(side(me, 'corsair'), { ...side(garrison, 'admiral'), spellHp: citSpellHp(10) }, seed, 0, rng, { siege });
  quickFinish(bt, 0, rng);
  const left = bt.stacks.filter((s) => s.side === 1 && s.count > 0).map((s) => ({ u: s.unit as UnitId, n: s.count }));
  return { won: bt.over!.winner === 0, left, hp: siegeLeft(bt)!, rounds: bt.round };
}

/** Of `runs` sieges by `k` captains (each one assault, in turn), how many took the full garrison (`mul`: of a garrison
 *  this share of the full one). */
export function siegeTaken(k: number, gear: number, runs: number, o: SiegeOpts = {}, level: 9 | 10 = 10, mul = 1): number {
  let taken = 0;
  for (let run = 0; run < runs; run++) {
    let g = citGarrison(level, mul), hp: number[] | undefined;
    for (let i = 0; i < k; i++) {
      // The guild's captains are not all geared alike: each from four-fifths to six-fifths of `gear`.
      const u = new Rng(5000 + run * 977 + i * 31).float();
      const r = assault(capCrew(gear * (0.8 + 0.4 * u)), g, hp, 7000 + run * 131 + i * 17, o);
      if (r.won) {
        taken++;
        break;
      }
      g = r.left;
      hp = r.hp;
    }
  }
  return taken / runs;
}

const scaled = (k: number): ArmyStack[] => citGarrison(10).map((x) => ({ u: x.u, n: Math.max(1, Math.round(x.n * k)) }));

/** The share of a full garrison that stands an even fight with her crew in the open (no walls): the same two armies win
 *  half each (bisected on the garrison's size). Her army and the garrison's are of different tiers, so the even match is
 *  found by the battle itself, not by a sum of their weights. */
export function evenShare(gear: number, runs: number): number {
  const me = capCrew(gear);
  let lo = 0.05, hi = 1.5;
  for (let it = 0; it < 9; it++) {
    const mid = (lo + hi) / 2;
    if (openWins(me, scaled(mid), runs) > 0.5) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function openWins(me: ArmyStack[], g: ArmyStack[], runs: number): number {
  let won = 0;
  for (let run = 0; run < runs; run++) {
    const rng = new Rng(9000 + run * 37);
    const bt = newBattle(side(me, 'corsair'), { ...side(g, 'admiral'), spellHp: citSpellHp(10) }, 9000 + run * 37, 0, rng, { land: 'rocky' });
    quickFinish(bt, 0, rng);
    if (bt.over!.winner === 0) won++;
  }
  return won / runs;
}

/** One assault on a garrison of equal strength (the even match of the open field, evenShare): how often the attacker
 *  carries the walls (docs/19 E17 asks 35–45%). */
export function equalSiege(gear: number, runs: number, o: SiegeOpts = {}, share = evenShare(gear, runs)): number {
  const me = capCrew(gear);
  const g = scaled(share);
  let won = 0;
  for (let run = 0; run < runs; run++) if (assault(me, g, undefined, 9000 + run * 37, o).won) won++;
  return won / runs;
}

/** The whole table: equal strength in a siege (and the even share of a full garrison); a full garrison taken by 1…5. */
export function siegeTable(gear: number, runs: number): string {
  const share = evenShare(gear, runs);
  const rows = [`equal strength (${Math.round(share * 100)}% of a full garrison): siege ${Math.round(equalSiege(gear, runs, {}, share) * 100)}%, open field ${Math.round(openWins(capCrew(gear), scaled(share), runs) * 100)}%`];
  for (let k = 1; k <= 5; k++) rows.push(`${k} captain(s): ⚓10 ${Math.round(siegeTaken(k, gear, runs) * 100)}%, ⚓9 ${Math.round(siegeTaken(k, gear, runs, {}, 9) * 100)}%`);
  return rows.join('\n');
}
