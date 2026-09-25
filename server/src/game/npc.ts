// NPC simulation with two levels of detail:
//  * abstract — far from every player: the ship slides along its cached route at cruise speed,
//    with statistical encounters (raids) instead of physics;
//  * active — near a player: full sailing physics, perception, tacking and combat AI.
// Every NPC has a purpose: merchants haul real cargo between real markets (docs/01 §5).

import { NPC_ACTIVE_RADIUS, isNight } from '../../../shared/src/constants.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { AmmoId, ShipClassId } from '../../../shared/src/data/ships.ts';
import { angleDiff, clamp, DEG, dist, headingOf, headingVec, wrapAngle } from '../../../shared/src/math.ts';
import { relWindDeg } from '../../../shared/src/sim/sailing.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Port } from '../../../shared/src/world/worldgen.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { canBoard, startBoarding } from './boarding.ts';
import { effectiveRange, fireBroadside, sideHeading } from './combat.ts';
import { applyTrade, bestRoute } from './economy.ts';
import type { Game } from './Game.ts';
import { findPath, pathLength, pointAlong } from './nav.ts';
import type { Path } from './nav.ts';
import type { NpcRole, ShipEntity } from './ship.ts';

export interface NpcBrain {
  id: number;
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
  surrenderedAt: number;
  expiresAt: number;
  huntAccount: number | null;
  stuckCheck: { x: number; y: number; t: number };
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
    fleeFrom: null, nextThink: now, tackSide: 1, tackUntil: 0, surrenderedAt: 0, expiresAt: 0, huntAccount: null,
    stuckCheck: { x: 0, y: 0, t: now },
  };
}

function cruiseSpeed(ship: ShipEntity): number {
  return ship.stats.maxSpeed * 0.62;
}

/** Load a merchant at `from` with the best-paying cargo for some destination. */
export function planMerchantVoyage(game: Game, ship: ShipEntity, brain: NpcBrain, from: Port): boolean {
  const route = bestRoute(from, game.markets, game.world.ports, () => game.rng.float(), 38000);
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
    const near = game.world.ports.filter((p) => p.id !== from.id && Math.hypot(p.x - from.x, p.y - from.y) < 30000);
    if (!near.length) return false;
    dest = pick(game, near);
  }
  const path = game.routes.between(from, dest);
  if (!path) return false;
  setPath(brain, path);
  brain.destPort = dest.id;
  return true;
}

function setPath(brain: NpcBrain, path: Path): void {
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

function planWander(game: Game, ship: ShipEntity, brain: NpcBrain): boolean {
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
  const role = npc.npcRole;
  if (npc.ownerId !== null) {
    // Escort: hostile to whoever is hostile to its owner.
    if (other.id === npc.ownerId || other.ownerId === npc.ownerId) return false;
    const owner = game.ships.get(npc.ownerId);
    return !!owner && (game.isHostile(other, owner) || owner.attackers.has(other.id) || other.attackers.has(owner.id));
  }
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
        if (safety === 'safe') return false;
        if (p && (p.reputation.confederacy ?? 0) >= 30) return false;
        return !other.surrendered;
      case 'ghost':
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
      return oRole !== 'ghost';
    default:
      return false;
  }
}

function detectionRange(game: Game, npc: ShipEntity, other: ShipEntity): number {
  let r = npc.stats.detection;
  if (other.hasFlag('hidden')) return 230;
  if (other.hasFlag('dark_running')) r *= 0.4;
  const w = game.weatherIn(other.region);
  if (w === 'fog') r *= 0.55;
  else if (w === 'rain' || w === 'storm') r *= 0.75;
  if (isNight(game.now)) r *= 0.8;
  return r;
}

// ------------------------------------------------------------------ per-tick update

export function updateNpc(game: Game, ship: ShipEntity, brain: NpcBrain, dt: number, nearestPlayerDist: number): void {
  const now = game.now;
  if (!ship.alive) return;
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
    if (now - brain.surrenderedAt > 75 && !ship.lootLockedFor) {
      ship.surrendered = false;
      brain.surrenderedAt = 0;
      brain.fleeFrom = null;
    }
    return;
  }
  if (now >= brain.nextThink) {
    brain.nextThink = now + 0.25 + game.rng.float() * 0.1;
    think(game, ship, brain);
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
  if (!brain.path) {
    if (!replan(game, ship, brain)) game.removeShip(ship.id);
    return;
  }
  brain.traveled += cruiseSpeed(ship) * dt;
  const p = pointAlong(brain.path, brain.traveled);
  ship.state.x = p.x;
  ship.state.y = p.y;
  ship.state.heading = p.heading;
  ship.state.speed = cruiseSpeed(ship);
  if (brain.traveled >= brain.length) arrive(game, ship, brain);
}

