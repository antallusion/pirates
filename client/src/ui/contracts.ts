// The Admiralty's contracts on the client (docs/19 E15, E18): the Throne's «Contracts» tab — the week's three, each with
// its giver, its story and steps, how far along she is, its pay (silver, glory, a relic part's chance) and the week's
// end; the course to it, «Take» at an Admiralty board, «Board her» at the rogue legend's mark — and the Admiralty's
// board at the head of a great harbour's quests (the same cards in the board's own frame).

import { ADM_ICON, ADM_KIND_ICON, ADM_KIND_NAMES } from '../../../shared/src/data/admiralty.ts';
import type { AdmRow, AdmView } from '../../../shared/src/data/admiralty.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { LEGENDS } from '../../../shared/src/data/throne.ts';
import type { GloryView } from '../../../shared/src/data/throne.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/contracts.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { unitIcon, unitName } from './army.ts';
import { esc, fmt, icon, money } from './dom.ts';
import { placeName } from './maps.ts';
import type { ThroneTab } from './throne.ts';
import { MAX_LEVEL } from '../../../shared/src/constants.ts';

const L = dict(EN, RU);
const ru = (): 0 | 1 => (lang() === 'ru' ? 1 : 0);
const km = (d: number) => (d / 1000).toFixed(1).replace('.', ru() ? ',' : '.');
const hrs = (h: number) => String(h).replace('.', ru() ? ',' : '.');

/** The week's end as days and hours (or hours and minutes on its last day). */
function endsIn(sec: number): string {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  const [dd, hh, mm] = ru() ? ['д', 'ч', 'мин'] : ['d', 'h', 'min'];
  return d > 0 ? `${d} ${dd} ${h} ${hh}` : `${h} ${hh} ${m} ${mm}`;
}

function payLine(r: AdmRow): string {
  return `<span class="adm-pay">${money(r.pay.silver)}<span class="adm-glory">${esc(L('glory', { n: fmt(r.pay.glory) }))}</span><span class="adm-part">${icon('item_north_less_compass', '◈', 'ico-sm')}${esc(L('part', { p: Math.round(r.pay.part * 100) }))}</span><span class="muted">${esc(L('hours', { h: hrs(r.hours) }))}</span></span>`;
}

function stepsList(r: AdmRow): string {
  return `<ol class="jr-steps adm-steps">${r.steps.map((t, i) => {
    const st = r.state === 'done' || i < r.step ? 'done' : r.state === 'taken' && i === r.step ? 'now' : 'ahead';
    const count = st === 'now' && r.need > 1 ? ` <span class="jr-count">${esc(L('progress', { n: r.progress, m: r.need }))}</span>` : '';
    return `<li class="${st}">${st === 'done' ? '<span class="jr-mark">✓</span>' : st === 'now' ? '<span class="jr-mark now">◆</span>' : '<span class="jr-mark">·</span>'}<span>${esc(serverText(t))}${count}</span></li>`;
  }).join('')}</ol>`;
}

/** The rogue legend: her face, her ship, the tier of her army and what is left of it. */
function legendPanel(r: AdmRow): string {
  const lg = r.legend;
  if (!lg) return '';
  const face = CAPTAINS[lg.path as CaptainId]?.portrait ?? 'portrait.corsair';
  const army = lg.left.map((x) => `<span class="th-unit" title="${esc(unitName(x.u as never))}">${unitIcon(x.u as never, 'army-face-xs')}<b>${fmt(x.n)}</b></span>`).join('');
  return `<div class="adm-legend">
    <div class="th-face">${icon(face, '', 'ico-lg ico-round')}${icon('bt_charge', '', 'ico-sm th-sk')}</div>
    <div class="adm-lg-t"><b>${esc(L('legend.h', { name: LEGENDS[lg.skill].name[ru()], ship: LEGENDS[lg.skill].ship[ru()] }))}</b>
      <small class="muted">${esc(L('legend.tier', { n: lg.tier }))} · ${esc(L('legend.left', { p: lg.share }))}</small>
      <i class="th-bar"><i style="width:${Math.max(0, Math.min(100, lg.share))}%"></i></i>
      ${r.state === 'taken' ? `<div class="th-raid-army adm-army">${army}</div>` : ''}
      ${lg.fighting ? `<small class="gold">${esc(L('legend.fighting'))}</small>` : ''}</div></div>`;
}

