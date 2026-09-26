import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../shared/src/data/ships.ts';
import { TALENTS } from '../shared/src/data/talents.ts';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import { computeShipStats, loadFactor } from '../shared/src/sim/shipstats.ts';
import { applyDamage, fireBroadside } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { headingVec } from '../shared/src/math.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string, talents: TalentRanks) {
  const c = join(game, name, 'admiral');
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = 60;
  s.profile!.talents = talents;
  s.ship!.talents = talents;
  s.ship!.recompute(game.now);
  s.ship!.hull = s.ship!.stats.hullMax;
  s.profile!.gold = 1e6;
  return { c, s, ship: s.ship!, p: s.profile! };
}

function toSea(game: Game, s: PlayerSession): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

test('shipwright tree data: 24 talents, 37 ranks', () => {
  const list = TALENTS.filter((t) => t.tree === 'shipwright');
  assert.equal(list.length, 24);
  assert.equal(list.filter((t) => !t.keystone).reduce((a, t) => a + t.maxRank, 0), 37);
});

test('stats: Sound Timbers, Trim the Ballast, Perfect Balance, Legendary Keel, Overgunned batteries', () => {
  const lo = { classId: 'brig' as const, name: 'x', guns: { port: 'long_9' as const, starboard: 'long_9' as const }, modules: { hull_plating: 3, sail_plan: 2 } };
  const base = computeShipStats(lo, 'admiral', {});
  const tuned = computeShipStats(lo, 'admiral', { shp_sound_timbers: 3, shp_trim_ballast: 2, shp_master_fitter: 1, shp_perfect_balance: 2 });
  assert.ok(tuned.armor > base.armor, 'armour');
  assert.ok(tuned.maxSpeed > base.maxSpeed, 'ballast trimmed and fittings balanced');
  assert.ok(loadFactor(lo, tuned, {}, { round: 0, chain: 0, grape: 0, incendiary: 0, heavy: 0 }) >= loadFactor(lo, base, {}, { round: 0, chain: 0, grape: 0, incendiary: 0, heavy: 0 }));
  const keel = computeShipStats({ ...lo, keel: true }, 'admiral', {});
  assert.ok(keel.hullMax > base.hullMax && keel.holdVolume > base.holdVolume);
  const og = computeShipStats(lo, 'admiral', { shp_overgunned: 1 });
  assert.equal(og.gunsPerSide, base.gunsPerSide + 2);
  assert.ok(og.maxSpeed < base.maxSpeed);
});

test('yard: Master Fitter goes one past the limit, Masterwork can come out Excellent, Yard Credit and unfitting', () => {
  const { game } = makeGame();
  const { c, ship, p } = captain(game, 'Wright', { shp_master_fitter: 1, shp_masterwork: 2, shp_yard_credit: 2 });
  const port = game.world.ports.find((x) => x.shipyardTier >= 2)!;
  ship.docked = port.id;
  p.docked = port.id;
  const max = MODULES.sail_plan.maxLevel;
  for (let i = 0; i < max + 1; i++) c.push({ t: 'shipyard', action: 'module', module: 'sail_plan' });
  assert.equal(ship.loadout.modules.sail_plan, max + 1, 'one past the limit');
  assert.equal(ship.loadout.overfit, 'sail_plan');
  c.push({ t: 'shipyard', action: 'module', module: 'rudder' });
  c.push({ t: 'shipyard', action: 'module', module: 'rudder' });
  c.push({ t: 'shipyard', action: 'module', module: 'rudder' });
  assert.equal(ship.loadout.modules.rudder, MODULES.rudder.maxLevel, 'only one fitting may be overfitted');
  const g0 = p.gold;
  c.push({ t: 'shipyard', action: 'unfit', module: 'rudder' });
  assert.equal(ship.loadout.modules.rudder, MODULES.rudder.maxLevel - 1);
  assert.ok(p.gold < g0, 'the yard charged for taking it out');
  // Masterwork: many fittings, some Excellent.
  let excellent = false;
  for (let i = 0; i < 40 && !excellent; i++) {
    c.push({ t: 'shipyard', action: 'unfit', module: 'crew_quarters' });
    c.push({ t: 'shipyard', action: 'module', module: 'crew_quarters' });
    excellent = (ship.loadout.excellent ?? []).includes('crew_quarters');
  }
  assert.ok(excellent, 'Excellent work turned up');
});

