import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lighthouseIslands, lightRange } from '../server/src/game/havens.ts';
import { join, makeGame, steps } from './helpers.ts';

test('a found cove is a secret harbour: hidden, patched to 80%, the crew steadier; not in a fight, not under way', () => {
  const { game } = makeGame();
  const c = join(game, 'Cove Kit', 'smuggler');
  const s = game.sessionByName('Cove Kit')!;
  c.push({ t: 'undock' });
  const ship = s.ship!;
  const cove = game.coves[0];
  ship.state.x = cove.x;
  ship.state.y = cove.y;
  ship.state.speed = 0;
  ship.state.sail = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.region = game.regionAt(cove.x, cove.y);
  ship.hull = ship.stats.hullMax * 0.3;
  ship.sanity = 40;
  steps(game, 41); // found, then anchored
  assert.ok(s.profile!.smuggle.coves.includes(cove.id));
  steps(game, 20 * 30);
  assert.ok(ship.hasFlag('hidden'), 'hidden from patrols');
  assert.ok(ship.hull > ship.stats.hullMax * 0.3 + 1, 'the carpenters at work');
  assert.ok(ship.sanity > 40);
  steps(game, 20 * 200);
  assert.ok(Math.abs(ship.hull - ship.stats.hullMax * 0.8) < 1, 'no further than 80%');
  assert.ok(c.all('toast').some((m) => /At anchor in/.test(m.msg)));
  // Under way: no shelter.
  ship.state.speed = 4;
  ship.input = { rudder: 0, sailTarget: 1 };
  steps(game, 60);
  assert.equal(ship.havenOf, null);
});

test('lighthouses are seen far beyond the lookout — farther at night — and chart their island', () => {
  assert.ok(lightRange(true, false) > lightRange(false, false));
  assert.equal(lightRange(true, true), lightRange(true, false) / 2);
  const { game } = makeGame();
  const lights = lighthouseIslands(game);
  assert.ok(lights.length > 3);
  const c = join(game, 'Lamp Lou');
  const s = game.sessionByName('Lamp Lou')!;
  c.push({ undock: true, t: 'undock' } as never);
  // Find a lighthouse island not yet charted and stand 4 km off it, far beyond the lookout.
  const id = lights.find((i) => !s.discovered.has(i))!;
  const is = game.world.islands[id];
  s.ship!.state.x = is.x + 4000;
  s.ship!.state.y = is.y;
  s.ship!.region = game.regionAt(is.x + 4000, is.y);
  steps(game, 21);
  assert.ok(s.discovered.has(id), 'charted by its light');
  assert.ok(c.all('toast').some((m) => /A light on the horizon/.test(m.msg)));
});
