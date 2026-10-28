// «Дальний переход» (owner, 2026-10-28): «выбирая дальние точки плавания корабль спустя 15 сек плавания должен ускоряться
// на полном ходу в 5 раз, но при этом он не сможет остановиться пока не доплывет до нужного места, потому что море большое
// и плавать нужно много … корабль невозможно будет остановить, атаковать и так далее, он просто ускоряется и становится
// неактивным для окружения».
//
// The rules (server-authoritative; tests/voyage.test.ts):
//  - FAR: the helmsman's run (autosail.ts — a tap on the sea or the chart, «Плыть» to a goal, a port, an island) whose
//    planned way is longer than VOYAGE_FAR_SEC seconds at her top speed and VOYAGE_FAR_MIN metres;
//  - SPIN-UP: VOYAGE_SPIN seconds of unbroken sailing for it with way on, out of any fight (no shot, no hit, no battle,
//    no grapple, no spoils waiting, no «Атаковать», no mutiny). Any of them, or another mark, starts the count anew;
//  - THE PASSAGE: the way planned afresh from where she is and every leg of it sounded for her hull and keel (runFree:
//    the coasts' band, the solid things, the reefs, the shoals, the maelstroms' eyes); she is carried along it at
//    VOYAGE_MUL × her top speed — not sailed: no wind, current, storm or whirlpool moves her, so she never leaves the
//    sounded legs, in steps of CARRY_STEP metres at most (≈ 22 m a tick at 20 Hz for a 15-knot hull, ×10 since the
//    owner's «давай х10»);
//  - out of everyone's reach (inbattle.ts untouchable: no captain, ship of the sea or beast targets, fires on, rams,
//    grapples or boards her; the sea's ships drop her as prey; no encounter, no storm's canvas, no collisions); her own
//    hand can neither stop, turn, fire nor do a thing at sea (Game.handle refuses VOYAGE_BLOCKED, her helm is swallowed,
//    allStop and stopAutosail leave her be);
//  - it ends VOYAGE_TAIL metres short of the run's end, in sounded water: her way drops to her own and the helmsman
//    brings her up to the mark as ever (a goal's «Плыть» completes there, a harbour's step puts her in); a stretch ahead
//    found foul since (a bank the tide bared) ends it there; her ship gone, or moved by something else, ends it;
//  - others see her as a ghost on a long wake (SF.VOYAGE): dimmed, no mark, no target;
//  - her line dropped mid-passage: she is carried on to its end (and lies to there); her session retired first, she is
//    put at its end before she is saved. Back aboard mid-passage: the pill and the line come back.

import { VOYAGE_FAR_MIN, VOYAGE_FAR_SEC, VOYAGE_MUL, VOYAGE_SPIN, VOYAGE_TAIL } from '../../../shared/src/data/passage.ts';
import type { VoyageEnd } from '../../../shared/src/data/passage.ts';
import { SPEED_SCALE } from '../../../shared/src/constants.ts';
import { angleDiff, headingOf, wrapAngle } from '../../../shared/src/math.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { adoptPlan, autosailOf, foulWater, planFrom, resendAutosail, runFree } from './autosail.ts';
import type { Game } from './Game.ts';
import { inBattle } from './inbattle.ts';
import type { PlayerSession } from './player.ts';
import { pursuitOf } from './pursuit.ts';
import { hullWater } from './seaway.ts';
import type { ShipEntity } from './ship.ts';

/** What she is told when an order of hers is refused on a passage (server.ru.passage.ts). */
export const VOYAGE_BUSY = 'A long passage under way: she cannot be stopped or turned until she arrives.';
/** What another is told who would touch her. */
export const VOYAGE_WHY = 'She is on a long passage: nobody may touch her.';

/** The orders refused on a passage: everything that stops, turns or fights her, or does a thing at sea. The cabin's
 *  windows (her hold, her crew, the chat, the journal, the shops' reading) stay open. */
export const VOYAGE_BLOCKED: ReadonlySet<string> = new Set([
  'autosail', 'goto', 'halt', 'dock', 'undock', 'land', 'chase', 'dash', 'fire', 'volley', 'aim', 'attack', 'ability', 'talent_active', 'path',
  'board', 'board_join', 'board_assist', 'board_duel', 'tribute', 'surrender', 'ceasefire', 'pvp', 'escort', 'seahire', 'press_gang',
  'fishing', 'hunt', 'tame', 'trek', 'encounter', 'minigame', 'seafind', 'seamark', 'lair', 'drift', 'roam', 'h4', 'way', 'isle18',
  'abyss', 'descent', 'dive_move', 'dive_surface', 'treasure', 'chest', 'bottle', 'jettison', 'cut_mast', 'scuttle', 'scuttle_home',
  'regatta', 'loot_take', 'mount', 'run', 'throne', 'h3', 'caravan', 'estate',
]);

