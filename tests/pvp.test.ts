import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSnap, decodeSnap } from '../shared/src/codec.ts';
import { SF } from '../shared/src/protocol.ts';
import { WANTED_THRESHOLDS } from '../shared/src/data/factions.ts';
import { applyDamage, damageBlocked } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { bountyOn, grantBubble, lootMul, onPlayerKill, pvpFlags, stepPvp } from '../server/src/game/pvp.ts';
import { coloursSecond } from '../server/src/game/colours.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function sess(game: Game, name: string): PlayerSession {
  return game.sessionByName(name)!;
}

function sea(s: PlayerSession, x: number, y: number, region: RegionId, level = 20): void {
  const sh = s.ship!;
  sh.docked = null;
  s.profile!.docked = null;
  sh.state.x = x;
  sh.state.y = y;
  sh.state.speed = 0;
  sh.region = region;
  sh.protectedUntil = 0;
  sh.lastCombat = -1000;
  s.profile!.level = level;
  sh.level = level;
}

function three(game: Game): { a: FakeConn; b: FakeConn; c: FakeConn; A: PlayerSession; B: PlayerSession; C: PlayerSession } {
  const a = join(game, 'Anne Brine'), b = join(game, 'Bram Brine'), c = join(game, 'Cora Brine');
  return { a, b, c, A: sess(game, 'Anne Brine'), B: sess(game, 'Bram Brine'), C: sess(game, 'Cora Brine') };
}

test('the pirate flag (the old Black Flag): ordered in port, up a minute later; anyone may come for her, and no crime to', () => {
  const { game } = makeGame();
  const { a, b, A, B, C } = three(game);
  assert.equal(A.profile!.pvp.flag, 'faction', 'a new captain flies her city’s colours');
  sea(A, 30_000, 30_000, 'gravewater');
  a.push({ t: 'pvp', action: 'black_flag', on: true });
  assert.match(a.last('toast')!.msg, /only in port/);
  assert.equal(A.profile!.pvp.flag, 'faction');
  // In port the order is taken; the flag goes up a minute later.
  assert.ok(B.ship!.docked);
  b.push({ t: 'pvp', action: 'black_flag', on: true });
  assert.match(b.last('toast')!.msg, /goes up in 1 min/);
  coloursSecond(game, B);
  assert.equal(B.profile!.pvp.flag, 'faction', 'not yet');
  const t0 = Date.now();
  game.wallNow = () => t0 + 61_000;
  coloursSecond(game, B);
  assert.equal(B.profile!.pvp.flag, 'pirate');
  assert.ok(pvpFlags(game, B.ship!) & SF.BLACK_FLAG);
  A.profile!.pvp.flag = 'faction';
  sea(B, 30_200, 30_000, 'gravewater');
  // Attacking her is no crime; she fires back as freely.
  const bHull = B.ship!.hull;
  applyDamage(game, B.ship!, { hull: 5 }, A.ship!);
  assert.ok(B.ship!.hull < bHull);
  assert.equal(A.profile!.infamy, 0);
  applyDamage(game, A.ship!, { hull: 5 }, B.ship!);
  assert.equal(B.profile!.infamy, 0, 'firing back');
  // On a neutral captain her shot does not land at all; on a city's captain who is no fair game it is a crime.
  sea(C, 30_400, 30_000, 'gravewater');
  C.profile!.pvp.flag = 'neutral';
  const cHull = C.ship!.hull;
  applyDamage(game, C.ship!, { hull: 5 }, B.ship!);
  assert.equal(C.ship!.hull, cHull, 'Cora sails under neutral colours');
  C.profile!.pvp.flag = 'faction';
  applyDamage(game, C.ship!, { hull: 5 }, B.ship!);
  assert.ok(C.ship!.hull < cHull && B.profile!.infamy > 0, 'Cora was no fair game');
  // Plunder: NPCs +15% and captains ×1.2 under the flag.
  A.profile!.pvp.flag = 'pirate';
  assert.ok(Math.abs(lootMul(game, A.ship!, B.ship!) - 1.2) < 1e-9);
});

