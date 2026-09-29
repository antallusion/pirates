// Deterministic world generation. The server is the only consumer that sees the whole world;
// clients receive islands chunk-by-chunk (information is a resource — see docs/04_TECHNICAL_ARCHITECTURE.md).

import { CHUNK_SIZE, CHUNKS_PER_SIDE, NAV_CELL, WORLD_SIZE } from '../constants.ts';
import { closestOnPolygon, headingVec, pointInPolygon, TAU } from '../math.ts';
import { fbm, hashString, Rng } from '../rng.ts';
import type { FactionId } from '../data/factions.ts';
import type { GoodId } from '../data/goods.ts';
import { GOOD_IDS } from '../data/goods.ts';
import { KEY_PORTS, REGIONS, REGION_IDS, WORLD_EDGE_MARGIN, biomeFromMix } from './regions.ts';
import type { IslandBiome, PortProfile, RegionId } from './regions.ts';

export type IslandFeature = 'port' | 'ruins' | 'wreck' | 'lighthouse' | 'grove' | 'mine' | 'pearl_bank' | 'shrine' | 'cache'
  | 'fort' | 'volcano' | 'bones' | 'bell' | 'hermit' | 'spring';

export interface Island {
  id: number;
  name: string;
  region: RegionId;
  biome: IslandBiome;
  x: number;
  y: number;
  radius: number; // bounding radius
  poly: number[]; // flat [x0,y0,...] world coords, clockwise
  features: IslandFeature[];
  portId?: string;
}

export interface Port {
  id: string;
  name: string;
  region: RegionId;
  faction: FactionId;
  x: number;
  y: number;
  islandId: number;
  size: 1 | 2 | 3;
  shipyardTier: number;
  blackMarket: boolean;
  profile: PortProfile;
  description: string;
  key: boolean;
}

export interface Current {
  id: string;
  name: string;
  points: [number, number][];
  width: number;
  strength: number; // m/s at the core
}

/** A submerged reef or sandbar: water, but only `depth` meters of it. Deep-draft hulls ground on it. */
export interface Reef {
  id: number;
  region: RegionId;
  x: number;
  y: number;
  radius: number;
  poly: number[];
  depth: number;
}

/** A maelstrom: a spinning, sucking current. Deadly at the core, a slingshot at the rim. */
export interface Whirlpool {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  strength: number; // tangential m/s at the rim
  clockwise: boolean;
}

export const WHIRLPOOLS: Whirlpool[] = [
  { id: 'widows_eye', name: "The Widow's Eye", x: 50000, y: 36000, radius: 1400, strength: 5, clockwise: true },
  { id: 'gullet', name: 'The Gullet', x: 60500, y: 49500, radius: 1100, strength: 4.5, clockwise: false },
  { id: 'saltmouth', name: 'Saltmouth Drain', x: 45000, y: 47500, radius: 900, strength: 4, clockwise: true },
  { id: 'the_throat', name: 'The Throat', x: 86000, y: 13000, radius: 1800, strength: 6.5, clockwise: false },
];

export interface World {
  seed: number;
  whirlpools: Whirlpool[];
  islands: Island[];
  reefs: Reef[];
  reefChunks: Map<number, number[]>;
  ports: Port[];
  currents: Current[];
  chunks: Map<number, number[]>; // chunk key -> island ids
  regionGrid: Uint8Array; // 1 km cells -> region index
  navGrid: Uint8Array; // NAV_CELL cells: 1 = blocked
  navSize: number;
  /** The first of the outer islands (step 4 of the generation): every island before her is as she ever was. */
  outerFrom: number;
}

const REGION_CELL = 1000;
const REGION_GRID = WORLD_SIZE / REGION_CELL;

export function chunkKey(cx: number, cy: number): number {
  return cy * CHUNKS_PER_SIDE + cx;
}

export function chunkOf(x: number, y: number): [number, number] {
  return [
    Math.max(0, Math.min(CHUNKS_PER_SIDE - 1, Math.floor(x / CHUNK_SIZE))),
    Math.max(0, Math.min(CHUNKS_PER_SIDE - 1, Math.floor(y / CHUNK_SIZE))),
  ];
}

