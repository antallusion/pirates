// «Цели и вести» at sea (owner, 2026-10-17: «в море нажимая на "цели и вести" не отображаются квесты которые берутся, и
// поручения. причем нужно сперва показывать вверху основные цели кампании»). The sheet only ever lent the HUD's folded
// blocks (hud.ts TOUCH_FOLDED: the hint, the trade, the sea's goal, the captain's goals, the news), and none of them is
// the quests taken, the port's contracts or the day's orders — so those were never there. Now, in this order:
//   (a) on top, always in sight: the campaign — the Path, the Legend, the story's chapters under way, step and progress;
//   (b) the quests and the port's contracts taken, with progress and «Плыть» (the run to the goal, {t:'goto', key});
//   (c) the day's orders with progress;
//   (d) the sea's goals, the week, the trade, the captain's goals and the news — the lent blocks, as before.

import { dailyText } from '../../../shared/src/data/dailies.ts';
import type { DailyKind } from '../../../shared/src/data/dailies.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/goalsheet.ts';
import { serverText } from '../lang/server.ts';
import { esc, icon, money } from './dom.ts';

const L = dict(EN, RU);

type QuestKind = 'path' | 'legend' | 'story' | 'job';

/** What the sheet reads of the captain (PrivateState's part, or a test's). */
export interface GoalSelf {
  quests: { id: string; name: string; kind: QuestKind; step: number; steps: number; text: string; progress: number; need: number }[];
  contracts?: { id: string; kind: 'delivery' | 'bounty' | 'courier'; title: string; toPort?: string; good?: string; kills?: number; progress?: number; reward: number; expiresAt: number }[];
  daily?: { orders: { kind: DailyKind; need: number; progress: number; done: boolean; silver: number }[]; streak: number; chest: boolean; chestSilver: number };
}

/** One line of the sheet. `key` is the goal's (goalroute.ts GOAL_KEYS): `q:` a quest, `c:` a contract, `d:` an order. */
export interface GoalLine {
  key: string;
  kind: QuestKind | 'side' | 'contract' | 'daily';
  /** An arc's chapter (of three). */
  chapter?: number;
  /** Server words (a quest's name and step, a contract's title) or, for an order, its kind. */
  title: string;
  text: string;
  step?: number;
  steps?: number;
  progress: number;
  need: number;
  done: boolean;
  silver?: number;
  /** A contract's port to reach, a delivery's good (its picture). */
  toPort?: string;
  good?: string;
  bounty?: boolean;
}

export interface GoalSheetView {
  campaign: GoalLine[];
  active: GoalLine[];
  daily: GoalLine[];
  chest: { open: boolean; silver: number; streak: number } | null;
}

/** The campaign's order: the captain's Path, a Legend, then the story's chapters. */
const CAMPAIGN: Record<QuestKind, number> = { path: 0, legend: 1, story: 2, job: 9 };

/** A port's side quest (shared/src/data/sidequests.ts, `side_…`): a story of its own, not the campaign's. */
const isSide = (q: { id: string; kind: QuestKind }): boolean => q.kind === 'story' && q.id.startsWith('side_');

/** The campaign: the Paths, the Legends, the main story and the regions' arcs (questarcs.ts, `a_<region>_<arc>_<n>`). */
export const inCampaign = (q: { id: string; kind: QuestKind }): boolean => q.kind !== 'job' && !isSide(q);

