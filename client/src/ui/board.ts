// The port's «Задания» (owner, 2026-10-16: «задания очень сложно находить, надо в порту отдельную вкладку сделать под
// задания слева, и чтобы были переключатели задания это там, контракты какие-то или еще что-то. все что можно взять по
// заданиям в одном месте с внутреними переключателями»): one place of the rail with switches — everything, the board's
// jobs, the story, the contracts (the port's, the merchants' runs, the Admiralty's, the wanted), the urgent and the
// day's group contract, the day's orders and the sea's goals, the guild's week and a power's service, and what she has
// taken. Each card: the pay (silver, experience, what else), the ⚓ band it is for in the colour of its danger to her
// ship, where it sends her and how far, and «Взять» — or why not («Не ваш уровень: ⚓7–9»); once taken, «Плыть».
// Pure: port.ts draws it and its buttons go through the port's own `data-act`.

import { guildGoalText } from '../../../shared/src/data/guildgoal.ts';
import { THREAT_COLOR, shipLevelOf, threatOf } from '../../../shared/src/data/shiplevel.ts';
import type { Threat } from '../../../shared/src/data/shiplevel.ts';
import type { PortView } from '../../../shared/src/protocol.ts';
import type { ClientState } from '../state.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/board.ts';
import { EN as WIN_EN, RU as WIN_RU } from '../lang/ui/win.ts';
import { cmpText, serverText } from '../lang/server.ts';

/** A quest's words: the campaign's never in English while they load (docs/36). */
const qtext = (kind: string, s: string): string => (kind === 'campaign' ? cmpText(s) : serverText(s));
import { esc, icon, money, xpBadge } from './dom.ts';
import { placeName } from './maps.ts';
import { distWords } from './journal.ts';
import type { WinTab } from './kit/window.ts';
import { classSwitch, classWord, questClass } from './questclass.ts';
import type { QuestClass } from './questclass.ts';
import type { QuestKind } from '../../../shared/src/data/questclass.ts';
import { chipRow } from './kit/window.ts';

const L = dict(EN, RU);
const W = dict(WIN_EN, WIN_RU);

// docs/36 §1, the one taxonomy (owner, 2026-10-17: «беру задание, например сети мики … в "цели и вести" … числится как
// побочное»): «Кампания» — the main campaign only; «Побочные» — the side chains, the regions' arcs, the Paths and the
// Legends (they were all «Сюжет» here, and «Побочное» at sea); «Поручения» — the boards' jobs. The words are the
// taxonomy's own (questclass.ts), the same at sea and in the journal.
// (owner, 2026-10-18: «кампанию брать не надо в портах, она сама должна идти и идти … пусть она всегда будет в журнале»:
// the campaign is never on a board — it goes on by itself, in the journal and in «Цели и вести».)
export type BoardChip = 'all' | 'side' | 'jobs' | 'contracts' | 'urgent' | 'daily' | 'guild' | 'mine';
export const BOARD_CHIPS: readonly BoardChip[] = ['all', 'side', 'jobs', 'contracts', 'urgent', 'daily', 'guild', 'mine'];
const CHIP_ICON: Record<BoardChip, string> = {
  all: 'ui_quill', side: 'tab_letters', jobs: 'goal', contracts: 'map_contract', urgent: 'danger', daily: 'coin', guild: 'tab_guild', mine: 'stat_sails',
};

/** A generated job's picture by its kind (docs/11 P4). */
const JOB_ICON: Record<string, string> = {
  delivery: 'good_provisions', hunt: 'fire', rescue: 'map_cove', scouting: 'ui_spyglass', smuggling: 'good_dreamleaf', treasure: 'map_treasure',
  diplomacy: 'map_contract', revenge: 'danger', investigation: 'ab_spotters_eye', elite: 'danger',
};

