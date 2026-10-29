// Owner, 2026-10-29 (forum «Хаск Морроу — бесполезен в ПВП?», Elordaert): the Reaver's ram tears the rigging — her way
// ×0.65 for 3.5 s laid on after every buff of her speed (a navigator's ultimate too), renewed by a second ram, never
// stacked; Blood in the Water in every boarding and battle on the hexes (a lair's, ashore, a boss's), reckoned round by
// round there. («Абордаж: выкл» only under neutral colours and the Red Hook's ultimate: tests/colours.test.ts.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TORN_RIGGING, tornRiggingMul } from '../shared/src/data/seaskill.ts';
import { SF } from '../shared/src/protocol.ts';
import { Rng } from '../shared/src/rng.ts';
import { TORN_HER, TORN_YOU } from '../server/src/game/Game.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { BLOOD_MUL, newBattle, stackBonus } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { sideOf } from '../server/src/game/tactical.ts';
import { join, makeGame, onHull } from './helpers.ts';

const sess = (game: Game, name: string): PlayerSession => game.sessionByName(name)!;

function twoAtSea(game: Game) {
  const a = join(game, 'Hask Ram', 'reaver'), b = join(game, 'Toby Run', 'navigator');
  const A = sess(game, 'Hask Ram'), B = sess(game, 'Toby Run');
  for (const [s, x] of [[A, 30_000], [B, 30_020]] as const) {
    const sh = s.ship!;
    sh.docked = null;
    s.profile!.docked = null;
    onHull(game, sh, 'brig', 5);
    sh.crew = sh.stats.crewMax;
    sh.state.x = x;
    sh.state.y = 30_000;
    sh.region = 'gravewater';
    s.profile!.pvp.flag = 'pirate'; // fair game to each other: the ram's blow lands
    sh.protectedUntil = 0;
    game.grid.upsert(sh.id, sh.state.x, sh.state.y);
  }
  return { a, b, A: A.ship!, B: B.ship! };
}

test('Ramming Speed: a ram that lands tears her rigging — speed ×0.65 for 3.5 s on top of her buffs, both captains told, renewed and never stacked', () => {
  const { game } = makeGame();
  const { a, b, A, B } = twoAtSea(game);
  // The navigator under her ultimate's way (+30%) and the trimmed sails (+25%).
  B.addEffect({ id: 'storm_chaser', until: game.now + 20, mods: { maxSpeed: 0.3 } }, game.now);
  B.addEffect({ id: 'trim_sails', until: game.now + 12, mods: { maxSpeed: 0.25 } }, game.now);
  const fast = B.stats.maxSpeed * B.sailParams(false, game.now).speedMul;
  // A plain ram: no torn rigging.
  game.ram(A, B, 6);
  assert.equal(B.hasEffect(TORN_RIGGING.id), false, 'a plain ram tears nothing');
  // Under Ramming Speed.
  A.addEffect({ id: 'ramming_speed', until: game.now + 5, mods: { maxSpeed: 0.35, accel: 1 } }, game.now);
  game.ram(A, B, 6);
  assert.ok(B.hasEffect(TORN_RIGGING.id));
  const torn = B.effects.find((e) => e.id === TORN_RIGGING.id)!;
  assert.ok(Math.abs(torn.until - (game.now + 3.5)) < 1e-6, '3.5 s');
  const slow = B.stats.maxSpeed * B.sailParams(false, game.now).speedMul;
  assert.ok(Math.abs(slow / fast - 0.65) < 1e-9, `×0.65 after the buffs, not −35 points off them: ${slow / fast}`);
  assert.ok(B.stats.maxSpeed > B.cls.maxSpeed, 'her buffs still stand under it');
  assert.ok(B.flagsFor(A.id, true, game.now) & SF.SLOWED, 'her status: «еле тянет» on the target line');
  assert.equal(a.last('toast')!.msg, TORN_HER);
  assert.equal(b.last('toast')!.msg, TORN_YOU);
  // A second ram renews it: one effect, the same ×0.65, its clock started again.
  game.now += 2;
  game.ram(A, B, 6);
  assert.equal(B.effects.filter((e) => e.id === TORN_RIGGING.id).length, 1, 'never stacked');
  assert.ok(Math.abs(B.sailParams(false, game.now).speedMul / B.sailParams(false, -Infinity).speedMul - 1) < 1e-9);
  assert.ok(Math.abs(B.effects.find((e) => e.id === TORN_RIGGING.id)!.until - (game.now + 3.5)) < 1e-6, 'renewed');
  // And it wears off: her way whole again.
  assert.equal(tornRiggingMul(B.effects, game.now + 3.6), 1);
  assert.equal(tornRiggingMul(B.effects, game.now + 1), 1 - TORN_RIGGING.slow);
});

