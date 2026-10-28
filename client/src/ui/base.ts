// "My Island" (docs/15 items 1–3): one's own island as a base in the manner of the mobile strategies. A diamond
// grid of plots drawn in CSS, the island's isometric buildings standing on them at their stage (whole, weathered,
// ruined — or scaffolded while the builders are at work); the yard's resources and yields over it; a tap on a plot
// opens a compact sheet: what may be built there and what it costs, the work under way and its speed-ups, the next
// level, a move to another free plot. Phones first (portrait and landscape), then tablets and the desk.
// docs/23 item 72: the window's places are chips in its band; beside the board the island's buildings stand as big
// tiles (a tap is a tap on its plot), and «Собрать всё» takes what the island made in one tap.

import { bindSupply, supplyTab } from './supply.ts'; // docs/18 #32
import { bindScouts, scoutsCard, tickScouts } from './scouts.ts'; // the fog of war's scouts (owner, 2026-10-17)
import { EN as I18_EN, RU as I18_RU } from '../lang/ui/isles18.ts';
import { guildYardCard, wireGuildYard } from './social.ts';
import { BARGE, BARGE_MUL, GRID, PLOT_CELLS, PRODUCERS, isProducer, producerOf, producerRate, speedupSilver } from '../../../shared/src/data/base.ts';
import type { BaseRes, ProducerKind } from '../../../shared/src/data/base.ts';
import { ISLE_LEVELS } from '../../../shared/src/data/estate.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { BUILDINGS } from '../../../shared/src/data/holdings.ts';
import type { BuildingId } from '../../../shared/src/data/holdings.ts';
import type { BaseCellView, BaseView, ClientMsg, OwnShipView } from '../../../shared/src/protocol.ts';
import { OWN_ROLE_DEFS } from '../../../shared/src/data/baseships.ts';
import { WATERS } from '../../../shared/src/data/baseclaim.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { ask, askHtml } from './confirm.ts';
import type { RazeView } from '../../../shared/src/h3proto.ts';
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
import { T29, givesText, needsHtml, pips, treeLabel } from './isletree.ts'; // docs/29
import { BOARD, ISLE_OF_HALL, TOWN_CELLS, TREE_MAX, isTreeBase } from '../../../shared/src/data/isletree.ts';
import { TOWN } from '../../../shared/src/data/town.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import type { TownThingView } from '../../../shared/src/h3proto.ts';
import { maxLevel } from '../../../shared/src/data/base.ts';
import { LAND_RES_DEF } from '../../../shared/src/data/bestiary.ts';
import type { LandRes } from '../../../shared/src/data/bestiary.ts';
import { EN as H_EN, RU as H_RU } from '../lang/ui/h3.ts';
import { EN as WIN_EN, RU as WIN_RU } from '../lang/ui/win.ts';
import { chipRow, quickBar, winHead } from './kit/window.ts';

const L = dict(EN, RU);
const CO = dict(CO_EN, CO_RU);
const H = dict(H_EN, H_RU);
const S18 = dict(I18_EN, I18_RU); // docs/18 #32
const W = dict(WIN_EN, WIN_RU);

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

/** docs/29: a town building's picture at its stage (a frame of beams before it stands, weathered while it is raised). */
export function townArt(id: TownId, level: number, working: boolean): string | null {
  const a = `build_${TOWN[id].art}`;
  const stage = level <= 0 ? 1 : working ? 2 : 0;
  return (stage ? assetUrl(`icon.${a}_${stage}`) : null) ?? assetUrl(`icon.${a}`);
}

/** Why a step may not be taken — unless the list of what it asks says it already (a ✗ there). */
const whyOf = (n: { why: string | null; needs?: { level: number; have: number }[] }): string => (n.why && !(n.needs ?? []).some((x) => x.have < x.level) ? `<p class="muted">${esc(sv(n.why))}</p>` : '');

/** A thing's greatest level on the island (the tree's five; a single-level building's one). */
export const maxOf = (what: string): number => (isTreeBase(what) ? TREE_MAX : maxLevel(what));

export function timeText(secs: number): string {
  const s = Math.max(0, Math.ceil(secs));
  if (s < 60) return L('t_s', { s });
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const m = Math.floor(s / 60);
  return L('t_hm', { h: Math.floor(m / 60), m: String(m % 60).padStart(2, '0') });
}

export function spanText(secs: number): string {
  const m = Math.round(secs / 60);
  if (m < 1) return L('t_s', { s: Math.round(secs) });
  if (m < 60) return L('t_m', { m });
  return L('t_hm', { h: Math.floor(m / 60), m: m % 60 });
}

const sv = (s: string | null) => (s ? serverText(s) : '');

/** The board (docs/29): the island as a mobile city-builder's plot of land — a 6 × 6 diamond, the town on its two back
 *  edges (the hall at the back corner, isletree.ts TOWN_CELLS), the base's plots in the 5 × 5 before them (PLOT_CELLS,
 *  one cell in), the pen and the Grail on two corners of the plots that never open. Every spot shows at once: what is
 *  not yet built stands as a frame of beams, a plot still shut faintly with the town hall that opens it. */
interface Layout { n: number; tw: number; over: number; h: number }
const BOARD_LAYOUT: Layout = (() => {
  const tw = 1 / BOARD; // a tile's width against the board's
  const over = 0.55 * tw; // room over the back row for the tallest pictures
  return { n: BOARD, tw, over, h: over + 0.5 };
})();
function layout(_v: BaseView): Layout {
  return BOARD_LAYOUT;
}

/** A plot's cell on the board (one cell in from the town's edges). */
export const plotCell = (plot: number): [number, number] => [PLOT_CELLS[plot][0] + 1, PLOT_CELLS[plot][1] + 1];
/** The pen and the Grail: two corners of the plots that never open (plotsOf stops at 18 of the 25). */
export const EXTRA_PLOTS: Record<'pen' | 'grail', number> = { pen: 23, grail: 24 };

