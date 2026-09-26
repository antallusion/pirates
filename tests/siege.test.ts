import { test } from 'node:test';
import assert from 'node:assert/strict';
import { islandSize } from '../shared/src/data/holdings.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { BATTERY_HP, LANDING_SEC, besieging, landingPoint, siegeImpact } from '../server/src/game/siege.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const HOUR = 3_600_000;

function setup() {
  const { game } = makeGame();
  let clock = Date.UTC(2026, 0, 10, 12, 0, 0);
  game.wallNow = () => clock;
  const mk = (n: string) => {
    const c = join(game, n);
    const s = game.sessionByName(n)!;
    s.profile!.gold = 500_000;
    s.profile!.level = 30;
    s.ship!.level = 30;
    return { c, s };
  };
  const A = mk('Anne Wall'), B = mk('Bram Ram');
  const isl = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && islandSize(i.radius) === 'medium')!;
  const port = game.world.ports.find((p) => p.region === 'gravewater')!;
  return { game, A, B, isl, port, set: (t: number) => (clock = t), now: () => clock };
}

function sea(game: Game, s: PlayerSession, x: number, y: number): void {
  const sh = s.ship!;
  sh.docked = null;
  s.profile!.docked = null;
  sh.state.x = x;
  sh.state.y = y;
  sh.state.speed = 0;
  sh.state.sail = 0;
  sh.input = { rudder: 0, sailTarget: 0 };
  sh.region = 'gravewater';
  sh.lastCombat = -1000;
  sh.protectedUntil = 0;
  game.grid.upsert(sh.id, x, y);
}

function dock(game: Game, s: PlayerSession, portId: string): void {
  const p = game.portById(portId)!;
  s.ship!.docked = portId;
  s.profile!.docked = portId;
  s.ship!.state.x = p.x;
  s.ship!.state.y = p.y;
}

/** Anne leases the island and arms it; the shield from the lease is lifted for the test. */
function fortified(game: Game, A: { c: FakeConn; s: PlayerSession }, isl: Island) {
  sea(game, A.s, isl.x + isl.radius + 150, isl.y);
  A.c.push({ t: 'isle', action: 'rent', island: isl.id, days: 30 });
  A.s.ship!.cargo = { planks: 400, iron: 60, weapons: 40 };
  A.c.push({ t: 'isle', action: 'build', island: isl.id, building: 'warehouse' });
  A.c.push({ t: 'isle', action: 'build', island: isl.id, building: 'battery' });
  A.c.push({ t: 'isle', action: 'build', island: isl.id, building: 'battery' });
  const h = game.holdings.get(game, isl.id)!;
  h.shieldUntil = 0;
  return h;
}

test('a siege is declared at the region’s office, never on the Crown’s coast, and waits for the owner’s window', () => {
  const { game, A, B, isl, port, now } = setup();
  const h = fortified(game, A, isl);
  sea(game, B.s, 10, 10);
  B.c.push({ t: 'isle', action: 'siege', island: isl.id });
  assert.match(B.c.last('toast')!.msg, /harbour office/);
  dock(game, B.s, port.id);
  const gold = B.s.profile!.gold;
  B.c.push({ t: 'isle', action: 'siege', island: isl.id });
  assert.ok(h.siege, B.c.last('toast')?.msg);
  assert.equal(B.s.profile!.gold, gold - 10_000);
  assert.equal(h.siege!.phase, 'notice');
  assert.equal(new Date(h.siege!.windowStart).getUTCHours(), h.window);
  assert.ok(h.siege!.windowStart >= now() + 24 * HOUR);
  assert.deepEqual(h.siege!.batteries, [BATTERY_HP, BATTERY_HP]);
  assert.ok(A.c.last('mail')!.letters.some((l) => l.subject.includes('besieged')));
  B.c.push({ t: 'isle', action: 'siege', island: isl.id });
  assert.match(B.c.last('toast')!.msg, /already under siege/);
  // The Crown's coast.
  const safe = game.world.islands.find((i) => !i.portId && i.region === 'black_coast' && islandSize(i.radius) === 'small')!;
  game.holdings.map(game)[safe.id] = { ...h, island: safe.id, siege: undefined };
  B.c.push({ t: 'isle', action: 'siege', island: safe.id });
  assert.match(B.c.last('toast')!.msg, /Crown/);
});

