import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TALENTS } from '../shared/src/data/talents.ts';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import { loadFactor } from '../shared/src/sim/shipstats.ts';
import { quoteBuy } from '../server/src/game/economy.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { priceMods } from '../server/src/game/ports.ts';
import { caravanSold, caravansOf, dealOfDay } from '../server/src/game/tradefx.ts';
import { midPrice } from '../server/src/game/economy.ts';
import type { Port } from '../shared/src/world/worldgen.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string, talents: TalentRanks) {
  const c = join(game, name, 'smuggler');
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = 60;
  s.profile!.talents = talents;
  s.ship!.talents = talents;
  s.ship!.recompute(game.now);
  s.profile!.gold = 1e6;
  return { c, s, ship: s.ship!, p: s.profile! };
}

function dock(game: Game, s: PlayerSession, port: Port): void {
  s.ship!.docked = null;
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  (game as unknown as { dockShip(s: PlayerSession, p: Port): void }).dockShip(s, port);
}

test('trade tree data: 24 talents, 37 ranks', () => {
  const list = TALENTS.filter((t) => t.tree === 'trade');
  assert.equal(list.length, 24);
  assert.equal(list.filter((t) => !t.keystone).reduce((a, t) => a + t.maxRank, 0), 37);
});

test('prices: Bulk Buyer slippage, Ledger Keeper duty, Local Contacts deal of the day', () => {
  const { game } = makeGame();
  const { ship, p } = captain(game, 'Bulk', { trd_bulk_buyer: 2, trd_ledger_keeper: 2, trd_local_contacts: 3 });
  const { ship: plain, p: pp } = captain(game, 'Plain', {});
  const port = game.world.ports.find((x) => x.faction === 'crown' && x.size >= 2)!;
  const gm = game.markets.get(port.id)!.goods.provisions!;
  const a = quoteBuy('provisions', gm, 60, priceMods(ship, port, p, game.now, game));
  const b = quoteBuy('provisions', gm, 60, priceMods(plain, port, pp, game.now, game));
  assert.ok(a < b, `bulk ${a} < ${b}`);
  assert.ok(Math.abs(priceMods(ship, port, p, game.now, game).duty - 0.08 * 0.7) < 1e-9);
  const deal = dealOfDay(game, port)!;
  assert.ok(deal);
  assert.equal(priceMods(ship, port, p, game.now, game).goodBuy![deal], 0.85);
});

test('Established Route: repeat runs pay more at the destination', () => {
  const { game } = makeGame();
  const { s, ship, p } = captain(game, 'Runner', { trd_established_route: 2 });
  const [a, b] = game.world.ports.filter((x) => x.size >= 2).slice(0, 2);
  for (let i = 0; i < 3; i++) {
    dock(game, s, a);
    p.trade.lastDeparture = a.id;
    dock(game, s, b);
  }
  const m = priceMods(ship, b, p, game.now, game);
  assert.ok(Math.abs((m.goodSell!.rum ?? 1) - (1 + 0.03 * 2)) < 1e-9, 'two repeat runs × 3%');
});

test('Monopolist: selling 40% of a port\'s appetite corners it; Profit Share lifts morale', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Monopoly', { trd_monopolist: 1, trd_profit_share: 2 });
  const port = game.portById(p.docked!)!;
  const gm = game.markets.get(port.id)!.goods.salt!;
  ship.cargo = { salt: Math.ceil(gm.target * 0.45) };
  game.setCostBasis(s, 'salt', 1);
  ship.morale = 50;
  c.push({ t: 'trade', good: 'salt', qty: -ship.cargo.salt! });
  assert.ok((p.trade.monopoly[`${port.id}:salt`] ?? 0) > game.now, 'market cornered');
  assert.ok(p.trade.monoBonus.includes('salt'));
  assert.equal(priceMods(ship, port, p, game.now, game).goodSlip!.salt, -0.25);
  if (p.trade.voyageProfit >= 1000) assert.ok(ship.morale > 50, 'profit share');
});

test('Contract Broker, Cold Hold, Heavy Hauler, Honest Merchant, Appraiser', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Broker', { trd_contract_broker: 2, trd_cold_hold: 2, trd_heavy_hauler: 2, trd_appraiser: 1 });
  const port = game.portById(p.docked!)!;
  const offers = game.contractsAt(port.id);
  p.contracts = [{ ...offers[0], id: 'x1' }, { ...offers[0], id: 'x2' }, { ...offers[0], id: 'x3' }];
  const ok = game.contractsAt(port.id).find((x) => x.kind !== 'bounty');
  if (ok) {
    c.push({ t: 'contract', action: 'accept', id: ok.id });
    assert.equal(p.contracts.length, 4, 'fourth slot');
  }
  // Heavy Hauler: a full hold costs less speed.
  const cargo = { iron: 60 };
  const base = { ...ship.stats, x: {} as typeof ship.stats.x };
  assert.ok(loadFactor(ship.loadout, ship.stats, cargo, ship.ammo) > loadFactor(ship.loadout, base, cargo, ship.ammo));
  // Cold Hold: medicine lasts.
  c.push({ t: 'undock' });
  ship.cargo = { medicine: 100, provisions: 50 };
  steps(game, 20 * 700);
  assert.ok((ship.cargo.medicine ?? 0) === 100, `cold hold: ${ship.cargo.medicine}`);
  // Appraiser.
  game.pushSelf(s, true);
  assert.ok(c.last('self')?.self.appraisal, 'appraisal sent');
  // Honest Merchant refuses contraband.
  const { c: hc, ship: hs } = captain(game, 'Honest', { trd_honest_merchant: 1 });
  const fog = game.portById('fogmouth')!;
  hs.docked = 'fogmouth';
  (game as unknown as { dockShip(s: PlayerSession, p: Port): void }).dockShip([...game.sessions].find((x) => x.name === 'Honest')!, fog);
  const leaf0 = hs.cargo.dreamleaf ?? 0;
  hc.push({ t: 'trade', good: 'dreamleaf', qty: 1 });
  assert.equal(hs.cargo.dreamleaf ?? 0, leaf0, 'no contraband bought');
  assert.ok(hc.all('toast').some((t) => /Honest Merchant/.test(t.msg)));
});