/** Where a cell's diamond stands on the board, in per cent of the board's width and height. */
function tilePos(cell: [number, number], g: Layout): { left: number; top: number; w: number; hh: number; z: number } {
  const [i, j] = cell;
  const left = 50 + (i - j) * (g.tw * 50) - g.tw * 50;
  const top = ((g.over + (i + j) * (g.tw / 4)) / g.h) * 100; // a row down is half a tile's height
  return { left, top, w: g.tw * 100, hh: ((g.tw / 2) / g.h) * 100, z: (i + j) * 10 + i + 1 };
}

/** The hall a plot opens with (from the island level that opens it). */
export const hallFor = (isle: number): number => (isle <= 0 ? 0 : ISLE_OF_HALL.findIndex((l) => l >= isle));

/** A ship's top-down picture laid on its side, bow to the right (the world's own sprites, docs/15 item 4). */
function shipPic(classId: ShipClassId, cls = 'sy-pic'): string {
  const url = assetUrl(SHIP_CLASSES[classId]?.sprite ?? '');
  return `<span class="${cls}">${url ? `<img src="${url}" alt="" draggable="false">` : ''}</span>`;
}

/** A phone lying on its side: the landscape layout of the window (the same query as its styles). */
// (none outside a browser: the tests import the window's builders in node)
const LANDSCAPE = typeof matchMedia === 'function' ? matchMedia('(max-height: 520px) and (min-aspect-ratio: 1/1)') : ({ matches: false } as MediaQueryList);

/** A phone's island: the board is its picture, the tiles its controls (the board's diamonds take no finger there). */
const touchBoard = (): boolean => !!globalThis.document?.body?.classList.contains('touch');

export class BaseWindow {
  sel: number | null = null;
  /** docs/29: the town building whose card is open (the board's town spots), apart from the plots. */
  selTown: TownId | null = null;
  /** The island's plots, or its shipyard (docs/15 item 4). */
  tab: 'plots' | 'yard' | 'town' | 'supply' = 'plots';
  moving: number | null = null;
  private send: (m: ClientMsg) => void;
  private asked = 0;
  /** "Sail to defend": the window closes and the HUD's «Now:» points to the raiders (docs/15 item 7). */
  onSail: () => void = () => {};
  /** The town's recruit window (docs/17 H3). */
  onRecruit: () => void = () => {};
  /** The fog of war's «Выбрать на карте»: the world map takes a tap on the fog for this scout (owner, 2026-10-17). */
  onScoutPick: (id: string) => void = () => {};
  private scAsked = 0;
  /** The market's order being drawn up (docs/17 H3). */
  mk: { give: string; get: string; n: number } = { give: 'silver', get: 'timber', n: 100 };

