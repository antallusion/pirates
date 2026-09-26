// Wire protocol (JSON over WebSocket, version-gated). The client only ever sends *intents*
// (inputs, requests). Every outcome — damage, gold, cargo, xp — is computed and pushed by the server.
// Snapshot entity rows are positional arrays to keep packets small; see docs/04_TECHNICAL_ARCHITECTURE.md
// for the planned binary encoding.

import type { CaptainId } from './data/captains.ts';
import type { FactionId } from './data/factions.ts';
import type { GoodId } from './data/goods.ts';
import type { AmmoId, ChaserEnd, GunId, ModuleId, MountId, ShipClassId } from './data/ships.ts';
import type { TalentRanks } from './data/talents.ts';
import type { Flag, StatMods } from './data/stats.ts';
import type { Cargo, AmmoStock, ShipLoadout } from './sim/shipstats.ts';
import type { IslandFeature } from './world/worldgen.ts';
import type { IslandBiome, RegionId } from './world/regions.ts';

export type Side = 'port' | 'starboard';
export type Station = 'balanced' | 'gunnery' | 'sailing' | 'damage_control';
export const STATIONS: Station[] = ['balanced', 'gunnery', 'sailing', 'damage_control'];
export type Aggression = 'careful' | 'standard' | 'brutal';
export type WeatherKind = 'calm' | 'breeze' | 'wind' | 'fog' | 'rain' | 'storm' | 'black_storm';

// ------------------------------------------------------------------ client -> server

export type ClientMsg =
  | { t: 'hello'; v: number; token?: string; name?: string }
  | { t: 'create_captain'; captain: CaptainId; shipName: string }
  | { t: 'input'; seq: number; rudder: number; sail: number }
  | { t: 'fire'; side: Side; dist: number }
  | { t: 'chase'; end: ChaserEnd; x: number; y: number }
  | { t: 'mount'; x: number; y: number }
  | { t: 'ammo'; ammo: AmmoId }
  | { t: 'ability'; id: string; x?: number; y?: number }
  | { t: 'board'; target: number; aggression: Aggression }
  | { t: 'loot_take'; take: Cargo; fate: 'sink' | 'release' | 'ransom' | 'prize' }
  | { t: 'board_cut' }
  | { t: 'captive'; index: number; mode: 'ransom' | 'hand_over' }
  | { t: 'repair'; on: boolean }
  | { t: 'dock' }
  | { t: 'undock' }
  | { t: 'trade'; good: GoodId; qty: number }
  | { t: 'buy_ammo'; ammo: AmmoId; qty: number }
  | { t: 'hire_crew'; qty: number }
  | { t: 'shipyard'; action: 'repair' }
  | { t: 'shipyard'; action: 'module'; module: ModuleId }
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
  | { t: 'order'; action: 'post'; good: GoodId; qty: number; price: number }
  | { t: 'order'; action: 'fill'; id: string; qty: number }
  | { t: 'order'; action: 'cancel'; id: string }
  | { t: 'bank'; action: 'deposit' | 'withdraw' | 'borrow' | 'repay'; amount: number }
  | { t: 'land' }
  | { t: 'licence' }
  | { t: 'rights'; site: string }
  | { t: 'warehouse'; good: GoodId; qty: number }
  | { t: 'station'; station: Station }
  | { t: 'cleanse' }
  | { t: 'chart'; action: 'sell' }
  | { t: 'chart'; action: 'buy'; region: RegionId }
  | { t: 'chat'; text: string }
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
  captives: { name: string; faction: FactionId; ransom: number }[];
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
  landable: { island: string; feature: string } | null;
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
}

export interface MarketRow {
  good: GoodId;
  buy: number; // price the player pays
  sell: number; // price the player receives
  stock: number;
  trend: number; // -1..1 recent price movement
  legal: boolean;
}

export interface PortView {
  portId: string;
  market: MarketRow[];
  ammoPrices: Record<AmmoId, number>;
  crewAvailable: number;
  crewHireCost: number;
  shipyard: {
    tier: number;
    repairCost: number;
    ships: { classId: ShipClassId; price: number; tradeIn: number }[];
    modules: { module: ModuleId; level: number; cost: number; max: number }[];
    guns: { gun: GunId; cost: number }[];
    mounts: { mount: MountId; cost: number }[];
  };
  contracts: Contract[];
  rumors: string[];
  sites: ResourceSiteView[];
  warehouse: { goods: Cargo; volume: number; capacity: number; rented: boolean; rent: number };
  materialDiscount: Record<string, { good: GoodId; units: number }>;
  duty: number;
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
} as const;

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
}

export type GameEvent =
  | { k: 'volley'; ship: number; side: Side | ChaserEnd; ammo: AmmoId; balls: [number, number, number, number, number][]; spd?: number } // [x, y, heading, dist, delayMs]; spd = muzzle velocity multiplier
  | { k: 'hit'; x: number; y: number; ship: number; dmg: number; ammo: AmmoId; crit?: string }
  | { k: 'splash'; x: number; y: number }
  | { k: 'sunk'; ship: number; x: number; y: number; name: string }
  | { k: 'board_start'; a: number; b: number }
  | { k: 'board_end'; a: number; b: number; winner: number }
  | { k: 'ability'; ship: number; id: string; x?: number; y?: number }
  | { k: 'tether'; a: number; b: number; until: number }
  | { k: 'lance'; x: number; y: number; x2: number; y2: number }
  | { k: 'fx'; fx: 'deep_call' | 'maw' | 'barrage' | 'mortar' | 'mortar_launch' | 'harpoon_miss' | 'smoke' | 'war_cry' | 'explosion' | 'star_fix' | 'ram' | 'hot_barrels' | 'broken_mast' | 'crossfire' | 'breach'; x: number; y: number; r?: number }
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
  noQuarter: boolean; // No Quarter: she sinks within the minute whatever you choose
}

export type ServerMsg =
  | { t: 'welcome'; v: number; token: string; accountId: number; name: string; hasCaptain: boolean; worldSize: number; time: number }
  | { t: 'init'; self: PrivateState; ports: PortPublic[]; currents: CurrentData[]; whirlpools: WhirlpoolData[]; discovered: number[]; time: number; entityId: number }
  | { t: 'fronts'; list: FrontData[]; forecast: boolean }
  | { t: 'chunk'; key: number; islands: IslandData[]; reefs?: ReefData[] }
  | { t: 'snap'; tick: number; time: number; ack: number; you: SelfRow | null; ships: ShipRow[]; loot: LootRow[]; wind: [number, number]; weather: WeatherKind; region: RegionId; fog: number }
  | { t: 'info'; list: EntityInfo[] }
  | { t: 'gone'; ids: number[] }
  | { t: 'ev'; list: GameEvent[] }
  | { t: 'self'; self: PrivateState }
  | { t: 'port'; view: PortView | null }
  | { t: 'boarding'; result: BoardingResult | null }
  | { t: 'sunk_self'; lost: { cargoValue: number; crew: number; repairFee: number }; respawnPort: string }
  | { t: 'toast'; msg: string; kind: 'info' | 'good' | 'bad' | 'xp' | 'gold' }
  | { t: 'chat'; from: string; text: string }
  | { t: 'err'; msg: string }
  | { t: 'pong'; c: number; s: number };

export function curseStage(curse: number): 0 | 1 | 2 | 3 {
  return curse >= 80 ? 3 : curse >= 50 ? 2 : curse >= 25 ? 1 : 0;
}

export function curseStageFromFlags(flags: number): number {
  return (flags & SF.CURSE_LOW ? 1 : 0) + (flags & SF.CURSE_HIGH ? 2 : 0);
}
