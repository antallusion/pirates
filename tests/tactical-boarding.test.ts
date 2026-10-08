// The turn-based boarding battle (docs/16 P4, «like Heroes III»): the field and the stacks the crews make, the order
// of initiative, moves and blows checked by the server, retaliation once a round, shots and their range, morale and
// luck kept small, the sea's mind playing legal moves to the end, the captain's clock, the end feeding the plunder,
// and the balance: even crews even, a level up clearly stronger, a merchant never beating a warship of her level.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec } from '../shared/src/math.ts';
import { Rng } from '../shared/src/rng.ts';
import { TAC_BLOCKING, TAC_CHANCE_PER_POINT, TAC_GAP, TAC_H, TAC_TURN, TAC_W, flankOf, hexDir, hexDist, hexIndex, hexMirror, hexNeighbors } from '../shared/src/data/tactical.ts';
import { act, aiChoice, blow, buildStacks, canShoot, makeField, meleeTargets, moralePoints, newBattle, quickFinish, reachOf, stackById, stepBattle } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput, TacStack } from '../server/src/game/tacbattle.ts';
import { sideOf } from '../server/src/game/tactical.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

const side = (o: Partial<TacSideInput> = {}): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 60, marines: 10, gunners: 20,
  officers: [{ id: 'o1', role: 'lieutenant', name: 'Ansel Pike', level: 3, lucky: false }],
  skill: 3, morale: 80, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...o,
});

function battle(a = side(), b = side(), seed = 1): { bt: TacBattle; rng: Rng } {
  const rng = new Rng(seed);
  return { bt: newBattle(a, b, seed, 0, rng), rng };
}

const active = (bt: TacBattle): TacStack => stackById(bt, bt.active!)!;
const freeBeside = (bt: TacBattle, hex: number): number => hexNeighbors(hex).find((h) => !TAC_BLOCKING.has(bt.cells[h]) && !bt.stacks.some((s) => s.count > 0 && s.hex === h))!;

function winRate(a: TacSideInput, b: TacSideInput, n: number): number {
  let w = 0;
  for (let k = 0; k < n; k++) {
    const { bt, rng } = battle(a, b, k * 31 + 7);
    quickFinish(bt, 0, rng);
    if (bt.over!.winner === 0) w++;
  }
  return w / n;
}

test('the field: two decks, water between them crossed by three planks, obstacles the same from either rail', () => {
  for (let seed = 1; seed < 30; seed++) {
    const cells = makeField(seed);
    assert.equal(cells.length, TAC_W * TAC_H);
    assert.equal(cells.filter((c) => c === '=').length, 3, 'three planks');
    for (let y = 0; y < TAC_H; y++) assert.ok(['~', '='].includes(cells[hexIndex(TAC_GAP, y)]), 'the gap runs the length of the field');
    for (let i = 0; i < cells.length; i++) if (cells[i] !== '#') assert.equal(cells[hexMirror(i)], cells[i], 'mirrored decks');
    assert.ok(cells.some((c) => c === 'M') && cells.some((c) => c === 'C'), 'masts and guns stand on deck');
  }
  assert.equal(hexNeighbors(hexIndex(4, 4)).length, 6);
  assert.equal(hexDist(hexIndex(0, 4), hexIndex(10, 4)), 10);
});

