// Quests near their port (owner, 2026-10-18: «у меня квест начальный выловить косяк рыб — я нажал автоплавание и мне
// показало 12км, это бред. все что берется в портах, должно делаться недалеко от них, в районе 1,5км максимум. добавь
// косяки рыб побольше и все завяжи рядышком, за исключением каких-то элитных квестов где надо побольше поплавать»).
//
// A quest taken in a port (a board's job, a side chain, an arc's chapter, a port's contract, an island's people's job)
// is done within LOCAL_R of where it was taken:
//   - its places (an island to land on, a lair to break) are picked near its port by the generators (questgen.ts,
//     lairquests.ts);
//   - a step done anywhere (sink, board, take prizes, tribute, fish, hunt beasts, dive…) is routed to the nearest place
//     of it within LOCAL_R of the port (goalroute.ts) — and what is to be fought is put out there for her (`localTick`:
//     raiders, ghosts, merchantmen, beasts within LOCAL_R of the port while she is about it, like the campaign's foes),
//     a net's work has the harbour's own shoals (fishing.ts PORT_SHOALS);
//   - a hunt's leader puts out about the port, and one far off (a save from before) is called in (`localTick`).
// Exceptions sail far, and their cards say so («Дальний рейс · N км», `questFar`): the main campaign, the Paths and the
// Legends, the day's group contract (elite), the Admiralty's contracts, and a voyage between ports (a delivery, a
// courier's run, a race, a scouting of a far sea) — the quest names where it goes.

import { BEASTS, BEAST_IDS, inGroup } from '../../../shared/src/data/beasts.ts';
import type { BeastGroup, BeastId } from '../../../shared/src/data/beasts.ts';
import { isAdmId } from '../../../shared/src/data/admiralty.ts';
import type { QuestDef, QuestStep } from '../../../shared/src/data/quests.ts';
import { QUESTS_BY_ID } from '../../../shared/src/data/quests.ts';
import { shipLevelOf } from '../../../shared/src/data/shiplevel.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { spawnBeast } from './beasts.ts';
import type { Game } from './Game.ts';
import { spawnQuestFoe } from './npc.ts';
import { onboardingProtected } from './onboarding.ts';
import type { PlayerSession } from './player.ts';
import { questBand } from './quests.ts';
import type { QuestState } from './quests.ts';
import type { ShipEntity } from './ship.ts';
import { openSea } from './wrecks.ts';

/** How far from its port a port-taken quest is done (m). */
export const LOCAL_R = 1500;
/** Its quarry is put out while she is within this of the port (at sea, or in it). */
export const LOCAL_WATCH = 4000;
/** Of a quest's quarry, at most this many at once; another after this many seconds. */
export const LOCAL_FOES = 2;
export const LOCAL_EVERY = 20;

/** Where a quest is done about: its port (or the island whose people gave it), or null — a quest that may sail far. */
export interface Home {
  x: number;
  y: number;
  port?: string;
  island?: number;
}

/** A quest that is not bound to its port: the campaign, a Path, a Legend, a hidden quest, the day's group contract,
 *  the Admiralty's. */
export function farByKind(q: QuestDef): boolean {
  return q.kind === 'campaign' || q.kind === 'path' || q.kind === 'legend' || !!q.hidden || q.category === 'elite' || isAdmId(q.id);
}

/** Where it was given: its port, or the island of its people. */
export function questOrigin(game: Game, q: QuestDef): Home | null {
  if (q.island !== undefined) {
    const is = game.world.islands[q.island];
    if (is) return { x: is.x, y: is.y, island: is.id };
  }
  const p = game.portById(q.port);
  return p ? { x: p.x, y: p.y, port: p.id } : null;
}

/** The place a quest is bound to, or null (it may sail far). */
export function questHome(game: Game, q: QuestDef): Home | null {
  return farByKind(q) ? null : questOrigin(game, q);
}

