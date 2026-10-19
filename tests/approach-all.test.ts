// Every «go there» action sails there by itself (owner, 2026-10-19: «Всякие штуки типа обыскать туман или выловить
// бутылку или другие штуки похожие должны включать автоплавание и плыть автоматом туда куда надо»). An order at a thing
// out of its reach starts the helmsman's course to it (its line and km on the chip, the route sent), and on arrival the
// order is done by itself (approach.ts). The search of the fog and the bottle from a ship lying still: her phone's helm
// still beating «sails in» as the course was set took the wheel straight back («Автоплавание выключено: штурвал у
// вас») — now the whole way is sailed and the boats go. The waystation's mooring, the carcass's flensing, the Abyss's
// gate and a citadel's anchorage join the finds, the sea marks, the drifts, the lairs, the guards and the adventure
// map's things; a tap on a waystation on the sea moors her there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICK_RATE } from '../shared/src/constants.ts';
import { readFileSync } from 'node:fs';
import { WAY_MOOR_RANGE, waystations } from '../shared/src/world/waystations.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { approachOf } from '../server/src/game/approach.ts';
import { autosailOf, runFree } from '../server/src/game/autosail.ts';
import { findById, putFind } from '../server/src/game/seafinds.ts';
import { mooredAt } from '../server/src/game/waystations.ts';
import { carcassesOf, spawnBeast } from '../server/src/game/beasts.ts';
import { tapTarget } from '../client/src/ui/sailto.ts';
import { openAt, quietAround, sceneWind, seaCaptainAt } from '../tools/nav/harness.ts';
import type { FakeConn } from './helpers.ts';
import { makeGame } from './helpers.ts';

/** Open water with a clear run `d` metres east of it. */
function stretch(game: Game, s: PlayerSession, d: number): { a: [number, number]; b: [number, number] } {
  for (let k = 0; k < 400; k++) {
    const x = 20000 + (k % 20) * 3000, y = 20000 + Math.floor(k / 20) * 3000;
    if (!openAt(game.world, x, y, 200) || !openAt(game.world, x + d, y, 200) || !runFree(game, s.ship!, x, y, x + d, y)) continue;
    return { a: [x, y], b: [x + d, y] };
  }
  throw new Error('no open stretch');
}

/** Runs the sea with her phone's idle helm beating its sail (as it was before the course: `sail`, then the helmsman's
 *  once the client has his word), until `done` or `sec` seconds. */
function sea(game: Game, s: PlayerSession, c: FakeConn, sec: number, done: () => boolean, sail = 0): number {
  const from = c.inbox.length;
  let phone = sail;
  const t0 = game.now;
  for (let i = 0; i < sec * TICK_RATE && !done(); i++) {
    if (i === TICK_RATE) phone = (c.inbox.slice(from).filter((m) => m.t === 'autosail' && m.on).pop() as { sail?: number } | undefined)?.sail ?? phone;
    if (i % 5 === 0) {
      s.msgCount = 0; // (the flood guard counts by the wall's clock)
      c.push({ t: 'input', rudder: 0, sail: phone, seq: 10_000 + i });
    }
    if (i % 20 === 0) for (const o of [...game.ships.values()]) if (!o.isPlayer && o.npcRole !== 'beast' && Math.hypot(o.state.x - s.ship!.state.x, o.state.y - s.ship!.state.y) < 4000) game.removeShip(o.id);
    game.step();
  }
  return game.now - t0;
}

function lyingStill(name: string): { game: Game; s: PlayerSession; c: FakeConn; a: [number, number]; b: [number, number]; calm: () => void } {
  const { game } = makeGame();
  const { s, c, ship } = seaCaptainAt(game, 'brig', 50000, 50000, Math.PI / 2);
  const { a, b } = stretch(game, s, 1400);
  ship.state = { ...ship.state, x: a[0], y: a[1], heading: Math.PI / 2, speed: 0, sail: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, a[0], a[1]);
  quietAround(game, a[0], a[1]);
  const calm = sceneWind(game, name);
  return { game, s, c, a, b, calm };
}

for (const kind of ['bottle', 'calm', 'chest', 'gulls'] as const) {
  test(`go there: «${kind}» 1.4 km off, from a ship lying still — the helmsman sails her there and the boats go by themselves`, () => {
    const { game, s, c, b, calm } = lyingStill(`find-${kind}`);
    const f = putFind(game, s, kind, { x: b[0], y: b[1] })!;
    assert.ok(f, `a ${kind} on the water`);
    c.push({ t: 'seafind', action: 'work', id: f.id });
    assert.ok(autosailOf(s.ship!), 'the course is set');
    const as = c.last('autosail') as { on: boolean; path?: [number, number][] };
    assert.ok(as.on && (as.path?.length ?? 0) >= 2, 'with its line (the chip reckons the km by it)');
    const secs = sea(game, s, c, 300, () => !approachOf(game, s));
    calm();
    const manual = c.all('autosail').filter((m) => !m.on).map((m) => m.why);
    assert.ok(!manual.includes('manual'), `her phone's old beat did not take the wheel: ${JSON.stringify(manual)}`);
    assert.equal(approachOf(game, s), null, `arrived and the order given (${Math.round(secs)} s)`);
    // (a chest's sharks: the boats go against them first — the order done all the same)
    assert.ok(c.last('seafinds')?.busy || !findById(game, f.id) || c.all('toast').some((t) => /^Boats away/.test(t.msg)), `the boats are at it: ${c.all('err').map((m) => m.msg).join(' | ')} ${c.all('toast').slice(-3).map((m) => m.msg).join(' | ')}`);
  });
}

