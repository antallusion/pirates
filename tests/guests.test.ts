// Guests on a captain's island (docs/12 P10 #13): friends, guildmates and the invited may call (a stranger may not);
// they see her hall, records and people; a round in her tavern pays her treasury; they sign her guestbook; the week's
// visits, rounds and signatures rank the islands.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestPatterns } from '../shared/src/data/guests.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { buyIsland, ownIsland } from '../server/src/game/estate.ts';
import { DRINK_COST, callOn, drink, invite, islandBoard, sign } from '../server/src/game/guests.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';

function offShore(game: Game, s: PlayerSession, islandId: number): void {
  const is = game.world.islands[islandId];
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const x = is.x + Math.sin(a) * (is.radius + 150), y = is.y - Math.cos(a) * (is.radius + 150);
    if (isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.region = is.region;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

test('the invited call: the hall, a round for her treasury, a line in her book, the week’s ranking; a stranger may not', () => {
  const { game } = makeGame();
  const hc = join(game, 'Host Hana');
  const host = game.sessionByName('Host Hana')!;
  onHull(game, host.ship!, 'brig', 5);
  host.profile!.gold = 2_000_000;
  const home = game.world.islands.find((i) => !i.portId && i.region === 'black_coast' && i.radius > 150 && !game.holdings.get(game, i.id))!;
  offShore(game, host, home.id);
  assert.equal(buyIsland(game, host, home.id), null);
  const h = ownIsland(game, host.accountId)!;
  h.buildings.push({ id: 'tavern', condition: 1, unpaid: false });
  const t0 = h.treasury;
  join(game, 'Guest Gus');
  const guest = game.sessionByName('Guest Gus')!;
  guest.profile!.gold = 1000;
  offShore(game, guest, home.id);
  join(game, 'Stranger Stan');
  const stranger = game.sessionByName('Stranger Stan')!;
  offShore(game, stranger, home.id);
  assert.equal(callOn(game, stranger, home.id), 'You are not invited to that island.');
  assert.equal(invite(game, host, 'Guest Gus', true), null);
  const v = callOn(game, guest, home.id);
  assert.ok(typeof v !== 'string');
  assert.equal(v.owner, 'Host Hana');
  assert.equal(v.tavern, true);
  assert.ok(hc.all('toast').some((t) => t.msg === 'Guest Gus calls on your island.'));
  assert.equal(drink(game, guest, home.id), null);
  assert.equal(guest.profile!.gold, 1000 - DRINK_COST);
  assert.equal(h.treasury, t0 + DRINK_COST);
  assert.equal(sign(game, guest, home.id, 'A fine island and a finer rum.'), null);
  assert.equal(sign(game, guest, home.id, 'Again'), 'You have signed already.');
  const again = callOn(game, guest, home.id);
  assert.ok(typeof again !== 'string' && again.guestbook[0].text === 'A fine island and a finer rum.');
  assert.equal(islandBoard(game)[0].owner, 'Host Hana');
  assert.equal(islandBoard(game)[0].score, 1 + 1 + 2);
  // Un-invited: the door shuts.
  assert.equal(invite(game, host, 'guest gus', false), null);
  assert.equal(callOn(game, guest, home.id), 'You are not invited to that island.');
});

test('guests read in Russian', () => {
  setLang('ru');
  assert.equal(serverText('Guest Gus calls on your island.').replace(/\u00a0/g, ' '), 'Капитан Guest Gus заходит к вам на остров.');
  for (const [en, ru] of guestPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
