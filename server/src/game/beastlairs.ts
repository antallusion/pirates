// docs/18 II on the server (items 13–24): the lairs of the land's creatures on the islands (shared/src/data/lairs.ts
// says where each stands, by the world alone) — what each captain has seen of them and the strength word over each,
// the lair's card when her boats can reach it, the battle ashore (the hex battle of docs/17 H1 on the land field, her
// landing party against the lair's creatures, no ship's guns), what a lair leaves (experience, silver, the H3 resource
// of its island, the land's resources, now and then an artifact or an egg) once a week a captain, the lair standing
// again some days of the sea later; HoMM3's offer to a far stronger army (they flee, or some sign on); the island's
// chain (shore lair → grotto → guardian → the island's chest and a line in the chronicle); the creature dwellings a
// captain flags over a beaten lair (a week's growth, hired through the H3 recruit window); the eggs she carries home to
// the pen of her town, where they hatch and grow into a kind she may hire; the creature jobs of the ports' boards.
//
// A lair is not a ship: it stands where it is, never moves off its island (docs/18 #21), and its state is the world's
// (down until it stands again, its creatures as the last fight left them). Every roll here is on this system's own Rng.

import { UNITS, armyMen, armyPower, armyWeight, isPremiumUnit } from '../../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../../shared/src/data/army.ts';
import { BEASTS, BEAST_IDS, BEAST_PLURAL, CREATURE_IDS, LAND_RES, isBeast, isCreature } from '../../../shared/src/data/bestiary.ts';
import type { BeastId, CreatureId, LandRes } from '../../../shared/src/data/bestiary.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { DWELL_MAX, DWELL_WEEKS, EGG_MAX, LAIRS, LAIR_ART, LAIR_KINDS, LAIR_RESPAWN, PEN_NESTS, buildLairs, chainChest, dwellGrowth, lairArmy, lairPay, landParty, penStage } from '../../../shared/src/data/lairs.ts';
import type { Lair, LairKind } from '../../../shared/src/data/lairs.ts';
import { ladder } from '../../../shared/src/data/shiplevel.ts';
import { PICKED_TIER, TIER_SHIP_LEVEL, mightCap, mightRoom } from '../../../shared/src/data/town.ts';
import type { DwellRow, DwellView } from '../../../shared/src/h3proto.ts';
import type { LairCard, LairClientMsg, LairLoot, LairMark, LairsView } from '../../../shared/src/lairproto.ts';
import type { TacAction } from '../../../shared/src/protocol.ts';
import { closestOnPolygon, dist, pointInPolygon } from '../../../shared/src/math.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { Rng, hashString } from '../../../shared/src/rng.ts';
import { turtlePos, turtles } from '../../../shared/src/world/drift.ts';
import { tidalIsles } from '../../../shared/src/world/tidal.ts';
import { advQuiet, parkNear } from './advmap.ts';
import { baseView, lyingOff, mine as ownBase } from './base.ts';
import { kindOfWeek, thisWeek, today, weekNow, weekView } from './calendar.ts';
import { WEEK_BEAST_LAIR, weekBeastGrowth, weekOfBeast } from '../../../shared/src/data/week.ts';
import { DWELL_UP } from '../../../shared/src/data/landecon.ts';
import { addLand, landLack, takeLand } from './landecon.ts';
import { meetCreatures } from './renown.ts';
import { reconcile } from './crew.ts';
import { giveGoods } from './director.ts';
import { dwellHooks, pickedMax, pickedRoom } from './dwell.ts';
import type { Game } from './Game.ts';
import { afterBattle, artifactFind } from './hero.ts';
import { bankUp } from './isles.ts';
import { claimLair, turtleUpNow, warnLanding } from './isles18.ts';
import type { PlayerSession, Profile } from './player.ts';
import { questEvent } from './quests.ts';
import { chronicle } from './renown.ts';
import { TAC_XP_PER_HP, sideOf } from './tactical.ts';
import { haulTake } from './seahaul.ts';
import { act, killedHp, lossesOf, newBattle, quickFinish, stepBattle, viewOf } from './tacbattle.ts';
import type { TacArmyEntry, TacBattle, TacSideInput } from './tacbattle.ts';
import { keepsDeep, townHooks, townLevel, townState } from './town.ts';
import { captureOffer, captureTake, creaturesWon } from './tame.ts';
import type { CaptureOffer } from '../../../shared/src/driftproto.ts';
import type { FittingId } from '../../../shared/src/data/landecon.ts';
import type { Yard } from './base.ts';

/** What a captain keeps of the lairs (docs/18 II). */
export interface LairProfile {
  /** Each lair's loot taken: the calendar week + 1 (once a week a captain, as a guard's chest). */
  v: Record<string, number>;
  /** The lairs she has seen (they stay on her charts). */
  seen: string[];
  /** The land's resources in her store. */
  res: Record<LandRes, number>;
  /** The eggs and the young she carries (to lay in her town's pen). */
  eggs: BeastId[];
  /** The islands whose chain she has cleared (the chronicle's line is written once), and the week of each chest. */
  chains: number[];
  chest: Record<string, number>;
  /** The creatures she has cut down, by kind (the bestiary's count, docs/18 #46). */
  kills: Partial<Record<BeastId, number>>;
  /** docs/18 #43: the ship's fittings of the land's resources she has had made (a rank each). */
  fit?: Partial<Record<FittingId, number>>;
  /** docs/18 #49: the lairs' battles ashore she has fought to their end (the First Watch's step). */
  landed?: number;
}

export function lairsOf(p: Profile): LairProfile {
  const l = (p.lairs ??= { v: {}, seen: [], res: { shell: 0, bone: 0, venom: 0 }, eggs: [], chains: [], chest: {}, kills: {} });
  l.v ??= {};
  if (!Array.isArray(l.seen)) l.seen = [];
  l.res ??= { shell: 0, bone: 0, venom: 0 };
  for (const r of LAND_RES) l.res[r] = Math.max(0, Math.floor(l.res[r] ?? 0));
  if (!Array.isArray(l.eggs)) l.eggs = [];
  l.eggs = l.eggs.filter((e) => isBeast(e));
  if (!Array.isArray(l.chains)) l.chains = [];
  l.chest ??= {};
  l.kills ??= {};
  return l;
}

// ------------------------------------------------------------------------------------------------ the world's state

interface LairState {
  /** World seconds it was beaten (fled, signed on); it stands again LAIR_RESPAWN of its role later. */
  down?: number;
  /** Its creatures as the last fight it won left them, and when (they are whole again a respawn later). */
  army?: ArmyStack[];
  at?: number;
}

/** A creature dwelling flagged over a beaten lair (docs/18 #19): whose, her name, what waits, the week grown to. */
interface DwellState {
  owner: number;
  name: string;
  pool: number;
  w: number;
  /** docs/18 #43: settled for shell and bone (2): half as many again a week, three weeks kept, bone a week. */
  lv?: number;
}

interface Store {
  st: Record<string, LairState>;
  dw: Record<string, DwellState>;
}

/** A battle ashore under way (one a captain). */
interface LandFight {
  lair: string;
  bt: TacBattle;
  rng: Rng;
  seq: number;
  done: boolean;
  closeAt: number;
  retreat: boolean;
  loot?: LairLoot;
  xp: number;
  /** docs/18 IV: a fight that is not a lair's — a drift's at sea (its field, its name, its end). */
  ext?: ExtFight;
  /** docs/18 #36: the beaten who would follow her, until she chooses. */
  capture?: CaptureOffer;
}

/** A creature fight of another system on the same battle ashore (docs/18 IV: a drift's at sea). */
export interface ExtFight {
  /** The field's kind of ground, the creature's id for the screen, the place's name, its level. */
  type: string;
  kind: string;
  place: string;
  level: number;
  /** The fight is over (won or not): what it left her, if anything. */
  onEnd: (game: Game, s: PlayerSession, won: boolean, bt: TacBattle) => LairLoot | undefined;
  /** docs/19 D7: the share of the battle's own lesson she has (a roaming stack's: less a blow, none for a grey one). */
  xpMul?: number;
}

interface L18 {
  lairs: Lair[];
  byId: Map<string, Lair>;
  /** docs/19 D6: the lairs that keep their place in cells of CELL metres, the turtles' apart; each lair's index. */
  cells: Map<number, Lair[]>;
  moving: Lair[];
  index: Map<string, number>;
  byIsland: Map<number, Lair[]>;
  store: Store;
  fights: Map<number, LandFight>;
  rng: Rng;
  told: WeakMap<PlayerSession, string>;
  cards: WeakMap<PlayerSession, string>;
  seen: WeakMap<PlayerSession, Set<string>>;
}

const KEY = 'h18:lairs';
const all = new WeakMap<Game, L18>();
/** The lairs kept still for a game (the tick's A/B measure; the tests of other systems keep them still with the
 *  adventure map, advQuiet). */
const still = new WeakSet<Game>();
export function quietLairs(game: Game, on = true): void {
  if (on) still.add(game);
  else still.delete(game);
}
const quiet = (game: Game): boolean => advQuiet(game) || still.has(game);

