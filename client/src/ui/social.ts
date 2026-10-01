// docs/16 Batch G on screen: the "looking for company" card and its flags on the charts (#31), the sea's goals of
// the week in the HUD, the journal and the chart (#32), the trade window alongside (#33), the guild's shipyard card
// (#34) and the signal flags (#35).

import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { unitIcon, unitName } from './army.ts';
import { EN as DEN, RU as DRU } from '../lang/ui/drifts.ts';
import { GUILD_PROJECTS, GUILD_PROJECT_DEFS, LFG_GOALS, LFG_GOAL_DEFS, SIGNALS, SIGNAL_DEFS, SIGNAL_TTL, TRADE_ITEMS_MAX, WORLD_GOAL_DEFS, parseLfgTag } from '../../../shared/src/data/social.ts';
import type { LfgGoal, SignalKind } from '../../../shared/src/data/social.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import { itemSlot } from '../../../shared/src/data/items.ts';
import type { ClientMsg, GuildYardView, LfgEntry, WorldGoalView } from '../../../shared/src/protocol.ts';
import { GROUP_MAX } from '../../../shared/src/protocol.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/social.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { esc, fmt, icon, money, pct } from './dom.ts';
import { coloured, itemCardHtml, itemIcon } from './gear.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);
const DL = dict(DEN, DRU);
const ru = () => (lang() === 'ru' ? 1 : 0);
const goodName = (g: GoodId) => serverText(GOODS[g]?.name ?? g);

export const goalName = (g: LfgGoal) => LFG_GOAL_DEFS[g].name[ru()];
export const signalName = (k: SignalKind) => SIGNAL_DEFS[k].name[ru()];

/** The line a posting's flag carries over the ship and on the charts: "Hunting · lv 4–9". */
export function lfgLabel(tag: string | undefined | null): string | null {
  const p = parseLfgTag(tag);
  return p ? `${goalName(p.goal)} · ${L('lf_lv', { lo: p.lo, hi: p.hi })}` : null;
}

function distText(state: ClientState, x: number, y: number): string {
  const own = state.ownDisplay;
  if (!own) return '';
  const d = Math.hypot(x - own.x, y - own.y);
  if (d < 200) return L('sg_near');
  const deg = (Math.atan2(x - own.x, -(y - own.y)) * 180) / Math.PI;
  const pts = ru() ? ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'] : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const dir = pts[Math.round(((deg + 360) % 360) / 45) % 8];
  const km = d < 1000 ? `${Math.round(d / 10) * 10} ${L('m')}` : `${(d / 1000).toLocaleString(ru() ? 'ru-RU' : 'en-GB', { maximumFractionDigits: 1 })} ${L('km')}`;
  return `${km} ${dir}`;
}

// ------------------------------------------------------------------ 31. looking for company

function lfgRow(state: ClientState, e: LfgEntry, canAsk: boolean, canInvite: boolean, compact: boolean): string {
  const goal = e.goal ?? 'hunt';
  const def = LFG_GOAL_DEFS[goal];
  const where = e.x !== undefined && e.y !== undefined ? distText(state, e.x, e.y) : placeName(REGIONS[e.region]?.name ?? e.region);
  const meta = [e.lo !== undefined ? L('lf_lv', { lo: e.lo, hi: e.hi ?? e.lo }) : '', e.size && e.size > 1 ? L('lf_aboard', { n: e.size, max: GROUP_MAX }) : '', where].filter(Boolean).join(' · ');
  const btn = canAsk ? (e.fits === false ? `<span class="muted lf-nofit">${esc(L('lf_nofit'))}</span>` : `<button class="btn btn-small btn-primary" data-lf-ask="${esc(e.name)}">${esc(L('lf_ask'))}</button>`)
    : canInvite && (e.size ?? 1) <= 1 ? `<button class="btn btn-small" data-lfg-invite="${esc(e.name)}">${esc(L('lf_invite'))}</button>` : '';
  return `<div class="lfg-row lf-row${e.fits === false ? ' lf-off' : ''}"${e.x !== undefined ? ` data-lf-at="${e.x},${e.y}"` : ''}><span class="lf-flag" style="border-color:${def.color}">${icon(def.icon, '⚑', 'ico-sm')}</span><div class="lf-who"><b>${esc(e.name)}</b> <span class="lf-lvl">${e.level}</span> <span class="lf-goal" style="color:${def.color}">${esc(goalName(goal))}</span><div class="muted lf-meta">${esc(meta)}</div>${e.note && !compact ? `<div class="lfg-note">«${esc(e.note)}»</div>` : ''}</div>${btn}</div>`;
}

