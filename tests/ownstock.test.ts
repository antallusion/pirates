// Her own stock in every harbour (owner, 2026-10-22: «в гаванях всегда должны продаваться парусины, провизии и доски в
// бесконечном количестве. и для каждого игрока своя цифра в гавани должна быть остального, но не менее 100 единиц на
// складе для каждого игрока»; server/src/game/ownstock.ts, docs/31 §13). The ship's stores without end at the port's
// normal price, flat, and never a round trip that pays; every other good her own stock, never under 100, untouched by
// another captain's trade; prices from her own stock; kept on her profile across a relog; the advisor reads it all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS, INF_STOCK, STOCK_FLOOR, SUPPLY_GOODS, isInfStock, stockText, walkBuyCost } from '../shared/src/data/goods.ts';
import type { GoodId } from '../shared/src/data/goods.ts';
import { ECON_HOUR, marketRows, midPrice, quoteBuy, quoteSell } from '../server/src/game/economy.ts';
import type { PriceMods } from '../server/src/game/economy.ts';
import { OWN_STOCK_MAX, gcOwnStock, ownGood, ownMarket, ownStockOf, ownTrade } from '../server/src/game/ownstock.ts';
import { buildPortView, priceMods } from '../server/src/game/ports.ts';
import { goodBuyCheck, nearestSellers } from '../server/src/game/buyfail.ts';
import { sanitizeProfile } from '../server/src/game/player.ts';
import type { Profile } from '../server/src/game/player.ts';
import { EN as WIN_EN, RU as WIN_RU } from '../client/src/lang/ui/win.ts';
import { join, makeGame } from './helpers.ts';

type G = ReturnType<typeof makeGame>['game'];

function captain(game: G, name: string) {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const port = game.portById(s.ship!.docked!)!;
  s.profile!.gold = 1e7;
  s.ship!.stats.holdVolume = 1e5; // (room for anything: the stock and the price are what is weighed)
  return { c, s, ship: s.ship!, p: s.profile!, port };
}

/** A good of this harbour that is neither a store nor contraband, of a thin port stock (under the floor). */
function thinGood(game: G, portId: string): GoodId {
  const m = game.markets.get(portId)!;
  return (Object.keys(m.goods) as GoodId[]).find((g) => !SUPPLY_GOODS.includes(g) && !GOODS[g].contraband && m.goods[g]!.stock < 60)!;
}

test('the ship’s stores in every harbour: sold without end, at the port’s normal price, flat — never «sold out»', () => {
  const { game } = makeGame();
  const { c, s, ship, p, port } = captain(game, 'Stores Sal');
  for (const pt of game.world.ports) {
    const m = ownMarket(game, p, pt)!;
    for (const g of SUPPLY_GOODS) {
      const gm = m.goods[g];
      assert.ok(gm, `${pt.id} sells ${g}`);
      assert.equal(ownStockOf(game, p, pt, g), INF_STOCK);
      // the port's normal price: its price at the stock it was made with
      const world = game.markets.get(pt.id)!.goods[g]!;
      assert.ok(Math.abs(midPrice(g, gm!) - midPrice(g, { ...world, stock: world.base! })) < 1e-9, `${pt.id} ${g}: the normal price`);
    }
  }
  const mods = priceMods(ship, port, p, game.now, game);
  const row = buildPortView(game, s, port).market.find((r) => r.good === 'sailcloth')!;
  assert.ok(isInfStock(row.stock) && stockText(row.stock) === '∞', 'the row says ∞');
  assert.equal(row.trend, 0);
  const gm = ownGood(game, p, port, 'sailcloth')!;
  // flat: 500 cost 500 times one (within the rounding of a silver)
  assert.ok(Math.abs(quoteBuy('sailcloth', gm, 500, mods) - 500 * row.buy) <= 500, 'flat');
  assert.equal(walkBuyCost('sailcloth', row.buy, row.stock, 40), Math.ceil(row.buy * 40), 'the client’s walk is flat too');
  // bought by the thousand: never refused for the stock, the price where it was
  ship.cargo = {};
  const world0 = game.markets.get(port.id)!.goods.sailcloth!.stock;
  for (let i = 0; i < 4; i++) {
    c.push({ t: 'trade', good: 'sailcloth', qty: 500 });
    assert.equal(c.last('buyfail'), undefined, `buy ${i + 1}: no refusal`);
  }
  assert.equal(ship.cargo.sailcloth, 2000);
  assert.equal(buildPortView(game, s, port).market.find((r) => r.good === 'sailcloth')!.buy, row.buy, 'the price stands');
  assert.equal(game.markets.get(port.id)!.goods.sailcloth!.stock, world0, 'the port’s own market not moved');
  assert.equal(p.ownStock?.[`${port.id}|sailcloth`], undefined, 'nothing kept for a store');
  // a harbour that sold none before sells them now: every one of the 318
  assert.equal(game.world.ports.filter((pt) => SUPPLY_GOODS.every((g) => goodBuyCheck(game, s, pt, g, 500) === null)).length, game.world.ports.length);
});

