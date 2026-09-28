// Dynamic combat (docs/11 P2): the held broadside and its perfect window, the dash and its moment of evasion.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec } from '../shared/src/math.ts';
import { AIM_CHARGE, AIM_PERFECT, AIM_PERFECT_DAMAGE, AIM_PERFECT_SPREAD, AIM_WAVER, DASH_COOLDOWN, aimFocus } from '../shared/src/data/gunnery.ts';
import type { GameEvent } from '../shared/src/protocol.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

function atSea(game: Game, name: string): { c: FakeConn; ship: ShipEntity } {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 4;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0.5 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, ship };
}

/** A merchant off the starboard beam at `d` metres. */
function target(game: Game, ship: ShipEntity, d: number): ShipEntity {
  const v = headingVec(ship.state.heading + Math.PI / 2);
  const npc = game.spawnNpcShip('merchant', 'fluyt', 'league', ship.state.x + v.x * d, ship.state.y + v.y * d, ship.state.heading);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

function events(game: Game): GameEvent[] {
  const list: GameEvent[] = [];
  const emit = game.emit.bind(game);
  game.emit = (e: GameEvent, x: number, y: number) => {
    list.push(e);
    emit(e, x, y);
  };
  return list;
}

test('the held broadside: a tap fires as before, the window tightens and strengthens it, holding on too long jitters', () => {
  assert.deepEqual(aimFocus(0.1), { spread: 1, damage: 1, perfect: false });
  const mid = aimFocus(((AIM_PERFECT[0] + AIM_PERFECT[1]) / 2) * AIM_CHARGE);
  assert.deepEqual(mid, { spread: AIM_PERFECT_SPREAD, damage: AIM_PERFECT_DAMAGE, perfect: true });
  assert.ok(aimFocus(0.5 * AIM_CHARGE).spread < 1 && !aimFocus(0.5 * AIM_CHARGE).perfect, 'half held: a little tighter');
  assert.ok(aimFocus((AIM_WAVER + 0.2) * AIM_CHARGE).spread > 1, 'held too long');
});

test('a broadside held into its window flies as a perfect volley; one fired at once does not', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Gunner');
  target(game, ship, 160);
  const evs = events(game);
  c.push({ t: 'aim', side: 'starboard' });
  steps(game, Math.round(20 * AIM_CHARGE * 0.82));
  c.push({ t: 'fire', side: 'starboard', dist: 160 });
  const v1 = evs.find((e) => e.k === 'volley');
  assert.ok(v1 && v1.k === 'volley' && v1.perfect, 'perfect');
  // Reload, then fire without holding.
  ship.reload.starboard = 0;
  evs.length = 0;
  c.push({ t: 'fire', side: 'starboard', dist: 160 });
  const v2 = evs.find((e) => e.k === 'volley');
  assert.ok(v2 && v2.k === 'volley' && !v2.perfect, 'a plain shot');
});

test('the charge counts from when the guns are loaded, not from the press', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Eager');
  target(game, ship, 160);
  ship.reload.starboard = 2; // two seconds still to load
  c.push({ t: 'aim', side: 'starboard' });
  assert.ok(Math.abs(ship.aimStart.starboard - (game.now + 2)) < 0.01);
});

test('the dash: a burst of speed and a moment of evasion, then the braces need hauling again', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Dasher');
  const v0 = ship.state.speed;
  c.push({ t: 'dash' });
  assert.ok(ship.state.speed > v0 + 2, 'a burst of speed');
  assert.ok(ship.hasFlag('evasive'), 'evasive');
  assert.ok(ship.hasEffect('dash'));
  const self = c.last('self')?.self;
  assert.ok(self && self.dashReadyAt > game.now + DASH_COOLDOWN - 1, 'the client knows when it is ready');
  c.push({ t: 'dash' });
  assert.ok(c.all('toast').some((t) => /braces/.test(t.msg)), 'on cooldown');
  steps(game, 20 * 2);
  assert.ok(!ship.hasFlag('evasive'), 'the moment passed');
});

test('a ship in the moment of her dash: about half the balls fly wide', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Marksman');
  const npc = target(game, ship, 120);
  const evs = events(game);
  let evaded = 0, landed = 0;
  for (let i = 0; i < 12; i++) {
    npc.addEffect({ id: 'evasive', until: game.now + 30, flags: ['evasive'] }, game.now);
    npc.hull = npc.stats.hullMax;
    // She would run from the guns: back on the beam, stopped, for every volley.
    const beam = headingVec(ship.state.heading + Math.PI / 2);
    npc.state.x = ship.state.x + beam.x * 120;
    npc.state.y = ship.state.y + beam.y * 120;
    npc.state.speed = 0;
    npc.state.heading = ship.state.heading;
    game.grid.upsert(npc.id, npc.state.x, npc.state.y);
    ship.reload.starboard = 0;
    evs.length = 0;
    c.push({ t: 'fire', side: 'starboard', dist: 120 });
    steps(game, 20 * 2);
    for (const e of evs) if (e.k === 'hit' && e.ship === npc.id) e.evaded ? evaded++ : e.dmg > 0 && landed++;
  }
  const share = evaded / Math.max(1, evaded + landed);
  assert.ok(evaded + landed > 20, `enough balls reached her (${evaded + landed})`);
  assert.ok(share > 0.3 && share < 0.7, `evaded ${(share * 100).toFixed(0)}%`);
});
