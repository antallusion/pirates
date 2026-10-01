// The wire of docs/17 H3 (the Heroes' economy): the week, the dwellings and their recruit window, the island's town,
// the mines. Kept apart from protocol.ts, which only takes these unions and the town's view into its own.

import type { ArmyStack, UnitId } from './data/army.ts';
import type { GoodId } from './data/goods.ts';
import type { MineKind } from './data/mines.ts';
import type { TownId } from './data/town.ts';
import type { WeekKind } from './data/week.ts';
import type { OrderId } from './data/hero.ts';

/** The sea's calendar: week `n` (from 1), day 1–7 of it, what the week is named for, world seconds to the next. */
export interface WeekView {
  n: number;
  day: number;
  kind: WeekKind;
  nextIn: number;
}

/** A kind of man a dwelling offers: silver a man and the resources a man asks. */
export interface DwellUnit {
  u: UnitId;
  per: number;
  goods: Partial<Record<GoodId, number>>;
  /** Men of this kind her army's might still has room for (docs/17 H5; -1: no cap — tier 1). */
  room?: number;
}

export interface DwellRow {
  tier: number;
  /** 'tavern' for a port's waterfront; otherwise the dwelling's town id (dw2…dw7). */
  name: 'tavern' | TownId;
  /** The upgraded dwelling: its upgraded name and kind, and stacks trained up here. */
  up: boolean;
  pool: number;
  /** Men it grows a week (this week's name and the keep counted). */
  growth: number;
  units: DwellUnit[];
  /** Why none may be had here (the drowned for the living, a dwelling not built…). */
  why: string | null;
}

/** A stack of the ship's army that may be trained up here, at silver and resources a man. */
export interface DwellUp {
  u: UnitId;
  to: UnitId;
  n: number;
  per: number;
  goods: Partial<Record<GoodId, number>>;
  /** Of them, how many her army's might has room to train up (docs/17 H5). */
  room?: number;
}

export interface DwellView {
  src: 'port' | 'isle';
  place: string;
  rows: DwellRow[];
  ups: DwellUp[];
  army: ArmyStack[];
  slots: number;
  crew: number;
  crewMax: number;
  gold: number;
  /** The resources to hand: the hold in a port; the yard, the island's store and the hold lying off the island. */
  have: Partial<Record<GoodId, number>>;
  /** Men may be taken aboard now (null), or why not. */
  why: string | null;
  week: WeekView;
  /** Picked men (tier 4 and up) she may still berth, of the most her ship's level allows. */
  picked: number;
  pickedMax: number;
  /** Her army's weight in a boarding against the most a ship of her level carries (docs/17 H5), as whole numbers. */
  might?: number;
  mightMax?: number;
}

export interface MineView {
  id: string;
  x: number;
  y: number;
  kind: MineKind;
  island: string;
  /** 'you', 'raiders', another captain's name, or nobody. */
  holder: string | null;
  /** A day's yield; and, for her own, what has piled up at the mine. */
  daily: number;
  stock?: number;
}

export interface TownJobView {
  id: number;
  level: number;
  start: number;
  end: number;
  silver: number;
  goods: Partial<Record<GoodId, number>>;
}

export interface TownThingView {
  id: TownId;
  level: number;
  max: number;
  job: TownJobView | null;
  next: { level: number; silver: number; goods: Partial<Record<GoodId, number>>; secs: number; why: string | null } | null;
  /** A dwelling's men to recruit now and a week's growth. */
  pool?: number;
  growth?: number;
  /** The guild of orders (docs/17 H5): each floor's orders, whether she knows each, and why she may not learn it. */
  orders?: { id: OrderId; floor: number; known: boolean; why: string | null }[];
}

export interface TownView {
  things: TownThingView[];
  keep: number;
  /** The keep's growth: ×1, ×1.5, ×2. */
  growthMul: number;
  /** Silver a day into the treasury: the town hall and the mines, this week. */
  hall: number;
  mines: MineView[];
  minesDaily: Partial<Record<GoodId | 'silver', number>>;
  treasury: number;
  /** The six resources and the stone: the yard with the store (and the hold lying off the island). */
  res: { good: GoodId; n: number }[];
  market: { level: number; sell: Partial<Record<GoodId, number>>; buy: Partial<Record<GoodId, number>> } | null;
  /** She keeps the drowned (the Choir, a cursed ship). */
  deep: boolean;
  near: boolean;
  week: WeekView;
}

export type H3ClientMsg =
  | { t: 'h3'; action: 'dwell'; src: 'port' | 'isle' }
  | { t: 'h3'; action: 'recruit' | 'train'; src: 'port' | 'isle'; u: UnitId; n: number }
  | { t: 'h3'; action: 'build'; id: TownId }
  | { t: 'h3'; action: 'learn'; id: OrderId }
  | { t: 'h3'; action: 'market'; give: GoodId | 'silver'; get: GoodId | 'silver'; n: number }
  | { t: 'h3'; action: 'mines' };

export type H3ServerMsg =
  | { t: 'dwell'; view: DwellView | null }
  | { t: 'week'; view: WeekView }
  | { t: 'mines'; list: MineView[] };
