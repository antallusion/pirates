// NPC simulation with two levels of detail:
//  * abstract — far from every player: the ship slides along its cached route at cruise speed,
//    with statistical encounters (raids) instead of physics;
//  * active — near a player: full sailing physics, perception, tacking and combat AI.
// Every NPC has a purpose: merchants haul real cargo between real markets (docs/01 §5).

import { convoyFoe, raidEscort } from './raiding.ts';
import { joinedRaid } from './npcwars.ts';
import { BEASTS, beastOfClass } from '../../../shared/src/data/beasts.ts';
import { eliteShipLevel, hullsFor, npcSkill, shipLevelForCaptain, watersBand } from '../../../shared/src/data/shiplevel.ts';
import type { NpcSkill } from '../../../shared/src/data/shiplevel.ts';
import { NPC_ACTIVE_RADIUS, SPEED_SCALE, isNight } from '../../../shared/src/constants.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { AmmoId, Rig, ShipClassId } from '../../../shared/src/data/ships.ts';
import { CHASER_CONE } from '../../../shared/src/data/ships.ts';
import { angleDiff, clamp, DEG, dist, headingOf, headingVec, wrapAngle } from '../../../shared/src/math.ts';
import { polarEfficiency, relWindDeg, sailFloor, windPush } from '../../../shared/src/sim/sailing.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS, REGION_IDS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { depthAt, isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import { canBoard, startBoarding } from './boarding.ts';
import { npcWouldBoard } from './army.ts';
import { avoidPort } from './events.ts';
import { convoyArrived } from './empires.ts';
import { applyDamage, dash, effectiveRange, fireBroadside, fireChaser, igniteShip, sideHeading } from './combat.ts';
import { SURRENDER_WAIT, strikeColours, struck, surrenderClosed } from './struck.ts';
import { caravanSold } from './tradefx.ts';
import { coveAt, loseTrail, signature } from './smugglefx.ts';
import { applyTrade, bestRoute } from './economy.ts';
import type { Game } from './Game.ts';
import { findPath, pathLength, pointAlong } from './nav.ts';
import { formationOffset } from './fleet.ts';
import { pactNeutral } from './abyssfx.ts';
import type { Path } from './nav.ts';
import type { NpcRole, ShipEntity } from './ship.ts';
import { holdGuard } from './advmap.ts';
import { onboardingProtected } from './onboarding.ts';

export interface NpcBrain {
  id: number;
  tolled?: number; // the last island whose lighthouse took its toll
  tolledNode?: number; // the last route node whose holder took its toll
  role: NpcRole;
  active: boolean;
  farSince: number;
  path: Path | null;
  traveled: number; // abstract progress along path
  length: number;
  wp: number; // active waypoint index
  destPort: string | null;
  area: { x: number; y: number; r: number } | null; // patrol / hunting ground
  target: number | null;
  fleeFrom: number | null;
  nextThink: number;
  tackSide: number;
  tackUntil: number;
  /** Beating to a mark (docs/16 P5): the last moment she was (a beat lapsed 3 s starts afresh on the better tack), and
   *  her last going about. */
  beatAt?: number;
  tackAt?: number;
  surrenderedAt: number;
  /** She has struck her colours once in this life (docs/16 #3): having thought better of it, she fights on. */
  struck?: boolean;
  expiresAt: number;
  huntAccount: number | null;
  chase: { id: number; until: number } | null; // spotted from the crow's nest: pursue beyond detection range
  spared: Map<number, number>; // ship id -> until: plundered victims are left alone
  stuckCheck: { x: number; y: number; t: number };
  /** The First Watch's practice raider: she comes for this one novice even in safe water. */
  practice?: number;
  /** The practice raider's men the guns never cut below, so the turn-by-turn lesson after the boarding is a fight of a
   *  few turns and not one blow (the 2026-10-05 playthrough: the gunnery left her one man). */
  practiceFloor?: number;
  /** Dynamic combat (docs/11 P2): a pack member's side of approach (radians off the prey's heading), until when. */
  flank?: number;
  flankUntil?: number;
  /** A merchant's cargo thrown over the side to run lighter: how often, and when next. */
  dumped?: number;
  dumpAt?: number;
  /** A pirate lying in wait in fog or darkness. */
  ambushing?: boolean;
  /** A patrol's flagship and this ship's place in her line. */
  leader?: number;
  slot?: number;
  /** A fireship: the ship she steers for, burning, to lay herself alongside and blow up. */
  fireship?: number;
  /** Her captain's craft when it is not her level's (the balance sims' scripted captains, docs/12 §3.6). */
  skill?: NpcSkill;
}

const SHIP_NAMES = [
  'Saint Agnes', 'Grey Widow', 'Mercy of Hollowmere', 'Lantern Bride', 'Salt Psalm', 'Black Heron', 'Cold Comfort', 'Old Tithe',
  'Drowned Lamb', 'Gallows Rose', 'Iron Magpie', 'Bell of Gravesend', 'Quiet Ledger', 'Pale Regent', 'Sorrowful Dove', 'Brass Oath',
  'Rook', 'Veiled Hen', 'Covenant', 'Night Ferry', 'Blessed Anchor', 'Crooked Psalter', 'Wick and Tallow', 'Harrow Maid',
  'Last Supper', 'Ninth Bell', 'Hungry Tide', 'Fair Warning', 'Mourning Star', 'Ash Maiden', 'Red Shrike', 'Merrow', 'Silt Queen',
];
const CAPTAIN_NAMES = [
  'Aldous Crane', 'Bess Marlow', 'Cato Wrenfield', 'Dagny Holt', 'Esme Varga', 'Fenwick Pryce', 'Gideon Salt', 'Hester Lamb',
  'Ivo Maddox', 'Juno Blackwood', 'Kestrel Moor', 'Leda Frost', 'Magnus Tarrow', 'Nell Grimsby', 'Osric Vale', 'Petra Hale',
  'Quill Hawthorne', 'Rurik Ash', 'Silas Morrow', 'Tamsin Reed', 'Ulric Vane', 'Vesper Doyle', 'Wynn Carrow', 'Yara Stroud',
];

function pick<T>(game: Game, arr: T[]): T {
  return arr[Math.floor(game.rng.float() * arr.length)];
}

export function npcName(game: Game): { ship: string; captain: string } {
  return { ship: pick(game, SHIP_NAMES), captain: pick(game, CAPTAIN_NAMES) };
}

// ------------------------------------------------------------------ spawning

export function newBrain(id: number, role: NpcRole, now: number): NpcBrain {
  return {
    id, role, active: false, farSince: now, path: null, traveled: 0, length: 0, wp: 1, destPort: null, area: null, target: null,
    fleeFrom: null, nextThink: now, tackSide: 1, tackUntil: 0, surrenderedAt: 0, expiresAt: 0, huntAccount: null, chase: null, spared: new Map(),
    stuckCheck: { x: 0, y: 0, t: now },
  };
}

function cruiseSpeed(ship: ShipEntity): number {
  return ship.stats.maxSpeed * 0.62;
}

/** Load a merchant at `from` with the best-paying cargo for some destination. */
export function planMerchantVoyage(game: Game, ship: ShipEntity, brain: NpcBrain, from: Port): boolean {
  // Counting House caravans trade only between ports their owner has visited.
  const owner = ship.caravanOf !== null ? game.sessionByAccount(ship.caravanOf) : null;
  const ports = (owner?.profile ? game.world.ports.filter((p) => owner.profile!.regionsSeen.includes(`visited:${p.id}`)) : game.world.ports).filter((p) => game.inZone(p.x, p.y) && !avoidPort(game, p.id));
  const route = bestRoute(from, game.markets, ports, () => game.rng.float(), 38000);
  ship.caravanFrom = ship.caravanOf !== null ? from.id : null;
  ship.originPort = from.id;
  let dest: Port | undefined;
  if (route) {
    dest = game.portById(route.to);
    const market = game.markets.get(from.id)!;
    const gm = market.goods[route.good];
    if (gm && dest) {
      const room = ship.stats.holdVolume * 0.9 - cargoVolume(ship.cargo);
      const qty = Math.max(0, Math.floor(Math.min(room / GOODS[route.good].volume, gm.stock * 0.45)));
      if (qty > 0) {
        ship.cargo[route.good] = (ship.cargo[route.good] ?? 0) + qty;
        applyTrade(market, route.good, -qty);
      }
    }
  }
  if (!dest) {
    // No profitable route: sail in ballast to a random port nearby.
    const near = game.world.ports.filter((p) => p.id !== from.id && Math.hypot(p.x - from.x, p.y - from.y) < 30000 && game.inZone(p.x, p.y) && !avoidPort(game, p.id));
    if (!near.length) return false;
    dest = pick(game, near);
  }
  const path = game.routes.between(from, dest);
  if (!path) return false;
  setPath(brain, path);
  brain.destPort = dest.id;
  return true;
}

export function setPath(brain: NpcBrain, path: Path): void {
  brain.path = path;
  brain.traveled = 0;
  brain.length = pathLength(path);
  brain.wp = 1;
}

