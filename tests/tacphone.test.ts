// The hex battle on a phone (docs/23 phase 5): the sea's turn waits a short breath once what came before it has been
// played (owner, 2026-10-08: the pace slowed to be read), and «Ускорить ×2» halves both for both sides' auto-played
// turns; the order is the captain's own, it touches no die; the view carries it back to her screen; and her battle
// settings keep one tap as the default.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { TAC_AI_DELAY, TAC_FAST, TAC_PACE } from '../shared/src/data/tactical.ts';
import { act, aiDelay, newBattle, stepBattle } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { STEP_MS } from '../client/src/ui/tacwalk.ts';
import { defaults } from '../client/src/settings.ts';

const side = (human: boolean): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army: [{ u: 'sailor', n: 20 }, { u: 'marine', n: 10 }],
  officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human,
});

// docs/25 item 50 (owner, 2026-10-09: «с нпс можно быстрее сражаться»): the breath 0.7 → 0.35 s; the walks and blows keep
// their own pace (TAC_PACE), so a foe's turn is still seen whole.
test('a foe\'s turn waits a breath of 0.3–0.4 s once what came before is played, a walk 0.35–0.5 s a hex; ×2 halves the breath', () => {
  assert.ok(TAC_AI_DELAY >= 0.3 && TAC_AI_DELAY <= 0.4, `${TAC_AI_DELAY} s`);
  assert.ok(STEP_MS >= 350 && STEP_MS <= 500 && STEP_MS === TAC_PACE.hex * 1000, `${STEP_MS} ms a hex`);
  const bt = newBattle(side(true), side(false), 3, 0, new Rng(3));
  assert.equal(aiDelay(bt), TAC_AI_DELAY);
  assert.equal(act(bt, 0, { a: 'pace', fast: true }, 0, new Rng(1)), null);
  assert.equal(bt.heroes[0].fast, true);
  assert.equal(aiDelay(bt), TAC_AI_DELAY * TAC_FAST);
  act(bt, 0, { a: 'pace', fast: false }, 0, new Rng(1));
  assert.equal(aiDelay(bt), TAC_AI_DELAY);
});

test('«Ускорить ×2» plays the same battle faster: the sea\'s turns come twice as quick and the dice are the same', () => {
  const run = (fast: boolean) => {
    const bt = newBattle(side(false), side(false), 11, 0, new Rng(11));
    const rng = new Rng(11);
    if (fast) act(bt, 0, { a: 'pace', fast: true }, 0, rng);
    let t = 0;
    while (!bt.over && t < 600) {
      t += 0.05;
      stepBattle(bt, t, rng);
    }
    return { t, over: bt.over, log: bt.log.filter((e) => e.k !== 'round').map((e) => `${e.k}:${e.s ?? ''}:${e.t ?? ''}:${e.dmg ?? ''}`).join('|') };
  };
  const slow = run(false), quick = run(true);
  assert.ok(slow.over && quick.over, 'both end');
  assert.equal(quick.log, slow.log, 'the same blows');
  assert.ok(quick.t < slow.t * 0.6, `${quick.t.toFixed(1)} s against ${slow.t.toFixed(1)} s`);
});

test('the battle\'s settings: one tap is the order by default, ×2 off until asked', () => {
  const d = defaults();
  assert.equal(d.tacConfirm, false);
  assert.equal(d.tacFast, false);
});
