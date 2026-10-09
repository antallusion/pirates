// «Атаковать» (docs/23 phase 3, owner 2026-10-06: «бои должны быть проще, может какое-то автоматическое преследование
// сделать»). The captain names her mark and the ship does the rest: the helmsman closes in and either holds her best
// gun range broadside-on (`guns`) or runs straight in for the grapples and matches the mark's way (`board`); the gun
// captains lay every loaded broadside on the mark's lead as it bears (auto-fire); the bow and stern chasers speak for
// themselves. The captain's own hand on the helm takes the wheel at once, and the helmsman has it back 1.5 s after she
// lets go. Everything here is the server's (the client only names the mark and the mode): the helm the NPCs sail by
// (npc.ts engageHelm), the gunnery they lay by (combat.ts fireBroadside's laid volley). No dice of its own: the steering
// and the laying are exact, the balls' scatter is fireBroadside's.
//
// The close fight (owner, 2026-10-07: «я должен быть рядом с целью очень близко, чтобы попадать, а плаваю я очень
// далеко»): with the guns she closes to a third of her reach and lies broadside on there (gunnery.ts closeRange), on the
// screen and where nine balls in ten strike; her gun captains let a side go only inside the band (three in four and
// more), whatever the auto-fire switch — the order «Атаковать» is the order to fire (its own words: «пушки бьют, как
// только она в секторе»); only the expert's hand fires her guns herself.
//
// The way to her (2026-10-09, after the island collision): the helm's lead line rounds what lies ahead (npc.ts steer,
// seaway.ts: the coast's band and the solid things her hull would strike, and the reefs her keel drags on, along the
// whole of its look — the guns' fight circled its broadside's course over a reef and sank on it). Held fast (under a
// knot for four seconds, her mark beyond a cable) the helmsman plans her a way from where she lies (nav.ts, made good for
// her hull and keel) and sails it a while; held fast again and again — or no way at all — the mark is lost to her
// (`lost`: the wheel back, said once), never ground on for ever. (Sailing the planner's route whenever land lay across
// the line to her was tried: its wide berth off the coast lost more than it won, tools/nav/measure.ts.)
//
// And the creatures' stacks (docs/19 D7; the owner, the same day: «на нейтральных существ нападать нельзя… не работает
// никакие кнопки, идут ошибки вечные»): «Атаковать» on a stack is a run of its own (`roam`) — the helmsman sails her in
// and, a cable off, her boats go (roamers.ts attackRoam): the hex battle opens. No ship's order goes to a stack: a run
// on one has no ship for its mark (`target` −1), and the gunners only answer a ship that fires on her.

import { AIMED_SPREAD, AUTO_ARC_DEG, BOARD_RUN, CHASE_GIVE_UP, LAY_ARC_DEG, closeRange, leadPoint } from '../../../shared/src/data/gunnery.ts';
import { ROAM_REACH } from '../../../shared/src/data/roamers.ts';
import { AMMO, CHASER_CONE } from '../../../shared/src/data/ships.ts';
import type { PursuitMode, PursuitStop } from '../../../shared/src/protocol.ts';
import { angleDiff, DEG, headingOf } from '../../../shared/src/math.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import { stopAutosail, autosailOf } from './autosail.ts';
import { boardingRangeBetween } from './boarding.ts';
import { NO_BOARD_HER, NO_BOARD_OWN, boardingOff } from './colours.ts';
import { applyDamage, damageBlocked, effectiveRange, fireBroadside, fireChaser, sideHeading } from './combat.ts';
import type { Game } from './Game.ts';
import { engageHelm, helmTo, newBrain } from './npc.ts';
import { findPath, lineFree } from './nav.ts';
import type { Path } from './nav.ts';
import { hullWater, laneFoul } from './seaway.ts';
import { KNOTS_PER_SPEED } from '../../../shared/src/sim/hull.ts';
import type { NpcBrain } from './npc.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { softenFoe } from './firstfights.ts';
import { canStrike, struck } from './struck.ts';
import { attackRoam, roamRunWhy, roamWhereId } from './roamers.ts';

