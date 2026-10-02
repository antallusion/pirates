// docs/18 III on the server (items 26–32): what the chart is told of each island (her level, her kind, a hidden one's
// mist until she is found), the zones of one level, the danger of a landing above one's level, the hidden islands
// shown by a lookout, a map or an obelisk, the turtle islands, the sandbars of the low tide (isles.ts keeps the banks;
// the sandbars are among them), and the supply routes from a claimed lair island to one's own island, delivered at the
// first dawn of every week of the sea's calendar.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { makeItem } from '../../../shared/src/data/items.ts';
import { WEEK_DAYS, secsToDawn, weekOfDay } from '../../../shared/src/data/week.ts';
import { DAY_LENGTH_SEC } from '../../../shared/src/constants.ts';
import type { IsleClientMsg, SupplyIsle, SupplyView, TurtleView } from '../../../shared/src/isleproto.ts';
import type { IslandData } from '../../../shared/src/protocol.ts';
import { closestOnPolygon, dist, pointInPolygon } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { ISLE_TYPES, ISLE_TYPE_DEFS, SUPPLY_MAX, SUPPLY_RANGE, isleDanger, isleLevel, isleLoot, isleType, isleZones, nearestZone, supplyWeek } from '../../../shared/src/world/archipelago.ts';
import type { IsleType } from '../../../shared/src/world/archipelago.ts';
import { TURTLE_R, turtlePos, turtleRise, turtleTurn, turtleUp, turtles } from '../../../shared/src/world/drift.ts';
import type { TurtleDef } from '../../../shared/src/world/drift.ts';
import { SANDBAR_COUNT, TIDAL_COUNT, tidalIsles } from '../../../shared/src/world/tidal.ts';
import { TIDAL_NAMES } from '../../../shared/src/data/isles.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { capOf, yardOf } from './base.ts';
import { thisWeek, today } from './calendar.ts';
import { giveGoods, loseHands, purse } from './director.ts';
import { ownIsland } from './estate.ts';
import { mapChance } from './explorefx.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import { forceBank, sendIsles } from './isles.ts';
import type { PlayerSession, Profile } from './player.ts';
import { deliver } from './post.ts';
import type { ShipEntity } from './ship.ts';

const KEY = 'h18:supply';

interface Claim {
  kind: SupplyIsle['kind'];
  at: number;
}
interface Route {
  since: number;
  last?: number;
}
interface SupplyStore {
  /** By account: the lair islands claimed, and those linked to her island. */
  claims: Record<string, Record<string, Claim>>;
  routes: Record<string, Record<string, Route>>;
  /** The last week delivered. */
  week: number | null;
}

interface S18 {
  rng: Rng;
  /** The tester's console: turtles held up or down. */
  forced: Map<number, boolean>;
  told: WeakMap<PlayerSession, string>;
  zonesSent: WeakSet<PlayerSession>;
  supplyTold: WeakMap<PlayerSession, string>;
  store: SupplyStore | null;
}

const states = new WeakMap<Game, S18>();
function st(game: Game): S18 {
  let s = states.get(game);
  if (!s) states.set(game, (s = { rng: new Rng(0x18e3a5), forced: new Map(), told: new WeakMap(), zonesSent: new WeakSet(), supplyTold: new WeakMap(), store: null }));
  return s;
}

// ------------------------------------------------------------------------------------------------ 26–27, 30. the chart

/** What the chart is told of an island besides her coast: her level, her kind, what step 6 made her, a found secret. */
export function isleExtras(game: Game, is: Island): Pick<IslandData, 'lv' | 'ty' | 'isle' | 'secret'> {
  return { lv: isleLevel(game.world, is), ty: isleType(is), ...(is.isle ? { isle: is.isle } : {}), ...(is.hidden ? { secret: true } : {}) };
}

const mists = new WeakMap<Island, IslandData>();

