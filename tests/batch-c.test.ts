// docs/16 Batch C — the economy and the port: port demand on the chart, chained merchant runs, the trophy auction of
// the free ports, the tavern's whispers for silver, slow repairs at sea against the yard's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUCTION_CUT, CHEAP_AT, DEAR_AT, HEARSAY_TTL, LOT_TIME, RELIABILITY, RUN_LEGS, SEA_HULL_PER_MIN, SNIPE_WINDOW, earlyShare, hasAuction, minRaise,
} from '../shared/src/data/dealings.ts';
import { GOODS } from '../shared/src/data/goods.ts';
import type { GoodId } from '../shared/src/data/goods.ts';
import { itemValue, makeItem } from '../shared/src/data/items.ts';
import type { Port } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession, WorldView } from '../server/src/game/player.ts';
import { dealings, toPrivateState } from '../server/src/game/player.ts';
import { demandOf, hearOfPorts } from '../server/src/game/demand.ts';
import { midPrice } from '../server/src/game/economy.ts';
import { makeRun, runsAt } from '../server/src/game/traderuns.ts';
import { lotsOf, nextBid, stepAuction } from '../server/src/game/auction.ts';
import { buyHearsay, hearsayView, stepHearsay } from '../server/src/game/hearsay.ts';
import { exploredKey } from '../server/src/game/exploration.ts';
import { repairCost } from '../server/src/game/ports.ts';
import { seaRepairView } from '../server/src/game/searepair.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = [...game.sessions].find((x) => x.name === name)!;
  return { c, s };
}

function dock(game: Game, s: PlayerSession, port: Port): void {
  (game as unknown as { dockShip(x: PlayerSession, p: Port): void }).dockShip(s, port);
}

function priv(game: Game, s: PlayerSession) {
  return toPrivateState(s, game.now, (game as unknown as { worldView(x: PlayerSession): WorldView }).worldView(s));
}

function toasts(c: FakeConn): string[] {
  return c.all('toast').map((t) => t.msg);
}

function atSea(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

// ------------------------------------------------------------------ 11. port demand on the chart

test('a market marks the goods dear and cheap there against their base price, the most extreme first', () => {
  const { game } = makeGame();
  const port = game.world.ports.find((p) => !p.blackMarket)!;
  const m = game.markets.get(port.id)!;
  const ids = Object.keys(m.goods).filter((g) => !GOODS[g as GoodId].contraband) as GoodId[];
  for (const g of ids) m.goods[g]!.stock = m.goods[g]!.target; // all at their base
  const [dear, dear2, cheap] = ids;
  m.goods[dear]!.stock = m.goods[dear]!.target * 0.3; // short: dear
  m.goods[dear2]!.stock = m.goods[dear2]!.target * 0.7;
  m.goods[cheap]!.stock = m.goods[cheap]!.target * 3; // glutted: cheap
  const d = demandOf(m, false);
  assert.equal(d.dear[0], dear, 'the shortest first');
  assert.ok(d.dear.includes(dear2));
  assert.deepEqual(d.cheap, [cheap]);
  for (const g of d.dear) assert.ok(midPrice(g, m.goods[g]!) / GOODS[g].basePrice >= DEAR_AT);
  for (const g of d.cheap) assert.ok(midPrice(g, m.goods[g]!) / GOODS[g].basePrice <= CHEAP_AT);
  assert.ok(d.dear.length <= 2 && d.cheap.length <= 2);
});

test('making port records what is dear and cheap there; the quay tells of the ports near, older and as hearsay', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Chartwise');
  const port = game.portById(s.profile!.docked!)!;
  dock(game, s, port);
  const own = s.profile!.priceIntel[port.id];
  assert.ok(own && !own.heard && own.t === game.now);
  assert.ok(Array.isArray(own.dear) && Array.isArray(own.cheap));
  const heard = Object.entries(s.profile!.priceIntel).filter(([, r]) => r.heard);
  assert.ok(heard.length >= 1 && heard.length <= 2, `the talk of ${heard.length} ports near`);
  for (const [, r] of heard) {
    assert.ok(game.now - r.t >= 900 - 1e-6, 'hearsay is a while old');
    assert.deepEqual(r.sell, {}, 'the talk gives no figures');
  }
  // The chart sees it: dear/cheap for every captain, the age, hearsay marked.
  const seen = priv(game, s).intel;
  assert.ok(seen.some((i) => i.heard && (i.dear || i.cheap)));
  // Her own fresher visit is not overwritten by talk.
  const [pid] = heard[0];
  s.profile!.priceIntel[pid] = { t: game.now, sell: { rum: 10 }, dear: [], cheap: [] };
  hearOfPorts(game, s, port);
  assert.equal(s.profile!.priceIntel[pid].heard, undefined);
  const intel = priv(game, s).intel;
  assert.ok(intel.find((i) => i.portId === port.id)!.t === game.now);
  void c;
});

