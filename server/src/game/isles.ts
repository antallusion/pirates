// Islands and the shore, batch E of docs/16 (2026-09-30):
//  23. Lighthouses guide at night. The Crown's keepers light those in its safe waters; elsewhere a keeper lights his
//      lamp for pay (the land key off his island at dusk), and a captain's own island lighthouse burns while its oil is
//      paid. A lit light shows the shoals and reefs within 3.5 km at night — on the minimap and on the water — and its
//      beam sweeps; a dark one is only a tower.
//  24. Lookouts on the headlands: the lookout crags of the islands' haunts and some big islands' far points. A party
//      that climbs one charts the sea within 5 km: islands, reefs, wrecks and the dense sea's marks.
//  25. Banks the tide raises (shared/src/world/tidal.ts): sand and shell that stand above the sea at low tide or through
//      a season, land to strike while they are up, and rare things on them for a landing party once each rise.
// Also what the captain's chart and HUD are told of all of this (a small 'isles' message every two seconds).

import { isNight, nightFactor } from '../../../shared/src/constants.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { makeItem } from '../../../shared/src/data/items.ts';
import { HAUNT_NAMES, islandHaunt } from '../../../shared/src/data/minigames.ts';
import { KEEPER_BASE, KEEPER_PER_LEVEL, KEEPER_RANGE, LIGHT_PAID_SEC, LIGHT_R, LOOKOUT_R, LOOKOUT_REST, SEASON_NAMES, TIDAL_GOODS, TIDAL_ITEM, TIDAL_MAP, TIDAL_NAMES, TIDAL_SILVER } from '../../../shared/src/data/isles.ts';
import type { IslesView, LightView, LookoutView, TidalView } from '../../../shared/src/protocol.ts';
import { closestOnPolygon, dist, pointInPolygon } from '../../../shared/src/math.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { sectorAt } from '../../../shared/src/world/sectors.ts';
import { tidalIsles, tidalRise, tidalTurn, tidalUp } from '../../../shared/src/world/tidal.ts';
import type { TidalIsle } from '../../../shared/src/world/tidal.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { myCaches } from './chests.ts';
import { giveGoods, loseHands, purse } from './director.ts';
import { islandScene } from './exploration.ts';
import { mapChance } from './explorefx.ts';
import type { Game } from './Game.ts';
import { takeItem } from './gear.ts';
import { lighthouseIslands } from './havens.ts';
import { strength } from './holdings.ts';
import type { PlayerSession, Profile } from './player.ts';
import type { ShipEntity } from './ship.ts';
import { revealAdv } from './advmap.ts';

interface IslesState {
  rng: Rng;
  /** Lighthouses lit for a keeper's pay: island → until (world time). */
  paid: Map<number, number>;
  /** The tester's console: banks held up or down. */
  forced: Map<number, boolean>;
  /** What each captain was last told (to send only a change). */
  told: WeakMap<PlayerSession, string>;
  /** The banks up this tick (cached by the tick's time). */
  upAt: number;
  up: TidalIsle[];
}

const states = new WeakMap<Game, IslesState>();
function st(game: Game): IslesState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { rng: new Rng(0x1515e0e5), paid: new Map(), forced: new Map(), told: new WeakMap(), upAt: -1, up: [] }));
  return s;
}

function islesOf(p: Profile): NonNullable<Profile['isles']> {
  return (p.isles ??= { lookouts: {}, tides: {} });
}

// ------------------------------------------------------------------ 23. lighthouses

/** Whether a lighthouse burns tonight, and whose light it is. */
export function lightOf(game: Game, is: Island, accountId: number | null): { lit: LightView['lit']; until?: number } {
  const h = game.holdings.get(game, is.id);
  if (h && strength(h, 'lighthouse') > 0) return { lit: h.owner.kind === 'player' && h.owner.id === accountId ? 'own' : 'paid' };
  if (!is.features.includes('lighthouse')) return { lit: null };
  if (REGIONS[is.region].safety === 'safe') return { lit: 'crown' };
  const until = st(game).paid.get(is.id) ?? 0;
  return until > game.now ? { lit: 'paid', until } : { lit: null };
}

/** Lighthouses: those of the world, and every island whose holder has built one. */
function lightIslands(game: Game): number[] {
  const ids = new Set(lighthouseIslands(game));
  for (const h of Object.values(game.holdings.map(game))) if (strength(h, 'lighthouse') > 0) ids.add(h.island);
  return [...ids];
}

