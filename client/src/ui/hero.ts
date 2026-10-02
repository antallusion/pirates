// The captain as a HoMM3 hero (docs/17 H2): the Captain window — her four primaries (and what her artifacts add), her
// will, her eight skill slots, the level-up's choice of two, her artifact sets; the order book by its four schools,
// with the sea orders cast from it; a port's guild of orders and artifact merchant. And the HUD's compact bar of sea
// orders: her will and a finger-wide button for each sea order she knows.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { ARTIFACTS, ART_CLASS_NAMES, ART_RARITY, ART_SETS } from '../../../shared/src/data/artifacts.ts';
import type { ArtSetId } from '../../../shared/src/data/artifacts.ts';
import { RARITY_COLOR, SLOT_NAMES } from '../../../shared/src/data/items.ts';
import {
  GM_RANK, ORDERS, ORDER_IDS, PRIMS, PRIM_ICON, PRIM_NAMES, PRIM_TEXT, RANK_NAMES, SCHOOLS, SCHOOL_ICON, SCHOOL_NAMES, SCHOOL_SKILL, SKILLS, SKILL_SLOTS, skillText,
} from '../../../shared/src/data/hero.ts';
import { throneLabel } from './throne.ts';
import type { HeroPortView, HeroView, OrderId, School } from '../../../shared/src/data/hero.ts';
import { TREES } from '../../../shared/src/data/talents.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/hero.ts';
import type { ClientState } from '../state.ts';
import { esc, icon, money } from './dom.ts';
import { pathTab } from './pathbook.ts';
import { EN as PB_EN, RU as PB_RU } from '../lang/ui/pathbook.ts';

const PB = dict(PB_EN, PB_RU);

const L = dict(EN, RU);
const k = () => (lang() === 'ru' ? 1 : 0);
const T = (x: [string, string]) => x[k()];

type Tab = 'hero' | 'path' | 'book' | 'port';

/** A primary's tile: its mark, its name, her value and what artifacts add. */
function primTile(h: HeroView, p: (typeof PRIMS)[number]): string {
  const v = h.prim[p] + h.artPrim[p];
  return `<div class="hx-prim" title="${esc(T(PRIM_TEXT[p]))}">${icon(PRIM_ICON[p], '', 'ico-md')}<span class="hx-pn">${esc(T(PRIM_NAMES[p]))}</span><b class="hx-pv">${v}</b>${h.artPrim[p] ? `<small class="hx-pa">${esc(L('fromArt', { n: h.artPrim[p] }))}</small>` : ''}</div>`;
}

function pips(r: number): string {
  // docs/19 E2: a grandmaster's fourth rank is a star after the three.
  return `<span class="hx-pips">${[1, 2, 3].map((i) => `<i class="${i <= r ? 'on' : ''}"></i>`).join('')}${r >= GM_RANK ? '<b class="hx-gm">★</b>' : ''}</span>`;
}

/** The will bar. */
function willBar(h: HeroView): string {
  const f = h.willMax ? Math.max(0, Math.min(1, h.will / h.willMax)) : 0;
  return `<div class="hx-will" title="${esc(T(PRIM_TEXT.will))}">${icon('ab_brine_mend', '', 'ico-sm')}<span>${esc(L('will'))}</span><span class="hx-wbar"><i style="width:${Math.round(f * 100)}%"></i></span><b>${esc(L('willOf', { n: h.will, m: h.willMax }))}</b></div>`;
}

export class HeroWindow {
  tab: Tab = 'hero';
  school: School = 'fire';
  port: HeroPortView | null = null;
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  /** Opened: ask the port what it offers (its guild, its merchant). */
  open(tab?: Tab): void {
    if (tab) this.tab = tab;
    this.send({ t: 'hero', action: 'view' });
  }