/** Region assignment: warped Voronoi over region centers so borders look organic. */
export function regionAtRaw(x: number, y: number, seed: number): RegionId {
  const wx = x + (fbm(x / 9000, y / 9000, seed + 11) - 0.5) * 9000;
  const wy = y + (fbm(x / 9000, y / 9000, seed + 23) - 0.5) * 9000;
  let best: RegionId = 'black_coast';
  let bestD = Infinity;
  for (const id of REGION_IDS) {
    const [cx, cy] = REGIONS[id].center;
    // The Abyss is small and sharp-edged; weight it down so it stays a corner of dread.
    const w = id === 'the_abyss' ? 1.6 : 1;
    const d = ((wx - cx) ** 2 + (wy - cy) ** 2) * w;
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

export function regionAt(world: World, x: number, y: number): RegionId {
  const gx = Math.max(0, Math.min(REGION_GRID - 1, Math.floor(x / REGION_CELL)));
  const gy = Math.max(0, Math.min(REGION_GRID - 1, Math.floor(y / REGION_CELL)));
  return REGION_IDS[world.regionGrid[gy * REGION_GRID + gx]];
}

const SYLLABLES: Record<IslandBiome, [string[], string[]]> = {
  temperate: [['Grey', 'Raven', 'Salt', 'Widow', 'Bell', 'Cold', 'Lantern', 'Gallows', 'Mourn', 'Iron'], ['rock', 'holm', 'cliff', 'reach', 'mouth', 'point', 'wick', 'stead', 'isle', 'haven']],
  mossy: [['Hush', 'Moss', 'Whisper', 'Murk', 'Veil', 'Sallow', 'Drift', 'Fen', 'Low', 'Silt'], ['key', 'cay', 'holt', 'islet', 'shoal', 'reed', 'mere', 'hollow', 'bank', 'wisp']],
  volcanic: [['Cinder', 'Ash', 'Brim', 'Char', 'Slag', 'Ember', 'Soot', 'Pyre', 'Scorch', 'Clinker'], ['crag', 'cone', 'vent', 'maw', 'forge', 'spire', 'caldera', 'scar', 'tooth', 'heap']],
  ice: [['Rime', 'Frost', 'Pale', 'White', 'Whale', 'Sorrow', 'Hoar', 'Glass', 'Bleak', 'North'], ['berg', 'fjord', 'skerry', 'ness', 'fell', 'bone', 'shelf', 'tusk', 'spur', 'drift']],
  ruins: [['Drowned', 'Sunk', 'Saint', 'Hollow', 'Crown', 'Choir', 'Pale', 'Idol', 'Altar', 'Vesper'], ['spire', 'chapel', 'gate', 'throne', 'arch', 'steps', 'nave', 'crypt', 'court', 'tomb']],
  bone: [['Marrow', 'Rib', 'Skull', 'Hollow', 'Black', 'Silent', 'Lightless', 'Deep', 'Grave', 'Eyeless'], ['reef', 'spine', 'jaw', 'coil', 'teeth', 'ossuary', 'vault', 'rift', 'pit', 'shell']],
  barren: [['Dead', 'Bleached', 'Lost', 'Salt', 'Wreck', 'Last', 'Empty', 'Gull', 'Tern', 'Drear'], ['rock', 'bar', 'reef', 'isle', 'stack', 'key', 'mark', 'shoal', 'ledge', 'point']],
  jungle: [['Green', 'Parrot', 'Vine', 'Fever', 'Palm', 'Howler', 'Orchid', 'Monkey', 'Tangle', 'Steam'], ['key', 'cay', 'isle', 'hold', 'bight', 'cove', 'point', 'reach', 'wood', 'haven']],
  mangrove: [['Root', 'Mud', 'Heron', 'Tide', 'Crab', 'Brack', 'Stilt', 'Eel', 'Knot', 'Silt'], ['cay', 'key', 'bank', 'slough', 'mire', 'creek', 'reach', 'hollow', 'fen', 'bar']],
  atoll: [['Coral', 'Ring', 'Lagoon', 'Pearl', 'Blue', 'Turtle', 'Conch', 'Sun', 'Tern', 'Reef'], ['atoll', 'ring', 'cay', 'key', 'reef', 'bank', 'lagoon', 'shoal', 'isle', 'bar']],
  saltflat: [['Salt', 'White', 'Brine', 'Pale', 'Crust', 'Glare', 'Dry', 'Bitter', 'Chalk', 'Blind'], ['pan', 'flat', 'marsh', 'bar', 'spit', 'key', 'reach', 'shelf', 'mark', 'isle']],
  blacksand: [['Black', 'Jet', 'Soot', 'Coal', 'Night', 'Raven', 'Tar', 'Ink', 'Crow', 'Sable'], ['strand', 'beach', 'point', 'cove', 'shore', 'rock', 'bight', 'head', 'isle', 'holm']],
  fungal: [['Spore', 'Pale', 'Glow', 'Rot', 'Cap', 'Mould', 'Blight', 'Gill', 'Lantern', 'Mire'], ['wood', 'hollow', 'cay', 'mere', 'grove', 'isle', 'key', 'rise', 'fen', 'deep']],
  crystal: [['Glass', 'Prism', 'Shard', 'Quartz', 'Gleam', 'Facet', 'Spar', 'Hollow', 'Singing', 'Star'], ['spire', 'stack', 'crag', 'cliff', 'teeth', 'rock', 'point', 'fang', 'crown', 'isle']],
};

function islandName(rng: Rng, biome: IslandBiome, used: Set<string>): string {
  const [a, b] = SYLLABLES[biome];
  for (let i = 0; i < 12; i++) {
    const n = rng.pick(a) + rng.pick(b);
    const name = rng.chance(0.25) ? `${n} ${rng.pick(['Isle', 'Rock', 'Key', 'Holm'])}` : n;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const n = `${rng.pick(a)}${rng.pick(b)} ${used.size}`;
  used.add(n);
  return n;
}

function islandPoly(rng: Rng, x: number, y: number, radius: number, seed: number): number[] {
  const verts = Math.max(14, Math.min(48, Math.round(radius / 28)));
  const poly: number[] = [];
  const phase = rng.range(0, 100);
  const elong = rng.range(0.65, 1.0);
  const rot = rng.range(0, TAU);
  for (let i = 0; i < verts; i++) {
    const a = (i / verts) * TAU;
    const n = fbm(Math.cos(a) * 1.6 + phase, Math.sin(a) * 1.6 + phase, seed, 4);
    let r = radius * (0.58 + n * 0.62);
    // Elongate along a random axis.
    const la = a - rot;
    r *= Math.sqrt((Math.cos(la) ** 2) + (Math.sin(la) * elong) ** 2);
    poly.push(x + Math.sin(a) * r, y - Math.cos(a) * r);
  }
  return poly;
}

function randomProfile(rng: Rng, biome: IslandBiome, size: number): PortProfile {
  const pools: Record<IslandBiome, GoodId[]> = {
    temperate: ['provisions', 'timber', 'salt', 'cloth', 'sugar', 'rum'],
    mossy: ['provisions', 'pearls', 'dreamleaf', 'timber', 'tobacco'],
    volcanic: ['iron', 'coal', 'gunpowder'],
    ice: ['whale_oil', 'provisions', 'timber'],
    ruins: ['cursed_relics', 'pearls', 'abyssal_ore'],
    bone: ['abyssal_ore', 'cursed_relics'],
    barren: ['salt', 'planks', 'provisions'],
    jungle: ['sugar', 'tobacco', 'spices', 'timber'],
    mangrove: ['timber', 'provisions', 'dreamleaf'],
    atoll: ['pearls', 'salt', 'provisions'],
    saltflat: ['salt', 'provisions'],
    blacksand: ['iron', 'coal', 'salt'],
    fungal: ['dreamleaf', 'medicine'],
    crystal: ['abyssal_ore', 'pearls', 'iron'],
  };
  const produces: Partial<Record<GoodId, number>> = {};
  const consumes: Partial<Record<GoodId, number>> = {};
  const pool = pools[biome];
  const nProd = 1 + (rng.chance(0.5) ? 1 : 0);
  for (let i = 0; i < nProd; i++) produces[rng.pick(pool)] = Math.round(rng.range(6, 16) * size);
  const consumable = GOOD_IDS.filter((g) => !(g in produces) && g !== 'cursed_relics' && g !== 'abyssal_ore' && g !== 'dreamleaf');
  consumes.provisions = Math.round(rng.range(6, 14) * size);
  for (let i = 0; i < 3; i++) consumes[rng.pick(consumable)] = Math.round(rng.range(3, 10) * size);
  return { produces, consumes };
}

const CURRENTS: Current[] = [
  { id: 'crown_run', name: 'The Crown Run', points: [[8000, 90000], [16000, 84000], [28000, 76000], [40000, 72000], [52000, 70000]], width: 1600, strength: 3.2 },
  { id: 'gravewater_stream', name: 'Gravewater Stream', points: [[42000, 80000], [56000, 82000], [68000, 78000], [78000, 74000], [90000, 64000]], width: 2200, strength: 3.8 },
  { id: 'northbound_drift', name: 'Northbound Drift', points: [[10000, 62000], [12000, 48000], [16000, 34000], [22000, 24000], [30000, 20000]], width: 1800, strength: 3.0 },
  { id: 'deadwater_gyre', name: 'The Deadwater Gyre', points: [[46000, 34000], [60000, 30000], [66000, 42000], [60000, 54000], [46000, 52000], [42000, 42000], [46000, 34000]], width: 2400, strength: 4.2 },
  { id: 'abyssal_pull', name: 'The Abyssal Pull', points: [[62000, 40000], [70000, 30000], [80000, 18000], [88000, 9000]], width: 2000, strength: 4.6 },
  { id: 'ashen_return', name: 'Ashen Return', points: [[88000, 84000], [72000, 88000], [56000, 90000], [40000, 88000], [24000, 92000]], width: 1600, strength: 3.0 },
];

export function generateWorld(seed: number): World {
  const rng = new Rng(seed);
  const islands: Island[] = [];
  const ports: Port[] = [];
  const usedNames = new Set<string>();

  // Region grid.
  const regionGrid = new Uint8Array(REGION_GRID * REGION_GRID);
  for (let gy = 0; gy < REGION_GRID; gy++) {
    for (let gx = 0; gx < REGION_GRID; gx++) {
      const r = regionAtRaw(gx * REGION_CELL + 500, gy * REGION_CELL + 500, seed);
      regionGrid[gy * REGION_GRID + gx] = REGION_IDS.indexOf(r);
    }
  }
  const regionOf = (x: number, y: number): RegionId => {
    const gx = Math.max(0, Math.min(REGION_GRID - 1, Math.floor(x / REGION_CELL)));
    const gy = Math.max(0, Math.min(REGION_GRID - 1, Math.floor(y / REGION_CELL)));
    return REGION_IDS[regionGrid[gy * REGION_GRID + gx]];
  };

  const overlaps = (x: number, y: number, r: number, margin: number): boolean => {
    for (const is of islands) {
      const d = Math.hypot(is.x - x, is.y - y);
      if (d < is.radius + r + margin) return true;
    }
    for (const p of ports) {
      if (Math.hypot(p.x - x, p.y - y) < r + 900) return true;
    }
    return false;
  };

  // 1) Key port islands.
  for (const kp of KEY_PORTS) {
    const dir = headingVec(kp.coastDir);
    const cx = kp.pos[0] + dir.x * kp.islandRadius * 1.02;
    const cy = kp.pos[1] + dir.y * kp.islandRadius * 1.02;
    const isRng = new Rng(hashString(kp.id) ^ seed);
    const poly = islandPoly(isRng, cx, cy, kp.islandRadius, seed + islands.length);
    const island: Island = {
      id: islands.length, name: kp.name.replace(/^Port(o)? /, '') + ' Isle', region: kp.region, biome: REGIONS[kp.region].biome,
      x: cx, y: cy, radius: kp.islandRadius * 1.25, poly, features: ['port'], portId: kp.id,
    };
    islands.push(island);
    // Move the anchor to just off the real (noisy) coastline so the town sits on the shore.
    const [ax, ay] = coastAnchor(poly, cx, cy, kp.coastDir + Math.PI, 150);
    ports.push({
      id: kp.id, name: kp.name, region: kp.region, faction: kp.faction, x: ax, y: ay, islandId: island.id,
      size: kp.size, shipyardTier: kp.shipyardTier, blackMarket: kp.blackMarket, profile: kp.profile, description: kp.description, key: true,
    });
  }

  // 2) Procedural islands per region: rejection sampling around the region center.
  for (const rid of REGION_IDS) {
    const reg = REGIONS[rid];
    let placed = 0;
    let attempts = 0;
    while (placed < reg.islandCount && attempts < reg.islandCount * 60) {
      attempts++;
      const x = rng.range(WORLD_EDGE_MARGIN + 1500, WORLD_SIZE - WORLD_EDGE_MARGIN - 1500);
      const y = rng.range(WORLD_EDGE_MARGIN + 1500, WORLD_SIZE - WORLD_EDGE_MARGIN - 1500);
      if (regionOf(x, y) !== rid) continue;
      // Radius: mostly small, a few large. Lognormal-ish.
      const roll = rng.float();
      let r = roll < 0.55 ? rng.range(90, 260) : roll < 0.88 ? rng.range(260, 650) : rng.range(650, 1300);
      r *= reg.islandScale;
      // Keep currents navigable and maelstrom eyes in open water.
      if (distanceToCurrents(x, y) < r + 700) continue;
      if (WHIRLPOOLS.some((w) => Math.hypot(w.x - x, w.y - y) < w.radius * 1.4 + r)) continue;
      if (overlaps(x, y, r, 380)) continue;
      const poly = islandPoly(rng, x, y, r, seed + islands.length * 7);
      const features: IslandFeature[] = [];
      const strange = reg.strangeness;
      if (rng.chance(0.08 + strange * 0.3)) features.push('ruins');
      if (rng.chance(0.07)) features.push('wreck');
      if (r > 250 && rng.chance(0.06 * (1 - strange))) features.push('lighthouse');
      if (reg.biome === 'mossy' && rng.chance(0.12)) features.push('pearl_bank');
      if (reg.biome === 'volcanic' && rng.chance(0.2)) features.push('mine');
      if ((reg.biome === 'temperate' || reg.biome === 'ice') && r > 300 && rng.chance(0.2)) features.push('grove');
      if (rng.chance(0.03 + strange * 0.12)) features.push('shrine');
      if (rng.chance(0.05)) features.push('cache');
      islands.push({ id: islands.length, name: islandName(rng, reg.biome, usedNames), region: rid, biome: reg.biome, x, y, radius: r * 1.25, poly, features });
      placed++;
    }
  }

  // 2a) Living islands (docs/11 P3): each island's biome comes from her region's mix, rolled from her own
  // generator so every island keeps her place, shape and name. A key port's island keeps the region's own.
  for (const is of islands) {
    if (is.portId) continue;
    is.biome = biomeFromMix(is.region, new Rng((seed * 53 + is.id * 104729 + 7) >>> 0).float());
  }

  // 2b) The later features (an old fort, a live volcano, leviathan bones, a drowned bell tower, a hermit, a
  // spring). They roll from their own generator per island, so the islands and ports rolled above stay exactly
  // where every saved chart has them.
  for (const is of islands) {
    if (is.portId) continue;
    const r2 = new Rng((seed * 31 + is.id * 7919 + 13) >>> 0);
    const reg = REGIONS[is.region];
    const r = is.radius / 1.25;
    const b = is.biome;
    if (reg.safety !== 'lawless' && r > 300 && r2.chance(0.07)) is.features.push('fort');
    if (b === 'volcanic' && r > 250 && r2.chance(0.3)) is.features.push('volcano');
    if ((b === 'ice' || b === 'bone') && r2.chance(0.16)) is.features.push('bones');
    else if (b === 'barren' && r2.chance(0.06)) is.features.push('bones');
    if ((b === 'ruins' || b === 'mossy' || is.region === 'drowned_crown') && r2.chance(0.12)) is.features.push('bell');
    if (r > 200 && r2.chance(0.05)) is.features.push('hermit');
    if ((b === 'temperate' || b === 'mossy') && r > 250 && r2.chance(0.1)) is.features.push('spring');
    // The new biomes' own: groves and springs in the green, pearls on the coral, a mine in black sand or crystal.
    if ((b === 'jungle' || b === 'mangrove') && r > 250 && r2.chance(0.14)) is.features.push(r2.chance(0.5) ? 'spring' : 'grove');
    if (b === 'atoll' && r2.chance(0.25)) is.features.push('pearl_bank');
    if ((b === 'blacksand' || b === 'crystal') && r > 220 && r2.chance(0.15)) is.features.push('mine');
  }

  // 3) Minor ports: villages on medium islands, 2 per region (never in The Abyss).
  const minorFaction: Record<RegionId, FactionId[]> = {
    black_coast: ['crown', 'league'], gravewater: ['league', 'free'], whispering: ['brokers', 'free'], ashen_isles: ['confederacy'],
    leviathan_reach: ['harpoon', 'free'], dead_mans_expanse: ['free', 'confederacy'], drowned_crown: ['choir', 'free'], the_abyss: [],
  };
  for (const rid of REGION_IDS) {
    if (minorFaction[rid].length === 0) continue;
    const candidates = islands.filter((i) => i.region === rid && !i.portId && i.radius > 380 && i.radius < 1400);
    let made = 0;
    for (const is of candidates) {
      if (made >= 2) break;
      if (ports.some((p) => Math.hypot(p.x - is.x, p.y - is.y) < 9000)) continue;
      // Anchor: just outside the coast on the side facing the region center.
      const [rcx, rcy] = REGIONS[rid].center;
      const ang = Math.atan2(rcx - is.x, -(rcy - is.y));
      const [ax, ay] = coastAnchor(is.poly, is.x, is.y, ang, 140);
      const faction = rng.pick(minorFaction[rid]);
      const size = 1 as const;
      is.features.push('port');
      is.portId = `${rid}_v${made}`;
      ports.push({
        id: is.portId, name: is.name, region: rid, faction, x: ax, y: ay, islandId: is.id, size, shipyardTier: 1,
        blackMarket: faction === 'brokers' || faction === 'confederacy' || faction === 'free',
        profile: randomProfile(rng, is.biome, size), description: `A small ${REGIONS[rid].biome} settlement under ${faction} colours.`, key: false,
      });
      made++;
    }
  }

  // 3b) More villages: up to three more a region, closer together, from their own generator (the first two keep
  // their ids and places for every saved game).
  const vrng = new Rng((seed * 131 + 977) >>> 0);
  for (const rid of REGION_IDS) {
    if (minorFaction[rid].length === 0) continue;
    // A lighthouse island stays a landmark (and a guild's route node), not a village.
    const candidates = islands.filter((i) => i.region === rid && !i.portId && !i.features.includes('lighthouse') && i.radius > 320 && i.radius < 1500);
    let made = ports.filter((p) => p.region === rid && !p.key).length;
    const cap = made + 3;
    for (const is of candidates) {
      if (made >= cap) break;
      if (ports.some((p) => Math.hypot(p.x - is.x, p.y - is.y) < 5500)) continue;
      const [rcx, rcy] = REGIONS[rid].center;
      const ang = Math.atan2(rcx - is.x, -(rcy - is.y));
      const [ax, ay] = coastAnchor(is.poly, is.x, is.y, ang, 140);
      const faction = vrng.pick(minorFaction[rid]);
      const size = 1 as const;
      is.features.push('port');
      is.portId = `${rid}_v${made}`;
      ports.push({
        id: is.portId, name: is.name, region: rid, faction, x: ax, y: ay, islandId: is.id, size, shipyardTier: 1,
        blackMarket: faction === 'brokers' || faction === 'confederacy' || faction === 'free',
        profile: randomProfile(vrng, is.biome, size), description: `A small ${REGIONS[rid].biome} settlement under ${faction} colours.`, key: false,
      });
      made++;
    }
  }

  // Chunk index.
  const chunks = new Map<number, number[]>();
  for (const is of islands) {
    const [x0, y0] = chunkOf(is.x - is.radius, is.y - is.radius);
    const [x1, y1] = chunkOf(is.x + is.radius, is.y + is.radius);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = chunkKey(cx, cy);
        let list = chunks.get(k);
        if (!list) chunks.set(k, (list = []));
        list.push(is.id);
      }
    }
  }

  // Reefs and sandbars: separate RNG stream so island layout stays stable.
  const reefRng = new Rng(seed ^ 0x2eef);
  const reefs: Reef[] = [];
  const REEF_COUNT: Record<RegionId, number> = {
    black_coast: 16, gravewater: 16, whispering: 60, ashen_isles: 12, leviathan_reach: 12, dead_mans_expanse: 24, drowned_crown: 24, the_abyss: 10,
  };
  for (const rid of REGION_IDS) {
    let placed = 0, attempts = 0;
    while (placed < REEF_COUNT[rid] && attempts < REEF_COUNT[rid] * 80) {
      attempts++;
      const x = reefRng.range(WORLD_EDGE_MARGIN + 1500, WORLD_SIZE - WORLD_EDGE_MARGIN - 1500);
      const y = reefRng.range(WORLD_EDGE_MARGIN + 1500, WORLD_SIZE - WORLD_EDGE_MARGIN - 1500);
      if (regionOf(x, y) !== rid) continue;
      const r = reefRng.range(60, 230);
      if (distanceToCurrents(x, y) < r + 400) continue;
      if (WHIRLPOOLS.some((w) => Math.hypot(w.x - x, w.y - y) < w.radius * 1.4 + r)) continue;
      if (islands.some((is) => Math.hypot(is.x - x, is.y - y) < is.radius + r + 150)) continue;
      if (ports.some((p) => Math.hypot(p.x - x, p.y - y) < r + 1500)) continue;
      if (reefs.some((q) => Math.hypot(q.x - x, q.y - y) < q.radius + r + 120)) continue;
      const poly = islandPoly(reefRng, x, y, r, seed + 9000 + reefs.length);
      reefs.push({ id: reefs.length, region: rid, x, y, radius: r * 1.25, poly, depth: Math.round(reefRng.range(1.2, 2.8) * 10) / 10 });
      placed++;
    }
  }
  // 4) The outer islands (2026-09-30: more islands, each with something ashore): some 45% more, appended after
  // everything above from their own generator, so every island, port and reef rolled before keeps her id and
  // place. They keep off the ports, the lanes between neighbouring ports, the currents, the maelstroms, the reefs
  // and each other, and take their biome and features from their region like the rest.
  const outerFrom = islands.length;
  const lanes = portLanes(ports);
  const orng = new Rng((seed * 197 + 4099) >>> 0);
  for (const rid of REGION_IDS) {
    const reg = REGIONS[rid];
    const want = outerIslandCount(rid);
    let placed = 0, attempts = 0;
    while (placed < want && attempts < want * 120) {
      attempts++;
      const x = orng.range(WORLD_EDGE_MARGIN + 1500, WORLD_SIZE - WORLD_EDGE_MARGIN - 1500);
      const y = orng.range(WORLD_EDGE_MARGIN + 1500, WORLD_SIZE - WORLD_EDGE_MARGIN - 1500);
      if (regionOf(x, y) !== rid) continue;
      const roll = orng.float();
      let r = roll < 0.6 ? orng.range(90, 240) : roll < 0.92 ? orng.range(240, 560) : orng.range(560, 1000);
      r *= reg.islandScale;
      if (distanceToCurrents(x, y) < r + 700) continue;
      if (WHIRLPOOLS.some((w) => Math.hypot(w.x - x, w.y - y) < w.radius * 1.4 + r)) continue;
      if (ports.some((p) => Math.hypot(p.x - x, p.y - y) < r * 1.25 + 2500)) continue;
      if (islands.some((is) => Math.hypot(is.x - x, is.y - y) < is.radius + r * 1.25 + 420)) continue;
      if (reefs.some((q) => Math.hypot(q.x - x, q.y - y) < q.radius + r * 1.25 + 300)) continue;
      if (lanes.some(([ax, ay, bx, by]) => segDist(x, y, ax, ay, bx, by) < r * 1.25 + 900)) continue;
      const poly = islandPoly(orng, x, y, r, seed + 20000 + islands.length * 7);
      const id = islands.length;
      const biome = biomeFromMix(rid, orng.float());
      const features: IslandFeature[] = [];
      const strange = reg.strangeness;
      if (orng.chance(0.06 + strange * 0.25)) features.push('ruins');
      if (orng.chance(0.06)) features.push('wreck');
      if (biome === 'mossy' && orng.chance(0.1)) features.push('pearl_bank');
      if (biome === 'atoll' && orng.chance(0.2)) features.push('pearl_bank');
      if ((biome === 'volcanic' || biome === 'blacksand' || biome === 'crystal') && r > 220 && orng.chance(0.15)) features.push('mine');
      if ((biome === 'temperate' || biome === 'ice' || biome === 'jungle' || biome === 'mangrove') && r > 280 && orng.chance(0.15)) features.push('grove');
      if (orng.chance(0.03 + strange * 0.1)) features.push('shrine');
      if (orng.chance(0.05)) features.push('cache');
      if ((biome === 'ice' || biome === 'bone') && orng.chance(0.12)) features.push('bones');
      if ((biome === 'ruins' || biome === 'mossy') && orng.chance(0.08)) features.push('bell');
      if ((biome === 'temperate' || biome === 'mossy' || biome === 'jungle') && r > 240 && orng.chance(0.08)) features.push('spring');
      if (r > 200 && orng.chance(0.04)) features.push('hermit');
      // Named from the region's own syllables, like every island before her (the names the client has in Russian).
      const is: Island = { id, name: islandName(orng, reg.biome, usedNames), region: rid, biome, x, y, radius: r * 1.25, poly, features };
      islands.push(is);
      const [x0, y0] = chunkOf(is.x - is.radius, is.y - is.radius);
      const [x1, y1] = chunkOf(is.x + is.radius, is.y + is.radius);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const k = chunkKey(cx, cy);
          let list = chunks.get(k);
          if (!list) chunks.set(k, (list = []));
          list.push(is.id);
        }
      }
      placed++;
    }
  }

  const reefChunks = new Map<number, number[]>();
  for (const rf of reefs) {
    const [x0, y0] = chunkOf(rf.x - rf.radius, rf.y - rf.radius);
    const [x1, y1] = chunkOf(rf.x + rf.radius, rf.y + rf.radius);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = chunkKey(cx, cy);
        let list = reefChunks.get(k);
        if (!list) reefChunks.set(k, (list = []));
        list.push(rf.id);
      }
    }
  }

  // Navigation grid: blocked if the cell center is on land or within 160 m of a coast, or outside the Maelstrom Wall.
  const navSize = WORLD_SIZE / NAV_CELL;
  const navGrid = new Uint8Array(navSize * navSize);
  for (let gy = 0; gy < navSize; gy++) {
    for (let gx = 0; gx < navSize; gx++) {
      const x = gx * NAV_CELL + NAV_CELL / 2;
      const y = gy * NAV_CELL + NAV_CELL / 2;
      if (x < WORLD_EDGE_MARGIN || y < WORLD_EDGE_MARGIN || x > WORLD_SIZE - WORLD_EDGE_MARGIN || y > WORLD_SIZE - WORLD_EDGE_MARGIN) {
        navGrid[gy * navSize + gx] = 1;
        continue;
      }
      for (const id of chunks.get(chunkKey(...chunkOf(x, y))) ?? []) {
        const is = islands[id];
        if (Math.hypot(is.x - x, is.y - y) > is.radius + 260) continue;
        if (pointInPolygon(x, y, is.poly) || closestOnPolygon(x, y, is.poly).d2 < 160 * 160) {
          navGrid[gy * navSize + gx] = 1;
          break;
        }
      }
    }
  }
  // Maelstrom eyes are not a route.
  for (const w of WHIRLPOOLS) {
    const r = w.radius * 0.6;
    for (let gy = Math.floor((w.y - r) / NAV_CELL); gy <= Math.floor((w.y + r) / NAV_CELL); gy++) {
      for (let gx = Math.floor((w.x - r) / NAV_CELL); gx <= Math.floor((w.x + r) / NAV_CELL); gx++) {
        if (Math.hypot(gx * NAV_CELL + NAV_CELL / 2 - w.x, gy * NAV_CELL + NAV_CELL / 2 - w.y) < r) navGrid[gy * navSize + gx] = 1;
      }
    }
  }
  // Reefs: rasterise each one; any cell the reef touches (half a cell diagonal) is blocked.
  for (const rf of reefs) {
    const pad = rf.radius + 300;
    for (let gy = Math.floor((rf.y - pad) / NAV_CELL); gy <= Math.floor((rf.y + pad) / NAV_CELL); gy++) {
      for (let gx = Math.floor((rf.x - pad) / NAV_CELL); gx <= Math.floor((rf.x + pad) / NAV_CELL); gx++) {
        if (gx < 0 || gy < 0 || gx >= navSize || gy >= navSize) continue;
        const x = gx * NAV_CELL + NAV_CELL / 2, y = gy * NAV_CELL + NAV_CELL / 2;
        if (pointInPolygon(x, y, rf.poly) || closestOnPolygon(x, y, rf.poly).d2 < 290 * 290) navGrid[gy * navSize + gx] = 1;
      }
    }
  }
  // Make sure port anchors are reachable.
  for (const p of ports) {
    const gx = Math.floor(p.x / NAV_CELL), gy = Math.floor(p.y / NAV_CELL);
    navGrid[gy * navSize + gx] = 0;
  }

  return { seed, whirlpools: WHIRLPOOLS, islands, reefs, reefChunks, ports, currents: CURRENTS, chunks, regionGrid, navGrid, navSize, outerFrom };
}

