// The wire of docs/17 H4 (the adventure map): the guards and the things on the map a captain has seen, the visit card
// over the sea, the Grail's puzzle. Kept apart from protocol.ts, which only takes these unions into its own.

import type { UnitId } from './data/army.ts';
import type { GuardKind, GuardSize, ObjKind, VisitRule } from './data/advmap.ts';
import type { GoodId } from './data/goods.ts';
import type { OfficerRole } from './data/crew.ts';
import type { RegionId } from './world/regions.ts';

/** A guard as the charts show it once seen. */
export interface GuardMark {
  id: string;
  kind: GuardKind;
  x: number;
  y: number;
  level: number;
  /** Its head count now (the word «стая», «толпа» is the client's), and whether it is beaten for now. */
  men: number;
  down: boolean;
  /** Its ship's entity id while it stands in the world near a captain. */
  e?: number;
}

/** A thing on the map as the charts show it once seen. */
export interface ObjMark {
  id: string;
  kind: ObjKind;
  x: number;
  y: number;
  level: number;
  /** She may visit it now; a guard stands before it. */
  ready: boolean;
  guarded: boolean;
}

export interface AdvView {
  objs: ObjMark[];
  guards: GuardMark[];
  /** The Grail's pieces she has this season, of how many. */
  pieces: number;
  of: number;
  /** Her Grail: none yet, dug up and waiting to be raised in her town, or standing there. */
  grail: 'none' | 'held' | 'built';
}

/** The guard's card: its men, and — her army much the stronger — their offer. */
export interface GuardCard {
  id: string;
  kind: GuardKind;
  size: GuardSize;
  level: number;
  men: number;
  units: UnitId[];
  /** What it guards (a thing's kind, 'mine', or a strait: null). */
  at: ObjKind | 'mine' | null;
  /** Her army's might against theirs (the ladder counted). */
  ratio: number;
  /** HoMM3: much the stronger, they flee — or some sign on. */
  offer: 'join' | 'flee' | null;
  joinN: number;
  /** Within the grapples' reach: "Board" works at once. */
  alongside: boolean;
  pay: { silver: number; xp: number };
  e?: number;
}

export interface ObjCard {
  id: string;
  kind: ObjKind;
  level: number;
  island: string;
  rule: VisitRule;
  /** She may visit it now; else when (world seconds) she may again (0: never again). */
  ready: boolean;
  again: number;
  /** Why the visit would not go through now (English, as the server says it). */
  why: string | null;
  /** A guard stands before it. */
  guard: GuardCard | null;
  /** What it gives: a chest's two choices, a load of a resource, an altar's point or its experience, a piece. */
  chest?: { silver: number; xp: number; extra?: { id: string; label: [string, string] } };
  load?: { good: GoodId; n: number };
  altar?: { point: boolean; xp: number };
  prison?: { role: OfficerRole | null; level: number };
  pieces?: { n: number; of: number };
}

export interface AdvCardView {
  obj: ObjCard | null;
  guard: GuardCard | null;
}

/** The Grail's puzzle (HoMM3's obelisk map): the chart round the spot, its pieces opened one by one. */
export interface PuzzleView {
  season: number;
  n: number;
  of: number;
  grid: number;
  w: number;
  /** The pieces opened (row-major indices), and the coasts in them (flat [x0,y0,…], metres from the chart's corner). */
  open: number[];
  coasts: number[][];
  /** The spot, when its own piece is open. */
  x?: [number, number];
  /** The waters it lies in, once half the pieces are open. */
  region?: RegionId;
  found: boolean;
  /** A Grail dug up and not yet raised in her town; one already standing there. */
  held: boolean;
  built: boolean;
  /** The boats are digging (world seconds left), or a miss's wait. */
  digging: number;
  wait: number;
}

export type H4ClientMsg =
  | { t: 'h4'; action: 'visit'; id: string; choice?: string }
  | { t: 'h4'; action: 'guard'; id: string; choice: 'fight' | 'join' | 'flee' }
  | { t: 'h4'; action: 'puzzle' }
  | { t: 'h4'; action: 'dig' };

export type H4ServerMsg =
  | { t: 'adv'; view: AdvView }
  | { t: 'adv_card'; view: AdvCardView | null }
  | { t: 'puzzle'; view: PuzzleView };