/** The goal picked on the card and not yet posted (the card is drawn afresh as the board changes). */
let pickedGoal: LfgGoal | null = null;

/** The Company screen's card: one's own flag (goal, levels, a word) and the board of those looking. */
export function lfgCard(state: ClientState, grouped: boolean, lead: boolean, canInvite: boolean): string {
  const mine = state.lfgGoal;
  const lvl = state.self?.level ?? 1;
  const lo = mine?.lo ?? Math.max(1, lvl - 3), hi = mine?.hi ?? lvl + 3;
  const rows = state.lfg.map((e) => lfgRow(state, e, !grouped, canInvite, false)).join('');
  const form = grouped && !lead ? `<p class="muted">${esc(L('lf_leader_only'))}</p>`
    : `<p class="muted">${esc(L('lf_text'))}</p>
      ${mine ? `<p class="lf-mine">${icon(LFG_GOAL_DEFS[mine.goal].icon, '', 'ico-sm')}${esc(L('lf_mine', { goal: goalName(mine.goal), lo: mine.lo, hi: mine.hi }))}</p>` : ''}
      <div class="lf-goals" role="radiogroup" aria-label="${esc(L('lf_goal'))}">${LFG_GOALS.map((g) => `<button type="button" class="lf-goal-btn${(pickedGoal ?? mine?.goal ?? 'hunt') === g ? ' on' : ''}" data-lf-goal="${g}" aria-pressed="${(pickedGoal ?? mine?.goal ?? 'hunt') === g}">${icon(LFG_GOAL_DEFS[g].icon, '', 'ico-sm')}<span>${esc(goalName(g))}</span></button>`).join('')}</div>
      <div class="row lfg-form lf-form"><label class="lf-lvls">${esc(L('lf_levels'))} <input id="lf-lo" type="number" min="1" max="60" value="${lo}"> – <input id="lf-hi" type="number" min="1" max="60" value="${hi}"></label>
        <input id="lfg-note" placeholder="${esc(L('lf_note_ph'))}" maxlength="80" value="${esc(state.lfgMine ?? '')}"></div>
      <div class="row lf-acts"><button class="btn btn-primary" id="lfg-post">${esc(L(mine ? 'lf_update' : 'lf_post'))}</button>${mine ? `<button class="btn" id="lfg-stop">${esc(L('lf_stop'))}</button>` : ''}</div>`;
  return `<div class="card lf-card"><h4 class="card-h">${icon('tab_group', '', 'ico-md')}${esc(L('lf_title'))}</h4>${form}
    <div class="lfg-list">${rows || `<p class="muted">${esc(L('lf_none'))}</p>`}</div></div>`;
}