/** Whether a point lies in the light of a lit lighthouse (at night). */
export function inLight(game: Game, x: number, y: number): boolean {
  for (const id of lightIslands(game)) {
    const is = game.world.islands[id];
    if (dist(is.x, is.y, x, y) < LIGHT_R && lightOf(game, is, null).lit) return true;
  }
  return false;
}

/** The keeper's price here (by the square's ships). */
export function keeperPrice(game: Game, is: Island): number {
  return KEEPER_BASE + KEEPER_PER_LEVEL * sectorAt(game.world, is.x, is.y).level;
}

/** A dark lighthouse whose keeper can hear her boat, at dusk or in the dark. */
export function keeperNear(game: Game, s: PlayerSession): Island | null {
  const ship = s.ship;
  if (!ship || ship.docked || nightFactor(game.now) < 0.55) return null;
  for (const id of lighthouseIslands(game)) {
    const is = game.world.islands[id];
    if (dist(is.x, is.y, ship.state.x, ship.state.y) - is.radius > KEEPER_RANGE) continue;
    if (!lightOf(game, is, s.accountId).lit) return is;
  }
  return null;
}

/** She pays the keeper: the light burns half an hour, for every ship at sea. */
export function payKeeper(game: Game, s: PlayerSession): string | null {
  const is = keeperNear(game, s);
  if (!is) return 'No keeper within hail';
  const p = s.profile!;
  const price = keeperPrice(game, is);
  if (p.gold < price) return 'Not enough silver';
  p.gold -= price;
  game.db.ledger(s.accountId, 'keeper', -price, is.name);
  st(game).paid.set(is.id, game.now + LIGHT_PAID_SEC);
  game.grantXp(s, 20, null);
  game.toastShip(s.ship!, `The keeper of ${is.name} takes ${price} silver and lights the lamp. The shoals within 3.5 km show in its light.`, 'good');
  sendIsles(game, s, true);
  return null;
}

// ------------------------------------------------------------------ 24. lookouts

const lookoutCache = new WeakMap<Game, Map<number, [number, number]>>();

/** The lookouts of the world: every lookout crag of the haunts, and the far point of one big island in six. */
export function lookouts(game: Game): Map<number, [number, number]> {
  let m = lookoutCache.get(game);
  if (m) return m;
  m = new Map();
  for (const is of game.world.islands) {
    if (is.portId || is.minor || is.raft) continue;
    const crag = islandScene(is) === 'crag';
    const h = Math.imul(is.id + 0x51ed, 0x2c1b3c6d) >>> 0;
    if (!crag && !(is.radius >= 300 && (h >>> 7) % 6 === 0)) continue;
    // The headland: the point of her coast farthest from her middle.
    let best = 0, bx = is.x, by = is.y;
    for (let i = 0; i < is.poly.length; i += 2) {
      const d = Math.hypot(is.poly[i] - is.x, is.poly[i + 1] - is.y);
      if (d > best) {
        best = d;
        bx = is.poly[i];
        by = is.poly[i + 1];
      }
    }
    // A little inland from the tip, on the rock.
    m.set(is.id, [Math.round(is.x + (bx - is.x) * 0.9), Math.round(is.y + (by - is.y) * 0.9)]);
  }
  lookoutCache.set(game, m);
  return m;
}

/** Whether she may climb this island's lookout now. */
export function lookoutReady(game: Game, s: PlayerSession, islandId: number): boolean {
  if (!lookouts(game).has(islandId)) return false;
  const at = islesOf(s.profile!).lookouts[islandId];
  return at === undefined || game.now - at >= LOOKOUT_REST;
}

/** The party climbs the lookout: the sea within 5 km goes on her chart. */
export function climbLookout(game: Game, s: PlayerSession, is: Island, share: number): void {
  const ship = s.ship!;
  islesOf(s.profile!).lookouts[is.id] = game.now;
  const r = LOOKOUT_R * (share < 1 ? 0.6 : 1);
  let isl = 0;
  for (const o of game.world.islands) {
    if (o.minor || o.id === is.id || s.discovered.has(o.id) || dist(o.x, o.y, is.x, is.y) > r + o.radius * 0.5) continue;
    game.chartIsland(s, o);
    isl++;
  }
  const { reefs, marks } = sendSea(game, s, is.x, is.y, r);
  revealAdv(game, s, is.x, is.y, r); // the guards and the things on the map in its sight (docs/17 H4)
  const wrecks = marks.filter((m) => m.kind === 'wreck').length;
  game.grantXp(s, Math.round(60 * share), null);
  game.toastShip(ship, `From the lookout on ${is.name} the sea lies open for ${Math.round(r / 1000)} km: ${isl} islands, ${reefs.length} reefs and ${wrecks} wrecks newly on your chart.`, 'good');
  sendIsles(game, s, true);
}