/** A card of the board: a quest or a contract on offer here, or one of hers (taken: «Плыть»). */
export interface BoardItem {
  kind: 'quest' | 'contract';
  id: string;
  title: string;
  /** What it asks, for the long press. */
  text: string;
  art: string;
  silver: number;
  xp: number;
  band?: [number, number];
  /** Where it first sends her (a port's or an island's name and place); none: it is done about the sea, or here. */
  dest?: { x: number; y: number; name: string } | null;
  /** A voyage past 1.5 km of the port (owner, 2026-10-18): how far, in metres — «Дальний рейс · N км». */
  far?: number;
  /** Why she may not take it (server words), or null. */
  blocked: string | null;
  urgent: boolean;
  group: boolean;
  /** It opens a Path; it may be paid in shot. */
  path: boolean;
  stores: boolean;
  /** Taken already (a card of hers, «Плыть»). */
  taken: boolean;
  /** docs/36 §1: a quest's class (its word on the card), and a campaign quest's place (the chapter, the quest in it). */
  cls?: QuestClass;
  cmp?: { ch: number; k: number; size: number };
  chips: BoardChip[];
  score: number;
}

/** The middle of a band: the ⚓ the job is of (a band is its ⚓ one either side, cut at 1 and 10). */
export function bandAnchor(b: [number, number]): number {
  if (b[0] <= 1 && b[1] <= 2) return 1;
  if (b[1] >= 10 && b[0] >= 9) return 10;
  return b[0] + 1;
}

/** How dangerous a band is to her ship. */
export function bandThreat(b: [number, number], mine: number): Threat {
  return threatOf(mine, bandAnchor(b));
}

/** A quest's switches, by its class (questclass.ts). */
export const chipsOfQuest = (kind: QuestKind, category: string | undefined, urgent: boolean): BoardChip[] => {
  const c = questClass({ kind });
  if (c === 'campaign') return []; // never on a board (it goes on by itself)
  if (c === 'side') return ['side'];
  if (category === 'elite') return ['urgent', 'contracts'];
  return urgent ? ['urgent', 'jobs'] : ['jobs'];
};

/** A voyage past this from the port is a far one (server/src/game/questlocal.ts LOCAL_R). */
const FAR_VOYAGE = 1500;

/** The offers seen on this port's board while she lies here (a new harbour, a new memory): what she takes of them keeps
 *  its card at the head of the list, «Взять» turned «Плыть». */
const visit = { port: '', offered: new Set<string>() };

/** Everything on this port's board for her, and what she has taken here, best for her first (docs/23 item 69: pay and
 *  experience, one for her ship's level over one above it, the urgent and the easy a little ahead); what she may not
 *  take goes last. */
