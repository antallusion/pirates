// The Company & Letters screen (Y): your group and the convoy signal, hails to trade, letters from the
// packet boat, and — in port — the captains' market board (and Tidewrack's trophy auction).
// Plus the barter table, opened when two captains agree to trade.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { GOODS, GOOD_IDS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { BUILDINGS, BUILDING_IDS } from '../../../shared/src/data/holdings.ts';
import type { BuildingId } from '../../../shared/src/data/holdings.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { WOODS } from '../../../shared/src/data/shipbuild.ts';
import type { WoodId } from '../../../shared/src/data/shipbuild.ts';
import { FRIENDS_MAX, GROUP_MAX } from '../../../shared/src/protocol.ts';
import type { GuildRank, HoldingView, IslandOffer, SiegeView } from '../../../shared/src/protocol.ts';
import type { ClientMsg, ListingView } from '../../../shared/src/protocol.ts';
import type { Cargo } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { guildGoalText } from '../../../shared/src/data/guildgoal.ts';
import { dict, lang, plural } from '../i18n.ts';
import { NAME_RU } from '../lang/data.ts';
import { serverText } from '../lang/server.ts';
import { EN, RU } from '../lang/ui/company.ts';
import type { ClientState } from '../state.ts';
import { assetUrl } from '../assets.ts';
import { ask } from './confirm.ts';
import { esc, fmt, icon, money } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);
/** A name or sentence the server built, in the player's language. */
const sv = (s: string) => (lang() === 'ru' ? (NAME_RU.get(s) ?? serverText(s)) : s);
const dayW = (n: number) => plural(n, L('day_one'), L('day_few'), L('day_many'));
const hourW = (n: number) => plural(n, L('hour_one'), L('hour_few'), L('hour_many'));
const slotW = (n: number) => plural(n, L('slot_one'), L('slot_few'), L('slot_many'));

export type CompanyTab = 'group' | 'guild' | 'letters' | 'market' | 'law' | 'isles' | 'legends' | 'empires';

const ago = (ms: number) => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  return m < 1 ? L('ago_now') : m < 60 ? L('ago_min', { n: m }) : m < 1440 ? L('ago_h', { n: Math.round(m / 60) }) : L('ago_d', { n: Math.round(m / 1440) });
};
const left = (ms: number) => {
  const m = Math.max(0, Math.round((ms - Date.now()) / 60_000));
  return m < 60 ? L('left_min', { n: m }) : L('left_hm', { h: Math.floor(m / 60), m: m % 60 });
};
const goodOptions = (have?: Cargo) =>
  GOOD_IDS.filter((g) => !have || (have[g] ?? 0) > 0).map((g) => `<option value="${g}">${esc(GOODS[g].name)}${have ? ` (${have[g]})` : ''}</option>`).join('');

const RANK_ORDER: GuildRank[] = ['admiral', 'vice', 'commodore', 'captain', 'bosun', 'sailor', 'cabin_boy'];
const RANK_NAMES = (r: GuildRank) => L(`rank_${r}`);
const BASE_KEYS = ['', 'base_anchorage', 'base_outpost', 'base_fortress', 'base_citadel', 'base_stronghold'] as const;
const BASE_NAMES = (n: number) => (BASE_KEYS[n] ? L(BASE_KEYS[n] as Exclude<(typeof BASE_KEYS)[number], ''>) : '');

export class CompanyScreen {
  tab: CompanyTab = 'group';
  private send: (m: ClientMsg) => void;
  /** "Whisper" on a friend: the chat opens addressed to them (main.ts). */
  onWhisper: (name: string) => void = () => {};
  /** "Letter" on a friend: the letters tab opens with them as the addressee. */
  private mailTo = '';

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  open(tab?: CompanyTab): void {
    if (tab) this.tab = tab;
    this.send({ t: 'mail', action: 'list' });
    this.send({ t: 'friend', action: 'list' });
  }