/** An arc's chapter, from its id. */
const chapterOf = (id: string): number | null => {
  const m = /^a_.+_(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
};

/** The sheet's lines: the campaign first, then the quests and contracts taken, then the day's orders. */
export function goalSheetView(self: GoalSelf | null | undefined): GoalSheetView {
  const quests = self?.quests ?? [];
  const line = (q: GoalSelf['quests'][number]): GoalLine => ({ key: `q:${q.id}`, kind: isSide(q) ? 'side' : q.kind, title: q.name, text: q.text, step: q.step, steps: q.steps, progress: q.progress, need: q.need, done: false, ...(chapterOf(q.id) ? { chapter: chapterOf(q.id)! } : {}) });
  const campaign = quests.filter(inCampaign).sort((a, b) => CAMPAIGN[a.kind] - CAMPAIGN[b.kind]).map(line);
  const contracts = [...(self?.contracts ?? [])].sort((a, b) => a.expiresAt - b.expiresAt).map((c): GoalLine => ({
    key: `c:${c.id}`, kind: 'contract', title: c.title, text: '', progress: c.progress ?? 0, need: c.kind === 'bounty' ? c.kills ?? 1 : 0, done: false, silver: c.reward,
    ...(c.toPort ? { toPort: c.toPort } : {}), ...(c.good ? { good: c.good } : {}), ...(c.kind === 'bounty' ? { bounty: true } : {}),
  }));
  const active = [...quests.filter((q) => !inCampaign(q)).map(line), ...contracts];
  const d = self?.daily;
  const daily = (d?.orders ?? []).map((o): GoalLine => ({ key: `d:${o.kind}`, kind: 'daily', title: o.kind, text: '', progress: o.progress, need: o.need, done: o.done, silver: o.silver }));
  return { campaign, active, daily, chest: d && d.orders.length ? { open: d.chest, silver: d.chestSilver, streak: d.streak } : null };
}

const KIND_ICON: Record<GoalLine['kind'], string> = { path: 'tab_legends', legend: 'tab_legends', story: 'tab_letters', side: 'tab_letters', job: 'goal', contract: 'map_contract', daily: 'goal' };

function bar(progress: number, need: number, done: boolean): string {
  if (need <= 1 && !done) return '';
  const pct = done ? 100 : Math.min(100, (progress / Math.max(1, need)) * 100);
  return `<span class="gs-bar${done ? ' done' : ''}" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span>`;
}

function row(x: GoalLine, portName: (id: string) => string): string {
  const ru = lang() === 'ru' ? 1 : 0;
  let title: string, sub: string, art = KIND_ICON[x.kind];
  if (x.kind === 'daily') {
    title = dailyText(x.title as DailyKind, x.need, ru);
    sub = x.done ? L('doneMark') : `${x.progress}/${x.need}`;
  } else if (x.kind === 'contract') {
    title = serverText(x.title);
    sub = x.bounty ? L('sunk', { n: x.progress, need: x.need }) : x.toPort ? L('to', { port: portName(x.toPort) }) : '';
    if (x.bounty) art = 'wanted';
    else if (x.good) art = `good_${x.good}`;
  } else {
    title = serverText(x.title);
    const steps = (x.steps ?? 1) > 1 ? `${L('step', { n: (x.step ?? 0) + 1, of: x.steps ?? 1 })} · ` : '';
    const ch = x.chapter ? `${L('chapter', { n: x.chapter })} · ` : '';
    sub = `${ch}${steps}${serverText(x.text)}${x.need > 1 ? ` (${x.progress}/${x.need})` : ''}`;
  }
  const tag = x.kind === 'daily' ? '' : `<em class="gs-kind">${esc(L(`k.${x.kind}` as 'k.job'))}</em>`;
  const pay = `<span class="gs-pay">${x.silver ? money(x.silver) : ''}</span>`;
  const sail = x.done ? '<span class="gs-done" aria-hidden="true">✓</span>' : `<button type="button" class="btn btn-small btn-primary gs-sail" data-gsail="${esc(x.key)}" title="${esc(L('sailHint'))}">${icon('stat_sails', '', 'ico-sm')}<span>${esc(L('sail'))}</span></button>`;
  return `<div class="gs-row gs-${x.kind}${x.done ? ' done' : ''}" data-gkey="${esc(x.key)}">${icon(art, '◆', 'gs-ico')}<span class="gs-t"><b>${tag}${esc(title)}</b><small>${esc(sub)}</small>${bar(x.progress, x.need, x.done)}</span>${pay}${sail}</div>`;
}

function section(cls: string, title: string, art: string, body: string): string {
  return `<section class="gs-sec ${cls}"><h3 class="gs-h">${icon(art, '', 'ico-sm')}<span>${esc(title)}</span></h3>${body}</section>`;
}

const empty = (k: 'campaignNone' | 'activeNone' | 'dailyNone') => `<p class="muted gs-empty">${esc(L(k))}</p>`;

/** The campaign's block (always in sight on top). */
export function campaignHtml(v: GoalSheetView, portName: (id: string) => string): string {
  return section('gs-campaign', L('campaign'), 'tab_legends', v.campaign.length ? v.campaign.map((x) => row(x, portName)).join('') : empty('campaignNone'));
}

/** The quests and contracts taken, and the day's orders (the scrolling part above the lent blocks). */
export function goalsListHtml(v: GoalSheetView, portName: (id: string) => string): string {
  const chest = v.chest ? `<p class="gs-foot muted">${v.chest.open ? esc(L('opened')) : esc(L('chest', { silver: '§' })).replace('§', money(v.chest.silver))}</p>` : '';
  return section('gs-active', L('active'), 'tab_contracts', v.active.length ? v.active.map((x) => row(x, portName)).join('') : empty('activeNone'))
    + section('gs-daily', L('daily'), 'tab_letters', v.daily.length ? v.daily.map((x) => row(x, portName)).join('') + chest : empty('dailyNone'));
}

/** The heading over the lent blocks (the sea, the week, the trade, the captain's goals, the news). */
export function seaHeadHtml(): string {
  return `<h3 class="gs-h gs-seah">${icon('tab_board', '', 'ico-sm')}<span>${esc(L('sea'))}</span></h3>`;
}

export const seaNoneText = (): string => L('seaNone');

/** How many lines the counter adds for her: the quests and contracts taken and the orders not yet done. */
export function goalCount(v: GoalSheetView): number {
  return v.campaign.length + v.active.length + v.daily.filter((x) => !x.done).length;
}
