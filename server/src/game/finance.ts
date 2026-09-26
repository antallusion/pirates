// Finance: the exchange (forward contracts and player buy orders), the League bank (deposits and
// credit) and insurance 2.0 (tiers, deductible, risk-priced premiums, claims history).
// Every silver that enters or leaves here is written to the ledger, so the economy report
// (see economy report in Game) can tell faucets from sinks.

import { wantedLevel } from '../../../shared/src/data/factions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { dist } from '../../../shared/src/math.ts';
import type { BankView, BuyOrderView, ForwardView, InsuranceQuote, InsuranceTier } from '../../../shared/src/protocol.ts';
import { cargoValue } from '../../../shared/src/sim/shipstats.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { applyTrade, midPrice, portIsLawful } from './economy.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

// ------------------------------------------------------------------ exchange: forwards

export interface Forward {
  id: string;
  fromPort: string; // exchange that wrote it
  toPort: string;
  good: GoodId;
  qty: number;
  delivered: number;
  price: number; // silver per unit, locked
  collateral: number;
  expiresAt: number;
}

const FORWARD_REFRESH = 1200;
const MAX_FORWARDS = 3;
const MAX_ORDERS = 3;

export function hasExchange(port: Port): boolean {
  return port.size >= 2 || port.faction === 'league';
}

/** Deterministic-enough offers per exchange, rebuilt every 20 minutes from the live markets. */
export function forwardOffers(game: Game, port: Port): Forward[] {
  if (!hasExchange(port)) return [];
  const cached = game.forwardBoards.get(port.id);
  if (cached && cached.refreshAt > game.now) return cached.list;
  const list: Forward[] = [];
  const dests = game.world.ports
    .filter((q) => q.id !== port.id && dist(q.x, q.y, port.x, port.y) > 6000 && dist(q.x, q.y, port.x, port.y) < 38000)
    .sort(() => game.rng.float() - 0.5);
  for (const to of dests) {
    if (list.length >= 4) break;
    const m = game.markets.get(to.id);
    if (!m) continue;
    // The buyer wants what it is short of.
    let best: GoodId | null = null;
    let short = 0;
    for (const id in m.goods) {
      const g = id as GoodId;
      const gm = m.goods[g]!;
      if (GOODS[g].contraband && portIsLawful(to)) continue;
      if (list.some((f) => f.good === g)) continue;
      const s = (gm.target - gm.stock) / Math.max(1, gm.target);
      if (s > short) {
        short = s;
        best = g;
      }
    }
    if (!best || short < 0.1) continue;
    const gm = m.goods[best]!;
    const d = dist(to.x, to.y, port.x, port.y);
    const qty = Math.max(5, Math.round(Math.min(60, (gm.target - gm.stock) * 0.6) / GOODS[best].volume));
    const price = Math.ceil(midPrice(best, gm) * 1.12);
    list.push({
      id: `fw${Math.floor(game.now)}_${game.allocId()}`, fromPort: port.id, toPort: to.id, good: best, qty, delivered: 0, price,
      collateral: Math.ceil(qty * price * 0.15), expiresAt: game.now + 900 + (d / 6) * 2,
    });
  }
  game.forwardBoards.set(port.id, { list, refreshAt: game.now + FORWARD_REFRESH });
  return list;
}

export function forwardView(game: Game, f: Forward): ForwardView {
  return { ...f, toName: game.portById(f.toPort)?.name ?? f.toPort, fromName: game.portById(f.fromPort)?.name ?? f.fromPort };
}

export function acceptForward(game: Game, s: PlayerSession, port: Port, id: string): string | null {
  const p = s.profile!;
  const offers = forwardOffers(game, port);
  const f = offers.find((x) => x.id === id);
  if (!f) return 'That forward has been taken';
  if (p.forwards.length >= MAX_FORWARDS) return `At most ${MAX_FORWARDS} open forwards`;
  if (p.gold < f.collateral) return `The exchange wants ${f.collateral} silver as collateral`;
  p.gold -= f.collateral;
  p.forwards.push({ ...f });
  offers.splice(offers.indexOf(f), 1);
  game.db.ledger(s.accountId, 'forward_collateral', -f.collateral, f.id);
  return null;
}