// ------------------------------------------------------------------ 12. chained trade runs

test('a run is bought here at the market, paid there with the full speed bonus when early, and chains a next leg', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Runner');
  const p = s.profile!;
  p.gold = 100_000;
  s.ship!.cargo = {};
  const from = game.portById(p.docked!)!;
  const offers = runsAt(game, from);
  assert.ok(offers.length >= 1, 'the board has runs');
  const r = offers[0];
  const to = game.portById(r.to)!;
  assert.ok(r.pay >= r.cost * 1.1 - 1, 'the house pays at least a tenth over the cost here');
  const before = s.ship!.cargo[r.good] ?? 0;
  c.push({ t: 'run', action: 'accept', id: r.id });
  const run = dealings(p).runs[0];
  assert.ok(run, `taken (${toasts(c).join(' | ')})`);
  assert.equal((s.ship!.cargo[r.good] ?? 0) - before, run.qty, 'the lot is aboard');
  assert.ok(run.qty <= r.qty && run.qty >= r.qty / 3, 'the lot, or what her hold takes of it');
  assert.ok(p.gold < 100_000, 'paid for at the market');
  assert.equal(run.deadline, game.now + r.window);
  assert.ok(!runsAt(game, from).some((x) => x.id === r.id), 'off the board');
  // Early: the whole bonus.
  const gold0 = p.gold;
  game.now += Math.floor(r.window * 0.3);
  dock(game, s, to);
  assert.equal(dealings(p).runs.length, 0, 'delivered');
  assert.equal(p.gold - gold0, run.qty * r.pay + run.bonus, 'the house price and the full bonus');
  assert.ok(toasts(c).some((t) => t.includes('pays')));
  const next = dealings(p).next;
  if (next) {
    assert.equal(next.leg, 2);
    assert.equal(next.from, to.id);
    assert.equal(next.house, r.house, 'the same house');
    c.push({ t: 'run', action: 'accept', id: next.id });
    assert.equal(dealings(p).runs[0]?.leg, 2, 'the next leg taken from her own offer');
    assert.equal(dealings(p).next, null);
  }
});

test('the speed bonus falls to nothing at the deadline; a lapsed run leaves her the goods and costs standing', () => {
  assert.equal(earlyShare(1000, 1000), 1);
  assert.equal(earlyShare(450, 1000), 1);
  assert.ok(Math.abs(earlyShare(225, 1000) - 0.5) < 1e-9);
  assert.equal(earlyShare(0, 1000), 0);
  const { game } = makeGame();
  const { c, s } = captain(game, 'Laggard');
  const p = s.profile!;
  p.gold = 100_000;
  s.ship!.cargo = {};
  const from = game.portById(p.docked!)!;
  const r = runsAt(game, from)[0];
  c.push({ t: 'run', action: 'accept', id: r.id });
  const held = s.ship!.cargo[r.good] ?? 0;
  game.now += r.window + 1;
  steps(game, 25);
  assert.equal(dealings(p).runs.length, 0, 'lapsed');
  assert.equal(s.ship!.cargo[r.good] ?? 0, held, 'the goods are hers');
  assert.ok(toasts(c).some((t) => t.includes('lapsed')));
});

