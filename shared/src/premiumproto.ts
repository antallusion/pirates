// The wire of the premium shop (owner, 2026-10-03; docs/01 P7): her account's doubloons — bought with money only —
// and the hulls and creatures they buy. Kept apart from protocol.ts, which only takes these unions in.

import type { Gift, GiftView } from './data/dailygift.ts';
import type { TgnCat, TgnView } from './data/telegram.ts';
import type { UnitId } from './data/army.ts';
import type { ShipClassId } from './data/ships.ts';
import type { CaptainId } from './data/captains.ts';

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
  /** By threes and fives (UNIT_PACKS, owner 2026-10-15): each pack's stacks, price and why it is shut. */
  packs?: { k: number; price: number; why: PremiumWhy | null }[];
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
  /** The web game's checkout (YooKassa, or the test mode's for the testers) takes her payment: the browser's top-up
   *  (owner, 2026-10-21; Telegram and VK keep their own). */
  web?: boolean;
  /** «Свиток автобоя» (owner, 2026-10-11): her account's auto-battle scrolls (their packs: AUTO_SCROLL_PACKS). */
  scrolls: number;
  /** The shop's goods, bundles and her stores (owner, 2026-10-15; shared/src/data/shop.ts). */
  shop?: ShopView;
}

/** Why an offer of the shop is shut: too few doubloons; bought as often as it may be; it needs her island; it needs
 *  her ship (afloat, out of a fight); no room aboard (slots, hammocks, hold, the map chest, the locker, the bag of
 *  scrolls); the tier is above her ship's level; at the most there is; nothing to do (no infamy, no fallen, nothing
 *  left to open); the gift is gone. */
export type ShopWhy = 'poor' | 'limit' | 'island' | 'fight' | 'slot' | 'room' | 'hold' | 'tier' | 'max' | 'none' | 'gone' | 'order';

export interface ShopJobView {
  /** The island's job id, or -1 for the yard's refit of her ship. */
  id: number;
  /** BuildingId, 'p:<producer>', 't:<town>' — or 'refit', 'ship'. */
  what: string;
  level: number;
  start: number;
  end: number;
  /** Doubloons to finish it now. */
  finish: number;
}

export interface ShopView {
  /** The wall clock (ms) the view was made at; the day's end (the deal's countdown). */
  now: number;
  dayEnds: number;
  /** Every offer that is shut, by its id (the rest may be bought); `left`: buys left in its period. */
  why: Record<string, ShopWhy>;
  left: Record<string, number>;
  /** Offers priced by her state (the infirmary), or by the live ops' panel (docs/34: its own price, a sale). */
  price: Record<string, number>;
  /** A sale of the live ops' panel on an offer: its share off, its end (wall ms), the price before it. */
  sale?: Record<string, { pct: number; until: number; was: number }>;
  /** The deal of the day: the offer and its price, bought or not. */
  deal: { id: string; price: number; why: ShopWhy | null };
  /** A level's gift on the shelf now: its family id and when it goes. */
  gifts: { id: string; until: number }[];
  /** Her stores: minutes of speed-ups, repair kits, charms, charters of removal. */
  inv: { speed: number; kits: number; charms: number; moves: number; /** docs/35: scrolls of resurrection */ rs?: number };
  /** Until when (wall ms; 0: not running): the elixir, the fair wind, the harvest, the island's charter, the subscription. */
  boosts: { xp: number; wind: number; prod: number; shield: number; sub: number };
  /** Her builders (null: no island): the island's own, hers for good, hired (their ends), the subscription's. */
  crews: { base: number; perm: number; temp: number[]; sub: number; n: number; busy: number } | null;
  /** The work under way on her island, and the yard's refit. */
  jobs: ShopJobView[];
  /** The infirmary: her fallen to bring back and until when. */
  fallen: { n: number; until: number } | null;
  /** The first top-up for Stars comes double (FIRST_PAY_CAP): not yet paid; its gift waiting to be claimed. */
  firstPay: boolean;
  gift: number;
}

