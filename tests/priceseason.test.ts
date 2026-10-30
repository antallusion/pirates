// The ports' price periods (owner, 2026-10-30: «нужно прям систему сделать нормальную, которая раз в 8 часов меняет
// цены»; server/src/game/priceseason.ts, shared/src/data/priceseason.ts): a new season every eight hours, the same for
// a period whatever the server; its bounds; no buy low, sell high in one port (the period's turn included); the prices
// the same after a restart; the sea told; the port card (portinfo.ts) by the game's rule of price knowledge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS, SUPPLY_GOODS } from '../shared/src/data/goods.ts';
import type { GoodId } from '../shared/src/data/goods.ts';
import { PRICE_PERIOD_MS, SEASON_VOL_MAX, SEASON_VOL_MIN, periodLeftMs, pricePeriod, seasonFactor, seasonVol } from '../shared/src/data/priceseason.ts';
import { bestRoute, midPrice, quoteBuy, quoteSell } from '../server/src/game/economy.ts';
import type { GoodMarket } from '../server/src/game/economy.ts';
import { advancePeriod, periodNow, stepPriceSeason } from '../server/src/game/priceseason.ts';
import { portInfoView } from '../server/src/game/portinfo.ts';
import { ownGood } from '../server/src/game/ownstock.ts';
import { buildPortView, priceMods, recordIntel } from '../server/src/game/ports.ts';
import { AuthService } from '../server/src/auth.ts';
import { Game } from '../server/src/game/Game.ts';
import { Database } from '../server/src/persistence/db.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { join, makeGame } from './helpers.ts';

type G = ReturnType<typeof makeGame>['game'];
const T0 = Date.UTC(2026, 9, 30, 9, 0, 0); // a fixed wall clock: the tests never hang on the real date

function seasoned(at = T0): G {
  const { game } = makeGame();
  game.wallNow = () => at;
  game.prices.on = true;
  stepPriceSeason(game);
  return game;
}

/** Every market's mid price, port by port, good by good. */
function prices(game: G): Map<string, number> {
  const out = new Map<string, number>();
  for (const [pid, m] of game.markets) for (const g in m.goods) out.set(`${pid}|${g}`, midPrice(g as GoodId, m.goods[g as GoodId]!));
  return out;
}

test('a period is the wall clock’s eight hours; the season of a period is the same every time, and the next one moves prices', () => {
  assert.equal(PRICE_PERIOD_MS, 8 * 3600_000);
  assert.equal(pricePeriod(T0 + PRICE_PERIOD_MS), pricePeriod(T0) + 1);
  assert.ok(periodLeftMs(T0) > 0 && periodLeftMs(T0) <= PRICE_PERIOD_MS);
  assert.equal(seasonFactor(812, 'blackwater', 'black_coast', 'sugar', -1), seasonFactor(812, 'blackwater', 'black_coast', 'sugar', -1));
  // two games at the same hour: the same prices, to the last fraction
  const a = seasoned(), b = seasoned();
  assert.deepEqual([...prices(a)], [...prices(b)]);
  // the next period: most prices move, and the same way in both games
  const before = prices(a);
  const pa = advancePeriod(a, 1);
  advancePeriod(b, 1);
  assert.equal(pa, pricePeriod(T0) + 1);
  const after = prices(a);
  assert.deepEqual([...after], [...prices(b)]);
  let moved = 0;
  for (const [k, v] of before) if (Math.abs(after.get(k)! - v) > v * 0.01) moved++;
  assert.ok(moved > before.size * 0.7, `${moved} of ${before.size} prices moved`);
  // the wall clock alone makes the next period too (no admin)
  const c = seasoned(T0 + PRICE_PERIOD_MS);
  assert.deepEqual([...prices(c)], [...after]);
});

