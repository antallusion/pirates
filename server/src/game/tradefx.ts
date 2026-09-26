// Situational trade talents (docs/03_TALENT_TREES.md §4.5): deals of the day, established routes,
// the monopolist's grip, profit sharing, remote price letters, options on stock, patrol protection and
// the Counting House caravans.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { applyTrade, midPrice, quoteBuy } from './economy.ts';
import type { PriceMods } from './economy.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';

const DAY = 7200; // one game day = two real hours

/** Local Contacts rank 3: one good per port per game day, 15% off. Deterministic per port and day. */
export function dealOfDay(game: Game, port: Port): GoodId | null {
  const m = game.markets.get(port.id);
  if (!m) return null;
  const goods = (Object.keys(m.goods) as GoodId[]).filter((g) => !GOODS[g].contraband).sort();
  if (!goods.length) return null;
  let h = Math.floor(game.now / DAY) * 2654435761;
  for (const ch of port.id) h = (h ^ ch.charCodeAt(0)) * 16777619 >>> 0;
  return goods[h % goods.length];
}

/** Per-good and per-port price factors from talents, folded into the port's PriceMods. */
export function talentPriceMods(game: Game, ship: ShipEntity, port: Port, p: Profile, base: PriceMods): PriceMods {
  const st = ship.stats;
  const mods: PriceMods = { ...base, slippage: tx(st, 'slippage'), goodBuy: {}, goodSell: {}, goodSlip: {} };
  mods.duty = base.duty * Math.max(0, 1 + tx(st, 'dutyMul'));
  if (ship.rank('trd_local_contacts') >= 3) {
    const deal = dealOfDay(game, port);
    if (deal) mods.goodBuy![deal] = 0.85;
  }
  // Established Route: repeat runs into this port.
  const route = p.trade.arrivalRoute && p.trade.arrivalRoute.endsWith(`>${port.id}`) ? p.trade.routes[p.trade.arrivalRoute] : undefined;
  const routeMul = route ? 1 + tx(st, 'routeBonus') * Math.min(3, Math.max(0, route.n - 1)) : 1;
  for (const g of Object.keys(GOODS) as GoodId[]) {
    let sell = routeMul;
    if (p.trade.monoBonus.includes(g) && !(p.trade.monopoly[`${port.id}:${g}`] > game.now)) sell *= 1.05;
    if (sell !== 1) mods.goodSell![g] = sell;
    if ((p.trade.monopoly[`${port.id}:${g}`] ?? 0) > game.now) mods.goodSlip![g] = -0.25;
  }
  return mods;
}

/** On docking: advance the route stacks for the leg just sailed. */
export function onArrival(game: Game, p: Profile, port: Port): void {
  const from = p.trade.lastDeparture;
  p.trade.arrivalRoute = '';
  if (!from || from === port.id) return;
  const key = `${from}>${port.id}`;
  const r = p.trade.routes[key];
  p.trade.routes[key] = r && game.now - r.t < 24 * 3600 ? { n: r.n + 1, t: game.now } : { n: 1, t: game.now };
  p.trade.arrivalRoute = key;
  // Forget stale routes.
  for (const k in p.trade.routes) if (game.now - p.trade.routes[k].t > 24 * 3600) delete p.trade.routes[k];
}

/** After a sale: monopolist bookkeeping and the crew's share of the profit. */
export function onSale(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number, profit: number): void {
  const p = s.profile!;
  const ship = s.ship!;
  const now = game.now;
  // A bonus earned elsewhere is spent on the first sale of that good away from the cornered market.
  if (p.trade.monoBonus.includes(good) && !(p.trade.monopoly[`${port.id}:${good}`] > now)) p.trade.monoBonus = p.trade.monoBonus.filter((g) => g !== good);
  if (ship.hasFlag('monopolist')) {
    p.trade.monoLog = p.trade.monoLog.filter((e) => now - e.t < 3600);
    p.trade.monoLog.push({ port: port.id, good, qty, t: now });
    const sold = p.trade.monoLog.filter((e) => e.port === port.id && e.good === good).reduce((a, e) => a + e.qty, 0);
    const gm = game.markets.get(port.id)?.goods[good];
    const key = `${port.id}:${good}`;
    if (gm && sold >= gm.target * 0.4 && !(p.trade.monopoly[key] > now)) {
      p.trade.monopoly[key] = now + 1800;
      if (!p.trade.monoBonus.includes(good)) p.trade.monoBonus.push(good);
      game.sendTo(s, { t: 'toast', msg: `${port.name} is getting used to your ${GOODS[good].name.toLowerCase()}: your sales here bite 25% less for half an hour.`, kind: 'good' });
    }
  }
  // Profit Share: +1 morale per 1,000 profit this voyage, up to +10 per rank.
  const cap = tx(ship.stats, 'profitShare');
  if (cap > 0 && profit > 0) {
    p.trade.voyageProfit += profit;
    const due = Math.min(cap, Math.floor(p.trade.voyageProfit / 1000));
    if (due > p.trade.voyageShare) {
      ship.morale = Math.min(100, ship.morale + (due - p.trade.voyageShare));
      p.trade.voyageShare = due;
    }
  }
}

