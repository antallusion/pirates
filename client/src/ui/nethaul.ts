// Hauling the net (owner, 2026-09-30: «fishing must not be automatic»): the net's three floats ride the swell; one
// by one they twitch and then go under — a pull on the dip brings that stretch in full, a pull on a twitch spooks it.
// Played here from the seed the server sent, judged there by replaying the pulls (shared/src/data/fishing.ts).

import { FISH, haulParams, judgeHaul } from '../../../shared/src/data/fishing.ts';
import type { FishId, HaulMark, HaulParams } from '../../../shared/src/data/fishing.ts';
import type { ClientMsg, NetHaulView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { esc, fishIcon } from './dom.ts';

const L = dict(
  {
    net: 'Hauling the net', lamp: 'Under the lamp', pull: 'Haul in!', hint: 'Pull when a float goes under — not when it twitches',
    hit: 'In!', early: 'Too soon', missed: 'Missed', wait: 'Hauling in…', got: '{hits} of 3 — {fish} ×{n}', empty: '{hits} of 3 — the net is empty', lost: 'The net is lost',
  },
  {
    net: 'Выбираем сеть', lamp: 'Под фонарём', pull: 'Тянуть!', hint: 'Тяните, когда поплавок уходит под воду, — а не когда дёргается',
    hit: 'Есть!', early: 'Рано', missed: 'Мимо', wait: 'Выбираем…', got: '{hits} из 3 — {fish} ×{n}', empty: '{hits} из 3 — сеть пуста', lost: 'Сеть потеряна',
  },
);

export class NetHaulPanel {
  private el: HTMLElement;
  private send: (m: ClientMsg) => void;
  private view: NetHaulView | null = null;
  private p: HaulParams | null = null;
  private start = 0;
  private pulls: number[] = [];
  private sent = false;
  private closeAt = 0;
  private lastKey = '';

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    this.el = document.getElementById('nethaul')!;
    addEventListener('keydown', (e) => {
      if (!this.view || this.sent || e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.pull();
    }, true);
  }

  get active(): boolean {
    return !!this.view;
  }

  /** The server's word: a haul to play, or its end (with what came up, or nothing if the net was lost). */
  open(view: NetHaulView | null, got?: { fish: FishId; n: number; hits: number }): void {
    if (!view) {
      if (!this.view) return;
      const out = this.el.querySelector<HTMLElement>('.nh-out');
      const name = got ? FISH[got.fish].name[lang() === 'ru' ? 1 : 0] : '';
      if (out) {
        out.textContent = !got ? L('lost') : got.n > 0 ? L('got', { hits: got.hits, fish: name, n: got.n }) : L('empty', { hits: got.hits });
        out.classList.toggle('good', !!got && got.n > 0);
      }
      if (got && got.n > 0) {
        const h = this.el.querySelector<HTMLElement>('.nh-h .nh-ico');
        if (h) h.innerHTML = fishIcon(got.fish, 'ico-md');
      }
      this.sent = true;
      this.closeAt = performance.now() + 2600;
      return;
    }
    this.view = view;
    this.p = haulParams(view.seed, view.craft);
    this.start = performance.now();
    this.pulls = [];
    this.sent = false;
    this.closeAt = 0;
    this.lastKey = '';
    const fish = view.fish ? `${esc(FISH[view.fish].name[lang() === 'ru' ? 1 : 0])}` : '';
    this.el.innerHTML = `<div class="ff-card nh-card"><div class="ff-h nh-h"><span class="nh-ico">${fishIcon(view.fish ?? 'x', 'ico-md')}</span>${esc(L(view.method))}${fish ? ` <span class="muted">${fish}</span>` : ''}</div>
      <div class="nh-water">${this.p.dips.map((_, i) => `<div class="nh-slot" data-i="${i}"><i class="nh-float"></i><span class="nh-mark"></span></div>`).join('')}</div>
      <button class="btn btn-primary ff-reel nh-pull" data-pull>${esc(L('pull'))}</button><p class="muted ff-hint">${esc(L('hint'))}</p><p class="ff-out nh-out"></p></div>`;
    this.el.classList.remove('hidden');
    const b = this.el.querySelector<HTMLElement>('[data-pull]')!;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.pull();
    });
  }

  private t(): number {
    return (performance.now() - this.start) / 1000;
  }

  private pull(): void {
    if (!this.view || this.sent) return;
    this.pulls.push(Math.round(this.t() * 1000) / 1000);
    const b = this.el.querySelector<HTMLElement>('[data-pull]');
    if (b) {
      b.classList.add('on');
      setTimeout(() => b.classList.remove('on'), 120);
    }
  }

  /** Every frame: the floats ride, twitch and dip; each resolved one shows how it went. */
  frame(): void {
    const now = performance.now();
    if (this.closeAt && now > this.closeAt) {
      this.view = null;
      this.p = null;
      this.closeAt = 0;
      this.el.classList.add('hidden');
      this.el.innerHTML = '';
      return;
    }
    if (!this.view || !this.p) return;
    const p = this.p, t = this.t();
    const { marks } = judgeHaul(p, this.pulls);
    const state: string[] = p.dips.map((d, i) => {
      const from = i === 0 ? 0 : p.dips[i - 1] + p.window;
      const decided = this.pulls.some((x) => x >= from && x <= d + p.window);
      if (decided || t > d + p.window) return decided ? marks[i] : 'missed';
      if (t < from) return 'idle';
      if (t >= d) return 'dip';
      return p.twitches.some((w) => t >= w && t < w + 0.28 && w >= from && w < d) ? 'twitch' : 'ride';
    });
    const key = state.join(',');
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.el.querySelectorAll<HTMLElement>('.nh-slot').forEach((s, i) => {
        s.className = `nh-slot nh-${state[i]}`;
        const m = s.querySelector<HTMLElement>('.nh-mark');
        if (m) m.textContent = ['hit', 'early', 'missed'].includes(state[i]) ? L(state[i] as HaulMark) : '';
      });
    }
    if (!this.sent && t >= p.end) {
      this.sent = true;
      const out = this.el.querySelector<HTMLElement>('.nh-out');
      if (out) out.textContent = L('wait');
      this.send({ t: 'fishing', action: 'net', id: this.view.id, pulls: this.pulls });
      // If the answer never comes, the panel still goes.
      this.closeAt = now + 5000;
    }
  }
}
