// The premium shop's goods (owner, 2026-10-15; shared/src/data/shop.ts, server/src/game/shop.ts, docs/32): the
// catalogue's sanity, a purchase checked by the server (its price from the table, the balance, the purchase id bought
// once, the limits, never below nought, the pace of buys), the goods through the game's own systems — a brigade more
// and two buildings rising at once, the speed-ups and «завершить сейчас» on the timers, resources into the yard,
// creatures by packs, the auto-battle scrolls — the subscription's day, the first top-up's gift, the charms only against
// the sea, the island's charter of protection, the charter of removal; every word in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { BASE_RES, crewsAt } from '../shared/src/data/base.ts';
import { UNITS } from '../shared/src/data/army.ts';
import type { UnitId } from '../shared/src/data/army.ts';
import {
  DEAL_OFF, DEAL_POOL, OFFERS, PRICE_MAX, PRICE_MIN, RECRUIT_KINDS, SHOP, SHOP_TABS, SUB_DAILY, TAB_SECS, dayOf, dealOf, finishPrice, offerBonus, unitPacks,
} from '../shared/src/data/shop.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { baseView, crewsOf, startBuild, yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { raidChance, claimFee } from '../server/src/game/baseclaim.ts';
import { creditPremium, premiumView } from '../server/src/game/premium.ts';
import * as premiumMod from '../server/src/game/premium.ts';
import { buyOffer, charmSide, finishNow, forgetShop, noteFallen, shopState, stepShop, useSpeed } from '../server/src/game/shop.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import type { Database } from '../server/src/persistence/db.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { EN as P_EN, RU as P_RU } from '../client/src/lang/ui/premium.ts';
import { setLang } from '../client/src/i18n.ts';
import { join, makeGame, onHull } from './helpers.ts';
import { SHIP_CLASSES, SHIP_CLASS_IDS } from '../shared/src/data/ships.ts';
import { AUTO_SCROLL_PACKS, DOUBLOON_PACKS, STARS_PER_DOUBLOON } from '../shared/src/data/premium.ts';

const DAY = 86_400_000;
let clock = 20_000 * DAY + 3_600_000;
let n = 0;
const pid = () => `test${++n}abc`;

function world(): { game: Game; db: Database } {
  const w = makeGame();
  clock = 20_000 * DAY + 3_600_000;
  w.game.wallNow = () => clock;
  clearOutposts(w.game);
  return w;
}

function offShore(game: Game, ship: ShipEntity, is: Island): void {
  ship.docked = null;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const x = is.x + Math.sin(a) * (is.radius + 120), y = is.y - Math.cos(a) * (is.radius + 120);
    if (isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.state.speed = 0;
  ship.region = is.region;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

/** A captain with doubloons, and (`isle`) an island of her own at its first level with a full yard. */
function captain(game: Game, name: string, dbl = 0, isle = false): PlayerSession {
  join(game, name, 'admiral');
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 5_000_000;
  s.profile!.level = 30;
  if (dbl) assert.ok(creditPremium(game, s.accountId, dbl, 'admin', 'test') !== null);
  if (isle) {
    const home = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id))!;
    offShore(game, s.ship!, home);
    assert.equal(buyIsland(game, s, home.id), null);
    const y = yardOf(game, ownIsland(game, s.accountId)!);
    for (const g of BASE_RES) y.res[g] = 10_000;
  }
  return s;
}

function buys(db: Database, account: number): { amount: number; detail: string }[] {
  const raw = (db as unknown as { db: DatabaseSync }).db.prepare(`SELECT amount, detail FROM ledger WHERE account_id = ? AND kind = 'doubloons_buy' ORDER BY id`).all(account) as { amount: number; detail: string }[];
  return raw.map((r) => ({ amount: Number(r.amount), detail: String(r.detail) }));
}

// ------------------------------------------------------------------------------------------------ the catalogue

