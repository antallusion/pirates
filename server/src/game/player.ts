// Player session and persistent captain profile, plus progression, reputation and wanted rules.

import { SnapState } from '../../../shared/src/codec.ts';
import { streakView } from './streak.ts';
import { seaRepairView } from './searepair.ts';
import type { Look } from '../../../shared/src/data/looks.ts';
import { HAUNT_NAMES, islandHaunt } from '../../../shared/src/data/minigames.ts';
import { FEATURE_NAMES } from './exploration.ts';
import { STARTING_UNLOCKS, encodeLook } from '../../../shared/src/data/looks.ts';
import type { CompanionRec } from './companion.ts';
import type { ScoutRec } from './fog.ts';
import type { PetId } from '../../../shared/src/data/companions.ts';
import type { NemesisRec } from './nemesis.ts';
import type { TattooProfile } from './tattoos.ts';
import { questAct } from '../../../shared/src/data/questact.ts';
import type { PiracyProfile } from './raiding.ts';
import type { HunterProfile } from './wanted.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { fishingView, sanitizeFishing } from './fishing.ts';
import type { FishingProfile } from './fishing.ts';
import type { CaptainSlot, Item } from '../../../shared/src/data/items.ts';
import type { HearsayKind, Reliability } from '../../../shared/src/data/dealings.ts';
import { sanitizeGear } from './gear.ts';
import type { RefitOrder } from './refit.ts';
import { newTutorial, sanitizeTutorial } from './onboarding.ts';
import type { Tutorial } from './onboarding.ts';
import type { SeasonStat } from '../../../shared/src/data/seasons.ts';
import { newPvp } from './pvp.ts';
import { isColours } from '../../../shared/src/data/colours.ts';
import type { Colours } from '../../../shared/src/data/colours.ts';
import type { PvpState } from './pvp.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import type { QuestDef } from '../../../shared/src/data/quests.ts';
import { OPENING_SLOTS } from '../../../shared/src/data/campaign/build.ts';
import { questPayOf, veteranPay } from '../../../shared/src/data/questpay.ts';
import type { CaptainId } from '../../../shared/src/data/captains.ts';
import { FACTIONS, FACTION_IDS, factionRelation, wantedLevel } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { AMMO_IDS, SHIP_CLASSES, emptyAmmo } from '../../../shared/src/data/ships.ts';
import type { AmmoId } from '../../../shared/src/data/ships.ts';
import type { TalentRanks } from '../../../shared/src/data/talents.ts';
import { totalPointsSpent } from '../../../shared/src/data/talents.ts';
import { MAX_LEVEL, talentPointsForLevel, xpForLevel } from '../../../shared/src/constants.ts';
import { MAX_COUNTED_DEEDS } from '../../../shared/src/data/deeds.ts';
import type { BoardingResult, ClientMsg, Contract, PrivateState, QuestTarget, ResourceSiteView, TradeRunView } from '../../../shared/src/protocol.ts';
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
import { moodOf } from './crewlife.ts';
import { practiceLevel, woundRates } from '../../../shared/src/data/crewtalk.ts';
import type { Profession } from '../../../shared/src/data/crew.ts';
import { escortUpkeep, newFleet } from './fleet.ts';
import type { Fleet } from './fleet.ts';
import { newQuestLog, sanitizeQuests, shipLevelOfQuest, stepProgress } from './quests.ts';
import { newCampaignState, sanitizeCampaign } from '../../../shared/src/data/campaign/progress.ts';
import type { CampaignState } from '../../../shared/src/data/campaign/progress.ts';
import { contractFor } from '../../../shared/src/data/xpcurve.ts';
import { dailyView, newDaily, sanitizeDaily } from './dailies.ts';
import type { DailyState } from '../../../shared/src/data/dailies.ts';
import { sanitizeShipbuilding } from './shipbuilding.ts';
import type { Berth, BuildOrder } from './shipbuilding.ts';
import type { FigureheadId, Plan } from '../../../shared/src/data/shipbuild.ts';
import type { Oath, QuestLog } from './quests.ts';
import { clampLevel, initialLevel, shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import { CLEAN_SLATE_CD, FREE_RESPEC_LEVEL, cleanSlateCost, loadoutSlots } from './progression.ts';
import type { ServiceRec } from './marque.ts';
import type { Skipper } from './turncoats.ts';
import type { SkipperTrait } from '../../../shared/src/data/turncoats.ts';
import type { OfficerRole, TraitId } from '../../../shared/src/data/crew.ts';
import type { SagaEntry } from '../../../shared/src/data/saga.ts';
import type { LogEntry } from '../../../shared/src/data/captainlog.ts';
import type { RenownProfile } from './renown.ts';
import { armyFromSave, armySlots } from '../../../shared/src/data/army.ts';
import type { ArmyStack } from '../../../shared/src/data/army.ts';
import { heroOf, heroView } from './hero.ts';
import type { HeroRec } from './hero.ts';
import type { AdvProfile } from './advmap.ts';
import type { LairProfile } from './beastlairs.ts';
import type { TameProfile } from './tame.ts';
import type { DriftProfile } from './drifts.ts';
import { addGlory, gloryView } from './throne.ts';
import { gloryXp } from '../../../shared/src/data/throne.ts';
import type { ThroneRec } from './throne.ts';
import type { RelicRec } from './relics.ts'; // docs/19 E12
import type { InvasionView } from '../../../shared/src/data/invasions.ts'; // docs/19 E16
import type { SealRec, SealView } from '../../../shared/src/data/seals.ts';
import type { RaidView } from '../../../shared/src/data/abyssraid.ts';
import { hullXp, researchView } from './research.ts';
import type { ResearchView } from '../../../shared/src/data/research.ts';

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
  /** The fighting men as stacks (docs/17 H1); their sum is `crew`. Absent in a save from before them. */
  army?: ArmyStack[];
  morale: number;
  sanity: number;
  company: Company;
  fleet: Fleet;
  quests: QuestLog;
  /** Owner, 2026-10-28 (islefirst.ts): the island's first build — its step and the governor's help. */
  isleFirst?: import('./islefirst.ts').IsleFirst;
  /** docs/36: her place in the main campaign (sanitizeProfile fills it: a save of before it is migrated by her level). */
  campaign?: CampaignState;
  /** Her guards hired at sea, kept across a restart or a relog (seahire.ts). */
  seaHire?: import('../../../shared/src/data/seahire.ts').SavedHire[];
  /** Today's three orders and the days in a row (docs/11 P6). */
  daily: DailyState;
  /** The list of friends (docs/11 P6): account and name as last seen. */
  friends?: { id: number; name: string }[];
  /** Captains one does not hear (chat, whispers, invitations). */
  ignored?: { id: number; name: string }[];
  /** Rest ashore (docs/11 P6): the pool of doubled battle experience, and when and where the captain went ashore. */
  rested?: number;
  /** Ships sunk or taken in a row since she last made port (docs/16 #4). */
  streak?: number;
  ashoreAt?: number;
  ashoreInPort?: boolean;
  paths: CaptainId[]; // Paths this captain may take up at a Captain's House
  pathSwitchAt: number;
  oath: Oath | null; // the Code or a letter of marque
  /** «Абордаж: выкл» (docs/24 C1): her ship boards nobody and is boarded by nobody; set in port. */
  noBoard?: boolean;
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
  /** The fog of war (owner, 2026-10-17; fog.ts): the sea's kilometre squares she has seen, base64 bits. Absent in a save
   *  from before it: made from what she knew at her next start. */
  fog?: string;
  /** Her island's scouts (fog.ts) and the last scout's number. */
  scouts?: ScoutRec[];
  scoutSeq?: number;
  regionsSeen: string[];
  stats: { sunk: number; boarded: number; tradeProfit: number; distance: number; sold: number; fogContraband: number; harpoonContracts: number; /** captains guided through quests (docs/11 P6) */ mentored?: number; /** men signed on at a tavern or a dwelling (docs/17 H5: the First Watch) */ recruited?: number };
  cooldowns: Record<string, number>;
  insured: boolean;
  priceIntel: Record<string, { t: number; sell: Partial<Record<GoodId, number>>; dear?: GoodId[]; cheap?: GoodId[]; heard?: boolean;
    /** The rest of the board she saw (the port card, portinfo.ts): her buying price, the stock, the trend, and the price
     *  period it was seen in (priceseason.ts). */
    buy?: Partial<Record<GoodId, number>>; stock?: Partial<Record<GoodId, number>>; trend?: Partial<Record<GoodId, number>>; period?: number }>;
  costBasis: Partial<Record<GoodId, number>>;
  sightings: { name: string; kind: string; x: number; y: number; t: number }[];
  chartSales: Record<string, number[]>; // port id -> island ids whose charts that port already bought
  chartsBought: number[]; // bought or heard-of islands: not resellable
  explored: Record<string, number>; // 'islandId:feature' -> world time last worked
  curse: number;
  stolen: Partial<Record<GoodId, number>>;
  licences: Partial<Record<FactionId, number>>;
  warehouses: Record<string, Cargo>;
  /** Her own stock of the harbours' goods (owner, 2026-10-22; ownstock.ts): `port|good` → [stock in her units, world
   *  time it was set]; only the goods she traded and only while they differ from the port's own (absent: the port's). */
  ownStock?: Record<string, [number, number]>;
  /** What she bought in a port lately ('port|good' → [units, silver a unit, world time]): sold back there, it fetches
   *  no more than SAME_PORT_BACK of what she paid — no buy-low-sell-high in one port (priceseason.ts). */
  boughtHere?: Record<string, [number, number, number]>;
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
  /** The Admiralty's first refit (⚓1→⚓2, docs/30) is spent. */
  admRefit?: boolean;
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
  /** Free speed-up tokens for the island's builders (docs/15 item 2): the daily welcome and the daily orders. */
  speedups?: number;
  /** When she last gave up an island of her own (docs/15 item 6: another is claimed after a wait), wall ms. */
  isleLeftAt?: number;
  /** docs/29: islands of her own claimed so far (the first is free, the next is a move: one free, then paid). */
  isleClaims?: number;
  /** The yard's tree of hulls (docs/20): the experience each hull has earned, the free pool, the hulls researched.
   *  Absent in a save from before it (research.ts fills it from what her level already let her buy). */
  research?: ResearchView;
  /** The White Orca's calf in her wake (docs/12 P10 #2) and the ship's pets (#3). */
  companion?: CompanionRec | null;
  pets?: { owned: PetId[]; deck: PetId | null };
  /** The named pirates who hold a grudge against her, and the heads of those she settled with (docs/12 P10 #1). */
  nemeses?: Record<string, NemesisRec>;
  nemesisHeads?: number;
  /** Hearts of the storm caught and not yet forged or built into a keel (docs/12 P10 #14). */
  stormHearts?: number;
  /** A letter of marque: the service, merit, rank, pay and order (docs/12 P10 #15); no service before this time. */
  service?: ServiceRec | null;
  serviceBan?: number;
  /** Turned captains who skipper her caravans (docs/12 P10 #16). */
  skippers?: Skipper[];
  /** Her saga's chapters (docs/12 P10 #20). */
  saga?: SagaEntry[];
  /** The captain's log: the last few days, line by line (docs/16 #20). */
  log?: LogEntry[];
  /** A cartographer's fame: her buried chests dug up by others (docs/12 P10 #7). */
  cartoFame?: number;
  /** Batch E of docs/16: the lookouts she has climbed (island → world time) and the banks the tide raised that she
   *  has combed (bank → which rise). */
  isles?: { lookouts: Record<string, number>; tides: Record<string, number> };
  /** docs/18 #31: the turtle islands whose backs she has combed (turtle → which rise). */
  isle18?: { turtles: Record<string, number> };
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
  /** docs/16 Batch F: careers, feats, the album, the week's titles, the welcome back (renown.ts). */
  renown?: RenownProfile;
  /** docs/16 Batch C: the merchants' runs, the whispers paid for, the auction's pieces waiting for room. */
  dealings?: Dealings;
  /** The captain as a HoMM3 hero (docs/17 H2, hero.ts): primaries, skills, the order book, her will. */
  hero?: HeroRec;
  /** docs/17 H4: the adventure map — her visits, what she has seen, the altars' points, the Grail's hunt. */
  adv?: AdvProfile;
  /** docs/18 II: the lairs of the land's creatures — her spoils by week, what she has seen, the land's resources,
   *  the eggs she carries, the chains she has cleared. */
  lairs?: LairProfile;
  /** docs/18 IV: her creatures — their wins and hunger kind by kind; the drifts she has saved. */
  tame?: TameProfile;
  drift?: DriftProfile;
  /** The dense sea's marks she has worked, by id, and when (real milliseconds): each is hers again a day after. */
  seaMarks?: Record<string, number>;
  /** seaux (2026-10-11): her own wreckage she took, by spot, and when (real milliseconds): each hers again 48 hours on. */
  wrecks?: Record<string, number>;
  /** owner 2026-10-20: when she last scuttled her ship herself (real milliseconds; a ten-minute wait). */
  scuttledAt?: number;
  /** docs/19 E1–E3: her glory past the cap, her mastery tree, her trials of mastery (throne.ts). */
  throne?: ThroneRec;
  /** docs/25 item 38: the facets of her abilities she has chosen («ability@rank» → a | b; shared/src/data/seaskill.ts). */
  facets?: Record<string, 'a' | 'b'>;
  /** docs/19 E9: her seal of the deep (seals.ts). */
  seal?: SealRec;
  /** docs/19 E12: her relics — assembled now, ever assembled, the parts the drops gave her (relics.ts). */
  relics?: RelicRec;
  /** docs/19 E10: the titans she hired at the Grail this week (titans.ts). */
  titans?: { week: number; n: number };
  /** docs/19 D1–D5: her day's finds at their full worth by source, and her seconds at sea that day (seahaul.ts). */
  seaHaul?: { day: number; sec: number; n: Partial<Record<string, number>>; told?: Partial<Record<string, number>> };
  /** docs/19 D5: the small things of the sea she has had, by kind (for her log and the tests). */
  seaFinds?: Partial<Record<string, number>>;
  /** docs/19 D7: the roaming stacks she has beaten (for her log and the tests). */
  roamWins?: number;
  /** Her rest from the stacks she beat (owner, 2026-10-16): a stack's id → the wall-clock ms she may fight it again. */
  roamRest?: Record<string, number>;
}

