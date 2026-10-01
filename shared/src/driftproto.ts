// The wire of docs/18 IV (drifting creatures, the creatures of the army): the drifts a captain sees on the sea, the
// drift's card with its ways of rescue and the mini-game, the offer of the beaten after a fight, and the creatures'
// window (their food, their hunger and ranks, the peoples of the army, the pen of her island, a port's tamer). Kept
// apart from protocol.ts, which only takes these unions into its own.

import type { UnitId } from './data/army.ts';
import type { CreatureId } from './data/bestiary.ts';
import type { DriftKind, Food, People, RescueWay } from './data/drifts.ts';
import type { GoodId } from './data/goods.ts';

/** A drift as the minimap and the sea show it. */
export interface DriftMark {
  id: number;
  kind: DriftKind;
  x: number;
  y: number;
  level: number;
  n: number;
  /** World seconds left before it is gone. */
  left: number;
  /** World seconds it lasts in all (the ring of its clock). */
  ttl: number;
  legend?: boolean;
  /** Another captain is at it (a legend's rescue or fight is one captain's). */
  taken?: boolean;
}

export interface DriftWayView {
  way: RescueWay;
  chance: number;
  cost: { good: GoodId; n: number } | null;
  /** Why this way cannot be tried now (null: it can). */
  why: string | null;
}

/** The rescue's mini-game under way: the needle's start (world seconds) and phase, the taps made. */
export interface DriftMini {
  way: RescueWay;
  t0: number;
  phase: number;
  taps: boolean[];
  chance: number;
}

export interface DriftCard {
  id: number;
  kind: DriftKind;
  level: number;
  u: CreatureId;
  n: number;
  left: number;
  reach: boolean;
  ways: DriftWayView[];
  /** How many of them her army has room for (hammocks and a slot); the pen at home has room for. */
  room: number;
  pen: number;
  /** They will not serve her (the drowned for a living crew; a legend's second captain): saved, they give a gift. */
  gift: { good: GoodId; n: number; silver: number };
  joins: boolean;
  /** Why it may not be fought now (null: it may). */
  fightWhy: string | null;
  /** Why nothing may be done now (another captain at a legend, under fire, too fast). */
  why: string | null;
  mini?: DriftMini;
  legend?: boolean;
}

/** The offer of the beaten after a fight won (docs/18 #36), on the battle's reckoning. */
export interface CaptureOffer {
  u: UnitId;
  n: number;
  /** The share of the beaten that would follow her. */
  share: number;
  /** Of them, how many her army has room for, and the pen at home. */
  room: number;
  pen: number;
  /** Chosen: aboard, home to the pen, let go. */
  done?: 'take' | 'pen' | 'free';
}

/** One kind of creature in her army, as the creatures' window shows it. */
export interface TameStack {
  u: UnitId;
  n: number;
  people: People;
  food: Food;
  /** Units of its food a minute, and the seconds it has gone unfed. */
  perMin: number;
  hunger: number;
  rank: number;
  wins: number;
  /** Wins to its next rank (0: the top). */
  next: number;
}

export interface TameView {
  stacks: TameStack[];
  /** Food in her hold, as units (salted fish two a barrel), and the land's bone in her store. */
  food: { fish: number; rum: number; bone: number };
  /** Units of each food an hour, and their silver. */
  perHour: { fish: number; rum: number };
  silverHour: number;
  /** The mixed army's morale (HoMM3's) and its peoples. */
  morale: number;
  peoples: { p: People; n: number; native: boolean }[];
  path: string | null;
  slots: number;
  stacksN: number;
  crew: number;
  crewMax: number;
  /** Her island's pen: lying off it (to send and take), its level, load and room, what waits in it. */
  pen: { here: boolean; level: number; load: number; cap: number; stock: { u: CreatureId; n: number }[] } | null;
  /** A tamer in the port she lies in: what she pays for each kind aboard, and her pens this week. */
  tamer: { port: string; buys: { u: UnitId; n: number; price: number }[]; sells: { u: CreatureId; n: number; price: number }[] } | null;
  gold: number;
}

export type DriftClientMsg =
  | { t: 'drift'; action: 'way'; id: number; way: RescueWay }
  | { t: 'drift'; action: 'tap'; id: number; at?: number }
  | { t: 'drift'; action: 'roll' | 'fight' | 'cancel'; id: number }
  | { t: 'drift'; action: 'capture'; choice: 'take' | 'pen' | 'free' }
  | { t: 'drift'; action: 'tame' }
  | { t: 'drift'; action: 'release' | 'topen' | 'frompen' | 'sell' | 'buy'; u: UnitId; n: number };

export type DriftServerMsg =
  | { t: 'drifts'; list: DriftMark[] }
  | { t: 'drift_card'; card: DriftCard | null }
  | { t: 'tame'; view: TameView };
