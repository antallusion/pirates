// Honest refusals of a purchase, and the «sell before you buy» advisor (owner, 2026-10-21: «еще нужен обработчик который
// советует что-то продать, прежде чем купить. у меня просто полностью трюм заполнен, но квест на покупку рома есть и купить
// не могу, потому что "недостаточно на складе". тут ошибка в том, что либо в порту это не продается, либо купить
// невозможно из-за того, что нет места — одно из двух. похожих ошибок во всей игре быть не должно»).
//
// A purchase refused says its one real reason, with its numbers:
//   notsold   — the harbour does not sell it at all: the nearest harbours that do (a course there);
//   stock     — the harbour sells it but has fewer than asked: how many it has (buy that many);
//   room      — her hold has no room: the m³ wanted against the m³ free (the advisor: what to sell to make room);
//   hammocks  — no hammocks for the men (how many free), or slots — a slot of the army, the officers' berths, full;
//   silver / doubloons — how much is missing;
//   lock      — a level, a standing, a licence wanted (its words).
// Pure: the server words and sends it (server/src/game/buyfail.ts), the client draws it (client/src/ui/buyadvice.ts).

import { GOODS } from './goods.ts';
import type { GoodId } from './goods.ts';

export type BuyWhy = 'notsold' | 'stock' | 'room' | 'hammocks' | 'slots' | 'silver' | 'doubloons' | 'lock';

/** A harbour that sells the good: its id and name, the distance from her (m), what it has and its price. */
export interface BuySeller {
  port: string;
  name: string;
  dist: number;
  stock: number;
  price: number;
}

/** One line of the advisor's plan: so many of a good sold here, at about this price, freeing this room (m³). */
export interface SellLine {
  good: GoodId;
  qty: number;
  price: number;
  vol: number;
}

export interface BuyFail {
  why: BuyWhy;
  /** The good of the market asked for (the market's refusals), else unset. */
  good?: GoodId;
  /** How many were asked for. */
  want: number;
  /** The most of them she could have now (the harbour's stock, what fits): 0 when none. */
  can?: number;
  /** room: m³ wanted; hammocks: hammocks wanted; silver/doubloons: the price. */
  need?: number;
  /** room: m³ free; hammocks: hammocks free. */
  free?: number;
  /** silver/doubloons: how much is missing. */
  missing?: number;
  /** lock: what it waits for (English, the server's words). */
  lock?: string;
  /** notsold/stock: the nearest harbours that sell it. */
  sellers?: BuySeller[];
  /** room: what to sell here to make the room, and the room it frees (m³; less than wanted: not enough to sell here). */
  plan?: SellLine[];
  planFree?: number;
  /** hammocks: her crew and her hammocks. */
  crew?: number;
  crewMax?: number;
  /** room: a quest's goods waiting on the quay (free: nothing to buy — the advisor sells only, the goods then come aboard). */
  pickup?: boolean;
}

/** A good of her hold as the advisor weighs it. */
export interface RoomItem {
  good: GoodId;
  /** Aboard (units). */
  have: number;
  /** Never offered: quest cargo, the voyage's minimum of provisions and sailcloth, plundered goods a lawful port may seize. */
  keep: number;
  /** Room a unit takes in her hold (m³, her own multipliers). */
  unitVol: number;
  /** What the harbour pays here for one (0: it does not buy it). */
  sell: number;
}

/** A sale here is «at a good price» at or past the good's base price (the harbour wants it). */
export const GOOD_PRICE = 1;

/** The advisor's plan (pure): what to sell here, the fewest units, to free `need` m³ — first the goods this harbour
 *  pays well for (dearest against their base first), then the cheapest for their room; never what is kept, never the
 *  good being bought. The last line sells only as many as the room still wants. */
export function roomPlan(items: RoomItem[], need: number, buying?: GoodId): { lines: SellLine[]; freed: number } {
  const ok = items.filter((i) => i.good !== buying && i.sell > 0 && i.unitVol > 0 && Math.floor(i.have - i.keep) >= 1);
  const ratio = (i: RoomItem) => i.sell / Math.max(1, GOODS[i.good]?.basePrice ?? 1);
  const good = ok.filter((i) => ratio(i) >= GOOD_PRICE).sort((a, b) => ratio(b) - ratio(a));
  const rest = ok.filter((i) => ratio(i) < GOOD_PRICE).sort((a, b) => a.sell / a.unitVol - b.sell / b.unitVol);
  const lines: SellLine[] = [];
  let freed = 0;
  for (const i of [...good, ...rest]) {
    if (freed + 1e-6 >= need) break;
    const avail = Math.floor(i.have - i.keep);
    const qty = Math.min(avail, Math.ceil((need - freed - 1e-6) / i.unitVol));
    if (qty <= 0) continue;
    const vol = qty * i.unitVol;
    freed += vol;
    lines.push({ good: i.good, qty, price: Math.floor(qty * i.sell), vol: Math.round(vol * 100) / 100 });
  }
  return { lines, freed: Math.round(freed * 100) / 100 };
}

/** The binding limit of a purchase of `want`: the room (`fit` of them fit), the stock (`avail`), the purse (`afford`).
 *  The smallest of the three is the honest reason (a full hold is «no room», never «out of stock»: the owner's rum);
 *  a tie goes to the room, then the stock. A harbour with none at all is «out of stock» whatever the room (making room
 *  would not get her one here). Null: all of them reach `want`. */
export function bindingLimit(want: number, fit: number, avail: number, afford: number): 'room' | 'stock' | 'silver' | null {
  if (fit >= want && avail >= want && afford >= want) return null;
  if (avail <= 0) return 'stock';
  const lo = Math.min(fit, avail, afford);
  if (fit === lo && fit < want) return 'room';
  if (avail === lo && avail < want) return 'stock';
  return 'silver';
}

// ------------------------------------------------------------------ the words (English; the client's TABLE has the Russian)

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

/** A price's refusal with what is missing after it: «Needs 50 silver: 20 more needed» (the client reads the two halves). */
export function lackMore(msg: string, cost: number, have: number): string {
  return `${msg.replace(/\.$/, '')}: ${Math.max(1, Math.ceil(cost - have))} more needed`;
}
/** A full army: no slot for a new kind of men — its slots taken, merge or dismiss a stack. */
export function lackSlot(used: number, slots: number): string {
  return `No free slot in the army for a new kind of man: ${Math.floor(used)} of ${Math.floor(slots)} taken — merge or dismiss a stack`;
}
/** Men who would join and cannot: the hammocks all taken, else the army's slots. */
export function lackBerth(s: { crew: number; crewMax: number; used: number; slots: number }): string {
  return s.crew >= s.crewMax ? lackHammocks(1, s.crew, s.crewMax) : lackSlot(s.used, s.slots);
}
