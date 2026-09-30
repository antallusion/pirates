// The recruit window of the Heroes (docs/17 H3 item 11), as HoMM3's: the dwellings of a port or of one's own town, the
// kinds of men each offers with the men waiting and the week's growth; a kind picked, a slider to the most the purse,
// the store, the hammocks and the stacks allow, "Max", the cost line, "Recruit". Under it the stacks aboard that the
// upgraded dwellings here train up for the difference in price. The army's row of slots on top, as it will stand.

import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { TOWN, affordable, dwellingOf, portDwellings } from '../../../shared/src/data/town.ts';
import { KEY_PORTS } from '../../../shared/src/world/regions.ts';
import type { Price, TownId } from '../../../shared/src/data/town.ts';
import { WEEKS } from '../../../shared/src/data/week.ts';
import type { DwellRow, DwellView, WeekView } from '../../../shared/src/h3proto.ts';
import type { ClientMsg, PortPublic } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/h3.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { armyRow, unitArt, unitName, unitNote } from './army.ts';
import { dec1, esc, fmt, icon, money } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);
const ru = () => (lang() === 'ru' ? 1 : 0);

/** A town building's name at a level (its first before it stands). */
export function townName(id: TownId, level: number): string {
  const n = TOWN[id].names;
  return n[Math.max(0, Math.min(n.length, Math.max(1, level)) - 1)][ru()];
}

/** A dwelling row's name: the port's tavern, or the dwelling (its upgraded name where it trains the upgrade). */
export function dwellName(r: Pick<DwellRow, 'name' | 'up'>): string {
  return r.name === 'tavern' ? L('tavern') : townName(r.name, r.up ? 2 : 1);
}

export function dwellArt(r: Pick<DwellRow, 'name' | 'tier'>): string {
  return r.name === 'tavern' ? 'build_tavern' : `build_${TOWN[r.name].art}`;
}

/** The week line: its number and day, its name. */
export function weekLine(w: WeekView | null): string {
  if (!w) return '';
  return `${L('week', { n: w.n, d: w.day })} · ${WEEKS[w.kind].name[ru()]}`;
}

/** What `n` men cost, from the silver and the resources a man. */
export function priceOf(per: number, goods: Partial<Record<GoodId, number>>, n: number): Price {
  const out: Partial<Record<GoodId, number>> = {};
  for (const [g, k] of Object.entries(goods) as [GoodId, number][]) if (k > 0 && n > 0) out[g] = Math.ceil(k * n - 1e-9);
  return { silver: Math.round(per * n), goods: out };
}

/** A cost line: silver and the resources, each red where the purse or the store falls short. */
export function costLine(p: Price, gold: number, have: Partial<Record<GoodId, number>>): string {
  const goods = (Object.entries(p.goods) as [GoodId, number][]).filter(([, n]) => n > 0).map(([g, n]) => `<span class="bcost${(have[g] ?? 0) < n ? ' lack' : ''}" title="${esc(GOODS[g].name)}">${icon(`good_${g}`, '', 'ico-sm')}${fmt(n)}</span>`).join('');
  return `<span class="bcosts"><span class="bcost${gold < p.silver ? ' lack' : ''}">${money(p.silver)}</span>${goods}</span>`;
}

/** Silver and the resources a man asks (the resources in fractions: a barrel of powder for four musketeers). */
export function perLine(per: number, goods: Partial<Record<GoodId, number>>): string {
  const g = (Object.entries(goods) as [GoodId, number][]).filter(([, n]) => n > 0).map(([k, n]) => `<span class="bcost" title="${esc(GOODS[k].name)}">${icon(`good_${k}`, '', 'ico-sm')}${esc(String(Math.round(n * 100) / 100).replace('.', lang() === 'ru' ? ',' : '.'))}</span>`).join('');
  return `<span class="bcosts"><span class="bcost">${money(per)}</span>${g}</span>`;
}

/** The port's dwellings on the tavern's page (docs/17 H3): what grows here, and the recruit window. */
export function dwellCard(port: PortPublic): string {
  const key = KEY_PORTS.some((k) => k.id === port.id);
  const list = portDwellings({ ...port, size: Math.max(1, Math.min(3, port.size)) as 1 | 2 | 3, key }).map((d) => dwellName({ name: d.tier === 1 ? 'tavern' : dwellingOf(d.tier), up: d.up }));
  return `<div class="card rc-card"><h4 class="card-h">${icon('build_barracks', '', 'ico-md')}${esc(L('port.dwell'))}</h4><p class="muted">${esc(L('port.dwell.text', { list: list.join(', ') }))}</p><button class="btn btn-small btn-primary" data-dwell>${esc(L('port.dwell.btn'))}</button></div>`;
}

