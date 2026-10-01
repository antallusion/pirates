// docs/18 item 11: the paths' balance — every path against every path at hero levels 10/30/55 with their books, and
// each path against the sea's captain of her own waters (a pirate's army, the sea's book).
//   node tools/balance-paths.ts [battles a pair]            the table
//   node tools/balance-paths.ts 300 --h2                    the reckoning before docs/18 (H2's books, no paths)
//   node tools/balance-paths.ts 60 --tune                   nudge PATH_POWER towards 50% among paths and 60% at sea

import { Rng } from '../shared/src/rng.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { heroBattle, npcHeroBattle, primsAtLevel, startingOrders } from '../shared/src/data/hero.ts';
import type { HeroBattle } from '../shared/src/data/hero.ts';
import { MOVE_POWER, PATH_POWER, PATH_POWER_AT, clearPowered } from '../shared/src/data/paths.ts';
import { newBattle, quickFinish } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';

const N = Number(process.argv[2] ?? 120);
/** `--h2`: the reckoning before docs/18 (no paths in the battle, the sea's captains with the corsair's book). */
const H2 = process.argv.includes('--h2');
const TUNE = process.argv.includes('--tune');
const SEA_ONLY = process.argv.includes('--sea');
const LEVELS = (process.argv.find((a) => a.startsWith('--levels='))?.slice(9) ?? '10,30,55').split(',').map(Number);
export const HAMMOCKS = [0, 40, 60, 80, 110, 140, 180, 220, 300, 400, 600];

const side = (army: ArmyStack[], hero: HeroBattle, captain: CaptainId | null): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain, hands: 0, marines: 0, gunners: 0, army, officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1,
  extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, hero,
});

/** A captain of her path at her level with her book, her primaries grown on a seed. */
export function pathHero(c: CaptainId, level: number, seed: number, h2 = H2): HeroBattle {
  const prim = primsAtLevel(c, seed, level);
  return h2 ? heroBattle(prim, [], null, startingOrders(c), prim.will * 10) : heroBattle(prim, [], null, startingOrders(c), prim.will * 10, { path: c, level });
}
export const seaHero = (sl: number, h2 = H2): HeroBattle => (h2 ? npcHeroBattle(sl, 'corsair') : npcHeroBattle(sl, null));

function fight(A: TacSideInput, B: TacSideInput, k: number): boolean {
  const rng = new Rng(1000 + k * 17);
  const flip = k % 2 === 1;
  const bt = newBattle(flip ? B : A, flip ? A : B, k + 1, 0, rng);
  quickFinish(bt, 0, rng);
  return (bt.over!.winner === 0) !== flip;
}

export interface Table {
  level: number;
  /** m[a][b]: a's wins against b. */
  m: Record<CaptainId, Record<CaptainId, number>>;
  sea: Record<CaptainId, number>;
}

/** One level's table: each pair fought `n` times a way round (2n battles, the sides swapped), each path against the
 *  sea `2n` times. */
export function table(level: number, n: number, h2 = H2): Table {
  const sl = Math.min(10, Math.ceil(level / 6));
  const M = HAMMOCKS[sl];
  const army = armyForLevel(sl, M, 7, 'player');
  const pir = armyForLevel(sl, M, 7, 'pirate');
  const m = {} as Table['m'];
  const sea = {} as Table['sea'];
  for (const a of CAPTAIN_IDS) m[a] = { [a]: 0.5 } as Record<CaptainId, number>;
  CAPTAIN_IDS.forEach((a, i) => {
    for (const b of SEA_ONLY ? [] : CAPTAIN_IDS.slice(i + 1)) {
      let w = 0;
      for (let k = 0; k < 2 * n; k++) if (fight(side(army, pathHero(a, level, 11 + k * 7, h2), a), side(army, pathHero(b, level, 5 + k * 13, h2), b), k)) w++;
      m[a][b] = w / (2 * n);
      m[b][a] = 1 - w / (2 * n);
    }
    let s = 0;
    for (let k = 0; k < 2 * n; k++) if (fight(side(army, pathHero(a, level, 11 + k * 7, h2), a), side(pir, seaHero(sl, h2), null), k)) s++;
    sea[a] = s / (2 * n);
  });
  return { level, m, sea };
}

