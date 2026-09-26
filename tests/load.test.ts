import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SNAP_CROWD, SNAP_CROWD_EVERY } from '../shared/src/constants.ts';
import { kthSmallest } from '../server/src/game/Game.ts';
import { join, makeGame, steps } from './helpers.ts';

test('quickselect finds the k-th smallest distance', () => {
  for (let n = 1; n < 300; n += 7) {
    const a = Array.from({ length: n }, () => Math.round(Math.random() * 5000));
    const sorted = [...a].sort((x, y) => x - y);
    const k = Math.floor(Math.random() * n);
    assert.equal(kthSmallest([...a], k), sorted[k]);
  }
});

test('snapshots are spread over ticks, yet every captain gets each event exactly once', () => {
  const { game } = makeGame();
  const conns = Array.from({ length: 6 }, (_, i) => join(game, `Spread ${i}`));
  for (const c of conns) c.push({ t: 'undock' });
  steps(game, 4);
  for (const c of conns) c.inbox.length = 0;
  const me = game.sessionByName('Spread 0')!.ship!;
  for (let i = 0; i < 12; i++) {
    game.emit({ k: 'fx', fx: 'war_cry', x: Math.round(me.state.x), y: Math.round(me.state.y), r: 100 + i }, me.state.x, me.state.y);
    game.step();
  }
  steps(game, 4);
  for (const c of conns) {
    const rs = c.all('ev').flatMap((m) => m.list).filter((e) => e.k === 'fx').map((e) => (e as { r: number }).r);
    assert.deepEqual(rs, Array.from({ length: 12 }, (_, i) => 100 + i), 'all twelve, in order, none twice');
  }
  // Each captain still gets snapshots at 10 Hz: 20 ticks → 10 snapshots.
  for (const c of conns) c.inbox.length = 0;
  steps(game, 20);
  for (const c of conns) assert.equal(c.all('snap').length, 10);
});

test('a captain in a crowd drops to 5 Hz, and back when the crowd thins', () => {
  const { game } = makeGame();
  const c = join(game, 'Crowd Centre');
  c.push({ t: 'undock' });
  const s = game.sessionByName('Crowd Centre')!;
  const x = s.ship!.state.x, y = s.ship!.state.y;
  const extra: number[] = [];
  for (let i = 0; i < SNAP_CROWD + 20; i++) extra.push(game.spawnNpcShip('merchant', 'sloop', 'league', x + 100 + (i % 20) * 30, y + 100 + Math.floor(i / 20) * 30, 0, { ship: `Crowd ${i}`, captain: 'Master' }).id);
  for (const id of extra) {
    const b = game.npcs.get(id);
    if (b) b.active = true;
  }
  steps(game, 8);
  assert.equal(s.snapEvery, SNAP_CROWD_EVERY);
  c.inbox.length = 0;
  steps(game, 20);
  assert.equal(c.all('snap').length, 20 / SNAP_CROWD_EVERY);
  for (const id of extra) game.removeShip(id);
  steps(game, 8);
  assert.equal(s.snapEvery, 2);
});

test('private state goes as a patch of what changed', () => {
  const { game } = makeGame();
  const c = join(game, 'Patch Work');
  const s = game.sessionByName('Patch Work')!;
  game.pushSelf(s);
  const raw: string[] = [];
  const send = s.conn.send.bind(s.conn);
  (s.conn as { send: (t: string) => void }).send = (t: string) => {
    raw.push(t);
    send(t);
  };
  s.profile!.gold += 77;
  game.pushSelf(s);
  const patch = JSON.parse(raw.find((r) => r.includes('"self_patch"'))!).patch;
  assert.ok('gold' in patch, 'the gold changed');
  assert.ok(!('talents' in patch) && !('reputation' in patch), 'nothing else is resent');
  raw.length = 0;
  game.pushSelf(s);
  assert.equal(raw.length, 0, 'nothing changed, nothing sent');
  assert.equal(c.last('self')!.self.gold, s.profile!.gold, 'the merged view is whole');
});
