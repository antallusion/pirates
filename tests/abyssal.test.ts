import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { TALENTS, canLearn } from '../shared/src/data/talents.ts';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import { cargoVolume, computeShipStats } from '../shared/src/sim/shipstats.ts';
import { abyssDread, abyssCooldownMul, drownedKingRises, stepAbyss, stepAbyssShip } from '../server/src/game/abyssfx.ts';
import { canBoard } from '../server/src/game/boarding.ts';
import { applyDamage, fireBroadside } from '../server/src/game/combat.ts';
import { ammoPrice } from '../server/src/game/ports.ts';
import { sanityDrain, stepMind } from '../server/src/game/mind.ts';
import { canMend } from '../server/src/game/survivalfx.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps, onHull } from './helpers.ts';

function captain(game: Game, name: string, talents: TalentRanks, cap: CaptainId = 'drowned') {
  const c = join(game, name, cap);
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = 60;
  s.profile!.talents = talents;
  s.ship!.talents = talents;
  s.ship!.recompute(game.now);
  s.profile!.gold = 1e6;
  return { c, s, ship: s.ship!, p: s.profile! };
}

function toSea(game: Game, s: PlayerSession, x = 30000, y = 80000): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, x, y);
}

function dummy(game: Game, near: { state: { x: number; y: number } }, dx: number, dy: number, role: 'merchant' | 'pirate' | 'ghost' = 'pirate') {
  const o = game.spawnNpcShip(role, 'brig', role === 'ghost' ? 'free' : 'confederacy', near.state.x + dx, near.state.y + dy, 0);
  game.grid.upsert(o.id, o.state.x, o.state.y);
  return o;
}

test('abyssal tree data and access: 24 talents, 36 ranks; the Drowned from the start, others after the First Descent', () => {
  const list = TALENTS.filter((t) => t.tree === 'abyssal');
  assert.equal(list.length, 24);
  assert.equal(list.filter((t) => !t.keystone).reduce((a, t) => a + t.maxRank, 0), 36);
  assert.equal(canLearn({}, 'abs_whispers_below', 5, { level: 10, abyssOpen: true }), null);
  assert.match(canLearn({}, 'abs_whispers_below', 5, { level: 30, abyssOpen: false })!, /Abyss/);
});

test('cursed shot: sold only in black markets and at the Choir; rots the hull, frightens both crews, and the Crown notices', () => {
  const { game } = makeGame();
  const choir = game.world.ports.find((p) => p.faction === 'choir')!;
  const crown = game.world.ports.find((p) => p.faction === 'crown')!;
  assert.ok(ammoPrice(game, choir, 'cursed') > 0);
  assert.equal(ammoPrice(game, crown, 'cursed'), 0);
  const { s, ship, p } = captain(game, 'Cursed Gunner', { abs_drowned_shot: 2, abs_sea_rot: 2 }, 'corsair');
  toSea(game, s);
  const v = { x: Math.cos(ship.state.heading), y: Math.sin(ship.state.heading) };
  const foe = dummy(game, ship, v.x * 120, v.y * 120);
  game.npcs.delete(foe.id);
  foe.addEffect({ id: 'sitting', until: 1e9, mods: { maxSpeed: -1 } }, game.now);
  ship.ammoSel = 'cursed';
  ship.ammo.cursed = 50;
  ship.reload.starboard = 0;
  const m0 = ship.morale, r0 = p.reputation.crown ?? 0, fm0 = foe.morale;
  const san0 = ship.sanity;
  assert.equal(fireBroadside(game, ship, 'starboard', 120), null);
  assert.equal(ship.morale, m0, 'Drowned Shot: no morale for loading');
  assert.ok((p.reputation.crown ?? 0) < r0, 'the Crown noticed');
  assert.ok(ship.sanity < san0, '+1 Dread for a non-Drowned captain is lost sanity');
  steps(game, 20 * 2);
  assert.ok(foe.hasEffect('rot'), 'rot');
  assert.ok(!canMend(game, foe), 'rotting hulls cannot be mended');
  assert.ok(foe.morale < fm0);
  assert.ok(foe.hasEffect('depth_weight'), 'the weight of the deep');
  assert.ok((foe.seaRot?.stacks ?? 0) >= 1, 'sea rot');
  const h0 = foe.hull;
  stepAbyssShip(game, foe);
  assert.ok(foe.hull < h0, 'sea rot eats the hull');
});

