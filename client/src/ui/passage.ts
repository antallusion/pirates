// «Дальний переход» on screen (owner, 2026-10-28: «нужно таймер показывать когда приплывешь к выбранной точке, таймер прям
// малюсенький и расстояние до точки типа. и входя в этот режим небольшое оч маленькое оповещение … обязательно все в
// стиле игры»; server/src/game/passage.ts):
//  - a tiny brass pill hung under the chart's ring: «⛵ 1:42 · 3,2 км» — the time to the mark and the way left by the
//    planned course, live (four times a second);
//  - the helm, «Огонь» and the action buttons dimmed (body.voyage, seahud.css); a tap on them says why, once in a while;
//  - the small toast on entering and on arrival (main.ts).

import { VOYAGE_MUL } from '../../../shared/src/data/passage.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/passage.ts';
import type { ClientState } from '../state.ts';
import { courseAhead, courseOf } from './course.ts';
import { dec1, esc } from './dom.ts';
import { LF } from './ferry.ts';
import { placeName } from './maps.ts';

export const LP = dict(EN, RU);

/** The way left in her words: «3,2 км», «640 м». */
export function wayLeft(d: number): string {
  return d >= 1000 ? `${dec1(d / 1000)} ${LP('km')}` : `${Math.max(0, Math.round(d / 10) * 10)} ${LP('m')}`;
}

/** Seconds as «1:42» («12:05» past ten minutes). */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The time to the mark: the passage's way at its pace, its last stretch at her own. */
export function etaOf(left: number, v: number, tail: number): number {
  const fast = Math.max(0, left - tail);
  return fast / Math.max(1, v) + Math.min(left, tail) / Math.max(1, v / VOYAGE_MUL);
}

/** The controls a passage leaves her no use of (dimmed; a tap says why). */
const LOCKED = '#tc-stick, #tc-sail, #tc-fire, #tc-ammo, #tc-lock, #tc-special, #tc-abil, #tc-act, #tc-actrow, #tc-deck, #tc-cast, #tc-target, #hud-autosail .as-stop, #hud-combat';

export class PassagePill {
  private el: HTMLElement | null = null;
  private at = 0;
  private text = '';
  private hintAt = 0;
  /** Said when a dimmed control is tapped (main.ts: the HUD's toast). */
  onHint: (msg: string) => void = () => {};

  constructor() {
    // (capture: before the helm's and the buttons' own handlers — the server refuses them anyway, this is the word why)
    const stop = (e: Event) => {
      if (!document.body.classList.contains('voyage')) return;
      const t = e.target as Element | null;
      if (!t || !t.closest?.(LOCKED)) return;
      e.preventDefault();
      e.stopPropagation();
      this.hint();
    };
    for (const k of ['pointerdown', 'touchstart', 'mousedown', 'click']) document.addEventListener(k, stop, { capture: true, passive: false });
    document.addEventListener('keydown', (e) => {
      if (!document.body.classList.contains('voyage')) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!/^(KeyW|KeyA|KeyS|KeyD|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space|ShiftLeft|ShiftRight)$/.test(e.code)) return;
      // (the helm's keys held off: her sail kept as the helmsman set it, nothing to take the wheel back on arrival)
      e.preventDefault();
      e.stopPropagation();
      this.hint();
    }, { capture: true });
  }

  private hint(): void {
    if (!document.body.classList.contains('voyage')) return;
    const now = performance.now();
    if (now - this.hintAt < 4000) return;
    this.hintAt = now;
    this.onHint(LP('hint'));
  }

  private node(): HTMLElement {
    if (this.el) return this.el;
    const el = document.createElement('div');
    el.id = 'hud-voyage';
    el.className = 'hidden';
    el.setAttribute('role', 'timer');
    (document.getElementById('hud') ?? document.body).appendChild(el);
    return (this.el = el);
  }

  draw(state: ClientState): void {
    const on = !!state.voyage && !state.self?.dockedAt;
    document.body.classList.toggle('voyage', on);
    const el = this.node();
    if (!on) {
      if (this.text) {
        this.text = '';
        el.classList.add('hidden');
        el.innerHTML = '';
      }
      return;
    }
    const now = performance.now();
    if (now - this.at < 250 && this.text) return;
    this.at = now;
    const v = state.voyage!;
    const own = state.ownDisplay;
    const c = courseOf(state);
    const left = c && own ? courseAhead(c, own.x, own.y).left : own ? Math.hypot(v.x - own.x, v.y - own.y) : v.left;
    const t = clock(etaOf(left, v.v, v.tail)), d = wayLeft(left);
    const text = `${lang()}|${t}|${d}|${v.ferry ?? ''}`;
    if (text === this.text) return;
    this.text = text;
    el.classList.remove('hidden');
    // (a hub's «Переход», owner 2026-10-30: the port it is for)
    const to = v.ferry ? state.ports.find((p) => p.id === v.ferry) : undefined;
    el.title = to ? `${LF('on', { to: placeName(to.name), n: VOYAGE_MUL })} · ${t} · ${d}` : LP('pill', { t, d });
    el.setAttribute('aria-label', el.title);
    el.innerHTML = `<i class="vy-ico" aria-hidden="true"></i><b class="vy-t">${esc(t)}</b><span class="vy-sep" aria-hidden="true">·</span><span class="vy-d">${esc(d)}</span>`;
  }
}
