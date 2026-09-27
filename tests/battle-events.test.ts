// Dynamic combat (docs/11 P2): events of a fight — a mast by the board (keep the wreckage as a shield or cut it
// away to free the helm) and the fireship (sink her before she lays herself alongside).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mastWreck } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import { spawnFireship } from '../server/src/game/npc.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

function atSea(game: Game, name: string, x = 30000, y = 80000): { c: FakeConn; ship: ShipEntity } {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((q) => q.name === name)!;
  const ship = s.ship!;
  s.profile!.level = 60;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.region = game.regionAt(x, y);
  game.grid.upsert(ship.id, x, y);
  return { c, ship };
}

test('a mast by the board: the wreckage drags on the helm but shields the side, until it is cut away', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Dismasted');
  const turn0 = ship.stats.turnRate, shield0 = ship.stats.incomingDamageMul, speed0 = ship.stats.maxSpeed;
  ship.addEffect({ id: 'broken_mast', until: game.now + 1e9, mods: { maxSpeed: -0.3 } }, game.now);
  mastWreck(game, ship);
  assert.ok(ship.stats.turnRate < turn0 * 0.8, 'the helm drags');
  assert.ok(ship.stats.incomingDamageMul < shield0, 'the wreckage shields her');
  const dragged = ship.stats.maxSpeed;
  assert.ok(c.all('toast').some((t) => /by the board/.test(t.msg)));
  c.push({ t: 'cut_mast' });
  assert.ok(!ship.hasEffect('mast_wreck'), 'cut away');
  assert.ok(Math.abs(ship.stats.turnRate - turn0) < 1e-6, 'the helm answers again');
  assert.ok(Math.abs(ship.stats.incomingDamageMul - shield0) < 1e-6, 'the side lies open');
  assert.ok(ship.stats.maxSpeed > dragged && ship.stats.maxSpeed < speed0, 'a jury rig: faster than the drag, slower than whole');
  c.push({ t: 'cut_mast' });
  assert.ok(c.all('toast').some((t) => /No wreckage/.test(t.msg)));
});

test('a fireship steers for her mark and, alongside, blows up: holed, afire, men lost — and she is gone', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Marked', 56000, 70000);
  const fire = spawnFireship(game, ship)!;
  assert.ok(fire, 'a fireship in open water');
  assert.ok(c.all('toast').some((t) => /fireship/.test(t.msg)), 'the lookout calls her');
  assert.ok(fire.hasEffect('fire'), 'she burns');
  // Bring her in close, then let her close the last cables.
  fire.state.x = ship.state.x + 220;
  fire.state.y = ship.state.y;
  game.grid.upsert(fire.id, fire.state.x, fire.state.y);
  const hull0 = ship.hull, crew0 = ship.crew, fireHull0 = fire.hull;
  for (let i = 0; i < 20 * 90 && fire.alive && fire.hull > 0; i++) game.step();
  assert.ok(fire.hull <= 0, 'she blew up');
  assert.ok(fireHull0 > 0, 'her own blaze did not burn her down on the way');
  assert.ok(ship.hull < hull0 - ship.stats.hullMax * 0.1, `holed: ${Math.round(hull0 - ship.hull)}`);
  assert.ok(ship.crew < crew0, 'men lost');
  assert.ok(ship.hasEffect('fire'), 'afire');
});

test('a fireship whose mark is gone burns out and sinks', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Escaped', 56000, 70000);
  const fire = spawnFireship(game, ship)!;
  ship.docked = 'x' as never; // safe in harbour
  steps(game, 20 * 3);
  assert.ok(fire.hull <= 0);
});
