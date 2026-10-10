// docs/18 item 11 and docs/25 item 54: the paths' balance on real builds — her level's skills (a pick a level) and the
// artifacts of her band (tests/balance/boardlen.ts captainAt), as a boarding is fought (its length by its level, the
// sea's mind on both sides). Before docs/25 the paths were tuned here on skill-less, gear-less heroes in the land's
// reckoning, and their books faded to nothing by the levels the players fight at.
//   node tools/balance-paths.ts [battles a pair] [--levels=30,60]   every path against every path, and the sea
//   node tools/balance-paths.ts --roles [--levels=…]                 each move in its role at each band (docs/25 item 54)
//   node tools/balance-paths.ts --fit                                the `power` figures that put the moves in their role
//   node tools/balance-paths.ts 300 --bare                           the heroes as they were tuned before (no kit)
//   node tools/balance-paths.ts 200 --check [--levels=1,2,…] [--salt=]  docs/25 item 70's full check (exit 1 on a miss)
//   node tools/balance-paths.ts 30 --balance [--levels=…] [--state=dir] the controller: every path to 50% at each level
//   node tools/balance-paths.ts 60 --pairs --levels=L [--state=dir]     the pairings to even by least squares
//   node tools/balance-paths.ts --repair [--state=dir]                  pages back into 8–25% in their role
//   node tools/balance-paths.ts --rates [--levels=30]                what a point of initiative, speed, morale, luck is
//                                                                    worth against a share of blows (boardskill.ts)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { heroBattle, npcHeroBattle, primsAtLevel, startingOrders } from '../shared/src/data/hero.ts';
import type { HeroBattle } from '../shared/src/data/hero.ts';
import { MOVE_KNOBS, PATH_KNOBS, POWER_AT, clearPowered, pathBook } from '../shared/src/data/paths.ts';
import type { PathKnobs } from '../shared/src/data/paths.ts';
import { HAMMOCKS as LADDER, captainAt, playBoard, sidesAt } from '../tests/balance/boardlen.ts';
import { tacHp, tacHurt } from '../server/src/game/tacbattle.ts';
import type { TacBattle } from '../server/src/game/tacbattle.ts';
import { BAND_LEVELS, isHomePage, liftOf, movesAt, roleOf } from '../tests/balance/boardskill.ts';
import type { MoveId } from '../tests/balance/boardskill.ts';

const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 12);
const BARE = process.argv.includes('--bare');
const arg = (k: string): string | undefined => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
/** Figures `--balance` and `--pairs` leave where they stand (`--freeze=smuggler:order,navigator:page`). */
const FROZEN = new Set(arg('freeze')?.split(',') ?? []);
const frozen = (p: CaptainId, k: string): boolean => FROZEN.has(`${p}:${k}`);
const LEVELS = (arg('levels') ?? '30,60').split(',').map(Number);
export const HAMMOCKS = LADDER;

/** A captain of her path at her level with her book: her level's skills and kit (`bare`: neither, as before). */
export function pathHero(c: CaptainId, level: number, seed: number, bare = BARE): HeroBattle {
  if (!bare) return captainAt(c, level, seed);
  const prim = primsAtLevel(c, seed, level);
  return heroBattle(prim, [], null, startingOrders(c), prim.will * 10, { path: c, level });
}
export const seaHero = (sl: number): HeroBattle => npcHeroBattle(sl, null);

export interface Table {
  level: number;
  /** m[a][b]: a's wins against b. */
  m: Record<CaptainId, Record<CaptainId, number>>;
  sea: Record<CaptainId, number>;
}

/** One level's table under the boarding's rules: each pair `n` times a way round (the sides swapped), each path
 *  against a pirate of her waters `2n` times. */
