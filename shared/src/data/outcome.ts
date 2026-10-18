// A ship of the sea beaten — carried by boarding, or struck to her captor — and the two ways it ends (owner,
// 2026-10-18: «после победы над кораблем должно быть только два выбора»). docs/31 §10.
//
//  (A) «Забрать всё и затопить» — 'sink': her hold into yours as far as it goes, her whole purse and her captain's gear;
//      SINK_CREW of her surviving men sign on (as far as your hammocks go); she goes down at once, and her wreck lies on
//      the water at once, yours alone to pick up: her timbers (planks, timber, canvas, iron) and the cargo that did not
//      fit.
//  (B) «Забрать экипаж и отпустить» — 'release': RELEASE_CREW of her men sign on, RELEASE_SILVER of her purse; she is
//      let go and gone from the sea at once.
//
// The silver of both stays within docs/31 §9: the purse is the purse of her waters (seaPurse), and (B) pays less of it
// than (A) — the men are what (B) is for, and the hammocks bound them.

export type OutcomeFate = 'sink' | 'release';

/** (A): the share of her surviving crew who sign on. */
export const SINK_CREW = 0.15;
/** (B): the share of her surviving crew who sign on (as many as the prisoners ever were, docs/16 #18). */
export const RELEASE_CREW = 0.3;
/** (B): the share of her purse she pays to be let go. */
export const RELEASE_SILVER = 0.3;
/** (A): seconds from the order to her going under (was the sinking's six: at once, the owner asked). */
export const SCUTTLE_SINK_SEC = 1;

/** (A): the timber her wreck gives up, by her hull's tier, beside her planks, canvas, iron and powder (wreckSalvage). */
export function wreckTimber(tier: number): number {
  return 2 * Math.max(1, Math.floor(tier));
}

/** The men of `survivors` who sign on at `share`, as far as `room` hammocks go (none to a cruel officer's ship). */
export function outcomeCrew(survivors: number, share: number, room: number, cruel = false): number {
  if (cruel) return 0;
  return Math.max(0, Math.min(Math.floor(Math.max(0, survivors) * share), Math.floor(Math.max(0, room))));
}

/** (B): the silver of her purse she pays to be let go. */
export function releaseSilver(purse: number): number {
  return Math.round(Math.max(0, purse) * RELEASE_SILVER);
}

/** The numbers the card shows for each of the two choices. */
export interface OutcomeNums {
  /** (A): her silver, the units of her hold that fit yours and those left for the wreck, the timber in it, the men. */
  sink: { silver: number; take: number; left: number; timber: number; crew: number };
  /** (B): the men and the silver. */
  release: { silver: number; crew: number };
  /** Hammocks free aboard hers: her bunks less the living crew and army aboard (the fallen awaiting a raising, docs/35,
   *  take none), and the men of the beaten ship still standing. */
  room: number;
  survivors: number;
}

/** Why no man joins either way, for the card: no hammock free aboard hers, or nobody of hers left standing (a turn-by-turn
 *  fight often leaves two or three: their 15–30 % rounds to none — QA 2026-10-18, the card said «no hammocks» with ten
 *  free). Null when someone joins one way or the other. */
export function outcomeNote(o: OutcomeNums): 'noRoom' | 'noMen' | null {
  if (o.sink.crew > 0 || o.release.crew > 0) return null;
  return o.room <= 0 ? 'noRoom' : 'noMen';
}
