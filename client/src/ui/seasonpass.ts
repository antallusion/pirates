// «Сезонная карта» on screen (owner, 2026-10-30; the server decides: server/src/game/seasonpass.ts, the table:
// shared/src/data/seasonpass.ts). One module, its own DOM, in the game's dark wood and brass:
//  - the window: the season's name and its clock, her tier in a medallion and the bar to the next, «Забрать всё»;
//    the track — 100 tiers side by side, the free row over the premium one (a padlock on it without the pass), the
//    taken ones ticked, the ready ones lit (a tap takes them), every 20th framed in gold; under it three panes — the
//    tier's rewards in words, the challenges of the day and the week, the passes with the 100th tier's hull and the
//    Super Pass's frame shown large. On a phone held sideways the panes are tabs; on a wide screen they stand side by
//    side;
//  - «Купить» opens the same payment as the top-up: VK's order box in VK, Telegram's Stars in Telegram, YooKassa's page
//    in the browser (checkout.ts) — the pass is laid on her account by the payment's confirmation;
//  - the round button in the HUD's «⋯» tray (hudmore.ts MORE_ITEMS #tc-pass) with the count of rewards ready, the same
//    count on «⋯» itself; a tier up comes as the server's toast.
// RU and EN: client/src/lang/ui/seasonpass.ts.

import { detailAttr } from './detailattr.ts'; // the detail card (owner, 2026-10-30)
import { registerDetail } from './detail.ts';
import { EN as DET_EN, RU as DET_RU } from '../lang/ui/detail.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { passLine } from '../../../shared/src/data/passlines.ts';
import type { PassLine } from '../../../shared/src/data/passlines.ts';
import { MILESTONES, PASS_PRICES, PASS_SHIP, PASS_TIERS, SUPER_TIERS, challengeOf, passSeason, xpToTier } from '../../../shared/src/data/seasonpass.ts';
import type { PassProductId, PassReward, PassTier } from '../../../shared/src/data/seasonpass.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import { votesText } from '../../../shared/src/data/vk.ts';
import type { PassChallengeView, PassView } from '../../../shared/src/spassproto.ts';
import type { ClientMsg, ServerMsg } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { sendCheckout } from '../checkout.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/seasonpass.ts';
import type { ClientState } from '../state.ts';
import { vkBuy, vkPayOpen } from '../vk.ts';
import { framedFace } from './cosmetics.ts';
import { esc, fmt, glyphSvg, icon } from './dom.ts';
import { badgeText, buttonHtml } from './kit/button.ts';
import { payIn } from './price.ts';
import { countdown } from './promo.ts';

const L = dict(EN, RU);
const T = (x: readonly [string, string]) => x[lang() === 'ru' ? 1 : 0];

export type PassPane = 'tier' | 'ch' | 'pass';

export interface PassDeps {
  send: (m: ClientMsg) => void;
  on: (f: (m: ServerMsg) => void) => void;
  state: ClientState;
  toast: (msg: string, kind: string) => void;
  /** A window open (its name), or null: the card steps down under one. */
  modal: () => string | null;
}

/** A product's price in the money of this place: votes in VK, Stars in Telegram, roubles in the browser. */
export function passPrice(id: PassProductId, cur = payIn()): string {
  const p = PASS_PRICES[id];
  if (cur === 'votes') return votesText(p.votes, lang() === 'ru' ? 'ru' : 'en');
  return cur === 'stars' ? `${fmt(p.stars)} ⭐` : `${fmt(p.rub)} ₽`;
}

const pic = (l: PassLine, cls: string) => icon(l.icon, '◆', cls);
/** A padlock drawn by code (no art for it): the premium row without the pass. */
const LOCK = '<svg class="sp-lock-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7.5a5 5 0 0 1 10 0V10" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="4.5" y="10" width="15" height="11" rx="2.2" fill="currentColor"/><circle cx="12" cy="15.2" r="1.7" fill="#1a130b"/></svg>';

export class SeasonPass {
  view: PassView | null = null;
  private d: PassDeps;
  private over: HTMLElement | null = null;
  private at = 0;
  /** The tier whose rewards the pane shows (0: the next to reach or the first ready). */
  private sel = 0;
  private pane: PassPane = 'tier';
  /** The tier she had when the window last drew (a new one glows once). */
  private seenTier = -1;
  private scrollTo: number | null = null;

