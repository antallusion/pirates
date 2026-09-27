// Quests for a crew of captains (docs/11 P6): a group's kill counts on each captain's quests; the tracked quest's
// pointer leads to the step's place and falls silent once there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND_JOBS, JOBS, QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { islandJobOffer, questEvent } from '../server/src/game/quests.ts';
import type { QuestDef } from '../shared/src/data/quests.ts';
import { questPointer } from '../client/src/ui/track.ts';
import { join, makeGame, steps } from './helpers.ts';

test('a group sails as one: the ship one captain sinks counts on a groupmate’s hunt nearby', () => {
  const { game } = makeGame();
  const a = join(game, 'Anne Reef');
  const b = join(game, 'Bram Reef');
  a.push({ t: 'group', action: 'invite', name: 'bram reef' });
  b.push({ t: 'group', action: 'accept', id: b.last('party')!.invites[0].id });
  const A = game.sessionByName('Anne Reef')!, B = game.sessionByName('Bram Reef')!;
  // Both at sea, side by side.
  for (const [c, s, dx] of [[a, A, 0], [b, B, 150]] as const) {
    c.push({ t: 'undock' });
    s.ship!.docked = null;
    s.ship!.state.x = 30000 + dx;
    s.ship!.state.y = 30000;
    s.ship!.state.speed = 0;
  }
  // Bram hunts pirates; Anne does the sinking.
  const hunt: QuestDef = { id: 'test_group_hunt', kind: 'job', name: 'Clear the Lanes', mentor: 'Test', port: 'saltmarrow', summary: '', requires: {}, steps: [{ type: 'sink', count: 2, role: 'pirate', text: 'Sink pirates: 2.' }], reward: { xp: 10, silver: 10 } };
  QUESTS_BY_ID[hunt.id] = hunt;
  B.profile!.quests.active.push({ id: hunt.id, step: 0, progress: 0, startedAt: game.now });
  const pirate = game.spawnNpcShip('pirate', 'sloop', 'confederacy', 30300, 30000, 0);
  pirate.attackers.set(A.ship!.id, game.now);
  (game as unknown as { creditKill(k: unknown, v: unknown, how: string): void }).creditKill(A.ship!, pirate, 'sunk');
  assert.equal(B.profile!.quests.active.find((q) => q.id === hunt.id)?.progress, 1, 'the groupmate’s hunt moved on');
  // Out of reach, it does not count.
  B.ship!.state.x = 60000;
  const far = game.spawnNpcShip('pirate', 'sloop', 'confederacy', 30300, 30000, 0);
  (game as unknown as { creditKill(k: unknown, v: unknown, how: string): void }).creditKill(A.ship!, far, 'sunk');
  assert.equal(B.profile!.quests.active.find((q) => q.id === hunt.id)?.progress, 1, 'a groupmate far away does not share it');
  delete QUESTS_BY_ID[hunt.id];
  steps(game, 1);
});

test('the quest pointer: toward the port or island until near it, toward a region until inside it', () => {
  const base = { id: 'q', name: 'Q', kind: 'job' as const, mentor: 'M', step: 1, steps: 2, text: 't', progress: 0, need: 1 };
  const port = { ...base, target: { x: 10000, y: 0, r: 400 } };
  assert.equal(Math.round(questPointer(port, 0, 0, 'black_coast')!.d), 10000, 'a long way off: the pointer leads there');
  assert.equal(questPointer(port, 9800, 0, 'black_coast'), null, 'arrived: no pointer');
  const region = { ...base, target: { x: 50000, y: 50000, region: 'ashen_isles' as const } };
  assert.ok(questPointer(region, 0, 0, 'black_coast'), 'outside the region: pointed at its heart');
  assert.equal(questPointer(region, 0, 0, 'ashen_isles'), null, 'inside the region: the step is done there');
  assert.equal(questPointer({ ...base }, 0, 0, 'black_coast'), null, 'a step with no place has no pointer');
});

test('the beach: the giver offers, the captain may leave it (and is asked again next time) or take it', () => {
  const { game } = makeGame();
  const c = join(game, 'Lena Shore');
  const s = game.sessionByName('Lena Shore')!;
  s.profile!.level = 60;
  const [islandId, job] = [...ISLAND_JOBS.entries()][0];
  islandJobOffer(game, s, islandId);
  assert.equal(c.last('quest_offer')?.offer.id, job.id);
  c.push({ t: 'quest', action: 'decline', id: job.id });
  assert.ok(!s.profile!.quests.active.some((a) => a.id === job.id), 'left on the beach');
  c.push({ t: 'quest', action: 'accept', id: job.id });
  assert.ok(!s.profile!.quests.active.some((a) => a.id === job.id), 'a declined offer cannot be taken later from afar');
  islandJobOffer(game, s, islandId);
  c.push({ t: 'quest', action: 'accept', id: job.id });
  assert.ok(s.profile!.quests.active.some((a) => a.id === job.id), 'the next landing asks again, and now it is taken');
});

