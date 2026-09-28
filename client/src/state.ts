// Client-side replica of what the server lets this player know: entities in interest range,
// streamed islands, charted islands, private captain state. Remote ships are interpolated
// ~120 ms in the past; the player's own ship is extrapolated with the shared sailing model.

import { noteOwnShip } from './ui/levels.ts';
import { isNight } from '../../shared/src/constants.ts';
import { lerp, lerpAngle } from '../../shared/src/math.ts';
import type {
  BarterView, BoardFightView, FriendView, WhoView, BossView, DiveView, EmpireView, LegendsView, PveSiteView, WorldEventView, BountyView, DuelView, GuildView, HoldingView, IslandOffer, SiegeView, BoardingResult, CurrentData, LetterView, MarketView, PartyView, FrontData, ReefData, WhirlpoolData, EntityInfo, IslandData, PortPublic, PortView, PrivateState, SelfRow, ServerMsg, ShipInfo, WeatherKind, OnboardingView } from '../../shared/src/protocol.ts';
import type { TaskView } from '../../shared/src/data/worldtasks.ts';
import { stepSailing } from '../../shared/src/sim/sailing.ts';
import type { SailState } from '../../shared/src/sim/sailing.ts';
import { computeShipStats, crewFactor, loadFactor, sailTalents } from '../../shared/src/sim/shipstats.ts';
import type { ShipStats } from '../../shared/src/sim/shipstats.ts';
import { currentAt } from '../../shared/src/world/worldgen.ts';
import { placeName } from './ui/maps.ts';
import type { RegionId } from '../../shared/src/world/regions.ts';

export interface ShipSample {
  t: number;
  x: number;
  y: number;
  h: number;
  spd: number;
  sail: number;
  hull: number;
  sails: number;
  flags: number;
  crew: number;
}

export interface RemoteShip {
  id: number;
  info: ShipInfo | null;
  buf: ShipSample[];
  cur: ShipSample;
  wake: { x: number; y: number; t: number; w: number }[];
  sinkStart: number;
}

// Remote ships are drawn this far in the past; it grows when snapshots come slower (a crowded harbour).
const INTERP_MIN = 0.12, INTERP_MAX = 0.4;

export class ClientState {
  self: PrivateState | null = null;
  you: SelfRow | null = null;
  youServerTime = 0;
  youArrival = 0;
  entityId = 0;
  ownDisplay: SailState | null = null;
  ownWake: { x: number; y: number; t: number; w: number }[] = [];
  ownStats: ShipStats | null = null;

  ships = new Map<number, RemoteShip>();
  infos = new Map<number, EntityInfo>();
  loot = new Map<number, { x: number; y: number; value: number }>();
  islands = new Map<number, IslandData>();
  reefs = new Map<number, ReefData>();
  ports: PortPublic[] = [];
  currents: CurrentData[] = [];
  whirlpools: WhirlpoolData[] = [];
  fronts: FrontData[] = [];
  frontsAt = 0;
  forecast = false;
  discovered = new Set<number>();

  wind: [number, number] = [0, 0.5];
  weather: WeatherKind = 'breeze';
  region: RegionId = 'black_coast';
  fog = 0.1;
  serverTime = 0;
  serverTimeArrival = 0;

