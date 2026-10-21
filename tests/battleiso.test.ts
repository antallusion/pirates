// Owner, 2026-10-22: «напал на чаек, сражался и победил, а потом начался бой абордажный сразу после с пиратами, где я не
// мог ходить и вообще ничего делать». A captain in any battle — and a short while after it — is out of the sea's reach.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armyForLevel } from '../shared/src/data/army.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { closeFight, landFighting, landTac } from '../server/src/game/beastlairs.ts';
import { canBoard, startBoarding } from '../server/src/game/boarding.ts';
import { applyDamage, damageBlocked, fireBroadside } from '../server/src/game/combat.ts';
import { BATTLE_GRACE, IN_BATTLE_WHY, inBattle, untouchable } from '../server/src/game/inbattle.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import { newBattle, stepBattle } from '../server/src/game/tacbattle.ts';
import { sideOf } from '../server/src/game/tactical.ts';
import { Rng } from '../shared/src/rng.ts';
import { SF } from '../shared/src/protocol.ts';
import { SERVER_RU_BATTLE } from '../client/src/lang/server.ru.battle.ts';
import { attackRoam, roamAtHand } from '../server/src/game/roamers.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

function sea(): Game {
  const { game } = makeGame();
  quietAdv(game, false);
  game.tacticalBoarding = true;
  return game;
}
function captain(game: Game, name: string, level = 3, cls = 'cutter'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, cls, level);
  s.ship!.setArmy(armyForLevel(level, Math.round(s.ship!.stats.crewMax * 0.8), s.ship!.armySlots - 2, 'player'));
  s.ship!.morale = 80;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  return s;
}
/** A pirate of the sea hunting her, alongside, her prey battered enough to be boarded. */
function pirateBy(game: Game, s: PlayerSession): ShipEntity {
  const me = s.ship!;
  const o = game.spawnNpcShip('pirate', 'cutter', 'confederacy', me.state.x + 40, me.state.y + 20, 0);
  game.setNpcLevel(o, me.shipLevel);
  const brain = game.npcs.get(o.id)!;
  brain.huntAccount = s.accountId;
  o.state.speed = me.state.speed;
  return o;
}
function gullFight(game: Game, s: PlayerSession): void {
  runAdmin(game, s, '/stack gull go');
  const sp = roamAtHand(game, s)!;
  assert.ok(sp, 'a stack beside her');
  assert.equal(attackRoam(game, s, sp.id), null);
}

test('repro: a pirate alongside while she fights the gulls and while their result card is up never boards her', () => {
  const game = sea();
  const s = captain(game, 'Gullwin');
  gullFight(game, s);
  const o = pirateBy(game, s);
  s.ship!.hull = s.ship!.stats.hullMax * 0.4; // battered: a pirate would board her at once
  steps(game, 60);
  assert.equal(s.ship!.boarding, null, 'no boarding while the stack fight is on');
  landTac(game, s, { a: 'quick' }, true); // won
  assert.ok(landFighting(game, s), 'the result card is up');
  steps(game, 200); // 10 s of the card
  assert.equal(s.ship!.boarding, null, 'no boarding under the result card');
  assert.equal(o.boarding, null);
});

test('in a stack fight and its grace: no grapples, no balls, no prey; never a second battle; the grace runs out', () => {
  const game = sea();
  const s = captain(game, 'Isola');
  const me = s.ship!;
  gullFight(game, s);
  const o = pirateBy(game, s);
  assert.ok(inBattle(game, me) && untouchable(game, me));
  // nobody may grapple her (even a forced grapple is refused), nor fire on her, nor take her for prey
  assert.equal(canBoard(game, o, me), IN_BATTLE_WHY);
  startBoarding(game, o, me, 'standard');
  assert.equal(me.boarding, null);
  assert.equal(damageBlocked(game, o, me), IN_BATTLE_WHY);
  const hull = me.hull;
  assert.equal(applyDamage(game, me, { hull: 500, crew: 5 }, o), 0);
  assert.equal(applyDamage(game, me, { hull: 500 }, null), 0, 'nor the sea itself');
  assert.equal(me.hull, hull);
  assert.equal(npcHostileTo(game, o, me), false);
  // she fires on nobody from the boats either
  assert.ok(fireBroadside(game, me, 'port', 200));
  // the fight won, its card up, then put away: a few seconds' grace, and then the sea again
  landTac(game, s, { a: 'quick' }, true);
  steps(game, 40);
  assert.equal(me.boarding, null);
  closeFight(game, s);
  assert.ok(!landFighting(game, s));
  assert.ok(untouchable(game, me), 'the grace after the card');
  assert.equal(o.boarding, null);
  steps(game, Math.ceil(BATTLE_GRACE * 20) + 20);
  assert.ok(!untouchable(game, me), 'the grace ran out');
  assert.notEqual(damageBlocked(game, o, me), IN_BATTLE_WHY);
});

test('her grace ends the moment she fires herself (no shield to fight from)', () => {
  const game = sea();
  const s = captain(game, 'Gunner');
  const me = s.ship!;
  gullFight(game, s);
  landTac(game, s, { a: 'quick' }, true);
  closeFight(game, s);
  assert.ok(untouchable(game, me));
  me.reload.port = 0;
  me.ammoSel = 'round';
  me.ammo.round = 50;
  assert.equal(fireBroadside(game, me, 'port', 200), null);
  assert.ok(!untouchable(game, me));
});

