// Crew with fates (docs/12 P10 #11): every officer a past; requests made every couple of game days and kept for three —
// a letter delivered, rum for the lads, a grave visited, a fine or a debt paid in its port — loyalty for keeping them and
// a grudge for forgetting; love in a port, merry evenings there, pining when the ship stays away.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_LENGTH_SEC } from '../shared/src/constants.ts';
import { PASTS, fatePatterns } from '../shared/src/data/fates.ts';
import type { Officer } from '../shared/src/data/crew.ts';
import type { Game } from '../server/src/game/Game.ts';
import { fatesOnDock, fatesOnLand, fulfilRequest, stepFates } from '../server/src/game/fates.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

function withOfficer(game: Game, name: string): { s: PlayerSession; o: Officer } {
  join(game, name);
  const s = game.sessionByName(name)!;
  const o: Officer = { id: `o_${name}`, name: 'Tom Barrow', role: 'lieutenant', level: 3, xp: 0, traits: [], loyalty: 50, wound: null, hiredAt: 0, orderReady: 0 };
  s.profile!.company.officers.push(o);
  return { s, o };
}

test('every officer has a past; a request comes in time, and forgetting it costs loyalty', () => {
  const { game } = makeGame();
  const { o } = withOfficer(game, 'Fate Fay');
  stepFates(game);
  assert.ok(o.fate, 'a fate');
  assert.ok(PASTS[o.fate!.past]);
  for (let i = 0; i < 200 && !o.fate!.request; i++) {
    game.now += DAY_LENGTH_SEC;
    stepFates(game);
  }
  assert.ok(o.fate!.request, 'a request');
  const loyal0 = o.loyalty;
  game.now = o.fate!.request!.until + 1;
  stepFates(game);
  assert.equal(o.fate!.request, null);
  assert.equal(o.loyalty, loyal0 - 10, 'forgotten');
});

test('requests kept: a letter home, rum for the lads, a grave, a fine paid in its port', () => {
  const { game } = makeGame();
  const { s, o } = withOfficer(game, 'Keeper Kit');
  stepFates(game);
  const port = game.world.ports[0];
  // A letter.
  o.fate!.request = { kind: 'letter', port: port.id, until: game.now + 999 };
  s.ship!.docked = port.id;
  fatesOnDock(game, s, port);
  assert.equal(o.fate!.request, null);
  assert.equal(o.loyalty, 75);
  // Rum: five casks go.
  o.fate!.request = { kind: 'rum', until: game.now + 999 };
  s.ship!.cargo = { rum: 7 };
  fatesOnDock(game, s, port);
  assert.equal(s.ship!.cargo.rum, 2);
  assert.equal(o.loyalty, 100);
  // A grave.
  o.loyalty = 40;
  o.fate!.request = { kind: 'grave', island: 12, until: game.now + 999 };
  fatesOnLand(game, s, 11);
  assert.ok(o.fate!.request, 'not that island');
  fatesOnLand(game, s, 12);
  assert.equal(o.fate!.request, null);
  // A brother's fine, paid in his port only.
  o.fate!.request = { kind: 'brother', port: game.world.ports[1].id, n: 300, until: game.now + 999 };
  s.profile!.gold = 1000;
  assert.equal(fulfilRequest(game, s, o.id), 'Not here.');
  s.ship!.docked = game.world.ports[1].id;
  assert.equal(fulfilRequest(game, s, o.id), null);
  assert.equal(s.profile!.gold, 700);
});

test('love in a port: merry evenings there, pining when the ship stays away', () => {
  const { game } = makeGame();
  const { s, o } = withOfficer(game, 'Lover Lu');
  stepFates(game);
  const port = game.world.ports[0];
  o.fate!.love = { port: port.id, name: 'Isolde', seen: game.now };
  s.ship!.morale = 50;
  const l0 = o.loyalty;
  fatesOnDock(game, s, port);
  assert.equal(s.ship!.morale, 55);
  assert.equal(o.loyalty, l0 + 2);
  game.now += 8 * DAY_LENGTH_SEC;
  o.fate!.pinedAt = -1e9;
  stepFates(game);
  assert.equal(o.loyalty, l0 + 2 - 3, 'pining');
});

test('the fates read in Russian', () => {
  setLang('ru');
  assert.equal(serverText('Tom Barrow will not forget this.').replace(/\u00a0/g, ' '), 'Офицер Tom Barrow этого не забудет.');
  for (const [en, ru] of fatePatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
