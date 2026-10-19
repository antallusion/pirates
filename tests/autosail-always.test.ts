// Auto-sail always and everywhere (owner, 2026-10-19: «Автоплавание перестало работать или оно перестает работать когда
// кончается парусина. Надо чтобы работало всегда и везде»). The helmsman takes her to her mark whatever her state and
// the sea's: no sailcloth and the canvas in rags (she sails slower — torn canvas draws a quarter — and he sails on, where
// the «stuck» check gave the wheel back), no provisions, a low hull, a short crew, a storm (reefed to three quarters),
// fog, night, in a group, after a fight (taken up again once the sea is quiet), a course given in port (taken up the
// moment she casts off); and the phone's helm beat already on its way with her old sail does not take the wheel back.
// Only a fight under way breaks a course off — never the sea's own harm (a reef grinding the keel is no «attack»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICK_RATE, isNight } from '../shared/src/constants.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { AUTOSAIL_ROUND, RESUME_CALM, autosailDanger, autosailOf, pausedCourse, queuedCourse, runFree } from '../server/src/game/autosail.ts';
import { openAt, quietAround, sceneWind, seaCaptainAt } from '../tools/nav/harness.ts';
import type { FakeConn } from './helpers.ts';
import { makeGame } from './helpers.ts';

/** A straight run of open water `d` metres long (the same sea for every condition). */
function stretch(game: Game, ship: ShipEntity, d: number): { a: [number, number]; b: [number, number] } {
  const w = game.world;
  for (let k = 0; k < 400; k++) {
    const x = 20000 + (k % 20) * 3000, y = 20000 + Math.floor(k / 20) * 3000;
    if (!openAt(w, x, y, 200) || !openAt(w, x + d, y, 200)) continue;
    if (!runFree(game, ship, x, y, x + d, y)) continue;
    return { a: [x, y], b: [x + d, y] };
  }
  throw new Error('no open stretch');
}

interface Run {
  arrived: boolean;
  stops: string[];
  secs: number;
}

/** Sails her to the mark with the phone's idle helm beating four times a second — its old sail the first second (the
 *  beat already on its way), then the helmsman's; `each` runs every tick. */
function sailTo(game: Game, s: PlayerSession, c: FakeConn, to: [number, number], maxSec: number, each?: () => void, oldSail = 0): Run {
  const ship = s.ship!;
  const from = c.inbox.length;
  c.push({ t: 'autosail', x: to[0], y: to[1], sail: 4 });
  let phone = oldSail;
  const t0 = game.now;
  let seq = 1000;
  for (let i = 0; i < maxSec * TICK_RATE; i++) {
    if (i === TICK_RATE) phone = (c.inbox.slice(from).find((m) => m.t === 'autosail' && m.on) as { sail?: number } | undefined)?.sail ?? phone;
    if (i % 5 === 0) {
      s.msgCount = 0; // (the flood guard counts by the wall's clock: the sim runs a minute of sea in a blink)
      c.push({ t: 'input', rudder: 0, sail: phone, seq: ++seq });
    }
    each?.();
    game.step();
    if (!autosailOf(ship) && !pausedCourse(ship) && !queuedCourse(ship)) break;
  }
  const stops = c.inbox.slice(from).filter((m) => m.t === 'autosail' && !m.on).map((m) => (m as { why?: string }).why ?? 'off');
  return { arrived: stops.at(-1) === 'arrived', stops, secs: game.now - t0 };
}

function scene(name: string): { game: Game; s: PlayerSession; c: FakeConn; ship: ShipEntity; a: [number, number]; b: [number, number]; calm: () => void } {
  const { game } = makeGame();
  const { s, c, ship } = seaCaptainAt(game, 'brig', 50000, 50000, 0);
  const { a, b } = stretch(game, ship, 2500);
  ship.state = { ...ship.state, x: a[0], y: a[1], heading: Math.PI / 2, speed: 0, sail: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, a[0], a[1]);
  quietAround(game, a[0], a[1]);
  const calm = sceneWind(game, name);
  return { game, s, c, ship, a, b, calm };
}

