// The premium shop's window (owner, 2026-10-03; docs/01 P7 — and 2026-10-15: «магазин должен быть отсортирован
// вкладками "море" … "абордаж" … "остров"», docs/32). The whole screen: the band with the account's doubloons and
// «Пополнить», a rail of the three tabs, a row of the tab's shelves («Акции» first — the bundles, the deal of the day,
// the level's gift, her stores), and the cards: every family of goods its single and its packs side by side, each
// with its bonus, shut with the reason while it cannot be had. The premium hulls (the sea's «Корабли») and creatures
// (the boarding's «Существа») keep their own cards. The server decides every price and every refusal; the window
// asks, and names each purchase with an id of its own so a message sent twice buys once.

import { AUTO_SCROLL_ICON, DOUBLOON_PACKS } from '../../../shared/src/data/premium.ts';
import { DEAL_OFF, OFFERS, SHOP, TAB_SECS, offerBonus } from '../../../shared/src/data/shop.ts';
import type { ShopFamily, ShopOffer, ShopSec, ShopTab } from '../../../shared/src/data/shop.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import { FLEET_LISTS, SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { giftOf } from '../../../shared/src/data/shipgifts.ts';
import { isShipBeast } from '../../../shared/src/data/shipbeasts.ts';
import type { PremiumShipCard, PremiumUnitCard, PremiumView, PremiumWhy, ShopJobView, ShopView, ShopWhy } from '../../../shared/src/premiumproto.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang, plural } from '../i18n.ts';
import { EN as AEN, RU as ARU } from '../lang/ui/army.ts';
import { EN, RU } from '../lang/ui/premium.ts';
import { EN as FEN, RU as FRU } from '../lang/ui/fleet.ts';
import type { ClientState } from '../state.ts';
import { specialName, unitIcon, unitName } from './army.ts';
import { baseName, timeText } from './base.ts';
import { ask } from './confirm.ts';
import { esc, fmt, icon } from './dom.ts';
import { treeLabel } from './isletree.ts';
import { placeName } from './maps.ts';
import { chipRow, railTabs, winHead } from './kit/window.ts';
import type { WinTab } from './kit/window.ts';
import { tgPackButton, tgPayNote, starIcon } from '../tg.ts'; // the packs for Telegram Stars (docs/27)

const L = dict(EN, RU);
const AL = dict(AEN, ARU);
const FL = dict(FEN, FRU);
const T = (x: readonly [string, string]) => x[lang() === 'ru' ? 1 : 0];

/** The doubloon: its own picture once painted, the silver coins gilded meanwhile. */
export function doubloonIcon(cls = 'ico-sm'): string {
  return assetUrl('icon.doubloon') ? icon('doubloon', '◉', cls) : icon('coin', '◉', `${cls} dbl-gild`);
}

/** A sum of doubloons as the window shows it: the gold coin and the number. */
export function doubloons(n: number): string {
  return `<span class="dbl">${doubloonIcon()}${fmt(n)}</span>`;
}

const dblWord = (n: number): string => plural(n, L('dbl.one'), L('dbl.few'), L('dbl.many'));

/** A purchase's own id (the server buys once by it). */
const pid = (): string => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** A span of time: «2 дн. 4 ч», or the island's own clock under a day. */
function dur(ms: number): string {
  const s = Math.max(0, ms / 1000);
  if (s < 86_400) return timeText(s);
  const d = Math.floor(s / 86_400), h = Math.floor((s % 86_400) / 3600);
  return `${L('q.d', { n: d })}${h ? ` ${L('q.h', { n: h })}` : ''}`;
}

// ------------------------------------------------------------------------------------------------ the hulls and creatures

function whyText(why: PremiumWhy, lv = 0): string {
  return L(`why.${why}`, { n: lv });
}

/** The painted figure of a hull: her sprite laid on her side, bow to the right. */
function hullArt(c: ShipClassId): string {
  const art = assetUrl(SHIP_CLASSES[c].sprite);
  return `<div class="pm-art pm-hull">${art ? `<img src="${art}" alt="" draggable="false" />` : icon('menu_ship', '⚓', 'ico-lg')}</div>`;
}