export function table(level: number, n: number, bare = BARE, salt = 0, withSea = true): Table {
  const m = {} as Table['m'];
  const sea = {} as Table['sea'];
  for (const a of CAPTAIN_IDS) m[a] = { [a]: 0.5 } as Record<CaptainId, number>;
  CAPTAIN_IDS.forEach((a, i) => {
    CAPTAIN_IDS.forEach((b, j) => {
      if (j <= i) return;
      let w = 0;
      for (let k = 0; k < 2 * n; k++) {
        const flip = k % 2 === 1;
        const [x, y] = sidesAt(level, true, flip ? b : a, flip ? a : b, k * 13 + i * 7 + j + salt, bare);
        if ((playBoard(x, y, k * 31 + i * 5 + j + level + salt).winner === 0) !== flip) w++;
      }
      m[a][b] = w / (2 * n);
      m[b][a] = 1 - w / (2 * n);
    });
    let s = 0;
    if (withSea) for (let k = 0; k < 2 * n; k++) {
      const [x, y] = sidesAt(level, false, a, a, k * 17 + i * 3, bare);
      if (playBoard(x, y, k * 29 + i * 11 + level).winner === 0) s++;
    }
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

/** docs/25 item 54: each move of each path in its role at each band's levels (s strike, d drain, m mend, h hold,
 *  a again; then the rounds it holds). A page of her home school marked *. */
export function roles(levels = BAND_LEVELS): void {
  console.log(`| path | move | ${levels.map((L) => `L${L}`).join(' | ')} |`);
  console.log(`|---|---|${levels.map(() => '---|').join('')}`);
  for (const p of CAPTAIN_IDS) {
    const ids: MoveId[] = [];
    for (const L of levels) for (const id of movesAt(p, L)) if (!ids.includes(id)) ids.push(id);
    for (const id of ids) {
      const cells = levels.map((L) => {
        if (!movesAt(p, L).includes(id)) return '—';
        const r = roleOf(p, id, L);
        return `${r.role[0]}${Math.round(r.v * 100)}${r.rounds ? `/${r.rounds}r` : ''}`;
      });
      console.log(`| ${p} | ${id}${isHomePage(p, id) ? '*' : ''} | ${cells.join(' | ')} |`);
    }
  }
}

/** The blow a path's `power` is set by: a page of her home school striking `ref` of her captain's blast (the pages'
 *  own figures — a pistol's 1.2, a butcher's 2.6 — then sit about it), and for her moves the move that strikes or
 *  raises. The Drowned's raising grows with her level towards her caps (docs/25 item 57). */
export const FIT = { page: { ref: 1.6, aim: 0.11, heal: 0.1, healAim: 0.13 }, move: { corsair: { ref: 1.2, aim: 0.16 }, admiral: { ref: 0.7, aim: 0.14 } } } as const;
export const DROWNED_RAISE: [number, number][] = [[1, 0.2], [20, 0.3], [60, 0.48]];

/** docs/25 items 54 and 70: each path's edge over the fitted figures, so the six stand even under the boarding's rules
 *  (`--balance` finds it): at each of POWER_AT's levels her pages' power (and their heals), her moves' power, the
 *  Drowned's raising (`mmend`) — and `order`, inert since 2026-10-10 (ORDER_KNOBS is gone: her own order is what her
 *  book says, owner: «чини атаку всем»); her pages' shares and her moves' shares at
 *  every level. Held where her moves stay 8–25% in their role (tests/balance/boarding.test.ts). */
export interface Edge { page: number[]; buff: number; move: number[]; mbuff: number; mmend: number[]; order: number[] }
const ONES = POWER_AT.map(() => 1);
export const EDGE: Record<CaptainId, Edge> = {
  corsair: { page: [0.88, 0.87, 1.06, 0.76, 0.76, 1.36, 0.83, 0.88, 1.06, 1.25, 0.63, 0.49, 0.77, 0.54, 0.56, 0.55, 0.5, 0.79, 0.45, 0.71, 0.58, 0.5, 0.84, 0.46, 1.03, 0.63, 0.65, 0.97, 0.97, 0.5, 0.66, 0.62, 0.9, 0.6, 0.64, 0.66, 0.78, 0.88, 0.8, 0.67, 0.67, 0.71, 1.11, 0.86, 0.94, 1.28, 1.12, 1.03, 0.89, 0.85, 0.89, 0.91, 0.89, 0.83, 0.93, 0.93, 0.87, 0.88, 0.91, 1.12], buff: 1, move: [1.16, 1.42, 0.93, 1.16, 1.22, 0.63, 1.21, 1.18, 1.13, 1.12, 0.45, 0.6, 0.51, 0.4, 0.41, 0.4, 0.4, 0.5, 0.4, 0.64, 0.4, 0.4, 0.68, 0.4, 1.03, 0.49, 0.47, 1.07, 1.06, 0.42, 0.49, 0.52, 0.58, 0.53, 0.54, 0.55, 0.61, 0.58, 0.59, 0.63, 0.68, 0.67, 0.57, 0.85, 0.85, 0.51, 0.67, 0.61, 0.58, 0.7, 0.67, 0.52, 0.59, 0.57, 0.55, 0.51, 0.52, 0.6, 0.66, 0.45], mbuff: 1, mmend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], order: ONES },
  smuggler: { page: [1.8, 1.8, 1.69, 1.8, 2.2, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.72, 1.8, 1.6, 1.6, 1.72, 1.56, 1.78, 0.5, 0.45, 0.81, 0.45, 0.57, 0.5, 0.55, 0.82, 0.52, 0.6, 0.68, 0.69, 0.8, 0.72, 0.92, 0.91, 0.82, 0.86, 0.87, 0.89, 0.84, 0.93, 1.04, 1.27, 1.15, 1.32, 1.4, 1.02, 1.46, 0.79, 0.92, 0.87, 0.82, 0.79, 0.94, 0.95, 1.32, 0.9, 1.22, 1.01], buff: 0.95, move: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], mbuff: 0.87, mmend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], order: ONES },
  reaver: { page: [0.45, 0.53, 0.82, 0.55, 0.6034999999999999, 0.54, 0.45, 0.8, 0.45, 0.45, 0.45, 0.45, 0.76, 0.45, 0.57, 0.48, 0.5, 0.71, 0.57, 1.8, 1.75, 1.38, 1.76, 1.61, 1.78, 1.42, 1.25, 1.2, 1.45, 1.66, 1.32, 1.11, 1.51, 1.28, 1.69, 1.68, 1.56, 1.51, 1.75, 1.7, 1.8, 1.8, 0.92, 1.37, 1.65, 1.8, 1.54, 0.93, 1.65, 1.56, 1.68, 1.71, 1.32, 1.45, 1.61, 1.36, 1.18, 1.21, 0.89, 1.66], buff: 0.87, move: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], mbuff: 1, mmend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], order: ONES },
  navigator: { page: [1.73, 0.96, 1.26, 0.95, 1.79, 0.9, 0.93, 1.26, 0.94, 0.83, 1.19, 0.83, 1.72, 1.53, 1.78, 1.02, 1.47, 1.5, 1.27, 0.68, 0.77, 0.62, 0.93, 0.59, 0.83, 0.72, 0.86, 0.93, 0.98, 1.1, 0.84, 0.84, 0.91, 0.78, 0.97, 1.07, 1.1, 0.98, 1.07, 1.15, 1.01, 1.15, 1.25, 1.29, 1.19, 1.57, 1.49, 1.23, 1.45, 1.31, 0.88, 0.93, 0.93, 1.21, 0.87, 0.87, 0.9, 0.9, 0.97, 0.88], buff: 0.87, move: [0.96, 1.09, 1.05, 1.15, 1.03, 1.11, 1.01, 1.08, 1.04, 1.02, 1.07, 1.05, 1.09, 1.12, 0.85, 0.96, 1.01, 1.01, 0.84, 0.72, 0.66, 0.62, 0.59, 0.57, 0.67, 0.7, 0.77, 0.62, 0.69, 0.6, 0.87, 0.85, 0.86, 0.87, 0.95, 0.94, 0.97, 1.02, 0.91, 0.99, 1.01, 0.95, 1.05, 1.09, 1.17, 0.78, 0.95, 0.96, 0.92, 1.09, 0.76, 0.75, 0.68, 1.05, 0.81, 0.78, 0.86, 0.73, 0.95, 1.12], mbuff: 0.87, mmend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], order: ONES },
  drowned: { page: [0.83, 0.97, 0.83, 0.9, 1.22, 1.03, 1.3, 1.6, 1.56, 1.53, 1.32, 1.32, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 0.57, 1.8, 1.8, 1.62, 1.8, 1.8, 1.8, 1.8, 1.53, 1.8, 1.8, 1.8, 1.8, 1.47, 1.8, 1.37, 1.38, 1.45, 1.38, 1.44, 1.26, 1.37, 1.41, 1.41, 1.64, 1.45, 1.64, 1.68, 1.32, 1.49, 1.55, 1.7, 1.57, 1.36, 1.49, 1.55, 1.72, 1.44, 1.35, 1.61, 1.78], buff: 1, move: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.04, 1.07, 1.11, 1.14, 1.17, 1.21, 1.24, 1.27, 1.31, 1.35, 1.39, 1.42, 1.45, 1.49, 2.01, 1.55, 1.58, 1.62, 1.65, 1.68, 1.71, 1.75, 1.78, 1.81, 1.84, 1.87, 1.9, 1.94, 1.97, 2.5, 1.93, 1.87, 1.8, 1.74, 1.67, 1.6, 1.53, 1.47, 1.4, 1.33, 1.26, 1.2, 1.13, 1.07, 0.72], mbuff: 0.87, mmend: [0.85, 1.24, 1.19, 1.47, 0.95, 1.71, 1.8, 2, 1.49, 2.09, 1.43, 1.27, 2.5, 2.5, 2.46, 2.5, 2.5, 2.5, 2.5, 0.85, 2.41, 2.5, 2.5, 2.5, 2.5, 2.5, 2.45, 2.5, 2.37, 2.5, 2.31, 2.3, 2.5, 2.5, 2.01, 1.93, 2.01, 2.5, 2.09, 1.94, 1.88, 1.94, 2.37, 1.75, 2.5, 1.4, 1.71, 2.5, 2.05, 1.88, 2.26, 1.91, 2.5, 2.03, 1.93, 2.25, 1.8, 2.5, 1.92, 1.25], order: ONES },
  admiral: { page: [1.39, 1.7, 1.56, 1.41, 1.56, 1.52, 1.8, 1.8, 1.8, 1.8, 1.79, 1.64, 1.7, 1.36, 1.8, 1.52, 1.51, 1.66, 1.48, 1.25, 0.71, 0.82, 0.67, 0.71, 0.8, 0.75, 0.93, 0.7, 0.72, 0.83, 0.72, 0.73, 0.8, 0.81, 0.85, 0.87, 0.93, 0.88, 0.91, 0.89, 0.93, 0.9, 0.95, 1.07, 1.06, 1.11, 1.12, 0.94, 0.93, 1.11, 0.99, 1.07, 0.91, 0.93, 1.03, 0.99, 0.94, 0.91, 0.93, 0.88], buff: 0.87, move: [2.06, 1.64, 1.98, 1.31, 1.44, 2.09, 2.5, 2.5, 2.5, 2.5, 2.49, 2.1, 1.34, 1.64, 1.83, 1.09, 1.02, 1.19, 1, 1.09, 0.69, 0.47, 0.68, 0.56, 0.82, 0.62, 0.61, 0.67, 0.53, 0.74, 0.55, 0.61, 0.64, 0.45, 0.52, 0.59, 0.55, 0.68, 0.62, 0.62, 0.52, 0.56, 0.6, 0.65, 0.56, 0.48, 0.51, 0.66, 0.49, 0.66, 0.71, 0.6, 0.58, 0.64, 0.65, 0.66, 0.71, 0.69, 0.67, 1.56], mbuff: 0.66, mmend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], order: ONES },
};
/** How far `--balance` may take each figure. */
const EDGE_BOUNDS = { page: [0.45, 1.8], move: [0.4, 2.5], mmend: [0.5, 2.5], order: [0.35, 3] } as const; // 2026-10-10: pages to 0.45, the Drowned's raising to 2.5 (her own order no longer carries her)
/** The edge at each of POWER_AT's levels. */
const edgeAt = (e: number[], i: number): number => e[i] ?? 1;

