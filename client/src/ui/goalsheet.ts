// «Цели и вести» at sea (owner, 2026-10-17: «в море нажимая на "цели и вести" не отображаются квесты которые берутся, и
// поручения. причем нужно сперва показывать вверху основные цели кампании»). The sheet only ever lent the HUD's folded
// blocks (hud.ts TOUCH_FOLDED: the hint, the trade, the sea's goal, the captain's goals, the news), and none of them is
// the quests taken, the port's contracts or the day's orders — so those were never there. Now, in this order:
//   (a) on top, always in sight: the main campaign (docs/36) — its quest under way with its step and «Плыть», or the one
//       to take (both ways at a branch) with «Взять», or why it waits; the chapter, the quest in it, «N/720»;
//   (b) the quests and the port's contracts taken — the side stories («Побочное») and the jobs («Поручение»), each
//       tagged by the one taxonomy (shared/src/data/questclass.ts, owner: «сети мики числится как побочное») — with
//       progress and «Плыть» (the run to the goal, {t:'goto', key});
//   (c) the day's orders with progress;
//   (d) the sea's goals, the week, the trade, the captain's goals and the news — the lent blocks, as before.

import { dailyText } from '../../../shared/src/data/dailies.ts';
import type { DailyKind } from '../../../shared/src/data/dailies.ts';
import type { QuestKind } from '../../../shared/src/data/questclass.ts';
import type { CampaignView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/goalsheet.ts';
import { cmpText, serverText } from '../lang/server.ts';
import { esc, icon, money } from './dom.ts';
import { classWord, questClass } from './questclass.ts';
import type { QuestAct } from '../../../shared/src/data/questact.ts';
import { actButton, hereAct } from './questact.ts'; // owner, 2026-10-23: a step done in this port has its own button
import type { QuestClass } from './questclass.ts';

const L = dict(EN, RU);

/** What the sheet reads of the captain (PrivateState's part, or a test's). */
export interface GoalSelf {
  quests: { id: string; name: string; kind: QuestKind; step: number; steps: number; text: string; progress: number; need: number; act?: QuestAct }[];
  /** The port she lies in (a step done there shows its verb instead of «Плыть»). */
  dockedAt?: string | null;
  /** She lies off her own island, or in a harbour by it: a step done on the island shows «Строить» (questact.ts). */
  nearIsle?: boolean;
  contracts?: { id: string; kind: 'delivery' | 'bounty' | 'courier'; title: string; toPort?: string; good?: string; kills?: number; progress?: number; reward: number; expiresAt: number }[];
  daily?: { orders: { kind: DailyKind; need: number; progress: number; done: boolean; silver: number }[]; streak: number; chest: boolean; chestSilver: number };
  campaign?: CampaignView;
}

/** One line of the sheet. `key` is the goal's (goalroute.ts GOAL_KEYS): `q:` a quest, `c:` a contract, `d:` an order. */
export interface GoalLine {
  key: string;
  /** Its class (the one taxonomy), a contract or a day's order. */
  kind: QuestClass | 'contract' | 'daily';
  /** The quest's own kind (its picture). */
  qkind?: QuestKind;
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
  /** A quest's step done in the port she lies in: its verb button instead of «Плыть». */
  here?: QuestAct;
}

/** The campaign's block: the quest under way, or the ways to take now, and where she stands in it. */
export interface CampaignBlock {
  /** Its quest under way (a line with «Плыть»). */
  line: GoalLine | null;
  /** The ways to take now (one; two at a branch), when none is under way. */
  take: { id: string; name: string; label?: string; text: string }[];
  /** Why the next waits (server words: «Level 12»), or null. */
  blocked: string | null;
  /** A fork: its two ways are hers to choose (the only choice the campaign asks). */
  fork: boolean;
  ch: number;
  k: number;
  size: number;
  at: number;
  total: number;
  done: boolean;
}

export interface GoalSheetView {
  campaign: CampaignBlock | null;
  active: GoalLine[];
  daily: GoalLine[];
  chest: { open: boolean; silver: number; streak: number } | null;
}

/** The sheet's lines: the campaign first, then the quests and contracts taken, then the day's orders. */
export function goalSheetView(self: GoalSelf | null | undefined): GoalSheetView {
  const quests = self?.quests ?? [];
  const line = (q: GoalSelf['quests'][number]): GoalLine => ({ key: `q:${q.id}`, kind: questClass(q), qkind: q.kind, title: q.name, text: q.text, step: q.step, steps: q.steps, progress: q.progress, need: q.need, done: false, ...((a) => (a ? { here: a } : {}))(hereAct(q, self?.dockedAt, !!self?.nearIsle)) });
  const c = self?.campaign;
  const mine = quests.find((q) => questClass(q) === 'campaign');
  const campaign: CampaignBlock | null = c
    ? {
      line: mine ? line(mine) : null,
      // (owner, 2026-10-18: the campaign is never taken — it goes on by itself; only a fork's two ways are hers to choose)
      take: mine || c.done ? [] : (c.ways ?? []).map((w) => ({ id: w.id, name: w.name, ...(w.label ? { label: w.label } : {}), text: w.steps[0] ?? '' })),
      fork: !mine && (c.ways?.length ?? 0) > 1,
      blocked: mine ? null : c.blocked ?? null,
      ch: c.ch, k: c.k, size: c.size, at: c.at, total: c.total, done: c.done,
    }
    : mine ? { line: line(mine), take: [], blocked: null, fork: false, ch: 1, k: 0, size: 1, at: 0, total: 1, done: false } : null;
  const contracts = [...(self?.contracts ?? [])].sort((a, b) => a.expiresAt - b.expiresAt).map((c): GoalLine => ({
    key: `c:${c.id}`, kind: 'contract', title: c.title, text: '', progress: c.progress ?? 0, need: c.kind === 'bounty' ? c.kills ?? 1 : 0, done: false, silver: c.reward,
    ...(c.toPort ? { toPort: c.toPort } : {}), ...(c.good ? { good: c.good } : {}), ...(c.kind === 'bounty' ? { bounty: true } : {}),
  }));
  const active = [...quests.filter((q) => questClass(q) !== 'campaign').map(line), ...contracts];
  const d = self?.daily;
  const daily = (d?.orders ?? []).map((o): GoalLine => ({ key: `d:${o.kind}`, kind: 'daily', title: o.kind, text: '', progress: o.progress, need: o.need, done: o.done, silver: o.silver }));
  return { campaign, active, daily, chest: d && d.orders.length ? { open: d.chest, silver: d.chestSilver, streak: d.streak } : null };
}

const KIND_ICON: Record<QuestKind, string> = { path: 'tab_legends', legend: 'tab_legends', story: 'tab_letters', job: 'goal', campaign: 'tab_legends' };

function bar(progress: number, need: number, done: boolean): string {
  if (need <= 1 && !done) return '';
  const pct = done ? 100 : Math.min(100, (progress / Math.max(1, need)) * 100);
  return `<span class="gs-bar${done ? ' done' : ''}" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span>`;
}

const sailBtn = (key: string) => `<button type="button" class="btn btn-small btn-primary gs-sail" data-gsail="${esc(key)}" title="${esc(L('sailHint'))}">${icon('stat_sails', '', 'ico-sm')}<span>${esc(L('sail'))}</span></button>`;

function row(x: GoalLine, portName: (id: string) => string, where = ''): string {
  const ru = lang() === 'ru' ? 1 : 0;
  let title: string, sub: string, art = x.qkind ? KIND_ICON[x.qkind] : 'goal';
  if (x.kind === 'daily') {
    title = dailyText(x.title as DailyKind, x.need, ru);
    sub = x.done ? L('doneMark') : `${x.progress}/${x.need}`;
  } else if (x.kind === 'contract') {
    title = serverText(x.title);
    sub = x.bounty ? L('sunk', { n: x.progress, need: x.need }) : x.toPort ? L('to', { port: portName(x.toPort) }) : '';
    art = x.bounty ? 'wanted' : x.good ? `good_${x.good}` : 'map_contract';
  } else {
    const tr = x.kind === 'campaign' ? cmpText : serverText; // (the campaign's words: never English while they load)
    title = tr(x.title);
    const steps = (x.steps ?? 1) > 1 ? `${L('step', { n: x.step ?? 1, of: x.steps ?? 1 })} · ` : '';
    sub = `${where}${steps}${tr(x.text)}${x.need > 1 ? ` (${x.progress}/${x.need})` : ''}`;
  }
  const tag = x.kind === 'daily' ? '' : `<em class="gs-kind gs-k-${x.kind}">${esc(classWord(x.kind))}</em>`;
  const pay = `<span class="gs-pay">${x.silver ? money(x.silver) : ''}</span>`;
  const sail = x.done ? '<span class="gs-done" aria-hidden="true">✓</span>' : x.here ? actButton(x.key.slice(2), x.here, 'btn btn-small btn-primary gs-sail') : sailBtn(x.key);
  return `<div class="gs-row gs-${x.kind}${x.done ? ' done' : ''}" data-gkey="${esc(x.key)}">${icon(art, '◆', 'gs-ico')}<span class="gs-t"><b>${tag}${esc(title)}</b><small>${esc(sub)}</small>${bar(x.progress, x.need, x.done)}</span>${pay}${sail}</div>`;
}

function section(cls: string, title: string, art: string, body: string, aside = ''): string {
  return `<section class="gs-sec ${cls}"><h3 class="gs-h">${icon(art, '', 'ico-sm')}<span>${esc(title)}</span>${aside ? `<small class="gs-aside">${esc(aside)}</small>` : ''}</h3>${body}</section>`;
}

const empty = (k: 'campaignNone' | 'activeNone' | 'dailyNone') => `<p class="muted gs-empty">${esc(L(k))}</p>`;

/** «Глава 3 · задание 5 из 19»: where the quest stands in its chapter. */
export function chapterWords(ch: number, k: number, size: number): string {
  return L('where', { ch, n: k + 1, of: size });
}

/** The campaign's block (always in sight on top). */
export function campaignHtml(v: GoalSheetView, portName: (id: string) => string): string {
  const c = v.campaign;
  if (!c) return section('gs-campaign', L('campaign'), 'tab_legends', empty('campaignNone'));
  const where = `${chapterWords(c.ch, c.k, c.size)} · `;
  let body = '';
  if (c.done) body = `<p class="gs-empty gs-cdone">${esc(L('campaignDone'))}</p>`;
  else if (c.line) body = row(c.line, portName, where);
  else body = c.take.map((t) => {
    // the next with its level to come («следующее с уровня N»), a fork's way to choose, or one on its way in
    const btn = c.blocked
      ? `<span class="gs-wait">${esc(L('nextAt', { n: Number(/\d+/.exec(c.blocked)?.[0] ?? 0) }))}</span>`
      : c.fork ? `<button type="button" class="btn btn-small btn-primary gs-take" data-gtake="${esc(t.id)}">${esc(L('choose'))}</button>` : '';
    const label = t.label ? `${cmpText(t.label)}: ` : '';
    return `<div class="gs-row gs-campaign-take" data-gkey="q:${esc(t.id)}">${icon('tab_legends', '◆', 'gs-ico')}<span class="gs-t"><b><em class="gs-kind gs-k-campaign">${esc(classWord('campaign'))}</em>${esc(label + cmpText(t.name))}</b><small>${esc(where + cmpText(t.text))}</small></span><span class="gs-pay"></span>${btn}</div>`;
  }).join('') || empty('campaignNone');
  const pct = Math.min(100, (c.at / Math.max(1, c.total)) * 100);
  const foot = `<p class="gs-foot gs-cprog"><span>${esc(L('progress', { n: c.at, of: c.total }))}</span><span class="gs-bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span></p>`;
  return section('gs-campaign', L('campaign'), 'tab_legends', body + foot, `${c.at}/${c.total}`);
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

/** How many lines the counter adds for her: the campaign's quest (under way, or to take now), the quests and contracts
 *  taken, the orders not yet done. */
export function goalCount(v: GoalSheetView): number {
  const c = v.campaign;
  const cmp = c && !c.done && (c.line || (c.fork && !c.blocked)) ? 1 : 0;
  return cmp + v.active.length + v.daily.filter((x) => !x.done).length;
}
