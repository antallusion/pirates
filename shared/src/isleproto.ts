// The wire of docs/18 III (more islands, islands by their levels): the zones of one level, the turtle islands, the
// supply routes from a claimed lair island to a captain's own. Kept apart from protocol.ts, which only takes these
// unions into its own.

import type { IsleType, IsleZone } from './world/archipelago.ts';
import type { RegionId } from './world/regions.ts';

/** A zone of one level on the chart (docs/18 #29). */
export type ZoneView = IsleZone;

/** A turtle island (docs/18 #31): her loop, so the client draws her where she is between the server's words. */
export interface TurtleView {
  id: number;
  name: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
  lap: number;
  ph: number;
  r: number;
  level: number;
  /** Above the sea now; when she next dives or rises (world seconds); her back combed by this captain this rise. */
  up: boolean;
  turn: number;
  combed: boolean;
}

/** A lair island a captain has claimed (docs/18 #32), linked to her own island or not. */
export interface SupplyIsle {
  island: number;
  name: string;
  x: number;
  y: number;
  type: IsleType;
  level: number;
  region: RegionId;
  /** How it was claimed: a named pirate's lair stormed, a lair of the land's creatures (section II), the tester. */
  kind: 'pirate' | 'creature' | 'admin';
  /** A week's delivery down the route. */
  good: string;
  n: number;
  linked: boolean;
  /** Why it cannot be linked now (English, as the server says it). */
  why: string | null;
  /** The last week it delivered (the sea's week number), when linked. */
  last?: number;
}

export interface SupplyView {
  home: { island: number; name: string; x: number; y: number } | null;
  isles: SupplyIsle[];
  max: number;
  /** World seconds to the next week's first dawn (the delivery). */
  nextIn: number;
  week: number;
}

export type IsleServerMsg =
  | { t: 'zones'; list: ZoneView[] }
  | { t: 'turtles'; list: TurtleView[] }
  | { t: 'supply'; view: SupplyView };

export type IsleClientMsg = { t: 'isle18'; action: 'supply' | 'link' | 'unlink'; island?: number };
