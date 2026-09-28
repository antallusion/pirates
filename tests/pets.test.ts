// The ship's pets (docs/12 P10 #3): one on deck at a time, seen by all; the cat keeps the rats down and the stores
// fresh, the parrot screams at a hostile sail, the monkey robs the quay, the dog digs ashore; bought from a tavern's
// pet seller, found at sea and ashore, given by quests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PETS, PET_IDS, petPatterns, petsForSale } from '../shared/src/data/companions.ts';
import { stepCompanions } from '../server/src/game/companion.ts';
import { catAboard, givePet, petAction, petsOnDock, petsOnLand, sanitizePets, stepPets } from '../server/src/game/pets.ts';
import { questEvent } from '../server/src/game/quests.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

test('the old ship’s cat comes aboard as a pet on deck; one pet on deck at a time', () => {
  const { game } = makeGame();
  const c = join(game, 'Cat Carla');
  const s = game.sessionByName('Cat Carla')!;
  const p = s.profile!;
  p.shipCat = true;
  assert.deepEqual(sanitizePets(p), { owned: ['cat'], deck: 'cat' });
  assert.ok(catAboard(p));
  assert.equal(givePet(game, s, 'parrot'), true);
  assert.equal(givePet(game, s, 'parrot'), false, 'one of a kind');
  assert.equal(p.pets!.deck, 'cat', 'the deck stays with the cat');
  assert.equal(petAction(game, s, 'deck', 'parrot'), null);
  assert.equal(p.pets!.deck, 'parrot');
  assert.ok(!catAboard(p), 'the cat below catches no rats');
  assert.equal(petAction(game, s, 'deck', 'dog'), 'That pet is not yours.');
  assert.equal(c.last('petsown')!.view.deck, 'parrot');
});

test('a tavern’s pet seller has two a day; she buys one', () => {
  const { game } = makeGame();
  join(game, 'Buyer Bea');
  const s = game.sessionByName('Buyer Bea')!;
  const port = game.world.ports[0];
  s.ship!.docked = port.id;
  const today = petsForSale(port.id, Math.floor(game.wallNow() / 86_400_000));
  assert.equal(today.length, 2);
  assert.notEqual(today[0], today[1]);
  const other = PET_IDS.find((x) => !today.includes(x))!;
  assert.equal(petAction(game, s, 'buy', other), 'No pet seller here has that one.');
  s.profile!.gold = 5000;
  assert.equal(petAction(game, s, 'buy', today[0]), null);
  assert.equal(s.profile!.gold, 5000 - PETS[today[0]].price);
  assert.ok(s.profile!.pets!.owned.includes(today[0]));
  assert.equal(petAction(game, s, 'buy', today[0]), 'You have that pet already.');
});

test('the parrot screams when a hostile sail turns towards her, and curses in a fight', () => {
  const { game } = makeGame();
  const c = join(game, 'Parrot Pia');
  const s = game.sessionByName('Parrot Pia')!;
  const ship = s.ship!;
  ship.docked = null;
  givePet(game, s, 'parrot');
  const foe = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x, ship.state.y - 1500, 0);
  game.npcs.get(foe.id)!.target = ship.id;
  stepPets(game);
  assert.ok(c.all('toast').some((t) => t.msg === 'The parrot screams: “Sail to the north! Sail to the north!”'));
  const n = c.all('toast').length;
  stepPets(game);
  assert.equal(c.all('toast').length, n, 'once, not every second');
  ship.lastCombat = game.now;
  stepPets(game);
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('The parrot screeches at the enemy: ')));
});

test('the monkey robs the quay (and is caught now and then); the dog digs ashore', () => {
  const { game } = makeGame();
  join(game, 'Monkey Mo');
  const s = game.sessionByName('Monkey Mo')!;
  const p = s.profile!;
  givePet(game, s, 'monkey');
  const port = game.world.ports[0];
  const gold0 = p.gold;
  for (let i = 0; i < 60; i++) petsOnDock(game, s, port);
  assert.ok(p.gold > gold0, 'the purses outweigh the fines');
  givePet(game, s, 'dog');
  petAction(game, s, 'deck', 'dog');
  const g1 = p.gold, maps0 = p.explore?.maps?.length ?? 0;
  const island = game.world.islands.find((is) => !is.portId)!;
  for (let i = 0; i < 40; i++) petsOnLand(game, s, island, 'cove');
  assert.ok(p.gold > g1 || (p.explore?.maps?.length ?? 0) > maps0, 'something dug up');
});

test('Mother Grisel’s first quest gives a kitten; the sea sees the pet on deck', () => {
  const { game } = makeGame();
  join(game, 'Grisel Friend');
  const s = game.sessionByName('Grisel Friend')!;
  s.ship!.docked = null;
  s.profile!.quests.active.push({ id: 'side_cat_1', step: 0, progress: 0, startedAt: game.now });
  questEvent(game, s, { k: 'land', island: game.world.islands.find((is) => !is.portId)!.id, feature: 'cove' });
  questEvent(game, s, { k: 'dock', port: game.portById('tidewrack')! });
  assert.ok(s.profile!.quests.done.includes('side_cat_1'));
  assert.ok(s.profile!.pets!.owned.includes('cat'));
  const w = join(game, 'Watcher Walt');
  const ws = game.sessionByName('Watcher Walt')!;
  ws.ship!.docked = null;
  ws.ship!.state.x = s.ship!.state.x + 500;
  ws.ship!.state.y = s.ship!.state.y;
  game.now = Math.ceil(game.now / 3) * 3;
  stepCompanions(game);
  assert.ok(w.last('pets')!.list.some((x) => x.ship === s.ship!.id && x.deck === 'cat'));
});

test('the pets read in Russian', () => {
  setLang('ru');
  assert.equal(serverText('The parrot screams: “Sail to the south-west! Sail to the south-west!”').replace(/\u00a0/g, ' '), 'Попугай вопит: «Парус на юго-западе! Парус на юго-западе!»');
  assert.equal(serverText('A new pet aboard: Parrot.').replace(/\u00a0/g, ' '), 'Новый питомец на борту: Попугай.');
  for (const [en, ru] of petPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
