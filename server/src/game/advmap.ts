// The adventure map of the Heroes on the sea (docs/17 H4 items 14–15): the neutral guards and the things on the map
// (shared/src/data/advmap.ts says where each stands, by the world alone).
//
// A guard is a ship of the sea that never moves — a pirate hold-out, a rotting hulk, a wreck of the drowned, a pack of
// the deep — put in the water only while a captain is near (and taken out again, its men as they are, when all have
// gone). Cannon do nothing to it: it is fought by boarding, in the boarding battle of docs/17 H1, stack against stack.
// A captain whose army is three times its might is offered what HoMM3's neutrals offer: they flee, or some sign on.
// Beaten, fled or signed on, it stands again two days of the sea later; what it guarded lies open meanwhile.
//
// A thing on the map is visited from the boats when the ship lies within reach of it: a chest (silver or experience,
// once a week of the calendar; an artifact now and then, docs/17 H5), an altar of skill (once: a primary skill of the
// hero's, H5), a well (once a day: the crew's heart and nerve, and the captain's will), a watchtower (once:
// the sea charted for seven kilometres), a windmill and a warehouse (a load of a resource each week), a prison (once:
// an officer freed), an obelisk (once a season: a piece of the Grail's chart, server/src/game/grail.ts).
//
// Nothing here draws on the sea's rng: what varies is hashed from the thing and the week.

import { obeliskReveals } from './isles18.ts';
import { ALTAR_POINTS, altarPrim, GUARDS, openWater, GUARD_RESPAWN_SEC, JOIN_RATIO, JOIN_SHARE, MILL_DAYS, MILL_GOODS, OBJS, STORE_DAYS, TOWER_R, WELL_MORALE, WELL_SANITY, altarXp, buildAdv, chestPay, guardArmy, guardPay, millLoad } from '../../../shared/src/data/advmap.ts';
import type { AdvGuard, AdvMap, AdvObj, ObjKind } from '../../../shared/src/data/advmap.ts';
import { pointsXp, xpAt } from '../../../shared/src/data/xpcurve.ts';
import { UNITS, armyMen, armyPower } from '../../../shared/src/data/army.ts';
import type { ArmyStack } from '../../../shared/src/data/army.ts';
import { FIRST_NAMES, LAST_NAMES, OFFICER_DEFS, OFFICER_ROLES, TRAITS } from '../../../shared/src/data/crew.ts';
import type { OfficerRole, TraitId } from '../../../shared/src/data/crew.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { hullsFor } from '../../../shared/src/data/shiplevel.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../../shared/src/data/ships.ts';
import { secsToDawn } from '../../../shared/src/data/week.ts';
import type { AdvCardView, AdvView, GuardCard, GuardMark, ObjCard, ObjMark } from '../../../shared/src/h4proto.ts';
import { dist } from '../../../shared/src/math.ts';
import { depthAt, isLand } from '../../../shared/src/world/worldgen.ts';
import { hashString } from '../../../shared/src/rng.ts';
import { armyEdge } from './army.ts';
import { canBoard, startBoarding } from './boarding.ts';
import { thisWeek, today, weekView } from './calendar.ts';
import { officerBerths, reconcile } from './crew.ts';
import { giveGoods } from './director.ts';
import type { Game } from './Game.ts';
import { mineState } from './mines.ts';
import type { PlayerSession, Profile } from './player.ts';
import { seasonId } from './seasons.ts';
import type { ShipEntity } from './ship.ts';
import { keepsDeep } from './town.ts';
import { readObelisk } from './grail.ts';
import { haulNote, haulPeek, haulTake } from './seahaul.ts';

/** docs/19 D2: the altars that teach a primary skill (as many as stood before the map was doubled: two a region). */
export const ALTAR_PRIMS = 14;

/** What a captain keeps of the adventure map (docs/17 H4). */
export interface AdvProfile {
  /** Each thing's last visit, as its rule counts it (1: once; the week, the day or the season, each plus one). */
  v: Record<string, number>;
  /** The things and the guards she has seen (they stay on her charts). */
  seen: string[];
  /** Talent points the altars have taught her. */
  pts?: number;
  /** docs/19 D2: primary skills the altars have taught her (as many altars as there were before teach one; the rest a
   *  lesson of experience, so twice the altars are not twice the skill). */
  prims?: number;
  /** The season of her Grail's pieces, and the obelisks she has read in it. */
  gs?: number;
  pieces?: string[];
  /** This season's Grail found; a Grail waiting to be raised in her town; hers standing there; how many in all. */
  found?: number;
  held?: boolean;
  built?: boolean;
  grails?: number;
}

export function advOf(p: Profile): AdvProfile {
  const a = (p.adv ??= { v: {}, seen: [] });
  a.v ??= {};
  if (!Array.isArray(a.seen)) a.seen = [];
  return a;
}

/** For docs/17 H2 (and whatever comes after): what the adventure map hands to the hero's own systems. */
export const advHooks: {
  /** A chest's third choice (an artifact): its label and what taking it gives (an English line for the toast). */
  chestReward: ((game: Game, s: PlayerSession, o: AdvObj) => { id: string; label: [string, string]; take: () => string } | null) | null;
  /** An altar: H2 teaches a primary skill instead of a talent point (its line for the toast; null: it did not). */
  altar: ((game: Game, s: PlayerSession, o: AdvObj) => string | null) | null;
  /** A well: H2 fills the captain's will (true: it did). */
  well: ((game: Game, s: PlayerSession) => boolean) | null;
  /** A beaten guard's chest (docs/17 H5): what more it holds for her (an artifact's line), once a week. */
  guardChest: ((game: Game, s: PlayerSession, g: AdvGuard) => string | null) | null;
} = { chestReward: null, altar: null, well: null, guardChest: null };

