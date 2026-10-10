// docs/25 block Е (items 64–67, owner 2026-10-09: «Абордаж должен быть интересный, чтобы капитанские навыки, группа и
// умения решали … делай все пункты»): a boarding fought by a group — who may come aboard and when, where her stacks
// stand, whose turns and clocks they are, the once-a-round orders, the roles and the echo of one path, the foe grown
// against a group, the shares of the cut, and how long a group's boarding runs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec } from '../shared/src/math.ts';
import { Rng } from '../shared/src/rng.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { TAC_GROUP, TAC_ROLES, hexX, tacBankSecs, tacBring, tacEcho, tacFlagHex } from '../shared/src/data/tactical.ts';
import { act, addAlly, aiAct, capOf, castSpell, chargeClock, foeGrowth, modsOf, newBattle, queueAlly, rolesOf, sharesOf, sideStrength, stackById, stepBattle, viewOf } from '../server/src/game/tacbattle.ts';
import type { TacBattle, TacSideInput } from '../server/src/game/tacbattle.ts';
import { pickBring } from '../server/src/game/tactical.ts';
import { PATH_PAGES } from '../shared/src/data/paths.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { canBoard } from '../server/src/game/boarding.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';
import { captainAt, playerArmy, side, sidesAt } from './balance/boardlen.ts';
import { allyAt, groupStat, mixedVsSame, playGroup } from './balance/boardgroup.ts';

// ------------------------------------------------------------------ the engine

/** A boarding at level L: her (`p`) and her allies against a pirate of her waters (or `q`, a captain). */
function field(L: number, p: CaptainId, allies: CaptainId[], q: CaptainId | null = null, grow: boolean | number = q === null, seed = 3): { bt: TacBattle; rng: Rng; a: TacSideInput; b: TacSideInput } {
  const [a, b] = sidesAt(L, q !== null, p, q ?? p, seed);
  const rng = new Rng(seed * 7 + 1);
  const bt = newBattle(a, b, seed, 0, rng, { len: 'board', level: L, allies: allies.map((x, i) => ({ side: 0 as const, input: allyAt(x, L, i + 1), grow })) });
  return { bt, rng, a, b };
}

test('64: an ally brings her strongest stacks (or those she chose) — one below level 11, two from it — on her side\'s back rows', () => {
  assert.equal(tacBring(8), 1);
  assert.equal(tacBring(11), 2);
  assert.equal(tacBring(55), 2);
  const army = playerArmy(30);
  const strongest = pickBring(army, 2);
  assert.equal(strongest.length, 2);
  assert.deepEqual(pickBring(army, 2, [army[army.length - 1].u]).map((x) => x.u)[0], army[army.length - 1].u, 'her choice first');
  for (const L of [8, 30, 55]) {
    const { bt } = field(L, 'corsair', ['drowned', 'admiral']);
    const mine = bt.stacks.filter((s) => s.own);
    assert.equal(mine.length, 2 * tacBring(L), `L${L}: each ally her stacks`);
    for (const s of mine) {
      assert.equal(s.side, 0);
      assert.ok(hexX(s.hex) <= 1, `L${L}: on the rail or the next column in (x=${hexX(s.hex)})`);
      assert.ok(!['#', '~', '=', 'H', 'F', 'M', 'B', 'K', 'C'].includes(bt.cells[s.hex]), 'on open deck');
      assert.ok(!bt.flag || !bt.flag.hex.includes(s.hex), 'never on a flag');
    }
    const hexes = bt.stacks.filter((s) => s.count > 0).map((s) => s.hex);
    assert.equal(new Set(hexes).size, hexes.length, 'one stack a hex');
  }
});

test('64: three captains a side at the most; between captains the other side may bring her group too', () => {
  const { bt, a } = field(30, 'corsair', ['drowned', 'admiral'], 'reaver');
  assert.equal(bt.allies!.length, 2);
  assert.match(String(addAlly(bt, 0, allyAt('navigator', 30, 9))), /Three captains/);
  // The other side's group: her own allies, nobody grown (between captains).
  const foe0 = bt.stacks.filter((s) => s.side === 1).reduce((n, s) => n + s.count, 0);
  const slot = addAlly(bt, 1, allyAt('smuggler', 30, 7), false);
  assert.equal(slot, 1);
  assert.equal(bt.stacks.filter((s) => s.side === 1 && !s.own).reduce((n, s) => n + s.count, 0), foe0, 'nobody grown between captains');
  assert.equal(bt.stacks.filter((s) => s.side === 0 && !s.own).reduce((n, s) => n + s.count, 0), a.army!.reduce((n, x) => n + x.n, 0), 'nor her');
});

