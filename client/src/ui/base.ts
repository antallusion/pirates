// "My Island" (docs/15 items 1–3): one's own island as a base in the manner of the mobile strategies. A diamond
// grid of plots drawn in CSS, the island's isometric buildings standing on them at their stage (whole, weathered,
// ruined — or scaffolded while the builders are at work); the yard's resources and yields over it; a tap on a plot
// opens a compact sheet: what may be built there and what it costs, the work under way and its speed-ups, the next
// level, a move to another free plot. Phones first (portrait and landscape), then tablets and the desk.

import { guildYardCard, wireGuildYard } from './social.ts';
import { GRID, PLOT_CELLS, PRODUCERS, isProducer, producerOf, producerRate, speedupSilver } from '../../../shared/src/data/base.ts';
import type { ProducerKind } from '../../../shared/src/data/base.ts';
import { ISLE_LEVELS } from '../../../shared/src/data/estate.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { BUILDINGS } from '../../../shared/src/data/holdings.ts';
import type { BuildingId } from '../../../shared/src/data/holdings.ts';
import type { BaseCellView, BaseView, ClientMsg, OwnShipView } from '../../../shared/src/protocol.ts';
import { OWN_ROLE_DEFS } from '../../../shared/src/data/baseships.ts';
import { WATERS } from '../../../shared/src/data/baseclaim.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { ask } from './confirm.ts';
import type { OwnRole } from '../../../shared/src/data/baseships.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { dict, lang } from '../i18n.ts';
import { serverText } from '../lang/server.ts';
import { EN, RU } from '../lang/ui/base.ts';
import { EN as CO_EN, RU as CO_RU } from '../lang/ui/company.ts';
import type { ClientState } from '../state.ts';
import { assetUrl } from '../assets.ts';
import { dec1, esc, fmt, icon, money } from './dom.ts';
import { placeName } from './maps.ts';
import { bindTown, townTab } from './town.ts';
import { EN as H_EN, RU as H_RU } from '../lang/ui/h3.ts';

const L = dict(EN, RU);
const CO = dict(CO_EN, CO_RU);
const H = dict(H_EN, H_RU);

/** A thing's name in the reader's tongue (buildings are swapped in place by the data overlay). */
export function baseName(what: string): string {
  const k = producerOf(what);
  if (k) return PRODUCERS[k].name[lang() === 'ru' ? 1 : 0];
  return BUILDINGS[what as BuildingId]?.name ?? what;
}

function baseText(what: string): string {
  const k = producerOf(what);
  if (k) return PRODUCERS[k].text[lang() === 'ru' ? 1 : 0];
  return BUILDINGS[what as BuildingId]?.description ?? '';
}

/** The picture of a plot's thing at its stage: a producer grows like an outpost; a building wears by its
 *  condition; either is its frame of beams (the ruined stage) while it is first raised. */
export function baseArt(what: string, level: number, condition = 1, unpaid = false, raising = false): string | null {
  const k = producerOf(what);
  const d = k ? PRODUCERS[k] : null;
  const id = d ? d.art : `build_${what}`;
  let stage = 0;
  if (raising) stage = 1;
  else if (d && d.stages === 'growth') stage = level >= 5 ? 0 : level >= 3 ? 2 : 1;
  else if (!d) stage = condition < 0.35 ? 1 : condition < 0.7 || unpaid ? 2 : 0;
  return (stage ? assetUrl(`icon.${id}_${stage}`) : null) ?? assetUrl(`icon.${id}`);
}

export function timeText(secs: number): string {
  const s = Math.max(0, Math.ceil(secs));
  if (s < 60) return L('t_s', { s });
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const m = Math.floor(s / 60);
  return L('t_hm', { h: Math.floor(m / 60), m: String(m % 60).padStart(2, '0') });
}

function spanText(secs: number): string {
  const m = Math.round(secs / 60);
  if (m < 1) return L('t_s', { s: Math.round(secs) });
  if (m < 60) return L('t_m', { m });
  return L('t_hm', { h: Math.floor(m / 60), m: m % 60 });
}

const sv = (s: string | null) => (s ? serverText(s) : '');

/** The grid shown: as many rings round the middle as the island has opened, so a young island's few plots stand
 *  large (the ring still shut shows its plots faintly, with the level that opens them). */
const MID = (GRID - 1) / 2;
const ringOf = (plot: number) => Math.max(Math.abs(PLOT_CELLS[plot][0] - MID), Math.abs(PLOT_CELLS[plot][1] - MID));

interface Layout { n: number; off: number; tw: number; over: number; h: number }
function layout(v: BaseView): Layout {
  let r = 1;
  for (let k = 0; k < v.plots; k++) r = Math.max(r, ringOf(k));
  const n = 2 * r + 1;
  const tw = 1 / n; // a tile's width against the board's
  const over = 0.55 * tw; // room over the back row for the tallest pictures
  return { n, off: MID - r, tw, over, h: over + 0.5 };
}