/** A creature's own figure, whole (or its face standing in until it is painted). */
function unitArt(u: UnitId): string {
  const fig = UNITS[u]?.beast || isShipBeast(u) ? assetUrl(`unit.${u}`) : null;
  return `<div class="pm-art pm-fig">${fig ? `<img src="${fig}" alt="" draggable="false" />` : unitIcon(u, 'pm-face')}</div>`;
}

function buyBox(price: number, why: PremiumWhy | null, lv: number, attr: string): string {
  return `<div class="pm-buy"><span class="pm-price">${doubloons(price)}</span>
    <button class="btn btn-small${why ? '' : ' btn-primary'}" ${attr} ${why ? `disabled title="${esc(whyText(why, lv))}"` : ''}>${esc(L('buy'))}</button>
    ${why ? `<small class="pm-why">${esc(whyText(why, lv))}</small>` : ''}</div>`;
}

/** A premium hull's gift (docs/02 §1.A.9): its name, when it works and what it does — on her card and her ship's screen. */
export function giftLine(c: ShipClassId): string {
  const g = giftOf(c);
  if (!g) return '';
  return `<span class="pm-gift" title="${esc(FL('gift'))}"><b>${esc(T(g.name))}</b> <span class="muted">· ${esc(FL(`kind.${g.kind}` as keyof typeof FEN))}</span><br>${esc(T(g.text))}</span>`;
}

function shipCard(c: PremiumShipCard): string {
  const d = SHIP_CLASSES[c.id];
  const beasts = c.beasts.length ? `<span class="pm-with"><span class="muted">${esc(L('comes'))}</span> ${c.beasts.map((b) => `<span class="pm-beast">${unitIcon(b.u, 'pm-face-xs')}${esc(unitName(b.u))} ×${b.n}</span>`).join(' ')}</span>` : '';
  return `<div class="card pm-card pm-ship${c.why ? ' shut' : ''}">${hullArt(c.id)}
    <div class="pm-text"><b class="pm-name">${esc(d.name)}</b><span class="pm-note">${esc(T(c.note))}</span>${giftLine(c.id)}
      <div class="hull-stats"><span>${icon('stat_hull', '', 'ico-sm')}${d.hull}</span><span>${icon('stat_sails', '', 'ico-sm')}${d.maxSpeed}</span><span>${icon('fire', '', 'ico-sm')}${d.gunPortsPerSide}×2</span><span>${icon('tab_market', '', 'ico-sm')}${d.holdVolume}</span><span>${icon('stat_crew', '', 'ico-sm')}${d.crewMin}–${d.crewMax}</span></div>
      <span class="muted pm-meta">${esc(L('lv', { n: c.lv }))}</span>${beasts}</div>
    ${buyBox(c.price, c.why, c.lv, `data-pmship="${c.id}"`)}</div>`;
}

/** A premium creature: its single stack and its packs of three and five (owner, 2026-10-15). */
function unitCard(c: PremiumUnitCard): string {
  const d = UNITS[c.id];
  const sp = d.specials.length ? ` · ${d.specials.map(specialName).join(', ')}` : '';
  const packs = c.packs ?? [{ k: 1, price: c.price, why: c.why }];
  const why = packs.every((p) => p.why) ? packs[0].why : null;
  const btns = packs.map((p, i) => {
    const off = i ? Math.round(((c.price * p.k) / p.price - 1) * 100) : 0; // (the honest bonus: what the stacks are worth singly against the pack)
    return `<button type="button" class="sh-off${p.why ? '' : ' on'}${i === packs.length - 1 ? ' best' : ''}" data-pmunit="${c.id}" data-k="${p.k}"${p.why ? ` disabled title="${esc(whyText(p.why, c.lv))}"` : ''}><span class="sh-q">${esc(`×${c.n * p.k}`)}</span><span class="sh-p">${doubloonIcon('ico-xs')}${fmt(p.price)}</span>${off > 0 ? `<i class="sh-bonus">${esc(`+${off}%`)}</i>` : ''}</button>`;
  }).join('');
  return `<div class="card sh-card sh-unit${why ? ' shut' : ''}">${unitArt(c.id)}
    <div class="sh-txt"><b class="sh-name">${esc(unitName(c.id))}</b><span class="sh-note">${esc(T(c.note))}</span>
      <span class="sh-meta">${esc(AL('tier', { n: d.tier }))} · ${esc(AL('stat', { atk: d.atk, def: d.def, dmin: d.dmin, dmax: d.dmax, hp: d.hp }))}${esc(sp)} · ${esc(L('ulv', { n: c.lv }))}</span></div>
    <div class="sh-offs">${btns}</div>${why ? `<small class="sh-why">${esc(whyText(why, c.lv))}</small>` : ''}</div>`;
}

