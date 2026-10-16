// The live ops (owner, 2026-10-16; server/src/game/liveops.ts, server/src/http/ops.ts, docs/34_LIVEOPS.md): the price
// rule of 290–9 900 and an override in the shop; a sale's window; an offer taken off the shelves; a global offer with
// its limit; the personal offers' dials; the audit log; the panel behind its token (404 without it); the funnel's
// events and daily aggregates, the money; the retention's arithmetic; the events' windows and triggers; /ops.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { OFFERS } from '../shared/src/data/shop.ts';
import type { Game } from '../server/src/game/Game.ts';
import {
  FUNNEL, LiveOps, addDays, attachLiveOps, dayStr, eventProblem, globalProblem, opsHoliday, opsPrice, opsSilverMul, opsXpMul, priceProblem, retentionTable,
  ruleProblem, salePrice, setOpsFirers, stepLiveOps, trackEvent, tuneProblem, weekStart,
} from '../server/src/game/liveops.ts';
import { currentHoliday } from '../server/src/game/holidays.ts';
import { creditPremium } from '../server/src/game/premium.ts';
import { buyPromo, forgetPromo, promoFigures, promoView, rotatePromos } from '../server/src/game/promo.ts';
import { buyOffer, shopView } from '../server/src/game/shop.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { OpsPanel } from '../server/src/http/ops.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';

const DAY = 86_400_000;
const H = 3_600_000;
let n = 0;
const pid = () => `liveops${++n}xyz`;

function world(): { game: Game; ops: LiveOps; clock: { t: number } } {
  const { game } = makeGame();
  const clock = { t: 20_400 * DAY + 10 * H };
  game.wallNow = () => clock.t;
  const ops = new LiveOps(':memory:');
  attachLiveOps(game, ops);
  return { game, ops, clock };
}

function captain(game: Game, name: string, dbl = 0): PlayerSession {
  join(game, name, 'admiral');
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.level = 30;
  if (dbl) creditPremium(game, s.accountId, dbl, 'admin', 'test');
  return s;
}

test('prices: 290–9 900 whole doubloons only; an override is the shop\'s price, shown and charged; none — the catalog\'s', () => {
  assert.equal(priceProblem(290), null);
  assert.equal(priceProblem(9900), null);
  assert.match(priceProblem(289)!, /от 290 до 9900/);
  assert.match(priceProblem(9901)!, /от 290 до 9900/);
  assert.match(priceProblem(590.5)!, /целое/);
  assert.match(priceProblem('590')!, /целое/);
  assert.match(ruleProblem('nope', {})!, /Нет товара/);
  assert.match(ruleProblem('as_590', { price: 100 })!, /от 290/);
  assert.equal(ruleProblem('as_590', { price: 790 }), null);

  const { game, ops } = world();
  const s = captain(game, 'Price Taker', 5000);
  const offer = OFFERS.get('as_590')!.offer;
  assert.equal(opsPrice(game, offer), 590, 'no override: the catalog\'s');
  assert.deepEqual(shopView(game, s).price, { refill: 0 }, 'nothing sent for the catalog\'s prices');
  ops.set('price:as_590', { price: 790 }, 'test');
  assert.equal(opsPrice(game, offer), 790);
  assert.equal(shopView(game, s).price.as_590, 790, 'the view carries the panel\'s price');
  assert.equal(buyOffer(game, s, 'as_590', pid()), null);
  assert.equal(game.db.doubloons(s.accountId), 5000 - 790, 'charged the panel\'s price');
  ops.set('price:as_590', null, 'test');
  assert.equal(buyOffer(game, s, 'as_590', pid()), null);
  assert.equal(game.db.doubloons(s.accountId), 5000 - 790 - 590, 'back to the catalog\'s');
});

