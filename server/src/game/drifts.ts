// docs/18 IV on the server, the drifting creatures (items 34, 35, 36 at sea, 40): now and then the lookout of a
// captain under way sights something adrift off her bow — an injured serpent on wreckage, seals on a floe, the drowned
// in a boat, a mermaid in the nets, turtles in the weed, gulls on a mast, a tentacle in a lost chain — by the level of
// the square and its waters, for a few minutes (a mark on her minimap with its clock, a word of the lookout, never
// more than one a few minutes). Within reach of the boats, its card: the ways to save it without a fight, each with its
// chance from her crew, her skills and her path; a way chosen opens a short mini-game (a needle to stop three times in
// its band) that lifts or lowers the chance; saved, they join her army as a stack (the rest home to her pen) or give a
// gift; or she fights them on the battle ashore laid over the wreckage, and some of the beaten may follow her. Once a
// season a legend rises (the white whale, the young kraken): it is told to every captain at sea, only one captain may
// be at it at a time, the first to save or beat it has it, and the chronicle keeps her name.
//
// The drifts are the sea's for a few minutes, not saved; the legend's season is. Every roll here is on its own Rng.

import { UNITS, armyPower } from '../../../shared/src/data/army.ts';
import type { ArmyStack, UnitId } from '../../../shared/src/data/army.ts';
import { BEAST_PLURAL } from '../../../shared/src/data/bestiary.ts';
import { DRIFTS, DRIFT_AT, DRIFT_CARD_R, DRIFT_EVERY, DRIFT_FIND, DRIFT_KINDS, DRIFT_REACH, DRIFT_SEE, DRIFT_TTL, LEGEND_KINDS, LEGEND_TTL, MINI_BAND, MINI_HIT, MINI_MISS, MINI_TAPS, RESCUE_WAYS, driftCount, driftFightPay, driftGift, driftKindsFor, driftWorth, isDriftKind, needleAt, peopleOf, wayChance, wayCost } from '../../../shared/src/data/drifts.ts';
import type { DriftKind, RescueCtx, RescueWay } from '../../../shared/src/data/drifts.ts';
import { rankOf } from '../../../shared/src/data/hero.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { ladder } from '../../../shared/src/data/shiplevel.ts';
import type { DriftCard, DriftClientMsg, DriftMark } from '../../../shared/src/driftproto.ts';
import type { LairLoot } from '../../../shared/src/lairproto.ts';
import { dist, headingVec } from '../../../shared/src/math.ts';
import { Rng, hashString } from '../../../shared/src/rng.ts';
import { WORLD_SIZE } from '../../../shared/src/constants.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import { isLand, regionAt } from '../../../shared/src/world/worldgen.ts';
import { advQuiet, parkNear } from './advmap.ts';
import { fightCapture, landFighting, startCreatureFight } from './beastlairs.ts';
import { giveGoods, quietSea } from './director.ts';
import type { Game } from './Game.ts';
import { heroOf } from './hero.ts';
import { onboardingProtected } from './onboarding.ts';
import type { PlayerSession, Profile } from './player.ts';
import { chronicle } from './renown.ts';
import { seasonId } from './seasons.ts';
import { sideOf } from './tactical.ts';
import { lossesOf } from './tacbattle.ts';
import type { TacBattle } from './tacbattle.ts';
import { captureOffer, creatureRoom, fromPen, joinCreatures, penRoom, release, sendTame, sendToPen, tamerBuy, tamerSell, toPen } from './tame.ts';
import { keepsDeep } from './town.ts';
import { landParty } from '../../../shared/src/data/lairs.ts';
import { WEEK_BEAST_DRIFT, weekOfBeast } from '../../../shared/src/data/week.ts';
import { weekNow } from './calendar.ts';

/** docs/18 #45: a creature's week — its drifts this many times as likely, and the lookouts find something oftener. */
const WEEK_FIND = 0.9;
const weekDrifts = (game: Game): boolean => DRIFT_KINDS.some((k) => !DRIFTS[k].legend && weekOfBeast(weekNow(game), DRIFTS[k].u));

/** What a captain keeps of the drifts: how many she has saved and beaten, the legends that are hers. */
export interface DriftProfile {
  saved: number;
  beaten: number;
  legends: string[];
}

export function driftOf(p: Profile): DriftProfile {
  const d = (p.drift ??= { saved: 0, beaten: 0, legends: [] });
  d.saved = Math.max(0, Math.floor(d.saved ?? 0));
  d.beaten = Math.max(0, Math.floor(d.beaten ?? 0));
  if (!Array.isArray(d.legends)) d.legends = [];
  return d;
}

/** A drift on the water. */
export interface Drift {
  id: number;
  kind: DriftKind;
  level: number;
  n: number;
  x: number;
  y: number;
  born: number;
  until: number;
  /** The captain it was sighted for (−1: a legend, the sea's). */
  owner: number;
  /** The captain at it now (a rescue's mini-game, a fight): nobody else may be. */
  taken?: number;
  mini?: { acc: number; way: RescueWay; t0: number; phase: number; taps: boolean[]; chance: number; ends: number };
}

