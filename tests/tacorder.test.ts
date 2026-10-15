// The turn on the hex field, owner 2026-10-15 («если нажать на рядом с целью пустую клетку, то я могу сперва подойти и
// еще действие останется для атаки. и сейчас у нас ход странно работает, один и тот же моб может два раза ударить. надо
// чтобы все четко по очереди били, а контр атака только после 1 удара по цели в этом ходу»):
// - every stack acts once a round in the order of initiative; another turn at once only by what explicitly gives one
//   (high morale's surge, an order), and it is told (the 'morale' / 'again' event);
// - a march, then the blow from what is left of the stride (the server keeps the turn: `stepped`, the view's `moved`);
//   no second march, no shot, no wait after it; the turn's clock covers the two; the sea's mind plays by the same rules;
// - a stack answers the first blow on it in a round, never the later ones that round, and has it back as the next opens.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { TAC_BLOCKING, TAC_TURN, TAC_W, hexDist, hexIndex, hexNeighbors } from '../shared/src/data/tactical.ts';
import type { ArmyStack, UnitId } from '../shared/src/data/army.ts';
import { act, aiAct, capOf, newBattle, quickFinish, reachOf, stackById, stepBattle, viewOf } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput, TacStack } from '../server/src/game/tacbattle.ts';
import { sidesAt } from './balance/boardlen.ts';

const side = (army: ArmyStack[], o: Partial<TacSideInput> = {}): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army,
  officers: [], skill: 3, morale: 50, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: true, ...o,
});
const of = (bt: TacBattle, s: 0 | 1, u: UnitId): TacStack => bt.stacks.find((x) => x.side === s && x.unit === u)!;
const open = (bt: TacBattle, h: number) => h >= 0 && !TAC_BLOCKING.has(bt.cells[h]) && bt.cells[h] !== 'F' && bt.cells[h] !== '#' && !bt.stacks.some((s) => s.count > 0 && s.hex === h);

/** `x` (side 0) to act, `y` (side 1) `gap` hexes off in the waist, the rest out of the way. */
function layout(bt: TacBattle, x: TacStack, y: TacStack, gap: number): void {
  for (const s of bt.stacks) if (s !== x && s !== y) s.hex = s.side ? hexIndex(TAC_W - 1, 0) : hexIndex(0, 8);
  for (let row = 2; row <= 6; row++) for (let c = 1; c + gap < TAC_W - 1; c++) {
    const a = hexIndex(c, row), b = hexIndex(c + gap, row);
    if (!open(bt, a) || !open(bt, b) || hexDist(a, b) !== gap) continue;
    x.hex = a;
    y.hex = b;
    bt.active = x.id;
    bt.queue = bt.queue.filter((id) => id !== x.id);
    return;
  }
  throw new Error('no room');
}

test('strict order: each stack takes one turn a round in the order of initiative; a second one at once only as told', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const [a, b] = sidesAt(20 + seed, false, 'corsair', 'corsair', seed);
    const rng = new Rng(seed);
    // the sea's mind on both sides
    const bt = newBattle({ ...a, human: false }, { ...b, human: false }, seed, 0, rng);
    let round = bt.round, seen = new Map<number, number>(), lastInit = Infinity, last: number | null = null;
    for (let i = 0; i < 3000 && !bt.over; i++) {
      if (bt.round !== round) {
        round = bt.round;
        seen = new Map();
        lastInit = Infinity;
      }
      const id = bt.active;
      if (id === null) break;
      if (id !== last) {
        const s = stackById(bt, id)!;
        const n0 = bt.events;
        const n = (seen.get(id) ?? 0) + 1;
        seen.set(id, n);
        // A second turn of the same stack in a round: it waited (back of the queue), or it was told another (the event).
        if (n > 1) {
          const told = bt.log.some((e) => e.s === id && (e.k === 'morale' || e.k === 'again' || e.k === 'wait') && e.i <= n0);
          assert.ok(told, `seed ${seed} round ${round}: stack ${id} acted twice untold`);
        } else if (!s.waited) {
          // first turns run down the initiative (a tie by the dice)
          const init = viewOf(bt, 0, 0, false).stacks.find((x) => x.id === id)!.init;
          assert.ok(init <= lastInit, `seed ${seed} round ${round}: initiative ${init} after ${lastInit}`);
          lastInit = init;
        }
      }
      last = id;
      aiAct(bt, 0, rng);
    }
    assert.ok(bt.over, `seed ${seed}: the fight ends`);
  }
});

