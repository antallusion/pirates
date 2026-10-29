// The captain's abilities on a touch screen (owner, 2026-10-26: «на мобиле не показаны иконки спецприёмов капитана, как
// сделано на десктопе, надо показывать как-то»). The desk has its gun deck (Z X C V, seahud.ts drawDeck); a phone's
// bottom right is full — «Огонь», «Снаряд», «Цель» and the row of things to do — so the abilities live behind ONE round
// button, «Приёмы», in the place «Особое» held (the best ready ability: its picture is on the button's face now):
//   - the face: the best ability ready now (or the first one), a gold count of how many are ready on its corner, the
//     sweep of its cooldown when none is;
//   - a tap fans the captain's four out in a row to its left (clear of the chart, the menu and the row of actions:
//     measured as it opens), each in its brass ring — its picture, the cooldown sweeping with its seconds, a locked
//     one dimmed with its level, an ultimate's resolve as a gold arc;
//   - a tap on one uses it (the same message as the desk's keys: main.ts aims at her mark and sends {t:'ability'}),
//     and the row folds; a long press shows its card in the top band (the name, what it does, its cooldown) — never
//     in the middle of the sea (CLAUDE.md §3);
//   - a tap anywhere else, the port, the end of the fight's sea folds it.
// Its own component (not seahud.ts / actbar.ts): the fight's other buttons and the target's actions stay as they are.

import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/seaabil.ts';
import { esc, icon } from './dom.ts';
import { flash } from './kit/button.ts';

const L = dict(EN, RU);

/** One of the captain's abilities as the phone shows it. */
export interface AbilView {
  id: string;
  art: string;
  name: string;
  description: string;
  /** The full cooldown (s, with her cooldown modifiers) and what is left of it. */
  cooldown: number;
  left: number;
  ult: boolean;
  /** Below level 6 (an ultimate): the words on it. */
  locked?: string;
  /** Not usable now for another reason: an ultimate's resolve, a miracle's Dread, a cost in silver. */
  dim: boolean;
  /** An ultimate's resolve, 0–1 (null: not an ultimate, or locked). */
  charge: number | null;
  /** Why it is dim (the card's last line). */
  why?: string;
}

/** Why an ability waits (the card's last line): an ultimate's resolve, a miracle's Dread, its silver. */
export function abilWhy(k: 'resolve' | 'dread' | 'gold', n: number): string {
  return L(k, { n });
}

/** A press held this long shows the card. */
const HOLD_MS = 420;

export class SeaAbil {
  readonly btnEl: HTMLButtonElement;
  readonly fanEl: HTMLElement;
  readonly tipEl: HTMLElement;
  private list: AbilView[] = [];
  private shape = '';
  private face = '';
  private clearAt = 0;
  private open = false;
  private tipFor: string | null = null;
  private tipT: ReturnType<typeof setTimeout> | undefined = undefined;

  private use: (id: string) => void;

  constructor(root: HTMLElement, use: (id: string) => void) {
    this.use = use;
    const make = (html: string) => {
      const t = document.createElement('template');
      t.innerHTML = html.trim();
      const el = t.content.firstElementChild as HTMLElement;
      root.append(el);
      return el;
    };
    this.btnEl = make(`<button type="button" id="tc-abil" class="k-btn k-btn--icon k-btn--lg tc-abil sea-round hidden" aria-haspopup="true" aria-expanded="false" aria-controls="tc-abilfan"><span class="tc-abil-pic"></span><i class="tc-abil-cd" aria-hidden="true"></i><b class="k-badge tc-abil-n hidden" aria-hidden="true"></b></button>`) as HTMLButtonElement;
    this.fanEl = make('<div id="tc-abilfan" class="tc-abilfan hidden" role="toolbar"></div>');
    this.tipEl = make('<div id="tc-abiltip" class="tc-abiltip hidden" role="tooltip"></div>');
    this.btnEl.addEventListener('click', () => this.toggle(!this.open));
    this.btnEl.addEventListener('contextmenu', (e) => e.preventDefault());
    this.wireFan();
    // a tap anywhere else folds the row (the tap itself goes on to the sea or the button it was for)
    document.addEventListener('pointerdown', (e) => {
      if (!this.open) return;
      const t = e.target as Node;
      if (this.fanEl.contains(t) || this.btnEl.contains(t)) return;
      this.toggle(false);
    }, true);
    addEventListener('resize', () => this.open && this.place());
  }

