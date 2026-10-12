// The QA playthrough A (docs/30_PLAYTHROUGH_A.md): one new captain from the first screen, the faults found on the way.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recruitCost } from '../server/src/game/crew.ts';
import { join, makeGame } from './helpers.ts';

test('a level gained on the quay sends the port again: the price per man shown is the one the hire takes', () => {
  const { game } = makeGame();
  const conn = join(game, 'Quay');
  const s = [...game.sessions].find((x) => x.name === 'Quay')!;
  assert.ok(s.ship!.docked, 'a new captain begins in port');
  const port = game.portById(s.ship!.docked!)!;
  const before = conn.all('port').length;
  game.grantXp(s, 400, null);
  assert.ok(s.profile!.level >= 2);
  const v = conn.last('port')?.view;
  assert.ok(conn.all('port').length > before && v, 'the port window is sent again');
  assert.equal(v.crewHireCost, recruitCost(game, port, s.profile!, 'sailor', s.ship), 'the price the hire takes');
  const gold = s.profile!.gold;
  conn.push({ t: 'hire', qty: 2 } as never);
  if (s.profile!.gold !== gold) assert.equal(gold - s.profile!.gold, 2 * v.crewHireCost, 'two men at the price shown');
});
