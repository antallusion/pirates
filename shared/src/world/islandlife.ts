// Living islands (docs/11 P3): who and what lives on an island — fishing hamlets, smugglers' and pirates' camps,
// garrisoned forts, seal colonies, crab and turtle beaches, gulls over the cliffs. Pure and deterministic from the
// island itself, so the server (landing parties) and the client (what is drawn) always agree without a byte on
// the wire.

import { Rng } from '../rng.ts';
import { REGIONS } from './regions.ts';
import type { IslandBiome, RegionId } from './regions.ts';

/** What can live on an island. The first four are people; the rest are the sea's creatures. */
export type LifeKind = 'fishers' | 'smugglers' | 'pirate_camp' | 'garrison' | 'seals' | 'crabs' | 'turtles' | 'gulls';
export const LIFE_KINDS: LifeKind[] = ['fishers', 'smugglers', 'pirate_camp', 'garrison', 'seals', 'crabs', 'turtles', 'gulls'];
/** The kinds a landing party can row ashore to (gulls are only to be looked at). */
export type LandSite = Exclude<LifeKind, 'gulls'>;
export const LAND_SITES: LandSite[] = ['fishers', 'smugglers', 'pirate_camp', 'garrison', 'seals', 'crabs', 'turtles'];
export const PEOPLE: LifeKind[] = ['fishers', 'smugglers', 'pirate_camp', 'garrison'];

export interface LifeSite {
  kind: LifeKind;
  /** Where it stands (world metres): a coast vertex drawn a little inland, or the island's middle for gulls. */
  x: number;
  y: number;
  /** How many: huts, tents, seals, crabs, turtles or gulls. */
  n: number;
  /** The coast vertex it stands by (its seaward direction for boats and beasts). */
  v: number;
}

export interface LifeIsland {
  id: number;
  region: RegionId;
  biome: IslandBiome;
  x: number;
  y: number;
  /** Bounding radius in metres (rounded, as the client has it). */
  r: number;
  poly: number[];
  features: string[];
  portId?: string;
}

const cache = new Map<string, LifeSite[]>();

/** Everything that lives on an island, the same for every caller. */
export function islandLife(is: LifeIsland): LifeSite[] {
  const key = `${is.id}:${Math.round(is.x)}:${Math.round(is.y)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = rollLife(is);
  cache.set(key, out);
  if (cache.size > 4000) cache.delete(cache.keys().next().value!);
  return out;
}

/** The roll itself, without the cache (tests compare the server's and the client's view of an island). */
export function rollLife(is: LifeIsland): LifeSite[] {
  const rng = new Rng((is.id * 2654435761 + Math.round(is.x) * 31 + Math.round(is.y)) >>> 0);
  const r = Math.round(is.r / 1.25); // the island's own size, not its bounding circle
  const reg = REGIONS[is.region];
  const b = is.biome;
  const out: LifeSite[] = [];
  const n = is.poly.length / 2;
  const used = new Set<number>();
  /** A coast vertex not yet taken (and not by the port town), drawn `inset` of the way toward the middle. */
  const spot = (inset: number): { x: number; y: number; v: number } | null => {
    for (let k = 0; k < 10; k++) {
      const v = rng.int(0, n - 1);
      if ([...used].some((u) => Math.min(Math.abs(u - v), n - Math.abs(u - v)) < Math.max(2, n / 8))) continue;
      used.add(v);
      const px = is.poly[v * 2], py = is.poly[v * 2 + 1];
      return { x: px + (is.x - px) * inset, y: py + (is.y - py) * inset, v };
    }
    return null;
  };
  const add = (kind: LifeKind, inset: number, count: number) => {
    const p = spot(inset);
    if (p) out.push({ kind, x: p.x, y: p.y, n: count, v: p.v });
  };
  // People. A port's island is its town's; the Abyss has none.
  const people = !is.portId && is.region !== 'the_abyss' && r > 140;
  const barrenHome = b === 'bone' || b === 'crystal' || b === 'saltflat';
  let settled = 0;
  const cap = r > 600 ? 2 : 1;
  if (people && reg.safety !== 'lawless' && !barrenHome && rng.chance(0.2) && settled < cap) {
    add('fishers', 0.12, rng.int(2, 4));
    settled++;
  }
  if (people && reg.safety !== 'safe' && rng.chance(b === 'mangrove' || b === 'mossy' ? 0.18 : 0.08) && settled < cap) {
    add('smugglers', 0.14, rng.int(1, 3));
    settled++;
  }
  if (people && reg.safety !== 'safe' && rng.chance(reg.safety === 'lawless' ? 0.14 : 0.05) && settled < cap) {
    add('pirate_camp', 0.14, rng.int(2, 4));
    settled++;
  }
  if (people && reg.safety !== 'lawless' && r > 300 && !is.features.includes('fort') && rng.chance(0.06) && settled < cap) {
    add('garrison', 0.2, 1);
    settled++;
  }
  // Beasts on the shore, gulls over it.
  if ((b === 'ice' || b === 'barren' || b === 'blacksand' || b === 'saltflat') && rng.chance(0.35)) add('seals', -0.02, rng.int(2, 5));
  if ((b === 'atoll' || b === 'jungle' || b === 'mangrove' || b === 'temperate') && rng.chance(0.3)) add('crabs', -0.01, rng.int(3, 6));
  if ((b === 'atoll' || b === 'jungle') && rng.chance(0.25)) add('turtles', -0.02, rng.int(1, 3));
  if (is.region !== 'the_abyss' && b !== 'fungal' && rng.chance(0.4)) out.push({ kind: 'gulls', x: is.x, y: is.y, n: rng.int(5, 9), v: 0 });
  return out;
}