test('go there: a waystation far off — the helmsman takes her to it and she moors on arrival; a tap on it on the sea does the same', () => {
  const { game } = makeGame();
  const { s, c, ship } = seaCaptainAt(game, 'brig', 50000, 50000, 0);
  const list = waystations(game.world).list;
  const w = list.find((x) => openAt(game.world, x.x - 1200, x.y, 200) && runFree(game, ship, x.x - 1200, x.y, x.x, x.y))!;
  assert.ok(w, 'a waystation with open water west of it');
  ship.state = { ...ship.state, x: w.x - 1200, y: w.y, heading: Math.PI / 2, speed: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  quietAround(game, ship.state.x, ship.state.y);
  const calm = sceneWind(game, 'way');
  c.push({ t: 'way', action: 'moor', id: w.id });
  assert.equal(c.all('err').length, 0, 'no refusal');
  assert.ok(autosailOf(ship), 'the helmsman takes her to it');
  assert.equal(approachOf(game, s)?.msg.t, 'way');
  sea(game, s, c, 300, () => mooredAt(game, s) !== null);
  calm();
  assert.equal(mooredAt(game, s)?.id, w.id, 'moored on arrival');
  assert.ok(Math.hypot(w.x - ship.state.x, w.y - ship.state.y) <= WAY_MOOR_RANGE + 40);
  // the client: a tap on it names it
  const st = { finds: [], castaways: [], wrecks: [], loot: new Map(), sights: [], drifts: [], adv: null, lairs: null, shoals: [], seaMarks: new Map(), ways: new Map([[w.id, { id: w.id, x: w.x, y: w.y }]]) };
  assert.equal(tapTarget(st as never, w.x + 5, w.y, 0.5)?.kind, 'way');
  assert.match(readFileSync('client/src/main.ts', 'utf8'), /t\.kind === 'way'\) net\.send\(\{ t: 'way', action: 'moor'/);
});

test('go there: a carcass far off — the helmsman brings her alongside and hove to, and the flensing begins', () => {
  const { game } = makeGame();
  const { s, c, ship } = seaCaptainAt(game, 'schooner', 50000, 50000, Math.PI / 2);
  const { a, b } = stretch(game, s, 900);
  ship.state = { ...ship.state, x: a[0], y: a[1], heading: Math.PI / 2, speed: 0 };
  game.grid.upsert(ship.id, a[0], a[1]);
  quietAround(game, a[0], a[1]);
  const calm = sceneWind(game, 'carcass');
  const whale = spawnBeast(game, 'humpback', b[0], b[1], 4);
  whale.attackers.set(ship.id, game.now);
  whale.hull = 0;
  game.beginSinking(whale);
  for (let i = 0; i < 4 * TICK_RATE && !carcassesOf(game).length; i++) game.step();
  const carc = carcassesOf(game)[0];
  assert.ok(carc, 'a carcass 900 m off');
  ship.attackers.clear();
  ship.lastCombat = ship.gunsAt = ship.lastHitAt = -1e9;
  c.push({ t: 'hunt', action: 'flense', id: carc.id });
  assert.ok(autosailOf(ship), 'the helmsman takes her to it');
  sea(game, s, c, 300, () => !approachOf(game, s));
  calm();
  assert.equal(approachOf(game, s), null, 'arrived, hove to: the order given');
  assert.ok(!c.all('toast').some((t) => t.msg === 'Heave to alongside the carcass first.'), 'never refused');
});

test('go there: every far-off order of the sea is handed to the helmsman (the handlers, read)', () => {
  const src = (f: string) => readFileSync(`server/src/game/${f}`, 'utf8');
  for (const [f, why] of [
    ['seafinds.ts', 'FIND_FAR'], ['seamarks.ts', 'MARK_FAR'], ['drifts.ts', 'DRIFT_REACH'], ['beastlairs.ts', 'LAIR_FAR'], ['advmap.ts', 'VISIT_FAR'],
    ['director.ts', 'CHOOSE_R'], ['waystations.ts', 'WAY_MOOR_RANGE'], ['beasts.ts', 'FLENSE_R'], ['abyssraid.ts', 'GATE_FAR'], ['citadels.ts', 'CIT_FAR'],
  ] as const) assert.match(src(f), new RegExp(`approach\\(game, s, \\{[^\\n]*${why === 'GATE_FAR' || why === 'CIT_FAR' ? '' : ''}`), `${f}: approach() for ${why}`);
});