/** Whether this order of hers is refused on a passage. */
export function voyageBlocks(msg: Pick<ClientMsg, 't'>): boolean {
  return VOYAGE_BLOCKED.has(msg.t);
}

interface Voyage {
  path: [number, number][];
  /** The point she is carried for. */
  i: number;
  /** Her way, m/s. */
  v: number;
  since: number;
  /** Where the passage put her last tick (anything else moving her ends it). */
  lx: number;
  ly: number;
  lookAt: number;
}

interface Spin {
  since: number;
  end: [number, number];
  far: boolean;
  tryAt: number;
}

const voyages = new Map<ShipEntity, Voyage>();
const spins = new WeakMap<ShipEntity, Spin>();

/** The longest single step of her carrying (metres): a tick's way at ×10 is cut into these, each sounded. */
export const CARRY_STEP = 8;

/** On a passage now. */
export function voyaging(ship: ShipEntity | null | undefined): boolean {
  return !!ship && voyages.has(ship);
}

/** The passage as it stands (tests, telemetry): her way and what is left of it. */
export function voyageOf(ship: ShipEntity | null | undefined): { v: number; left: number; since: number; path: [number, number][] } | null {
  const v = ship ? voyages.get(ship) : undefined;
  return v && ship ? { v: v.v, left: leftOf(ship, v), since: v.since, path: v.path } : null;
}

/** Seconds of the spin-up counted so far for her run (0: none counting). */
export function spinOf(game: Game, ship: ShipEntity): number {
  const sp = spins.get(ship);
  return sp && sp.far ? game.now - sp.since : 0;
}

/** A way's length from a point along `path` from its point `i` on. */
function lengthFrom(x: number, y: number, path: [number, number][], i: number): number {
  let d = 0, px = x, py = y;
  for (let k = Math.max(0, i); k < path.length; k++) {
    d += Math.hypot(path[k][0] - px, path[k][1] - py);
    px = path[k][0];
    py = path[k][1];
  }
  return d;
}

function leftOf(ship: ShipEntity, v: Voyage): number {
  return lengthFrom(ship.state.x, ship.state.y, v.path, v.i);
}

/** The far mark's length for her hull: VOYAGE_FAR_SEC at her top speed, VOYAGE_FAR_MIN at the least. */
export function farLength(ship: ShipEntity): number {
  return Math.max(VOYAGE_FAR_MIN, ship.stats.maxSpeed * SPEED_SCALE * VOYAGE_FAR_SEC);
}

/** Her way on a passage, m/s. */
export function voyageSpeed(ship: ShipEntity): number {
  return VOYAGE_MUL * ship.stats.maxSpeed * SPEED_SCALE;
}

/** Why her run's spin-up cannot count now (null: it counts). */
function spinBroken(game: Game, s: PlayerSession, ship: ShipEntity): boolean {
  if (!ship.alive || ship.docked || ship.landing || ship.grappled || ship.boarding || ship.boardAlly !== null || ship.sinkingUntil) return true;
  if (s.pendingBoarding || s.profile?.company.mutiny || ship.seizedHelm || pursuitOf(ship)) return true;
  if (ship.inCombat(game.now) || ship.underFire(game.now) || inBattle(game, ship) || ship.battleGraceUntil > game.now) return true;
  return ship.state.speed < 1;
}

/** Every leg of a way sounded for her hull and keel as it lies (the bare hull's water and the lead line every 60 m). */
export function wayClear(game: Game, ship: ShipEntity, path: [number, number][]): boolean {
  const hw = hullWater(ship);
  for (let k = 1; k < path.length; k++) if (!runFree(game, ship, path[k - 1][0], path[k - 1][1], path[k][0], path[k][1], hw, true)) return false;
  return true;
}

