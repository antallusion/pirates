// Honest refusals of a purchase and the «sell before you buy» advisor (owner, 2026-10-21: «у меня просто полностью трюм
// заполнен, но квест на покупку рома есть и купить не могу, потому что "недостаточно на складе". тут ошибка в том, что
// либо в порту это не продается, либо купить невозможно из-за того, что нет места — одно из двух. похожих ошибок во всей
// игре быть не должно»). Each refusal says its one real reason with its numbers; a full hold is «нет места», never
// «склад»; not sold here names the nearest ports that sell it; «Продать и купить» sells only what is needed — never quest
// cargo, never the voyage's minimum — and buys, all or nothing; the web game's top-up asks the receipt's e-mail when none
// is known. All of it on the fake API: no key, no real payment.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS } from '../shared/src/data/goods.ts';
import type { GoodId } from '../shared/src/data/goods.ts';
import { QUESTS } from '../shared/src/data/quests.ts';
import { bindingLimit, roomPlan } from '../shared/src/data/buyfail.ts';
import { voyageFood } from '../shared/src/data/voyage.ts';
import type { ClientMsg, ServerMsg } from '../shared/src/protocol.ts';
import type { PremiumView } from '../shared/src/premiumproto.ts';
import { holdFree, keptCargo } from '../server/src/game/buyfail.ts';
import { startQuest } from '../server/src/game/quests.ts';
import { buildPortView } from '../server/src/game/ports.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { WebShop } from '../server/src/game/webshop.ts';
import { YooKassa } from '../server/src/pay/yookassa.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { EN as BA_EN, RU as BA_RU } from '../client/src/lang/ui/buyadvice.ts';
import { EN as PM_EN, RU as PM_RU } from '../client/src/lang/ui/premium.ts';
import { SERVER_RU_BUYFAIL } from '../client/src/lang/server.ru.buyfail.ts';
import { mailState, sendCheckout, webCheckouts } from '../client/src/checkout.ts';
import { adviceFor } from '../client/src/ui/buyadvice.ts';
import { pointerTargets } from '../client/src/ui/pointer.ts';
import type { Net } from '../client/src/net.ts';
import { join, makeGame } from './helpers.ts';
import * as ownstock from '../server/src/game/ownstock.ts';

type G = ReturnType<typeof makeGame>['game'];

function captain(game: G, name: string) {
  const c = join(game, name);
  const s = [...game.sessions].find((x) => x.name === name)!;
  const port = game.portById(s.ship!.docked!)!;
  return { c, s, ship: s.ship!, p: s.profile!, port };
}

/** Her hold filled to the last cubic metre with a good of the trade this harbour buys (rum aside). */
function fillHold(game: G, s: PlayerSession, portId: string, but: GoodId = 'rum'): GoodId {
  const not = new Set<GoodId>(['rum', but]);
  const ship = s.ship!;
  const m = game.markets.get(portId)!;
  const g = (Object.keys(m.goods) as GoodId[]).find((x) => !not.has(x) && GOODS[x].category !== 'supply' && !GOODS[x].contraband && GOODS[x].volume === 1)!;
  ship.cargo = { provisions: ship.cargo.provisions ?? 0 };
  ship.cargo[g] = Math.floor(holdFree(ship) / GOODS[g].volume);
  assert.ok(holdFree(ship) < 1, 'the hold full');
  return g;
}

