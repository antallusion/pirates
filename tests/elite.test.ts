// Group contracts (docs/11 P6): one a day at every port — a raiders' flagship with two escorts, made for a company
// of three; everyone who takes it hunts the same ship, a groupmate's kill counts for all, and a lost quarry is put
// to sea again.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELITE_GROUP, eliteContractFor, eliteLevel, elitePatterns } from '../shared/src/data/elite.ts';
import { dayOf } from '../shared/src/data/dailies.ts';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { questEvent, sanitizeQuests } from '../server/src/game/quests.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { join, makeGame } from './helpers.ts';

type Credit = { creditKill(k: unknown, v: unknown, how: string): void };

test('a contract a day at every port: the same all day, another tomorrow, stronger in wilder waters', () => {
  const { game } = makeGame();
  const a = eliteContractFor('saltmarrow', 20000)!, b = eliteContractFor('saltmarrow', 20000)!;
  assert.equal(a, b);
  assert.notEqual(eliteContractFor('saltmarrow', 20001)!.id, a.id);
  assert.equal(a.group, ELITE_GROUP);
  assert.equal(a.category, 'elite');
  const wild = game.world.ports.find((p) => p.region === 'ashen_isles')!;
  assert.ok(eliteLevel(wild.region) > eliteLevel('black_coast'));
  assert.ok(eliteContractFor(wild.id, 20000)!.reward.silver > a.reward.silver);
});

test('on the board, taken by two captains of a group: one flagship with her escorts, and one kill wins it for both', () => {
  const { game } = makeGame();
  const a = join(game, 'Ann Contract');
  const b = join(game, 'Bo Contract');
  const A = game.sessionByName('Ann Contract')!, B = game.sessionByName('Bo Contract')!;
  for (const s of [A, B]) s.profile!.level = 20;
  a.push({ t: 'group', action: 'invite', name: 'Bo Contract' });
  b.push({ t: 'group', action: 'accept', id: b.last('party')!.invites[0].id });
  const port = game.portById(A.ship!.docked!)!;
  const id = `elite_${port.id}_${dayOf(game.wallNow())}`;
  a.push({ t: 'dock', bribe: false });
  const offer = a.last('port')!.view!.questOffers.find((o) => o.id === id);
  assert.ok(offer, 'the day\'s contract is on the board');
  assert.equal(offer!.group, ELITE_GROUP);
  a.push({ t: 'quest', action: 'accept', id });
  b.push({ t: 'quest', action: 'accept', id });
  const qa = A.profile!.quests.active.find((q) => q.id === id)!, qb = B.profile!.quests.active.find((q) => q.id === id)!;
  assert.ok(qa && qb, 'both hold it');
  assert.ok(qa.leader !== undefined && qa.leader === qb.leader, 'one flagship for all who hold the contract');
  const flag = game.ships.get(qa.leader!)!;
  assert.ok(['frigate', 'galleon', 'man_o_war'].includes(flag.cls.id));
  const escorts = [...game.ships.values()].filter((x) => x !== flag && x.alive && x.npcRole === 'pirate' && Math.hypot(x.state.x - flag.state.x, x.state.y - flag.state.y) < 400);
  assert.ok(escorts.length >= 1, 'escorts at her side');
  assert.ok(a.all('toast').some((t) => t.msg.includes('with two escorts in')), 'word of the quarry');
  // Another pirate does not count; the flagship does, for both.
  const other = escorts[0];
  other.attackers.set(B.ship!.id, game.now);
  (game as unknown as Credit).creditKill(B.ship!, other, 'sunk');
  assert.equal(qa.step, 0, 'an escort is not the flagship');
  B.ship!.docked = null;
  B.ship!.state.x = flag.state.x + 300;
  B.ship!.state.y = flag.state.y;
  A.ship!.docked = null;
  A.ship!.state.x = flag.state.x + 500;
  A.ship!.state.y = flag.state.y;
  flag.attackers.set(B.ship!.id, game.now);
  (game as unknown as Credit).creditKill(B.ship!, flag, 'sunk');
  assert.equal(B.profile!.quests.active.find((q) => q.id === id)?.step, 1, 'her sinker is on to the bounty');
  assert.equal(A.profile!.quests.active.find((q) => q.id === id)?.step, 1, 'and so is his groupmate');
  // Back in port: paid.
  questEvent(game, A, { k: 'dock', port });
  assert.ok(A.profile!.quests.done.includes(id));
  assert.ok(a.all('quest_done').some((d) => d.silver >= offer!.silver));
});

test('a quarry lost to strangers or to time is put to sea again; a saved contract is found after a restart', () => {
  const { game } = makeGame();
  const c = join(game, 'Cy Contract');
  const s = game.sessionByName('Cy Contract')!;
  s.profile!.level = 20;
  const port = game.portById(s.ship!.docked!)!;
  const id = `elite_${port.id}_${dayOf(game.wallNow())}`;
  c.push({ t: 'dock', bribe: false });
  c.push({ t: 'quest', action: 'accept', id });
  const qs = s.profile!.quests.active.find((q) => q.id === id)!;
  const first = qs.leader!;
  game.removeShip(first);
  questEvent(game, s, { k: 'tick', dt: 1 });
  assert.ok(qs.leader !== undefined && qs.leader !== first && game.ships.get(qs.leader)?.alive, 'a new flagship, and the mark follows her');
  // A restart: the registry forgets the day's contract; the captain's journal still finds it.
  const def = QUESTS_BY_ID[id];
  delete QUESTS_BY_ID[id];
  sanitizeQuests(s.profile!);
  assert.ok(s.profile!.quests.active.some((q) => q.id === id), 'kept');
  assert.equal(QUESTS_BY_ID[id]?.name, def.name);
});

test('the contracts read in Russian', () => {
  setLang('ru');
  applyDataLocale('ru');
  const bad: string[] = [];
  const q = eliteContractFor('saltmarrow', 20002)!;
  for (const t of [q.name, q.summary, q.mentor, ...q.steps.map((x) => x.text), 'Isolde Crane sails the Black Tithe with two escorts in The Black Coast. Take a company.']) {
    const ru = serverText(t);
    if (/[A-Za-z]{3,}/.test(ru.replace(/Isolde Crane|Black Tithe/g, ''))) bad.push(ru);
  }
  setLang('en');
  applyDataLocale('en');
  assert.deepEqual(bad, []);
  assert.ok(elitePatterns().length >= 8);
});