test('neutral colours: no captain fires on her anywhere, at any level; she fires on none', () => {
  const { game } = makeGame();
  const { A, B } = three(game);
  sea(A, 30_000, 30_000, 'gravewater', 30);
  sea(B, 30_200, 30_000, 'gravewater', 4);
  A.profile!.pvp.flag = 'pirate';
  B.profile!.pvp.flag = 'neutral';
  assert.match(String(damageBlocked(game, A.ship!, B.ship!)), /She sails under neutral colours/);
  assert.ok(pvpFlags(game, B.ship!) & SF.NEUTRAL);
  const hull = B.ship!.hull;
  applyDamage(game, B.ship!, { hull: 50 }, A.ship!);
  assert.equal(B.ship!.hull, hull, 'no damage gets through by any road');
  // In lawless water too (the pennant was not), and past level 15 and twenty hours at sea.
  B.ship!.region = 'dead_mans_expanse';
  B.profile!.level = 60;
  B.profile!.pvp.played = 40 * 3600;
  assert.match(String(damageBlocked(game, A.ship!, B.ship!)), /She sails under neutral colours/);
  // She fires on no captain.
  assert.match(String(damageBlocked(game, B.ship!, A.ship!)), /You sail under neutral colours/);
  const aHull = A.ship!.hull;
  applyDamage(game, A.ship!, { hull: 50 }, B.ship!);
  assert.equal(A.ship!.hull, aHull);
});

test('the Green Pennant shields a young captain under her city’s flag in contested water until she attacks someone', () => {
  const { game } = makeGame();
  const { A, B } = three(game);
  sea(A, 30_000, 30_000, 'gravewater', 30);
  sea(B, 30_200, 30_000, 'gravewater', 4);
  A.profile!.pvp.flag = 'pirate'; // (she may come for anyone but the pennant)
  assert.match(String(damageBlocked(game, A.ship!, B.ship!)), /Green Pennant/);
  assert.ok(pvpFlags(game, B.ship!) & SF.GREEN_PENNANT);
  const hull = B.ship!.hull;
  applyDamage(game, B.ship!, { hull: 50 }, A.ship!);
  assert.equal(B.ship!.hull, hull, 'no damage gets through by any road');
  // Not in lawless water.
  B.ship!.region = 'dead_mans_expanse';
  assert.equal(damageBlocked(game, A.ship!, B.ship!), null);
  B.ship!.region = 'gravewater';
  // The young captain fires first: the pennant comes down for half an hour.
  applyDamage(game, A.ship!, { hull: 5 }, B.ship!);
  assert.equal(damageBlocked(game, A.ship!, B.ship!), null);
  game.wallNow = () => Date.now() + 31 * 60_000;
  assert.match(String(damageBlocked(game, A.ship!, B.ship!)), /Green Pennant/);
  // Twenty hours at sea and it is gone for good.
  B.profile!.pvp.played = 20 * 3600;
  assert.equal(damageBlocked(game, A.ship!, B.ship!), null);
});

