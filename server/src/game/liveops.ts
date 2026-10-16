// Live ops (owner, 2026-10-16: «да» — docs/34_LIVEOPS.md): the shop's prices, the offers and the sea's events tuned
// from the web panel (/ops/admin, server/src/http/ops.ts) without a deploy, and the funnel of the players' first steps.
//
// Everything lives in its own SQLite file (data/liveops.db next to the game's database; the game's own is untouched):
//   ops_config   the overrides, a JSON value a key — `price:<offer>`, `promo`, `global:<id>`, `event:<id>`;
//   ops_audit    every change of them: who, when, what, before and after;
//   ops_gbuys    a global offer's buys by account (its limit a player);
//   ops_first    the first time an account did a thing of the funnel (account id, kind, when) — nothing else of her;
//   ops_events   every purchase (account id, kind, amount, product);
//   ops_daily    the day's count and sum of every kind;
//   ops_active   the days an account was aboard (D1/D7/D30).
// The config is held in a cache, read again on every save and every 30 s (zones share the file). With no LiveOps
// attached (the tests of other systems) or no override, every hook gives the game's own value: the game is as before.
//
// The API for the rest of the game (stable: another helper writes events through it too):
//   trackEvent(game, accountId, kind, data?)   kind: [a-z0-9_:.-]{1,40}; data: { amount?, product? }

import { DatabaseSync } from 'node:sqlite';
import { HAPPENING_KINDS } from '../../../shared/src/data/happenings.ts';
import { HOLIDAYS } from '../../../shared/src/data/holidays.ts';
import type { HolidayId } from '../../../shared/src/data/holidays.ts';
import { INV_REGIONS } from '../../../shared/src/data/invasions.ts';
import { OFFERS, PRICE_MAX, PRICE_MIN } from '../../../shared/src/data/shop.ts';
import type { ShopOffer } from '../../../shared/src/data/shop.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { ownIsland } from './estate.ts';
import type { Game } from './Game.ts';

const DAY = 86_400_000;
const CACHE_MS = 30_000;

/** A UTC day as YYYY-MM-DD, and N days after one. */
export const dayStr = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number): string => dayStr(Date.parse(`${d}T00:00:00Z`) + n * DAY);
/** The Monday of a day's week. */
export const weekStart = (d: string): string => {
  const t = Date.parse(`${d}T00:00:00Z`);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return dayStr(t - dow * DAY);
};

// ------------------------------------------------------------------------------------------------ the shapes

/** An offer of the shop: its own price, shut, a sale of a share for a while. */
export interface PriceRule {
  price?: number;
  off?: boolean;
  sale?: { pct: number; from: number; to: number };
}

/** The personal offers' discounts (%), hours, the context's rest (minutes), the entry carousel. */
export interface PromoTune {
  offMin: number;
  offMax: number;
  hoursMin: number;
  hoursMax: number;
  restMin: number;
  restMax: number;
  carousel: 'day' | 'session' | 'off';
}

/** A limited-time offer for every captain: a shop's offer at its own price, so many times a player. */
export interface GlobalOffer {
  id: string;
  offer: string;
  price: number;
  from: number;
  to: number;
  limit: number;
}

/** A scheduled event of the sea: a window (a holiday, a multiplier) or a trigger fired once at its start. */
export interface OpsEvent {
  id: string;
  kind: string;
  region?: string;
  mul?: number;
  from: number;
  to: number;
  /** When a trigger was fired (wall ms). */
  fired?: number;
}

export interface EventKindDef {
  kind: string;
  ru: string;
  mode: 'window' | 'trigger';
  /** 'inv': an invasion's region (optional); 'zb': a zone boss's sea (required). */
  region?: 'inv' | 'zb';
  mul?: boolean;
}

const HAPPENING_RU: Record<string, string> = {
  festival: 'Праздник в порту (фейерверки)', silver_convoy: 'Серебряный конвой', brethren: 'Сбор Берегового братства', star: 'Падающая звезда (ночью)',
  eclipse: 'Затмение', herring_run: 'Сельдяной косяк (днём)', red_tide: 'Красный прилив', orca_migration: 'Ход косаток', white_orca: 'Белая косатка',
};
const HOLIDAY_RU: Record<HolidayId, string> = { drowned_night: 'Ночь утопленников', herring_run: 'Сельдяной ход (турнир)', powder_night: 'Пороховая ночь', league_day: 'День Лиги' };