function L(game: Game): L18 {
  let x = all.get(game);
  if (!x) {
    const lairs = buildLairs(game.world);
    const byIsland = new Map<number, Lair[]>();
    for (const l of lairs) if (l.island >= 0) (byIsland.get(l.island) ?? byIsland.set(l.island, []).get(l.island)!).push(l);
    const saved = game.db.getKv<Store>(KEY);
    const cells = new Map<number, Lair[]>();
    for (const l of lairs) if (l.turtle === undefined) (cells.get(cellOf(l.x, l.y)) ?? cells.set(cellOf(l.x, l.y), []).get(cellOf(l.x, l.y))!).push(l);
    x = {
      lairs, byId: new Map(lairs.map((l) => [l.id, l])), byIsland, cells, moving: lairs.filter((l) => l.turtle !== undefined), index: new Map(lairs.map((l, i) => [l.id, i])),
      store: { st: saved?.st ?? {}, dw: saved?.dw ?? {} }, fights: new Map(), rng: new Rng(0x18a11e),
      told: new WeakMap(), cards: new WeakMap(), seen: new WeakMap(),
    };
    all.set(game, x);
  }
  return x;
}

const save = (game: Game) => game.db.setKv(KEY, L(game).store);

export const lairList = (game: Game): Lair[] => L(game).lairs;
export const lairById = (game: Game, id: string): Lair | undefined => L(game).byId.get(id);

/** The creature names the server's lines use (the client words them in Russian). */
export const lairName = (l: Lair | LairKind): string => LAIRS[typeof l === 'string' ? l : l.kind].name[0];
const beastsName = (u: BeastId): string => BEAST_PLURAL[u][0];

/** Where it stands now (a turtle island's lair rides on her back). */
export function lairPos(game: Game, l: Lair): { x: number; y: number } {
  if (l.turtle !== undefined) {
    const d = turtles(game.world)[l.turtle];
    if (d) return turtlePos(d, game.now);
  }
  return { x: l.x, y: l.y };
}

/** It is there to be fought: not beaten lately, its turtle or its sandbar above the sea, its island nobody's home. */
export function lairUp(game: Game, l: Lair): boolean {
  const st = L(game).store.st[l.id];
  if (st?.down !== undefined && game.now < st.down + LAIR_RESPAWN[l.role]) return false;
  return lairThere(game, l);
}

/** Its ground is there at all (a turtle up, a sandbar bared, an island not settled by a captain). */
function lairThere(game: Game, l: Lair): boolean {
  if (l.turtle !== undefined) {
    const d = turtles(game.world)[l.turtle];
    return !!d && turtleUpNow(game, d);
  }
  if (l.bank !== undefined) {
    const b = tidalIsles(game.world)[l.bank];
    return !!b && bankUp(game, b);
  }
  return !game.holdings.get(game, l.island);
}

/** Its creatures now: as its last won fight left them (whole again a respawn later), else its full number. */
export function lairMen(game: Game, l: Lair): ArmyStack[] {
  const st = L(game).store.st[l.id];
  if (st?.army && st.at !== undefined && game.now < st.at + LAIR_RESPAWN[l.role]) return st.army.map((x) => ({ ...x }));
  const men = lairArmy(l.kind, l.level, l.size);
  // docs/18 #45: the week of its kind — a quarter more of them (a grotto's and a guardian's own stay as they are).
  if (lairWeek(game, l)) men.forEach((x, i) => (x.n = l.role !== 'shore' && i === 0 ? x.n : Math.max(1, Math.round(x.n * WEEK_BEAST_LAIR))));
  return men;
}

/** docs/18 #45: this week is named for the lair's own kind. */
export const lairWeek = (game: Game, l: Lair): boolean => weekOfBeast(weekNow(game), LAIRS[l.kind].mix[0][0]);

/** The lair is gone (beaten, fled or signed on): it stands again a respawn later. */
function lairGone(game: Game, l: Lair): void {
  L(game).store.st[l.id] = { down: game.now };
  save(game);
}

function islandName(game: Game, l: Lair): string {
  if (l.turtle !== undefined) return turtles(game.world)[l.turtle]?.name[0] ?? 'the turtle island';
  if (l.bank !== undefined) return 'a sandbar';
  return game.world.islands[l.island]?.name ?? 'an island';
}

// ------------------------------------------------------------------------------------------------ reach and the offer

/** Within reach of the boats at a lair (and, a card's reach, of seeing it close). */
export const LAIR_CARD_R = 900;
const LAND_REACH = 260;
const SEE_R = 2600;
/** docs/19 D6: the cells the lairs are kept in for the lookouts' sweep (as wide as their sight). */
const CELL = 2600;
const cellOf = (x: number, y: number): number => Math.floor(y / CELL) * 1000 + Math.floor(x / CELL);
/** The lairs about a point: its cell and the eight round it, and the turtles' (they move). */
function lairsAbout(S: L18, x: number, y: number): Lair[] {
  const out: Lair[] = [...S.moving];
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const l of S.cells.get((cy + dy) * 1000 + cx + dx) ?? []) out.push(l);
  return out;
}

/** The boats can reach the lair's shore from where she lies. */
function inReach(game: Game, s: PlayerSession, l: Lair): boolean {
  const ship = s.ship!;
  const x = ship.state.x, y = ship.state.y;
  if (l.turtle !== undefined) {
    const p = lairPos(game, l);
    const d = turtles(game.world)[l.turtle];
    return dist(p.x, p.y, x, y) <= (d?.r ?? 160) + LAND_REACH;
  }
  if (l.bank !== undefined) {
    const b = tidalIsles(game.world)[l.bank];
    return !!b && dist(b.x, b.y, x, y) <= b.r + LAND_REACH;
  }
  const is = game.world.islands[l.island];
  return !!is && dist(l.x, l.y, x, y) <= LAIR_CARD_R + 200 && Math.sqrt(closestOnPolygon(x, y, is.poly).d2) <= LAND_REACH;
}

/** The men she would land (all but a watch left aboard). */
function partyOf(game: Game, s: PlayerSession): TacArmyEntry[] {
  return landParty(sideOf(game, s.ship!, s.ship!, true).army ?? []);
}

/** Her party's might against the lair's (the ladder counted, as the boarding battle reckons it). */
export function lairRatio(game: Game, s: PlayerSession, l: Lair): number {
  const ship = s.ship!;
  const mine = armyPower(partyOf(game, s)) * (0.5 + ship.morale / 100) * (ladder(ship.shipLevel, l.level, false).dealt || 0.1);
  const theirs = armyPower(lairMen(game, l)) * 1.2 * (ladder(l.level, ship.shipLevel, false).dealt || 0.1);
  return mine / Math.max(1, theirs);
}

/** HoMM3's neutrals before a far stronger army (×3): they flee, or half of them sign on (by the lair's own hash for the
 *  week) — beasts that can, men of the Choir only with the Choir's and the cursed, the guardians never. */
export function lairOffer(game: Game, s: PlayerSession, l: Lair): 'join' | 'flee' | null {
  if (lairRatio(game, s, l) < 3) return null;
  const j = LAIRS[l.kind].join;
  if (j === 'never') return 'flee';
  if (j === 'deep' && !keepsDeep(s)) return 'flee';
  return hashString(`ljoin:${l.id}:${thisWeek(game)}`) % 10 < 6 ? 'join' : 'flee';
}

/** The creatures who would sign on: half of each stack, as her hammocks and her slots take them. */
export function lairJoiners(game: Game, s: PlayerSession, l: Lair): ArmyStack[] {
  const ship = s.ship!;
  let room = Math.max(0, ship.stats.crewMax - ship.crew);
  let slots = ship.armySlots - ship.army.length;
  const out: ArmyStack[] = [];
  for (const x of lairMen(game, l)) {
    if (room <= 0) break;
    const own = ship.army.some((y) => y.u === x.u) || out.some((y) => y.u === x.u);
    if (!own && slots <= 0) continue;
    const n = Math.min(room, Math.max(1, Math.floor(x.n / 2))); // half of them, one at the least
    if (n <= 0) continue;
    if (!own) slots--;
    room -= n;
    const o = out.find((y) => y.u === x.u);
    if (o) o.n += n;
    else out.push({ u: x.u, n });
  }
  return out;
}

const week1 = (game: Game) => thisWeek(game) + 1;

/** The chain's earlier step not beaten by her this week: why this one may not be fought yet. */
function chainWhy(game: Game, s: PlayerSession, l: Lair): string | null {
  if (!l.chain) return null;
  const prev = l.chain === 1 ? `l${l.island}s` : `l${l.island}g`;
  if (lairsOf(s.profile!).v[prev] === week1(game)) return null;
  return l.chain === 1 ? 'Clear the shore lair first: the grotto lies beyond it.' : 'Clear the grotto first: the guardian lies at the heart of the island.';
}

