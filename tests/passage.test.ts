// «Дальний переход» (owner, 2026-10-28: «выбирая дальние точки плавания корабль спустя 15 сек плавания должен ускоряться
// на полном ходу в 5 раз, но при этом он не сможет остановиться пока не доплывет … корабль невозможно будет остановить,
// атаковать и так далее … становится неактивным для окружения»). server/src/game/passage.ts: ×10 (owner: «давай х10») after 15 s of a far run,
// stop and attack refused, nobody touches her, it ends at the arrival, and no land under her hull on a long way.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPEED_SCALE, TICK_RATE } from '../shared/src/constants.ts';
import { VOYAGE, VOYAGE_MUL, VOYAGE_SPIN, VOYAGE_TAIL } from '../shared/src/data/passage.ts';

// The passage is off in the game (owner, 2026-10-29); its rules are still kept working here.
VOYAGE.on = true;
import { hullClearance } from '../shared/src/sim/hull.ts';
import { blockersNear } from '../shared/src/world/solids.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { autosailOf, plan } from '../server/src/game/autosail.ts';
import { fireBroadside } from '../server/src/game/combat.ts';
import { battleBlocked, untouchable } from '../server/src/game/inbattle.ts';
import { VOYAGE_BUSY, VOYAGE_WHY, farLength, finishVoyage, voyageOf, voyageSpeed, voyaging } from '../server/src/game/passage.ts';
import { openAt, quietAround, seaCaptainAt } from '../tools/nav/harness.ts';
import type { FakeConn } from './helpers.ts';
import { makeGame } from './helpers.ts';

interface Scene {
  game: Game;
  s: PlayerSession;
  c: FakeConn;
  ship: ShipEntity;
  to: { x: number; y: number };
  len: number;
}

function wayLength(p: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return d;
}

/** A captain in open water and a far harbour whose planned way goes round land (three legs at least, 9–20 km). */
function scene(): Scene {
  const { game } = makeGame();
  const { s, c, ship } = seaCaptainAt(game, 'brig', 50000, 50000, 0);
  const w = game.world;
  for (let k = 0; k < 600; k++) {
    const x = 12000 + (k % 24) * 3000, y = 12000 + Math.floor(k / 24) * 3000;
    if (!openAt(w, x, y, 300)) continue;
    for (const p of w.ports) {
      if (p.raft) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 9000 || d > 20000) continue;
      ship.state = { ...ship.state, x, y, heading: 0, speed: 0, sail: 0 };
      game.grid.upsert(ship.id, x, y);
      const path = plan(game, ship, p.x, p.y);
      if (!path || path.length < 4) continue;
      const len = wayLength(path);
      if (len < farLength(ship) * 1.5) continue;
      ship.input = { rudder: 0, sailTarget: 0 };
      quietAround(game, x, y);
      return { game, s, c, ship, to: { x: p.x, y: p.y }, len };
    }
  }
  throw new Error('no far harbour round land');
}

/** Her phone's idle helm beating four times a second with the helmsman's sail, as a real one does. */
function beat(game: Game, s: PlayerSession, c: FakeConn, i: number): void {
  if (i % 5) return;
  s.msgCount = 0;
  c.push({ t: 'input', rudder: 0, sail: 4, seq: 10_000 + i });
}

/** Sets the far course and sails until the passage begins (or `max` seconds). The tick it began, or -1. */
function spinUp(sc: Scene, max = 40): number {
  const { game, s, c, ship, to } = sc;
  c.push({ t: 'autosail', x: to.x, y: to.y, sail: 4 });
  for (let i = 0; i < max * TICK_RATE; i++) {
    beat(game, s, c, i);
    game.step();
    if (voyaging(ship)) return i;
  }
  return -1;
}

const toasts = (c: FakeConn) => c.all('toast').map((m) => (m as { msg: string }).msg);

