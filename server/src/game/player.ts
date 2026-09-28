// Player session and persistent captain profile, plus progression, reputation and wanted rules.

import type { Look } from '../../../shared/src/data/looks.ts';
import { STARTING_UNLOCKS, encodeLook } from '../../../shared/src/data/looks.ts';
import type { CompanionRec } from './companion.ts';
import type { PetId } from '../../../shared/src/data/companions.ts';
import type { NemesisRec } from './nemesis.ts';
import type { TattooProfile } from './tattoos.ts';
import type { PiracyProfile } from './raiding.ts';
import type { HunterProfile } from './wanted.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { fishingView, sanitizeFishing } from './fishing.ts';
import type { FishingProfile } from './fishing.ts';
import type { CaptainSlot, Item } from '../../../shared/src/data/items.ts';
import { sanitizeGear } from './gear.ts';
import type { RefitOrder } from './refit.ts';
import { newTutorial, sanitizeTutorial } from './onboarding.ts';
import type { Tutorial } from './onboarding.ts';
import type { SeasonStat } from '../../../shared/src/data/seasons.ts';
import { newPvp } from './pvp.ts';
import type { PvpState } from './pvp.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import { questPayOf } from '../../../shared/src/data/questpay.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { FACTIONS, FACTION_IDS, factionRelation, wantedLevel } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { AMMO_IDS, emptyAmmo } from '../../../shared/src/data/ships.ts';
import type { AmmoId } from '../../../shared/src/data/ships.ts';
import type { TalentRanks } from '../../../shared/src/data/talents.ts';
import { totalPointsSpent } from '../../../shared/src/data/talents.ts';
import { MAX_LEVEL, talentPointsForLevel, xpForLevel } from '../../../shared/src/constants.ts';
import { MAX_COUNTED_DEEDS } from '../../../shared/src/data/deeds.ts';
import type { BoardingResult, Contract, PrivateState, ResourceSiteView } from '../../../shared/src/protocol.ts';
import type { AmmoStock, Cargo, ShipLoadout } from '../../../shared/src/sim/shipstats.ts';
import type { GameConn } from '../net/conn.ts';
import type { ShipEntity } from './ship.ts';
import type { Forward, Loan, Policy } from './finance.ts';
import { captiveRansom } from './prizes.ts';
import type { Captive } from './prizes.ts';
import type { TradeOption } from './tradefx.ts';
import type { TreasureMap } from './explorefx.ts';
import { MUTINY_TIMEOUT, officerBerths, wageMul, expectedShare, loyaltyOf, mutinyPayCost, newCompany, officerFactor, sanitizeCompany, unrestWord, wagesPerHour } from './crew.ts';
import type { Company } from './crew.ts';
import { escortUpkeep, newFleet } from './fleet.ts';
import type { Fleet } from './fleet.ts';
import { newQuestLog, sanitizeQuests, shipLevelOfQuest, stepProgress } from './quests.ts';
import { dailyView, newDaily, sanitizeDaily } from './dailies.ts';
import type { DailyState } from '../../../shared/src/data/dailies.ts';
import { sanitizeShipbuilding } from './shipbuilding.ts';
import type { Berth, BuildOrder } from './shipbuilding.ts';
import type { FigureheadId, Plan } from '../../../shared/src/data/shipbuild.ts';
import type { Oath, QuestLog } from './quests.ts';
import { clampLevel, initialLevel } from '../../../shared/src/data/shiplevel.ts';
import { CLEAN_SLATE_CD, FREE_RESPEC_LEVEL, cleanSlateCost, loadoutSlots } from './progression.ts';

