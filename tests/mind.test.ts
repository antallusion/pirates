import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import { onCrit, onGrapple, sanityDrain, stepMind } from '../server/src/game/mind.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string, cap: CaptainId) {
  const c = join(game, name, cap);
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = 30;
  s.profile!.gold = 1e5;
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

function dummy(game: Game, near: { state: { x: number; y: number } }, dx: number, dy: number) {
  const o = game.spawnNpcShip('merchant', 'brig', 'free', near.state.x + dx, near.state.y + dy, 0);
  game.npcs.delete(o.id);
  game.grid.upsert(o.id, o.state.x, o.state.y);
  o.input = { rudder: 0, sailTarget: 0 };
  o.state.speed = 0;
  return o;
}

test('resolve: trading blows charges the Ultimate; it fires only when full and empties it', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Vane', 'corsair');
  toSea(game, s);
  const foe = dummy(game, ship, 300, 0);
  c.push({ t: 'ability', id: 'last_volley' });
  assert.ok(!ship.hasEffect('last_volley'), 'refused at 0 resolve');
  assert.ok(c.all('toast').some((t) => /full resolve/.test(t.msg)));
  // 10% of her hull dealt → +10; 10% of ours taken → +10.
  applyDamage(game, foe, { hull: foe.stats.hullMax * 0.1 }, ship);
  assert.ok(Math.abs(ship.resolve - 10) < 0.01, `dealt: ${ship.resolve}`);
  applyDamage(game, ship, { hull: ship.stats.hullMax * 0.1 }, foe);
  assert.ok(Math.abs(ship.resolve - 20) < 0.01);
  onCrit(ship);
  onGrapple(ship);
  assert.ok(Math.abs(ship.resolve - 43) < 0.01, 'crit +8, grapple +15');
  // Ten enemy crew killed: +5.
  foe.crew = 40;
  applyDamage(game, foe, { crew: 10 }, ship);
  assert.ok(ship.resolve >= 48 - 0.01);
  ship.resolve = 100;
  c.push({ t: 'ability', id: 'last_volley' });
  assert.ok(ship.hasEffect('last_volley'));
  assert.equal(ship.resolve, 0);
  // Out of combat for 30 s it drains 2/s.
  ship.resolve = 50;
  ship.lastCombat = game.now - 31;
  stepMind(game, ship);
  assert.equal(ship.resolve, 48);
});

test('dread: the Drowned Captain bleeds into it, pays miracles with it, and the crew pays for the miracles', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Harrow', 'drowned');
  toSea(game, s);
  const foe = dummy(game, ship, 200, 0);
  c.push({ t: 'ability', id: 'deep_call', x: foe.state.x, y: foe.state.y });
  assert.equal(game.zones.length, 0, 'no Dread, no miracle');
  // 20% hull lost → +10 Dread.
  applyDamage(game, ship, { hull: ship.stats.hullMax * 0.2 }, foe);
  assert.ok(Math.abs(ship.dread - 10) < 0.01, `dread ${ship.dread}`);
  ship.dread = 60;
  const m0 = ship.morale;
  c.push({ t: 'ability', id: 'deep_call', x: foe.state.x, y: foe.state.y });
  assert.equal(game.zones.length, 1);
  assert.equal(ship.dread, 30);
  assert.ok(Math.abs(m0 - ship.morale - 3) < 0.01, '30 Dread spent = −3 morale');
  // After a second the hands rise: slowed and holed once.
  const l0 = foe.leaks;
  steps(game, 20 * 2);
  assert.equal(foe.leaks, l0 + 1);
  assert.ok(foe.hasEffect('drowned_hands'));
  steps(game, 20 * 2);
  assert.equal(foe.leaks, l0 + 1, 'holed only once');
  steps(game, 20 * 5);
  assert.ok(!foe.hasEffect('drowned_hands'), 'the hands sink back');
  // Non-drowned captains never gain Dread.
  const other = captain(game, 'Quill', 'smuggler');
  toSea(game, other.s, 40000, 80000);
  applyDamage(game, other.ship, { hull: 100 }, null);
  assert.equal(other.ship.dread, 0);
});

test('Undertow drags a ship with no way on; the Maw takes a fifth of her hull, a mast and two leaks', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Undertow', 'drowned');
  toSea(game, s);
  ship.dread = 100;
  const foe = dummy(game, ship, 0, -200); // due north, in the race
  const y0 = foe.state.y;
  c.push({ t: 'ability', id: 'undertow', x: ship.state.x, y: ship.state.y - 400 });
  assert.equal(game.zones[0].kind, 'undertow');
  steps(game, 20 * 3);
  assert.ok(foe.state.y < y0 - 4, `dragged north: ${y0 - foe.state.y} m`);
  // The Maw.
  ship.dread = 60; // below the Call
  ship.resolve = 100;
  const big = dummy(game, ship, 250, 0);
  const h0 = big.hull;
  c.push({ t: 'ability', id: 'maw_of_the_deep', x: big.state.x, y: big.state.y });
  assert.equal(ship.resolve, 0);
  assert.equal(ship.dread, 10);
  steps(game, 20 * 4);
  assert.ok(Math.abs(h0 - big.hull - big.stats.hullMax * 0.2) < big.stats.hullMax * 0.02, `maw took ${h0 - big.hull}`);
  assert.ok(big.hasEffect('broken_mast'));
  assert.ok(big.leaks >= 2);
});

