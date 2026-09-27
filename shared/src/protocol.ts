// Wire protocol (JSON over WebSocket, version-gated). The client only ever sends *intents*
// (inputs, requests). Every outcome — damage, gold, cargo, xp — is computed and pushed by the server.
// Snapshot entity rows are positional arrays to keep packets small; see docs/04_TECHNICAL_ARCHITECTURE.md
// for the planned binary encoding.

import type { OfficerRole, Profession, TraitId } from './data/crew.ts';
import type { FigureheadId, PlanQuality, RareSlot, VariantId, WoodId } from './data/shipbuild.ts';
import type { BuildingId, IslandSize } from './data/holdings.ts';
import type { CaptainId } from './data/captains.ts';
import type { BoardTactic } from './data/boarding.ts';
import type { FactionId } from './data/factions.ts';
import type { GoodId } from './data/goods.ts';
import type { AmmoId, ChaserEnd, GunId, ModuleId, MountId, ShipClassId } from './data/ships.ts';
import type { TalentRanks } from './data/talents.ts';
import type { Flag, StatMods } from './data/stats.ts';
import type { Cargo, AmmoStock, ShipLoadout } from './sim/shipstats.ts';
import type { IslandFeature } from './world/worldgen.ts';
import type { IslandBiome, RegionId } from './world/regions.ts';
import type { DailyKind } from './data/dailies.ts';
import type { CommonKind } from './data/commongoal.ts';
import type { GuildGoalKind } from './data/guildgoal.ts';

export type Side = 'port' | 'starboard';
export type Station = 'balanced' | 'gunnery' | 'sailing' | 'damage_control';
export const STATIONS: Station[] = ['balanced', 'gunnery', 'sailing', 'damage_control'];
export type Aggression = 'careful' | 'standard' | 'brutal';
export type WeatherKind = 'calm' | 'breeze' | 'wind' | 'fog' | 'rain' | 'storm' | 'black_storm';

// ------------------------------------------------------------------ client -> server

