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
//  - the traffic about each captain (traffic.ts: NEAR_WANT within 2.5 km, the wide ring within 5 km): the captains about
//    the wreck are looked at on the very next second (not their every third), and the nearest one's ring, if it is short
//    now, takes one like her — her role, her level — put out on its near ring beyond her screen (1.1–2.3 km). Only a short
//    ring is topped up, so she is put back once and never on top of the ring's own top-up: a crowd of captains whose rings
//    overlap does not breed ships (the first cut put one out on the ring at once AND let the ring top itself up: +65 % in
//    two minutes of a hundred captains' killing).
// Cost: one spawn a ship beaten (a grid look for captains at a dozen spots at most), nothing a tick.

import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { headingVec } from '../../../shared/src/math.ts';
import { nearHarbour, regionAt } from '../../../shared/src/world/worldgen.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import { TRAFFIC_R, localTraffic, ringAsk } from './traffic.ts';
import { spawnTraffic } from './npc.ts';
import type { Game } from './Game.ts';
import type { ShipEntity } from './ship.ts';

type Role = 'merchant' | 'fisher' | 'patrol' | 'pirate' | 'hunter';
const ROLES = new Set<string>(['merchant', 'fisher', 'patrol', 'pirate', 'hunter']);

/** A replacement of the zone's own ships puts out no nearer than this to any captain. */
export const WORLD_SIGHT_R = 3000;
/** Beyond every captain's screen (300–600 m) and her lookout's first hail: the least a replacement of the zone's ships
 *  stands off a crowd that covers her whole region. */
export const RING_SIGHT_R = 1200;
/** Clear of the harbours by this (no ship put out in a harbour's mouth). */
export const HARBOUR_CLEAR = 1500;
/** Spots tried before she is owed to her region (payOwed: the director's next pass tries again). */
const TRIES = 24;

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

/** How far the nearest captain at sea is from the spot, looked for within `r` only (a grid look, not a walk over every
 *  captain): `r` when none is nearer. */