test('the Call at 80 Dread makes miracles stronger and costs the crew', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Caller', 'drowned');
  toSea(game, s);
  ship.dread = 95;
  const foe = dummy(game, ship, 200, 0);
  c.push({ t: 'ability', id: 'deep_call', x: foe.state.x, y: foe.state.y });
  assert.ok(Math.abs(game.zones[0].power - 1.2) < 1e-9);
  const m0 = ship.morale;
  ship.lastCombat = game.now; // keeps Dread from ebbing
  ship.dread = 90;
  ship.talentReady.callMorale = 0;
  stepMind(game, ship);
  assert.ok(ship.morale < m0);
});

test('a miracle before Crown eyes in Crown waters costs standing', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Witch', 'drowned');
  const crownPort = game.world.ports.find((x) => x.faction === 'crown' && REGIONS[x.region].safety !== 'lawless')!;
  toSea(game, s, crownPort.x + 800, crownPort.y + 800);
  ship.dread = 40;
  const r0 = p.reputation.crown ?? 0;
  c.push({ t: 'ability', id: 'brine_mend' });
  assert.ok((p.reputation.crown ?? 0) <= r0 - 15 + 0.01, `crown rep ${r0} → ${p.reputation.crown}`);
});

test('Drowned Once: twelve seconds between water and light — mend her to 10% or she sinks', () => {
  const { game } = makeGame();
  const a = captain(game, 'Lived', 'drowned');
  toSea(game, a.s);
  applyDamage(game, a.ship, { hull: a.ship.hull + 50 }, null);
  assert.equal(a.ship.hull, 1);
  assert.ok(a.ship.hasEffect('between_worlds'));
  assert.ok(a.ship.stats.incomingDamageMul < 1);
  a.ship.hull = a.ship.stats.hullMax * 0.15;
  steps(game, 20 * 13);
  assert.ok(a.ship.alive && !a.ship.sinkingUntil, 'mended: she lives');
  assert.ok(!a.ship.hasEffect('between_worlds'));
  const b = captain(game, 'Drowned Again', 'drowned');
  toSea(game, b.s, 50000, 80000);
  applyDamage(game, b.ship, { hull: b.ship.hull + 50 }, null);
  steps(game, 20 * 13);
  assert.ok(b.ship.sinkingUntil > 0 || !b.ship.alive, 'not mended: the sea keeps her');
});

test('sanity: the deep drains it, cursed cargo and black storms worse; rum, dreamleaf and port restore it', () => {
  const { game } = makeGame();
  const { s, ship, p } = captain(game, 'Nerves', 'navigator');
  toSea(game, s);
  assert.equal(sanityDrain(game, ship) * 600 <= 1.01, true, 'safe waters barely touch it');
  const abyss = REGIONS.the_abyss.center;
  toSea(game, s, abyss[0], abyss[1]);
  steps(game, 1);
  const deep = sanityDrain(game, ship);
  assert.ok(deep * 600 >= 5, `abyss drain per 10 min: ${deep * 600}`);
  ship.cargo.cursed_relics = 20;
  assert.ok(sanityDrain(game, ship) > deep, 'cursed relics whisper');
  delete ship.cargo.cursed_relics;
  // A tot of rum when nerves fray.
  ship.sanity = 60;
  ship.cargo.rum = 3;
  stepMind(game, ship);
  assert.ok(ship.sanity > 65 && ship.cargo.rum === 2);
  ship.sanity = 55;
  stepMind(game, ship);
  assert.equal(ship.cargo.rum, 2, 'one tot per 20 minutes');
  ship.cargo.dreamleaf = 2;
  stepMind(game, ship);
  assert.equal(ship.cargo.dreamleaf, 1);
  // Fear: shaky hands.
  ship.sanity = 40;
  stepMind(game, ship);
  assert.ok(ship.hasEffect('fear'));
  // Port restores.
  ship.docked = game.world.ports[0].id;
  const v = ship.sanity;
  for (let i = 0; i < 600; i++) stepMind(game, ship);
  assert.ok(ship.sanity - v >= 30, `ten minutes in port: +${ship.sanity - v}`);
  // It persists with the captain.
  ship.sanity = 42.5;
  game.saveSession(s);
  assert.equal(p.sanity, 42.5);
});

test('terror sends men over the side; madness seizes the helm', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Mad', 'corsair');
  toSea(game, s);
  ship.sanity = 20;
  ship.talentReady.overboard = game.now - 1;
  const c0 = ship.crew;
  stepMind(game, ship);
  assert.equal(ship.crew, c0 - 1);
  ship.sanity = 5;
  let seized = false;
  for (let i = 0; i < 40 && !seized; i++) {
    ship.talentReady.madness = 0;
    stepMind(game, ship);
    seized = ship.seizedHelm !== null;
  }
  assert.ok(seized, 'the crew took the wheel');
  const h = ship.seizedHelm!;
  ship.state.speed = 5;
  ship.input = { rudder: -1, sailTarget: 0.5 };
  const d0 = Math.hypot(h.x - ship.state.x, h.y - ship.state.y);
  steps(game, 20 * 8);
  const d1 = Math.hypot(h.x - ship.state.x, h.y - ship.state.y);
  assert.ok(d1 < d0, 'she sails for the call whatever the captain orders');
});
