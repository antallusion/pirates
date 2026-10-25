// Real-device telemetry (docs/33 §Телеметрия): phones and desktops send, batched, what the game felt like on them —
// frames per second by scene, how long the loading screens took, the JS errors with their stacks, the device's class
// and memory — and this keeps only DAILY AGGREGATES of it in its own SQLite file (data/telemetry.db next to the game's
// database; nothing in the game's own). No personal data: a device is its class (system, phone or not, Telegram or
// not); the only id is a hash of a random id the page made for itself, to count devices.
//
//   POST /telemetry          a report (16 KB at most, 6 a minute from an address)
//   GET  /telemetry/admin    the owner's page: a form for TELEMETRY_TOKEN (from game.env), then the tables; the token
//                            becomes an HttpOnly cookie (its HMAC), never a URL. Without TELEMETRY_TOKEN: 404.
// The in-game admin console's /telemetry and the bot's /telemetry (TELEGRAM_ADMIN_IDS) read summary().

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { clientIp } from '../net/conn.ts';

const MAX_BODY = 16 * 1024;
/** FPS bins of 5: [0,5), [5,10) … [55,60), 60+. */
const FPS_BINS = 13;
/** Load-time bins (ms upper bounds), the last open. */
const LOAD_EDGES = [250, 500, 1000, 2000, 4000, 8000, 16000];
const SCENES = new Set(['sea', 'port', 'battle', 'isle', 'menu', 'other']);
const LOADS = new Set(['boot', 'start', 'isle', 'sea', 'battle']);
/** The funnel's steps a page may report of itself (the rest the server marks: funnel.ts). */
const CLIENT_FUNNEL = new Set(['cap_screen']);
const FUNNEL_KIND = /^[a-z0-9_:.-]{1,40}$/;
const KEEP_DAYS = 60;

export interface TelemetryReport {
  v?: number;
  id?: string;
  tg?: boolean;
  mob?: boolean;
  plat?: string;
  ua?: string;
  dpr?: number;
  cores?: number;
  mem?: number;
  heap?: number;
  fps?: Record<string, number[]>;
  loads?: { k: string; ms: number; to?: boolean }[];
  errs?: { m: string; s?: string; n?: number }[];
  /** Funnel steps this page reached (CLIENT_FUNNEL). */
  funnel?: string[];
}

/** The newcomers' funnel (retention, 2026-10-25): each day, how many (distinct, anonymous) reached each step. */
export interface FunnelSummary {
  days: number;
  /** step → distinct reached, over the days */
  total: Record<string, number>;
  /** day → step → distinct reached */
  byDay: Record<string, Record<string, number>>;
}

export interface TelemetrySummary {
  days: number;
  reports: number;
  devices: number;
  fps: { scene: string; dev: string; p50: number; p95: number; n: number }[];
  loads: { kind: string; dev: string; p50: number; p95: number; n: number; timeouts: number }[];
  errors: { msg: string; stack: string; n: number; dev: string; last: number }[];
  devs: { dev: string; reports: number; devices: number; mem: number | null; heap: number | null }[];
}

const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);

/** The device's class from what it says of itself: system, phone, Telegram. */
export function deviceClass(r: TelemetryReport, ua: string): string {
  const s = `${r.plat ?? ''} ${ua}`.toLowerCase();
  const os = /android/.test(s) ? 'android' : /iphone|ipad|ipod|ios/.test(s) ? 'ios' : /windows|win32|win64/.test(s) ? 'windows' : /mac/.test(s) ? 'mac' : /linux|cros/.test(s) ? 'linux' : 'other';
  const mob = r.mob === true || /mobi|android|iphone|ipad/.test(s);
  return `${os}${mob && os !== 'android' && os !== 'ios' ? '-mobile' : ''}${r.tg ? '-tg' : ''}`;
}

/** A percentile from a histogram of bins with these lower bounds. */
function pctl(bins: number[], lower: (i: number) => number, p: number): number {
  const total = bins.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  let acc = 0;
  for (let i = 0; i < bins.length; i++) {
    acc += bins[i];
    if (acc >= total * p) return lower(i);
  }
  return lower(bins.length - 1);
}