export interface Dealings {
  runs: TradeRunView[];
  /** The next leg of a chain, waiting at the port she delivered to (its `deadline` is when the offer lapses). */
  next: TradeRunView | null;
  hearsay: Hearsay[];
  /** Pieces won at auction, or her own unsold, while her locker is full. */
  held: Item[];
}

/** A whisper she paid for (docs/16 #14); `truth` is hers to find out. */
export interface Hearsay {
  id: string;
  kind: HearsayKind;
  reliability: Reliability;
  truth: boolean;
  x: number;
  y: number;
  r: number;
  heading?: number;
  speed?: number;
  name: string;
  islandId?: number;
  shipId?: number;
  /** She has been told a true cache is there (once). */
  told?: boolean;
  t: number;
  expiresAt: number;
}

/** The campaign's opening (owner, 2026-10-19): the step the client's guide points the newcomer through — a shop
 *  (`buy:<shop>`), `sink`, `board`, `neutral`, `found` — or null past the opening. */
export function openingStep(def: QuestDef, step: number): string | null {
  if (def.kind !== 'campaign' || (def.campaign?.slot ?? OPENING_SLOTS) >= OPENING_SLOTS) return null;
  const st = def.steps[step];
  if (!st) return null;
  if (st.type === 'buy') return `buy:${st.shop}`;
  if (st.type === 'claim') return 'found';
  return st.type === 'sink' || st.type === 'board' || st.type === 'neutral' ? st.type : null;
}

