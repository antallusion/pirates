// docs/18 III on the charts: the minimap's islands in their kinds' colours, the mist of a hidden island, the turtle
// islands and the time a bared bank has left, and the minimap's tooltip (name · ⚓level · kind); on the world map the
// islands' kinds and levels, the zones of one level, the hidden islands found, the turtle islands and the banks under
// water with their timers, and the «where is my level» hint under the chart.

import { THREAT_COLOR, shipLevelOf, threatOf } from '../../../shared/src/data/shiplevel.ts';
import { TIDAL_NAMES, TIDE_SEC } from '../../../shared/src/data/isles.ts';
import type { IslandData, TidalView } from '../../../shared/src/protocol.ts';
import type { TurtleView, ZoneView } from '../../../shared/src/isleproto.ts';
import { ISLE_TYPE_DEFS, isleDanger, nearestZone } from '../../../shared/src/world/archipelago.ts';
import { TURTLE_DOWN, TURTLE_NAMES, TURTLE_UP, turtlePos } from '../../../shared/src/world/drift.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/isles18.ts';
import { turtleDef } from '../render/isletype.ts';
import { driftTip } from '../render/drifts.ts';
import type { ClientState } from '../state.ts';
import { esc } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);
type G = CanvasRenderingContext2D;
const ru = () => (lang() === 'ru' ? 1 : 0);

/** An island's colour on the minimap and the chart: her kind's. */
export function isleFill(is: IslandData, strange: boolean): string {
  if (is.ty) return ISLE_TYPE_DEFS[is.ty].chart;
  return strange ? '#3a4744' : '#4a4637';
}

export function turtleName(t: TurtleView): string {
  return TURTLE_NAMES[t.name]?.[ru()] ?? '';
}

function mins(turn: number, now: number): number {
  return Math.max(1, Math.round((turn - now) / 60));
}

/** A ring round a mark showing how much of its time is left (a clock hand of gold). */
function timer(g: G, x: number, y: number, r: number, left: number, color: string): void {
  g.save();
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, left)));
  g.stroke();
  g.restore();
}

// ------------------------------------------------------------------------------------------------ the minimap

/** The turtle islands and the bared banks' time on the minimap. */
export function drawIslesMini(g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, own: { x: number; y: number }, range: number, k: number): void {
  const now = state.estServerTime();
  for (const b of state.isles?.tidal ?? []) {
    if (!b.up || b.kind !== 'tide' || Math.abs(b.x - own.x) > range + b.r || Math.abs(b.y - own.y) > range + b.r) continue;
    timer(g, tx(b.x), ty(b.y), Math.max(4.5, b.r * k + 2.5), (b.turn - now) / (TIDE_SEC / 3), 'rgba(255,230,160,0.95)');
  }
  for (const t of state.turtles) {
    const p = turtlePos(turtleDef(t), now);
    if (Math.abs(p.x - own.x) > range + t.r || Math.abs(p.y - own.y) > range + t.r) continue;
    const x = tx(p.x), y = ty(p.y), r = Math.max(3.5, t.r * k);
    g.fillStyle = t.up ? '#8a8a52' : 'rgba(170,190,200,0.35)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    timer(g, x, y, r + 2.5, (t.turn - now) / (t.up ? TURTLE_UP : TURTLE_DOWN), t.up ? 'rgba(170,230,140,0.95)' : 'rgba(170,190,200,0.8)');
  }
}

interface MiniView {
  x: number;
  y: number;
  range: number;
}

