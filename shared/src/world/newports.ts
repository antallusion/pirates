// Step 8 of the generation (owner, 2026-10-03: «около 20 городов (портов)»): twenty new ports, each a town on an island
// of her own, appended after every island, port, reef and mark of steps 1–7 — so every one of those keeps her id and
// her place, and every saved game, claim, lease, quest and chart that names one still finds her. The towns, their
// seas, flags, yards, trade and lines are the art queue's (tools/art/ports.py, where each is painted: a town on the
// chart, prop.port_<id>, and her harbour seen from the water, bg.port_<id>); copied here, for the game reads no Python.
//
// Each new island is laid in clear water of her own sea, as near as the sea allows to the place her town was meant for
// (`near`): off every island and reef by a sailing channel, off the dense sea's marks, the adventure map's things and
// guards, the turtles' loops, the currents, the maelstroms and the lanes between the old ports, and a good way from
// every harbour. Her anchorage is on the side of her coast with the most open water, and the helmsman's grid learns
// her land and her anchorage. Everything the world alone places is placed on the world as she stood before this step
// (beforePorts), and stands where it always stood; the lanes the new harbours open are drawn by those who use them.
//
// The Abyss holds no port: it is the endgame sea behind the Maelstrom Wall (server/src/game/abyss.ts), with no markets
// (docs/01 §3.10), and no step of the generation ever put a harbour in it. The two towns the art queue gave it — Last
// Light, the Order's lighthouse fortress "at the edge of the deep", and Marrowdeep, the Choir's bone reef — stand at
// its edge instead, in the Drowned Crown, the one sea that borders it, as near the Wall as clear water allows.
//
// The Russian names and lines are the client's (client/src/lang/data.ports.ru.ts, by the paths of NEW_PORTS).

import { NAV_CELL, WORLD_SIZE } from '../constants.ts';
import { buildAdv } from '../data/advmap.ts';
import type { FactionId } from '../data/factions.ts';
import type { GoodId } from '../data/goods.ts';
import { GOODS } from '../data/goods.ts';
import { closestOnPolygon, pointInPolygon, TAU } from '../math.ts';
import { Rng, hashString } from '../rng.ts';
import { turtlePos, turtles, TURTLE_R } from './drift.ts';
import { WORLD_EDGE_MARGIN } from './regions.ts';
import type { IslandBiome, PortProfile, RegionId } from './regions.ts';
import type { Island, Port, World } from './worldgen.ts';
import { WHIRLPOOLS, beforePortsOf, chunkKey, chunkOf, coastAnchor, distanceToCurrents, islandPoly, legacyOf, portLanes, regionAt, segDist } from './worldgen.ts';

export interface NewPortDef {
  id: string;
  name: string;
  region: RegionId;
  faction: FactionId;
  size: 1 | 2 | 3;
  shipyardTier: number;
  blackMarket: boolean;
  /** Her line on the harbour screen (the Russian: client/src/lang/data.ports.ru.ts). */
  description: string;
  /** What she makes and what she needs, the first the most (her market: newPortProfile). */
  produces: GoodId[];
  consumes: GoodId[];
  /** Her island's ground (the chart paints it). */
  biome: IslandBiome;
  /** Where in her sea her town was meant to stand: the nearest clear water to it takes her (world metres). */
  near: [number, number];
}

const P = (
  id: string, region: RegionId, faction: FactionId, size: 1 | 2 | 3, shipyardTier: number, blackMarket: boolean, name: string, description: string,
  produces: GoodId[], consumes: GoodId[], biome: IslandBiome, near: [number, number],
): NewPortDef => ({ id, name, region, faction, size, shipyardTier, blackMarket, description, produces, consumes, biome, near });