/** On docking: deliver what the hold carries toward open forwards for this port. */
export function settleForwards(game: Game, s: PlayerSession, port: Port): void {
  const p = s.profile!;
  const ship = s.ship!;
  const lawful = portIsLawful(port);
  for (const f of [...p.forwards]) {
    if (f.toPort !== port.id) continue;
    const have = Math.floor(ship.cargo[f.good] ?? 0);
    // A lawful exchange will not accept plunder: its buyers read the marks on the crates.
    const clean = lawful ? Math.max(0, have - Math.ceil(p.stolen[f.good] ?? 0)) : have;
    const n = Math.min(clean, f.qty - f.delivered);
    if (n <= 0) continue;
    ship.cargo[f.good] = have - n;
    if (!ship.cargo[f.good]) delete ship.cargo[f.good];
    if (!lawful && p.stolen[f.good]) p.stolen[f.good] = Math.max(0, p.stolen[f.good]! - n);
    f.delivered += n;
    const pay = n * f.price;
    p.gold += pay;
    const m = game.markets.get(port.id);
    if (m) applyTrade(m, f.good, n);
    game.db.ledger(s.accountId, 'forward', pay, f.id);
    if (f.delivered >= f.qty) {
      p.gold += f.collateral;
      p.forwards = p.forwards.filter((x) => x !== f);
      p.reputation.league = Math.min(100, (p.reputation.league ?? 0) + 2);
      game.db.ledger(s.accountId, 'forward_collateral', f.collateral, f.id);
      game.sendTo(s, { t: 'toast', msg: `Forward filled at ${port.name}: ${pay} silver, collateral of ${f.collateral} returned.`, kind: 'gold' });
      game.grantXp(s, 30 + f.qty, 'Forward delivered');
    } else {
      game.sendTo(s, { t: 'toast', msg: `Delivered ${n} ${GOODS[f.good].name.toLowerCase()} toward the forward (${f.delivered}/${f.qty}): ${pay} silver.`, kind: 'gold' });
    }
  }
}

export function expireForwards(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  for (const f of [...p.forwards]) {
    if (f.expiresAt > game.now) continue;
    p.forwards = p.forwards.filter((x) => x !== f);
    p.reputation.league = Math.max(-100, (p.reputation.league ?? 0) - 3);
    game.sendTo(s, { t: 'toast', msg: `A forward for ${GOODS[f.good].name.toLowerCase()} to ${game.portById(f.toPort)?.name} lapsed: the exchange keeps ${f.collateral} silver collateral.`, kind: 'bad' });
  }
}

// ------------------------------------------------------------------ exchange: player buy orders

export interface BuyOrder {
  id: string;
  accountId: number;
  name: string;
  portId: string;
  good: GoodId;
  qty: number;
  filled: number;
  price: number;
  escrow: number; // silver still held for the unfilled part
  expiresAt: number;
  // Settled lazily when the poster next docks at this port.
  pendingGoods: number;
  pendingRefund: number;
  closed: boolean;
}

export const ORDER_FEE = 0.02;
const ORDER_TTL = 3 * 3600;

export function postOrder(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number, price: number): string | null {
  const p = s.profile!;
  if (!hasExchange(port)) return 'This harbour has no exchange';
  if (!GOODS[good] || !Number.isInteger(qty) || qty < 1 || qty > 200) return 'Bad order';
  if (GOODS[good].contraband && portIsLawful(port)) return 'Lawful exchanges do not list contraband';
  const base = GOODS[good].basePrice;
  if (!Number.isInteger(price) || price < Math.ceil(base * 0.3) || price > Math.floor(base * 3)) return `Price must be between ${Math.ceil(base * 0.3)} and ${Math.floor(base * 3)}`;
  if (game.orders.filter((o) => o.accountId === s.accountId && !o.closed).length >= MAX_ORDERS) return `At most ${MAX_ORDERS} open orders`;
  const escrow = qty * price;
  const fee = Math.ceil(escrow * ORDER_FEE);
  if (p.gold < escrow + fee) return `Needs ${escrow + fee} silver (escrow and a ${Math.round(ORDER_FEE * 100)}% listing fee)`;
  p.gold -= escrow + fee;
  game.orders.push({
    id: `bo${Math.floor(game.now)}_${game.allocId()}`, accountId: s.accountId, name: s.name, portId: port.id, good, qty, filled: 0, price, escrow,
    expiresAt: game.now + ORDER_TTL, pendingGoods: 0, pendingRefund: 0, closed: false,
  });
  game.db.ledger(s.accountId, 'order_escrow', -escrow, `${port.id}:${good}`);
  game.db.ledger(s.accountId, 'order_fee', -fee, `${port.id}:${good}`);
  return null;
}

