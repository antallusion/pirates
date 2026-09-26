import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { WHIRLPOOLS, currentAt, seasonFactor, whirlpoolAt } from '../shared/src/world/worldgen.ts';
import { seaStateSpread, stepFronts, weatherAtPoint } from '../server/src/game/weather.ts';
import type { Front } from '../server/src/game/weather.ts';
import { join, makeGame, steps } from './helpers.ts';

test('fronts spawn, drift with the wind and override the regional baseline', () => {
  const rng = new Rng(7);
  let fronts: Front[] = [];
  for (let i = 0; i < 400; i++) fronts = stepFronts(fronts, rng, i * 10, 10, () => Math.PI / 2); // wind toward east
  assert.ok(fronts.length > 0 && fronts.length <= 12);
  const f = fronts[0];
  const x0 = f.x;
  fronts = stepFronts(fronts, rng, 4000, 10, () => Math.PI / 2);
  assert.ok(f.x > x0, 'drifts east with the wind');
  assert.equal(weatherAtPoint([{ ...f, kind: 'storm' }], 'breeze', f.x, f.y), 'storm');
  assert.equal(weatherAtPoint([{ ...f, kind: 'fog' }], 'rain', f.x, f.y), 'rain', 'the more severe weather wins');
  assert.equal(weatherAtPoint([f], 'calm', f.x + f.radius * 2, f.y), 'calm');
});

test('sea state widens broadside spread, big hulls ride it out', () => {
  assert.equal(seaStateSpread(0.5, 1), 1);
  assert.ok(seaStateSpread(1.3, 1) > seaStateSpread(1.3, 5));
  assert.ok(seaStateSpread(1.3, 1) > 1.5);
});

test('maelstroms swirl and pull; the great currents change with the seasons', () => {
  const w = WHIRLPOOLS[0];
  const rim = whirlpoolAt(WHIRLPOOLS, w.x + w.radius, w.y);
  assert.ok(Math.hypot(rim.x, rim.y) > w.strength * 0.8, 'strong flow at the rim');
  assert.ok(rim.x < 0, 'pulls toward the eye');
  assert.equal(whirlpoolAt(WHIRLPOOLS, w.x + 10, w.y + 10).core?.id, w.id);
  const seasons = [0, 1, 2, 3].map((q) => seasonFactor(q * 4 * 48 * 60));
  assert.ok(Math.max(...seasons) - Math.min(...seasons) > 0.2);
  assert.ok(currentAt([], w.x + w.radius, w.y, 0, WHIRLPOOLS).x !== 0);
});

test('a ship in a maelstrom eye is torn apart; captains are warned of fronts', () => {
  const { game } = makeGame();
  const c = join(game, 'Eye Walker');
  c.push({ t: 'undock' });
  const ship = [...game.sessions][0].ship!;
  const w = game.world.whirlpools[0];
  ship.state.x = w.x;
  ship.state.y = w.y;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  const hull0 = ship.hull;
  steps(game, 20 * 3);
  assert.ok(ship.hull < hull0, 'maelstrom damage');
  game.fronts = [{ id: 99, kind: 'storm', x: ship.state.x + 3000, y: ship.state.y, vx: 0, vy: 0, radius: 5000, until: game.now + 999 }];
  steps(game, 20 * 3);
  assert.equal(game.weatherOf(ship), 'storm');
  assert.ok(c.all('fronts').some((m) => m.list.some((f) => f.id === 99)), 'front reported to the client');
  assert.ok(c.all('toast').some((t) => /Storm!/.test(t.msg)), 'weather change announced');
});
