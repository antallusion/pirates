import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TALENTS } from '../shared/src/data/talents.ts';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import { weariness } from '../server/src/game/survivalfx.ts';
import { join, makeGame, steps } from './helpers.ts';

function atSea(game: Game, name: string, talents: TalentRanks) {
  const c = join(game, name, 'reaver');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  s.profile!.level = 60;
  s.profile!.talents = talents;
  ship.talents = talents;
  ship.recompute(game.now);
  ship.hull = ship.stats.hullMax;
  ship.crew = ship.stats.crewMax;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s, ship, p: s.profile! };
}

test('survival tree data: 24 talents, 39 ranks', () => {
  const list = TALENTS.filter((t) => t.tree === 'survival');
  assert.equal(list.length, 24);
  assert.equal(list.filter((t) => !t.keystone).reduce((a, t) => a + t.maxRank, 0), 39);
});

test('hits: Double Planking soaks, Grim Endurance hardens, Hardened Crew and the Surgeon save men', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Tough', { srv_iron_hull: 2, srv_double_planking: 2, srv_grim_endurance: 2, srv_hardened_crew: 2, srv_ships_surgeon: 2 });
  steps(game, 25); // buffer fills out of combat
  const h0 = ship.hull;
  applyDamage(game, ship, { hull: ship.stats.hullMax * 0.05 }, null);
  assert.ok(Math.abs(h0 - ship.hull) < 1e-6, 'the planking (6%) soaked a 5% blow');
  ship.planking = 0;
  ship.hull = ship.stats.hullMax * 0.3;
  const h1 = ship.hull;
  applyDamage(game, ship, { hull: 100 }, null);
  assert.ok(Math.abs(h1 - ship.hull - 88) < 1e-6, `grim: ${h1 - ship.hull}`);
  const crew0 = ship.crew;
  for (let i = 0; i < 20; i++) applyDamage(game, ship, { crew: 2 }, null);
  const lost = crew0 - ship.crew;
  assert.ok(lost < 40, `hardened crew: lost ${lost}`);
  assert.ok(ship.wounded > 0, 'some are only wounded');
  game.now += 130;
  steps(game, 25);
  assert.ok(ship.crew > crew0 - lost, 'the wounded come back');
});

test('actives: Brace stops the reload and halves the blow; Plug the Breach stops every leak', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Bracer', { srv_brace: 1, srv_plug_the_breach: 1 });
  ship.reload.port = 5;
  c.push({ t: 'talent_active', id: 'srv_brace' });
  const h0 = ship.hull;
  applyDamage(game, ship, { hull: 100 }, null);
  assert.ok(Math.abs(h0 - ship.hull - 70) < 1e-6);
  steps(game, 20);
  assert.equal(ship.reload.port, 5, 'guns stopped loading');
  ship.leaks = 4;
  ship.hull = ship.stats.hullMax * 0.5;
  c.push({ t: 'talent_active', id: 'srv_plug_the_breach' });
  assert.equal(ship.leaks, 0);
  assert.ok(ship.hull > ship.stats.hullMax * 0.57);
});

test('the long voyage: weariness after an hour (Long Voyage delays it), scurvy (Lime and Salt prevents it)', () => {
  const { game } = makeGame();
  const { ship } = atSea(game, 'Sailor', {});
  const { ship: salt } = atSea(game, 'Salty', { srv_long_voyage: 2, srv_lime_and_salt: 1 });
  ship.voyageStart = game.now - 4000;
  salt.voyageStart = game.now - 4000;
  assert.ok(weariness(game, ship) > 0);
  assert.equal(weariness(game, salt), 0);
  const c0 = ship.crew, s0 = salt.crew;
  for (let i = 0; i < 40; i++) {
    game.now += 300;
    steps(game, 21);
  }
  assert.ok(ship.crew < c0, 'scurvy took hands');
  assert.ok(salt.crew >= s0 - 1, 'lime and salt');
});

test('Old Salt repairs without planks; Patchwork Hull heals under fire', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Salt', { srv_old_salt: 1 });
  ship.cargo = {};
  ship.hull = ship.stats.hullMax * 0.5;
  c.push({ t: 'repair', on: true });
  steps(game, 20 * 5);
  assert.ok(ship.hull > ship.stats.hullMax * 0.51, 'repairing without planks');
  const { ship: pw } = atSea(game, 'Patch', { srv_patchwork_hull: 1 });
  pw.hull = pw.stats.hullMax * 0.5;
  pw.lastCombat = game.now;
  steps(game, 20 * 4);
  assert.ok(pw.hull > pw.stats.hullMax * 0.5, 'self-patching');
});

test('Scuttle Charges: nobody gets the hold, and ships alongside pay; Lifeboats save cargo', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Scuttler', { srv_scuttle_charges: 1 });
  const npc = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + 30, ship.state.y, 0);
  game.npcs.delete(npc.id);
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  const h = npc.hull;
  ship.cargo = { rum: 20 };
  c.push({ t: 'scuttle' });
  steps(game, 20 * 4);
  assert.ok(ship.sinkingUntil > 0 || ship.docked !== null, 'she went down');
  assert.ok(npc.hull < h, 'the blast reached her');
  const { s: s2, ship: boat } = atSea(game, 'Boats', { srv_lifeboats: 2 });
  boat.cargo = { rum: 50, dreamleaf: 10 };
  (game as unknown as { playerDeath(s: typeof s2, sh: typeof boat): void }).playerDeath(s2, boat);
  assert.equal(boat.cargo.rum, 20, '40% of the legal cargo saved');
  assert.equal(boat.cargo.dreamleaf ?? 0, 0);
});
