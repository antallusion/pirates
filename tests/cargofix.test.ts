// A hold a patrol emptied, given back once (forum 134, 2026-11-22): the goods into the hold as far as they go, the rest
// as silver at the base price, the crew's spirit set back, and a letter with the why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARGO_FIXES, applyCargoFix, loggedSeized } from '../server/src/game/cargofix.ts';
import { lettersSince } from '../server/src/game/post.ts';
import { GOODS } from '../shared/src/data/goods.ts';
import type { GoodId } from '../shared/src/data/goods.ts';
import { cargoVolume } from '../shared/src/sim/shipstats.ts';
import { join, makeGame, onHull } from './helpers.ts';

const FIX = { ...CARGO_FIXES[0], since: 1000, until: 5000 };

test('forum 134: the patrol\'s haul goes back into a roomy hold, the spirit up, a letter with the why', () => {
  const { game } = makeGame();
  join(game, 'Eduard Hold');
  const s = game.sessionByName('Eduard Hold')!;
  const ship = s.ship!;
  onHull(game, ship, 'great_xebec', 9);
  ship.cargo = { iron: 50, kraken_ink: 1, shark_skin: 1 };
  ship.morale = 0;
  const r = applyCargoFix(game, s, { ...FIX, account: s.accountId })!;
  assert.ok(r);
  assert.deepEqual(r.hold, FIX.goods, 'a Great Xebec\'s hold takes it all');
  assert.equal(ship.cargo.provisions, 300);
  assert.equal(ship.cargo.rum, 25);
  assert.equal(ship.cargo.iron, 50, 'what he kept stays');
  const st = ship.stats;
  assert.ok(cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul) <= st.holdVolume + 1e-6, 'never past the hold');
  assert.equal(r.silver, FIX.extra, 'all of it fitted: the silver is the cover for the rest');
  assert.equal(ship.morale, 70);
  const letter = lettersSince(game, s.accountId, 0).at(-1)!;
  assert.equal(letter.gold, r.silver);
  assert.match(letter.body, /патруль Короны/);
  assert.match(letter.body, /ром — 25/);
});

test('forum 134: a full hold — what does not fit is paid at its base price; the chronicle\'s larger count grows the return', () => {
  const { game } = makeGame();
  join(game, 'Eduard Full');
  const s = game.sessionByName('Eduard Full')!;
  const ship = s.ship!;
  onHull(game, ship, 'great_xebec', 9);
  ship.cargo = { iron: Math.floor(ship.stats.holdVolume / GOODS.iron.volume) };
  ship.morale = 90;
  // the chronicle: the search took 1214 units (twice the list's 607)
  s.profile!.log = [{ at: 2000, day: 1, tod: 0.5, kind: 'encounter', a: ['patrol_search', 'seized', JSON.stringify({ n: 1214 })] }];
  assert.equal(loggedSeized(s, 1000, 5000), 1214);
  assert.equal(loggedSeized(s, 3000, 5000), 0, 'outside the window');
  const r = applyCargoFix(game, s, { ...FIX, account: s.accountId })!;
  const want = (Object.entries(FIX.goods) as [GoodId, number][]).reduce((a, [g, n]) => a + Math.ceil(n * 2) * GOODS[g].basePrice, 0);
  const inHold = (Object.entries(r.hold) as [GoodId, number][]).reduce((a, [g, n]) => a + n * GOODS[g].basePrice, 0);
  assert.equal(r.silver + inHold, want + FIX.extra, 'every unit back as goods or its base price');
  assert.equal(ship.morale, 90, 'a high spirit is not lowered');
});
