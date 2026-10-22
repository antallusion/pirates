// The reaches (owner, 2026-10-22: «Взаимодействие с объектами и нпс надо делать на расстоянии 30 метров … абордаж вообще
// только когда поровняюсь с кораблем должен быть. это и у нпс и у игроков надо сделать, у всех короче»): every hand-to-hand
// thing at sea is reckoned by shared/src/data/reach.ts — from the hull's edge, thirty metres — and refused beyond it, for
// the captains and the sea's own alike; the grapples fly only alongside; the «go there and do it» runs end inside the
// reaches and do it there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BOARD_ARC_DEG, BOARD_GAP, BOARD_REL_SPEED, DOCK_SLOW, OBJ_R, REACH_DOCK, REACH_HAIL, REACH_OBJ, REACH_SHORE, REACH_SLACK, REACH_TABLE,
  alongsidePoint, alongsideWhy, boardGap, gapTo, gapToShore, hullOf, hullsGap, landingPoint, offBeamDeg,
} from '../shared/src/data/reach.ts';
import type { Hull } from '../shared/src/data/reach.ts';
import { headingVec } from '../shared/src/math.ts';
import { ROAM_REACH } from '../shared/src/data/roamers.ts';
import { DRIFT_REACH } from '../shared/src/data/drifts.ts';
import { FIND_REACH } from '../shared/src/data/seafinds.ts';
import { MARK_REACH } from '../shared/src/data/seamarks.ts';
import { BOTTLE_FIND_R } from '../shared/src/data/bottles.ts';
import { CIT_RANGE } from '../shared/src/data/citadels.ts';
import { GATE_R } from '../shared/src/data/descent.ts';
import { RAID_GATE_R } from '../shared/src/data/abyssraid.ts';
import { TRADE_RANGE } from '../shared/src/data/social.ts';
import { TALK_R } from '../shared/src/data/ceasefire.ts';
import { ESCORT_SIGN_R } from '../shared/src/data/raiding.ts';
import { PAGE_R } from '../shared/src/data/dutchman.ts';
import { WAY_MOOR_RANGE, WAY_SIZE, waystations } from '../shared/src/world/waystations.ts';
import { dockGap } from '../shared/src/world/dock.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { approachOf } from '../server/src/game/approach.ts';
import { autosailOf, startAutosail } from '../server/src/game/autosail.ts';
import { BOARD_ABEAM, BOARD_FAR, BOARD_SPEED, canBoard } from '../server/src/game/boarding.ts';
import { findLandable } from '../server/src/game/exploration.ts';
import { engage, newBrain } from '../server/src/game/npc.ts';
import { attackRoam, roamAtHand, roamWhere, ROAM_FAR } from '../server/src/game/roamers.ts';
import { findsOf, putFind, startFind } from '../server/src/game/seafinds.ts';
import { markBusy, markById, startMark } from '../server/src/game/seamarks.ts';
import { castOff, moor, mooredAt } from '../server/src/game/waystations.ts';
import { ISLE_REACH } from '../server/src/game/quests.ts';
import { SURRENDER_RANGE } from '../server/src/game/struck.ts';
import { openSea } from '../server/src/game/wrecks.ts';
import { SELL_RANGE } from '../server/src/game/chests.ts';
import { DIG_RANGE } from '../server/src/game/explorefx.ts';
import { CHOOSE_R } from '../server/src/game/director.ts';
import { GUARD_DEAL_R, quietAdv } from '../server/src/game/advmap.ts';
import { closeFight, landFighting, landTac } from '../server/src/game/beastlairs.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';
import { attackRelevant } from '../client/src/ui/actbar.ts';

/** No other ship about her (a pirate's shot holds every order «until the firing stops»). */
function clearSea(game: Game, ship: ShipEntity): void {
  for (const o of [...game.ships.values()]) if (o !== ship && Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < 4000) game.removeShip(o.id);
  game.directorOn = false;
  ship.protectedUntil = game.now + 1e6; // (the sea's pirates keep off her: the test is the reach, not a fight)
}