const pc = (x: number) => `${Math.round(x * 100)}`.padStart(3);
export function print(t: Table): void {
  const sl = Math.min(10, Math.ceil(t.level / 6));
  console.log(`\nLevel ${t.level} (⚓${sl}, ${HAMMOCKS[sl]} men): the row path's wins against the column's`);
  console.log(`            ${CAPTAIN_IDS.map((c) => c.slice(0, 8).padStart(9)).join('')}   avg   sea`);
  let lo = 1, hi = 0;
  for (const a of CAPTAIN_IDS) {
    const row = CAPTAIN_IDS.map((b) => t.m[a][b]);
    for (const b of CAPTAIN_IDS) if (b !== a) {
      lo = Math.min(lo, t.m[a][b]);
      hi = Math.max(hi, t.m[a][b]);
    }
    const avg = CAPTAIN_IDS.filter((b) => b !== a).reduce((x, b) => x + t.m[a][b], 0) / (CAPTAIN_IDS.length - 1);
    console.log(`  ${a.padEnd(10)}${row.map((x) => `${pc(x)}%`.padStart(9)).join('')}  ${pc(avg)}%  ${pc(t.sea[a])}%`);
  }
  const sv = Object.values(t.sea);
  console.log(`  path vs path ${pc(lo)}–${pc(hi)}% · path vs the sea ${pc(Math.min(...sv))}–${pc(Math.max(...sv))}%`);
}

if (import.meta.main ?? process.argv[1]?.endsWith('balance-paths.ts')) {
  if (TUNE) {
    // Each path's power at each of PATH_POWER_AT's levels, nudged towards 50% among the paths and 60% at sea.
    const iters = Number(process.argv.find((a) => a.startsWith('--iters='))?.slice(8) ?? 6);
    for (let it = 0; it < iters; it++) {
      const ts = PATH_POWER_AT.map((l) => table(l, N));
      const line: string[] = [];
      for (const c of CAPTAIN_IDS) {
        const parts: string[] = [];
        ts.forEach((t, i) => {
          const p = CAPTAIN_IDS.filter((b) => b !== c).reduce((x, b) => x + t.m[c][b], 0) / 5;
          const s = t.sea[c];
          const k0 = PATH_POWER[c][i];
          PATH_POWER[c][i] = Math.max(0.1, Math.min(3, k0 * Math.exp(1.0 * ((0.5 - p) + (0.6 - s)))));
          parts.push(`${pc(p)}/${pc(s)}`);
        });
        line.push(`${c} ${parts.join(' ')}`);
      }
      clearPowered();
      console.log(`#${it}: ${line.join(' · ')}`);
      console.log(`  ${JSON.stringify(Object.fromEntries(CAPTAIN_IDS.map((c) => [c, PATH_POWER[c].map((x) => Math.round(x * 100) / 100)])))}`);
    }
  } else if (process.argv.includes('--search')) {
    // A coordinate search on each level's six figures (the same battles each time, so a change is weighed fairly):
    // every pair as near 50% as the dice let it be (within 5), every path 53–67% at sea.
    const cost = (t: Table) => {
      let j = 0;
      CAPTAIN_IDS.forEach((a, i) => {
        for (const b of CAPTAIN_IDS.slice(i + 1)) j += Math.max(0, Math.abs(t.m[a][b] - 0.5) - 0.05) ** 2;
        j += Math.max(0, Math.abs(t.sea[a] - 0.6) - 0.07) ** 2;
      });
      return j;
    };
    const sweeps = Number(process.argv.find((a) => a.startsWith('--sweeps='))?.slice(9) ?? 3);
    const STEP = Number(process.argv.find((a) => a.startsWith('--step='))?.slice(7) ?? 1.2);
    PATH_POWER_AT.forEach((level, li) => {
      if (!LEVELS.includes(level)) return;
      let best = cost(table(level, N));
      for (let sw = 0; sw < sweeps; sw++) {
        for (const tab of level >= 20 || process.argv.includes('--moves') ? [PATH_POWER, MOVE_POWER] : [PATH_POWER, MOVE_POWER]) for (const c of CAPTAIN_IDS) {
          const k0 = tab[c][li];
          for (const f of [STEP, 1 / STEP]) {
            tab[c][li] = k0 * f;
            clearPowered();
            const j = cost(table(level, N));
            if (j < best - 1e-9) {
              best = j;
              break;
            }
            tab[c][li] = k0;
            clearPowered();
          }
        }
        console.log(`level ${level} sweep ${sw}: cost ${best.toFixed(4)} pages ${JSON.stringify(Object.fromEntries(CAPTAIN_IDS.map((c) => [c, Math.round(PATH_POWER[c][li] * 100) / 100])))} moves ${JSON.stringify(Object.fromEntries(CAPTAIN_IDS.map((c) => [c, Math.round(MOVE_POWER[c][li] * 100) / 100])))}`);
      }
    });
    console.log('PATH_POWER', JSON.stringify(Object.fromEntries(CAPTAIN_IDS.map((c) => [c, PATH_POWER[c].map((x) => Math.round(x * 100) / 100)]))));
    console.log('MOVE_POWER', JSON.stringify(Object.fromEntries(CAPTAIN_IDS.map((c) => [c, MOVE_POWER[c].map((x) => Math.round(x * 100) / 100)]))));
  } else for (const l of LEVELS) print(table(l, N));
}