export function boardItems(view: PortView, state: ClientState): BoardItem[] {
  const self = state.self;
  const lvl = self ? shipLevelOf(self.loadout) : 1;
  const port = (id?: string) => (id ? state.ports.find((p) => p.id === id) : undefined);
  const fit = (b?: [number, number]) => (!b ? 1 : lvl >= b[0] && lvl <= b[1] ? 1 : 0.25);
  const out: BoardItem[] = [];
  if (visit.port !== view.portId) {
    visit.port = view.portId;
    visit.offered.clear();
  }
  for (const c of view.contracts) visit.offered.add(`c:${c.id}`);
  for (const q of view.questOffers) visit.offered.add(`q:${q.id}`);
  for (const c of view.contracts) {
    const to = port(c.toPort);
    const ease = c.kind === 'courier' ? 1.15 : c.kind === 'bounty' ? 0.9 : 1;
    const here = port(view.portId);
    const far = to && here ? Math.hypot(to.x - here.x, to.y - here.y) : 0;
    const blocked = c.blocked ?? null;
    out.push({ kind: 'contract', id: c.id, title: serverText(c.title), text: serverText(c.description), art: contractArt(c), silver: c.reward, xp: c.xp, ...(c.band ? { band: c.band } : {}),
      dest: to ? { x: to.x, y: to.y, name: placeName(to.name) } : null, ...(far > FAR_VOYAGE ? { far } : {}), blocked, urgent: false, group: false, path: false, stores: false, taken: false, chips: ['contracts'],
      score: (c.reward + c.xp * 3) * ease * fit(c.band) * (blocked ? 0.05 : 1) });
  }
  for (const q of view.questOffers) {
    const art = q.portrait ? `portrait.${q.portrait}` : q.kind === 'legend' ? 'tab_legends' : q.kind === 'path' ? 'menu_crew' : q.kind === 'job' ? JOB_ICON[q.category ?? ''] ?? 'goal' : q.category === 'arc' ? 'tab_legends' : 'goal';
    const d = q.dest;
    const where = d ? (d.port ? placeName(port(d.port)?.name ?? '') : d.island !== undefined ? placeName(state.islands.get(d.island)?.name ?? '') : '') : '';
    out.push({ kind: 'quest', id: q.id, title: qtext(q.kind, q.name), text: `${qtext(q.kind, q.summary)} ${q.steps.map((t, i) => `${i + 1}. ${qtext(q.kind, t)}`).join(' ')}`, art, silver: q.silver, xp: q.xp,
      ...(q.band ? { band: q.band } : {}), dest: d ? { x: d.x, y: d.y, name: where } : null, ...(q.far ? { far: q.far } : {}), blocked: q.blocked, urgent: !!q.urgent, group: !!q.group, path: !!q.path, stores: !!q.pays?.stores, taken: false,
      cls: questClass(q), ...(q.cmp ? { cmp: { ch: q.cmp.ch, k: q.cmp.k, size: q.cmp.size } } : {}), ...(q.cmp?.label ? { title: `${cmpText(q.cmp.label)}: ${qtext(q.kind, q.name)}` } : {}),
      chips: chipsOfQuest(q.kind, q.category, !!q.urgent),
      score: (q.silver + q.xp * 3) * fit(q.band) * (q.urgent ? 1.4 : 1) * (q.blocked ? 0.05 : 1) });
  }
  out.sort((a, b) => Number(!!a.blocked) - Number(!!b.blocked) || b.score - a.score);
  // What she took here: its card stays, with «Плыть» (owner: «Плыть» once it is taken), at the head of its switch.
  const taken: BoardItem[] = [];
  for (const q of self?.quests ?? []) {
    if (!visit.offered.has(`q:${q.id}`)) continue;
    const t = q.target;
    taken.push({ kind: 'quest', id: q.id, title: qtext(q.kind, q.name), text: qtext(q.kind, q.text), art: 'goal', silver: q.silver ?? 0, xp: q.xp ?? 0, dest: t && !t.region ? { x: t.x, y: t.y, name: placeName(port(t.port)?.name ?? '') } : null,
      blocked: null, urgent: false, group: false, path: false, stores: false, taken: true, chips: chipsOfQuest(q.kind, q.category, false), score: 0, cls: questClass(q) });
  }
  for (const c of self?.contracts ?? []) {
    if (!visit.offered.has(`c:${c.id}`)) continue;
    const to = port(c.toPort);
    taken.push({ kind: 'contract', id: c.id, title: serverText(c.title), text: serverText(c.description), art: contractArt(c), silver: c.reward, xp: c.xp, dest: to ? { x: to.x, y: to.y, name: placeName(to.name) } : null,
      blocked: null, urgent: false, group: false, path: false, stores: false, taken: true, chips: ['contracts'], score: 0 });
  }
  return [...taken, ...out];
}

/** The items of a switch. */
export function itemsOf(items: BoardItem[], chip: BoardChip): BoardItem[] {
  return chip === 'all' ? items : items.filter((x) => x.chips.includes(chip));
}

export function contractArt(c: { kind: string; good?: string }): string {
  return c.kind === 'bounty' ? 'wanted' : c.kind === 'delivery' && c.good ? `good_${c.good}` : 'map_contract';
}

/** The switches with what each has to take now. */
export function boardChips(items: BoardItem[], state: ClientState, view: PortView): WinTab[] {
  const open = (c: BoardChip) => itemsOf(items, c).filter((x) => !x.taken && !x.blocked).length;
  const self = state.self;
  const daily = (self?.daily?.orders ?? []).filter((o) => !o.done).length;
  const mine = (self?.quests.length ?? 0) + (self?.contracts.length ?? 0);
  const n: Record<BoardChip, number> = {
    all: open('all'), side: open('side'), jobs: open('jobs'), contracts: open('contracts') + (view.runs?.offers.length ?? 0), urgent: open('urgent'), daily, guild: view.service?.offer && !self?.service ? 1 : 0, mine,
  };
  const word = (c: BoardChip) => (c === 'side' ? classSwitch(c) : c === 'jobs' ? classSwitch('job') : c === 'daily' ? classSwitch('daily') : L(`c.${c}`));
  return BOARD_CHIPS.map((c) => ({ id: c, icon: CHIP_ICON[c], label: word(c), hint: L(`c.${c}Hint` as 'c.allHint'), badge: n[c] }));
}

