// The chat outlives a restart (owner, 2026-10-30: «в чате если кто-то пишет, то этот чат должен сохраняться 8 часов и его
// мог увидеть при открытии даже чел который был в оффлайне на момент написания, открыв чат типа»): the world's, the
// ships-in-sight's and the guilds' lines go to the database and come back on boot, cut to the window; a captain who
// comes aboard after the restart gets them; the guild's only to its members; the groups' are not kept (a group dies
// with the process).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_HISTORY, CHAT_KEEP_MS } from '../shared/src/chat.ts';
import { AuthService } from '../server/src/auth.ts';
import { Game } from '../server/src/game/Game.ts';
import { chatFromAfar } from '../server/src/game/chat.ts';
import { answerInvite, foundGuild, invite } from '../server/src/game/guilds.ts';
import type { Database } from '../server/src/persistence/db.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';

const HOUR = 3600_000;

/** The process again: a new Game on the same database (the shutdown's save first). */
function restart(old: Game, db: Database, clock: () => number): Game {
  old.stop();
  const game = new Game({ db, auth: new AuthService(db), log: () => {} });
  game.directorOn = false;
  game.tacticalBoarding = false;
  game.zoneBosses.on = false;
  game.invasions.on = false;
  game.wallNow = clock;
  return game;
}

const said = (c: ReturnType<typeof join>, from: string) => c.last('chat_hist')!.lines.filter((l) => l.from === from).map((l) => l.text);

test('a world line survives a restart and reaches a captain who comes aboard later', () => {
  const { game, db } = makeGame();
  let clock = 500 * HOUR;
  game.wallNow = () => clock;
  const a = join(game, 'Ann Speaker');
  a.push({ t: 'chat', text: 'ahoy, anyone?', ch: 'world' });
  steps(game, 20 * 6); // the debounced write
  const g2 = restart(game, db, () => clock);
  const b = join(g2, 'Bea Latecomer');
  assert.deepEqual(said(b, 'Ann Speaker'), ['ahoy, anyone?']);
});

test('the write on shutdown alone keeps the last line (no tick in between)', () => {
  const { game, db } = makeGame();
  const clock = 600 * HOUR;
  game.wallNow = () => clock;
  const a = join(game, 'Ann Quick');
  a.push({ t: 'chat', text: 'last words', ch: 'world' });
  const g2 = restart(game, db, () => clock);
  assert.deepEqual(said(join(g2, 'Bea Quick'), 'Ann Quick'), ['last words']);
});

test('the window holds after a reload: fifty a channel, nothing older than eight hours', () => {
  const { game, db } = makeGame();
  let clock = 700 * HOUR;
  game.wallNow = () => clock;
  join(game, 'Host Hal');
  let n = 0;
  const line = (text: string, at: number) => ({ from: 'Far Voice', text, id: `pp${(++n).toString(36)}`, at });
  for (let i = 0; i < 70; i++) chatFromAfar(game, { kind: 'world', line: line(`hello ${i}`, clock - 70 + i), from: 9999 });
  const g2 = restart(game, db, () => clock);
  const h = said(join(g2, 'Cal After'), 'Far Voice');
  assert.equal(h.length, CHAT_HISTORY);
  assert.equal(h[0], 'hello 20');
  // the next process, nine hours on: all of it too old
  clock += CHAT_KEEP_MS + 60_000;
  const g3 = restart(g2, db, () => clock);
  assert.deepEqual(said(join(g3, 'Dee Much Later'), 'Far Voice'), []);
  // a line relayed again after the reload is taken once
  clock -= CHAT_KEEP_MS + 60_000;
  const g4 = restart(g3, db, () => clock);
  chatFromAfar(g4, { kind: 'world', line: line('once', clock), from: 9999 });
  const again = { kind: 'world' as const, line: { from: 'Far Voice', text: 'once', id: `pp${n.toString(36)}`, at: clock }, from: 9999 };
  const g5 = restart(g4, db, () => clock);
  chatFromAfar(g5, again);
  assert.equal(said(join(g5, 'Eve Once'), 'Far Voice').filter((t) => t === 'once').length, 1);
});

test('the guild\'s lines after a restart: to its members (even away when said), never to others', () => {
  const { game, db } = makeGame();
  const clock = 800 * HOUR;
  game.wallNow = () => clock;
  const ann = join(game, 'Ann Founder');
  const bob0 = join(game, 'Bob Member');
  const A = game.sessionByName('Ann Founder')!, B = game.sessionByName('Bob Member')!;
  A.profile!.gold = 50_000;
  assert.equal(foundGuild(game, A, 'Salt Owls', 'OWL'), null);
  const g = game.guilds.of(game, A.accountId)!;
  assert.equal(invite(game, A, 'Bob Member'), null);
  assert.equal(answerInvite(game, B, g.id, true), null);
  assert.equal(game.guilds.of(game, B.accountId)?.id, g.id);
  const token = bob0.last('welcome')!.token;
  bob0.close(); // Bob goes ashore: away when the guild's words are said
  ann.push({ t: 'chat', text: 'owls, gather at dawn', ch: 'guild' });
  steps(game, 20 * 5); // (the gate: a breath between two lines)
  ann.push({ t: 'chat', text: 'and a word to all', ch: 'world' });
  const g2 = restart(game, db, () => clock);
  const bob = new FakeConn(); // Bob comes back aboard (his account's token) after the restart
  g2.attach(bob as unknown as WsConnection);
  bob.push({ t: 'hello', v: PROTOCOL_VERSION, token });
  assert.equal(g2.guilds.of(g2, g2.sessionByName('Bob Member')!.accountId)?.id, g.id, 'the same captain, still sworn');
  assert.deepEqual(said(bob, 'Ann Founder').sort(), ['and a word to all', 'owls, gather at dawn']);
  const stranger = join(g2, 'Sal Stranger');
  assert.deepEqual(said(stranger, 'Ann Founder'), ['and a word to all'], 'the guild\'s words are not hers');
});
