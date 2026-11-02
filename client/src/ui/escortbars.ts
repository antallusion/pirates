// The hold's bar and the escorts' bars under the captain's own (forum 2026-10-30, Нефигугум: «сложно следить за
// состоянием кораблей сопровождения», «четвёртая полоска — трюм»). Pure markup for the captain's plate (hud.ts
// drawStatus): the fourth row «Трюм» green → amber from HOLD_WARN → red with «ПЕРЕГРУЗ» at her hull's line; under it
// up to ESC_SHOWN tiny chips of the ships that sail with her (her own from the island's yard, the escorts of Command,
// the guards hired at sea), each its hull and crew, and «+N» for the rest. A tap on a chip looks at her (main.ts).

import type { ClientState } from '../state.ts';
import type { HoldView } from '../../../shared/src/data/overload.ts';
import { esc, m3 } from './dom.ts';

export const ESC_SHOWN = 3;

export interface EscortBar {
  /** Her ship's entity at sea. */
  eid: number;
  name: string;
  /** Hull and crew, whole per cent (crew null when unknown: a hired guard). */
  hull: number;
  crew: number | null;
}

const pc = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** The ships at sea with her: her fleet's (self.fleet) and her hired guards (state.hire), live hull from the snapshot. */
export function escortBars(state: ClientState): EscortBar[] {
  const out: EscortBar[] = [];
  const seen = new Set<number>();
  for (const e of state.self?.fleet?.escorts ?? []) {
    if (!e.atSea || e.eid === undefined || seen.has(e.eid)) continue;
    seen.add(e.eid);
    const live = state.ships.get(e.eid);
    out.push({ eid: e.eid, name: e.name, hull: pc(live ? live.cur.hull * 100 : e.hull), crew: e.crew ?? null });
  }
  for (const h of state.hire?.escorts ?? []) {
    if (h.waiting || seen.has(h.id)) continue;
    seen.add(h.id);
    const live = state.ships.get(h.id);
    out.push({ eid: h.id, name: h.name, hull: pc(live ? live.cur.hull * 100 : (h.hull / Math.max(1, h.hullMax)) * 100), crew: null });
  }
  return out;
}

/** A key for the plate's re-render: the bars move in 5 % steps. */
export function escortKey(list: EscortBar[]): string {
  return list.map((e) => `${e.eid}:${Math.round(e.hull / 5)}:${e.crew === null ? '-' : Math.round(e.crew / 5)}`).join(',');
}

export function holdKey(h: HoldView | null | undefined): string {
  return h ? `${h.pct}:${h.over}:${h.slow}:${h.at}` : '';
}

/** The hold's state for its colour: ok, warn (amber from HOLD_WARN of her line: `warn`) or over (her hull's line). */
export function holdTone(h: HoldView): 'ok' | 'warn' | 'over' {
  return h.over ? 'over' : h.pct >= (h.warn ?? h.at * 0.8) ? 'warn' : 'ok';
}

type Say = (k: 'hold' | 'holdOver' | 'holdT' | 'holdOverT' | 'escT' | 'escCrew' | 'escMore' | 'escMoreT', v?: Record<string, string | number>) => string;

/** The fourth row of the plate. */
export function holdRowHtml(h: HoldView, ico: string, L: Say): string {
  const tone = holdTone(h);
  const words = { used: m3(h.used), max: h.max, pct: h.pct, at: h.at, stores: m3(h.stores ?? 0) };
  const title = h.over ? `${L('holdOverT', { n: h.slow, at: h.at })} ${L('holdT', words)}` : L('holdT', words);
  // (owner, 2026-11-02: the bar is the trade goods' share; a tick marks her hull's line — half the hold, ¾ on a merchantman)
  return `<div class="cs-row cs-hold cs-hold-${tone}" title="${esc(title)}" aria-label="${esc(title)}">${ico}<span class="cs-bar"><i style="width:${Math.min(100, h.pct)}%"></i><u class="cs-line" style="left:${h.at}%"></u>${h.over ? `<b class="cs-over">${esc(L('holdOver'))}</b>` : ''}</span><span class="cs-v">${h.pct}%</span></div>`;
}

/** The escorts' chips: up to ESC_SHOWN, then «+N». */
export function escortRowHtml(list: EscortBar[], ico: string, L: Say): string {
  if (!list.length) return '';
  const shown = list.slice(0, ESC_SHOWN);
  const more = list.length - shown.length;
  const chip = (e: EscortBar) => {
    const t = L('escT', { name: e.name, hull: e.hull, crew: e.crew === null ? '' : L('escCrew', { n: e.crew }) });
    return `<button type="button" class="cs-esc${e.hull < 35 ? ' low' : ''}" data-esc="${e.eid}" title="${esc(t)}" aria-label="${esc(t)}">${ico}<span class="cs-eb"><i class="cs-eh" style="width:${e.hull}%"></i>${e.crew === null ? '' : `<i class="cs-ec" style="width:${e.crew}%"></i>`}</span></button>`;
  };
  return `<div class="cs-row cs-escs">${shown.map(chip).join('')}${more > 0 ? `<span class="cs-esc-more" title="${esc(L('escMoreT', { n: more }))}">${esc(L('escMore', { n: more }))}</span>` : ''}</div>`;
}
