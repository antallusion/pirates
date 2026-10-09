// The sea's navigation after the island collision (2026-10-09): reproducible measures of a chase past what a keel
// strikes and of the helmsman's runs to a mark. Deterministic: the scenes come from the world's own lists in a fixed
// order, the target is steered by a script, no dice of their own.
//
//   chase — «Атаковать» to board (a captain's helmsman, pursuit.ts) or a sea pirate's run (npc.ts engage) on a pirate
//           that flees past a sea stack or a small island, across a reef (she is a shallow-keeled sloop), past a hulk,
//           a skerry, a town's piers. Counted: stuck (under 1 kn for over 4 s while she is over 200 m off), blows
//           («Удар о …»), the hull lost on reefs and sandbars, the time to the grapples (her within boarding reach).
//   sail  — the helmsman's run to a mark (autosail.ts): to a town's anchorage, onto its piers, onto a hulk or a skerry,
//           across an island to its far side. Counted: arrived, blocked (stuck, «foul water», the clock out), blows.

import { CHUNK_SIZE, WORLD_SIZE } from '../../shared/src/constants.ts';
import { buildAdv } from '../../shared/src/data/advmap.ts';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { angleDiff, headingOf } from '../../shared/src/math.ts';
import { coastOf, hullClearance } from '../../shared/src/sim/hull.ts';
import type { Blocker } from '../../shared/src/sim/hull.ts';
import { blockersNear, clearAt, hulkBlockers, markBlockers, portLayout, quayBlockers, skerryBlockers } from '../../shared/src/world/solids.ts';
import { tidalIsles } from '../../shared/src/world/tidal.ts';
import { depthAt, isLand, regionAt } from '../../shared/src/world/worldgen.ts';
import type { Island, World } from '../../shared/src/world/worldgen.ts';
import { isleType } from '../../shared/src/world/archipelago.ts';
import { boardingRangeBetween } from '../../server/src/game/boarding.ts';
import type { Game } from '../../server/src/game/Game.ts';
import { autosailOf } from '../../server/src/game/autosail.ts';
import { engage, helmTo, newBrain } from '../../server/src/game/npc.ts';
import type { PlayerSession } from '../../server/src/game/player.ts';
import { pursuitHold, pursuitOf, startPursuit, stopPursuit } from '../../server/src/game/pursuit.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import { touches } from '../../server/src/game/strike.ts';
import { join, onHull } from '../../tests/helpers.ts';
import type { FakeConn } from '../../tests/helpers.ts';

export type SceneKind = 'isle' | 'behind' | 'shore' | 'reef' | 'wreck' | 'skerry' | 'hulks' | 'pier' | 'dense';

export interface ChaseScene {
  kind: SceneKind;
  /** What she passes (an island's, a reef's, a mark's id; a port's id). */
  of: string;
  /** The fleeing pirate's start and the route she steers (her own helm keeps her off what she passes); one point: she
   *  runs straight away from the pursuer from there, wherever that takes her. */
  route: [number, number][];
  /** The pursuer's start and head. */
  me: { x: number; y: number; h: number };
  /** The fleeing pirate's hull (a reef: a shallow-keeled sloop that skates over it). */
  tcls: ShipClassId;
}

const W = 1600; // (the Maelstrom Wall's margin and more)
const inSea = (x: number, y: number) => x > W && y > W && x < WORLD_SIZE - W && y < WORLD_SIZE - W;

/** Open, deep water about a point, clear of everything a keel strikes by `r` and of the banks the tide bares (and out of
 *  the Abyss, whose wall throws back a captain without leave). */
export function openAt(world: World, x: number, y: number, r = 70, deep = 9): boolean {
  if (!inSea(x, y) || isLand(world, x, y) || depthAt(world, x, y) < deep || regionAt(world, x, y) === 'the_abyss') return false;
  if (!clearAt(world, x, y, r)) return false;
  for (const b of tidalIsles(world)) if (Math.hypot(b.x - x, b.y - y) < b.r + 500) return false;
  return true;
}

/** A straight leg of open water every 40 m (for the target's route and the pursuer's start: what she passes is the
 *  only thing in the way). `skip` the thing itself. */
function legClear(world: World, x0: number, y0: number, x1: number, y1: number, r: number, skip: (x: number, y: number) => boolean): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 40));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (skip(x, y)) continue;
    if (!openAt(world, x, y, r, 6)) return false;
  }
  return true;
}