/** One contract's card: the giver and the kind, the story, the steps, the pay, the buttons. `board`: in port. */
function card(r: AdmRow, v: AdmView, board: boolean): string {
  const face = r.portrait ? icon(`portrait.${r.portrait}`, '', 'ico-lg ico-round') : icon(ADM_KIND_ICON[r.kind], '', 'ico-lg');
  const kind = ADM_KIND_NAMES[r.kind][ru()];
  const stateChip = `<span class="adm-st adm-st-${r.state}">${r.state === 'done' ? '✓ ' : ''}${esc(L(`st.${r.state}`))}${r.state === 'taken' && r.need > 1 ? ` · ${esc(L('progress', { n: r.progress, m: r.need }))}` : ''}</span>`;
  const acts: string[] = [];
  if (r.at && r.state !== 'done' && !board) acts.push(`<button class="btn btn-small" data-admcourse="${r.at.x},${r.at.y}">${esc(L('course'))} · ${esc(L('km', { km: km(r.at.d) }))}</button>`);
  if (r.state === 'open') acts.push(`<button class="btn btn-small${r.why ? '' : ' btn-primary'}" data-admtake="${esc(r.id)}" ${r.why ? 'disabled' : ''} title="${esc(r.why ? serverText(r.why) : '')}">${esc(L('take'))}</button>`);
  if (r.legend && r.state === 'taken' && !board) acts.push(`<button class="btn btn-small${r.legend.why ? '' : ' btn-primary'}" data-admboard="${esc(r.id)}" ${r.legend.why ? 'disabled' : ''} title="${esc(r.legend.why ? serverText(r.legend.why) : '')}">${esc(L('board'))}</button>`);
  const why = r.state === 'open' && r.why && !(board && v.board) ? r.why : r.state === 'taken' && r.legend?.why ? r.legend.why : null;
  const extra = r.seal ? `<small class="muted">${esc(L('seal.mine', { n: r.seal.mine }))}</small>`
    : r.delivery ? `<small class="muted">${esc(L('run.h', { from: placeName(portName(r.delivery.from)), to: placeName(portName(r.delivery.to)), km: km(r.delivery.km * 1000), n: r.delivery.bands }))}</small>` : '';
  return `<div class="adm-card card adm-${r.state}" data-admrow="${esc(r.id)}">
    <div class="adm-top">
      <div class="th-face adm-face">${face}${icon(ADM_KIND_ICON[r.kind], '', 'ico-sm th-sk')}</div>
      <div class="adm-tt"><b>${esc(serverText(r.name))}</b><small class="muted">${esc(kind)} · ${esc(serverText(r.mentor))}</small>${stateChip}</div>
      ${acts.length ? `<span class="adm-acts">${acts.join('')}</span>` : ''}
    </div>
    <p class="adm-say">«${esc(serverText(r.summary))}»</p>
    ${stepsList(r)}
    ${extra}
    ${legendPanel(r)}
    <div class="adm-foot">${payLine(r)}</div>
    ${why ? `<small class="muted th-why">${esc(serverText(why))}</small>` : ''}
  </div>`;
}

/** Port names by id (the view sends ids): from the client's chart of ports. */
let portsById: Map<string, string> = new Map();
const portName = (id: string): string => portsById.get(id) ?? id;
function learnPorts(state: ClientState): void {
  if (portsById.size !== state.ports.length) portsById = new Map(state.ports.map((p) => [p.id, p.name]));
}

function contractsTab(_g: GloryView, state: ClientState): string {
  const v = state.self?.adm;
  const self = state.self;
  if (!v || !self) return `<p class="muted th-locked">${esc(L('locked', { n: MAX_LEVEL, m: self?.level ?? 0 }))}</p>`;
  learnPorts(state);
  const locked = self.level < MAX_LEVEL ? `<p class="muted th-locked">${esc(L('locked', { n: MAX_LEVEL, m: self.level }))}</p>` : '';
  return `<div class="th-head adm-head">
      <div class="th-medal adm-medal" title="${esc(L('doneOf', { n: v.done, m: v.rows.length }))}"><span>${icon(ADM_ICON, '⚓', 'ico-sm')}</span><b>${v.done}/${v.rows.length}</b></div>
      <div class="th-hside"><div class="gi-h">${esc(L('head'))}</div>
        <small class="muted">${esc(L('week', { n: v.week, t: endsIn(v.endsIn) }))}</small>
        <span class="gold">${esc(L('doneOf', { n: v.done, m: v.rows.length }))}</span></div>
    </div>
    ${locked}
    <div class="adm-list">${v.rows.map((r) => card(r, v, false)).join('')}</div>
    <p class="muted hx-note">${esc(L('rule'))} ${esc(L('boards', { list: v.ports.map((id) => placeName(portName(id))).join(', ') }))}</p>`;
}

/** Its buttons: the course (the window shuts and she sails), a contract taken, the legend boarded. */
export function bindContracts(root: HTMLElement, send: (m: ClientMsg) => void, close: () => void): void {
  root.querySelectorAll<HTMLElement>('[data-admcourse]').forEach((b) => (b.onclick = () => {
    const [x, y] = (b.dataset.admcourse ?? '').split(',').map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) send({ t: 'autosail', x, y });
    close();
  }));
  root.querySelectorAll<HTMLElement>('[data-admtake]').forEach((b) => (b.onclick = () => send({ t: 'throne', action: 'contract', op: 'take', id: b.dataset.admtake })));
  root.querySelectorAll<HTMLElement>('[data-admboard]').forEach((b) => (b.onclick = () => {
    send({ t: 'throne', action: 'contract', op: 'board', id: b.dataset.admboard });
    close();
  }));
}

/** The tab's mark: contracts she may take here and now, and a legend she may board. */
export function admBadge(v: AdmView | undefined): number {
  return v ? v.rows.filter((r) => (r.state === 'open' && !r.why) || (r.state === 'taken' && r.legend && !r.legend.why)).length : 0;
}

export const ADM_TABS: ThroneTab[] = [
  { id: 'contracts', label: () => L('tab.contracts'), icon: ADM_ICON, render: contractsTab, bind: bindContracts, badge: (_g, state) => admBadge(state.self?.adm) },
];

/** The Admiralty's board at the head of a great harbour's quests (port.ts): the week's three for a captain of the cap. */
export function admiraltyBoard(state: ClientState, portId: string): string {
  const v = state.self?.adm;
  if (!v || !v.ports.includes(portId) || !v.rows.length) return '';
  learnPorts(state);
  return `<div class="adm-board card"><h4 class="card-h">${icon('set_admiralty', '⚓', 'ico-md')}<span>${esc(L('board.h'))}<small class="muted">${esc(L('board.sub'))} · ${esc(L('week', { n: v.week, t: endsIn(v.endsIn) }))}</small></span></h4>
    <div class="adm-list">${v.rows.map((r) => card(r, v, true)).join('')}</div>
    <small class="muted">${esc(L('board.note'))}</small></div>`;
}