/** The `power` and `mend` figures at POWER_AT that put each path's reference blow and heal at their aim of her army
 *  on her real build at each level (her schools' lift, the boarding's scale at the level): the same share at every
 *  level. */
export function fitPower(): void {
  for (const p of CAPTAIN_IDS) {
    const page: number[] = [], move: number[] = [], pageMend: number[] = [], moveMend: number[] = [];
    for (const L of POWER_AT) {
      const hb = captainAt(p, L, 11);
      const lift = liftOf(hb, p, 'innate');
      const unit = 0.07 * lift;
      // Her pages' lift: the geometric mean over her book's six (their schools, her home school's on its own).
      const book = pathBook(p);
      const pageLift = Math.exp(book.reduce((n, id) => n + Math.log(liftOf(hb, p, id)), 0) / book.length);
      page.push(Math.round((FIT.page.aim / (0.07 * pageLift * FIT.page.ref)) * 100) / 100);
      pageMend.push(Math.round((FIT.page.healAim / (pageLift * FIT.page.heal)) * 100) / 100);
      const m = p === 'corsair' || p === 'admiral' ? FIT.move[p] : null;
      if (m) move.push(Math.round((m.aim / (unit * m.ref)) * 100) / 100);
      else if (p === 'drowned') move.push(page[page.length - 1]);
      else move.push(1);
      if (p === 'drowned') {
        // Her ultimate's raise (0.18 of a stack) at DROWNED_RAISE's share at the level.
        let aim = DROWNED_RAISE[DROWNED_RAISE.length - 1][1];
        for (let i = 1; i < DROWNED_RAISE.length; i++) if (L <= DROWNED_RAISE[i][0]) {
          const [l0, a0] = DROWNED_RAISE[i - 1], [l1, a1] = DROWNED_RAISE[i];
          aim = a0 + ((a1 - a0) * (L - l0)) / (l1 - l0);
          break;
        }
        moveMend.push(Math.round((aim / (0.18 * lift)) * 100) / 100);
      } else moveMend.push(1);
    }
    const e = EDGE[p], r2 = (x: number) => Math.round(x * 100) / 100;
    PATH_KNOBS[p] = { power: page.map((x, i) => r2(x * edgeAt(e.page, i))), mend: pageMend.map((x, i) => r2(x * edgeAt(e.page, i))), buff: r2(e.buff), pts: 1 };
    MOVE_KNOBS[p] = { power: move.map((x, i) => r2(x * edgeAt(e.move, i))), mend: moveMend.map((x, i) => r2(x * edgeAt(e.mmend, i))), buff: r2(e.mbuff), pts: 1 };
  }
  clearPowered();
}