/** The scene about a thing at (cx, cy) reaching `e` metres: the target just beyond it from the pursuer, fleeing away
 *  from her (`bend` off the line between them), so the pursuer's line to her runs across it for the first of the chase
 *  (a shallow keel skates across a reef: there she starts on it). Tries eight bearings. */
function sceneAbout(world: World, kind: SceneKind, of: string, cx: number, cy: number, e: number, tcls: ShipClassId, k: number, onIt = false, near = 480): ChaseScene | null {
  for (let t = 0; t < 8; t++) {
    const a = ((k * 2.399 + t * 0.785) % (Math.PI * 2));
    const ux = Math.sin(a), uy = -Math.cos(a);
    const bend = ((k % 3) - 1) * 0.45;
    const vx = Math.sin(a + bend), vy = -Math.cos(a + bend);
    const s0 = onIt ? -e * 0.5 : e + 150;
    const route: [number, number][] = [[cx + ux * s0, cy + uy * s0]];
    for (const s of [400, 1100, 1900, 2800]) route.push([route[0][0] + vx * s, route[0][1] + vy * s]);
    const mx = cx - ux * (e + near), my = cy - uy * (e + near);
    const skip = (x: number, y: number) => onIt && Math.hypot(x - cx, y - cy) < e + 80;
    if (!openAt(world, mx, my, 80) || (!onIt && !openAt(world, route[0][0], route[0][1], 50, 6))) continue;
    let ok = true;
    for (let i = 1; i < route.length && ok; i++) ok = legClear(world, route[i - 1][0], route[i - 1][1], route[i][0], route[i][1], 30, skip);
    if (!ok) continue;
    return { kind, of, route, me: { x: mx, y: my, h: headingOf(cx - mx, cy - my) }, tcls };
  }
  return null;
}

/** Spread picks: every `stride`-th of a list in a fixed order, as many as asked. */
function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  const out: T[] = [];
  const stride = list.length / n;
  for (let i = 0; i < n; i++) out.push(list[Math.floor(i * stride)]);
  return out;
}

const rounded = (is: Island) => ({ id: is.id, x: Math.round(is.x), y: Math.round(is.y), r: Math.round(is.radius), poly: is.poly.map((v) => Math.round(v)) });