test('no round trip in the stores pays: taken back under the cheapest price of any harbour, the best trader’s mods too', () => {
  const { game } = makeGame();
  const { c, ship, p } = captain(game, 'Arb Abe');
  // the best trader there is: every buying and selling talent, a licence everywhere
  ship.stats.buyMul = 0.85;
  ship.stats.sellMul = 1.25;
  for (const f of ['crown', 'league', 'harpoon'] as const) p.licences[f] = game.now + 1e6;
  for (const g of SUPPLY_GOODS) {
    let minBuy = Infinity, maxSell = 0, maxPort = '', minPort = '';
    for (const pt of game.world.ports) {
      const mods = priceMods(ship, pt, p, game.now, game);
      const gm = ownGood(game, p, pt, g)!;
      const buy = quoteBuy(g, gm, 1, mods), sell = quoteSell(g, gm, 1, mods);
      if (buy < minBuy) [minBuy, minPort] = [buy, pt.id];
      if (sell > maxSell) [maxSell, maxPort] = [sell, pt.id];
    }
    assert.ok(maxSell < minBuy * 0.9, `${g}: sold back at most ${maxSell} (${maxPort}), bought at least ${minBuy} (${minPort})`);
    // and the worst case of any price mods: the buyback is 0.3 of the base, the cheapest harbour's price over 0.78 of it
    // even at a fifth off on top of the best mods
    const extreme: PriceMods = { buyMul: 0.85 * 0.97 * 0.9 * 0.9 * 0.85, sellMul: 2, lawfulPort: false, honest: true, duty: 0 };
    for (const pt of game.world.ports) {
      const gm = ownGood(game, p, pt, g)!;
      assert.ok(quoteSell(g, gm, 10, extreme) < quoteBuy(g, gm, 10, extreme), `${pt.id} ${g}: in one port`);
    }
  }
  // through the market itself: bought and sold back at once, the purse is lighter
  const gold0 = p.gold;
  ship.cargo = {};
  for (const g of SUPPLY_GOODS) {
    c.push({ t: 'trade', good: g, qty: 100 });
    c.push({ t: 'trade', good: g, qty: -100 });
  }
  assert.equal(Object.keys(ship.cargo).filter((g) => SUPPLY_GOODS.includes(g as GoodId)).length, 0, 'all sold back');
  assert.ok(p.gold < gold0 * 1 - 100, `round trip: ${gold0} → ${p.gold}`);
});