/** Keeps the sea about her empty of the sea's own ships (the conditions are the test's business, not a pirate's). */
function emptySea(game: Game, ship: ShipEntity): () => void {
  let i = 0;
  return () => {
    if (i++ % 20) return;
    for (const o of [...game.ships.values()]) if (!o.isPlayer && Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < 4000) game.removeShip(o.id);
  };
}

const CONDITIONS: { name: string; set: (game: Game, s: PlayerSession, ship: ShipEntity) => void; tick?: (game: Game, ship: ShipEntity) => void }[] = [
  { name: 'no sailcloth, the canvas in rags', set: (_g, _s, ship) => {
    delete ship.cargo.sailcloth;
    ship.sails = 0;
  } },
  { name: 'no provisions', set: (_g, _s, ship) => {
    delete ship.cargo.provisions;
  } },
  { name: 'a low hull and torn rigging', set: (_g, _s, ship) => {
    ship.hull = ship.stats.hullMax * 0.12;
    ship.sails = ship.stats.sailHpMax * 0.2;
    ship.rudderHp = 0.4;
  } },
  { name: 'a short crew', set: (_g, _s, ship) => {
    ship.crew = Math.max(1, Math.floor(ship.stats.crewMin * 0.5));
  } },
  { name: 'a storm', set: (game) => {
    game.weatherOf = () => 'storm';
  }, tick: (_game, ship) => {
    assert.ok(ship.input.sailTarget <= 0.75 + 1e-9 || !autosailOf(ship), `reefed in the storm: ${ship.input.sailTarget}`);
  } },
  { name: 'fog', set: (game) => {
    game.weatherOf = () => 'fog';
  } },
  { name: 'night', set: (game) => {
    for (let k = 0; k < 2000 && !isNight(game.now); k++) game.now += 60;
    assert.ok(isNight(game.now));
  } },
  { name: 'a hostile sail in sight', set: (game, _s, ship) => {
    const foe = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + 600, ship.state.y + 400, 0);
    game.npcs.delete(foe.id); // (in sight and passive: a fight would be the next test's)
    game.grid.upsert(foe.id, foe.state.x, foe.state.y);
  } },
];

for (const k of CONDITIONS) {
  test(`auto-sail always: ${k.name} — he takes her to her mark, the wheel never given back on the way`, () => {
    const { game, s, c, ship, b, calm } = scene(k.name);
    k.set(game, s, ship);
    const empty = k.name.includes('hostile') ? () => {} : emptySea(game, ship);
    const r = sailTo(game, s, c, b, 900, () => {
      empty();
      k.tick?.(game, ship);
    });
    calm();
    assert.ok(r.arrived, `${k.name}: arrived (stops ${JSON.stringify(r.stops)}, ${Math.round(r.secs)} s, ${Math.round(Math.hypot(b[0] - ship.state.x, b[1] - ship.state.y))} m off) ${c.all('toast').map((t) => t.msg).slice(-4).join(' | ')}`);
    assert.deepEqual(r.stops, ['arrived'], 'no other stop on the way');
  });
}

test('auto-sail always: no sailcloth is slower, never stuck — the run beyond AUTOSAIL_ROUND is not given up', () => {
  const { game, s, c, ship, b, calm } = scene('rags-long');
  delete ship.cargo.sailcloth;
  ship.sails = 0;
  ship.crew = Math.max(1, Math.floor(ship.stats.crewMin * 0.6));
  const empty = emptySea(game, ship);
  const r = sailTo(game, s, c, b, 1500, empty);
  calm();
  assert.ok(r.secs > AUTOSAIL_ROUND, `a slow run (${Math.round(r.secs)} s)`);
  assert.deepEqual(r.stops, ['arrived'], `${JSON.stringify(r.stops)}`);
});

test('auto-sail always: in a group, as in her own company', () => {
  const { game, s, c, ship, a, b, calm } = scene('group');
  const mate = seaCaptainAt(game, 'brig', a[0] - 300, a[1] + 200, Math.PI / 2);
  mate.c.push({ t: 'group', action: 'invite', name: s.name });
  const inv = c.last('party')?.invites?.[0];
  if (inv) c.push({ t: 'group', action: 'accept', id: inv.id });
  assert.ok((c.last('party')?.group?.members.length ?? 0) >= 2, 'in a group');
  const empty = emptySea(game, ship);
  const r = sailTo(game, s, c, b, 900, empty);
  calm();
  assert.deepEqual(r.stops, ['arrived']);
});