/** Where a plot's diamond stands on the board, in per cent of the board's width and height. */
function tilePos(plot: number, g: Layout): { left: number; top: number; w: number; hh: number; z: number } {
  const i = PLOT_CELLS[plot][0] - g.off, j = PLOT_CELLS[plot][1] - g.off;
  const left = 50 + (i - j) * (g.tw * 50) - g.tw * 50;
  const top = ((g.over + (i + j) * (g.tw / 4)) / g.h) * 100; // a row down is half a tile's height
  return { left, top, w: g.tw * 100, hh: ((g.tw / 2) / g.h) * 100, z: (i + j) * 10 + i + 1 };
}

/** A ship's top-down picture laid on its side, bow to the right (the world's own sprites, docs/15 item 4). */
function shipPic(classId: ShipClassId, cls = 'sy-pic'): string {
  const url = assetUrl(SHIP_CLASSES[classId]?.sprite ?? '');
  return `<span class="${cls}">${url ? `<img src="${url}" alt="" draggable="false">` : ''}</span>`;
}

/** A phone lying on its side: the landscape layout of the window (the same query as its styles). */
const LANDSCAPE = matchMedia('(max-height: 520px) and (min-aspect-ratio: 1/1)');

export class BaseWindow {
  sel: number | null = null;
  /** The island's plots, or its shipyard (docs/15 item 4). */
  tab: 'plots' | 'yard' | 'town' = 'plots';
  moving: number | null = null;
  private send: (m: ClientMsg) => void;
  private asked = 0;
  /** "Sail to defend": the window closes and the HUD's «Now:» points to the raiders (docs/15 item 7). */
  onSail: () => void = () => {};
  /** The town's recruit window (docs/17 H3). */
  onRecruit: () => void = () => {};
  /** The market's order being drawn up (docs/17 H3). */
  private mk: { give: string; get: string; n: number } = { give: 'silver', get: 'timber', n: 100 };

