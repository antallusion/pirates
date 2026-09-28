// Boarding 2.0 (docs/11 P1): the deck fight round by round — the circle of tactics, momentum, the captains'
// moves, the duel, the NPC captain's mind, and what each captain is told.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec } from '../shared/src/math.ts';
import { BASIC_TACTICS, CAPTAIN_MOVES, MAX_ROUNDS, ROUND_WINDOW, TACTICS, counterTo, edgeOf } from '../shared/src/data/boarding.ts';
import { aiPick, strikeScore } from '../server/src/game/boarding.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

type Cap = 'corsair' | 'reaver' | 'smuggler' | 'navigator' | 'drowned' | 'admiral';

function atSea(game: Game, name: string, captain: Cap = 'corsair'): { c: FakeConn; ship: ShipEntity } {
  const c = join(game, name, captain);
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  s.profile!.level = 60; // past the newcomers' shelter, so captains may board each other
  // A brig, the same level as the brigs she fights (canon D12: a sloop would be far below them).
  ship.loadout.classId = 'brig';
  ship.recompute(game.now);
  ship.crew = ship.stats.crewMax;
  ship.morale = 80;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, ship };
}

/** A crippled pirate alongside, with a crew that can fight back for several rounds. */
function foeAlongside(game: Game, ship: ShipEntity, crew = 40): ShipEntity {
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const npc = game.spawnNpcShip('pirate', 'brig', 'free', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  npc.hull = npc.stats.hullMax * 0.4;
  npc.crew = crew;
  npc.morale = 80;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

/** Step the world until the fight's current round resolves (or the fight ends). */
function toNextRound(game: Game, ship: ShipEntity): void {
  const r0 = ship.boarding?.fight.round ?? -1;
  for (let i = 0; i < 20 * 10 && ship.boarding && ship.boarding.fight.round === r0; i++) game.step();
}

test('the circle of tactics: each basic order beats one, falls to one, and the specials beat none', () => {
  for (const t of BASIC_TACTICS) {
    const beats = BASIC_TACTICS.filter((x) => edgeOf(t, x) === 1);
    const falls = BASIC_TACTICS.filter((x) => edgeOf(t, x) === -1);
    assert.equal(beats.length, 1, `${t} beats one`);
    assert.equal(falls.length, 1, `${t} falls to one`);
    assert.equal(edgeOf(counterTo(t), t), 1, `counter to ${t}`);
    assert.equal(edgeOf(t, t), 0);
  }
  for (const t of ['officers', 'colours', 'captain'] as const) for (const x of BASIC_TACTICS) assert.equal(edgeOf(t, x), 0);
  assert.equal(TACTICS.captain.cost, 100);
  for (const cap of ['corsair', 'smuggler', 'reaver', 'navigator', 'drowned', 'admiral'] as const) assert.ok(CAPTAIN_MOVES[cap].id);
});

test('a round waits for the order; a captain who gives none holds the line', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Waiter');
  const npc = foeAlongside(game, ship);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  assert.ok(ship.boarding, 'grappled');
  const v0 = c.last('board_fight')?.view;
  assert.ok(v0 && v0.round === 0 && v0.choice === null && v0.attacker, 'the fight is shown before the first round');
  steps(game, 10); // half a second: nothing is decided yet
  assert.equal(ship.boarding!.fight.round, 0, 'the round waits for the order');
  toNextRound(game, ship);
  const v = c.last('board_fight')!.view!;
  assert.equal(v.round, 1);
  assert.equal(v.last!.you, 'hold', 'no order: the waist is held');
  assert.ok(v.log.some((l) => l.code === 'waited' && l.you));
});

test('an order given resolves the round at once, and the winning tactic takes the round and the momentum', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Reader');
  const npc = foeAlongside(game, ship, 60);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  npc.boarding!.pick = 'charge';
  c.push({ t: 'board_tactic', tactic: 'volley' });
  assert.equal(c.last('board_fight')!.view!.choice, 'volley', 'the order is acknowledged');
  const t0 = game.now;
  toNextRound(game, ship);
  assert.ok(game.now - t0 < 1.6, `resolved as soon as the order was given (${(game.now - t0).toFixed(2)} s)`);
  const v = c.last('board_fight')!.view!;
  assert.deepEqual([v.last!.you, v.last!.foe, v.last!.edge], ['volley', 'charge', 1]);
  assert.equal(v.you.momentum, 35);
  assert.equal(ship.boarding!.won, 1);
  // The next round: guess wrong.
  if (!ship.boarding) return;
  npc.boarding!.pick = 'charge';
  c.push({ t: 'board_tactic', tactic: 'grenades' });
  toNextRound(game, ship);
  // The fight may be over after this round (the foe strikes): then there is nothing more to read.
  const w = c.last('board_fight')!.view;
  if (w?.last) {
    assert.equal(w.last.edge, -1, 'grenades fall to a charge');
    assert.equal(w.you.momentum, 40, 'a lost round still teaches a little');
  }
});

