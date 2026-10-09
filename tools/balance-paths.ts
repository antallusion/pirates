// docs/18 item 11 and docs/25 item 54: the paths' balance on real builds — her level's skills (a pick a level) and the
// artifacts of her band (tests/balance/boardlen.ts captainAt), as a boarding is fought (its length by its level, the
// sea's mind on both sides). Before docs/25 the paths were tuned here on skill-less, gear-less heroes in the land's
// reckoning, and their books faded to nothing by the levels the players fight at.
//   node tools/balance-paths.ts [battles a pair] [--levels=30,60]   every path against every path, and the sea
//   node tools/balance-paths.ts --roles [--levels=…]                 each move in its role at each band (docs/25 item 54)
//   node tools/balance-paths.ts --fit                                the `power` figures that put the moves in their role
//   node tools/balance-paths.ts 300 --bare                           the heroes as they were tuned before (no kit)
//   node tools/balance-paths.ts --rates [--levels=30]                what a point of initiative, speed, morale, luck is
//                                                                    worth against a share of blows (boardskill.ts)

import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { heroBattle, npcHeroBattle, primsAtLevel, startingOrders } from '../shared/src/data/hero.ts';
import type { HeroBattle } from '../shared/src/data/hero.ts';
import { MOVE_KNOBS, PATH_KNOBS, POWER_AT, clearPowered, pathBook } from '../shared/src/data/paths.ts';
import type { PathKnobs } from '../shared/src/data/paths.ts';
import { HAMMOCKS as LADDER, captainAt, playBoard, sidesAt } from '../tests/balance/boardlen.ts';
import { BAND_LEVELS, blastAt, isHomePage, liftOf, movesAt, roleOf } from '../tests/balance/boardskill.ts';
import type { MoveId } from '../tests/balance/boardskill.ts';