/** Why she cannot land against it now (null: she can). */
function fightWhy(game: Game, s: PlayerSession, l: Lair, force = false): string | null {
  const ship = s.ship;
  if (!ship || ship.docked) return 'Put to sea first.';
  if (ship.boarding || ship.landing) return 'Not now';
  if (L(game).fights.has(s.accountId)) return 'Your party is ashore already.';
  if (!lairUp(game, l)) return 'They are gone';
  if (ship.inCombat(game.now) && !force) return 'Not while under fire';
  if (!inReach(game, s, l)) return 'Come in to the shore: within the boats’ reach.';
  if (ship.state.speed > 2.5) return 'Heave to first — the boats cannot be lowered at speed';
  if (ship.crew < 3) return 'Too few hands to spare a landing party';
  return chainWhy(game, s, l);
}

// ------------------------------------------------------------------------------------------------ the card

function dwellOf(game: Game, s: PlayerSession, l: Lair): LairCard['dwell'] | undefined {
  const def = LAIRS[l.kind];
  if (!def.dwell || l.island < 0) return undefined;
  const d = L(game).store.dw[l.id];
  const u = def.mix[0][0];
  const own = d?.owner === s.accountId;
  if (!d && lairsOf(s.profile!).v[l.id] !== week1(game)) return undefined;
  const why = own ? null : flagWhy(game, s, l);
  const lv = d?.lv ?? 1;
  const tier = UNITS[u].tier;
  return {
    u, owner: d?.name ?? null, own, pool: d ? Math.floor(dwellPool(game, d, u)) : 0, growth: Math.round(dwellWeek(game, d, u) * 10) / 10, can: !own && !why, why,
    ...(own ? { lv, up: lv < 2 ? DWELL_UP.cost(tier) : null, upWhy: lv < 2 ? settleWhy(game, s, l) : null, upkeep: DWELL_UP.upkeep(tier) } : {}),
  };
}

function card(game: Game, s: PlayerSession, l: Lair): LairCard {
  const men = lairMen(game, l);
  const up = lairUp(game, l);
  const offer = up ? lairOffer(game, s, l) : null;
  const p = lairsOf(s.profile!);
  const pay = lairPay(l.kind, l.level, l.size, l.type, l.mul * (lairWeek(game, l) ? WEEK_BEAST_LAIR : 1));
  const st = L(game).store.st[l.id];
  const chainSteps = l.chain !== undefined ? [`l${l.island}s`, `l${l.island}g`, `l${l.island}G`].map((id) => p.v[id] === week1(game)) : undefined;
  const dw = dwellOf(game, s, l);
  return {
    id: l.id, kind: l.kind, role: l.role, size: l.size, level: l.level, island: islandName(game, l), men: armyMen(men), stacks: men.map((x) => ({ u: x.u, n: x.n })),
    ratio: Math.round(lairRatio(game, s, l) * 10) / 10, party: armyMen(partyOf(game, s)), offer, joinN: offer === 'join' ? armyMen(lairJoiners(game, s, l)) : 0,
    reach: inReach(game, s, l), why: up ? fightWhy(game, s, l) : null, pay: { silver: pay.silver, xp: pay.xp }, ...(lairWeek(game, l) ? { week: true } : {}),
    ...(p.v[l.id] === week1(game) ? { looted: true } : {}),
    ...(!up && st?.down !== undefined ? { down: Math.max(0, Math.round(st.down + LAIR_RESPAWN[l.role] - game.now)) } : {}),
    ...(chainSteps ? { chain: { step: l.chain!, done: chainSteps } } : {}),
    ...(dw ? { dwell: dw } : {}),
  };
}

/** The lair her card is about: the nearest within its reach that stands (or that she may flag, or hire at). */
function cardLair(game: Game, s: PlayerSession): Lair | null {
  const ship = s.ship;
  if (!ship || ship.docked || ship.boarding || !s.profile) return null;
  if (quiet(game)) return null;
  const S = L(game);
  let best: Lair | null = null, bd = LAIR_CARD_R;
  for (const l of S.lairs) {
    const p = l.turtle !== undefined ? lairPos(game, l) : l;
    if (Math.abs(p.x - ship.state.x) > bd || Math.abs(p.y - ship.state.y) > bd) continue;
    const d = dist(p.x, p.y, ship.state.x, ship.state.y);
    if (d > bd) continue;
    if (l.island >= 0 && game.world.islands[l.island]?.hidden && !s.discovered.has(l.island)) continue;
    if (!lairUp(game, l) && !(LAIRS[l.kind].dwell && (S.store.dw[l.id] || lairsOf(s.profile).v[l.id] === week1(game)) && lairThere(game, l))) continue;
    [best, bd] = [l, d];
  }
  return best;
}

export function sendLairCard(game: Game, s: PlayerSession, force: boolean): void {
  const S = L(game);
  const fighting = S.fights.has(s.accountId);
  const l = fighting ? null : cardLair(game, s);
  const c = l ? card(game, s, l) : null;
  const key = c ? JSON.stringify({ ...c, down: c.down ? Math.round(c.down / 30) : 0 }) : '';
  if (!force && S.cards.get(s) === key) return;
  if (S.cards.get(s) === key && key === '') return;
  S.cards.set(s, key);
  game.sendTo(s, { t: 'lair_card', card: c });
}

/** The land key's prompt off a lair (null: none in reach). */
export function lairPrompt(game: Game, s: PlayerSession): { island: string; feature: string; action: 'lair'; lv: number; danger?: 'warn' | 'deadly'; blocked?: string } | null {
  const l = cardLair(game, s);
  if (!l || !lairUp(game, l) || !inReach(game, s, l)) return null;
  const d = l.level - (s.ship?.shipLevel ?? 1);
  const why = chainWhy(game, s, l);
  return { island: islandName(game, l), feature: lairName(l), action: 'lair', lv: l.level, ...(d >= 3 ? { danger: 'deadly' as const } : d >= 2 ? { danger: 'warn' as const } : {}), ...(why ? { blocked: why } : {}) };
}

/** The land key off a lair: the boats go ashore against it (undefined: no lair here, the landing goes on as ever). */
export function lairLanding(game: Game, s: PlayerSession): string | null | undefined {
  if (quiet(game)) return undefined;
  const l = cardLair(game, s);
  if (!l || !lairUp(game, l) || !inReach(game, s, l)) return undefined;
  return startFight(game, s, l.id);
}

// ------------------------------------------------------------------------------------------------ what she sees

function seenOf(game: Game, s: PlayerSession): Set<string> {
  const S = L(game);
  let set = S.seen.get(s);
  if (!set) S.seen.set(s, (set = new Set(lairsOf(s.profile!).seen)));
  return set;
}

function marksOf(game: Game, s: PlayerSession): LairsView {
  const S = L(game);
  const seen = seenOf(game, s);
  const list: LairMark[] = [];
  // (her seen ones, in the world's order: docs/19 D6 — not a walk over every lair)
  const mine = [...seen].map((id) => S.byId.get(id)).filter((l): l is Lair => !!l).sort((a, b) => S.index.get(a.id)! - S.index.get(b.id)!);
  for (const l of mine) {
    if (!lairThere(game, l)) continue;
    const p = lairPos(game, l);
    const d = S.store.dw[l.id];
    list.push({
      id: l.id, kind: l.kind, role: l.role, x: Math.round(p.x), y: Math.round(p.y), level: l.level, men: armyMen(lairMen(game, l)), down: !lairUp(game, l), island: l.island,
      ...(d ? { flag: d.owner === s.accountId ? 'own' as const : 'other' as const } : {}), ...(l.turtle !== undefined ? { turtle: l.turtle } : {}), ...(l.bank !== undefined ? { bank: l.bank } : {}),
      ...(l.chain !== undefined ? { chain: l.chain } : {}),
    });
  }
  const p = lairsOf(s.profile!);
  return { list, res: { ...p.res }, eggs: [...p.eggs] };
}

export function sendLairs(game: Game, s: PlayerSession, force: boolean): void {
  if (!s.profile) return;
  const S = L(game);
  const v = marksOf(game, s);
  const key = JSON.stringify(v);
  if (!force && S.told.get(s) === key) return;
  S.told.set(s, key);
  game.sendTo(s, { t: 'lairs', view: v });
}

/** Every second: what each captain at sea has newly seen, her marks (every other second) and her card. */
export function stepLairs(game: Game): void {
  if (quiet(game)) return;
  const S = L(game);
  const even = Math.floor(game.now) % 2 === 0;
  for (const s of game.sessions) {
    if (!s.profile || !s.ship) continue;
    const ship = s.ship;
    if (!ship.docked) {
      const seen = seenOf(game, s);
      let more = false;
      const x = ship.state.x, y = ship.state.y;
      for (const l of lairsAbout(S, x, y)) {
        if (seen.has(l.id)) continue;
        const p = l.turtle !== undefined ? lairPos(game, l) : l;
        if (Math.abs(p.x - x) > SEE_R || Math.abs(p.y - y) > SEE_R || dist(p.x, p.y, x, y) > SEE_R) continue;
        if (l.island >= 0 && game.world.islands[l.island]?.hidden && !s.discovered.has(l.island)) continue;
        seen.add(l.id);
        more = true;
      }
      if (more) lairsOf(s.profile).seen = [...seen];
    }
    if (even || !S.told.has(s)) sendLairs(game, s, false);
    sendLairCard(game, s, false);
  }
}

