// docs/19 E14 (and E17, «арена — равные бои 50 %»): the Colosseum's draft against the battle itself.
//   node tools/balance-arena.ts [bouts]                  the report (mirror armies, the draft's order, skill against the
//                                                          dice, each kind's picks, wins and bans, the paths)
//   node tools/balance-arena.ts 4000 --calibrate [iters]  ARENA_CAL: each kind's measure, so that a kind's pick wins half
//   node tools/balance-arena.ts 4000 --features           what wins a random draft (stacks, shooters, the swift, mixing)
//   node tools/balance-arena.ts 400 --pairs               the paths' table at 400 bouts a cell, each pair's share over
//                                                          both its cells, the worst pair
//   node tools/balance-arena.ts 400 --paths [iters]       ARENA_PATH's Attack and Defence, so that each path's mean is half
//
// Both heroes are the Colosseum's template on their paths (arenaHero), both armies the draft's (draftArmy); a bout is
// the quick battle on the sand (newBattle with `arena`, quickFinish). Drafters:
//  - dice: every ban and pick by the dice among what may be taken (draftChoice, care 0);
//  - steward: the Colosseum's steward (draftChoice, care 1: what the sea's side and a captain's turn run out use);
//  - lookahead: each pick tried by playing the rest of the draft out by the steward and fighting it (a captain who
//    thinks the draft through).

import { Rng } from '../shared/src/rng.ts';
import { UNITS, hasSpecial } from '../shared/src/data/army.ts';
import type { UnitId } from '../shared/src/data/army.ts';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { mixMorale } from '../shared/src/data/drifts.ts';
import {
  ARENA_CAL, ARENA_FAME, ARENA_PATH, ARENA_POOL, arenaHero, draftAct, draftAffordable, draftArmy, draftChoice, draftOpen, draftTurn, newDraft,
} from '../shared/src/data/arena.ts';
import type { Draft, DraftAction } from '../shared/src/data/arena.ts';
import { newBattle, quickFinish } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';

const N = Number(process.argv[2] ?? 400);

export type Drafter = 'dice' | 'steward' | 'lookahead';

/** A side of the sand: the drafted army and the template hero on her path (arena.ts arenaSetup's own). */
export function arenaSide(d: Draft, side: 0 | 1, path: CaptainId): TacSideInput {
  const army = draftArmy(d, side);
  return {
    name: 'Captain', ship: 'Wake', captain: path, hands: 0, marines: 0, gunners: 0, army: army.map((x) => ({ u: x.u, n: x.n, src: x.u })), officers: [], skill: 3, morale: 70, dealt: 1,
    power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: true, holes: 0, gunsOut: 0, fire: false, hero: arenaHero(path), mixed: mixMorale(army, path),
  };
}

/** One bout on the sand: true when side 0 wins. */
export function fight(d: Draft, paths: [CaptainId, CaptainId], seed: number): boolean {
  const rng = new Rng(seed * 7919 + 17);
  // docs/25 block Г: a bout keeps its own length under the boarding's reckoning (items 45–47), as tactical.ts lays it out.
  const bt = newBattle(arenaSide(d, 0, paths[0]), arenaSide(d, 1, paths[1]), seed, 0, rng, { arena: true, len: 'long' });
  quickFinish(bt, 0, rng);
  return bt.over!.winner === 0;
}

/** The rest of a draft played out: her own side by the steward, the other as she reckons the other drafts (`model`). */
function rollout(d: Draft, side: 0 | 1, paths: [CaptainId, CaptainId], rng: Rng, model: Drafter): Draft {
  const x: Draft = { pool: d.pool, bans: [[...d.bans[0]], [...d.bans[1]]], picks: [[...d.picks[0]], [...d.picks[1]]], done: [d.done[0], d.done[1]], pos: d.pos };
  for (let g = 0; g < 64 && draftTurn(x).stage !== 'done'; g++) {
    const t = draftTurn(x);
    const care = t.side === side || model !== 'dice' ? 1 : 0;
    if (draftAct(x, t.side, draftChoice(x, t.side, rng, paths[t.side], care))) draftAct(x, t.side, { op: 'pass' });
  }
  return x;
}