/** Anchor point `offset` meters beyond the outermost coastline crossing along `heading` from the island centre. */
function coastAnchor(poly: number[], cx: number, cy: number, heading: number, offset: number): [number, number] {
  const dir = headingVec(heading);
  let lastInside = 0;
  for (let d = 0; d < 4000; d += 10) {
    if (pointInPolygon(cx + dir.x * d, cy + dir.y * d, poly)) lastInside = d;
  }
  const d = lastInside + offset;
  return [cx + dir.x * d, cy + dir.y * d];
}

/** How many outer islands a region gains (step 4 of the generation): some 45% of her own count; the Crown's home
 * waters, where the First Watch learns the helm, a little fewer (40%). */
export function outerIslandCount(rid: RegionId): number {
  return Math.round(REGIONS[rid].islandCount * (rid === 'black_coast' ? 0.4 : 0.45));
}

/** The sea lanes: straight runs from every port to her three nearest neighbours, as [ax, ay, bx, by]. */
export function portLanes(ports: { x: number; y: number }[]): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const seen = new Set<string>();
  ports.forEach((p, i) => {
    const near = ports.map((q, j) => ({ j, d: Math.hypot(q.x - p.x, q.y - p.y) })).filter((o) => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 3);
    for (const { j } of near) {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([p.x, p.y, ports[j].x, ports[j].y]);
    }
  });
  return out;
}