/** The minimap's tooltip: what lies under the pointer — an island's name, level and kind; a turtle; a bank. */
export function wireMiniTip(canvas: HTMLCanvasElement, view: () => MiniView | null, stateOf: () => ClientState | null): void {
  const tip = document.createElement('div');
  tip.id = 'mm-tip';
  tip.className = 'mm-tip hidden';
  document.body.appendChild(tip);
  const hide = () => tip.classList.add('hidden');
  /** The words at a point of the minimap, shown beside it (under the cursor; above a finger). */
  const show = (cx: number, cy: number, finger: boolean): boolean => {
    const v = view(), state = stateOf();
    if (!v || !state) return false;
    const r = canvas.getBoundingClientRect();
    const k = r.width / (v.range * 2);
    const wx = v.x + (cx - r.left - r.width / 2) / k, wy = v.y + (cy - r.top - r.height / 2) / k;
    const text = tipAt(state, wx, wy, (finger ? 22 : 12) / k);
    if (!text) return false;
    tip.innerHTML = text;
    tip.classList.remove('hidden');
    tip.style.left = `${Math.round(cx + 14)}px`;
    tip.style.top = `${Math.round(finger ? cy - 48 : cy + 12)}px`;
    const tr = tip.getBoundingClientRect();
    if (tr.right > innerWidth - 4) tip.style.left = `${Math.round(Math.max(4, cx - tr.width - 10))}px`;
    if (tr.bottom > innerHeight - 4) tip.style.top = `${Math.round(cy - tr.height - 10)}px`;
    if (tr.top < 4) tip.style.top = `${Math.round(cy + 28)}px`;
    return true;
  };
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') hide();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') {
      // A finger that wanders off its point is a drag, not a press.
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) cancelPress();
      return;
    }
    if (!show(e.clientX, e.clientY, false)) hide();
  });
  // docs/18 #50: on a touch screen, a long press on the minimap shows the same words (the tap still opens the chart).
  let press: { x: number; y: number; t: number } | null = null;
  let shown = false, hideAt = 0;
  const cancelPress = () => {
    if (press) clearTimeout(press.t);
    press = null;
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    cancelPress();
    shown = false;
    const x = e.clientX, y = e.clientY;
    press = { x, y, t: window.setTimeout(() => {
      press = null;
      shown = show(x, y, true);
      if (shown) {
        clearTimeout(hideAt);
        hideAt = window.setTimeout(hide, 2600);
      }
    }, 450) };
  });
  canvas.addEventListener('pointerup', cancelPress);
  canvas.addEventListener('pointercancel', cancelPress);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // The tap that ended a long press does not open the chart.
  canvas.addEventListener('click', (e) => {
    if (!shown) return;
    shown = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}

/** The words for what lies at a point of the sea (within `slack` metres). */
export function tipAt(state: ClientState, x: number, y: number, slack: number): string | null {
  const now = state.estServerTime();
  const mine = state.self ? shipLevelOf(state.self.loadout) : 1;
  const drift = driftTip(state, x, y, slack); // docs/18 #34
  if (drift) return drift;
  for (const t of state.turtles) {
    const p = turtlePos(turtleDef(t), now);
    if (Math.hypot(p.x - x, p.y - y) > t.r + slack) continue;
    return esc(t.up ? L('turtle.up', { name: turtleName(t), lv: t.level, n: mins(t.turn, now) }) : L('turtle.down', { name: turtleName(t), n: mins(t.turn, now) }));
  }
  for (const b of state.isles?.tidal ?? []) {
    if (Math.hypot(b.x - x, b.y - y) > b.r + slack) continue;
    return esc(bankLine(b, now));
  }
  let best: IslandData | null = null, bd = Infinity;
  for (const is of state.islands.values()) {
    const d = Math.hypot(is.x - x, is.y - y) - is.r;
    if (d < slack && d < bd) {
      bd = d;
      best = is;
    }
  }
  if (!best) return null;
  if (best.mist) return esc(L('tip.mist'));
  const known = state.discovered.has(best.id);
  const name = known && best.name ? placeName(best.name) : '—';
  const type = best.ty ? ISLE_TYPE_DEFS[best.ty].name[ru()] : '';
  const lv = best.lv ?? 0;
  const d = lv ? isleDanger(mine, lv) : null;
  const tail = best.secret ? ` · ${L('tip.secret')}` : '';
  const warn = d ? `<br><b style="color:${THREAT_COLOR[threatOf(mine, lv)]}">${esc(L(d === 'deadly' ? 'tip.deadly' : 'tip.danger'))}</b>` : '';
  return `${esc(L('tip', { name, lv, type }))}${esc(tail)}${warn}`;
}

function bankLine(b: TidalView, now: number): string {
  const name = TIDAL_NAMES[b.name][ru()];
  return b.up ? L('tide.left', { name, n: mins(b.turn, now) }) : L('tide.down', { name, n: mins(b.turn, now) });
}

// ------------------------------------------------------------------------------------------------ the world map

/** On the chart: the zones (dashed rings with their names and levels), the turtles, the banks under water with their
 *  timers, the hidden islands found (a gold ring), and the islands' levels when close enough to read. */
export function drawIslesChart(
  g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number, k: number, zoom: number, ms: number,
  label: (text: string, x: number, y: number, color?: string) => void,
): void {
  const now = state.estServerTime();
  const mine = state.self ? shipLevelOf(state.self.loadout) : 1;
  // The zones of one level she has charted something of.
  const charted = new Set<number>();
  for (const id of state.discovered) charted.add(id);
  for (const z of state.zones) {
    if (!charted.has(z.island) && zoom < 6) continue;
    const x = tx(z.x), y = ty(z.y), r = z.r * k;
    const col = THREAT_COLOR[threatOf(mine, z.level)];
    g.save();
    g.setLineDash([6, 5]);
    g.strokeStyle = col;
    g.globalAlpha = z.level === mine ? 0.85 : 0.4;
    g.lineWidth = z.level === mine ? 2 : 1.2;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    if (zoom >= 1.6) {
      g.font = `${zoom > 3 ? 13 : 11}px "IM Fell English SC", serif`;
      g.textAlign = 'center';
      label(L('zone.name', { name: placeName(z.name), lv: z.level }), x, y - r - 4, col);
    }
  }
  // The levels of the charted islands, and a found hidden island's gold ring.
  for (const id of state.discovered) {
    const is = state.islands.get(id);
    if (!is || is.minor || is.portId) continue;
    const x = tx(is.x), y = ty(is.y);
    if (is.secret) {
      g.strokeStyle = 'rgba(232,196,106,0.95)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(x, y, Math.max(ms * 0.3, is.r * k + 4), 0, Math.PI * 2);
      g.stroke();
    }
    if (zoom >= 5 && is.lv && is.r > 90) {
      g.font = '700 10px Inter, sans-serif';
      g.textAlign = 'center';
      label(`⚓${is.lv}`, x, y + Math.max(10, is.r * k + 11), THREAT_COLOR[threatOf(mine, is.lv)]);
    }
  }
  // The banks under the sea now: a dashed ring and when they bare.
  for (const b of state.isles?.tidal ?? []) {
    if (b.up) continue;
    const x = tx(b.x), y = ty(b.y), r = Math.max(ms * 0.18, b.r * k);
    g.save();
    g.setLineDash([2, 3]);
    g.strokeStyle = 'rgba(205,185,138,0.6)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    if (zoom >= 2.5 && b.kind === 'tide') {
      g.font = '600 11px Inter, sans-serif';
      g.textAlign = 'center';
      label(bankLine(b, now), x, y - r - 5, 'rgba(205,185,138,0.85)');
    }
  }
  // The turtle islands, where they are now, and their time.
  for (const t of state.turtles) {
    const p = turtlePos(turtleDef(t), now);
    const x = tx(p.x), y = ty(p.y), r = Math.max(ms * 0.28, t.r * k);
    g.fillStyle = t.up ? '#8a8a52' : 'rgba(170,190,200,0.35)';
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    timer(g, x, y, r * 1.2 + 3, (t.turn - now) / (t.up ? TURTLE_UP : TURTLE_DOWN), t.up ? 'rgba(170,230,140,0.95)' : 'rgba(170,190,200,0.85)');
    if (zoom >= 1.4) {
      g.font = '600 11px Inter, sans-serif';
      g.textAlign = 'center';
      label(t.up ? L('turtle.up', { name: turtleName(t), lv: t.level, n: mins(t.turn, now) }) : L('turtle.down', { name: turtleName(t), n: mins(t.turn, now) }), x, y - r * 1.2 - 6, t.up ? 'rgba(200,230,170,0.95)' : 'rgba(200,214,220,0.85)');
    }
  }
}