/** Wires the card: the goal chosen, the flag hoisted or lowered, asking to join, calling aboard. */
export function wireLfg(body: HTMLElement, send: (m: ClientMsg) => void): void {
  let goal: LfgGoal = (body.querySelector<HTMLElement>('.lf-goal-btn.on')?.dataset.lfGoal as LfgGoal) ?? 'hunt';
  body.querySelectorAll<HTMLElement>('[data-lf-goal]').forEach((b) => (b.onclick = () => {
    goal = b.dataset.lfGoal as LfgGoal;
    pickedGoal = goal;
    body.querySelectorAll<HTMLElement>('[data-lf-goal]').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
  }));
  const num = (id: string) => Number(body.querySelector<HTMLInputElement>(id)?.value);
  body.querySelector<HTMLElement>('#lfg-post')?.addEventListener('click', () => {
    send({ t: 'group', action: 'lfg', note: body.querySelector<HTMLInputElement>('#lfg-note')?.value.trim() ?? '', goal, lo: num('#lf-lo'), hi: num('#lf-hi') });
    pickedGoal = null;
  });
  body.querySelector<HTMLElement>('#lfg-stop')?.addEventListener('click', () => send({ t: 'group', action: 'lfg_clear' }));
  wireLfgRows(body, send);
}

export function wireLfgRows(body: HTMLElement, send: (m: ClientMsg) => void): void {
  body.querySelectorAll<HTMLElement>('[data-lf-ask]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    send({ t: 'group', action: 'ask', name: b.dataset.lfAsk! });
    b.setAttribute('disabled', '');
    b.textContent = L('lf_asked');
  }));
  body.querySelectorAll<HTMLElement>('[data-lfg-invite]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    send({ t: 'group', action: 'invite', name: b.dataset.lfgInvite! });
  }));
}

/** The chart's block: those looking for company, one tap to ask; a row turns the chart to her. */
export function lfgLog(state: ClientState): string {
  const list = state.lfg.filter((e) => e.goal);
  if (!list.length) return '';
  const grouped = (state.party?.members.length ?? 0) > 1;
  return `<div class="map-quests map-lfg"><div class="mq-head">${icon('tab_group', '', 'ico-sm')}${esc(L('lf_title'))}</div>${list.slice(0, 6).map((e) => lfgRow(state, e, !grouped, false, true)).join('')}</div>`;
}

/** The chart's key for the pennants of company and the signal flags. */
export function socialLegend(): string {
  return `<span><b style="color:${LFG_GOAL_DEFS.hunt.color};font-weight:400">⚑</b>&nbsp;${esc(L('lf_legend'))}</span><span><b style="color:${SIGNAL_DEFS.help.color};font-weight:400">⚑</b>&nbsp;${esc(L('sg_legend'))}</span>`;
}

/** An answer card for a captain who asked to join (the leader's side). */
export function askCard(i: { id: number; from: string }): string {
  return `<div class="card lf-askcard"><h4 class="card-h">${icon('tab_group', '', 'ico-md')}${esc(L('lf_asks', { name: i.from }))}</h4><button class="btn btn-primary" data-accept="${i.id}">${esc(L('lf_take'))}</button> <button class="btn" data-decline="${i.id}">${esc(L('lf_refuse'))}</button></div>`;
}

// ------------------------------------------------------------------ 32. the sea's goals

export function worldGoalText(g: WorldGoalView): string {
  const port = g.port ? placeName(g.port) : '';
  return WORLD_GOAL_DEFS[g.kind].text[ru()].replace('{n}', fmt(g.target)).replace('{port}', port);
}

function leftText(sec: number): string {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
  return d > 0 ? L('wg_left_d', { d, h }) : L('wg_left_h', { h: Math.max(1, h) });
}

function goalRow(g: WorldGoalView, gone: number): string {
  const f = g.progress / Math.max(1, g.target);
  const mine = g.mine > 0 ? (g.mine >= g.min ? L('wg_mine_ok', { n: fmt(g.mine) }) : L('wg_mine', { n: fmt(g.mine), min: fmt(g.min) })) : L('wg_join', { min: fmt(g.min) });
  return `<div class="wg-row${g.done ? ' done' : ''}">${icon(WORLD_GOAL_DEFS[g.kind].icon, '', 'ico-sm')}<div class="wg-body"><b>${esc(worldGoalText(g))}</b>
    <div class="cm-bar${g.done ? ' done' : ''}"><i style="width:${pct(f)}"></i><span>${fmt(g.progress)}/${fmt(g.target)}</span></div>
    <span class="muted wg-meta">${esc(g.done ? L('wg_done') : leftText(Math.max(0, g.endsIn - gone)))} · ${esc(mine)}${g.hands ? ` · ${esc(L('wg_hands', { n: g.hands }))}` : ''}</span>
    ${g.leaders.length ? `<span class="muted wg-lead">${esc(L('wg_lead', { list: g.leaders.map((x) => `${x.name} (${fmt(x.n)})`).join(', ') }))}</span>` : ''}</div></div>`;
}