  portView: PortView | null = null;
  boarding: BoardingResult | null = null;
  party: PartyView | null = null;
  /** Captains looking for a group, and this captain's own posting (docs/11 P6). */
  lfg: NonNullable<Extract<ServerMsg, { t: 'party' }>['lfg']> = [];
  lfgMine: string | null = null;
  invites: { id: number; from: string }[] = [];
  /** The list of friends (docs/11 P6). */
  friends: FriendView[] = [];
  /** Captains one does not hear. */
  ignored: string[] = [];
  /** Tasks of the sea (docs/11 P6): the pirate nests about the map and this captain's tally at each; when told. */
  tasks: TaskView[] = [];
  tasksAt = 0;
  /** The last "who is at sea" search (docs/11 P6): null until one is made. */
  who: { list: WhoView[]; total: number } | null = null;
  barter: BarterView | null = null;
  letters: LetterView[] = [];
  unread = 0;
  market: MarketView | null = null;
  duel: DuelView | null = null;
  bounties: BountyView[] = [];
  marks: { name: string; x: number; y: number }[] = [];
  /** World boss fights within reach (bosses.ts). */
  bosses: BossView[] = [];
  /** World events under way (events.ts), and when the list came (their clocks run on from there). */
  events: WorldEventView[] = [];
  /** Sunken cities and ship graveyards; the diving bell when one of ours is down (expeditions.ts). */
  pveSites: PveSiteView[] = [];
  legends: LegendsView | null = null;
  onboarding: OnboardingView | null = null;
  empire: EmpireView | null = null;
  dive: DiveView | null = null;
  /** A deck fight in progress (Boarding 2.0). */
  boardFight: BoardFightView | null = null;
  eventsAt = 0;
  holdings: { mine: HoldingView[]; here: IslandOffer | null; region: IslandOffer[]; sieges: SiegeView[] } = { mine: [], here: null, region: [], sieges: [] };
  guild: GuildView | null = null;
  guildInvites: { id: number; name: string; tag: string; by: string }[] = [];
  /** The guilds recruiting, for a captain with none (docs/11 P6). */
  recruiting: NonNullable<Extract<ServerMsg, { t: 'guild' }>['recruiting']> = [];

  input = { rudder: 0, sail: 2, seq: 0 };
  snapGap = 0.1; // seconds between snapshots (smoothed)
  /** Take the sail order from the next snapshot (after init). */
  syncSail = false;
  /** World seconds per real second (1 unless an admin server runs the clock faster). */
  timeScale = 1;

  /** The English names of ports and islands as the server sent them (the shown name follows the language). */
  private enNames = new WeakMap<object, string>();

  /** A port's or island's name as the server knows it (for matching server text). */
  enName(o: { name: string }): string {
    return this.enNames.get(o) ?? o.name;
  }

  private localize(o: { name: string }): void {
    if (!this.enNames.has(o)) this.enNames.set(o, o.name);
    o.name = placeName(this.enNames.get(o)!);
  }

  /** Ports and islands take the player's language (on arrival and when the language changes). */
  relocalize(): void {
    for (const p of this.ports) this.localize(p);
    for (const is of this.islands.values()) this.localize(is);
  }