test('march, then strike: the turn stays hers for the blow from what is left of her stride; no second march, shot or wait', () => {
  const rng = new Rng(3);
  const bt = newBattle(side([{ u: 'marine', n: 20 }, { u: 'musketeer', n: 12 }]), side([{ u: 'sailor', n: 30 }], { human: false }), 3, 0, rng, { len: 'board', level: 20 });
  const x = of(bt, 0, 'marine'), y = of(bt, 1, 'sailor');
  layout(bt, x, y, 3);
  const reach = reachOf(bt, x);
  const beside = hexNeighbors(y.hex).filter((h) => reach.has(h)).sort((p, q) => reach.get(p)! - reach.get(q)!)[0];
  assert.ok(beside !== undefined, 'a hex beside the foe in reach');
  const ends = bt.turnEnds;
  assert.equal(act(bt, 0, { a: 'move', to: beside }, 1, rng), null);
  assert.equal(x.hex, beside);
  assert.equal(bt.active, x.id, 'still her turn');
  assert.ok((x.stepped ?? 0) > 0);
  assert.ok(bt.turnEnds >= ends && bt.turnEnds - ends < 6, 'the clock runs on (the walk\'s play added)');
  const v = viewOf(bt, 0, 1, false);
  assert.equal(v.moved, true);
  assert.deepEqual(v.reach, [], 'no second march');
  assert.ok(v.melee.includes(y.id), 'the foe beside her to strike');
  assert.match(act(bt, 0, { a: 'move', to: x.hex === beside ? hexNeighbors(beside).find((h) => open(bt, h))! : beside }, 1, rng) ?? '', /marched/);
  assert.match(act(bt, 0, { a: 'wait' }, 1, rng) ?? '', /marched/);
  const n0 = bt.events;
  assert.equal(act(bt, 0, { a: 'attack', target: y.id }, 2, rng), null);
  assert.ok(bt.log.some((e) => e.i > n0 && e.k === 'hit' && e.s === x.id && e.t === y.id), 'her blow');
  assert.ok(!bt.log.some((e) => e.i > n0 && e.k === 'move' && e.s === x.id), 'struck from where she stands');
  assert.notEqual(bt.active, x.id, 'the turn is done');
  assert.ok(!x.stepped);
});

test('a march with no foe left in her stride ends the turn; a shooter who marches may not shoot after', () => {
  const rng = new Rng(4);
  const bt = newBattle(side([{ u: 'marine', n: 20 }, { u: 'musketeer', n: 12 }]), side([{ u: 'sailor', n: 30 }], { human: false }), 4, 0, rng, { len: 'board', level: 20 });
  const x = of(bt, 0, 'marine'), y = of(bt, 1, 'sailor');
  layout(bt, x, y, 7);
  const back = [...reachOf(bt, x)].filter(([h]) => hexDist(h, y.hex) > hexDist(x.hex, y.hex)).sort((p, q) => q[1] - p[1])[0][0];
  assert.equal(act(bt, 0, { a: 'move', to: back }, 1, rng), null);
  assert.notEqual(bt.active, x.id, 'nothing left to strike: her turn is over');
  // the musketeers: a march takes their shot this turn
  const g = of(bt, 0, 'musketeer');
  layout(bt, g, y, 8);
  const step = [...reachOf(bt, g)].find(([h, d]) => d === 1 && hexDist(h, y.hex) >= 2)![0];
  g.stepped = 1;
  g.hex = step;
  assert.deepEqual(viewOf(bt, 0, 1, false).shoot, [], 'no shot after a march');
  assert.match(act(bt, 0, { a: 'shoot', target: y.id }, 1, rng) ?? '', /marched/);
  assert.equal(act(bt, 0, { a: 'defend' }, 1, rng), null, 'a defence ends it');
});