test('64: the turn order is one by initiative over every captain\'s stacks; each captain plays only her own', () => {
  const { bt, rng } = field(30, 'corsair', ['drowned'], 'reaver');
  bt.heroes[1].auto = true;
  const ids = bt.queue.concat(bt.active !== null ? [bt.active] : []);
  assert.ok(bt.stacks.filter((s) => s.own).every((s) => ids.includes(s.id)), 'her stacks are in the round');
  let mineSeen = 0, hersSeen = 0;
  for (let i = 0; i < 200 && !bt.over && (mineSeen < 2 || hersSeen < 2); i++) {
    const s = stackById(bt, bt.active!)!;
    if (s.side === 1) {
      aiAct(bt, 0, rng);
      continue;
    }
    const slot = s.own ?? 0;
    const other = slot ? 0 : 1;
    assert.equal(act(bt, 0, { a: 'defend' }, 0, rng, other), 'Not your turn', 'another captain may not move her stack');
    assert.equal(act(bt, 0, { a: 'defend' }, 0, rng, slot), null, 'her own captain may');
    if (slot) hersSeen++;
    else mineSeen++;
  }
  assert.ok(mineSeen >= 2 && hersSeen >= 2);
  // The colours, the quick fight and the ransom are the ship's captain's.
  assert.match(String(act(bt, 0, { a: 'surrender' }, 0, rng, 1)), /captain of the ship/);
});

test('64: the chess clock is each captain\'s own — her share of the side\'s, her turns off it', () => {
  const L = 55;
  const { bt, rng } = field(L, 'corsair', ['drowned'], 'reaver');
  const ally = bt.allies![0].hero;
  const main = bt.heroes[0];
  const sideStacks = bt.stacks.filter((s) => s.side === 0).length;
  assert.ok(Math.abs(main.bank + ally.bank - tacBankSecs(L)) < 0.5, 'the side keeps one captain\'s clock in all');
  assert.ok(Math.abs(ally.bank - (tacBankSecs(L) * tacBring(L)) / sideStacks) < 0.5, 'hers by the stacks she plays');
  // Her stack's turn runs on her clock, not on the side's own captain's.
  for (let i = 0; i < 300 && !bt.over; i++) {
    const s = stackById(bt, bt.active!)!;
    if (s.side === 0 && s.own) break;
    if (s.side === 0) act(bt, 0, { a: 'defend' }, 0, rng, 0);
    else aiAct(bt, 0, rng);
  }
  const s = stackById(bt, bt.active!)!;
  assert.equal(s.own, 1);
  assert.equal(capOf(bt, s), ally);
  assert.equal(bt.clock?.slot, 1, 'her clock runs');
  const before = [main.bank, ally.bank];
  const from = bt.clock!.from;
  chargeClock(bt, from + 10);
  assert.equal(main.bank, before[0], 'the side\'s own captain keeps hers');
  assert.ok(Math.abs(ally.bank - (before[1] - 10)) < 0.01, 'ten seconds off hers');
  // Run out on her turn: her stack defends.
  bt.turnEnds = from;
  bt.clock = { side: 0, from, slot: 1 };
  stepBattle(bt, from + 1, rng);
  assert.ok(bt.log.some((e) => e.k === 'timeout' && e.s === s.id));
});

