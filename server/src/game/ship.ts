// Server-side ship entity: the authoritative state of every vessel (player or NPC) at sea.

import type { CaptainId } from '../../../shared/src/data/captains.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import type { AmmoId, ChaserEnd } from '../../../shared/src/data/ships.ts';
import { emptyAmmo } from '../../../shared/src/data/ships.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { Flag, StatMods } from '../../../shared/src/data/stats.ts';
import type { TalentRanks } from '../../../shared/src/data/talents.ts';
import type { Aggression, ShipInfo, Side, Station } from '../../../shared/src/protocol.ts';
import { SF, curseStage } from '../../../shared/src/protocol.ts';
import type { SailInput, SailParams, SailState } from '../../../shared/src/sim/sailing.ts';
import type { AmmoStock, Cargo, ShipLoadout, ShipStats } from '../../../shared/src/sim/shipstats.ts';
import { computeShipStats, crewFactor, loadFactor, sailTalents } from '../../../shared/src/sim/shipstats.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Landing } from './exploration.ts';
import type { Tether } from './mounts.ts';
import type { SanityState } from './mind.ts';
import type { Formation } from './fleet.ts';

export interface StatusEffect {
  id: string;
  until: number; // world time
  mods?: StatMods;
  flags?: Flag[];
  source?: number; // entity id that applied it
}

export interface BoardingState {
  with: number;
  attacker: boolean;
  aggression: Aggression;
  startedAt: number;
  nextRound: number;
  rounds: number;
  startCrew: number;
  enemyStartCrew: number;
  killed: number;
  lost: number;
  /** Jolly Boat Raid: the attacker's ship is not alongside; only `party` fights. */
  remote?: boolean;
  party?: number;
  railChecked?: boolean;
  healed?: number; // Blood and Salt: hull mended this boarding
}

export type NpcRole = 'merchant' | 'patrol' | 'pirate' | 'hunter' | 'fisher' | 'ghost' | 'escort' | 'boss';

export class ShipEntity {
  readonly id: number;
  name: string;
  captainName: string;
  captain: CaptainId;
  faction: FactionId | 'player';
  accountId: number | null; // set for player ships
  npcRole: NpcRole | null = null;
  level = 1;

  loadout: ShipLoadout;
  talents: TalentRanks;
  stats!: ShipStats;
  effects: StatusEffect[] = [];

  state: SailState;
  input: SailInput = { rudder: 0, sailTarget: 0.5 };
  lastInputSeq = 0;

  hull = 0;
  sails = 0;
  rudderHp = 1;
  crew = 0;
  morale = 80;
  cargo: Cargo = {};
  ammo: AmmoStock = emptyAmmo();
  chaserReload: Record<ChaserEnd, number> = { bow: 0, stern: 0 };
  ammoSel: AmmoId = 'round';
  purse = 0; // NPC coin chest, looted on boarding
  reload: Record<Side, number> = { port: 0, starboard: 0 };
  lastReloadTotal: Record<Side, number> = { port: 1, starboard: 1 };
  gunsDisabled: Record<Side, number> = { port: 0, starboard: 0 };