test('every other good: her own stock — one captain buying it out leaves another’s untouched, and the port’s own', () => {
  const { game } = makeGame();
  const a = captain(game, 'Buyer Bea');
  const b = captain(game, 'Other Olga');
  b.ship.state.x = a.ship.state.x;
  const port = a.port;
  assert.equal(b.port.id, port.id, 'the same harbour');
  const good = (Object.keys(game.markets.get(port.id)!.goods) as GoodId[]).find((g) => !SUPPLY_GOODS.includes(g) && !GOODS[g].contraband)!;
  const world0 = game.markets.get(port.id)!.goods[good]!.stock;
  const rowB0 = buildPortView(game, b.s, port).market.find((r) => r.good === good)!;
  // she buys all she sees, three times over
  a.ship.cargo = {};
  let bought = 0;
  for (let i = 0; i < 3; i++) {
    const n = ownStockOf(game, a.p, port, good);
    assert.ok(n >= STOCK_FLOOR, `she always sees at least ${STOCK_FLOOR}: ${n}`);
    a.c.push({ t: 'trade', good, qty: Math.min(500, n) });
    bought += Math.min(500, n);
  }
  assert.equal(a.ship.cargo[good], bought);
  assert.equal(ownStockOf(game, a.p, port, good), STOCK_FLOOR, 'bought out: topped up to the floor at once');
  const rowA = buildPortView(game, a.s, port).market.find((r) => r.good === good)!;
  assert.equal(rowA.stock, STOCK_FLOOR, 'her market row: 100');
  // the other captain: the same stock, the same price; the port's own market as it was
  const rowB = buildPortView(game, b.s, port).market.find((r) => r.good === good)!;
  assert.deepEqual([rowB.stock, rowB.buy, rowB.sell], [rowB0.stock, rowB0.buy, rowB0.sell], 'hers untouched');
  assert.equal(game.markets.get(port.id)!.goods[good]!.stock, world0, 'the port’s own untouched');
  // her sale raises her own stock, not the other's (a small one: past 40 % of the port's appetite an hour the
  // counter-supply comes into her stock too, empires.ts noteSale)
  const before = ownStockOf(game, a.p, port, good);
  const n = Math.max(1, Math.floor(game.markets.get(port.id)!.goods[good]!.target * 0.3));
  a.c.push({ t: 'trade', good, qty: -n });
  assert.equal(ownStockOf(game, a.p, port, good), before + n);
  a.c.push({ t: 'trade', good, qty: -100 }); // a flood: the counter-supply on top, still hers alone
  assert.ok(ownStockOf(game, a.p, port, good) > before + n + 100);
  assert.equal(ownStockOf(game, b.p, port, good), rowB0.stock);
});

test('the floor: every captain sees at least 100 of every good in every harbour, and her prices are those of what she sees', () => {
  const { game } = makeGame();
  const { s, ship, p } = captain(game, 'Floor Flo');
  let rows = 0;
  for (const pt of game.world.ports) {
    const mods = priceMods(ship, pt, p, game.now, game);
    const market = ownMarket(game, p, pt)!;
    for (const r of marketRows(market, mods)) {
      rows++;
      assert.ok(r.stock >= STOCK_FLOOR, `${pt.id} ${r.good}: ${r.stock}`);
      const gm = market.goods[r.good]!;
      if (gm.flat) continue;
      // the row's price is the first unit's quote, and the client's walk reads the quote (never under; over by the row's rounding up, walked)
      assert.ok(Math.abs(quoteBuy(r.good, gm, 1, mods) - r.buy) <= 1, `${pt.id} ${r.good}: row ${r.buy}`);
      for (const n of [5, 40, 100]) {
        const real = quoteBuy(r.good, gm, n, mods), shown = walkBuyCost(r.good, r.buy, r.stock, n);
        assert.ok(shown >= real - 1 && shown <= real + n * 1.2 + 1, `${pt.id} ${r.good} ×${n}: shown ${shown}, charged ${real}`);
      }
      // at her normal stock the price is the port's own
      const world = game.markets.get(pt.id)!.goods[r.good]!;
      if (world.stock >= world.base! - 1e-9) assert.ok(Math.abs(midPrice(r.good, gm) - midPrice(r.good, world)) < 1e-6 * midPrice(r.good, world) + 1e-9, `${pt.id} ${r.good}: the port’s price`);
    }
  }
  assert.ok(rows > 5000, `${rows} rows`);
  // a thin good bought down: the price at the floor stands, it walks no higher
  const port = game.portById(s.ship!.docked!)!;
  const g = thinGood(game, port.id);
  const gm = ownGood(game, p, port, g)!;
  const mods = priceMods(ship, port, p, game.now, game);
  const one = quoteBuy(g, gm, 1, mods);
  assert.ok(quoteBuy(g, gm, 300, mods) <= one * 300 + 300, 'never dearer than at the floor');
  // and a sale lowers her price: the next unit sells for less
  ownTrade(game, p, port, g, 200);
  assert.ok(buildPortView(game, s, port).market.find((r) => r.good === g)!.sell < marketRows({ portId: port.id, goods: { [g]: gm } }, mods)[0].sell + 1);
});

