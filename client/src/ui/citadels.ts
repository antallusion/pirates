// The citadels and the Throne war in the Throne's window (docs/19 E4–E8, E18): two tabs of THRONE_TABS.
// Citadels: the twelve, hers and the besieged first, then by how far she lies from each — its holder and flag, its
// garrison and walls, its windows and a siege on it; the course, a siege declared, the assault; at her guild's own,
// the men she leaves in its garrison and its titan of the week. A row opens to show its garrison stack by stack.
// The war: the season's table of guilds by their points, her guild's place, the last season's Masters, the rules.

import { citName, guildColour } from '../../../shared/src/data/citadels.ts';
import type { CitRow, CitView } from '../../../shared/src/data/citadels.ts';
import { TITAN_IDS, TITAN_NAMES, TITAN_PRICE } from '../../../shared/src/data/titans.ts';
import { siegePart } from '../../../shared/src/data/tactical.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { GloryView } from '../../../shared/src/data/throne.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/citadels.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { unitIcon, unitName } from './army.ts';
import { esc, fmt, icon } from './dom.ts';
import { placeName } from './maps.ts';
import type { ThroneTab } from './throne.ts';

const L = dict(EN, RU);
const ru = (): 0 | 1 => (lang() === 'ru' ? 1 : 0);
const km = (d: number) => (d / 1000).toFixed(1).replace('.', ru() ? ',' : '.');

/** A citadel's name in her tongue (the island's own name put in it). */
export const citLabel = (c: { level: 9 | 10; isle: string }): string => citName(c, ru(), placeName(c.isle));