/** A drafter's move (the lookahead reads the other side as `model` drafts). */
export function move(who: Drafter, d: Draft, side: 0 | 1, paths: [CaptainId, CaptainId], rng: Rng, model: Drafter = 'steward', R = 3, K = 3): DraftAction {
  if (who !== 'lookahead' || draftTurn(d).stage !== 'pick') return draftChoice(d, side, rng, paths[side], who === 'dice' ? 0 : 1);
  const can = draftAffordable(d, side);
  if (!can.length) return { op: 'pass' };
  let best = can[0], bv = -1;
  for (const u of can) {
    let w = 0;
    for (let r = 0; r < R; r++) {
      const x = { pool: d.pool, bans: d.bans, picks: [[...d.picks[0]], [...d.picks[1]]] as [UnitId[], UnitId[]], done: [d.done[0], d.done[1]] as [boolean, boolean], pos: d.pos };
      draftAct(x, side, { op: 'pick', u });
      const done = rollout(x, side, paths, new Rng(rng.int(1, 1e9)), model);
      for (let k = 0; k < K; k++) if (fight(done, paths, rng.int(1, 1e9)) === (side === 0)) w++;
    }
    if (w > bv) {
      bv = w;
      best = u;
    }
  }
  return { op: 'pick', u: best };
}

/** A whole draft between two drafters (`who[0]` at seat 0, which bans first; seat 1 picks first). */
export function draft(who: [Drafter, Drafter], paths: [CaptainId, CaptainId], rng: Rng): Draft {
  const d = newDraft(ARENA_POOL);
  for (let g = 0; g < 64 && draftTurn(d).stage !== 'done'; g++) {
    const t = draftTurn(d);
    if (draftAct(d, t.side, move(who[t.side], d, t.side, paths, rng, who[1 - t.side]))) draftAct(d, t.side, { op: 'pass' });
  }
  return d;
}

const pc = (x: number) => `${Math.round(x * 100)}%`;
const pathOf = (rng: Rng): CaptainId => CAPTAIN_IDS[rng.int(0, CAPTAIN_IDS.length - 1)];

/** Each kind: the bouts its taker won, and how often it was taken and banned (`who` both sides). */
export function kindTable(who: [Drafter, Drafter], n: number, seed = 1): Record<string, { won: number; picks: number; bans: number }> {
  const rng = new Rng(seed);
  const out: Record<string, { won: number; picks: number; bans: number }> = {};
  for (const u of ARENA_POOL) out[u] = { won: 0, picks: 0, bans: 0 };
  for (let i = 0; i < n; i++) {
    const paths: [CaptainId, CaptainId] = [pathOf(rng), pathOf(rng)];
    const d = draft(who, paths, rng);
    const w0 = fight(d, paths, 1000 + i);
    for (const s of [0, 1] as const) {
      for (const u of d.picks[s]) {
        out[u].picks++;
        if (w0 === (s === 0)) out[u].won++;
      }
      for (const u of d.bans[s]) out[u].bans++;
    }
  }
  return out;
}

/** The share of bouts drafter A (seat `seatA`) wins against drafter B. */
export function share(a: Drafter, b: Drafter, n: number, seed = 7, seatA: 0 | 1 | 'both' = 'both'): number {
  const rng = new Rng(seed);
  let w = 0;
  for (let i = 0; i < n; i++) {
    const seat: 0 | 1 = seatA === 'both' ? (i % 2 as 0 | 1) : seatA;
    const paths: [CaptainId, CaptainId] = [pathOf(rng), pathOf(rng)];
    const d = draft(seat === 0 ? [a, b] : [b, a], paths, rng);
    if (fight(d, paths, 2000 + i) === (seat === 0)) w++;
  }
  return w / n;
}

/** Mirror armies: the same draft's army on both sides (and the same path): side 0's share. */
export function mirror(n: number, seed = 3): number {
  const rng = new Rng(seed);
  let w = 0;
  for (let i = 0; i < n; i++) {
    const p = pathOf(rng);
    const d = draft(['steward', 'steward'], [p, p], rng);
    const m: Draft = { ...d, picks: [d.picks[0], [...d.picks[0]]] };
    if (fight(m, [p, p], 3000 + i)) w++;
  }
  return w / n;
}

/** Path against path, the same draft by the steward for both: the row path's share (`mirrors` false: a path against
 *  itself is not fought, a half; the other cells the same). */
export function pathMatrix(n: number, mirrors = true): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const a of CAPTAIN_IDS) {
    out[a] = {};
    for (const b of CAPTAIN_IDS) {
      if (a === b && !mirrors) {
        out[a][b] = 0.5;
        continue;
      }
      const rng = new Rng(11 + CAPTAIN_IDS.indexOf(a) * 31 + CAPTAIN_IDS.indexOf(b));
      let w = 0;
      for (let i = 0; i < n; i++) {
        const seat: 0 | 1 = (i % 2) as 0 | 1;
        const paths: [CaptainId, CaptainId] = seat === 0 ? [a, b] : [b, a];
        const d = draft(['steward', 'steward'], paths, rng);
        if (fight(d, paths, 4000 + i) === (seat === 0)) w++;
      }
      out[a][b] = w / n;
    }
  }
  return out;
}

