// The sea's own wars (owner, 2026-09-30, docs/16 P1: "bots must fight each other"). The rules of who goes for whom
// are npcHostileTo's (npc.ts): pirates for merchants and fishers, patrols and hunters for pirates (and the wanted),
// the Harpoon's whalers and hunters for the beasts, ghost ships for anyone, an escort for whoever goes for her
// merchant. This is what makes those fights happen where a captain can see them and what she can do about them:
//  * a merchant or fisher fired on by a raider calls for help — every captain within a few miles hears it, with
//    the bearing and the distance;
//  * a captain who sinks her attacker gets the victim's thanks: silver by the captain's own level (a rescue in the
//    shallows pays a veteran as well as one in the deep) and standing with her flag, a bounty on top where the
//    raider preyed on the low waters;
//  * a captain who joins in on the raiders' side is let be by them — and pays for it in infamy as for any attack
//    on a merchant;
//  * now and then the sea stages it: an idle rover about a captain goes for a merchant in her sight, a patrol near a
//    fight comes for the rover.
// Only the active ships (those near a captain) fight like this; the far ones keep to abstractEncounters.

import { dist } from '../../../shared/src/math.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import type { ShipEntity } from './ship.ts';

/** A captain within this hears a merchant's call. */
export const HELP_R = 5000;
/** How long a call stands. */
export const CALL_SEC = 150;
/** A raider sunk within this of the call's end still counts as the rescue. */
const GRACE = 30;
/** Low waters: a raider preying on a square this low carries a bounty. */
export const LOW_SECTOR = 3;
/** Seconds between two fights the sea stages about one captain. */
export const STIR_EVERY: [number, number] = [70, 130];

interface Call {
  victim: number;
  attacker: number;
  at: number;
  until: number;
  /** The sector's level where the call went up. */
  level: number;
}

interface WarState {
  calls: Map<number, Call>;
  /** `${raider}:${captain}` → until: a captain who fired on the raiders' prey sails with them. */
  joined: Map<string, number>;
  stirAt: Map<number, number>;
}

const states = new WeakMap<Game, WarState>();

function ws(game: Game): WarState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { calls: new Map(), joined: new Map(), stirAt: new Map() }));
  return s;
}

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