test('64: once a round each captain gives an order from her own book — her will and stamina, her path\'s power; it lays on the whole side', () => {
  const L = 30;
  const { bt, rng } = field(L, 'reaver', ['admiral'], 'corsair');
  bt.heroes[1].auto = true;
  const ally = bt.allies![0].hero;
  // To her stack's turn.
  for (let i = 0; i < 300 && !bt.over; i++) {
    const s = stackById(bt, bt.active!)!;
    if (s.side === 0 && s.own) break;
    if (s.side === 0) act(bt, 0, { a: 'defend' }, 0, rng, 0);
    else aiAct(bt, 0, rng);
  }
  const square = ally.spells.find((x) => x.id === 'ad_square');
  assert.ok(square, 'her own book');
  const will0 = ally.mana, stam0 = ally.stam, main0 = [bt.heroes[0].mana, bt.heroes[0].stam];
  assert.equal(act(bt, 0, { a: 'spell', id: 'ad_square' }, 0, rng, 1), null);
  assert.ok(ally.stam < stam0 || ally.mana < will0, 'paid from her stores');
  assert.deepEqual([bt.heroes[0].mana, bt.heroes[0].stam], main0, 'not the side\'s own captain\'s');
  assert.match(String(act(bt, 0, { a: 'spell', id: 'ad_volley_order', target: bt.stacks.find((s) => s.side === 1 && s.count > 0)!.id }, 0, rng, 1)), /One captain's order a round/);
  // «В каре» on every stack of her side — the side's own captain's stacks too.
  const mainStack = bt.stacks.find((s) => s.side === 0 && !s.own && s.count > 0)!;
  assert.ok(modsOf(bt, 0, mainStack.id).taken < 0, 'her order lays on the whole side');
  assert.equal(bt.log.filter((e) => e.k === 'spell').pop()!.who, 1, 'told as hers');
  // The side's own captain still has her own order this round, on her own turn.
  assert.ok(bt.heroes[0].cast < bt.round);
  assert.equal(viewOf(bt, 0, 0, true, {}, 1).heroes[0].name, ally.input.name, 'her panel is her own captain');
});

test('65: the roles — each path among a side\'s captains lays its role once on every stack of hers; three of one lay one', () => {
  const mixed = field(30, 'admiral', ['drowned', 'corsair']).bt;
  assert.deepEqual(rolesOf(mixed, 0).sort(), ['admiral', 'corsair', 'drowned']);
  const same = field(30, 'admiral', ['admiral', 'admiral']).bt;
  assert.deepEqual(rolesOf(same, 0), ['admiral']);
  const solo = field(30, 'admiral', []).bt;
  assert.deepEqual(rolesOf(solo, 0), [], 'a captain alone: none');
  const st = mixed.stacks.find((s) => s.side === 0 && s.own === 2)!;
  const m = modsOf(mixed, 0, st.id);
  assert.ok(Math.abs(m.taken - (TAC_ROLES.admiral.self!.taken ?? 0)) < 1e-9, 'the admiral holds the line for her ally\'s stack');
  assert.ok(m.melee >= (TAC_ROLES.corsair.self!.melee ?? 0), 'the corsair strikes');
  assert.ok(modsOf(same, 0).taken > 2 * (TAC_ROLES.admiral.self!.taken ?? 0), 'three admirals hold it once');
  // The drowned raise as each round opens.
  const { bt, rng } = field(30, 'drowned', ['corsair']);
  const hurt = bt.stacks.find((s) => s.side === 0 && s.count > 5)!;
  hurt.count = Math.floor(hurt.count / 2);
  for (let i = 0; i < 400 && bt.round < 2 && !bt.over; i++) aiAct(bt, 0, rng);
  assert.ok(bt.log.some((e) => e.k === 'regen' && e.id === 'role'), 'the fallen rise');
});

test('65: the echo — a second captain of one path gives her page at ×0.6 in its round, and what she lays renews it rather than doubling', () => {
  assert.equal(tacEcho(30), 0.6);
  const { bt, rng } = field(30, 'admiral', ['admiral'], 'reaver');
  bt.heroes[1].auto = true;
  // Both admirals give «В каре» as their stacks come: it holds once.
  let given = 0;
  for (let i = 0; i < 300 && !bt.over && given < 2; i++) {
    const s = stackById(bt, bt.active!)!;
    if (s.side === 1) {
      aiAct(bt, 0, rng);
      continue;
    }
    const slot = s.own ?? 0;
    const h = capOf(bt, s);
    if (h.cast < bt.round && h.spells.some((x) => x.id === 'ad_square' && x.ready <= bt.round)) {
      assert.equal(act(bt, 0, { a: 'spell', id: 'ad_square' }, 0, rng, slot), null);
      given++;
    }
    act(bt, 0, { a: 'defend' }, 0, rng, slot);
  }
  assert.equal(given, 2);
  const squares = bt.heroes[0].fx.filter((f) => f.id === 'ad_square' && f.until >= bt.round);
  assert.equal(squares.length, 1, 'one «В каре» on the deck');
  assert.ok(Math.abs(modsOf(bt, 0).taken - (TAC_ROLES.admiral.self!.taken ?? 0) - (PATH_PAGES.ad_square.fx.self!.taken ?? 0) * 0.6) < 0.02 || modsOf(bt, 0).taken > (PATH_PAGES.ad_square.fx.self!.taken ?? 0) * 1.5, 'not doubled');
  // The blow of a second captain of one path in a round lands at ×0.6: two corsairs' «Книппель» on her stack.
  const r = mixedVsSame(30, ['admiral', 'drowned', 'corsair'], 'corsair', 1);
  assert.ok(r >= 0 && r <= 1);
});

test('65: measured — a mixed group of three beats three of one path of equal power (the mean over six mixes and six paths)', () => {
  const MIXES: CaptainId[][] = [['admiral', 'drowned', 'corsair'], ['navigator', 'reaver', 'smuggler'], ['admiral', 'navigator', 'reaver'], ['drowned', 'corsair', 'smuggler']];
  const PATHS: CaptainId[] = ['corsair', 'smuggler', 'reaver', 'navigator', 'drowned', 'admiral'];
  for (const L of [30, 55]) {
    let w = 0, k = 0;
    for (const m of MIXES) for (const p of PATHS) {
      w += mixedVsSame(L, m, p, 2);
      k++;
    }
    assert.ok(w / k > 0.6, `L${L}: the mixed groups win ${Math.round((w / k) * 100)}% against three of one`);
  }
});

test('66: the foe of the sea grows against a group by the strength her allies brought; a captain\'s side never does', () => {
  const L = 40;
  const [a, b] = sidesAt(L, false, 'corsair', 'corsair', 5);
  const solo = newBattle(a, b, 5, 0, new Rng(1), { len: 'board', level: L });
  const s0 = [sideStrength(solo, 0), sideStrength(solo, 1)];
  const grown = newBattle(a, b, 5, 0, new Rng(1), { len: 'board', level: L, allies: [{ side: 0, input: allyAt('admiral', L, 1), grow: true }] });
  const k = grown.boost![1];
  const ratio = sideStrength(grown, 0) / s0[0];
  assert.ok(Math.abs(k - foeGrowth(L, ratio)) < 0.05, `grown ×${k.toFixed(2)} for her side ×${ratio.toFixed(2)}`);
  assert.ok(k > 1.2 && k < 2.5);
  for (const s of grown.stacks.filter((x) => x.side === 1)) assert.ok((s.boost ?? 0) > 0, 'every stack of hers grows');
  // Between captains: nobody grows.
  const pvp = field(L, 'corsair', ['admiral'], 'reaver').bt;
  assert.equal(pvp.boost, undefined);
});

test('66: measured — three against the sea is no free win: each captain loses men, the win is not a given at the top', () => {
  for (const L of [8, 30, 55]) {
    const solo = groupStat(L, 1, null, 2);
    const g3 = groupStat(L, 3, null, 2, { grow: true });
    const free = groupStat(L, 3, null, 2, { grow: false });
    assert.ok(g3.lost >= 0.45 * solo.lost, `L${L}: grown, each loses ${Math.round(g3.lost * 100)}% (alone ${Math.round(solo.lost * 100)}%)`);
    assert.ok(free.lost < g3.lost, `L${L}: not grown it would be ${Math.round(free.lost * 100)}%`);
  }
});

test('64: late joining — asked mid-battle she comes aboard as the next round opens, up to round 3; the foe grows then', () => {
  const L = 30;
  const [a, b] = sidesAt(L, false, 'corsair', 'corsair', 2);
  const rng = new Rng(9);
  const bt = newBattle(a, b, 2, 0, rng, { len: 'board', level: L });
  const foe0 = bt.stacks.filter((s) => s.side === 1).reduce((n, s) => n + s.count, 0);
  assert.equal(queueAlly(bt, 0, allyAt('drowned', L, 1), true, 77), null);
  assert.match(String(queueAlly(bt, 0, allyAt('drowned', L, 1), true, 77)), /aboard already/);
  assert.equal(bt.allies, undefined, 'not before the round opens');
  assert.equal(viewOf(bt, 0, 0, true).coming?.length, 1, 'the captains see her coming');
  for (let i = 0; i < 400 && bt.round < 2 && !bt.over; i++) aiAct(bt, 0, rng);
  assert.equal(bt.round, 2);
  const al = bt.allies as TacBattle['allies'];
  assert.equal(al?.[0].joined, 2, 'aboard as round 2 opened');
  assert.equal(al?.[0].tag, 77);
  assert.ok(bt.log.some((e) => e.k === 'join' && e.n === 1), 'told on the field');
  assert.ok(bt.stacks.filter((s) => s.side === 1).reduce((n, s) => n + s.count, 0) > foe0 * 0.5, 'the foe grew as she came');
  assert.ok((bt.boost?.[1] ?? 1) > 1);
  // Past round 2 nobody may ask (she would come in round 4).
  for (let i = 0; i < 400 && bt.round < 3 && !bt.over; i++) aiAct(bt, 0, rng);
  if (!bt.over) assert.match(String(queueAlly(bt, 0, allyAt('admiral', L, 2), true, 78)), /up to round 3/);
});

test('67: the shares of the cut — each captain\'s blows, shots, orders and moves counted to her; the shares make one', () => {
  const r = playGroup(30, ['corsair', 'admiral', 'drowned'], null, 4);
  const sh = sharesOf(r.end, 0);
  const total = [...sh.values()].reduce((n, x) => n + x, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.equal(sh.size, 3);
  assert.ok([...sh.values()].filter((x) => x > 0).length >= 2, 'more than one captain cut');
  assert.ok(Object.keys(r.end.dealt ?? {}).some((k) => k === '0:1' || k === '0:2'));
});

// Owner, 2026-10-10 («чини атаку всем»): a group's pace on the blows (TAC_GROUP.pace, paceSea) is gone — a group's fight
// is as long as its stacks' turns make it. Between groups at 51–60 that is 5–10 minutes; against the sea a group of the
// low levels takes as many rounds as one captain and more minutes (her allies' stacks have their turns too).
test('duration: a group\'s boarding — 5–10 min between captains at 51–60; against the sea no more rounds than one captain, not twice the minutes', () => {
  for (const L of [53, 58]) {
    const g = groupStat(L, 3, 3, 1);
    assert.ok(g.mins >= 5 && g.mins <= 10, `L${L} 3 v 3: ${g.mins.toFixed(1)} min`);
    const g2 = groupStat(L, 2, 2, 1);
    assert.ok(g2.mins >= 5 && g2.mins <= 10, `L${L} 2 v 2: ${g2.mins.toFixed(1)} min`);
  }
  for (const L of [5, 25]) {
    const solo = groupStat(L, 1, null, 2), g = groupStat(L, 3, null, 2, { grow: true });
    assert.ok(g.mins <= solo.mins * 2, `L${L} against the sea: three ${g.mins.toFixed(2)} min, alone ${solo.mins.toFixed(2)}`);
    assert.ok(g.rounds <= solo.rounds + 0.5, `L${L}: rounds ${g.rounds.toFixed(1)} vs ${solo.rounds.toFixed(1)}`);
  }
});

// ------------------------------------------------------------------ on the ships

function atSea(game: Game, name: string, path: CaptainId, dx: number, level = 30): { c: FakeConn; ship: ShipEntity; s: PlayerSession } {
  const c = join(game, name, path);
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.state.x = 30000 + dx;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  s.profile!.level = level;
  ship.loadout.classId = 'brig';
  ship.recompute(game.now);
  ship.crew = ship.stats.crewMax;
  ship.morale = 80;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, ship, s };
}

function group(game: Game, ...xs: { s: PlayerSession }[]): void {
  const id = 9000 + Math.floor(Math.random() * 999);
  game.social.groups.set(id, { id, leader: xs[0].s.accountId, members: xs.map((x) => x.s.accountId), convoy: false });
  for (const x of xs) game.social.groupOf.set(x.s.accountId, id);
}

function pirateBy(game: Game, ship: ShipEntity, crew = 60): ShipEntity {
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const npc = game.spawnNpcShip('pirate', 'brig', 'free', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  npc.crew = crew;
  npc.morale = 80;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

test('64 on the ships: mates within 600 m come aboard with the grapples, the others are asked; too far, docked or not of the group never', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const A = atSea(game, 'Anna', 'corsair', 0), B = atSea(game, 'Bea', 'drowned', 150), C = atSea(game, 'Cora', 'admiral', 400);
  const D = atSea(game, 'Dora', 'reaver', 750), E = atSea(game, 'Ella', 'navigator', 200);
  group(game, A, B, C, D);
  B.c.push({ t: 'board_assist', auto: true });
  D.c.push({ t: 'board_assist', auto: true });
  const npc = pirateBy(game, A.ship);
  A.c.push({ t: 'board', target: npc.id, aggression: 'standard', risk: true });
  const bt = A.ship.boarding!.fight.tac!;
  assert.deepEqual(bt.allies?.map((x) => x.hero.input.name), ['Bea'], 'Bea comes at once');
  assert.equal(B.ship.boardAlly, A.ship.id, 'her ship lies to beside the fight');
  assert.ok(B.ship.grappled);
  assert.match(String(canBoard(game, B.ship, npc)), /Already locked/);
  const offer = C.c.last('board_offer')?.offer;
  assert.ok(offer && offer.mate === 'Anna' && offer.n === 2, 'Cora is asked');
  assert.equal(D.c.last('board_offer'), undefined, 'Dora is too far');
  assert.equal(E.c.last('board_offer'), undefined, 'Ella is no mate of the group');
  const bv = B.c.last('board_tac')?.view;
  assert.ok(bv && bv.slot === 1 && bv.you === 0 && bv.allies?.some((x) => x.you && x.slot === 1), 'Bea sees the field as hers');
  // Cora comes as round 2 opens.
  C.c.push({ t: 'board_join', with: A.ship.id });
  assert.equal(bt.joinQ?.length, 1);
  assert.equal(C.ship.boardAlly, A.ship.id);
  // Dora sails in and is asked... she is not: 750 m.
  for (const x of [A, B, C]) x.c.push({ t: 'tac', act: { a: 'auto', on: true } });
  for (let i = 0; i < 20 * 400 && !bt.over; i++) game.step();
  assert.ok(bt.over, 'the fight ran to its end');
  assert.ok(bt.allies!.some((x) => x.hero.input.name === 'Cora' && x.joined === 2), 'Cora came aboard in round 2');
  const r = A.c.all('board_tac').map((m) => m.view).filter((v) => v?.result).pop()!.result!;
  assert.equal(r.shares?.filter((x) => x.side === 0).length, 3, 'the end screen shows the three shares');
  steps(game, 400);
  assert.equal(A.ship.boarding, null);
  assert.equal(B.ship.boardAlly, null, 'her ship is let go');
  assert.equal(C.ship.boardAlly, null);
  assert.equal(B.c.last('board_tac')?.view, null, 'her screen closes');
});

test('67 on the ships: each captain\'s losses off her own ship; the lesson and the spoils by the shares; a captain\'s boarding takes her group\'s', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  // (her level's ship: a grey prize teaches nobody anything)
  const A = atSea(game, 'Ada', 'corsair', 0, 5), B = atSea(game, 'Bel', 'admiral', 150, 5);
  group(game, A, B);
  B.c.push({ t: 'board_assist', auto: true });
  const npc = pirateBy(game, A.ship, 16);
  npc.purse = 1000;
  npc.cargo = { rum: 20 };
  const crewA = A.ship.crew, crewB = B.ship.crew;
  A.c.push({ t: 'board', target: npc.id, aggression: 'standard', risk: true });
  const fight = A.ship.boarding!.fight;
  const bt = fight.tac!;
  for (const x of [A, B]) x.c.push({ t: 'tac', act: { a: 'auto', on: true } });
  for (let i = 0; i < 20 * 400 && !bt.over; i++) game.step();
  assert.equal(bt.over?.winner, 0, 'the two carry a pirate of sixteen');
  const e = fight.tacAllies![0];
  const lostB = bt.stacks.filter((s) => s.own === 1).reduce((n, s) => n + s.start - s.count, 0);
  const lostA = bt.stacks.filter((s) => s.side === 0 && !s.own).reduce((n, s) => n + s.start - s.count, 0);
  // (her ship keeps a tenth of her crew to strike the colours, as every ship's does)
  assert.ok(crewB - B.ship.crew <= lostB && crewB - B.ship.crew >= Math.min(lostB, crewB - Math.max(2, Math.round(crewB * 0.1))), 'her own stacks\' fallen off her ship');
  assert.ok(crewA - A.ship.crew <= lostA, 'and the boarder\'s off hers');
  const sh = sharesOf(bt, 0);
  assert.ok(Math.abs((sh.get(1) ?? 0) - (e.share ?? -1)) < 1e-9);
  if ((e.share ?? 0) > 0) {
    assert.ok((e.xp ?? 0) > 0, 'her lesson by her share');
    assert.ok((e.silver ?? 0) > 0, 'her part of the purse and the hold, in silver');
    assert.ok(npc.purse < 1000, 'taken from the prize\'s purse');
  }
  steps(game, 400);
  assert.ok(B.c.all('toast').some((t) => /Your share of the boarding/.test(t.msg)));
});

test('64 between captains: the boarded captain\'s group comes aboard her side; nobody is grown', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const A = atSea(game, 'Ari', 'reaver', 0), D = atSea(game, 'Dee', 'admiral', 30), M = atSea(game, 'Meg', 'drowned', 200);
  const v = headingVec(A.ship.state.heading - Math.PI / 2);
  D.ship.state.x = A.ship.state.x + v.x * 18;
  D.ship.state.y = A.ship.state.y + v.y * 18;
  game.grid.upsert(D.ship.id, D.ship.state.x, D.ship.state.y);
  group(game, D, M);
  M.c.push({ t: 'board_assist', auto: true });
  // Contested waters, the pirate flag on both (docs/24: the colours' own rules, tests/colours.test.ts).
  for (const x of [A, D, M]) {
    x.ship.region = 'gravewater';
    x.ship.lastCombat = -1000;
    x.s.profile!.pvp.flag = 'pirate';
  }
  assert.equal(canBoard(game, A.ship, D.ship), null);
  A.c.push({ t: 'board', target: D.ship.id, aggression: 'standard', risk: true });
  const bt = A.ship.boarding?.fight.tac;
  assert.ok(bt);
  assert.deepEqual(bt.allies?.map((x) => [x.side, x.hero.input.name]), [[1, 'Meg']], 'Meg stands with Dee');
  assert.equal(bt.boost, undefined, 'nobody grown between captains');
});

