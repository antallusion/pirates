// docs/25 block Г (items 44–52; owner, 2026-10-09: «абордаж на высоких уровнях должен быть такой, чтобы люди играли по
// 5-10 минут… На низких 1 минуты норма… С нпс можно быстрее сражаться»; «делай все пункты»): the rules that set how long
// a boarding runs — the hero's Attack against Defense held in, the common orders' lift with a waning return and their
// blast reckoned from the stack it falls on, the guarding multipliers on a stack's own Defense and all of them at most
// half a blow, the turn's clock by level and the chess clocks, the quick fight offered at once against a clearly weaker
// ship of the sea and none against a legend, the sea's fewer stacks and shorter breath, the fatigue from round 8, the
// quarterdeck's flag from level 40. The table itself (rounds, minutes, round 1's cut): tests/balance/boarding.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec } from '../shared/src/math.ts';
import { Rng } from '../shared/src/rng.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import { npcHeroBattle, npcHeroLevel } from '../shared/src/data/hero.ts';
import {
  TAC_AI_DELAY, TAC_LEN, boardSlots, hexNeighbors, npcBoardSlots, tacBankSecs, tacFatigue, tacFlagHex, tacTempo, tacTurnSecs,
} from '../shared/src/data/tactical.ts';
import {
  TAC_BLAST_STACK, TAC_GUARD_MIN, TAC_ORDER_CAP, act, adMod, aiAct, aiChoice, blowParts, castSpell, commonMul, newBattle, sideStrength, stackById, stepBattle, tacHp,
} from '../server/src/game/tacbattle.ts';
import type { TacArmyEntry, TacBattle, TacSideInput } from '../server/src/game/tacbattle.ts';
import { battleFit } from '../server/src/game/tactical.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { captainAt, playerArmy, side } from './balance/boardlen.ts';
import { join, makeGame } from './helpers.ts';

const L60 = (human = true): TacSideInput => side(playerArmy(60), captainAt('corsair', 60, 3), 'corsair', human);
const hpOf = (bt: TacBattle, s: 0 | 1) => bt.stacks.filter((x) => x.side === s && x.count > 0).reduce((n, x) => n + tacHp(x), 0);

test('docs/25 item 45: Attack over Defense +5% a point to +100%, under it −2.5% a point to −50%', () => {
  assert.equal(adMod(10, 10), 1);
  assert.ok(Math.abs(adMod(14, 10) - 1.2) < 1e-9);
  assert.equal(adMod(30, 10), 2);
  assert.equal(adMod(90, 10), 2, 'no more than +100% (it was ×3)');
  assert.ok(Math.abs(adMod(10, 14) - 0.9) < 1e-9);
  assert.equal(adMod(10, 30), 0.5);
  assert.equal(adMod(10, 90), 0.5, 'no less than −50% (it was ×0.3)');
});

test('docs/25 item 47: the guarding multipliers lift a stack\'s own Defense, not her captain\'s; all that guards her takes at most half a blow', () => {
  const a = L60(), b = L60();
  const bt = newBattle(a, b, 3, 0, new Rng(3), { len: 'board' });
  const s = bt.stacks.find((x) => x.side === 0 && x.count > 0)!;
  const t = bt.stacks.find((x) => x.side === 1 && x.count > 0)!;
  const hd = b.hero!.def;
  const before = blowParts(bt, s, t, 'melee');
  t.defending = true;
  const after = blowParts(bt, s, t, 'melee');
  // Defending lifts her own Defense by 30%: (def − hero's)·0.3 more points of it, at 2.5% a point under the attack.
  const own = t.def - hd;
  const want = adMod(s.atk, own * 1.3 + hd) / adMod(s.atk, t.def);
  assert.ok(Math.abs((after.mod * after.mul) / (before.mod * before.mul) - want) < 1e-6, 'the stance on her own Defense');
  // Everything at once: a wall of Defense, her captain's armour at its most, a shield on her — still half a blow.
  t.def = 400;
  b.hero!.taken = 0.5;
  bt.heroes[1].fx.push({ id: 'test_wall', until: 99, mods: { taken: -0.6 } });
  const g = blowParts(bt, s, t, 'melee');
  t.def = 0;
  b.hero!.taken = 0;
  bt.heroes[1].fx = [];
  t.defending = false;
  const open = blowParts(bt, s, t, 'melee');
  const ratio = (g.mod * g.mul) / (open.mod * open.mul);
  assert.ok(ratio >= TAC_GUARD_MIN / Math.max(1, open.mod) - 1e-9, `guarded ×${ratio.toFixed(3)}`);
  // A battle of no length (the land's fights) keeps its old reckoning: down to ×0.3.
  const land = newBattle(L60(), L60(), 3, 0, new Rng(3));
  const ls = land.stacks.find((x) => x.side === 0)!, lt = land.stacks.find((x) => x.side === 1)!;
  lt.def = 400;
  assert.ok(blowParts(land, ls, lt, 'melee').mod < 0.35);
});

