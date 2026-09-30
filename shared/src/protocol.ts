// Wire protocol (JSON over WebSocket, version-gated). The client only ever sends *intents*
// (inputs, requests). Every outcome — damage, gold, cargo, xp — is computed and pushed by the server.
// Snapshot entity rows are positional arrays to keep packets small; see docs/04_TECHNICAL_ARCHITECTURE.md
// for the planned binary encoding.

import type { RequestKind } from './data/fates.ts';
import type { OmenId } from './data/omens.ts';
import type { CareerId, SetId, WeeklyKind } from './data/renown.ts';
import type { WonderKind } from './data/wonders.ts';
import type { HarnessId, PetId } from './data/companions.ts';
import type { NemesisCause } from './data/nemesis.ts';
import type { CaravanTask, OnAttack } from './data/caravans.ts';
import type { OutpostKind } from './data/estate.ts';
import type { OwnRole } from './data/baseships.ts';
import type { BeastId } from './data/beasts.ts';
import type { FishId, FishMethod } from './data/fishing.ts';
import type { HappeningKind } from './data/happenings.ts';
import type { EncounterId, SightKind } from './data/encounters.ts';
import type { MinigameId } from './data/minigames.ts';
import type { TrekPath } from './data/isles.ts';
import type { CaptainSlot, Item, Slot } from './data/items.ts';
import type { OrderKind, ServiceId } from './data/marque.ts';
import type { SkipperTrait } from './data/turncoats.ts';
import type { BoonId, CurrentId, DarkId, HostId } from './data/descent.ts';
import type { HolidayId } from './data/holidays.ts';
import type { SagaEntry } from './data/saga.ts';
import type { LogEntry } from './data/captainlog.ts';
import type { TalkEvent } from './data/crewtalk.ts';
import type { OfficerRole, Profession, TraitId } from './data/crew.ts';
import type { FigureheadId, PlanQuality, RareSlot, VariantId, WoodId } from './data/shipbuild.ts';
import type { BuildingId, IslandSize } from './data/holdings.ts';
import type { CaptainId } from './data/captains.ts';
import type { BoardTactic } from './data/boarding.ts';
import type { TacKind, TacOrderId, TacSpellId } from './data/tactical.ts';
import type { FactionId } from './data/factions.ts';
import type { GoodId } from './data/goods.ts';
import type { AmmoId, ChaserEnd, GunId, ModuleId, MountId, ShipClassId } from './data/ships.ts';
import type { TalentRanks } from './data/talents.ts';
import type { Flag, StatMods } from './data/stats.ts';
import type { Cargo, AmmoStock, ShipLoadout, TrophyHistory } from './sim/shipstats.ts';
import type { IslandFeature } from './world/worldgen.ts';
import type { IslandBiome, RegionId } from './world/regions.ts';
import type { DailyKind } from './data/dailies.ts';
import type { CommonKind } from './data/commongoal.ts';
import type { QuestPay } from './data/questpay.ts';
import type { TaskView } from './data/worldtasks.ts';
import type { GuildGoalKind } from './data/guildgoal.ts';
import type { HearsayKind, Reliability } from './data/dealings.ts';

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
  | { t: 'loot_take'; take: Cargo; fate: 'sink' | 'release' | 'ransom' | 'prize' | 'trophy'; recruit?: number }
  /** A struck ship's surrender taken on the captain's terms (docs/16 #3): released for her ransom, her hold opened, or
   *  taken as a prize for the court — or as a trophy to keep (docs/16 #5). */
  | { t: 'surrender'; id: number; fate: SurrenderFate }
  | { t: 'board_cut' }
  /** Boarding 2.0: this round's tactic; the captains' duel (challenge, answer, a strike at server time `at`). */
  | { t: 'board_tactic'; tactic: BoardTactic }
  | { t: 'board_duel'; action: 'challenge' | 'accept' | 'decline' | 'strike'; at?: number }
  /** The turn-based boarding battle (docs/16 P4): what the active stack (or the captain) does. */
  | { t: 'tac'; act: TacAction }
  /** The captain would rather fight boardings the old way, round by round (Boarding 2.0). */
  | { t: 'board_pref'; classic: boolean }
  | { t: 'scuttle' }
  | { t: 'captive'; index: number; mode: 'ransom' | 'hand_over' | 'officer' | 'skipper' }
  | { t: 'repair'; on: boolean }
  | { t: 'dock'; bribe?: boolean }
  | { t: 'jettison'; good: GoodId; qty: number }
  | { t: 'fence_sell'; good: GoodId; qty: number }
  | { t: 'treasure'; action: 'buy' | 'assemble' | 'merge'; tier?: number }
  | { t: 'undock' }
  | { t: 'trade'; good: GoodId; qty: number }
  | { t: 'buy_ammo'; ammo: AmmoId; qty: number }
  | { t: 'hire_crew'; qty: number; prof?: Profession; dregs?: boolean }
  | { t: 'officer'; action: 'hire' | 'dismiss' | 'order' | 'fulfil'; id: string }
  | { t: 'codex'; share: number }
  | { t: 'mutiny'; choice: 'pay' | 'suppress' | 'yield' | 'duel' }
  | { t: 'press_gang'; qty: number }
  | { t: 'escort'; action: 'hire' | 'dismiss'; classId?: ShipClassId; id?: string }
  | { t: 'formation'; formation: 'line' | 'wedge' | 'ring' }
  /** `pay`: how a job is to be paid, chosen on taking it (docs/11 P6). */
  | { t: 'quest'; action: 'accept' | 'abandon' | 'decline' | 'share'; id: string; pay?: QuestPay }
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
  | { t: 'shipyard'; action: 'refit' }
  | { t: 'gear'; action: 'equip'; uid: number }
  | { t: 'gear'; action: 'unequip'; slot: Slot }
  | { t: 'gear'; action: 'sell'; uid: number }
  | { t: 'gear'; action: 'salvage'; uid: number }
  | { t: 'gear'; action: 'mend' }
  | { t: 'gear'; action: 'buy'; index: number }
  | { t: 'encounter'; id: number; choice: string }
  /** An island scene or mini-game (2026-09-30): a choice or an answer; `ms` for a timing game, `seq` for a call repeated. */
  | { t: 'minigame'; id: number; pick: string; ms?: number; seq?: number[] }
  /** Batch E of docs/16: a step of the walk across an island (a path, a choice, 'back' to the boats, 'close'); a captain's
   *  map offered to a captain alongside, and the answer to such an offer. */
  | { t: 'trek'; pick: string }
  | { t: 'mapsell'; map: string; to: number; price: number; copy?: boolean }
  | { t: 'mapdeal'; id: number; accept: boolean }
  | { t: 'fishing'; action: 'fight'; id: number; holds: [number, number][] }
  | { t: 'fishing'; action: 'trap' | 'haul' | 'deep' | 'salt' | 'cast' }
  /** The net hauled in (owner, 2026-09-30): the pulls, seconds from the cast, judged by replaying the floats. */
  | { t: 'fishing'; action: 'net'; id: number; pulls: number[] }
  /** The hunt (docs/12 P4): pay out the line, cut it, flense a carcass alongside. */
  | { t: 'hunt'; action: 'slack' | 'cut' }
  | { t: 'hunt'; action: 'flense'; id: number }
  /** The wanted (docs/12 P5): a tavern informant's word on a named pirate. */
  | { t: 'wanted'; action: 'informant'; id: string }
  /** The raider's trade (docs/12 P6): the glass on a ship, tribute from a merchant who has struck, the tavern's tips and clerk. */
  | { t: 'appraise'; id: number }
  | { t: 'tribute'; id: number }
  | { t: 'tip'; action: 'buy'; id: string }
  | { t: 'tip'; action: 'clerk' }
  /** docs/16 Batch C: a merchant's chained run (#12), the trophy auction (#13), the tavern's paid whispers (#14). */
  | { t: 'run'; action: 'accept' | 'abandon'; id: string }
  | { t: 'auction'; action: 'bid'; id: string; amount: number }
  | { t: 'auction'; action: 'sell'; uid: number; reserve: number }
  | { t: 'hearsay'; action: 'buy' | 'forget'; id: string }
  /** One's own island and outposts (docs/12 P7). */
  | { t: 'estate'; action: 'buy'; island: number }
  | { t: 'estate'; action: 'level' | 'home' | 'hire' | 'view' | 'abandon' }
  | { t: 'estate'; action: 'rob_isle'; island: number }
  | { t: 'estate'; action: 'assign'; id: number; where: string }
  | { t: 'estate'; action: 'found'; kind: OutpostKind }
  | { t: 'estate'; action: 'outpost'; id: string; order: 'upgrade' | 'workers' | 'guard' | 'haul' | 'renew' | 'auto' | 'rob'; arg?: string }
  | { t: 'estate'; action: 'visit'; island: number }
  /** One's own island as a base (docs/15 items 1–3): plots, the builders' work, the yard. */
  | { t: 'base'; action: 'view' | 'collect' }
  | { t: 'base'; action: 'build'; plot: number; what: string }
  | { t: 'base'; action: 'upgrade'; plot: number }
  | { t: 'base'; action: 'move'; plot: number; to: number }
  | { t: 'base'; action: 'speedup'; job: number; pay: 'silver' | 'res' | 'token' }
  /** The island's shipyard (docs/15 item 4): her own ships built, raised, mended, taken to sea and sent home. */
  | { t: 'base'; action: 'ship_build'; role: OwnRole }
  | { t: 'base'; action: 'ship_launch' | 'ship_recall' | 'ship_repair' | 'ship_upgrade'; ship: string }
  /** Caravans (docs/12 P8). */
  | { t: 'caravan'; action: 'launch'; ships: number[]; task: CaravanTask; outposts?: string[]; port?: string; port2?: string; goods?: GoodId[]; minPrice?: number; escorts: number; insured: boolean; orders: { repeat: boolean; avoidLawless: boolean; nightInPort: boolean; onAttack: OnAttack } }
  | { t: 'caravan'; action: 'recall' | 'repeat'; id: string }
  /** Tattoos and a choice of rewards (docs/12 P9). */
  | { t: 'tattoo'; action: 'set'; slot: number; id: string | null }
  | { t: 'tattoo'; action: 'view' }
  | { t: 'choice'; index: number }
  /** The orca calf (docs/12 P10 #2): name it, have a harness made, put one on. */
  | { t: 'companion'; action: 'name' | 'craft' | 'wear'; arg: string | null }
  /** The ship's pets (docs/12 P10 #3): put one on deck, buy one from a tavern's pet seller. */
  | { t: 'pet'; action: 'deck' | 'buy'; pet: PetId | null }
  /** Dead Man's Dice (docs/12 P10 #4). */
  | { t: 'dice'; action: 'open'; stake: number; davy?: boolean }
  | { t: 'dice'; action: 'join'; id: number }
  | { t: 'dice'; action: 'start' | 'liar' | 'leave' }
  | { t: 'dice'; action: 'bid'; q: number; f: number }
  /** The Regatta of Equal Waters (docs/12 P10 #5). */
  | { t: 'regatta'; action: 'signup' }
  /** Bottle mail (docs/12 P10 #6): a note, and silver if she likes, into the sea. */
  | { t: 'bottle'; note: string; silver: number }
  /** Captains' treasure (docs/12 P10 #7): bury a chest; post, take down or buy a map on a port's board. */
  | { t: 'chest'; silver: number; riddle: string; good: GoodId | null; qty: number }
  | { t: 'mapboard'; action: 'post' | 'unpost' | 'buy'; id: string; price?: number; copy?: boolean }
  /** The atlas (docs/12 P10 #8): the first finder names a wonder. */
  | { t: 'wonder'; id: string; name: string }
  /** The omen of the day's old custom (docs/12 P10 #9). */
  | { t: 'omen'; action: 'coin' }
  /** A ship's look (docs/12 P10 #12). */
  | { t: 'look'; look: string }
  /** Guests on an island (docs/12 P10 #13). */
  | { t: 'guest'; action: 'call' | 'drink' | 'sign'; island: number; text?: string }
  | { t: 'guest'; action: 'invite' | 'uninvite'; name: string }
  /** Letters of marque (docs/12 P10 #15). */
  | { t: 'service'; action: 'enlist' | 'resign' | 'order' | 'livery' }
  | { t: 'service'; action: 'buy'; index: number }
  /** The Descent into the Abyss (docs/12 P10 #17). */
  | { t: 'descent'; action: 'choose'; pick: BoonId }
  | { t: 'descent'; action: 'leave' }
  /** The Floating Bazaar (docs/12 P10 #19). */
  | { t: 'bazaar'; action: 'open' | 'close' }
  | { t: 'bazaar'; action: 'add_good'; good: GoodId; qty: number; price: number }
  | { t: 'bazaar'; action: 'add_item'; uid: number; price: number }
  | { t: 'bazaar'; action: 'remove'; kind: 'good' | 'item'; index: number }
  | { t: 'bazaar'; action: 'buy'; owner: number; kind: 'good' | 'item'; index: number; qty: number }
  /** A captain's saga (docs/12 P10 #20): a chapter shared in the chat. */
  | { t: 'saga'; action: 'share'; id: number }
  | { t: 'gear'; action: 'temper'; uid: number }
  | { t: 'gear'; action: 'reforge'; uid: number; line: number }
  /** The Storm-Chaser set forged of hearts of the storm (docs/12 P10 #14). */
  | { t: 'gear'; action: 'storm'; slot: Slot }
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
  /** docs/16 Batch F: the careers, the week's challenges, the album and the titles; the welcome gift taken. */
  | { t: 'renown' }
  | { t: 'away'; action: 'take' | 'close' }
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
  /** The list of friends (docs/11 P6); whispers go as chat: "/w Name words", "/r words". */
  | { t: 'friend'; action: 'add' | 'remove' | 'ignore' | 'unignore'; name: string }
  | { t: 'friend'; action: 'list' }
  /** Who is at sea (docs/11 P6): by a part of a name or a guild's tag, in all waters or only one's own. */
  | { t: 'who'; q: string; here: boolean; /** only the new captains (docs/11 P6) */ fresh?: boolean }
  /** Inspect a captain at sea (docs/11 P6). */
  | { t: 'inspect'; name: string }
  | { t: 'group'; action: 'invite' | 'kick' | 'lead'; name: string }
  | { t: 'group'; action: 'accept' | 'decline'; id: number }
  | { t: 'group'; action: 'leave' }
  | { t: 'group'; action: 'convoy'; on: boolean }
  | { t: 'group'; action: 'say'; text: string }
  | { t: 'group'; action: 'lfg'; note: string }
  | { t: 'group'; action: 'lfg_clear' }
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
  /** The guild finder (docs/11 P6): a recruiting note (null closes it), a captain's request, an officer's answer. */
  | { t: 'guild'; action: 'recruit'; note: string | null }
  /** The guild's word of the day (docs/11 P6): heard by every member coming aboard. */
  | { t: 'guild'; action: 'motd'; text: string }
  | { t: 'guild'; action: 'apply'; id: number; note: string }
  | { t: 'guild'; action: 'request'; account: number; accept: boolean }
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
  /** A sea stack of the dense sea (docs/16 P3). */
  minor?: boolean;
  /** A floating town's moored hulks (docs/16 P3). */
  raft?: boolean;
}

