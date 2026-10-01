// The Grail (docs/17 H4 item 16). Sixteen obelisks stand about the sea; each read gives a captain a piece of the chart
// to a legendary treasure — HoMM3's puzzle map: the sea round the spot, blurred, clearing piece by piece from its
// edges inward, so the coasts grow familiar and the dig becomes a guess, then a certainty. Digging from the boats
// within 400 m of the spot finds it; the Grail is then raised in her island's town (server/src/game/town.ts: every
// dwelling ×1.5, 500 silver a day, more will for docs/17 H2).
//
// One Grail a captain a season, each at a spot of her own (hashed from her and the season): an MMO's sea has many
// captains, and one Grail for the whole world would be one captain's story and everyone else's lost hunt — and a spot
// shared by all would be on every tavern's lips by the second evening. Her own spot keeps the puzzle hers; the
// obelisks are the same stones for all. Every find goes into the sea's chronicle, the season's first by name.

import { GRAIL_DIG_SECS, GRAIL_MISS_SECS, GRAIL_R, GRAIL_TREASURE_HOURS, GRAIL_WILL, PUZZLE_GRID, PUZZLE_W, advHour, advLevelXp } from '../../../shared/src/data/advmap.ts';
import type { AdvObj } from '../../../shared/src/data/advmap.ts';
import { xpForLevel } from '../../../shared/src/constants.ts';
import type { PuzzleView } from '../../../shared/src/h4proto.ts';
import { closestOnPolygon, dist } from '../../../shared/src/math.ts';
import { hashString } from '../../../shared/src/rng.ts';
import type { Island } from '../../../shared/src/world/worldgen.ts';
import { depthAt, isLand } from '../../../shared/src/world/worldgen.ts';
import { advMap, advOf, parkNear, piecesOf, revealAdv } from './advmap.ts';
import { ownIsland } from './estate.ts';
import type { Game } from './Game.ts';
import type { PlayerSession, Profile } from './player.ts';
import { chronicle } from './renown.ts';
import { seasonId } from './seasons.ts';
import { townLevel } from './town.ts';

interface Dig {
  until: number;
  x: number;
  y: number;
}

interface GrailState {
  digs: Map<number, Dig>;
  /** A miss: the next dig waits until (world seconds). */
  wait: Map<number, number>;
}

const states = new WeakMap<Game, GrailState>();
function st(game: Game): GrailState {
  let s = states.get(game);
  if (!s) states.set(game, (s = { digs: new Map(), wait: new Map() }));
  return s;
}

/** The islands a Grail may lie on: the wild ones of every region but the Abyss, big enough to know by their coasts. */
const candidates = new WeakMap<Game['world'], Island[]>();
function grailIslands(game: Game): Island[] {
  let c = candidates.get(game.world);
  if (!c) candidates.set(game.world, (c = game.world.islands.filter((is) => !is.portId && !is.minor && !is.raft && is.region !== 'the_abyss' && is.radius >= 260)));
  return c;
}

/** Her Grail this season: an island's shore and the point on it. */
export function grailSpot(game: Game, account: number, season = seasonId(game)): { x: number; y: number; island: Island } {
  const list = grailIslands(game);
  const h = hashString(`grail:${game.world.seed}:${account}:${season}`);
  const is = list[h % list.length];
  const n = is.poly.length / 2;
  const k = (h >>> 11) % n;
  return { x: Math.round(is.poly[k * 2]), y: Math.round(is.poly[k * 2 + 1]), island: is };
}

/** The puzzle's chart: its corner (the spot somewhere in its middle half) and the order its pieces open in (the
 *  farthest from the spot first, as HoMM3's obelisks reveal the map's edges before its heart). */
export function puzzleOf(game: Game, account: number, season = seasonId(game)): { ox: number; oy: number; order: number[]; spot: { x: number; y: number; island: Island } } {
  const spot = grailSpot(game, account, season);
  const h = hashString(`puzzle:${account}:${season}`);
  const u = ((h % 1000) / 1000), v = (((h >>> 10) % 1000) / 1000);
  const ox = Math.round(spot.x - PUZZLE_W * (0.3 + 0.4 * u)), oy = Math.round(spot.y - PUZZLE_W * (0.3 + 0.4 * v));
  const cell = PUZZLE_W / PUZZLE_GRID;
  const order = [...Array(PUZZLE_GRID * PUZZLE_GRID).keys()].sort((a, b) => {
    const da = dist(ox + ((a % PUZZLE_GRID) + 0.5) * cell, oy + (Math.floor(a / PUZZLE_GRID) + 0.5) * cell, spot.x, spot.y);
    const db = dist(ox + ((b % PUZZLE_GRID) + 0.5) * cell, oy + (Math.floor(b / PUZZLE_GRID) + 0.5) * cell, spot.x, spot.y);
    return db - da || hashString(`pc:${h}:${a}`) - hashString(`pc:${h}:${b}`);
  });
  return { ox, oy, order, spot };
}