/** The passage begins: the way planned and sounded afresh, or null with why not. */
function begin(game: Game, s: PlayerSession, ship: ShipEntity, end: [number, number]): string | null {
  const run = autosailOf(ship);
  if (!run) return 'no run';
  const path = planFrom(game, ship, ship.state.x, ship.state.y, end[0], end[1]);
  if (!path || path.length < 2) return 'no plan';
  if (!wayClear(game, ship, path)) return 'foul';
  const len = lengthFrom(ship.state.x, ship.state.y, path, 1);
  if (len - VOYAGE_TAIL < 600) return 'near';
  const v = voyageSpeed(ship);
  voyages.set(ship, { path, i: 1, v, since: game.now, lx: ship.state.x, ly: ship.state.y, lookAt: game.now });
  adoptPlan(game, s, ship, path);
  ship.input = { rudder: 0, sailTarget: 1 };
  ship.state.sail = 1;
  ship.state.rudder = 0;
  ship.state.speed = v / SPEED_SCALE;
  game.sendTo(s, { t: 'voyage', on: true, v: Math.round(v * 10) / 10, x: Math.round(end[0]), y: Math.round(end[1]), left: Math.round(len), tail: VOYAGE_TAIL });
  game.log(`[voyage] ${s.name} ${Math.round(len)} m at ${Math.round(v)} m/s`);
  return null;
}

/** The passage ends: her own way back, the helmsman on with the rest of the way (or the wheel hers when he has none). */
function end(game: Game, ship: ShipEntity, why: VoyageEnd): void {
  const v = voyages.get(ship);
  if (!v) return;
  voyages.delete(ship);
  spins.delete(ship);
  const s = ship.accountId !== null ? game.sessionOf(ship) : undefined;
  if (why === 'lost') return;
  ship.state.speed = Math.min(ship.state.speed, ship.stats.maxSpeed * 0.85);
  const run = autosailOf(ship);
  if (run) {
    // (the way she was carried along is his plan now, from where she is: his stuck and round-and-round reckonings anew)
    run.path = v.path;
    run.i = Math.min(Math.max(1, v.i), v.path.length - 1);
    run.stuck = { x: ship.state.x, y: ship.state.y, t: game.now };
    run.best = undefined;
    run.bestAt = undefined;
    run.ever = undefined;
    run.gainAt = undefined;
    run.plannedAt = game.now;
    run.offAt = game.now;
    run.creepAt = undefined;
  }
  if (!s || s.disconnectedAt !== null || !game.sessions.has(s)) {
    // nobody at the helm: she lies to where the passage left her
    ship.input = { rudder: 0, sailTarget: 0 };
    return;
  }
  game.sendTo(s, { t: 'voyage', on: false, why });
}

/** The point VOYAGE_TAIL short of the way's end along it, with the leg's heading. */
function tailPoint(v: Voyage, ship: ShipEntity): { x: number; y: number; h: number; i: number } {
  let left = leftOf(ship, v) - VOYAGE_TAIL;
  let px = ship.state.x, py = ship.state.y;
  for (let k = v.i; k < v.path.length; k++) {
    const [qx, qy] = v.path[k];
    const d = Math.hypot(qx - px, qy - py);
    if (d >= left) {
      const t = d > 0 ? left / d : 0;
      return { x: px + (qx - px) * t, y: py + (qy - py) * t, h: headingOf(qx - px, qy - py), i: k };
    }
    left -= d;
    px = qx;
    py = qy;
  }
  return { x: px, y: py, h: ship.state.heading, i: v.path.length - 1 };
}

/** Her session retired mid-passage (her line gone past its lingering): she is put at its end before she is saved. */
export function finishVoyage(game: Game, ship: ShipEntity | null | undefined): void {
  const v = ship ? voyages.get(ship) : undefined;
  if (!ship || !v) return;
  const p = tailPoint(v, ship);
  ship.state.x = p.x;
  ship.state.y = p.y;
  ship.state.heading = p.h;
  ship.state.speed = 0;
  v.i = p.i;
  game.grid.upsert(ship.id, p.x, p.y);
  end(game, ship, 'arrived');
}

/** Back aboard mid-passage (a reload, a dropped line): the line and the pill again. */
export function voyageResend(game: Game, s: PlayerSession): void {
  const ship = s.ship;
  const v = ship ? voyages.get(ship) : undefined;
  if (!ship || !v) return;
  resendAutosail(game, s);
  const e = v.path[v.path.length - 1];
  game.sendTo(s, { t: 'voyage', on: true, v: Math.round(v.v * 10) / 10, x: Math.round(e[0]), y: Math.round(e[1]), left: Math.round(leftOf(ship, v)), tail: VOYAGE_TAIL });
}