/** The meta line of a card: what it is, the band in its danger's colour and the word for it, where and how far. */
function meta(x: BoardItem, state: ClientState, mine: number): string {
  const parts: string[] = [esc(x.kind === 'contract' ? W('q.contract') : x.cls ? classWord(x.cls) : W('q.quest'))];
  if (x.cmp) parts.push(esc(L('cmpWhere', { ch: x.cmp.ch, n: x.cmp.k + 1, of: x.cmp.size })));
  if (x.band) {
    const t = bandThreat(x.band, mine);
    const b = x.band[0] === x.band[1] ? L('bandOne', { lo: x.band[0] }) : L('band', { lo: x.band[0], hi: x.band[1] });
    parts.push(`<span class="q-band lvl-${t}" style="color:${THREAT_COLOR[t]}">${esc(b)}</span> <span class="q-danger">${esc(L(`d.${t}`))}</span>`);
  }
  const own = state.ports.find((p) => p.id === state.portView?.portId) ?? null;
  if (x.far) {
    // a voyage: «Дальний рейс · Солтмарроу · 3,2 км» (owner, 2026-10-18: near the port all else)
    parts.push(`<span class="q-far">${esc(x.dest?.name ? L('farTo', { where: x.dest.name, d: distWords(x.far) }) : L('far', { d: distWords(x.far) }))}</span>`);
  } else if (x.dest && x.dest.name) {
    const d = own ? Math.hypot(x.dest.x - own.x, x.dest.y - own.y) : 0;
    parts.push(esc(d < 600 ? `→ ${L('here')}` : L('to', { where: x.dest.name, d: distWords(d) })));
  }
  if (x.group) parts.push(esc(L('group')));
  if (x.path) parts.push(esc(L('path')));
  return parts.join(' · ');
}

/** A card. */
function row(x: BoardItem, state: ClientState, mine: number): string {
  const docked = !!state.self?.dockedAt;
  const key = x.kind === 'contract' ? `c:${x.id}` : `q:${x.id}`;
  const btn = x.taken
    ? `<button type="button" class="k-btn k-btn--primary k-btn--md q-sail" data-act="goal" data-key="${esc(key)}" title="${esc(L(docked ? 'sailHint' : 'sail'))}">${icon('stat_sails', '', 'ico-sm')}${esc(L('sail'))}</button>`
    : x.kind === 'contract'
      ? `<button type="button" class="k-btn k-btn--primary k-btn--md" data-act="contract" data-mode="accept" data-id="${esc(x.id)}"${x.blocked ? ' disabled' : ''}>${esc(W('q.take'))}</button>`
      : `<button type="button" class="k-btn k-btn--primary k-btn--md" data-act="quest_accept" data-id="${esc(x.id)}"${x.blocked ? ' disabled' : ''}>${esc(W('q.take'))}</button>`;
  const why = x.blocked ? `<small class="q-why">${esc(serverText(x.blocked))}</small>` : '';
  const pay = `${money(x.silver)}${x.xp ? xpBadge(x.xp) : ''}${x.stores ? `<small class="q-or">${esc(L('stores'))}</small>` : ''}`;
  return `<div class="w-row q-row${x.blocked ? ' q-off' : ''}${x.taken ? ' q-taken' : ''}" data-hint="${esc(x.text)}" data-qid="${esc(key)}">${icon(x.art, '', 'w-row-ico')}
    <span class="w-row-t"><b>${esc(x.title)}</b><small>${meta(x, state, mine)}</small>${why}</span><span class="w-row-n q-pay">${pay}</span><span class="w-row-b">${btn}</span></div>`;
}

/** The guild's order of the week (docs/11 P6), the bar the members fill. */
function guildCard(state: ClientState): string {
  const w = state.guild?.weekly;
  if (!w) return `<p class="muted">${esc(L('guildNone'))}</p>`;
  const pct = Math.min(100, (w.progress / Math.max(1, w.target)) * 100);
  return `<div class="card"><h4 class="card-h">${icon('tab_guild', '', 'ico-md')}${esc(L('guildWeek'))}</h4><div class="cm-text">${esc(guildGoalText(w.kind, w.target, lang() === 'ru' ? 1 : 0))}</div>
    <div class="cm-bar${w.done ? ' done' : ''}"><i style="width:${pct.toFixed(1)}%"></i><span>${w.progress}/${w.target}</span></div></div>`;
}