test('special orders cost momentum; the captain\'s move needs all of it and is the captain\'s own', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Red Hook', 'reaver');
  const npc = foeAlongside(game, ship, 60);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  c.push({ t: 'board_tactic', tactic: 'colours' });
  assert.ok(c.all('toast').some((t) => /momentum/.test(t.msg)), 'not enough momentum');
  assert.equal(ship.boarding!.pick, null);
  ship.boarding!.momentum = 100;
  const m0 = npc.morale;
  npc.boarding!.pick = 'hold';
  c.push({ t: 'board_tactic', tactic: 'captain' });
  toNextRound(game, ship);
  const v = c.last('board_fight')!.view!;
  assert.equal(v.last!.you, 'captain');
  assert.ok(v.log.some((l) => l.code === 'move.red_harvest' && l.you), 'Red Hook goes first');
  assert.ok(v.you.momentum < 100, 'the move spent the momentum');
  assert.ok(npc.morale < m0 - 15, 'her crew faltered');
});

test('the captains\' duel: three timed blows decide the fight', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Duellist');
  const npc = foeAlongside(game, ship, 60);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  c.push({ t: 'board_duel', action: 'challenge' });
  assert.ok(c.all('toast').some((t) => /second round/.test(t.msg)), 'not before the second round');
  for (let r = 0; r < 2 && ship.boarding; r++) {
    npc.boarding!.pick = 'hold';
    c.push({ t: 'board_tactic', tactic: 'hold' });
    toNextRound(game, ship);
  }
  assert.ok(ship.boarding, 'still fighting after two rounds of holding');
  npc.morale = 60;
  c.push({ t: 'board_duel', action: 'challenge' });
  const d0 = c.last('board_fight')!.view!.duel!;
  assert.equal(d0.state, 'running', 'a proud captain takes up the challenge');
  // Three blows on the sweet spot.
  for (let i = 0; i < 3 && ship.boarding; i++) {
    const d = ship.boarding.fight.duel!;
    const at = d.opens + d.sweet * (d.closes - d.opens);
    while (game.now < at) game.step();
    c.push({ t: 'board_duel', action: 'strike', at });
    const ex = d.exchange;
    for (let k = 0; k < 20 * 5 && ship.boarding?.fight.duel && ship.boarding.fight.duel.exchange === ex && ship.boarding.fight.duel.state === 'running'; k++) game.step();
  }
  const done = c.all('board_fight').map((m) => m.view).filter((v) => v?.duel?.state === 'done').pop();
  assert.ok(done, 'the duel is over');
  assert.deepEqual(done!.duel!.you, [1, 1, 1], 'clean blows');
  assert.equal(done!.duel!.winner, 'you');
  steps(game, 20 * 3);
  assert.equal(ship.boarding, null, 'the fight ended on the last blow');
  const r = c.last('boarding')?.result;
  assert.ok(r && r.report?.duel === 'won', 'the prize, and the report tells of the duel');
  assert.equal(c.last('board_fight')!.view, null, 'the fight screen closes');
});