test('bombardment: shot on the island silences the batteries; the lull; the defenders rebuild; the landing and the victor’s choice', () => {
  const { game, A, B, isl, port, set } = setup();
  const h = fortified(game, A, isl);
  dock(game, B.s, port.id);
  B.c.push({ t: 'isle', action: 'siege', island: isl.id });
  const sg = h.siege!;
  sea(game, B.s, isl.x + isl.radius + 600, isl.y);
  // Before the window, shot does nothing.
  siegeImpact(game, isl.x, isl.y, 5000, B.s.ship!.id, false);
  assert.equal(sg.batteries[0], BATTERY_HP);
  set(sg.windowStart + 1000);
  steps(game, 21);
  assert.equal(sg.phase, 'bombard');
  assert.ok(besieging(game, h, B.s.ship!), 'the island’s guns turn on her');
  // Anne's shot does nothing to her own island; Bram's batters it; mortars hit three times as hard.
  siegeImpact(game, isl.x, isl.y, 5000, A.s.ship!.id, false);
  assert.equal(sg.batteries[0], BATTERY_HP);
  siegeImpact(game, isl.x, isl.y, 1000, B.s.ship!.id, true); // a mortar: three thousand
  assert.equal(sg.batteries[0], 0);
  assert.equal(sg.batteries[1], BATTERY_HP);
  siegeImpact(game, isl.x + 20, isl.y, 3000, B.s.ship!.id, false);
  assert.equal(sg.batteries[1], 0);
  steps(game, 21);
  assert.equal(sg.phase, 'fortify');
  assert.ok(sg.windowStart - game.wallNow() >= 18 * HOUR);
  // The defenders rebuild one battery with planks from the store.
  sea(game, A.s, isl.x + isl.radius + 150, isl.y);
  A.s.ship!.cargo = { planks: 60 };
  A.c.push({ t: 'isle', action: 'store', island: isl.id, good: 'planks', qty: 60 });
  A.c.push({ t: 'isle', action: 'fortify', island: isl.id });
  assert.equal(sg.batteries.filter((b) => b === BATTERY_HP).length, 1);
  // The landing: Anne on the beach holds it; when she leaves, Bram's ten minutes run.
  set(sg.windowStart + 1000);
  steps(game, 21);
  assert.equal(sg.phase, 'landing');
  const pt = landingPoint(isl);
  sea(game, B.s, pt.x + 50, pt.y);
  sea(game, A.s, pt.x - 50, pt.y);
  steps(game, 20 * 5);
  assert.equal(sg.capture, 0, 'contested');
  sea(game, A.s, pt.x + 5000, pt.y);
  sg.capture = LANDING_SEC - 3;
  steps(game, 20 * 5);
  assert.equal(sg.phase, 'choose');
  B.c.push({ t: 'isle', action: 'siege_choice', island: isl.id, choice: 'capture' });
  assert.equal(h.owner.id, B.s.accountId);
  assert.ok(h.buildings.every((b) => b.condition <= 0.5));
  assert.ok(h.shieldUntil > game.wallNow() + 70 * HOUR);
  assert.ok(A.c.last('mail')!.letters.some((l) => l.subject.includes('siege is lost')));
});

test('a siege that cannot silence the guns in the window fails, and the island is shielded', () => {
  const { game, A, B, isl, port, set } = setup();
  const h = fortified(game, A, isl);
  dock(game, B.s, port.id);
  B.c.push({ t: 'isle', action: 'siege', island: isl.id });
  const sg = h.siege!;
  set(sg.windowStart + 1000);
  steps(game, 21);
  set(sg.windowEnd + 1000);
  steps(game, 21);
  assert.equal(h.siege, undefined);
  assert.ok(h.shieldUntil > game.wallNow());
  B.c.push({ t: 'isle', action: 'siege', island: isl.id });
  assert.match(B.c.last('toast')!.msg, /shielded/);
});

test('the landing: a fleet over 60 points takes nothing, and a garrison outnumbering the landing party holds', () => {
  const { game, A, B, isl, port, set } = setup();
  const h = fortified(game, A, isl);
  dock(game, B.s, port.id);
  B.c.push({ t: 'isle', action: 'siege', island: isl.id });
  const sg = h.siege!;
  sg.batteries = [0, 0]; // silenced already
  set(sg.windowStart + 1000);
  steps(game, 21);
  assert.equal(sg.phase, 'landing', 'no guns: straight to the landing');
  const pt = landingPoint(isl);
  sea(game, A.s, pt.x + 6000, pt.y); // the owner is away
  sea(game, B.s, pt.x, pt.y);
  // Too many ships: 26 escorts of 5 points at half value put Bram's side over 60.
  const esc: number[] = [];
  for (let i = 0; i < 26; i++) {
    const e = game.spawnNpcShip('escort', 'frigate', 'free', pt.x + 300 + i * 20, pt.y + 800, 0, { ship: `Escort ${i}`, captain: 'Mate' });
    e.ownerId = B.s.ship!.id;
    game.npcs.delete(e.id);
    e.input = { rudder: 0, sailTarget: 0 };
    e.state.sail = 0;
    game.grid.upsert(e.id, e.state.x, e.state.y);
    esc.push(e.id);
  }
  steps(game, 20 * 5);
  assert.equal(sg.capture, 0, 'over the limit');
  for (const id of esc) game.removeShip(id);
  steps(game, 20 * 3);
  assert.ok(sg.capture > 0, 'under the limit');
  // A garrison of 60 against a sloop's crew.
  h.buildings.push({ id: 'barracks', condition: 1, unpaid: false });
  const c = sg.capture;
  steps(game, 20 * 3);
  assert.equal(sg.capture, c, 'the garrison holds the beach');
});