function randomPointIn(game: Game, area: { x: number; y: number; r: number }): [number, number] | null {
  for (let i = 0; i < 12; i++) {
    const a = game.rng.float() * Math.PI * 2, r = Math.sqrt(game.rng.float()) * area.r;
    const x = area.x + Math.sin(a) * r, y = area.y - Math.cos(a) * r;
    if (x < 3000 || y < 3000 || x > 93000 || y > 93000) continue;
    if (!isLand(game.world, x, y)) return [x, y];
  }
  return null;
}

export function planWander(game: Game, ship: ShipEntity, brain: NpcBrain): boolean {
  if (!brain.area) return false;
  const p = randomPointIn(game, brain.area);
  if (!p) return false;
  const path = findPath(game.world, ship.state.x, ship.state.y, p[0], p[1], 20000);
  if (!path) return false;
  setPath(brain, path);
  brain.destPort = null;
  return true;
}

// ------------------------------------------------------------------ hostility

export function npcHostileTo(game: Game, npc: ShipEntity, other: ShipEntity): boolean {
  if (npc.id === other.id || !other.alive || other.docked) return false;
  // The adventure map's guards (docs/17 H4): they bar a captain's way; the sea's own ships leave them be.
  if (npc.guardOf || other.guardOf) return !!npc.guardOf && other.isPlayer;
  const role = npc.npcRole;
  // The beasts of the sea (docs/12 P4): the predators hunt captains; the sea's ships and the beasts leave each other be.
  if (role === 'beast') return other.isPlayer && (beastPredator(npc, other) || (npc.attackers.get(other.id) ?? -999) > game.now - 120);
  // The Harpoon's whalers and the hunters go for the beasts they see (docs/16 P1).
  if (other.npcRole === 'beast') return (role === 'hunter' || npc.faction === 'harpoon') && npc.ownerId === null && !other.hasEffect('submerged');
  // A convoy's escort answers whoever fires on any of its ships; a merchant's escort, whoever fires on her.
  if (npc.convoyId !== undefined && convoyFoe(game, npc.convoyId, other)) return true;
  if (npc.escortOf !== undefined && ((game.ships.get(npc.escortOf)?.attackers.get(other.id) ?? -999) > game.now - 120)) return true;
  // ...and goes for a raider bearing down on her before the first shot (docs/16 P1).
  if (npc.escortOf !== undefined && !other.isPlayer && game.npcs.get(other.id)?.target === npc.escortOf) return true;
  // A caravan's escort answers whoever fires on any ship of it.
  if (npc.caravanId !== undefined && npc.npcRole === 'patrol') {
    for (const o of game.ships.values()) if (o.caravanId === npc.caravanId && (o.attackers.get(other.id) ?? -999) > game.now - 120) return true;
    return false;
  }
  // A hidden cove is neutral water for those who know it.
  if (other.isPlayer && other.hasFlag('cove_knowledge') && coveAt(game, other)) return false;
  // False Colors: law and bounty hunters see a merchant.
  if (other.hasFlag('false_colors') && (role === 'patrol' || role === 'hunter') && !(npc.attackers.get(other.id) ?? 0)) return false;
  if (npc.ownerId !== null) {
    // Escort: hostile to whoever is hostile to its owner.
    if (other.id === npc.ownerId || other.ownerId === npc.ownerId) return false;
    const owner = game.ships.get(npc.ownerId);
    return !!owner && (game.isHostile(other, owner) || owner.attackers.has(other.id) || other.attackers.has(owner.id));
  }
  if (game.npcs.get(npc.id)?.practice === other.id) return true;
  if (other.attackers.has(npc.id) && game.now - (npc.attackers.get(other.id) ?? -999) < 120) return true;
  if ((npc.attackers.get(other.id) ?? -999) > game.now - 120) return true;
  const safety = REGIONS[other.region].safety;
  if (other.isPlayer) {
    const p = game.profileOf(other);
    const wanted = other.wantedCache;
    switch (role) {
      case 'patrol':
        if (other.hasEffect('bribe_signal') && npc.faction !== 'harpoon') return false;
        return wanted >= 2 && (npc.faction === 'crown' || (npc.faction === 'league' && wanted >= 3) || (npc.faction === 'harpoon' && wanted >= 4));
      case 'hunter':
        return wanted >= 3;
      case 'pirate':
        // Sworn to the Code: the Brethren do not fire first.
        if (p?.oath === 'code') return false;
        // A lair's garrison (docs/16 #7) goes for any captain who comes to its island.
        if (npc.lairGuard && !other.surrendered) return true;
        // A captain who joined them on their prey sails with them for a while (docs/16 P1).
        if (joinedRaid(game, npc, other)) return false;
        // Under a friend's guns (docs/12 P6): only a pirate well above her dares.
        if (other.guardedUntil > game.now && npc.shipLevel < other.shipLevel + 2) return false;
        // Gold Fever: a hoard in the hold draws pirates even into safe water.
        if (safety === 'safe' && !p?.explore.hoardAboard) return false;
        if (p && (p.reputation.confederacy ?? 0) >= 30) return false;
        return !other.surrendered;
      case 'ghost':
        if (other.hasFlag('tattoo_dutchman') || other.hasFlag('fh_dutchman')) return false; // the Flying Dutchman's mark (docs/12 P9)
        return !pactNeutral(other, npc, game.now);
      case 'boss':
        return true;
      default:
        return false;
    }
  }
  // NPC vs NPC.
  const oRole = other.npcRole;
  switch (role) {
    case 'pirate':
      return (oRole === 'merchant' || oRole === 'fisher') && safety !== 'safe' && !other.surrendered;
    case 'patrol':
    case 'hunter':
      return oRole === 'pirate' || oRole === 'ghost';
    case 'ghost':
      return oRole !== 'ghost' && oRole !== 'boss';
    case 'boss':
      return oRole !== 'ghost' && oRole !== 'boss';
    default:
      return false;
  }
}

function detectionRange(game: Game, npc: ShipEntity, other: ShipEntity): number {
  let r = npc.stats.detection * signature(other);
  if (other.hasFlag('hidden')) return 230;
  if (other.hasFlag('dark_running')) r *= 0.4;
  if (other.hasFlag('lamplighter') && npc.npcRole === 'ghost') r *= 2; // the Lamplighter's lights draw the dead
  const w = game.weatherOf(other);
  if (w === 'fog') r *= 0.55;
  else if (w === 'rain' || w === 'storm') r *= 0.75;
  if (isNight(game.now)) r *= 0.8;
  return r;
}

// ------------------------------------------------------------------ per-tick update

export function updateNpc(game: Game, ship: ShipEntity, brain: NpcBrain, dt: number, nearestPlayerDist: number): void {
  const now = game.now;
  if (!ship.alive) return;
  if (ship.guardOf) return holdGuard(game, ship); // a guard of the adventure map stands where it is (docs/17 H4)
  if (brain.expiresAt && now > brain.expiresAt && nearestPlayerDist > 2500) {
    game.removeShip(ship.id);
    return;
  }
  if (ship.ownerId !== null && ship.removeAt && now > ship.removeAt) {
    game.toastShip(game.ships.get(ship.ownerId) ?? null, `${ship.name} signals farewell and bears away.`, 'info');
    game.removeShip(ship.id);
    return;
  }

  // LOD transitions.
  const wantActive = nearestPlayerDist < NPC_ACTIVE_RADIUS || ship.ownerId !== null;
  if (wantActive && !brain.active) promote(game, ship, brain);
  else if (!wantActive && brain.active) {
    if (nearestPlayerDist > NPC_ACTIVE_RADIUS * 1.25 && !ship.inCombat(now) && !ship.boarding) {
      if (now - brain.farSince > 8) demote(game, ship, brain);
    } else brain.farSince = now;
  } else if (wantActive) brain.farSince = now;

  if (!brain.active) {
    abstractStep(game, ship, brain, dt);
    return;
  }
  if (ship.boarding) return;
  if (ship.surrendered) {
    ship.input = { rudder: 0, sailTarget: 0 };
    if (!brain.surrenderedAt) brain.surrenderedAt = now;
    if (now - brain.surrenderedAt > SURRENDER_WAIT && !ship.lootLockedFor) {
      ship.surrendered = false;
      brain.surrenderedAt = 0;
      brain.fleeFrom = null;
      surrenderClosed(game, ship); // she thinks better of it: the card goes
    }
    return;
  }
  if (now >= brain.nextThink) {
    brain.nextThink = now + 0.25 + game.rng.float() * 0.1;
    think(game, ship, brain);
    // docs/19 D6: a merchant or a fisher on her way with nothing to run from looks about her half as often; a fighter
    // with no prey in sight a little less often.
    if (!ship.inCombat(now)) {
      // ...and out of the near water of every captain (beyond a kilometre) every one of them a little less often too.
      if (nearestPlayerDist > 1000 && nearestPlayerDist < Infinity && ship.ownerId === null) brain.nextThink += 0.2;
      if ((brain.role === 'merchant' || brain.role === 'fisher') && brain.fleeFrom === null) brain.nextThink += 0.3;
      else if (brain.target === null && !brain.chase && ship.ownerId === null && brain.leader === undefined) brain.nextThink += 0.3;
    }
  }
}