export function fillOrder(game: Game, s: PlayerSession, port: Port, id: string, qty: number): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const o = game.orders.find((x) => x.id === id && x.portId === port.id && !x.closed);
  if (!o) return 'That order is gone';
  if (o.accountId === s.accountId) return 'You cannot fill your own order';
  if (!Number.isInteger(qty) || qty < 1) return 'Bad quantity';
  const have = Math.floor(ship.cargo[o.good] ?? 0);
  const clean = portIsLawful(port) ? Math.max(0, have - Math.ceil(p.stolen[o.good] ?? 0)) : have;
  const n = Math.min(qty, clean, o.qty - o.filled);
  if (n <= 0) return clean < have ? 'The exchange will not take plundered goods' : 'You do not carry that';
  ship.cargo[o.good] = have - n;
  if (!ship.cargo[o.good]) delete ship.cargo[o.good];
  const pay = n * o.price;
  o.filled += n;
  o.escrow -= pay;
  o.pendingGoods += n;
  p.gold += pay;
  if (o.filled >= o.qty) o.closed = true;
  game.db.ledger(s.accountId, 'order_fill', pay, o.id);
  game.sendTo(s, { t: 'toast', msg: `Sold ${n} ${GOODS[o.good].name.toLowerCase()} to ${o.name}'s order: ${pay} silver.`, kind: 'gold' });
  const buyer = game.sessionByAccount(o.accountId);
  if (buyer?.profile?.docked === port.id) settleOrders(game, buyer, port);
  else if (buyer) game.sendTo(buyer, { t: 'toast', msg: `${s.name} filled ${n} of your ${GOODS[o.good].name.toLowerCase()} order at ${port.name}.`, kind: 'info' });
  return null;
}

export function cancelOrder(game: Game, s: PlayerSession, port: Port, id: string): string | null {
  const o = game.orders.find((x) => x.id === id && x.accountId === s.accountId && !x.closed);
  if (!o) return 'No such order';
  if (o.portId !== port.id) return 'Cancel it at the exchange where you posted it';
  o.closed = true;
  o.pendingRefund += o.escrow;
  o.escrow = 0;
  settleOrders(game, s, port);
  return null;
}

/** Filled goods go to the poster's warehouse here; refunds of lapsed orders back to the purse. */
export function settleOrders(game: Game, s: PlayerSession, port: Port): void {
  const p = s.profile!;
  for (const o of game.orders) {
    if (o.accountId !== s.accountId || o.portId !== port.id) continue;
    if (o.pendingGoods > 0) {
      const wh = (p.warehouses[port.id] ??= {});
      wh[o.good] = (wh[o.good] ?? 0) + o.pendingGoods;
      game.sendTo(s, { t: 'toast', msg: `${o.pendingGoods} ${GOODS[o.good].name.toLowerCase()} from your order wait in your warehouse here.`, kind: 'good' });
      o.pendingGoods = 0;
    }
    if (o.pendingRefund > 0) {
      p.gold += o.pendingRefund;
      game.db.ledger(s.accountId, 'order_escrow', o.pendingRefund, o.id);
      o.pendingRefund = 0;
    }
  }
  game.orders = game.orders.filter((o) => !(o.closed && o.pendingGoods === 0 && o.pendingRefund === 0));
}

export function tickOrders(game: Game): void {
  for (const o of game.orders) {
    if (o.closed || o.expiresAt > game.now) continue;
    o.closed = true;
    o.pendingRefund += o.escrow;
    o.escrow = 0;
  }
}

export function orderView(o: BuyOrder, accountId: number): BuyOrderView {
  return { id: o.id, name: o.name, good: o.good, qty: o.qty, filled: o.filled, price: o.price, expiresAt: o.expiresAt, mine: o.accountId === accountId };
}

// ------------------------------------------------------------------ League bank

export interface Loan {
  owed: number;
  due: number;
  defaulted: boolean;
}