/** A hidden island not yet found: a bank of mist where she lies — no name, no coast, only her reach. */
function mistOf(game: Game, is: Island): IslandData {
  let d = mists.get(is);
  if (!d) {
    const poly: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      poly.push(Math.round(is.x + Math.sin(a) * is.radius * 0.9), Math.round(is.y - Math.cos(a) * is.radius * 0.9));
    }
    d = { id: is.id, name: '', region: is.region, biome: is.biome, x: Math.round(is.x), y: Math.round(is.y), r: Math.round(is.radius), poly, features: [], mist: true, lv: isleLevel(game.world, is) };
    mists.set(is, d);
  }
  return d;
}

/** The island as this captain's chart may know her. */
export function islandFor(game: Game, s: PlayerSession, is: Island): IslandData {
  return is.hidden && !s.discovered.has(is.id) ? mistOf(game, is) : game.islandData(is);
}

/** A hidden island has just gone on her chart (a lookout, a watchtower, a map, an obelisk): she is told so. */
export function onHiddenCharted(game: Game, s: PlayerSession, is: Island): void {
  if (!is.hidden || !s.ship) return;
  game.toastShip(s.ship, `A hidden island comes out of the mist on your chart: ${is.name}. What lies ashore there no one has touched.`, 'gold');
}

/** The hidden islands within r of a point that she has not found, nearest first. */
function hiddenNear(game: Game, s: PlayerSession, x: number, y: number, r: number): Island[] {
  return game.world.islands.slice(game.world.isleFrom).filter((is) => is.hidden && !s.discovered.has(is.id) && dist(is.x, is.y, x, y) < r).sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y));
}

/** An obelisk read (docs/17 H4) shows the nearest hidden island within 15 km on its stone. */
export function obeliskReveals(game: Game, s: PlayerSession, x: number, y: number): void {
  const is = hiddenNear(game, s, x, y, 15000)[0];
  if (is) game.chartIsland(s, is);
}

/** A treasure map in her chest: one drawn to a hidden island shows her; one in three of the better maps has a hidden
 *  island of its waters inked in its margin. */
export function mapReveals(game: Game, s: PlayerSession, m: { island?: number; tier: number; sx: number; sy: number }): void {
  const on = m.island !== undefined ? game.world.islands[m.island] : undefined;
  if (on?.hidden && !s.discovered.has(on.id)) return void game.chartIsland(s, on);
  if (m.tier >= 2 && st(game).rng.chance(1 / 3)) {
    const is = hiddenNear(game, s, m.sx, m.sy, 20000)[0];
    if (is) game.chartIsland(s, is);
  }
}

/** What a hidden island's cache pays besides the usual (docs/18 #30: a better find). */
export function hiddenCache(game: Game, s: PlayerSession, island: Island, share: number): { silverMul: number; got: string[] } {
  if (!island.hidden || !s.ship) return { silverMul: 1, got: [] };
  const loot = isleLoot(island);
  const got: string[] = [];
  const n = giveGoods(s.ship, 'pearls', Math.max(1, Math.round(st(game).rng.int(1, 3) * share)));
  if (n > 0) got.push(`${n} ${GOODS.pearls.name}`);
  if (st(game).rng.chance(0.35 * share)) takeItem(game, s, makeItem(st(game).rng, s.profile!.itemSeq++, { ilvl: s.ship.shipLevel + loot.tier, rarity: st(game).rng.chance(0.4) ? 3 : 2 }));
  return { silverMul: loot.mul, got };
}

// ------------------------------------------------------------------------------------------------ 28. the danger

/** The island's level against her ship's, for the land key's prompt. */
export function landDanger(game: Game, s: PlayerSession, is: Island): { lv: number; danger?: 'warn' | 'deadly' } {
  const lv = isleLevel(game.world, is);
  const d = isleDanger(s.ship?.shipLevel ?? 1, lv);
  return d ? { lv, danger: d } : { lv };
}