test('a sale runs in its window only: the share off on the …90 grid, never under 290; a product off the shelves is gone', () => {
  assert.equal(salePrice(990, 20), 790);
  assert.equal(salePrice(290, 50), 290, 'never under 290');
  assert.equal(salePrice(9900, 10), 8890);
  assert.match(ruleProblem('as_990', { sale: { pct: 95, from: 1, to: 2 } })!, /от 1 до 90/);
  assert.match(ruleProblem('as_990', { sale: { pct: 20, from: 5, to: 2 } })!, /раньше/);

  const { game, ops, clock } = world();
  const s = captain(game, 'Sale Hunter', 9000);
  const t0 = clock.t;
  ops.set('price:as_990', { sale: { pct: 20, from: t0 + H, to: t0 + 3 * H } }, 'test');
  const offer = OFFERS.get('as_990')!.offer;
  assert.equal(opsPrice(game, offer), 990, 'not yet');
  assert.equal(shopView(game, s).sale, undefined);
  clock.t = t0 + 2 * H;
  assert.equal(opsPrice(game, offer), 790);
  assert.deepEqual(shopView(game, s).sale?.as_990, { pct: 20, until: t0 + 3 * H, was: 990 });
  assert.equal(buyOffer(game, s, 'as_990', pid()), null);
  assert.equal(game.db.doubloons(s.accountId), 9000 - 790);
  clock.t = t0 + 3 * H;
  assert.equal(opsPrice(game, offer), 990, 'over at its end');

  ops.set('price:as_990', { off: true }, 'test');
  assert.equal(shopView(game, s).why.as_990, 'gone');
  assert.match(buyOffer(game, s, 'as_990', pid())!, /gone/);
  assert.equal(game.db.doubloons(s.accountId), 9000 - 790, 'nothing taken');
});

test('a global offer: its card for every captain in its window, its own price, its limit a player, its figures', () => {
  const { game, ops, clock } = world();
  const a = captain(game, 'Global Ann', 3000);
  const b = captain(game, 'Global Bea', 3000);
  const t0 = clock.t;
  assert.match(globalProblem({ id: 'Bad Id', offer: 'as_990', price: 590, from: t0, to: t0 + H, limit: 1 })!, /Код/);
  assert.match(globalProblem({ id: 'g1', offer: 'as_990', price: 100, from: t0, to: t0 + H, limit: 1 })!, /от 290/);
  assert.match(globalProblem({ id: 'g1', offer: 'as_990', price: 590, from: t0, to: t0 + H, limit: 0 })!, /Лимит/);
  const g = { id: 'autumn', offer: 'as_990', price: 590, from: t0 + H, to: t0 + 5 * H, limit: 1 };
  assert.equal(globalProblem(g), null);
  ops.set('global:autumn', g, 'test');
  const card = (s: PlayerSession) => promoView(game, s).cards.find((c) => c.id === 'gl:autumn');
  assert.equal(card(a), undefined, 'not before its start');
  clock.t = t0 + 2 * H;
  const c = card(a)!;
  assert.equal(c.special, 'global');
  assert.equal(c.price, 590);
  assert.equal(c.was, 990);
  assert.equal(c.off, 40);
  assert.equal(c.until, t0 + 5 * H);
  assert.equal(buyPromo(game, a, 'gl:autumn', pid()), null);
  assert.equal(game.db.doubloons(a.accountId), 3000 - 590);
  assert.equal(card(a), undefined, 'bought up: her limit of one');
  assert.match(buyPromo(game, a, 'gl:autumn', pid())!, /as often/);
  assert.equal(game.db.doubloons(a.accountId), 3000 - 590, 'nothing more taken');
  assert.ok(card(b), 'another captain still has it');
  assert.equal(promoFigures(game)['gl:autumn'].bought, 1);
  assert.deepEqual(ops.globalTotals('autumn'), { buyers: 1, n: 1 });
  clock.t = t0 + 5 * H;
  assert.equal(card(b), undefined, 'gone at its end');
  assert.equal(buyPromo(game, b, 'gl:autumn', pid()), 'This offer is gone.');
});

test('the personal offers\' dials: the panel\'s discount, hours and carousel; checked before they are kept', () => {
  assert.match(tuneProblem({ offMin: 30, offMax: 10, hoursMin: 2, hoursMax: 24, restMin: 20, restMax: 60, carousel: 'day' })!, /Скидка/);
  assert.match(tuneProblem({ offMin: 10, offMax: 30, hoursMin: 0, hoursMax: 24, restMin: 20, restMax: 60, carousel: 'day' })!, /Срок/);
  const { game, ops } = world();
  ops.set('promo', { offMin: 40, offMax: 40, hoursMin: 1, hoursMax: 1, restMin: 5, restMax: 5, carousel: 'off' }, 'test');
  const s = captain(game, 'Dial Turner');
  forgetPromo(game);
  rotatePromos(game, s);
  const v = promoView(game, s);
  const mine = v.cards.filter((c) => !c.special);
  assert.ok(mine.length >= 1);
  for (const c of mine) {
    assert.ok(c.off >= 30 && c.off <= 40, `${c.offer}: ${c.off} % off`);
    assert.equal(c.until - game.wallNow(), H, 'an hour');
  }
  assert.equal(v.carousel, false, 'the carousel off');
});