function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax, aby = by - ay;
  const l2 = abx * abx + aby * aby;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * abx + (y - ay) * aby) / l2)) : 0;
  return Math.hypot(ax + abx * t - x, ay + aby * t - y);
}

function distanceToCurrents(x: number, y: number): number {
  let best = Infinity;
  for (const c of CURRENTS) {
    for (let i = 1; i < c.points.length; i++) {
      const [ax, ay] = c.points[i - 1];
      const [bx, by] = c.points[i];
      const abx = bx - ax, aby = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * abx + (y - ay) * aby) / (abx * abx + aby * aby)));
      const d = Math.hypot(ax + abx * t - x, ay + aby * t - y) - c.width;
      if (d < best) best = d;
    }
  }
  return best;
}

export const SEASON_SEC = 4 * 48 * 60; // a season lasts four in-game days

/** Seasonal strength of the great currents: they swell and slacken over a year of four seasons. */
export function seasonFactor(t: number): number {
  return 0.85 + 0.3 * Math.sin((t / (SEASON_SEC * 4)) * Math.PI * 2);
}

export function seasonName(t: number): string {
  return ['Thaw', 'High Tide', 'Ashfall', 'Deep Winter'][Math.floor(((t / SEASON_SEC) % 4 + 4) % 4)];
}

