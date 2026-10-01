// The boarding battle fought with the ships' armies (docs/17 H1, «as in Heroes III»): every stack of her army on deck,
// the specials of each kind of man (double strike, no retaliation, answering every blow, the sweep, the swivel's
// burst, the shield wall, shooters without penalty, leaders, the undead and the terror of the deep), what the guns
// left of the decks (holes, fires, dismounted guns), the captain's four-page order book, the ransom, the fallen off
// their own stacks and the victor's experience — and the loop it closes: the guns soften her men, then you board.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { armyForLevel, armyMen } from '../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../shared/src/data/army.ts';
import { TAC_BLOCKING, TAC_BOOK, TAC_W, hexIndex, hexNeighbors } from '../shared/src/data/tactical.ts';
import { act, blow, buildStacks, castSpell, killedHp, lossesOf, makeField, moralePoints, newBattle, quickFinish, scarDeck, stackMorale } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput, TacStack } from '../server/src/game/tacbattle.ts';
import { deckState, sideOf } from '../server/src/game/tactical.ts';
import { headingVec } from '../shared/src/math.ts';
import { startBoarding } from '../server/src/game/boarding.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame, steps } from './helpers.ts';

const side = (army: ArmyStack[], o: Partial<TacSideInput> = {}): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 0, marines: 0, gunners: 0, army,
  officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...o,
});

function battle(a: ArmyStack[], b: ArmyStack[], seed = 1, oa: Partial<TacSideInput> = {}, ob: Partial<TacSideInput> = {}): { bt: TacBattle; rng: Rng } {
  const rng = new Rng(seed);
  return { bt: newBattle(side(a, oa), side(b, ob), seed, 0, rng), rng };
}

const of = (bt: TacBattle, side: 0 | 1, u: UnitId): TacStack => bt.stacks.find((s) => s.side === side && s.unit === u)!;
const free = (bt: TacBattle, hex: number, but: number[] = []): number => hexNeighbors(hex).find((h) => !TAC_BLOCKING.has(bt.cells[h]) && bt.cells[h] !== 'F' && !but.includes(h) && !bt.stacks.some((s) => s.count > 0 && s.hex === h))!;

/** `x` of side 0 alongside `y` of side 1 in the waist, the rest out of the way, and `x` to act. */
function faceOff(bt: TacBattle, x: TacStack, y: TacStack): void {
  for (const s of bt.stacks) if (s !== x && s !== y) s.hex = s.side ? hexIndex(TAC_W - 1, 0) : hexIndex(0, 8);
  x.hex = hexIndex(3, 4) !== bt.cells.indexOf('M') && !TAC_BLOCKING.has(bt.cells[hexIndex(3, 4)]) ? hexIndex(3, 4) : hexIndex(3, 6);
  y.hex = free(bt, x.hex);
  bt.active = x.id;
}

function winRate(a: ArmyStack[], b: ArmyStack[], n: number, oa: Partial<TacSideInput> = {}, ob: Partial<TacSideInput> = {}): number {
  let w = 0;
  for (let k = 0; k < n; k++) {
    const { bt, rng } = battle(a, b, k * 31 + 7, oa, ob);
    quickFinish(bt, 0, rng);
    if (bt.over!.winner === 0) w++;
  }
  return w / n;
}

test('every stack of the army goes on deck as it stands; an officer leads the strongest melee stack without taking its men', () => {
  const army: ArmyStack[] = [{ u: 'guard', n: 6 }, { u: 'boarder', n: 10 }, { u: 'marine', n: 20 }, { u: 'musketeer', n: 12 }, { u: 'gunner', n: 5 }, { u: 'deckhand', n: 40 }, { u: 'sailor', n: 15 }];
  const cells = makeField(4);
  const st = buildStacks(side(army, { officers: [{ id: 'o1', role: 'lieutenant', name: 'Ansel Pike', level: 4, lucky: false }] }), 0, cells, 1);
  assert.equal(st.length, 7, 'seven stacks, seven slots');
  assert.equal(st.reduce((n, s) => n + s.count, 0), armyMen(army), 'every man, none made up');
  for (const s of st) assert.ok(!TAC_BLOCKING.has(cells[s.hex]) && s.hex % TAC_W <= 3, `${s.unit} on her own deck`);
  assert.equal(new Set(st.map((s) => s.hex)).size, 7, 'one stack a hex');
  const led = st.find((s) => s.officer)!;
  assert.equal(led.unit, 'guard', 'the officer leads the guard');
  assert.equal(led.count, 6);
  assert.ok(st.find((s) => s.unit === 'musketeer')!.shots > 0 && st.find((s) => s.unit === 'gunner')!.sp.includes('blast'));
  // Shooters behind the steel.
  const col = (s: TacStack) => s.hex % TAC_W;
  assert.ok(col(st.find((s) => s.unit === 'musketeer')!) < col(st.find((s) => s.unit === 'deckhand')!));
});