/** Everything she has taken, wherever it was given: the step now, how far along, «Плыть», set aside. */
function takenList(state: ClientState): string {
  const self = state.self!;
  const docked = !!self.dockedAt;
  const port = (id?: string) => (id ? state.ports.find((p) => p.id === id) : undefined);
  const sail = (key: string) => `<button type="button" class="k-btn k-btn--primary k-btn--md q-sail" data-act="goal" data-key="${esc(key)}" title="${esc(L(docked ? 'sailHint' : 'sail'))}">${icon('stat_sails', '', 'ico-sm')}${esc(L('sail'))}</button>`;
  const rows = [
    ...self.quests.map((q) => `<div class="w-row q-row q-taken" data-hint="${esc(qtext(q.kind, q.text))}">${icon('goal', '', 'w-row-ico')}<span class="w-row-t"><b>${esc(qtext(q.kind, q.name))}</b><small>${q.step}/${q.steps}: ${esc(qtext(q.kind, q.text))}${q.need > 1 ? ` (${q.progress}/${q.need})` : ''}</small></span>
      <span class="w-row-b">${q.target ? sail(`q:${q.id}`) : ''}${q.kind === 'campaign' ? '' : `<button type="button" class="k-btn k-btn--secondary k-btn--md" data-act="quest_abandon" data-id="${esc(q.id)}">${esc(L('setAside'))}</button>`}</span></div>`),
    ...self.contracts.map((c) => `<div class="w-row q-row q-taken" data-hint="${esc(serverText(c.description))}">${icon(contractArt(c), '', 'w-row-ico')}<span class="w-row-t"><b>${esc(serverText(c.title))}</b><small>${esc(c.kind === 'bounty' ? `${c.progress ?? 0}/${c.kills}` : W('q.to', { port: placeName(port(c.toPort)?.name ?? '') }))}</small></span><span class="w-row-n">${money(c.reward)}</span>
      <span class="w-row-b">${c.toPort ? sail(`c:${c.id}`) : ''}<button type="button" class="k-btn k-btn--secondary k-btn--md" data-act="contract" data-mode="abandon" data-id="${esc(c.id)}">${esc(L('abandon'))}</button></span></div>`),
  ].join('');
  return rows ? `<p class="muted q-count">${esc(L('takenCount', { n: self.quests.length + self.contracts.length }))}</p><div class="mk-list">${rows}</div>` : `<p class="muted">${esc(L('takenNone'))}</p>`;
}

/** The extra cards of a switch the port draws itself (the Admiralty's board, the runs, the wanted; the day's orders and
 *  goals; a power's service). */
export interface BoardExtras {
  /** The Admiralty's board (a great harbour, a captain of the cap): at the head of «Все» and «Контракты». */
  adm: string;
  contracts: string;
  daily: string;
  service: string;
}

/** The switches' row (over the page, outside its pager: it stays as the pages turn). */
export function boardSwitches(view: PortView, state: ClientState, chip: BoardChip): string {
  return `<div class="q-seg">${chipRow(boardChips(boardItems(view, state), state, view), chip, 'qchip')}</div>`;
}

/** The switch's cards. */
export function boardHtml(view: PortView, state: ClientState, chip: BoardChip, extras: BoardExtras): string {
  const items = boardItems(view, state);
  const mine = state.self ? shipLevelOf(state.self.loadout) : 1;
  const list = (xs: BoardItem[]) => (xs.length ? `<div class="mk-list q-list">${xs.map((x) => row(x, state, mine)).join('')}</div>` : '');
  let body = '';
  switch (chip) {
    case 'all':
    case 'jobs':
    case 'side':
    case 'urgent':
      body = list(itemsOf(items, chip)) || `<p class="muted">${esc(L('noneHere'))}</p>`;
      if (chip === 'all') body = `${extras.adm}${body}`;
      break;
    case 'contracts':
      body = `${extras.adm}${list(itemsOf(items, 'contracts'))}${extras.contracts}` || `<p class="muted">${esc(L('noneHere'))}</p>`;
      break;
    case 'daily':
      body = extras.daily || `<p class="muted">${esc(L('noneHere'))}</p>`;
      break;
    case 'guild':
      body = `${guildCard(state)}${extras.service}`;
      break;
    case 'mine':
      body = takenList(state);
      break;
  }
  return `<div class="q-page" data-chip="${chip}">${body}</div>`;
}
