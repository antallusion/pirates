// The crew's life on the client (docs/16 #16–20): an officer's line as a toast with his face, the men's grumble and
// shanty, the mark of their mood on the captain's frame, the trades' practice and the wounded in the crew window, and
// the captain's log — the last few days, each headed and tallied, its lines told in the reader's tongue.

import { LOG_DAYS, LOG_ICON } from '../../../shared/src/data/captainlog.ts';
import type { LogEntry } from '../../../shared/src/data/captainlog.ts';
import { PROFESSIONS, PROFESSION_DEFS, UNIQUE_OFFICERS } from '../../../shared/src/data/crew.ts';
import type { Profession } from '../../../shared/src/data/crew.ts';
import { GRUMBLES, PRACTICE_MAX, PRACTICE_PER_LEVEL, SHANTIES, TALK, practiceLevel, practiceProgress } from '../../../shared/src/data/crewtalk.ts';
import type { SagaKind } from '../../../shared/src/data/saga.ts';
import type { ServerMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { personName } from '../lang/names.ts';
import { EN, RU } from '../lang/ui/crewlife.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { esc, icon, officerIcon } from './dom.ts';
import { sagaName, tellSagaShort } from './saga.ts';

export const LC = dict(EN, RU);
const ru = () => (lang() === 'ru' ? 1 : 0);

type Say = Extract<ServerMsg, { t: 'crew_say' }>;

/** An officer's name in the reader's tongue: a legend's from the table (translated with the data), the rest by parts. */
export function officerName(o: { name: string; unique?: string }): string {
  const u = o.unique ? UNIQUE_OFFICERS.find((x) => x.id === o.unique) : undefined;
  return u?.name ?? personName(o.name);
}

/** What was said, in the reader's tongue; the face and the speaker's name. */
export function crewSayParts(m: Say): { face: string; who: string; line: string; kind: 'info' | 'good' | 'bad' } {
  const x = m.x ? sagaName(m.x) : '';
  if (!m.who) {
    const table = m.ev === 'shanty' ? SHANTIES : GRUMBLES;
    return { face: icon('menu_crew', '', 'talk-face'), who: LC('crewVoice'), line: table[m.i]?.[ru()] ?? '', kind: m.ev === 'shanty' ? 'good' : 'bad' };
  }
  const ev = m.ev as keyof (typeof TALK)['lieutenant'];
  const line = (TALK[m.who.role]?.[ev]?.[m.i]?.[ru()] ?? '').replace('{x}', x);
  const kind = ev === 'victory' ? 'good' : ev === 'hunger' || ev === 'low_morale' || ev === 'boss' ? 'bad' : 'info';
  return { face: officerIcon(m.who, 'talk-face'), who: officerName(m.who), line, kind };
}

/** The mark of the men's mood on the captain's frame. */
export function moodMark(mood: 'grumble' | 'shanty' | null | undefined, shantyLeft: number): string {
  if (mood === 'shanty') return `<b class="uf-mood shanty" title="${esc(LC('mood.shantyTip', { s: Math.max(0, Math.ceil(shantyLeft)) }))}" aria-label="${esc(LC('mood.shanty'))}">♪</b>`;
  if (mood === 'grumble') return `<b class="uf-mood grumble" title="${esc(LC('mood.grumbleTip'))}" aria-label="${esc(LC('mood.grumble'))}">…</b>`;
  return '';
}

// ------------------------------------------------------------------ the crew window

function edge(k: Profession, lv: number): string {
  const e = PRACTICE_PER_LEVEL[k];
  const v = Math.abs(e.v * lv);
  const n = e.key === 'moraleBase' ? v : Math.round(v * 100);
  return LC(`pr.${k}` as 'pr.gunner', { v: n });
}

/** The trades' practice: a level and the way to the next, and what it gives. */
export function practiceHtml(pools: Record<Profession, number>, practice: Partial<Record<Profession, number>> | undefined): string {
  const rows = PROFESSIONS.map((k) => {
    const pts = practice?.[k] ?? 0;
    const lv = practiceLevel(pts);
    const prog = practiceProgress(pts);
    const none = (pools[k] ?? 0) <= 0;
    return `<div class="pr-row${none ? ' muted' : ''}">${icon(`prof_${k}`, '', 'ico-sm')}<span class="pr-name">${esc(PROFESSION_DEFS[k].name)}</span>
      <span class="pr-bar" title="${esc(lv >= PRACTICE_MAX ? LC('practiceMax') : `${Math.round(prog * 100)}%`)}"><i style="width:${Math.round(prog * 100)}%"></i></span>
      <b class="pr-lv">${esc(lv >= PRACTICE_MAX ? LC('practiceMax') : LC('practiceLv', { n: lv }))}</b><span class="pr-edge">${lv > 0 && !none ? esc(edge(k, lv)) : ''}</span></div>`;
  }).join('');
  return `<div class="card pr-card"><h4 class="card-h">${icon('xp', '', 'ico-md')}${esc(LC('practice'))}</h4>${rows}<p class="muted pr-hint">${esc(LC('practiceHint'))}</p></div>`;
}

/** The wounded below: how many, the pace of healing and of dying, what would help. */
export const fmt1 = (n: number): string => (Math.round(n * 10) / 10).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB');

export function woundedHtml(w: NonNullable<NonNullable<ClientState['self']>['company']['wounded']> | undefined): string {
  if (!w) return '';

  const body = w.n > 0
    ? `<p class="wd-n"><b class="${w.diePerMin > 0 ? 'bad' : 'good'}">${esc(LC('woundedN', { n: w.n }))}</b></p>
       <p>${esc(LC('woundedHeal', { h: fmt1(w.healPerMin) }))} · ${w.diePerMin > 0 ? `<span class="bad">${esc(LC('woundedDie', { d: fmt1(w.diePerMin) }))}</span>` : `<span class="good">${esc(LC('woundedSafe'))}</span>`}</p>`
    : `<p class="muted">${esc(LC('woundedNone'))}</p>`;
  return `<div class="card wd-card"><h4 class="card-h">${icon('prof_surgeon', '', 'ico-md')}${esc(LC('wounded'))}</h4>${body}
    <p class="muted">${icon('prof_surgeon', '', 'ico-xs')}${esc(LC('woundedWho', { s: w.surgeons, m: w.medicine }))}</p>
    ${w.n > 0 && (w.surgeons <= 0 || w.medicine <= 0) ? `<p class="muted">${esc(LC('woundedAdvice'))}</p>` : ''}<p class="muted">${esc(LC('woundedHarbour'))}</p></div>`;
}

// ------------------------------------------------------------------ the captain's log

const pad = (n: number) => String(n).padStart(2, '0');
function clock(tod: number): string {
  const m = Math.floor(((tod % 1) + 1) % 1 * 24 * 60);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** One line of the log in the reader's tongue. */
export function tellLog(e: LogEntry, captain: string): string {
  const a = (i: number) => sagaName(e.a[i] ?? '');
  switch (e.kind) {
    case 'saga': return tellSagaShort(e.a[0] as SagaKind, e.a.slice(1), e.n, captain);
    case 'officer_dead': return LC('lg.officer_dead', { 0: personName(e.a[0] ?? ''), 1: serverText(e.a[1] ?? '') });
    case 'crew_lost': return LC('lg.crew_lost', { 0: a(0), n: e.n ?? 0, w: e.a[1] ?? '0' });
    case 'wounded_died': case 'level': return LC(`lg.${e.kind}`, { n: e.n ?? 0 });
    default: return LC(`lg.${e.kind}` as 'lg.sank', { 0: a(0), 1: a(1) });
  }
}

interface Row { tod: number; icon: string; text: string }

/** A day's lines, the ships sunk (or taken) one after another told as one. */
function dayRows(list: LogEntry[], captain: string): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.kind === 'sank' || e.kind === 'prize') {
      let j = i;
      while (j + 1 < list.length && list[j + 1].kind === e.kind) j++;
      if (j > i) {
        const names = list.slice(i, j + 1).map((x) => (ru() ? `«${sagaName(x.a[0] ?? '')}»` : `“${sagaName(x.a[0] ?? '')}”`));
        const shown = names.length > 4 ? [...names.slice(0, 4), '…'] : names;
        rows.push({ tod: list[j].tod, icon: LOG_ICON[e.kind], text: LC(e.kind === 'sank' ? 'lg.sankMany' : 'lg.prizeMany', { n: names.length, list: shown.join(', ') }) });
        i = j;
        continue;
      }
    }
    rows.push({ tod: e.tod, icon: LOG_ICON[e.kind], text: tellLog(e, captain) });
  }
  return rows;
}

