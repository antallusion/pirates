import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ServerMsg } from '../shared/src/protocol.ts';
import { join, makeGame, steps } from './helpers.ts';

test('delta snapshots: unchanged ships are not resent; far ships update less often', () => {
  const { game } = makeGame();
  const c = join(game, 'Watcher', 'corsair');
  const s = [...game.sessions].find((x) => x.name === 'Watcher')!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = 30000;
  ship.state.y = 80000;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  for (const id of [...game.npcs.keys()]) game.removeShip(id);
  const spawn = (dx: number, speed: number) => {
    const o = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + dx, ship.state.y, Math.PI / 2);
    game.npcs.delete(o.id); // no AI: we steer them by hand
    o.state.speed = speed;
    o.state.sail = speed ? 0.5 : 0;
    o.input = { rudder: 0, sailTarget: speed ? 0.5 : 0 };
    game.grid.upsert(o.id, o.state.x, o.state.y);
    return o;
  };
  const near = spawn(300, 6);
  const mid = spawn(1100, 6);
  const still = spawn(-1900, 0);
  steps(game, 4);
  c.inbox.length = 0;
  steps(game, 40); // two seconds: twenty snapshots
  const snaps = c.inbox.filter((m): m is Extract<ServerMsg, { t: 'snap' }> => m.t === 'snap');
  const count = (id: number) => snaps.reduce((a, m) => a + m.ships.filter((r) => r[0] === id).length, 0);
  assert.ok(snaps.length >= 18, `${snaps.length} snapshots`);
  assert.ok(count(near.id) >= snaps.length - 1, `near: ${count(near.id)}`);
  const midN = count(mid.id);
  assert.ok(midN >= snaps.length / 2 - 2 && midN <= snaps.length / 2 + 2, `mid: ${midN}`);
  assert.ok(count(still.id) <= 2, `a ship lying still is not resent: ${count(still.id)}`);
});