export type ClientMsg =
  | { t: 'hello'; v: number; token?: string; name?: string }
  | { t: 'create_captain'; captain: CaptainId; shipName: string; tutorial?: boolean } // tutorial: the First Watch (docs/07 §13)
  | { t: 'onboarding'; action: 'skip_stage' | 'skip_all' | 'hide_goals' }
  | { t: 'input'; seq: number; rudder: number; sail: number }
  | { t: 'fire'; side: Side; dist: number; x?: number; y?: number } // x, y: aim point (Improved Carriages)
  /** The broadside's order is being held (dynamic combat): the charge runs from now until the fire. */
  | { t: 'aim'; side: Side }
  /** A hard turn with every hand on the braces: speed, a sharp helm and a moment of evasion. */
  | { t: 'dash' }
  /** Cut away a fallen mast's wreckage (the helm back, the shield gone). */
  | { t: 'cut_mast' }
  | { t: 'chase'; end: ChaserEnd; x: number; y: number }
  | { t: 'mount'; x: number; y: number }
  | { t: 'ammo'; ammo: AmmoId }
  | { t: 'ability'; id: string; x?: number; y?: number }
  | { t: 'board'; target: number; aggression: Aggression }
  | { t: 'loot_take'; take: Cargo; fate: 'sink' | 'release' | 'ransom' | 'prize'; recruit?: number }
  | { t: 'board_cut' }
  /** Boarding 2.0: this round's tactic; the captains' duel (challenge, answer, a strike at server time `at`). */
  | { t: 'board_tactic'; tactic: BoardTactic }
  | { t: 'board_duel'; action: 'challenge' | 'accept' | 'decline' | 'strike'; at?: number }
  | { t: 'scuttle' }
  | { t: 'captive'; index: number; mode: 'ransom' | 'hand_over' }
  | { t: 'repair'; on: boolean }
  | { t: 'dock'; bribe?: boolean }
  | { t: 'jettison'; good: GoodId; qty: number }
  | { t: 'fence_sell'; good: GoodId; qty: number }
  | { t: 'treasure'; action: 'buy' | 'assemble' | 'merge'; tier?: number }
  | { t: 'undock' }
  | { t: 'trade'; good: GoodId; qty: number }
  | { t: 'buy_ammo'; ammo: AmmoId; qty: number }
  | { t: 'hire_crew'; qty: number; prof?: Profession; dregs?: boolean }
  | { t: 'officer'; action: 'hire' | 'dismiss' | 'order'; id: string }
  | { t: 'codex'; share: number }
  | { t: 'mutiny'; choice: 'pay' | 'suppress' | 'yield' | 'duel' }
  | { t: 'press_gang'; qty: number }
  | { t: 'escort'; action: 'hire' | 'dismiss'; classId?: ShipClassId; id?: string }
  | { t: 'formation'; formation: 'line' | 'wedge' | 'ring' }
  | { t: 'quest'; action: 'accept' | 'abandon' | 'decline' | 'share'; id: string }
  | { t: 'path'; to: CaptainId }
  | { t: 'oath'; oath: 'code' | 'marque' }
  | { t: 'build'; req: { classId: ShipClassId; name: string; frame: WoodId; plank: WoodId; rares: Partial<Record<RareSlot, GoodId>>; figurehead?: FigureheadId; planId?: string; master?: boolean } }
  | { t: 'build_launch'; id: string }
  | { t: 'berth'; action: 'swap' | 'sell'; index: number }
  | { t: 'plan_buy'; classId: ShipClassId }
  | { t: 'figurehead_buy' }
  | { t: 'shipyard'; action: 'repair' }
  | { t: 'shipyard'; action: 'module'; module: ModuleId }
  | { t: 'shipyard'; action: 'unfit'; module: ModuleId }
  | { t: 'shipyard'; action: 'keel' }
  | { t: 'craft'; recipe: CraftRecipe; n: number }
  | { t: 'shipyard'; action: 'guns'; side: Side; gun: GunId }
  | { t: 'shipyard'; action: 'buy_ship'; classId: ShipClassId }
  | { t: 'shipyard'; action: 'mount'; mount: MountId }
  | { t: 'contract'; action: 'accept' | 'abandon'; id: string }
  | { t: 'learn_talent'; id: string }
  | { t: 'respec'; mode?: 'full' | 'forget' | 'token'; id?: string }
  | { t: 'loadout'; slot: number }
  | { t: 'talent_active'; id: string; x?: number; y?: number }
  | { t: 'fire_mode'; rolling: boolean }
  | { t: 'pardon' }
  | { t: 'insure'; tier?: InsuranceTier }
  | { t: 'forward'; id: string }
  | { t: 'option'; good: GoodId; qty: number }
  | { t: 'option_exercise'; index: number }
  | { t: 'order'; action: 'post'; good: GoodId; qty: number; price: number }
  | { t: 'order'; action: 'fill'; id: string; qty: number }
  | { t: 'order'; action: 'cancel'; id: string }
  | { t: 'bank'; action: 'deposit' | 'withdraw' | 'borrow' | 'repay'; amount: number }
  | { t: 'land' }
  | { t: 'dive_move'; dir: 'n' | 'e' | 's' | 'w' }
  | { t: 'dive_surface' }
  | { t: 'abyss'; action: 'ritual' }
  | { t: 'legends' }
  | { t: 'empire'; action: 'view' | 'charter' | 'convoy' | 'cancel' | 'bid'; from?: string; to?: string; good?: string; qty?: number; every?: number; escorts?: number; id?: number; amount?: number; lot?: number }
  | { t: 'legendary'; action: 'deliver'; id: string }
  | { t: 'season'; action: 'title' | 'pennant' | 'name'; value?: string; islandId?: number }
  | { t: 'map'; action: 'forge' | 'appraise' | 'seal' | 'give' | 'burn'; id?: string; to?: string }
  | { t: 'licence' }
  | { t: 'rights'; site: string }
  | { t: 'warehouse'; good: GoodId; qty: number }
  | { t: 'station'; station: Station }
  | { t: 'cleanse' }
  | { t: 'chart'; action: 'sell' }
  | { t: 'chart'; action: 'buy'; region: RegionId }
  | { t: 'chat'; text: string }
  | { t: 'group'; action: 'invite' | 'kick' | 'lead'; name: string }
  | { t: 'group'; action: 'accept' | 'decline'; id: number }
  | { t: 'group'; action: 'leave' }
  | { t: 'group'; action: 'convoy'; on: boolean }
  | { t: 'group'; action: 'say'; text: string }
  | { t: 'barter'; action: 'propose'; name: string }
  | { t: 'barter'; action: 'offer'; gold: number; cargo: Cargo }
  | { t: 'barter'; action: 'ready' | 'cancel' }
  | { t: 'mail'; action: 'list' }
  | { t: 'mail'; action: 'send'; to: string; subject: string; body: string; gold: number }
  | { t: 'mail'; action: 'read' | 'take' | 'delete'; id: number }
  | { t: 'market'; action: 'list' }
  | { t: 'market'; action: 'sell' | 'buy_order'; good: GoodId; qty: number; price: number; from?: 'hold' | 'warehouse' }
  | { t: 'market'; action: 'auction'; good: GoodId; qty: number; price: number; buyout: number; hours: number; from?: 'hold' | 'warehouse' }
  | { t: 'market'; action: 'fill'; id: number; qty: number }
  | { t: 'market'; action: 'bid'; id: number; price: number }
  | { t: 'market'; action: 'cancel'; id: number }
  | { t: 'pvp'; action: 'black_flag'; on: boolean }
  | { t: 'pvp'; action: 'duel'; name: string; fleet: boolean }
  | { t: 'pvp'; action: 'duel_answer'; id: number; accept: boolean }
  | { t: 'pvp'; action: 'forfeit' }
  | { t: 'pvp'; action: 'bounty'; name: string; amount: number }
  | { t: 'pvp'; action: 'bounties' }
  | { t: 'isle'; action: 'list' }
  | { t: 'isle'; action: 'rent'; island: number; days: number }
  | { t: 'isle'; action: 'auto'; island: number; on: boolean }
  | { t: 'isle'; action: 'treasury'; island: number; amount: number }
  | { t: 'isle'; action: 'build'; island: number; building: BuildingId }
  | { t: 'isle'; action: 'demolish'; island: number; index: number }
  | { t: 'isle'; action: 'store'; island: number; good: GoodId; qty: number }
  | { t: 'isle'; action: 'service'; island: number; what: 'repair' | 'hire' | 'craft' | 'copy_map'; arg?: string | number }
  | { t: 'isle'; action: 'window'; island: number; hour: number }
  | { t: 'isle'; action: 'yard_order'; island: number; req: Extract<ClientMsg, { t: 'build' }>['req'] }
  | { t: 'isle'; action: 'yard_launch'; island: number; id: string }
  | { t: 'isle'; action: 'yard_berth'; island: number; index: number }
  | { t: 'isle'; action: 'siege' | 'fortify'; island: number }
  | { t: 'isle'; action: 'siege_choice'; island: number; choice: 'capture' | 'plunder' | 'raze' }
  | { t: 'guild'; action: 'view' }
  | { t: 'guild'; action: 'found'; name: string; tag: string }
  | { t: 'guild'; action: 'invite'; name: string }
  | { t: 'guild'; action: 'answer'; id: number; accept: boolean }
  | { t: 'guild'; action: 'leave' | 'disband' | 'office' | 'return_ship' }
  | { t: 'guild'; action: 'kick'; account: number }
  | { t: 'guild'; action: 'rank'; account: number; rank: GuildRank }
  | { t: 'guild'; action: 'treasury'; amount: number }
  | { t: 'guild'; action: 'tax'; pct: number }
  | { t: 'guild'; action: 'store'; good: GoodId; qty: number }
  | { t: 'guild'; action: 'contract'; good: GoodId; qty: number; reward: number }
  | { t: 'guild'; action: 'drop_contract'; id: number }
  | { t: 'guild'; action: 'give_ship'; berth: number }
  | { t: 'guild'; action: 'borrow_ship'; id: number }
  | { t: 'guild'; action: 'flagship'; account: number | null }
  | { t: 'guild'; action: 'war' | 'alliance' | 'pact' | 'break_alliance' | 'break_pact'; tag: string }
  | { t: 'guild'; action: 'peace'; tag: string; tribute: number }
  | { t: 'guild'; action: 'toll'; island: number; pct: number }
  | { t: 'guild'; action: 'base'; island: number }
  | { t: 'guild'; action: 'lease'; island: number; days: number }
  | { t: 'guild'; action: 'say'; text: string }
  | { t: 'ping'; c: number };