export class Telemetry {
  private db: DatabaseSync;
  private hits = new Map<string, { n: number; at: number }>();
  private logins = new Map<string, { n: number; at: number }>();
  private prunedOn = '';

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS tel_dev (day TEXT, dev TEXT, reports INTEGER, mem_sum REAL, mem_n INTEGER, heap_sum REAL, heap_n INTEGER, PRIMARY KEY (day, dev));
      CREATE TABLE IF NOT EXISTS tel_ids (day TEXT, dev TEXT, id TEXT, PRIMARY KEY (day, id));
      CREATE TABLE IF NOT EXISTS tel_fps (day TEXT, scene TEXT, dev TEXT, bins TEXT, PRIMARY KEY (day, scene, dev));
      CREATE TABLE IF NOT EXISTS tel_load (day TEXT, kind TEXT, dev TEXT, bins TEXT, timeouts INTEGER, PRIMARY KEY (day, kind, dev));
      CREATE TABLE IF NOT EXISTS tel_err (day TEXT, key TEXT, msg TEXT, stack TEXT, dev TEXT, n INTEGER, last INTEGER, PRIMARY KEY (day, key));
      CREATE TABLE IF NOT EXISTS tel_funnel (day TEXT, kind TEXT, id TEXT, PRIMARY KEY (day, kind, id));
    `);
  }

  close(): void {
    this.db.close();
  }

  /** One report folded into today's aggregates. */
  ingest(r: TelemetryReport, ua: string, now = Date.now()): void {
    const d = day(now);
    const dev = deviceClass(r, ua);
    const db = this.db;
    if (this.prunedOn !== d) {
      this.prunedOn = d;
      this.prune(now);
    }
    const mem = num(r.mem, 0, 64), heap = num(r.heap, 0, 16384);
    db.prepare(`INSERT INTO tel_dev VALUES (?, ?, 1, ?, ?, ?, ?) ON CONFLICT (day, dev) DO UPDATE SET reports = reports + 1,
      mem_sum = mem_sum + excluded.mem_sum, mem_n = mem_n + excluded.mem_n, heap_sum = heap_sum + excluded.heap_sum, heap_n = heap_n + excluded.heap_n`)
      .run(d, dev, mem ?? 0, mem === null ? 0 : 1, heap ?? 0, heap === null ? 0 : 1);
    if (typeof r.id === 'string' && /^[\w-]{6,64}$/.test(r.id)) {
      const id = createHash('sha256').update(r.id).digest('hex').slice(0, 16);
      db.prepare('INSERT OR IGNORE INTO tel_ids VALUES (?, ?, ?)').run(d, dev, id);
    }
    for (const [scene, raw] of Object.entries(r.fps ?? {}).slice(0, 8)) {
      if (!SCENES.has(scene) || !Array.isArray(raw)) continue;
      const add = Array.from({ length: FPS_BINS }, (_, i) => Math.round(num(raw[i], 0, 100_000) ?? 0));
      if (!add.some((x) => x > 0)) continue;
      this.addBins('tel_fps', 'scene', d, scene, dev, add);
    }
    for (const l of (Array.isArray(r.loads) ? r.loads : []).slice(0, 30)) {
      const ms = num(l?.ms, 0, 600_000);
      if (ms === null || !LOADS.has(String(l.k))) continue;
      const add = new Array<number>(LOAD_EDGES.length + 1).fill(0);
      const i = LOAD_EDGES.findIndex((e) => ms < e);
      add[i < 0 ? LOAD_EDGES.length : i] = 1;
      this.addBins('tel_load', 'kind', d, String(l.k), dev, add, l.to ? 1 : 0);
    }
    // the funnel's steps the page saw itself (the captain's screen), counted once a day for its id
    if (typeof r.id === 'string' && /^[\w-]{6,64}$/.test(r.id)) {
      for (const k of (Array.isArray(r.funnel) ? r.funnel : []).slice(0, 4)) if (CLIENT_FUNNEL.has(String(k))) this.mark(String(k), `dev:${r.id}`, now);
    }
    for (const e of (Array.isArray(r.errs) ? r.errs : []).slice(0, 10)) {
      const msg = String(e?.m ?? '').slice(0, 300);
      if (!msg) continue;
      const stack = String(e.s ?? '').slice(0, 1500);
      const top = stack.split('\n').find((x) => /\.(ts|js)/.test(x))?.trim().replace(/\?[^:)]*/, '') ?? '';
      const key = createHash('sha256').update(`${msg}\n${top}`).digest('hex').slice(0, 20);
      const n = Math.round(num(e.n, 1, 1000) ?? 1);
      db.prepare(`INSERT INTO tel_err VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = n + excluded.n, last = excluded.last, stack = excluded.stack`)
        .run(d, key, msg, stack, dev, n, now);
    }
  }

  private prune(now: number): void {
    const old = day(now - KEEP_DAYS * 86400_000);
    for (const t of ['tel_dev', 'tel_ids', 'tel_fps', 'tel_load', 'tel_err', 'tel_funnel']) this.db.prepare(`DELETE FROM ${t} WHERE day < ?`).run(old);
  }

  /** A step of the newcomers' funnel reached by `who` (an account or a page; kept only as a hash): once a day each. */
  mark(kind: string, who: string, now = Date.now()): void {
    if (!FUNNEL_KIND.test(kind) || !who) return;
    const d = day(now);
    if (this.prunedOn !== d) {
      this.prunedOn = d;
      this.prune(now);
    }
    const id = createHash('sha256').update(`gt-funnel:${who}`).digest('hex').slice(0, 16);
    this.db.prepare('INSERT OR IGNORE INTO tel_funnel VALUES (?, ?, ?)').run(d, kind, id);
  }

  /** The funnel of the last `days` days (today included). */
  funnel(days = 3, now = Date.now()): FunnelSummary {
    const from = day(now - (days - 1) * 86400_000);
    const rows = this.db.prepare('SELECT day, kind, count(*) n FROM tel_funnel WHERE day >= ? GROUP BY day, kind').all(from) as { day: string; kind: string; n: number }[];
    const total: Record<string, number> = {};
    const byDay: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      total[r.kind] = (total[r.kind] ?? 0) + r.n;
      (byDay[r.day] ??= {})[r.kind] = r.n;
    }
    return { days, total, byDay };
  }

  private addBins(table: 'tel_fps' | 'tel_load', col: 'scene' | 'kind', d: string, k: string, dev: string, add: number[], timeouts = 0): void {
    const row = this.db.prepare(`SELECT bins FROM ${table} WHERE day = ? AND ${col} = ? AND dev = ?`).get(d, k, dev) as { bins: string } | undefined;
    const bins = row ? (JSON.parse(row.bins) as number[]) : new Array<number>(add.length).fill(0);
    for (let i = 0; i < add.length; i++) bins[i] = (bins[i] ?? 0) + add[i];
    if (table === 'tel_fps') this.db.prepare('INSERT OR REPLACE INTO tel_fps VALUES (?, ?, ?, ?)').run(d, k, dev, JSON.stringify(bins));
    else {
      const t = row ? ((this.db.prepare('SELECT timeouts FROM tel_load WHERE day = ? AND kind = ? AND dev = ?').get(d, k, dev) as { timeouts: number }).timeouts) : 0;
      this.db.prepare('INSERT OR REPLACE INTO tel_load VALUES (?, ?, ?, ?, ?)').run(d, k, dev, JSON.stringify(bins), t + timeouts);
    }
  }

  /** The last `days` days (today included), all devices together and by class. */
  summary(days = 1, now = Date.now()): TelemetrySummary {
    const from = day(now - (days - 1) * 86400_000);
    const db = this.db;
    const merge = <T extends string>(rows: { k: T; dev: string; bins: string; timeouts?: number }[]) => {
      const m = new Map<string, { k: T; dev: string; bins: number[]; timeouts: number }>();
      for (const r of rows) for (const dev of [r.dev, 'all']) {
        const key = `${r.k}|${dev}`;
        const b = JSON.parse(r.bins) as number[];
        const x = m.get(key) ?? { k: r.k, dev, bins: new Array<number>(b.length).fill(0), timeouts: 0 };
        b.forEach((v, i) => (x.bins[i] += v));
        x.timeouts += r.timeouts ?? 0;
        m.set(key, x);
      }
      return [...m.values()];
    };
    const fps = merge(db.prepare('SELECT scene k, dev, bins FROM tel_fps WHERE day >= ?').all(from) as { k: string; dev: string; bins: string }[])
      .map((x) => ({ scene: x.k, dev: x.dev, n: x.bins.reduce((a, b) => a + b, 0), p50: pctl(x.bins, (i) => i * 5, 0.5), p95: pctl(x.bins, (i) => i * 5, 0.05) }))
      .sort((a, b) => b.n - a.n);
    // (a load's time is told by its bin's upper bound: «within 1 s»; the open bin as 16 s and more)
    const loadUpper = (i: number) => LOAD_EDGES[i] ?? LOAD_EDGES[LOAD_EDGES.length - 1];
    const loads = merge(db.prepare('SELECT kind k, dev, bins, timeouts FROM tel_load WHERE day >= ?').all(from) as { k: string; dev: string; bins: string; timeouts: number }[])
      .map((x) => ({ kind: x.k, dev: x.dev, n: x.bins.reduce((a, b) => a + b, 0), p50: pctl(x.bins, loadUpper, 0.5), p95: pctl(x.bins, loadUpper, 0.95), timeouts: x.timeouts }))
      .sort((a, b) => b.n - a.n);
    const errors = (db.prepare('SELECT msg, max(stack) stack, sum(n) n, max(dev) dev, max(last) last FROM tel_err WHERE day >= ? GROUP BY key ORDER BY n DESC LIMIT 30').all(from) as TelemetrySummary['errors']);
    const devRows = db.prepare('SELECT dev, sum(reports) reports, sum(mem_sum) ms, sum(mem_n) mn, sum(heap_sum) hs, sum(heap_n) hn FROM tel_dev WHERE day >= ? GROUP BY dev ORDER BY reports DESC').all(from) as { dev: string; reports: number; ms: number; mn: number; hs: number; hn: number }[];
    const ids = new Map((db.prepare('SELECT dev, count(DISTINCT id) n FROM tel_ids WHERE day >= ? GROUP BY dev').all(from) as { dev: string; n: number }[]).map((r) => [r.dev, r.n]));
    const devs = devRows.map((r) => ({ dev: r.dev, reports: r.reports, devices: ids.get(r.dev) ?? 0, mem: r.mn ? Math.round((r.ms / r.mn) * 10) / 10 : null, heap: r.hn ? Math.round(r.hs / r.hn) : null }));
    const devices = (db.prepare('SELECT count(DISTINCT id) n FROM tel_ids WHERE day >= ?').get(from) as { n: number }).n;
    return { days, reports: devs.reduce((a, d) => a + d.reports, 0), devices, fps, loads, errors, devs };
  }

  /** The short line of the admin console and the bot. */
  line(days = 1): { reports: number; devices: number; p50: number; p95: number; boot: number; errors: number } {
    const s = this.summary(days);
    const all = (k: string) => s.fps.filter((f) => f.dev === 'all' && f.scene === k)[0];
    const sea = all('sea') ?? s.fps.find((f) => f.dev === 'all');
    const boot = s.loads.find((l) => l.dev === 'all' && l.kind === 'boot');
    return { reports: s.reports, devices: s.devices, p50: sea?.p50 ?? 0, p95: sea?.p95 ?? 0, boot: boot ? Math.round(boot.p50 / 100) / 10 : 0, errors: s.errors.reduce((a, e) => a + e.n, 0) };
  }

  // ------------------------------------------------------------------------------------------------ HTTP

  async handle(req: IncomingMessage, res: ServerResponse, token = process.env.TELEMETRY_TOKEN ?? ''): Promise<boolean> {
    const url = req.url ?? '';
    if (url === '/telemetry') return this.post(req, res);
    if (url === '/telemetry/admin' || url.startsWith('/telemetry/admin?')) return this.admin(req, res, token);
    return false;
  }

  private limited(req: IncomingMessage, per: number, hits = this.hits): boolean {
    const ip = clientIp(req);
    const now = Date.now();
    const h = hits.get(ip);
    if (h && now - h.at < 60_000 && h.n >= per) return true;
    if (!h || now - h.at >= 60_000) hits.set(ip, { n: 1, at: now });
    else h.n++;
    if (hits.size > 5000) hits.clear();
    return false;
  }

  private async body(req: IncomingMessage): Promise<string | null> {
    let size = 0;
    const parts: Buffer[] = [];
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > MAX_BODY) return null;
      parts.push(c as Buffer);
    }
    return Buffer.concat(parts).toString('utf8');
  }

  private async post(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (req.method !== 'POST') return done(res, 405);
    if (this.limited(req, 6)) {
      req.resume();
      return done(res, 429);
    }
    try {
      const text = await this.body(req);
      if (text) this.ingest(JSON.parse(text) as TelemetryReport, String(req.headers['user-agent'] ?? ''));
    } catch {
      /* a broken report says nothing */
    }
    res.writeHead(204).end();
    return true;
  }

  private async admin(req: IncomingMessage, res: ServerResponse, token: string): Promise<boolean> {
    if (token.length < 16) return done(res, 404, { 'Content-Type': 'text/plain' }, 'Not found');
    const mac = createHmac('sha256', token).update('gravetide-telemetry').digest('hex');
    const head = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'", 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' };
    if (req.method === 'POST') {
      if (this.limited(req, 5, this.logins)) return done(res, 429);
      const form = new URLSearchParams((await this.body(req)) ?? '');
      const given = Buffer.from(form.get('token') ?? '');
      const want = Buffer.from(token);
      if (given.length !== want.length || !timingSafeEqual(given, want)) return done(res, 403, head, page('Телеметрия', '<p>Неверный ключ.</p>' + loginForm()));
      const secure = req.headers['x-forwarded-proto'] === 'https' || (process.env.PUBLIC_URL ?? '').startsWith('https:');
      res.writeHead(303, { Location: '/telemetry/admin', 'Set-Cookie': `gt_tel=${mac}; Path=/telemetry; HttpOnly; SameSite=Strict; Max-Age=2592000${secure ? '; Secure' : ''}`, 'Cache-Control': 'no-store' }).end();
      return true;
    }
    const cookie = /(?:^|;\s*)gt_tel=([0-9a-f]{64})/.exec(String(req.headers.cookie ?? ''))?.[1] ?? '';
    if (cookie.length !== mac.length || !timingSafeEqual(Buffer.from(cookie), Buffer.from(mac))) return done(res, 200, head, page('Телеметрия', loginForm()));
    const days = Math.max(1, Math.min(60, Number(new URL(req.url ?? '', 'http://x').searchParams.get('days') ?? 7) || 7));
    res.writeHead(200, head).end(page(`Телеметрия · ${days} дн.`, this.html(this.summary(days))));
    return true;
  }

  html(s: TelemetrySummary): string {
    const t = (cols: string[], rows: (string | number | null)[][]) =>
      `<table><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(String(c ?? '—'))}</td>`).join('')}</tr>`).join('')}</table>`;
    return `<p>Отчётов: <b>${s.reports}</b> · устройств: <b>${s.devices}</b> · дни: ${[1, 7, 30].map((d) => `<a href="?days=${d}">${d}</a>`).join(' ')}</p>