/** Each pair of paths from a path table: the first path's share over both cells (her row and her column, each seat
 *  half the bouts), the farthest from half first. */
export function pathPairs(m: Record<string, Record<string, number>>): { a: CaptainId; b: CaptainId; share: number }[] {
  const out: { a: CaptainId; b: CaptainId; share: number }[] = [];
  CAPTAIN_IDS.forEach((a, i) => CAPTAIN_IDS.slice(i + 1).forEach((b) => out.push({ a, b, share: (m[a][b] + 1 - m[b][a]) / 2 })));
  return out.sort((x, y) => Math.abs(y.share - 0.5) - Math.abs(x.share - 0.5));
}

/** The path table at `n` bouts a cell, each path's mean, each pair's share and the worst. */
function pairsReport(n: number): void {
  const m = pathMatrix(n);
  const p1 = (x: number) => `${(x * 100).toFixed(1)}`;
  console.log(`Paths (row against column, the steward's drafts, ${n} bouts a cell):`);
  console.log(`  ${''.padEnd(10)}${CAPTAIN_IDS.map((c) => c.slice(0, 6).padStart(7)).join('')}   mean`);
  for (const a of CAPTAIN_IDS) console.log(`  ${a.padEnd(10)}${CAPTAIN_IDS.map((b) => p1(m[a][b]).padStart(7)).join('')}   ${p1(CAPTAIN_IDS.reduce((x, b) => x + m[a][b], 0) / CAPTAIN_IDS.length)}`);
  const pairs = pathPairs(m);
  console.log(`Pairs (both cells, ${2 * n} bouts each):`);
  for (const p of pairs) console.log(`  ${`${p.a} – ${p.b}`.padEnd(22)} ${p1(p.share).padStart(5)}`);
  const cells = CAPTAIN_IDS.flatMap((a) => CAPTAIN_IDS.filter((b) => b !== a).map((b) => ({ a, b, v: m[a][b] }))).sort((x, y) => Math.abs(y.v - 0.5) - Math.abs(x.v - 0.5));
  console.log(`  the worst pair ${pairs[0].a} – ${pairs[0].b} ${p1(pairs[0].share)}; the worst cell ${cells[0].a} against ${cells[0].b} ${p1(cells[0].v)}`);
}

/** What wins a random draft: each feature's bucket, the share of its armies that won. */
function features(n: number): void {
  const rng = new Rng(5);
  const by: Record<string, [number, number]> = {};
  const add = (k: string, won: boolean) => {
    const e = (by[k] ??= [0, 0]);
    e[0] += won ? 1 : 0;
    e[1]++;
  };
  for (let i = 0; i < n; i++) {
    const paths: [CaptainId, CaptainId] = [pathOf(rng), pathOf(rng)];
    const d = draft(['dice', 'dice'], paths, rng);
    const w0 = fight(d, paths, 5000 + i);
    for (const s of [0, 1] as const) {
      const won = w0 === (s === 0);
      const p = d.picks[s];
      add(`stacks ${p.length}`, won);
      add(`shooters ${p.filter((u) => hasSpecial(u, 'shooter')).length}`, won);
      add(`swift ${p.filter((u) => hasSpecial(u, 'flying') || UNITS[u].speed >= 6).length}`, won);
      add(`mix ${mixMorale(p.map((u) => ({ u, n: 1 })), paths[s])}`, won);
      add(`top tier ${Math.max(...p.map((u) => UNITS[u].tier))}`, won);
    }
  }
  for (const [k, [w, t]] of Object.entries(by).sort()) console.log(`  ${k.padEnd(14)} ${pc(w / t).padStart(4)}  (${t})`);
}

/** ARENA_CAL by the dice's drafts (every kind in every company): a kind whose takers win more than half fights above
 *  its measure. */
function calibrate(n: number, iters: number): void {
  for (let it = 0; it < iters; it++) {
    const t = kindTable(['dice', 'dice'], n, 100 + it);
    let worst = 0;
    for (const u of ARENA_POOL) {
      const e = t[u];
      const wr = e.picks ? e.won / e.picks : 0.5;
      worst = Math.max(worst, Math.abs(wr - 0.5));
      ARENA_CAL[u] = Math.round((ARENA_CAL[u] ?? 1) * Math.exp(1.6 * (wr - 0.5)) * 1000) / 1000;
    }
    console.log(`  round ${it + 1}: the worst kind ${pc(0.5 + worst)}`);
  }
  console.log(JSON.stringify(Object.fromEntries(ARENA_POOL.map((u) => [u, Math.round((ARENA_CAL[u] ?? 1) * 100) / 100]))));
}

