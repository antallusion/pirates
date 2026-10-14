// The island screen (owner, 2026-10-15: «хочу чтобы это было как отдельная игра типа. То есть кнопка входа на остров,
// нажимаешь и переходишь в отдельное абсолютно новое окно с постройками»; the art brief
// assets/future/isle_iso/HANDOFF_PROMPT.md). A scene of its own over the whole screen — the sea stops drawing under it
// (main.ts) — with the captain's island in the night sea in isometry: the painted map of its biome, the board of docs/29
// laid on its plateau (shared/src/data/isleiso.ts), every building at its stage and level with its timer, the free plots
// to build on, the plots still shut. A finger drags and pinches the camera, a mouse drags and wheels it; a tap opens a
// building's card on the right (the island window's own cards, client/src/ui/base.ts, docs/29 §3), an empty plot its
// build list. The yard's goods and her silver over the top, «В море» back; the build queue at the bottom; the ships, the
// town's trade, the supply and the defence open the island window's tabs over the scene.
//
// One layer of DOM moved by a transform (the map, the pictures, the plots' diamonds in one SVG, the tags): a drag
// redraws nothing, the pictures are diffed by spot when the view changes.

import { ISO_H, ISO_MAP_OF, ISO_SLOT, ISO_UNIT, ISO_W, isoFoot, isoSheet, isoSpot, isoStage } from '../../../shared/src/data/isleiso.ts';
import type { IsoMap, Pt } from '../../../shared/src/data/isleiso.ts';
import { PLOT_CELLS, PRODUCERS, producerOf } from '../../../shared/src/data/base.ts';
import { TOWN_CELLS } from '../../../shared/src/data/isletree.ts';
import type { TownId } from '../../../shared/src/data/town.ts';
import type { BaseView, ClientMsg } from '../../../shared/src/protocol.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { assetMeta } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/islescene.ts';
import type { ClientState } from '../state.ts';
import { BaseWindow, EXTRA_PLOTS, baseName, hallFor, maxOf, plotCell, timeText, townArt } from './base.ts';
import { esc, fmt, icon, money } from './dom.ts';
import { placeName } from './maps.ts';
import { T29, treeLabel } from './isletree.ts';

const L = dict(EN, RU);

/** A spot of the board as the scene draws it. */
interface Spot {
  key: string;
  /** What a tap opens. */
  plot?: number;
  town?: TownId;
  cell: [number, number];
  /** The picture: a sheet's cell, or an icon standing upright (the pen, the Grail). */
  pic: { id: string; foot: number } | { icon: string } | null;
  cls: string;
  /** The diamond under it: a free plot, a plot shut, a building not yet raised. */
  ground: '' | 'empty' | 'locked' | 'soon' | 'ghost';
  /** Over it: its level, its work's clock, what it made. */
  tag: string;
}

/** The camera: the map's top-left corner on the screen and its scale. */
interface Cam { x: number; y: number; s: number }

export class IsleScene {
  isOpen = false;
  /** What a tap opened: a plot, a town building, the defence's card. */
  private pick: { plot: number } | { town: TownId } | { defence: true } | null = null;
  private root: HTMLElement | null = null;
  private viewEl!: HTMLElement;
  private world!: HTMLElement;
  private mapImg!: HTMLImageElement;
  private svg!: SVGSVGElement;
  private pics!: HTMLElement;
  private tags!: HTMLElement;
  private topEl!: HTMLElement;
  private sideEl!: HTMLElement;
  private queueEl!: HTMLElement;
  private cardEl!: HTMLElement;
  private hintEl!: HTMLElement;
  private map: IsoMap = 'temperate';
  private cam: Cam = { x: 0, y: 0, s: 1 };
  private framed = false;
  private spots: Spot[] = [];
  private picEls = new Map<string, HTMLElement>();
  private sig = '';
  private queued = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: { x: number; y: number; t: number; moved: boolean; cam: Cam; d0: number; mx: number; my: number } | null = null;
  private send: (m: ClientMsg) => void;
  private base: BaseWindow;
  private state: ClientState | null = null;
  /** Back to the sea (main.ts: the sea's loop again, the harbour reopened if she lies in port). */
  onExit: () => void = () => {};
  /** One of the island window's tabs over the scene (main.ts openModal('base')). */
  onTab: (tab: 'yard' | 'town' | 'supply') => void = () => {};
  /** A raid: off to defend it (the scene closes, the HUD points to the raiders). */
  onSail: () => void = () => {};

