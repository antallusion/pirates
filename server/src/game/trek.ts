// The walk across an island (docs/16 #21, 2026-09-30): a landing party at an island's haunt meets what waits there
// (the haunt's own game), then walks on — three or four steps in all, a choice of path at each ("toward the ruins /
// along the stream / up the hill") and something on each path: a find, a risk, a choice, the view from a hilltop, now
// and then another of the island games — and at the far side a cache, richer for every risk taken and survived. One
// short card; the server rolls every chance on its own generator (the shared game.rng is left to the sea).

import { MINI_LIFE_SEC } from './minigames.ts';
import { openMinigame, startMinigame } from './minigames.ts';
import type { MiniLive } from './minigames.ts';
import { giveGoods, giveHands, loseHands, purse } from './director.ts';
import { mapChance } from './explorefx.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import type { PlayerSession } from './player.ts';
import { questEvent } from './quests.ts';
import { makeItem } from '../../../shared/src/data/items.ts';
import { islandHaunt } from '../../../shared/src/data/minigames.ts';
import { TREK_END, TREK_END_ITEM, TREK_END_ITEM_PER_NERVE, TREK_END_MAP, TREK_EVENTS, TREK_EVENT_IDS, TREK_NERVE_SILVER, TREK_PATHS } from '../../../shared/src/data/isles.ts';
import type { TrekOutcome, TrekPath } from '../../../shared/src/data/isles.ts';
import type { TrekVars, TrekView } from '../../../shared/src/protocol.ts';
import { dist } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';

/** A walk left alone this long lapses (the party comes back with what it found). */
export const TREK_LIFE_SEC = 300;
/** The walk's length: four steps on an island this wide or wider, three on a smaller one. */
export const TREK_WIDE = 350;
/** The party hurries back when the ship is this far from the island's shore. */
const TREK_LEASH = 2500;

interface TrekLive {
  id: number;
  account: number;
  islandId: number;
  steps: number;
  step: number;
  paths: TrekPath[] | null;
  event: string | null;
  choice: boolean;
  outcome: string | null;
  vars: TrekVars;
  trail: TrekView['trail'];
  /** The island game open at this step, if any. */
  game: number | null;
  /** The haunt's game was played (it counted as the landing); the game open was met on a path, not at the landing. */
  played: boolean;
  pathGame: boolean;
  nerve: number;
  share: number;
  until: number;
  end: TrekVars | null;
  done: boolean;
}

interface TrekState {
  live: Map<number, TrekLive>;
  seq: number;
  rng: Rng;
}

const states = new WeakMap<Game, TrekState>();
function st(game: Game): TrekState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { live: new Map(), seq: 1, rng: new Rng(0x7e4c1a05) }));
  return s;
}

/** Her walk, if she is on one (not yet closed). */
export function openTrek(game: Game, s: PlayerSession): TrekLive | null {
  return st(game).live.get(s.accountId) ?? null;
}

/** She is out on a walk still (one left alone past its time is as good as over). */
export function trekBusy(game: Game, s: PlayerSession): boolean {
  const t = openTrek(game, s);
  return !!t && !t.done && game.now <= t.until;
}

function view(game: Game, s: PlayerSession, t: TrekLive): TrekView {
  return {
    id: t.id, island: game.world.islands[t.islandId]?.name ?? '?', step: t.step, steps: t.steps, paths: t.paths, event: t.event, choice: t.choice, outcome: t.outcome,
    vars: t.vars, trail: t.trail, game: t.game !== null, end: t.end, done: t.done, cost: s.profile?.gold ?? 0,
  };
}

function send(game: Game, s: PlayerSession, t: TrekLive | null): void {
  game.sendTo(s, { t: 'trek', view: t ? view(game, s, t) : null });
}

/** Two or three ways on, never the one just walked. */
function offerPaths(game: Game, t: TrekLive, is: Island): TrekPath[] {
  const rng = st(game).rng;
  const last = t.trail.length ? t.trail[t.trail.length - 1].path : null;
  const pool = TREK_PATHS.filter((p) => p !== last);
  const out: TrekPath[] = [];
  const n = is.radius >= TREK_WIDE ? 3 : 2;
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng.float() * pool.length), 1)[0]);
  return out;
}

/** A landing party at an island's haunt: the haunt's game first (if one fits her), then the walk. */
export function startTrek(game: Game, s: PlayerSession, is: Island, share: number): TrekLive | null {
  if (!s.ship || !s.profile) return null;
  const S = st(game);
  const t: TrekLive = {
    id: S.seq++, account: s.accountId, islandId: is.id, steps: is.radius >= TREK_WIDE ? 4 : 3, step: 0, paths: null, event: null, choice: false, outcome: null,
    vars: {}, trail: [], game: null, played: false, pathGame: false, nerve: 0, share, until: game.now + TREK_LIFE_SEC, end: null, done: false,
  };
  S.live.set(s.accountId, t);
  const mini = startMinigame(game, s, { haunt: islandHaunt(is.id), islandId: is.id, scene: true, share });
  if (mini) {
    t.game = mini.id;
    t.until = game.now + MINI_LIFE_SEC + TREK_LIFE_SEC;
  } else t.paths = offerPaths(game, t, is);
  send(game, s, t);
  return t;
}