test('sharing a quest with the group: a groupmate is asked, takes it, and the job pays with the port’s standing', () => {
  const { game } = makeGame();
  const a = join(game, 'Ada Share');
  const b = join(game, 'Ben Share');
  a.push({ t: 'group', action: 'invite', name: 'ben share' });
  b.push({ t: 'group', action: 'accept', id: b.last('party')!.invites[0].id });
  const A = game.sessionByName('Ada Share')!, B = game.sessionByName('Ben Share')!;
  const job = JOBS.find((q) => (q.requires.level ?? 1) <= 5 && q.steps[0].type !== 'pickup')!;
  A.profile!.quests.active.push({ id: job.id, step: 0, progress: 0, startedAt: game.now });
  a.push({ t: 'quest', action: 'share', id: job.id });
  const offer = b.last('quest_offer');
  assert.equal(offer?.offer.id, job.id, 'the groupmate is asked');
  assert.equal(offer?.from, 'Ada Share');
  b.push({ t: 'quest', action: 'accept', id: job.id });
  assert.ok(B.profile!.quests.active.some((q) => q.id === job.id), 'and takes it on, wherever they are');
  // A Path is walked alone.
  A.profile!.quests.active.push({ id: 'q_path_smuggler', step: 0, progress: 0, startedAt: game.now });
  a.push({ t: 'quest', action: 'share', id: 'q_path_smuggler' });
  assert.ok(a.all('toast').some((t) => /walked alone/.test(t.msg)), 'a Path is walked alone');
  // Done: the herald says what it paid, and the port's faction remembers.
  const port = game.portById(job.port)!;
  const rep0 = (B.profile!.reputation[port.faction] ?? 0);
  const qs = B.profile!.quests.active.find((q) => q.id === job.id)!;
  qs.step = job.steps.length - 1;
  const last = job.steps[job.steps.length - 1];
  if (last.type === 'visit') {
    questEvent(game, B, { k: 'dock', port: game.portById(last.port)! });
    const done = b.last('quest_done');
    assert.equal(done?.name, job.name);
    assert.equal(done?.silver, Math.round(job.reward.silver * (1 + 0.1 * (done?.company ?? 0))), 'the pay, a tenth more for a groupmate in company');
    assert.ok(done?.rep && done.rep.faction === port.faction && done.rep.n >= 2, 'standing with the port’s faction');
    assert.ok((B.profile!.reputation[port.faction] ?? 0) > rep0);
  }
});

test('a quest done in company pays a tenth more for every groupmate near (up to three)', () => {
  const { game } = makeGame();
  const a = join(game, 'Cy Company');
  const b = join(game, 'Di Company');
  a.push({ t: 'group', action: 'invite', name: 'di company' });
  b.push({ t: 'group', action: 'accept', id: b.last('party')!.invites[0].id });
  const A = game.sessionByName('Cy Company')!, B = game.sessionByName('Di Company')!;
  for (const [c, s, dx] of [[a, A, 0], [b, B, 200]] as const) {
    c.push({ t: 'undock' });
    s.ship!.docked = null;
    s.ship!.state.x = 30000 + dx;
    s.ship!.state.y = 30000;
  }
  const quest: QuestDef = { id: 'test_company', kind: 'job', name: 'In Company', mentor: 'Test', port: 'saltmarrow', summary: '', requires: {}, steps: [{ type: 'chart', count: 1, text: 'Chart an island.' }], reward: { xp: 100, silver: 1000 } };
  QUESTS_BY_ID[quest.id] = quest;
  A.profile!.quests.active.push({ id: quest.id, step: 0, progress: 0, startedAt: game.now });
  const gold0 = A.profile!.gold;
  questEvent(game, A, { k: 'chart' });
  const done = a.last('quest_done');
  assert.equal(done?.company, 1);
  assert.equal(done?.silver, 1100, 'a tenth more with one groupmate near');
  assert.ok(A.profile!.gold - gold0 >= 1100);
  delete QUESTS_BY_ID[quest.id];
});