// ------------------------------------------------------------------ server -> client

export interface IslandData {
  id: number;
  name: string;
  region: RegionId;
  biome: IslandBiome;
  x: number;
  y: number;
  r: number;
  poly: number[]; // rounded to meters
  features: IslandFeature[];
  portId?: string;
}

export interface WhirlpoolData {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  strength: number;
  clockwise: boolean;
}

/** A weather front. vx/vy/ttl are only filled in for captains who can forecast (Navigator). */
export interface FrontData {
  id: number;
  kind: 'storm' | 'black_storm' | 'fog' | 'rain';
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  ttl: number;
}

export interface ReefData {
  id: number;
  x: number;
  y: number;
  r: number;
  poly: number[];
  depth: number;
}

export interface ResourceSiteView {
  id: string;
  island: string;
  x: number;
  y: number;
  good: GoodId;
  rate: number; // units per economy hour (15 min)
  stock: number; // -1 unless you hold the rights
  capacity: number;
  cost: number;
  holder: string | null;
  until: number;
  mine: boolean;
}

/** Field Forge recipes. */
export type CraftRecipe = 'round' | 'chain' | 'grape' | 'planks';

export type InsuranceTier = 'hull' | 'cargo' | 'full';

export interface InsuranceQuote {
  tier: InsuranceTier;
  premium: number;
  declared: number; // cargo value covered
  deductible: number;
  cover: number; // share of the declared cargo paid out
  hull: boolean; // waives the salvage fee on sinking
}

export interface ForwardView {
  id: string;
  fromPort: string;
  fromName: string;
  toPort: string;
  toName: string;
  good: GoodId;
  qty: number;
  delivered: number;
  price: number;
  collateral: number;
  expiresAt: number;
}

export interface BuyOrderView {
  id: string;
  name: string;
  good: GoodId;
  qty: number;
  filled: number;
  price: number;
  expiresAt: number;
  mine: boolean;
}

export interface BankView {
  available: boolean;
  balance: number;
  loan: { owed: number; due: number; defaulted: boolean } | null;
  limit: number;
  interest: number;
  withdrawFee: number;
  term: number;
}

export interface PortPublic {
  id: string;
  name: string;
  region: RegionId;
  faction: FactionId;
  x: number;
  y: number;
  size: number;
  shipyardTier: number;
  blackMarket: boolean;
  description: string;
}

export interface CurrentData {
  id: string;
  name: string;
  points: [number, number][];
  width: number;
  strength: number;
}

export interface Contract {
  id: string;
  kind: 'delivery' | 'bounty' | 'courier';
  title: string;
  fromPort: string;
  toPort?: string;
  good?: GoodId;
  qty?: number;
  targetFaction?: FactionId;
  kills?: number;
  progress?: number;
  reward: number;
  xp: number;
  expiresAt: number; // world time sec
  description: string;
}

