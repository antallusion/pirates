// Owner, 2026-10-16 («бой: очередь, угрозы, расстановка, укрытия, умнее ИИ, журнал и повтор»): the server's half —
// the deployment before round one (own columns only, the clock, the sea set at once, two captains unseen), the deck's
// cover (−25% beside it or behind it on the shot's line, in the preview), the threat zones (the server's and the
// field's own reckoning agree), the sea's mind by her level (she finishes what she can kill, her steel guards her
// shooters, keeps out of reach while she out-shoots) and the record played again blow for blow.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { TAC_DECK_COVER, TAC_DEPLOY, deckCover, deployZone, hexDist, hexIndex, hexLine, hexMirror, hexNeighbors, hexX, threatHexes } from '../shared/src/data/tactical.ts';
import {
  TAC_AI_SMART, act, aiChoice, aiSkill, battleWhy, blowParts, coverAt, newBattle, previewBlow, reachOf, recFromJson, recToJson, replayBattle, stepBattle, threatOf, viewOf,
} from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput } from '../server/src/game/tacbattle.ts';
import { keepReplay, replayFrames, replayList, REPLAY_KEEP, REPLAY_MAX } from '../server/src/game/tacreplay.ts';
import { side, sidesAt } from './balance/boardlen.ts';
import { makeGame } from './helpers.ts';
import { npcHeroBattle } from '../shared/src/data/hero.ts';

const pvp = (seed: number, deploy?: [boolean, boolean], record = false): { bt: TacBattle; rng: Rng } => {
  const [a, b] = sidesAt(30, true, 'corsair', 'reaver', seed);
  const rng = new Rng(seed ^ 0x7ac7);
  return { bt: newBattle(a, b, seed, 0, rng, { len: 'board', level: 30, ...(deploy ? { deploy } : {}), record }), rng };
};

test('deployment: own columns only, a swap among her own, «Готово», the clock, the sea set at once', () => {
  const { bt, rng } = pvp(11, [true, true]);
  assert.ok(bt.deploy && bt.round === 0 && bt.active === null, 'no round before the stacks are set');
  for (const x of [0, 1] as const) for (const h of bt.deploy!.zone[x]) {
    const l = x ? hexMirror(h) : h;
    const own = bt.stacks.some((s) => s.side === x && s.hex === h);
    assert.ok(hexX(l) < TAC_DEPLOY.cols || own, `side ${x}: ${h} is in her own columns`);
  }
  const mine = bt.stacks.filter((s) => s.side === 0);
  const theirs = bt.stacks.filter((s) => s.side === 1);
  const free = bt.deploy!.zone[0].find((h) => !bt.stacks.some((s) => s.hex === h))!;
  assert.equal(act(bt, 0, { a: 'deploy', s: theirs[0].id, hex: free }, 0, rng), 'Point at one of your stacks');
  assert.equal(act(bt, 0, { a: 'deploy', s: mine[0].id, hex: theirs[0].hex }, 0, rng), 'Only within your own columns');
  assert.equal(act(bt, 0, { a: 'deploy', s: mine[0].id, hex: hexIndex(4, 4) }, 0, rng), 'Only within your own columns');
  assert.equal(act(bt, 0, { a: 'attack', target: theirs[0].id }, 0, rng), 'Set your stacks first');
  assert.equal(act(bt, 0, { a: 'deploy', s: mine[0].id, hex: free }, 0, rng), null);
  assert.equal(mine[0].hex, free);
  const [p, q] = [mine[0], mine[1]];
  const [hp, hq] = [p.hex, q.hex];
  assert.equal(act(bt, 0, { a: 'deploy', s: p.id, hex: hq }, 0, rng), null, 'one of hers there: the two change places');
  assert.deepEqual([p.hex, q.hex], [hq, hp]);
  // Two captains: each sees her own stacks only.
  const v0 = viewOf(bt, 0, 0, false);
  assert.ok(v0.deploy && v0.deploy.hidden && v0.stacks.every((s) => s.side === 0), 'the other side unseen');
  assert.ok(v0.next.every((id) => v0.stacks.some((s) => s.id === id)), 'nor in the order');
  assert.equal(act(bt, 0, { a: 'ready' }, 0, rng), null);
  assert.equal(act(bt, 0, { a: 'deploy', s: p.id, hex: hp }, 0, rng), 'Your stacks are set');
  assert.ok(bt.deploy, 'the other still setting hers');
  stepBattle(bt, TAC_DEPLOY.secs - 0.1, rng);
  assert.ok(bt.deploy, 'not before the clock');
  stepBattle(bt, TAC_DEPLOY.secs, rng);
  assert.ok(!bt.deploy && (bt.round as number) === 1 && bt.active !== null, 'the clock run out: round one opens');
  // The sea sets hers at once: with no captain setting hers, round one opens as before.
  const [a, b] = sidesAt(30, false, 'corsair', 'corsair', 2);
  const sea = newBattle(a, b, 2, 0, new Rng(1), { len: 'board', level: 30, deploy: [false, false] });
  assert.ok(!sea.deploy && sea.round === 1);
  const one = newBattle(a, b, 2, 0, new Rng(1), { len: 'board', level: 30, deploy: [true, false] });
  assert.deepEqual(one.deploy?.ready, [false, true], 'the sea is set at once');
  assert.ok(viewOf(one, 0, 0, false).stacks.some((s) => s.side === 1), 'against the sea her stacks are in sight');
  assert.equal(act(one, 0, { a: 'auto', on: true }, 0, new Rng(1)), null);
  assert.ok(!one.deploy && one.round === 1, 'auto-battle: set as she stands');
  // No deployment in a siege, and the zone never holds a hole, a plank or the other's flag.
  for (const x of [0, 1] as const) for (const h of deployZone(bt.cells, x)) assert.ok(!'~=HFMBCK#'.includes(bt.cells[h]), `${h} ${bt.cells[h]}`);
});