/** The helmsman has the wheel back this long after the captain lets go of it. */
export const PURSUIT_RESUME = 1.5;
/** A mark farther than this is lost from sight. */
export const PURSUIT_SIGHT = 2600;
/** A mark lost: the nearest ship hostile to her within this is the next (docs/23 item 43). */
export const RETARGET_R = 1600;
/** The boarding run starts this near her mark. */
export const BOARD_RUN_FROM = 1200;
/** Auto-battle against the weak (docs/23 item 46): a mark this many levels below her own is settled in AUTO_WEAK_SEC. */
export const AUTO_WEAK_GAP = 2;
export const AUTO_WEAK_SEC = 3;
/** The last of the boarding run: this much faster than her mark until the grapples reach (docs/23 item 47: at +2 she
 *  crept the last metres on a mark running before the wind). */
export const BOARD_CLOSE = 3.5;
/** Run in to board, her gun captains hold their fire (all but grape) at a prize below this share of her hull. */
export const PRIZE_HOLD = 0.4;
/** The guns' fight (owner, 2026-10-07): past this many times the close band's best distance she runs in bow on with
 *  the boarding run's hands on the braces (her narrowest side to the guns, twice her way), and comes broadside on below
 *  CLOSE_TURN times it — the sea's ships fire from 70–92% of their reach, and a captain who closed broadside on to her
 *  close band took their broadsides all the way in. */
export const CLOSE_RUN = 1.6;
export const CLOSE_TURN = 1.3;
/** The captains' self-defence: a ship that struck her within this many seconds is a mark for her gunners. */
const SELF_DEFENCE = 30;
/** A run on a creature stack (docs/19 D7) is given up after this long without reaching it (an island in the way). */
export const ROAM_RUN_MAX = 120;
/** Held fast, the planner's route is sailed for ROUND_HOLD seconds (re-planned every ROUND_EVERY seconds as the mark
 *  moves); nearer her mark than ROUND_FROM the helm has her again. */
export const ROUND_FROM = 300;
export const ROUND_HOLD = 15;
export const ROUND_EVERY = 3;
/** Held fast: under a knot this long with her mark beyond a cable; this many times running, the mark is lost. A spell
 *  under way (STUCK_CLEAR seconds) wipes the count; no way round at all for NO_WAY_SEC, the mark is lost too. */
export const STUCK_SEC = 4;
export const STUCK_GIVE_UP = 3;
export const STUCK_CLEAR = 15;
export const NO_WAY_SEC = 6;

export interface Pursuit {
  /** Her mark's ship; −1 on a run on a creature stack (`roam`). */
  target: number;
  mode: PursuitMode;
  /** docs/19 D7: the creature stack she runs on (its id), not a ship. */
  roam?: number;
  since: number;
  /** When the captain last had her hand on the helm (the helmsman waits PURSUIT_RESUME after it). */
  helmAt: number;
  /** The helmsman's memory of tacks and beats (the NPCs' steering keeps it on a brain). */
  brain: NpcBrain;
  /** Auto-battle against the weak: the broadsides still to come, and when the next one lands. */
  auto?: { left: number; next: number };
  /** The guns' fight: running in bow on to the close band (true), or lying broadside on in it. */
  closing?: boolean;
  /** Held fast: the planner's route to her mark, its next point, when planned and to where. */
  way?: { path: Path; i: number; at: number; tx: number; ty: number } | null;
  /** Held fast: since when (under a knot), how many times running, when last under way; sailed round by the route
   *  until when (after a hold-fast, whatever the line); since when there has been no way round at all. */
  slowSince?: number;
  stucks?: number;
  movingSince?: number;
  wayUntil?: number;
  noWaySince?: number;
}

const runs = new WeakMap<ShipEntity, Pursuit>();

export function pursuitOf(ship: ShipEntity | null | undefined): Pursuit | null {
  return ship ? runs.get(ship) ?? null : null;
}

