// The authoritative game server: owns the world, runs the fixed-rate simulation, manages sessions,
// interest management, snapshots and persistence. Systems live in sibling modules.

import {
  CHUNK_STREAM_RADIUS, INTEREST_RADIUS, LOOT_LIFETIME_SEC, LOGOUT_TIMER_SEC, PORT_DOCK_RADIUS, PROTOCOL_VERSION,
  SAIL_STEPS, SNAPSHOT_EVERY_TICKS, TICK_DT, WORLD_SEED, WORLD_SIZE, isNight,
} from '../../../shared/src/constants.ts';
import { CAPTAINS, CAPTAIN_IDS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { FACTIONS, WANTED_TITLES, wantedLevel } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { AMMO_IDS, CHASER_RELOAD, SHIP_CLASSES, defaultGunFor, emptyAmmo } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { TALENTS_BY_ID, canLearn } from '../../../shared/src/data/talents.ts';
import { clamp, closestOnPolygon, dist, headingVec, pointInPolygon } from '../../../shared/src/math.ts';
import type {
  BoardingResult, ClientMsg, EntityInfo, GameEvent, IslandData, LootRow, PortPublic, SelfRow, ServerMsg, ShipRow, Side,
} from '../../../shared/src/protocol.ts';
import { SF, STATIONS, curseStage } from '../../../shared/src/protocol.ts';
import { buildSites, buyRights, ownSiteNear, siteView, tickSites, warehouseAction } from './resources.ts';
import type { ResourceSite } from './resources.ts';
import {
  acceptForward, bankAction, buyPolicy, cancelOrder, claimPolicy, collectDebt, decayClaims, expireForwards, fillOrder, postOrder,
  settleForwards, settleOrders, tickLoan, tickOrders,
} from './finance.ts';
import type { BuyOrder, Forward } from './finance.ts';
import { econCheckpoint, economyReport } from './econmetrics.ts';
import { checkChartDeed, checkDeeds, checkStatDeeds, grantDeed, learnContext, onDockDeeds, onLevelUp, respec, switchLoadout, unspentPoints } from './progression.ts';
import type { RespecMode } from './progression.ts';
import type { EconomyReport, IndexPoint } from './econmetrics.ts';
import { detonateFireship, fireMount, isTethered, mountReloadTime, shipyardMount, stepTethers } from './mounts.ts';
import { STATION_NAMES, floodCapacity, setStation, stepFlooding } from './damagecontrol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { encodeSnap } from '../../../shared/src/codec.ts';
import { polarEfficiency, relWindDeg, stepSailing } from '../../../shared/src/sim/sailing.ts';
import { cargoValue, cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import type { AmmoStock, Cargo } from '../../../shared/src/sim/shipstats.ts';
import { windAt } from '../../../shared/src/sim/wind.ts';
import type { WindSample } from '../../../shared/src/sim/wind.ts';
import { REGIONS, WORLD_EDGE_MARGIN } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { chunkKey, chunkOf, currentAt, depthAt, whirlpoolAt, generateWorld, islandsNear, regionAt } from '../../../shared/src/world/worldgen.ts';
import type { Island, Port, World } from '../../../shared/src/world/worldgen.ts';
import type { AuthService } from '../auth.ts';
import { sanitizeName } from '../auth.ts';
import type { WsConnection } from '../net/websocket.ts';
import type { Database } from '../persistence/db.ts';
import { stepStrikes, useAbility } from './abilities.ts';
import { CURSE_MORALE, cleanse, curseAura, stepCurse } from './curse.ts';
import { FEATURE_NAMES, findLandable, startLanding, stepLanding } from './exploration.ts';
import type { DelayedStrike } from './abilities.ts';
import { canBoard, startBoarding, stepBoarding } from './boarding.ts';
import { applyDamage, fireBroadside, fireChaser, reloadTime, stepProjectiles } from './combat.ts';
import { stepPivot, stepTalentEffects, stepTalents, useTalentActive } from './talentfx.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import type { Projectile, VolleyRec } from './combat.ts';
import { ECON_HOUR, createMarket, restoreMarkets, serializeMarkets, tickMarket } from './economy.ts';
import type { Market } from './economy.ts';
import { RouteCache } from './nav.ts';
import {
  QUOTA, abstractEncounters, newBrain, npcHostileTo, npcName, spawnFisher, spawnGhost, spawnHunter, spawnMerchant, spawnPatrols, spawnPirate, updateNpc,
} from './npc.ts';
import type { NpcBrain } from './npc.ts';
import { PlayerSession, addXp, canDock, changeRep, newProfile, sanitizeProfile, toPrivateState } from './player.ts';
import type { Profile } from './player.ts';
import {
  buildPortView, buyAmmo, buyChart, buyLicence, sellCharts, generateContracts, hireCrew, pardon, recordIntel, shipyardBuy, shipyardGuns, shipyardModule, shipyardRepair, trade,
} from './ports.ts';
import { ShipEntity } from './ship.ts';
import type { NpcRole } from './ship.ts';
import { SpatialGrid } from './spatial.ts';
import { WEATHER_FOG, WEATHER_WIND, initWeather, seaStateSpread, stepFronts, stepWeather, weatherAtPoint } from './weather.ts';
import type { Front, RegionWeather } from './weather.ts';

interface Loot {
  id: number;
  x: number;
  y: number;
  cargo: Cargo;
  gold: number;
  expires: number;
}

interface Rumor {
  x: number;
  y: number;
  text: string;
  t: number;
}

interface QueuedEvent {
  ev: GameEvent;
  x: number;
  y: number;
}

export interface GameOptions {
  db: Database;
  auth: AuthService;
  seed?: number;
  log?: (msg: string) => void;
}

const START_PORT = 'saltmarrow';

const WEATHER_TOAST: Record<string, string> = {
  calm: 'The wind dies. Sails hang slack.', breeze: 'A light breeze fills the canvas.', wind: 'A fresh wind — good sailing.',
  fog: 'Fog rolls in. Lookouts see half as far.', rain: 'Rain sweeps the deck.', storm: 'Storm! Reef the sails or lose them.',
  black_storm: 'A black storm. The crew will not look at the water.',
}

export class Game {
  readonly db: Database;
  readonly auth: AuthService;
  readonly world: World;
  readonly rng: Rng;
  readonly routes: RouteCache;
  readonly log: (msg: string) => void;

  now = 0; // world time, seconds
  tick = 0;
  ships = new Map<number, ShipEntity>();
  npcs = new Map<number, NpcBrain>();
  grid = new SpatialGrid(1000, WORLD_SIZE);
  projectiles: Projectile[] = [];
  strikes: DelayedStrike[] = [];
  loot = new Map<number, Loot>();
  markets = new Map<string, Market>();
  tavernCrew = new Map<string, number>();
  contracts = new Map<string, { list: ReturnType<typeof generateContracts>; refreshAt: number }>();
  rumors: Rumor[] = [];
  weather: Record<RegionId, RegionWeather>;
  fronts: Front[] = [];
  sites: ResourceSite[];
  forwardBoards = new Map<string, { list: Forward[]; refreshAt: number }>();
  orders: BuyOrder[] = [];
  volleys = new Map<number, VolleyRec>();
  econHistory: IndexPoint[] = [];
  econRewardMul = 1;
  private nextEconCheckpoint = 0;
  private lastWeather = new WeakMap<PlayerSession, string>();
  sessions = new Set<PlayerSession>();
  private byAccount = new Map<number, PlayerSession>();
  private events: QueuedEvent[] = [];
  private nextId = 1;
  private portIndex = new Map<string, Port>();
  private lastSelf = new WeakMap<PlayerSession, string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextEconTick = 0;
  private nextHistory = 0;
  private nextDirector = 0;
  private nextSecond = 0;
  private nextSave = 0;
  private nextWorldEvent = 0;
  private nearestPlayer = new Map<number, number>();
  private patrolsSpawnedAt = -1;

  constructor(opts: GameOptions) {
    this.db = opts.db;
    this.auth = opts.auth;
    this.log = opts.log ?? ((m) => console.log(m));
    const seed = opts.seed ?? WORLD_SEED;
    this.world = generateWorld(seed);
    this.rng = new Rng(seed ^ 0x5eed);
    this.routes = new RouteCache(this.world);
    for (const p of this.world.ports) {
      this.portIndex.set(p.id, p);
      this.markets.set(p.id, createMarket(p));
      this.tavernCrew.set(p.id, 10 + p.size * 12);
    }
    const saved = this.db.getKv<{ time: number; markets: Record<string, Record<string, [number, number]>> }>('world');
    if (saved) {
      this.now = saved.time;
      restoreMarkets(this.markets, saved.markets);
    }
    this.sites = buildSites(this.world);
    const savedSites = this.db.getKv<Record<string, { stock: number; holder: number | null; holderName: string; until: number }>>('sites');
    if (savedSites) for (const site of this.sites) if (savedSites[site.id]) Object.assign(site, savedSites[site.id]);
    this.orders = this.db.getKv<BuyOrder[]>('orders') ?? [];
    const econ = this.db.getKv<{ history: IndexPoint[]; rewardMul: number }>('econ');
    if (econ) {
      this.econHistory = econ.history ?? [];
      this.econRewardMul = econ.rewardMul ?? 1;
    }
    this.weather = initWeather(this.rng, this.now);
    this.nextWorldEvent = this.now + 600;
  }

  // ================================================================= lifecycle

  start(): void {
    this.bootPopulation();
    let last = performance.now();
    let acc = 0;
    this.timer = setInterval(() => {
      const t = performance.now();
      acc += (t - last) / 1000;
      last = t;
      let steps = 0;
      while (acc >= TICK_DT && steps < 5) {
        this.step();
        acc -= TICK_DT;
        steps++;
      }
      if (steps === 5) acc = 0; // drop time rather than spiral
    }, 1000 * TICK_DT * 0.5);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.saveAll();
  }

  bootPopulation(): void {
    for (let i = 0; i < QUOTA.merchants; i++) spawnMerchant(this);
    for (let i = 0; i < QUOTA.pirates; i++) spawnPirate(this);
    for (let i = 0; i < QUOTA.fishers; i++) spawnFisher(this);
    for (let i = 0; i < QUOTA.ghosts; i++) spawnGhost(this);
    spawnPatrols(this);
    this.patrolsSpawnedAt = this.now;
    this.log(`[world] ${this.world.islands.length} islands, ${this.world.ports.length} ports, ${this.ships.size} NPC ships`);
  }

  /** One fixed simulation step. Public for tests. */
  step(): void {
    const dt = TICK_DT;
    this.now += dt;
    this.tick++;
    const now = this.now;

    if (now >= this.nextSecond) {
      this.nextSecond = now + 1;
      this.everySecond();
    }
    if (now >= this.nextDirector) {
      this.nextDirector = now + 2;
      this.director();
    }
    if (now >= this.nextEconTick) {
      const edt = this.nextEconTick === 0 ? 0 : 10;
      this.nextEconTick = now + 10;
      const hist = now >= this.nextHistory;
      if (hist) this.nextHistory = now + 60;
      for (const m of this.markets.values()) tickMarket(m, edt, hist);
      for (const p of this.world.ports) this.tavernCrew.set(p.id, Math.min(10 + p.size * 14, (this.tavernCrew.get(p.id) ?? 0) + 0.6 * p.size));
      stepWeather(this.weather, this.rng, now);
      tickSites(this, edt);
      tickOrders(this);
      if (now >= this.nextEconCheckpoint) {
        if (this.nextEconCheckpoint !== 0) {
          const r = econCheckpoint(this);
          if (r.status !== 'stable') this.log(`[economy] ${r.status}: net ${r.netPerHour}/h on supply ${r.supply.total}, contract rewards ×${r.rewardMul}`);
        }
        this.nextEconCheckpoint = now + 3600;
      }
      this.fronts = stepFronts(this.fronts, this.rng, now, edt, (x, y) => windAt(this.world.seed, now, x, y).dir);
    }
    if (now >= this.nextWorldEvent) {
      this.nextWorldEvent = now + 900 + this.rng.range(0, 600);
      this.worldEvent();
    }

    // NPC AI (LOD-aware).
    for (const [id, brain] of this.npcs) {
      const ship = this.ships.get(id);
      if (!ship) {
        this.npcs.delete(id);
        continue;
      }
      updateNpc(this, ship, brain, dt, this.nearestPlayer.get(id) ?? Infinity);
    }

    // Movement for every physically simulated ship.
    const night = isNight(now);
    for (const ship of this.ships.values()) {
      if (ship.docked) continue;
      const brain = this.npcs.get(ship.id);
      if (brain && !brain.active) continue;
      this.physics(ship, dt, night);
    }
    this.collideShips();
    stepTethers(this, dt);
    stepProjectiles(this, dt);
    stepBoarding(this);
    stepStrikes(this);

    for (const ship of this.ships.values()) {
      if (ship.reload.port > 0) {
        ship.reload.port = Math.max(0, ship.reload.port - dt);
        if (ship.reload.port === 0) ship.loadedSince.port = this.now;
      }
      if (ship.reload.starboard > 0) {
        ship.reload.starboard = Math.max(0, ship.reload.starboard - dt);
        if (ship.reload.starboard === 0) ship.loadedSince.starboard = this.now;
      }
      if (ship.mountReload > 0) ship.mountReload = Math.max(0, ship.mountReload - dt);
      if (ship.chaserReload.bow > 0) ship.chaserReload.bow = Math.max(0, ship.chaserReload.bow - dt);
      if (ship.chaserReload.stern > 0) ship.chaserReload.stern = Math.max(0, ship.chaserReload.stern - dt);
      if (ship.sinkingUntil && now >= ship.sinkingUntil) this.finalizeSink(ship);
    }

    if (this.tick % SNAPSHOT_EVERY_TICKS === 0) this.sendSnapshots();
    if (now >= this.nextSave) {
      this.nextSave = now + 30;
      this.saveAll();
    }
  }

  // ================================================================= physics

  windFor(ship: ShipEntity): WindSample {
    return windAt(this.world.seed, this.now, ship.state.x, ship.state.y, WEATHER_WIND[this.weatherAt(ship.state.x, ship.state.y)]);
  }

  /** Local weather: travelling fronts over the regional baseline. */
  weatherAt(x: number, y: number) {
    return weatherAtPoint(this.fronts, this.weather[regionAt(this.world, x, y)].kind, x, y);
  }

  weatherOf(ship: ShipEntity) {
    return this.weatherAt(ship.state.x, ship.state.y);
  }

  /** Broadside spread multiplier from the sea state around a ship. */
  seaSpread(ship: ShipEntity): number {
    // Sea Legs: gunners who keep their feet lose less to the swell.
    const base = seaStateSpread(this.windFor(ship).strength, ship.cls.tier);
    return 1 + (base - 1) * Math.max(0, 1 + tval(ship.stats, 'seaPenalty'));
  }

  private physics(ship: ShipEntity, dt: number, night: boolean): void {
    if (ship.sinkingUntil) {
      ship.state.speed *= 0.97;
      return;
    }
    if (ship.boarding || ship.landing) {
      // Grappled, or riding at anchor while the boats are ashore.
      if (ship.landing) ship.state.speed = 0;
      this.grid.upsert(ship.id, ship.state.x, ship.state.y);
      return;
    }
    const wind = this.windFor(ship);
    const cur = currentAt(this.world.currents, ship.state.x, ship.state.y, this.now, this.world.whirlpools);
    const prevX = ship.state.x, prevY = ship.state.y;
    ship.state = stepSailing(ship.state, ship.input, ship.sailParams(night), wind, cur, dt);
    stepPivot(this, ship, dt);

    // Islands: test bow, stern and centre against nearby coastlines.
    const fwd = headingVec(ship.state.heading);
    const half = ship.stats.length * 0.45;
    const probes: [number, number][] = [
      [ship.state.x + fwd.x * half, ship.state.y + fwd.y * half],
      [ship.state.x, ship.state.y],
      [ship.state.x - fwd.x * half, ship.state.y - fwd.y * half],
    ];
    for (const [px, py] of probes) {
      for (const id of islandsNear(this.world, px, py)) {
        const is = this.world.islands[id];
        if (Math.abs(is.x - px) > is.radius || Math.abs(is.y - py) > is.radius) continue;
        if (!pointInPolygon(px, py, is.poly)) continue;
        const c = closestOnPolygon(px, py, is.poly);
        const nx = c.x - px, ny = c.y - py;
        const len = Math.hypot(nx, ny) || 1;
        ship.state.x += nx + (nx / len) * 3;
        ship.state.y += ny + (ny / len) * 3;
        if (ship.state.speed > 3.5) {
          const dmg = ship.state.speed * ship.state.speed * 1.4 * (0.6 + ship.cls.tier * 0.2);
          applyDamage(this, ship, { hull: dmg, sails: 2, morale: 3 }, null);
          this.toastShip(ship, 'Ran aground! The keel groans.', 'bad');
        }
        ship.state.speed *= 0.25;
      }
    }
    // Shoals and reefs: a keel deeper than the water drags and splinters (Shallow Runners skate over).
    const draft = ship.cls.draft * Math.max(0.5, 1 + tval(ship.stats, 'draftMul'));
    if (ship.cls.passive.id !== 'shallow_runner' && ship.state.speed > 0.4) {
      const depth = depthAt(this.world, probes[0][0], probes[0][1]);
      if (depth < draft) {
        const over = draft - depth;
        if (ship.state.speed > 1) {
          applyDamage(this, ship, { hull: over * ship.state.speed * 0.3 * ship.cls.tier * Math.max(0, 1 + tval(ship.stats, 'reefDamage')) }, null);
          if (this.tick % 20 === 0) this.toastShip(ship, depth < 2.5 ? 'Your keel grinds over the reef!' : 'Shoal water — she is dragging her keel.', 'bad');
        }
        ship.state.speed *= Math.max(0.9, 1 - over * 0.02);
      }
    }
    // The Maelstrom Wall.
    const m = WORLD_EDGE_MARGIN * 0.6;
    if (ship.state.x < m || ship.state.y < m || ship.state.x > WORLD_SIZE - m || ship.state.y > WORLD_SIZE - m) {
      ship.state.x = clamp(ship.state.x, m, WORLD_SIZE - m);
      ship.state.y = clamp(ship.state.y, m, WORLD_SIZE - m);
      ship.state.speed *= 0.5;
      if (this.tick % 20 === 0) {
        applyDamage(this, ship, { hull: ship.stats.hullMax * 0.02, sails: 5 }, null);
        this.toastShip(ship, 'The Maelstrom Wall tears at your rigging. Turn back.', 'bad');
      }
    }
    ship.distanceLog += Math.hypot(ship.state.x - prevX, ship.state.y - prevY);
    this.grid.upsert(ship.id, ship.state.x, ship.state.y);
  }

  private collideShips(): void {
    for (const a of this.ships.values()) {
      if (a.docked || !a.alive) continue;
      const brainA = this.npcs.get(a.id);
      if (brainA && !brainA.active) continue;
      const ra = a.stats.length * 0.32;
      this.grid.query(a.state.x, a.state.y, 80, (id) => {
        if (id <= a.id) return;
        const b = this.ships.get(id);
        if (!b || b.docked || !b.alive) return;
        if (a.boarding?.with === b.id) return;
        const rb = b.stats.length * 0.32;
        const d = dist(a.state.x, a.state.y, b.state.x, b.state.y);
        const overlap = ra + rb - d;
        if (overlap <= 0) return;
        const nx = (b.state.x - a.state.x) / (d || 1), ny = (b.state.y - a.state.y) / (d || 1);
        const ma = SHIP_CLASSES[a.loadout.classId].hull, mb = SHIP_CLASSES[b.loadout.classId].hull;
        const wa = mb / (ma + mb), wb = ma / (ma + mb);
        a.state.x -= nx * overlap * wa;
        a.state.y -= ny * overlap * wa;
        b.state.x += nx * overlap * wb;
        b.state.y += ny * overlap * wb;
        const va = headingVec(a.state.heading), vb = headingVec(b.state.heading);
        const closing = (va.x * a.state.speed - vb.x * b.state.speed) * nx + (va.y * a.state.speed - vb.y * b.state.speed) * ny;
        if (closing > 3) {
          const ramA = a.hasEffect('ramming_speed') ? 3 : 1, ramB = b.hasEffect('ramming_speed') ? 3 : 1;
          const base = closing * closing * 2.2;
          applyDamage(this, b, { hull: base * ramA * (ma / (ma + mb)) * 2, crew: 1, morale: 4 }, a);
          applyDamage(this, a, { hull: (base * (mb / (ma + mb)) * 2) / ramA, morale: 2 }, b);
          this.emit({ k: 'fx', fx: 'ram', x: Math.round((a.state.x + b.state.x) / 2), y: Math.round((a.state.y + b.state.y) / 2) }, a.state.x, a.state.y);
          a.state.speed *= 0.4;
          b.state.speed *= 0.6;
        }
      });
    }
  }

  // ================================================================= periodic systems

  private everySecond(): void {
    const now = this.now;
    // Nearest player distance for NPC LOD.
    const players: ShipEntity[] = [];
    for (const s of this.sessions) if (s.ship && !s.ship.docked) players.push(s.ship);
    for (const s of this.byAccount.values()) if (s.disconnectedAt !== null && s.ship && !players.includes(s.ship)) players.push(s.ship);
    for (const [id] of this.npcs) {
      const ship = this.ships.get(id);
      if (!ship) continue;
      let best = Infinity;
      for (const p of players) {
        const d = Math.abs(p.state.x - ship.state.x) + Math.abs(p.state.y - ship.state.y);
        if (d < best) best = d;
      }
      this.nearestPlayer.set(id, best * 0.75);
    }

    for (const ship of this.ships.values()) {
      if (ship.effects.length && ship.effects.some((e) => e.until <= now)) ship.recompute(now);
      ship.region = regionAt(this.world, ship.state.x, ship.state.y);
      if (!ship.alive || ship.docked) continue;
      const brain = this.npcs.get(ship.id);
      if (brain && !brain.active) continue;
      this.shipUpkeep(ship);
      stepTalentEffects(this, ship);
      if (ship.isPlayer) stepTalents(this, ship);
    }
    for (const [id, v] of this.volleys) if (now - v.t > 30) this.volleys.delete(id);

    // Loot: expiry and pickup.
    for (const l of this.loot.values()) {
      if (l.expires <= now) {
        this.loot.delete(l.id);
        continue;
      }
      this.grid.query(l.x, l.y, 60, (id) => {
        const s = this.ships.get(id);
        if (!s || !s.isPlayer || !s.alive || s.docked) return;
        if (dist(s.state.x, s.state.y, l.x, l.y) > s.stats.length / 2 + 30) return;
        this.pickupLoot(s, l);
      });
    }

    // Sessions: chunk streaming, discovery, regions, lingering ships, private state.
    for (const s of [...this.byAccount.values()]) {
      if (s.disconnectedAt !== null) {
        if (now >= s.lingerUntil && !(s.ship && s.ship.inCombat(now) && now < s.lingerUntil + 60)) this.retireSession(s);
        continue;
      }
      if (!s.ship || !s.profile) continue;
      this.streamChunks(s);
      this.discover(s);
      this.recordSightings(s);
      if (s.ship.landing) stepLanding(this, s.ship);
      expireForwards(this, s);
      checkDeeds(this, s, 1);
      tickLoan(this, s);
      if (this.tick % 1200 < 20) decayClaims(this, s.profile);
      s.siteViews = this.sites.filter((x) => x.holder === s.accountId && x.until > this.now).map((x) => siteView(this, s, x));
      const own = s.ship.docked || s.ship.landing ? null : ownSiteNear(this, s);
      const land = s.ship.docked || s.ship.landing || own ? null : findLandable(this, s);
      s.landable = own
        ? { island: own.island.name, feature: `stockpile of ${GOODS[own.site.good].name.toLowerCase()} (${Math.floor(own.site.stock)})` }
        : land ? { island: land.island.name, feature: FEATURE_NAMES[land.feature] } : null;
      const wNow = this.weatherOf(s.ship);
      const wPrev = this.lastWeather.get(s);
      if (wPrev && wPrev !== wNow) this.sendTo(s, { t: 'toast', msg: WEATHER_TOAST[wNow], kind: wNow === 'storm' || wNow === 'black_storm' ? 'bad' : 'info' });
      this.lastWeather.set(s, wNow);
      if (this.tick % 60 < 20) this.sendFronts(s);
      const region = s.ship.region;
      if (region !== s.lastRegion) {
        s.lastRegion = region;
        const r = REGIONS[region];
        this.sendTo(s, { t: 'ev', list: [{ k: 'region', region, safety: r.safety }] });
        if (!s.profile.regionsSeen.includes(region)) {
          s.profile.regionsSeen.push(region);
          if (s.profile.regionsSeen.length > 1) this.grantXp(s, 150 + r.strangeness * 600, `Discovered ${r.name}`);
        }
      }
      if (s.ship.distanceLog > 0) {
        s.profile.stats.distance += s.ship.distanceLog;
        s.ship.distanceLog = 0;
      }
      this.pushSelf(s);
    }
  }

  private shipUpkeep(ship: ShipEntity): void {
    const now = this.now;
    const st = ship.stats;
    // Morale drifts toward a baseline set by provisions, rum and cursed cargo.
    let baseline = 70;
    if (ship.isPlayer && (ship.cargo.provisions ?? 0) <= 0) baseline = 25;
    if ((ship.cargo.rum ?? 0) > 0) baseline += 8;
    if ((ship.cargo.cursed_relics ?? 0) > 0 && ship.cls.passive.id !== 'dead_crew') baseline -= 6 + Math.min(20, (ship.cargo.cursed_relics ?? 0) * 2);
    if (this.weatherOf(ship) === 'black_storm') baseline -= 15;
    baseline -= CURSE_MORALE[curseStage(ship.curse)];
    ship.morale += clamp(baseline - ship.morale, -1, 1) * st.moraleRegen;
    ship.morale = clamp(ship.morale, 0, 100);

    // Provisions: 1 unit feeds 40 sailors for a minute.
    if (ship.isPlayer && this.tick % 200 === 0) {
      const eat = (ship.crew / 40) * (10 / 60) * 6 * st.provisionUse;
      const have = ship.cargo.provisions ?? 0;
      if (have > 0) {
        const left = Math.max(0, have - eat);
        if (left <= 0) delete ship.cargo.provisions;
        else ship.cargo.provisions = Math.round(left * 100) / 100;
        if (left <= 0) this.toastShip(ship, 'The last biscuit is gone. The crew grows mutinous.', 'bad');
      }
    }

    // Perishables rot in the hold; salt aboard halves the loss.
    if (ship.isPlayer) {
      for (const id in ship.cargo) {
        const g = id as GoodId;
        const spoil = GOODS[g].spoilPerHour;
        const n = ship.cargo[g] ?? 0;
        if (!spoil || n <= 0 || g === 'provisions') continue; // provisions are eaten, not left to rot
        const acc = (ship.spoilAcc[g] ?? 0) + ((n * spoil * ((ship.cargo.salt ?? 0) > 0 ? 0.5 : 1)) / ECON_HOUR) * (this.weatherOf(ship) === 'rain' ? 1.3 : 1);
        if (acc >= 1) {
          const lost = Math.floor(acc);
          ship.cargo[g] = Math.max(0, n - lost);
          if (!ship.cargo[g]) delete ship.cargo[g];
          ship.spoilAcc[g] = acc - lost;
          this.toastShip(ship, `${lost} ${GOODS[g].name.toLowerCase()} spoiled in the damp hold.`, 'bad');
        } else ship.spoilAcc[g] = acc;
      }
    }
    // Repairs: carpenters consume planks and sailcloth.
    if (ship.repairing) {
      const inCombat = ship.inCombat(now);
      const rate = inCombat ? st.battleRepairRate : 1;
      if (rate <= 0) {
        ship.repairing = false;
        this.toastShip(ship, 'Carpenters cannot work under fire.', 'bad');
      } else {
        const crewF = Math.min(1, ship.crew / Math.max(1, st.crewMin * 2));
        const hullGain = Math.min(st.hullMax - ship.hull, st.hullMax * 0.012 * st.repairRate * crewF * rate);
        const planksNeeded = hullGain / 40;
        const sailGain = Math.min(st.sailHpMax - ship.sails, st.sailHpMax * 0.02 * st.repairRate * crewF * rate);
        const clothNeeded = sailGain / 20;
        const planks = ship.cargo.planks ?? 0, cloth = ship.cargo.sailcloth ?? 0;
        let did = false;
        if (hullGain > 0.5 && planks >= planksNeeded) {
          ship.hull += hullGain;
          ship.cargo.planks = Math.round((planks - planksNeeded) * 100) / 100;
          did = true;
        }
        if (sailGain > 0.2 && cloth >= clothNeeded) {
          ship.sails += sailGain;
          ship.cargo.sailcloth = Math.round((cloth - clothNeeded) * 100) / 100;
          did = true;
        }
        if (ship.rudderHp < 1 && planks > 0.2) {
          ship.rudderHp = Math.min(1, ship.rudderHp + 0.01 * st.repairRate);
          did = true;
        }
        if ((ship.cargo.planks ?? 0) <= 0.01) delete ship.cargo.planks;
        if ((ship.cargo.sailcloth ?? 0) <= 0.01) delete ship.cargo.sailcloth;
        if (!did) {
          ship.repairing = false;
          const full = ship.hull >= st.hullMax - 0.5 && ship.sails >= st.sailHpMax - 0.5;
          this.toastShip(ship, full ? 'Repairs complete.' : 'Out of planks or sailcloth for repairs.', full ? 'good' : 'bad');
        }
      }
    }
    // The eye of a maelstrom grinds ships apart.
    const wp = whirlpoolAt(this.world.whirlpools, ship.state.x, ship.state.y);
    if (wp.core) {
      applyDamage(this, ship, { hull: st.hullMax * 0.02, sails: 2, crew: 0.3, morale: 2 }, null);
      if (this.tick % 60 === 0) this.toastShip(ship, `${wp.core.name} is tearing her apart — claw out of the eye!`, 'bad');
    }
    // The sea's claim.
    if (stepCurse(this, ship)) {
      const stage = curseStage(ship.curse);
      this.toastShip(ship, ['The hull is clean again.', 'Barnacles and bone crust the hull.', 'The planks weep brine; the crew mutters at night.', 'Something glows in the timbers. The deep has claimed her.'][stage], stage >= 2 ? 'bad' : 'info');
    }
    curseAura(this, ship);
    // Brine Mend heal-over-time.
    if (ship.hasEffect('brine_mend')) ship.hull = Math.min(st.hullMax, ship.hull + st.hullMax * 0.025);
    // Fireship charges.
    if (ship.fuseAt && this.now >= ship.fuseAt) {
      detonateFireship(this, ship);
      return;
    }
    // Leaks, pumps and plugs.
    if (stepFlooding(this, ship)) return;
    // Fire.
    if (ship.hasEffect('fire')) applyDamage(this, ship, { hull: st.hullMax * 0.006, sails: 1.5 }, null);
    // Storms punish full canvas.
    const w = this.weatherOf(ship);
    const canvas = ship.hasFlag('storm_rider') ? 0 : Math.max(0, 1 + tval(st, 'stormSailDamage'));
    if ((w === 'storm' || w === 'black_storm') && ship.state.sail > 0.8 && ship.cls.passive.id !== 'dead_crew' && canvas > 0) {
      ship.sails = Math.max(0, ship.sails - st.sailHpMax * 0.012 * canvas);
      if (this.tick % 200 === 0) this.toastShip(ship, 'The storm is shredding your canvas — reef the sails!', 'bad');
    }
    // Infamy slowly fades while you behave.
    if (ship.isPlayer && !ship.inCombat(now)) {
      const p = this.profileOf(ship);
      if (p && p.infamy > 0) {
        p.infamy = Math.max(0, p.infamy - 0.05);
        ship.wantedCache = wantedLevel(p.infamy);
      }
    }
  }

  private director(): void {
    const now = this.now;
    const counts: Record<NpcRole, number> = { merchant: 0, patrol: 0, pirate: 0, hunter: 0, fisher: 0, ghost: 0, escort: 0 };
    for (const b of this.npcs.values()) counts[b.role]++;
    for (let i = 0; counts.merchant + i < QUOTA.merchants && i < 2; i++) spawnMerchant(this);
    if (counts.pirate < QUOTA.pirates) spawnPirate(this);
    if (counts.fisher < QUOTA.fishers) spawnFisher(this);
    if (counts.ghost < QUOTA.ghosts && this.rng.chance(0.02)) spawnGhost(this);
    if (counts.patrol < 10 && now - this.patrolsSpawnedAt > 300) {
      spawnPatrols(this);
      this.patrolsSpawnedAt = now;
    }
    if (this.tick % 200 === 0) abstractEncounters(this);
    // Encounters near players: the ocean is never empty outside safe waters.
    for (const s of this.sessions) {
      const ship = s.ship;
      if (!ship || ship.docked || !s.profile) continue;
      const safety = REGIONS[ship.region].safety;
      if (safety !== 'safe' && this.rng.chance(0.04)) {
        let pirateNear = false;
        this.forShipsNear(ship.state.x, ship.state.y, 5000, (o) => {
          if (o.npcRole === 'pirate') pirateNear = true;
        });
        if (!pirateNear) spawnPirate(this, ship);
      }
      if (ship.wantedCache >= 3 && this.rng.chance(0.03)) {
        let hunted = false;
        for (const b of this.npcs.values()) if (b.huntAccount === s.accountId) hunted = true;
        if (!hunted) spawnHunter(this, ship, s.accountId);
      }
    }
  }

  private worldEvent(): void {
    const port = this.rng.pick(this.world.ports.filter((p) => p.key));
    const market = this.markets.get(port.id)!;
    const kinds: [string, GoodId, number, string][] = [
      ['fever', 'medicine', 2.4, `Fever sweeps ${port.name}. Physicians pay any price for medicine.`],
      ['famine', 'provisions', 2.0, `Blight in the fields around ${port.name}: provisions are scarce.`],
      ['siege', 'gunpowder', 2.2, `${port.name} fears a siege and is buying every keg of powder.`],
      ['feast', 'rum', 1.9, `A saint's feast in ${port.name}. The taverns are dry.`],
      ['glut', 'sugar', 0.45, `A glut of sugar in ${port.name}. Prices collapse.`],
      ['yard', 'timber', 2.0, `${port.name}'s yards laid down new keels — timber is gold.`],
    ];
    const [, good, shock, text] = this.rng.pick(kinds);
    const gm = market.goods[good];
    if (!gm) return;
    gm.shock = shock;
    this.addRumor(port.x, port.y, text);
    for (const s of this.sessions) this.sendTo(s, { t: 'toast', msg: `WORLD: ${text}`, kind: 'info' });
    this.log(`[event] ${text}`);
  }

  // ================================================================= entities

  allocId(): number {
    return this.nextId++;
  }

  spawnNpcShip(role: NpcRole, classId: ShipClassId, faction: FactionId, x: number, y: number, heading: number, names?: { ship: string; captain: string }): ShipEntity {
    const n = names ?? npcName(this);
    const gun = defaultGunFor(SHIP_CLASSES[classId]);
    const ship = new ShipEntity({
      id: this.allocId(), name: n.ship, captainName: n.captain, captain: 'corsair', faction, accountId: null,
      loadout: { classId, name: n.ship, guns: { port: role === 'pirate' && classId !== 'sloop' ? 'carronade_24' : gun, starboard: gun }, modules: {} },
      talents: {}, x, y, heading,
    });
    ship.npcRole = role;
    ship.crew = Math.round(ship.stats.crewMax * (role === 'merchant' || role === 'fisher' ? 0.45 : 0.75));
    ship.morale = role === 'ghost' ? 100 : 70;
    ship.ammo = { ...emptyAmmo(), round: 400, chain: role === 'pirate' ? 120 : 40, grape: role === 'pirate' ? 120 : 40, incendiary: role === 'pirate' ? 20 : 0, heavy: role === 'patrol' || role === 'hunter' ? 60 : 0 };
    ship.level = role === 'ghost' ? 20 : ship.cls.tier * 3;
    ship.region = regionAt(this.world, x, y);
    ship.state.sail = 0.8;
    ship.input = { rudder: 0, sailTarget: 1 };
    this.ships.set(ship.id, ship);
    this.npcs.set(ship.id, newBrain(ship.id, role, this.now));
    return ship;
  }

  spawnEscort(owner: ShipEntity, duration: number): string | null {
    for (const s of this.ships.values()) if (s.ownerId === owner.id) return 'Your escort is already at sea';
    const back = headingVec(owner.state.heading + Math.PI);
    const x = owner.state.x + back.x * 300, y = owner.state.y + back.y * 300;
    const ship = this.spawnNpcShip('escort', 'brig', 'free', x, y, owner.state.heading, { ship: 'Hired Brig ' + this.rng.pick(['Tenacity', 'Warrant', 'Loyal Oath', 'Salt Debt']), captain: 'Sailing Master' });
    ship.ownerId = owner.id;
    ship.removeAt = this.now + duration;
    const brain = this.npcs.get(ship.id)!;
    brain.active = true;
    this.grid.upsert(ship.id, x, y);
    return null;
  }

  removeShip(id: number): void {
    const ship = this.ships.get(id);
    if (!ship) return;
    this.ships.delete(id);
    this.npcs.delete(id);
    this.grid.remove(id);
    this.nearestPlayer.delete(id);
    for (const other of this.ships.values()) {
      if (other.boarding?.with === id) other.boarding = null;
    }
  }

  forShipsNear(x: number, y: number, r: number, fn: (s: ShipEntity) => void): void {
    this.grid.query(x, y, r, (id) => {
      const s = this.ships.get(id);
      if (s && Math.abs(s.state.x - x) <= r && Math.abs(s.state.y - y) <= r) fn(s);
    });
  }

  portById(id: string): Port | undefined {
    return this.portIndex.get(id);
  }

  nearestPort(x: number, y: number, filter?: (p: Port) => boolean): Port | null {
    let best: Port | null = null, bd = Infinity;
    for (const p of this.world.ports) {
      if (filter && !filter(p)) continue;
      const d = dist(p.x, p.y, x, y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  regionAt(x: number, y: number): RegionId {
    return regionAt(this.world, x, y);
  }

  nearestIslandName(x: number, y: number): string {
    let best: Island | null = null, bd = Infinity;
    for (const is of this.world.islands) {
      const d = dist(is.x, is.y, x, y);
      if (d < bd) {
        bd = d;
        best = is;
      }
    }
    return best?.name ?? 'open water';
  }

  // ================================================================= relations

  profileOf(ship: ShipEntity): Profile | null {
    if (ship.accountId === null) return null;
    return this.byAccount.get(ship.accountId)?.profile ?? null;
  }

  economy(windowSec = 3600): EconomyReport {
    return economyReport(this, windowSec);
  }

  sessionByAccount(accountId: number): PlayerSession | null {
    return this.byAccount.get(accountId) ?? null;
  }

  sessionOf(ship: ShipEntity | null): PlayerSession | null {
    if (!ship || ship.accountId === null) return null;
    return this.byAccount.get(ship.accountId) ?? null;
  }

  shipOfAccount(accountId: number): ShipEntity | null {
    return this.byAccount.get(accountId)?.ship ?? null;
  }

  /** Would `a` attack `b`? (Used for AI and the HOSTILE flag from b's point of view.) */
  isHostile(a: ShipEntity, b: ShipEntity): boolean {
    if (a.id === b.id) return false;
    if (a.npcRole) return npcHostileTo(this, a, b);
    return (b.attackers.get(a.id) ?? -999) > this.now - 120 || (a.attackers.get(b.id) ?? -999) > this.now - 120;
  }

  areAllies(a: ShipEntity, b: ShipEntity): boolean {
    return (a.ownerId !== null && a.ownerId === b.id) || (b.ownerId !== null && b.ownerId === a.id) || (a.ownerId !== null && a.ownerId === b.ownerId);
  }

  adjustRep(ship: ShipEntity, faction: FactionId, delta: number): void {
    const p = this.profileOf(ship);
    if (p) changeRep(p, faction, delta);
  }

  adjustRepProfile(s: PlayerSession, faction: FactionId, delta: number): void {
    if (s.profile) changeRep(s.profile, faction, delta);
  }

  addInfamy(ship: ShipEntity, amount: number, reason: string): void {
    const p = this.profileOf(ship);
    if (!p) return;
    const before = wantedLevel(p.infamy);
    p.infamy = Math.min(900, p.infamy + amount);
    const after = wantedLevel(p.infamy);
    ship.wantedCache = after;
    if (after > before) this.toastShip(ship, `Wanted ${after}: ${WANTED_TITLES[after]} (${reason}).`, 'bad');
  }

  registerBoardingCrime(a: ShipEntity, b: ShipEntity): void {
    if (!a.isPlayer) return;
    const zone = REGIONS[b.region].safety;
    const mul = zone === 'safe' ? 2 : zone === 'contested' ? 1 : 0.3;
    if (b.faction !== 'player' && FACTIONS[b.faction].lawful) this.addInfamy(a, 10 * mul, `boarded ${b.name}`);
    else if (b.isPlayer && b.wantedCache < 2) this.addInfamy(a, 12 * mul, `boarded ${b.name}`);
  }

  spendGold(ship: ShipEntity, amount: number, reason: string): void {
    const p = this.profileOf(ship);
    if (!p) return;
    p.gold = Math.max(0, p.gold - amount);
    this.db.ledger(ship.accountId!, 'spend', -amount, reason);
  }

  grantXp(s: PlayerSession, amount: number, reason: string | null): void {
    if (!s.profile || amount <= 0) return;
    const gained = addXp(s.profile, amount);
    if (s.ship) s.ship.level = s.profile.level;
    if (reason) this.sendTo(s, { t: 'toast', msg: `+${Math.round(amount)} XP — ${reason}`, kind: 'xp' });
    if (gained > 0) {
      this.sendTo(s, { t: 'toast', msg: `Level ${s.profile.level}! A new talent point awaits.`, kind: 'good' });
      onLevelUp(this, s);
    }
  }

  costBasis(s: PlayerSession, good: GoodId): number {
    return s.profile?.costBasis[good] ?? GOODS[good].basePrice * 0.5;
  }

  setCostBasis(s: PlayerSession, good: GoodId, v: number): void {
    if (s.profile) s.profile.costBasis[good] = v;
  }

  // ================================================================= combat outcomes

  npcOnDamaged(target: ShipEntity, source: ShipEntity | null): void {
    const brain = this.npcs.get(target.id);
    if (!brain || !source) return;
    if (brain.role === 'merchant' || brain.role === 'fisher') brain.fleeFrom = source.id;
    // Holed below the waterline: every hand to the pumps (merchants) or keep the guns manned (warships).
    if (target.leaks >= 2 && target.station !== 'damage_control' && (brain.role === 'merchant' || target.leaks >= 4)) setStation(this, target, 'damage_control');
    else if (brain.target === null) brain.target = source.id;
    // Lawful ships call for help: nearby patrols join in.
    if (target.faction !== 'player' && FACTIONS[target.faction].lawful && source.isPlayer) {
      this.forShipsNear(target.state.x, target.state.y, 2600, (o) => {
        if (o.npcRole === 'patrol' && o.id !== target.id) o.attackers.set(source.id, this.now);
      });
    }
  }

  beginSinking(ship: ShipEntity): void {
    if (ship.sinkingUntil) return;
    ship.sinkingUntil = this.now + 6;
    ship.boarding = null;
    ship.repairing = false;
    ship.input = { rudder: 0, sailTarget: 0 };
    // Kill credit: the most recent attacker within 60 s.
    let killerId: number | null = null, lastT = -Infinity;
    for (const [id, t] of ship.attackers) if (t > this.now - 60 && t > lastT) {
      lastT = t;
      killerId = id;
    }
    const killer = killerId !== null ? this.ships.get(killerId) ?? null : null;
    this.emit({ k: 'sunk', ship: ship.id, x: Math.round(ship.state.x), y: Math.round(ship.state.y), name: ship.name }, ship.state.x, ship.state.y);
    this.dropWreckage(ship, 0.4);
    if (killer) this.creditKill(killer, ship, 'sunk');
  }

  private dropWreckage(ship: ShipEntity, frac: number): void {
    const cargo: Cargo = {};
    for (const id in ship.cargo) {
      const n = Math.floor((ship.cargo[id as GoodId] ?? 0) * frac);
      if (n > 0) cargo[id as GoodId] = n;
    }
    let gold = ship.isPlayer ? 0 : Math.floor(ship.purse * 0.5);
    if (ship.isPlayer) {
      const p = this.profileOf(ship);
      if (p) {
        gold = Math.floor(p.gold * 0.05);
        p.gold -= gold;
        if (gold && ship.accountId !== null) this.db.ledger(ship.accountId, 'loot_drop', -gold, 'wreck');
      }
    }
    if (!Object.keys(cargo).length && gold <= 0) return;
    const id = this.allocId();
    this.loot.set(id, { id, x: ship.state.x, y: ship.state.y, cargo, gold, expires: this.now + LOOT_LIFETIME_SEC });
  }

  private creditKill(killer: ShipEntity, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
    const s = this.sessionOf(killer);
    if (killer.ownerId !== null) {
      const owner = this.ships.get(killer.ownerId);
      if (owner) return this.creditKill(owner, victim, how);
    }
    if (!s || !s.profile) return;
    const p = s.profile;
    const tier = victim.cls.tier;
    const xp = (how === 'sunk' ? 45 : 70) * tier * (1 + victim.level / 12);
    if (how === 'sunk') p.stats.sunk++;
    else p.stats.boarded++;
    if (how === 'boarded') grantDeed(this, s, 'deed_first_prize');
    if (victim.loadout.classId === 'man_o_war') grantDeed(this, s, 'deed_ship_of_the_line');
    let escorts = 0;
    for (const o of this.ships.values()) if (o.ownerId === killer.id && o.alive) escorts++;
    if (escorts >= 2) grantDeed(this, s, 'deed_fleet_victory');
    checkStatDeeds(this, s);
    this.grantXp(s, xp, `${how === 'sunk' ? 'Sank' : 'Took'} ${victim.name}`);
    // Law and reputation.
    if (victim.faction !== 'player') {
      const f = FACTIONS[victim.faction];
      if (f.lawful) {
        const zone = REGIONS[victim.region].safety;
        if (how === 'sunk') this.addInfamy(killer, 12 * (zone === 'safe' ? 2 : zone === 'contested' ? 1 : 0.3), `sank ${victim.name}`);
        changeRep(p, victim.faction, -10);
      } else {
        changeRep(p, victim.faction, -6);
        if (victim.faction === 'confederacy') {
          changeRep(p, 'crown', 3);
          changeRep(p, 'league', 2);
        }
      }
    }
    if (victim.isPlayer && victim.wantedCache >= 2) {
      const vp = this.profileOf(victim);
      if (vp) {
        if (victim.wantedCache >= 3) grantDeed(this, s, 'deed_wanted_legend');
        const bounty = Math.round(vp.infamy * 6);
        p.gold += bounty;
        vp.infamy *= 0.6;
        victim.wantedCache = wantedLevel(vp.infamy);
        this.sendTo(s, { t: 'toast', msg: `Bounty collected on ${victim.captainName}: ${bounty} silver.`, kind: 'gold' });
        this.db.ledger(s.accountId, 'bounty', bounty, victim.captainName);
      }
    }
    // Contracts.
    for (const c of p.contracts) {
      if (c.kind === 'bounty' && victim.faction === c.targetFaction) {
        c.progress = (c.progress ?? 0) + 1;
        if ((c.progress ?? 0) >= (c.kills ?? 1)) this.completeContract(s, c.id);
      }
    }
  }

  private finalizeSink(ship: ShipEntity): void {
    const s = this.sessionOf(ship);
    if (ship.isPlayer && s && s.profile) {
      this.playerDeath(s, ship);
      return;
    }
    this.removeShip(ship.id);
  }

  private playerDeath(s: PlayerSession, ship: ShipEntity): void {
    const p = s.profile!;
    const lostValue = cargoValue(ship.cargo);
    const crewLost = Math.max(0, Math.round(ship.crew * 0.35));
    const cls = SHIP_CLASSES[ship.loadout.classId];
    const claim = claimPolicy(this, s, lostValue);
    const fee = claim.feeWaived ? 0 : Math.min(Math.floor(p.gold), Math.round(cls.price * 0.1));
    p.gold -= fee;
    // A tenth of the silver in the captain's chest goes down with her; the League bank keeps the rest safe.
    const purseLost = Math.floor(p.gold * 0.1);
    p.gold -= purseLost;
    if (purseLost) this.db.ledger(s.accountId, 'sunk_purse', -purseLost, ship.loadout.classId);
    if (claim.reason) this.sendTo(s, { t: 'toast', msg: claim.reason, kind: 'bad' });
    else if (claim.payout || claim.feeWaived) {
      p.gold += claim.payout;
      this.sendTo(s, { t: 'toast', msg: `The Gilded Ledger honours your policy${claim.feeWaived ? ': salvage fee waived' : ''}${claim.payout ? `${claim.feeWaived ? ',' : ':'} ${claim.payout} silver for lost cargo` : ''}.`, kind: 'gold' });
    }
    if (purseLost) this.sendTo(s, { t: 'toast', msg: `${purseLost} silver from the captain's chest went down with her.`, kind: 'bad' });
    // A sinking ends the voyage.
    p.deedState.voyagePorts = [];
    p.deedState.wantedTime = 0;
    // Respawn at the last port if it will still have us, otherwise the nearest that will.
    let port = this.portById(p.lastPort);
    if (!port || !canDock(p, port.faction).ok) port = this.nearestPort(ship.state.x, ship.state.y, (q) => canDock(p, q.faction).ok) ?? this.portById(START_PORT)!;
    ship.cargo = {};
    for (const a of AMMO_IDS) ship.ammo[a] = Math.floor(ship.ammo[a] * 0.5);
    ship.crew = Math.max(Math.round(ship.stats.crewMin * 0.6), ship.crew - crewLost);
    ship.morale = 50;
    ship.sinkingUntil = 0;
    ship.surrendered = false;
    ship.boarding = null;
    ship.effects = [];
    ship.fuseAt = 0;
    ship.water = 0;
    ship.leaks = 0;
    ship.station = 'balanced';
    ship.attackers.clear();
    ship.recompute(this.now);
    ship.hull = ship.stats.hullMax;
    ship.sails = ship.stats.sailHpMax;
    ship.rudderHp = 1;
    ship.gunsDisabled = { port: 0, starboard: 0 };
    ship.state = { x: port.x, y: port.y, heading: 0, speed: 0, sail: 0, rudder: 0 };
    ship.input = { rudder: 0, sailTarget: 0 };
    this.dockShip(s, port);
    this.db.ledger(s.accountId, 'death', -fee, `sunk; cargo ${lostValue}`);
    this.sendTo(s, { t: 'sunk_self', lost: { cargoValue: lostValue, crew: crewLost, repairFee: fee }, respawnPort: port.id });
    this.saveSession(s);
  }

  onBoardingWon(a: ShipEntity, b: ShipEntity, result: BoardingResult): void {
    const sa = this.sessionOf(a);
    if (sa) {
      sa.pendingBoarding = { result, targetId: b.id };
      this.sendTo(sa, { t: 'boarding', result });
      this.creditKill(a, b, 'boarded');
      const sb = this.sessionOf(b);
      if (sb) this.sendTo(sb, { t: 'toast', msg: `${a.captainName} has taken your ship! Pray for mercy.`, kind: 'bad' });
      return;
    }
    // An NPC won: it plunders what fits and lets the victim go.
    for (const id in b.cargo) {
      const g = id as GoodId;
      const n = b.cargo[g] ?? 0;
      a.cargo[g] = (a.cargo[g] ?? 0) + n;
    }
    b.cargo = {};
    a.purse += result.gold;
    const sb = this.sessionOf(b);
    if (sb && sb.profile) {
      const robbed = Math.min(sb.profile.gold, result.gold);
      sb.profile.gold -= robbed;
      if (robbed) this.db.ledger(sb.accountId, 'robbed', -robbed, a.name);
      this.sendTo(sb, { t: 'toast', msg: `${a.name}'s pirates stripped your hold and your purse (${result.gold} silver).`, kind: 'bad' });
    }
    b.lootLockedFor = null;
    b.surrendered = false;
    b.protectedUntil = this.now + 30;
    const brain = this.npcs.get(a.id);
    if (brain) {
      brain.target = null;
      brain.chase = null;
      brain.spared.set(b.id, this.now + 900);
      a.attackers.delete(b.id);
      b.attackers.delete(a.id);
    }
  }

  private resolveLoot(s: PlayerSession, take: Cargo, fate: 'sink' | 'release' | 'ransom'): string | null {
    const pend = s.pendingBoarding;
    const ship = s.ship;
    if (!pend || !ship || !s.profile) return 'Nothing to loot';
    s.pendingBoarding = null;
    const target = this.ships.get(pend.targetId);
    if (!target || target.lootLockedFor !== ship.id) return 'The prize slipped away';
    if (dist(ship.state.x, ship.state.y, target.state.x, target.state.y) > 400) return 'The prize drifted too far';
    // Move cargo within hold limits.
    let free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul);
    let moved = 0;
    for (const id in take) {
      const g = id as GoodId;
      if (!GOODS[g]) continue;
      const want = Math.max(0, Math.floor(take[g] ?? 0));
      const avail = target.cargo[g] ?? 0;
      const per = GOODS[g].volume * (GOODS[g].contraband ? ship.stats.contrabandVolumeMul : 1);
      const n = Math.min(want, avail, Math.floor((free + 1e-6) / per));
      if (n <= 0) continue;
      target.cargo[g] = avail - n;
      if (!target.cargo[g]) delete target.cargo[g];
      ship.cargo[g] = (ship.cargo[g] ?? 0) + n;
      s.profile.stolen[g] = (s.profile.stolen[g] ?? 0) + n;
      // Plunder has no purchase cost; keep the basis low so selling it rewards less XP than honest profit.
      const prev = (ship.cargo[g] ?? 0) - n;
      this.setCostBasis(s, g, (this.costBasis(s, g) * prev + GOODS[g].basePrice * 0.6 * n) / Math.max(1, prev + n));
      free -= n * per;
      moved += n;
    }
    for (const a of AMMO_IDS) ship.ammo[a] += pend.result.ammo[a];
    target.ammo = emptyAmmo();
    s.profile.gold += pend.result.gold;
    if (pend.result.gold) this.db.ledger(s.accountId, 'plunder', pend.result.gold, target.name);
    if (!target.isPlayer) target.purse = 0;
    target.lootLockedFor = null;
    const f = target.faction !== 'player' ? target.faction : null;
    if (fate === 'sink') {
      this.dropWreckage(target, 0.3);
      target.cargo = {};
      target.attackers.set(ship.id, this.now);
      this.beginSinking(target);
      this.toastShip(ship, `${target.name} goes down with ${moved} units of her cargo in your hold.`, 'good');
    } else if (fate === 'ransom' && !target.isPlayer) {
      s.profile.gold += pend.result.ransom;
      this.db.ledger(s.accountId, 'ransom', pend.result.ransom, target.name);
      if (f) changeRep(s.profile, f, -3);
      this.releasePrize(target);
      this.toastShip(ship, `Ransom paid: ${pend.result.ransom} silver.`, 'gold');
    } else {
      if (f) changeRep(s.profile, f, 2);
      s.profile.infamy = Math.max(0, s.profile.infamy - 3);
      this.releasePrize(target);
      this.toastShip(ship, `You let ${target.name} limp away. The sea remembers mercy.`, 'info');
    }
    return null;
  }

  private releasePrize(target: ShipEntity): void {
    target.surrendered = false;
    target.protectedUntil = this.now + 25;
    target.morale = Math.max(target.morale, 30);
    const brain = this.npcs.get(target.id);
    if (brain) brain.fleeFrom = null;
  }

  private pickupLoot(ship: ShipEntity, l: Loot): void {
    const s = this.sessionOf(ship);
    if (!s || !s.profile) return;
    let free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul);
    const got: string[] = [];
    for (const id in l.cargo) {
      const g = id as GoodId;
      const per = GOODS[g].volume * (GOODS[g].contraband ? ship.stats.contrabandVolumeMul : 1);
      const n = Math.min(l.cargo[g] ?? 0, Math.floor((free + 1e-6) / per));
      if (n <= 0) continue;
      ship.cargo[g] = (ship.cargo[g] ?? 0) + n;
      l.cargo[g] = (l.cargo[g] ?? 0) - n;
      if (!l.cargo[g]) delete l.cargo[g];
      free -= n * per;
      got.push(`${n} ${GOODS[g].name}`);
    }
    if (l.gold > 0) {
      s.profile.gold += l.gold;
      this.db.ledger(s.accountId, 'loot', l.gold, 'salvage');
      got.push(`${l.gold} silver`);
      l.gold = 0;
    }
    if (got.length) this.toastShip(ship, `Salvaged: ${got.join(', ')}.`, 'gold');
    if (!Object.keys(l.cargo).length) this.loot.delete(l.id);
  }

  // ================================================================= discovery

  /** Clouds on the horizon: everyone sees fronts within 15 km; the Navigator reads them 45 km out, with drift. */
  private sendFronts(s: PlayerSession): void {
    const ship = s.ship!;
    const navigator = ship.captain === 'navigator';
    const range = navigator ? 45000 : 15000;
    const list = this.fronts
      .filter((f) => Math.hypot(f.x - ship.state.x, f.y - ship.state.y) < range + f.radius)
      .map((f) => ({ id: f.id, kind: f.kind, x: Math.round(f.x), y: Math.round(f.y), r: Math.round(f.radius), vx: navigator ? Math.round(f.vx * 10) / 10 : 0, vy: navigator ? Math.round(f.vy * 10) / 10 : 0, ttl: navigator ? Math.round(f.until - this.now) : 0 }));
    this.sendTo(s, { t: 'fronts', list, forecast: navigator });
  }

  /** Notable ships the captain has laid eyes on are logged with time and place for the chart. */
  private recordSightings(s: PlayerSession): void {
    const ship = s.ship!;
    const p = s.profile!;
    this.forShipsNear(ship.state.x, ship.state.y, Math.min(INTEREST_RADIUS, ship.stats.detection), (o) => {
      if (o.id === ship.id || o.docked || o.hasFlag('hidden')) return;
      const kind = o.npcRole === 'ghost' ? 'ghost' : o.npcRole === 'hunter' ? 'hunter' : o.isPlayer && o.wantedCache >= 3 ? 'notorious' : null;
      if (!kind) return;
      const name = o.isPlayer ? `${o.captainName} (${o.name})` : o.name;
      const rec = { name, kind, x: Math.round(o.state.x), y: Math.round(o.state.y), t: Math.round(this.now) };
      const i = p.sightings.findIndex((q) => q.name === name);
      if (i >= 0) p.sightings[i] = rec;
      else {
        p.sightings.push(rec);
        this.sendTo(s, { t: 'toast', msg: kind === 'ghost' ? `Lookout: a ship with no lights… ${o.name}.` : `Lookout: ${name} sighted.`, kind: 'info' });
        if (p.sightings.length > 25) p.sightings.shift();
      }
    });
  }

  /** Share of the normal sighting range left by fog and storm murk (Dead Reckoning and Storm Rider see through). */
  sightFactor(ship: ShipEntity): number {
    const w = this.weatherOf(ship);
    let f = w === 'fog' ? 0.6 : w === 'storm' || w === 'black_storm' ? 0.8 : 1;
    if (ship.hasFlag('dead_reckoning')) f = 1 - (1 - f) / 2;
    if (ship.hasFlag('storm_rider') && (w === 'storm' || w === 'black_storm')) f = 1 - (1 - f) / 2;
    return f;
  }

  private discover(s: PlayerSession): void {
    const ship = s.ship!;
    const r = Math.min(1700, ship.stats.detection * 0.9) * this.sightFactor(ship);
    const before = s.discovered.size;
    const [cx, cy] = chunkOf(ship.state.x, ship.state.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = this.world.chunks.get(chunkKey(cx + dx, cy + dy));
        if (!list) continue;
        for (const id of list) {
          if (s.discovered.has(id)) continue;
          const is = this.world.islands[id];
          if (dist(is.x, is.y, ship.state.x, ship.state.y) > r + is.radius * 0.6) continue;
          this.markDiscovered(s, is);
        }
      }
    }
    if (s.discovered.size !== before) checkChartDeed(this, s);
  }

  /** Add an island to the captain's chart without discovery experience (bought or copied charts). */
  chartIsland(s: PlayerSession, is: Island): void {
    if (s.discovered.has(is.id)) return;
    s.discovered.add(is.id);
    s.profile!.discovered.push(is.id);
    this.sendIslands(s, [is.id]);
    this.sendTo(s, { t: 'ev', list: [{ k: 'discover', islandId: is.id, name: is.name, region: is.region, quiet: true }] });
  }

  private markDiscovered(s: PlayerSession, is: Island): void {
    s.discovered.add(is.id);
    s.profile!.discovered.push(is.id);
    const strange = REGIONS[is.region].strangeness;
    const xp = 12 + Math.min(40, is.radius / 40) + strange * 60 + (is.features.includes('ruins') ? 25 : 0);
    this.sendTo(s, { t: 'ev', list: [{ k: 'discover', islandId: is.id, name: is.name, region: is.region }] });
    this.grantXp(s, xp, null);
  }

  revealAround(ship: ShipEntity, r: number): number {
    const s = this.sessionOf(ship);
    if (!s) return 0;
    let n = 0;
    for (const is of this.world.islands) {
      if (s.discovered.has(is.id)) continue;
      if (dist(is.x, is.y, ship.state.x, ship.state.y) > r) continue;
      this.markDiscovered(s, is);
      n++;
    }
    // Also stream their chunks so the chart can draw them.
    this.sendIslands(s, this.world.islands.filter((is) => dist(is.x, is.y, ship.state.x, ship.state.y) <= r).map((is) => is.id));
    return n;
  }

  private streamChunks(s: PlayerSession): void {
    const ship = s.ship!;
    const [cx, cy] = chunkOf(ship.state.x, ship.state.y);
    for (let dy = -CHUNK_STREAM_RADIUS; dy <= CHUNK_STREAM_RADIUS; dy++) {
      for (let dx = -CHUNK_STREAM_RADIUS; dx <= CHUNK_STREAM_RADIUS; dx++) {
        const k = chunkKey(cx + dx, cy + dy);
        if (cx + dx < 0 || cy + dy < 0 || s.knownChunks.has(k)) continue;
        s.knownChunks.add(k);
        const list = this.world.chunks.get(k) ?? [];
        const reefs = (this.world.reefChunks.get(k) ?? []).map((id) => {
          const rf = this.world.reefs[id];
          return { id: rf.id, x: Math.round(rf.x), y: Math.round(rf.y), r: Math.round(rf.radius), poly: rf.poly.map((v) => Math.round(v)), depth: rf.depth };
        });
        this.sendTo(s, { t: 'chunk', key: k, islands: list.map((id) => this.islandData(this.world.islands[id])), reefs });
      }
    }
  }

  private sendIslands(s: PlayerSession, ids: number[]): void {
    if (!ids.length) return;
    this.sendTo(s, { t: 'chunk', key: -1, islands: ids.map((id) => this.islandData(this.world.islands[id])) });
  }

  private islandCache = new Map<number, IslandData>();
  islandData(is: Island): IslandData {
    let d = this.islandCache.get(is.id);
    if (!d) {
      d = { id: is.id, name: is.name, region: is.region, biome: is.biome, x: Math.round(is.x), y: Math.round(is.y), r: Math.round(is.radius), poly: is.poly.map((v) => Math.round(v)), features: is.features, portId: is.portId };
      this.islandCache.set(is.id, d);
    }
    return d;
  }

  // ================================================================= rumours & contracts

  addRumor(x: number, y: number, text: string): void {
    this.rumors.push({ x, y, text, t: this.now });
    if (this.rumors.length > 60) this.rumors.shift();
  }

  rumorsNear(x: number, y: number, n: number): string[] {
    const near = this.rumors.filter((r) => dist(r.x, r.y, x, y) < 30000 && this.now - r.t < 3600).slice(-n).reverse().map((r) => r.text);
    const flavor = [
      'They say the Hollow Psalm was seen again past Wrecktide, lanterns burning green-blue under the water.',
      'A Crown frigate out of Gravesend is asking questions about sugar that never reached Blackwater.',
      'Whalers swear the Reach is quieter this season. Too quiet. Something ate the whales.',
      'Fog Brokers pay double for charts of the inner Archipelago. Ask for Mara if you have any.',
      'Cinderhold is buying timber. The Confederacy is building something big.',
    ];
    while (near.length < n) near.push(flavor[(near.length + Math.floor(this.now / 600)) % flavor.length]);
    return near;
  }

  contractsAt(portId: string) {
    let entry = this.contracts.get(portId);
    if (!entry || entry.refreshAt < this.now) {
      entry = { list: generateContracts(this, this.portById(portId)!), refreshAt: this.now + 900 };
      this.contracts.set(portId, entry);
    }
    entry.list = entry.list.filter((c) => c.expiresAt > this.now);
    return entry.list;
  }

  checkDeliveries(s: PlayerSession, port: Port): void {
    const p = s.profile!;
    const ship = s.ship!;
    for (const c of [...p.contracts]) {
      if (c.toPort !== port.id) continue;
      if (c.kind === 'courier') this.completeContract(s, c.id);
      else if (c.kind === 'delivery' && c.good && c.qty && (ship.cargo[c.good] ?? 0) >= c.qty) {
        ship.cargo[c.good] = (ship.cargo[c.good] ?? 0) - c.qty;
        if (!ship.cargo[c.good]) delete ship.cargo[c.good];
        const market = this.markets.get(port.id);
        const gm = market?.goods[c.good];
        if (gm) gm.stock += c.qty;
        this.completeContract(s, c.id);
      }
    }
  }

  private completeContract(s: PlayerSession, id: string): void {
    const p = s.profile!;
    const c = p.contracts.find((x) => x.id === id);
    if (!c) return;
    p.contracts = p.contracts.filter((x) => x.id !== id);
    p.gold += c.reward;
    if (c.fromPort === 'harpoon_rest') {
      p.stats.harpoonContracts++;
      checkStatDeeds(this, s);
    }
    const issuer = this.portById(c.fromPort);
    if (issuer) changeRep(p, issuer.faction, 5);
    this.sendTo(s, { t: 'toast', msg: `Contract complete: ${c.title}. +${c.reward} silver.`, kind: 'gold' });
    this.grantXp(s, c.xp, null);
    this.db.ledger(s.accountId, 'contract', c.reward, c.title);
  }

  // ================================================================= sessions & messages

  attach(conn: WsConnection): PlayerSession {
    const s = new PlayerSession(conn);
    this.sessions.add(s);
    conn.onMessage = (text) => this.onMessage(s, text);
    conn.onClose = () => this.onDisconnect(s);
    return s;
  }

  sendTo(s: PlayerSession, msg: ServerMsg): void {
    if (s.conn.closed || s.disconnectedAt !== null) return;
    s.conn.send(JSON.stringify(msg));
  }

  /** Snapshots are the hot path: binary frames (shared/src/codec.ts). */
  private sendSnap(s: PlayerSession, msg: Extract<ServerMsg, { t: 'snap' }>): void {
    if (s.conn.closed || s.disconnectedAt !== null) return;
    s.conn.sendBinary(encodeSnap(msg));
  }

  toastShip(ship: ShipEntity | null, msg: string, kind: 'info' | 'good' | 'bad' | 'xp' | 'gold' = 'info'): void {
    const s = this.sessionOf(ship);
    if (s) this.sendTo(s, { t: 'toast', msg, kind });
  }

  toastNear(ship: ShipEntity, msg: string): void {
    for (const s of this.sessions) {
      if (s.ship && dist(s.ship.state.x, s.ship.state.y, ship.state.x, ship.state.y) < INTEREST_RADIUS) this.sendTo(s, { t: 'toast', msg, kind: 'info' });
    }
  }

  private emitRegion(region: RegionId, msg: string): void {
    for (const s of this.sessions) if (s.ship && s.ship.region === region) this.sendTo(s, { t: 'toast', msg, kind: 'info' });
  }

  emit(ev: GameEvent, x: number, y: number): void {
    this.events.push({ ev, x, y });
  }

  private onMessage(s: PlayerSession, text: string): void {
    const t = performance.now();
    if (t - s.msgWindowStart > 1000) {
      s.msgWindowStart = t;
      s.msgCount = 0;
    }
    if (++s.msgCount > 90) {
      if (s.msgCount > 400) s.conn.close(1008, 'flood');
      return;
    }
    let msg: ClientMsg;
    try {
      msg = JSON.parse(text) as ClientMsg;
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    try {
      this.handle(s, msg);
    } catch (e) {
      this.log(`[error] handling ${msg.t}: ${(e as Error).stack}`);
      this.sendTo(s, { t: 'err', msg: 'Server error' });
    }
  }

  private handle(s: PlayerSession, msg: ClientMsg): void {
    if (msg.t === 'ping') return this.sendTo(s, { t: 'pong', c: msg.c, s: this.now });
    if (msg.t === 'hello') return this.onHello(s, msg);
    if (!s.authed) return this.sendTo(s, { t: 'err', msg: 'Not authenticated' });
    if (msg.t === 'create_captain') return this.onCreateCaptain(s, msg.captain, msg.shipName);
    const ship = s.ship;
    const p = s.profile;
    if (!ship || !p) return this.sendTo(s, { t: 'err', msg: 'No captain' });
    const err = (m: string | null) => {
      if (m) this.sendTo(s, { t: 'toast', msg: m, kind: 'bad' });
    };
    const port = ship.docked ? this.portById(ship.docked)! : null;
    const portAction = (fn: (port: Port) => string | null) => {
      if (!port) return err('You must be in port');
      const e = fn(port);
      err(e);
      this.pushPort(s);
      this.pushSelf(s, true);
    };

    switch (msg.t) {
      case 'input': {
        if (!Number.isFinite(msg.rudder) || !Number.isFinite(msg.sail)) return;
        ship.input = { rudder: clamp(msg.rudder, -1, 1), sailTarget: SAIL_STEPS[clamp(Math.round(msg.sail), 0, SAIL_STEPS.length - 1)] };
        if (ship.hasFlag('unsinkable') && ship.captain !== 'drowned') ship.input.sailTarget = Math.min(ship.input.sailTarget, 0.9);
        if (Number.isInteger(msg.seq)) ship.lastInputSeq = msg.seq;
        return;
      }
      case 'fire':
        if (msg.side !== 'port' && msg.side !== 'starboard') return;
        return err(fireBroadside(this, ship, msg.side, Number(msg.dist)));
      case 'mount':
        return err(fireMount(this, ship, Number(msg.x), Number(msg.y)));
      case 'chase':
        if (msg.end !== 'bow' && msg.end !== 'stern') return;
        return err(fireChaser(this, ship, msg.end, Number(msg.x), Number(msg.y)));
      case 'ammo':
        if (AMMO_IDS.includes(msg.ammo) && msg.ammo !== ship.ammoSel) {
          // Drawing the loaded charge costs part of a reload; Quick Swap trims it.
          const swap = Math.max(0, 1 - tval(ship.stats, 'quickSwap'));
          for (const side of ['port', 'starboard'] as Side[]) {
            if (ship.reload[side] > 0 || ship.gunsDisabled[side] >= ship.stats.gunsPerSide) continue;
            const t = reloadTime(ship, side, this.now) * 0.3 * swap;
            if (t <= 0.05) continue;
            ship.reload[side] = t;
            ship.lastReloadTotal[side] = t;
          }
          ship.swapBonus = ship.rank('gun_quick_swap') > 0;
          ship.ammoSel = msg.ammo;
        }
        return;
      case 'fire_mode':
        ship.rollingFire = !!msg.rolling;
        this.toastShip(ship, ship.rollingFire ? 'Rolling fire: guns fire down the side as they bear.' : 'Broadside fire: every gun at once.', 'info');
        this.pushSelf(s, true);
        return;
      case 'talent_active':
        return err(useTalentActive(this, s, String(msg.id)));
      case 'ability':
        return err(useAbility(this, ship, String(msg.id), msg.x, msg.y));
      case 'board': {
        const target = this.ships.get(Number(msg.target));
        if (!target) return err('No such ship');
        const agg = msg.aggression === 'careful' || msg.aggression === 'brutal' ? msg.aggression : 'standard';
        const why = canBoard(this, ship, target);
        if (why) return err(why);
        startBoarding(this, ship, target, agg);
        return;
      }
      case 'loot_take':
        err(this.resolveLoot(s, msg.take ?? {}, msg.fate));
        this.sendTo(s, { t: 'boarding', result: null });
        this.pushSelf(s, true);
        return;
      case 'repair':
        if (msg.on && ship.inCombat(this.now) && !ship.hasFlag('battle_repair')) return err('Carpenters cannot work under fire (needs Battle Repair).');
        ship.repairing = !!msg.on;
        return;
      case 'dock':
        return err(this.tryDock(s));
      case 'undock':
        return err(this.undock(s));
      case 'trade':
        return portAction((pt) => trade(this, s, pt, msg.good, Math.trunc(Number(msg.qty))));
      case 'buy_ammo':
        return portAction((pt) => buyAmmo(this, s, pt, msg.ammo, Math.trunc(Number(msg.qty))));
      case 'hire_crew':
        return portAction((pt) => hireCrew(this, s, pt, Math.trunc(Number(msg.qty))));
      case 'shipyard':
        return portAction((pt) => {
          if (pt.shipyardTier <= 0) return 'No shipyard here';
          switch (msg.action) {
            case 'repair':
              return shipyardRepair(this, s);
            case 'module':
              return shipyardModule(this, s, pt, msg.module);
            case 'guns':
              return shipyardGuns(this, s, pt, msg.side, msg.gun);
            case 'buy_ship':
              return shipyardBuy(this, s, pt, msg.classId);
            case 'mount':
              return shipyardMount(this, s, pt, msg.mount);
            default:
              return 'Unknown order';
          }
        });
      case 'contract':
        return portAction((pt) => {
          if (msg.action === 'abandon') {
            p.contracts = p.contracts.filter((c) => c.id !== msg.id);
            return null;
          }
          if (p.contracts.length >= 3) return 'You can hold at most three contracts';
          const list = this.contractsAt(pt.id);
          const c = list.find((x) => x.id === msg.id);
          if (!c) return 'That contract is gone';
          if (c.kind === 'bounty' && !FACTIONS[pt.faction].lawful) return 'Bounties are paid by lawful ports only';
          const e = this.contracts.get(pt.id)!;
          e.list = e.list.filter((x) => x.id !== c.id);
          p.contracts.push({ ...c, progress: 0 });
          return null;
        });
      case 'pardon':
        return portAction((pt) => pardon(this, s, pt));
      case 'rights':
        return portAction((pt) => buyRights(this, s, pt, String(msg.site)));
      case 'warehouse':
        return portAction((pt) => warehouseAction(this, s, pt, msg.good, Math.trunc(Number(msg.qty))));
      case 'licence':
        return portAction((pt) => buyLicence(this, s, pt));
      case 'cleanse':
        return portAction((pt) => cleanse(this, s, pt));
      case 'station':
        if (!STATIONS.includes(msg.station)) return;
        setStation(this, ship, msg.station);
        this.sendTo(s, { t: 'toast', msg: STATION_NAMES[msg.station], kind: 'info' });
        return;
      case 'land':
        err(startLanding(this, s));
        this.pushSelf(s, true);
        return;
      case 'chart':
        return portAction((pt) => (msg.action === 'sell' ? sellCharts(this, s, pt) : buyChart(this, s, pt, msg.region)));
      case 'insure':
        return portAction((pt) => buyPolicy(this, s, pt, msg.tier === 'cargo' || msg.tier === 'full' ? msg.tier : 'hull'));
      case 'forward':
        return portAction((pt) => acceptForward(this, s, pt, String(msg.id)));
      case 'order':
        return portAction((pt) => {
          if (msg.action === 'post') return postOrder(this, s, pt, msg.good, Math.trunc(Number(msg.qty)), Math.trunc(Number(msg.price)));
          if (msg.action === 'fill') return fillOrder(this, s, pt, String(msg.id), Math.trunc(Number(msg.qty)));
          if (msg.action === 'cancel') return cancelOrder(this, s, pt, String(msg.id));
          return 'Bad order';
        });
      case 'bank':
        return portAction((pt) => {
          if (!['deposit', 'withdraw', 'borrow', 'repay'].includes(msg.action)) return 'Bad request';
          return bankAction(this, s, pt, msg.action, Math.trunc(Number(msg.amount)));
        });
      case 'learn_talent': {
        const why = canLearn(p.talents, String(msg.id), this.talentPoints(p), learnContext(p));
        if (why) return err(why);
        if (ship.inCombat(this.now)) return err('Not in the heat of battle');
        p.talents[msg.id] = (p.talents[msg.id] ?? 0) + 1;
        ship.talents = p.talents;
        ship.recompute(this.now);
        this.sendTo(s, { t: 'toast', msg: `Learned ${TALENTS_BY_ID[msg.id].name}.`, kind: 'good' });
        this.pushSelf(s, true);
        return;
      }
      case 'respec':
        return portAction(() => {
          if (ship.inCombat(this.now)) return 'Not in the heat of battle';
          const mode: RespecMode = msg.mode === 'forget' || msg.mode === 'token' ? msg.mode : 'full';
          return respec(this, s, mode, msg.id);
        });
      case 'loadout':
        return portAction(() => switchLoadout(this, s, Math.trunc(Number(msg.slot))));
      case 'chat': {
        const text = String(msg.text ?? '').slice(0, 200).trim();
        if (!text) return;
        for (const o of this.sessions) this.sendTo(o, { t: 'chat', from: s.name, text });
        return;
      }
      default:
        return;
    }
  }

  talentPoints(p: Profile): number {
    return unspentPoints(p);
  }

  private onHello(s: PlayerSession, msg: { v: number; token?: string; name?: string }): void {
    if (msg.v !== PROTOCOL_VERSION) {
      this.sendTo(s, { t: 'err', msg: `Client out of date (protocol ${msg.v}, server ${PROTOCOL_VERSION}). Reload the page.` });
      return;
    }
    if (s.authed) return;
    let auth = msg.token ? this.auth.resume(msg.token) : null;
    if (!auth) {
      if (!msg.name) return this.sendTo(s, { t: 'err', msg: 'auth_required' });
      const r = this.auth.register(msg.name);
      if ('error' in r) return this.sendTo(s, { t: 'err', msg: r.error });
      auth = r;
    }
    // Single session per account: take over a lingering or duplicate session.
    const existing = this.byAccount.get(auth.accountId);
    if (existing && existing !== s) {
      if (existing.disconnectedAt === null) {
        this.sendTo(existing, { t: 'err', msg: 'Logged in elsewhere.' });
        existing.conn.onClose = () => {};
        existing.conn.close(4000, 'replaced');
        this.sessions.delete(existing);
      }
      s.profile = existing.profile;
      s.ship = existing.ship;
      s.discovered = existing.discovered;
      s.pendingBoarding = existing.pendingBoarding;
    }
    s.accountId = auth.accountId;
    s.name = auth.name;
    s.token = auth.token;
    this.byAccount.set(s.accountId, s);
    if (!s.profile) {
      const row = this.db.loadCaptain(s.accountId);
      if (row) {
        s.profile = sanitizeProfile(JSON.parse(row.data) as Profile);
        s.discovered = new Set(s.profile.discovered);
        this.spawnPlayerShip(s, row.x, row.y, row.heading);
      }
    }
    this.sendTo(s, { t: 'welcome', v: PROTOCOL_VERSION, token: auth.token, accountId: s.accountId, name: s.name, hasCaptain: !!s.profile, worldSize: WORLD_SIZE, time: this.now });
    if (s.profile) this.sendInit(s);
  }

  private onCreateCaptain(s: PlayerSession, captain: CaptainId, rawShipName: string): void {
    if (s.profile) return this.sendTo(s, { t: 'err', msg: 'You already have a captain' });
    if (!CAPTAIN_IDS.includes(captain)) return this.sendTo(s, { t: 'err', msg: 'Unknown captain' });
    const shipName = sanitizeName(rawShipName ?? '') ?? CAPTAINS[captain].epithet;
    const port = this.portById(START_PORT)!;
    s.profile = newProfile(captain, shipName, port.id, this.now);
    this.spawnPlayerShip(s, port.x, port.y, 0);
    this.saveSession(s);
    this.sendInit(s);
    this.log(`[account] ${s.name} became ${CAPTAINS[captain].archetype}`);
  }

  private spawnPlayerShip(s: PlayerSession, x: number, y: number, heading: number): void {
    const p = s.profile!;
    if (s.ship && this.ships.has(s.ship.id)) return;
    const ship = new ShipEntity({
      id: this.allocId(), name: p.shipName, captainName: s.name, captain: p.captain, faction: 'player', accountId: s.accountId,
      loadout: p.loadout, talents: p.talents, x, y, heading,
    });
    ship.level = p.level;
    ship.cargo = p.cargo;
    ship.ammo = p.ammo;
    ship.ammoSel = p.ammoSel;
    ship.crew = Math.min(p.crew, ship.stats.crewMax);
    ship.morale = p.morale;
    ship.hull = p.hull < 0 ? ship.stats.hullMax : Math.max(1, Math.min(p.hull, ship.stats.hullMax));
    ship.sails = p.sails < 0 ? ship.stats.sailHpMax : Math.min(p.sails, ship.stats.sailHpMax);
    ship.rudderHp = p.rudderHp;
    ship.gunsDisabled = { ...p.gunsDisabled };
    ship.curse = p.curse;
    ship.wantedCache = wantedLevel(p.infamy);
    ship.region = regionAt(this.world, x, y);
    this.ships.set(ship.id, ship);
    this.grid.upsert(ship.id, x, y);
    s.ship = ship;
    if (p.docked) {
      const port = this.portById(p.docked);
      if (port) {
        ship.docked = port.id;
        ship.state.x = port.x;
        ship.state.y = port.y;
        recordIntel(this, s, port);
      } else p.docked = null;
    } else {
      ship.protectedUntil = this.now + 15;
    }
  }

  private sendInit(s: PlayerSession): void {
    const ports: PortPublic[] = this.world.ports.map((p) => ({
      id: p.id, name: p.name, region: p.region, faction: p.faction, x: Math.round(p.x), y: Math.round(p.y), size: p.size,
      shipyardTier: p.shipyardTier, blackMarket: p.blackMarket, description: p.description,
    }));
    s.knownEntities.clear();
    s.knownChunks.clear();
    this.sendTo(s, {
      t: 'init', self: toPrivateState(s, this.now), ports, currents: this.world.currents, whirlpools: this.world.whirlpools, discovered: [...s.discovered], time: this.now, entityId: s.ship!.id,
    });
    // Islands the captain has charted are sent up front so the world map is complete.
    this.sendIslands(s, [...s.discovered]);
    this.streamChunks(s);
    if (s.ship && !s.ship.docked) this.sendFronts(s);
    s.lastRegion = '';
    if (s.ship?.docked) this.pushPort(s);
    if (s.pendingBoarding) this.sendTo(s, { t: 'boarding', result: s.pendingBoarding.result });
  }

  private onDisconnect(s: PlayerSession): void {
    this.sessions.delete(s);
    if (!s.authed || this.byAccount.get(s.accountId) !== s) return;
    s.disconnectedAt = this.now;
    // Ships at sea linger (anti combat-logging); docked ships leave at once.
    s.lingerUntil = s.ship && !s.ship.docked ? this.now + LOGOUT_TIMER_SEC : this.now;
    if (s.ship) s.ship.input = { rudder: 0, sailTarget: 0 };
    this.saveSession(s);
  }

  private retireSession(s: PlayerSession): void {
    this.saveSession(s);
    if (s.ship) this.removeShip(s.ship.id);
    if (this.byAccount.get(s.accountId) === s) this.byAccount.delete(s.accountId);
  }

  // ================================================================= docking

  private tryDock(s: PlayerSession): string | null {
    const ship = s.ship!;
    const p = s.profile!;
    if (ship.docked) return 'Already in port';
    if (!ship.alive || ship.boarding) return 'Not now';
    if (ship.inCombat(this.now)) return 'The harbour chain stays up while you are in a fight';
    const port = this.nearestPort(ship.state.x, ship.state.y);
    if (!port || dist(port.x, port.y, ship.state.x, ship.state.y) > PORT_DOCK_RADIUS) return 'No harbour close enough';
    if (ship.state.speed > 7) return 'Take in sail before entering harbour';
    const ok = canDock(p, port.faction);
    if (!ok.ok) return ok.reason!;
    // Patrol inspections in lawful ports: contraband is seized unless hidden in a false bottom.
    if (FACTIONS[port.faction].lawful && !ship.hasFlag('false_bottom')) {
      const seized: string[] = [];
      for (const id in ship.cargo) {
        const g = id as GoodId;
        if (GOODS[g].contraband && (ship.cargo[g] ?? 0) > 0 && this.rng.chance(0.6)) {
          seized.push(`${ship.cargo[g]} ${GOODS[g].name}`);
          delete ship.cargo[g];
        }
      }
      if (seized.length) {
        this.addInfamy(ship, 8, 'smuggling');
        this.toastShip(ship, `Customs seized ${seized.join(', ')}.`, 'bad');
      }
    }
    this.dockShip(s, port);
    return null;
  }

  private dockShip(s: PlayerSession, port: Port): void {
    const ship = s.ship!;
    const p = s.profile!;
    onDockDeeds(this, s);
    ship.docked = port.id;
    ship.state.speed = 0;
    ship.state.sail = 0;
    ship.repairing = false;
    // Harbour pumps and caulkers see to the water and the leaks.
    ship.water = 0;
    ship.leaks = 0;
    ship.input = { rudder: 0, sailTarget: 0 };
    p.lastPort = port.id;
    p.docked = port.id;
    // Arriving is the end of a voyage: the policy expires.
    if (p.policy && ship.alive) {
      p.policy = null;
      p.insured = false;
    }
    recordIntel(this, s, port);
    this.checkDeliveries(s, port);
    settleForwards(this, s, port);
    settleOrders(this, s, port);
    collectDebt(this, s, port);
    const visitedKey = `visited:${port.id}`;
    if (!p.regionsSeen.includes(visitedKey)) {
      p.regionsSeen.push(visitedKey);
      this.grantXp(s, 60 + port.size * 40, `First visit to ${port.name}`);
    }
    this.pushPort(s);
    this.pushSelf(s, true);
    this.saveSession(s);
  }

  private undock(s: PlayerSession): string | null {
    const ship = s.ship!;
    if (!ship.docked) return 'Not in port';
    const port = this.portById(ship.docked)!;
    const is = this.world.islands[port.islandId];
    // Leave harbour on the best point of sail within 90° of straight out to sea.
    const out = Math.atan2(port.x - is.x, -(port.y - is.y));
    const wind = windAt(this.world.seed, this.now, port.x, port.y, WEATHER_WIND[this.weatherAt(port.x, port.y)]);
    let away = out, bestEff = -1;
    for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
      const h = out + off;
      const eff = polarEfficiency(ship.stats.rig, relWindDeg(h, wind), ship.stats.noGoDeg) - Math.abs(off) * 0.08;
      if (eff > bestEff) {
        bestEff = eff;
        away = h;
      }
    }
    ship.docked = null;
    s.profile!.docked = null;
    const v = headingVec(away);
    ship.state = { x: port.x + v.x * 60, y: port.y + v.y * 60, heading: away, speed: 3, sail: 0.5, rudder: 0 };
    ship.input = { rudder: 0, sailTarget: 0.5 };
    ship.protectedUntil = this.now + 20;
    this.grid.upsert(ship.id, ship.state.x, ship.state.y);
    this.sendTo(s, { t: 'port', view: null });
    this.pushSelf(s, true);
    return null;
  }

  pushPort(s: PlayerSession): void {
    const ship = s.ship;
    if (!ship || !ship.docked) return;
    const port = this.portById(ship.docked);
    if (port) this.sendTo(s, { t: 'port', view: buildPortView(this, s, port) });
  }

  pushSelf(s: PlayerSession, force = false): void {
    if (!s.profile) return;
    const state = toPrivateState(s, this.now);
    const json = JSON.stringify(state);
    if (!force && this.lastSelf.get(s) === json) return;
    this.lastSelf.set(s, json);
    this.sendTo(s, { t: 'self', self: state });
  }

  // ================================================================= snapshots (interest management)

  private sendSnapshots(): void {
    const events = this.events;
    this.events = [];
    for (const s of this.sessions) {
      if (!s.authed || !s.ship || s.disconnectedAt !== null) continue;
      const me = s.ship;
      const cx = me.state.x, cy = me.state.y;
      const ships: ShipRow[] = [];
      const infos: EntityInfo[] = [];
      const seen = new Set<number>();
      this.grid.query(cx, cy, INTEREST_RADIUS, (id) => {
        const o = this.ships.get(id);
        if (!o) return;
        const d = dist(o.state.x, o.state.y, cx, cy);
        if (d > INTEREST_RADIUS) return;
        if (o.id !== me.id) {
          if (o.docked) return;
          if (o.hasFlag('hidden') && d > 250 && o.ownerId !== me.id) return;
        }
        const brain = this.npcs.get(o.id);
        if (brain && !brain.active) return;
        seen.add(o.id);
        if (!s.knownEntities.has(o.id)) {
          s.knownEntities.add(o.id);
          infos.push(o.info());
        }
        if (o.id === me.id) return;
        ships.push([
          o.id, Math.round(o.state.x * 10) / 10, Math.round(o.state.y * 10) / 10, Math.round(o.state.heading * 1000) / 1000,
          Math.round(o.state.speed * 10) / 10, Math.round(o.state.sail * 100) / 100,
          Math.round((o.hull / o.stats.hullMax) * 1000) / 1000, Math.round((o.sails / o.stats.sailHpMax) * 100) / 100,
          o.flagsFor(me.id, this.isHostile(o, me), this.now) | (isTethered(this, o) ? SF.TETHERED : 0), Math.round((o.crew / Math.max(1, o.stats.crewMax)) * 100) / 100,
        ]);
      });
      const loot: LootRow[] = [];
      for (const l of this.loot.values()) {
        if (dist(l.x, l.y, cx, cy) > INTEREST_RADIUS) continue;
        seen.add(l.id);
        if (!s.knownEntities.has(l.id)) {
          s.knownEntities.add(l.id);
          infos.push({ id: l.id, kind: 'loot', value: cargoValue(l.cargo) + l.gold });
        }
        loot.push([l.id, Math.round(l.x), Math.round(l.y)]);
      }
      const gone: number[] = [];
      for (const id of s.knownEntities) if (!seen.has(id)) gone.push(id);
      for (const id of gone) s.knownEntities.delete(id);
      if (infos.length) this.sendTo(s, { t: 'info', list: infos });
      if (gone.length) this.sendTo(s, { t: 'gone', ids: gone });

      const wind = this.windFor(me);
      const weather = this.weatherOf(me);
      const you: SelfRow = {
        x: me.state.x, y: me.state.y, h: me.state.heading, spd: me.state.speed, sail: me.state.sail, rud: me.state.rudder, sailT: me.input.sailTarget,
        hull: Math.round(me.hull), hullMax: me.stats.hullMax, sails: Math.round(me.sails), sailsMax: me.stats.sailHpMax, rudderHp: Math.round(me.rudderHp * 100) / 100,
        crew: me.crew, crewMax: me.stats.crewMax, morale: Math.round(me.morale),
        reload: {
          port: me.reload.port <= 0 ? 1 : 1 - me.reload.port / Math.max(0.1, reloadEstimate(me, 'port')),
          starboard: me.reload.starboard <= 0 ? 1 : 1 - me.reload.starboard / Math.max(0.1, reloadEstimate(me, 'starboard')),
          bow: me.cls.bowChasers ? 1 - me.chaserReload.bow / CHASER_RELOAD : 0,
          stern: me.cls.sternChasers ? 1 - me.chaserReload.stern / CHASER_RELOAD : 0,
          mount: me.loadout.mount ? 1 - me.mountReload / mountReloadTime(me) : 0,
        },
        ammoSel: me.ammoSel, ammo: me.ammo as AmmoStock, flags: me.flagsFor(me.id, false, this.now) | (isTethered(this, me) ? SF.TETHERED : 0), combat: me.inCombat(this.now),
        water: Math.min(1, me.water / floodCapacity(me)), leaks: me.leaks, station: me.station,
      };
      this.sendSnap(s, {
        t: 'snap', tick: this.tick, time: Math.round(this.now * 100) / 100, ack: me.lastInputSeq, you, ships, loot,
        wind: [Math.round(wind.dir * 1000) / 1000, Math.round(wind.strength * 100) / 100], weather, region: me.region, fog: Math.round(WEATHER_FOG[weather] * (0.5 + 0.5 * this.sightFactor(me)) * 100) / 100,
      });
      const mine: GameEvent[] = [];
      for (const e of events) {
        if (dist(e.x, e.y, cx, cy) < INTEREST_RADIUS + 400) mine.push(e.ev);
      }
      if (mine.length) this.sendTo(s, { t: 'ev', list: mine });
    }
  }

  // ================================================================= persistence

  saveSession(s: PlayerSession): void {
    if (!s.profile || !s.authed) return;
    const p = s.profile;
    const ship = s.ship;
    if (ship) {
      p.cargo = ship.cargo;
      p.ammo = ship.ammo;
      p.ammoSel = ship.ammoSel;
      p.crew = ship.crew;
      p.morale = ship.morale;
      p.hull = ship.hull;
      p.sails = ship.sails;
      p.rudderHp = ship.rudderHp;
      p.gunsDisabled = { ...ship.gunsDisabled };
      p.curse = ship.curse;
      p.loadout = ship.loadout;
      p.docked = ship.docked;
    }
    const x = ship?.state.x ?? 0, y = ship?.state.y ?? 0, h = ship?.state.heading ?? 0;
    this.db.saveCaptain(s.accountId, p, x, y, h);
    s.lastSave = this.now;
  }

  saveAll(): void {
    this.db.transaction(() => {
      for (const s of this.byAccount.values()) this.saveSession(s);
      this.db.setKv('world', { time: this.now, markets: serializeMarkets(this.markets) });
      this.db.setKv('orders', this.orders);
      this.db.setKv('econ', { history: this.econHistory, rewardMul: this.econRewardMul });
      this.db.setKv('sites', Object.fromEntries(this.sites.map((x) => [x.id, { stock: x.stock, holder: x.holder, holderName: x.holderName, until: x.until }])));
    });
  }

  // ================================================================= diagnostics

  stats(): Record<string, number> {
    let active = 0;
    for (const b of this.npcs.values()) if (b.active) active++;
    return { players: this.sessions.size, ships: this.ships.size, npcs: this.npcs.size, activeNpcs: active, projectiles: this.projectiles.length, loot: this.loot.size, time: Math.round(this.now) };
  }
}

function reloadEstimate(ship: ShipEntity, side: 'port' | 'starboard'): number {
  return Math.max(ship.reload[side], ship.lastReloadTotal[side]);
}