test('the twenty seconds cover the march and the blow: run out after a march, the server defends and the turn passes', () => {
  const rng = new Rng(5);
  const bt = newBattle(side([{ u: 'marine', n: 20 }]), side([{ u: 'sailor', n: 30 }], { human: false }), 5, 0, rng, { len: 'board', level: 20 });
  const x = of(bt, 0, 'marine'), y = of(bt, 1, 'sailor');
  layout(bt, x, y, 3);
  bt.turnEnds = 10 + TAC_TURN;
  bt.clock = { side: 0, from: 10 };
  const beside = hexNeighbors(y.hex).find((h) => reachOf(bt, x).has(h))!;
  assert.equal(act(bt, 0, { a: 'move', to: beside }, 12, rng), null);
  assert.equal(bt.active, x.id);
  const ends = bt.turnEnds;
  assert.ok(ends < 10 + TAC_TURN + 6, 'one clock for the whole turn, not a new twenty');
  stepBattle(bt, ends - 0.1, rng);
  assert.equal(bt.active, x.id);
  stepBattle(bt, ends + 0.1, rng);
  assert.ok(bt.log.some((e) => e.k === 'timeout' && e.s === x.id));
  assert.ok(x.defending || bt.active !== x.id, 'she defends');
  assert.notEqual(bt.active, x.id);
});

test('an answer to the first blow on a stack in a round only; it is back as the next round opens', () => {
  const rng = new Rng(6);
  const bt = newBattle(side([{ u: 'marine', n: 30 }, { u: 'sailor', n: 30 }]), side([{ u: 'sailor', n: 60 }], { human: false }), 6, 0, rng);
  const x = of(bt, 0, 'marine'), x2 = of(bt, 0, 'sailor'), y = of(bt, 1, 'sailor');
  layout(bt, x, y, 1);
  x2.hex = hexNeighbors(y.hex).find((h) => open(bt, h))!;
  assert.equal(act(bt, 0, { a: 'attack', target: y.id }, 0, rng), null);
  assert.equal(bt.log.filter((e) => e.k === 'ret' && e.s === y.id).length, 1, 'the first blow answered');
  assert.equal(y.ret, false);
  // the preview of the second says so
  bt.active = x2.id;
  const pv = viewOf(bt, 0, 0, false).pv!.find((p) => p.t === y.id && !p.shot)!;
  assert.equal(pv.ret, undefined, 'the second blow is shown unanswered');
  assert.equal(act(bt, 0, { a: 'attack', target: y.id }, 0, rng), null);
  assert.equal(bt.log.filter((e) => e.k === 'ret' && e.s === y.id).length, 1, 'the second goes unanswered');
  // the next round gives it back
  for (let i = 0; i < 50 && bt.round < 2 && !bt.over; i++) {
    const s = stackById(bt, bt.active!)!;
    act(bt, s.side, { a: 'defend' }, 0, rng);
  }
  assert.equal(bt.round, 2);
  assert.equal(y.ret, true, 'her answer back');
});