/** Why she may not take this ship for her mark, or null. */
export function attackBlocked(game: Game, ship: ShipEntity, target: ShipEntity | undefined): string | null {
  if (!ship.alive || ship.docked) return 'Not at sea';
  if (ship.boarding || ship.grappled) return 'Already locked in a boarding action';
  if (!target || target.id === ship.id || !target.alive || target.sinkingUntil || target.docked) return 'No such ship';
  if (target.ghost || Math.hypot(target.state.x - ship.state.x, target.state.y - ship.state.y) > PURSUIT_SIGHT) return 'She is out of sight';
  const why = damageBlocked(game, ship, target);
  if (why === 'friendly') return 'That ship sails with you';
  if (why === 'protected') return 'She is under protection';
  if (why === 'docked') return 'Not at sea';
  return why;
}

function send(game: Game, s: PlayerSession, run: Pursuit | null, why?: PursuitStop): void {
  game.sendTo(s, run ? (run.roam !== undefined ? { t: 'pursuit', on: true, roam: run.roam } : { t: 'pursuit', on: true, target: run.target, mode: run.mode }) : { t: 'pursuit', on: false, why: why ?? 'off' });
}

/** The close fight's band for her guns as loaded (the broadside that reaches farther). */
export function pursuitHold(ship: ShipEntity): { best: number; near: number; far: number } {
  return closeRange(Math.max(effectiveRange(ship, 'port', ship.ammoSel), effectiveRange(ship, 'starboard', ship.ammoSel)));
}

/** A mark no grapple takes (a beast of the sea, a monster, a zone boss, a great one's body or limb): «Атаковать» on her is
 *  the guns' fight — the boarding run went in bow on for grapples that never came, and its gunners held their fire on a
 *  «prize» below two fifths of her hull. */
export function unboardable(t: ShipEntity): boolean {
  return t.npcRole === 'beast' || !!t.cls.monster || !!t.zoneBoss || !!t.bossOf || !!t.bossPart;
}

/** «Атаковать»: she takes `id` for her mark, to fight with the guns or to board. Null when the helmsman has her. */
export function startPursuit(game: Game, s: PlayerSession, id: number, mode: PursuitMode): string | null {
  const ship = s.ship;
  if (!ship || !s.profile) return 'No ship';
  const target = game.ships.get(id);
  const why = attackBlocked(game, ship, target);
  if (why) return why;
  if (autosailOf(ship)) stopAutosail(game, s, 'manual');
  if (mode === 'board' && unboardable(target!)) mode = 'guns';
  // «Абордаж: выкл» on either ship (docs/24 C1): the guns' fight, and why, once (at the order, not every tick).
  if (mode === 'board' && (boardingOff(game, ship) || boardingOff(game, target!))) {
    mode = 'guns';
    game.sendTo(s, { t: 'toast', msg: boardingOff(game, ship) ? NO_BOARD_OWN : NO_BOARD_HER, kind: 'info' });
  }
  const prev = runs.get(ship);
  const run: Pursuit = prev && prev.target === id && prev.roam === undefined
    ? { ...prev, mode }
    : { target: id, mode, since: game.now, helmAt: -Infinity, brain: newBrain(ship.id, 'pirate', game.now) };
  // Auto-battle against the weak (docs/23 item 46): a ship of the ladder two levels and more below hers.
  if (!run.auto && s.autoWeak && weakMark(ship, target!)) run.auto = { left: 3, next: game.now + AUTO_WEAK_SEC / 3 };
  runs.set(ship, run);
  send(game, s, run);
  softenFoe(game, ship, target!); // one of her first three fights (docs/23 item 81)
  return null;
}

/** docs/19 D7: «Атаковать» on a creature stack. A cable off, the boats go at once (the hex battle); farther, the helmsman
 *  sails her in and they go when she is there. Null when either is under way; else why not (said once, by the caller). */
