import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WOODS } from '../shared/src/data/shipbuild.ts';
import type { ShipBuild } from '../shared/src/data/shipbuild.ts';
import { computeShipStats } from '../shared/src/sim/shipstats.ts';
import type { ShipLoadout } from '../shared/src/sim/shipstats.ts';
import { quoteBuild, stepBuiltShip, woodAvailable } from '../server/src/game/shipbuilding.ts';
import type { BuildRequest } from '../server/src/game/shipbuilding.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, knowHulls } from './helpers.ts';

const base = (build?: ShipBuild): ShipLoadout => ({ classId: 'brig', name: 'x', guns: { port: 'long_9', starboard: 'long_9' }, modules: {}, build });
const b = (over: Partial<ShipBuild> = {}): ShipBuild => ({ frame: 'oak', plank: 'oak', rares: [], quality: 'common', variants: [], builder: 'gravesend', ...over });

function captain(game: Game, name: string) {
  const c = join(game, name, 'corsair');
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = 40;
  s.profile!.gold = 1e6;
  return { c, s, ship: s.ship!, p: s.profile! };
}

function dock(s: PlayerSession, game: Game, id: string) {
  s.ship!.docked = id;
  s.profile!.docked = id;
  return game.portById(id)!;
}

test('timber, rare materials, figureheads and plan lines shape the hull', () => {
  const plain = computeShipStats(base(), 'corsair', {});
  const oak = computeShipStats(base(b()), 'corsair', {});
  assert.equal(oak.hullMax, plain.hullMax, 'oak is the measure');
  const pine = computeShipStats(base(b({ frame: 'pine', plank: 'pine' })), 'corsair', {});
  assert.ok(pine.hullMax < plain.hullMax && pine.maxSpeed > plain.maxSpeed && pine.armor < plain.armor);
  const iron = computeShipStats(base(b({ frame: 'ironwood', plank: 'ironwood' })), 'corsair', {});
  assert.ok(iron.armor > plain.armor * 1.3 && iron.maxSpeed < plain.maxSpeed);
  const bone = computeShipStats(base(b({ rares: [{ slot: 'keel', good: 'leviathan_bone' }, { slot: 'paint', good: 'kraken_ink' }] })), 'corsair', {});
  assert.ok(Math.abs(bone.hullMax / plain.hullMax - 1.15) < 0.01);
  assert.ok((bone.x.signature ?? 0) < 0);
  const fh = computeShipStats(base(b({ figurehead: 'fh_red_devil' })), 'corsair', {});
  assert.ok(fh.boardingPower > plain.boardingPower);
  const lines = computeShipStats(base(b({ quality: 'good', variants: ['roomy_hold'] })), 'corsair', {});
  assert.ok(lines.holdVolume > plain.holdVolume && lines.maxSpeed < plain.maxSpeed, 'every line is a side-grade');
  const exc = computeShipStats(base(b({ excellent: true })), 'corsair', {});
  assert.ok(exc.hullMax > plain.hullMax && exc.maxSpeed > plain.maxSpeed);
});

test('timber grows where it grows', () => {
  const { game } = makeGame();
  assert.ok(woodAvailable(game.portById('cinderhold')!, 'ironwood'));
  assert.ok(!woodAvailable(game.portById('gravesend')!, 'ironwood'));
  assert.ok(woodAvailable(game.portById('saint_maw')!, 'cursed_wood'));
  assert.ok(woodAvailable(game.portById('saltmarrow')!, 'pine'));
  assert.equal(Object.keys(WOODS).length, 6);
});