test('the sea\'s mind and the auto-battle play by the same rules: a march at most once a turn, then a blow or a defence', () => {
  let kept = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const [a, b] = sidesAt(15 + seed * 3, seed % 2 === 0, 'reaver', 'navigator', seed);
    const rng = new Rng(seed * 11);
    const bt = newBattle(a, b, seed, 0, rng, { len: 'board', level: 15 + seed * 3 });
    for (const h of bt.heroes) h.auto = true;
    let t = 0, turn: number | null = null, marches = 0;
    for (let i = 0; i < 6000 && !bt.over; i++) {
      if (bt.active !== turn) {
        turn = bt.active;
        marches = 0;
      }
      const n0 = bt.events;
      stepBattle(bt, (t = Math.max(t, bt.aiAt) + 0.01), rng);
      const ev = bt.log.filter((e) => e.i > n0);
      // a march that kept the turn (the same stack still on it with no new turn told)
      if (bt.active === turn && ev.some((e) => e.k === 'move' && e.s === turn) && !ev.some((e) => e.k === 'morale' || e.k === 'again' || e.k === 'round' || e.k === 'defend' || e.k === 'hit' || e.k === 'shot')) {
        marches++;
        kept++;
        assert.ok(marches <= 1, `seed ${seed}: one march a turn`);
        const s = stackById(bt, turn!)!;
        assert.ok(s.stepped, 'the server knows she marched');
      }
    }
    assert.ok(bt.over, `seed ${seed}: the fight ends`);
    void capOf;
  }
  void kept;
  // Marched with a foe beside her, the auto-battle strikes (or defends) — never a second march.
  {
    const rng = new Rng(9);
    const bt = newBattle(side([{ u: 'marine', n: 20 }]), side([{ u: 'sailor', n: 30 }], { human: false }), 9, 0, rng, { len: 'board', level: 20 });
    const x = of(bt, 0, 'marine'), y = of(bt, 1, 'sailor');
    layout(bt, x, y, 3);
    const reach = reachOf(bt, x);
    const beside = hexNeighbors(y.hex).filter((h) => reach.has(h)).sort((p, q) => reach.get(p)! - reach.get(q)!)[0];
    assert.equal(act(bt, 0, { a: 'move', to: beside }, 1, rng), null);
    assert.equal(bt.active, x.id);
    bt.heroes[0].auto = true;
    const n0 = bt.events;
    aiAct(bt, 2, rng);
    const ev = bt.log.filter((e) => e.i > n0 && e.s === x.id);
    assert.ok(ev.some((e) => e.k === 'hit' || e.k === 'defend'), `the auto-battle: ${ev.map((e) => e.k)}`);
    assert.ok(!ev.some((e) => e.k === 'move'), 'no second march');
    assert.notEqual(bt.active, x.id);
  }
  // and the quick fight still ends every fight
  const [a, b] = sidesAt(30, false, 'corsair', 'corsair', 2);
  const rng = new Rng(2);
  const bt = newBattle(a, b, 2, 0, rng);
  quickFinish(bt, 0, rng);
  assert.ok(bt.over);
});

test('PvP: the other captain marches and strikes in one turn too; each side\'s clock runs it', () => {
  const rng = new Rng(8);
  const bt = newBattle(side([{ u: 'marine', n: 20 }]), side([{ u: 'marine', n: 20 }]), 8, 0, rng, { len: 'board', level: 30 });
  const y = of(bt, 1, 'marine'), x = of(bt, 0, 'marine');
  // side 1 to act, side 0's stack three hexes off
  layout(bt, x, y, 3);
  bt.active = y.id;
  bt.queue = [x.id];
  const beside = hexNeighbors(x.hex).find((h) => reachOf(bt, y).has(h))!;
  assert.equal(act(bt, 0, { a: 'move', to: beside }, 1, rng), 'Not your turn');
  assert.equal(act(bt, 1, { a: 'move', to: beside }, 1, rng), null);
  assert.equal(bt.active, y.id);
  assert.equal(viewOf(bt, 1, 1, false).moved, true);
  assert.equal(viewOf(bt, 0, 1, false).moved, undefined, 'her own screen only');
  assert.equal(act(bt, 1, { a: 'attack', target: x.id }, 2, rng), null);
  assert.notEqual(bt.active, y.id);
});
