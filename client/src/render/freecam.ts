// The far view and the free look (owner, 2026-10-17: «дай возможность отдалить море сильно и просто возить пальцем и
// просматривать где что»). Pure: the renderer (renderer.ts), the touch controls (touch.ts) and main.ts feed it.
//   the zoom      a pinch or the wheel, from ZOOM_MAX in to ZOOM_MIN out (it stopped at 0.35 px/m before: about 2.4 km
//                 across a phone; now about 21 km). Below CHART_FROM the painted sea gives way to the chart (farsea.ts):
//                 the islands, the ports and what the lookouts see, drawn as marks, fully so by CHART_FULL.
//   the look      one finger dragged over the sea (a mouse's too) parks the camera off her — she sails on as ordered;
//                 «К кораблю» (or a fight beginning) brings it back. The camera keeps within LOOK_MAX of her and
//                 inside the world.
//   the gesture   a finger is a tap until it travels TAP_SLOP px (then it drags the view and never taps); held still it
//                 stays a tap however long it is held (its meaning before: the aim where it went down); a second finger
//                 makes it a pinch (its midpoint drags the view as well) and the first finger taps no more.

import { WORLD_SIZE } from '../../../shared/src/constants.ts';

/** px per metre: the nearest the view comes. */
export const ZOOM_MAX = 4;
/** px per metre: the farthest out (about 21 km across an 844 px phone). */
export const ZOOM_MIN = 0.04;
/** The old farthest out: the recentre brings a far view back to this at most. */
export const ZOOM_NEAR_MIN = 0.35;
/** The chart begins to show over the painted sea below this zoom… */
export const CHART_FROM = 0.3;
/** …and is all there is below this one (the sea's art, the ships' sprites are not drawn). */
export const CHART_FULL = 0.18;
/** The camera keeps within this many metres of her in the free look. */
export const LOOK_MAX = 12_000;
/** A finger that travels this far (px) is a drag, not a tap. */
export const TAP_SLOP = 10;

export const clampZoom = (z: number): number => (Number.isFinite(z) ? Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) : ZOOM_NEAR_MIN);

/** How much of the chart shows at a zoom: 0 the painted sea alone, 1 the chart alone. */
export function chartMix(zoom: number): number {
  if (zoom >= CHART_FROM) return 0;
  if (zoom <= CHART_FULL) return 1;
  return (CHART_FROM - zoom) / (CHART_FROM - CHART_FULL);
}

/** A look point kept within `max` metres of her and inside the world. */
export function clampLook(p: { x: number; y: number }, own: { x: number; y: number } | null, max = LOOK_MAX, world = WORLD_SIZE): { x: number; y: number } {
  let x = p.x, y = p.y;
  if (own) {
    const dx = x - own.x, dy = y - own.y, d = Math.hypot(dx, dy);
    if (d > max) {
      x = own.x + (dx / d) * max;
      y = own.y + (dy / d) * max;
    }
  }
  return { x: Math.max(0, Math.min(world, x)), y: Math.max(0, Math.min(world, y)) };
}

/** A drag of (dx, dy) screen px at `zoom` moves the look the other way: the sea follows the finger. */
export function panLook(look: { x: number; y: number }, dx: number, dy: number, zoom: number, own: { x: number; y: number } | null): { x: number; y: number } {
  const z = Math.max(1e-4, zoom);
  return clampLook({ x: look.x - dx / z, y: look.y - dy / z }, own);
}

/** What a pointer event on the sea came to. */
export interface GestureOut {
  /** The view dragged by this many px. */
  pan?: [number, number];
  /** The zoom multiplied by this (a pinch). */
  zoom?: number;
  /** A tap at this point (the finger lifted without travelling, alone). */
  tap?: [number, number];
}

/** The sea's fingers: taps, drags and pinches told apart (see the header). Pure — fed the pointer events' ids and
 *  points; returns what each one did. */
export class SeaGesture {
  private pts = new Map<number, { x: number; y: number; x0: number; y0: number; moved: boolean; spent: boolean }>();
  private spread = 0;
  private mid: [number, number] | null = null;

  /** Fingers down now. */
  get count(): number {
    return this.pts.size;
  }

  /** A finger travelled past the slop (the view is being dragged). */
  get dragging(): boolean {
    for (const p of this.pts.values()) if (p.moved) return true;
    return this.pts.size >= 2;
  }

  down(id: number, x: number, y: number): GestureOut {
    this.pts.set(id, { x, y, x0: x, y0: y, moved: false, spent: false });
    if (this.pts.size >= 2) {
      // a pinch: none of the fingers taps any more
      for (const p of this.pts.values()) p.spent = true;
      this.spread = this.spreadNow();
      this.mid = this.midNow();
    }
    return {};
  }

  move(id: number, x: number, y: number): GestureOut {
    const p = this.pts.get(id);
    if (!p) return {};
    const px = p.x, py = p.y;
    p.x = x;
    p.y = y;
    if (this.pts.size >= 2) {
      const out: GestureOut = {};
      const d = this.spreadNow(), m = this.midNow();
      if (this.spread > 0 && d > 0) out.zoom = d / this.spread;
      if (this.mid && m) out.pan = [m[0] - this.mid[0], m[1] - this.mid[1]];
      this.spread = d;
      this.mid = m;
      return out;
    }
    if (!p.moved && Math.hypot(x - p.x0, y - p.y0) > TAP_SLOP) {
      p.moved = true;
      // the drag takes the whole way from where the finger went down (no jump at the slop)
      return { pan: [x - p.x0, y - p.y0] };
    }
    return p.moved ? { pan: [x - px, y - py] } : {};
  }

  up(id: number, x: number, y: number, cancel = false): GestureOut {
    const p = this.pts.get(id);
    if (!p) return {};
    this.pts.delete(id);
    if (this.pts.size < 2) {
      this.spread = 0;
      this.mid = null;
    }
    // (the finger left after a pinch drags from where it is now, not from where it went down)
    for (const q of this.pts.values()) {
      q.x0 = q.x;
      q.y0 = q.y;
    }
    if (cancel || p.spent || p.moved || Math.hypot(x - p.x0, y - p.y0) > TAP_SLOP) return {};
    return { tap: [x, y] };
  }

  private spreadNow(): number {
    const [a, b] = [...this.pts.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private midNow(): [number, number] | null {
    const [a, b] = [...this.pts.values()];
    return a && b ? [(a.x + b.x) / 2, (a.y + b.y) / 2] : null;
  }
}