  constructor(send: (m: ClientMsg) => void, base: BaseWindow) {
    this.send = send;
    this.base = base;
  }

  // ------------------------------------------------------------------------------------------------ in and out

  enter(state: ClientState): void {
    this.state = state;
    if (!this.root) this.build();
    this.isOpen = true;
    this.pick = null;
    this.base.sel = null;
    this.base.selTown = null;
    this.base.moving = null;
    this.framed = false;
    this.sig = '';
    this.root!.classList.remove('hidden');
    document.body.classList.add('isle-on');
    this.base.open(); // the view and the supply from the server
    this.update(state);
  }

  exit(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.pick = null;
    this.base.moving = null;
    this.root?.classList.add('hidden');
    document.body.classList.remove('isle-on');
    this.pointers.clear();
    this.gesture = null;
  }

  // ------------------------------------------------------------------------------------------------ the DOM

  private build(): void {
    const root = document.createElement('div');
    root.id = 'isle';
    root.className = 'hidden';
    root.setAttribute('role', 'application');
    root.innerHTML = `<div class="is-view"><div class="is-world"><img class="is-map" alt="" draggable="false"><svg class="is-ground" viewBox="0 0 ${ISO_W} ${ISO_H}" width="${ISO_W}" height="${ISO_H}" aria-hidden="true"></svg><div class="is-pics"></div><div class="is-tags"></div></div></div>
      <header class="is-top"></header><nav class="is-side"></nav><div class="is-queue" role="list"></div><p class="is-hint" role="status"></p>
      <aside class="is-card hidden" aria-live="polite"></aside>`;
    document.body.append(root);
    this.root = root;
    this.viewEl = root.querySelector('.is-view')!;
    this.world = root.querySelector('.is-world')!;
    this.mapImg = root.querySelector('.is-map')!;
    this.svg = root.querySelector('.is-ground')!;
    this.pics = root.querySelector('.is-pics')!;
    this.tags = root.querySelector('.is-tags')!;
    this.topEl = root.querySelector('.is-top')!;
    this.sideEl = root.querySelector('.is-side')!;
    this.queueEl = root.querySelector('.is-queue')!;
    this.cardEl = root.querySelector('.is-card')!;
    this.hintEl = root.querySelector('.is-hint')!;
    this.wireCamera();
    addEventListener('resize', () => {
      if (!this.isOpen) return;
      this.clampCam();
      this.apply();
    });
    this.topEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-isea]');
      if (b) this.onExit();
    });
    this.sideEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-iside]');
      if (!b) return;
      const what = b.dataset.iside!;
      if (what === 'collect') this.send({ t: 'base', action: 'collect' });
      else if (what === 'barge') this.send({ t: 'base', action: 'barge' });
      else if (what === 'raid') this.onSail();
      else if (what === 'defence') this.select(this.pick && 'defence' in this.pick ? null : { defence: true });
      else this.onTab(what as 'yard' | 'town' | 'supply');
    });
    this.queueEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-qplot], [data-qtown]');
      if (!b) return;
      if (b.dataset.qplot) this.select({ plot: Number(b.dataset.qplot) }, true);
      else this.select({ town: b.dataset.qtown as TownId }, true);
    });
  }

  /** Everything from the island's view: the map, the spots, the bars, the card. */
  update(state: ClientState): void {
    this.state = state;
    if (!this.isOpen || !this.root) return;
    const v = state.base;
    this.root.classList.toggle('is-loading', !v);
    if (!v) {
      this.topEl.innerHTML = this.topHtml(null, state);
      this.sideEl.innerHTML = '';
      this.queueEl.innerHTML = '';
      this.hintEl.textContent = state.baseAt ? L('none') : L('loading');
      this.cardEl.classList.add('hidden');
      return;
    }
    const map = ISO_MAP_OF[v.biome] ?? 'temperate';
    if (map !== this.map || !this.mapImg.getAttribute('src')) {
      this.map = map;
      this.mapImg.src = isleUrl(`isle.map.${map}`) ?? '';
      this.sig = '';
    }
    if (!this.framed) {
      this.frame();
      this.framed = true;
    }
    this.layout(v);
    this.topEl.innerHTML = this.topHtml(v, state);
    this.sideEl.innerHTML = this.sideHtml(v, state);
    this.queueEl.innerHTML = this.queueHtml(v);
    this.hintEl.textContent = this.base.moving !== null ? L('moveHint') : this.pick ? '' : L('hint');
    this.hintEl.classList.toggle('hidden', !!this.pick && this.base.moving === null);
    this.renderCard();
  }

  /** Every second: the clocks, the bars, a stage passing half its work (s0 → s1). */
  tick(state: ClientState): void {
    if (!this.isOpen || !this.root || !state.base) return;
    this.base.tick(this.root, state);
    this.layout(state.base);
  }

  // ------------------------------------------------------------------------------------------------ the spots

  /** The board's spots now: the town on its edges, the plots before it, the pen and the Grail on their corners. */
  private spotsOf(v: BaseView): Spot[] {
    const now = this.now();
    const out: Spot[] = [];
    const hall = v.town?.things.find((t) => t.id === 'hall')?.level ?? v.hall ?? 1;
    const timer = (j: { start: number; end: number }) => `<span class="btime" data-end="${j.end}">${esc(timeText((j.end - now) / 1000))}</span><span class="bprog"><i data-start="${j.start}" data-stop="${j.end}" style="width:${Math.round(Math.max(0, Math.min(1, (now - j.start) / Math.max(1, j.end - j.start))) * 100)}%"></i></span>`;
    const things = this.base.townThings(v);
    for (const t of things) {
      const cell = TOWN_CELLS[t.id] ?? plotCell(EXTRA_PLOTS[t.id as 'pen' | 'grail']);
      const sheet = isoSheet(t.id);
      const st = isoStage(t.level, t.job, now);
      const ghost = t.level <= 0 && !t.job;
      const can = ghost && !!t.next && !t.next.why;
      const pic = sheet ? { id: `isle.${sheet}.${ghost ? 's0' : st.stage}`, foot: isoFoot(sheet) } : townArt(t.id, t.level, !!t.job) ? { icon: townArt(t.id, t.level, !!t.job)! } : null;
      const tag = t.job ? `<span class="is-t is-tj">${timer(t.job)}</span>` : t.level > 0 ? `<span class="is-t is-tl">${t.level}</span>` : can ? '<span class="is-t is-tp" aria-hidden="true">+</span>' : '';
      out.push({ key: `t:${t.id}`, town: t.id, cell, pic, cls: [ghost ? 'ghost' : '', can ? 'can' : '', !ghost && st.dim ? 'dim' : '', t.id === 'pen' || t.id === 'grail' ? 'upright' : ''].filter(Boolean).join(' '), ground: ghost ? 'ghost' : '', tag });
    }
    const lockHalls = v.locked.map((l) => hallFor(l.level)).filter((n) => n > 0);
    const nextHall = lockHalls.length ? Math.min(...lockHalls) : 0;
    for (let k = 0; k < PLOT_CELLS.length; k++) {
      if (k === EXTRA_PLOTS.pen || k === EXTRA_PLOTS.grail) continue;
      const cell = plotCell(k);
      if (k >= v.plots) {
        const lock = v.locked.find((l) => l.plot === k);
        const h = lock ? hallFor(lock.level) : 0;
        const soon = h > 0 && h === nextHall;
        out.push({ key: `p:${k}`, cell, pic: null, cls: '', ground: soon ? 'soon' : 'locked', tag: soon ? `<span class="is-t is-tk" title="${esc(L('locked', { n: h }))}">🔒 ${h}</span>` : '' });
        continue;
      }
      const c = v.cells[k];
      if (!c?.what) {
        out.push({ key: `p:${k}`, plot: k, cell, pic: null, cls: this.base.moving !== null ? 'target' : '', ground: 'empty', tag: '<span class="is-t is-tp" aria-hidden="true">+</span>' });
        continue;
      }
      const sheet = isoSheet(c.what)!;
      // A building of a single level shows the look of the town round it (the hall's level) until it has five.
      const lvl = maxOf(c.what) <= 1 ? Math.max(1, Math.min(5, hall)) : c.level;
      const st = isoStage(c.job && c.job.level <= 1 ? 0 : lvl, c.job, now);
      const kind = producerOf(c.what);
      const tag = c.job ? `<span class="is-t is-tj">${timer(c.job)}</span>`
        : c.fresh > 0 && kind ? `<span class="is-t is-tf">${icon(`good_${PRODUCERS[kind].good}`, '', 'ico-sm')}+${fmt(c.fresh)}</span>`
        : c.level && maxOf(c.what) > 1 ? `<span class="is-t is-tl">${c.level}</span>` : '';
      out.push({ key: `p:${k}`, plot: k, cell, pic: { id: `isle.${sheet}.${st.stage}`, foot: isoFoot(sheet) }, cls: [st.dim ? 'dim' : '', c.idle ? 'idle' : ''].filter(Boolean).join(' '), ground: '', tag });
    }
    return out;
  }

  /** Lay the spots on the map: the pictures diffed by spot (a changed picture only is swapped), the ground and the
   *  tags drawn afresh. */
  private layout(v: BaseView): void {
    const spots = this.spotsOf(v);
    const selKey = this.pick && 'plot' in this.pick ? `p:${this.pick.plot}` : this.pick && 'town' in this.pick ? `t:${this.pick.town}` : '';
    const sig = `${this.map}|${selKey}|${this.base.moving}|${spots.map((s) => `${s.key}=${s.pic ? ('id' in s.pic ? s.pic.id : s.pic.icon) : ''}/${s.cls}/${s.ground}/${s.tag.replace(/<span class="btime"[^]*?<\/span>|style="[^"]*"/g, '')}`).join(',')}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.spots = spots;
    const ground: string[] = [];
    const tags: string[] = [];
    const seen = new Set<string>();
    for (const s of spots) {
      const sp = isoSpot(this.map, s.cell, s.ground === 'ghost' ? ISO_SLOT - 0.5 : 3.6);
      const sel = s.key === selKey;
      if (s.ground || sel) ground.push(`<polygon class="is-g ${s.ground}${sel ? ' sel' : ''}${s.cls.includes('target') ? ' target' : ''}" points="${[sp.t, sp.r, sp.b, sp.l].map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}"/>`);
      let top = (sp.t[1] + sp.b[1]) / 2;
      const cx = (sp.l[0] + sp.r[0]) / 2;
      if (s.pic) {
        seen.add(s.key);
        let el = this.picEls.get(s.key);
        if (!el) {
          el = document.createElement('img');
          el.className = 'is-pic';
          el.setAttribute('alt', '');
          el.setAttribute('draggable', 'false');
          this.pics.append(el);
          this.picEls.set(s.key, el);
        }
        const img = el as HTMLImageElement;
        if ('id' in s.pic) {
          const fp = isoSpot(this.map, s.cell, s.pic.foot);
          const meta = assetMeta(s.pic.id) as { anchor?: [number, number] } | null;
          const [ax, ay] = meta?.anchor ?? [0, 0];
          const k = (fp.r[0] - fp.l[0]) / (s.pic.foot * ISO_UNIT);
          const url = isleUrl(s.pic.id) ?? '';
          if (img.dataset.src !== url) {
            img.dataset.src = url;
            img.src = url;
          }
          img.style.cssText = `left:${(fp.b[0] - ax * k).toFixed(1)}px;top:${(fp.b[1] - ay * k).toFixed(1)}px;transform:scale(${k.toFixed(4)});z-index:${10 + fp.z}`;
          img.dataset.k = String(k);
          top = fp.b[1] - ay * k + 6;
        } else {
          // an upright icon (the pen, the Grail): as wide as two and a half cells, its foot in the spot's middle
          const w = ((sp.r[0] - sp.l[0]) / 3.6) * 2.6;
          if (img.dataset.src !== s.pic.icon) {
            img.dataset.src = s.pic.icon;
            img.src = s.pic.icon;
          }
          const foot = (sp.t[1] + sp.b[1]) / 2 + (sp.b[1] - sp.t[1]) * 0.18;
          img.style.cssText = `left:${(cx - w / 2).toFixed(1)}px;top:${(foot - w).toFixed(1)}px;width:${w.toFixed(1)}px;height:${w.toFixed(1)}px;z-index:${10 + sp.z}`;
          img.dataset.k = '';
          top = foot - w + 4;
        }
        img.className = `is-pic${s.cls ? ` ${s.cls}` : ''}${sel ? ' sel' : ''}`;
      }
      if (s.tag) tags.push(`<div class="is-tag" style="left:${cx.toFixed(1)}px;top:${Math.max(4, top).toFixed(1)}px;z-index:${10 + sp.z}">${s.tag}</div>`);
    }
    for (const [key, el] of this.picEls) {
      if (!seen.has(key)) {
        el.remove();
        this.picEls.delete(key);
      }
    }
    this.svg.innerHTML = ground.join('');
    this.tags.innerHTML = tags.join('');
  }

  /** The spot under a point of the map: its ground's diamond first (the front one), else the picture over it. */
  private spotAt(mx: number, my: number): Spot | null {
    const inside = (p: Pt[], x: number, y: number) => {
      let c = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
      }
      return c;
    };
    let best: Spot | null = null, bz = -1;
    for (const s of this.spots) {
      if (s.ground === 'locked' || s.ground === 'soon') continue;
      const sp = isoSpot(this.map, s.cell, 3.8);
      if (sp.z > bz && inside([sp.t, sp.r, sp.b, sp.l], mx, my)) {
        best = s;
        bz = sp.z;
      }
    }
    if (best) return best;
    // the picture's box (a tall building's roof over the spot behind it)
    for (const s of this.spots) {
      const el = this.picEls.get(s.key) as HTMLImageElement | undefined;
      if (!el || !el.naturalWidth) continue;
      const k = Number(el.dataset.k) || 0;
      const x0 = parseFloat(el.style.left), y0 = parseFloat(el.style.top);
      const w = k ? el.naturalWidth * k : parseFloat(el.style.width), h = k ? el.naturalHeight * k : parseFloat(el.style.height);
      const z = isoSpot(this.map, s.cell).z;
      if (mx >= x0 + w * 0.15 && mx <= x0 + w * 0.85 && my >= y0 && my <= y0 + h && z > bz) {
        best = s;
        bz = z;
      }
    }
    return best;
  }

  private tap(sx: number, sy: number): void {
    const v = this.state?.base;
    if (!v) return;
    const r = this.viewEl.getBoundingClientRect();
    const mx = (sx - r.left - this.cam.x) / this.cam.s, my = (sy - r.top - this.cam.y) / this.cam.s;
    const s = this.spotAt(mx, my);
    if (this.base.moving !== null) {
      if (s?.plot !== undefined && !v.cells[s.plot]?.what && s.plot !== this.base.moving) {
        this.send({ t: 'base', action: 'move', plot: this.base.moving, to: s.plot });
        this.base.moving = null;
        this.select({ plot: s.plot });
      }
      return;
    }
    if (!s || (s.plot === undefined && !s.town)) return this.select(null);
    this.select(s.plot !== undefined ? { plot: s.plot } : { town: s.town! });
  }

  /** Open a spot's card (null: close it); `show` brings the spot into the view. */
  private select(p: IsleScene['pick'], show = false): void {
    const same = (a: IsleScene['pick'], b: IsleScene['pick']) => JSON.stringify(a) === JSON.stringify(b);
    this.pick = p && same(p, this.pick) && !show ? null : p;
    this.base.sel = this.pick && 'plot' in this.pick ? this.pick.plot : null;
    this.base.selTown = this.pick && 'town' in this.pick ? this.pick.town : null;
    if (show && this.pick && !('defence' in this.pick)) {
      const s = this.spots.find((x) => x.key === ('plot' in this.pick! ? `p:${this.pick.plot}` : `t:${(this.pick as { town: TownId }).town}`));
      if (s) this.lookAt(isoSpot(this.map, s.cell));
    }
    if (this.state) this.update(this.state);
  }

  // ------------------------------------------------------------------------------------------------ the bars

  private topHtml(v: BaseView | null, state: ClientState): string {
    const ru = lang() === 'ru' ? 1 : 0;
    const hall = v?.town?.things.find((t) => t.id === 'hall')?.level ?? v?.hall ?? 1;
    const name = v ? `<div class="is-name"><b>${esc(placeName(v.name))}</b><span>${esc(L('hall', { n: hall }))}</span></div>` : '<div class="is-name"></div>';
    const res = v ? v.store.map((r) => {
      const full = r.n >= r.cap;
      return `<span class="is-res${full ? ' full' : ''}" title="${esc(`${GOODS[r.good].name}: ${fmt(r.n)}/${fmt(r.cap)}${r.rate > 0 ? ` · +${Math.round(r.rate * 10) / 10}/${ru ? 'ч' : 'h'}` : ''}`)}">${icon(`good_${r.good}`, '', 'ico-sm')}<b>${fmt(r.n)}</b><i>/${fmt(r.cap)}</i></span>`;
    }).join('') : '';
    return `${name}<div class="is-store">${res}<span class="is-res is-silver" title="${esc(L('silver'))}">${money(state.self?.gold ?? 0)}</span></div>
      <button type="button" class="btn btn-primary is-sea" data-isea title="${esc(L('seaTip'))}">${icon('menu_ship', '', 'ico-sm')}<span>${esc(L('sea'))}</span></button>`;
  }

  private sideHtml(v: BaseView, state: ClientState): string {
    const fresh = v.cells.reduce((a, c) => a + c.fresh, 0);
    const btn = (id: string, ico: string, label: string, o: { badge?: string; on?: boolean; off?: boolean; cls?: string; title?: string } = {}) =>
      `<button type="button" class="is-sb${o.on ? ' on' : ''}${o.cls ? ` ${o.cls}` : ''}" data-iside="${id}"${o.off ? ' disabled' : ''} title="${esc(o.title ?? label)}">${icon(ico, '', 'is-sb-ico')}<span class="is-sb-l">${esc(label)}</span>${o.badge ? `<b class="is-sb-n">${esc(o.badge)}</b>` : ''}</button>`;
    const raid = v.claim.raid ? btn('raid', 'build_battery', L('raid'), { cls: 'raid', title: serverWord(state) }) : '';
    return `${raid}${btn('collect', 'tab_holdings', L('collect'), { badge: fresh ? `+${fmt(fresh)}` : '', off: !fresh })}${btn('yard', 'build_shipyard', L('ships'), { badge: v.shipyard.ships.length ? String(v.shipyard.ships.length) : '' })}${v.town ? btn('town', 'build_fort', L('town')) : ''}${btn('supply', 'build_caravan_office', L('supply'))}${btn('defence', 'build_battery', L('defence'), { on: !!this.pick && 'defence' in this.pick })}`;
  }

  private queueHtml(v: BaseView): string {
    const now = v.now;
    const rows = [
      ...this.base.townThings(v).filter((t) => t.job).map((t) => ({ attr: `data-qtown="${t.id}"`, name: treeLabel(t.id, t.job!.level), art: this.picOf(`t:${t.id}`) ?? townArt(t.id, t.level, true), job: t.job! })),
      ...v.cells.filter((c) => c.job && c.what).map((c) => ({ attr: `data-qplot="${c.plot}"`, name: baseName(c.what!), art: this.picOf(`p:${c.plot}`), job: c.job! })),
    ].sort((a, b) => a.job.end - b.job.end);
    const free = Math.max(0, v.crews.n - rows.length);
    const chips = rows.map((r) => `<button type="button" class="is-q" role="listitem" ${r.attr} title="${esc(r.name)}">${r.art ? `<img src="${r.art}" alt="" draggable="false">` : ''}<span class="is-qm"><span class="is-qn">${esc(r.name)}</span><span class="btime" data-end="${r.job.end}">${esc(timeText((r.job.end - now) / 1000))}</span><span class="bprog"><i data-start="${r.job.start}" data-stop="${r.job.end}"></i></span></span></button>`);
    for (let i = 0; i < free; i++) chips.push(`<span class="is-q free" role="listitem"><span class="is-qm"><span class="is-qn">${esc(L('queueFree'))}</span></span></span>`);
    return `<span class="is-qh" title="${esc(L('queueTip'))}">${esc(T29('queueN', { busy: v.crews.busy, n: v.crews.n }))}</span>${chips.join('')}`;
  }

  /** A spot's picture now (its sheet's cell at its stage). */
  private picOf(key: string): string | null {
    const s = this.spots.find((x) => x.key === key);
    return s?.pic ? ('id' in s.pic ? isleUrl(s.pic.id) : s.pic.icon) : null;
  }

  // ------------------------------------------------------------------------------------------------ the card

  private renderCard(): void {
    const state = this.state;
    const v = state?.base;
    if (!state || !v || (!this.pick && this.base.moving === null)) {
      this.cardEl.classList.add('hidden');
      this.root?.classList.remove('is-carded');
      return;
    }
    // the island window shares the selection (a window over the scene may have moved it)
    this.base.sel = this.pick && 'plot' in this.pick ? this.pick.plot : null;
    this.base.selTown = this.pick && 'town' in this.pick ? this.pick.town : null;
    let body = '';
    if (this.pick && 'defence' in this.pick) body = `${this.base.defence(v)}${this.base.watersCard(v)}`;
    else body = this.base.sheet(v, state, true);
    if (!body) {
      this.cardEl.classList.add('hidden');
      return;
    }
    const keep = this.cardEl.querySelector('.is-cb')?.scrollTop ?? 0;
    this.cardEl.innerHTML = `<button type="button" class="is-x" data-ix aria-label="${esc(L('close'))}" title="${esc(L('close'))}">×</button><div class="is-cb base-sheet">${body}</div>`;
    this.cardEl.classList.remove('hidden');
    this.root?.classList.add('is-carded');
    const cb = this.cardEl.querySelector<HTMLElement>('.is-cb')!;
    cb.scrollTop = keep;
    // the island's own isometric pictures in the card: the building's head, the build list's rows
    const key = this.pick && 'plot' in this.pick ? `p:${this.pick.plot}` : this.pick && 'town' in this.pick ? `t:${this.pick.town}` : '';
    const head = key ? this.picOf(key) : null;
    const thumb = cb.querySelector<HTMLImageElement>('.bsheet-h img.bthumb');
    if (head && thumb) thumb.src = head;
    cb.querySelectorAll<HTMLElement>('.bopt[data-what]').forEach((row) => {
      const img = row.querySelector<HTMLImageElement>('.bopt-art');
      const url = isleUrl(`isle.${isoSheet(row.dataset.what!)}.l1`);
      if (img && url) img.src = url;
    });
    this.base.bind(this.cardEl, state, () => this.update(state));
    // the window's tabs and its «sail to defend» go out of the scene
    this.cardEl.querySelectorAll<HTMLElement>('[data-btab]').forEach((el) => (el.onclick = () => this.onTab(el.dataset.btab === 'yard' ? 'yard' : el.dataset.btab === 'supply' ? 'supply' : 'town')));
    this.cardEl.querySelector<HTMLElement>('[data-bsail]')?.addEventListener('click', () => this.onSail());
    this.cardEl.querySelector<HTMLElement>('[data-ix]')!.onclick = () => {
      this.base.moving = null;
      this.select(null);
    };
    // a queue row in the card opens its building here too
    this.cardEl.querySelectorAll<HTMLElement>('.bjob[data-plot], .bjob[data-town]').forEach((el) => (el.onclick = () => this.select(el.dataset.plot ? { plot: Number(el.dataset.plot) } : { town: el.dataset.town as TownId }, true)));
    this.base.tick(this.cardEl, state);
  }

  // ------------------------------------------------------------------------------------------------ the camera

  /** QA: where a spot's middle stands on the screen (`p:3`, `t:hall`), and the camera. */
  probe(key?: string): { cam: Cam; at: { x: number; y: number } | null } {
    const s = key ? this.spots.find((x) => x.key === key) : undefined;
    let at: { x: number; y: number } | null = null;
    if (s) {
      const sp = isoSpot(this.map, s.cell, 3);
      const r = this.viewEl.getBoundingClientRect();
      at = { x: r.left + this.cam.x + ((sp.l[0] + sp.r[0]) / 2) * this.cam.s, y: r.top + this.cam.y + ((sp.t[1] + sp.b[1]) / 2) * this.cam.s };
    }
    return { cam: { ...this.cam }, at };
  }


  private now(): number {
    const s = this.state;
    if (!s?.base) return Date.now();
    return s.base.now + (Date.now() - s.baseAt) * s.timeScale;
  }

  private size(): { w: number; h: number } {
    return { w: this.viewEl.clientWidth || innerWidth, h: this.viewEl.clientHeight || innerHeight };
  }

  /** The least scale: the map covers the screen. */
  private sMin(): number {
    const { w, h } = this.size();
    return Math.max(w / ISO_W, h / ISO_H);
  }

  private sMax(): number {
    // the map is painted at 1:1, the buildings at about twice that: closer than this the ground goes soft
    return Math.max(this.sMin() * 2.6, 1.7);
  }

  /** The first look: the whole board, its tall back row too, between the bars. */
  private frame(): void {
    const { w, h } = this.size();
    const t = isoSpot(this.map, [0, 0]).t, r = isoSpot(this.map, [5, 0]).r, b = isoSpot(this.map, [5, 5]).b, l = isoSpot(this.map, [0, 5]).l;
    const bw = r[0] - l[0], bh = b[1] - t[1] + (b[1] - t[1]) * 0.45; // the back row stands tall over its edge
    const top = this.topEl.offsetHeight || 34, bottom = this.queueEl.offsetHeight || 34;
    const s = Math.max(this.sMin(), Math.min(this.sMax(), Math.min((w - 100) / bw, (h - top - bottom - 8) / bh)));
    this.cam.s = s;
    const cx = (l[0] + r[0]) / 2, cy = t[1] - (b[1] - t[1]) * 0.45 + bh / 2;
    this.cam.x = w / 2 - cx * s;
    this.cam.y = top + (h - top - bottom) / 2 - cy * s;
    this.clampCam();
    this.apply();
  }

  private lookAt(sp: { t: Pt; b: Pt; l: Pt; r: Pt }): void {
    const { w, h } = this.size();
    const card = this.cardEl.classList.contains('hidden') ? 0 : this.cardEl.offsetWidth;
    const cx = (sp.l[0] + sp.r[0]) / 2, cy = (sp.t[1] + sp.b[1]) / 2 - (sp.b[1] - sp.t[1]) * 0.6;
    const sx = this.cam.x + cx * this.cam.s, sy = this.cam.y + cy * this.cam.s;
    const room = w - card;
    if (sx < 60 || sx > room - 60 || sy < 50 || sy > h - 50) {
      this.cam.x += (room / 2 - sx);
      this.cam.y += (h / 2 - sy);
      this.clampCam();
      this.apply();
    }
  }

  private clampCam(): void {
    const { w, h } = this.size();
    const c = this.cam;
    c.s = Math.max(this.sMin(), Math.min(this.sMax(), c.s));
    const mw = ISO_W * c.s, mh = ISO_H * c.s;
    c.x = mw <= w ? (w - mw) / 2 : Math.min(0, Math.max(w - mw, c.x));
    c.y = mh <= h ? (h - mh) / 2 : Math.min(0, Math.max(h - mh, c.y));
  }

  private apply(): void {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      const c = this.cam;
      this.world.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0) scale(${c.s.toFixed(4)})`;
      this.world.style.setProperty('--inv', (1 / c.s).toFixed(4));
    });
  }

  /** Zoom by `f` about a point of the screen (the view's own coordinates). */
  private zoomAt(f: number, px: number, py: number, from: Cam = this.cam): void {
    const s = Math.max(this.sMin(), Math.min(this.sMax(), from.s * f));
    const k = s / from.s;
    this.cam = { s, x: px - (px - from.x) * k, y: py - (py - from.y) * k };
    this.clampCam();
    this.apply();
  }

  private wireCamera(): void {
    const el = this.viewEl;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const start = () => {
      const pts = [...this.pointers.values()];
      const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length, my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const d0 = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
      const moved = this.gesture?.moved ?? false;
      this.gesture = { x: mx, y: my, t: this.gesture?.t ?? performance.now(), moved: moved || pts.length > 1, cam: { ...this.cam }, d0, mx, my };
      this.world.classList.add('moving');
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, local(e));
      if (this.pointers.size === 1) this.gesture = null;
      start();
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId) || !this.gesture) return;
      this.pointers.set(e.pointerId, local(e));
      const g = this.gesture;
      const pts = [...this.pointers.values()];
      const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length, my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      if (Math.hypot(mx - g.x, my - g.y) > 8) g.moved = true;
      if (!g.moved) return;
      if (pts.length > 1 && g.d0 > 0) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        // the pinch about its first middle, then carried by the middle's move
        const s = Math.max(this.sMin(), Math.min(this.sMax(), g.cam.s * (d / g.d0)));
        const k = s / g.cam.s;
        this.cam = { s, x: mx - (g.mx - g.cam.x) * k, y: my - (g.my - g.cam.y) * k };
      } else {
        this.cam = { s: g.cam.s, x: g.cam.x + (mx - g.mx), y: g.cam.y + (my - g.my) };
      }
      this.clampCam();
      this.apply();
    });
    const end = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      const g = this.gesture;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size) return start();
      this.world.classList.remove('moving');
      this.gesture = null;
      if (g && !g.moved && e.type === 'pointerup' && performance.now() - g.t < 700) this.tap(e.clientX, e.clientY);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = local(e);
      this.zoomAt(Math.exp(-Math.max(-120, Math.min(120, e.deltaY)) * 0.0022), p.x, p.y);
    }, { passive: false });
    el.addEventListener('dblclick', (e) => {
      const p = local(e);
      this.zoomAt(1.6, p.x, p.y);
    });
  }
}

/** A baked picture of the island screen by its manifest id (not preloaded with the game: assets.ts). */
export function isleUrl(id: string): string | null {
  const e = assetMeta(id);
  if (!e) return null;
  return `/assets/${e.local}${e.rev ? `?v=${e.rev}` : ''}`;
}

/** The raid's line for the side button's hint. */
function serverWord(state: ClientState): string {
  const r = state.base?.claim.raid;
  return r ? `${L('raid')} ${timeText((r.until - (state.base?.now ?? Date.now())) / 1000)}` : '';
}
