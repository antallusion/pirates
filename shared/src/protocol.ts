// Wire protocol (JSON over WebSocket, version-gated). The client only ever sends *intents*
// (inputs, requests). Every outcome — damage, gold, cargo, xp — is computed and pushed by the server.
// Snapshot entity rows are positional arrays to keep packets small; see docs/04_TECHNICAL_ARCHITECTURE.md
// for the planned binary encoding.

import type { CaptainId } from './data/captains.ts';
import type { FactionId } from './data/factions.ts';
import type { GoodId } from './data/goods.ts';
import type { AmmoId, GunId, ModuleId, ShipClassId } from './data/ships.ts';
import type { TalentRanks } from './data/talents.ts';
import type { Cargo, AmmoStock, ShipLoadout } from './sim/shipstats.ts';
import type { IslandFeature } from './world/worldgen.ts';
import type { IslandBiome, RegionId } from './world/regions.ts';

export type Side = 'port' | 'starboard';
export type Aggression = 'careful' | 'standard' | 'brutal';
export type WeatherKind = 'calm' | 'breeze' | 'wind' | 'fog' | 'rain' | 'storm' | 'black_storm';

// ------------------------------------------------------------------ client -> server

export type ClientMsg =
  | { t: 'hello'; v: number; token?: string; name?: string }
  | { t: 'create_captain'; captain: CaptainId; shipName: string }
  | { t: 'input'; seq: number; rudder: number; sail: number }
  | { t: 'fire'; side: Side; dist: number }
  | { t: 'ammo'; ammo: AmmoId }
  | { t: 'ability'; id: string; x?: number; y?: number }
  | { t: 'board'; target: number; aggression: Aggression }
  | { t: 'loot_take'; take: Cargo; fate: 'sink' | 'release' | 'ransom' }
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
  | { t: 'contract'; action: 'accept' | 'abandon'; id: string }
  | { t: 'learn_talent'; id: string }
  | { t: 'respec' }
  | { t: 'pardon' }
  | { t: 'insure' }
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
  discoveredCount: number;
  stats: { sunk: number; boarded: number; tradeProfit: number; distance: number };
  protectedUntil: number; // newbie / respawn protection (world time)
  insured: boolean;
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
  };
  contracts: Contract[];
  rumors: string[];
  pardonCost: number | null;
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
  reload: { port: number; starboard: number }; // 0..1 readiness
  ammoSel: AmmoId;
  ammo: AmmoStock;
  flags: number;
  combat: boolean;
}

export type GameEvent =
  | { k: 'volley'; ship: number; side: Side; ammo: AmmoId; balls: [number, number, number, number, number][] } // [x, y, heading, dist, delayMs]
  | { k: 'hit'; x: number; y: number; ship: number; dmg: number; ammo: AmmoId; crit?: string }
  | { k: 'splash'; x: number; y: number }
  | { k: 'sunk'; ship: number; x: number; y: number; name: string }
  | { k: 'board_start'; a: number; b: number }
  | { k: 'board_end'; a: number; b: number; winner: number }
  | { k: 'ability'; ship: number; id: string; x?: number; y?: number }
  | { k: 'fx'; fx: 'deep_call' | 'maw' | 'barrage' | 'smoke' | 'war_cry' | 'explosion' | 'star_fix' | 'ram'; x: number; y: number; r?: number }
  | { k: 'discover'; islandId: number; name: string; region: RegionId }
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
}

export type ServerMsg =
  | { t: 'welcome'; v: number; token: string; accountId: number; name: string; hasCaptain: boolean; worldSize: number; time: number }
  | { t: 'init'; self: PrivateState; ports: PortPublic[]; currents: CurrentData[]; discovered: number[]; time: number; entityId: number }
  | { t: 'chunk'; key: number; islands: IslandData[] }
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