test('docs/25 item 46: a common order\'s lift wanes and stops at ×3; its blast on a stack is reckoned from the stack too', () => {
  assert.equal(commonMul(1), 1);
  assert.ok(commonMul(1.2) > 1.18 && commonMul(1.2) < 1.2, 'little lift: nearly as it was');
  for (const raw of [2, 3, 4.7, 8.4, 20]) assert.ok(commonMul(raw) < TAC_ORDER_CAP && commonMul(raw) > commonMul(raw - 0.5), `×${raw} → ×${commonMul(raw).toFixed(2)}`);
  // The Maelstrom from a captain whose orders were ×8 at level 60 (the audit: 77–100% of an equal army): now a share.
  const a = L60(), b = L60();
  a.hero = { ...a.hero!, book: ['maelstrom'], mana: 999, manaMax: 999, mul: { fire: 8.4, steel: 8.4, board: 8.4, wind: 8.4, water: 8.4, fog: 8.4 } };
  const bt = newBattle(a, b, 5, 0, new Rng(5), { len: 'long' });
  const hp0 = hpOf(bt, 1);
  while (bt.active !== null && stackById(bt, bt.active)!.side !== 0) aiAct(bt, 0, new Rng(1));
  assert.equal(castSpell(bt, 0, 'maelstrom', undefined, new Rng(2)), null);
  const cut = 1 - hpOf(bt, 1) / hp0;
  assert.ok(cut > 0.05 && cut <= 0.55 * TAC_BLAST_STACK + 0.01, `the Maelstrom takes ${(cut * 100).toFixed(0)}% of her army`);
});

test('docs/25 item 44: a boarding\'s blows by its level — quick at the bottom, slow at the top; the sea\'s fights quicker', () => {
  for (let L = 2; L <= 60; L++) assert.ok(tacTempo(L) <= tacTempo(L - 1) + 1e-9, `tempo at ${L}`);
  assert.ok(tacTempo(1) / tacTempo(60) > 4, 'the curve turned over');
  assert.equal(tacTempo(0), 1, 'a battle of no level as before');
  const pvp = newBattle(L60(), L60(), 1, 0, new Rng(1), { len: 'board' });
  const sea = newBattle(L60(), L60(false), 1, 0, new Rng(1), { len: 'board' });
  assert.ok(sea.tempo > pvp.tempo, 'against the sea\'s mind a shade quicker');
  assert.equal(newBattle(L60(), L60(), 1, 0, new Rng(1), { len: 'long' }).tempo, 1, 'the legends, the raid and the citadels: long by design');
});

test('docs/25 item 51: from round 8 every blow lands 15% harder a round, both sides', () => {
  assert.equal(tacFatigue(7), 1);
  assert.ok(Math.abs(tacFatigue(8) - 1.15) < 1e-9);
  assert.ok(Math.abs(tacFatigue(10) - 1.45) < 1e-9);
  const bt = newBattle(L60(), L60(), 2, 0, new Rng(2), { len: 'board' });
  const s = bt.stacks.find((x) => x.side === 0)!, t = bt.stacks.find((x) => x.side === 1)!;
  const r1 = blowParts(bt, s, t, 'melee').mul;
  bt.round = 7;
  const r7 = blowParts(bt, s, t, 'melee').mul;
  bt.round = 9;
  const r9 = blowParts(bt, s, t, 'melee').mul;
  assert.ok(r7 > r1, 'round 1 opens lighter (the crews cross the rail)');
  assert.ok(Math.abs(r9 / r7 - 1.3) < 1e-6, `round 9 against round 7 ×${(r9 / r7).toFixed(3)}`);
});