/** The chart's key for docs/18 III. */
export function isleLegend(): string {
  return `<span><b style="color:#f0d040;font-weight:400">◌</b>&nbsp;${esc(L('zone.lg'))}</span><span><b style="color:#e8c46a;font-weight:400">○</b>&nbsp;${esc(L('secret.lg'))}</span><span><b style="color:#8a8a52;font-weight:400">⬮</b>&nbsp;${esc(L('turtle.lg'))}</span><span><b style="color:#f0d040;font-weight:400">⚓</b>&nbsp;${esc(L('level.lg'))}</span><span><b style="color:#c8b07a;font-weight:400">┅</b>&nbsp;${esc(L('sup.lg'))}</span>`;
}

const DIRS = ['dir.0', 'dir.1', 'dir.2', 'dir.3', 'dir.4', 'dir.5', 'dir.6', 'dir.7'] as const;

/** «Where is my level»: the nearest zone of her level, how far and which way, with a button that turns the chart to it. */
export function zoneHint(state: ClientState): string {
  if (!state.zones.length || !state.self || !state.ownDisplay) return '';
  const lv = shipLevelOf(state.self.loadout);
  const own = state.ownDisplay;
  const z: ZoneView | null = nearestZone(state.zones, lv, own.x, own.y);
  const head = `<div class="mq-head">⚓ ${esc(L('zone.where'))}</div>`;
  if (!z) return `<div class="map-quests map-zone">${head}<div class="muted">${esc(L('zone.none'))}</div></div>`;
  const dx = z.x - own.x, dy = z.y - own.y, km = Math.round(Math.hypot(dx, dy) / 1000);
  const inside = Math.hypot(dx, dy) < z.r;
  const dir = L(DIRS[Math.round(((Math.atan2(dx, -dy) / (Math.PI * 2)) * 8 + 8)) % 8]);
  const text = inside ? L('zone.here', { lv, name: placeName(z.name), zl: z.level, n: z.n }) : L('zone.hint', { lv, name: placeName(z.name), zl: z.level, n: z.n, km, dir });
  return `<div class="map-quests map-zone">${head}<div class="zone-hint"><span>${esc(text)}</span><button class="btn btn-small" data-zone="${z.id}">${esc(L('zone.show'))}</button></div></div>`;
}

/** Her supply routes on the chart: a dashed line from each linked lair island to her own. */
export function drawSupplyRoutes(g: G, state: ClientState, tx: (x: number) => number, ty: (y: number) => number): void {
  const v = state.supply;
  if (!v?.home) return;
  for (const s of v.isles) {
    if (!s.linked) continue;
    g.save();
    g.setLineDash([5, 4]);
    g.strokeStyle = 'rgba(200,176,122,0.85)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(tx(s.x), ty(s.y));
    g.lineTo(tx(v.home.x), ty(v.home.y));
    g.stroke();
    g.restore();
  }
}