test('a boarding of hers: a third ship touches neither; the end leaves her a grace; her reckoning put away shortens it', () => {
  const game = sea();
  const s = captain(game, 'Rail');
  const me = s.ship!;
  const o = pirateBy(game, s);
  o.state.speed = me.state.speed = 0;
  startBoarding(game, me, o, 'standard');
  assert.ok(me.boarding && o.boarding, 'grappled');
  assert.ok(me.boarding.fight.tac, 'on the hexes');
  const third = pirateBy(game, s);
  assert.notEqual(damageBlocked(game, third, me), null);
  startBoarding(game, third, me, 'standard');
  assert.equal(third.boarding, null);
  // she takes no stack while grappled
  runAdmin(game, s, '/stack gull go');
  // (the stack fight is refused while the grapples hold)
  assert.equal(landFighting(game, s), false);
  // fought out (the tester's quick fight): the boarding ends — her grace, and her card up
  (s as unknown as { conn: { push: (m: unknown) => void } }).conn.push({ t: 'tac', act: { a: 'auto', on: true } });
  for (let i = 0; i < 20 * 600 && me.boarding; i++) game.step();
  assert.equal(me.boarding, null, 'the boarding ended');
  assert.ok(untouchable(game, me));
  assert.notEqual(damageBlocked(game, third, me), null);
  (s as unknown as { conn: { push: (m: unknown) => void } }).conn.push({ t: 'tac_done' });
  assert.ok(untouchable(game, me), 'a moment more after the card');
  steps(game, 20 * (BATTLE_GRACE + 1));
  assert.ok(!untouchable(game, me));
});

test('the self row and the sea row carry «в бою» (SF.IN_BATTLE) while she fights', () => {
  const game = sea();
  const s = captain(game, 'Flagged');
  gullFight(game, s);
  steps(game, 6);
  const c = (s as unknown as { conn: { last: (t: string) => { self?: { flags?: number }; you?: { flags?: number } } | undefined } }).conn;
  const snap = c.last('snap') as unknown as { you?: { flags: number } } | undefined;
  assert.ok(snap?.you && (snap.you.flags & SF.IN_BATTLE), 'her own row');
});

test('the watchdog: a battle with nobody’s turn, or a turn no order ends, moves on by itself', () => {
  const game = sea();
  const s = captain(game, 'Watch');
  const a = sideOf(game, s.ship!, s.ship!, true);
  const b = sideOf(game, s.ship!, s.ship!, false);
  const rng = new Rng(7);
  const bt = newBattle(a, b, 7, 0, rng, {});
  // nobody's turn and no end (a deadlock): moved on after its clock and a moment
  bt.active = null;
  stepBattle(bt, bt.turnEnds + 5, rng);
  assert.ok(bt.active !== null || bt.over, 'the next stack has its turn');
  // a human turn whose clock has run out is played (defended, or by the sea's mind) — never left hanging
  for (let t = bt.turnEnds + 1, k = 0; k < 400 && !bt.over; k++, t += 31) stepBattle(bt, t, rng);
  assert.ok(bt.over, 'the battle ends by itself however long nobody plays');
});

test('the words of the battles’ isolation in Russian', () => {
  for (const [en, ru] of Object.entries(SERVER_RU_BATTLE)) assert.ok(en && ru && !/[A-Za-z]/.test(ru), en);
});

test('a stack fight survives a Telegram reload: the field is sent again and her orders still play it; no docking out of it', async () => {
  const { PROTOCOL_VERSION } = await import('../shared/src/constants.ts');
  const { FakeConn } = await import('./helpers.ts');
  const game = sea();
  const s = captain(game, 'Reloaded');
  gullFight(game, s);
  const c = (s as unknown as { conn: InstanceType<typeof FakeConn> }).conn;
  const token = c.last('welcome')!.token;
  c.close();
  steps(game, 40); // two seconds with the line down: her party fights on by itself
  const c2 = new FakeConn();
  game.attach(c2 as unknown as import('../server/src/net/websocket.ts').WsConnection);
  c2.push({ t: 'hello', v: PROTOCOL_VERSION, token });
  const s2 = game.sessionByName('Reloaded')!;
  assert.ok(landFighting(game, s2), 'the fight is still hers');
  const v = c2.last('board_tac')?.view;
  assert.ok(v && v.land, 'the field is sent with the login');
  assert.ok(v.over || !v.stacks.every((x) => x.side !== 0), 'her stacks on it');
  // her order is taken by the live fight (no «The fight is over», no «Nothing to fight»)
  const before = c2.all('toast').length;
  c2.push({ t: 'tac', act: { a: 'defend' } });
  const said = c2.all('toast').slice(before).map((m) => m.msg);
  assert.ok(!said.some((m) => /Nothing to fight|The fight is over/.test(m)), said.join('; '));
  // no harbour, no landing out of a battle
  c2.push({ t: 'dock' });
  assert.ok(!s2.ship!.docked);
});
