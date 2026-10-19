// The website's shop (owner, 2026-10-20: «магазин сделать типа как мы сделали на fovgame.com чтобы оставил ник, купил и
// купил»): a captain's name, a thing, the payment — and the thing is on her account, through the same doors the game's
// own purchases go through (server/src/game/webshop.ts). This is its catalogue: what the site sells and for how many
// roubles. The server takes every price from here (or, for the shop's own offers, from the shop's table as the live
// ops have it), never from the page.
//
//  - the doubloon packs of the top-up (DOUBLOON_PACKS: 290 · 590 · 990 · 1 990 · 4 990 · 9 900 ₽, the same bonus);
//  - the premium captains (CAPTAIN_PRICE, 2 490 ₽ — a doubloon is a rouble, docs/32 §1);
//  - the cosmetic bundles (shared/src/data/cosmetics.ts BUNDLES: «Наряд капитана» and the seasonal ones while their
//    dates run);
//  - the shop's own offers the shop marks (the «Акции» row: the starter chest «hot», the subscription «best», the week's
//    chest) — the ones whose goods are the account's alone, so they reach a captain who is not aboard.

import { CAPTAINS, CAPTAIN_IDS, CAPTAIN_PRICE } from './captains.ts';
import type { CaptainId } from './captains.ts';
import { BUNDLES } from './cosmetics.ts';
import { DOUBLOON_PACKS } from './premium.ts';
import { OFFERS } from './shop.ts';

type Tr = [string, string];

export type WebKind = 'pack' | 'captain' | 'bundle' | 'offer';

export interface WebItem {
  /** `d290` (a pack), `cap_drowned` (a captain), `cos_starter` (a bundle), `starter` (a shop offer). */
  id: string;
  kind: WebKind;
  /** The catalogue's price in roubles (a shop offer's may be the live ops' own at the time of the order). */
  rub: number;
  name: Tr;
  text: Tr;
  /** The picture: an asset id of the manifest (icon.…, portrait.…). */
  art: string;
  /** A pack's doubloons with its bonus. */
  doubloons?: number;
  bonus?: number;
  /** A captain's id. */
  captain?: CaptainId;
  /** The shop's offer it is (a bundle's or a shop offer's id). */
  offer?: string;
  /** Bought once only (a captain, a bundle, the starter chest). */
  once?: boolean;
  /** On sale only between these (wall ms, UTC). */
  from?: number;
  until?: number;
  /** The card's ribbon. */
  tag?: 'best' | 'hot';
}

/** The shop's own offers on the site (the «Акции» row the shop marks). */
export const WEB_SHOP_OFFERS = ['starter', 'sub30', 'weekly'] as const;

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const CAPTAIN_RU: Record<string, Tr> = {
  drowned: ['Ilse Harrow, the Drowned Captain', 'Ильзе Харроу, Утопленница'],
  admiral: ['Cassius Dray, the Black Admiral', 'Кассий Дрей, Чёрный адмирал'],
};

function build(): WebItem[] {
  const out: WebItem[] = [];
  for (const p of DOUBLOON_PACKS) {
    const n = p.n + p.bonus;
    out.push({
      id: p.id, kind: 'pack', rub: p.n, doubloons: n, bonus: p.bonus, art: 'icon.doubloon',
      name: [`${fmt(n)} doubloons`, `${fmt(n)} дублонов`],
      text: p.bonus
        ? [`${fmt(p.n)} doubloons and ${fmt(p.bonus)} more on top.`, `${fmt(p.n)} дублонов и ещё ${fmt(p.bonus)} сверху.`]
        : ['Doubloons for the premium shop: hulls, creatures, speed-ups and looks.', 'Дублоны для премиум-лавки: корабли, существа, ускорения и облики.'],
      ...(p.id === 'd1990' ? { tag: 'best' as const } : {}),
    });
  }
  for (const id of CAPTAIN_IDS) {
    const c = CAPTAINS[id];
    if (!c.premium) continue;
    out.push({
      id: `cap_${id}`, kind: 'captain', rub: CAPTAIN_PRICE, captain: id, once: true, art: c.portrait,
      name: CAPTAIN_RU[id] ?? [c.name, c.name],
      text: ['A premium captain for your account: chosen when you start a new captain, for good.', 'Премиум-капитан на ваш счёт: выбирается при создании капитана, навсегда.'],
    });
  }
  for (const b of BUNDLES) {
    out.push({
      id: b.id, kind: 'bundle', rub: b.price, offer: b.id, once: true, art: `icon.${b.icon}`, name: b.name, text: b.text,
      ...(b.from !== undefined ? { from: b.from, until: b.until } : {}),
      ...(b.id === 'cos_starter' ? { tag: 'hot' as const } : {}),
    });
  }
  for (const id of WEB_SHOP_OFFERS) {
    const f = OFFERS.get(id);
    if (!f) continue;
    out.push({
      id, kind: 'offer', rub: f.offer.price, offer: id, art: `icon.${f.fam.icon}`, name: f.fam.name, text: f.fam.text,
      ...(f.offer.limit?.per === 'ever' ? { once: true } : {}),
      ...(f.offer.tag ? { tag: f.offer.tag } : {}),
    });
  }
  return out;
}

export const WEB_ITEMS: WebItem[] = build();
const BY_ID = new Map(WEB_ITEMS.map((x) => [x.id, x]));

/** The item of this id (an own key only: `__proto__` and its kin are nothing). */
export function webItem(id: unknown): WebItem | undefined {
  return typeof id === 'string' && id.length <= 40 ? BY_ID.get(id) : undefined;
}

/** On sale at this wall time (a seasonal bundle only between its dates). */
export function webOnSale(x: WebItem, wall: number): boolean {
  return (x.from === undefined || wall >= x.from) && (x.until === undefined || wall < x.until);
}

/** A captain's name as the site takes it: trimmed, inner spaces single, 2–24 characters of letters, digits, spaces and
 *  `_ - ' .` (null: not a name at all — no lookup is spent on it). */
export function cleanCaptainName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.normalize('NFC').trim().replace(/\s+/g, ' ');
  return s.length >= 2 && s.length <= 24 && /^[\p{L}\p{N} _'.-]+$/u.test(s) ? s : null;
}

/** Russian forms of the in-game toast of a delivery from the site (client/src/lang/server.ts). */
export function webPatterns(): [string, string][] {
  return [
    ['Web shop purchase: {0} doubloons.', 'Покупка с сайта: {0} дубл.'],
    ['Web shop purchase: {0}.', 'Покупка с сайта: {0}.'],
    ...WEB_ITEMS.filter((x) => x.kind !== 'pack').map((x) => [x.name[0], x.name[1]] as [string, string]),
  ];
}