  /** Each frame: the abilities (null: not on a touch screen's sea — the control away). */
  frame(list: AbilView[] | null): void {
    const on = !!list && list.length > 0;
    this.btnEl.classList.toggle('hidden', !on);
    document.body.classList.toggle('sea-abil', on);
    if (!on) {
      if (this.open) this.toggle(false);
      this.list = [];
      return;
    }
    this.list = list;
    const best = list.find((a) => !a.dim && !a.locked && a.left <= 0) ?? null;
    const face = best ?? list.find((a) => !a.locked) ?? list[0];
    const ready = list.filter((a) => !a.dim && !a.locked && a.left <= 0).length;
    // the face again when it changes; the row's markup only when its make-up does (a tap must never land on a button
    // replaced under the finger: its locks and dimming are classes moved in place)
    const face1 = [lang(), face.id, face.art, ready].join('|');
    if (face1 !== this.face) {
      this.face = face1;
      this.btnEl.querySelector('.tc-abil-pic')!.innerHTML = icon(face.art, '✦', 'k-btn-ico');
      this.btnEl.classList.toggle('none', ready === 0);
      const n = this.btnEl.querySelector<HTMLElement>('.tc-abil-n')!;
      n.textContent = String(ready);
      n.classList.toggle('hidden', ready === 0);
      const name = ready ? L('btnReady', { n: ready }) : L('btn');
      this.btnEl.setAttribute('aria-label', name);
      this.btnEl.title = name;
    }
    const shape = [lang(), list.map((a) => `${a.id}:${a.art}:${a.charge === null ? 0 : 1}:${a.ult ? 1 : 0}`).join(',')].join('|');
    if (shape !== this.shape) {
      this.shape = shape;
      this.fanEl.setAttribute('aria-label', L('fan'));
      this.fanEl.innerHTML = list.map((a) => `<button type="button" class="k-btn k-btn--icon tc-abi sea-round${a.ult ? ' ult' : ''}" data-ab="${esc(a.id)}" aria-label="${esc(L('use', { name: a.name }))}">`
        + icon(a.art, '✦', 'k-btn-ico')
        + '<i class="tc-abi-cd" aria-hidden="true"></i>'
        + (a.charge !== null ? '<i class="tc-abi-charge" aria-hidden="true"></i>' : '')
        + '<span class="tc-abi-t" aria-hidden="true"></span></button>').join('');
      if (this.open) this.place();
    }
    // the face's sweep: the soonest ability back when none is ready
    const soon = ready ? null : list.filter((a) => !a.locked && a.left > 0).sort((a, b) => a.left - b.left)[0] ?? null;
    this.btnEl.style.setProperty('--cd', soon ? String(Math.min(1, soon.left / Math.max(1, soon.cooldown))) : '0');
    for (const a of list) {
      const b = this.fanEl.querySelector<HTMLElement>(`[data-ab="${CSS.escape(a.id)}"]`);
      if (!b) continue;
      const frac = a.left > 0 ? Math.min(1, a.left / Math.max(1, a.cooldown)) : 0;
      b.style.setProperty('--cd', String(Math.round(frac * 200) / 200));
      if (a.charge !== null) b.style.setProperty('--charge', String(Math.round(a.charge * 100) / 100));
      b.classList.toggle('cooling', frac > 0);
      b.classList.toggle('locked', !!a.locked);
      b.classList.toggle('dim', a.dim);
      const t = b.querySelector<HTMLElement>('.tc-abi-t')!;
      const txt = a.locked ? a.locked : frac > 0 ? String(Math.ceil(a.left)) : '';
      if (t.textContent !== txt) t.textContent = txt;
    }
    if (this.tipFor) this.showTip(this.tipFor, false);
    this.keepClear();
  }

