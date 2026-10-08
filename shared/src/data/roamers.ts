// docs/19 D7 (owner, 2026-10-02: «ты не сделал существ на карте, о которых я просил. они должны быть гораздо чаще
// встречаться, много. доступные для всех пользователей ради опыта»): the sea's creatures standing on the open water as
// HoMM3's neutral stacks stand on its adventure map — gulls rafted on the swell, seals, sharks, sea turtles, serpents,
// the tentacles of the lagoons, mermaids, the drowned of the surf, young serpents, lantern maws, leviathans, ancient
// turtles — about one in every square of 1.1 km of open sea (one every 1.3 km of a sailing track), the same for every
// captain. A stack keeps to its spot (a slow wander round it, never a chase); its might is its square's level and its
// size; fought on the battle at sea the
// drifts are fought on (docs/18 IV), it is a captain's road to her levels: its lesson the most of it, a little silver,
// the creatures' resources, now and then an artifact. Beaten, it stands again a little way off 3–6 minutes later.
//
// Everything here is the world's alone (its seed and its squares): a stack's id is its cell of the grid, so it stays
// what and where it is whatever the sea grows later (a new island over a cell only takes that one stack away; nothing
// else moves). Balance: tests/balance/roamers.ts, node tools/balance-roamers.ts.

import { UNITS, armyPower, isPremiumUnit } from './army.ts';
import type { ArmyStack, UnitId } from './army.ts';
import { advHour, advLevelXp, buildAdv, guardBaseMight } from './advmap.ts';
import { BEAST_RES, LAND_RES_DEF } from './bestiary.ts';
import type { CreatureId, LandRes } from './bestiary.ts';
import { hullsFor, xpForGap } from './shiplevel.ts';
import { SHIP_CLASSES } from './ships.ts';
import type { IsleType } from '../world/archipelago.ts';
import { WORLD_SIZE } from '../constants.ts';
import { hash2 } from '../rng.ts';
import type { RegionId } from '../world/regions.ts';
import { WORLD_EDGE_MARGIN } from '../world/regions.ts';
import { sectorAt } from '../world/sectors.ts';
import { isLand, portLanes, regionAt, segDist } from '../world/worldgen.ts';
import type { World } from '../world/worldgen.ts';

// ------------------------------------------------------------------------------------------------ the kinds

export interface RoamDef {
  u: CreatureId;
  /** The levels of the squares it roams. */
  lv: [number, number];
  /** Its waters (absent: any). */
  regions?: RegionId[];
  weight: number;
  /** The battle's field (the drifts' kinds of ground: rocks, the weed, a graveyard of wrecks…). */
  field: IsleType;
}

export type RoamKind = 'gull' | 'seal' | 'reef_shark' | 'sea_turtle' | 'marsh_serpent' | 'lagoon_tentacle' | 'mermaid' | 'surf_drowned' | 'young_serpent' | 'lantern_maw' | 'shoal_leviathan' | 'ancient_turtle'
  // The wild beasts of the sea (owner, 2026-10-03).
  | 'barracuda' | 'albatross' | 'moray' | 'giant_octopus';
export const ROAM_KINDS: RoamKind[] = ['gull', 'seal', 'reef_shark', 'sea_turtle', 'marsh_serpent', 'lagoon_tentacle', 'mermaid', 'surf_drowned', 'young_serpent', 'lantern_maw', 'shoal_leviathan', 'ancient_turtle',
  'barracuda', 'albatross', 'moray', 'giant_octopus'];
export const isRoamKind = (k: unknown): k is RoamKind => typeof k === 'string' && (ROAM_KINDS as string[]).includes(k);

/** The cold waters (the seals' rookeries) and the strange ones (the drowned and the lantern maws). */
const COLD: RegionId[] = ['black_coast', 'leviathan_reach', 'whispering', 'gravewater', 'ashen_isles'];
const STRANGE: RegionId[] = ['gravewater', 'dead_mans_expanse', 'drowned_crown', 'whispering', 'leviathan_reach', 'ashen_isles', 'the_abyss'];
/** The reef waters (the morays' holes): the islets' fog, the atolls, the drowned spires. */
const REEF: RegionId[] = ['whispering', 'gravewater', 'dead_mans_expanse', 'drowned_crown'];