export function startRoamRun(game: Game, s: PlayerSession, id: number): string | null {
  const ship = s.ship;
  if (!ship || !s.profile) return 'No ship';
  if (!ship.alive || ship.docked) return 'Not at sea';
  if (ship.boarding || ship.grappled) return 'Already locked in a boarding action';
  const why = roamRunWhy(game, s, id);
  if (why) return why;
  const p = roamWhereId(game, id)!;
  if (Math.hypot(p.x - ship.state.x, p.y - ship.state.y) <= ROAM_REACH) {
    if (runs.has(ship)) stopPursuit(game, s, 'board');
    return attackRoam(game, s, id);
  }
  if (autosailOf(ship)) stopAutosail(game, s, 'manual');
  if (runs.has(ship)) boardRun(game, s, ship, false);
  const run: Pursuit = { target: -1, roam: id, mode: 'board', since: game.now, helmAt: -Infinity, brain: newBrain(ship.id, 'pirate', game.now) };
  runs.set(ship, run);
  send(game, s, run);
  return null;
}

/** A run on a stack, a tick: in sight of it the helmsman sails her in; a cable off, the boats go. Any refusal there ends
 *  the run and is said once (not every tick). */
function stepRoamRun(game: Game, s: PlayerSession, ship: ShipEntity, run: Pursuit): void {
  const id = run.roam!;
  const why = roamRunWhy(game, s, id);
  if (why) {
    stopPursuit(game, s, 'off'); // (quietly: the refusal says why, once)
    game.refuse(s, why);
    return;
  }
  if (game.now - run.since > ROAM_RUN_MAX) {
    stopPursuit(game, s, 'lost');
    return;
  }
  if (game.now - run.helmAt < PURSUIT_RESUME) return; // her own hand on the helm
  const p = roamWhereId(game, id)!;
  const d = Math.hypot(p.x - ship.state.x, p.y - ship.state.y);
  if (d <= ROAM_REACH) {
    stopPursuit(game, s, 'board');
    const e = attackRoam(game, s, id);
    if (e) game.refuse(s, e);
    return;
  }
  // Full sail in with the boarding run's hands on the braces (as quick as a run for the grapples), easing the last
  // cable so she does not run past it.
  boardRun(game, s, ship, d < BOARD_RUN_FROM);
  helmTo(game, ship, run.brain, p.x, p.y, d < ROAM_REACH * 2 ? 0.6 : 1);
}

/** A mark for the auto-battle: one of the sea's ships on the ladder, `AUTO_WEAK_GAP` levels and more below hers. */
export function weakMark(ship: ShipEntity, target: ShipEntity): boolean {
  if (target.isPlayer || target.caravanId || !target.onLadder || !ship.onLadder || target.zoneBoss || target.named || target.namedMate || target.dutchman) return false;
  return ship.combatLevel - target.combatLevel >= AUTO_WEAK_GAP;
}

/** The wheel back to the captain, with the reason. */
export function stopPursuit(game: Game, s: PlayerSession, why: PursuitStop): void {
  const ship = s.ship;
  if (!ship || !runs.has(ship)) return;
  runs.delete(ship);
  boardRun(game, s, ship, false);
  ship.input = { rudder: 0, sailTarget: ship.input.sailTarget };
  send(game, s, null, why);
}

/** The captain's helm while the helmsman pursues: her hand (`helm`: the stick held, a key down) takes the wheel and
 *  the input goes through; let go, the ship holds her head until the helmsman has her back. True when swallowed. */
export function pursuitInput(game: Game, s: PlayerSession, rudder: number, sail: number, helm: boolean): boolean {
  const run = pursuitOf(s.ship);
  if (!run) return false;
  if (helm) {
    run.helmAt = game.now;
    return false;
  }
  void rudder;
  void sail;
  if (game.now - run.helmAt < PURSUIT_RESUME) s.ship!.input = { rudder: 0, sailTarget: s.ship!.input.sailTarget };
  return true;
}