/** Every event the panel may schedule: the game's own, and the multipliers. */
export const EVENT_KINDS: EventKindDef[] = [
  { kind: 'xp', ru: 'Множитель опыта', mode: 'window', mul: true },
  { kind: 'silver', ru: 'Множитель серебра (добыча и задания)', mode: 'window', mul: true },
  ...(Object.keys(HOLIDAYS) as HolidayId[]).map((h): EventKindDef => ({ kind: `holiday:${h}`, ru: `Праздник: ${HOLIDAY_RU[h] ?? h}`, mode: 'window' })),
  ...HAPPENING_KINDS.filter((k) => k !== 'lost_fleet').map((k): EventKindDef => ({ kind: `happening:${k}`, ru: `Событие: ${HAPPENING_RU[k] ?? k}`, mode: 'trigger' })),
  { kind: 'invasion', ru: 'Вторжение Хора', mode: 'trigger', region: 'inv' },
  { kind: 'zboss', ru: 'Босс моря', mode: 'trigger', region: 'zb' },
];
export const EVENT_KIND = new Map(EVENT_KINDS.map((k) => [k.kind, k]));

/** The funnel's steps in their order (the First Watch's five, docs/23). */
export const FUNNEL: { kind: string; ru: string }[] = [
  { kind: 'register', ru: 'Регистрация (аккаунт)' },
  { kind: 'captain', ru: 'Капитан создан' },
  { kind: 'fw_sail', ru: 'Первая вахта: паруса' },
  { kind: 'fw_attack', ru: 'Первая вахта: атака' },
  { kind: 'fw_fire', ru: 'Первая вахта: залп' },
  { kind: 'fw_board', ru: 'Первая вахта: абордаж' },
  { kind: 'fw_port', ru: 'Первая вахта: в порт' },
  { kind: 'fw_done', ru: 'Первая вахта пройдена' },
  { kind: 'sea_fight', ru: 'Первый бой в море' },
  { kind: 'boarding', ru: 'Первый абордаж' },
  { kind: 'quest_taken', ru: 'Первое задание взято' },
  { kind: 'quest_done', ru: 'Первое задание выполнено' },
  { kind: 'island', ru: 'Остров занят' },
  { kind: 'topup', ru: 'Первое пополнение (дублоны)' },
  { kind: 'buy', ru: 'Первая покупка в лавке' },
];

// ------------------------------------------------------------------------------------------------ the checks

/** The owner's rule (2026-10-15): every price of the shop from 290 to 9 900 doubloons, whole. Null: fine. */
export function priceProblem(n: unknown): string | null {
  if (typeof n !== 'number' || !Number.isInteger(n)) return 'Цена — целое число дублонов.';
  if (n < PRICE_MIN || n > PRICE_MAX) return `Цена должна быть от ${PRICE_MIN} до ${PRICE_MAX} дублонов.`;
  return null;
}

/** A price on the shop's grid (…90), not above `x`, within the shop's range. */
export function grid90(x: number): number {
  return Math.min(PRICE_MAX, Math.max(PRICE_MIN, Math.floor((x - 90) / 100) * 100 + 90));
}

/** A sale's price: the share off, on the grid, never under 290 (and never above the price itself). */
export function salePrice(price: number, pct: number): number {
  return Math.min(price, grid90(price * (1 - pct / 100)));
}

const time = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function ruleProblem(id: string, r: PriceRule): string | null {
  if (!OFFERS.has(id)) return `Нет товара «${id}».`;
  if (r.price !== undefined) {
    const p = priceProblem(r.price);
    if (p) return p;
  }
  if (r.sale) {
    const s = r.sale;
    if (!Number.isInteger(s.pct) || s.pct < 1 || s.pct > 90) return 'Скидка — от 1 до 90 %.';
    if (!time(s.from) || !time(s.to) || s.to <= s.from) return 'У скидки начало должно быть раньше конца.';
    if (s.to - s.from > 60 * DAY) return 'Скидка — не дольше 60 дней.';
  }
  return null;
}