export interface PrivateState {
  accountId: number;
  name: string;
  captain: CaptainId;
  level: number;
  xp: number;
  xpNext: number;
  talentPoints: number;
  talents: TalentRanks;
  deeds: string[];
  tokens: number;
  loadouts: { slots: number; active: number; filled: boolean[]; switchAt: number };
  respec: { free: boolean; cleanSlateCost: number; cleanSlateAt: number; forgetCost: number };
  talentCooldowns: Record<string, number>;
  heat: { port: number; starboard: number };
  rollingFire: boolean;
  /** Server time the next dash is ready (dynamic combat). */
  dashReadyAt: number;
  captives: { name: string; faction: FactionId; ransom: number }[];
  options: { port: string; good: GoodId; qty: number; price: number; deposit: number; until: number }[];
  /** Appraiser: best sell price you know for each good, and where. */
  appraisal: Partial<Record<GoodId, { price: number; port: string }>> | null;
  coves: { name: string; x: number; y: number }[];
  /** Insider: Crown patrols in your region. */
  patrols: [number, number][];
  /** Treasure maps as this captain reads them. */
  maps: MapView[];
  /** Fragments of the season's legendary chart held by other captains within 10 km: bearings (radians). */
  legendEcho: number[];
  /** The pennant colour you fly (a season reward), if any. */
  pennant: string | null;
  /** The Abyss: pressure, the lying stars, visions, the Islands of Light, the chapters (null until it matters). */
  abyss: AbyssView | null;
  fragments: number;
  /** Sunken wrecks you know of. */
  wrecks: { name: string; x: number; y: number; depth: number }[];
  trails: { classId: string; pts: [number, number][] }[];
  soundings: [number, number][];
  forecast: { kind: string; in: number } | null;
  goldTrails: [number, number][];
  /** The crew as people (docs/02 §8). */
  company: CompanyView;
  /** Quests under way (Paths, Legends, the Descent). */
  quests: { id: string; name: string; kind: 'path' | 'legend' | 'story' | 'job'; mentor: string; step: number; steps: number; text: string; progress: number; need: number; target?: { x: number; y: number; r?: number; region?: RegionId };
    /** For the journal: the giver's words, every step's text, the pay, the giver's face, the job's kind. */
    summary?: string; stepTexts?: string[]; silver?: number; xp?: number; portrait?: string; category?: string }[];
  questsDone: string[];
  /** Today's orders (docs/11 P6): each with its pay, the days in a row and the chest. */
  daily: { day: number; orders: { kind: DailyKind; need: number; progress: number; done: boolean; silver: number }[]; streak: number; chest: boolean; chestSilver: number };
  /** The sea's common cause today (docs/11 P6): the goal, the bar, this captain's deeds, seconds left. */
  common: { kind: CommonKind; target: number; progress: number; mine: number; done: boolean; endsIn: number } | null;
  paths: CaptainId[];
  oath: 'code' | 'marque' | null;
  pathSwitchAt: number;
  /** Shipbuilding (docs/02 §3). */
  builds: { id: string; port: string; classId: ShipClassId; name: string; done: number; start: number; frame: WoodId; plank: WoodId; quality: PlanQuality }[];
  plans: { id: string; classId: ShipClassId | null; quality: PlanQuality; variants: VariantId[]; uses: number }[];
  berths: { port: string; name: string; classId: ShipClassId; hull: number }[];
  figureheads: FigureheadId[];
  /** Hired escorts (Command) and the formation signal. */
  fleet: { escorts: { id: string; name: string; classId: ShipClassId; hull: number; atSea: boolean }[]; slots: number; formation: 'line' | 'wedge' | 'ring'; upkeep: number };
  /** Admiral's Eye: what you can read of ships near you. */
  inspect: { id: number; hull: number; crew: number; morale: number; port: boolean; starboard: boolean }[];
  /** Eyes of the Choir: monsters and ghost ships far beyond sight. */
  monsters: [number, number][];
  gold: number;
  infamy: number;
  wanted: number;
  reputation: Partial<Record<FactionId, number>>;
  loadout: ShipLoadout;
  cargo: Cargo;
  ammo: AmmoStock;
  ammoSel: AmmoId;
  crew: number;
  morale: number;
  hull: number;
  sails: number;
  rudderHp: number;
  gunsDisabled: { port: number; starboard: number };
  dockedAt: string | null;
  lastPort: string;
  contracts: Contract[];
  cooldowns: Record<string, number>; // ability id -> world time when ready
  repairing: boolean;
  curse: number; // 0..100; stages at 25 / 50 / 80
  stolen: Partial<Record<GoodId, number>>; // plundered units customs may recognise
  licences: Partial<Record<FactionId, number>>; // faction -> world time the trade licence expires
  sites: ResourceSiteView[]; // extraction rights you hold
  warehouses: Record<string, Cargo>;
  /** Island feature within reach of the boats, if any. */
  landable: { island: string; feature: string; action?: 'dig' | 'dive' | 'expedition' | 'raise'; blocked?: string } | null;
  /** Landing party ashore. */
  landing: { island: string; feature: string; until: number; started: number } | null;
  discoveredCount: number;
  /** What the captain knows about each visited market, and how old that knowledge is. */
  intel: { portId: string; t: number; top: [GoodId, number][] }[];
  /** Last known positions of notable ships (ghosts, hunters, notorious captains). */
  sightings: { name: string; kind: string; x: number; y: number; t: number }[];
  stats: { sunk: number; boarded: number; tradeProfit: number; distance: number };
  protectedUntil: number; // newbie / respawn protection (world time)
  insured: boolean;
  policy: InsuranceTier | null;
  /** Active status effects on your ship, so prediction and the HUD use the same stats as the server. */
  effects: { id: string; until: number; mods?: StatMods; flags?: Flag[] }[];
  forwards: ForwardView[];
  bank: number;
  loan: { owed: number; due: number; defaulted: boolean } | null;
  pvp: PvpView;
}

export interface MarketRow {
  good: GoodId;
  buy: number; // price the player pays
  sell: number; // price the player receives
  stock: number;
  trend: number; // -1..1 recent price movement
  legal: boolean;
}

export interface OfficerView {
  id: string;
  name: string;
  role: OfficerRole;
  level: number;
  traits: TraitId[];
  loyalty: number;
  wound: 'light' | 'heavy' | null;
  away: boolean;
  orderReady: number;
  unique?: string;
  warned: boolean;
}

export interface CompanyView {
  pools: Record<Profession, number>;
  skill: number;
  loyalty: number;
  share: number;
  expectedShare: number;
  officers: OfficerView[];
  slots: number;
  traits: TraitId[];
  unrest: string;
  wagesPerHour: number;
  owed: number;
  memorial: { name: string; role: OfficerRole; t: number; cause: string }[];
  mutiny: { ringleader: string; mutineers: number; payCost: number; left: number } | null;
}

export interface TavernView {
  /** The bard sings of the season's legends. */
  shanty: string | null;
  stars: number;
  stock: Partial<Record<Profession, number>>;
  costs: Record<Profession, number>;
  officers: { id: string; name: string; role: OfficerRole; level: number; traits: TraitId[]; price: number; loyalty: number; unique?: string; story?: string; rep?: number; taken: boolean }[];
  pressGang: boolean;
  dregs: boolean;
}

export interface PortView {
  portId: string;
  market: MarketRow[];
  ammoPrices: Record<AmmoId, number>;
  crewAvailable: number;
  crewHireCost: number;
  tavern: TavernView;
  escorts: { classId: ShipClassId; price: number; upkeep: number; available: boolean }[];
  questOffers: { id: string; name: string; kind: 'path' | 'legend' | 'story' | 'job'; mentor: string; summary: string; steps: string[]; blocked: string | null; silver: number; xp: number; path?: CaptainId; category?: string; portrait?: string; /** an arc's chapter, of three */ chapter?: number }[];
  captainsHouse: boolean;
  oathOffer: 'code' | 'marque' | null;
  yard: { woods: WoodId[]; figurehead: FigureheadId | null; plans: boolean; master: boolean };
  shipyard: {
    tier: number;
    repairCost: number;
    ships: { classId: ShipClassId; price: number; tradeIn: number }[];
    modules: { module: ModuleId; level: number; cost: number; max: number; excellent: boolean }[];
    guns: { gun: GunId; cost: number }[];
    mounts: { mount: MountId; cost: number }[];
  };
  contracts: Contract[];
  rumors: string[];
  sites: ResourceSiteView[];
  warehouse: { goods: Cargo; volume: number; capacity: number; rented: boolean; rent: number };
  materialDiscount: Record<string, { good: GoodId; units: number }>;
  duty: number;
  dealOfDay: GoodId | null;
  fence: number | null; // a fence buys contraband here at this share of Fogmouth's price
  licence: { cost: number; until: number } | null;
  charts: { sellable: number; sellValue: number; offers: { region: RegionId; name: string; islands: number; price: number }[] };
  pardonCost: number | null;
  exchange: { forwards: ForwardView[]; orders: BuyOrderView[] } | null;
  bank: BankView;
  insurance: InsuranceQuote[];
  priceIntel?: { portId: string; name: string; good: GoodId; sell: number; ageSec: number }[];
}

