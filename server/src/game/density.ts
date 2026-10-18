// The sea's density kept whatever is sunk (owner, 2026-10-18: «если я какой-то корабль нпс победил то сразу в другой
// части зоны должна появится замена … если там условно 100 человек играет в одной зоне. Плотность кораблей всегда должна
// быть одинакова»). docs/31 §10.
//
// Two layers keep the sea's ordinary ships, and a ship beaten — sunk, scuttled by her captor or let go (outcome.ts) —
// is put back at once in the layer she came from, so neither ever runs thin however fast a crowd of captains works it:
//  - the zone's own ships (the director's quota by role, Game.director: QUOTA × the zone's share of the ports, each put
//    out in the waters and at the level of her square): one like her — her role, her level within the square's band —
//    puts out in her own region, at a spot of open water clear of the harbours and out of every captain's sight
//    (WORLD_SIGHT_R). The director counts the living and not the sinking, so the one sinking and the one put out are
//    never both counted, and tops up whatever a failed spot left short on its next pass (two seconds).
//  - the traffic about each captain (traffic.ts: NEAR_WANT within 2.5 km, the wide ring within 5 km): one like her puts
//    out on the near ring of the captain nearest the wreck, beyond every captain's screen (RING_SIGHT_R). The ring counts
//    the ships about her, so the one put out here is one the ring's own top-up does not put out again — no double.
// Cost: one spawn a ship beaten (a grid look for captains at a dozen spots at most), nothing a tick.

import { REGIONS } from '../../../shared/src/world/regions.ts';
import { headingVec } from '../../../shared/src/math.ts';
import { nearHarbour, regionAt } from '../../../shared/src/world/worldgen.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import { NEAR_R, TRAFFIC_R, localTraffic } from './traffic.ts';
import { spawnTraffic } from './npc.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';

type Role = 'merchant' | 'fisher' | 'patrol' | 'pirate' | 'hunter';
const ROLES = new Set<string>(['merchant', 'fisher', 'patrol', 'pirate', 'hunter']);

/** A replacement of the zone's own ships puts out no nearer than this to any captain. */
export const WORLD_SIGHT_R = 3000;
/** A replacement of a captain's traffic: beyond every captain's screen (300–600 m) and her lookout's first hail, inside
 *  the near ring of the captain she is put out for. */
export const RING_SIGHT_R = 1200;
/** Clear of the harbours by this (no ship put out in a harbour's mouth). */
export const HARBOUR_CLEAR = 1500;
/** Spots tried before the director's next pass is left to make it good. */
const TRIES = 14;

/** Replacements put out, by layer (tests, the admin's numbers). */
export const replaced = new WeakMap<Game, { world: number; ring: number; missed: number }>();
function tally(game: Game): { world: number; ring: number; missed: number } {
  let t = replaced.get(game);
  if (!t) replaced.set(game, (t = { world: 0, ring: 0, missed: 0 }));
  return t;
}

/** A ship of the sea's ordinary work: none of a captain's (an escort, a prize, a caravan), none of the great ones, the
 *  named, the guards, the bosses' parts, a quest's or a lesson's quarry, a hunter after a head — those have their own
 *  places and their own clocks. */
export function replaceable(game: Game, ship: ShipEntity): boolean {
  if (ship.isPlayer || !ship.npcRole || !ROLES.has(ship.npcRole)) return false;
  if (ship.ownerId !== null || ship.prize || ship.guardOf || ship.bossOf || ship.bossPart || ship.zoneBoss || ship.named || ship.namedMate) return false;
  if (ship.dutchman || ship.invader || ship.caravanId || ship.caravanOf !== null || ship.fleetId || ship.abyssSpawn || ship.elite || ship.lairGuard) return false;
  if (ship.yardOf || ship.cls.monster || ship.convoyId !== undefined || ship.escortOf !== undefined || ship.ghost) return false;
  const b = game.npcs.get(ship.id);
  if (!b || b.keep || b.practice !== undefined || b.huntFor !== undefined || b.huntAccount !== null || b.fireship !== undefined) return false;
  return true;
}