/** Arrival at the end of a path: merchants trade and re-plan, others pick a new leg. */
function arrive(game: Game, ship: ShipEntity, brain: NpcBrain): void {
  if (brain.destPort) {
    const port = game.portById(brain.destPort);
    const market = port ? game.markets.get(port.id) : undefined;
    if (port && market && ship.npcRole === 'merchant') {
      for (const id in ship.cargo) {
        const g = id as GoodId;
        const n = ship.cargo[g] ?? 0;
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

function think(game: Game, ship: ShipEntity, brain: NpcBrain): void {
  const now = game.now;
  const role = brain.role;
  // Perception.
  let threat: ShipEntity | null = null;
  let threatD = Infinity;
  let prey: ShipEntity | null = null;
  let preyD = Infinity;
  game.forShipsNear(ship.state.x, ship.state.y, ship.stats.detection, (o) => {
    if (o.id === ship.id || !o.alive || o.docked) return;
    const d = dist(ship.state.x, ship.state.y, o.state.x, o.state.y);
    if (d > detectionRange(game, ship, o)) return;
    if (npcHostileTo(game, ship, o) && d < preyD) {
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
    if (hunted && hunted.alive && !hunted.docked) {
      prey = hunted;
      preyD = dist(ship.state.x, ship.state.y, hunted.state.x, hunted.state.y);
    }
  }

  const peaceful = role === 'merchant' || role === 'fisher';
  if (peaceful) {
    const danger = (threat ?? (brain.fleeFrom !== null ? game.ships.get(brain.fleeFrom) ?? null : null)) as ShipEntity | null;
    if (danger && dist(ship.state.x, ship.state.y, danger.state.x, danger.state.y) < 1400) {
      const beaten = ship.hull < ship.stats.hullMax * 0.35 || ship.crew < ship.stats.crewMax * 0.3 || ship.sails < ship.stats.sailHpMax * 0.25;
      if (beaten && ship.inCombat(now)) {
        ship.surrendered = true;
        brain.surrenderedAt = now;
        game.toastNear(ship, `${ship.name} strikes her colours!`);
        return;
      }
      const away = headingOf(ship.state.x - danger.state.x, ship.state.y - danger.state.y);
      steer(game, ship, brain, away, 1);
      return;
    }
    brain.fleeFrom = null;
    followPath(game, ship, brain);
    return;
  }

  // Fighters.
  const lowHull = ship.hull < ship.stats.hullMax * 0.22;
  if (role === 'pirate' && lowHull && prey) {
    const away = headingOf(ship.state.x - (prey as ShipEntity).state.x, ship.state.y - (prey as ShipEntity).state.y);
    steer(game, ship, brain, away, 1);
    return;
  }
  if (prey) {
    brain.target = (prey as ShipEntity).id;
    engage(game, ship, brain, prey as ShipEntity, preyD);
    return;
  }
  brain.target = null;
  if (ship.ownerId !== null) {
    const owner = game.ships.get(ship.ownerId);
    if (owner) {
      const d = dist(ship.state.x, ship.state.y, owner.state.x, owner.state.y);
      const behind = headingVec(owner.state.heading + Math.PI);
      const tx = owner.state.x + behind.x * 140, ty = owner.state.y + behind.y * 140;
      steer(game, ship, brain, headingOf(tx - ship.state.x, ty - ship.state.y), d > 300 ? 1 : d > 160 ? 0.75 : 0.5);
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
  brain.traveled = Math.min(brain.length, brain.traveled + ship.state.speed * 0.3);
  steer(game, ship, brain, headingOf(wx - ship.state.x, wy - ship.state.y), 1);
}

function chooseAmmo(ship: ShipEntity, target: ShipEntity, d: number, wantsBoard: boolean): AmmoId {
  const has = (a: AmmoId) => ship.ammo[a] > 0;
  if (wantsBoard && d < 180 && has('grape') && target.crew > target.stats.crewMax * 0.35) return 'grape';
  if (wantsBoard && target.sails > target.stats.sailHpMax * 0.45 && has('chain')) return 'chain';
  if (has('round')) return 'round';
  return has('chain') ? 'chain' : 'grape';
}

function engage(game: Game, ship: ShipEntity, brain: NpcBrain, target: ShipEntity, d: number): void {
  // Pirates want the cargo, so they cripple and board; everyone else fights to sink.
  const wantsBoard = brain.role === 'pirate';
  ship.ammoSel = chooseAmmo(ship, target, d, wantsBoard);
  if (wantsBoard && canBoard(game, ship, target) === null) {
    startBoarding(game, ship, target, 'standard');
    return;
  }
  const range = effectiveRange(ship, 'port', ship.ammoSel);
  const bearing = headingOf(target.state.x - ship.state.x, target.state.y - ship.state.y);
  // Lead the target by the ball's flight time.
  const flight = d / 180;
  const tv = headingVec(target.state.heading);
  const px = target.state.x + tv.x * target.state.speed * flight;
  const py = target.state.y + tv.y * target.state.speed * flight;
  const leadD = dist(ship.state.x, ship.state.y, px, py);
  const leadBearing = headingOf(px - ship.state.x, py - ship.state.y);

  if (d > range * 0.9) {
    steer(game, ship, brain, bearing, 1);
  } else {
    // Present the loaded broadside.
    const portLoaded = ship.reload.port <= 0, starLoaded = ship.reload.starboard <= 0;
    const hPort = wrapAngle(bearing + Math.PI / 2); // heading that puts target on the port beam
    const hStar = wrapAngle(bearing - Math.PI / 2);
    const dPort = Math.abs(angleDiff(ship.state.heading, hPort));
    const dStar = Math.abs(angleDiff(ship.state.heading, hStar));
    let desired = dPort < dStar ? hPort : hStar;
    if (portLoaded && !starLoaded) desired = hPort;
    if (starLoaded && !portLoaded) desired = hStar;
    if (wantsBoard && target.sails < target.stats.sailHpMax * 0.4) desired = bearing; // close in for the grapple
    if (d < range * 0.3 && !wantsBoard) desired = wrapAngle(desired + (desired === hPort ? -0.4 : 0.4));
    steer(game, ship, brain, desired, wantsBoard && d < 400 ? 0.75 : 1);
  }
  for (const side of ['port', 'starboard'] as const) {
    if (ship.reload[side] > 0) continue;
    const off = Math.abs(angleDiff(sideHeading(ship, side), leadBearing));
    if (off < 20 * DEG && leadD < range * 0.98) fireBroadside(game, ship, side, leadD);
  }
}

/** Steering with tacking and island avoidance. */
function steer(game: Game, ship: ShipEntity, brain: NpcBrain, desired: number, sail: number): void {
  const now = game.now;
  const wind = game.windFor(ship);
  const noGo = ship.stats.noGoDeg + 6;
  const rel = relWindDeg(desired, wind);
  if (rel < noGo) {
    const from = wrapAngle(wind.dir + Math.PI);
    if (now > brain.tackUntil) {
      const a = wrapAngle(from + noGo * DEG), b = wrapAngle(from - noGo * DEG);
      brain.tackSide = Math.abs(angleDiff(a, desired)) < Math.abs(angleDiff(b, desired)) ? 1 : -1;
      brain.tackUntil = now + 22 + game.rng.float() * 10;
    }
    desired = wrapAngle(from + brain.tackSide * noGo * DEG);
  }
  // Island avoidance probes.
  const look = 180 + ship.state.speed * 7;
  const probe = (h: number) => {
    const v = headingVec(h);
    return isLand(game.world, ship.state.x + v.x * look, ship.state.y + v.y * look) || isLand(game.world, ship.state.x + v.x * look * 0.5, ship.state.y + v.y * look * 0.5);
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

// ------------------------------------------------------------------ director: keeps the ocean alive

export interface NpcQuota {
  merchants: number;
  pirates: number;
  fishers: number;
  ghosts: number;
}

export const QUOTA: NpcQuota = { merchants: 44, pirates: 26, fishers: 10, ghosts: 2 };

export function spawnMerchant(game: Game): void {
  const ports = game.world.ports;
  const weights = ports.map((p) => [p, p.size * p.size] as const);
  const port = game.rng.weighted(weights);
  const roll = game.rng.float();
  const cls: ShipClassId = roll < 0.55 ? 'fluyt' : roll < 0.75 ? 'schooner' : port.size >= 2 && roll < 0.93 ? 'galleon' : 'brigantine';
  const faction: FactionId = port.faction === 'crown' ? 'league' : port.faction === 'choir' ? 'free' : port.faction === 'confederacy' ? 'free' : port.faction;
  const ship = game.spawnNpcShip('merchant', cls, faction, port.x, port.y, game.rng.range(0, Math.PI * 2));
  ship.purse = 150 + game.rng.int(0, 500) * ship.cls.tier;
  const brain = game.npcs.get(ship.id)!;
  if (!planMerchantVoyage(game, ship, brain, port)) game.removeShip(ship.id);
  else brain.traveled = game.rng.float() * brain.length * 0.8; // spread across the ocean at boot
}

const PIRATE_REGIONS: RegionId[] = ['gravewater', 'whispering', 'ashen_isles', 'dead_mans_expanse', 'leviathan_reach', 'drowned_crown'];

export function spawnPirate(game: Game, near?: { x: number; y: number }): ShipEntity | null {
  let x: number, y: number, region: RegionId;
  if (near) {
    const a = game.rng.float() * Math.PI * 2;
    x = near.x + Math.sin(a) * 3400;
    y = near.y - Math.cos(a) * 3400;
    region = game.regionAt(x, y);
  } else {
    region = game.rng.pick(PIRATE_REGIONS);
    [x, y] = REGIONS[region].center;
    x += game.rng.range(-9000, 9000);
    y += game.rng.range(-9000, 9000);
  }
  if (REGIONS[region].safety === 'safe' || isLand(game.world, x, y) || x < 3500 || y < 3500 || x > 92500 || y > 92500) return null;
  const tierRoll = game.rng.float() + REGIONS[region].strangeness * 0.5;
  const cls: ShipClassId = tierRoll < 0.45 ? 'sloop' : tierRoll < 0.75 ? 'schooner' : tierRoll < 1.0 ? 'brigantine' : 'brig';
  const ship = game.spawnNpcShip('pirate', cls, 'confederacy', x, y, game.rng.range(0, Math.PI * 2));
  ship.purse = 100 + game.rng.int(0, 400) * ship.cls.tier;
  const loot: GoodId[] = ['rum', 'gunpowder', 'weapons', 'tobacco', 'spices', 'dreamleaf'];
  ship.cargo[game.rng.pick(loot)] = game.rng.int(3, 8 + ship.cls.tier * 4);
  const brain = game.npcs.get(ship.id)!;
  brain.area = { x, y, r: 7000 };
  if (!planWander(game, ship, brain)) {
    game.removeShip(ship.id);
    return null;
  }
  return ship;
}

export function spawnFisher(game: Game): void {
  const ports = game.world.ports.filter((p) => REGIONS[p.region].safety !== 'lawless');
  const port = game.rng.pick(ports);
  const ship = game.spawnNpcShip('fisher', 'cutter', port.faction === 'crown' ? 'crown' : 'free', port.x, port.y, game.rng.range(0, 6.28));
  ship.cargo = { provisions: game.rng.int(4, 12), salt: game.rng.int(0, 5) };
  ship.purse = 30 + game.rng.int(0, 60);
  const brain = game.npcs.get(ship.id)!;
  brain.area = { x: port.x, y: port.y, r: 4500 };
  if (!planWander(game, ship, brain)) game.removeShip(ship.id);
}

export function spawnPatrols(game: Game): void {
  for (const port of game.world.ports) {
    if (!port.key) continue;
    if (port.faction !== 'crown' && port.faction !== 'league' && port.faction !== 'harpoon') continue;
    const n = port.size >= 3 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const cls: ShipClassId = port.size >= 3 && i === 0 ? 'frigate' : i === 1 ? 'brig' : 'brigantine';
      const ship = game.spawnNpcShip('patrol', cls, port.faction, port.x, port.y, game.rng.range(0, 6.28));
      ship.purse = 200 + game.rng.int(0, 300);
      const brain = game.npcs.get(ship.id)!;
      brain.area = { x: port.x, y: port.y, r: port.size >= 3 ? 11000 : 8000 };
      brain.destPort = null;
      if (!planWander(game, ship, brain)) game.removeShip(ship.id);
    }
  }
}

export function spawnGhost(game: Game): void {
  const regions: RegionId[] = ['drowned_crown', 'dead_mans_expanse', 'the_abyss'];
  const region = game.rng.pick(regions);
  const [cx, cy] = REGIONS[region].center;
  const x = cx + game.rng.range(-6000, 6000), y = cy + game.rng.range(-6000, 6000);
  if (isLand(game.world, x, y)) return;
  const ship = game.spawnNpcShip('ghost', 'ghost_ship', 'choir', x, y, game.rng.range(0, 6.28), { ship: 'The Hollow Psalm', captain: 'Something Wearing a Captain' });
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
  const ship = game.spawnNpcShip('hunter', game.rng.chance(0.5) ? 'frigate' : 'brig', 'crown', x, y, headingOf(prey.state.x - x, prey.state.y - y), {
    ship: 'HMS ' + pick(game, ['Relentless', 'Verdict', 'Long Arm', 'Gallows Oath', 'Writ of Iron']), captain: 'Bounty Hunter ' + pick(game, CAPTAIN_NAMES),
  });
  ship.purse = 400;
  const brain = game.npcs.get(ship.id)!;
  brain.huntAccount = accountId;
  brain.area = { x: prey.state.x, y: prey.state.y, r: 6000 };
  brain.expiresAt = game.now + 600;
  planWander(game, ship, brain);
  game.toastShip(prey, `A Crown bounty hunter has picked up your trail: ${ship.name}.`, 'bad');
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
}
