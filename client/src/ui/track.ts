// The quest the captain follows (docs/11 P6): picked in the chart's quest log, else the first that points somewhere.
// Its step shows under the region line and a gold mark on the screen's rim points the way to it.

import type { PrivateState } from '../../../shared/src/protocol.ts';

type Quest = PrivateState['quests'][number];

const KEY = 'gravetide.track';

export function trackedId(): string | null {
  return globalThis.localStorage?.getItem(KEY) ?? null;
}

export function setTracked(id: string | null): void {
  if (id) globalThis.localStorage?.setItem(KEY, id);
  else globalThis.localStorage?.removeItem(KEY);
}

export function trackedQuest(quests: Quest[] | undefined): Quest | null {
  const qs = quests ?? [];
  const id = trackedId();
  return qs.find((q) => q.id === id) ?? qs.find((q) => q.target) ?? qs[0] ?? null;
}

/** The captain's own mark on the chart (owner, 2026-09-30: "put a point and this point would lead"): kept in the
 *  browser, it leads the «Now:» line and the gold marks until she reaches it. */
const WP_KEY = 'gravetide.waypoint';
/** Within this many metres of her mark she has arrived and it is taken off. */
export const WAYPOINT_ARRIVE = 150;

export function waypoint(): { x: number; y: number } | null {
  try {
    const raw = globalThis.localStorage?.getItem(WP_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { x?: unknown; y?: unknown };
    return typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
  } catch {
    return null;
  }
}

/** Told when she reaches her mark (the HUD says so). */
export const waypointHooks: { onArrive: (() => void) | null } = { onArrive: null };

export function setWaypoint(p: { x: number; y: number } | null): void {
  if (p) globalThis.localStorage?.setItem(WP_KEY, JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y) }));
  else globalThis.localStorage?.removeItem(WP_KEY);
}

/** Where the pointer should lead, or null when there is nowhere to go (no place, or already there). */
export function questPointer(q: Quest | null, x: number, y: number, region: string): { x: number; y: number; d: number } | null {
  const t = q?.target;
  if (!t) return null;
  if (t.region && t.region === region) return null; // inside the region the step asks for
  const d = Math.hypot(t.x - x, t.y - y);
  if (!t.region && d < (t.r ?? 400)) return null; // arrived
  return { x: t.x, y: t.y, d };
}

/** The eight points of the compass from a bearing (0 = north, clockwise), as the dictionaries name them. */
export function compassKey(a: number): 'north' | 'north-east' | 'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west' {
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;
  return names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

/** What the captain is about now (owner, 2026-09-29: an objective always on the screen), and where it lies. */
export interface Objective {
  kind: 'waypoint' | 'raid' | 'quest' | 'contract' | 'map' | 'sight' | 'daily' | 'sail';
  /** Server words (translated by the HUD) or a key's parts. */
  title: string;
  text: string;
  /** Where to go, when it has a place; its distance and bearing from her. */
  x?: number;
  y?: number;
  d?: number;
  dir?: ReturnType<typeof compassKey>;
  /** Seconds left, when it has a clock. */
  left?: number;
}

interface ObjState {
  self: PrivateState | null;
  sights: { id: number; kind: string; x: number; y: number }[];
  ports: { id: string; name: string; x: number; y: number }[];
  region: string;
  estServerTime(): number;
}

/** The first of: her own mark on the chart (taken off once she is there), pirates raiding her own island (docs/15 item 7: before everything, with where they lie and the minutes
 * left), the followed quest, a contract with a port to reach (or a count to make), the nearest sign on the
 * horizon, the day's next order; at sea with none of these, to go and look. */
export function objective(state: ObjState, x: number, y: number): Objective | null {
  const self = state.self;
  if (!self) return null;
  const at = (tx: number, ty: number) => ({ x: tx, y: ty, d: Math.hypot(tx - x, ty - y), dir: compassKey(Math.atan2(tx - x, -(ty - y))) });
  const wp = waypoint();
  if (wp) {
    if (Math.hypot(wp.x - x, wp.y - y) > WAYPOINT_ARRIVE) return { kind: 'waypoint', title: '', text: '', ...at(wp.x, wp.y) };
    setWaypoint(null);
    waypointHooks.onArrive?.();
  }
  const raid = self.isleRaid;
  if (raid) return { kind: 'raid', title: raid.name, text: '', left: Math.max(0, raid.until - state.estServerTime()), ...at(raid.x, raid.y) };
  const q = trackedQuest(self.quests);
  if (q) {
    const p = questPointer(q, x, y, state.region);
    return { kind: 'quest', title: q.name, text: q.need > 1 ? `${q.text} ${q.progress}/${q.need}` : q.text, ...(p ? at(p.x, p.y) : {}) };
  }
  const now = state.estServerTime();
  const contracts = [...(self.contracts ?? [])].sort((a, b) => a.expiresAt - b.expiresAt);
  const c = contracts[0];
  if (c) {
    const port = c.toPort ? state.ports.find((p) => p.id === c.toPort) : undefined;
    const count = c.kills ? ` ${c.progress ?? 0}/${c.kills}` : '';
    return { kind: 'contract', title: c.title, text: count.trim(), left: Math.max(0, c.expiresAt - now), ...(port ? at(port.x, port.y) : {}) };
  }
  // A treasure map in the hold with a circle to search: the nearest one leads (owner, 2026-09-29: chests to find).
  const maps = (self.maps ?? []).filter((m) => m.r > 0).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  if (maps[0]) return { kind: 'map', title: maps[0].name, text: '', ...at(maps[0].x, maps[0].y) };
  let best: { x: number; y: number } | null = null, bd = 6000;
  for (const s of state.sights) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  if (best) return { kind: 'sight', title: '', text: '', ...at(best.x, best.y) };
  const order = self.daily?.orders.find((o) => !o.done);
  if (order) return { kind: 'daily', title: order.kind, text: `${order.progress}/${order.need}` };
  return self.dockedAt ? null : { kind: 'sail', title: '', text: '' };
}
