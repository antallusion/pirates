// The ship's stores and the new volume table (owner, 2026-11-02: «всё, что касается провианта и парусины, должно весить
// очень-очень мало, в 20 раз меньше … провиант нельзя будет продавать между портами. И парусину тоже … чем интереснее
// груз, тем больше весит»): the stores take a twentieth of their old room, are bought in every harbour and sold nowhere;
// the hold's rules (the overload, the ferry's 60 %, the neutral flag's 85 %) reckon the trade goods only; the table runs
// with a good's worth.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS, GOOD_IDS, STORE_GOODS, STORE_NO_SALE, TRADE_GOOD_IDS, isStore } from '../shared/src/data/goods.ts';
import type { GoodId } from '../shared/src/data/goods.ts';
import { roomPlan } from '../shared/src/data/buyfail.ts';
import { PLOTS } from '../shared/src/data/questgen.ts';
import { SERVICES } from '../shared/src/data/marque.ts';
import { cargoVolume, tradeVolume } from '../shared/src/sim/shipstats.ts';
import { holdFill, holdTotal, holdView } from '../shared/src/data/overload.ts';
import { bestRoute } from '../server/src/game/economy.ts';
import { generateContracts } from '../server/src/game/ports.ts';
import { makeRun } from '../server/src/game/traderuns.ts';
import { forwardOffers, hasExchange, postOrder, fillOrder } from '../server/src/game/finance.ts';
import { marketAuction, marketBuyOrder, marketFill, marketSell } from '../server/src/game/post.ts';
import { addGood, openStall } from '../server/src/game/bazaar.ts';
import { holdTooFull } from '../server/src/game/colours.ts';
import { SERVER_RU_BUYFAIL } from '../client/src/lang/server.ru.buyfail.ts';
import { join, makeGame } from './helpers.ts';

type G = ReturnType<typeof makeGame>['game'];

function captain(game: G, name: string) {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const port = game.portById(s.ship!.docked!)!;
  s.profile!.gold = 1e7;
  return { c, s, ship: s.ship!, p: s.profile!, port };
}

/** The volumes before the table of 2026-11-02 (every good 1 m³ a unit but these). */
const OLD: Partial<Record<GoodId, number>> = { provisions: 1, sailcloth: 1, planks: 1.5 };

test('the stores: provisions, sailcloth and planks — a twentieth of their old room, and their weight with it', () => {
  assert.deepEqual([...STORE_GOODS].sort(), ['planks', 'provisions', 'sailcloth']);
  for (const g of STORE_GOODS) {
    assert.ok(Math.abs(GOODS[g].volume - OLD[g]! / 20) < 1e-9, `${g}: ${GOODS[g].volume} m³ (was ${OLD[g]})`);
    assert.ok(GOODS[g].weight <= 0.05, `${g} weighs little: ${GOODS[g].weight}`);
    assert.ok(isStore(g));
  }
  assert.ok(!isStore('rum') && !isStore('fish'), 'the catch and the rum are trade goods');
  assert.deepEqual(TRADE_GOOD_IDS.length + STORE_GOODS.length, GOOD_IDS.length);
});