/** A campaign quest's step after the opening that is done at sea by a button of the bar: its finger (client pointer.ts
 *  `go:<does>`) — the newcomer's run of 2026-10-23 stood by a pirate 40 m off with «Атаковать» lit and no finger. */
export function storyStep(def: QuestDef, step: number): 'sink' | 'board' | 'neutral' | 'land' | null {
  if (def.kind !== 'campaign' || openingStep(def, step)) return null;
  const t = def.steps[step]?.type;
  if (t === 'sink' || t === 'board' || t === 'neutral') return t;
  if (t === 'named' || t === 'beast') return 'sink';
  if (t === 'prize') return 'board';
  // (a wreck dived: «Ныряльщики» is the land key's button too — c01_20 stood with it lit and no finger)
  if (t === 'lair' || t === 'land' || t === 'dive') return 'land';
  return null;
}

export function dealings(p: Profile): Dealings {
  const d = (p.dealings ??= { runs: [], next: null, hearsay: [], held: [] });
  d.runs ??= [];
  d.next ??= null;
  d.hearsay ??= [];
  d.held ??= [];
  return d;
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
  // A plain drift net in the tackle slot from the first day (owner, 2026-09-29): a new captain can work a shoal at once.
  const loadout: ShipLoadout = { classId: c.start.ship, name: shipName, guns: { port: c.start.gun, starboard: c.start.gun }, modules: {}, gear: { tackle: { uid: 1, base: 'drift_net', ilvl: 1, rarity: 0, affixes: [], dur: 100 } } };
  const reputation: Partial<Record<FactionId, number>> = {};
  for (const f of FACTION_IDS) reputation[f] = 0;
  if (captain === 'drowned') reputation.crown = -15;
  if (captain === 'admiral') reputation.crown = -25;
  return {
    version: 1, captain, pvp: newPvp(), shipName, level: 1, xp: 0, talents: {}, gold: c.start.gold, infamy: 0, reputation, loadout,
    cargo: { ...c.start.cargo }, ammo: { ...emptyAmmo(), round: 60, chain: 20, grape: 20 }, ammoSel: 'round', crew: c.start.crew, morale: 80, sanity: 100, company: newCompany(captain, c.start.crew), crewAmbush: 0, fleet: newFleet(), exotic: {}, salvageDay: -1, builds: [], plans: [], berths: [], figureheads: [], stash: [], captainGear: {}, itemSeq: 2, fishing: { skill: 1, xp: 0, caught: {}, traps: [], netGiven: true }, hunter: { points: 0, captains: 0, seas: {} }, piracy: { fame: 0, honour: 0, tributes: 0, convoys: 0 }, quests: newQuestLog(), campaign: newCampaignState(), daily: newDaily(), paths: [captain], pathSwitchAt: -1e9, oath: null,
    hull: -1, sails: -1, rudderHp: 1, gunsDisabled: { port: 0, starboard: 0 }, lastPort: startPort, docked: startPort,
    contracts: [], discovered: [], regionsSeen: [], stats: { sunk: 0, boarded: 0, tradeProfit: 0, distance: 0, sold: 0, fogContraband: 0, harpoonContracts: 0 }, cooldowns: {},
    insured: false, priceIntel: {}, costBasis: {}, sightings: [], chartSales: {}, chartsBought: [], explored: {}, stolen: {}, licences: {}, warehouses: {}, forwards: [], bank: 0, loan: null, policy: null, claims: [], deeds: [], deedState: { region: '', crossing: '', blackStorm: 0, wantedTime: 0, voyagePorts: [] }, tokens: 0, tokenLevels: [], cleanSlates: [], loadouts: [{}], activeLoadout: 0, loadoutSwitchAt: 0, talentCooldowns: {}, captives: [], blueprints: [], trophies: [], bossKills: {}, bossLocks: {}, pressure: 0, ritualShards: 0, chapters: [], season: { id: -1, xp: 0, level: 0, stats: {} }, titles: [], title: null, pennants: [], pennant: null, nameRights: 0, pantheon: [], tutorial: newTutorial(false, 0), explore: { maps: [], fragments: 0, dived: {}, rumorDay: -1, tavernDeals: [], hoardAboard: false }, keel: null, trade: newTradeState(), smuggle: { stamped: {}, coves: [], brokerPassUsed: false, hotRun: null }, curse: captain === 'drowned' ? 30 : 0, createdAt: now,
  };
}