const foundThis = (game: Game, p: Profile) => advOf(p).found === seasonId(game);

/** Her puzzle as it stands: the pieces she has opened, the coasts in them, the spot when its own piece is open. */
export function puzzleView(game: Game, s: PlayerSession): PuzzleView {
  const p = s.profile!;
  const a = advOf(p);
  const { ox, oy, order, spot } = puzzleOf(game, s.accountId);
  const of = PUZZLE_GRID * PUZZLE_GRID;
  const n = Math.min(of, piecesOf(game, p).length);
  const open = order.slice(0, n);
  const cell = PUZZLE_W / PUZZLE_GRID;
  const rects = open.map((i) => [ox + (i % PUZZLE_GRID) * cell, oy + Math.floor(i / PUZZLE_GRID) * cell]);
  const coasts: number[][] = [];
  for (const is of game.world.islands) {
    if (is.raft) continue;
    const x0 = is.x - is.radius, x1 = is.x + is.radius, y0 = is.y - is.radius, y1 = is.y + is.radius;
    if (x1 < ox || y1 < oy || x0 > ox + PUZZLE_W || y0 > oy + PUZZLE_W) continue;
    // Only the coasts in her open pieces go to her (the rest of the chart is still a blur to her too).
    if (!rects.some(([rx, ry]) => x1 >= rx && x0 <= rx + cell && y1 >= ry && y0 <= ry + cell)) continue;
    const pts = is.poly.length / 2;
    const step = Math.max(1, Math.floor(pts / 48));
    const poly: number[] = [];
    for (let k = 0; k < pts; k += step) poly.push(Math.round((is.poly[k * 2] - ox) / 10) * 10, Math.round((is.poly[k * 2 + 1] - oy) / 10) * 10);
    coasts.push(poly);
  }
  const xi = Math.floor((spot.x - ox) / cell), yi = Math.floor((spot.y - oy) / cell);
  const spotPiece = yi * PUZZLE_GRID + xi;
  const G = st(game);
  const dig = G.digs.get(s.accountId);
  return {
    season: seasonId(game), n, of, grid: PUZZLE_GRID, w: PUZZLE_W, open, coasts,
    ...(open.includes(spotPiece) ? { x: [spot.x - ox, spot.y - oy] as [number, number] } : {}),
    ...(n >= of / 2 ? { region: spot.island.region } : {}),
    found: foundThis(game, p), held: !!a.held, built: !!a.built,
    digging: dig ? Math.max(0, Math.ceil(dig.until - game.now)) : 0, wait: Math.max(0, Math.ceil((G.wait.get(s.accountId) ?? 0) - game.now)),
  };
}

export function sendPuzzle(game: Game, s: PlayerSession): void {
  if (s.profile) game.sendTo(s, { t: 'puzzle', view: puzzleView(game, s) });
}

/** An obelisk read (advmap.ts): the line for her toast. */
export function readObelisk(game: Game, s: PlayerSession, _o: AdvObj): string {
  const n = Math.min(PUZZLE_GRID * PUZZLE_GRID, piecesOf(game, s.profile!).length);
  sendPuzzle(game, s);
  return n >= PUZZLE_GRID * PUZZLE_GRID ? 'The obelisk’s carving is the last piece of the Grail’s chart: the spot is marked.' : `The obelisk’s carving is a piece of the Grail’s chart (${n} of ${PUZZLE_GRID * PUZZLE_GRID}).`;
}

/** The island whose shore lies within reach of her boats (none: no sand to dig). */
function shoreNear(game: Game, x: number, y: number): Island | null {
  for (const is of game.world.islands) {
    if (is.portId || is.raft || Math.abs(is.x - x) > is.radius + 400 || Math.abs(is.y - y) > is.radius + 400) continue;
    if (Math.sqrt(closestOnPolygon(x, y, is.poly).d2) <= 350) return is;
  }
  return null;
}