  /** Clear of the row of things to do: when it wraps up into «Приёмы» (many things at once, out of a fight), the button
   *  steps up just enough (a few times a second; nothing moves while the row is open). */
  private keepClear(): void {
    const t = performance.now();
    if (t - this.clearAt < 250 || this.open) return;
    this.clearAt = t;
    const lift0 = Number(this.btnEl.style.getPropertyValue('--abil-lift')) || 0;
    const r = this.btnEl.getBoundingClientRect();
    if (!r.width) return;
    const bottom0 = r.bottom + lift0; // where it stands unlifted
    let lift = 0;
    for (const e of document.querySelectorAll<HTMLElement>('#tc-actrow:not(.hidden) > .k-btn')) {
      const q = e.getBoundingClientRect();
      if (q.width > 2 && q.left < r.right + 4 && q.right > r.left - 4 && q.top < bottom0 + 6 && q.bottom > r.top + lift0) lift = Math.max(lift, Math.ceil(bottom0 + 6 - q.top));
    }
    if (lift !== lift0) this.btnEl.style.setProperty('--abil-lift', String(lift));
  }

  /** A refusal about an ability (not ready, no resolve): the button flashes. True when it could. */
  flash(): boolean {
    if (!this.btnEl.getClientRects().length || this.btnEl.classList.contains('hidden')) return false;
    flash(this.open ? this.fanEl : this.btnEl, true);
    return true;
  }

  private toggle(on: boolean): void {
    this.open = on;
    this.btnEl.setAttribute('aria-expanded', String(on));
    this.btnEl.classList.toggle('on', on);
    this.fanEl.classList.toggle('hidden', !on);
    if (on) this.place();
    else this.hideTip();
  }

