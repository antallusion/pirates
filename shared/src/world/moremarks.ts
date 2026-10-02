// Step 7 of the generation (docs/19 D1, owner 2026-10-02: «увеличь всё ровно в 2 раза»): the dense sea's marks twice
// as many — for every mark of step 5 one more of its kind, in its own sea, a few hundred metres to a kilometre or so off
// it (a buoy or a lantern still on its lane or by its harbour), appended after all of them from a generator of its own.
// Every mark before keeps her id and her place; the new ones keep off every island (step 6's too), reef, mark, the
// adventure map's points and the maelstroms, so nothing is drawn over anything else.

import { WORLD_SIZE } from '../constants.ts';
import { buildAdv } from '../data/advmap.ts';
import { Rng } from '../rng.ts';
import { WORLD_EDGE_MARGIN } from './regions.ts';
import type { SeaMark, World } from './worldgen.ts';
import { MARK_SIZE, WHIRLPOOLS, chunkKey, chunkOf, legacyOf, portLanes, regionAt, segDist } from './worldgen.ts';

/** Marks after step 7 for every one before (docs/19 D1: exactly twice). */
export const MARKS_MUL = 2;
/** The water a new mark keeps from any island or reef, and from any other mark (metres from their edges). */
const LAND_GAP = 520;
const MARK_GAP = 300;
const POI_GAP = 260;

