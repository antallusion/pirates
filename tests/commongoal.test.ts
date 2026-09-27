// The common cause (docs/11 P6): one goal a day for the whole sea; every captain's deed of its kind counts; when the
// bar is full every hand is paid (more deeds, more pay), those ashore when they come aboard; it lapses at midnight.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMON_KINDS, commonGoalFor, commonPatterns, commonReward, commonText } from '../shared/src/data/commongoal.ts';
import { commonCollect, commonEvent, commonView, resetCommonCache, stepCommon } from '../server/src/game/commongoal.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

test('the goal turns with the day and grows with the captains at sea', () => {
  const kinds = new Set(Array.from({ length: COMMON_KINDS.length }, (_, d) => commonGoalFor(20000 + d, 1).kind));
  assert.equal(kinds.size, COMMON_KINDS.length, 'every kind in turn');
  const quiet = commonGoalFor(20000, 1), busy = commonGoalFor(20000, 80);
  assert.equal(quiet.kind, busy.kind);
  assert.ok(busy.target > quiet.target * 5);
  assert.ok(commonReward(40, 10).silver > commonReward(40, 1).silver, 'more deeds, more pay');
});

test('every captain’s deed counts; the full bar pays every hand, and one ashore collects on coming aboard', () => {
  resetCommonCache();
  const { game } = makeGame();
  let clock = 20002 * 86_400_000 + 3_600_000; // a day whose cause is charting (the kind turns with the day)
  game.wallNow = () => clock;
  const a = join(game, 'Ann Common');
  const b = join(game, 'Bob Common');
  const A = game.sessionByName('Ann Common')!, B = game.sessionByName('Bob Common')!;
  stepCommon(game);
  const view = commonView(game, A.accountId);
  const kind = view.kind;
  const deed = kind === 'charts' ? { k: 'chart' as const } : kind === 'landings' ? { k: 'land' as const, island: 1, feature: 'grove' } : kind === 'prizes' ? { k: 'prize' as const } : null;
  if (!deed) return; // a day of sinking or boarding: covered by the kind test above
  const target = view.target;
  for (let i = 0; i < target - 1; i++) commonEvent(game, i % 3 ? A : B, deed);
  assert.equal(commonView(game, A.accountId).progress, target - 1);
  assert.ok(commonView(game, A.accountId).mine > commonView(game, B.accountId).mine, 'each captain’s own part');
  // Bob goes ashore before the end; Ann finishes it.
  const bobGold = B.profile!.gold;
  const bobAcc = B.accountId;
  (game as unknown as { byAccount: Map<number, unknown> }).byAccount.delete(bobAcc);
  const annGold = A.profile!.gold;
  commonEvent(game, A, deed);
  assert.ok(commonView(game, A.accountId).done, 'the bar is full');
  assert.ok(A.profile!.gold > annGold, 'Ann is paid at once');
  assert.ok(a.all('toast').some((t) => /^WORLD: The common cause is done/.test(t.msg)));
  (game as unknown as { byAccount: Map<number, unknown> }).byAccount.set(bobAcc, B);
  commonCollect(game, B);
  assert.ok(B.profile!.gold > bobGold, 'Bob collects his share on coming aboard');
  assert.ok(b.all('toast').some((t) => /^Your share of the common cause/.test(t.msg)));
  // Midnight: a new cause.
  clock += 86_400_000;
  stepCommon(game);
  assert.equal(commonView(game, A.accountId).progress, 0);
  assert.equal(commonView(game, A.accountId).done, false);
  resetCommonCache();
});

test('the cause and its heralds read in Russian', () => {
  setLang('ru');
  const bad: string[] = [];
  for (const k of COMMON_KINDS) {
    if (/[A-Za-z]/.test(commonText(k, 120, 1))) bad.push(commonText(k, 120, 1));
    const world = serverText(`WORLD: The common cause is done: ${commonText(k, 120, 0)} Every hand in it is paid.`);
    if (/[A-Za-z]/.test(world)) bad.push(world);
  }
  const share = serverText('Your share of the common cause: 820 silver.');
  if (/[A-Za-z]/.test(share)) bad.push(share);
  setLang('en');
  assert.deepEqual(bad, []);
  assert.ok(commonPatterns().length > COMMON_KINDS.length);
});
