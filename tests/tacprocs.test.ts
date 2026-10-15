// Owner, 2026-10-15 («если есть еще какието плюшки то надо еще показываать их эффектами не только текстом»): every blow
// carries on its event what it brought beyond its harm (TacEvent.fx) — her second blow, a blow none answers by an
// ability, the answer of one who answers all, a sweep's, a bite that poisons, binds or chills — so the field draws it
// (client/src/ui/tacprocs.ts); the luck, the extra turn, the fear, the mending, the draught and the defence keep their
// own events. The client's effects: one per kind, short, capped, still under reduced motion.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { TAC_BLOCKING, TAC_W, hexIndex, hexNeighbors } from '../shared/src/data/tactical.ts';
import type { ArmyStack, UnitId } from '../shared/src/data/army.ts';
import { act, newBattle } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput, TacStack } from '../server/src/game/tacbattle.ts';
import { PROC_CAP, PROC_MS } from '../client/src/ui/tacprocs.ts';

const side = (army: ArmyStack[], o: Partial<TacSideInput> = {}): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army,
  officers: [], skill: 3, morale: 50, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...o,
});
const of = (bt: TacBattle, s: 0 | 1, u: UnitId): TacStack => bt.stacks.find((x) => x.side === s && x.unit === u)!;
const free = (bt: TacBattle, hex: number, but: number[] = []): number => hexNeighbors(hex).find((h) => !TAC_BLOCKING.has(bt.cells[h]) && bt.cells[h] !== 'F' && bt.cells[h] !== '#' && !but.includes(h) && !bt.stacks.some((s) => s.count > 0 && s.hex === h))!;

function faceOff(bt: TacBattle, x: TacStack, y: TacStack): void {
  for (const s of bt.stacks) if (s !== x && s !== y) s.hex = s.side ? hexIndex(TAC_W - 1, 0) : hexIndex(0, 8);
  x.hex = !TAC_BLOCKING.has(bt.cells[hexIndex(3, 4)]) ? hexIndex(3, 4) : hexIndex(3, 6);
  y.hex = free(bt, x.hex);
  bt.active = x.id;
}
function strike(a: ArmyStack[], b: ArmyStack[], seed = 1): { bt: TacBattle; x: TacStack; y: TacStack; rng: Rng } {
  const rng = new Rng(seed);
  const bt = newBattle(side(a), side(b), seed, 0, rng);
  const x = of(bt, 0, a[0].u), y = of(bt, 1, b[0].u);
  faceOff(bt, x, y);
  assert.equal(act(bt, 0, { a: 'attack', target: y.id }, 0, rng), null);
  return { bt, x, y, rng };
}

test('fx: her second blow, a blow none answers, the answer to every blow, a sweep\'s', () => {
  {
    const { bt, x } = strike([{ u: 'boarder', n: 10 }], [{ u: 'deckhand', n: 60 }]);
    const hits = bt.log.filter((e) => e.k === 'hit' && e.s === x.id);
    assert.equal(hits.length, 2);
    assert.equal(hits[0].fx, undefined, 'the first a plain blow');
    assert.deepEqual(hits[1].fx, ['twice'], 'the second told');
  }
  {
    const { bt, x } = strike([{ u: 'cutthroat', n: 10 }], [{ u: 'deckhand', n: 200 }]);
    assert.deepEqual(bt.log.find((e) => e.k === 'hit' && e.s === x.id)!.fx, ['noret']);
  }
  {
    const rng = new Rng(3);
    const bt = newBattle(side([{ u: 'marine', n: 30 }, { u: 'sailor', n: 30 }]), side([{ u: 'life_guard', n: 20 }]), 3, 0, rng);
    const x = of(bt, 0, 'marine'), x2 = of(bt, 0, 'sailor'), y = of(bt, 1, 'life_guard');
    faceOff(bt, x, y);
    x2.hex = free(bt, y.hex, [x.hex]);
    act(bt, 0, { a: 'attack', target: y.id }, 0, rng);
    bt.active = x2.id;
    act(bt, 0, { a: 'attack', target: y.id }, 0, rng);
    const rets = bt.log.filter((e) => e.k === 'ret' && e.s === y.id);
    assert.equal(rets.length, 2);
    assert.ok(rets.every((e) => e.fx?.includes('all')), 'each answer of hers told');
  }
  {
    const rng = new Rng(4);
    const bt = newBattle(side([{ u: 'deep_spawn', n: 8 }]), side([{ u: 'deckhand', n: 50 }, { u: 'sailor', n: 50 }]), 4, 0, rng);
    const x = of(bt, 0, 'deep_spawn'), y = of(bt, 1, 'deckhand'), y2 = of(bt, 1, 'sailor');
    faceOff(bt, x, y);
    y2.hex = free(bt, x.hex, [y.hex]);
    act(bt, 0, { a: 'attack', target: y.id }, 0, rng);
    const hits = bt.log.filter((e) => e.k === 'hit' && e.s === x.id);
    assert.ok(hits.length >= 2 && hits.every((e) => e.fx?.includes('sweep')), 'every blow of the sweep told');
  }
  {
    // a plain blow carries nothing
    const { bt, x } = strike([{ u: 'marine', n: 20 }], [{ u: 'sailor', n: 40 }]);
    assert.equal(bt.log.find((e) => e.k === 'hit' && e.s === x.id)!.fx, undefined);
  }
});

test('fx: a bite that poisons, binds; a drinker\'s draught keeps its own event', () => {
  let bind = 0, poison = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const { bt, x } = strike([{ u: 'jungle_spider', n: 20 }], [{ u: 'sailor', n: 200 }], seed);
    const hit = bt.log.find((e) => e.k === 'hit' && e.s === x.id)!;
    if (hit.fx?.includes('poison')) poison++;
    if (hit.fx?.includes('bind')) bind++;
  }
  assert.equal(poison, 20, 'every bite poisons');
  assert.ok(bind > 0 && bind < 20, `a bite binds now and then (${bind} of 20)`);
});

test('the field\'s effects: short, one look each, capped', () => {
  for (const [k, ms] of Object.entries(PROC_MS)) assert.ok(ms >= 600 && ms <= 1200, `${k}: ${ms} ms`);
  assert.ok(PROC_CAP <= 32);
  for (const k of ['again', 'fear', 'still', 'mad', 'luck', 'heal', 'drain', 'shield', 'noret', 'all', 'twice', 'sweep', 'chill', 'poison', 'resist']) assert.ok(k in PROC_MS, k);
});