test('the bounds: a season is within ±10–35 % of the price, a port’s trade kept (makers never much dearer, eaters never much cheaper)', () => {
  const game = seasoned();
  let lo = Infinity, hi = 0;
  for (let period = 0; period < 60; period++) {
    for (const port of game.world.ports.slice(0, 80)) {
      const m = game.markets.get(port.id)!;
      for (const g in m.goods) {
        const good = g as GoodId, gm = m.goods[good]!;
        const vol = seasonVol(good);
        assert.ok(vol >= SEASON_VOL_MIN && vol <= SEASON_VOL_MAX);
        const side = gm.prod > gm.cons ? -1 : gm.cons > gm.prod ? 1 : 0;
        const f = seasonFactor(period, port.id, port.region, good, side);
        assert.ok(f >= 1 - vol - 1e-9 && f <= 1 + vol + 1e-9, `${port.id} ${good}: ${f}`);
        if (side < 0) assert.ok(f <= 1 + vol / 2 + 1e-9, `${port.id} makes ${good}: never much dearer (${f})`);
        if (side > 0) assert.ok(f >= 1 - vol / 2 - 1e-9, `${port.id} eats ${good}: never much cheaper (${f})`);
        lo = Math.min(lo, f);
        hi = Math.max(hi, f);
      }
    }
  }
  assert.ok(lo < 0.72 && hi > 1.28, `the swing is used: ${lo.toFixed(2)}–${hi.toFixed(2)}`);
  // on the market: the season is the only change to the price (the stock and its mark untouched)
  const m = game.markets.get('blackwater')!;
  for (const g in m.goods) {
    const gm = m.goods[g as GoodId]!;
    const bare: GoodMarket = { ...gm, season: undefined };
    assert.ok(Math.abs(midPrice(g as GoodId, gm) / midPrice(g as GoodId, bare) - gm.season!) < 1e-9);
  }
  // the makers still sell cheaper than the eaters buy, whatever the season (sugar: Blackwater makes it, Gravesend eats it)
  for (let k = 0; k < 12; k++) {
    advancePeriod(game, 1);
    const cheap = midPrice('sugar', game.markets.get('blackwater')!.goods.sugar!);
    const dear = midPrice('sugar', game.markets.get('gravesend')!.goods.sugar!);
    assert.ok(dear > cheap * 1.2, `period ${game.prices.period}: sugar ${cheap.toFixed(1)} → ${dear.toFixed(1)}`);
  }
});

test('trade routes: the dearest and cheapest ports of a good change with the period, and the merchants follow them', () => {
  const game = seasoned();
  const from = game.world.ports.find((p) => p.id === 'blackwater')!;
  const routes = new Set<string>();
  const spreads: string[] = [];
  for (let k = 0; k < 6; k++) {
    const r = bestRoute(from, game.markets, game.world.ports, () => 0.5);
    assert.ok(r && r.margin > 0, 'a route that pays');
    routes.add(`${r!.to}|${r!.good}`);
    // the cheapest harbour of rum, period by period
    const cheapest = [...game.markets.entries()].filter(([, m]) => m.goods.rum).sort((a, b) => midPrice('rum', a[1].goods.rum!) - midPrice('rum', b[1].goods.rum!))[0][0];
    spreads.push(cheapest);
    advancePeriod(game, 1);
  }
  assert.ok(routes.size >= 2, `the merchants’ best route changed: ${[...routes].join(', ')}`);
  assert.ok(new Set(spreads).size >= 2, `the cheapest rum moved: ${spreads.join(', ')}`);
});