test('the catalogue: unique ids, real prices, the packs better the larger, every tab its shelves, both languages', () => {
  const ids = SHOP.flatMap((f) => f.offers.map((o) => o.id));
  assert.equal(new Set(ids).size, ids.length, 'unique offer ids');
  assert.equal(new Set(SHOP.map((f) => f.id)).size, SHOP.length, 'unique families');
  for (const f of SHOP) {
    assert.ok(f.tabs.length && f.tabs.every((t) => SHOP_TABS.includes(t)), f.id);
    assert.ok(f.sec === 'deals' || TAB_SECS[f.tabs[0]].includes(f.sec), `${f.id}: its shelf is on its first tab`);
    assert.ok(/[а-яё]/i.test(f.name[1]) && /[а-яё]/i.test(f.text[1]), f.id);
    assert.ok(!/[A-Za-z]{2,}/.test(f.name[1] + f.text[1]), `${f.id}: no Latin in the Russian`);
    for (const o of f.offers) assert.ok(o.price > 0 || o.id === 'refill', o.id);
    // the larger the pack, the better (the bonus never falls), the first at none
    if (f.sec !== 'deals' && f.id !== 'bperm' && f.id !== 'art') {
      const b = f.offers.map((o) => offerBonus(f, o));
      assert.equal(b[0], 0, f.id);
      for (let i = 1; i < b.length; i++) assert.ok(b[i] >= b[i - 1] && b[i] > 0, `${f.id}: ${b}`);
    }
  }
  // the island's own: brigades hired and for good, speed-ups of 5 min to 24 h, the five goods and the crate
  for (const id of ['btemp_290', 'btemp_590', 'btemp_990', 'btemp_1990', 'bperm_1', 'bperm_2', 'sp_290', 'sp_590', 'sp_990', 'sp_1990', 'sp_4990', 'timber_1990', 'iron_290', 'mix_4990', 'prod_290', 'shield_990', 'move_2490']) assert.ok(OFFERS.has(id), id);
  // the bundles: once ever, once a week; the subscription
  assert.deepEqual(OFFERS.get('starter')!.offer.limit, { n: 1, per: 'ever' });
  assert.deepEqual(OFFERS.get('weekly')!.offer.limit, { n: 1, per: 'week' });
  assert.ok(offerBonus(OFFERS.get('starter')!.fam, OFFERS.get('starter')!.offer) >= 300, 'the starter is strong value');
  for (const id of DEAL_POOL) assert.ok(OFFERS.has(id), id);
  assert.ok(dealOf(20_001).price < dealOf(20_001).offer.price);
  assert.equal(finishPrice(3600), 290, 'never under the least price');
  assert.equal(finishPrice(10 * 3600), 360);
  assert.deepEqual(unitPacks(100), [{ k: 3, price: 300 }, { k: 9, price: 828 }, { k: 15, price: 1275 }]);
});

test('every price from 290 to 9 900 (owner, 2026-10-15): the shelves, the deal after its discount, the creatures\' packs, the hulls, the top-up in roubles', () => {
  const inRange = (n: number, what: string) => assert.ok(n >= PRICE_MIN && n <= PRICE_MAX, `${what}: ${n}`);
  for (const f of SHOP) for (const o of f.offers) if (o.id !== 'refill') inRange(o.price, o.id);
  for (const id of DEAL_POOL) inRange(Math.round(OFFERS.get(id)!.offer.price * (1 - DEAL_OFF)), `deal ${id}`);
  for (let d = 20_000; d < 20_060; d++) inRange(dealOf(d).price, `deal of day ${d}`);
  for (const u of Object.keys(UNITS) as UnitId[]) if (UNITS[u].premium) for (const p of unitPacks(UNITS[u].premium!.price)) inRange(p.price, `${u} ×${p.k}`);
  for (const c of SHIP_CLASS_IDS) if (SHIP_CLASSES[c].premium) inRange(SHIP_CLASSES[c].premium!.price, c);
  for (const p of AUTO_SCROLL_PACKS) inRange(p.price, p.id);
  // the top-up: its roubles (a doubloon of the pack's own a rouble) in the range, at the rate of ¾ of a star a doubloon
  assert.deepEqual(DOUBLOON_PACKS.map((p) => p.n), [290, 590, 990, 1990, 4990, 9900]);
  for (const p of DOUBLOON_PACKS) {
    inRange(p.n, p.id);
    assert.equal(p.stars, Math.round(p.n * STARS_PER_DOUBLOON), p.id);
  }
  for (let i = 1; i < DOUBLOON_PACKS.length; i++) assert.ok(DOUBLOON_PACKS[i].bonus / DOUBLOON_PACKS[i].n > DOUBLOON_PACKS[i - 1].bonus / DOUBLOON_PACKS[i - 1].n);
  assert.equal(finishPrice(1), PRICE_MIN);
  assert.equal(finishPrice(1e9), PRICE_MAX);
});

