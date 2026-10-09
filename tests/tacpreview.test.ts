// The hex battle's preview, flanks and pace (owner, 2026-10-08: «при наведении во время хода чем-то надо, чтобы
// показывалось, сколько я убью и какой урон нанесу. сам бой должен быть плавнее… также удары сзади должны наносить
// больше урона»): the preview is the battle's own blow on a copy of it, so over many rolls the real blow, its fallen
// and the answer's fall inside what it showed (luck aside); a blow into a side lands 15% harder and from behind 30%,
// the answer the same from anywhere; the stacks face the way they last went; the screens' clock is one schedule.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { TAC_AI_DELAY, TAC_FLANK, TAC_PACE, flankOf, hexDir, hexIndex, hexNeighbors, tacSchedule, walkSecs } from '../shared/src/data/tactical.ts';
import { act, aiAct, blowParts, newBattle, previewsOf, reachOf, stackById, stepBattle, viewOf } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput, TacStack } from '../server/src/game/tacbattle.ts';
import type { TacPreview } from '../shared/src/protocol.ts';

const side = (army: ArmyStack[], o: Partial<TacSideInput> = {}): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army,
  officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...o,
});

const ARMIES: ArmyStack[][] = [
  [{ u: 'deckhand', n: 40 }, { u: 'marine', n: 12 }, { u: 'musketeer', n: 10 }],
  [{ u: 'sailor', n: 9 }, { u: 'marine', n: 7 }, { u: 'gunner', n: 4 }],
  [{ u: 'boarder', n: 6 }, { u: 'deckhand', n: 120 }, { u: 'musketeer', n: 30 }],
  [{ u: 'marine', n: 30 }, { u: 'guard', n: 4 }, { u: 'sharpshooter', n: 8 }, { u: 'sailor', n: 25 }],
];

/** The real blow (or shot) from a copy of the battle on dice of its own: her first blow on `t`, and the answer. */
function realExchange(bt: TacBattle, s: TacStack, p: TacPreview, seed: number) {
  const c = structuredClone(bt);
  const n0 = c.events;
  const why = act(c, s.side, p.shot ? { a: 'shoot', target: p.t } : { a: 'attack', target: p.t, from: p.from }, 0, new Rng(seed));
  assert.equal(why, null, `the order went through: ${why}`);
  const ev = c.log.filter((e) => e.i > n0);
  const first = ev.findIndex((e) => (e.k === 'hit' || e.k === 'shot') && e.s === s.id && e.t === p.t && !e.id);
  assert.ok(first >= 0, 'her blow');
  // A luck event of hers before her blow doubles it.
  const lucky = ev.slice(0, first).some((e) => e.k === 'luck' && e.s === s.id);
  const ri = ev.findIndex((e) => e.k === 'ret' && e.s === p.t);
  const retLucky = ri >= 0 && ev.slice(first + 1, ri).some((e) => e.k === 'luck' && e.s === p.t);
  return { hit: ev[first], lucky, ret: ri >= 0 ? ev[ri] : null, retLucky };
}

