// Treasure maps, Phase 8 (docs/01 §15): shared physical chests (the first to dig takes everything, whatever copy
// they carry), map theft in boarding, copying, forgeries and their appraisal, the Brokers' seal, gifts between
// captains, the noise of digging, guardians and cave-ins, cursed maps and the season's legendary chart in
// fragments whose holders hear each other. The base system (circles, digs, hoards) is in explorefx.ts.

import { bossXp, pointsXp } from '../../../shared/src/data/xpcurve.ts'; // docs/26
import { digPlayerChest } from './chests.ts';
import { isNight } from '../../../shared/src/constants.ts';
import { DEG, dist } from '../../../shared/src/math.ts';
import type { MapView } from '../../../shared/src/protocol.ts';
import { Rng } from '../../../shared/src/rng.ts';
import { tx } from '../../../shared/src/sim/shipstats.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import type { Island, Port } from '../../../shared/src/world/worldgen.ts';
import { MAX_MAPS, chestCount, grantMap, hoard, makeMap, mapCircle } from './explorefx.ts';
import type { TreasureMap } from './explorefx.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { grantDeed } from './progression.ts';
import type { ShipEntity } from './ship.ts';
import { seasonId } from './seasons.ts';
import { grantPlan } from './shipbuilding.ts';

const DAY = 24 * 3600_000;
const HEAR_RANGE = 10_000;
const LEGEND_NAMES = ["The Drowned King's Hoard", "Admiral Drey's Last Pay-Chest", 'The Choir\'s Tithe', 'The Hoard of the Nine Bells'];

export interface LegendChart {
  id: string; // season key
  name: string;
  x: number;
  y: number;
  island: number;
  n: number; // fragments
  issued: number[];
  found: boolean;
  offset: [number, number]; // how the partial chart's circle sits off the spot
}

// ================================================================== the season's legendary chart

/** This season's legendary chart (one on the server), drawn when first asked for. */
export function legend(game: Game): LegendChart {
  const season = seasonId(game);
  const id = `legend:${season}`;
  let lc = game.db.getKv<LegendChart>('legend_chart');
  if (!lc || lc.id !== id) {
    const rng = new Rng((game.world.seed ^ (season * 2654435761)) >>> 0);
    const regions: RegionId[] = ['dead_mans_expanse', 'drowned_crown']; // a race for the whole sea, not only for those past the Wall
    const pool = game.world.islands.filter((i) => !i.portId && regions.includes(i.region) && i.radius > 200);
    const is = pool[rng.int(0, pool.length - 1)];
    const n = is.poly.length / 2;
    const k = rng.int(0, n - 1) * 2;
    const dx = is.poly[k] - is.x, dy = is.poly[k + 1] - is.y, d = Math.hypot(dx, dy) || 1;
    const a = rng.range(0, Math.PI * 2);
    lc = {
      id, name: LEGEND_NAMES[season % LEGEND_NAMES.length], x: is.poly[k] + (dx / d) * 110, y: is.poly[k + 1] + (dy / d) * 110, island: is.id,
      n: rng.int(4, 7), issued: [], found: false, offset: [Math.sin(a) * 0.6, -Math.cos(a) * 0.6],
    };
    game.db.setKv('legend_chart', lc);
  }
  return lc;
}

/** How much of the legendary chart a captain holds (distinct pieces of the current set). */
function piecesHeld(game: Game, s: PlayerSession): number {
  const lc = legend(game);
  return new Set(s.profile!.explore.maps.filter((m) => m.set === lc.id).map((m) => m.piece)).size;
}

/** The legendary circle narrows with every piece: 6 km with one, the very spot with all of them. */
export function legendCircle(game: Game, s: PlayerSession, m: TreasureMap): { x: number; y: number; r: number } | null {
  const lc = legend(game);
  if (m.set !== lc.id || lc.found) return null;
  const k = piecesHeld(game, s);
  if (k >= lc.n) return { x: lc.x, y: lc.y, r: 0 };
  const r = 6000 * (1 - k / lc.n) + 300;
  return { x: lc.x + lc.offset[0] * r, y: lc.y + lc.offset[1] * r, r };
}