test('docs/25 item 48: a stack\'s turn by level (15 / 20 / 30 s), a captain\'s chess clock over the fight; spent, her stacks defend', () => {
  assert.deepEqual([1, 10, 11, 30, 31, 60].map(tacTurnSecs), [15, 15, 20, 20, 30, 30]);
  assert.deepEqual([1, 10, 11, 25, 45, 60].map(tacBankSecs), [60, 60, 120, 180, 300, 360]);
  const a = side(playerArmy(8), captainAt('reaver', 8, 1), 'reaver', true);
  const b = side(playerArmy(8), captainAt('admiral', 8, 2), 'admiral', false);
  const rng = new Rng(4);
  const bt = newBattle(a, b, 4, 0, rng, { len: 'board' });
  assert.equal(bt.heroes[0].bank, 60, 'a minute at level 8');
  assert.equal(bt.heroes[1].bank, -1, 'the sea\'s mind keeps none');
  // Play to her turn; she thinks ten seconds and defends: they come off her clock.
  let t = 0;
  while (!bt.over && (bt.active === null || stackById(bt, bt.active)!.side !== 0)) stepBattle(bt, (t += 0.5), rng);
  assert.ok(bt.turnEnds - t <= 15 + 10, 'her turn at most 15 s once the play is done');
  const from = bt.clock!.from;
  t = Math.max(t, from) + 10;
  assert.equal(act(bt, 0, { a: 'defend' }, t, rng), null);
  assert.ok(Math.abs(bt.heroes[0].bank - 50) < 1e-6, `her clock: ${bt.heroes[0].bank} s`);
  // Spent: her next turn runs out as soon as it is played, and the stack defends.
  bt.heroes[0].bank = 0;
  let timeouts = 0;
  for (let i = 0; i < 4000 && !bt.over; i++) {
    const n0 = bt.events;
    stepBattle(bt, (t += 0.5), rng);
    timeouts += bt.log.filter((e) => e.i > n0 && e.k === 'timeout' && e.side === 0).length;
    if (timeouts >= 2) break;
  }
  assert.ok(timeouts >= 2, 'her stacks defend on their own');
  assert.equal(TAC_AI_DELAY, 0.35, 'docs/25 item 50: the sea\'s breath 0.7 → 0.35 s');
});

test('docs/25 item 50: the sea brings a stack or two fewer — the same men, the same strength in fewer, fuller stacks', () => {
  for (const L of [5, 15, 25, 35, 60]) assert.equal(npcBoardSlots(L), Math.max(2, boardSlots(L) - TAC_LEN.npcFewer));
  for (const mix of ['pirate', 'navy', 'deep'] as const) for (let sl = 2; sl <= 10; sl++) {
    const army: TacArmyEntry[] = armyForLevel(sl, 40 + sl * 50, 7, mix).map((x) => ({ ...x, src: x.u }));
    const fit = battleFit(army, npcBoardSlots(npcHeroLevel(sl)));
    assert.ok(fit.length <= npcBoardSlots(npcHeroLevel(sl)));
    assert.equal(fit.reduce((n, x) => n + x.n, 0), army.reduce((n, x) => n + x.n, 0), 'nobody lost or made up');
    const strength = (ar: TacArmyEntry[]) => {
      const bt = newBattle(side(ar, undefined, null, false), side([{ u: 'deckhand', n: 1 }], undefined, null, false), 1, 0, new Rng(1));
      return sideStrength(bt, 0);
    };
    const k = strength(fit) / strength(army);
    assert.ok(k > 0.97 && k < 1.03, `${mix} ⚓${sl}: ×${k.toFixed(3)}`);
  }
});