  constructor(d: PassDeps) {
    this.d = d;
    d.on((m) => {
      if (m.t !== 'spass') return;
      const was = this.view?.tier;
      this.view = m.view;
      this.at = performance.now();
      if (was !== undefined && m.view.tier > was && this.over) this.scrollTo = m.view.tier;
      this.icon();
      if (this.over) this.draw();
    });
    setInterval(() => {
      this.icon();
      if (this.over) {
        if (this.d.modal()) this.close();
        else this.tick();
      }
    }, 1000);
  }

  /** The server's wall clock now. */
  private now(): number {
    return (this.view?.now ?? Date.now()) + (performance.now() - this.at);
  }

  /** Rewards waiting (the badge). */
  ready(): number {
    return this.view?.claim ?? 0;
  }

  /** The round button in the «⋯» tray (seasonpass.css #tc-pass): the map of the season, its count of rewards ready. */
  icon(): void {
    const host = document.getElementById('touch');
    if (!host) return;
    let el = document.getElementById('tc-pass') as HTMLButtonElement | null;
    if (!el) {
      const t = document.createElement('template');
      t.innerHTML = buttonHtml({ kind: 'icon', id: 'tc-pass', icon: 'map_treasure', glyph: '✦', aria: L('btnAria'), cls: 'sea-round tc-pass' }).trim();
      el = t.content.firstElementChild as HTMLButtonElement;
      el.insertAdjacentHTML('beforeend', `<b class="k-badge tc-pass-b hidden" aria-hidden="true"></b><span class="tc-pass-l">${esc(L('btn'))}</span>`);
      el.addEventListener('click', () => this.open());
      host.append(el);
    }
    const b = el.querySelector<HTMLElement>('.tc-pass-b')!;
    const txt = badgeText(this.ready());
    if (b.textContent !== txt) b.textContent = txt;
    if (b.classList.contains('hidden') !== !txt) b.classList.toggle('hidden', !txt);
    const l = el.querySelector<HTMLElement>('.tc-pass-l')!;
    if (l.textContent !== L('btn')) l.textContent = L('btn');
    const words = L('btnAria');
    if (el.getAttribute('aria-label') !== words) {
      el.setAttribute('aria-label', words);
      el.title = words;
    }
  }

  isOpen(): boolean {
    return !!this.over;
  }

  open(pane?: PassPane): void {
    this.over?.remove();
    const el = document.createElement('div');
    el.id = 'spass-over';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', L('title'));
    el.addEventListener('click', (e) => {
      if (e.target === el) this.close();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    });
    document.body.appendChild(el);
    this.over = el;
    if (pane) this.pane = pane;
    this.sel = 0;
    this.scrollTo = null;
    this.d.send({ t: 'spass', action: 'view' });
    this.draw();
  }

  close(): void {
    this.over?.remove();
    this.over = null;
  }

  /** The tier the pane shows: hers chosen, else the first ready, else the next to reach. */
  private selTier(v: PassView): number {
    if (this.sel) return this.sel;
    for (let t = 1; t <= v.tier; t++) if (this.readyAt(v, t, 'free') || this.readyAt(v, t, 'premium')) return t;
    return Math.min(PASS_TIERS, v.tier + 1);
  }

  private readyAt(v: PassView, t: number, track: 'free' | 'premium'): boolean {
    const row = passSeason(v.season).tiers.find((x) => x.t === t);
    if (!row || t > v.tier) return false;
    if (track === 'premium') return !!v.has && row.premium.length > 0 && !v.prem.includes(t);
    return row.free.length > 0 && !v.free.includes(t);
  }

