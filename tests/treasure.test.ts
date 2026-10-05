import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { digTime, makeMap, mapHere } from '../server/src/game/explorefx.ts';
import type { TreasureMap } from '../server/src/game/explorefx.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { legend, legendCircle, legendEcho, legendFragment, mapView, stealMaps } from '../server/src/game/treasure.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string, talents: TalentRanks = {}) {
  const c = join(game, name, 'navigator');
  const s = game.sessionByName(name)!;
  s.profile!.level = 60;
  s.profile!.talents = talents;
  s.ship!.talents = talents;
  s.ship!.recompute(game.now);
  s.profile!.gold = 1e5;
  s.profile!.explore.maps = [];
  return { c, s, ship: s.ship!, p: s.profile! };
}

function toSea(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.lastCombat = -999;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, x, y);
}

function empty(game: Game): void {
  for (const id of [...game.npcs.keys()]) game.removeShip(id);
}

/** Dig at the map's true spot and wait for the boats. */
function digAt(game: Game, c: ReturnType<typeof captain>['c'], s: PlayerSession, m: TreasureMap): void {
  toSea(game, s, m.sx, m.sy);
  c.push({ t: 'land' });
  assert.equal(s.ship!.landing?.feature, 'dig', 'the boats go digging');
  // An empty sea while they dig: no passing pirate pack comes in at the pace of the sea.
  for (let i = 0; i < Math.ceil(digTime(s.ship!, m.tier) + 1); i++) {
    for (const id of [...game.npcs.keys()]) if (game.ships.get(id)?.name !== 'Guardians of the Hoard') game.removeShip(id);
    steps(game, 20);
  }
}

test('map kinds: a circle, a riddle in verse, landmarks and paces, a drawing of the shore, a cursed needle', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Reader');
  toSea(game, s, 50000, 50000);
  const circle = mapView(game, s, makeMap(game, 1));
  assert.ok(circle.r > 0);
  const riddle = makeMap(game, 2, { kind: 'riddle' });
  const rv = mapView(game, s, riddle);
  assert.equal(rv.r, -1, 'a riddle draws no circle');
  assert.ok(rv.clue!.includes(REGIONS[riddle.region].name), rv.clue);
  const lm = makeMap(game, 2, { kind: 'landmark' });
  assert.ok(mapView(game, s, lm).clue!.includes(game.world.islands[lm.island!].name));
  assert.match(mapView(game, s, lm).clue!, /paces/);
  const dr = mapView(game, s, makeMap(game, 2, { kind: 'drawing' }));
  assert.ok(dr.shape && dr.shape.length >= 28 && dr.cross, 'an outline and a cross');
  assert.ok(Math.max(...dr.shape!.map(Math.abs)) <= 1);
  const cursed = makeMap(game, 3, { kind: 'cursed' });
  assert.equal(cursed.tier, 4);
  assert.ok(['drowned_crown', 'the_abyss'].includes(cursed.region));
  const cv = mapView(game, s, cursed);
  assert.equal(typeof cv.bearing, 'number');
});

test('a riddle: the boats may dig anywhere near its island — the true spot gives the hoard, a miss points onward', () => {
  const { game } = makeGame();
  empty(game);
  const { c, s, p } = captain(game, 'Riddler');
  const m = makeMap(game, 2, { kind: 'riddle' });
  p.explore.maps.push(m);
  const is = game.world.islands[m.island!];
  // Near the island, far from the spot: the prompt is there, and a miss hints.
  const away = Math.atan2(is.x - m.sx, -(is.y - m.sy));
  toSea(game, s, is.x + Math.sin(away) * (is.radius + 600), is.y - Math.cos(away) * (is.radius + 600));
  assert.equal(mapHere(game, s)?.id, m.id);
  // Out at sea, nothing.
  toSea(game, s, is.x + is.radius + 9000, is.y);
  assert.equal(mapHere(game, s), null);
  const gold = p.gold;
  digAt(game, c, s, m);
  assert.ok(p.gold > gold, 'the hoard');
  assert.equal(p.explore.maps.length, 0);
});

test('one chest for every copy: whoever digs first takes it; the second finds a broken chest', () => {
  const { game } = makeGame();
  empty(game);
  const A = captain(game, 'First Spade'), B = captain(game, 'Second Spade');
  const m = makeMap(game, 1);
  A.p.explore.maps.push(m);
  B.p.explore.maps.push({ ...m, id: 'm-copy', copy: true });
  const gold = A.p.gold;
  digAt(game, A.c, A.s, m);
  assert.ok(A.p.gold > gold);
  // She knows these waters already: no island newly charted on the way pays a day's order into her purse meanwhile.
  for (const is of game.world.islands) B.s.discovered.add(is.id);
  const gb = B.p.gold;
  digAt(game, B.c, B.s, B.p.explore.maps[0]);
  assert.equal(B.p.gold, gb, 'nothing left');
  assert.ok(B.c.all('toast').some((t) => /got here first/.test(t.msg)));
  assert.equal(B.p.explore.maps.length, 0);
});

