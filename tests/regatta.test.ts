// The Regatta of Equal Waters (docs/12 P10 #5): a course of six buoys in open water off each of four ports; sign-up at
// the port; at the start every racer near the start buoy is lent the same handling and none may fire; round the buoys
// in order and home; the podium's silver, pennants and title; the course's records; the absent left behind.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRIZES, REGATTA_BUOYS, REGATTA_PORTS, REGATTA_SAIL, regattaPatterns } from '../shared/src/data/regatta.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { damageBlocked } from '../server/src/game/combat.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { courseOf, regattaNow, regattaSignUp, regattaView, stepRegatta } from '../server/src/game/regatta.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function at(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  game.grid.upsert(ship.id, x, y);
}

function racer(game: Game, name: string, port: string, cls: string, level: number): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, cls, level);
  s.ship!.docked = port;
  return { c, s };
}

test('each regatta port has a course of six buoys in open water, the same every time', () => {
  const { game } = makeGame();
  for (const id of REGATTA_PORTS) {
    const b = courseOf(game, id);
    assert.equal(b.length, REGATTA_BUOYS, id);
    for (const [x, y] of b) assert.ok(!isLand(game.world, x, y), `${id} buoy on water`);
    assert.deepEqual(courseOf(game, id), b);
  }
});

test('the race: equal handling for all, no guns; round the buoys and home; the prize, the pennant, the record', () => {
  const { game } = makeGame();
  const port = REGATTA_PORTS[0];
  let wall = Date.now();
  game.wallNow = () => wall;
  regattaNow(game, port, 60_000);
  const { c, s } = racer(game, 'Racer Rae', port, 'galleon', 8);
  const { s: s2 } = racer(game, 'Slow Sal', port, 'sloop', 1);
  const late = racer(game, 'Late Lou', port, 'brig', 5);
  assert.equal(regattaSignUp(game, s), null);
  assert.equal(regattaSignUp(game, s2), null);
  assert.equal(regattaSignUp(game, late.s), null);
  assert.equal(regattaSignUp(game, s), 'You are signed up already.');
  const buoys = courseOf(game, port);
  at(game, s, buoys[0][0] + 200, buoys[0][1]);
  at(game, s2, buoys[0][0] - 200, buoys[0][1]);
  at(game, late.s, buoys[3][0] + 6000, buoys[3][1]);
  // The start.
  wall += 61_000;
  stepRegatta(game);
  assert.equal(regattaView(game, s).phase, 'running');
  assert.ok(s.ship!.hasFlag('regatta_equal'));
  // A galleon and a sloop sail alike.
  const a = s.ship!.sailParams(false), b = s2.ship!.sailParams(false);
  assert.equal(a.maxSpeed, REGATTA_SAIL.maxSpeed);
  assert.equal(b.maxSpeed, REGATTA_SAIL.maxSpeed);
  assert.equal(a.turnRate, b.turnRate);
  assert.equal(damageBlocked(game, s.ship!, s2.ship!), 'No firing in a regatta.');
  assert.ok(late.c.all('toast').some((t) => t.msg === 'You are not at the start: the regatta goes without you.'));
  // Round the buoys in order, and home.
  const gold0 = s.profile!.gold;
  for (let i = 1; i <= REGATTA_BUOYS; i++) {
    const [x, y] = buoys[i % REGATTA_BUOYS];
    at(game, s, x, y);
    game.now += 30;
    stepRegatta(game);
  }
  assert.ok(c.all('toast').some((t) => t.msg === `Buoy 1 of ${REGATTA_BUOYS}.`));
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('You finish 1: ')));
  assert.equal(s.profile!.gold, gold0 + PRIZES[0].silver);
  assert.ok(s.profile!.pennants.includes(PRIZES[0].pennant!));
  assert.ok(s.profile!.titles.includes('Wind-Catcher'));
  assert.equal(regattaView(game, s).records[0].name, 'Racer Rae');
  assert.ok(!s.ship!.hasFlag('regatta_equal'), 'her own ship again');
  // A buoy out of order does not count.
  assert.equal(regattaView(game, s2).passed, 0);
});

test('sign-up only at the race’s port', () => {
  const { game } = makeGame();
  regattaNow(game, REGATTA_PORTS[1], 60_000);
  const { s } = racer(game, 'Wrong Port', REGATTA_PORTS[2], 'sloop', 1);
  assert.match(regattaSignUp(game, s)!, /^Sign-up is at the harbour of /);
});

test('the regatta reads in Russian', () => {
  setLang('ru');
  assert.equal(serverText(`Buoy 3 of ${REGATTA_BUOYS}.`), `Буй 3 из ${REGATTA_BUOYS}.`);
  for (const [en, ru] of regattaPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
