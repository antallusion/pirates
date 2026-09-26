// The authoritative game server: owns the world, runs the fixed-rate simulation, manages sessions,
// interest management, snapshots and persistence. Systems live in sibling modules.

import {
  CHUNK_STREAM_RADIUS, INTEREST_RADIUS, LOOT_LIFETIME_SEC, SNAP_CROWD, SNAP_CROWD_EVERY, SNAP_MID, SNAP_NEAR, SNAP_RANK_MID, SNAP_RANK_NEAR, LOGOUT_TIMER_SEC, PORT_DOCK_RADIUS, PROTOCOL_VERSION,
  SAIL_STEPS, SNAPSHOT_EVERY_TICKS, TICK_DT, WORLD_SEED, WORLD_SIZE, isNight,
} from '../../../shared/src/constants.ts';
import { CAPTAINS, CAPTAIN_IDS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { FACTIONS, WANTED_THRESHOLDS, WANTED_TITLES, wantedLevel } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { AMMO_IDS, CHASER_RELOAD, SHIP_CLASSES, defaultGunFor, emptyAmmo } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { TALENTS_BY_ID, canLearn } from '../../../shared/src/data/talents.ts';
import { angleDiff, clamp, closestOnPolygon, dist, headingOf, headingVec, pointInPolygon } from '../../../shared/src/math.ts';
import type {
  BoardingResult, ClientMsg, EntityInfo, GameEvent, IslandData, LootRow, PortPublic, SelfRow, ServerMsg, ShipRow, Side,
  PrivateState,
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
import { chunkKey, chunkOf, currentAt, depthAt, whirlpoolAt, generateWorld, islandsNear, raiseIsland, regionAt } from '../../../shared/src/world/worldgen.ts';
import type { Island, Port, RaisedIsland, World } from '../../../shared/src/world/worldgen.ts';
import type { AuthService } from '../auth.ts';
import { sanitizeName } from '../auth.ts';
import type { GameConn } from '../net/conn.ts';
import type { Db } from '../persistence/db.ts';
import type { SharedState } from '../persistence/redis.ts';
import { stepStrikes, useAbility } from './abilities.ts';
import { stepMind, stepZones } from './mind.ts';
import {
  dismissOfficer, hireOfficer, maxRecruits, mutinyCourse, officerOrder, onDockCrew, onFightWon, onMagazineBlast, onSunkCrew, plunderShare, pressGang, recruitPrisoners,
  resolveMutiny, springAmbush, stepCompany, stepSpirit,
} from './crew.ts';
import { Social, barterOffer, barterPropose, barterReady, cancelBarter, groupAnswer, groupConvoy, groupInvite, groupKick, groupLead, groupLeave, groupOfAccount, groupSay, pushParty, sameGroup, sameGroupAccounts, socialRetire, stepSocial, CONVOY_RANGE } from './party.ts';
import { Metrics } from './metrics.ts';
import { PvpHub, bubbleOnLoot, bubbleOnUndock, challengeDuel, answerDuel, duelIntercept, forfeitDuel, grantBubble, lootMul, onPlayerKill, postBounty, pvpFlags, pvpView, sendBounties, setBlackFlag, stepPvp } from './pvp.ts';
import { HoldingsHub, build, demolish, holdingsFor, islandService, islandYard, rentIsland, setAutoRenew, setWindow, stepHoldings, storeMove, treasuryMove } from './holdings.ts';
import type { Holding } from './holdings.ts';
import { GuildHub, allied, answerInvite, borrowShip, breakTreaty, declareWar, disbandGuild, dropContract, foundGuild, giveShip, guildNotify, guildOfShip, invite as guildInvite, kick as guildKick, leaveGuild, offerTreaty, onShipSunk, onWarKill, openOffice, postContract, proposePeace, pushGuild, raiseBase, returnShip, setFlagship, setRank, setTax, setToll, stepGuilds, storeMove as guildStore, treasury as guildTreasury } from './guilds.ts';
import { besieging, chooseOutcome, declareSiege, fortify, stepSieges } from './siege.ts';
import type { ZoneRuntime } from '../zones/zone.ts';
import { PostOffice, mailDelete, mailOnLogin, mailRead, mailSend, mailTake, marketAuction, marketBid, marketBuyOrder, marketCancel, marketFill, marketSell, sendMail, sendMarket, stepPost } from './post.ts';
import type { Tavern } from './crew.ts';
import { stepBridges } from './bridgefx.ts';
import { buyFigurehead, buyPlan, launchBuild, orderBuild, sellBerth, stepBuiltShip, swapBerth } from './shipbuilding.ts';
import { abandonQuest, acceptQuest, marqueBounty, questEvent, swearOath, switchPath } from './quests.ts';
import type { SunkHull } from './bridgefx.ts';
import { drownedKingRises, makeOffering, stepAbyss, stepAbyssShip } from './abyssfx.ts';
import { admiralsEye, anchorFleet, escortSlots, escortUpkeep, dismissEscort, escortLost, hireEscort, launchFleet, lashInPort, lineOfBattle, repairFleet, setFormation, stepFleet } from './fleet.ts';
import { PROFESSIONS } from '../../../shared/src/data/crew.ts';
import type { DeepZone } from './mind.ts';
import { CURSE_MORALE, cleanse, curseAura, stepCurse } from './curse.ts';
import { FEATURE_NAMES, findLandable, startLanding, stepLanding } from './exploration.ts';
import type { DelayedStrike } from './abilities.ts';
import { canBoard, cutGrapples, startBoarding, stepBoarding } from './boarding.ts';
import { legendsView } from './legends.ts';
import { applyIslandNames, applyPantheon, seasonAction, seasonMods, seasonStat, seasonXp, stepSeasons, warKill } from './seasons.ts';
import { abyssMap, abyssSecond, abyssView, abyssWind, onAbyssKill, raisingRitual, recordEcho, stepAbyssSea } from './abyss.ts';
import type { AbyssMap } from './abyss.ts';
import { digNoise, legendEcho, mapAction, mapView, onGhostSunk, stealMaps } from './treasure.ts';
import { ExpeditionHub, cityHere, cityPrompt, diveMove, diveSurface, expeditionsSecond, onYardCaptainSunk, sendSites, startDive, stepExpeditions } from './expeditions.ts';
import { EventHub, eventShipLost, hireBlocked, onDockEvents, onIslandRaised, onUndockEvents, sendEvents, stepEvents } from './events.ts';
import { BossHub, bossBoardOrder, bossBoarded, bossPositions, bossSinking, bossWind, stepBosses } from './bosses.ts';
import { applyDamage, fireBroadside, fireChaser, reloadTime, stepProjectiles } from './combat.ts';
import type { DamagePacket } from './combat.ts';
import { stepPivot, stepTalentEffects, stepTalents, useTalentActive } from './talentfx.ts';
import { captiveAction, losePrizes, prizeCrewNeeded, prizeValue, sellPrizes, stepBoats, surrenderTerms, takeCaptive, takePrize } from './prizes.ts';
import type { JollyBoat } from './prizes.ts';
import {
  bribeCost, buildCoves, contrabandValue, coveAt, coveSell, customsSearch, deferCrime, discoverCoves, dockOverride, fenceSale, portFence, settleCrimes, unmask, visibleRange, visibleRangeBase,
} from './smugglefx.ts';
import type { Cove, PendingCrime } from './smugglefx.ts';
import {
  buildWrecks, canDive, cartographerAction, forecast, goldTrailsFor, isMonster, mapChance, mapCircle, mapHere, recordTrails, soundings, stepExplorer, stormDebris, tavernMap, trailsFor, wreckHere,
} from './explorefx.ts';
import type { SunkenWreck, Trail } from './explorefx.ts';
import { blowMagazine, canMend, lightFuse, seaDamageMul, stepSurvival, weariness } from './survivalfx.ts';
import { craft, salvageBonus, wreckSalvage } from './wrightfx.ts';
import { buyOption, caravanLost, caravansOf, exerciseOption, expireOptions, priceLetters, tendCaravans, onArrival } from './tradefx.ts';
import { tx as tval } from '../../../shared/src/sim/shipstats.ts';
import type { Projectile, VolleyRec } from './combat.ts';
import { ECON_HOUR, createMarket, restoreMarkets, serializeMarkets, tickMarket } from './economy.ts';
import type { Market } from './economy.ts';
import { RouteCache } from './nav.ts';
import {
  QUOTA, abstractEncounters, newBrain, npcHostileTo, npcName, planMerchantVoyage, spawnFisher, spawnGhost, spawnHunter, spawnMerchant, spawnPatrols, spawnPirate, updateNpc,
} from './npc.ts';
import type { NpcBrain } from './npc.ts';
import { PlayerSession, addXp, canDock, changeRep, newProfile, sanitizeProfile, toPrivateState } from './player.ts';
import type { Profile, WorldView } from './player.ts';
import {
  buildPortView, priceMods, buyAmmo, buyChart, buyLicence, sellCharts, generateContracts, hireCrew, pardon, recordIntel, shipyardBuy, shipyardGuns, shipyardModule, shipyardRepair, shipyardUnfit, layKeel, syncKeel, trade,
} from './ports.ts';
import { ShipEntity } from './ship.ts';
import type { NpcRole } from './ship.ts';
import { SpatialGrid } from './spatial.ts';
import { WEATHER_FOG, WEATHER_WIND, initWeather, seaStateSpread, stepFronts, stepWeather, weatherAtPoint } from './weather.ts';
import type { Front, RegionWeather } from './weather.ts';

export interface Loot {
  id: number;
  x: number;
  y: number;
  cargo: Cargo;
  gold: number;
  expires: number;
  ownerOnly?: number; // Quick Dump: casks only their owner can see and pick up
  decoy?: boolean; // Decoy Barrels: empty
  wreck?: string; // region of a sunk hull (salvage)
  salvaged?: boolean;
  monster?: boolean; // left by a monster of the deep (Leviathan Lore)
  claim?: { account: number; until: number }; // the victor and their group have the first 30 s
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
  db: Db;
  auth: AuthService;
  seed?: number;
  log?: (msg: string) => void;
  /** Redis-backed presence, chat bus and leaderboards shared with other processes (optional). */
  shared?: SharedState;
}

const START_PORT = 'saltmarrow';

const EVENT_LEAD = 1200;
const roundCircle = (c: { x: number; y: number; r: number }) => ({ x: Math.round(c.x), y: Math.round(c.y), r: Math.round(c.r) });
const WEATHER_TOAST: Record<string, string> = {
  calm: 'The wind dies. Sails hang slack.', breeze: 'A light breeze fills the canvas.', wind: 'A fresh wind — good sailing.',
  fog: 'Fog rolls in. Lookouts see half as far.', rain: 'Rain sweeps the deck.', storm: 'Storm! Reef the sails or lose them.',
  black_storm: 'A black storm. The crew will not look at the water.',
}

export class Game {
  readonly db: Db;
  readonly auth: AuthService;
  readonly shared: SharedState | null;
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
  bosses = new BossHub();
  worldEvents = new EventHub();
  expeditions: ExpeditionHub;
  expeditionSecs = 0;
  abyss: AbyssMap;
  zones: DeepZone[] = [];
  sunkHulls: SunkHull[] = [];
  loot = new Map<number, Loot>();
  markets = new Map<string, Market>();
  tavernCrew = new Map<string, number>();
  taverns = new Map<string, Tavern>();
  contracts = new Map<string, { list: ReturnType<typeof generateContracts>; refreshAt: number }>();
  rumors: Rumor[] = [];
  weather: Record<RegionId, RegionWeather>;
  fronts: Front[] = [];
  sites: ResourceSite[];
  forwardBoards = new Map<string, { list: Forward[]; refreshAt: number }>();
  orders: BuyOrder[] = [];
  volleys = new Map<number, VolleyRec>();
  boats: JollyBoat[] = [];
  wrecks: SunkenWreck[] = [];
  trails = new Map<number, Trail>();
  coves: Cove[] = [];
  crimes: PendingCrime[] = [];
  /** Ships sunk recently (Nobody's Ship: dead men tell no tales). */
  sunkRecently = new Map<number, number>();
  pendingEvent: { id: number; port: string; good: GoodId; shock: number; text: string; at: number } | null = null;
  econHistory: IndexPoint[] = [];
  econRewardMul = 1;
  private nextEconCheckpoint = 0;
  private lastWeather = new WeakMap<PlayerSession, string>();
  sessions = new Set<PlayerSession>();
  /** Groups, convoys and barter (party.ts); letters and the captains' market (post.ts). */
  social = new Social();
  post = new PostOffice();
  /** Colours, duels, bounties (pvp.ts). */
  pvp = new PvpHub();
  /** Leased islands and what stands on them (holdings.ts). */
  holdings = new HoldingsHub();
  /** Guilds, their wars and the routes they hold (guilds.ts). */
  guilds = new GuildHub();
  /** Hooks for guilds and sieges: whether a captain belongs to a guild, a letter to a guild, an island's enemies. */
  guildMember?: (guildId: number, accountId: number) => boolean;
  guildNotify?: (guildId: number, subject: string, body: string) => void;
  islandHostile?: (h: Holding, ship: ShipEntity) => boolean;
  /** Real time in ms, for letters and listings that outlive the process (tests move it). */
  wallNow: () => number = () => Date.now();
  metrics = new Metrics();
  /** In a multi-zone world: this process's zone (zones/zone.ts); null when one process runs the whole ocean. */
  zone: ZoneRuntime | null = null;
  private snapMs = 0;
  private secondMs = 0;
  private byAccount = new Map<number, PlayerSession>();
  private events: QueuedEvent[] = [];
  private nextId = 1;
  private portIndex = new Map<string, Port>();
  /** The private state each client holds, field by field (JSON), so only what changed is sent. */
  private recentEvents: { tick: number; list: { x: number; y: number; json: string; far: string }[] }[] = [];
  private lastSelf = new WeakMap<PlayerSession, Map<string, string>>();
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
    this.shared = opts.shared ?? null;
    // Chat from captains in other processes.
    this.shared?.listenChat((from, text) => {
      for (const o of this.sessions) this.sendTo(o, { t: 'chat', from, text });
    });
    this.guildMember = (gid, acct) => this.guilds.of(this, acct)?.id === gid;
    this.guildNotify = (gid, subject, body) => guildNotify(this, gid, subject, body);
    // An island's guns and a guild at war: the owner guild's enemies are its enemies.
    this.islandHostile = (h, ship) => {
      if (besieging(this, h, ship)) return true;
      if (h.owner.kind !== 'guild') return false;
      const g = guildOfShip(this, ship);
      return !!g && !!this.guilds.store(this).wars.find((w) => ((w.a === g.id && w.b === h.owner.id) || (w.b === g.id && w.a === h.owner.id)) && this.wallNow() >= w.prepUntil);
    };
    const seed = opts.seed ?? WORLD_SEED;
    this.world = generateWorld(seed);
    // Islands the sea has thrown up since (world events).
    for (const r of this.db.getKv<RaisedIsland[]>('raised_islands') ?? []) raiseIsland(this.world, r);
    applyIslandNames(this); // names the Pantheon gave
    this.rng = new Rng(seed ^ 0x5eed);
    this.routes = new RouteCache(this.world);
    this.expeditions = new ExpeditionHub(this.world);
    this.abyss = abyssMap(this.world);
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
    this.coves = buildCoves(this);
    this.wrecks = buildWrecks(this);
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
        const t0 = performance.now();
        this.snapMs = this.secondMs = 0;
        this.step();
        this.metrics.tick(performance.now() - t0, this.snapMs, this.secondMs);
        acc -= TICK_DT;
        steps++;
      }
      if (steps === 5 && acc >= TICK_DT) {
        acc = 0; // drop time rather than spiral
        this.metrics.overruns++;
      }
    }, 1000 * TICK_DT * 0.5);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.saveAll();
  }

  /** In a zone, a share of the world's NPCs by its share of the ports. */
  private quota(n: number): number {
    return this.zone ? Math.max(1, Math.round((n * this.zonePorts().length) / this.world.ports.length)) : n;
  }

  bootPopulation(): void {
    for (let i = 0; i < this.quota(QUOTA.merchants); i++) spawnMerchant(this);
    for (let i = 0; i < this.quota(QUOTA.pirates); i++) spawnPirate(this);
    for (let i = 0; i < this.quota(QUOTA.fishers); i++) spawnFisher(this);
    for (let i = 0; i < this.quota(QUOTA.ghosts); i++) spawnGhost(this);
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
      const t0 = performance.now();
      this.everySecond();
      this.secondMs = performance.now() - t0;
    }
    const bucket = this.tick % 20;
    for (const ship of [...this.ships.values()]) if (ship.id % 20 === bucket && !ship.ghost) this.shipSecond(ship);
    for (const ses of [...this.byAccount.values()]) if (ses.accountId % 20 === bucket) this.sessionSecond(ses);
    if (now >= this.nextDirector) {
      this.nextDirector = now + 2;
      this.director();
    }
    if (now >= this.nextEconTick) {
      const edt = this.nextEconTick === 0 ? 0 : 10;
      this.nextEconTick = now + 10;
      const hist = now >= this.nextHistory;
      if (hist) this.nextHistory = now + 60;
      for (const m of this.markets.values()) if (!this.zone || this.zone.regions.has(this.portById(m.portId)?.region ?? 'black_coast')) tickMarket(m, edt, hist);
      for (const p of this.world.ports) this.tavernCrew.set(p.id, Math.min(10 + p.size * 14, (this.tavernCrew.get(p.id) ?? 0) + 0.6 * p.size));
      const before = Object.fromEntries(Object.entries(this.weather).map(([k, w]) => [k, w.kind]));
      for (const r of stepWeather(this.weather, this.rng, now)) if (before[r] === 'storm' || before[r] === 'black_storm') stormDebris(this, r);
      tickSites(this, edt);
      tickOrders(this);
      if (now >= this.nextEconCheckpoint) {
        if (this.nextEconCheckpoint !== 0) {
          const r = econCheckpoint(this);
          if (r.status !== 'stable') this.log(`[economy] ${r.status}: net ${r.netPerHour}/h on supply ${r.supply.total}, contract rewards ×${r.rewardMul}`);
        }
        this.nextEconCheckpoint = now + 3600;
      }
      this.fronts = stepFronts(this.fronts, this.rng, now, edt, (x, y) => windAt(this.world.seed, now, x, y).dir, seasonMods(this).stormMul);
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
      if (ship.docked || ship.ghost || ship.cls.monster) continue;
      const brain = this.npcs.get(ship.id);
      if (brain && !brain.active) continue;
      this.physics(ship, dt, night);
    }
    this.collideShips();
    stepTethers(this, dt);
    stepProjectiles(this, dt);
    stepBoarding(this);
    stepStrikes(this);
    stepBosses(this, dt);
    stepExpeditions(this, dt);
    stepAbyssSea(this, dt);
    stepZones(this, dt);

    for (const ship of this.ships.values()) {
      if (ship.ghost) continue;
      const braced = ship.hasEffect('brace'); // the gun crews lie flat
      if (ship.reload.port > 0 && !braced) {
        ship.reload.port = Math.max(0, ship.reload.port - dt);
        if (ship.reload.port === 0) ship.loadedSince.port = this.now;
      }
      if (ship.reload.starboard > 0 && !braced) {
        ship.reload.starboard = Math.max(0, ship.reload.starboard - dt);
        if (ship.reload.starboard === 0) ship.loadedSince.starboard = this.now;
      }
      if (ship.mountReload > 0) ship.mountReload = Math.max(0, ship.mountReload - dt);
      if (ship.chaserReload.bow > 0) ship.chaserReload.bow = Math.max(0, ship.chaserReload.bow - dt);
      if (ship.chaserReload.stern > 0) ship.chaserReload.stern = Math.max(0, ship.chaserReload.stern - dt);
      if (ship.sinkingUntil && now >= ship.sinkingUntil) this.finalizeSink(ship);
    }

    this.zone?.afterStep();
    {
      // Every tick serves a share of the captains (each still at 10 Hz): the cost is spread, not spiked.
      const t0 = performance.now();
      this.sendSnapshots();
      this.snapMs = performance.now() - t0;
    }
    if (now >= this.nextSave) {
      this.nextSave = now + 30;
      this.saveAll();
    }
  }

  // ================================================================= physics

  windFor(ship: ShipEntity): WindSample {
    if (this.bosses.fights.size) {
      const w = bossWind(this, ship);
      if (w) return w;
    }
    const base = windAt(this.world.seed, this.now, ship.state.x, ship.state.y, WEATHER_WIND[this.weatherAt(ship.state.x, ship.state.y)]);
    return (ship.region === 'the_abyss' && abyssWind(this, ship, base)) || base;
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
    if (ship.hasFlag('storm_gunner')) return 1; // Storm Gunner: the swell is part of the aim
    // Sea Legs: gunners who keep their feet lose less to the swell.
    const base = seaStateSpread(this.windFor(ship).strength, ship.cls.tier);
    return 1 + (base - 1) * Math.max(0, 1 + tval(ship.stats, 'seaPenalty'));
  }

  private physics(ship: ShipEntity, dt: number, night: boolean): void {
    if (ship.sinkingUntil) {
      ship.state.speed *= 0.97;
      return;
    }
    if (ship.grappled || ship.landing || ship.transferUntil > this.now) {
      // Grappled, or riding at anchor while the boats are ashore.
      if (ship.landing) ship.state.speed = 0;
      this.grid.upsert(ship.id, ship.state.x, ship.state.y);
      return;
    }
    const wind = this.windFor(ship);
    const cur = currentAt(this.world.currents, ship.state.x, ship.state.y, this.now, this.world.whirlpools);
    const prevX = ship.state.x, prevY = ship.state.y;
    // Madness: the crew has the wheel and steers for the call.
    let input = ship.input;
    if (ship.seizedHelm) {
      if (ship.seizedHelm.until <= this.now) ship.seizedHelm = null;
      else {
        const want = headingOf(ship.seizedHelm.x - ship.state.x, ship.seizedHelm.y - ship.state.y);
        input = { rudder: clamp(angleDiff(ship.state.heading, want) * 2, -1, 1), sailTarget: Math.max(0.5, ship.input.sailTarget) };
      }
    }
    ship.state = stepSailing(ship.state, input, ship.sailParams(night), wind, cur, dt);
    // Tide Whisperer: in the dead wind of the Abyss the deep currents carry her.
    if (ship.region === 'the_abyss' && ship.hasFlag('tide_whisperer') && ship.state.sail > 0.1) ship.state.speed = Math.max(ship.state.speed, ship.stats.maxSpeed * 0.6 * ship.state.sail);
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
        applyDamage(this, ship, { hull: ship.stats.hullMax * 0.02 * seaDamageMul(ship), sails: 5 }, null);
        this.toastShip(ship, 'The Maelstrom Wall tears at your rigging. Turn back.', 'bad');
      }
    }
    ship.distanceLog += Math.hypot(ship.state.x - prevX, ship.state.y - prevY);
    this.grid.upsert(ship.id, ship.state.x, ship.state.y);
  }

  /** Hull to Hull: a ram is a grapple for the next 3 s. */
  private hullToHull(a: ShipEntity, b: ShipEntity): void {
    if (!a.hasFlag('hull_to_hull') || a.boarding || b.boarding) return;
    a.ramTarget = b.id;
    a.ramUntil = this.now + 3;
    if (!canBoard(this, a, b)) startBoarding(this, a, b, 'standard');
  }

  private collideShips(): void {
    for (const a of this.ships.values()) {
      if (a.docked || !a.alive || a.ghost || a.npcRole === 'boss') continue;
      const brainA = this.npcs.get(a.id);
      if (brainA && !brainA.active) continue;
      const ra = a.stats.length * 0.32;
      this.grid.query(a.state.x, a.state.y, 80, (id) => {
        if (id <= a.id) return;
        const b = this.ships.get(id);
        if (!b || b.docked || !b.alive || b.ghost || b.npcRole === 'boss') return;
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
          this.hullToHull(a, b);
          this.hullToHull(b, a);
          const ramA = a.hasEffect('ramming_speed') ? 3 : 1, ramB = b.hasEffect('ramming_speed') ? 3 : 1;
          const base = closing * closing * 2.2;
          // Reinforced Bow deals more and takes less; Iron Strapping shrugs off rams.
          const ramMul = (x: ShipEntity, y: ShipEntity) => Math.max(0, 1 + tval(x.stats, 'ramDealt')) * Math.max(0.2, 1 + tval(y.stats, 'ramTaken')) * Math.max(0.2, 1 - tval(y.stats, 'strapping'));
          applyDamage(this, b, { hull: base * ramA * (ma / (ma + mb)) * 2 * ramMul(a, b), crew: 1, morale: 4 }, a);
          applyDamage(this, a, { hull: ((base * (mb / (ma + mb)) * 2) / ramA) * ramMul(b, a), morale: 2 }, b);
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
    this.bosses.second(this);
    stepEvents(this);
    expeditionsSecond(this);
    digNoise(this);
    stepSeasons(this);
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

    stepBoats(this);
    settleCrimes(this);
    stepSocial(this);
    stepPost(this);
    stepPvp(this);
    stepHoldings(this);
    stepGuilds(this);
    stepSieges(this);
    if (Math.floor(now) % 5 === 0) recordTrails(this);
    for (const [id, t] of this.sunkRecently) if (now - t > 900) this.sunkRecently.delete(id);
    for (const [id, v] of this.volleys) if (now - v.t > 30) this.volleys.delete(id);

    // Loot: expiry and pickup.
    for (const l of this.loot.values()) {
      if (l.expires <= now) {
        this.loot.delete(l.id);
        continue;
      }
      this.grid.query(l.x, l.y, 60, (id) => {
        const s = this.ships.get(id);
        if (!s || !s.isPlayer || !s.alive || s.docked || s.ghost) return;
        if (s.hasEffect('submerged') || s.hasEffect('ghost_return')) return; // a ghost cannot haul casks aboard
        if (l.ownerOnly !== undefined && s.accountId !== l.ownerOnly) return;
        if (l.claim && l.claim.until > now && s.accountId !== l.claim.account && !sameGroupAccounts(this, s.accountId, l.claim.account)) return;
        if (dist(s.state.x, s.state.y, l.x, l.y) > s.stats.length / 2 + 30) return;
        this.pickupLoot(s, l);
      });
    }

    // Presence in Redis every ten seconds (other processes see who sails here).
    if (this.shared && this.tick % 200 === 0) this.shared.heartbeat([...this.sessions].filter((x) => x.authed && x.disconnectedAt === null).map((x) => ({ id: x.accountId, name: x.name })));
  }

  /** A ship's once-a-second upkeep, run for a twentieth of the ships each tick (by id). */
  private shipSecond(ship: ShipEntity): void {
    const now = this.now;
    {
      if (ship.effects.length && ship.effects.some((e) => e.until <= now)) ship.recompute(now);
      ship.region = regionAt(this.world, ship.state.x, ship.state.y);
      if (!ship.alive || ship.docked || ship.cls.monster) return;
      const brain = this.npcs.get(ship.id);
      if (brain && !brain.active) return;
      this.shipUpkeep(ship);
      stepSpirit(this, ship);
      stepTalentEffects(this, ship);
      stepAbyssShip(this, ship);
      stepSurvival(this, ship);
      if (ship.isPlayer) {
        stepTalents(this, ship);
        surrenderTerms(this, ship);
      }
      // Scuttle Charges: the fuse has burned down.
      if (ship.scuttleAt && now >= ship.scuttleAt) {
        ship.hull = 0;
        this.beginSinking(ship);
      }
      // No Quarter: the taken ship goes down.
      if (ship.sinkAt && now >= ship.sinkAt) {
        ship.sinkAt = 0;
        ship.hull = 0;
        this.beginSinking(ship);
      }
    }
  }

  /** Each captain's once-a-second chores: chunk streaming, discovery, regions, lingering ships, private state.
   *  Run for a twentieth of the captains each tick (by account id), so a crowd costs no spike. */
  private sessionSecond(s: PlayerSession): void {
    const now = this.now;
    {
      if (s.disconnectedAt !== null) {
        if (now >= s.lingerUntil && !(s.ship && s.ship.inCombat(now) && now < s.lingerUntil + 60)) this.retireSession(s);
        return;
      }
      if (!s.ship || !s.profile) return;
      this.streamChunks(s);
      this.discover(s);
      this.recordSightings(s);
      if (s.ship.landing) stepLanding(this, s.ship);
      expireForwards(this, s);
      expireOptions(this, s);
      discoverCoves(this, s);
      stepExplorer(this, s);
      stepMind(this, s.ship);
      stepCompany(this, s);
      stepFleet(this, s);
      stepAbyss(this, s);
      stepBridges(this, s);
      stepBuiltShip(this, s);
      questEvent(this, s, { k: 'tick', dt: 1 });
      // After a mutiny they sail her to port themselves.
      const bound = mutinyCourse(this, s.ship, s.profile.company);
      if (bound && !s.ship.docked) {
        s.ship.seizedHelm = { until: now + 2, x: bound.x, y: bound.y };
        if (dist(bound.x, bound.y, s.ship.state.x, s.ship.state.y) < 700 && !s.ship.inCombat(now)) this.dockShip(s, bound);
      }
      syncKeel(this, s);
      this.stepDump(s);
      if (s.ship.hasEffect('false_colors')) {
        let close = false;
        this.forShipsNear(s.ship.state.x, s.ship.state.y, 120, (o) => {
          if (o.npcRole === 'patrol' && dist(o.state.x, o.state.y, s.ship!.state.x, s.ship!.state.y) < 100) close = true;
        });
        if (close) unmask(this, s.ship, 'a patrol came alongside');
      }
      if (this.tick % 1200 < 20) priceLetters(this, s, (pt) => recordIntel(this, s, pt));
      if (this.tick % 200 < 20) tendCaravans(this, s, (c, from) => planMerchantVoyage(this, c, this.npcs.get(c.id)!, from));
      checkDeeds(this, s, 1);
      abyssSecond(this, s);
      tickLoan(this, s);
      if (this.tick % 1200 < 20) decayClaims(this, s.profile);
      s.siteViews = this.sites.filter((x) => x.holder === s.accountId && x.until > this.now).map((x) => siteView(this, s, x));
      const own = s.ship.docked || s.ship.landing ? null : ownSiteNear(this, s);
      const land = s.ship.docked || s.ship.landing || own ? null : findLandable(this, s);
      const cove = !s.ship.docked && Object.keys(s.ship.cargo).some((g) => GOODS[g as GoodId].contraband) ? coveAt(this, s.ship) : null;
      const tmap = s.ship.docked || s.ship.landing ? null : mapHere(this, s);
      const wreck = s.ship.docked || s.ship.landing || tmap ? null : wreckHere(this, s.ship);
      const wreckWhy = wreck ? canDive(this, s, wreck) : null;
      const city = s.ship.docked || s.ship.landing ? null : cityPrompt(this, s);
      s.landable = city
        ? city
        : cove
        ? { island: cove.name, feature: 'buyers for contraband (90% of Fogmouth)' }
        : tmap
        ? { island: tmap.name.replace(/^.* — /, ''), feature: `buried treasure (${tmap.name.replace(/ — .*$/, '').toLowerCase()})`, action: 'dig' }
        : wreck
        ? { island: 'the sea floor', feature: `wreck of the ${wreck.name} (${wreck.depth} m)`, action: 'dive', blocked: wreckWhy ?? undefined }
        : own
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
        seasonStat(this, s, 'distance', s.ship.distanceLog / 1000);
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
    baseline -= weariness(this, ship); // a long voyage wears on a crew
    baseline += tval(st, 'moraleBase'); // cooks, one-legged storytellers, superstition
    ship.morale += clamp(baseline - ship.morale, -1, 1) * st.moraleRegen;
    ship.morale = clamp(ship.morale, 0, 100);

    // Provisions: 1 unit feeds 40 sailors for a minute.
    if (ship.isPlayer && this.tick % 200 === 0) {
      const frontier = REGIONS[ship.region].safety === 'lawless' ? Math.max(0.5, 1 - 1.25 * tval(st, 'frontier')) : 1;
      const eat = (ship.crew / 40) * (10 / 60) * 6 * st.provisionUse * frontier;
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
        const cold = Math.max(0, 1 + tval(st, 'spoilage')); // Cold Hold
        const acc = (ship.spoilAcc[g] ?? 0) + ((n * spoil * cold * ((ship.cargo.salt ?? 0) > 0 ? 0.5 : 1)) / ECON_HOUR) * (this.weatherOf(ship) === 'rain' ? 1.3 : 1);
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
      const rate = inCombat ? (canMend(this, ship) ? st.battleRepairRate : 0) : 1;
      // Spare Rigging: the sails can be mended under fire even when the hull cannot.
      const sailRate = inCombat ? Math.max(rate, ship.hasFlag('spare_rigging') ? 0.3 : 0, ship.hasFlag('sailmaker') ? 0.3 : 0) * (ship.hasFlag('sailmaker') ? 2 : 1) : 1;
      if (rate <= 0 && sailRate <= 0) {
        ship.repairing = false;
        this.toastShip(ship, 'Carpenters cannot work under fire.', 'bad');
      } else {
        const crewF = Math.min(1, ship.crew / Math.max(1, st.crewMin * 2));
        const hullGain = Math.min(st.hullMax - ship.hull, st.hullMax * 0.012 * st.repairRate * crewF * rate);
        const use = Math.max(0.3, 1 + tval(st, 'materialUse')); // Spare Timber
        const planksNeeded = (hullGain / 40) * use;
        const sailGain = Math.min(st.sailHpMax - ship.sails, st.sailHpMax * 0.02 * st.repairRate * crewF * sailRate);
        const clothNeeded = (sailGain / 20) * use;
        // A hidden cove has timber and canvas to spare for those who know it.
        const cove = ship.hasFlag('cove_knowledge') && coveAt(this, ship) !== null;
        const oldSalt = ship.hasFlag('old_salt'); // makes do with what the sea gives, at half speed
        const planks = cove ? 1e9 : ship.cargo.planks ?? 0, cloth = cove ? 1e9 : ship.cargo.sailcloth ?? 0;
        let did = false;
        if (hullGain > 0.5 && (planks >= planksNeeded || oldSalt)) {
          const stocked = planks >= planksNeeded;
          ship.hull += stocked ? hullGain : hullGain * 0.5;
          if (!cove && stocked) ship.cargo.planks = Math.round((planks - planksNeeded) * 100) / 100;
          did = true;
        }
        if (sailGain > 0.2 && (cloth >= clothNeeded || oldSalt)) {
          const stocked = cloth >= clothNeeded;
          ship.sails += stocked ? sailGain : sailGain * 0.5;
          if (!cove && stocked) ship.cargo.sailcloth = Math.round((cloth - clothNeeded) * 100) / 100;
          did = true;
        }
        if (ship.rudderHp < 1 && (planks > 0.2 || oldSalt)) {
          ship.rudderHp = Math.min(1, ship.rudderHp + 0.01 * st.repairRate * (1 + tval(st, 'damageControl')));
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
      applyDamage(this, ship, { hull: st.hullMax * 0.02 * seaDamageMul(ship), sails: 2, crew: 0.3, morale: 2 }, null);
      if (this.tick % 60 === 0) this.toastShip(ship, `${wp.core.name} is tearing her apart — claw out of the eye!`, 'bad');
    }
    // The sea's claim.
    if (stepCurse(this, ship)) {
      const stage = curseStage(ship.curse);
      this.toastShip(ship, ['The hull is clean again.', 'Barnacles and bone crust the hull.', 'The planks weep brine; the crew mutters at night.', 'Something glows in the timbers. The deep has claimed her.'][stage], stage >= 2 ? 'bad' : 'info');
    }
    curseAura(this, ship);
    // Brine Mend heal-over-time.
    if (ship.hasEffect('brine_mend') && canMend(this, ship)) ship.hull = Math.min(st.hullMax, ship.hull + st.hullMax * 0.015 * (ship.talentReady.brinePower || 1));
    // Fireship charges.
    if (ship.fuseAt && this.now >= ship.fuseAt) {
      detonateFireship(this, ship);
      return;
    }
    // Leaks, pumps and plugs.
    if (stepFlooding(this, ship)) return;
    // Fire.
    if (ship.hasEffect('fire')) applyDamage(this, ship, { hull: st.hullMax * 0.006 * (ship.hasFlag('wet_decks') ? 0.6 : 1), sails: 1.5 }, null);
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
        p.infamy = Math.max(0, p.infamy - 0.05 * (1 + tval(st, 'infamyDecay')));
        ship.wantedCache = wantedLevel(p.infamy);
      }
    }
  }

  private director(): void {
    const now = this.now;
    const counts: Record<NpcRole, number> = { merchant: 0, patrol: 0, pirate: 0, hunter: 0, fisher: 0, ghost: 0, escort: 0, boss: 0 };
    for (const b of this.npcs.values()) counts[b.role]++;
    for (let i = 0; counts.merchant + i < this.quota(QUOTA.merchants) && i < 2; i++) spawnMerchant(this);
    const mods = seasonMods(this);
    if (counts.pirate < this.quota(Math.round(QUOTA.pirates * mods.pirateMul))) spawnPirate(this);
    if (counts.fisher < this.quota(QUOTA.fishers)) spawnFisher(this);
    if (counts.ghost < this.quota(QUOTA.ghosts * mods.ghostMul) && this.rng.chance(0.02 * mods.ghostMul)) spawnGhost(this, mods.ghostsEverywhere);
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

  /** World market events are brewed 20 minutes before they break; Rumor Mill captains hear of them early. */
  private worldEvent(): void {
    const due = this.pendingEvent;
    if (due) {
      this.pendingEvent = null;
      const gm = this.markets.get(due.port)?.goods[due.good];
      if (!gm) return;
      gm.shock = due.shock;
      this.addRumor(this.portById(due.port)!.x, this.portById(due.port)!.y, due.text);
      for (const s of this.sessions) this.sendTo(s, { t: 'toast', msg: `WORLD: ${due.text}`, kind: 'info' });
      this.log(`[event] ${due.text}`);
      return;
    }
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
    if (!market.goods[good]) return;
    this.pendingEvent = { id: this.allocId(), port: port.id, good, shock, text, at: this.now + EVENT_LEAD };
    this.nextWorldEvent = this.now + EVENT_LEAD;
    for (const s of this.sessions) if (s.ship?.docked) this.tavernWhispers(s);
  }

  /** Rumor Mill: in port, the taverns already talk about the market event that is coming. */
  tavernWhispers(s: PlayerSession): void {
    const ev = this.pendingEvent;
    if (!ev || !s.ship?.hasFlag('rumor_mill') || !s.profile || s.profile.trade.rumorsHeard.includes(ev.id)) return;
    s.profile.trade.rumorsHeard = [...s.profile.trade.rumorsHeard.slice(-9), ev.id];
    const mins = Math.max(1, Math.round((ev.at - this.now) / 60));
    this.sendTo(s, { t: 'toast', msg: `Tavern talk (in ~${mins} min): ${ev.text}`, kind: 'info' });
  }

  // ================================================================= entities

  allocId(): number {
    return (this.zone?.idBase() ?? 0) + this.nextId++;
  }

  /** Whether a point lies in this process's waters (always, in a single-process world). */
  inZone(x: number, y: number): boolean {
    return !this.zone || this.zone.inZone(x, y);
  }

  /** Ports this process looks after. */
  zonePorts(): Port[] {
    return this.zone ? this.world.ports.filter((p) => this.zone!.regions.has(p.region)) : this.world.ports;
  }

  /** Whether this process runs the world-wide calendars (bounty purses, guild probation). */
  get zoneLead(): boolean {
    return !this.zone || this.zone.lead;
  }

  /** Before a captain crosses into another zone: what cannot follow is settled here. */
  prepareHandoff(s: PlayerSession): void {
    const barter = this.social.barters.get(s.accountId);
    if (barter) cancelBarter(this, barter, `${s.name} has sailed on`);
    if (groupOfAccount(this, s.accountId)) groupLeave(this, s, 'sails into other waters');
    const duel = this.pvp.duelOf.get(s.accountId);
    if (duel) forfeitDuel(this, s);
  }

  /** The session has moved to another zone: forget it here without a lingering ship. */
  dropSession(s: PlayerSession): void {
    if (s.ship) this.removeShip(s.ship.id);
    this.sessions.delete(s);
    if (this.byAccount.get(s.accountId) === s) this.byAccount.delete(s.accountId);
  }

  /** A hit landed in another zone on one of our ships. */
  applyForeignDamage(target: ShipEntity, d: DamagePacket, source: ShipEntity | null): void {
    applyDamage(this, target, d, source);
  }

  /** A ship of ours sank one over the line: the credit is ours to give. */
  creditForeignKill(killer: ShipEntity, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
    this.creditKill(killer, victim, how);
  }

  /** An event from over the line, for our captains who can see it. */
  pushForeignEvent(ev: GameEvent, x: number, y: number): void {
    this.events.push({ ev, x, y });
  }

  /** Another zone rewrote a shared record: drop our copy. */
  invalidateKv(key: string): void {
    if (key === 'guilds') this.guilds.drop();
    else if (key === 'holdings') this.holdings.drop();
    else if (key === 'bounties') this.pvp.drop();
    else if (key.startsWith('board:')) this.post.dropBoard(key.slice(6));
    else if (key === 'island_names') {
      applyIslandNames(this);
      for (const s of this.sessions) s.knownChunks.clear();
    } else if (key === 'raised_islands') {
      // Another zone raised an island (or named one): take it into our world too.
      for (const r of this.db.getKv<RaisedIsland[]>('raised_islands') ?? []) {
        const known = this.world.islands.find((is) => is.x === r.x && is.y === r.y);
        if (known) known.name = r.name;
        else onIslandRaised(this, raiseIsland(this.world, r).id);
      }
    }
  }

  spawnNpcShip(role: NpcRole, classId: ShipClassId, faction: FactionId, x: number, y: number, heading: number, names?: { ship: string; captain: string }, id?: number): ShipEntity {
    const n = names ?? npcName(this);
    const gun = defaultGunFor(SHIP_CLASSES[classId]);
    const ship = new ShipEntity({
      id: id ?? this.allocId(), name: n.ship, captainName: n.captain, captain: 'corsair', faction, accountId: null,
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
    for (const s of this.ships.values()) if (s.ownerId === owner.id && !s.prize && !s.fleetId) return 'Your escort is already at sea';
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

  private worldView(s: PlayerSession): WorldView {
    const ship = s.ship;
    const p = s.profile!;
    return {
      coves: this.coves,
      patrols: this.insiderPatrols(s),
      fleet: ship ? {
        escorts: p.fleet.escorts.map((e) => {
          const at = [...this.ships.values()].find((x) => x.fleetId === e.id && x.alive);
          return { id: e.id, name: e.name, classId: e.classId, hull: Math.round((at ? at.hull / at.stats.hullMax : e.hull) * 100), atSea: !!at };
        }),
        slots: escortSlots(p, ship), formation: p.fleet.formation, upkeep: Math.round(escortUpkeep(p, ship)),
      } : undefined,
      inspect: ship ? admiralsEye(this, ship) : [],
      monsters: ship?.hasFlag('eyes_of_choir') ? this.monstersNear(ship) : [],
      explore: ship ? {
        maps: p.explore.maps.map((m) => mapView(this, s, m)),
        legendEcho: legendEcho(this, s),
        wrecks: this.wrecks.filter((w) => p.explore.dived[w.id] !== undefined || dist(w.x, w.y, ship.state.x, ship.state.y) < 600).map((w) => ({ name: w.name, x: Math.round(w.x), y: Math.round(w.y), depth: w.depth })),
        trails: trailsFor(this, ship),
        soundings: soundings(this, ship),
        forecast: forecast(this, ship),
        goldTrails: goldTrailsFor(this, ship),
      } : undefined,
      pvp: pvpView(this, s),
      abyss: abyssView(this, s),
    };
  }

  /** Insider: Crown patrols in the captain's region, rounded to 100 m. */
  private insiderPatrols(s: PlayerSession): [number, number][] {
    const ship = s.ship;
    if (!ship?.hasFlag('insider')) return [];
    const out: [number, number][] = [];
    for (const [id, b] of this.npcs) {
      if (b.role !== 'patrol') continue;
      const o = this.ships.get(id);
      if (!o || o.faction !== 'crown' || o.region !== ship.region) continue;
      out.push([Math.round(o.state.x / 100) * 100, Math.round(o.state.y / 100) * 100]);
    }
    return out;
  }

  /** Re-send a ship's name card to everyone (False Colors). */
  refreshInfo(ship: ShipEntity): void {
    for (const s of this.sessions) {
      s.knownEntities.delete(ship.id);
      s.sentRows.delete(ship.id);
    }
  }

  /** Loot only one captain can see and pick up. */
  dropPrivateLoot(accountId: number, x: number, y: number, cargo: Cargo, ttl: number): void {
    const id = this.allocId();
    this.loot.set(id, { id, x, y, cargo, gold: 0, expires: this.now + ttl, ownerOnly: accountId });
  }

  /** Decoy Barrels: empty casks that look like cargo. */
  dropDecoy(x: number, y: number): void {
    const id = this.allocId();
    this.loot.set(id, { id, x, y, cargo: { rum: 8 + this.rng.int(0, 8) }, gold: 0, expires: this.now + 120, decoy: true });
  }

  /** Cargo over the side: five seconds of work, or at once into marked casks with Quick Dump. */
  private jettison(s: PlayerSession, good: GoodId, qty: number): string | null {
    const ship = s.ship!;
    if (!GOODS[good] || !Number.isInteger(qty) || qty <= 0) return 'Bad order';
    if (ship.docked) return 'Sell it in port instead';
    const n = Math.min(qty, Math.floor(ship.cargo[good] ?? 0));
    if (n <= 0) return 'You do not carry that';
    const quick = tval(ship.stats, 'quickDump');
    if (quick > 0) {
      this.dumpNow(s, good, n, quick);
      return null;
    }
    ship.pendingDump = { good, qty: n, at: this.now + 5 };
    this.toastShip(ship, `Heaving ${n} ${GOODS[good].name.toLowerCase()} over the side…`, 'info');
    return null;
  }

  private dumpNow(s: PlayerSession, good: GoodId, n: number, quick: number): void {
    const ship = s.ship!;
    ship.cargo[good] = (ship.cargo[good] ?? 0) - n;
    if (!ship.cargo[good]) delete ship.cargo[good];
    if (s.profile!.stolen[good]) s.profile!.stolen[good] = Math.max(0, s.profile!.stolen[good]! - n);
    if (quick > 0) {
      const back = headingVec(ship.state.heading + Math.PI);
      const id = this.allocId();
      this.loot.set(id, { id, x: ship.state.x + back.x * 40, y: ship.state.y + back.y * 40, cargo: { [good]: n }, gold: 0, expires: this.now + (quick >= 2 ? 1200 : 600), ownerOnly: s.accountId });
      this.toastShip(ship, `${n} ${GOODS[good].name.toLowerCase()} over the side in marked casks.`, 'info');
    } else this.toastShip(ship, `${n} ${GOODS[good].name.toLowerCase()} went to the bottom.`, 'info');
    makeOffering(this, ship, good, n);
  }

  private stepDump(s: PlayerSession): void {
    const d = s.ship?.pendingDump;
    if (!d || d.at > this.now) return;
    s.ship!.pendingDump = null;
    const n = Math.min(d.qty, Math.floor(s.ship!.cargo[d.good] ?? 0));
    if (n > 0) this.dumpNow(s, d.good, n, 0);
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
    return (a.ownerId !== null && a.ownerId === b.id) || (b.ownerId !== null && b.ownerId === a.id) || (a.ownerId !== null && a.ownerId === b.ownerId) || sameGroup(this, a, b) || allied(this, a, b);
  }

  /** A captain in this world by name (any case). */
  sessionByName(name: string): PlayerSession | undefined {
    const n = name.trim().toLowerCase();
    if (!n) return undefined;
    for (const s of this.byAccount.values()) if (s.name.toLowerCase() === n && s.profile) return s;
    return undefined;
  }

  adjustRep(ship: ShipEntity, faction: FactionId, delta: number): void {
    const p = this.profileOf(ship);
    // The Crown Lion on the bow: the Crown warms to you faster.
    if (p) changeRep(p, faction, faction === 'crown' && delta > 0 && ship.hasFlag('fh_crown_lion') ? delta * 1.1 : delta);
  }

  adjustRepProfile(s: PlayerSession, faction: FactionId, delta: number): void {
    if (s.profile) changeRep(s.profile, faction, delta);
  }

  addInfamy(ship: ShipEntity, amount: number, reason: string): void {
    const p = this.profileOf(ship);
    if (!p) return;
    if (deferCrime(this, ship, amount, reason)) return; // Nobody's Ship: only a surviving witness tells
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
    // Frontier Spirit: lawless waters teach more.
    if (s.ship && REGIONS[s.ship.region].safety === 'lawless') amount *= 1 + tval(s.ship.stats, 'frontier');
    const gained = addXp(s.profile, amount);
    seasonXp(this, s, amount);
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
    if (ship.bossOf && bossSinking(this, ship)) return; // the deep keeps its own dead
    recordEcho(this, ship); // what the Abyss takes, it sends back
    if (duelIntercept(this, ship)) return; // nobody sinks in a duel: she strikes
    if (ship.caravanOf !== null) caravanLost(this, ship);
    this.sunkRecently.set(ship.id, this.now);
    // Salvage King: a hull that went down whole can be raised for a while.
    if (!ship.isPlayer && !ship.fleetId && !ship.abyssSpawn && ship.npcRole !== 'ghost') {
      this.sunkHulls.push({ classId: ship.loadout.classId, name: ship.name.replace(/^Raised /, ''), x: ship.state.x, y: ship.state.y, t: this.now });
      this.sunkHulls = this.sunkHulls.filter((h) => this.now - h.t < 600).slice(-40);
    }
    if (ship.hasFlag('scuttle_charges') && ship.isPlayer) blowMagazine(this, ship); // nobody gets her hold
    ship.sinkingUntil = this.now + 6 + (ship.hasFlag('fh_saint_of_wrecks') ? 5 : 0); // the Saint of Wrecks holds her up
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
    if (ship.yardOf) onYardCaptainSunk(this, ship);
    const victor = killer ? (killer.accountId ?? (killer.ownerId !== null ? this.ships.get(killer.ownerId)?.accountId ?? null : null)) : null;
    this.dropWreckage(ship, 0.4 * lootMul(this, killer, ship), victor);
    onShipSunk(this, ship, killer);
    if (killer) this.creditKill(killer, ship, 'sunk');
  }

  /** Eyes of the Choir: ghost ships and worse within twice your sight, to the nearest 100 m. */
  monstersNear(ship: ShipEntity): [number, number][] {
    const out: [number, number][] = [];
    const r = ship.stats.detection * 2;
    for (const [id, b] of this.npcs) {
      if (b.role !== 'ghost') continue;
      const o = this.ships.get(id);
      if (o && o.alive && dist(o.state.x, o.state.y, ship.state.x, ship.state.y) < r) out.push([Math.round(o.state.x / 100) * 100, Math.round(o.state.y / 100) * 100]);
    }
    for (const [x, y] of bossPositions(this)) if (dist(x, y, ship.state.x, ship.state.y) < r * 2) out.push([Math.round(x / 100) * 100, Math.round(y / 100) * 100]);
    return out;
  }

  /** Everything still in her hold goes on the water (the Drowned King keeps nothing). */
  dropHold(ship: ShipEntity): void {
    const cargo: Cargo = { ...ship.cargo };
    if (!Object.keys(cargo).length) return;
    const id = this.allocId();
    this.loot.set(id, { id, x: ship.state.x, y: ship.state.y, cargo, gold: 0, expires: this.now + LOOT_LIFETIME_SEC, wreck: ship.region });
  }

  private dropWreckage(ship: ShipEntity, frac: number, victor: number | null = null): void {
    const cargo: Cargo = {};
    for (const id in ship.cargo) {
      const n = Math.floor((ship.cargo[id as GoodId] ?? 0) * frac);
      if (n > 0) cargo[id as GoodId] = n;
    }
    // The hull itself breaks up into salvage.
    for (const [g, n] of Object.entries(wreckSalvage(ship))) cargo[g as GoodId] = (cargo[g as GoodId] ?? 0) + (n ?? 0);
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
    this.loot.set(id, { id, x: ship.state.x, y: ship.state.y, cargo, gold, expires: this.now + LOOT_LIFETIME_SEC, wreck: ship.region, monster: isMonster(ship), claim: victor !== null ? { account: victor, until: this.now + 30 } : undefined });
  }

  private creditKill(killer: ShipEntity, victim: ShipEntity, how: 'sunk' | 'boarded'): void {
    if (killer.ghost) return this.zone?.forwardKill(killer, victim, how); // the killer sails in another zone
    const s = this.sessionOf(killer);
    if (killer.ownerId !== null) {
      const owner = this.ships.get(killer.ownerId);
      if (owner) return this.creditKill(owner, victim, how);
    }
    if (!s || !s.profile) return;
    const p = s.profile;
    const tier = victim.cls.monster ? 1 : victim.cls.tier; // a rotten hulk is no ship of the line
    const xp = (how === 'sunk' ? 45 : 70) * tier * (1 + victim.level / 12);
    if (how === 'sunk') p.stats.sunk++;
    else p.stats.boarded++;
    this.shared?.bump(how === 'sunk' ? 'sunk' : 'boarded', s.accountId, s.name, 1);
    onFightWon(this, s);
    questEvent(this, s, how === 'sunk' ? { k: 'sink', victim } : { k: 'board', victim });
    if (how === 'sunk') marqueBounty(this, s, victim);
    if (how === 'boarded') grantDeed(this, s, 'deed_first_prize');
    if (victim.loadout.classId === 'man_o_war') grantDeed(this, s, 'deed_ship_of_the_line');
    eventShipLost(this, victim);
    // The season's tables and the war of Crown and Code.
    seasonStat(this, s, 'sunk', 1);
    if ((victim.npcRole === 'pirate' || victim.npcRole === 'ghost' || victim.faction === 'confederacy') && killer.wantedCache === 0) seasonStat(this, s, 'lawful', how === 'boarded' ? 2 : 1);
    if (how === 'boarded' || (victim.faction !== 'player' && !victim.cls.monster && FACTIONS[victim.faction].lawful)) seasonStat(this, s, 'plunder', how === 'boarded' ? 2 : 1);
    if (victim.name.startsWith('Echo of')) seasonStat(this, s, 'abyss', 3);
    warKill(this, victim);
    onGhostSunk(this, s, victim);
    onAbyssKill(this, s, victim);
    let escorts = 0;
    for (const o of this.ships.values()) if (o.ownerId === killer.id && o.alive) escorts++;
    // Captains of your group fighting nearby count as your fleet; they share a part of the glory.
    const group = groupOfAccount(this, s.accountId);
    const mates: PlayerSession[] = [];
    if (group) {
      for (const m of group.members) {
        const ms = m === s.accountId ? null : this.byAccount.get(m);
        if (ms?.ship && ms.profile && ms.ship.alive && !ms.ship.docked && dist(ms.ship.state.x, ms.ship.state.y, victim.state.x, victim.state.y) <= CONVOY_RANGE) mates.push(ms);
      }
      escorts += mates.length;
    }
    if (escorts >= 2) {
      grantDeed(this, s, 'deed_fleet_victory');
      questEvent(this, s, { k: 'fleet_win' });
    }
    checkStatDeeds(this, s);
    this.grantXp(s, xp, `${how === 'sunk' ? 'Sank' : 'Took'} ${victim.name}`);
    for (const ms of mates) this.grantXp(ms, xp * 0.4, `${s.name} ${how === 'sunk' ? 'sank' : 'took'} ${victim.name}`);
    // Law and reputation (monsters and hulks answer to nobody).
    if (victim.faction !== 'player' && !victim.cls.monster) {
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
    if (victim.isPlayer) {
      if (victim.wantedCache >= 3) grantDeed(this, s, 'deed_wanted_legend');
      // Crown and captains' bounties, repeat kills, the Shame, the right of revenge; war score.
      onPlayerKill(this, killer, victim, how);
      onWarKill(this, killer, victim, how);
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
      if (drownedKingRises(this, s)) return;
      this.playerDeath(s, ship);
      return;
    }
    if (ship.fleetId) escortLost(this, ship);
    this.removeShip(ship.id);
  }

  private playerDeath(s: PlayerSession, ship: ShipEntity): void {
    const p = s.profile!;
    grantBubble(this, s);
    onSunkCrew(this, s);
    questEvent(this, s, { k: 'die', region: ship.region });
    anchorFleet(this, s, 0.5); // without the flagship the squadron scatters home
    const lostValue = cargoValue(ship.cargo);
    // Lifeboats: fewer men lost, part of the lawful cargo saved.
    const boats = tval(ship.stats, 'lifeboats');
    const crewLost = Math.max(0, Math.round(ship.crew * 0.35 * Math.max(0, 1 - 0.3 * boats)));
    const saved: Cargo = {};
    if (boats > 0 && !ship.hasFlag('scuttle_charges')) {
      for (const id of Object.keys(ship.cargo) as GoodId[]) {
        if (GOODS[id].contraband) continue;
        const n = Math.floor((ship.cargo[id] ?? 0) * Math.min(1, 0.2 * boats));
        if (n > 0) saved[id] = n;
      }
    }
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
    losePrizes(this, ship);
    p.trade.voyageProfit = 0;
    p.trade.voyageShare = 0;
    p.smuggle.brokerPassUsed = false;
    // Smuggler's Luck: some contraband turns up in the Brokers' warehouse at Fogmouth.
    const luck = tval(ship.stats, 'smugglersLuck');
    if (luck > 0) {
      for (const id of Object.keys(ship.cargo) as GoodId[]) {
        if (!GOODS[id].contraband || !this.rng.chance(luck)) continue;
        const wh = (p.warehouses.fogmouth ??= {});
        wh[id] = (wh[id] ?? 0) + (ship.cargo[id] ?? 0);
        this.sendTo(s, { t: 'toast', msg: `Your ${GOODS[id].name.toLowerCase()} waits for you in the Brokers' warehouse at Fogmouth.`, kind: 'good' });
      }
    }
    // A sinking ends the voyage.
    p.deedState.voyagePorts = [];
    p.deedState.wantedTime = 0;
    // Respawn at the last port if it will still have us, otherwise the nearest that will.
    let port = this.portById(p.lastPort);
    if (!port || !canDock(p, port.faction).ok) port = this.nearestPort(ship.state.x, ship.state.y, (q) => canDock(p, q.faction).ok) ?? this.portById(START_PORT)!;
    ship.cargo = saved;
    if (Object.keys(saved).length) this.sendTo(s, { t: 'toast', msg: `The boats saved ${Object.entries(saved).map(([g, n]) => `${n} ${GOODS[g as GoodId].name}`).join(', ')}.`, kind: 'good' });
    ship.voyageStart = 0;
    ship.wounded = 0;
    for (const a of AMMO_IDS) ship.ammo[a] = Math.floor(ship.ammo[a] * 0.5);
    ship.crew = Math.max(Math.round(ship.stats.crewMin * 0.6), ship.crew - crewLost);
    ship.morale = 50;
    ship.sinkingUntil = 0;
    ship.surrendered = false;
    ship.boarding = null;
    ship.effects = [];
    ship.companyKey = '';
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
    if (b.bossOf && bossBoarded(this, a, b)) return;
    if (b.caravanOf !== null) caravanLost(this, b);
    const sa = this.sessionOf(a);
    if (sa) {
      const crew = prizeCrewNeeded(a, b);
      result.prize = crew !== null ? { crew, value: prizeValue(b, a) } : null;
      result.captive = a.hasFlag('ransom') && !a.hasFlag('no_quarter') && !b.isPlayer;
      result.recruits = !b.isPlayer && sa.profile ? maxRecruits(a, b, sa.profile.company) : 0;
      // No Quarter in contested waters: the whole sea hears of it.
      if (a.hasFlag('no_quarter') && REGIONS[a.region].safety === 'contested' && sa.profile) {
        const lvl = wantedLevel(sa.profile.infamy);
        if (lvl < 5) this.addInfamy(a, WANTED_THRESHOLDS[lvl + 1] - sa.profile.infamy + 1, 'gave no quarter');
      }
      sa.pendingBoarding = { result, targetId: b.id };
      const loser = this.sessionOf(b);
      if (loser?.profile) stealMaps(this, sa, loser); // the captain's chest goes with the ship
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

  private resolveLoot(s: PlayerSession, take: Cargo, fateAsked: 'sink' | 'release' | 'ransom' | 'prize', recruit = 0): string | null {
    // No Quarter: whatever is chosen, she goes down.
    const fate = s.ship?.hasFlag('no_quarter') ? 'sink' : fateAsked;
    const pend = s.pendingBoarding;
    const ship = s.ship;
    if (!pend || !ship || !s.profile) return 'Nothing to loot';
    s.pendingBoarding = null;
    const target = this.ships.get(pend.targetId);
    if (!target || target.lootLockedFor !== ship.id) return 'The prize slipped away';
    if (dist(ship.state.x, ship.state.y, target.state.x, target.state.y) > 400) return 'The prize drifted too far';
    // Move cargo within hold limits.
    let free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
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
    // Moving plunder across takes time alongside her (Swift Plunder and Dockhands shorten it).
    if (moved > 0) {
      const speed = Math.max(0.25, 1 - tval(ship.stats, 'transferSpeed'));
      ship.transferUntil = this.now + (3 + moved * 0.06) * speed;
      this.toastShip(ship, `Swaying ${moved} units across (${Math.ceil(ship.transferUntil - this.now)} s alongside).`, 'info');
    }
    if (fate === 'sink' || fate === 'prize') takeCaptive(this, s, target);
    // Prisoners who sign on.
    if (recruit > 0 && !target.isPlayer) {
      const n = recruitPrisoners(this, s, target, recruit);
      if (n) this.toastShip(ship, `${n} of her crew sign the articles (loyalty 20: former enemies).`, 'info');
    }
    // A cruel officer resents letting them go.
    if (fate === 'release' && s.profile.company.officers.some((o) => o.traits.includes('cruel'))) {
      for (const o of s.profile.company.officers) if (o.traits.includes('cruel')) o.loyalty = Math.max(0, o.loyalty - 10);
    }
    if (!target.isPlayer) mapChance(this, s, target.npcRole === 'pirate' ? 0.1 : 0.05, target.npcRole === 'pirate' ? 2 : 1, "In her captain's cabin");
    const kept = plunderShare(this, s, pend.result.gold);
    s.profile.gold += kept;
    if (pend.result.gold) this.db.ledger(s.accountId, 'plunder', kept, target.name);
    if (!target.isPlayer) target.purse = 0;
    target.lootLockedFor = null;
    const f = target.faction !== 'player' ? target.faction : null;
    if (fate === 'prize') {
      const err2 = takePrize(this, s, target);
      if (!err2) {
        if (f) changeRep(s.profile, f, -6);
        return null;
      }
      this.toastShip(ship, `${err2} — she is scuttled instead.`, 'bad');
    }
    if (fate === 'sink' || fate === 'prize') {
      this.dropWreckage(target, 0.3);
      target.cargo = {};
      target.attackers.set(ship.id, this.now);
      this.beginSinking(target);
      this.toastShip(ship, `${target.name} goes down with ${moved} units of her cargo in your hold.`, 'good');
    } else if (fate === 'ransom' && !target.isPlayer) {
      const keptRansom = plunderShare(this, s, pend.result.ransom);
      s.profile.gold += keptRansom;
      this.db.ledger(s.accountId, 'ransom', keptRansom, target.name);
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
    bubbleOnLoot(this, ship, l.ownerOnly === ship.accountId);
    const s = this.sessionOf(ship);
    if (!s || !s.profile) return;
    if (l.decoy) {
      this.loot.delete(l.id);
      this.toastShip(ship, 'Empty casks, weighted to float. A decoy!', 'bad');
      return;
    }
    if (l.wreck && !l.salvaged) {
      l.salvaged = true; // the first salvager works the wreck over
      salvageBonus(this, s, l.cargo, l.wreck);
      // Leviathan Lore: more off a monster of the deep.
      if (l.monster && ship.hasFlag('leviathan_lore')) for (const g in l.cargo) l.cargo[g as GoodId] = Math.round((l.cargo[g as GoodId] ?? 0) * 1.2);
      // Beachcombing: something of value in the flotsam.
      if (this.rng.chance(0.05 + tval(ship.stats, 'beachcomber'))) {
        if (this.rng.chance(0.3)) mapChance(this, s, 1, 1, 'Wrapped in oilcloth in the flotsam');
        else {
          const found = this.rng.int(60, 240);
          s.profile.gold += found;
          this.db.ledger(s.accountId, 'loot', found, 'beachcomb');
          this.toastShip(ship, `A purse in the flotsam: ${found} silver.`, 'gold');
        }
      }
    }
    let free = ship.stats.holdVolume - cargoVolume(ship.cargo, ship.stats.contrabandVolumeMul, ship.stats.materialVolumeMul, ship.stats.provisionVolumeMul, ship.stats.cursedVolumeMul);
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
  /** Ships worth a lookout's shout (ghosts, hunters, notorious captains): listed once a second, not per captain. */
  private notables: { o: ShipEntity; kind: 'ghost' | 'hunter' | 'notorious' }[] = [];
  private notablesAt = -1;

  private recordSightings(s: PlayerSession): void {
    const ship = s.ship!;
    const p = s.profile!;
    if (this.notablesAt !== Math.floor(this.now)) {
      this.notablesAt = Math.floor(this.now);
      this.notables = [];
      for (const o of this.ships.values()) {
        const kind = o.npcRole === 'ghost' ? 'ghost' : o.npcRole === 'hunter' ? 'hunter' : o.isPlayer && o.wantedCache >= 3 ? 'notorious' : null;
        if (kind && o.alive) this.notables.push({ o, kind });
      }
    }
    const range = Math.min(INTEREST_RADIUS, ship.stats.detection);
    for (const { o, kind } of this.notables) {
      if (o.id === ship.id || o.docked || o.hasFlag('hidden') || dist(o.state.x, o.state.y, ship.state.x, ship.state.y) > range) continue;
      const name = o.isPlayer ? `${o.captainName} (${o.name})` : o.name;
      const rec = { name, kind, x: Math.round(o.state.x), y: Math.round(o.state.y), t: Math.round(this.now) };
      const i = p.sightings.findIndex((q) => q.name === name);
      if (i >= 0) p.sightings[i] = rec;
      else {
        p.sightings.push(rec);
        this.sendTo(s, { t: 'toast', msg: kind === 'ghost' ? `Lookout: a ship with no lights… ${o.name}.` : `Lookout: ${name} sighted.`, kind: 'info' });
        if (p.sightings.length > 25) p.sightings.shift();
      }
    }
  }

  /** Share of the normal sighting range left by fog and storm murk (Dead Reckoning and Storm Rider see through). */
  sightFactor(ship: ShipEntity): number {
    const w = this.weatherOf(ship);
    let f = w === 'fog' ? 0.6 : w === 'storm' || w === 'black_storm' ? 0.8 : 1;
    if (ship.hasFlag('dead_reckoning')) f = 1 - (1 - f) / 2;
    if (ship.hasFlag('fog_born') && w === 'fog') f *= 1.1;
    if (w === 'fog') f *= 1 + tval(ship.stats, 'fogSight'); // Drowned Eyes
    if (ship.hasFlag('storm_rider') && (w === 'storm' || w === 'black_storm')) f = 1 - (1 - f) / 2;
    if (tval(ship.stats, 'eyeOfStorm') >= 1 && (w === 'storm' || w === 'black_storm')) f = 1; // Eye of the Storm
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
    questEvent(this, s, { k: 'chart' });
    this.shared?.bump('charted', s.accountId, s.name, 1);
    const strange = REGIONS[is.region].strangeness;
    const xp = 12 + Math.min(40, is.radius / 40) + strange * 60 + (is.features.includes('ruins') ? 25 : 0);
    this.sendTo(s, { t: 'ev', list: [{ k: 'discover', islandId: is.id, name: is.name, region: is.region }] });
    const ship = s.ship;
    this.grantXp(s, xp * (1 + (ship ? tval(ship.stats, 'cartography') : 0)), null);
    // Pathfinder: a new landfall lifts the crew.
    const pf = ship ? tval(ship.stats, 'pathfinder') : 0;
    if (ship && pf > 0) {
      ship.morale = Math.min(100, ship.morale + 10);
      ship.addEffect({ id: 'pathfinder', until: this.now + 600, mods: { maxSpeed: pf } }, this.now);
    }
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
    // Contract Broker rank 2: +10%.
    if (s.ship && tval(s.ship.stats, 'contractBroker') >= 2) c.reward = Math.round(c.reward * 1.1);
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

  attach(conn: GameConn): PlayerSession {
    const s = new PlayerSession(conn);
    this.sessions.add(s);
    conn.onMessage = (text) => this.onMessage(s, text);
    conn.onClose = () => this.onDisconnect(s);
    return s;
  }

  sendTo(s: PlayerSession, msg: ServerMsg): void {
    if (s.conn.closed || s.disconnectedAt !== null) return;
    this.sendText(s, JSON.stringify(msg));
  }

  /** An already-serialised message. */
  sendText(s: PlayerSession, text: string): void {
    if (s.conn.closed || s.disconnectedAt !== null) return;
    this.metrics.bytesText += text.length;
    s.conn.send(text);
  }

  /** Snapshots are the hot path: binary frames (shared/src/codec.ts). */
  private sendSnap(s: PlayerSession, msg: Extract<ServerMsg, { t: 'snap' }>): void {
    if (s.conn.closed || s.disconnectedAt !== null) return;
    const bytes = encodeSnap(msg);
    this.metrics.bytesBinary += bytes.byteLength;
    s.conn.sendBinary(bytes);
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
    this.zone?.onEvent(ev, x, y);
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
        if (s.profile?.company.mutiny) return; // the mutineers hold the wheel
        ship.input = { rudder: clamp(msg.rudder, -1, 1), sailTarget: SAIL_STEPS[clamp(Math.round(msg.sail), 0, SAIL_STEPS.length - 1)] };
        if (ship.hasFlag('unsinkable') && ship.captain !== 'drowned') ship.input.sailTarget = Math.min(ship.input.sailTarget, 0.9);
        if (Number.isInteger(msg.seq)) ship.lastInputSeq = msg.seq;
        return;
      }
      case 'fire':
        if (msg.side !== 'port' && msg.side !== 'starboard') return;
        {
          const why = fireBroadside(this, ship, msg.side, Number(msg.dist), Number.isFinite(msg.x) && Number.isFinite(msg.y) ? { x: Number(msg.x), y: Number(msg.y) } : undefined);
          if (!why) lineOfBattle(this, ship, msg.side, Number.isFinite(Number(msg.dist)) ? Number(msg.dist) : 300);
          return err(why);
        }
      case 'craft':
        return err(craft(this, s, msg.recipe, Math.trunc(Number(msg.n))));
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
        return err(useTalentActive(this, s, String(msg.id), Number.isFinite(msg.x) ? Number(msg.x) : undefined, Number.isFinite(msg.y) ? Number(msg.y) : undefined));
      case 'escort':
        if (msg.action === 'hire') return portAction((pt) => hireEscort(this, s, pt, msg.classId as ShipClassId));
        if (msg.action === 'dismiss') return portAction(() => dismissEscort(this, s, String(msg.id)));
        return;
      case 'quest':
        if (msg.action === 'accept') return portAction((pt) => acceptQuest(this, s, pt, String(msg.id)));
        if (msg.action === 'abandon') {
          err(abandonQuest(this, s, String(msg.id)));
          this.pushSelf(s, true);
        }
        return;
      case 'path':
        return portAction((pt) => switchPath(this, s, pt, msg.to));
      case 'oath':
        return portAction((pt) => swearOath(this, s, pt, msg.oath === 'code' ? 'code' : 'marque'));
      case 'build':
        return portAction((pt) => orderBuild(this, s, pt, msg.req));
      case 'build_launch':
        return portAction((pt) => launchBuild(this, s, pt, String(msg.id)));
      case 'berth':
        return portAction((pt) => (msg.action === 'sell' ? sellBerth(this, s, pt, Math.trunc(Number(msg.index))) : swapBerth(this, s, pt, Math.trunc(Number(msg.index)))));
      case 'plan_buy':
        return portAction((pt) => buyPlan(this, s, pt, msg.classId));
      case 'figurehead_buy':
        return portAction((pt) => buyFigurehead(this, s, pt));
      case 'formation':
        err(setFormation(this, s, msg.formation));
        this.pushSelf(s, true);
        return;
      case 'ability':
        return err(useAbility(this, ship, String(msg.id), msg.x, msg.y));
      case 'board': {
        const target = this.ships.get(Number(msg.target));
        if (!target) return err('No such ship');
        const monster = bossBoardOrder(this, ship, target);
        if (monster !== undefined) return err(monster);
        const agg = msg.aggression === 'careful' || msg.aggression === 'brutal' ? msg.aggression : 'standard';
        const why = canBoard(this, ship, target);
        if (why) return err(why);
        startBoarding(this, ship, target, agg);
        return;
      }
      case 'board_cut':
        return err(cutGrapples(this, ship));
      case 'scuttle':
        return err(lightFuse(this, ship));
      case 'captive':
        return portAction((pt) => captiveAction(this, s, pt, Math.trunc(Number(msg.index)), msg.mode === 'hand_over' ? 'hand_over' : 'ransom'));
      case 'loot_take':
        err(this.resolveLoot(s, msg.take ?? {}, msg.fate === 'prize' || msg.fate === 'ransom' || msg.fate === 'release' ? msg.fate : 'sink', Math.max(0, Math.trunc(Number(msg.recruit) || 0))));
        this.sendTo(s, { t: 'boarding', result: null });
        this.pushSelf(s, true);
        return;
      case 'repair':
        if (msg.on && ship.inCombat(this.now) && !ship.hasFlag('battle_repair')) return err('Carpenters cannot work under fire (needs Battle Repair).');
        ship.repairing = !!msg.on;
        return;
      case 'dock':
        return err(this.tryDock(s, !!msg.bribe));
      case 'jettison':
        return err(this.jettison(s, msg.good, Math.trunc(Number(msg.qty))));
      case 'treasure':
        return portAction((pt) => (msg.action === 'buy' ? tavernMap(this, s, pt.id) : cartographerAction(this, s, msg.action === 'assemble' ? 'assemble' : 'merge', Math.trunc(Number(msg.tier)))));
      case 'fence_sell':
        return portAction((pt) => {
          const f = portFence(this, ship, pt);
          if (f === null) return 'No fence here for you';
          return fenceSale(this, s, msg.good, Math.trunc(Number(msg.qty)), f, pt.id);
        });
      case 'undock':
        return err(this.undock(s));
      case 'trade':
        return portAction((pt) => trade(this, s, pt, msg.good, Math.trunc(Number(msg.qty))));
      case 'buy_ammo':
        return portAction((pt) => buyAmmo(this, s, pt, msg.ammo, Math.trunc(Number(msg.qty))));
      case 'hire_crew':
        if (Number(msg.qty) > 0 && port && hireBlocked(this, port)) return err(hireBlocked(this, port));
        return portAction((pt) => hireCrew(this, s, pt, Math.trunc(Number(msg.qty)), msg.prof && PROFESSIONS.includes(msg.prof) ? msg.prof : 'sailor', !!msg.dregs));
      case 'press_gang':
        return portAction((pt) => pressGang(this, s, pt, Math.trunc(Number(msg.qty))));
      case 'officer':
        if (msg.action === 'order') return err(officerOrder(this, s, String(msg.id)));
        if (msg.action === 'hire') return portAction((pt) => hireOfficer(this, s, pt, String(msg.id)));
        if (msg.action === 'dismiss') return portAction(() => dismissOfficer(this, s, String(msg.id)));
        return;
      case 'codex': {
        const share = Math.round(Number(msg.share));
        if (!Number.isFinite(share)) return;
        s.profile!.company.share = Math.max(0, Math.min(50, share));
        this.pushSelf(s, true);
        return;
      }
      case 'mutiny':
        if (!['pay', 'suppress', 'yield', 'duel'].includes(msg.choice)) return;
        err(resolveMutiny(this, s, msg.choice));
        this.pushSelf(s, true);
        return;
      case 'shipyard':
        return portAction((pt) => {
          // Modular Refit: fittings change in any port.
          const fitting = msg.action === 'module' || msg.action === 'unfit';
          if (pt.shipyardTier <= 0 && !(fitting && ship.hasFlag('modular_refit'))) return 'No shipyard here';
          switch (msg.action) {
            case 'unfit':
              return shipyardUnfit(this, s, msg.module);
            case 'keel':
              return layKeel(this, s);
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
          if (ship.hasFlag('black_ledger') && pt.faction === 'league') return 'The Gilded Ledger has no work for the Black Ledger';
          const hot = p.smuggle.hotRun;
          if (hot && hot.id === msg.id) {
            p.contracts.push({ ...hot, progress: 0 });
            p.smuggle.hotRun = null;
            return null;
          }
          const slots = 3 + (tval(ship.stats, 'contractBroker') >= 1 ? 1 : 0);
          if (p.contracts.length >= slots) return `You can hold at most ${slots} contracts`;
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
      case 'map':
        err(mapAction(this, s, port, String(msg.action), msg.id, msg.to));
        this.pushSelf(s, true);
        return;
      case 'season':
        err(seasonAction(this, s, String(msg.action), msg.value, msg.islandId !== undefined ? Number(msg.islandId) : undefined));
        this.sendTo(s, { t: 'legends', view: legendsView(this, s) });
        return;
      case 'legends':
        this.sendTo(s, { t: 'legends', view: legendsView(this, s) });
        return;
      case 'abyss':
        err(raisingRitual(this, s));
        this.pushSelf(s, true);
        return;
      case 'dive_move':
        return err(diveMove(this, s, String(msg.dir)));
      case 'dive_surface':
        return err(diveSurface(this, s));
      case 'land':
        if (!ship.docked && cityHere(this, ship) && !this.expeditions.runOf(s.accountId)) return err(startDive(this, s));
        err(coveAt(this, ship) && Object.keys(ship.cargo).some((g) => GOODS[g as GoodId].contraband) ? coveSell(this, s) : startLanding(this, s));
        this.pushSelf(s, true);
        return;
      case 'chart':
        return portAction((pt) => (msg.action === 'sell' ? sellCharts(this, s, pt) : buyChart(this, s, pt, msg.region)));
      case 'insure':
        return portAction((pt) => buyPolicy(this, s, pt, msg.tier === 'cargo' || msg.tier === 'full' ? msg.tier : 'hull'));
      case 'option':
        return portAction((pt) => buyOption(this, s, pt, msg.good, Math.trunc(Number(msg.qty)), priceMods(ship, pt, p, this.now, this)));
      case 'option_exercise':
        return portAction((pt) => exerciseOption(this, s, pt, Math.trunc(Number(msg.index))));
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
      case 'group':
        switch (msg.action) {
          case 'invite':
            return err(groupInvite(this, s, msg.name));
          case 'kick':
            return err(groupKick(this, s, msg.name));
          case 'lead':
            return err(groupLead(this, s, msg.name));
          case 'accept':
          case 'decline':
            return err(groupAnswer(this, s, Math.trunc(Number(msg.id)), msg.action === 'accept'));
          case 'leave':
            return err(groupLeave(this, s));
          case 'convoy':
            return err(groupConvoy(this, s, !!msg.on));
          case 'say':
            return err(groupSay(this, s, msg.text));
        }
        return;
      case 'barter':
        switch (msg.action) {
          case 'propose':
            return err(barterPropose(this, s, msg.name));
          case 'offer':
            return err(barterOffer(this, s, msg.gold, msg.cargo));
          case 'ready':
            return err(barterReady(this, s));
          case 'cancel': {
            const b = this.social.barters.get(s.accountId);
            if (b) cancelBarter(this, b, `${s.name} walked away`);
            return;
          }
        }
        return;
      case 'mail':
        switch (msg.action) {
          case 'list':
            return sendMail(this, s);
          case 'send':
            err(mailSend(this, s, msg.to, msg.subject, msg.body, msg.gold));
            return this.pushSelf(s, true);
          case 'read':
            return err(mailRead(this, s, Math.trunc(Number(msg.id))));
          case 'take':
            err(mailTake(this, s, Math.trunc(Number(msg.id))));
            return this.pushSelf(s, true);
          case 'delete':
            return err(mailDelete(this, s, Math.trunc(Number(msg.id))));
        }
        return;
      case 'market': {
        const from = msg.action !== 'list' && 'from' in msg && msg.from === 'warehouse' ? 'warehouse' : 'hold';
        const int = (v: unknown) => Math.trunc(Number(v));
        switch (msg.action) {
          case 'list':
            if (!port) return err('The market board is in port');
            return sendMarket(this, s, port);
          case 'sell':
            return portAction((pt) => marketSell(this, s, pt, msg.good, int(msg.qty), int(msg.price), from));
          case 'buy_order':
            return portAction((pt) => marketBuyOrder(this, s, pt, msg.good, int(msg.qty), int(msg.price)));
          case 'auction':
            return portAction((pt) => marketAuction(this, s, pt, msg.good, int(msg.qty), int(msg.price), int(msg.buyout), int(msg.hours), from));
          case 'fill':
            return portAction((pt) => marketFill(this, s, pt, int(msg.id), int(msg.qty)));
          case 'bid':
            return portAction((pt) => marketBid(this, s, pt, int(msg.id), int(msg.price)));
          case 'cancel':
            return portAction((pt) => marketCancel(this, s, pt, int(msg.id)));
        }
        return;
      }
      case 'pvp':
        switch (msg.action) {
          case 'black_flag':
            return err(setBlackFlag(this, s, !!msg.on));
          case 'duel':
            return err(challengeDuel(this, s, msg.name, !!msg.fleet));
          case 'duel_answer':
            err(answerDuel(this, s, Math.trunc(Number(msg.id)), !!msg.accept));
            return this.pushSelf(s, true);
          case 'forfeit':
            return err(forfeitDuel(this, s));
          case 'bounty':
            err(postBounty(this, s, msg.name, Number(msg.amount)));
            return this.pushSelf(s, true);
          case 'bounties':
            return sendBounties(this, s);
        }
        return;
      case 'isle': {
        const id = Math.trunc(Number('island' in msg ? msg.island : -1));
        const done = (e: string | null) => {
          err(e);
          this.sendTo(s, { t: 'holdings', ...holdingsFor(this, s) });
    pushGuild(this, s);
    if (s.ship) s.ship.guildTag = this.guilds.of(this, s.accountId)?.tag ?? null;
          this.pushSelf(s, true);
        };
        switch (msg.action) {
          case 'list':
            return done(null);
          case 'rent':
            return done(rentIsland(this, s, id, Math.trunc(Number(msg.days))));
          case 'auto':
            return done(setAutoRenew(this, s, id, !!msg.on));
          case 'treasury':
            return done(treasuryMove(this, s, id, Number(msg.amount)));
          case 'build':
            return done(build(this, s, id, msg.building));
          case 'demolish':
            return done(demolish(this, s, id, Math.trunc(Number(msg.index))));
          case 'store':
            return done(storeMove(this, s, id, msg.good, Math.trunc(Number(msg.qty))));
          case 'service':
            return done(islandService(this, s, id, msg.what, msg.arg ?? ''));
          case 'window':
            return done(setWindow(this, s, id, Number(msg.hour)));
          case 'siege':
            return done(declareSiege(this, s, id));
          case 'fortify':
            return done(fortify(this, s, id));
          case 'siege_choice':
            return done(chooseOutcome(this, s, id, msg.choice));
          case 'yard_order': {
            const yard = islandYard(this, s, id);
            return done(typeof yard === 'string' ? yard : orderBuild(this, s, yard, msg.req));
          }
          case 'yard_launch': {
            const yard = islandYard(this, s, id);
            return done(typeof yard === 'string' ? yard : launchBuild(this, s, yard, String(msg.id)));
          }
          case 'yard_berth': {
            const yard = islandYard(this, s, id);
            return done(typeof yard === 'string' ? yard : swapBerth(this, s, yard, Math.trunc(Number(msg.index))));
          }
        }
        return;
      }
      case 'guild': {
        const done = (e: string | null) => {
          err(e);
          pushGuild(this, s);
          this.pushSelf(s, true);
        };
        const tag = 'tag' in msg ? String(msg.tag ?? '') : '';
        switch (msg.action) {
          case 'view':
            return done(null);
          case 'found':
            return done(foundGuild(this, s, msg.name, msg.tag));
          case 'invite':
            return done(guildInvite(this, s, msg.name));
          case 'answer':
            return done(answerInvite(this, s, Math.trunc(Number(msg.id)), !!msg.accept));
          case 'leave':
            return done(leaveGuild(this, s));
          case 'disband':
            return done(disbandGuild(this, s));
          case 'office':
            return done(openOffice(this, s));
          case 'return_ship':
            return done(returnShip(this, s));
          case 'kick':
            return done(guildKick(this, s, Math.trunc(Number(msg.account))));
          case 'rank':
            return done(setRank(this, s, Math.trunc(Number(msg.account)), msg.rank));
          case 'treasury':
            return done(guildTreasury(this, s, Number(msg.amount)));
          case 'tax':
            return done(setTax(this, s, Number(msg.pct)));
          case 'store':
            return done(guildStore(this, s, msg.good, Math.trunc(Number(msg.qty))));
          case 'contract':
            return done(postContract(this, s, msg.good, Math.trunc(Number(msg.qty)), Math.trunc(Number(msg.reward))));
          case 'drop_contract':
            return done(dropContract(this, s, Math.trunc(Number(msg.id))));
          case 'give_ship':
            return done(giveShip(this, s, Math.trunc(Number(msg.berth))));
          case 'borrow_ship':
            return done(borrowShip(this, s, Math.trunc(Number(msg.id))));
          case 'flagship':
            return done(setFlagship(this, s, msg.account === null ? null : Math.trunc(Number(msg.account))));
          case 'war':
            return done(declareWar(this, s, tag));
          case 'peace':
            return done(proposePeace(this, s, tag, Number(msg.tribute)));
          case 'alliance':
          case 'pact':
            return done(offerTreaty(this, s, msg.action, tag));
          case 'break_alliance':
            return done(breakTreaty(this, s, 'alliance', tag));
          case 'break_pact':
            return done(breakTreaty(this, s, 'pact', tag));
          case 'toll':
            return done(setToll(this, s, Math.trunc(Number(msg.island)), Number(msg.pct)));
          case 'base':
            return done(raiseBase(this, s, Math.trunc(Number(msg.island))));
          case 'lease':
            err(rentIsland(this, s, Math.trunc(Number(msg.island)), Math.trunc(Number(msg.days)), true));
            this.sendTo(s, { t: 'holdings', ...holdingsFor(this, s) });
            return done(null);
          case 'say': {
            const g = this.guilds.of(this, s.accountId);
            const text = String(msg.text ?? '').slice(0, 200).trim();
            if (!g || !text) return;
            for (const m of g.members) {
              const ms = this.byAccount.get(m.account);
              if (ms) this.sendTo(ms, { t: 'chat', from: `[${g.tag}] ${s.name}`, text, ch: 'guild' });
            }
            return;
          }
        }
        return;
      }
      case 'chat': {
        const text = String(msg.text ?? '').slice(0, 200).trim();
        if (!text) return;
        for (const o of this.sessions) this.sendTo(o, { t: 'chat', from: s.name, text });
        this.shared?.publishChat(s.name, text);
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
    // Crossing from another zone: the captain as they left it, not as last saved.
    const handoff = this.zone?.takePending(s.accountId) ?? null;
    if (handoff && !s.profile) {
      s.profile = sanitizeProfile(handoff.profile);
      s.discovered = new Set(s.profile.discovered);
      this.spawnPlayerShip(s, handoff.ship.x, handoff.ship.y, handoff.ship.heading, handoff.ship.id);
      const sh = s.ship!;
      if (!sh.docked) {
        sh.state.speed = handoff.ship.speed;
        sh.state.sail = handoff.ship.sail;
        sh.input = { rudder: handoff.ship.rudder, sailTarget: handoff.ship.sailTarget };
        sh.protectedUntil = 0;
      }
      this.zone!.landOwned(handoff, sh.id);
    }
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

  private spawnPlayerShip(s: PlayerSession, x: number, y: number, heading: number, id?: number): void {
    const p = s.profile!;
    if (s.ship && this.ships.has(s.ship.id)) return;
    const ship = new ShipEntity({
      id: id ?? this.allocId(), name: p.shipName, captainName: s.name, captain: p.captain, faction: 'player', accountId: s.accountId,
      loadout: p.loadout, talents: p.talents, x, y, heading,
    });
    ship.level = p.level;
    ship.cargo = p.cargo;
    ship.ammo = p.ammo;
    ship.ammoSel = p.ammoSel;
    ship.crew = Math.min(p.crew, ship.stats.crewMax);
    ship.morale = p.morale;
    ship.sanity = p.sanity;
    ship.pressure = p.pressure;
    ship.title = p.title;
    ship.pennant = p.pennant;
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
    s.sentRows.clear();
    s.knownChunks.clear();
    this.lastSelf.delete(s); // the init carries the whole private state
    this.sendTo(s, {
      t: 'init', self: toPrivateState(s, this.now, this.worldView(s)), ports, currents: this.world.currents, whirlpools: this.world.whirlpools, discovered: [...s.discovered], time: this.now, entityId: s.ship!.id,
    });
    // Islands the captain has charted are sent up front so the world map is complete.
    this.sendIslands(s, [...s.discovered]);
    this.streamChunks(s);
    if (s.ship && !s.ship.docked) this.sendFronts(s);
    s.lastRegion = '';
    if (s.ship?.docked) this.pushPort(s);
    if (s.pendingBoarding) this.sendTo(s, { t: 'boarding', result: s.pendingBoarding.result });
    sendEvents(this, s);
    applyPantheon(this, s);
    sendSites(this, s);
    pushParty(this, s);
    mailOnLogin(this, s);
    this.sendTo(s, { t: 'holdings', ...holdingsFor(this, s) });
  }

  private onDisconnect(s: PlayerSession): void {
    this.sessions.delete(s);
    if (!s.authed || this.byAccount.get(s.accountId) !== s) return;
    s.disconnectedAt = this.now;
    const barter = this.social.barters.get(s.accountId);
    if (barter) cancelBarter(this, barter, `${s.name} has gone`);
    // Ships at sea linger (anti combat-logging); docked ships leave at once.
    s.lingerUntil = s.ship && !s.ship.docked ? this.now + LOGOUT_TIMER_SEC : this.now;
    if (s.ship) s.ship.input = { rudder: 0, sailTarget: 0 };
    this.saveSession(s);
  }

  private retireSession(s: PlayerSession): void {
    this.shared?.leave(s.accountId, s.name);
    socialRetire(this, s);
    if (s.profile) anchorFleet(this, s);
    this.saveSession(s);
    for (const c of caravansOf(this, s.accountId)) this.removeShip(c.id);
    if (s.ship) {
      losePrizes(this, s.ship);
      this.removeShip(s.ship.id);
    }
    if (this.byAccount.get(s.accountId) === s) this.byAccount.delete(s.accountId);
  }

  // ================================================================= docking

  private tryDock(s: PlayerSession, bribing = false): string | null {
    const ship = s.ship!;
    const p = s.profile!;
    if (ship.docked) return 'Already in port';
    if (!ship.alive || ship.boarding) return 'Not now';
    if (ship.inCombat(this.now)) return 'The harbour chain stays up while you are in a fight';
    const port = this.nearestPort(ship.state.x, ship.state.y);
    if (!port || dist(port.x, port.y, ship.state.x, ship.state.y) > PORT_DOCK_RADIUS) return 'No harbour close enough';
    if (ship.state.speed > 7) return 'Take in sail before entering harbour';
    const ok = canDock(p, port.faction);
    const override = ok.ok ? null : dockOverride(ship, p, port, bribing);
    if (!ok.ok && !override) return ok.reason!;
    const lawful = FACTIONS[port.faction].lawful;
    // A bribe instead of a search (and, with Greased Palms, instead of the harbour master's refusal).
    if (bribing && lawful && (contrabandValue(ship) > 0 || override === 'bribe')) {
      const cost = bribeCost(ship);
      if (p.gold < cost) return `The customs officer wants ${cost} silver`;
      p.gold -= cost;
      this.db.ledger(s.accountId, 'bribe', -cost, port.id);
      this.toastShip(ship, `${cost} silver changes hands. The customs officer admires the sky.`, 'info');
    } else if (lawful) {
      const carried = Object.keys(ship.cargo).some((g) => GOODS[g as GoodId].contraband && (ship.cargo[g as GoodId] ?? 0) > 0);
      const seized = customsSearch(this, s, port);
      if (carried && !seized.length) questEvent(this, s, { k: 'customs' });
      if (seized.length) this.toastShip(ship, `Customs seized ${seized.join(', ')}.`, 'bad');
      // A deep pastor aboard offends Crown customs.
      if (port.faction === 'crown' && ship.hasFlag('deep_pastor')) {
        changeRep(s.profile!, 'crown', -10);
        this.toastShip(ship, 'The Crown inspector sees your deep pastor and makes a note of it (−10 Crown standing).', 'bad');
      }
    }
    if (override === 'broker') {
      p.smuggle.brokerPassUsed = true;
      this.toastShip(ship, "The Brokers' forged licence passes. Once.", 'info');
    }
    this.dockShip(s, port);
    return null;
  }

  private dockShip(s: PlayerSession, port: Port): void {
    const ship = s.ship!;
    const p = s.profile!;
    onDockDeeds(this, s);
    syncKeel(this, s);
    ship.voyageStart = 0;
    p.explore.hoardAboard = false;
    sellPrizes(this, s, port);
    onDockCrew(this, s, port);
    anchorFleet(this, s);
    repairFleet(this, s);
    lashInPort(this, s);
    onArrival(this, p, port);
    this.tavernWhispers(s);
    onDockEvents(this, s, port);
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
    questEvent(this, s, { k: 'dock', port });
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
    if (ship.docked) s.profile!.trade.lastDeparture = ship.docked;
    ship.docked = null;
    ship.voyageStart = this.now;
    delete ship.talentReady.wear;
    springAmbush(this, s);
    // Fair Share: a paid crew sails cheerful.
    ship.morale = Math.min(100, ship.morale + 5 * ship.rank('cmd_fair_share'));
    s.profile!.docked = null;
    const v = headingVec(away);
    ship.state = { x: port.x + v.x * 60, y: port.y + v.y * 60, heading: away, speed: 3, sail: 0.5, rudder: 0 };
    ship.input = { rudder: 0, sailTarget: 0.5 };
    ship.protectedUntil = this.now + 20;
    bubbleOnUndock(this, s);
    onUndockEvents(this, s, port);
    this.grid.upsert(ship.id, ship.state.x, ship.state.y);
    launchFleet(this, s);
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
    const state = toPrivateState(s, this.now, this.worldView(s));
    const prev = this.lastSelf.get(s);
    const fields = new Map<string, string>();
    for (const [k, v] of Object.entries(state)) fields.set(k, JSON.stringify(v) ?? 'null');
    this.lastSelf.set(s, fields);
    if (!prev) return this.sendTo(s, { t: 'self', self: state });
    // Only the fields that changed (a forced push always goes out, to let the screens refresh).
    const patch: Partial<PrivateState> = {};
    let n = 0;
    for (const [k, j] of fields) if (prev.get(k) !== j) {
      (patch as Record<string, unknown>)[k] = (state as unknown as Record<string, unknown>)[k];
      n++;
    }
    if (n || force) this.sendTo(s, { t: 'self_patch', patch });
  }

  // ================================================================= snapshots (interest management)

  /** A ship's snapshot row and its delta key, as every viewer sees it (the hostile bit is added per viewer). */
  private snapRow(o: ShipEntity, frame: { rows: Map<number, { row: ShipRow; key: string }>; tethered: Set<number> }): { row: ShipRow; key: string } {
    let r = frame.rows.get(o.id);
    if (r) return r;
    const row: ShipRow = [
      o.id, Math.round(o.state.x * 10) / 10, Math.round(o.state.y * 10) / 10, Math.round(o.state.heading * 1000) / 1000,
      Math.round(o.state.speed * 10) / 10, Math.round(o.state.sail * 100) / 100,
      Math.round((o.hull / o.stats.hullMax) * 1000) / 1000, Math.round((o.sails / o.stats.sailHpMax) * 100) / 100,
      o.flagsFor(null, false, this.now) | (frame.tethered.has(o.id) ? SF.TETHERED : 0) | (o.isPlayer ? pvpFlags(this, o) : 0), Math.round((o.crew / Math.max(1, o.stats.crewMax)) * 100) / 100,
    ];
    r = { row, key: `${row[1]},${row[2]},${row[3]},${row[4]},${row[5]},${row[6]},${row[7]},${row[8]},${row[9]}` };
    frame.rows.set(o.id, r);
    return r;
  }

  private sendSnapshots(): void {
    // Events are serialised once as they are flushed and kept for one snapshot period, so each captain gets
    // every event exactly once whichever tick serves them. Far off, a volley keeps only three (cosmetic) balls.
    const fresh = this.events;
    this.events = [];
    this.recentEvents.push({
      tick: this.tick,
      list: fresh.map((e) => {
        const json = JSON.stringify(e.ev);
        const far = e.ev.k === 'volley' && e.ev.balls.length > 3 ? JSON.stringify({ ...e.ev, balls: [0, Math.floor(e.ev.balls.length / 2), e.ev.balls.length - 1].map((j) => (e.ev as { balls: unknown[] }).balls[j]) }) : json;
        return { x: e.x, y: e.y, json, far };
      }),
    });
    while (this.recentEvents.length && this.recentEvents[0].tick <= this.tick - SNAP_CROWD_EVERY) this.recentEvents.shift();
    // Rows are built once per ship per snapshot, not once per viewer.
    const tethered = new Set<number>();
    for (const o of this.ships.values()) if (o.tether) {
      tethered.add(o.id);
      tethered.add(o.tether.target);
    }
    const frame = { rows: new Map<number, { row: ShipRow; key: string }>(), tethered };
    const vis = new Map<number, { r: number; fog: boolean }>();
    const visible = (o: ShipEntity, fogSense: boolean) => {
      let v = vis.get(o.id);
      if (v === undefined) vis.set(o.id, (v = visibleRangeBase(this, o)));
      return Math.max(250, fogSense && v.fog ? v.r * 1.5 : v.r);
    };
    for (const s of this.sessions) {
      if (!s.authed || !s.ship || s.disconnectedAt !== null) continue;
      if ((s.accountId + this.tick) % s.snapEvery !== 0) continue;
      const me = s.ship;
      s.conn.cork?.();
      const cx = me.state.x, cy = me.state.y;
      const crowsNest = me.hasEffect('crows_nest'), fogSense = me.hasFlag('fog_sense');
      const ships: ShipRow[] = [];
      const snapNo = s.snapCount++;
      const infos: EntityInfo[] = [];
      const seen = new Set<number>();
      // Candidates in range, nearest first: rank as well as distance sets how often each is sent.
      const cand: { o: ShipEntity; d: number }[] = [];
      this.grid.query(cx, cy, INTEREST_RADIUS, (id) => {
        const o = this.ships.get(id);
        if (!o) return;
        const d = dist(o.state.x, o.state.y, cx, cy);
        if (d > INTEREST_RADIUS) return;
        if (o.id !== me.id) {
          if (o.docked) return;
          const lookout = crowsNest && d <= me.stats.detection; // Crow's Nest sees through it all
          if (!lookout && d > 250 && o.hasFlag('hidden') && o.ownerId !== me.id && !sameGroup(this, o, me)) return;
          // Seen from afar only by her signature (the fog-sense of the observer stretches it in fog).
          if (!lookout && o.isPlayer && d > 250 && d > visible(o, fogSense) && !sameGroup(this, o, me)) return;
        }
        const brain = this.npcs.get(o.id);
        if (brain && !brain.active) return;
        seen.add(o.id);
        if (!s.knownEntities.has(o.id)) {
          s.knownEntities.add(o.id);
          infos.push(o.info());
        }
        if (o.id !== me.id) cand.push({ o, d });
      });
      // In a crowd: the distance of the 40th and 100th nearest (selection, not a full sort).
      // A captain in a crowd gets 5 Hz instead of 10: the client draws further in the past to keep it smooth.
      s.snapEvery = cand.length > SNAP_CROWD ? SNAP_CROWD_EVERY : SNAPSHOT_EVERY_TICKS;
      const nearCut = cand.length > SNAP_RANK_NEAR ? kthSmallest(cand.map((c) => c.d), SNAP_RANK_NEAR) : Infinity;
      const midCut = cand.length > SNAP_RANK_MID ? kthSmallest(cand.map((c) => c.d), SNAP_RANK_MID) : Infinity;
      for (const { o, d } of cand) {
        const base = this.snapRow(o, frame);
        const hostile = this.isHostile(o, me);
        // Distance priority: close ships every snapshot, the middle distance every second, the far every fourth —
        // and in a crowd only the nearest few dozen at full rate.
        const byDist = d < SNAP_NEAR ? 1 : d < SNAP_MID ? 2 : 4;
        const byRank = d < nearCut ? 1 : d < midCut ? 2 : 4;
        const period = Math.max(byDist, byRank);
        const last = s.sentRows.get(o.id);
        if (last && snapNo % period !== 0) continue;
        // Delta: an unchanged row is not sent again (but refreshed every 2 s to keep interpolation fed).
        const key = hostile ? base.key + 'h' : base.key;
        if (last && last.key === key && this.now - last.t < 2) continue;
        s.sentRows.set(o.id, { key, t: this.now });
        const row = base.row.slice() as ShipRow;
        if (hostile) row[8] = row[8] | SF.HOSTILE;
        ships.push(row);
      }
      const loot: LootRow[] = [];
      for (const l of this.loot.values()) {
        if (dist(l.x, l.y, cx, cy) > INTEREST_RADIUS) continue;
        if (l.ownerOnly !== undefined && l.ownerOnly !== s.accountId) continue;
        seen.add(l.id);
        if (!s.knownEntities.has(l.id)) {
          s.knownEntities.add(l.id);
          infos.push({ id: l.id, kind: 'loot', value: cargoValue(l.cargo) + l.gold });
        }
        // Loot does not move: sent when first seen, refreshed every 5 s.
        const lk = `${Math.round(l.x)},${Math.round(l.y)}`;
        const ll = s.sentRows.get(l.id);
        if (ll && ll.key === lk && this.now - ll.t < 5) continue;
        s.sentRows.set(l.id, { key: lk, t: this.now });
        loot.push([l.id, Math.round(l.x), Math.round(l.y)]);
      }
      const gone: number[] = [];
      for (const id of s.knownEntities) if (!seen.has(id)) gone.push(id);
      for (const id of gone) {
        s.knownEntities.delete(id);
        s.sentRows.delete(id);
      }
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
        ammoSel: me.ammoSel, ammo: me.ammo as AmmoStock, flags: me.flagsFor(me.id, false, this.now) | (frame.tethered.has(me.id) ? SF.TETHERED : 0) | pvpFlags(this, me), combat: me.inCombat(this.now),
        water: Math.min(1, me.water / floodCapacity(me)), leaks: me.leaks, station: me.station,
        resolve: me.resolve, dread: me.dread, sanity: me.sanity,
      };
      this.sendSnap(s, {
        t: 'snap', tick: this.tick, time: Math.round(this.now * 100) / 100, ack: me.lastInputSeq, you, ships, loot,
        wind: [Math.round(wind.dir * 1000) / 1000, Math.round(wind.strength * 100) / 100], weather, region: me.region, fog: Math.round(WEATHER_FOG[weather] * (0.5 + 0.5 * this.sightFactor(me)) * 100) / 100,
      });
      const mine: string[] = [];
      for (const r of this.recentEvents) {
        if (r.tick <= s.lastEvTick) continue;
        for (const e of r.list) {
          const d = dist(e.x, e.y, cx, cy);
          if (d < INTEREST_RADIUS + 400) mine.push(d < SNAP_MID ? e.json : e.far);
        }
      }
      s.lastEvTick = this.tick;
      if (mine.length) this.sendText(s, `{"t":"ev","list":[${mine.join(',')}]}`);
      s.conn.uncork?.();
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
      p.sanity = Math.round(ship.sanity * 10) / 10;
      p.pressure = Math.round(ship.pressure * 10) / 10;
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
      const markets = serializeMarkets(this.markets);
      const sites = Object.fromEntries(this.sites.map((x) => [x.id, { stock: x.stock, holder: x.holder, holderName: x.holderName, until: x.until }]));
      if (!this.zone) {
        this.db.setKv('world', { time: this.now, markets });
        this.db.setKv('orders', this.orders);
        this.db.setKv('econ', { history: this.econHistory, rewardMul: this.econRewardMul });
        this.db.setKv('sites', sites);
        return;
      }
      // A zone writes only its own ports and sites into the shared records, keeping the other zones' entries.
      const mine = new Set(this.zonePorts().map((p) => p.id));
      const ownSite = (id: string) => this.zone!.regions.has(this.world.islands[Number(id.split(':')[0])]?.region);
      const world = this.db.getKv<{ time: number; markets: Record<string, unknown> }>('world') ?? { time: 0, markets: {} };
      for (const [id, m] of Object.entries(markets)) if (mine.has(id)) world.markets[id] = m;
      this.db.setKv('world', { time: Math.max(world.time, this.now), markets: world.markets });
      const orders = (this.db.getKv<BuyOrder[]>('orders') ?? []).filter((o) => !mine.has(o.portId));
      this.db.setKv('orders', [...orders, ...this.orders.filter((o) => mine.has(o.portId))]);
      const storedSites = this.db.getKv<Record<string, unknown>>('sites') ?? {};
      for (const [id, v] of Object.entries(sites)) if (ownSite(id)) storedSites[id] = v;
      this.db.setKv('sites', storedSites);
      if (this.zoneLead) this.db.setKv('econ', { history: this.econHistory, rewardMul: this.econRewardMul });
    });
  }

  // ================================================================= diagnostics

  stats(): Record<string, number> {
    let active = 0;
    for (const b of this.npcs.values()) if (b.active) active++;
    return { players: this.sessions.size, ships: this.ships.size, npcs: this.npcs.size, activeNpcs: active, projectiles: this.projectiles.length, loot: this.loot.size, time: Math.round(this.now), ...this.metrics.summary() };
  }
}

function reloadEstimate(ship: ShipEntity, side: 'port' | 'starboard'): number {
  return Math.max(ship.reload[side], ship.lastReloadTotal[side]);
}

/** The k-th smallest value (0-based: k = 40 gives the 41st), by quickselect. */
export function kthSmallest(a: number[], k: number): number {
  let lo = 0, hi = a.length - 1;
  while (lo < hi) {
    const pivot = a[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) {
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
        i++;
        j--;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else return a[k];
  }
  return a[k];
}
