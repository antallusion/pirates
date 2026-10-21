// The shop's prices in real money first (owner, 2026-10-18: «все предложения в магазине должны иметь в первую очередь
// цену в рублях или в звездах и только рядом цену в дублонах»). Display only: every offer is still bought with
// doubloons at the server's price (docs/32), and 1 doubloon ≈ 1 ₽ on the ladder 290–9 900 — so a price of N doubloons
// reads «N ₽ · N ◉» on the website and, in the Telegram Mini App, «round(N × ¾) ⭐ · N ◉» (the top-up's own rate,
// STARS_PER_DOUBLOON). Short of doubloons, a Buy tops up the smallest tier that covers the gap (Stars, through the
// server's invoice) and, the doubloons come in, completes the purchase by itself.

import { DOUBLOON_PACKS, STARS_PER_DOUBLOON } from '../../../shared/src/data/premium.ts';
import type { DoubloonPack } from '../../../shared/src/data/premium.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/premium.ts';
import { inTelegram, starIcon } from '../tg.ts';
import { inVk, vkBuy, vkPayOpen } from '../vk.ts'; // VK's votes (docs/36)
import { packVotes, votesOf, votesText, votesWord } from '../../../shared/src/data/vk.ts';
import { ask } from './confirm.ts';
import { webPayOpen } from '../checkout.ts'; // the web game's YooKassa (owner, 2026-10-21)
import { esc, fmt, icon } from './dom.ts';

const L = dict(EN, RU);

/** What real money the captain sees: roubles on the website, Telegram Stars in the Mini App, VK votes in VK's
 *  (docs/36: a vote is 7 ₽ to a buyer — shared/src/data/vk.ts). */
export type PayIn = 'rub' | 'stars' | 'votes';

/** Votes inside VK (html.vk-app as vk.ts sets it), Stars inside Telegram (its launch data, or html.tg-app), roubles
 *  elsewhere. */
export function payIn(): PayIn {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('vk-app')) return 'votes';
  if (inVk()) return 'votes';
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('tg-app')) return 'stars';
  return inTelegram() ? 'stars' : 'rub';
}

/** Whether a top-up can be paid here: in VK by its votes (the server takes VK's callback), in the browser by YooKassa (or,
 *  before its keys are set, Stars by a link as before), in Telegram as the server says. */
export function payOpen(serverPay: boolean): boolean {
  const cur = payIn();
  return cur === 'votes' ? vkPayOpen() : cur === 'rub' ? webPayOpen() || serverPay : serverPay;
}

/** The browser's top-up goes through YooKassa (checkout.ts): roubles here, and the server's checkout open to her. */
export const viaCheckout = (): boolean => payIn() === 'rub' && webPayOpen();

/** A price of `dbl` doubloons in real money: roubles one to one, Stars at the top-up's rate (¾ a doubloon), votes at
 *  seven roubles a vote. */
export function realOf(dbl: number, cur: PayIn): number {
  return cur === 'stars' ? Math.round(dbl * STARS_PER_DOUBLOON) : cur === 'votes' ? votesOf(dbl) : Math.round(dbl);
}

/** The real money's words: «290 ₽», «218 ⭐», «41 голос». */
export function realText(dbl: number, cur: PayIn = payIn()): string {
  if (cur === 'votes') return votesText(realOf(dbl, cur), lang() === 'ru' ? 'ru' : 'en');
  return `${fmt(realOf(dbl, cur))} ${cur === 'stars' ? '⭐' : '₽'}`; // (signs, not words: the same in both languages)
}

/** The whole price in words (a question, a title, the screen reader): «290 ₽ · 290 ◉», «218 ⭐ · 290 ◉». */
export function priceText(dbl: number, cur: PayIn = payIn()): string {
  return `${realText(dbl, cur)} · ${fmt(dbl)} ◉`;
}

/** The doubloon: its own picture once painted, the silver coins gilded meanwhile. */
export function doubloonIcon(cls = 'ico-sm'): string {
  return assetUrl('icon.doubloon') ? icon('doubloon', '◉', cls) : icon('coin', '◉', `${cls} dbl-gild`);
}

/** The real money drawn: «290 ₽», or Telegram's star and «218». */
export function realHtml(dbl: number, cur: PayIn = payIn()): string {
  // (VK's votes: «41 голос», the word declined — shared/src/data/vk.ts)
  // (the number and its word apart, so a narrow button puts the word under the number: shop.css .rp-vw)
  if (cur === 'votes') {
    const n = realOf(dbl, cur);
    const l = lang() === 'ru' ? 'ru' : 'en';
    return `${esc(n.toLocaleString(l === 'ru' ? 'ru-RU' : 'en-US'))} <span class="rp-vw">${esc(votesWord(n, l))}</span>`;
  }
  return cur === 'stars' ? `${starIcon()}${fmt(realOf(dbl, cur))}` : `${fmt(realOf(dbl, cur))} ₽`;
}

/** A price as the shop draws it: the real money first and bold, the doubloons beside it, smaller
 *  (`rp-real` / `rp-dbl`; styles in shop.css). `was`: the old price struck through before it. */
export function priceHtml(dbl: number, o: { cur?: PayIn; cls?: string; was?: number } = {}): string {
  const cur = o.cur ?? payIn();
  const money = (n: number) => realHtml(n, cur);
  const was = o.was && o.was > dbl ? `<s class="rp-was">${money(o.was)}</s>` : '';
  const real = money(dbl);
  return `<span class="rp${o.cls ? ` ${o.cls}` : ''}" title="${esc(priceText(dbl, cur))}">${was}<b class="rp-real">${real}</b><span class="rp-dbl">${doubloonIcon('ico-xs')}${fmt(dbl)}</span></span>`;
}