/** The twenty, in the art queue's order (their index is their place in the client's Russian table). */
export const NEW_PORTS: NewPortDef[] = [
  // ---- The Black Coast
  P('bellhaven', 'black_coast', 'crown', 3, 4, false, 'Bellhaven', "The Crown's dockyard. Two stone dry docks, a ropewalk a quarter-mile long, the Admiralty bell.",
    ['planks', 'sailcloth', 'weapons'], ['timber', 'iron', 'provisions', 'rum'], 'temperate', [24750, 72300]),
  P('gallowsmouth', 'black_coast', 'crown', 2, 2, false, 'Gallowsmouth', "The Crown's prison port. A star fort on the rock, the prison hulks rotting at their moorings.",
    ['salt', 'provisions'], ['weapons', 'gunpowder', 'medicine', 'cloth'], 'blacksand', [20500, 89300]),
  // ---- Gravewater
  P('copperhook', 'gravewater', 'league', 2, 3, false, 'Copperhook', 'League counting houses on canals. Copper roofs gone green, cranes over every quay.',
    ['cloth', 'spices', 'medicine'], ['sugar', 'iron', 'timber', 'provisions'], 'temperate', [52000, 76000]),
  P('rotgut_landing', 'gravewater', 'free', 1, 1, true, 'Rotgut Landing', 'Stills on stilts over the mud. Everyone drinks, nobody asks.',
    ['rum', 'sugar'], ['provisions', 'weapons', 'cloth', 'iron'], 'mangrove', [64000, 84500]),
  P('sugarloaf', 'gravewater', 'league', 2, 2, false, 'Sugarloaf', 'League cane fields to the hills. The mills turn day and night, the bells ring the shifts.',
    ['sugar', 'rum', 'tobacco'], ['provisions', 'iron', 'cloth', 'medicine'], 'jungle', [42750, 65000]),
  // ---- The Whispering Sea
  P('hushwater', 'whispering', 'brokers', 2, 2, true, 'Hushwater', 'Houseboats lashed round a drowned bell tower. The lanterns are shuttered; trade is done in whispers.',
    ['dreamleaf', 'pearls'], ['rum', 'weapons', 'medicine', 'tobacco'], 'mossy', [14000, 60500]),
  P('mirrorfen', 'whispering', 'brokers', 1, 1, true, 'Mirrorfen', "Huts in the mangrove roots. Mirror towers send the Brokers' messages through the fog.",
    ['dreamleaf', 'provisions'], ['cloth', 'rum', 'iron', 'medicine'], 'mangrove', [22400, 36100]),
  P('widows_wick', 'whispering', 'free', 1, 1, false, "Widow's Wick", 'A cliff village round the tallest lighthouse in the fog. The keeper is a widow; so is half the village.',
    ['provisions', 'whale_oil'], ['timber', 'rum', 'cloth', 'medicine'], 'mossy', [12750, 28050]),
  // ---- The Ashen Isles
  P('slagport', 'ashen_isles', 'confederacy', 3, 3, true, 'Slagport', 'Foundries on black sand under the smoking cone. The Confederacy casts its guns here.',
    ['iron', 'weapons', 'gunpowder', 'coal'], ['provisions', 'rum', 'timber', 'cloth'], 'blacksand', [84000, 81000]),
  P('brimstone_bay', 'ashen_isles', 'confederacy', 2, 2, true, 'Brimstone Bay', 'Yellow terraces of sulphur and the men who dig them. The air bites; the powder is the best on the sea.',
    ['gunpowder', 'sulfur_iron'], ['provisions', 'medicine', 'rum', 'timber'], 'volcanic', [80000, 56000]),
  // ---- Leviathan Reach
  P('frostgate', 'leviathan_reach', 'harpoon', 3, 3, false, 'Frostgate', "The Order's walled town in the fjord. The try-works never go out; the ice never quite lets go.",
    ['whale_oil', 'leviathan_bone', 'provisions'], ['salt', 'rum', 'weapons', 'timber'], 'ice', [20700, 7600]),
  P('sealhold', 'leviathan_reach', 'free', 1, 1, false, 'Sealhold', 'Turf huts on the ice shelf. Sealskins on every frame, and the smell carries a mile.',
    ['provisions', 'whale_oil'], ['salt', 'rum', 'timber', 'weapons'], 'ice', [52500, 12000]),
  // ---- Dead Man's Expanse
  P('saltglass', 'dead_mans_expanse', 'league', 2, 2, false, 'Saltglass', 'White salt pans and the glassworks that burn day and night. The League sells both by the shipload.',
    ['salt', 'cloth'], ['provisions', 'timber', 'rum', 'coal'], 'saltflat', [54650, 47350]),
  P('wreckhold', 'dead_mans_expanse', 'free', 2, 2, true, 'Wreckhold', 'A town built of the ships the reef took. Every house was a hull once; every door was a hatch.',
    ['timber', 'planks', 'weapons'], ['provisions', 'rum', 'medicine', 'cloth'], 'atoll', [46000, 58200]),
  P('lotus_anchorage', 'dead_mans_expanse', 'free', 2, 3, false, 'Lotus Anchorage', "The eastern traders' enclave. Junks at anchor, silk under awnings, a pagoda bell for the tide.",
    ['spices', 'cloth', 'medicine'], ['iron', 'sugar', 'rum', 'pearls'], 'barren', [70150, 54700]),
  // ---- The Drowned Crown
  P('steeplewater', 'drowned_crown', 'choir', 2, 2, false, 'Steeplewater', 'A cathedral town half under the sea. They live in the upper floors and ring the drowned bells at low tide.',
    ['pearls', 'kraken_ink'], ['provisions', 'timber', 'rum', 'cloth'], 'ruins', [78700, 42150]),
  P('tidehallow', 'drowned_crown', 'choir', 1, 1, false, 'Tidehallow', "The Choir's monastery on its causeway. Twice a day the sea closes the road.",
    ['medicine', 'provisions'], ['cloth', 'timber', 'rum', 'iron'], 'ruins', [67700, 26500]),
  P('crownfall', 'drowned_crown', 'free', 2, 2, true, 'Crownfall', "Salvagers in the drowned capital's palace. Cranes over the flooded courts; everything is for sale.",
    ['pearls', 'weapons', 'cloth'], ['provisions', 'rum', 'timber', 'medicine'], 'ruins', [61000, 12200]),
  // ---- At the edge of the Abyss (the art queue's the_abyss; see above)
  P('last_light', 'drowned_crown', 'harpoon', 2, 3, false, 'Last Light', 'The lighthouse fortress at the edge of the deep. Beyond its beam, the Order says, there is nothing to come back from.',
    ['whale_oil', 'leviathan_bone'], ['provisions', 'weapons', 'gunpowder', 'medicine'], 'bone', [75500, 6000]),
  P('marrowdeep', 'drowned_crown', 'choir', 1, 1, true, 'Marrowdeep', 'A Choir enclave on a reef of old bone. The singing never stops, and the water glows where they sing.',
    ['kraken_ink', 'pearls'], ['provisions', 'rum', 'timber', 'cloth'], 'bone', [75650, 12000]),
];

