// Zones (docs/04 §4.4): the world is split among processes by whole regions. A ship belongs to the zone of the
// region under her keel; within the border band (the interest radius) she is also shown, read-only, to the
// zone across the line.

import { INTEREST_RADIUS } from '../constants.ts';
import type { RegionId } from './regions.ts';
import { REGION_IDS } from './regions.ts';
import type { World } from './worldgen.ts';
import { regionAt } from './worldgen.ts';

export interface ZoneDef {
  id: string;
  regions: RegionId[];
}

export type ZoneLayout = ZoneDef[];

/** The band along a border in which ships are mirrored into the neighbour. */
export const BORDER_BAND = INTEREST_RADIUS;

/** "west=black_coast,gravewater;east=whispering,…" → a layout. Every region must belong to exactly one zone. */
export function parseLayout(spec: string): ZoneLayout {
  const out: ZoneLayout = [];
  const seen = new Set<string>();
  for (const part of spec.split(';').map((x) => x.trim()).filter(Boolean)) {
    const m = /^([\w-]+)=(.+)$/.exec(part);
    if (!m) throw new Error(`bad zone "${part}" (want id=region,region)`);
    const regions = m[2].split(',').map((r) => r.trim()) as RegionId[];
    for (const r of regions) {
      if (!REGION_IDS.includes(r)) throw new Error(`unknown region "${r}"`);
      if (seen.has(r)) throw new Error(`region "${r}" is in two zones`);
      seen.add(r);
    }
    out.push({ id: m[1], regions });
  }
  const missing = REGION_IDS.filter((r) => !seen.has(r));
  if (missing.length) throw new Error(`regions in no zone: ${missing.join(', ')}`);
  return out;
}

export function zoneOfRegion(layout: ZoneLayout, region: RegionId): string {
  return layout.find((z) => z.regions.includes(region))?.id ?? layout[0].id;
}

export function zoneAt(layout: ZoneLayout, world: World, x: number, y: number): string {
  return zoneOfRegion(layout, regionAt(world, x, y));
}

/** Other zones within the border band of a point (sampled around it). */
export function zonesNear(layout: ZoneLayout, world: World, x: number, y: number, self: string): string[] {
  const out = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    for (const r of [BORDER_BAND * 0.5, BORDER_BAND]) {
      const z = zoneAt(layout, world, x + Math.sin(a) * r, y - Math.cos(a) * r);
      if (z !== self) out.add(z);
    }
  }
  return [...out];
}