/** Maelstrom flow at a point: swirl plus a pull toward the core. */
export function whirlpoolAt(pools: Whirlpool[], x: number, y: number): { x: number; y: number; core: Whirlpool | null } {
  let vx = 0, vy = 0;
  let core: Whirlpool | null = null;
  for (const w of pools) {
    const dx = x - w.x, dy = y - w.y;
    const d = Math.hypot(dx, dy);
    const reach = w.radius * 2.2;
    if (d > reach || d < 1) continue;
    // Swirl peaks near the rim and fades outward; the pull grows toward the eye.
    const swirl = w.strength * Math.min(1, d / (w.radius * 0.35)) * (1 - Math.max(0, d - w.radius) / (reach - w.radius));
    const pull = w.strength * 0.35 * (1 - d / reach);
    const tx = w.clockwise ? -dy / d : dy / d, ty = w.clockwise ? dx / d : -dx / d;
    vx += tx * swirl - (dx / d) * pull;
    vy += ty * swirl - (dy / d) * pull;
    if (d < w.radius * 0.25) core = w;
  }
  return { x: vx, y: vy, core };
}

/** Ocean current vector at a point (m/s), including seasons and maelstroms. */
export function currentAt(currents: Current[], x: number, y: number, t = 0, pools: Whirlpool[] = []): { x: number; y: number } {
  let vx = 0, vy = 0;
  for (const c of currents) {
    for (let i = 1; i < c.points.length; i++) {
      const [ax, ay] = c.points[i - 1];
      const [bx, by] = c.points[i];
      const minX = Math.min(ax, bx) - c.width, maxX = Math.max(ax, bx) + c.width;
      const minY = Math.min(ay, by) - c.width, maxY = Math.max(ay, by) + c.width;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      const abx = bx - ax, aby = by - ay;
      const len = Math.hypot(abx, aby);
      const t = Math.max(0, Math.min(1, ((x - ax) * abx + (y - ay) * aby) / (len * len)));
      const d = Math.hypot(ax + abx * t - x, ay + aby * t - y);
      if (d >= c.width) continue;
      const f = (1 - d / c.width) ** 2 * c.strength;
      vx += (abx / len) * f;
      vy += (aby / len) * f;
    }
  }
  const season = seasonFactor(t);
  const wp = pools.length ? whirlpoolAt(pools, x, y) : { x: 0, y: 0 };
  return { x: vx * season + wp.x, y: vy * season + wp.y };
}