test('passage: a far run turns ×10 after 15 s of unbroken sailing, never before', () => {
  const sc = scene();
  const { game, s, c, ship } = sc;
  c.push({ t: 'autosail', x: sc.to.x, y: sc.to.y, sail: 4 });
  let way = -1;
  for (let i = 0; i < 40 * TICK_RATE; i++) {
    beat(game, s, c, i);
    game.step();
    if (way < 0 && ship.state.speed >= 1) way = i;
    if (way >= 0 && (i - way) / TICK_RATE < VOYAGE_SPIN - 0.1) assert.ok(!voyaging(ship), `not before ${VOYAGE_SPIN} s (${(i - way) / TICK_RATE} s)`);
    if (voyaging(ship)) break;
  }
  assert.ok(voyaging(ship), 'the passage began');
  assert.ok(autosailOf(ship), 'the helmsman keeps the run');
  const v = voyageOf(ship)!;
  assert.equal(v.v, voyageSpeed(ship));
  assert.equal(VOYAGE_MUL, 10);
  assert.equal(v.v, VOYAGE_MUL * ship.stats.maxSpeed * SPEED_SCALE, '×10 her top speed');
  const on = c.last('voyage') as { on: boolean; v: number; left: number; tail: number };
  assert.ok(on.on && on.left > VOYAGE_TAIL && on.tail === VOYAGE_TAIL, 'her screen told: the pill and its numbers');
  // ten seconds on: carried ×10 along the way
  const x0 = ship.state.x, y0 = ship.state.y, l0 = v.left;
  for (let i = 0; i < 2 * TICK_RATE; i++) game.step();
  const moved = l0 - voyageOf(ship)!.left;
  assert.ok(Math.abs(moved - v.v * 2) < v.v * 0.15, `2 s at ×10 (${Math.round(moved)} m of ${Math.round(v.v * 2)})`);
  assert.ok(Math.hypot(ship.state.x - x0, ship.state.y - y0) > ship.stats.maxSpeed * SPEED_SCALE * 2 * 3, 'far beyond her own way');
});

test('passage: a near mark never turns into one', () => {
  const sc = scene();
  const { game, s, c, ship } = sc;
  // a mark a short way along her own way out
  const p = plan(game, ship, sc.to.x, sc.to.y)!;
  const [ax, ay] = p[1];
  const d = Math.hypot(ax - ship.state.x, ay - ship.state.y);
  const k = Math.min(1, 1500 / d);
  c.push({ t: 'autosail', x: ship.state.x + (ax - ship.state.x) * k, y: ship.state.y + (ay - ship.state.y) * k, sail: 4 });
  for (let i = 0; i < 40 * TICK_RATE && autosailOf(ship); i++) {
    beat(game, s, c, i);
    game.step();
    assert.ok(!voyaging(ship), 'a near mark is sailed as ever');
  }
});

test('passage: her stop, her helm, a new mark, her guns and every order at sea are refused; a far run goes on', () => {
  const sc = scene();
  const { game, s, c, ship } = sc;
  assert.ok(spinUp(sc) >= 0, 'the passage began');
  const n0 = toasts(c).length;
  s.msgCount = 0;
  c.push({ t: 'autosail', stop: true } as never);
  c.push({ t: 'input', rudder: 1, sail: 0, seq: 99_001 } as never);
  c.push({ t: 'autosail', x: ship.state.x + 500, y: ship.state.y, sail: 2 });
  c.push({ t: 'goto', key: 'f' } as never);
  c.push({ t: 'fire', side: 'port' } as never);
  c.push({ t: 'dock' } as never);
  c.push({ t: 'land' } as never);
  for (let i = 0; i < 4; i++) game.step();
  assert.ok(voyaging(ship), 'still on her passage');
  assert.ok(autosailOf(ship), 'the run kept');
  assert.equal(ship.input.sailTarget, 1, 'full sail kept');
  const said = toasts(c).slice(n0);
  assert.ok(said.filter((m) => m === VOYAGE_BUSY).length >= 5, `refused, said why (${said.join(' | ')})`);
  assert.equal(fireBroadside(game, ship, 'port', 200), VOYAGE_BUSY, 'the guns are housed');
});

test('passage: nobody touches her — out of reach, a pirate by the way never engages', () => {
  const sc = scene();
  const { game, s, c, ship } = sc;
  assert.ok(spinUp(sc) >= 0, 'the passage began');
  assert.ok(untouchable(game, ship), 'out of the sea\'s reach');
  // a pirate lying by her way a few hundred metres ahead, hunting
  const v = voyageOf(ship)!;
  const [px, py] = v.path[Math.min(v.path.length - 1, 1)];
  const dx = px - ship.state.x, dy = py - ship.state.y, dl = Math.hypot(dx, dy) || 1;
  const ahead = Math.min(dl, v.v * 3);
  const pirate = game.spawnNpcShip('pirate', 'brig', 'free', ship.state.x + (dx / dl) * ahead - (dy / dl) * 220, ship.state.y + (dy / dl) * ahead + (dx / dl) * 220, 0);
  assert.equal(battleBlocked(game, pirate, ship), VOYAGE_WHY, 'his guns may not touch her');
  assert.equal(battleBlocked(game, ship, pirate), VOYAGE_BUSY, 'nor hers him');
  const hull = ship.hull, hit = ship.lastHitAt;
  let targeted = 0;
  for (let i = 0; i < 6 * TICK_RATE && voyaging(ship); i++) {
    beat(game, s, c, i);
    game.step();
    if (game.npcs.get(pirate.id)?.target === ship.id) targeted++;
    assert.ok(!ship.boarding && !ship.grappled, 'never boarded nor grappled');
  }
  assert.equal(targeted, 0, 'the pirate never took her for his prey');
  assert.equal(ship.hull, hull, 'not a ball on her');
  assert.equal(ship.lastHitAt, hit);
});