test('repeat kills pay less and cost more; hunting minnows brings the Shame', () => {
  const { game } = makeGame();
  const { A, B } = three(game);
  sea(A, 30_000, 30_000, 'gravewater');
  sea(B, 30_200, 30_000, 'gravewater');
  const muls: number[] = [];
  for (let i = 0; i < 4; i++) {
    muls.push(lootMul(game, A.ship!, B.ship!));
    onPlayerKill(game, A.ship!, B.ship!, 'sunk');
  }
  assert.deepEqual(muls, [1, 0.5, 0.25, 0]);
  const infamy = A.profile!.infamy;
  assert.ok(infamy > 12 * (1 + 1.5 + 2 + 3) - 1e-6, `${infamy}`);
  assert.equal(B.profile!.pvp.sunkBy[0].name, 'Anne Brine');
  // Two hours on, a fresh start.
  game.wallNow = () => Date.now() + 2 * 3_600_000 + 1000;
  assert.equal(lootMul(game, A.ship!, B.ship!), 1);
  // A ship three levels above against a sloop of the first: the Shame (canon D12 — the ladder is by ship level).
  onHull(game, A.ship!, 'brigantine');
  assert.equal(A.ship!.shipLevel - B.ship!.shipLevel, 3);
  const m = lootMul(game, A.ship!, B.ship!);
  assert.ok(m < 0.5 && m > 0);
  onPlayerKill(game, A.ship!, B.ship!, 'sunk');
  assert.ok(pvpFlags(game, A.ship!) & SF.SHAME);
  B.ship!.region = 'dead_mans_expanse';
  // Lawless: the minnow cut stops at ×0.5 (and this is her second sinking in two hours: ×0.5 again).
  assert.equal(lootMul(game, A.ship!, B.ship!), 0.25);
});

test('a duel: by consent, in the ring, nobody sinks, outsiders stand clear, all is restored and the rating moves', () => {
  const { game } = makeGame();
  const { a, b, c, A, B, C } = three(game);
  sea(A, 30_000, 30_000, 'black_coast');
  sea(B, 30_300, 30_000, 'black_coast');
  sea(C, 30_600, 30_000, 'black_coast');
  assert.equal(damageBlocked(game, A.ship!, B.ship!), 'Safe waters: no PvP here.');
  a.push({ t: 'pvp', action: 'duel', name: 'Bram Brine', fleet: false });
  const ch = B.profile && b.last('self')!.self.pvp.challenges[0];
  assert.ok(ch, 'the challenge shows in their papers');
  b.push({ t: 'pvp', action: 'duel_answer', id: ch!.id, accept: true });
  assert.ok(a.last('duel')!.view);
  assert.equal(damageBlocked(game, A.ship!, B.ship!), 'The duel has not begun');
  game.now += 6;
  assert.equal(damageBlocked(game, A.ship!, B.ship!), null, 'safe water, but a duel');
  assert.match(String(damageBlocked(game, C.ship!, B.ship!)), /stand clear/);
  const bHull = B.ship!.hull, bAmmo = B.ship!.ammo.round;
  B.ship!.ammo.round -= 10;
  applyDamage(game, B.ship!, { hull: 30, crew: 3 }, A.ship!);
  assert.equal(A.profile!.infamy, 0, 'a duel is no crime');
  applyDamage(game, B.ship!, { hull: 99_999 }, A.ship!);
  assert.equal(B.ship!.sinkingUntil, 0, 'she struck instead of sinking');
  assert.equal(a.last('duel')!.view, null, 'over');
  assert.equal(B.ship!.hull, bHull);
  assert.equal(B.ship!.ammo.round, bAmmo, 'powder and shot returned');
  assert.equal(B.ship!.surrendered, false);
  assert.ok(A.profile!.pvp.rating > 1000 && B.profile!.pvp.rating < 1000);
  assert.equal(A.profile!.pvp.duelWins, 1);
  assert.equal(damageBlocked(game, A.ship!, B.ship!), 'Safe waters: no PvP here.');
  // Fleeing the ring loses.
  A.ship!.lastCombat = C.ship!.lastCombat = -1000;
  a.push({ t: 'pvp', action: 'duel', name: 'Cora Brine', fleet: false });
  c.push({ t: 'pvp', action: 'duel_answer', id: c.last('self')!.self.pvp.challenges[0].id, accept: true });
  game.now += 6;
  C.ship!.state.x = 40_000;
  stepPvp(game);
  game.now += 11;
  stepPvp(game);
  assert.equal(game.pvp.duels.size, 0);
  assert.equal(A.profile!.pvp.duelWins, 2);
});

