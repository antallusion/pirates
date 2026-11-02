// Owner, 2026-11-02: «надо сделать какой-то обратный отсчёт до квестов, где надо доплыть и что-то сделать, типа с
// водолазами … показывай таймер с обратным отсчётом и зафиксируй корабль, когда такие квесты делаются».
//
// The work done at a spot — the divers on a wreck, the boats ashore (a landing, a walk across the island, a lookout, a
// stockpile hauled, a bared bank combed, a mine's flag), a treasure dug, the Grail dug, the boats at a sea mark or a
// small find, a robbery ashore — as one countdown: the server sends its kind, its start and its end on the sea's clock
// (`game.now`), the client counts it down against its estimate of that clock (state.estServerTime), names its phase
// and draws its ring. While it runs she rides at anchor (server/src/game/spotwork.ts).

export type SpotKind = 'dive' | 'dig' | 'land' | 'trek' | 'lookout' | 'haul' | 'tidal' | 'flag' | 'find' | 'mark' | 'grail' | 'rob';

export const SPOT_KINDS: readonly SpotKind[] = ['dive', 'dig', 'land', 'trek', 'lookout', 'haul', 'tidal', 'flag', 'find', 'mark', 'grail', 'rob'];

/** The work at a spot, as the client is sent it (PrivateState.spot). */
export interface SpotView {
  kind: SpotKind;
  /** What it is at, in the server's words (a wreck's name, a feature, an island): translated by the client. */
  name?: string;
  /** Its start and its end, on the sea's clock (seconds). */
  started: number;
  until: number;
  /** Under fire the work is broken off (true: the landing family, the boats at a mark or a find). */
  fireBreaks: boolean;
}

/** Its phases: where each begins (a share of its whole time) and its words' key. */
export type SpotPhase = 'down' | 'search' | 'up' | 'row' | 'ashore' | 'back' | 'dig' | 'work';

const PHASES: Record<SpotKind, readonly [number, SpotPhase][]> = {
  dive: [[0, 'down'], [0.3, 'search'], [0.8, 'up']],
  dig: [[0, 'row'], [0.15, 'dig'], [0.85, 'back']],
  grail: [[0, 'row'], [0.15, 'dig'], [0.85, 'back']],
  land: [[0, 'row'], [0.2, 'ashore'], [0.85, 'back']],
  trek: [[0, 'row'], [0.5, 'ashore']],
  lookout: [[0, 'row'], [0.2, 'ashore'], [0.85, 'back']],
  haul: [[0, 'row'], [0.2, 'work'], [0.85, 'back']],
  tidal: [[0, 'row'], [0.2, 'ashore'], [0.85, 'back']],
  flag: [[0, 'row'], [0.2, 'work'], [0.85, 'back']],
  rob: [[0, 'row'], [0.1, 'ashore'], [0.9, 'back']],
  find: [[0, 'row'], [0.3, 'work'], [0.8, 'back']],
  mark: [[0, 'row'], [0.3, 'work'], [0.8, 'back']],
};

/** Its phase at `now` (the server's clock). */
export function spotPhase(v: Pick<SpotView, 'kind' | 'started' | 'until'>, now: number): SpotPhase {
  const f = spotFrac(v, now);
  const list = PHASES[v.kind];
  let at = list[0][1];
  for (const [from, p] of list) if (f >= from) at = p;
  return at;
}

/** Its share done at `now`, 0..1. */
export function spotFrac(v: Pick<SpotView, 'started' | 'until'>, now: number): number {
  return Math.max(0, Math.min(1, (now - v.started) / Math.max(0.001, v.until - v.started)));
}

/** Seconds left at `now`. */
export function spotLeft(v: Pick<SpotView, 'until'>, now: number): number {
  return Math.max(0, v.until - now);
}

/** «0:18», «1:05». */
export function spotClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The icon of each (the game's own art). */
export const SPOT_ICON: Record<SpotKind, string> = {
  dive: 'art_deep_bell', dig: 'talent_exp_lucky_dig', grail: 'talent_exp_lucky_dig', land: 'talent_srv_lifeboats', trek: 'talent_srv_lifeboats',
  lookout: 'act_inspect', haul: 'talent_srv_lifeboats', tidal: 'talent_srv_lifeboats', flag: 'cos_flags', rob: 'item_black_flag',
  find: 'talent_srv_lifeboats', mark: 'talent_srv_lifeboats',
};

/** A recall by her own hand before this share of the work: nothing brought back (after it: half). */
export const SPOT_HALF = 0.5;