/** A mark of the dense sea that is not land (docs/16 P3). */
export interface SeaMarkData {
  id: number;
  kind: 'wreck' | 'buoy' | 'lantern' | 'drift' | 'bones' | 'floe';
  x: number;
  y: number;
  r: number;
  rot: number;
  seed: number;
}

/** A square of the sea and its ship level (docs/16 P2): `l` the level, `p` a pocket (calm in the wild, wild in the calm). */
export interface SectorData {
  l: number;
  p?: 'calm' | 'wild';
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

/** A storm front on a captain's course (docs/16 #10): it reaches her in `sec` seconds, coming from `bearing` (rad). */
export interface FrontWarn {
  id: number;
  kind: 'storm' | 'black_storm';
  sec: number;
  bearing: number;
}

/** A weather front: where it is, how big, and which way it drifts (everyone reads the clouds, docs/16 #10); `ttl`
 *  — how long it lasts — only for captains who can forecast (Navigator), who also read them further out. */
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
  /** A floating town (docs/16 P3). */
  raft?: boolean;
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
  /** The title she flies with the ship's name (docs/16 #29). */
  title?: string | null;
  captain: CaptainId;
  level: number;
  xp: number;
  xpNext: number;
  /** Rest ashore (docs/11 P6): battle experience still to come double. */
  rested: number;
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
  captives: { name: string; faction: FactionId; ransom: number; role?: OfficerRole; level?: number; traits?: TraitId[]; skills?: SkipperTrait[]; loyalty?: number; turnCost?: number; tried?: boolean }[];
  /** Turned captains who skipper her caravans (docs/12 P10 #16). */
  skippers?: { name: string; faction: FactionId; traits: SkipperTrait[]; loyalty: number; voyages: number }[];
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
  /** One's own island (docs/15), for the way into its base from the sea. */
  homeIsle?: number | null;
  /** Raiders at her island (docs/15 item 7): where they lie, when they land (world seconds), the island. */
  isleRaid?: { x: number; y: number; until: number; name: string } | null;
  /** A wild island off the bow she may claim as her own (docs/15 item 6). */
  claimIsle?: { island: number; name: string; price: number; waters: 'safe' | 'contested' | 'lawless' } | null;
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
  quests: { id: string; name: string; kind: 'path' | 'legend' | 'story' | 'job'; mentor: string; step: number; steps: number; text: string; progress: number; need: number; /** the ship level its fight asks for (canon D12) */ ship?: number; target?: { x: number; y: number; r?: number; region?: RegionId };
    /** For the journal: the giver's words, every step's text, the pay, the giver's face, the job's kind. */
    summary?: string; stepTexts?: string[]; silver?: number; xp?: number; portrait?: string; category?: string;
    /** seconds left to earn the speed bonus */ fastIn?: number;
    /** The pay chosen on taking it, when not all in silver, and what it comes to. */ pay?: QuestPay; paid?: { silver: number; heavy: number; incendiary: number; rep: number };
    /** Groupmates on the same quest (docs/11 P6), and the step each is on. */ mates?: { name: string; step: number }[] }[];
  questsDone: string[];
  /** The names of the last ten quests done, the latest first (docs/11 P6). */
  questsRecent: string[];
  /** Today's orders (docs/11 P6): each with its pay, the days in a row and the chest. */
  daily: { day: number; orders: { kind: DailyKind; need: number; progress: number; done: boolean; silver: number }[]; streak: number; chest: boolean; chestSilver: number };
  /** The sea's common cause today (docs/11 P6): the goal, the bar, this captain's deeds, seconds left. */
  common: { kind: CommonKind; target: number; progress: number; mine: number; done: boolean; endsIn: number; /** the day's busiest hands */ leaders?: { name: string; n: number }[] } | null;
  paths: CaptainId[];
  oath: 'code' | 'marque' | null;
  pathSwitchAt: number;
  /** Shipbuilding (docs/02 §3). */
  builds: { id: string; port: string; classId: ShipClassId; name: string; done: number; start: number; frame: WoodId; plank: WoodId; quality: PlanQuality }[];
  plans: { id: string; classId: ShipClassId | null; quality: PlanQuality; variants: VariantId[]; uses: number }[];
  berths: { port: string; name: string; classId: ShipClassId; hull: number; trophy?: TrophyHistory }[];
  /** Ships sunk or taken in a row since she last made port (docs/16 #4), and what it adds to plunder and experience. */
  streak?: { n: number; mul: number } | null;
  figureheads: FigureheadId[];
  /** Hired escorts (Command) and the formation signal. */
  fleet: { escorts: { id: string; name: string; classId: ShipClassId; hull: number; atSea: boolean; own?: boolean }[]; slots: number; formation: 'line' | 'wedge' | 'ring'; upkeep: number };
  /** Admiral's Eye: what you can read of ships near you. */
  inspect: { id: number; hull: number; crew: number; morale: number; port: boolean; starboard: boolean }[];
  /** Eyes of the Choir: monsters and ghost ships far beyond sight. */
  monsters: [number, number][];
  gold: number;
  infamy: number;
  wanted: number;
  reputation: Partial<Record<FactionId, number>>;
  loadout: ShipLoadout;
  /** The captain's locker and own gear (docs/12 P1); the ship's gear is in her loadout. */
  stash: Item[];
  captainGear: Partial<Record<CaptainSlot, Item>>;
  /** The letters of the sea found in bottles (docs/12 P2), and the ship's cat. */
  seaLetters: number[];
  shipCat: boolean;
  /** Her ship's look and what of it she has opened (docs/12 P10 #12). */
  look?: string | null;
  unlocks?: string[];
  /** A cartographer's fame (docs/12 P10 #7). */
  cartoFame?: number;
  /** Hearts of the storm caught and not yet forged (docs/12 P10 #14). */
  stormHearts?: number;
  /** Her letter of marque: the service, rank, merit and the fleet order in hand (docs/12 P10 #15). */
  service?: ServiceView | null;
  /** Her saga's chapters (docs/12 P10 #20). */
  saga?: SagaEntry[];
  /** The captain's log of the last few days (docs/16 #20). */
  log?: LogEntry[];
  /** Fishing (docs/12 P3). */
  fishing: FishingView;
  /** The beasts taken, by kind (docs/12 P4). */
  beasts: Partial<Record<BeastId, number>>;
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
  landable: { island: string; feature: string; action?: 'dig' | 'dive' | 'expedition' | 'raise' | 'descent' | 'escort' | 'keeper'; blocked?: string } | null;
  /** Landing party ashore. */
  landing: { island: string; feature: string; until: number; started: number } | null;
  discoveredCount: number;
  /** What the captain knows about each visited market, and how old that knowledge is. */
  intel: { portId: string; t: number; top: [GoodId, number][]; dear?: GoodId[]; cheap?: GoodId[]; heard?: boolean }[];
  /** docs/16 #12: the merchants' runs she carries. */
  runs?: TradeRunView[];
  /** docs/16 #14: the whispers she has paid for (where they point, how sure, how old). */
  hearsay?: HearsayView[];
  /** docs/16 #15: her carpenters' pace at sea and what all the mending would take. */
  seaRepair?: SeaRepairView;
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
      /** Her past, a request, a love (docs/12 P10 #11). */
      fate?: { past: number; request: { kind: RequestKind; port?: string; island?: number; n?: number; until: number } | null; love: { port: string; name: string } | null };
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
  /** The trades' practice points, by trade (docs/16 #18). */
  practice?: Record<Profession, number>;
  /** The wounded below (docs/16 #19): how many, the surgeons and medicine aboard, a minute's healing and dying. */
  wounded?: { n: number; surgeons: number; medicine: number; healPerMin: number; diePerMin: number };
  /** The men's mood on deck (docs/16 #17): grumbling, singing, or neither; the shanty's lift lasts to (world time). */
  mood?: 'grumble' | 'shanty' | null;
  shantyUntil?: number;
}