/** Each path's wins against all at `level` (every pairing `n` times, the sides swapped by turns; `salt` other dice). */
export function winsAt(level: number, n: number, salt = 0): Record<CaptainId, number> {
  const w = {} as Record<CaptainId, [number, number]>;
  CAPTAIN_IDS.forEach((p, i) => CAPTAIN_IDS.forEach((q, j) => {
    for (let k = 0; k < n; k++) {
      const flip = k % 2 === 1;
      const [a, b] = sidesAt(level, true, flip ? q : p, flip ? p : q, k * 13 + i * 7 + j + salt);
      const won = (playBoard(a, b, k * 31 + i * 5 + j + level + salt).winner === 0) !== flip;
      const x = (w[p] ??= [0, 0]);
      x[0] += won ? 1 : 0;
      x[1]++;
    }
  }));
  return Object.fromEntries(CAPTAIN_IDS.map((p) => [p, w[p][0] / w[p][1]])) as Record<CaptainId, number>;
}

/** Her moves in their role at every band (docs/25 item 54): her pages 8–25%, her innate move and ultimate 8% at least. */
export function rolesOk(p: CaptainId): boolean {
  for (const L of BAND_LEVELS) {
    const hb = captainAt(p, L, 11);
    for (const id of movesAt(p, L)) {
      const v = roleOf(p, id, L, 11, hb).v;
      if (v < 0.08 - 1e-9 || (id !== 'innate' && id !== 'ult' && v > 0.25 + 1e-9)) return false;
    }
  }
  return true;
}

/** docs/25 item 70: every path even against all at each of POWER_AT's levels from 5 — a controller at each level on its
 *  own (POWER_AT stands on the levels the matrix is read at, so a level's figures move that level alone): each round it
 *  plays the level's table (`n` a pairing a way round, dice `salt`), and moves each path's strength there by `eta` of
 *  how far she stands from 50% (on a log scale): her own order, her moves' power (the Drowned's raising) and her pages'
 *  power together — her pages only as far as her moves stay 8–25% in their role (rolesOk). Prints the level's figures
 *  as it goes, to be set in EDGE; the matrix on other dice is `--matrix`. */