/** Step 7: the world with her marks doubled (a new world object; her legacyWorld stays the one of step 5). */
export function appendMarks(world: World): World {
  const old = legacyOf.get(world) ?? world;
  const rng = new Rng((world.seed * 307 + 0x19d1) >>> 0);
  const marks: SeaMark[] = world.marks.slice();
  const B = 2000, BN = WORLD_SIZE / B;
  const buckets: [number, number, number, number][][] = Array.from({ length: BN * BN }, () => []);
  const add = (x: number, y: number, r: number, gap: number) => {
    const reach = r + gap;
    const bx0 = Math.max(0, Math.floor((x - reach) / B)), bx1 = Math.min(BN - 1, Math.floor((x + reach) / B));
    const by0 = Math.max(0, Math.floor((y - reach) / B)), by1 = Math.min(BN - 1, Math.floor((y + reach) / B));
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) buckets[by * BN + bx].push([x, y, r, gap]);
  };
  const clear = (x: number, y: number, r: number) => {
    const b = buckets[Math.min(BN - 1, Math.max(0, Math.floor(y / B))) * BN + Math.min(BN - 1, Math.max(0, Math.floor(x / B)))];
    for (const [px, py, pr, gap] of b) if (Math.hypot(px - x, py - y) < pr + r + gap) return false;
    return true;
  };
  for (const is of world.islands) if (!is.slot) add(is.x, is.y, is.radius, LAND_GAP);
  for (const q of world.reefs) add(q.x, q.y, q.radius, LAND_GAP * 0.8);
  for (const m of marks) add(m.x, m.y, m.r, MARK_GAP);
  const adv = buildAdv(old);
  for (const o of adv.objs) add(o.x, o.y, 60, POI_GAP);
  for (const g of adv.guards) add(g.x, g.y, 60, POI_GAP);
  for (const p of world.ports) add(p.x, p.y, 200, 400);
  const lanes = portLanes(world.ports.filter((p) => !p.raft));
  const laneDist = (x: number, y: number) => {
    let best = Infinity;
    for (const [ax, ay, bx, by] of lanes) best = Math.min(best, segDist(x, y, ax, ay, bx, by));
    return best;
  };
  const portDist = (x: number, y: number) => {
    let best = Infinity;
    for (const p of world.ports) best = Math.min(best, Math.hypot(p.x - x, p.y - y));
    return best;
  };
  const lo = WORLD_EDGE_MARGIN + 1300, hi = WORLD_SIZE - WORLD_EDGE_MARGIN - 1300;
  const inPool = (x: number, y: number) => WHIRLPOOLS.some((w) => Math.hypot(w.x - x, w.y - y) < w.radius * 2.2 + 200);
  /** A lane's or a harbour's mark (step 5 put it there for the lane), not one of its sea's mix. */
  const lanedOf = new Map<number, boolean>();
  const laned = (m: SeaMark) => {
    let v = lanedOf.get(m.id);
    if (v === undefined) lanedOf.set(m.id, (v = laneDist(m.x, m.y) < 450 || portDist(m.x, m.y) < 2600));
    return v;
  };
  /** Whether a spot suits a twin of a mark: its sea, its kind's own water (a buoy on a lane or by a harbour, the
   *  drift and the wrecks of a current where the first was on one), clear of everything. */
  const fits = (m: SeaMark, x: number, y: number, r: number, gapK: number) => {
    if (x < lo || y < lo || x > hi || y > hi || inPool(x, y)) return false;
    if (regionAt(world, x, y) !== m.region) return false;
    // (at the very last a lane's mark may stand a little wider of it)
    const lane = gapK < 0.5 ? 900 : 450, harbour = gapK < 0.5 ? 3600 : 2600;
    if ((m.kind === 'buoy' || m.kind === 'lantern') && laned(m)) {
      if (!(laneDist(x, y) < lane || portDist(x, y) < harbour)) return false;
    } else if (laneDist(x, y) < 450 || portDist(x, y) < 2600) return false;
    if (gapK >= 1) return clear(x, y, r);
    // (the last tries: half the gap)
    const b = buckets[Math.min(BN - 1, Math.max(0, Math.floor(y / B))) * BN + Math.min(BN - 1, Math.max(0, Math.floor(x / B)))];
    for (const [px, py, pr, gap] of b) if (Math.hypot(px - x, py - y) < pr + r + gap * gapK) return false;
    return true;
  };
  const first = marks.length;
  for (let i = 0; i < first * (MARKS_MUL - 1); i++) {
    const m = marks[i % first];
    const size = rng.float(), rot = rng.range(0, Math.PI * 2), mseed = rng.int(0, 1e9), a0 = rng.range(0, Math.PI * 2);
    const [m0, m1] = MARK_SIZE[m.kind];
    const r = m0 + size * (m1 - m0);
    let spot: [number, number] | null = null;
    // A ring about the first, wider and wider; then anywhere in her sea about it; at the last the gaps halved.
    for (let k = 0; k < 160 && !spot; k++) {
      const gapK = k < 120 ? 1 : 0.5;
      const ring = k < 120 ? 600 + (k % 40) * 45 + Math.floor(k / 40) * 900 : 600 + (k - 120) * 60;
      const a = a0 + k * 2.39996;
      const x = m.x + Math.sin(a) * ring, y = m.y - Math.cos(a) * ring;
      if (fits(m, x, y, r, gapK)) spot = [x, y];
    }
    for (let k = 0; k < 4000 && !spot; k++) {
      const far = k < 2000 ? 9000 : 30000;
      const x = m.x + rng.range(-far, far), y = m.y + rng.range(-far, far);
      if (fits(m, x, y, r, k < 3000 ? 1 : 0.5)) spot = [x, y];
    }
    for (let k = 0; k < 4000 && !spot; k++) {
      const a = a0 + k * 2.39996, ring = 400 + k * 3;
      const x = m.x + Math.sin(a) * ring, y = m.y - Math.cos(a) * ring;
      if (fits(m, x, y, r, 0.25)) spot = [x, y];
    }
    if (!spot) continue;
    const [x, y] = spot;
    const kind = m.kind; // each kind exactly twice
    marks.push({ id: marks.length, kind, region: m.region, x, y, r, rot, seed: mseed });
    add(x, y, r, MARK_GAP);
  }
  const markChunks = new Map<number, number[]>();
  for (const m of marks) {
    const k = chunkKey(...chunkOf(m.x, m.y));
    let list = markChunks.get(k);
    if (!list) markChunks.set(k, (list = []));
    list.push(m.id);
  }
  const out: World = { ...world, marks, markChunks, marksFrom: first };
  legacyOf.set(out, old);
  return out;
}
