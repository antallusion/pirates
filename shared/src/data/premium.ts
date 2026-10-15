// The premium shop (owner, 2026-10-03; docs/01 P7 as it now stands): doubloons are bought with real money only and are
// never earned at sea. They buy the hulls and the creatures their own tables mark `premium` (ShipClassDef.premium,
// UnitDef.premium) — and nothing else in the game hands those out: no yard sells such a hull for silver, and no tamer,
// lair, drift, roaming stack, capture nor egg gives such a creature. The balance is the account's, not a captain's.

import { UNITS } from './army.ts';
import type { PremiumUnit, UnitId } from './army.ts';
import { DRIFTS, DRIFT_KINDS } from './drifts.ts';
import { LAIRS, LAIR_KINDS } from './lairs.ts';
import { ROAMS, ROAM_KINDS } from './roamers.ts';
import { isShipBeast } from './shipbeasts.ts';
import { SHIP_CLASSES, SHIP_CLASS_IDS } from './ships.ts';
import type { PremiumShip, ShipClassId } from './ships.ts';

/** The doubloon's picture: `icon.doubloon` once it is painted; the silver coins, gilded, stand in for it meanwhile. */
export const DOUBLOON_ICON = 'doubloon';

/** A pack of the top-up: its doubloons, the bonus on top and its price in Telegram Stars (XTR, owner 2026-10-11:
 *  «премиум шоп сделай звездами»). */
export interface DoubloonPack {
  id: string;
  n: number;
  bonus: number;
  /** The price in Telegram Stars: ¾ of a star a doubloon (the bonus is on top, free). */
  stars: number;
}

/** The rate of the top-up (kept from 2026-10-11): ¾ of a star a doubloon of the pack's own (the bonus is on top, free) —
 *  a star is about 1.3 roubles to a buyer, so a doubloon is about a rouble. */
export const STARS_PER_DOUBLOON = 0.75;
const pack = (rub: number, bonus: number): DoubloonPack => ({ id: `d${rub}`, n: rub, bonus, stars: Math.round(rub * STARS_PER_DOUBLOON) });

/** The tiers of the top-up (owner, 2026-10-15: «цены должны начинаться от 290 рублей и до 9900 рублей»): 290 · 590 ·
 *  990 · 1 990 · 4 990 · 9 900 roubles' worth of doubloons, the bonus growing — none, 5 %, 10 %, 20 %, 30 %, 40 %. */
export const DOUBLOON_PACKS: DoubloonPack[] = [pack(290, 0), pack(590, 30), pack(990, 100), pack(1990, 400), pack(4990, 1500), pack(9900, 4000)];

/** The packs before 2026-10-15: no longer sold, still honoured for an invoice made before the change and paid after. */
const LEGACY_PACKS: DoubloonPack[] = [
  { id: 'd100', n: 100, bonus: 0, stars: 75 },
  { id: 'd550', n: 500, bonus: 50, stars: 375 },
  { id: 'd1200', n: 1000, bonus: 200, stars: 750 },
  { id: 'd2600', n: 2000, bonus: 600, stars: 1500 },
  { id: 'd7000', n: 5000, bonus: 2000, stars: 3750 },
];

/** The pack of this id, if there is one (a sold one, or one of an invoice made before the tiers changed). */
export function doubloonPack(id: string): DoubloonPack | undefined {
  return DOUBLOON_PACKS.find((p) => p.id === id) ?? LEGACY_PACKS.find((p) => p.id === id);
}

// ------------------------------------------------------------------------------------------------ the auto-battle scroll

/** «Свиток автобоя» (owner, 2026-10-11: «автобой в абордаже только специальной премиум свитками, которую можно за дублоны
 *  купить»): a consumable of the account, sold only for doubloons. One is spent the moment her «Авто» (or a quick fight
 *  that is not the free one against a clearly weaker ship of the sea) is first given in a battle: the sea's mind fights
 *  her side to the end of that battle; she may take the helm back at any time, and «Авто» again in the same battle
 *  costs nothing more — the scroll is the battle's, never refunded. */
export interface ScrollPack {
  id: string;
  /** Scrolls in the pack. */
  n: number;
  /** Its price in doubloons. */
  price: number;
}

/** The scrolls in the shop's ladder (owner, 2026-10-15: from 290): 15 · 32 · 59 · 130 for 290 · 590 · 990 · 1 990 doubloons
 *  — about 19, 18, 17 and 15 a scroll; the same as the shop's «Свитки автобоя» (shared/src/data/shop.ts). A scroll is a
 *  convenience, never a hull's worth: it wins nothing the captain's own hand would not (the same rules, the same dice). */