test('above the floor, her stock goes back to the port’s at the port’s pace; the entry is dropped once there', () => {
  const { game } = makeGame();
  const { p, port } = captain(game, 'Pace Pat');
  const g = thinGood(game, port.id);
  const world = game.markets.get(port.id)!.goods[g]!;
  const level0 = ownStockOf(game, p, port, g);
  ownTrade(game, p, port, g, 300); // she sold 300 here
  assert.equal(ownStockOf(game, p, port, g), level0 + 300);
  assert.ok(p.ownStock?.[`${port.id}|${g}`], 'kept');
  game.now += ECON_HOUR; // an hour of the market
  const after = ownStockOf(game, p, port, g);
  assert.ok(after < level0 + 300 && after > level0, `going back: ${after}`);
  game.now += ECON_HOUR * 400;
  assert.ok(Math.abs(ownStockOf(game, p, port, g) - Math.max(STOCK_FLOOR, Math.floor(world.stock * Math.max(1, STOCK_FLOOR / world.base!)))) <= 1);
  gcOwnStock(game, p);
  assert.equal(p.ownStock, undefined, 'back at the port’s: nothing kept');
  // compact: never more than OWN_STOCK_MAX entries, whatever she trades
  for (const pt of game.world.ports) for (const x of ['rum', 'salt', 'fish'] as GoodId[]) ownTrade(game, p, pt, x, 400);
  assert.ok(Object.keys(p.ownStock ?? {}).length <= OWN_STOCK_MAX);
  assert.ok(JSON.stringify(p.ownStock).length < 12_000, `${JSON.stringify(p.ownStock).length} bytes`);
});

test('kept across a relog: her stock is on her profile, saved and loaded back', () => {
  const { game } = makeGame();
  const { s, p, port } = captain(game, 'Relog Rae');
  const g = thinGood(game, port.id);
  ownTrade(game, p, port, g, 250);
  const mine = ownStockOf(game, p, port, g);
  game.saveAll();
  const row = game.db.loadCaptain(s.accountId)!;
  const back = sanitizeProfile(JSON.parse(row.data) as Profile);
  assert.deepEqual(back.ownStock, p.ownStock);
  assert.equal(ownStockOf(game, back, port, g), mine);
  // a broken entry from a bad save is dropped, not trusted
  const bad = sanitizeProfile({ ...JSON.parse(row.data), ownStock: { 'x|rum': ['a', 1], [`${port.id}|${g}`]: [300, 5] } } as Profile);
  assert.deepEqual(Object.keys(bad.ownStock ?? {}), [`${port.id}|${g}`]);
});

test('the advisor reads her stock: the stores never «stock», another good past her stock is, not sold here names the ports', () => {
  const { game } = makeGame();
  const { s, p, port } = captain(game, 'Advice Ada');
  for (const g of SUPPLY_GOODS) assert.equal(goodBuyCheck(game, s, port, g, 500), null, `${g}: 500 at once`);
  const g = thinGood(game, port.id);
  const have = ownStockOf(game, p, port, g);
  const f = goodBuyCheck(game, s, port, g, have + 7)!;
  assert.equal(f.fail.why, 'stock');
  assert.equal(f.fail.can, have);
  assert.match(f.msg, new RegExp(`has only ${have} `));
  // the nearest sellers: her own stock there; the stores ∞
  const sellers = nearestSellers(game, s, 'planks', 500, port.id);
  assert.ok(sellers.length === 3 && sellers.every((x) => x.stock === INF_STOCK));
  const rum = nearestSellers(game, s, 'rum', 10, port.id);
  assert.ok(rum.every((x) => x.stock >= STOCK_FLOOR));
  // a good the harbour does not trade at all is still «not sold here»
  const notHere = (Object.keys(GOODS) as GoodId[]).find((x) => !game.markets.get(port.id)!.goods[x] && !GOODS[x].contraband)!;
  const n = goodBuyCheck(game, s, port, notHere, 1)!;
  assert.equal(n.fail.why, 'notsold');
  assert.match(n.msg, /does not sell/);
  // the quest's card on the market reads her stock
  const qv = buildPortView(game, s, port);
  for (const q of qv.questBuys ?? []) if (q.soldHere) assert.ok(q.stock >= STOCK_FLOOR);
});

test('the market’s words: «∞» in Russian and English', () => {
  for (const t of [WIN_EN['mk.stock'], WIN_RU['mk.stock']]) assert.ok(t.replace('{n}', String(stockText(INF_STOCK))).includes('∞'));
  assert.equal(stockText(120), 120);
});