// ------------------------------------------------------------------------------------------------ buying

test('a purchase: the server\'s price, the balance never below nought, nothing charged on a refusal, the same purchase id once', () => {
  const { game, db } = world();
  const s = captain(game, 'Buyer', 290);
  // unknown offers, bad purchase ids: refused, nothing moves
  assert.equal(buyOffer(game, s, 'nope', pid()), 'Not for sale');
  assert.equal(buyOffer(game, s, '__proto__', pid()), 'Not for sale');
  assert.equal(buyOffer(game, s, 'as_290', 'x'), 'Not for sale');
  assert.equal(db.doubloons(s.accountId), 290);
  // too poor: refused, nothing charged
  assert.match(buyOffer(game, s, 'as_590', pid())!, /Not enough doubloons/);
  assert.equal(db.doubloons(s.accountId), 290);
  // bought: the price from the table, the scrolls through the account's own count
  const id = pid();
  assert.equal(buyOffer(game, s, 'as_290', id), null);
  assert.equal(db.doubloons(s.accountId), 0);
  assert.equal(db.scrolls(s.accountId), 15);
  // the same purchase id again (a message sent twice): nothing more
  assert.equal(buyOffer(game, s, 'as_290', id), null);
  assert.equal(db.scrolls(s.accountId), 15);
  assert.deepEqual(buys(db, s.accountId), [{ amount: -290, detail: `shop:as_290:${id}` }]);
  // never below nought
  assert.match(buyOffer(game, s, 'as_290', pid())!, /Not enough doubloons/);
  assert.equal(db.doubloons(s.accountId), 0);
});

test('the pace of buys: a burst of messages is cut short by the flood guard of the shop', () => {
  const { game, db } = world();
  const conn = join(game, 'Hasty');
  const s = game.sessionByName('Hasty')!;
  creditPremium(game, s.accountId, 5000, 'admin', 'test');
  for (let i = 0; i < 12; i++) conn.push({ t: 'premium', action: 'shop', offer: 'as_290', pid: pid() });
  assert.equal(db.scrolls(s.accountId), 5 * 15, 'five in a burst');
  assert.ok(conn.all('toast').some((t) => t.msg === 'Slowly: one purchase at a time.'));
  assert.equal(db.doubloons(s.accountId), 5000 - 5 * 290);
});

test('the limits: the starter once ever, the week\'s chest once a week, a pardon once a day', () => {
  const { game, db } = world();
  const s = captain(game, 'Limited', 5000);
  assert.equal(buyOffer(game, s, 'starter', pid()), null);
  // the starter's goods: a hired brigade, speed-ups, scrolls, charms, the elixir, kits
  const st = shopState(game, s.accountId);
  assert.deepEqual([st.temp.length, st.speed, st.charms, st.kits, st.xp, db.scrolls(s.accountId)], [1, 480, 15, 5, clock + 24 * 3_600_000, 15]);
  assert.match(buyOffer(game, s, 'starter', pid())!, /as often as it may be/);
  clock += 30 * DAY;
  assert.match(buyOffer(game, s, 'starter', pid())!, /as often as it may be/, 'ever is ever');
  assert.equal(buyOffer(game, s, 'weekly', pid()), null);
  assert.match(buyOffer(game, s, 'weekly', pid())!, /as often/);
  clock += 7 * DAY;
  assert.equal(buyOffer(game, s, 'weekly', pid()), null, 'a new week');
  s.profile!.infamy = 200;
  assert.equal(buyOffer(game, s, 'pardon', pid()), null);
  assert.equal(s.profile!.infamy, 10);
  s.profile!.infamy = 200;
  assert.match(buyOffer(game, s, 'pardon', pid())!, /as often/);
  // the view says the same
  const v = premiumView(game, s).shop!;
  assert.equal(v.why.starter, 'limit');
  assert.equal(v.left.starter, 0);
});