test('Grasp of the Deep and Kraken\'s Embrace: seized, held, and boardable at any speed', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Kraken', { abs_grasp_of_the_deep: 1, abs_krakens_embrace: 1 });
  toSea(game, s);
  const foe = dummy(game, ship, 30, 0, 'merchant');
  foe.hull = foe.stats.hullMax * 0.3;
  foe.state.speed = 8;
  c.push({ t: 'talent_active', id: 'abs_grasp_of_the_deep', x: foe.state.x, y: foe.state.y });
  assert.ok(foe.hasEffect('grasped') && foe.hasEffect('kraken_hold'));
  assert.equal(abyssDread(ship), 8, '+8 Dread');
  foe.state.speed = 8; // she still has way on: the kraken lets you board anyway
  const why = canBoard(game, ship, foe);
  assert.ok(!why || !/Match her speed/.test(why), `boarding blocked: ${why}`);
});

test('Hymn of the Choir, Small Bargain and Black Water', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Choir', { abs_hymn_of_the_choir: 1, abs_small_bargain: 2, abs_black_water: 1 });
  toSea(game, s);
  const foe = dummy(game, ship, 200, 0);
  foe.attackers.set(ship.id, game.now);
  ship.attackers.set(foe.id, game.now);
  foe.morale = 40;
  c.push({ t: 'talent_active', id: 'abs_hymn_of_the_choir' });
  assert.ok(foe.morale <= 25);
  assert.ok(foe.hasEffect('panic'));
  ship.hull = ship.stats.hullMax * 0.5;
  const crew0 = ship.crew;
  c.push({ t: 'talent_active', id: 'abs_small_bargain' });
  assert.ok(ship.crew < crew0);
  assert.ok(ship.hull >= ship.stats.hullMax * 0.61);
  c.push({ t: 'talent_active', id: 'abs_black_water', x: foe.state.x, y: foe.state.y });
  steps(game, 3);
  assert.ok(foe.hasEffect('black_water'));
  assert.ok(!canMend(game, foe));
});

test('Siren\'s Call turns an NPC toward you; Abyss Step: untouchable below, 200 m on', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Siren', { abs_sirens_call: 1, abs_abyss_step: 1 });
  toSea(game, s);
  const foe = dummy(game, ship, 250, 0);
  c.push({ t: 'talent_active', id: 'abs_sirens_call', x: foe.state.x, y: foe.state.y });
  assert.ok(foe.seizedHelm && Math.abs(foe.seizedHelm.x - ship.state.x) < 1);
  const x0 = ship.state.x, y0 = ship.state.y;
  c.push({ t: 'talent_active', id: 'abs_abyss_step' });
  assert.ok(ship.hasEffect('submerged'));
  const h = ship.hull;
  applyDamage(game, ship, { hull: 500 }, foe);
  assert.equal(ship.hull, h, 'nothing touches her below');
  ship.reload.port = 0;
  assert.match(fireBroadside(game, ship, 'port', 200)!, /black water/);
  steps(game, 20 * 3);
  assert.ok(Math.hypot(ship.state.x - x0, ship.state.y - y0) > 150, 'she rises ahead');
});

test('Rising Dead and Hollow Men: the fallen climb back for a while', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Dead', { abs_rising_dead: 2, abs_hollow_men: 1 });
  toSea(game, s);
  const c0 = ship.crew;
  applyDamage(game, ship, { crew: 10 }, null);
  assert.equal(ship.crew, c0 - 10);
  game.now += 11;
  stepAbyssShip(game, ship);
  assert.equal(ship.crew, c0 - 8, 'two of ten rose');
  assert.ok(ship.hasEffect('hollow_men'));
  game.now += 240 + 1;
  stepAbyssShip(game, ship);
  assert.equal(ship.crew, c0 - 10, 'and went back to the sea');
});

test('Offering, Creeping Horror and Voice of the Choir', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Offer', { abs_offering: 2, abs_creeping_horror: 2, abs_voice_of_the_choir: 1 });
  toSea(game, s);
  ship.cargo = { spices: 20 };
  ship.talents.srv_quick_dump = 0;
  c.push({ t: 'jettison', good: 'spices', qty: 20 });
  steps(game, 20 * 6);
  assert.ok(ship.dread >= 10, `offering: ${ship.dread}`);
  assert.ok(ship.hasEffect('offering'));
  assert.ok(abyssCooldownMul(ship) < 1);
  ship.dread = 80;
  assert.ok(abyssCooldownMul(ship) <= 0.7 * 0.9 + 1e-9, 'Voice of the Choir at 75+');
  const foe = dummy(game, ship, 150, 0);
  foe.attackers.set(ship.id, game.now);
  ship.attackers.set(foe.id, game.now);
  const m0 = foe.morale;
  stepAbyss(game, s);
  assert.ok(Math.abs(foe.morale - (m0 - 2 - 0.3)) < 1e-6, 'two morale (rank 2) and a point of Dread'); 
});

