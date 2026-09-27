// Tasks of the sea (docs/11 P6): a few pirate nests about the map for three quarters of an hour; every captain's
// pirates sunk there count on their own tally, a groupmate's too; a full tally is paid once; old nests lapse.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TASKS_AT_ONCE, TASK_NEED, TASK_RADIUS, TASK_SEC, taskPatterns, taskReward } from '../shared/src/data/worldtasks.ts';
import { activeTasks, resetTasks, stepTasks } from '../server/src/game/worldtasks.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { join, makeGame } from './helpers.ts';

type Credit = { creditKill(k: unknown, v: unknown, how: string): void };

test('nests are found about the map, kept stocked, told to the map, and lapse in their time', () => {
  const { game } = makeGame();
  resetTasks(game);
  const c = join(game, 'Task Watcher');
  stepTasks(game);
  const list = activeTasks(game);
  assert.equal(list.length, TASKS_AT_ONCE);
  for (const t of list) {
    assert.ok(!game.world.ports.some((p) => Math.hypot(p.x - t.x, p.y - t.y) < 3500), 'clear of the ports');
    assert.notEqual(t.region, 'the_abyss');
  }
  // Stocked on the tenth second.
  while (Math.floor(game.now) % 10 !== 0) game.now += 1;
  stepTasks(game);
  for (const t of list) assert.ok(t.pirates.filter((id) => game.ships.get(id)?.alive).length >= 3, 'three pirates at the nest');
  const view = c.last('tasks')!;
  assert.equal(view.list.length, TASKS_AT_ONCE);
  assert.equal(view.list[0].need, TASK_NEED);
  // Lapsed: new ones in their place.
  const ids = list.map((t) => t.id);
  game.now += TASK_SEC + 1;
  stepTasks(game);
  assert.equal(activeTasks(game).length, TASKS_AT_ONCE);
  assert.ok(activeTasks(game).every((t) => !ids.includes(t.id)), 'the old nests are gone');
  resetTasks(game);
});

test('pirates sunk at a nest fill one’s tally, a groupmate’s too; a full tally pays once; elsewhere does not count', () => {
  const { game } = makeGame();
  resetTasks(game);
  const a = join(game, 'Ann Nest');
  const b = join(game, 'Bo Nest');
  a.push({ t: 'group', action: 'invite', name: 'Bo Nest' });
  b.push({ t: 'group', action: 'accept', id: b.last('party')!.invites[0].id });
  const A = game.sessionByName('Ann Nest')!, B = game.sessionByName('Bo Nest')!;
  stepTasks(game);
  const t = activeTasks(game)[0];
  for (const [s, dx] of [[A, 0], [B, 200]] as const) {
    s.ship!.docked = null;
    s.ship!.state.x = t.x + dx;
    s.ship!.state.y = t.y + 400;
  }
  const sink = (who: typeof A, x: number, y: number) => {
    const p = game.spawnNpcShip('pirate', 'sloop', 'confederacy', x, y, 0);
    p.attackers.set(who.ship!.id, game.now);
    (game as unknown as Credit).creditKill(who.ship!, p, 'sunk');
  };
  // Far from any nest: nothing.
  sink(A, t.x + TASK_RADIUS * 4, t.y);
  assert.equal(t.tally.get(A.accountId) ?? 0, 0);
  const gold = A.profile!.gold;
  for (let i = 0; i < TASK_NEED - 1; i++) sink(A, t.x + 300, t.y);
  assert.equal(t.tally.get(A.accountId), TASK_NEED - 1);
  assert.equal(t.tally.get(B.accountId), TASK_NEED - 1, 'a groupmate’s kills count on Bo’s tally too');
  sink(B, t.x - 300, t.y);
  assert.ok(t.done.has(A.accountId) && t.done.has(B.accountId), 'both tallies full');
  assert.ok(A.profile!.gold - gold >= taskReward(t.level).silver, 'paid');
  assert.ok(a.all('toast').some((m) => m.msg.startsWith('Task of the sea done — Pirate nest off')));
  // Once only.
  const after = A.profile!.gold;
  sink(A, t.x + 300, t.y);
  assert.ok(A.profile!.gold - after < taskReward(t.level).silver, 'not paid twice');
  const v = a.last('tasks')!.list.find((x) => x.id === t.id)!;
  assert.equal(v.done, true);
  resetTasks(game);
});

test('the tasks read in Russian', () => {
  // The world is made in English (as on the server), before the Russian tables are laid over the data.
  const { game } = makeGame();
  const island = game.world.islands.find((i) => i.region === 'black_coast' && !/ Isle$/.test(i.name))!.name;
  setLang('ru');
  applyDataLocale('ru');
  const lines = [
    `Pirate nest off ${island}`,
    `News of the sea: pirates nest off ${island} in The Black Coast. Sink ${TASK_NEED} of them there within 45 min — anyone may.`,
    `Task of the sea done — Pirate nest off ${island}: +520 silver, +720 XP.`,
    `Pirate nest off ${island}: 2/${TASK_NEED}.`,
  ].map((l) => serverText(l));
  setLang('en');
  applyDataLocale('en');
  assert.deepEqual(lines.filter((l) => /[A-Za-z]{3,}/.test(l)), []);
  assert.ok(taskPatterns().length >= 4);
});

test('every island of the world has a Russian name (the key ports’ own islands too)', () => {
  const { game } = makeGame();
  const names = game.world.islands.map((i) => i.name);
  setLang('ru');
  applyDataLocale('ru');
  const bad = names.filter((n) => /[A-Za-z]/.test(serverText(n)));
  setLang('en');
  applyDataLocale('en');
  assert.deepEqual(bad, []);
});
