// The 20 seconds to choose (owner, 2026-10-15: «доработай абордаж … тап и выбор действия … Выбор на действие 20 секунд
// отводи, это и в пвп надо учесть тоже»): every captain's turn on the hex field runs TAC_TURN seconds at every level,
// against the sea and a captain alike; run out, the server defends with her stack; both captains of a boarding see
// the turn's clock (the view's `ends` and `now`); the clock is real seconds under an admin /speed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec } from '../shared/src/math.ts';
import { Rng } from '../shared/src/rng.ts';
import { TAC_FILM_HOLD } from '../server/src/game/tacbattle.ts';
import { TAC_TURN, tacTurnSecs } from '../shared/src/data/tactical.ts';
import { act, aiAct, capOf, newBattle, stackById, stepBattle, viewOf } from '../server/src/game/tacbattle.ts';
import type { TacBattle } from '../server/src/game/tacbattle.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { TacView } from '../shared/src/protocol.ts';
import { canBoard } from '../server/src/game/boarding.ts';
import { join, makeGame } from './helpers.ts';
import type { FakeConn } from './helpers.ts';
import { sidesAt } from './balance/boardlen.ts';

/** Played by the sea's mind on the sea's side (and on hers as `skip` says) till a turn of hers (side `side`) runs. */
function toTurnOf(bt: TacBattle, side: 0 | 1, rng: Rng, t: number): number {
  for (let i = 0; i < 400 && !bt.over; i++) {
    const s = bt.active !== null ? stackById(bt, bt.active) : undefined;
    if (s && s.side === side && !capOf(bt, s).auto) return t;
    if (s && !capOf(bt, s).auto) act(bt, s.side, { a: 'defend' }, (t += 1), rng, s.own ?? 0);
    else stepBattle(bt, (t = Math.max(t, bt.aiAt) + 0.01), rng);
  }
  return t;
}

test('TAC_TURN: twenty seconds a stack at every level, against the sea and a captain alike', () => {
  assert.equal(TAC_TURN, 20);
  for (const L of [0, 1, 5, 10, 11, 25, 30, 31, 45, 60]) assert.equal(tacTurnSecs(L), 20, `level ${L}`);
  for (const [L, pvp] of [[5, false], [5, true], [25, false], [25, true], [55, false], [55, true]] as const) {
    const [a, b] = sidesAt(L, pvp, 'corsair', 'admiral', 3);
    const rng = new Rng(L + (pvp ? 100 : 0));
    const bt = newBattle(a, b, 3, 0, rng, { len: 'board', level: L });
    const t = toTurnOf(bt, 0, rng, 0);
    assert.ok(!bt.over && bt.clock, `L${L}${pvp ? ' pvp' : ''}: her turn runs on her clock`);
    // Her turn starts once what came before it is played: from then, TAC_TURN (her chess clock holds more than that).
    assert.ok(bt.heroes[0].bank >= TAC_TURN, `L${L}: a chess clock of ${bt.heroes[0].bank} s`);
    assert.ok(Math.abs(bt.turnEnds - bt.clock!.from - TAC_TURN) < 1e-9, `L${L}${pvp ? ' pvp' : ''}: ${bt.turnEnds - bt.clock!.from} s`);
    void t;
  }
  // A fight ashore keeps no chess clock: the same twenty seconds.
  const [a, b] = sidesAt(20, false, 'reaver', 'reaver', 4);
  const rng = new Rng(9);
  const land = newBattle(a, b, 4, 0, rng, { land: 'sandy' });
  const t = toTurnOf(land, 0, rng, 0);
  assert.ok(!land.over);
  assert.ok(land.turnEnds - t <= TAC_TURN + 15 && land.turnEnds - t >= TAC_TURN - 1e-9, `ashore: ${land.turnEnds - t} s`);
});

