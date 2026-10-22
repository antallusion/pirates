// The reach of every hand-to-hand thing at sea (owner, 2026-10-22: «Взаимодействие с объектами и нпс надо делать на
// расстоянии 30 метров, а то щас атаковать можно за 400 метров нейтралов, острова и все остальное … абордаж вообще
// только когда поровняюсь с кораблем должен быть. это и у нпс и у игроков надо сделать, у всех короче»).
//
// One module, read by the server's checks, the sea's own captains (npc.ts) and the client's buttons alike, so none of
// them ever disagrees with another. Every reach is measured from her HULL's edge — the keel's line out to half her beam
// (a capsule: a round bow and stern, straight sides) — to the thing's own edge, never centre to centre: a first-rate's
// sixty metres are not held against her.
//
//   - a thing on the water or ashore (a stack, a lair's landing, a wreck, flotsam, a bottle, the fog's cache, a shoal, a
//     treasure mark, a waystation, a floating house, a quest's point, a fight ashore) — REACH_OBJ, thirty metres;
//   - a coast (landing, digging, a mine, a haul, one's own island, an island's quest) — REACH_SHORE from the coastline;
//   - a harbour — REACH_DOCK of its quays or its anchorage, and slow (DOCK_SLOW);
//   - another ship's deck — only alongside: the hulls within BOARD_GAP, side by side (each on the other's beam within
//     BOARD_ARC_DEG), their way matched within BOARD_REL_SPEED. The same for the sea's own captains;
//   - a word across the water (a parley, the white flag's terms, goods passed across) — REACH_HAIL / REACH_OBJ;
//   - the guns keep their own reach (they are weapons); the spyglass its sight (SIGHT_GLASS), on her screen only.

import { closestOnPolygon, headingVec, pointInPolygon } from '../math.ts';

/** Hull edge to a thing's edge (metres): everything stationary or drifting she works with her boats. */
export const REACH_OBJ = 30;
/** Hull edge to the coastline (metres): a landing party, a dig, a lair or a mine ashore, her own island's quay. */
export const REACH_SHORE = 30;
/** Hull edge to a harbour's quays or its anchorage (metres), and her way under DOCK_SLOW (knots of the HUD's scale). */
export const REACH_DOCK = 40;
export const DOCK_SLOW = 4;
/** Boarding: the water between the two hulls the grapples cross (metres), how far off the beam the other may lie
 *  (degrees, each from the other), and the way between them the lines still hold (the HUD's knots, as a vector: two
 *  ships side by side on one course at ten knots are still). */
export const BOARD_GAP = 12;
export const BOARD_ARC_DEG = 35;
export const BOARD_REL_SPEED = 8;
/** Bow and Stern (the talent) and Red Hook (the ultimate): grapples from any quarter within this of the beam. */
export const BOARD_ARC_WIDE_DEG = 70;
/** A parley across the water (the white flag asked of a ship firing on her): hull to hull, no farther than the guns
 *  carry — and only for a ship on the captain's screen (the client's own test). Was 2.5 km. */
export const REACH_HAIL = 500;
/** The spyglass: as far as the glass shows her (and only what is on the captain's screen, the client's own test). */
export const SIGHT_GLASS = 1200;
/** The server's allowance over a reach (metres): the quarter second between her screen and its own reckoning. */
export const REACH_SLACK = 8;
/** A token on the water (a stack, a drift, a find, a bottle, a cache) is about this big about its point (metres). */
export const OBJ_R = 12;
/** Close but not yet in reach: the bar says how far is left within this many metres more (the hint «ещё 12 м»). */
export const REACH_HINT = 80;

/** Every interaction, the reach that rules it (the table the tests walk, docs/38). */
export const REACH_TABLE = {
  stack: 'obj', lair: 'shore', shoreBoss: 'shore', guard: 'obj', advVisit: 'obj', drift: 'obj', find: 'obj', bottle: 'obj', mark: 'obj',
  carcass: 'obj', event: 'obj', dive: 'obj', raise: 'obj', grail: 'obj', way: 'obj', citadel: 'obj', raidGate: 'obj', quest: 'obj',
  land: 'shore', dig: 'shore', mine: 'shore', haul: 'shore', home: 'shore', claim: 'shore', isleQuest: 'shore', keeper: 'shore',
  dock: 'dock', board: 'board', hail: 'hail', barter: 'obj', glass: 'glass',
} as const;
export type ReachKind = (typeof REACH_TABLE)[keyof typeof REACH_TABLE];

/** Her hull as the reach sees it: where she lies, her head, her length and beam. */
export interface Hull {
  x: number;
  y: number;
  heading: number;
  length: number;
  beam: number;
}