// ------------------------------------------------------------------------------------------------ 15. the battle ashore

/** The boats go ashore against a lair: the battle opens on the land field, her party against its creatures. */
export function startFight(game: Game, s: PlayerSession, id: string, force = false): string | null {
  const S = L(game);
  const l = S.byId.get(id);
  if (!l) return 'Nothing here';
  const why = fightWhy(game, s, l, force);
  if (why) return why;
  const ship = s.ship!;
  const base = sideOf(game, ship, ship, true);
  const party = landParty(base.army ?? []);
  if (!party.length) return 'Too few hands to spare a landing party';
  const a: TacSideInput = { ...base, army: party, holes: 0, gunsOut: 0, fire: false, castle: false, struck: false, dealt: ladder(ship.shipLevel, l.level, false).dealt || 0.1 };
  const men = lairMen(game, l);
  const main = LAIRS[l.kind].mix[0][0];
  const b: TacSideInput = {
    name: lairName(l), ship: islandName(game, l), captain: null, hands: 0, marines: 0, gunners: 0, army: men.map((x) => ({ u: x.u, n: x.n, src: x.u })), officers: [], skill: 3,
    morale: 50, dealt: ladder(l.level, ship.shipLevel, false).dealt || 0.1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false,
    human: false, noBook: true, face: BEASTS[main].art,
  };
  const seed = S.rng.int(1, 1e9);
  const rng = new Rng((seed ^ 0x1a7d) >>> 0);
  const bt = newBattle(a, b, seed, game.now, rng, { land: l.type });
  S.fights.set(s.accountId, { lair: l.id, bt, rng, seq: -1, done: false, closeAt: Infinity, retreat: false, xp: 0 });
  meetCreatures(game, s, men.map((x) => x.u)); // docs/18 #46: the bestiary's first pages
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.state.speed = 0;
  const n = armyMen(party);
  if (l.island >= 0) warnLanding(game, s, game.world.islands[l.island]); // docs/18 #28: an island above her level
  game.toastShip(ship, `Boats away: ${n} hands land on ${islandName(game, l)} against the ${lairName(l)}.`, 'info');
  sendLairCard(game, s, true);
  sendFight(game, s);
  return null;
}

export const landFighting = (game: Game, s: PlayerSession): boolean => all.get(game)?.fights.has(s.accountId) ?? false;

function sendFight(game: Game, s: PlayerSession): void {
  const f = L(game).fights.get(s.accountId);
  if (!f) return;
  const bt = f.bt;
  const loot = f.loot ? { ...f.loot, ...(f.capture ? { capture: { ...f.capture } } : {}) } : undefined;
  const result = bt.over ? { lost: lossesOf(bt, 0), killed: lossesOf(bt, 1), xp: f.xp, ...(loot ? { loot } : {}) } : undefined;
  f.seq = bt.seq;
  const land = f.ext ? { type: f.ext.type, lair: f.ext.kind, island: f.ext.place, level: f.ext.level } : (() => {
    const l = L(game).byId.get(f.lair)!;
    return { type: l.type, lair: l.kind, island: islandName(game, l), level: l.level };
  })();
  game.sendTo(s, { t: 'board_tac', view: viewOf(bt, 0, game.now, !bt.over, { ransom: null, ...(result ? { result } : {}), land }) });
}

/** docs/18 IV: a creature fight of another system laid on the battle ashore (its own end), her party against `men`. */
export function startCreatureFight(game: Game, s: PlayerSession, ext: ExtFight, name: string, men: ArmyStack[], face: string, level: number): string | null {
  const S = L(game);
  if (S.fights.has(s.accountId)) return 'Your party is ashore already.';
  const ship = s.ship!;
  const base = sideOf(game, ship, ship, true);
  const party = landParty(base.army ?? []);
  if (!party.length) return 'Too few hands to spare a landing party';
  const a: TacSideInput = { ...base, army: party, holes: 0, gunsOut: 0, fire: false, castle: false, struck: false, dealt: ladder(ship.shipLevel, level, false).dealt || 0.1 };
  const b: TacSideInput = {
    name, ship: ext.place, captain: null, hands: 0, marines: 0, gunners: 0, army: men.map((x) => ({ u: x.u, n: x.n, src: x.u })), officers: [], skill: 3,
    morale: 50, dealt: ladder(level, ship.shipLevel, false).dealt || 0.1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false,
    human: false, noBook: true, face,
  };
  const seed = S.rng.int(1, 1e9);
  const rng = new Rng((seed ^ 0xd71f) >>> 0);
  const bt = newBattle(a, b, seed, game.now, rng, { land: ext.type });
  S.fights.set(s.accountId, { lair: '', bt, rng, seq: -1, done: false, closeAt: Infinity, retreat: false, xp: 0, ext });
  meetCreatures(game, s, men.map((x) => x.u)); // docs/18 #46
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.state.speed = 0;
  sendLairCard(game, s, true);
  sendFight(game, s);
  return null;
}

/** docs/18 #36: her choice on the beaten who would follow her, while the battle's reckoning is on her screen. */
export function fightCapture(game: Game, s: PlayerSession, choice: 'take' | 'pen' | 'free'): string | null {
  const f = L(game).fights.get(s.accountId);
  if (!f?.capture) return 'Nobody waits to follow you.';
  const why = captureTake(game, s, f.capture, choice);
  sendFight(game, s);
  return why;
}

/** A captain's order in the battle ashore ('cut': back to the boats). */
export function landTac(game: Game, s: PlayerSession, action: TacAction | 'cut'): string | null {
  const f = L(game).fights.get(s.accountId);
  if (!f) return 'Nothing to fight';
  const bt = f.bt;
  if (bt.over) return 'The fight is over';
  if (action === 'cut') {
    bt.over = { winner: 1, why: 'struck' };
    bt.active = null;
    bt.seq++;
    f.retreat = true;
    settle(game, s, f);
    sendFight(game, s);
    return null;
  }
  if (!action || typeof action !== 'object') return 'No such order';
  if (action.a === 'surrender' || action.a === 'ransom') return 'Fall back to the boats instead';
  const why = act(bt, 0, action, game.now, f.rng);
  if (bt.over && !f.done) settle(game, s, f);
  sendFight(game, s);
  return why;
}

/** Every tick: the battles ashore — the creatures' turns and the clock; the end reckoned; the screen closed. */
export function stepLandFights(game: Game): void {
  const S = all.get(game);
  if (!S || !S.fights.size) return;
  for (const [acc, f] of [...S.fights]) {
    const s = game.sessionByAccount(acc);
    if (!s?.ship || !s.profile || !s.ship.alive) {
      // Gone from the sea: the party fights it out by itself.
      if (!f.done && s?.ship && s.profile) {
        quickFinish(f.bt, game.now, f.rng);
        settle(game, s, f);
      }
      S.fights.delete(acc);
      continue;
    }
    s.ship.input = { rudder: 0, sailTarget: 0 };
    if (!f.done) {
      const h = f.bt.heroes[0];
      if (!h.auto && s.disconnectedAt !== null) h.auto = true;
      stepBattle(f.bt, game.now, f.rng);
      if (f.bt.over) settle(game, s, f);
      if (f.bt.seq !== f.seq) sendFight(game, s);
    } else if (game.now >= f.closeAt) closeFight(game, s);
  }
}

/** The battle's screen closed (by her, or after a while): back to the sea. */
export function closeFight(game: Game, s: PlayerSession): void {
  const S = L(game);
  const f = S.fights.get(s.accountId);
  if (!f) return;
  if (!f.done) return;
  S.fights.delete(s.accountId);
  game.sendTo(s, { t: 'board_tac', view: null });
  sendLairCard(game, s, true);
  sendLairs(game, s, true);
  game.pushSelf(s, true);
}

/** The battle is over: her losses off the stacks they came from, the creatures' left to the lair, and — won — the
 *  lair gone and its loot. */