function balance(levels: number[], n: number, iters: number, eta: number, salt: number, state?: string): void {
  fitPower();
  for (const L of levels) {
    const i = POWER_AT.indexOf(L as (typeof POWER_AT)[number]);
    if (i < 0) throw new Error(`level ${L} is not one of POWER_AT`);
    // A level's figures are carried between runs (`--state=dir`: dir/edge_L.json, loadState).
    const file = state ? `${state}/edge_${L}.json` : '';
    const step = Object.fromEntries(CAPTAIN_IDS.map((p) => [p, eta])) as Record<CaptainId, number>;
    const last = Object.fromEntries(CAPTAIN_IDS.map((p) => [p, 0])) as Record<CaptainId, number>;
    const base = Object.fromEntries(CAPTAIN_IDS.map((p) => [p, { page: edgeAt(EDGE[p].page, i), move: edgeAt(EDGE[p].move, i), mmend: edgeAt(EDGE[p].mmend, i), order: edgeAt(EDGE[p].order, i) }]));
    const x = Object.fromEntries(CAPTAIN_IDS.map((p) => [p, 0])) as Record<CaptainId, number>;
    const clamp = (k: keyof typeof EDGE_BOUNDS, v: number) => Math.round(Math.max(EDGE_BOUNDS[k][0], Math.min(EDGE_BOUNDS[k][1], v)) * 100) / 100;
    const apply = (p: CaptainId) => {
      const e = EDGE[p], b0 = base[p], f = Math.exp(x[p]);
      const was = { move: e.move[i], mmend: e.mmend[i] };
      if (p === 'corsair' || p === 'admiral') e.move[i] = clamp('move', b0.move * f);
      // The Navigator's squall: her stack's blows while it holds (paths.ts powered), a third either way at most.
      if (p === 'navigator') e.move[i] = Math.round(Math.max(0.4, Math.min(1.3, b0.move * f)) * 100) / 100;
      if (p === 'drowned') e.mmend[i] = clamp('mmend', b0.mmend * f);
      // 2026-10-10: her innate move and ultimate stay 8% in their role too (with ORDER_KNOBS gone her own order is no
      // longer the free figure, and the Corsair's moves fell to 5–6% at the band levels).
      fitPower();
      if (!rolesOk(p)) {
        e.move[i] = was.move;
        e.mmend[i] = was.mmend;
      }
      // Her pages as far as her roles hold.
      for (const share of [1, 0.75, 0.5, 0.25, 0]) {
        e.page[i] = clamp('page', b0.page * Math.exp(x[p] * share));
        fitPower();
        if (rolesOk(p)) return;
      }
    };
    for (let it = 0; it <= iters; it++) {
      const t = table(L, n, false, salt, false);
      const w = Object.fromEntries(CAPTAIN_IDS.map((p) => [p, CAPTAIN_IDS.filter((q) => q !== p).reduce((s0, q) => s0 + t.m[p][q], 0) / (CAPTAIN_IDS.length - 1)])) as Record<CaptainId, number>;
      let lo = 1, hi = 0;
      for (const p of CAPTAIN_IDS) for (const q of CAPTAIN_IDS) if (p !== q) {
        lo = Math.min(lo, t.m[p][q]);
        hi = Math.max(hi, t.m[p][q]);
      }
      console.log(`L${L} it ${it}: ${CAPTAIN_IDS.map((p) => `${p} ${Math.round(w[p] * 100)}%`).join(' · ')} · pairs ${Math.round(lo * 100)}–${Math.round(hi * 100)}%`);
      if (it === iters) break;
      // Each path's own step: halved when she crosses 50%, a fifth longer while she keeps to one side of it.
      for (const p of CAPTAIN_IDS) {
        const err = w[p] - 0.5;
        if (err * last[p] < 0) step[p] *= 0.5;
        else if (last[p] !== 0) step[p] = Math.min(eta, step[p] * 1.2);
        last[p] = err;
        x[p] -= step[p] * err;
        apply(p);
      }
      if (file) writeFileSync(file, JSON.stringify(Object.fromEntries(CAPTAIN_IDS.map((p) => [p, { page: EDGE[p].page[i], move: EDGE[p].move[i], mmend: EDGE[p].mmend[i], order: EDGE[p].order[i] }]))));
    }
    console.log(`L${L} [index ${i}] ${JSON.stringify(Object.fromEntries(CAPTAIN_IDS.map((p) => [p, { page: EDGE[p].page[i], move: EDGE[p].move[i], mmend: EDGE[p].mmend[i], order: EDGE[p].order[i] }])))}`);
  }
}

/** docs/25 item 70's pairs: «ни один капитан не сильнее другого больше чем на 15%» is between any two, and even paths
 *  against all can still beat one another round and round (the Smuggler's smoke on the Navigator's double turns). A
 *  level's figures of each kind for each path (her pages, her order, her moves — the Corsair's and the Admiral's power,
 *  the Drowned's raising) are moved together by least squares: each figure stepped by a fifth on the same dice (`n`
 *  a pairing a way round, dice `salt`), what it moved in each pairing read off, and the step taken that brings the
 *  fifteen pairings and the six paths against all nearest to 50% (a ridge `mu` holding it short), kept if the
 *  table on those dice is nearer. Her pages only as far as her moves stay 8–25% in their role (rolesOk). */
