// The island → hire loop (owner, 2026-10-28: «качаешь остров — открываются новые бойцы рангом выше, нанимать можно в
// портах или плавучих портах. ключ — это остров»): the advice for a weak army, the island's tiers in any port and at
// a waystation, the hands going ashore for better men, and the tree's first steps within a level 8–12 purse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADVICE_FROM_LEVEL, armyAdvice, armyNorm } from '../shared/src/data/armyadvice.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import { TIER_SHIP_LEVEL, portDwellings } from '../shared/src/data/town.ts';
import { treeClosure, treeCost } from '../shared/src/data/isletree.ts';
import { waystations } from '../shared/src/world/waystations.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { dwellView, recruit } from '../server/src/game/dwell.ts';
import { townState } from '../server/src/game/town.ts';
import { islePools } from '../server/src/game/town.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { yardOf } from '../server/src/game/base.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { mineSites } from '../server/src/game/mines.ts';
import { moor, wayDwellView, wayRecruit } from '../server/src/game/waystations.ts';
import { captainAdvice } from '../server/src/game/armyadvice.ts';
import { join, makeGame, offCoast, onHull } from './helpers.ts';

const base = { level: 12, shipLevel: 2, crewMax: 90, slots: 5, gold: 1500 };

test('the advice: weak for the level, and the one next step — claim, build, hire, silver', () => {
  assert.equal(armyAdvice({ ...base, level: ADVICE_FROM_LEVEL - 1, army: [{ u: 'deckhand', n: 90 }], isle: null }), null, 'quiet before level 5');
  const none = armyAdvice({ ...base, army: [{ u: 'deckhand', n: 90 }], isle: null })!;
  assert.ok(none.weak && none.ratio < 0.85, `90 deckhands are weak at ⚓2 (${none.ratio})`);
  assert.equal(none.step?.kind, 'claim');
  const built = armyAdvice({ ...base, army: [{ u: 'deckhand', n: 90 }], isle: { hall: 1, dw1: 1 } })!;
  assert.equal(built.step?.kind, 'build');
  assert.equal(built.step?.building, 'dw2');
  assert.match(built.step!.textRu, /Казарма морпехов.*морпехи \(ранг 2\)/);
  const open = armyAdvice({ ...base, army: [{ u: 'deckhand', n: 90 }], isle: { hall: 1, dw1: 1, dw2: 1, market: 1, dw3: 1 } })!;
  assert.equal(open.step?.kind, 'hire');
  assert.equal(open.step?.unit, 'musketeer', 'the highest open tier her ship carries');
  assert.equal(open.best, 'musketeer');
  assert.match(open.step!.textRu, /любом порту или плавучем доме/);
  const poor = armyAdvice({ ...base, gold: 100, army: [{ u: 'deckhand', n: 90 }], isle: { hall: 1, dw1: 1, dw2: 1, market: 1, dw3: 1 } })!;
  assert.equal(poor.step?.kind, 'silver');
  // what a building asks first is named
  const first = armyAdvice({ ...base, army: [{ u: 'deckhand', n: 90 }], isle: { hall: 1 } })!;
  assert.equal(first.step?.kind, 'build');
  assert.equal(first.step?.unit, 'marine');
  assert.equal(first.step?.building, 'dw1', 'the barracks ask the bunkhouse first');
  assert.match(first.step!.textRu, /Сначала: «Кубрик» до уровня 1/);
  // the ladder's own army is not weak
  const norm = armyAdvice({ ...base, army: armyForLevel(2, 90, 5, 'player'), isle: null })!;
  assert.equal(norm.weak, false);
  assert.equal(norm.step, null);
  assert.ok(Math.abs(norm.norm - armyNorm(2, 90, 5)) <= 1);
  // the top captains of the live sea: 28 deckhands and 3 marines at level 14 — fill the hammocks first
  assert.equal(armyAdvice({ ...base, level: 14, gold: 204, army: [{ u: 'marine', n: 3 }, { u: 'deckhand', n: 28 }], isle: null })!.step?.kind, 'fill');
});

test('the tree: the musketeers from the first hall, the gunners from ⚓2; tier 4 within ~6 000 silver of buildings', () => {
  assert.equal(TIER_SHIP_LEVEL[3], 1);
  assert.equal(TIER_SHIP_LEVEL[4], 2);
  const silver = (id: 'dw3' | 'dw4') => [...treeClosure(id, 1)].reduce((a, [k, n]) => { let c = 0; for (let l = 1; l <= n; l++) if (!(k === 'hall' && l === 1)) c += treeCost(k, l).silver; return a + c; }, 0);
  assert.ok(!treeClosure('dw3', 1).has('hall') || treeClosure('dw3', 1).get('hall') === 1, 'the range asks the first hall only');
  assert.ok(silver('dw3') <= 3_500, `the shooting range and what it asks: ${silver('dw3')} silver`);
  assert.ok(silver('dw4') <= 6_500, `the gun foundry and what it asks: ${silver('dw4')} silver`);
});