// ------------------------------------------------------------------------------------------------ the goods

/** An offer's quantity on its button: «1 ч», «×200», «+25», «3 дн.». */
function qtyOf(offer: ShopOffer, fam: ShopFamily): string {
  const g = offer.grants[0];
  if (!g || fam.sec === 'deals') return L('q.buy');
  let n = 0;
  for (const x of offer.grants) {
    if (x.k !== g.k) continue;
    n += 'min' in x ? x.min : 'days' in x ? x.days : 'hours' in x ? x.hours : 'n' in x ? x.n : 1;
  }
  switch (g.k) {
    case 'speed': return n < 60 ? L('q.min', { n }) : L('q.h', { n: Math.round(n / 60) });
    case 'builder': return L('q.d', { n });
    case 'perm': return L('q.perm', { n: offer.id === 'bperm_2' ? 2 : 1 });
    case 'prod': case 'shield': case 'xp': case 'wind': return n >= 48 && n % 24 === 0 ? L('q.d', { n: n / 24 }) : L('q.h', { n });
    case 'crew': case 'units': return L('q.upto', { n: fmt(n) });
    case 'refill': case 'pardon': case 'move': case 'sub': return L('q.buy');
    default: return `×${fmt(n)}`;
  }
}

/** A family's picture: an icon of the manifest, or a creature's face. */
function famArt(art: string): string {
  return `<div class="sh-art">${art.startsWith('unit:') ? unitIcon(art.slice(5) as UnitId, 'sh-face') : art === 'doubloon' ? doubloonIcon('sh-ico') : icon(art, '◉', 'sh-ico')}</div>`;
}

/** An offer's button: its quantity, its price, its bonus — shut with the reason. */
function offerBtn(fam: ShopFamily, offer: ShopOffer, sv: ShopView, o: { price?: number; why?: ShopWhy | null; attr?: string; ribbon?: string } = {}): string {
  const why = o.why !== undefined ? o.why : sv.why[offer.id] ?? null;
  const price = o.price ?? (offer.id === 'refill' ? sv.price.refill ?? 0 : offer.price);
  const bonus = offerBonus(fam, offer);
  const times = offer.worth ? Math.round((offer.worth / Math.max(1, price)) * 10) / 10 : 0;
  const ribbon = o.ribbon ?? (times ? L('worth', { n: lang() === 'ru' ? String(times).replace('.', ',') : String(times) }) : bonus > 0 ? `+${bonus}%` : '');
  const left = sv.left[offer.id];
  return `<button type="button" class="sh-off${why ? '' : ' on'}${offer.tag ? ` ${offer.tag}` : ''}" ${o.attr ?? `data-shbuy="${offer.id}"`}${why ? ` disabled title="${esc(L(`sw.${why}`))}"` : ''}><span class="sh-q">${esc(qtyOf(offer, fam))}</span><span class="sh-p">${doubloonIcon('ico-xs')}${price > 0 ? fmt(price) : '—'}</span>${ribbon ? `<i class="sh-bonus">${esc(ribbon)}</i>` : ''}${offer.limit && left !== undefined && left > 0 && offer.limit.per !== 'ever' ? `<small class="sh-lim">${esc(L(`per.${offer.limit.per}`))}</small>` : ''}</button>`;
}