function pairs(L: number, n: number, iters: number, salt: number, mu: number, state?: string): void {
  const i = POWER_AT.indexOf(L as (typeof POWER_AT)[number]);
  if (i < 0) throw new Error(`level ${L} is not one of POWER_AT`);
  const file = state ? `${state}/edge_${L}.json` : '';
  type K = 'page' | 'order' | 'move' | 'mmend';
  const knobs: [CaptainId, K][] = [];
  for (const p of CAPTAIN_IDS) {
    knobs.push([p, 'page']);
    if (p === 'corsair' || p === 'admiral' || p === 'navigator' || p === 'drowned') knobs.push([p, 'move']); // the Drowned's: her ultimate's drag (2026-10-10)
    if (p === 'drowned') knobs.push([p, 'mmend']);
    for (let j = knobs.length - 1; j >= 0; j--) if (frozen(knobs[j][0], knobs[j][1])) knobs.splice(j, 1);
  }
  const pairList: [CaptainId, CaptainId][] = [];
  CAPTAIN_IDS.forEach((a, x) => CAPTAIN_IDS.forEach((b, y) => y > x && pairList.push([a, b])));
  const LAMBDA = 2;
  const read = (): number[] => {
    const t = table(L, n, false, salt, false);
    const r = pairList.map(([a, b]) => t.m[a][b] - 0.5);
    for (const p of CAPTAIN_IDS) r.push(LAMBDA * (CAPTAIN_IDS.filter((q) => q !== p).reduce((s0, q) => s0 + t.m[p][q], 0) / 5 - 0.5));
    return r;
  };
  const cost = (r: number[]) => r.reduce((a, v) => a + v * v, 0);
  const bound = { page: EDGE_BOUNDS.page, order: EDGE_BOUNDS.order, move: EDGE_BOUNDS.move, mmend: EDGE_BOUNDS.mmend };
  const get = ([p, k]: [CaptainId, K]) => EDGE[p][k][i];
  /** Set a figure (on the log scale `v`); false if her roles would not hold it. */
  const set = ([p, k]: [CaptainId, K], v: number): boolean => {
    const old = EDGE[p][k][i];
    EDGE[p][k][i] = Math.round(Math.max(bound[k][0], Math.min(p === 'navigator' && k === 'move' ? 1.3 : bound[k][1], v)) * 100) / 100;
    fitPower();
    if (!rolesOk(p)) { // 2026-10-10: her innate move and ultimate held to 8% too (a move's power is a knob here)
      EDGE[p][k][i] = old;
      fitPower();
      return false;
    }
    return true;
  };
  const show = (r: number[], tag: string) => {
    const out = pairList.map(([a, b], j) => [a, b, r[j] + 0.5] as const).filter((x) => Math.abs(x[2] - 0.5) > 0.1).map(([a, b, v]) => `${a}-${b} ${Math.round(v * 100)}%`);
    console.log(`L${L} ${tag}: cost ${cost(r).toFixed(4)} · vs all ${CAPTAIN_IDS.map((p, j) => `${p} ${Math.round((r[15 + j] / LAMBDA + 0.5) * 100)}%`).join(' ')} · outside 40–60: ${out.join(', ') || 'none'}`);
  };
  let r0 = read();
  show(r0, 'start');
  for (let it = 0; it < iters; it++) {
    // What a fifth more of each figure moves.
    const J: number[][] = [];
    for (const kn of knobs) {
      const v0 = get(kn);
      let h = Math.log(1.2);
      if (!set(kn, v0 * Math.exp(h)) || get(kn) === v0) {
        h = -h;
        if (!set(kn, v0 * Math.exp(h)) || get(kn) === v0) {
          J.push(r0.map(() => 0));
          continue;
        }
      }
      const dh = Math.log(get(kn) / v0);
      const r1 = read();
      J.push(r1.map((v, j) => (v - r0[j]) / dh));
      set(kn, v0);
    }
    // The ridge step: (JᵀJ + mu I) d = −Jᵀ r.
    const m = knobs.length;
    const A = Array.from({ length: m }, (_, a) => Array.from({ length: m + 1 }, (_, b) => (b < m ? J[a].reduce((s0, v, j) => s0 + v * J[b][j], 0) + (a === b ? mu : 0) : -J[a].reduce((s0, v, j) => s0 + v * r0[j], 0))));
    for (let c = 0; c < m; c++) {
      let piv = c;
      for (let rr = c + 1; rr < m; rr++) if (Math.abs(A[rr][c]) > Math.abs(A[piv][c])) piv = rr;
      [A[c], A[piv]] = [A[piv], A[c]];
      for (let rr = 0; rr < m; rr++) if (rr !== c) {
        const f = A[rr][c] / A[c][c];
        for (let cc = c; cc <= m; cc++) A[rr][cc] -= f * A[c][cc];
      }
    }
    const d = A.map((row, a) => Math.max(-0.35, Math.min(0.35, row[m] / row[a])));
    const was = knobs.map(get);
    let taken = false;
    for (const scale of [1, 0.5, 0.25]) {
      knobs.forEach((kn, a) => set(kn, was[a] * Math.exp(d[a] * scale)));
      const r1 = read();
      if (cost(r1) < cost(r0)) {
        r0 = r1;
        taken = true;
        show(r0, `it ${it} (step ×${scale})`);
        break;
      }
      knobs.forEach((kn, a) => set(kn, was[a]));
    }
    if (file) writeFileSync(file, JSON.stringify(Object.fromEntries(CAPTAIN_IDS.map((p) => [p, { page: EDGE[p].page[i], move: EDGE[p].move[i], mmend: EDGE[p].mmend[i], order: EDGE[p].order[i] }]))));
    if (!taken) {
      console.log(`L${L} it ${it}: no step nearer`);
      break;
    }
  }
  console.log(`L${L} [index ${i}] ${JSON.stringify(Object.fromEntries(CAPTAIN_IDS.map((p) => [p, { page: EDGE[p].page[i], move: EDGE[p].move[i], mmend: EDGE[p].mmend[i], order: EDGE[p].order[i] }])))}`);
}