  /** The layout changed (a phone turned): the window is drawn afresh. */
  onLayout: () => void = () => {};

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    LANDSCAPE.addEventListener('change', () => this.onLayout());
  }

  open(): void {
    this.sel = null;
    this.moving = null;
    this.send({ t: 'base', action: 'view' });
  }

  /** The server's wall clock now, by the view's clock and the time since it came. */
  private now(state: ClientState): number {
    return (state.base?.now ?? Date.now()) + (Date.now() - state.baseAt);
  }

  render(root: HTMLElement, state: ClientState): void {
    const v = state.base;
    const ru = lang() === 'ru' ? 1 : 0;
    if (!v) {
      root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2></div></div><div class="modal-body"><p class="muted">${esc(state.baseAt ? L('none') : L('loading'))}</p></div>`;
      return;
    }
    if (this.sel !== null && this.sel >= v.plots) this.sel = null;
    const title = ISLE_LEVELS[v.level]?.name[ru] ?? v.levelName;
    const res = v.store.map((r) => `<span class="bres${r.n >= r.cap ? ' full' : ''}" style="--fill:${Math.round(Math.min(1, r.n / Math.max(1, r.cap)) * 100)}%" title="${esc(L('res_tip', { good: GOODS[r.good].name, n: r.n, cap: r.cap, rate: dec1(r.rate) }))}"><span class="bres-top">${icon(`good_${r.good}`, '', 'ico-sm')}<b>${fmt(r.n)}</b><i>/${fmt(r.cap)}</i></span><span class="bfill"><i style="width:${Math.round(Math.min(1, r.n / Math.max(1, r.cap)) * 100)}%"></i></span><em>${r.rate > 0 ? esc(L('per_h', { n: dec1(r.rate).replace(/[.,]0$/, '') })) : '—'}</em></span>`).join('');
    const fresh = v.cells.reduce((a, c) => a + c.fresh, 0);
    const bar = `<div class="base-bar"><div class="base-res">${res}</div>
      <div class="base-meta"><span class="bmeta" title="${esc(`${L('crews')}${v.crews.next ? ` · ${L('crew_next', { n: v.crews.next })}` : ''}`)}">${icon('menu_crew', '', 'ico-sm')}<span class="bm-w">${esc(L('crews'))}</span> ${v.crews.busy}/${v.crews.n}</span>
      <span class="bmeta" title="${esc(`${L('tokens')} · ${L('tokens_tip', { m: v.tokenSecs / 60 })}`)}">⌛<span class="bm-w">${esc(L('tokens'))}:</span> ${v.speedups}</span>
      <span class="bmeta bpower" title="${esc(L('power_tip', { now: v.power.now, need: v.power.need ?? '—', crew: v.power.crew }))}">${icon('tab_isles', '', 'ico-sm')}<span class="bm-w">${esc(L('power'))}</span> ${v.power.now}${v.power.need ? `/${v.power.need}` : ''}</span>
      <span class="bmeta">${money(state.self?.gold ?? 0)}</span>
      <button class="btn btn-small${fresh ? ' btn-primary' : ''}" data-bcollect title="${esc(L('collect_tip'))}"${fresh ? '' : ' disabled'}>${esc(L('collect'))}${fresh ? ` +${fmt(fresh)}` : ''}</button></div></div>`;
    const sy = v.shipyard;
    const tabs = `<div class="btabs" role="tablist"><button class="btab${this.tab === 'plots' ? ' sel' : ''}" role="tab" aria-selected="${this.tab === 'plots'}" data-btab="plots">${esc(L('tab_plots'))}</button><button class="btab${this.tab === 'yard' ? ' sel' : ''}" role="tab" aria-selected="${this.tab === 'yard'}" data-btab="yard">${esc(L('tab_yard'))} <i>${sy.ships.length}/${sy.max}</i></button>${v.town ? `<button class="btab${this.tab === 'town' ? ' sel' : ''}" role="tab" aria-selected="${this.tab === 'town'}" data-btab="town">${esc(H('tab'))}</button>` : ''}</div>`;
    // A phone on its side (docs/15 item 8): the board fills the left, and the resources, the waters and the sheet
    // scroll together on the right, so the board is not squeezed under three header rows.
    const land = LANDSCAPE.matches;
    const top = `${bar}${this.defence(v)}`;
    if (this.tab === 'town' && !v.town) this.tab = 'plots';
    const body = this.tab === 'town'
      ? `<div class="modal-body base-body yard-body town-body">${land ? top : ''}${townTab(v, state, this.mk)}</div>`
      : this.tab === 'yard'
      ? `<div class="modal-body base-body yard-body">${land ? top : ''}${this.yard(v, state)}</div>`
      : `<div class="modal-body base-body${land ? ' base-land' : ''}"><div class="base-stage"><div class="base-board${this.moving !== null ? ' moving' : ''}" style="--ar:${(1 / layout(v).h).toFixed(4)}">${this.board(v)}</div></div><div class="base-sheet">${land ? top : ''}${this.sheet(v, state)}</div></div>`;
    root.innerHTML = `<div class="modal-head base-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L('sub', { name: placeName(v.name), level: v.level, title }))} · ${esc(L('land', { biome: CO(`biome_${v.biome}` as 'biome_temperate') }))}</div></div>${tabs}</div>
      ${land ? '' : top}${body}`;
    this.bind(root, state);
    wireGuildYard(root, this.send); // docs/16 #34
    this.tick(root, state);
  }

  private board(v: BaseView): string {
    const now = v.now;
    const g = layout(v);
    const out: string[] = [];
    const over: string[] = [];
    const nextLevel = v.locked.find((l) => l.level > 0)?.level ?? 0;
    for (let k = 0; k < PLOT_CELLS.length; k++) {
      if (ringOf(k) > (g.n - 1) / 2) continue;
      const pos = tilePos(k, g);
      const box = `left:${pos.left.toFixed(2)}%;top:${pos.top.toFixed(2)}%;width:${pos.w.toFixed(2)}%;height:${pos.hh.toFixed(2)}%`;
      const style = `${box};z-index:${pos.z}`;
      if (k >= v.plots) {
        const lock = v.locked.find((l) => l.plot === k);
        const soon = lock && lock.level === nextLevel && nextLevel > 0;
        out.push(`<div class="bplot locked${soon ? ' soon' : ''}" style="${style}"${lock?.level ? ` title="${esc(L('locked', { n: lock.level }))}"` : ''}><i class="bground"></i></div>`);
        continue;
      }
      const c = v.cells[k];
      const raising = !!c.job && c.job.level <= 1;
      const art = c.what ? baseArt(c.what, Math.max(1, c.level), c.condition, c.unpaid, raising) : null;
      const cls = ['bplot', c.what ? 'built' : 'empty', this.sel === k ? 'sel' : '', raising ? 'raising' : '', c.job ? 'working' : '', this.moving !== null && !c.what ? 'target' : '', c.idle ? 'idle' : ''].filter(Boolean).join(' ');
      const label = c.what ? `${baseName(c.what)}${c.level ? ` · ${L('lvl', { n: c.level })}` : ''}` : L('empty');
      const prog = c.job ? Math.max(0, Math.min(1, (now - c.job.start) / Math.max(1, c.job.end - c.job.start))) : 0;
      // A diamond, not a box: the plot answers on its diamond and its building's body (the square boxes of the grid
      // lie over each other), so it is a role, not a <button>.
      out.push(`<div class="${cls}" style="${style}" data-plot="${k}" role="button" tabindex="0" aria-label="${esc(`${L('plot', { n: k + 1 })}: ${label}`)}"><i class="bground"></i>
        ${art ? `<img class="bart" src="${art}" alt="" draggable="false"><i class="bhit"></i>` : c.what ? '' : '<span class="bplus">+</span>'}</div>`);
      // Timers, levels and yields ride over every picture, so a building in front never hides them.
      const marks = `${c.what && c.level && !raising ? `<span class="blvl">${c.level}</span>` : ''}${c.job ? `<span class="btimer"><span class="btime" data-end="${c.job.end}">${esc(timeText((c.job.end - now) / 1000))}</span><span class="bprog"><i data-start="${c.job.start}" data-stop="${c.job.end}" style="width:${Math.round(prog * 100)}%"></i></span></span>` : ''}${c.fresh > 0 && !c.job ? `<span class="bfresh">${icon(`good_${PRODUCERS[producerOf(c.what!)!].good}`, '', 'ico-sm')}+${fmt(c.fresh)}</span>` : ''}`;
      if (marks) over.push(`<div class="bover" style="${box};z-index:${500 + pos.z}">${marks}</div>`);
    }
    return out.join('') + over.join('');
  }

  private costHtml(v: BaseView, c: { silver: number; goods: Partial<Record<GoodId, number>>; secs: number }, gold: number): string {
    const have = (g: GoodId) => v.store.find((r) => r.good === g)?.n;
    const goods = (Object.entries(c.goods) as [GoodId, number][]).map(([g, n]) => {
      const h = have(g);
      return `<span class="bcost${h !== undefined && h < n ? ' lack' : ''}" title="${esc(GOODS[g].name)}">${icon(`good_${g}`, '', 'ico-sm')}${fmt(n)}</span>`;
    }).join('');
    return `<span class="bcosts"><span class="bcost${gold < c.silver ? ' lack' : ''}">${money(c.silver)}</span>${goods}<span class="bcost btimec">⏱ ${esc(spanText(c.secs))}</span></span>`;
  }

  private sheet(v: BaseView, state: ClientState): string {
    const gold = state.self?.gold ?? 0;
    const nextPlot = v.locked.find((l) => l.level > 0);
    const foot = `<p class="muted bfoot">${esc(L('plots', { used: v.cells.filter((c) => c.what).length, total: v.plots }))}${nextPlot ? ` · ${esc(L('locked', { n: nextPlot.level }))}` : ''} · ${esc(L('slots', { used: v.slots.used, total: v.slots.total }))}${v.crews.next ? ` · ${esc(L('crew_next', { n: v.crews.next }))}` : ''}<br>${esc(v.near ? L('hold_pays') : L('store_pays'))}</p>`;
    if (this.moving !== null) {
      const c = v.cells[this.moving];
      return `<div class="bsheet-h">${c?.what ? this.thumb(c) : ''}<div><b>${esc(c?.what ? baseName(c.what) : '')}</b><p class="muted">${esc(L('moving'))}</p></div></div><button class="btn" data-bcancel>${esc(L('cancel'))}</button>`;
    }
    if (this.sel === null) {
      const jobs = v.cells.filter((c) => c.job);
      return `<p class="bhint">${esc(L('pick'))}</p>${this.levelCard(v)}${this.watersCard(v)}
        <div class="bsec">${esc(L('work'))}</div>${jobs.map((c) => `<button class="bjob" data-plot="${c.plot}">${this.thumb(c)}<span><b>${esc(baseName(c.what!))}</b><br><span class="muted">${esc(c.job!.level <= 1 ? L('raising') : L('upgrading', { n: c.job!.level }))} · </span><span class="btime" data-end="${c.job!.end}">${esc(timeText((c.job!.end - v.now) / 1000))}</span></span></button>`).join('') || `<p class="muted">${esc(L('no_work'))}</p>`}${foot}`;
    }
    const c = v.cells[this.sel];
    if (!c.what) {
      const busy = v.crews.busy >= v.crews.n;
      const row = (x: BaseView['catalog'][number]) => {
        const art = baseArt(x.what, 1);
        return `<div class="bopt${x.why ? ' off' : ''}">${art ? `<img class="bopt-art" src="${art}" alt="">` : ''}<div class="bopt-main"><b>${esc(baseName(x.what))}</b><span class="muted bopt-text">${esc(x.why ? sv(x.why) : baseText(x.what))}</span>${this.costHtml(v, x, gold)}</div>${x.why ? '' : `<button class="btn btn-small btn-primary" data-bbuild="${esc(x.what)}"${busy ? ' disabled' : ''}>${esc(L('build'))}</button>`}</div>`;
      };
      const ok = v.catalog.filter((x) => !x.why), no = v.catalog.filter((x) => x.why);
      const group = (list: BaseView['catalog']) => {
        const prod = list.filter((x) => isProducer(x.what)), bld = list.filter((x) => !isProducer(x.what));
        return `${prod.length ? `<div class="bsec">${esc(L('producers'))}</div>${prod.map(row).join('')}` : ''}${bld.length ? `<div class="bsec">${esc(L('buildings'))}</div>${bld.map(row).join('')}` : ''}`;
      };
      return `<div class="bsheet-h"><span class="bthumb bthumb-empty">+</span><div><b>${esc(L('plot', { n: this.sel + 1 }))}</b> <span class="muted">${esc(L('empty'))}</span><p class="${busy ? 'bad' : 'muted'}">${esc(busy ? serverText('All your builders are at work.') : L('can_build'))}</p></div></div>
        ${group(ok)}${no.length ? `<details class="bno"><summary>${esc(L('cannot', { n: no.length }))}</summary>${group(no)}</details>` : ''}${foot}`;
    }
    const kind = producerOf(c.what);
    const raising = !!c.job && c.job.level <= 1;
    const isl = state.base!;
    const state1 = kind
      ? `<p>${esc(L('yields', { rate: dec1(producerRate(kind as ProducerKind, Math.max(1, c.level), isl.biome)), good: GOODS[PRODUCERS[kind].good].name.toLowerCase() }))}${c.idle ? ` <span class="bad">${esc(L('idle'))}</span>` : ''}</p>`
      : raising ? '' : `<p class="${c.unpaid || c.condition < 0.7 ? 'bad' : 'muted'}">${esc(L('condition', { n: Math.round(c.condition * 100) }))}${c.unpaid ? ` · ${esc(L('unpaid'))}` : ''}</p>`;
    const job = c.job ? `<div class="bjobcard"><div class="row"><b>${esc(raising ? L('raising') : L('upgrading', { n: c.job.level }))}</b><span>${esc(L('left', { t: '\u0000' })).replace('\u0000', `<span class="btime" data-end="${c.job.end}">${esc(timeText((c.job.end - v.now) / 1000))}</span>`)}</span></div>
      <span class="bprog big"><i data-start="${c.job.start}" data-stop="${c.job.end}"></i></span>
      <div class="bspeed"><button class="btn btn-small btn-primary" data-bspeed="silver" data-job="${c.job.id}">${esc(L('finish'))} <span data-price="${c.job.end}">${money(c.job.silver)}</span></button>
      <button class="btn btn-small" data-bspeed="res" data-job="${c.job.id}">${esc(L('finish'))} ${(Object.entries(c.job.goods) as [GoodId, number][]).map(([g, n]) => `${icon(`good_${g}`, '', 'ico-sm')}${fmt(n)}`).join(' ')}</button>
      <button class="btn btn-small" data-bspeed="token" data-job="${c.job.id}"${v.speedups ? '' : ' disabled'}>⌛ ${esc(L('token', { m: v.tokenSecs / 60 }))} (${v.speedups})</button></div></div>` : '';
    const up = raising ? '' : c.up ? `<div class="bupcard"><div class="row"><b>${esc(L('upgrade', { n: c.up.level }))}</b></div>${this.costHtml(v, c.up, gold)}${c.up.why ? `<p class="muted">${esc(sv(c.up.why))}</p>` : ''}<button class="btn btn-small btn-primary" data-bup${c.up.why ? ' disabled' : ''}>${esc(L('upgrade', { n: c.up.level }))}</button></div>`
      : `<p class="muted">${esc(kind || c.level > 1 ? L('max') : L('one_level'))}</p>`;
    return `<div class="bsheet-h">${this.thumb(c)}<div><b>${esc(baseName(c.what))}</b> <span class="muted">${esc(L('plot', { n: c.plot + 1 }))}${c.level && !raising ? ` · ${esc(L('level', { n: c.level }))}` : ''}</span><p class="muted bdesc">${esc(baseText(c.what))}</p></div></div>
      ${state1}${job}${up}<div class="row bactions"><button class="btn btn-small" data-bmove>${esc(L('move'))}</button></div>${foot}`;
  }

  /** The island's waters, tax and defence under the resources, and a raid under way over everything (docs/15 items 6–7). */
  private defence(v: BaseView): string {
    const c = v.claim;
    const ru = lang() === 'ru' ? 1 : 0;
    const faction = serverText(FACTIONS[c.faction as keyof typeof FACTIONS]?.name ?? c.faction);
    const tax = c.tax > 0
      ? `<span class="bmeta${c.unpaid ? ' bad' : ''}" title="${esc(L('def_tax_tip', { faction, n: fmt(c.tax), have: fmt(c.treasury), when: spanText((c.taxAt - v.now) / 1000) }))}">${icon('coin', '', 'ico-sm')}${esc(L('def_tax', { n: fmt(c.tax) }))}${c.unpaid ? ` · ${esc(L('def_unpaid', { n: c.unpaid }))}` : ''}</span>`
      : `<span class="bmeta muted">${esc(L('def_tax_none'))}</span>`;
    const guard = c.strength > 0
      ? `<span class="bmeta" title="${esc(L('def_tip', { b: c.batteries, f: c.forts, s: c.ships, n: c.defence, r: c.strength }))}">${icon('build_battery', '', 'ico-sm')}${esc(L('def_rating', { n: c.defence }))} · <span class="${c.odds >= 0.5 ? 'good' : 'bad'}">${esc(L('def_odds', { p: Math.round(c.odds * 100) }))}</span></span>`
      : `<span class="bmeta good">${esc(L('def_safe'))}</span>`;
    const strip = `<div class="base-def"><span class="bdef-w w-${c.waters}">${esc(WATERS[c.waters].name[ru])}</span>${tax}${guard}</div>`;
    const r = c.raid;
    if (!r) return strip;
    return `${strip}<div class="base-raid" role="alert"><div class="braid-main"><b>${esc(L('raid_title'))}</b>
      <span class="braid-clock">${esc(L('raid_land'))} <span class="btime" data-end="${r.until}">${esc(timeText((r.until - v.now) / 1000))}</span></span>
      <span class="muted">${esc(r.ships ? L('raid_ships', { a: r.alive, n: r.ships, r: r.strength }) : L('raid_far'))} · ${esc(L('raid_hold', { p: Math.round(c.odds * 100) }))}</span></div>
      ${r.ships ? `<button class="btn btn-small btn-danger" data-bsail>${esc(L('raid_sail'))}</button>` : ''}</div>`;
  }

  /** The waters card on the plots' sheet: what draws raiders, the day's losses, and moving house (docs/15 items 6–7). */
  private watersCard(v: BaseView): string {
    const c = v.claim;
    const ru = lang() === 'ru' ? 1 : 0;
    const calm = c.strength > 0 && c.calmUntil > v.now && !c.raid ? `<p class="muted">${esc(L('def_calm', { t: spanText((c.calmUntil - v.now) / 1000) }))}</p>` : '';
    const lines = c.strength > 0
      ? `<p class="${c.worth >= c.fat ? 'bad' : 'muted'}">${esc(L('def_worth', { w: fmt(c.worth), f: fmt(c.fat) }))}</p>${calm}${c.lost > 0 ? `<p class="muted">${esc(L('def_lost', { n: Math.round(c.lost * 100), cap: Math.round(c.lossCap * 100) }))}</p>` : ''}<p class="muted">${esc(L('def_help'))}</p>`
      : `<p class="muted">${esc(L('def_safe'))}</p>`;
    return `<div class="bupcard bwaters"><div class="row"><b>${esc(L('def_card'))}</b><span class="bdef-w w-${c.waters}">${esc(WATERS[c.waters].name[ru])}</span></div>${lines}
      <button class="btn btn-small btn-danger" data-babandon${c.abandonWhy ? ` disabled title="${esc(sv(c.abandonWhy))}"` : ''}>${esc(L('abandon'))}</button>${c.abandonWhy ? `<p class="muted">${esc(sv(c.abandonWhy))}</p>` : ''}</div>`;
  }

  /** The island's next level (docs/15 item 5): its power, its treasury and its goods, and the step itself. */
  private levelCard(v: BaseView): string {
    const ru = lang() === 'ru' ? 1 : 0;
    const u = v.levelUp;
    if (!u) return `<p class="muted">${esc(L('isle_max'))}</p>`;
    const goods = (Object.entries(u.goods) as [GoodId, number][]).map(([g, n]) => `<span class="bcost" title="${esc(GOODS[g].name)}">${icon(`good_${g}`, '', 'ico-sm')}${fmt(n)}</span>`).join('');
    return `<div class="bupcard blevel"><div class="row"><b>${esc(L('isle_up', { n: u.level, title: ISLE_LEVELS[u.level]?.name[ru] ?? '' }))}</b>${u.power ? `<span class="${v.power.now >= u.power ? 'good' : 'bad'}">${esc(L('isle_power', { now: v.power.now, need: u.power }))}</span>` : ''}</div>
      <span class="bcosts"><span class="bcost${u.treasury < u.silver ? ' lack' : ''}">${esc(L('isle_treasury', { have: fmt(u.treasury), need: fmt(u.silver) }))}</span></span>
      ${goods ? `<span class="bcosts"><span class="muted">${esc(L('isle_goods'))}</span>${goods}</span>` : ''}
      ${u.why ? `<p class="muted">${esc(sv(u.why))}</p>` : ''}<button class="btn btn-small btn-primary" data-blevel${u.why ? ' disabled' : ''}>${esc(L('isle_raise'))}</button></div>`;
  }

  /** The shipyard: her own ships as cards, what the slipway may build, the squadron's berths (docs/15 item 4). */
  private yard(v: BaseView, state: ClientState): string {
    const y = v.shipyard;
    const gold = state.self?.gold ?? 0;
    const ru = lang() === 'ru' ? 1 : 0;
    const head = y.level
      ? `<p class="sy-info"><b>${esc(L('sy_level', { n: y.level, max: y.shipMax }))}</b>${y.level < 5 ? ` <span class="muted">${esc(L('sy_next'))}</span>` : ''}</p>`
      : `<p class="sy-info bad">${esc(L('sy_none'))}</p>`;
    const sq = `<p class="sy-squad"><span>${esc(L('sy_squad', { own: y.squadron.own, max: y.squadron.ownMax, hired: y.squadron.hired, berths: y.squadron.berths }))}</span> <span class="muted">${esc(L('sy_rule'))}</span></p>`;
    const cards = y.ships.map((x) => this.shipCard(v, x, gold, ru)).join('');
    const offers = y.level && y.ships.length < y.max
      ? `<div class="bsec">${esc(L('sy_new', { n: y.ships.length, max: y.max }))}</div><div class="sy-offers">${y.offers.map((o) => `<div class="bopt sy-offer${o.why ? ' off' : ''}">${shipPic(o.classId, 'sy-pic sy-pic-sm')}<div class="bopt-main"><b>${esc(OWN_ROLE_DEFS[o.role].name[ru])} <span class="muted sy-cls">${esc(SHIP_CLASSES[o.classId].name)}</span></b><span class="muted bopt-text">${esc(o.why ? sv(o.why) : OWN_ROLE_DEFS[o.role].text[ru])}</span>${this.costHtml(v, o, gold)}</div>${o.why ? '' : `<button class="btn btn-small btn-primary" data-sybuild="${o.role}">${esc(L('sy_build'))}</button>`}</div>`).join('')}</div>`
      : '';
    return `${head}${sq}${cards ? `<div class="sy-cards">${cards}</div>` : ''}${offers}${guildYardCard(v.guildYard)}`;
  }

  private shipCard(v: BaseView, x: OwnShipView, gold: number, ru: number): string {
    const d = OWN_ROLE_DEFS[x.role as OwnRole];
    const hullPct = Math.round(x.hull * 100);
    const xpPct = Math.round(Math.min(1, x.xp / Math.max(1, x.xpNext)) * 100);
    const bonus = x.role === 'merchant' ? L('sy_b_hold', { n: x.bonus.hold }) : x.role === 'scout' ? L('sy_b_sight', { n: Math.round(x.bonus.sight * 100) }) : x.role === 'fisher' ? L('sy_b_haul', { n: x.bonus.haul }) : L('sy_b_war');
    const j = x.job;
    const job = j ? `<div class="sy-job"><div class="row"><b>${esc(j.kind === 'upgrade' ? L('sy_job_upgrade', { n: j.level }) : j.kind === 'repair' ? L('sy_job_repair') : L('sy_job_build'))}</b><span>${esc(L('left', { t: '\u0000' })).replace('\u0000', `<span class="btime" data-end="${j.end}">${esc(timeText((j.end - v.now) / 1000))}</span>`)}</span></div>
      <span class="bprog big"><i data-start="${j.start}" data-stop="${j.end}"></i></span>
      <div class="bspeed"><button class="btn btn-small btn-primary" data-bspeed="silver" data-job="${j.id}">${esc(L('finish'))} <span data-price="${j.end}">${money(j.silver)}</span></button>
      <button class="btn btn-small" data-bspeed="res" data-job="${j.id}">${esc(L('finish'))} ${(Object.entries(j.goods) as [GoodId, number][]).map(([g, n]) => `${icon(`good_${g}`, '', 'ico-sm')}${fmt(n)}`).join(' ')}</button>
      <button class="btn btn-small" data-bspeed="token" data-job="${j.id}"${v.speedups ? '' : ' disabled'}>⌛ ${esc(L('token', { m: v.tokenSecs / 60 }))} (${v.speedups})</button></div></div>` : '';
    const acts: string[] = [];
    if (x.state === 'sea') acts.push(`<button class="btn btn-small" data-syrecall="${esc(x.id)}"${x.recallWhy ? ` disabled title="${esc(sv(x.recallWhy))}"` : ''}>${esc(L('sy_recall'))}</button>`);
    else if (x.state === 'home') acts.push(`<button class="btn btn-small btn-primary" data-sylaunch="${esc(x.id)}"${x.launchWhy ? ' disabled' : ''}>${esc(L('sy_launch'))}</button>`);
    const why = x.state === 'home' && x.launchWhy ? `<p class="muted sy-why">${esc(sv(x.launchWhy))}</p>` : '';
    const repair = x.repair && !j ? `<div class="sy-act"><div class="row"><b>${esc(L('sy_repair'))}</b>${this.costHtml(v, x.repair, gold)}</div>${x.repair.why ? `<p class="muted sy-why">${esc(sv(x.repair.why))}</p>` : ''}<button class="btn btn-small${x.state === 'laid_up' ? ' btn-primary' : ''}" data-syrepair="${esc(x.id)}"${x.repair.why ? ' disabled' : ''}>${esc(L('sy_repair'))}</button></div>` : '';
    const up = j || x.state === 'laid_up' ? '' : x.up
      ? `<div class="sy-act"><div class="row"><b>${esc(x.up.classId !== x.classId ? L('sy_up_hull', { n: x.up.level, hull: SHIP_CLASSES[x.up.classId].name }) : L('sy_up', { n: x.up.level }))}</b>${this.costHtml(v, x.up, gold)}</div>${x.up.why ? `<p class="muted sy-why">${esc(sv(x.up.why))}</p>` : ''}<button class="btn btn-small" data-syup="${esc(x.id)}"${x.up.why ? ' disabled' : ''}>${esc(L('sy_up', { n: x.up.level }))}</button></div>`
      : `<p class="muted">${esc(L('sy_max'))}</p>`;
    return `<div class="sy-card st-${x.state}"><div class="sy-top">${shipPic(x.classId)}<div class="sy-id"><b class="sy-name">${esc(x.name[ru])}</b><span class="sy-sub">${esc(d.name[ru])} · ${esc(SHIP_CLASSES[x.classId].name)}</span></div><span class="sy-lvl" title="${esc(L('level', { n: x.level }))}">⚓${x.level}</span></div>
      <p class="sy-state">${esc(L(`sy_st_${x.state}` as 'sy_st_home'))}${x.catch ? ` · ${esc(L('sy_catch', { n: x.catch }))}` : ''}</p>
      <div class="sy-bars"><span class="sy-bar hull${hullPct < 50 ? ' low' : ''}"><em>${esc(L('sy_hull', { n: hullPct }))}</em><i style="width:${hullPct}%"></i></span><span class="sy-bar xp${xpPct >= 100 ? ' ready' : ''}"><em>${esc(xpPct >= 100 && x.up ? L('sy_ready') : L('sy_xp', { xp: x.xp, next: x.xpNext }))}</em><i style="width:${xpPct}%"></i></span></div>
      ${x.state === 'laid_up' ? '' : `<p class="sy-bonus">${esc(bonus)}</p>`}${job}${why}${acts.length ? `<div class="row sy-acts">${acts.join('')}</div>` : ''}${repair}${up}</div>`;
  }

  private thumb(c: BaseCellView): string {
    const art = c.what ? baseArt(c.what, Math.max(1, c.level), c.condition, c.unpaid, !!c.job && c.job.level <= 1) : null;
    return art ? `<img class="bthumb" src="${art}" alt="">` : '<span class="bthumb bthumb-empty">+</span>';
  }

  private bind(root: HTMLElement, state: ClientState): void {
    const v = state.base!;
    const redraw = () => this.render(root, state);
    root.querySelectorAll<HTMLElement>('.bplot[data-plot]').forEach((el) => (el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    }));
    root.querySelectorAll<HTMLElement>('[data-plot]').forEach((el) => (el.onclick = () => {
      const k = Number(el.dataset.plot);
      if (this.moving !== null) {
        if (!v.cells[k]?.what && k !== this.moving) this.send({ t: 'base', action: 'move', plot: this.moving, to: k });
        this.moving = null;
        this.sel = k;
        return redraw();
      }
      this.sel = this.sel === k && !el.classList.contains('bjob') ? null : k;
      redraw();
    }));
    root.querySelectorAll<HTMLElement>('[data-btab]').forEach((el) => (el.onclick = () => {
      this.tab = el.dataset.btab === 'yard' ? 'yard' : el.dataset.btab === 'town' ? 'town' : 'plots';
      redraw();
    }));
    root.querySelector<HTMLElement>('[data-blevel]')?.addEventListener('click', () => {
      this.send({ t: 'estate', action: 'level' });
      this.send({ t: 'base', action: 'view' });
    });
    root.querySelectorAll<HTMLElement>('[data-sybuild]').forEach((el) => (el.onclick = () => this.send({ t: 'base', action: 'ship_build', role: el.dataset.sybuild as OwnRole })));
    for (const [attr, action] of [['sylaunch', 'ship_launch'], ['syrecall', 'ship_recall'], ['syrepair', 'ship_repair'], ['syup', 'ship_upgrade']] as const) {
      root.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach((el) => (el.onclick = () => this.send({ t: 'base', action, ship: el.dataset[attr]! })));
    }
    root.querySelector<HTMLElement>('[data-bcollect]')?.addEventListener('click', () => this.send({ t: 'base', action: 'collect' }));
    bindTown(root, this.send, this.mk, () => this.onRecruit(), redraw);
    root.querySelector<HTMLElement>('[data-bsail]')?.addEventListener('click', () => this.onSail());
    root.querySelector<HTMLElement>('[data-babandon]')?.addEventListener('click', () => void ask(L('abandon_confirm', { name: placeName(v.name), refund: fmt(v.claim.refund), h: 72 })).then((ok) => {
      if (!ok) return;
      this.send({ t: 'estate', action: 'abandon' });
      this.send({ t: 'base', action: 'view' });
    }));
    root.querySelector<HTMLElement>('[data-bcancel]')?.addEventListener('click', () => {
      this.moving = null;
      redraw();
    });
    root.querySelector<HTMLElement>('[data-bmove]')?.addEventListener('click', () => {
      this.moving = this.sel;
      redraw();
    });
    root.querySelector<HTMLElement>('[data-bup]')?.addEventListener('click', () => this.sel !== null && this.send({ t: 'base', action: 'upgrade', plot: this.sel }));
    root.querySelectorAll<HTMLElement>('[data-bbuild]').forEach((el) => (el.onclick = () => this.sel !== null && this.send({ t: 'base', action: 'build', plot: this.sel, what: el.dataset.bbuild! })));
    root.querySelectorAll<HTMLElement>('[data-bspeed]').forEach((el) => (el.onclick = () => this.send({ t: 'base', action: 'speedup', job: Number(el.dataset.job), pay: el.dataset.bspeed as 'silver' })));
  }

  /** Every second: the timers, the bars and the price of finishing; a finished work asks for a fresh view. */
  tick(root: HTMLElement, state: ClientState): void {
    if (!state.base) return;
    const now = this.now(state);
    let due = false;
    root.querySelectorAll<HTMLElement>('.btime[data-end]').forEach((el) => {
      const left = (Number(el.dataset.end) - now) / 1000;
      if (left <= 0) due = true;
      const t = timeText(left);
      if (el.textContent !== t) el.textContent = t;
    });
    root.querySelectorAll<HTMLElement>('[data-stop]').forEach((el) => {
      const a = Number(el.dataset.start), b = Number(el.dataset.stop);
      el.style.width = `${Math.round(Math.max(0, Math.min(1, (now - a) / Math.max(1, b - a))) * 100)}%`;
    });
    root.querySelectorAll<HTMLElement>('[data-price]').forEach((el) => {
      const html = money(speedupSilver((Number(el.dataset.price) - now) / 1000));
      if (el.innerHTML !== html) el.innerHTML = html;
    });
    if (due && Date.now() - this.asked > 2500) {
      this.asked = Date.now();
      this.send({ t: 'base', action: 'view' });
    }
  }
}