/** The season's legend (saved with the world): its kind, when it rises next, where it is, who had it. */
interface LegendState {
  season: number;
  kind: DriftKind;
  rise: number;
  id?: number;
  done?: { by: string; how: 'save' | 'beat' };
}

interface DS {
  list: Map<number, Drift>;
  seq: number;
  rng: Rng;
  next: Map<number, number>;
  toldAt: Map<number, number>;
  marks: WeakMap<PlayerSession, string>;
  cards: WeakMap<PlayerSession, string>;
  seen: WeakMap<PlayerSession, Set<number>>;
  legend: LegendState | null;
}

const all = new WeakMap<Game, DS>();
const still = new WeakSet<Game>();
/** The drifts kept still for a game (the tick's A/B measure; the tests of other systems keep them still with the
 *  adventure map). */
export function quietDrifts(game: Game, on = true): void {
  if (on) still.add(game);
  else still.delete(game);
}
const quiet = (game: Game): boolean => advQuiet(game) || still.has(game);
const LKEY = 'h18:legend';

function D(game: Game): DS {
  let x = all.get(game);
  if (!x) {
    x = { list: new Map(), seq: 1, rng: new Rng(0xd71f7), next: new Map(), toldAt: new Map(), marks: new WeakMap(), cards: new WeakMap(), seen: new WeakMap(), legend: game.db.getKv<LegendState>(LKEY) ?? null };
    // A legend on the water when the server went down sinks with it; it rises again.
    if (x.legend?.id !== undefined) delete x.legend.id;
    all.set(game, x);
  }
  return x;
}
const saveLegend = (game: Game) => game.db.setKv(LKEY, D(game).legend);

export const driftName = (k: DriftKind): string => DRIFTS[k].name[0];
const beasts = (u: UnitId): string => BEAST_PLURAL[u as keyof typeof BEAST_PLURAL]?.[0] ?? u;
export const driftList = (game: Game): Drift[] => [...D(game).list.values()];
export const driftById = (game: Game, id: number): Drift | undefined => D(game).list.get(id);

// ------------------------------------------------------------------------------------------------ 34. the sighting

/** Open water about a point: no land within the drift's raft nor the boats' way round it. */
function openWater(game: Game, x: number, y: number): boolean {
  if (!game.inZone(x, y) || isLand(game.world, x, y)) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (isLand(game.world, x + Math.sin(a) * 160, y - Math.cos(a) * 160)) return false;
  }
  for (const p of game.world.ports) if (Math.abs(p.x - x) < 1600 && Math.abs(p.y - y) < 1600 && dist(p.x, p.y, x, y) < 1600) return false;
  return true;
}

/** A drift of a kind put on the water at a point (by the level of its square). */
function putDrift(game: Game, kind: DriftKind, x: number, y: number, owner: number, ttl?: number): Drift {
  const S = D(game);
  const level = sectorAt(game.world, x, y).level;
  const d: Drift = {
    id: S.seq++, kind, level: DRIFTS[kind].legend ? Math.max(DRIFTS[kind].lv[0], level) : level, n: 0, x: Math.round(x), y: Math.round(y), born: game.now,
    until: game.now + (ttl ?? (DRIFTS[kind].legend ? LEGEND_TTL : S.rng.range(DRIFT_TTL[0], DRIFT_TTL[1]))), owner,
  };
  d.n = driftCount(kind, d.level);
  S.list.set(d.id, d);
  return d;
}

/** The lookout's look for one captain under way: something adrift off her bow, by her square's level and waters. */
function sight(game: Game, s: PlayerSession): Drift | null {
  const S = D(game);
  const ship = s.ship!;
  const sec = sectorAt(game.world, ship.state.x, ship.state.y);
  const region = regionAt(game.world, ship.state.x, ship.state.y);
  if (region === 'the_abyss') return null;
  const wk = weekNow(game);
  const kinds = driftKindsFor(sec.level, region).map(([k, w]) => [k, weekOfBeast(wk, DRIFTS[k].u) ? w * WEEK_BEAST_DRIFT : w] as [DriftKind, number]);
  if (!kinds.length) return null;
  const tot = kinds.reduce((a, [, w]) => a + w, 0);
  let r = S.rng.float() * tot, kind = kinds[0][0];
  for (const [k, w] of kinds) {
    r -= w;
    if (r <= 0) {
      kind = k;
      break;
    }
  }
  for (let k = 0; k < 10; k++) {
    const v = headingVec(ship.state.heading + S.rng.range(-0.8, 0.8));
    const far = S.rng.range(DRIFT_AT[0], DRIFT_AT[1]);
    const x = ship.state.x + v.x * far, y = ship.state.y + v.y * far;
    if (!openWater(game, x, y)) continue;
    return putDrift(game, kind, x, y, s.accountId);
  }
  return null;
}