test('the deck\'s cover: −25% beside it or behind it on the shot\'s line, and the preview says so', () => {
  assert.equal(TAC_DECK_COVER, 0.75);
  // A straight line through a mast.
  const cells = Array.from({ length: 99 }, () => '.');
  const from = hexIndex(0, 4), to = hexIndex(8, 4), mast = hexIndex(4, 4);
  assert.deepEqual(hexLine(from, to).length, hexDist(from, to) + 1);
  assert.equal(deckCover(cells, to, from), -1);
  cells[mast] = 'M';
  assert.equal(deckCover(cells, to, from), mast, 'behind the mast on the line');
  assert.equal(deckCover(cells, mast + 1, from), mast, 'beside it, the shooter\'s side');
  assert.equal(deckCover(cells, hexIndex(3, 4), from), -1, 'before it: none');
  // In the battle: the shot's harm and its preview.
  const { bt } = pvp(5);
  const s = bt.stacks.find((x) => x.side === 0 && x.shots > 0)!;
  const t = bt.stacks.find((x) => x.side === 1)!;
  for (let i = 0; i < bt.cells.length; i++) if ('MBKCQL'.includes(bt.cells[i])) bt.cells[i] = '.';
  s.hex = hexIndex(1, 4);
  t.hex = hexIndex(8, 4);
  const bare = blowParts(bt, s, t, 'shot').mul;
  assert.equal(previewBlow(bt, s, t, 'shot').cov, undefined);
  bt.cells[hexIndex(5, 4)] = 'B';
  assert.ok(coverAt(bt, t.hex, s.hex) >= 0);
  assert.ok(Math.abs(blowParts(bt, s, t, 'shot').mul / bare - TAC_DECK_COVER) < 1e-9, 'a quarter off');
  assert.equal(previewBlow(bt, s, t, 'shot').cov, true);
});

test('threat zones: the field\'s reckoning from the view is the server\'s, and its stride is reachOf\'s', () => {
  for (const seed of [3, 4, 9]) {
    const { bt } = pvp(seed);
    const v = viewOf(bt, 0, 0, false);
    for (const s of bt.stacks) {
      const z = threatOf(bt, s);
      const sv = v.stacks.find((x) => x.id === s.id)!;
      const occ = new Set(v.stacks.filter((x) => x.id !== s.id).map((x) => x.hex));
      const fromView = threatHexes(v.cells, occ, sv.hex, { speed: sv.speed, fly: sv.sp.includes('flying'), fire: !v.land && !v.siege && !v.arena });
      assert.deepEqual(fromView, z, `stack ${s.id}`);
      assert.deepEqual(z.move, [...reachOf(bt, s).keys()].sort((p, q) => p - q), `stack ${s.id}: her stride`);
      for (const h of z.move) for (const j of hexNeighbors(h)) if (bt.cells[j] !== '#') assert.ok(z.hit.includes(j));
    }
  }
});