export class PlayerSession {
  readonly conn: GameConn;
  accountId = 0;
  name = '';
  /** Would rather fight boardings round by round than turn by turn (docs/16 P4). */
  classicBoarding = false;
  /** Owner, 2026-10-16: sets her stacks before a boarding's first round (HoMM3's tactics phase); off: as they stand. */
  deployStacks = true;
  /** The captain's gunnery (docs/23 items 35, 42, 46): her gun captains fire as the mark bears; a mark two levels down
   *  is settled by itself; the expert's hand keeps the held broadsides and the chasers to herself. */
  autoFire = false;
  autoWeak = false;
  expert = false;
  token = '';
  profile: Profile | null = null;
  chartedCache = { region: '', size: -1, full: false };
  ship: ShipEntity | null = null;
  knownEntities = new Set<number>();
  /** Delta snapshots: what this client last received for each entity, and when. */
  sentRows = new Map<number, { key: string; t: number; h?: boolean }>();
  /** The snapshot codec's per-connection base (codec v7: rows go out as field deltas against it). */
  snapBase = new SnapState();
  /** The lookout's cries: when each notable ship was last cried (game seconds; not saved). */
  sightCries = new Map<string, number>();
  snapCount = 0;
  /** Ticks between this captain's snapshots: 2 (10 Hz), or 4 in a crowd; and the last tick of events sent. */
  snapEvery = 2;
  lastEvTick = 0;
  knownChunks = new Set<number>();
  discovered = new Set<number>();
  msgWindowStart = 0;
  msgCount = 0;
  /** The last refusal told her and when (game seconds): the same words are not told again at once (Game.refuse). */
  lastRefusal: { msg: string; at: number } | null = null;
  /** An order that waits for the shot to stop or for her to lie still (Game.holdOrder): given again the moment she is
   *  clear (no ship's fire on her, and no more way on her than `way`), until `until`. */
  whenClear: { msg: ClientMsg; until: number; way?: number } | null = null;
  /** The helm's sail step she last sent, and the one she held when an order took in sail for her: while the helm keeps
   *  sending that step she stays hove to; her own hand on the sheets (another step) takes them back. */
  lastSail = -1;
  sailHold: number | null = null;
  /** `at`: when the spoils came to her (the quartermaster shares them out by himself after Game.BOARD_SETTLE_SECS). */
  pendingBoarding: { result: BoardingResult; targetId: number; at?: number } | null = null;
  /** A job offered and not yet answered, open for a while (docs/11 P6): by an island's people on the beach, or
   *  shared by a groupmate. */
  questOffer: { id: string; until: number; island?: number; from?: string } | null = null;
  lastPortPush = 0;
  lastSave = 0;
  disconnectedAt: number | null = null;
  lingerUntil = 0;
  lastRegion = '';
  landable: { island: string; feature: string; action?: 'dig' | 'dive' | 'expedition' | 'raise' | 'descent' | 'escort' | 'keeper' | 'lair'; blocked?: string; /** docs/18 #28 */ lv?: number; danger?: 'warn' | 'deadly' } | null = null;
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
  return talentPointsForLevel(p.level) + Math.min(p.deeds.length, MAX_COUNTED_DEEDS) + (p.adv?.pts ?? 0) - totalPointsSpent(p.talents);
}