/** `per` scenes of each of the nine kinds, in a fixed order (the dense sea's make up what the others could not find). */
export function chaseScenes(world: World, per = 7): ChaseScene[] {
  const out: ChaseScene[] = [];
  const take = <T>(kind: SceneKind, pool: T[], make: (x: T, k: number) => ChaseScene | null, want = per) => {
    let got = 0;
    for (const [k, x] of spread(pool, want * 4).entries()) {
      if (got >= want) break;
      const s = make(x, k);
      if (s) {
        out.push(s);
        got++;
      }
    }
  };
  const isles = world.islands.filter((i) => !i.slot && !i.hidden && !i.raft && !i.portId && i.poly.length > 0 && i.radius >= 70 && i.radius <= 320);
  take('isle', isles, (is, k) => sceneAbout(world, 'isle', `isle ${is.id}`, is.x, is.y, is.radius, 'brigantine', k));
  // Behind a great island: she on its far side, running on away from it, the pursuer on the near side — the way to her
  // is round the island.
  const mids = world.islands.filter((i) => !i.slot && !i.hidden && !i.raft && !i.portId && i.poly.length > 0 && i.radius >= 400 && i.radius <= 650);
  take('behind', mids, (is, k) => sceneAbout(world, 'behind', `isle ${is.id}`, is.x, is.y, is.radius, 'brigantine', k, false, 260));
  // Along a great island's shore: she runs close in along the coast as drawn (70 m off it), round its bends, the
  // pursuer astern and farther out — to board her she must come in to the coast.
  const greats = world.islands.filter((i) => !i.slot && !i.hidden && !i.raft && i.poly.length > 0 && i.radius >= 600 && i.radius <= 2500);
  take('shore', greats, (is, k) => {
    const c = coastOf(is.poly);
    for (let t = 0; t < 16; t++) {
      const i0 = Math.floor((((k * 0.618 + t * 0.0625) % 1) * c.n));
      const dir = k % 2 ? 1 : -1;
      const at = (i: number, off: number): [number, number] => {
        const j = (((i % c.n) + c.n) % c.n);
        return [c.pts[j * 2] + c.nrm[j * 2] * off, c.pts[j * 2 + 1] + c.nrm[j * 2 + 1] * off];
      };
      // Every 150 m along the outline for 1.9 km.
      const route: [number, number][] = [];
      let i = i0, run = 0, last = at(i0, 70);
      route.push(last);
      while (run < 1900 && route.length < 40) {
        let step = 0, j = i;
        while (step < 150 && Math.abs(j - i0) < c.n) {
          const a = at(j, 0), b = at(j + dir, 0);
          step += Math.hypot(b[0] - a[0], b[1] - a[1]);
          j += dir;
        }
        i = j;
        const p2 = at(i, 70);
        run += Math.hypot(p2[0] - last[0], p2[1] - last[1]);
        route.push(p2);
        last = p2;
      }
      // The pursuer 600 m astern along the coast and 260 m out.
      let back = 0, b0 = i0;
      while (back < 600) {
        const a = at(b0, 0), b = at(b0 - dir, 0);
        back += Math.hypot(b[0] - a[0], b[1] - a[1]);
        b0 -= dir;
      }
      const [mx, my] = at(b0, 260);
      if (!openAt(world, mx, my, 80) || !route.every(([x, y]) => openAt(world, x, y, 25, 2.5))) continue;
      return { kind: 'shore', of: `isle ${is.id}`, route, me: { x: mx, y: my, h: headingOf(route[0][0] - mx, route[0][1] - my) }, tcls: 'brigantine' };
    }
    return null;
  });
  const reefs = world.reefs.filter((r) => r.radius >= 80 && r.depth <= 2.8 && r.region !== 'the_abyss');
  take('reef', reefs, (rf, k) => sceneAbout(world, 'reef', `reef ${rf.id}`, rf.x, rf.y, rf.radius, 'sloop', k, true));
  const wrecks = world.marks.filter((m) => m.kind === 'wreck' && m.r >= 60);
  take('wreck', wrecks, (m, k) => (markBlockers(m).length ? sceneAbout(world, 'wreck', `wreck ${m.id}`, m.x, m.y, m.r * 0.6, 'brigantine', k) : null));
  const objs = buildAdv(world).objs;
  take('skerry', objs, (o, k) => (skerryBlockers(o).length ? sceneAbout(world, 'skerry', `skerry ${o.x | 0},${o.y | 0}`, o.x, o.y, 34, 'brigantine', k) : null));
  const graves = world.islands.filter((i) => !i.slot && !i.hidden && !i.raft && !i.minor && !i.portId && i.poly.length > 0 && isleType(i) === 'graveyard' && i.radius <= 260);
  take('hulks', graves, (is, k) => (hulkBlockers(rounded(is)).length ? sceneAbout(world, 'hulks', `graveyard ${is.id}`, is.x, is.y, is.radius + 40, 'brigantine', k) : null));
  const ports = world.ports.filter((p) => !p.raft && world.islands[p.islandId]);
  take('pier', ports, (p, k) => {
    const is = world.islands[p.islandId];
    if (!quayBlockers(p, rounded(is)).length) return null;
    // The painting's foot as a whole (its quays, whatever their piers: the same scene for the one box of old):
    const lay0 = portLayout(p, rounded(is));
    const q = { x: lay0.x - Math.sin(lay0.ang) * lay0.size * 0.355, y: lay0.y + Math.cos(lay0.ang) * lay0.size * 0.355, hw: lay0.size * 0.32, hh: lay0.size * 0.115 };
    // The pier between them: the target beyond it along the shore, fleeing on along it (or out to sea), the pursuer
    // on its other side, both off the shore in the pier's own depth — her line to the target across the pier.
    const lay = portLayout(p, rounded(is));
    const sx = -Math.sin(lay.ang), sy = Math.cos(lay.ang); // (local +y, to the sea)
    const ax = Math.cos(lay.ang), ay = Math.sin(lay.ang); // (local +x, along the shore)
    for (const side of [1, -1]) for (const out of [0.4, 0.9, 1.4]) for (const bend of [0, 0.5, 1]) {
      const o = q.hh * out;
      const t0x = q.x + ax * side * (q.hw + 110) + sx * o, t0y = q.y + ay * side * (q.hw + 110) + sy * o;
      const vx = ax * side * Math.cos(bend) + sx * Math.sin(bend), vy = ay * side * Math.cos(bend) + sy * Math.sin(bend);
      const route: [number, number][] = [[t0x, t0y]];
      for (const s of [400, 1100, 1900]) route.push([t0x + vx * s, t0y + vy * s]);
      const mx = q.x - ax * side * (q.hw + 330) + sx * o, my = q.y - ay * side * (q.hw + 330) + sy * o;
      if (!openAt(world, mx, my, 45, 5) || !openAt(world, t0x, t0y, 35, 4)) continue;
      let ok = true;
      for (let i = 1; i < route.length && ok; i++) ok = legClear(world, route[i - 1][0], route[i - 1][1], route[i][0], route[i][1], 25, () => false);
      if (!ok) continue;
      void k;
      return { kind: 'pier', of: `port ${p.id}`, route, me: { x: mx, y: my, h: headingOf(t0x - mx, t0y - my) }, tcls: 'brigantine' };
    }
    return null;
  });
  // In the dense sea (reefs, stacks and hulks thick about her): she runs straight away from the pursuer, her own helm
  // taking her round what is in the way; the pursuer 650 m off.
  const thick = world.reefs.filter((r) => r.region !== 'the_abyss' && r.radius >= 60);
  take('dense', thick, (rf, k) => {
    for (let t = 0; t < 8; t++) {
      const a = ((k * 2.399 + t * 0.785) % (Math.PI * 2));
      const ux = Math.sin(a), uy = -Math.cos(a);
      const tx = rf.x + ux * (rf.radius + 160), ty = rf.y + uy * (rf.radius + 160);
      const mx = tx + ux * 650, my = ty + uy * 650;
      if (!openAt(world, tx, ty, 40, 6) || !openAt(world, mx, my, 80)) continue;
      // Thick: four things or more within 900 m of her (reefs, stacks, the solid things).
      let n = 0;
      for (const r2 of world.reefs) if (Math.hypot(r2.x - tx, r2.y - ty) < 900 + r2.radius) n++;
      n += blockersNear(world, tx, ty, 900, []).length;
      if (n < 4) continue;
      return { kind: 'dense', of: `reef ${rf.id}`, route: [[tx, ty]], me: { x: mx, y: my, h: headingOf(tx - mx, ty - my) }, tcls: 'brigantine' };
    }
    return null;
  }, per * 9 - out.length);
  return out;
}

