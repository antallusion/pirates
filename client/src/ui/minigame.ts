// The island games' window (2026-09-30): one window for all twenty — the scene's painting with a face over it, the
// title and the tale, then the game itself (a riddle's options, dice, a coin, three shells going round, a call to
// repeat, a swinging needle, a haggle, a tale's choices), and what came of it. The server decides everything; the
// window only shows and asks. Phone-first: big buttons that wrap, a small stage for the moving games.

import { MINIGAMES, WALK_CHOICE } from '../../../shared/src/data/minigames.ts';
import type { MinigameDef, Tr } from '../../../shared/src/data/minigames.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { RARITY_COLOR, itemName } from '../../../shared/src/data/items.ts';
import type { ClientMsg, MinigameView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/minigame.ts';
import { assetUrl } from '../assets.ts';
import { esc, icon, money } from './dom.ts';

const L = dict(EN, RU);
const ru = () => (lang() === 'ru' ? 1 : 0);
const tr = (t: Tr) => t[ru()];
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const ANCHOR = ['♔', '⚓', '♥', '♦', '♠', '♣'];
const WHISTLE = ['━', '•', '〰', '▁'];
const FLAGS = ['#b3322b', '#e0b83a', '#2f5d9e', '#ece6d6', '#18181a'];
const SWAP_MS = 420;

export class MinigameWindow {
  private el: HTMLElement;
  private send: (m: ClientMsg) => void;
  private view: MinigameView | null = null;
  private raf = 0;
  private timers: number[] = [];
  /** Memory: what she has tapped so far. */
  private tapped: number[] = [];
  /** Timing: when the current try's needle began to swing. */
  private tryStart = 0;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    this.el = document.getElementById('minigame')!;
  }

  get isOpen(): boolean {
    return this.view !== null;
  }

  open(view: MinigameView | null): void {
    if (!view) {
      this.close();
      return;
    }
    const again = this.view?.id === view.id;
    const prev = this.view;
    this.view = view;
    this.stop();
    if (!again || prev?.step !== view.step || prev?.qi !== view.qi) this.tapped = [];
    this.render(!again);
  }

  close(): void {
    this.stop();
    this.view = null;
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }

  private stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  private pick(pick: string, extra: { ms?: number; seq?: number[] } = {}): void {
    if (!this.view || this.view.result) return;
    this.el.querySelectorAll<HTMLButtonElement>('[data-mg]').forEach((b) => (b.disabled = true));
    this.send({ t: 'minigame', id: this.view.id, pick, ...extra });
  }

  /** The header: the scene's painting, dimmed, and the face or thing of the game over it. */
  private art(d: MinigameDef): string {
    const url = assetUrl(d.art);
    const face = icon(d.face, '', 'mg-face');
    return `<div class="mg-art"${url ? ` style="background-image:url('${url}')"` : ''}>${face}</div>`;
  }

  private render(fresh: boolean): void {
    const v = this.view!;
    const d = MINIGAMES[v.def];
    const intro = v.result || fresh || d.kind !== 'quest' || v.step === d.start ? `<p class="mg-text">${esc(tr(d.text))}</p>` : '';
    const body = v.result ? this.result(d, v) : this.body(d, v);
    this.el.innerHTML = `<div class="mg-card mg-${d.kind}">${this.art(d)}<div class="mg-h">${esc(tr(d.title))}</div>${intro}${body}</div>`;
    this.el.classList.remove('hidden');
    this.el.querySelectorAll<HTMLElement>('[data-mg]').forEach((b) => (b.onclick = () => this.pick(b.dataset.mg!)));
    this.el.querySelector<HTMLElement>('[data-mg-close]')?.addEventListener('click', () => this.close());
    if (!v.result) this.animate(d, v);
  }

  private walk(): string {
    return `<button class="btn btn-small mg-walk" data-mg="walk">${esc(tr(WALK_CHOICE.label))}</button>`;
  }

  private buttons(list: { id: string; html: string; cls?: string }[], walk = true): string {
    return `<div class="mg-choices">${list.map((b) => `<button class="btn btn-small ${b.cls ?? ''}" data-mg="${esc(b.id)}">${b.html}</button>`).join('')}${walk ? this.walk() : ''}</div>`;
  }

  private stakeLine(v: MinigameView): string {
    return (v.stake ? `<div class="mg-stake">${L('stake', { stake: money(v.stake) })}</div>` : '') + (v.weary ? `<div class="mg-weary">${esc(L('weary'))}</div>` : '');
  }

  private body(d: MinigameDef, v: MinigameView): string {
    switch (d.kind) {
      case 'riddle':
      case 'stars': {
        const qi = v.q![v.qi ?? 0];
        const q = d.questions![qi];
        const order = v.order![v.qi ?? 0];
        const n = v.q!.length > 1 ? `<div class="mg-note">${esc(L('question', { n: (v.qi ?? 0) + 1, len: v.q!.length }))}</div>` : '';
        return `${n}<p class="mg-q">${esc(tr(q.q))}</p>${this.buttons(order.map((i) => ({ id: String(i), html: esc(tr(q.options[i])), cls: 'mg-opt' })))}`;
      }
      case 'dice': {
        const [count, face] = v.bid!;
        return `${this.stakeLine(v)}<div class="mg-note">${esc(L('yourDice'))}</div><div class="mg-dice">${v.dice!.map((x) => `<span class="mg-die${x === face ? ' mg-die-hot' : ''}">${DIE[x]}</span>`).join('')}</div>
          <p class="mg-q">${L('bid', { count, face: `<span class="mg-die mg-die-sm">${DIE[face]}</span>` })}</p>${this.buttons(d.choices!.map((c) => ({ id: c.id, html: esc(tr(c.label)) })))}`;
      }
      case 'anchor':
        return `${this.stakeLine(v)}${this.buttons(d.choices!.map((c, i) => ({ id: c.id, html: `<span class="mg-sym">${ANCHOR[i]}</span>${esc(tr(c.label))}`, cls: 'mg-sym-btn' })))}`;
      case 'coin':
        return `${this.stakeLine(v)}<div class="mg-coin">${icon('coin', '⛁', 'mg-coin-img')}</div>${this.buttons(d.choices!.map((c) => ({ id: c.id, html: esc(tr(c.label)) })))}`;
      case 'shells':
        return `${this.stakeLine(v)}<div class="mg-note mg-shell-note">${esc(L('shuffle'))}</div><div class="mg-shells">${[0, 1, 2].map((i) => `<div class="mg-shell" data-shell="${i}"><span class="mg-pearl"></span></div>`).join('')}</div>
          ${this.buttons([...[0, 1, 2].map((i) => ({ id: String(i), html: esc(tr(d.choices![i].label)), cls: 'mg-shell-pick' })), { id: 'wrist', html: esc(tr(d.choices![3].label)) }])}`;
      case 'memory': {
        const sym = d.symbols!;
        const flags = d.id === 'flag_hoist';
        const pad = sym.map((s, i) => `<button class="btn btn-small mg-pad" data-pad="${i}" disabled>${flags ? `<span class="mg-flag" style="background:${FLAGS[i]}"></span>` : `<span class="mg-sym">${WHISTLE[i]}</span>`}${esc(tr(s))}</button>`).join('');
        return `<div class="mg-note mg-mem-note">${esc(L('watch'))}</div><div class="mg-seq">${v.seq!.map(() => '<span class="mg-slot"></span>').join('')}</div><div class="mg-pads">${pad}</div><div class="mg-choices">${this.walk()}</div>`;
      }
      case 'timing': {
        const i = v.hits!.length, n = v.period!.length;
        const marks = v.period!.map((_, k) => `<span class="mg-try${k < i ? (v.hits![k] ? ' mg-try-hit' : ' mg-try-miss') : k === i ? ' mg-try-now' : ''}">${k < i ? (v.hits![k] ? '✔' : '✖') : k + 1}</span>`).join('');
        const zone = d.zone ?? 0.2;
        const stage = d.id === 'harpoon_lagoon'
          ? `<div class="mg-lagoon"><div class="mg-mark" style="width:${zone * 50}%"></div><div class="mg-fish">${icon('fish_mackerel', '➤', 'mg-fish-img')}</div></div>`
          : `<div class="mg-dial"><div class="mg-zone" style="--z:${Math.round(zone * 80)}deg"></div><div class="mg-needle"></div><div class="mg-hub"></div></div>`;
        const last = i > 0 ? `<div class="mg-note ${v.hits![i - 1] ? 'mg-good' : 'mg-bad'}">${esc(L(v.hits![i - 1] ? 'hit' : 'miss'))}</div>` : `<div class="mg-note">${esc(L('tries', { n: i + 1, len: n }))}</div>`;
        return `<div class="mg-tries">${marks}</div>${last}${stage}${this.buttons([{ id: 'stop', html: esc(L(d.id === 'harpoon_lagoon' ? 'throw' : 'stop')), cls: 'btn-primary mg-stop' }])}`;
      }
      case 'haggle': {
        const it = v.item!;
        const lot = `<div class="mg-lot">${icon(`item_${it.base}`, '✦', 'mg-lot-img')}<b style="color:${RARITY_COLOR[it.rarity]}">${esc(itemName(it, ru() === 1))}</b></div>`;
        if (v.step === 'counter') return `${lot}<p class="mg-q">${L('counter', { silver: money(v.price!) })}</p>${this.buttons([{ id: 'accept', html: esc(L('accept')), cls: 'btn-primary' }])}`;
        const p = v.price!;
        return `${lot}<p class="mg-q">${L('ask', { silver: money(p) })}</p>${this.buttons([
          { id: 'pay', html: L('pay', { silver: money(p) }) },
          { id: 'o80', html: L('offer', { silver: money(Math.round(p * 0.8)) }) },
          { id: 'o60', html: L('offer', { silver: money(Math.round(p * 0.6)) }) },
        ])}`;
      }
      case 'quest': {
        const stp = d.steps![v.step];
        return `<p class="mg-q">${esc(tr(stp.text))}</p>${this.buttons(stp.choices.map((c) => ({ id: c.id, html: esc(tr(c.label)) })))}`;
      }
    }
    return '';
  }

  /** The moving parts: the shells go round, the call is shown, the needle swings. */
  private animate(d: MinigameDef, v: MinigameView): void {
    if (d.kind === 'shells') this.shells(v);
    else if (d.kind === 'memory') this.memory(v);
    else if (d.kind === 'timing') this.needle(d, v);
  }

  private shells(v: MinigameView): void {
    const els = [...this.el.querySelectorAll<HTMLElement>('.mg-shell')];
    const picks = [...this.el.querySelectorAll<HTMLButtonElement>('.mg-shell-pick, [data-mg="wrist"]')];
    picks.forEach((b) => (b.disabled = true));
    const slot = [0, 1, 2]; // shell i sits at slot[i]
    const place = () => els.forEach((e, i) => (e.style.left = `${slot[i] * 33.34}%`));
    place();
    els[v.pea!].classList.add('mg-lift'); // the pearl shown under its shell
    const pairs: [number, number][] = [[0, 1], [1, 2], [0, 2]];
    let t = 1100;
    this.timers.push(window.setTimeout(() => els[v.pea!].classList.remove('mg-lift'), 900));
    for (const w of v.swaps!) {
      this.timers.push(window.setTimeout(() => {
        const [a, b] = pairs[w];
        const ia = slot.indexOf(a), ib = slot.indexOf(b);
        slot[ia] = b;
        slot[ib] = a;
        place();
      }, t));
      t += SWAP_MS + 60;
    }
    this.timers.push(window.setTimeout(() => {
      picks.forEach((b) => (b.disabled = false));
      const note = this.el.querySelector('.mg-shell-note');
      if (note) note.textContent = L('pick');
      // The shells themselves may be tapped: the slot a shell sits at is the pick.
      els.forEach((e, i) => (e.onclick = () => this.pick(String(slot[i]))));
    }, t + 100));
  }

  private memory(v: MinigameView): void {
    const pads = [...this.el.querySelectorAll<HTMLButtonElement>('.mg-pad')];
    const slots = [...this.el.querySelectorAll<HTMLElement>('.mg-slot')];
    const note = this.el.querySelector<HTMLElement>('.mg-mem-note')!;
    const seq = v.seq!;
    const flash = (i: number, on: boolean) => pads[i]?.classList.toggle('mg-lit', on);
    let t = 500;
    seq.forEach((sym) => {
      this.timers.push(window.setTimeout(() => flash(sym, true), t));
      this.timers.push(window.setTimeout(() => flash(sym, false), t + 520));
      t += 700;
    });
    this.timers.push(window.setTimeout(() => {
      note.textContent = L('repeat', { n: 0, len: seq.length });
      pads.forEach((b, i) => {
        b.disabled = false;
        b.onclick = () => {
          if (this.tapped.length >= seq.length) return;
          this.tapped.push(i);
          const s = slots[this.tapped.length - 1];
          if (s) s.innerHTML = this.tapped.length ? pads[i].querySelector('.mg-sym, .mg-flag')?.outerHTML ?? '' : '';
          flash(i, true);
          this.timers.push(window.setTimeout(() => flash(i, false), 180));
          note.textContent = L('repeat', { n: this.tapped.length, len: seq.length });
          if (this.tapped.length === seq.length) {
            pads.forEach((x) => (x.disabled = true));
            this.pick('seq', { seq: [...this.tapped] });
          }
        };
      });
    }, t));
  }

  private needle(d: MinigameDef, v: MinigameView): void {
    const i = v.hits!.length;
    const period = v.period![i], phase = v.phase![i];
    const needle = this.el.querySelector<HTMLElement>('.mg-needle');
    const fish = this.el.querySelector<HTMLElement>('.mg-fish');
    this.tryStart = performance.now();
    const frame = () => {
      const ms = performance.now() - this.tryStart;
      const pos = Math.sin(2 * Math.PI * (ms / period + phase));
      if (needle) needle.style.transform = `translateX(-50%) rotate(${pos * 80}deg)`;
      if (fish) fish.style.left = `${50 + pos * 46}%`;
      this.raf = requestAnimationFrame(frame);
    };
    frame();
    const stop = this.el.querySelector<HTMLElement>('[data-mg="stop"]');
    if (stop) stop.onclick = () => {
      const ms = Math.round(performance.now() - this.tryStart);
      cancelAnimationFrame(this.raf);
      this.pick('stop', { ms });
    };
    void d;
  }

  private result(d: MinigameDef, v: MinigameView): string {
    const r = v.result!;
    const o = d.outcomes[r.outcome];
    const x = r.vars;
    const roll = (): string => {
      if (!x.roll) return '';
      if (d.kind === 'dice') return x.roll.map((n) => DIE[n]).join(' ');
      if (d.kind === 'anchor') return x.roll.map((n) => `${ANCHOR[n]} ${esc(tr(d.symbols![n]))}`).join(', ');
      if (d.kind === 'coin') return esc(L(x.roll[0] === 0 ? 'crown' : 'ship'));
      return '';
    };
    const text = esc(o ? tr(o.text) : '').replace(/\{(\w+)\}/g, (_, k: string) => {
      if (k === 'silver') return money(x.silver ?? 0);
      if (k === 'lost') return money(x.lost ?? 0);
      if (k === 'stake') return money(x.stake ?? 0);
      if (k === 'n') return String(x.n ?? 0);
      if (k === 'crew') return String(x.crew ?? 0);
      if (k === 'good') return x.good ? esc(GOODS[x.good].name.toLowerCase()) : '';
      if (k === 'item') return x.item ? `<b style="color:${RARITY_COLOR[x.item.rarity]}">${esc(itemName(x.item, ru() === 1))}</b>` : '';
      if (k === 'roll') return roll();
      if (k === 'count') return d.kind === 'shells' ? esc(L(`shell${x.count ?? 0}` as 'shell0')) : String(x.count ?? 0);
      return '';
    });
    const chips = [x.xp ? `<span class="mg-chip">${icon('xp', '✦', 'ico-sm')}${esc(L('xp', { n: x.xp }))}</span>` : '', x.map ? `<span class="mg-chip">${icon('map_treasure', '✕', 'ico-sm')}${esc(L('map'))}</span>` : ''].join('');
    return `<p class="mg-out ${r.win ? 'mg-won' : 'mg-lost'}">${text}</p>${chips ? `<div class="mg-chips">${chips}</div>` : ''}<div class="mg-choices"><button class="btn btn-small btn-primary" data-mg-close>${esc(L('close'))}</button></div>`;
  }
}