test("the stacks come from the crew: hands, marines, musketeers with shots, an officer's party, nobody lost or made up", () => {
  const cells = makeField(3);
  const st = buildStacks(side({ hands: 70, marines: 12, gunners: 18 }), 0, cells, 1);
  assert.deepEqual(st.map((s) => s.kind).sort(), ['gunners', 'hands', 'hands', 'marines', 'officer']);
  assert.equal(st.reduce((n, s) => n + s.count, 0), 100, 'every man in a stack');
  assert.ok(st.find((s) => s.kind === 'gunners')!.shots > 0, 'muskets are loaded');
  assert.equal(st.find((s) => s.kind === 'officer')!.officer!.order, 'rally', 'a lieutenant rallies');
  for (const s of st) assert.ok(!TAC_BLOCKING.has(cells[s.hex]) && s.hex % TAC_W <= 1, 'placed on her own deck');
  assert.equal(new Set(st.map((s) => s.hex)).size, st.length, 'one stack a hex');
  const right = buildStacks(side(), 1, cells, 10);
  for (const s of right) assert.ok(s.hex % TAC_W >= TAC_W - 3, 'the defenders on the right deck');
  // Veterancy shows in the blows.
  const green = buildStacks(side({ skill: 1 }), 0, cells, 1).find((s) => s.kind === 'marines')!;
  const vet = buildStacks(side({ skill: 5 }), 0, cells, 1).find((s) => s.kind === 'marines')!;
  assert.ok(vet.atk > green.atk && vet.def > green.def);
});

test('initiative: the round opens with the quickest, every living stack once, and the next round again', () => {
  const { bt, rng } = battle();
  const order = [bt.active!, ...bt.queue];
  assert.equal(new Set(order).size, bt.stacks.length, 'every stack once a round');
  const inits = order.map((id) => stackById(bt, id)!.init);
  for (let i = 1; i < inits.length; i++) assert.ok(inits[i - 1] >= inits[i], 'higher initiative first');
  for (let i = 0; i < order.length; i++) act(bt, active(bt).side, { a: 'defend' }, 0, rng);
  assert.equal(bt.round, 2, 'everyone defended: the next round');
  // Wait: to the end of the round, once.
  const s = active(bt);
  assert.equal(act(bt, s.side, { a: 'wait' }, 0, rng), null);
  assert.equal(bt.queue[bt.queue.length - 1], s.id);
});

test('moves are checked: only the highlighted reach, and only on your own turn', () => {
  const { bt, rng } = battle();
  const s = active(bt);
  const reach = reachOf(bt, s);
  assert.ok(reach.size > 0);
  for (const [h, d] of reach) {
    assert.ok(d <= s.speed, 'within speed');
    assert.ok(!TAC_BLOCKING.has(bt.cells[h]), 'no water or mast');
  }
  assert.equal(act(bt, (1 - s.side) as 0 | 1, { a: 'defend' }, 0, rng), 'Not your turn');
  assert.equal(act(bt, s.side, { a: 'move', to: hexIndex(s.side ? 0 : 10, 4) }, 0, rng), 'Out of reach');
  assert.equal(act(bt, s.side, { a: 'move', to: bt.cells.findIndex((c) => c === '~') }, 0, rng), 'Out of reach');
  const far = bt.stacks.find((t) => t.side !== s.side)!;
  assert.equal(act(bt, s.side, { a: 'attack', target: far.id }, 0, rng), 'Out of reach', 'no blow across the deck');
  const to = [...reach.keys()][0];
  assert.equal(act(bt, s.side, { a: 'move', to }, 0, rng), null);
  assert.equal(s.hex, to);
});

/** Two stacks face to face on the deck. */
function faceToFace(): { bt: TacBattle; rng: Rng; x: TacStack; y: TacStack } {
  const { bt, rng } = battle(side({ officers: [], hands: 40, marines: 20, gunners: 0 }), side({ officers: [], hands: 40, marines: 0, gunners: 0 }), 5);
  const x = bt.stacks.find((s) => s.side === 0 && s.kind === 'marines')!;
  const y = bt.stacks.find((s) => s.side === 1 && s.kind === 'hands')!;
  x.hex = hexIndex(3, 4) === bt.cells.indexOf('M') ? hexIndex(3, 2) : hexIndex(3, 4);
  if (TAC_BLOCKING.has(bt.cells[x.hex])) x.hex = hexIndex(4, 6);
  y.hex = freeBeside(bt, x.hex);
  bt.active = x.id;
  return { bt, rng, x, y };
}