export const WITHDRAW_FEE = 0.01;
export const LOAN_INTEREST = 0.1;
export const LOAN_TERM = 3 * 3600;
const DEFAULT_PENALTY = 0.2;

export function hasBank(port: Port): boolean {
  return port.faction === 'league' || (port.faction === 'free' && port.size >= 2);
}

export function creditLimit(p: Profile): number {
  const rep = p.reputation.league ?? 0;
  if (rep < -10 || wantedLevel(p.infamy) >= 2 || p.loan?.defaulted) return 0;
  const f = Math.max(0.25, Math.min(2, 1 + rep / 50));
  return Math.floor((300 + p.level * 250) * f);
}

export function bankView(p: Profile, port: Port): BankView {
  return {
    available: hasBank(port), balance: p.bank, loan: p.loan, limit: creditLimit(p), interest: LOAN_INTEREST, withdrawFee: WITHDRAW_FEE, term: LOAN_TERM,
  };
}

export function bankAction(game: Game, s: PlayerSession, port: Port, action: 'deposit' | 'withdraw' | 'borrow' | 'repay', amount: number): string | null {
  const p = s.profile!;
  if (!hasBank(port)) return 'The Gilded Ledger keeps no counting-house here';
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000_000) return 'Bad amount';
  switch (action) {
    case 'deposit':
      if (p.gold < amount) return 'You do not carry that much';
      p.gold -= amount;
      p.bank += amount;
      return null;
    case 'withdraw': {
      const fee = Math.max(1, Math.ceil(amount * WITHDRAW_FEE));
      if (p.bank < amount + fee) return `Your balance cannot cover ${amount} plus a ${fee} silver fee`;
      p.bank -= amount + fee;
      p.gold += amount;
      game.db.ledger(s.accountId, 'bank_fee', -fee, port.id);
      return null;
    }
    case 'borrow': {
      if (p.loan) return 'Repay your current loan first';
      const limit = creditLimit(p);
      if (amount > limit) return limit ? `The Ledger will lend you at most ${limit}` : 'The Ledger will not lend to you';
      p.gold += amount;
      p.loan = { owed: Math.ceil(amount * (1 + LOAN_INTEREST)), due: game.now + LOAN_TERM, defaulted: false };
      game.db.ledger(s.accountId, 'loan', amount, port.id);
      return null;
    }
    case 'repay': {
      if (!p.loan) return 'You owe the Ledger nothing';
      const n = Math.min(amount, p.loan.owed, p.gold);
      if (n <= 0) return 'Nothing to repay with';
      p.gold -= n;
      p.loan.owed -= n;
      game.db.ledger(s.accountId, 'loan_repay', -n, port.id);
      if (p.loan.owed <= 0) {
        if (p.loan.defaulted) p.reputation.league = Math.min(100, (p.reputation.league ?? 0) + 5);
        p.loan = null;
        game.sendTo(s, { t: 'toast', msg: 'Your debt to the Gilded Ledger is settled.', kind: 'good' });
      }
      return null;
    }
  }
}

/** Overdue loans default: penalty, reputation, and the bank balance is seized first. */
export function tickLoan(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  const loan = p.loan;
  if (!loan || loan.defaulted || loan.due > game.now) return;
  loan.defaulted = true;
  loan.owed = Math.ceil(loan.owed * (1 + DEFAULT_PENALTY));
  p.reputation.league = Math.max(-100, (p.reputation.league ?? 0) - 15);
  const seized = Math.min(p.bank, loan.owed);
  p.bank -= seized;
  loan.owed -= seized;
  if (seized) game.db.ledger(s.accountId, 'loan_seized', -seized, 'bank');
  game.sendTo(s, { t: 'toast', msg: `You defaulted on the Gilded Ledger${seized ? `; ${seized} silver seized from your account` : ''}. ${loan.owed} still owed — bailiffs wait in every lawful port.`, kind: 'bad' });
  if (loan.owed <= 0) p.loan = null;
}