function bearingWord(fromX: number, fromY: number, x: number, y: number): string {
  const a = Math.atan2(x - fromX, -(y - fromY));
  return POINTS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

/** The call standing for a ship, if any. */
export function callOf(game: Game, victimId: number): Readonly<Call> | undefined {
  const c = ws(game).calls.get(victimId);
  return c && game.now < c.until + GRACE ? c : undefined;
}

/** What a rescue pays a captain: by her own level, so the shallows pay a veteran too; a bounty in the low waters. */
export function rescuePay(captainLevel: number, sectorLevel: number): { silver: number; bounty: number; rep: number } {
  const silver = Math.round(80 + captainLevel * 14);
  const bounty = sectorLevel <= LOW_SECTOR ? Math.round(silver * 0.5) : 0;
  return { silver, bounty, rep: 4 };
}

/**
 * A ship of the sea was hit (Game.npcOnDamaged). A merchant or fisher under a raider's guns calls for help; one under
 * a captain's guns while a raider is at her makes that captain the raiders' ally.
 */
export function onNpcHit(game: Game, victim: ShipEntity, source: ShipEntity): void {
  if (!victim.alive || (victim.npcRole !== 'merchant' && victim.npcRole !== 'fisher') || victim.caravanOf !== null) return;
  const S = ws(game);
  const now = game.now;
  if (source.isPlayer) {
    const c = callOf(game, victim.id);
    if (!c) return;
    const key = `${c.attacker}:${source.id}`;
    if (!S.joined.has(key)) {
      const raider = game.ships.get(c.attacker);
      if (raider?.alive) game.toastShip(source, `The raiders on ${raider.name} hold their fire: you are in this together.`, 'info');
    }
    S.joined.set(key, now + 180);
    return;
  }
  if (source.npcRole !== 'pirate' && source.npcRole !== 'ghost') return;
  const old = S.calls.get(victim.id);
  if (old && old.attacker === source.id && now < old.until) {
    old.until = now + CALL_SEC;
    return;
  }
  const level = sectorAt(game.world, victim.state.x, victim.state.y).level;
  S.calls.set(victim.id, { victim: victim.id, attacker: source.id, at: now, until: now + CALL_SEC, level });
  game.emit({ k: 'fx', fx: 'rocket', x: Math.round(victim.state.x), y: Math.round(victim.state.y) }, victim.state.x, victim.state.y);
  for (const s of game.sessions) {
    const sh = s.ship;
    if (!sh || !sh.alive || sh.docked || sh.id === source.id) continue;
    const d = dist(sh.state.x, sh.state.y, victim.state.x, victim.state.y);
    if (d > HELP_R) continue;
    const km = (d / 1000).toFixed(1), dir = bearingWord(sh.state.x, sh.state.y, victim.state.x, victim.state.y);
    game.toastShip(sh, source.npcRole === 'ghost'
      ? `${victim.name} is under attack by a ghost ship ${km} km off, bearing ${dir}: she calls for help!`
      : `${victim.name} is under attack by pirates ${km} km off, bearing ${dir}: she calls for help!`, 'gold');
  }
}

/** The raiders let be a captain who joined them on their prey (npcHostileTo). */
export function joinedRaid(game: Game, raider: ShipEntity, captain: ShipEntity): boolean {
  const until = ws(game).joined.get(`${raider.id}:${captain.id}`);
  return until !== undefined && game.now < until;
}

/** A ship went down (Game.beginSinking): if she was a raider on a merchant's call, the captains who fought her are
 *  paid and thanked. Returns how many captains were paid. */
export function raiderSunk(game: Game, sunk: ShipEntity): number {
  if (sunk.isPlayer) return 0;
  const S = ws(game);
  const now = game.now;
  let paid = 0;
  for (const [vid, c] of S.calls) {
    if (now > c.until + GRACE) {
      S.calls.delete(vid);
      continue;
    }
    if (c.attacker !== sunk.id) continue;
    S.calls.delete(vid);
    const victim = game.ships.get(vid);
    const helpers = new Set<PlayerSession>();
    for (const [aid, t] of sunk.attackers) {
      if (t < now - 120) continue;
      const a = game.ships.get(aid);
      const captain = a?.isPlayer ? a : a && a.ownerId !== null ? game.ships.get(a.ownerId) ?? null : null;
      if (!captain?.isPlayer) continue;
      // One who fired on the merchant too is no rescuer.
      if (victim && (victim.attackers.get(captain.id) ?? -999) > now - 180) continue;
      const s = game.sessionOf(captain);
      if (s?.profile) helpers.add(s);
    }
    for (const s of helpers) {
      const p = s.profile!;
      const pay = rescuePay(p.level, c.level);
      const total = pay.silver + pay.bounty;
      p.gold += total;
      game.db.ledger(s.accountId, 'rescue', total, victim?.name ?? 'merchant');
      const name = victim?.name ?? 'The merchant';
      game.toastShip(s.ship ?? null, `${name} dips her flag to you: ${pay.silver} silver for the rescue.`, 'gold');
      if (pay.bounty) game.toastShip(s.ship ?? null, `A bounty on raiders of the low waters: ${pay.bounty} silver more.`, 'gold');
      if (victim && victim.faction !== 'player' && FACTIONS[victim.faction]) game.adjustRepProfile(s, victim.faction, pay.rep);
      game.addRumor(sunk.state.x, sunk.state.y, `${s.name} drove the raiders off ${name} near ${game.nearestIslandName(sunk.state.x, sunk.state.y)}.`);
      paid++;
    }
  }
  return paid;
}

/** A merchant or fisher is gone (sunk, taken, sailed off): her call with her. */
export function callClosed(game: Game, id: number): void {
  ws(game).calls.delete(id);
}

/**
 * Now and then about a captain at sea in contested or lawless water, the sea stages a fight in her sight: an idle
 * rover goes for a merchant or fisher near her; a patrol near a rover at work comes for the rover. Called every
 * second from stepTraffic for the captains it tends. Returns what it did (for the tests).
 */
export function stirWars(game: Game, s: PlayerSession, novice: boolean, putRover?: (x: number, y: number, past: { x: number; y: number }) => ShipEntity | null): 'raid' | 'patrol' | null {
  const ship = s.ship;
  if (!ship || ship.docked || !ship.alive || novice) return null;
  const S = ws(game);
  const now = game.now;
  const due = S.stirAt.get(s.accountId);
  if (due === undefined) {
    S.stirAt.set(s.accountId, now + game.rng.range(STIR_EVERY[0] * 0.3, STIR_EVERY[1] * 0.5));
    return null;
  }
  if (now < due) return null;
  S.stirAt.set(s.accountId, now + game.rng.range(STIR_EVERY[0], STIR_EVERY[1]));
  const safety = REGIONS[ship.region].safety;
  // A patrol comes for a rover already at work near her.
  let rover: ShipEntity | null = null, patrol: ShipEntity | null = null;
  const prey: ShipEntity[] = [];
  game.forShipsNear(ship.state.x, ship.state.y, 3600, (o) => {
    if (!o.alive || o.docked || o.isPlayer || o.ownerId !== null || o.surrendered || o.prize) return;
    const b = game.npcs.get(o.id);
    if (!b || !b.active) return;
    if (o.npcRole === 'pirate' && !b.fireship) {
      const t = b.target !== null ? game.ships.get(b.target) : null;
      if (t && !t.isPlayer && (t.npcRole === 'merchant' || t.npcRole === 'fisher')) rover = o;
      else if (b.target === null && b.chase === null && !rover) rover = o;
    } else if (o.npcRole === 'patrol' && b.target === null && b.leader === undefined) patrol = o;
    else if ((o.npcRole === 'merchant' || o.npcRole === 'fisher') && o.caravanOf === null && !o.convoyId) prey.push(o);
  });
  const r = rover as ShipEntity | null, pt = patrol as ShipEntity | null;
  if (r && pt) {
    const rb = game.npcs.get(r.id)!;
    if (rb.target !== null) {
      game.npcs.get(pt.id)!.chase = { id: r.id, until: now + 180 };
      return 'patrol';
    }
  }
  if (safety === 'safe' || !prey.length) return null;
  // The prey nearest the rover (or the captain, when a rover must be put out for her).
  const from = r ?? ship;
  prey.sort((a, b) => dist(a.state.x, a.state.y, from.state.x, from.state.y) - dist(b.state.x, b.state.y, from.state.x, from.state.y));
  const m = prey[0];
  let raider = r;
  if (!raider && putRover) {
    // No rover about: one comes out of the haze beyond the merchant, from the far side of the captain.
    const dx = m.state.x - ship.state.x, dy = m.state.y - ship.state.y, l = Math.hypot(dx, dy) || 1;
    raider = putRover(m.state.x + (dx / l) * 1400, m.state.y + (dy / l) * 1400, { x: m.state.x, y: m.state.y });
    if (raider) {
      const b = game.npcs.get(raider.id);
      if (b) b.active = true;
    }
  }
  if (!raider) return null;
  const rb = game.npcs.get(raider.id);
  if (!rb || rb.target !== null) return null;
  rb.chase = { id: m.id, until: now + 200 };
  return 'raid';
}

/** Tests and the admin: forget the calls and the staging clocks. */
export function resetWars(game: Game): void {
  states.delete(game);
}