/** Every second: the drifts gone with their time, the lookouts' looks, the legend's season, the marks and the cards. */
export function stepDrifts(game: Game): void {
  if (quiet(game)) return;
  const S = D(game);
  for (const d of [...S.list.values()]) {
    if (d.mini && game.now >= d.mini.ends) resolveMini(game, d);
    const at = d.taken !== undefined ? game.sessionByAccount(d.taken) : undefined;
    if (game.now < d.until || (at && landFighting(game, at))) continue;
    S.list.delete(d.id);
    if (DRIFTS[d.kind].legend) legendGone(game, d, false);
  }
  stepLegend(game);
  const even = Math.floor(game.now) % 2 === 0;
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !s.profile || !ship.alive || ship.ghost) continue;
    if (game.directorOn && !ship.docked && !onboardingProtected(s)) {
      const due = S.next.get(s.accountId);
      if (due === undefined) S.next.set(s.accountId, game.now + S.rng.range(DRIFT_EVERY[0], DRIFT_EVERY[1]) * 0.5);
      else if (game.now >= due) {
        if (!quietSea(game, s)) S.next.set(s.accountId, game.now + 20); // a fight or a harbour puts it off
        else {
          S.next.set(s.accountId, game.now + S.rng.range(DRIFT_EVERY[0], DRIFT_EVERY[1]));
          const mine = [...S.list.values()].some((d) => d.owner === s.accountId);
          if (!mine && S.list.size < 6 + game.sessions.size * 2 && S.rng.chance(weekDrifts(game) ? WEEK_FIND : DRIFT_FIND)) sight(game, s);
        }
      }
    }
    if (even || !S.marks.has(s)) sendDrifts(game, s, false);
    sendDriftCard(game, s, false);
  }
}

/** The drifts within sight of her, for her minimap and her sea. */
function marksOf(game: Game, s: PlayerSession): DriftMark[] {
  const ship = s.ship!;
  const out: DriftMark[] = [];
  const R = DRIFT_SEE * 1.8;
  for (const d of D(game).list.values()) {
    if (Math.abs(d.x - ship.state.x) > R || Math.abs(d.y - ship.state.y) > R) continue;
    out.push({ id: d.id, kind: d.kind, x: d.x, y: d.y, level: d.level, n: d.n, left: Math.max(0, Math.round(d.until - game.now)), ttl: Math.round(d.until - d.born), ...(DRIFTS[d.kind].legend ? { legend: true } : {}), ...(d.taken !== undefined && d.taken !== s.accountId ? { taken: true } : {}) });
  }
  return out;
}

export function sendDrifts(game: Game, s: PlayerSession, force: boolean): void {
  const S = D(game);
  if (!s.ship) return;
  const list = marksOf(game, s);
  const key = JSON.stringify(list.map((m) => [m.id, m.n, m.taken ?? 0]));
  if (!force && S.marks.get(s) === key) return;
  S.marks.set(s, key);
  game.sendTo(s, { t: 'drifts', list });
  // The lookout's word, once a drift is first within sight (no more than one every four minutes; a legend always).
  let seen = S.seen.get(s);
  if (!seen) S.seen.set(s, (seen = new Set()));
  const ship = s.ship;
  for (const m of list) {
    if (seen.has(m.id) || dist(m.x, m.y, ship.state.x, ship.state.y) > DRIFT_SEE) continue;
    seen.add(m.id);
    const last = S.toldAt.get(s.accountId) ?? -Infinity;
    if (!m.legend && game.now - last < 240) continue;
    S.toldAt.set(s.accountId, game.now);
    game.toastShip(ship, `Lookout: ${driftName(m.kind)} adrift ${bearing(ship.state.x, ship.state.y, ship.state.heading, m.x, m.y)}, ${Math.max(50, Math.round(dist(m.x, m.y, ship.state.x, ship.state.y) / 50) * 50)} m.`, m.legend ? 'gold' : 'info');
  }
}

/** The side a point lies on, from her bow. */
function bearing(x: number, y: number, heading: number, tx: number, ty: number): string {
  const a = Math.atan2(tx - x, -(ty - y)) - heading;
  const r = Math.atan2(Math.sin(a), Math.cos(a));
  const d = Math.abs(r);
  return d < 0.5 ? 'off the bow' : d > 2.6 ? 'astern' : r > 0 ? 'to starboard' : 'to larboard';
}

// ------------------------------------------------------------------------------------------------ 35. the card

function nearest(game: Game, s: PlayerSession, R: number): Drift | null {
  const ship = s.ship!;
  let best: Drift | null = null, bd = R;
  for (const d of D(game).list.values()) {
    if (Math.abs(d.x - ship.state.x) > bd || Math.abs(d.y - ship.state.y) > bd) continue;
    const e = dist(d.x, d.y, ship.state.x, ship.state.y);
    if (e < bd) [best, bd] = [d, e];
  }
  return best;
}

/** What the ways of rescue look at for her. */
function ctxOf(game: Game, s: PlayerSession, d: Drift): RescueCtx {
  const ship = s.ship!, p = s.profile!;
  const h = heroOf(p);
  const cost = (w: RescueWay) => wayCost(d.kind, w, d.level);
  const has = (w: RescueWay) => {
    const c = cost(w);
    return !!c && (ship.cargo[c.good] ?? 0) >= c.n;
  };
  return {
    level: d.level, men: ship.crew, shooters: ship.army.filter((x) => UNITS[x.u].specials.includes('shooter')).reduce((a, x) => a + x.n, 0),
    leadership: rankOf(h.skills, 'leadership'), firstAid: rankOf(h.skills, 'first_aid'), mysticism: rankOf(h.skills, 'mysticism'), will: h.prim.will ?? 0, path: p.captain ?? null,
    food: has('feed'), medicine: has('heal'),
  };
}