/** A piece of the legendary chart turns up (only pieces not yet in anyone's hands). */
export function legendFragment(game: Game, s: PlayerSession, chance: number, source: string): boolean {
  const lc = legend(game);
  if (lc.found || lc.issued.length >= lc.n || !game.rng.chance(Math.min(1, chance * (s.ship?.hasFlag('legend_seeker') ? 2 : 1)))) return false;
  const free = [...Array(lc.n).keys()].filter((i) => !lc.issued.includes(i));
  const piece = free[game.rng.int(0, free.length - 1)];
  const first = lc.issued.length === 0;
  lc.issued.push(piece);
  game.db.setKv('legend_chart', lc);
  const clue = ['a circle of stars', 'a verse in the Drowned tongue', 'the outline of a shore', 'a count of paces', 'a bearing from a bell', 'a tide-table', 'a dead man\'s signature'][piece % 7];
  const m: TreasureMap = {
    id: `m${game.allocId()}`, tier: 3, name: `${lc.name} — piece ${piece + 1} of ${lc.n}`, region: game.world.islands[lc.island].region, sx: lc.x, sy: lc.y, ox: 0, oy: 0,
    legendary: true, kind: 'fragment', hoard: lc.id, set: lc.id, piece, of: lc.n, island: lc.island, clue: `A torn piece bearing ${clue}. Together the pieces give the place.`,
  };
  grantMap(game, s, m, source);
  if (first) {
    const text = `A piece of ${lc.name} has surfaced. Whoever holds the pieces can hear the others at sea.`;
    for (const p of game.world.ports) game.addRumor(p.x, p.y, text);
    for (const o of game.sessions) game.sendTo(o, { t: 'toast', msg: `WORLD: ${text}`, kind: 'gold' });
  }
  return true;
}

/** Holders of the season's pieces hear each other within 10 km (bearings only). */
export function legendEcho(game: Game, s: PlayerSession): number[] {
  const ship = s.ship;
  if (!ship || ship.docked || !s.profile!.explore.maps.some((m) => m.kind === 'fragment')) return [];
  const lc = legend(game);
  if (lc.found || !s.profile!.explore.maps.some((m) => m.set === lc.id)) return [];
  const out: number[] = [];
  for (const o of game.sessions) {
    if (o === s || !o.ship || o.ship.docked || !o.profile?.explore.maps.some((m) => m.set === lc.id)) continue;
    const d = dist(o.ship.state.x, o.ship.state.y, ship.state.x, ship.state.y);
    if (d < HEAR_RANGE) out.push(Math.round(Math.atan2(o.ship.state.x - ship.state.x, -(o.ship.state.y - ship.state.y)) * 100) / 100);
  }
  return out;
}

// ================================================================== digging at the spot

/**
 * The boats dig at the true spot of a map. Returns true when this module settled it: the chest was already taken,
 * the map was a forgery, a cursed hoard, or the legend.
 */