export const ROAMS: Record<RoamKind, RoamDef> = {
  gull: { u: 'gull', lv: [1, 3], weight: 3, field: 'rocky' },
  seal: { u: 'seal', lv: [1, 5], regions: COLD, weight: 3, field: 'rocky' },
  reef_shark: { u: 'reef_shark', lv: [2, 6], weight: 3, field: 'tropical' },
  sea_turtle: { u: 'sea_turtle', lv: [3, 7], weight: 2, field: 'swamp' },
  marsh_serpent: { u: 'marsh_serpent', lv: [3, 6], weight: 2, field: 'swamp' },
  lagoon_tentacle: { u: 'lagoon_tentacle', lv: [4, 8], weight: 2, field: 'volcanic' },
  mermaid: { u: 'mermaid', lv: [4, 8], weight: 2, field: 'tropical' },
  surf_drowned: { u: 'surf_drowned', lv: [5, 9], regions: STRANGE, weight: 2, field: 'dead' },
  young_serpent: { u: 'young_serpent', lv: [6, 10], weight: 2, field: 'graveyard' },
  lantern_maw: { u: 'lantern_maw', lv: [7, 10], regions: STRANGE, weight: 2, field: 'dead' },
  shoal_leviathan: { u: 'shoal_leviathan', lv: [8, 10], weight: 1.5, field: 'rocky' },
  ancient_turtle: { u: 'ancient_turtle', lv: [9, 10], weight: 1, field: 'swamp' },
  // The wild beasts of the sea (owner, 2026-10-03): a shoal of barracudas, a flock of albatrosses after the ships, the
  // morays of the reef waters, now and then a giant octopus off its wreck in the deep.
  barracuda: { u: 'barracuda', lv: [2, 6], weight: 2.5, field: 'tropical' },
  albatross: { u: 'albatross', lv: [3, 7], weight: 2, field: 'rocky' },
  moray: { u: 'moray', lv: [3, 7], regions: REEF, weight: 2, field: 'rocky' },
  giant_octopus: { u: 'giant_octopus', lv: [6, 10], weight: 1, field: 'graveyard' },
};

/** The kinds a square of ⚓L in a sea keeps, with their weights (never a premium kind: the shop's alone). */
export function roamKindsFor(level: number, region: RegionId): [RoamKind, number][] {
  return ROAM_KINDS.filter((k) => {
    const d = ROAMS[k];
    return !isPremiumUnit(roamUnit(k)) && level >= d.lv[0] && level <= d.lv[1] && (!d.regions || d.regions.includes(region));
  }).map((k) => [k, ROAMS[k].weight]);
}

export const roamUnit = (kind: RoamKind): UnitId => ROAMS[kind].u as UnitId;

// ------------------------------------------------------------------------------------------------ where they stand

/** The grid's cell (metres): one stack a cell of open water at most. */
export const ROAM_GRID = 1100;
export const ROAM_GN = Math.floor(WORLD_SIZE / ROAM_GRID);
/** How far a stack wanders round its spot (metres), and how slowly (seconds a round). */
export const ROAM_WANDER = 90;
export const ROAM_PERIOD = 300;
/** The open water a spot keeps: off any shore, off a harbour, off the lanes between ports, the reefs, the dense sea's
 *  marks and the adventure map's things and guards. */
export const ROAM_SHORE = 260;
export const ROAM_HARBOUR = 1500;
export const ROAM_LANE = 260;
const KEEP_REEF = 220, KEEP_MARK = 140, KEEP_ADV = 320;
/** Within this of a stack her action bar offers the fight (metres from it). */
export const ROAM_REACH = 250;
/** The stacks a captain is told of, about her (metres), and those on her minimap at full strength (the rest fade). */
export const ROAM_SEE = 4500;
export const ROAM_MINI = 2600;
/** A beaten stack stands again this many seconds later (world seconds), a little way off (metres). */
export const ROAM_RESPAWN: [number, number] = [180, 360];
export const ROAM_SHIFT = 380;
/** A stack that threw her back keeps what is left of it this long before it is whole again. */
export const ROAM_HEAL = 360;
/** Group mates within this of the stack when it is beaten share in it. */
export const ROAM_SHARE_R = 1500;

