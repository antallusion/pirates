// The mid-game QA (2026-10-22, tools/mobile/ux/midgame.mjs: the campaign's chapters 2–6 played on a phone in Telegram,
// the island, the fleet, the group): the faults found on the way, each held here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r/g, '');

test('a struck ship’s two choices are hers from afar: the helmsman lays her alongside and the terms are taken there', async () => {
  // She strikes 160 m off and her captor lies still (allstop.ts); the card's buttons were dead until she was steered by
  // hand within 30 m of the hull — the server takes the order from afar and sails her in (Game.acceptSurrender).
  const card = src('client/src/ui/surrender.ts');
  assert.doesNotMatch(card, /!near \? ' disabled'/, 'no choice disabled for the distance');
  assert.doesNotMatch(card, /b\.disabled = !near/, 'nor turned off as she drifts');
  const { EN, RU } = await import('../client/src/lang/ui/colours.ts');
  assert.match(RU['sur.far'], /подвед/, 'the far line tells the helmsman takes her there');
  assert.match(EN['sur.far'], /helmsman/);
  assert.deepEqual([...RU['sur.far'].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), [...EN['sur.far'].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort());
  // the server's side: an order from afar is an approach, not a refusal
  const game = src('server/src/game/Game.ts');
  assert.match(game, /if \(why === SURRENDER_FAR && target\) return approach\(/);
});
