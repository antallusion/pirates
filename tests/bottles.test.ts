// Bottle mail (docs/12 P10 #6): a note and a little silver into the sea from a ship at sea; the currents carry it;
// after an hour another captain who sails near fishes it out — the note as a letter, the silver hers, and word to the
// thrower; nobody finds it in two weeks and it sinks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOTTLE_COST, BOTTLE_MIN_AGE_MS, BOTTLE_SINK_MS, bottlePatterns } from '../shared/src/data/bottles.ts';
import { bottlesAfloat, stepBottles, throwBottle } from '../server/src/game/bottles.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

test('a bottle thrown at sea drifts, and after an hour a passing captain fishes it out', () => {
  const { game } = makeGame();
  let wall = Date.now();
  game.wallNow = () => wall;
  join(game, 'Thrower Tess');
  const a = game.sessionByName('Thrower Tess')!;
  const ca = join(game, 'Finder Finn');
  const b = game.sessionByName('Finder Finn')!;
  a.ship!.docked = game.world.ports[0].id;
  assert.equal(throwBottle(game, a, 'hello', 0), 'A bottle is thrown from a ship at sea.');
  a.ship!.docked = null;
  assert.equal(throwBottle(game, a, '   ', 0), 'Write something first.');
  a.profile!.gold = 1000;
  assert.equal(throwBottle(game, a, 'If you read this, drink to the Saint of Wrecks.', 200), null);
  assert.equal(a.profile!.gold, 1000 - 200 - BOTTLE_COST);
  const bottle = bottlesAfloat(game)[0];
  const x0 = bottle.x, y0 = bottle.y;
  // Too fresh to find, even alongside.
  b.ship!.docked = null;
  b.ship!.state.x = bottle.x;
  b.ship!.state.y = bottle.y;
  for (let i = 0; i < 30; i++) {
    game.now += 10;
    stepBottles(game);
  }
  assert.equal(bottlesAfloat(game).length, 1, 'not in its first hour');
  assert.ok(bottle.x !== x0 || bottle.y !== y0, 'it drifts');
  // An hour on, she sails past it.
  wall += BOTTLE_MIN_AGE_MS + 1000;
  b.ship!.state.x = bottle.x;
  b.ship!.state.y = bottle.y;
  const gold0 = b.profile!.gold;
  stepBottles(game);
  assert.equal(bottlesAfloat(game).length, 0);
  assert.equal(b.profile!.gold, gold0 + 200);
  assert.ok(ca.all('toast').some((t) => t.msg === 'A bottle in the waves! A note from Thrower Tess. Inside: 200 silver.'));
  const boxB = game.db.getKv<{ letters: { subject: string; body: string }[] }>(`mail:${b.accountId}`)!;
  assert.equal(boxB.letters.at(-1)!.body, 'If you read this, drink to the Saint of Wrecks.');
  const boxA = game.db.getKv<{ letters: { body: string }[] }>(`mail:${a.accountId}`)!;
  assert.match(boxA.letters.at(-1)!.body, /^Your bottle was found by Finder Finn after 0 days afloat\.$/);
});

test('a bottle nobody finds in two weeks goes to the bottom; its thrower never finds her own', () => {
  const { game } = makeGame();
  let wall = Date.now();
  game.wallNow = () => wall;
  join(game, 'Lonely Lu');
  const a = game.sessionByName('Lonely Lu')!;
  a.ship!.docked = null;
  a.profile!.gold = 100;
  throwBottle(game, a, 'Anyone?', 0);
  wall += BOTTLE_MIN_AGE_MS * 2;
  const bottle = bottlesAfloat(game)[0];
  a.ship!.state.x = bottle.x;
  a.ship!.state.y = bottle.y;
  stepBottles(game);
  assert.equal(bottlesAfloat(game).length, 1, 'not by her who threw it');
  wall += BOTTLE_SINK_MS;
  stepBottles(game);
  assert.equal(bottlesAfloat(game).length, 0);
});

test('bottle mail reads in Russian', () => {
  setLang('ru');
  assert.equal(serverText('Your bottle was found by Ada after 3 days afloat.').replace(/\u00a0/g, ' '), 'Вашу бутылку выловил капитан Ada — она плавала 3 дн.');
  for (const [en, ru] of bottlePatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
