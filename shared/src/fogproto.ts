// The wire of the fog of war and the scouts (owner, 2026-10-17; shared/src/data/fog.ts). Kept apart from protocol.ts,
// which only takes these unions into its own.

/** One of her scouts as the island's card and the charts draw her. */
export interface ScoutView {
  id: string;
  /** Her name's index (SCOUT_NAMES). */
  name: number;
  state: 'building' | 'home' | 'out';
  /** On the slipway: done at (wall ms). */
  ready?: number;
  /** At sea: her whole course, out and home (flat x, y in metres), when she set out (wall ms), her way (m/s of the wall
   *  clock), its length, and where on it she turns for home (metres along). */
  route?: number[];
  t0?: number;
  total?: number;
  back?: number;
  auto?: boolean;
  /** The squares of the sea she has cleared on this voyage so far. */
  found?: number;
}

export interface ScoutsView {
  /** The island's shipyard level (0: none, or no island) and the scouts it keeps. */
  yard: number;
  max: number;
  list: ScoutView[];
  /** Her island (where they put out from and come home to). */
  home: { x: number; y: number } | null;
  /** Why a new one cannot be laid down now (English, as the server says it). */
  why: string | null;
  speed: number;
  range: number;
  /** The server's wall clock when the view was made, and its pace (admin /speed). */
  now: number;
  rate: number;
  /** The squares of the sea she has seen, and of all. */
  seen: number;
  cells: number;
}

export type FogServerMsg =
  /** Her fog: all of it (base64 bits, at the start), or the squares newly seen. */
  | { t: 'fog'; all?: string; add?: number[] }
  | { t: 'scouts'; view: ScoutsView };

export type FogClientMsg =
  /** «build» lays a scout down; «send» sends one to a point (x, y), «auto» to the nearest fog and on; «recall» brings
   *  her home; «view» asks for the list. */
  | { t: 'scout'; action: 'view' | 'build' | 'send' | 'auto' | 'recall'; id?: string; x?: number; y?: number };