/** The boats go ashore with spades where she lies. */
export function startDig(game: Game, s: PlayerSession): string | null {
  const ship = s.ship;
  const p = s.profile;
  if (!ship || !p || ship.docked) return 'Put to sea first.';
  if (foundThis(game, p)) return 'You have found this season’s Grail already.';
  if (ship.boarding || ship.landing) return 'Not now';
  if (ship.state.speed > 2.5) return 'Heave to first — the boats cannot be lowered at speed';
  if (ship.input.sailTarget > 0) return 'Furl the sails first: the diggers row ashore from a ship at rest.';
  const G = st(game);
  if (G.digs.has(s.accountId)) return 'The boats are digging already.';
  if ((G.wait.get(s.accountId) ?? 0) > game.now) return 'The diggers are still resting from the last hole.';
  if (!shoreNear(game, ship.state.x, ship.state.y)) return 'No shore within reach of the boats to dig.';
  G.digs.set(s.accountId, { until: game.now + GRAIL_DIG_SECS, x: ship.state.x, y: ship.state.y });
  ship.input = { rudder: 0, sailTarget: 0 };
  game.emit({ k: 'fx', fx: 'dig', x: Math.round(ship.state.x), y: Math.round(ship.state.y), r: 40 }, ship.state.x, ship.state.y);
  game.toastShip(ship, `The boats go ashore with spades for the Grail (${GRAIL_DIG_SECS}s).`, 'info');
  sendPuzzle(game, s);
  return null;
}

/** Every second: the diggers at work (recalled when she sails), and what they turn up. */
export function stepGrail(game: Game): void {
  const G = st(game);
  for (const [account, d] of [...G.digs]) {
    const s = game.sessionByAccount(account);
    const ship = s?.ship;
    if (!s?.profile || !ship || ship.docked || !ship.alive) {
      G.digs.delete(account);
      continue;
    }
    if (dist(ship.state.x, ship.state.y, d.x, d.y) > 80 || ship.input.sailTarget > 0 || ship.boarding) {
      G.digs.delete(account);
      game.toastShip(ship, 'The diggers are recalled before the hole is deep enough.', 'bad');
      sendPuzzle(game, s);
      continue;
    }
    if (game.now < d.until) continue;
    G.digs.delete(account);
    const spot = grailSpot(game, account);
    if (dist(ship.state.x, ship.state.y, spot.x, spot.y) <= GRAIL_R) grailFound(game, s, spot.island);
    else {
      G.wait.set(account, game.now + GRAIL_MISS_SECS);
      game.toastShip(ship, 'Only sand and crabs. The Grail lies elsewhere.', 'bad');
    }
    sendPuzzle(game, s);
  }
}

/** She has dug up the Grail: it waits to be raised in her town (or, hers already standing, it is a treasure). */
export function grailFound(game: Game, s: PlayerSession, island: Island): void {
  const p = s.profile!;
  const a = advOf(p);
  const season = seasonId(game);
  a.found = season;
  a.grails = (a.grails ?? 0) + 1;
  const level = s.ship?.shipLevel ?? 1;
  const book = game.db.getKv<{ season: number; n: number }>('h4:grails');
  const first = !book || book.season !== season;
  game.db.setKv('h4:grails', { season, n: first ? 1 : book!.n + 1 });
  chronicle(game, first ? `${s.name} has found the first Grail of the season on ${island.name}.` : `${s.name} has found a Grail on ${island.name}.`);
  // The season's first find is the whole sea's news (docs/17, after H5): every captain at sea hears it — each still
  // hunts a Grail of her own, at her own spot.
  if (first) for (const o of game.sessions) if (o !== s && o.profile) game.sendTo(o, { t: 'toast', msg: `WORLD: ${s.name} has found the first Grail of the season on ${island.name}. Yours still lies where your obelisks point.`, kind: 'gold' });
  game.grantXp(s, Math.round(xpForLevel(p.level) * 0.5), 'Found the Grail');
  if (a.built) {
    const silver = Math.round(advHour(level) * GRAIL_TREASURE_HOURS);
    p.gold += silver;
    game.db.ledger(s.accountId, 'grail', silver, island.name);
    game.toastShip(s.ship!, `The Grail! Yours already stands in your town: this one is a treasure of ${silver} silver.`, 'gold');
  } else {
    a.held = true;
    game.toastShip(s.ship!, ownIsland(game, s.accountId) ? 'The Grail! Raise it in your island’s town.' : 'The Grail! Keep it until you have an island of your own, and raise it in its town.', 'gold');
  }
  game.pushSelf(s, true);
}