/** Why nothing may be done at it now (null: she may). */
function busyWhy(game: Game, s: PlayerSession, d: Drift): string | null {
  const ship = s.ship;
  if (!ship || ship.docked) return 'Put to sea first.';
  if (ship.boarding || ship.grappled || ship.landing) return 'Not now';
  if (landFighting(game, s)) return 'Your party is ashore already.';
  if (d.taken !== undefined && d.taken !== s.accountId) return 'Another captain is at it already.';
  if (ship.inCombat(game.now)) return 'Not while under fire';
  if (dist(d.x, d.y, ship.state.x, ship.state.y) > DRIFT_REACH) return 'Come alongside: within the boats’ reach.';
  if (ship.state.speed > 2.5) return 'Heave to first — the boats cannot be lowered at speed';
  return null;
}

/** They will serve her: not the drowned for a living crew (unless the Choir's, the cursed, or the Drowned's path). */
function serves(s: PlayerSession, d: Drift): boolean {
  const u = DRIFTS[d.kind].u;
  return peopleOf(u) !== 'deep' || keepsDeep(s) || s.profile?.captain === 'drowned';
}

function card(game: Game, s: PlayerSession, d: Drift): DriftCard {
  const ship = s.ship!;
  const def = DRIFTS[d.kind];
  const why = busyWhy(game, s, d);
  const c = ctxOf(game, s, d);
  const ways = def.ways.map((w) => {
    const cost = wayCost(d.kind, w, d.level);
    const chance = wayChance(d.kind, w, c);
    const lack = cost && (ship.cargo[cost.good] ?? 0) < cost.n ? (cost.good === 'medicine' ? 'No medicine aboard for it.' : cost.good === 'rum' ? 'No rum aboard for it.' : 'Not enough fish aboard for it.') : null;
    const noShot = w === 'shoot' && c.shooters <= 0 ? 'No shooters in your army.' : null;
    return { way: w, chance: Math.round(chance * 100) / 100, cost, why: lack ?? noShot };
  });
  const joins = serves(s, d);
  const room = joins ? Math.min(d.n, creatureRoom(ship, def.u)) : 0;
  return {
    id: d.id, kind: d.kind, level: d.level, u: def.u, n: d.n, left: Math.max(0, Math.round(d.until - game.now)), reach: dist(d.x, d.y, ship.state.x, ship.state.y) <= DRIFT_REACH,
    ways, room, pen: joins ? Math.min(d.n, penRoom(game, s, def.u)) : 0, gift: driftGift(d.kind, d.level), joins,
    fightWhy: why ?? (d.mini ? 'Not now' : null), why: d.mini && d.mini.acc === s.accountId ? null : why,
    ...(d.mini && d.mini.acc === s.accountId ? { mini: { way: d.mini.way, t0: d.mini.t0, phase: d.mini.phase, taps: [...d.mini.taps], chance: d.mini.chance } } : {}),
    ...(def.legend ? { legend: true } : {}),
  };
}

export function sendDriftCard(game: Game, s: PlayerSession, force: boolean): void {
  const S = D(game);
  const ship = s.ship;
  const d = !ship || ship.docked || ship.boarding || landFighting(game, s) || quiet(game) ? null : nearest(game, s, DRIFT_CARD_R);
  const c = d ? card(game, s, d) : null;
  const key = c ? JSON.stringify({ ...c, left: Math.round(c.left / 30) }) : '';
  if (!force && S.cards.get(s) === key) return;
  if (S.cards.get(s) === key && key === '') return;
  S.cards.set(s, key);
  game.sendTo(s, { t: 'drift_card', card: c });
}

// ------------------------------------------------------------------------------------------------ 35. the rescue

/** A way of rescue chosen: its cost paid, the mini-game's needle set swinging (or, `quick`, the dice at once). */
export function startRescue(game: Game, s: PlayerSession, id: number, way: RescueWay, quick = false): string | null {
  const d = D(game).list.get(id);
  if (!d) return 'They are gone';
  const why = busyWhy(game, s, d);
  if (why) return why;
  if (d.mini) return 'Not now';
  if (!(RESCUE_WAYS as string[]).includes(way) || !DRIFTS[d.kind].ways.includes(way)) return 'No such way';
  const ship = s.ship!;
  const c = ctxOf(game, s, d);
  const cost = wayCost(d.kind, way, d.level);
  if (cost && (ship.cargo[cost.good] ?? 0) < cost.n) return cost.good === 'medicine' ? 'No medicine aboard for it.' : cost.good === 'rum' ? 'No rum aboard for it.' : 'Not enough fish aboard for it.';
  if (way === 'shoot' && c.shooters <= 0) return 'No shooters in your army.';
  const chance = wayChance(d.kind, way, c);
  if (cost) {
    ship.cargo[cost.good] = (ship.cargo[cost.good] ?? 0) - cost.n;
    if ((ship.cargo[cost.good] ?? 0) <= 0) delete ship.cargo[cost.good];
  }
  ship.input = { rudder: 0, sailTarget: 0 };
  d.taken = s.accountId;
  d.mini = { acc: s.accountId, way, t0: game.now + 0.8, phase: D(game).rng.float(), taps: [], chance, ends: game.now + 25 };
  d.until = Math.max(d.until, game.now + 30);
  if (quick) return resolveMini(game, d);
  sendDriftCard(game, s, true);
  game.pushSelf(s, true);
  return null;
}