test('Pact of Salt and Bone: the monsters bite softer, then let you be', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Pact', { abs_pact_of_salt_and_bone: 2 });
  toSea(game, s);
  onHull(game, ship, 'brig'); // even terms with the brigs she fights (canon D12)
  const ghost = dummy(game, ship, 300, 0, 'ghost');
  const h0 = ship.hull;
  applyDamage(game, ship, { hull: 100 }, ghost);
  assert.ok(Math.abs(h0 - ship.hull - 70) < 0.01);
  ship.dread = 70;
  assert.ok(!game.isHostile(ghost, ship), 'neutral at 60+ Dread');
  ghost.attackers.set(ship.id, game.now);
  assert.ok(game.isHostile(ghost, ship), 'unless you strike them');
});

test('Mark of the Drowned King: she rises where she sank, once an hour', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'King', { abs_mark_of_the_drowned_king: 1 }, 'corsair');
  toSea(game, s);
  ship.cargo = { rum: 10 };
  ship.hull = 0;
  game.beginSinking(ship);
  steps(game, 20 * 7);
  assert.ok(ship.alive, 'she is back');
  assert.ok(!ship.docked, 'not carried to port');
  assert.ok(Math.abs(ship.hull - ship.stats.hullMax * 0.3) < 1);
  assert.ok(ship.hasEffect('submerged'));
  assert.equal(Object.keys(ship.cargo).length, 0, 'the cargo stays on the water');
  assert.ok(!drownedKingRises(game, s), 'once an hour');
});

test('Crew of the Drowned: never below 40%, morale 50, no mutiny, no living sailors from lawful ports', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Drowned Crew', { abs_crew_of_the_drowned: 1 });
  toSea(game, s);
  applyDamage(game, ship, { crew: 999 }, null);
  assert.ok(ship.crew >= Math.ceil(ship.stats.crewMax * 0.4));
  ship.morale = 5;
  stepAbyss(game, s);
  assert.equal(ship.morale, 50);
  p.company.loyalty = 0;
  stepMind(game, ship);
  assert.equal(p.company.mutiny, null);
  const crown = game.world.ports.find((x) => x.faction === 'crown')!;
  ship.docked = crown.id;
  p.docked = crown.id;
  const n0 = ship.crew;
  c.push({ t: 'hire_crew', qty: 1, prof: 'sailor' });
  assert.equal(ship.crew, n0);
});

test('Heart of the Abyss: Dread does not ebb, and at 100 the Spawn rises', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Heart', { abs_heart_of_the_abyss: 1 });
  toSea(game, s);
  ship.dread = 60;
  ship.lastCombat = -999;
  for (let i = 0; i < 10; i++) {
    game.now += 3;
    stepMind(game, ship);
  }
  assert.ok(ship.dread >= 60, 'no ebb');
  ship.dread = 100;
  const n0 = game.ships.size;
  stepAbyss(game, s);
  assert.equal(ship.dread, 0);
  assert.ok(game.ships.size > n0);
  assert.ok([...game.ships.values()].some((x) => x.abyssSpawn));
});

test('Still Waters, Salt Ward and Cursed Cargo', () => {
  const { game } = makeGame();
  const lo = { classId: 'brig' as const, name: 'x', guns: { port: 'long_9' as const, starboard: 'long_9' as const }, modules: {} };
  const st = computeShipStats(lo, 'drowned', { abs_cursed_cargo: 2 });
  assert.ok(cargoVolume({ cursed_relics: 10 }, st.contrabandVolumeMul, 1, 1, st.cursedVolumeMul) < cargoVolume({ cursed_relics: 10 }, st.contrabandVolumeMul));
  const { s, ship } = captain(game, 'Still', { abs_still_waters: 2, abs_salt_ward: 2, abs_cursed_cargo: 2 }, 'corsair');
  const plain = captain(game, 'Loud', {}, 'corsair');
  toSea(game, s);
  toSea(game, plain.s, 40000, 80000);
  ship.cargo = { cursed_relics: 10 };
  plain.ship.cargo = { cursed_relics: 10 };
  assert.ok(sanityDrain(game, ship) < sanityDrain(game, plain.ship), 'the relics do not whisper to them');
  ship.sanity = 48; // afraid for the plain crew, still uneasy with Still Waters 2 (thresholds −10)
  plain.ship.sanity = 48;
  stepMind(game, ship);
  stepMind(game, plain.ship);
  assert.ok(!ship.hasEffect('fear'));
  assert.ok(plain.ship.hasEffect('fear'));
});