  region: RegionId = 'black_coast';
  docked: string | null = null;
  sinkingUntil = 0;
  surrendered = false;
  boarding: BoardingState | null = null;
  lastCombat = -999;
  attackers = new Map<number, number>(); // entity id -> last hit time
  repairing = false;
  landing: Landing | null = null;
  curse = 0; // the sea's claim on the ship, 0..100
  water = 0; // tonnes of seawater in the hold
  leaks = 0;
  lastPlug = 0;
  station: Station = 'balanced';
  mountReload = 0;
  fuseAt = 0; // fireship charges
  spoilAcc: Partial<Record<GoodId, number>> = {};
  tether: Tether | null = null;
  unsinkableReadyAt = 0;
  lastStandUntil = 0;
  doubleShotArmed = false;
  lootLockedFor: number | null = null; // boarding winner may loot
  protectedUntil = 0;
  removeAt = 0; // for escorts/despawn timers
  ownerId: number | null = null; // escort owner entity id
  wantedCache = 0;
  guildTag: string | null = null;
  /** A read-only mirror of a ship another zone simulates (zones/zone.ts). */
  ghost = false;
  ghostZone = '';
  ghostFlags = 0;
  distanceLog = 0;
  // Talent state (server/src/game/talentfx.ts).
  heat: Record<Side, number> = { port: 0, starboard: 0 }; // Red-Hot Barrels
  loadedSince: Record<Side, number> = { port: 0, starboard: 0 };
  rollingFire = false;
  pivot: { until: number; rate: number } | null = null; // Anchor Pivot
  talentReady: Record<string, number> = {}; // internal cooldowns (Second Wind, Crossfire, swivels)
  spotter: { target: number; count: number } = { target: 0, count: 0 };
  recentHits: { t: number; dir: number; shooter: number }[] = []; // for Crossfire
  swapBonus = false; // Quick Swap: next volley reloads faster
  gloryStacks = 0; // Warlord
  transferUntil = 0; // moving plunder across: the ship lies alongside
  ramUntil = 0; // Hull to Hull: grapples bite after a ram
  ramTarget = 0;
  sinkAt = 0; // No Quarter: the taken ship goes down
  prize = false; // a captured NPC sailing under a prize crew for her captor
  caravanOf: number | null = null; // Counting House: the account this merchant trades for
  caravanFrom: string | null = null;
  pendingDump: { good: GoodId; qty: number; at: number } | null = null; // cargo going over the side
  voyageStart = 0; // world time she left port (0 = in port / NPC)
  wounded = 0; // Ship's Surgeon: back on deck after the fight
  planking = 0; // Double Planking buffer
  scuttleAt = 0; // Scuttle Charges fuse
  // Minds (server/src/game/mind.ts).
  resolve = 0; // Ultimate charge
  dread = 0; // The Drowned Captain's Dread
  dreadSpent = 0; // toward the next point of morale
  killTally = 0; // enemy crew killed toward the next +5
  sanity = 100; // the crew's nerve on a long voyage
  sanityState: SanityState = 'clear';
  seizedHelm: { until: number; x: number; y: number } | null = null; // madness: the crew steers
  crewDeaths = 0; // men killed since the company last counted them
  companyKey = ''; // last applied crew modifiers
  fleetId: string | null = null; // a hired escort's record in her commander's fleet
  escortIndex = 0; // her station in the formation
  formation: Formation = 'line'; // a flagship's current signal
  // Abyssal (server/src/game/abyssfx.ts).
  seaRot: { stacks: number; until: number; by: number } | null = null;
  abyssStepAt = 0;
  drownedCrew: { n: number; until: number }[] = [];
  risingQueue: { n: number; at: number }[] = [];
  risingFrac = 0;
  abyssSpawn = false;
  towed = false; // Salvage King: a raised hull on the tow line
  // World bosses (bosses.ts): the fight this entity belongs to (its body's id) and what part of it she is.
  bossOf = 0;
  bossPart = '';
  /** A squadron of a world event (events.ts): the Armada, a blockade. */
  eventOf = 0;
  /** Depth pressure in the Abyss, 0..100 (abyss.ts). */
  pressure = 0;
  /** A captain's chosen title and pennant colour (seasons.ts). */
  title: string | null = null;
  pennant: string | null = null;
  /** The Graveyard Captain of this graveyard (expeditions.ts). */
  yardOf = '';

  constructor(opts: {
    id: number; name: string; captainName: string; captain: CaptainId; faction: FactionId | 'player'; accountId: number | null;
    loadout: ShipLoadout; talents: TalentRanks; x: number; y: number; heading: number;
  }) {
    this.id = opts.id;
    this.name = opts.name;
    this.captainName = opts.captainName;
    this.captain = opts.captain;
    this.faction = opts.faction;
    this.accountId = opts.accountId;
    this.loadout = opts.loadout;
    this.talents = opts.talents;
    this.state = { x: opts.x, y: opts.y, heading: opts.heading, speed: 0, sail: 0, rudder: 0 };
    this.recompute(0);
    this.hull = this.stats.hullMax;
    this.sails = this.stats.sailHpMax;
  }

  get isPlayer(): boolean {
    return this.accountId !== null;
  }

  get cls() {
    return SHIP_CLASSES[this.loadout.classId];
  }

  /** Locked alongside another ship (a jolly-boat raid leaves the mother ship free). */
  get grappled(): boolean {
    return !!this.boarding && !this.boarding.remote;
  }

  get alive(): boolean {
    return this.sinkingUntil === 0;
  }