test('double strike: two blows and the answer between; no retaliation: none; answering every blow: twice in a round', () => {
  {
    const { bt, rng } = battle([{ u: 'boarder', n: 10 }], [{ u: 'deckhand', n: 60 }]);
    const x = of(bt, 0, 'boarder'), y = of(bt, 1, 'deckhand');
    faceOff(bt, x, y);
    assert.equal(act(bt, 0, { a: 'attack', target: y.id }, 0, rng), null);
    const ks = bt.log.filter((e) => e.s === x.id && e.k === 'hit').length;
    assert.equal(ks, 2, 'the boarders strike twice');
    assert.equal(bt.log.filter((e) => e.k === 'ret').length, 1, 'answered once, between the blows');
  }
  {
    const { bt, rng } = battle([{ u: 'cutthroat', n: 10 }], [{ u: 'deckhand', n: 200 }]);
    const x = of(bt, 0, 'cutthroat'), y = of(bt, 1, 'deckhand');
    faceOff(bt, x, y);
    act(bt, 0, { a: 'attack', target: y.id }, 0, rng);
    assert.equal(bt.log.filter((e) => e.k === 'ret').length, 0, 'the cutthroats are never answered');
    assert.equal(y.ret, true, 'her answer is still hers for another');
  }
  {
    const { bt, rng } = battle([{ u: 'marine', n: 30 }, { u: 'sailor', n: 30 }], [{ u: 'life_guard', n: 20 }]);
    const x = of(bt, 0, 'marine'), x2 = of(bt, 0, 'sailor'), y = of(bt, 1, 'life_guard');
    faceOff(bt, x, y);
    x2.hex = free(bt, y.hex, [x.hex]);
    act(bt, 0, { a: 'attack', target: y.id }, 0, rng);
    bt.active = x2.id;
    act(bt, 0, { a: 'attack', target: y.id }, 0, rng);
    assert.equal(bt.log.filter((e) => e.k === 'ret' && e.s === y.id).length, 2, 'the life guard answers both');
  }
});

test('the sweep strikes every foe beside it unanswered; the swivel burst hits the stacks beside her target', () => {
  {
    const { bt, rng } = battle([{ u: 'deep_spawn', n: 8 }], [{ u: 'deckhand', n: 50 }, { u: 'sailor', n: 50 }]);
    const x = of(bt, 0, 'deep_spawn'), y = of(bt, 1, 'deckhand'), y2 = of(bt, 1, 'sailor');
    faceOff(bt, x, y);
    y2.hex = free(bt, x.hex, [y.hex]);
    act(bt, 0, { a: 'attack', target: y.id }, 0, rng);
    const hit = new Set(bt.log.filter((e) => e.k === 'hit' && e.s === x.id).map((e) => e.t));
    assert.ok(hit.has(y.id) && hit.has(y2.id), 'both struck');
    assert.equal(bt.log.filter((e) => e.k === 'ret').length, 0, 'none answers');
  }
  {
    const { bt, rng } = battle([{ u: 'gunner', n: 10 }], [{ u: 'deckhand', n: 60 }, { u: 'sailor', n: 60 }]);
    const g = of(bt, 0, 'gunner'), t = of(bt, 1, 'deckhand'), t2 = of(bt, 1, 'sailor');
    for (const s of bt.stacks) if (s.side === 1) s.hex = -1;
    t.hex = hexIndex(7, 4);
    t2.hex = free(bt, t.hex);
    g.hex = hexIndex(0, 4);
    bt.active = g.id;
    assert.equal(act(bt, 0, { a: 'shoot', target: t.id }, 0, rng), null);
    const shots = bt.log.filter((e) => e.k === 'shot' && e.s === g.id);
    assert.ok(shots.some((e) => e.t === t.id) && shots.some((e) => e.t === t2.id && e.id === 'blast'), 'the burst takes the neighbour too');
  }
});