test('an extra brigade: the builders rise by one and two buildings go up at once; for good — two at most, the first before the second', () => {
  const { game } = world();
  const s = captain(game, 'Builder', 10_000, true);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  const base = crewsOf(h, game);
  assert.equal(base, crewsAt(h.level ?? 1));
  // the island's own builders all at work: a further building is refused
  for (let i = 0; i < base; i++) assert.equal(startBuild(game, s, null, 'p:lumber'), null);
  assert.equal(startBuild(game, s, null, 'p:fishery'), 'All your builders are at work.');
  // a hired brigade for three days: one more at once
  assert.equal(buyOffer(game, s, 'btemp_290', pid()), null);
  assert.equal(crewsOf(h, game), base + 1);
  assert.equal(baseView(game, s)!.crews.n, base + 1, 'the island\'s window counts it');
  assert.equal(startBuild(game, s, null, 'p:fishery'), null);
  assert.equal(y.jobs.filter((j) => !j.ship).length, base + 1, 'buildings rising at once');
  // its days out: the brigade goes
  clock += 3 * DAY + 1000;
  assert.equal(crewsOf(h, game), base);
  // for good: the second before the first is refused, two at most
  assert.match(buyOffer(game, s, 'bperm_2', pid())!, /first brigade/);
  assert.equal(buyOffer(game, s, 'bperm_1', pid()), null);
  assert.match(buyOffer(game, s, 'bperm_1', pid())!, /as much of it/);
  assert.equal(buyOffer(game, s, 'bperm_2', pid()), null);
  assert.equal(crewsOf(h, game), base + 2);
  // hired: two at once; a third extends the sooner
  assert.equal(buyOffer(game, s, 'btemp_290', pid()), null);
  assert.equal(buyOffer(game, s, 'btemp_590', pid()), null);
  assert.equal(crewsOf(h, game), base + 4);
  const before = [...shopState(game, s.accountId).temp].sort((a, b) => a - b);
  assert.equal(buyOffer(game, s, 'btemp_290', pid()), null);
  const after = [...shopState(game, s.accountId).temp].sort((a, b) => a - b);
  assert.equal(after.length, 2);
  assert.equal(after[0], before[0] + 3 * DAY, 'the sooner extended');
  assert.equal(crewsOf(h, game), base + 4);
  // the brigades are the account's: they survive a reload of her stores
  forgetShop(game);
  assert.equal(crewsOf(h, game), base + 4);
});