  /** The layout changed (a phone turned): the window is drawn afresh. */
  onLayout: () => void = () => {};

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    LANDSCAPE.addEventListener('change', () => this.onLayout());
  }

  open(): void {
    this.sel = null;
    this.selTown = null;
    this.moving = null;
    this.send({ t: 'base', action: 'view' });
    this.send({ t: 'isle18', action: 'supply' }); // docs/18 #32
    this.send({ t: 'scout', action: 'view' }); // the shipyard's scouts (owner, 2026-10-17)
  }

  /** The server's wall clock now, by the view's clock and the time since it came. */
  private now(state: ClientState): number {
    return (state.base?.now ?? Date.now()) + (Date.now() - state.baseAt) * state.timeScale; // (an admin /speed: the server's wall clock runs as fast)
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
      <div class="base-meta"><span class="bmeta" title="${esc(`${L('crews')}${v.crews.next ? ` · ${L('crew_next', { n: v.crews.next })}` : ''}`)}">${icon('ui_brigade', '', 'ico-sm')}<span class="bm-w">${esc(L('crews'))}</span> ${v.crews.busy}/${v.crews.n}</span>
      <span class="bmeta" title="${esc(`${L('tokens')} · ${L('tokens_tip', { m: v.tokenSecs / 60 })}`)}">${icon('ui_hourglass', '⌛', 'ico-sm')}<span class="bm-w">${esc(L('tokens'))}:</span> ${v.speedups}</span>
      <span class="bmeta bpower" title="${esc(L('power_tip', { now: v.power.now, need: v.power.need ?? '—', crew: v.power.crew }))}">${icon('tab_isles', '', 'ico-sm')}<span class="bm-w">${esc(L('power'))}</span> ${v.power.now}${v.power.need ? `/${v.power.need}` : ''}</span>
      <span class="bmeta">${money(state.self?.gold ?? 0)}</span></div></div>`;
    const sy = v.shipyard;
    // The island's places as chips of the band (docs/23 item 72).
    const tabs = chipRow([
      { id: 'plots', icon: 'tab_isles', label: L('tab_plots') },
      { id: 'yard', icon: 'build_shipyard', label: `${L('tab_yard')} ${sy.ships.length}/${sy.max}` },
      ...(v.town ? [{ id: 'town', icon: 'build_fort', label: H('tab') }] : []),
      { id: 'supply', icon: 'build_caravan_office', label: S18('sup.tab'), badge: state.supply?.isles.filter((x) => x.linked).length ?? 0 },
    ], this.tab, 'btab');
    // «Собрать всё» (docs/23 item 72): what every producer holds, in one tap; it heads the island's column.
    // docs/30: a barge of building stuff for silver (a small island with no wood or coal of its own wanted ~20 sloop runs)
    const barge = bargeCostOf(v.store, Math.max(1, v.hall ?? 1));
    const collect = quickBar([
      { label: W('isle.collect'), sub: fresh ? `+${fmt(fresh)}` : esc(W('isle.collectNone')), icon: 'ui_chest', hint: W('isle.collectHint'), primary: fresh > 0, disabled: !fresh, data: { bcollect: 1 } },
      { label: W('isle.barge'), sub: money(barge), icon: 'good_timber', hint: W('isle.bargeHint').replace('{n}', String(Math.max(1, v.hall ?? 1))), disabled: !barge || (state.self?.gold ?? 0) < barge, data: { bbarge: 1 } },
    ], 'b-quick');
    // A phone on its side (docs/15 item 8): the board fills the left, and the resources, the waters and the sheet
    // scroll together on the right, so the board is not squeezed under three header rows.
    const land = LANDSCAPE.matches;
    const top = `${collect}${bar}${this.defence(v)}`;
    if (this.tab === 'town' && !v.town) this.tab = 'plots';
    const body = this.tab === 'supply'
      ? `<div class="modal-body base-body yard-body sup-body">${land ? top : ''}${supplyTab(state)}</div>`
      : this.tab === 'town'
      ? `<div class="modal-body base-body yard-body town-body">${land ? top : ''}${townTab(v, state, this.mk)}</div>`
      : this.tab === 'yard'
      ? `<div class="modal-body base-body yard-body">${land ? top : ''}${this.yard(v, state)}</div>`
      : `<div class="modal-body base-body${land ? ' base-land' : ''}"><div class="base-stage"><div class="base-board${this.moving !== null ? ' moving' : ''}" style="--ar:${(1 / layout(v).h).toFixed(4)}"${touchBoard() ? ' aria-hidden="true"' : ''}>${this.board(v)}</div></div><div class="base-sheet">${land && this.sel === null && !this.selTown ? top : ''}${this.sheet(v, state)}</div></div>`; // (docs/29: a building's card first on a phone on its side — its costs mark what the yard lacks)
    root.innerHTML = `${winHead(L('title'), { crest: 'tab_isles', chips: tabs, sub: `${L('sub', { name: placeName(v.name), level: v.level, title })} · ${L('land', { biome: CO(`biome_${v.biome}` as 'biome_temperate') })}` }).replace('class="modal-head w-head', 'class="modal-head base-head w-head')}
      ${land ? '' : top}${body}`;
    this.bind(root, state);
    wireGuildYard(root, this.send); // docs/16 #34
    this.tick(root, state);
  }

  /** The island's buildings as big tiles (docs/23 item 72): its picture, its name, its level — or the work's clock,
   *  or what it has made — and a free plot's «+»; a tap is the same as a tap on its spot on the board. docs/29: the
   *  town's buildings first (the hall, the keep, the market, the guild, the dwellings), then the base's plots. */
  private tiles(v: BaseView): string {
    const now = v.now;
    const tile = (c: BaseCellView) => {
      if (!c.what) return `<button type="button" class="w-tile b-tile empty" data-plot="${c.plot}" aria-label="${esc(`${L('plot', { n: c.plot + 1 })}: ${L('empty')}`)}"><span class="w-tile-ico glyph b-plus" aria-hidden="true">+</span><span class="w-tile-l">${esc(L('build'))}</span></button>`;
      const raising = !!c.job && c.job.level <= 1;
      const art = baseArt(c.what, Math.max(1, c.level), c.condition, c.unpaid, raising);
      const kind = producerOf(c.what);
      const s = c.job ? `<span class="btime" data-end="${c.job.end}">${esc(timeText((c.job.end - now) / 1000))}</span>`
        : c.fresh > 0 && kind ? `${icon(`good_${PRODUCERS[kind].good}`, '', 'ico-sm')}+${fmt(c.fresh)}`
        : c.level ? esc(T29('lvOf', { n: c.level, max: maxOf(c.what) })) : '';
      return `<button type="button" class="w-tile b-tile${c.fresh > 0 && !c.job ? ' ready' : ''}${c.job ? ' working' : ''}" data-plot="${c.plot}" data-hint="${esc(`${baseName(c.what)}: ${baseText(c.what)}`)}">${art ? `<img class="w-tile-ico" src="${art}" alt="" draggable="false">` : ''}<span class="w-tile-l">${esc(baseName(c.what))}</span><span class="w-tile-s">${s}</span></button>`;
    };
    const town = (t: TownThingView) => {
      const art = townArt(t.id, t.level, !!t.job);
      const s = t.job ? `<span class="btime" data-end="${t.job.end}">${esc(timeText((t.job.end - now) / 1000))}</span>` : t.level ? esc(T29('lvOf', { n: t.level, max: t.max })) : esc(T29('notBuilt'));
      return `<button type="button" class="w-tile b-tile tr-tile${t.level ? '' : ' unbuilt'}${t.job ? ' working' : ''}${this.selTown === t.id ? ' on' : ''}" data-town="${t.id}" data-hint="${esc(`${treeLabel(t.id, Math.max(1, t.level))}: ${TOWN[t.id].text[lang() === 'ru' ? 1 : 0]}`)}">${art ? `<img class="w-tile-ico" src="${art}" alt="" draggable="false">` : ''}<span class="w-tile-l">${esc(treeLabel(t.id, Math.max(1, t.level)))}</span><span class="w-tile-s">${s}</span></button>`;
    };
    return `<div class="w-tiles b-tiles">${this.townThings(v).map(town).join('')}${v.cells.slice(0, v.plots).map(tile).join('')}</div>`;
  }

  /** The town's buildings the board and the tiles show: the tree's eleven, the pen, and the Grail once it is had. */
  townThings(v: BaseView): TownThingView[] {
    const t = v.town;
    if (!t) return [];
    return t.things.filter((x) => (x.id in TOWN_CELLS) || x.id === 'pen' || (x.id === 'grail' && (x.level > 0 || !!x.job || !x.next?.why)));
  }

  private board(v: BaseView): string {
    const now = v.now;
    const g = layout(v);
    const out: string[] = [];
    const over: string[] = [];
    const lockHalls = v.locked.map((l) => hallFor(l.level)).filter((n) => n > 0);
    const nextHall = lockHalls.length ? Math.min(...lockHalls) : 0;
    const cellBox = (cell: [number, number]) => {
      const pos = tilePos(cell, g);
      const box = `left:${pos.left.toFixed(2)}%;top:${pos.top.toFixed(2)}%;width:${pos.w.toFixed(2)}%;height:${pos.hh.toFixed(2)}%`;
      return { box, style: `${box};z-index:${pos.z}`, z: pos.z };
    };
    const timer = (j: { start: number; end: number }) => {
      const prog = Math.max(0, Math.min(1, (now - j.start) / Math.max(1, j.end - j.start)));
      return `<span class="btimer"><span class="btime" data-end="${j.end}">${esc(timeText((j.end - now) / 1000))}</span><span class="bprog"><i data-start="${j.start}" data-stop="${j.end}" style="width:${Math.round(prog * 100)}%"></i></span></span>`;
    };
    // The town on its edges (and the pen and the Grail on their corners).
    for (const t of this.townThings(v)) {
      const cell = TOWN_CELLS[t.id] ?? plotCell(EXTRA_PLOTS[t.id as 'pen' | 'grail']);
      const { box, style, z } = cellBox(cell);
      const art = townArt(t.id, t.level, !!t.job);
      const cls = ['bplot', 'town', t.level > 0 ? 'built' : 'unbuilt', t.id === 'hall' ? 'hall' : '', this.selTown === t.id ? 'sel' : '', t.job ? 'working' : ''].filter(Boolean).join(' ');
      const label = `${treeLabel(t.id, Math.max(1, t.level))} · ${t.level ? T29('lvOf', { n: t.level, max: t.max }) : T29('notBuilt')}`;
      out.push(`<div class="${cls}" style="${style}" data-town="${t.id}"${touchBoard() ? '' : ' role="button" tabindex="0"'} aria-label="${esc(label)}"><i class="bground"></i>${art ? `<img class="bart" src="${art}" alt="" draggable="false"><i class="bhit"></i>` : ''}</div>`);
      const marks = `${t.level && !(t.job && t.level === 0) ? `<span class="blvl">${t.level}</span>` : ''}${t.job ? timer(t.job) : ''}`;
      if (marks) over.push(`<div class="bover" style="${box};z-index:${500 + z}">${marks}</div>`);
    }
    // The base's plots.
    for (let k = 0; k < PLOT_CELLS.length; k++) {
      if (k === EXTRA_PLOTS.pen || k === EXTRA_PLOTS.grail) continue;
      const { box, style, z } = cellBox(plotCell(k));
      if (k >= v.plots) {
        const lock = v.locked.find((l) => l.plot === k);
        const hall = lock ? hallFor(lock.level) : 0;
        const soon = hall > 0 && hall === nextHall;
        out.push(`<div class="bplot locked${soon ? ' soon' : ''}${hall ? '' : ' rock'}" style="${style}"${hall ? ` title="${esc(T29('lockedPlot', { n: hall }))}"` : ''}><i class="bground"></i></div>`);
        continue;
      }
      const c = v.cells[k];
      const raising = !!c.job && c.job.level <= 1;
      const art = c.what ? baseArt(c.what, Math.max(1, c.level), c.condition, c.unpaid, raising) : null;
      const cls = ['bplot', c.what ? 'built' : 'empty', this.sel === k ? 'sel' : '', raising ? 'raising' : '', c.job ? 'working' : '', this.moving !== null && !c.what ? 'target' : '', c.idle ? 'idle' : ''].filter(Boolean).join(' ');
      const label = c.what ? `${baseName(c.what)}${c.level ? ` · ${L('lvl', { n: c.level })}` : ''}` : L('empty');
      // A diamond, not a box: the plot answers on its diamond and its building's body (the square boxes of the grid
      // lie over each other), so it is a role, not a <button>.
      out.push(`<div class="${cls}" style="${style}" data-plot="${k}"${touchBoard() ? '' : ' role="button" tabindex="0"'} aria-label="${esc(`${L('plot', { n: k + 1 })}: ${label}`)}"><i class="bground"></i>
        ${art ? `<img class="bart" src="${art}" alt="" draggable="false"><i class="bhit"></i>` : c.what ? '' : '<span class="bplus">+</span>'}</div>`);
      // Timers, levels and yields ride over every picture, so a building in front never hides them.
      const marks = `${c.what && c.level && !raising ? `<span class="blvl">${c.level}</span>` : ''}${c.job ? timer(c.job) : ''}${c.fresh > 0 && !c.job ? `<span class="bfresh">${icon(`good_${PRODUCERS[producerOf(c.what!)!].good}`, '', 'ico-sm')}+${fmt(c.fresh)}</span>` : ''}`;
      if (marks) over.push(`<div class="bover" style="${box};z-index:${500 + z}">${marks}</div>`);
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

  /** The card of what is picked; `bare` (the island screen, islescene.ts): the card alone, without the way back, the
   *  tiles and the foot. */
  sheet(v: BaseView, state: ClientState, bare = false): string {
    // (owner, 2026-10-28: the island's works are paid from its treasury first, then from the purse — from anywhere)
    const gold = (state.self?.gold ?? 0) + Math.max(0, v.claim?.treasury ?? 0);
    const nextPlot = v.locked.find((l) => l.level > 0);
    const foot = bare ? '' : `<p class="muted bfoot">${esc(L('plots', { used: v.cells.filter((c) => c.what).length, total: v.plots }))}${nextPlot ? ` · ${esc(T29('opensAt', { n: hallFor(nextPlot.level) }))}` : ''} · ${esc(L('slots', { used: v.slots.used, total: v.slots.total }))}<br>${esc(v.near ? L('hold_pays') : L('store_pays'))}</p>`;
    if (this.moving !== null) {
      const c = v.cells[this.moving];
      return `<div class="bsheet-h">${c?.what ? this.thumb(c) : ''}<div><b>${esc(c?.what ? baseName(c.what) : '')}</b><p class="muted">${esc(L('moving'))}</p></div></div><button class="btn" data-bcancel>${esc(L('cancel'))}</button>`;
    }
    const town = this.selTown ? v.town?.things.find((x) => x.id === this.selTown) : undefined;
    // (on a phone the tiles are the controls: the island's buildings under the card, and the way back over it)
    const back = bare ? '' : `<button type="button" class="btn btn-small tr-back" data-bback>${esc(T29('back'))}</button>`;
    const tiles = bare ? '' : this.tiles(v);
    if (town) return `${back}${this.townSheet(v, town, gold)}${tiles}`;
    if (this.sel === null) return `${this.queueCard(v)}${this.hallCard(v, gold)}${this.tiles(v)}${this.watersCard(v)}${foot}`;
    const c = v.cells[this.sel];
    if (!c.what) {
      const busy = v.crews.busy >= v.crews.n;
      const row = (x: BaseView['catalog'][number]) => {
        const art = baseArt(x.what, 1);
        return `<div class="bopt${x.why ? ' off' : ''}" data-what="${esc(x.what)}">${art ? `<img class="bopt-art" src="${art}" alt="">` : ''}<div class="bopt-main"><b>${esc(baseName(x.what))}</b><span class="muted bopt-text">${esc(x.why ? sv(x.why) : baseText(x.what))}</span>${this.costHtml(v, x, gold)}</div>${x.why ? '' : `<button class="btn btn-small btn-primary" data-bbuild="${esc(x.what)}"${busy ? ' disabled' : ''}>${esc(L('build'))}</button>`}</div>`;
      };
      const ok = v.catalog.filter((x) => !x.why), no = v.catalog.filter((x) => x.why);
      const group = (list: BaseView['catalog']) => {
        const prod = list.filter((x) => isProducer(x.what)), bld = list.filter((x) => !isProducer(x.what));
        return `${prod.length ? `<div class="bsec">${esc(L('producers'))}</div>${prod.map(row).join('')}` : ''}${bld.length ? `<div class="bsec">${esc(L('buildings'))}</div>${bld.map(row).join('')}` : ''}`;
      };
      return `${back}<div class="bsheet-h"><span class="bthumb bthumb-empty">+</span><div><b>${esc(L('plot', { n: this.sel + 1 }))}</b> <span class="muted">${esc(L('empty'))}</span><p class="${busy ? 'bad' : 'muted'}">${esc(busy ? serverText('All your builders are at work.') : L('can_build'))}</p></div></div>
        ${group(ok)}${no.length ? `<details class="bno"><summary>${esc(L('cannot', { n: no.length }))}</summary>${group(no)}</details>` : ''}${foot}`;
    }
    const kind = producerOf(c.what);
    const raising = !!c.job && c.job.level <= 1;
    const isl = state.base!;
    const max = maxOf(c.what);
    const ctx = { size: v.size, biome: v.biome, isle: v.level };
    const state1 = kind
      ? `<p>${esc(L('yields', { rate: dec1(producerRate(kind as ProducerKind, Math.max(1, c.level), isl.biome)), good: GOODS[PRODUCERS[kind].good].name.toLowerCase() }))}${c.idle ? ` <span class="bad">${esc(L('idle'))}</span>` : ''}</p>`
      : raising ? '' : `<p class="${c.unpaid || c.condition < 0.7 ? 'bad' : 'muted'}">${esc(L('condition', { n: Math.round(c.condition * 100) }))}${c.unpaid ? ` · ${esc(L('unpaid'))}` : ''}</p>`;
    const job = c.job ? this.jobCard(v, c.job, raising ? L('raising') : L('upgrading', { n: c.job.level }), true) : '';
    const gives = (lv: number) => givesText(c.what!, lv, ctx);
    const up = raising ? '' : c.up ? `<div class="bupcard tr-card"><div class="row"><b>${esc(T29('gives'))} ${esc(T29('lvOf', { n: c.up.level, max }))}</b></div>${gives(c.up.level) ? `<p class="tr-gives">${esc(gives(c.up.level))}</p>` : ''}${this.costHtml(v, c.up, gold)}${c.up.needs ? needsHtml(c.up.needs) : ''}${whyOf(c.up)}<button class="btn btn-small btn-primary" data-bup${c.up.why ? ' disabled' : ''}>${esc(T29('upgrade'))}</button></div>`
      : `<p class="muted">${esc(kind || c.level > 1 ? T29('max') : L('one_level'))}</p>`;
    const now = c.level && !raising && gives(c.level) ? `<p class="tr-now"><span class="muted">${esc(T29('givesNow'))}</span> ${esc(gives(c.level))}</p>` : '';
    return `${back}<div class="bsheet-h">${this.thumb(c)}<div><b>${esc(baseName(c.what))}</b> <span class="muted">${esc(L('plot', { n: c.plot + 1 }))}${c.level && !raising ? ` · ${esc(T29('lvOf', { n: c.level, max }))}` : ''}</span>${c.level && !raising && max > 1 ? pips(c.level, max) : ''}<p class="muted bdesc">${esc(baseText(c.what))}</p></div></div>
      ${now}${state1}${job}${up}<div class="row bactions"><button class="btn btn-small" data-bmove>${esc(L('move'))}</button>${this.razeBtn(c.raze, `plot:${c.plot}`)}</div>${this.razeWhy(c.raze)}${tiles}${foot}`;
  }

  /** The work under way on a building: its clock, its bar, and finishing it now (silver, provisions, a token). */
  private jobCard(v: BaseView, j: { id: number; start: number; end: number; silver: number; goods: Partial<Record<GoodId, number>> }, title: string, res: boolean): string {
    return `<div class="bjobcard"><div class="row"><b>${esc(title)}</b><span>${esc(L('left', { t: '\u0000' })).replace('\u0000', `<span class="btime" data-end="${j.end}">${esc(timeText((j.end - v.now) / 1000))}</span>`)}</span></div>
      <span class="bprog big"><i data-start="${j.start}" data-stop="${j.end}"></i></span>
      <div class="bspeed"><button class="btn btn-small btn-primary" data-bspeed="silver" data-job="${j.id}">${esc(L('finish'))} <span data-price="${j.end}">${money(j.silver)}</span></button>
      ${res ? `<button class="btn btn-small" data-bspeed="res" data-job="${j.id}">${esc(L('finish'))} ${(Object.entries(j.goods) as [GoodId, number][]).map(([g, n]) => `${icon(`good_${g}`, '', 'ico-sm')}${fmt(n)}`).join(' ')}</button>` : ''}
      <button class="btn btn-small" data-bspeed="token" data-job="${j.id}"${v.speedups ? '' : ' disabled'}>${icon('ui_hourglass', '⌛', 'ico-xs')} ${esc(L('token', { m: v.tokenSecs / 60 }))} (${v.speedups})</button></div></div>`;
  }

  /** docs/29: a town building's card — its level i/5, what it gives, what the next level gives, its cost and time,
   *  what it asks (✓ / ✗), «Улучшить»; a dwelling's men and the recruiting, the market's and the guild's way to the
   *  town's own tab. */
  /** Owner, 2026-10-28: what the yard lacks for a building, far from the island — the hold pays only lying off it,
   *  so the one journey that is truly needed says so, with «Плыть к острову» (islescene.ts: the route `own`). */
  private farLack(v: BaseView, goods: Partial<Record<GoodId, number>>): string {
    if (v.near || !v.town) return '';
    const have = Object.fromEntries(v.town.res.map((r) => [r.good, r.n])) as Partial<Record<GoodId, number>>;
    const lack = (Object.entries(goods) as [GoodId, number][]).filter(([g, n]) => (have[g] ?? 0) < n);
    if (!lack.length) return '';
    const what = lack.map(([g, n]) => `${GOODS[g].name.toLowerCase()} ${fmt(n - (have[g] ?? 0))}`).join(', ');
    return `<p class="muted tw-why">${esc(L('lack_far', { what }))}</p><button type="button" class="btn btn-small" data-bsailisle>${icon('menu_ship', '', 'ico-sm')}${esc(L('sail_isle'))}</button>`;
  }

  townSheet(v: BaseView, t: TownThingView, gold: number): string {
    const d = TOWN[t.id];
    const ru = lang() === 'ru' ? 1 : 0;
    const ctx = { size: v.size, biome: v.biome, isle: v.level };
    const name = treeLabel(t.id, Math.max(1, t.level));
    const art = townArt(t.id, t.level, !!t.job);
    const head = `<div class="bsheet-h">${art ? `<img class="bthumb" src="${art}" alt="">` : '<span class="bthumb bthumb-empty">+</span>'}<div><b>${esc(name)}</b> <span class="muted">${esc(t.level ? T29('lvOf', { n: t.level, max: t.max }) : T29('notBuilt'))}</span>${t.max > 1 ? pips(t.level, t.max) : ''}<p class="muted bdesc">${esc(d.text[ru])}</p></div></div>`;
    const now = t.level > 0 && givesText(t.id, t.level, ctx) ? `<p class="tr-now"><span class="muted">${esc(T29('givesNow'))}</span> ${esc(givesText(t.id, t.level, ctx))}</p>` : '';
    const pool = d.tier && t.level > 0 ? `<p class="tr-now">${esc(H('town.pool', { n: t.pool ?? 0, g: dec1(t.growth ?? 0).replace(/[.,]0$/, '') }))} <button class="btn btn-small" data-trecruit>${esc(H('town.recruit'))}</button></p>` : '';
    const job = t.job ? this.jobCard(v, t.job, t.level ? T29('raising', { n: t.job.level }) : T29('founding'), false) : '';
    const n = t.next;
    const land = n?.land ? (Object.entries(n.land) as [LandRes, number][]).filter(([, k]) => (k ?? 0) > 0).map(([r, k]) => `<span class="bcost" title="${esc(LAND_RES_DEF[r].name[ru])}">${icon(LAND_RES_DEF[r].icon, '', 'ico-sm')}${fmt(k)}</span>`).join('') : '';
    const next = !t.job && n ? `<div class="bupcard tr-card"><div class="row"><b>${esc(T29('gives'))} ${esc(treeLabel(t.id, n.level))}${t.max > 1 ? ` · ${esc(T29('lvOf', { n: n.level, max: t.max }))}` : ''}</b></div>${givesText(t.id, n.level, ctx) ? `<p class="tr-gives">${esc(givesText(t.id, n.level, ctx))}</p>` : ''}
      ${this.costHtml(v, n, gold)}${land ? `<span class="bcosts">${land}</span>` : ''}${n.needs ? needsHtml(n.needs) : ''}${whyOf(n)}${this.farLack(v, n.goods)}
      <button class="btn btn-small btn-primary" data-tbuild="${t.id}"${n.why ? ' disabled' : ''}>${esc(t.level ? T29('upgrade') : T29('build'))}</button></div>`
      : !t.job ? `<p class="muted">${esc(T29('max'))}</p>` : '';
    const more = t.id === 'market' || t.id === 'guild' || t.id === 'pen' ? `<div class="row bactions"><button class="btn btn-small" data-btab="town">${esc(H('tab'))}</button></div>` : '';
    const raze = t.raze && t.id !== 'hall' && t.id !== 'grail' ? `<div class="row bactions">${this.razeBtn(t.raze, `town:${t.id}`)}</div>${this.razeWhy(t.raze)}` : '';
    return `${head}${now}${pool}${job}${next}${more}${raze}`;
  }

  /** «Снести» (owner, 2026-10-28): shut while something stands on it (the line under it names them). */
  private razeBtn(r: RazeView | null | undefined, key: string): string {
    if (!r) return '';
    return `<button type="button" class="btn btn-small btn-danger" data-braze="${esc(key)}"${r.why ? ' disabled' : ''}>${esc(L('raze'))}</button>`;
  }

  private razeWhy(r: RazeView | null | undefined): string {
    if (!r?.why) return '';
    const list = r.need.map((n) => `${n.id === 'hall' ? TOWN.hall.names[0][lang() === 'ru' ? 1 : 0] : treeLabel(n.id, n.level)} ${n.level}`).join(', ');
    return `<p class="muted tw-why braze-why">${esc(list ? L('raze_block', { list }) : sv(r.why))}</p>`;
  }

  /** The question before pulling it down: what is lost, what comes back. */
  private razeAsk(v: BaseView, key: string): void {
    const [kind, id] = key.split(':');
    const town = kind === 'town' ? v.town?.things.find((x) => x.id === id) : undefined;
    const cell = kind === 'plot' ? v.cells[Number(id)] : undefined;
    const r = town?.raze ?? cell?.raze;
    if (!r || r.why) return;
    const name = town ? treeLabel(town.id, Math.max(1, town.level)) : baseName(cell!.what!);
    const goods = (Object.entries(r.goods) as [GoodId, number][]).map(([g, n]) => `<span class="bcost">${icon(`good_${g}`, '', 'ico-sm')}${fmt(n)}</span>`).join('');
    const what = r.silver || goods ? `<span class="bcosts">${r.silver ? `<span class="bcost">${money(r.silver)}</span>` : ''}${goods}</span>` : esc(L('raze_none'));
    const lines = [
      `<p id="confirm-text"><b>${esc(L('raze_q', { name }))}</b></p>`,
      `<p>${esc(town ? L('raze_gone_town') : L('raze_gone'))}</p>`,
      r.tier ? `<p class="braze-lost">${esc(L('raze_dw', { t: r.tier, n: town?.pool ?? 0 }))}</p>` : '',
      cell?.what && producerOf(cell.what) ? `<p>${esc(L('raze_prod'))}</p>` : '',
      r.cancel ? `<p>${esc(L('raze_job'))}</p>` : '',
      `<p class="braze-back">${esc(L('raze_back', { what: '\u0000', job: r.cancel ? L('raze_back_job') : '' })).replace('\u0000', what)}</p>`,
    ];
    void askHtml(lines.join(''), L('raze_yes'), undefined, 'braze-ask').then((ok) => {
      if (!ok) return;
      this.send(town ? { t: 'base', action: 'raze', town: town.id } : { t: 'base', action: 'raze', plot: Number(id) });
      if (kind === 'plot') this.sel = null;
      else this.selTown = null;
    });
  }

  /** docs/29: the build queue — every work under way with its clock, the builders' crews. */
  queueCard(v: BaseView): string {
    const rows = [
      ...this.townThings(v).filter((t) => t.job).map((t) => ({ attr: `data-town="${t.id}"`, art: townArt(t.id, t.level, true), name: treeLabel(t.id, t.job!.level), lv: t.job!.level, first: t.level === 0, job: t.job! })),
      ...v.cells.filter((c) => c.job && c.what).map((c) => ({ attr: `data-plot="${c.plot}"`, art: baseArt(c.what!, Math.max(1, c.level), c.condition, c.unpaid, c.job!.level <= 1), name: baseName(c.what!), lv: c.job!.level, first: c.job!.level <= 1, job: c.job! })),
    ].sort((a, b) => a.job.end - b.job.end);
    const next = v.crews.next ? ` · ${T29('queueNext', { n: hallFor(v.crews.next) })}` : '';
    const list = rows.map((r) => `<button type="button" class="bjob tr-q" ${r.attr}>${r.art ? `<img class="bthumb" src="${r.art}" alt="">` : ''}<span class="tr-qm"><b>${esc(r.name)}</b> <span class="muted">${esc(r.first ? T29('founding') : T29('raising', { n: r.lv }))}</span><span class="bprog"><i data-start="${r.job.start}" data-stop="${r.job.end}"></i></span></span><span class="btime" data-end="${r.job.end}">${esc(timeText((r.job.end - v.now) / 1000))}</span></button>`).join('');
    return `<div class="bupcard tr-queue"><div class="row"><b>${esc(T29('queue'))}</b><span class="muted">${esc(T29('queueN', { busy: v.crews.busy, n: v.crews.n }))}${esc(next)}</span></div>${list || `<p class="muted">${esc(T29('queueNone'))}</p>`}</div>`;
  }

  /** docs/29: the town hall's card — the tree's root: the island's level by it, and what its next level asks. */
  private hallCard(v: BaseView, gold: number): string {
    const t = v.town?.things.find((x) => x.id === 'hall');
    if (!t) return '';
    const hall = Math.max(1, t.level);
    const n = t.next;
    const body = t.job ? this.jobCard(v, t.job, T29('raising', { n: t.job.level }), false)
      : n ? `<p class="tr-hn"><b>${esc(T29('gives'))} ${esc(treeLabel('hall', n.level))}</b></p><p class="tr-gives">${esc(givesText('hall', n.level, { size: v.size, biome: v.biome, isle: v.level }))}</p>${needsHtml(n.needs)}${this.costHtml(v, n, gold)}${whyOf(n)}<button class="btn btn-small btn-primary" data-tbuild="hall"${n.why ? ' disabled' : ''}>${esc(T29('upgrade'))}</button>`
      : `<p class="muted">${esc(T29('hallMax'))}</p>`;
    return `<div class="bupcard blevel tr-hall"><div class="row"><b>${esc(T29('hall', { n: hall, isle: v.level }))}</b>${pips(hall)}</div><p class="muted">${esc(T29('hallText'))}</p>${body}</div>`;
  }

  /** The island's waters, tax and defence under the resources, and a raid under way over everything (docs/15 items 6–7). */
  defence(v: BaseView): string {
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
  watersCard(v: BaseView): string {
    const c = v.claim;
    const ru = lang() === 'ru' ? 1 : 0;
    const calm = c.strength > 0 && c.calmUntil > v.now && !c.raid ? `<p class="muted">${esc(L('def_calm', { t: spanText((c.calmUntil - v.now) / 1000) }))}</p>` : '';
    const lines = c.strength > 0
      ? `<p class="${c.worth >= c.fat ? 'bad' : 'muted'}">${esc(L('def_worth', { w: fmt(c.worth), f: fmt(c.fat) }))}</p>${calm}${c.lost > 0 ? `<p class="muted">${esc(L('def_lost', { n: Math.round(c.lost * 100), cap: Math.round(c.lossCap * 100) }))}</p>` : ''}<p class="muted">${esc(L('def_help'))}</p>`
      : `<p class="muted">${esc(L('def_safe'))}</p>`;
    // docs/29: other captains' own bases on this island (each her own: nothing of theirs is hers or the other way round).
    const others = c.others?.length ? `<p class="muted tr-others">${esc(T29('others', { names: c.others.join(', ') }))}</p>` : '';
    return `<div class="bupcard bwaters"><div class="row"><b>${esc(L('def_card'))}</b><span class="bdef-w w-${c.waters}">${esc(WATERS[c.waters].name[ru])}</span></div>${lines}${others}
      <button class="btn btn-small btn-danger" data-babandon${c.abandonWhy ? ` disabled title="${esc(sv(c.abandonWhy))}"` : ''}>${esc(L('abandon'))}</button>${c.abandonWhy ? `<p class="muted">${esc(sv(c.abandonWhy))}</p>` : ''}</div>`;
  }

  /** The shipyard: her own ships as cards, what the slipway may build, the squadron's berths (docs/15 item 4). */
  yard(v: BaseView, state: ClientState): string {
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
    return `${scoutsCard(state)}${head}${sq}${cards ? `<div class="sy-cards">${cards}</div>` : ''}${offers}${guildYardCard(v.guildYard)}`;
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
      <button class="btn btn-small" data-bspeed="token" data-job="${j.id}"${v.speedups ? '' : ' disabled'}>${icon('ui_hourglass', '⌛', 'ico-xs')} ${esc(L('token', { m: v.tokenSecs / 60 }))} (${v.speedups})</button></div></div>` : '';
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

  /** The window's buttons (the island screen binds its card with its own redraw). */
  bind(root: HTMLElement, state: ClientState, redraw: () => void = () => this.render(root, state)): void {
    const v = state.base!;
    root.querySelectorAll<HTMLElement>('.bplot[data-plot], .bplot[data-town]').forEach((el) => (el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    }));
    root.querySelectorAll<HTMLElement>(touchBoard() ? '[data-plot]:not(.bplot)' : '[data-plot]').forEach((el) => (el.onclick = () => {
      const k = Number(el.dataset.plot);
      if (this.moving !== null) {
        if (!v.cells[k]?.what && k !== this.moving) this.send({ t: 'base', action: 'move', plot: this.moving, to: k });
        this.moving = null;
        this.sel = k;
        return redraw();
      }
      this.selTown = null;
      this.sel = this.sel === k && !el.classList.contains('bjob') ? null : k;
      redraw();
    }));
    // docs/29: a town building's spot (or its tile, or its row in the queue) opens its card.
    root.querySelectorAll<HTMLElement>(touchBoard() ? '[data-town]:not(.bplot)' : '[data-town]').forEach((el) => (el.onclick = () => {
      const id = el.dataset.town as TownId;
      this.sel = null;
      this.moving = null;
      this.selTown = this.selTown === id && !el.classList.contains('bjob') ? null : id;
      redraw();
    }));
    root.querySelectorAll<HTMLElement>('[data-btab]').forEach((el) => (el.onclick = () => {
      this.tab = el.dataset.btab === 'yard' ? 'yard' : el.dataset.btab === 'town' ? 'town' : el.dataset.btab === 'supply' ? 'supply' : 'plots';
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
    bindScouts(root, this.send, (id) => this.onScoutPick(id)); // the shipyard's «Разведка» (owner, 2026-10-17)
    root.querySelector<HTMLElement>('[data-bbarge]')?.addEventListener('click', () => this.send({ t: 'base', action: 'barge' }));
    bindTown(root, this.send, this.mk, () => this.onRecruit(), redraw);
    bindSupply(root, this.send); // docs/18 #32
    root.querySelector<HTMLElement>('[data-bsail]')?.addEventListener('click', () => this.onSail());
    root.querySelector<HTMLElement>('[data-babandon]')?.addEventListener('click', () => void ask(L('abandon_confirm', { name: placeName(v.name), refund: fmt(v.claim.refund), h: 0 })).then((ok) => {
      if (!ok) return;
      this.send({ t: 'estate', action: 'abandon' });
      this.send({ t: 'base', action: 'view' });
    }));
    root.querySelector<HTMLElement>('[data-bback]')?.addEventListener('click', () => {
      this.sel = null;
      this.selTown = null;
      redraw();
    });
    root.querySelector<HTMLElement>('[data-bcancel]')?.addEventListener('click', () => {
      this.moving = null;
      redraw();
    });
    root.querySelector<HTMLElement>('[data-bmove]')?.addEventListener('click', () => {
      this.moving = this.sel;
      redraw();
    });
    root.querySelectorAll<HTMLElement>('[data-braze]').forEach((el) => (el.onclick = () => this.razeAsk(v, el.dataset.braze!)));
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
    if (tickScouts(root, state) && Date.now() - this.scAsked > 2500) {
      this.scAsked = Date.now();
      this.send({ t: 'scout', action: 'view' });
    }
  }
}

/** What a barge of building stuff costs now, by the yard's room (docs/30; server: base.ts orderBarge). */
function bargeCostOf(store: { good: string; n: number; cap: number }[], hall: number): number {
  let cost = 0;
  for (const [g, n0] of Object.entries(BARGE) as [BaseRes, number][]) {
    const n = n0 * hall; // as big as her town hall (server: bargeSize)
    const row = store.find((x) => x.good === g);
    const room = row ? Math.max(0, Math.floor(row.cap - row.n)) : n;
    cost += Math.round(Math.min(n, room) * GOODS[g].basePrice * BARGE_MUL);
  }
  return cost;
}