<h2>Кадры в секунду (p50 / p95 — худшие 5 %)</h2>${t(['Сцена', 'Устройства', 'p50', 'p95', 'Секунд'], s.fps.map((f) => [f.scene, f.dev, f.p50, f.p95, f.n]))}
<h2>Загрузки, мс (p50 / p95)</h2>${t(['Что', 'Устройства', 'p50', 'p95', 'Раз', 'Таймаутов'], s.loads.map((l) => [l.kind, l.dev, l.p50, l.p95, l.n, l.timeouts]))}
<h2>Воронка новичков по дням (уникальные)</h2>${funnelTable(this.funnel(Math.min(s.days, 14)), t)}
<h2>Устройства</h2>${t(['Класс', 'Отчётов', 'Устройств', 'Память, ГБ', 'JS heap, МБ'], s.devs.map((d) => [d.dev, d.reports, d.devices, d.mem, d.heap]))}
<h2>Ошибки JS</h2>${s.errors.length ? s.errors.map((e) => `<details><summary><b>${e.n}×</b> ${esc(e.msg)} <small>${esc(e.dev)}, ${new Date(e.last).toISOString().slice(0, 16).replace('T', ' ')}</small></summary><pre>${esc(e.stack)}</pre></details>`).join('') : '<p>Нет.</p>'}`;
  }
}

/** The funnel's steps in their order, with their Russian names (the admin page's table, the /ops line). */
export const FUNNEL_STEPS: { kind: string; ru: string; en: string }[] = [
  { kind: 'cap_screen', ru: 'Экран капитана', en: 'Captain screen' },
  { kind: 'captain', ru: 'Капитан создан', en: 'Captain made' },
  ...[0, 1, 2, 3, 4].map((i) => ({ kind: `fw${i}`, ru: `Вахта: шаг ${i + 1}`, en: `Watch: step ${i + 1}` })),
  { kind: 'fw_done', ru: 'Вахта пройдена', en: 'Watch done' },
  { kind: 'fw_skip', ru: 'Вахта пропущена', en: 'Watch skipped' },
  ...[0, 1, 2, 3].map((i) => ({ kind: `c01_01:${i}`, ru: `Лавки: шаг ${i + 1}`, en: `Shops: step ${i + 1}` })),
  ...[2, 3, 4, 5].map((i) => ({ kind: `c01_0${i}:0`, ru: `Глава 1: задание ${i}`, en: `Chapter 1: quest ${i}` })),
  { kind: 'play5', ru: '5 мин в игре', en: '5 min aboard' },
  { kind: 'play15', ru: '15 мин в игре', en: '15 min aboard' },
  { kind: 'play30', ru: '30 мин в игре', en: '30 min aboard' },
];

/** The funnel numbers of a summary in the steps' order (a missing one is 0). */
export function funnelNums(f: FunnelSummary, kinds: string[]): number[] {
  return kinds.map((k) => f.total[k] ?? 0);
}

/** The short funnel line of /ops (English; its Russian pair in client/src/lang/server.ru.admin.ts) and its Russian twin for
 *  the bot (opsLineRu). */
export function funnelLine(f: FunnelSummary): string {
  const n = (ks: string[]) => funnelNums(f, ks).join('/');
  return `Newcomers' funnel, ${f.days} d: captain screen ${f.total.cap_screen ?? 0} → captain ${f.total.captain ?? 0}; First Watch steps 1–5 ${n(['fw0', 'fw1', 'fw2', 'fw3', 'fw4'])}, done ${f.total.fw_done ?? 0}, skipped ${f.total.fw_skip ?? 0}; the shops' steps 1–4 ${n(['c01_01:0', 'c01_01:1', 'c01_01:2', 'c01_01:3'])}; chapter 1 quests 2–5 ${n(['c01_02:0', 'c01_03:0', 'c01_04:0', 'c01_05:0'])}; 5/15/30 min aboard ${n(['play5', 'play15', 'play30'])}.`;
}
export function funnelLineRu(f: FunnelSummary): string {
  const n = (ks: string[]) => funnelNums(f, ks).join('/');
  return `Воронка новичков за ${f.days} дн.: экран капитана ${f.total.cap_screen ?? 0} → капитан ${f.total.captain ?? 0}; Первая вахта, шаги 1–5: ${n(['fw0', 'fw1', 'fw2', 'fw3', 'fw4'])}, пройдена ${f.total.fw_done ?? 0}, пропущена ${f.total.fw_skip ?? 0}; лавки, шаги 1–4: ${n(['c01_01:0', 'c01_01:1', 'c01_01:2', 'c01_01:3'])}; глава 1, задания 2–5: ${n(['c01_02:0', 'c01_03:0', 'c01_04:0', 'c01_05:0'])}; 5/15/30 мин в игре: ${n(['play5', 'play15', 'play30'])}.`;
}

function funnelTable(f: FunnelSummary, t: (cols: string[], rows: (string | number | null)[][]) => string): string {
  const days = Object.keys(f.byDay).sort().reverse();
  if (!days.length) return '<p>Пока пусто.</p>';
  return t(['Шаг', ...days, 'Всего'], FUNNEL_STEPS.map((st) => [st.ru, ...days.map((d) => f.byDay[d][st.kind] ?? 0), f.total[st.kind] ?? 0]));
}

function done(res: ServerResponse, code: number, headers: Record<string, string> = {}, body = ''): true {
  res.writeHead(code, headers).end(body);
  return true;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const loginForm = () => '<form method="post"><input type="password" name="token" placeholder="TELEMETRY_TOKEN" autocomplete="current-password" required> <button>Войти</button></form>';
const page = (title: string, body: string) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{font:14px/1.45 system-ui,sans-serif;background:#14161a;color:#ddd;margin:16px;max-width:1100px}h1{font-size:20px}h2{font-size:16px;margin-top:22px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #333;padding:4px 8px;text-align:left}th{color:#9aa}a{color:#c9a96e}pre{white-space:pre-wrap;font-size:12px;background:#1d2026;padding:8px}input,button{font:inherit;padding:6px 10px}details{margin:4px 0}</style></head><body><h1>GRAVETIDE · ${esc(title)}</h1>${body}</body></html>`;

/** The world's telemetry (main.ts sets it; the admin console and the bot read it; tests may have none). */
let current: Telemetry | null = null;
export const setTelemetry = (t: Telemetry | null): void => void (current = t);
export const telemetry = (): Telemetry | null => current;