/** Islands whose bounds may contain (x, y). */
export function islandsNear(world: World, x: number, y: number): number[] {
  return world.chunks.get(chunkKey(...chunkOf(x, y))) ?? [];
}

export function isLand(world: World, x: number, y: number): Island | null {
  for (const id of islandsNear(world, x, y)) {
    const is = world.islands[id];
    if (Math.abs(is.x - x) > is.radius || Math.abs(is.y - y) > is.radius) continue;
    if (pointInPolygon(x, y, is.poly)) return is;
  }
  return null;
}

export function navBlocked(world: World, gx: number, gy: number): boolean {
  if (gx < 0 || gy < 0 || gx >= world.navSize || gy >= world.navSize) return true;
  return world.navGrid[gy * world.navSize + gx] === 1;
}

export const DEEP_WATER = 40;
const SHALLOW_BAND = 90; // meters from a coastline over which the sea floor drops away

/** Water depth in meters at a point: reefs, coastal shallows, else deep water. Land returns 0. */
export function depthAt(world: World, x: number, y: number): number {
  const key = chunkKey(...chunkOf(x, y));
  let depth = DEEP_WATER;
  for (const id of world.reefChunks.get(key) ?? []) {
    const rf = world.reefs[id];
    if (Math.abs(rf.x - x) > rf.radius || Math.abs(rf.y - y) > rf.radius) continue;
    if (pointInPolygon(x, y, rf.poly)) depth = Math.min(depth, rf.depth);
  }
  for (const id of world.chunks.get(key) ?? []) {
    const is = world.islands[id];
    if (Math.abs(is.x - x) > is.radius + SHALLOW_BAND || Math.abs(is.y - y) > is.radius + SHALLOW_BAND) continue;
    if (pointInPolygon(x, y, is.poly)) return 0;
    const d = Math.sqrt(closestOnPolygon(x, y, is.poly).d2);
    if (d < SHALLOW_BAND) depth = Math.min(depth, 1.5 + (d / SHALLOW_BAND) * 4);
  }
  return depth;
}

