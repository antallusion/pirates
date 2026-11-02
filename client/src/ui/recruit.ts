// The recruit window of the Heroes (docs/17 H3 item 11), as HoMM3's: the dwellings of a port or of one's own town, the
// kinds of men each offers with the men waiting and the week's growth; a kind picked, a slider to the most the purse,
// the store, the hammocks and the stacks allow, "Max", the cost line, "Recruit". Under it the stacks aboard that the
// upgraded dwellings here train up for the difference in price. The army's row of slots on top, as it will stand.

import { detailAttr } from './detailattr.ts'; // the detail card (owner, 2026-10-30)
import { wayName } from '../render/waystations.ts'; // docs/35: the waystation's hire
import type { WayKind } from '../../../shared/src/world/waystations.ts';
import { hasTamer } from '../../../shared/src/data/drifts.ts';
import { EN as DEN, RU as DRU } from '../lang/ui/drifts.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { UnitId } from '../../../shared/src/data/army.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { PICKED_TIER, TOWN, affordable, dwellingOf, mightRoom, portDwellings } from '../../../shared/src/data/town.ts';
import { DWELL_UP_LEVEL } from '../../../shared/src/data/isletree.ts';
import { KEY_PORTS } from '../../../shared/src/world/regions.ts';
import type { Price, TownId } from '../../../shared/src/data/town.ts';
import { WEEKS } from '../../../shared/src/data/week.ts';
import type { DwellRow, DwellView, WeekView } from '../../../shared/src/h3proto.ts';
import type { ClientMsg, PortPublic } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/h3.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { armyEditReset, armyEditor, unitIcon, unitName, unitNote, wireArmy } from './army.ts';
import { dec1, esc, fmt, icon, money } from './dom.ts';
import { placeName } from './maps.ts';
import { srcAttr } from './srctip.ts'; // «Где взять» (owner, 2026-10-30)
import { EN as BEN, RU as BRU } from '../lang/ui/boats.ts'; // «Шлюпы с острова» (owner, 2026-11-02)
import { boatFee, boatsClock } from '../../../shared/src/data/islandboats.ts';
import { BOATS_ICON } from './boatsclock.ts';

const L = dict(EN, RU);
const DL = dict(DEN, DRU);
const LB = dict(BEN, BRU);
const ru = () => (lang() === 'ru' ? 1 : 0);

/** A town building's name at a level (its first before it stands). */
export function townName(id: TownId, level: number): string {
  const n = TOWN[id].names;
  return n[Math.max(0, Math.min(n.length, Math.max(1, level)) - 1)][ru()];
}

/** A dwelling row's name: the port's tavern, or the dwelling (its upgraded name where it trains the upgrade). */
export function dwellName(r: Pick<DwellRow, 'name' | 'up' | 'label'>): string {
  if (r.label) return r.label[ru()];
  return r.name === 'tavern' ? L('tavern') : r.name === 'lair' ? '' : townName(r.name, r.up ? DWELL_UP_LEVEL : 1);
}

export function dwellArt(r: Pick<DwellRow, 'name' | 'tier' | 'art'>): string {
  if (r.art) return r.art;
  return r.name === 'tavern' ? 'build_tavern' : r.name === 'lair' ? 'build_kennel' : `build_${TOWN[r.name].art}`;
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
  const goods = (Object.entries(p.goods) as [GoodId, number][]).filter(([, n]) => n > 0).map(([g, n]) => `<span class="bcost${(have[g] ?? 0) < n ? ' lack' : ''}"${srcAttr(`g:${g}`, n, have[g] ?? 0)}>${icon(`good_${g}`, '', 'ico-sm')}${fmt(n)}</span>`).join('');
  return `<span class="bcosts"><span class="bcost${gold < p.silver ? ' lack' : ''}">${money(p.silver)}</span>${goods}</span>`;
}