export function digOutcome(game: Game, s: PlayerSession, m: TreasureMap, share: number): boolean {
  const p = s.profile!;
  const ship = s.ship!;
  const spend = () => (p.explore.maps = p.explore.maps.filter((x) => x.id !== m.id));
  // Guardians and cave-ins on the finer hoards.
  if (m.tier >= 2) digDangers(game, ship, m);
  if (m.forged !== undefined) {
    spend();
    game.toastShip(ship, 'Nothing. Fresh sand over an empty pit, and the ink on your map was not old at all — a forgery.', 'bad');
    const forger = m.forged ? game.sessionByAccount(m.forged) : null;
    if (forger && forger !== s) game.sendTo(forger, { t: 'toast', msg: `${s.name} is digging where your forged map sent them (${Math.round(ship.state.x / 1000)} km E, ${Math.round(ship.state.y / 1000)} km S).`, kind: 'info' });
    return true;
  }
  if (m.kind === 'player') return digPlayerChest(game, s, m); // a captain's own chest (docs/12 P10 #7)
  const dug = game.db.getKv<Record<string, number>>('dug_hoards') ?? {};
  const key = m.hoard ?? m.id;
  if (dug[key]) {
    spend();
    game.toastShip(ship, 'A pit, a broken chest, footprints. Someone with a copy of this map got here first.', 'bad');
    return true;
  }
  dug[key] = game.wallNow();
  // Old records go (a year), so the table stays small.
  for (const [k, t] of Object.entries(dug)) if (game.wallNow() - t > 365 * DAY) delete dug[k];
  game.db.setKv('dug_hoards', dug);
  if (m.kind === 'fragment') {
    const lc = legend(game);
    if (m.set !== lc.id || lc.found) return false;
    lc.found = true;
    game.db.setKv('legend_chart', lc);
    p.explore.maps = p.explore.maps.filter((x) => x.set !== lc.id);
    hoard(game, s, 4, share);
    const silver = Math.round(12000 * share);
    p.gold += silver;
    game.db.ledger(s.accountId, 'treasure', silver, lc.name);
    grantPlan(game, s, 'legendary');
    if (!p.trophies.includes(lc.name)) p.trophies.push(lc.name);
    grantDeed(game, s, 'deed_legendary_hoard');
    game.grantXp(s, bossXp(s.profile!.level, 3000), `Found ${lc.name}`);
    const text = `${s.name} has dug up ${lc.name}! The other pieces are only paper now.`;
    for (const port of game.world.ports) game.addRumor(port.x, port.y, text);
    for (const o of game.sessions) {
      game.sendTo(o, { t: 'toast', msg: `WORLD: ${text}`, kind: 'gold' });
      if (o !== s && o.profile) o.profile.explore.maps = o.profile.explore.maps.filter((x) => x.set !== lc.id);
    }
    return true;
  }
  if (m.kind === 'cursed') {
    spend();
    hoard(game, s, 4, share);
    ship.curse = Math.min(100, ship.curse + 25);
    ship.sanity = Math.max(0, ship.sanity - 40);
    game.grantXp(s, pointsXp(s.profile!.level, 700), 'A cursed hoard');
    game.toastShip(ship, 'The chest is full — and cold. The crew will not look at it. (Curse +25, sanity −40: a chapel or Saint Maw can lift it.)', 'bad');
    return true;
  }
  return false;
}

function digDangers(game: Game, ship: ShipEntity, m: TreasureMap): void {
  const rng = game.rng;
  if (rng.chance(0.15)) {
    const lost = Math.max(1, Math.round(ship.crew * 0.05));
    ship.crew = Math.max(1, ship.crew - lost);
    game.toastShip(ship, `The pit caves in: ${lost} men buried with the sand.`, 'bad');
  }
  if (rng.chance(m.kind === 'cursed' ? 0.8 : 0.3)) {
    const a = rng.range(0, Math.PI * 2);
    const g = game.spawnNpcShip('ghost', 'sloop', 'choir', ship.state.x + Math.sin(a) * 400, ship.state.y - Math.cos(a) * 400, a + Math.PI, { ship: 'Guardians of the Hoard', captain: 'the Drowned' });
    g.crew = g.stats.crewMax;
    g.morale = 100;
    g.removeAt = game.now + 600;
    const brain = game.npcs.get(g.id);
    if (brain) {
      brain.active = true;
      brain.target = ship.id;
    }
    game.grid.upsert(g.id, g.state.x, g.state.y);
    game.toastShip(ship, 'The dead who were buried to guard it rise from the surf!', 'bad');
  }
}

/** The noise of digging: gulls by day, a lantern by night, seen by every captain within 2 km. */
export function digNoise(game: Game): void {
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship) continue;
    // A cursed map whispers to its keeper.
    if (s.profile?.explore.maps.some((m) => m.kind === 'cursed') && (ship.talentReady.whisper ?? 0) <= game.now) {
      ship.talentReady.whisper = game.now + 60;
      ship.sanity = Math.max(0, ship.sanity - 0.5);
    }
    if (ship.landing?.feature !== 'dig' || (ship.talentReady.digNoise ?? 0) > game.now) continue;
    ship.talentReady.digNoise = game.now + 10;
    game.emit({ k: 'fx', fx: 'dig', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 40 }, ship.state.x, ship.state.y);
    const night = ship.hasFlag('dark_running') ? null : isNight(game.now);
    for (const o of game.sessions) {
      const os = o.ship;
      if (!os || o === s || os.docked || dist(os.state.x, os.state.y, ship.state.x, ship.state.y) > 2000) continue;
      if ((os.talentReady[`heardDig${ship.id}`] ?? 0) > game.now) continue;
      os.talentReady[`heardDig${ship.id}`] = game.now + 120;
      game.sendTo(o, { t: 'toast', msg: night === null ? 'Boats on a dark shore nearby — someone digs without a light.' : night ? 'A lantern burns on a shore nearby: someone is digging.' : 'Gulls wheel over a shore nearby: someone is digging.', kind: 'info' });
    }
  }
}