function tally(list: LogEntry[]): string {
  let s = 0, p = 0, d = 0;
  for (const e of list) {
    if (e.kind === 'sank') s++;
    else if (e.kind === 'prize') p++;
    else if (e.kind === 'crew_lost' || e.kind === 'wounded_died') d += e.n ?? 0;
  }
  return s || p || d ? `<div class="lg-tally">${esc(LC('logTally', { s, p, d }))}</div>` : '';
}

/** The captain's log: the newest day first, each with its lines in order and the day's tally. */
export function renderLog(root: HTMLElement, state: ClientState): void {
  const self = state.self;
  if (!self) return;
  const log = self.log ?? [];
  const days = [...new Set(log.map((e) => e.day))].sort((x, y) => y - x);
  const today = days[0];
  const body = days.map((d) => {
    const list = log.filter((e) => e.day === d);
    const rows = dayRows(list, self.name);
    return `<section class="lg-day"><h3 class="lg-h">${esc(LC('logDay', { n: d }))}${d === today ? ` <span class="muted">· ${esc(LC('logToday'))}</span>` : ''}</h3>
      <ol class="lg-list">${rows.map((r) => `<li>${icon(r.icon, '', 'ico-sm')}<time>${clock(r.tod)}</time><span>${esc(r.text)}</span></li>`).join('')}</ol>${tally(list)}</section>`;
  }).join('');
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(LC('log'))}</h2><div class="sub">${esc(LC('logSub', { n: LOG_DAYS }))}</div></div></div>
    <div class="modal-body captain-log">${body || `<p class="muted">${esc(LC('logNone'))}</p>`}</div>`;
}