test('speed-ups cut a building\'s timer by the minutes it needs; «finish now» ends it for doubloons; the yard\'s refit too', () => {
  const { game, db } = world();
  const s = captain(game, 'Hasten', 2000, true);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  assert.equal(startBuild(game, s, null, 'p:lumber'), null);
  const j = y.jobs[0];
  j.end = clock + 2 * 3_600_000; // as a long work would be
  const left = j.end - clock;
  assert.equal(useSpeed(game, s, j.id), 'No speed-ups in store: buy them in the shop.');
  // eight hours in store: only what the job needs is spent, the rest kept
  assert.equal(buyOffer(game, s, 'sp_290', pid()), null);
  assert.equal(shopState(game, s.accountId).speed, 480);
  assert.equal(useSpeed(game, s, j.id), null);
  assert.equal(shopState(game, s.accountId).speed, 480 - left / 60_000);
  assert.ok(!y.jobs.some((x) => x.id === j.id), 'done');
  assert.equal(y.producers.length, 1, 'the logging camp stands');
  // «finish now» for doubloons, by the time left
  assert.equal(startBuild(game, s, null, 'p:fishery'), null);
  const k = y.jobs[0];
  const price = finishPrice((k.end - clock) / 1000);
  const bal = db.doubloons(s.accountId);
  const fid = pid();
  assert.equal(finishNow(game, s, k.id, fid), null);
  assert.equal(finishNow(game, s, k.id, fid), null, 'the same purchase id: nothing more');
  assert.equal(db.doubloons(s.accountId), bal - price);
  assert.equal(y.producers.length, 2, 'the fishing crew stands');
  // the yard's refit of her ship
  s.profile!.refit = { port: 'x', to: 6, until: clock + 3 * 3_600_000 };
  assert.equal(useSpeed(game, s, -1), null);
  assert.ok(s.profile!.refit === null || s.profile!.refit.until < clock + 3 * 3_600_000);
  assert.equal(finishNow(game, s, -1, pid()), s.profile!.refit ? null : 'That work is done.');
  assert.equal(s.profile!.refit, null, 'the yard is done');
  assert.equal(s.profile!.loadout.level, 6);
});

test('a resource pack into the yard (past its cap), a creature pack and a recruit pack into the army, a scroll pack', () => {
  const { game, db } = world();
  const s = captain(game, 'Stocker', 20_000, true);
  const y = yardOf(game, ownIsland(game, s.accountId)!);
  const was = y.res.iron ?? 0;
  assert.equal(buyOffer(game, s, 'iron_1990', pid()), null);
  assert.equal(y.res.iron, was + (OFFERS.get('iron_1990')!.offer.grants[0] as { n: number }).n);
  assert.equal(buyOffer(game, s, 'mix_290', pid()), null);
  for (const g of BASE_RES) assert.ok((y.res[g] ?? 0) >= 10_680, g);
  // no island: the yard's goods are refused
  const t = captain(game, 'Landless', 500);
  assert.match(buyOffer(game, t, 'timber_290', pid())!, /own island/);
  // a recruit pack: the tier's line kind into her army, room checked
  const ship = s.ship!;
  ship.setArmy([{ u: 'deckhand', n: 10 }]);
  const room0 = ship.stats.crewMax - ship.crew;
  assert.equal(buyOffer(game, s, 'rec2_290', pid()), null);
  const marines = ship.army.find((x) => x.u === RECRUIT_KINDS[1])!;
  assert.equal(marines.n, Math.min(room0, 190), 'as many as the free hammocks hold, up to the pack');
  // a tier above her ship's level is shut
  onHull(game, ship, 'sloop', 1);
  ship.setArmy([{ u: 'deckhand', n: 10 }]);
  assert.match(buyOffer(game, s, 'rec7_990', pid())!, /level is too low/);
  // the press of hands: the free hammocks filled; none free, refused
  assert.equal(buyOffer(game, s, 'crew_290', pid()), null);
  assert.equal(ship.crew, ship.stats.crewMax);
  assert.equal(buyOffer(game, s, 'crew_290', pid()), 'No room for it: make room first.');
  // a premium creature by three: three stacks' worth, the pack's price
  onHull(game, ship, 'brig', 5);
  ship.setArmy([{ u: 'deckhand', n: 10 }]);
  const kind = (Object.keys(UNITS) as UnitId[]).find((u) => UNITS[u].premium && UNITS[u].tier <= 3)!;
  const o = UNITS[kind].premium!;
  const bal = db.doubloons(s.accountId);
  const pk = unitPacks(o.price)[1];
  assert.equal(premiumMod.buyUnit(game, s, kind, pk.k, 'unitpack1'), null);
  assert.equal(premiumMod.buyUnit(game, s, kind, pk.k, 'unitpack1'), null, 'the same purchase id: once');
  assert.equal(ship.army.find((x) => x.u === kind)!.n, o.n * pk.k);
  assert.equal(db.doubloons(s.accountId), bal - pk.price);
  if (o.price < PRICE_MIN) assert.equal(premiumMod.buyUnit(game, s, kind, 1, 'unitpack2'), 'Not for sale', 'no pack under the least price');
  // a scroll pack
  const sc = db.scrolls(s.accountId);
  assert.equal(buyOffer(game, s, 'as_590', pid()), null);
  assert.equal(db.scrolls(s.accountId), sc + 32);
});


