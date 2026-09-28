// Omens of the day (docs/12 P10 #9): one omen a game day for everyone, never the same two days running; the day's
// mods on the ships at sea; fortune for keeping it (a fish landed, a ghost sunk, a storm ridden out, a coin nailed),
// misfortune for breaking it (a merchantman sunk, putting to sea without a cat) — once a day each.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_LENGTH_SEC } from '../shared/src/constants.ts';
import { OMEN_IDS, omenDay, omenOf, omenPatterns } from '../shared/src/data/omens.ts';
import type { OmenId } from '../shared/src/data/omens.ts';
import type { Game } from '../server/src/game/Game.ts';
import { givePet } from '../server/src/game/pets.ts';
import { nailCoin, omenBroken, omenCarcassMul, omenKept, stepOmens, todaysOmen } from '../server/src/game/omens.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

/** Set the game's clock to a day whose omen is the one wanted. */
function dayOf(game: Game, id: OmenId): void {
  for (let d = 1; d < 500; d++) if (omenOf(d) === id) {
    game.now = (d + 0.4) * DAY_LENGTH_SEC;
    assert.equal(omenDay(game.now), d);
    return;
  }
  throw new Error(id);
}

test('one omen a day for all, never the same two days running; every omen comes round', () => {
  const seen = new Set<OmenId>();
  for (let d = 0; d < 400; d++) {
    assert.notEqual(omenOf(d), omenOf(d + 1));
    seen.add(omenOf(d));
  }
  assert.equal(seen.size, OMEN_IDS.length);
});

test('a day that changes the sea: the whistle’s wind on every ship at sea', () => {
  const { game } = makeGame();
  join(game, 'Windy Wes');
  const s = game.sessionByName('Windy Wes')!;
  s.ship!.docked = null;
  dayOf(game, 'albatross');
  stepOmens(game);
  const v0 = s.ship!.stats.maxSpeed;
  dayOf(game, 'whistle');
  stepOmens(game);
  assert.equal(todaysOmen(game), 'whistle');
  assert.ok(s.ship!.stats.maxSpeed > v0, 'faster');
});

test('keeping and breaking: fortune and misfortune, once a day each; the coin under the mast', () => {
  const { game } = makeGame();
  const c = join(game, 'Omen Olga');
  const s = game.sessionByName('Omen Olga')!;
  s.ship!.docked = null;
  dayOf(game, 'dolphins');
  omenKept(game, s, 'ghost');
  assert.ok(!s.ship!.hasEffect('omen_fortune'), 'not the day’s deed');
  omenKept(game, s, 'fish');
  assert.ok(s.ship!.hasEffect('omen_fortune'));
  const n = c.all('toast').length;
  omenKept(game, s, 'fish');
  assert.equal(c.all('toast').length, n, 'once a day');
  dayOf(game, 'albatross');
  omenBroken(game, s, 'merchant');
  assert.ok(s.ship!.hasEffect('omen_misfortune'));
  // The black cat: to sea without a cat invites misfortune; with one, nothing.
  const { game: g2 } = makeGame();
  join(g2, 'Cat Less');
  const a = g2.sessionByName('Cat Less')!;
  dayOf(g2, 'black_cat');
  a.ship!.docked = g2.world.ports[0].id;
  a.profile!.docked = a.ship!.docked;
  givePet(g2, a, 'cat');
  g2.undock(a);
  assert.ok(!a.ship!.hasEffect('omen_misfortune'), 'a cat on deck');
  join(g2, 'No Cat Ned');
  const nc = g2.sessionByName('No Cat Ned')!;
  nc.ship!.docked = g2.world.ports[0].id;
  nc.profile!.docked = nc.ship!.docked;
  g2.undock(nc);
  assert.ok(nc.ship!.hasEffect('omen_misfortune'), 'no cat: misfortune');
  // The coin under the mast, in port, on its day.
  const { game: g3 } = makeGame();
  join(g3, 'Coin Cora');
  const b = g3.sessionByName('Coin Cora')!;
  b.ship!.docked = g3.world.ports[0].id;
  dayOf(g3, 'albatross');
  assert.equal(nailCoin(g3, b), 'Not today’s custom.');
  dayOf(g3, 'coin_mast');
  b.profile!.gold = 100;
  assert.equal(nailCoin(g3, b), null);
  assert.equal(b.profile!.gold, 50);
  assert.ok(b.ship!.hasEffect('fair_wind') && b.ship!.hasEffect('omen_fortune'));
  assert.equal(nailCoin(g3, b), 'The coin is nailed already.');
  dayOf(g3, 'whale_spout');
  assert.equal(omenCarcassMul(g3), 1.25);
});

test('the omens read in Russian', () => {
  setLang('ru');
  assert.equal(serverText('The omen is kept: fortune smiles on you for an hour.').replace(/\u00a0/g, ' '), 'Примета исполнена: час удача на вашей стороне.');
  for (const [en, ru] of omenPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