// ------------------------------------------------------------------------------------------------ in the game

let clock = 20_000 * 86_400_000;
function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  return game;
}

function islander(game: Game, name: string): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 3);
  s.profile!.gold = 2_000_000;
  s.profile!.level = 12;
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  assert.ok(offCoast(game, ship, home));
  ship.state.speed = 0;
  ship.region = home.region;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.equal(buyIsland(game, s, home.id), null);
  const y = yardOf(game, ownIsland(game, s.accountId)!);
  Object.assign(townState(y).b, { dw1: 1, dw2: 1, market: 1, dw3: 1 });
  return s;
}

function dockAt(game: Game, s: PlayerSession, id: string) {
  const port = game.portById(id)!;
  s.ship!.docked = port.id;
  s.profile!.docked = port.id;
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  return port;
}

test('her island\'s tiers in any port: a village without a shooting range hires her musketeers from the island\'s pool', () => {
  const game = world();
  const s = islander(game, 'Isle Key');
  const port = game.world.ports.find((p) => !p.raft && !portDwellings({ ...p, key: false }).some((d) => d.tier === 3) && !portDwellings(p).some((d) => d.tier === 3))!;
  assert.ok(port, 'a port with no musketeers of its own');
  dockAt(game, s, port.id);
  const y = yardOf(game, ownIsland(game, s.accountId)!);
  const pool = islePools(game, y);
  pool[3] = 14;
  const v = dwellView(game, s, 'port')!;
  const row = v.rows.find((r) => r.tier === 3)!;
  assert.ok(row && row.isle, 'the island\'s row in the port');
  assert.equal(row.pool, 14);
  assert.equal(v.best, 'musketeer', 'the best kind highlighted');
  s.ship!.setArmy([{ u: 'deckhand', n: 40 }]);
  s.ship!.cargo.gunpowder = 10;
  assert.equal(recruit(game, s, 'port', 'musketeer', 10), null);
  assert.equal(s.ship!.army.find((x) => x.u === 'musketeer')?.n, 10);
  assert.equal(islePools(game, y)[3], 4, 'drawn from the island\'s pool');
  // the advice reads the live captain
  const a = captainAdvice(game, s)!;
  assert.ok(a && a.best === 'musketeer');
});

test('full hammocks of deckhands: the hands go ashore for better men', () => {
  const game = world();
  const s = islander(game, 'Isle Swap');
  dockAt(game, s, 'gravesend');
  const ship = s.ship!;
  ship.setArmy([{ u: 'deckhand', n: ship.stats.crewMax }]);
  const v = dwellView(game, s, 'port')!;
  assert.ok((v.rows.find((r) => r.tier === 2)?.swap ?? 0) > 0, 'the row says the hands may make room');
  assert.equal(recruit(game, s, 'port', 'marine', 6), null);
  assert.equal(ship.crew, ship.stats.crewMax);
  assert.equal(ship.army.find((x) => x.u === 'marine')?.n, 6);
  assert.equal(ship.army.find((x) => x.u === 'deckhand')?.n, ship.stats.crewMax - 6);
});

test('her island\'s tiers at a floating waystation too', () => {
  const game = world();
  const s = islander(game, 'Isle Way');
  const ship = s.ship!;
  const w = waystations(game.world).list.find((x) => x.region === 'gravewater' && x.kind === 'market')!;
  ship.docked = null;
  ship.state.x = w.x + 60;
  ship.state.y = w.y;
  ship.state.speed = 0;
  ship.lastCombat = -1000;
  ship.lastHitAt = -1000;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.equal(moor(game, s, w.id), null);
  const y = yardOf(game, ownIsland(game, s.accountId)!);
  islePools(game, y)[2] = 12;
  islePools(game, y)[3] = 12;
  ship.setArmy([{ u: 'deckhand', n: 30 }]);
  ship.cargo.gunpowder = 10;
  const v = wayDwellView(game, s)!;
  const row = v.rows.find((r) => r.isle);
  assert.ok(row, 'the island\'s men at the waystation');
  assert.equal(new Set(v.rows.flatMap((r) => r.units.map((x) => x.u))).size, v.rows.flatMap((r) => r.units).length, 'one row a kind');
  const u = row.units[0].u;
  assert.equal(wayRecruit(game, s, u, 8), null);
  assert.equal(ship.army.find((x) => x.u === u)?.n, 8);
  assert.equal(islePools(game, y)[row.tier], 4, 'drawn from the island\'s pool');
});