export const PROMO_LIMITS = { off: [5, 60], hours: [1, 168], rest: [1, 1440] } as const;

export function tuneProblem(t: PromoTune): string | null {
  const int = (v: number, [lo, hi]: readonly [number, number]) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!int(t.offMin, PROMO_LIMITS.off) || !int(t.offMax, PROMO_LIMITS.off) || t.offMin > t.offMax) return `Скидка личных офферов — от ${PROMO_LIMITS.off[0]} до ${PROMO_LIMITS.off[1]} %, «от» не больше «до».`;
  if (!int(t.hoursMin, PROMO_LIMITS.hours) || !int(t.hoursMax, PROMO_LIMITS.hours) || t.hoursMin > t.hoursMax) return `Срок оффера — от ${PROMO_LIMITS.hours[0]} до ${PROMO_LIMITS.hours[1]} ч, «от» не больше «до».`;
  if (!int(t.restMin, PROMO_LIMITS.rest) || !int(t.restMax, PROMO_LIMITS.rest) || t.restMin > t.restMax) return `Пауза между офферами — от ${PROMO_LIMITS.rest[0]} до ${PROMO_LIMITS.rest[1]} мин, «от» не больше «до».`;
  if (!['day', 'session', 'off'].includes(t.carousel)) return 'Карусель: day, session или off.';
  return null;
}

export function globalProblem(g: GlobalOffer): string | null {
  if (!/^[a-z0-9_-]{1,24}$/.test(g.id)) return 'Код оффера — латиница, цифры, «_» и «-», до 24 знаков.';
  if (!OFFERS.has(g.offer)) return `Нет товара «${g.offer}».`;
  const p = priceProblem(g.price);
  if (p) return p;
  if (!time(g.from) || !time(g.to) || g.to <= g.from) return 'Начало должно быть раньше конца.';
  if (g.to - g.from > 60 * DAY) return 'Оффер — не дольше 60 дней.';
  if (!Number.isInteger(g.limit) || g.limit < 1 || g.limit > 100) return 'Лимит на игрока — от 1 до 100.';
  return null;
}

export function eventProblem(e: OpsEvent): string | null {
  if (!/^[a-z0-9_-]{1,24}$/.test(e.id)) return 'Код события — латиница, цифры, «_» и «-», до 24 знаков.';
  const def = EVENT_KIND.get(e.kind);
  if (!def) return `Нет такого события «${e.kind}».`;
  if (!time(e.from) || !time(e.to) || e.to <= e.from) return 'Начало должно быть раньше конца.';
  if (e.to - e.from > 14 * DAY) return 'Событие — не дольше 14 дней.';
  if (def.mul && (typeof e.mul !== 'number' || !(e.mul >= 1.1 && e.mul <= 5))) return 'Множитель — от 1,1 до 5.';
  if (def.region === 'zb' && !(REGION_IDS as string[]).includes(e.region ?? '')) return 'Выберите море для босса.';
  if (def.region === 'inv' && e.region && !(INV_REGIONS as string[]).includes(e.region)) return 'Вторжение бывает только в морях Хора.';
  return null;
}

// ------------------------------------------------------------------------------------------------ the retention math

export interface RetentionRow {
  cohort: string;
  size: number;
  /** Shares returned on day 1, 7 and 30 after registering (null: that day is not over yet for any of them). */
  d1: number | null;
  d7: number | null;
  d30: number | null;
}

/** D1/D7/D30 by cohort (the registration's day, or its week from Monday). An account counts as returned on day N
 *  when it was aboard on its registration day + N; it counts at all only once that day is over (before `today`). */
