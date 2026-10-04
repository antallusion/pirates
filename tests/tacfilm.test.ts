// QA, 2026-10-04: a film that opens a fight on her screen must not cost her the turn — the clock waits for it, once a
// battle for each side, at most TAC_FILM_HOLD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { TAC_FILM_HOLD, act, newBattle } from '../server/src/game/tacbattle.ts';
import { TAC_TURN } from '../shared/src/data/tactical.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';

const side = (army: ArmyStack[], o: Partial<TacSideInput> = {}): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army,
  officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...o,
});

test('a film over the field holds the clock once a side, capped', () => {
  const rng = new Rng(7);
  const bt = newBattle(side([{ u: 'marine', n: 20 }], { human: true }), side([{ u: 'marine', n: 20 }]), 7, 1000, rng);
  const ends = bt.turnEnds, ai = bt.aiAt;
  assert.equal(act(bt, 0, { a: 'film', ms: 6500 }, 1000, rng), null);
  // (the clock is in seconds, the film's length in ms: 6.5 s more, not 6500 — QA circle, 2026-10-05)
  assert.equal(bt.turnEnds, Math.max(ends, 1000) + 6.5);
  assert.equal(bt.aiAt, Math.max(ai, 1000) + 6.5);
  assert.ok(bt.turnEnds - 1000 < TAC_TURN + 8, `a turn of ${bt.turnEnds - 1000} s`);
  // Once a battle for her side: a second asks for nothing.
  act(bt, 0, { a: 'film', ms: 6500 }, 1000, rng);
  assert.equal(bt.turnEnds, Math.max(ends, 1000) + 6.5);
  // The other side's own film is held too, but never longer than the cap; a wild number is no help.
  const before = bt.turnEnds;
  act(bt, 1, { a: 'film', ms: 1e9 }, 1000, rng);
  assert.equal(bt.turnEnds, before + TAC_FILM_HOLD / 1000);
  const bt2 = newBattle(side([{ u: 'marine', n: 20 }], { human: true }), side([{ u: 'marine', n: 20 }]), 8, 1000, new Rng(8));
  const e2 = bt2.turnEnds;
  act(bt2, 0, { a: 'film', ms: Number.NaN }, 1000, new Rng(8));
  assert.equal(bt2.turnEnds, Math.max(e2, 1000));
});