export function captainClear(game: Game, x: number, y: number, r: number): number {
  let best = r * r;
  game.forShipsNear(x, y, r, (o) => {
    if (!o.isPlayer || !o.alive || o.docked) return;
    const d = (o.state.x - x) ** 2 + (o.state.y - y) ** 2;
    if (d < best) best = d;
  });
  return Math.sqrt(best);
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

/** One like `victim` — her role, her level — put out at once elsewhere in her own region out of every captain's sight
 *  (the zone's own ships; the ship put out), or asked of the rings about her for the next second (a captain's traffic;
 *  null). Null too when she is none of the sea's ordinary ships, the director is still (tests of other systems), or no
 *  spot was found (the director's next pass makes it good). */
export function replaceDefeated(game: Game, victim: ShipEntity): ShipEntity | null {
  if (!game.directorOn || !replaceable(game, victim)) return null;
  const role = victim.npcRole as Role;
  const mine = localTraffic(game);
  const ring = mine.has(victim.id);
  if (ring) {
    // A captain's traffic: the rings about her are looked at on the next second, and the nearest captain's, if short now,
    // takes one like her (traffic.ts) — put back once, never on top of the ring's own top-up.
    const anchor = nearestCaptain(game, victim.state.x, victim.state.y);
    if (!anchor) return null; // nobody about her any more: the ring has nobody to keep ships for
    ringAsk(game, victim.state.x, victim.state.y, anchor.accountId, role, victim.shipLevel);
    tally(game).ring++;
    return null;
  }
  const law = role === 'patrol' && victim.faction !== 'player' ? victim.faction : undefined;
  const out = placeLike(game, role, victim.shipLevel, victim.region, victim.state.x, victim.state.y, law);
  if (out) return out;
  // No spot now (a crowd over the whole of her waters): owed to her region, tried again each director's pass, and
  // counted as hers meanwhile, so the director's own top-up does not put her out somewhere else as well.
  owedOf(game).push({ role, level: victim.shipLevel, region: victim.region, x: victim.state.x, y: victim.state.y, until: game.now + OWED_SEC, law });
  tally(game).missed++;
  return null;
}

/** One of `role` at about `level` put out in `region`, out of every captain's sight (or, with a crowd over the whole
 *  region, at the spot farthest from them all beyond every screen), clear of the harbours, on open water. */
function placeLike(game: Game, role: Role, level: number, region: RegionId, x0: number, y0: number, law?: FactionId): ShipEntity | null {
  const rng = game.rng;
  const [cx, cy] = REGIONS[region]?.center ?? [x0, y0];
  let best: { x: number; y: number; clear: number } | null = null;
  const put = (x: number, y: number): ShipEntity | null => {
    const h = headingVec(rng.range(0, Math.PI * 2));
    const out = spawnTraffic(game, role, x, y, { x: x + h.x * 2500, y: y + h.y * 2500 }, law);
    if (!out) return null;
    game.setNpcLevel(out, levelAt(game, role, level, x, y));
    tally(game).world++;
    return out;
  };
  for (let k = 0; k < TRIES; k++) {
    // Anywhere in her region: about its heart, half of the tries, else about where she was, far off.
    const v = headingVec(rng.range(0, Math.PI * 2));
    const far = k % 2 === 0;
    const r = far ? rng.range(0, 11000) : rng.range(WORLD_SIGHT_R + 500, 12000);
    const x = (far ? cx : x0) + v.x * r;
    const y = (far ? cy : y0) + v.y * r;
    if (regionAt(game.world, x, y) !== region) continue;
    if (!game.inZone(x, y) || nearHarbour(game.world, x, y, HARBOUR_CLEAR)) continue;
    const clear = captainClear(game, x, y, WORLD_SIGHT_R);
    if (clear < WORLD_SIGHT_R) {
      // A crowd over the whole of her waters (a hundred captains in one region): the spot farthest from them all, as
      // long as it is beyond every screen.
      if (clear >= RING_SIGHT_R && (!best || clear > best.clear)) best = { x, y, clear };
      continue;
    }
    const out = put(x, y);
    if (out) return out;
  }
  return best ? put(best.x, best.y) : null;
}

/** A replacement of the zone's ships owed to her region: how long it is kept before the director's own top-up (by role,
 *  anywhere in the zone) takes it over. */
export const OWED_SEC = 60;
interface Owed {
  role: Role;
  level: number;
  region: RegionId;
  x: number;
  y: number;
  until: number;
  law?: FactionId;
}
const owed = new WeakMap<Game, Owed[]>();
function owedOf(game: Game): Owed[] {
  let o = owed.get(game);
  if (!o) owed.set(game, (o = []));
  return o;
}

/** The director's pass (Game.director): the replacements owed, tried again (a few a pass), the lapsed let go. */
export function payOwed(game: Game, max = 8): void {
  const list = owed.get(game);
  if (!list?.length) return;
  let tried = 0;
  for (let i = 0; i < list.length; ) {
    const o = list[i];
    if (game.now > o.until) {
      list.splice(i, 1);
      continue;
    }
    if (tried++ >= max) break;
    if (placeLike(game, o.role, o.level, o.region, o.x, o.y, o.law)) list.splice(i, 1);
    else i++;
  }
}

/** The replacements owed, by role: the director counts them as the zone's ships already. */
export function owedByRole(game: Game): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of owed.get(game) ?? []) out[o.role] = (out[o.role] ?? 0) + 1;
  return out;
}

/** The roles the director keeps by region (Game.director): its quota's, spread as the zone's waters held them at boot. */
const KEPT = new Set<string>(['merchant', 'pirate', 'fisher']);
const regionTargets = new WeakMap<Game, Map<string, number>>();

/** The zone's own ships of the director's quota alive now (and owed), by `role|region`. */
export function regionCounts(game: Game): Map<string, number> {
  const local = localTraffic(game);
  const out = new Map<string, number>();
  for (const b of game.npcs.values()) {
    if (!KEPT.has(b.role) || local.has(b.id)) continue;
    const s = game.ships.get(b.id);
    if (!s || s.sinkingUntil) continue;
    const k = `${b.role}|${s.region}`;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  for (const o of owed.get(game) ?? []) {
    const k = `${o.role}|${o.region}`;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

/** The region whose share of `role` is furthest under its target (the zone's waters as they were first filled: by area,
 *  as the ports and the rovers' grounds share them out, and by level, as each square puts them out), or none. A top-up
 *  goes there — not wherever a harbour happened to be picked — so a hundred captains farming one region do not slowly
 *  empty it into the rest of the zone. `counts` is updated as if it came. */
export function underRegion(game: Game, role: string, counts: Map<string, number>): RegionId | undefined {
  let t = regionTargets.get(game);
  if (!t) regionTargets.set(game, (t = new Map(counts)));
  let best: string | undefined, gap = 0;
  for (const [k, want] of t) {
    if (!k.startsWith(`${role}|`)) continue;
    const g = want - (counts.get(k) ?? 0);
    if (g > gap) {
      gap = g;
      best = k;
    }
  }
  if (!best) return undefined;
  counts.set(best, (counts.get(best) ?? 0) + 1);
  return best.slice(role.length + 1) as RegionId;
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