test('the audit log: who, when, what, before and after — a change once, a removal, nothing for the same value', () => {
  const ops = new LiveOps(':memory:');
  ops.set('price:as_590', { price: 790 }, 'Дмитрий · 1.2.3.4', undefined, 1000);
  ops.set('price:as_590', { price: 790 }, 'Дмитрий · 1.2.3.4', undefined, 2000);
  ops.set('price:as_590', { price: 990 }, 'Анна', undefined, 3000);
  ops.set('price:as_590', null, 'Анна', 'reset', 4000);
  const rows = ops.audit();
  assert.equal(rows.length, 3, 'the same value twice is one change');
  assert.deepEqual(rows.map((r) => [r.action, r.who, r.at]), [['reset', 'Анна', 4000], ['set', 'Анна', 3000], ['set', 'Дмитрий · 1.2.3.4', 1000]]);
  assert.equal(rows[1].before, '{"price":790}');
  assert.equal(rows[1].after, '{"price":990}');
  assert.equal(rows[0].after, null);
  assert.equal(ops.get('price:as_590'), undefined, 'the cache read again on save');
  ops.close();
});

test('the panel: 404 without OPS_TOKEN; without the cookie only the sign-in (every other /ops address 404); the cookie is not the token; a change needs the form\'s check', async () => {
  const { game, ops } = world();
  const panel = new OpsPanel(game, ops);
  let token = '';
  const server = createServer(async (req, res) => {
    if (!(await panel.handle(req, res, token))) res.writeHead(418).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const form = (o: Record<string, string>) => ({ method: 'POST', body: new URLSearchParams(o).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual' as const });
  try {
    assert.equal((await fetch(`${base}/ops/admin`)).status, 404, 'no token in the environment: 404');
    assert.equal((await fetch(`${base}/ops/admin`, form({ token: 'x' }))).status, 404);
    assert.equal((await fetch(`${base}/other`)).status, 418, 'not an /ops address: left to the server');
    token = 'an-ops-token-of-32-characters-xx';
    const login = await (await fetch(`${base}/ops/admin?tab=prices`)).text();
    assert.match(login, /name="token"/);
    assert.doesNotMatch(login, /Сохранить/, 'nothing of the panel without the cookie');
    assert.equal((await fetch(`${base}/ops/admin/act`, form({ a: 'price', id: 'as_590', price: '790' }))).status, 404, 'a change without the cookie: 404');
    assert.equal((await fetch(`${base}/ops/anything`)).status, 404);
    assert.equal((await fetch(`${base}/ops/admin`, form({ token: 'wrong' }))).status, 403);
    const ok = await fetch(`${base}/ops/admin`, form({ token, who: 'Дмитрий' }));
    assert.equal(ok.status, 303);
    const cookies = ok.headers.getSetCookie();
    assert.ok(cookies.every((c) => /HttpOnly/.test(c) && /SameSite=Strict/.test(c) && /Path=\/ops/.test(c)));
    assert.ok(!cookies.join().includes(token), 'the cookie is not the token');
    const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
    const page = await (await fetch(`${base}/ops/admin?tab=prices`, { headers: { cookie } })).text();
    assert.match(page, /Сохранить/);
    const csrf = /name="csrf" value="([0-9a-f]{64})"/.exec(page)![1];
    for (const tab of ['sum', 'offers', 'events', 'funnel', 'audit']) assert.equal((await fetch(`${base}/ops/admin?tab=${tab}`, { headers: { cookie } })).status, 200, tab);
    const post = (o: Record<string, string>) => fetch(`${base}/ops/admin/act`, { ...form(o), headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie } });
    assert.equal((await post({ a: 'price', id: 'as_590', price: '790', sell: 'on' })).status, 403, 'no form check: refused');
    assert.equal(ops.get('price:as_590'), undefined);
    const bad = await post({ csrf, tab: 'prices', a: 'price', id: 'as_590', price: '50', sell: 'on' });
    assert.equal(bad.status, 303);
    assert.match(decodeURIComponent(bad.headers.get('location')!.replace(/\+/g, ' ')), /от 290 до 9900/);
    assert.equal(ops.get('price:as_590'), undefined, 'a refused price is not kept');
    assert.equal((await post({ csrf, tab: 'prices', a: 'price', id: 'as_590', price: '790', sell: 'on' })).status, 303);
    assert.deepEqual(ops.get('price:as_590'), { price: 790 });
    assert.match(ops.audit(1)[0].who, /^Дмитрий · /, 'the audit log names who');
    const from = game.wallNow() + H, to = game.wallNow() + 3 * H;
    await post({ csrf, tab: 'events', a: 'event', kind: 'xp', mul: '2', from: String(from), to: String(to), id: 'xp-weekend' });
    assert.deepEqual(ops.get('event:xp-weekend'), { id: 'xp-weekend', kind: 'xp', from, to, mul: 2 });
    const out = await fetch(`${base}/ops/admin/out`, { method: 'POST', headers: { cookie }, redirect: 'manual' });
    assert.match(out.headers.getSetCookie().join(), /Max-Age=0/);
  } finally {
    server.close();
    ops.close();
  }
});

test('the funnel: registration and captain from the game itself, the days aboard, first times once, purchases with their daily sums and the money', () => {
  const { game, ops, clock } = world();
  const today = dayStr(clock.t);
  const a = captain(game, 'Funnel Ann');
  const b = captain(game, 'Funnel Bea');
  assert.ok(ops.has(a.accountId, 'register') && ops.has(a.accountId, 'captain'), 'registration and captain recorded by the game');
  assert.ok(ops.has(a.accountId, 'fw_skip'), '«I know the sea»');
  stepLiveOps(game);
  assert.equal(ops.daily(1, clock.t)[0].dau, 2, 'both aboard today');
  trackEvent(game, a.accountId, 'topup', { amount: 990, product: 'd990' });
  trackEvent(game, a.accountId, 'topup', { amount: 290, product: 'd290' });
  trackEvent(game, a.accountId, 'refund', { amount: 290, product: 'd290' });
  creditPremium(game, b.accountId, 2000, 'admin', 'test');
  assert.equal(buyOffer(game, b, 'as_590', pid()), null, 'a shop purchase is tracked by the shop itself');
  trackEvent(game, a.accountId, 'Bad Kind!');
  trackEvent(game, -1, 'register');
  const f = ops.funnel(today);
  const at = (k: string) => f.find((x) => x.kind === k)!;
  assert.deepEqual(f.map((x) => x.kind), FUNNEL.map((x) => x.kind));
  assert.equal(at('register').n, 2);
  assert.equal(at('captain').n, 2);
  assert.equal(at('captain').conv, 1);
  assert.equal(at('topup').n, 1, 'first times: the account once');
  assert.equal(at('buy').n, 1);
  const d = ops.daily(1, clock.t)[0];
  assert.deepEqual({ revenue: d.revenue, payments: d.payments, spent: d.spent, buys: d.buys, regs: d.regs }, { revenue: 990, payments: 2, spent: 590, buys: 1, regs: 2 });
  const m = ops.money(7, clock.t);
  assert.deepEqual({ revenue: m.revenue, active: m.active, payers: m.payers, arpu: m.arpu, arppu: m.arppu, share: m.share }, { revenue: 990, active: 2, payers: 1, arpu: 495, arppu: 990, share: 0.5 });
  assert.deepEqual(ops.top('buy', 7, clock.t).map((x) => [x.product, x.n, x.sum]), [['as_590', 1, 590]]);
  assert.equal(ops.count('Bad Kind!'), 0, 'a malformed kind is dropped');
  // the probe: a quest taken, her first fight at sea
  a.profile!.quests.done.push('x');
  b.profile!.stats.sunk = 1;
  clock.t += 6000;
  stepLiveOps(game);
  assert.ok(ops.has(a.accountId, 'quest_taken') && ops.has(a.accountId, 'quest_done'));
  assert.ok(ops.has(b.accountId, 'sea_fight') && !ops.has(a.accountId, 'sea_fight'));
  // the next day aboard: D1
  clock.t += DAY;
  stepLiveOps(game);
  assert.equal(ops.daily(2, clock.t)[0].dau, 2);
  ops.close();
});

test('retention D1/D7/D30: returned on day N exactly, counted only once day N is over, by day or by week', () => {
  const d0 = '2026-09-01';
  const regs = [1, 2, 3, 4].map((acc) => ({ acc, day: d0 })).concat([{ acc: 5, day: '2026-09-03' }]);
  const active = new Set([`${addDays(d0, 1)}|1`, `${addDays(d0, 1)}|2`, `${addDays(d0, 7)}|1`, `${addDays(d0, 2)}|3`, `${addDays('2026-09-03', 1)}|5`]);
  const today = addDays(d0, 10);
  const byDay = retentionTable(regs, active, today, 'day');
  assert.deepEqual(byDay, [
    { cohort: '2026-09-03', size: 1, d1: 1, d7: 0, d30: null },
    { cohort: d0, size: 4, d1: 0.5, d7: 0.25, d30: null },
  ]);
  assert.equal(retentionTable(regs, active, addDays(d0, 1), 'day').find((r) => r.cohort === d0)!.d1, null, 'day 1 not over yet');
  const byWeek = retentionTable(regs, active, today, 'week');
  assert.equal(weekStart(d0), '2026-08-31', 'the week from Monday');
  assert.deepEqual(byWeek, [{ cohort: '2026-08-31', size: 5, d1: 3 / 5, d7: 1 / 5, d30: null }]);
});

test('events: the windows (experience, silver, a holiday) and the triggers fired once at their start; checked before kept', () => {
  assert.match(eventProblem({ id: 'e1', kind: 'nope', from: 1, to: 2 })!, /Нет такого/);
  assert.match(eventProblem({ id: 'e1', kind: 'xp', from: 1, to: 2 })!, /Множитель/);
  assert.match(eventProblem({ id: 'e1', kind: 'zboss', from: 1, to: 2 })!, /море/);
  assert.match(eventProblem({ id: 'e1', kind: 'xp', mul: 2, from: 1, to: 20 * DAY })!, /14 дней/);
  const { game, ops, clock } = world();
  const t0 = clock.t;
  assert.equal(opsXpMul(game), 1);
  assert.equal(opsSilverMul(game), 1);
  ops.set('event:x2', { id: 'x2', kind: 'xp', mul: 2, from: t0 + H, to: t0 + 2 * H }, 'test');
  ops.set('event:s15', { id: 's15', kind: 'silver', mul: 1.5, from: t0, to: t0 + 2 * H }, 'test');
  ops.set('event:league', { id: 'league', kind: 'holiday:league_day', from: t0, to: t0 + 2 * H }, 'test');
  assert.equal(opsXpMul(game), 1, 'not yet');
  assert.equal(opsSilverMul(game), 1.5);
  assert.deepEqual(opsHoliday(game), { id: 'league_day', start: t0, end: t0 + 2 * H });
  assert.equal(currentHoliday(game)?.id, 'league_day', 'the holidays read it');
  clock.t = t0 + H;
  assert.equal(opsXpMul(game), 2);
  const s = captain(game, 'Double Xp');
  const xp0 = s.profile!.xp;
  const lv0 = s.profile!.level;
  game.grantXp(s, 100, null);
  if (s.profile!.level === lv0) assert.equal(s.profile!.xp - xp0, 200, 'experience ×2');
  const fired: string[] = [];
  setOpsFirers({ happening: (_, k) => (fired.push(`h:${k}`), true), invasion: (_, r) => (fired.push(`inv:${r ?? ''}`), true), zboss: (_, r) => (fired.push(`zb:${r}`), true) });
  ops.set('event:fest', { id: 'fest', kind: 'happening:festival', from: t0 + 2 * H, to: t0 + 3 * H }, 'test');
  ops.set('event:boss', { id: 'boss', kind: 'zboss', region: 'gravewater', from: t0, to: t0 + 3 * H }, 'test');
  stepLiveOps(game);
  assert.deepEqual(fired, ['zb:gravewater'], 'the boss now; the festival not yet');
  clock.t = t0 + 2 * H + 10_000;
  stepLiveOps(game);
  clock.t += 10_000;
  stepLiveOps(game);
  assert.deepEqual(fired, ['zb:gravewater', 'h:festival'], 'each once');
  assert.ok(ops.get<{ fired?: number }>('event:fest')!.fired, 'marked fired');
  assert.equal(ops.audit().filter((r) => r.action === 'fire').length, 2, 'the firing in the audit log');
  clock.t = t0 + 3 * H;
  assert.equal(opsXpMul(game), 1, 'over');
  assert.equal(opsHoliday(game), null);
  ops.close();
});

test('/ops in the admin console, its HELP pair and its line in Russian', () => {
  const { game, ops } = world();
  const s = captain(game, 'Ops Admin');
  const old = process.env.GRAVETIDE_ADMIN;
  process.env.GRAVETIDE_ADMIN = '1';
  try {
    const line = runAdmin(game, s, '/ops')!;
    assert.match(line, /^Live ops today: 1 sign-ups, 1 aboard/);
    const ru = serverText(line);
    assert.match(ru, /^Лайв-опс, сегодня: регистраций 1/);
    const help = runAdmin(game, s, '/help')!;
    assert.match(help, /\/ops$/);
    assert.ok(SERVER_RU_ADMIN[help]?.endsWith('/ops'), 'the Russian HELP');
  } finally {
    process.env.GRAVETIDE_ADMIN = old;
    ops.close();
  }
});
