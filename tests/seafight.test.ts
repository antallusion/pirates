// The quick sea fight and boarding a senior (docs/23 phases 3–4, owner 2026-10-06): two ships of a level sink each other
// with broadsides in 30 s or less; «Атаковать» runs her in to the grapples in 10 s or less; a green captain's laid
// broadsides strike three balls in five and better; the helm is the captain's the moment she takes it and the
// helmsman's 1.5 s after; a lost mark gives way to the nearest threat; no chase goes on for ever; a mark two levels down
// is settled in about three seconds; the ladder no longer bars the grapples, and a senior or a slim chance opens the
// window first, with a chance the battles bear out.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { boardOdds, isRisky, ODDS_SIMS, RISK_CHANCE } from '../server/src/game/boardodds.ts';
import { canBoard } from '../server/src/game/boarding.ts';
import type { Game } from '../server/src/game/Game.ts';
import { pursuitInput, pursuitOf, PURSUIT_RESUME, startPursuit } from '../server/src/game/pursuit.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { STRIKE_CREW, wouldStrike } from '../server/src/game/struck.ts';
import { newBattle, quickFinish } from '../server/src/game/tacbattle.ts';
import { boardLen, sideOf } from '../server/src/game/tactical.ts';
import { duelSea, openWater, putSide } from './balance/duel.ts';
import { LEVEL_HULL, captainRun, pct, seaCaptain, seaDuel } from './balance/seafight.ts';
import type { FakeConn } from './helpers.ts';
import { steps } from './helpers.ts';

const LEVELS = [1, 3, 5, 8];

// docs/25 §1.1 (owner, 2026-10-09: «2 минуты корабль пинать на высоком уровне это норма… а на низком это извращение»):
// the quick fight's 30 s at every ⚓ gave way to the broadside table — two of the sea's ships of a level (each a captain
// in half gear, sinking in 30% fewer broadsides) take about half a minute at ⚓1 and two at ⚓8–10. Was: median and p90
// ≤ 30 s at all four. Measured after: ⚓1 34/43 s, ⚓3 50/55, ⚓5 67/81, ⚓8 109/129.
const SEA_TIME: Record<number, [number, number]> = { 1: [15, 50], 3: [25, 75], 5: [35, 100], 8: [55, 160] };

test('two ships of a level sink each other with broadsides alone in the table’s time (docs/25 §1.1), median and 90th percentile, at ⚓1/3/5/8', () => {
  const game = duelSea();
  const rows: string[] = [];
  for (const L of LEVELS) {
    const fights: number[] = [];
    for (let k = 0; k < 10; k++) {
      const r = seaDuel(game, LEVEL_HULL[L], L, 500 + k);
      assert.ok(r.sunk, `⚓${L}: one of them sinks (duel ${k})`);
      fights.push(r.fight);
    }
    const { med, p90 } = pct(fights);
    rows.push(`⚓${L} ${LEVEL_HULL[L]}: median ${med} s, p90 ${p90} s`);
    const [lo, hi] = SEA_TIME[L];
    assert.ok(med >= lo && med <= hi && p90 <= hi * 1.25, `⚓${L}: median ${med} s, p90 ${p90} s (the table: ${lo}–${hi} s)`);
  }
  console.log(rows.join('\n'));
});

test('«Атаковать» to the grapples in 10 s or less from 700 m; a green captain’s laid broadsides strike 60% and more', () => {
  const game = duelSea();
  for (const L of LEVELS) {
    const t: number[] = [];
    // Ten runs (with six the «90th percentile» was only the slowest one: a mark fleeing dead before the wind).
    for (let k = 0; k < 10; k++) t.push(captainRun(game, LEVEL_HULL[L], L, 700 + k, 'board', 40).sec);
    assert.ok(t.every((x) => x > 0), `⚓${L}: always alongside (${t.join(' ')})`);
    const { med, p90 } = pct(t);
    assert.ok(med <= 10 && p90 <= 10, `⚓${L}: to the grapples median ${med} s, p90 ${p90} s`);
    // (Six fights: in the close fight of 2026-10-07 three were over in 16 balls.)
    let balls = 0, hits = 0;
    for (let k = 0; k < 6; k++) {
      const r = captainRun(game, LEVEL_HULL[L], L, 900 + k, 'guns', 60);
      balls += r.balls;
      hits += r.hits;
    }
    assert.ok(balls > 20 && hits / balls >= 0.6, `⚓${L}: ${hits}/${balls} balls struck`);
  }
});