function captain(game: Game, name: string, cls = 'brig'): { s: PlayerSession; c: FakeConn; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.gold = 5000;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  onHull(game, s.ship!, cls, 4);
  runAdmin(game, s, '/tp gravewater');
  const ship = s.ship!;
  ship.protectedUntil = 0;
  ship.lastCombat = -1000;
  return { s, c, ship };
}

/** Her hull laid with its beam (heading east: the thing due south of her) `gap` metres of water off a thing of radius
 *  `r` at (x, y) — her hull's edge to its edge. */
function besideAt(game: Game, ship: ShipEntity, x: number, y: number, r: number, gap: number): void {
  ship.state = { ...ship.state, x, y: y - (r + ship.stats.beam / 2 + gap), heading: Math.PI / 2, speed: 0, sail: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

const hull = (x: number, y: number, heading: number, length = 30, beam = 8): Hull => ({ x, y, heading, length, beam });

// ------------------------------------------------------------------ the module: one reach for every interaction

test('reach.ts: the hull is a capsule — her edge to a thing, to a coast, to another hull; the beam bearing', () => {
  const h = hull(0, 0, 0); // north, 30 × 8: her keel from y −11 to +11
  assert.equal(gapTo(h, 20, 0), 16); // abeam: 20 − 4
  assert.equal(gapTo(h, 0, -45), 30); // ahead: 45 − 15
  assert.equal(gapTo(h, 0, -45, OBJ_R), 30 - OBJ_R);
  const sq = [-100, -100, 100, -100, 100, 100, -100, 100]; // a square island
  assert.ok(Math.abs(gapToShore(hull(0, -140, Math.PI / 2), sq) - 36) < 1e-6, 'beam to the coast: 40 − 4');
  assert.ok(Math.abs(hullsGap(hull(0, 0, 0), hull(20, 0, 0)) - 12) < 1e-6, 'beam to beam: 20 − 8');
  assert.equal(Math.round(offBeamDeg(h, 20, 0)), 0);
  assert.equal(Math.round(offBeamDeg(h, 0, -40)), 90);
  // the fenders: two frigates side by side lie as far apart as their bump discs (Game.ts collideShips), not nearer
  const f1 = hull(0, 0, 0, 46, 14), f2 = hull(30, 0, 0, 46, 14);
  assert.ok(boardGap(f1, f2) < hullsGap(f1, f2) && boardGap(f1, f2) <= BOARD_GAP);
  const lp = landingPoint(sq, 0, 0);
  assert.ok(Math.abs(Math.abs(lp.x) + Math.abs(lp.y) - 100) < 1e-6, 'the beach nearest a thing ashore');
});

test('every interaction reckons its reach from reach.ts: thirty metres of the hull (the dock forty, the parley the guns\' reach)', () => {
  // [what, its reach, reach.ts's]
  const table: [string, number, number][] = [
    ['a creature stack', ROAM_REACH, REACH_OBJ], ['a drift', DRIFT_REACH, REACH_OBJ], ['a bottle on the water', FIND_REACH.bottle, REACH_OBJ],
    ['the fog\'s cache', FIND_REACH.calm, REACH_OBJ], ['a sinking boat', FIND_REACH.boat, REACH_OBJ], ['the gulls\' shoal', FIND_REACH.gulls, REACH_OBJ],
    ['a sea mark (a wreck field)', MARK_REACH, REACH_OBJ], ['a captain\'s bottle', BOTTLE_FIND_R, REACH_OBJ], ['a waystation', WAY_MOOR_RANGE, REACH_OBJ],
    ['a citadel\'s anchorage', CIT_RANGE, REACH_OBJ], ['the Stair', GATE_R, REACH_OBJ], ['the Maw', RAID_GATE_R, REACH_OBJ], ['goods across', TRADE_RANGE, REACH_OBJ],
    ['a map sold alongside', SELL_RANGE, REACH_OBJ], ['a struck ship', SURRENDER_RANGE, REACH_OBJ], ['a convoy\'s sign-on', ESCORT_SIGN_R, REACH_OBJ],
    ['the Dutchman\'s page', PAGE_R, REACH_OBJ], ['a sign\'s choice', CHOOSE_R, REACH_OBJ], ['a guard\'s men', GUARD_DEAL_R, REACH_OBJ], ['a treasure spot', DIG_RANGE, REACH_OBJ],
    ['an island\'s waters', ISLE_REACH, REACH_SHORE + REACH_SLACK], ['a parley', TALK_R, REACH_HAIL],
  ];
  for (const [what, r, want] of table) assert.equal(r, want, what);
  assert.ok(REACH_OBJ === 30 && REACH_SHORE === 30 && REACH_DOCK === 40 && BOARD_GAP >= 8 && BOARD_GAP <= 12 && BOARD_ARC_DEG === 35 && DOCK_SLOW <= 5);
  // …and every server file that measures one imports it (no reach of its own left)
  const files = ['roamers', 'drifts', 'seafinds', 'seamarks', 'bottles', 'waystations', 'citadels', 'descent', 'abyssraid', 'party', 'chests', 'struck', 'raiding',
    'dutchman', 'director', 'advmap', 'explorefx', 'exploration', 'mines', 'resources', 'beastlairs', 'shorebosses', 'holdings', 'guests', 'quests', 'isles', 'isles18',
    'smugglefx', 'legendary', 'expeditions', 'grail', 'beasts', 'boarding', 'boardgroup', 'ceasefire', 'approach', 'Game'];
  for (const f of files) assert.match(readFileSync(`server/src/game/${f}.ts`, 'utf8'), /shared\/src\/data\/reach\.ts/, f);
  assert.ok(Object.keys(REACH_TABLE).length >= 30);
});

// ------------------------------------------------------------------ refused beyond, done within: the captains

test('within thirty metres of her hull it is done, a few metres beyond it is refused (no order to sail in): stack, find, fog, mark, waystation', () => {
  const { game } = makeGame();
  quietAdv(game, false);
  const { s, ship } = captain(game, 'Reach Rita');
  clearSea(game, ship);
  // the sea's small things: a bottle and the fog's cache
  for (const kind of ['bottle', 'calm'] as const) {
    const at = { x: ship.state.x + 400, y: ship.state.y };
    const f = putFind(game, s, kind, at)!;
    besideAt(game, ship, f.x, f.y, OBJ_R, REACH_OBJ + REACH_SLACK + 6);
    assert.match(String(startFind(game, s, f.id)), /thirty metres/, `${kind}: beyond`);
    besideAt(game, ship, f.x, f.y, OBJ_R, REACH_OBJ - 4);
    assert.equal(startFind(game, s, f.id), null, `${kind}: within`);
    runAdmin(game, s, '/find reset');
  }
  // a sea mark
  const id = Number(/mark (\d+)/.exec(runAdmin(game, s, '/seamark drift go') ?? '')?.[1]);
  const m = markById(game, id)!;
  besideAt(game, ship, m.x, m.y, m.r, REACH_OBJ + REACH_SLACK + 6);
  assert.match(String(startMark(game, s, id)), /thirty metres/, 'mark: beyond');
  besideAt(game, ship, m.x, m.y, m.r, REACH_OBJ - 4);
  assert.equal(startMark(game, s, id), null, 'mark: within');
  assert.ok(markBusy(game, s));
  // a floating waystation
  const w = waystations(game.world).list.find((x) => Math.hypot(x.x - ship.state.x, x.y - ship.state.y) < 30000) ?? waystations(game.world).list[0];
  besideAt(game, ship, w.x, w.y, WAY_SIZE / 2, REACH_OBJ + REACH_SLACK + 6);
  assert.match(String(moor(game, s, w.id)), /Sail closer/, 'waystation: beyond');
  besideAt(game, ship, w.x, w.y, WAY_SIZE / 2, REACH_OBJ - 4);
  assert.equal(moor(game, s, w.id), null, 'waystation: within');
  assert.equal(mooredAt(game, s)?.id, w.id);
  castOff(game, s);
  // a creature stack (last: the battle holds her a while after)
  runAdmin(game, s, '/stack go');
  const sp = roamAtHand(game, s, 400)!;
  const p = roamWhere(game, sp);
  besideAt(game, ship, p.x, p.y, OBJ_R, REACH_OBJ + REACH_SLACK + 6);
  assert.equal(attackRoam(game, s, sp.id), ROAM_FAR, 'stack: beyond');
  besideAt(game, ship, p.x, p.y, OBJ_R, REACH_OBJ - 4);
  assert.equal(attackRoam(game, s, sp.id), null, 'stack: within');
  assert.ok(landFighting(game, s));
  landTac(game, s, { a: 'quick' });
  steps(game, 2);
  closeFight(game, s);
});

test('a landing: her hull within thirty metres of the coast, not 260 m off it', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Lander Lea');
  const is = game.world.islands.find((i) => !i.portId && !i.minor && !i.hidden && !i.raft && i.features.length && i.radius > 200 && Math.hypot(i.x - ship.state.x, i.y - ship.state.y) < 40000)!;
  assert.ok(is, 'an island with something ashore');
  // off its coast, on the line from its middle through a vertex
  const vx = is.poly[0], vy = is.poly[1], l = Math.hypot(vx - is.x, vy - is.y);
  const ux = (vx - is.x) / l, uy = (vy - is.y) / l;
  const put = (off: number) => {
    ship.state = { ...ship.state, x: vx + ux * off, y: vy + uy * off, heading: Math.atan2(-uy, ux) /* beam to it */, speed: 0 };
    game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  };
  put(200);
  assert.equal(findLandable(game, s), null, '200 m off: nothing to land on');
  // the nearest the hull lies to the coast at which the boats still reach it
  for (let off = 200; off > 10; off -= 2) {
    put(off);
    if (findLandable(game, s)) break;
  }
  assert.ok(findLandable(game, s), 'close in: the landing');
  assert.ok(gapToShore(hullOf(ship), is.poly) <= REACH_SHORE + REACH_SLACK + 1e-6, `within reach: ${gapToShore(hullOf(ship), is.poly).toFixed(1)} m`);
});

test('the harbour: «Причалить» only from its approach (40 m of its anchorage or quays) and slow; from its waters the order sails her in', () => {
  const { game } = makeGame();
  const { s, c, ship } = captain(game, 'Docker Dot');
  const port = game.world.ports.find((p) => !p.raft && Math.hypot(p.x - ship.state.x, p.y - ship.state.y) < 30000)!;
  const is = game.world.islands[port.islandId];
  const quay = { x: is.x, y: is.y, r: is.radius, poly: is.poly };
  // 300 m out from the anchorage, away from its island, in open water
  const ux = (port.x - is.x) / Math.hypot(port.x - is.x, port.y - is.y), uy = (port.y - is.y) / Math.hypot(port.x - is.x, port.y - is.y);
  ship.state = { ...ship.state, x: port.x + ux * 300, y: port.y + uy * 300, heading: Math.atan2(-ux, uy), speed: 0, sail: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.ok(dockGap(hullOf(ship), port, quay) > REACH_DOCK);
  c.push({ t: 'dock' });
  assert.equal(ship.docked, null, 'not from 300 m');
  assert.ok(approachOf(game, s)?.msg.t === 'dock', 'the helmsman takes her in');
  for (let i = 0; i < 20 * 120 && !ship.docked; i++) game.step();
  assert.equal(ship.docked, port.id, 'in port, from its approach');
});

// ------------------------------------------------------------------ boarding: alongside only, for everyone

test('boarding: refused astern, bow on, beyond the gap or with the way unmatched; alongside it is taken — a captain and the sea\'s own alike', () => {
  const { game } = makeGame();
  const { ship } = captain(game, 'Grapple Gina', 'brig');
  ship.crew = ship.stats.crewMax;
  const put = (o: ShipEntity, x: number, y: number, h: number, v = 0) => {
    o.state = { ...o.state, x, y, heading: h, speed: v };
    game.grid.upsert(o.id, x, y);
  };
  const npc = game.spawnNpcShip('pirate', 'brig', 'free', ship.state.x + 25, ship.state.y, 0);
  npc.input = { rudder: 0, sailTarget: 0 };
  const X = ship.state.x, Y = ship.state.y;
  put(ship, X, Y, 0);
  const side = ship.stats.beam + 0.32 * 2 * ship.stats.length - ship.stats.beam + 4; // her fenders' distance and a little
  for (const [a, b] of [[ship, npc], [npc, ship]] as const) {
    // beam to beam, still: taken
    put(a, X, Y, 0);
    put(b, X + side, Y, 0);
    assert.equal(canBoard(game, a, b), null, `${a.isPlayer ? 'captain' : 'npc'}: alongside`);
    // dead astern, close: not
    put(b, X, Y + a.stats.length + 6, 0);
    assert.equal(canBoard(game, a, b), BOARD_ABEAM, 'astern');
    // bow on to her side (a T): not
    put(b, X + a.stats.beam / 2 + b.stats.length / 2 + 4, Y, Math.PI / 2);
    assert.equal(canBoard(game, a, b), BOARD_ABEAM, 'bow on');
    // beam to beam but 60 m of water between: not
    put(b, X + 60 + a.stats.beam, Y, 0);
    assert.equal(canBoard(game, a, b), BOARD_FAR, 'beyond the gap');
    // alongside, but tearing past
    put(b, X + side, Y, 0, a.isPlayer ? BOARD_REL_SPEED * 1.5 + 2 : BOARD_REL_SPEED + 2);
    assert.equal(canBoard(game, a, b), BOARD_SPEED, 'the way unmatched');
    put(b, X + side, Y, 0, 0);
  }
  // reach.ts's own word on it, the same for both
  const h1 = hull(0, 0, 0), h2 = hull(20, 0, 0);
  assert.equal(alongsideWhy(h1, 5, h2, 5), null);
  assert.equal(alongsideWhy(h1, 0, hull(0, 40, 0), 0), 'abeam');
  assert.equal(alongsideWhy(h1, 0, hull(20, 0, Math.PI / 2), 0), 'abeam');
  // the spot to come alongside: off her beam, on her course
  const P = alongsidePoint(hull(-100, 50, 0), h1);
  assert.ok(P.x < 0 && Math.abs(P.y) < 1e-9 && P.heading === 0);
});

test('the sea\'s own pirate comes alongside a captain and boards her (npc.ts alongsideHelm), never from afar', () => {
  const { game } = makeGame();
  const { ship } = captain(game, 'Prize Polly', 'brig');
  // a battered captain under easy sail: the pirate's prize
  ship.hull = ship.stats.hullMax * 0.4;
  ship.state.speed = 3;
  ship.input = { rudder: 0, sailTarget: 0.25 };
  const v = headingVec(ship.state.heading + 2.2);
  const pirate = game.spawnNpcShip('pirate', 'brig', 'free', ship.state.x + v.x * 500, ship.state.y + v.y * 500, ship.state.heading + Math.PI);
  pirate.crew = pirate.stats.crewMax;
  pirate.morale = 90;
  const brain = game.npcs.get(pirate.id) ?? newBrain(pirate.id, 'pirate', game.now);
  brain.role = 'pirate';
  brain.active = true;
  let boarded = -1, closest = Infinity;
  for (let i = 0; i < 20 * 90 && boarded < 0; i++) {
    if (i % 5 === 0 && !pirate.boarding) engage(game, pirate, brain, ship, Math.hypot(ship.state.x - pirate.state.x, ship.state.y - pirate.state.y));
    closest = Math.min(closest, hullsGap(hullOf(pirate), hullOf(ship)));
    game.step();
    if (pirate.boarding && pirate.boarding.with === ship.id) boarded = i / 20;
    ship.hull = Math.max(ship.hull, ship.stats.hullMax * 0.3); // (the test is the grapples, not the guns)
  }
  assert.ok(boarded > 0, `the pirate boards her (closest ${closest.toFixed(1)} m)`);
  console.log(`the sea's pirate alongside and grappled in ${boarded.toFixed(1)} s from 500 m`);
});

// ------------------------------------------------------------------ the approach flows: sailed into the reaches, done there

test('the «go there and do it» runs end inside the reaches and do it: a wreck field, a bottle, the fog\'s cache, a stack, a boarding, a landing', () => {
  const { game } = makeGame();
  quietAdv(game, false);
  const { s, c, ship } = captain(game, 'Runner Rae');
  clearSea(game, ship);
  const until = (pred: () => boolean, sec: number) => {
    for (let i = 0; i < sec * 20 && !pred(); i++) game.step();
    return pred();
  };
  // a bottle and the fog's cache from 500 m
  for (const kind of ['bottle', 'calm'] as const) {
    runAdmin(game, s, '/find reset');
    // (open water 500 m off her, the way there clear: she is put where there is some)
    let at: { x: number; y: number } | null = null;
    const clearLine = (x0: number, y0: number, x1: number, y1: number) => {
      for (let t = 0; t <= 1.0001; t += 0.05) if (!openSea(game, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
      return true;
    };
    for (let k = 0; k < 60 && !at; k++) {
      const x0 = ship.state.x + (k % 6) * 900, y0 = ship.state.y + Math.floor(k / 6) * 900;
      if (clearLine(x0, y0, x0 + 500, y0)) {
        ship.state = { ...ship.state, x: x0, y: y0, heading: Math.PI / 2, speed: 0 };
        game.grid.upsert(ship.id, x0, y0);
        at = { x: x0 + 500, y: y0 };
      }
    }
    assert.ok(at, 'open water about her');
    clearSea(game, ship);
    const f = putFind(game, s, kind, at!)!;
    c.push({ t: 'seafind', action: 'work', id: f.id });
    assert.ok(approachOf(game, s), `${kind}: sailing in`);
    const said = c.all('toast').length;
    assert.ok(until(() => !findsOf(game, s).some((x) => x.id === f.id), 150), `${kind}: reached and worked (${c.all('toast').slice(said).map((x) => (x as { msg: string }).msg).join(' | ')})`);
    steps(game, 20 * 8);
  }
  // a wreck field (a sea mark) from 600 m
  const id = Number(/mark (\d+)/.exec(runAdmin(game, s, '/seamark wreck go') ?? '')?.[1]);
  const m = markById(game, id)!;
  besideAt(game, ship, m.x, m.y, m.r, 600);
  c.push({ t: 'seamark', action: 'work', id });
  assert.ok(approachOf(game, s), 'wreck: sailing in');
  assert.ok(until(() => !!markBusy(game, s), 150), 'wreck: the boats at it');
  assert.ok(until(() => !markBusy(game, s), 30), 'wreck: worked');
  runAdmin(game, s, '/seamark reset');
  // a stack from 600 m: the boats go within thirty metres
  runAdmin(game, s, '/stack go');
  const sp = roamAtHand(game, s, 400)!;
  const p = roamWhere(game, sp);
  besideAt(game, ship, p.x, p.y, OBJ_R, 600);
  c.push({ t: 'attack', roam: sp.id });
  assert.ok(until(() => landFighting(game, s), 90), 'stack: the battle opens');
  landTac(game, s, { a: 'quick' });
  steps(game, 2);
  closeFight(game, s);
  steps(game, 20 * 20);
});

test('boarding from 300 m: «На абордаж» sails her alongside and the grapples fly there', () => {
  const { game } = makeGame();
  const { s, c, ship } = captain(game, 'Boarder Bo');
  ship.crew = ship.stats.crewMax;
  const v = headingVec(ship.state.heading + Math.PI / 2);
  const npc = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + v.x * 300, ship.state.y + v.y * 300, ship.state.heading);
  npc.crew = Math.ceil(npc.stats.crewMax * 0.2);
  npc.input = { rudder: 0, sailTarget: 0.25 };
  npc.state.speed = 2;
  c.push({ t: 'board', target: npc.id, aggression: 'standard', risk: true });
  assert.ok(!ship.boarding, 'not from 300 m');
  let t = 0;
  for (; t < 20 * 90 && !ship.boarding; t++) game.step();
  assert.ok(ship.boarding, 'alongside: grappled');
  console.log(`alongside and grappled in ${(t / 20).toFixed(1)} s from 300 m`);
  void s;
});

test('a landing run: the helmsman takes her to the beach, creeps the last stretch in, and the boats can land', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Beach Bea');
  const is = game.world.islands.find((i) => !i.portId && !i.minor && !i.hidden && !i.raft && i.features.length && i.radius > 200 && Math.hypot(i.x - ship.state.x, i.y - ship.state.y) < 40000)!;
  const vx = is.poly[0], vy = is.poly[1], l = Math.hypot(vx - is.x, vy - is.y);
  const ux = (vx - is.x) / l, uy = (vy - is.y) / l;
  ship.state = { ...ship.state, x: vx + ux * 700, y: vy + uy * 700, heading: Math.atan2(-ux, uy), speed: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  const b = landingPoint(is.poly, ship.state.x, ship.state.y);
  assert.equal(startAutosail(game, s, b.x + ux * 18, b.y + uy * 18, undefined, 20), null);
  for (let i = 0; i < 20 * 150 && autosailOf(ship); i++) game.step();
  steps(game, 20 * 6);
  assert.ok(gapToShore(hullOf(ship), is.poly) <= REACH_SHORE + REACH_SLACK, `by the beach: ${gapToShore(hullOf(ship), is.poly).toFixed(1)} m`);
  assert.ok(findLandable(game, s), 'the boats can land');
});

// ------------------------------------------------------------------ the client: no button for what she cannot see

test('the client: «Атаковать» on a ship only within her guns and on her screen; hints in both tongues', async () => {
  assert.equal(attackRelevant(true, true), true);
  assert.equal(attackRelevant(false, true), false);
  assert.equal(attackRelevant(true, false), false);
  const { EN, RU } = await import('../client/src/lang/ui/reach.ts');
  for (const k of Object.keys(EN) as (keyof typeof EN)[]) assert.ok(RU[k] && !/[A-Za-z]/.test(RU[k].replace(/\{[a-z]+\}/g, '')), k);
  const { SERVER_RU_REACH } = await import('../client/src/lang/server.ru.reach.ts');
  for (const [en, ru] of Object.entries(SERVER_RU_REACH)) assert.ok(en && ru && !/[A-Za-z]/.test(ru.replace(/\{\d\}/g, '')), en);
  const { onScreen } = await import('../client/src/reachview.ts');
  const view = { w: 844, h: 390, zoom: 1.5, sx: (x: number) => (x - 0) * 1.5 + 422, sy: (y: number) => (y - 0) * 1.5 + 195 };
  assert.ok(onScreen(view, null, 200, 100));
  assert.ok(!onScreen(view, null, 400, 0), '400 m off: off a phone held sideways');
});
