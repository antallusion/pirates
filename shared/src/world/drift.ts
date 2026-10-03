// The turtle islands (docs/18 #31): an old sea turtle so great that sand, palms and gulls ride on her shell drifts slowly
// round a loop of open water, half an hour up, then a quarter of an hour under (her island gone with her), and up again.
// A landing party may comb her back once a rise. Her loop is chosen from the world (its own generator, after
// everything else) where the water stays open all the way round: off the land, the reefs, the harbours and the
// maelstroms. Pure functions of the world and the clock, so the server, the client (which draws her where she is
// between the server's words) and a test agree.

import { TAU } from '../math.ts';
import { Rng } from '../rng.ts';
import { DEEP_WATER, WHIRLPOOLS, beforePorts, depthAt, isLand } from './worldgen.ts';
import type { World } from './worldgen.ts';
import type { RegionId } from './regions.ts';
import { regionAt } from './worldgen.ts';

export interface TurtleDef {
  id: number;
  name: [string, string];
  region: RegionId;
  /** Her loop: an ellipse about (cx, cy), half-axes rx and ry, turned by rot. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
  /** World seconds for a lap, and where on it she is at time 0 (a share). */
  lap: number;
  ph: number;
  /** Her island's reach (metres). */
  r: number;
  /** Where in her rise-and-dive she is at time 0 (a share of the cycle). */
  cph: number;
}

/** Up half an hour, under a quarter of an hour (world seconds). */
export const TURTLE_UP = 1800;
export const TURTLE_DOWN = 900;
export const TURTLE_CYCLE = TURTLE_UP + TURTLE_DOWN;
export const TURTLE_R = 160;
/** The turtles' names, English and Russian (the client's table), by id. */
export const TURTLE_NAMES: [string, string][] = [['Old Shellback', 'Старый Панцирь'], ['The Wandering Isle', 'Бродячий Остров']];
const WANT: { region: RegionId; name: [string, string] }[] = [
  { region: 'gravewater', name: TURTLE_NAMES[0] },
  { region: 'dead_mans_expanse', name: TURTLE_NAMES[1] },
];

const cache = new WeakMap<object, TurtleDef[]>();

/** Where she is at world time t, and which way she swims. */
export function turtlePos(d: TurtleDef, t: number): { x: number; y: number; heading: number } {
  const a = TAU * (t / d.lap + d.ph);
  const ex = Math.cos(a) * d.rx, ey = Math.sin(a) * d.ry;
  const vx = -Math.sin(a) * d.rx, vy = Math.cos(a) * d.ry;
  const c = Math.cos(d.rot), s = Math.sin(d.rot);
  const x = d.cx + ex * c - ey * s, y = d.cy + ex * s + ey * c;
  const wx = vx * c - vy * s, wy = vx * s + vy * c;
  return { x, y, heading: Math.atan2(wx, -wy) };
}

/** Whether she is up (her island above the sea) at t. */
export function turtleUp(d: TurtleDef, t: number): boolean {
  return (((t / TURTLE_CYCLE + d.cph) % 1) + 1) % 1 < TURTLE_UP / TURTLE_CYCLE;
}

/** When she next dives or rises (world seconds). */
export function turtleTurn(d: TurtleDef, t: number): number {
  const f = (((t / TURTLE_CYCLE + d.cph) % 1) + 1) % 1;
  const up = TURTLE_UP / TURTLE_CYCLE;
  return t + (f < up ? up - f : 1 - f) * TURTLE_CYCLE;
}

/** Which rise of hers this is (a landing party combs her back once a rise). */
export function turtleRise(d: TurtleDef, t: number): number {
  return Math.floor(t / TURTLE_CYCLE + d.cph);
}

/** Open water for her shell at a point: no land, no shoal, no maelstrom about. */
function open(world: World, x: number, y: number, r: number): boolean {
  if (isLand(world, x, y) || depthAt(world, x, y) < DEEP_WATER) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const px = x + Math.sin(a) * r, py = y - Math.cos(a) * r;
    if (isLand(world, px, py) || depthAt(world, px, py) < DEEP_WATER) return false;
  }
  for (const q of world.reefs) if (Math.abs(q.x - x) < q.radius + r && Math.hypot(q.x - x, q.y - y) < q.radius + r) return false;
  return !WHIRLPOOLS.some((w) => Math.hypot(w.x - x, w.y - y) < w.radius * 2.2 + r);
}

/** The world's turtle islands (on the world as she stood before her twenty new towns, whose islands keep off their
 *  loops: shared/src/world/newports.ts). `keep` false: worked out and not kept. */
export function turtles(world: World, keep = true): TurtleDef[] {
  world = beforePorts(world);
  const hit = cache.get(world.islands);
  if (hit) return hit;
  const rng = new Rng((world.seed * 307 + 0x7e47) >>> 0);
  const out: TurtleDef[] = [];
  const ports = world.ports;
  for (const w of WANT) {
    for (let tries = 0; tries < 4000; tries++) {
      const cx = rng.range(8000, 88000), cy = rng.range(8000, 88000);
      const rx = rng.range(2000, 3200), ry = rng.range(1200, 2000), rot = rng.range(0, TAU);
      if (regionAt(world, cx, cy) !== w.region) continue;
      const d: TurtleDef = { id: out.length, name: w.name, region: w.region, cx: Math.round(cx), cy: Math.round(cy), rx: Math.round(rx), ry: Math.round(ry), rot: Math.round(rot * 1000) / 1000, lap: 4 * 3600, ph: rng.float(), r: TURTLE_R, cph: rng.float() };
      let clear = true;
      for (let k = 0; k < 40 && clear; k++) {
        const p = turtlePos(d, (k / 40 - d.ph) * d.lap);
        if (ports.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 3000) || !open(world, p.x, p.y, TURTLE_R + 220)) clear = false;
      }
      if (!clear) continue;
      out.push(d);
      break;
    }
  }
  if (keep) cache.set(world.islands, out);
  return out;
}
