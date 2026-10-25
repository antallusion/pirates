// The live ops' panel (owner, 2026-10-16: «да»; docs/34_LIVEOPS.md): the owner's page to tune the shop's prices, the
// offers and the sea's events without a deploy, and to read the funnel, the retention and the money.
//
//   GET  /ops/admin[?tab=…]   the panel (a form for OPS_TOKEN first); tabs: сводка, цены, офферы, события, воронка, журнал
//   POST /ops/admin           the sign-in: the token (and a name for the audit log) → an HttpOnly cookie (the token's
//                             HMAC, never the token itself and never in a URL)
//   POST /ops/admin/act       a change (the cookie and the form's own check), then back to the tab
//   POST /ops/admin/out       the cookie forgotten
// Without OPS_TOKEN in the environment (16 characters at least) every /ops address answers 404; without the cookie
// only the sign-in form is shown, and every other address under /ops answers 404.

import { funnelLineRu, telemetry } from './telemetry.ts';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { OFFERS, PRICE_MAX, PRICE_MIN, SHOP } from '../../../shared/src/data/shop.ts';
import { INV_REGIONS } from '../../../shared/src/data/invasions.ts';
import { REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { Game } from '../game/Game.ts';
import {
  EVENT_KIND, EVENT_KINDS, PROMO_LIMITS, addDays, dayStr, eventProblem, globalProblem, liveEvents, opsPrice, priceRule, ruleProblem, salePrice, tuneProblem,
} from '../game/liveops.ts';
import type { GlobalOffer, LiveOps, OpsEvent, PriceRule, PromoTune } from '../game/liveops.ts';
import { PROMO_CAROUSEL, PROMO_HOURS, PROMO_OFFS, PROMO_REST, promoFigures } from '../game/promo.ts';
import { clientIp } from '../net/conn.ts';

const MAX_BODY = 32 * 1024;
const COOKIE = 'gt_ops';
const WHO = 'gt_ops_who';

export const REGION_RU: Record<string, string> = {
  black_coast: 'Чёрное побережье', gravewater: 'море Грейвуотер', whispering: 'Шепчущий архипелаг', ashen_isles: 'Пепельные острова',
  leviathan_reach: 'Предел Левиафана', dead_mans_expanse: 'Простор Мертвеца', drowned_crown: 'Утонувшая Корона', the_abyss: 'Бездна',
};
const SEC_RU: Record<string, string> = { deals: 'Акции', ships: 'Корабли', supply: 'Припасы', voyage: 'Поход', units: 'Существа', recruit: 'Найм', battle: 'Бой', build: 'Стройка', res: 'Ресурсы', isle: 'Остров' };
const TABS: [string, string][] = [['sum', 'Сводка'], ['prices', 'Цены'], ['offers', 'Офферы'], ['events', 'События'], ['funnel', 'Воронка'], ['audit', 'Журнал']];

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const pct = (x: number | null, d = 0) => (x === null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d).replace('.', ',')} %`);
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const when = (ms: number) => `<time data-ms="${ms}">${esc(utc(ms))} UTC</time>`;
/** A cell's bar behind its number (a share of the column's top). */
const bar = (share: number, gold = false) => ` style="background:linear-gradient(90deg,${gold ? '#4a3d22' : '#2b3a4f'} ${Math.round(Math.min(1, Math.max(0, share)) * 100)}%,transparent 0)"`;
const famName = (id: string) => {
  const f = OFFERS.get(id);
  return f ? `${f.fam.name[1]}${f.fam.offers.length > 1 ? ` · ${f.offer.price} ₽` : ''}` : id;
};

function done(res: ServerResponse, code: number, headers: Record<string, string> = {}, body = ''): true {
  res.writeHead(code, headers).end(body);
  return true;
}
const notFound = (res: ServerResponse) => done(res, 404, { 'Content-Type': 'text/plain' }, 'Not found');

/** The short line of the admin console and the bot (Russian: the owner's; `en` for the console's own translation). */
export function opsSummary(game: Game, ops: LiveOps): { regs: number; dau: number; pays: number; rev: number; rev7: number; payers7: number; share7: number; arppu7: number; sales: number; shut: number; globals: number; events: number } {
  const now = game.wallNow();
  const today = ops.daily(1, now)[0];
  const m = ops.money(7, now);
  const rules = ops.list<PriceRule>('price:').map(([, r]) => r);
  return {
    regs: today.regs, dau: today.dau, pays: today.payments, rev: today.revenue, rev7: m.revenue, payers7: m.payers, share7: Math.round(m.share * 1000) / 10, arppu7: Math.round(m.arppu),
    sales: rules.filter((r) => r.sale && now >= r.sale.from && now < r.sale.to).length,
    shut: rules.filter((r) => r.off).length,
    globals: ops.list<GlobalOffer>('global:').filter(([, g]) => now >= g.from && now < g.to).length,
    events: liveEvents(game, now).length,
  };
}

export function opsLineRu(game: Game, ops: LiveOps, url = ''): string {
  const x = opsSummary(game, ops);
  // the newcomers' funnel (retention, 2026-10-25), its own line
  const tel = telemetry();
  const fun = tel ? `\n${funnelLineRu(tel.funnel(3, game.wallNow()))}` : '';
  return `Сегодня: регистраций ${x.regs}, в игре ${x.dau}, платежей ${x.pays} на ${fmt(x.rev)} ₽. За 7 дн.: выручка ${fmt(x.rev7)} ₽, платящих ${x.payers7} (${String(x.share7).replace('.', ',')} %), ARPPU ${fmt(x.arppu7)} ₽. Идут: скидок ${x.sales}, снято товаров ${x.shut}, глобальных офферов ${x.globals}, событий ${x.events}.${fun}${url ? `\n${url}/ops/admin` : ''}`;
}

// ------------------------------------------------------------------------------------------------ the panel

export class OpsPanel {
  private logins = new Map<string, { n: number; at: number }>();

  private game: Game;
  private ops: LiveOps;

  constructor(game: Game, ops: LiveOps) {
    this.game = game;
    this.ops = ops;
  }

  private mac(token: string, what: string): string {
    return createHmac('sha256', token).update(`gravetide-ops:${what}`).digest('hex');
  }

  private authed(req: IncomingMessage, token: string): boolean {
    const want = this.mac(token, 'cookie');
    const got = new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9a-f]{64})`).exec(String(req.headers.cookie ?? ''))?.[1] ?? '';
    return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  }

  private who(req: IncomingMessage): string {
    const raw = new RegExp(`(?:^|;\\s*)${WHO}=([^;]*)`).exec(String(req.headers.cookie ?? ''))?.[1] ?? '';
    let name = '';
    try {
      name = decodeURIComponent(raw);
    } catch {
      /* a broken name is none */
    }
    name = name.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 32);
    return `${name || 'панель'} · ${clientIp(req)}`;
  }

  private limited(req: IncomingMessage): boolean {
    const ip = clientIp(req);
    const now = Date.now();
    const h = this.logins.get(ip);
    if (h && now - h.at < 60_000 && h.n >= 5) return true;
    if (!h || now - h.at >= 60_000) this.logins.set(ip, { n: 1, at: now });
    else h.n++;
    if (this.logins.size > 5000) this.logins.clear();
    return false;
  }

  private async body(req: IncomingMessage): Promise<URLSearchParams | null> {
    let size = 0;
    const parts: Buffer[] = [];
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > MAX_BODY) return null;
      parts.push(c as Buffer);
    }
    return new URLSearchParams(Buffer.concat(parts).toString('utf8'));
  }

  /** Whether this was an /ops address (answered); every other address is left to the rest of the server. */
  async handle(req: IncomingMessage, res: ServerResponse, token = process.env.OPS_TOKEN ?? ''): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ops' && !url.pathname.startsWith('/ops/')) return false;
    if (token.length < 16) return notFound(res);
    const secure = req.headers['x-forwarded-proto'] === 'https' || (process.env.PUBLIC_URL ?? '').startsWith('https:');
    const flags = `Path=/ops; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
    const nonce = randomBytes(12).toString('base64');
    const head = {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    };
    const authed = this.authed(req, token);
    if (url.pathname === '/ops/admin' && req.method === 'POST') {
      if (this.limited(req)) {
        req.resume();
        return done(res, 429);
      }
      const form = (await this.body(req)) ?? new URLSearchParams();
      const given = Buffer.from(form.get('token') ?? '');
      const want = Buffer.from(token);
      if (given.length !== want.length || !timingSafeEqual(given, want)) return done(res, 403, head, page('Вход', '<p class="err">Неверный ключ.</p>' + loginForm(), nonce));
      const name = encodeURIComponent(String(form.get('who') ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 32));
      res.writeHead(303, { Location: '/ops/admin', 'Cache-Control': 'no-store', 'Set-Cookie': [`${COOKIE}=${this.mac(token, 'cookie')}; ${flags}; Max-Age=2592000`, `${WHO}=${name}; ${flags}; Max-Age=2592000`] }).end();
      return true;
    }
    if (url.pathname === '/ops/admin' && req.method === 'GET') {
      if (!authed) return done(res, 200, head, page('Вход', loginForm(), nonce));
      const tab = TABS.some(([t]) => t === url.searchParams.get('tab')) ? url.searchParams.get('tab')! : 'sum';
      const msg = url.searchParams.get('m');
      const flash = msg ? `<p class="${url.searchParams.get('e') ? 'err' : 'ok'}">${esc(msg.slice(0, 300))}</p>` : '';
      res.writeHead(200, head).end(page(TABS.find(([t]) => t === tab)![1], nav(tab) + flash + this.tab(tab, url.searchParams, this.mac(token, 'csrf')), nonce));
      return true;
    }
    if (!authed) {
      req.resume();
      return notFound(res);
    }
    if (url.pathname === '/ops/admin/out' && req.method === 'POST') {
      res.writeHead(303, { Location: '/ops/admin', 'Set-Cookie': [`${COOKIE}=; ${flags}; Max-Age=0`, `${WHO}=; ${flags}; Max-Age=0`] }).end();
      return true;
    }
    if (url.pathname === '/ops/admin/act' && req.method === 'POST') {
      const form = await this.body(req);
      if (!form) return done(res, 413);
      const csrf = Buffer.from(form.get('csrf') ?? '');
      const want = Buffer.from(this.mac(token, 'csrf'));
      if (csrf.length !== want.length || !timingSafeEqual(csrf, want)) return done(res, 403, { 'Content-Type': 'text/plain' }, 'Bad form');
      const tab = String(form.get('tab') ?? 'sum');
      let out: string | null;
      try {
        out = this.act(form, this.who(req));
      } catch (e) {
        out = `Ошибка: ${(e as Error).message}`;
      }
      const q = new URLSearchParams({ tab, m: out ?? 'Сохранено.' });
      if (out) q.set('e', '1');
      if (form.get('back')) q.set('f', String(form.get('back')));
      res.writeHead(303, { Location: `/ops/admin?${q}`, 'Cache-Control': 'no-store' }).end();
      return true;
    }
    req.resume();
    return notFound(res);
  }

  // ---------------------------------------------------------------------------------------------- the changes

  /** A change from the panel (null: saved; else what is wrong, nothing saved). */
  act(f: URLSearchParams, who: string): string | null {
    const ops = this.ops;
    const a = f.get('a');
    const int = (k: string) => {
      const v = String(f.get(k) ?? '').trim().replace(/\s/g, '');
      return v === '' ? undefined : Number(v);
    };
    const ms = (k: string) => {
      const v = Number(f.get(k));
      if (Number.isFinite(v) && v > 0) return v;
      // (no script: the field's own value, read as UTC)
      const l = String(f.get(`${k}_l`) ?? '');
      return /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(l) ? Date.parse(`${l}:00Z`) : NaN;
    };
    switch (a) {
      case 'price': {
        const id = String(f.get('id') ?? '');
        const offer = OFFERS.get(id)?.offer;
        if (!offer) return `Нет товара «${id}».`;
        const r: PriceRule = {};
        const price = int('price');
        if (price !== undefined && price !== offer.price && id !== 'refill') r.price = price;
        if (f.get('sell') !== 'on') r.off = true;
        const sp = int('sale');
        if (sp !== undefined && sp > 0 && id !== 'refill') r.sale = { pct: sp, from: ms('from'), to: ms('to') };
        const bad = ruleProblem(id, r);
        if (bad) return bad;
        ops.set(`price:${id}`, Object.keys(r).length ? r : null, who);
        return null;
      }
      case 'price_reset':
        ops.set(`price:${String(f.get('id') ?? '')}`, null, who, 'reset');
        return null;
      case 'promo': {
        const t: PromoTune = {
          offMin: int('offMin') ?? NaN, offMax: int('offMax') ?? NaN, hoursMin: int('hoursMin') ?? NaN, hoursMax: int('hoursMax') ?? NaN,
          restMin: int('restMin') ?? NaN, restMax: int('restMax') ?? NaN, carousel: String(f.get('carousel') ?? '') as PromoTune['carousel'],
        };
        const bad = tuneProblem(t);
        if (bad) return bad;
        ops.set('promo', t, who);
        return null;
      }
      case 'promo_reset':
        ops.set('promo', null, who, 'reset');
        return null;
      case 'global': {
        const g: GlobalOffer = {
          id: String(f.get('id') ?? '').trim().toLowerCase() || `g${Date.now().toString(36)}`, offer: String(f.get('offer') ?? ''),
          price: int('price') ?? NaN, from: ms('from'), to: ms('to'), limit: int('limit') ?? NaN,
        };
        const bad = globalProblem(g);
        if (bad) return bad;
        ops.set(`global:${g.id}`, g, who);
        return null;
      }
      case 'global_del':
        ops.set(`global:${String(f.get('id') ?? '')}`, null, who, 'delete');
        return null;
      case 'event': {
        const kind = String(f.get('kind') ?? '');
        const def = EVENT_KIND.get(kind);
        const e: OpsEvent = { id: String(f.get('id') ?? '').trim().toLowerCase() || `e${Date.now().toString(36)}`, kind, from: ms('from'), to: ms('to') };
        const region = String(f.get('region') ?? '');
        if (def?.region && region) e.region = region;
        if (def?.mul) e.mul = Number(String(f.get('mul') ?? '').replace(',', '.'));
        const bad = eventProblem(e);
        if (bad) return bad;
        ops.set(`event:${e.id}`, e, who);
        return null;
      }
      case 'event_del':
        ops.set(`event:${String(f.get('id') ?? '')}`, null, who, 'delete');
        return null;
      default:
        return 'Неизвестное действие.';
    }
  }

  // ---------------------------------------------------------------------------------------------- the tabs

  private tab(tab: string, q: URLSearchParams, csrf: string): string {
    switch (tab) {
      case 'prices': return this.prices(csrf, q.get('f') ?? '');
      case 'offers': return this.offers(csrf);
      case 'events': return this.events(csrf);
      case 'funnel': return this.funnel(q);
      case 'audit': return this.audit();
      default: return this.sum();
    }
  }

  private sum(): string {
    const game = this.game, ops = this.ops;
    const now = game.wallNow();
    const x = opsSummary(game, ops);
    const m30 = ops.money(30, now);
    const card = (label: string, v: string, sub = '') => `<div class="kpi"><span>${esc(label)}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    return `<div class="kpis">
      ${card('Регистраций сегодня', fmt(x.regs))}${card('В игре сегодня', fmt(x.dau))}${card('Выручка сегодня', `${fmt(x.rev)} ₽`, `платежей: ${x.pays}`)}
      ${card('Выручка за 7 дн.', `${fmt(x.rev7)} ₽`, `платящих: ${x.payers7}`)}${card('Выручка за 30 дн.', `${fmt(m30.revenue)} ₽`, `ARPU ${m30.arpu.toFixed(1).replace('.', ',')} ₽ · ARPPU ${fmt(m30.arppu)} ₽`)}${card('Платящие (30 дн.)', pct(m30.share, 1), `${m30.payers} из ${m30.active}`)}
    </div>
    <h2>Что сейчас включено</h2>
    <ul class="live">
      <li>Скидок идёт: <b>${x.sales}</b>, товаров снято с продажи: <b>${x.shut}</b>, своих цен: <b>${ops.list<PriceRule>('price:').filter(([, r]) => r.price !== undefined).length}</b> — <a href="?tab=prices">цены</a></li>
      <li>Глобальных офферов идёт: <b>${x.globals}</b>; личные офферы: ${ops.get('promo') ? '<b>свои настройки</b>' : 'как в игре'} — <a href="?tab=offers">офферы</a></li>
      <li>Событий идёт: <b>${x.events}</b>${liveEvents(game, now).map((e) => ` · ${esc(EVENT_KIND.get(e.kind)?.ru ?? e.kind)}${e.mul ? ` ×${e.mul}` : ''} до ${when(e.to)}`).join('')} — <a href="?tab=events">события</a></li>
    </ul>
    <h2>Ссылки</h2>
    <ul class="live">
      <li><a href="/telemetry/admin">Телеметрия устройств</a> (FPS, загрузки, ошибки JS; свой ключ TELEMETRY_TOKEN)</li>
      <li><a href="/telemetry/admin?days=7">Телеметрия за 7 дней</a> · <a href="/telemetry/admin?days=30">за 30 дней</a></li>
      <li><a href="/onboarding">Первая вахта (JSON)</a> · <a href="/economy">Экономика (JSON)</a> · <a href="/health">Сервер (JSON)</a></li>
    </ul>
    <form method="post" action="/ops/admin/out" class="out"><button>Выйти</button></form>`;
  }

  private prices(csrf: string, focus: string): string {
    const game = this.game;
    const now = game.wallNow();
    const rows: string[] = [];
    let sec = '';
    for (const fam of SHOP) {
      if (fam.sec !== sec) {
        sec = fam.sec;
        rows.push(`<h3 class="sec">${esc(SEC_RU[sec] ?? sec)}</h3>`);
      }
      for (const offer of fam.offers) {
        const r = priceRule(game, offer.id) ?? {};
        const live = opsPrice(game, offer);
        const s = r.sale;
        const running = s && now >= s.from && now < s.to;
        const dyn = offer.id === 'refill';
        const state = r.off ? '<i class="tag off">снят</i>' : running ? `<i class="tag sale">−${s!.pct} % до ${when(s!.to)}</i>` : s && now < s.from ? `<i class="tag wait">скидка с ${when(s.from)}</i>` : r.price !== undefined ? '<i class="tag own">своя цена</i>' : '';
        rows.push(`<form method="post" action="/ops/admin/act" class="prow${focus === offer.id ? ' focus' : ''}" id="o-${esc(offer.id)}" data-q="${esc(`${fam.name[1]} ${fam.name[0]} ${offer.id}`.toLowerCase())}">
          <input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="tab" value="prices"><input type="hidden" name="back" value="${esc(offer.id)}"><input type="hidden" name="id" value="${esc(offer.id)}">
          <div class="pn"><b>${esc(fam.name[1])}</b><small>${esc(offer.id)} · каталог ${dyn ? 'по потерям' : `${fmt(offer.price)}`}${live !== offer.price && !dyn ? ` · сейчас <b>${fmt(live)}</b>` : ''}</small>${state}</div>
          <label class="f"><span>Цена</span><input name="price" inputmode="numeric" ${dyn ? 'disabled placeholder="—"' : `value="${r.price ?? offer.price}" min="${PRICE_MIN}" max="${PRICE_MAX}"`}></label>
          <label class="f ck"><input type="checkbox" name="sell" ${r.off ? '' : 'checked'}><span>В продаже</span></label>
          <label class="f"><span>Скидка, %</span><input name="sale" inputmode="numeric" ${dyn ? 'disabled' : `value="${s?.pct ?? ''}" placeholder="0"`}></label>
          <label class="f"><span>С</span><input type="datetime-local" name="from_l" data-ms="${s?.from ?? ''}" value="${s ? utc(s.from).replace(' ', 'T') : ''}"${dyn ? ' disabled' : ''}><input type="hidden" name="from"></label>
          <label class="f"><span>По</span><input type="datetime-local" name="to_l" data-ms="${s?.to ?? ''}" value="${s ? utc(s.to).replace(' ', 'T') : ''}"${dyn ? ' disabled' : ''}><input type="hidden" name="to"></label>
          <div class="bt"><button name="a" value="price">Сохранить</button>${Object.keys(r).length ? '<button name="a" value="price_reset" class="sec">Сбросить</button>' : ''}</div>
        </form>`);
      }
    }
    return `<p class="hint">Цена — от ${PRICE_MIN} до ${fmt(PRICE_MAX)} дублонов (правило владельца). Скидка считается от цены, округляется вниз до «…90» и не опускается ниже ${PRICE_MIN}: например, 990 −20 % = ${salePrice(990, 20)}. Пустая скидка — без скидки. Время — ваше местное.</p>
    <input type="search" id="find" placeholder="Найти товар…" autocomplete="off">
    <div class="prices">${rows.join('')}</div>`;
  }

  private offers(csrf: string): string {
    const game = this.game, ops = this.ops;
    const now = game.wallNow();
    const t = ops.get<PromoTune>('promo');
    const d = { offMin: PROMO_OFFS[0], offMax: PROMO_OFFS[PROMO_OFFS.length - 1], hoursMin: PROMO_HOURS[0], hoursMax: PROMO_HOURS[1], restMin: PROMO_REST[0], restMax: PROMO_REST[1], carousel: PROMO_CAROUSEL };
    const v = t ?? d;
    const hid = (a = '') => `<input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="tab" value="offers">${a}`;
    const num = (name: keyof typeof d, lim: readonly [number, number]) => `<input name="${name}" inputmode="numeric" value="${v[name]}" min="${lim[0]}" max="${lim[1]}" required>`;
    const globals = ops.list<GlobalOffer>('global:').map(([, g]) => g).sort((a, b) => b.from - a.from);
    const figs = promoFigures(game);
    const options = SHOP.flatMap((f) => f.offers.filter((o) => o.price > 0).map((o) => `<option value="${esc(o.id)}">${esc(`${f.name[1]} · ${o.id} · ${o.price}`)}</option>`)).join('');
    const stats = Object.entries(figs).sort((a, b) => b[1].doubloons - a[1].doubloons || b[1].seen - a[1].seen);
    const label = (k: string) => {
      const [kind, id] = [k.slice(0, 3), k.slice(3)];
      if (kind === 'gl:') return `Глобальный «${id}»`;
      if (kind === 'po:') return `Личный: ${famName(id)}`;
      if (k === 'sp:first') return 'Особый: первое пополнение ×2';
      return `Особый: ${famName(id)}`;
    };
    return `<h2>Личные офферы</h2>
    <p class="hint">Сейчас: ${t ? '<b>свои настройки</b>' : 'как в игре'}. В игре: скидка ${d.offMin}–${d.offMax} %, срок ${d.hoursMin}–${d.hoursMax} ч, пауза после покупки или конца ${d.restMin}–${d.restMax} мин, карусель при входе — раз в день. Цены офферов всегда на сетке «…90» и в пределах ${PRICE_MIN}–${fmt(PRICE_MAX)}.</p>
    <form method="post" action="/ops/admin/act" class="grid">${hid()}
      <label class="f"><span>Скидка от, %</span>${num('offMin', PROMO_LIMITS.off)}</label><label class="f"><span>Скидка до, %</span>${num('offMax', PROMO_LIMITS.off)}</label>
      <label class="f"><span>Срок от, ч</span>${num('hoursMin', PROMO_LIMITS.hours)}</label><label class="f"><span>Срок до, ч</span>${num('hoursMax', PROMO_LIMITS.hours)}</label>
      <label class="f"><span>Пауза от, мин</span>${num('restMin', PROMO_LIMITS.rest)}</label><label class="f"><span>Пауза до, мин</span>${num('restMax', PROMO_LIMITS.rest)}</label>
      <label class="f"><span>Карусель при входе</span><select name="carousel">${(['day', 'session', 'off'] as const).map((c) => `<option value="${c}"${v.carousel === c ? ' selected' : ''}>${{ day: 'раз в день', session: 'каждый вход', off: 'выключена' }[c]}</option>`).join('')}</select></label>
      <div class="bt"><button name="a" value="promo">Сохранить</button>${t ? '<button name="a" value="promo_reset" class="sec">Как в игре</button>' : ''}</div>
    </form>
    <p class="hint">Новые настройки действуют на следующие офферы; уже выданные доживают свой срок.</p>

    <h2>Глобальный оффер</h2>
    <p class="hint">Одно предложение всем капитанам: товар лавки по своей цене, на время, с лимитом на игрока. Показывается среди офферов (карусель при входе, иконка в море).</p>
    <form method="post" action="/ops/admin/act" class="grid">${hid()}
      <label class="f wide"><span>Товар</span><select name="offer" required>${options}</select></label>
      <label class="f"><span>Цена</span><input name="price" inputmode="numeric" min="${PRICE_MIN}" max="${PRICE_MAX}" required placeholder="${PRICE_MIN}–${PRICE_MAX}"></label>
      <label class="f"><span>Лимит на игрока</span><input name="limit" inputmode="numeric" value="1" required></label>
      <label class="f"><span>С</span><input type="datetime-local" name="from_l" required data-now="0"><input type="hidden" name="from"></label>
      <label class="f"><span>По</span><input type="datetime-local" name="to_l" required data-now="86400000"><input type="hidden" name="to"></label>
      <label class="f"><span>Код (необязательно)</span><input name="id" placeholder="autumn-sale" pattern="[a-z0-9_-]{1,24}"></label>
      <div class="bt"><button name="a" value="global">Создать</button></div>
    </form>
    ${globals.length ? `<table class="t"><tr><th>Код</th><th>Товар</th><th>Цена</th><th>Когда</th><th>Лимит</th><th>Купили</th><th></th></tr>${globals.map((g) => {
      const tot = ops.globalTotals(g.id);
      const st = now < g.from ? '<i class="tag wait">ждёт</i>' : now < g.to ? '<i class="tag sale">идёт</i>' : '<i class="tag">прошёл</i>';
      return `<tr><td>${esc(g.id)} ${st}</td><td>${esc(famName(g.offer))}</td><td>${fmt(g.price)}</td><td>${when(g.from)} — ${when(g.to)}</td><td>${g.limit}</td><td>${tot.n} (${tot.buyers} чел.)</td>
        <td><form method="post" action="/ops/admin/act">${hid(`<input type="hidden" name="id" value="${esc(g.id)}">`)}<button name="a" value="global_del" class="sec">Удалить</button></form></td></tr>`;
    }).join('')}</table>` : '<p class="muted">Глобальных офферов нет.</p>'}

    <h2>Статистика офферов</h2>
    <p class="hint">Показы — один раз за сессию на место показа. Конверсия — покупки ÷ показы.</p>
    ${stats.length ? `<table class="t"><tr><th>Оффер</th><th>Показы</th><th>Закрыли</th><th>Купили</th><th>Дублонов</th><th>Конверсия</th><th>Закрыли, %</th></tr>${stats.map(([k, f]) => `<tr><td>${esc(label(k))}</td><td>${fmt(f.seen)}</td><td>${fmt(f.closed)}</td><td>${fmt(f.bought)}</td><td>${fmt(f.doubloons)}</td><td>${pct(f.seen ? f.bought / f.seen : null, 1)}</td><td>${pct(f.seen ? f.closed / f.seen : null, 0)}</td></tr>`).join('')}</table>` : '<p class="muted">Пока ничего не показано.</p>'}`;
  }

  private events(csrf: string): string {
    const game = this.game, ops = this.ops;
    const now = game.wallNow();
    const hid = (a = '') => `<input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="tab" value="events">${a}`;
    const list = ops.list<OpsEvent>('event:').map(([, e]) => e).sort((a, b) => b.from - a.from);
    const regions = (ids: readonly string[]) => ids.map((r) => `<option value="${r}">${esc(REGION_RU[r] ?? r)}</option>`).join('');
    return `<p class="hint">Окно (праздник, множитель) действует от начала до конца. Разовое событие (вторжение, босс моря, событие в море) запускается один раз в момент начала, дальше идёт по своим правилам игры. Время — ваше местное.</p>
    <form method="post" action="/ops/admin/act" class="grid" id="evform">${hid()}
      <label class="f wide"><span>Событие</span><select name="kind" id="evkind">${EVENT_KINDS.map((k) => `<option value="${k.kind}" data-mode="${k.mode}" data-region="${k.region ?? ''}" data-mul="${k.mul ? 1 : ''}">${esc(k.ru)} — ${k.mode === 'window' ? 'окно' : 'разово'}</option>`).join('')}</select></label>
      <label class="f" data-for="mul"><span>Множитель</span><input name="mul" inputmode="decimal" value="2"></label>
      <label class="f" data-for="inv"><span>Море вторжения</span><select name="region" data-r="inv"><option value="">любое</option>${regions(INV_REGIONS)}</select></label>
      <label class="f" data-for="zb"><span>Море босса</span><select name="region" data-r="zb">${regions(REGION_IDS)}</select></label>
      <label class="f"><span>С</span><input type="datetime-local" name="from_l" required data-now="0"><input type="hidden" name="from"></label>
      <label class="f"><span>По</span><input type="datetime-local" name="to_l" required data-now="172800000"><input type="hidden" name="to"></label>
      <label class="f"><span>Код (необязательно)</span><input name="id" placeholder="xp-weekend" pattern="[a-z0-9_-]{1,24}"></label>
      <div class="bt"><button name="a" value="event">Запланировать</button></div>
    </form>
    ${list.length ? `<table class="t"><tr><th>Код</th><th>Событие</th><th>Когда</th><th>Состояние</th><th></th></tr>${list.map((e) => {
      const def = EVENT_KIND.get(e.kind);
      const st = now < e.from ? '<i class="tag wait">ждёт</i>' : now < e.to ? (def?.mode === 'trigger' ? (e.fired ? `<i class="tag sale">запущено ${when(e.fired)}</i>` : '<i class="tag wait">запускается</i>') : '<i class="tag sale">идёт</i>') : '<i class="tag">прошло</i>';
      return `<tr><td>${esc(e.id)}</td><td>${esc(def?.ru ?? e.kind)}${e.mul ? ` ×${String(e.mul).replace('.', ',')}` : ''}${e.region ? ` · ${esc(REGION_RU[e.region] ?? e.region)}` : ''}</td><td>${when(e.from)} — ${when(e.to)}</td><td>${st}</td>
        <td><form method="post" action="/ops/admin/act">${hid(`<input type="hidden" name="id" value="${esc(e.id)}">`)}<button name="a" value="event_del" class="sec">Удалить</button></form></td></tr>`;
    }).join('')}</table>` : '<p class="muted">Ничего не запланировано.</p>'}`;
  }

  private funnel(q: URLSearchParams): string {
    const ops = this.ops;
    const now = this.game.wallNow();
    const per = ['7', '30', '90', 'all'].includes(q.get('p') ?? '') ? q.get('p')! : '30';
    const group = q.get('g') === 'week' ? 'week' : 'day';
    const from = per === 'all' ? null : addDays(dayStr(now), -(Number(per) - 1));
    const f = ops.funnel(from);
    const top = Math.max(1, ...f.map((x) => x.n));
    const ret = ops.retention(group, group === 'week' ? 120 : 45, now);
    const days = ops.daily(30, now);
    const maxRev = Math.max(1, ...days.map((d) => d.revenue));
    const m7 = ops.money(7, now), m30 = ops.money(30, now);
    const buys = ops.top('buy', 30, now), packs = ops.top('topup', 30, now);
    const link = (p: string, g: string, label: string, on: boolean) => `<a href="?tab=funnel&p=${p}&g=${g}" class="${on ? 'on' : ''}">${label}</a>`;
    const prod = (p: string) => {
      const [kind, id] = p.includes(':') ? [p.slice(0, p.indexOf(':')), p.slice(p.indexOf(':') + 1)] : ['', p];
      const pre: Record<string, string> = { promo: 'личный оффер: ', global: 'глобальный: ', deal: 'товар дня: ', ship: 'корабль ', unit: 'существа ', scrolls: 'свитки автобоя ' };
      if (p === 'finish') return 'Завершить стройку сейчас';
      if (kind === 'ship' || kind === 'unit' || kind === 'scrolls') return `${pre[kind]}${id}`;
      return `${pre[kind] ?? ''}${famName(id)}`;
    };
    return `<p class="seg">Период (по дню регистрации): ${link('7', group, '7 дн.', per === '7')} ${link('30', group, '30 дн.', per === '30')} ${link('90', group, '90 дн.', per === '90')} ${link('all', group, 'все', per === 'all')}</p>
    <h2>Воронка</h2>
    <table class="t funnel"><tr><th>Шаг</th><th>Аккаунтов</th><th>От шага выше</th><th>От регистрации</th></tr>${f.map((x) => `<tr><td>${esc(x.ru)}</td><td${bar(x.n / top)}>${fmt(x.n)}</td><td>${pct(x.conv, 1)}</td><td>${pct(x.ofFirst, 1)}</td></tr>`).join('')}</table>
    <p class="hint">Пропустили Первую вахту: ${fmt(ops.count('fw_skip', from))}. Аккаунты, созданные до включения воронки, в «Регистрации» не считаются, но их шаги после включения видны в «все».</p>
    <h2>Удержание D1 / D7 / D30</h2>
    <p class="seg">По: ${link(per, 'day', 'дням', group === 'day')} ${link(per, 'week', 'неделям', group === 'week')}</p>
    ${ret.length ? `<table class="t"><tr><th>Когорта</th><th>Аккаунтов</th><th>D1</th><th>D7</th><th>D30</th></tr>${ret.map((r) => `<tr><td>${esc(group === 'week' ? `неделя с ${r.cohort}` : r.cohort)}</td><td>${fmt(r.size)}</td><td>${pct(r.d1)}</td><td>${pct(r.d7)}</td><td>${pct(r.d30)}</td></tr>`).join('')}</table>` : '<p class="muted">Регистраций ещё нет.</p>'}
    <p class="hint">D<i>N</i> — доля когорты, зашедшая в игру ровно на <i>N</i>-й день после регистрации (UTC). «—»: этот день ещё не закончился.</p>
    <h2>Деньги</h2>
    <div class="kpis">
      <div class="kpi"><span>ARPU 7 / 30 дн.</span><b>${m7.arpu.toFixed(1).replace('.', ',')} / ${m30.arpu.toFixed(1).replace('.', ',')} ₽</b><small>выручка ÷ игравшие</small></div>
      <div class="kpi"><span>ARPPU 7 / 30 дн.</span><b>${fmt(m7.arppu)} / ${fmt(m30.arppu)} ₽</b><small>выручка ÷ платившие</small></div>
      <div class="kpi"><span>Платящие 7 / 30 дн.</span><b>${pct(m7.share, 1)} / ${pct(m30.share, 1)}</b><small>${m7.payers} из ${m7.active} · ${m30.payers} из ${m30.active}</small></div>
    </div>
    <h3>По дням (30 дн.)</h3>
    <table class="t"><tr><th>День</th><th>Выручка, ₽</th><th>Платежей</th><th>Потрачено дублонов</th><th>Покупок</th><th>В игре</th><th>Регистраций</th></tr>${days.map((d) => `<tr><td>${d.day}</td><td${bar(Math.max(0, d.revenue) / maxRev, true)}>${fmt(d.revenue)}</td><td>${d.payments}</td><td>${fmt(d.spent)}</td><td>${d.buys}</td><td>${fmt(d.dau)}</td><td>${d.regs}</td></tr>`).join('')}</table>
    <p class="hint">Выручка — пополнения за Stars в рублях пакета (дублон ≈ 1 ₽, без бонусных дублонов), за вычетом возвратов.</p>
    <h3>Топ товаров за дублоны (30 дн.)</h3>
    ${buys.length ? `<table class="t"><tr><th>Товар</th><th>Покупок</th><th>Дублонов</th><th>Покупателей</th></tr>${buys.map((b) => `<tr><td>${esc(prod(b.product))}</td><td>${b.n}</td><td>${fmt(b.sum)}</td><td>${b.buyers}</td></tr>`).join('')}</table>` : '<p class="muted">Покупок не было.</p>'}
    <h3>Пакеты пополнения (30 дн.)</h3>
    ${packs.length ? `<table class="t"><tr><th>Пакет</th><th>Платежей</th><th>₽</th><th>Плательщиков</th></tr>${packs.map((b) => `<tr><td>${esc(b.product)}</td><td>${b.n}</td><td>${fmt(b.sum)}</td><td>${b.buyers}</td></tr>`).join('')}</table>` : '<p class="muted">Пополнений не было.</p>'}`;
  }

  private audit(): string {
    const rows = this.ops.audit(200);
    const short = (s: string | null) => (s === null ? '—' : s.length > 160 ? `${s.slice(0, 160)}…` : s);
    const act: Record<string, string> = { set: 'изменено', delete: 'удалено', reset: 'сброшено', fire: 'запущено' };
    return rows.length ? `<table class="t audit"><tr><th>Когда</th><th>Кто</th><th>Что</th><th>Было</th><th>Стало</th></tr>${rows.map((r) => `<tr><td>${when(r.at)}</td><td>${esc(r.who)}</td><td>${esc(act[r.action] ?? r.action)}: <b>${esc(r.key)}</b></td><td><code>${esc(short(r.before))}</code></td><td><code>${esc(short(r.after))}</code></td></tr>`).join('')}</table>` : '<p class="muted">Изменений ещё не было.</p>';
  }
}