test('run out, the server defends with her stack (the timeout\'s default), never sooner', () => {
  const [a, b] = sidesAt(30, false, 'corsair', 'corsair', 5);
  const rng = new Rng(5);
  const bt = newBattle(a, b, 5, 0, rng, { len: 'board', level: 30 });
  toTurnOf(bt, 0, rng, 0);
  const mine = stackById(bt, bt.active!)!;
  const ends = bt.turnEnds;
  stepBattle(bt, ends - 0.05, rng);
  assert.equal(bt.active, mine.id, 'a twentieth of a second left: still hers');
  assert.ok(!bt.log.some((e) => e.k === 'timeout'));
  stepBattle(bt, ends + 0.05, rng);
  const out = bt.log.filter((e) => e.k === 'timeout');
  assert.equal(out.length, 1);
  assert.equal(out[0].s, mine.id);
  assert.ok(bt.log.some((e) => e.k === 'defend' && e.s === mine.id), 'the default is «Защита»');
  assert.ok(mine.defending || bt.active === mine.id, 'it stands in defence');
});

test('PvP: each captain\'s stacks run out on their own twenty seconds, and each sees the other\'s clock', () => {
  const [a, b] = sidesAt(40, true, 'reaver', 'drowned', 6);
  const rng = new Rng(6);
  const bt = newBattle(a, b, 6, 0, rng, { len: 'board', level: 40 });
  assert.ok(!bt.heroes[0].auto && !bt.heroes[1].auto, 'two captains at the helm');
  let t = 0, timeouts: [number, number] = [0, 0];
  for (let i = 0; i < 40 && !bt.over && (timeouts[0] < 2 || timeouts[1] < 2); i++) {
    const s = stackById(bt, bt.active!)!;
    const v0 = viewOf(bt, 0, t, true), v1 = viewOf(bt, 1, t, true);
    // Both screens count the same turn down: hers and the other's.
    assert.equal(v0.ends, v1.ends);
    assert.equal(v0.now, t);
    assert.equal(v0.mine, s.side === 0);
    assert.equal(v1.mine, s.side === 1);
    assert.equal(v0.turn, TAC_TURN);
    assert.ok(v0.ends - t <= TAC_TURN + 15, 'the clock shown is the turn\'s own');
    // Nobody acts: the server's clock runs her turn out.
    const n0 = bt.events;
    t = bt.turnEnds + 0.05;
    stepBattle(bt, t, rng);
    const out = bt.log.filter((e) => e.i > n0 && e.k === 'timeout');
    assert.equal(out.length, 1, 'one turn run out');
    assert.equal(out[0].side, s.side);
    timeouts[s.side]++;
  }
  assert.ok(timeouts[0] >= 2 && timeouts[1] >= 2, `both sides ran out: ${timeouts}`);
});

test('the film holds the clock once a side, the book never (the screen sends nothing for it)', () => {
  const [a, b] = sidesAt(30, true, 'reaver', 'drowned', 7);
  const rng = new Rng(7);
  const bt = newBattle(a, b, 7, 0, rng, { len: 'board', level: 30 });
  toTurnOf(bt, 0, rng, 0);
  const ends = bt.turnEnds;
  assert.equal(act(bt, 1, { a: 'film', ms: 60_000 }, 1, rng), null);
  assert.equal(bt.turnEnds, ends + TAC_FILM_HOLD / 1000, 'the other side\'s film holds her clock at most TAC_FILM_HOLD');
  assert.equal(act(bt, 1, { a: 'film', ms: 6000 }, 1, rng), null);
  assert.equal(bt.turnEnds, ends + TAC_FILM_HOLD / 1000, 'once a side');
  void aiAct;
});

// ------------------------------------------------------------------ on the ships

function atSea(game: Game, name: string, path: 'reaver' | 'admiral', dx: number): { c: FakeConn; ship: ShipEntity; s: PlayerSession } {
  const c = join(game, name, path);
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  Object.assign(ship.state, { x: 30000 + dx, y: 80000, heading: 0, speed: 0 });
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  s.profile!.level = 30;
  ship.loadout.classId = 'brig';
  ship.recompute(game.now);
  ship.crew = ship.stats.crewMax;
  ship.morale = 80;
  ship.region = 'gravewater';
  ship.lastCombat = -1000;
  s.profile!.pvp.flag = 'pirate';
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, ship, s };
}