/** No captain within `r` of the spot (a grid look, not a walk over every captain). */
export function outOfSight(game: Game, x: number, y: number, r: number): boolean {
  let seen = false;
  game.forShipsNear(x, y, r, (o) => {
    if (!seen && o.isPlayer && o.alive && !o.docked && (o.state.x - x) ** 2 + (o.state.y - y) ** 2 < r * r) seen = true;
  });
  return !seen;
}

/** The captain at sea nearest the spot, within the traffic's wide ring. */
function nearestCaptain(game: Game, x: number, y: number): ShipEntity | null {
  let best: ShipEntity | null = null, bd = Infinity;
  game.forShipsNear(x, y, TRAFFIC_R, (o) => {
    if (!o.isPlayer || !o.alive || o.docked) return;
    const d = (o.state.x - x) ** 2 + (o.state.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  return best;
}

/** Her level, kept within the band of the square she is put out in (the law a level above it, as it sails). */
function levelAt(game: Game, role: Role, level: number, x: number, y: number): number {
  const [lo, hi] = sectorAt(game.world, x, y).band;
  return Math.max(1, Math.min(10, Math.max(lo, Math.min(hi + (role === 'patrol' ? 1 : 0), level))));
}

/** One like `victim` — her role, her level — put out at once elsewhere: in her own region out of every captain's sight
 *  (the zone's own ships), or on the near ring of the captain nearest her, beyond every screen (a captain's traffic).
 *  Null when she is none of the sea's ordinary ships, the director is still (tests of other systems), or no spot was
 *  found (the director's next pass, or the ring's, makes it good). */
export function replaceDefeated(game: Game, victim: ShipEntity): ShipEntity | null {
  if (!game.directorOn || !replaceable(game, victim)) return null;
  const role = victim.npcRole as Role;
  const mine = localTraffic(game);
  const ring = mine.has(victim.id);
  const anchor = ring ? nearestCaptain(game, victim.state.x, victim.state.y) : null;
  if (ring && !anchor) return null; // nobody about her any more: the ring has nobody to keep ships for
  const rng = game.rng;
  const [cx, cy] = REGIONS[victim.region]?.center ?? [victim.state.x, victim.state.y];
  for (let k = 0; k < TRIES; k++) {
    let x: number, y: number;
    if (anchor) {
      const v = headingVec(rng.range(0, Math.PI * 2));
      const r = rng.range(RING_SIGHT_R, NEAR_R - 100);
      x = anchor.state.x + v.x * r;
      y = anchor.state.y + v.y * r;
    } else {
      // Anywhere in her region: about its heart, half of the tries, else about where she was, far off.
      const v = headingVec(rng.range(0, Math.PI * 2));
      const far = k % 2 === 0;
      const r = far ? rng.range(0, 11000) : rng.range(WORLD_SIGHT_R + 500, 12000);
      x = (far ? cx : victim.state.x) + v.x * r;
      y = (far ? cy : victim.state.y) + v.y * r;
      if (regionAt(game.world, x, y) !== victim.region) continue;
    }
    if (!game.inZone(x, y) || nearHarbour(game.world, x, y, HARBOUR_CLEAR)) continue;
    if (!outOfSight(game, x, y, anchor ? RING_SIGHT_R : WORLD_SIGHT_R)) continue;
    const past = anchor ? { x: anchor.state.x, y: anchor.state.y } : (() => {
      const h = headingVec(rng.range(0, Math.PI * 2));
      return { x: x + h.x * 2500, y: y + h.y * 2500 };
    })();
    const out = spawnTraffic(game, role, x, y, past);
    if (!out) continue;
    game.setNpcLevel(out, levelAt(game, role, victim.shipLevel, x, y));
    if (ring) {
      mine.add(out.id);
      tally(game).ring++;
    } else tally(game).world++;
    return out;
  }
  tally(game).missed++;
  return null;
}

/** The zone's own ships alive (not sinking), by role — the director's count (Game.director). */
export function livingByRole(game: Game): Record<string, number> {
  const local = localTraffic(game);
  const out: Record<string, number> = {};
  for (const b of game.npcs.values()) {
    if (local.has(b.id)) continue;
    const s = game.ships.get(b.id);
    if (s && (s.sinkingUntil || !s.alive)) continue;
    out[b.role] = (out[b.role] ?? 0) + 1;
  }
  return out;
}