/** Adds XP, handles level-ups. Returns number of levels gained. */
export function addXp(p: Profile, amount: number): number {
  hullXp(p, amount); // the hull she sails learns what the captain does (docs/20)
  if (p.level >= MAX_LEVEL) {
    addGlory(p, amount); // docs/19 E1: past the cap, experience is glory
    return 0;
  }
  p.xp += Math.max(0, Math.round(amount));
  let gained = 0;
  while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    gained++;
  }
  if (p.level >= MAX_LEVEL) {
    addGlory(p, p.xp); // what is left past the cap goes on into glory (docs/19 E1)
    p.xp = 0;
  }
  return gained;
}

// ------------------------------------------------------------------ reputation & law

/** How low a faction's friends' (or enemies') standing falls by what she did to it — never as far as their enemy (−50). */
export const SPILL_FLOOR = -40;

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
    // Playthrough C: a faction's friends think less of her for what she did to it, but only her own deeds against them
    // make her their enemy. Each pirate of the Confederacy sunk took 0.54 off the Free Harbors and 0.72 off the Brokers:
    // a captain of level 42 who had hunted the pirates her quests asked for was refused by 77 of the 107 harbours of the
    // ⚓6–9 waters (the Free Harbors, the Confederacy and the Brokers all at −98…−100).
    if (f !== faction && d < 0) next = Math.max(next, Math.min(cur, SPILL_FLOOR));
    p.reputation[f] = Math.max(-100, Math.min(100, next));
  }
}

export function canDock(p: Profile, faction: FactionId): { ok: boolean; reason?: string } {
  const w = wantedLevel(p.infamy);
  const def = FACTIONS[faction];
  if (faction === 'crown' && (p.talents.smg_nobodys_ship ?? 0) > 0) return { ok: false, reason: 'The Crown does not moor a ship with no name and no flag.' };
  // (with the way out told: a campaign's port refused her and nothing said how to come back — mid-game QA 2026-10-23)
  if (w > def.dockMaxWanted) return { ok: false, reason: `${def.short} harbour masters refuse ships at Wanted ${w}: buy a pardon in a free harbour, or let the sea forget.` };
  // (the name carries its own article: «The The Red Tide Confederacy considers you an enemy», docs/30)
  if ((p.reputation[faction] ?? 0) <= -50) return { ok: false, reason: `${def.name} considers you an enemy.` };
  return { ok: true };
}