/** An island the sea threw up after the world was made (a world event: an eruption). */
export interface RaisedIsland {
  x: number;
  y: number;
  radius: number;
  seed: number;
  name: string;
  region: RegionId;
  biome: IslandBiome;
  features: IslandFeature[];
}

/** Add a raised island to a world: its shape (from its seed), the chunk index and the navigation grid. */
export function raiseIsland(world: World, r: RaisedIsland): Island {
  const existing = world.islands.find((is) => is.x === r.x && is.y === r.y);
  if (existing) return existing;
  const rng = new Rng(r.seed);
  const poly = islandPoly(rng, r.x, r.y, r.radius / 1.25, r.seed);
  const is: Island = { id: world.islands.length, name: r.name, region: r.region, biome: r.biome, x: r.x, y: r.y, radius: r.radius, poly, features: [...r.features] };
  world.islands.push(is);
  const [x0, y0] = chunkOf(is.x - is.radius, is.y - is.radius);
  const [x1, y1] = chunkOf(is.x + is.radius, is.y + is.radius);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const k = chunkKey(cx, cy);
      let list = world.chunks.get(k);
      if (!list) world.chunks.set(k, (list = []));
      list.push(is.id);
    }
  }
  const pad = is.radius + 200;
  for (let gy = Math.floor((is.y - pad) / NAV_CELL); gy <= Math.floor((is.y + pad) / NAV_CELL); gy++) {
    for (let gx = Math.floor((is.x - pad) / NAV_CELL); gx <= Math.floor((is.x + pad) / NAV_CELL); gx++) {
      if (gx < 0 || gy < 0 || gx >= world.navSize || gy >= world.navSize) continue;
      const x = gx * NAV_CELL + NAV_CELL / 2, y = gy * NAV_CELL + NAV_CELL / 2;
      if (pointInPolygon(x, y, poly) || closestOnPolygon(x, y, poly).d2 < 160 * 160) world.navGrid[gy * world.navSize + gx] = 1;
    }
  }
  return is;
}