function settle(game: Game, s: PlayerSession, f: LandFight): void {
  if (f.done) return;
  f.done = true;
  f.closeAt = game.now + 45;
  const S = L(game);
  const bt = f.bt;
  const ship = s.ship!;
  const l = S.byId.get(f.lair)!;
  // Her landed men: the fallen off their own stacks.
  for (const st of bt.stacks) {
    if (st.side !== 0) continue;
    const d = st.start - st.count;
    if (d > 0) ship.loseFrom(st.src, d);
  }
  ship.morale = Math.max(0, Math.min(100, bt.heroes[0].morale));
  const h = bt.heroes[0];
  afterBattle(game, ship, h.mana, lossesOf(bt, 0), h.input.hero?.raise ?? 0, h.stam, h.scrollsUsed);
  const p = lairsOf(s.profile!);
  for (const x of lossesOf(bt, 1)) if (isBeast(x.u)) p.kills[x.u] = (p.kills[x.u] ?? 0) + x.n;
  if (!f.ext) p.landed = (p.landed ?? 0) + 1;
  const won = bt.over!.winner === 0 && !f.retreat;
  // docs/18 #39: her creatures that fought and won, fed, have a win more.
  if (won) creaturesWon(game, ship, bt.stacks.filter((x) => x.side === 0).map((x) => x.src));
  if (f.ext) {
    // docs/18 IV: another system's fight — its own end.
    if (won) {
      const xp = Math.round(killedHp(bt, 0) * TAC_XP_PER_HP * (f.ext.xpMul ?? 1));
      f.xp = xp;
      if (xp > 0) game.grantXp(s, xp, `Won the fight with the ${f.ext.place}`, true);
      ship.morale = Math.min(100, ship.morale + 5);
    }
    f.loot = f.ext.onEnd(game, s, won, bt);
    if (f.loot?.capture) {
      f.capture = f.loot.capture;
      delete f.loot.capture;
    }
    ship.companyKey = '';
    game.pushSelf(s, true);
    return;
  }
  if (!won) {
    // The creatures keep what is left of them until the lair is whole again.
    const left = bt.stacks.filter((x) => x.side === 1 && x.count > 0).map((x) => ({ u: x.unit, n: x.count }));
    S.store.st[l.id] = { army: left, at: game.now };
    save(game);
    game.toastShip(ship, f.retreat ? `The party falls back to the boats from the ${lairName(l)}.` : `The ${lairName(l)} throws your party back into the surf.`, 'bad');
    ship.companyKey = '';
    game.pushSelf(s, true);
    return;
  }
  lairGone(game, l);
  const xp = Math.round(killedHp(bt, 0) * TAC_XP_PER_HP);
  f.xp = xp;
  if (xp > 0) game.grantXp(s, xp, `Won the fight ashore with the ${lairName(l)}`, true);
  f.loot = lootLair(game, s, l);
  // docs/18 #36: some of the beaten may follow her (a grotto's and a guardian's never; the Choir's only their own).
  f.capture = captureOffer(game, s, lossesOf(bt, 1), lairRatio(game, s, l), LAIRS[l.kind].join);
  questEvent(game, s, { k: 'lair', island: l.island, kind: l.kind });
  ship.morale = Math.min(100, ship.morale + 8);
  ship.companyKey = '';
  game.pushSelf(s, true);
}

/** What a beaten lair leaves her (once a week of the calendar), the island's chest for the chain, the island hers. */
function lootLair(game: Game, s: PlayerSession, l: Lair): LairLoot {
  const S = L(game);
  const p = s.profile!, ship = s.ship!;
  const lp = lairsOf(p);
  const w = week1(game);
  const def = LAIRS[l.kind];
  const loot: LairLoot = { silver: 0, xp: 0, goods: [], res: {} };
  if (lp.v[l.id] === w) {
    loot.looted = true;
    game.toastShip(ship, `The ${lairName(l)} is beaten. You had its spoils this week already.`, 'good');
  } else {
    lp.v[l.id] = w;
    const pay = lairPay(l.kind, l.level, l.size, l.type, l.mul * (lairWeek(game, l) ? WEEK_BEAST_LAIR : 1));
    // docs/19 D2: twice the lairs; past her day's count (shared/src/data/seahaul.ts) their spoils are half (the
    // lesson whole).
    const thin = haulTake(game, s, 'lairs');
    if (thin < 1) {
      pay.silver = Math.max(10, Math.round((pay.silver * thin) / 10) * 10);
      pay.goods = Math.max(1, Math.round(pay.goods * thin));
      for (const r of Object.keys(pay.res) as (LandRes | 'pearls')[]) pay.res[r] = Math.max(1, Math.round((pay.res[r] ?? 0) * thin));
    }
    p.gold += pay.silver;
    game.db.ledger(s.accountId, 'lair', pay.silver, l.id);
    loot.silver = pay.silver;
    const k = giveGoods(ship, pay.good, pay.goods);
    if (k > 0) loot.goods.push({ g: pay.good, n: k });
    for (const [r, n] of Object.entries(pay.res) as [LandRes | 'pearls', number][]) {
      if (r === 'pearls') {
        const q = giveGoods(ship, 'pearls', n);
        if (q > 0) loot.res.pearls = q;
      } else {
        // docs/18 #43: the store keeps so many at most; the rest rots on the beach.
        const got = addLand(game, s, r, n).given;
        if (got > 0) loot.res[r] = got;
      }
    }
    loot.xp = pay.xp;
    game.grantXp(s, pay.xp, `Cleared the ${lairName(l)}`, true);
    // An artifact now and then (H2's finds); an egg of its own kind from the rarer lairs.
    if (S.rng.chance(LAIR_ART[l.size] * (l.role === 'guardian' ? 1.5 : 1))) {
      const it = artifactFind(game, s, 'guard');
      if (it?.art) loot.artifact = it.art;
    }
    // Never a premium kind's egg: it is had only from the shop.
    if (def.egg > 0 && lp.eggs.length < EGG_MAX && !isPremiumUnit(def.mix[0][0]) && S.rng.chance(def.egg)) {
      const u = def.mix[0][0];
      lp.eggs.push(u);
      loot.egg = u;
      game.toastShip(ship, `The party brings back a young one of the ${beastsName(u)}: lay it in the pen of your island's town.`, 'gold');
    }
    game.toastShip(ship, `The ${lairName(l)} is beaten: ${pay.silver} silver and the land's spoils.`, 'gold');
    // The island's chain (docs/18 #22): the shore lair, the grotto and the guardian this week — the island's chest.
    if (l.chain === 2 && lp.v[`l${l.island}s`] === w && lp.v[`l${l.island}g`] === w && lp.chest[l.island] !== w) {
      lp.chest[l.island] = w;
      const c = chainChest(l.level);
      p.gold += c.silver;
      game.db.ledger(s.accountId, 'lair_chest', c.silver, String(l.island));
      game.grantXp(s, c.xp, `Cleared the chain of ${islandName(game, l)}`, true);
      loot.chest = { silver: c.silver, xp: c.xp };
      if (S.rng.chance(c.art)) {
        const it = artifactFind(game, s, 'chest');
        if (it?.art) loot.chest.artifact = it.art;
      }
      game.toastShip(ship, `The chest of ${islandName(game, l)} is yours: ${c.silver} silver for the whole of its chain.`, 'gold');
      if (!lp.chains.includes(l.island)) {
        lp.chains.push(l.island);
        chronicle(game, `${s.name} has cleared ${islandName(game, l)} from its shore to its guardian.`);
      }
    }
  }
  // Every lair of the island beaten by her this week: the island is hers for a supply route (docs/18 #32).
  if (l.island >= 0) {
    const list = S.byIsland.get(l.island) ?? [];
    if (list.every((x) => lp.v[x.id] === w)) {
      claimLair(game, s.accountId, l.island, 'creature');
      loot.claimed = islandName(game, l);
    }
  }
  if (def.dwell && l.island >= 0 && S.store.dw[l.id]?.owner !== s.accountId) loot.dwell = true;
  return loot;
}

// ------------------------------------------------------------------------------------------------ 21. flee or join

export function lairChoice(game: Game, s: PlayerSession, id: string, choice: 'join' | 'flee'): string | null {
  const l = L(game).byId.get(id);
  const ship = s.ship;
  if (!l || !ship || ship.docked) return 'Nothing here';
  if (!lairUp(game, l)) return 'They are gone';
  if (!inReach(game, s, l)) return 'Come in to the shore: within the boats’ reach.';
  const offer = lairOffer(game, s, l);
  if (!offer) return 'They will not yield to you.';
  if (choice === 'join') {
    if (offer !== 'join') return 'They will not go with you.';
    const men = lairJoiners(game, s, l);
    const n = armyMen(men);
    if (n <= 0) return 'No hammocks or slots for them aboard.';
    const c = s.profile!.company;
    reconcile(game, c, ship.crew);
    for (const x of men) ship.addMen(x.u, x.n);
    c.pools.sailor += n;
    ship.companyKey = '';
    lairGone(game, l);
    game.toastShip(ship, `${n} of the ${lairName(l)} come aboard with you; the rest scatter.`, 'good');
  } else {
    lairGone(game, l);
    game.toastShip(ship, `The ${lairName(l)} sees your strength and scatters inland.`, 'good');
  }
  sendLairs(game, s, true);
  sendLairCard(game, s, true);
  game.pushSelf(s, true);
  return null;
}

// ------------------------------------------------------------------------------------------------ 19. the dwellings

/** A creature dwelling's pool grown to this week: its kind's week half as many again (docs/18 #45), settled half as
 *  many again for the bone it eats from its owner's store (docs/18 #43; a week without the bone, or her not at sea
 *  to pay it, it grows as a plain one), two weeks kept (three settled). */