/** A tap of the needle (at the world time she saw it, within a little of the server's). */
export function tapRescue(game: Game, s: PlayerSession, id: number, at?: number): string | null {
  const d = D(game).list.get(id);
  if (!d?.mini || d.mini.acc !== s.accountId) return 'Nothing to do';
  const t = Number.isFinite(at) ? Math.max(game.now - 0.8, Math.min(game.now + 0.2, Number(at))) : game.now;
  if (t < d.mini.t0) return null;
  const pos = needleAt(t - d.mini.t0, d.mini.phase);
  d.mini.taps.push(Math.abs(pos - 0.5) <= MINI_BAND / 2);
  if (d.mini.taps.length >= MINI_TAPS) return resolveMini(game, d);
  sendDriftCard(game, s, true);
  return null;
}

/** The rescue's dice, with the mini-game's taps counted: saved (they join, go home to the pen, or give a gift), or
 *  lost to the sea. `force`: the tester's verdict. */
export function resolveMini(game: Game, d: Drift, force?: boolean): string | null {
  const S = D(game);
  const m = d.mini;
  const s = m ? game.sessionByAccount(m.acc) : undefined;
  delete d.mini;
  if (!m || !s?.ship || !s.profile) {
    delete d.taken;
    return null;
  }
  const hits = m.taps.filter(Boolean).length, misses = m.taps.length - hits;
  const p = Math.max(0.03, Math.min(0.97, m.chance + hits * MINI_HIT - misses * MINI_MISS));
  const ok = force ?? S.rng.chance(p);
  S.list.delete(d.id);
  const ship = s.ship;
  const def = DRIFTS[d.kind];
  if (!ok) {
    ship.morale = Math.max(0, ship.morale - 3);
    game.toastShip(ship, failLine(d.kind), 'bad');
    if (def.legend) legendGone(game, d, false);
    sendDriftCard(game, s, true);
    sendDrifts(game, s, true);
    return null;
  }
  const w = driftWorth(d.kind, d.level);
  game.grantXp(s, w.xp, `Saved the ${driftName(d.kind)}`, false);
  driftOf(s.profile).saved++;
  let joined = 0, home = 0;
  if (serves(s, d)) {
    joined = joinCreatures(game, s, def.u, d.n);
    if (joined < d.n) home = sendToPen(game, s, def.u, d.n - joined);
  }
  if (joined + home <= 0) {
    const g = driftGift(d.kind, d.level);
    const k = giveGoods(ship, g.good, g.n);
    const silver = g.silver + (g.n - k) * GOODS[g.good].basePrice;
    s.profile.gold += silver;
    game.db.ledger(s.accountId, 'drift', silver, d.kind);
    game.toastShip(ship, k > 0 ? `Saved: the ${driftName(d.kind)} give you what they have — ${k} ${GOODS[g.good].name.toLowerCase()} and ${silver} silver.` : `Saved: the ${driftName(d.kind)} give you what they have — ${silver} silver.`, 'gold');
  } else if (home > 0) game.toastShip(ship, `Saved: ${joined} ${beasts(def.u)} join your army; ${home} more go home to the pen of your island.`, 'good');
  else game.toastShip(ship, `Saved: ${joined} ${beasts(def.u)} join your army.`, 'good');
  if (def.legend) legendHad(game, s, d, 'save');
  sendDriftCard(game, s, true);
  sendDrifts(game, s, true);
  sendTame(game, s);
  game.pushSelf(s, true);
  return null;
}

function failLine(k: DriftKind): string {
  switch (k) {
    case 'serpent_wreck': return 'The serpent thrashes free of the wreckage and sounds, bleeding. It is gone.';
    case 'seal_floe': return 'The floe breaks up under the boats and the seals go down with it.';
    case 'drowned_boat': return 'The drowned turn their faces away and row off into the haze.';
    case 'mermaid_net': return 'The sharks are quicker: the net goes under, and the song stops.';
    case 'turtle_weed': return 'The weed closes over the turtles before the boats are through.';
    case 'gull_mast': return 'The gulls rise screaming and scatter over the sea.';
    case 'tentacle_chain': return 'The chain parts and the arms go down into the dark.';
    case 'white_whale': return 'The white whale sounds, the old line trailing; the sea is empty where it was.';
    case 'young_kraken': return 'The young kraken lets go of the rigging and sinks back to the deep.';
  }
}

// ------------------------------------------------------------------------------------------------ the fight

