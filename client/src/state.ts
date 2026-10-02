// Client-side replica of what the server lets this player know: entities in interest range,
// streamed islands, charted islands, private captain state. Remote ships are interpolated
// ~120 ms in the past; the player's own ship is extrapolated with the shared sailing model.

import type { SupplyView, TurtleView, ZoneView } from '../../shared/src/isleproto.ts';
import type { LairCard, LairsView } from '../../shared/src/lairproto.ts';
import type { DriftCard, DriftMark, TameView } from '../../shared/src/driftproto.ts';
import type { FindView } from '../../shared/src/findproto.ts';
import type { RoamView } from '../../shared/src/roamproto.ts';
import { skillSeaMods } from '../../shared/src/data/hero.ts';
import type { OmenId } from '../../shared/src/data/omens.ts';
import { regattaSail } from '../../shared/src/data/regatta.ts';
import { setNemeses } from './ui/nemesis.ts';
import type { IslesView } from '../../shared/src/protocol.ts';
import type { DwellView, MineView, WeekView } from '../../shared/src/h3proto.ts';
import type { AdvCardView, AdvView, PuzzleView } from '../../shared/src/h4proto.ts';
import type { AppraisalView, CaravanView, CarcassView, BaseView, EstateView, HuntView, RaidView, ShoalView, SightView, WantedView, TattooView, CompanionView, PetView, PetsOwnView, DiceView, RegattaView, WondersView, DutchmanView, HallView, StormView, DescentView, HolidayView, BazaarShadow } from '../../shared/src/protocol.ts';
import type { Item } from '../../shared/src/data/items.ts';
import { noteOwnShip } from './ui/levels.ts';
import { isNight, SPEED_SCALE } from '../../shared/src/constants.ts';
import { lerp, lerpAngle } from '../../shared/src/math.ts';
import type {
  LfgMine, WorldGoalView, BarterView, BoardFightView, TacView, FriendView, WhoView, BossView, DiveView, EmpireView, LegendsView, RenownView, AwayView, FrontWarn, PveSiteView, WorldEventView, BountyView, DuelView, GuildView, HoldingView, IslandOffer, SiegeView, BoardingResult, CurrentData, LetterView, MarketView, PartyView, FrontData, ReefData, SeaMarkData, SectorData, WhirlpoolData, EntityInfo, IslandData, PortPublic, PortView, PrivateState, SelfRow, ServerMsg, ShipInfo, WeatherKind, OnboardingView } from '../../shared/src/protocol.ts';
