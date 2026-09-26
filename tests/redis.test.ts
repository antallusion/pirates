// Redis shared state. Needs a server: REDIS_TEST_URL=redis://host:port (skipped without one).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RedisClient, SharedState } from '../server/src/persistence/redis.ts';

const URL_ = process.env.REDIS_TEST_URL;
const skip = URL_ ? false : 'set REDIS_TEST_URL to run against Redis';

test('resp client: strings, numbers, arrays, nulls and errors', { skip }, async () => {
  const c = await RedisClient.connect(URL_!);
  assert.equal(await c.command('SET', 'gt:test:a', 'héllo'), 'OK');
  assert.equal(await c.command('GET', 'gt:test:a'), 'héllo');
  assert.equal(await c.command('GET', 'gt:test:none'), null);
  assert.equal(await c.command('INCRBY', 'gt:test:n', 5), 5);
  await c.command('DEL', 'gt:test:l');
  await c.command('RPUSH', 'gt:test:l', 'x', 'y');
  assert.deepEqual(await c.command('LRANGE', 'gt:test:l', 0, -1), ['x', 'y']);
  await assert.rejects(c.command('NOSUCHCOMMAND'), /unknown command/i);
  await c.command('DEL', 'gt:test:a', 'gt:test:n', 'gt:test:l');
  await c.quit();
});

test('two worlds share presence, chat and leaderboards', { skip }, async () => {
  const a = await SharedState.open(URL_!, 'world-a');
  const b = await SharedState.open(URL_!, 'world-b');
  const c = await RedisClient.connect(URL_!);
  await c.command('DEL', 'gt:online', 'gt:board:sunk');
  const heard: string[] = [];
  b.listenChat((from, text) => heard.push(`${from}: ${text}`));
  a.listenChat(() => heard.push('echo'));
  a.publishChat('Vane', 'Sails to the west!');
  a.heartbeat([{ id: 1, name: 'Vane' }]);
  b.heartbeat([{ id: 2, name: 'Quill' }]);
  a.bump('sunk', 1, 'Vane', 3);
  b.bump('sunk', 2, 'Quill', 5);
  await new Promise((r) => setTimeout(r, 200));
  b.heartbeat([]);
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(heard, ['Vane: Sails to the west!'], 'delivered to the other world, not echoed');
  assert.equal(b.onlineCount, 2);
  assert.deepEqual(await a.top('sunk'), [{ name: 'Quill', score: 5 }, { name: 'Vane', score: 3 }]);
  a.leave(1, 'Vane');
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(Number(await c.command('ZCARD', 'gt:online')), 1);
  await c.command('DEL', 'gt:online', 'gt:board:sunk');
  await c.quit();
  await a.close();
  await b.close();
});
