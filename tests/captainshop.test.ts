// Premium captains cost money (owner, 2026-10-19: «Сейчас премиум героев можно на старте выбрать бесплатно, а они
// должны стоить денег. Примерно 2500 руб за героя»): the price on the shop's terms, the server's refusal of a premium
// captain not owned, the purchase through doubloons (a refusal costs nothing), the owned list of the choice screen,
// and a captain picked free before the change kept (grandfathered).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPTAINS, CAPTAIN_IDS, CAPTAIN_PRICE, captainPrice } from '../shared/src/data/captains.ts';
import { PRICE_MAX, PRICE_MIN } from '../shared/src/data/shop.ts';
import { STARS_PER_DOUBLOON } from '../shared/src/data/premium.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { buyCaptain, grantCaptain, ownedCaptains, ownsCaptain } from '../server/src/game/captainshop.ts';
import { creditPremium } from '../server/src/game/premium.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { FakeConn, makeGame } from './helpers.ts';
import { EN, RU } from '../client/src/lang/ui/captain.ts';
import { SERVER_RU_PREMIUM } from '../client/src/lang/server.ru.premium.ts';

function arrive(game: ReturnType<typeof makeGame>['game'], name: string) {
  const c = new FakeConn();
  const s = game.attach(c as unknown as WsConnection);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name });
  return { c, s };
}

test('premium captains: about 2 500 ₽ each, within the shop’s 290–9 900, the free four cost nothing', () => {
  assert.equal(CAPTAIN_PRICE, 2490);
  assert.ok(CAPTAIN_PRICE >= PRICE_MIN && CAPTAIN_PRICE <= PRICE_MAX);
  assert.ok(Math.abs(CAPTAIN_PRICE - 2500) <= 50, 'about 2 500 roubles');
  assert.equal(Math.round(CAPTAIN_PRICE * STARS_PER_DOUBLOON), 1868, 'Stars at the top-up’s rate');
  const premium = CAPTAIN_IDS.filter((id) => CAPTAINS[id].premium);
  assert.deepEqual(premium.sort(), ['admiral', 'drowned']);
  for (const id of CAPTAIN_IDS) assert.equal(captainPrice(id), CAPTAINS[id].premium ? CAPTAIN_PRICE : 0);
});

test('the server refuses a premium captain not owned; a free one is taken at once', () => {
  const { game } = makeGame();
  const a = arrive(game, 'No Coin');
  a.c.push({ t: 'create_captain', captain: 'admiral', shipName: 'Free Ride' });
  assert.equal(a.s.profile, null, 'no captain made');
  assert.equal(a.c.last('err')?.msg, 'That captain is sold for doubloons');
  a.c.push({ t: 'create_captain', captain: 'reaver', shipName: 'Honest Hull' });
  assert.equal(a.s.profile!.captain, 'reaver');
});

test('a premium captain bought for doubloons: checked first, paid once, owned by the account, then taken', () => {
  const { game, db } = makeGame();
  const a = arrive(game, 'Paying Gull');
  const acc = a.s.accountId;
  // short: refused, nothing moves
  creditPremium(game, acc, 1000, 'admin', 'test');
  a.c.push({ t: 'captain_shop', action: 'buy', captain: 'drowned' });
  assert.match(a.c.last('captain_shop')?.why ?? '', /Not enough doubloons/);
  assert.equal(db.doubloons(acc), 1000);
  assert.equal(ownsCaptain(game, acc, 'drowned'), false);
  // enough: paid, owned
  creditPremium(game, acc, 2000, 'admin', 'test2');
  a.c.push({ t: 'captain_shop', action: 'buy', captain: 'drowned' });
  const m = a.c.last('captain_shop')!;
  assert.equal(m.bought, 'drowned');
  assert.deepEqual(m.owned, ['drowned']);
  assert.equal(db.doubloons(acc), 3000 - CAPTAIN_PRICE);
  assert.equal(a.c.last('doubloons')?.n, 3000 - CAPTAIN_PRICE);
  // not twice, and a free one is not sold
  assert.equal(buyCaptain(game, a.s, 'drowned'), 'That captain is yours already');
  assert.equal(buyCaptain(game, a.s, 'corsair'), 'That captain is free to choose');
  assert.equal(db.doubloons(acc), 3000 - CAPTAIN_PRICE);
  // the other premium captain is still shut
  assert.deepEqual(ownedCaptains(game, acc), ['drowned']);
  a.c.push({ t: 'create_captain', captain: 'drowned', shipName: 'Bought Fair' });
  assert.equal(a.s.profile?.captain, 'drowned');
});

test('the choice screen hears which captains are owned; a grant is a ledger row of nought', () => {
  const { game, db } = makeGame();
  const a = arrive(game, 'Gifted Gull');
  a.c.push({ t: 'captain_shop', action: 'view' });
  assert.deepEqual(a.c.last('captain_shop')?.owned, []);
  grantCaptain(game, a.s.accountId, 'admiral');
  grantCaptain(game, a.s.accountId, 'admiral');
  a.c.push({ t: 'captain_shop', action: 'view' });
  assert.deepEqual(a.c.last('captain_shop')?.owned, ['admiral']);
  assert.equal(db.doubloons(a.s.accountId), 0);
});

test('grandfathered: a premium captain picked free before the change sails on after a reconnect', () => {
  const { game } = makeGame();
  const a = arrive(game, 'Old Hand');
  a.c.push({ t: 'create_captain', captain: 'corsair', shipName: 'Old Signal' });
  // (as before the change: a premium captain saved with no purchase on the account)
  a.s.profile!.captain = 'admiral';
  game.saveSession(a.s);
  assert.equal(ownsCaptain(game, a.s.accountId, 'admiral'), false);
  const token = a.c.last('welcome')!.token;
  a.c.close();
  const b = new FakeConn();
  const s2 = game.attach(b as unknown as WsConnection);
  b.push({ t: 'hello', v: PROTOCOL_VERSION, token });
  assert.equal(b.last('welcome')?.hasCaptain, true);
  assert.equal(s2.profile?.captain, 'admiral', 'the captain she had stays hers');
  assert.ok(b.last('init'), 'aboard');
});

test('every word of the premium captains in both languages, the Russian without Latin', () => {
  for (const k of ['premiumLocked', 'premiumOwned', 'premiumOwnedLong', 'lockedTitle', 'buy', 'buyFor', 'buyAsk', 'buyYes', 'buyNo', 'bought', 'payClosed'] as const) {
    assert.ok(EN[k] && RU[k], k);
    assert.doesNotMatch(RU[k].replace(/\{\w+\}/g, ''), /[A-Za-z]/, k);
  }
  for (const k of ['That captain is sold for doubloons', 'That captain is free to choose', 'That captain is yours already', 'Not enough doubloons: top up your account first.']) assert.ok(SERVER_RU_PREMIUM[k], k);
});
