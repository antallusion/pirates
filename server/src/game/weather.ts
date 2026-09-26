// Regional weather state machine. Weather scales wind, limits visibility and punishes full sail in storms.

import type { Rng } from '../../../shared/src/rng.ts';
import type { WeatherKind } from '../../../shared/src/protocol.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';

export interface RegionWeather {
  kind: WeatherKind;
  until: number;
  /** What comes next (read by Weather Eye). */
  next?: WeatherKind;
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
  ];
  // Storms arrive as travelling fronts (see Front below); the regional baseline only varies wind, fog and rain.
  return rng.weighted(table);
}

export function initWeather(rng: Rng, now: number): Record<RegionId, RegionWeather> {
  const out = {} as Record<RegionId, RegionWeather>;
  for (const id of REGION_IDS) out[id] = { kind: roll(rng, id), until: now + rng.range(60, 400), next: roll(rng, id) };
  return out;
}

/** Returns regions whose weather changed. */
export function stepWeather(state: Record<RegionId, RegionWeather>, rng: Rng, now: number): RegionId[] {
  const changed: RegionId[] = [];
  for (const id of REGION_IDS) {
    const w = state[id];
    if (now < w.until) continue;
    const next = w.next ?? roll(rng, id);
    const long = next === 'storm' || next === 'black_storm' ? rng.range(120, 260) : rng.range(180, 520);
    if (next !== w.kind) changed.push(id);
    state[id] = { kind: next, until: now + long, next: roll(rng, id) };
  }
  return changed;
}

// ------------------------------------------------------------------ travelling fronts

export type FrontKind = 'storm' | 'black_storm' | 'fog' | 'rain';

export interface Front {
  id: number;
  kind: FrontKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  until: number;
}

const SEVERITY: Record<WeatherKind, number> = { calm: 0, breeze: 0, wind: 0, fog: 1, rain: 2, storm: 3, black_storm: 4 };
const MAX_FRONTS = 12;
let frontSeq = 1;

/** Spawn fronts in stormy regions; they drift with the prevailing wind and die out. */
export function stepFronts(fronts: Front[], rng: Rng, now: number, dt: number, windDirAt: (x: number, y: number) => number, stormMul = 1): Front[] {
  const alive: Front[] = [];
  for (const f of fronts) {
    if (f.until <= now) continue;
    // Fronts steer slowly with the wind field where they are.
    const dir = windDirAt(f.x, f.y);
    const speed = Math.hypot(f.vx, f.vy);
    f.vx += (Math.sin(dir) * speed - f.vx) * 0.02 * dt;
    f.vy += (-Math.cos(dir) * speed - f.vy) * 0.02 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.x < -5000 || f.y < -5000 || f.x > 101000 || f.y > 101000) continue;
    alive.push(f);
  }
  if (alive.length < MAX_FRONTS) {
    for (const id of REGION_IDS) {
      const r = REGIONS[id];
      const kind: FrontKind | null =
        rng.chance(0.002 * r.stormChance * stormMul * dt) ? (id === 'the_abyss' || (id === 'drowned_crown' && rng.chance(0.3)) ? 'black_storm' : 'storm')
        : rng.chance(0.002 * r.fogBase * dt) ? 'fog'
        : rng.chance(0.0012 * dt) ? 'rain'
        : null;
      if (!kind || alive.length >= MAX_FRONTS) continue;
      const x = r.center[0] + rng.range(-14000, 14000), y = r.center[1] + rng.range(-14000, 14000);
      const dir = windDirAt(x, y);
      const speed = kind === 'fog' ? rng.range(1.5, 3) : rng.range(3.5, 7);
      alive.push({
        id: frontSeq++, kind, x, y, vx: Math.sin(dir) * speed, vy: -Math.cos(dir) * speed,
        radius: kind === 'black_storm' ? rng.range(5000, 8000) : kind === 'storm' ? rng.range(4500, 9500) : rng.range(5000, 11000),
        until: now + rng.range(1200, 2600),
      });
    }
  }
  return alive;
}

/** Local weather: the most severe front overhead, else the regional baseline. */
export function weatherAtPoint(fronts: Front[], base: WeatherKind, x: number, y: number): WeatherKind {
  let w = base;
  for (const f of fronts) {
    if (Math.abs(f.x - x) > f.radius || Math.abs(f.y - y) > f.radius) continue;
    if (Math.hypot(f.x - x, f.y - y) > f.radius) continue;
    if (SEVERITY[f.kind] > SEVERITY[w]) w = f.kind;
  }
  return w;
}

/** Waves: strong wind throws the aim off, big hulls ride it out. Multiplies broadside spread. */
export function seaStateSpread(windStrength: number, tier: number): number {
  return 1 + (Math.max(0, windStrength - 0.7) * 1.2) / (0.55 + tier * 0.15);
}
