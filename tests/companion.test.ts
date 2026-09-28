// The orca companion (docs/12 P10 #2): the White Orca's calf comes to the one who took her (or from Ingrid), swims
// in its captain's wake for everyone to see, finds shoals and whales by the compass, strikes an enemy's rudder in a
// fight, grows to level ten, and wears a harness made at a forge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CALF_MAX_LEVEL, HARNESSES, calfStrike, calfXpNext, companionPatterns, compassPoint } from '../shared/src/data/companions.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { isLand, regionAt } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { clearBeasts, spawnWhiteOrca } from '../server/src/game/beasts.ts';
import { companionAction, giveCalf, stepCompanions } from '../server/src/game/companion.ts';
import { herringShoals, shoalsOf } from '../server/src/game/fishing.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { questEvent } from '../server/src/game/quests.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function atSea(game: Game, name: string): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  onHull(game, ship, 'brig', 6);
  const [cx, cy] = REGIONS.gravewater.center;
  for (let k = 0; k < 400; k++) {
    const x = cx + ((k * 7919) % 16000) - 8000, y = cy + ((k * 104729) % 16000) - 8000;
    if (regionAt(game.world, x, y) !== 'gravewater' || isLand(game.world, x, y)) continue;
    let clear = true;
    for (let a = 0; a < 8 && clear; a++) if (isLand(game.world, x + Math.cos(a) * 1500, y + Math.sin(a) * 1500)) clear = false;
    if (!clear) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.region = 'gravewater';
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s, ship };
}

test('the White Orca taken: her calf follows the one who took her; Ingrid’s last quest entrusts one too', () => {
  const { game } = makeGame();
  clearBeasts(game);
  const { c, s, ship } = atSea(game, 'Calf Cleo');
  const queen = spawnWhiteOrca(game, ship.state.x + 300, ship.state.y);
  queen.attackers.set(ship.id, game.now);
  queen.hull = 0;
  game.beginSinking(queen);
  assert.ok(s.profile!.companion, 'a calf');
  assert.equal(s.profile!.companion!.level, 1);
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('An orphaned White Orca calf')));
  assert.equal(c.last('companion')!.view!.name, 'Snowdrop');
  // Ingrid's chain ends with one (for a captain who has none yet).
  const { c: c2, s: s2 } = atSea(game, 'Ingrid Friend');
  s2.profile!.quests.active.push({ id: 'side_ingrid_3', step: 0, progress: 0, startedAt: game.now });
  for (let i = 0; i < 3; i++) questEvent(game, s2, { k: 'beast', beast: 'orca' });
  questEvent(game, s2, { k: 'dock', port: game.portById('harpoon_rest')! });
  assert.ok(s2.profile!.quests.done.includes('side_ingrid_3'));
  assert.ok(s2.profile!.companion, 'Ingrid’s calf');
  assert.ok(c2.all('toast').some((t) => t.msg.startsWith('Ingrid entrusts you')));
  assert.equal(giveCalf(game, s, 'ingrid'), false, 'one calf a captain');
});

test('it grows at sea and faster in a fight, to level ten', () => {
  const { game } = makeGame();
  const { s } = atSea(game, 'Growing Gil');
  giveCalf(game, s, 'orphan');
  const cmp = s.profile!.companion!;
  for (let i = 0; i < 10 * calfXpNext(1) + 5; i++) {
    game.now += 1;
    stepCompanions(game);
  }
  assert.ok(cmp.level >= 2, `level ${cmp.level}`);
  cmp.level = CALF_MAX_LEVEL;
  cmp.xp = 0;
  for (let i = 0; i < 100; i++) {
    game.now += 1;
    stepCompanions(game);
  }
  assert.equal(cmp.level, CALF_MAX_LEVEL, 'grown');
});

