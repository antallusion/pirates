// «Атаковать» (docs/23 phase 3, owner 2026-10-06: «бои должны быть проще, может какое-то автоматическое преследование
// сделать»). The captain names her mark and the ship does the rest: the helmsman closes in and either holds her best
// gun range broadside-on (`guns`) or runs straight in for the grapples and matches the mark's way (`board`); the gun
// captains lay every loaded broadside on the mark's lead as it bears (auto-fire); the bow and stern chasers speak for
// themselves. The captain's own hand on the helm takes the wheel at once, and the helmsman has it back 1.5 s after she
// lets go. Everything here is the server's (the client only names the mark and the mode): the helm the NPCs sail by
// (npc.ts engageHelm), the gunnery they lay by (combat.ts fireBroadside's laid volley). No dice of its own: the steering
// and the laying are exact, the balls' scatter is fireBroadside's.

import { AIMED_SPREAD, AUTO_ARC_DEG, BOARD_RUN, CHASE_GIVE_UP, LAY_ARC_DEG, leadPoint } from '../../../shared/src/data/gunnery.ts';
import { AMMO, CHASER_CONE } from '../../../shared/src/data/ships.ts';
import type { PursuitMode, PursuitStop } from '../../../shared/src/protocol.ts';
import { angleDiff, DEG, headingOf } from '../../../shared/src/math.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import { stopAutosail, autosailOf } from './autosail.ts';
import { boardingRangeBetween } from './boarding.ts';
import { applyDamage, damageBlocked, effectiveRange, fireBroadside, fireChaser, sideHeading } from './combat.ts';
import type { Game } from './Game.ts';
import { engageHelm, newBrain } from './npc.ts';
import type { NpcBrain } from './npc.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { softenFoe } from './firstfights.ts';
import { canStrike, struck } from './struck.ts';

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
/** The captains' self-defence: a ship that struck her within this many seconds is a mark for her gunners. */
const SELF_DEFENCE = 30;

export interface Pursuit {
  target: number;
  mode: PursuitMode;
  since: number;
  /** When the captain last had her hand on the helm (the helmsman waits PURSUIT_RESUME after it). */
  helmAt: number;
  /** The helmsman's memory of tacks and beats (the NPCs' steering keeps it on a brain). */
  brain: NpcBrain;
  /** Auto-battle against the weak: the broadsides still to come, and when the next one lands. */
  auto?: { left: number; next: number };
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
  game.sendTo(s, run ? { t: 'pursuit', on: true, target: run.target, mode: run.mode } : { t: 'pursuit', on: false, why: why ?? 'off' });
}

/** «Атаковать»: she takes `id` for her mark, to fight with the guns or to board. Null when the helmsman has her. */
export function startPursuit(game: Game, s: PlayerSession, id: number, mode: PursuitMode): string | null {
  const ship = s.ship;
  if (!ship || !s.profile) return 'No ship';
  const target = game.ships.get(id);
  const why = attackBlocked(game, ship, target);
  if (why) return why;
  if (autosailOf(ship)) stopAutosail(game, s, 'manual');
  const prev = runs.get(ship);
  const run: Pursuit = prev && prev.target === id
    ? { ...prev, mode }
    : { target: id, mode, since: game.now, helmAt: -Infinity, brain: newBrain(ship.id, 'pirate', game.now) };
  // Auto-battle against the weak (docs/23 item 46): a ship of the ladder two levels and more below hers.
  if (!run.auto && s.autoWeak && weakMark(ship, target!)) run.auto = { left: 3, next: game.now + AUTO_WEAK_SEC / 3 };
  runs.set(ship, run);
  send(game, s, run);
  softenFoe(game, ship, target!); // one of her first three fights (docs/23 item 81)
  return null;
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
    if (now - run.helmAt < PURSUIT_RESUME) continue; // the captain's hand, or the moment after it
    const d = Math.hypot(t.state.x - ship.state.x, t.state.y - ship.state.y);
    // For the grapples she steers for where the mark will be when she gets there (the intercept at her own way), for
    // the guns where the mark will be when a ball does.
    engageHelm(game, ship, run.brain, t, d, run.mode === 'board' ? 'close' : 'guns', run.mode === 'board' ? 180 / Math.max(6, ship.stats.maxSpeed) : 1);
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
  const t = run ? game.ships.get(run.target) : undefined;
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
    if (!ship || !s.autoFire || !free(ship)) continue;
    if (ship.reload.port > 0 && ship.reload.starboard > 0 && (s.expert || (ship.chaserReload.bow > 0 && ship.chaserReload.stern > 0))) continue;
    const t = gunneryMark(game, ship);
    if (!t) continue;
    if (ship.ammo[ship.ammoSel] <= 0 && ship.ammo.round > 0) ship.ammoSel = 'round';
    // Her prize (docs/23 item 47): run in to board, the gun captains do not sink the ship she means to take — below
    // PRIZE_HOLD of her hull they hold all but grape (the quick fight's guns would send her down before the grapples).
    const run = pursuitOf(ship);
    if (run?.mode === 'board' && run.target === t.id && ship.ammoSel !== 'grape' && t.hull < t.stats.hullMax * PRIZE_HOLD) continue;
    const lead = leadOn(ship, t);
    for (const side of ['port', 'starboard'] as const) {
      if (ship.reload[side] > 0) continue;
      const off = Math.abs(angleDiff(sideHeading(ship, side), lead.bearing));
      if (off > AUTO_ARC_DEG * DEG || lead.d > effectiveRange(ship, side, ship.ammoSel) * 0.98) continue;
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