export interface Profile {
  version: 1;
  captain: CaptainId;
  pvp: PvpState;
  shipName: string;
  level: number;
  xp: number;
  talents: TalentRanks;
  gold: number;
  infamy: number;
  reputation: Partial<Record<FactionId, number>>;
  loadout: ShipLoadout;
  cargo: Cargo;
  ammo: AmmoStock;
  ammoSel: AmmoId;
  crew: number;
  morale: number;
  sanity: number;
  company: Company;
  fleet: Fleet;
  quests: QuestLog;
  /** Today's three orders and the days in a row (docs/11 P6). */
  daily: DailyState;
  /** The list of friends (docs/11 P6): account and name as last seen. */
  friends?: { id: number; name: string }[];
  /** Captains one does not hear (chat, whispers, invitations). */
  ignored?: { id: number; name: string }[];
  /** Rest ashore (docs/11 P6): the pool of doubled battle experience, and when and where the captain went ashore. */
  rested?: number;
  ashoreAt?: number;
  ashoreInPort?: boolean;
  paths: CaptainId[]; // Paths this captain may take up at a Captain's House
  pathSwitchAt: number;
  oath: Oath | null; // the Code or a letter of marque
  builds: BuildOrder[];
  plans: Plan[];
  berths: Berth[];
  figureheads: FigureheadId[]; // carved figureheads found, not yet fitted
  exotic: Partial<Record<GoodId, number>>; // units bought in lawless waters (Exotic Goods)
  salvageDay: number; // Salvage King: the game day of the last raising
  crewAmbush: number; // an officer sold your route: hunters wait on the next voyage
  hull: number;
  sails: number;
  rudderHp: number;
  gunsDisabled: { port: number; starboard: number };
  lastPort: string;
  docked: string | null;
  contracts: Contract[];
  discovered: number[];
  regionsSeen: string[];
  stats: { sunk: number; boarded: number; tradeProfit: number; distance: number; sold: number; fogContraband: number; harpoonContracts: number; /** captains guided through quests (docs/11 P6) */ mentored?: number };
  cooldowns: Record<string, number>;
  insured: boolean;
  priceIntel: Record<string, { t: number; sell: Partial<Record<GoodId, number>> }>;
  costBasis: Partial<Record<GoodId, number>>;
  sightings: { name: string; kind: string; x: number; y: number; t: number }[];
  chartSales: Record<string, number[]>; // port id -> island ids whose charts that port already bought
  chartsBought: number[]; // bought or heard-of islands: not resellable
  explored: Record<string, number>; // 'islandId:feature' -> world time last worked
  curse: number;
  stolen: Partial<Record<GoodId, number>>;
  licences: Partial<Record<FactionId, number>>;
  warehouses: Record<string, Cargo>;
  forwards: Forward[];
  bank: number;
  loan: Loan | null;
  policy: Policy | null;
  claims: number[]; // world times of insurance claims
  deeds: string[];
  deedState: { region: string; crossing: string; blackStorm: number; wantedTime: number; voyagePorts: string[] };
  tokens: number; // Clean Logbook tokens
  tokenLevels: number[];
  cleanSlates: number[]; // world times of paid full respecs
  loadouts: TalentRanks[];
  activeLoadout: number;
  loadoutSwitchAt: number;
  talentCooldowns: Record<string, number>;
  captives: Captive[];
  blueprints: string[]; // plans for fittings no yard sells
  /** World bosses (bosses.ts): trophies taken, kills, and the weekly rare-drop lockout (wall-clock ms). */
  trophies: string[];
  /** The Abyss (abyss.ts): depth pressure, ritual shards, the chapters of the story. */
  pressure: number;
  ritualShards: number;
  chapters: string[];
  /** Seasons (seasons.ts): this season's path and tables; titles and pennants earned; the Pantheon. */
  season: { id: number; xp: number; level: number; stats: Partial<Record<SeasonStat, number>> };
  titles: string[];
  title: string | null;
  pennants: string[];
  pennant: string | null;
  nameRights: number;
  pantheon: string[];
  /** The First Watch and the Captain's Goals (onboarding.ts). */
  tutorial: Tutorial;
  bossKills: Record<string, number>;
  bossLocks: Record<string, number>;
  explore: {
    maps: TreasureMap[];
    fragments: number;
    dived: Record<number, number>; // sunken wreck id -> world time dived
    rumorDay: number;
    tavernDeals: string[];
    hoardAboard: boolean; // Gold Fever: a trail follows you
  };
  keel: { classId: string; since: number } | null; // Legendary Keel
  /** A yard at work raising her a level (canon D12, refit.ts). */
  refit?: RefitOrder | null;
  /** The captain's locker, own gear and the next item's number (docs/12 P1, gear.ts). */
  stash: Item[];
  captainGear: Partial<Record<CaptainSlot, Item>>;
  itemSeq: number;
  /** The sea director's keepsakes (docs/12 P2): letters from bottles, souls rescued, a ship's cat. */
  seaLetters?: number[];
  rescued?: number;
  shipCat?: boolean;
  /** Fishing (docs/12 P3, fishing.ts). */
  fishing?: FishingProfile;
  /** The beasts taken, by kind (docs/12 P4). */
  beasts?: Partial<Record<BeastId, number>>;
  /** The Hunters' Guild (docs/12 P5). */
  hunter?: HunterProfile;
  /** The Brethren of the Coast (docs/12 P6). */
  piracy?: PiracyProfile;
  /** One's own island (docs/12 P7): when home was last sailed for; souls waiting aboard to settle there. */
  homeAt?: number;
  refugees?: number;
  /** The White Orca's calf in her wake (docs/12 P10 #2) and the ship's pets (#3). */
  companion?: CompanionRec | null;
  pets?: { owned: PetId[]; deck: PetId | null };
  /** The named pirates who hold a grudge against her, and the heads of those she settled with (docs/12 P10 #1). */
  nemeses?: Record<string, NemesisRec>;
  nemesisHeads?: number;
  /** Hearts of the storm caught and not yet forged or built into a keel (docs/12 P10 #14). */
  stormHearts?: number;
  /** A cartographer's fame: her buried chests dug up by others (docs/12 P10 #7). */
  cartoFame?: number;
  /** The wonders of the sea she has found (docs/12 P10 #8). */
  wonders?: string[];
  /** Her ship's look and the parts of it she has opened (docs/12 P10 #12). */
  look?: Look;
  unlocks?: string[];
  /** The Flying Dutchman's pages she has this week (docs/12 P10 #10). */
  dutchman?: { week: number; pages: number[] };
  /** Tattoos (docs/12 P9); a choice of three rewards waiting. */
  tattoos?: TattooProfile;
  choice?: { quest: string; items: Item[] } | null;
  trade: {
    lastDeparture: string;
    arrivalRoute: string;
    routes: Record<string, { n: number; t: number }>;
    monoLog: { port: string; good: GoodId; qty: number; t: number }[];
    monopoly: Record<string, number>;
    monoBonus: GoodId[];
    voyageProfit: number;
    voyageShare: number;
    options: TradeOption[];
    caravanReadyAt: number;
    rumorsHeard: number[];
  };
  smuggle: {
    stamped: Partial<Record<GoodId, number>>; // contraband with the Brokers' stamp (Forged Papers 2)
    coves: number[]; // hidden coves found
    brokerPassUsed: boolean;
    hotRun: Contract | null;
  };
  createdAt: number;
}