export function pardonCost(p: Profile): number {
  return Math.round(p.infamy * 18 + p.level * 40);
}

export interface WorldView {
  /** docs/36: her place in the main campaign (campaign.ts campaignView). */
  campaign?: import('../../../shared/src/protocol.ts').CampaignView;
  /** docs/19 E9: her seal of the deep, for the Throne's tab (seals.ts sealView). */
  seal?: SealView;
  /** docs/19 E11: her raid of the Abyss, for the Throne's tab (abyssraid.ts raidView). */
  raid?: RaidView;
  /** docs/19 E4–E8: the citadels and the Throne war, for the Throne's tabs (citadels.ts citView). */
  cit?: import('../../../shared/src/data/citadels.ts').CitView;
  /** docs/19 E15: the Admiralty's contracts of the week (admiralty.ts admView). */
  adm?: import('../../../shared/src/data/admiralty.ts').AdmView;
  /** docs/19 E14: the Colosseum, for the Throne's tab (arena.ts arenaView). */
  arena?: import('../../../shared/src/data/arena.ts').ArenaView;
  /** One's own island (docs/15). */
  homeIsle?: number | null;
  /** Raiders at her island (docs/15 item 7), and a wild island off the bow she may claim (item 6). */
  isleRaid?: PrivateState['isleRaid'];
  claimIsle?: PrivateState['claimIsle'];
  coves: { id: number; name: string; x: number; y: number }[];
  patrols: [number, number][];
  fleet?: PrivateState['fleet'];
  inspect?: PrivateState['inspect'];
  monsters?: PrivateState['monsters'];
  explore?: Pick<PrivateState, 'maps' | 'legendEcho' | 'wrecks' | 'trails' | 'soundings' | 'forecast' | 'goldTrails'>;
  abyss?: PrivateState['abyss'];
  pvp?: PrivateState['pvp'];
  /** Where each active quest's current step points (a port, an island, a region's middle). */
  questTargets?: Record<string, QuestTarget>;
  /** The sea's common cause today and this captain's part in it (docs/11 P6). */
  common?: PrivateState['common'];
  /** docs/19 E16: the Choir's invasion and the black tides (invasions.ts invasionView). */
  invasion?: InvasionView;
  /** Groupmates on the same quests: quest id → their names and steps (docs/11 P6). */
  questMates?: Record<string, { name: string; step: number }[]>;
  /** What each active quest pays her at her level now (docs/26). */
  questXp?: Record<string, number>;
  /** Her letter of marque (docs/12 P10 #15). */
  service?: PrivateState['service'];
  /** What each captive would make if turned, and his loyalty now (docs/12 P10 #16). */
  captives?: { name: string; role?: OfficerRole; level?: number; traits?: TraitId[]; skills?: SkipperTrait[]; loyalty?: number; turnCost?: number; tried?: boolean }[];
}