/** A step done anywhere (no place of its own): the locality rule finds it a place near the port. */
export function anywhereStep(st: QuestStep): boolean {
  switch (st.type) {
    case 'sink':
      return st.role !== 'elite';
    case 'board':
    case 'prize':
    case 'catch':
    case 'beast':
    case 'dive':
    case 'rescue':
    case 'tribute':
    case 'letters':
    case 'customs':
    case 'chart':
    case 'fleet_win':
      return true;
    case 'lair':
      return st.island === undefined;
    default:
      return false;
  }
}

/** The nearest island of a sea to a point (cached per sea and point): how far that sea lies. */
const seaFar = new WeakMap<Game, Map<string, number>>();
function distToSea(game: Game, at: { x: number; y: number }, region: RegionId): number {
  if (game.regionAt(at.x, at.y) === region) return 0;
  let m = seaFar.get(game);
  if (!m) seaFar.set(game, (m = new Map()));
  const key = `${region}|${Math.round(at.x)}|${Math.round(at.y)}`;
  let d = m.get(key);
  if (d === undefined) {
    d = Infinity;
    for (const is of game.world.islands) if (is.region === region) d = Math.min(d, Math.hypot(is.x - at.x, is.y - at.y) - is.radius);
    if (!Number.isFinite(d)) d = 0;
    m.set(key, d);
  }
  return d;
}

/** How far a step's own place lies from a point (0: a step done anywhere, or there). */
export function stepFar(game: Game, at: { x: number; y: number }, st: QuestStep): number {
  let to: { x: number; y: number; radius?: number } | null | undefined = null;
  switch (st.type) {
    case 'visit':
    case 'deliver':
    case 'pickup':
    case 'race':
    case 'landres':
      to = game.portById(st.port);
      break;
    case 'sell_contraband':
      to = st.port ? game.portById(st.port) : null;
      break;
    case 'land':
    case 'isle':
      to = st.island >= 0 ? game.world.islands[st.island] : null;
      break;
    case 'lair':
      to = st.island !== undefined ? game.world.islands[st.island] : null;
      break;
    case 'reach':
    case 'time_in':
    case 'die_in':
      return Math.max(0, distToSea(game, at, st.region));
    default:
      return 0;
  }
  if (!to) return 0;
  return Math.max(0, Math.hypot(to.x - at.x, to.y - at.y) - (to.radius ?? 0));
}

/** How far a quest sends her from where it is given (m): its farthest place. A card shows «Дальний рейс · N км» when it
 *  is past LOCAL_R. Kept per quest. */
const farMemo = new WeakMap<QuestDef, number>();
export function questFar(game: Game, q: QuestDef): number {
  let d = farMemo.get(q);
  if (d === undefined) {
    const at = questOrigin(game, q);
    d = 0;
    if (at) for (const st of q.steps) d = Math.max(d, stepFar(game, at, st));
    d = Math.round(d);
    farMemo.set(q, d);
  }
  return d;
}

/** A far voyage (the card's word): past LOCAL_R, in metres; null when it is done near its port. */
export function farVoyage(game: Game, q: QuestDef): number | null {
  const d = questFar(game, q);
  return d > LOCAL_R ? d : null;
}

/** The port a step done anywhere of a quest of hers is bound to now, or null. */
export function localHomeOf(game: Game, qs: QuestState): Home | null {
  const q = QUESTS_BY_ID[qs.id];
  const st = q?.steps[qs.step];
  if (!q || !st || !anywhereStep(st)) return null;
  return questHome(game, q);
}

/** Within LOCAL_R of a place (a candidate's own reach counted, up to a cable). */
export function nearHome(home: { x: number; y: number }, x: number, y: number, r = 0): boolean {
  return Math.hypot(x - home.x, y - home.y) <= LOCAL_R + Math.min(r, 200);
}

// ------------------------------------------------------------------ the quarry put out near the port

interface Watch {
  step: number;
  ids: number[];
  next: number;
}
const watches = new WeakMap<PlayerSession, Map<string, Watch>>();