/** Each tick, after the helmsmen: the spin-ups counted and begun, and the passages carried on. */
export function stepVoyage(game: Game, dt: number): void {
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || voyages.has(ship) || s.disconnectedAt !== null) continue;
    const run = autosailOf(ship);
    if (!run) {
      spins.delete(ship);
      continue;
    }
    const e: [number, number] = run.end ? [run.end[0], run.end[1]] : [run.x, run.y];
    let sp = spins.get(ship);
    if (!sp || Math.hypot(sp.end[0] - e[0], sp.end[1] - e[1]) > 300) {
      const far = lengthFrom(ship.state.x, ship.state.y, run.path, run.i) >= farLength(ship);
      spins.set(ship, (sp = { since: game.now, end: e, far, tryAt: 0 }));
    }
    if (!sp.far) continue;
    if (spinBroken(game, s, ship)) {
      sp.since = game.now;
      continue;
    }
    if (game.now - sp.since < VOYAGE_SPIN || game.now < sp.tryAt) continue;
    const why = begin(game, s, ship, e);
    if (why === 'near') sp.far = false;
    else if (why) sp.tryAt = game.now + 5;
  }
  for (const ship of [...voyages.keys()]) carry(game, ship, dt);
}

/** One tick of her passage: carried along the sounded way at her passage's way. */
function carry(game: Game, ship: ShipEntity, dt: number): void {
  const v = voyages.get(ship)!;
  if (!ship.alive || ship.docked || game.ships.get(ship.id) !== ship) return end(game, ship, 'lost');
  // something else moved her (an admin's /tp, a current of the Descent): the passage is over where she is
  if (Math.hypot(ship.state.x - v.lx, ship.state.y - v.ly) > 30) return end(game, ship, 'invalid');
  // the way ahead looked at again twice a second: a bank bared since, a thing come onto it — over short of it
  if (game.now - v.lookAt >= 0.5) {
    v.lookAt = game.now;
    const [nx, ny] = v.path[v.i];
    const ahead = Math.min(Math.hypot(nx - ship.state.x, ny - ship.state.y), v.v * 2);
    if (ahead > 5) {
      const h = headingOf(nx - ship.state.x, ny - ship.state.y);
      const ex = ship.state.x + Math.sin(h) * ahead, ey = ship.state.y - Math.cos(h) * ahead;
      if (!runFree(game, ship, ship.state.x, ship.state.y, ex, ey, hullWater(ship), true)) return end(game, ship, 'invalid');
    }
  }
  const left = leftOf(ship, v);
  const total = Math.min(v.v * dt, Math.max(0, left - VOYAGE_TAIL));
  const x0 = ship.state.x, y0 = ship.state.y;
  let x = x0, y = y0, legH = ship.state.heading, done = 0, foul = false;
  // In steps of CARRY_STEP at most (×10: 20–40 m a tick), each one's water sounded under her keel: the legs were
  // sounded whole when the passage began, this is the lead line's last word on the way.
  while (total - done > 1e-6 && !foul) {
    let step = Math.min(CARRY_STEP, total - done);
    done += step;
    const px = x, py = y, pi = v.i;
    while (step > 1e-6 && v.i < v.path.length) {
      const [tx, ty] = v.path[v.i];
      const d = Math.hypot(tx - x, ty - y);
      if (d > 1e-6) legH = headingOf(tx - x, ty - y);
      if (d <= step) {
        x = tx;
        y = ty;
        step -= d;
        if (v.i < v.path.length - 1) v.i++;
        else break;
      } else {
        x += ((tx - x) / d) * step;
        y += ((ty - y) / d) * step;
        step = 0;
      }
    }
    if (foulWater(game, ship, x, y)) {
      x = px;
      y = py;
      v.i = pi;
      foul = true;
    }
  }
  ship.state.x = x;
  ship.state.y = y;
  // her bow swung onto the leg as a hull turns (the way itself is the leg's)
  const turn = angleDiff(ship.state.heading, legH);
  const max = 2.4 * dt;
  ship.state.heading = wrapAngle(ship.state.heading + Math.max(-max, Math.min(max, turn)));
  ship.state.speed = v.v / SPEED_SCALE;
  ship.state.sail = 1;
  ship.state.rudder = 0;
  ship.input = { rudder: 0, sailTarget: 1 };
  ship.distanceLog += Math.hypot(x - x0, y - y0);
  game.grid.upsert(ship.id, x, y);
  v.lx = x;
  v.ly = y;
  if (foul) end(game, ship, 'invalid');
  else if (left - VOYAGE_TAIL <= v.v * dt + 0.5) end(game, ship, 'arrived');
}