/** Best known sell price per good across remembered markets. */
export function appraise(p: Profile): Partial<Record<GoodId, { price: number; port: string }>> {
  const out: Partial<Record<GoodId, { price: number; port: string }>> = {};
  for (const portId in p.priceIntel) {
    const sell = p.priceIntel[portId].sell;
    for (const g in sell) {
      const v = sell[g as GoodId] ?? 0;
      if (v > (out[g as GoodId]?.price ?? 0)) out[g as GoodId] = { price: v, port: portId };
    }
  }
  return out;
}

export function newTradeState(): Profile['trade'] {
  return { lastDeparture: '', arrivalRoute: '', routes: {}, monoLog: [], monopoly: {}, monoBonus: [], voyageProfit: 0, voyageShare: 0, options: [], caravanReadyAt: 0, rumorsHeard: [] };
}

export function newProfile(captain: CaptainId, shipName: string, startPort: string, now: number): Profile {
  const c = CAPTAINS[captain];
  const loadout: ShipLoadout = { classId: c.start.ship, name: shipName, guns: { port: c.start.gun, starboard: c.start.gun }, modules: {} };
  const reputation: Partial<Record<FactionId, number>> = {};
  for (const f of FACTION_IDS) reputation[f] = 0;
  if (captain === 'drowned') reputation.crown = -15;
  if (captain === 'admiral') reputation.crown = -25;
  return {
    version: 1, captain, pvp: newPvp(), shipName, level: 1, xp: 0, talents: {}, gold: c.start.gold, infamy: 0, reputation, loadout,
    cargo: { ...c.start.cargo }, ammo: { ...emptyAmmo(), round: 60, chain: 20, grape: 20 }, ammoSel: 'round', crew: c.start.crew, morale: 80, sanity: 100, company: newCompany(captain, c.start.crew), crewAmbush: 0, fleet: newFleet(), exotic: {}, salvageDay: -1, builds: [], plans: [], berths: [], figureheads: [], stash: [], captainGear: {}, itemSeq: 1, fishing: { skill: 1, xp: 0, caught: {}, traps: [] }, hunter: { points: 0, captains: 0, seas: {} }, piracy: { fame: 0, honour: 0, tributes: 0, convoys: 0 }, quests: newQuestLog(), daily: newDaily(), paths: [captain], pathSwitchAt: -1e9, oath: null,
    hull: -1, sails: -1, rudderHp: 1, gunsDisabled: { port: 0, starboard: 0 }, lastPort: startPort, docked: startPort,
    contracts: [], discovered: [], regionsSeen: [], stats: { sunk: 0, boarded: 0, tradeProfit: 0, distance: 0, sold: 0, fogContraband: 0, harpoonContracts: 0 }, cooldowns: {},
    insured: false, priceIntel: {}, costBasis: {}, sightings: [], chartSales: {}, chartsBought: [], explored: {}, stolen: {}, licences: {}, warehouses: {}, forwards: [], bank: 0, loan: null, policy: null, claims: [], deeds: [], deedState: { region: '', crossing: '', blackStorm: 0, wantedTime: 0, voyagePorts: [] }, tokens: 0, tokenLevels: [], cleanSlates: [], loadouts: [{}], activeLoadout: 0, loadoutSwitchAt: 0, talentCooldowns: {}, captives: [], blueprints: [], trophies: [], bossKills: {}, bossLocks: {}, pressure: 0, ritualShards: 0, chapters: [], season: { id: -1, xp: 0, level: 0, stats: {} }, titles: [], title: null, pennants: [], pennant: null, nameRights: 0, pantheon: [], tutorial: newTutorial(false, 0), explore: { maps: [], fragments: 0, dived: {}, rumorDay: -1, tavernDeals: [], hoardAboard: false }, keel: null, trade: newTradeState(), smuggle: { stamped: {}, coves: [], brokerPassUsed: false, hotRun: null }, curse: captain === 'drowned' ? 30 : 0, createdAt: now,
  };
}