test('lay down a keel, wait for the yard, launch her; the old ship waits in her berth', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Builder');
  knowHulls(p); // the brig researched (docs/20)
  const port = dock(s, game, 'gravesend');
  const req: BuildRequest = { classId: 'brig', name: 'Iron Verdict II', frame: 'oak', plank: 'oak', rares: {}, master: true };
  assert.match(quoteBuild(game, s, port, req).error!, /Needs/);
  ship.cargo = { timber: 80, planks: 40, sailcloth: 30, iron: 20 };
  const q = quoteBuild(game, s, port, req);
  assert.equal(q.error, null);
  c.push({ t: 'build', req });
  assert.equal(p.builds.length, 1);
  assert.ok((ship.cargo.timber ?? 0) < 80, 'materials taken');
  const order = p.builds[0];
  c.push({ t: 'build_launch', id: order.id });
  assert.equal(p.builds.length, 1, 'not before she is finished');
  game.now = order.done + 1;
  const oldClass = ship.loadout.classId;
  c.push({ t: 'build_launch', id: order.id });
  assert.equal(p.builds.length, 0);
  assert.equal(ship.loadout.classId, 'brig');
  assert.equal(ship.loadout.name, 'Iron Verdict II');
  assert.equal(p.berths.length, 1);
  assert.equal(p.berths[0].loadout.classId, oldClass);
  c.push({ t: 'berth', action: 'swap', index: 0 });
  assert.equal(ship.loadout.classId, oldClass);
  assert.equal(p.berths[0].loadout.classId, 'brig');
  const g0 = p.gold;
  c.push({ t: 'berth', action: 'sell', index: 0 });
  assert.equal(p.berths.length, 0);
  assert.ok(p.gold > g0);
});

test('plans: a respected captain buys a good plan; its lines ride into the build and it wears out', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Planner');
  dock(s, game, 'gravesend');
  c.push({ t: 'plan_buy', classId: 'sloop' });
  assert.equal(p.plans.length, 0, 'the yard shows its plans to friends only');
  p.reputation.crown = 40;
  c.push({ t: 'plan_buy', classId: 'sloop' });
  assert.equal(p.plans.length, 1);
  const plan = p.plans[0];
  assert.equal(plan.variants.length, 1);
  ship.cargo = { timber: 40, planks: 20, sailcloth: 20, iron: 10 };
  c.push({ t: 'build', req: { classId: 'sloop', name: 'Lined', frame: 'pine', plank: 'pine', rares: {}, planId: plan.id } });
  assert.equal(p.builds[0].build.quality, 'good');
  assert.deepEqual(p.builds[0].build.variants, plan.variants);
  assert.equal(p.plans[0].uses, 9);
});

test('an Excellent ship earns the Masterwork deed', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Master');
  const port = dock(s, game, 'gravesend');
  ship.cargo = { timber: 40, planks: 20, sailcloth: 20, iron: 10 };
  c.push({ t: 'build', req: { classId: 'sloop', name: 'Masterpiece', frame: 'oak', plank: 'oak', rares: {} } });
  p.builds[0].build.excellent = true;
  game.now = p.builds[0].done + 1;
  c.push({ t: 'build_launch', id: p.builds[0].id });
  assert.ok(p.deeds.includes('deed_masterwork_ship'));
  void port;
});

test('living materials: cursed wood heals in the dark, drowned silk mends itself; the Saint of Wrecks holds her up', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Cursed');
  ship.loadout = { ...ship.loadout, build: b({ frame: 'cursed_wood', plank: 'cursed_wood', rares: [{ slot: 'sails', good: 'drowned_silk' }], figurehead: 'fh_saint_of_wrecks' }) };
  ship.recompute(game.now);
  ship.docked = null;
  s.profile!.docked = null;
  assert.ok(ship.hasFlag('cursed_wood') && ship.hasFlag('drowned_silk'));
  // Midnight: the planks close.
  game.now = 0;
  ship.hull = ship.stats.hullMax * 0.5;
  ship.sails = ship.stats.sailHpMax * 0.5;
  const h0 = ship.hull, s0 = ship.sails;
  for (let i = 0; i < 60; i++) stepBuiltShip(game, s);
  assert.ok(ship.sails > s0, 'the silk mends');
  assert.ok(ship.hull >= h0, 'the wood heals or holds');
  ship.hull = 0;
  game.beginSinking(ship);
  assert.equal(ship.sinkingUntil - game.now, 11, 'five more seconds afloat');
});