export type RoamSize = 'weak' | 'avg' | 'strong';
export const ROAM_SIZES: RoamSize[] = ['weak', 'avg', 'strong'];
/** How often a stack is of each size. */
export const ROAM_SIZE_W: Record<RoamSize, number> = { weak: 0.45, avg: 0.4, strong: 0.15 };
/** What a stack of each size costs the reference captain of its level in men, on average (the calibration's target):
 *  far lighter than the guards' and the lairs' (12/30/60%) — the stacks are a road to the levels, not a toll. */
export const ROAM_LOSS: Record<RoamSize, number> = { weak: 0.04, avg: 0.08, strong: 0.16 };
/** A fight at sea won: this share of her fallen are hauled back out of the water alive (knocked overboard, not killed). */
export const ROAM_RAISE = 0.7;

export interface RoamSpot {
  /** Its cell of the grid (gy × ROAM_GN + gx): the stack's id for good. */
  id: number;
  kind: RoamKind;
  level: number;
  size: RoamSize;
  /** Its creatures, whole. */
  n: number;
  x: number;
  y: number;
  /** The wander's own phase. */
  seed: number;
}

/** A cell's own number for a salt (the world's seed in it). */
const hc = (world: World, id: number, salt: number): number => hash2(id % ROAM_GN, Math.floor(id / ROAM_GN), (world.seed * 2654435761 + salt) >>> 0);
const u01 = (h: number) => (h % 100000) / 100000;

interface Keep {
  x: number;
  y: number;
  r: number;
}

/** Everything a stack keeps off, in buckets of 2 km (the lanes apart: segments). */
interface Keeps {
  buckets: Map<number, Keep[]>;
  lanes: [number, number, number, number][];
  laneBuckets: Map<number, number[]>;
}
const KB = 2000;
const kkey = (bx: number, by: number) => by * 1000 + bx;
const keepCache = new WeakMap<World, Keeps>();

function keepsOf(world: World): Keeps {
  const hit = keepCache.get(world);
  if (hit) return hit;
  const buckets = new Map<number, Keep[]>();
  const add = (x: number, y: number, r: number) => {
    const k = { x, y, r };
    for (let by = Math.floor((y - r) / KB); by <= Math.floor((y + r) / KB); by++) for (let bx = Math.floor((x - r) / KB); bx <= Math.floor((x + r) / KB); bx++) {
      const kk = kkey(bx, by);
      const b = buckets.get(kk);
      if (b) b.push(k);
      else buckets.set(kk, [k]);
    }
  };
  for (const p of world.ports) add(p.x, p.y, ROAM_HARBOUR);
  for (const q of world.reefs) add(q.x, q.y, q.radius + KEEP_REEF);
  for (const m of world.marks) add(m.x, m.y, m.r + KEEP_MARK);
  for (const w of world.whirlpools) add(w.x, w.y, w.radius * 1.4);
  const adv = buildAdv(world);
  for (const o of adv.objs) add(o.x, o.y, KEEP_ADV);
  for (const g of adv.guards) add(g.x, g.y, KEEP_ADV);
  // The lanes of the harbours before step 8's twenty towns and the lanes as they run now: a new town's lanes take the
  // stacks off them, and no stack comes onto a lane the old harbours sailed (nothing appears; shared/src/world/newports.ts).
  const old = world.ports.slice(0, world.portsFrom ?? world.ports.length);
  const lanes = portLanes(old);
  if (old.length < world.ports.length) {
    const seen = new Set(lanes.map((l) => l.join(',')));
    for (const l of portLanes(world.ports)) if (!seen.has(l.join(','))) lanes.push(l);
  }
  const laneBuckets = new Map<number, number[]>();
  lanes.forEach(([ax, ay, bx, by], i) => {
    const pad = ROAM_LANE + 10;
    for (let y = Math.floor((Math.min(ay, by) - pad) / KB); y <= Math.floor((Math.max(ay, by) + pad) / KB); y++) {
      for (let x = Math.floor((Math.min(ax, bx) - pad) / KB); x <= Math.floor((Math.max(ax, bx) + pad) / KB); x++) {
        const kx = (x + 0.5) * KB, ky = (y + 0.5) * KB;
        if (segDist(kx, ky, ax, ay, bx, by) > KB * 0.71 + pad) continue;
        const kk = kkey(x, y);
        const b = laneBuckets.get(kk);
        if (b) b.push(i);
        else laneBuckets.set(kk, [i]);
      }
    }
  });
  const out = { buckets, lanes, laneBuckets };
  keepCache.set(world, out);
  return out;
}