test('the volume table: fractional, from a few hundredths to a few m³, the dearer good the bulkier — but still the better pay for its room', () => {
  for (const g of TRADE_GOOD_IDS) {
    const v = GOODS[g].volume;
    assert.ok(v >= 0.1 && v <= 5, `${g}: ${v} m³`);
  }
  // cheap bulk is light, luxuries are heavy-ish per unit
  assert.ok(GOODS.salt.volume < GOODS.rum.volume && GOODS.rum.volume < GOODS.spices.volume && GOODS.spices.volume < GOODS.pearls.volume && GOODS.pearls.volume < GOODS.ambergris.volume);
  // the rank of the volumes follows the base prices (a tie allowed): never a cheaper good bulkier than a dearer one
  // by more than one rounding step
  for (const a of TRADE_GOOD_IDS) for (const b of TRADE_GOOD_IDS) {
    if (GOODS[a].basePrice < GOODS[b].basePrice) assert.ok(GOODS[a].volume <= GOODS[b].volume + 0.1, `${a} (${GOODS[a].volume}) vs ${b} (${GOODS[b].volume})`);
  }
  // silver a m³: a luxury pays better for its room than bulk — but by a few times, not by hundreds as when all were 1 m³
  const dens = (g: GoodId) => GOODS[g].basePrice / GOODS[g].volume;
  const all = TRADE_GOOD_IDS.map(dens);
  const spread = Math.max(...all) / Math.min(...all);
  assert.ok(spread >= 3 && spread <= 10, `silver a m³ from the cheapest to the dearest: ×${spread.toFixed(1)}`);
  assert.ok(dens('pearls') > dens('rum') * 1.5, 'pearls still pay better for their room than rum');
});

test('the hold\'s rules reckon the trade goods only: the overload, the neutral flag; the room for buying counts all', () => {
  const { game } = makeGame();
  const { ship } = captain(game, 'Store Keeper');
  const st = ship.stats;
  const stores = Math.floor((st.holdVolume * 0.6) / (GOODS.provisions.volume * st.provisionVolumeMul));
  ship.cargo = { provisions: stores };
  assert.equal(tradeVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul), 0);
  assert.ok(cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul) > st.holdVolume * 0.55, 'the room they take is real');
  assert.equal(holdFill(ship.cargo, st), 0);
  assert.ok(holdTotal(ship.cargo, st) > 0.55);
  assert.equal(holdView(ship.loadout.classId, ship.cargo, st).over, 0, 'no overload from stores');
  assert.equal(holdTooFull(ship), false, 'neutral colours: the stores do not count');
  // trade goods past 15 %: the neutral flag is refused
  ship.cargo.rum = Math.ceil((st.holdVolume * 0.2) / GOODS.rum.volume);
  assert.equal(holdTooFull(ship), true);
});