test('a blow is struck back once a round, by the survivors; a blow from behind and defending tell', () => {
  const { bt, rng, x, y } = faceToFace();
  const hp0 = x.count * x.hpMax;
  const plain = blow(bt, x, y, 'melee', null).dmg;
  y.defending = true;
  assert.ok(blow(bt, x, y, 'melee', null).dmg < plain, 'a defending stack takes less');
  y.defending = false;
  assert.equal(act(bt, 0, { a: 'attack', target: y.id }, 0, rng), null);
  assert.equal(y.ret, false, 'her retaliation is spent');
  assert.ok((x.count - 1) * x.hpMax + x.hpTop < hp0, 'the survivors struck back');
  assert.ok(bt.log.some((e) => e.k === 'ret' && e.s === y.id));
  // She turned on whom she answered (owner, 2026-10-08): another of ours from her side or behind strikes harder than
  // from her front, and no second retaliation this round.
  assert.equal(y.face, hexDir(y.hex, x.hex), 'she faces whom she answered');
  const x2 = bt.stacks.find((s) => s.side === 0 && s !== x && s.count > 0)!;
  const free = hexNeighbors(y.hex).filter((h) => !TAC_BLOCKING.has(bt.cells[h]) && !bt.stacks.some((o) => o.count > 0 && o !== x2 && o.hex === h));
  const by = (k: number) => free.find((h) => flankOf(y.face, y.hex, h) === k);
  const open = by(2) ?? by(1)!, front = by(0) ?? free.find((h) => flankOf(y.face, y.hex, h) < flankOf(y.face, y.hex, open))!;
  bt.active = x2.id;
  x2.hex = front;
  const ahead = blow(bt, x2, y, 'melee', null).dmg;
  x2.hex = open;
  const flank = blow(bt, x2, y, 'melee', null).dmg;
  assert.ok(flank > ahead, `into her side or back (${ahead} → ${flank})`);
  const before = bt.log.filter((e) => e.k === 'ret').length;
  if (y.count > 0) act(bt, 0, { a: 'attack', target: y.id }, 0, rng);
  assert.equal(bt.log.filter((e) => e.k === 'ret').length, before, 'no second retaliation');
});