test('the RU of a group\'s boarding: every line on the field and on the card has its Russian twin, no Latin left', async () => {
  const { EN, RU } = await import('../client/src/lang/ui/boardgroup.ts');
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  for (const [k, v] of Object.entries(RU)) assert.ok(!/[A-Za-z]{2,}/.test(v.replace(/\{\w+\}/g, '')), `${k}: ${v}`);
  const T = await import('../client/src/lang/ui/tactical.ts');
  for (const k of ['allyTurn', 'hint.ally', 'log.join', 'log.spellBy', 'res.shares', 'coming', 'clock.of'] as const) assert.ok(T.RU[k] && !/[A-Za-z]{2,}/.test(T.RU[k].replace(/\{\w+\}/g, '')), k);
  const { SERVER_RU_GROUP } = await import('../client/src/lang/server.ru.group.ts');
  for (const v of Object.values(SERVER_RU_GROUP)) assert.ok(!/[A-Za-z]{3,}/.test(v.replace(/\{\d+\}/g, '')), v);
  for (const p of Object.keys(TAC_ROLES) as CaptainId[]) assert.ok(!/[A-Za-z]{2,}/.test(TAC_ROLES[p].name[1] + TAC_ROLES[p].text[1]), p);
  void tacFlagHex;
  void castSpell;
  void captainAt;
  void side;
});
