// Step 6 of the generation (docs/18 III item 25, owner 2026-10-01: "more islands, and islands under their own
// levels"): some half as many islands again — small islands, atolls (a ring of coral, sand, ice or ash round a lagoon)
// and ridges of rock — appended after every island of steps 1–5 from a generator of their own, so every island, port,
// reef and mark before keeps her id and place, and everything the world alone places (the mines, the adventure map's
// guards and things, the haunts, the quests) is placed on the world as it stood before (legacyWorld) and stands where it
// always stood. The new land keeps off the ports, the lanes between them, the currents, the maelstroms, the reefs, the
// dense sea's marks, the adventure map's points and every other island by a sailing channel, so the lanes and the
// helmsman's routes stay open. A few of the new islands are hidden (docs/18 #30): charted only from a lookout, by a map
// or an obelisk.

import { NAV_CELL, WORLD_SIZE } from '../constants.ts';
import { buildAdv } from '../data/advmap.ts';
import { closestOnPolygon, pointInPolygon, TAU } from '../math.ts';
import { Rng } from '../rng.ts';
import { REGIONS, REGION_IDS, WORLD_EDGE_MARGIN, biomeFromMix } from './regions.ts';
import type { IslandBiome, RegionId } from './regions.ts';
import type { Island, IslandFeature, World } from './worldgen.ts';
import { SYLLABLES, WHIRLPOOLS, chunkKey, legacyOf, chunkOf, distanceToCurrents, islandName, islandPoly, portLanes, regionAt, segDist } from './worldgen.ts';

/** The ids kept for the islands the sea raises after the world is made (an eruption's new land). */
export const RAISED_ROOM = 64;
/** How many more islands, as a share of those of steps 1–5 in the same sea (docs/18 #25: 40–60 %). */
export const MORE_ISLES_SHARE = 0.5;
/** The open water kept between a new island and any land or reef before her (a sailing channel). */
const CHANNEL = 650;
/** Off the lanes between neighbouring ports (a ridge further: it is a wall of rocks). */
const LANE_PAD = 950;
const RIDGE_LANE_PAD = 1400;
/** Hidden islands a sea keeps (docs/18 #30). */
export const HIDDEN_WANT: Record<RegionId, number> = { black_coast: 2, gravewater: 4, whispering: 6, ashen_isles: 4, leviathan_reach: 4, dead_mans_expanse: 5, drowned_crown: 6, the_abyss: 3 };

/** What an atoll's ring is made of in each sea (one of the sea's own biomes): coral sand in the warm water, salt, ice,
 *  ash, drowned walls, ribs. */
const RING_BIOME: Record<RegionId, IslandBiome> = {
  black_coast: 'saltflat', gravewater: 'atoll', whispering: 'mangrove', ashen_isles: 'volcanic', leviathan_reach: 'ice', dead_mans_expanse: 'atoll', drowned_crown: 'ruins', the_abyss: 'bone',
};
/** The rock of each sea's ridges (one of the sea's own biomes). */
const RIDGE_BIOME: Record<RegionId, IslandBiome> = {
  black_coast: 'temperate', gravewater: 'temperate', whispering: 'mossy', ashen_isles: 'blacksand', leviathan_reach: 'crystal', dead_mans_expanse: 'barren', drowned_crown: 'ruins', the_abyss: 'bone',
};

/** An atoll: a near-round reef island. Its lagoon is painted inside it (client/src/render/isletype.ts) — too shoal
 *  and narrow for a keel, so the land is the whole ring, and every coast stays the outline of a star about her middle
 *  (as the treasure maps, the landing parties and the island's life all take it). */
function atollPoly(rng: Rng, x: number, y: number, r: number): number[] {
  const n = 32;
  const out: number[] = [];
  const ph = rng.range(0, TAU), k = rng.int(2, 4), amp = rng.range(0.04, 0.09);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + amp * Math.sin(a * k + ph) + rng.range(-0.035, 0.035));
    out.push(x + Math.sin(a) * rr, y - Math.cos(a) * rr);
  }
  return out;
}

/** A rock of a ridge: a jagged ellipse drawn out along the ridge. */
function rockPoly(rng: Rng, x: number, y: number, r: number, axis: number): number[] {
  const n = 14;
  const out: number[] = [];
  const ca = Math.cos(axis), sa = Math.sin(axis);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = r * rng.range(0.72, 1.08);
    const u = Math.cos(a) * k * 1.7, v = Math.sin(a) * k * 0.75;
    out.push(x + u * ca - v * sa, y + u * sa + v * ca);
  }
  return out;
}

/** A name from her own biome's syllables, else her sea's (the client has every one of them in Russian); a number only
 *  when both are spent. */