/** Open water a stack may keep to: off every shore, the harbours, the lanes, the reefs, the marks, the map's things,
 *  the maelstroms and the Wall. */
export function roamWater(world: World, x: number, y: number): boolean {
  const m = WORLD_EDGE_MARGIN + 900;
  if (x < m || y < m || x > WORLD_SIZE - m || y > WORLD_SIZE - m) return false;
  if (isLand(world, x, y)) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (isLand(world, x + Math.sin(a) * ROAM_SHORE, y - Math.cos(a) * ROAM_SHORE)) return false;
  }
  const K = keepsOf(world);
  const kk = kkey(Math.floor(x / KB), Math.floor(y / KB));
  for (const o of K.buckets.get(kk) ?? []) if (Math.abs(o.x - x) < o.r && Math.abs(o.y - y) < o.r && Math.hypot(o.x - x, o.y - y) < o.r) return false;
  for (const i of K.laneBuckets.get(kk) ?? []) {
    const [ax, ay, bx, by] = K.lanes[i];
    if (segDist(x, y, ax, ay, bx, by) < ROAM_LANE) return false;
  }
  return true;
}

/** A stack's level in its square: the square's own most often, a level either side now and then. */
function levelIn(world: World, x: number, y: number, h: number): number {
  const sec = sectorAt(world, x, y);
  const r = h % 8;
  const L = r < 1 ? sec.band[0] : r > 6 ? sec.band[1] : sec.level;
  return Math.max(1, Math.min(10, L));
}

/** The stack a cell of the grid keeps (null: land, a harbour, a lane, no kind for its waters). */
export function roamAt(world: World, id: number): RoamSpot | null {
  const gx = id % ROAM_GN, gy = Math.floor(id / ROAM_GN);
  if (gx < 0 || gy < 0 || gy >= ROAM_GN) return null;
  const x = Math.round((gx + 0.5) * ROAM_GRID + (u01(hc(world, id, 0x7a01)) - 0.5) * ROAM_GRID * 0.7);
  const y = Math.round((gy + 0.5) * ROAM_GRID + (u01(hc(world, id, 0x7a02)) - 0.5) * ROAM_GRID * 0.7);
  if (!roamWater(world, x, y)) return null;
  const level = levelIn(world, x, y, hc(world, id, 0x7a03));
  const kinds = roamKindsFor(level, regionAt(world, x, y));
  if (!kinds.length) return null;
  const tot = kinds.reduce((a, [, w]) => a + w, 0);
  let t = u01(hc(world, id, 0x7a04)) * tot;
  let kind = kinds[kinds.length - 1][0];
  for (const [k, w] of kinds) {
    if (t < w) {
      kind = k;
      break;
    }
    t -= w;
  }
  const sr = u01(hc(world, id, 0x7a05));
  const size: RoamSize = sr < ROAM_SIZE_W.weak ? 'weak' : sr < ROAM_SIZE_W.weak + ROAM_SIZE_W.avg ? 'avg' : 'strong';
  return { id, kind, level, size, n: roamCount(kind, level, size), x, y, seed: hc(world, id, 0x7a06) % 100000 };
}

export interface RoamIndex {
  list: RoamSpot[];
  byId: Map<number, RoamSpot>;
  /** Buckets of ROAM_BUCKET metres: the stacks in each. */
  buckets: Map<number, RoamSpot[]>;
}
export const ROAM_BUCKET = 3000;
const BN = Math.ceil(WORLD_SIZE / ROAM_BUCKET);
const bucketOf = (x: number, y: number): number => Math.max(0, Math.min(BN - 1, Math.floor(y / ROAM_BUCKET))) * BN + Math.max(0, Math.min(BN - 1, Math.floor(x / ROAM_BUCKET)));

const cache = new WeakMap<World, RoamIndex>();

/** Every stack of the world, indexed (kept for the world object). */
export function buildRoamers(world: World): RoamIndex {
  const hit = cache.get(world);
  if (hit) return hit;
  const list: RoamSpot[] = [];
  for (let id = 0; id < ROAM_GN * ROAM_GN; id++) {
    const r = roamAt(world, id);
    if (r) list.push(r);
  }
  const byId = new Map(list.map((r) => [r.id, r]));
  const buckets = new Map<number, RoamSpot[]>();
  for (const r of list) {
    const k = bucketOf(r.x, r.y);
    const b = buckets.get(k);
    if (b) b.push(r);
    else buckets.set(k, [r]);
  }
  const out = { list, byId, buckets };
  cache.set(world, out);
  return out;
}

