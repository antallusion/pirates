// The helmsman's course on the screen (owner, 2026-10-18: «я например выбрал плыть по кампании нету линии плавания и не
// показано сколько плыть. всегда должно быть показано направление линией и путь»): for every run the server plans — a
// tap on the sea or on a thing, a goal's run (the campaign, a quest, a contract), «В порт», a course broken off by a
// fight — the way it planned round the land, from where she is now, and how far it is by that way.

import type { ClientState } from '../state.ts';

export type Pt = [number, number];

/** The course to draw: its end, its planned points (null: none sent yet — a straight line then), and whether it is a
 *  course broken off and waiting (dimmed). */
export interface Course {
  to: { x: number; y: number };
  pts: Pt[] | null;
  paused: boolean;
}

/** The run she is on now, if any: the helmsman's; else a goal's place he will sail for (in port, refused a moment);
 *  else a course a fight broke off. */
export function courseOf(state: Pick<ClientState, 'autosail' | 'route' | 'pausedCourse' | 'lastPath'>): Course | null {
  if (state.autosail) return { to: state.autosail, pts: state.autosail.path ?? null, paused: false };
  const rt = state.route?.view;
  if (rt) {
    const last = state.lastPath;
    const kept = last && last.length >= 2 && Math.hypot(last[last.length - 1][0] - rt.x, last[last.length - 1][1] - rt.y) < Math.max(450, rt.r) ? last : null;
    return { to: rt, pts: rt.path && rt.path.length >= 2 ? rt.path : kept, paused: !rt.path && !!kept };
  }
  if (state.pausedCourse) return { to: state.pausedCourse, pts: state.pausedCourse.path ?? null, paused: true };
  return null;
}

/** The leg of a course she is on: the one nearest her, never one behind the last she was on (`from`). */
function legOf(pts: Pt[], x: number, y: number, from: number): number {
  let best = Math.max(1, Math.min(from, pts.length - 1)), bd = Infinity;
  for (let i = best; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0;
    const d = Math.hypot(ax + ex * t - x, ay + ey * t - y);
    // (a later leg as near wins: she is on her way along it)
    if (d <= bd + 1) {
      bd = d;
      best = i;
    }
  }
  return best;
}

const legs = new WeakMap<object, number>();

/** The course ahead of her: her place, then its points still ahead, to its end; and its length (metres). */
export function courseAhead(c: Course, x: number, y: number): { pts: Pt[]; left: number } {
  const all = c.pts;
  if (!all || all.length < 2) return { pts: [[x, y], [c.to.x, c.to.y]], left: Math.hypot(c.to.x - x, c.to.y - y) };
  const i = legOf(all, x, y, legs.get(all) ?? 1);
  legs.set(all, i);
  const pts: Pt[] = [[x, y], ...all.slice(i)];
  let left = 0;
  for (let k = 1; k < pts.length; k++) left += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  return { pts, left };
}

/** The name of a course's end for the chip: a port by it, an island it lies on or by, else null (a mark of hers). */
export function courseName(state: Pick<ClientState, 'ports' | 'islands'>, to: { x: number; y: number }): string | null {
  let port: { name: string; d: number } | null = null;
  for (const p of state.ports) {
    const d = Math.hypot(p.x - to.x, p.y - to.y);
    if (d < 900 && (!port || d < port.d)) port = { name: p.name, d };
  }
  if (port) return port.name;
  let isle: { name: string; d: number } | null = null;
  for (const is of state.islands.values()) {
    if (is.mist || is.minor || !is.name) continue;
    const d = Math.hypot(is.x - to.x, is.y - to.y);
    if (d < is.r + 350 && (!isle || d - is.r < isle.d)) isle = { name: is.name, d: d - is.r };
  }
  return isle?.name ?? null;
}
