// «Сезонная карта»: every boarding won and every creature fight won counts for the season's challenges (forum
// 2026-11-07, Эдуард: «Победите в 4 абордажах» stood at 1/4 after a day of a dozen boardings — a grey prize taught the
// season nothing and so never reached the challenge either). The experience keeps its own rules; the count does not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PASS_XP } from '../shared/src/data/seasonpass.ts';
import { passState, seasonCount, seasonXp } from '../server/src/game/seasonpass.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame } from './helpers.ts';

const T1 = Date.UTC(2026, 10, 10, 12);
type Credit = { creditKill(k: unknown, v: unknown, how: string): void };

function aboard(name: string): { game: Game; s: PlayerSession } {
  const { game } = makeGame();
  game.wallNow = () => T1;
  join(game, name);
  const s = game.sessionByName(name)!;
  return { game, s };
}

/** Her day's three set to these (the roll is the account's: the test picks its own). */
function dayOf(game: Game, acc: number, ids: string[]): void {
  seasonXp(game, game.sessionByAccount(acc), 'isle', 0); // (rolls the day and the week)
  const st = passState(game, acc);
  st.dch = { at: st.dch!.at, ids, prog: ids.map(() => 0), done: ids.map(() => false) };
  st.wch = { at: st.wch!.at, ids: ['w_board', 'w_lair', 'w_boss', 'w_pvp'], prog: [0, 0, 0, 0], done: [false, false, false, false] };
  game.db.setKv(`spass:${acc}`, st);
}

const prog = (game: Game, acc: number, id: string): number => {
  const st = passState(game, acc);
  const i = st.dch!.ids.indexOf(id);
  if (i >= 0) return st.dch!.prog[i];
  return st.wch!.prog[st.wch!.ids.indexOf(id)];
};

test('seasonCount moves the challenges only: no experience, no day\'s cap used', () => {
  const { game, s } = aboard('Count Cora');
  const acc = s.accountId;
  dayOf(game, acc, ['d_board', 'd_lair', 'd_jobs']);
  const xp0 = passState(game, acc).xp;
  seasonCount(game, s, 'board');
  seasonCount(game, s, 'lair');
  const st = passState(game, acc);
  assert.equal(st.xp, xp0, 'no season experience');
  assert.equal(st.count.board ?? 0, 0, 'the cap untouched');
  assert.equal(prog(game, acc, 'd_board'), 1);
  assert.equal(prog(game, acc, 'd_lair'), 1);
  assert.equal(prog(game, acc, 'w_board'), 1);
  assert.equal(prog(game, acc, 'w_lair'), 1);
  // the fourth boarding closes the day's challenge and pays it
  for (let i = 0; i < 3; i++) seasonCount(game, s, 'board');
  const done = passState(game, acc);
  assert.ok(done.dch!.done[0], 'd_board done');
  assert.equal(done.xp - xp0, 150, 'only the challenge\'s own experience');
});

test('a grey ship taken by boarding counts for «Победите в 4 абордажах» (Game.creditKill), with no season experience', () => {
  const { game, s } = aboard('Grey Greta');
  const acc = s.accountId;
  s.profile!.level = 40;
  dayOf(game, acc, ['d_board', 'd_lair', 'd_jobs']);
  s.ship!.docked = null;
  const xp0 = passState(game, acc).xp;
  for (let i = 0; i < 4; i++) {
    const v = game.spawnNpcShip('merchant', 'sloop', 'league', s.ship!.state.x + 300 + i * 60, s.ship!.state.y, 0);
    v.attackers.set(s.ship!.id, game.now);
    (game as unknown as Credit).creditKill(s.ship!, v, 'boarded');
  }
  const st = passState(game, acc);
  assert.equal(prog(game, acc, 'w_board'), 4, 'four boardings counted');
  assert.ok(st.dch!.done[0], 'the day\'s challenge done');
  assert.equal(st.count.board ?? 0, 0, 'grey prizes: no season experience of their own');
  assert.equal(st.xp - xp0, 150, 'the challenge paid');
});

test('a ship sunk (not boarded) does not count as a boarding', () => {
  const { game, s } = aboard('Sink Sal');
  const acc = s.accountId;
  dayOf(game, acc, ['d_board', 'd_lair', 'd_jobs']);
  s.ship!.docked = null;
  const v = game.spawnNpcShip('pirate', 'sloop', 'confederacy', s.ship!.state.x + 300, s.ship!.state.y, 0);
  v.attackers.set(s.ship!.id, game.now);
  (game as unknown as Credit).creditKill(s.ship!, v, 'sunk');
  assert.equal(prog(game, acc, 'd_board'), 0);
});

test('a ship of her own level taken: the season experience and the count, once', () => {
  const { game, s } = aboard('Even Eva');
  const acc = s.accountId;
  dayOf(game, acc, ['d_board', 'd_lair', 'd_jobs']);
  s.ship!.docked = null;
  const v = game.spawnNpcShip('merchant', 'sloop', 'league', s.ship!.state.x + 300, s.ship!.state.y, 0);
  v.attackers.set(s.ship!.id, game.now);
  (game as unknown as Credit).creditKill(s.ship!, v, 'boarded');
  const st = passState(game, acc);
  assert.equal(prog(game, acc, 'd_board'), 1, 'counted once, not twice');
  assert.equal(st.count.board, 1);
  assert.ok(st.xp >= PASS_XP.board);
});