/** A family's card: its picture, name and line, its offers side by side (the reason under them when all are shut). */
function famCard(fam: ShopFamily, sv: ShopView, o: { cls?: string; meta?: string } = {}): string {
  const whys = fam.offers.map((x) => sv.why[x.id] ?? null);
  const shut = whys.every(Boolean);
  const meta = o.meta ?? (fam.id === 'refill' && sv.fallen ? `<span class="sh-meta sh-clock">${esc(L('fallen', { n: sv.fallen.n, t: '' }))}<b data-shend="${sv.fallen.until}"></b></span>` : fam.icon.startsWith('unit:') ? `<span class="sh-meta"><b>${esc(unitName(fam.icon.slice(5) as UnitId))}</b></span>` : '');
  return `<div class="card sh-card${shut ? ' shut' : ''}${o.cls ? ` ${o.cls}` : ''}" data-fam="${fam.id}">${famArt(fam.icon)}
    <div class="sh-txt"><b class="sh-name">${esc(T(fam.name))}</b><span class="sh-note">${esc(T(fam.text))}</span>${meta}</div>
    <div class="sh-offs">${fam.offers.map((x) => offerBtn(fam, x, sv)).join('')}</div>${shut ? `<small class="sh-why">${esc(L(`sw.${whys[0]!}`))}</small>` : ''}</div>`;
}

/** «Акции»: her stores, the first top-up's double (or its gift to claim), the deal of the day, the level's gift, the
 *  starter, the subscription, the week's chest. */
function dealsShelf(sv: ShopView, v: PremiumView): string {
  const out: string[] = [storesCard(sv, v)];
  if (sv.gift > 0) out.push(`<div class="card sh-card sh-gift">${famArt('doubloon')}<div class="sh-txt"><b class="sh-name">${esc(L('gift.title'))}</b><span class="sh-note">${esc(L('first.text'))}</span></div>
    <div class="sh-offs"><button type="button" class="sh-off on hot" data-shgift><span class="sh-q">${esc(L('gift.claim', { n: fmt(sv.gift) }))}</span><span class="sh-p">${doubloonIcon('ico-xs')}</span></button></div></div>`);
  else if (sv.firstPay) out.push(`<div class="card sh-card sh-first">${famArt('doubloon')}<div class="sh-txt"><b class="sh-name">${esc(L('first.title'))}</b><span class="sh-note">${esc(L('first.text'))}</span></div>
    <div class="sh-offs"><button type="button" class="sh-off on hot" data-pmtop><span class="sh-q">${esc(L('topup'))}</span><span class="sh-p">${starIcon()}</span></button></div></div>`);
  const d = OFFERS.get(sv.deal.id);
  if (d) {
    out.push(`<div class="card sh-card sh-deal${sv.deal.why ? ' shut' : ''}">${famArt(d.fam.icon)}<div class="sh-txt"><b class="sh-name">${esc(L('deal.title'))}: ${esc(T(d.fam.name))}</b><span class="sh-note">${esc(L('deal.text', { n: Math.round(DEAL_OFF * 100) }))}</span><span class="sh-meta sh-clock">${esc(L('deal.ends', { t: '' }))}<b data-shend="${sv.dayEnds}"></b></span></div>
      <div class="sh-offs">${offerBtn(d.fam, d.offer, sv, { price: sv.deal.price, why: sv.deal.why, attr: 'data-shbuy="deal"', ribbon: `−${Math.round(DEAL_OFF * 100)}%` })}<s class="sh-was">${doubloonIcon('ico-xs')}${fmt(d.offer.price)}</s></div>${sv.deal.why ? `<small class="sh-why">${esc(L(`sw.${sv.deal.why}`))}</small>` : ''}</div>`);
  }
  for (const g of sv.gifts) {
    const fam = SHOP.find((f) => f.id === g.id);
    if (fam) out.push(famCard(fam, sv, { cls: 'sh-hot', meta: `<span class="sh-meta sh-clock">${esc(L('gift.ends', { t: '' }))}<b data-shend="${g.until}"></b></span>` }));
  }
  for (const id of ['starter', 'sub', 'weekly']) {
    if (id === 'starter' && sv.why.starter === 'limit') continue;
    out.push(famCard(SHOP.find((f) => f.id === id)!, sv, { cls: `sh-${id}` }));
  }
  return out.join('');
}