export interface ShipInfo {
  id: number;
  kind: 'ship';
  name: string;
  classId: ShipClassId;
  faction: FactionId | 'player';
  captainName: string;
  captainId?: CaptainId;
  npcRole?: string;
  isPlayer: boolean;
  level?: number;
  wanted?: number;
  guild?: string; // tag
  title?: string; // a captain's title (seasons, the Pantheon)
  pennant?: string; // a season pennant colour
}

export interface LootInfo {
  id: number;
  kind: 'loot';
  value: number;
}

export type EntityInfo = ShipInfo | LootInfo;

/** Snapshot row for a ship: [id, x, y, heading, speed, sail, hullFrac, sailFrac, flags, crewFrac] */
export type ShipRow = [number, number, number, number, number, number, number, number, number, number];
/** Snapshot row for loot: [id, x, y] */
export type LootRow = [number, number, number];

export const SF = {
  SINKING: 1,
  BOARDING: 2,
  HIDDEN: 4,
  MARKED: 8,
  SURRENDERED: 16,
  DOCKED: 32,
  HOSTILE: 64, // hostile to the receiving player
  REPAIRING: 128,
  TANGLED: 256,
  PROTECTED: 512,
  LANTERNS_OUT: 1024,
  SLOWED: 2048,
  FIRE: 4096,
  CURSE_LOW: 8192, // curse stage bit 0
  CURSE_HIGH: 16384, // curse stage bit 1  (stage = LOW + 2·HIGH)
  TETHERED: 32768,
  BLACK_FLAG: 1 << 16, // flying the Black Flag: fair game in contested water
  GREEN_PENNANT: 1 << 17, // a young captain under the Green Pennant
  SHAME: 1 << 18, // hunted a minnow: marked for an hour
  DUEL: 1 << 19, // in a duel (with the receiving player, or watched)
  BOUNTY: 1 << 20, // a price on this captain's head
  SUBMERGED: 1 << 21, // under the surface (a diving monster, Abyss Step): nothing can touch her
  GRABBED: 1 << 22, // held by a Kraken's arm
  SWALLOWED: 1 << 23, // inside the Lantern Maw
} as const;

/**
 * A treasure map (docs/01 §15): coordinates (a circle), a riddle, a drawing of an island seen from the sea,
 * landmarks and paces, a cursed map that pulls the compass, or fragments of the season's legendary chart.
 */
export interface MapView {
  id: string;
  name: string;
  tier: number;
  kind: 'circle' | 'riddle' | 'drawing' | 'landmark' | 'cursed' | 'fragment';
  /** The search circle, where the map draws one (r = −1: it does not). */
  x: number;
  y: number;
  r: number;
  clue?: string;
  /** A drawing: the island's outline (unit-scaled, north up) and the cross on it. */
  shape?: number[];
  cross?: [number, number];
  /** A cursed map: where the needle pulls (radians). */
  bearing?: number;
  /** The appraiser's word, the Brokers' seal. */
  verdict?: 'genuine' | 'forgery';
  sealed?: boolean;
  copy?: boolean;
  /** A legendary fragment: which one, and how many the chart has. */
  piece?: [number, number];
}

/** The season (seasons.ts): its theme, your path, the tables, the Pantheon. */
export interface SeasonView {
  season: number;
  theme: string;
  themeText: string;
  endsIn: number;
  level: number;
  xp: number;
  levelXp: number;
  maxLevel: number;
  next: { level: number; reward: string } | null;
  mine: { stat: string; value: number }[];
  tables: { stat: string; rows: { name: string; value: number }[] }[];
  halls: { hall: string; members: { name: string; season: number }[] }[];
  war?: { crown: number; confederacy: number };
  titles: string[];
  title: string | null;
  pennants: string[];
  pennant: string | null;
  nameRights: number;
}

/** A legendary ship of the server (legendary.ts): her commission, her captain, or her wreck. */
export interface LegendaryView {
  id: string;
  name: string;
  base: string;
  boss: string;
  port: string;
  status: 'locked' | 'commission' | 'owned' | 'sunk';
  owner?: string;
  gift: string;
  price: string;
  need: { good: string; have: number; need: number }[];
  leaders: { name: string; value: number }[];
  mine: number;
  canDeliver: boolean;
  wreck?: { x: number; y: number };
}

/** Trade empires and the guild wars for regions (empires.ts). */
export interface EmpireView {
  governors: { region: string; tag: string | null; until: number; streak: number; nodes: number; mine: number }[];
  riots: { port: string; quelled: boolean; failed: boolean }[];
  house: boolean;
  orders: { id: number; from: string; to: string; good: string; qty: number; everyHours: number; escorts: number }[];
  offices: string[];
  lots: { index: number; good: string; region: string; top: number; mine: number }[];
  licences: { good: string; region: string; holder: string; mine: boolean }[];
  empires: { name: string; profit: number }[];
}

/** A captain's legend (legends.ts): trophies, the monsters slain, the chapters of the Abyss, and the book of the sea. */
export interface LegendsView {
  trophies: string[];
  bossKills: { name: string; n: number }[];
  chapters: { title: string; text: string }[];
  shards: number;
  firsts: { boss: string; names: string[]; at: number }[];
  season: SeasonView;
  legendary: LegendaryView[];
}

