// Chained trade runs (docs/16 #12): a merchant house on the port's board wants a lot of a good bought here and brought
// to a port where it is dearer, by a deadline. She buys it at the market's price when she takes the run; the consignee
// there pays the house's price for it and a bonus for speed (all of it while nearly half the time is left, nothing at
// the deadline). Delivered, the house offers the next leg from that port — the bonus larger with every leg, five legs
// and the chain is closed with a present.

import { RUN_CHAIN_STEP, RUN_HOUSES, RUN_LEGS, RUN_NEXT_TTL, RUN_SLOTS, earlyShare, runWindow, RUN_EARLY_SHARE } from '../../../shared/src/data/dealings.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { dist } from '../../../shared/src/math.ts';
import type { TradeRunView } from '../../../shared/src/protocol.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { applyTrade, midPrice } from './economy.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { Game } from './Game.ts';
import { dealings } from './player.ts';
import type { PlayerSession } from './player.ts';
import { trade } from './ports.ts';

export type TradeRun = TradeRunView;

const BOARD_REFRESH = 900;
const OFFERS = 2;
const boards = new WeakMap<Game, Map<string, { list: TradeRun[]; refreshAt: number }>>();
let seq = 1;

/** A run from this port for a leg of a house's chain: the good that gains most on the way to a port near. */
export function makeRun(game: Game, from: Port, leg: number, house = game.rng.int(0, RUN_HOUSES.length - 1), avoid: GoodId[] = []): TradeRun | null {
  const here = game.markets.get(from.id);
  if (!here) return null;
  const dests = game.world.ports
    .filter((q) => q.id !== from.id && dist(q.x, q.y, from.x, from.y) > 5000 && dist(q.x, q.y, from.x, from.y) < 30000 && game.markets.has(q.id))
    .sort(() => game.rng.float() - 0.5)
    .slice(0, 8);
  let best: { to: Port; good: GoodId; gain: number } | null = null;
  for (const to of dests) {
    const there = game.markets.get(to.id)!;
    for (const id in here.goods) {
      const g = id as GoodId;
      if (GOODS[g].contraband || avoid.includes(g)) continue;
      const a = here.goods[g]!, b = there.goods[g];
      if (!b || a.stock < 12) continue;
      const gain = midPrice(g, b) / midPrice(g, a);
      if (gain >= 1.02 && (!best || gain > best.gain)) best = { to, good: g, gain };
    }
  }
  if (!best) return null;
  const { to, good } = best;
  const gm = here.goods[good]!;
  const d = dist(to.x, to.y, from.x, from.y);
  const vol = Math.max(0.2, GOODS[good].volume);
  const qty = Math.max(4, Math.min(40, Math.floor(gm.stock * 0.4), Math.round(game.rng.int(8, 18) / vol)));
  const cost = Math.ceil(midPrice(good, gm) * 1.06);
  // The house's price there: what the far market pays, and never less than a tenth over what it cost here.
  const pay = Math.round(Math.max(midPrice(good, game.markets.get(to.id)!.goods[good]!), cost * 1.1));
  const bonus = Math.round((qty * cost * 0.12 + d / 40) * (1 + RUN_CHAIN_STEP * (leg - 1)) * game.econRewardMul);
  return { id: `run${seq++}`, house, leg, good, qty, from: from.id, to: to.id, pay, cost, bonus, window: runWindow(d), early: 0, deadline: 0, dist: Math.round(d) };
}

/** The runs on this port's board (a fresh pair every quarter hour). */
export function runsAt(game: Game, port: Port): TradeRun[] {
  let all = boards.get(game);
  if (!all) boards.set(game, (all = new Map()));
  let b = all.get(port.id);
  if (!b || b.refreshAt <= game.now) {
    const list: TradeRun[] = [];
    for (let i = 0; i < OFFERS * 2 && list.length < OFFERS; i++) {
      const r = makeRun(game, port, 1, undefined, list.map((x) => x.good));
      if (r) list.push(r);
    }
    b = { list, refreshAt: game.now + BOARD_REFRESH };
    all.set(port.id, b);
  }
  return b.list;
}

export function runBoard(game: Game, s: PlayerSession, port: Port): { offers: TradeRun[]; next: TradeRun | null } {
  const d = dealings(s.profile!);
  const next = d.next && d.next.from === port.id && d.next.deadline > game.now ? d.next : null;
  return { offers: runsAt(game, port), next };
}