/** The sea the art queue gave each town where it is not the sea she stands in (the Abyss holds no port). */
export const ART_REGION: Record<string, RegionId> = { last_light: 'the_abyss', marrowdeep: 'the_abyss' };

// ------------------------------------------------------------------------------------------------ the markets

/** A town's trade by her size, as the key ports' run (docs/01 §6): a hamlet a little under a town, a capital a third over. */
const SIZE_MUL: Record<1 | 2 | 3, number> = { 1: 0.8, 2: 1, 3: 1.3 };

/** A good's rate an hour (units at full capacity) where it is a town's `rank`-th trade: the cheap by the shipload, the
 *  dear by the crate — some eighteen of a thirty-silver good at a town of the middle size, falling off as the price
 *  climbs (rum 18, iron 17, spices 11, pearls 5) and never above two dozen of the cheapest (salt, provisions, timber:
 *  as the key ports trade them); the rare materials only a crate or a few (as Harpoon's Rest's bone and Cinderhold's
 *  sulphur iron); each later trade of her list a little less than the one before. */
export function tradeRate(good: GoodId, size: 1 | 2 | 3, rank: number): number {
  const g = GOODS[good];
  const lean = 1 - 0.15 * rank;
  if (g.category === 'rare') return Math.max(1, Math.round((size + (size === 3 ? 1 : 0)) * lean));
  return Math.max(2, Math.round(Math.min(24, 18 * Math.pow(30 / g.basePrice, 0.6)) * SIZE_MUL[size] * lean));
}