test('later legs pay a larger bonus; the fifth closes the chain with a present and no further leg', () => {
  const { game } = makeGame();
  const from = game.world.ports.find((q) => runsAt(game, q).length)!;
  game.rng.float = (() => { let i = 0; return () => ((i++ * 0.37) % 1); })();
  const a = makeRun(game, from, 1, 0), b = makeRun(game, from, 4, 0);
  assert.ok(a && b);
  if (a.good === b.good && a.to === b.to && a.qty === b.qty) assert.ok(b.bonus > a.bonus);
  const { c, s } = captain(game, 'Closer');
  const p = s.profile!;
  const last = makeRun(game, game.portById(p.docked!)!, RUN_LEGS, 2)!;
  dealings(p).runs.push({ ...last, early: game.now + 1e6, deadline: game.now + 2e6 });
  s.ship!.cargo[last.good] = last.qty;
  const gold0 = p.gold;
  dock(game, s, game.portById(last.to)!);
  assert.equal(p.gold - gold0, last.qty * last.pay + last.bonus + Math.round(last.bonus * 0.5));
  assert.equal(dealings(p).next, null, 'the chain is closed');
  assert.ok(toasts(c).some((t) => t.includes('closed')));
});

// ------------------------------------------------------------------ 13. the trophy auction

function freePort(game: Game): Port {
  return game.world.ports.find((q) => hasAuction(q))!;
}

test('free ports keep rare pieces on the block; a bid holds silver, an outbid captain has hers back, the room raises', () => {
  const { game } = makeGame();
  let wall = 1_000_000;
  game.wallNow = () => wall;
  const port = freePort(game);
  assert.ok(!hasAuction(game.world.ports.find((q) => q.faction === 'crown')!), 'not in a Crown port');
  stepAuction(game);
  const lots = lotsOf(game).filter((l) => l.port === port.id);
  assert.equal(lots.length, 3);
  for (const l of lots) {
    assert.ok(l.item.rarity >= 2, 'rare or better');
    assert.equal(l.worth, itemValue(l.item));
    assert.ok(l.open < l.worth && l.open > 0, 'opens under its worth');
  }
  const { c: ca, s: a } = captain(game, 'Bidder A');
  const { c: cb, s: b } = captain(game, 'Bidder B');
  a.profile!.gold = b.profile!.gold = 1_000_000;
  dock(game, a, port);
  dock(game, b, port);
  const lot = lots[0];
  lot.cap = 0; // the room stays out of it for now
  lot.roomAt = wall + 1e9;
  ca.push({ t: 'auction', action: 'bid', id: lot.id, amount: lot.open - 1 });
  assert.ok(toasts(ca).some((t) => t.includes('least bid')), 'under the opening price');
  ca.push({ t: 'auction', action: 'bid', id: lot.id, amount: lot.open });
  assert.equal(a.profile!.gold, 1_000_000 - lot.open, 'the silver is held');
  assert.equal(lot.leader, a.accountId);
  const raise = lot.open + minRaise(lot.open);
  assert.equal(nextBid(lot), raise);
  cb.push({ t: 'auction', action: 'bid', id: lot.id, amount: raise });
  assert.equal(lot.leader, b.accountId);
  assert.equal(a.profile!.gold, 1_000_000, 'outbid: every coin back');
  assert.ok(toasts(ca).some((t) => t.startsWith('Outbid')));
  // The room raises over a captain up to what the piece is worth to it, and no further.
  lot.cap = raise + minRaise(raise) + 5;
  lot.roomAt = wall;
  stepAuction(game);
  assert.equal(lot.leader, null, 'a bidder of the room leads');
  assert.ok(lot.leaderName);
  assert.equal(b.profile!.gold, 1_000_000, 'B has hers back');
  lot.roomAt = wall;
  const standing = lot.bid;
  cb.push({ t: 'auction', action: 'bid', id: lot.id, amount: nextBid(lot) });
  lot.roomAt = wall;
  stepAuction(game);
  assert.equal(lot.leader, b.accountId, 'past its worth to them the room lets it go');
  assert.ok(lot.bid > standing);
});

