// A stack's walk across the battle's hexes (owner, 2026-10-05: «надо прям ход нарисовать как-то чтобы это выглядело
// как ход»): the hexes it steps through, found as the server finds its reach (around the masts, the guns, the holes
// and the other stacks), and the point along them at a moment of the walk. Pure, so the tests can walk it too.

import { TAC_BLOCKING, TAC_PACE, hexNeighbors, walkSecs } from '../../../shared/src/data/tactical.ts';
import type { TacCell } from '../../../shared/src/data/tactical.ts';

/** A step's time on the field (ms): owner, 2026-10-08 — «там как-то слишком быстро всё перемещается, непонятно даже»
 *  — a stack walks hex by hex at a readable pace (docs/23 item 60 had a whole walk in 0.15–0.25 s). The server waits
 *  as long (shared/src/data/tactical.ts TAC_PACE). */
export const STEP_MS = TAC_PACE.hex * 1000;
/** A flier's glide over the field (or a stack set down by a move of the deep), a hex of it (ms). */
export const GLIDE_MS = TAC_PACE.glide * 1000;

/** How long a walk of `steps` hexes takes (ms); `speed` 2 under «Ускорить ×2». */
export const walkMs = (steps: number, speed = 1): number => walkSecs(steps, false, speed) * 1000;
/** How long a glide over `steps` hexes takes (ms). */
export const glideMs = (steps: number, speed = 1): number => walkSecs(steps, true, speed) * 1000;

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

/** A walk's share of its line at `k` of its time, eased hex by hex (owner, 2026-10-08: each step sets off and
 *  settles, so a march reads as steps, not a slide); it never runs back. */
export function stepEase(k: number, steps: number): number {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const n = Math.max(1, steps);
  const i = Math.min(n - 1, Math.floor(k * n));
  const f = k * n - i;
  return (i + 0.3 * f + 0.7 * easeWalk(f)) / n;
}

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