  private cell(v: PassView, x: PassTier, track: 'free' | 'premium'): string {
    const rs = track === 'free' ? x.free : x.premium;
    const taken = (track === 'free' ? v.free : v.prem).includes(x.t);
    const reached = x.t <= v.tier;
    const lockedPass = track === 'premium' && !v.has;
    const ready = this.readyAt(v, x.t, track);
    const big = rs.some((r) => passLine(r).big);
    const cls = ['sp-cell', `sp-${track}`, !rs.length ? 'empty' : '', taken ? 'taken' : '', ready ? 'ready' : '', !reached ? 'ahead' : '', lockedPass ? 'nopass' : '', big ? 'big' : ''].filter(Boolean).join(' ');
    if (!rs.length) return `<div class="${cls}" aria-hidden="true"></div>`;
    const main = passLine(rs[0], v.silverMin);
    const more = rs.length > 1 ? `<small class="sp-more">${esc(L('more', { n: rs.length - 1 }))}</small>` : '';
    const name = rs.map((r) => { const l = passLine(r, v.silverMin); return `${T(l.name)} ${T(l.qty)}`; }).join(' · ');
    // its card on a long press or a right click (a tap claims it, or opens the tier): every reward with its icon and words
    registerDetail(`pass:${x.t}:${track}`, () => ({
      name: main.name, color: big ? '#ff9a3c' : '#e8c872', sub: [DET_EN['pass.sub'].replace('{n}', String(x.t)).replace('{track}', DET_EN[`pass.${track === 'free' ? 'free' : 'premium'}`]), DET_RU['pass.sub'].replace('{n}', String(x.t)).replace('{track}', DET_RU[`pass.${track === 'free' ? 'free' : 'premium'}`])],
      art: main.icon, fig: 'icon',
      rows: rs.map((r) => { const l = passLine(r, v.silverMin); return { k: l.name, v: l.qty, icon: l.icon }; }),
      notes: rs.map((r) => passLine(r, v.silverMin).hint).filter((h): h is [string, string] => !!h).map((t) => ({ t, tone: 'gift' as const })),
    }));
    return `<button type="button" class="${cls}" data-spt="${x.t}" data-sptr="${track}"${detailAttr(`pass:${x.t}:${track}`, { hold: true })} title="${esc(name)}" aria-label="${esc(`${L('tierN', { n: x.t })}, ${L(track === 'free' ? 'free' : 'premium')}: ${name}`)}">
      <span class="sp-pic">${pic(main, 'sp-ico')}${more}</span><b class="sp-q">${esc(T(main.qty))}</b>${taken ? '<i class="sp-tick" aria-hidden="true">✓</i>' : ''}${lockedPass ? `<i class="sp-lock" aria-hidden="true">${LOCK}</i>` : ''}</button>`;
  }

  private track(v: PassView): string {
    const s = passSeason(v.season);
    const cols = s.tiers.map((x) => {
      const mile = MILESTONES.includes(x.t);
      const cur = x.t === v.tier;
      const next = x.t === v.tier + 1;
      const sel = x.t === this.selTier(v);
      return `<div class="sp-col${mile ? ' mile' : ''}${x.t <= v.tier ? ' got' : ''}${cur ? ' cur' : ''}${next ? ' next' : ''}${sel ? ' sel' : ''}" data-spcol="${x.t}">
        <button type="button" class="sp-n" data-spsel="${x.t}" aria-label="${esc(L('tierN', { n: x.t }))}">${x.t}</button>
        ${this.cell(v, x, 'free')}${this.cell(v, x, 'premium')}</div>`;
    }).join('');
    // the line under the tiers: filled to her tier and a share into the next
    const fill = Math.min(100, ((v.tier + (v.need ? v.into / v.need : 0)) / PASS_TIERS) * 100);
    return `<div class="sp-tw"><div class="sp-rows" aria-hidden="true"><span class="sp-rl">${esc(L('free'))}</span><span class="sp-rl sp-rl-p">${v.has ? '' : `<i class="sp-lock-s">${LOCK}</i>`}${esc(L('premium'))}</span></div>
      <div class="sp-track" data-sptrack><div class="sp-cols" style="--fill:${fill.toFixed(2)}%">${cols}</div></div></div>`;
  }

  private lines(v: PassView, rs: readonly PassReward[]): string {
    if (!rs.length) return `<p class="sp-none muted">${esc(L('nothing'))}</p>`;
    return `<ul class="sp-lines">${rs.map((r) => {
      const l = passLine(r, v.silverMin);
      return `<li class="${l.big ? 'big' : ''}" title="${esc(l.hint ? T(l.hint) : '')}">${pic(l, 'sp-li-ico')}<span><b>${esc(T(l.name))}</b><small>${esc(T(l.qty))}${r.k === 'units' ? ` · ${esc(L('gift'))}` : ''}</small></span></li>`;
    }).join('')}</ul>`;
  }

