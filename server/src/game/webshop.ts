// The website's shop on the server (owner, 2026-10-20: «магазин сделать типа как мы сделали на fovgame.com чтобы оставил
// ник, купил и купил»; /site/shop/, the API in server/src/http/site-routes.ts). Three steps, no sign-in:
//  1. a captain's name: her account is found (the hidden — banned, test and bot accounts — are «not found»), with what
//     of the catalogue she has already (a captain, a bundle, the starter chest are bought once);
//  2. a thing of the catalogue (shared/src/data/webshop.ts): its price is the server's, never the page's;
//  3. the payment: an order is written (kv `weborder:<id>`) BEFORE the provider is asked, then the buyer goes to its page.
// The provider's word (the webhook, or the return page's polling) is checked by fetching the payment again from the
// provider; a succeeded payment of the order's amount is delivered ONCE, through the game's own doors:
//  - its roubles come in as doubloons the way a Telegram Stars payment does (premium.ts payIn: `doubloons_pay`, the
//    reference `web:<order>`, the first top-up's double, the live ops' revenue) — a pack's doubloons with its bonus;
//  - a thing is then bought with them as the game buys it: a captain by captainshop.ts buyCaptainFor (its ledger row
//    `doubloons_captain`), a bundle or a shop offer by shop.ts buyForAccount (`doubloons_buy` `shop:web:<order>`) — so
//    if it can no longer be had (bought in the game meanwhile), the doubloons stay on her account, nothing is lost;
//  - a hull (premium.ts buyShip, in port), creatures (buyUnit, out of a fight) and the shop's goods that go into her ship
//    (her magazine, her hold, her book, her chest of maps) need her aboard, as in the game: paid while she is ashore or
//    at sea, the order WAITS (kv `webwait`), and is delivered by the same purchase the moment she logs in, makes port or
//    is out of the fight — the doubloons come in only then, so nothing waits half-done (docs/32 §13.4);
//  - aboard, she hears it at once: «Покупка с сайта: …».
// Idempotent: the order's status moves pending → paid → done once (the delivery runs without a pause between the check
// and the write), and the ledger's references refuse a second credit or a second buy even if a delivery is resumed.
//
// Without YooKassa's keys the shop runs in its TEST MODE: no money moves, the «checkout» is this server's own page, and
// it opens only with GRAVETIDE_PAY_TEST=1 or for the site's admin accounts (SITE_ADMINS, else FORUM_ADMINS).

