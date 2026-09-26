// Player session and persistent captain profile, plus progression, reputation and wanted rules.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { FACTIONS, FACTION_IDS, factionRelation, wantedLevel } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { AMMO_IDS, emptyAmmo } from '../../../shared/src/data/ships.ts';
import type { AmmoId } from '../../../shared/src/data/ships.ts';
import type { TalentRanks } from '../../../shared/src/data/talents.ts';
import { totalPointsSpent } from '../../../shared/src/data/talents.ts';
import { MAX_LEVEL, talentPointsForLevel, xpForLevel } from '../../../shared/src/constants.ts';
import { MAX_COUNTED_DEEDS } from '../../../shared/src/data/deeds.ts';
import type { BoardingResult, Contract, PrivateState, ResourceSiteView } from '../../../shared/src/protocol.ts';
import type { AmmoStock, Cargo, ShipLoadout } from '../../../shared/src/sim/shipstats.ts';
import type { WsConnection } from '../net/websocket.ts';
import type { ShipEntity } from './ship.ts';
import type { Forward, Loan, Policy } from './finance.ts';
import { captiveRansom } from './prizes.ts';
import type { Captive } from './prizes.ts';
import { CLEAN_SLATE_CD, FREE_RESPEC_LEVEL, cleanSlateCost, loadoutSlots } from './progression.ts';

export interface Profile {
  version: 1;
  captain: CaptainId;
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
  hull: number;
  sails: number;
  rudderHp: number;
  gunsDisabled: { port: number; starboard: number };
  lastPort: string;
  docked: string | null;
  contracts: Contract[];
  discovered: number[];
  regionsSeen: string[];
  stats: { sunk: number; boarded: number; tradeProfit: number; distance: number; sold: number; fogContraband: number; harpoonContracts: number };
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
  createdAt: number;
}

export function newProfile(captain: CaptainId, shipName: string, startPort: string, now: number): Profile {
  const c = CAPTAINS[captain];
  const loadout: ShipLoadout = { classId: c.start.ship, name: shipName, guns: { port: c.start.gun, starboard: c.start.gun }, modules: {} };
  const reputation: Partial<Record<FactionId, number>> = {};
  for (const f of FACTION_IDS) reputation[f] = 0;
  if (captain === 'drowned') reputation.crown = -15;
  if (captain === 'admiral') reputation.crown = -25;
  return {
    version: 1, captain, shipName, level: 1, xp: 0, talents: {}, gold: c.start.gold, infamy: 0, reputation, loadout,
    cargo: { ...c.start.cargo }, ammo: { ...emptyAmmo(), round: 60, chain: 20, grape: 20 }, ammoSel: 'round', crew: c.start.crew, morale: 80,
    hull: -1, sails: -1, rudderHp: 1, gunsDisabled: { port: 0, starboard: 0 }, lastPort: startPort, docked: startPort,
    contracts: [], discovered: [], regionsSeen: [], stats: { sunk: 0, boarded: 0, tradeProfit: 0, distance: 0, sold: 0, fogContraband: 0, harpoonContracts: 0 }, cooldowns: {},
    insured: false, priceIntel: {}, costBasis: {}, sightings: [], chartSales: {}, chartsBought: [], explored: {}, stolen: {}, licences: {}, warehouses: {}, forwards: [], bank: 0, loan: null, policy: null, claims: [], deeds: [], deedState: { region: '', crossing: '', blackStorm: 0, wantedTime: 0, voyagePorts: [] }, tokens: 0, tokenLevels: [], cleanSlates: [], loadouts: [{}], activeLoadout: 0, loadoutSwitchAt: 0, talentCooldowns: {}, captives: [], curse: captain === 'drowned' ? 30 : 0, createdAt: now,
  };
}

export class PlayerSession {
  readonly conn: WsConnection;
  accountId = 0;
  name = '';
  token = '';
  profile: Profile | null = null;
  ship: ShipEntity | null = null;
  knownEntities = new Set<number>();
  knownChunks = new Set<number>();
  discovered = new Set<number>();
  msgWindowStart = 0;
  msgCount = 0;
  pendingBoarding: { result: BoardingResult; targetId: number } | null = null;
  lastPortPush = 0;
  lastSave = 0;
  disconnectedAt: number | null = null;
  lingerUntil = 0;
  lastRegion = '';
  landable: { island: string; feature: string } | null = null;
  siteViews: ResourceSiteView[] = [];

  constructor(conn: WsConnection) {
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
  // Direct change plus a smaller spillover to the faction's friends and enemies.
  for (const f of FACTION_IDS) {
    const rel = factionRelation(faction, f) / 100;
    const d = f === faction ? delta : delta * rel * 0.3;
    if (Math.abs(d) < 0.05) continue;
    p.reputation[f] = Math.max(-100, Math.min(100, (p.reputation[f] ?? 0) + d));
  }
}

export function canDock(p: Profile, faction: FactionId): { ok: boolean; reason?: string } {
  const w = wantedLevel(p.infamy);
  const def = FACTIONS[faction];
  if (w > def.dockMaxWanted) return { ok: false, reason: `${def.short} harbour masters refuse ships at Wanted ${w}.` };
  if ((p.reputation[faction] ?? 0) <= -50) return { ok: false, reason: `The ${def.name} considers you an enemy.` };
  return { ok: true };
}

export function pardonCost(p: Profile): number {
  return Math.round(p.infamy * 18 + p.level * 40);
}

export function toPrivateState(s: PlayerSession, now: number): PrivateState {
  const p = s.profile!;
  const ship = s.ship;
  return {
    accountId: s.accountId,
    name: s.name,
    captain: p.captain,
    level: p.level,
    xp: p.xp,
    xpNext: xpForLevel(p.level),
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
    captives: p.captives.map((c) => ({ name: c.name, faction: c.faction, ransom: captiveRansom(c, (ship?.rank('trd_prize_broker') ?? 0) > 0) })),
    talents: p.talents,
    gold: Math.floor(p.gold),
    infamy: Math.round(p.infamy),
    wanted: wantedLevel(p.infamy),
    reputation: Object.fromEntries(Object.entries(p.reputation).map(([k, v]) => [k, Math.round(v ?? 0)])),
    loadout: p.loadout,
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
  p.ammo = { ...emptyAmmo(), ...(p.ammo ?? {}) };
  for (const a of AMMO_IDS) p.ammo[a] = Math.max(0, Math.floor(p.ammo[a] ?? 0));
  p.gold = Math.max(0, p.gold ?? 0);
  p.gunsDisabled ??= { port: 0, starboard: 0 };
  return p;
}