function freshName(rng: Rng, biomes: IslandBiome[], used: Set<string>): string {
  for (const b of biomes) {
    const [a, c] = SYLLABLES[b];
    for (let i = 0; i < 30; i++) {
      const n = rng.pick(a) + rng.pick(c);
      const name = rng.chance(0.3) ? `${n} ${rng.pick(['Isle', 'Rock', 'Key', 'Holm'])}` : n;
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
  }
  return islandName(rng, biomes[biomes.length - 1], used);
}

interface Spot {
  x: number;
  y: number;
  r: number;
  pad: number;
}

/** Step 6: the world with her new islands appended (a new world object; the old one is her legacyWorld). */
export function appendIsles(old: World): World {
  const seed = old.seed;
  const rng = new Rng((seed * 271 + 0x18e3) >>> 0);
  // Room first for the islands the sea throws up (world events, worldgen.raiseIsland): each keeps the id she had before
  // step 6 (the next after the islands of steps 1–5), so a saved chart, a claim or a quest on one still finds her.
  const islands = old.islands.slice();
  for (let k = 0; k < RAISED_ROOM; k++) {
    const x = -90000 - k * 10;
    islands.push({ id: islands.length, name: '', region: 'the_abyss', biome: 'bone', x, y: -90000, radius: 1, poly: [x, -90001, x + 1, -89999, x - 1, -89999], features: [], minor: true, slot: true });
  }
  const isleFrom = islands.length;
  const chunks = new Map<number, number[]>();
  for (const [k, v] of old.chunks) chunks.set(k, v.slice());
  const navGrid = old.navGrid.slice();
  const usedNames = new Set(old.islands.map((is) => is.name));
  const regionOf = (x: number, y: number) => regionAt(old, x, y);
  // The lanes between every port and between the harbours of the land (the floating towns left out): both kept open.
  const lanes = [...portLanes(old.ports), ...portLanes(old.ports.filter((p) => !p.raft))];
  const adv = buildAdv(old, false);
  // A coarse index of everything to keep off: [x, y, r, pad].
  const B = 2000, BN = WORLD_SIZE / B;
  const buckets: Spot[][] = Array.from({ length: BN * BN }, () => []);
  const add = (x: number, y: number, r: number, pad: number) => {
    const reach = r + pad + 1400;
    const bx0 = Math.max(0, Math.floor((x - reach) / B)), bx1 = Math.min(BN - 1, Math.floor((x + reach) / B));
    const by0 = Math.max(0, Math.floor((y - reach) / B)), by1 = Math.min(BN - 1, Math.floor((y + reach) / B));
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) buckets[by * BN + bx].push({ x, y, r, pad });
  };
  const clear = (x: number, y: number, r: number) => {
    const b = buckets[Math.min(BN - 1, Math.max(0, Math.floor(y / B))) * BN + Math.min(BN - 1, Math.max(0, Math.floor(x / B)))];
    for (const o of b) if (Math.hypot(o.x - x, o.y - y) < o.r + r + o.pad) return false;
    return true;
  };
  for (const is of old.islands) add(is.x, is.y, is.radius, CHANNEL);
  for (const q of old.reefs) add(q.x, q.y, q.radius, CHANNEL * 0.7);
  for (const m of old.marks) add(m.x, m.y, m.r, 150);
  for (const o of adv.objs) add(o.x, o.y, 90, 350);
  for (const g of adv.guards) add(g.x, g.y, 90, 350);
  for (const p of old.ports) add(p.x, p.y, 300, 2300);
  const laneDist = (x: number, y: number) => {
    let best = Infinity;
    for (const [ax, ay, bx, by] of lanes) best = Math.min(best, segDist(x, y, ax, ay, bx, by));
    return best;
  };
  const lo = WORLD_EDGE_MARGIN + 1500, hi = WORLD_SIZE - WORLD_EDGE_MARGIN - 1500;
  const ok = (x: number, y: number, R: number, lanePad: number) =>
    x > lo && y > lo && x < hi && y < hi && distanceToCurrents(x, y) >= R + 700 && !WHIRLPOOLS.some((w) => Math.hypot(w.x - x, w.y - y) < w.radius * 2.2 + R + 200) && laneDist(x, y) >= R + lanePad && clear(x, y, R);
  const index = (is: Island) => {
    const [x0, y0] = chunkOf(is.x - is.radius, is.y - is.radius);
    const [x1, y1] = chunkOf(is.x + is.radius, is.y + is.radius);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const k = chunkKey(cx, cy);
      let list = chunks.get(k);
      if (!list) chunks.set(k, (list = []));
      list.push(is.id);
    }
    // The helmsman's grid: the land and 160 m of its coast are not a route (as buildNavGrid has it).
    const pad = is.radius + 200, n = old.navSize;
    for (let gy = Math.floor((is.y - pad) / NAV_CELL); gy <= Math.floor((is.y + pad) / NAV_CELL); gy++) {
      for (let gx = Math.floor((is.x - pad) / NAV_CELL); gx <= Math.floor((is.x + pad) / NAV_CELL); gx++) {
        if (gx < 0 || gy < 0 || gx >= n || gy >= n) continue;
        const cx = gx * NAV_CELL + NAV_CELL / 2, cy = gy * NAV_CELL + NAV_CELL / 2;
        if (pointInPolygon(cx, cy, is.poly) || closestOnPolygon(cx, cy, is.poly).d2 < 160 * 160) navGrid[gy * n + gx] = 1;
      }
    }
  };
  const push = (is: Island) => {
    islands.push(is);
    index(is);
  };
  const features = (rid: RegionId, biome: IslandBiome, r: number): IslandFeature[] => {
    const f: IslandFeature[] = [];
    const strange = REGIONS[rid].strangeness;
    if (rng.chance(0.04 + strange * 0.2)) f.push('ruins');
    if (rng.chance(rid === 'dead_mans_expanse' ? 0.4 : 0.05)) f.push('wreck');
    if ((biome === 'atoll' || biome === 'mossy') && rng.chance(0.18)) f.push('pearl_bank');
    if ((biome === 'ice' || biome === 'bone') && rng.chance(0.12)) f.push('bones');
    if (rng.chance(0.02 + strange * 0.08)) f.push('shrine');
    if (rng.chance(0.05)) f.push('cache');
    if ((biome === 'temperate' || biome === 'jungle' || biome === 'mangrove') && r > 200 && rng.chance(0.12)) f.push('grove');
    if (r > 180 && rng.chance(0.03)) f.push('hermit');
    return f;
  };
  // Each sea's count of islands before; the new ones are half as many again.
  const count = new Map<RegionId, number>();
  for (const is of old.islands) count.set(is.region, (count.get(is.region) ?? 0) + 1); // (the raised islands' room not counted)
  for (const rid of REGION_IDS) {
    const reg = REGIONS[rid];
    const want = Math.round((count.get(rid) ?? 0) * MORE_ISLES_SHARE);
    let placed = 0, attempts = 0;
    while (placed < want && attempts < want * 400) {
      attempts++;
      const x = rng.range(lo, hi), y = rng.range(lo, hi);
      const roll = rng.float(), size = rng.float(), turn = rng.range(0, TAU);
      if (regionOf(x, y) !== rid) continue;
      const scale = Math.max(0.7, reg.islandScale);
      if (roll < 0.3) {
        // A ridge: three to five rocks in a line, the narrows between them no passage.
        const n = 3 + Math.floor(size * 3);
        const rs = Array.from({ length: n }, (_, i) => (45 + ((i * 37 + Math.floor(size * 997)) % 66)) * scale);
        const gaps = rs.slice(1).map((r, i) => rs[i] + r + 60 + ((i * 53 + Math.floor(size * 613)) % 90));
        const len = gaps.reduce((a, b) => a + b, 0);
        const R = len / 2 + Math.max(...rs) * 1.8;
        if (!ok(x, y, R, RIDGE_LANE_PAD)) continue;
        const ca = Math.cos(turn), sa = Math.sin(turn);
        let u = -len / 2;
        const head = islands.length;
        const name = freshName(rng, [RIDGE_BIOME[rid], reg.biome], usedNames);
        for (let i = 0; i < n; i++) {
          if (i > 0) u += gaps[i - 1];
          const v = rng.range(-40, 40);
          const px = x + u * ca - v * sa, py = y + u * sa + v * ca;
          const r = rs[i];
          const poly = rockPoly(rng, px, py, r, turn);
          // The ridge goes by its tallest rock's name; the rest are its stacks (seen, not charted).
          const tallest = rs.indexOf(Math.max(...rs));
          push({ id: islands.length, name, region: rid, biome: RIDGE_BIOME[rid], x: px, y: py, radius: r * 1.8 * 1.1, poly, features: [], isle: 'ridge', ...(i === tallest ? {} : { minor: true }) });
        }
        void head;
        add(x, y, R, CHANNEL);
        placed += n;
        continue;
      }
      const atoll = roll < 0.5;
      const r = atoll ? (170 + size * 160) * scale : (size < 0.62 ? 70 + size * 200 : 190 + size * 120) * scale;
      if (!ok(x, y, r * 1.25, LANE_PAD)) continue;
      const biome = atoll ? RING_BIOME[rid] : biomeFromMix(rid, rng.float());
      const poly = atoll ? atollPoly(rng, x, y, r) : islandPoly(rng, x, y, r, seed + 80000 + islands.length * 7);
      push({ id: islands.length, name: freshName(rng, [biome, reg.biome], usedNames), region: rid, biome, x, y, radius: r * 1.25, poly, features: features(rid, biome, r), isle: atoll ? 'atoll' : 'small' });
      add(x, y, r * 1.25, CHANNEL);
      placed++;
    }
  }
  // Hidden islands (docs/18 #30): in each sea a few of the new ones far from the lanes and the harbours; each keeps a
  // cache of her own (a better find ashore: shared/src/world/archipelago.ts isleLoot).
  const hrng = new Rng((seed * 283 + 0x41dd) >>> 0);
  for (const rid of REGION_IDS) {
    const pool = islands.slice(isleFrom).filter((is) => is.region === rid && is.isle !== 'ridge' && laneDist(is.x, is.y) > 2600 && old.ports.every((p) => Math.hypot(p.x - is.x, p.y - is.y) > 6000));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(hrng.float() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const is of pool.slice(0, HIDDEN_WANT[rid])) {
      is.hidden = true;
      if (!is.features.includes('cache')) is.features.push('cache');
    }
  }
  const world: World = { ...old, islands, chunks, navGrid, isleFrom, raisedNext: old.islands.length };
  legacyOf.set(world, old);
  return world;
}