/** Her party's might against the drift's (as lairRatio reckons it). */
function ratioOf(game: Game, s: PlayerSession, d: Drift): number {
  const ship = s.ship!;
  const party = landParty(sideOf(game, ship, ship, true).army ?? []);
  const mine = armyPower(party) * (0.5 + ship.morale / 100) * (ladder(ship.shipLevel, d.level, false).dealt || 0.1);
  const theirs = armyPower([{ u: DRIFTS[d.kind].u, n: d.n }]) * 1.2 * (ladder(d.level, ship.shipLevel, false).dealt || 0.1);
  return mine / Math.max(1, theirs);
}

/** She fights them: the battle laid over the wreckage, the floe, the weed — her boarders against the creatures. */
export function fightDrift(game: Game, s: PlayerSession, id: number, force = false): string | null {
  const d = D(game).list.get(id);
  if (!d) return 'They are gone';
  const why = busyWhy(game, s, d);
  if (why && !(force && why !== 'Another captain is at it already.')) return why;
  if (d.mini) return 'Not now';
  const def = DRIFTS[d.kind];
  const men: ArmyStack[] = [{ u: def.u, n: d.n }];
  const ratio = ratioOf(game, s, d);
  d.taken = s.accountId;
  d.until = Math.max(d.until, game.now + 60);
  const e = startCreatureFight(game, s, {
    type: def.field, kind: d.kind, place: driftName(d.kind), level: d.level,
    onEnd: (g, ss, won, bt) => fightEnd(g, ss, d, won, bt, ratio),
  }, driftName(d.kind), men, UNITS[def.u].art, d.level);
  if (e) {
    delete d.taken;
    return e;
  }
  game.toastShip(s.ship!, `Boats away against the ${driftName(d.kind)}.`, 'info');
  sendDriftCard(game, s, true);
  return null;
}

function fightEnd(game: Game, s: PlayerSession, d: Drift, won: boolean, bt: TacBattle, ratio: number): LairLoot | undefined {
  const S = D(game);
  const ship = s.ship!;
  delete d.taken;
  if (!won) {
    // What is left of them stays adrift.
    const left = bt.stacks.filter((x) => x.side === 1 && x.count > 0).reduce((a, x) => a + x.count, 0);
    if (left > 0) d.n = left;
    game.toastShip(ship, `The ${driftName(d.kind)} throw your boats back.`, 'bad');
    return undefined;
  }
  S.list.delete(d.id);
  const pay = driftFightPay(d.kind, d.level);
  s.profile!.gold += pay.silver;
  game.db.ledger(s.accountId, 'drift', pay.silver, `fight:${d.kind}`);
  game.grantXp(s, pay.xp, `Beat the ${driftName(d.kind)}`, true);
  driftOf(s.profile!).beaten++;
  const legend = !!DRIFTS[d.kind].legend;
  game.toastShip(ship, `The ${driftName(d.kind)} are beaten: ${pay.silver} silver.`, 'gold');
  if (legend) legendHad(game, s, d, 'beat');
  const capture = legend ? undefined : captureOffer(game, s, lossesOf(bt, 1), ratio, 'yes');
  sendDrifts(game, s, true);
  return { silver: 0, xp: 0, goods: [], res: {}, drift: { silver: pay.silver, xp: pay.xp, ...(legend ? { legend: true } : {}) }, ...(capture ? { capture } : {}) };
}

// ------------------------------------------------------------------------------------------------ 40. the legend

/** The season's legend: its kind (the white whale and the young kraken by turns), when it rises (an hour or so into
 *  the season's play, then again after it sinks unclaimed), told to every captain at sea; had once, it is done. */
function stepLegend(game: Game): void {
  const S = D(game);
  const season = seasonId(game);
  if (!S.legend || S.legend.season !== season) {
    S.legend = { season, kind: LEGEND_KINDS[season % LEGEND_KINDS.length], rise: game.now + 1800 + (hashString(`legend:${season}`) % 5400) };
    saveLegend(game);
  }
  const L = S.legend;
  if (L.done || L.id !== undefined || game.now < L.rise) return;
  if (![...game.sessions].some((s) => s.ship && !s.ship.docked && s.profile)) return;
  // A point of open water in the deep squares (⚓7 and up), away from the ports.
  for (let k = 0; k < 300; k++) {
    const x = S.rng.range(4000, WORLD_SIZE - 4000), y = S.rng.range(4000, WORLD_SIZE - 4000);
    if (sectorAt(game.world, x, y).level < 7 || regionAt(game.world, x, y) === 'the_abyss' || !openWater(game, x, y)) continue;
    raiseLegend(game, L.kind, x, y);
    return;
  }
  L.rise = game.now + 600;
}

function raiseLegend(game: Game, kind: DriftKind, x: number, y: number): Drift {
  const S = D(game);
  const d = putDrift(game, kind, x, y, -1);
  if (S.legend) {
    S.legend.id = d.id;
    S.legend.kind = kind;
    saveLegend(game);
  }
  const where = REGIONS[regionAt(game.world, x, y)].name;
  chronicle(game, `${driftName(kind)} has risen in ${where}.`);
  for (const o of game.sessions) if (o.profile) game.sendTo(o, { t: 'toast', msg: `WORLD: ${driftName(kind)} has risen in ${where}. One captain may save it or take it.`, kind: 'gold' });
  return d;
}