/** A captain on the open sea with a bot of her level `d` metres off. */
function pair(level: number, foeLevel = level, d = 600): { game: Game; s: ReturnType<typeof seaCaptain>; me: ShipEntity; foe: ShipEntity; c: FakeConn } {
  const game = duelSea();
  const at = openWater(game, 3);
  const s = seaCaptain(game, LEVEL_HULL[level] ?? 'brig', level, at.x, at.y, 0);
  const foe = putSide(game, { cls: LEVEL_HULL[foeLevel] ?? 'brig', level: foeLevel, craft: 'bot' }, at.x + d, at.y, Math.PI / 2).ship;
  return { game, s, me: s.ship!, foe, c: s.conn as unknown as FakeConn };
}

test('the helm: the captain’s hand takes it at once, and the helmsman has it back 1.5 s after she lets go', () => {
  const { game, s, me, foe } = pair(3);
  s.autoFire = false;
  assert.equal(startPursuit(game, s, foe.id, 'guns'), null);
  steps(game, 10);
  assert.notEqual(me.input.rudder, 0.5, 'the helmsman steers');
  // Her hand on the helm: the input goes through as she gives it.
  assert.equal(pursuitInput(game, s, 0.5, 4, true), false);
  me.input = { rudder: 0.5, sailTarget: 1 };
  steps(game, 5);
  assert.equal(me.input.rudder, 0.5, 'her rudder, not his');
  // Let go: she holds her head until the helmsman has the wheel back.
  assert.equal(pursuitInput(game, s, 0, 4, false), true);
  assert.equal(me.input.rudder, 0, 'held steady');
  steps(game, Math.floor((PURSUIT_RESUME - 0.4) * 20));
  assert.equal(me.input.rudder, 0, 'not yet');
  steps(game, 20);
  assert.ok(pursuitOf(me), 'still pursuing');
  assert.notEqual(me.input.rudder, 0, 'the helmsman has her again');
});

test('a mark lost: the nearest threat is the next; none near, the wheel goes back', () => {
  const { game, s, me, foe } = pair(3);
  s.autoFire = false;
  const other = putSide(game, { cls: 'schooner', level: 3, craft: 'bot' }, me.state.x - 500, me.state.y, 0).ship;
  other.attackers.set(me.id, game.now); // she has fired on the captain: a threat
  assert.equal(startPursuit(game, s, foe.id, 'guns'), null);
  game.removeShip(foe.id);
  steps(game, 2);
  assert.equal(pursuitOf(me)?.target, other.id, 'the next mark');
  game.removeShip(other.id);
  steps(game, 2);
  assert.equal(pursuitOf(me), null, 'no mark left');
});

test('no endless chase: forty seconds with no hit either way and the pursued merchant strikes to the captain', () => {
  const game = duelSea();
  const at = openWater(game, 5);
  const s = seaCaptain(game, 'schooner', 3, at.x, at.y, 0);
  s.autoFire = false;
  s.expert = true; // (no hit of hers: «Атаковать» fires whatever the auto-fire switch, but for the expert's own hand)
  const m = game.spawnNpcShip('merchant', 'fluyt', 'league', at.x + 900, at.y, Math.PI / 2);
  game.npcs.get(m.id)!.active = true;
  game.setNpcLevel(m, 3);
  game.grid.upsert(m.id, m.state.x, m.state.y);
  assert.equal(startPursuit(game, s, m.id, 'guns'), null); // (at gun range: alongside, a bump of the hulls is a hit)
  steps(game, 20 * 38);
  assert.ok(!m.surrendered, 'not before forty seconds');
  steps(game, 20 * 4);
  assert.ok(m.surrendered, 'struck');
});

test('auto-battle against the weak: a mark two levels down is settled in about three seconds', () => {
  const { game, s, me, foe } = pair(5, 3, 400);
  s.autoWeak = true;
  s.autoFire = false;
  assert.equal(startPursuit(game, s, foe.id, 'guns'), null);
  steps(game, 20 * 2);
  assert.ok(foe.alive && !foe.sinkingUntil && !foe.surrendered, 'not yet');
  steps(game, 20 * 1.2);
  assert.ok(!foe.alive || foe.sinkingUntil > 0 || foe.surrendered, 'beaten');
  // Not against an equal.
  const { game: g2, s: s2, foe: f2 } = pair(5, 5, 400);
  s2.autoWeak = true;
  s2.autoFire = false;
  startPursuit(g2, s2, f2.id, 'guns');
  steps(g2, 20 * 4);
  assert.ok(f2.alive && !f2.surrendered, 'an equal is fought');
  void me;
});