/** The boats go ashore on an island above her: the ladder's warning, in the log. */
export function warnLanding(game: Game, s: PlayerSession, is: Island): void {
  const ship = s.ship;
  if (!ship) return;
  const lv = isleLevel(game.world, is);
  const d = isleDanger(ship.shipLevel, lv);
  if (d === 'deadly') game.toastShip(ship, `${is.name} is an island of ⚓${lv}, ${lv - ship.shipLevel} levels above your ship: what lives there is beyond your crew.`, 'bad');
  else if (d === 'warn') game.toastShip(ship, `${is.name} is an island of ⚓${lv}, two levels above your ship: what lives there is stronger than your crew.`, 'bad');
}

// ------------------------------------------------------------------------------------------------ 31. the turtle islands

export function turtleUpNow(game: Game, d: TurtleDef): boolean {
  return st(game).forced.get(d.id) ?? turtleUp(d, game.now);
}

/** A turtle island that is up strikes like land (her shell a circle): the ship is put back off it. */
/** The turtle islands up now and where they are, once a tick (every ship's step asks: docs/19 D6). */
const upNow = new WeakMap<Game, { t: number; list: { d: TurtleDef; p: { x: number; y: number } }[] }>();
function turtlesNow(game: Game): { d: TurtleDef; p: { x: number; y: number } }[] {
  const k = upNow.get(game);
  if (k && k.t === game.now) return k.list;
  const list = turtles(game.world).filter((d) => turtleUpNow(game, d)).map((d) => ({ d, p: turtlePos(d, game.now) }));
  upNow.set(game, { t: game.now, list });
  return list;
}

export function turtleCollide(game: Game, ship: ShipEntity, probes: [number, number][]): boolean {
  let hit = false;
  for (const { d, p } of turtlesNow(game)) {
    if (Math.abs(p.x - ship.state.x) > d.r + 120 || Math.abs(p.y - ship.state.y) > d.r + 120) continue;
    for (const [px, py] of probes) {
      const dx = px - p.x, dy = py - p.y, l = Math.hypot(dx, dy);
      if (l >= d.r) continue;
      const k = (d.r - l + 3) / (l || 1);
      ship.state.x += dx * k;
      ship.state.y += dy * k;
      ship.state.speed *= 0.25;
      hit = true;
    }
  }
  return hit;
}

function combed(p: Profile): Record<string, number> {
  return ((p.isle18 ??= { turtles: {} }).turtles ??= {});
}

/** The turtle island up within reach of her boats whose back she has not combed this rise. */
export function turtleHere(game: Game, s: PlayerSession): TurtleDef | null {
  const ship = s.ship;
  if (!ship || ship.docked) return null;
  for (const d of turtles(game.world)) {
    if (!turtleUpNow(game, d)) continue;
    const p = turtlePos(d, game.now);
    if (dist(p.x, p.y, ship.state.x, ship.state.y) > d.r + 260) continue;
    if (combed(s.profile!)[d.id] === turtleRise(d, game.now)) continue;
    return d;
  }
  return null;
}

export function turtleName(d: TurtleDef): string {
  return d.name[0];
}

/** The prompt off a turtle island (the HUD's land key). */
export function turtlePrompt(game: Game, s: PlayerSession): { island: string; feature: string; lv: number; danger?: 'warn' | 'deadly' } | null {
  const d = turtleHere(game, s);
  if (!d) return null;
  const lv = isleLevel(game.world, { x: d.cx, y: d.cy });
  const danger = isleDanger(s.ship!.shipLevel, lv);
  return { island: turtleName(d), feature: 'the back of the great turtle', lv, ...(danger ? { danger } : {}) };
}