test('Speculator: options reserve stock at a locked price; a lapsed option loses the deposit', () => {
  const { game } = makeGame();
  const { c, p, ship } = captain(game, 'Spec', { trd_market_sense: 1, trd_speculator: 1 });
  const port = game.portById(p.docked!)!;
  const gm = game.markets.get(port.id)!.goods.salt!;
  const stock0 = gm.stock;
  c.push({ t: 'option', good: 'salt', qty: 10 });
  assert.equal(p.trade.options.length, 1);
  assert.ok(gm.stock < stock0, 'stock set aside');
  const g0 = p.gold;
  ship.cargo = {};
  c.push({ t: 'option_exercise', index: 0 });
  assert.equal(ship.cargo.salt, 10);
  assert.ok(p.gold < g0);
  c.push({ t: 'option', good: 'salt', qty: 5 });
  p.trade.options[0].until = game.now;
  const before = gm.stock;
  steps(game, 25);
  assert.equal(p.trade.options.length, 0);
  assert.ok(gm.stock >= before + 5 - 0.5, 'stock returned');
});

test('Convoy Rights: patrols come about when a protected captain is attacked', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Protected', { trd_convoy_rights: 1 });
  s.ship!.docked = null;
  ship.state.x = 56000;
  ship.state.y = 70000;
  ship.region = game.regionAt(ship.state.x, ship.state.y);
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  const patrol = game.spawnNpcShip('patrol', 'brig', 'crown', ship.state.x + 800, ship.state.y, 0);
  game.grid.upsert(patrol.id, patrol.state.x, patrol.state.y);
  const pirate = game.spawnNpcShip('pirate', 'sloop', 'confederacy', ship.state.x - 100, ship.state.y, 0);
  game.grid.upsert(pirate.id, pirate.state.x, pirate.state.y);
  // The pirate fires on us.
  return import('../server/src/game/combat.ts').then(({ applyDamage: hit }) => {
    hit(game, ship, { hull: 10 }, pirate);
    assert.equal(game.npcs.get(patrol.id)!.chase?.id, pirate.id);
  });
});

test('Rumor Mill: taverns whisper of a market event twenty minutes early', () => {
  const { game } = makeGame();
  const { c } = captain(game, 'Gossip', { trd_rumor_mill: 1 });
  (game as unknown as { worldEvent(): void }).worldEvent();
  const ev = game.pendingEvent;
  assert.ok(ev, 'an event is brewing');
  assert.ok(c.all('toast').some((t) => /Tavern talk/.test(t.msg)), 'heard in port');
  (game as unknown as { worldEvent(): void }).worldEvent();
  assert.equal(game.pendingEvent, null, 'event broke');
  assert.ok(c.all('toast').some((t) => /WORLD:/.test(t.msg)));
});

test('League Patron: the Ledger serves in every lawful port with a larger credit line', () => {
  const { game } = makeGame();
  const { c, p } = captain(game, 'Patron', { trd_league_patron: 1 });
  game.pushPort([...game.sessions][0]);
  const view = c.last('port')!.view!;
  assert.ok(view.bank.available, 'bank in a Crown port');
  assert.ok(view.bank.limit >= 500 * p.level);
});

test('Counting House: caravans sail under your flag and pay a share of their margins', () => {
  const { game } = makeGame();
  const { s, p, ship } = captain(game, 'Tycoon', { trd_counting_house: 1 });
  p.regionsSeen.push(...game.world.ports.slice(0, 12).map((x) => `visited:${x.id}`));
  s.ship!.docked = null;
  ship.state.x = 30000;
  ship.state.y = 80000;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  steps(game, 20 * 25);
  const caravans = caravansOf(game, s.accountId);
  assert.equal(caravans.length, 2, 'two caravans');
  assert.ok(ship.stats.holdVolume < ship.cls.holdVolume * 0.7, 'hold −40%');
  // A caravan sells where the good is dear: the owner gets 35% of the margin.
  const car = caravans[0];
  let paid = false;
  for (const from of game.world.ports.slice(0, 12)) {
    for (const to of game.world.ports.slice(0, 12)) {
      const a = game.markets.get(from.id)!.goods.sugar, b = game.markets.get(to.id)!.goods.sugar;
      if (!a || !b || midPrice('sugar', b) <= midPrice('sugar', a) + 5) continue;
      const g0 = p.gold;
      caravanSold(game, car, from, to, 'sugar', 20);
      assert.ok(p.gold > g0, 'caravan share paid');
      paid = true;
      break;
    }
    if (paid) break;
  }
  assert.ok(paid, 'found a profitable leg');
  // Losing a caravan costs League standing and a refit.
  const rep = p.reputation.league ?? 0;
  car.hull = 0;
  game.beginSinking(car);
  assert.ok((p.reputation.league ?? 0) < rep);
  assert.ok(p.trade.caravanReadyAt > game.now);
});