export function retentionTable(regs: { acc: number; day: string }[], active: Set<string>, today: string, group: 'day' | 'week'): RetentionRow[] {
  const rows = new Map<string, { size: number; e: number[]; r: number[] }>();
  const NS = [1, 7, 30];
  for (const g of regs) {
    const key = group === 'week' ? weekStart(g.day) : g.day;
    let row = rows.get(key);
    if (!row) rows.set(key, (row = { size: 0, e: [0, 0, 0], r: [0, 0, 0] }));
    row.size++;
    NS.forEach((n, i) => {
      const d = addDays(g.day, n);
      if (d >= today) return;
      row!.e[i]++;
      if (active.has(`${d}|${g.acc}`)) row!.r[i]++;
    });
  }
  return [...rows.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([cohort, x]) => ({
    cohort, size: x.size,
    d1: x.e[0] ? x.r[0] / x.e[0] : null,
    d7: x.e[1] ? x.r[1] / x.e[1] : null,
    d30: x.e[2] ? x.r[2] / x.e[2] : null,
  }));
}

// ------------------------------------------------------------------------------------------------ the store

export interface AuditRow {
  id: number;
  at: number;
  who: string;
  action: string;
  key: string;
  before: string | null;
  after: string | null;
}

const KIND_RE = /^[a-z0-9_:.-]{1,40}$/;