function dwellPool(game: Game, d: DwellState, u: BeastId): number {
  const w = thisWeek(game);
  if (d.w < w) {
    const up = (d.lv ?? 1) >= 2;
    const g = dwellGrowth(u);
    const cap = (up ? DWELL_UP.weeks * DWELL_UP.growth : DWELL_WEEKS) * g;
    const owner = game.sessionByAccount(d.owner)?.profile;
    const need = DWELL_UP.upkeep(UNITS[u].tier);
    for (let k = Math.max(d.w + 1, w - DWELL_UP.weeks + 1); k <= w; k++) {
      let n = g * weekBeastGrowth(kindOfWeek(game, k), u);
      if (up && owner && lairsOf(owner).res.bone >= need) {
        lairsOf(owner).res.bone -= need;
        n *= DWELL_UP.growth;
      }
      d.pool = Math.min(cap, d.pool + n);
    }
    d.w = w;
  }
  return d.pool;
}

/** A creature dwelling's growth this week as its card shows it. */
function dwellWeek(game: Game, d: DwellState | undefined, u: BeastId): number {
  return dwellGrowth(u) * weekBeastGrowth(weekNow(game), u) * ((d?.lv ?? 1) >= 2 ? DWELL_UP.growth : 1);
}

function settleWhy(game: Game, s: PlayerSession, l: Lair): string | null {
  const d = L(game).store.dw[l.id];
  if (!d || d.owner !== s.accountId) return 'Raise your flag over it first.';
  if ((d.lv ?? 1) >= 2) return 'It is settled already.';
  const c = DWELL_UP.cost(UNITS[LAIRS[l.kind].mix[0][0]].tier);
  if (s.profile!.gold < c.silver) return `Needs ${c.silver} silver`;
  return landLack(s.profile!, c.land);
}

/** docs/18 #43: her creature dwelling settled — pens of shell and bone: half as many again a week, three weeks kept. */
export function settleDwelling(game: Game, s: PlayerSession, id: string): string | null {
  const S = L(game);
  const l = S.byId.get(id);
  if (!l || !s.ship) return 'Nothing here';
  const why = settleWhy(game, s, l);
  if (why) return why;
  if (dist(l.x, l.y, s.ship.state.x, s.ship.state.y) > LAIR_CARD_R + 200) return 'Come in to the shore: within the boats’ reach.';
  const d = S.store.dw[l.id];
  const u = LAIRS[l.kind].mix[0][0];
  dwellPool(game, d, u);
  const c = DWELL_UP.cost(UNITS[u].tier);
  s.profile!.gold -= c.silver;
  takeLand(s.profile!, c.land);
  d.lv = 2;
  save(game);
  game.db.ledger(s.accountId, 'lair_settle', -c.silver, l.id);
  game.toastShip(s.ship, `The dwelling of the ${beastsName(u)} on ${islandName(game, l)} is settled: half as many again each week, for ${DWELL_UP.upkeep(UNITS[u].tier)} bone a week.`, 'good');
  sendLairCard(game, s, true);
  return null;
}

function flagWhy(game: Game, s: PlayerSession, l: Lair): string | null {
  const def = LAIRS[l.kind];
  if (!def.dwell || l.island < 0) return 'No dwelling here.';
  if (lairsOf(s.profile!).v[l.id] !== week1(game)) return 'Beat its creatures first.';
  if (def.join === 'deep' && !keepsDeep(s)) return 'Only a captain of the Choir or of a cursed ship keeps the drowned.';
  const mine = Object.values(L(game).store.dw).filter((d) => d.owner === s.accountId).length;
  if (mine >= DWELL_MAX) return `No more than ${DWELL_MAX} creature dwellings under your flag.`;
  return null;
}

/** Her flag over a beaten lair's creatures (docs/18 #19, as a mine's): theirs grow a week, hers to hire. */
export function flagDwelling(game: Game, s: PlayerSession, id: string): string | null {
  const S = L(game);
  const l = S.byId.get(id);
  if (!l || !s.ship) return 'Nothing here';
  const why = flagWhy(game, s, l);
  if (why) return why;
  if (dist(l.x, l.y, s.ship.state.x, s.ship.state.y) > LAIR_CARD_R + 200) return 'Come in to the shore: within the boats’ reach.';
  const was = S.store.dw[l.id];
  const u = LAIRS[l.kind].mix[0][0];
  S.store.dw[l.id] = { owner: s.accountId, name: s.name, pool: dwellGrowth(u), w: thisWeek(game) };
  save(game);
  game.toastShip(s.ship, `Your flag flies over the ${lairName(l)} on ${islandName(game, l)}: ${beastsName(u)} grow there each week for you to hire.`, 'good');
  if (was && was.owner !== s.accountId) {
    const o = game.sessionByAccount(was.owner);
    if (o?.ship) game.toastShip(o.ship, `${s.name} has taken your creature dwelling on ${islandName(game, l)}.`, 'bad');
  }
  sendLairs(game, s, true);
  sendLairCard(game, s, true);
  return null;
}

/** The creature dwelling of hers within the boats' reach (for the recruit window). */
function dwellHere(game: Game, s: PlayerSession): { l: Lair; d: DwellState; u: BeastId } | null {
  const S = L(game);
  const ship = s.ship;
  if (!ship || ship.docked) return null;
  let best: { l: Lair; d: DwellState; u: BeastId } | null = null, bd = LAIR_CARD_R + 200;
  for (const [id, d] of Object.entries(S.store.dw)) {
    if (d.owner !== s.accountId) continue;
    const l = S.byId.get(id);
    if (!l) continue;
    const e = dist(l.x, l.y, ship.state.x, ship.state.y);
    if (e < bd) [best, bd] = [{ l, d, u: LAIRS[l.kind].mix[0][0] }, e];
  }
  return best;
}

function beastRow(game: Game, s: PlayerSession, u: BeastId, pool: number, growth: number, name: 'lair' | 'pen', label: [string, string], why: string | null): DwellRow {
  const ship = s.ship!;
  const room = mightRoom(ship.army, u, ship.shipLevel, ship.stats.crewMax, ship.armySlots);
  return {
    tier: UNITS[u].tier, name, up: false, pool: Math.floor(pool), growth, label, art: BEASTS[u].art,
    units: [{ u, per: UNITS[u].cost, goods: {}, room: Number.isFinite(room) ? room : -1 }],
    why: why ?? (ship.shipLevel < TIER_SHIP_LEVEL[UNITS[u].tier] ? `Creatures of tier ${UNITS[u].tier} serve a ship of level ${TIER_SHIP_LEVEL[UNITS[u].tier]} and up.` : null),
  };
}

/** The recruit window at a creature dwelling of hers (src 'lair'). */
export function lairDwellView(game: Game, s: PlayerSession): DwellView | null {
  const here = dwellHere(game, s);
  const ship = s.ship;
  if (!here || !ship) return null;
  const def = LAIRS[here.l.kind];
  const row = beastRow(game, s, here.u, dwellPool(game, here.d, here.u), Math.round(dwellWeek(game, here.d, here.u) * 10) / 10, 'lair', def.name, null);
  const out: Partial<Record<GoodId, number>> = {};
  for (const [g, n] of Object.entries(ship.cargo) as [GoodId, number][]) out[g] = Math.floor(n ?? 0);
  return {
    src: 'lair', place: islandName(game, here.l), rows: [row], ups: [], army: ship.army.map((x) => ({ ...x })), slots: ship.armySlots, crew: ship.crew, crewMax: ship.stats.crewMax,
    gold: Math.floor(s.profile!.gold), have: out, why: busyWhy(game, s), week: weekView(game), picked: pickedRoom(s), pickedMax: pickedMax(s),
    might: Math.round(armyWeight(ship.army)), mightMax: Math.round(mightCap(ship.shipLevel, ship.stats.crewMax, ship.armySlots)),
  };
}

function busyWhy(game: Game, s: PlayerSession): string | null {
  const ship = s.ship!;
  if (ship.boarding || ship.grappled) return 'Not in the middle of a boarding';
  if (ship.inCombat(game.now)) return 'Not while under fire';
  if (L(game).fights.has(s.accountId)) return 'Your party is ashore already.';
  return null;
}

/** Creatures of a kind aboard from a pool (a dwelling's or the pen's): the hammocks, the slots, the might cap. */
function signBeasts(game: Game, s: PlayerSession, u: BeastId, want: number, pool: number, take: (n: number) => void): string | null {
  const ship = s.ship!;
  const b = busyWhy(game, s);
  if (b) return b;
  const d = UNITS[u];
  if (ship.shipLevel < TIER_SHIP_LEVEL[d.tier]) return `Creatures of tier ${d.tier} serve a ship of level ${TIER_SHIP_LEVEL[d.tier]} and up.`;
  const picked = d.tier >= PICKED_TIER ? pickedRoom(s) : Infinity;
  const might = mightRoom(ship.army, u, ship.shipLevel, ship.stats.crewMax, ship.armySlots);
  const n = Math.min(Math.floor(Number(want)), Math.floor(pool), ship.stats.crewMax - ship.crew, picked, might);
  if (!Number.isFinite(n) || n <= 0) {
    if (ship.crew >= ship.stats.crewMax) return 'No hammocks left aboard';
    if (might <= 0) return `Your crew is as strong as a ship of level ${ship.shipLevel} carries: raise her level for better men.`;
    return 'Nobody waiting in that dwelling this week.';
  }
  if (!ship.army.some((x) => x.u === u) && ship.army.length >= ship.armySlots) return 'No free slot in the army for a new kind of man.';
  const silver = n * d.cost;
  const p = s.profile!;
  if (p.gold < silver) return `Needs ${silver} silver`;
  p.gold -= silver;
  game.db.ledger(s.accountId, 'recruit', -silver, `beast:${u}:${n}`);
  take(n);
  const c = p.company;
  reconcile(game, c, ship.crew);
  ship.addMen(u, n);
  c.pools.sailor += n;
  ship.companyKey = '';
  game.toastShip(ship, `${n} ${beastsName(u)} join your army for ${silver} silver.`, 'good');
  return null;
}