// ------------------------------------------------------------------------------------------------ the page

const nav = (tab: string) => `<nav>${TABS.map(([t, n]) => `<a href="?tab=${t}" class="${t === tab ? 'on' : ''}">${n}</a>`).join('')}</nav>`;
const loginForm = () => `<form method="post" class="login"><label class="f"><span>Ключ OPS_TOKEN</span><input type="password" name="token" autocomplete="current-password" required></label>
  <label class="f"><span>Ваше имя (для журнала)</span><input name="who" maxlength="32" autocomplete="nickname"></label><div class="bt"><button>Войти</button></div></form>`;

const SCRIPT = `(() => {
  const pad = (n) => String(n).padStart(2, '0');
  const local = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  document.querySelectorAll('time[data-ms]').forEach((t) => { const d = new Date(Number(t.dataset.ms)); t.textContent = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); t.title = d.toString(); });
  document.querySelectorAll('input[type=datetime-local]').forEach((i) => {
    if (i.dataset.ms) i.value = local(Number(i.dataset.ms));
    else if (i.dataset.now !== undefined && !i.value) { const d = new Date(Date.now() + Number(i.dataset.now)); d.setMinutes(0, 0, 0); if (Number(i.dataset.now) === 0) d.setHours(d.getHours() + 1); i.value = local(d.getTime()); }
  });
  document.querySelectorAll('form').forEach((f) => f.addEventListener('submit', () => {
    f.querySelectorAll('input[type=datetime-local]').forEach((i) => { const h = f.querySelector('input[type=hidden][name="' + i.name.replace(/_l$/, '') + '"]'); if (h) h.value = i.value ? String(new Date(i.value).getTime()) : ''; });
  }));
  const find = document.getElementById('find');
  if (find) find.addEventListener('input', () => { const q = find.value.trim().toLowerCase(); let sec = null; document.querySelectorAll('.prices > *').forEach((el) => { if (el.tagName === 'H3') { sec = el; el.hidden = !!q; return; } el.hidden = !!q && !el.dataset.q.includes(q); }); });
  const kind = document.getElementById('evkind');
  if (kind) { const sync = () => { const o = kind.selectedOptions[0]; document.querySelectorAll('[data-for]').forEach((l) => { const on = l.dataset.for === 'mul' ? !!o.dataset.mul : l.dataset.for === o.dataset.region; l.hidden = !on; l.querySelectorAll('select,input').forEach((x) => (x.disabled = !on)); }); }; kind.addEventListener('change', sync); sync(); }
  const focus = document.querySelector('.prow.focus'); if (focus) focus.scrollIntoView({ block: 'center' });
})();`;