export class LiveOps {
  readonly db: DatabaseSync;
  private cfg = new Map<string, unknown>();
  /** The overrides by key prefix (the hot paths ask often: experience, holidays, the shop's view). */
  private lists = new Map<string, [string, unknown][]>();
  private loadedAt = 0;
  /** The funnel kinds each account has done (read once, then kept; cleared past 20 000 accounts). */
  private firsts = new Map<number, Set<string>>();
  /** The last day each account was counted aboard. */
  private seen = new Map<number, string>();
  /** For the tests: the cache's clock. */
  clock: () => number = () => Date.now();

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS ops_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL, by TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ops_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, who TEXT NOT NULL, action TEXT NOT NULL, key TEXT NOT NULL, before TEXT, after TEXT);
      CREATE TABLE IF NOT EXISTS ops_gbuys (gid TEXT NOT NULL, account_id INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (gid, account_id));
      CREATE TABLE IF NOT EXISTS ops_first (account_id INTEGER NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL, day TEXT NOT NULL, PRIMARY KEY (account_id, kind));
      CREATE INDEX IF NOT EXISTS ops_first_kind ON ops_first (kind, day);
      CREATE TABLE IF NOT EXISTS ops_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, day TEXT NOT NULL, account_id INTEGER NOT NULL, kind TEXT NOT NULL, amount INTEGER NOT NULL, product TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS ops_events_day ON ops_events (kind, day);
      CREATE TABLE IF NOT EXISTS ops_daily (day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL, amount INTEGER NOT NULL, PRIMARY KEY (day, kind));
      CREATE TABLE IF NOT EXISTS ops_active (day TEXT NOT NULL, account_id INTEGER NOT NULL, PRIMARY KEY (day, account_id));
    `);
    this.reload();
  }

  close(): void {
    this.db.close();
  }

  // ---------------------------------------------------------------------------------------------- the config

  /** The cache read again from the table. */
  reload(): void {
    const m = new Map<string, unknown>();
    for (const r of this.db.prepare('SELECT key, value FROM ops_config').all() as { key: string; value: string }[]) {
      try {
        m.set(r.key, JSON.parse(r.value));
      } catch {
        /* a broken row is no override */
      }
    }
    this.cfg = m;
    this.lists.clear();
    this.loadedAt = this.clock();
  }

  private fresh(): void {
    if (this.clock() - this.loadedAt > CACHE_MS) this.reload();
  }

  get<T>(key: string): T | undefined {
    this.fresh();
    return this.cfg.get(key) as T | undefined;
  }

  /** Every override whose key starts so, by its key. */
  list<T>(prefix: string): readonly [string, T][] {
    this.fresh();
    let l = this.lists.get(prefix);
    if (!l) this.lists.set(prefix, (l = [...this.cfg.entries()].filter(([k]) => k.startsWith(prefix))));
    return l as [string, T][];
  }

  /** An override set (null: removed), written to the audit log with who did it; the cache read again. */
  set(key: string, value: unknown, who: string, action = value === null ? 'delete' : 'set', now = Date.now()): void {
    const before = this.db.prepare('SELECT value FROM ops_config WHERE key = ?').get(key) as { value: string } | undefined;
    const after = value === null ? null : JSON.stringify(value);
    if ((before?.value ?? null) === after) return;
    const w = String(who || 'panel').slice(0, 60);
    this.db.exec('BEGIN');
    try {
      if (after === null) this.db.prepare('DELETE FROM ops_config WHERE key = ?').run(key);
      else this.db.prepare('INSERT INTO ops_config (key, value, updated_at, by) VALUES (?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, by = excluded.by').run(key, after, now, w);
      this.db.prepare('INSERT INTO ops_audit (at, who, action, key, before, after) VALUES (?, ?, ?, ?, ?, ?)').run(now, w, action, key, before?.value ?? null, after);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    this.reload();
  }

  audit(limit = 100, offset = 0): AuditRow[] {
    return this.db.prepare('SELECT id, at, who, action, key, before, after FROM ops_audit ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset) as unknown as AuditRow[];
  }

  // ---------------------------------------------------------------------------------------------- the global offers' buys

  globalBuys(gid: string, acc: number): number {
    return (this.db.prepare('SELECT n FROM ops_gbuys WHERE gid = ? AND account_id = ?').get(gid, acc) as { n: number } | undefined)?.n ?? 0;
  }

  globalBought(gid: string, acc: number): void {
    this.db.prepare('INSERT INTO ops_gbuys VALUES (?, ?, 1) ON CONFLICT (gid, account_id) DO UPDATE SET n = n + 1').run(gid, acc);
  }

  globalTotals(gid: string): { buyers: number; n: number } {
    const r = this.db.prepare('SELECT count(*) buyers, coalesce(sum(n), 0) n FROM ops_gbuys WHERE gid = ?').get(gid) as { buyers: number; n: number };
    return { buyers: r.buyers, n: r.n };
  }

  // ---------------------------------------------------------------------------------------------- the funnel

  /** Whether the account has done this kind of the funnel already. */
  has(acc: number, kind: string): boolean {
    return this.firstsOf(acc).has(kind);
  }

  private firstsOf(acc: number): Set<string> {
    let set = this.firsts.get(acc);
    if (!set) {
      if (this.firsts.size > 20_000) this.firsts.clear();
      set = new Set((this.db.prepare('SELECT kind FROM ops_first WHERE account_id = ?').all(acc) as { kind: string }[]).map((r) => r.kind));
      this.firsts.set(acc, set);
    }
    return set;
  }

  /** One event: its first time for the account, the day's count and sum, and a purchase's row. */
  track(acc: number, kind: string, at: number, data?: { amount?: number; product?: string }): void {
    if (!(Number.isSafeInteger(acc) && acc > 0) || !KIND_RE.test(kind)) return;
    const day = dayStr(at);
    if (kind === 'session') return this.active(acc, at);
    const set = this.firstsOf(acc);
    if (!set.has(kind)) {
      set.add(kind);
      this.db.prepare('INSERT OR IGNORE INTO ops_first VALUES (?, ?, ?, ?)').run(acc, kind, at, day);
    }
    const amount = Math.round(Number(data?.amount ?? 0)) || 0;
    this.db.prepare('INSERT INTO ops_daily VALUES (?, ?, 1, ?) ON CONFLICT (day, kind) DO UPDATE SET n = n + 1, amount = amount + excluded.amount').run(day, kind, amount);
    if (data && (data.amount !== undefined || data.product)) {
      this.db.prepare('INSERT INTO ops_events (at, day, account_id, kind, amount, product) VALUES (?, ?, ?, ?, ?, ?)').run(at, day, acc, kind, amount, String(data.product ?? '').slice(0, 60));
    }
    if (kind === 'register') this.active(acc, at);
  }

  /** The account aboard on this day (once a day). */
  active(acc: number, at: number): void {
    const day = dayStr(at);
    if (this.seen.get(acc) === day) return;
    if (this.seen.size > 50_000) this.seen.clear();
    this.seen.set(acc, day);
    this.db.prepare('INSERT OR IGNORE INTO ops_active VALUES (?, ?)').run(day, acc);
  }

  /** The funnel: each step's accounts and the share of the step before. `fromDay`: only the accounts registered since
   *  (null: every account the funnel knows). */
  funnel(fromDay: string | null): { kind: string; ru: string; n: number; conv: number | null; ofFirst: number | null }[] {
    const rows = (fromDay
      ? this.db.prepare(`SELECT f.kind kind, count(*) n FROM ops_first f WHERE f.account_id IN (SELECT account_id FROM ops_first WHERE kind = 'register' AND day >= ?) GROUP BY f.kind`).all(fromDay)
      : this.db.prepare('SELECT kind, count(*) n FROM ops_first GROUP BY kind').all()) as { kind: string; n: number }[];
    const by = new Map(rows.map((r) => [r.kind, r.n]));
    const first = by.get(FUNNEL[0].kind) ?? 0;
    return FUNNEL.map((f, i) => {
      const n = by.get(f.kind) ?? 0;
      const prev = i ? by.get(FUNNEL[i - 1].kind) ?? 0 : 0;
      return { kind: f.kind, ru: f.ru, n, conv: i && prev ? n / prev : null, ofFirst: first ? n / first : null };
    });
  }

  /** How many accounts did a kind (null: all; else only the accounts registered since that day). */
  count(kind: string, fromDay: string | null = null): number {
    const r = (fromDay
      ? this.db.prepare(`SELECT count(*) n FROM ops_first WHERE kind = ? AND account_id IN (SELECT account_id FROM ops_first WHERE kind = 'register' AND day >= ?)`).get(kind, fromDay)
      : this.db.prepare('SELECT count(*) n FROM ops_first WHERE kind = ?').get(kind)) as { n: number };
    return r.n;
  }

  retention(group: 'day' | 'week', days: number, now: number): RetentionRow[] {
    const today = dayStr(now);
    const from = addDays(today, -days);
    const regs = (this.db.prepare(`SELECT account_id acc, day FROM ops_first WHERE kind = 'register' AND day >= ?`).all(from) as { acc: number; day: string }[]);
    const active = new Set((this.db.prepare('SELECT day, account_id acc FROM ops_active WHERE day >= ?').all(from) as { day: string; acc: number }[]).map((r) => `${r.day}|${r.acc}`));
    return retentionTable(regs, active, today, group);
  }

  /** Day by day: revenue (top-ups less refunds, ₽ ≈ doubloons of the pack), doubloons spent, players aboard, registrations. */
  daily(days: number, now: number): { day: string; revenue: number; payments: number; spent: number; buys: number; dau: number; regs: number }[] {
    const today = dayStr(now);
    const from = addDays(today, -(days - 1));
    const d = new Map<string, { day: string; revenue: number; payments: number; spent: number; buys: number; dau: number; regs: number }>();
    for (let i = 0; i < days; i++) {
      const day = addDays(from, i);
      d.set(day, { day, revenue: 0, payments: 0, spent: 0, buys: 0, dau: 0, regs: 0 });
    }
    for (const r of this.db.prepare(`SELECT day, kind, n, amount FROM ops_daily WHERE day >= ? AND kind IN ('topup', 'refund', 'buy', 'register')`).all(from) as { day: string; kind: string; n: number; amount: number }[]) {
      const x = d.get(r.day);
      if (!x) continue;
      if (r.kind === 'topup') {
        x.revenue += r.amount;
        x.payments += r.n;
      } else if (r.kind === 'refund') x.revenue -= r.amount;
      else if (r.kind === 'buy') {
        x.spent += r.amount;
        x.buys += r.n;
      } else x.regs += r.n;
    }
    for (const r of this.db.prepare('SELECT day, count(*) n FROM ops_active WHERE day >= ? GROUP BY day').all(from) as { day: string; n: number }[]) {
      const x = d.get(r.day);
      if (x) x.dau = r.n;
    }
    return [...d.values()].reverse();
  }

  /** Over the last `days`: revenue, players aboard, payers, ARPU, ARPPU and the paying share. */
  money(days: number, now: number): { revenue: number; active: number; payers: number; arpu: number; arppu: number; share: number } {
    const from = addDays(dayStr(now), -(days - 1));
    const sum = (k: string) => (this.db.prepare('SELECT coalesce(sum(amount), 0) s FROM ops_events WHERE kind = ? AND day >= ?').get(k, from) as { s: number }).s;
    const revenue = sum('topup') - sum('refund');
    const payers = (this.db.prepare(`SELECT count(DISTINCT account_id) n FROM ops_events WHERE kind = 'topup' AND day >= ?`).get(from) as { n: number }).n;
    const active = (this.db.prepare('SELECT count(DISTINCT account_id) n FROM ops_active WHERE day >= ?').get(from) as { n: number }).n;
    return { revenue, active, payers, arpu: active ? revenue / active : 0, arppu: payers ? revenue / payers : 0, share: active ? payers / active : 0 };
  }

  /** The best sellers over the last `days`: shop purchases by doubloons, and the top-up packs. */
  top(kind: 'buy' | 'topup', days: number, now: number, limit = 15): { product: string; n: number; sum: number; buyers: number }[] {
    const from = addDays(dayStr(now), -(days - 1));
    return this.db.prepare('SELECT product, count(*) n, sum(amount) sum, count(DISTINCT account_id) buyers FROM ops_events WHERE kind = ? AND day >= ? GROUP BY product ORDER BY sum DESC, n DESC LIMIT ?').all(kind, from, limit) as { product: string; n: number; sum: number; buyers: number }[];
  }

  /** The day's count of a kind (its first times and repeats). */
  todayCount(kind: string, now: number): number {
    return (this.db.prepare('SELECT n FROM ops_daily WHERE day = ? AND kind = ?').get(dayStr(now), kind) as { n: number } | undefined)?.n ?? 0;
  }
}

// ------------------------------------------------------------------------------------------------ the game's side

const attached = new WeakMap<Game, LiveOps>();

/** The live ops of a world (main.ts attaches them; the registrations are counted from the accounts' service). */
export function attachLiveOps(game: Game, ops: LiveOps): void {
  attached.set(game, ops);
  const prev = game.auth.onCreated;
  game.auth.onCreated = (id: number) => {
    prev?.(id);
    trackEvent(game, id, 'register');
  };
}

export function detachLiveOps(game: Game): void {
  attached.delete(game);
}

export const opsOf = (game: Game): LiveOps | null => attached.get(game) ?? null;

/** One event of the funnel or a purchase for an account: never throws into the game. */
export function trackEvent(game: Game, accountId: number, kind: string, data?: { amount?: number; product?: string }): void {
  const ops = attached.get(game);
  if (!ops) return;
  try {
    ops.track(accountId, kind, game.wallNow(), data);
  } catch (e) {
    game.log(`[liveops] ${kind}: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------------------------------------- the shop's prices