  private tierPane(v: PassView): string {
    const t = this.selTier(v);
    const x = passSeason(v.season).tiers.find((y) => y.t === t)!;
    const act = (track: 'free' | 'premium') => {
      const taken = (track === 'free' ? v.free : v.prem).includes(t);
      if (taken) return `<span class="sp-taken">✓ ${esc(L('taken'))}</span>`;
      if (track === 'premium' && !v.has) return `<button type="button" class="btn btn-small" data-sppane="pass">${LOCK} ${esc(L('needPass'))}</button>`;
      if (t > v.tier) return `<span class="sp-lockt muted">${esc(L('locked', { n: t }))}</span>`;
      const rs = track === 'free' ? x.free : x.premium;
      return rs.length ? `<button type="button" class="btn btn-small btn-primary" data-spclaim="${t}" data-sptrack2="${track}">${esc(L('claim'))}</button>` : '';
    };
    // (the action stands in each card's head, beside its name: nothing under the fold on a phone held sideways)
    const head = (track: 'free' | 'premium') => `<div class="sp-tp-ch"><h4>${MILESTONES.includes(t) ? '<span class="sp-mile">★</span> ' : ''}${esc(L('tierN', { n: t }))} · ${esc(L(track === 'free' ? 'free' : 'premium'))}</h4>${act(track)}</div>`;
    return `<div class="sp-tp"><div class="sp-tp-g"><section class="sp-tp-c">${head('free')}${this.lines(v, x.free)}</section>
      <section class="sp-tp-c prem">${head('premium')}${this.lines(v, x.premium)}</section></div></div>`;
  }

  private chRow(c: PassChallengeView): string {
    const d = challengeOf(c.id);
    if (!d) return '';
    const pct = Math.round((Math.min(c.prog, c.need) / c.need) * 100);
    return `<li class="${c.done ? 'done' : ''}"><span class="sp-ch-t">${esc(T(d.text).replace('{n}', String(c.need)))}</span>
      <span class="sp-ch-b"><i style="width:${pct}%"></i></span><b class="sp-ch-n">${c.done ? '✓' : `${c.prog}/${c.need}`}</b><small class="sp-ch-x">${esc(L('chXp', { n: c.xp }))}</small></li>`;
  }

  private chPane(v: PassView): string {
    return `<div class="sp-ch"><section><h4>${esc(L('daily'))} <small class="muted" data-sprenew="d">${esc(L('renew', { t: countdown(v.dayEnds - this.now()) }))}</small></h4><ul>${v.daily.map((c) => this.chRow(c)).join('')}</ul></section>
      <section><h4>${esc(L('weekly'))} <small class="muted" data-sprenew="w">${esc(L('renew', { t: countdown(v.weekEnds - this.now()) }))}</small></h4><ul>${v.weekly.map((c) => this.chRow(c)).join('')}</ul></section>
      <p class="sp-how muted">${esc(L('how'))}</p></div>`;
  }

  /** The 100th tier's hull and the Super Pass's frame, large. */
  private previews(): string {
    const d = SHIP_CLASSES[PASS_SHIP];
    const art = assetUrl(d.sprite);
    const cap = this.d.state.self ? CAPTAINS[this.d.state.self.captain] : null;
    const face = { id: cap?.portrait ?? '', url: cap ? assetUrl(cap.portrait) : null };
    const ship = passLine({ k: 'ship', c: PASS_SHIP });
    return `<div class="sp-prev"><figure class="sp-pv-ship"><span class="sp-pv-k">${esc(L('ship100'))}</span>${art ? `<img src="${art}" alt="" draggable="false">` : ''}
        <figcaption><b>${esc(T(ship.name))}</b><small>${esc(T(ship.qty))} · ${esc(L('shipNote', { r: d.tier, g: d.gunPortsPerSide, n: d.premium?.beasts?.[0]?.n ?? 0 }))}</small></figcaption></figure>
      <figure class="sp-pv-frame"><span class="sp-pv-k">${esc(L('frameSuper'))}</span>${framedFace(face, 'abyss')}<figcaption><b>${esc(lang() === 'ru' ? 'Рамка «Бездна»' : 'Abyssal frame')}</b><small>${esc(L('frameNote'))}</small></figcaption></figure></div>`;
  }

