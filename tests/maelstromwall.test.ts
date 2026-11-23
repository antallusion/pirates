// Forum 147 (2026-11-23): the Maelstrom Wall throws a captain without leave straight back the way she came, just past
// it, in one push — it pushed her away from the Abyss's centre, along the Wall at its corner, again and again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS } from '../shared/src/world/regions.ts';
import { isLand, regionAt } from '../shared/src/world/worldgen.ts';
import { abyssSecond } from '../server/src/game/abyss.ts';
import { join, makeGame } from './helpers.ts';

test('forum 147: the Maelstrom Wall throws her back out in one push, turned about', () => {
  const { game } = makeGame();
  join(game, 'Wall Walker');
  const s = game.sessionByName('Wall Walker')!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.level = 30;
  // From Leviathan Reach toward the Abyss: the first water of the Abyss on the way.
  const [ax, ay] = REGIONS.the_abyss.center, [lx, ly] = REGIONS.leviathan_reach.center;
  let at: [number, number] | null = null;
  for (let t = 0; t <= 1 && !at; t += 0.002) {
    const x = lx + (ax - lx) * t, y = ly + (ay - ly) * t;
    if (regionAt(game.world, x, y) === 'the_abyss' && !isLand(game.world, x, y)) at = [x + (ax - lx) * 0.004, y + (ay - ly) * 0.004];
  }
  assert.ok(at);
  ship.state.x = at[0];
  ship.state.y = at[1];
  ship.state.heading = Math.atan2(ax - lx, -(ay - ly)); // sailing into it
  ship.region = 'the_abyss';
  const h0 = ship.state.heading, hull0 = ship.hull;
  abyssSecond(game, s);
  assert.notEqual(regionAt(game.world, ship.state.x, ship.state.y), 'the_abyss', 'out past the Wall at once');
  assert.ok(Math.hypot(ship.state.x - at[0], ship.state.y - at[1]) < 3500, 'not kilometres away');
  assert.ok(Math.abs(Math.cos(ship.state.heading - h0) + 1) < 1e-6, 'turned about');
  assert.ok(ship.hull < hull0 && ship.hull > hull0 * 0.96);
});