/** Her stores and boosts: what she holds of the shop's goods, what is running and for how long. */
function storesCard(sv: ShopView, v: PremiumView): string {
  const chip = (ico: string, label: string, val: string, extra = '') => `<span class="sh-chip">${icon(ico, '', 'ico-sm')}<span class="sh-cl">${esc(label)}</span>${val ? `<b>${val}</b>` : ''}${extra}</span>`;
  const b = sv.boosts;
  const boost = (k: keyof ShopView['boosts'], ico: string) => (b[k] ? chip(ico, L(`b.${k}`), '', `<b data-shend="${b[k]}"></b>`) : '');
  return `<div class="card sh-stores"><b class="sh-name">${esc(L('inv.title'))}</b><div class="sh-chips">${chip('item_storm_glass', L('inv.speed'), esc(dur(sv.inv.speed * 60_000)))}${chip('sp_mend_hull', L('inv.kits'), String(sv.inv.kits), sv.inv.kits ? `<button type="button" class="btn btn-small sh-use" data-shkit>${esc(L('inv.use'))}</button>` : '')}${chip('item_rabbit_foot', L('inv.charms'), String(sv.inv.charms))}${chip(AUTO_SCROLL_ICON, L('inv.scrolls'), String(v.scrolls ?? 0))}${sv.inv.moves ? chip('tab_isles', L('inv.moves'), String(sv.inv.moves)) : ''}${boost('sub', 'tattoo_crown')}${boost('xp', 'xp')}${boost('wind', 'sp_fair_wind')}${boost('prod', 'build_farm')}${boost('shield', 'build_fort')}</div></div>`;
}

/** The builders and the work under way: each job its clock, «Ускорить» from her store and «Завершить» for doubloons
 *  (`refit`: the yard's refit of her ship only, the sea's «Поход»). */
function workCard(sv: ShopView, refit = false): string {
  const c = sv.crews;
  const jobs = sv.jobs.filter((j) => !refit || j.id === -1);
  if (refit && !jobs.length) return '';
  const name = (j: ShopJobView) => (j.what === 'refit' ? L('job.refit', { n: j.level }) : j.what === 'ship' ? L('job.ship') : j.what.startsWith('t:') ? treeLabel(j.what.slice(2), j.level) : baseName(j.what));
  const rows = jobs.map((j) => {
    const done = Math.round(Math.min(1, Math.max(0, (sv.now - j.start) / Math.max(1, j.end - j.start))) * 100);
    return `<div class="sh-job"><span class="sh-jn">${esc(name(j))}</span><b class="sh-jt" data-shend="${j.end}"></b><span class="sh-jbar"><i style="width:${done}%"></i></span>
      <button type="button" class="btn btn-small sh-jb" data-shspeed="${j.id}"${sv.inv.speed > 0 ? '' : ' disabled'} title="${esc(`${L('inv.speed')}: ${dur(sv.inv.speed * 60_000)}`)}">${icon('item_storm_glass', '', 'ico-xs')}${esc(L('job.speed'))}</button><button type="button" class="btn btn-small btn-primary sh-jb" data-shfin="${j.id}" data-n="${j.finish}">${esc(L('job.finish'))} ${doubloonIcon('ico-xs')}${fmt(j.finish)}</button></div>`;
  }).join('');
  const head = refit || !c
    ? `<b class="sh-name">${esc(L('job.title'))}</b>${!refit ? `<span class="sh-meta">${esc(L('cr.none'))}</span>` : ''}`
    : `<b class="sh-name">${icon('prof_carpenter', '', 'ico-sm')}${esc(L('cr.title', { busy: c.busy, n: c.n }))}</b><span class="sh-meta">${esc(L('cr.parts', { a: c.base, b: c.perm, c: c.temp.length, d: c.sub }))}</span>${c.temp.map((t) => `<span class="sh-meta sh-clock">${icon('prof_carpenter', '', 'ico-xs')}<b data-shend="${t}"></b></span>`).join('')}`;
  return `<div class="card sh-work"><div class="sh-wh">${head}</div>${rows || (refit ? '' : `<p class="sh-meta">${esc(L('job.none'))}</p>`)}</div>`;
}