test('passage: it ends short of the mark, in water, her own way back — and the helmsman brings her in', () => {
  const sc = scene();
  const { game, s, c, ship } = sc;
  assert.ok(spinUp(sc) >= 0, 'the passage began');
  let i = 0;
  for (; i < 300 * TICK_RATE && voyaging(ship); i++) {
    beat(game, s, c, i);
    game.step();
  }
  assert.ok(!voyaging(ship), 'over');
  const off = c.all('voyage').filter((m) => !(m as { on: boolean }).on).at(-1) as { why: string } | undefined;
  assert.equal(off?.why, 'arrived');
  assert.ok(ship.state.speed <= ship.stats.maxSpeed, 'her own way again');
  assert.ok(autosailOf(ship), 'the helmsman on with the rest of the way');
  // the rest sailed as ever: at the harbour's mark
  for (let k = 0; k < 120 * TICK_RATE && autosailOf(ship); k++) {
    beat(game, s, c, k);
    game.step();
  }
  const stop = c.all('autosail').filter((m) => !(m as { on: boolean }).on).at(-1) as { why?: string } | undefined;
  assert.equal(stop?.why, 'arrived', 'arrived at the mark');
  assert.ok(Math.hypot(ship.state.x - sc.to.x, ship.state.y - sc.to.y) < 1200, 'by the harbour');
});

test('passage: no land under her hull on a long way round islands (every tick, her hull as drawn)', () => {
  const sc = scene();
  const { game, s, c, ship } = sc;
  assert.ok(spinUp(sc) >= 0, 'the passage began');
  const list: never[] = [];
  // the way itself, every 5 m of every leg, her hull laid along the leg (×10: 20–40 m a tick, so the ticks alone skip)
  const way = voyageOf(ship)!.path;
  let samples = 0;
  for (let k = 1; k < way.length; k++) {
    const [ax, ay] = way[k - 1], [bx, by] = way[k];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 5);
    const heading = Math.atan2(bx - ax, -(by - ay));
    for (let j = 0; j <= n; j++) {
      const x = ax + ((bx - ax) * j) / n, y = ay + ((by - ay) * j) / n;
      assert.ok(!isLand(game.world, x, y), `the way over land at ${Math.round(x)},${Math.round(y)}`);
      const cl = hullClearance({ x, y, heading }, ship.stats.length, ship.stats.beam, blockersNear(game.world, x, y, ship.stats.length + 40, list));
      assert.ok(cl > 0, `the way's leg ${k} over a blocker at ${Math.round(x)},${Math.round(y)} (${cl.toFixed(1)})`);
      samples++;
    }
  }
  assert.ok(samples > 1000, `${samples} points of the way sounded`);
  let ticks = 0, worst = Infinity;
  for (let i = 0; i < 300 * TICK_RATE && voyaging(ship); i++) {
    beat(game, s, c, i);
    game.step();
    const { x, y, heading } = ship.state;
    assert.ok(!isLand(game.world, x, y), `on land at ${Math.round(x)},${Math.round(y)}`);
    const near = blockersNear(game.world, x, y, ship.stats.length + 40, list);
    const cl = hullClearance({ x, y, heading }, ship.stats.length, ship.stats.beam, near);
    worst = Math.min(worst, cl);
    assert.ok(cl > 0, `her hull on a blocker at ${Math.round(x)},${Math.round(y)} (clearance ${cl.toFixed(1)})`);
    ticks++;
  }
  assert.ok(ticks > 3 * TICK_RATE, `a long passage (${ticks} ticks, ${Math.round(sc.len)} m planned, worst clearance ${worst.toFixed(1)} m)`);
});

test('passage: her line gone and her session retired mid-passage — she is put at its end, in water', () => {
  const sc = scene();
  const { game, ship } = sc;
  assert.ok(spinUp(sc) >= 0, 'the passage began');
  const v = voyageOf(ship)!;
  const end = v.path[v.path.length - 1];
  finishVoyage(game, ship);
  assert.ok(!voyaging(ship));
  const d = Math.hypot(end[0] - ship.state.x, end[1] - ship.state.y);
  assert.ok(d <= VOYAGE_TAIL + 5, `at its end (${Math.round(d)} m short)`);
  assert.ok(!isLand(game.world, ship.state.x, ship.state.y), 'in water');
});