/** The journal's and the chart's block. */
export function worldGoalsLog(state: ClientState): string {
  if (!state.worldGoals.length) return '';
  const gone = performance.now() / 1000 - state.worldGoalsAt;
  return `<div class="map-daily wg-log" title="${esc(L('wg_hint'))}"><div class="mq-head">${icon('goal', '', 'ico-sm')}${esc(L('wg_title'))}</div>${state.worldGoals.map((g) => goalRow(g, gone)).join('')}</div>`;
}

/** The HUD's plate: the goal nearest its end, one line and a thin bar (the rest in the journal). */
export function worldGoalPlate(state: ClientState): { key: string; html: string } | null {
  const open = state.worldGoals.filter((g) => !g.done);
  if (!open.length) return null;
  const g = [...open].sort((a, b) => b.progress / b.target - a.progress / a.target)[0];
  const f = g.progress / Math.max(1, g.target);
  const key = `${lang()}|${g.id}|${g.progress}|${g.mine}|${open.length}`;
  const html = `${icon(WORLD_GOAL_DEFS[g.kind].icon, '', 'ico-sm wp-ico')}<span class="wp-body"><span class="wp-top"><b class="wp-lbl">${esc(L('wg_plate'))}</b><span class="wp-t">${esc(worldGoalText(g))}</span><span class="wp-n">${fmt(g.progress)}/${fmt(g.target)}${open.length > 1 ? ` <span class="muted">+${open.length - 1}</span>` : ''}</span></span><span class="fbar wp-bar"><i style="width:${pct(f)}"></i></span></span>`;
  return { key, html };
}

// ------------------------------------------------------------------ 33. the trade window

const listCargo = (c: Cargo) => Object.entries(c).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) => `<div class="barter-row">${icon(`good_${g}`, '', 'item-ico')}<span>${esc(goodName(g as GoodId))}</span><b>×${n}</b></div>`).join('');

/** docs/18 #42: the creatures on the table, by kind. */
const listBeasts = (b: { u: UnitId; n: number }[] | undefined) => (b ?? []).map((x) => `<div class="barter-row">${unitIcon(x.u, 'item-ico')}<span>${esc(unitName(x.u))}</span><b>×${x.n}</b></div>`).join('');

function gearChip(it: Item, pick: boolean, on: boolean): string {
  const inner = `${itemIcon(it, itemSlot(it), 'ico-sm')}${coloured(it)}<span class="muted">${it.ilvl}</span>${it.bound ? `<span class="tr-bound">${esc(L('tr_bound'))}</span>` : ''}`;
  return pick ? `<button type="button" class="tr-gear${on ? ' on' : ''}" data-tr-item="${it.uid}" aria-pressed="${on}"${it.bound ? ' disabled' : ''}>${inner}</button>` : `<details class="tr-gear-in"><summary class="tr-gear on">${inner}</summary>${itemCardHtml(it)}</details>`;
}