test('shooters: the shield wall halves a shot, the sharpshooter has no penalty far or near, a musket is a poor club', () => {
  const { bt } = battle([{ u: 'musketeer', n: 20 }, { u: 'sharpshooter', n: 20 }], [{ u: 'sea_guard', n: 20 }, { u: 'marine', n: 20 }]);
  const m = of(bt, 0, 'musketeer'), s = of(bt, 0, 'sharpshooter'), wall = of(bt, 1, 'sea_guard'), plain = of(bt, 1, 'marine');
  const shotOn = (x: TacStack, t: TacStack) => blow(bt, x, t, 'shot', null).dmg;
  const saved = wall.sp;
  const walled = shotOn(m, wall);
  wall.sp = [];
  assert.ok(Math.abs(walled / shotOn(m, wall) - 0.5) < 0.08, 'half through the shield wall');
  wall.sp = saved;
  // Range: the same target far and near.
  plain.hex = hexIndex(TAC_W - 1, 4);
  m.hex = s.hex = -1;
  m.hex = hexIndex(0, 4);
  s.hex = hexIndex(0, 2);
  const farM = shotOn(m, plain), farS = shotOn(s, plain);
  plain.hex = hexIndex(4, 4);
  const nearM = shotOn(m, plain), nearS = shotOn(s, plain);
  assert.ok(nearM / farM > 1.8, 'the musketeers at half beyond range');
  assert.ok(Math.abs(nearS / farS - 1) < 0.05, 'the sharpshooters are not');
  const club = blow(bt, m, plain, 'melee', null).dmg, clubS = blow(bt, s, plain, 'melee', null).dmg;
  assert.ok(club < nearM * 0.7, 'a musket is a poor club');
  assert.ok(clubS > club * 1.5, 'the sharpshooter strikes full at arm\'s length');
});

test('morale: a guard leads, the undead feel nothing, the deep\'s terror freezes the living and never the steady', () => {
  const { bt } = battle([{ u: 'guard', n: 10 }, { u: 'deckhand', n: 50 }], [{ u: 'deckhand', n: 60 }], 3, { morale: 50 }, { morale: 50 });
  assert.equal(moralePoints(bt, 0) - moralePoints(bt, 1), 1, 'the guard is worth a point of morale');
  const d = battle([{ u: 'deckhand', n: 60 }], [{ u: 'drowned', n: 20 }], 3, {}, { morale: 0 }).bt;
  assert.equal(stackMorale(d, of(d, 1, 'drowned')), 0, 'the drowned feel no despair');
  let terror = 0, steadyFroze = 0, deadFroze = 0;
  for (let k = 0; k < 30; k++) {
    const { bt: b, rng } = battle([{ u: 'deckhand', n: 60 }, { u: 'guard', n: 10 }], [{ u: 'drowned', n: 12 }, { u: 'deckhand', n: 40 }], k + 50, { morale: 60 }, { morale: 10 });
    quickFinish(b, 0, rng);
    terror += b.log.filter((e) => e.k === 'fear' && e.id === 'terror').length;
    const guard = of(b, 0, 'guard'), dead = of(b, 1, 'drowned');
    steadyFroze += b.log.filter((e) => e.k === 'fear' && e.s === guard.id).length;
    deadFroze += b.log.filter((e) => e.k === 'fear' && e.s === dead.id).length;
  }
  assert.ok(terror > 0, `the living froze in terror ${terror} times`);
  assert.equal(steadyFroze, 0, 'the steady guard never');
  assert.equal(deadFroze, 0, 'the drowned never, however low her crew\'s heart');
});