/** A ship (server or client) as a hull. */
export function hullOf(s: { state: { x: number; y: number; heading: number }; stats: { length: number; beam: number } }): Hull {
  return { x: s.state.x, y: s.state.y, heading: s.state.heading, length: s.stats.length, beam: s.stats.beam };
}

/** The keel's line: its two ends (the capsule's spine), half her length less half her beam from her middle. */
function keel(h: Hull): [number, number, number, number] {
  const f = headingVec(h.heading);
  const k = Math.max(0, h.length / 2 - h.beam / 2);
  return [h.x - f.x * k, h.y - f.y * k, h.x + f.x * k, h.y + f.y * k];
}

function segPoint(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax, ey = by - ay;
  const l2 = ex * ex + ey * ey;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), py - (ay + ey * t));
}

/** Metres of water between her hull and a thing of radius `r` at (x, y) (negative: over it). */
export function gapTo(h: Hull, x: number, y: number, r = 0): number {
  const [ax, ay, bx, by] = keel(h);
  return segPoint(x, y, ax, ay, bx, by) - h.beam / 2 - r;
}

/** Metres between her hull and a coast (the island's outline; negative: aground over it). Five stations of her keel. */
export function gapToShore(h: Hull, poly: ArrayLike<number>): number {
  const [ax, ay, bx, by] = keel(h);
  let least = Infinity;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    const d = Math.sqrt(closestOnPolygon(x, y, poly).d2);
    least = Math.min(least, pointInPolygon(x, y, poly) ? -d : d);
  }
  return least - h.beam / 2;
}

/** A thing ashore (a lair, a great one risen, a quest's site) is landed against from the stretch of beach nearest it:
 *  the coast's point nearest the thing, and this much of the shore either way of it (metres). */
export const LANDING_R = 20;

/** The beach a thing ashore at (x, y) is landed against: the nearest point of its island's coast. */
export function landingPoint(poly: ArrayLike<number>, x: number, y: number): { x: number; y: number } {
  const c = closestOnPolygon(x, y, poly);
  return { x: c.x, y: c.y };
}

/** Within the landing party's reach of a thing ashore at (x, y): her hull within REACH_SHORE of its beach. */
export function landingWithin(h: Hull, poly: ArrayLike<number>, x: number, y: number, slack = 0): boolean {
  const lp = landingPoint(poly, x, y);
  return gapTo(h, lp.x, lp.y, LANDING_R) <= REACH_SHORE + slack;
}

/** Metres between her hull and an island's coast, or Infinity when she is plainly beyond `reach` of it (the coarse
 *  test on its middle and radius first: a sea of islands is cheap). */
export function shoreGap(h: Hull, isl: { x: number; y: number; poly: ArrayLike<number> }, radius: number, reach = REACH_SHORE): number {
  if (Math.abs(isl.x - h.x) > radius + reach + h.length || Math.abs(isl.y - h.y) > radius + reach + h.length) return Infinity;
  if (Math.hypot(isl.x - h.x, isl.y - h.y) > radius + reach + h.length / 2) return Infinity;
  return gapToShore(h, isl.poly);
}

/** Within `reach` of an island's coast (a landing, a dig, a mine, her own island). */
export function shoreWithin(h: Hull, isl: { x: number; y: number; poly: ArrayLike<number> }, radius: number, reach = REACH_SHORE): boolean {
  return shoreGap(h, isl, radius, reach) <= reach;
}

/** Metres of water between two hulls (negative: they overlap). */
export function hullsGap(a: Hull, b: Hull): number {
  const [a0x, a0y, a1x, a1y] = keel(a);
  const [b0x, b0y, b1x, b1y] = keel(b);
  // Two segments: crossing, they touch; else the least of the four ends to the other segment.
  const cross = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = cross(a0x, a0y, a1x, a1y, b0x, b0y), d2 = cross(a0x, a0y, a1x, a1y, b1x, b1y);
  const d3 = cross(b0x, b0y, b1x, b1y, a0x, a0y), d4 = cross(b0x, b0y, b1x, b1y, a1x, a1y);
  const spine = d1 * d2 < 0 && d3 * d4 < 0
    ? 0
    : Math.min(segPoint(b0x, b0y, a0x, a0y, a1x, a1y), segPoint(b1x, b1y, a0x, a0y, a1x, a1y), segPoint(a0x, a0y, b0x, b0y, b1x, b1y), segPoint(a1x, a1y, b0x, b0y, b1x, b1y));
  return spine - a.beam / 2 - b.beam / 2;
}