/** What a step's quarry is: a raider, a ghost, a merchantman, a beast of a group — or nothing to put out. */
type Quarry = { ship: 'pirate' | 'ghost' | 'merchant'; region?: RegionId; minTier?: number } | { beast: BeastGroup } | null;
function quarryOf(st: QuestStep): Quarry {
  switch (st.type) {
    case 'sink':
      if (st.role === 'ghost') return { ship: 'ghost' };
      if (st.role === 'merchant') return { ship: 'merchant', ...(st.region ? { region: st.region } : {}) };
      if (st.role && st.role !== 'pirate') return null; // patrols and hunters: the law's own, not put out for her
      return { ship: 'pirate', ...(st.region ? { region: st.region } : {}), ...(st.minTier ? { minTier: st.minTier } : {}) };
    case 'board':
    case 'prize':
    case 'fleet_win':
      return { ship: 'pirate' };
    case 'tribute':
      return { ship: 'merchant' };
    case 'beast':
      return { beast: st.group };
    default:
      return null;
  }
}

/** How many more a step wants. */
function left(st: QuestStep, qs: QuestState): number {
  const need = 'count' in st && typeof st.count === 'number' ? st.count : 1;
  return Math.max(0, Math.ceil(need - qs.progress));
}

/** The ⚓ of her quarry: her ship's, within the quest's band. */
function quarryLevel(game: Game, s: PlayerSession, q: QuestDef): number {
  const mine = shipLevelOf(s.profile!.loadout);
  const [lo, hi] = questBand(game, q);
  return Math.max(1, Math.min(10, Math.max(lo, Math.min(hi, mine))));
}

/** A beast of a group for the port's waters (one of those seas first). */
function beastOfGroup(game: Game, group: BeastGroup, at: { x: number; y: number }): BeastId {
  const region = game.regionAt(at.x, at.y);
  const fits = BEAST_IDS.filter((id) => (group === 'any' || inGroup(id, group)) && id !== 'white_orca' && id !== 'young_serpent');
  const native = fits.filter((id) => BEASTS[id].regions.includes(region));
  return (native[0] ?? fits[0] ?? 'shark') as BeastId;
}

/** Her quarry put out under a key (a quest's id, a day's order's `d:<kind>`), alive and not yet taken. */
export function localQuarry(game: Game, s: PlayerSession, key: string): ShipEntity[] {
  const w = watches.get(s)?.get(key);
  if (!w) return [];
  return w.ids.map((id) => game.ships.get(id)).filter((o): o is ShipEntity => !!o && o.alive && !o.surrendered && !o.prize);
}

/** Put out her quarry under a key about a place, up to `want` at once (one every LOCAL_EVERY; at once when `force`, a
 *  tap of «Плыть» that found none there): the ones there now. */
function putOut(game: Game, s: PlayerSession, key: string, step: number, home: Home, what: NonNullable<Quarry>, want: number, lv: number, force: boolean): ShipEntity[] {
  let m = watches.get(s);
  if (!m) watches.set(s, (m = new Map()));
  let w = m.get(key);
  if (!w || w.step !== step) {
    w = { step, ids: [], next: 0 };
    m.set(key, w);
  }
  w.ids = w.ids.filter((id) => {
    const o = game.ships.get(id);
    return !!o && o.alive && !o.surrendered && !o.prize && Math.hypot(o.state.x - home.x, o.state.y - home.y) < LOCAL_R + 800;
  });
  if (w.ids.length >= Math.min(LOCAL_FOES, want) || (!force && game.now < w.next)) return localQuarry(game, s, key);
  w.next = game.now + LOCAL_EVERY;
  if ('beast' in what) {
    const id = beastOfGroup(game, what.beast, home);
    for (let k = 0; k < 10; k++) {
      const a = game.rng.float() * Math.PI * 2, d = 500 + game.rng.float() * (LOCAL_R * 0.8 - 500);
      const x = home.x + Math.cos(a) * d, y = home.y + Math.sin(a) * d;
      if (!openSea(game, x, y)) continue;
      const b = spawnBeast(game, id, x, y, Math.max(BEASTS[id].level[0], Math.min(BEASTS[id].level[1], lv)));
      w.ids.push(b.id);
      break;
    }
  } else {
    const foe = spawnQuestFoe(game, home, what.ship, lv, LOCAL_R, what.minTier ?? 0, what.region);
    if (foe) w.ids.push(foe.id);
  }
  return localQuarry(game, s, key);
}