test('a bid in the last minute holds the lot open; the hammer gives the winner the piece and the seller the silver less the cut', () => {
  const { game } = makeGame();
  let wall = 5_000_000;
  game.wallNow = () => wall;
  const port = freePort(game);
  const { c: cs, s: seller } = captain(game, 'Seller');
  const { c: cw, s: buyer } = captain(game, 'Winner');
  buyer.profile!.gold = 1_000_000;
  dock(game, seller, port);
  dock(game, buyer, port);
  const item = makeItem(game.rng, seller.profile!.itemSeq++, { ilvl: 5, rarity: 3 });
  seller.profile!.stash.push(item);
  const worth = itemValue(item);
  cs.push({ t: 'auction', action: 'sell', uid: item.uid, reserve: worth * 10 });
  assert.ok(toasts(cs).some((t) => t.includes('reserve must be')), 'a reserve within bounds');
  cs.push({ t: 'auction', action: 'sell', uid: item.uid, reserve: Math.round(worth * 0.5) });
  const lot = lotsOf(game).find((l) => l.seller === seller.accountId)!;
  assert.ok(lot, 'on the block');
  assert.ok(!seller.profile!.stash.some((x) => x.uid === item.uid), 'out of her locker');
  assert.equal(lot.endsAt, wall + LOT_TIME * 1000);
  lot.cap = 0;
  cs.push({ t: 'auction', action: 'bid', id: lot.id, amount: lot.open });
  assert.ok(toasts(cs).some((t) => t.includes('own lot')));
  wall = lot.endsAt - 10_000; // ten seconds left
  cw.push({ t: 'auction', action: 'bid', id: lot.id, amount: lot.open });
  assert.equal(lot.endsAt, wall + SNIPE_WINDOW * 1000, 'a minute more');
  const stash0 = buyer.profile!.stash.length;
  const gold0 = seller.profile!.gold;
  wall = lot.endsAt + 1;
  stepAuction(game);
  assert.ok(!lotsOf(game).includes(lot), 'the hammer has fallen');
  assert.equal(buyer.profile!.stash.length, stash0 + 1, 'the piece is hers');
  assert.equal(seller.profile!.gold - gold0, Math.floor(lot.open * (1 - AUCTION_CUT)), 'paid less the tenth');
  assert.ok(toasts(cw).some((t) => t.startsWith('Sold to you')));
});

test('an unsold piece of hers comes back; away from port her winnings wait for her', () => {
  const { game } = makeGame();
  let wall = 9_000_000;
  game.wallNow = () => wall;
  const port = freePort(game);
  const { c, s } = captain(game, 'Unlucky');
  dock(game, s, port);
  const item = makeItem(game.rng, s.profile!.itemSeq++, { ilvl: 4, rarity: 2 });
  s.profile!.stash.push(item);
  c.push({ t: 'auction', action: 'sell', uid: item.uid, reserve: itemValue(item) * 2 });
  const lot = lotsOf(game).find((l) => l.seller === s.accountId)!;
  lot.cap = 0;
  wall = lot.endsAt + 1;
  stepAuction(game);
  assert.ok(s.profile!.stash.some((x) => x.base === item.base && x.ilvl === item.ilvl), 'back in her locker');
  assert.ok(toasts(c).some((t) => t.includes('No one met your reserve')));
});

// ------------------------------------------------------------------ 14. the tavern's whispers

test('a whisper of a cache puts a real island with a cache on her chart; a true one pays a finder\'s share when she lands', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Listener');
  const p = s.profile!;
  p.gold = 10_000;
  const port = game.world.ports.find((q) => hearsayView(game, s, q).some((o) => o.kind === 'cache'))!;
  dock(game, s, port);
  const offers = hearsayView(game, s, port);
  const o = offers.find((x) => x.kind === 'cache')!;
  assert.ok(['sure', 'likely', 'doubtful'].includes(o.reliability));
  const gold0 = p.gold;
  c.push({ t: 'hearsay', action: 'buy', id: o.id });
  assert.equal(gold0 - p.gold, o.price, 'paid');
  const h = dealings(p).hearsay[0];
  assert.ok(h, 'hers');
  const is = game.world.islands[h.islandId!];
  assert.ok(is.features.includes('cache'), 'a real cache island');
  assert.ok(s.discovered.has(is.id), 'charted');
  const view = priv(game, s).hearsay!;
  assert.equal(view[0].x, h.x);
  assert.equal((view[0] as unknown as { truth?: boolean }).truth, undefined, 'the truth is not told');
  c.push({ t: 'hearsay', action: 'buy', id: o.id });
  assert.ok(toasts(c).some((t) => t.includes('heard that one')));
  // She sails there.
  h.truth = true;
  delete p.explored[exploredKey(is.id, 'cache')];
  atSea(game, s, is.x, is.y + is.radius + 100);
  stepHearsay(game, s);
  assert.ok(toasts(c).some((t) => t.includes('The whisper was true')));
  assert.equal(dealings(p).hearsay.length, 1, 'stays till she lands');
});

