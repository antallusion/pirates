// Honest refusals of a purchase (owner, 2026-10-21; shared/src/data/buyfail.ts): the one real reason with its numbers,
// sent to her screen as a `buyfail` beside the toast's words, and the «sell before you buy» advisor — the plan of what to
// sell here to make room, and «Продать и купить» done at once on the server (sellAndBuy: everything checked first, then
// the sales and the purchase in the same handler; nothing half done).

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { bindingLimit, roomPlan } from '../../../shared/src/data/buyfail.ts';
import type { BuyFail, BuySeller, RoomItem } from '../../../shared/src/data/buyfail.ts';
import { QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import { repairKitCloth, voyageFood } from '../../../shared/src/data/voyage.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { marketRows, quoteBuy, quoteSell } from './economy.ts';
import { levyFor, saleMul } from './empires.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { priceMods, trade } from './ports.ts';
import type { ShipEntity } from './ship.ts';
import type { PortView } from '../../../shared/src/protocol.ts';

const r1 = (n: number) => Math.round(n * 10) / 10;

/** «Not enough silver: N more needed» — what is missing, never a bare «not enough». */
export function lackSilver(cost: number, have: number): string {
  return `Not enough silver: ${Math.max(1, Math.ceil(cost - have))} more needed`;
}
/** «Not enough doubloons: N more needed». */
export function lackDoubloons(cost: number, have: number): string {
  return `Not enough doubloons: ${Math.max(1, Math.ceil(cost - have))} more needed`;
}
/** No hammocks for the men: how many wanted, how many free. */
export function lackHammocks(want: number, crew: number, crewMax: number): string {
  const free = Math.max(0, Math.floor(crewMax - crew));
  return free <= 0 ? `No hammocks left aboard: ${Math.floor(crew)} of ${Math.floor(crewMax)} taken` : `Hammocks for ${free} more only, ${Math.ceil(want)} wanted`;
}
/** No room in the hold: the m³ wanted and the m³ free. */
export function lackRoom(need: number, free: number): string {
  return `No room in the hold: ${r1(need)} m³ needed, ${r1(Math.max(0, free))} free`;
}

/** Her hold's free room (m³, her own multipliers). */
export function holdFree(ship: ShipEntity): number {
  const st = ship.stats;
  return st.holdVolume - cargoVolume(ship.cargo, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
}
/** The room one unit of a good takes in her hold (m³). */
export function unitVolume(ship: ShipEntity, good: GoodId): number {
  const st = ship.stats;
  return cargoVolume({ [good]: 1 }, st.contrabandVolumeMul, st.materialVolumeMul, st.provisionVolumeMul, st.cursedVolumeMul);
}

/** The cargo she must keep (never offered for sale by the advisor): the goods her quests and contracts still carry, the
 *  voyage's own provisions and one repair's sailcloth. */
export function keptCargo(s: PlayerSession): Partial<Record<GoodId, number>> {
  const ship = s.ship!;
  const p = s.profile!;
  const out: Partial<Record<GoodId, number>> = {};
  const add = (g: GoodId | undefined, n: number | undefined) => {
    if (g && n && n > 0) out[g] = (out[g] ?? 0) + n;
  };
  for (const qs of p.quests.active) {
    const q = QUESTS_BY_ID[qs.id];
    if (!q) continue;
    for (let i = qs.step; i < q.steps.length; i++) {
      const st = q.steps[i];
      if (st.type === 'deliver') add(st.good, st.qty);
    }
  }
  for (const c of p.contracts) if (c.kind === 'delivery') add(c.good, c.qty ?? 1);
  const st = ship.stats;
  const food = voyageFood({ crew: ship.crew, provisionUse: st.provisionUse, holdVolume: st.holdVolume, provisionVolume: GOODS.provisions.volume * st.provisionVolumeMul });
  out.provisions = Math.max(out.provisions ?? 0, food);
  out.sailcloth = Math.max(out.sailcloth ?? 0, repairKitCloth(st.sailHpMax));
  return out;
}

/** Room for one `good` she has, or could make by selling what she need not keep (in any harbour that buys it): a step
 *  of buying is impossible only when neither is so (quests.ts stepMoot). */
export function canMakeRoom(s: PlayerSession, good: GoodId): boolean {
  const ship = s.ship!;
  const unit = unitVolume(ship, good);
  const free = holdFree(ship);
  if (free + 1e-6 >= unit) return true;
  const keep = keptCargo(s);
  const stolen = s.profile!.stolen;
  let spare = 0;
  for (const g of Object.keys(ship.cargo) as GoodId[]) {
    if (g === good || !GOODS[g]) continue;
    const n = Math.floor((ship.cargo[g] ?? 0) - (keep[g] ?? 0) - (stolen[g] ?? 0));
    if (n > 0) spare += n * unitVolume(ship, g);
  }
  return free + spare + 1e-6 >= unit;
}

/** Her hold as the advisor weighs it in this harbour: what it buys and at what price, what she must keep. */
export function roomItems(game: Game, s: PlayerSession, port: Port): RoomItem[] {
  const ship = s.ship!;
  const p = s.profile!;
  const market = game.markets.get(port.id);
  if (!market) return [];
  const rows = new Map(marketRows(market, priceMods(ship, port, p, game.now, game)).map((r) => [r.good, r]));
  const keep = keptCargo(s);
  const out: RoomItem[] = [];
  for (const g of Object.keys(ship.cargo) as GoodId[]) {
    const have = Math.floor(ship.cargo[g] ?? 0);
    if (have <= 0 || !GOODS[g]) continue;
    const r = rows.get(g);
    const traded = !!r && (!GOODS[g].contraband || port.blackMarket);
    // plundered goods: customs may seize them in a lawful harbour, a fence takes his cut in another — never put on the
    // counter by the advisor (its price would not be sure)
    const stolen = Math.min(have, p.stolen[g] ?? 0);
    out.push({ good: g, have, keep: Math.min(have, (keep[g] ?? 0) + stolen), unitVol: unitVolume(ship, g), sell: traded ? r!.sell : 0 });
  }
  return out;
}

/** The nearest harbours (up to three) that sell a good, nearest first — those with `want` first, else any with some. */
export function nearestSellers(game: Game, s: PlayerSession, good: GoodId, want: number, except?: string): BuySeller[] {
  const ship = s.ship!;
  const contra = GOODS[good]?.contraband;
  const all: BuySeller[] = [];
  for (const pt of game.world.ports) {
    if (pt.id === except || (contra && !pt.blackMarket)) continue;
    const gm = game.markets.get(pt.id)?.goods[good];
    const stock = Math.floor(gm?.stock ?? 0);
    if (!gm || stock < 1) continue;
    const row = marketRows({ goods: { [good]: gm } } as never, priceMods(ship, pt, s.profile!, game.now, game))[0];
    all.push({ port: pt.id, name: pt.name, dist: Math.round(Math.hypot(pt.x - ship.state.x, pt.y - ship.state.y)), stock, price: row?.buy ?? 0 });
  }
  const enough = all.filter((x) => x.stock >= want);
  return (enough.length ? enough : all).sort((a, b) => a.dist - b.dist).slice(0, 3);
}

/** The check of a market purchase, the one real reason when refused (with its numbers), null when it can be made. */
export function goodBuyCheck(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number): { fail: BuyFail; msg: string } | null {
  const ship = s.ship!;
  const p = s.profile!;
  const def = GOODS[good];
  const gm = game.markets.get(port.id)?.goods[good];
  const name = def.name.toLowerCase();
  if (!gm || (def.contraband && !port.blackMarket)) {
    const sellers = nearestSellers(game, s, good, qty, port.id);
    const where = sellers.length ? `: sold at ${sellers.map((x) => x.name).join(', ')}` : '';
    const msg = def.contraband && gm ? `Contraband cannot be traded here${where}` : `${port.name} does not sell ${name}${where}`;
    return { fail: { why: 'notsold', good, want: qty, can: 0, sellers }, msg };
  }
  const mods = priceMods(ship, port, p, game.now, game);
  const avail = Math.floor(gm.stock);
  const free = holdFree(ship);
  const unit = unitVolume(ship, good);
  const fit = Math.max(0, Math.floor((free + 1e-6) / Math.max(1e-6, unit)));
  // the most her purse pays for (the price walks up as the stock goes: counted, not guessed)
  const cost = (n: number) => {
    const q = quoteBuy(good, gm, n, mods);
    return q + levyFor(game, port, q);
  };
  let afford = 0;
  if (p.gold >= cost(Math.min(qty, Math.max(1, avail)))) afford = qty;
  else {
    let lo = 0, hi = Math.min(qty, Math.max(0, avail));
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (p.gold >= cost(mid)) lo = mid;
      else hi = mid - 1;
    }
    afford = lo;
  }
  const why = bindingLimit(qty, fit, avail, afford);
  if (!why) return null;
  if (why === 'stock') {
    const sellers = avail < qty ? nearestSellers(game, s, good, qty, port.id) : [];
    const msg = avail <= 0 ? `${port.name} has no ${name} left` : `${port.name} has only ${avail} ${name}, ${qty} asked`;
    return { fail: { why: 'stock', good, want: qty, can: Math.max(0, Math.min(avail, fit, afford)), sellers }, msg };
  }
  if (why === 'room') {
    const need = qty * unit;
    const plan = roomPlan(roomItems(game, s, port), need - Math.max(0, free), good);
    return { fail: { why: 'room', good, want: qty, can: fit, need: r1(need), free: r1(Math.max(0, free)), plan: plan.lines, planFree: plan.freed }, msg: lackRoom(need, free) };
  }
  const price = cost(Math.min(qty, Math.max(1, avail)));
  return { fail: { why: 'silver', good, want: qty, can: afford, need: price, missing: Math.max(1, Math.ceil(price - p.gold)) }, msg: lackSilver(price, p.gold) };
}

/** Sent to her screen: the refusal's numbers (the client draws the advisor, the course, the offer of what there is). */
export function sendBuyFail(game: Game, s: PlayerSession, fail: BuyFail, msg: string): void {
  game.sendTo(s, { t: 'buyfail', fail, msg });
}

/** «Продать и купить» (the advisor's one tap): sells here exactly what the plan says — never quest cargo, never the
 *  voyage's minimum, never the good bought — and buys `qty` of `good`, all or nothing: the room, the stock and the
 *  silver (her purse and the sales' sure price) checked before anything moves. */
export function sellAndBuy(game: Game, s: PlayerSession, port: Port, good: GoodId, qty: number): string | null {
  const ship = s.ship!;
  const p = s.profile!;
  if (!GOODS[good] || !Number.isInteger(qty) || qty <= 0 || qty > 500) return 'Bad quantity';
  const gm = game.markets.get(port.id)?.goods[good];
  const first = goodBuyCheck(game, s, port, good, qty);
  if (!first) return trade(game, s, port, good, qty); // room enough already
  if (first.fail.why !== 'room' || !gm) {
    sendBuyFail(game, s, first.fail, first.msg);
    return first.msg;
  }
  const need = qty * unitVolume(ship, good) - Math.max(0, holdFree(ship));
  const plan = roomPlan(roomItems(game, s, port), need, good);
  if (plan.freed + 1e-6 < need) {
    const msg = `Not enough to sell here to make room: ${r1(plan.freed)} of ${r1(need)} m³`;
    sendBuyFail(game, s, first.fail, msg);
    return msg;
  }
  // the sales' sure price (the licences, the flooded market and the governor's levy counted; a fence's bonus is extra)
  const mods = priceMods(ship, port, p, game.now, game);
  let proceeds = 0;
  for (const l of plan.lines) {
    const g = game.markets.get(port.id)?.goods[l.good];
    if (!g) return 'Bad plan';
    const gross = Math.floor(quoteSell(l.good, g, l.qty, mods) * saleMul(game, s, port, l.good, l.qty));
    proceeds += gross - levyFor(game, port, gross);
  }
  const quoted = quoteBuy(good, gm, qty, mods);
  const price = quoted + levyFor(game, port, quoted);
  if (Math.floor(gm.stock) < qty) return `${port.name} has only ${Math.floor(gm.stock)} ${GOODS[good].name.toLowerCase()}, ${qty} asked`;
  if (p.gold + proceeds < price) return lackSilver(price, p.gold + proceeds);
  for (const l of plan.lines) {
    const e = trade(game, s, port, l.good, -l.qty);
    if (e) return e; // (cannot: checked above — kept for the record)
  }
  return trade(game, s, port, good, qty);
}

/** The goods her quests ask her to bring (a step `deliver` under way) that she has not aboard: for the market's card —
 *  sold here or not, the stock, how many fit now, the nearest harbours that sell it. */
export function questBuys(game: Game, s: PlayerSession, port: Port): NonNullable<PortView['questBuys']> {
  const ship = s.ship!;
  const out: NonNullable<PortView['questBuys']> = [];
  for (const qs of s.profile!.quests.active) {
    const q = QUESTS_BY_ID[qs.id];
    const st = q?.steps[qs.step];
    if (!q || st?.type !== 'deliver' || !GOODS[st.good]) continue;
    const short = st.qty - Math.floor(ship.cargo[st.good] ?? 0);
    if (short <= 0 || out.some((x) => x.good === st.good)) continue;
    const gm = game.markets.get(port.id)?.goods[st.good];
    const soldHere = !!gm && (!GOODS[st.good].contraband || port.blackMarket);
    const fit = Math.max(0, Math.floor((holdFree(ship) + 1e-6) / unitVolume(ship, st.good)));
    const stock = soldHere ? Math.floor(gm!.stock) : 0;
    out.push({ quest: q.id, name: q.name, good: st.good, qty: short, soldHere, stock, fit, sellers: soldHere && stock >= short ? [] : nearestSellers(game, s, st.good, short, port.id) });
  }
  return out;
}