test("shots: a musket stack fires from afar, half damage at long range, none with a foe at arm's length, and runs dry", () => {
  const { bt, rng } = battle(side({ officers: [] }), side({ officers: [] }), 9);
  const g = bt.stacks.find((s) => s.kind === 'gunners' && s.side === 0)!;
  const t = bt.stacks.find((s) => s.side === 1 && s.kind === 'hands')!;
  bt.active = g.id;
  assert.ok(canShoot(bt, g));
  const tHex = t.hex;
  const far = blow(bt, g, t, 'shot', null).dmg;
  t.hex = freeBeside(bt, hexIndex(3, 4));
  const near = blow(bt, g, t, 'shot', null).dmg;
  assert.ok(hexDist(g.hex, tHex) > 6 && hexDist(g.hex, t.hex) <= 6);
  assert.ok(Math.abs(near / far - 2) < 0.15, `half at long range (${far} against ${near})`);
  const shots = g.shots;
  assert.equal(act(bt, 0, { a: 'shoot', target: t.id }, 0, rng), null);
  assert.equal(g.shots, shots - 1);
  const foe = bt.stacks.find((s) => s.side === 1 && s.count > 0 && s !== t)!;
  const foeHex = foe.hex;
  foe.hex = freeBeside(bt, g.hex);
  bt.active = g.id;
  assert.equal(canShoot(bt, g), false, 'a foe at arm\'s length');
  assert.match(act(bt, 0, { a: 'shoot', target: t.id }, 0, rng) ?? '', /arm's length/);
  foe.hex = foeHex;
  g.shots = 0;
  assert.equal(act(bt, 0, { a: 'shoot', target: t.id }, 0, rng), 'No shots left');
});

test('morale and luck: small chances, three points at most; a frightened crew sometimes freezes, a steady one never', () => {
  const { bt } = battle(side({ morale: 100 }), side({ morale: 0 }));
  assert.ok(moralePoints(bt, 0) <= 3 && moralePoints(bt, 1) >= -3);
  assert.ok(3 * TAC_CHANCE_PER_POINT <= 0.12);
  assert.ok(bt.heroes.every((h) => h.luck >= 0 && h.luck <= 3));
  let fear = 0, surge = 0, luck = 0, turns = 0;
  for (let k = 0; k < 40; k++) {
    const { bt: b, rng } = battle(side({ morale: 100 }), side({ morale: 20 }), k + 100);
    quickFinish(b, 0, rng);
    fear += b.log.filter((e) => e.k === 'fear').length;
    surge += b.log.filter((e) => e.k === 'morale').length;
    luck += b.log.filter((e) => e.k === 'luck').length;
    turns += b.log.filter((e) => e.k === 'hit' || e.k === 'shot').length;
    assert.equal(b.log.filter((e) => e.k === 'fear' && e.side === 0).length, 0, 'a steady crew never freezes');
  }
  assert.ok(fear > 0 && surge > 0 && luck > 0, `fear ${fear}, surges ${surge}, luck ${luck}`);
  assert.ok(luck / turns < 0.2, `luck stays rare (${luck} of ${turns} blows)`);
});

test("the sea's mind makes only legal moves and finishes the fight", () => {
  for (let k = 0; k < 20; k++) {
    const { bt, rng } = battle(side({ captain: k % 2 ? 'reaver' : 'admiral' }), side({ captain: k % 3 ? 'drowned' : 'smuggler', hands: 40 + k }), k + 1);
    for (let i = 0; i < 3000 && !bt.over; i++) {
      const s = active(bt);
      const c = aiChoice(bt, rng);
      if (c.a === 'move') assert.ok(reachOf(bt, s).has(c.to), 'moves within reach');
      if (c.a === 'attack') assert.ok(meleeTargets(bt, s).some((t) => t.id === c.target), 'strikes one it can reach');
      if (c.a === 'shoot') assert.ok(canShoot(bt, s));
      assert.equal(act(bt, s.side, c, 0, rng), null, JSON.stringify(c));
    }
    assert.ok(bt.over, 'decided');
    assert.ok(bt.round <= 20);
  }
});

test("the captain's clock: a turn left alone for 30 s defends; the sea's side acts after a breath", () => {
  const { bt, rng } = battle(side({ human: true }), side());
  let t = 0;
  for (let i = 0; i < 50 && active(bt).side !== 0; i++) {
    const s = active(bt);
    stepBattle(bt, t + 0.3, rng);
    assert.equal(bt.active, s.id, "the sea's captain takes a breath");
    t += 1;
    stepBattle(bt, t, rng);
  }
  const mine = active(bt);
  assert.equal(mine.side, 0);
  stepBattle(bt, bt.turnEnds - 1, rng);
  assert.equal(bt.active, mine.id, 'the clock still runs');
  stepBattle(bt, bt.turnEnds + 0.1, rng);
  assert.ok(bt.log.some((e) => e.k === 'timeout' && e.s === mine.id), 'timed out');
  assert.ok(mine.defending, 'it defends');
  assert.equal(TAC_TURN, 30);
});

test("the captain's orders: one a round, then a cooldown; the grenades hurt her stack; an officer's word once a fight", () => {
  const { bt, rng } = battle(side({ human: true, captain: 'corsair' }), side());
  for (let i = 0; i < 50 && active(bt).side !== 0; i++) stepBattle(bt, 1 + i, rng);
  const foe = bt.stacks.find((s) => s.side === 1 && s.count > 0)!;
  const n = foe.count;
  assert.equal(act(bt, 0, { a: 'spell', id: 'grenades', target: foe.id }, 0, rng), null);
  assert.ok(foe.count < n, 'the grenades killed');
  assert.equal(act(bt, 0, { a: 'spell', id: 'point_blank', target: foe.id }, 0, rng), "One captain's order a round");
  assert.equal(bt.heroes[0].spells.find((s) => s.id === 'grenades')!.ready, bt.round + 3);
  assert.equal(act(bt, 0, { a: 'spell', id: 'red_harvest' }, 0, rng), 'Your captain has no such order');
  const off = bt.stacks.find((s) => s.side === 0 && s.officer)!;
  off.count = Math.max(1, off.count); // standing, whatever the first blows did
  off.hpTop = off.hpMax;
  bt.active = off.id;
  assert.equal(act(bt, 0, { a: 'order' }, 0, rng), null);
  assert.ok(bt.log.some((e) => e.k === 'order' && e.id === 'rally'));
  bt.active = off.id;
  assert.equal(act(bt, 0, { a: 'order' }, 0, rng), "No officer's order to give");
});

test('balance: even crews win about half; a level up wins clearly; a merchant never beats a warship of her level', () => {
  const even = winRate(side(), side(), 120);
  assert.ok(even > 0.35 && even < 0.65, `even crews: ${even}`);
  // The ladder (canon D12) one level apart: the senior's blows 1.2, the junior's 0.5.
  const up = winRate(side({ dealt: 0.5 }), side({ dealt: 1.2 }), 80);
  assert.ok(up <= 0.05, `a level below wins ${up}`);
  // A trade hull fights two levels below her own: the ladder cuts her blows to 0.3, her hands are no fighters.
  const merchant = winRate(side({ hands: 90, marines: 0, gunners: 8, officers: [], skill: 1, morale: 60, dealt: 0.3 }), side({ dealt: 1.35 }), 80);
  assert.equal(merchant, 0, 'a merchant never wins');
  // Even at the same combat level, as many green hands lose to a warship's drilled crew.
  const green = winRate(side({ hands: 90, marines: 0, gunners: 0, officers: [], skill: 1 }), side({ hands: 50, marines: 20, gunners: 20, skill: 3 }), 60);
  assert.ok(green < 0.25, `green hands against a warship's crew: ${green}`);
});

// ------------------------------------------------------------------ on the ships

function atSea(game: Game, name: string): { c: FakeConn; ship: ShipEntity } {
  const c = join(game, name, 'corsair');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  s.profile!.level = 60;
  ship.loadout.classId = 'brig';
  ship.recompute(game.now);
  ship.crew = ship.stats.crewMax;
  ship.morale = 80;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, ship };
}

