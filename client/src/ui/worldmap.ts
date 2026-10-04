// World map: a dark nautical chart. Only what the captain has charted is drawn — information is a resource.

import { drawIslesChart, drawSupplyRoutes, isleFill, isleLegend, zoneHint } from './islemap.ts'; // docs/18 III
import { socialLegend, drawLfgFlag, drawSignalFlag, lfgLabel, lfgLog, liveSignals, signalName, wireLfgRows, worldGoalsLog } from './social.ts';
import { icon } from './dom.ts';
import { WORLD_SIZE } from '../../../shared/src/constants.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import { bandOf, SECTOR_SIZE, SECTORS_PER_SIDE } from '../../../shared/src/world/sectors.ts';
import { THREAT_COLOR, shipLevelOf, threatOf } from '../../../shared/src/data/shiplevel.ts';
import { drawRoamsChart } from '../render/roamers.ts'; // docs/19 D7
import { EN as ROAM_EN, RU as ROAM_RU } from '../lang/ui/roamers.ts';
/** The chart's key open or folded, as the captain left it. */
const LEGEND_KEY = 'gravetide.mapLegend';
const LROAM = dict(ROAM_EN, ROAM_RU);
import { sprite } from '../assets.ts';
import type { ClientState } from '../state.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { setTracked, setWaypoint, trackedQuest, waypoint } from './track.ts';
import { EN as EASE_EN, RU as EASE_RU } from '../lang/ui/ease.ts';
import { EN as REN, RU as RRU } from '../lang/ui/render.ts';
import { dec1 } from './dom.ts';
import { commonLog, dailyLog } from './daily.ts';
import { dict, lang, plural } from '../i18n.ts';
import { EN, RU } from '../lang/ui/worldmap.ts';
import { EN as DEN, RU as DRU } from '../lang/ui/dealings.ts';
import { EN as SEN, RU as SRU } from '../lang/ui/livesea.ts';
import { EN as IEN, RU as IRU } from '../lang/ui/isles.ts';
import { SEASON_NAMES, TIDAL_NAMES } from '../../../shared/src/data/isles.ts';
import { keyLabel, settings } from '../settings.ts';
import { mapCard, placeName } from './maps.ts';
import { esc } from './dom.ts';
import { serverText } from '../lang/server.ts';
import { drawMines } from './minemap.ts';
import { drawAdvChart, drawHeroSites, heroLegend } from './advchart.ts'; // docs/17 H4–H5
import { EN as H4_EN, RU as H4_RU } from '../lang/ui/h4.ts';
import { taskName } from '../../../shared/src/data/worldtasks.ts';

const H4L = dict(H4_EN, H4_RU);
const L = dict(EN, RU);
const LI = dict(IEN, IRU);
const LS = dict(SEN, SRU);
const RL = dict(REN, RRU);
const DL = dict(DEN, DRU);
const EL = dict(EASE_EN, EASE_RU);

type Intel = NonNullable<ClientState['self']>['intel'][number];

/** By a port's crest: the goods dear there over a gold rule, the cheap ones over a blue (docs/16 #11). Talk of the
 *  quay (not seen for herself) in a dashed frame. */