// ------------------------------------------------------------------ a chase

export interface ChaseResult {
  kind: SceneKind;
  of: string;
  /** Seconds to the grapples (her within boarding reach); −1: never within the clock. */
  grapple: number;
  /** Under 1 kn for over 4 s while the mark was over 200 m off (once a run), and the seconds of it all. */
  stuck: boolean;
  stuckSec: number;
  /** Blows (strike.ts: «Удар о …»), touches (ticks her hull lay on something), reef hull lost (share of her whole). */
  blows: number;
  touches: number;
  reef: number;
  /** How it ended: grapple, clock, or the pursuit's own stop. */
  end: string;
}

let names = 0;

/** Each scene's own steady wind (a direction from its name, a working strength): the same for the scene whatever ran
 *  before it, so a run is measured against the same sea before and after a change (the sea's wind veers with the
 *  clock, and a run that ends sooner hands the next one another wind). Restored by the returned function. */
export function sceneWind(game: Game, of: string): () => void {
  let h = 7;
  for (let i = 0; i < of.length; i++) h = (h * 31 + of.charCodeAt(i)) >>> 0;
  const wind = { dir: ((h % 3600) / 3600) * Math.PI * 2, strength: 0.75 };
  const was = game.windFor;
  game.windFor = () => wind;
  return () => {
    game.windFor = was;
  };
}

/** Clears the sea about a scene of the sea's own ships (they would join in) and steadies the weather. */
function quietAround(game: Game, x: number, y: number): void {
  for (const o of [...game.ships.values()]) if (!o.isPlayer && Math.hypot(o.state.x - x, o.state.y - y) < 6000) game.removeShip(o.id);
  if (!Object.getOwnPropertyDescriptor(game, 'fronts')?.get) Object.defineProperty(game, 'fronts', { get: () => [], set: () => {}, configurable: true });
  for (const w of Object.values(game.weather)) {
    w.kind = 'breeze';
    w.until = game.now + 1e6;
  }
}