/** The stacks whose spots lie within `r` of a point (the wander and the shift kept in by the caller's slack). */
export function roamersNear(idx: RoamIndex, x: number, y: number, r: number): RoamSpot[] {
  const out: RoamSpot[] = [];
  const x0 = Math.max(0, Math.floor((x - r) / ROAM_BUCKET)), x1 = Math.min(BN - 1, Math.floor((x + r) / ROAM_BUCKET));
  const y0 = Math.max(0, Math.floor((y - r) / ROAM_BUCKET)), y1 = Math.min(BN - 1, Math.floor((y + r) / ROAM_BUCKET));
  for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) {
    for (const s of idx.buckets.get(by * BN + bx) ?? []) if (Math.abs(s.x - x) <= r && Math.abs(s.y - y) <= r && (s.x - x) ** 2 + (s.y - y) ** 2 <= r * r) out.push(s);
  }
  return out;
}

/** Where a stack is at a world time, its spot at (bx, by): the slow wander round it (the client draws the same). */
export function roamPos(seed: number, bx: number, by: number, t: number): { x: number; y: number } {
  const w = (Math.PI * 2) / ROAM_PERIOD;
  const p = (seed % 628) / 100, q = ((seed >> 3) % 628) / 100;
  return { x: bx + Math.sin(t * w + p) * ROAM_WANDER, y: by + Math.cos(t * w * 0.77 + q) * ROAM_WANDER * 0.8 };
}

/** The spot a stack stands again at after its k-th beating: a little way off its own (k 0: its own), open water. */
export function roamShift(world: World, spot: { id: number; x: number; y: number }, k: number): { x: number; y: number } {
  if (k <= 0) return { x: spot.x, y: spot.y };
  for (let tryN = 0; tryN < 3; tryN++) {
    const a = u01(hc(world, spot.id, 0x5100 + k * 7 + tryN)) * Math.PI * 2;
    const d = ROAM_SHIFT * (0.4 + 0.6 * u01(hc(world, spot.id, 0x5200 + k * 7 + tryN)));
    const x = Math.round(spot.x + Math.sin(a) * d), y = Math.round(spot.y - Math.cos(a) * d);
    if (roamWater(world, x, y)) return { x, y };
  }
  return { x: spot.x, y: spot.y };
}

/** Seconds a stack beaten for the k-th time stays down. */
export function roamDown(world: World, id: number, k: number): number {
  return Math.round(ROAM_RESPAWN[0] + (ROAM_RESPAWN[1] - ROAM_RESPAWN[0]) * u01(hc(world, id, 0x5300 + k)));
}

// ------------------------------------------------------------------------------------------------ their might

/** The share of the reference captain's might a stack is first reckoned at (then the calibration). */
const ROAM_BASE = 0.4;

/** How many times its first reckoning each kind stands with, by level and size, so that it costs the reference
 *  captain its ROAM_LOSS (node tools/balance-roamers.ts --calibrate, from the battle itself). Index: level 0–10. */
