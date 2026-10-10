// docs/25 item 69, the boarding's test matrix (§1.2, owner, 2026-10-09: «абордаж на высоких уровнях должен быть такой,
// чтобы люди играли по 5-10 минут. Абордаж должен быть интересный, чтобы капитанские навыки, группа и умения решали. На
// низких 1 минуты норма это если игрок против игрока. С нпс можно быстрее сражаться»): rounds and modelled minutes by
// level band against a captain and against the sea, round 1's cut of an equal army, the paths even under the
// boarding's rules, and a path's own moves worth their place. The model and its assumption (a captain's decision 6 s
// a stack): tests/balance/boardlen.ts; the table in full: node tools/boarding-time.ts.
//
// Owner, 2026-10-10: «9 матросов убили 20 моих матросов с одного удара … чини атаку всем, чини баланс» — a blow is what
// the stacks' cards say (tests/fairhit.test.ts), so the table here is the honest one (boardlen.ts BANDS; the owner's
// wish of 2026-10-09 is each band's `want`, reached before by inflating the blows by level and against the sea).
//
// Tolerances (each stated where it is used):
// - rounds: the band's own ±0.5 (the mean of a seeded handful of fights per level);
// - minutes: the band's span widened by a quarter both ways (a fifth of the battles decide the mean's second digit).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPathPage } from '../../shared/src/data/paths.ts';
import { tacStats } from '../../server/src/game/tacbattle.ts';
import { BANDS, PATHS, bandStat, playBoard, sidesAt } from './boardlen.ts';
import { BAND_LEVELS, isHomePage, movesAt, roleOf } from './boardskill.ts';
import type { BandStat } from './boardlen.ts';

/** Two levels a band, a third and two thirds in. */
const SAMPLE = (lo: number, hi: number): number[] => [lo + Math.round((hi - lo) * 0.25), lo + Math.round((hi - lo) * 0.75)];
const N = 3;
const mean = (xs: BandStat[], f: (x: BandStat) => number) => xs.reduce((a, x) => a + f(x), 0) / xs.length;

/** Each band's battles, once for the file. */
const rows = BANDS.map((b) => {
  const lv = SAMPLE(b.lo, b.hi);
  const pvp = lv.map((L) => bandStat(L, true, N)), sea = lv.map((L) => bandStat(L, false, N));
  return { b, rounds: mean(pvp, (x) => x.rounds), pvp: mean(pvp, (x) => x.mins), sea: mean(sea, (x) => x.mins), cut1: mean(pvp, (x) => x.cut1), flags: mean(pvp, (x) => x.flags) };
});
const tag = (r: (typeof rows)[number]) => `${r.b.lo}–${r.b.hi}`;

test('docs/25 §1.2 (honest): rounds against a captain by level band — three to four and a half at every level, as the stacks\' own blows make them', () => {
  for (const r of rows) assert.ok(r.rounds >= r.b.rounds[0] - 0.5 && r.rounds <= r.b.rounds[1] + 0.5, `${tag(r)}: ${r.rounds.toFixed(2)} rounds (table ${r.b.rounds.join('–')})`);
  // No band decided in two rounds, none dragged past five.
  for (const r of rows) assert.ok(r.rounds >= 2.75 && r.rounds <= 5, `${tag(r)}: ${r.rounds.toFixed(2)} rounds`);
});

test('docs/25 §1.2 (honest): modelled minutes by band, against a captain and against the sea (a captain\'s decision 6 s a stack)', () => {
  for (const r of rows) {
    const [p0, p1] = r.b.pvp, [s0, s1] = r.b.npc;
    assert.ok(r.pvp >= p0 * 0.75 && r.pvp <= p1 * 1.25, `${tag(r)} against a captain: ${r.pvp.toFixed(2)} min (table ${p0}–${p1})`);
    assert.ok(r.sea >= s0 * 0.75 && r.sea <= s1 * 1.25, `${tag(r)} against the sea: ${r.sea.toFixed(2)} min (table ${s0}–${s1})`);
    assert.ok(r.sea < r.pvp, `${tag(r)}: the sea's fight the quicker`);
  }
  // The longer fights at the top: more stacks and more moves (from the bottom band to the top one, a captain's fight
  // grows by a minute and more).
  assert.ok(rows[rows.length - 1].pvp - rows[0].pvp >= 1, `${rows[0].pvp.toFixed(2)} → ${rows[rows.length - 1].pvp.toFixed(2)} min`);
  // No fight between captains past ~10–12 minutes (item 48's chess clocks hold it there in the game).
  assert.ok(rows.every((r) => r.pvp <= 10.5));
});