export function priceRule(game: Game, offerId: string): PriceRule | undefined {
  return attached.get(game)?.get<PriceRule>(`price:${offerId}`);
}

/** The sale on an offer now (its share, its end and the price before it), or null. */
export function saleOf(game: Game, offer: ShopOffer): { pct: number; until: number; was: number } | null {
  const r = priceRule(game, offer.id);
  const s = r?.sale;
  if (!s) return null;
  const now = game.wallNow();
  if (now < s.from || now >= s.to) return null;
  return { pct: s.pct, until: s.to, was: r.price ?? offer.price };
}

/** An offer's price now: the panel's own (or the catalog's), less a sale running. */
export function opsPrice(game: Game, offer: ShopOffer): number {
  const r = priceRule(game, offer.id);
  if (!r) return offer.price;
  const base = r.price ?? offer.price;
  const s = saleOf(game, offer);
  return s ? salePrice(base, s.pct) : base;
}

/** The offer is taken off the shelves by the panel. */
export function opsShut(game: Game, offerId: string): boolean {
  return priceRule(game, offerId)?.off === true;
}

// ---------------------------------------------------------------------------------------------- the offers

export function promoTune(game: Game): PromoTune | null {
  return attached.get(game)?.get<PromoTune>('promo') ?? null;
}

