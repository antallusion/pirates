import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Port } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { forwardOffers, LOAN_INTEREST } from '../server/src/game/finance.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps } from './helpers.ts';

function dockAt(game: Game, s: PlayerSession, port: Port): void {
  const ship = s.ship!;
  ship.state.x = port.x;
  ship.state.y = port.y;
  (game as unknown as { dockShip(s: PlayerSession, p: Port): void }).dockShip(s, port);
}

function exchangePort(game: Game): Port {
  return game.world.ports.find((p) => p.size >= 2 && p.faction === 'crown')!;
}

function leaguePort(game: Game): Port {
  return game.world.ports.find((p) => p.faction === 'league')!;
}

test('exchange forwards: collateral up front, paid per unit on delivery, collateral back when complete', () => {
  const { game } = makeGame();
  const c = join(game, 'Forward Trader');
  const s = [...game.sessions][0];
  const p = s.profile!;
  const ship = s.ship!;
  const home = exchangePort(game);
  dockAt(game, s, home);
  game.pushPort(s);
  const view = c.last('port')!.view!;
  assert.ok(view.exchange, 'a large port has an exchange');
  const offers = forwardOffers(game, home);
  assert.ok(offers.length > 0, 'forwards on the board');
  const f = offers[0];
  p.gold = 10000;
  c.push({ t: 'forward', id: f.id });
  assert.equal(p.gold, 10000 - f.collateral);
  assert.equal(p.forwards.length, 1);
  assert.ok(!forwardOffers(game, home).some((x) => x.id === f.id), 'taken off the board');
  // Deliver half, then the rest.
  const dest = game.portById(f.toPort)!;
  const half = Math.floor(f.qty / 2);
  ship.cargo = { [f.good]: half };
  p.stolen = {};
  dockAt(game, s, dest);
  assert.equal(p.forwards[0].delivered, half);
  assert.equal(p.gold, 10000 - f.collateral + half * f.price);
  ship.docked = null;
  ship.cargo = { [f.good]: f.qty };
  const rep0 = p.reputation.league ?? 0;
  dockAt(game, s, dest);
  assert.equal(p.forwards.length, 0, 'forward complete');
  assert.equal(p.gold, 10000 + f.qty * f.price, 'collateral returned');
  assert.equal(ship.cargo[f.good], half, 'only the remainder was taken');
  assert.ok((p.reputation.league ?? 0) > rep0);
});

test('forwards lapse: collateral forfeit and League standing drops', () => {
  const { game } = makeGame();
  const c = join(game, 'Late Larry');
  const s = [...game.sessions][0];
  const p = s.profile!;
  dockAt(game, s, exchangePort(game));
  const f = forwardOffers(game, exchangePort(game))[0];
  p.gold = 10000;
  c.push({ t: 'forward', id: f.id });
  p.forwards[0].expiresAt = game.now + 1;
  const rep0 = p.reputation.league ?? 0;
  steps(game, 60);
  assert.equal(p.forwards.length, 0);
  assert.equal(p.gold, 10000 - f.collateral);
  assert.ok((p.reputation.league ?? 0) < rep0);
});

test('player buy orders: escrow, another captain fills, goods reach the buyer warehouse, lapsed escrow refunded', () => {
  const { game } = makeGame();
  const cb = join(game, 'Order Buyer');
  const cs = join(game, 'Order Seller');
  const [sb, ss] = [...game.sessions];
  const home = exchangePort(game);
  dockAt(game, sb, home);
  dockAt(game, ss, home);
  sb.profile!.gold = 5000;
  cb.push({ t: 'order', action: 'post', good: 'timber', qty: 20, price: 30 });
  const o = game.orders[0];
  assert.ok(o, 'order listed');
  assert.equal(sb.profile!.gold, 5000 - 600 - 12, 'escrow + 2% fee');
  // Buyer cannot fill own order; seller fills 12.
  sb.ship!.cargo.timber = 5;
  cb.push({ t: 'order', action: 'fill', id: o.id, qty: 5 });
  assert.equal(o.filled, 0);
  ss.ship!.cargo = { timber: 12 };
  ss.profile!.stolen = {};
  const g0 = ss.profile!.gold;
  cs.push({ t: 'order', action: 'fill', id: o.id, qty: 50 });
  assert.equal(o.filled, 12);
  assert.equal(ss.profile!.gold, g0 + 12 * 30);
  assert.equal(ss.ship!.cargo.timber ?? 0, 0);
  // Buyer is docked here: goods settled into the warehouse at once.
  assert.equal(sb.profile!.warehouses[home.id].timber, 12);
  // The rest lapses and the escrow comes back on the next visit.
  o.expiresAt = game.now;
  steps(game, 20 * 11);
  assert.ok(o.closed);
  const g1 = sb.profile!.gold;
  sb.ship!.docked = null;
  dockAt(game, sb, home);
  assert.equal(sb.profile!.gold, g1 + 8 * 30);
  assert.equal(game.orders.length, 0, 'settled orders are removed');
});

test('bank: deposits are safe from sinking; withdrawals cost 1%; purse loses a tenth', () => {
  const { game } = makeGame();
  const c = join(game, 'Prudent Pim');
  const s = [...game.sessions][0];
  const p = s.profile!;
  dockAt(game, s, leaguePort(game));
  p.gold = 3000;
  c.push({ t: 'bank', action: 'deposit', amount: 2000 });
  assert.equal(p.bank, 2000);
  assert.equal(p.gold, 1000);
  c.push({ t: 'bank', action: 'withdraw', amount: 1000 });
  assert.equal(p.gold, 2000);
  assert.equal(p.bank, 990);
  // Sinking: the bank is untouched.
  c.push({ t: 'undock' });
  const ship = s.ship!;
  ship.protectedUntil = 0;
  ship.hull = 0;
  (game as unknown as { playerDeath(s: PlayerSession, sh: typeof ship): void }).playerDeath(s, ship);
  assert.equal(p.bank, 990);
  assert.ok(p.gold < 2000);
});