/** She takes a run: the lot is bought here at the market's price, and the clock starts. */
export function acceptRun(game: Game, s: PlayerSession, port: Port, id: string): string | null {
  const d = dealings(s.profile!);
  if (d.runs.length >= RUN_SLOTS) return `You can carry at most ${RUN_SLOTS} merchants' runs`;
  const board = runsAt(game, port);
  const chained = d.next && d.next.id === id && d.next.from === port.id && d.next.deadline > game.now ? d.next : null;
  const offer = chained ?? board.find((r) => r.id === id);
  if (!offer) return 'That run has been taken';
  // A smaller hold takes a smaller lot (the bonus in proportion), down to a third of it.
  const ship = s.ship!;
  const per = Math.max(0.01, GOODS[offer.good].volume);
  const free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
  const fit = Math.min(offer.qty, Math.floor((free + 1e-6) / per));
  if (fit < Math.max(3, Math.ceil(offer.qty / 3))) return `Your hold has room for only ${Math.max(0, fit)} of the ${offer.qty}`;
  const bought = trade(game, s, port, offer.good, fit);
  if (bought) return bought;
  const run: TradeRun = { ...offer, qty: fit, bonus: Math.round((offer.bonus * fit) / offer.qty), early: game.now + Math.round(offer.window * (1 - RUN_EARLY_SHARE)), deadline: game.now + offer.window };
  d.runs.push(run);
  if (chained) d.next = null;
  else board.splice(board.indexOf(offer), 1);
  game.sendTo(s, { t: 'toast', msg: `${RUN_HOUSES[run.house][0]}: ${run.qty} ${GOODS[run.good].name} aboard for ${game.portById(run.to)?.name ?? run.to}.`, kind: 'info' });
  return null;
}

export function abandonRun(game: Game, s: PlayerSession, id: string): string | null {
  const d = dealings(s.profile!);
  const r = d.runs.find((x) => x.id === id);
  if (!r) return 'No such run';
  d.runs = d.runs.filter((x) => x !== r);
  void game;
  return null;
}

/** Making port: the runs bound here are paid off, and the house offers the next leg. */
export function settleRuns(game: Game, s: PlayerSession, port: Port): void {
  const p = s.profile!;
  const ship = s.ship!;
  const d = dealings(p);
  for (const r of [...d.runs]) {
    if (r.to !== port.id || r.deadline <= game.now) continue;
    const have = Math.floor(ship.cargo[r.good] ?? 0);
    if (have < r.qty) {
      game.sendTo(s, { t: 'toast', msg: `${RUN_HOUSES[r.house][0]} waits for ${r.qty} ${GOODS[r.good].name}: you carry ${have}.`, kind: 'bad' });
      continue;
    }
    ship.cargo[r.good] = (ship.cargo[r.good] ?? 0) - r.qty;
    if ((ship.cargo[r.good] ?? 0) <= 0) delete ship.cargo[r.good];
    const m = game.markets.get(port.id);
    if (m?.goods[r.good]) applyTrade(m, r.good, r.qty);
    const share = earlyShare(r.deadline - game.now, r.window);
    const bonus = Math.round(r.bonus * share);
    const closed = r.leg >= RUN_LEGS ? Math.round(r.bonus * 0.5) : 0;
    const paid = r.qty * r.pay + bonus + closed;
    p.gold += paid;
    d.runs = d.runs.filter((x) => x !== r);
    game.db.ledger(s.accountId, 'trade_run', paid, `${r.good}:${r.from}>${r.to}:${r.leg}`);
    game.adjustRepProfile(s, port.faction, 2);
    game.grantXp(s, 40 + r.qty * 3 + r.leg * 20, null);
    const house = RUN_HOUSES[r.house][0];
    game.sendTo(s, { t: 'toast', msg: `${house} pays ${paid} silver for the ${GOODS[r.good].name} (speed bonus ${bonus}).`, kind: 'gold' });
    if (closed) {
      game.sendTo(s, { t: 'toast', msg: `The chain of ${house} is closed: ${closed} silver on top.`, kind: 'gold' });
      continue;
    }
    const next = makeRun(game, port, r.leg + 1, r.house);
    if (next) {
      d.next = { ...next, deadline: game.now + RUN_NEXT_TTL };
      game.sendTo(s, { t: 'toast', msg: `${house} offers the next leg: ${next.qty} ${GOODS[next.good].name} to ${game.portById(next.to)?.name ?? next.to}. See the contracts board.`, kind: 'info' });
    }
  }
}

/** Every second: a run past its deadline lapses (the goods are hers; the house remembers). */
export function expireRuns(game: Game, s: PlayerSession): void {
  const d = s.profile?.dealings;
  if (!d) return;
  if (d.next && d.next.deadline <= game.now) d.next = null;
  for (const r of [...d.runs]) {
    if (r.deadline > game.now) continue;
    d.runs = d.runs.filter((x) => x !== r);
    const from = game.portById(r.from);
    if (from) game.adjustRepProfile(s, from.faction, -2);
    game.sendTo(s, { t: 'toast', msg: `The run for ${RUN_HOUSES[r.house][0]} lapsed: the ${GOODS[r.good].name} is yours to sell.`, kind: 'bad' });
  }
}