/** The landing party back from her shell: rare things once a rise — or, she dives first, a swim back. */
export function combTurtle(game: Game, s: PlayerSession, d: TurtleDef, share: number): void {
  const ship = s.ship!, p = s.profile!;
  const rng = st(game).rng;
  const name = turtleName(d);
  if (!turtleUpNow(game, d)) {
    const lost = loseHands(s, rng.int(1, 2));
    game.toastShip(ship, `${name} sounds under the party's feet: ${lost} drowned, the rest swim back to the boats empty-handed.`, 'bad');
    return;
  }
  combed(p)[d.id] = turtleRise(d, game.now);
  const silver = Math.round(purse(s, rng.int(120, 260)) * share);
  p.gold += silver;
  game.db.ledger(s.accountId, 'turtle', silver, name);
  const goods: GoodId[] = ['pearls', 'provisions', 'whale_oil'];
  const good = goods[rng.int(0, goods.length - 1)];
  const n = giveGoods(ship, good, Math.max(1, Math.round(rng.int(2, 5) * share)));
  if (rng.chance(0.25 * share)) takeItem(game, s, makeItem(rng, p.itemSeq++, { ilvl: ship.shipLevel, rarity: rng.chance(0.3) ? 3 : 2 }));
  mapChance(game, s, 0.2 * share, 2, 'On the turtle’s back');
  game.grantXp(s, Math.round(140 * share * (1 + 0.15 * (ship.shipLevel - 1))), null);
  ship.morale = Math.min(100, ship.morale + 6);
  game.toastShip(ship, n > 0 ? `The party combs the back of ${name} while she basks: ${silver} silver and ${n} ${GOODS[good].name}.` : `The party combs the back of ${name} while she basks: ${silver} silver.`, 'gold');
  sendTurtles(game, s, true);
}

function turtlesView(game: Game, s: PlayerSession): TurtleView[] {
  const C = s.profile?.isle18?.turtles ?? {};
  return turtles(game.world).map((d) => ({
    id: d.id, name: d.id, cx: d.cx, cy: d.cy, rx: d.rx, ry: d.ry, rot: d.rot, lap: d.lap, ph: d.ph, r: d.r, level: isleLevel(game.world, { x: d.cx, y: d.cy }),
    up: turtleUpNow(game, d), turn: Math.round(turtleTurn(d, game.now)), combed: C[d.id] === turtleRise(d, game.now),
  }));
}

export function sendTurtles(game: Game, s: PlayerSession, force: boolean): void {
  const list = turtlesView(game, s);
  const key = JSON.stringify(list.map((t) => [t.up, t.combed]));
  if (!force && st(game).told.get(s) === key) return;
  st(game).told.set(s, key);
  game.sendTo(s, { t: 'turtles', list });
}

// ------------------------------------------------------------------------------------------------ 32. supply routes

function store(game: Game): SupplyStore {
  const S = st(game);
  if (!S.store) {
    const saved = game.db.getKv<SupplyStore>(KEY);
    S.store = { claims: saved?.claims ?? {}, routes: saved?.routes ?? {}, week: saved?.week ?? null };
  }
  return S.store;
}

const saveStore = (game: Game) => game.db.setKv(KEY, store(game));

/** A lair island is hers (a named pirate's lair stormed, or — section II of docs/18 — a lair of the land's creatures
 *  cleared): she may link it to her own island for a weekly delivery. */
export function claimLair(game: Game, account: number, islandId: number, kind: SupplyIsle['kind']): void {
  const is = game.world.islands[islandId];
  if (!is || is.portId) return;
  const c = (store(game).claims[account] ??= {});
  if (c[islandId]) return;
  c[islandId] = { kind, at: game.now };
  saveStore(game);
  const s = game.sessionByAccount(account);
  if (s?.ship) {
    game.toastShip(s.ship, `${is.name} is yours now: link it to your own island for a supply route (My island → Supply).`, 'good');
    sendSupply(game, s, true);
  }
}

function why(game: Game, account: number, is: Island, linked: boolean): string | null {
  if (linked) return null;
  const h = ownIsland(game, account);
  if (!h) return 'You have no island of your own to send it to';
  if (h.island === is.id) return 'This is your own island';
  const home = game.world.islands[h.island];
  if (home && dist(home.x, home.y, is.x, is.y) > SUPPLY_RANGE) return 'Too far from your island for a supply route';
  if (Object.keys(store(game).routes[account] ?? {}).length >= SUPPLY_MAX) return `No more than ${SUPPLY_MAX} supply routes`;
  return null;
}