test('it dives and comes up where the shoal is, by the compass', () => {
  const { game } = makeGame();
  clearBeasts(game);
  const { c, s, ship } = atSea(game, 'Finder Fay');
  giveCalf(game, s, 'orphan');
  for (const sh of shoalsOf(game)) sh.x = 1e9;
  herringShoals(game, 'gravewater', 1);
  const sh = shoalsOf(game).find((x) => x.x < 1e8)!;
  sh.x = ship.state.x + 1500;
  sh.y = ship.state.y;
  s.profile!.companion!.findAt = 0;
  stepCompanions(game);
  assert.ok(c.all('toast').some((t) => t.msg === 'Snowdrop dives and comes up to the east: a shoal.'), c.all('toast').map((t) => t.msg).join(' | '));
  assert.deepEqual(compassPoint(0, -10), ['north', 'севере']);
  assert.deepEqual(compassPoint(-10, 10), ['south-west', 'юго-западе']);
});

test('in a fight it strikes the enemy’s rudder, harder with the iron harness', () => {
  const { game } = makeGame();
  const { c, s, ship } = atSea(game, 'Striker Sid');
  giveCalf(game, s, 'orphan');
  const foe = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + 250, ship.state.y, 0);
  game.grid.upsert(foe.id, foe.state.x, foe.state.y);
  foe.attackers.set(ship.id, game.now);
  ship.attackers.set(foe.id, game.now);
  ship.lastCombat = game.now;
  const rudder0 = foe.rudderHp;
  stepCompanions(game);
  assert.ok(foe.rudderHp < rudder0, 'the rudder is hurt');
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('Snowdrop strikes the rudder of ')));
  assert.ok(calfStrike(5, 'iron').rudder > calfStrike(5, null).rudder && calfStrike(5, 'iron').every < calfStrike(5, null).every);
});

test('harnesses are made at a forge from their goods, and put on', () => {
  const { game } = makeGame();
  const { s, ship } = atSea(game, 'Harness Hal');
  giveCalf(game, s, 'orphan');
  assert.match(companionAction(game, s, 'craft', 'iron')!, /forge/);
  const port = game.world.ports.find((p) => p.shipyardTier >= 2)!;
  ship.docked = port.id;
  assert.match(companionAction(game, s, 'craft', 'iron')!, /^Not enough for the harness/);
  ship.cargo = { iron: HARNESSES.iron.cost.iron, whalebone: HARNESSES.iron.cost.whalebone };
  s.profile!.gold = 10_000;
  assert.equal(companionAction(game, s, 'craft', 'iron'), null);
  assert.equal(s.profile!.companion!.harness, 'iron');
  assert.equal(ship.cargo.iron ?? 0, 0);
  assert.equal(companionAction(game, s, 'wear', 'bell'), 'That harness is not made yet.');
  assert.equal(companionAction(game, s, 'wear', null), null);
  assert.equal(s.profile!.companion!.harness, null);
  assert.equal(companionAction(game, s, 'name', '  Frost  '), null);
  assert.equal(s.profile!.companion!.name, 'Frost');
  assert.equal(companionAction(game, s, 'name', '   '), 'A name of one to twenty letters.');
});

test('the sea sees it: ships near get the calf beside her ship', () => {
  const { game } = makeGame();
  const { s, ship } = atSea(game, 'Shown Sue');
  giveCalf(game, s, 'orphan');
  const { c: c2, ship: ship2 } = atSea(game, 'Watcher Wes');
  ship2.state.x = ship.state.x + 800;
  ship2.state.y = ship.state.y;
  game.now = Math.ceil(game.now / 3) * 3;
  stepCompanions(game);
  const pets = c2.last('pets')!.list;
  assert.ok(pets.some((p) => p.ship === ship.id && p.orca === 1));
});

test('the companion reads in Russian', () => {
  setLang('ru');
  assert.equal(serverText('Snowdrop dives and comes up to the north-east: whales.').replace(/\u00a0/g, ' '), 'Белянка ныряет и выныривает на северо-востоке: там киты.');
  for (const [en, ru] of companionPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