/** The Abyss as a captain knows it (abyss.ts). */
export interface AbyssView {
  inside: boolean;
  pressure: number;
  skew: number; // radians the stars lie by
  phantoms: [number, number][];
  lights: { x: number; y: number; name: string }[];
  deadWinds: { x: number; y: number; r: number }[];
  eye: { x: number; y: number };
  shards: number;
  chapters: { title: string; text: string }[];
  cleared: boolean;
}

/** PvE locations (expeditions.ts): sunken cities (bell buoys) and ship graveyards (a wall of wrecks with gates). */
export interface PveSiteView {
  id: string;
  kind: 'city' | 'graveyard';
  name: string;
  x: number;
  y: number;
  r: number;
  wall?: number;
  gates?: { a: number; open: boolean }[];
  captain?: boolean;
  tide: string;
}

export interface DiveRoomView {
  k: string; // room kind, or '?' where the bell has not been
  d: number; // door bits: 1 N, 2 E, 4 S, 8 W
  done: boolean;
}

/** The diving bell in a sunken city. */
export interface DiveView {
  site: string;
  w: number;
  h: number;
  rooms: DiveRoomView[];
  pos: number;
  air: number;
  airMax: number;
  divers: number;
  keys: number;
  /** What the divers have brought up so far (goods by the unit). */
  haul: Cargo;
  silver: number;
  waveIn: number;
  endsIn: number;
  tide: string;
  log: string[];
  leader: boolean;
}

/** A world event (events.ts): the Armada, a blockade, the Storm of the Century, a new island, a fever. */
export interface WorldEventView {
  id: number;
  kind: 'armada' | 'blockade' | 'storm_century' | 'new_island' | 'epidemic' | 'glory';
  title: string;
  region: RegionId;
  port?: string;
  x: number;
  y: number;
  endsIn: number; // seconds
  by?: string;
  stage?: string;
  quarantine?: boolean;
}

/** A world boss fight as its neighbours see it (sent once a second within range; bosses.ts). */
export interface BossZone {
  k: 'whirl' | 'ring' | 'eye' | 'ink' | 'lure' | 'telegraph' | 'maze' | 'song' | 'bile';
  x: number;
  y: number;
  r: number;
}

export interface BossView {
  id: number;
  kind: string;
  name: string;
  phase: number;
  phaseName: string;
  hp: number;
  hpMax: number;
  x: number;
  y: number;
  hint: string;
  endsIn: number;
  parts: { id: number; label: string; hp: number; hpMax: number }[];
  zones: BossZone[];
  you: { share: number; grabbed: boolean; swallowed: number };
}

export interface SelfRow {
  x: number;
  y: number;
  h: number;
  spd: number;
  sail: number;
  rud: number;
  sailT: number;
  hull: number;
  hullMax: number;
  sails: number;
  sailsMax: number;
  rudderHp: number;
  crew: number;
  crewMax: number;
  morale: number;
  reload: { port: number; starboard: number; bow: number; stern: number; mount: number }; // 0..1 readiness
  ammoSel: AmmoId;
  ammo: AmmoStock;
  flags: number;
  combat: boolean;
  water: number; // 0..1 of flood capacity
  leaks: number;
  station: Station;
  /** Ultimate charge 0..100 (docs/02 §0.3). */
  resolve: number;
  /** The Drowned Captain's Dread 0..100 (docs/02 §7.5); 0 for everyone else. */
  dread: number;
  /** Crew sanity 0..100 (docs/01 §13.3). */
  sanity: number;
}

export type GameEvent =
  | { k: 'volley'; ship: number; side: Side | ChaserEnd; ammo: AmmoId; balls: [number, number, number, number, number][]; spd?: number; perfect?: true } // [x, y, heading, dist, delayMs]; spd = muzzle velocity multiplier; perfect = a held broadside released in its window
  | { k: 'hit'; x: number; y: number; ship: number; dmg: number; ammo: AmmoId; crit?: string; evaded?: true }
  | { k: 'dash'; ship: number; x: number; y: number; h: number }
  | { k: 'splash'; x: number; y: number }
  | { k: 'sunk'; ship: number; x: number; y: number; name: string }
  | { k: 'board_start'; a: number; b: number }
  | { k: 'board_end'; a: number; b: number; winner: number }
  /** A round of a deck fight: the tactics of the attacker (a) and the defender (b), and the dead on each side. */
  | { k: 'board_round'; a: number; b: number; x: number; y: number; ta: BoardTactic; tb: BoardTactic; ka: number; kb: number }
  | { k: 'ability'; ship: number; id: string; x?: number; y?: number }
  | { k: 'tether'; a: number; b: number; until: number }
  | { k: 'lance'; x: number; y: number; x2: number; y2: number }
  | { k: 'fx'; fx: 'deep_call' | 'maw' | 'barrage' | 'mortar' | 'mortar_launch' | 'harpoon_miss' | 'smoke' | 'war_cry' | 'explosion' | 'star_fix' | 'ram' | 'hot_barrels' | 'broken_mast' | 'crossfire' | 'breach' | 'between_worlds' | 'maw_warn' | 'undertow' | 'drowned_hands'
    | 'white_water' | 'boss_roar' | 'lightning' | 'ink' | 'bile' | 'swallow' | 'spit' | 'song' | 'ice' | 'claws' | 'coil' | 'rise' | 'axes' | 'dig' | 'plankton'; x: number; y: number; r?: number; dir?: number }
  | { k: 'discover'; islandId: number; name: string; region: RegionId; quiet?: boolean }
  | { k: 'region'; region: RegionId; safety: string };

export interface BoardingResult {
  targetName: string;
  targetClass: ShipClassId;
  cargo: Cargo; // what survived and is available to take
  destroyed: Cargo; // what was destroyed during the fight
  gold: number;
  ammo: AmmoStock;
  crewLost: number;
  enemyCrewLost: number;
  ransom: number;
  holdFree: number;
  npc: boolean;
  /** Men needed to sail her home as a prize and what a prize court would pay, when she can be taken. */
  prize: { crew: number; value: number } | null;
  captive: boolean; // Ransom: her captain can be taken prisoner
  /** Prisoners who would sign on (up to 30% of her surviving crew). */
  recruits: number;
  noQuarter: boolean; // No Quarter: she sinks within the minute whatever you choose
  /** How the deck fight went: rounds fought, won and lost, the captains' duel. */
  report?: { rounds: number; won: number; lost: number; duel: 'won' | 'lost' | null; moves: number };
}