export function renderTrade(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const b = state.barter;
  if (!b) return;
  const me = b.me, them = b.them;
  const hold = state.self?.cargo ?? {};
  const stash = state.self?.stash ?? [];
  const offered = new Set((me.items ?? []).map((i) => i.uid));
  const bothLocked = !!me.locked && !!them.locked;
  const range = b.range ?? 300;
  const where = b.atSea ? L('tr_sea', { d: b.dist ?? 0, r: range }) : L('tr_quay');
  const state2 = (s: typeof me) => s.ready ? `<span class="tr-st ok">${esc(L('tr_confirmed'))}</span>` : s.locked ? `<span class="tr-st lock">${esc(L('tr_locked'))}</span>` : `<span class="tr-st">${esc(L('tr_open'))}</span>`;
  const far = b.atSea && (b.dist ?? 0) > range * 0.8;
  const subText = `${where}${b.transfer ? ` · ${L('tr_boats', { n: b.transfer })}` : ''}`;
  // The distance and the boats' clock change every other second: only that line is rewritten, so a finger on a
  // button is never lost to a fresh table.
  const key = JSON.stringify([lang(), me, them, b.rev, b.atSea, stash.map((i) => i.uid), Object.entries(hold)]);
  const sub = root.querySelector<HTMLElement>('.tr-where');
  if (sub && root.dataset.trKey === key) {
    sub.textContent = subText;
    sub.classList.toggle('tr-far', far);
    return;
  }
  root.dataset.trKey = key;
  // The pieces picked but not yet put on the table survive a fresh table.
  const picked = new Set([...root.querySelectorAll<HTMLElement>('[data-tr-item].on')].map((el) => Number(el.dataset.trItem)));
  const beasts = (state.self?.company.army ?? []).filter((x) => UNITS[x.u]?.beast && !UNITS[x.u].legend);
  const beastRows = beasts.length ? `<div class="tr-sub">${esc(DL('barter'))}</div>${beasts.map((x) => `<div class="barter-row">${unitIcon(x.u, 'item-ico')}<span>${esc(unitName(x.u))} <span class="muted">(${x.n})</span></span><input class="field" type="number" min="0" max="${x.n}" value="${(me.beasts ?? []).find((y) => y.u === x.u)?.n ?? 0}" data-give-beast="${x.u}"></div>`).join('')}` : '';
  const mineBody = me.locked
    ? `<div class="barter-row">${icon('coin', '', 'item-ico')}<span>${esc(L('tr_silver'))}</span><b>${money(me.gold)}</b></div>${listCargo(me.cargo)}${listBeasts(me.beasts)}${(me.items ?? []).map((it) => gearChip(it, false, true)).join('')}${!me.gold && !Object.keys(me.cargo).length && !(me.items ?? []).length ? `<p class="muted">${esc(L('tr_nothing'))}</p>` : ''}`
    : `<div class="barter-row">${icon('coin', '', 'item-ico')}<span>${esc(L('tr_silver'))}</span><input id="b-gold" class="field" type="number" min="0" value="${me.gold}"></div>
      ${Object.entries(hold).filter(([, n]) => (n ?? 0) >= 1).map(([g, n]) => `<div class="barter-row">${icon(`good_${g}`, '', 'item-ico')}<span>${esc(goodName(g as GoodId))} <span class="muted">(${fmt(Math.floor(n ?? 0))})</span></span><input class="field" type="number" min="0" max="${Math.floor(n ?? 0)}" value="${me.cargo[g as GoodId] ?? 0}" data-give="${g}"></div>`).join('')}
      ${beastRows}
      <div class="tr-sub">${esc(L('tr_gear', { n: TRADE_ITEMS_MAX }))}</div>
      <div class="tr-gears">${stash.length ? stash.map((it) => gearChip(it, true, offered.has(it.uid) || picked.has(it.uid))).join('') : `<p class="muted">${esc(L('tr_no_gear'))}</p>`}</div>
      <button class="btn btn-block" id="b-offer">${esc(L('tr_set'))}</button>`;
  const theirs = `<div class="barter-row">${icon('coin', '', 'item-ico')}<span>${esc(L('tr_silver'))}</span><b>${money(them.gold)}</b></div>${listCargo(them.cargo)}${listBeasts(them.beasts)}${(them.items ?? []).map((it) => gearChip(it, false, true)).join('')}${!them.gold && !Object.keys(them.cargo).length && !(them.items ?? []).length && !(them.beasts ?? []).length ? `<p class="muted">${esc(L('tr_nothing'))}</p>` : ''}`;
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('tr_title', { name: them.name }))}</h2><div class="sub tr-where${far ? ' tr-far' : ''}">${esc(subText)}</div></div></div>
    <div class="modal-body tr-body"><div class="cols tr-cols"><div>
      <h3 class="title-sm tr-h">${esc(L('tr_you'))} ${state2(me)}</h3>
      <div class="card tr-card${me.locked ? ' locked' : ''}">${mineBody}</div>
    </div><div>
      <h3 class="title-sm tr-h">${esc(L('tr_them', { name: them.name }))} ${state2(them)}</h3>
      <div class="card tr-card${them.locked ? ' locked' : ''}">${theirs}</div>
    </div></div>
    <p class="muted tr-steps">${esc(L('tr_steps'))}</p>
    <div class="tr-acts">${me.locked ? `<button class="btn" id="b-unlock">${esc(L('tr_unlock'))}</button>` : `<button class="btn" id="b-lock">${esc(L('tr_lock'))}</button>`}<button class="btn btn-primary" id="b-ready" ${!bothLocked || me.ready ? 'disabled' : ''}>${esc(L('tr_confirm'))}</button><button class="btn btn-danger" id="b-cancel">${esc(L('tr_cancel'))}</button></div>
    <p class="muted tr-note">${esc(L('tr_note', { r: range }))}</p></div>`;
  const offer = () => {
    const cargo: Cargo = {};
    root.querySelectorAll<HTMLInputElement>('[data-give]').forEach((el) => {
      const n = Math.floor(Number(el.value));
      if (n > 0) cargo[el.dataset.give as GoodId] = n;
    });
    const items = [...root.querySelectorAll<HTMLElement>('[data-tr-item].on')].map((el) => Number(el.dataset.trItem));
    const kin: { u: UnitId; n: number }[] = [];
    root.querySelectorAll<HTMLInputElement>('[data-give-beast]').forEach((el) => {
      const n = Math.floor(Number(el.value));
      if (n > 0) kin.push({ u: el.dataset.giveBeast as UnitId, n });
    });
    send({ t: 'barter', action: 'offer', gold: Math.floor(Number(root.querySelector<HTMLInputElement>('#b-gold')?.value) || 0), cargo, items, ...(kin.length ? { beasts: kin } : {}) });
  };
  root.querySelectorAll<HTMLElement>('[data-tr-item]').forEach((el) => (el.onclick = () => {
    const on = !el.classList.contains('on');
    if (on && root.querySelectorAll('[data-tr-item].on').length >= TRADE_ITEMS_MAX) return;
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', String(on));
  }));
  root.querySelector<HTMLElement>('#b-offer')?.addEventListener('click', offer);
  root.querySelector<HTMLElement>('#b-lock')?.addEventListener('click', () => {
    // What is typed is put on the table first, then locked.
    offer();
    send({ t: 'barter', action: 'lock' });
  });
  root.querySelector<HTMLElement>('#b-unlock')?.addEventListener('click', () => send({ t: 'barter', action: 'unlock' }));
  root.querySelector<HTMLElement>('#b-ready')?.addEventListener('click', () => send({ t: 'barter', action: 'ready', rev: b.rev }));
  root.querySelector<HTMLElement>('#b-cancel')?.addEventListener('click', () => send({ t: 'barter', action: 'cancel' }));
}

// ------------------------------------------------------------------ 34. the guild's shipyard

export function guildYardCard(v: GuildYardView | null | undefined): string {
  if (!v) return '';
  const p = v.project;
  const head = `<h4 class="card-h">${icon('build_shipyard', '', 'ico-md')}${esc(L('gy_title'))}</h4>`;
  const where = v.island ? `<p class="muted gy-where">${esc(L('gy_where', { island: placeName(v.island), name: v.leader, n: v.yardLevel }))}</p>` : '';
  if (v.why && !p) return `<div class="card gy-card">${head}${where}<p class="muted">${esc(serverText(v.why))}</p></div>`;
  const done = v.done.length ? `<p class="muted gy-done">${esc(L('gy_done', { list: v.done.map((d) => GUILD_PROJECT_DEFS[d.kind].name[ru()]).join(', ') }))}</p>` : '';
  if (!p) {
    return `<div class="card gy-card">${head}${where}<p class="muted">${esc(L('gy_none'))}</p>
      ${v.canStart ? `<div class="gy-starts">${GUILD_PROJECTS.map((k) => `<button class="btn btn-small" data-gy-start="${k}" title="${esc(GUILD_PROJECT_DEFS[k].text[ru()])}">${esc(L('gy_start', { name: GUILD_PROJECT_DEFS[k].name[ru()] }))}</button>`).join('')}</div>` : ''}${done}</div>`;
  }
  const have = new Map(v.hold.map((h) => [h.good, h.n]));
  const rows = p.goods.map((g) => {
    const left = Math.max(0, g.need - g.have), mine = have.get(g.good) ?? 0;
    const can = left > 0 && mine > 0;
    return `<div class="gy-row">${icon(`good_${g.good}`, '', 'item-ico')}<span class="gy-g">${esc(goodName(g.good))}</span><span class="fbar gy-bar"><i style="width:${pct(g.have / Math.max(1, g.need))}"></i></span><b class="gy-n">${fmt(g.have)}/${fmt(g.need)}</b>${can ? `<button class="btn btn-small" data-gy-good="${g.good}" data-gy-qty="${Math.min(left, mine)}" title="${esc(L('gy_give_n', { n: Math.min(left, mine) }))}">+${fmt(Math.min(left, mine))}</button>` : '<span class="gy-sp"></span>'}</div>`;
  }).join('');
  const sLeft = Math.max(0, p.silver.need - p.silver.have);
  const silver = `<div class="gy-row">${icon('coin', '', 'item-ico')}<span class="gy-g">${esc(L('gy_silver'))}</span><span class="fbar gy-bar"><i style="width:${pct(p.silver.have / Math.max(1, p.silver.need))}"></i></span><b class="gy-n">${fmt(p.silver.have)}/${fmt(p.silver.need)}</b>${sLeft > 0 ? `<button class="btn btn-small" data-gy-silver="${Math.min(sLeft, 1000)}">+${fmt(Math.min(sLeft, 1000))}</button>` : '<span class="gy-sp"></span>'}</div>`;
  const hands = p.hands.length ? `<ol class="gy-hands">${p.hands.slice(0, 8).map((h) => `<li><span>${esc(h.name)}</span><b>${esc(L('gy_units', { n: fmt(h.units) }))}</b>${h.builder ? `<i class="gy-bld">${esc(L('gy_builder'))}</i>` : ''}</li>`).join('')}</ol>` : `<p class="muted">${esc(L('gy_no_hands'))}</p>`;
  return `<div class="card gy-card">${head}${where}
    <div class="gy-proj"><b>${esc(GUILD_PROJECT_DEFS[p.kind].name[ru()])}</b><span class="muted">${esc(GUILD_PROJECT_DEFS[p.kind].text[ru()])}</span></div>
    <div class="gy-total"><span class="fbar gy-tbar"><i style="width:${pct(p.pct)}"></i></span><b>${esc(L('gy_progress', { pct: Math.floor(p.pct * 100) }))}</b></div>
    ${rows}${silver}
    <p class="muted gy-hint">${esc(v.near ? L('gy_near') : L('gy_far', { island: placeName(v.island ?? '') }))}</p>
    <div class="mq-head">${esc(L('gy_hands'))}${p.mine ? ` · ${esc(L('gy_mine', { n: fmt(p.mine) }))}` : ''}</div>${hands}
    ${done}</div>`;
}

export function wireGuildYard(root: HTMLElement, send: (m: ClientMsg) => void): void {
  root.querySelectorAll<HTMLElement>('[data-gy-start]').forEach((b) => (b.onclick = () => send({ t: 'gyard', action: 'start', kind: b.dataset.gyStart as 'ship' })));
  root.querySelectorAll<HTMLElement>('[data-gy-good]').forEach((b) => (b.onclick = () => send({ t: 'gyard', action: 'give', good: b.dataset.gyGood as GoodId, qty: Number(b.dataset.gyQty) })));
  root.querySelectorAll<HTMLElement>('[data-gy-silver]').forEach((b) => (b.onclick = () => send({ t: 'gyard', action: 'give', silver: Number(b.dataset.gySilver) })));
}

// ------------------------------------------------------------------ 35. signal flags

/** The HUD's row of flags for a captain in a group at sea: five buttons, a finger wide. */
export function signalBar(): string {
  return `<span class="sg-lbl">${icon('talent_cmd_signal_flags', '⚑', 'ico-sm')}</span>${SIGNALS.map((k) => `<button class="sg-btn" data-signal="${k}" style="--sg:${SIGNAL_DEFS[k].color}" title="${esc(signalName(k))}" aria-label="${esc(signalName(k))}">${icon(SIGNAL_DEFS[k].icon, '⚑', 'sg-ico')}<span>${esc(L(`sg_${k}` as 'sg_follow'))}</span></button>`).join('')}`;
}

/** A groupmate's flag, as a toast. */
export function signalToast(state: ClientState, m: { from: string; kind: SignalKind; x: number; y: number }): string {
  const own = state.self?.name === m.from;
  return own ? L('sg_you', { signal: signalName(m.kind) }) : L('sg_toast', { name: m.from, signal: signalName(m.kind), where: distText(state, m.x, m.y) });
}

/** The live flags (the rest have had their time). */
export function liveSignals(state: ClientState): { from: string; kind: SignalKind; x: number; y: number; age: number }[] {
  const now = performance.now() / 1000;
  return state.signals.map((s) => ({ ...s, age: now - s.at })).filter((s) => s.age < SIGNAL_TTL);
}

/** A signal's flag on a chart: a pole, a swallow-tailed pennant in the signal's colour, and a ring that pulses out. */
export function drawSignalFlag(g: CanvasRenderingContext2D, x: number, y: number, kind: SignalKind, age: number, size = 1): void {
  const col = SIGNAL_DEFS[kind].color;
  const k = (age % 1.6) / 1.6;
  g.save();
  g.globalAlpha = Math.max(0, 1 - age / SIGNAL_TTL) * 0.9 + 0.1;
  g.strokeStyle = col;
  g.lineWidth = 1.5;
  g.globalAlpha *= 1 - k;
  g.beginPath();
  g.arc(x, y, (4 + k * 14) * size, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = Math.max(0.35, 1 - age / SIGNAL_TTL);
  g.fillStyle = '#e8dcc0';
  g.fillRect(x - 0.75 * size, y - 11 * size, 1.5 * size, 11 * size);
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x + 0.75 * size, y - 11 * size);
  g.lineTo(x + 9 * size, y - 9.5 * size);
  g.lineTo(x + 5.5 * size, y - 7.5 * size);
  g.lineTo(x + 9 * size, y - 5.5 * size);
  g.lineTo(x + 0.75 * size, y - 5 * size);
  g.closePath();
  g.fill();
  g.restore();
}

/** A posting's flag on a chart: a small square pennant in the goal's colour. */
export function drawLfgFlag(g: CanvasRenderingContext2D, x: number, y: number, goal: LfgGoal, size = 1): void {
  g.save();
  g.fillStyle = '#e8dcc0';
  g.fillRect(x - 0.6 * size, y - 10 * size, 1.2 * size, 10 * size);
  g.fillStyle = LFG_GOAL_DEFS[goal].color;
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 1;
  g.beginPath();
  g.rect(x + 0.6 * size, y - 10 * size, 7 * size, 5 * size);
  g.fill();
  g.stroke();
  g.restore();
}