const nb = (x: string) => x.replace(/ /g, ' ');
const ru = <T>(fn: () => T): T => {
  setLang('ru');
  applyDataLocale('ru');
  try {
    return fn();
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
};

test('the binding limit: the smallest of room, stock and purse, a tie to the room; none in stock is «stock»', () => {
  assert.equal(bindingLimit(5, 0, 3, 99), 'room', 'the owner’s rum: a full hold and three in stock is «no room»');
  assert.equal(bindingLimit(5, 10, 3, 99), 'stock');
  assert.equal(bindingLimit(5, 10, 9, 2), 'silver');
  assert.equal(bindingLimit(5, 0, 0, 99), 'stock', 'none here at all: making room would not get her one');
  assert.equal(bindingLimit(5, 5, 5, 5), null);
});

test('the owner’s case: a full hold buying rum is told «нет места» with its m³ — not «недостаточно на складе»', () => {
  const { game } = makeGame();
  const { c, s, port } = captain(game, 'Rum Runner');
  const rum = game.markets.get(port.id)!.goods.rum;
  assert.ok(rum, 'rum sold here');
  fillHold(game, s, port.id);
  s.profile!.gold = 1e6;
  c.push({ t: 'trade', good: 'rum', qty: 5 });
  const f = c.last('buyfail')!;
  assert.equal(f.fail.why, 'room');
  assert.equal(f.fail.need, 5);
  assert.equal(f.fail.free, 0);
  assert.equal(f.msg, 'No room in the hold: 5 m³ needed, 0 free');
  assert.ok(c.all('toast').some((t) => t.msg === f.msg), 'the toast says the same');
  assert.ok(!c.all('toast').some((t) => /stock/i.test(t.msg)), 'never «stock»');
  assert.equal(nb(ru(() => serverText(f.msg))), 'Нет места в трюме: нужно 5 м³, свободно 0');
  assert.ok(adviceFor(f.fail), 'the advisor opens for it');
  assert.equal(f.fail.buy, undefined, 'her own stock is never under 100 (ownstock.ts): room is made for all five');
  assert.ok(f.fail.plan!.length > 0 && (f.fail.planFree ?? 0) >= 5, 'what to sell here for the room');
  // «Продать и купить» for the five: sold and bought, at once
  c.push({ t: 'sellbuy', good: 'rum', qty: 5 });
  assert.equal(s.ship!.cargo.rum, 5);
});

test('each reason its own words: stock (how many there are), silver (how much is missing), not sold here (the nearest ports)', () => {
  const { game } = makeGame();
  const { c, s, ship, port } = captain(game, 'Honest Hal');
  ship.cargo = {};
  // her own stock of rum (ownstock.ts): never under 100; more asked than she has is «stock», with how many there are
  const { ownStockOf } = ownstock;
  const have = ownStockOf(game, s.profile!, port, 'rum');
  assert.ok(have >= 100 && have < 495, `her rum here: ${have}`);
  ship.stats.holdVolume = 5000; // (room for all of them: the stock binds)
  s.profile!.gold = 1e6;
  c.push({ t: 'trade', good: 'rum', qty: have + 5 });
  let f = c.last('buyfail')!;
  assert.equal(f.fail.why, 'stock');
  assert.equal(f.fail.can, have, 'buy those there are');
  assert.match(f.msg, new RegExp(`has only ${have} rum, ${have + 5} asked$`));
  assert.match(nb(ru(() => serverText(f.msg))), new RegExp(`осталось только ${have}, а нужно ${have + 5}$`));
  // the purse: what is missing
  s.profile!.gold = 10;
  c.push({ t: 'trade', good: 'rum', qty: 5 });
  f = c.last('buyfail')!;
  assert.equal(f.fail.why, 'silver');
  assert.ok((f.fail.missing ?? 0) > 0);
  assert.equal(f.msg, `Not enough silver: ${f.fail.missing} more needed`);
  assert.equal(nb(ru(() => serverText(f.msg))), `Не хватает серебра: нужно ещё ${f.fail.missing}`);
  // not sold here: the nearest harbours that sell it, nearest first
  s.profile!.gold = 1e6;
  delete game.markets.get(port.id)!.goods.rum;
  c.push({ t: 'trade', good: 'rum', qty: 5 });
  f = c.last('buyfail')!;
  assert.equal(f.fail.why, 'notsold');
  const sellers = f.fail.sellers!;
  assert.ok(sellers.length >= 1 && sellers.length <= 3, 'up to three ports');
  for (let i = 1; i < sellers.length; i++) assert.ok(sellers[i - 1].dist <= sellers[i].dist, 'nearest first');
  for (const x of sellers) assert.ok(ownstock.ownStockOf(game, s.profile!, game.portById(x.port)!, 'rum') >= 100 && x.stock >= 100 && x.port !== port.id);
  assert.match(f.msg, new RegExp(`does not sell rum: sold at ${sellers[0].name}`));
  assert.ok(!/[A-Za-z]{3,} [A-Za-z]{3,} [A-Za-z]{3,}/.test(ru(() => serverText(f.msg))), `in Russian: ${ru(() => serverText(f.msg))}`);
  assert.ok(adviceFor(f.fail), 'the advisor: where it is sold, a course there');
  // the course: a harbour by name is a goal of its own
  c.push({ t: 'goto', key: `p:${sellers[0].port}` } as never);
  assert.ok(c.all('toast').length > 0);
});

test('«Продать и купить»: sells only what is needed — never quest cargo, never the voyage’s minimum — and buys, at once', () => {
  const { game } = makeGame();
  const { c, s, ship, p, port } = captain(game, 'Sell First');
  p.gold = 1e6;
  // quest cargo aboard: a delivery under way of a good this harbour buys (a contract's: kept as a quest's is)
  const good = (Object.keys(game.markets.get(port.id)!.goods) as GoodId[]).find((g) => g !== 'rum' && GOODS[g].category !== 'supply' && !GOODS[g].contraband && GOODS[g].volume === 1)!;
  p.contracts.push({ id: 'k1', kind: 'delivery', title: 'Cargo', fromPort: port.id, toPort: game.world.ports.find((x) => x.id !== port.id)!.id, good, qty: 6, reward: 1, xp: 1, expiresAt: game.now + 9999, description: '' });
  const st = { good, qty: 6 };
  const food = voyageFood({ crew: ship.crew, provisionUse: ship.stats.provisionUse, holdVolume: ship.stats.holdVolume, provisionVolume: GOODS.provisions.volume * ship.stats.provisionVolumeMul });
  ship.cargo = { provisions: food, [st.good]: st.qty };
  const filler = fillHold(game, s, port.id, st.good);
  ship.cargo.provisions = food;
  ship.cargo[st.good] = st.qty;
  ship.cargo[filler] = Math.floor(holdFree(ship) / GOODS[filler].volume) + (ship.cargo[filler] ?? 0);
  assert.ok(holdFree(ship) < 1);
  const keep = keptCargo(s);
  assert.ok((keep[st.good] ?? 0) >= st.qty, 'the quest’s goods kept');
  assert.ok((keep.provisions ?? 0) >= food, 'the voyage’s food kept');
  const before = { ...ship.cargo };
  c.push({ t: 'trade', good: 'rum', qty: 4 });
  const f = c.last('buyfail')!;
  assert.equal(f.fail.why, 'room');
  for (const l of f.fail.plan!) assert.ok(l.good !== st.good && l.good !== 'provisions' && l.good !== 'rum', `never ${l.good}`);
  c.push({ t: 'sellbuy', good: 'rum', qty: 4 });
  assert.equal(ship.cargo.rum, 4, 'bought');
  assert.equal(ship.cargo[st.good], before[st.good], 'the quest’s cargo untouched');
  assert.equal(ship.cargo.provisions, before.provisions, 'the voyage’s provisions untouched');
  assert.equal((before[filler] ?? 0) - (ship.cargo[filler] ?? 0), Math.ceil((4 - Math.max(0, f.fail.free ?? 0)) / GOODS[filler].volume), 'only as many sold as the room wants');
  // nothing to sell but what is kept: nothing moves at all
  const { c: c2, s: s2, ship: ship2, p: p2, port: port2 } = captain(game, 'Kept Kate');
  p2.gold = 1e6;
  const g2 = fillHold(game, s2, port2.id);
  p2.stolen = { [g2]: ship2.cargo[g2]! }; // plunder: never put on the counter by the advisor
  const was = { gold: p2.gold, cargo: JSON.stringify(ship2.cargo) };
  c2.push({ t: 'sellbuy', good: 'rum', qty: 4 });
  assert.equal(p2.gold, was.gold, 'no silver moved');
  assert.equal(JSON.stringify(ship2.cargo), was.cargo, 'no cargo moved');
  assert.ok(c2.all('toast').some((t) => /^Not enough to sell here to make room/.test(t.msg)));
});

test('roomPlan: the goods this port pays well for first, then the cheapest for their room; the last line only as many as needed', () => {
  const plan = roomPlan([
    { good: 'rum', have: 10, keep: 0, unitVol: 1, sell: 20 }, // under its base (30)
    { good: 'sugar', have: 10, keep: 0, unitVol: 1, sell: 30 }, // over its base (24): a good price
    { good: 'timber', have: 10, keep: 0, unitVol: 2, sell: 10 }, // cheap for its room
    { good: 'tobacco', have: 10, keep: 10, unitVol: 1, sell: 90 }, // kept
  ], 13);
  assert.deepEqual(plan.lines.map((l) => [l.good, l.qty]), [['sugar', 10], ['timber', 2]]);
  assert.equal(plan.freed, 14);
});

test('the quest’s buy step with a full hold: the market’s card and the guide’s finger point at the advisor, not a dead button', () => {
  const { game } = makeGame();
  const { s, p, port } = captain(game, 'Card Carl');
  const q = QUESTS.find((x) => x.steps.some((st) => st.type === 'deliver' && st.good === 'rum')) ?? QUESTS.find((x) => x.steps.some((st) => st.type === 'deliver'))!;
  startQuest(game, p, q, s);
  const qs = p.quests.active.find((a) => a.id === q.id)!;
  qs.step = q.steps.findIndex((st) => st.type === 'deliver');
  const good = (q.steps[qs.step] as { good: GoodId }).good;
  fillHold(game, s, port.id, good);
  const v = buildPortView(game, s, port);
  const card = v.questBuys!.find((x: { good: string }) => x.good === good)!;
  assert.ok(card, 'the market’s card for the quest’s good');
  assert.equal(card.fit, 0, 'no room: the card’s button is «Освободить место»');
  if (!card.soldHere || card.stock < card.qty) assert.ok(card.sellers.length > 0, 'not here: where it is sold');
  // the opening's finger: the advisor's «Продать и купить» first
  const t = pointerTargets({ stage: 'c:buy:provisions', touch: true, docked: true, battle: false });
  assert.equal(t[0], '#buy-advice #ba-go');
});

test('the web game’s top-up without an e-mail: asked inline, passed to the order, kept only when ticked', async () => {
  const settle = async () => {
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  };
  const bodies: string[] = [];
  let n = 0;
  const http = async (_url: string, init?: { method?: string; body?: string }) => {
    bodies.push(init?.body ?? '');
    const id = `2e6c1a2b-000f-5000-9000-${String(++n).padStart(12, '0')}`;
    return { ok: true, status: 200, json: async () => ({ id, confirmation: { confirmation_url: `https://yoomoney.ru/checkout?id=${id}` } }), text: async () => '' };
  };
  const yoo = new YooKassa({ shopId: '1', secret: 'fake', receipt: true, vatCode: 1, checkIp: false }, http, () => {});
  const { game } = makeGame();
  const shop = new WebShop(game, { provider: yoo, returnUrl: 'https://gravetidegame.com/site/shop/', log: () => {}, pumpMs: 0 });
  const { c, s } = captain(game, 'Mailless Mae');
  assert.equal(shop.knownEmail(s.accountId), null, 'a guest’s account: no e-mail');
  c.push({ t: 'premium', action: 'view' });
  assert.equal(c.last('premium')!.view.webEmail, true, 'the shop’s view: the checkout must ask it');
  // ordered without it: no dead end — «needEmail», not the old toast
  c.push({ t: 'premium', action: 'checkout', pack: 'd290', lang: 'ru' });
  await settle();
  assert.equal(c.last('premium_checkout')!.needEmail, true);
  assert.ok(!c.all('toast').some((t) => /receipt needs your e-mail/.test(t.msg)));
  assert.equal(bodies.length, 0, 'nothing asked of YooKassa');
  // a bad one: said, asked again
  c.push({ t: 'premium', action: 'checkout', pack: 'd290', lang: 'ru', email: 'not-a-mail' });
  await settle();
  assert.equal(c.last('premium_checkout')!.needEmail, true);
  assert.ok(c.all('toast').some((t) => t.msg === 'That does not look like an e-mail address.'));
  // typed, not kept: the order made with it, nothing stored
  c.push({ t: 'premium', action: 'checkout', pack: 'd290', lang: 'ru', email: 'Mae@Example.com' });
  await settle();
  const m = c.last('premium_checkout')!;
  assert.match(m.url!, /^https:\/\/yoomoney\.ru\//);
  assert.match(bodies[0], /"email":"mae@example\.com"/, 'the receipt’s e-mail passed to the order');
  assert.equal(shop.knownEmail(s.accountId), null, 'not kept: no box ticked');
  // ticked: kept for the next time, as a receipt's e-mail only
  c.push({ t: 'premium', action: 'checkout', pack: 'd290', lang: 'ru', email: 'mae@example.com', save: true });
  await settle();
  assert.equal(shop.knownEmail(s.accountId), 'mae@example.com');
  assert.ok(!game.db.accountById(s.accountId)!.email, 'her login’s e-mail untouched');
  c.push({ t: 'premium', action: 'view' });
  assert.equal(c.last('premium')!.view.webEmail, undefined, 'known now: not asked again');
  c.push({ t: 'premium', action: 'checkout', pack: 'd290', lang: 'ru' });
  await settle();
  assert.match(c.last('premium_checkout')!.url!, /^https:\/\/yoomoney\.ru\//, 'the next one straight to the payment');
  // the site's shop asks it as before (`email: true` in its status; an order without it refused)
  assert.equal(shop.status().email, true);
  assert.deepEqual(await shop.order({ name: 'Mailless Mae', item: 'd290', lang: 'ru' }), { error: 'email' });
  // the client: told the e-mail is needed, «Оплатить» asks it first (nothing sent until she types it)
  const handlers: ((m: ServerMsg) => void)[] = [];
  const net = { on: (fn: (m: ServerMsg) => void) => void handlers.push(fn), send: () => {} } as unknown as Net;
  webCheckouts(net, () => {});
  for (const h of handlers) h({ t: 'premium', view: { web: true, webEmail: true } as unknown as PremiumView } as ServerMsg);
  const sent: ClientMsg[] = [];
  sendCheckout((x) => sent.push(x), 'd290');
  assert.equal(sent.length, 0, 'the e-mail asked before the payment opens');
  assert.equal(mailState().needed, true);
  for (const h of handlers) h({ t: 'premium', view: { web: true } as unknown as PremiumView } as ServerMsg);
  sendCheckout((x) => sent.push(x), 'd290');
  assert.equal(sent.length, 1, 'known: straight to the order');
});

test('RU and EN complete: the advisor’s words, the e-mail prompt, the server’s new refusals', () => {
  for (const k of Object.keys(BA_EN) as (keyof typeof BA_EN)[]) {
    assert.ok(BA_RU[k], `ru ${k}`);
    assert.ok(!/[A-Za-z]{2,}/.test(BA_RU[k].replace(/\{\w+\}/g, '')), `ru in Russian: ${k}`);
  }
  for (const k of Object.keys(PM_EN).filter((x) => x.startsWith('yk.mail')) as (keyof typeof PM_EN)[]) {
    assert.ok(PM_RU[k] && !/[A-Za-z]{3,}/.test(PM_RU[k]), `ru ${k}`);
  }
  for (const [en, r] of Object.entries(SERVER_RU_BUYFAIL)) assert.ok(!/[A-Za-z]{2,}/.test(r.replace(/\{\d\}/g, '')), `ru: ${en}`);
  ru(() => {
    for (const m of ['Needs 500 silver: 120 more needed', 'No hammocks left aboard: 28 of 28 taken', 'Not enough doubloons: 40 more needed — top up your account first.', 'No free slot in the army for a new kind of man: 7 of 7 taken — merge or dismiss a stack']) {
      assert.ok(!/[A-Za-z]{3,}/.test(serverText(m)), `${m} → ${serverText(m)}`);
    }
  });
});