function demandMarks(g: CanvasRenderingContext2D, it: Intel, x: number, y: number, size: number, fresh: number): void {
  const rows: [string[] | undefined, string, number][] = [[it.dear, '224,184,98', -size * 0.05], [it.cheap, '120,190,230', size * 1.12]];
  g.save();
  for (const [goods, rgb, dy] of rows) {
    (goods ?? []).forEach((good, i) => {
      const cx = x + i * (size + 3) + size / 2, cy = y + dy;
      g.globalAlpha = fresh;
      g.fillStyle = 'rgba(226,212,178,0.92)';
      g.strokeStyle = `rgba(${rgb},1)`;
      g.lineWidth = 1.4;
      g.setLineDash(it.heard ? [2.5, 2] : []);
      g.beginPath();
      g.arc(cx, cy, size * 0.56, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.setLineDash([]);
      const art = sprite(`icon.good_${good}`);
      if (art) g.drawImage(art.img, cx - size * 0.42, cy - size * 0.42, size * 0.84, size * 0.84);
      // An arrow: up for dear (sell here), down for cheap (buy here).
      g.fillStyle = `rgba(${rgb},1)`;
      const ax = cx + size * 0.5, ay = cy - size * 0.38, up = dy < size * 0.5 ? -1 : 1;
      g.beginPath();
      g.moveTo(ax - 3, ay + (up < 0 ? 2 : -2));
      g.lineTo(ax + 3, ay + (up < 0 ? 2 : -2));
      g.lineTo(ax, ay + (up < 0 ? -3 : 3));
      g.closePath();
      g.fill();
    });
  }
  g.restore();
}

/** Where the whispers point: a cache's island ringed, a caravan where she was seen with her heading and how far she
 *  may have sailed since; old whispers fade. */
function hearsayMarks(
  g: CanvasRenderingContext2D, list: NonNullable<ClientState['self']>['hearsay'] & object, tx: (x: number) => number, ty: (y: number) => number, k: number, ms: number, now: number,
  mark: (id: string, x: number, y: number, size?: number, rot?: number) => boolean, label: (text: string, x: number, y: number, color?: string) => void, age: (t: number) => string,
): void {
  for (const h of list) {
    const x = tx(h.x), y = ty(h.y);
    const fresh = Math.max(0.35, 1 - (now - h.t) / Math.max(60, h.expiresAt - h.t));
    g.save();
    g.globalAlpha = fresh;
    g.setLineDash([4, 4]);
    g.strokeStyle = h.kind === 'cache' ? 'rgba(232,196,106,0.95)' : 'rgba(150,210,160,0.95)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(x, y, Math.max(ms * 0.55, h.r * k), 0, Math.PI * 2);
    g.stroke();
    if (h.kind === 'caravan' && h.heading !== undefined) {
      const run = (h.speed ?? 6) * Math.max(0, now - h.t);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(tx(h.x + Math.sin(h.heading) * run), ty(h.y - Math.cos(h.heading) * run));
      g.stroke();
    }
    g.setLineDash([]);
    mark(h.kind === 'cache' ? 'icon.map_treasure' : 'icon.map_ship', x, y, ms * 0.85, h.kind === 'caravan' ? h.heading ?? 0 : 0);
    g.restore();
    g.font = 'italic 12px "Cormorant Garamond", serif';
    label(h.kind === 'cache' ? DL('map.cache', { name: placeName(h.name) }) : DL('map.caravan', { age: age(h.t) }), x, y - ms * 0.7, h.kind === 'cache' ? '#e8c46a' : '#a8dcb0');
  }
}

/** The chart's key, in its own symbols. */
/** Tasks of the sea (docs/11 P6): each nest, field or haunted waters, the minutes left and one's tally — under the
 *  chart (a row turns the chart to it) and in the journal. */
export function tasksLog(state: ClientState, clickable: boolean): string {
  if (!state.tasks.length) return '';
  const gone = (performance.now() - state.tasksAt) / 1000;
  const rows = state.tasks.map((t) => {
    const m = Math.max(0, Math.ceil((t.endsIn - gone) / 60));
    const inner = `<b>${esc(serverText(taskName(t.kind, t.island)))}</b><span class="muted">${esc(placeName(REGIONS[t.region].name))} · ${t.done ? esc(L('taskDone')) : esc(L('taskRow', { m, k: t.mine, n: t.need }))}</span>`;
    return clickable ? `<button class="mq-row task${t.done ? ' done' : ''}" data-task="${t.id}">${inner}</button>` : `<div class="mq-row task off${t.done ? ' done' : ''}">${inner}</div>`;
  }).join('');
  return `<div class="map-quests map-tasks" title="${esc(L('tasksHint'))}"><div class="mq-head">${icon('danger', '', 'ico-sm')}${esc(L('tasks'))}</div>${rows}</div>`;
}

const LEGEND: [string, Parameters<typeof L>[0]][] = [
  ['map_ship', 'lg.you'], ['map_port', 'lg.port'], ['map_contract', 'lg.contract'], ['map_treasure', 'lg.treasure'],
  ['map_wreck', 'lg.wreck'], ['map_event', 'lg.event'], ['danger', 'lg.task'], ['map_monster', 'lg.sighting'],
];
/** docs/16 #11, #14: the chart's key for the dear/cheap goods and the whispers. */
const LEGEND_C: [string, Parameters<typeof DL>[0]][] = [['tab_market', 'lg.demand'], ['map_treasure', 'lg.hearsay']];

export class WorldMap {
  /** Batch E of docs/16 on the chart: known shoals, lit lights, lookouts, bared banks, her caches. */
  private drawIsles(g: CanvasRenderingContext2D, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, k: number, ms: number, label: (text: string, x: number, y: number, color?: string) => void, mark: (id: string, x: number, y: number, size?: number) => boolean): void {
    const now = state.estServerTime();
    const ru = lang() === 'ru' ? 1 : 0;
    // The shoals she knows: faint, so the chart reads its islands first.
    if (this.zoom >= 2) {
      g.strokeStyle = 'rgba(110,170,160,0.45)';
      g.lineWidth = 1;
      for (const rf of state.reefs.values()) {
        g.beginPath();
        g.arc(tx(rf.x), ty(rf.y), Math.max(1.2, rf.r * k * 0.8), 0, Math.PI * 2);
        g.stroke();
      }
    }
    for (const l of state.isles?.lights ?? []) {
      if (!l.lit) continue;
      g.strokeStyle = 'rgba(245,199,122,0.35)';
      g.setLineDash([3, 4]);
      g.beginPath();
      g.arc(tx(l.x), ty(l.y), l.r * k, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#f5c77a';
      g.font = `${Math.round(ms * 0.5)}px serif`;
      g.textAlign = 'center';
      g.fillText('✶', tx(l.x), ty(l.y) + ms * 0.18);
    }
    for (const l of state.isles?.lookouts ?? []) {
      const x = tx(l.x), y = ty(l.y), r = ms * 0.22;
      g.fillStyle = l.at ? 'rgba(160,170,150,0.9)' : '#d0503a';
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y - r * 1.3);
      g.lineTo(x + r, y + r * 0.7);
      g.lineTo(x - r, y + r * 0.7);
      g.closePath();
      g.fill();
      g.stroke();
      if (l.at && this.zoom >= 2) {
        g.strokeStyle = 'rgba(160,170,150,0.35)';
        g.setLineDash([2, 5]);
        g.beginPath();
        g.arc(x, y, 5000 * k, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
      if (this.zoom >= 4) label(LI(l.at ? 'look.done' : 'look.label'), x, y - r * 1.8, l.at ? 'rgba(185,194,168,0.9)' : 'rgba(240,213,143,0.95)');
    }
    for (const b of state.isles?.tidal ?? []) {
      if (!b.up) continue;
      const x = tx(b.x), y = ty(b.y), r = Math.max(ms * 0.2, b.r * k);
      g.fillStyle = b.kind === 'season' && b.season === 3 ? '#cfd8dc' : '#cdb98a';
      g.strokeStyle = b.combed ? 'rgba(0,0,0,0.8)' : 'rgba(255,230,160,0.95)';
      g.lineWidth = b.combed ? 1.2 : 2;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      const name = TIDAL_NAMES[b.name][ru];
      const n = Math.max(1, Math.round((b.turn - now) / 60));
      const t = b.kind === 'season' ? LI('tide.seasonUp', { name, season: SEASON_NAMES[b.season][ru] }) : LI('tide.up', { name, n });
      if (this.zoom >= 1.6) label(b.combed ? `${t} · ${LI('tide.combed')}` : t, x, y - r - 6, 'rgba(239,225,184,0.95)');
    }
    for (const c of state.isles?.caches ?? []) {
      const x = tx(c.x), y = ty(c.y);
      if (!mark('icon.map_treasure', x, y, ms * 0.8)) {
        g.fillStyle = '#e8c46a';
        g.fillRect(x - 4, y - 4, 8, 8);
      }
      if (this.zoom >= 3) label(LI('cache.chart'), x, y - ms * 0.5, 'rgba(232,196,106,0.95)');
    }
  }

  private zoom = 1;
  private cx = WORLD_SIZE / 2;
  private cy = WORLD_SIZE / 2;
  private drag: { x: number; y: number; cx: number; cy: number } | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private centred = false;

  /** Tasks of the sea (docs/11 P6): each nest, its waters, the minutes left and one's tally. */
  private tasksLog(state: ClientState): string {
    return tasksLog(state, true);
  }

  /** Set by the shell: auto-sail to her mark (docs/16 #36). */
  onAutosail: ((wp: { x: number; y: number }) => void) | null = null;
  /** The Grail's chart (docs/17 H4), once an obelisk is read. */
  onPuzzle: (() => void) | null = null;

  /** Set by the shell: a message to the server (sharing a quest with the group). */
  send: ((m: ClientMsg) => void) | null = null;

  open(root: HTMLElement, state: ClientState): void {
    const tracked = trackedQuest(state.self?.quests)?.id;
    const inGroup = (state.party?.members.length ?? 0) > 1;
    root.innerHTML = `<div class="modal-head"><div><h2>${L('title')}</h2><div class="sub">${L(document.body.classList.contains('touch') ? 'subTouch' : 'sub', { islands: `${state.discovered.size} ${plural(state.discovered.size, L('island.one'), L('island.few'), L('island.many'))}` })}</div></div><div class="muted map-close">${L('close', { key: keyLabel(settings().keys.map[0] || settings().keys.map[1]) })}</div></div>
      <div class="map-wrap"><canvas id="worldmap-canvas"></canvas><div class="map-wp-acts">${this.onAutosail ? `<button class="btn btn-small btn-primary map-wp-sail${waypoint() && !state.self?.dockedAt ? '' : ' hidden'}" title="${esc(EL('as_goTitle'))}">⛵ ${esc(EL('as_go'))}</button>` : ''}<button class="btn btn-small map-wp-clear${waypoint() ? '' : ' hidden'}" title="${esc(L('wp.clearTitle'))}">${icon('goal', '', 'ico-sm')}${esc(L('wp.clear'))}</button>${this.onPuzzle && ((state.adv?.pieces ?? 0) > 0 || state.adv?.grail === 'held') ? `<button class="btn btn-small map-pz">${icon('map_treasure', '', 'ico-sm')}${esc(H4L('puzzle.btn'))}</button>` : ''}</div>
      <details class="map-legend"${localStorage.getItem(LEGEND_KEY) === '1' ? ' open' : ''}><summary>${L('legend')}</summary><div class="lg-items">${LEGEND.map(([id, key]) => `<span>${icon(id, '', 'ico')}${L(key)}</span>`).join('')}<span><b style="color:var(--gold);font-weight:400">⚓</b>&nbsp;${L('lg.sector')}</span>${LEGEND_C.map(([id, key]) => `<span title="${esc(DL('map.demandHint'))}">${icon(id, '', 'ico')}${DL(key)}</span>`).join('')}<span><b style="color:#8fc3e8;font-weight:400">▪▪▪</b>&nbsp;${LS('key.convoy')}</span><span><b style="color:#dfe6f0;font-weight:400">➔</b>&nbsp;${LS('key.front')}</span><span><b style="color:#b0302a;font-weight:400">■</b>&nbsp;${LS('key.lair')}</span><span><b style="color:#cdb98a;font-weight:400">●</b>&nbsp;${LI('tide.legend')}</span><span><b style="color:#d0503a;font-weight:400">▲</b>&nbsp;${LI('look.legend')}</span><span><b style="color:#f5c77a;font-weight:400">✶</b>&nbsp;${LI('light.legend')}</span><span>${icon('map_treasure', '', 'ico')}${LI('cache.chart')}</span><span><b style="color:#e8ce78;font-weight:400">◆</b>&nbsp;${LROAM('lg')}</span>${socialLegend()}${heroLegend()}${isleLegend()}</div></details></div>
      <div class="map-logs">${zoneHint(state)}${(state.self?.maps ?? []).length ? `<div class="map-maps">${(state.self?.maps ?? []).map((m) => mapCard(m)).join('')}${state.self?.legendEcho.length ? `<div class="muted">${L('echo', { holders: `${state.self.legendEcho.length} ${plural(state.self.legendEcho.length, L('holder.one'), L('holder.few'), L('holder.many'))}` })}</div>` : ''}</div>` : ''}
      ${dailyLog(state.self?.daily)}${commonLog(state.self?.common)}${worldGoalsLog(state)}${lfgLog(state)}${this.tasksLog(state)}${(state.self?.quests ?? []).length ? `<div class="map-quests"><div class="mq-head">${icon('goal', '', 'ico-sm')}${esc(L('quests'))}</div>${(state.self?.quests ?? []).map((q) => { const share = inGroup && (q.kind === 'job' || q.kind === 'story'); return `<div class="mq-item"><button class="mq-row${q.target ? '' : ' off'}${q.id === tracked ? ' tracked' : ''}${share ? ' shareable' : ''}" data-q="${esc(q.id)}" title="${esc(L('track'))}"><b>${q.id === tracked ? icon('goal', '◆', 'ico-sm') : ''}${esc(serverText(q.name))}</b><span class="muted">${q.step}/${q.steps} · ${esc(serverText(q.text))}${q.need > 1 ? ` ${q.progress}/${q.need}` : ''}</span></button>${share ? `<button class="btn btn-small mq-share" data-share="${esc(q.id)}" title="${esc(L('shareTitle'))}">${esc(L('share'))}</button>` : ''}</div>`; }).join('')}</div>` : ''}</div>`;
    // The key stays as she left it (folded at first: open, it covered a third of the chart — QA, 2026-10-04).
    root.querySelector<HTMLDetailsElement>('.map-legend')?.addEventListener('toggle', (e) => localStorage.setItem(LEGEND_KEY, (e.currentTarget as HTMLDetailsElement).open ? '1' : '0'));
    // «Where is my level» (docs/18 #29): the chart turns to the zone, and her mark is set on it.
    root.querySelectorAll<HTMLElement>('[data-zone]').forEach((b) => (b.onclick = () => {
      const z = state.zones.find((x) => x.id === Number(b.dataset.zone));
      if (!z) return;
      this.cx = z.x;
      this.cy = z.y;
      this.zoom = Math.max(this.zoom, 3);
      setWaypoint({ x: z.x, y: z.y });
      root.querySelector('.map-wp-clear')?.classList.remove('hidden');
      root.querySelector('.map-wp-sail')?.classList.toggle('hidden', !!state.self?.dockedAt);
      this.draw(state);
    }));
    // A task of the sea in the log: the chart turns to its nest.
    root.querySelectorAll<HTMLElement>('[data-task]').forEach((b) => (b.onclick = () => {
      const t = state.tasks.find((x) => x.id === Number(b.dataset.task));
      if (!t) return;
      this.cx = t.x;
      this.cy = t.y;
      this.zoom = Math.max(this.zoom, 4);
      this.draw(state);
    }));
    // Those looking for company (docs/16 #31): one tap asks to join; the row turns the chart to her.
    if (this.send) wireLfgRows(root, this.send);
    root.querySelectorAll<HTMLElement>('[data-lf-at]').forEach((b) => (b.onclick = () => {
      const [x, y] = b.dataset.lfAt!.split(',').map(Number);
      this.cx = x;
      this.cy = y;
      this.zoom = Math.max(this.zoom, 4);
      this.draw(state);
    }));
    // Share a quest with the group: each groupmate who may take it is asked.
    root.querySelectorAll<HTMLElement>('[data-share]').forEach((b) => (b.onclick = () => this.send?.({ t: 'quest', action: 'share', id: b.dataset.share! })));
    // A quest in the log: it becomes the one followed (the gold mark on the screen's rim), and the chart turns to
    // where its step points.
    root.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => (b.onclick = () => {
      const q = state.self?.quests.find((x) => x.id === b.dataset.q);
      if (!q) return;
      setTracked(q.id);
      root.querySelectorAll('.mq-row.tracked').forEach((r) => r.classList.remove('tracked'));
      b.classList.add('tracked');
      if (!q.target) return;
      this.cx = q.target.x;
      this.cy = q.target.y;
      this.zoom = Math.max(this.zoom, 4);
      this.draw(state);
    }));
    const c = root.querySelector('canvas')!;
    this.canvas = c;
    if (!this.centred && state.ownDisplay) {
      this.cx = state.ownDisplay.x;
      this.cy = state.ownDisplay.y;
      this.zoom = 3;
      this.centred = true;
    }
    c.onwheel = (e) => {
      e.preventDefault();
      this.zoom = Math.max(1, Math.min(14, this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      this.draw(state);
    };
    // Mouse, pen or finger: drag to pan; two fingers pinch to zoom.
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const spread = () => {
      const [p, q] = [...pts.values()];
      return p && q ? Math.hypot(p.x - q.x, p.y - q.y) : 0;
    };
    c.style.touchAction = 'none';
    // A tap (not a pan, not a pinch) sets her mark, or takes it off when it lands on the mark.
    let tap: { id: number; x: number; y: number; t: number } | null = null;
    const clearBtn = root.querySelector<HTMLElement>('.map-wp-clear')!;
    root.querySelector<HTMLElement>('.map-pz')?.addEventListener('click', () => this.onPuzzle?.());
    const sailBtn = root.querySelector<HTMLElement>('.map-wp-sail');
    const showClear = () => {
      clearBtn.classList.toggle('hidden', !waypoint());
      sailBtn?.classList.toggle('hidden', !waypoint() || !!state.self?.dockedAt);
    };
    // docs/16 #36: the helmsman takes her to the mark.
    if (sailBtn) sailBtn.onclick = () => {
      const wp = waypoint();
      if (wp) this.onAutosail?.(wp);
    };
    clearBtn.onclick = () => {
      setWaypoint(null);
      showClear();
      this.draw(state);
    };
    c.onpointerdown = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      tap = pts.size === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null;
      if (pts.size === 1) this.drag = { x: e.clientX, y: e.clientY, cx: this.cx, cy: this.cy };
      else {
        this.drag = null;
        pinch = spread();
      }
    };
    c.onpointermove = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap = null;
      if (pts.size >= 2) {
        const d = spread();
        if (pinch > 0 && d > 0) {
          this.zoom = Math.max(1, Math.min(14, this.zoom * (d / pinch)));
          this.draw(state);
        }
        pinch = d;
      } else if (this.drag) {
        const k = this.scale();
        this.cx = this.drag.cx - (e.clientX - this.drag.x) / k;
        this.cy = this.drag.cy - (e.clientY - this.drag.y) / k;
        this.draw(state);
      }
    };
    c.onpointerup = (e) => {
      const t = tap;
      tap = null;
      if (t && t.id === e.pointerId && pts.size === 1 && performance.now() - t.t < 600 && Math.hypot(e.clientX - t.x, e.clientY - t.y) <= 8) this.tapAt(state, e.clientX, e.clientY, showClear);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
      if (!pts.size) this.drag = null;
    };
    c.onpointercancel = c.onpointerleave = (e) => {
      if (tap?.id === e.pointerId) tap = null;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
      if (!pts.size) this.drag = null;
    };
    this.draw(state);
  }

  /** A tap on the chart at a point of the screen: her mark there, or off when the tap lands on it. */
  private tapAt(state: ClientState, clientX: number, clientY: number, after: () => void): void {
    const c = this.canvas;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const k = this.scale();
    const x = this.cx + (clientX - r.left - c.clientWidth / 2) / k;
    const y = this.cy + (clientY - r.top - c.clientHeight / 2) / k;
    if (x < 0 || y < 0 || x > WORLD_SIZE || y > WORLD_SIZE) return;
    const cur = waypoint();
    const hit = Math.max(18, Math.min(30, 12 + this.zoom * 2)) / k; // the mark's own size on the screen, in metres
    setWaypoint(cur && Math.hypot(cur.x - x, cur.y - y) < hit ? null : { x, y });
    after();
    this.draw(state);
  }

  private scale(): number {
    const c = this.canvas!;
    return (Math.min(c.clientWidth, c.clientHeight) / WORLD_SIZE) * this.zoom;
  }

  draw(state: ClientState): void {
    const c = this.canvas;
    if (!c || !c.isConnected) return;
    // Not laid out yet (the window still opening): nothing to scale the chart to.
    if (!c.clientWidth || !c.clientHeight) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = c.clientWidth, H = c.clientHeight;
    const k = this.scale();
    const keep = (v: number, half: number) => (WORLD_SIZE > 2 * half ? Math.max(half, Math.min(WORLD_SIZE - half, v)) : WORLD_SIZE / 2);
    this.cx = keep(this.cx, W / 2 / k);
    this.cy = keep(this.cy, H / 2 / k);
    const tx = (x: number) => (x - this.cx) * k + W / 2;
    const ty = (y: number) => (y - this.cy) * k + H / 2;
    // Painted chart symbols (Higgsfield `icon.map_*`, faction crests); the old ink shapes only while they load.
    const ms = Math.max(20, Math.min(34, 18 + this.zoom * 2));
    const mark = (id: string, x: number, y: number, size = ms, rot = 0): boolean => {
      const art = sprite(id);
      if (!art) return false;
      g.save();
      g.translate(x, y);
      if (rot) g.rotate(rot);
      g.drawImage(art.img, -size / 2, -size / 2, size, size);
      g.restore();
      return true;
    };
    // Labels never pile on each other: the ports and her own mark first, then the rest as they come; a later one that
    // would cover an earlier waits for a closer zoom. They are gathered and laid down over all the marks at the end —
    // the tides' and lookouts' long lines were drawn before the ports and took their names' places (QA, 2026-10-04).
    const queued: { text: string; x: number; y: number; color: string; font: string; align: CanvasTextAlign; prio: number }[] = [];
    const label = (text: string, x: number, y: number, color = 'rgba(240,230,200,0.85)', prio = 1) => {
      // One whose mark is off the chart is not drawn at all (it would stand at the edge with nothing under it).
      if (x < -4 || x > W + 4) return;
      queued.push({ text, x, y, color, font: g.font, align: g.textAlign, prio });
    };
    const layLabels = () => {
      const placed: [number, number, number, number][] = [];
      for (const q of queued.map((q, i) => ({ q, i })).sort((a, b) => a.q.prio - b.q.prio || a.i - b.i).map((e) => e.q)) {
        g.save();
        g.font = q.font;
        const w = g.measureText(q.text).width;
        // A label by the chart's edge slides inward rather than being cut by it.
        const want = q.align === 'center' ? q.x - w / 2 : q.align === 'right' ? q.x - w : q.x;
        const x0 = w + 8 < W ? Math.max(4, Math.min(W - w - 4, want)) : want;
        const box: [number, number, number, number] = [x0 - 2, q.y - 12, x0 + w + 2, q.y + 4];
        if (!placed.some((b) => box[0] < b[2] && b[0] < box[2] && box[1] < b[3] && b[1] < box[3])) {
          placed.push(box);
          g.textAlign = 'left';
          g.fillStyle = 'rgba(0,0,0,0.55)';
          g.fillText(q.text, x0 + 1, q.y + 1);
          g.fillStyle = q.color;
          g.fillText(q.text, x0, q.y);
        }
        g.restore();
      }
    };
    const chart = sprite('tex.chart');
    g.fillStyle = '#070a0e';
    g.fillRect(0, 0, W, H);
    if (chart) {
      g.globalAlpha = 0.9;
      // The painting is wider than the square world: take its middle square, so the compass rose stays round.
      const iw = chart.img.naturalWidth || chart.img.width, ih = chart.img.naturalHeight || chart.img.height;
      const side = Math.min(iw, ih);
      g.drawImage(chart.img, (iw - side) / 2, (ih - side) / 2, side, side, tx(0), ty(0), WORLD_SIZE * k, WORLD_SIZE * k);
      g.globalAlpha = 1;
    }
    // Grid.
    g.strokeStyle = 'rgba(176,141,87,0.12)';
    g.lineWidth = 1;
    for (let v = 0; v <= WORLD_SIZE; v += 8000) {
      g.beginPath();
      g.moveTo(tx(v), ty(0));
      g.lineTo(tx(v), ty(WORLD_SIZE));
      g.moveTo(tx(0), ty(v));
      g.lineTo(tx(WORLD_SIZE), ty(v));
      g.stroke();
    }
    // The squares of the sea (docs/16 P2), faint: a wash by their level and the level in a corner, a pocket marked.
    if (state.sectors.length) {
      const side = SECTOR_SIZE * k;
      const own = state.self ? shipLevelOf(state.self.loadout) : 1;
      g.font = `${Math.round(Math.max(9, Math.min(13, side * 0.16)))}px Inter, sans-serif`;
      g.textAlign = 'left';
      state.sectors.forEach((sec, i) => {
        const sx = i % SECTORS_PER_SIDE, sy = Math.floor(i / SECTORS_PER_SIDE);
        const x = tx(sx * SECTOR_SIZE), y = ty(sy * SECTOR_SIZE);
        if (x > W || y > H || x + side < 0 || y + side < 0) return;
        const t = (sec.l - 1) / 9;
        g.fillStyle = `rgba(${Math.round(90 + 150 * t)},${Math.round(170 - 110 * t)},${Math.round(110 - 60 * t)},0.07)`;
        g.fillRect(x, y, side, side);
        if (side < 26) return;
        const band = bandOf(sec.l);
        g.fillStyle = THREAT_COLOR[threatOf(own, sec.l)];
        g.globalAlpha = 0.55;
        g.fillText(`⚓${band[0]}–${band[1]}${sec.p === 'calm' ? ' ☼' : sec.p === 'wild' ? ' ☠' : ''}`, x + 4, y + Math.max(11, side * 0.18));
        g.globalAlpha = 1;
      });
    }
    // Maelstrom wall.
    g.strokeStyle = 'rgba(142,42,42,0.28)';
    g.lineWidth = 1.2;
    g.strokeRect(tx(2500), ty(2500), (WORLD_SIZE - 5000) * k, (WORLD_SIZE - 5000) * k);
    // Currents (common sailor knowledge).
    g.strokeStyle = 'rgba(143,179,217,0.22)';
    g.fillStyle = 'rgba(143,179,217,0.4)';
    g.lineWidth = 1.2;
    g.lineJoin = 'round';
    for (const cur of state.currents) {
      g.beginPath();
      cur.points.forEach(([x, y], i) => (i ? g.lineTo(tx(x), ty(y)) : g.moveTo(tx(x), ty(y))));
      g.stroke();
      // Small chevrons show which way the water runs.
      for (let i = 1; i < cur.points.length; i += 2) {
        const [ax, ay] = cur.points[i - 1], [bx, by] = cur.points[i];
        const mx = tx((ax + bx) / 2), my = ty((ay + by) / 2), a = Math.atan2(ty(by) - ty(ay), tx(bx) - tx(ax));
        g.beginPath();
        g.moveTo(mx + Math.cos(a) * 5, my + Math.sin(a) * 5);
        g.lineTo(mx + Math.cos(a + 2.5) * 5, my + Math.sin(a + 2.5) * 5);
        g.lineTo(mx + Math.cos(a - 2.5) * 5, my + Math.sin(a - 2.5) * 5);
        g.fill();
      }
    }
    // Region names: only regions the captain has entered are named.
    g.textAlign = 'center';
    for (const id of REGION_IDS) {
      const r = REGIONS[id];
      g.font = `${Math.round(Math.max(12, 16 * Math.sqrt(this.zoom)))}px "IM Fell English SC", serif`;
      g.fillStyle = id === state.region ? 'rgba(224,184,98,0.55)' : 'rgba(216,210,196,0.22)';
      // A region's name by the chart's edge slides inward instead of being cut.
      const name = r.name.toUpperCase(), half = g.measureText(name).width / 2, x = tx(r.center[0]);
      const lx = half * 2 + 8 < W && x > 0 && x < W ? Math.max(4 + half, Math.min(W - 4 - half, x)) : x;
      g.fillText(name, lx, ty(r.center[1]));
      // The heat of its lanes (docs/12 P6): raids make the League send escorts and the goods dear.
      const heat = state.raid?.heat[id] ?? 0;
      if (heat >= 10) {
        g.font = `${Math.round(Math.max(11, 12 * Math.sqrt(this.zoom)))}px Inter, sans-serif`;
        g.fillStyle = heat >= 60 ? 'rgba(232,90,64,0.95)' : heat >= 40 ? 'rgba(232,140,64,0.9)' : 'rgba(232,190,110,0.8)';
        g.fillText(L('heatLabel', { n: heat }), lx, ty(r.center[1]) + Math.round(Math.max(14, 18 * Math.sqrt(this.zoom))));
      }
    }
    // One's own caravans (docs/12 P8): the leg under way, dashed, and where she is.
    for (const cv of state.caravans) {
      if (cv.path.length > 1) {
        g.setLineDash([6, 5]);
        g.strokeStyle = cv.attack !== null ? 'rgba(224,90,70,0.85)' : 'rgba(111,212,111,0.7)';
        g.lineWidth = 1.5;
        g.beginPath();
        cv.path.forEach(([px, py], i) => (i ? g.lineTo(tx(px), ty(py)) : g.moveTo(tx(px), ty(py))));
        g.stroke();
        g.setLineDash([]);
      }
      g.fillStyle = cv.attack !== null ? '#e05a46' : '#6fd46f';
      g.fillRect(tx(cv.x) - 4, ty(cv.y) - 4, 8, 8);
    }
    // The League convoys she knows of (docs/16 #6): heard of as they sailed, seen, or escorted — the route from port
    // to port dashed, the column where it is, its level and harbour; hers in gold, one under fire in red.
    for (const cv of state.raid?.known ?? []) {
      const col = cv.raided ? '#e05a46' : cv.mine ? '#f2c14e' : '#8fc3e8';
      g.setLineDash([7, 5]);
      g.strokeStyle = cv.raided ? 'rgba(224,90,70,0.8)' : cv.mine ? 'rgba(242,193,78,0.8)' : 'rgba(143,195,232,0.65)';
      g.lineWidth = 1.6;
      g.beginPath();
      cv.route.forEach(([px, py], i) => (i ? g.lineTo(tx(px), ty(py)) : g.moveTo(tx(px), ty(py))));
      g.stroke();
      g.setLineDash([]);
      const [ex, ey] = cv.route[cv.route.length - 1];
      g.strokeStyle = col;
      g.beginPath();
      g.arc(tx(ex), ty(ey), 5, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 1;
      g.fillStyle = col;
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.rect(tx(cv.x) - 3.5 + (i - 1) * 7, ty(cv.y) - 3.5, 7, 7);
        g.fill();
        g.stroke();
      }
      g.font = '600 11px Inter, sans-serif';
      g.textAlign = 'center';
      label(`${LS('cv.label', { level: cv.level, to: placeName(cv.to) })} · ${LS('cv.hulls', { n: cv.hulls, size: cv.size })}`, tx(cv.x), ty(cv.y) - Math.max(12, ms * 0.8), col); // above her own mark when she sails with it
    }
    // The pirate lairs near her (docs/16 #7): red while its battery stands, gold when open to a landing.
    for (const l of state.wanted?.lairs ?? []) {
      g.fillStyle = l.open ? '#e8c46a' : l.stormed ? '#777' : l.hp > 0 ? '#b0302a' : '#d08a40';
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.fillRect(tx(l.x) - 5, ty(l.y) - 5, 10, 10);
      g.strokeRect(tx(l.x) - 5, ty(l.y) - 5, 10, 10);
      g.font = '600 11px Inter, sans-serif';
      g.textAlign = 'center';
      if (this.zoom >= 3.5) label(LS('lair.label', { captain: serverText(l.captain), level: l.level }), tx(l.x), ty(l.y) - 9, 'rgba(232,150,130,0.95)');
    }
    // docs/19 D7: the roaming stacks about her, close in only (a small diamond in the ladder's colour; the map stays
    // readable from afar).
    if (this.zoom >= 2) drawRoamsChart(g, state, tx, ty);
    // Charted islands.
    for (const id of state.discovered) {
      const is = state.islands.get(id);
      if (!is) continue;
      g.beginPath();
      for (let i = 0; i < is.poly.length; i += 2) {
        if (i === 0) g.moveTo(tx(is.poly[i]), ty(is.poly[i + 1]));
        else g.lineTo(tx(is.poly[i]), ty(is.poly[i + 1]));
      }
      g.closePath();
      g.fillStyle = isleFill(is, REGIONS[is.region].strangeness > 0.4); // her kind's colour (docs/18 #27)
      g.fill();
      g.strokeStyle = 'rgba(216,210,196,0.5)';
      g.lineWidth = 0.8;
      g.stroke();
      if (this.zoom > 4 && is.r > 150) {
        g.font = `italic 11px "Cormorant Garamond", serif`;
        g.fillStyle = 'rgba(216,210,196,0.6)';
        g.fillText(placeName(is.name), tx(is.x), ty(is.y) + 3);
      }
    }
    // Batch E of docs/16: the shoals she knows (streamed, or charted from a lookout), the lit lights and their reach,
    // the lookouts, the banks standing above the sea now, and her own buried chests.
    this.drawIsles(g, state, tx, ty, k, ms, label, mark);
    // docs/18 III: the zones of one level, the islands' levels, the hidden found, the turtles, the banks under water.
    drawSupplyRoutes(g, state, tx, ty);
    drawIslesChart(g, state, tx, ty, k, this.zoom, ms, label);
    // Ports: key ports are on every chart; villages only once found.
    for (const p of state.ports) {
      const known = !p.id.includes('_v') || [...state.discovered].some((id) => state.islands.get(id)?.portId === p.id);
      if (!known) continue;
      if (!mark(`icon.faction_${p.faction}`, tx(p.x), ty(p.y), ms * 0.95)) {
        g.fillStyle = FACTIONS[p.faction].lantern;
        g.fillRect(tx(p.x) - 4, ty(p.y) - 4, 8, 8);
      }
      g.font = `${this.zoom > 2 ? 13 : 11}px "IM Fell English SC", serif`;
      label(placeName(p.name), tx(p.x), ty(p.y) - ms * 0.55, undefined, 0);
    }
    // The Flying Dutchman's lanterns not yet visited, and his island once she has all five pages (docs/12 P10 #10).
    for (const pg of state.dutchman?.pages ?? []) {
      if (pg.taken) continue;
      const x = tx(pg.x), y = ty(pg.y);
      g.fillStyle = 'rgba(120,255,160,0.9)';
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(x, y, ms * 0.22, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    if (state.dutchman?.battle) {
      const x = tx(state.dutchman.battle.x), y = ty(state.dutchman.battle.y);
      g.strokeStyle = 'rgba(120,255,160,0.95)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, ms * 0.45, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(x - ms * 0.25, y - ms * 0.25); g.lineTo(x + ms * 0.25, y + ms * 0.25); g.moveTo(x + ms * 0.25, y - ms * 0.25); g.lineTo(x - ms * 0.25, y + ms * 0.25); g.stroke();
    }
    // The wonders she has found (docs/12 P10 #8): a gold star each.
    for (const w of state.wonders?.found ?? []) {
      const x = tx(w.x), y = ty(w.y);
      g.fillStyle = '#e8c46a';
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? ms * 0.14 : ms * 0.32;
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.closePath();
      g.stroke();
      g.fill();
    }
    // Sunken cities and graveyards.
    for (const s of state.pveSites) {
      if (!mark(s.kind === 'city' ? 'icon.map_city' : 'icon.map_graveyard', tx(s.x), ty(s.y))) {
        g.strokeStyle = s.kind === 'city' ? '#2ee6c8' : '#a0784f';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(tx(s.x), ty(s.y), Math.max(5, (s.kind === 'city' ? 250 : s.r) * k), 0, Math.PI * 2);
        g.stroke();
      }
      g.font = `italic 11px "Cormorant Garamond", serif`;
      label(placeName(s.name), tx(s.x), ty(s.y) - ms * 0.6, 'rgba(200,220,210,0.9)');
    }
    // World events: a flag on the place, and its title.
    for (const e of state.events) {
      const x = tx(e.x), y = ty(e.y);
      if (!mark(e.kind === 'storm_century' ? 'icon.map_storm' : 'icon.map_event', x, y, ms * 1.1)) {
        g.strokeStyle = e.kind === 'epidemic' ? '#d8c94a' : e.kind === 'storm_century' ? '#8fb3d9' : e.kind === 'new_island' ? '#e0874a' : '#d06a5e';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, 10, 0, Math.PI * 2);
        g.stroke();
      }
      g.font = `italic 12px "Cormorant Garamond", serif`;
      label(placeName(e.title), x, y + ms * 0.8, 'rgba(240,200,180,0.95)');
    }
    // Maelstroms and weather fronts; the Navigator's forecast shows where storms will be in 10 minutes.
    for (const w of state.whirlpools) {
      if (!mark('icon.map_whirlpool', tx(w.x), ty(w.y), Math.max(ms * 0.9, w.radius * k * 2))) {
        g.strokeStyle = 'rgba(208,106,94,0.7)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(tx(w.x), ty(w.y), Math.max(4, w.radius * k), 0, Math.PI * 2);
        g.stroke();
      }
      g.font = 'italic 11px "Cormorant Garamond", serif';
      label(placeName(w.name), tx(w.x), ty(w.y) - Math.max(ms * 0.5, w.radius * k) - 3, 'rgba(220,140,120,0.9)');
    }
    for (const f of state.fronts) {
      const rr = f.r * k;
      const tint = f.kind === 'black_storm' ? '46,230,200' : f.kind === 'storm' ? '150,158,178' : '170,180,185';
      const stain = g.createRadialGradient(tx(f.x), ty(f.y), 0, tx(f.x), ty(f.y), rr);
      stain.addColorStop(0, `rgba(${tint},0.2)`);
      stain.addColorStop(1, `rgba(${tint},0)`);
      g.fillStyle = stain;
      g.beginPath();
      g.arc(tx(f.x), ty(f.y), rr, 0, Math.PI * 2);
      g.fill();
      if (!mark(f.kind === 'fog' ? 'icon.weather_fog' : f.kind === 'rain' ? 'icon.weather_storm' : 'icon.map_storm', tx(f.x), ty(f.y), ms)) {
        g.font = '10px Inter, sans-serif';
        g.fillStyle = 'rgba(216,210,196,0.7)';
        g.fillText(L(`front.${f.kind}`), tx(f.x), ty(f.y));
      }
      // Where it drifts (docs/16 #10): an arrow for everyone, ten minutes of it; the Navigator's forecast also marks
      // where the storm will be.
      if (f.vx || f.vy) {
        const t = state.forecast ? Math.min(600, f.ttl) : 600;
        const x0 = tx(f.x), y0 = ty(f.y), x1 = tx(f.x + f.vx * t), y1 = ty(f.y + f.vy * t);
        const a = Math.atan2(y1 - y0, x1 - x0), len = Math.max(ms * 0.9, Math.hypot(x1 - x0, y1 - y0));
        const ex = x0 + Math.cos(a) * len, ey = y0 + Math.sin(a) * len;
        const warned = state.frontWarn?.id === f.id;
        g.strokeStyle = warned ? 'rgba(255,122,90,0.95)' : f.kind === 'storm' || f.kind === 'black_storm' ? 'rgba(223,230,240,0.85)' : 'rgba(143,179,217,0.7)';
        g.fillStyle = g.strokeStyle;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x0 + Math.cos(a) * ms * 0.5, y0 + Math.sin(a) * ms * 0.5);
        g.lineTo(ex, ey);
        g.stroke();
        g.beginPath();
        g.moveTo(ex + Math.cos(a) * 7, ey + Math.sin(a) * 7);
        g.lineTo(ex + Math.cos(a + 2.5) * 8, ey + Math.sin(a + 2.5) * 8);
        g.lineTo(ex + Math.cos(a - 2.5) * 8, ey + Math.sin(a - 2.5) * 8);
        g.closePath();
        g.fill();
        g.lineWidth = 1;
        if (state.forecast) mark('icon.map_storm', x1, y1, ms * 0.7);
        if (warned) {
          g.setLineDash([6, 4]);
          g.lineWidth = 2;
          g.beginPath();
          g.arc(x0, y0, rr, 0, Math.PI * 2);
          g.stroke();
          g.setLineDash([]);
          g.lineWidth = 1;
          g.font = '600 12px Inter, sans-serif';
          g.textAlign = 'center';
          const n = Math.max(1, Math.round((state.frontWarn!.sec - (performance.now() - state.frontsAt) / 1000) / 60));
          label(LS('front.chart', { n }), x0, y0 + ms * 0.9, 'rgba(255,150,120,0.95)');
        }
      }
    }
    // Market knowledge: every visited port carries the age of what you know about it.
    const now = state.estServerTime();
    const age = (t: number) => {
      const m = Math.max(0, Math.round((now - t) / 60));
      return m < 1 ? L('age.now') : m < 60 ? L('age.min', { n: m }) : L('age.h', { n: Math.round(m / 60) });
    };
    g.textAlign = 'left';
    for (const it of state.self?.intel ?? []) {
      const p = state.ports.find((q) => q.id === it.portId);
      if (!p) continue;
      const fresh = Math.max(0.25, 1 - (now - it.t) / 5400); // knowledge fades over ~1.5 h
      // What is dear and cheap there (docs/16 #11): small goods by the crest, faded with the knowledge's age.
      const dm = Math.max(15, Math.min(24, 11 + this.zoom * 2));
      const marked = this.zoom >= 1.3 && !!(it.dear?.length || it.cheap?.length);
      if (marked) demandMarks(g, it, tx(p.x) + ms * 0.55, ty(p.y), dm, fresh);
      // Price notes only at a closer zoom, and only where they fit (under the marks when there are any).
      if (this.zoom < 1.6) continue;
      g.font = '10px Inter, sans-serif';
      label(it.heard ? DL('map.heard', { age: age(it.t) }) : L('prices', { age: age(it.t) }), tx(p.x) + ms * 0.55, ty(p.y) + (marked ? dm * 2.05 + 6 : ms * 0.15), `rgba(143,179,217,${0.85 * fresh})`);
      if (this.zoom > 1.8) {
        it.top.forEach(([good, price], i) => {
          g.fillStyle = `rgba(224,184,98,${0.9 * fresh})`;
          g.fillText(`${GOODS[good].name} ${price}`, tx(p.x) + ms * 0.55, ty(p.y) + (marked ? dm * 2.05 + 6 : ms * 0.15) + 12 + i * 11);
        });
      }
    }
    // Last known positions of notable ships.
    for (const sg of state.self?.sightings ?? []) {
      const x = tx(sg.x), y = ty(sg.y);
      const fresh = Math.max(0.3, 1 - (now - sg.t) / 3600);
      g.strokeStyle = sg.kind === 'ghost' ? `rgba(46,230,200,${fresh})` : `rgba(208,106,94,${fresh})`;
      g.globalAlpha = fresh;
      const drawn = mark(sg.kind === 'ghost' ? 'icon.map_monster' : 'icon.danger', x, y, ms * 0.85);
      g.globalAlpha = 1;
      if (!drawn) {
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x - 5, y - 5);
        g.lineTo(x + 5, y + 5);
        g.moveTo(x + 5, y - 5);
        g.lineTo(x - 5, y + 5);
        g.stroke();
      }
      g.font = 'italic 11px "Cormorant Garamond", serif';
      label(L('seen', { name: placeName(sg.name), age: age(sg.t) }), x + 8, y - 6, sg.kind === 'ghost' ? `rgba(46,230,200,${fresh})` : `rgba(208,106,94,${fresh})`);
    }
    g.textAlign = 'center';
    // Contract destinations.
    for (const ct of state.self?.contracts ?? []) {
      const p = state.ports.find((q) => q.id === ct.toPort);
      if (!p) continue;
      if (mark('icon.map_contract', tx(p.x) + ms * 0.6, ty(p.y) - ms * 0.6, ms * 0.8)) continue;
      g.fillStyle = '#d06a5e';
      g.beginPath();
      g.moveTo(tx(p.x), ty(p.y) - 12);
      g.lineTo(tx(p.x) + 6, ty(p.y) - 6);
      g.lineTo(tx(p.x), ty(p.y));
      g.lineTo(tx(p.x) - 6, ty(p.y) - 6);
      g.fill();
    }
    // Extraction sites you hold: a gold square with the stockpile.
    g.font = '11px "Cormorant Garamond", serif';
    for (const st of state.self?.sites ?? []) {
      g.fillStyle = '#d9b45a';
      g.fillRect(tx(st.x) - 4, ty(st.y) - 4, 8, 8);
      g.fillText(`${GOODS[st.good]?.name ?? st.good.replace('_', ' ')} ${st.stock}/${st.capacity}`, tx(st.x), ty(st.y) + 16);
    }
    // Treasure maps: the search circle; sunken wrecks you know of.
    for (const m of state.self?.maps ?? []) {
      if (m.r < 0) continue; // riddles, drawings and needles draw no area
      const rr = Math.max(8, m.r * k);
      const area = g.createRadialGradient(tx(m.x), ty(m.y), 0, tx(m.x), ty(m.y), rr);
      area.addColorStop(0, 'rgba(217,180,90,0.18)');
      area.addColorStop(1, 'rgba(217,180,90,0)');
      g.fillStyle = area;
      g.beginPath();
      g.arc(tx(m.x), ty(m.y), rr, 0, Math.PI * 2);
      g.fill();
      mark('icon.map_treasure', tx(m.x), ty(m.y), ms);
      label(placeName(m.name), tx(m.x), ty(m.y) - ms * 0.65, m.tier >= 3 ? '#e8c65a' : '#c9a25a');
    }
    // The tavern's whispers she paid for (docs/16 #14) and her merchants' runs (#12).
    hearsayMarks(g, state.self?.hearsay ?? [], tx, ty, k, ms, now, mark, label, age);
    for (const r of state.self?.runs ?? []) {
      const p = state.ports.find((q) => q.id === r.to);
      if (!p) continue;
      mark(`icon.good_${r.good}`, tx(p.x) - ms * 0.62, ty(p.y) - ms * 0.62, ms * 0.7);
      g.font = '600 11px Inter, system-ui, sans-serif';
      label(DL('map.run', { good: GOODS[r.good].name, min: Math.max(0, Math.ceil((r.deadline - now) / 60)) }), tx(p.x), ty(p.y) + ms * 0.95, '#f0d48e');
    }
    for (const w of state.self?.wrecks ?? []) {
      g.strokeStyle = '#78bec8';
      g.fillStyle = '#78bec8';
      if (!mark('icon.map_wreck', tx(w.x), ty(w.y), ms * 0.85)) {
        g.beginPath();
        g.moveTo(tx(w.x) - 4, ty(w.y) - 4);
        g.lineTo(tx(w.x) + 4, ty(w.y) + 4);
        g.moveTo(tx(w.x) + 4, ty(w.y) - 4);
        g.lineTo(tx(w.x) - 4, ty(w.y) + 4);
        g.stroke();
      }
      label(L('wreck', { name: placeName(w.name), depth: w.depth }), tx(w.x), ty(w.y) + ms * 0.75, '#9fd0d8');
    }
    // Hidden coves you know.
    for (const c of state.self?.coves ?? []) {
      if (!mark('icon.map_cove', tx(c.x), ty(c.y), ms * 0.85)) {
        g.fillStyle = '#6fbf8f';
        g.beginPath();
        g.arc(tx(c.x), ty(c.y), 4, 0, Math.PI * 2);
        g.fill();
      }
      label(placeName(c.name), tx(c.x), ty(c.y) - ms * 0.55, '#8fd0a8');
    }
    // Tasks of the sea: the nest's reach in orange, and its name, time and tally.
    const gone = (performance.now() - state.tasksAt) / 1000;
    for (const t of state.tasks) {
      const x = tx(t.x), y = ty(t.y);
      // Nests in orange, wreck fields in the teal of the sea's salvage.
      const [cr, cg, cb] = t.kind === 'wreck' ? [80, 200, 190] : t.kind === 'haunt' ? [170, 130, 230] : [232, 140, 64];
      g.strokeStyle = t.done ? 'rgba(150,150,150,0.6)' : `rgba(${cr},${cg},${cb},0.9)`;
      g.fillStyle = t.done ? 'rgba(120,120,120,0.08)' : `rgba(${cr},${cg},${cb},0.12)`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, Math.max(7, t.r * k), 0, Math.PI * 2);
      g.fill();
      g.stroke();
      if (!mark(t.kind === 'wreck' ? 'icon.map_wreck' : t.kind === 'haunt' ? 'icon.map_monster' : 'icon.danger', x, y, ms * 0.9)) {
        g.fillStyle = t.kind === 'wreck' ? '#50c8be' : t.kind === 'haunt' ? '#aa82e6' : '#e88c40';
        g.font = '700 14px Inter, system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText('!', x, y + 5);
      }
      g.font = '600 11px Inter, system-ui, sans-serif';
      const m = Math.max(0, Math.ceil((t.endsIn - gone) / 60));
      label(`${serverText(taskName(t.kind, t.island))} · ${t.done ? L('taskDone') : L('taskRow', { m, k: t.mine, n: t.need })}`, x, y + ms * 0.9, t.done ? '#b8b8b8' : t.kind === 'wreck' ? '#8fe0d8' : t.kind === 'haunt' ? '#c9b0f0' : '#f2b27a');
    }
    // Where the quests point: a gold mark and the quest's name.
    for (const q of state.self?.quests ?? []) {
      if (!q.target) continue;
      const x = tx(q.target.x), y = ty(q.target.y);
      if (!mark('icon.goal', x, y, ms)) {
        g.fillStyle = '#e0b862';
        g.beginPath();
        g.moveTo(x, y - 8);
        g.lineTo(x + 6, y);
        g.lineTo(x, y + 8);
        g.lineTo(x - 6, y);
        g.closePath();
        g.fill();
      }
      g.font = '600 11px Inter, system-ui, sans-serif';
      label(serverText(q.name), x, y + ms * 0.8, '#f0d48e');
    }
    // Your islands: a gold flag.
    for (const h of state.holdings.mine) {
      g.fillStyle = '#e0b862';
      g.beginPath();
      g.moveTo(tx(h.x), ty(h.y) - 12);
      g.lineTo(tx(h.x) + 9, ty(h.y) - 8);
      g.lineTo(tx(h.x), ty(h.y) - 4);
      g.closePath();
      g.fill();
      g.fillRect(tx(h.x) - 1, ty(h.y) - 12, 2, 12);
      label(placeName(h.name), tx(h.x), ty(h.y) + 12, '#e0b862');
    }
    drawMines(g, state, tx, ty, this.zoom, ms, mark, label); // the mines and their flags (docs/17 H3)
    drawHeroSites(g, state, tx, ty, this.zoom, ms, mark, label); // guilds, artifact merchants, drowned shrines (docs/17 H5)
    drawAdvChart(g, state, tx, ty, this.zoom, ms, mark, label); // the guards and the things on the map (docs/17 H4)
    // Your group.
    g.font = '12px serif';
    for (const m of state.party?.members ?? []) {
      if (m.name === state.self?.name || m.docked) continue;
      const col = m.online ? '#7fd08a' : 'rgba(127,208,138,0.45)';
      g.fillStyle = col;
      g.fillRect(tx(m.x) - 4, ty(m.y) - 4, 8, 8);
      label(m.name, tx(m.x), ty(m.y) - 9, col);
    }
    // Captains looking for company (docs/16 #31): a pennant in the goal's colour, the goal and levels under it.
    for (const e of state.lfg) {
      if (!e.goal || e.x === undefined || e.y === undefined) continue;
      const x = tx(e.x), y = ty(e.y);
      drawLfgFlag(g, x, y, e.goal, 1.3);
      if (this.zoom >= 2) label(`${e.name} · ${lfgLabel(`${e.goal}:${e.lo}-${e.hi}`) ?? ''}`, x, y + 12, e.fits === false ? 'rgba(200,190,170,0.6)' : '#efe1b8');
    }
    // Groupmates' signal flags (docs/16 #35): a pennant and a ring pulsing out while it lasts.
    for (const sg of liveSignals(state)) {
      drawSignalFlag(g, tx(sg.x), ty(sg.y), sg.kind, sg.age, 1.4);
      label(`${sg.from}: ${signalName(sg.kind)}`, tx(sg.x), ty(sg.y) - 20, '#efe1b8');
    }
    // Her own mark: a dashed course from the ship, a gold pennant on a pole in a pulsing ring, and the range.
    const wp = waypoint();
    const own = state.ownDisplay;
    // Reached while the chart is open: its button goes too.
    c.parentElement?.querySelector('.map-wp-clear')?.classList.toggle('hidden', !wp);
    if (wp) {
      const x = tx(wp.x), y = ty(wp.y);
      if (own) {
        g.save();
        g.setLineDash([5, 6]);
        g.strokeStyle = 'rgba(232,196,106,0.75)';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(tx(own.x), ty(own.y));
        g.lineTo(x, y);
        g.stroke();
        g.restore();
      }
      g.strokeStyle = 'rgba(232,196,106,0.9)';
      g.fillStyle = 'rgba(232,196,106,0.14)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, ms * 0.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#e8c46a';
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x, y + ms * 0.12);
      g.lineTo(x, y - ms * 0.62);
      g.lineTo(x + ms * 0.42, y - ms * 0.47);
      g.lineTo(x, y - ms * 0.3);
      g.closePath();
      g.stroke();
      g.fill();
      g.beginPath();
      g.arc(x, y + ms * 0.12, 2.5, 0, Math.PI * 2);
      g.fill();
      const d = own ? Math.hypot(wp.x - own.x, wp.y - own.y) : 0;
      g.font = '600 12px Inter, system-ui, sans-serif';
      g.textAlign = 'center';
      label(L('wp.label', { d: d >= 1000 ? RL('dist.km', { n: dec1(d / 1000) }) : RL('dist.m', { n: Math.round(d / 10) * 10 }) }), x, y + ms * 0.95, '#f0d48e', 0);
    }
    layLabels();
    // You.
    if (own) {
      // What your lookouts can see: a soft pool of light around you.
      const sight = g.createRadialGradient(tx(own.x), ty(own.y), 0, tx(own.x), ty(own.y), Math.max(12, 2200 * k));
      sight.addColorStop(0, 'rgba(240,230,200,0.12)');
      sight.addColorStop(1, 'rgba(240,230,200,0)');
      g.fillStyle = sight;
      g.beginPath();
      g.arc(tx(own.x), ty(own.y), Math.max(12, 2200 * k), 0, Math.PI * 2);
      g.fill();
      if (!mark('icon.map_ship', tx(own.x), ty(own.y), ms * 1.2, own.heading)) {
        g.save();
        g.translate(tx(own.x), ty(own.y));
        g.rotate(own.heading);
        g.fillStyle = '#f0e6c8';
        g.beginPath();
        g.moveTo(0, -9);
        g.lineTo(6, 7);
        g.lineTo(-6, 7);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
  }
}