/** ARENA_PATH: each path's weight on the sand, so that its mean against all paths is half — its points of Attack and
 *  Defence together, their lean (Attack less Defence: the pairs pick it, `--pairs`) kept, Attack the odd point. */
function calibratePaths(n: number, iters: number): void {
  const lean = Object.fromEntries(CAPTAIN_IDS.map((c) => [c, (ARENA_PATH[c]?.atk ?? 0) - (ARENA_PATH[c]?.def ?? 0)]));
  for (let it = 0; it < iters; it++) {
    const m = pathMatrix(n, false);
    const mean = Object.fromEntries(CAPTAIN_IDS.map((a) => [a, CAPTAIN_IDS.reduce((x, b) => x + m[a][b], 0) / CAPTAIN_IDS.length]));
    const worst = pathPairs(m)[0];
    console.log(`  round ${it + 1}: ${CAPTAIN_IDS.map((c) => `${c} ${pc(mean[c])} (${ARENA_PATH[c]?.atk ?? 0}/${ARENA_PATH[c]?.def ?? 0})`).join(' · ')}; the worst pair ${worst.a} – ${worst.b} ${pc(worst.share)}`);
    for (const c of CAPTAIN_IDS) {
      const w = (ARENA_PATH[c] ??= {});
      const tot = (w.atk ?? 0) + (w.def ?? 0) + Math.round((0.5 - mean[c]) * (it < 3 ? 16 : 8));
      w.atk = Math.ceil((tot + lean[c]) / 2);
      w.def = tot - w.atk;
    }
  }
  console.log(JSON.stringify(ARENA_PATH));
}

if (import.meta.main ?? process.argv[1]?.endsWith('balance-arena.ts')) {
  if (process.argv.includes('--pairs')) pairsReport(N);
  else if (process.argv.includes('--paths')) calibratePaths(N, Number(process.argv[process.argv.indexOf('--paths') + 1]) || 8);
  else if (process.argv.includes('--calibrate')) calibrate(N, Number(process.argv[process.argv.indexOf('--calibrate') + 1]) || 8);
  else if (process.argv.includes('--features')) features(N);
  else if (process.argv.includes('--fame')) {
    // ARENA_FAME: each kind's takers' share of the bouts in the dice's drafts.
    const t = kindTable(['dice', 'dice'], N, 4242);
    console.log(JSON.stringify(Object.fromEntries(ARENA_POOL.map((u) => [u, Math.round((t[u].picks ? t[u].won / t[u].picks : 0.5) * 100) / 100]))));
  } else {
    const L = Math.max(40, Math.round(N / 5));
    console.log(`The Colosseum (${N} bouts a line; the lookahead ${L}):`);
    console.log(`  mirror armies, side 0 (the boarders' rail) wins            ${pc(mirror(N))}`);
    console.log(`  steward against steward: seat 1 (picks first) wins          ${pc(share('steward', 'steward', N, 9, 1))}`);
    console.log(`  dice against dice: seat 1 wins                              ${pc(share('dice', 'dice', N, 13, 1))}`);
    console.log(`  steward against the dice                                    ${pc(share('steward', 'dice', N))}`);
    console.log(`  lookahead against the dice                                  ${pc(share('lookahead', 'dice', L))}`);
    console.log(`  lookahead against the steward                               ${pc(share('lookahead', 'steward', L))}`);
    for (const who of [['dice', 'dice'], ['steward', 'steward']] as [Drafter, Drafter][]) {
      const t = kindTable(who, N, 21);
      const tot = N * 2;
      console.log(`Each kind, ${who[0]} drafts (taken · its takers won · banned):`);
      for (const u of [...ARENA_POOL].sort((a, b) => t[b].bans - t[a].bans)) console.log(`  ${u.padEnd(16)} ${pc(t[u].picks / N).padStart(4)} · ${pc(t[u].picks ? t[u].won / t[u].picks : 0).padStart(4)} · ${pc(t[u].bans / (tot / 2)).padStart(4)}`);
    }
    console.log('Paths (row against column, the steward\'s drafts):');
    const m = pathMatrix(Math.max(20, Math.round(N / 6)));
    console.log(`  ${''.padEnd(10)}${CAPTAIN_IDS.map((c) => c.slice(0, 6).padStart(7)).join('')}   mean`);
    for (const a of CAPTAIN_IDS) console.log(`  ${a.padEnd(10)}${CAPTAIN_IDS.map((b) => pc(m[a][b]).padStart(7)).join('')}   ${pc(CAPTAIN_IDS.reduce((n, b) => n + m[a][b], 0) / CAPTAIN_IDS.length)}`);
    void ARENA_FAME;
    void draftOpen;
  }
}