export function lairRecruit(game: Game, s: PlayerSession, u: UnitId, want: number): string | null {
  const here = dwellHere(game, s);
  if (!here) return 'No creature dwelling of yours within the boats’ reach.';
  if (u !== here.u) return 'No dwelling of theirs here.';
  const pool = dwellPool(game, here.d, here.u);
  const why = signBeasts(game, s, here.u, want, pool, (n) => {
    here.d.pool = Math.max(0, here.d.pool - n);
    save(game);
  });
  return why;
}

// ------------------------------------------------------------------------------------------------ 20. the pen

interface PenNest {
  k: BeastId;
  /** The day it was laid in (the sea's day). */
  at: number;
}

function penOf(y: Yard): { nests: PenNest[]; pool: Partial<Record<BeastId, number>>; w: number } {
  const t = townState(y) as ReturnType<typeof townState> & { pen?: PenNest[]; penPool?: Partial<Record<BeastId, number>>; penW?: number };
  if (!Array.isArray(t.pen)) t.pen = [];
  t.pen = t.pen.filter((x) => x && isBeast(x.k));
  t.penPool ??= {};
  if (!Number.isFinite(t.penW)) t.penW = -1;
  return { nests: t.pen, pool: t.penPool, w: t.penW! };
}

/** The pen's pools grown to this week: every grown kind breeds a dwelling's week. */
function penPools(game: Game, y: Yard): Partial<Record<BeastId, number>> {
  const t = townState(y) as ReturnType<typeof townState> & { pen?: PenNest[]; penPool?: Partial<Record<BeastId, number>>; penW?: number };
  const pen = penOf(y);
  const w = thisWeek(game);
  const d = today(game);
  if (pen.w < 0) t.penW = w;
  else if (pen.w < w) {
    for (const n of pen.nests) {
      if (penStage(d - n.at) !== 'grown') continue;
      const g = dwellGrowth(n.k);
      // docs/18 #45: its kind's week, half as many again.
      for (let k = Math.max(pen.w + 1, w - DWELL_WEEKS + 1); k <= w; k++) pen.pool[n.k] = Math.min(DWELL_WEEKS * g * 1.5, (pen.pool[n.k] ?? 0) + g * weekBeastGrowth(kindOfWeek(game, k), n.k));
    }
    t.penW = w;
    game.holdings.touch();
  }
  return pen.pool;
}

/** An egg (or a young one) she carries laid in her island's pen. */
export function nestEgg(game: Game, s: PlayerSession, index: number): string | null {
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  const { h, y } = m;
  const level = townLevel(y, 'pen');
  if (level <= 0) return 'Build a pen in your town first.';
  const lp = lairsOf(s.profile!);
  const k = lp.eggs[index];
  if (!k) return 'No such egg';
  if (!lyingOff(game, s, h)) return 'Bring your ship to the island to carry it ashore.';
  const pen = penOf(y);
  if (pen.nests.length >= PEN_NESTS[level]) return 'The pen is full: raise it a level for more nests.';
  lp.eggs.splice(index, 1);
  pen.nests.push({ k, at: today(game) });
  game.holdings.touch();
  game.toastShip(s.ship!, `A young one of the ${beastsName(k)} is laid in the pen: it hatches and grows in nine days of the sea.`, 'good');
  return null;
}

/** The pen as the town's screen shows it. */
export function penView(game: Game, s: PlayerSession, y: Yard): { nests: { k: BeastId; stage: 'egg' | 'young' | 'grown'; days: number; left: number; pool: number }[]; eggs: BeastId[]; max: number } {
  const pools = penPools(game, y);
  const d = today(game);
  const pen = penOf(y);
  return {
    nests: pen.nests.map((n) => {
      const days = d - n.at;
      const stage = penStage(days);
      return { k: n.k, stage, days, left: stage === 'egg' ? 2 - days : stage === 'young' ? 9 - days : 0, pool: Math.floor(pools[n.k] ?? 0) };
    }),
    eggs: [...lairsOf(s.profile!).eggs], max: PEN_NESTS[townLevel(y, 'pen')],
  };
}

/** The pen's grown kinds as rows of the island's recruit window. */
export function penRows(game: Game, s: PlayerSession): DwellRow[] {
  const m = ownBase(game, s);
  if (typeof m === 'string' || townLevel(m.y, 'pen') <= 0) return [];
  const pools = penPools(game, m.y);
  const d = today(game);
  const out: DwellRow[] = [];
  for (const n of penOf(m.y).nests) {
    if (penStage(d - n.at) !== 'grown' || out.some((r) => r.units[0].u === n.k)) continue;
    out.push(beastRow(game, s, n.k, pools[n.k] ?? 0, dwellGrowth(n.k), 'pen', ['Pen', 'Загон'], null));
  }
  return out;
}

export function penRecruit(game: Game, s: PlayerSession, u: UnitId, want: number): string | null {
  const m = ownBase(game, s);
  if (typeof m === 'string') return m;
  if (!isBeast(u)) return 'No dwelling of theirs here.';
  if (!lyingOff(game, s, m.h)) return 'Bring your ship to the island to take the men aboard.';
  const pools = penPools(game, m.y);
  if (!penOf(m.y).nests.some((n) => n.k === u && penStage(today(game) - n.at) === 'grown')) return 'No dwelling of theirs here.';
  return signBeasts(game, s, u, want, pools[u] ?? 0, (n) => {
    pools[u] = Math.max(0, (pools[u] ?? 0) - n);
    game.holdings.touch();
  });
}

/** The pen's rows in the island's recruit window and its card in the town (called as the game starts: the modules
 *  import one another in a ring). */
export function installLairHooks(): void {
  dwellHooks.isleRows = penRows;
  townHooks.pen = penView;
}

// ------------------------------------------------------------------------------------------------ the wire

export function lairMessage(game: Game, s: PlayerSession, msg: LairClientMsg): void {
  if (!s.profile || !s.ship) return;
  const err = (e: string | null) => {
    if (e) game.sendTo(s, { t: 'toast', msg: e, kind: 'bad' });
  };
  switch (msg.action) {
    case 'fight':
      return err(startFight(game, s, String(msg.id)));
    case 'join':
    case 'flee':
      return err(lairChoice(game, s, String(msg.id), msg.action));
    case 'flag':
      return err(flagDwelling(game, s, String(msg.id)));
    case 'settle':
      return err(settleDwelling(game, s, String(msg.id)));
    case 'close':
      return closeFight(game, s);
    case 'nest':
      err(nestEgg(game, s, Math.trunc(Number(msg.egg))));
      game.sendTo(s, { t: 'base', view: baseView(game, s) });
      sendLairs(game, s, true);
      return;
  }
}


// ------------------------------------------------------------------------------------------------ the First Watch

/** docs/18 #49: the nearest shore lair a novice can take (no higher than her ship, standing, not on a hidden island),
 *  put on her chart; null when there is none within reach of an evening's sailing. */
export function revealNearestLair(game: Game, s: PlayerSession, R = 20_000): Lair | null {
  const ship = s.ship;
  if (!ship || !s.profile) return null;
  let best: Lair | null = null, bd = R;
  for (const l of L(game).lairs) {
    if (l.role !== 'shore' || l.level > Math.max(1, ship.shipLevel) || l.turtle !== undefined || l.bank !== undefined) continue;
    if (l.island >= 0 && game.world.islands[l.island]?.hidden) continue;
    if (Math.abs(l.x - ship.state.x) > bd || Math.abs(l.y - ship.state.y) > bd) continue;
    const d = dist(l.x, l.y, ship.state.x, ship.state.y);
    if (d < bd && lairUp(game, l)) [best, bd] = [l, d];
  }
  if (!best) return null;
  const seen = seenOf(game, s);
  if (!seen.has(best.id)) {
    seen.add(best.id);
    lairsOf(s.profile).seen = [...seen];
  }
  sendLairs(game, s, true);
  return best;
}

// ------------------------------------------------------------------------------------------------ the tester's console

function nearestOf(game: Game, list: Lair[], x: number, y: number): Lair | undefined {
  let best: Lair | undefined, bd = Infinity;
  for (const l of list) {
    const p = lairPos(game, l);
    const d = dist(p.x, p.y, x, y);
    if (d < bd) [best, bd] = [l, d];
  }
  return best;
}

/** Set her down off the lair's shore, within the boats' reach. */
/** Her ship off a lair's shore, within the boats' reach (the admin's and the tests'). */
export const lairGoTo = (game: Game, s: PlayerSession, l: Lair): void => goTo(game, s, l);