/** Whether she has a Grail to raise in her town (town.ts asks before the builders start). */
export function grailToRaise(s: PlayerSession): boolean {
  return !!s.profile && !!advOf(s.profile).held && !advOf(s.profile).built;
}

/** The builders have started on it: the Grail is the town's now. */
export function grailRaised(s: PlayerSession): void {
  const a = advOf(s.profile!);
  a.held = false;
  a.built = true;
}

/** For docs/17 H2: the will the Grail in her town adds to the captain's (0 without one). */
export function grailWill(game: Game, account: number): number {
  const h = ownIsland(game, account);
  return h?.yard && townLevel(h.yard, 'grail') > 0 ? GRAIL_WILL : 0;
}

// ------------------------------------------------------------------------------------------------ the admin

/** `/obelisk [n|all|go]`: n pieces (or all sixteen) of her chart; `go`: to the nearest obelisk she has not read. */
export function adminObelisk(game: Game, s: PlayerSession, args: string[]): string {
  const p = s.profile!;
  const pieces = piecesOf(game, p);
  const obs = advMap(game).objs.filter((o) => o.kind === 'obelisk');
  if (args[0] === 'go') {
    const ship = s.ship!;
    const left = obs.filter((o) => !pieces.includes(o.id)).sort((a, b) => dist(a.x, a.y, ship.state.x, ship.state.y) - dist(b.x, b.y, ship.state.x, ship.state.y));
    if (!left.length) return 'You have read every obelisk this season.';
    parkNear(game, s, left[0].x, left[0].y, 150);
    revealAdv(game, s, left[0].x, left[0].y, 300);
    game.pushSelf(s, true);
    return `By an obelisk off ${left[0].island}.`;
  }
  const want = args[0] === 'all' ? obs.length : Math.min(obs.length, pieces.length + Math.max(1, Math.floor(Number(args[0])) || 1));
  for (const o of obs) {
    if (pieces.length >= want) break;
    if (!pieces.includes(o.id)) pieces.push(o.id);
  }
  sendPuzzle(game, s);
  return `Pieces of the Grail’s chart: ${pieces.length} of ${obs.length}.`;
}

/** `/grail [go|found|reset]`: off the spot (dig then); the Grail found at once; this season's hunt forgotten. */
export function adminGrail(game: Game, s: PlayerSession, args: string[]): string {
  const p = s.profile!;
  const a = advOf(p);
  const spot = grailSpot(game, s.accountId);
  if (args[0] === 'go') {
    // Out from the island's middle through the spot, until the water is open.
    const is = spot.island;
    const dx = spot.x - is.x, dy = spot.y - is.y, len = Math.hypot(dx, dy) || 1;
    let k = 40;
    for (; k < 380; k += 20) {
      const x = spot.x + (dx / len) * k, y = spot.y + (dy / len) * k;
      if (!isLand(game.world, x, y) && depthAt(game.world, x, y) > s.ship!.cls.draft + 1.5 && Math.sqrt(closestOnPolygon(x, y, is.poly).d2) > 70) break;
    }
    parkNear(game, s, spot.x + (dx / len) * k, spot.y + (dy / len) * k, 1);
    game.pushSelf(s, true);
    return `Off the Grail’s spot on ${is.name}: dig.`;
  }
  if (args[0] === 'found') {
    grailFound(game, s, spot.island);
    sendPuzzle(game, s);
    return 'The Grail is yours.';
  }
  if (args[0] === 'reset') {
    delete a.found;
    a.held = false;
    a.built = false;
    a.pieces = [];
    sendPuzzle(game, s);
    return 'This season’s Grail hunt is forgotten.';
  }
  return `Your Grail lies on ${spot.island.name}; pieces ${piecesOf(game, p).length}; ${foundThis(game, p) ? 'found' : 'not found'}${a.held ? ', waiting to be raised' : ''}${a.built ? ', standing in your town' : ''}.`;
}
