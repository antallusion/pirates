// The daily login gift on screen (owner, 2026-10-16, «да»; the server decides: server/src/game/dailygift.ts, the table:
// shared/src/data/dailygift.ts). One module, its own DOM:
//  - the calendar: seven days of the week in a row, the taken ones ticked, today's lit, the week of four on the head;
//    «Забрать» takes today's gift (the server's word), «Позже» leaves it to the round icon. It comes by itself once a
//    session after loading — never in the First Watch, a fight or over a window — and FIRST: the offers' entry
//    carousel (promo.ts) waits while it is due or open (`holding`), so the two never stand at once;
//  - the round icon in the left row under the captain's plate (seahud.css #tc-daily) while today's gift is untaken,
//    a «!» on its corner; a tap opens the calendar.
// RU and EN: client/src/lang/ui/dailygift.ts. The gift's sound: sfx.ts 'gift'.

import type { Gift, GiftView } from '../../../shared/src/data/dailygift.ts';
import { AUTO_SCROLL_ICON } from '../../../shared/src/data/premium.ts';
import type { ClientMsg, ServerMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/dailygift.ts';
import { cue } from '../sfx.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt, icon } from './dom.ts';
import { buttonHtml } from './kit/button.ts';
import { doubloonIcon } from './premium.ts';
import { countdown, seaIconUp } from './promo.ts';

const L = dict(EN, RU);

/** What a day's gift holds, its main thing first: the picture, the words, the amount. */
export function giftParts(g: Gift): { art: string; name: string; q: string }[] {
  const out: { art: string; name: string; q: string }[] = [];
  const ru = lang() === 'ru';
  if (g.doubloons) out.push({ art: 'doubloon', name: L('g.doubloons'), q: `×${g.doubloons}` });
  if (g.scrolls) out.push({ art: AUTO_SCROLL_ICON, name: L('g.scrolls'), q: `×${g.scrolls}` });
  if (g.speed) {
    const min = g.speed * 15;
    out.push({ art: 'ui_hourglass', name: L('g.speed'), q: min >= 60 && min % 60 === 0 ? `${min / 60}${ru ? ' ч' : 'h'}` : `${min}${ru ? ' м' : 'm'}` });
  }
  if (g.res) out.push({ art: 'good_timber', name: L('g.res'), q: `×${fmt(Object.values(g.res).reduce((a, n) => a + (n ?? 0), 0))}` });
  if (g.silver) out.push({ art: 'coin', name: L('g.silver'), q: fmt(g.silver) });
  return out;
}

const pic = (art: string, cls: string) => (art === 'doubloon' ? doubloonIcon(cls) : icon(art, '◉', cls));

export interface GiftDeps {
  send: (m: ClientMsg) => void;
  on: (f: (m: ServerMsg) => void) => void;
  state: ClientState;
  /** A window open (its name), or null. */
  modal: () => string | null;
  /** Hostile ships near, a chase, a boarding. */
  busy: () => boolean;
}

export class DailyGift {
  view: GiftView | null = null;
  private at = 0;
  private d: GiftDeps;
  private over: HTMLElement | null = null;
  /** It came by itself this session (it does once). */
  private shown = false;
  /** What the last claim handed over (shown in the calendar until it closes). */
  private got: Gift | null = null;
  private born = performance.now();
  /** The calendar was opened by her tap on the icon. */
  private byHand = false;

  constructor(d: GiftDeps) {
    this.d = d;
    d.on((m) => {
      if (m.t !== 'gift') return;
      const wasCan = this.view?.can;
      this.view = m.view;
      this.at = performance.now();
      if (m.got) {
        this.got = m.got;
        cue('gift');
      }
      // a new day while she plays: today's gift may come by itself again
      if (m.view.can && wasCan === false) this.shown = false;
      if (this.over) this.draw();
      this.place();
    });
    setInterval(() => this.place(), 500);
  }

  /** The server's wall clock now. */
  private now(): number {
    return (this.view?.now ?? Date.now()) + (performance.now() - this.at);
  }

  /** The offers' entry carousel waits (promo.ts): the calendar's word not come yet (a few seconds at most), today's gift
   *  due to come by itself, or the calendar open. */
  holding(): boolean {
    if (this.over) return true;
    if (!this.view) return performance.now() - this.born < 8000;
    return this.view.can && !this.shown;
  }

  /** No window, no fight, the HUD out, out of the First Watch: the calendar may come. */
  private free(): boolean {
    const hud = document.getElementById('hud');
    const sheet = document.querySelector('.k-sheet-root.k-open, .k-sheet-root:not(.hidden) .k-sheet');
    return !!hud && !hud.classList.contains('hidden') && !this.d.state.onboarding?.stage && !this.d.busy() && !this.d.modal() && !sheet && !document.getElementById('promo-over') && !document.body.classList.contains('tac') && !document.querySelector('.lvlup:not(.hidden), .film');
  }

  place(): void {
    this.icon();
    if (this.over) {
      // a window opened over it (the harbour, a fight): it steps down, the icon stays
      if (this.d.modal() || (this.d.busy() && !this.byHand)) this.close();
      else {
        const el = this.over.querySelector<HTMLElement>('[data-gfnext]');
        if (el && this.view) el.textContent = L('next', { t: countdown(this.view.next - this.now()) });
      }
      return;
    }
    if (this.view?.can && !this.shown && this.free()) {
      this.shown = true;
      this.open();
    }
  }

  /** The round icon (seahud.css #tc-daily): at sea and in port while today's gift waits; a tap opens the calendar. */
  private icon(): void {
    const host = document.getElementById('touch');
    if (!host) return;
    let el = document.getElementById('tc-daily') as HTMLButtonElement | null;
    if (!el) {
      const t = document.createElement('template');
      t.innerHTML = buttonHtml({ kind: 'icon', id: 'tc-daily', icon: 'ui_gift', glyph: '✦', aria: L('iconAria'), cls: 'sea-round tc-daily hidden' }).trim();
      el = t.content.firstElementChild as HTMLButtonElement;
      el.insertAdjacentHTML('beforeend', '<b class="k-badge tc-daily-b" aria-hidden="true">!</b>');
      el.addEventListener('click', () => this.open(true));
      host.append(el);
    }
    // (a hostile near or a fight at sea never puts it away: promo.ts seaIconUp)
    const up = !!this.view?.can && seaIconUp(this.d.modal(), this.d.state);
    if (el.classList.contains('hidden') === up) el.classList.toggle('hidden', !up);
    const words = L('iconAria');
    if (el.getAttribute('aria-label') !== words) {
      el.setAttribute('aria-label', words);
      el.title = words;
    }
  }

  /** byHand: her tap on the icon (a fight near does not send it away then; the one that came by itself steps down). */
  open(byHand = false): void {
    if (!this.view) return;
    this.byHand = byHand;
    this.over?.remove();
    const el = document.createElement('div');
    el.id = 'gift-over';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', L('title'));
    el.addEventListener('click', (e) => {
      if (e.target === el) this.close();
    });
    document.body.appendChild(el);
    this.over = el;
    this.draw();
  }

  close(): void {
    this.over?.remove();
    this.over = null;
    this.got = null;
  }

  private draw(): void {
    const el = this.over;
    const v = this.view;
    if (!el || !v) return;
    const claimedUpTo = v.can ? v.day - 1 : v.day; // days of this week taken
    const days = v.cells.map((g, i) => {
      const n = i + 1;
      const cls = n <= claimedUpTo ? 'done' : n === v.day ? 'today' : 'next';
      const parts = giftParts(g);
      const main = parts[0];
      const more = parts.length > 1 ? `<small class="gf-more">+${parts.length - 1}</small>` : '';
      const title = parts.map((x) => `${x.name} ${x.q}`).join(' · ');
      const fresh = n === v.day && !v.can && this.got ? ' fresh' : '';
      return `<li class="gf-day ${cls}${n === 7 ? ' gf-seven' : ''}${fresh}" title="${esc(title)}" aria-label="${esc(`${L('day', { n })}: ${title}`)}">
        <span class="gf-n">${esc(n === v.day && v.can ? L('today') : L('day', { n }))}</span>
        <span class="gf-pic">${main ? pic(main.art, 'gf-ico') : ''}${more}</span>
        <b class="gf-q">${esc(main?.q ?? '')}</b>${n <= claimedUpTo ? '<i class="gf-tick" aria-hidden="true">✓</i>' : ''}</li>`;
    }).join('');
    const pips = Array.from({ length: 4 }, (_, i) => `<i class="${i < v.week ? 'past' : i === v.week ? 'on' : ''}"></i>`).join('');
    const note = v.kept ? L('kept') : v.reset ? L('reset') : L('grace');
    const got = this.got && !v.can ? `<p class="gf-got"><span>${esc(L('got'))}:</span> ${giftParts(this.got).map((x) => `<span class="gf-gi">${pic(x.art, 'gf-ico-s')}${esc(x.q)}</span>`).join('')}</p>` : '';
    el.innerHTML = `<div class="gf-box">
      <header class="gf-head"><b class="gf-title">${esc(L('title'))}</b><span class="gf-week">${esc(L('week', { n: v.week + 1 }))}<span class="gf-pips" aria-hidden="true">${pips}</span></span><button type="button" class="po-x po-x-big gf-x" data-gfx aria-label="${esc(L('close'))}">×</button></header>
      <ol class="gf-days">${days}</ol>
      ${got}
      <p class="gf-note"><b>${esc(L('streak', { n: v.streak }))}</b> · ${esc(note)}</p>
      <div class="gf-acts">${v.can
        ? `<button type="button" class="btn btn-small" data-gflater>${esc(L('later'))}</button><button type="button" class="btn btn-small btn-primary gf-claim" data-gfclaim>${esc(L('claim'))}</button>`
        : `<span class="gf-next" data-gfnext>${esc(L('next', { t: countdown(v.next - this.now()) }))}</span><button type="button" class="btn btn-small btn-primary" data-gfdone>${esc(L('done'))}</button>`}</div></div>`;
    el.querySelector<HTMLElement>('[data-gfx]')!.onclick = () => this.close();
    el.querySelector<HTMLElement>('[data-gflater]')?.addEventListener('click', () => this.close());
    el.querySelector<HTMLElement>('[data-gfdone]')?.addEventListener('click', () => this.close());
    const claim = el.querySelector<HTMLButtonElement>('[data-gfclaim]');
    if (claim) {
      claim.onclick = () => {
        claim.disabled = true;
        this.d.send({ t: 'premium', action: 'gift_claim' });
      };
      // the main button under her thumb (a keyboard: Enter takes it)
      claim.focus({ preventScroll: true });
    }
  }
}