/** The reefs and the marks of the sea about a point, sent to her chart. */
function sendSea(game: Game, s: PlayerSession, x: number, y: number, r: number) {
  const w = game.world;
  const reefs = w.reefs.filter((rf) => dist(rf.x, rf.y, x, y) < r + rf.radius).map((rf) => ({ id: rf.id, x: Math.round(rf.x), y: Math.round(rf.y), r: Math.round(rf.radius), poly: rf.poly.map((v) => Math.round(v)), depth: rf.depth }));
  const marks = w.marks.filter((m) => dist(m.x, m.y, x, y) < r).map((m) => ({ id: m.id, kind: m.kind, x: Math.round(m.x), y: Math.round(m.y), r: Math.round(m.r), rot: Math.round(m.rot * 100) / 100, seed: m.seed }));
  if (reefs.length || marks.length) game.sendTo(s, { t: 'chunk', key: -1, islands: [], reefs, ...(marks.length ? { marks } : {}) });
  return { reefs, marks };
}

/** On her return to sea: the lookouts she climbed chart their waters again on her client. */
export function recallLookouts(game: Game, s: PlayerSession): void {
  const L = s.profile?.isles?.lookouts;
  if (!L) return;
  for (const id of Object.keys(L)) {
    const is = game.world.islands[Number(id)];
    if (is) sendSea(game, s, is.x, is.y, LOOKOUT_R);
  }
}

// ------------------------------------------------------------------ 25. banks the tide raises

/** Whether a bank is up now (the tester may hold it). */
export function bankUp(game: Game, b: TidalIsle): boolean {
  return st(game).forced.get(b.id) ?? tidalUp(b, game.now);
}

/** The banks above the sea this tick. */
export function banksUp(game: Game): TidalIsle[] {
  const S = st(game);
  if (S.upAt !== game.now) {
    S.upAt = game.now;
    S.up = tidalIsles(game.world).filter((b) => bankUp(game, b));
  }
  return S.up;
}

/** The tester's console: hold a bank up or down (or let the tide have it again). */
export function forceBank(game: Game, id: number, up: boolean | null): void {
  if (up === null) st(game).forced.delete(id);
  else st(game).forced.set(id, up);
  st(game).upAt = -1;
}

/** A bank that is up strikes like land: the ship is put back off it (the island code's rule). */
export function bankCollide(game: Game, ship: ShipEntity, probes: [number, number][]): boolean {
  const up = banksUp(game);
  if (!up.length) return false;
  let hit = false;
  for (const b of up) {
    if (Math.abs(b.x - ship.state.x) > b.r + 120 || Math.abs(b.y - ship.state.y) > b.r + 120) continue;
    for (const [px, py] of probes) {
      if (!pointInPolygon(px, py, b.poly)) continue;
      const c = closestOnPolygon(px, py, b.poly);
      const nx = c.x - px, ny = c.y - py, len = Math.hypot(nx, ny) || 1;
      ship.state.x += nx + (nx / len) * 3;
      ship.state.y += ny + (ny / len) * 3;
      ship.state.speed *= 0.25;
      hit = true;
    }
  }
  return hit;
}

/** The nearest bank up within reach of the boats that she has not combed this rise. */
export function bankHere(game: Game, s: PlayerSession): TidalIsle | null {
  const ship = s.ship!;
  const T = islesOf(s.profile!).tides;
  for (const b of banksUp(game)) {
    if (dist(b.x, b.y, ship.state.x, ship.state.y) > b.r + 400) continue;
    if (Math.sqrt(closestOnPolygon(ship.state.x, ship.state.y, b.poly).d2) > 260) continue;
    if (T[b.id] === tidalRise(b, game.now)) continue;
    return b;
  }
  return null;
}

export function bankName(b: TidalIsle): string {
  return TIDAL_NAMES[b.name][0];
}