function promote(game: Game, ship: ShipEntity, brain: NpcBrain): void {
  brain.active = true;
  if (brain.path) {
    const p = pointAlong(brain.path, brain.traveled);
    ship.state.x = p.x;
    ship.state.y = p.y;
    ship.state.heading = p.heading;
    brain.wp = p.index;
  }
  ship.state.speed = cruiseSpeed(ship) * 0.8;
  ship.state.sail = 0.75;
  ship.input = { rudder: 0, sailTarget: 1 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

function demote(game: Game, ship: ShipEntity, brain: NpcBrain): void {
  brain.active = false;
  brain.target = null;
  brain.fleeFrom = null;
  const dest = brain.destPort ? game.portById(brain.destPort) : null;
  const path = dest ? findPath(game.world, ship.state.x, ship.state.y, dest.x, dest.y, 40000) : null;
  if (path) setPath(brain, path);
  else if (!planWander(game, ship, brain)) brain.path = null;
  game.grid.remove(ship.id);
}

function abstractStep(game: Game, ship: ShipEntity, brain: NpcBrain, dt: number): void {
  // Out of sight but on someone's trail (a gold trail, a hunt): steer the voyage toward them.
  if (brain.chase) {
    const c = game.ships.get(brain.chase.id);
    if (!c || !c.alive || c.docked || game.now > brain.chase.until) brain.chase = null;
    else if (game.now >= brain.nextThink) {
      brain.nextThink = game.now + 5;
      const path = findPath(game.world, ship.state.x, ship.state.y, c.state.x, c.state.y, 20000);
      if (path) setPath(brain, path);
    }
  }
  if (!brain.path) {
    if (!replan(game, ship, brain)) game.removeShip(ship.id);
    return;
  }
  brain.traveled += cruiseSpeed(ship) * SPEED_SCALE * dt;
  const p = pointAlong(brain.path, brain.traveled);
  ship.state.x = p.x;
  ship.state.y = p.y;
  ship.state.heading = p.heading;
  ship.state.speed = cruiseSpeed(ship);
  if (brain.traveled >= brain.length) arrive(game, ship, brain);
}

/** Arrival at the end of a path: merchants trade and re-plan, others pick a new leg. */
function arrive(game: Game, ship: ShipEntity, brain: NpcBrain): void {
  if (ship.caravanId) return; // a captain's caravan keeps its own route (caravans.ts)
  if (ship.convoyOf && brain.destPort === ship.convoyOf.to) return convoyArrived(game, ship);
  if (brain.destPort) {
    const port = game.portById(brain.destPort);
    const market = port ? game.markets.get(port.id) : undefined;
    if (port && market && ship.npcRole === 'merchant') {
      const from = ship.caravanFrom ? game.portById(ship.caravanFrom) : undefined;
      for (const id in ship.cargo) {
        const g = id as GoodId;
        const n = ship.cargo[g] ?? 0;
        if (n > 0 && from && market.goods[g]) caravanSold(game, ship, from, port, g, n);
        if (n > 0 && market.goods[g]) applyTrade(market, g, n);
        delete ship.cargo[g];
      }
      ship.purse = Math.min(3000, ship.purse + 80 + game.rng.int(0, 200));
      ship.hull = ship.stats.hullMax;
      ship.sails = ship.stats.sailHpMax;
      ship.crew = Math.max(ship.crew, Math.round(ship.stats.crewMax * 0.6));
      ship.surrendered = false;
      if (planMerchantVoyage(game, ship, brain, port)) return;
    }
  }
  if (!replan(game, ship, brain)) game.removeShip(ship.id);
}

function replan(game: Game, ship: ShipEntity, brain: NpcBrain): boolean {
  if (ship.npcRole === 'merchant' || ship.npcRole === 'fisher') {
    const port = game.nearestPort(ship.state.x, ship.state.y);
    if (!port) return false;
    if (ship.npcRole === 'merchant') return planMerchantVoyage(game, ship, brain, port);
  }
  return planWander(game, ship, brain);
}

// ------------------------------------------------------------------ active AI

/** How far a merchant or a fisher looks for danger (she runs from what is within 1.4 km). */
const CALM_LOOK = 1400;

function think(game: Game, ship: ShipEntity, brain: NpcBrain): void {
  const now = game.now;
  const role = brain.role;
  // Perception. docs/19 D6: a merchant or a fisher looks only for danger, and only as far as she would run from it
  // (1.4 km) — with the sea's ships twice as many, a look over the whole of her sight cost four times as much.
  const calm = role === 'merchant' || role === 'fisher';
  let threat: ShipEntity | null = null;
  let threatD = Infinity;
  let prey: ShipEntity | null = null;
  let preyD = Infinity;
  game.forShipsNear(ship.state.x, ship.state.y, calm ? Math.min(ship.stats.detection, CALM_LOOK) : ship.stats.detection, (o) => {
    if (o.id === ship.id || !o.alive || o.docked) return;
    if ((brain.spared.get(o.id) ?? 0) > now) return;
    const d = dist(ship.state.x, ship.state.y, o.state.x, o.state.y);
    if (d > detectionRange(game, ship, o)) return;
    if (!calm && npcHostileTo(game, ship, o) && d < preyD) {
      preyD = d;
      prey = o;
    }
    if (game.isHostile(o, ship) && d < threatD) {
      threatD = d;
      threat = o;
    }
  });
  if (brain.huntAccount !== null) {
    const hunted = game.shipOfAccount(brain.huntAccount);
    if (hunted && loseTrail(game, ship, hunted)) {
      brain.huntAccount = null; // the wake went cold
      brain.expiresAt = now + 60;
    } else if (hunted && hunted.alive && !hunted.docked) {
      prey = hunted;
      preyD = dist(ship.state.x, ship.state.y, hunted.state.x, hunted.state.y);
    }
  }
  // The First Watch's raider has one pupil: a merchantman passing nearer does not lure her off the lesson.
  if (brain.practice !== undefined) {
    const p = game.ships.get(brain.practice);
    if (p && p.alive && !p.docked && !p.hasFlag('hidden')) {
      prey = p;
      preyD = dist(ship.state.x, ship.state.y, p.state.x, p.state.y);
    }
  }
  // A fighter at work on one of the sea's ships keeps to her (docs/16 P1): a captain sailing nearer does not lure her
  // off it, unless that captain fires on her.
  {
    const focusId = brain.target ?? brain.chase?.id ?? null;
    const f = focusId !== null && focusId !== (prey as ShipEntity | null)?.id ? game.ships.get(focusId) : undefined;
    const p = prey as ShipEntity | null;
    if (f && p && !f.isPlayer && f.alive && !f.docked && npcHostileTo(game, ship, f) && (ship.attackers.get(p.id) ?? -999) < now - 60) {
      const fd = dist(ship.state.x, ship.state.y, f.state.x, f.state.y);
      if (fd < ship.stats.detection * 1.3) {
        prey = f;
        preyD = fd;
      }
    }
  }
  if (!prey && brain.chase) {
    const c = game.ships.get(brain.chase.id);
    if (!c || !c.alive || c.docked || now > brain.chase.until || !npcHostileTo(game, ship, c) || c.hasFlag('hidden')) brain.chase = null;
    else {
      prey = c;
      preyD = dist(ship.state.x, ship.state.y, c.state.x, c.state.y);
    }
  }

  // Ships lashed in a boarding are out of the fight until it is over: no one hunts them or flees from them.
  if (prey && (prey as ShipEntity).grappled && ship.boarding?.with !== (prey as ShipEntity).id) prey = null;
  if (threat && (threat as ShipEntity).grappled) threat = null;

  if (brain.fireship !== undefined) {
    fireshipThink(game, ship, brain);
    return;
  }
  // A prize under a prize crew keeps station astern of her captor and never fights.
  if (ship.prize) {
    const owner = ship.ownerId !== null ? game.ships.get(ship.ownerId) : undefined;
    if (owner) {
      const d = dist(ship.state.x, ship.state.y, owner.state.x, owner.state.y);
      const behind = headingVec(owner.state.heading + Math.PI);
      const px = owner.state.x + behind.x * 220, py = owner.state.y + behind.y * 220;
      steer(game, ship, brain, headingOf(px - ship.state.x, py - ship.state.y), d > 400 ? 1 : d > 250 ? 0.75 : 0.25);
    }
    return;
  }
  const peaceful = role === 'merchant' || role === 'fisher';
  if (peaceful) {
    const danger = (threat ?? (brain.fleeFrom !== null ? game.ships.get(brain.fleeFrom) ?? null : null)) as ShipEntity | null;
    if (danger && dist(ship.state.x, ship.state.y, danger.state.x, danger.state.y) < 1400) {
      const beaten = ship.hull < ship.stats.hullMax * 0.35 || ship.crew < ship.stats.crewMax * 0.3 || ship.sails < ship.stats.sailHpMax * 0.25;
      if (beaten && ship.inCombat(now)) {
        struck(game, ship, brain, danger); // the card to the captain on her (docs/16 #3)
        return;
      }
      const away = headingOf(ship.state.x - danger.state.x, ship.state.y - danger.state.y);
      if (role === 'merchant') runLighter(game, ship, brain, danger);
      steer(game, ship, brain, away, 1);
      return;
    }
    brain.fleeFrom = null;
    followPath(game, ship, brain);
    return;
  }

  // Fighters. Battered past bearing and outgunned by a captain on her, she strikes her colours (docs/16 #3).
  if (strikeColours(game, ship, brain, (prey ?? threat) as ShipEntity | null)) return;
  const lowHull = ship.hull < ship.stats.hullMax * (ship.fleeAt ?? 0.22); // a named coward runs sooner, a brute never
  if (role === 'pirate' && lowHull && prey) {
    const away = headingOf(ship.state.x - (prey as ShipEntity).state.x, ship.state.y - (prey as ShipEntity).state.y);
    steer(game, ship, brain, away, 1);
    return;
  }
  if (prey) {
    const p = prey as ShipEntity;
    // Out of the fog: the first broadside from hiding is the ambush's (Shadow Strike); then she shows herself.
    if (brain.ambushing) {
      brain.ambushing = false;
      ship.effects = ship.effects.filter((e) => e.id !== 'ambush');
      ship.addEffect({ id: 'ambush', until: now + 8, flags: ['shadow_strike'] }, now);
    }
    // (no wolf pack round the First Watch's lesson, nor round a captain still in it)
    if (role === 'pirate' && brain.target !== p.id && p.isPlayer && brain.practice === undefined && !inFirstWatch(game, p)) rallyPack(game, ship, p);
    brain.target = p.id;
    engage(game, ship, brain, p, preyD);
    return;
  }
  brain.target = null;
  brain.flank = undefined;
  // In fog or darkness a pirate lies low and waits for a sail to come to her.
  if (role === 'pirate' && !ship.prize && (game.weatherOf(ship) === 'fog' || isNight(now))) {
    if (!brain.ambushing) {
      brain.ambushing = true;
      ship.addEffect({ id: 'ambush', until: now + 900, flags: ['dark_running', 'shadow_strike'] }, now);
    }
    const path = brain.path;
    const [wx, wy] = path && brain.wp < path.length ? path[brain.wp] : [ship.state.x, ship.state.y];
    steer(game, ship, brain, headingOf(wx - ship.state.x, wy - ship.state.y), 0.15);
    return;
  }
  if (brain.ambushing) {
    brain.ambushing = false;
    ship.effects = ship.effects.filter((e) => e.id !== 'ambush');
    ship.recompute(now);
  }
  // A patrol keeps her place in the flagship's line.
  if (brain.leader !== undefined) {
    const lead = game.ships.get(brain.leader);
    if (lead && lead.alive && !lead.docked) {
      const side = (brain.slot ?? 1) % 2 ? -1 : 1;
      const f = headingVec(lead.state.heading), r = headingVec(lead.state.heading + Math.PI / 2);
      const back = 170 * Math.ceil((brain.slot ?? 1) / 2), across = 110 * side;
      const tx = lead.state.x - f.x * back + r.x * across, ty = lead.state.y - f.y * back + r.y * across;
      const d = dist(ship.state.x, ship.state.y, tx, ty);
      steer(game, ship, brain, d > 60 ? headingOf(tx - ship.state.x, ty - ship.state.y) : lead.state.heading, d > 300 ? 1 : d > 120 ? 0.8 : Math.max(0.3, lead.state.sail));
      return;
    }
    brain.leader = undefined;
  }
  if (ship.ownerId !== null) {
    const owner = game.ships.get(ship.ownerId);
    if (owner) {
      // Keep station in the flagship's formation (hired escorts), or astern of her.
      const off = ship.fleetId ? formationOffset(owner.formation, ship.escortIndex) : { x: 0, y: -140 };
      const f = headingVec(owner.state.heading), r = headingVec(owner.state.heading + Math.PI / 2);
      const tx = owner.state.x + f.x * off.y + r.x * off.x, ty = owner.state.y + f.y * off.y + r.y * off.x;
      const d = dist(ship.state.x, ship.state.y, tx, ty);
      // Close up fast when out of station; match the flagship's heading once there.
      const want = d > 60 ? headingOf(tx - ship.state.x, ty - ship.state.y) : owner.state.heading;
      steer(game, ship, brain, want, d > 300 ? 1 : d > 120 ? 0.8 : Math.max(0.3, owner.state.sail));
      return;
    }
  }
  followPath(game, ship, brain);
}

function followPath(game: Game, ship: ShipEntity, brain: NpcBrain): void {
  const path = brain.path;
  if (!path || brain.wp >= path.length) {
    arrive(game, ship, brain);
    return;
  }
  const [wx, wy] = path[brain.wp];
  const d = dist(ship.state.x, ship.state.y, wx, wy);
  if (d < 260) {
    brain.wp++;
    if (brain.wp >= path.length) {
      arrive(game, ship, brain);
      return;
    }
  }
  // Keep abstract progress roughly in sync for a clean demotion.
  brain.traveled = Math.min(brain.length, brain.traveled + ship.state.speed * SPEED_SCALE * 0.3);
  steer(game, ship, brain, headingOf(wx - ship.state.x, wy - ship.state.y), 1);
}

function chooseAmmo(ship: ShipEntity, target: ShipEntity, d: number, wantsBoard: boolean): AmmoId {
  const has = (a: AmmoId) => ship.ammo[a] > 0;
  const inRange = (a: AmmoId) => d < Math.max(effectiveRange(ship, 'port', a), effectiveRange(ship, 'starboard', a)) * 0.95;
  if (wantsBoard && has('grape') && inRange('grape') && target.crew > target.stats.crewMax * 0.35) return 'grape';
  if (wantsBoard && has('chain') && inRange('chain') && target.sails > target.stats.sailHpMax * 0.45) return 'chain';
  if (has('round')) return 'round';
  return has('chain') ? 'chain' : 'grape';
}

export function engage(game: Game, ship: ShipEntity, brain: NpcBrain, target: ShipEntity, d: number): void {
  // Pirates want the cargo, so they cripple and board; everyone else fights to sink.
  const wantsBoard = brain.role === 'pirate';
  ship.ammoSel = chooseAmmo(ship, target, d, wantsBoard);
  // The First Watch's raider is a lesson, not a massacre: she closes as a pirate does (the pupil's grapples must reach
  // her) but never throws her own (she boarded, won and robbed a novice every 90 s, the lesson's gunnery never done).
  if (wantsBoard && brain.practice === undefined && canBoard(game, ship, target) === null && npcWouldBoard(game, ship, target)) {
    startBoarding(game, ship, target, 'standard');
    return;
  }
  const rangeOf = (side: 'port' | 'starboard') => effectiveRange(ship, side, ship.ammoSel);
  const maxRange = Math.max(rangeOf('port'), rangeOf('starboard'));
  const bearing = headingOf(target.state.x - ship.state.x, target.state.y - ship.state.y);
  // Her craft by her level (docs/12 §3.3): how much of the lead she allows, how wide she lets fly, her tricks.
  const sk = brain.skill ?? npcSkill(ship.shipLevel);
  // Lead the target by the ball's flight time (a green gunner allows only part of it).
  // (The shot and the ship both go SPEED_SCALE times as fast across the world, so the lead is as it was.)
  const flight = (d / 180) * sk.lead;
  const tv = headingVec(target.state.heading);
  const px = target.state.x + tv.x * target.state.speed * flight;
  const py = target.state.y + tv.y * target.state.speed * flight;
  const leadD = dist(ship.state.x, ship.state.y, px, py);
  const leadBearing = headingOf(px - ship.state.x, py - ship.state.y);
  const weakened = target.surrendered || target.sails < target.stats.sailHpMax * 0.4 || target.crew < target.stats.crewMax * 0.5 || target.hull < target.stats.hullMax * 0.55;

  // A pack member comes round to her own side of the prey before she opens fire.
  if (brain.flank !== undefined && (brain.flankUntil ?? 0) > game.now && d > maxRange * 0.7) {
    const side = headingVec(target.state.heading + brain.flank);
    const fx = target.state.x + side.x * maxRange * 0.75, fy = target.state.y + side.y * maxRange * 0.75;
    // Her quarter dead to windward (docs/16 P5): beating round to it would cost more than it wins, so she goes
    // straight in.
    if (relWindDeg(headingOf(fx - ship.state.x, fy - ship.state.y), game.windFor(ship)) < FLANK_UPWIND_DEG) brain.flank = undefined;
    else if (dist(ship.state.x, ship.state.y, fx, fy) > 180) {
      steer(game, ship, brain, headingOf(fx - ship.state.x, fy - ship.state.y), 1);
      return;
    }
  }
  if (d > maxRange * 1.5) {
    steer(game, ship, brain, bearing, 1);
  } else if (wantsBoard && weakened) {
    steer(game, ship, brain, leadBearing, d < 250 ? 0.75 : 1); // close for the grapple
  } else {
    // Present a loaded broadside, spiralling in or out to hold the ideal distance.
    const hPort = wrapAngle(bearing + Math.PI / 2); // target on our port beam
    const hStar = wrapAngle(bearing - Math.PI / 2);
    const score = (side: 'port' | 'starboard', h: number) =>
      Math.abs(angleDiff(ship.state.heading, h)) + (ship.reload[side] > 0 ? 1.2 : 0) + (rangeOf(side) < d * 0.9 ? 0.8 : 0);
    const side = score('port', hPort) <= score('starboard', hStar) ? 'port' : 'starboard';
    let desired = side === 'port' ? hPort : hStar;
    const inward = side === 'port' ? -1 : 1; // rotation that turns the bow toward the target
    // Boarders fight at chain-shot range to strip the rigging; others at their gun's comfortable range.
    const range = wantsBoard ? Math.min(rangeOf(side), effectiveRange(ship, side, 'chain')) : rangeOf(side);
    if (d > range) desired = wrapAngle(desired + inward * 0.85);
    else if (d > range * 0.75) desired = wrapAngle(desired + inward * 0.4);
    else if (d < range * 0.35 && !wantsBoard) desired = wrapAngle(desired - inward * 0.35);
    steer(game, ship, brain, desired, 1, true);
  }
  for (const side of ['port', 'starboard'] as const) {
    if (ship.reload[side] > 0) continue;
    const off = Math.abs(angleDiff(sideHeading(ship, side), leadBearing));
    if (off < sk.arcDeg * DEG && leadD < rangeOf(side) * 0.98) fireBroadside(game, ship, side, leadD * (1 + (game.rng.float() * 2 - 1) * sk.rangeErr), undefined, 1); // the sea's own gunners know their wind and allow for it
  }
  // A seasoned captain dashes out of a broadside held on her.
  if (sk.dash && d < 700 && (target.aimStart.port >= 0 || target.aimStart.starboard >= 0) && game.rng.chance(0.2)) dash(game, ship);
  // Chasers: pursuers fire from the bow, the pursued from the stern.
  const chaseRange = effectiveRange(ship, 'port', 'round') * 1.2;
  if (leadD < chaseRange) {
    const offBow = Math.abs(angleDiff(ship.state.heading, leadBearing));
    if (offBow < CHASER_CONE && ship.chaserReload.bow <= 0 && ship.cls.bowChasers) fireChaser(game, ship, 'bow', px, py, 1);
    else if (Math.PI - offBow < CHASER_CONE && ship.chaserReload.stern <= 0 && ship.cls.sternChasers) fireChaser(game, ship, 'stern', px, py, 1);
  }
}

/** The best angle off the wind to beat at (degrees from where it blows), by rig, no-go edge and wind: the heading that
 *  makes the most ground to windward. The sea's floor under the polar (no heading is dead, sailing.ts) and the head
 *  wind's push make it narrower than the no-go edge: a ship pinches up well inside it rather than reaching off along
 *  the edge (docs/16 P5). Cached; 0 means straight at it. */
const beatCache = new Map<string, number>();
export function beatAngle(rig: Rig, noGoDeg: number, weatherly: boolean, strength: number): number {
  const key = `${rig}|${Math.round(noGoDeg)}|${weatherly ? 1 : 0}|${Math.round(strength * 20)}`;
  let best = beatCache.get(key);
  if (best !== undefined) return best;
  let bv = -Infinity;
  best = 0;
  for (let rel = 0; rel <= 90; rel += 2) {
    const eff = Math.max(sailFloor(rel), polarEfficiency(rig, rel, noGoDeg, weatherly));
    const vmg = eff * windPush(rel, strength) * Math.cos(rel * DEG);
    if (vmg > bv + 1e-9) {
      bv = vmg;
      best = rel;
    }
  }
  beatCache.set(key, best);
  return best;
}

/** Steering with tacking and island avoidance. To windward (docs/16 P5): on the tack that points nearer her mark,
 *  held until the other tack points clearly nearer (the mark has crossed the wind's eye), then about. */
function steer(game: Game, ship: ShipEntity, brain: NpcBrain, desired: number, sail: number, fight = false): void {
  const now = game.now;
  const wind = game.windFor(ship);
  const rel = relWindDeg(desired, wind);
  const from = wrapAngle(wind.dir + Math.PI);
  if (fight) {
    // Holding a broadside on her foe: she keeps off the no-go edge and zig-zags as she always did (the ladder of
    // levels is tuned on this, tests/balance/).
    const noGo = ship.stats.noGoDeg + 6;
    if (rel < noGo) {
      if (now > brain.tackUntil) {
        const a = wrapAngle(from + noGo * DEG), b = wrapAngle(from - noGo * DEG);
        const stillBeating = now - brain.tackUntil < 3;
        brain.tackSide = stillBeating ? -brain.tackSide : Math.abs(angleDiff(a, desired)) < Math.abs(angleDiff(b, desired)) ? 1 : -1;
        brain.tackUntil = now + 22 + game.rng.float() * 10;
      }
      desired = wrapAngle(from + brain.tackSide * noGo * DEG);
    }
  } else {
    // Going somewhere (docs/16 P5): a mark inside her best beat is made good on the tack that points nearer it,
    // held until the other tack points clearly nearer (the mark has crossed the wind's eye), then about.
    const beat = beatAngle(ship.cls.rig, ship.stats.noGoDeg, ship.cls.passive.id === 'weatherly', wind.strength);
    if (beat > 0 && rel < beat) {
      const a = wrapAngle(from + beat * DEG), b = wrapAngle(from - beat * DEG);
      const offA = Math.abs(angleDiff(a, desired)), offB = Math.abs(angleDiff(b, desired));
      const better = offA <= offB ? 1 : -1;
      // A fresh beat (none within 3 s) starts on the better tack; one under way comes about only when the other tack
      // points 12° nearer, and not within 6 s of the last time (her way must come back first).
      const fresh = now - (brain.beatAt ?? -Infinity) > 3;
      if (fresh) brain.tackSide = better;
      else if (better !== brain.tackSide && Math.abs(offA - offB) > 12 * DEG && now - (brain.tackAt ?? -Infinity) > 6) {
        brain.tackSide = better;
        brain.tackAt = now;
      }
      brain.beatAt = now;
      desired = brain.tackSide > 0 ? a : b;
    }
  }
  // Island avoidance probes.
  const look = 180 + ship.state.speed * 7;
  const probe = (h: number) => {
    const v = headingVec(h);
    const x1 = ship.state.x + v.x * look, y1 = ship.state.y + v.y * look;
    const x2 = ship.state.x + v.x * look * 0.5, y2 = ship.state.y + v.y * look * 0.5;
    if (ship.cls.passive.id === 'shallow_runner') return !!isLand(game.world, x1, y1) || !!isLand(game.world, x2, y2);
    const draft = ship.cls.draft;
    return depthAt(game.world, x1, y1) < draft || depthAt(game.world, x2, y2) < draft;
  };
  if (probe(desired)) {
    for (const off of [0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4]) {
      if (!probe(desired + off)) {
        desired = wrapAngle(desired + off);
        break;
      }
    }
  }
  // Stuck detection: if we barely moved in 20 s, reverse a bit and replan.
  if (now - brain.stuckCheck.t > 20) {
    const moved = dist(ship.state.x, ship.state.y, brain.stuckCheck.x, brain.stuckCheck.y);
    brain.stuckCheck = { x: ship.state.x, y: ship.state.y, t: now };
    if (moved < 40 && !ship.surrendered && brain.target === null) {
      ship.state.heading = wrapAngle(ship.state.heading + Math.PI * 0.6);
      if (brain.destPort) {
        const dest = game.portById(brain.destPort);
        const path = dest ? findPath(game.world, ship.state.x, ship.state.y, dest.x, dest.y, 40000) : null;
        if (path) setPath(brain, path);
      } else planWander(game, ship, brain);
    }
  }
  const diff = angleDiff(ship.state.heading, desired);
  ship.input = { rudder: clamp(diff * 2.2, -1, 1), sailTarget: sail };
}

/** A captain still in the First Watch (docs/07 §13): the lesson's own raider only. */
function inFirstWatch(game: Game, ship: ShipEntity): boolean {
  return onboardingProtected(game.sessionOf(ship) ?? null);
}

/** A pack member's swing round to her quarter of the prey lasts this long at most (then she goes straight in), and
 *  is not tried at all for a quarter this near the wind's eye (docs/16 P5). */
export const FLANK_SEC = 60;
export const FLANK_UPWIND_DEG = 45;

/** A wolf pack: a pirate that goes for a captain calls up to two idle pirates within 3 km; they come round to
 *  her quarters from either side while the first closes from where she is. */
export function rallyPack(game: Game, ship: ShipEntity, prey: ShipEntity): number {
  const now = game.now;
  const sides = [1.9, -1.9];
  let n = 0;
  game.forShipsNear(ship.state.x, ship.state.y, 3000, (o) => {
    if (n >= sides.length || o.id === ship.id || !o.alive || o.docked || o.prize || o.surrendered) return;
    const b = game.npcs.get(o.id);
    if (!b || b.role !== 'pirate' || b.target !== null || o.hull < o.stats.hullMax * 0.4) return;
    b.active = true;
    b.target = prey.id;
    b.chase = { id: prey.id, until: now + 120 };
    b.flank = sides[n];
    b.flankUntil = now + FLANK_SEC;
    b.ambushing = false;
    n++;
  });
  if (n > 0) game.toastShip(prey, 'A pirate pack closes in — sails on both quarters!', 'bad');
  // Outside safe water a pack may send a fireship ahead of it.
  if (REGIONS[prey.region].safety !== 'safe' && game.rng.chance(0.3)) spawnFireship(game, prey);
  return n;
}

/** A fireship: a small hull packed with powder and set alight, steered at a captain to lay herself alongside and
 *  blow up. Sink her before she arrives. */
export function spawnFireship(game: Game, prey: ShipEntity): ShipEntity | null {
  // From windward, as fireships always came: she runs down on her mark before the wind.
  const from = wrapAngle(game.windFor(prey).dir + Math.PI);
  for (let i = 0; i < 8; i++) {
    const a = from + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.35;
    // Far enough off that a captain at the pace of the sea still has time to sink her.
    const x = prey.state.x + Math.sin(a) * 2000, y = prey.state.y - Math.cos(a) * 2000;
    if (depthAt(game.world, x, y) < 6) continue;
    const ship = game.spawnNpcShip('pirate', 'sloop', 'free', x, y, headingOf(prey.state.x - x, prey.state.y - y), { ship: 'Fireship', captain: 'No One' });
    const brain = game.npcs.get(ship.id)!;
    brain.active = true;
    brain.fireship = prey.id;
    brain.chase = { id: prey.id, until: game.now + 150 };
    ship.cargo = { gunpowder: 20 };
    ship.crew = Math.max(ship.stats.crewMin, Math.round(ship.crew * 0.6)); // a skeleton crew to steer her in and take to the boats
    igniteShip(game, ship, 150, null);
    // Her boats tow her on and the blaze makes its own draught: she keeps her way whatever the wind.
    ship.addEffect({ id: 'fireship', until: game.now + 1e9, flags: ['personal_wind'] }, game.now);
    game.grid.upsert(ship.id, x, y);
    game.toastShip(prey, 'A fireship bears down on you — sink her before she strikes!', 'bad');
    return ship;
  }
  return null;
}

/** The fireship steers for her mark; alongside, she blows up. With her mark gone she burns out and sinks. */
function fireshipThink(game: Game, ship: ShipEntity, brain: NpcBrain): void {
  const mark = game.ships.get(brain.fireship!);
  if (!mark || !mark.alive || mark.docked) {
    ship.hull = 0;
    game.beginSinking(ship);
    return;
  }
  const d = dist(ship.state.x, ship.state.y, mark.state.x, mark.state.y);
  if (d < (ship.stats.beam + mark.stats.beam) / 2 + 16) {
    fireshipBlows(game, ship);
    return;
  }
  // Lead her mark a little, and never strike sail.
  const tv = headingVec(mark.state.heading);
  const t = Math.min(6, d / (Math.max(3, ship.state.speed + 1) * SPEED_SCALE));
  steer(game, ship, brain, headingOf(mark.state.x + tv.x * mark.state.speed * SPEED_SCALE * t - ship.state.x, mark.state.y + tv.y * mark.state.speed * SPEED_SCALE * t - ship.state.y), 1);
}

/** The powder goes up: every hull within 80 m is holed, set alight and loses men; the fireship is gone. */
export function fireshipBlows(game: Game, ship: ShipEntity): void {
  game.emit({ k: 'fx', fx: 'explosion', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 70 }, ship.state.x, ship.state.y);
  game.forShipsNear(ship.state.x, ship.state.y, 80, (o) => {
    if (o.id === ship.id || !o.alive || o.docked) return;
    if (dist(o.state.x, o.state.y, ship.state.x, ship.state.y) > 80) return;
    applyDamage(game, o, { hull: o.stats.hullMax * 0.14, sails: o.stats.sailHpMax * 0.2, crew: Math.round(o.crew * 0.06), morale: 10 }, ship, { x: ship.state.x, y: ship.state.y });
    igniteShip(game, o, 10, ship);
  });
  ship.hull = 0;
  game.beginSinking(ship);
}

/** A merchant run down throws a third of her hold over the side (up to three times) to run lighter: a trail of
 *  crates for the chaser to choose between. */
export function runLighter(game: Game, ship: ShipEntity, brain: NpcBrain, danger: ShipEntity): boolean {
  const now = game.now;
  if ((brain.dumped ?? 0) >= 3 || now < (brain.dumpAt ?? 0) || ship.surrendered) return false;
  if (dist(ship.state.x, ship.state.y, danger.state.x, danger.state.y) > 900) return false;
  const cargo: Partial<Record<GoodId, number>> = {};
  let any = false;
  for (const [g, n] of Object.entries(ship.cargo) as [GoodId, number][]) {
    const k = Math.floor(n / 3);
    if (k <= 0) continue;
    cargo[g] = k;
    ship.cargo[g] = n - k;
    any = true;
  }
  if (!any) return false;
  brain.dumped = (brain.dumped ?? 0) + 1;
  brain.dumpAt = now + 20;
  const back = headingVec(ship.state.heading + Math.PI);
  game.dropCrate(ship.state.x + back.x * 40, ship.state.y + back.y * 40, cargo);
  ship.recompute(now);
  game.toastNear(ship, `${ship.name} throws cargo over the side to run lighter!`);
  return true;
}

// ------------------------------------------------------------------ director: keeps the ocean alive

export interface NpcQuota {
  merchants: number;
  pirates: number;
  fishers: number;
  ghosts: number;
}

// docs/19 D3: twice the 140/68/40/3 the sea kept.
export const QUOTA: NpcQuota = { merchants: 280, pirates: 136, fishers: 80, ghosts: 6 };

export function spawnMerchant(game: Game): void {
  const ports = game.zonePorts();
  const weights = ports.map((p) => [p, p.size * p.size] as const);
  const port = game.rng.weighted(weights);
  // Her level (canon D12) by the port's square of the sea (docs/16 P2), leaning low; the hull to match, flutes most of all.
  const level = sectorLevel(game, port.x, port.y, true);
  const hulls = hullsFor('merchant', level);
  // Between a fluyt's top and a galleon's first (⚓6) she sails the galleon: no merchant below her square.
  const cls: ShipClassId = level >= 6 && hulls.includes('galleon') ? 'galleon' : hulls.includes('fluyt') && game.rng.chance(0.55) ? 'fluyt' : game.rng.pick(hulls);
  const faction: FactionId = port.faction === 'crown' ? 'league' : port.faction === 'choir' ? 'free' : port.faction === 'confederacy' ? 'free' : port.faction;
  const ship = game.spawnNpcShip('merchant', cls, faction, port.x, port.y, game.rng.range(0, Math.PI * 2));
  game.setNpcLevel(ship, level);
  ship.purse = 150 + game.rng.int(0, 500) * ship.cls.tier;
  const brain = game.npcs.get(ship.id)!;
  if (!planMerchantVoyage(game, ship, brain, port)) game.removeShip(ship.id);
  else {
    brain.traveled = game.rng.float() * brain.length * 0.8; // spread across the ocean at boot
    raidEscort(game, ship, port.region); // hot lanes: a League escort (docs/12 P6)
  }
}

const PIRATE_REGIONS: RegionId[] = ['gravewater', 'whispering', 'ashen_isles', 'dead_mans_expanse', 'leviathan_reach', 'drowned_crown'];

export function spawnPirate(game: Game, near?: ShipEntity): ShipEntity | null {
  let x: number, y: number, region: RegionId;
  if (near) {
    // Just beyond the horizon of interest and to windward — attackers want the weather gauge.
    const wind = game.windFor(near);
    const a = wind.dir + Math.PI + game.rng.range(-1.1, 1.1);
    x = near.state.x + Math.sin(a) * 2350;
    y = near.state.y - Math.cos(a) * 2350;
    region = game.regionAt(x, y);
  } else {
    const regions = game.zone ? PIRATE_REGIONS.filter((r) => game.zone!.regions.has(r)) : PIRATE_REGIONS;
    if (!regions.length) return null;
    region = game.rng.pick(regions);
    [x, y] = REGIONS[region].center;
    x += game.rng.range(-9000, 9000);
    y += game.rng.range(-9000, 9000);
  }
  if (REGIONS[region].safety === 'safe' || isLand(game.world, x, y) || x < 3500 || y < 3500 || x > 92500 || y > 92500 || !game.inZone(x, y)) return null;
  // Her level (canon D12): an ambusher is sized to her prey within the square's band; a rover to the square's band.
  const level = near ? levelNear(game, near, region, x, y) : sectorLevel(game, x, y);
  const cls: ShipClassId = game.rng.pick(hullsFor('pirate', level));
  const ship = game.spawnNpcShip('pirate', cls, 'confederacy', x, y, game.rng.range(0, Math.PI * 2));
  game.setNpcLevel(ship, level);
  ship.purse = 100 + game.rng.int(0, 400) * ship.cls.tier;
  const loot: GoodId[] = ['rum', 'gunpowder', 'weapons', 'tobacco', 'spices', 'dreamleaf'];
  ship.cargo[game.rng.pick(loot)] = game.rng.int(3, 8 + ship.cls.tier * 4);
  const brain = game.npcs.get(ship.id)!;
  brain.area = { x, y, r: 7000 };
  if (near) {
    // Ambush: the lookout has spotted the captain; pursue for a few minutes.
    const path = findPath(game.world, x, y, near.state.x, near.state.y, 20000);
    if (path) {
      setPath(brain, path);
      brain.area = { x: near.state.x, y: near.state.y, r: 3000 };
      brain.chase = { id: near.id, until: game.now + 240 };
      return ship;
    }
  }
  if (!planWander(game, ship, brain)) {
    game.removeShip(ship.id);
    return null;
  }
  return ship;
}

/** A level in the band of the square of the sea at a point (docs/16 P2; merchants and fishers lean low). */
export function sectorLevel(game: Game, x: number, y: number, low = false): number {
  const band = sectorAt(game.world, x, y).band;
  const roll = game.rng.int(band[0], band[1]);
  return low ? Math.min(roll, game.rng.int(band[0], band[1])) : roll;
}

/** A level in the band of a region's waters (merchants and fishers lean low): for what has no place of its own. */
export function bandLevel(game: Game, region: RegionId, low = false): number {
  const band = watersBand(REGIONS[region].safety, region === 'the_abyss');
  const roll = game.rng.int(band[0], band[1]);
  return low ? Math.min(roll, game.rng.int(band[0], band[1])) : roll;
}

/** A ship put out after a captain (an ambush, raiders, a hunter's pack): sized to her level, higher in wild waters —
 *  but of the square she puts out in (docs/16 P2): a veteran in the Crown's shallows meets its own small fry, a
 *  novice in the deep its own terrors, one level over the square's band at most. */
export function levelNear(game: Game, prey: ShipEntity, region: RegionId, x = prey.state.x, y = prey.state.y): number {
  const safety = REGIONS[region].safety;
  const r = game.rng.float();
  const d = safety === 'lawless' ? (r < 0.5 ? 0 : r < 0.85 ? 1 : 2) : safety === 'contested' ? (r < 0.25 ? -1 : r < 0.75 ? 0 : 1) : r < 0.5 ? -1 : 0;
  const [lo, hi] = sectorAt(game.world, x, y).band;
  return Math.max(1, Math.min(10, Math.max(lo, Math.min(hi + 1, prey.combatLevel + d))));
}

export function spawnFisher(game: Game): void {
  const ports = game.zonePorts().filter((p) => REGIONS[p.region].safety !== 'lawless');
  if (!ports.length) return;
  const port = game.rng.pick(ports);
  const ship = game.spawnNpcShip('fisher', 'cutter', port.faction === 'crown' ? 'crown' : 'free', port.x, port.y, game.rng.range(0, 6.28));
  game.setNpcLevel(ship, sectorLevel(game, port.x, port.y, true));
  ship.cargo = { provisions: game.rng.int(4, 12), salt: game.rng.int(0, 5) };
  ship.purse = 30 + game.rng.int(0, 60);
  const brain = game.npcs.get(ship.id)!;
  brain.area = { x: port.x, y: port.y, r: 4500 };
  if (!planWander(game, ship, brain)) game.removeShip(ship.id);
}

/** The goods a passing merchant might carry (the local traffic's). */
const TRAFFIC_GOODS: GoodId[] = ['provisions', 'rum', 'sugar', 'tobacco', 'timber', 'cloth', 'spices', 'salt', 'sailcloth', 'iron', 'medicine'];

/**
 * One ship of the local traffic about a captain (traffic.ts): put out a little beyond her sight, of her waters' level,
 * sailing the sea's own ways — a merchant crossing her track toward the far side, a fisher working the water, a patrol
 * on its beat, a rover looking for prey. Null when the spot is land or the role has no place here.
 */
export function spawnTraffic(game: Game, role: 'merchant' | 'fisher' | 'patrol' | 'pirate' | 'hunter', x: number, y: number, past: { x: number; y: number }): ShipEntity | null {
  if (isLand(game.world, x, y) || x < 3500 || y < 3500 || x > 92500 || y > 92500 || !game.inZone(x, y)) return null;
  const region = regionAt(game.world, x, y);
  const safety = REGIONS[region].safety;
  const port = game.nearestPort(x, y);
  let faction: FactionId;
  if (role === 'merchant') faction = !port || port.faction === 'crown' ? 'league' : port.faction === 'choir' || port.faction === 'confederacy' ? 'free' : port.faction;
  else if (role === 'fisher') faction = port?.faction === 'crown' ? 'crown' : 'free';
  else if (role === 'patrol') {
    if (!port || safety === 'lawless' || (port.faction !== 'crown' && port.faction !== 'league' && port.faction !== 'harpoon')) return null;
    faction = port.faction;
  } else if (role === 'hunter') {
    // The Harpoon's whalers work the wild waters for the beasts (docs/16 P1).
    if (safety === 'safe') return null;
    faction = 'harpoon';
  } else {
    if (safety === 'safe') return null;
    faction = 'confederacy';
  }
  // Her level by the square she puts out in (docs/16 P2); the law a level above it.
  const level = role === 'patrol' ? Math.min(10, sectorLevel(game, x, y) + 1) : sectorLevel(game, x, y, role !== 'pirate');
  const hulls = role === 'fisher' ? (['cutter'] as ShipClassId[]) : role === 'hunter' && level <= 5 ? (['harpoon_whaler'] as ShipClassId[]) : hullsFor(role, level);
  const cls: ShipClassId = role === 'merchant' && hulls.includes('fluyt') && game.rng.chance(0.5) ? 'fluyt' : game.rng.pick(hulls);
  const h = headingOf(past.x - x, past.y - y);
  const ship = game.spawnNpcShip(role, cls, faction, x, y, h);
  game.setNpcLevel(ship, level);
  game.grid.upsert(ship.id, x, y); // counted about her at once, not a tick later
  const brain = game.npcs.get(ship.id)!;
  if (role === 'merchant') {
    ship.purse = 150 + game.rng.int(0, 500) * ship.cls.tier;
    ship.cargo[game.rng.pick(TRAFFIC_GOODS)] = game.rng.int(6, 12 + ship.cls.tier * 6);
    // Across her track: to a point as far beyond her as the merchant is before her, a little to one side.
    const dx = past.x - x, dy = past.y - y, l = Math.hypot(dx, dy) || 1;
    const side = game.rng.range(-900, 900);
    const tx = past.x + (dx / l) * game.rng.range(1500, 3000) - (dy / l) * side, ty = past.y + (dy / l) * game.rng.range(1500, 3000) + (dx / l) * side;
    const path = isLand(game.world, tx, ty) ? null : findPath(game.world, x, y, tx, ty, 20000);
    if (!path) {
      game.removeShip(ship.id);
      return null;
    }
    setPath(brain, path);
    brain.destPort = null;
    return ship;
  }
  if (role === 'fisher') {
    ship.cargo = { provisions: game.rng.int(4, 12), fish: game.rng.int(2, 10) };
    ship.purse = 30 + game.rng.int(0, 60);
    brain.area = { x, y, r: 2500 };
  } else if (role === 'patrol') {
    ship.purse = 200 + game.rng.int(0, 300);
    brain.area = { x: past.x, y: past.y, r: 5000 };
  } else if (role === 'hunter') {
    ship.purse = 150 + game.rng.int(0, 250);
    ship.cargo = { whale_oil: game.rng.int(2, 8) };
    brain.area = { x, y, r: 5000 };
  } else {
    ship.purse = 100 + game.rng.int(0, 400) * ship.cls.tier;
    const loot: GoodId[] = ['rum', 'gunpowder', 'weapons', 'tobacco', 'spices'];
    ship.cargo[game.rng.pick(loot)] = game.rng.int(3, 8 + ship.cls.tier * 4);
    brain.area = { x, y, r: 6000 };
  }
  if (!planWander(game, ship, brain)) {
    game.removeShip(ship.id);
    return null;
  }
  return ship;
}

export function spawnPatrols(game: Game): void {
  for (const port of game.zonePorts()) {
    if (!port.key) continue;
    if (port.faction !== 'crown' && port.faction !== 'league' && port.faction !== 'harpoon') continue;
    const n = port.size >= 3 ? 3 : 2;
    let leader: number | null = null;
    for (let i = 0; i < n; i++) {
      const cls: ShipClassId = port.size >= 3 && i === 0 ? 'frigate' : i === 1 ? 'brig' : 'brigantine';
      const ship = game.spawnNpcShip('patrol', cls, port.faction, port.x, port.y, game.rng.range(0, 6.28));
      game.setNpcLevel(ship, Math.min(10, sectorLevel(game, port.x, port.y) + 1)); // the law sails a level above the waters
      ship.purse = 200 + game.rng.int(0, 300);
      const brain = game.npcs.get(ship.id)!;
      brain.area = { x: port.x, y: port.y, r: port.size >= 3 ? 11000 : 8000 };
      brain.destPort = null;
      // The first sails the beat; the rest keep station in her line.
      if (leader !== null) {
        brain.leader = leader;
        brain.slot = i;
      }
      if (!planWander(game, ship, brain)) game.removeShip(ship.id);
      else if (leader === null) leader = ship.id;
    }
  }
}

export function spawnGhost(game: Game, everywhere = false): void {
  // The Tide of the Dead: in that season the drowned sail every sea.
  const regions: RegionId[] = (everywhere ? REGION_IDS : (['drowned_crown', 'dead_mans_expanse', 'the_abyss'] as RegionId[])).filter((r) => !game.zone || game.zone.regions.has(r));
  if (!regions.length) return;
  const region = game.rng.pick(regions);
  const [cx, cy] = REGIONS[region].center;
  const x = cx + game.rng.range(-6000, 6000), y = cy + game.rng.range(-6000, 6000);
  if (isLand(game.world, x, y)) return;
  const ship = game.spawnNpcShip('ghost', 'ghost_ship', 'choir', x, y, game.rng.range(0, 6.28), { ship: 'The Hollow Psalm', captain: 'Something Wearing a Captain' });
  game.setNpcLevel(ship, sectorLevel(game, x, y));
  ship.cargo = { cursed_relics: game.rng.int(3, 8), pearls: game.rng.int(2, 6), abyssal_ore: game.rng.int(1, 4) };
  ship.purse = 1500 + game.rng.int(0, 1500);
  const brain = game.npcs.get(ship.id)!;
  brain.area = { x: cx, y: cy, r: 12000 };
  if (!planWander(game, ship, brain)) game.removeShip(ship.id);
}

export function spawnHunter(game: Game, prey: ShipEntity, accountId: number): void {
  const a = game.rng.float() * Math.PI * 2;
  const x = prey.state.x + Math.sin(a) * 3600, y = prey.state.y - Math.cos(a) * 3600;
  if (isLand(game.world, x, y)) return;
  // A bounty hunter sails one level above her quarry (canon D12).
  const level = Math.min(10, prey.combatLevel + 1);
  const ship = game.spawnNpcShip('hunter', game.rng.pick(hullsFor('hunter', level)), 'crown', x, y, headingOf(prey.state.x - x, prey.state.y - y), {
    ship: 'HMS ' + pick(game, ['Relentless', 'Verdict', 'Long Arm', 'Gallows Oath', 'Writ of Iron']), captain: 'Bounty Hunter ' + pick(game, CAPTAIN_NAMES),
  });
  game.setNpcLevel(ship, level);
  ship.purse = 400;
  const brain = game.npcs.get(ship.id)!;
  brain.huntAccount = accountId;
  brain.area = { x: prey.state.x, y: prey.state.y, r: 6000 };
  brain.expiresAt = game.now + 600;
  planWander(game, ship, brain);
  game.toastShip(prey, `A Crown bounty hunter has picked up your trail: ${ship.name}.`, 'bad');
}

/** Pirates who got word of a courier's cargo (docs/11 P6): n raiders a little over the horizon, closing on her,
 *  giving up after ten minutes or when the wake goes cold. Returns how many put out. */
export function spawnCargoAmbush(game: Game, prey: ShipEntity, accountId: number, n: number): number {
  let made = 0;
  for (let i = 0; i < n; i++) {
    const a = game.rng.float() * Math.PI * 2;
    const x = prey.state.x + Math.sin(a) * 2400, y = prey.state.y - Math.cos(a) * 2400;
    if (isLand(game.world, x, y)) continue;
    const level = levelNear(game, prey, game.regionAt(x, y), x, y);
    const ship = game.spawnNpcShip('pirate', game.rng.pick(hullsFor('pirate', level)), 'confederacy', x, y, headingOf(prey.state.x - x, prey.state.y - y));
    game.setNpcLevel(ship, level);
    const brain = game.npcs.get(ship.id)!;
    brain.huntAccount = accountId;
    brain.area = { x: prey.state.x, y: prey.state.y, r: 6000 };
    brain.expiresAt = game.now + 600;
    planWander(game, ship, brain);
    made++;
  }
  return made;
}

/** A hunt's quarry (docs/11 P6): the band's leader, a named captain on a heavier ship somewhere in the region's open
 *  water, roaming it for an hour. Null when no open water was found. */
export function spawnPackLeader(game: Game, region: RegionId, level: number): ShipEntity | null {
  const [cx, cy] = REGIONS[region].center;
  for (let k = 0; k < 20; k++) {
    const a = game.rng.float() * Math.PI * 2, r = 1500 + game.rng.float() * 6000;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (isLand(game.world, x, y) || regionAt(game.world, x, y) !== region || !game.inZone(x, y)) continue;
    // The leader sails a level above the captains the hunt is written for (canon D12).
    const lv = Math.min(10, shipLevelForCaptain(level) + 1);
    const ship = game.spawnNpcShip('pirate', game.rng.pick(hullsFor('pirate', lv)), 'confederacy', x, y, game.rng.float() * Math.PI * 2);
    game.setNpcLevel(ship, lv);
    const brain = game.npcs.get(ship.id)!;
    brain.area = { x: cx, y: cy, r: 8000 };
    brain.expiresAt = game.now + 3600;
    ship.purse = (ship.purse ?? 0) + 300 + level * 20;
    planWander(game, ship, brain);
    return ship;
  }
  return null;
}

/** A group contract's quarry (docs/11 P6): a raiders' flagship — a frigate, a galleon in contested waters, a man
 *  o' war in lawless ones — with two escorts at her side, a fat purse, out for two hours in the region. */
export function spawnElite(game: Game, region: RegionId, level: number): ShipEntity | null {
  const [cx, cy] = REGIONS[region].center;
  for (let k = 0; k < 30; k++) {
    const a = game.rng.float() * Math.PI * 2, r = 2500 + game.rng.float() * 6000;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (isLand(game.world, x, y) || regionAt(game.world, x, y) !== region || !game.inZone(x, y)) continue;
    const h = game.rng.float() * Math.PI * 2;
    // An elite near the top of the waters' band, built for a company; her escorts a level below (canon D12).
    const lv = eliteShipLevel(REGIONS[region].safety);
    const flag = game.spawnNpcShip('pirate', hullsFor('pirate', lv).at(-1)!, 'confederacy', x, y, h); // the heaviest hull of her level
    flag.elite = true;
    game.setNpcLevel(flag, lv);
    const brain = game.npcs.get(flag.id)!;
    brain.area = { x: cx, y: cy, r: 9000 };
    brain.expiresAt = game.now + 7200;
    flag.purse = (flag.purse ?? 0) + 800 + level * 40;
    planWander(game, flag, brain);
    for (const side of [-1, 1]) {
      const ex = x + Math.cos(h + side * 2.2) * 220, ey = y + Math.sin(h + side * 2.2) * 220;
      if (isLand(game.world, ex, ey)) continue;
      const esc = game.spawnNpcShip('pirate', game.rng.pick(hullsFor('pirate', Math.max(1, lv - 1))), 'confederacy', ex, ey, h);
      game.setNpcLevel(esc, lv - 1);
      const eb = game.npcs.get(esc.id)!;
      eb.area = { x: cx, y: cy, r: 9000 };
      eb.expiresAt = game.now + 7200;
      planWander(game, esc, eb);
    }
    return flag;
  }
  return null;
}

/** Abstract (off-screen) encounters: pirates raid merchants statistically. Creates shortages and rumours. */
export function abstractEncounters(game: Game): void {
  const pirates: ShipEntity[] = [];
  for (const [id, b] of game.npcs) if (!b.active && b.role === 'pirate') pirates.push(game.ships.get(id)!);
  for (const [id, b] of game.npcs) {
    if (b.active || b.role !== 'merchant') continue;
    const m = game.ships.get(id);
    if (!m) continue;
    const safety = REGIONS[game.regionAt(m.state.x, m.state.y)].safety;
    if (safety === 'safe') continue;
    for (const p of pirates) {
      if (dist(p.state.x, p.state.y, m.state.x, m.state.y) > 2500) continue;
      if (game.rng.float() > (safety === 'lawless' ? 0.25 : 0.12)) continue;
      const goods = Object.entries(m.cargo).filter(([, n]) => (n ?? 0) > 0);
      if (goods.length) {
        const [g, n] = goods[0];
        game.addRumor(m.state.x, m.state.y, `The ${m.cls.name.toLowerCase()} ${m.name} was taken by pirates near ${game.nearestIslandName(m.state.x, m.state.y)} — ${n} ${GOODS[g as GoodId].name.toLowerCase()} never arrived at ${b.destPort ? game.portById(b.destPort)?.name ?? 'port' : 'port'}.`);
      }
      game.removeShip(m.id);
      break;
    }
  }
  // The law's own wars out of sight (docs/16 P1): a patrol that falls in with a rover off-screen now and then sinks her.
  for (const [id, b] of game.npcs) {
    if (b.active || b.role !== 'patrol' || b.leader !== undefined) continue;
    const pa = game.ships.get(id);
    if (!pa) continue;
    for (const p of pirates) {
      if (!p.alive || !game.ships.has(p.id) || dist(p.state.x, p.state.y, pa.state.x, pa.state.y) > 2000) continue;
      if (game.rng.float() > 0.08) continue;
      game.addRumor(p.state.x, p.state.y, `The patrol ${pa.name} ran down the rover ${p.name} near ${game.nearestIslandName(p.state.x, p.state.y)}.`);
      game.removeShip(p.id);
      break;
    }
  }
}

/** A predator of the sea shows hostile to a captain (the orcas spare the White Orca's figure). */
function beastPredator(npc: ShipEntity, other: ShipEntity): boolean {
  const id = beastOfClass(npc.loadout.classId);
  if (!id || !BEASTS[id].predator) return false;
  return !(BEASTS[id].group === 'orca' && id === 'orca' && other.hasFlag('fh_white_orca'));
}