  /** Recompute derived stats after talents/loadout/effects change. Clamps pools to the new maxima. */
  recompute(now: number): void {
    this.effects = this.effects.filter((e) => e.until > now);
    this.stats = computeShipStats(this.loadout, this.captain, this.talents, this.effects);
    if (this.hull > this.stats.hullMax) this.hull = this.stats.hullMax;
    if (this.sails > this.stats.sailHpMax) this.sails = this.stats.sailHpMax;
    if (this.crew > this.stats.crewMax) this.crew = this.stats.crewMax;
  }

  addEffect(e: StatusEffect, now: number): void {
    this.effects = this.effects.filter((x) => x.id !== e.id);
    this.effects.push(e);
    this.recompute(now);
  }

  hasEffect(id: string): boolean {
    return this.effects.some((e) => e.id === id);
  }

  rank(id: string): number {
    return this.talents[id] ?? 0;
  }

  hasFlag(f: Flag): boolean {
    return this.stats.flags.has(f);
  }

  sailParams(night: boolean): SailParams {
    const st = this.stats;
    return {
      rig: st.rig,
      maxSpeed: st.maxSpeed,
      accel: st.accel,
      turnRate: st.turnRate,
      noGoDeg: st.noGoDeg,
      sailChangeRate: st.sailChangeRate,
      currentMul: st.currentMul,
      sailHealth: this.sails / Math.max(1, st.sailHpMax),
      rudderHealth: this.rudderHp,
      crewFactor: crewFactor(st, this.crew),
      loadFactor: loadFactor(this.loadout, st, this.cargo, this.ammo) * (1 - 0.4 * Math.min(1, this.water / (st.holdWeight * 0.5 + st.length * 2))),
      speedMul: (night ? 1 + st.nightSpeed : 1) * (this.hull < st.hullMax * 0.3 ? 0.85 : 1),
      personalWind: st.flags.has('personal_wind'),
      weatherly: this.cls.passive.id === 'weatherly',
      sweeps: this.cls.passive.id === 'sweeps',
      talent: sailTalents(st),
    };
  }

  inCombat(now: number): boolean {
    return now - this.lastCombat < 20;
  }

  flagsFor(viewerId: number | null, hostile: boolean, now: number): number {
    if (this.ghost) return (this.ghostFlags & ~SF.HOSTILE) | (hostile ? SF.HOSTILE : 0);
    let f = 0;
    if (this.sinkingUntil) f |= SF.SINKING;
    if (this.boarding) f |= SF.BOARDING;
    if (this.hasFlag('hidden')) f |= SF.HIDDEN;
    if (this.hasEffect('marked')) f |= SF.MARKED;
    if (this.surrendered) f |= SF.SURRENDERED;
    if (this.docked) f |= SF.DOCKED;
    if (hostile) f |= SF.HOSTILE;
    if (this.repairing) f |= SF.REPAIRING;
    if (this.hasEffect('tangled')) f |= SF.TANGLED;
    if (this.protectedUntil > now) f |= SF.PROTECTED;
    if (this.hasFlag('dark_running')) f |= SF.LANTERNS_OUT;
    if (this.hasEffect('undertow') || this.hasEffect('maw_slow')) f |= SF.SLOWED;
    if (this.hasEffect('fire')) f |= SF.FIRE;
    if (this.hasEffect('submerged')) f |= SF.SUBMERGED;
    if (this.hasEffect('grabbed')) f |= SF.GRABBED;
    if (this.hasEffect('swallowed')) f |= SF.SWALLOWED;
    const stage = curseStage(this.curse);
    if (stage & 1) f |= SF.CURSE_LOW;
    if (stage & 2) f |= SF.CURSE_HIGH;
    void viewerId;
    return f;
  }

  info(): ShipInfo {
    // False Colors: a nameless merchant under a borrowed flag.
    if (this.hasFlag('false_colors')) {
      return { id: this.id, kind: 'ship', name: 'Unknown Merchant', classId: this.loadout.classId, faction: 'league', captainName: '', npcRole: 'merchant', isPlayer: false, level: 1, wanted: 0 };
    }
    return {
      id: this.id, kind: 'ship', name: this.name, classId: this.loadout.classId, faction: this.faction,
      captainName: this.captainName, captainId: this.isPlayer ? this.captain : undefined, npcRole: this.npcRole ?? undefined,
      isPlayer: this.isPlayer, level: this.level, wanted: this.wantedCache, guild: this.guildTag ?? undefined,
      title: this.title ?? undefined, pennant: this.pennant ?? undefined,
    };
  }
}