/** A captain at sea in a hull, her guns her own (no auto-fire: this is the helm's measure, not the gunners'). */
export function seaCaptainAt(game: Game, cls: ShipClassId, x: number, y: number, h: number): { s: PlayerSession; c: FakeConn; ship: ShipEntity } {
  const name = `Nav Captain ${++names}`;
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  s.profile!.level = 30;
  onHull(game, ship, cls);
  ship.crew = ship.stats.crewMax;
  ship.morale = 80;
  ship.protectedUntil = 0;
  ship.lastCombat = -1e9;
  s.autoFire = false;
  s.expert = true;
  ship.state = { ...ship.state, x, y, heading: h, speed: ship.stats.maxSpeed * 0.7, sail: 0.75, rudder: 0 };
  ship.input = { rudder: 0, sailTarget: 0.75 };
  game.grid.upsert(ship.id, x, y);
  return { s, c, ship };
}

/** Done with a captain: out of the way and quiet. */
function retire(game: Game, s: PlayerSession, c: FakeConn): void {
  const ship = s.ship!;
  ship.state.x = 2000 + names * 40;
  ship.state.y = 2000;
  ship.docked = 'saltmarrow';
  c.inbox.length = 0;
  c.send = () => {};
  c.sendBinary = () => {};
}

/** One chase: `who` a captain under «Атаковать» to board, or a sea pirate on the fleeing one. */
export type Who = 'captain' | 'guns' | 'npc';
/** One chase: `who` a captain under «Атаковать» to board (`captain`) or to fight with the guns (`guns`: the run ends
 *  when she lies within the close band, her mark abeam), or a sea pirate's run on the fleeing one (`npc`). */
export function chaseRun(game: Game, sc: ChaseScene, who: Who, mcls: ShipClassId = 'brig', maxSec = 60, trace?: (t: number, me: ShipEntity, T: ShipEntity, d: number) => void): ChaseResult {
  quietAround(game, sc.me.x, sc.me.y);
  const calm = sceneWind(game, sc.of + sc.kind);
  const [tx0, ty0] = sc.route[0];
  const T = game.spawnNpcShip('pirate', sc.tcls, 'confederacy', tx0, ty0, sc.route.length > 1 ? headingOf(sc.route[1][0] - tx0, sc.route[1][1] - ty0) : headingOf(tx0 - sc.me.x, ty0 - sc.me.y));
  game.npcs.delete(T.id); // (steered here)
  T.state.speed = T.stats.maxSpeed * 0.85;
  T.state.sail = 1;
  T.hull = T.stats.hullMax * 0.5; // (weakened: a sea pirate runs in for the grapples, not the rigging)
  T.protectedUntil = 0;
  const tb = newBrain(T.id, 'pirate', game.now);
  tb.active = true;
  game.grid.upsert(T.id, tx0, ty0);
  let me: ShipEntity, cap: { s: PlayerSession; c: FakeConn } | null = null;
  const pb = newBrain(-1, 'pirate', game.now);
  // (A sea pirate has no boarding run: her mark a little slower, under easier canvas.)
  // (Behind an island she is beyond the boarding run's reach: her canvas eased, so the chase is the helm's, not a race.)
  const tsail = who === 'npc' ? 0.55 : sc.kind === 'behind' ? 0.3 : 1;
  if (who !== 'npc') {
    const x = seaCaptainAt(game, mcls, sc.me.x, sc.me.y, sc.me.h);
    me = x.ship;
    cap = x;
    const why = startPursuit(game, x.s, T.id, who === 'guns' ? 'guns' : 'board');
    if (why) throw new Error(`no pursuit: ${why}`);
  } else {
    me = game.spawnNpcShip('pirate', mcls, 'free', sc.me.x, sc.me.y, sc.me.h);
    game.npcs.delete(me.id);
    me.ammo.round = 0;
    me.ammo.chain = 0;
    me.ammo.grape = 0;
    me.state.speed = me.stats.maxSpeed * 0.7;
    pb.active = true;
    game.grid.upsert(me.id, sc.me.x, sc.me.y);
  }
  const t0 = game.now;
  const tal0 = touches.get(me) ?? { touch: 0, blow: 0 };
  const touch0 = tal0.touch, blow0 = tal0.blow;
  let wp = 1, grapple = -1, slowFrom = -1, stuck = false, stuckSec = 0, reef = 0, end = 'clock', nextThink = 0;
  while (game.now - t0 < maxSec) {
    // The fleeing pirate: on along her route, then straight on.
    if (wp < sc.route.length && Math.hypot(sc.route[wp][0] - T.state.x, sc.route[wp][1] - T.state.y) < 110) wp++;
    if (sc.route.length === 1) {
      const dx = T.state.x - me.state.x, dy = T.state.y - me.state.y, l = Math.hypot(dx, dy) || 1;
      helmTo(game, T, tb, T.state.x + (dx / l) * 600, T.state.y + (dy / l) * 600, tsail);
    } else if (wp < sc.route.length) helmTo(game, T, tb, sc.route[wp][0], sc.route[wp][1], tsail);
    else {
      const [ax, ay] = sc.route[sc.route.length - 2], [bx, by] = sc.route[sc.route.length - 1];
      helmTo(game, T, tb, T.state.x + (bx - ax), T.state.y + (by - ay), tsail);
    }
    T.attackers.set(me.id, game.now); // (no forty seconds' «no hit either way»: the helm is measured to the end)
    const d = Math.hypot(T.state.x - me.state.x, T.state.y - me.state.y);
    const abeam = Math.abs(Math.abs(angleDiff(me.state.heading, headingOf(T.state.x - me.state.x, T.state.y - me.state.y))) - Math.PI / 2) < 0.6;
    if (who === 'guns') {
      // The guns' fight: the time to her mark in the close band, abeam; then the fight goes on (circling her mark) to
      // the end of the clock — the measure is of the whole of it.
      if (grapple < 0 && d <= pursuitHold(me).far && abeam) {
        grapple = Math.round((game.now - t0) * 10) / 10;
        end = 'grapple';
      }
    } else if (d <= boardingRangeBetween(me, T)) {
      grapple = Math.round((game.now - t0) * 10) / 10;
      end = 'grapple';
      break;
    }
    if (who === 'npc' && game.now >= nextThink) {
      nextThink = game.now + 0.3;
      engage(game, me, pb, T, d);
      if (me.boarding) {
        grapple = Math.round((game.now - t0) * 10) / 10;
        end = 'grapple';
        break;
      }
    }
    if (!me.alive || me.sinkingUntil) {
      end = 'sunk';
      break;
    }
    if (cap && !pursuitOf(me)) {
      end = (cap!.c.last('pursuit') as { why?: string } | undefined)?.why ?? 'off';
      break;
    }
    const h0 = me.hull, b0 = touches.get(me)?.blow ?? 0;
    trace?.(game.now - t0, me, T, d);
    game.step();
    const b1 = touches.get(me)?.blow ?? 0;
    if (me.hull < h0 && b1 === b0) reef += h0 - me.hull;
    // Stuck: under 1 kn (the screen's knots) for over 4 s, the mark over 200 m off.
    if (me.state.speed * 0.8 < 1 && d > 200) {
      if (slowFrom < 0) slowFrom = game.now;
      if (game.now - slowFrom > 4) stuck = true;
      stuckSec += 0.05;
    } else slowFrom = -1;
  }
  const tal = touches.get(me) ?? { touch: 0, blow: 0 };
  const res: ChaseResult = {
    kind: sc.kind, of: sc.of, grapple, stuck, stuckSec: Math.round(stuckSec * 10) / 10,
    blows: tal.blow - blow0, touches: tal.touch - touch0, reef: Math.round((reef / me.stats.hullMax) * 1000) / 1000, end,
  };
  if (cap) {
    stopPursuit(game, cap.s, 'off');
    retire(game, cap.s, cap.c);
  } else game.removeShip(me.id);
  game.removeShip(T.id);
  calm();
  return res;
}