/** The landing party back from a bank: rare things, once a rise — or, the tide in first, a hurried row back. */
export function combBank(game: Game, s: PlayerSession, b: TidalIsle, share: number): void {
  const ship = s.ship!, p = s.profile!;
  const rng = st(game).rng;
  const name = bankName(b);
  if (!bankUp(game, b)) {
    const lost = loseHands(s, rng.int(1, 2));
    game.toastShip(ship, `The sea comes back over ${name} before the party is done: ${lost} swept away, the rest row back empty-handed.`, 'bad');
    return;
  }
  islesOf(p).tides[b.id] = tidalRise(b, game.now);
  const silver = Math.round(purse(s, rng.int(TIDAL_SILVER[0], TIDAL_SILVER[1])) * share);
  p.gold += silver;
  game.db.ledger(s.accountId, 'bank', silver, name);
  const good = TIDAL_GOODS[rng.int(0, TIDAL_GOODS.length - 1)];
  const n = giveGoods(ship, good, Math.max(1, Math.round(rng.int(1, 3) * share)));
  // Gear and a map say so themselves (the locker's and the map chest's own words).
  if (rng.chance(TIDAL_ITEM * share)) takeItem(game, s, makeItem(rng, 0, { ilvl: ship.shipLevel, rarity: rng.chance(0.3) ? 3 : 2 }));
  mapChance(game, s, TIDAL_MAP * share, 2, 'On the bared bank');
  game.grantXp(s, Math.round(90 * share * (1 + 0.15 * (ship.shipLevel - 1))), null);
  ship.morale = Math.min(100, ship.morale + 4);
  game.toastShip(ship, n > 0 ? `The party combs ${name} while the sea is out: ${silver} silver and ${n} ${GOODS[good].name}.` : `The party combs ${name} while the sea is out: ${silver} silver.`, 'gold');
  sendIsles(game, s, true);
}

// ------------------------------------------------------------------ the captain's view

/** The prompt off a dark lighthouse or a bared bank (the HUD's land key). */
export function islesPrompt(game: Game, s: PlayerSession): { island: string; feature: string; action?: 'keeper' } | null {
  const keeper = keeperNear(game, s);
  if (keeper) return { island: keeper.name, feature: String(keeperPrice(game, keeper)), action: 'keeper' };
  const b = bankHere(game, s);
  if (b) return { island: bankName(b), feature: b.kind === 'season' ? `bank bared in ${SEASON_NAMES[b.season][0]}` : 'bank bared by the ebb' };
  return null;
}

export function islesView(game: Game, s: PlayerSession): IslesView {
  const ship = s.ship!;
  const x = ship.state.x, y = ship.state.y;
  const lights: LightView[] = [];
  for (const id of lightIslands(game)) {
    const is = game.world.islands[id];
    if (dist(is.x, is.y, x, y) > 14000) continue;
    const l = lightOf(game, is, s.accountId);
    lights.push({ island: is.id, name: is.name, x: Math.round(is.x), y: Math.round(is.y), r: LIGHT_R, lit: l.lit, ...(l.until ? { until: Math.round(l.until) } : {}) });
  }
  const L = s.profile?.isles?.lookouts ?? {};
  const looks: LookoutView[] = [];
  for (const [id, [lx, ly]] of lookouts(game)) {
    if (dist(lx, ly, x, y) > 9000 && L[id] === undefined) continue;
    looks.push({ island: id, x: lx, y: ly, ...(L[id] !== undefined ? { at: Math.round(L[id]) } : {}) });
  }
  const T = s.profile?.isles?.tides ?? {};
  const tidal: TidalView[] = tidalIsles(game.world).map((b) => {
    const up = bankUp(game, b);
    const near = dist(b.x, b.y, x, y) < 9000;
    return { id: b.id, name: b.name, kind: b.kind, season: b.season, x: b.x, y: b.y, r: b.r, up, turn: Math.round(tidalTurn(b, game.now)), combed: T[b.id] === tidalRise(b, game.now), ...(near ? { poly: b.poly } : {}) };
  });
  return { lights, lookouts: looks, tidal, caches: myCaches(game, s) };
}

/** Every second (for each captain at sea): the view, when it changed, at most every two seconds. */
export function islesSecond(game: Game, s: PlayerSession): void {
  if (!s.ship || s.ship.docked || Math.floor(game.now) % 2 !== 0) return;
  sendIsles(game, s, false);
}

export function sendIsles(game: Game, s: PlayerSession, force: boolean): void {
  if (!s.ship) return;
  const v = islesView(game, s);
  // The banks' turns tick; they are not a change worth a message on their own.
  const key = JSON.stringify({ ...v, tidal: v.tidal.map((t) => [t.up, t.combed, !!t.poly]) });
  const S = st(game);
  if (!force && S.told.get(s) === key) return;
  S.told.set(s, key);
  game.sendTo(s, { t: 'isles', view: v });
}

/** Whether it is dark enough for the lights to matter (the same line the client draws them by). */
export function lightsMatter(game: Game): boolean {
  return isNight(game.now) || nightFactor(game.now) > 0.6;
}

