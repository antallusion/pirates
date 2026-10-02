// The dense sea's marks made worth a look (owner, 2026-10-02: "sailing up to things there should be buttons for what
// to do next"): every mark that is not land — driftwood, a field of wrecks, a lane buoy, a lantern float, floating
// bones, an ice floe — has one small thing to do at it, a few seconds hove to within a cable of it, once a day a
// captain a mark. What it gives is small: two to five hundredths of an hour at sea for her ship's level.

export type MarkKind = 'wreck' | 'buoy' | 'lantern' | 'drift' | 'bones' | 'floe';
export const MARK_KINDS: readonly MarkKind[] = ['drift', 'wreck', 'buoy', 'lantern', 'bones', 'floe'];

/** Metres from the mark's edge within which the boats can work it. */
export const MARK_REACH = 160;
/** No faster than this (m/s) while they work; a little more and the work stops. */
export const MARK_SLOW = 3;
export const MARK_SLOW_BREAK = 4.5;
/** Seconds of work, kind by kind. */
export const MARK_TIME: Record<MarkKind, number> = { drift: 2, wreck: 4, buoy: 2, lantern: 2, bones: 3, floe: 3 };
/** A mark is hers to work again a day after (real milliseconds). */
export const MARK_AGAIN_MS = 24 * 3_600_000;
/** The share of an hour at sea a mark gives. */
export const MARK_SHARE: readonly [number, number] = [0.02, 0.05];
/** A wreck field's chance of a treasure map. */
export const MARK_MAP_CHANCE = 0.04;
/** A lane buoy charts the nearest island not on her chart within this many metres. */
export const MARK_CHART_R = 4000;
/** An ice floe's chance of seals hauled out on it (the drift of docs/18 IV). */
export const MARK_SEAL_CHANCE = 0.12;
/** Floating bones: the chance the crew takes them for an ill omen rather than bone for the store. */
export const MARK_OMEN_CHANCE = 0.3;

/** What an hour at sea earns at a ship's level (tests/balance/island.ts `seaHour`, the island's reference). */
export function seaHourOf(shipLevel: number): number {
  return Math.round(6 * 320 * 1.3 ** (Math.max(1, Math.min(10, shipLevel)) - 1));
}

/** A mark's worth in silver at her level, for a roll `u` in [0, 1). */
export function markWorth(shipLevel: number, u: number): number {
  const [lo, hi] = MARK_SHARE;
  return Math.round(seaHourOf(shipLevel) * (lo + (hi - lo) * Math.max(0, Math.min(1, u))));
}

/** The icon of each kind's work (the HUD's button, the toast). */
export const MARK_ICON: Record<MarkKind, string> = {
  drift: 'good_timber', wreck: 'map_wreck', buoy: 'map_port', lantern: 'tattoo_lantern', bones: 'good_whalebone', floe: 'good_provisions',
};

/** Whether a point lies within the boats' reach of a mark. */
export function markInReach(m: { x: number; y: number; r: number }, x: number, y: number): boolean {
  return Math.hypot(m.x - x, m.y - y) - m.r <= MARK_REACH;
}

export function isMarkKind(k: unknown): k is MarkKind {
  return typeof k === 'string' && (MARK_KINDS as readonly string[]).includes(k);
}