/** One side of a deck fight as its captain sees it. */
export interface BoardSideView {
  name: string;
  captain: CaptainId | null;
  crew: number;
  crewStart: number;
  morale: number;
  momentum: number;
}

/** The captains' duel: an exchange's blade sweeps from `opens` to `closes` (server time); a strike nearest the
 *  sweet spot (0..1 along the sweep) lands best. Scores 0..1 per exchange. */
export interface BoardDuelView {
  by: 'you' | 'foe';
  state: 'offered' | 'running' | 'done';
  answerBy: number;
  exchange: number;
  opens: number;
  closes: number;
  sweet: number;
  struck: boolean;
  you: number[];
  foe: number[];
  winner: 'you' | 'foe' | null;
}

/** A deck fight in progress (Boarding 2.0), for one of its captains. */
export interface BoardFightView {
  attacker: boolean;
  round: number;
  maxRounds: number;
  /** Server time the round resolves (the choice closes). */
  ends: number;
  choice: BoardTactic | null;
  you: BoardSideView;
  foe: BoardSideView;
  last: { you: BoardTactic; foe: BoardTactic; edge: 1 | 0 | -1; killed: number; lost: number } | null;
  /** What happened beyond the tactics, newest last: a code the client words, whose side did it, a number. */
  log: { code: string; you: boolean; n?: number }[];
  duel: BoardDuelView | null;
  canDuel: boolean;
  canCut: boolean;
}

export type ServerMsg =
  /** A job offered (docs/11 P6) by an island's people on the beach, or shared by a groupmate (`from`): the captain
   *  may take it or leave it. */
  | { t: 'quest_offer'; offer: PortView['questOffers'][number]; island?: number; from?: string }
  /** A quest done: its name and all it paid (docs/11 P6). */
  | { t: 'quest_done'; name: string; silver: number; xp: number; /** groupmates in company (each a tenth more) */ company?: number; rep?: { faction: FactionId; n: number }; extra?: 'map' | 'supplies' }
  | { t: 'welcome'; v: number; token: string; accountId: number; name: string; hasCaptain: boolean; worldSize: number; time: number }
  | { t: 'init'; self: PrivateState; ports: PortPublic[]; currents: CurrentData[]; whirlpools: WhirlpoolData[]; discovered: number[]; time: number; entityId: number }
  | { t: 'fronts'; list: FrontData[]; forecast: boolean }
  | { t: 'chunk'; key: number; islands: IslandData[]; reefs?: ReefData[] }
  | { t: 'snap'; tick: number; time: number; ack: number; you: SelfRow | null; ships: ShipRow[]; loot: LootRow[]; wind: [number, number]; weather: WeatherKind; region: RegionId; fog: number; /** world time per real second, when an admin has changed it */ k?: number }
  | { t: 'info'; list: EntityInfo[] }
  | { t: 'boss'; list: BossView[] }
  | { t: 'events'; list: WorldEventView[] }
  | { t: 'legends'; view: LegendsView }
  | { t: 'onboarding'; view: OnboardingView }
  /** A moment of the First Watch: a step done or skipped, a contextual hint, a goal met, the edge of safe waters. */
  | { t: 'onb'; kind: 'stage' | 'skip' | 'hint' | 'goal' | 'edge'; id: string }
  | { t: 'empire'; view: EmpireView }
  | { t: 'pve_sites'; list: PveSiteView[] }
  | { t: 'dive'; view: DiveView | null }
  | { t: 'gone'; ids: number[] }
  | { t: 'ev'; list: GameEvent[] }
  | { t: 'self'; self: PrivateState }
  | { t: 'self_patch'; patch: Partial<PrivateState> } // only the fields that changed
  | { t: 'port'; view: PortView | null }
  | { t: 'boarding'; result: BoardingResult | null }
  | { t: 'board_fight'; view: BoardFightView | null }
  | { t: 'mutiny'; ringleader: string; mutineers: number; payCost: number; timeout: number }
  | { t: 'sunk_self'; lost: { cargoValue: number; crew: number; repairFee: number }; respawnPort: string; towed?: boolean }
  | { t: 'toast'; msg: string; kind: 'info' | 'good' | 'bad' | 'xp' | 'gold' }
  | { t: 'chat'; from: string; text: string; ch?: 'group' | 'guild' }
  | { t: 'party'; group: PartyView | null; invites: { id: number; from: string }[] }
  | { t: 'barter'; view: BarterView | null }
  | { t: 'mail'; letters: LetterView[]; unread: number }
  | { t: 'market'; view: MarketView }
  | { t: 'duel'; view: DuelView | null }
  | { t: 'holdings'; mine: HoldingView[]; here: IslandOffer | null; region: IslandOffer[]; sieges: SiegeView[] }
  | { t: 'guild'; guild: GuildView | null; invites: { id: number; name: string; tag: string; by: string }[] }
  | { t: 'bounties'; list: BountyView[] }
  | { t: 'marks'; list: { name: string; x: number; y: number }[] }
  | { t: 'err'; msg: string }
  | { t: 'pong'; c: number; s: number };

// ------------------------------------------------------------------ groups, barter, letters, the market

export const GROUP_MAX = 8;

export interface PartyMember {
  accountId: number;
  name: string;
  level: number;
  captain: CaptainId;
  online: boolean;
  docked: string | null;
  x: number;
  y: number;
  hull: number; // 0..1
  inConvoy: boolean; // within signal distance of the leader while the convoy flies
}

export interface PartyView {
  id: number;
  leader: number;
  convoy: boolean;
  members: PartyMember[];
}

export interface BarterSide {
  name: string;
  gold: number;
  cargo: Cargo;
  ready: boolean;
}