function foeAlongside(game: Game, ship: ShipEntity, crew = 40, role: 'pirate' | 'merchant' = 'pirate', cls: 'brig' | 'fluyt' = 'brig'): ShipEntity {
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const npc = game.spawnNpcShip(role, cls, 'free', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  npc.hull = npc.stats.hullMax * 0.4;
  npc.crew = crew;
  npc.morale = 80;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

test("on the ships: a captain's boarding opens the battle, the server checks every order, quick combat ends it into the plunder", () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const { c, ship } = atSea(game, 'Hexer');
  const npc = foeAlongside(game, ship, 30);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  const bt = ship.boarding?.fight.tac;
  assert.ok(bt, 'the battle is laid out');
  const v = c.last('board_tac')?.view;
  assert.ok(v && v.you === 0 && v.stacks.length >= 4, 'the captain sees the field');
  assert.equal(c.last('board_fight'), undefined, 'not the round-by-round screen');
  assert.equal(v.stacks.filter((s) => s.side === 0).reduce((n, s) => n + s.count, 0), ship.crew, 'the whole crew is on deck');
  assert.equal(v.stacks.filter((s) => s.side === 1).reduce((n, s) => n + s.count, 0), npc.crew);
  c.push({ t: 'board_tactic', tactic: 'volley' });
  assert.ok(c.all('toast').some((e) => /turn by turn/.test(e.msg)), 'the old orders do not work here');
  const crew0 = ship.crew, foe0 = npc.crew;
  c.push({ t: 'tac', act: { a: 'quick' } });
  assert.ok(bt.over, 'quick combat decided it');
  // (the beaten who came over to her as it ended joined it: owner, 2026-10-08, crew.ts beatenJoin)
  const came = (ship.boarding?.fight.tacJoined?.[0] ?? []).reduce((n, x) => n + x.n, 0);
  assert.equal(ship.crew, crew0 - Math.min(bt.dead[0], crew0 - Math.max(2, Math.round(crew0 * 0.1))) + came, 'the fallen came off the crew');
  assert.ok(npc.crew < foe0, 'and off hers');
  assert.equal(c.last('board_tac')!.view!.over!.winner, bt.over!.winner);
  // Held while its last blows are played (owner, 2026-10-08), then a moment more.
  steps(game, 200);
  assert.equal(ship.boarding, null, 'the grapples come off');
  assert.equal(c.last('board_tac')!.view, null, 'the battle screen closes');
  assert.equal(bt.over!.winner, 0, 'a full brig carries thirty pirates');
  const r = c.last('boarding')?.result;
  assert.ok(r && r.report?.tac, "the plunder card, with the battle's report");
  assert.equal(r.crewLost, crew0 - ship.crew + came);
  assert.equal(npc.lootLockedFor, ship.id, 'she is his to plunder');
});

test("on the ships: the sea's side plays its own turns; a captain gone from the helm is played for; a merchant never holds", () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const { c, ship } = atSea(game, 'Merchantman');
  const npc = foeAlongside(game, ship, 60, 'merchant', 'fluyt');
  const t0 = sideOf(game, npc, ship, false);
  assert.equal(t0.marines, 0, 'no marines on a merchant');
  assert.ok(t0.dealt < 1, 'a trade hull fights below her level');
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  const bt = ship.boarding!.fight.tac!;
  assert.ok(bt);
  // The captain leaves the helm: his side is played for.
  const real = game.sessionOf.bind(game);
  game.sessionOf = (x) => (x === ship ? null : real(x));
  for (let i = 0; i < 20 * 400 && !bt.over; i++) game.step();
  assert.ok(bt.heroes[0].auto, 'auto-battle took the helm');
  assert.ok(bt.over, 'the fight ran to its end');
  assert.equal(bt.over!.winner, 0, 'the brig carries the merchant');
});