/** The legend went down unclaimed (its time out, or a rescue failed): it rises again later in the season. */
function legendGone(game: Game, d: Drift, _had: boolean): void {
  const L = D(game).legend;
  if (!L || L.id !== d.id) return;
  delete L.id;
  L.rise = game.now + 4 * 3600;
  saveLegend(game);
}

/** The legend had by a captain (saved or beaten): the chronicle's line, every captain at sea told; done for the season. */
function legendHad(game: Game, s: PlayerSession, d: Drift, how: 'save' | 'beat'): void {
  const S = D(game);
  if (S.legend) {
    S.legend.done = { by: s.name, how };
    delete S.legend.id;
    saveLegend(game);
  }
  driftOf(s.profile!).legends.push(`${S.legend?.season ?? 0}:${d.kind}:${how}`);
  const line = how === 'save' ? `${s.name} has saved ${driftName(d.kind)}.` : `${s.name} has slain ${driftName(d.kind)}.`;
  chronicle(game, line);
  for (const o of game.sessions) if (o.profile) game.sendTo(o, { t: 'toast', msg: `WORLD: ${line}`, kind: 'gold' });
}

export function legendState(game: Game): LegendState | null {
  return D(game).legend;
}

// ------------------------------------------------------------------------------------------------ the wire

export function driftMessage(game: Game, s: PlayerSession, msg: DriftClientMsg): void {
  if (!s.profile || !s.ship) return;
  const err = (e: string | null) => {
    if (e) game.sendTo(s, { t: 'toast', msg: e, kind: 'bad' });
  };
  const after = () => {
    sendTame(game, s);
    game.pushSelf(s, true);
  };
  switch (msg.action) {
    case 'way':
      return err(startRescue(game, s, Math.trunc(Number(msg.id)), msg.way));
    case 'tap':
      return err(tapRescue(game, s, Math.trunc(Number(msg.id)), msg.at));
    case 'roll': {
      const d = D(game).list.get(Math.trunc(Number(msg.id)));
      if (!d?.mini || d.mini.acc !== s.accountId) return err('Nothing to do');
      return err(resolveMini(game, d));
    }
    case 'fight':
      return err(fightDrift(game, s, Math.trunc(Number(msg.id))));
    case 'cancel':
      return sendDriftCard(game, s, true);
    case 'capture':
      err(fightCapture(game, s, msg.choice === 'take' || msg.choice === 'pen' ? msg.choice : 'free'));
      return after();
    case 'tame':
      return sendTame(game, s);
    case 'release':
      err(release(game, s, msg.u, msg.n));
      return after();
    case 'topen':
      err(toPen(game, s, msg.u, msg.n));
      return after();
    case 'frompen':
      err(fromPen(game, s, msg.u, msg.n));
      return after();
    case 'sell':
      err(tamerSell(game, s, msg.u, msg.n));
      if (s.ship.docked) game.pushPort(s);
      return after();
    case 'buy':
      err(tamerBuy(game, s, msg.u, msg.n));
      if (s.ship.docked) game.pushPort(s);
      return after();
  }
}

// ------------------------------------------------------------------------------------------------ the tester's console

/** `/drift [kind|legend] [go|save|fail|fight|clear]`: a drift of a kind off her bow, within the boats' reach (any kind
 *  of her waters without one); the nearest saved or lost at once (its mini-game skipped), or fought; every drift gone
 *  and the season's legend made new. Without arguments: what drifts and where. */