// ------------------------------------------------------------------ the helmsman's runs

export interface SailScene {
  kind: 'anchorage' | 'pier' | 'wreck' | 'skerry' | 'hulks' | 'across' | 'dense';
  of: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** A start out at sea `far` metres from a point, on the first open bearing (from a fixed one by `k`). */
function startOff(world: World, x: number, y: number, far: number, k: number): { x: number; y: number } | null {
  for (let t = 0; t < 12; t++) {
    const a = ((k * 2.399 + t * 0.524) % (Math.PI * 2));
    const sx = x + Math.sin(a) * far, sy = y - Math.cos(a) * far;
    if (openAt(world, sx, sy, 90)) return { x: sx, y: sy };
  }
  return null;
}

/** `per` runs of each kind: to a town's anchorage and onto its piers, onto a hulk, a skerry, a graveyard's hulks,
 *  across an island to the open water on her far side, and through the dense sea (reefs, stacks and hulks thick on the
 *  straight line, 3 km of it). */
export function sailScenes(world: World, per = 7): SailScene[] {
  const out: SailScene[] = [];
  const ports = spread(world.ports.filter((p) => !p.raft && world.islands[p.islandId]), per * 3);
  let a = 0, b = 0;
  for (const [k, p] of ports.entries()) {
    const is = world.islands[p.islandId];
    const from = startOff(world, p.x, p.y, 1800, k);
    if (!from) continue;
    if (a < per) {
      out.push({ kind: 'anchorage', of: `port ${p.id}`, from, to: { x: p.x, y: p.y } });
      a++;
    }
    const q = quayBlockers(p, rounded(is))[0];
    if (q && b < per) {
      // The tap on the town's quay: the pier's middle, as the painting shows it.
      out.push({ kind: 'pier', of: `port ${p.id}`, from, to: { x: q.x, y: q.y } });
      b++;
    }
  }
  const wrecks = spread(world.marks.filter((m) => m.kind === 'wreck' && m.r >= 50), per * 4);
  let w = 0;
  for (const [k, m] of wrecks.entries()) {
    if (w >= per) break;
    const from = startOff(world, m.x, m.y, 1500, k);
    if (!from || !openAt(world, m.x + 250, m.y, 0, 6)) continue;
    out.push({ kind: 'wreck', of: `wreck ${m.id}`, from, to: { x: m.x, y: m.y } });
    w++;
  }
  const objs = spread(buildAdv(world).objs, per * 4);
  let s = 0;
  for (const [k, o] of objs.entries()) {
    if (s >= per) break;
    const from = startOff(world, o.x, o.y, 1500, k);
    if (!from) continue;
    out.push({ kind: 'skerry', of: `skerry ${o.x | 0},${o.y | 0}`, from, to: { x: o.x, y: o.y } });
    s++;
  }
  const graves = spread(world.islands.filter((i) => !i.slot && !i.hidden && !i.raft && !i.minor && !i.portId && i.poly.length > 0 && isleType(i) === 'graveyard'), per * 4);
  let g = 0;
  for (const [k, is] of graves.entries()) {
    if (g >= per) break;
    const hb = hulkBlockers(rounded(is));
    if (!hb.length) continue;
    const hk = hb[0];
    const from = startOff(world, hk.x, hk.y, 1500, k);
    if (!from) continue;
    out.push({ kind: 'hulks', of: `graveyard ${is.id}`, from, to: { x: hk.x, y: hk.y } });
    g++;
  }
  const isles = spread(world.islands.filter((i) => !i.slot && !i.hidden && !i.raft && i.poly.length > 0 && i.radius >= 300 && i.radius <= 1500), per * 4);
  let c = 0;
  for (const [k, is] of isles.entries()) {
    if (c >= per) break;
    for (let t = 0; t < 6; t++) {
      const ang = ((k * 2.399 + t * 1.047) % (Math.PI * 2));
      const ux = Math.sin(ang), uy = -Math.cos(ang);
      const f = { x: is.x - ux * (is.radius + 700), y: is.y - uy * (is.radius + 700) };
      const to = { x: is.x + ux * (is.radius + 400), y: is.y + uy * (is.radius + 400) };
      if (!openAt(world, f.x, f.y, 90) || !openAt(world, to.x, to.y, 60)) continue;
      out.push({ kind: 'across', of: `isle ${is.id}`, from: f, to });
      c++;
      break;
    }
  }
  const thick = spread(world.reefs.filter((r) => r.region !== 'the_abyss' && r.radius >= 60), per * 6);
  let n = 0;
  for (const [k, rf] of thick.entries()) {
    if (n >= per) break;
    for (let t = 0; t < 6; t++) {
      const ang = ((k * 2.399 + t * 1.047) % (Math.PI * 2));
      const ux = Math.sin(ang), uy = -Math.cos(ang);
      const f = { x: rf.x - ux * 1500, y: rf.y - uy * 1500 }, to = { x: rf.x + ux * 1500, y: rf.y + uy * 1500 };
      if (!openAt(world, f.x, f.y, 90) || !openAt(world, to.x, to.y, 60)) continue;
      // Thick on the line: four things or more within 300 m of it (reefs, the solid things).
      let things = 0;
      for (const r2 of world.reefs) {
        const t2 = Math.max(0, Math.min(1, ((r2.x - f.x) * (to.x - f.x) + (r2.y - f.y) * (to.y - f.y)) / 9e6));
        if (Math.hypot(f.x + (to.x - f.x) * t2 - r2.x, f.y + (to.y - f.y) * t2 - r2.y) < r2.radius + 300) things++;
      }
      for (let i = 0; i <= 10; i++) things += blockersNear(world, f.x + (to.x - f.x) * (i / 10), f.y + (to.y - f.y) * (i / 10), 150, []).filter((b) => b.shape !== 'coast').length;
      if (things < 4) continue;
      out.push({ kind: 'dense', of: `reef ${rf.id}`, from: f, to });
      n++;
      break;
    }
  }
  return out;
}

export interface SailResult {
  kind: SailScene['kind'];
  of: string;
  /** Arrived (the helmsman said so); else blocked, and why (stuck, reef, the clock). */
  arrived: boolean;
  why: string;
  sec: number;
  blows: number;
  touches: number;
  /** Where she ended, from the mark. */
  left: number;
}

/** One run: the captain gives the helmsman the wheel for the mark, out at sea `from`. */
export function sailRun(game: Game, sc: SailScene, cls: ShipClassId = 'brig', maxSec = 300): SailResult {
  quietAround(game, sc.from.x, sc.from.y);
  quietAround(game, sc.to.x, sc.to.y);
  const calm = sceneWind(game, sc.of + sc.kind);
  const { s, c, ship } = seaCaptainAt(game, cls, sc.from.x, sc.from.y, headingOf(sc.to.x - sc.from.x, sc.to.y - sc.from.y));
  ship.state.speed = 0;
  const tal0 = touches.get(ship) ?? { touch: 0, blow: 0 };
  const touch0 = tal0.touch, blow0 = tal0.blow;
  c.push({ t: 'autosail', x: Math.round(sc.to.x), y: Math.round(sc.to.y), sail: 4 });
  const t0 = game.now;
  let why = 'clock';
  if (!autosailOf(ship)) why = `refused: ${(c.last('toast') as { msg?: string } | undefined)?.msg ?? c.last('autosail')?.on}`;
  else {
    let quiet = game.now + 10;
    while (game.now - t0 < maxSec) {
      if (game.now > quiet) {
        quiet = game.now + 10;
        quietAround(game, ship.state.x, ship.state.y);
      }
      game.step();
      if (!autosailOf(ship)) {
        why = (c.last('autosail') as { why?: string } | undefined)?.why ?? 'off';
        break;
      }
    }
  }
  const tal = touches.get(ship) ?? { touch: 0, blow: 0 };
  const res: SailResult = {
    kind: sc.kind, of: sc.of, arrived: why === 'arrived', why, sec: Math.round(game.now - t0),
    blows: tal.blow - blow0, touches: tal.touch - touch0, left: Math.round(Math.hypot(ship.state.x - sc.to.x, ship.state.y - sc.to.y)),
  };
  const near: Blocker[] = [];
  blockersNear(game.world, ship.state.x, ship.state.y, ship.stats.length, near);
  void hullClearance;
  void CHUNK_SIZE;
  void near;
  if (autosailOf(ship)) c.push({ t: 'autosail', stop: true });
  retire(game, s, c);
  calm();
  return res;
}

// ------------------------------------------------------------------ the tables

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
};