test('the subscription: its day\'s doubloons and scroll once a day she is aboard, a brigade more and battle experience while it runs', () => {
  const { game, db } = world();
  const s = captain(game, 'Subscriber', 990, true);
  const h = ownIsland(game, s.accountId)!;
  const base = crewsOf(h, game);
  assert.equal(buyOffer(game, s, 'sub30', pid()), null);
  assert.equal(db.doubloons(s.accountId), 0);
  stepShop(game, s);
  assert.equal(db.doubloons(s.accountId), SUB_DAILY, 'today\'s gift');
  assert.equal(db.scrolls(s.accountId), 1);
  stepShop(game, s);
  stepShop(game, s);
  assert.equal(db.doubloons(s.accountId), SUB_DAILY, 'once a day');
  assert.equal(crewsOf(h, game), base + 1, 'a brigade while it runs');
  clock += DAY;
  stepShop(game, s);
  assert.equal(db.doubloons(s.accountId), 2 * SUB_DAILY, 'the next day');
  // its thirty days out: nothing more
  clock += 31 * DAY;
  stepShop(game, s);
  assert.equal(db.doubloons(s.accountId), 2 * SUB_DAILY);
  assert.equal(crewsOf(h, game), base);
  // sixty days ahead at most
  creditPremium(game, s.accountId, 2 * 990, 'admin', 'more');
  assert.equal(buyOffer(game, s, 'sub30', pid()), null);
  assert.equal(buyOffer(game, s, 'sub30', pid()), null);
  assert.match(buyOffer(game, s, 'sub30', pid())!, /as much of it/);
  // the elixir and the subscription on battle experience
  const p = s.profile!;
  p.level = 30;
  p.rested = 0;
  const xp0 = p.xp;
  game.grantXp(s, 100, null, true);
  assert.equal(Math.round(p.xp - xp0), 120, '+20% while subscribed');
});

test('the first top-up comes double: its gift claimed in the shop once; a level\'s gift on the shelf for three days', () => {
  const { game, db } = world();
  const s = captain(game, 'First', 0);
  creditPremium(game, s.accountId, 550, 'pay', 'tg:charge-a');
  assert.equal(db.doubloons(s.accountId), 550, 'the payment as it was');
  assert.equal(premiumView(game, s).shop!.gift, 550);
  premiumMod.premiumMessage(game, s, { t: 'premium', action: 'gift' });
  assert.equal(db.doubloons(s.accountId), 1100);
  premiumMod.premiumMessage(game, s, { t: 'premium', action: 'gift' });
  assert.equal(db.doubloons(s.accountId), 1100, 'once');
  creditPremium(game, s.accountId, 1200, 'pay', 'tg:charge-b');
  assert.equal(db.doubloons(s.accountId), 2300, 'the second payment is single');
  // a refund takes the claimed gift back with its payment
  premiumMod.chargebackPremium(game, s.accountId, 550, 'tg:charge-a');
  assert.equal(db.doubloons(s.accountId), 1200);
  // a level's gift: the highest reached only, three days
  const v = premiumView(game, s).shop!;
  assert.deepEqual(v.gifts.map((g) => g.id), ['lv30']);
  assert.equal(v.why.lv20, 'gone');
  clock += 4 * DAY;
  assert.equal(premiumView(game, s).shop!.why.lv30, 'gone');
});