export const ROAM_CAL: Record<RoamKind, [number, number, number][]> = {
  gull: [[0, 0, 0], [1, 1.13, 1.42], [0.87, 0.87, 1.22], [0.4, 0.55, 0.77], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  seal: [[0, 0, 0], [1.02, 1.02, 1.83], [1.1, 1.1, 1.42], [1.1, 1.1, 1.7], [0.62, 1.07, 1.29], [0.59, 0.89, 1.2], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  reef_shark: [[0, 0, 0], [0, 0, 0], [0.05, 0.44, 0.74], [0.28, 0.84, 1.4], [0.37, 0.78, 1.1], [0.32, 0.55, 1.06], [0.26, 0.46, 0.95], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  sea_turtle: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [1.34, 1.88, 2.41], [1.06, 1.36, 1.97], [0.91, 1.24, 1.74], [0.87, 1.22, 1.69], [0.86, 1.05, 1.49], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  marsh_serpent: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [1.04, 1.34, 1.63], [0.92, 1.08, 1.75], [0.96, 1.14, 1.6], [0.93, 1.25, 1.64], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  lagoon_tentacle: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [1.56, 1.9, 2.05], [1.42, 1.42, 1.8], [1, 1.13, 1.53], [0.84, 1.06, 1.42], [0.86, 1.01, 1.5], [0, 0, 0], [0, 0, 0]],
  mermaid: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [1.22, 1.91, 2.6], [1.24, 1.62, 2], [0.87, 1.27, 1.94], [1.06, 1.5, 2.01], [1.01, 1.46, 1.91], [0, 0, 0], [0, 0, 0]],
  surf_drowned: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [1.11, 1.35, 2.1], [0.95, 1.3, 1.81], [1, 1.28, 1.75], [0.99, 1.18, 1.63], [1.03, 1.2, 1.88], [0, 0, 0]],
  young_serpent: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0.72, 1.2, 2.63], [0.39, 1.44, 1.97], [0.44, 1.33, 1.33], [0.59, 0.86, 1.68], [0.44, 0.91, 1.79]],
  lantern_maw: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [1.97, 2.65, 3.12], [1.79, 2.41, 3.19], [1.48, 1.95, 2.83], [1.48, 2.1, 2.71]],
  shoal_leviathan: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0.05, 1.09, 2.56], [2.79, 3.18, 4.28], [3.03, 3.51, 4.49]],
  ancient_turtle: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [3.39, 4.04, 4.36], [3.68, 4.08, 4.73]],
  barracuda: [[0, 0, 0], [0, 0, 0], [0.05, 0.38, 0.64], [0.24, 0.74, 1.22], [0.14, 0.69, 0.96], [0.13, 0.33, 0.63], [0.12, 0.23, 0.48], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  albatross: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0.43, 1, 2.13], [0.4, 1.04, 1.53], [0.4, 0.75, 1.19], [0.46, 0.71, 1.02], [0.29, 0.52, 1.06], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  moray: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0.6, 1.01, 1.41], [0.57, 1.02, 1.92], [0.43, 0.81, 1.55], [0.39, 0.65, 1.53], [0.36, 0.64, 1.36], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  giant_octopus: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0.67, 1.04, 1.81], [0.57, 0.99, 1.41], [0.46, 0.81, 1.23], [0.99, 1.09, 1.56], [0.69, 1.11, 1.53]],
};

/** A stack's creatures at its first reckoning: ROAM_BASE of the reference captain's might, in creatures (fractional). */
export function roamBase(kind: RoamKind, level: number): number {
  const L = Math.max(1, Math.min(10, level));
  return ((guardBaseMight(L) / 0.75) * ROAM_BASE) / armyPower([{ u: roamUnit(kind), n: 1 }]);
}

/** A stack's creatures as it stands (no dice: the same stack has the same count). */
export function roamCount(kind: RoamKind, level: number, size: RoamSize): number {
  const L = Math.max(1, Math.min(10, level));
  const k = ROAM_CAL[kind][L]?.[ROAM_SIZES.indexOf(size)] || 1;
  return Math.max(1, Math.round(roamBase(kind, L) * k));
}

/** A stack's creatures on the field: HoMM3's neutrals split a big stack into two or three. */
export function roamStacks(kind: RoamKind, n: number): ArmyStack[] {
  const u = roamUnit(kind);
  const parts = n >= 30 ? 3 : n >= 8 ? 2 : 1;
  const out: ArmyStack[] = [];
  let left = n;
  for (let i = 0; i < parts; i++) {
    const k = i === parts - 1 ? left : Math.round(n / parts);
    out.push({ u, n: k });
    left -= k;
  }
  return out.filter((s) => s.n > 0);
}

/** The counts a stack of a kind and level may stand at, weak to strong (the card's range). */
export function roamRange(kind: RoamKind, level: number): [number, number] {
  return [roamCount(kind, level, 'weak'), roamCount(kind, level, 'strong')];
}

// ------------------------------------------------------------------------------------------------ what they leave

/** Experience an hour of the game's usual play at sea teaches a captain of ⚓L: six prizes of her waters an hour (the
 *  hour tests/balance/island.ts reckons, KILLS_HOUR), each the mean of a ship sunk and one boarded (40 and 90) × the
 *  hull's tier × (1 + her captain's level/12), as Game.creditKill pays a prize (an NPC's captain is three a tier). */