export interface ChaseSummary { n: number; stuck: number; stuckSec: number; blows: number; blowRuns: number; reefRuns: number; reef: number; grappled: number; median: number; p90: number }
export function sumChases(rs: ChaseResult[]): ChaseSummary {
  const g = rs.filter((r) => r.grapple >= 0).map((r) => r.grapple);
  return {
    n: rs.length,
    stuck: rs.filter((r) => r.stuck).length,
    stuckSec: Math.round(rs.reduce((a, r) => a + r.stuckSec, 0)),
    blows: rs.reduce((a, r) => a + r.blows, 0),
    blowRuns: rs.filter((r) => r.blows > 0).length,
    reefRuns: rs.filter((r) => r.reef > 0).length,
    reef: Math.round(rs.reduce((a, r) => a + r.reef, 0) * 1000) / 10,
    grappled: g.length,
    median: pct(g, 0.5),
    p90: pct(g, 0.9),
  };
}

export interface SailSummary { n: number; arrived: number; blocked: number; blows: number; whys: Record<string, number>; median: number }
export function sumSails(rs: SailResult[]): SailSummary {
  const whys: Record<string, number> = {};
  for (const r of rs) if (!r.arrived) whys[r.why] = (whys[r.why] ?? 0) + 1;
  return {
    n: rs.length,
    arrived: rs.filter((r) => r.arrived).length,
    blocked: rs.filter((r) => !r.arrived).length,
    blows: rs.reduce((a, r) => a + r.blows, 0),
    whys,
    median: pct(rs.filter((r) => r.arrived).map((r) => r.sec), 0.5),
  };
}
