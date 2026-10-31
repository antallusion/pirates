// «Хроника» (forum post 40, approved by the owner): the sixth tab of «Журнал» — everything that happened to her, with
// the time it happened, newest first: the loot hauled up, the divers' and the landing party's finds, a hoard dug, a
// bottle's note, a boarding and its spoils, who sank her and whom she sank, the quests' pay, the trades of note, the
// season card, the letters, her island's buildings. «Мелкие всплывающие надписи не успеваешь прочитать» — here they
// stay. One line each, an icon by its kind; the days headed «Сегодня», «Вчера», a date; filters by what it is about.
// The server keeps the last LOG_MAX lines in her save (captainlog.ts); the page asks for them once.

import { LOG_FILTERS, LOG_ICON, LOG_MAX, logIn } from '../../../shared/src/data/captainlog.ts';
import type { LogEntry, LogFilter } from '../../../shared/src/data/captainlog.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { lang } from '../i18n.ts';
import type { ClientState } from '../state.ts';
import { LC, tellLog } from './crewlife.ts';
import { esc, icon } from './dom.ts';
import { chipRow } from './kit/window.ts';

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** The day's heading: «Сегодня», «Вчера», or the date in the reader's tongue. */
export function chronDay(at: number, now = Date.now()): string {
  const d = new Date(at), t = new Date(now);
  if (dayKey(d) === dayKey(t)) return LC('chronToday');
  const y = new Date(now - 86_400_000);
  if (dayKey(d) === dayKey(y)) return LC('chronYesterday');
  return d.toLocaleDateString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long' });
}

/** The clock of a line (the reader's own time). */
export function chronTime(at: number): string {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The lines under a filter, newest first, grouped by their day. */
export function chronGroups(list: readonly LogEntry[], f: LogFilter, now = Date.now()): { day: string; rows: LogEntry[] }[] {
  const out: { day: string; rows: LogEntry[] }[] = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (!logIn(e.kind, f)) continue;
    const day = chronDay(e.at, now);
    const g = out.at(-1);
    if (g && g.day === day) g.rows.push(e);
    else out.push({ day, rows: [e] });
  }
  return out;
}

let filter: LogFilter = 'all';

/** The page: the filters, then the days and their lines. */
export function renderChronicle(body: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  state.chronNew = 0;
  const list = state.chron;
  if (!list) {
    send({ t: 'chron' });
    body.innerHTML = `<p class="muted">${esc(LC('chronLoading'))}</p>`;
    return;
  }
  const name = state.self?.name ?? '';
  const chips = chipRow(LOG_FILTERS.map((f) => ({ id: f, icon: f === 'all' ? 'ui_quill' : f === 'loot' ? 'map_treasure' : f === 'fight' ? 'tree_boarding' : f === 'quest' ? 'goal' : 'build_shipyard', label: LC(`cf.${f}`) })), filter, 'chf');
  const groups = chronGroups(list, filter);
  const rows = groups.map((g) => `<section class="ch-day"><h3 class="ch-h">${esc(g.day)}</h3><ol class="ch-list">${g.rows.map((e) => {
    const text = tellLog(e, name);
    const times = (e.x ?? 1) > 1 ? ` <b class="ch-x">${esc(LC('lg.times', { n: e.x ?? 1 }))}</b>` : '';
    return `<li class="ch-row ch-${e.kind}">${icon(LOG_ICON[e.kind], '•', 'ch-ico')}<time datetime="${new Date(e.at).toISOString()}">${chronTime(e.at)}</time><span class="ch-t">${esc(text)}${times}</span></li>`;
  }).join('')}</ol></section>`).join('');
  body.innerHTML = `<div class="chron"><div class="ch-top">${chips}<p class="ch-sub muted w-desk">${esc(LC('chronSub', { n: LOG_MAX }))}</p></div>
    <div class="ch-body">${rows || `<p class="muted ch-none">${esc(LC(list.length ? 'chronEmpty' : 'chronNone'))}</p>`}</div></div>`;
  body.querySelectorAll<HTMLElement>('[data-chf]').forEach((b) => (b.onclick = () => {
    filter = b.dataset.chf as LogFilter;
    renderChronicle(body, state, send);
  }));
}
