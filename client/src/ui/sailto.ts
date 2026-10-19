// Sail-to on tap, the client's half (seaux, owner 2026-10-11: «я должен нажать и плыть к цели … я должен плыть туда
// куда нажал»). A tap on a thing on the sea — a small find, a sea mark, a sign, a drift, a shoal, a piece of wreckage, a
// castaway, a thing of the adventure map, a lair — names it here; main.ts then sends the thing's own order (the server
// sails her there and gives it within reach: server/src/game/approach.ts) or, for what she takes by passing, sets the
// helmsman's course to it. «Занять» sails her in to the island's shore and opens the claim's terms there.

import type { ClientState } from '../state.ts';

export type TapKind = 'find' | 'mark' | 'sight' | 'drift' | 'shoal' | 'wreck' | 'loot' | 'castaway' | 'adv' | 'lair' | 'way';

export interface TapTarget {
  kind: TapKind;
  id: number | string;
  x: number;
  y: number;
  /** How near the helmsman should bring her (metres) for what she takes by passing through it. */
  near?: number;
}

/** A finger's slack round a thing (screen pixels), whatever the zoom. */
export const TAP_SLACK = 34;

/** The thing on the sea under a tap (world metres; `zoom` pixels a metre), the nearest within the finger's slack or
 *  the thing's own size. Null: open sea. */
export function tapTarget(state: ClientState, wx: number, wy: number, zoom: number): TapTarget | null {
  const slack = TAP_SLACK / Math.max(0.05, zoom);
  let best: TapTarget | null = null, bd = Infinity;
  const take = (t: TapTarget, size = 0) => {
    const d = Math.hypot(t.x - wx, t.y - wy) - size;
    if (d <= slack && d < bd) [best, bd] = [t, d];
  };
  for (const f of state.finds) if (f.kind !== 'flyfish') take({ kind: 'find', id: f.id, x: f.x, y: f.y });
  for (const c of state.castaways) take({ kind: 'castaway', id: c.id, x: c.x, y: c.y, near: 30 });
  for (const w of state.wrecks) take({ kind: 'wreck', id: w.id, x: w.x, y: w.y, near: 30 });
  for (const [id, l] of state.loot) take({ kind: 'loot', id, x: l.x, y: l.y, near: 30 });
  for (const s of state.sights) take({ kind: 'sight', id: s.id, x: s.x, y: s.y });
  for (const d of state.drifts) take({ kind: 'drift', id: d.id, x: d.x, y: d.y });
  for (const o of state.adv?.objs ?? []) take({ kind: 'adv', id: o.id, x: o.x, y: o.y });
  for (const l of state.lairs?.list ?? []) take({ kind: 'lair', id: l.id, x: l.x, y: l.y });
  // a floating waystation (owner, 2026-10-19): the tap moors her there, the helmsman taking her in first
  for (const w of state.ways.values()) take({ kind: 'way', id: w.id, x: w.x, y: w.y });
  for (const s of state.shoals) take({ kind: 'shoal', id: s.id, x: s.x, y: s.y, near: Math.max(20, s.r * 0.5) }, s.r * 0.6);
  for (const m of state.seaMarks.values()) {
    if (Math.abs(m.x - wx) > m.r + slack || Math.abs(m.y - wy) > m.r + slack) continue;
    take({ kind: 'mark', id: m.id, x: m.x, y: m.y }, m.r);
  }
  return best;
}

/** «Занять»: within this of the island's shore (its circle) the claim's terms open; farther the helmsman sails her in. */
export const CLAIM_NEAR = 320;

/** Off the island's shore on her side: where the helmsman takes her for a claim (on the water, short of the reach). */
export function claimSpot(isl: { x: number; y: number; r: number }, own: { x: number; y: number }): { x: number; y: number } {
  const d = Math.max(1, Math.hypot(own.x - isl.x, own.y - isl.y));
  const k = (isl.r + CLAIM_NEAR * 0.5) / d;
  return { x: Math.round(isl.x + (own.x - isl.x) * k), y: Math.round(isl.y + (own.y - isl.y) * k) };
}

/** Whether she is close enough to an island for its claim's terms (the shore's circle within CLAIM_NEAR). */
export const claimNear = (isl: { x: number; y: number; r: number }, own: { x: number; y: number }): boolean => Math.hypot(own.x - isl.x, own.y - isl.y) - isl.r <= CLAIM_NEAR;
