// The Atlas of Sea Wonders (docs/12 P10 #8): seventy wonders in open water off the islands, the same for a seed; found
// by sailing near; the first finder's silver and her right to name it for everyone; a pennant colour every ten; the
// Compass Rose tattoo at ten.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WONDER_COUNT, WONDER_KIND_IDS, WONDER_PENNANTS, placeWonders, wonderPatterns } from '../shared/src/data/wonders.ts';
import { generateWorld, isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { nameWonder, stepWonders, wondersOf, wondersView } from '../server/src/game/wonders.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

function sailTo(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  game.grid.upsert(ship.id, x, y);
  stepWonders(game);
}

test('seventy wonders of every kind, off the islands, the same for a seed', () => {
  const w = generateWorld(1337);
  const a = placeWonders(1337, w.islands), b = placeWonders(1337, generateWorld(1337).islands);
  assert.equal(a.length, WONDER_COUNT);
  assert.deepEqual(a.map((x) => [x.x, x.y]), b.map((x) => [x.x, x.y]));
  for (const k of WONDER_KIND_IDS) assert.ok(a.some((x) => x.kind === k), k);
  assert.ok(a.filter((x) => !isLand(w, x.x, x.y)).length >= WONDER_COUNT * 0.8, 'mostly in open water off the shore');
});

test('found by sailing near; the first finder is paid and names it for everyone; a second finder is not', () => {
  const { game } = makeGame();
  const c = join(game, 'Seeker Sue');
  const s = game.sessionByName('Seeker Sue')!;
  const w = wondersOf(game)[0];
  const gold0 = s.profile!.gold;
  sailTo(game, s, w.x + 200, w.y);
  assert.deepEqual(s.profile!.wonders, [w.id]);
  assert.equal(s.profile!.gold, gold0 + 500);
  assert.ok(c.all('toast').some((t) => t.msg === 'You are the first to find it! Name it in the journal’s atlas.'));
  assert.equal(wondersView(game, s).found[0].canName, true);
  assert.equal(nameWonder(game, s, w.id, 'x'), 'Three to twenty-four letters, spaces or apostrophes');
  assert.equal(nameWonder(game, s, w.id, 'Сияние Сью'), null);
  assert.equal(nameWonder(game, s, w.id, 'Again'), 'That wonder is named already.');
  // Another captain finds it under its new name, with no purse.
  const c2 = join(game, 'Second Sam');
  const s2 = game.sessionByName('Second Sam')!;
  const g2 = s2.profile!.gold;
  sailTo(game, s2, w.x - 200, w.y);
  assert.equal(s2.profile!.gold, g2);
  assert.ok(c2.all('toast').some((t) => t.msg === 'A wonder of the sea: Сияние Сью.'));
  assert.equal(nameWonder(game, s2, w.id, 'Mine Now'), 'Only its first finder names a wonder.');
  assert.equal(wondersView(game, s2).found[0].first, 'Seeker Sue');
});

test('ten wonders: a pennant colour and the Compass Rose', () => {
  const { game } = makeGame();
  join(game, 'Wanderer Wu');
  const s = game.sessionByName('Wanderer Wu')!;
  for (const w of wondersOf(game).slice(0, 10)) sailTo(game, s, w.x, w.y);
  assert.equal(s.profile!.wonders!.length, 10);
  assert.ok(s.profile!.pennants.includes(WONDER_PENNANTS[0]));
  assert.ok(s.profile!.tattoos?.pending.includes('compass_rose') || s.profile!.tattoos?.owned.includes('compass_rose'));
});

test('the wonders read in Russian', () => {
  setLang('ru');
  assert.equal(serverText('Glowing Lagoon of Skull Rock').replace(/\u00a0/g, ' '), 'Светящаяся лагуна у острова Skull Rock');
  for (const [en, ru] of wonderPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