test('the preview holds the real blow: its harm, its fallen and the answer\'s, over many seeded rolls (luck aside)', () => {
  let checked = 0, answers = 0, lucky = 0, flanks = 0;
  for (let b = 0; b < 28; b++) {
    const a = ARMIES[b % ARMIES.length], o = ARMIES[(b * 3 + 1) % ARMIES.length];
    const bt = newBattle(side(a), side(o, { morale: 40 + b * 3 }), 100 + b, 0, new Rng(100 + b));
    const rng = new Rng(500 + b);
    // Into the fight a few turns, so the decks are closed and stacks are hurt and turned.
    for (let k = 0; k < 4 + (b % 9) && !bt.over; k++) aiAct(bt, 0, rng);
    for (let turn = 0; turn < 6 && !bt.over; turn++) {
      const s = stackById(bt, bt.active ?? -1);
      if (!s) break;
      const pvs = previewsOf(bt, s, reachOf(bt, s));
      for (const p of pvs.slice(0, 8)) {
        assert.ok(p.dmg[0] <= p.dmg[1] && p.kills[0] <= p.kills[1], 'a range');
        if (p.fl) flanks++;
        for (let r = 0; r < 12; r++) {
          const x = realExchange(bt, s, p, 7000 + b * 997 + turn * 31 + r);
          checked++;
          if (x.lucky) {
            lucky++;
            assert.ok(x.hit.dmg! >= p.dmg[0] * 2 - 1 && x.hit.dmg! <= p.dmg[1] * 2 + 1, `a lucky blow is twice: ${x.hit.dmg} against ${p.dmg}`);
            continue;
          }
          assert.ok(x.hit.dmg! >= p.dmg[0] && x.hit.dmg! <= p.dmg[1], `harm ${x.hit.dmg} within ${p.dmg} (${JSON.stringify(p)})`);
          assert.ok(x.hit.kills! >= p.kills[0] && x.hit.kills! <= p.kills[1], `fallen ${x.hit.kills} within ${p.kills}`);
          assert.equal(x.hit.fl ?? 0, p.fl, 'the same side of her');
          if (!p.ret) assert.equal(x.ret, null, 'no answer, as shown');
          else if (x.ret && !x.retLucky) {
            answers++;
            assert.ok(x.ret.kills! >= p.ret[0] && x.ret.kills! <= p.ret[1], `the answer felled ${x.ret.kills}, shown ${p.ret} (${JSON.stringify(p)})`);
          }
        }
      }
      aiAct(bt, 0, rng);
    }
  }
  assert.ok(checked > 1500, `${checked} blows checked`);
  assert.ok(answers > 300, `${answers} answers checked`);
  assert.ok(lucky > 0 && flanks > 0, `luck ${lucky}, flanks ${flanks}`);
});

test('the view carries the previews to the captain whose turn it is, and to no one else', () => {
  const bt = newBattle(side(ARMIES[0], { human: true }), side(ARMIES[1]), 3, 0, new Rng(3));
  const rng = new Rng(3);
  // Her turns played by the sea's mind until a stack of hers has a foe in reach or in shot.
  for (let i = 0; i < 200 && !bt.over; i++) {
    const s = stackById(bt, bt.active!)!;
    if (s.side === 0 && previewsOf(bt, s).length) break;
    if (s.side === 0) bt.heroes[0].auto = true;
    aiAct(bt, 0, rng);
    bt.heroes[0].auto = false;
  }
  const mine = viewOf(bt, 0, 0, false), theirs = viewOf(bt, 1, 0, false);
  assert.ok(mine.mine && (mine.pv?.length ?? 0) > 0, 'her previews');
  assert.equal(theirs.pv, undefined);
  for (const p of mine.pv!) assert.ok(mine.shoot.includes(p.t) || mine.melee.includes(p.t), 'only on foes she may strike or shoot');
});

test('a blow into a stack\'s side lands 15% harder, from behind 30%; the answer the same from anywhere', () => {
  assert.deepEqual([...TAC_FLANK], [1, 1.15, 1.3]);
  // The six ways round a hex: east 0 … north-east 5.
  const c = hexIndex(4, 4);
  const ways = hexNeighbors(c).map((n) => hexDir(c, n)).sort();
  assert.deepEqual(ways, [0, 1, 2, 3, 4, 5]);
  assert.equal(hexDir(c, hexIndex(5, 4)), 0);
  assert.equal(hexDir(c, hexIndex(3, 4)), 3);
  // Facing east: the front three, the two sides, the back.
  const by = (d: number) => hexNeighbors(c).find((n) => hexDir(c, n) === d)!;
  assert.deepEqual([0, 1, 5].map((d) => flankOf(0, c, by(d))), [0, 0, 0]);
  assert.deepEqual([2, 4].map((d) => flankOf(0, c, by(d))), [1, 1]);
  assert.equal(flankOf(0, c, by(3)), 2);
  // On a field: her marines struck from the front, the side and the back.
  const bt = newBattle(side([{ u: 'marine', n: 20 }]), side([{ u: 'marine', n: 20 }]), 5, 0, new Rng(5));
  const a = bt.stacks.find((s) => s.side === 0)!, t = bt.stacks.find((s) => s.side === 1)!;
  t.hex = c;
  t.face = 3; // she faces west, toward the boarders' deck
  const front = blowParts(bt, a, t, 'melee', by(3)), flankP = blowParts(bt, a, t, 'melee', by(1)), back = blowParts(bt, a, t, 'melee', by(0));
  assert.equal(front.flank, 0);
  assert.equal(flankP.flank, 1);
  assert.equal(back.flank, 2);
  assert.ok(Math.abs(flankP.mul / front.mul - 1.15) < 1e-9 && Math.abs(back.mul / front.mul - 1.3) < 1e-9, `${front.mul} ${flankP.mul} ${back.mul}`);
  // Her answer: the same whichever way she faces.
  a.hex = by(0);
  const r0 = blowParts(bt, t, a, 'ret');
  t.face = 0;
  const r1 = blowParts(bt, t, a, 'ret');
  assert.equal(r0.mul, r1.mul);
  assert.equal(r0.flank, 0);
});