/** How far (degrees) a point lies off her nearer beam: 0 square abeam, 90 dead ahead or astern. */
export function offBeamDeg(h: Hull, x: number, y: number): number {
  const f = headingVec(h.heading);
  const dx = x - h.x, dy = y - h.y;
  const l = Math.hypot(dx, dy);
  if (l < 1e-6) return 0;
  const along = Math.abs(dx * f.x + dy * f.y) / l;
  return (Math.asin(Math.min(1, along)) * 180) / Math.PI;
}

/** Within `reach` of a thing (hull edge to its edge). */
export function inReach(h: Hull, x: number, y: number, r = OBJ_R, reach = REACH_OBJ): boolean {
  return gapTo(h, x, y, r) <= reach;
}

/** Metres still to sail to come within reach of it (0: within). */
export function reachLeft(h: Hull, x: number, y: number, r = OBJ_R, reach = REACH_OBJ): number {
  return Math.max(0, gapTo(h, x, y, r) - reach);
}

/** The centre-to-centre distance a ship of `length` may lie at and still be within `reach` of a thing of radius `r`
 *  in the best case (her bow or stern to it): the coarse first test, and where a course to it should end inside. */
export function reachSpan(length: number, r = OBJ_R, reach = REACH_OBJ): number {
  return length / 2 + r + reach;
}

/** Two hulls fend each other off at sea as two discs of BUMP_SHARE of their length (Game.ts collideShips): long ships
 *  lie that much farther apart beam to beam than their beams. */
export const BUMP_SHARE = 0.32;

/** The water between two hulls as the grapples see it: the gap, less what their fenders keep between them anyway (two
 *  frigates side by side cannot lie closer than their bump discs allow). */
export function boardGap(a: Hull, b: Hull): number {
  const keep = Math.max(0, BUMP_SHARE * (a.length + b.length) - (a.beam + b.beam) / 2);
  return hullsGap(a, b) - keep;
}

/** A ship's way as a vector (the HUD's knots scale: `speed` along her head). */
function wayOf(h: { heading: number }, speed: number): { x: number; y: number } {
  const f = headingVec(h.heading);
  return { x: f.x * speed, y: f.y * speed };
}

export interface AlongsideOpts {
  /** The grapples' reach as a share of BOARD_GAP (the talents and the gear on `boardingRange`). */
  gapMul?: number;
  /** How far off the beam the other may lie (degrees): BOARD_ARC_DEG; Bow and Stern, Red Hook BOARD_ARC_WIDE_DEG; a
   *  ram's grapple (Hull to Hull) 90 — any quarter. */
  arcDeg?: number;
  /** The way between them is not asked (held fast, tangled, struck, rammed, Red Hook). */
  anySpeed?: boolean;
  /** Her limit on the way between them, when not BOARD_REL_SPEED (Match Speed's talent). */
  relMax?: number;
}

/** Why the grapples cannot fly between `a` and `b` (speeds in the HUD's knots), or null: alongside. `far` — the water
 *  between the hulls is more than the grapples cross; `abeam` — not side by side (astern, ahead, bow on: each must lie
 *  on the other's beam); `speed` — the way between them is more than the lines hold. */
export function alongsideWhy(a: Hull, aSpeed: number, b: Hull, bSpeed: number, o: AlongsideOpts = {}): 'far' | 'abeam' | 'speed' | null {
  if (boardGap(a, b) > BOARD_GAP * Math.max(1, o.gapMul ?? 1)) return 'far';
  const arc = o.arcDeg ?? BOARD_ARC_DEG;
  if (arc < 90 && (offBeamDeg(a, b.x, b.y) > arc || offBeamDeg(b, a.x, a.y) > arc)) return 'abeam';
  if (!o.anySpeed) {
    const va = wayOf(a, aSpeed), vb = wayOf(b, bSpeed);
    if (Math.hypot(va.x - vb.x, va.y - vb.y) > (o.relMax ?? BOARD_REL_SPEED)) return 'speed';
  }
  return null;
}

/** Where to lie alongside `b` (her beam on the side `a` is on, BOARD_GAP·0.5 of water between): the point and the head
 *  to hold there (her course). The helm of a boarder, a captain's helmsman and the sea's own alike. */
export function alongsidePoint(a: Hull, b: Hull): { x: number; y: number; heading: number; side: 1 | -1 } {
  const f = headingVec(b.heading);
  const rx = -f.y, ry = f.x; // her starboard (heading 0 north: starboard east)
  const side: 1 | -1 = (a.x - b.x) * rx + (a.y - b.y) * ry >= 0 ? 1 : -1;
  const off = Math.max(a.beam / 2 + b.beam / 2 + BOARD_GAP * 0.5, BUMP_SHARE * (a.length + b.length) + 4);
  return { x: b.x + rx * off * side, y: b.y + ry * off * side, heading: b.heading, side };
}
