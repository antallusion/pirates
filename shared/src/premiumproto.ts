// The wire of the premium shop (owner, 2026-10-03; docs/01 P7): her account's doubloons — bought with money only —
// and the hulls and creatures they buy. Kept apart from protocol.ts, which only takes these unions in.

import type { UnitId } from './data/army.ts';
import type { ShipClassId } from './data/ships.ts';

/** Why a card's Buy is shut (the window says it in her language): too few doubloons; a hull is delivered only in port;
 *  she sails one already; the yard has her on the ways; her level is short of the hull's; every berth taken; no free
 *  slot in the army for a new kind; no hammocks for them; in a fight; the deep's own serve only a captain who keeps
 *  the deep; her ship's level is short of the creature's tier (docs/18 VII). */
export type PremiumWhy = 'poor' | 'port' | 'yours' | 'refit' | 'level' | 'berths' | 'slot' | 'room' | 'fight' | 'deep' | 'tier';

export interface PremiumShipCard {
  id: ShipClassId;
  price: number;
  /** The line on her card: English, Russian. */
  note: [string, string];
  /** The creatures that come aboard with her. */
  beasts: { u: UnitId; n: number }[];
  /** The captain's level her class asks (canon D12). */
  lv: number;
  why: PremiumWhy | null;
}

export interface PremiumUnitCard {
  id: UnitId;
  price: number;
  /** How many come in one purchase. */
  n: number;
  note: [string, string];
  /** The ship level its tier is sold from. */
  lv: number;
  why: PremiumWhy | null;
}

export interface PremiumView {
  /** Her account's doubloons. */
  balance: number;
  ships: PremiumShipCard[];
  units: PremiumUnitCard[];
  /** The port she lies in (a hull is delivered to its quay), or null at sea. */
  port: string | null;
  /** Whether the top-up takes payments yet (Telegram Stars, once the bot's token is configured on the server). */
  pay: boolean;
}

export type PremiumClientMsg =
  | { t: 'premium'; action: 'view' }
  | { t: 'premium'; action: 'buy_ship'; id: ShipClassId }
  | { t: 'premium'; action: 'buy_unit'; id: UnitId }
  /** A pack of the top-up for Telegram Stars: the server answers with the invoice's link (owner, 2026-10-11). */
  | { t: 'premium'; action: 'stars'; pack: string; lang?: 'en' | 'ru' };

export type PremiumServerMsg =
  /** The shop as she sees it now. */
  | { t: 'premium'; view: PremiumView }
  /** Her account's doubloons: on coming aboard and after every change. */
  | { t: 'doubloons'; n: number }
  /** The Telegram Stars invoice for a pack (server/src/telegram.ts): opened in the Mini App by openInvoice, on the
   *  website as a link (it opens Telegram). Null link: it could not be made (a toast says why). */
  | { t: 'premium_invoice'; pack: string; link: string | null };
