import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminEnabled, runAdmin } from '../server/src/game/admin.ts';
import { join, makeGame } from './helpers.ts';

test('admin commands are off unless GRAVETIDE_ADMIN=1; with it they speed the clock, raise the level, move the ship', () => {
  const was = process.env.GRAVETIDE_ADMIN;
  delete process.env.GRAVETIDE_ADMIN;
  assert.equal(adminEnabled(), false);
  process.env.GRAVETIDE_ADMIN = '1';
  try {
    assert.equal(adminEnabled(), true);
    const { game } = makeGame();
    const conn = join(game, 'Tester');
    const s = [...game.sessions].find((x) => (x.conn as unknown) === conn)!;
    conn.push({ t: 'chat', text: '/silver 1' });
    assert.match(conn.last('toast')?.msg ?? '', /Silver/, 'a slash line in chat reaches the console');
    assert.equal(runAdmin(game, s, 'hello'), null, 'plain chat is not a command');
    runAdmin(game, s, '/speed 8');
    assert.equal(game.timeScale, 8);
    runAdmin(game, s, '/speed 999');
    assert.equal(game.timeScale, 20, 'the clock is capped');
    runAdmin(game, s, '/level 40');
    assert.equal(s.profile!.level, 40);
    assert.equal(s.ship!.level, 40);
    const gold = s.profile!.gold;
    runAdmin(game, s, '/silver 5000');
    assert.equal(s.profile!.gold, gold + 5000);
    runAdmin(game, s, '/tp 20000 30000');
    assert.equal(Math.round(s.ship!.state.x), 20000);
    assert.equal(Math.round(s.ship!.state.y), 30000);
    assert.equal(s.ship!.docked, null);
    runAdmin(game, s, '/god');
    assert.equal(s.ship!.god, true);
    s.ship!.hull = 1;
    game.step();
    assert.equal(s.ship!.hull, s.ship!.stats.hullMax, 'god mode keeps her whole');
    assert.match(runAdmin(game, s, '/nonsense') ?? '', /Unknown/);
  } finally {
    if (was === undefined) delete process.env.GRAVETIDE_ADMIN;
    else process.env.GRAVETIDE_ADMIN = was;
  }
});
