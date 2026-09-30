// Auto-sail to a mark on the chart (docs/16 #36): the numbers both sides share. The server steers (the helm is
// server-authoritative), the client shows the pill and hands the reasons to the captain in her own words.

/** Within this many metres of her mark she has arrived (the client's own mark comes off at the same distance). */
export const AUTOSAIL_ARRIVE = 150;
/** A hostile ship this near hands the helm back. */
export const AUTOSAIL_DANGER_R = 900;
/** Below this share of her hull the helmsman will not go on alone. */
export const AUTOSAIL_LOW_HULL = 0.35;
/** A mark this far at most (the whole sea is 96 km across). */
export const AUTOSAIL_MAX_RANGE = 60_000;
/** Barely moving this long means she is stuck: plan again, and after this many plans give the helm back. */
export const AUTOSAIL_STUCK_SEC = 25;
export const AUTOSAIL_REPLANS = 3;

/** Why the helmsman gave the wheel back. */
export type AutosailStop = 'arrived' | 'manual' | 'hostile' | 'attack' | 'storm' | 'reef' | 'hull' | 'port' | 'lost' | 'helm' | 'stuck' | 'off';
export const AUTOSAIL_STOPS: readonly AutosailStop[] = ['arrived', 'manual', 'hostile', 'attack', 'storm', 'reef', 'hull', 'port', 'lost', 'helm', 'stuck', 'off'];

/** The sail she sets when the helmsman takes over: what she carries, or three quarters when she was nearly stopped. */
export function autosailSail(current: number): number {
  const i = Math.round(Number.isFinite(current) ? current : 3);
  return i >= 2 ? Math.min(4, i) : 3;
}