/** docs/25 items 54 and 70: where a path's page has slipped out of 8–25% in its role at a band's level (its neighbours
 *  of the grid tuned apart), her pages' power at the two grid levels about it nudged back in, with a margin (8.2–24.5%);
 *  the figures left in `state`. */
function repair(state?: string): void {
  fitPower();
  for (const p of CAPTAIN_IDS) for (let guard = 0; guard < 400; guard++) {
    let moved = false;
    for (const L of BAND_LEVELS) {
      const hb = captainAt(p, L, 11);
      for (const id of movesAt(p, L)) {
        // Her pages' power moves her blows, drags and heals; her holds' shares are the same at every level. Her innate
        // move and ultimate: 8% at least, by her moves' power (the Corsair's and the Admiral's blows) or the Drowned's
        // raising.
        const move = id === 'innate' || id === 'ult';
        const r = roleOf(p, id, L, 11, hb);
        if (r.role === 'hold' || r.role === 'again') continue;
        const v = r.v;
        const f = v < 0.082 ? 1.03 : !move && v > 0.245 ? 1 / 1.03 : 1;
        if (f === 1) continue;
        const key = !move ? 'page' : r.role === 'strike' ? 'move' : r.role === 'mend' ? 'mmend' : null;
        if (!key) continue;
        const hi = POWER_AT.findIndex((x) => x >= L), lo = POWER_AT[hi] === L ? hi : hi - 1;
        for (const i of new Set([lo, hi])) EDGE[p][key][i] = Math.round(EDGE[p][key][i] * f * 100) / 100;
        moved = true;
      }
      if (moved) break;
    }
    if (!moved) break;
    fitPower();
  }
  for (const p of CAPTAIN_IDS) if (!rolesOk(p)) console.log(`${p}: her roles still out`);
  if (state) POWER_AT.forEach((L, i) => writeFileSync(`${state}/edge_${L}.json`, JSON.stringify(Object.fromEntries(CAPTAIN_IDS.map((p) => [p, { page: EDGE[p].page[i], move: EDGE[p].move[i], mmend: EDGE[p].mmend[i], order: EDGE[p].order[i] }])))));
}

/** docs/25 item 70's full check (tests/balance/paths-balance.test.ts is its reduced sample): at each level every path
 *  42.5–57.5% against all and every pairing 35–65% (`n` boardings a pairing a way round, dice `salt` neither tuner
 *  saw); the pairings outside 40–60% are listed. False if a target is missed. */
export function check(levels: number[], n: number, salt: number): boolean {
  let ok = true;
  for (const L of levels) {
    const t = table(L, n, false, salt, false);
    const w = CAPTAIN_IDS.map((p) => [p, CAPTAIN_IDS.filter((q) => q !== p).reduce((s0, q) => s0 + t.m[p][q], 0) / 5] as const);
    const pr: [string, number][] = [];
    CAPTAIN_IDS.forEach((a, i) => CAPTAIN_IDS.forEach((b, j) => j > i && pr.push([`${a}–${b}`, t.m[a][b]])));
    const badW = w.filter(([, v]) => v < 0.425 || v > 0.575), badP = pr.filter(([, v]) => v < 0.35 || v > 0.65), wide = pr.filter(([, v]) => v < 0.4 || v > 0.6);
    if (badW.length || badP.length) ok = false;
    const lo = Math.min(...pr.map((x) => x[1])), hi = Math.max(...pr.map((x) => x[1]));
    console.log(`L${String(L).padStart(2)} ${badW.length || badP.length ? 'MISS' : 'ok  '} against all ${w.map(([p, v]) => `${p} ${pc(v).trim()}%`).join(' · ')} · pairings ${pc(lo).trim()}–${pc(hi).trim()}%${wide.length ? ` · outside 40–60: ${wide.map(([k, v]) => `${k} ${pc(v).trim()}%`).join(', ')}` : ''}`);
  }
  return ok;
}

/** The figures of each of POWER_AT's levels an earlier `--balance` run left in `dir` (edge_L.json), set in EDGE and in
 *  the game's knobs (fitPower) — so `--matrix`, `--roles` and `--fit` read them too. */
