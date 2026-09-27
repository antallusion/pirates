// Quests for a crew of captains (docs/11 P6): a group's kill counts on each captain's quests; the tracked quest's
// pointer leads to the step's place and falls silent once there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
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