export interface TavernView {
  /** The bard sings of the season's legends. */
  shanty: string | null;
  /** Dead Man's Dice: the open tables, the week's best, Davy's table at midnight in the Abyss (docs/12 P10 #4). */
  dice?: { tables: { id: number; host: string; stake: number; seats: number }[]; week: { name: string; wins: number }[]; davy: boolean };
  /** The map board (docs/12 P10 #7). */
  maps?: MapBoardView[];
  /** The pet seller's two today (docs/12 P10 #3). */
  pets?: { pet: PetId; price: number }[];
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
  questOffers: { id: string; name: string; kind: 'path' | 'legend' | 'story' | 'job'; mentor: string; summary: string; steps: string[]; blocked: string | null; silver: number; xp: number; path?: CaptainId; category?: string; portrait?: string; /** the ship level its fight asks for (canon D12) */ ship?: number; /** an arc's chapter, of three */ chapter?: number; /** asked for by the port's news (an epidemic, a blockade…) */ urgent?: boolean;
    /** The pay to choose from (docs/11 P6). */ pays?: QuestPayView;
    /** A group contract: the company it is made for. */ group?: number }[];
  captainsHouse: boolean;
  /** The board of the wanted (docs/12 P5). */
  wanted?: WantedPoster[];
  /** The tavern's tips and the clerk's manifest (docs/12 P6). */
  raid?: { tips: TipView[]; clerk: { cost: number; until: number } };
  /** docs/16 #12: the merchants' runs on the board, and the next leg of her chain waiting here. */
  runs?: { offers: TradeRunView[]; next: TradeRunView | null };
  /** docs/16 #13: the trophy auction of a free port. */
  auction?: AuctionView | null;
  /** docs/16 #14: whispers for silver in the tavern. */
  hearsay?: HearsayOfferView[];
  /** docs/16 #15: what her carpenters could do at sea, set against the yard's price. */
  seaRepair?: SeaRepairView;
  /** The sea's heaviest catches (docs/12 P3): the tavern's board. */
  fishRecords?: { fish: FishId; name: string; kg: number }[];
  oathOffer: 'code' | 'marque' | null;
  /** The service of this port's flag (docs/12 P10 #15). */
  service?: ServicePortView;
  /** The Floating Bazaar here (docs/12 P10 #19): the others' stalls, hers, and where hers stands if elsewhere. */
  bazaar?: { stalls: BazaarStallView[]; mine: BazaarStallView | null; elsewhere: { port: string; sold: number } | null };
  yard: { woods: WoodId[]; figurehead: FigureheadId | null; plans: boolean; master: boolean };
  shipyard: {
    tier: number;
    repairCost: number;
    ships: { classId: ShipClassId; price: number; tradeIn: number }[];
    modules: { module: ModuleId; level: number; cost: number; max: number; excellent: boolean }[];
    guns: { gun: GunId; cost: number }[];
    mounts: { mount: MountId; cost: number }[];
    /** Raising her a level (canon D12). */
    refit: RefitView;
    /** The chandler's gear today (docs/12 P1). */
    wares: Item[];
    /** Mending all worn gear here. */
    mendCost: number;
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
  /** A captain's look, encoded (docs/12 P10 #12). */
  look?: string;
  /** Her level ⚓1–⚓10 (canon D12); absent for monsters and wreck hulks, which stand outside the ladder. */
  shipLevel?: number;
  /** A strong ship built for a company (group contracts, barons): the gold frame of an elite. */
  elite?: boolean;
  /** A named pirate's id on the roster (docs/12 P5). */
  named?: string;
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
  GUARDED: 1 << 24, // a merchant under a friend's guns (docs/12 P6)
} as const;

/**
 * A treasure map (docs/01 §15): coordinates (a circle), a riddle, a drawing of an island seen from the sea,
 * landmarks and paces, a cursed map that pulls the compass, or fragments of the season's legendary chart.
 */
export interface MapView {
  id: string;
  name: string;
  tier: number;
  kind: 'circle' | 'riddle' | 'drawing' | 'landmark' | 'cursed' | 'fragment' | 'player';
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
/** docs/16 #26: a career under a flag. */
export interface CareerView {
  id: CareerId;
  rank: number;
  points: number;
  rep: number;
  deeds: number;
  merit: number;
  /** What the next rank asks (null at the top). */
  next: { points: number; rep: number } | null;
  discount: number;
  yard: boolean;
  gifts: number[];
}

/** docs/16 #29: a title for a feat, won or on the way. */
export interface FeatView {
  id: string;
  value: number;
  need: number;
  done: boolean;
}

/** docs/16 #28: a set of the album. */
export interface SetView {
  id: SetId;
  have: string[];
  items: string[];
  done: boolean;
  silver: number;
  title: string;
}

/** docs/16 #27: the week's challenges and their tables. */
export interface WeeklyView {
  week: number;
  endsIn: number;
  challenges: { kind: WeeklyKind; region: RegionId; mine: number; place: number | null; top: { name: string; value: number }[] }[];
  last: { kind: WeeklyKind; region: RegionId; top: { name: string; value: number }[] }[] | null;
  prizes: number[];
}

export interface RenownView {
  careers: CareerView[];
  feats: FeatView[];
  sets: SetView[];
  weekly: WeeklyView;
  titles: string[];
  title: string | null;
}

/** docs/16 #30: what happened while she was away, and the gift. */
export interface AwayView {
  hours: number;
  isle: { name: string; goods: number; treasury: number; raids: string[] } | null;
  auction: string[];
  letters: { n: number; unread: number; from: string[] };
  world: string[];
  weekly: { kind: WeeklyKind; region: RegionId; place: number | null; value: number; leader: string | null }[];
  lastWeek: { kind: WeeklyKind; region: RegionId; winner: string }[];
  gift: { silver: number; speedups: number; provisions: number } | null;
}

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
  kind: 'armada' | 'blockade' | 'storm_century' | 'new_island' | 'epidemic' | 'glory' | HappeningKind;
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
    | 'white_water' | 'boss_roar' | 'lightning' | 'ink' | 'bile' | 'swallow' | 'spit' | 'song' | 'ice' | 'claws' | 'coil' | 'rise' | 'axes' | 'dig' | 'plankton' | 'spout' | 'rocket' | 'firework' | 'struck'
    /** A lair's gun fires (docs/16 #7): from x,y toward dir, the ball falling r metres off — a hit when `hit`. */
    | 'lair_gun'; x: number; y: number; r?: number; dir?: number; hit?: boolean }
  | { k: 'discover'; islandId: number; name: string; region: RegionId; quiet?: boolean }
  | { k: 'region'; region: RegionId; safety: string };

export type SurrenderFate = 'ransom' | 'cargo' | 'prize' | 'trophy';

/** A ship that struck her colours to a captain (docs/16 #3), as the choice card shows her. */
export interface SurrenderOffer {
  id: number;
  name: string;
  classId: ShipClassId;
  faction: FactionId | 'player';
  role: string | null;
  captain: string;
  /** Silver her people pay to have her back. */
  ransom: number;
  /** Units in her hold and the silver in her purse. */
  cargo: number;
  gold: number;
  /** A prize crew's size and what a prize court pays; null when she cannot be taken. */
  prize: { crew: number; value: number } | null;
  /** A berth free for her as a trophy (docs/16 #5). */
  trophy: boolean;
  /** How close the captain must come to take the surrender (metres). */
  range: number;
  /** When she will think better of it (server time). */
  until: number;
}

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
  /** She struck her colours (docs/16 #3) rather than being carried by boarding. */
  struck?: boolean;
  /** A berth is free to keep her as a trophy (docs/16 #5). */
  trophy?: boolean;
  /** How the deck fight went: rounds fought, won and lost, the captains' duel. */
  report?: { rounds: number; won: number; lost: number; duel: 'won' | 'lost' | null; moves: number; /** fought turn by turn (docs/16 P4): won/lost count stacks broken */ tac?: boolean };
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

/** An order in the turn-based boarding battle: the active stack moves, strikes (from a chosen hex, else the nearest),
 *  shoots, waits, defends or gives its officer's word; the captain gives one of his orders; auto-battle; quick combat;
 *  strike the colours. */
export type TacAction =
  | { a: 'move'; to: number }
  | { a: 'attack'; target: number; from?: number }
  | { a: 'shoot'; target: number }
  | { a: 'wait' }
  | { a: 'defend' }
  | { a: 'order' }
  | { a: 'spell'; id: TacSpellId; target?: number }
  | { a: 'auto'; on: boolean }
  | { a: 'quick' }
  | { a: 'surrender' };

/** A stack on the field. `hex` its place; `count` men with `hp` left on the foremost; `ret` may still strike back
 *  this round. */
export interface TacStackView {
  id: number;
  side: 0 | 1;
  kind: TacKind;
  count: number;
  start: number;
  hp: number;
  hpMax: number;
  hex: number;
  atk: number;
  def: number;
  dmg: [number, number];
  speed: number;
  init: number;
  shots: number;
  shotsMax: number;
  ret: boolean;
  defending: boolean;
  waited: boolean;
  /** The officer who leads the party: his post and name, his face, his order and whether it is still to give. */
  officer?: { role: OfficerRole; name: string; unique?: string; order: TacOrderId; ready: boolean };
}

/** A captain on the side panel. */
export interface TacHeroView {
  name: string;
  ship: string;
  captain: CaptainId | null;
  morale: number;
  luck: number;
  spells: { id: TacSpellId; ready: number }[];
  /** Has given an order this round. */
  cast: boolean;
  auto: boolean;
}

/** One thing that happened, for the feed and the field's marks. */
export interface TacEvent {
  /** Its number in the battle (the client marks each once). */
  i: number;
  k: 'move' | 'hit' | 'shot' | 'ret' | 'die' | 'wait' | 'defend' | 'morale' | 'fear' | 'luck' | 'spell' | 'order' | 'round' | 'timeout';
  side: 0 | 1;
  s?: number;
  t?: number;
  dmg?: number;
  kills?: number;
  hex?: number;
  id?: string;
  n?: number;
}

/** The whole battle as one captain sees it. Side 0 is the boarder, on the left deck. */
export interface TacView {
  you: 0 | 1;
  round: number;
  maxRounds: number;
  cells: string;
  stacks: TacStackView[];
  /** Who is still to act this round, the active stack first; then the next round's first few. */
  order: number[];
  next: number[];
  active: number | null;
  mine: boolean;
  /** Server time the active turn runs out. */
  ends: number;
  /** For my active stack: where it may step, whom it may strike and whom it may shoot. */
  reach: number[];
  melee: number[];
  shoot: number[];
  heroes: [TacHeroView, TacHeroView];
  log: TacEvent[];
  seq: number;
  over: null | { winner: 0 | 1; why: 'rout' | 'struck' | 'rounds' };
  canCut: boolean;
  canStrike: boolean;
}

export type ServerMsg =
  /** A job offered (docs/11 P6) by an island's people on the beach, or shared by a groupmate (`from`): the captain
   *  may take it or leave it. */
  | { t: 'quest_offer'; offer: PortView['questOffers'][number]; island?: number; from?: string }
  /** A quest done: its name and all it paid (docs/11 P6). */
  | { t: 'quest_done'; name: string; silver: number; xp: number; /** done within the speed window */ fast?: boolean; /** groupmates in company (each a tenth more) */ company?: number; rep?: { faction: FactionId; n: number }; extra?: 'map' | 'supplies';
      /** fine shot put aboard, when the pay was taken partly in it */ stores?: { heavy: number; incendiary: number };
      /** a veteran groupmate in company who guided it (a tenth more experience) */ mentor?: string }
  | { t: 'welcome'; v: number; token: string; accountId: number; name: string; hasCaptain: boolean; worldSize: number; time: number }
  | { t: 'init'; self: PrivateState; ports: PortPublic[]; currents: CurrentData[]; whirlpools: WhirlpoolData[]; discovered: number[]; time: number; entityId: number; sectors?: SectorData[] }
  /** `warn`: a storm front that will cross her course (docs/16 #10) — which, in how many seconds, from which bearing. */
  | { t: 'fronts'; list: FrontData[]; forecast: boolean; warn?: FrontWarn | null }
  | { t: 'lairchest'; view: LairChestView }
  | { t: 'chunk'; key: number; islands: IslandData[]; reefs?: ReefData[]; marks?: SeaMarkData[] }
  | { t: 'snap'; tick: number; time: number; ack: number; you: SelfRow | null; ships: ShipRow[]; loot: LootRow[]; wind: [number, number]; weather: WeatherKind; region: RegionId; fog: number; /** world time per real second, when an admin has changed it */ k?: number }
  | { t: 'info'; list: EntityInfo[] }
  | { t: 'boss'; list: BossView[] }
  | { t: 'events'; list: WorldEventView[] }
  /** Tasks of the sea (docs/11 P6): the pirate nests about the map, with this captain's tally at each. */
  | { t: 'tasks'; list: TaskView[] }
  | { t: 'sights'; list: SightView[] }
  | { t: 'shoals'; list: ShoalView[] }
  | { t: 'hunt'; view: HuntView | null }
  | { t: 'carcasses'; list: CarcassView[] }
  | { t: 'wanted'; view: WantedView }
  | { t: 'appraisal'; view: AppraisalView }
  | { t: 'raid'; view: RaidView }
  | { t: 'estate'; view: EstateView }
  | { t: 'base'; view: BaseView | null }
  | { t: 'caravans'; list: CaravanView[]; slots: number }
  | { t: 'tattoos'; view: TattooView }
  | { t: 'companion'; view: CompanionView | null }
  | { t: 'pets'; list: PetView[] }
  | { t: 'petsown'; view: PetsOwnView }
  | { t: 'dice'; view: DiceView | null }
  | { t: 'regatta'; view: RegattaView }
  | { t: 'wonders'; view: WondersView }
  | { t: 'omen'; id: OmenId }
  | { t: 'dutchman'; view: DutchmanView }
  | { t: 'hall'; view: HallView | null }
  | { t: 'storm'; view: StormView | null }
  | { t: 'descent'; view: DescentView | null }
  | { t: 'holiday'; view: HolidayView }
  | { t: 'bazaar'; shadows: BazaarShadow[] }
  | { t: 'choice'; view: { quest: string; items: Item[] } | null }
  | { t: 'trophy_hall'; view: { owner: string; flag: number; skull: number; fish: number } }
  | { t: 'fishfight'; view: FishFightView | null }
  /** A net (or a lamp) out: the haul to play; `null` when judged (with what came up) or lost. */
  | { t: 'nethaul'; view: NetHaulView | null; got?: { fish: FishId; n: number; hits: number } }
  | { t: 'encounter'; view: EncounterView | null }
  | { t: 'minigame'; view: MinigameView | null }
  /** Batch E of docs/16: the walk across an island; what the lighthouses, lookouts, banks and her caches show; a map
   *  offered to her by a captain alongside. */
  | { t: 'trek'; view: TrekView | null }
  | { t: 'isles'; view: IslesView }
  | { t: 'mapoffer'; offer: MapOfferView | null }
  | { t: 'encounter_result'; id: number; def: EncounterId; outcome: string; vars: { n?: number; silver?: number; good?: GoodId; item?: Item } }
  | { t: 'legends'; view: LegendsView }
  | { t: 'renown'; view: RenownView }
  | { t: 'away'; view: AwayView }
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
  /** A ship has struck her colours to you (docs/16 #3): the choice card, or null when the offer is gone. */
  | { t: 'surrender_offer'; offer: SurrenderOffer | null }
  | { t: 'board_fight'; view: BoardFightView | null }
  | { t: 'board_tac'; view: TacView | null }
  | { t: 'mutiny'; ringleader: string; mutineers: number; payCost: number; timeout: number }
  | { t: 'sunk_self'; lost: { cargoValue: number; crew: number; repairFee: number }; respawnPort: string; towed?: boolean }
  | { t: 'toast'; msg: string; kind: 'info' | 'good' | 'bad' | 'xp' | 'gold' }
  /** The crew speaks (docs/16 #16–17): an officer's line on an event (his name, role, portrait), or the men's grumble or
   *  shanty (`who` null); `i` the line of the table, `x` the event's name (a sea, a ship, a beast). */
  | { t: 'crew_say'; who: { name: string; role: OfficerRole; unique?: string } | null; ev: TalkEvent | 'grumble' | 'shanty'; i: number; x?: string }
  /** `whisper`: to this captain, or (with `to`) their own words to another, echoed back. */
  /** A chat line; `face` is the speaker's captain (a portrait id), `fac` her flag when sworn, `lv` her level. */
  | { t: 'chat'; from: string; text: string; ch?: 'group' | 'guild' | 'whisper'; to?: string; card?: SagaCard; face?: string; fac?: 'free' | 'crown'; lv?: number }
  /** The list of friends, and the names of the captains one does not hear. */
  | { t: 'friends'; list: FriendView[]; ignored?: string[] }
  | { t: 'who'; list: WhoView[]; total: number }
  | { t: 'inspect'; view: InspectView }
  | { t: 'party'; group: PartyView | null; invites: { id: number; from: string }[];
      /** Captains looking for a group (docs/11 P6), and this captain's own posting */ lfg?: { name: string; level: number; captain: CaptainId; region: RegionId; note: string; mins: number }[]; lfgMine?: string | null }
  | { t: 'barter'; view: BarterView | null }
  | { t: 'mail'; letters: LetterView[]; unread: number }
  | { t: 'market'; view: MarketView }
  | { t: 'duel'; view: DuelView | null }
  | { t: 'holdings'; mine: HoldingView[]; here: IslandOffer | null; region: IslandOffer[]; sieges: SiegeView[] }
  | { t: 'guild'; guild: GuildView | null; invites: { id: number; name: string; tag: string; by: string }[];
      /** For a captain with no guild: the guilds recruiting (docs/11 P6). */ recruiting?: RecruitView[] }
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

/** A job's pay to choose from (docs/11 P6): all silver (with standing `rep` with `faction`), silver and fine
 *  shot, or silver and the port's favour (where the job has a port). */
export interface QuestPayView {
  rep?: number;
  faction?: FactionId;
  stores: { silver: number; heavy: number; incendiary: number };
  favour?: { silver: number; rep: number };
}

/** The yard's page on a refit (canon D12): her level and her class's height, the next level's price, the yard at work. */
export interface RefitView {
  level: number;
  max: number;
  next: { to: number; silver: number; goods: { good: GoodId; qty: number; have: number }[]; sec: number; captain: number; hearts?: { qty: number; have: number } } | null;
  /** The yard at work on her: to what level, seconds left, in which port. */
  busy: { to: number; left: number; port: string } | null;
  /** Why it cannot be ordered here and now. */
  blocked: string | null;
}

/** A shoal as a captain sees it (docs/12 P3): the birds over it; what swims in it once they read the water. */
/** A fleet order under a letter of marque (docs/12 P10 #15): what, where, how far along, by when (game seconds). */
export interface ServiceOrderView {
  kind: OrderKind;
  text: string;
  n: number;
  need: number;
  until: number;
  port: string;
  x: number;
  y: number;
  marks?: [number, number][];
  target?: number | null;
}

export interface ServiceView {
  id: ServiceId;
  rank: number;
  merit: number;
  order: ServiceOrderView | null;
}

/** A port's office of its flag's service: whether she may enlist, her pay, the quartermaster's stores. */
export interface ServicePortView {
  offer: ServiceId | null;
  blocked: string | null;
  pay: number;
  payReady: boolean;
  wares: { item: Item; price: number; sold: boolean }[];
}

/** A chapter of a captain's saga shared in the chat (docs/12 P10 #20): her name, the chapter, her flag. */
export interface SagaCard {
  name: string;
  entry: SagaEntry;
  flag: number | null;
}

/** A stall of the Floating Bazaar (docs/12 P10 #19). */
export interface BazaarStallView {
  owner: number;
  name: string;
  ship: string;
  classId: ShipClassId;
  goods: { good: GoodId; qty: number; price: number }[];
  items: { item: Item; price: number }[];
  sold: number;
  daysLeft: number;
}

/** A stall's shadow ship at a port's anchorage, as the sea near sees it. */
export interface BazaarShadow {
  owner: number;
  port: string;
  name: string;
  ship: string;
  classId: ShipClassId;
  look: string | null;
}

/** The sea's holiday (docs/12 P10 #18): the one on (or the next), the tournament's top five, her points, kegs near. */
export interface HolidayView {
  id: HolidayId | null;
  next: HolidayId | null;
  nextIn: number;
  endsIn: number;
  board: { name: string; pts: number }[];
  mine: number;
  kegs: [number, number][];
}

/** The Descent into the Abyss (docs/12 P10 #17): the week's Stair, her descent (if she is going down), the board. */
export interface DescentView {
  gate: { x: number; y: number; region: RegionId; r: number };
  run: {
    tier: number;
    phase: 'fight' | 'choice' | 'breath';
    hosts: HostId[];
    current: CurrentId;
    dark: DarkId;
    boons: BoonId[];
    /** The three offered between tiers (to the leader). */
    offers: BoonId[] | null;
    leader: boolean;
    /** Seconds left in this phase. */
    left: number;
    enemies: number;
    members: string[];
    glory: number;
    ripDir: number;
  } | null;
  week: { names: string[]; depth: number; glory: number }[];
}

/** The heart of the Storm of the Century as a captain in its region sees it (docs/12 P10 #14). */
export interface StormView {
  x: number;
  y: number;
  /** Lightning within this; the charge gathered within `core`. */
  r: number;
  core: number;
  charge: number;
  need: number;
  /** Seconds till the sky makes another heart (0: it is there). */
  rest: number;
  /** Hearts she has; caught in this storm, and the most one storm gives. */
  hearts: number;
  caught: number;
  max: number;
}

/** A captain's tattoos (docs/12 P9). */
export interface TattooView {
  owned: string[];
  pending: string[];
  active: (string | null)[];
  slots: number;
}

/** A caravan as its owner sees it (docs/12 P8). */
export interface CaravanView {
  id: string;
  name: string;
  task: CaravanTask;
  skipper: string;
  ships: ShipClassId[];
  escorts: number;
  level: number;
  from: string;
  to: string;
  progress: number;
  /** Seconds to home. */
  eta: number;
  x: number;
  y: number;
  path: [number, number][];
  cargo: { good: GoodId; n: number }[];
  /** Seconds left to come to her rescue, while pirates are on her. */
  attack: number | null;
  log: string[];
  repeat: boolean;
  insured: boolean;
  onAttack: OnAttack;
}

/** An outpost as its owner (or a would-be robber) sees it (docs/12 P7). */
export interface OutpostView {
  id: string;
  kind: OutpostKind;
  island: number;
  name: string;
  region: RegionId;
  x: number;
  y: number;
  level: number;
  good: GoodId;
  rate: number;
  store: number;
  cap: number;
  /** Seconds until the store is full (0: full). */
  fullIn: number;
  claimUntil: number;
  workers: 'none' | 'hands';
  residents: number;
  guard: string;
  /** Seconds left before raiders ruin it, while a raid is on. */
  raid: number | null;
  mine: boolean;
  owner: string;
  auto: boolean;
}

/** A captain's own island and outposts (docs/12 P7). */
export interface EstateView {
  isle: {
    island: number;
    name: string;
    level: number;
    levelName: string;
    slots: number;
    next: { name: string; silver: number; goods: Partial<Record<GoodId, number>>; power?: number } | null;
    /** The island's power (docs/15 item 5). */
    power?: number;
    residents: { id: number; name: string; prof: string; at: string | null; line: string }[];
    cap: number;
    refugees: number;
    outposts: number;
    trophies: { flag: number; skull: number; fish: number } | null;
    visitors: number;
  } | null;
  outposts: OutpostView[];
  near: OutpostView[];
  homeIn: number;
  buy: { island: number; name: string; price: number } | null;
  /** The terms of claiming the island off the bow (docs/15 item 6), whether or not it may be claimed now. */
  claim: ClaimTermsView | null;
  /** Another captain's island off the bow in lawless water, to rob (docs/15 item 6). */
  rob: { island: number; name: string; owner: string; why: string | null; robbing: number | null } | null;
  kinds: OutpostKind[];
  /** Another captain's trophy hall off the bow, to look round. */
  hall: { island: number; owner: string } | null;
}

/** What claiming an island as one's own asks and brings, by its waters (docs/15 item 6). */
export interface ClaimTermsView {
  island: number;
  name: string;
  region: RegionId;
  waters: 'safe' | 'contested' | 'lawless';
  size: IslandSize;
  price: number;
  /** A lease still to run counted off the price. */
  credit: number;
  /** Tax a week for each level of the island (0: none), to the waters' ruling faction. */
  tax: number;
  faction: string;
  /** Pirate raids on a fat store: a chance a day (0: never), their strength against a middling sea's, their ships. */
  raidDay: number;
  raidMul: number;
  raiders: number;
  /** Other captains may land and rob the yard. */
  robbable: boolean;
  /** Moving house: the share of the price given back, and the hours before another is claimed. */
  refund: number;
  cooldownH: number;
  /** What stands in the way now (null: it may be claimed). */
  why: string | null;
}

/** One's own island's waters, tax and defence, and a raid under way (docs/15 items 6–7). */
export interface IsleClaimView {
  waters: 'safe' | 'contested' | 'lawless';
  region: RegionId;
  faction: string;
  /** This week's tax, when it falls due (wall ms), and weeks unpaid in a row. */
  tax: number;
  taxAt: number;
  unpaid: number;
  treasury: number;
  /** The island's defence without its owner: its rating, what makes it up, and its odds against a raid now. */
  defence: number;
  batteries: number;
  forts: number;
  ships: number;
  strength: number;
  odds: number;
  /** The yard and store's worth against the mark that draws raiders. */
  worth: number;
  fat: number;
  /** No raid before (wall ms); the share lost today and the day's cap. */
  calmUntil: number;
  lost: number;
  lossCap: number;
  raid: { until: number; x: number; y: number; ships: number; alive: number; strength: number } | null;
  refund: number;
  abandonWhy: string | null;
}

/** What a step of the builders' work costs (docs/15): silver from the purse, goods from the yard, seconds of work. */
export interface BaseCostView {
  silver: number;
  goods: Partial<Record<GoodId, number>>;
  secs: number;
}

/** A plot of one's own island (docs/15 item 1). */
export interface BaseCellView {
  plot: number;
  /** A building (its id), a producer ('p:lumber'), or nothing; while it is first raised, what is being raised. */
  what: string | null;
  level: number;
  condition: number;
  unpaid: boolean;
  /** The builders at work here: to what level, when they started and finish (wall ms), and what finishing now costs. */
  job: { id: number; level: number; start: number; end: number; silver: number; goods: Partial<Record<GoodId, number>> } | null;
  /** The next level, or null at the greatest; `why` says what stands in the way. */
  up: (BaseCostView & { level: number; why: string | null }) | null;
  /** A producer's yield since the last collection; and whether it stands idle (its resource at the yard's cap). */
  fresh: number;
  idle: boolean;
}

/** One's own island as a base (docs/15 items 1–3). */
export interface BaseView {
  island: number;
  name: string;
  biome: IslandBiome;
  level: number;
  levelName: string;
  size: IslandSize;
  plots: number;
  /** Plots still shut, with the island level that opens each. */
  locked: { plot: number; level: number }[];
  cells: BaseCellView[];
  /** The yard: each resource, its cap and its yield by the hour. */
  store: { good: GoodId; n: number; cap: number; rate: number }[];
  crews: { n: number; busy: number; next: number | null };
  speedups: number;
  tokenSecs: number;
  /** What an empty plot may take, and what stands in the way of each. */
  catalog: (BaseCostView & { what: string; why: string | null })[];
  slots: { used: number; total: number };
  /** The server's wall clock (ms) when the view was made, for the timers. */
  now: number;
  /** Lying off the island: the hold pays too. */
  near: boolean;
  /** The island's power (docs/15 item 5): what it is, what the next level asks, and the step up itself. */
  power: { now: number; need: number | null; crew: number; crewHas: boolean };
  levelUp: (BaseCostView & { level: number; treasury: number; power: number; why: string | null }) | null;
  /** The island's shipyard and her own ships (docs/15 item 4). */
  shipyard: OwnYardView;
  /** Its waters, tax and defence, and a raid under way (docs/15 items 6–7). */
  claim: IsleClaimView;
}

/** One of the captain's own ships (docs/15 item 4). */
export interface OwnShipView {
  id: string;
  role: OwnRole;
  name: [string, string];
  classId: ShipClassId;
  level: number;
  xp: number;
  xpNext: number;
  hull: number;
  state: 'building' | 'home' | 'sea' | 'laid_up' | 'refit';
  /** The shipwrights at work on her. */
  job: { id: number; kind: 'build' | 'upgrade' | 'repair'; level: number; start: number; end: number; silver: number; goods: Partial<Record<GoodId, number>> } | null;
  /** The next level at the shipyard (null at her greatest) and what stands in the way. */
  up: (BaseCostView & { level: number; classId: ShipClassId; why: string | null }) | null;
  /** Mending her at the island (null: she is whole). */
  repair: (BaseCostView & { why: string | null }) | null;
  /** Why she may not be taken to sea now (null: she may), or sent home. */
  launchWhy: string | null;
  recallWhy: string | null;
  /** What she lends her captain: hold (m³), sight (share), fish a haul. */
  bonus: { hold: number; sight: number; haul: number };
  /** Catch aboard her, to the island's yard when she comes home. */
  catch: number;
}

export interface OwnYardView {
  /** The shipyard's level (0: none built yet) and the greatest level it builds to. */
  level: number;
  plot: number | null;
  shipMax: number;
  max: number;
  ships: OwnShipView[];
  offers: (BaseCostView & { role: OwnRole; classId: ShipClassId; why: string | null })[];
  /** The squadron: her own ships at sea, hired escorts, and all the berths she has. */
  squadron: { own: number; ownMax: number; hired: number; berths: number };
  busy: boolean;
}

/** What the glass tells of a ship's hold (docs/12 P6). */
export interface AppraisalView {
  id: number;
  value: number;
  fill: number;
  escorts: number;
  crew: number;
  /** From the clerk's manifest: the figure is exact and her port of call known. */
  exact: boolean;
  dest: string | null;
}

/** A tip in the tavern: a merchant who will put out at the hour given. */
/** A merchant house's run (docs/16 #12): buy here, sell there by the deadline, paid more the sooner she comes. */
export interface TradeRunView {
  id: string;
  house: number; // index into RUN_HOUSES
  leg: number; // 1..RUN_LEGS
  good: GoodId;
  qty: number;
  from: string;
  to: string;
  /** Silver a unit the consignee pays at the far end. */
  pay: number;
  /** What a unit costs here now (the market's asking price), for an offer. */
  cost: number;
  /** The most the speed bonus pays. */
  bonus: number;
  window: number;
  /** World time: the full bonus until `early`, nothing after `deadline`. */
  early: number;
  deadline: number;
  dist: number;
}

/** A lot of the trophy auction (docs/16 #13). */
export interface AuctionLotView {
  id: string;
  item: Item;
  seller: string | null; // a captain's name, or null for the house
  mine: boolean;
  bid: number; // standing bid (or the opening price when no one has bid)
  bids: number;
  leader: string | null;
  leading: boolean;
  endsAt: number; // the house's wall clock, ms (only a late bid moves it)
  next: number; // the least she may bid now
  worth: number;
}

export interface AuctionView {
  lots: AuctionLotView[];
  /** Pieces of her own she may put up (not bound, not worn), and how many of hers are on the block. */
  own: number;
  cut: number;
  /** The house's wall clock now (ms), to count the lots down by. */
  wall: number;
}

/** A whisper on offer in the tavern (docs/16 #14): what it is about and how sure the teller is. */
export interface HearsayOfferView {
  id: string;
  kind: HearsayKind;
  reliability: Reliability;
  price: number;
  /** A hint of where: the bearing and the distance from here. */
  bearing: number;
  km: number;
  bought: boolean;
}

/** A whisper she paid for: the mark it puts on her chart. */
export interface HearsayView {
  id: string;
  kind: HearsayKind;
  reliability: Reliability;
  x: number;
  y: number;
  r: number;
  /** A caravan's heading when she was seen (radians, 0 = north) and her speed. */
  heading?: number;
  speed?: number;
  name: string;
  t: number; // world time heard
  expiresAt: number;
}

/** Repairs at sea set against the yard's (docs/16 #15). */
export interface SeaRepairView {
  hullPerMin: number;
  sailsPerMin: number;
  /** Minutes her carpenters would need for all of it, and what they would use. */
  minutes: number;
  planks: number;
  cloth: number;
  havePlanks: number;
  haveCloth: number;
}

export interface TipView {
  id: string;
  good: GoodId;
  cls: ShipClassId;
  level: number;
  from: string;
  to: string;
  departIn: number;
  value: number;
  cost: number;
  bought: boolean;
}

/** The raider's own (docs/12 P6): the Brethren's rank, the tipped merchants at sea, the heat of the seas' lanes. */
export interface RaidView {
  fame: number;
  rank: number;
  next: number;
  honour: number;
  tributes: number;
  convoys: number;
  marks: { id: number; x: number; y: number }[];
  heat: Partial<Record<RegionId, number>>;
  /** The League convoys she knows of (docs/16 #6): heard of as they sailed, seen, or escorted. */
  known: ConvoyView[];
}

/** A League convoy on a captain's chart (docs/16 #6). */
export interface ConvoyView {
  id: number;
  /** Where its lead ship is now. */
  x: number;
  y: number;
  from: string;
  to: string;
  level: number;
  /** Merchantmen still sailing, of how many; its own escorts afloat. */
  hulls: number;
  size: number;
  escorts: number;
  /** Its route from port to port, a few points. */
  route: [number, number][];
  /** In her sight now. */
  seen: boolean;
  /** She sails as its escort, for this pay on arrival. */
  mine: boolean;
  pay: number;
  /** Under a raider's guns in the last half-minute. */
  raided: boolean;
}

/** A poster on the board of the wanted (docs/12 P5). */
export interface WantedPoster {
  id: string;
  name: string;
  ship: string;
  level: number;
  cls: ShipClassId;
  bounty: number;
  portrait: string;
  hue: number;
  baron: boolean;
  trick: string;
  temper: string;
  time: string;
  weather: string;
  /** Sunk, and not yet back under a new flag. */
  down: boolean;
  seen: { region: RegionId; ago: number } | null;
  atSea: boolean;
  informant: number;
  lair: string | null;
}

/** A hunter's own (docs/12 P5): the guild's rank, the informant's word, the wanted in sight, the trail of rogues. */
export interface WantedView {
  points: number;
  rank: number;
  next: number;
  captains: number;
  seas: Partial<Record<RegionId, number>>;
  informed: { id: string; x: number; y: number; sec: number } | null;
  sight: { id: string; x: number; y: number }[];
  rogues: { name: string; x: number; y: number; r: number }[];
  /** Lairs within a few miles: where, how much of the battery stands (0..1), open to a landing. */
  lairs: LairView[];
  /** The named pirates with a grudge against her, and the heads she has taken (docs/12 P10 #1). */
  nemeses: NemesisView[];
  heads: number;
}

/** A pirate lair's fortress as a captain near it sees it (docs/16 #7). */
export interface LairView {
  id: string;
  x: number;
  y: number;
  /** The battery's strength left, 0..1; open to a landing (silenced, the garrison sunk, not yet stormed). */
  hp: number;
  open: boolean;
  /** The island, the named captain it belongs to, the fort's level. */
  name: string;
  captain: string;
  level: number;
  /** Its guns on the shore. */
  guns: [number, number][];
  /** The garrison's ships afloat. */
  garrison: number;
  /** Stormed and empty until it is rebuilt. */
  stormed: boolean;
}

/** What a stormed lair's chest held (docs/16 #7). */
export interface LairChestView {
  island: string;
  captain: string;
  silver: number;
  prisoners: number;
  item: { name: string; rarity: number; base: string } | null;
  map: string | null;
}

/** A captain's orca calf (docs/12 P10 #2). */
export interface CompanionView {
  kind: 'orca';
  name: string;
  level: number;
  xp: number;
  next: number;
  harness: HarnessId | null;
  made: HarnessId[];
}

/** A ship's companions as the sea sees them: the calf's level, the pet on deck. */
export interface PetView {
  ship: number;
  orca?: number;
  deck?: PetId;
  /** A good omen swimming alongside (docs/16 #9). */
  pod?: PodKind;
}

/** The beasts that may run alongside a ship for a while as a good omen (docs/16 #9). */
export type PodKind = 'dolphins' | 'humpback' | 'orcas';

/** The Regatta of Equal Waters as a captain sees it (docs/12 P10 #5). */
export interface RegattaView {
  port: string;
  phase: 'signup' | 'running' | 'done';
  startsIn: number;
  signedUp: boolean;
  buoys: [number, number][];
  /** The buoy she sails for (null: not racing). */
  next: number | null;
  passed: number;
  time: number | null;
  entrants: number;
  records: { name: string; sec: number }[];
}

/** A captain's island as her guest sees it (docs/12 P10 #13). */
export interface HallView {
  island: number;
  name: string;
  owner: string;
  mine: boolean;
  trophies: { flag: number; skull: number; fish: number; heads: number };
  records: { fish: string; kg: number }[];
  people: Record<string, number>;
  tavern: boolean;
  guestbook: { name: string; text: string; at: number }[];
  invited: string[];
  week: { owner: string; island: string; score: number }[];
}

/** The Flying Dutchman's week as a captain sees it (docs/12 P10 #10). */
export interface DutchmanView {
  week: number;
  pages: { i: number; x: number; y: number; island: string; taken: boolean; text: string | null }[];
  battle: { x: number; y: number; island: string } | null;
  winner: string | null;
  nextIn: number | null;
}

/** The Atlas of Sea Wonders (docs/12 P10 #8): what she has found, and the wonders near her to draw. */
export interface WondersView {
  total: number;
  found: { id: string; kind: WonderKind; name: string; region: RegionId; x: number; y: number; first: string | null; canName: boolean }[];
  near: { id: string; kind: WonderKind; x: number; y: number }[];
}

/** A map posted on a port's board (docs/12 P10 #7). */
export interface MapBoardView {
  id: number;
  name: string;
  seller: string;
  price: number;
  mine: boolean;
  riddle: string | null;
  /** A captain's own buried chest (docs/16 #22), and a copy its author sells while keeping her own. */
  chest?: boolean;
  copy?: boolean;
}

/** A table of Dead Man's Dice as one of its captains sees it (docs/12 P10 #4): her own cup, the others' counts. */
export interface DiceView {
  id: number;
  stake: number;
  pot: number;
  phase: 'open' | 'play' | 'done';
  davy: boolean;
  turn: number;
  bid: { q: number; f: number; by: number } | null;
  sec: number;
  seats: { name: string; dice: number; npc: boolean; me: boolean; cup?: number[] }[];
  host: boolean;
  log: string[];
  reveal: { cups: number[][]; face: number; count: number; loser: number } | null;
  winner: number | null;
}

/** The pets a captain has, and the one on deck (docs/12 P10 #3). */
export interface PetsOwnView {
  owned: PetId[];
  deck: PetId | null;
}

/** A nemesis as his captain knows him. */
export interface NemesisView {
  id: string;
  rank: number;
  epithet: string;
  scars: NemesisCause[];
  lost: number;
  fled: number;
  lastAt: number;
}

/** The hunt for one captain (docs/12 P4): the beast on her line, the carcass she flenses, one alongside to flense. */
export interface HuntView {
  line?: { beast: BeastId; level: number; tension: number; stamina: number; spent: boolean; snap: number; slack: number; good: [number, number]; payIn: number; hull: number };
  flense?: { id: number; beast: BeastId; progress: number };
  carcass?: { id: number; beast: BeastId };
}

/** A carcass afloat: its blood in the water while it is fresh or being flensed. */
export interface CarcassView {
  id: number;
  beast: BeastId;
  x: number;
  y: number;
  h: number;
  progress: number;
  blood: boolean;
}

export interface ShoalView {
  id: number;
  x: number;
  y: number;
  r: number;
  /** How much is left of it, 0..1. */
  full: number;
  fish?: FishId;
}

/** A fish on the line: the client plays the same fight from the kind, weight and seed. */
export interface FishFightView {
  id: number;
  fish: FishId;
  kg: number;
  seed: number;
  craft: number;
}

/** A net cast (owner, 2026-09-30): the client plays the floats from the seed; `fish` when the water is read. */
export interface NetHaulView {
  id: number;
  seed: number;
  craft: number;
  method: 'net' | 'lamp';
  fish?: FishId;
}

/** The fishing part of a captain's papers. */
export interface FishingView {
  skill: number;
  xp: number;
  next: number;
  caught: Partial<Record<FishId, { n: number; best: number }>>;
  traps: { id: number; x: number; y: number; placed: number; island: string }[];
  /** The tackle in her slot, if any. */
  method: FishMethod | null;
}

/** A sign on the horizon (docs/12 P2): something is happening there. */
export interface SightView {
  id: number;
  kind: SightKind;
  x: number;
  y: number;
}

/** An island scene or mini-game (2026-09-30), as far as its captain may see it: the words come from the shared data,
 * the dice, the calls and the prices from the server. `result` once it is settled. */
export interface MinigameView {
  id: number;
  def: MinigameId;
  /** The tale's step, or 'play' (and 'counter' at a haggle). */
  step: string;
  /** Riddles and the stars: the questions asked (indices into the pool), how many are answered, each one's option order. */
  q?: number[];
  qi?: number;
  order?: number[][];
  stake?: number;
  /** Liar's dice: her own five, and the keeper's bid [count, face 1..6]. */
  dice?: number[];
  bid?: [number, number];
  /** Memory: the call to repeat (symbol indices). */
  seq?: number[];
  /** Three shells: where the pearl starts and the swaps (0: left-middle, 1: middle-right, 2: left-right). */
  pea?: number;
  swaps?: number[];
  /** Timing: the needle's period (ms) and phase (0..1) for each try, and the tries so far. */
  period?: number[];
  phase?: number[];
  hits?: boolean[];
  /** The haggle: the price asked, and the lot. */
  price?: number;
  item?: Item;
  /** The stakes and purses are smaller: the shores have heard of her. */
  weary?: boolean;
  result?: { outcome: string; win: boolean; vars: MinigameVars };
}

export interface MinigameVars {
  silver?: number;
  lost?: number;
  stake?: number;
  n?: number;
  good?: GoodId;
  item?: Item;
  crew?: number;
  roll?: number[];
  count?: number;
  map?: boolean;
  xp?: number;
}

/** An encounter's card, open: the client draws its words from the shared data. */
export interface EncounterView {
  id: number;
  def: EncounterId;
}

/** A captain on one's list of friends (docs/11 P6): who is at sea, at what level, in which waters or port. */
export interface FriendView {
  name: string;
  online: boolean;
  level?: number;
  captain?: CaptainId;
  region?: RegionId;
  docked?: string | null;
}

export const FRIENDS_MAX = 50;

/** A captain at sea as the "who is at sea" search shows them (docs/11 P6). */
export interface WhoView {
  name: string;
  level: number;
  captain: CaptainId;
  region: RegionId;
  docked: string | null;
  guild?: string;
  grouped: boolean;
}

export const WHO_MAX = 30;

/** A new captain, whom a veteran may take under their wing (the mentor's bonus, docs/11 P6). */
export const FRESH_LEVEL = 9;

/** A captain as another sees them on inspecting (docs/11 P6): no purse, no hold, nothing private. */
export interface InspectView {
  name: string;
  level: number;
  captain: CaptainId;
  title: string | null;
  guild: { name: string; tag: string } | null;
  ship: { name: string; classId: ShipClassId; level?: number };
  region: RegionId;
  deeds: number;
  seasonLevel: number;
  questsDone: number;
  contracts: number;
  mentored: number;
  rating: number;
  wanted: number;
  /** What they wear, ship and captain (docs/12 P1). */
  gear?: Item[];
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
  /** The guild finder (docs/11 P6): the recruiting note, and (for commodores and up) the requests to join. */
  recruit?: string | null;
  /** The guild's word of the day (docs/11 P6). */
  motd?: string;
  requests?: { account: number; name: string; level: number; note: string; online: boolean }[];
}

/** A recruiting guild as a captain with no guild sees it (docs/11 P6). */
export interface RecruitView {
  id: number;
  name: string;
  tag: string;
  members: number;
  note: string;
  applied: boolean;
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
  /** Bought outright (docs/12 P7): no lease, no sieges. */
  owned?: boolean;
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

// ------------------------------------------------------------------ batch E of docs/16: islands and the shore

/** The walk across an island (docs/16 #21): the steps, the paths to choose, the last thing met and what it gave. */
export interface TrekView {
  id: number;
  island: string;
  /** Steps walked, of how many. */
  step: number;
  steps: number;
  /** The ways on from here (null while a choice or the haunt's game waits, and at the end). */
  paths: TrekPath[] | null;
  /** The thing met at this step, whether it waits for her choice, and how it went. */
  event: string | null;
  choice: boolean;
  outcome: string | null;
  vars: TrekVars;
  /** The way walked so far. */
  trail: { path: TrekPath | 'landing'; event: string; good: boolean }[];
  /** The haunt's game is open (the card waits behind it). */
  game: boolean;
  /** The far side reached: its cache. */
  end: TrekVars | null;
  done: boolean;
  /** Silver she may spend (for a price at a smugglers' fire). */
  cost?: number;
}

export interface TrekVars {
  silver?: number;
  n?: number;
  good?: GoodId;
  crew?: number;
  hands?: number;
  charted?: number;
  cost?: number;
  item?: Item;
  map?: boolean;
  xp?: number;
}

/** A lighthouse near her (docs/16 #23): lit by the Crown's keepers, for a keeper's pay, or her own island's. */
export interface LightView {
  island: number;
  name: string;
  x: number;
  y: number;
  r: number;
  lit: 'crown' | 'paid' | 'own' | null;
  until?: number;
}

/** A lookout on a headland (docs/16 #24). */
export interface LookoutView {
  island: number;
  x: number;
  y: number;
  /** She climbed it lately (world time), if she did. */
  at?: number;
}

/** A bank the tide or a season raises (docs/16 #25). `poly` only near her. */
export interface TidalView {
  id: number;
  name: number;
  kind: 'tide' | 'season';
  season: number;
  x: number;
  y: number;
  r: number;
  up: boolean;
  /** When it goes under or comes up next (world time). */
  turn: number;
  /** She has combed it this rise. */
  combed: boolean;
  poly?: number[];
}

/** One of her own buried chests (docs/16 #22), where its maps are. */
export interface CacheView {
  id: number;
  island: string;
  x: number;
  y: number;
  silver: number;
  goods: Cargo;
  buried: number;
  /** Her own copy is in her chest of maps; boards it is posted on; copies sold. */
  mapHeld: boolean;
  posted: string[];
  sold: number;
}

export interface IslesView {
  lights: LightView[];
  lookouts: LookoutView[];
  tidal: TidalView[];
  caches: CacheView[];
}

/** A captain alongside offers her a map (docs/16 #22). */
export interface MapOfferView {
  id: number;
  from: string;
  name: string;
  riddle: string | null;
  price: number;
  chest: boolean;
  until: number;
}