export interface BarterView {
  me: BarterSide;
  them: BarterSide;
  atSea: boolean;
  /** At sea the goods cross on boats: seconds left once both are ready. */
  transfer: number;
}

export interface LetterView {
  id: number;
  from: string;
  subject: string;
  body: string;
  gold: number;
  goods: { good: GoodId; qty: number; port: string } | null;
  sentAt: number; // epoch ms
  read: boolean;
  taken: boolean;
}

export interface ListingView {
  id: number;
  kind: 'sell' | 'buy' | 'auction';
  seller: string;
  mine: boolean;
  good: GoodId;
  qty: number;
  price: number; // per unit; for an auction the current bid for the whole lot (or the reserve)
  buyout: number; // auction: whole lot, 0 = none
  bidder: string | null;
  endsAt: number; // epoch ms
}

export interface MarketView {
  port: string;
  auction: boolean; // this port holds the trophy auction
  listFee: number; // fraction of the value, not returned
  saleTax: number; // fraction of proceeds
  listings: ListingView[];
}

// ------------------------------------------------------------------ guilds

export type GuildRank = 'admiral' | 'vice' | 'commodore' | 'captain' | 'bosun' | 'sailor' | 'cabin_boy';

export interface RouteNodeView {
  island: number;
  name: string;
  region: RegionId;
  x: number;
  y: number;
  holder: string | null;
  ours: boolean;
  toll: number;
  progress: number; // % of the hold we have toward taking it
}

export interface GuildView {
  id: number;
  name: string;
  tag: string;
  rank: GuildRank;
  treasury: number;
  tax: number;
  members: { account: number; name: string; rank: GuildRank; online: boolean }[];
  offices: { port: string; until: number; store: Cargo }[];
  here: string | null; // the office in this port
  contracts: { id: number; good: GoodId; qty: number; port: string; reward: number; by: string }[];
  fleet: { id: number; name: string; classId: ShipClassId; hull: number; port: string; lentTo: string | null; giver: string }[];
  flagship: string | null;
  torn: boolean;
  alliance: string[];
  pacts: string[];
  offers: { kind: 'alliance' | 'pact'; from: string }[];
  wars: { with: string; tag: string; active: boolean; opensAt: number; minEnd: number; ours: number; theirs: number; terms: { fromUs: boolean; tribute: number } | null }[];
  nodes: RouteNodeView[];
  /** The guild's order of the week (docs/11 P6). */
  weekly: { kind: GuildGoalKind; target: number; progress: number; mine: number; done: boolean; endsIn: number };
  islands: { island: number; name: string; base: number }[];
  log: { t: number; text: string }[];
}

// ------------------------------------------------------------------ islands and holdings

export interface HoldingView {
  island: number;
  name: string;
  region: RegionId;
  x: number;
  y: number;
  size: IslandSize;
  slots: number;
  owner: string;
  mine: boolean;
  until: number; // epoch ms
  autoRenew: boolean;
  treasury: number;
  store: Cargo;
  storeCap: number; // m³
  buildings: { id: BuildingId; condition: number; unpaid: boolean }[];
  upkeep: number; // silver a day
  renew: number; // a week's rent
  window: number; // UTC hour the siege window opens
  windowNext: number | null;
  shieldUntil: number;
  base: number; // guild base level 0..5
  guild: boolean;
}

export interface SiegeView {
  island: number;
  name: string;
  attacker: string;
  defender: string;
  attacking: boolean;
  phase: 'notice' | 'bombard' | 'fortify' | 'landing' | 'choose';
  windowStart: number;
  windowEnd: number;
  batteries: number[]; // % left
  fort: number | null;
  capture: number; // % of the landing held
  landing: { x: number; y: number };
  choiceUntil: number;
  notes: string[];
}

export interface IslandOffer {
  island: number;
  name: string;
  region: RegionId;
  x: number;
  y: number;
  size: IslandSize;
  slots: number;
  biome: IslandBiome;
  mine: boolean;
  price: Record<7 | 14 | 30, number>;
  held: string | null;
  why: string | null; // why it cannot be leased
}

// ------------------------------------------------------------------ PvP 2.0

export interface PvpView {
  blackFlag: boolean;
  pennant: boolean; // under the Green Pennant
  pennantHoursLeft: number;
  shameUntil: number; // epoch ms
  bubbleUntil: number; // epoch ms
  rating: number;
  duels: number;
  duelWins: number;
  bounty: number; // the captains' purse on your own head
  hunter: boolean; // a hunter's licence (Crown standing)
  sunkBy: { name: string; t: number; free: boolean }[];
  challenges: { id: number; from: string; fleet: boolean }[];
}

export interface DuelView {
  id: number;
  cx: number;
  cy: number;
  r: number;
  startsIn: number;
  endsIn: number;
  sides: { name: string; struck: boolean }[][];
}

export interface BountyView {
  name: string;
  total: number;
  backers: number;
  wanted: number;
  atSea: boolean;
}

export function curseStage(curse: number): 0 | 1 | 2 | 3 {
  return curse >= 80 ? 3 : curse >= 50 ? 2 : curse >= 25 ? 1 : 0;
}

export function curseStageFromFlags(flags: number): number {
  return (flags & SF.CURSE_LOW ? 1 : 0) + (flags & SF.CURSE_HIGH ? 2 : 0);
}

/** HUD blocks the First Watch brings in one at a time (docs/07 §13.1). */
export type HudBlock = 'ship' | 'nav' | 'cargo' | 'feed' | 'target' | 'guns' | 'abilities' | 'map' | 'talents' | 'wanted' | 'captain' | 'minimap';

/** Where a captain stands in the First Watch and the Captain's Goals (onboarding.ts). */
export interface OnboardingView {
  stage: string | null; // the current step, or null when the watch is over
  index: number;
  of: number;
  hud: HudBlock[] | null; // visible blocks; null = all of them
  tip: { good: string; port: string; hours: number } | null; // the tavern's note (first trade)
  goals: string[] | null; // the three goals under way, or null (hidden, or still in the watch)
  goalsDone: number;
  hints: string[]; // hints seen, for the logbook
}