test('the stacks face the other deck as they come aboard, then the way they last walked, struck or fired', () => {
  const bt = newBattle(side(ARMIES[0], { human: true }), side(ARMIES[1], { human: true }), 9, 0, new Rng(9));
  for (const s of bt.stacks) assert.equal(s.face, s.side ? 3 : 0);
  const s = stackById(bt, bt.active!)!;
  const reach = reachOf(bt, s);
  // A hex up the deck she can walk to.
  const to = [...reach.keys()].find((h) => Math.floor(h / 11) < Math.floor(s.hex / 11));
  if (to !== undefined) {
    const was = s.hex;
    assert.equal(act(bt, s.side, { a: 'move', to }, 0, new Rng(1)), null);
    assert.equal(s.face, hexDir(was, to));
    const mv = bt.log.findLast((e) => e.k === 'move')!;
    assert.equal(mv.n, reach.get(to), 'the walk\'s steps told to the screens');
  }
});

test('the field\'s pace: a walk 0.35–0.5 s a hex, a blow lunges, lands and its answer is a beat of its own; ×2 halves it; the sea waits for it', () => {
  assert.ok(TAC_PACE.hex >= 0.35 && TAC_PACE.hex <= 0.5);
  // docs/25 item 50: the sea's breath 0.35 s (it was 0.7); the field's pace is the same.
  assert.ok(TAC_AI_DELAY >= 0.3 && TAC_AI_DELAY <= 0.4);
  assert.equal(walkSecs(3), 3 * TAC_PACE.hex);
  assert.equal(walkSecs(3, false, 2), 1.5 * TAC_PACE.hex);
  const ev = [{ k: 'move', n: 2 }, { k: 'luck' }, { k: 'hit' }, { k: 'ret' }];
  const { beats, total } = tacSchedule(ev);
  assert.equal(beats[0].dur, 2 * TAC_PACE.hex);
  assert.ok(beats[2].at >= beats[0].at + beats[0].dur, 'the blow after the walk');
  assert.ok(beats[2].impact > beats[2].at, 'a lunge before it lands');
  assert.equal(beats[1].impact, beats[2].impact, 'luck told as the blow lands');
  assert.ok(beats[3].at >= beats[2].at + beats[2].dur && beats[3].impact - beats[3].at >= TAC_PACE.answer, 'the answer a beat of its own, after a breath');
  assert.ok(Math.abs(tacSchedule(ev, 2).total - total / 2) < 1e-9, '×2 halves it');
  // The server: the sea's next turn waits for what was played, then its breath.
  const bt = newBattle(side(ARMIES[1]), side(ARMIES[1]), 4, 0, new Rng(4));
  const rng = new Rng(4);
  let t = 0;
  for (let i = 0; i < 30 && !bt.over; i++) {
    const at = bt.aiAt;
    t = at + 0.001;
    const n0 = bt.events;
    stepBattle(bt, t, rng);
    const played = tacSchedule(bt.log.filter((e) => e.i > n0)).total;
    if (!bt.over) assert.ok(Math.abs(bt.aiAt - (t + played + TAC_AI_DELAY)) < 1e-6, `waits for the play: ${bt.aiAt - t} s after ${played} s played`);
    if (!bt.over) assert.ok(Math.abs(bt.turnEnds - (t + played + 30)) < 1e-6, 'her clock starts once it is played');
  }
});