/** A boarding against the sea laid out by hand: `mine` (a captain's) and `sea` (a captain of the sea of level `L`). */
function handmade(mine: { u: string; n: number }[], sea: { u: string; n: number }[], L: number): TacBattle {
  const a = side(mine as never, undefined, null, true), b: TacSideInput = side(sea as never, npcHeroBattle(Math.max(1, Math.ceil(L / 6)), null), null, false);
  b.hero!.level = L;
  const bt = newBattle(a, b, 1, 0, new Rng(1), { len: 'board', level: L });
  for (let i = 0; i < bt.cells.length; i++) if (bt.cells[i] !== '#') bt.cells[i] = '.';
  return bt;
}

test('the sea\'s mind by her level: none for a captain\'s auto-battle, sharper as her captain rises', () => {
  const bt = handmade([{ u: 'sailor', n: 10 }], [{ u: 'sailor', n: 10 }], 1);
  assert.equal(aiSkill(bt, 0), 0, 'a captain\'s auto-battle keeps the mind as it was');
  let last = 0;
  for (const L of [1, 10, 20, 30, 45]) {
    bt.heroes[1].input.hero!.level = L;
    const k = aiSkill(bt, 1);
    assert.ok(k >= last && k >= TAC_AI_SMART.lo && k <= 1, `L${L}: ${k}`);
    last = k;
  }
  assert.equal(last, 1);
});

test('the sea\'s mind finishes what she can kill; her steel steps between a shooter of hers and the foe', () => {
  // A shot: a stack she can fell whole against a bigger one she can only scratch — found by the count where the kill's
  // worth decides, with the kill weighed (TAC_AI_SMART.kill) and not.
  let decided = 0;
  for (const [bu, bn, su] of [['sea_guard', 30, 'deckhand'], ['marine', 40, 'sailor'], ['sea_guard', 20, 'sailor'], ['marine', 60, 'deckhand']] as const) for (let n = 1; n <= 20; n++) {
    const pick = (kill: number) => {
      const was = TAC_AI_SMART.kill;
      TAC_AI_SMART.kill = kill;
      try {
        const bt = handmade([{ u: bu, n: bn }, { u: su, n }], [{ u: 'musketeer', n: 12 }], 40);
        const s = bt.stacks.find((x) => x.side === 1)!;
        const [big, small] = bt.stacks.filter((x) => x.side === 0);
        s.hex = hexIndex(9, 4);
        big.hex = hexIndex(1, 2);
        small.hex = hexIndex(1, 6);
        bt.active = s.id;
        const c = aiChoice(bt, new Rng(1));
        return { c, small: small.id };
      } finally {
        TAC_AI_SMART.kill = was;
      }
    };
    const smart = pick(0.4), dull = pick(0);
    if (smart.c.a === 'shoot' && dull.c.a === 'shoot' && smart.c.target !== dull.c.target) {
      assert.equal(smart.c.target, smart.small, `n=${n}: the kill weighed, she fells the small stack`);
      decided++;
    }
  }
  assert.ok(decided > 0, 'some count where the kill decides');
  // Her shooter in reach of the other's steel next turn, her own steel out of reach of it: it steps beside the shooter.
  const bt = handmade([{ u: 'marine', n: 30 }], [{ u: 'musketeer', n: 10 }, { u: 'sailor', n: 20 }], 40);
  const [shooter, steel] = bt.stacks.filter((x) => x.side === 1);
  const foe = bt.stacks.find((x) => x.side === 0)!;
  shooter.hex = hexIndex(9, 4);
  foe.hex = hexIndex(6, 4);
  steel.hex = hexIndex(9, 0);
  bt.active = steel.id;
  assert.ok(threatOf(bt, foe).hit.includes(shooter.hex), 'the foe could fall on the shooter');
  const c = aiChoice(bt, new Rng(1));
  if (c.a === 'attack') assert.ok(true, 'in reach of the foe: she strikes');
  else {
    assert.equal(c.a, 'move');
    assert.ok(hexNeighbors(shooter.hex).includes((c as { to: number }).to), 'beside her shooter');
  }
});