/** Her market's profile: what she makes and needs, by her size. */
export function newPortProfile(d: NewPortDef): PortProfile {
  const produces: Partial<Record<GoodId, number>> = {};
  const consumes: Partial<Record<GoodId, number>> = {};
  d.produces.forEach((g, i) => (produces[g] = tradeRate(g, d.size, i)));
  d.consumes.forEach((g, i) => (consumes[g] = tradeRate(g, d.size, i)));
  return { produces, consumes };
}

// ------------------------------------------------------------------------------------------------ the placing

/** Each town's island by her size (its reach, as an island's `radius`): a hamlet's rock, a town's island, a capital's. */
export const PORT_ISLE_R: Record<1 | 2 | 3, number> = { 1: 420, 2: 520, 3: 640 };
/** The smallest her island may come down to where her sea has no more room (still room for her streets), and what a
 *  smaller island costs against the distance from where she was meant to stand (metres for her whole size). */
const ISLE_R_MIN = 0.62;
const SHRINK_COST = 25000;
/** Open water kept from every island and reef before (a sailing channel), from the dense sea's marks, the adventure
 *  map's things and guards, and the turtles' loops. */
const CHANNEL = 620;
const REEF_GAP = 440;
const MARK_GAP = 90;
const ADV_GAP = 380;
const TURTLE_GAP = 700;
/** Her island off the lanes between the old ports. Her anchorage out of a harbour's guns for the adventure map's things
 *  and guards (none stands within 1.6 km of a port: shared/src/data/advmap.ts), 4 km from every other harbour, and a
 *  floating town still far out at sea (5.5 km from any harbour of the land, as step 5 laid them). */
const LANE_GAP = 420;
const ADV_HARBOUR = 1600;
const HARBOUR_GAP = 4000;
const RAFT_GAP = 5500;

interface Keep {
  x: number;
  y: number;
  r: number;
  pad: number;
}

/** Step 8: the world with her twenty new towns (a new world object; the one before is her beforePorts, and her
 *  legacyWorld is the one of step 5 as ever). */
