// World map: a dark nautical chart. Only what the captain has charted is drawn — information is a resource.

import { icon } from './dom.ts';
import { WORLD_SIZE } from '../../../shared/src/constants.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import { sprite } from '../assets.ts';
import type { ClientState } from '../state.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { setTracked, trackedQuest } from './track.ts';
import { commonLog, dailyLog } from './daily.ts';
import { dict, plural } from '../i18n.ts';
import { EN, RU } from '../lang/ui/worldmap.ts';
import { keyLabel, settings } from '../settings.ts';
import { mapCard, placeName } from './maps.ts';
import { esc } from './dom.ts';
import { serverText } from '../lang/server.ts';
import { taskName } from '../../../shared/src/data/worldtasks.ts';

const L = dict(EN, RU);

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

export class WorldMap {
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

  /** Set by the shell: a message to the server (sharing a quest with the group). */
  send: ((m: ClientMsg) => void) | null = null;

  open(root: HTMLElement, state: ClientState): void {
    const tracked = trackedQuest(state.self?.quests)?.id;
    const inGroup = (state.party?.members.length ?? 0) > 1;
    root.innerHTML = `<div class="modal-head"><div><h2>${L('title')}</h2><div class="sub">${L(document.body.classList.contains('touch') ? 'subTouch' : 'sub', { islands: `${state.discovered.size} ${plural(state.discovered.size, L('island.one'), L('island.few'), L('island.many'))}` })}</div></div><div class="muted map-close">${L('close', { key: keyLabel(settings().keys.map[0] || settings().keys.map[1]) })}</div></div>
      <div class="map-wrap"><canvas id="worldmap-canvas"></canvas>
      <details class="map-legend"${innerHeight > 520 && innerWidth >= 700 ? ' open' : ''}><summary>${L('legend')}</summary><div class="lg-items">${LEGEND.map(([id, key]) => `<span>${icon(id, '', 'ico')}${L(key)}</span>`).join('')}</div></details></div>
      <div class="map-logs">${(state.self?.maps ?? []).length ? `<div class="map-maps">${(state.self?.maps ?? []).map((m) => mapCard(m)).join('')}${state.self?.legendEcho.length ? `<div class="muted">${L('echo', { holders: `${state.self.legendEcho.length} ${plural(state.self.legendEcho.length, L('holder.one'), L('holder.few'), L('holder.many'))}` })}</div>` : ''}</div>` : ''}
      ${dailyLog(state.self?.daily)}${commonLog(state.self?.common)}${this.tasksLog(state)}${(state.self?.quests ?? []).length ? `<div class="map-quests"><div class="mq-head">${icon('goal', '', 'ico-sm')}${esc(L('quests'))}</div>${(state.self?.quests ?? []).map((q) => { const share = inGroup && (q.kind === 'job' || q.kind === 'story'); return `<div class="mq-item"><button class="mq-row${q.target ? '' : ' off'}${q.id === tracked ? ' tracked' : ''}${share ? ' shareable' : ''}" data-q="${esc(q.id)}" title="${esc(L('track'))}"><b>${q.id === tracked ? icon('goal', '◆', 'ico-sm') : ''}${esc(serverText(q.name))}</b><span class="muted">${q.step}/${q.steps} · ${esc(serverText(q.text))}${q.need > 1 ? ` ${q.progress}/${q.need}` : ''}</span></button>${share ? `<button class="btn btn-small mq-share" data-share="${esc(q.id)}" title="${esc(L('shareTitle'))}">${esc(L('share'))}</button>` : ''}</div>`; }).join('')}</div>` : ''}</div>`;
    // A task of the sea in the log: the chart turns to its nest.
    root.querySelectorAll<HTMLElement>('[data-task]').forEach((b) => (b.onclick = () => {
      const t = state.tasks.find((x) => x.id === Number(b.dataset.task));
      if (!t) return;
      this.cx = t.x;
      this.cy = t.y;
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
    c.onpointerdown = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) this.drag = { x: e.clientX, y: e.clientY, cx: this.cx, cy: this.cy };
      else {
        this.drag = null;
        pinch = spread();
      }
    };
    c.onpointermove = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
    c.onpointerup = c.onpointercancel = c.onpointerleave = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
      if (!pts.size) this.drag = null;
    };
    this.draw(state);
  }