test('Field Forge crafts shot at sea; Salvager and wreck salvage', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Forge', { shp_field_forge: 1, shp_salvager: 3 });
  toSea(game, s);
  ship.cargo = { iron: 5, gunpowder: 5, timber: 3 };
  const r0 = ship.ammo.round;
  c.push({ t: 'craft', recipe: 'round', n: 10 });
  assert.equal(ship.ammo.round, r0 + 60, 'five batches');
  assert.equal(ship.cargo.iron ?? 0, 0);
  c.push({ t: 'craft', recipe: 'planks', n: 10 });
  assert.equal(ship.cargo.planks, 3);
  // A sunk hull leaves timbers and iron; the salvager takes more.
  const npc = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + 10, ship.state.y, 0);
  npc.cargo = {};
  npc.hull = 0;
  game.beginSinking(npc);
  steps(game, 20 * 8);
  assert.ok((ship.cargo.planks ?? 0) > 3 + 4, `salvage: ${ship.cargo.planks}`);
});

test('armour and structure: Iron Strapping vs heavy shot and rams, Ironbound Masts, Bulkheads', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Iron', { shp_sound_timbers: 2, shp_iron_strapping: 2, shp_ironbound_masts: 1, shp_bulkheads: 2 });
  toSea(game, s);
  ship.leaks = 5;
  steps(game, 25);
  assert.ok(ship.leaks <= 1, 'bulkheads: one compartment at a time');
  ship.sails = ship.stats.sailHpMax * 0.2;
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const gunner = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + v.x * 80, ship.state.y + v.y * 80, ship.state.heading + Math.PI);
  game.npcs.delete(gunner.id);
  game.grid.upsert(gunner.id, gunner.state.x, gunner.state.y);
  gunner.addEffect({ id: 'test', until: 1e9, mods: { mastBreak: 1, spreadMul: -0.95 } }, game.now);
  gunner.ammoSel = 'chain';
  gunner.ammo.chain = 100;
  gunner.reload.port = 0;
  gunner.reload.starboard = 0;
  fireBroadside(game, gunner, 'port', 80);
  fireBroadside(game, gunner, 'starboard', 80);
  steps(game, 30);
  assert.ok(!ship.hasEffect('broken_mast'), 'ironbound');
});

test('Iron Coffin: no broadside takes more than 20%, and nothing mends the hull in combat', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Coffin', { shp_iron_coffin: 1, srv_battle_repair: 1 });
  toSea(game, s);
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const gunner = game.spawnNpcShip('pirate', 'frigate', 'confederacy', ship.state.x + v.x * 60, ship.state.y + v.y * 60, ship.state.heading + Math.PI);
  game.npcs.delete(gunner.id);
  game.grid.upsert(gunner.id, gunner.state.x, gunner.state.y);
  gunner.addEffect({ id: 'test', until: 1e9, mods: { gunDamageMul: 20, spreadMul: -0.95 } }, game.now);
  gunner.ammo.round = 100;
  gunner.reload.port = 0;
  gunner.reload.starboard = 0;
  const h0 = ship.hull;
  fireBroadside(game, gunner, 'port', 60);
  fireBroadside(game, gunner, 'starboard', 60);
  steps(game, 30);
  assert.ok(h0 - ship.hull <= ship.stats.hullMax * 0.2 + 1, `one volley took ${h0 - ship.hull}`);
  ship.cargo.planks = 50;
  c.push({ t: 'repair', on: true });
  applyDamage(game, ship, { hull: 1 }, gunner);
  const h1 = ship.hull;
  steps(game, 20 * 3);
  assert.ok(ship.hull <= h1, 'no repairs under fire in an iron coffin');
});
