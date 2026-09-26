// Server-side ship entity: the authoritative state of every vessel (player or NPC) at sea.

import type { CaptainId } from '../../../shared/src/data/captains.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import type { AmmoId, ChaserEnd } from '../../../shared/src/data/ships.ts';
import { emptyAmmo } from '../../../shared/src/data/ships.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { Flag, StatMods } from '../../../shared/src/data/stats.ts';
import type { TalentRanks } from '../../../shared/src/data/talents.ts';
import type { Aggression, ShipInfo, Side, Station } from '../../../shared/src/protocol.ts';
import { SF, curseStage } from '../../../shared/src/protocol.ts';
import type { SailInput, SailParams, SailState } from '../../../shared/src/sim/sailing.ts';
import type { AmmoStock, Cargo, ShipLoadout, ShipStats } from '../../../shared/src/sim/shipstats.ts';
import { computeShipStats, crewFactor, loadFactor } from '../../../shared/src/sim/shipstats.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Landing } from './exploration.ts';
import type { Tether } from './mounts.ts';

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
}

export type NpcRole = 'merchant' | 'patrol' | 'pirate' | 'hunter' | 'fisher' | 'ghost' | 'escort';

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
  tether: Tether | null = null;
  unsinkableReadyAt = 0;
  lastStandUntil = 0;
  doubleShotArmed = false;
  lootLockedFor: number | null = null; // boarding winner may loot
  protectedUntil = 0;
  removeAt = 0; // for escorts/despawn timers
  ownerId: number | null = null; // escort owner entity id
  wantedCache = 0;
  distanceLog = 0;

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
    };
  }

  inCombat(now: number): boolean {
    return now - this.lastCombat < 20;
  }

  flagsFor(viewerId: number | null, hostile: boolean, now: number): number {
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
    const stage = curseStage(this.curse);
    if (stage & 1) f |= SF.CURSE_LOW;
    if (stage & 2) f |= SF.CURSE_HIGH;
    void viewerId;
    return f;
  }

  info(): ShipInfo {
    return {
      id: this.id, kind: 'ship', name: this.name, classId: this.loadout.classId, faction: this.faction,
      captainName: this.captainName, captainId: this.isPlayer ? this.captain : undefined, npcRole: this.npcRole ?? undefined,
      isPlayer: this.isPlayer, level: this.level, wanted: this.wantedCache,
    };
  }
}