/** The global offers running now. */
export function liveGlobals(game: Game): GlobalOffer[] {
  const ops = attached.get(game);
  if (!ops) return [];
  const now = game.wallNow();
  return ops.list<GlobalOffer>('global:').map(([, g]) => g).filter((g) => now >= g.from && now < g.to && OFFERS.has(g.offer));
}

// ---------------------------------------------------------------------------------------------- the events

export function liveEvents(game: Game, now = game.wallNow()): OpsEvent[] {
  const ops = attached.get(game);
  if (!ops) return [];
  return ops.list<OpsEvent>('event:').map(([, e]) => e).filter((e) => now >= e.from && now < e.to);
}

const mulOf = (game: Game, kind: string): number => liveEvents(game).filter((e) => e.kind === kind).reduce((m, e) => Math.max(m, e.mul ?? 1), 1);
/** Experience ×N while an «xp» event runs (1 otherwise). */
export const opsXpMul = (game: Game): number => (attached.has(game) ? mulOf(game, 'xp') : 1);
/** Plunder and quests' silver ×N while a «silver» event runs (1 otherwise). */
export const opsSilverMul = (game: Game): number => (attached.has(game) ? mulOf(game, 'silver') : 1);

/** A holiday the panel scheduled, running now (it comes before the calendar's). */
export function opsHoliday(game: Game): { id: HolidayId; start: number; end: number } | null {
  if (!attached.has(game)) return null;
  const e = liveEvents(game).find((x) => x.kind.startsWith('holiday:') && HOLIDAYS[x.kind.slice(8) as HolidayId]);
  return e ? { id: e.kind.slice(8) as HolidayId, start: e.from, end: e.to } : null;
}