/** The haunt's name for a lookout crag (the words on the chart). */
export function lookoutName(is: Island): string {
  return islandScene(is) === 'crag' ? HAUNT_NAMES[islandHaunt(is.id)][0] : 'lookout';
}

// ------------------------------------------------------------------ the tester's console

/** Set her down in open water `off` metres off a shore (along the line from its middle toward a point). */
function parkOff(game: Game, s: PlayerSession, cx: number, cy: number, poly: number[], toward: [number, number], off: number): void {
  const ship = s.ship!;
  let ax = toward[0] - cx, ay = toward[1] - cy;
  const al = Math.hypot(ax, ay) || 1;
  ax /= al;
  ay /= al;
  let x = cx, y = cy;
  for (let d = 0; d < 6000; d += 10) {
    x = cx + ax * d;
    y = cy + ay * d;
    if (pointInPolygon(x, y, poly) || isLand(game.world, x, y)) continue;
    if (Math.sqrt(closestOnPolygon(x, y, poly).d2) >= off) break;
  }
  ship.state = { ...ship.state, x, y, heading: Math.atan2(-ay, -ax) + Math.PI / 2, speed: 0, sail: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.region = game.regionAt(x, y);
  game.grid.upsert(ship.id, x, y);
}

/** /tide [up|down|off|here], /light [dark], /lookout, /trek: batch E's things set before her. */
export function islesAdmin(game: Game, s: PlayerSession, cmd: string, args: string[]): string {
  const ship = s.ship!;
  if (ship.docked) return 'Put to sea first.';
  const near = <T extends { x: number; y: number }>(list: T[]): T | undefined => list.reduce<T | undefined>((a, b) => (!a || Math.hypot(b.x - ship.state.x, b.y - ship.state.y) < Math.hypot(a.x - ship.state.x, a.y - ship.state.y) ? b : a), undefined);
  switch (cmd) {
    case 'tide': {
      const b = near(tidalIsles(game.world));
      if (!b) return 'No banks.';
      const how = args[0] ?? 'up';
      forceBank(game, b.id, how === 'off' ? null : how !== 'down');
      if (how !== 'here' && how !== 'off' && how !== 'down') parkOff(game, s, b.x, b.y, b.poly, [ship.state.x, ship.state.y], 140);
      if (s.profile!.isles) delete s.profile!.isles.tides[b.id];
      sendIsles(game, s, true);
      game.pushSelf(s, true);
      return `${bankName(b)}: ${how}.`;
    }
    case 'light': {
      // A keeper's lighthouse with shoals in its reach, and her set down between it and the nearest of them.
      const reefNear = (is: Island) => game.world.reefs.filter((rf) => dist(rf.x, rf.y, is.x, is.y) < LIGHT_R * 0.8).sort((a, b) => dist(a.x, a.y, is.x, is.y) - dist(b.x, b.y, is.x, is.y))[0];
      const list = lighthouseIslands(game).map((id) => game.world.islands[id]).filter((is) => REGIONS[is.region].safety !== 'safe' && reefNear(is));
      const is = near(list);
      if (!is) return 'No lighthouses.';
      if (args[0] === 'dark') st(game).paid.delete(is.id);
      else {
        const rf = reefNear(is)!;
        parkOff(game, s, is.x, is.y, is.poly, [rf.x, rf.y], 600);
      }
      sendIsles(game, s, true);
      game.pushSelf(s, true);
      return `Off the lighthouse of ${is.name}.`;
    }
    case 'lookout': {
      const list = [...lookouts(game)].map(([id, [x, y]]) => ({ id, x, y }));
      const l = near(list);
      if (!l) return 'No lookouts.';
      const is = game.world.islands[l.id];
      if (s.profile!.isles) delete s.profile!.isles.lookouts[l.id];
      parkOff(game, s, is.x, is.y, is.poly, [l.x, l.y], 120);
      game.pushSelf(s, true);
      return `Off the lookout on ${is.name}.`;
    }
    case 'trek': {
      const list = game.world.islands.filter((is) => islandScene(is) && is.radius >= TREK_ADMIN_R && !lookouts(game).has(is.id));
      const is = near(list);
      if (!is) return 'No island.';
      delete s.profile!.explored[`${is.id}:scene`];
      parkOff(game, s, is.x, is.y, is.poly, [ship.state.x, ship.state.y], 110);
      game.pushSelf(s, true);
      return `Off ${is.name}: land for the walk.`;
    }
  }
  return 'Unknown command.';
}
const TREK_ADMIN_R = 350;