/** Price Memory: letters from visited ports refresh your price knowledge without a visit. */
export function priceLetters(game: Game, s: PlayerSession, record: (port: Port) => void): void {
  const r = tx(s.ship!.stats, 'priceMemory');
  if (r <= 0) return;
  const every = r >= 2 ? 900 : 1800;
  for (const portId in s.profile!.priceIntel) {
    const intel = s.profile!.priceIntel[portId];
    if (game.now - intel.t < every) continue;
    const port = game.portById(portId);
    if (port) record(port);
  }
}

// ------------------------------------------------------------------ Speculator: options on stock

export interface TradeOption {
  port: string;
  good: GoodId;
  qty: number;
  price: number; // total locked price
  deposit: number;
  until: number;
}

export function buyOption(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number, mods: PriceMods): string | null {
  const p = s.profile!;
  if (!s.ship!.hasFlag('speculator')) return 'You need the Speculator talent';
  const gm = game.markets.get(port.id)?.goods[good];
  if (!gm || !GOODS[good]) return `${port.name} does not trade that`;
  if (!Number.isInteger(qty) || qty < 1 || qty > gm.stock * 0.3) return `You may reserve up to ${Math.floor(gm.stock * 0.3)}`;
  if (p.trade.options.length >= 3) return 'At most three options at a time';
  if (p.trade.options.some((o) => o.port === port.id && o.good === good)) return 'You already hold an option on that';
  const price = quoteBuy(good, gm, qty, mods);
  const deposit = Math.ceil(price * 0.2);
  if (p.gold < deposit) return `The deposit is ${deposit} silver`;
  p.gold -= deposit;
  game.db.ledger(s.accountId, 'option_deposit', -deposit, `${port.id}:${good}`);
  applyTrade(game.markets.get(port.id)!, good, -qty); // the stock is set aside for you
  p.trade.options.push({ port: port.id, good, qty, price, deposit, until: game.now + 7200 });
  return null;
}

export function exerciseOption(game: Game, s: PlayerSession, port: Port, index: number): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const o = p.trade.options[index];
  if (!o) return 'No such option';
  if (o.port !== port.id) return `That option is held in ${game.portById(o.port)?.name}`;
  const rest = o.price - o.deposit;
  if (p.gold < rest) return `Exercising costs ${rest} silver more`;
  const free = ship.stats.holdVolume - cargoVolumeOf(ship);
  const need = o.qty * GOODS[o.good].volume * (GOODS[o.good].contraband ? ship.stats.contrabandVolumeMul : 1);
  if (need > free + 1e-6) return 'Not enough room in the hold';
  p.gold -= rest;
  ship.cargo[o.good] = (ship.cargo[o.good] ?? 0) + o.qty;
  game.setCostBasis(s, o.good, o.price / o.qty);
  game.db.ledger(s.accountId, 'buy', -rest, `option ${o.qty} ${o.good} @ ${port.id}`);
  p.trade.options.splice(index, 1);
  return null;
}

function cargoVolumeOf(ship: ShipEntity): number {
  let v = 0;
  for (const id in ship.cargo) {
    const g = id as GoodId;
    v += (ship.cargo[g] ?? 0) * GOODS[g].volume * (GOODS[g].contraband ? ship.stats.contrabandVolumeMul : 1);
  }
  return v;
}

/** Lapsed options: the stock goes back on the market and the deposit is gone. */
export function expireOptions(game: Game, s: PlayerSession): void {
  const p = s.profile!;
  for (const o of [...p.trade.options]) {
    if (o.until > game.now) continue;
    const m = game.markets.get(o.port);
    if (m) applyTrade(m, o.good, o.qty);
    p.trade.options = p.trade.options.filter((x) => x !== o);
    game.sendTo(s, { t: 'toast', msg: `Your option on ${o.qty} ${GOODS[o.good].name.toLowerCase()} lapsed; the deposit of ${o.deposit} is lost.`, kind: 'bad' });
  }
}