const side = (over: Partial<TacSideInput> = {}): TacSideInput => ({
  name: 'x', ship: 'x', captain: null, hands: 0, marines: 0, gunners: 0, army: [{ u: 'deckhand', n: 40, src: 'deckhand' }], officers: [], skill: 3,
  morale: 60, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, noBook: true,
  ...over,
});

test('Blood in the Water on the hexes: +20% once the other side has lost half her men (a lair, ashore) or came aboard below half her crew', () => {
  const rng = new Rng(7);
  const bt = newBattle(side({ captain: 'reaver', blood: true }), side(), 11, 0, rng, { land: 'rocky' });
  const mine = bt.stacks.find((s) => s.side === 0)!;
  const fresh = stackBonus(bt, mine).melee;
  bt.dead[1] = Math.ceil(bt.heroes[1].startMen * 0.5);
  assert.ok(Math.abs(stackBonus(bt, mine).melee / fresh - BLOOD_MUL) < 1e-9, 'half her men down: +20%');
  // Not for a captain without the passive, nor for the other side.
  const theirs = bt.stacks.find((s) => s.side === 1)!;
  const t0 = stackBonus(bt, theirs).melee;
  bt.dead[0] = bt.heroes[0].startMen;
  assert.equal(stackBonus(bt, theirs).melee, t0);
  // Came aboard below half her crew: from the first blow.
  const bt2 = newBattle(side({ captain: 'reaver', blood: true, bloodOpen: true }), side(), 11, 0, new Rng(7), { land: 'rocky' });
  const bt3 = newBattle(side({ captain: 'reaver' }), side(), 11, 0, new Rng(7), { land: 'rocky' });
  const s2 = bt2.stacks.find((s) => s.side === 0)!, s3 = bt3.stacks.find((s) => s.side === 0)!;
  assert.ok(Math.abs(stackBonus(bt2, s2).melee / stackBonus(bt3, s3).melee - BLOOD_MUL) < 1e-9);
});

test('Blood in the Water from the ship: a lair or a fight ashore reckons it by the creatures fallen (no longer by his own crew), a boarding by her crew', () => {
  const { game } = makeGame();
  const { A, B } = twoAtSea(game);
  // Ashore (beastlairs.ts: sideOf(ship, ship)): the passive on, never opened by his own thin crew.
  A.crew = Math.round(A.stats.crewMax * 0.3);
  const ashore = sideOf(game, A, A, true);
  assert.equal(ashore.blood, true);
  assert.equal(ashore.bloodOpen, false);
  // A boarding: opened by her crew below half.
  A.crew = A.stats.crewMax;
  B.crew = Math.round(B.stats.crewMax * 0.4);
  const board = sideOf(game, A, B, true);
  assert.equal(board.blood, true);
  assert.equal(board.bloodOpen, true);
  B.crew = B.stats.crewMax;
  assert.equal(sideOf(game, A, B, true).bloodOpen, false);
  // Not the Reaver: nothing.
  assert.equal(sideOf(game, B, A, false).blood, undefined);
  // The power itself carries no blood now (it is reckoned on the hexes, round by round, not twice).
  B.crew = Math.round(B.stats.crewMax * 0.4);
  assert.equal(sideOf(game, A, B, true).power, Math.max(0.3, A.stats.boardingPower));
});