  render(root: HTMLElement, state: ClientState): void {
    const docked = state.self?.dockedAt ?? null;
    if (this.tab !== 'letters') this.mailTo = '';
    if (this.tab === 'market' && !docked) this.tab = 'group';
    const TAB_ICON: Record<CompanyTab, string> = { group: 'tab_group', guild: 'tab_guild', law: 'tab_law', letters: 'tab_letters', isles: 'tab_isles', empires: 'tab_empire', legends: 'tab_legends', market: 'tab_board' };
    const tabName = (t: CompanyTab) => t === 'group' ? L('tab_group') : t === 'law' ? L('tab_law') : t === 'isles' ? L('tab_isles') : t === 'legends' ? L('tab_legends') : t === 'empires' ? L('tab_empires') : t === 'guild' ? (state.guild ? L('tab_guild_tag', { tag: esc(state.guild.tag) }) : L('tab_guild')) : t === 'letters' ? L('tab_letters') : state.market?.auction ? L('tab_market_auction') : L('tab_market');
    const badge = (t: CompanyTab) => t === 'law' ? state.self?.pvp.challenges.length ?? 0 : t === 'guild' ? state.guildInvites.length : t === 'letters' ? state.unread : 0;
    const shown = (['group', 'guild', 'law', 'letters', 'isles', 'empires', 'legends', 'market'] as CompanyTab[]).filter((t) => t !== 'market' || docked);
    const tabs = shown.map((t) => `<button class="tab ${this.tab === t ? 'active' : ''}" data-tab="${t}" title="${tabName(t)}">${icon(TAB_ICON[t])}<span>${tabName(t)}</span>${badge(t) ? `<i class="tab-badge">${badge(t)}</i>` : ''}</button>`).join('');
    root.innerHTML = `<div class="modal-head"><div><h2>${L('title')}</h2></div><div class="muted">${L('close_hint')}</div></div>
      <div class="tabs icon-tabs company-tabs" style="--n:${shown.length}">${tabs}</div><div class="tab-caption">${tabName(this.tab)}</div>
      <div class="modal-body" id="company-body"></div>`;
    const body = root.querySelector<HTMLElement>('#company-body')!;
    if (this.tab === 'group') this.renderGroup(body, state);
    else if (this.tab === 'letters') this.renderLetters(body, state);
    else if (this.tab === 'law') this.renderLaw(body, state);
    else if (this.tab === 'isles') this.renderIsles(body, state);
    else if (this.tab === 'guild') this.renderGuild(body, state);
    else if (this.tab === 'legends') this.renderLegends(body, state);
    else if (this.tab === 'empires') this.renderEmpires(body, state);
    else this.renderMarket(body, state);
    root.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => (el.onclick = () => {
      if (el.dataset.tab === 'legends') this.send({ t: 'legends' });
      if (el.dataset.tab === 'empires') this.send({ t: 'empire', action: 'view' });
      this.tab = el.dataset.tab as CompanyTab;
      if (this.tab === 'market') this.send({ t: 'market', action: 'list' });
      if (this.tab === 'letters') this.send({ t: 'mail', action: 'list' });
      if (this.tab === 'law') this.send({ t: 'pvp', action: 'bounties' });
      if (this.tab === 'isles') this.send({ t: 'isle', action: 'list' });
      if (this.tab === 'guild') this.send({ t: 'guild', action: 'view' });
      this.render(root, state);
    }));
  }

  /** Empires: who governs the lawless seas, the colonies' riots, your trading house and its convoys, the licence exchange. */
  private renderEmpires(body: HTMLElement, state: ClientState): void {
    const v = state.empire;
    if (!v) {
      this.send({ t: 'empire', action: 'view' });
      body.innerHTML = `<p class="muted">${L('emp_loading')}</p>`;
      return;
    }
    const docked = state.self?.dockedAt ?? null;
    const goods = Object.values(GOODS).filter((g) => !g.contraband);
    const date = (t: number) => new Date(t).toLocaleDateString();
    body.innerHTML = `<div class="cols"><div>
      <div class="card"><h4 class="card-h">${icon('faction_crown', '', 'ico-md')}${L('emp_gov_title')}</h4><p class="muted" style="font-size:12px">${L('emp_gov_text')}</p>
        ${v.governors.map((g) => `<div class="row"><span>${esc(sv(g.region))}</span><span>${g.tag ? L('emp_gov_until', { tag: esc(g.tag), date: date(g.until), streak: g.streak }) : `<span class="muted">${L('nobody')}</span>`}</span><span class="muted">${L('emp_nodes', { mine: g.mine, nodes: g.nodes })}</span></div>`).join('')}
        ${v.riots.map((r) => `<div style="color:var(--bad)">${L('emp_riot', { port: esc(sv(r.port)) })}${r.quelled ? L('emp_riot_quelled') : r.failed ? L('emp_riot_failed') : ''}</div>`).join('')}</div>
      <div class="card"><h4 class="card-h">${icon('tab_empire', '', 'ico-md')}${L('emp_empires')}</h4>${v.empires.map((e, i) => `<div class="row"><span>${i + 1}. ${esc(e.name)}</span><span>${L('emp_profit', { n: fmt(e.profit) })}</span></div>`).join('') || `<p class="muted">${L('emp_no_empires')}</p>`}</div></div>
      <div><div class="card"><h4 class="card-h">${icon('tab_exchange', '', 'ico-md')}${L('emp_house')}</h4>${v.house ? `<p>${L('emp_house_text', { offices: v.offices.length ? esc(v.offices.map(sv).join(', ')) : L('none') })}</p>
        <div class="row" style="gap:4px;flex-wrap:wrap"><select data-cv="from">${v.offices.map((p) => `<option value="${esc(p)}">${esc(sv(p))}</option>`).join('')}</select>→<select data-cv="to">${v.offices.map((p) => `<option value="${esc(p)}">${esc(sv(p))}</option>`).join('')}</select>
        <select data-cv="good">${goods.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select><input data-cv="qty" value="30" style="width:50px">
        ${L('emp_every')} <input data-cv="every" value="0" style="width:36px"> ${L('emp_h_escorts')} <input data-cv="escorts" value="1" style="width:30px"><button class="btn btn-small btn-primary" data-convoy>${L('send')}</button></div>
        ${v.orders.map((o) => `<div class="row"><span>${esc(sv(o.from))} → ${esc(sv(o.to))}: ${o.qty} ${esc(sv(o.good))}${o.everyHours ? L('emp_order_every', { n: o.everyHours }) : ''} · ${o.escorts} ${plural(o.escorts, L('escort_one'), L('escort_few'), L('escort_many'))}</span><button class="btn btn-small btn-danger" data-cancel="${o.id}">${L('cancel')}</button></div>`).join('')}`
        : `<p>${L('emp_charter_text')}</p><button class="btn btn-small" data-charter>${L('emp_charter_btn')}</button>`}</div>
      <div class="card"><h4 class="card-h">${icon('map_contract', '', 'ico-md')}${L('emp_lic_title')}</h4><p class="muted" style="font-size:12px">${L('emp_lic_text')}</p>
        ${v.licences.map((l) => `<div>${L('emp_lic_this', { good: esc(sv(l.good)), region: esc(sv(l.region)), holder: esc(l.holder) })}${l.mine ? L('emp_yours_paren') : ''}</div>`).join('')}
        ${v.lots.map((l) => `<div class="lot-row">${icon('map_contract', '', 'item-ico')}<div class="item-text"><b>${L('emp_lot', { good: esc(sv(l.good)), region: esc(sv(l.region)) })}</b><span class="muted">${L('emp_top', { n: l.top })}${l.mine ? L('emp_top_yours', { n: l.mine }) : ''}</span></div>${docked === 'gravesend' ? `<div class="lot-bid"><input data-bid="${l.index}" type="number" value="${Math.max(500, l.top + 100)}"><button class="btn btn-small" data-bidbtn="${l.index}">${L('bid')}</button></div>` : ''}</div>`).join('')}
        ${docked === 'gravesend' ? '' : `<p class="muted">${L('emp_bid_in_person')}</p>`}</div></div></div>`;
    const val = (k: string) => body.querySelector<HTMLInputElement>(`[data-cv="${k}"]`)?.value ?? '';
    const portId = (name: string) => state.ports.find((p) => state.enName(p) === name || p.name === name || p.id === name)?.id ?? name;
    body.querySelector<HTMLElement>('[data-charter]')?.addEventListener('click', () => this.send({ t: 'empire', action: 'charter' }));
    body.querySelector<HTMLElement>('[data-convoy]')?.addEventListener('click', () => this.send({ t: 'empire', action: 'convoy', from: portId(val('from')), to: portId(val('to')), good: val('good'), qty: Number(val('qty')), every: Number(val('every')), escorts: Number(val('escorts')) }));
    body.querySelectorAll<HTMLElement>('[data-cancel]').forEach((el) => (el.onclick = () => this.send({ t: 'empire', action: 'cancel', id: Number(el.dataset.cancel) })));
    body.querySelectorAll<HTMLElement>('[data-bidbtn]').forEach((el) => (el.onclick = () => this.send({ t: 'empire', action: 'bid', lot: Number(el.dataset.bidbtn), amount: Number(body.querySelector<HTMLInputElement>(`[data-bid="${el.dataset.bidbtn}"]`)!.value) })));
  }

  /** Legends: your trophies and monsters, the chapters of the Abyss, the first victories on these seas. */
  private renderLegends(body: HTMLElement, state: ClientState): void {
    const v = state.legends;
    if (!v) {
      this.send({ t: 'legends' });
      body.innerHTML = `<p class="muted">${L('leg_loading')}</p>`;
      return;
    }
    const date = (t: number) => new Date(t).toLocaleDateString();
    const se = v.season;
    const days = Math.ceil(se.endsIn / 86400);
    const pct = Math.min(100, ((se.xp % se.levelXp) / se.levelXp) * 100);
    const season = `<div class="card"><h4 class="card-h">${icon('xp', '', 'ico-md')}${L('leg_season', { n: se.season, theme: esc(sv(se.theme)) })} <span class="muted">${L('leg_days_left', { n: days, days: dayW(days) })}</span></h4><p><i>${esc(sv(se.themeText))}</i></p>
      ${se.war ? `<div class="row"><span>${L('leg_crown', { n: se.war.crown })}</span><span>${L('leg_war')}</span><span>${L('leg_confed', { n: se.war.confederacy })}</span></div>` : ''}
      <div class="row"><span>${L('leg_path', { level: se.level, max: se.maxLevel })}</span><span class="muted">${se.next ? L('leg_next', { level: se.next.level, reward: esc(sv(se.next.reward)) }) : L('leg_complete')}</span></div>
      <div class="bbar" style="height:6px;background:#1b1512;border:1px solid rgba(111,90,56,0.8)"><i style="display:block;height:100%;width:${pct.toFixed(0)}%;background:var(--gold)"></i></div>
      <p class="muted" style="font-size:11px">${L('leg_cosmetic')}</p>
      <div class="row" style="gap:6px"><select data-sel="title"><option value="">${L('leg_no_title')}</option>${se.titles.map((t) => `<option value="${esc(t)}" ${t === se.title ? 'selected' : ''}>${esc(sv(t))}</option>`).join('')}</select>
      <select data-sel="pennant"><option value="">${L('leg_plain')}</option>${se.pennants.map((c) => `<option value="${esc(c)}" ${c === se.pennant ? 'selected' : ''} style="color:${esc(c)}">■ ${esc(c)}</option>`).join('')}</select></div>
      ${se.nameRights > 0 ? `<div class="row" style="gap:6px;margin-top:6px"><span class="gold">${L('leg_name_isle')}</span><select data-sel="island">${[...state.discovered].map((id) => state.islands.get(id)).filter((i) => i && !i.portId).map((i) => `<option value="${i!.id}">${esc(i!.name)}</option>`).join('')}</select><input data-sel="newname" placeholder="${L('leg_new_name')}" style="width:120px"><button class="btn btn-small btn-primary" data-name-isle>${L('leg_name_btn')}</button></div>` : ''}
      <h4 style="margin-top:8px">${L('leg_your_season')}</h4>${se.mine.map((m) => `<div class="row"><span>${esc(sv(m.stat))}</span><span>${m.value}</span></div>`).join('') || `<p class="muted">${L('leg_nothing_season')}</p>`}</div>
      <div class="card"><h4 class="card-h">${icon('goal', '', 'ico-md')}${L('leg_tables')}</h4>${se.tables.filter((t) => t.rows.length).map((t) => `<div style="margin-bottom:4px"><b>${esc(sv(t.stat))}</b>: ${t.rows.map((r, i) => `${i + 1}. ${esc(r.name)} (${r.value})`).join(' · ')}</div>`).join('') || `<p class="muted">${L('leg_tables_empty')}</p>`}</div>
      <div class="card"><h4 class="card-h">${icon('tab_legends', '', 'ico-md')}${L('leg_pantheon')}</h4>${se.halls.map((h) => `<div><b>${esc(sv(h.hall))}</b>: ${h.members.map((m) => `${esc(m.name)} <span class="muted">${L('leg_member_season', { n: m.season })}</span>`).join(', ') || `<span class="muted">${L('leg_empty_halls')}</span>`}</div>`).join('')}</div>`;
    const legendary = `<div class="card"><h4 class="card-h">${icon('tab_legends', '', 'ico-md')}${L('leg_legendary')}</h4>${v.legendary.map((l) => `<div class="leg-ship" style="margin-bottom:8px">${cardArt(`card.leg_${l.id}`)}<b>${esc(sv(l.name))}</b> <span class="muted">${L('leg_ship_meta', { base: esc(sv(l.base)), boss: esc(sv(l.boss.replace('_', ' '))), port: esc(sv(l.port)) })}</span>
        <div style="font-size:12px"><span style="color:var(--good)">${esc(sv(l.gift))}</span> <span style="color:var(--bad)">${esc(sv(l.price))}</span></div>
        ${l.status === 'locked' ? `<div class="muted">${L('leg_locked')}</div>`
        : l.status === 'commission' ? `<div>${L('leg_commission', { need: l.need.map((n) => `${esc(sv(n.good))} ${n.have}/${n.need}`).join(' · ') })}${l.leaders.length ? L('leg_leading', { list: l.leaders.map((x) => `${esc(x.name)} (${x.value})`).join(', ') }) : ''}${l.mine ? L('leg_yours', { n: l.mine }) : ''}</div>${l.canDeliver ? `<button class="btn btn-small btn-primary" data-deliver="${l.id}">${L('leg_deliver')}</button>` : ''}`
        : l.status === 'owned' ? `<div>${L('leg_sailed_by', { owner: esc(l.owner ?? '') })}</div>` : `<div style="color:var(--bad)">${L('leg_sunk', { where: l.wreck ? L('leg_sunk_at', { x: Math.round(l.wreck.x / 1000), y: Math.round(l.wreck.y / 1000) }) : '', owner: l.owner ? esc(l.owner) : L('leg_her_captain') })}</div>`}</div>`).join('')}</div>`;
    body.innerHTML = `${season}${legendary}<div class="cols"><div>
      <div class="card"><h4 class="card-h">${icon('tab_legends', '', 'ico-md')}${L('leg_trophies')}</h4>${v.trophies.map((t) => `<div>✦ ${esc(sv(t))}</div>`).join('') || `<p class="muted">${L('none_yet')}</p>`}</div>
      <div class="card"><h4 class="card-h">${icon('map_monster', '', 'ico-md')}${L('leg_monsters')}</h4>${v.bossKills.map((k) => `<div class="row"><span>${esc(sv(k.name))}</span><span>×${k.n}</span></div>`).join('') || `<p class="muted">${L('none_yet')}</p>`}
        ${v.shards ? `<p class="muted">${L('leg_shards', { n: v.shards })}</p>` : ''}</div></div>
      <div><div class="card"><h4 class="card-h">${icon('map_contract', '', 'ico-md')}${L('leg_log')}</h4>${v.chapters.map((c) => `<p><b>${esc(sv(c.title))}</b><br><i>${esc(sv(c.text))}</i></p>`).join('') || `<p class="muted">${L('leg_no_chapters')}</p>`}</div>
      <div class="card"><h4 class="card-h">${icon('goal', '', 'ico-md')}${L('leg_firsts')}</h4>${v.firsts.map((f) => `<div class="row"><span>${esc(sv(f.boss))}</span><span class="muted">${esc(f.names.slice(0, 4).join(', '))}${f.names.length > 4 ? '…' : ''} · ${date(f.at)}</span></div>`).join('') || `<p class="muted">${L('leg_no_firsts')}</p>`}</div></div></div>`;
    body.querySelector<HTMLSelectElement>('[data-sel="title"]')!.onchange = (e) => this.send({ t: 'season', action: 'title', value: (e.target as HTMLSelectElement).value });
    body.querySelector<HTMLSelectElement>('[data-sel="pennant"]')!.onchange = (e) => this.send({ t: 'season', action: 'pennant', value: (e.target as HTMLSelectElement).value });
    body.querySelectorAll<HTMLElement>('[data-deliver]').forEach((el) => (el.onclick = () => this.send({ t: 'legendary', action: 'deliver', id: el.dataset.deliver! })));
    const nameBtn = body.querySelector<HTMLElement>('[data-name-isle]');
    if (nameBtn) nameBtn.onclick = () => this.send({ t: 'season', action: 'name', islandId: Number(body.querySelector<HTMLSelectElement>('[data-sel="island"]')!.value), value: body.querySelector<HTMLInputElement>('[data-sel="newname"]')!.value });
  }

  private renderGroup(body: HTMLElement, state: ClientState): void {
    const g = state.party;
    const me = state.self ? (g?.members.find((m) => m.name === state.self!.name)?.accountId ?? -1) : -1;
    const lead = g ? g.leader === me : true;
    body.innerHTML = `<div class="cols"><div>
      <h3 class="title-sm" style="font-size:20px">${g ? L('grp_yours', { n: g.members.length, max: GROUP_MAX }) : L('grp_alone')}</h3>
      ${g ? g.members.map((m) => `<div class="card"><h4>${m.accountId === g.leader ? '⚑ ' : ''}${m.accountId !== me && m.online ? `<span class="insp-name" data-inspect="${esc(m.name)}" role="button" tabindex="0">${esc(m.name)}</span>` : esc(m.name)} <span class="muted">${L('grp_level', { captain: esc(CAPTAINS[m.captain]?.name ?? m.captain), level: m.level })}</span></h4>
        <div class="row"><span class="muted">${!m.online ? L('grp_ashore') : m.docked ? L('grp_in', { port: esc(state.ports.find((p) => p.id === m.docked)?.name ?? m.docked) }) : L('grp_at_sea', { n: Math.round(m.hull * 100) })}${m.inConvoy ? L('grp_station') : ''}</span>
        ${m.accountId !== me ? `<span>${state.friends.some((f) => f.name === m.name) ? '' : `<button class="btn btn-small" data-befriend="${esc(m.name)}">${L('fr_befriend')}</button> `}${lead ? `<button class="btn btn-small" data-lead="${esc(m.name)}">${L('grp_give_lead')}</button> <button class="btn btn-small btn-danger" data-kick="${esc(m.name)}">${L('grp_kick')}</button>` : ''}</span>` : ''}</div></div>`).join('') : `<p class="muted">${L('grp_about')}</p>`}
      ${g && lead ? `<div class="card"><h4 class="card-h">${icon('ab_form_line', '', 'ico-md')}${L('grp_convoy')}</h4><p class="muted">${L('grp_convoy_text')}</p>
        <button class="btn ${g.convoy ? 'btn-primary' : ''}" id="convoy">${g.convoy ? L('grp_convoy_down') : L('grp_convoy_up')}</button></div>` : g?.convoy ? `<p class="muted">${L('grp_convoy_flying')}</p>` : ''}
      ${g ? `<button class="btn btn-danger" id="leave">${L('grp_leave')}</button>` : ''}
    </div><div>
      ${lead ? `<div class="card"><h4 class="card-h">${icon('tab_group', '', 'ico-md')}${L('grp_invite_title')}</h4><div class="row"><input id="inv-name" placeholder="${L('ph_captain')}" maxlength="20" style="flex:1"><button class="btn" id="invite">${L('invite')}</button></div></div>` : ''}
      ${this.lfgCard(state, !!g, lead && (g?.members.length ?? 1) < GROUP_MAX)}
      ${this.friendsCard(state, lead && (g?.members.length ?? 1) < GROUP_MAX, g?.members.map((m) => m.name) ?? [])}
      ${this.whoCard(state, lead && (g?.members.length ?? 1) < GROUP_MAX)}
      <div class="card"><h4 class="card-h">${icon('tab_market', '', 'ico-md')}${L('grp_trade_title')}</h4><p class="muted">${L('grp_trade_text')}</p>
        <div class="row"><input id="bar-name" placeholder="${L('ph_captain')}" maxlength="20" style="flex:1"><button class="btn" id="hail">${L('grp_hail')}</button></div></div>
      ${state.invites.map((i) => `<div class="card"><h4 class="card-h">${icon('tab_letters', '', 'ico-md')}${L('grp_invited', { from: esc(i.from) })}</h4><button class="btn btn-primary" data-accept="${i.id}">${L('join')}</button> <button class="btn" data-decline="${i.id}">${L('decline')}</button></div>`).join('')}
    </div></div>`;
    const val = (id: string) => body.querySelector<HTMLInputElement>(id)?.value.trim() ?? '';
    body.querySelector<HTMLElement>('#invite')?.addEventListener('click', () => val('#inv-name') && this.send({ t: 'group', action: 'invite', name: val('#inv-name') }));
    body.querySelector<HTMLElement>('#hail')?.addEventListener('click', () => val('#bar-name') && this.send({ t: 'barter', action: 'propose', name: val('#bar-name') }));
    body.querySelector<HTMLElement>('#convoy')?.addEventListener('click', () => this.send({ t: 'group', action: 'convoy', on: !g?.convoy }));
    body.querySelector<HTMLElement>('#leave')?.addEventListener('click', () => this.send({ t: 'group', action: 'leave' }));
    body.querySelectorAll<HTMLElement>('[data-accept]').forEach((el) => (el.onclick = () => this.send({ t: 'group', action: 'accept', id: Number(el.dataset.accept) })));
    body.querySelectorAll<HTMLElement>('[data-decline]').forEach((el) => (el.onclick = () => this.send({ t: 'group', action: 'decline', id: Number(el.dataset.decline) })));
    body.querySelectorAll<HTMLElement>('[data-lead]').forEach((el) => (el.onclick = () => this.send({ t: 'group', action: 'lead', name: el.dataset.lead! })));
    body.querySelectorAll<HTMLElement>('[data-kick]').forEach((el) => (el.onclick = () => this.send({ t: 'group', action: 'kick', name: el.dataset.kick! })));
    body.querySelector<HTMLElement>('#lfg-post')?.addEventListener('click', () => this.send({ t: 'group', action: 'lfg', note: val('#lfg-note') }));
    body.querySelector<HTMLElement>('#lfg-stop')?.addEventListener('click', () => this.send({ t: 'group', action: 'lfg_clear' }));
    body.querySelectorAll<HTMLElement>('[data-lfg-invite]').forEach((el) => (el.onclick = () => this.send({ t: 'group', action: 'invite', name: el.dataset.lfgInvite! })));
    body.querySelectorAll<HTMLElement>('[data-letter]').forEach((el) => (el.onclick = () => {
      this.mailTo = el.dataset.letter!;
      body.closest('#modal-panel')?.querySelector<HTMLElement>('[data-tab="letters"]')?.click();
    }));
    body.querySelectorAll<HTMLElement>('[data-inspect]').forEach((el) => (el.onclick = () => this.send({ t: 'inspect', name: el.dataset.inspect! })));
    const who = () => this.send({ t: 'who', q: val('#who-q'), here: !!body.querySelector<HTMLInputElement>('#who-here')?.checked });
    body.querySelector<HTMLElement>('#who-find')?.addEventListener('click', who);
    body.querySelector<HTMLInputElement>('#who-q')?.addEventListener('keydown', (e) => e.key === 'Enter' && (e.stopPropagation(), e.preventDefault(), who()));
    const addFriend = () => val('#fr-name') && this.send({ t: 'friend', action: 'add', name: val('#fr-name') });
    body.querySelector<HTMLElement>('#fr-add')?.addEventListener('click', addFriend);
    body.querySelector<HTMLElement>('#fr-ignore')?.addEventListener('click', () => val('#fr-name') && this.send({ t: 'friend', action: 'ignore', name: val('#fr-name') }));
    body.querySelectorAll<HTMLElement>('[data-unignore]').forEach((el) => (el.onclick = () => this.send({ t: 'friend', action: 'unignore', name: el.dataset.unignore! })));
    body.querySelector<HTMLInputElement>('#fr-name')?.addEventListener('keydown', (e) => e.key === 'Enter' && (e.stopPropagation(), e.preventDefault(), addFriend()));
    body.querySelectorAll<HTMLElement>('[data-whisper]').forEach((el) => (el.onclick = () => this.onWhisper(el.dataset.whisper!)));
    body.querySelectorAll<HTMLElement>('[data-fr-invite]').forEach((el) => (el.onclick = () => this.send({ t: 'group', action: 'invite', name: el.dataset.frInvite! })));
    body.querySelectorAll<HTMLElement>('[data-befriend]').forEach((el) => (el.onclick = () => this.send({ t: 'friend', action: 'add', name: el.dataset.befriend! })));
    body.querySelectorAll<HTMLElement>('[data-unfriend]').forEach((el) => (el.onclick = () => void ask(L('fr_confirm_remove', { name: el.dataset.unfriend! })).then((ok) => ok && this.send({ t: 'friend', action: 'remove', name: el.dataset.unfriend! }))));
  }

  /** The guild finder for a captain with no guild (docs/11 P6): the guilds recruiting, a word about oneself, a
   *  request a guild. */
  private recruitingCard(state: ClientState): string {
    const rows = state.recruiting.map((r) => `<div class="lfg-row"><div><b>${esc(r.name)}</b> <span class="who-tag">[${esc(r.tag)}]</span> <span class="muted">${esc(L('gr_row', { n: r.members }))}</span>${r.note ? `<div class="lfg-note">«${esc(r.note)}»</div>` : ''}</div>${r.applied ? `<span class="muted">${L('gr_applied')}</span>` : `<button class="btn btn-small" data-gapply="${r.id}">${L('gr_apply')}</button>`}</div>`).join('');
    return `<div class="card"><h4 class="card-h">${icon('tab_guild', '', 'ico-md')}${L('gr_title')}</h4>
      ${rows ? `<p class="muted">${L('gr_text')}</p><div class="row lfg-form"><input id="gr-note" placeholder="${L('gr_ph')}" maxlength="120"></div><div class="lfg-list">${rows}</div>` : `<p class="muted">${L('gr_none')}</p>`}</div>`;
  }

  /** Recruiting for the guild's officers (docs/11 P6): the note captains with no guild see, and their requests. */
  private recruitCard(g: NonNullable<ClientState['guild']>): string {
    const open = g.recruit !== null && g.recruit !== undefined;
    const reqs = (g.requests ?? []).map((r) => `<div class="lfg-row"><div>${r.online ? '●' : '○'} <b>${esc(r.name)}</b> <span class="muted">${esc(L('gr_req_row', { level: r.level }))}</span>${r.note ? `<div class="lfg-note">«${esc(r.note)}»</div>` : ''}</div><span class="fr-btns"><button class="btn btn-small btn-primary" data-greq="${r.account}" data-yes="1">${L('gr_accept')}</button><button class="btn btn-small" data-greq="${r.account}">${L('gr_decline')}</button></span></div>`).join('');
    return `<div class="card"><h4 class="card-h">${icon('tab_guild', '', 'ico-md')}${L('gr_open_title')}</h4><p class="muted">${L('gr_open_text')}</p>
      <div class="row lfg-form"><input id="gr-own" placeholder="${L('gr_note_ph')}" maxlength="120" value="${esc(g.recruit ?? '')}"><button class="btn btn-small${open ? '' : ' btn-primary'}" id="gr-set">${L(open ? 'gr_update' : 'gr_open')}</button>${open ? `<button class="btn btn-small" id="gr-close">${L('gr_close')}</button>` : ''}</div>
      ${open ? `<div class="mq-head" style="margin-top:8px">${L('gr_requests')}</div><div class="lfg-list">${reqs || `<p class="muted">${L('gr_no_requests')}</p>`}</div>` : ''}</div>`;
  }

  /** Who is at sea (docs/11 P6): a search of the captains aboard; each found may be whispered to, called aboard or
   *  befriended. */
  private whoCard(state: ClientState, canInvite: boolean): string {
    const w = state.who;
    const where = (e: NonNullable<ClientState['who']>['list'][number]) => {
      const port = e.docked ? state.ports.find((p) => p.id === e.docked)?.name ?? e.docked : null;
      return L('who_row', { level: e.level, where: port ? L('fr_in_port', { port: placeName(port) }) : placeName(REGIONS[e.region]?.name ?? e.region) });
    };
    const friends = new Set(state.friends.map((f) => f.name));
    const rows = (w?.list ?? []).map((e) => `<div class="fr-row on"><i class="fr-dot"></i><div class="fr-who"><b class="insp-name" data-inspect="${esc(e.name)}" role="button" tabindex="0">${esc(e.name)}</b>${e.guild ? ` <span class="who-tag">[${esc(e.guild)}]</span>` : ''} <span class="muted">${esc(where(e))}</span></div>
      <span class="fr-btns"><button class="btn btn-small" data-whisper="${esc(e.name)}">${L('fr_whisper')}</button>${canInvite && !e.grouped ? `<button class="btn btn-small" data-fr-invite="${esc(e.name)}">${L('fr_invite')}</button>` : ''}${friends.has(e.name) ? '' : `<button class="btn btn-small" data-befriend="${esc(e.name)}">${L('fr_befriend')}</button>`}</span></div>`).join('');
    return `<div class="card"><h4 class="card-h">${icon('menu_map', '', 'ico-md')}${L('who_title')}</h4>
      <p class="muted">${L('who_text')}</p>
      <div class="row lfg-form fr-form"><input id="who-q" placeholder="${L('who_ph')}" maxlength="24"><button class="btn" id="who-find">${L('who_find')}</button></div>
      <label class="who-here"><input type="checkbox" id="who-here"> ${L('who_here')}</label>
      ${w ? `<div class="fr-list">${rows || `<p class="muted">${L('who_none')}</p>`}</div>${w.total > w.list.length ? `<p class="muted">${esc(L('who_more', { n: w.total }))}</p>` : ''}` : ''}</div>`;
  }

  /** Friends (docs/11 P6): who is at sea, at what level and where; a whisper, a call aboard, off the list. */
  private friendsCard(state: ClientState, canInvite: boolean, grouped: string[]): string {
    const where = (f: ClientState['friends'][number]) => {
      if (!f.online) return L('fr_ashore');
      const port = f.docked ? state.ports.find((p) => p.id === f.docked)?.name ?? f.docked : null;
      return L('fr_row', { level: f.level ?? 1, where: port ? L('fr_in_port', { port: placeName(port) }) : placeName(REGIONS[f.region!]?.name ?? f.region ?? '') });
    };
    const rows = state.friends.map((f) => `<div class="fr-row${f.online ? ' on' : ''}"><i class="fr-dot"></i><div class="fr-who">${f.online ? `<b class="insp-name" data-inspect="${esc(f.name)}" role="button" tabindex="0">${esc(f.name)}</b>` : `<b>${esc(f.name)}</b>`} <span class="muted">${esc(where(f))}</span></div>
      <span class="fr-btns">${f.online ? `<button class="btn btn-small" data-whisper="${esc(f.name)}">${L('fr_whisper')}</button>${canInvite && !grouped.includes(f.name) ? `<button class="btn btn-small" data-fr-invite="${esc(f.name)}">${L('fr_invite')}</button>` : ''}` : ''}<button class="btn btn-small" data-letter="${esc(f.name)}">${L('fr_letter')}</button><button class="btn btn-small" data-unfriend="${esc(f.name)}" title="${esc(L('fr_remove'))}" aria-label="${esc(L('fr_remove'))}">✕</button></span></div>`).join('');
    return `<div class="card"><h4 class="card-h">${icon('tab_group', '', 'ico-md')}${L('fr_title')} <span class="muted fr-count">${L('fr_count', { n: state.friends.length, max: FRIENDS_MAX })}</span></h4>
      <p class="muted">${L('fr_text')}</p>
      <div class="row lfg-form fr-form"><input id="fr-name" placeholder="${L('fr_ph')}" maxlength="40"><button class="btn" id="fr-add">${L('fr_add')}</button><button class="btn" id="fr-ignore">${L('fr_ignore')}</button></div>
      <div class="fr-list">${rows || `<p class="muted">${L('fr_none')}</p>`}</div>
      ${state.ignored.length ? `<div class="fr-ign"><span class="muted">${L('fr_ignored')}</span>${state.ignored.map((n) => `<button class="btn btn-small" data-unignore="${esc(n)}" title="${esc(L('fr_unignore', { name: n }))}">${esc(n)} ✕</button>`).join('')}</div>` : ''}</div>`;
  }

  /** Looking for a group (docs/11 P6): one's own posting, and the captains at sea looking, to be called aboard. */
  private lfgCard(state: ClientState, grouped: boolean, canInvite: boolean): string {
    const mine = state.lfgMine;
    const rows = state.lfg.map((e) => `<div class="lfg-row"><div><b>${esc(e.name)}</b> <span class="muted">${esc(L('lfg_row', { level: e.level, region: placeName(REGIONS[e.region]?.name ?? e.region), mins: e.mins }))}</span>${e.note ? `<div class="lfg-note">«${esc(e.note)}»</div>` : ''}</div>${canInvite ? `<button class="btn btn-small" data-lfg-invite="${esc(e.name)}">${L('lfg_invite')}</button>` : ''}</div>`).join('');
    return `<div class="card"><h4 class="card-h">${icon('tab_group', '', 'ico-md')}${L('lfg_title')}</h4>
      ${grouped ? '' : `<p class="muted">${L('lfg_text')}</p>${mine !== null ? `<p>${esc(L('lfg_mine', { note: mine || '—' }))}</p>` : ''}
        <div class="row lfg-form"><input id="lfg-note" placeholder="${L('lfg_ph')}" maxlength="80" value="${esc(mine ?? '')}"><button class="btn btn-primary" id="lfg-post">${L(mine !== null ? 'lfg_update' : 'lfg_post')}</button>${mine !== null ? `<button class="btn" id="lfg-stop">${L('lfg_stop')}</button>` : ''}</div>`}
      <div class="lfg-list">${rows || `<p class="muted">${L('lfg_none')}</p>`}</div></div>`;
  }

  private renderIsles(body: HTMLElement, state: ClientState): void {
    const hs = state.holdings;
    const self = state.self;
    const guildLease = !!state.guild && ['admiral', 'vice'].includes(state.guild.rank);
    const offer = (o: IslandOffer) => `<div class="card"><h4 class="card-h">${icon('tab_isles', '', 'ico-md')}<span>${esc(placeName(o.name))} <span class="muted">${L('isl_offer_meta', { size: L(`size_${o.size}`), slots: o.slots, slotw: slotW(o.slots), biome: esc(L(`biome_${o.biome}`)) })}${o.mine ? L('isl_ore') : ''}</span></span></h4>
      ${o.held ? `<p class="muted">${L('isl_leased', { who: esc(o.held) })}${!hs.mine.some((h) => h.island === o.island) && !hs.sieges.some((x) => x.island === o.island) ? ` <button class="btn btn-small btn-danger" data-siege="${o.island}" title="${esc(L('isl_siege_hint'))}">${L('isl_siege_btn')}</button>` : ''}</p>` : o.why ? `<p class="muted">${esc(sv(o.why))}</p>` : `<div class="rent-grid">${([7, 14, 30] as const).map((d) => `<button class="btn btn-small" data-rent="${o.island}" data-days="${d}"><b>${L('isl_days', { d, days: dayW(d) })}</b>${money(o.price[d])}</button>`).join('')}</div>
        ${guildLease ? `<div class="row" style="gap:6px"><span class="muted">${L('isl_for_guild')}</span>${([7, 14, 30] as const).map((d) => `<button class="btn btn-small" data-glease="${o.island}" data-days="${d}">${L('isl_days', { d, days: dayW(d) })}</button>`).join('')}</div>` : ''}`}</div>`;
    const here = hs.here && !hs.mine.some((h) => h.island === hs.here!.island) ? offer(hs.here) : '';
    const nearId = hs.here?.island ?? -1;
    const holding = (h: HoldingView) => {
      const near = h.island === nearId;
      const used = h.buildings.reduce((n, b) => n + BUILDINGS[b.id].slots, 0);
      const days = Math.max(0, (h.until - Date.now()) / 86_400_000);
      const has = (id: BuildingId) => h.buildings.some((b) => b.id === id);
      const yardTier = has('dry_dock') ? 4 : has('shipyard') ? 3 : 0;
      const builds = (self?.builds ?? []).filter((b) => b.port === `isle:${h.island}`);
      const berths = (self?.berths ?? []).map((b, i) => ({ b, i })).filter((x) => x.b.port === `isle:${h.island}`);
      return `<div class="card"><h4 class="card-h">${icon('tab_holdings', '', 'ico-md')}<span>${esc(placeName(h.name))} <span class="muted">${L('isl_hold_meta', { region: esc(REGIONS[h.region]?.name ?? h.region.replace(/_/g, ' ')), size: L(`size_${h.size}`), used, slots: h.slots })}${h.guild ? L('isl_guild', { base: h.base ? BASE_NAMES(h.base) : L('isl_island') }) : ''}</span></span></h4>
        <p>${L('isl_lease')} <b>${days >= 1 ? `${Math.floor(days)} ${dayW(Math.floor(days))}` : days > 0 ? `${Math.ceil(days * 24)} ${hourW(Math.ceil(days * 24))}` : `<span class="bad">${L('isl_runout')}</span>`}</b> · ${L('isl_week', { price: fmt(h.renew) })} · <label><input type="checkbox" data-auto="${h.island}" ${h.autoRenew ? 'checked' : ''}> ${L('isl_auto')}</label></p>
        <p>${L('isl_treasury')} ${money(h.treasury)} · ${L('isl_upkeep', { n: fmt(h.upkeep) })} · <input type="number" value="1000" step="500" style="width:90px" data-tamt="${h.island}"> <button class="btn btn-small" data-tin="${h.island}">${L('deposit')}</button> <button class="btn btn-small" data-tout="${h.island}">${L('withdraw')}</button></p>
        <table class="grid">${h.buildings.map((b, i) => `<tr><td>${icon(`build_${b.id}`)}${esc(BUILDINGS[b.id].name)}</td><td class="${b.unpaid ? 'bad' : 'muted'}">${Math.round(b.condition * 100)}%${b.unpaid ? L('isl_unpaid') : ''}</td><td>${near ? `<button class="btn btn-small btn-danger" data-demolish="${h.island}" data-index="${i}">${L('isl_demolish')}</button>` : ''}</td></tr>`).join('') || `<tr><td class="muted">${L('isl_bare')}</td></tr>`}</table>
        <p class="muted">${L('isl_store', { cap: h.storeCap, list: Object.entries(h.store).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) => `${n} ${esc(GOODS[g as GoodId].name)}`).join(', ') || L('empty') })}</p>
        ${near ? `<div class="row"><select data-sgood="${h.island}">${GOOD_IDS.map((g) => `<option value="${g}">${esc(GOODS[g].name)}</option>`).join('')}</select><input type="number" value="10" style="width:70px" data-sqty="${h.island}"><button class="btn btn-small" data-sin="${h.island}">${L('isl_land')}</button><button class="btn btn-small" data-sout="${h.island}">${L('isl_load')}</button></div>
          <div class="row" style="gap:6px;flex-wrap:wrap">${has('shipyard') ? `<button class="btn btn-small" data-svc="repair" data-isl="${h.island}">${L('isl_repair')}</button>` : ''}${has('tavern') ? `<button class="btn btn-small" data-svc="hire" data-isl="${h.island}" data-arg="5">${L('isl_hire')}</button>` : ''}${has('workshop') ? `<button class="btn btn-small" data-svc="craft" data-isl="${h.island}" data-arg="planks">${L('isl_planks')}</button><button class="btn btn-small" data-svc="craft" data-isl="${h.island}" data-arg="sailcloth">${L('isl_sailcloth')}</button>` : ''}${has('chart_house') ? (self?.maps ?? []).map((m) => `<button class="btn btn-small" data-svc="copy_map" data-isl="${h.island}" data-arg="${esc(m.id)}">${L('isl_copy', { name: esc(m.name) })}</button>`).join('') : ''}</div>
          <details><summary>${L('build')}</summary>${BUILDING_IDS.map((id) => {
            const d = BUILDINGS[id];
            const mats = Object.entries(d.materials).map(([g, n]) => `${n} ${GOODS[g as GoodId].name.toLowerCase()}`).join(', ');
            return `<div class="row" style="padding:2px 0"><span title="${esc(d.description)}">${icon(`build_${id}`)}<b>${esc(d.name)}</b> <span class="muted">${L('isl_bmeta', { n: d.slots, slotw: slotW(d.slots), cost: fmt(d.cost), mats: mats ? ` + ${esc(mats)}` : '', upkeep: fmt(d.upkeep) })}</span></span><button class="btn btn-small" data-build="${h.island}" data-bid="${id}">${L('build')}</button></div>`;
          }).join('')}</details>
          ${yardTier ? `<details><summary>${L('isl_yard', { tier: yardTier === 4 ? 'IV' : 'III' })}</summary>
            <div class="row"><select data-ycls="${h.island}">${(Object.keys(SHIP_CLASSES) as ShipClassId[]).filter((c) => SHIP_CLASSES[c].purchasable && SHIP_CLASSES[c].tier <= yardTier && !SHIP_CLASSES[c].factions).map((c) => `<option value="${c}">${esc(SHIP_CLASSES[c].name)}</option>`).join('')}</select>
            <select data-ywood="${h.island}">${(Object.keys(WOODS) as WoodId[]).filter((w) => WOODS[w].ports === 'all').map((w) => `<option value="${w}">${esc(WOODS[w].name)}</option>`).join('')}</select>
            <input data-yname="${h.island}" placeholder="${L('isl_her_name')}" maxlength="28" style="width:130px"><button class="btn btn-small" data-yorder="${h.island}">${L('isl_keel')}</button></div>
            ${builds.map((b) => `<p>${esc(b.name)} — ${b.done * 1 <= (state.estServerTime() ?? 0) ? `<button class="btn btn-small btn-primary" data-ylaunch="${h.island}" data-id="${esc(b.id)}">${L('isl_launch')}</button>` : L('isl_ready_in', { n: Math.ceil((b.done - state.estServerTime()) / 60) })}</p>`).join('')}
            ${berths.map(({ b, i }) => `<p>${esc(b.name)} <span class="muted">${L('isl_berthed')}</span> <button class="btn btn-small" data-yberth="${h.island}" data-index="${i}">${L('isl_take_out')}</button></p>`).join('')}</details>` : ''}
          <p class="muted">${L('isl_window')} <select data-window="${h.island}">${[16, 17, 18, 19, 20, 21, 22].map((hr) => `<option value="${hr}" ${hr === (h.windowNext ?? h.window) ? 'selected' : ''}>${hr}:00–${hr + 2}:00</option>`).join('')}</select>${h.windowNext !== null ? L('isl_window_change') : ''}</p>`
        : `<p class="muted">${L('isl_lie_off')}</p>`}</div>`;
    };
    const when = (t: number) => `${new Date(t).toUTCString().slice(5, 22)} UTC`;
    const siege = (x: SiegeView) => `<div class="card"><h4 class="${x.attacking ? '' : 'bad'}">${L('sg_title', { name: esc(placeName(x.name)) })} <span class="muted">${L('sg_vs', { a: esc(x.attacker), d: esc(x.defender) })}</span></h4>
      <p>${x.phase === 'notice' ? L('sg_notice', { when: when(x.windowStart) }) : x.phase === 'bombard' ? L('sg_bombard', { when: when(x.windowEnd) }) : x.phase === 'fortify' ? L('sg_fortify', { when: when(x.windowStart) }) : x.phase === 'landing' ? L('sg_landing', { when: when(x.windowEnd), n: x.capture }) : L('sg_fallen')}</p>
      <p class="muted">${L('sg_batteries', { list: x.batteries.map((b) => `${b}%`).join(', ') || L('none') })}${x.fort !== null ? L('sg_fort', { n: x.fort }) : ''}${L('sg_landing_pt', { x: x.landing.x, y: x.landing.y })}</p>
      ${x.phase === 'choose' && x.attacking ? `<div class="row" style="gap:6px"><button class="btn btn-small btn-primary" data-sgc="capture" data-isl="${x.island}">${L('sg_capture')}</button><button class="btn btn-small" data-sgc="plunder" data-isl="${x.island}">${L('sg_plunder')}</button><button class="btn btn-small btn-danger" data-sgc="raze" data-isl="${x.island}">${L('sg_raze')}</button></div>` : ''}
      ${x.phase === 'fortify' && !x.attacking ? `<button class="btn btn-small" data-fortify="${x.island}">${L('sg_rebuild')}</button>` : ''}
      ${x.notes.map((n) => `<p class="muted">${esc(sv(n))}</p>`).join('')}</div>`;
    body.innerHTML = `<div class="cols"><div>
      ${hs.sieges.map(siege).join('')}
      <h3 class="title-sm" style="font-size:20px">${L('isl_yours')}</h3>
      ${hs.mine.map(holding).join('') || `<p class="muted">${L('isl_none')}</p>`}
    </div><div>
      ${here ? `<h3 class="title-sm" style="font-size:20px">${L('isl_off_bow')}</h3>${here}` : ''}
      ${hs.region.length ? `<h3 class="title-sm" style="font-size:20px">${L('isl_region')}</h3>${hs.region.map(offer).join('')}` : ''}
    </div></div>`;
    const q = <T extends HTMLElement>(sel: string) => body.querySelector<T>(sel);
    const num = (sel: string) => Number(q<HTMLInputElement>(sel)?.value ?? 0);
    body.querySelectorAll<HTMLElement>('[data-rent]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'rent', island: Number(el.dataset.rent), days: Number(el.dataset.days) })));
    body.querySelectorAll<HTMLElement>('[data-siege]').forEach((el) => (el.onclick = () => void ask(L('isl_confirm_siege')).then((ok) => ok && this.send({ t: 'isle', action: 'siege', island: Number(el.dataset.siege) }))));
    body.querySelectorAll<HTMLElement>('[data-sgc]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'siege_choice', island: Number(el.dataset.isl), choice: el.dataset.sgc as 'capture' })));
    body.querySelectorAll<HTMLElement>('[data-fortify]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'fortify', island: Number(el.dataset.fortify) })));
    body.querySelectorAll<HTMLElement>('[data-glease]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'lease', island: Number(el.dataset.glease), days: Number(el.dataset.days) })));
    body.querySelectorAll<HTMLInputElement>('[data-auto]').forEach((el) => (el.onchange = () => this.send({ t: 'isle', action: 'auto', island: Number(el.dataset.auto), on: el.checked })));
    body.querySelectorAll<HTMLElement>('[data-tin]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'treasury', island: Number(el.dataset.tin), amount: num(`[data-tamt="${el.dataset.tin}"]`) })));
    body.querySelectorAll<HTMLElement>('[data-tout]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'treasury', island: Number(el.dataset.tout), amount: -num(`[data-tamt="${el.dataset.tout}"]`) })));
    body.querySelectorAll<HTMLElement>('[data-demolish]').forEach((el) => (el.onclick = () => void ask(L('isl_confirm_demolish')).then((ok) => ok && this.send({ t: 'isle', action: 'demolish', island: Number(el.dataset.demolish), index: Number(el.dataset.index) }))));
    body.querySelectorAll<HTMLElement>('[data-build]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'build', island: Number(el.dataset.build), building: el.dataset.bid as BuildingId })));
    const store = (id: string, sign: number) => this.send({ t: 'isle', action: 'store', island: Number(id), good: q<HTMLSelectElement>(`[data-sgood="${id}"]`)!.value as GoodId, qty: sign * num(`[data-sqty="${id}"]`) });
    body.querySelectorAll<HTMLElement>('[data-sin]').forEach((el) => (el.onclick = () => store(el.dataset.sin!, 1)));
    body.querySelectorAll<HTMLElement>('[data-sout]').forEach((el) => (el.onclick = () => store(el.dataset.sout!, -1)));
    body.querySelectorAll<HTMLElement>('[data-svc]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'service', island: Number(el.dataset.isl), what: el.dataset.svc as 'repair', arg: el.dataset.arg })));
    body.querySelectorAll<HTMLSelectElement>('[data-window]').forEach((el) => (el.onchange = () => this.send({ t: 'isle', action: 'window', island: Number(el.dataset.window), hour: Number(el.value) })));
    body.querySelectorAll<HTMLElement>('[data-yorder]').forEach((el) => (el.onclick = () => {
      const id = el.dataset.yorder!;
      const wood = q<HTMLSelectElement>(`[data-ywood="${id}"]`)!.value as WoodId;
      this.send({ t: 'isle', action: 'yard_order', island: Number(id), req: { classId: q<HTMLSelectElement>(`[data-ycls="${id}"]`)!.value as ShipClassId, name: q<HTMLInputElement>(`[data-yname="${id}"]`)!.value, frame: wood, plank: wood, rares: {} } });
    }));
    body.querySelectorAll<HTMLElement>('[data-ylaunch]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'yard_launch', island: Number(el.dataset.ylaunch), id: el.dataset.id! })));
    body.querySelectorAll<HTMLElement>('[data-yberth]').forEach((el) => (el.onclick = () => this.send({ t: 'isle', action: 'yard_berth', island: Number(el.dataset.yberth), index: Number(el.dataset.index) })));
  }

  /** The guild's order of the week (docs/11 P6): the goal, the bar the members fill, one's own part, the time left. */
  private guildWeek(g: NonNullable<ClientState['guild']>): string {
    const w = g.weekly;
    if (!w) return '';
    const pct = Math.min(100, (w.progress / Math.max(1, w.target)) * 100);
    const tail = w.done ? esc(L('g_week_done')) : `${esc(L('g_week_mine', { n: w.mine }))} · ${esc(L('g_week_left', { d: Math.floor(w.endsIn / 86400), h: Math.floor((w.endsIn % 86400) / 3600) }))}`;
    return `<div class="card" title="${esc(L('g_week_hint'))}"><h4 class="card-h">${icon('tab_guild', '', 'ico-md')}${esc(L('g_week'))}</h4>
      <div class="cm-text">${esc(guildGoalText(w.kind, w.target, lang() === 'ru' ? 1 : 0))}</div>
      <div class="cm-bar${w.done ? ' done' : ''}"><i style="width:${pct.toFixed(1)}%"></i><span>${w.progress}/${w.target}</span></div>
      <div class="dl-foot muted">${tail}</div></div>`;
  }

  private renderGuild(body: HTMLElement, state: ClientState): void {
    const g = state.guild;
    const docked = state.self?.dockedAt ?? null;
    const portName = (id: string) => placeName(state.ports.find((p) => p.id === id)?.name ?? id);
    if (!g) {
      body.innerHTML = `<div class="cols"><div>
        ${state.guildInvites.map((i) => `<div class="card"><h4 class="card-h">${icon('tab_letters', '', 'ico-md')}${L('g_invites', { by: esc(i.by), name: esc(i.name), tag: esc(i.tag) })}</h4><button class="btn btn-primary" data-gjoin="${i.id}">${L('join')}</button> <button class="btn" data-gno="${i.id}">${L('decline')}</button></div>`).join('') || `<p class="muted">${L('g_no_invites')}</p>`}
        ${this.recruitingCard(state)}
      </div><div>
        <div class="card"><h4 class="card-h">${icon('tab_guild', '', 'ico-md')}${L('g_found_title')}</h4><p class="muted">${L('g_found_text', { cost: fmt(10000) })}</p>
          <input id="g-name" placeholder="${L('g_ph_name')}" maxlength="24" style="width:100%;margin-bottom:6px">
          <div class="row"><input id="g-tag" placeholder="${L('ph_tag')}" maxlength="4" style="width:80px;text-transform:uppercase"><button class="btn btn-primary" id="g-found" ${docked ? '' : `disabled title="${L('g_in_port')}"`}>${L('g_found_btn')}</button></div></div>
      </div></div>`;
      body.querySelector<HTMLElement>('#g-found')!.onclick = () => this.send({ t: 'guild', action: 'found', name: body.querySelector<HTMLInputElement>('#g-name')!.value, tag: body.querySelector<HTMLInputElement>('#g-tag')!.value });
      body.querySelectorAll<HTMLElement>('[data-gjoin]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'answer', id: Number(el.dataset.gjoin), accept: true })));
      body.querySelectorAll<HTMLElement>('[data-gno]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'answer', id: Number(el.dataset.gno), accept: false })));
      body.querySelectorAll<HTMLElement>('[data-gapply]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'apply', id: Number(el.dataset.gapply), note: body.querySelector<HTMLInputElement>('#gr-note')?.value ?? '' })));
      return;
    }
    const at = (r: GuildRank) => RANK_ORDER.indexOf(g.rank) <= RANK_ORDER.indexOf(r);
    const store = g.here ? g.offices.find((o) => o.port === g.here)?.store ?? {} : null;
    const myBerths = (state.self?.berths ?? []).map((b, i) => ({ b, i })).filter((x) => x.b.port === docked);
    const tagOf = (s: string) => /\[([A-Z0-9]+)\]$/.exec(s)?.[1] ?? '';
    body.innerHTML = `<div class="cols"><div>
      <div class="sec-head"><h3 class="title-sm" style="font-size:20px">${esc(g.name)} [${esc(g.tag)}]</h3><span class="h-count" title="${L('g_you_are', { rank: esc(RANK_NAMES(g.rank)) })}">${esc(RANK_NAMES(g.rank))}</span></div>
      ${g.motd || at('vice') ? `<div class="card g-motd"><h4 class="card-h">${icon('tab_letters', '', 'ico-md')}${L('gm_title')}</h4>${g.motd ? `<p class="lfg-note">«${esc(g.motd)}»</p>` : `<p class="muted">${L('gm_none')}</p>`}${at('vice') ? `<div class="row lfg-form"><input id="gm-text" placeholder="${L('gm_ph')}" maxlength="160" value="${esc(g.motd ?? '')}"><button class="btn btn-small" id="gm-set">${L('gm_set')}</button></div>` : ''}</div>` : ''}
      ${this.guildWeek(g)}
      ${at('commodore') ? this.recruitCard(g) : ''}
      <div class="card"><h4 class="card-h">${icon('coin', '', 'ico-md')}${L('g_treasury', { n: fmt(g.treasury), tax: g.tax })}${g.torn ? L('g_torn') : g.flagship ? L('g_standard_on', { name: esc(g.flagship) }) : ''}</h4>
        <div class="row"><input type="number" id="g-amt" value="1000" step="500" style="width:100px"><button class="btn btn-small" id="g-dep" ${docked ? '' : 'disabled'}>${L('deposit')}</button>${at('vice') ? `<button class="btn btn-small" id="g-wd" ${docked ? '' : 'disabled'}>${L('withdraw')}</button>` : ''}
        ${g.rank === 'admiral' ? `<label>${L('g_tax')} <select id="g-tax">${Array.from({ length: 16 }, (_, i) => `<option ${i === g.tax ? 'selected' : ''}>${i}</option>`).join('')}</select>%</label>` : ''}</div></div>
      <div class="card"><h4 class="card-h">${icon('stat_crew', '', 'ico-md')}${L('g_members', { n: g.members.length })}</h4><table class="grid g-members">${g.members.map((m) => `<tr><td>${m.online ? '●' : '○'} ${esc(m.name)}</td><td>${g.rank === 'admiral' || (g.rank === 'vice' && RANK_ORDER.indexOf(m.rank) > 1) ? `<select data-grank="${m.account}">${RANK_ORDER.map((r) => `<option value="${r}" ${r === m.rank ? 'selected' : ''}>${RANK_NAMES(r)}</option>`).join('')}</select>` : esc(RANK_NAMES(m.rank))}</td>
        <td>${at('vice') && RANK_ORDER.indexOf(m.rank) > RANK_ORDER.indexOf(g.rank) ? `<button class="btn btn-small btn-danger" data-gkick="${m.account}">${L('g_ashore')}</button>` : ''}${g.rank === 'admiral' ? ` <button class="btn btn-small" data-gflag="${m.account}" title="${L('g_flag_title')}">${L('g_flag')}</button>` : ''}</td></tr>`).join('')}</table>
        ${at('commodore') ? `<div class="row"><input id="g-inv" placeholder="${L('g_ph_inv')}" style="flex:1"><button class="btn btn-small" id="g-invite">${L('invite')}</button></div>` : ''}</div>
      <div class="card"><h4 class="card-h">${icon('anchor', '', 'ico-md')}${g.here ? L('g_office_at', { port: esc(portName(g.here)) }) : L('g_office')}</h4>
        ${store ? `<p class="muted">${L('g_store', { list: Object.entries(store).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${n} ${esc(GOODS[k as GoodId].name)}`).join(', ') || L('empty') })}</p>
          <div class="row"><select id="g-good">${goodOptions()}</select><input type="number" id="g-qty" value="10" style="width:70px"><button class="btn btn-small" id="g-put">${L('g_put')}</button><button class="btn btn-small" id="g-take">${L('g_take')}</button></div>`
          : `<p class="muted">${docked ? L('g_no_office') : L('g_office_in_port')}</p>${docked && at('vice') ? `<button class="btn btn-small" id="g-office">${L('g_rent_office', { cost: fmt(2000) })}</button>` : ''}`}
        ${g.offices.length ? `<p class="muted">${L('g_offices', { list: g.offices.map((o) => esc(portName(o.port))).join(', ') })}</p>` : ''}
        ${g.contracts.map((c) => `<p>${L('g_contract_line', { qty: c.qty, good: esc(GOODS[c.good].name), port: esc(portName(c.port)), reward: c.reward })} <span class="muted">(${esc(c.by)})</span>${at('vice') ? ` <button class="btn btn-small" data-gdrop="${c.id}">${L('withdraw')}</button>` : ''}</p>`).join('')}
        ${store && at('vice') ? `<div class="row"><span class="muted">${L('g_contract')}</span><select id="g-cgood">${goodOptions()}</select><input type="number" id="g-cqty" value="100" style="width:70px"><input type="number" id="g-crew" value="30" style="width:60px"><button class="btn btn-small" id="g-contract">${L('post')}</button></div>` : ''}</div>
      <div class="card"><h4 class="card-h">${icon('menu_ship', '', 'ico-md')}${L('g_fleet')}</h4>${g.fleet.map((f) => `<p>${esc(f.name)} <span class="muted">${L('g_fleet_meta', { cls: esc(SHIP_CLASSES[f.classId].name), hull: f.hull, where: f.lentTo ? L('g_out_with', { name: esc(f.lentTo) }) : L('g_at', { port: esc(portName(f.port)) }), giver: esc(f.giver) })}</span>${!f.lentTo && f.port === docked && at('captain') ? ` <button class="btn btn-small" data-gborrow="${f.id}">${L('g_borrow')}</button>` : ''}</p>`).join('') || `<p class="muted">${L('g_no_hulls')}</p>`}
        ${docked && at('captain') ? myBerths.map(({ b, i }) => `<button class="btn btn-small" data-ggive="${i}">${L('g_give', { name: esc(b.name) })}</button>`).join(' ') + ` <button class="btn btn-small" id="g-return">${L('g_return')}</button>` : ''}</div>
    </div><div>
      <div class="card"><h4 class="card-h">${icon('tab_law', '', 'ico-md')}${L('g_diplomacy')}</h4>
        ${!g.wars.length && !g.alliance.length && !g.pacts.length && !g.offers.length && !at('vice') ? `<p class="muted">${L('g_no_relations')}</p>` : ''}
        ${g.wars.map((w) => `<p>${L('g_war', { name: esc(w.with) })} — ${w.active ? L('g_score', { a: w.ours, b: w.theirs }) : L('g_opens', { when: new Date(w.opensAt).toUTCString().slice(5, 22) })}${w.terms ? `${L('g_peace_offered', { by: w.terms.fromUs ? L('g_by_us') : L('g_by_them') })}${w.terms.tribute ? L('g_tribute', { n: fmt(w.terms.tribute) }) : ''}` : ''}
          ${g.rank === 'admiral' && Date.now() >= w.minEnd ? ` <input type="number" value="0" style="width:80px" data-gtrib="${esc(w.tag)}"><button class="btn btn-small" data-gpeace="${esc(w.tag)}">${w.terms && !w.terms.fromUs ? L('g_accept_peace') : L('g_offer_peace')}</button>` : ''}</p>`).join('')}
        ${g.alliance.length ? `<p>${L('g_allied', { list: g.alliance.map(esc).join(', ') })}${at('vice') ? ` <button class="btn btn-small" data-gbreak="alliance" data-tag="${esc(tagOf(g.alliance[0]))}">${L('g_leave_alliance')}</button>` : ''}</p>` : ''}
        ${g.pacts.map((p) => `<p>${L('g_pact', { name: esc(p) })}${at('vice') ? ` <button class="btn btn-small" data-gbreak="pact" data-tag="${esc(tagOf(p))}">${L('g_end_it')}</button>` : ''}</p>`).join('')}
        ${g.offers.map((o) => `<p>${o.kind === 'alliance' ? L('g_offers_alliance', { from: esc(o.from) }) : L('g_offers_pact', { from: esc(o.from) })}${at('vice') ? ` <button class="btn btn-small btn-primary" data-gtreaty="${o.kind}" data-tag="${esc(tagOf(o.from))}">${L('g_agree')}</button>` : ''}</p>`).join('')}
        ${at('vice') ? `<div class="row"><input id="g-dtag" placeholder="${L('ph_tag')}" maxlength="4" style="width:70px;text-transform:uppercase"><button class="btn btn-small" data-gtreaty="alliance" data-from-input="1">${L('g_offer_alliance')}</button><button class="btn btn-small" data-gtreaty="pact" data-from-input="1">${L('g_offer_pact')}</button>${g.rank === 'admiral' ? `<button class="btn btn-small btn-danger" id="g-war">${L('g_declare_war')}</button>` : ''}</div>` : ''}</div>
      <div class="card"><h4 class="card-h">${icon('map_port', '', 'ico-md')}${L('g_routes')}</h4><p class="muted">${L('g_routes_text')}</p>
        <table class="grid">${g.nodes.map((n) => `<tr><td>${esc(placeName(n.name))}</td><td class="muted">${esc(REGIONS[n.region]?.name ?? n.region.replace(/_/g, ' '))}</td><td>${n.ours ? L('g_ours_toll', { toll: at('vice') ? `<select data-gtoll="${n.island}">${[1, 2, 3, 4, 5].map((t) => `<option ${t === n.toll ? 'selected' : ''}>${t}</option>`).join('')}</select>` : n.toll }) : n.holder ? esc(n.holder) : `<span class="muted">${L('nobody')}</span>`}${n.progress && !n.ours ? L('g_taking', { n: n.progress }) : ''}</td></tr>`).join('')}</table></div>
      ${g.islands.length ? `<div class="card"><h4 class="card-h">${icon('tab_isles', '', 'ico-md')}${L('g_islands')}</h4> ${g.islands.map((i) => `<p>${esc(placeName(i.name))} — ${i.base ? BASE_NAMES(i.base) : L('g_no_base')}${at('vice') && i.base < 5 ? ` <button class="btn btn-small" data-gbase="${i.island}">${L('g_raise', { base: BASE_NAMES(i.base + 1) })}</button>` : ''}</p>`).join('')}</div>` : ''}
      <div class="card"><h4 class="card-h">${icon('map_contract', '', 'ico-md')}${L('g_log')}</h4>${g.log.map((l) => `<p class="muted">${ago(l.t)} — ${esc(sv(l.text))}</p>`).join('')}</div>
      <p>${g.rank === 'admiral' ? `<button class="btn btn-danger" id="g-disband">${L('g_disband')}</button>` : `<button class="btn btn-danger" id="g-leave">${L('g_leave')}</button>`} <span class="muted">${L('g_chat')}</span></p>
    </div></div>`;
    const q = <T extends HTMLElement>(sel: string) => body.querySelector<T>(sel);
    const v = (sel: string) => q<HTMLInputElement>(sel)?.value ?? '';
    const on = (sel: string, fn: () => void) => q(sel)?.addEventListener('click', fn);
    on('#g-dep', () => this.send({ t: 'guild', action: 'treasury', amount: Number(v('#g-amt')) }));
    on('#g-wd', () => this.send({ t: 'guild', action: 'treasury', amount: -Number(v('#g-amt')) }));
    q<HTMLSelectElement>('#g-tax')?.addEventListener('change', () => this.send({ t: 'guild', action: 'tax', pct: Number(v('#g-tax')) }));
    on('#g-invite', () => v('#g-inv') && this.send({ t: 'guild', action: 'invite', name: v('#g-inv') }));
    on('#g-office', () => this.send({ t: 'guild', action: 'office' }));
    on('#g-put', () => this.send({ t: 'guild', action: 'store', good: v('#g-good') as GoodId, qty: Number(v('#g-qty')) }));
    on('#g-take', () => this.send({ t: 'guild', action: 'store', good: v('#g-good') as GoodId, qty: -Number(v('#g-qty')) }));
    on('#g-contract', () => this.send({ t: 'guild', action: 'contract', good: v('#g-cgood') as GoodId, qty: Number(v('#g-cqty')), reward: Number(v('#g-crew')) }));
    on('#g-return', () => this.send({ t: 'guild', action: 'return_ship' }));
    on('#g-war', () => v('#g-dtag') && void ask(L('g_confirm_war', { tag: v('#g-dtag').toUpperCase() })).then((ok) => ok && this.send({ t: 'guild', action: 'war', tag: v('#g-dtag') })));
    on('#g-leave', () => void ask(L('g_confirm_leave')).then((ok) => ok && this.send({ t: 'guild', action: 'leave' })));
    on('#g-disband', () => void ask(L('g_confirm_disband')).then((ok) => ok && this.send({ t: 'guild', action: 'disband' })));
    body.querySelector<HTMLElement>('#gm-set')?.addEventListener('click', () => this.send({ t: 'guild', action: 'motd', text: body.querySelector<HTMLInputElement>('#gm-text')?.value ?? '' }));
    body.querySelector<HTMLElement>('#gr-set')?.addEventListener('click', () => this.send({ t: 'guild', action: 'recruit', note: body.querySelector<HTMLInputElement>('#gr-own')?.value ?? '' }));
    body.querySelector<HTMLElement>('#gr-close')?.addEventListener('click', () => this.send({ t: 'guild', action: 'recruit', note: null }));
    body.querySelectorAll<HTMLElement>('[data-greq]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'request', account: Number(el.dataset.greq), accept: !!el.dataset.yes })));
    body.querySelectorAll<HTMLSelectElement>('[data-grank]').forEach((el) => (el.onchange = () => this.send({ t: 'guild', action: 'rank', account: Number(el.dataset.grank), rank: el.value as GuildRank })));
    body.querySelectorAll<HTMLElement>('[data-gkick]').forEach((el) => (el.onclick = () => void ask(L('g_confirm_kick')).then((ok) => ok && this.send({ t: 'guild', action: 'kick', account: Number(el.dataset.gkick) }))));
    body.querySelectorAll<HTMLElement>('[data-gflag]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'flagship', account: Number(el.dataset.gflag) })));
    body.querySelectorAll<HTMLElement>('[data-gdrop]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'drop_contract', id: Number(el.dataset.gdrop) })));
    body.querySelectorAll<HTMLElement>('[data-gborrow]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'borrow_ship', id: Number(el.dataset.gborrow) })));
    body.querySelectorAll<HTMLElement>('[data-ggive]').forEach((el) => (el.onclick = () => void ask(L('g_confirm_give')).then((ok) => ok && this.send({ t: 'guild', action: 'give_ship', berth: Number(el.dataset.ggive) }))));
    body.querySelectorAll<HTMLElement>('[data-gpeace]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'peace', tag: el.dataset.gpeace!, tribute: Number(q<HTMLInputElement>(`[data-gtrib="${el.dataset.gpeace}"]`)?.value ?? 0) })));
    body.querySelectorAll<HTMLElement>('[data-gbreak]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: el.dataset.gbreak === 'alliance' ? 'break_alliance' : 'break_pact', tag: el.dataset.tag! })));
    body.querySelectorAll<HTMLElement>('[data-gtreaty]').forEach((el) => (el.onclick = () => {
      const tag = el.dataset.fromInput ? v('#g-dtag') : el.dataset.tag!;
      if (tag) this.send({ t: 'guild', action: el.dataset.gtreaty as 'alliance', tag });
    }));
    body.querySelectorAll<HTMLSelectElement>('[data-gtoll]').forEach((el) => (el.onchange = () => this.send({ t: 'guild', action: 'toll', island: Number(el.dataset.gtoll), pct: Number(el.value) })));
    body.querySelectorAll<HTMLElement>('[data-gbase]').forEach((el) => (el.onclick = () => this.send({ t: 'guild', action: 'base', island: Number(el.dataset.gbase) })));
  }

  private renderLaw(body: HTMLElement, state: ClientState): void {
    const v = state.self?.pvp;
    if (!v) return;
    const now = Date.now();
    const d = state.duel;
    const mins = (ms: number) => Math.max(1, Math.ceil((ms - now) / 60_000));
    body.innerHTML = `<div class="cols"><div>
      <div class="card"><h4 class="card-h">${icon('tab_law', '', 'ico-md')}${L('law_colours')}</h4>
        <p>${v.blackFlag ? L('law_black_on') : L('law_plain')}</p>
        <button class="btn ${v.blackFlag ? '' : 'btn-danger'}" id="bf">${v.blackFlag ? L('law_strike') : L('law_hoist')}</button>
        ${v.pennant ? `<p class="good">${L('law_pennant', { n: v.pennantHoursLeft })}</p>` : ''}
        ${v.bubbleUntil > now ? `<p class="good">${L('law_bubble', { n: mins(v.bubbleUntil) })}</p>` : ''}
        ${v.shameUntil > now ? `<p class="bad">${L('law_shame', { n: mins(v.shameUntil) })}</p>` : ''}
        ${v.bounty ? `<p class="bad">${L('law_bounty', { n: fmt(v.bounty) })}</p>` : ''}
        <p class="muted">${L('law_stats', { duels: v.duels, wins: v.duelWins, rating: v.rating })}${v.hunter ? L('law_hunter') : ''}</p></div>
      <div class="card"><h4 class="card-h">${icon('tree_boarding', '', 'ico-md')}${L('law_duels')}</h4>
        ${d ? `<p><b>${d.startsIn ? L('duel_guns', { n: d.startsIn }) : L('duel_left', { t: `${Math.floor(d.endsIn / 60)}:${String(d.endsIn % 60).padStart(2, '0')}` })}</b> — ${d.sides.map((side) => side.map((x) => `${esc(x.name)}${x.struck ? L('duel_struck') : ''}`).join(', ')).join(` <i>${L('duel_against')}</i> `)}</p><button class="btn btn-danger" id="yield">${L('duel_yield')}</button>`
          : `<p class="muted">${L('duel_text')}</p>
        <div class="row"><input id="duel-name" placeholder="${L('ph_captain')}" maxlength="20" style="flex:1"><label><input type="checkbox" id="duel-fleet"> ${L('duel_groups')}</label><button class="btn" id="duel">${L('duel_challenge')}</button></div>`}
        ${v.challenges.map((c) => `<div class="row"><span>${L('duel_challenges', { from: esc(c.from) })}${c.fleet ? L('duel_fleet') : ''}</span><span><button class="btn btn-small btn-primary" data-duel-yes="${c.id}">${L('accept')}</button> <button class="btn btn-small" data-duel-no="${c.id}">${L('decline')}</button></span></div>`).join('')}</div>
    </div><div>
      <div class="card"><h4 class="card-h">${icon('wanted', '', 'ico-md')}${L('bnt_board')}</h4>
        <table class="grid">${state.bounties.map((b) => `<tr><td>${esc(b.name)}</td><td>${L('bnt_total', { n: fmt(b.total) })}</td><td class="muted">${L('bnt_backers', { n: b.backers, word: plural(b.backers, L('backer_one'), L('backer_few'), L('backer_many')) })}${b.wanted ? L('bnt_wanted', { n: b.wanted }) : ''}${b.atSea ? L('bnt_at_sea') : ''}</td></tr>`).join('') || `<tr><td class="muted">${L('bnt_none')}</td></tr>`}</table>
        <p class="muted">${L('bnt_text')}</p></div>
      ${v.sunkBy.length ? `<div class="card"><h4 class="card-h">${icon('danger', '', 'ico-md')}${L('bnt_sunk_by')}</h4>${v.sunkBy.map((k) => `<div class="row"><span>${esc(k.name)} <span class="muted">${ago(k.t)}${k.free ? L('bnt_free') : L('bnt_fee')}</span></span>
          <span><input type="number" min="1000" step="500" value="1000" style="width:90px" data-bamt="${esc(k.name)}"><button class="btn btn-small" data-bounty="${esc(k.name)}" ${state.self?.dockedAt ? '' : `disabled title="${L('bnt_at_office')}"`}>${L('bnt_price')}</button></span></div>`).join('')}
        <p class="muted">${L('bnt_see')}</p></div>` : ''}
    </div></div>`;
    body.querySelector<HTMLElement>('#bf')!.onclick = () => this.send({ t: 'pvp', action: 'black_flag', on: !v.blackFlag });
    body.querySelector<HTMLElement>('#yield')?.addEventListener('click', () => this.send({ t: 'pvp', action: 'forfeit' }));
    body.querySelector<HTMLElement>('#duel')?.addEventListener('click', () => {
      const name = body.querySelector<HTMLInputElement>('#duel-name')!.value.trim();
      if (name) this.send({ t: 'pvp', action: 'duel', name, fleet: body.querySelector<HTMLInputElement>('#duel-fleet')!.checked });
    });
    body.querySelectorAll<HTMLElement>('[data-duel-yes]').forEach((el) => (el.onclick = () => this.send({ t: 'pvp', action: 'duel_answer', id: Number(el.dataset.duelYes), accept: true })));
    body.querySelectorAll<HTMLElement>('[data-duel-no]').forEach((el) => (el.onclick = () => this.send({ t: 'pvp', action: 'duel_answer', id: Number(el.dataset.duelNo), accept: false })));
    body.querySelectorAll<HTMLElement>('[data-bounty]').forEach((el) => (el.onclick = () => {
      const amt = Number(body.querySelector<HTMLInputElement>(`[data-bamt="${el.dataset.bounty}"]`)!.value);
      this.send({ t: 'pvp', action: 'bounty', name: el.dataset.bounty!, amount: amt });
    }));
  }

  private renderLetters(body: HTMLElement, state: ClientState): void {
    const docked = state.self?.dockedAt ?? null;
    body.innerHTML = `<div class="cols"><div>
      <h3 class="title-sm" style="font-size:20px">${L('let_title')}</h3>
      ${state.letters.map((l) => `<div class="card letter ${l.read ? '' : 'unread'}"><h4>${esc(l.subject)} <span class="muted">${L('let_meta', { from: esc(l.from), ago: ago(l.sentAt) })}</span></h4>
        ${l.body ? `<p style="white-space:pre-wrap">${esc(l.body)}</p>` : ''}
        ${!l.taken ? `<p><b>${l.gold ? L('let_silver', { n: fmt(l.gold) }) : ''}${l.goods ? L('let_goods', { qty: l.goods.qty, good: esc(GOODS[l.goods.good].name), port: esc(state.ports.find((p) => p.id === l.goods!.port)?.name ?? l.goods.port) }) : ''}</b></p>` : ''}
        <div class="row" style="gap:6px">${!l.read ? `<button class="btn btn-small" data-read="${l.id}">${L('let_mark')}</button>` : ''}
          ${!l.taken ? `<button class="btn btn-small btn-primary" data-take="${l.id}" ${docked && (!l.goods || l.goods.port === docked) ? '' : `disabled title="${L('let_collect_port')}"`}>${L('let_collect')}</button>` : `<button class="btn btn-small" data-del="${l.id}">${L('let_burn')}</button>`}</div></div>`).join('') || `<p class="muted">${L('let_none')}</p>`}
    </div><div>
      <div class="card"><h4 class="card-h">${icon('tab_letters', '', 'ico-md')}${L('let_write')}</h4>
        ${docked ? `<p class="muted">${L('let_packet')}</p>
        <input id="m-to" placeholder="${L('let_ph_to')}" maxlength="20" style="width:100%;margin-bottom:6px" value="${esc(this.mailTo)}">
        <input id="m-subj" placeholder="${L('let_ph_subject')}" maxlength="60" style="width:100%;margin-bottom:6px">
        <textarea id="m-body" rows="5" maxlength="1000" placeholder="${L('let_ph_body')}" style="width:100%;margin-bottom:6px"></textarea>
        <div class="row"><label>${L('let_draft')} <input id="m-gold" type="number" min="0" max="100000" value="0" style="width:110px"> ${L('let_silver_word')}</label><button class="btn btn-primary" id="m-send">${L('send')}</button></div>` : `<p class="muted">${L('let_office')}</p>`}</div>
    </div></div>`;
    const v = (id: string) => body.querySelector<HTMLInputElement | HTMLTextAreaElement>(id)?.value ?? '';
    // The addressee stays in the field (the list may redraw it) until the letter goes or the tab changes.
    body.querySelector<HTMLInputElement>('#m-to')?.addEventListener('input', (e) => (this.mailTo = (e.target as HTMLInputElement).value));
    body.querySelector<HTMLElement>('#m-send')?.addEventListener('click', () => {
      if (!v('#m-to').trim()) return;
      this.mailTo = '';
      this.send({ t: 'mail', action: 'send', to: v('#m-to'), subject: v('#m-subj'), body: v('#m-body'), gold: Number(v('#m-gold')) || 0 });
    });
    body.querySelectorAll<HTMLElement>('[data-read]').forEach((el) => (el.onclick = () => this.send({ t: 'mail', action: 'read', id: Number(el.dataset.read) })));
    body.querySelectorAll<HTMLElement>('[data-take]').forEach((el) => (el.onclick = () => this.send({ t: 'mail', action: 'take', id: Number(el.dataset.take) })));
    body.querySelectorAll<HTMLElement>('[data-del]').forEach((el) => (el.onclick = () => this.send({ t: 'mail', action: 'delete', id: Number(el.dataset.del) })));
  }

  private renderMarket(body: HTMLElement, state: ClientState): void {
    const mk = state.market;
    const hold = state.self?.cargo ?? {};
    if (!mk || mk.port !== state.self?.dockedAt) {
      body.innerHTML = `<p class="muted">${L('mk_reading')}</p>`;
      return;
    }
    const row = (l: ListingView) => {
      const name = esc(GOODS[l.good].name);
      if (l.kind === 'auction') {
        const next = l.bidder ? Math.max(l.price + 1, Math.ceil(l.price * 1.05)) : l.price;
        return `<tr><td>${l.qty} ${name}</td><td>${esc(l.seller)}</td><td>${l.bidder ? `${fmt(l.price)} (${esc(l.bidder)})` : L('mk_reserve', { n: fmt(l.price) })}${l.buyout ? L('mk_buyout', { n: fmt(l.buyout) }) : ''}</td><td class="muted">${left(l.endsAt)}</td>
          <td>${l.mine ? (l.bidder ? '' : `<button class="btn btn-small" data-cancel="${l.id}">${L('withdraw')}</button>`) : `<input type="number" min="${next}" value="${next}" style="width:90px" data-bidv="${l.id}"><button class="btn btn-small" data-bid="${l.id}">${L('bid')}</button>${l.buyout ? ` <button class="btn btn-small btn-primary" data-buyout="${l.id}" data-price="${l.buyout}">${L('mk_buy_now')}</button>` : ''}`}</td></tr>`;
      }
      return `<tr><td>${L(l.kind === 'sell' ? 'mk_selling' : 'mk_buying', { qty: l.qty, good: name })}</td><td>${esc(l.seller)}</td><td>${L('mk_each', { n: fmt(l.price) })}</td><td class="muted">${left(l.endsAt)}</td>
        <td>${l.mine ? `<button class="btn btn-small" data-cancel="${l.id}">${L('withdraw')}</button>` : `<input type="number" min="1" max="${l.qty}" value="${l.qty}" style="width:70px" data-qtyv="${l.id}"><button class="btn btn-small btn-primary" data-fill="${l.id}">${l.kind === 'sell' ? L('mk_buy') : L('mk_sell')}</button>`}</td></tr>`;
    };
    const lots = mk.listings.filter((l) => l.kind === 'auction');
    body.innerHTML = `<div class="cols"><div>
      <h3 class="title-sm" style="font-size:20px">${L('mk_board')}</h3>
      <p class="muted">${L('mk_text', { fee: Math.round(mk.listFee * 100), tax: Math.round(mk.saleTax * 100) })}</p>
      <table class="grid">${mk.listings.filter((l) => l.kind !== 'auction').map(row).join('') || `<tr><td class="muted">${L('mk_nothing')}</td></tr>`}</table>
      ${mk.auction ? `<h3 class="title-sm" style="font-size:20px;margin-top:12px">${L('mk_auction')}</h3><table class="grid">${lots.map(row).join('') || `<tr><td class="muted">${L('mk_no_lots')}</td></tr>`}</table><p class="muted">${L('mk_auction_text')}</p>` : ''}
    </div><div>
      <div class="card"><h4 class="card-h">${icon('tab_board', '', 'ico-md')}${L('mk_post_title')}</h4>
        <div class="row"><select id="k-kind"><option value="sell">${L('mk_opt_sell')}</option><option value="sellw">${L('mk_opt_sellw')}</option><option value="buy">${L('mk_opt_buy')}</option>${mk.auction ? `<option value="auction">${L('mk_opt_auction')}</option>` : ''}</select>
          <select id="k-good">${goodOptions()}</select></div>
        <div class="row"><label>${L('mk_qty')} <input id="k-qty" type="number" min="1" value="10" style="width:80px"></label><label id="k-price-l">${L('mk_price')} <input id="k-price" type="number" min="1" value="${GOODS.sugar.basePrice}" style="width:90px"></label></div>
        <div class="row hidden" id="k-auction"><label>${L('mk_buyout_l')} <input id="k-buyout" type="number" min="0" value="0" style="width:90px"></label><label>${L('mk_hours')} <select id="k-hours"><option>2</option><option selected>8</option><option>24</option></select></label></div>
        <button class="btn btn-primary" id="k-post">${L('post')}</button>
        <p class="muted">${L('mk_in_hold', { list: Object.entries(hold).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) => `${n} ${esc(GOODS[g as GoodId].name)}`).join(', ') || L('nothing') })}</p></div>
    </div></div>`;
    const q = <T extends HTMLElement>(id: string) => body.querySelector<T>(id)!;
    const kind = q<HTMLSelectElement>('#k-kind');
    kind.onchange = () => {
      q('#k-auction').classList.toggle('hidden', kind.value !== 'auction');
      q('#k-price-l').firstChild!.textContent = `${kind.value === 'auction' ? L('mk_reserve_lot') : L('mk_price')} `;
    };
    q('#k-good').onchange = () => (q<HTMLInputElement>('#k-price').value = String(GOODS[q<HTMLSelectElement>('#k-good').value as GoodId].basePrice));
    q('#k-post').onclick = () => {
      const good = q<HTMLSelectElement>('#k-good').value as GoodId;
      const qty = Number(q<HTMLInputElement>('#k-qty').value);
      const price = Number(q<HTMLInputElement>('#k-price').value);
      if (kind.value === 'auction') this.send({ t: 'market', action: 'auction', good, qty, price, buyout: Number(q<HTMLInputElement>('#k-buyout').value) || 0, hours: Number(q<HTMLSelectElement>('#k-hours').value) });
      else if (kind.value === 'buy') this.send({ t: 'market', action: 'buy_order', good, qty, price });
      else this.send({ t: 'market', action: 'sell', good, qty, price, from: kind.value === 'sellw' ? 'warehouse' : 'hold' });
    };
    body.querySelectorAll<HTMLElement>('[data-fill]').forEach((el) => (el.onclick = () => {
      const qty = Number(body.querySelector<HTMLInputElement>(`[data-qtyv="${el.dataset.fill}"]`)!.value);
      this.send({ t: 'market', action: 'fill', id: Number(el.dataset.fill), qty });
    }));
    body.querySelectorAll<HTMLElement>('[data-bid]').forEach((el) => (el.onclick = () => {
      const price = Number(body.querySelector<HTMLInputElement>(`[data-bidv="${el.dataset.bid}"]`)!.value);
      this.send({ t: 'market', action: 'bid', id: Number(el.dataset.bid), price });
    }));
    body.querySelectorAll<HTMLElement>('[data-buyout]').forEach((el) => (el.onclick = () => this.send({ t: 'market', action: 'bid', id: Number(el.dataset.buyout), price: Number(el.dataset.price) })));
    body.querySelectorAll<HTMLElement>('[data-cancel]').forEach((el) => (el.onclick = () => this.send({ t: 'market', action: 'cancel', id: Number(el.dataset.cancel) })));
  }
}

/** The barter table: your offer on the left, theirs on the right. */
export function renderBarter(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const b = state.barter;
  if (!b) return;
  const hold = state.self?.cargo ?? {};
  const list = (c: Cargo) => Object.entries(c).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) => `<div class="barter-row">${icon(`good_${g}`, '', 'item-ico')}<span>${esc(GOODS[g as GoodId].name)}</span><b>×${n}</b></div>`).join('') || `<p class="muted">${L('bt_no_goods')}</p>`;
  root.innerHTML = `<div class="modal-head"><div><h2>${L('bt_trading', { name: esc(b.them.name) })}</h2><div class="sub">${b.atSea ? L('bt_sea') : L('bt_quay')}${b.transfer ? L('bt_boats', { n: b.transfer }) : ''}</div></div><div class="muted">${L('bt_walk_hint')}</div></div>
    <div class="modal-body"><div class="cols"><div>
      <h3 class="title-sm" style="font-size:20px">${L('bt_you_give')} ${b.me.ready ? `<span class="good">${L('bt_ready')}</span>` : ''}</h3>
      <div class="card"><div class="barter-row">${icon('coin', '', 'item-ico')}<span>${L('bt_silver')}</span><input id="b-gold" class="field" type="number" min="0" value="${b.me.gold}"></div>
        ${Object.entries(hold).filter(([, n]) => (n ?? 0) > 0).map(([g, n]) => `<div class="barter-row">${icon(`good_${g}`, '', 'item-ico')}<span>${esc(GOODS[g as GoodId].name)} <span class="muted">(${n})</span></span><input class="field" type="number" min="0" max="${n}" value="${b.me.cargo[g as GoodId] ?? 0}" data-give="${g}"></div>`).join('')}
        <button class="btn btn-block" id="b-offer">${L('bt_set')}</button></div>
    </div><div>
      <h3 class="title-sm" style="font-size:20px">${L('bt_they_give', { name: esc(b.them.name) })} ${b.them.ready ? `<span class="good">${L('bt_ready')}</span>` : ''}</h3>
      <div class="card"><div class="barter-row">${icon('coin', '', 'item-ico')}<span>${L('bt_silver')}</span><b>${money(b.them.gold)}</b></div>${list(b.them.cargo)}</div>
      <div class="form-grid"><button class="btn btn-primary" id="b-ready" ${b.me.ready ? 'disabled' : ''}>${L('bt_agree')}</button><button class="btn btn-danger" id="b-cancel">${L('bt_walk')}</button></div>
      <p class="muted">${L('bt_note')}</p>
    </div></div></div>`;
  root.querySelector<HTMLElement>('#b-offer')!.onclick = () => {
    const cargo: Cargo = {};
    root.querySelectorAll<HTMLInputElement>('[data-give]').forEach((el) => {
      const n = Math.floor(Number(el.value));
      if (n > 0) cargo[el.dataset.give as GoodId] = n;
    });
    send({ t: 'barter', action: 'offer', gold: Math.floor(Number(root.querySelector<HTMLInputElement>('#b-gold')!.value) || 0), cargo });
  };
  root.querySelector<HTMLElement>('#b-ready')!.onclick = () => send({ t: 'barter', action: 'ready' });
  root.querySelector<HTMLElement>('#b-cancel')!.onclick = () => send({ t: 'barter', action: 'cancel' });
}

/** A painted card above an entry (legendary ships), or nothing until the art loads. */
function cardArt(id: string): string {
  const url = assetUrl(id);
  return url ? `<div class="card-art" style="background-image:url('${url}')"></div>` : '';
}
