// Playing a fish on the line (docs/12 P3): one button — hold to reel in, let go when the line is taut. The fight is
// simulated here frame by frame from the kind, weight and seed the server sent, exactly as the server will replay it
// from the holds sent back when it is over.

import { FISH, FIGHT_DT, fightParams, fightStart, fightStep } from '../../../shared/src/data/fishing.ts';
import type { FightParams, FightState } from '../../../shared/src/data/fishing.ts';
import type { ClientMsg, FishFightView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { esc, fishIcon } from './dom.ts';

const L = dict(
  { title: 'On the line: {fish}', kg: '{kg} kg', reel: 'Reel in', hint: 'Hold to reel in · let go when the line is taut', tension: 'Line', fish: 'Fish', landed: 'Landed!', snapped: 'The line snapped', escaped: 'It got away' },
  { title: 'На крючке: {fish}', kg: '{kg} кг', reel: 'Тянуть', hint: 'Держите — сматываете · отпускайте, когда леска натянута', tension: 'Леска', fish: 'Рыба', landed: 'Вытащили!', snapped: 'Леска лопнула', escaped: 'Сорвалась' },
);

export class FishFightPanel {
  private el: HTMLElement;
  private send: (m: ClientMsg) => void;
  private view: FishFightView | null = null;
  private p: FightParams | null = null;
  private st: FightState | null = null;
  private holding = false;
  private holds: [number, number][] = [];
  private since = 0;
  private acc = 0;
  private last = 0;
  private closeAt = 0;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    this.el = document.getElementById('fishfight')!;
    const down = (e: KeyboardEvent) => {
      if (!this.view || e.code !== 'Space') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.hold(true);
    };
    const up = (e: KeyboardEvent) => {
      if (!this.view || e.code !== 'Space') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.hold(false);
    };
    addEventListener('keydown', down, true);
    addEventListener('keyup', up, true);
  }

  get active(): boolean {
    return !!this.view;
  }

  open(view: FishFightView | null): void {
    if (!view) {
      // The server closed it (the fight judged or the fish gone): the result stays a moment.
      if (this.view && !this.closeAt) this.closeAt = performance.now() + 1200;
      return;
    }
    this.view = view;
    this.p = fightParams(view.fish, view.kg, view.seed);
    this.st = fightStart(this.p);
    this.holds = [];
    this.holding = false;
    this.acc = 0;
    this.last = performance.now();
    this.closeAt = 0;
    const name = FISH[view.fish].name[lang() === 'ru' ? 1 : 0];
    this.el.innerHTML = `<div class="ff-card"><div class="ff-h">${fishIcon(view.fish, 'ico-md')}${esc(L('title', { fish: name }))} <span class="muted">${esc(L('kg', { kg: view.kg.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB') }))}</span></div>
      <div class="ff-bars"><div class="ff-row"><span>${esc(L('tension'))}</span><div class="ff-bar ff-t"><i></i><b class="ff-red"></b></div></div>
      <div class="ff-row"><span>${esc(L('fish'))}</span><div class="ff-bar ff-s"><i></i></div></div></div>
      <button class="btn btn-primary ff-reel" data-reel>${esc(L('reel'))}</button><p class="muted ff-hint">${esc(L('hint'))}</p><p class="ff-out"></p></div>`;
    this.el.classList.remove('hidden');
    const b = this.el.querySelector<HTMLElement>('[data-reel]')!;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      this.hold(true);
    });
    const release = () => this.hold(false);
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
  }

  private hold(on: boolean): void {
    if (!this.st || this.st.done || on === this.holding) return;
    this.holding = on;
    if (on) this.since = this.st.t;
    else this.holds.push([this.since, this.st.t]);
    this.el.querySelector('[data-reel]')?.classList.toggle('on', on);
  }

  /** Every frame: the fight moves on at its fixed step; the bars follow. */
  frame(): void {
    const now = performance.now();
    if (this.closeAt && now > this.closeAt) {
      this.view = null;
      this.closeAt = 0;
      this.el.classList.add('hidden');
      this.el.innerHTML = '';
      return;
    }
    if (!this.view || !this.p || !this.st) return;
    this.acc += Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    while (this.acc >= FIGHT_DT && !this.st.done) {
      this.acc -= FIGHT_DT;
      this.st = fightStep(this.p, this.st, this.holding, this.view.craft);
    }
    const t = this.el.querySelector<HTMLElement>('.ff-t > i'), s = this.el.querySelector<HTMLElement>('.ff-s > i');
    if (t) {
      t.style.width = `${this.st.tension}%`;
      t.style.background = this.st.tension > 80 ? '#e0473a' : this.st.tension > 55 ? '#e8a14a' : '#6fd46f';
    }
    if (s) s.style.width = `${(this.st.stamina / Math.max(1, this.p.stamina)) * 100}%`;
    if (this.st.done && !this.closeAt) {
      if (this.holding) {
        this.holds.push([this.since, this.st.t + 1]);
        this.holding = false;
      }
      const out = this.el.querySelector<HTMLElement>('.ff-out');
      if (out) out.textContent = L(this.st.done);
      this.send({ t: 'fishing', action: 'fight', id: this.view.id, holds: this.holds });
      this.closeAt = now + 1500;
    }
  }
}