const CSS = `*{box-sizing:border-box}body{font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#121418;color:#ddd;margin:0;padding:12px 16px 40px;max-width:1200px;margin-inline:auto}
h1{font-size:19px;margin:4px 0 10px;color:#e8d9b5;letter-spacing:.02em}h2{font-size:16px;margin:24px 0 8px;color:#e8d9b5}h3{font-size:14px;margin:18px 0 6px;color:#c9b88f}
a{color:#d4b06a}nav{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px;border-bottom:1px solid #2c3038;padding-bottom:8px}nav a{padding:6px 12px;border-radius:6px;text-decoration:none;color:#bbb;background:#1b1e24}nav a.on{background:#3a3222;color:#f0d999}
.ok,.err{padding:8px 12px;border-radius:6px;margin:8px 0}.ok{background:#1e3324;color:#bfe3c6}.err{background:#3d1f1f;color:#f3c1c1}
.hint{color:#9a9fa8;font-size:13px;margin:6px 0}.muted{color:#777}
table.t{border-collapse:collapse;width:100%;margin:6px 0}table.t td,table.t th{border-bottom:1px solid #262a31;padding:6px 8px;text-align:left;vertical-align:top}table.t th{color:#8f98a3;font-weight:600;font-size:12px}
table.funnel td:nth-child(2){min-width:140px}table.t form{margin:0}table.t td{vertical-align:middle}
input,select,button{font:inherit;color:#eee;background:#1d2128;border:1px solid #3a404a;border-radius:6px;padding:6px 8px;min-height:34px}input[type=checkbox]{min-height:auto;width:18px;height:18px}
button{background:#4a3a1c;border-color:#6b5426;color:#f3e2b5;cursor:pointer;padding:6px 14px}button.sec{background:#23272e;border-color:#3a404a;color:#bbb}button:hover{filter:brightness(1.15)}
.f{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#9aa1ab}.f.ck{flex-direction:row;align-items:center;gap:6px;color:#ccc;font-size:13px;padding-bottom:8px;white-space:nowrap}.f input,.f select{width:100%}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-items:end;background:#181b20;border:1px solid #262a31;border-radius:8px;padding:12px}.grid .wide{grid-column:span 2}.bt{display:flex;gap:6px;align-items:end}
.prices{display:flex;flex-direction:column;gap:6px}.sec{margin:16px 0 2px}h3.sec{border-bottom:1px solid #2c3038;padding-bottom:4px}
.prow{display:grid;grid-template-columns:minmax(0,2.2fr) 90px 108px 80px 180px 180px auto;gap:8px;align-items:end;background:#181b20;border:1px solid #262a31;border-radius:8px;padding:8px 10px}.prow.focus{border-color:#8a6d32}
.pn{display:flex;flex-direction:column;gap:2px;min-width:0}.pn small{color:#8f98a3}.pn b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tag{font-style:normal;font-size:11px;padding:1px 6px;border-radius:4px;background:#2a2e35;color:#aaa;width:max-content}.tag.off{background:#3d1f1f;color:#f0b4b4}.tag.sale{background:#1e3324;color:#b8e3c0}.tag.wait{background:#2c2a1b;color:#e3d39a}.tag.own{background:#1f2b3d;color:#b4c9ef}
.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.kpi{background:#181b20;border:1px solid #262a31;border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}.kpi span{color:#9aa1ab;font-size:12px}.kpi b{font-size:20px;color:#f0d999}.kpi small{color:#8f98a3}
.live li{margin:4px 0}.seg a{padding:3px 8px;border-radius:5px;text-decoration:none;background:#1b1e24;color:#bbb}.seg a.on{background:#3a3222;color:#f0d999}
#find{width:100%;max-width:420px;margin:6px 0 4px}.login{display:flex;flex-direction:column;gap:10px;max-width:340px;background:#181b20;border:1px solid #262a31;border-radius:8px;padding:14px}.out{margin-top:24px}
code{font-size:11px;color:#aab;word-break:break-all}table.audit td:nth-child(4),table.audit td:nth-child(5){max-width:280px}[hidden]{display:none!important}
@media (max-width:900px){.prow{grid-template-columns:repeat(3,minmax(0,1fr))}.prow .pn{grid-column:1/-1}.prow .bt{grid-column:1/-1}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){body{padding:10px 10px 40px}.prow{grid-template-columns:repeat(2,minmax(0,1fr))}.prow .f.ck{order:6;padding-bottom:0}.prow .bt{order:7;grid-column:auto;justify-content:flex-end}.grid .wide{grid-column:1/-1}.kpis{grid-template-columns:1fr 1fr}.kpi b{font-size:17px}
  table.t{display:block;overflow-x:auto;white-space:nowrap;font-size:13px}table.t.funnel{display:table;white-space:normal}table.funnel td:nth-child(2){min-width:72px}table.t td,table.t th{padding:6px 5px}nav a{padding:6px 9px}}`;

const page = (title: string, body: string, nonce: string) => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>GRAVETIDE · ${esc(title)}</title>
<style>${CSS}</style></head><body><h1>GRAVETIDE · Лайв-опс · ${esc(title)}</h1>${body}<script nonce="${nonce}">${SCRIPT}</script></body></html>`;