import type { TaskView } from '../../shared/src/data/worldtasks.ts';
import { SIGNAL_TTL } from '../../shared/src/data/social.ts';
import type { SignalKind } from '../../shared/src/data/social.ts';
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
  /** The dense sea's marks that are not land (docs/16 P3). */
  seaMarks = new Map<number, SeaMarkData>();
  /** The squares of the sea and their ship levels (docs/16 P2), row by row. */
  sectors: SectorData[] = [];
  ports: PortPublic[] = [];
  currents: CurrentData[] = [];
  whirlpools: WhirlpoolData[] = [];
  fronts: FrontData[] = [];
  /** A storm front on her course (docs/16 #10). */
  frontWarn: FrontWarn | null = null;
  frontsAt = 0;
  forecast = false;
  discovered = new Set<number>();
  /** Batch E of docs/16: lighthouses, lookouts, the banks the tide bares, her caches. */
  isles: IslesView | null = null;

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
  /** docs/16 #31: one's own posting's goal and levels. */
  lfgGoal: LfgMine | null = null;
  invites: { id: number; from: string; ask?: boolean }[] = [];
  /** docs/16 #35: groupmates' signal flags on the charts, with when they came (performance.now s). */
  signals: { from: string; kind: SignalKind; x: number; y: number; at: number }[] = [];
  /** docs/16 #32: the sea's goals of the week, and when they were told (performance.now s). */
  worldGoals: WorldGoalView[] = [];
  worldGoalsAt = 0;
  /** The list of friends (docs/11 P6). */
  friends: FriendView[] = [];
  /** Captains one does not hear. */
  ignored: string[] = [];
  /** Tasks of the sea (docs/11 P6): the pirate nests about the map and this captain's tally at each; when told. */
  tasks: TaskView[] = [];
  /** Signs on the horizon (docs/12 P2). */
  sights: SightView[] = [];
  /** Shoals in sight (docs/12 P3). */
  shoals: ShoalView[] = [];
  /** The hunt (docs/12 P4): the line, the flensing, a carcass alongside; the carcasses afloat. */
  hunt: HuntView | null = null;
  carcasses: CarcassView[] = [];
  /** The Hunters' Guild's view (docs/12 P5). */
  wanted: WantedView | null = null;
  /** The raider's trade (docs/12 P6): the glass's last word on a hold, the Brethren and the lanes. */
  appraisal: AppraisalView | null = null;
  raid: RaidView | null = null;
  /** One's own island and outposts (docs/12 P7). */
  estate: EstateView | null = null;
  /** One's own island as a base (docs/15), and when (Date.now) the view came, for its timers. */
  base: BaseView | null = null;
  baseAt = 0;
  /** docs/17 H3: the recruit window's dwellings, the sea's week, the mines on the chart. */
  dwell: DwellView | null = null;
  week: WeekView | null = null;
  weekAt = 0;
  mines: MineView[] = [];
  /** docs/17 H4: the guards and the things on the map she has seen, the card over the sea, the Grail's chart. */
  adv: AdvView | null = null;
  /** docs/18 III: the zones of one level, the turtle islands, the supply routes. */
  zones: ZoneView[] = [];
  turtles: TurtleView[] = [];
  supply: SupplyView | null = null;
  advCard: AdvCardView | null = null;
  /** docs/18 II: the lairs of the land's creatures she has seen, her land's spoils and eggs; the lair's card. */
  lairs: LairsView | null = null;
  lairCard: LairCard | null = null;
  /** docs/18 IV: the drifts in sight (and when they came: their clocks run from it), the drift's card, the creatures' window. */
  drifts: DriftMark[] = [];
  driftsAt = 0;
  /** docs/19 D5: the sea's small things about her (and when the list came), the one her boats are at. */
  finds: FindView[] = [];
  findsAt = 0;
  findBusy: { id: number; until: number; total: number } | null = null;
  /** docs/19 D7: the creatures roaming the sea about her (HoMM3's neutral stacks). */
  roams: RoamView[] = [];
  driftCard: DriftCard | null = null;
  /** The dense sea's marks she has worked today, and the one her boats are at (world seconds). */
  markDone = new Set<number>();
  markBusy: { id: number; until: number; total: number } | null = null;
  tame: TameView | null = null;
  puzzle: PuzzleView | null = null;
  puzzleAt = 0;
  /** One's own caravans (docs/12 P8). */
  caravans: CaravanView[] = [];
  caravanSlots = 0;
  /** Tattoos and a chain's reward waiting to be chosen (docs/12 P9). */
  tattoos: TattooView | null = null;
  /** The orca calf and the companions of the ships near (docs/12 P10 #2–3). */
  companion: CompanionView | null = null;
  pets = new Map<number, PetView>();
  petsOwn: PetsOwnView | null = null;
  /** The dice table she sits at (docs/12 P10 #4). */
  dice: DiceView | null = null;
  diceAt = 0;
  /** The next regatta, and her race when she runs it (docs/12 P10 #5). */
  regatta: RegattaView | null = null;
  /** The Atlas of Sea Wonders (docs/12 P10 #8). */
  wonders: WondersView | null = null;
  /** The omen of the day (docs/12 P10 #9). */
  omen: OmenId | null = null;
  /** The Flying Dutchman's week (docs/12 P10 #10). */
  dutchman: DutchmanView | null = null;
  /** An island's hall, as a guest or its owner sees it (docs/12 P10 #13). */
  hall: HallView | null = null;
  /** The heart of the Storm of the Century, for a captain at sea in its region (docs/12 P10 #14). */
  storm: StormView | null = null;
  /** The Descent into the Abyss: the week's Stair, her descent, the board (docs/12 P10 #17). */
  descent: DescentView | null = null;
  /** The sea's holiday, or the next one (docs/12 P10 #18). */
  holiday: HolidayView | null = null;
  /** The Floating Bazaar's shadow ships at the ports near (docs/12 P10 #19). */
  bazaarShadows: BazaarShadow[] = [];
  choice: { quest: string; items: Item[] } | null = null;
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
  /** docs/16 #26–29: careers, feats, the album, the week's challenges; #30: what happened while she was away. */
  renown: RenownView | null = null;
  away: AwayView | null = null;
  onboarding: OnboardingView | null = null;
  empire: EmpireView | null = null;
  dive: DiveView | null = null;
  /** A deck fight in progress (Boarding 2.0). */
  boardFight: BoardFightView | null = null;
  /** The turn-based boarding battle (docs/16 P4). */
  boardTac: TacView | null = null;
  eventsAt = 0;
  holdings: { mine: HoldingView[]; here: IslandOffer | null; region: IslandOffer[]; sieges: SiegeView[] } = { mine: [], here: null, region: [], sieges: [] };
  guild: GuildView | null = null;
  guildInvites: { id: number; name: string; tag: string; by: string }[] = [];
  /** The guilds recruiting, for a captain with none (docs/11 P6). */
  recruiting: NonNullable<Extract<ServerMsg, { t: 'guild' }>['recruiting']> = [];

  input = { rudder: 0, sail: 2, seq: 0 };
  /** docs/16 #36: the helmsman has the wheel for this mark (the server steers; the prediction follows its rudder). */
  autosail: { x: number; y: number } | null = null;
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
        this.sectors = m.sectors ?? [];
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
      case 'isles':
        this.isles = m.view;
        break;
      case 'chunk':
        for (const is of m.islands) {
          this.localize(is);
          this.islands.set(is.id, is);
        }
        for (const rf of m.reefs ?? []) this.reefs.set(rf.id, rf);
        for (const mk of m.marks ?? []) this.seaMarks.set(mk.id, mk);
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
        this.frontWarn = m.warn ?? null;
        break;
      case 'party':
        this.party = m.group;
        this.invites = m.invites;
        this.lfg = m.lfg ?? [];
        this.lfgMine = m.lfgMine ?? null;
        this.lfgGoal = m.lfgGoal ?? null;
        break;
      case 'signal':
        this.signals = [...this.signals.filter((x) => now - x.at < SIGNAL_TTL && x.from !== m.from), { from: m.from, kind: m.kind, x: m.x, y: m.y, at: now }];
        break;
      case 'autosail':
        // The helmsman has the wheel for a mark, or has given it back (docs/16 #36).
        this.autosail = m.on && m.x !== undefined && m.y !== undefined ? { x: m.x, y: m.y } : null;
        if (m.on && m.sail !== undefined) this.input.sail = m.sail;
        break;
      case 'wgoals':
        this.worldGoals = m.list;
        this.worldGoalsAt = now;
        break;
      case 'who':
        this.who = { list: m.list, total: m.total };
        break;
      case 'sights':
        this.sights = m.list;
        break;
      case 'shoals':
        this.shoals = m.list;
        break;
      case 'hunt':
        this.hunt = m.view;
        break;
      case 'carcasses':
        this.carcasses = m.list;
        break;
      case 'wanted':
        this.wanted = m.view;
        setNemeses(m.view.nemeses);
        break;
      case 'appraisal':
        this.appraisal = m.view;
        break;
      case 'raid':
        this.raid = m.view;
        break;
      case 'estate':
        this.estate = m.view;
        break;
      case 'base':
        this.base = m.view;
        this.baseAt = Date.now();
        break;
      case 'dwell':
        this.dwell = m.view;
        break;
      case 'week':
        this.week = m.view;
        this.weekAt = Date.now();
        break;
      case 'mines':
        this.mines = m.list;
        break;
      case 'adv':
        this.adv = m.view;
        break;
      case 'zones':
        this.zones = m.list;
        break;
      case 'turtles':
        this.turtles = m.list;
        break;
      case 'supply':
        this.supply = m.view;
        break;
      case 'adv_card':
        this.advCard = m.view;
        break;
      case 'lairs':
        this.lairs = m.view;
        break;
      case 'lair_card':
        this.lairCard = m.card;
        break;
      case 'drifts':
        this.drifts = m.list;
        this.driftsAt = this.estServerTime();
        break;
      case 'roams':
        this.roams = m.list;
        break;
      case 'seafinds':
        this.finds = m.list;
        this.findsAt = this.estServerTime();
        this.findBusy = m.busy;
        break;
      case 'drift_card':
        this.driftCard = m.card;
        break;
      case 'seamarks':
        this.markDone = new Set(m.done);
        this.markBusy = m.busy;
        break;
      case 'tame':
        this.tame = m.view;
        break;
      case 'puzzle':
        this.puzzle = m.view;
        this.puzzleAt = Date.now();
        break;
      case 'caravans':
        this.caravans = m.list;
        this.caravanSlots = m.slots;
        break;
      case 'tattoos':
        this.tattoos = m.view;
        break;
      case 'companion':
        this.companion = m.view;
        break;
      case 'pets':
        this.pets = new Map(m.list.map((x) => [x.ship, x]));
        break;
      case 'petsown':
        this.petsOwn = m.view;
        break;
      case 'regatta':
        this.regatta = m.view;
        break;
      case 'wonders':
        this.wonders = m.view;
        break;
      case 'omen':
        this.omen = m.id;
        break;
      case 'dutchman':
        this.dutchman = m.view;
        break;
      case 'hall':
        this.hall = m.view;
        break;
      case 'storm':
        this.storm = m.view;
        break;
      case 'descent':
        this.descent = m.view;
        break;
      case 'holiday':
        this.holiday = m.view;
        break;
      case 'bazaar':
        this.bazaarShadows = m.shadows;
        break;
      case 'dice':
        this.dice = m.view;
        this.diceAt = performance.now();
        break;
      case 'choice':
        this.choice = m.view;
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
      case 'renown':
        this.renown = m.view;
        break;
      case 'away':
        this.away = m.view;
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
      case 'board_tac':
        this.boardTac = m.view;
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
    this.ownStats = computeShipStats(this.self.loadout, this.self.captain, this.self.talents, this.self.effects, Object.values(this.self.captainGear ?? {}).filter((x): x is Item => !!x), this.self.hero ? { mods: skillSeaMods(this.self.hero.skills) } : null);
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
        s.cur = { ...c, x: c.x + Math.sin(c.h) * c.spd * SPEED_SCALE * dt, y: c.y - Math.cos(c.h) * c.spd * SPEED_SCALE * dt };
      } else if (rt <= a.t) {
        s.cur = a;
      } else {
        const span = Math.max(1e-4, c.t - a.t);
        const t = (rt - a.t) / span;
        // Along a curve, not a broken line: each sample's own heading and speed set the way she leaves it (a cubic
        // Hermite), so a turn is an arc and she never pivots on a corner between two snapshots.
        const t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        const va = a.spd * SPEED_SCALE * span, vc = c.spd * SPEED_SCALE * span;
        const x = h00 * a.x + h10 * Math.sin(a.h) * va + h01 * c.x + h11 * Math.sin(c.h) * vc;
        const y = h00 * a.y - h10 * Math.cos(a.h) * va + h01 * c.y - h11 * Math.cos(c.h) * vc;
        // A jump (a teleport, a respawn) is no curve: straight between the two.
        const jump = Math.hypot(c.x - a.x, c.y - a.y) > Math.max(60, (a.spd + c.spd) * SPEED_SCALE * span * 2);
        s.cur = { ...c, x: jump ? lerp(a.x, c.x, t) : x, y: jump ? lerp(a.y, c.y, t) : y, h: lerpAngle(a.h, c.h, t), spd: lerp(a.spd, c.spd, t), sail: lerp(a.sail, c.sail, t) };
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
    // A racer sails as the regatta lends (docs/12 P10 #5), as the server does.
    const sail = st.flags.has('regatta_equal') ? regattaSail(params) : params;
    const wind = { dir: this.wind[0], strength: this.wind[1] };
    const cur = currentAt(this.currents, s.x, s.y, this.estServerTime(), this.whirlpools);
    const input = { rudder: this.autosail ? you.rud : this.input.rudder, sailTarget: sailSteps[this.input.sail] };
    let t = elapsed;
    while (t > 0) {
      const dt = Math.min(0.05, t);
      s = stepSailing(s, input, sail, wind, cur, dt);
      t -= dt;
    }
    // Smooth toward the predicted state to hide snapshot corrections.
    const d = this.ownDisplay;
    if (!d || Math.hypot(d.x - s.x, d.y - s.y) > 40 * SPEED_SCALE / 2) this.ownDisplay = s;
    else this.ownDisplay = { ...s, x: lerp(d.x, s.x, 0.3), y: lerp(d.y, s.y, 0.3), heading: lerpAngle(d.heading, s.heading, 0.3) };
    return this.ownDisplay;
  }
}