  /** The row to the button's left, on its middle line — or a little up or down, wherever it touches nothing of the HUD. */
  private place(): void {
    const b = this.btnEl.getBoundingClientRect();
    if (!b.width) return;
    const f = this.fanEl;
    f.style.left = '0px';
    f.style.top = '0px';
    const w = f.offsetWidth, h = f.offsetHeight;
    const gap = Math.max(8, Math.round(b.width * 0.22));
    const left = Math.max(6, b.left - gap - w);
    const others = [...document.querySelectorAll<HTMLElement>('#touch > :not(#tc-abilfan):not(#tc-abiltip):not(#tc-abil):not(.hidden), #tc-actrow > .k-btn, #hud-map, #hud-captain .cs, #tc-target:not(.hidden), #hud-bottom > *')]
      .filter((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden')
      .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 2 && r.height > 2 && !(r.width > innerWidth * 0.8 && r.height > innerHeight * 0.8));
    const hits = (top: number) => others.some((r) => r.left < left + w + 2 && r.right > left - 2 && r.top < top + h + 2 && r.bottom > top - 2);
    const mid = b.top + b.height / 2 - h / 2;
    let top = mid;
    for (const k of [0, -0.5, 0.5, -1, 1, -1.5, -2]) {
      const t = Math.max(6, Math.min(innerHeight - h - 6, mid + k * h));
      if (!hits(t)) {
        top = t;
        break;
      }
    }
    f.style.left = `${Math.round(left)}px`;
    f.style.top = `${Math.round(top)}px`;
  }

  /** A tap uses; a long press shows the card (and does not use). */
  private wireFan(): void {
    let timer: ReturnType<typeof setTimeout> | null = null, held = false, x0 = 0, y0 = 0;
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const slot = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('[data-ab]');
    this.fanEl.addEventListener('pointerdown', (e) => {
      const b = slot(e);
      if (!b || e.button !== 0) return;
      held = false;
      x0 = e.clientX;
      y0 = e.clientY;
      stop();
      timer = setTimeout(() => {
        timer = null;
        held = true;
        this.showTip(b.dataset.ab!, true);
      }, HOLD_MS);
    });
    this.fanEl.addEventListener('pointermove', (e) => {
      if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 12) stop();
    });
    const up = () => {
      stop();
      if (held && this.tipFor) {
        clearTimeout(this.tipT);
        this.tipT = setTimeout(() => this.hideTip(), 2600);
      }
    };
    this.fanEl.addEventListener('pointerup', up);
    this.fanEl.addEventListener('pointercancel', up);
    this.fanEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const b = slot(e);
      if (b && !held) this.showTip(b.dataset.ab!, true);
      held = true;
    });
    this.fanEl.addEventListener('click', (e) => {
      const b = slot(e);
      stop();
      if (!b) return;
      if (held) {
        held = false;
        return;
      }
      // (Shift+Enter: the card, as the other held buttons)
      if ((e as MouseEvent).shiftKey && (e as MouseEvent).detail === 0) return this.showTip(b.dataset.ab!, true);
      const a = this.list.find((x) => x.id === b.dataset.ab);
      if (!a) return;
      if (a.locked || a.dim || a.left > 0) {
        flash(b, true);
        this.showTip(a.id, true);
        clearTimeout(this.tipT);
        this.tipT = setTimeout(() => this.hideTip(), 2200);
        return;
      }
      this.use(a.id);
      this.toggle(false);
    });
  }

  /** The card of one ability in the top band: its name, what it does, its cooldown (or what it waits for). */
  private showTip(id: string, fresh: boolean): void {
    const a = this.list.find((x) => x.id === id);
    if (!a) return this.hideTip();
    const state = a.locked ? L('lv6') : a.left > 0 ? L('left', { n: Math.ceil(a.left) }) : a.dim ? a.why ?? '' : L('ready');
    const html = `<b class="tc-abt-h">${icon(a.art, '', 'tc-abt-ico')}<span>${esc(a.name)}</span></b><span class="tc-abt-d">${esc(a.description)}</span>`
      + `<span class="tc-abt-f"><span>${esc(L('cd', { n: Math.round(a.cooldown) }))}</span>${state ? `<span class="${a.locked || a.dim || a.left > 0 ? 'bad' : 'good'}">${esc(state)}</span>` : ''}</span>`;
    if (this.tipFor === id && !fresh && this.tipEl.dataset.h === html) return;
    this.tipFor = id;
    this.tipEl.dataset.h = html;
    this.tipEl.innerHTML = html;
    this.tipEl.classList.remove('hidden');
    if (fresh) {
      clearTimeout(this.tipT);
      this.placeTip();
    }
  }

  /** The top band: under her mark's line (or the screen's top), between the captain's plate and the chart's corner. */
  private placeTip(): void {
    const t = this.tipEl;
    const top0 = (() => {
      const m = document.getElementById('tc-target');
      const r = m && !m.classList.contains('hidden') && m.getClientRects().length ? m.getBoundingClientRect() : null;
      return r && r.height > 2 ? r.bottom + 6 : 8;
    })();
    const band = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].filter((e) => e.getClientRects().length && !e.classList.contains('hidden')).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 2 && r.top < innerHeight * 0.5);
    let lo = 8, hi = innerWidth - 8;
    for (const r of band('#hud-captain .cs, #touch > #tc-isle, #touch > #tc-more, #touch > #tc-offer, #touch > #tc-daily, #hud-chat > .chat-toggle')) lo = Math.max(lo, r.right + 8);
    for (const r of band('#hud-map, #touch > #tc-menu, #touch > #tc-news, #mm-tab')) hi = Math.min(hi, r.left - 8);
    if (hi - lo < 220) {
      lo = 8;
      hi = innerWidth - 8;
    }
    const w = Math.min(360, hi - lo);
    t.style.width = `${Math.round(w)}px`;
    t.style.left = `${Math.round(lo + (hi - lo - w) / 2)}px`;
    t.style.top = `${Math.round(top0)}px`;
  }

  private hideTip(): void {
    clearTimeout(this.tipT);
    this.tipFor = null;
    this.tipEl.classList.add('hidden');
  }
}
