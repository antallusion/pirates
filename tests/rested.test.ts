// Rest ashore (docs/11 P6): time away after putting in at a port fills a pool of doubled battle experience — a
// twentieth of the level for eight hours, a quarter of that if left at sea, one and a half levels at most.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION, xpForLevel } from '../shared/src/constants.ts';
import { REST_CAP, restAfter } from '../shared/src/data/rested.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';

type Credit = { creditKill(k: unknown, v: unknown, how: string): void };

test('the pool: a twentieth of the level for eight hours in port, a quarter of that at sea, capped', () => {
  const lvl = 10, per = xpForLevel(lvl) * 0.05;
  assert.equal(Math.round(restAfter(0, lvl, 8, true)), Math.round(per));
  assert.equal(Math.round(restAfter(0, lvl, 8, false)), Math.round(per / 4));
  assert.equal(restAfter(0, lvl, 24 * 30, true), xpForLevel(lvl) * REST_CAP);
  assert.equal(restAfter(100, lvl, -5, true), 100, 'no time, no rest');
});

test('ashore in port for sixteen hours: told on coming aboard, and battle experience comes double till spent', () => {
  const { game } = makeGame();
  let wall = 20000 * 86_400_000;
  game.wallNow = () => wall;
  const c = join(game, 'Rested Rory');
  const s = game.sessionByName('Rested Rory')!;
  assert.ok(s.ship!.docked, 'put in at a port');
  const token = c.last('welcome')!.token;
  c.close();
  wall += 16 * 3_600_000;
  const c2 = new FakeConn();
  game.attach(c2 as unknown as WsConnection);
  c2.push({ t: 'hello', v: PROTOCOL_VERSION, token });
  const S = game.sessionByName('Rested Rory')!;
  const pool = S.profile!.rested!;
  assert.equal(Math.round(pool), Math.round(xpForLevel(S.profile!.level) * 0.1));
  assert.ok(c2.all('toast').some((t) => /^Rested ashore: the next \d+ XP won in battle comes double\.$/.test(t.msg)));
  assert.equal(c2.last('init')!.self.rested, Math.round(pool));
  // A pirate sunk: double, and the pool spent by as much.
  S.ship!.docked = null;
  const pirate = game.spawnNpcShip('pirate', 'sloop', 'confederacy', S.ship!.state.x + 300, S.ship!.state.y, 0);
  pirate.attackers.set(S.ship!.id, game.now);
  const xp0 = S.profile!.xp + S.profile!.level * 1e6;
  (game as unknown as Credit).creditKill(S.ship!, pirate, 'sunk');
  const t = c2.all('toast').find((x) => x.kind === 'xp' && x.msg.includes('(rested +'));
  assert.ok(t, `a rested kill: ${c2.all('toast').map((x) => x.msg).join(' | ')}`);
  const bonus = Number(/\(rested \+(\d+)\)/.exec(t!.msg)![1]);
  assert.ok(bonus > 0 && Math.abs(S.profile!.rested! - (pool - bonus)) <= 1, 'the pool spent by the bonus');
  assert.ok(S.profile!.xp + S.profile!.level * 1e6 > xp0);
  // Other experience (a port's first visit, a quest) is not doubled.
  const before = S.profile!.rested!;
  game.grantXp(S, 50, null);
  assert.equal(S.profile!.rested, before);
  void steps;
});

test('rest reads in Russian', () => {
  setLang('ru');
  const lines = [serverText('Rested ashore: the next 240 XP won in battle comes double.'), serverText('+180 XP — Sank Brass Oath (rested +90)')];
  setLang('en');
  assert.deepEqual(lines.filter((l) => /[A-Za-z]{3,}/.test(l.replace(/Brass Oath/g, ''))), []);
});