export function seaHourXp(level: number): number {
  const L = Math.max(1, Math.min(10, Math.round(level)));
  const hs = hullsFor('pirate', L);
  const tier = hs.reduce((a, c) => a + SHIP_CLASSES[c].tier, 0) / hs.length;
  return 6 * 65 * tier * (1 + (tier * 3) / 12);
}

/** The stacks' lesson is held to this share of seaHourXp an hour of steady fighting (the owner's 0.6–0.8). */
export const ROAM_XP_TARGET = 0.7;
/** The battle's own lesson (its creatures cut down × TAC_XP_PER_HP) is taken at this share for a stack: the deep
 *  water's beasts are many and teach a little less a blow than men do (the rest of the lesson is the stack's own). */
export const ROAM_BATTLE_XP = 0.7;
/** A stack's own lesson by its size (beside the battle's: its creatures cut down × TAC_XP_PER_HP). */
export const ROAM_XP_SIZE: Record<RoamSize, number> = { weak: 0.6, avg: 1, strong: 1.7 };
/** An average stack's own lesson at ⚓L, a share of a captain's level of its waters (calibrated: tests/balance/roamers.ts
 *  holds the hour's whole lesson to 0.6–0.8 of seaHourXp). Index: level 0–10. */
export const ROAM_XP_SHARE = [0, 0.079, 0.0106, 0.0069, 0.0046, 0.0026, 0.0021, 0.0012, 0.0006, 0.0014, 0.0004];
/** Its silver, a share of an hour at sea of its waters for an average stack (by size as the lesson): a small purse that
 *  with the creatures' spoils about pays for the men a steady hour of them costs and leaves a little over (calibrated:
 *  tests/balance/roamers.ts holds the hour's net to +0.1…+0.35 of an hour at sea). Index: level 0–10. */
export const ROAM_SILVER = [0, 0.025, 0.019, 0.026, 0.028, 0.03, 0.028, 0.028, 0.022, 0.017, 0.012];
/** The chance its beating turns up an artifact (H2's maybeArtifact, as a guard's), by size. */
export const ROAM_ART: Record<RoamSize, number> = { weak: 0.008, avg: 0.015, strong: 0.04 };
/** A group mate near when the stack is beaten has this share of its lesson (the fighter the whole of it); the silver
 *  and the resources are split between them. */
export const ROAM_MATE_XP = 0.5;

export function roamPay(level: number, size: RoamSize): { silver: number; xp: number } {
  const L = Math.max(1, Math.min(10, level));
  return {
    silver: Math.max(5, Math.round((advHour(L) * ROAM_SILVER[L] * ROAM_XP_SIZE[size]) / 5) * 5),
    xp: Math.max(5, Math.round((advLevelXp(L) * ROAM_XP_SHARE[L] * ROAM_XP_SIZE[size]) / 5) * 5),
  };
}

/** Her lesson's share for a stack of ⚓`theirs` to a ship of ⚓`mine` (D12: nothing for a grey one). */
export const roamGap = (mine: number, theirs: number): number => xpForGap(theirs - mine);

/** The resources of the creatures beaten (BEAST_RES of the land's kinds; the mermaids leave pearls, the turtles shell). */
export function roamRes(kind: RoamKind, beaten: number): Partial<Record<LandRes | 'pearls', number>> {
  const u = ROAMS[kind].u;
  const per: Partial<Record<LandRes | 'pearls', number>> = (BEAST_RES as Record<string, Partial<Record<LandRes | 'pearls', number>>>)[u] ?? (u === 'mermaid' ? { pearls: 0.06 } : { shell: 0.3 });
  const out: Partial<Record<LandRes | 'pearls', number>> = {};
  for (const [r, k] of Object.entries(per) as [LandRes | 'pearls', number][]) {
    const n = Math.floor(beaten * k * 0.5);
    if (n > 0) out[r] = n;
  }
  return out;
}

/** The silver a stack's resources are reckoned at (for the sim). */
export function resWorth(res: Partial<Record<LandRes | 'pearls', number>>, pearl = 200): number {
  let v = 0;
  for (const [r, n] of Object.entries(res) as [LandRes | 'pearls', number][]) v += (n ?? 0) * (r === 'pearls' ? pearl : LAND_RES_DEF[r].value);
  return v;
}

export const roamTier = (kind: RoamKind): number => UNITS[roamUnit(kind)].tier;