function atSea(game: Game, name: string, level: number): { c: ReturnType<typeof join>; ship: ShipEntity } {
  const c = join(game, name, 'corsair');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  Object.assign(ship.state, { x: 30000, y: 80000, heading: 0, speed: 0 });
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  s.profile!.level = level;
  ship.loadout.classId = 'brig';
  ship.recompute(game.now);
  ship.crew = ship.stats.crewMax;
  ship.morale = 80;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, ship };
}
function foe(game: Game, ship: ShipEntity, crew: number): ShipEntity {
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

test('docs/25 item 49: the quick fight offered at once against a clearly weaker ship of the sea, played honestly; none against a legend', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const { c, ship } = atSea(game, 'Quick Quill', 30);
  const weak = foe(game, ship, 12);
  c.push({ t: 'board', target: weak.id, aggression: 'standard' });
  const bt = ship.boarding!.fight.tac!;
  assert.equal(bt.len, 'board');
  const v = c.last('board_tac')!.view!;
  assert.equal(v.quickNow, true, 'offered at once');
  assert.ok(!v.noQuick);
  assert.ok(sideStrength(bt, 0) >= TAC_LEN.quick * sideStrength(bt, 1));
  c.push({ t: 'tac', act: { a: 'quick' } });
  assert.ok(bt.over, 'played out by both minds at once — the same rules and dice');
  // A great one of the sea: fought to the end.
  const { game: g2 } = makeGame();
  g2.tacticalBoarding = true;
  const s2 = atSea(g2, 'Long Lise', 30);
  const boss = foe(g2, s2.ship, 12);
  boss.npcRole = 'boss';
  s2.c.push({ t: 'board', target: boss.id, aggression: 'standard' });
  const bt2 = s2.ship.boarding!.fight.tac!;
  assert.equal(bt2.len, 'long');
  assert.equal(s2.c.last('board_tac')!.view!.noQuick, true);
  s2.c.push({ t: 'tac', act: { a: 'quick' } });
  assert.ok(!bt2.over, 'no quick fight with a legend');
  assert.ok(s2.c.all('toast').some((e) => /No quick fight here/.test(e.msg)), 'and she is told so');
});

test('docs/25 item 52: from level 40 the quarterdeck\'s flag — a stack on hers for two whole rounds takes the ship; the sea\'s mind goes for it and strikes whoever stands on its own', () => {
  const lvl = (L: number) => newBattle(side(playerArmy(L), captainAt('corsair', L, 1), 'corsair', true), side(playerArmy(L), captainAt('corsair', L, 2), 'corsair', true), 6, 0, new Rng(6), { len: 'board' });
  assert.equal(lvl(39).flag, undefined, 'none under level 40');
  const bt = lvl(45);
  assert.deepEqual(bt.flag!.hex, [tacFlagHex(0), tacFlagHex(1)]);
  assert.equal(newBattle(L60(), L60(), 6, 0, new Rng(6), { len: 'long' }).flag, undefined, 'none in a long fight');
  // Her stack on the other's flag, the other side's men held off it (a freeze on each): two whole rounds take the ship.
  const holder = bt.stacks.find((x) => x.side === 0 && x.count > 0)!;
  holder.hex = tacFlagHex(1);
  for (const x of bt.stacks) if (x !== holder) bt.heroes[0].fx.push({ id: 'test_hold', until: 99, on: x.id, foe: x.side === 1, mods: { still: true } });
  const rng = new Rng(7);
  for (let i = 0; i < 400 && !bt.over; i++) aiAct(bt, 0, rng);
  assert.equal(bt.over?.why, 'flag');
  assert.equal(bt.over?.winner, 0);
  assert.ok(bt.round >= 3, `taken in round 1, held through 2 and 3: over at ${bt.round}`);
  assert.ok(bt.log.some((e) => e.k === 'flag'));
  // The sea's mind: a stack that can step on to her flag with nothing to strike steps on to it.
  const b2 = lvl(45);
  const goal = b2.flag!.hex[1];
  const runner = b2.stacks.find((x) => x.side === 0 && x.count > 0 && x.sp.length === 0)!;
  runner.hex = hexNeighbors(goal).find((h) => !b2.stacks.some((x) => x.count > 0 && x.hex === h) && b2.cells[h] === '.')!;
  for (const x of b2.stacks) if (x.side === 1 && hexNeighbors(runner.hex).some((h) => hexNeighbors(h).includes(x.hex))) x.hex = -1;
  b2.active = runner.id;
  const ch = aiChoice(b2, new Rng(1));
  assert.ok(ch.a === 'move' && ch.to === goal, `she goes for the flag: ${JSON.stringify(ch)}`);
});