/** Silver and the resources a man asks (the resources in fractions: a barrel of powder for four musketeers). */
export function perLine(per: number, goods: Partial<Record<GoodId, number>>): string {
  const g = (Object.entries(goods) as [GoodId, number][]).filter(([, n]) => n > 0).map(([k, n]) => `<span class="bcost"${srcAttr(`g:${k}`)}>${icon(`good_${k}`, '', 'ico-sm')}${esc(String(Math.round(n * 100) / 100).replace('.', lang() === 'ru' ? ',' : '.'))}</span>`).join('');
  return `<span class="bcosts"><span class="bcost">${money(per)}</span>${g}</span>`;
}

/** docs/18 #42: a port's tamer on the tavern's page — she buys tamed creatures and sells her own. */
export function tamerCard(port: PortPublic): string {
  if (!hasTamer(port)) return '';
  return `<div class="card rc-card"><h4 class="card-h">${icon('build_kennel', '', 'ico-md')}${esc(DL('tamer.title', { port: placeName(port.name) }))}</h4><p class="muted">${esc(DL('tamer.card'))}</p><button class="btn btn-small btn-primary" data-tame>${esc(DL('tamer.btn'))}</button></div>`;
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
  /** «Шлюпы с острова» (src 'boat', owner 2026-11-02): the men loaded into the island's boats, by kind, not yet sent. */
  readonly cart = new Map<UnitId, number>();
  /** The boats sent: the window closed for her to watch them come (main.ts). */
  onSent: () => void = () => {};
  private send: (m: ClientMsg) => void;
  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  /** Bring the selected kind into sight on the next render (the window just opened). */
  private seek = false;
  open(src: DwellView['src']): void {
    this.seek = true;
    this.sel = null;
    this.n = 0;
    this.cart.clear();
    armyEditReset();
    this.send({ t: 'h3', action: 'dwell', src });
  }

  /** The window's view asked anew, the pick kept (the army changed by her own hand: split, merge, dismiss). */
  private reload(src: DwellView['src']): void {
    this.send({ t: 'h3', action: 'dwell', src });
  }

  /** The kind picked as the window opens (owner, 2026-10-29: «Юнги» were picked with no hammock for one): the island's
   *  marines for its step, else the advice's best, else the highest tier to be had now — a kind she may hire. */
  private firstPick(v: DwellView, state: ClientState): UnitId | null {
    const can = (u: UnitId) => {
      const r = v.rows.find((x) => x.units.some((y) => y.u === u));
      return !!r && this.most(v, r, u) > 0;
    };
    const step = state.self?.isleFirst;
    const want: UnitId[] = [];
    if (step?.id === 'hire' && !step.stuck) want.push('sea_guard', 'marine');
    if (v.best) want.push(v.best);
    for (const r of [...v.rows].sort((a, b) => b.tier - a.tier)) for (const x of [...r.units].reverse()) want.push(x.u);
    const pick = want.find(can);
    if (pick) return pick;
    const first = v.rows.find((r) => r.pool > 0 && !r.why) ?? v.rows[0];
    return v.best && v.rows.some((r) => r.units.some((x) => x.u === v.best)) ? v.best : first?.units[0]?.u ?? null;
  }

  /** The boats' mode: the window as it would stand with the other kinds in the boats already aboard — their hammocks,
   *  slots, picked berths, the men they took from the dwellings, the silver and resources they cost. */
  private virt(v: DwellView): DwellView {
    if (v.src !== 'boat') return v;
    const others = [...this.cart].filter(([u, n]) => u !== this.sel && n > 0);
    if (!others.length) return v;
    const army = v.army.map((x) => ({ ...x }));
    const have = { ...v.have };
    let crew = v.crew, gold = v.gold, picked = v.picked;
    const rows = v.rows.map((r) => ({ ...r }));
    for (const [u, n] of others) {
      const own = army.find((x) => x.u === u && !x.g);
      if (own) own.n += n;
      else army.push({ u, n });
      crew += n;
      if (UNITS[u].tier >= PICKED_TIER && !UNITS[u].titan) picked -= n;
      const r = rows.find((x) => x.units.some((y) => y.u === u));
      const unit = r?.units.find((y) => y.u === u);
      if (r) r.pool = Math.max(0, r.pool - n);
      if (unit) {
        const p = priceOf(unit.per, unit.goods, n);
        gold -= p.silver;
        for (const [g, k] of Object.entries(p.goods) as [GoodId, number][]) have[g] = (have[g] ?? 0) - k;
      }
    }
    // each kind's room under the might cap counted over the others in the boats (the server's roomIn, isleboats.ts)
    const lvl = v.boat?.level ?? 1;
    const hands = (x: { u: UnitId }) => UNITS[x.u].tier === 1 && !UNITS[x.u].beast;
    for (const r of rows) {
      const swap = r.tier >= 2 ? army.filter(hands).reduce((a, x) => a + x.n, 0) : 0;
      r.swap = swap || undefined;
      r.units = r.units.map((x) => { const room = mightRoom(swap ? army.filter((y) => !hands(y)) : army, x.u, lvl, v.crewMax, v.slots); return { ...x, room: Number.isFinite(room) ? room : -1 }; });
    }
    return { ...v, army, have, crew, gold: Math.max(0, gold), picked: Math.max(0, picked), rows };
  }

  /** The boats' load now: the men and the kinds in them, their price and the delivery's fee. */
  private load(v: DwellView): { men: number; kinds: number; silver: number; goods: Partial<Record<GoodId, number>>; fee: number } {
    let men = 0, kinds = 0, silver = 0;
    const goods: Partial<Record<GoodId, number>> = {};
    for (const [u, n] of this.cart) {
      if (n <= 0) continue;
      const unit = v.rows.flatMap((r) => r.units).find((x) => x.u === u);
      if (!unit) continue;
      men += n;
      kinds++;
      const p = priceOf(unit.per, unit.goods, n);
      silver += p.silver;
      for (const [g, k] of Object.entries(p.goods) as [GoodId, number][]) goods[g] = (goods[g] ?? 0) + k;
    }
    const b = v.boat;
    return { men, kinds, silver, goods, fee: b && men > 0 ? boatFee(b.hall, b.km, silver) : 0 };
  }

  /** The most men of a kind to be had now. */
  private most(v: DwellView, r: DwellRow, u: UnitId): number {
    const unit = r.units.find((x) => x.u === u);
    if (!unit || r.why || v.why) return 0;
    // (owner, 2026-10-28: the hands go ashore to make room for better men — the row's `swap`)
    const room = Math.max(0, v.crewMax - v.crew) + (UNITS[u].tier >= 2 ? r.swap ?? 0 : 0);
    if (!v.army.some((x) => x.u === u && !x.g) && v.army.length >= v.slots) return 0;
    const picked = UNITS[u].tier >= PICKED_TIER && !UNITS[u].titan ? v.picked : Infinity; // (docs/19 E10: a titan stands out of it)
    const might = unit.room === undefined || unit.room < 0 ? Infinity : unit.room;
    // the boats' load: the hall's men a trip and its kinds, the others in them counted (owner, 2026-11-02)
    let boat = Infinity;
    if (v.boat) {
      const others = [...this.cart].filter(([k, n]) => k !== u && n > 0);
      boat = others.length >= v.boat.stacks ? 0 : Math.max(0, v.boat.men - others.reduce((a, [, n]) => a + n, 0));
    }
    return affordable(u, (n) => priceOf(unit.per, unit.goods, n), v.gold, v.have, Math.min(r.pool, room, picked, might, boat));
  }

  render(root: HTMLElement, state: ClientState): void {
    const real = state.dwell;
    if (!real) {
      root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2></div></div><div class="modal-body"><p class="muted">${esc(L('none'))}</p></div>`;
      return;
    }
    const boat = real.src === 'boat';
    if (boat) for (const u of [...this.cart.keys()]) if (!real.rows.some((r) => r.units.some((x) => x.u === u))) this.cart.delete(u);
    if (!boat && this.cart.size) this.cart.clear();
    const v = this.virt(real);
    const rowOf = (u: UnitId) => v.rows.find((r) => r.units.some((x) => x.u === u));
    if (this.sel && !rowOf(this.sel)) this.sel = null;
    if (!this.sel) {
      this.sel = this.firstPick(v, state);
      this.n = 0;
    }
    const men = real.army.reduce((a, s) => a + s.n, 0);
    const head = `<div class="modal-head rc-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(v.src === 'boat' ? LB('sub', { place: placeName(v.place) }) : v.src === 'way' ? L('sub.way', { place: wayName(v.place as WayKind) }) : L(v.src === 'port' ? 'sub.port' : v.src === 'lair' ? 'sub.lair' : 'sub.isle', { place: placeName(v.place) }))} · ${esc(weekLine(v.week))}</div></div>
      <div class="rc-chips"><span class="ph-chip gold">${money(real.gold)}</span><span class="ph-chip">${icon('stat_crew', '', 'ico-sm')}${esc(L('room', { n: men, max: v.crewMax }))}</span><span class="ph-chip">${esc(L('slots', { n: real.army.length, max: v.slots }))}</span><span class="ph-chip" title="${esc(L('picked.tip'))}">${esc(L('picked', { n: real.pickedMax - real.picked, max: real.pickedMax }))}</span>${v.mightMax ? `<span class="ph-chip${(v.might ?? 0) >= v.mightMax ? ' warn' : ''}" title="${esc(L('might.tip'))}">${esc(L('might', { n: v.might ?? 0, max: v.mightMax }))}</span>` : ''}</div></div>`;
    const cards = v.rows.map((r) => {
      const units = r.units.map((x) => {
        const d = UNITS[x.u];
        const most = this.most(v, r, x.u);
        const best = v.best === x.u;
        const inBoat = this.cart.get(x.u) ?? 0;
        return `<button class="rc-unit${inBoat ? ' inboat' : ''}${this.sel === x.u ? ' sel' : ''}${d.up ? ' up' : ''}${best ? ' best' : ''}${most <= 0 ? ' off' : ''}" data-rcu="${x.u}" title="${esc(unitNote(x.u))}">${unitIcon(x.u, 'rc-face')}<b>${esc(unitName(x.u))}${best ? `<span class="rc-best">${esc(L('best'))}</span>` : ''}</b><span class="rc-per">${perLine(x.per, x.goods)}</span>${inBoat ? `<span class="rc-inboat">${icon(BOATS_ICON, '', 'ico-sm')}${inBoat}</span>` : ''}</button>`;
      }).join('');
      return `<div class="rc-dwell${r.why ? ' off' : ''}"><div class="rc-dh">${icon(dwellArt(r), '', 'rc-art')}<div class="rc-dt"><b>${esc(dwellName(r))}${r.isle ? `<span class="rc-isle">${esc(L('isle.tag'))}</span>` : ''}</b><span class="muted">${esc(L('avail', { n: r.pool }))}${r.growth ? ` · ${esc(L('growth', { n: dec1(r.growth).replace(/[.,]0$/, '') }))}` : ''}</span>${r.why ? `<span class="bad">${esc(serverText(r.why))}</span>` : ''}</div></div><div class="rc-units">${units}</div></div>`;
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
      const boatFull = boat && v.boat && most <= 0 && !v.why && !r.why && r.pool > 0 ? ([...this.cart].filter(([k, n]) => k !== u && n > 0).length >= v.boat.stacks ? LB('stacksFull') : LB('full')) : '';
      const why = boatFull ? boatFull : v.why ? serverText(v.why) : r.why ? serverText(r.why) : r.pool <= 0 ? L('nobody') : v.crew >= v.crewMax && !(d.tier >= 2 && r.swap) ? L('nohammock') : !v.army.some((x) => x.u === u && !x.g) && v.army.length >= v.slots ? L('noslot') : d.tier >= PICKED_TIER && !UNITS[u].titan && v.picked <= 0 ? L('picked.full', { max: v.pickedMax }) : unit.room === 0 ? L('might.full') : most <= 0 ? L('lack') : '';
      // (the cost and «Нанять» share a row on a phone held sideways, the men waiting said by the dwelling's card: the
      // button stood 6–15 px under the fold at 640×360 — docs/19 E19)
      pick = `<div class="rc-pick"><div class="rc-ph"${detailAttr(`unit:${u}`)}>${unitIcon(u, 'rc-big')}<div><b>${esc(unitName(u))}</b><span class="muted">${esc(L('stats', { atk: d.atk, def: d.def, dmin: d.dmin, dmax: d.dmax, hp: d.hp, spd: d.speed }))}</span><span class="muted rc-avail">${esc(L('avail', { n: r.pool }))}</span></div></div>
        <div class="rc-slide"><input type="range" min="0" max="${most}" value="${this.n}" data-rcn aria-label="${esc(unitName(u))}"${most <= 0 ? ' disabled' : ''}><b class="rc-count" data-rccount>${this.n}</b><button class="btn btn-small" data-rcmax${most <= 0 ? ' disabled' : ''}>${esc(L('max'))} ${most}</button></div>
        ${why ? `<p class="bad rc-why">${esc(why)}</p>` : ''}<p class="muted rc-swap" data-rcswap>${esc(this.ashoreLine(v, u))}</p>
        <div class="rc-buy"><div class="rc-cost"><span class="muted">${esc(L('cost'))}</span><span data-rccost>${costLine(price, v.gold, v.have)}</span></div>
        ${boat ? `<button class="btn btn-primary rc-go" data-rcboat${!why && (this.n > 0 || this.cart.has(u)) ? '' : ' disabled'}>${esc(this.boatWord(u))}</button>` : `<button class="btn btn-primary rc-go" data-rcgo${this.n > 0 && !why ? '' : ' disabled'}>${esc(L('recruit'))}</button>`}</div></div>`;
    }
    const have = (Object.entries(v.have) as [GoodId, number][]).filter(([g, n]) => n > 0 && ['timber', 'iron', 'tar', 'gunpowder', 'pearls', 'rum'].includes(g));
    const res = have.length ? `<p class="rc-have"><span class="muted">${esc(L('have'))}:</span> ${have.map(([g, n]) => `<span class="bcost"${detailAttr(`good:${g}`)} title="${esc(GOODS[g].name)}">${icon(`good_${g}`, '', 'ico-sm')}${fmt(n)}</span>`).join('')}</p>` : '';
    const ups = v.ups.length
      ? v.ups.map((x) => {
        const n = Math.max(0, Math.min(x.n, x.room ?? x.n));
        const p = priceOf(x.per, x.goods, n);
        const ok = n > 0 && !v.why && p.silver <= v.gold && (Object.entries(p.goods) as [GoodId, number][]).every(([g, k]) => (v.have[g] ?? 0) >= k);
        return `<div class="rc-up"><span class="dc-tap"${detailAttr(`unit:${x.u}`)}>${unitIcon(x.u, 'rc-face')}</span><span class="rc-arrow">→</span><span class="dc-tap"${detailAttr(`unit:${x.to}`)}>${unitIcon(x.to, 'rc-face up')}</span><div class="rc-ut"><b>${esc(unitName(x.u))} → ${esc(unitName(x.to))}</b>${n > 0 ? costLine(p, v.gold, v.have) : `<span class="muted">${esc(L('might.full'))}</span>`}</div><button class="btn btn-small" data-rctrain="${x.u}" data-n="${n}"${ok ? '' : ' disabled'}>${esc(L('train.btn', { n }))}</button></div>`;
      }).join('')
      : `<p class="muted">${esc(L('train.none'))}</p>`;
    const hasUp = v.rows.some((x) => x.up);
    // (owner, 2026-10-29: nobody to be had for want of room — the calm word and the army's own hand right under it)
    const none = !v.why && !v.rows.some((x) => x.units.some((y) => this.most(v, x, y.u) > 0));
    const over = (v.might ?? 0) > (v.mightMax ?? Infinity);
    const stuck = none && (v.crew >= v.crewMax || over) ? `<p class="rc-stuck">${esc(L(over ? 'might.over' : 'room.none'))}</p>` : '';
    root.innerHTML = `${head}<div class="modal-body rc-body"><div class="rc-army"><span class="muted">${esc(L('army'))}</span>${armyEditor(real.army, real.slots)}</div>${boat ? this.boatsStrip(real) : stuck}${res}
      <div class="rc-main"><div class="rc-list">${cards}</div><div class="rc-side">${pick}${hasUp && !boat ? `<div class="rc-train"><h4 class="card-h">${esc(L('train'))}</h4><p class="muted">${esc(L('train.text'))}</p>${ups}</div>` : ''}</div></div></div>`;
    this.bind(root, state);
    // split, merge, dismiss right here (the crew window's own hand and messages); the view asked anew after each
    wireArmy(root, real.army, real.slots, (m) => {
      this.send(m);
      this.reload(real.src);
    }, true);
    // the advice's best kind in sight as the window opens (it may stand low in a waystation's list)
    if (this.seek && v.best && this.sel === v.best) root.querySelector('.rc-unit.sel')?.scrollIntoView({ block: 'nearest' });
    this.seek = false;
  }

  /** The boats' button on the pick: «В шлюпы», «Изменить» a kind in them, «Высадить» it at none. */
  private boatWord(u: UnitId): string {
    return this.cart.has(u) ? (this.n > 0 ? LB('set') : LB('drop')) : LB('add');
  }

  /** The boats' strip (owner, 2026-11-02): their fill bar «Шлюпы: 34 / 60 мест · 2 из 3 отрядов», the men in them (a tap
   *  takes a kind out), the run and the hall's terms, the total with the delivery and «Отправить шлюпы». */
  private boatsStrip(v: DwellView): string {
    const b = v.boat;
    if (!b) return '';
    const ld = this.load(v);
    const pct = Math.round(Math.min(1, ld.men / Math.max(1, b.men)) * 100);
    const chips = [...this.cart].filter(([, n]) => n > 0).map(([u, n]) => `<button type="button" class="rb-chip" data-rbdrop="${u}" title="${esc(`${LB('drop')}: ${unitName(u)}`)}">${unitIcon(u, 'rb-face')}<b>${n}</b><span class="rb-x" aria-hidden="true">×</span></button>`).join('');
    const total: Price = { silver: ld.silver + ld.fee, goods: ld.goods };
    const why = v.why ? serverText(v.why) : '';
    return `<div class="rc-boats${ld.men >= b.men ? ' full' : ''}">
      <div class="rb-top"><span class="rb-ico">${icon(BOATS_ICON, '', 'ico-md')}</span><b class="rb-load">${esc(LB('load', { n: ld.men, max: b.men, k: ld.kinds, kmax: b.stacks }))}</b><i class="rb-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${b.men}" aria-valuenow="${ld.men}"><i style="width:${pct}%"></i></i></div>
      <div class="rb-row"><div class="rb-chips">${chips || `<span class="muted">${esc(LB('empty'))}</span>`}</div>
      <div class="rb-pay">${ld.men ? `<span class="muted">${esc(LB('fee'))}: ${money(ld.fee)}</span><span class="muted">${esc(LB('total'))}:</span>${costLine(total, v.gold, v.have)}` : ''}<button class="btn btn-primary rb-send" data-rbsend${ld.men > 0 && !why ? '' : ' disabled'}>${esc(LB('send'))}</button></div></div>
      <p class="rb-meta muted">${esc(LB('run', { km: dec1(b.km), eta: boatsClock(b.eta), mul: dec1(b.mul).replace(/[.,]0$/, '') }))} · ${esc(LB('hall', { n: b.hall, k: b.stacks, men: b.men, cd: boatsClock(b.cooldown) }))}</p>${why ? `<p class="bad rb-why">${esc(why)}</p>` : ''}</div>`;
  }

  /** «N юнг сойдут на берег»: the hands who make room for the men picked (none: empty). */
  private ashoreLine(v: DwellView, u: UnitId): string {
    const k = UNITS[u].tier >= 2 ? Math.max(0, this.n - Math.max(0, v.crewMax - v.crew)) : 0;
    return k > 0 ? L('swap', { n: k }) : '';
  }

  private bind(root: HTMLElement, state: ClientState): void {
    const v = state.dwell!;
    root.querySelectorAll<HTMLElement>('[data-rcu]').forEach((el) => (el.onclick = () => {
      this.sel = el.dataset.rcu as UnitId;
      this.n = this.cart.get(this.sel) ?? 0;
      this.render(root, state);
    }));
    // «Шлюпы с острова»: the kind put into the boats (its count set anew; none takes it out), a chip taken out, the boats sent
    root.querySelector<HTMLElement>('[data-rcboat]')?.addEventListener('click', () => {
      if (!this.sel) return;
      if (this.n > 0) this.cart.set(this.sel, this.n);
      else this.cart.delete(this.sel);
      this.render(root, state);
    });
    root.querySelectorAll<HTMLElement>('[data-rbdrop]').forEach((el) => (el.onclick = () => {
      this.cart.delete(el.dataset.rbdrop as UnitId);
      if (this.sel === el.dataset.rbdrop) this.n = 0;
      this.render(root, state);
    }));
    root.querySelector<HTMLElement>('[data-rbsend]')?.addEventListener('click', () => {
      const picks = [...this.cart].filter(([, n]) => n > 0).map(([u, n]) => ({ u, n }));
      if (!picks.length) return;
      this.send({ t: 'h3', action: 'boats', picks });
      this.cart.clear();
      this.n = 0;
      this.onSent();
    });
    const slider = root.querySelector<HTMLInputElement>('[data-rcn]');
    const r = this.sel ? v.rows.find((x) => x.units.some((y) => y.u === this.sel)) : undefined;
    const unit = r?.units.find((x) => x.u === this.sel);
    const update = () => {
      if (!unit) return;
      const c = root.querySelector<HTMLElement>('[data-rccount]');
      if (c) c.textContent = String(this.n);
      const cost = root.querySelector<HTMLElement>('[data-rccost]');
      if (cost) cost.innerHTML = costLine(priceOf(unit.per, unit.goods, this.n), v.gold, v.have);
      const sw = root.querySelector<HTMLElement>('[data-rcswap]');
      if (sw && this.sel) sw.textContent = this.ashoreLine(v, this.sel);
      const go = root.querySelector<HTMLButtonElement>('[data-rcgo]');
      if (go && !root.querySelector('.rc-why')) go.disabled = this.n <= 0;
      const put = root.querySelector<HTMLButtonElement>('[data-rcboat]');
      if (put && !root.querySelector('.rc-why') && this.sel) {
        put.disabled = this.n <= 0 && !this.cart.has(this.sel);
        put.textContent = this.boatWord(this.sel);
      }
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
      if (!this.sel || this.n <= 0 || v.src === 'boat') return;
      this.send({ t: 'h3', action: 'recruit', src: v.src, u: this.sel, n: this.n });
      this.n = 0;
    });
    root.querySelectorAll<HTMLElement>('[data-rctrain]').forEach((el) => (el.onclick = () => v.src !== 'boat' && this.send({ t: 'h3', action: 'train', src: v.src, u: el.dataset.rctrain as UnitId, n: Number(el.dataset.n) })));
  }
}