export class RecruitWindow {
  sel: UnitId | null = null;
  n = 0;
  private send: (m: ClientMsg) => void;
  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  open(src: 'port' | 'isle'): void {
    this.sel = null;
    this.n = 0;
    this.send({ t: 'h3', action: 'dwell', src });
  }

  /** The most men of a kind to be had now. */
  private most(v: DwellView, r: DwellRow, u: UnitId): number {
    const unit = r.units.find((x) => x.u === u);
    if (!unit || r.why || v.why) return 0;
    const room = Math.max(0, v.crewMax - v.crew);
    if (!v.army.some((x) => x.u === u) && v.army.length >= v.slots) return 0;
    return affordable(u, (n) => priceOf(unit.per, unit.goods, n), v.gold, v.have, Math.min(r.pool, room));
  }

  render(root: HTMLElement, state: ClientState): void {
    const v = state.dwell;
    if (!v) {
      root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2></div></div><div class="modal-body"><p class="muted">${esc(L('none'))}</p></div>`;
      return;
    }
    const rowOf = (u: UnitId) => v.rows.find((r) => r.units.some((x) => x.u === u));
    if (this.sel && !rowOf(this.sel)) this.sel = null;
    if (!this.sel) {
      const first = v.rows.find((r) => r.pool > 0 && !r.why) ?? v.rows[0];
      this.sel = first?.units[0]?.u ?? null;
      this.n = 0;
    }
    const men = v.army.reduce((a, s) => a + s.n, 0);
    const head = `<div class="modal-head rc-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L(v.src === 'port' ? 'sub.port' : 'sub.isle', { place: placeName(v.place) }))} · ${esc(weekLine(v.week))}</div></div>
      <div class="rc-chips"><span class="ph-chip gold">${money(v.gold)}</span><span class="ph-chip">${icon('stat_crew', '', 'ico-sm')}${esc(L('room', { n: men, max: v.crewMax }))}</span><span class="ph-chip">${esc(L('slots', { n: v.army.length, max: v.slots }))}</span></div></div>`;
    const cards = v.rows.map((r) => {
      const units = r.units.map((x) => {
        const d = UNITS[x.u];
        const most = this.most(v, r, x.u);
        return `<button class="rc-unit${this.sel === x.u ? ' sel' : ''}${d.up ? ' up' : ''}${most <= 0 ? ' off' : ''}" data-rcu="${x.u}" title="${esc(unitNote(x.u))}">${icon(unitArt(x.u), '', 'rc-face')}<b>${esc(unitName(x.u))}</b><span class="rc-per">${perLine(x.per, x.goods)}</span></button>`;
      }).join('');
      return `<div class="rc-dwell${r.why ? ' off' : ''}"><div class="rc-dh">${icon(dwellArt(r), '', 'rc-art')}<div class="rc-dt"><b>${esc(dwellName(r))}</b><span class="muted">${esc(L('avail', { n: r.pool }))}${r.growth ? ` · ${esc(L('growth', { n: dec1(r.growth).replace(/[.,]0$/, '') }))}` : ''}</span>${r.why ? `<span class="bad">${esc(serverText(r.why))}</span>` : ''}</div></div><div class="rc-units">${units}</div></div>`;
    }).join('') || `<p class="muted">${esc(L('none'))}</p>`;
    const r = this.sel ? rowOf(this.sel) : undefined;
    let pick = `<p class="muted">${esc(L('pick'))}</p>`;
    if (r && this.sel) {
      const u = this.sel;
      const d = UNITS[u];
      const unit = r.units.find((x) => x.u === u)!;
      const most = this.most(v, r, u);
      this.n = Math.max(0, Math.min(most, this.n || (most > 0 ? 1 : 0)));
      const price = priceOf(unit.per, unit.goods, this.n);
      const why = v.why ? serverText(v.why) : r.why ? serverText(r.why) : r.pool <= 0 ? L('nobody') : v.crew >= v.crewMax ? L('nohammock') : !v.army.some((x) => x.u === u) && v.army.length >= v.slots ? L('noslot') : most <= 0 ? L('lack') : '';
      pick = `<div class="rc-pick"><div class="rc-ph">${icon(unitArt(u), '', 'rc-big')}<div><b>${esc(unitName(u))}</b><span class="muted">${esc(L('stats', { atk: d.atk, def: d.def, dmin: d.dmin, dmax: d.dmax, hp: d.hp, spd: d.speed }))}</span><span class="muted">${esc(L('avail', { n: r.pool }))}</span></div></div>
        <div class="rc-slide"><input type="range" min="0" max="${most}" value="${this.n}" data-rcn aria-label="${esc(unitName(u))}"${most <= 0 ? ' disabled' : ''}><b class="rc-count" data-rccount>${this.n}</b><button class="btn btn-small" data-rcmax${most <= 0 ? ' disabled' : ''}>${esc(L('max'))} ${most}</button></div>
        <div class="rc-cost"><span class="muted">${esc(L('cost'))}</span><span data-rccost>${costLine(price, v.gold, v.have)}</span></div>
        ${why ? `<p class="bad rc-why">${esc(why)}</p>` : ''}
        <button class="btn btn-primary rc-go" data-rcgo${this.n > 0 && !why ? '' : ' disabled'}>${esc(L('recruit'))}</button></div>`;
    }
    const have = (Object.entries(v.have) as [GoodId, number][]).filter(([g, n]) => n > 0 && ['timber', 'iron', 'tar', 'gunpowder', 'pearls', 'rum'].includes(g));
    const res = have.length ? `<p class="rc-have"><span class="muted">${esc(L('have'))}:</span> ${have.map(([g, n]) => `<span class="bcost" title="${esc(GOODS[g].name)}">${icon(`good_${g}`, '', 'ico-sm')}${fmt(n)}</span>`).join('')}</p>` : '';
    const ups = v.ups.length
      ? v.ups.map((x) => {
        const p = priceOf(x.per, x.goods, x.n);
        const ok = !v.why && p.silver <= v.gold && (Object.entries(p.goods) as [GoodId, number][]).every(([g, k]) => (v.have[g] ?? 0) >= k);
        return `<div class="rc-up">${icon(unitArt(x.u), '', 'rc-face')}<span class="rc-arrow">→</span>${icon(unitArt(x.to), '', 'rc-face up')}<div class="rc-ut"><b>${esc(unitName(x.u))} → ${esc(unitName(x.to))}</b>${costLine(p, v.gold, v.have)}</div><button class="btn btn-small" data-rctrain="${x.u}" data-n="${x.n}"${ok ? '' : ' disabled'}>${esc(L('train.btn', { n: x.n }))}</button></div>`;
      }).join('')
      : `<p class="muted">${esc(L('train.none'))}</p>`;
    const hasUp = v.rows.some((x) => x.up);
    root.innerHTML = `${head}<div class="modal-body rc-body"><div class="rc-army"><span class="muted">${esc(L('army'))}</span>${armyRow(v.army, v.slots)}</div>${res}
      <div class="rc-main"><div class="rc-list">${cards}</div><div class="rc-side">${pick}${hasUp ? `<div class="rc-train"><h4 class="card-h">${esc(L('train'))}</h4><p class="muted">${esc(L('train.text'))}</p>${ups}</div>` : ''}</div></div></div>`;
    this.bind(root, state);
  }

  private bind(root: HTMLElement, state: ClientState): void {
    const v = state.dwell!;
    root.querySelectorAll<HTMLElement>('[data-rcu]').forEach((el) => (el.onclick = () => {
      this.sel = el.dataset.rcu as UnitId;
      this.n = 0;
      this.render(root, state);
    }));
    const slider = root.querySelector<HTMLInputElement>('[data-rcn]');
    const r = this.sel ? v.rows.find((x) => x.units.some((y) => y.u === this.sel)) : undefined;
    const unit = r?.units.find((x) => x.u === this.sel);
    const update = () => {
      if (!unit) return;
      const c = root.querySelector<HTMLElement>('[data-rccount]');
      if (c) c.textContent = String(this.n);
      const cost = root.querySelector<HTMLElement>('[data-rccost]');
      if (cost) cost.innerHTML = costLine(priceOf(unit.per, unit.goods, this.n), v.gold, v.have);
      const go = root.querySelector<HTMLButtonElement>('[data-rcgo]');
      if (go && !root.querySelector('.rc-why')) go.disabled = this.n <= 0;
    };
    if (slider) slider.oninput = () => {
      this.n = Math.max(0, Math.floor(Number(slider.value)));
      update();
    };
    root.querySelector<HTMLElement>('[data-rcmax]')?.addEventListener('click', () => {
      if (!slider) return;
      this.n = Number(slider.max);
      slider.value = slider.max;
      update();
    });
    root.querySelector<HTMLElement>('[data-rcgo]')?.addEventListener('click', () => {
      if (!this.sel || this.n <= 0) return;
      this.send({ t: 'h3', action: 'recruit', src: v.src, u: this.sel, n: this.n });
      this.n = 0;
    });
    root.querySelectorAll<HTMLElement>('[data-rctrain]').forEach((el) => (el.onclick = () => this.send({ t: 'h3', action: 'train', src: v.src, u: el.dataset.rctrain as UnitId, n: Number(el.dataset.n) })));
  }
}