/** A quest's quarry about its port (its step a fight or a hunt): the ones there now. */
export function ensureQuarry(game: Game, s: PlayerSession, qs: QuestState, force = false): ShipEntity[] {
  const q = QUESTS_BY_ID[qs.id];
  const st = q?.steps[qs.step];
  const home = q ? questHome(game, q) : null;
  if (!q || !st || !home || !anywhereStep(st) || !s.profile) return [];
  const what = quarryOf(st);
  if (!what) return [];
  return putOut(game, s, qs.id, qs.step, home, what, left(st, qs), quarryLevel(game, s, q), force);
}

/** A day's order's quarry about the port nearest her (dailies.ts: the sink, the boarding, the beast orders), or a port's
 *  bounty's (`c:<contract>`) about its port. */
export function ensureDailyQuarry(game: Game, s: PlayerSession, kind: string, want: number, home: Home): ShipEntity[] {
  const what: Quarry = kind.startsWith('c:') || kind === 'sink' || kind === 'sink_pirates' || kind === 'board' || kind === 'prize' || kind === 'fleet' ? { ship: 'pirate' } : kind === 'beast' ? { beast: 'any' } : null;
  if (!what || !s.profile) return [];
  const lv = Math.max(1, Math.min(10, shipLevelOf(s.profile.loadout)));
  return putOut(game, s, `d:${kind}`, 0, home, what, want, lv, true);
}

/** Every few seconds (quests.ts, the tick): about the port of a quest of hers whose step is a fight, its quarry; a hunt's
 *  leader far off (a save from before the rule) called in to the port. */
export function localTick(game: Game, s: PlayerSession): void {
  const p = s.profile, ship = s.ship;
  if (!p || !ship || !ship.alive || ship.boarding || onboardingProtected(s)) return;
  if ((game.tick + s.accountId) % 60 !== 0) return; // every 3 s a captain
  for (const qs of p.quests.active) {
    const q = QUESTS_BY_ID[qs.id];
    const home = q ? questHome(game, q) : null;
    if (!q || !home) continue;
    if (Math.hypot(ship.state.x - home.x, ship.state.y - home.y) > LOCAL_WATCH) continue;
    callLeaderIn(game, qs, home);
    const st = q.steps[qs.step];
    if (st && anywhereStep(st) && !ship.docked) ensureQuarry(game, s, qs);
  }
}

/** A hunt's leader sailing far from the port (put out by the old rule, about the sea's heart): brought in near it. */
export function callLeaderIn(game: Game, qs: QuestState, home: Home): void {
  if (qs.leader === undefined) return;
  const o = game.ships.get(qs.leader);
  if (!o || !o.alive) return;
  if (Math.hypot(o.state.x - home.x, o.state.y - home.y) <= LOCAL_R + 800) return;
  for (let k = 0; k < 12; k++) {
    const a = game.rng.float() * Math.PI * 2, d = 600 + game.rng.float() * (LOCAL_R * 0.7 - 600);
    const x = home.x + Math.cos(a) * d, y = home.y + Math.sin(a) * d;
    if (!openSea(game, x, y)) continue;
    o.state = { ...o.state, x, y, speed: 0 };
    game.grid.upsert(o.id, x, y);
    const brain = game.npcs.get(o.id);
    if (brain) brain.area = { x: home.x, y: home.y, r: LOCAL_R };
    return;
  }
}
