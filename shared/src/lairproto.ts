// The wire of docs/18 II (the land's creatures): the lairs a captain has seen on the islands, the lair's card over the
// sea, what a lair left her, her store of the land's resources and the eggs she carries. Kept apart from protocol.ts,
// which only takes these unions into its own.

import type { UnitId } from './data/army.ts';
import type { BeastId, LandRes } from './data/bestiary.ts';
import type { GoodId } from './data/goods.ts';
import type { LairKind, LairRole, LairSize } from './data/lairs.ts';

/** A lair as the charts show it once seen. */
export interface LairMark {
  id: string;
  kind: LairKind;
  role: LairRole;
  x: number;
  y: number;
  level: number;
  /** Its creatures now (the word «стая», «орда» is the client's), and whether it is beaten for now. */
  men: number;
  down: boolean;
  island: number;
  /** A creature dwelling's flag over it: hers, or another captain's. */
  flag?: 'own' | 'other';
  /** It rides a turtle island (drawn where she is), or stands on a sandbar. */
  turtle?: number;
  bank?: number;
  /** The island's chain: its step (0 shore, 1 grotto, 2 guardian). */
  chain?: number;
}

/** The lair's card: its creatures, her landing party's might against theirs, the offer, the pay, the chain and the
 *  dwelling. */
export interface LairCard {
  id: string;
  kind: LairKind;
  role: LairRole;
  size: LairSize;
  level: number;
  island: string;
  men: number;
  stacks: { u: UnitId; n: number }[];
  /** Her landing party's might against theirs (the ladder counted), and how many men would land. */
  ratio: number;
  party: number;
  offer: 'join' | 'flee' | null;
  joinN: number;
  /** The boats can reach it now (else: come in to the shore). */
  reach: boolean;
  /** Why it may not be fought now (the chain's earlier step not beaten this week, the turtle under the sea…). */
  why: string | null;
  pay: { silver: number; xp: number };
  /** She has had its loot this week already: beaten again, it is only the lesson. */
  looted?: boolean;
  /** Down (beaten lately): world seconds until it stands again. */
  down?: number;
  /** The island's chain: the steps she has beaten this week. */
  chain?: { step: number; done: boolean[] };
  /** A creature dwelling here (docs/18 #19): its kind, who flies her flag, what waits, and whether she may raise hers. */
  dwell?: { u: BeastId; owner: string | null; own: boolean; pool: number; growth: number; can: boolean; why: string | null };
}

/** What a lair left her (the battle's reckoning ashore). */
export interface LairLoot {
  silver: number;
  xp: number;
  goods: { g: GoodId; n: number }[];
  res: Partial<Record<LandRes | 'pearls', number>>;
  artifact?: string;
  egg?: BeastId;
  /** The island's chest for the whole chain, and its line in the chronicle. */
  chest?: { silver: number; xp: number; artifact?: string };
  /** Its loot was hers this week already. */
  looted?: boolean;
  /** She may raise her flag over its creatures' dwelling. */
  dwell?: boolean;
  /** The island is clear of its lairs: hers for a supply route. */
  claimed?: string;
}

export interface LairsView {
  list: LairMark[];
  res: Record<LandRes, number>;
  eggs: BeastId[];
}

export type LairClientMsg =
  | { t: 'lair'; action: 'fight' | 'join' | 'flee' | 'flag'; id: string }
  | { t: 'lair'; action: 'close' }
  | { t: 'lair'; action: 'nest'; egg: number };

export type LairServerMsg =
  | { t: 'lairs'; view: LairsView }
  | { t: 'lair_card'; card: LairCard | null };
