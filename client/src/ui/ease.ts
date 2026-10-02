// docs/16 Batch H in the HUD: the auto-sail pill (#36) and the first-time hints of the sea's mechanics (#37). Both are
// plates of the top stack, one width with the rest; each rewrites only what changed (no lost taps).

import { AUTOSAIL_STOPS, autosailSail } from '../../../shared/src/data/autosail.ts';
import type { AutosailStop } from '../../../shared/src/data/autosail.ts';
import type { ServerMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/ease.ts';
import { settings } from '../settings.ts';
import type { ClientState } from '../state.ts';
import { $, dec1, esc } from './dom.ts';

const L = dict(EN, RU);

// ------------------------------------------------------------------ 36. auto-sail

/** The words for why the helmsman gave the wheel back, and whether it is bad news. */
export function autosailStopText(why: AutosailStop | undefined): { text: string; kind: 'bad' | 'info' | 'good' } {
  const w: AutosailStop = why && AUTOSAIL_STOPS.includes(why) ? why : 'off';
  const kind = w === 'arrived' ? 'good' : w === 'manual' || w === 'off' || w === 'port' || w === 'lost' ? 'info' : 'bad';
  return { text: L(`as_why.${w}`), kind };
}

/** The request for the helmsman: her sail set as he will carry it, so her own idle helm does not take it back. */
export function autosailRequest(state: ClientState, wp: { x: number; y: number }): { t: 'autosail'; x: number; y: number; sail: number } {
  const sail = autosailSail(state.input.sail);
  state.input.sail = sail;
  return { t: 'autosail', x: Math.round(wp.x), y: Math.round(wp.y), sail };
}

function distText(d: number): string {
  return d >= 1000 ? `${dec1(d / 1000)} ${lang() === 'ru' ? 'км' : 'km'}` : `${Math.round(d / 10) * 10} ${lang() === 'ru' ? 'м' : 'm'}`;
}

/** The pill «Auto-sail · 2.4 km · stop» at the top of the stack while the helmsman has the wheel. */
export class AutosailPill {
  private key = '';
  onStop: () => void = () => {};

  draw(state: ClientState): void {
    const el = $('hud-autosail');
    const a = state.autosail;
    const own = state.ownDisplay;
    const key = a && own ? lang() : '';
    if (key !== this.key) {
      this.key = key;
      el.classList.toggle('hidden', !key);
      el.innerHTML = key ? `<span class="as-ico" aria-hidden="true">⛵</span><b class="as-lbl">${esc(L('as_pill'))}</b><span class="as-d"></span><button class="as-stop" type="button" title="${esc(L('as_stopTitle'))}">${esc(L('as_stop'))}</button>` : '';
      el.querySelector<HTMLElement>('.as-stop')?.addEventListener('click', () => this.onStop());
    }
    if (a && own) {
      const d = el.querySelector<HTMLElement>('.as-d')!;
      const text = `· ${L('as_left', { d: distText(Math.hypot(a.x - own.x, a.y - own.y)) })} ·`;
      if (d.textContent !== text) d.textContent = text;
    }
  }
}

// ------------------------------------------------------------------ 37. first-time hints

export type TipId =
  | 'fishing' | 'boarding' | 'landing' | 'trek' | 'lighthouse' | 'trade' | 'signals' | 'base' | 'port' | 'storm' | 'sight' | 'hunt' | 'dive' | 'map' | 'waypoint' | 'actions';
export const TIP_IDS: readonly TipId[] = ['fishing', 'boarding', 'landing', 'trek', 'lighthouse', 'trade', 'signals', 'base', 'port', 'storm', 'sight', 'hunt', 'dive', 'map', 'waypoint', 'actions'];

/** The mechanic a message from the server shows her for the first time, if any. */
export function tipForMsg(m: ServerMsg): TipId | null {
  switch (m.t) {
    case 'shoals':
      return m.list.length ? 'fishing' : null;
    case 'boarding':
      return m.result ? 'boarding' : null;
    case 'board_fight':
    case 'board_tac':
      return m.view ? 'boarding' : null;
    case 'minigame':
      return m.view ? 'landing' : null;
    case 'trek':
      return m.view ? 'trek' : null;
    case 'barter':
      return m.view ? 'trade' : null;
    case 'base':
      return m.view ? 'base' : null;
    case 'port':
      return m.view ? 'port' : null;
    case 'sights':
      return m.list.length ? 'sight' : null;
    case 'hunt':
      return m.view ? 'hunt' : null;
    case 'dive':
      return m.view ? 'dive' : null;
    case 'party':
      return (m.group?.members.length ?? 0) > 1 ? 'signals' : null;
    default:
      return null;
  }
}

/** The mechanic the sea about her shows for the first time (checked about once a second). */
export function tipForState(state: Pick<ClientState, 'weather' | 'isles' | 'ownDisplay' | 'self'>, waypointSet: boolean): TipId | null {
  const own = state.ownDisplay;
  if (!own || state.self?.dockedAt) return null;
  if (state.weather === 'storm' || state.weather === 'black_storm') return 'storm';
  if ((state.isles?.lights ?? []).some((l) => Math.hypot(l.x - own.x, l.y - own.y) < l.r + 800)) return 'lighthouse';
  if ((state.self?.maps ?? []).some((m) => m.r > 0)) return 'map';
  if (waypointSet) return 'waypoint';
  return null;
}

const SEEN_KEY = 'gravetide.firstTips';

export function seenTips(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(SEEN_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string): void {
  const s = seenTips();
  s.add(id);
  try {
    globalThis.localStorage?.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {
    /* no storage */
  }
}

/** One line in the top stack, once per mechanic, off in the options; queued while a window covers the HUD. */
export class FirstTips {
  private queue: TipId[] = [];
  private showing: { id: TipId; until: number } | null = null;
  private restAt = 0;
  private key = '';
  /** A window over the HUD (the line waits for it to close). */
  covered: () => boolean = () => false;

  offer(id: TipId | null): void {
    if (!id || !settings().firstHints) return;
    if (this.showing?.id === id || this.queue.includes(id) || seenTips().has(id)) return;
    this.queue.push(id);
  }

  frame(now: number): void {
    const el = $('hud-tip');
    if (!settings().firstHints) {
      this.queue = [];
      this.showing = null;
    }
    if (this.showing && now > this.showing.until) this.dismiss(now);
    const stackVisible = (() => {
      const st = document.getElementById('hud-stack');
      return !!st && st.offsetParent !== null && getComputedStyle(st).visibility !== 'hidden';
    })();
    if (!this.showing && this.queue.length && now > this.restAt && !this.covered() && stackVisible) {
      const id = this.queue.shift()!;
      markSeen(id);
      this.showing = { id, until: now + 14_000 };
    }
    const key = this.showing ? `${this.showing.id}|${lang()}` : '';
    if (key === this.key) return;
    this.key = key;
    el.classList.toggle('hidden', !this.showing);
    el.innerHTML = this.showing ? `<b class="tp-lbl">${esc(L('tip_lbl'))}</b><span class="tp-t">${esc(L(`tip.${this.showing.id}`))}</span><button class="tp-x" type="button" title="${esc(L('tip_close'))}" aria-label="${esc(L('tip_close'))}">×</button>` : '';
    el.querySelector<HTMLElement>('.tp-x')?.addEventListener('click', () => this.dismiss(performance.now()));
  }

  private dismiss(now: number): void {
    this.showing = null;
    this.restAt = now + 2500;
  }
}
