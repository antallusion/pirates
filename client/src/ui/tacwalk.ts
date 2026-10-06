// A stack's walk across the battle's hexes (owner, 2026-10-05: «надо прям ход нарисовать как-то чтобы это выглядело
// как ход»): the hexes it steps through, found as the server finds its reach (around the masts, the guns, the holes
// and the other stacks), and the point along them at a moment of the walk. Pure, so the tests can walk it too.

import { TAC_BLOCKING, hexNeighbors } from '../../../shared/src/data/tactical.ts';
import type { TacCell } from '../../../shared/src/data/tactical.ts';

/** A step's time on the field, and the walk's bounds (ms): a short step is still seen, a long march never drags
 *  (docs/23 item 60: a stack's move in 0.25 s at most; it was 0.3–0.6 s). */
export const STEP_MS = 50;
export const WALK_MIN = 150;
export const WALK_MAX = 250;
/** A flier's glide (or a stack set down by a move of the deep: no walk to it), straight over. */
export const GLIDE_MS = 250;

/** How long a walk of `steps` hexes takes; `speed` 2 under «Ускорить ×2». */
export const walkMs = (steps: number, speed = 1): number => Math.max(WALK_MIN, Math.min(WALK_MAX, steps * STEP_MS)) / speed;

/** The shortest walk from `from` to `to` over the field as it stood, the hexes in order (both ends with them); null
 *  when no walk joins them (a dive through the surf, a stack set down elsewhere). */
export function walkPath(cells: ArrayLike<string>, stacks: readonly { id: number; hex: number; count: number }[], self: number, from: number, to: number, diving = false): number[] | null {
  if (from === to) return [from];
  const held = new Set(stacks.filter((s) => s.count > 0 && s.id !== self).map((s) => s.hex));
  const ok = (i: number) => i === to || ((!TAC_BLOCKING.has(cells[i] as TacCell) || (diving && cells[i] === 'W')) && !held.has(i));
  const back = new Map<number, number>([[from, -1]]);
  let frontier = [from];
  for (let d = 0; d < 40 && frontier.length; d++) {
    const next: number[] = [];
    for (const i of frontier) {
      for (const j of hexNeighbors(i)) {
        if (back.has(j) || !ok(j)) continue;
        back.set(j, i);
        if (j === to) {
          const out = [to];
          for (let k = i; k !== -1; k = back.get(k)!) out.push(k);
          return out.reverse();
        }
        next.push(j);
      }
    }
    frontier = next;
  }
  return null;
}

/** Eased in and out: the stack sets off and comes to rest. */
export const easeWalk = (k: number): number => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** The point `k` (0..1) of the way along a line of points, by its length. */
export function along(pts: readonly { x: number; y: number }[], k: number): { x: number; y: number } {
  if (pts.length === 1 || k <= 0) return { x: pts[0].x, y: pts[0].y };
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    seg.push(d);
    total += d;
  }
  let left = Math.min(1, k) * total;
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i] || i === seg.length - 1) {
      const f = seg[i] ? Math.min(1, left / seg[i]) : 1;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
    }
    left -= seg[i];
  }
  const z = pts[pts.length - 1];
  return { x: z.x, y: z.y };
}