test('forgeries: a forger at a black market; the dig finds nothing and the forger hears of it; the appraiser and the Brokers can tell', () => {
  const { game } = makeGame();
  empty(game);
  const F = captain(game, 'Inky Forger', { smg_forged_papers: 1 });
  const V = captain(game, 'Victim Vane');
  const black = game.world.ports.find((q) => q.blackMarket && q.faction !== 'brokers')!;
  F.ship.docked = black.id;
  F.p.docked = black.id;
  F.c.push({ t: 'map', action: 'forge' });
  const fake = F.p.explore.maps[0];
  assert.ok(fake && fake.forged === F.s.accountId, 'forged');
  // Handed over in port.
  V.ship.docked = black.id;
  V.p.docked = black.id;
  F.c.push({ t: 'map', action: 'give', id: fake.id, to: 'Victim Vane' });
  assert.equal(V.p.explore.maps.length, 1);
  // The Brokers will not seal it.
  const brokers = game.world.ports.find((q) => q.faction === 'brokers')!;
  V.ship.docked = brokers.id;
  V.p.docked = brokers.id;
  V.c.push({ t: 'map', action: 'seal', id: fake.id });
  assert.equal(V.p.explore.maps[0].verdict, 'forgery');
  assert.ok(!V.p.explore.maps[0].sealed);
  // A genuine map gets the seal.
  const real = makeMap(game, 1);
  V.p.explore.maps.push(real);
  V.c.push({ t: 'map', action: 'seal', id: real.id });
  assert.equal(real.sealed, true);
  // The dig. She knows these waters already: no island newly charted on the way pays a day's order into her purse
  // meanwhile (QA circle, 2026-10-05: on a day whose order was «chart 2 islands» it paid 490 silver — the old flicker).
  for (const is of game.world.islands) V.s.discovered.add(is.id);
  const gold = V.p.gold;
  digAt(game, V.c, V.s, fake);
  assert.equal(V.p.gold, gold);
  assert.ok(V.c.all('toast').some((t) => /forgery/.test(t.msg)));
  assert.ok(F.c.all('toast').some((t) => /is digging where your forged map sent them/.test(t.msg)));
});

test('the boarders take the captain’s chest: two maps, the finest first', () => {
  const { game } = makeGame();
  const W = captain(game, 'Winner Wolfe'), L = captain(game, 'Loser Lark');
  L.p.explore.maps = [makeMap(game, 1), makeMap(game, 3), makeMap(game, 2)];
  stealMaps(game, W.s, L.s);
  assert.equal(W.p.explore.maps.length, 2);
  assert.deepEqual(W.p.explore.maps.map((m) => m.tier).sort(), [2, 3]);
  assert.equal(L.p.explore.maps.length, 1);
  assert.equal(L.p.explore.maps[0].tier, 1);
});

test('the legendary chart: pieces narrow the circle, holders hear each other, the whole chart gives the spot, and the first to dig takes the legend', () => {
  const { game } = makeGame();
  empty(game);
  let wall = 5_000_000_000_000;
  game.wallNow = () => wall;
  const A = captain(game, 'Anna Chart'), B = captain(game, 'Bo Chart');
  const lc = legend(game);
  assert.ok(lc.n >= 4 && lc.n <= 7);
  toSea(game, A.s, 40000, 40000);
  toSea(game, B.s, 44000, 40000);
  assert.equal(legendFragment(game, A.s, 1, 'test'), true);
  const r1 = legendCircle(game, A.s, A.p.explore.maps[0])!.r;
  assert.equal(legendFragment(game, A.s, 1, 'test'), true);
  const r2 = legendCircle(game, A.s, A.p.explore.maps[0])!.r;
  assert.ok(r2 < r1, 'narrower');
  // Bo holds one too: they hear each other (Bo lies to the east).
  assert.equal(legendFragment(game, B.s, 1, 'test'), true);
  const echo = legendEcho(game, A.s);
  assert.equal(echo.length, 1);
  assert.ok(Math.abs(echo[0] - Math.PI / 2) < 0.05);
  // Anna gathers the rest (steals Bo's), and the circle closes on the spot.
  stealMaps(game, A.s, B.s);
  while (legend(game).issued.length < lc.n) assert.ok(legendFragment(game, A.s, 1, 'test'));
  assert.equal(new Set(A.p.explore.maps.map((m) => m.piece)).size, lc.n, 'the whole chart');
  assert.equal(legendCircle(game, A.s, A.p.explore.maps[0])!.r, 0);
  assert.equal(legendFragment(game, B.s, 1, 'test'), false, 'no more pieces this season');
  // Dig the legend.
  const gold = A.p.gold;
  digAt(game, A.c, A.s, A.p.explore.maps[0]);
  assert.ok(A.p.gold > gold + 10000);
  assert.ok(A.p.trophies.includes(lc.name));
  assert.equal(legend(game).found, true);
  assert.equal(A.p.explore.maps.filter((m) => m.kind === 'fragment').length, 0);
  // Next season, a new chart.
  wall += 91 * 24 * 3600_000;
  assert.notEqual(legend(game).id, lc.id);
});

test('a cursed hoard: rich, and the curse comes with it; the noise of digging carries 2 km', () => {
  const { game } = makeGame();
  empty(game);
  const D = captain(game, 'Dread Digger'), N = captain(game, 'Nosy Neighbour');
  const m = makeMap(game, 3, { kind: 'cursed' });
  D.p.explore.maps.push(m);
  toSea(game, N.s, m.sx + 1200, m.sy);
  const curse = D.ship.curse, sanity = D.ship.sanity;
  const gold = D.p.gold;
  digAt(game, D.c, D.s, m);
  assert.ok(D.p.gold > gold);
  assert.ok(D.ship.curse >= curse + 25 || D.ship.curse === 100);
  assert.ok(D.ship.sanity <= sanity - 30);
  assert.ok(N.c.all('toast').some((t) => /digging|digs/.test(t.msg)), 'the neighbour saw it');
});