export function appendPorts(old: World): World {
  const seed = old.seed;
  const islands = old.islands.slice();
  const ports = old.ports.slice();
  const portIslesFrom = islands.length;
  const portsFrom = ports.length;
  const chunks = new Map<number, number[]>();
  for (const [k, v] of old.chunks) chunks.set(k, v.slice());
  const navGrid = old.navGrid.slice();
  const n = old.navSize;
  // A coarse index of everything to keep off: [x, y, r, pad].
  const B = 2000, BN = WORLD_SIZE / B;
  const buckets: Keep[][] = Array.from({ length: BN * BN }, () => []);
  const add = (x: number, y: number, r: number, pad: number) => {
    const reach = r + pad + PORT_ISLE_R[3];
    const bx0 = Math.max(0, Math.floor((x - reach) / B)), bx1 = Math.min(BN - 1, Math.floor((x + reach) / B));
    const by0 = Math.max(0, Math.floor((y - reach) / B)), by1 = Math.min(BN - 1, Math.floor((y + reach) / B));
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) buckets[by * BN + bx].push({ x, y, r, pad });
  };
  const clear = (x: number, y: number, r: number) => {
    const b = buckets[Math.min(BN - 1, Math.max(0, Math.floor(y / B))) * BN + Math.min(BN - 1, Math.max(0, Math.floor(x / B)))];
    for (const o of b) if (Math.hypot(o.x - x, o.y - y) < o.r + r + o.pad) return false;
    return true;
  };
  for (const is of old.islands) if (!is.slot) add(is.x, is.y, is.radius, CHANNEL);
  for (const q of old.reefs) add(q.x, q.y, q.radius, REEF_GAP);
  for (const m of old.marks) add(m.x, m.y, m.r, MARK_GAP);
  // (Worked out, not kept: the map and the turtles are kept for the world as the server has her, raised islands and all.)
  const adv = buildAdv(old, false);
  const advPoints: [number, number][] = [...adv.objs, ...adv.guards].map((o) => [o.x, o.y]);
  for (const [x, y] of advPoints) add(x, y, 0, ADV_GAP);
  for (const t of turtles(old, false)) {
    for (let k = 0; k < 90; k++) {
      const p = turtlePos(t, (k / 90) * t.lap);
      add(p.x, p.y, TURTLE_R, TURTLE_GAP);
    }
  }
  // The lanes between the old harbours (both sets, as step 6 kept them open), and the harbours themselves.
  const lanes = [...portLanes(old.ports), ...portLanes(old.ports.filter((p) => !p.raft))];
  const laneDist = (x: number, y: number) => {
    let best = Infinity;
    for (const [ax, ay, bx, by] of lanes) best = Math.min(best, segDist(x, y, ax, ay, bx, by));
    return best;
  };
  const harbours: { x: number; y: number; gap: number }[] = old.ports.map((p) => ({ x: p.x, y: p.y, gap: p.raft ? RAFT_GAP : HARBOUR_GAP }));
  const lo = WORLD_EDGE_MARGIN + 3000, hi = WORLD_SIZE - WORLD_EDGE_MARGIN - 3000;
  /** Whether her island of reach R fits at (x, y): her sea all round, clear of all of it. */
  const fits = (rid: RegionId, x: number, y: number, R: number) => {
    if (x < lo || y < lo || x > hi || y > hi) return false;
    if (regionAt(old, x, y) !== rid || !clear(x, y, R)) return false;
    // (her anchorage lies within R + 150 m of her middle: whether it can be clear is known here, whether it is, below)
    if (harbours.some((h) => Math.hypot(h.x - x, h.y - y) < h.gap - R - 150)) return false;
    if (distanceToCurrents(x, y) < R + 600) return false;
    if (WHIRLPOOLS.some((w) => Math.hypot(w.x - x, w.y - y) < w.radius * 2.2 + R + 300)) return false;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      if (regionAt(old, x + Math.sin(a) * (R + 500), y - Math.cos(a) * (R + 500)) !== rid) return false;
    }
    return laneDist(x, y) >= R + LANE_GAP;
  };
  /** Her island at (x, y) of reach R, and her anchorage: off the coast where the water is widest (a little toward the
   *  sea's lanes when it is all as wide), on a side whose anchorage is clear of the map's things and every harbour. */
  const harbourAt = (d: NewPortDef, x: number, y: number, R: number): { poly: number[]; anchor: [number, number] } | null => {
    const rng = new Rng((hashString(d.id) ^ (seed * 337 + 0x2a0f)) >>> 0);
    const poly = islandPoly(rng, x, y, R / 1.25, seed + 90000 + islands.length * 7);
    let anchor: [number, number] | null = null, bestScore = -Infinity;
    for (let k = 0; k < 24; k++) {
      const [ax, ay] = coastAnchor(poly, x, y, (k / 24) * TAU, 150);
      if (regionAt(old, ax, ay) !== d.region || harbours.some((h) => Math.hypot(h.x - ax, h.y - ay) < h.gap)) continue;
      if (advPoints.some(([px, py]) => Math.abs(px - ax) < ADV_HARBOUR && Math.hypot(px - ax, py - ay) < ADV_HARBOUR)) continue;
      const score = Math.min(1200, openness(ax, ay)) - laneDist(ax, ay) * 0.02;
      if (score > bestScore) {
        bestScore = score;
        anchor = [ax, ay];
      }
    }
    return anchor ? { poly, anchor } : null;
  };
  /** Where her island goes: rings outward from `near`, 250 m apart; at each spot the largest island that fits there
   *  (her full size down to ISLE_R_MIN of it) and has a harbour; the nearest spot wins, a smaller island paying
   *  SHRINK_COST metres of distance for her whole size (so a slightly smaller town where she was meant to be beats a
   *  full one a sea away). */
  const spotFor = (d: NewPortDef): { x: number; y: number; R: number; poly: number[]; anchor: [number, number] } | null => {
    const [nx, ny] = d.near;
    const full = PORT_ISLE_R[d.size];
    const sizes: number[] = [];
    for (let k = ISLE_R_MIN; k <= 1 + 1e-9; k += 0.06) sizes.push(Math.round(full * Math.min(1, k)));
    if (sizes[sizes.length - 1] !== full) sizes.push(full);
    let best: { x: number; y: number; R: number; poly: number[]; anchor: [number, number] } | null = null, bestScore = Infinity;
    for (let ring = 0; ring <= 240 && ring * 250 < bestScore; ring++) {
      const rad = ring * 250;
      const steps = Math.max(1, Math.round((TAU * rad) / 250));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * TAU;
        const x = nx + Math.sin(a) * rad, y = ny - Math.cos(a) * rad;
        // (a smaller island fits wherever a larger one does: the smallest first, then up while she still fits)
        let R = 0;
        for (const r of sizes) {
          if (!fits(d.region, x, y, r)) break;
          R = r;
        }
        if (!R) continue;
        const score = rad + (1 - R / full) * SHRINK_COST;
        if (score >= bestScore) continue;
        const h = harbourAt(d, x, y, R);
        if (!h) continue;
        bestScore = score;
        best = { x, y, R, ...h };
      }
    }
    return best;
  };
  /** How far her anchorage at (x, y) looks over open water (to the nearest other land or reef, at most 2 km). */
  const openness = (x: number, y: number) => {
    let best = 2000;
    const b = buckets[Math.min(BN - 1, Math.max(0, Math.floor(y / B))) * BN + Math.min(BN - 1, Math.max(0, Math.floor(x / B)))];
    for (const o of b) if (o.pad === CHANNEL || o.pad === REEF_GAP) best = Math.min(best, Math.hypot(o.x - x, o.y - y) - o.r);
    return best;
  };
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
    const pad = is.radius + 200;
    for (let gy = Math.floor((is.y - pad) / NAV_CELL); gy <= Math.floor((is.y + pad) / NAV_CELL); gy++) {
      for (let gx = Math.floor((is.x - pad) / NAV_CELL); gx <= Math.floor((is.x + pad) / NAV_CELL); gx++) {
        if (gx < 0 || gy < 0 || gx >= n || gy >= n) continue;
        const cx = gx * NAV_CELL + NAV_CELL / 2, cy = gy * NAV_CELL + NAV_CELL / 2;
        if (pointInPolygon(cx, cy, is.poly) || closestOnPolygon(cx, cy, is.poly).d2 < 160 * 160) navGrid[gy * n + gx] = 1;
      }
    }
  };
  for (const d of NEW_PORTS) {
    const at = spotFor(d);
    if (!at) continue; // (no seed so far leaves a sea without room; a world without her is still a world)
    const { x, y, R, poly, anchor: [ax, ay] } = at;
    const is: Island = { id: islands.length, name: d.name, region: d.region, biome: d.biome, x, y, radius: R, poly, features: ['port'], portId: d.id };
    islands.push(is);
    index(is);
    add(x, y, R, CHANNEL);
    navGrid[Math.floor(ay / NAV_CELL) * n + Math.floor(ax / NAV_CELL)] = 0;
    harbours.push({ x: ax, y: ay, gap: HARBOUR_GAP });
    const port: Port = {
      id: d.id, name: d.name, region: d.region, faction: d.faction, x: ax, y: ay, islandId: is.id, size: d.size, shipyardTier: d.shipyardTier,
      blackMarket: d.blackMarket, profile: newPortProfile(d), description: d.description, key: false,
    };
    ports.push(port);
  }
  const world: World = { ...old, islands, ports, chunks, navGrid, portsFrom, portIslesFrom };
  legacyOf.set(world, legacyOf.get(old) ?? old);
  beforePortsOf.set(world, old);
  return world;
}
