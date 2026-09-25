// Regional weather state machine. Weather scales wind, limits visibility and punishes full sail in storms.

import type { Rng } from '../../../shared/src/rng.ts';
import type { WeatherKind } from '../../../shared/src/protocol.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';

export interface RegionWeather {
  kind: WeatherKind;
  until: number;
}

export const WEATHER_WIND: Record<WeatherKind, number> = {
  calm: 0.3, breeze: 0.7, wind: 1.0, fog: 0.55, rain: 0.9, storm: 1.3, black_storm: 1.45,
};

export const WEATHER_FOG: Record<WeatherKind, number> = {
  calm: 0.15, breeze: 0.1, wind: 0.05, fog: 0.85, rain: 0.35, storm: 0.45, black_storm: 0.6,
};

function roll(rng: Rng, region: RegionId): WeatherKind {
  const r = REGIONS[region];
  const table: [WeatherKind, number][] = [
    ['calm', region === 'dead_mans_expanse' ? 2.5 : 1],
    ['breeze', 3],
    ['wind', 3],
    ['fog', r.fogBase * 6],
    ['rain', 2],
    ['storm', r.stormChance * 1.4],
  ];
  if (region === 'the_abyss' || region === 'drowned_crown') table.push(['black_storm', region === 'the_abyss' ? 3 : 0.4]);
  return rng.weighted(table);
}

export function initWeather(rng: Rng, now: number): Record<RegionId, RegionWeather> {
  const out = {} as Record<RegionId, RegionWeather>;
  for (const id of REGION_IDS) out[id] = { kind: roll(rng, id), until: now + rng.range(60, 400) };
  return out;
}

/** Returns regions whose weather changed. */
export function stepWeather(state: Record<RegionId, RegionWeather>, rng: Rng, now: number): RegionId[] {
  const changed: RegionId[] = [];
  for (const id of REGION_IDS) {
    const w = state[id];
    if (now < w.until) continue;
    const next = roll(rng, id);
    const long = next === 'storm' || next === 'black_storm' ? rng.range(120, 260) : rng.range(180, 520);
    if (next !== w.kind) changed.push(id);
    state[id] = { kind: next, until: now + long };
  }
  return changed;
}
