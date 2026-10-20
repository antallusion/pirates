// The payment provider of the website's shop (owner, 2026-10-20; the same provider as fovgame.com): YooKassa
// (https://yookassa.ru/developers/api). The card is entered on YooKassa's own page and never passes through this server.
//
// Configured ONLY by the environment — nothing of it is in the repository:
//   YOOKASSA_SHOP_ID       the shop's id (shopId) from the YooKassa dashboard;
//   YOOKASSA_SECRET_KEY    its secret key (Basic auth with the shop id);
//   YOOKASSA_RETURN_URL    where the buyer comes back after paying (default PUBLIC_URL + /site/shop/; ?order=… is added);
//   YOOKASSA_RECEIPT=1     the shop sends 54-FZ receipts («Чеки от ЮKassa»): each payment carries a receipt, the buyer's
//                          e-mail is asked on the site; YOOKASSA_VAT_CODE (default 1: no VAT), YOOKASSA_TAX_SYSTEM (unset:
//                          left out);
//   YOOKASSA_CHECK_IP=1    a notification from an address outside YooKassa's published ranges is dropped at once.
// Without the shop id and the key the adapter is not made (`yookassaFromEnv` → null) and the shop runs in its test mode
// (server/src/game/webshop.ts).
//
// The order of trust: a notification on the webhook is never believed by itself — its address is public and anyone may
// post «succeeded» with an order number. Its payment id is fetched again from the API with our key, and only that answer
// (its status, its amount, its metadata's order) decides — YooKassa's own advice.

import { randomBytes } from 'node:crypto';

const API = 'https://api.yookassa.ru/v3/payments';

/** A payment as the provider itself reports it. */
export interface VerifiedPayment {
  /** The provider's payment id. */
  pid: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  /** Money received (succeeded and paid). */
  paid: boolean;
  amountRub: number;
  currency: string;
  /** Our order's id from the payment's metadata. */
  orderId: string | null;
}

export interface CreatePayment {
  orderId: string;
  rub: number;
  description: string;
  returnUrl: string;
  /** The receipt's e-mail (54-FZ), when the shop sends receipts. */
  email?: string | null;
  /** The receipt's line (up to 128 characters). */
  receiptItem?: string;
}

/** What the shop needs of a provider (YooKassa, or the test mode's fake one). */
export interface PayProvider {
  readonly name: 'yookassa' | 'test';
  /** Whether a payment needs the buyer's e-mail for its receipt. */
  readonly needsEmail: boolean;
  /** A payment made for an order: its id and the page to send the buyer to (null: the provider said no). */
  create(o: CreatePayment): Promise<{ pid: string; url: string } | null>;
  /** The payment as the provider has it now (null: unknown, or the provider unreachable). */
  fetch(pid: string): Promise<VerifiedPayment | null>;
}

type FetchFn = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

const PID = /^[\w-]{8,64}$/;

/** A payment object of the API read into our shape (null: not one). */
export function readPayment(o: unknown): VerifiedPayment | null {
  if (!o || typeof o !== 'object') return null;
  const p = o as { id?: unknown; status?: unknown; paid?: unknown; amount?: { value?: unknown; currency?: unknown }; metadata?: { orderId?: unknown } };
  const pid = typeof p.id === 'string' && PID.test(p.id) ? p.id : null;
  const status = p.status === 'pending' || p.status === 'waiting_for_capture' || p.status === 'succeeded' || p.status === 'canceled' ? p.status : null;
  if (!pid || !status) return null;
  const amountRub = Number(p.amount?.value);
  const orderId = typeof p.metadata?.orderId === 'string' && /^[0-9a-f]{24}$/.test(p.metadata.orderId) ? p.metadata.orderId : null;
  return { pid, status, paid: status === 'succeeded' && p.paid === true, amountRub: Number.isFinite(amountRub) ? amountRub : 0, currency: String(p.amount?.currency ?? ''), orderId };
}

/** A notification's payment id (null: not a payment's notification). Only the id is taken — the rest is fetched again. */
export function noticePid(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as { type?: unknown; event?: unknown; object?: { id?: unknown } };
  if (n.type !== 'notification' || typeof n.event !== 'string' || !n.event.startsWith('payment.')) return null;
  const id = n.object?.id;
  return typeof id === 'string' && PID.test(id) ? id : null;
}

/** YooKassa's published notification addresses (https://yookassa.ru/developers/using-api/webhooks#ip). */
const YOO_NETS: [string, number][] = [['185.71.76.0', 27], ['185.71.77.0', 27], ['77.75.153.0', 25], ['77.75.156.11', 32], ['77.75.156.35', 32], ['77.75.154.128', 25]];
const ip4 = (s: string): number | null => {
  const m = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  return m ? ((Number(m[1]) << 24) | (Number(m[2]) << 16) | (Number(m[3]) << 8) | Number(m[4])) >>> 0 : null;
};
export function yooAddress(ip: string): boolean {
  if (/^2a02:5180:/i.test(ip)) return true;
  const a = ip4(ip);
  if (a === null) return false;
  return YOO_NETS.some(([net, bits]) => {
    const n = ip4(net)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((a & mask) >>> 0) === ((n & mask) >>> 0);
  });
}

export interface YooConfig {
  shopId: string;
  secret: string;
  receipt: boolean;
  vatCode: number;
  taxSystem?: number;
  checkIp: boolean;
}