  private card(id: PassProductId, name: string, lines: string[], best = false, active = false): string {
    return `<div class="sp-buy${best ? ' best' : ''}${active ? ' active' : ''}"><div class="sp-buy-h"><b>${esc(name)}</b>${best && !active ? `<span class="sp-best">${esc(L('best'))}</span>` : ''}</div>
      <ul>${lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${active ? `<span class="sp-active">✓ ${esc(L('active'))}</span>` : `<button type="button" class="btn btn-small btn-primary sp-buy-b" data-spbuy="${id}">${esc(L('buyFor', { p: passPrice(id) }))}</button>`}</div>`;
  }

  private passPane(v: PassView): string {
    const cards = v.has === 'super'
      ? this.card('pass_super', L('sp.name'), [L('sp.l1'), L('sp.l2'), L('sp.l3')], false, true)
      : v.has === 'premium'
        ? this.card('pass_premium', L('pm.name'), [L('pm.l1'), L('pm.l2'), L('pm.l3')], false, true) + this.card('pass_upgrade', L('up.name'), [L('up.l1'), L('sp.l3')], true)
        : this.card('pass_premium', L('pm.name'), [L('pm.l1'), L('pm.l2'), L('pm.l3')]) + this.card('pass_super', L('sp.name'), [L('sp.l1'), L('sp.l2', { n: SUPER_TIERS }), L('sp.l3')], true);
    return `<div class="sp-pass">${this.previews()}<div class="sp-cards">${cards}</div></div>`;
  }

  private draw(): void {
    const el = this.over;
    if (!el) return;
    const v = this.view;
    if (!v) {
      el.innerHTML = `<div class="sp-box"><header class="sp-head"><b class="sp-title">${esc(L('title'))}</b><button type="button" class="po-x po-x-big g-only" data-spx aria-label="${esc(L('close'))}">${glyphSvg('close')}</button></header></div>`;
      el.querySelector<HTMLElement>('[data-spx]')!.onclick = () => this.close();
      return;
    }
    const s = passSeason(v.season);
    const keep = el.querySelector<HTMLElement>('[data-sptrack]')?.scrollLeft;
    const newTier = this.seenTier >= 0 && v.tier > this.seenTier;
    this.seenTier = v.tier;
    const bar = v.need ? Math.round((v.into / v.need) * 100) : 100;
    const panes: PassPane[] = ['tier', 'ch', 'pass'];
    el.innerHTML = `<div class="sp-box sp-on-${this.pane}">
      <header class="sp-head"><b class="sp-title">${esc(L('title'))}</b><span class="sp-sname">«${esc(T(s.name))}» · ${esc(L('season', { n: v.season }))}${s.draft ? ` <small class="muted">(${esc(L('draft'))})</small>` : ''}</span>
        <span class="sp-ends" data-spends>${esc(L('ends', { t: countdown(v.until - this.now()) }))}</span>
        <button type="button" class="po-x po-x-big g-only" data-spx aria-label="${esc(L('close'))}">${glyphSvg('close')}</button></header>
      <div class="sp-prog"><span class="sp-med${newTier ? ' up' : ''}" title="${esc(L('tier'))}"><small>${esc(L('tier'))}</small><b>${v.tier}</b></span>
        <span class="sp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${bar}"><i style="width:${bar}%"></i><em>${v.need ? esc(L('xp', { a: fmt(v.into), b: fmt(v.need) })) : esc(L('max'))}</em></span>
        <span class="sp-pass-tag ${v.has ?? 'free'}">${esc(v.has === 'super' ? L('sp.name') : v.has === 'premium' ? L('pm.name') : L('free'))}</span>
        <button type="button" class="btn btn-small btn-primary sp-all" data-spall ${v.claim ? '' : 'disabled'}>${esc(L('claimAll'))}${v.claim ? ` <b class="sp-all-n">${v.claim > 99 ? '99+' : v.claim}</b>` : ''}</button></div>
      ${this.track(v)}
      <nav class="sp-tabs" role="tablist">${panes.map((p) => `<button type="button" role="tab" aria-selected="${p === this.pane}" class="${p === this.pane ? 'on' : ''}" data-sppane="${p}">${esc(L(`tab.${p}` as 'tab.tier'))}${p === 'pass' && !v.has ? ' ★' : ''}</button>`).join('')}</nav>
      <div class="sp-panes"><div class="sp-pane sp-p-tier">${this.tierPane(v)}</div><div class="sp-pane sp-p-ch">${this.chPane(v)}</div><div class="sp-pane sp-p-pass">${this.passPane(v)}</div></div></div>`;
    this.wire(el);
    const tr = el.querySelector<HTMLElement>('[data-sptrack]')!;
    const goTo = this.scrollTo ?? (keep === undefined ? this.selTier(v) : null);
    this.scrollTo = null;
    if (goTo !== null) {
      const col = tr.querySelector<HTMLElement>(`[data-spcol="${goTo}"]`);
      if (col) tr.scrollLeft = Math.max(0, col.offsetLeft - tr.clientWidth / 2 + col.offsetWidth / 2);
    } else if (keep !== undefined) tr.scrollLeft = keep;
  }