test('a duel lost (no blows struck) repels the boarders', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Hesitant');
  const npc = foeAlongside(game, ship, 60);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  for (let r = 0; r < 2 && ship.boarding; r++) {
    npc.boarding!.pick = 'hold';
    c.push({ t: 'board_tactic', tactic: 'hold' });
    toNextRound(game, ship);
  }
  npc.morale = 60;
  c.push({ t: 'board_duel', action: 'challenge' });
  steps(game, 20 * 12);
  assert.equal(ship.boarding, null);
  assert.ok(c.all('toast').some((t) => /repelled/.test(t.msg)), 'the captain fell, the boarders fall back');
});

test('the blade: a strike on the sweet spot lands fully, a third of the sweep off lands nothing', () => {
  assert.equal(strikeScore(10, 11.4, 0.5, 10.7), 1);
  assert.equal(strikeScore(10, 11.4, 0.5, 10.7 + 0.49), 0);
  assert.equal(strikeScore(10, 11.4, 0.5, 9), 0, 'too early');
  assert.ok(strikeScore(10, 11.4, 0.5, 10.84) > 0.6);
});

test('an NPC captain reads the deck: a pirate counters a repeated order far more often than chance', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Predictable');
  const npc = foeAlongside(game, ship, 60);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  ship.boarding!.lastPick = 'charge';
  let volley = 0;
  for (let i = 0; i < 400; i++) if (aiPick(game, npc, ship) === 'volley') volley++;
  assert.ok(volley / 400 > 0.5, `countered ${(volley / 4).toFixed(0)}% of the time`);
  npc.boarding!.momentum = 100;
  let moves = 0;
  for (let i = 0; i < 100; i++) if (aiPick(game, npc, ship) === 'captain') moves++;
  assert.ok(moves > 60, 'the captain\'s move when it is ready');
});

test('a fight ends within the round limit and the prize report counts the rounds', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Patient');
  const npc = foeAlongside(game, ship, 30);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  steps(game, Math.ceil(20 * (MAX_ROUNDS * ROUND_WINDOW + 3)));
  assert.equal(ship.boarding, null, 'over');
  const r = c.last('boarding')?.result;
  if (r) {
    assert.ok(r.report && r.report.rounds >= 1 && r.report.rounds <= MAX_ROUNDS);
    assert.equal(r.report.won + r.report.lost <= r.report.rounds, true);
  }
});

test('two captains: the round resolves the moment both have given their orders', () => {
  const { game } = makeGame();
  const { c: ca, ship: a } = atSea(game, 'Boarder A');
  const { c: cb, ship: b } = atSea(game, 'Boarder B');
  b.state.x = a.state.x + 18;
  b.hull = b.stats.hullMax * 0.4;
  // Contested waters so players may fight.
  for (const sh of [a, b]) {
    sh.state.x += 26000;
    sh.state.y -= 10000;
    sh.region = game.regionAt(sh.state.x, sh.state.y);
    game.grid.upsert(sh.id, sh.state.x, sh.state.y);
  }
  ca.push({ t: 'board', target: b.id, aggression: 'standard' });
  assert.ok(a.boarding, 'grappled');
  assert.equal(cb.last('board_fight')!.view!.attacker, false, 'the defender sees the fight too');
  steps(game, 25);
  ca.push({ t: 'board_tactic', tactic: 'charge' });
  steps(game, 2);
  assert.equal(a.boarding!.fight.round, 0, 'waits for the other captain');
  cb.push({ t: 'board_tactic', tactic: 'volley' });
  steps(game, 2);
  const va = ca.last('board_fight')!.view!, vb = cb.last('board_fight')!.view!;
  assert.equal(va.round, 1);
  assert.deepEqual([va.last!.you, va.last!.edge], ['charge', -1]);
  assert.deepEqual([vb.last!.you, vb.last!.edge], ['volley', 1]);
});