export class PlayerSession {
  readonly conn: GameConn;
  accountId = 0;
  name = '';
  token = '';
  profile: Profile | null = null;
  chartedCache = { region: '', size: -1, full: false };
  ship: ShipEntity | null = null;
  knownEntities = new Set<number>();
  /** Delta snapshots: what this client last received for each entity, and when. */
  sentRows = new Map<number, { key: string; t: number }>();
  snapCount = 0;
  /** Ticks between this captain's snapshots: 2 (10 Hz), or 4 in a crowd; and the last tick of events sent. */
  snapEvery = 2;
  lastEvTick = 0;
  knownChunks = new Set<number>();
  discovered = new Set<number>();
  msgWindowStart = 0;
  msgCount = 0;
  pendingBoarding: { result: BoardingResult; targetId: number } | null = null;
  /** A job offered and not yet answered, open for a while (docs/11 P6): by an island's people on the beach, or
   *  shared by a groupmate. */
  questOffer: { id: string; until: number; island?: number; from?: string } | null = null;
  lastPortPush = 0;
  lastSave = 0;
  disconnectedAt: number | null = null;
  lingerUntil = 0;
  lastRegion = '';
  landable: { island: string; feature: string; action?: 'dig' | 'dive' | 'expedition' | 'raise'; blocked?: string } | null = null;
  siteViews: ResourceSiteView[] = [];

  constructor(conn: GameConn) {
    this.conn = conn;
  }

  get authed(): boolean {
    return this.accountId > 0;
  }
}

// ------------------------------------------------------------------ progression

export function talentPointsAvailable(p: Profile): number {
  return talentPointsForLevel(p.level) + Math.min(p.deeds.length, MAX_COUNTED_DEEDS) - totalPointsSpent(p.talents);
}

/** Adds XP, handles level-ups. Returns number of levels gained. */
export function addXp(p: Profile, amount: number): number {
  if (p.level >= MAX_LEVEL) return 0;
  p.xp += Math.max(0, Math.round(amount));
  let gained = 0;
  while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    gained++;
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
  return gained;
}