/** Bailiffs in lawful ports collect defaulted debt from the purse on arrival. */
export function collectDebt(game: Game, s: PlayerSession, port: Port): void {
  const p = s.profile!;
  if (!p.loan?.defaulted || !portIsLawful(port)) return;
  const n = Math.min(p.gold, p.loan.owed);
  if (n <= 0) return;
  p.gold -= n;
  p.loan.owed -= n;
  game.db.ledger(s.accountId, 'loan_seized', -n, port.id);
  game.sendTo(s, { t: 'toast', msg: `Bailiffs of the Gilded Ledger meet you on the quay and take ${n} silver.`, kind: 'bad' });
  if (p.loan.owed <= 0) p.loan = null;
}

// ------------------------------------------------------------------ insurance 2.0

export interface Policy {
  tier: InsuranceTier;
  declared: number; // cargo value covered, fixed at signing
  premium: number;
  deductible: number;
}

const COVER: Record<InsuranceTier, { hull: boolean; cargo: number }> = {
  hull: { hull: true, cargo: 0 },
  cargo: { hull: false, cargo: 0.7 },
  full: { hull: true, cargo: 0.85 },
};

export function riskMul(p: Profile, ship: ShipEntity): number {
  const w = wantedLevel(p.infamy);
  const claims = p.claims.length;
  const cursed = ship.curse / 100;
  const hazard = ship.cargo.gunpowder || ship.cargo.cursed_relics ? 0.25 : 0;
  return 1 + w * 0.3 + claims * 0.15 + cursed * 0.6 + hazard;
}

export function insuranceQuotes(game: Game, s: PlayerSession, port: Port): InsuranceQuote[] {
  if (port.faction !== 'league' && port.faction !== 'free') return [];
  const p = s.profile!;
  const ship = s.ship!;
  const risk = riskMul(p, ship);
  const hullValue = SHIP_CLASSES[ship.loadout.classId].price;
  const declared = cargoValue(ship.cargo);
  const out: InsuranceQuote[] = [];
  for (const tier of ['hull', 'cargo', 'full'] as InsuranceTier[]) {
    const c = COVER[tier];
    const base = (c.hull ? hullValue * 0.03 : 0) + declared * c.cargo * 0.06;
    out.push({ tier, premium: Math.max(20, Math.round(base * risk)), declared: c.cargo ? declared : 0, deductible: c.cargo ? Math.round(declared * 0.1) : 0, cover: c.cargo, hull: c.hull });
  }
  void game;
  return out;
}

export function buyPolicy(game: Game, s: PlayerSession, port: Port, tier: InsuranceTier): string | null {
  const p = s.profile!;
  if (port.faction !== 'league' && port.faction !== 'free') return 'Only League and free ports write policies';
  if (p.policy) return 'Already insured for this voyage';
  if (wantedLevel(p.infamy) >= 3) return 'The Ledger does not underwrite hunted men';
  const q = insuranceQuotes(game, s, port).find((x) => x.tier === tier);
  if (!q) return 'Unknown policy';
  if (q.cover > 0 && q.declared < 50) return 'Nothing in the hold worth insuring';
  if (p.gold < q.premium) return `The premium is ${q.premium} silver`;
  p.gold -= q.premium;
  p.policy = { tier, declared: q.declared, premium: q.premium, deductible: q.deductible };
  p.insured = true;
  game.db.ledger(s.accountId, 'insurance', -q.premium, `${port.id}:${tier}`);
  return null;
}

/** On sinking: returns { feeWaived, payout }. Records the claim, which raises future premiums. */
export function claimPolicy(game: Game, s: PlayerSession, lostCargo: number): { feeWaived: boolean; payout: number; reason?: string } {
  const p = s.profile!;
  const pol = p.policy;
  p.policy = null;
  p.insured = false;
  if (!pol) return { feeWaived: false, payout: 0 };
  if (wantedLevel(p.infamy) >= 3) return { feeWaived: false, payout: 0, reason: 'The Ledger voids the policy of a hunted pirate.' };
  const c = COVER[pol.tier];
  const covered = Math.min(pol.declared, lostCargo);
  const payout = c.cargo ? Math.max(0, Math.round(covered * c.cargo - pol.deductible)) : 0;
  p.claims.push(game.now);
  if (payout) game.db.ledger(s.accountId, 'insurance_claim', payout, pol.tier);
  return { feeWaived: c.hull, payout };
}

/** Claims are forgotten after a day. */
export function decayClaims(game: Game, p: Profile): void {
  p.claims = p.claims.filter((t) => game.now - t < 24 * 3600);
}

