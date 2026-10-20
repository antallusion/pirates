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
//  - aboard, she hears it at once: «Покупка с сайта: …».
// Idempotent: the order's status moves pending → paid → done once (the delivery runs without a pause between the check
// and the write), and the ledger's references refuse a second credit or a second buy even if a delivery is resumed.
//
// Without YooKassa's keys the shop runs in its TEST MODE: no money moves, the «checkout» is this server's own page, and
// it opens only with GRAVETIDE_PAY_TEST=1 or for the site's admin accounts (SITE_ADMINS, else FORUM_ADMINS).

import { randomBytes } from 'node:crypto';
import { OFFERS } from '../../../shared/src/data/shop.ts';
import { WEB_ITEMS, cleanCaptainName, webItem, webOnSale } from '../../../shared/src/data/webshop.ts';
import type { WebItem } from '../../../shared/src/data/webshop.ts';
import type { PayProvider, VerifiedPayment } from '../pay/yookassa.ts';
import { TestPay } from '../pay/yookassa.ts';
import { buyCaptainFor, ownsCaptain } from './captainshop.ts';
import type { Game } from './Game.ts';
import { opsPrice, opsShut } from './liveops.ts';
import { payIn, sendBalance } from './premium.ts';
import { accountOfferWhy, buyForAccount } from './shop.ts';

export type OrderStatus = 'pending' | 'paid' | 'done' | 'canceled' | 'failed';

export interface WebOrder {
  id: string;
  acc: number;
  name: string;
  item: string;
  rub: number;
  lang: 'ru' | 'en';
  provider: 'yookassa' | 'test';
  status: OrderStatus;
  /** The provider's payment id. */
  pid?: string;
  at: number;
  paidAt?: number;
  doneAt?: number;
  /** Why a thing was not handed over (its doubloons kept on the account instead), or why the order failed. */
  note?: string;
}

/** Why a thing cannot be bought for her: hers already (a captain, a bundle all hers, a once-only offer bought), its
 *  limit reached for now (the week's chest), at its cap, or not on sale. */
export type Unavailable = 'owned' | 'limit' | 'max' | 'gone';

export type OrderError = 'bad_name' | 'not_found' | 'bad_item' | 'owned' | 'limit' | 'max' | 'gone' | 'email' | 'test_only' | 'rate' | 'provider';

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
}

const ORDER_ID = /^[0-9a-f]{24}$/;
const PENDING_MAX = 5;

