// The sea's shorter events (docs/12 P2): the silver galleon with her frigates, the Brethren round their baron, a
// falling star claimed by the first to anchor off it, an eclipse that brings out the uncanny, the lost fleet after the
// Great Storm, and a port's festival.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../shared/src/data/encounters.ts';
import { happeningPatterns } from '../shared/src/data/happenings.ts';
import { DAY_LENGTH_SEC } from '../shared/src/constants.ts';
import { fits } from '../server/src/game/director.ts';
import { stepEvents } from '../server/src/game/events.ts';
import type { Game } from '../server/src/game/Game.ts';
import { priceMods } from '../server/src/game/ports.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

/** Every calendar far off but the one wanted, which is due now; then ten seconds of the world. */
function due(game: Game, kind: string): void {
  const st = game.worldEvents.data(game);
  for (const k of Object.keys(st.next)) st.next[k] = game.wallNow() + 1e12;
  for (const k of ['silver_convoy', 'brethren', 'star', 'eclipse', 'festival']) st.next[k] = game.wallNow() + 1e12;
  st.next[kind] = game.wallNow() - 1;
  for (let i = 0; i < 10; i++) stepEvents(game);
}

const ev = (game: Game, kind: string) => game.worldEvents.active(game).find((e) => e.kind === kind);

test('the silver galleon sails with two frigates; taken, the whole sea hears who took her', () => {
  const { game } = makeGame();
  const c = join(game, 'Watcher Wynn');
  due(game, 'silver_convoy');
  const e = ev(game, 'silver_convoy')!;
  assert.ok(e, 'she sails');
  const fleet = game.worldEvents.fleets.get(e.id)!;
  assert.equal(fleet.length, 3);
  const g = game.ships.get(fleet[0])!;
  assert.equal(g.loadout.classId, 'galleon');
  assert.ok(g.purse >= 8000);
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('WORLD: The Crown’s silver galleon')));
  // A captain takes her.
  const S = game.sessionByName('Watcher Wynn')!;
  g.attackers.set(S.ship!.id, game.now);
  g.hull = 0;
  game.beginSinking(g);
  for (let i = 0; i < 2; i++) stepEvents(game);
  assert.equal(ev(game, 'silver_convoy'), undefined);
  assert.ok(c.all('toast').some((t) => t.msg === `WORLD: Watcher Wynn took the silver galleon ${e.by}! The Crown will want that silver back.`));
});

test('the Brethren gather round an elite baron; sink him and they scatter', () => {
  const { game } = makeGame();
  const c = join(game, 'Hunter Hal');
  due(game, 'brethren');
  const e = ev(game, 'brethren')!;
  assert.ok(e);
  const fleet = game.worldEvents.fleets.get(e.id)!;
  const baron = game.ships.get(fleet[0])!;
  assert.ok(baron.elite && baron.shipLevel >= 8, 'a baron is built for a company');
  assert.ok(fleet.length >= 4);
  baron.hull = 0;
  game.beginSinking(baron);
  stepEvents(game);
  assert.equal(ev(game, 'brethren'), undefined);
  assert.ok(c.all('toast').some((t) => t.msg.startsWith(`WORLD: Baron ${e.by} is sunk off`)));
});

test('a star falls by night; the first captain to anchor off the island takes the star-iron', () => {
  const { game } = makeGame();
  const c = join(game, 'Star Stella');
  const S = game.sessionByName('Star Stella')!;
  // Night falls.
  while (!(game.now % DAY_LENGTH_SEC > DAY_LENGTH_SEC * 0.85)) game.now += 60;
  due(game, 'star');
  const e = ev(game, 'star')!;
  assert.ok(e, 'it falls at night');
  const is = game.world.islands[e.islandId!];
  const ship = S.ship!;
  ship.docked = null;
  S.profile!.docked = null;
  ship.state.x = is.x + is.radius + 200;
  ship.state.y = is.y;
  ship.state.speed = 0;
  ship.cargo = {};
  stepEvents(game);
  stepEvents(game);
  assert.equal(ev(game, 'star'), undefined, 'claimed');
  assert.ok((ship.cargo.sulfur_iron ?? 0) > 0);
  assert.ok(c.all('toast').some((t) => t.msg === `WORLD: Star Stella claims the fallen star on ${is.name}!`));
});

test('an eclipse brings the uncanny by day; a festival’s port is kind to buyers; the Great Storm leaves a lost fleet', () => {
  const { game } = makeGame();
  join(game, 'Day Dora');
  const S = game.sessionByName('Day Dora')!;
  const ship = S.ship!;
  ship.docked = null;
  S.profile!.docked = null;
  ship.region = 'drowned_crown';
  [ship.state.x, ship.state.y] = [30000, 30000];
  while (game.now % DAY_LENGTH_SEC > DAY_LENGTH_SEC * 0.3) game.now += 60; // day
  const bargain = ENCOUNTERS.ghost_bargain;
  const before = fits(game, S, bargain);
  due(game, 'eclipse');
  assert.ok(ev(game, 'eclipse'));
  assert.ok(fits(game, S, bargain) || !before, 'the night-only bargain comes in the eclipse');
  // Festival.
  due(game, 'festival');
  const f = ev(game, 'festival')!;
  const port = game.portById(f.port!)!;
  const kind = priceMods(ship, port, S.profile!, game.now, game);
  const other = game.world.ports.find((p) => p.id !== port.id && p.faction === port.faction)!;
  const plain = priceMods(ship, other, S.profile!, game.now, game);
  assert.ok(kind.buyMul < plain.buyMul);
  // The Great Storm blows out: a lost fleet.
  const st = game.worldEvents.data(game);
  st.list.push({ id: st.seq++, kind: 'storm_century', region: 'gravewater', x: 56000, y: 74000, started: game.wallNow() - 1000, ends: game.wallNow() - 1, title: 'x', stage: 'storm' });
  stepEvents(game);
  assert.ok(game.worldEvents.active(game).some((e) => e.kind === 'lost_fleet' && e.region === 'gravewater'));
});

test('the shorter events read in Russian', () => {
  setLang('ru');
  const lines = [
    'The silver galleon sails from Gravesend to Hollowmere', 'The Crown’s silver galleon Crown Tithe weighs anchor at Gravesend for Hollowmere, with two frigates at her side. A fortune under sail.',
    'WORLD: Ada took the silver galleon Crown Tithe! The Crown will want that silver back.', 'The Brethren gather off Grey Holm', 'The eclipse', 'The sun comes back.',
    'Festival in Gravesend', 'The festival in Gravesend is over.', 'The star-iron is yours: 5 of it in the hold.',
  ].map((l) => serverText(l));
  setLang('en');
  assert.deepEqual(lines.filter((l) => /[A-Za-z]{3,}/.test(l.replace(/Gravesend|Hollowmere|Crown Tithe|Grey Holm|Ada/g, ''))), []);
  assert.ok(happeningPatterns().length >= 20);
});