test('a bot strikes her colours sooner: below three tenths of her men', () => {
  const { game, me, foe } = pair(3, 3, 300);
  assert.equal(STRIKE_CREW, 0.3);
  foe.npcRole = 'pirate';
  foe.attackers.set(me.id, game.now);
  foe.lastCombat = game.now;
  foe.crew = Math.floor(foe.stats.crewMax * 0.29);
  assert.ok(wouldStrike(game, foe, me), 'battered at 29% of her men');
  foe.crew = Math.ceil(foe.stats.crewMax * 0.32);
  assert.ok(!wouldStrike(game, foe, me), 'not at 32%');
});

test('boarding a senior: allowed, the window first («Рискнуть» boards, nothing without it); an easy prize at once', () => {
  const { game, me, foe, c, s } = pair(1, 3, 40);
  s.profile!.level = 1; // a captain of her sloop's level: her lesson goes by her level (docs/26)
  foe.state.speed = me.state.speed = 0;
  assert.equal(canBoard(game, me, foe), null, 'the ladder no longer bars the grapples');
  c.push({ t: 'board', target: foe.id, aggression: 'standard' });
  const risk = c.last('board_risk')?.risk;
  assert.ok(risk && risk.risky, 'the window');
  assert.equal(risk.theirLevel - risk.myLevel, 2);
  assert.ok(risk.chance < RISK_CHANCE, `slim: ${risk.chance}`);
  assert.equal(risk.sims, ODDS_SIMS);
  assert.ok(risk.xpMul > 1, 'more for a senior');
  assert.ok(!me.boarding, 'no grapples yet');
  c.push({ t: 'board', target: foe.id, aggression: 'standard', risk: true });
  assert.ok(me.boarding, '«Рискнуть»: the grapples fly');
  // Her equal, beaten to a third of her men: no window, the grapples at once.
  const p = pair(3, 3, 40);
  p.foe.state.speed = p.me.state.speed = 0;
  p.foe.crew = Math.ceil(p.foe.stats.crewMax * 0.25);
  p.c.inbox.length = 0;
  p.c.push({ t: 'board', target: p.foe.id, aggression: 'standard' });
  assert.equal(p.c.last('board_risk'), undefined);
  assert.ok(p.me.boarding, 'boarded at once');
});

test('the threshold: a chance under 35% or a mark two levels up', () => {
  const { me, foe } = pair(3, 3);
  assert.ok(isRisky(me, foe, RISK_CHANCE - 0.01));
  assert.ok(!isRisky(me, foe, RISK_CHANCE + 0.01));
  const up = pair(1, 3);
  assert.ok(isRisky(up.me, up.foe, 0.9), 'two levels up: always the window');
});

test('the chance is honest: the battles played afresh bear it out within 5%, and asking moves no die of the sea', () => {
  const { game, me, foe } = pair(5, 5, 40);
  let calls = 0;
  const rng = game.rng as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const k of ['float', 'int', 'chance', 'range', 'pick', 'gauss', 'weighted']) {
    const f = rng[k].bind(game.rng);
    rng[k] = (...a: unknown[]) => {
      calls++;
      return f(...a);
    };
  }
  const odds = boardOdds(game, me, foe);
  assert.equal(calls, 0, 'the sea’s dice untouched');
  assert.ok(odds.chance > 0.05 && odds.chance < 0.95, `a real contest: ${odds.chance}`);
  // 200 battles more, on dice the estimate never used (seeded as a real boarding seeds its own).
  const sa = sideOf(game, me, foe, true), sb = sideOf(game, foe, me, false);
  const seeds = new Rng(4242);
  let won = 0;
  for (let k = 0; k < 200; k++) {
    const seed = seeds.int(1, 1e9);
    const r = new Rng(seed ^ 0x7ac7);
    const bt = newBattle(structuredClone(sa), structuredClone(sb), seed, game.now, r, { len: boardLen(me, foe) }); // docs/25: a boarding's own length, as the game fights it
    quickFinish(bt, game.now, r);
    if (bt.over?.winner === 0) won++;
  }
  assert.ok(Math.abs(odds.chance - won / 200) <= 0.05, `shown ${odds.chance}, played ${won / 200}`);
});