export const AUTO_SCROLL_PACKS: ScrollPack[] = [
  { id: 'scroll15', n: 15, price: 290 },
  { id: 'scroll32', n: 32, price: 590 },
  { id: 'scroll59', n: 59, price: 990 },
  { id: 'scroll130', n: 130, price: 1990 },
];

/** The pack of scrolls of this id, if there is one. */
export function scrollPack(id: string): ScrollPack | undefined {
  return AUTO_SCROLL_PACKS.find((p) => p.id === id);
}

/** The scroll's picture: the sealed scroll of the order book's letters (an existing icon, no new art). */
export const AUTO_SCROLL_ICON = 'tab_contracts';

/** The one free source (docs/25 §5, 2026-10-11): a seal of the deep of this level or more won in time gives a single
 *  scroll, once a week a captain — a top seal's trophy, four or five a month at the very most, never a supply. */
export const SEAL_SCROLL_LV = 10;

/** Payments are closed by default: the server opens them at run time when a payment desk is wired in — the Telegram
 *  bot's Stars, once TELEGRAM_BOT_TOKEN is configured (server/src/telegram.ts → setPayDesk; the view's `pay`). */
export const PAYMENTS_OPEN = false;

/** The most one credit may bring (a slip in a webhook or the console cannot mint a fortune). */
export const CREDIT_MAX = 1_000_000;

const byPrice = <T>(price: (x: T) => number) => (a: T, b: T) => price(a) - price(b);

/** Every hull the shop sells, the cheapest first. */
export function premiumShips(): ShipClassId[] {
  return SHIP_CLASS_IDS.filter((c) => SHIP_CLASSES[c].premium).sort(byPrice((c) => SHIP_CLASSES[c].premium!.price));
}

/** Every kind the shop sells, the cheapest first. A premium hull's own kind (shared/src/data/shipbeasts.ts) is premium
 *  too — no free source hands it out — but it is had only aboard its hull, never off the shelf. */
export function premiumUnits(): UnitId[] {
  return (Object.keys(UNITS) as UnitId[]).filter((u) => UNITS[u].premium && !isShipBeast(u)).sort(byPrice((u) => UNITS[u].premium!.price));
}

/** The free tables that would hand out a premium kind (a lair's brood, a drift, a roaming stack) or a premium hull a
 *  yard would sell for silver — none, while the catalogue is kept as it must be (tests/premium.test.ts). The tamer's
 *  pens and the beaten's offer pass a premium kind over as they are drawn. */
export function premiumLeaks(): string[] {
  const out: string[] = [];
  for (const k of LAIR_KINDS) for (const [u] of LAIRS[k].mix) if (UNITS[u]?.premium) out.push(`lair ${k}: ${u}`);
  for (const k of DRIFT_KINDS) if (UNITS[DRIFTS[k].u]?.premium) out.push(`drift ${k}: ${DRIFTS[k].u}`);
  for (const k of ROAM_KINDS) if (UNITS[ROAMS[k].u]?.premium) out.push(`roam ${k}: ${ROAMS[k].u}`);
  for (const c of SHIP_CLASS_IDS) if (SHIP_CLASSES[c].premium && SHIP_CLASSES[c].purchasable) out.push(`yard ${c}`);
  return out;
}

/** The tester's sample (`/doubloons sample`, admin servers only): two hulls and two kinds priced as if they were premium,
 *  so the shop's cards can be seen and bought before the real catalogue is filled. The tables themselves stay unmarked. */
export const PREMIUM_SAMPLE: { ships: Partial<Record<ShipClassId, PremiumShip>>; units: Partial<Record<UnitId, PremiumUnit>> } = {
  ships: {
    xebec: { price: 2190, note: ['Tester’s sample: sweeps that row her through a calm.', 'Образец для теста: вёсла выводят её из штиля.'] },
    bomb_ketch: { price: 3490, note: ['Tester’s sample: twin mortar wells, and sea turtles aboard.', 'Образец для теста: две мортирные шахты и морские черепахи на борту.'], beasts: [{ u: 'sea_turtle', n: 4 }] },
  },
  units: {
    sea_turtle: { price: 180, n: 8, note: ['Tester’s sample: a shell that shrugs off shot.', 'Образец для теста: панцирь, которому нипочём картечь.'] },
    mermaid: { price: 250, n: 6, note: ['Tester’s sample: shoots from the surf and dives out of reach.', 'Образец для теста: стреляет из прибоя и уходит под воду.'] },
  },
};