export function toPrivateState(s: PlayerSession, now: number, world: WorldView = { coves: [], patrols: [] }): PrivateState {
  const p = s.profile!;
  const ship = s.ship;
  return {
    accountId: s.accountId,
    name: s.name,
    title: p.title,
    pvp: world.pvp ?? { flag: p.pvp.flag, blackFlag: p.pvp.flag === 'pirate', city: p.pvp.city ?? 'free', guild: null, next: p.pvp.next, nextAt: p.pvp.nextAt, noNeutral: null, noBoard: !!p.noBoard, pennant: false, pennantHoursLeft: 0, shameUntil: p.pvp.shameUntil, bubbleUntil: p.pvp.bubbleUntil, rating: p.pvp.rating, duels: p.pvp.duels, duelWins: p.pvp.duelWins, bounty: 0, hunter: false, sunkBy: [], challenges: [] },
    captain: p.captain,
    level: p.level,
    // docs/19 E1: past the cap the bar is her glory's.
    xp: p.level >= MAX_LEVEL ? Math.floor(p.throne?.xp ?? 0) : p.xp,
    xpNext: p.level >= MAX_LEVEL ? gloryXp(p.throne?.rank ?? 0) : xpForLevel(p.level),
    glory: gloryView(now, s, world.seal, world.raid, world.arena),
    ...(world.cit ? { cit: world.cit } : {}),
    ...(world.adm ? { adm: world.adm } : {}), // docs/19 E15
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
    homeIsle: world.homeIsle ?? null,
    isleRaid: world.isleRaid ?? null,
    claimIsle: world.claimIsle ?? null,
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
      // A job pays a veteran more (quests.ts completeQuest): the journal shows what the board offered, not the bare sum
      // (the board said 307 and the journal 286 for one job).
      const vet = def.kind === 'job' ? veteranPay(p.level, def.requires.level ?? 1) : 1;
      const paid = q.pay ? questPayOf(q.pay, def.reward.silver, def.requires.level ?? 1) : null;
      return {
        id: q.id, name: def.name, kind: def.kind, mentor: def.mentor, step: q.step + 1, steps: def.steps.length, text: st?.text ?? '', progress: st?.progress ?? 0, need: st?.need ?? 1, ...(target ? { target } : {}),
        // For the journal (docs/11 P6): the giver's words, every step, the pay and the face.
        summary: def.summary, stepTexts: def.steps.map((x) => x.text), silver: Math.round(def.reward.silver * vet), xp: world.questXp?.[q.id] ?? def.reward.xp, ...(q.fastUntil && q.fastUntil > now ? { fastIn: Math.round(q.fastUntil - now) } : {}), ...(def.portrait ? { portrait: def.portrait } : {}), ...(def.category ? { category: def.category } : {}),
        ...(q.pay && paid ? { pay: q.pay, paid: { ...paid, silver: Math.round(paid.silver * vet) } } : {}),
        ...(world.questMates?.[q.id] ? { mates: world.questMates[q.id] } : {}),
        ...((lv) => (lv ? { ship: lv } : {}))(shipLevelOfQuest(def)),
        ...((o) => (o ? { op: o } : {}))(openingStep(def, q.step)),
        ...((a) => (a ? { act: a } : {}))(questAct(def.steps[q.step])),
        ...((d) => (d ? { does: d } : {}))(storyStep(def, q.step)),
      };
    }),
    questsDone: p.quests.done,
    ...(world.campaign ? { campaign: world.campaign } : {}),
    questsRecent: p.quests.done.slice(-10).reverse().map((id) => QUESTS_BY_ID[id]?.name).filter((n): n is string => !!n),
    daily: dailyView(p),
    common: world.common ?? null,
    invasion: world.invasion, // docs/19 E16
    paths: p.paths,
    oath: p.oath,
    pathSwitchAt: p.pathSwitchAt,
    builds: p.builds.map((b) => ({ id: b.id, port: b.port, classId: b.classId, name: b.name, done: b.done, start: b.start, frame: b.build.frame, plank: b.build.plank, quality: b.build.quality })),
    plans: p.plans.map((x) => ({ id: x.id, classId: x.classId, quality: x.quality, variants: x.variants, uses: x.uses })),
    berths: p.berths.map((b) => ({ port: b.port, name: b.loadout.name, classId: b.loadout.classId, hull: Math.round(b.hull * 100), ...(b.loadout.trophy ? { trophy: b.loadout.trophy } : {}) })),
    research: researchView(p),
    streak: streakView(p),
    figureheads: p.figureheads,
    fleet: world.fleet ?? { escorts: [], slots: 0, formation: p.fleet.formation, upkeep: 0 },
    inspect: world.inspect ?? [],
    monsters: world.monsters ?? [],
    appraisal: ship?.hasFlag('appraiser') ? appraise(p) : null,
    captives: p.captives.map((c) => ({ name: c.name, faction: c.faction, ransom: captiveRansom(c, (ship?.rank('trd_prize_broker') ?? 0) > 0), ...(world.captives?.find((x) => x.name === c.name) ?? {}) })),
    skippers: p.skippers ?? [],
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
    service: world.service ?? null,
    saga: p.saga ?? [],
    log: p.log ?? [],
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
    contracts: p.contracts.map((c) => contractFor(p.level, c)),
    cooldowns: p.cooldowns,
    facets: p.facets ?? {}, // docs/25 item 38
    repairing: ship?.repairing ?? false,
    curse: Math.round(ship ? ship.curse : p.curse),
    stolen: p.stolen,
    licences: p.licences,
    sites: s.siteViews,
    warehouses: p.warehouses,
    landable: s.landable,
    landing: ship?.landing ? { island: String(ship.landing.islandId), feature: ship.landing.feature, name: landingName(ship.landing.feature, ship.landing.islandId), until: ship.landing.until, started: ship.landing.started } : null,
    discoveredCount: s.discovered.size,
    intel: Object.entries(p.priceIntel).map(([portId, rec]) => ({
      portId,
      t: rec.t,
      // Only Market Sense turns a remembered visit into usable price knowledge on the chart.
      top: ship?.hasFlag('market_sense')
        ? (Object.entries(rec.sell) as [GoodId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3)
        : [],
      // What is dear and what is cheap there (docs/16 #11), for every captain.
      ...(rec.dear?.length ? { dear: rec.dear } : {}),
      ...(rec.cheap?.length ? { cheap: rec.cheap } : {}),
      ...(rec.heard ? { heard: true } : {}),
    })),
    ...(p.dealings?.runs.length ? { runs: p.dealings.runs } : {}),
    ...(p.dealings?.hearsay.length ? { hearsay: p.dealings.hearsay.map(({ truth: _t, islandId: _i, shipId: _s, told: _d, ...v }) => v) } : {}),
    ...(ship ? { seaRepair: seaRepairView(ship) } : {}),
    sightings: p.sightings,
    stats: p.stats,
    protectedUntil: ship?.protectedUntil ?? 0,
    insured: p.insured,
    policy: p.policy?.tier ?? null,
    effects: ship ? ship.effects.filter((e) => e.mods || e.flags).map((e) => ({ id: e.id, until: e.until, mods: e.mods, flags: e.flags })) : [],
    forwards: p.forwards.map((f) => ({ ...f, fromName: f.fromPort, toName: f.toPort })),
    bank: p.bank,
    loan: p.loan,
    hero: heroView(p, ship?.army),
  };
}