test('credit: limit from level and League standing, interest, default seizes balance and bailiffs collect', () => {
  const { game } = makeGame();
  const c = join(game, 'Debtor Dan');
  const s = [...game.sessions][0];
  const p = s.profile!;
  const lp = leaguePort(game);
  dockAt(game, s, lp);
  game.pushPort(s);
  const limit = c.last('port')!.view!.bank.limit;
  assert.ok(limit > 0);
  p.gold = 0;
  c.push({ t: 'bank', action: 'borrow', amount: limit + 1 });
  assert.equal(p.loan, null, 'over the limit refused');
  c.push({ t: 'bank', action: 'borrow', amount: 500 });
  assert.equal(p.gold, 500);
  assert.equal(p.loan!.owed, Math.ceil(500 * (1 + LOAN_INTEREST)));
  // Default.
  p.bank = 100;
  p.loan!.due = game.now;
  const rep0 = p.reputation.league ?? 0;
  steps(game, 25);
  assert.ok(p.loan!.defaulted);
  assert.equal(p.bank, 0, 'balance seized');
  assert.ok((p.reputation.league ?? 0) < rep0);
  c.push({ t: 'bank', action: 'borrow', amount: 100 });
  assert.equal(p.loan!.owed > 0 && p.gold === 500, true, 'no new credit while in default');
  // Bailiffs in a lawful port.
  const owed = p.loan!.owed;
  s.ship!.docked = null;
  dockAt(game, s, game.world.ports.find((q) => q.faction === 'crown')!);
  assert.equal(p.gold, 0);
  assert.equal(p.loan!.owed, owed - 500);
  p.gold = 10000;
  s.ship!.docked = null;
  dockAt(game, s, lp);
  c.push({ t: 'bank', action: 'repay', amount: 100000 });
  assert.equal(p.loan, null, 'debt settled');
});

test('insurance 2.0: tiered cover, deductible, premiums rise after a claim, void for the hunted', () => {
  const { game } = makeGame();
  const c = join(game, 'Careful Cora');
  const s = [...game.sessions][0];
  const p = s.profile!;
  const ship = s.ship!;
  dockAt(game, s, leaguePort(game));
  p.gold = 100000;
  ship.cargo = { spices: 20 };
  game.pushPort(s);
  const q = c.last('port')!.view!.insurance;
  assert.deepEqual(q.map((x) => x.tier), ['hull', 'cargo', 'full']);
  const full = q.find((x) => x.tier === 'full')!;
  c.push({ t: 'insure', tier: 'full' });
  assert.equal(p.policy?.tier, 'full');
  assert.equal(p.gold, 100000 - full.premium);
  c.push({ t: 'undock' });
  const g0 = p.gold;
  (game as unknown as { playerDeath(s: PlayerSession, sh: typeof ship): void }).playerDeath(s, ship);
  const payout = Math.round(full.declared * 0.85 - full.deductible);
  // Fee waived; purse loses a tenth of what it held, then the payout arrives.
  assert.equal(p.gold, g0 - Math.floor(g0 * 0.1) + payout);
  assert.equal(p.policy, null);
  assert.equal(p.claims.length, 1);
  // Premium is higher after a claim.
  ship.cargo = { spices: 20 };
  game.pushPort(s);
  const again = c.last('port')!.view!.insurance.find((x) => x.tier === 'full')!;
  assert.ok(again.premium > full.premium, `${again.premium} > ${full.premium}`);
  // Hunted captains are refused.
  p.infamy = 100000;
  c.push({ t: 'insure', tier: 'hull' });
  assert.equal(p.policy, null);
});

test('economy metrics: every silver change is in the ledger; supply, faucets, sinks and the stabiliser', async () => {
  const { econCheckpoint } = await import('../server/src/game/econmetrics.ts');
  const { game } = makeGame();
  const cs = [join(game, 'Eco One'), join(game, 'Eco Two'), join(game, 'Eco Three')];
  const sessions = [...game.sessions];
  const before = sessions.reduce((a, s) => a + s.profile!.gold + s.profile!.bank, 0);
  const r0 = game.economy();
  assert.equal(r0.supply.captains, 3);
  // Trading and the chandlery: the ledger must explain every change in the purse.
  cs[0].push({ t: 'trade', good: 'provisions', qty: 5 });
  cs[0].push({ t: 'buy_ammo', ammo: 'round', qty: 20 });
  cs[0].push({ t: 'trade', good: 'provisions', qty: -3 });
  game.saveAll();
  const r1 = game.economy();
  const after = sessions.reduce((a, x) => a + x.profile!.gold + x.profile!.bank, 0);
  assert.equal(after - before, r1.net, `ledger net ${r1.net} explains supply change ${after - before}`);
  assert.ok(r1.sinks > 0 && r1.topSinks.some((f) => f.kind === 'ammo'));
  assert.ok(r1.topFaucets.some((f) => f.kind === 'sell'));
  assert.ok(r1.priceIndex > 0.3 && r1.priceIndex < 3);
  // A flood of faucet silver reads as inflation and throttles contract rewards.
  for (const x of sessions) game.db.ledger(x.accountId, 'contract', 100000, 'test');
  const r2 = econCheckpoint(game);
  assert.equal(r2.status, 'inflating');
  assert.ok(game.econRewardMul < 1);
  assert.equal(game.econHistory.length, 1);
});