test('no buy low, sell high in one port: the best trader’s mods, every good of a dozen harbours, and across the period’s turn', () => {
  const game = seasoned();
  const c = join(game, 'Arb Abe');
  const s = game.sessionByName('Arb Abe')!;
  const ship = s.ship!, p = s.profile!;
  // the best trader there is: every buying and selling talent, a licence everywhere
  ship.stats.buyMul = 0.85;
  ship.stats.sellMul = 1.25;
  ship.stats.holdVolume = 1e5;
  for (const f of ['crown', 'league', 'harpoon'] as const) p.licences[f] = game.now + 1e9;
  const port = game.portById(ship.docked!)!;
  // (the market itself would pay: her mods sell over what they buy at — the hole the cap closes)
  const mods = priceMods(ship, port, p, game.now, game);
  const goods = (Object.keys(game.markets.get(port.id)!.goods) as GoodId[]).filter((g) => !SUPPLY_GOODS.includes(g) && !GOODS[g].contraband);
  assert.ok(goods.length > 3);
  const g0 = goods[0];
  const gm = ownGood(game, p, port, g0)!;
  assert.ok(quoteSell(g0, gm, 1, mods) > quoteBuy(g0, gm, 1, mods) * 0.98, 'the bare market would let her (the trap the cap closes)');
  for (const g of goods) {
    p.gold = 1e7;
    const gold0 = p.gold;
    ship.cargo = {};
    s.msgCount = 0; // (the flood guard: 90 a second)
    c.push({ t: 'trade', good: g, qty: 10 });
    assert.equal(ship.cargo[g], 10, `${g} bought`);
    c.push({ t: 'trade', good: g, qty: -10 });
    assert.ok(!ship.cargo[g], `${g} sold`);
    assert.ok(p.gold < gold0, `${g}: ${gold0} → ${p.gold}`);
  }
  // bought before the period turns, sold after it in the same port: no gain either
  for (let k = 0; k < 5; k++) {
    for (const g of goods) {
      p.gold = 1e7;
      ship.cargo = {};
      s.msgCount = 0; // (the flood guard: 90 a second)
      c.push({ t: 'trade', good: g, qty: 5 });
      advancePeriod(game, 1);
      c.push({ t: 'trade', good: g, qty: -5 });
      assert.ok(p.gold < 1e7, `${g} over the period’s turn: ${p.gold}`);
    }
  }
  // and a good bought elsewhere still sells at the market's price (the cap is her own purchase's only)
  p.boughtHere = undefined;
  ship.cargo = { [g0]: 10 };
  const gold1 = p.gold;
  c.push({ t: 'trade', good: g0, qty: -10 });
  assert.ok(p.gold - gold1 > 0);
});

test('a restart: the same period, the same prices — from the wall clock and the stored stocks, the admin’s run-ahead kept', () => {
  const db = new Database(':memory:');
  const mk = () => {
    const game = new Game({ db, auth: new AuthService(db), log: () => {} });
    game.directorOn = false;
    game.wallNow = () => T0;
    return game;
  };
  const a = mk();
  stepPriceSeason(a);
  advancePeriod(a, 2); // the admin ran two periods ahead
  a.markets.get('blackwater')!.goods.sugar!.stock *= 0.5; // a merchant bought it out
  const before = prices(a);
  a.saveAll();
  const b = mk();
  stepPriceSeason(b);
  assert.equal(b.prices.period, a.prices.period);
  assert.equal(periodNow(b), pricePeriod(T0) + 2);
  const after = prices(b);
  let worst = 0;
  for (const [k, v] of before) worst = Math.max(worst, Math.abs(after.get(k)! - v) / v);
  assert.ok(worst < 0.01, `the prices after the restart: off by ${(worst * 100).toFixed(2)} % at most`);
});