test('the reliability prices the whisper; a false one is found out on the spot; old whispers go cold', () => {
  assert.ok(RELIABILITY.sure > RELIABILITY.likely && RELIABILITY.likely > RELIABILITY.doubtful);
  const { game } = makeGame();
  const { c, s } = captain(game, 'Gull');
  const p = s.profile!;
  p.gold = 10_000;
  const port = game.world.ports.find((q) => hearsayView(game, s, q).some((o) => o.kind === 'cache'))!;
  dock(game, s, port);
  const o = hearsayView(game, s, port).find((x) => x.kind === 'cache')!;
  c.push({ t: 'hearsay', action: 'buy', id: o.id });
  const h = dealings(p).hearsay[0];
  h.truth = false;
  atSea(game, s, h.x, h.y - h.r + 50);
  stepHearsay(game, s);
  assert.equal(dealings(p).hearsay.length, 0);
  assert.ok(toasts(c).some((t) => t.includes('The whisper was false')));
  // A caravan's whisper, bought where a merchant is at sea, holds a quarter hour.
  const m = [...game.ships.values()].find((x) => x.npcRole === 'merchant' && !x.docked);
  if (m) {
    const near = game.world.ports.reduce((a, b) => (Math.hypot(a.x - m.state.x, a.y - m.state.y) < Math.hypot(b.x - m.state.x, b.y - m.state.y) ? a : b));
    s.ship!.docked = near.id;
    const cv = hearsayView(game, s, near).find((x) => x.kind === 'caravan');
    if (cv) {
      assert.equal(buyHearsay(game, s, near, cv.id), null);
      const w = dealings(p).hearsay.find((x) => x.kind === 'caravan')!;
      assert.equal(w.expiresAt - w.t, HEARSAY_TTL.caravan);
      assert.ok(typeof w.heading === 'number');
      s.ship!.docked = null;
      game.now = w.expiresAt + 1;
      stepHearsay(game, s);
      assert.ok(!dealings(p).hearsay.includes(w), 'gone cold');
    }
  }
});

// ------------------------------------------------------------------ 15. repairs at sea

test('carpenters at sea mend a few hundredths a minute from planks and sailcloth, none under fire; the yard does it at once', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Carpenter');
  const ship = s.ship!;
  const p = s.profile!;
  atSea(game, s, 30000, 80000);
  ship.crew = ship.stats.crewMax;
  ship.hull = ship.stats.hullMax * 0.5;
  ship.cargo.planks = 100;
  ship.cargo.sailcloth = 50;
  const v = seaRepairView(ship);
  assert.ok(v.hullPerMin >= 3 && v.hullPerMin <= 12, `a few percent a minute (${v.hullPerMin})`);
  assert.ok(v.minutes >= 4, `half the hull takes minutes (${v.minutes})`);
  assert.ok(v.planks > 0 && v.planks <= 100);
  c.push({ t: 'repair', on: true });
  const h0 = ship.hull, planks0 = ship.cargo.planks;
  steps(game, 20 * 60); // a minute
  const gained = (ship.hull - h0) / ship.stats.hullMax;
  assert.ok(gained > SEA_HULL_PER_MIN * 0.5 && gained < SEA_HULL_PER_MIN * 2, `about ${SEA_HULL_PER_MIN * 100}% a minute (${(gained * 100).toFixed(1)}%)`);
  assert.ok((ship.cargo.planks ?? 0) < planks0, 'planks used');
  // Under fire they down tools.
  ship.lastCombat = game.now;
  steps(game, 25);
  assert.equal(ship.repairing, false);
  // In port the yard does all of it at once for silver.
  ship.lastCombat = -1e9;
  dock(game, s, game.portById(p.lastPort ?? game.world.ports[0].id) ?? game.world.ports[0]);
  const cost = repairCost(ship);
  assert.ok(cost > 0);
  p.gold = cost + 10;
  c.push({ t: 'shipyard', action: 'repair' });
  assert.equal(ship.hull, ship.stats.hullMax, 'sound at once');
  assert.equal(p.gold, 10);
});