/** The nearest ship hostile to her that she may fire on, within `r`. */
function nearestThreat(game: Game, ship: ShipEntity, r: number): ShipEntity | null {
  let best: ShipEntity | null = null, bd = r;
  game.forShipsNear(ship.state.x, ship.state.y, r, (o) => {
    if (o.id === ship.id || !o.alive || o.docked || o.sinkingUntil || o.ghost || o.surrendered || o.prize || o.grappled) return;
    if (!game.isHostile(o, ship) || damageBlocked(game, ship, o)) return;
    const d = Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  return best;
}

/** Every tick, after the NPCs think and before the ships move: each helmsman under «Атаковать» steers. */
export function stepPursuit(game: Game): void {
  const now = game.now;
  for (const s of game.sessions) {
    const ship = s.ship;
    const run = pursuitOf(ship);
    if (!ship || !run) continue;
    if (s.disconnectedAt !== null || !ship.alive || ship.docked) {
      stopPursuit(game, s, 'off');
      continue;
    }
    if (ship.boarding || ship.grappled || s.pendingBoarding) {
      stopPursuit(game, s, 'board');
      continue;
    }
    if (run.roam !== undefined) {
      stepRoamRun(game, s, ship, run);
      continue;
    }
    let t = game.ships.get(run.target);
    if (t?.surrendered && run.mode === 'guns') {
      stopPursuit(game, s, 'struck');
      continue;
    }
    if (!t || attackBlocked(game, ship, t)) {
      // Lost (sunk, gone, out of sight): the nearest threat is the next mark (docs/23 item 43).
      const next = nearestThreat(game, ship, RETARGET_R);
      if (!next) {
        stopPursuit(game, s, t && !t.alive ? 'sunk' : 'lost');
        continue;
      }
      t = next;
      run.target = next.id;
      run.since = now;
      run.auto = s.autoWeak && weakMark(ship, next) ? { left: 3, next: now + AUTO_WEAK_SEC / 3 } : undefined;
      send(game, s, run);
    }
    if (run.auto && autoBattle(game, ship, t, run)) continue;
    // No endless chases (docs/23 item 44): forty seconds and not a hit either way.
    const lastHit = Math.max(run.since, t.attackers.get(ship.id) ?? -Infinity, ship.attackers.get(t.id) ?? -Infinity);
    // (The First Watch's raider never slips away from her pupil nor strikes to her: she is the lesson, QA 2026-10-07.)
    if (now - lastHit > CHASE_GIVE_UP && !t.isPlayer && game.npcs.get(t.id)?.practice !== ship.id) {
      const brain = game.npcs.get(t.id);
      if (brain && !t.surrendered && (canStrike(t) || t.npcRole === 'merchant' || t.npcRole === 'fisher') && !brain.struck) {
        brain.struck = true;
        struck(game, t, brain, ship);
        if (run.mode === 'guns') stopPursuit(game, s, 'struck');
      } else {
        if (brain) brain.spared.set(ship.id, now + 120);
        stopPursuit(game, s, 'slipped');
      }
      continue;
    }
    if (now - run.helmAt < PURSUIT_RESUME) {
      // The captain's hand, or the moment after it: the boarding run (its −40% from every gun, its twice the way) is
      // the helmsman's closing for the grapples, not hers to sail off with (docs/23 item 94).
      boardRun(game, s, ship, false);
      continue;
    }
    const d = Math.hypot(t.state.x - ship.state.x, t.state.y - ship.state.y);
    if (wayRound(game, s, ship, run, t, d)) continue;
    if (run.mode === 'guns') {
      // The close fight (owner, 2026-10-07): in bow on to the band, then broadside on in it.
      const hold = pursuitHold(ship);
      run.closing = run.closing ? d > hold.best * CLOSE_TURN : d > hold.best * CLOSE_RUN;
      boardRun(game, s, ship, !!run.closing && d < BOARD_RUN_FROM);
      engageHelm(game, ship, run.brain, t, d, run.closing ? 'close' : 'guns', run.closing ? 180 / Math.max(6, ship.stats.maxSpeed) : 1, hold);
      continue;
    }
    // For the grapples she steers for where the mark will be when she gets there (the intercept at her own way).
    engageHelm(game, ship, run.brain, t, d, 'close', 180 / Math.max(6, ship.stats.maxSpeed));
    if (run.mode === 'board') {
      // Alongside she matches the mark's way herself (docs/23 item 54): no speed to judge on a phone.
      const reach = boardingRangeBetween(ship, t);
      // The boarding run (docs/23 item 36): every hand on the braces and the sweeps while she closes — twice her way,
      // a quick helm, and the wind no matter.
      boardRun(game, s, ship, d < BOARD_RUN_FROM && d > reach * 0.9);
      if (d < reach * 1.4) {
        const want = t.state.speed + (d > reach ? BOARD_CLOSE : 0.5);
        ship.input.sailTarget = ship.state.speed > want + 0.6 ? 0.25 : ship.state.speed < want - 0.6 ? 1 : 0.6;
      } else ship.input.sailTarget = 1;
    }
  }
}

/** Held fast (2026-10-09): under a knot for STUCK_SEC with her mark beyond a cable (a bay's pocket, a pier's slip, a
 *  reef's horns) — the planner's route from where she lies, sailed a while; held fast STUCK_GIVE_UP times running, or
 *  no way at all, the mark is lost. True when the route has the helm this tick (or the mark is lost). */
function wayRound(game: Game, s: PlayerSession, ship: ShipEntity, run: Pursuit, t: ShipEntity, d: number): boolean {
  const now = game.now;
  const { x, y } = ship.state;
  if (ship.state.speed * KNOTS_PER_SPEED < 1 && d > 200) {
    run.slowSince ??= now;
    if (now - run.slowSince > STUCK_SEC) {
      run.slowSince = now;
      run.stucks = (run.stucks ?? 0) + 1;
      if (run.stucks >= STUCK_GIVE_UP) {
        stopPursuit(game, s, 'lost');
        return true;
      }
      run.way = null;
      run.wayUntil = now + ROUND_HOLD;
    }
    run.movingSince = undefined;
  } else {
    run.slowSince = undefined;
    run.movingSince ??= now;
    if (now - run.movingSince > STUCK_CLEAR) run.stucks = 0;
  }
  if ((run.wayUntil ?? -Infinity) <= now || d < ROUND_FROM) {
    run.way = null;
    run.noWaySince = undefined;
    return false;
  }
  let way = run.way;
  if (!way || way.i >= way.path.length || (now - way.at > ROUND_EVERY && Math.hypot(way.tx - t.state.x, way.ty - t.state.y) > 250)) {
    const path = findPath(game.world, x, y, t.state.x, t.state.y, 20_000, hullWater(ship));
    if (!path || path.length < 2) {
      run.way = null;
      run.noWaySince ??= now;
      if (now - run.noWaySince > NO_WAY_SEC) {
        stopPursuit(game, s, 'lost');
        return true;
      }
      return false;
    }
    run.noWaySince = undefined;
    run.way = way = { path, i: 1, at: now, tx: t.state.x, ty: t.state.y };
  }
  // On to the farthest point of it she sees in clear water (a point behind her is not sailed back to).
  const wide = ship.stats.beam * 0.5 + 8;
  while (way.i < way.path.length - 1) {
    const [px, py] = way.path[way.i], [nx, ny] = way.path[way.i + 1];
    if (Math.hypot(px - x, py - y) < 160 || (lineFree(game.world, x, y, nx, ny) && !laneFoul(game, ship, x, y, nx, ny, wide))) way.i++;
    else break;
  }
  const [wx, wy] = way.path[way.i];
  // (The boarding run's hands on the braces as she closes, as on the straight run in.)
  boardRun(game, s, ship, d < BOARD_RUN_FROM && (run.mode === 'board' || !!run.closing));
  helmTo(game, ship, run.brain, wx, wy, 1);
  return true;
}

/** The boarding run on or off (pushed to her captain, whose helm reckons her way with it). */
function boardRun(game: Game, s: PlayerSession, ship: ShipEntity, on: boolean): void {
  const has = ship.hasEffect('board_run');
  if (on === has) return;
  if (on) ship.addEffect({ id: 'board_run', until: game.now + 60, mods: { ...BOARD_RUN }, flags: ['personal_wind'] }, game.now);
  else {
    ship.effects = ship.effects.filter((e) => e.id !== 'board_run');
    ship.recompute(game.now);
  }
  game.pushSelf(s, true);
}

/** Auto-battle (docs/23 item 46): three broadsides a second apart, and she is beaten — struck to the captain if she is
 *  one that strikes, sunk if not. True while it runs (the helm keeps still). */
function autoBattle(game: Game, ship: ShipEntity, t: ShipEntity, run: Pursuit): boolean {
  const a = run.auto!;
  if (game.now < a.next) return true;
  a.left--;
  a.next = game.now + AUTO_WEAK_SEC / 3;
  const brain = game.npcs.get(t.id);
  if (a.left > 0) {
    const hull = t.stats.hullMax * 0.35;
    applyDamage(game, t, { hull, crew: t.stats.crewMax * 0.12, sails: t.stats.sailHpMax * 0.1, morale: 15, laddered: true }, ship);
    game.emit({ k: 'hit', x: Math.round(t.state.x), y: Math.round(t.state.y), ship: t.id, dmg: Math.round(hull), ammo: 'round' }, t.state.x, t.state.y);
    return true;
  }
  run.auto = undefined;
  if (!t.alive || t.sinkingUntil) return false;
  if (brain && !t.surrendered && !brain.struck && (canStrike(t) || t.npcRole === 'merchant' || t.npcRole === 'fisher')) {
    brain.struck = true;
    struck(game, t, brain, ship);
  } else if (!t.surrendered && run.mode === 'board') {
    // «Атаковать» was to board her: one that will not strike is left a wreck for the grapples, not sunk with the prize
    // (docs/23 item 96).
    const hull = Math.max(0, t.hull - t.stats.hullMax * 0.1);
    if (hull > 0) applyDamage(game, t, { hull, crew: t.crew * 0.3, laddered: true }, ship);
  } else if (!t.surrendered) {
    applyDamage(game, t, { hull: t.hull + 1, laddered: true }, ship);
    game.emit({ k: 'hit', x: Math.round(t.state.x), y: Math.round(t.state.y), ship: t.id, dmg: Math.round(t.hull + 1), ammo: 'round' }, t.state.x, t.state.y);
  }
  return false;
}

// ------------------------------------------------------------------ the gun captains (auto-aim, auto-fire)

/** The ship her gunners lay on: her mark under «Атаковать», else the ship that struck her last (self-defence). */
export function gunneryMark(game: Game, ship: ShipEntity): ShipEntity | null {
  const run = pursuitOf(ship);
  const t = run && run.roam === undefined ? game.ships.get(run.target) : undefined;
  if (t && t.alive && !t.sinkingUntil && !t.surrendered && !damageBlocked(game, ship, t)) return t;
  let best: ShipEntity | null = null, bt = game.now - SELF_DEFENCE;
  for (const [id, at] of ship.attackers) {
    if (at < bt) continue;
    const o = game.ships.get(id);
    if (!o || !o.alive || o.sinkingUntil || o.docked || o.surrendered || damageBlocked(game, ship, o)) continue;
    if (Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) > PURSUIT_SIGHT) continue;
    bt = at;
    best = o;
  }
  return best;
}

/** The mark's lead from her, by the shot she has loaded. */
function leadOn(ship: ShipEntity, t: ShipEntity): { x: number; y: number; d: number; bearing: number } {
  const speed = AMMO[ship.ammoSel].speed * (1 + tval(ship.stats, 'shotSpeed'));
  const p = leadPoint(ship.state, t.state, speed);
  return { ...p, bearing: headingOf(p.x - ship.state.x, p.y - ship.state.y) };
}

/** Can she fire now at all (alive, at sea, not grappled, her colours flying)? */
function free(ship: ShipEntity): boolean {
  return ship.alive && !ship.docked && !ship.grappled && !ship.boarding && !ship.surrendered && !ship.sinkingUntil;
}

/** Every tick: the captains' gun crews with auto-fire on lay each loaded side on the mark as it bears; without the
 *  expert's hand the chasers too (docs/23 items 35, 42). */
export function stepAutoFire(game: Game): void {
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !free(ship)) continue;
    // «Атаковать» is the order to fire (its words: «пушки бьют, как только она в секторе»), whatever the switch — a desk's
    // auto-fire is off by default and its captain's pursuit fired nothing (owner, 2026-10-07); the expert fires herself.
    const run = pursuitOf(ship);
    if (!s.autoFire && !(run && run.roam === undefined && !s.expert)) continue;
    if (ship.reload.port > 0 && ship.reload.starboard > 0 && (s.expert || (ship.chaserReload.bow > 0 && ship.chaserReload.stern > 0))) continue;
    const t = gunneryMark(game, ship);
    if (!t) continue;
    if (ship.ammo[ship.ammoSel] <= 0 && ship.ammo.round > 0) ship.ammoSel = 'round';
    // Her prize (docs/23 item 47): run in to board, the gun captains do not sink the ship she means to take — below
    // PRIZE_HOLD of her hull they hold all but grape (the quick fight's guns would send her down before the grapples).
    if (run?.mode === 'board' && run.target === t.id && ship.ammoSel !== 'grape' && t.hull < t.stats.hullMax * PRIZE_HOLD) continue;
    const lead = leadOn(ship, t);
    for (const side of ['port', 'starboard'] as const) {
      if (ship.reload[side] > 0) continue;
      const off = Math.abs(angleDiff(sideHeading(ship, side), lead.bearing));
      // Inside the close fight's band only (owner, 2026-10-07): a volley thrown from the edge of her reach struck one
      // ball in two and left the side loading when the helmsman brought her in.
      if (off > AUTO_ARC_DEG * DEG || lead.d > closeRange(effectiveRange(ship, side, ship.ammoSel)).far) continue;
      if (!fireBroadside(game, ship, side, lead.d, lead, 1, {})) break; // one side a tick: the other answers the next
    }
    if (s.expert) continue;
    const offBow = Math.abs(angleDiff(ship.state.heading, lead.bearing));
    if (lead.d < effectiveRange(ship, 'port', 'round') * 1.2) {
      if (offBow < CHASER_CONE && ship.chaserReload.bow <= 0 && ship.cls.bowChasers) fireChaser(game, ship, 'bow', lead.x, lead.y, 1);
      else if (Math.PI - offBow < CHASER_CONE && ship.chaserReload.stern <= 0 && ship.cls.sternChasers) fireChaser(game, ship, 'stern', lead.x, lead.y, 1);
    }
  }
}