/** A window's time on her clock: the weekday and the hours. */
function when(w: { start: number; end: number }): string {
  const loc = ru() ? 'ru-RU' : 'en-GB';
  const day = new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(new Date(w.start));
  const hm = (ms: number) => new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
  return `${day} ${hm(w.start)}–${hm(w.end)}`;
}
const till = (ms: number) => new Intl.DateTimeFormat(ru() ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

/** The wall line as nine marks, top to bottom: towers round, the gate square, the segments as stones; cracked, down. */
function wallMarks(r: CitRow): string {
  return `<span class="cit-walls" title="${esc(L('cit.walls'))}">${r.hp.map((h, y) => {
    const part = siegePart(y);
    const st = h <= 0 ? 'down' : h < r.max[y] ? 'cracked' : 'whole';
    return `<i class="cw-${part} cw-${st}"></i>`;
  }).join('')}</span>`;
}

/** The citadel row open to its garrison (none: the nearest of hers, or of the war, or the nearest). */
let opened: number | null = null;

function rowOrder(v: CitView): CitRow[] {
  const weight = (r: CitRow) => (r.siegeOf?.fighting ? 0 : !r.why.assault ? 1 : r.mine ? 2 : r.siegeOf?.mine ? 3 : r.siegeOf ? 4 : 5);
  return [...v.rows].sort((a, b) => weight(a) - weight(b) || a.d - b.d);
}

function citRow(r: CitRow, v: CitView, open: boolean): string {
  const name = citLabel(r);
  const region = placeName(REGIONS[r.region].name);
  const flag = r.tag ? `<span class="cit-flag${r.crown ? ' crown' : ''}" style="background:${guildColour(r.tag)}">${r.crown ? '♛' : ''}</span>` : '';
  const holder = r.mine ? L('cit.yours') : r.tag ? L('cit.held', { tag: r.tag, name: r.guild ?? '' }) : L('cit.castellan');
  const w = r.windows[0];
  const now = Date.now();
  const win = w && now >= w.start && now < w.end ? L('cit.windowOpen', { t: till(w.end) }) : w ? L('cit.window', { t: when(w) }) : '';
  const sg = r.siegeOf;
  const siege = sg ? `<span class="cit-sg${sg.mine ? ' mine' : ''}">${esc(sg.mine ? L('cit.siegeYours', { n: sg.assaults.length }) : L('cit.siege', { tag: sg.tag, n: sg.assaults.length }))}${sg.fighting ? ` · ${esc(L('cit.fighting', { name: sg.fighting }))}` : ''}</span>` : '';
  const act = !r.why.assault
    ? `<button class="btn btn-small btn-primary" data-citassault="${r.id}">${esc(L('cit.assault'))}</button>`
    : sg?.mine
      ? `<button class="btn btn-small" disabled title="${esc(serverText(r.why.assault))}">${esc(L('cit.assault'))}</button>`
      : !r.mine ? `<button class="btn btn-small${r.why.declare ? '' : ' btn-primary'}" data-citdeclare="${r.id}" ${r.why.declare ? 'disabled' : ''} title="${esc(r.why.declare ? serverText(r.why.declare) : '')}">${esc(L('cit.declare'))}</button>` : '';
  const why = open && sg && r.why.assault && (sg.mine || !r.why.declare) ? `<small class="muted cit-why">${esc(serverText(r.why.assault))}</small>`
    : open && !sg && r.why.declare && !r.mine ? `<small class="muted cit-why">${esc(serverText(r.why.declare))}</small>` : '';
  const garrison = open ? `<div class="th-raid-army cit-army">${r.garrison.map((x) => `<span class="th-unit" title="${esc(unitName(x.u))}">${unitIcon(x.u, 'army-face-xs')}<b>${fmt(x.n)}</b></span>`).join('')}</div>` : '';
  const income = open ? `<small class="cit-inc">${esc(L('cit.income', { silver: fmt(r.tax), pts: r.points }))}</small>${r.crown ? `<small class="cit-inc gold">${esc(L('cit.crown'))}</small>` : ''}` : '';
  return `<div class="cit-row${r.mine ? ' mine' : ''}${sg ? ' sieged' : ''}${open ? ' open' : ''}" data-citrow="${r.id}">
    <div class="cit-face">${icon('build_fort_2', '♜', 'ico-lg')}<b class="cit-lv">⚓${r.level}</b>${flag}</div>
    <div class="cit-main">
      <span class="cit-name"><b>${esc(name)}</b><small class="muted">${esc(region)} · ${esc(L('cit.km', { km: km(r.d) }))}</small></span>
      <span class="cit-holder${r.mine ? ' gold' : ''}">${esc(holder)}</span>
      <span class="cit-stat"><span class="cit-gar">${esc(L('cit.garrison', { p: r.share }))}<i class="th-bar"><i style="width:${Math.max(0, Math.min(100, r.share))}%"></i></i></span>${wallMarks(r)}</span>
      <small class="cit-win${r.open ? ' open' : ''}">${esc(win)}</small>${siege}${why}
    </div>
    <div class="cit-act"><button class="btn btn-small" data-citcourse="${r.x},${r.y}">${esc(L('cit.course'))}</button>${act}</div>
    ${open ? `<div class="cit-more">${garrison}${income}${holdPanel(r, v)}</div>` : ''}
  </div>`;
}

/** At her guild's citadel: the men she may leave in its garrison, and its titan of the week. */
function holdPanel(r: CitRow, v: CitView): string {
  if (!r.mine || r.why.leave) return '';
  const leave = v.army.length
    ? `<h4 class="card-h">${esc(L('cit.leaveH'))}</h4><div class="cit-leave">${v.army.map((x) => `<span class="cit-stack">${unitIcon(x.u, 'army-face-xs')}<b>${fmt(x.n)}</b>
        <button class="btn btn-small" data-citleave="${r.id}:${x.u}:${Math.ceil(x.n / 2)}">${esc(L('cit.half'))}</button><button class="btn btn-small" data-citleave="${r.id}:${x.u}:${x.n}">${esc(L('cit.all'))}</button></span>`).join('')}</div>`
    : '';
  const titan = !r.titan
    ? `<small class="muted">${esc(L('cit.titanTaken'))}</small>`
    : `<h4 class="card-h">${esc(L('cit.titanH', { silver: fmt(TITAN_PRICE.silver), pearls: TITAN_PRICE.pearls }))}</h4>
      <div class="cit-titans">${TITAN_IDS.map((u) => `<button class="btn btn-small cit-titan" data-cittitan="${r.id}:${u}" ${r.why.titan ? 'disabled' : ''} title="${esc(r.why.titan ? serverText(r.why.titan) : TITAN_NAMES[u].note[ru()])}">${unitIcon(u, 'army-face-xs')}<span>${esc(TITAN_NAMES[u].name[ru()])}</span></button>`).join('')}</div>
      ${r.why.titan ? `<small class="muted cit-why">${esc(serverText(r.why.titan))}</small>` : ''}`;
  return `${leave}${titan}`;
}

function citTab(_g: GloryView, state: ClientState): string {
  const v = state.self?.cit;
  if (!v || !v.rows.length) return `<p class="muted th-locked">${esc(L('cit.none'))}</p>`;
  const rows = rowOrder(v);
  if (opened === null || !rows.some((r) => r.id === opened)) opened = rows[0].id;
  return `<div class="cit-list">${rows.map((r) => citRow(r, v, r.id === opened)).join('')}</div>
    <p class="muted hx-note">${esc(L('cit.rule'))}</p>`;
}

function warTab(_g: GloryView, state: ClientState): string {
  const v = state.self?.cit;
  if (!v) return `<p class="muted th-locked">${esc(L('cit.none'))}</p>`;
  const you = v.guild ? (v.guild.place > 0 ? L('war.you', { tag: v.guild.tag, pts: fmt(v.guild.points), place: v.guild.place }) : L('war.youNone', { tag: v.guild.tag })) : L('war.noGuild');
  const table = v.war.length
    ? `<ol class="th-board cit-war">${v.war.map((r) => `<li class="${r.you ? 'you' : ''}"><b><span class="cit-flag sm" style="background:${guildColour(r.tag)}"></span>[${esc(r.tag)}] ${esc(r.name)}</b><span>${esc(L('war.row', { pts: fmt(r.points), cits: r.cits }))}</span></li>`).join('')}</ol>`
    : `<p class="muted hx-none">${esc(L('war.none'))}</p>`;
  const days = Math.ceil(v.endsIn / 86400);
  return `<div class="th-head"><div class="th-medal" title="${esc(L('war.h', { n: v.season }))}"><span>♛</span><b>${v.season}</b></div>
      <div class="th-hside"><div class="gi-h">${esc(L('war.h', { n: v.season }))}</div><small class="muted">${esc(L('war.ends', { d: days }))}</small><span class="gold">${esc(you)}</span>
      ${v.champion ? `<small>${esc(L('war.champion', { n: v.champion.season, tag: v.champion.tag, name: v.champion.name }))}</small>` : ''}</div></div>
    ${table}
    <p class="muted hx-note">${esc(L('war.rule'))}</p>`;
}

function bindCit(root: HTMLElement, send: (m: ClientMsg) => void, close: () => void): void {
  const cit = (b: HTMLElement, k: string) => (b.dataset[k] ?? '').split(':');
  root.querySelectorAll<HTMLElement>('[data-citrow]').forEach((row) => (row.onclick = (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const id = Number(row.dataset.citrow);
    opened = id;
    root.querySelectorAll<HTMLElement>('[data-citrow]').forEach((r) => r.classList.toggle('open', r === row));
    send({ t: 'throne', action: 'view' });
  }));
  root.querySelectorAll<HTMLElement>('[data-citcourse]').forEach((b) => (b.onclick = () => {
    const [x, y] = (b.dataset.citcourse ?? '').split(',').map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) send({ t: 'autosail', x, y });
    close();
  }));
  root.querySelectorAll<HTMLElement>('[data-citdeclare]').forEach((b) => (b.onclick = () => send({ t: 'throne', action: 'cit', op: 'declare', cit: Number(b.dataset.citdeclare) })));
  root.querySelectorAll<HTMLElement>('[data-citassault]').forEach((b) => (b.onclick = () => {
    send({ t: 'throne', action: 'cit', op: 'assault', cit: Number(b.dataset.citassault) });
    close();
  }));
  root.querySelectorAll<HTMLElement>('[data-citleave]').forEach((b) => (b.onclick = () => {
    const [id, u, n] = cit(b, 'citleave');
    send({ t: 'throne', action: 'cit', op: 'leave', cit: Number(id), u, n: Number(n) });
  }));
  root.querySelectorAll<HTMLElement>('[data-cittitan]').forEach((b) => (b.onclick = () => {
    const [id, u] = cit(b, 'cittitan');
    send({ t: 'throne', action: 'cit', op: 'titan', cit: Number(id), u });
  }));
}

/** The two tabs (throne.ts THRONE_TABS): a mark on the citadels' when an assault may be made or hers is besieged. */
export const CIT_TABS: ThroneTab[] = [
  {
    id: 'citadels', label: () => L('tab.cit'), icon: 'build_fort', render: citTab, bind: bindCit,
    badge: (_g, state) => citBadge(state.self?.cit),
  },
  { id: 'war', label: () => L('tab.war'), icon: 'tattoo_crown', render: warTab },
];

/** The citadels' tab's mark from her state (the window's tabs take the glory view; this one reads her citadels). */
export function citBadge(v: CitView | undefined): number {
  return v ? v.rows.filter((r) => !r.why.assault || (r.mine && r.siegeOf)).length : 0;
}