export function supplyView(game: Game, s: PlayerSession): SupplyView {
  const acc = s.accountId;
  const S = store(game);
  const h = ownIsland(game, acc);
  const home = h ? game.world.islands[h.island] : undefined;
  const routes = S.routes[acc] ?? {};
  const isles: SupplyIsle[] = Object.entries(S.claims[acc] ?? {}).map(([id, c]) => {
    const is = game.world.islands[Number(id)];
    const ty = isleType(is), lv = isleLevel(game.world, is);
    const w = supplyWeek(ty, is.region, lv);
    const r = routes[id];
    return { island: is.id, name: is.name, x: Math.round(is.x), y: Math.round(is.y), type: ty, level: lv, region: is.region, kind: c.kind, good: w.good, n: w.n, linked: !!r, why: why(game, acc, is, !!r), ...(r?.last !== undefined ? { last: r.last + 1 } : {}) };
  });
  const d = today(game);
  const nextIn = Math.round(secsToDawn(game.now) + (WEEK_DAYS - 1 - (d - weekOfDay(d) * WEEK_DAYS)) * DAY_LENGTH_SEC);
  return { home: home ? { island: home.id, name: home.name, x: Math.round(home.x), y: Math.round(home.y) } : null, isles, max: SUPPLY_MAX, nextIn, week: thisWeek(game) + 1 };
}

export function sendSupply(game: Game, s: PlayerSession, force: boolean): void {
  const v = supplyView(game, s);
  const key = JSON.stringify({ ...v, nextIn: 0 });
  if (!force && st(game).supplyTold.get(s) === key) return;
  st(game).supplyTold.set(s, key);
  game.sendTo(s, { t: 'supply', view: v });
}

export function linkRoute(game: Game, s: PlayerSession, islandId: number, on: boolean): string | null {
  const acc = s.accountId;
  const S = store(game);
  if (!S.claims[acc]?.[islandId]) return 'That island is not yours';
  const is = game.world.islands[islandId];
  const routes = (S.routes[acc] ??= {});
  if (!on) {
    delete routes[islandId];
    saveStore(game);
    return null;
  }
  if (routes[islandId]) return null;
  const w = why(game, acc, is, false);
  if (w) return w;
  routes[islandId] = { since: thisWeek(game) };
  saveStore(game);
  if (s.ship) game.toastShip(s.ship, `A supply route runs from ${is.name} to your island: its first delivery comes with the next week.`, 'good');
  return null;
}

/** The first dawn of a week: every route delivers its resource into its captain's island yard. */
export function supplyWeekly(game: Game, week: number, force = false): void {
  const S = store(game);
  if (!force && S.week !== null && week <= S.week) return;
  S.week = week;
  for (const [acc, routes] of Object.entries(S.routes)) {
    const account = Number(acc);
    const h = ownIsland(game, account);
    if (!h) continue;
    let any = false;
    for (const [id, r] of Object.entries(routes)) {
      const is = game.world.islands[Number(id)];
      if (!is || !S.claims[acc]?.[id]) continue;
      const w = supplyWeek(isleType(is), is.region, isleLevel(game.world, is));
      const y = yardOf(game, h);
      const k = Math.min(Math.max(0, capOf(h) - (y.res[w.good] ?? 0)), w.n);
      if (k > 0) {
        y.res[w.good] = (y.res[w.good] ?? 0) + k;
        y.fresh[w.good] = (y.fresh[w.good] ?? 0) + k;
      }
      r.last = week;
      any = true;
      const body = k > 0 ? `The supply boats from ${is.name} are in: ${k} ${GOODS[w.good].name} in your island's yard.` : `The supply boats from ${is.name} are in, but your island's yard is full.`;
      deliver(game, account, { from: 'Your supply routes', subject: 'The week’s supply', body, gold: 0, goods: null });
      const s = game.sessionByAccount(account);
      if (s?.ship) game.toastShip(s.ship, body, k > 0 ? 'good' : 'bad');
    }
    if (any) game.holdings.touch();
  }
  saveStore(game);
}