test('charms only against the sea; the infirmary raises the record of the fallen (docs/35); the island\'s charter keeps raiders and robbers off; the charter of removal', () => {
  const { game, db } = world();
  const s = captain(game, 'Charmed', 3000, true);
  assert.equal(buyOffer(game, s, 'charm_290', pid()), null);
  const side = (): TacSideInput => ({ morale: 60, hero: { luck: 0 } } as unknown as TacSideInput);
  const foe = game.spawnNpcShip('pirate', 'brig', 'free', s.ship!.state.x + 300, s.ship!.state.y, 0);
  const a = side();
  charmSide(game, s.ship!, foe, a);
  assert.deepEqual([a.morale, a.hero!.luck], [75, 1]);
  assert.equal(shopState(game, s.accountId).charms, 16);
  const t = captain(game, 'Rival');
  const b = side();
  charmSide(game, s.ship!, t.ship!, b);
  assert.deepEqual([b.morale, b.hero!.luck], [60, 0], 'not against a captain');
  assert.equal(shopState(game, s.accountId).charms, 16);
  // the infirmary (docs/35: her record of the fallen — a captain's fight too, raised only after it)
  s.ship!.setArmy([{ u: 'marine', n: 20 }]);
  assert.equal(premiumView(game, s).shop!.why.refill, 'none', 'nobody fallen: nothing');
  noteFallen(game, s, [{ u: 'marine', n: 10 }], 0.2, false);
  const v = premiumView(game, s).shop!;
  assert.equal(v.fallen?.n, 8);
  assert.equal(v.price.refill, PRICE_MIN, 'eight marines: the least price');
  const bal = db.doubloons(s.accountId);
  assert.equal(buyOffer(game, s, 'refill', pid()), null);
  assert.equal(s.ship!.army.find((x) => x.u === 'marine')!.n, 28);
  assert.equal(db.doubloons(s.accountId), bal - v.price.refill);
  // the island's charter
  const h = ownIsland(game, s.accountId)!;
  assert.equal(buyOffer(game, s, 'shield_290', pid()), null);
  assert.equal(raidChance(game, h, 24), 0);
  assert.equal(buyOffer(game, s, 'shield_590', pid()), null);
  assert.match(buyOffer(game, s, 'shield_590', pid())!, /as much of it/, 'two weeks at most');
  // the charter of removal makes the next move free
  s.profile!.isleClaims = 5;
  assert.ok(claimFee(game, s));
  creditPremium(game, s.accountId, 2490, 'admin', 'move');
  assert.equal(buyOffer(game, s, 'move_2490', pid()), null);
  assert.equal(claimFee(game, s), null);
});

test('the deal of the day: the day\'s offer at its price, once a day', () => {
  const { game, db } = world();
  const s = captain(game, 'Dealer', 5000, true);
  const d = dealOf(dayOf(clock));
  const v = premiumView(game, s).shop!;
  assert.deepEqual([v.deal.id, v.deal.price], [d.offer.id, d.price]);
  const bal = db.doubloons(s.accountId);
  assert.equal(buyOffer(game, s, 'deal', pid()), null);
  assert.equal(db.doubloons(s.accountId), bal - d.price);
  assert.match(buyOffer(game, s, 'deal', pid())!, /as often/);
  clock += DAY;
  assert.equal(premiumView(game, s).shop!.deal.why === 'limit', false, 'a new day, a new deal');
});

test('every word of the shop in both languages: the server\'s lines and the window', () => {
  const table = serverTable();
  const mine = extract('server/src/game').filter((x) => /speed-ups|repair kit|charter|brigade|purchase at a time|as often as it may be|subscription|first top-up|lucky charm|claim one first|tier\.|make room first|hold for it|as may be held|nothing for it to do|offer is gone|Bought for/.test(x));
  assert.ok(mine.length >= 15, `the shop's sentences found (${mine.length})`);
  for (const x of mine) assert.ok(table[x] !== undefined, `untranslated: ${x}`);
  setLang('ru');
  try {
    assert.equal(serverText('Bought for 100 doubloons.'), 'Куплено за 100 дубл.');
  } finally {
    setLang('en');
  }
  assert.deepEqual(Object.keys(P_RU).sort(), Object.keys(P_EN).sort());
  for (const k of Object.keys(P_EN) as (keyof typeof P_EN)[]) assert.ok(/[а-яё]/i.test(P_RU[k]), k);
});