/** «Огонь» (docs/23 item 35): a broadside out of turn, laid by the captain herself and tighter, from the loaded side
 *  that bears best on her mark (or on the nearest hostile ship abeam). */
export function aimedVolley(game: Game, s: PlayerSession): string | null {
  const ship = s.ship;
  if (!ship || !free(ship)) return 'Cannot fire now';
  const t = gunneryMark(game, ship) ?? nearestThreat(game, ship, Math.max(effectiveRange(ship, 'port', ship.ammoSel), effectiveRange(ship, 'starboard', ship.ammoSel)));
  if (!t) return 'No ship in reach of your guns';
  const lead = leadOn(ship, t);
  const arc = (LAY_ARC_DEG + tval(ship.stats, 'gunTrain')) * DEG;
  let best: 'port' | 'starboard' | null = null, bo = Infinity, loaded = false;
  for (const side of ['port', 'starboard'] as const) {
    if (ship.reload[side] > 0) continue;
    loaded = true;
    const off = Math.abs(angleDiff(sideHeading(ship, side), lead.bearing));
    if (off <= arc && lead.d <= effectiveRange(ship, side, ship.ammoSel) && off < bo) {
      bo = off;
      best = side;
    }
  }
  if (!loaded) return 'Guns are still loading';
  if (!best) return 'She is not on your beam';
  return fireBroadside(game, ship, best, lead.d, lead, 1, { spread: AIMED_SPREAD });
}