/** The top-up: the packs for Stars, the first top-up's double. */
function topUp(v: PremiumView): string {
  const packs = DOUBLOON_PACKS.map((p) => {
    const n = p.n + p.bonus;
    const pct = p.bonus ? Math.round((p.bonus / p.n) * 100) : 0;
    return `<div class="card pm-pack${p.id === 'd1990' ? ' best' : ''}">${doubloonIcon('ico-lg')}<b class="pm-pack-n">${fmt(n)}</b><span class="pm-pack-w">${esc(dblWord(n))}</span>
      <span class="pm-bonus${p.bonus ? '' : ' none'}">${p.bonus ? esc(`+${pct}%`) : '&nbsp;'}</span>
      ${v.pay ? tgPackButton(p.id, p.stars) : `<button class="btn btn-small" disabled>${esc(L('top.soon'))}</button>`}</div>`;
  }).join('');
  const first = v.shop?.firstPay ? `<p class="sh-firstline">${doubloonIcon('ico-sm')}<b>${esc(L('first.title'))}</b><span>${esc(L('first.text'))}</span></p>` : '';
  // Payments closed (no bot token on the server): the packs are shown, none can be bought; open, each Buys for Stars.
  return `<div class="pm-top"><div class="pm-top-h"><div><h3 class="title-sm">${esc(L('top.title'))}</h3><p class="muted">${esc(L('top.sub'))}</p></div>
      <button class="btn btn-small" data-pmback>${esc(L('top.back'))}</button></div>${first}
    <div class="pm-packs">${packs}</div>
    ${v.pay ? `<p class="pm-paynote">${starIcon()}${esc(tgPayNote())}</p>` : `<p class="pm-soon">${icon('tab_letters', '', 'ico-sm')}${esc(L('top.note'))}</p>`}</div>`;
}

const TAB_ICON: Record<ShopTab, string> = { sea: 'menu_ship', board: 'bt_charge', isle: 'tab_isles' };
const SEC_ICON: Record<ShopSec, string> = { deals: 'tattoo_star', ships: 'menu_ship', supply: 'ammo_round', voyage: 'sp_fair_wind', units: 'build_kennel', recruit: 'build_barracks', battle: 'tab_contracts', build: 'prof_carpenter', res: 'good_timber', isle: 'build_fort' };

/** The families on a shelf of a tab (a family of several tabs stands on its own shelf in its first tab, on the last
 *  shelf of the others: the speed-ups under the sea's «Поход», for the yard's refit). */
function familiesOn(tab: ShopTab, sec: ShopSec): ShopFamily[] {
  const last = TAB_SECS[tab][TAB_SECS[tab].length - 1];
  return SHOP.filter((f) => f.sec !== 'deals' && f.tabs.includes(tab) && (f.tabs[0] === tab ? f.sec === sec : sec === last));
}

export class PremiumWindow {
  tab: ShopTab = 'sea';
  sec: ShopSec = 'deals';
  /** The top-up's packs in place of the shelves. */
  topup = false;
  private send: (m: ClientMsg) => void;
  private timer = 0;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  /** Open at the top-up, or at a tab's shelf (the island's builders, the battle's scrolls, …). */
  open(topup = false, at?: { tab: ShopTab; sec?: ShopSec }): void {
    this.topup = topup;
    if (at) {
      this.tab = at.tab;
      this.sec = at.sec ?? 'deals';
    }
    this.send({ t: 'premium', action: 'view' });
  }