test('what the guns left of her deck: holes with no footing, fires that burn a stack as its turn comes, dismounted swivels', () => {
  const cells = makeField(9);
  scarDeck(cells, 1, 3, true, 9);
  const holes = cells.map((c, i) => [c, i] as const).filter(([c]) => c === 'H');
  assert.equal(holes.length, 3);
  for (const [, i] of holes) assert.ok(i % TAC_W > 5, 'on her own deck');
  assert.ok(TAC_BLOCKING.has('H') && !TAC_BLOCKING.has('F'));
  assert.equal(cells.filter((c) => c === 'F').length, 3);
  for (const [, i] of holes) assert.ok(!hexNeighbors(i).some((j) => cells[j] === '='), 'the planks stay open');
  // A stack standing in the fire burns as its turn comes.
  const { bt, rng } = battle([{ u: 'deckhand', n: 40 }], [{ u: 'deckhand', n: 40 }], 5, { fire: true }, {});
  const x = bt.stacks.find((s) => s.side === 0)!;
  const f = bt.cells.findIndex((c) => c === 'F');
  assert.ok(f >= 0 && f % TAC_W < 5, 'her fire is on her own deck');
  x.hex = f;
  const n0 = x.count;
  for (let i = 0; i < 40 && !bt.log.some((e) => e.k === 'burn'); i++) act(bt, bt.stacks.find((s) => s.id === bt.active)!.side, { a: 'defend' }, 0, rng);
  const burn = bt.log.find((e) => e.k === 'burn');
  assert.ok(burn && burn.s === x.id && x.count < n0, 'burned');
  // Dismounted guns: the swivel crews have fewer charges and lighter ones.
  const whole = buildStacks(side([{ u: 'gunner', n: 10 }]), 0, makeField(2), 1)[0];
  const broken = buildStacks(side([{ u: 'gunner', n: 10 }], { gunsOut: 0.6 }), 0, makeField(2), 1)[0];
  assert.ok(broken.shots < whole.shots && broken.dmgMul < 1, `${whole.shots} → ${broken.shots} charges, ×${broken.dmgMul}`);
});

test('the order book: four orders a captain, one a round; Mark Target, Double Shot, Brine Mend and War Cry do what they say', () => {
  for (const c of Object.keys(TAC_BOOK) as (keyof typeof TAC_BOOK)[]) {
    assert.equal(TAC_BOOK[c].length, 4, c);
    assert.ok(TAC_BOOK[c].includes('grenades'));
  }
  const { bt, rng } = battle([{ u: 'marine', n: 30 }, { u: 'musketeer', n: 20 }], [{ u: 'deckhand', n: 80 }], 2, { captain: 'corsair' }, { captain: 'drowned' });
  const t = of(bt, 1, 'deckhand'), m = of(bt, 0, 'marine'), mu = of(bt, 0, 'musketeer');
  const plain = blow(bt, m, t, 'melee', null).dmg;
  bt.heroes[0].cast = 0;
  assert.equal(castSpell(bt, 0, 'mark_target', t.id, rng), null);
  assert.ok(blow(bt, m, t, 'melee', null).dmg > plain * 1.2, 'marked: harder');
  assert.equal(castSpell(bt, 0, 'double_shot', undefined, rng), "One captain's order a round");
  bt.round++;
  const shots = mu.shots;
  assert.equal(castSpell(bt, 0, 'double_shot', undefined, rng), null);
  assert.equal(mu.shots, shots + 1, 'a shot more');
  // The Drowned captain's book: Brine Mend raises her fallen.
  t.count = 40;
  const hp0 = (t.count - 1) * t.hpMax + t.hpTop;
  assert.equal(castSpell(bt, 1, 'brine_mend', undefined, rng), null);
  assert.ok((t.count - 1) * t.hpMax + t.hpTop > hp0, 'healed');
  bt.round++;
  const m0 = moralePoints(bt, 0);
  assert.equal(castSpell(bt, 1, 'war_cry', undefined, rng), null);
  assert.ok(moralePoints(bt, 0) < m0, 'her war cry shakes our morale');
  assert.equal(castSpell(bt, 0, 'war_cry', undefined, rng), 'Your captain has no such order', 'not in the corsair\'s book');
});

