// The guild's order of the week (docs/11 P6): one goal a week per guild, sized by its members; members' deeds fill
// it; when done the treasury gains, the log says so, every hand is paid; the next week brings a new order.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUILD_GOAL_KINDS, guildGoalFor, guildGoalPatterns, guildGoalText, guildTreasuryReward } from '../shared/src/data/guildgoal.ts';
import { guildGoalEvent, guildGoalView } from '../server/src/game/guildgoal.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

test('the week’s order turns with the week, differs between guilds and grows with the members', () => {
  const kinds = new Set(Array.from({ length: GUILD_GOAL_KINDS.length }, (_, w) => guildGoalFor(3000 + w, 1, 4).kind));
  assert.equal(kinds.size, GUILD_GOAL_KINDS.length);
  assert.notEqual(guildGoalFor(3000, 1, 4).kind, guildGoalFor(3000, 2, 4).kind, 'another guild, another order');
  assert.ok(guildGoalFor(3000, 1, 20).target > guildGoalFor(3000, 1, 4).target * 4);
});

test('members fill the order; done, the treasury gains and every hand is paid', () => {
  const { game } = makeGame();
  const a = join(game, 'Guild Anna');
  const b = join(game, 'Guild Bert');
  const A = game.sessionByName('Guild Anna')!, B = game.sessionByName('Guild Bert')!;
  A.profile!.gold = 50_000;
  a.push({ t: 'guild', action: 'found', name: 'Salt Wives', tag: 'SW' });
  const g = game.guilds.of(game, A.accountId)!;
  assert.ok(g, 'the guild is founded');
  a.push({ t: 'guild', action: 'invite', name: 'Guild Bert' });
  b.push({ t: 'guild', action: 'answer', id: g.id, accept: true });
  assert.equal(g.members.length, 2);
  // A week whose order is charting.
  let week = 3000;
  while (guildGoalFor(week, g.id, 2).kind !== 'charts') week++;
  game.wallNow = () => week * 7 * 86_400_000 + 3_600_000;
  g.weekly = undefined;
  let v = guildGoalView(game, g, A.accountId);
  assert.equal(v.kind, 'charts');
  // One deed of the week's kind.
  const once = (s: typeof A) => guildGoalEvent(game, s, { k: 'chart' });
  const t0 = g.treasury, goldB = B.profile!.gold;
  for (let i = 0; i < v.target; i++) once(i % 2 ? B : A);
  v = guildGoalView(game, g, A.accountId);
  assert.ok(v.done, 'the order is done');
  assert.equal(g.treasury - t0, guildTreasuryReward(v.target), 'the treasury gains');
  assert.ok(B.profile!.gold > goldB, 'every hand is paid');
  assert.ok(g.log.some((l) => /order of the week is done/.test(l.text)));
  // A new week: a new order.
  const wall = game.wallNow();
  game.wallNow = () => wall + 7 * 86_400_000;
  v = guildGoalView(game, g, A.accountId);
  assert.equal(v.done, false);
  assert.equal(v.progress, 0);
});

test('the order and its lines read in Russian', () => {
  setLang('ru');
  const bad: string[] = [];
  for (const k of GUILD_GOAL_KINDS) {
    if (/[A-Za-z]/.test(guildGoalText(k, 40, 1))) bad.push(guildGoalText(k, 40, 1));
    const line = serverText(`The guild's order of the week is done: ${guildGoalText(k, 40, 0)} The treasury gains 2400 silver.`);
    if (/[A-Za-z]/.test(line)) bad.push(line);
  }
  const share = serverText("Your share of the guild's order: 540 silver.");
  if (/[A-Za-z]/.test(share)) bad.push(share);
  setLang('en');
  assert.deepEqual(bad, []);
  assert.ok(guildGoalPatterns().length > GUILD_GOAL_KINDS.length);
});