function goTo(game: Game, s: PlayerSession, l: Lair): void {
  const ship = s.ship!;
  if (l.island >= 0) {
    const is = game.world.islands[l.island];
    // The nearest water off the shore from the lair, whichever way it lies (a grotto lies deep inland).
    let best: [number, number] | null = null, bd = Infinity;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, ax = Math.sin(a), ay = -Math.cos(a);
      for (let d = 0; d < is.radius * 2 + 800 && d < bd; d += 10) {
        const px = l.x + ax * d, py = l.y + ay * d;
        if (!pointInPolygon(px, py, is.poly) && !isLand(game.world, px, py) && Math.sqrt(closestOnPolygon(px, py, is.poly).d2) >= 110) {
          if (d < bd) [best, bd] = [[px, py], d];
          break;
        }
      }
    }
    const [x, y] = best ?? [l.x, l.y];
    parkNear(game, s, x, y, 1);
  } else {
    const p = lairPos(game, l);
    parkNear(game, s, p.x, p.y, 230);
  }
  ship.state.speed = 0;
  game.pushSelf(s, true);
}

/** `/lair [kind] [go|fight|beat|weak|reset|chain|dwell|info]`: the nearest creature lair (of a kind): sail to it, land
 *  against it at once, beat it, thin it to a tenth (for the offer), every lair back; `chain`: the nearest island with a
 *  chain; `dwell`: beat the nearest dwelling lair and flag it. */
export function adminLair(game: Game, s: PlayerSession, args: string[]): string {
  const S = L(game);
  const ship = s.ship!;
  const kind = args.find((x) => (LAIR_KINDS as string[]).includes(x)) as LairKind | undefined;
  // Which lairs (a filter) and what to do with the nearest (an order); a filter alone sails to it.
  const filt = args.find((x) => ['chain', 'grotto', 'guardian', 'dwell', 'turtle', 'sandbar'].includes(x));
  const order = args.find((x) => ['go', 'fight', 'beat', 'weak', 'reset', 'info'].includes(x));
  const sub = order ?? (filt ? (filt === 'dwell' ? 'dwell' : 'go') : 'info');
  // A battle ashore over and still on her screen is closed first.
  if (S.fights.get(s.accountId)?.done) closeFight(game, s);
  if (sub === 'reset') {
    S.store.st = {};
    save(game);
    const lp = lairsOf(s.profile!);
    lp.v = {};
    lp.chest = {};
    sendLairs(game, s, true);
    sendLairCard(game, s, true);
    return `All ${S.lairs.length} lairs stand again; your spoils are forgotten.`;
  }
  let list = S.lairs.filter((l) => (!kind || l.kind === kind) && lairThere(game, l) && !(l.island >= 0 && game.world.islands[l.island]?.hidden));
  if (filt === 'chain' || filt === 'grotto' || filt === 'guardian') list = list.filter((l) => l.chain === (filt === 'grotto' ? 1 : filt === 'guardian' ? 2 : 0));
  if (filt === 'dwell') list = list.filter((l) => LAIRS[l.kind].dwell && l.island >= 0 && (!LAIRS[l.kind].join.startsWith('d') || keepsDeep(s)));
  if (filt === 'turtle') list = S.lairs.filter((l) => l.turtle !== undefined);
  if (filt === 'sandbar') list = S.lairs.filter((l) => l.bank !== undefined);
  const up = list.filter((l) => lairUp(game, l));
  const l = nearestOf(game, up.length ? up : list, ship.state.x, ship.state.y);
  if (!l) return 'No lairs.';
  const name = lairName(l);
  const isl = islandName(game, l), n = armyMen(lairMen(game, l));
  const see = () => {
    seenOf(game, s).add(l.id);
    lairsOf(s.profile!).seen = [...seenOf(game, s)];
  };
  switch (sub) {
    case 'go': {
      if (l.chain) {
        // The chain's earlier steps beaten for her this week, so the one asked for may be fought.
        const lp = lairsOf(s.profile!);
        for (const id of [`l${l.island}s`, `l${l.island}g`].slice(0, l.chain)) lp.v[id] = week1(game);
      }
      if (S.store.st[l.id]) delete S.store.st[l.id];
      goTo(game, s, l);
      see();
      sendLairs(game, s, true);
      sendLairCard(game, s, true);
      return `Off the ${name} on ${isl} (⚓${l.level}, ${n} creatures).`;
    }
    case 'fight': {
      if (S.store.st[l.id]?.down !== undefined) delete S.store.st[l.id]; // down: standing again (a thinned lair stays thin)
      goTo(game, s, l);
      see();
      if (l.chain) {
        const lp = lairsOf(s.profile!);
        for (const id of [`l${l.island}s`, `l${l.island}g`].slice(0, l.chain)) lp.v[id] = week1(game);
      }
      return startFight(game, s, l.id, true) ?? `Ashore: the ${name} on ${isl} (⚓${l.level}, ${n} creatures).`;
    }
    case 'beat': {
      lairGone(game, l);
      lairsOf(s.profile!).v[l.id] = week1(game);
      sendLairs(game, s, true);
      sendLairCard(game, s, true);
      return `The ${name} is beaten (⚓${l.level}).`;
    }
    case 'weak': {
      const thin = lairMen(game, l).map((x) => ({ u: x.u, n: Math.max(1, Math.round(x.n / 10)) }));
      S.store.st[l.id] = { army: thin, at: game.now };
      save(game);
      sendLairCard(game, s, true);
      return `The ${name} is thinned to ${armyMen(thin)} creatures.`;
    }
    case 'dwell': {
      goTo(game, s, l);
      see();
      lairGone(game, l);
      lairsOf(s.profile!).v[l.id] = week1(game);
      const e = flagDwelling(game, s, l.id);
      if (e) return e;
      const d = S.store.dw[l.id];
      d.pool = DWELL_WEEKS * dwellGrowth(LAIRS[l.kind].mix[0][0]);
      save(game);
      return `Your flag over the ${name} on ${isl} (⚓${l.level}, ${n} creatures).`;
    }
  }
  const standing = S.lairs.filter((x) => lairUp(game, x)).length;
  return `Lairs: ${S.lairs.length}, standing ${standing}. Nearest: the ${name} on ${isl} (⚓${l.level}, ${n} creatures), ${Math.round(dist(lairPos(game, l).x, lairPos(game, l).y, ship.state.x, ship.state.y))} m away.`;
}

/** `/beast [kind] [n]`: creatures of a kind into her army (the list of kinds without one). */
export function adminBeast(game: Game, s: PlayerSession, args: string[]): string {
  const u = args[0] as CreatureId;
  if (!isCreature(u)) return `Kinds: ${CREATURE_IDS.join(', ')}.`;
  const ship = s.ship!;
  const n = Math.max(1, Math.min(500, Math.round(Number(args[1] ?? 10)) || 10));
  if (!ship.army.some((x) => x.u === u) && ship.army.length >= ship.armySlots) return 'No free slot in the army for a new kind of man.';
  const k = Math.max(0, Math.min(n, ship.stats.crewMax - ship.crew));
  if (k <= 0) return 'No hammocks left aboard';
  ship.addMen(u, k);
  s.profile!.company.pools.sailor += k;
  ship.companyKey = '';
  game.pushSelf(s, true);
  return `${k} ${BEAST_PLURAL[u][0]} in your army.`;
}

/** `/egg [kind|hatch|grow]`: an egg of a kind in hand; the pen's eggs hatched, or its young grown, at once. */
export function adminEgg(game: Game, s: PlayerSession, args: string[]): string {
  const lp = lairsOf(s.profile!);
  const a = args[0];
  if (a === 'hatch' || a === 'grow') {
    const m = ownBase(game, s);
    if (typeof m === 'string') return m;
    const pen = penOf(m.y);
    const d = today(game);
    for (const n of pen.nests) n.at = Math.min(n.at, d - (a === 'hatch' ? 2 : 9));
    if (a === 'grow') {
      const pools = pen.pool;
      for (const n of pen.nests) pools[n.k] = Math.max(pools[n.k] ?? 0, dwellGrowth(n.k));
    }
    game.holdings.touch();
    return a === 'hatch' ? `The pen's eggs have hatched (${pen.nests.length}).` : `The pen's young are grown (${pen.nests.length}).`;
  }
  const u = (isBeast(a ?? '') ? a : 'rock_turtle') as BeastId;
  if (lp.eggs.length >= EGG_MAX) return `No more than ${EGG_MAX} eggs carried.`;
  lp.eggs.push(u);
  sendLairs(game, s, true);
  return `An egg of the ${beastsName(u)} in your hold.`;
}

/** `/landres [n]`: n of each of the land's resources in her store. */
export function adminLandRes(game: Game, s: PlayerSession, args: string[]): string {
  const n = Math.max(0, Math.round(Number(args[0] ?? 20)) || 20);
  const lp = lairsOf(s.profile!);
  for (const r of LAND_RES) lp.res[r] += n;
  sendLairs(game, s, true);
  return `${n} of shell, bone and venom in your store.`;
}