export type PremiumClientMsg =
  | { t: 'premium'; action: 'view' }
  | { t: 'premium'; action: 'buy_ship'; id: ShipClassId }
  /** A pack of auto-battle scrolls for doubloons (AUTO_SCROLL_PACKS, owner 2026-10-11). */
  | { t: 'premium'; action: 'buy_scrolls'; pack: string }
  /** The shop's offers (owner, 2026-10-15): bought by its id and a purchase id of the client's own (a second message
   *  with the same id buys nothing more). */
  | { t: 'premium'; action: 'shop'; offer: string; pid: string }
  /** A premium creature by threes and fives (UNIT_PACKS). */
  | { t: 'premium'; action: 'buy_unit'; id: UnitId; k?: number; pid?: string }
  /** Her stores used: minutes of speed-ups on a job (-1: the refit), doubloons to finish one now, a repair kit. */
  | { t: 'premium'; action: 'speed'; job: number }
  | { t: 'premium'; action: 'finish'; job: number; pid: string }
  | { t: 'premium'; action: 'kit' }
  /** The first top-up's gift claimed. */
  | { t: 'premium'; action: 'gift' }
  /** Her personal offers (owner, 2026-10-15; server/src/game/promo.ts): the view, the entry carousel seen, one bought at
   *  its own price, one closed in a place, one seen in a place (the owner's figures). */
  | { t: 'premium'; action: 'promo_view' | 'promo_carousel' }
  | { t: 'premium'; action: 'promo_buy'; id: string; pid: string }
  | { t: 'premium'; action: 'promo_close' | 'promo_seen'; id: string; where: PromoPlace }
  /** A pack of the top-up for Telegram Stars: the server answers with the invoice's link (owner, 2026-10-11). */
  | { t: 'premium'; action: 'stars'; pack: string; lang?: 'en' | 'ru' }
  /** The web game's top-up (owner, 2026-10-21): a pack paid through YooKassa for her own account (the browser only —
   *  Telegram keeps Stars, VK its votes); its order's payment asked about again (server/src/game/webshop.ts). */
  | { t: 'premium'; action: 'checkout'; pack: string; lang?: 'en' | 'ru' }
  | { t: 'premium'; action: 'checkout_check'; order: string }
  /** The daily login gift (owner, 2026-10-16; server/src/game/dailygift.ts): her calendar asked for, today's gift taken. */
  | { t: 'premium'; action: 'gift_view' | 'gift_claim' }
  /** Her Telegram notices (server/src/game/tgnotify.ts): all of them or one kind on or off; a notice's button tapped
   *  (the Mini App opened from it). */
  | { t: 'premium'; action: 'tgn_set'; cat: TgnCat | 'all'; on: boolean; lang?: 'en' | 'ru' }
  | { t: 'premium'; action: 'tgn_view' }
  | { t: 'premium'; action: 'tgn_click'; cat: string };

export type PremiumServerMsg =
  /** The shop as she sees it now. */
  | { t: 'premium'; view: PremiumView }
  /** Her personal offers and the shop's specials for her (owner, 2026-10-15: promo.ts). */
  | { t: 'promo'; view: PromoView }
  /** Her daily login calendar (owner, 2026-10-16): on coming aboard, at a new day and after a claim. */
  | { t: 'gift'; view: GiftView; /** what the claim just handed over */ got?: Gift }
  /** Her Telegram notices' switches (only for a captain with Telegram linked). */
  | { t: 'tgn'; view: TgnView }
  /** Her account's doubloons: on coming aboard and after every change. */
  | { t: 'doubloons'; n: number; /** Her auto-battle scrolls (owner, 2026-10-11). */ scrolls?: number }
  /** The Telegram Stars invoice for a pack (server/src/telegram.ts): opened in the Mini App by openInvoice, on the
   *  website as a link (it opens Telegram). Null link: it could not be made (a toast says why). */
  | { t: 'premium_invoice'; pack: string; link: string | null }
  /** The web game's YooKassa checkout: its page to open (null: none — a toast says why), its order; or, asked again, how
   *  the order stands (`pending` | `paid` | `done` | `canceled` | `failed`). */
  | { t: 'premium_checkout'; pack: string; url: string | null; order?: string; status?: string }
  /** The captains' choice before she has one (owner, 2026-10-19): the premium captains her account owns, her doubloons
   *  and whether the top-up takes payments. `bought`: the captain just bought (the choice may go on); `why`: a refusal (the server's words). */
  | { t: 'captain_shop'; owned: CaptainId[]; balance: number; pay: boolean; web?: boolean; bought?: CaptainId; why?: string };

// ------------------------------------------------------------------------------------------------ personal offers

/** Owner, 2026-10-15: «нужно везде продвигать свои пакеты с обратным отсчетом … на острове … для острова, в море - на
 *  море и абордажные пакеты … с возможностью закрыть офферы. и при входе в игру разворачивать офферы». */
export type PromoCtx = 'isle' | 'sea' | 'board';
/** Where a card is shown: the entry carousel, the island's scene, the sea's chip, the harbour's strip, a boarding's end. */
export type PromoPlace = 'entry' | 'isle' | 'sea' | 'port' | 'board';

export interface PromoCard {
  /** `po<n>`: a personal offer; `sp:<offer>`: one of the shop's specials (`sp:first`: the first top-up's double). */
  id: string;
  /** The shop's offer it sells ('' for the first top-up). */
  offer: string;
  ctx: PromoCtx | 'all';
  /** Its price now, the shop's own before the discount, the discount in percent. */
  price: number;
  was: number;
  off: number;
  /** Until when (wall ms; 0: no end of its own). */
  until: number;
  /** Why it cannot be bought now (the purse aside). */
  why: ShopWhy | null;
  /** The places it was closed in (it hides there). */
  closed: PromoPlace[];
  /** `global`: a limited-time offer of the live ops' panel for every captain (id `gl:<id>`; docs/34). */
  special?: 'starter' | 'level' | 'first' | 'weekly' | 'sub' | 'global';
}

export interface PromoView {
  now: number;
  cards: PromoCard[];
  /** The entry carousel is due (once a day). */
  carousel: boolean;
}