/** The world's side of a trigger (events.ts, invasions.ts, zonebosses.ts give them; main.ts / tests set them). */
export interface OpsFirers {
  happening(game: Game, kind: string): boolean;
  invasion(game: Game, region: RegionId | undefined): boolean;
  zboss(game: Game, region: RegionId): boolean;
}
let firers: OpsFirers | null = null;
export function setOpsFirers(f: OpsFirers): void {
  firers = f;
}

/** A trigger's event fired now (once; marked in its row and the audit log as the system's). */
export function fireEvent(game: Game, ops: LiveOps, e: OpsEvent, now: number): boolean {
  if (!firers) return false;
  const region = e.region && (REGION_IDS as string[]).includes(e.region) ? (e.region as RegionId) : undefined;
  let ok = false;
  if (e.kind.startsWith('happening:')) ok = firers.happening(game, e.kind.slice(10));
  else if (e.kind === 'invasion') ok = firers.invasion(game, region);
  else if (e.kind === 'zboss' && region) ok = firers.zboss(game, region);
  ops.set(`event:${e.id}`, { ...e, fired: now }, 'система', 'fire', Date.now());
  game.log(`[liveops] event ${e.id} (${e.kind}${region ? ` ${REGIONS[region].name}` : ''}) ${ok ? 'fired' : 'could not fire'}`);
  return ok;
}

const lastProbe = new WeakMap<Game, number>();

/** Every second (Game.everySecond): every five, the triggers due fired, and each captain aboard looked at for the
 *  funnel — the day aboard, her first fight at sea and boarding, her first quest taken and done, her island. */
export function stepLiveOps(game: Game): void {
  const ops = attached.get(game);
  if (!ops) return;
  const now = game.wallNow();
  if (now - (lastProbe.get(game) ?? 0) < 5000) return;
  lastProbe.set(game, now);
  try {
    for (const e of liveEvents(game, now)) if (EVENT_KIND.get(e.kind)?.mode === 'trigger' && !e.fired) fireEvent(game, ops, e, now);
    for (const s of game.sessions) {
      if (!s.authed || !(s.accountId > 0)) continue;
      ops.active(s.accountId, now);
      const p = s.profile;
      const ship = s.ship;
      if (!p) continue;
      const mark = (kind: string, cond: boolean) => {
        if (cond && !ops.has(s.accountId, kind)) ops.track(s.accountId, kind, now);
      };
      mark('sea_fight', !!ship && (ship.inCombat(game.now) || p.stats.sunk > 0));
      mark('boarding', !!ship?.boarding || p.stats.boarded > 0);
      mark('quest_taken', p.quests.active.length > 0 || p.quests.done.length > 0);
      mark('quest_done', p.quests.done.length > 0);
      if (!ops.has(s.accountId, 'island') && ownIsland(game, s.accountId)) ops.track(s.accountId, 'island', now);
    }
  } catch (e) {
    game.log(`[liveops] step: ${(e as Error).message}`);
  }
}