import { randomBytes } from 'node:crypto';
import { OFFERS, LEVEL_OFFER_H, dayOf, dealOf } from '../../../shared/src/data/shop.ts';
import { shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import { WEB_ITEMS, cleanCaptainName, dealItem, webItem, webOnSale } from '../../../shared/src/data/webshop.ts';
import type { WebItem } from '../../../shared/src/data/webshop.ts';
import type { PremiumWhy, ShopWhy } from '../../../shared/src/premiumproto.ts';
import type { PayProvider, VerifiedPayment } from '../pay/yookassa.ts';
import { TestPay } from '../pay/yookassa.ts';
import { landFighting } from './beastlairs.ts';
import { buyCaptainFor, ownsCaptain } from './captainshop.ts';
import type { Game } from './Game.ts';
import { opsPrice, opsShut } from './liveops.ts';
import type { PlayerSession } from './player.ts';
import { buyShip, buyUnit, payIn, sendBalance, sendPremium, shipWhy, unitOffer, unitWhy } from './premium.ts';
import { refitHolds } from './refit.ts';
import { MAX_BERTHS } from './shipbuilding.ts';
import { accountOfferWhy, buyForAccount, shopState } from './shop.ts';

export type OrderStatus = 'pending' | 'paid' | 'done' | 'canceled' | 'failed';
/** What a paid order of a thing for her ship waits for: her logging in, her making port, the fight's end. */
export type OrderWait = 'login' | 'port' | 'fight';

export interface WebOrder {
  id: string;
  acc: number;
  name: string;
  item: string;
  /** The deal of the day's own offer (its day may be over by the payment: the order keeps what was sold). */
  offer?: string;
  rub: number;
  lang: 'ru' | 'en';
  provider: 'yookassa' | 'test';
  status: OrderStatus;
  /** The provider's payment id. */
  pid?: string;
  at: number;
  paidAt?: number;
  doneAt?: number;
  /** Paid, and waiting for the captain to take it aboard. */
  wait?: OrderWait;
  /** Why a thing was not handed over (its doubloons kept on the account instead), or why the order failed. */
  note?: string;
}

/** Why a thing cannot be bought for her now (the site says it on the card): hers already, a once-only thing had, its
 *  limit reached for now, at its cap, not on sale, out of its season, her level not there yet (a level's gift, a hull),
 *  no island for it, her ship's level too low, no slot or hammocks, the hold full, three ships berthed, the very class
 *  she sails, the first brigade first, nothing for it to do. */
export type Unavailable = 'owned' | 'claimed' | 'limit' | 'max' | 'gone' | 'season' | 'level' | 'island' | 'tier' | 'slot' | 'room' | 'hold' | 'berths' | 'yours' | 'order' | 'none' | 'deep';

export type OrderError = 'bad_name' | 'not_found' | 'bad_item' | Unavailable | 'email' | 'test_only' | 'rate' | 'provider';

export interface WebShopOptions {
  /** YooKassa (live) or null: the test mode. */
  provider: PayProvider | null;
  /** Where the buyer comes back: …/site/shop/ (the English pages' …/site/en/shop/ is made of it). */
  returnUrl: string;
  /** The site's admins (account ids): the test checkout is theirs even without GRAVETIDE_PAY_TEST. */
  admins?: number[];
  /** The test checkout open to everyone (GRAVETIDE_PAY_TEST=1). */
  payTest?: boolean;
  /** Kept off the site (siterating.ts hidden). */
  hidden?: (accountId: number, name: string) => boolean;
  log?: (s: string) => void;
  now?: () => number;
  /** How often the waiting orders are looked at (ms; 0: never by itself — the tests call pump()). */
  pumpMs?: number;
}

const ORDER_ID = /^[0-9a-f]{24}$/;
const PENDING_MAX = 5;
const WAIT_KEY = 'webwait';

/** The bits of a captain's save the site's checks read. */
interface SavedCaptain {
  captain?: string;
  level?: number;
  infamy?: number;
  loadout?: { classId: string; level?: number };
  berths?: unknown[];
}

export function cleanEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** A refusal of the game's shop as the site words it (null: none, or one that only waits — a fight, the port). */
function fromShop(why: ShopWhy | null, x: WebItem): Unavailable | null {
  switch (why) {
    case null: case 'poor': case 'fight': return null;
    case 'limit': return x.level ? 'claimed' : x.once ? 'owned' : 'limit';
    case 'max': return x.tab === 'cos' ? 'owned' : 'max';
    case 'gone': return x.from !== undefined || x.until !== undefined ? 'season' : 'gone';
    default: return why;
  }
}
function fromPremium(why: PremiumWhy | null): Unavailable | null {
  switch (why) {
    case null: case 'poor': case 'port': case 'refit': case 'fight': return null;
    default: return why;
  }
}

export class WebShop {
  readonly game: Game;
  readonly provider: PayProvider;
  /** The fake provider of the test mode (null when live). */
  readonly test: TestPay | null;
  private o: WebShopOptions;
  private checked = new Map<string, number>();
  /** The waits she has been told of (an order's and its reason), so a wait is said once. */
  private told = new Set<string>();

  constructor(game: Game, o: WebShopOptions) {
    this.game = game;
    this.o = o;
    this.test = o.provider ? null : new TestPay();
    this.provider = o.provider ?? this.test!;
    const ms = o.pumpMs ?? 3000;
    if (ms > 0) setInterval(() => this.pump(), ms).unref();
  }

  get mode(): 'live' | 'test' {
    return this.provider.name === 'yookassa' ? 'live' : 'test';
  }

  private now(): number {
    return (this.o.now ?? Date.now)();
  }

  private log(s: string): void {
    (this.o.log ?? console.log)(s);
  }

  /** What the page needs to know of the shop itself. */
  status(): { mode: 'live' | 'test'; email: boolean; testOpen: boolean } {
    return { mode: this.mode, email: this.provider.needsEmail, testOpen: this.mode === 'test' && !!this.o.payTest };
  }

  /** The deal of the day now: its own offer and its price. */
  private deal(): { offer: string; rub: number } {
    const d = dealOf(dayOf(this.game.wallNow()));
    return { offer: d.offer.id, rub: d.price };
  }

  /** An item as it is sold now (the deal of the day: today's). */
  private today(x: WebItem): WebItem {
    if (x.kind !== 'deal') return x;
    const d = this.deal();
    return dealItem(d.offer, d.rub);
  }

  /** An item's price in roubles now: a shop offer's as the game sells it (the live ops' own, a sale), the deal's, else
   *  the catalogue's. */
  priceOf(x: WebItem): number {
    if (x.kind === 'deal') return this.deal().rub;
    const f = x.offer ? OFFERS.get(x.offer) : undefined;
    return f ? opsPrice(this.game, f.offer) : x.rub;
  }

  /** Taken off the shelves by the live ops' panel (the deal: its own offer). */
  private shut(x: WebItem): boolean {
    const id = x.kind === 'deal' ? this.deal().offer : x.offer;
    return !!id && opsShut(this.game, id);
  }

  /** The whole catalogue now: every item at its price, the deal of the day as today's, a seasonal bundle with its dates
   *  (`off: 'season'` out of them; a past one a month after its end is gone from the page), nothing the live ops took
   *  off the shelves. */
  catalog(): (WebItem & { off?: 'season' })[] {
    const wall = this.game.wallNow();
    return WEB_ITEMS.filter((x) => !this.shut(x) && (x.until === undefined || wall < x.until + 30 * 86_400_000)).map((x) => ({
      ...this.today(x), rub: this.priceOf(x), ...(webOnSale(x, wall) ? {} : { off: 'season' as const }),
    }));
  }

  /** Her captain's save as the site's checks read it: aboard, the live one; else the saved (null: none yet). */
  private saved(acc: number): SavedCaptain | null {
    const live = this.game.sessionByAccount(acc)?.profile as SavedCaptain | null | undefined;
    if (live) return live;
    try {
      const row = this.game.db.loadCaptain(acc);
      return row ? (JSON.parse(row.data) as SavedCaptain) : null;
    } catch {
      return null;
    }
  }

  /** Her session if she is aboard with a ship. */
  private aboard(acc: number): PlayerSession | null {
    const s = this.game.sessionByAccount(acc);
    return s?.authed && s.profile && s.ship ? s : null;
  }

  /** Why this thing cannot be bought for her now (null: it can; a fight or the port only make it wait). */
  why(acc: number, x0: WebItem, p: SavedCaptain | null = this.saved(acc)): Unavailable | null {
    const game = this.game;
    const x = this.today(x0);
    const wall = game.wallNow();
    if (!webOnSale(x, wall)) return 'season';
    if (this.shut(x)) return 'gone';
    const s = this.aboard(acc);
    switch (x.kind) {
      case 'pack':
        return null;
      case 'captain':
        return x.captain && ownsCaptain(game, acc, x.captain) ? 'owned' : null;
      case 'ship': {
        const c = x.ship!;
        if (s) return fromPremium(shipWhy(game, s, c, x.rub, Infinity));
        if (!p) return null;
        if (p.loadout?.classId === c) return 'yours';
        if ((p.level ?? 1) < (x.lv ?? 1)) return 'level';
        return (p.berths?.length ?? 0) >= MAX_BERTHS ? 'berths' : null;
      }
      case 'unit': {
        const u = x.unit!;
        const o = unitOffer(game, u);
        if (!o) return 'gone';
        if (s) return fromPremium(unitWhy(game, s, u, o, Infinity, x.k ?? 1));
        if (p?.loadout && shipLevelOf(p.loadout as Parameters<typeof shipLevelOf>[0]) < (x.lv ?? 1)) return 'tier';
        return null;
      }
      case 'offer':
      case 'deal': {
        if (x.level) {
          const at = shopState(game, acc).gifts[x.level];
          if (at === undefined) return 'level';
          if (at < 0 || wall > at + LEVEL_OFFER_H * 3_600_000) return 'gone';
        }
        const why = fromShop(accountOfferWhy(game, acc, x.offer!, x.kind === 'deal'), x);
        if (why) return why;
        // (not aboard: what her save says of her ship's goods — the rest is judged when she comes aboard)
        if (!s && p && OFFERS.get(x.offer!)?.offer.grants.some((g) => g.k === 'pardon') && (p.infamy ?? 0) < 20) return 'none';
        return null;
      }
    }
  }

  /** What of the catalogue she cannot buy now, and why. */
  unavailable(acc: number): Record<string, Unavailable> {
    const out: Record<string, Unavailable> = {};
    const p = this.saved(acc);
    for (const x of WEB_ITEMS) {
      const why = this.why(acc, x, p);
      if (why) out[x.id] = why;
    }
    return out;
  }

  /** Her account by her captain's name (null: none, or kept off the site). */
  account(name: string): { acc: number; name: string } | null {
    const row = this.game.db.accountByName(name);
    if (!row || this.o.hidden?.(row.id, row.name)) return null;
    return { acc: row.id, name: row.name };
  }

  /** The captain the page shows after her name is entered: her name as the game writes it, her captain (portrait),
   *  level, whether she is at sea now and in port, and what she cannot buy now. */
  lookup(raw: unknown): { name: string; captain: string | null; level: number; online: boolean; port: boolean; unavailable: Record<string, Unavailable> } | 'bad_name' | null {
    const name = cleanCaptainName(raw);
    if (!name) return 'bad_name';
    const a = this.account(name);
    if (!a) return null;
    const p = this.saved(a.acc);
    const s = this.aboard(a.acc);
    return {
      name: a.name, captain: typeof p?.captain === 'string' ? p.captain : null, level: Math.max(1, Math.floor(Number(p?.level ?? 1)) || 1),
      online: !!s, port: !!s?.ship?.docked, unavailable: this.unavailable(a.acc),
    };
  }

  /** Whether the test checkout opens for this account. */
  testAllowed(acc: number): boolean {
    return !!this.o.payTest || (this.o.admins ?? []).includes(acc);
  }

  // ---------------------------------------------------------------------------------------------- orders

  get(id: string): WebOrder | null {
    return ORDER_ID.test(id) ? this.game.db.getKv<WebOrder>(`weborder:${id}`) ?? null : null;
  }

  private put(o: WebOrder): void {
    this.game.db.setKv(`weborder:${o.id}`, o);
  }

  private returnUrl(lang: 'ru' | 'en', id: string): string {
    const base = this.o.returnUrl;
    const b = lang === 'en' ? base.replace(/\/site\/(?!en\/)/, '/site/en/') : base;
    return `${b}${b.includes('?') ? '&' : '?'}order=${id}`;
  }

  /** An order made and its payment asked of the provider: its id and the page to send the buyer to. */
  async order(b: { name?: unknown; item?: unknown; lang?: unknown; email?: unknown }): Promise<{ orderId: string; url: string } | { error: OrderError }> {
    const name = cleanCaptainName(b.name);
    if (!name) return { error: 'bad_name' };
    const a = this.account(name);
    if (!a) return { error: 'not_found' };
    const x0 = webItem(b.item);
    if (!x0) return { error: 'bad_item' };
    const x = this.today(x0);
    const why = this.why(a.acc, x0);
    if (why) return { error: why };
    if (this.mode === 'test' && !this.testAllowed(a.acc)) return { error: 'test_only' };
    const email = cleanEmail(b.email);
    if (this.provider.needsEmail && !email) return { error: 'email' };
    // a few unpaid orders at most per account (an abandoned page is not a reason to make more)
    const idx = this.game.db.getKv<string[]>(`weborders:${a.acc}`) ?? [];
    const now = this.now();
    const open = idx.map((id) => this.get(id)).filter((o): o is WebOrder => !!o && o.status === 'pending' && now - o.at < 3_600_000);
    if (open.length >= PENDING_MAX) return { error: 'rate' };
    const rub = this.priceOf(x0);
    if (!(rub > 0)) return { error: 'gone' };
    const lang = b.lang === 'en' ? 'en' : 'ru';
    const o: WebOrder = {
      id: randomBytes(12).toString('hex'), acc: a.acc, name: a.name, item: x0.id, ...(x0.kind === 'deal' ? { offer: x.offer } : {}),
      rub, lang, provider: this.provider.name, status: 'pending', at: now,
    };
    // (written before the provider is asked: a payment the network lost on its way back still has an order to find)
    this.put(o);
    this.game.db.setKv(`weborders:${a.acc}`, [...idx, o.id].slice(-20));
    const pay = await this.provider.create({
      orderId: o.id, rub, returnUrl: this.returnUrl(lang, o.id), email,
      description: `GRAVETIDE: ${x.name[lang === 'ru' ? 1 : 0]} — ${a.name}`.slice(0, 128),
      receiptItem: `Игровой товар «${x.name[1]}» · GRAVETIDE`.slice(0, 128),
    });
    if (!pay) {
      o.status = 'failed';
      o.note = 'provider';
      this.put(o);
      return { error: 'provider' };
    }
    o.pid = pay.pid;
    this.put(o);
    this.log(`[pay] web order ${o.id}: «${a.name}» (account ${a.acc}), ${x0.id}${o.offer ? ` (${o.offer})` : ''}, ${rub} RUB via ${o.provider}`);
    return { orderId: o.id, url: pay.url };
  }

  /** The provider's notification: its payment fetched again and applied (true: taken — a repeat too). */
  async notice(pid: string): Promise<boolean> {
    const v = await this.provider.fetch(pid);
    if (!v) return false;
    return this.apply(v);
  }

  /** The order's payment asked of the provider again (the return page polls; the webhook may be late or lost) — at most
   *  once in five seconds an order. */
  async refresh(id: string): Promise<void> {
    const o = this.get(id);
    if (!o || !o.pid || (o.status !== 'pending' && o.status !== 'paid')) return;
    if (o.status === 'paid') {
      this.deliver(o);
      return;
    }
    const now = this.now();
    if (now - (this.checked.get(id) ?? -1e12) < 5000) return;
    this.checked.set(id, now);
    if (this.checked.size > 5000) this.checked.clear();
    const v = await this.provider.fetch(o.pid);
    if (v) this.apply(v);
  }

  /** A payment as the provider reports it applied to its order. Runs with no pause from the order's read to its write:
   *  two notifications of one payment deliver once. */
  apply(v: VerifiedPayment): boolean {
    if (!v.orderId) return false;
    const o = this.get(v.orderId);
    if (!o) return false;
    // the payment must be the very one made for this order
    if (o.pid !== v.pid) {
      this.log(`[pay] web order ${o.id}: payment ${v.pid} is not its own (${o.pid ?? 'none'})`);
      return true;
    }
    if (o.status === 'paid') {
      this.deliver(o);
      return true;
    }
    if (o.status !== 'pending') return true;
    if (v.status === 'canceled') {
      o.status = 'canceled';
      this.put(o);
      return true;
    }
    if (!v.paid) return true;
    if (v.currency !== 'RUB' || Math.abs(v.amountRub - o.rub) >= 0.01) {
      o.status = 'failed';
      o.note = `amount:${v.amountRub}:${v.currency}`;
      this.put(o);
      this.log(`[pay] web order ${o.id}: AMOUNT MISMATCH — paid ${v.amountRub} ${v.currency}, the order is ${o.rub} RUB; nothing delivered, see to it by hand`);
      return true;
    }
    o.status = 'paid';
    o.paidAt = this.now();
    this.put(o);
    this.deliver(o);
    return true;
  }

  /** The thing an order sold (the deal: its own offer at the order's price). */
  itemOf(o: WebOrder): WebItem | undefined {
    if (o.item === 'deal') return o.offer && OFFERS.has(o.offer) ? dealItem(o.offer, o.rub) : undefined;
    return webItem(o.item);
  }

  /** What a paid thing waits for before it can be handed over as the game hands it (null: nothing — now). */
  waitFor(acc: number, x: WebItem): OrderWait | null {
    if (!x.aboard) return null;
    const s = this.aboard(acc);
    if (!s) return 'login';
    const ship = s.ship!;
    // a hull is delivered in port, the yard not busy with her (premium.ts buyShip)
    if (x.kind === 'ship') return ship.docked && !refitHolds(this.game, s.profile!) ? null : 'port';
    // creatures and her ship's goods come aboard out of a fight (premium.ts buyUnit, shop.ts grantWhy)
    return !ship.alive || ship.boarding || ship.underFire(this.game.now) || landFighting(this.game, s) ? 'fight' : null;
  }

  private waiting(): string[] {
    return this.game.db.getKv<string[]>(WAIT_KEY) ?? [];
  }

  private setWaiting(ids: string[]): void {
    this.game.db.setKv(WAIT_KEY, ids.slice(-5000));
  }

  /** The waiting orders looked at: each whose captain is aboard is tried again (every few seconds, and by the tests). */
  pump(): void {
    const ids = this.waiting();
    if (!ids.length) return;
    const keep: string[] = [];
    for (const id of ids) {
      const o = this.get(id);
      if (!o || o.status !== 'paid') continue;
      if (this.aboard(o.acc)) this.deliver(o);
      if (this.get(id)?.status === 'paid') keep.push(id);
    }
    if (keep.length !== ids.length) this.setWaiting(keep);
  }

  /** A paid order handed over (once: `done` after; a resumed delivery is refused by the ledger's references) — or, for a
   *  thing of her ship while she is not where the game hands it over, put to wait for her. */
  deliver(o: WebOrder): void {
    if (o.status !== 'paid') return;
    const game = this.game;
    const x = this.itemOf(o);
    const wait = x ? this.waitFor(o.acc, x) : null;
    if (wait) {
      if (o.wait !== wait) {
        o.wait = wait;
        this.put(o);
      }
      const ids = this.waiting();
      if (!ids.includes(o.id)) this.setWaiting([...ids, o.id]);
      const s = game.sessionByAccount(o.acc);
      const key = `${o.id}:${wait}`;
      if (s && wait !== 'login' && !this.told.has(key)) {
        this.told.add(key);
        if (this.told.size > 5000) this.told.clear();
        game.sendTo(s, { t: 'toast', msg: wait === 'port' ? `A web shop purchase waits for you in port: ${x!.name[0]}. Make port to take her.` : `A web shop purchase waits for you: ${x!.name[0]}. It comes aboard once you are out of the fight.`, kind: 'gold' });
      }
      return;
    }
    const ref = `web:${o.id}`;
    const n = x?.kind === 'pack' ? x.doubloons! : o.rub;
    // (a delivery resumed after a stop between its credit and its buy: the credit is there already)
    const resumed = game.db.doubloonRef(o.acc, 'doubloons_pay', ref);
    const bal = payIn(game, o.acc, n, o.rub, `web:${o.item}`, ref, true);
    if (bal === null) {
      o.status = 'failed';
      o.note = 'credit';
      this.put(o);
      this.log(`[pay] web order ${o.id}: PAID but the account ${o.acc} took no credit; see to it by hand`);
      return;
    }
    const s = this.aboard(o.acc);
    const promo = { price: o.rub, tag: 'web', done: () => {} };
    let why: string | null = null;
    if (!x) why = 'unknown_item';
    else if (x.kind === 'captain') why = buyCaptainFor(game, o.acc, x.captain!);
    else if (x.kind === 'ship') why = s ? buyShip(game, s, x.ship!) : 'not aboard';
    else if (x.kind === 'unit') why = s ? buyUnit(game, s, x.unit!, x.k ?? 1, o.id) : 'not aboard';
    else if (x.kind === 'offer') why = buyForAccount(game, o.acc, x.offer!, o.id, promo, true);
    else if (x.kind === 'deal') why = buyForAccount(game, o.acc, x.offer!, o.id, { ...promo, count: 'deal' }, true);
    // (bought already by this very order — a resumed delivery — is no refusal)
    if (resumed && (why === 'That captain is yours already' || why === 'You already sail one')) why = null;
    o.status = 'done';
    o.doneAt = this.now();
    delete o.wait;
    if (why) o.note = `kept:${why}`;
    this.put(o);
    this.log(`[pay] web order ${o.id}: delivered to account ${o.acc} — ${o.item}${o.offer ? ` (${o.offer})` : ''}${why ? ` (not handed over: ${why}; ${n} doubloons kept)` : ''}`);
    const ss = game.sessionByAccount(o.acc);
    if (ss) {
      sendBalance(game, ss);
      if (ss.ship && ss.profile) sendPremium(game, ss);
      const msg = !x || x.kind === 'pack' ? `Web shop purchase: ${n} doubloons.` : why ? `A web shop purchase could not be handed over: ${x.name[0]}. Its ${n} doubloons are on your account.` : `Web shop purchase: ${x.name[0]}.`;
      game.sendTo(ss, { t: 'toast', msg, kind: why ? 'info' : 'gold' });
    }
  }

  /** The return page's view of an order: only what its buyer saw already (what, for whom, how much, how it stands, what
   *  it waits for, whether its doubloons were kept instead). */
  view(id: string): { status: OrderStatus; item: string; name: string; rub: number; provider: string; wait?: OrderWait; kept?: boolean } | null {
    const o = this.get(id);
    if (!o) return null;
    return { status: o.status, item: o.item, name: o.name, rub: o.rub, provider: o.provider, ...(o.status === 'paid' && o.wait ? { wait: o.wait } : {}), ...(o.note?.startsWith('kept:') ? { kept: true } : {}) };
  }

  /** The tester's answer on the fake checkout (test mode only): the payment settled, then checked as YooKassa's is. */
  async settleTest(id: string, paid: boolean): Promise<boolean> {
    const o = this.get(id);
    if (!this.test || !o || !o.pid || o.provider !== 'test' || !this.testAllowed(o.acc)) return false;
    this.test.settle(o.pid, paid);
    return this.notice(o.pid);
  }
}