export function cleanEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export class WebShop {
  readonly game: Game;
  readonly provider: PayProvider;
  /** The fake provider of the test mode (null when live). */
  readonly test: TestPay | null;
  private o: WebShopOptions;
  private checked = new Map<string, number>();

  constructor(game: Game, o: WebShopOptions) {
    this.game = game;
    this.o = o;
    this.test = o.provider ? null : new TestPay();
    this.provider = o.provider ?? this.test!;
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

  /** An item's price in roubles now: a shop offer's as the game sells it (the live ops' own, a sale), else the catalogue's. */
  priceOf(x: WebItem): number {
    const f = x.offer ? OFFERS.get(x.offer) : undefined;
    return f ? opsPrice(this.game, f.offer) : x.rub;
  }

  /** The catalogue on sale now (the seasonal bundles between their dates, nothing the live ops took off the shelves). */
  catalog(): (Omit<WebItem, 'from'> & { until?: number })[] {
    const wall = this.game.wallNow();
    return WEB_ITEMS.filter((x) => webOnSale(x, wall) && !(x.offer && opsShut(this.game, x.offer))).map((x) => {
      const { from: _from, ...rest } = x;
      return { ...rest, rub: this.priceOf(x) };
    });
  }

  /** What of the catalogue she cannot buy now, and why. */
  unavailable(acc: number): Record<string, Unavailable> {
    const out: Record<string, Unavailable> = {};
    for (const x of WEB_ITEMS) {
      if (x.kind === 'captain' && x.captain && ownsCaptain(this.game, acc, x.captain)) out[x.id] = 'owned';
      else if (x.offer) {
        const why = accountOfferWhy(this.game, acc, x.offer);
        if (why === 'limit') out[x.id] = x.once ? 'owned' : 'limit';
        else if (why === 'max') out[x.id] = x.kind === 'bundle' ? 'owned' : 'max';
        else if (why) out[x.id] = 'gone';
      }
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
   *  level, and what she has already. */
  lookup(raw: unknown): { name: string; captain: string | null; level: number; unavailable: Record<string, Unavailable> } | 'bad_name' | null {
    const name = cleanCaptainName(raw);
    if (!name) return 'bad_name';
    const a = this.account(name);
    if (!a) return null;
    const live = this.game.sessionByAccount(a.acc)?.profile as { captain?: string; level?: number } | null | undefined;
    let p = live ?? null;
    if (!p) {
      try {
        const row = this.game.db.loadCaptain(a.acc);
        p = row ? (JSON.parse(row.data) as { captain?: string; level?: number }) : null;
      } catch {
        p = null;
      }
    }
    return { name: a.name, captain: typeof p?.captain === 'string' ? p.captain : null, level: Math.max(1, Math.floor(Number(p?.level ?? 1)) || 1), unavailable: this.unavailable(a.acc) };
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
    const x = webItem(b.item);
    if (!x) return { error: 'bad_item' };
    if (!webOnSale(x, this.game.wallNow()) || (x.offer && opsShut(this.game, x.offer))) return { error: 'gone' };
    const why = this.unavailable(a.acc)[x.id];
    if (why) return { error: why === 'owned' ? 'owned' : why };
    if (this.mode === 'test' && !this.testAllowed(a.acc)) return { error: 'test_only' };
    const email = cleanEmail(b.email);
    if (this.provider.needsEmail && !email) return { error: 'email' };
    // a few unpaid orders at most per account (an abandoned page is not a reason to make more)
    const idx = this.game.db.getKv<string[]>(`weborders:${a.acc}`) ?? [];
    const now = this.now();
    const open = idx.map((id) => this.get(id)).filter((o): o is WebOrder => !!o && o.status === 'pending' && now - o.at < 3_600_000);
    if (open.length >= PENDING_MAX) return { error: 'rate' };
    const rub = this.priceOf(x);
    if (!(rub > 0)) return { error: 'gone' };
    const lang = b.lang === 'en' ? 'en' : 'ru';
    const o: WebOrder = { id: randomBytes(12).toString('hex'), acc: a.acc, name: a.name, item: x.id, rub, lang, provider: this.provider.name, status: 'pending', at: now };
    // (written before the provider is asked: a payment the network lost on its way back still has an order to find)
    this.put(o);
    this.game.db.setKv(`weborders:${a.acc}`, [...idx, o.id].slice(-20));
    const pay = await this.provider.create({
      orderId: o.id, rub, returnUrl: this.returnUrl(lang, o.id), email,
      description: `GRAVETIDE: ${x.name[lang === 'ru' ? 1 : 0]} — ${a.name}`.slice(0, 128),
      receiptItem: `Игровой товар «${x.name[1]}» · GRAVETIDE`,
    });
    if (!pay) {
      o.status = 'failed';
      o.note = 'provider';
      this.put(o);
      return { error: 'provider' };
    }
    o.pid = pay.pid;
    this.put(o);
    this.log(`[pay] web order ${o.id}: «${a.name}» (account ${a.acc}), ${x.id}, ${rub} RUB via ${o.provider}`);
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

  /** A paid order handed over (once: `done` after; a resumed delivery is refused by the ledger's references). */
  deliver(o: WebOrder): void {
    if (o.status !== 'paid') return;
    const game = this.game;
    const x = webItem(o.item);
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
    let why: string | null = null;
    if (x?.kind === 'captain' && x.captain) why = buyCaptainFor(game, o.acc, x.captain);
    else if (x?.offer) why = buyForAccount(game, o.acc, x.offer, o.id, { price: o.rub, tag: 'web', done: () => {} }, true);
    else if (!x) why = 'unknown_item';
    // (bought already by this very order — a resumed delivery — is no refusal)
    if (resumed && why === 'That captain is yours already') why = null;
    o.status = 'done';
    o.doneAt = this.now();
    if (why) o.note = `kept:${why}`;
    this.put(o);
    this.log(`[pay] web order ${o.id}: delivered to account ${o.acc} — ${o.item}${why ? ` (not handed over: ${why}; ${n} doubloons kept)` : ''}`);
    const s = game.sessionByAccount(o.acc);
    if (s) {
      sendBalance(game, s);
      const msg = x?.kind === 'pack' || why || !x ? `Web shop purchase: ${n} doubloons.` : `Web shop purchase: ${x.name[0]}.`;
      game.sendTo(s, { t: 'toast', msg, kind: 'gold' });
    }
  }

  /** The return page's view of an order: only what its buyer saw already (what, for whom, how much, how it stands). */
  view(id: string): { status: OrderStatus; item: string; name: string; rub: number; provider: string } | null {
    const o = this.get(id);
    return o ? { status: o.status, item: o.item, name: o.name, rub: o.rub, provider: o.provider } : null;
  }

  /** The tester's answer on the fake checkout (test mode only): the payment settled, then checked as YooKassa's is. */
  async settleTest(id: string, paid: boolean): Promise<boolean> {
    const o = this.get(id);
    if (!this.test || !o || !o.pid || o.provider !== 'test' || !this.testAllowed(o.acc)) return false;
    this.test.settle(o.pid, paid);
    return this.notice(o.pid);
  }
}