/** A game of the walk is settled: the step is done, the walk goes on. Called by the mini-games' engine. */
export function trekAfterGame(game: Game, s: PlayerSession, mini: MiniLive, outcome: string): void {
  const t = openTrek(game, s);
  if (!t || t.game !== mini.id) return;
  t.game = null;
  if (!t.pathGame && outcome !== 'walk') t.played = true;
  t.step++;
  t.event = 'haunt';
  t.choice = false;
  t.outcome = 'met';
  t.vars = {};
  const won = !!mini.result?.win && outcome !== 'walk';
  const last = t.trail[t.trail.length - 1];
  // Met on a path (already on the trail), or at the landing place itself.
  if (t.pathGame && last) last.good = won;
  else t.trail.push({ path: 'landing', event: 'haunt', good: won });
  t.pathGame = false;
  t.until = game.now + TREK_LIFE_SEC;
  next(game, s, t);
}

/** Her step: a path, a choice, 'back' (to the boats with what the party has), 'close' (the card, at the end). */
export function playTrek(game: Game, s: PlayerSession, pick: string): string | null {
  const t = openTrek(game, s);
  if (!t || !s.ship || !s.profile) {
    send(game, s, null);
    return pick === 'close' ? null : 'The party is back aboard';
  }
  const is = game.world.islands[t.islandId];
  if (pick === 'close') {
    if (!t.done && t.game === null) finish(game, s, t, false);
    st(game).live.delete(s.accountId);
    send(game, s, null);
    return null;
  }
  if (t.done) return null;
  if (t.game !== null) return 'Not now';
  if (pick === 'back') {
    finish(game, s, t, false);
    send(game, s, t);
    return null;
  }
  const rng = st(game).rng;
  t.until = game.now + TREK_LIFE_SEC;
  if (t.choice) {
    const ev = TREK_EVENTS[t.event!];
    const ch = ev.choices?.find((c) => c.id === pick);
    if (!ch) return 'No such choice';
    const key = ch.to ?? (rng.chance(ch.chance ?? 0.5) ? ch.win! : ch.lose!);
    const o = ev.outcomes[key];
    if (o.pay.cost && s.profile.gold < purse(s, o.pay.cost)) return 'Not enough silver';
    t.choice = false;
    resolve(game, s, t, ev.id, key, o);
    next(game, s, t);
    return null;
  }
  const path = pick as TrekPath;
  if (!t.paths?.includes(path)) return 'No such path';
  // What lies that way: the path's own things, weighted; another island game at most once a walk.
  const fit = TREK_EVENT_IDS.filter((id) => TREK_EVENTS[id].paths.includes(path) && !(TREK_EVENTS[id].kind === 'game' && (t.played || t.trail.some((x) => x.event === 'haunt'))));
  const id = rng.weighted(fit.map((e) => [e, TREK_EVENTS[e].weight] as [string, number]));
  const ev = TREK_EVENTS[id];
  t.paths = null;
  t.event = id;
  t.outcome = null;
  t.vars = {};
  if (ev.kind === 'game') {
    const mini = startMinigame(game, s, { haunt: islandHaunt(is.id), islandId: is.id, share: t.share });
    if (mini) {
      t.game = mini.id;
      t.pathGame = true;
      t.trail.push({ path, event: 'haunt', good: true });
      t.until = game.now + MINI_LIFE_SEC + TREK_LIFE_SEC;
      send(game, s, t);
      return null;
    }
    // Nothing waits after all: an old purse under the stones instead.
    t.event = 'coins';
    resolve(game, s, t, 'coins', 'found', TREK_EVENTS.coins.outcomes.found, path);
    next(game, s, t);
    return null;
  }
  if (ev.kind === 'choice') {
    t.choice = true;
    t.trail.push({ path, event: id, good: true });
    send(game, s, t);
    return null;
  }
  const key = ev.kind === 'risk' ? (rng.chance(ev.chance ?? 0.5) ? 'ok' : 'hurt') : Object.keys(ev.outcomes)[0];
  resolve(game, s, t, id, key, ev.outcomes[key], path);
  next(game, s, t);
  return null;
}

/** An outcome paid, noted on the card and on the trail. */
function resolve(game: Game, s: PlayerSession, t: TrekLive, event: string, key: string, o: TrekOutcome, path?: TrekPath): void {
  t.outcome = key;
  t.vars = pay(game, s, t, o);
  if (o.pay.nerve) t.nerve++;
  if (path) t.trail.push({ path, event, good: o.good });
  else if (t.trail.length) t.trail[t.trail.length - 1].good = o.good;
  t.step++;
}