test('balance of armies: even armies even, a ⚓9 crew carries a ⚓3 one of its number, and the guns that thin her men decide the boarding', () => {
  const a5 = armyForLevel(5, 100, 6, 'pirate');
  const even = winRate(a5, a5, 60);
  assert.ok(even > 0.3 && even < 0.7, `even armies: ${even}`);
  const hi = winRate(armyForLevel(9, 100, 7, 'navy'), armyForLevel(3, 100, 7, 'navy'), 40);
  assert.ok(hi >= 0.9, `⚓9 against ⚓3, the same men: ${hi}`);
  // Gunnery softens, then you board: a third of her men shot away before the grapples bite.
  const thinned = armyForLevel(5, 100, 6, 'pirate');
  let left = 34;
  for (const s of thinned) {
    const k = Math.min(s.n - 1, Math.round(s.n * 0.34));
    s.n -= Math.min(k, left);
    left -= Math.min(k, left);
  }
  const after = winRate(a5, thinned, 60);
  assert.ok(after >= 0.85, `after the grape: ${after}`);
  // The sea's merchant hands are hardly a match for a warship's army of her count (on the hulls the ladder makes it
  // none: tests/balance/tactical.test.ts).
  assert.ok(winRate(armyForLevel(5, 100, 6, 'merchant'), armyForLevel(5, 100, 6, 'navy'), 40, { skill: 1 }, { skill: 3 }) <= 0.05);
});

// ------------------------------------------------------------------ on the ships

function atSea(game: Game, name: string): { c: ReturnType<typeof join>; ship: ShipEntity } {
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
  s.profile!.level = 30;
  ship.loadout.classId = 'brig';
  ship.loadout.level = 5;
  ship.recompute(game.now);
  ship.hull = ship.stats.hullMax;
  ship.crew = ship.stats.crewMax;
  ship.setArmy(armyForLevel(5, ship.crew, ship.armySlots, 'player'));
  ship.morale = 80;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, ship };
}

function alongside(game: Game, ship: ShipEntity, role: 'pirate' | 'merchant' = 'pirate'): ShipEntity {
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const npc = game.spawnNpcShip(role, 'brig', 'free', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading);
  game.setNpcLevel(npc, 5);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  npc.morale = 80;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

test('on the ships: her army as it stands, the fallen off their own stacks, the victor learns, the reckoning on the banner', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const { c, ship } = atSea(game, 'Hexer');
  const npc = alongside(game, ship);
  npc.crew = 40;
  npc.hull = npc.stats.hullMax;
  const sideIn = sideOf(game, ship, npc, true);
  assert.deepEqual(sideIn.army!.map((x) => x.u).sort(), ship.army.map((x) => x.u).concat(sideIn.army!.length > ship.army.length ? ['marine'] : []).sort());
  const before = new Map(ship.army.map((x) => [x.u, x.n]));
  const xp0 = [...game.sessions][0].profile!.xp;
  const lvl0 = [...game.sessions][0].profile!.level;
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  const bt = ship.boarding?.fight.tac;
  assert.ok(bt, 'boarded at once, her hull whole');
  const v = c.last('board_tac')!.view!;
  assert.ok(v.stacks.every((s) => s.unit && Array.isArray(s.sp)), 'the kinds of men on the field');
  c.push({ t: 'tac', act: { a: 'quick' } });
  assert.ok(bt.over);
  // What each kind lost in the battle came off that kind aboard.
  const lost = lossesOf(bt, 0);
  const floor = Math.max(2, Math.round(bt.heroes[0].startMen * 0.1));
  if (bt.dead[0] <= bt.heroes[0].startMen - floor) {
    for (const x of lost) assert.equal((before.get(x.u) ?? 0) - (ship.army.find((s) => s.u === x.u)?.n ?? 0), x.n, `${x.u}: ${x.n} fallen`);
  }
  assert.equal(ship.crew, armyMen(ship.army));
  assert.equal(bt.over!.winner, 0, 'a full brig carries forty pirates');
  const r = c.last('board_tac')!.view!.result!;
  assert.ok(r && r.killed.length > 0 && r.xp === Math.round(killedHp(bt, 0) * 0.2) && r.xp > 0, 'the reckoning: her losses and your experience');
  const p = [...game.sessions][0].profile!;
  assert.ok(p.level > lvl0 || p.xp > xp0, 'the captain learnt from it');
  steps(game, 60);
  assert.equal(ship.boarding, null);
  assert.equal(npc.lootLockedFor, ship.id, 'she is his to plunder');
});