// ================================================================== theft, gifts, forgery, appraisal

/** The boarders take the captain's chest: up to two maps, the best first. */
export function stealMaps(game: Game, winner: PlayerSession, loser: PlayerSession): void {
  const from = loser.profile!.explore.maps;
  if (!from.length) return;
  const rank = (m: TreasureMap) => (m.kind === 'fragment' ? 10 : 0) + m.tier;
  const take = [...from].sort((a, b) => rank(b) - rank(a)).slice(0, 2);
  const got: string[] = [];
  for (const m of take) {
    if (m.kind !== 'fragment' && chestCount(winner.profile!.explore.maps) >= MAX_MAPS) continue;
    loser.profile!.explore.maps = loser.profile!.explore.maps.filter((x) => x.id !== m.id);
    winner.profile!.explore.maps.push(m);
    got.push(m.name);
  }
  if (!got.length) return;
  game.sendTo(winner, { t: 'toast', msg: `In the captain's chest: ${got.join('; ')}.`, kind: 'gold' });
  game.sendTo(loser, { t: 'toast', msg: `They took your maps: ${got.join('; ')}.`, kind: 'bad' });
}

/** Maps on the dead: ghosts carry landmark maps, and in the drowned seas cursed ones. */
export function onGhostSunk(game: Game, s: PlayerSession, victim: ShipEntity): void {
  if (victim.npcRole !== 'ghost' || victim.bossOf) return;
  const drowned = victim.region === 'drowned_crown' || victim.region === 'the_abyss';
  if (drowned && game.rng.chance(0.15)) grantMap(game, s, makeMap(game, 3, { kind: 'cursed' }), 'Clutched in a dead hand');
  else if (game.rng.chance(0.2)) grantMap(game, s, makeMap(game, 2 + (drowned ? 1 : 0), { kind: 'landmark' }), 'On the drowned captain');
}

export function mapAction(game: Game, s: PlayerSession, port: Port | null, action: string, id?: string, to?: string): string | null {
  const p = s.profile!;
  const ship = s.ship!;
  const m = id ? p.explore.maps.find((x) => x.id === id) : undefined;
  switch (action) {
    case 'burn':
      if (!m) return 'No such map';
      p.explore.maps = p.explore.maps.filter((x) => x !== m);
      return null;
    case 'give': {
      if (!m) return 'No such map';
      const o = to ? game.sessionByName(to) : undefined;
      if (!o?.ship || !o.profile || o === s) return 'No such captain';
      const together = ship.docked ? o.ship.docked === ship.docked : !o.ship.docked && dist(o.ship.state.x, o.ship.state.y, ship.state.x, ship.state.y) < 300;
      if (!together) return 'Hand it over in the same port, or come within 300 m at sea';
      if (m.kind !== 'fragment' && chestCount(o.profile.explore.maps) >= MAX_MAPS) return `${o.name}'s map chest is full`;
      p.explore.maps = p.explore.maps.filter((x) => x !== m);
      o.profile.explore.maps.push(m);
      game.sendTo(o, { t: 'toast', msg: `${s.name} hands you a map: ${m.name}.`, kind: 'gold' });
      game.pushSelf(o, true);
      return null;
    }
    case 'forge': {
      if (!port) return 'Only in port';
      if (!port.blackMarket) return 'Forgers work only where there is a black market';
      if (ship.rank('smg_forged_papers') < 1 && tx(ship.stats, 'cartography') <= 0) return 'You need a forger\'s hand (Forged Papers) or a cartographer\'s eye';
      if (p.gold < 150) return 'Ink, old vellum and a bribe: 150 silver';
      if (chestCount(p.explore.maps) >= MAX_MAPS) return 'Your map chest is full';
      p.gold -= 150;
      game.db.ledger(s.accountId, 'forgery', -150, port.id);
      const kind = game.rng.chance(0.5) ? 'riddle' : 'circle';
      const fake = makeMap(game, 2, { kind });
      fake.forged = s.accountId;
      p.explore.maps.push(fake);
      game.sendTo(s, { t: 'toast', msg: `A fine forgery: "${fake.name}". Whoever digs where it points, you will hear of it.`, kind: 'info' });
      return null;
    }
    case 'appraise': {
      if (!port) return 'Only in port';
      if (!m) return 'No such map';
      if (p.gold < 200) return 'The cartographer asks 200 silver';
      p.gold -= 200;
      game.db.ledger(s.accountId, 'appraisal', -200, m.name);
      // The better your own eye, the surer the verdict.
      const sure = Math.min(0.97, 0.7 + 0.1 * tx(ship.stats, 'cartography'));
      const fake = m.forged !== undefined;
      const right = game.rng.chance(sure);
      m.verdict = fake === right ? 'forgery' : 'genuine';
      game.sendTo(s, { t: 'toast', msg: `The cartographer squints at it: "${m.verdict === 'genuine' ? 'Genuine, I would stake my name on it' : 'A forgery, and not a good one'}."`, kind: m.verdict === 'genuine' ? 'good' : 'bad' });
      return null;
    }
    case 'seal': {
      if (!port) return 'Only in port';
      if (port.faction !== 'brokers') return 'Only the Brokers set their seal on maps';
      if (!m) return 'No such map';
      if (p.gold < 400) return 'The Brokers\' seal costs 400 silver';
      p.gold -= 400;
      game.db.ledger(s.accountId, 'seal', -400, m.name);
      if (m.forged !== undefined) {
        m.verdict = 'forgery';
        game.sendTo(s, { t: 'toast', msg: 'The Brokers do not seal forgeries. They keep your silver for the insult.', kind: 'bad' });
      } else {
        m.sealed = true;
        m.verdict = 'genuine';
        game.sendTo(s, { t: 'toast', msg: 'The Brokers\' seal: genuine. It will sell for more.', kind: 'good' });
      }
      return null;
    }
  }
  return 'Unknown map order';
}

