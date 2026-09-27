// Daily orders (docs/11 P6): three a day, the same all day and different for each captain; they move on with what
// the captain does, pay as they are done, open a chest when all three are, and days in a row fill the chest more.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_DEFS, DAILY_KINDS, chestReward, dailyPatterns, dailyText, dayOf, rollDailies } from '../shared/src/data/dailies.ts';
import { dailyEvent, dailyRollover } from '../server/src/game/dailies.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

test('three orders a day: the same all day, others tomorrow and for another captain, none above the level', () => {
  const a = rollDailies('7', 20000, 40);
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((o) => o.kind)).size, 3, 'three different orders');
  assert.deepEqual(rollDailies('7', 20000, 40), a, 'the same all day');
  const other = [rollDailies('7', 20001, 40), rollDailies('8', 20000, 40)].map((x) => x.map((o) => `${o.kind}${o.need}`).join());
  assert.ok(other.some((x) => x !== a.map((o) => `${o.kind}${o.need}`).join()), 'others another day or for another captain');
  for (let d = 0; d < 60; d++) {
    for (const o of rollDailies('3', 20000 + d, 1)) {
      assert.ok(DAILY_DEFS[o.kind].minLevel <= 1, `${o.kind} is not for a first-level captain`);
      assert.ok(o.need >= DAILY_DEFS[o.kind].min && o.need <= DAILY_DEFS[o.kind].max);
    }
  }
});

test('the orders move on with the deeds, pay as they are done, and all three open the chest', () => {
  const { game } = makeGame();
  const c = join(game, 'Dora Daily');
  const s = game.sessionByName('Dora Daily')!;
  const p = s.profile!;
  let clock = 20000 * 86_400_000 + 3_600_000;
  game.wallNow = () => clock;
  dailyRollover(game, s);
  // Set today's orders by hand: two charts, one landing, three different ports.
  p.daily.orders = [
    { kind: 'chart', need: 2, progress: 0, done: false },
    { kind: 'land', need: 1, progress: 0, done: false },
    { kind: 'ports', need: 2, progress: 0, done: false },
  ];
  const gold0 = p.gold;
  dailyEvent(game, s, { k: 'chart' });
  assert.equal(p.daily.orders[0].progress, 1);
  dailyEvent(game, s, { k: 'chart' });
  assert.ok(p.daily.orders[0].done && p.gold > gold0, 'done and paid');
  assert.ok(c.all('toast').some((t) => /^Daily order done: Chart islands: 2\./.test(t.msg)));
  dailyEvent(game, s, { k: 'land', island: 3, feature: 'grove' });
  const port = game.world.ports[0], port2 = game.world.ports[1];
  dailyEvent(game, s, { k: 'dock', port });
  dailyEvent(game, s, { k: 'dock', port });
  assert.equal(p.daily.orders[2].progress, 1, 'the same port twice counts once');
  const gold1 = p.gold;
  dailyEvent(game, s, { k: 'dock', port: port2 });
  assert.ok(p.daily.chest, 'all three: the chest');
  assert.equal(p.daily.streak, 1);
  assert.ok(p.gold - gold1 >= chestReward(p.level, 0).silver, 'the chest paid');
  assert.ok(c.all('toast').some((t) => /^All three daily orders done/.test(t.msg)));
  // The next day: new orders; all three again → two days in a row, a fuller chest.
  clock += 86_400_000;
  dailyRollover(game, s);
  assert.equal(p.daily.day, dayOf(clock));
  assert.ok(!p.daily.chest && p.daily.orders.every((o) => !o.done));
  p.daily.orders = [{ kind: 'chart', need: 1, progress: 0, done: false }];
  const gold2 = p.gold;
  dailyEvent(game, s, { k: 'chart' });
  assert.equal(p.daily.streak, 2, 'two days in a row');
  assert.ok(p.gold - gold2 > chestReward(p.level, 0).silver, 'the chest grows with the streak');
  // A day missed: the run is broken.
  clock += 3 * 86_400_000;
  dailyRollover(game, s);
  assert.equal(p.daily.streak, 0, 'a day missed breaks the run');
});

test('every order and every line about them reads in Russian', () => {
  setLang('ru');
  const bad: string[] = [];
  for (const k of DAILY_KINDS) {
    const ru = dailyText(k, 3, 1);
    if (/[A-Za-z]/.test(ru)) bad.push(ru);
    for (const line of [`Daily order done: ${dailyText(k, 3, 0)} +250 silver.`, dailyText(k, 3, 0)]) {
      const t = serverText(line);
      if (/[A-Za-z]/.test(t)) bad.push(`${line} → ${t}`);
    }
  }
  const chest = serverText('All three daily orders done: the chest holds 820 silver. Days in a row: 3.');
  if (/[A-Za-z]/.test(chest)) bad.push(chest);
  setLang('en');
  assert.deepEqual(bad, []);
  assert.ok(dailyPatterns().length > DAILY_KINDS.length);
});
