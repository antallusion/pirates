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

// ------------------------------------------------------------------ 3. «Заложите постройки» at her island

test('«Заложите постройки»: at her island (or in a harbour by it) «Цели и вести» draws «Строить», which opens the island; elsewhere «Плыть»', async () => {
  const { questAct } = await import('../shared/src/data/questact.ts');
  const { goalSheetView } = await import('../client/src/ui/goalsheet.ts');
  const { actButton } = await import('../client/src/ui/questact.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  const act = questAct({ type: 'build', count: 1, text: 'Lay works on your island: 1.' })!;
  assert.deepEqual(act, { verb: 'build', how: 'isle' });
  const q = { id: 'c06_07', name: 'A Room Beneath the Floor', kind: 'campaign' as const, step: 0, steps: 2, text: 'Lay works on your island: 1.', progress: 0, need: 1, act };
  const there = goalSheetView({ quests: [q], dockedAt: null, nearIsle: true });
  assert.deepEqual(there.campaign?.line?.here ?? there.active[0]?.here, act, 'by her island: the verb');
  const away = goalSheetView({ quests: [q], dockedAt: 'fogmouth', nearIsle: false });
  assert.equal(away.campaign?.line?.here ?? away.active[0]?.here, undefined, 'far from it: «Плыть»');
  setLang('ru');
  const btn = actButton(q.id, act, 'btn');
  assert.match(btn, /data-act="quest_isle"/);
  assert.match(btn, /Строить/);
  setLang('en');
  assert.match(actButton(q.id, act, 'btn'), />Build</);
});

// ------------------------------------------------------------------ 4. the guild's price told first

test('the guild founding card tells its price and the rest before «Основать» (RU+EN), on every screen; short of silver the button says why', async () => {
  const { foundCard } = await import('../client/src/ui/company.ts');
  const { GUILD_COST } = await import('../shared/src/data/social.ts');
  const { GUILD_COST: SERVER_COST } = await import('../server/src/game/guilds.ts');
  const { setLang } = await import('../client/src/i18n.ts');
  assert.equal(GUILD_COST, SERVER_COST, 'one price');
  setLang('ru');
  const poor = foundCard('gravesend', 3200).replace(/ /g, ' '); // (the typography's no-break spaces read as spaces)
  const req = poor.slice(poor.indexOf('g-req'), poor.indexOf('g-found'));
  assert.match(req, /10[\s  ]?000 серебра \(у вас 3[\s  ]?200\)/, 'the price and her silver');
  assert.match(req, /в портовой конторе/);
  assert.match(req, /название из 3–24 букв/);
  assert.doesNotMatch(req, /w-desk/, 'not the desk’s alone');
  assert.match(poor, /id="g-found" disabled title="Не хватает серебра: ещё 6[\s  ]?800"/);
  const rich = foundCard('gravesend', 12000);
  assert.doesNotMatch(rich, /id="g-found" disabled/);
  assert.match(foundCard(null, 12000), /id="g-found" disabled title="В\sпорту"/);
  setLang('en');
  assert.match(foundCard('gravesend', 0), /10[,\s  ]?000 silver \(you have 0\)/);
});