test('the sea out-shooting the other keeps her steel out of reach of the other\'s; out-shot, she closes as before', () => {
  const mk = () => {
    const bt = handmade([{ u: 'marine', n: 40 }], [{ u: 'musketeer', n: 15 }, { u: 'sailor', n: 6 }], 40);
    const [gun, steel] = bt.stacks.filter((x) => x.side === 1);
    const foe = bt.stacks.find((x) => x.side === 0)!;
    gun.hex = hexIndex(10, 0);
    foe.hex = hexIndex(1, 4);
    steel.hex = hexIndex(9, 4);
    bt.active = steel.id;
    return { bt, gun, steel, foe };
  };
  const { bt, steel, foe } = mk();
  const zone = new Set(threatOf(bt, foe).hit);
  const c = aiChoice(bt, new Rng(1));
  if (c.a === 'move') assert.ok(!zone.has(c.to), 'never into the other steel\'s reach');
  else assert.equal(c.a, 'defend');
  const was = TAC_AI_SMART.avoid;
  TAC_AI_SMART.avoid = 2;
  try {
    const m = mk();
    const c2 = aiChoice(m.bt, new Rng(1));
    assert.equal(c2.a, 'move', 'without it she closes');
  } finally {
    TAC_AI_SMART.avoid = was;
  }
  void steel;
});

test('the record played again: the same battle blow for blow, from its words too; the frames end where it ended', () => {
  for (const seed of [21, 22]) {
    const { bt, rng } = pvp(seed, [true, true], true);
    const mine = bt.stacks.filter((s) => s.side === 0);
    const free = bt.deploy!.zone[0].find((h) => !bt.stacks.some((s) => s.hex === h))!;
    act(bt, 0, { a: 'deploy', s: mine[0].id, hex: free }, 0, rng);
    act(bt, 0, { a: 'ready' }, 0, rng);
    act(bt, 1, { a: 'ready' }, 0, rng);
    let t = 1;
    for (let i = 0; i < 3000 && !bt.over; i++) {
      // Side 0 plays a few turns by hand (a defence), times one out, then hands the helm to auto; side 1 is on auto.
      if (i === 2) bt.heroes[1].auto = true;
      const s = bt.stacks.find((x) => x.id === bt.active);
      if (s && s.side === 0 && !bt.heroes[0].auto && bt.round <= 2) act(bt, 0, i % 3 ? { a: 'defend' } : { a: 'wait' }, (t += 1), rng);
      else if (s && s.side === 0 && !bt.heroes[0].auto) {
        stepBattle(bt, (t += 25), rng);
        bt.heroes[0].auto = true;
      } else stepBattle(bt, (t += 3), rng);
    }
    assert.ok(bt.over && bt.rec, 'fought to its end, kept');
    const again = replayBattle(recFromJson(recToJson(bt.rec!))!);
    const sig = (x: TacBattle) => JSON.stringify([x.over, x.round, x.stacks.map((s) => [s.id, s.hex, s.count, s.hpTop, s.shots]), x.dead]);
    assert.equal(sig(again), sig(bt), `seed ${seed}: the same battle`);
    const fr = replayFrames(bt.rec!, 0);
    assert.ok(fr.base.replay && fr.frames.length > 0 && fr.base.stacks.length === bt.stacks.length, 'the field as it opened, whole');
    const last = fr.frames[fr.frames.length - 1];
    assert.deepEqual(last.over, bt.over);
    assert.deepEqual(last.st.map((x) => [x[0], x[2]]), bt.stacks.filter((s) => s.count > 0).map((s) => [s.id, s.count]));
    const why = battleWhy(bt);
    assert.ok(why.stacks.length === bt.stacks.length && why.stacks.some((s) => s.dealt > 0) && why.turn && why.turn.kills > 0, 'the why: harm, kills, the turning blow');
  }
});

test('her last twenty fights kept; one too long is not', () => {
  const { game } = makeGame();
  const { bt } = pvp(3, undefined, true);
  const ids: string[] = [];
  for (let i = 0; i < REPLAY_KEEP + 5; i++) ids.push(keepReplay(game, 7, bt.rec!, { side: 0, vs: `Foe ${i}`, won: true, pvp: true })!);
  const list = replayList(game, 7);
  assert.equal(list.length, REPLAY_KEEP);
  assert.deepEqual(new Set(list.map((x) => x.id)), new Set(ids.slice(5)));
  const big = structuredClone(bt.rec!);
  big.a.name = 'x'.repeat(REPLAY_MAX);
  assert.equal(keepReplay(game, 7, big, { side: 0, vs: 'Big', won: false, pvp: true }), null);
  assert.equal(replayList(game, 8).length, 0);
});