test('the sea is told of a new period once; the market and the card count down to it; the admin’s /prices', () => {
  const game = seasoned();
  const c = join(game, 'Told Tess');
  const s = game.sessionByName('Told Tess')!;
  const said = () => c.all('toast').filter((m) => m.msg === 'Port prices have changed: a new trading period.').length;
  stepPriceSeason(game);
  assert.equal(said(), 0, 'nothing said within a period');
  game.wallNow = () => T0 + PRICE_PERIOD_MS;
  stepPriceSeason(game);
  assert.equal(said(), 1, 'said once at the turn');
  const port = game.portById(s.ship!.docked!)!;
  const left = buildPortView(game, s, port).priceLeft!;
  assert.ok(left > 0 && left <= 8 * 3600);
  assert.ok(Object.entries(SERVER_RU_ADMIN).some(([en, ru]) => en.startsWith('/speed N') && en.includes('/prices [next|back|now]') && ru.includes('/prices [next|back|now]')), 'its HELP pair');
  const was = game.prices.period;
  assert.match(runAdmin(game, s, '/prices next') ?? '', /Price period \d+ → \d+\./);
  assert.equal(game.prices.period, was + 1);
  assert.equal(said(), 2, 'the admin’s turn is told too');
  assert.match(runAdmin(game, s, '/prices') ?? '', /the next in \d+ min/);
});

test('the port card: live in port, the last visit’s board elsewhere (exact only with Market Sense), nothing of a port never seen', () => {
  const game = seasoned();
  const c = join(game, 'Card Cora');
  const s = game.sessionByName('Card Cora')!;
  const home = s.ship!.docked!;
  // in port: the board now, exact, its trend against the last period
  c.push({ t: 'portInfo', port: home });
  const live = c.last('portInfo')!.view;
  assert.equal(live.source, 'live');
  assert.ok(live.exact && live.goods.every((g) => g.buy !== undefined && g.sell !== undefined));
  assert.ok(live.goods.some((g) => g.trend), 'a trend against the last period');
  assert.ok(live.priceLeft > 0 && live.level >= 1);
  // a port never seen: its goods (what it makes, what it eats), no prices
  const far = game.world.ports.find((pt) => pt.id !== home && !s.profile!.priceIntel[pt.id])!;
  const none = portInfoView(game, s, far.id)!;
  assert.equal(none.source, 'none');
  assert.ok(none.goods.length > 0 && none.goods.every((g) => g.buy === undefined && g.level === undefined));
  assert.ok(none.goods.some((g) => g.side !== 0));
  recordIntel(game, s, game.portById(home)!);
  // her own port, left: what she saw, with its age — levels only, exact with Market Sense
  s.ship!.docked = null;
  game.now += 7200;
  const seen = portInfoView(game, s, home)!;
  assert.equal(seen.source, 'seen');
  assert.equal(seen.ageSec, 7200);
  assert.ok(!seen.exact && seen.goods.every((g) => g.buy === undefined) && seen.goods.some((g) => g.level !== undefined));
  const hasFlag = s.ship!.hasFlag.bind(s.ship!);
  s.ship!.hasFlag = (f: string) => f === 'market_sense' || hasFlag(f as never);
  const sense = portInfoView(game, s, home)!;
  assert.ok(sense.exact && sense.goods.some((g) => g.buy !== undefined));
  // a period later the board she saw is out of date
  advancePeriod(game, 1);
  assert.equal(portInfoView(game, s, home)!.stale, true);
});

test('the card’s market: the food first (the owner’s provisioners), then what the port sells, what it buys, the rest', async () => {
  const { cardGroups, FOOD_GOODS, spanText } = await import('../client/src/ui/portcard.ts');
  const groups = cardGroups([
    { good: 'spices', side: 1, legal: true }, { good: 'iron', side: -1, legal: true }, { good: 'rum', side: 1, legal: true },
    { good: 'cloth', side: 0, legal: true }, { good: 'provisions', side: 0, legal: true },
  ]);
  assert.deepEqual(groups.map(([k, l]) => [k, l.map((x) => x.good)]), [
    ['pc.food', ['provisions', 'rum']], ['pc.sells', ['iron']], ['pc.buys', ['spices']], ['pc.other', ['cloth']],
  ]);
  assert.equal(FOOD_GOODS[0], 'provisions');
  assert.match(JSON.stringify(spanText(3 * 3600 + 12 * 60)), /3\s*(h|ч)\s*12\s*(min|мин)/);
});