// ------------------------------------------------------------------------------------------------ short of doubloons

/** The smallest tier of the top-up whose doubloons (its bonus with them) cover `need`; the largest when none does. */
export function packFor(need: number): DoubloonPack {
  return DOUBLOON_PACKS.find((p) => p.n + p.bonus >= need) ?? DOUBLOON_PACKS[DOUBLOON_PACKS.length - 1];
}

/** An offer's price as the shop's view model holds it: the real money, the doubloons, and — short of them — how
 *  many are missing and the tier that tops them up (its real price: its Stars in Telegram, its roubles elsewhere). */
export interface PriceView {
  dbl: number;
  real: number;
  cur: PayIn;
  text: string;
  /** Doubloons missing (0: she can pay). */
  short: number;
  /** The tier to top up when short. */
  pack: DoubloonPack | null;
}

export function priceView(dbl: number, balance: number, cur: PayIn = payIn()): PriceView {
  const short = Math.max(0, Math.ceil(dbl - balance));
  return { dbl, real: realOf(dbl, cur), cur, text: priceText(dbl, cur), short, pack: short > 0 ? packFor(short) : null };
}

/** A tier's own price: its Stars in Telegram (what the invoice asks), its roubles elsewhere (its doubloons, one to one). */
export function packPrice(p: DoubloonPack, cur: PayIn = payIn()): string {
  // (in VK: what VK's order box asks, in votes)
  if (cur === 'votes') return votesText(packVotes(p), lang() === 'ru' ? 'ru' : 'en');
  return cur === 'stars' ? `${fmt(p.stars)} ⭐` : `${fmt(p.n)} ₽`;
}

/** A purchase waiting for its top-up: sent once the doubloons are there (within 15 minutes of the ask). */
interface Pending {
  need: number;
  msg: ClientMsg;
  name: string;
  until: number;
}
let pending: Pending | null = null;
const WAIT_MS = 15 * 60_000;
const STASH = 'gravetide.pendingBuy';

/** The waiting purchase kept over the YooKassa page opened in place of the game (checkout.ts), and taken back on return. */
export function stashPending(): void {
  try {
    if (pending) sessionStorage.setItem(STASH, JSON.stringify(pending));
  } catch { /* no storage */ }
}
try {
  const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STASH) : null;
  if (raw) {
    sessionStorage.removeItem(STASH);
    const p = JSON.parse(raw) as Pending;
    if (p && typeof p.need === 'number' && p.msg && p.until > Date.now()) pending = p;
  }
} catch { /* no storage */ }

/** The purchase waiting now (tests, the QA). */
export const pendingBuy = (): Readonly<Pending> | null => (pending && pending.until > Date.now() ? pending : null);
export const dropPending = (): void => void (pending = null);

/** A purchase to send once the account holds `need` doubloons (topUpThenBuy, after the invoice is asked for). */
export function waitForTopUp(need: number, msg: ClientMsg, name: string, now = Date.now()): void {
  pending = { need, msg, name, until: now + WAIT_MS };
}

/** The account's doubloons heard (main.ts, a `doubloons` message): a waiting purchase that can now be paid is sent —
 *  once; true when it went. */
export function heardDoubloons(n: number, send: (m: ClientMsg) => void, toast?: (msg: string, kind: string) => void, now = Date.now()): boolean {
  const p = pending;
  if (!p) return false;
  if (p.until <= now) {
    pending = null;
    return false;
  }
  if (n < p.need) return false;
  pending = null;
  send(p.msg);
  toast?.(L('short.done', { name: p.name }), 'good');
  return true;
}

// a Stars invoice closed unpaid (tg.ts): the purchase waits no longer
if (typeof addEventListener === 'function') {
  addEventListener('gravetide:pay', (e) => {
    const st = (e as CustomEvent<string>).detail;
    if (st === 'cancelled' || st === 'failed') pending = null;
  });
}

/** A Buy with too few doubloons (owner, 2026-10-18): the question names what is missing and the tier that covers it;
 *  yes — that tier's Stars invoice is asked for (payments open: `pay`) and the purchase waits for the doubloons, or the
 *  top-up's page opens (payments not open yet). Nothing is paid without the captain's own tap in Telegram's sheet. */
export async function topUpThenBuy(o: { price: number; balance: number; name: string; msg: ClientMsg; pay: boolean; send: (m: ClientMsg) => void; openTopup: () => void; toast?: (msg: string, kind: string) => void }): Promise<boolean> {
  const v = priceView(o.price, o.balance);
  if (!v.short || !v.pack) return false;
  const p = v.pack;
  const pay = payOpen(o.pay);
  const text = L('short.ask', { name: o.name, n: fmt(v.short), pack: fmt(p.n + p.bonus), price: packPrice(p) });
  const ok = await ask(text, L(pay ? 'short.go' : 'short.open'), L('short.no'));
  if (!ok) return false;
  if (!pay) {
    o.openTopup();
    return true;
  }
  waitForTopUp(o.price, o.msg, o.name);
  // in VK: VK's own order box for the tier (its answer, read defensively, ends the wait when unpaid — vk.ts)
  if (payIn() === 'votes') {
    void vkBuy(p.id, o.toast);
    return true;
  }
  // in the browser: YooKassa for her own account (checkout.ts opens its page)
  if (viaCheckout()) {
    o.send({ t: 'premium', action: 'checkout', pack: p.id, lang: lang() === 'ru' ? 'ru' : 'en' });
    return true;
  }
  o.send({ t: 'premium', action: 'stars', pack: p.id, lang: lang() === 'ru' ? 'ru' : 'en' });
  return true;
}