export class YooKassa implements PayProvider {
  readonly name = 'yookassa' as const;
  readonly needsEmail: boolean;
  readonly checkIp: boolean;
  private cfg: YooConfig;
  private http: FetchFn;
  private log: (s: string) => void;

  constructor(cfg: YooConfig, http: FetchFn = fetch as unknown as FetchFn, log: (s: string) => void = (s) => console.error(s)) {
    this.cfg = cfg;
    this.http = http;
    this.log = log;
    this.needsEmail = cfg.receipt;
    this.checkIp = cfg.checkIp;
  }

  private auth(): string {
    return 'Basic ' + Buffer.from(`${this.cfg.shopId}:${this.cfg.secret}`).toString('base64');
  }

  async create(o: CreatePayment): Promise<{ pid: string; url: string } | null> {
    const value = o.rub.toFixed(2);
    const body: Record<string, unknown> = {
      amount: { value, currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: o.returnUrl },
      description: o.description.slice(0, 128),
      // the notification finds our order by its metadata (the provider has no field of its own for it)
      metadata: { orderId: o.orderId },
    };
    if (this.cfg.receipt) {
      if (!o.email) return null;
      body.receipt = {
        customer: { email: o.email },
        items: [{ description: (o.receiptItem ?? o.description).slice(0, 128), quantity: '1.00', amount: { value, currency: 'RUB' }, vat_code: this.cfg.vatCode, payment_mode: 'full_payment', payment_subject: 'service' }],
        ...(this.cfg.taxSystem ? { tax_system_code: this.cfg.taxSystem } : {}),
      };
    }
    try {
      // the idempotence key is our order's id: a repeat of the request makes no second payment
      const res = await this.http(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: this.auth(), 'Idempotence-Key': o.orderId }, body: JSON.stringify(body) });
      if (!res.ok) {
        this.log(`[pay] yookassa create ${o.orderId}: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
        return null;
      }
      const data = (await res.json()) as { id?: unknown; confirmation?: { confirmation_url?: unknown } };
      const pid = typeof data.id === 'string' && PID.test(data.id) ? data.id : null;
      const url = typeof data.confirmation?.confirmation_url === 'string' && /^https:\/\//.test(data.confirmation.confirmation_url) ? data.confirmation.confirmation_url : null;
      return pid && url ? { pid, url } : null;
    } catch (e) {
      this.log(`[pay] yookassa create ${o.orderId}: ${(e as Error).message}`);
      return null;
    }
  }

  async fetch(pid: string): Promise<VerifiedPayment | null> {
    if (!PID.test(pid)) return null;
    try {
      const res = await this.http(`${API}/${pid}`, { headers: { Authorization: this.auth() } });
      if (!res.ok) {
        this.log(`[pay] yookassa verify ${pid}: HTTP ${res.status}`);
        return null;
      }
      return readPayment(await res.json());
    } catch (e) {
      this.log(`[pay] yookassa verify ${pid}: ${(e as Error).message}`);
      return null;
    }
  }
}

/** The adapter from the environment, or null when the shop id or the key is missing (the shop's test mode). */
export function yookassaFromEnv(env: NodeJS.ProcessEnv = process.env, http?: FetchFn): YooKassa | null {
  const shopId = (env.YOOKASSA_SHOP_ID ?? '').trim();
  const secret = (env.YOOKASSA_SECRET_KEY ?? '').trim();
  if (!shopId || !secret) return null;
  const vat = Number(env.YOOKASSA_VAT_CODE ?? 1);
  const tax = Number(env.YOOKASSA_TAX_SYSTEM ?? 0);
  return new YooKassa({ shopId, secret, receipt: env.YOOKASSA_RECEIPT === '1', vatCode: Number.isInteger(vat) && vat >= 1 && vat <= 12 ? vat : 1, ...(Number.isInteger(tax) && tax >= 1 && tax <= 6 ? { taxSystem: tax } : {}), checkIp: env.YOOKASSA_CHECK_IP === '1' }, http);
}

// ------------------------------------------------------------------------------------------------ the test mode

/** The test mode's provider: no money moves. Its «checkout» is this server's own page (/api/site/pay/test), where the
 *  tester chooses «paid» or «declined»; the shop then checks the payment with `fetch`, as with YooKassa. */
export class TestPay implements PayProvider {
  readonly name = 'test' as const;
  readonly needsEmail = false;
  private pays = new Map<string, VerifiedPayment>();

  async create(o: CreatePayment): Promise<{ pid: string; url: string } | null> {
    const pid = `test-${randomBytes(9).toString('hex')}`;
    this.pays.set(pid, { pid, status: 'pending', paid: false, amountRub: o.rub, currency: 'RUB', orderId: o.orderId });
    if (this.pays.size > 5000) this.pays.delete(this.pays.keys().next().value!);
    return { pid, url: `/api/site/pay/test?order=${o.orderId}` };
  }

  async fetch(pid: string): Promise<VerifiedPayment | null> {
    const p = this.pays.get(pid);
    return p ? { ...p } : null;
  }

  /** The tester's choice on the fake checkout. */
  settle(pid: string, paid: boolean): boolean {
    const p = this.pays.get(pid);
    if (!p || p.status !== 'pending') return false;
    p.status = paid ? 'succeeded' : 'canceled';
    p.paid = paid;
    return true;
  }
}
