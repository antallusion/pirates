// Owner, 2026-11-23: ships of ⚓9 and ⚓10 under the Admiralty's warrants — at least 400 hours of play in command of
// ⚓8 to the first, 600 more in command of ⚓9 to the admiral's, a fortune in silver and rare goods; the ships held on
// the day kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WARRANTS, WARRANT_XP_HOUR } from '../shared/src/data/warrant.ts';
import { THRONE_LEVEL } from '../shared/src/constants.ts';
import { addXp } from '../server/src/game/player.ts';
import { refitView } from '../server/src/game/refit.ts';
import { shipyardBuy } from '../server/src/game/ports.ts';
import { warrantHandIn, warrantSeen, warrantWhy } from '../server/src/game/warrant.ts';
import { CURRENT, mixedHour } from './balance/xp.ts';
import { seaHour } from './balance/island.ts';
import { join, makeGame } from './helpers.ts';

test('warrants: 400 and 600 hours of mixed play at the fastest pace there is, and a fortune', () => {
  const fastest = Math.max(...[41, 49, 56, THRONE_LEVEL, 70, 80].map((L) => mixedHour(CURRENT, L).xp));
  assert.ok(fastest <= WARRANT_XP_HOUR, `the reference hour (${WARRANT_XP_HOUR}) is the fastest (${fastest})`);
  assert.ok(WARRANTS[9].xp / fastest >= 400);
  assert.ok(WARRANTS[10].xp / fastest >= 600);
  assert.ok(WARRANTS[9].silver >= 150 * seaHour(8), 'the first rate: some 200 hours of a ⚓8 captain’s income');
  assert.ok(WARRANTS[10].silver >= 300 * seaHour(9), 'the admiral’s: some 380 hours of a ⚓9 captain’s income');
  assert.ok(WARRANTS[10].hearts > WARRANTS[9].hearts);
});

test('warrants: no ⚓9 bought or refitted without one; experience counts on ⚓8 only; granted when all is in', () => {
  const { game } = makeGame();
  join(game, 'Warrant Seeker');
  const s = game.sessionByName('Warrant Seeker')!;
  const p = s.profile!;
  warrantSeen(p);
  assert.equal(p.warrant!.has, 0);
  p.level = 60;
  const great = game.world.ports.find((x) => x.shipyardTier >= 4)!;
  s.ship!.docked = great.id;
  // a hull of ⚓9 bought new: refused for the warrant
  const why = shipyardBuy(game, s, great, 'man_o_war');
  assert.match(why ?? '', /Warrant of the First Rate|research|build/);
  assert.match(warrantWhy(p, 9) ?? '', /Warrant of the First Rate/);
  assert.equal(warrantWhy(p, 8), null);
  // a galleon at ⚓8: the refit to ⚓9 refused for the warrant
  p.loadout = { ...p.loadout, classId: 'galleon', level: 8 };
  s.ship!.loadout = p.loadout;
  assert.match(refitView(game, s, great).blocked ?? '', /Warrant of the First Rate/);
  // experience on ⚓8 counts; on ⚓7 it does not
  addXp(p, 1000);
  assert.equal(p.warrant!.xp[9], 1000);
  p.loadout = { ...p.loadout, level: 7 };
  addXp(p, 1000);
  assert.equal(p.warrant!.xp[9], 1000);
  assert.equal(p.warrant!.xp[10], undefined, 'the admiral’s after the first rate’s');
  // everything handed in (a part at a time), the experience earned: granted
  p.warrant!.xp[9] = WARRANTS[9].xp;
  p.gold = WARRANTS[9].silver / 2;
  assert.equal(warrantHandIn(game, s, great), null);
  assert.equal(p.gold, 0);
  assert.equal(p.warrant!.has, 0, 'not yet: half the silver');
  p.gold = WARRANTS[9].silver;
  for (const [g, n] of Object.entries(WARRANTS[9].goods)) s.ship!.cargo[g as 'iron'] = n;
  p.stormHearts = 5;
  assert.equal(warrantHandIn(game, s, great), null);
  assert.equal(p.warrant!.has, 9);
  assert.equal(p.gold, WARRANTS[9].silver / 2, 'only what was still asked');
  assert.equal(p.stormHearts, 5 - WARRANTS[9].hearts);
  assert.equal(warrantWhy(p, 9), null);
  assert.match(warrantWhy(p, 10) ?? '', /Admiral/);
  // a port without an office takes nothing
  const small = game.world.ports.find((x) => x.shipyardTier < 4)!;
  assert.match(warrantHandIn(game, s, small) ?? '', /great shipyards/);
});

test('warrants: the ships held on the day are kept — a ⚓10 in a berth gives the admiral’s', () => {
  const { game } = makeGame();
  join(game, 'Old Admiral');
  const p = game.sessionByName('Old Admiral')!.profile!;
  p.berths.push({ port: game.world.ports[0].id, loadout: { classId: 'man_o_war', name: 'Old Thunder', guns: { port: 'light_6', starboard: 'light_6' }, modules: {}, level: 10 }, hull: 1 });
  delete p.warrant;
  warrantSeen(p);
  assert.equal(p.warrant!.has, 10);
  p.warrant!.has = 0;
  warrantSeen(p);
  assert.equal(p.warrant!.has, 0, 'once only');
});