// ------------------------------------------------------------------ reputation & law

export function changeRep(p: Profile, faction: FactionId, delta: number): void {
  const nobody = (p.talents.smg_nobodys_ship ?? 0) > 0; // Nobody's Ship: standing grows at half speed
  const ledger = (p.talents.smg_black_ledger ?? 0) > 0; // Black Ledger: the League never trusts you
  // Direct change plus a smaller spillover to the faction's friends and enemies.
  for (const f of FACTION_IDS) {
    const rel = factionRelation(faction, f) / 100;
    let d = f === faction ? delta : delta * rel * 0.3;
    if (d > 0 && nobody) d *= 0.5;
    if (Math.abs(d) < 0.05) continue;
    const cur = p.reputation[f] ?? 0;
    let next = cur + d;
    if (d > 0 && ledger && f === 'league') next = Math.min(next, Math.max(cur, 0)); // never above neutral
    p.reputation[f] = Math.max(-100, Math.min(100, next));
  }
}

export function canDock(p: Profile, faction: FactionId): { ok: boolean; reason?: string } {
  const w = wantedLevel(p.infamy);
  const def = FACTIONS[faction];
  if (faction === 'crown' && (p.talents.smg_nobodys_ship ?? 0) > 0) return { ok: false, reason: 'The Crown does not moor a ship with no name and no flag.' };
  if (w > def.dockMaxWanted) return { ok: false, reason: `${def.short} harbour masters refuse ships at Wanted ${w}.` };
  if ((p.reputation[faction] ?? 0) <= -50) return { ok: false, reason: `The ${def.name} considers you an enemy.` };
  return { ok: true };
}

export function pardonCost(p: Profile): number {
  return Math.round(p.infamy * 18 + p.level * 40);
}

export interface WorldView {
  coves: { id: number; name: string; x: number; y: number }[];
  patrols: [number, number][];
  fleet?: PrivateState['fleet'];
  inspect?: PrivateState['inspect'];
  monsters?: PrivateState['monsters'];
  explore?: Pick<PrivateState, 'maps' | 'legendEcho' | 'wrecks' | 'trails' | 'soundings' | 'forecast' | 'goldTrails'>;
  abyss?: PrivateState['abyss'];
  pvp?: PrivateState['pvp'];
  /** Where each active quest's current step points (a port, an island, a region's middle). */
  questTargets?: Record<string, { x: number; y: number; r?: number; region?: RegionId }>;
  /** The sea's common cause today and this captain's part in it (docs/11 P6). */
  common?: PrivateState['common'];
  /** Groupmates on the same quests: quest id → their names and steps (docs/11 P6). */
  questMates?: Record<string, { name: string; step: number }[]>;
}