// ------------------------------------------------------------------ Convoy Rights / Honest Merchant

/** A protected captain was attacked: Crown and League patrols nearby come about to help. */
export function callPatrols(game: Game, victim: ShipEntity, attacker: ShipEntity): void {
  if (!victim.hasFlag('convoy_rights') || REGIONS[victim.region].safety === 'lawless') return;
  if (attacker.id === victim.id || attacker.ownerId === victim.id) return;
  game.forShipsNear(victim.state.x, victim.state.y, 2500, (o) => {
    if (o.npcRole !== 'patrol' || !o.alive || o.id === attacker.id) return;
    if (o.faction !== 'crown' && o.faction !== 'league') return;
    const brain = game.npcs.get(o.id);
    if (!brain) return;
    brain.active = true;
    brain.chase = { id: attacker.id, until: game.now + 180 };
    attacker.attackers.set(o.id, game.now); // makes the patrol hostile to the aggressor
    o.attackers.set(attacker.id, game.now);
  });
}

// ------------------------------------------------------------------ Counting House caravans

const CARAVANS = 2;
export const CARAVAN_SHARE = 0.35;

export function caravansOf(game: Game, accountId: number): ShipEntity[] {
  const out: ShipEntity[] = [];
  for (const s of game.ships.values()) if (s.caravanOf === accountId && s.alive) out.push(s);
  return out;
}

/** Keep two caravans at sea while the captain holds the keystone and is online at sea. */
export function tendCaravans(game: Game, s: PlayerSession, plan: (ship: ShipEntity, from: Port) => boolean): void {
  const ship = s.ship!;
  const p = s.profile!;
  const own = caravansOf(game, s.accountId);
  if (!ship.hasFlag('counting_house')) {
    for (const c of own) game.removeShip(c.id);
    return;
  }
  if (own.length >= CARAVANS || p.trade.caravanReadyAt > game.now) return;
  const visited = p.regionsSeen.filter((r) => r.startsWith('visited:')).map((r) => game.portById(r.slice(8))).filter((x): x is Port => !!x);
  if (visited.length < 2) return;
  const from = visited[Math.floor(game.rng.float() * visited.length)];
  const c = game.spawnNpcShip('merchant', 'fluyt', 'free', from.x, from.y, game.rng.range(0, Math.PI * 2), { ship: `${s.name}'s ${['Ledger', 'Tally', 'Promise', 'Dividend'][own.length % 4]}`, captain: 'Factor' });
  c.caravanOf = s.accountId;
  if (!plan(c, from)) game.removeShip(c.id);
}

/** A caravan sold its cargo: the owner gets a share of the margin. */
export function caravanSold(game: Game, caravan: ShipEntity, from: Port, to: Port, good: GoodId, qty: number): void {
  const s = caravan.caravanOf !== null ? game.sessionByAccount(caravan.caravanOf) : null;
  if (!s || !s.profile) return;
  const a = game.markets.get(from.id)?.goods[good], b = game.markets.get(to.id)?.goods[good];
  if (!a || !b) return;
  const margin = (midPrice(good, b) - midPrice(good, a)) * qty;
  const share = Math.round(Math.max(0, margin) * CARAVAN_SHARE);
  if (share <= 0) return;
  s.profile.gold += share;
  game.db.ledger(s.accountId, 'caravan', share, `${qty} ${good} ${from.id}>${to.id}`);
  game.sendTo(s, { t: 'toast', msg: `${caravan.name} sold ${qty} ${GOODS[good].name.toLowerCase()} in ${to.name}: ${share} silver to your account.`, kind: 'gold' });
}

/** A caravan was sunk or taken. */
export function caravanLost(game: Game, caravan: ShipEntity): void {
  const s = caravan.caravanOf !== null ? game.sessionByAccount(caravan.caravanOf) : null;
  caravan.caravanOf = null;
  if (!s || !s.profile) return;
  s.profile.trade.caravanReadyAt = game.now + 1800;
  s.profile.reputation.league = Math.max(-100, (s.profile.reputation.league ?? 0) - 3);
  game.sendTo(s, { t: 'toast', msg: `${caravan.name} is lost. The Ledger frowns; a new caravan fits out in 30 minutes.`, kind: 'bad' });
}