test('bounties: the right of revenge, the captains’ purse, the Crown’s price, and no pay between friends', () => {
  const { game } = makeGame();
  const { b, c, A, B, C } = three(game);
  sea(A, 30_000, 30_000, 'gravewater');
  sea(B, 30_300, 30_000, 'gravewater');
  sea(C, 30_600, 30_000, 'gravewater');
  onPlayerKill(game, A.ship!, B.ship!, 'sunk');
  // Revenge: Bram sees Anne within 3 km.
  game.now = Math.ceil(game.now / 5) * 5;
  stepPvp(game);
  assert.equal(b.last('marks')!.list[0].name, 'Anne Brine');
  b.push({ t: 'pvp', action: 'bounty', name: 'Anne Brine', amount: 1500 });
  assert.match(b.last('toast')!.msg, /harbour office/);
  B.ship!.docked = 'saltmarrow';
  const bGold = B.profile!.gold = 5000;
  b.push({ t: 'pvp', action: 'bounty', name: 'Anne Brine', amount: 1500 });
  assert.equal(B.profile!.gold, bGold - 1500, 'free within a day');
  assert.equal(bountyOn(game, A.accountId), 1500);
  b.push({ t: 'pvp', action: 'bounty', name: 'Cora Brine', amount: 1500 });
  assert.match(b.last('toast')!.msg, /sank you/);
  // A friend who traded with her yesterday collects nothing.
  C.profile!.pvp.ties[A.accountId] = game.wallNow();
  A.ship!.attackers.set(C.ship!.id, game.now);
  onPlayerKill(game, C.ship!, A.ship!, 'sunk');
  assert.equal(bountyOn(game, A.accountId), 1500);
  // A stranger does — and the Crown pays for a wanted head.
  C.profile!.pvp.ties = {};
  A.profile!.infamy = WANTED_THRESHOLDS[2];
  A.ship!.wantedCache = 2;
  const cGold = C.profile!.gold;
  onPlayerKill(game, C.ship!, A.ship!, 'sunk');
  assert.equal(C.profile!.gold, cGold + 1500 + 100 * A.profile!.level * 4);
  assert.equal(bountyOn(game, A.accountId), 0);
  assert.ok(A.profile!.infamy < WANTED_THRESHOLDS[2], 'a wanted level lower');
  assert.ok(b.last('mail')!.letters.some((l) => l.subject.includes('has paid')));
  void c;
});

test('the bubble after a sinking: ten minutes untouchable, burst by casks or lawless water; 32-bit flags on the wire', () => {
  const { game } = makeGame();
  const { a, A, B } = three(game);
  A.profile!.level = 20;
  grantBubble(game, A);
  a.push({ t: 'undock' });
  assert.ok(A.ship!.protectedUntil > game.now + 590);
  sea(B, A.ship!.state.x + 100, A.ship!.state.y, 'gravewater');
  A.ship!.region = 'gravewater';
  A.profile!.pvp.flag = 'pirate'; // (fair game by her colours: only the bubble stands between them)
  B.profile!.pvp.flag = 'faction';
  assert.equal(damageBlocked(game, B.ship!, A.ship!), 'protected');
  A.ship!.region = 'dead_mans_expanse';
  game.now = Math.ceil(game.now / 5) * 5;
  stepPvp(game);
  assert.equal(A.ship!.protectedUntil, 0, 'lawless water ends it');
  const snap = { t: 'snap' as const, tick: 1, time: 1, ack: 0, you: null, ships: [[7, 1, 2, 0, 1, 0.5, 1, 1, SF.BLACK_FLAG | SF.BOUNTY | SF.PROTECTED, 1]] as never, loot: [], wind: [0, 1] as [number, number], weather: 'breeze' as const, region: 'gravewater' as const, fog: 0 };
  assert.equal(decodeSnap(encodeSnap(snap)).ships[0][8], SF.BLACK_FLAG | SF.BOUNTY | SF.PROTECTED);
});