export function sanitizeProfile(raw: Profile): Profile {
  // Defensive load: fill fields added in later versions and clamp obviously broken values.
  const p = raw;
  p.talents ??= {};
  // The colours (docs/24): a save from before them flies her city's (her faction's; a young one under the Green Pennant
  // as before), the Black Flag the pirate flag; boarding on.
  const old = (p.pvp ?? {}) as Partial<PvpState> & { blackFlag?: boolean };
  const flag: Colours = isColours(old.flag) ? old.flag : old.blackFlag ? 'pirate' : 'faction';
  p.pvp = { ...newPvp(), ...old, flag };
  delete (p.pvp as { blackFlag?: boolean }).blackFlag;
  if (!isColours(p.pvp.next)) p.pvp.next = null;
  p.noBoard = !!p.noBoard;
  p.reputation ??= {};
  p.contracts ??= [];
  p.discovered ??= [];
  p.regionsSeen ??= [];
  if (typeof p.fog !== 'string') delete p.fog;
  p.scouts = Array.isArray(p.scouts) ? p.scouts.filter((x) => x && typeof x.id === 'string' && typeof x.ready === 'number' && (!x.route || (Array.isArray(x.route) && x.route.length >= 4))).slice(0, 3) : [];
  p.cooldowns ??= {};
  p.priceIntel ??= {};
  if (!p.ownStock || typeof p.ownStock !== 'object') delete p.ownStock;
  else for (const k in p.ownStock) { const e = p.ownStock[k]; if (!Array.isArray(e) || !Number.isFinite(e[0]) || !Number.isFinite(e[1])) delete p.ownStock[k]; }
  p.costBasis ??= {};
  p.sightings ??= [];
  p.chartSales ??= {};
  p.chartsBought ??= [];
  p.explored ??= {};
  p.curse ??= 0;
  sanitizeCompany(p);
  p.fleet ??= newFleet();
  p.exotic ??= {};
  p.campaign = sanitizeCampaign(p.campaign, p.level ?? 1, p.quests?.done ?? []); // docs/36 (before the quests: a stale one is let go)
  sanitizeQuests(p);
  sanitizeDaily(p);
  p.friends = (p.friends ?? []).filter((f) => f && typeof f.id === 'number' && typeof f.name === 'string').slice(0, 50);
  p.ignored = (p.ignored ?? []).filter((f) => f && typeof f.id === 'number' && typeof f.name === 'string').slice(0, 50);
  sanitizeShipbuilding(p);
  // Ship levels (canon D12): a ship from before them comes at her class's first level, one more if nearly all fitted.
  for (const l of [p.loadout, ...(p.berths ?? []).map((b) => b.loadout)]) if (l) l.level = l.level ? clampLevel(l.classId, l.level) : initialLevel(l.classId, l.modules ?? {});
  p.refit ??= null;
  // The army (docs/17 H1): a save from before the stacks takes the ladder's spread of her level.
  p.army = armyFromSave(p.army, p.crew, shipLevelOf(p.loadout), armySlots(SHIP_CLASSES[p.loadout.classId]?.tier ?? 1));
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
  heroOf(p); // docs/17 H2: a captain from before the heroes grown from her level
  return p;
}

function companyView(p: Profile, ship: ShipEntity | null, now: number): PrivateState['company'] {
  const c = p.company;
  return {
    army: ship ? ship.army.map((x) => ({ ...x })) : (p.army ?? []).map((x) => ({ ...x })),
    armySlots: ship ? ship.armySlots : armySlots(SHIP_CLASSES[p.loadout.classId]?.tier ?? 1),
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
    practice: Object.fromEntries(Object.entries(c.practice ?? {}).map(([k, v]) => [k, Math.floor(v)])) as Record<Profession, number>,
    wounded: woundedView(p, ship),
    mood: moodOf(ship, now),
    shantyUntil: Math.round(ship?.effects.find((e) => e.id === 'shanty')?.until ?? 0),
  };
}

/** The wounded below and what the surgeon can do for them (docs/16 #19). */
function woundedView(p: Profile, ship: ShipEntity | null): NonNullable<PrivateState['company']['wounded']> {
  const c = p.company;
  const n = ship ? ship.wounded : c.wounded ?? 0;
  const surgeons = c.pools.surgeon ?? 0;
  const medicine = Math.floor((ship ? ship.cargo.medicine : p.cargo.medicine) ?? 0);
  const r = woundRates(n, surgeons, medicine >= 1, practiceLevel(c.practice?.surgeon ?? 0));
  return { n, surgeons, medicine, healPerMin: Math.round(r.healPerMin * 10) / 10, diePerMin: Math.round(r.diePerMin * 10) / 10 };
}

/** What her boats are at, by name for the screens (late-game QA 2026-10-23: the bar's «у цели «wreck»» — the feature's
 *  id, not its name, went out, and no tongue has a word for an id). */
const LANDING_WORDS: Record<string, string> = { tidal: 'bared bank', dig: 'buried treasure', dive: 'the wreck below', haul: 'your stockpile', turtle: 'the turtle’s back', flag: 'the mine’s flag' };
export function landingName(feature: string, islandId: number): string {
  if (feature === 'scene') return HAUNT_NAMES[islandHaunt(islandId)][0];
  return LANDING_WORDS[feature] ?? (FEATURE_NAMES as Record<string, string>)[feature] ?? feature.replace(/_/g, ' ');
}