test('the stores are sold nowhere: the market, «Продать и купить», the board, buy orders, the auction, the bazaar, the exchange', () => {
  const { game } = makeGame();
  const { c, s, ship, p, port } = captain(game, 'No Arbitrage');
  for (const g of STORE_GOODS) {
    ship.cargo = { [g]: 50 };
    const gold = p.gold;
    // the market: refused with its words
    c.push({ t: 'trade', good: g, qty: -10 });
    assert.equal(ship.cargo[g], 50, `${g}: the market`);
    assert.ok(c.all('toast').some((t) => t.msg === STORE_NO_SALE), 'its words');
    // the board: a sell listing, a buy order, an auction
    assert.equal(marketSell(game, s, port, g, 10, 100), STORE_NO_SALE);
    assert.equal(marketBuyOrder(game, s, port, g, 10, 100), STORE_NO_SALE);
    assert.equal(marketAuction(game, s, game.portById('tidewrack')!, g, 10, 100, 0, 2), STORE_NO_SALE);
    // the exchange's buy orders
    assert.equal(postOrder(game, s, game.world.ports.find((x) => hasExchange(x))!, g, 10, Math.ceil(GOODS[g].basePrice)), STORE_NO_SALE);
    assert.equal(ship.cargo[g], 50, `${g}: nothing left the hold`);
    assert.equal(p.gold, gold, `${g}: no silver moved`);
  }
  // an old listing and an old order of stores (from before): never filled
  const { s: s2, p: p2 } = captain(game, 'Old Lister');
  const b = game.post.board(game, port.id);
  b.listings.push({ id: b.next++, kind: 'buy', seller: s2.accountId, sellerName: s2.name, good: 'provisions', qty: 10, price: 50, buyout: 0, bidder: null, bidderName: null, endsAt: game.wallNow() + 3_600_000 });
  ship.cargo = { provisions: 50 };
  const gold = p.gold;
  assert.equal(marketFill(game, s, port, b.listings.at(-1)!.id, 10), STORE_NO_SALE);
  game.orders.push({ id: 'bo_old', accountId: s2.accountId, name: s2.name, portId: port.id, good: 'sailcloth', qty: 10, filled: 0, price: 40, escrow: 400, expiresAt: game.now + 9999, pendingGoods: 0, pendingRefund: 0, closed: false });
  ship.cargo.sailcloth = 20;
  assert.equal(fillOrder(game, s, port, 'bo_old', 10), STORE_NO_SALE);
  assert.equal(p.gold, gold);
  assert.equal(ship.cargo.provisions, 50);
  assert.equal(ship.cargo.sailcloth, 20);
  void p2;
  // the bazaar: a stall of her own takes no stores
  const stall = openStall(game, s, port);
  if (stall === null) {
    assert.equal(addGood(game, s, port, 'provisions', 10, 20), STORE_NO_SALE);
    assert.equal(ship.cargo.provisions, 50);
  }
  // the advisor's room plan never sells them
  const plan = roomPlan([{ good: 'provisions', have: 500, keep: 0, unitVol: 0.05, sell: 10 }, { good: 'rum', have: 10, keep: 0, unitVol: 0.4, sell: 30 }], 2);
  assert.ok(plan.lines.every((l) => !isStore(l.good)), 'the plan sells rum, never provisions');
  // the price rows: no sell price for a store
  const v = (c.last('port') as { view?: { market: { good: GoodId; sell: number }[] } } | undefined)?.view;
  if (v) for (const r of v.market) if (isStore(r.good)) assert.equal(r.sell, 0, `${r.good}: no sell price`);
  // the words in Russian
  assert.equal(SERVER_RU_BUYFAIL[STORE_NO_SALE], 'Судовые припасы не продаются — это запас для плавания.');
});

test('no trade contract, trade run, forward, NPC route, marque order or bought-goods quest asks for the stores', () => {
  const { game } = makeGame();
  for (const port of game.world.ports.slice(0, 40)) {
    for (let k = 0; k < 3; k++) for (const ct of generateContracts(game, port)) if (ct.good) assert.ok(!isStore(ct.good), `${port.id}: contract for ${ct.good}`);
    const run = makeRun(game, port, 1);
    if (run) assert.ok(!isStore(run.good), `${port.id}: trade run in ${run.good}`);
    for (const f of forwardOffers(game, port)) assert.ok(!isStore(f.good), `${port.id}: forward in ${f.good}`);
    const r = bestRoute(port, game.markets, game.world.ports, () => 0.5, 999999);
    if (r) assert.ok(!isStore(r.good), `${port.id}: NPC route in ${r.good}`);
  }
  for (const sv of Object.values(SERVICES)) for (const g of sv.wants) assert.ok(!isStore(g), `marque wants ${g}`);
  // the plots whose goods she buys herself (no pickup step) never name a store
  for (const pl of PLOTS) if (pl.goods && !pl.steps.includes('pickup') && !pl.steps.includes('dive')) for (const g of pl.goods) assert.ok(!isStore(g), `${pl.id}: ${g}`);
});

test('an old save heavier than her hold loads whole: nothing thrown away, only flagged over the brim', () => {
  const { game } = makeGame();
  const { ship } = captain(game, 'Old Save');
  const st = ship.stats;
  // a hold that fit the old table (1 m³ each) but not the new: pearls 1.3 m³ each
  ship.cargo = { pearls: Math.floor(st.holdVolume) };
  ship.recompute(game.now);
  game.step();
  assert.equal(ship.cargo.pearls, Math.floor(st.holdVolume), 'every pearl still aboard');
  const v = holdView(ship.loadout.classId, ship.cargo, ship.stats);
  assert.equal(v.over, 2, 'over the brim');
  assert.equal(v.slow, 35);
});