test('the old deck fight stays: the setting off, or a captain who asked for it', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Oldhand');
  const npc = foeAlongside(game, ship);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  assert.ok(ship.boarding && !ship.boarding.fight.tac && c.last('board_fight')?.view, 'setting off: round by round');
  const g2 = makeGame().game;
  g2.tacticalBoarding = true;
  const o = atSea(g2, 'Stubborn');
  o.c.push({ t: 'board_pref', classic: true });
  const n2 = foeAlongside(g2, o.ship);
  o.c.push({ t: 'board', target: n2.id, aggression: 'standard' });
  assert.ok(o.ship.boarding && !o.ship.boarding.fight.tac, 'his choice: round by round');
});

test('a captain back at the helm mid-boarding (a reload) sees her fight at once (QA, 2026-10-04)', async () => {
  const { PROTOCOL_VERSION } = await import('../shared/src/constants.ts');
  const { FakeConn: Conn } = await import('./helpers.ts');
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const { c, ship } = atSea(game, 'Reloader');
  const npc = foeAlongside(game, ship, 30);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  assert.ok(ship.boarding?.fight.tac, 'the battle is laid out');
  const token = c.last('welcome')!.token;
  // The page reloads: a new line with her token, the fight still running on the server.
  const c2 = new Conn();
  game.attach(c2 as unknown as import('../server/src/net/websocket.ts').WsConnection);
  c2.push({ t: 'hello', v: PROTOCOL_VERSION, token });
  const v = c2.last('board_tac')?.view;
  assert.ok(v && v.stacks.length >= 4, 'the field is sent with the login');
  const iInit = c2.inbox.findIndex((m) => m.t === 'init'), iTac = c2.inbox.findIndex((m) => m.t === 'board_tac');
  assert.ok(iInit >= 0 && iTac > iInit, 'after the init, which would clear it');
});