  /** The clocks on the cards, every second while the window is open (by the server's wall clock of the view). */
  private tick(root: HTMLElement, now0: number): void {
    clearInterval(this.timer);
    const at = performance.now();
    const draw = () => {
      if (!root.isConnected || root.dataset.modal !== 'shop') {
        clearInterval(this.timer);
        return;
      }
      const now = now0 + (performance.now() - at);
      root.querySelectorAll<HTMLElement>('[data-shend]').forEach((el) => {
        const t = dur(Number(el.dataset.shend) - now);
        if (el.textContent !== t) el.textContent = t;
      });
    };
    draw();
    this.timer = setInterval(draw, 1000) as unknown as number;
  }

  render(root: HTMLElement, state: ClientState): void {
    const v = state.premium;
    const sv = v?.shop;
    const balance = v?.balance ?? state.doubloons;
    const purse = `<span class="w-fig gold sh-bal" title="${esc(L('balance'))}">${doubloonIcon('w-fig-ico')}<b>${fmt(balance)}</b></span><button type="button" class="btn btn-small btn-primary sh-top" data-pmtop>${esc(L('topup'))}</button>`;
    const head = winHead(L('title'), { crest: 'doubloon', figures: purse });
    if (!v || !sv) root.innerHTML = `${head}<div class="modal-body sh-body"></div>`;
    else if (this.topup) root.innerHTML = `${head}<div class="modal-body sh-body sh-topup">${topUp(v)}</div>`;
    else {
      if (this.sec !== 'deals' && !TAB_SECS[this.tab].includes(this.sec)) this.sec = 'deals';
      const tabs: WinTab[] = (['sea', 'board', 'isle'] as ShopTab[]).map((t) => ({ id: t, icon: TAB_ICON[t], label: L(`tab.${t}`) }));
      const secs: WinTab[] = (['deals', ...TAB_SECS[this.tab]] as ShopSec[]).map((s) => ({ id: s, icon: SEC_ICON[s], label: L(`sec.${s}`) }));
      root.innerHTML = `${head}<div class="w-frame">${railTabs(tabs, this.tab, 'shtab')}<div class="w-pane">${chipRow(secs, this.sec, 'shsec')}<div class="modal-body sh-body" data-page="${this.tab}-${this.sec}">${this.shelf(v, sv)}</div></div></div>`;
    }
    this.tick(root, sv?.now ?? Date.now());
    this.wire(root, state, v);
  }

  /** The page of a shelf. */
  private shelf(v: PremiumView, sv: ShopView): string {
    const tab = this.tab, sec = this.sec;
    if (sec === 'deals') return `<div class="sh-grid">${dealsShelf(sv, v)}</div>`;
    if (sec === 'ships') {
      const on = (l: string) => v.ships.filter((x) => (SHIP_CLASSES[x.id].list ?? 'combat') === l);
      const rule = v.port ? L('deliver', { port: placeName(v.port) }) : L('deliverSea');
      return `<p class="muted sh-rule">${esc(rule)}</p>${FLEET_LISTS.map((l) => (on(l).length ? `<h4 class="pm-list">${esc(FL(`list.${l}` as keyof typeof FEN))}</h4><div class="pm-grid">${on(l).map(shipCard).join('')}</div>` : '')).join('')}`;
    }
    if (sec === 'units') return `<p class="muted sh-rule">${esc(L('unitsRule'))}</p><div class="sh-grid">${v.units.map(unitCard).join('')}</div>`;
    const cards: string[] = [];
    if (sec === 'build') cards.push(workCard(sv));
    if (tab === 'sea' && sec === 'voyage') cards.push(workCard(sv, true));
    for (const f of familiesOn(tab, sec)) cards.push(famCard(f, sv));
    const pvp = sec === 'battle' || sec === 'voyage' ? `<p class="muted sh-rule">${esc(L('pvp'))}</p>` : '';
    return `<div class="sh-grid">${cards.join('')}</div>${pvp}`;
  }