const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 12);
const BARE = process.argv.includes('--bare');
const arg = (k: string): string | undefined => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
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
export function table(level: number, n: number, bare = BARE): Table {
  const m = {} as Table['m'];
  const sea = {} as Table['sea'];
  for (const a of CAPTAIN_IDS) m[a] = { [a]: 0.5 } as Record<CaptainId, number>;
  CAPTAIN_IDS.forEach((a, i) => {
    CAPTAIN_IDS.forEach((b, j) => {
      if (j <= i) return;
      let w = 0;
      for (let k = 0; k < 2 * n; k++) {
        const flip = k % 2 === 1;
        const [x, y] = sidesAt(level, true, flip ? b : a, flip ? a : b, k * 13 + i * 7 + j, bare);
        if ((playBoard(x, y, k * 31 + i * 5 + j + level).winner === 0) !== flip) w++;
      }
      m[a][b] = w / (2 * n);
      m[b][a] = 1 - w / (2 * n);
    });
    let s = 0;
    for (let k = 0; k < 2 * n; k++) {
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
 *  (`--balance` searches it): her pages' power and her moves' power at each of POWER_AT's levels, her pages' shares, her
 *  moves' shares, the Drowned's raising. Held where her moves stay 8–25% in their role (tests/balance/boarding.test.ts). */
export interface Edge { page: number[]; buff: number; move: number[]; mbuff: number; mmend: number }
export const EDGE: Record<CaptainId, Edge> = {
  corsair: { page: [1, 1, 1, 0.87, 0.87, 1.15], buff: 1, move: [1, 1, 1, 1.15, 1.15, 0.66], mbuff: 1, mmend: 1 },
  smuggler: { page: [1, 1, 1, 1.15, 1.15, 1], buff: 0.87, move: [1, 1, 1, 1, 1, 1], mbuff: 0.87, mmend: 1 },
  reaver: { page: [1, 1, 1, 1.15, 1.15, 0.87], buff: 0.87, move: [1, 1, 1, 1, 1, 1], mbuff: 1, mmend: 1 },
  navigator: { page: [1, 1, 1, 1.3, 1.3, 0.87], buff: 0.87, move: [1, 1, 1, 1, 1, 1], mbuff: 0.87, mmend: 1 },
  drowned: { page: [1, 1, 1, 1, 1, 1], buff: 1, move: [1, 1, 1, 1.52, 1.52, 1], mbuff: 0.87, mmend: 1 },
  admiral: { page: [1, 1, 1, 0.76, 0.76, 0.87], buff: 0.87, move: [1, 1, 1, 0.8, 0.8, 0.76], mbuff: 0.76, mmend: 1 },
};
const EDGE_BOUNDS: Record<keyof Edge, [number, number]> = { page: [0.75, 1.3], buff: [0.7, 1], move: [0.5, 1.6], mbuff: [0.5, 1.4], mmend: [0.6, 1.4] };
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
      const unit = 0.07 * blastAt(L) * lift;
      // Her pages' lift: the geometric mean over her book's six (their schools, her home school's on its own).
      const book = pathBook(p);
      const pageLift = Math.exp(book.reduce((n, id) => n + Math.log(liftOf(hb, p, id)), 0) / book.length);
      page.push(Math.round((FIT.page.aim / (0.07 * blastAt(L) * pageLift * FIT.page.ref)) * 100) / 100);
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
    MOVE_KNOBS[p] = { power: move.map((x, i) => r2(x * edgeAt(e.move, i))), mend: moveMend.map((x) => r2(x * e.mmend)), buff: r2(e.mbuff), pts: 1 };
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

/** docs/25 item 70's first step: a coordinate search on EDGE (the same dice each time, so a change is weighed fairly)
 *  towards every path 50% against all at POWER_AT's levels from 15 (each figure weighed at its own level, where it alone
 *  stands; the shares at all of them), her moves held in their role (rolesOk). */
function balance(n: number, sweeps: number): void {
  const levels = POWER_AT.filter((L) => L >= 15);
  const at = new Map<number, number>();
  // Two sets of dice, so a step is not taken for one set's luck.
  const costAt = (L: number): number => {
    let j = 0;
    for (const salt of [0, 500]) for (const v of Object.values(winsAt(L, n, salt))) j += (v - 0.5) ** 2;
    return j / 2;
  };
  const total = () => [...at.values()].reduce((a, b) => a + b, 0);
  fitPower();
  for (const L of levels) at.set(L, costAt(L));
  console.log(`start: cost ${total().toFixed(4)} ${levels.map((L) => `L${L} ${at.get(L)!.toFixed(4)}`).join(' ')}`);
  for (let sw = 0; sw < sweeps; sw++) {
    for (const p of CAPTAIN_IDS) for (const key of ['page', 'move', 'buff', 'mbuff', 'mmend'] as const) {
      if (key === 'mmend' && p !== 'drowned') continue;
      if (key === 'mbuff' && p === 'reaver') continue; // docs/25 item 58: her ultimate's +12% as written
      if (key === 'move' && !['corsair', 'admiral', 'drowned'].includes(p)) continue; // no blow in her moves
      const slots = key === 'page' || key === 'move' ? POWER_AT.map((L, i) => (L >= 15 ? i : -2)).filter((i) => i >= 0) : [-1];
      for (const s of slots) {
        const e = EDGE[p];
        const get = () => (s < 0 ? (e[key] as number) : (e[key] as number[])[s]);
        const set = (v: number) => {
          if (s < 0) (e as unknown as Record<string, number>)[key] = v;
          else (e[key] as number[])[s] = v;
        };
        const v0 = get();
        // A figure at one level is weighed there; a share at every level.
        const mine = s >= 0 ? [POWER_AT[s]] : levels;
        for (const f of [1.15, 1 / 1.15]) {
          const [lo, hi] = EDGE_BOUNDS[key];
          const v = Math.max(lo, Math.min(hi, Math.round(v0 * f * 100) / 100));
          if (v === v0) continue;
          set(v);
          fitPower();
          if (!rolesOk(p)) {
            set(v0);
            continue;
          }
          const was = mine.map((L) => at.get(L)!), now = mine.map((L) => costAt(L));
          if (now.reduce((a, b) => a + b, 0) < was.reduce((a, b) => a + b, 0) - 1e-9) {
            mine.forEach((L, i) => at.set(L, now[i]));
            break;
          }
          set(v0);
        }
      }
    }
    fitPower();
    console.log(`sweep ${sw}: cost ${total().toFixed(4)} ${JSON.stringify(EDGE)}`);
  }
  fitPower();
  // And on dice it was not tuned on.
  for (const L of [15, 30, 45, 60]) console.log(`L${L} (other dice): ${Object.entries(winsAt(L, n, 1000)).map(([p, v]) => `${p} ${Math.round(v * 100)}%`).join(' · ')}`);
}

/** The engine's own exchange rate of a point against a share of blows: in a mirror of each path, one side given a hold
 *  for rounds 1–3 — her wins against those of a side whose blows and shots land a share harder (POINT_RATE). */
function rates(level: number, n: number): void {
  const wins = (mine: Record<string, number>): number => {
    let w = 0, g = 0;
    CAPTAIN_IDS.forEach((p) => {
      for (let i = 0; i < n; i++) {
        const [a, b] = sidesAt(level, true, p, p, i * 7 + 3);
        a.gift = { rounds: 3, mine };
        if (playBoard(a, b, i * 13 + 5).winner === 0) w++;
        g++;
      }
    });
    return w / g;
  };
  console.log(`Level ${level}, ${n * 6} mirrors a line: side 0 given the hold for rounds 1–3`);
  for (const [tag, m] of [['nothing', {}], ['blows +10%', { melee: 0.1, shot: 0.1 }], ['blows +20%', { melee: 0.2, shot: 0.2 }], ['blows +30%', { melee: 0.3, shot: 0.3 }],
    ['initiative +1', { init: 1 }], ['initiative +2', { init: 2 }], ['initiative +3', { init: 3 }], ['speed +1', { speed: 1 }], ['speed +2', { speed: 2 }],
    ['morale +1', { morale: 1 }], ['morale +2', { morale: 2 }], ['luck +1', { luck: 1 }], ['luck +2', { luck: 2 }]] as [string, Record<string, number>][]) console.log(`  ${tag.padEnd(14)} ${Math.round(wins(m) * 100)}%`);
}

if (import.meta.main ?? process.argv[1]?.endsWith('balance-paths.ts')) {
  if (process.argv.includes('--roles')) roles(arg('levels') ? LEVELS : BAND_LEVELS);
  else if (process.argv.includes('--rates')) for (const l of arg('levels') ? LEVELS : [30]) rates(l, N);
  else if (process.argv.includes('--balance')) balance(N, Number(arg('sweeps') ?? 2));
  else if (process.argv.includes('--fit')) {
    fitPower();
    const out = (t: Record<CaptainId, PathKnobs>) => CAPTAIN_IDS.map((c) => `  ${c}: { power: [${t[c].power.join(', ')}], mend: [${t[c].mend.join(', ')}], buff: ${t[c].buff}, pts: ${t[c].pts} },`).join('\n');
    console.log(`PATH_KNOBS\n${out(PATH_KNOBS)}\nMOVE_KNOBS\n${out(MOVE_KNOBS)}`);
    roles();
  } else for (const l of LEVELS) print(table(l, N));
}