export function adminDrift(game: Game, s: PlayerSession, args: string[]): string {
  const S = D(game);
  const ship = s.ship!;
  let kind = args.find((a) => isDriftKind(a)) as DriftKind | undefined;
  if (args.includes('whale')) kind = 'white_whale';
  if (args.includes('kraken')) kind = 'young_kraken';
  if (args.includes('legend') && !kind) kind = S.legend?.kind ?? 'white_whale';
  const order = args.find((a) => ['go', 'save', 'fail', 'fight', 'clear', 'info'].includes(a)) ?? (kind ? 'go' : 'info');
  if (order === 'clear') {
    S.list.clear();
    S.legend = null;
    saveLegend(game);
    sendDrifts(game, s, true);
    sendDriftCard(game, s, true);
    return 'Every drift is gone; the season’s legend is new again.';
  }
  if (order === 'go') {
    if (ship.docked) game.undock(s);
    const k = kind ?? (driftKindsFor(sectorAt(game.world, ship.state.x, ship.state.y).level, regionAt(game.world, ship.state.x, ship.state.y))[0]?.[0] ?? 'gull_mast');
    // Open water off her bow, near enough for the boats.
    let at: [number, number] | null = null;
    for (let t = 0; t < 24 && !at; t++) {
      const v = headingVec(ship.state.heading + (t % 2 ? 1 : -1) * Math.floor(t / 2) * 0.5);
      const x = ship.state.x + v.x * 160, y = ship.state.y + v.y * 160;
      if (openWater(game, x, y) || (!isLand(game.world, x, y) && game.inZone(x, y))) at = [x, y];
    }
    if (!at) {
      parkNear(game, s, ship.state.x, ship.state.y, 1);
      at = [ship.state.x + 200, ship.state.y];
    }
    const d = DRIFTS[k].legend ? raiseLegend(game, k, at[0], at[1]) : putDrift(game, k, at[0], at[1], s.accountId);
    if (S.legend && DRIFTS[k].legend) {
      delete S.legend.done;
      S.legend.id = d.id;
      saveLegend(game);
    }
    ship.state.speed = 0;
    ship.input = { rudder: 0, sailTarget: 0 };
    sendDrifts(game, s, true);
    sendDriftCard(game, s, true);
    game.pushSelf(s, true);
    return `${driftName(k)} adrift off your bow (⚓${d.level}, ${d.n} ${beasts(DRIFTS[k].u)}).`;
  }
  const d = nearest(game, s, 50_000);
  if (!d) return `No drifts at sea. Kinds: ${DRIFT_KINDS.join(', ')}.`;
  if (order === 'save' || order === 'fail') {
    if (!d.mini) {
      const why = busyWhy(game, s, d);
      if (why && why !== 'Heave to first — the boats cannot be lowered at speed') return why;
      d.mini = { acc: s.accountId, way: DRIFTS[d.kind].ways[0], t0: game.now, phase: 0, taps: [], chance: 1, ends: game.now + 25 };
      d.taken = s.accountId;
    }
    resolveMini(game, d, order === 'save');
    return order === 'save' ? `The ${driftName(d.kind)} are saved.` : `The ${driftName(d.kind)} are lost to the sea.`;
  }
  if (order === 'fight') return fightDrift(game, s, d.id, true) ?? `Boats away against the ${driftName(d.kind)} (⚓${d.level}, ${d.n}).`;
  const L = S.legend;
  const legend = L ? (L.done ? `had by ${L.done.by}` : L.id !== undefined ? 'on the water' : `rises in ${Math.max(0, Math.round((L.rise - game.now) / 60))} min`) : 'none yet';
  return `Drifts at sea: ${S.list.size}. Nearest: the ${driftName(d.kind)} (⚓${d.level}, ${d.n} ${beasts(DRIFTS[d.kind].u)}), ${Math.round(dist(d.x, d.y, ship.state.x, ship.state.y))} m away, ${Math.round(d.until - game.now)} s left. Legend of the season (${driftName(L?.kind ?? 'white_whale')}): ${legend}.`;
}


/** docs/18 #49: the First Watch's drift — an easy one of her waters (gulls on a mast, seals on a floe), a few cable
 *  lengths off her bow, hers alone; null when one of hers is on the water already. */
export function tutorialDrift(game: Game, s: PlayerSession): Drift | null {
  const S = D(game);
  const ship = s.ship;
  if (!ship || ship.docked) return null;
  if ([...S.list.values()].some((d) => d.owner === s.accountId && !DRIFTS[d.kind].legend)) return null;
  const level = sectorAt(game.world, ship.state.x, ship.state.y).level;
  const kind: DriftKind = level <= 4 ? 'gull_mast' : 'turtle_weed';
  for (let t = 0; t < 24; t++) {
    const v = headingVec(ship.state.heading + (t % 2 ? 1 : -1) * Math.floor(t / 2) * 0.4);
    const far = 420 - (t % 4) * 60;
    const x = ship.state.x + v.x * far, y = ship.state.y + v.y * far;
    if (!openWater(game, x, y) && !(!isLand(game.world, x, y) && game.inZone(x, y))) continue;
    const d = putDrift(game, kind, x, y, s.accountId, 900);
    sendDrifts(game, s, true);
    return d;
  }
  return null;
}

/** The drifts within `R` of her ship (the tests'). */
export function driftsNear(game: Game, s: PlayerSession, R: number): Drift[] {
  const ship = s.ship!;
  return [...D(game).list.values()].filter((d) => dist(d.x, d.y, ship.state.x, ship.state.y) <= R);
}

/** The lookout's look for one captain at once (the tests'). */
export const sightNow = (game: Game, s: PlayerSession): Drift | null => sight(game, s);

/** A sea mark's ice floe with seals hauled out on it (the dense sea's marks): a drift of hers at the floe, when its
 *  waters know seals on a floe and none of hers is on the water already (null otherwise). */
export function sealsOnFloe(game: Game, s: PlayerSession, x: number, y: number): Drift | null {
  const S = D(game);
  if (quiet(game) || [...S.list.values()].some((d) => d.owner === s.accountId && !DRIFTS[d.kind].legend)) return null;
  const level = sectorAt(game.world, x, y).level;
  if (!driftKindsFor(level, regionAt(game.world, x, y)).some(([k]) => k === 'seal_floe')) return null;
  const d = putDrift(game, 'seal_floe', x, y, s.accountId);
  sendDrifts(game, s, true);
  sendDriftCard(game, s, true);
  return d;
}