function pvp(): { game: Game; A: ReturnType<typeof atSea>; D: ReturnType<typeof atSea>; bt: TacBattle } {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const A = atSea(game, 'Ari', 'reaver', 0), D = atSea(game, 'Dee', 'admiral', 30);
  const v = headingVec(A.ship.state.heading - Math.PI / 2);
  D.ship.state.x = A.ship.state.x + v.x * 18;
  D.ship.state.y = A.ship.state.y + v.y * 18;
  game.grid.upsert(D.ship.id, D.ship.state.x, D.ship.state.y);
  assert.equal(canBoard(game, A.ship, D.ship), null);
  A.c.push({ t: 'board', target: D.ship.id, aggression: 'standard', risk: true });
  const bt = A.ship.boarding?.fight.tac;
  assert.ok(bt, 'the hex battle between two captains');
  return { game, A, D, bt };
}

const lastView = (c: FakeConn): TacView | null | undefined => c.last('board_tac')?.view;

test('PvP on the ships: both captains are sent the turn\'s clock; nobody choosing, the server defends for each in turn', () => {
  const { game, A, D, bt } = pvp();
  assert.ok(!bt.heroes[0].auto && !bt.heroes[1].auto);
  const seen: [number, number] = [0, 0];
  for (let i = 0; i < 20 * 400 && !bt.over && (seen[0] < 1 || seen[1] < 1); i++) {
    const n0 = bt.events;
    game.step();
    for (const e of bt.log) if (e.i > n0 && e.k === 'timeout') seen[e.side]++;
    if (bt.active === null || bt.over) continue;
    const va = lastView(A.c), vd = lastView(D.c);
    if (!va || !vd) continue;
    // The same turn's end on both screens, and the battle's clock beside it.
    if (va.seq === bt.seq && vd.seq === bt.seq) {
      assert.equal(va.ends, vd.ends);
      assert.ok(va.now !== undefined && va.now <= game.tacNow() + 1e-9);
      assert.ok(va.mine !== vd.mine || (!va.mine && !vd.mine));
    }
  }
  assert.ok(seen[0] >= 1 && seen[1] >= 1, `both captains ran out once: ${seen}`);
  assert.ok(bt.log.filter((e) => e.k === 'timeout').every((e) => bt.log.some((d) => d.k === 'defend' && d.s === e.s && d.i > e.i)), 'each run-out turn defends');
});

test('the twenty seconds are real ones under an admin /speed (the battle\'s own clock)', () => {
  const { game, A, bt } = pvp();
  // ×1: the battle's clock is the world's.
  for (let i = 0; i < 10; i++) game.step();
  assert.equal(game.tacNow(), game.now);
  // ×10: twenty world seconds are two real ones.
  game.timeScale = 10;
  const w0 = game.now, b0 = game.tacNow();
  for (let i = 0; i < 400; i++) game.step();
  assert.ok(Math.abs(game.now - w0 - 20) < 1e-6);
  assert.ok(Math.abs(game.tacNow() - b0 - 2) < 1e-6, `${game.tacNow() - b0} s on the battle's clock`);
  // A turn of hers waits its twenty real seconds: two hundred world seconds at ×10.
  for (let i = 0; i < 20 * 400 && !bt.over; i++) {
    const s = bt.active !== null ? stackById(bt, bt.active) : undefined;
    if (s && s.side === 0 && bt.turnEnds > game.tacNow() + TAC_TURN - 0.5) break;
    game.step();
  }
  const s = stackById(bt, bt.active!)!;
  assert.equal(s.side, 0);
  const w1 = game.now;
  const n0 = bt.events;
  for (let i = 0; i < 20 * 300 && !bt.log.some((e) => e.i > n0 && e.k === 'timeout'); i++) game.step();
  const world = game.now - w1;
  assert.ok(world >= (TAC_TURN - 0.6) * 10 && world <= (TAC_TURN + 0.6) * 10, `ran out after ${world.toFixed(1)} world seconds (≈${(world / 10).toFixed(1)} real)`);
  // Her screen counts it by the battle's clock, sent with the view.
  const v = lastView(A.c);
  assert.ok(v && v.now !== undefined && Math.abs(v.now - game.tacNow()) < 30);
  game.timeScale = 1;
});