function pay(game: Game, s: PlayerSession, t: TrekLive, o: TrekOutcome): TrekVars {
  const ship = s.ship!, p = s.profile!;
  const rng = st(game).rng;
  const P = o.pay;
  const v: TrekVars = {};
  if (P.cost) {
    const n = Math.min(p.gold, purse(s, P.cost));
    p.gold -= n;
    if (n) game.db.ledger(s.accountId, 'trek', -n, t.event ?? '');
    v.cost = n;
  }
  if (P.silver) {
    const n = Math.round(purse(s, rng.int(P.silver[0], P.silver[1])) * t.share);
    if (n > 0) {
      p.gold += n;
      game.db.ledger(s.accountId, 'trek', n, t.event ?? '');
      v.silver = n;
    }
  }
  if (P.goods) {
    const [g, lo, hi] = P.goods;
    v.n = giveGoods(ship, g, Math.max(1, Math.round(rng.int(lo, hi) * t.share)));
    v.good = g;
  }
  if (P.hands) v.hands = giveHands(s, P.hands);
  if (P.crew) v.crew = loseHands(s, P.crew);
  if (P.morale) ship.morale = Math.max(0, Math.min(100, ship.morale + P.morale));
  if (P.curse) ship.curse = Math.max(0, Math.min(100, ship.curse + P.curse));
  if (P.chart) {
    const is = game.world.islands[t.islandId];
    let n = 0;
    for (const o2 of game.world.islands) {
      if (o2.minor || s.discovered.has(o2.id) || dist(o2.x, o2.y, is.x, is.y) > P.chart) continue;
      game.chartIsland(s, o2);
      n++;
    }
    v.charted = n;
  }
  if (P.map) {
    const before = p.explore.maps.length;
    mapChance(game, s, P.map * t.share, 1, 'Found ashore');
    if (p.explore.maps.length > before) v.map = true;
  }
  if (P.xp) {
    const xp = Math.round(P.xp * t.share * (1 + 0.15 * (ship.shipLevel - 1)));
    if (xp > 0) {
      game.grantXp(s, xp, null);
      v.xp = xp;
    }
  }
  return v;
}

/** On to the next step, or the far side at the last. */
function next(game: Game, s: PlayerSession, t: TrekLive): void {
  if (t.step >= t.steps) finish(game, s, t, true);
  else t.paths = offerPaths(game, t, game.world.islands[t.islandId]);
  game.pushSelf(s, true);
  send(game, s, t);
}

/** The walk ends: at the far side (its cache), or back to the boats early (what was found is kept). */
function finish(game: Game, s: PlayerSession, t: TrekLive, far: boolean): void {
  t.done = true;
  t.until = game.now;
  t.paths = null;
  t.choice = false;
  const rng = st(game).rng;
  if (far && s.ship && s.profile) {
    const [lo, hi] = TREK_END.pay.silver!;
    const silver = Math.round(purse(s, rng.int(lo, hi) + TREK_NERVE_SILVER * t.nerve) * t.share);
    s.profile.gold += silver;
    game.db.ledger(s.accountId, 'trek', silver, 'far side');
    const end: TrekVars = { silver };
    const xp = Math.round((TREK_END.pay.xp ?? 0) * t.share * (1 + 0.15 * (s.ship.shipLevel - 1)));
    game.grantXp(s, xp, null);
    end.xp = xp;
    if (rng.chance(Math.min(0.6, TREK_END_ITEM + TREK_END_ITEM_PER_NERVE * t.nerve) * t.share)) {
      const it = makeItem(rng, 0, { ilvl: s.ship.shipLevel, source: 'common' });
      if (takeItem(game, s, it)) end.item = it;
    }
    const before = s.profile.explore.maps.length;
    mapChance(game, s, TREK_END_MAP * t.share, 1, 'Found ashore');
    if (s.profile.explore.maps.length > before) end.map = true;
    t.end = end;
  }
  // A walk with no game at its haunt still counts as the landing there, for the quests and the day's orders.
  if (!t.played && s.profile) questEvent(game, s, { k: 'land', island: t.islandId, feature: 'scene' });
  game.pushSelf(s, true);
}

/** Every second: a walk left alone lapses, and one whose ship has sailed off or is under fire hurries back. */
export function stepTreks(game: Game): void {
  const S = st(game);
  for (const t of [...S.live.values()]) {
    const s = game.sessionByAccount(t.account);
    if (!s || !s.ship || !s.profile) {
      S.live.delete(t.account);
      continue;
    }
    if (t.done) {
      if (game.now > t.until + 60) S.live.delete(t.account);
      continue;
    }
    // Her game at this step lapsed or was closed without a word: the walk goes on.
    if (t.game !== null && !openMinigame(game, s)) {
      t.game = null;
      t.step++;
      t.paths = t.step >= t.steps ? null : offerPaths(game, t, game.world.islands[t.islandId]);
      if (t.step >= t.steps) finish(game, s, t, true);
      send(game, s, t);
      continue;
    }
    const is = game.world.islands[t.islandId];
    const away = dist(s.ship.state.x, s.ship.state.y, is.x, is.y) - is.radius > TREK_LEASH;
    if (game.now > t.until || away || s.ship.underFire(game.now) || s.ship.docked) {
      if (t.game !== null) continue; // the game has its own clock
      finish(game, s, t, false);
      if (away || s.ship.underFire(game.now)) game.toastShip(s.ship, 'The landing party hurries back to the boats.', 'info');
      send(game, s, t);
    }
  }
}