export function loadState(dir: string): void {
  POWER_AT.forEach((L, i) => {
    const file = `${dir}/edge_${L}.json`;
    if (!existsSync(file)) return;
    const got = JSON.parse(readFileSync(file, 'utf8')) as Record<CaptainId, { page: number; move: number; mmend: number; order: number }>;
    for (const p of CAPTAIN_IDS) for (const k of ['page', 'move', 'mmend', 'order'] as const) EDGE[p][k][i] = got[p][k];
  });
  fitPower();
}

/** The engine's own exchange rate of a point against a share of blows: in a mirror of each path, one side given a hold
 *  for rounds 1–3 — her wins against those of a side whose blows and shots land a share harder (POINT_RATE). */
function rates(level: number, n: number): void {
  const wins = (mine: Record<string, number>, strike = 0): number => {
    let w = 0, g = 0;
    CAPTAIN_IDS.forEach((p) => {
      for (let i = 0; i < n; i++) {
        const [a, b] = sidesAt(level, true, p, p, i * 7 + 3);
        a.gift = { rounds: 3, mine };
        // A strike: a share of every stack of hers cut down before the first turn.
        const start = (bt: TacBattle) => {
          for (const x of bt.stacks) if (x.side === 1 && x.count > 0) tacHurt(bt, x, Math.round(tacHp(x) * strike), 0);
        };
        if (playBoard(a, b, i * 13 + 5, strike ? { start } : {}).winner === 0) w++;
        g++;
      }
    });
    return w / g;
  };
  console.log(`Level ${level}, ${n * 6} mirrors a line: side 0 given the hold for rounds 1–3`);
  for (const [tag, m] of [['nothing', {}], ['blows +10%', { melee: 0.1, shot: 0.1 }], ['blows +20%', { melee: 0.2, shot: 0.2 }], ['blows +30%', { melee: 0.3, shot: 0.3 }],
    ['initiative +1', { init: 1 }], ['initiative +2', { init: 2 }], ['initiative +3', { init: 3 }], ['speed +1', { speed: 1 }], ['speed +2', { speed: 2 }],
    ['morale +1', { morale: 1 }], ['morale +2', { morale: 2 }], ['luck +1', { luck: 1 }], ['luck +2', { luck: 2 }], ['taken -10%', { taken: -0.1 }], ['taken -20%', { taken: -0.2 }]] as [string, Record<string, number>][]) console.log(`  ${tag.padEnd(14)} ${Math.round(wins(m) * 100)}%`);
  for (const f of [0.03, 0.06, 0.1, 0.15]) console.log(`  strike ${Math.round(f * 100)}% of her army at the start: ${Math.round(wins({}, f) * 100)}%`);
}

if (import.meta.main ?? process.argv[1]?.endsWith('balance-paths.ts')) {
  if (arg('state')) loadState(arg('state')!);
  if (process.argv.includes('--check')) {
    const ok = check(arg('levels') ? LEVELS : [5, 15, 30, 45, 60], N, Number(arg('salt') ?? 80000));
    console.log(ok ? 'docs/25 item 70: every target met' : 'docs/25 item 70: a target missed');
    if (!ok) process.exitCode = 1;
  } else if (process.argv.includes('--matrix')) {
    const salt = Number(arg('salt') ?? 0);
    for (const l of arg('levels') ? LEVELS : [5, 15, 30, 45, 60]) {
      const t = table(l, N, BARE, salt, false);
      print(t);
      const out: string[] = [];
      CAPTAIN_IDS.forEach((a, i) => CAPTAIN_IDS.forEach((b, j) => {
        if (j > i && (t.m[a][b] < 0.4 || t.m[a][b] > 0.6)) out.push(`${a}-${b} ${pc(t.m[a][b])}%`);
      }));
      console.log(`  outside 40–60: ${out.join(', ') || 'none'}`);
    }
  } else if (process.argv.includes('--roles')) roles(arg('levels') ? LEVELS : BAND_LEVELS);
  else if (process.argv.includes('--rates')) for (const l of arg('levels') ? LEVELS : [30]) rates(l, N);
  else if (process.argv.includes('--repair')) repair(arg('state'));
  else if (process.argv.includes('--pairs')) for (const l of LEVELS) pairs(l, N, Number(arg('iters') ?? 3), Number(arg('salt') ?? 0), Number(arg('mu') ?? 0.02), arg('state'));
  else if (process.argv.includes('--balance')) balance(arg('levels') ? LEVELS : [5, 15, 30, 45, 60], N, Number(arg('iters') ?? 6), Number(arg('eta') ?? 2), Number(arg('salt') ?? 0), arg('state'));
  else if (process.argv.includes('--fit')) {
    fitPower();
    const out = (t: Record<CaptainId, PathKnobs>) => CAPTAIN_IDS.map((c) => `  ${c}: { power: [${t[c].power.join(', ')}], mend: [${t[c].mend.join(', ')}], buff: ${t[c].buff}, pts: ${t[c].pts} },`).join('\n');
    console.log(`PATH_KNOBS\n${out(PATH_KNOBS)}\nMOVE_KNOBS\n${out(MOVE_KNOBS)}`);
    roles();
  } else for (const l of LEVELS) print(table(l, N));
}