  private scale(): number {
    const c = this.canvas!;
    return (Math.min(c.clientWidth, c.clientHeight) / WORLD_SIZE) * this.zoom;
  }

  draw(state: ClientState): void {
    const c = this.canvas;
    if (!c || !c.isConnected) return;
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
    // Labels never pile on each other: the first placed (ports, then sites, then events) keeps its place, a later one
    // that would cover it waits for a closer zoom.
    const placed: [number, number, number, number][] = [];
    const label = (text: string, x: number, y: number, color = 'rgba(240,230,200,0.85)') => {
      const w = g.measureText(text).width;
      const a = g.textAlign;
      // A label by the chart's edge slides inward rather than being cut by it; one whose mark is off the chart is
      // not drawn at all (it would stand at the edge with nothing under it).
      if (x < -4 || x > W + 4) return;
      const want = a === 'center' ? x - w / 2 : a === 'right' ? x - w : x;
      const x0 = w + 8 < W ? Math.max(4, Math.min(W - w - 4, want)) : want;
      const box: [number, number, number, number] = [x0 - 2, y - 12, x0 + w + 2, y + 4];
      if (placed.some((b) => box[0] < b[2] && b[0] < box[2] && box[1] < b[3] && b[1] < box[3])) return;
      placed.push(box);
      g.save();
      g.textAlign = 'left';
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillText(text, x0 + 1, y + 1);
      g.fillStyle = color;
      g.fillText(text, x0, y);
      g.restore();
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
      g.fillStyle = REGIONS[is.region].strangeness > 0.4 ? '#3a4744' : '#4a4637';
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
    // Ports: key ports are on every chart; villages only once found.
    for (const p of state.ports) {
      const known = !p.id.includes('_v') || [...state.discovered].some((id) => state.islands.get(id)?.portId === p.id);
      if (!known) continue;
      if (!mark(`icon.faction_${p.faction}`, tx(p.x), ty(p.y), ms * 0.95)) {
        g.fillStyle = FACTIONS[p.faction].lantern;
        g.fillRect(tx(p.x) - 4, ty(p.y) - 4, 8, 8);
      }
      g.font = `${this.zoom > 2 ? 13 : 11}px "IM Fell English SC", serif`;
      label(placeName(p.name), tx(p.x), ty(p.y) - ms * 0.55);
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
      if (state.forecast && (f.vx || f.vy)) {
        const t = Math.min(600, f.ttl);
        g.strokeStyle = 'rgba(143,179,217,0.55)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(tx(f.x), ty(f.y));
        g.lineTo(tx(f.x + f.vx * t), ty(f.y + f.vy * t));
        g.stroke();
        mark('icon.map_storm', tx(f.x + f.vx * t), ty(f.y + f.vy * t), ms * 0.7);
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
      // Price notes only at a closer zoom, and only where they fit.
      if (this.zoom < 1.6) continue;
      g.font = '10px Inter, sans-serif';
      label(L('prices', { age: age(it.t) }), tx(p.x) + ms * 0.6, ty(p.y) + ms * 0.15, `rgba(143,179,217,${0.85 * fresh})`);
      if (this.zoom > 1.8) {
        it.top.forEach(([good, price], i) => {
          g.fillStyle = `rgba(224,184,98,${0.9 * fresh})`;
          g.fillText(`${GOODS[good].name} ${price}`, tx(p.x) + ms * 0.6, ty(p.y) + ms * 0.15 + 12 + i * 11);
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
    // Your group.
    g.font = '12px serif';
    for (const m of state.party?.members ?? []) {
      if (m.name === state.self?.name || m.docked) continue;
      const col = m.online ? '#7fd08a' : 'rgba(127,208,138,0.45)';
      g.fillStyle = col;
      g.fillRect(tx(m.x) - 4, ty(m.y) - 4, 8, 8);
      label(m.name, tx(m.x), ty(m.y) - 9, col);
    }
    // You.
    const own = state.ownDisplay;
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