  private wire(root: HTMLElement, state: ClientState, v: PremiumView | null): void {
    const redraw = () => this.render(root, state);
    root.querySelectorAll<HTMLElement>('[data-pmtop]').forEach((b) => (b.onclick = () => {
      this.topup = !this.topup;
      redraw();
    }));
    root.querySelector<HTMLElement>('[data-pmback]')?.addEventListener('click', () => {
      this.topup = false;
      redraw();
    });
    // A pack for Stars: the server makes the invoice and sends its link (src/tg.ts opens it).
    root.querySelectorAll<HTMLButtonElement>('[data-pmpack]').forEach((b) => (b.onclick = () => {
      b.disabled = true;
      setTimeout(() => (b.disabled = false), 4000);
      this.send({ t: 'premium', action: 'stars', pack: b.dataset.pmpack!, lang: lang() === 'ru' ? 'ru' : 'en' });
    }));
    root.querySelectorAll<HTMLElement>('[data-shtab]').forEach((b) => (b.onclick = () => {
      this.tab = b.dataset.shtab as ShopTab;
      this.sec = 'deals';
      redraw();
    }));
    root.querySelectorAll<HTMLElement>('[data-shsec]').forEach((b) => (b.onclick = () => {
      this.sec = b.dataset.shsec as ShopSec;
      redraw();
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-pmship]').forEach((b) => (b.onclick = () => {
      const c = b.dataset.pmship as ShipClassId;
      const card = v?.ships.find((x) => x.id === c);
      if (card) void ask(L('ask.ship', { name: SHIP_CLASSES[c].name, n: fmt(card.price) })).then((ok) => ok && this.send({ t: 'premium', action: 'buy_ship', id: c }));
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-pmunit]').forEach((b) => (b.onclick = () => {
      const u = b.dataset.pmunit as UnitId;
      const k = Number(b.dataset.k ?? 1);
      const card = v?.units.find((x) => x.id === u);
      const pack = card?.packs?.find((p) => p.k === k) ?? (card ? { k: 1, price: card.price } : null);
      const ticket = pid();
      if (card && pack) void ask(L('ask.unit', { name: unitName(u), k: card.n * k, n: fmt(pack.price) })).then((ok) => ok && this.send({ t: 'premium', action: 'buy_unit', id: u, k, pid: ticket }));
    }));
    // The shop's goods: asked once more, then bought by the offer's id and a purchase id of its own.
    root.querySelectorAll<HTMLButtonElement>('[data-shbuy]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.shbuy!;
      const sv = v?.shop;
      const found = id === 'deal' && sv ? OFFERS.get(sv.deal.id) : OFFERS.get(id);
      if (!found || !sv) return;
      const price = id === 'deal' ? sv.deal.price : id === 'refill' ? sv.price.refill ?? 0 : found.offer.price;
      const name = id === 'deal' ? `${L('deal.title')}: ${T(found.fam.name)}` : T(found.fam.name);
      const ticket = pid();
      void ask(L('ask.offer', { name, q: qtyOf(found.offer, found.fam), n: fmt(price) })).then((ok) => {
        if (!ok) return;
        b.disabled = true;
        this.send({ t: 'premium', action: 'shop', offer: id, pid: ticket });
      });
    }));
    root.querySelector<HTMLElement>('[data-shgift]')?.addEventListener('click', () => this.send({ t: 'premium', action: 'gift' }));
    root.querySelector<HTMLElement>('[data-shkit]')?.addEventListener('click', () => this.send({ t: 'premium', action: 'kit' }));
    root.querySelectorAll<HTMLButtonElement>('[data-shspeed]').forEach((b) => (b.onclick = () => this.send({ t: 'premium', action: 'speed', job: Number(b.dataset.shspeed) })));
    root.querySelectorAll<HTMLButtonElement>('[data-shfin]').forEach((b) => (b.onclick = () => {
      const ticket = pid();
      void ask(L('ask.finish', { n: fmt(Number(b.dataset.n)) })).then((ok) => ok && this.send({ t: 'premium', action: 'finish', job: Number(b.dataset.shfin), pid: ticket }));
    }));
  }
}