// ================================================================== the view

/** A map as the captain reads it: circles only where the map draws one; words, outlines, a pulled needle. */
export function mapView(game: Game, s: PlayerSession, m: TreasureMap): MapView {
  const kind = m.kind ?? 'circle';
  const ship = s.ship;
  const base: MapView = { id: m.id, name: m.name, tier: m.tier, kind, x: 0, y: 0, r: -1, clue: m.clue, verdict: m.verdict, sealed: m.sealed || undefined, copy: m.copy || undefined };
  if (kind === 'circle' || kind === 'player') return { ...base, ...round(mapCircle(m, ship)) };
  if (kind === 'fragment') {
    const c = legendCircle(game, s, m);
    return { ...base, ...(c ? round(c) : {}), piece: [(m.piece ?? 0) + 1, m.of ?? 0] };
  }
  if (kind === 'drawing' && m.island !== undefined) {
    const is = game.world.islands[m.island];
    return { ...base, ...outline(is, m.sx, m.sy) };
  }
  if (kind === 'cursed' && ship) {
    const b = Math.atan2(m.sx - ship.state.x, -(m.sy - ship.state.y));
    // The needle wanders a little, less the nearer you are.
    const wobble = Math.sin(game.now * 0.3 + m.sx) * 12 * DEG * Math.min(1, dist(m.sx, m.sy, ship.state.x, ship.state.y) / 5000);
    return { ...base, bearing: Math.round((b + wobble) * 100) / 100 };
  }
  return base;
}

function round(c: { x: number; y: number; r: number }): { x: number; y: number; r: number } {
  return { x: Math.round(c.x), y: Math.round(c.y), r: Math.round(c.r) };
}

/** An island's outline scaled to a unit square (north up), with the cross where the chest is. */
function outline(is: Island, sx: number, sy: number): { shape: number[]; cross: [number, number] } {
  const k = 1 / (is.radius * 1.4);
  const shape: number[] = [];
  for (let i = 0; i < is.poly.length; i += 2) shape.push(Math.round((is.poly[i] - is.x) * k * 1000) / 1000, Math.round((is.poly[i + 1] - is.y) * k * 1000) / 1000);
  return { shape, cross: [Math.round((sx - is.x) * k * 1000) / 1000, Math.round((sy - is.y) * k * 1000) / 1000] };
}