// ------------------------------------------------------------------------------------------------ the wire

export function isle18Message(game: Game, s: PlayerSession, msg: IsleClientMsg): void {
  const err = (e: string | null) => {
    if (e) game.sendTo(s, { t: 'toast', msg: e, kind: 'bad' });
  };
  if (msg.action === 'link' || msg.action === 'unlink') err(linkRoute(game, s, Math.trunc(Number(msg.island)), msg.action === 'link'));
  sendSupply(game, s, true);
}

/** Every second for each captain: the zones once, the turtles and the routes when they change. */
export function isle18Second(game: Game, s: PlayerSession): void {
  const S = st(game);
  if (!S.zonesSent.has(s)) {
    S.zonesSent.add(s);
    game.sendTo(s, { t: 'zones', list: isleZones(game.world) });
    sendSupply(game, s, true);
  }
  if (Math.floor(game.now) % 2 !== 0) return;
  if (s.ship && !s.ship.docked) sendTurtles(game, s, false);
  sendSupply(game, s, false);
}

// ------------------------------------------------------------------------------------------------ the tester's console

/** Set her down in open water `off` metres off a shore, on the side toward her. */
function parkOff(game: Game, s: PlayerSession, cx: number, cy: number, poly: number[] | null, r: number, off: number): void {
  const ship = s.ship!;
  let ax = ship.state.x - cx, ay = ship.state.y - cy;
  const al = Math.hypot(ax, ay) || 1;
  ax /= al;
  ay /= al;
  let x = cx, y = cy;
  for (let d = 0; d < 8000; d += 10) {
    x = cx + ax * d;
    y = cy + ay * d;
    if (poly ? pointInPolygon(x, y, poly) || isLand(game.world, x, y) : d < r || isLand(game.world, x, y)) continue;
    if ((poly ? Math.sqrt(closestOnPolygon(x, y, poly).d2) : d - r) >= off) break;
  }
  ship.state = { ...ship.state, x, y, heading: Math.atan2(-ay, -ax) + Math.PI / 2, speed: 0, sail: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.region = game.regionAt(x, y);
  game.grid.upsert(ship.id, x, y);
}

const nearest = <T extends { x: number; y: number }>(list: T[], x: number, y: number): T | undefined =>
  list.reduce<T | undefined>((a, b) => (!a || Math.hypot(b.x - x, b.y - y) < Math.hypot(a.x - x, a.y - y) ? b : a), undefined);

/** /isle level|type [kind]|hidden [reveal]|atoll|ridge|danger [deadly], /zone [go], /turtle [go|up|down|off],
 *  /sandbar, /supply [claim|link|week]. */
export function isle18Admin(game: Game, s: PlayerSession, cmd: string, args: string[]): string {
  const ship = s.ship!;
  if (ship.docked) return 'Put to sea first.';
  const x = ship.state.x, y = ship.state.y;
  const land = game.world.islands.filter((is) => !is.portId && !is.raft && !(is.minor && is.isle !== 'ridge'));
  const go = (is: Island, off = 140) => {
    parkOff(game, s, is.x, is.y, is.poly, is.radius, off);
    game.pushSelf(s, true);
  };
  const tell = (is: Island) => `${is.name}: ⚓${isleLevel(game.world, is)} · ${ISLE_TYPE_DEFS[isleType(is)].name[0]} (your ship ⚓${ship.shipLevel}).`;
  switch (cmd) {
    case 'isle': {
      const sub = args[0];
      if (sub === 'level') {
        const is = nearest(land, x, y);
        return is ? tell(is) : 'No island.';
      }
      if (sub === 'type') {
        const t = args[1] as IsleType;
        if (!ISLE_TYPES.includes(t)) return `Kinds: ${ISLE_TYPES.join(', ')}.`;
        const is = nearest(land.filter((i) => !i.minor && !i.hidden && isleType(i) === t && i.radius > 120), x, y);
        if (!is) return 'No island.';
        go(is, 160);
        return tell(is);
      }
      if (sub === 'atoll' || sub === 'ridge' || sub === 'small') {
        const is = nearest(land.filter((i) => i.isle === sub && !i.minor && !i.hidden), x, y);
        if (!is) return 'No island.';
        go(is, 160);
        return tell(is);
      }
      if (sub === 'hidden') {
        const is = nearest(game.world.islands.filter((i) => i.hidden && (args[1] === 'reveal' || !s.discovered.has(i.id))), x, y);
        if (!is) return 'No hidden island.';
        go(is, 220);
        if (args[1] === 'reveal') game.chartIsland(s, is);
        return tell(is);
      }
      if (sub === 'danger') {
        const want = args[1] === 'deadly' ? 3 : 2;
        const is = nearest(land.filter((i) => !i.minor && !i.hidden && i.radius > 150 && isleLevel(game.world, i) - ship.shipLevel >= want), x, y);
        if (!is) return 'No island that far above your ship.';
        go(is, 120);
        return tell(is);
      }
      return 'Usage: /isle level|type kind|atoll|ridge|small|hidden [reveal]|danger [deadly]';
    }
    case 'zone': {
      const z = nearestZone(isleZones(game.world), ship.shipLevel, x, y);
      if (!z) return 'No zone.';
      if (args[0] === 'go') {
        const is = game.world.islands[z.island];
        go(is, 200);
      }
      return `${isleZones(game.world).length} zones; nearest of ⚓${ship.shipLevel}: ${z.name} (⚓${z.level}, ${z.n} islands), ${Math.round(Math.hypot(z.x - x, z.y - y) / 1000)} km.`;
    }
    case 'turtle': {
      const list = turtles(game.world).map((d) => ({ d, ...turtlePos(d, game.now) }));
      const t = nearest(list, x, y);
      if (!t) return 'No turtle.';
      const how = args[0] ?? 'go';
      if (how === 'up' || how === 'down') st(game).forced.set(t.d.id, how === 'up');
      if (how === 'off') st(game).forced.delete(t.d.id);
      if (how === 'go') {
        st(game).forced.set(t.d.id, true);
        delete combed(s.profile!)[t.d.id];
        parkOff(game, s, t.x, t.y, null, TURTLE_R, 150);
        game.pushSelf(s, true);
      }
      sendTurtles(game, s, true);
      const name = turtleName(t.d);
      return how === 'down' ? `${name} dives.` : how === 'off' ? `${name} keeps her own time again.` : how === 'go' ? `Off ${name}: land on her back.` : `${name} is up.`;
    }
    case 'sandbar': {
      const bars = tidalIsles(game.world).slice(TIDAL_COUNT, TIDAL_COUNT + SANDBAR_COUNT);
      const b = nearest(bars, x, y);
      if (!b) return 'No sandbars.';
      forceBank(game, b.id, true);
      if (s.profile!.isles) delete s.profile!.isles.tides[b.id];
      parkOff(game, s, b.x, b.y, b.poly, b.r, 140);
      sendIsles(game, s, true);
      game.pushSelf(s, true);
      return `A sandbar is bared before you: ${TIDAL_NAMES[b.name][0]}.`;
    }
    case 'supply': {
      const sub = args[0] ?? 'claim';
      if (sub === 'week') {
        supplyWeekly(game, thisWeek(game), true);
        sendSupply(game, s, true);
        return 'The week’s supply delivered.';
      }
      const mine = store(game).claims[s.accountId] ?? {};
      const is = nearest(land.filter((i) => !i.minor && !i.hidden && i.id !== ownIsland(game, s.accountId)?.island && !mine[i.id]), x, y);
      if (!is) return 'No island.';
      claimLair(game, s.accountId, is.id, 'admin');
      if (sub === 'link') {
        const e = linkRoute(game, s, is.id, true);
        if (e) return e;
      }
      sendSupply(game, s, true);
      return sub === 'link' ? `${is.name} is yours and linked to your island.` : `${is.name} is yours.`;
    }
  }
  return 'Unknown command.';
}