/** The captain's will, filled where a field of it stands on her profile (until docs/17 H2 hooks in). */
export function restoreWill(p: Profile): boolean {
  const q = p as unknown as { will?: number; willMax?: number; hero?: { will?: number; willMax?: number } };
  const box = typeof q.hero?.will === 'number' ? q.hero : typeof q.will === 'number' ? q : null;
  if (!box) return false;
  box.will = typeof box.willMax === 'number' ? Math.max(box.will!, box.willMax) : box.will;
  return true;
}

// ------------------------------------------------------------------------------------------------ the world's state

interface GuardState {
  /** World seconds it was beaten (fled, signed on); it stands again GUARD_RESPAWN_SEC later. */
  down?: number;
  /** Its men as the last fight left them (its full army when absent). */
  army?: ArmyStack[];
}

interface Adv {
  map: AdvMap;
  objById: Map<string, AdvObj>;
  guardById: Map<string, AdvGuard>;
  st: Record<string, GuardState>;
  /** Guard → its ship while it stands in the world. */
  ships: Map<string, number>;
  /** Each guard's full army (they are built once). */
  full: Map<string, ArmyStack[]>;
  ver: number;
  dirty: boolean;
  /** What each captain was last sent: her map's key, her card's key. */
  told: WeakMap<PlayerSession, string>;
  cards: WeakMap<PlayerSession, string>;
  seen: WeakMap<PlayerSession, Set<string>>;
  /** A guard's "cannon do nothing" told to a captain (guard id + account). */
  shotTold: Set<string>;
}

const KEY = 'h4:guards';
const all = new WeakMap<Game, Adv>();
/** Tests of other systems keep the adventure map out of the water (tests/helpers.ts). */
const quiet = new WeakSet<Game>();

/** The adventure map (and the lairs of docs/18 II with it) kept still for this game. */
export const advQuiet = (game: Game): boolean => quiet.has(game);

export function quietAdv(game: Game, on = true): void {
  if (on) quiet.add(game);
  else quiet.delete(game);
}

function adv(game: Game): Adv {
  let a = all.get(game);
  if (!a) {
    const map = buildAdv(game.world);
    const saved = game.db.getKv<Record<string, GuardState>>(KEY) ?? {};
    a = {
      map, objById: new Map(map.objs.map((o) => [o.id, o])), guardById: new Map(map.guards.map((g) => [g.id, g])), st: saved, ships: new Map(), full: new Map(),
      ver: 1, dirty: false, told: new WeakMap(), cards: new WeakMap(), seen: new WeakMap(), shotTold: new Set(),
    };
    all.set(game, a);
  }
  return a;
}

export const advMap = (game: Game): AdvMap => adv(game).map;
export const advObj = (game: Game, id: string): AdvObj | undefined => adv(game).objById.get(id);
export const advGuard = (game: Game, id: string): AdvGuard | undefined => adv(game).guardById.get(id);

function save(game: Game): void {
  const a = adv(game);
  a.ver++;
  game.db.setKv(KEY, a.st);
}

/** Within reach of the boats for a visit; a guard's card from this far. */
export const VISIT_R = 260;
export const GUARD_CARD_R = 650;
/** Seen from this far (on the charts for good); a guard is put in the water this near a captain, taken out this far. */
export const SEE_R = 2600;
const MAT_R = 3400;
const DEMAT_R = 4800;

// ------------------------------------------------------------------------------------------------ 14. the guards

export function fullArmy(game: Game, g: AdvGuard): ArmyStack[] {
  const a = adv(game);
  let f = a.full.get(g.id);
  if (!f) a.full.set(g.id, (f = guardArmy(g.kind, g.level, g.size)));
  return f;
}

/** Its men now. */
export function guardMenOf(game: Game, g: AdvGuard): ArmyStack[] {
  const ship = guardShip(game, g.id);
  if (ship) return ship.army.map((x) => ({ ...x }));
  return (adv(game).st[g.id]?.army ?? fullArmy(game, g)).map((x) => ({ ...x }));
}

/** A guard stands: not beaten lately, and a mine's guard only while the mine is nobody's. */
export function guardUp(game: Game, g: AdvGuard): boolean {
  const st = adv(game).st[g.id];
  if (st?.down !== undefined && game.now < st.down + GUARD_RESPAWN_SEC) return false;
  if (g.at?.startsWith('m') && mineState(game, g.at).owner !== undefined) return false;
  return true;
}

/** The guard standing before a thing or a mine (null: none, or it is down). */
export function guardOfSite(game: Game, at: string): AdvGuard | null {
  if (quiet.has(game)) return null;
  for (const g of adv(game).map.guards) if (g.at === at && guardUp(game, g)) return g;
  return null;
}

export function guardShip(game: Game, id: string): ShipEntity | null {
  const sid = adv(game).ships.get(id);
  const ship = sid !== undefined ? game.ships.get(sid) : undefined;
  return ship && ship.alive && ship.guardOf === id ? ship : null;
}

/** The hull a guard of a kind stands in at its level: one of the level's own (with room for its men). */
function hullOf(g: AdvGuard, men: number): ShipClassId {
  const pool = hullsFor(g.kind === 'hulk' ? 'merchant' : 'pirate', g.level);
  const fit = [...pool].sort((a, b) => SHIP_CLASSES[b].crewMax - SHIP_CLASSES[a].crewMax);
  return fit.find((c) => SHIP_CLASSES[c].crewMax >= men) ?? fit[0] ?? 'sloop';
}