  render(root: HTMLElement, state: ClientState): void {
    const self = state.self;
    const h = self?.hero;
    if (!self || !h) return;
    const docked = !!self.dockedAt;
    if (this.tab === 'port' && !docked) this.tab = 'hero';
    const cap = CAPTAINS[self.captain];
    const url = assetUrl(cap.portrait);
    const tabs: [Tab, string][] = [['hero', L('tab.hero')], ['path', PB('tab')], ['book', L('tab.book')]];
    if (docked) tabs.push(['port', L('tab.port')]);
    let body = '';
    if (this.tab === 'hero') body = this.heroTab(h, self.level, url, !!self.glory?.open);
    else if (this.tab === 'path') body = pathTab(h, self.captain, self.level, self.talents ?? {}); // docs/18 item 9
    else if (this.tab === 'book') body = this.bookTab(h, docked, state.estServerTime());
    else body = this.portTab(h, self.gold);
    root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L('sub', { name: self.name, n: self.level, path: cap.archetype }))}</div></div></div>
      <div class="modal-body hero-win"><div class="tabs">${tabs.map(([t, n]) => `<button class="tab${this.tab === t ? ' active' : ''}" data-htab="${t}">${esc(n)}${t === 'hero' && h.pending ? ` <span class="hx-dot">${h.pending}</span>` : ''}</button>`).join('')}</div>${body}</div>`;
    const redo = () => this.render(root, state);
    root.querySelectorAll<HTMLElement>('[data-htab]').forEach((b) => (b.onclick = () => {
      this.tab = b.dataset.htab as Tab;
      if (this.tab === 'port') this.send({ t: 'hero', action: 'view' });
      redo();
    }));
    root.querySelectorAll<HTMLElement>('[data-hschool]').forEach((b) => (b.onclick = () => {
      this.school = b.dataset.hschool as School;
      redo();
    }));
    root.querySelectorAll<HTMLElement>('[data-hpick]').forEach((b) => (b.onclick = () => this.send({ t: 'hero', action: 'skill', pick: Number(b.dataset.hpick) })));
    root.querySelectorAll<HTMLElement>('[data-hcast]').forEach((b) => (b.onclick = () => this.send({ t: 'hero', action: 'cast', id: b.dataset.hcast })));
    root.querySelectorAll<HTMLElement>('[data-hlearn]').forEach((b) => (b.onclick = () => this.send({ t: 'hero', action: 'learn', id: b.dataset.hlearn })));
    root.querySelectorAll<HTMLElement>('[data-hbuy]').forEach((b) => (b.onclick = () => this.send({ t: 'hero', action: 'buy', index: Number(b.dataset.hbuy) })));
    root.querySelectorAll<HTMLElement>('[data-hthrone]').forEach((b) => (b.onclick = () => this.onThrone()));
  }

  onClose: () => void = () => {};
  /** docs/19 E18: the Throne of the Sea, past the cap. */
  onThrone: () => void = () => {};

  private heroTab(h: HeroView, level: number, portrait: string | null, throne = false): string {
    const offer = h.pending && h.offer.length
      ? `<div class="hx-offer card"><h4 class="card-h">${icon('xp', '', 'ico-md')}${esc(L('levelUp'))}<span class="muted hx-pend">${esc(L('pending', { n: h.pending }))}</span></h4>
        <div class="hx-picks">${h.offer.map((o, i) => {
          const d = SKILLS[o.id];
          return `<div class="hx-pick">${icon(d.icon, '✦', 'ico-lg')}<span class="hx-pick-t"><b>${esc(T(d.name))}</b><span class="hx-rank">${esc(o.r === 1 ? L('newSkill') : L('raise', { rank: T(RANK_NAMES[o.r - 1]) }))} · ${esc(T(RANK_NAMES[o.r - 1]))}</span>${pips(o.r)}<small>${esc(T(d.text[o.r - 1]))}</small><small class="muted">${esc(L('kin', { tree: TREES[d.tree].name }))}</small></span><button class="btn btn-small btn-primary" data-hpick="${i}">${esc(L('take'))}</button></div>`;
        }).join('')}</div></div>`
      : `<p class="muted hx-none">${esc(h.skills.length >= SKILL_SLOTS && h.skills.every((x) => x.r >= 3) ? L('allExpert') : L('noPending', { n: level + 1 }))}</p>`;
    const slots = Array.from({ length: SKILL_SLOTS }, (_, i) => {
      const x = h.skills[i];
      if (!x) return `<div class="hx-slot empty"><span class="hx-sico">＋</span><span class="muted">${esc(L('slotFree'))}</span></div>`;
      const d = SKILLS[x.id];
      return `<div class="hx-slot${x.r >= GM_RANK ? ' gm' : ''}" title="${esc(T(skillText(x.id, x.r)))}">${icon(d.icon, '✦', 'ico-md')}<span class="hx-st"><b>${esc(T(d.name))}</b><span class="hx-rank">${esc(T(RANK_NAMES[x.r - 1]))} ${pips(x.r)}</span><small>${esc(T(skillText(x.id, x.r)))}</small></span></div>`;
    }).join('');
    const sets = (Object.keys(ART_SETS) as ArtSetId[]).map((id) => {
      const on = h.sets.includes(id);
      return `<div class="hx-set${on ? ' on' : ''}"><b>${esc(T(ART_SETS[id].name))}</b><span class="muted">${esc(on ? L('setOn') : ART_SETS[id].pieces.map((p) => T(ARTIFACTS[p].name)).join(' · '))}</span><small>${esc(T(ART_SETS[id].text))}</small></div>`;
    }).join('');
    return `<div class="hx-top">
        <div class="hx-face" style="background-image:${portrait ? `url('${portrait}')` : 'none'}"><span class="hx-lv">${level}</span></div>
        <div class="hx-side"><div class="gi-h">${esc(L('prims'))}</div><div class="hx-prims">${PRIMS.map((p) => primTile(h, p)).join('')}</div>${willBar(h)}</div>
      </div>
      ${offer}
      <div class="gi-h">${esc(L('skills'))} <span class="muted">${h.skills.length}/${SKILL_SLOTS}</span>${throne ? `<button class="btn btn-small hx-throne" data-hthrone>${icon('tattoo_crown', '', 'ico-sm')}${esc(throneLabel())}</button>` : ''}</div>
      <div class="hx-slots">${slots}</div>
      <div class="gi-h">${esc(L('sets'))}</div><div class="hx-sets">${sets}</div>`;
  }

  private bookTab(h: HeroView, docked: boolean, now: number): string {
    const sc = this.school;
    // The path books' pages are in the Path book (docs/18); here only those of another path she has learnt.
    const list = ORDER_IDS.filter((id) => ORDERS[id].school === sc && (!ORDERS[id].sig || h.orders.includes(id)) && (!ORDERS[id].path || h.orders.includes(id))).sort((a, b) => ORDERS[a].level - ORDERS[b].level || Number(!!ORDERS[a].sig) - Number(!!ORDERS[b].sig));
    const skill = SKILLS[SCHOOL_SKILL[sc]];
    const rows = list.map((id) => {
      const d = ORDERS[id];
      const known = h.orders.includes(id);
      const cost = h.costs[id] ?? d.cost;
      const wait = Math.max(0, Math.ceil((h.cd[id] ?? 0) - now));
      const cast = known && d.use === 'sea'
        ? `<button class="btn btn-small btn-primary" data-hcast="${id}" ${docked || wait > 0 || h.will < cost ? 'disabled' : ''} title="${esc(docked ? L('inPort') : '')}">${esc(wait > 0 ? L('ready', { n: wait }) : L('cast'))}</button>`
        : '';
      return `<div class="hx-order${known ? ' known' : ''}${d.level > h.cap && !known ? ' high' : ''}">${icon(d.icon, '✦', 'ico-md')}<span class="hx-ot"><b>${esc(T(d.name))}</b><span class="hx-otag"><span class="tag">${esc(L('lv', { n: d.level }))}</span><span class="tag ${d.use}">${esc(L(d.use))}</span><span class="tag will">${esc(L('cost', { n: cost }))}</span>${known ? '' : `<span class="muted">${esc(L('unknown'))}</span>`}</span><small>${esc(T(d.text))}</small></span>${cast}</div>`;
    }).join('');
    return `<div class="tabs hx-schools">${SCHOOLS.map((s) => `<button class="tab${s === sc ? ' active' : ''}" data-hschool="${s}">${icon(SCHOOL_ICON[s], '', 'ico-sm')}${esc(T(SCHOOL_NAMES[s]))} <span class="muted">${h.orders.filter((id) => ORDERS[id].school === s).length}</span></button>`).join('')}</div>
      ${willBar(h)}
      <p class="muted hx-note">${esc(L('schoolNote', { skill: T(skill.name) }))} ${esc(L('capNote', { n: h.cap }))} ${esc(L('learnAt'))}</p>
      <div class="hx-orders">${rows}</div>`;
  }

  private portTab(h: HeroView, gold: number): string {
    const v = this.port;
    if (!v) return `<p class="muted">${esc(L('notDocked'))}</p>`;
    const guild = v.guild
      ? `<div class="hx-orders">${v.guild.map((g) => {
        const d = ORDERS[g.id];
        const known = h.orders.includes(g.id);
        const high = d.level > h.cap;
        return `<div class="hx-order${known ? ' known' : ''}">${icon(d.icon, '✦', 'ico-md')}<span class="hx-ot"><b>${esc(T(d.name))}</b><span class="hx-otag"><span class="tag">${esc(T(SCHOOL_NAMES[d.school]))}</span><span class="tag">${esc(L('lv', { n: d.level }))}</span><span class="tag ${d.use}">${esc(L(d.use))}</span></span><small>${esc(T(d.text))}</small></span>${known ? `<span class="muted">${esc(L('learnt'))}</span>` : `<button class="btn btn-small btn-primary" data-hlearn="${g.id}" ${high || gold < g.price ? 'disabled' : ''} title="${esc(high ? L('tooHigh') : '')}">${esc(high ? L('tooHigh') : L('learn'))}${high ? '' : money(g.price)}</button>`}</div>`;
      }).join('')}</div>`
      : `<p class="muted">${esc(L('noGuild'))}</p>`;
    const wares = v.wares
      ? `<div class="hx-wares">${v.wares.map((w, i) => {
        const a = ARTIFACTS[w.art];
        const prim = PRIMS.filter((p) => a.prim?.[p]).map((p) => `${T(PRIM_NAMES[p])} +${a.prim![p]}`).join(' · ');
        return `<div class="hx-ware" style="border-color:${RARITY_COLOR[ART_RARITY[a.cls]]}">${icon(a.icon, '◆', 'ico-lg')}<span class="hx-ot"><b style="color:${RARITY_COLOR[ART_RARITY[a.cls]]}">${esc(T(a.name))}</b><span class="muted">${esc(T(ART_CLASS_NAMES[a.cls]))} · ${esc(T(SLOT_NAMES[a.slot]))}${a.set ? ` · ${esc(T(ART_SETS[a.set].name))}` : ''}</span><small>${esc(prim)}</small><small class="muted">${esc(T(a.text))}</small></span>${w.price < 0 ? `<span class="muted">${esc(L('sold'))}</span>` : `<button class="btn btn-small btn-primary" data-hbuy="${i}" ${gold < w.price ? 'disabled' : ''}>${esc(L('buy'))}${money(w.price)}</button>`}</div>`;
      }).join('')}</div>`
      : `<p class="muted">${esc(L('noMerchant'))}</p>`;
    // docs/18 item 10: other paths' pages at the guild, twice the price.
    const foreign = v.foreign?.length
      ? `<div class="gi-h">${icon('tree_abyssal', '', 'ico-sm')}${esc(PB('foreign'))}</div><p class="muted hx-note">${esc(PB('foreignNote'))}</p><div class="hx-orders">${v.foreign.map((g) => {
        const d = ORDERS[g.id];
        const known = h.orders.includes(g.id);
        const high = d.level > h.cap;
        return `<div class="hx-order${known ? ' known' : ''}">${icon(d.icon, '✦', 'ico-md')}<span class="hx-ot"><b>${esc(T(d.name))}</b><span class="hx-otag"><span class="tag">${esc(d.path ? CAPTAINS[d.path].archetype : '')}</span><span class="tag">${esc(T(SCHOOL_NAMES[d.school]))}</span><span class="tag">${esc(L('lv', { n: d.level }))}</span></span><small>${esc(T(d.text))}</small></span>${known ? `<span class="muted">${esc(L('learnt'))}</span>` : `<button class="btn btn-small btn-primary" data-hlearn="${g.id}" ${high || gold < g.price ? 'disabled' : ''}>${esc(high ? L('tooHigh') : L('learn'))}${high ? '' : money(g.price)}</button>`}</div>`;
      }).join('')}</div>`
      : '';
    return `<div class="gi-h">${icon('bt_captain', '', 'ico-sm')}${esc(L('guild'))}</div>${guild}${foreign}<div class="gi-h">${icon('item_signet', '', 'ico-sm')}${esc(L('merchant'))}</div>${wares}`;
  }
}

/** The HUD's bar of sea orders (at sea, for a captain who knows one): her will, and each order a finger wide. */
let lastBar = '';
export function drawSeaOrders(el: HTMLElement, state: ClientState, send: (m: ClientMsg) => void, openBook: () => void): void {
  const self = state.self;
  const h = self?.hero;
  const now = state.estServerTime();
  const sea = h ? h.orders.filter((id) => ORDERS[id].use === 'sea') : [];
  const on = !!h && !!state.ownDisplay && !self?.dockedAt && !state.boardTac && sea.length > 0;
  const waits = sea.map((id) => Math.max(0, Math.ceil((h!.cd[id] ?? 0) - now)));
  const key = on ? JSON.stringify([lang(), h!.will, h!.willMax, sea, waits, h!.costs]) : '';
  if (key === lastBar) return;
  lastBar = key;
  el.classList.toggle('hidden', !on);
  if (!on) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `<button class="so-will" data-sobook title="${esc(`${L('seaOrders')} · ${L('will')} ${h!.will}/${h!.willMax}`)}">${icon('ab_brine_mend', '', 'ico-sm')}<b>${h!.will}</b></button>${sea.map((id: OrderId, i) => {
    const d = ORDERS[id];
    const cost = h!.costs[id] ?? d.cost;
    const off = waits[i] > 0 || h!.will < cost;
    return `<button class="so-btn${off ? ' off' : ''}" data-socast="${id}" title="${esc(`${T(d.name)} — ${T(d.text)} (${L('cost', { n: cost })})`)}" aria-label="${esc(T(d.name))}">${icon(d.icon, '✦', 'ico-sm')}<small>${waits[i] > 0 ? `${waits[i]}` : cost}</small></button>`;
  }).join('')}`;
  el.querySelector<HTMLElement>('[data-sobook]')!.onclick = openBook;
  el.querySelectorAll<HTMLElement>('[data-socast]').forEach((b) => (b.onclick = () => {
    send({ t: 'hero', action: 'cast', id: b.dataset.socast });
    b.classList.add('sent');
  }));
}