export function toPrivateState(s: PlayerSession, now: number, world: WorldView = { coves: [], patrols: [] }): PrivateState {
  const p = s.profile!;
  const ship = s.ship;
  return {
    accountId: s.accountId,
    name: s.name,
    pvp: world.pvp ?? { blackFlag: p.pvp.blackFlag, pennant: false, pennantHoursLeft: 0, shameUntil: p.pvp.shameUntil, bubbleUntil: p.pvp.bubbleUntil, rating: p.pvp.rating, duels: p.pvp.duels, duelWins: p.pvp.duelWins, bounty: 0, hunter: false, sunkBy: [], challenges: [] },
    captain: p.captain,
    level: p.level,
    xp: p.xp,
    xpNext: xpForLevel(p.level),
    rested: Math.round(p.rested ?? 0),
    talentPoints: talentPointsAvailable(p),
    deeds: p.deeds,
    tokens: p.tokens,
    loadouts: { slots: loadoutSlots(p.level), active: p.activeLoadout, filled: Array.from({ length: loadoutSlots(p.level) }, (_, i) => i === p.activeLoadout || Object.keys(p.loadouts[i] ?? {}).length > 0), switchAt: p.loadoutSwitchAt },
    respec: {
      free: p.level < FREE_RESPEC_LEVEL,
      cleanSlateCost: cleanSlateCost(p, now),
      cleanSlateAt: p.cleanSlates.length ? p.cleanSlates[p.cleanSlates.length - 1] + CLEAN_SLATE_CD : 0,
      forgetCost: 50 * p.level,
    },
    talentCooldowns: p.talentCooldowns,
    heat: ship ? { port: Math.round(ship.heat.port), starboard: Math.round(ship.heat.starboard) } : { port: 0, starboard: 0 },
    rollingFire: ship?.rollingFire ?? false,
    dashReadyAt: ship?.dashReadyAt ?? 0,
    options: p.trade.options,
    coves: world.coves.filter((c) => p.smuggle.coves.includes(c.id) || ship?.hasFlag('cove_knowledge')).map((c) => ({ name: c.name, x: Math.round(c.x), y: Math.round(c.y) })),
    patrols: world.patrols,
    maps: world.explore?.maps ?? [],
    legendEcho: world.explore?.legendEcho ?? [],
    pennant: p.pennant,
    abyss: world.abyss ?? null,
    fragments: p.explore.fragments,
    wrecks: world.explore?.wrecks ?? [],
    trails: world.explore?.trails ?? [],
    soundings: world.explore?.soundings ?? [],
    forecast: world.explore?.forecast ?? null,
    goldTrails: world.explore?.goldTrails ?? [],
    company: companyView(p, ship, now),
    quests: p.quests.active.map((q) => {
      const def = QUESTS_BY_ID[q.id];
      const st = stepProgress(q);
      const target = world.questTargets?.[q.id];
      return {
        id: q.id, name: def.name, kind: def.kind, mentor: def.mentor, step: q.step + 1, steps: def.steps.length, text: st?.text ?? '', progress: st?.progress ?? 0, need: st?.need ?? 1, ...(target ? { target } : {}),
        // For the journal (docs/11 P6): the giver's words, every step, the pay and the face.
        summary: def.summary, stepTexts: def.steps.map((x) => x.text), silver: def.reward.silver, xp: def.reward.xp, ...(q.fastUntil && q.fastUntil > now ? { fastIn: Math.round(q.fastUntil - now) } : {}), ...(def.portrait ? { portrait: def.portrait } : {}), ...(def.category ? { category: def.category } : {}),
        ...(q.pay ? { pay: q.pay, paid: questPayOf(q.pay, def.reward.silver, def.requires.level ?? 1) } : {}),
        ...(world.questMates?.[q.id] ? { mates: world.questMates[q.id] } : {}),
        ...((lv) => (lv ? { ship: lv } : {}))(shipLevelOfQuest(def)),
      };
    }),
    questsDone: p.quests.done,
    questsRecent: p.quests.done.slice(-10).reverse().map((id) => QUESTS_BY_ID[id]?.name).filter((n): n is string => !!n),
    daily: dailyView(p),
    common: world.common ?? null,
    paths: p.paths,
    oath: p.oath,
    pathSwitchAt: p.pathSwitchAt,
    builds: p.builds.map((b) => ({ id: b.id, port: b.port, classId: b.classId, name: b.name, done: b.done, start: b.start, frame: b.build.frame, plank: b.build.plank, quality: b.build.quality })),
    plans: p.plans.map((x) => ({ id: x.id, classId: x.classId, quality: x.quality, variants: x.variants, uses: x.uses })),
    berths: p.berths.map((b) => ({ port: b.port, name: b.loadout.name, classId: b.loadout.classId, hull: Math.round(b.hull * 100) })),
    figureheads: p.figureheads,
    fleet: world.fleet ?? { escorts: [], slots: 0, formation: p.fleet.formation, upkeep: 0 },
    inspect: world.inspect ?? [],
    monsters: world.monsters ?? [],
    appraisal: ship?.hasFlag('appraiser') ? appraise(p) : null,
    captives: p.captives.map((c) => ({ name: c.name, faction: c.faction, ransom: captiveRansom(c, (ship?.rank('trd_prize_broker') ?? 0) > 0) })),
    talents: p.talents,
    gold: Math.floor(p.gold),
    infamy: Math.round(p.infamy),
    wanted: wantedLevel(p.infamy),
    reputation: Object.fromEntries(Object.entries(p.reputation).map(([k, v]) => [k, Math.round(v ?? 0)])),
    loadout: p.loadout,
    stash: p.stash,
    captainGear: p.captainGear,
    seaLetters: p.seaLetters ?? [],
    shipCat: !!p.shipCat,
    look: p.look ? encodeLook(p.look) : null,
    unlocks: p.unlocks ?? [...STARTING_UNLOCKS],
    cartoFame: p.cartoFame ?? 0,
    stormHearts: p.stormHearts ?? 0,
    fishing: fishingView(p),
    beasts: p.beasts ?? {},
    cargo: ship ? ship.cargo : p.cargo,
    ammo: ship ? ship.ammo : p.ammo,
    ammoSel: ship ? ship.ammoSel : p.ammoSel,
    crew: ship ? ship.crew : p.crew,
    morale: Math.round(ship ? ship.morale : p.morale),
    hull: Math.round(ship ? ship.hull : p.hull),
    sails: Math.round(ship ? ship.sails : p.sails),
    rudderHp: ship ? ship.rudderHp : p.rudderHp,
    gunsDisabled: ship ? { ...ship.gunsDisabled } : p.gunsDisabled,
    dockedAt: ship ? ship.docked : p.docked,
    lastPort: p.lastPort,
    contracts: p.contracts,
    cooldowns: p.cooldowns,
    repairing: ship?.repairing ?? false,
    curse: Math.round(ship ? ship.curse : p.curse),
    stolen: p.stolen,
    licences: p.licences,
    sites: s.siteViews,
    warehouses: p.warehouses,
    landable: s.landable,
    landing: ship?.landing ? { island: String(ship.landing.islandId), feature: ship.landing.feature, until: ship.landing.until, started: ship.landing.started } : null,
    discoveredCount: s.discovered.size,
    intel: Object.entries(p.priceIntel).map(([portId, rec]) => ({
      portId,
      t: rec.t,
      // Only Market Sense turns a remembered visit into usable price knowledge on the chart.
      top: ship?.hasFlag('market_sense')
        ? (Object.entries(rec.sell) as [GoodId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3)
        : [],
    })),
    sightings: p.sightings,
    stats: p.stats,
    protectedUntil: ship?.protectedUntil ?? 0,
    insured: p.insured,
    policy: p.policy?.tier ?? null,
    effects: ship ? ship.effects.filter((e) => e.mods || e.flags).map((e) => ({ id: e.id, until: e.until, mods: e.mods, flags: e.flags })) : [],
    forwards: p.forwards.map((f) => ({ ...f, fromName: f.fromPort, toName: f.toPort })),
    bank: p.bank,
    loan: p.loan,
  };
}

export function sanitizeProfile(raw: Profile): Profile {
  // Defensive load: fill fields added in later versions and clamp obviously broken values.
  const p = raw;
  p.talents ??= {};
  p.pvp = { ...newPvp(), ...(p.pvp ?? {}) };
  p.reputation ??= {};
  p.contracts ??= [];
  p.discovered ??= [];
  p.regionsSeen ??= [];
  p.cooldowns ??= {};
  p.priceIntel ??= {};
  p.costBasis ??= {};
  p.sightings ??= [];
  p.chartSales ??= {};
  p.chartsBought ??= [];
  p.explored ??= {};
  p.curse ??= 0;
  sanitizeCompany(p);
  p.fleet ??= newFleet();
  p.exotic ??= {};
  sanitizeQuests(p);
  sanitizeDaily(p);
  p.friends = (p.friends ?? []).filter((f) => f && typeof f.id === 'number' && typeof f.name === 'string').slice(0, 50);
  p.ignored = (p.ignored ?? []).filter((f) => f && typeof f.id === 'number' && typeof f.name === 'string').slice(0, 50);
  sanitizeShipbuilding(p);
  // Ship levels (canon D12): a ship from before them comes at her class's first level, one more if nearly all fitted.
  for (const l of [p.loadout, ...(p.berths ?? []).map((b) => b.loadout)]) if (l) l.level = l.level ? clampLevel(l.classId, l.level) : initialLevel(l.classId, l.modules ?? {});
  p.refit ??= null;
  sanitizeGear(p);
  sanitizeFishing(p);
  p.salvageDay ??= -1;
  p.fleet.escorts ??= [];
  p.fleet.formation ??= 'line';
  p.fleet.formationAt ??= 0;
  p.crewAmbush ??= 0;
  p.sanity = Math.max(0, Math.min(100, p.sanity ?? 100));
  p.stolen ??= {};
  p.licences ??= {};
  p.warehouses ??= {};
  p.forwards ??= [];
  p.bank = Math.max(0, p.bank ?? 0);
  p.loan ??= null;
  p.claims ??= [];
  // Pre-2.0 boolean policies become hull cover.
  p.policy ??= p.insured ? { tier: 'hull', declared: 0, premium: 0, deductible: 0 } : null;
  p.stats ??= { sunk: 0, boarded: 0, tradeProfit: 0, distance: 0, sold: 0, fogContraband: 0, harpoonContracts: 0 };
  p.stats.sold ??= 0;
  p.stats.fogContraband ??= 0;
  p.stats.harpoonContracts ??= 0;
  p.deeds ??= [];
  p.deedState ??= { region: '', crossing: '', blackStorm: 0, wantedTime: 0, voyagePorts: [] };
  p.tokens ??= 0;
  p.tokenLevels ??= [];
  p.cleanSlates ??= [];
  p.loadouts ??= [{}];
  p.activeLoadout ??= 0;
  p.loadoutSwitchAt ??= 0;
  p.talentCooldowns ??= {};
  p.captives ??= [];
  p.blueprints ??= [];
  p.trophies ??= [];
  p.pressure ??= 0;
  p.ritualShards ??= 0;
  p.chapters ??= [];
  p.season ??= { id: -1, xp: 0, level: 0, stats: {} };
  p.titles ??= [];
  p.title ??= null;
  p.pennants ??= [];
  p.pennant ??= null;
  p.nameRights ??= 0;
  p.pantheon ??= [];
  sanitizeTutorial(p);
  p.bossKills ??= {};
  p.bossLocks ??= {};
  p.explore = { maps: [], fragments: 0, dived: {}, rumorDay: -1, tavernDeals: [], hoardAboard: false, ...((p.explore as Partial<Profile['explore']> | undefined) ?? {}) };
  p.keel ??= null;
  p.trade = { ...newTradeState(), ...(p.trade ?? {}) };
  p.smuggle = { stamped: {}, coves: [], brokerPassUsed: false, hotRun: null, ...((p.smuggle as Partial<Profile['smuggle']> | undefined) ?? {}) };
  p.ammo = { ...emptyAmmo(), ...(p.ammo ?? {}) };
  for (const a of AMMO_IDS) p.ammo[a] = Math.max(0, Math.floor(p.ammo[a] ?? 0));
  p.gold = Math.max(0, p.gold ?? 0);
  p.gunsDisabled ??= { port: 0, starboard: 0 };
  return p;
}

function companyView(p: Profile, ship: ShipEntity | null, now: number): PrivateState['company'] {
  const c = p.company;
  return {
    pools: { ...c.pools },
    skill: Math.round(c.skill * 100) / 100,
    loyalty: Math.round(loyaltyOf(c, now)),
    share: c.share,
    expectedShare: expectedShare(c, now),
    officers: c.officers.map((o) => ({
      id: o.id, name: o.name, role: o.role, level: o.level, traits: o.traits, loyalty: Math.round(o.loyalty),
      wound: o.wound && o.wound.until > now ? (o.wound.heavy ? 'heavy' : 'light') : null, away: officerFactor(o, now) <= 0 && !o.wound,
      orderReady: o.orderReady, unique: o.unique, warned: o.warnedAt !== undefined,
      ...(o.fate ? { fate: { past: o.fate.past, request: o.fate.request ? { ...o.fate.request } : null, love: o.fate.love ? { port: o.fate.love.port, name: o.fate.love.name } : null } } : {}),
    })),
    slots: ship ? officerBerths(ship) : 1,
    traits: c.traits,
    unrest: unrestWord(c),
    wagesPerHour: Math.round((wagesPerHour(c) * wageMul(ship) + escortUpkeep(p, ship)) * 10) / 10,
    owed: Math.round(c.owed),
    memorial: c.memorial,
    mutiny: c.mutiny ? { ringleader: c.mutiny.ringleader, mutineers: c.mutiny.mutineers, payCost: mutinyPayCost(c), left: Math.max(0, Math.round(MUTINY_TIMEOUT - (now - c.mutiny.at))) } : null,
  };
}