test('the ransom: attacked by the sea, a captain pays the boarders off — no prize taken, her men and hold her own', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const { c, ship } = atSea(game, 'Payer');
  const s = [...game.sessions].find((x) => x.name === 'Payer')!;
  s.profile!.gold = 50000;
  const npc = alongside(game, ship);
  const purse0 = npc.purse;
  startBoarding(game, npc, ship, 'standard');
  const bt = ship.boarding!.fight.tac!;
  assert.ok(bt, 'the battle on the hexes');
  const v = c.last('board_tac')!.view!;
  assert.equal(v.you, 1);
  assert.ok(v.ransom && v.ransom >= 100, `a ransom is offered: ${v.ransom}`);
  const cost = v.ransom!;
  const men = ship.crew;
  c.push({ t: 'tac', act: { a: 'ransom' } });
  assert.equal(bt.over?.why, 'ransom');
  assert.equal(s.profile!.gold, 50000 - cost, 'the silver paid');
  assert.equal(npc.purse, purse0 + cost, 'into her captain\'s purse');
  assert.equal(c.last('board_tac')!.view!.result!.paid, cost);
  steps(game, 60);
  assert.equal(ship.boarding, null, 'the grapples come off');
  assert.equal(ship.surrendered, false);
  assert.equal(ship.lootLockedFor, null, 'nothing taken');
  assert.equal(ship.crew, men, 'her men her own');
  // A boarder is not offered it.
  const { game: g2 } = makeGame();
  g2.tacticalBoarding = true;
  const o = atSea(g2, 'Boarder');
  const n2 = alongside(g2, o.ship);
  o.c.push({ t: 'board', target: n2.id, aggression: 'standard' });
  assert.equal(o.c.last('board_tac')!.view!.ransom, null);
  o.c.push({ t: 'tac', act: { a: 'ransom' } });
  assert.ok(o.c.all('toast').some((t) => /fall back/.test(t.msg)));
});

test('her deck as the guns left it goes to the battle: holes by her hull lost and her leaks, dismounted guns, a fire', () => {
  const { game } = makeGame();
  const s = game.spawnNpcShip('pirate', 'brig', 'free', 30000, 80000, 0);
  game.setNpcLevel(s, 5);
  assert.deepEqual(deckState(s), { holes: 0, gunsOut: 0, fire: false });
  s.hull = s.stats.hullMax * 0.3;
  s.leaks = 1;
  s.gunsDisabled.port = s.stats.gunsPerSide;
  s.addEffect({ id: 'fire', until: game.now + 20 }, game.now);
  const d = deckState(s);
  assert.ok(d.holes >= 3 && d.holes <= 4 && Math.abs(d.gunsOut - 0.5) < 1e-9 && d.fire, JSON.stringify(d));
});

test('lashed in a boarding: no third ship may fire on, hunt or board either of them until it is over', async () => {
  const { applyDamage, damageBlocked } = await import('../server/src/game/combat.ts');
  const { canBoard } = await import('../server/src/game/boarding.ts');
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const { ship } = atSea(game, 'Lashed');
  const npc = alongside(game, ship);
  startBoarding(game, npc, ship, 'standard');
  assert.ok(ship.grappled && npc.grappled);
  const v = headingVec(ship.state.heading + Math.PI / 2);
  const third = game.spawnNpcShip('pirate', 'brig', 'free', ship.state.x + v.x * 60, ship.state.y + v.y * 60, ship.state.heading);
  game.setNpcLevel(third, 5);
  game.npcs.get(third.id)!.active = true;
  game.grid.upsert(third.id, third.state.x, third.state.y);
  assert.ok(damageBlocked(game, third, ship), 'no firing on the captain');
  assert.ok(damageBlocked(game, third, npc), 'nor on her foe');
  assert.equal(damageBlocked(game, npc, ship), null, 'the two in it are still each other\'s');
  const hull = ship.hull;
  assert.equal(applyDamage(game, ship, { hull: 500, crew: 10 }, third), 0);
  assert.equal(ship.hull, hull);
  assert.ok(canBoard(game, third, ship), 'and nobody else throws grapples on her');
  steps(game, 40);
  assert.notEqual(game.npcs.get(third.id)?.target ?? null, ship.id, 'the pirate does not hunt a ship in a boarding');
});