  private wire(el: HTMLElement): void {
    el.querySelector<HTMLElement>('[data-spx]')!.onclick = () => this.close();
    el.querySelector<HTMLElement>('[data-spall]')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLButtonElement).disabled = true;
      this.d.send({ t: 'spass', action: 'claim_all' });
    });
    el.querySelectorAll<HTMLElement>('[data-sppane]').forEach((b) => b.addEventListener('click', () => {
      this.pane = b.dataset.sppane as PassPane;
      this.draw();
    }));
    el.querySelectorAll<HTMLElement>('[data-spsel]').forEach((b) => b.addEventListener('click', () => {
      this.sel = Number(b.dataset.spsel);
      this.pane = 'tier';
      this.draw();
    }));
    el.querySelectorAll<HTMLElement>('[data-spt]').forEach((b) => b.addEventListener('click', () => {
      const t = Number(b.dataset.spt);
      const track = b.dataset.sptr === 'premium' ? 'premium' : 'free';
      // a ready one is taken at a tap; any other shows its rewards (a locked premium one: the passes)
      if (this.view && this.readyAt(this.view, t, track)) this.d.send({ t: 'spass', action: 'claim', tier: t, track });
      this.sel = t;
      this.pane = track === 'premium' && !this.view?.has ? 'pass' : 'tier';
      this.draw();
    }));
    el.querySelectorAll<HTMLElement>('[data-spclaim]').forEach((b) => b.addEventListener('click', () => {
      (b as HTMLButtonElement).disabled = true;
      this.d.send({ t: 'spass', action: 'claim', tier: Number(b.dataset.spclaim), track: b.dataset.sptrack2 === 'premium' ? 'premium' : 'free' });
    }));
    el.querySelectorAll<HTMLElement>('[data-spbuy]').forEach((b) => b.addEventListener('click', () => this.buy(b.dataset.spbuy as PassProductId)));
  }

  /** The clocks only (once a second). */
  private tick(): void {
    const v = this.view;
    const el = this.over;
    if (!v || !el) return;
    const e = el.querySelector<HTMLElement>('[data-spends]');
    if (e) e.textContent = L('ends', { t: countdown(v.until - this.now()) });
    const d = el.querySelector<HTMLElement>('[data-sprenew="d"]');
    if (d) d.textContent = L('renew', { t: countdown(v.dayEnds - this.now()) });
    const w = el.querySelector<HTMLElement>('[data-sprenew="w"]');
    if (w) w.textContent = L('renew', { t: countdown(v.weekEnds - this.now()) });
  }

  /** «Купить»: the same payment as the top-up's, by where she plays (price.ts payIn). */
  buy(id: PassProductId): void {
    const v = this.view;
    const cur = payIn();
    if (cur === 'votes') {
      if (!vkPayOpen()) return this.d.toast(L('payShut'), 'info');
      void vkBuy(id, this.d.toast);
      return;
    }
    if (cur === 'rub' && v?.web) {
      this.d.toast(L('opened'), 'info');
      sendCheckout(this.d.send, id);
      return;
    }
    if (v?.pay) {
      this.d.send({ t: 'premium', action: 'stars', pack: id, lang: lang() === 'ru' ? 'ru' : 'en' });
      return;
    }
    this.d.toast(L('payShut'), 'info');
  }
}

/** The experience to a tier (the tests and the QA's look). */
export const passXpTo = xpToTier;