// docs/25 item 44's round 1 (~35% → 15–18%) was reached by round 1's scale on the blows (`open`), gone 2026-10-10: round
// 1 takes what the stacks' blows take — a fifth to a half of an equal army, never the whole fight.
test('docs/25 item 44 (honest): round 1 takes a fifth to a half of an equal army at every band — the fight is not decided in it', () => {
  for (const r of rows) assert.ok(r.cut1 >= r.b.r1[0] - 0.05 && r.cut1 <= r.b.r1[1] + 0.05, `${tag(r)}: ${(r.cut1 * 100).toFixed(0)}% (table ${r.b.r1.map((x) => Math.round(x * 100)).join('–')}%)`);
  // From level 40 the quarterdeck's flag decides some of them (item 52), not most.
  // (With fights of three or four rounds a flag held two whole rounds is rare: it takes a ship now and then, never most.)
  for (const r of rows) assert.ok(r.b.lo >= 41 ? r.flags < 0.4 : r.flags === 0, `${tag(r)}: the flag took ${(r.flags * 100).toFixed(0)}%`);
});

// Under the boarding's rules the six paths stood at 29–71% against all at levels 30 and 60 after block Г (2026-10-09:
// the paths' books faded with the level, docs/25 §0). Block Д (items 53–61) gave each path's moves their own knobs on
// real builds and evened them (tools/balance-paths.ts --balance): 35–65% now (the final ±15% between any two is item
// 70's). 144 fights a path a level (24 a pairing): one standard error is ~4 points, so a path at 50% stays inside by
// more than three of them.
test('docs/25 items 54 and 69: under the boarding\'s rules every path wins 35–65% of her fights against all at levels 30 and 60', () => {
  for (const L of [30, 60]) {
    const w: Record<string, [number, number]> = {};
    for (const p of PATHS) for (const q of PATHS) for (let i = 0; i < 24; i++) {
      const flip = i % 2 === 1;
      const [a, b] = sidesAt(L, true, flip ? q : p, flip ? p : q, i * 13 + PATHS.indexOf(p) * 7 + PATHS.indexOf(q));
      const won = (playBoard(a, b, i * 31 + PATHS.indexOf(p) * 5 + PATHS.indexOf(q) + L).winner === 0) !== flip;
      const x = (w[p] ??= [0, 0]);
      x[0] += won ? 1 : 0;
      x[1]++;
    }
    for (const p of PATHS) {
      const s = w[p][0] / w[p][1];
      assert.ok(s >= 0.35 && s <= 0.65, `level ${L}: ${p} ${(s * 100).toFixed(0)}%`);
    }
  }
});

// docs/25 items 54 and 69's third line: «вклад каждой страницы и ульты ≥ 8% в своей роли»; «каждая страница своей школы
// на любом уровне даёт 8–25% в своей роли». Each move in its role (tests/balance/boardskill.ts: a strike as a share of
// her army, a heal of each stack, a hold of a side's blows by the engine's own rates) on a real build of each band's two
// levels: a page of her home school 8–25%, every page 8–25%, her innate move and her ultimate 8% at the least.
test('docs/25 items 54 and 69: every page lays 8–25% in its role at every band, her innate move and her ultimate 8% or more', () => {
  const out: string[] = [];
  for (const p of PATHS) for (const L of BAND_LEVELS) for (const id of movesAt(p, L)) {
    const v = roleOf(p, id, L).v;
    const move = id === 'innate' || id === 'ult';
    if (v < 0.08 - 1e-9 || (!move && v > 0.25 + 1e-9)) out.push(`${p} ${id}${isHomePage(p, id) ? ' (home)' : ''} at ${L}: ${(v * 100).toFixed(1)}%`);
  }
  assert.deepEqual(out, []);
});

// And in the fight itself: the share of a path's harm her own moves lay (her innate move, her ultimate, her path's
// pages) in a mirror at levels 30 and 60 — 2026-10-09 before block Д: 12–29% at 30, the Reaver's 4.4% at 60.
test('docs/25 item 69: a path\'s own moves lay at least 8% of her harm at levels 30 and 60', () => {
  tacStats.on = true;
  try {
    for (const L of [30, 60]) for (const p of PATHS) {
      tacStats.harm.clear();
      let harm = 0;
      for (let i = 0; i < 6; i++) {
        const [a, b] = sidesAt(L, true, p, p, i * 11 + 3);
        const r = playBoard(a, b, i * 17 + L);
        harm += r.harm[0] + r.harm[1];
      }
      let own = 0;
      for (const [k, v] of tacStats.harm) {
        const id = k.split(':')[1];
        if (id === 'innate' || id === 'ult' || isPathPage(id)) own += v;
      }
      assert.ok(own / harm >= 0.08, `level ${L}: ${p}'s own moves ${((own / harm) * 100).toFixed(1)}% of her harm`);
    }
  } finally {
    tacStats.on = false;
    tacStats.harm.clear();
    tacStats.casts.clear();
  }
});