  apply(m: ServerMsg): void {
    const now = performance.now() / 1000;
    switch (m.t) {
      case 'init':
        // A reload or a reconnect must not set sail on its own (a ship at anchor over a dive would drag it):
        // the sail order is taken from the ship as she is.
        this.syncSail = true;
        this.self = m.self;
        this.ports = m.ports;
        for (const p of this.ports) this.localize(p);
        this.currents = m.currents;
        this.whirlpools = m.whirlpools;
        this.discovered = new Set(m.discovered);
        this.entityId = m.entityId;
        this.serverTime = m.time;
        this.serverTimeArrival = now;
        this.ships.clear();
        this.infos.clear();
        this.loot.clear();
        this.ownDisplay = null;
        this.refreshStats();
        break;
      case 'self':
        this.self = m.self;
        this.refreshStats();
        break;
      case 'self_patch':
        if (this.self) Object.assign(this.self, m.patch);
        this.refreshStats();
        break;
      case 'chunk':
        for (const is of m.islands) {
          this.localize(is);
          this.islands.set(is.id, is);
        }
        for (const rf of m.reefs ?? []) this.reefs.set(rf.id, rf);
        break;
      case 'info':
        for (const i of m.list) this.infos.set(i.id, i);
        for (const i of m.list) {
          const s = this.ships.get(i.id);
          if (s && i.kind === 'ship') s.info = i;
        }
        break;
      case 'gone':
        for (const id of m.ids) {
          this.ships.delete(id);
          this.loot.delete(id);
          this.infos.delete(id);
        }
        break;
      case 'snap': {
        if (this.serverTime > 0 && m.time > this.serverTime) this.snapGap += (Math.min(1, m.time - this.serverTime) - this.snapGap) * 0.1;
        this.serverTime = m.time;
        this.serverTimeArrival = now;
        this.timeScale = m.k ?? 1;
        this.wind = m.wind;
        this.weather = m.weather;
        this.region = m.region;
        this.fog = m.fog;
        if (m.you) {
          if (this.syncSail) {
            this.input.sail = Math.max(0, Math.min(4, Math.round(m.you.sailT * 4)));
            this.syncSail = false;
          }
          this.you = m.you;
          this.youServerTime = m.time;
          this.youArrival = now;
        }
        for (const r of m.ships) {
          const [id, x, y, h, spd, sail, hull, sails, flags, crew] = r;
          const sample: ShipSample = { t: m.time, x, y, h, spd, sail, hull, sails, flags, crew };
          let s = this.ships.get(id);
          if (!s) {
            const info = this.infos.get(id);
            s = { id, info: info && info.kind === 'ship' ? info : null, buf: [], cur: sample, wake: [], sinkStart: 0 };
            this.ships.set(id, s);
          }
          s.buf.push(sample);
          if (s.buf.length > 12) s.buf.shift();
        }
        for (const [id, x, y] of m.loot) {
          const info = this.infos.get(id);
          this.loot.set(id, { x, y, value: info && info.kind === 'loot' ? info.value : 0 });
        }
        break;
      }
      case 'fronts':
        this.fronts = m.list;
        this.frontsAt = now;
        this.forecast = m.forecast;
        break;
      case 'party':
        this.party = m.group;
        this.invites = m.invites;
        this.lfg = m.lfg ?? [];
        this.lfgMine = m.lfgMine ?? null;
        break;
      case 'who':
        this.who = { list: m.list, total: m.total };
        break;
      case 'tasks':
        this.tasks = m.list;
        this.tasksAt = performance.now();
        break;
      case 'friends':
        this.friends = m.list;
        this.ignored = m.ignored ?? [];
        break;
      case 'barter':
        this.barter = m.view;
        break;
      case 'mail':
        this.letters = m.letters;
        this.unread = m.unread;
        break;
      case 'market':
        this.market = m.view;
        break;
      case 'duel':
        this.duel = m.view;
        break;
      case 'bounties':
        this.bounties = m.list;
        break;
      case 'marks':
        this.marks = m.list;
        break;
      case 'holdings':
        this.holdings = { mine: m.mine, here: m.here, region: m.region, sieges: m.sieges };
        break;
      case 'boss':
        this.bosses = m.list;
        break;
      case 'legends':
        this.legends = m.view;
        break;
      case 'onboarding':
        this.onboarding = m.view;
        break;
      case 'empire':
        this.empire = m.view;
        break;
      case 'pve_sites':
        this.pveSites = m.list;
        break;
      case 'dive':
        this.dive = m.view;
        break;
      case 'board_fight':
        this.boardFight = m.view;
        break;
      case 'events':
        this.events = m.list;
        this.eventsAt = performance.now();
        break;
      case 'guild':
        this.guild = m.guild;
        this.guildInvites = m.invites;
        this.recruiting = m.recruiting ?? [];
        break;
      case 'port':
        this.portView = m.view;
        break;
      case 'boarding':
        this.boarding = m.result;
        break;
      case 'ev':
        for (const e of m.list) if (e.k === 'discover') this.discovered.add(e.islandId);
        break;
    }
  }

  refreshStats(): void {
    if (!this.self) return;
    this.ownStats = computeShipStats(this.self.loadout, this.self.captain, this.self.talents, this.self.effects);
    noteOwnShip(this.self.loadout);
  }