/** Put a guard in the water (its men as they last stood). */
function raise(game: Game, g: AdvGuard): ShipEntity {
  const a = adv(game);
  const army = a.st[g.id]?.army ?? fullArmy(game, g);
  const def = GUARDS[g.kind];
  const faction = g.kind === 'holdout' ? 'confederacy' : g.kind === 'hulk' ? 'free' : 'choir';
  const ship = game.spawnNpcShip('pirate', hullOf(g, armyMen(army)), faction, g.x, g.y, g.heading, { ship: def.ship, captain: def.captain });
  ship.guardOf = g.id;
  game.setNpcLevel(ship, g.level);
  ship.setArmy(army);
  ship.god = true;
  ship.morale = g.kind === 'wreck' || g.kind === 'beasts' ? 100 : 70;
  ship.purse = 0;
  ship.state = { ...ship.state, x: g.x, y: g.y, heading: g.heading, speed: 0, sail: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  const brain = game.npcs.get(ship.id);
  if (brain) brain.active = true;
  game.grid.upsert(ship.id, g.x, g.y);
  a.ships.set(g.id, ship.id);
  a.ver++;
  return ship;
}

/** Take a guard out of the water, its men kept as they are. */
function lower(game: Game, g: AdvGuard, ship: ShipEntity): void {
  const a = adv(game);
  const men = ship.army.map((x) => ({ ...x }));
  const full = fullArmy(game, g);
  (a.st[g.id] ??= {}).army = armyMen(men) >= armyMen(full) ? undefined : men;
  if (!a.st[g.id].army && a.st[g.id].down === undefined) delete a.st[g.id];
  a.ships.delete(g.id);
  game.removeShip(ship.id);
  save(game);
}

/** The NPC step of a guard (npc.ts): it stays where it stands, sails furled, at anchor. */
export function holdGuard(game: Game, ship: ShipEntity): void {
  const g = adv(game).guardById.get(ship.guardOf!);
  if (g && !ship.boarding) {
    ship.state.x = g.x;
    ship.state.y = g.y;
    ship.state.heading = g.heading;
  }
  ship.state.speed = 0;
  ship.state.sail = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  if (!ship.boarding) ship.morale = g && (g.kind === 'wreck' || g.kind === 'beasts') ? 100 : Math.max(ship.morale, 70);
}

/** How the guard reckons her army: its might against hers (the boarding battle's reckoning, the ladder counted). */
export function guardRatio(game: Game, s: PlayerSession, g: AdvGuard): number {
  const ship = s.ship;
  if (!ship) return 0;
  const gs = guardShip(game, g.id);
  if (gs) return armyEdge(game, ship, gs);
  return (armyPower(ship.army) * (0.5 + ship.morale / 100)) / Math.max(1, armyPower(guardMenOf(game, g)) * 1.2);
}

/** HoMM3's neutrals before a far stronger army: the deep's things flee, men may sign on (the Choir's and the cursed
 *  ships take the drowned too), by the guard's own hash for the week. */
export function guardOffer(game: Game, s: PlayerSession, g: AdvGuard): 'join' | 'flee' | null {
  if (guardRatio(game, s, g) < JOIN_RATIO) return null;
  const j = GUARDS[g.kind].join;
  if (j === 'never') return 'flee';
  if (j === 'deep') return keepsDeep(s) ? 'join' : 'flee';
  return hashString(`join:${g.id}:${thisWeek(game)}`) % 10 < 6 ? 'join' : 'flee';
}

/** The men who would sign on: half of each of its stacks, as her hammocks and her slots take them. */
export function joinersOf(game: Game, s: PlayerSession, g: AdvGuard): ArmyStack[] {
  const ship = s.ship!;
  let room = Math.max(0, ship.stats.crewMax - ship.crew);
  let slots = ship.armySlots - ship.army.length;
  const out: ArmyStack[] = [];
  for (const x of guardMenOf(game, g)) {
    if (room <= 0) break;
    const own = ship.army.some((y) => y.u === x.u) || out.some((y) => y.u === x.u);
    if (!own && slots <= 0) continue;
    if (UNITS[x.u].deep && !keepsDeep(s)) continue;
    const n = Math.min(room, Math.floor(x.n * JOIN_SHARE));
    if (n <= 0) continue;
    if (!own) slots--;
    room -= n;
    out.push({ u: x.u, n });
  }
  return out;
}

function guardWhat(game: Game, g: AdvGuard): ObjKind | 'mine' | null {
  if (!g.at) return null;
  if (g.at.startsWith('m')) return 'mine';
  return adv(game).objById.get(g.at)?.kind ?? null;
}

function guardCard(game: Game, s: PlayerSession, g: AdvGuard): GuardCard {
  const men = guardMenOf(game, g);
  const offer = guardOffer(game, s, g);
  const gs = guardShip(game, g.id);
  const ship = s.ship!;
  return {
    id: g.id, kind: g.kind, size: g.size, level: g.level, men: armyMen(men), units: men.map((x) => x.u), at: guardWhat(game, g),
    ratio: Math.round(guardRatio(game, s, g) * 10) / 10, offer, joinN: offer === 'join' ? armyMen(joinersOf(game, s, g)) : 0,
    alongside: !!gs && !canBoard(game, ship, gs), pay: guardPayFor(s.profile!.level, g), ...(gs ? { e: gs.id } : {}), ...(guardLooted(game, s.profile!, g) ? { looted: true } : {}),
  };
}

/** The guard is gone (beaten, fled or signed on): its thing lies open; it stands again later. */
function guardGone(game: Game, g: AdvGuard): void {
  const a = adv(game);
  a.st[g.id] = { down: game.now };
  const ship = guardShip(game, g.id);
  a.ships.delete(g.id);
  if (ship) game.removeShip(ship.id);
  save(game);
}

const guardName = (g: AdvGuard) => GUARDS[g.kind].name[0];

/** A guard down by decree (the admin, the tests). */
export function downGuard(game: Game, id: string): void {
  const g = adv(game).guardById.get(id);
  if (g) guardGone(game, g);
}

function openLine(game: Game, g: AdvGuard): string {
  const w = guardWhat(game, g);
  if (w === 'mine') return ' The mine lies open for your flag.';
  if (w) return ` The ${OBJS[w].name[0]} lies open.`;
  return ' The strait is clear.';
}

/** The boarding battle won against a guard (boarding.ts, before any prize): its chest and the lesson, and it is
 *  gone for now. True: it was a guard (no prize to take). */
export function guardBeaten(game: Game, winner: ShipEntity, loser: ShipEntity): boolean {
  if (!loser.guardOf) return false;
  const g = adv(game).guardById.get(loser.guardOf);
  if (!g) return false;
  guardGone(game, g);
  const s = game.sessionOf(winner);
  winner.morale = Math.min(100, winner.morale + 10);
  if (!s?.profile) return true;
  // The guard stands for every captain and rises again two days later; its chest is each captain's once a week of the
  // calendar (docs/17 H5), so a guard beaten over and over by one crew is a lesson, not a mint.
  if (guardLooted(game, s.profile, g)) {
    game.toastShip(winner, `The ${guardName(g)} is beaten. You emptied its chest this week already.${openLine(game, g)}`, 'good');
  } else {
    const pay = guardPayFor(s.profile.level, g);
    advOf(s.profile).v[`g:${g.id}`] = thisWeek(game) + 1;
    s.profile.gold += pay.silver;
    game.db.ledger(s.accountId, 'guard', pay.silver, g.id);
    game.grantXp(s, pay.xp, `Beat the ${guardName(g)}`, true);
    game.toastShip(winner, `The ${guardName(g)} is beaten: ${pay.silver} silver in its chest.${openLine(game, g)}`, 'gold');
    advHooks.guardChest?.(game, s, g);
  }
  sendAdv(game, s, true);
  sendCard(game, s, true);
  game.pushSelf(s, true);
  return true;
}

/** She has emptied this guard's chest this week of the calendar (docs/17 H5). */
export function guardLooted(game: Game, p: Profile, g: AdvGuard): boolean {
  const v = advOf(p).v[`g:${g.id}`];
  return v !== undefined && v >= thisWeek(game) + 1;
}

/** The guard's card answered: fight (board it at once), take the men who would sign on, or let them go. */
export function guardChoice(game: Game, s: PlayerSession, id: string, choice: string): string | null {
  const g = adv(game).guardById.get(id);
  const ship = s.ship;
  if (!g || !ship || ship.docked) return 'Nothing here';
  if (!guardUp(game, g)) return 'They are gone';
  if (dist(ship.state.x, ship.state.y, g.x, g.y) > GUARD_CARD_R) return 'Too far';
  if (ship.boarding) return 'Not now';
  if (choice === 'fight') {
    const gs = guardShip(game, g.id) ?? raise(game, g);
    const why = canBoard(game, ship, gs);
    if (why) return why === 'Too far to throw grapples' ? 'Come alongside first: within the grapples’ reach.' : why;
    startBoarding(game, ship, gs, 'standard');
    return null;
  }
  const offer = guardOffer(game, s, g);
  if (!offer) return 'They will not yield to you.';
  if (choice === 'join') {
    if (offer !== 'join') return 'They will not sail with you.';
    const men = joinersOf(game, s, g);
    const n = armyMen(men);
    if (n <= 0) return 'No hammocks or slots for them aboard.';
    const c = s.profile!.company;
    reconcile(game, c, ship.crew);
    c.loyalty = (c.loyalty * ship.crew + 40 * n) / (ship.crew + n);
    for (const x of men) ship.addMen(x.u, x.n);
    c.pools.sailor += n;
    guardGone(game, g);
    game.toastShip(ship, `${n} of the ${guardName(g)} sign on with you; the rest row away.${openLine(game, g)}`, 'good');
  } else {
    guardGone(game, g);
    game.toastShip(ship, `The ${guardName(g)} sees your strength and flees.${openLine(game, g)}`, 'good');
  }
  sendAdv(game, s, true);
  sendCard(game, s, true);
  game.pushSelf(s, true);
  return null;
}

/** Every two seconds: guards put in the water near captains, taken out far from all; a shot wasted on one told. */
function stepGuards(game: Game): void {
  const a = adv(game);
  const caps: ShipEntity[] = [];
  for (const s of game.sessions) if (s.ship && !s.ship.docked && s.ship.alive && s.profile) caps.push(s.ship);
  const nearest = (x: number, y: number) => {
    let d = Infinity;
    for (const c of caps) d = Math.min(d, Math.max(Math.abs(c.state.x - x), Math.abs(c.state.y - y)));
    return d;
  };
  for (const g of a.map.guards) {
    const ship = guardShip(game, g.id);
    if (!ship) {
      if (a.ships.has(g.id)) a.ships.delete(g.id);
      if (guardUp(game, g) && nearest(g.x, g.y) < MAT_R && game.inZone(g.x, g.y)) raise(game, g);
      continue;
    }
    if (!guardUp(game, g) && !ship.boarding) {
      a.ships.delete(g.id);
      game.removeShip(ship.id);
      continue;
    }
    if (!ship.boarding && nearest(g.x, g.y) > DEMAT_R) {
      lower(game, g, ship);
      continue;
    }
    // A captain who wastes shot on it hears why, once.
    for (const [sid, t] of ship.attackers) {
      if (t < game.now - 3) continue;
      const shooter = game.ships.get(sid);
      const s = game.sessionOf(shooter ?? null);
      if (!s) continue;
      const key = `${g.id}:${s.accountId}`;
      if (a.shotTold.has(key)) continue;
      a.shotTold.add(key);
      game.toastShip(shooter!, `Shot is wasted on the ${guardName(g)}: guards are fought hand to hand. Lay her alongside and board.`, 'info');
    }
  }
}

// ------------------------------------------------------------------------------------------------ 15. the visits

function stampOf(game: Game, kind: ObjKind): number {
  switch (OBJS[kind].rule) {
    case 'once':
      return 1;
    case 'week':
      return thisWeek(game) + 1;
    case 'day':
      return today(game) + 1;
    case 'season':
      return seasonId(game) + 1;
  }
}

export function visitedNow(game: Game, p: Profile, o: AdvObj): boolean {
  const v = advOf(p).v[o.id];
  return v !== undefined && v >= stampOf(game, o.kind);
}

/** World seconds until she may visit again (0: never, or not in this season). */
function againIn(game: Game, o: AdvObj): number {
  switch (OBJS[o.kind].rule) {
    case 'week':
      return weekView(game).nextIn;
    case 'day':
      return Math.round(secsToDawn(game.now));
    default:
      return 0;
  }
}

/** The resource a windmill grinds this week (by its own hash). */
export function millGood(game: Game, o: AdvObj) {
  return o.kind === 'store' ? o.good ?? 'timber' : MILL_GOODS[hashString(`mill:${o.id}:${thisWeek(game)}`) % MILL_GOODS.length];
}

/** The officer waiting in a prison: a role and a level by the prison's own hash and its waters. */
export function prisoner(o: AdvObj): { role: OfficerRole; level: number; traits: TraitId[]; name: string } {
  const h = hashString(`prison:${o.id}`);
  const role = OFFICER_ROLES[h % OFFICER_ROLES.length];
  const rollable = (Object.keys(TRAITS) as TraitId[]).filter((t) => TRAITS[t].rollable && TRAITS[t].good);
  const traits: TraitId[] = [rollable[(h >>> 4) % rollable.length]];
  const t2 = rollable[(h >>> 9) % rollable.length];
  if (!traits.includes(t2)) traits.push(t2);
  return { role, level: Math.max(2, Math.min(20, Math.round(1 + o.level * 1.6))), traits, name: `${FIRST_NAMES[(h >>> 13) % FIRST_NAMES.length]} ${LAST_NAMES[(h >>> 17) % LAST_NAMES.length]}` };
}

/** The level a thing's experience is reckoned at: its waters', but never above her own ship's (a junior captain who
 *  slips into deep waters takes their silver, not a dozen levels at once). */
const xpLevel = (s: PlayerSession, o: AdvObj): number => Math.max(1, Math.min(o.level, s.ship?.shipLevel ?? 1));

/** A guard's chest and lesson for a captain of this level (docs/26: the lesson at her level, by its colour). */
function guardPayFor(level: number, g: AdvGuard): { silver: number; xp: number } {
  const pay = guardPay(g.level, g.size);
  return { silver: pay.silver, xp: xpAt(level, g.level, pay.xp) };
}

/** A chest's two choices for her: its waters' silver, or experience at her level (no more than her ship's waters
 *  teach, docs/26: by its colour). */
function chestOf(s: PlayerSession, o: AdvObj): { silver: number; xp: number } {
  const lv = xpLevel(s, o);
  return { silver: chestPay(o.level, !!o.guard).silver, xp: xpAt(s.profile!.level, lv, chestPay(lv, !!o.guard).xp) };
}

/** An altar's lesson for her, once its points are spent. */
const altarFor = (s: PlayerSession, o: AdvObj): number => xpAt(s.profile!.level, xpLevel(s, o), altarXp(xpLevel(s, o)));

/** Why a visit would not go through now (null: it would). */
function visitWhy(game: Game, s: PlayerSession, o: AdvObj): string | null {
  const ship = s.ship;
  if (!ship || ship.docked) return 'Put to sea first.';
  if (ship.boarding) return 'Not while grappled.';
  if (dist(ship.state.x, ship.state.y, o.x, o.y) > VISIT_R + 40) return 'Come within reach of the boats.';
  if (o.guard) {
    const g = adv(game).guardById.get(o.guard);
    if (g && guardUp(game, g)) return 'A guard stands before it: beat them first.';
  }
  if (visitedNow(game, s.profile!, o)) return OBJS[o.kind].rule === 'once' ? 'You have been here already.' : OBJS[o.kind].rule === 'season' ? 'You have read this stone this season.' : 'Nothing new here yet.';
  if (o.kind === 'prison' && s.profile!.company.officers.length >= officerBerths(ship)) return 'No berth aboard for another officer.';
  return null;
}

function objCard(game: Game, s: PlayerSession, o: AdvObj): ObjCard {
  const p = s.profile!;
  const g = o.guard ? adv(game).guardById.get(o.guard) : undefined;
  const ready = !visitedNow(game, p, o);
  const card: ObjCard = {
    id: o.id, kind: o.kind, level: o.level, island: o.island, rule: OBJS[o.kind].rule, ready, again: ready ? 0 : againIn(game, o),
    why: visitWhy(game, s, o), guard: g && guardUp(game, g) ? guardCard(game, s, g) : null,
  };
  switch (o.kind) {
    case 'chest': {
      const extra = advHooks.chestReward?.(game, s, o) ?? null;
      const pay = chestOf(s, o);
      card.chest = { ...pay, silver: Math.max(1, Math.round(pay.silver * haulPeek(game, s, 'adv'))), ...(extra ? { extra: { id: extra.id, label: extra.label } } : {}) };
      break;
    }
    case 'mill':
    case 'store': {
      const good = millGood(game, o);
      // (past her day's count of the map's finds, half: docs/19 D2)
      card.load = { good, n: Math.max(1, Math.round(millLoad(good, o.region, o.kind === 'mill' ? MILL_DAYS : STORE_DAYS) * haulPeek(game, s, 'adv'))) };
      break;
    }
    case 'altar':
      card.altar = { point: (advOf(p).pts ?? 0) < ALTAR_POINTS, xp: altarFor(s, o), ...(advHooks.altar && (advOf(p).prims ?? 0) < ALTAR_PRIMS ? { prim: altarPrim(o.id) } : {}) };
      break;
    case 'prison': {
      const who = prisoner(o);
      card.prison = { role: ready ? who.role : null, level: who.level };
      break;
    }
    case 'obelisk':
      card.pieces = { n: piecesOf(game, p).length, of: adv(game).map.objs.filter((x) => x.kind === 'obelisk').length };
      break;
  }
  return card;
}

/** The obelisks she has read this season. */
export function piecesOf(game: Game, p: Profile): string[] {
  const a = advOf(p);
  const season = seasonId(game);
  if (a.gs !== season) {
    a.gs = season;
    a.pieces = [];
  }
  return (a.pieces ??= []);
}

/** The boats visit a thing on the map. */
export function visit(game: Game, s: PlayerSession, id: string, choice?: string): string | null {
  const o = adv(game).objById.get(id);
  if (!o) return 'Nothing here';
  const why = visitWhy(game, s, o);
  if (why) return why;
  const p = s.profile!, ship = s.ship!;
  const name = OBJS[o.kind].name[0];
  let line = '';
  switch (o.kind) {
    case 'chest': {
      const pay = chestOf(s, o);
      const extra = advHooks.chestReward?.(game, s, o) ?? null;
      if (extra && choice === extra.id) line = extra.take();
      else if (choice === 'xp') {
        game.grantXp(s, pay.xp, null);
        line = `The chest’s logbook teaches you ${pay.xp} experience.`;
      } else if (choice === 'silver') {
        // docs/19 D2: twice the chests; past her day's count (shared/src/data/seahaul.ts) half the silver.
        const silver = Math.max(1, Math.round(pay.silver * haulTake(game, s, 'adv')));
        p.gold += silver;
        game.db.ledger(s.accountId, 'adv_chest', silver, o.id);
        line = `From the chest: ${silver} silver.`;
      } else return 'Silver or experience?';
      break;
    }
    case 'altar': {
      const a = advOf(p);
      // docs/17 H5: the hero's primary skill of the altar (HoMM3's); without the hero, a talent point.
      const prim = (a.prims ?? 0) < ALTAR_PRIMS;
      const taught = prim ? advHooks.altar?.(game, s, o) ?? null : null;
      if (taught) {
        line = taught;
        a.prims = (a.prims ?? 0) + 1;
      }
      else if ((a.pts ?? 0) < ALTAR_POINTS) {
        a.pts = (a.pts ?? 0) + 1;
        line = 'The bell’s note stays with you: a talent point to spend.';
      } else {
        const xp = altarFor(s, o);
        game.grantXp(s, xp, null);
        line = `The bell’s note teaches you ${xp} experience.`;
      }
      break;
    }
    case 'well': {
      ship.morale = Math.max(ship.morale, WELL_MORALE);
      ship.sanity = Math.min(100, ship.sanity + WELL_SANITY);
      const will = advHooks.well?.(game, s) || restoreWill(p);
      line = will ? 'The crew drinks at the well and rests: their heart and nerve restored, and your will.' : 'The crew drinks at the well and rests: their heart and nerve restored.';
      break;
    }
    case 'tower': {
      const n = revealAdv(game, s, o.x, o.y, TOWER_R, true);
      game.grantXp(s, pointsXp(p.level, 40), null);
      line = `From the tower the sea lies open for ${Math.round(TOWER_R / 1000)} km: ${n} islands newly on your chart.`;
      break;
    }
    case 'mill':
    case 'store': {
      const good = millGood(game, o);
      const want = Math.max(1, Math.round(millLoad(good, o.region, o.kind === 'mill' ? MILL_DAYS : STORE_DAYS) * haulPeek(game, s, 'adv')));
      const k = giveGoods(ship, good, want);
      if (k > 0) haulNote(game, s, 'adv', haulPeek(game, s, 'adv'));
      if (k <= 0) return 'No room in the hold.';
      line = o.kind === 'mill' ? `From the windmill into the hold: ${k} ${GOODS[good].name.toLowerCase()}.` : `From the warehouse into the hold: ${k} ${GOODS[good].name.toLowerCase()}.`;
      break;
    }
    case 'prison': {
      const who = prisoner(o);
      const c = p.company;
      c.officers.push({ id: `o${game.allocId()}`, name: who.name, role: who.role, level: who.level, xp: 0, traits: who.traits, loyalty: 75, wound: null, hiredAt: game.now, orderReady: 0 });
      ship.companyKey = '';
      line = `${who.name}, a ${OFFICER_DEFS[who.role].name.toLowerCase()}, is freed and signs on with you.`;
      break;
    }
    case 'obelisk': {
      const pieces = piecesOf(game, p);
      if (!pieces.includes(o.id)) pieces.push(o.id);
      line = readObelisk(game, s, o);
      obeliskReveals(game, s, o.x, o.y); // docs/18 #30: the stone shows a hidden island near
      break;
    }
  }
  advOf(p).v[o.id] = stampOf(game, o.kind);
  game.toastShip(ship, line, 'good');
  sendAdv(game, s, true);
  sendCard(game, s, true);
  game.pushSelf(s, true);
  return null;
}

/** The sea about a point charted for her (a watchtower, a lookout): its islands, and the guards and the things on the
 *  map there on her charts. The islands newly charted. */
export function revealAdv(game: Game, s: PlayerSession, x: number, y: number, r: number, islands = false): number {
  let n = 0;
  if (islands) {
    for (const is of game.world.islands) {
      if (is.minor || s.discovered.has(is.id) || dist(is.x, is.y, x, y) > r + is.radius * 0.5) continue;
      game.chartIsland(s, is);
      n++;
    }
  }
  const a = adv(game);
  const seen = seenOf(game, s);
  let more = false;
  for (const o of a.map.objs) if (!seen.has(o.id) && dist(o.x, o.y, x, y) <= r) {
    seen.add(o.id);
    more = true;
  }
  for (const g of a.map.guards) if (!seen.has(g.id) && dist(g.x, g.y, x, y) <= r) {
    seen.add(g.id);
    more = true;
  }
  if (more) {
    advOf(s.profile!).seen = [...seen];
    sendAdv(game, s, true);
  }
  return n;
}

// ------------------------------------------------------------------------------------------------ what she sees

function seenOf(game: Game, s: PlayerSession): Set<string> {
  const a = adv(game);
  let set = a.seen.get(s);
  if (!set) a.seen.set(s, (set = new Set(advOf(s.profile!).seen)));
  return set;
}

export function advView(game: Game, s: PlayerSession): AdvView {
  const a = adv(game);
  const seen = seenOf(game, s);
  const p = s.profile!;
  const objs: ObjMark[] = [];
  for (const o of a.map.objs) {
    if (!seen.has(o.id)) continue;
    const g = o.guard ? a.guardById.get(o.guard) : undefined;
    objs.push({ id: o.id, kind: o.kind, x: o.x, y: o.y, level: o.level, ready: !visitedNow(game, p, o), guarded: !!g && guardUp(game, g) });
  }
  const guards: GuardMark[] = [];
  for (const g of a.map.guards) {
    if (!seen.has(g.id)) continue;
    const ship = guardShip(game, g.id);
    guards.push({ id: g.id, kind: g.kind, x: g.x, y: g.y, level: g.level, men: armyMen(guardMenOf(game, g)), down: !guardUp(game, g), ...(ship ? { e: ship.id } : {}) });
  }
  const ap = advOf(p);
  return { objs, guards, pieces: piecesOf(game, p).length, of: a.map.objs.filter((o) => o.kind === 'obelisk').length, grail: ap.built ? 'built' : ap.held ? 'held' : 'none' };
}

export function sendAdv(game: Game, s: PlayerSession, force: boolean): void {
  if (!s.profile) return;
  const a = adv(game);
  const v = advView(game, s);
  const key = JSON.stringify(v);
  if (!force && a.told.get(s) === key) return;
  a.told.set(s, key);
  game.sendTo(s, { t: 'adv', view: v });
}

/** The card over the sea: the thing within reach of her boats, or the guard in her way. */
export function cardView(game: Game, s: PlayerSession): AdvCardView | null {
  const ship = s.ship;
  if (!ship || ship.docked || !s.profile || ship.boarding) return null;
  const a = adv(game);
  let obj: AdvObj | null = null, od = VISIT_R;
  for (const o of a.map.objs) {
    const d = Math.max(Math.abs(o.x - ship.state.x), Math.abs(o.y - ship.state.y));
    if (d > od) continue;
    const e = dist(o.x, o.y, ship.state.x, ship.state.y);
    if (e <= od) [obj, od] = [o, e];
  }
  let guard: AdvGuard | null = null, gd = GUARD_CARD_R;
  for (const g of a.map.guards) {
    if (Math.max(Math.abs(g.x - ship.state.x), Math.abs(g.y - ship.state.y)) > gd || !guardUp(game, g)) continue;
    const e = dist(g.x, g.y, ship.state.x, ship.state.y);
    if (e <= gd) [guard, gd] = [g, e];
  }
  if (!obj && !guard) return null;
  // A thing's own guard shows on its card; another guard nearer than the thing has a card of its own.
  const oc = obj ? objCard(game, s, obj) : null;
  const gc = guard && (!oc?.guard || oc.guard.id !== guard.id) ? guardCard(game, s, guard) : null;
  return { obj: oc, guard: oc ? (gc && gd < od ? gc : null) : gc };
}

export function sendCard(game: Game, s: PlayerSession, force: boolean): void {
  const a = adv(game);
  const v = cardView(game, s);
  const key = v ? JSON.stringify(v) : '';
  if (!force && a.cards.get(s) === key) return;
  if (a.cards.get(s) === key && key === '') return;
  a.cards.set(s, key);
  game.sendTo(s, { t: 'adv_card', view: v });
}

/** Every second: the guards in and out of the water (every other second), what each captain sees, her card. */
export function stepAdv(game: Game): void {
  if (quiet.has(game)) return;
  const a = adv(game);
  if (Math.floor(game.now) % 2 === 0) stepGuards(game);
  for (const s of game.sessions) {
    if (!s.profile || !s.ship) continue;
    const ship = s.ship;
    if (!ship.docked) {
      const seen = seenOf(game, s);
      let more = false;
      const x = ship.state.x, y = ship.state.y;
      for (const o of a.map.objs) if (!seen.has(o.id) && Math.abs(o.x - x) < SEE_R && Math.abs(o.y - y) < SEE_R && dist(o.x, o.y, x, y) <= SEE_R) {
        seen.add(o.id);
        more = true;
      }
      for (const g of a.map.guards) if (!seen.has(g.id) && Math.abs(g.x - x) < SEE_R && Math.abs(g.y - y) < SEE_R && dist(g.x, g.y, x, y) <= SEE_R) {
        seen.add(g.id);
        more = true;
      }
      if (more) advOf(s.profile).seen = [...seen];
    }
    if (Math.floor(game.now) % 2 === 0 || !a.told.has(s)) sendAdv(game, s, false);
    sendCard(game, s, false);
  }
}

// ------------------------------------------------------------------------------------------------ the admin

function nearestOf<T extends { x: number; y: number }>(list: T[], x: number, y: number): T | undefined {
  let best: T | undefined, bd = Infinity;
  for (const t of list) {
    const d = dist(t.x, t.y, x, y);
    if (d < bd) [best, bd] = [t, d];
  }
  return best;
}

/** Set her down `d` metres off a point, on the side toward where she came from (in open water), hove to. */
export function parkNear(game: Game, s: PlayerSession, x: number, y: number, d: number, prefer?: number): void {
  const ship = s.ship!;
  if (ship.docked) game.undock(s);
  let a = prefer ?? Math.atan2(ship.state.x - x, -(ship.state.y - y));
  let px = x, py = y, wet: [number, number, number] | null = null, found = false;
  for (let k = 0; k < 16 && !found; k++) {
    const qx = x + Math.sin(a + (k * Math.PI) / 8) * d, qy = y - Math.cos(a + (k * Math.PI) / 8) * d;
    if (openWater(game.world, qx, qy)) [px, py, a, found] = [qx, qy, a + (k * Math.PI) / 8, true];
    else if (!wet && !isLand(game.world, qx, qy) && depthAt(game.world, qx, qy) > ship.cls.draft + 1) wet = [qx, qy, a + (k * Math.PI) / 8];
  }
  if (!found && wet) [px, py, a] = wet;
  ship.state = { ...ship.state, x: px, y: py, heading: a + Math.PI, speed: 0, sail: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.region = game.regionAt(px, py);
  game.grid.upsert(ship.id, px, py);
}

/** `/guard [go|beat|weak|board|reset] [kind]`: the nearest guard (of a kind): sail to it, beat it, thin its men to a
 *  tenth (for the offer), grapple it at once, or every guard back. */
export function adminGuard(game: Game, s: PlayerSession, args: string[]): string {
  const a = adv(game);
  const ship = s.ship!;
  const kind = args.find((x) => (Object.keys(GUARDS) as string[]).includes(x));
  const minLevel = Number(args.find((x) => /^\d+$/.test(x)) ?? 0);
  const list = a.map.guards.filter((g) => (!kind || g.kind === kind) && g.level >= minLevel && (args[0] === 'reset' || guardUp(game, g) || args[0] === 'beat'));
  const g = nearestOf(list.filter((x) => guardUp(game, x)).length ? list.filter((x) => guardUp(game, x)) : list, ship.state.x, ship.state.y);
  if (args[0] === 'reset') {
    for (const id of Object.keys(a.st)) delete a.st[id];
    for (const [gid] of a.ships) {
      const gs = guardShip(game, gid);
      if (gs && !gs.boarding) game.removeShip(gs.id);
    }
    a.ships.clear();
    save(game);
    return `All ${a.map.guards.length} guards stand again.`;
  }
  if (!g) return 'No guards.';
  const name = guardName(g);
  if (args[0] === 'go') {
    parkNear(game, s, g.x, g.y, 130, -Math.PI / 2);
    ship.state.heading = 0;
    seenOf(game, s).add(g.id);
    advOf(s.profile!).seen = [...seenOf(game, s)];
    if (!guardShip(game, g.id) && guardUp(game, g)) raise(game, g);
    sendAdv(game, s, true);
    game.pushSelf(s, true);
    return `Off the ${name} (⚓${g.level}, ${armyMen(guardMenOf(game, g))} men).`;
  }
  if (args[0] === 'beat') {
    guardGone(game, g);
    return `The ${name} is beaten (⚓${g.level}).`;
  }
  if (args[0] === 'board') {
    // Alongside it and grappled at once (the boarding battle opens).
    const gs = guardShip(game, g.id) ?? raise(game, g);
    const bx = Math.cos(gs.state.heading), by = Math.sin(gs.state.heading);
    parkNear(game, s, gs.state.x + bx * 22, gs.state.y + by * 22, 1);
    ship.state.heading = gs.state.heading;
    return guardChoice(game, s, g.id, 'fight') ?? `Grappled: the ${name}.`;
  }
  if (args[0] === 'weak') {
    const gs = guardShip(game, g.id) ?? raise(game, g);
    const thin = gs.army.map((x) => ({ u: x.u, n: Math.max(1, Math.round(x.n / 10)) }));
    gs.setArmy(thin);
    (a.st[g.id] ??= {}).army = thin;
    save(game);
    return `The ${name} is thinned to ${armyMen(thin)} men.`;
  }
  const up = a.map.guards.filter((x) => guardUp(game, x)).length;
  return `Guards: ${a.map.guards.length}, standing ${up}. Nearest: the ${name} (⚓${g.level}, ${armyMen(guardMenOf(game, g))} men), ${Math.round(dist(g.x, g.y, ship.state.x, ship.state.y))} m away.`;
}

/** `/obj [kind] [go|reset]`: the nearest thing on the map (of a kind): sail to it; forget her visits. */
export function adminObj(game: Game, s: PlayerSession, args: string[]): string {
  const a = adv(game);
  const ship = s.ship!;
  const kind = args.find((x) => (Object.keys(OBJS) as string[]).includes(x)) as ObjKind | undefined;
  if (args.includes('reset')) {
    advOf(s.profile!).v = {};
    advOf(s.profile!).pts = 0;
    sendAdv(game, s, true);
    sendCard(game, s, true);
    return 'Your visits are forgotten.';
  }
  const o = nearestOf(a.map.objs.filter((x) => !kind || x.kind === kind), ship.state.x, ship.state.y);
  if (!o) return 'Nothing on the map.';
  const name = OBJS[o.kind].name[0];
  if (args.includes('go')) {
    parkNear(game, s, o.x, o.y, 120, -Math.PI / 2);
    ship.state.heading = 0;
    seenOf(game, s).add(o.id);
    advOf(s.profile!).seen = [...seenOf(game, s)];
    sendAdv(game, s, true);
    sendCard(game, s, true);
    game.pushSelf(s, true);
    return `By the ${name} (⚓${o.level}).`;
  }
  return `Things on the map: ${a.map.objs.length}. Nearest: the ${name} (⚓${o.level}), ${Math.round(dist(o.x, o.y, ship.state.x, ship.state.y))} m away.`;
}