/** The chunk keys an island touches (to re-send them to captains who already had them). */
export function islandChunkKeys(is: Island): number[] {
  const out: number[] = [];
  const [x0, y0] = chunkOf(is.x - is.radius, is.y - is.radius);
  const [x1, y1] = chunkOf(is.x + is.radius, is.y + is.radius);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) out.push(chunkKey(cx, cy));
  return out;
}

/** The small settlements' one-line descriptions in Russian (every biome under every flag), for the client's table. */
export function settlementPatterns(): [string, string][] {
  const biome: Record<string, string> = { temperate: 'в умеренном краю', mossy: 'среди мхов и туманов', volcanic: 'у подножия вулканов', ice: 'среди льдов', barren: 'на голых скалах', ruins: 'среди затонувших руин', bone: 'на костяных отмелях', jungle: 'в джунглях', mangrove: 'в мангровых зарослях', atoll: 'на атолле', desert: 'на песчаном берегу' };
  const flag: Record<string, string> = { crown: 'Адмиралтейства Короны', league: 'Золочёной книги', confederacy: 'Конфедерации Красного прилива', harpoon: 'Ордена Гарпуна', brokers: 'Туманных маклеров', choir: 'Хора Глубин', free: 'Вольных гаваней' };
  const out: [string, string][] = [];
  for (const [b, bru] of Object.entries(biome)) for (const [f, fru] of Object.entries(flag)) out.push([`A small ${b} settlement under ${f} colours.`, `Небольшое поселение ${bru} под флагом ${fru}.`]);
  return out;
}
