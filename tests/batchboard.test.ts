// The leftovers of the mid-game QA pass (2026-10-23), each with its regression: group invitations that outlive a
// window and a /speed, the build step's «Плыть» at her own island, the guild's price told before the refusal, the
// starting sea's sharks, Russian plurals in the server's lines, the Whispering Archipelago's pirates who struck at
// 1200 m.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INVITE_MS, stepSocial } from '../server/src/game/party.ts';
import { InviteQueue } from '../client/src/ui/invitequeue.ts';
import { join, makeGame } from './helpers.ts';

// ------------------------------------------------------------------ 2. group invitations

test('a group invitation stands three minutes of real time — not a minute of the game’s clock (/speed, a window open)', () => {
  const { game } = makeGame();
  const a = join(game, 'Inv Anne'), b = join(game, 'Inv Bram');
  let wall = Date.now();
  game.wallNow = () => wall + game.wallSkew;
  a.push({ t: 'group', action: 'invite', name: 'Inv Bram' });
  assert.equal(b.last('party')!.invites.length, 1);
  // the game's clock runs on (and /speed runs the wall clock ahead with it): the invitation stands
  game.now += 600;
  game.wallSkew += 600_000;
  wall += 60_000;
  stepSocial(game);
  assert.equal(b.last('party')!.invites.length, 1, 'a minute of real time, ten of the game’s');
  wall += INVITE_MS - 60_000 - 1000;
  stepSocial(game);
  assert.equal(b.last('party')!.invites.length, 1, 'still under three minutes');
  wall += 2000;
  stepSocial(game);
  assert.equal(b.last('party')!.invites.length, 0, 'lapsed after three minutes');
  assert.ok(INVITE_MS >= 170_000 && INVITE_MS <= 200_000);
});

test('an invitation that comes while a window is open is told when the window closes (unless answered or lapsed)', () => {
  const q = new InviteQueue();
  q.note([{ id: 1, from: 'Anne' }], 'daily');
  q.note([{ id: 1, from: 'Anne' }, { id: 2, from: 'Bram' }], 'port');
  q.note([{ id: 3, from: 'Cole', ask: true }], 'port'); // (a captain asking to join: the leader's card, not this)
  assert.deepEqual(q.due([{ id: 1, from: 'Anne' }]), [{ id: 1, from: 'Anne' }], 'Bram’s lapsed meanwhile');
  assert.deepEqual(q.due([{ id: 1, from: 'Anne' }]), [], 'told once');
  q.note([{ id: 4, from: 'Dora' }], null);
  q.note([{ id: 5, from: 'Ezra' }], 'company');
  assert.deepEqual(q.due([{ id: 4, from: 'Dora' }, { id: 5, from: 'Ezra' }]), [], 'no window, or the Company screen itself: the toast and the card do');
});