test('auto-sail always: after a fight the course is taken up again by itself; a reef under the keel is no fight', () => {
  const { game, s, c, ship, b, calm } = scene('after-fight');
  const empty = emptySea(game, ship);
  let hitAt = -1;
  const r = sailTo(game, s, c, b, 900, () => {
    empty();
    // a shot at her ten seconds out, the fight over three seconds later
    if (hitAt < 0 && autosailOf(ship) && game.now - (autosailOf(ship)!.since) > 10) hitAt = game.now;
    if (hitAt >= 0 && game.now - hitAt < 3) ship.lastHitAt = game.now;
  });
  calm();
  assert.equal(r.stops[0], 'attack', 'the fight breaks the course off');
  assert.equal(r.stops.at(-1), 'arrived', `taken up again and brought in: ${JSON.stringify(r.stops)}`);
  // the sea's own harm: no «attack»
  ship.lastHitAt = -999;
  ship.gunsAt = -999;
  ship.attackers.clear();
  ship.lastCombat = game.now; // (a reef's grind, a fire: applyDamage with no ship behind it)
  assert.equal(autosailDanger(game, s, ship, game.now - 1), null);
  ship.gunsAt = game.now; // her own guns are
  assert.equal(autosailDanger(game, s, ship, game.now - 1), 'attack');
});

test('auto-sail always: a course given in a fight waits for its end; one given in port is sailed the moment she casts off', () => {
  const { game, s, c, ship, b, calm } = scene('port-fight');
  ship.lastHitAt = game.now;
  c.push({ t: 'autosail', x: b[0], y: b[1], sail: 3 });
  assert.equal(autosailOf(ship), null);
  assert.ok(pausedCourse(ship), 'kept for after the fight');
  const m = c.last('autosail') as { on: boolean; why?: string; x?: number };
  assert.equal(m.on, false);
  assert.equal(m.why, 'attack');
  assert.equal(m.x, b[0], 'its mark said, for the line drawn dimmed');
  const empty = emptySea(game, ship);
  for (let i = 0; i < (RESUME_CALM * 3 + 6) * TICK_RATE && !autosailOf(ship); i++) {
    empty();
    game.step();
  }
  assert.ok(autosailOf(ship), 'the fight over: the helmsman has the wheel');
  // in port
  c.push({ t: 'autosail', stop: true });
  ship.docked = game.world.ports[0].id;
  c.push({ t: 'autosail', x: b[0], y: b[1], sail: 3 });
  assert.ok(queuedCourse(ship), 'kept for her casting off');
  assert.equal(c.all('err').length, 0, 'no refusal');
  ship.docked = null;
  s.profile!.docked = null;
  game.step();
  assert.ok(autosailOf(ship), 'cast off: on her way');
  calm();
});

test('auto-sail always: the phone\'s beat already on its way with her old sail does not take the wheel back; a new sail of hers does', () => {
  const { game, s, c, ship, b, calm } = scene('beat');
  const empty = emptySea(game, ship);
  c.push({ t: 'input', rudder: 0, sail: 0, seq: 1 });
  c.push({ t: 'autosail', x: b[0], y: b[1], sail: 3 });
  assert.ok(autosailOf(ship));
  for (let i = 0; i < 20; i++) {
    if (i % 5 === 0) c.push({ t: 'input', rudder: 0, sail: 0, seq: 2 + i });
    empty();
    game.step();
  }
  assert.ok(autosailOf(ship), 'her old sail in flight: still his');
  c.push({ t: 'input', rudder: 0, sail: 3, seq: 50 });
  assert.ok(autosailOf(ship), 'the helmsman\'s sail: still his');
  c.push({ t: 'input', rudder: 0, sail: 1, seq: 51 });
  assert.equal(autosailOf(ship), null, 'a sail of her own choosing: the wheel is hers');
  calm();
});