  estServerTime(): number {
    return this.serverTime + (performance.now() / 1000 - this.serverTimeArrival) * this.timeScale;
  }

  night(): boolean {
    return isNight(this.estServerTime());
  }

  /** Interpolate remote ships at render time. */
  updateRemote(): void {
    const rt = this.estServerTime() - Math.min(INTERP_MAX * this.timeScale, Math.max(INTERP_MIN * this.timeScale, this.snapGap * 1.3));
    for (const s of this.ships.values()) {
      const b = s.buf;
      if (!b.length) continue;
      let a = b[0], c = b[b.length - 1];
      for (let i = 0; i < b.length - 1; i++) {
        if (b[i].t <= rt && b[i + 1].t >= rt) {
          a = b[i];
          c = b[i + 1];
          break;
        }
      }
      if (rt >= c.t) {
        // Extrapolate briefly past the newest sample.
        const dt = Math.min(0.5, rt - c.t); // far ships arrive at 2.5 Hz
        s.cur = { ...c, x: c.x + Math.sin(c.h) * c.spd * dt, y: c.y - Math.cos(c.h) * c.spd * dt };
      } else if (rt <= a.t) {
        s.cur = a;
      } else {
        const t = (rt - a.t) / Math.max(1e-4, c.t - a.t);
        s.cur = { ...c, x: lerp(a.x, c.x, t), y: lerp(a.y, c.y, t), h: lerpAngle(a.h, c.h, t), spd: lerp(a.spd, c.spd, t), sail: lerp(a.sail, c.sail, t) };
      }
    }
  }

  /** Own ship: server state advanced by the elapsed time with the player's current input. */
  updateOwn(): SailState | null {
    const you = this.you;
    if (!you || !this.ownStats || !this.self) return null;
    const st = this.ownStats;
    const elapsed = Math.min(0.2, performance.now() / 1000 - this.youArrival) * this.timeScale;
    let s: SailState = { x: you.x, y: you.y, heading: you.h, speed: you.spd, sail: you.sail, rudder: you.rud };
    const sailSteps = [0, 0.25, 0.5, 0.75, 1];
    const params = {
      rig: st.rig, maxSpeed: st.maxSpeed, accel: st.accel, turnRate: st.turnRate, noGoDeg: st.noGoDeg, sailChangeRate: st.sailChangeRate,
      currentMul: st.currentMul, sailHealth: you.sails / Math.max(1, you.sailsMax), rudderHealth: you.rudderHp, crewFactor: crewFactor(st, you.crew),
      loadFactor: loadFactor(this.self.loadout, st, this.self.cargo, this.self.ammo), speedMul: this.night() ? 1 + st.nightSpeed : 1,
      personalWind: false, weatherly: this.self.loadout.classId === 'schooner', sweeps: this.self.loadout.classId === 'xebec',
      talent: sailTalents(st),
    };
    const wind = { dir: this.wind[0], strength: this.wind[1] };
    const cur = currentAt(this.currents, s.x, s.y, this.estServerTime(), this.whirlpools);
    const input = { rudder: this.input.rudder, sailTarget: sailSteps[this.input.sail] };
    let t = elapsed;
    while (t > 0) {
      const dt = Math.min(0.05, t);
      s = stepSailing(s, input, params, wind, cur, dt);
      t -= dt;
    }
    // Smooth toward the predicted state to hide snapshot corrections.
    const d = this.ownDisplay;
    if (!d || Math.hypot(d.x - s.x, d.y - s.y) > 40) this.ownDisplay = s;
    else this.ownDisplay = { ...s, x: lerp(d.x, s.x, 0.3), y: lerp(d.y, s.y, 0.3), heading: lerpAngle(d.heading, s.heading, 0.3) };
    return this.ownDisplay;
  }
}
