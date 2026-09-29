// One's own island as a base (docs/15 items 1–3): plots by the island's level; building and raising on the wall
// clock with one crew (two from the level the data sets); speed-ups for silver, for provisions and for the free
// tokens of the daily welcome and orders; producers by the island's biome working while their owner is away into a
// capped yard; the yard paying for the work; a building moved to a free plot; every word in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_PLOTS, BASE_RES, BUILD_MAX_SECS, CREW_LEVELS, PLOT_CELLS, PRODUCERS, PRODUCER_KINDS, PRODUCER_MAX, TOKEN_MAX, TOKEN_SECS, TOKENS_LOGIN, baseCost, crewsAt, maxLevel,
  plotsOf, producerRate, speedupGoods, speedupSilver, yardCap,
} from '../shared/src/data/base.ts';
import { ISLE_LEVELS, ISLE_MAX } from '../shared/src/data/estate.ts';
import { BUILDINGS, BUILDING_IDS } from '../shared/src/data/holdings.ts';
import { dayOf } from '../shared/src/data/dailies.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { baseView, capOf, collectYard, grantSpeedups, moveTo, reckonBase, speedup, startBuild, upgradeAt, yardOf } from '../server/src/game/base.ts';
import { dailyRollover } from '../server/src/game/dailies.ts';
import { buyIsland, clearOutposts, isleLevelUp, ownIsland } from '../server/src/game/estate.ts';
import { build, stepHoldings } from '../server/src/game/holdings.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { extract } from '../tools/i18n-server.ts';
import { SERVER_RU_B } from '../client/src/lang/server.ru.b.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { EN as BASE_EN, RU as BASE_RU } from '../client/src/lang/ui/base.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const MIN = 60_000;
const HOUR = 3_600_000;
let clock = 20_000 * 86_400_000;

function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  return game;
}

function offShore(game: Game, ship: ShipEntity, is: Island): void {
  ship.docked = null;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const x = is.x + Math.sin(a) * (is.radius + 120), y = is.y - Math.cos(a) * (is.radius + 120);
    if (isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.state.speed = 0;
  ship.region = is.region;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

function owner(game: Game, name = 'Base Builder'): { c: FakeConn; s: PlayerSession; ship: ShipEntity; home: Island } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 2_000_000;
  const home = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id))!;
  assert.ok(home, 'a wild island to buy');
  offShore(game, s.ship!, home);
  assert.equal(buyIsland(game, s, home.id), null);
  // Out of the island's reach: the base is run from anywhere, and the hold does not pay unless she lies off it.
  s.ship!.state.x += 20_000;
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  return { c, s, ship: s.ship!, home };
}

const fill = (game: Game, s: PlayerSession, n = 10_000) => {
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  for (const g of BASE_RES) y.res[g] = n;
  return { h, y };
};

test('building takes real time: the plot is held, the crew busy, the producer works once it stands', () => {
  const game = world();
  const { s } = owner(game);
  const h = ownIsland(game, s.accountId)!;
  const v0 = baseView(game, s)!;
  assert.equal(v0.plots, plotsOf(1, v0.size), 'plots by the island level and size');
  assert.equal(v0.cells.length, v0.plots);
  assert.ok(v0.locked.length > 0 && v0.locked.every((l) => l.level > 1 || l.level === 0) && v0.locked.some((l) => l.level === 2), 'the rest of the grid opens with the island');
  assert.equal(v0.crews.n, 1);
  const g0 = s.profile!.gold;
  assert.equal(startBuild(game, s, 0, 'p:lumber'), null);
  const cost = baseCost('p:lumber', 1);
  assert.equal(g0 - s.profile!.gold, cost.silver, 'silver from the purse');
  const y = yardOf(game, h);
  assert.equal(y.jobs.length, 1);
  assert.equal(y.jobs[0].end - y.jobs[0].start, cost.secs * 1000, 'the work takes its minutes');
  assert.ok(cost.secs >= 60 && cost.secs <= BUILD_MAX_SECS);
  assert.equal(startBuild(game, s, 0, 'p:fishery'), 'That plot is taken.');
  // Half way: not yet.
  clock += (cost.secs * 1000) / 2;
  reckonBase(game, h);
  assert.equal(y.producers.length, 0);
  const v1 = baseView(game, s)!;
  assert.equal(v1.cells[0].what, 'p:lumber', 'the plot shows what is being raised');
  assert.ok(v1.cells[0].job && v1.cells[0].job.end > v1.now);
  // Done: the producer stands and yields.
  clock += cost.secs * 1000;
  stepHoldings(game);
  for (let i = 0; i < 10; i++) game.step();
  reckonBase(game, h);
  assert.equal(y.jobs.length, 0);
  assert.deepEqual(y.producers.map((p) => [p.kind, p.plot, p.level]), [['lumber', 0, 1]]);
  const isl = game.world.islands[h.island];
  const t0 = y.res.timber ?? 0;
  clock += 2 * HOUR;
  reckonBase(game, h);
  const want = producerRate('lumber', 1, isl.biome) * 2;
  assert.ok(Math.abs((y.res.timber ?? 0) - t0 - want) <= 1, `two hours of timber (${want})`);
  // The old build order for one's own island goes by the plots and the crews too.
  const before = h.buildings.length;
  fill(game, s);
  assert.equal(build(game, s, h.island, 'warehouse'), null);
  assert.equal(h.buildings.length, before, 'not raised at once');
  assert.equal(y.jobs.length, 1);
  assert.equal(y.jobs[0].what, 'warehouse');
});

test('speed-ups: silver by the time left, provisions, and the free tokens of a quarter hour', () => {
  const game = world();
  const { s } = owner(game);
  const { h, y } = fill(game, s);
  assert.equal(startBuild(game, s, 1, 'warehouse'), null);
  const job = y.jobs[0];
  const left = (job.end - clock) / 1000;
  const price = speedupSilver(left);
  assert.ok(price >= 25);
  const g0 = s.profile!.gold;
  assert.equal(speedup(game, s, job.id, 'silver'), null);
  assert.equal(g0 - s.profile!.gold, price);
  assert.ok(has(h, 'warehouse'), 'finished at once');
  assert.equal(y.jobs.length, 0);
  // Upgrade (the warehouse grows) and pay in provisions.
  h.level = 3;
  assert.equal(upgradeAt(game, s, 1), null);
  const up = y.jobs[0];
  const need = speedupGoods((up.end - clock) / 1000).provisions!;
  const p0 = y.res.provisions!;
  assert.equal(speedup(game, s, up.id, 'res'), null);
  assert.equal(p0 - y.res.provisions!, need, 'provisions for the extra hands');
  assert.equal(h.buildings.find((b) => b.id === 'warehouse')!.level, 2);
  // Tokens: none at first.
  s.profile!.speedups = 0;
  assert.equal(upgradeAt(game, s, 1), null);
  const up2 = y.jobs[0];
  assert.equal(speedup(game, s, up2.id, 'token'), 'No speed-up tokens left.');
  grantSpeedups(s.profile!, 3);
  const end0 = up2.end;
  assert.equal(speedup(game, s, up2.id, 'token'), null);
  assert.equal(end0 - up2.end, TOKEN_SECS * 1000, 'a quarter of an hour off');
  assert.equal(s.profile!.speedups, 2);
  // Tokens are capped.
  grantSpeedups(s.profile!, 1000);
  assert.equal(s.profile!.speedups, TOKEN_MAX);
  // The daily welcome grants them (and each daily order done).
  s.profile!.speedups = 0;
  game.directorOn = true;
  s.profile!.daily.day = dayOf(clock) - 1;
  assert.equal(dailyRollover(game, s), true);
  game.directorOn = false;
  assert.equal(s.profile!.speedups, TOKENS_LOGIN);
});

function has(h: { buildings: { id: string }[] }, id: string): boolean {
  return h.buildings.some((b) => b.id === id);
}

test('producers work while their owner is away, into a yard with a cap the warehouse widens', () => {
  const game = world();
  const { s, c } = owner(game);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  assert.equal(startBuild(game, s, 0, 'p:lumber'), null);
  assert.equal(speedup(game, s, y.jobs[0].id, 'silver'), null);
  assert.equal(capOf(h), yardCap(1, 0));
  // Five days away (the session gone): the yard stops at its cap, not beyond.
  game.sessions.delete(s);
  clock += 5 * 24 * HOUR;
  stepHoldings(game);
  for (let i = 0; i < 10; i++) game.step();
  reckonBase(game, h);
  assert.equal(y.res.timber, capOf(h), 'full, and no more');
  assert.ok(Object.values(y.res).every((n) => (n ?? 0) <= capOf(h)));
  // Back aboard: the view shows the producer idle, and the yield since the last look to collect.
  game.sessions.add(s);
  const v = baseView(game, s)!;
  assert.equal(v.cells[0].idle, true);
  assert.ok(v.cells[0].fresh > 0);
  assert.equal(v.store.find((r) => r.good === 'timber')!.n, capOf(h));
  assert.equal(collectYard(game, s), null);
  assert.ok(c.all('toast').some((t) => /Into the island’s yard/.test(t.msg)));
  assert.equal(baseView(game, s)!.cells[0].fresh, 0);
  // A warehouse widens the yard.
  const wide = yardCap(1, 1);
  assert.ok(wide > capOf(h));
  fill(game, s, 300);
  assert.equal(startBuild(game, s, 2, 'warehouse'), null);
  assert.equal(speedup(game, s, y.jobs[0].id, 'silver'), null);
  assert.equal(capOf(h), wide);
});

test('the yard pays for the work: resources spent, and wanting them the work is refused', () => {
  const game = world();
  const { s } = owner(game);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  const cost = baseCost('warehouse', 1);
  assert.ok(Object.keys(cost.goods).length >= 3, 'timber, stone and tar at the least');
  assert.match(startBuild(game, s, 3, 'warehouse')!, /The yard lacks/);
  for (const [g, n] of Object.entries(cost.goods)) y.res[g as 'timber'] = (n ?? 0) + 5;
  assert.equal(startBuild(game, s, 3, 'warehouse'), null);
  for (const g of Object.keys(cost.goods)) assert.equal(y.res[g as 'timber'], 5, `${g} spent`);
  // The island's store makes up what the yard lacks; the island's level-up takes from the yard too.
  y.jobs = [];
  h.buildings = [];
  y.res = { timber: 10 };
  h.store.timber = cost.goods.timber! - 10;
  for (const [g, n] of Object.entries(cost.goods)) if (g !== 'timber') h.store[g as 'coal'] = n;
  assert.equal(startBuild(game, s, 3, 'warehouse'), null);
  assert.equal(y.res.timber ?? 0, 0);
  assert.equal(h.store.timber ?? 0, 0);
  h.treasury = 10_000;
  y.res.planks = 60;
  assert.equal(isleLevelUp(game, s, h.island), null);
  assert.equal(h.level, 2);
  assert.equal(y.res.planks ?? 0, 0, 'the planks came from the yard');
});

test('one crew of builders; the second comes at the island level the data sets', () => {
  const game = world();
  const { s } = owner(game);
  const { h, y } = fill(game, s);
  assert.deepEqual(CREW_LEVELS.slice(0, 2), [1, 3]);
  assert.equal(crewsAt(1), 1);
  assert.equal(crewsAt(CREW_LEVELS[1]), 2);
  assert.equal(crewsAt(1, 1), 2, 'item 5 may add a crew');
  assert.equal(startBuild(game, s, 0, 'p:lumber'), null);
  assert.equal(startBuild(game, s, 1, 'p:fishery'), 'All your builders are at work.');
  h.level = CREW_LEVELS[1];
  assert.equal(startBuild(game, s, 1, 'p:fishery'), null);
  assert.equal(y.jobs.length, 2);
  assert.equal(baseView(game, s)!.crews.busy, 2);
  assert.equal(startBuild(game, s, 2, 'p:quarry'), 'All your builders are at work.');
  // Levels are gated by the island.
  clock += 10 * HOUR;
  reckonBase(game, h);
  h.level = 1;
  assert.equal(upgradeAt(game, s, 0), 'Raise the island to level 2 first.');
  h.level = 2;
  assert.equal(upgradeAt(game, s, 0), null);
});

test('a building moves to a free plot, and its work with it; not onto a taken one', () => {
  const game = world();
  const { s } = owner(game);
  const { h, y } = fill(game, s);
  h.buildings.push({ id: 'tavern', condition: 1, unpaid: false });
  const v = baseView(game, s)!;
  const at = v.cells.find((c) => c.what === 'tavern')!.plot;
  assert.equal(h.buildings[0].plot, at, 'an old building takes a plot');
  assert.equal(startBuild(game, s, 4, 'p:lumber'), null);
  assert.equal(moveTo(game, s, at, 4), 'That plot is taken.');
  assert.equal(moveTo(game, s, at, 5), null);
  assert.equal(h.buildings[0].plot, 5);
  assert.equal(moveTo(game, s, 4, 2), null, 'what is being raised moves too');
  assert.equal(y.jobs[0].plot, 2);
  assert.equal(moveTo(game, s, 2, 99), 'No such plot.');
  const v2 = baseView(game, s)!;
  assert.equal(v2.cells[5].what, 'tavern');
  assert.equal(v2.cells[2].what, 'p:lumber');
  assert.equal(v2.cells[at].what, null);
});

test('the numbers hold together: plots grow, every cost fits the yard at the level it opens, timers stay short', () => {
  for (let l = 1; l <= ISLE_MAX; l++) {
    assert.ok(BASE_PLOTS[l] >= ISLE_LEVELS[l].slots + 3, `plots at level ${l} leave room for producers`);
    if (l > 1) assert.ok(BASE_PLOTS[l] >= BASE_PLOTS[l - 1]);
    assert.ok(plotsOf(l, 'large') <= PLOT_CELLS.length);
  }
  assert.equal(new Set(PLOT_CELLS.map((c) => c.join())).size, PLOT_CELLS.length);
  const whats = [...PRODUCER_KINDS.map((k) => `p:${k}`), ...BUILDING_IDS];
  for (const w of whats) {
    for (let l = 1; l <= maxLevel(w); l++) {
      const c = baseCost(w, l);
      assert.ok(c.secs > 0 && c.secs <= BUILD_MAX_SECS, `${w} ${l} time`);
      assert.ok(c.silver > 0 && Number.isFinite(c.silver));
      // At the island level the step opens, without a warehouse (a warehouse raised to one below for its own steps).
      const cap = yardCap(l, w === 'warehouse' ? l - 1 : 0);
      for (const [g, n] of Object.entries(c.goods)) assert.ok((n ?? 0) <= cap, `${w} level ${l}: ${n} ${g} fits a yard of ${cap}`);
    }
  }
  assert.ok(baseCost('p:lumber', 1).silver <= 1000 && Object.keys(baseCost('p:lumber', 1).goods).length === 0, 'the first camp needs no timber');
  assert.ok(baseCost('p:lumber', PRODUCER_MAX).secs > baseCost('p:lumber', 1).secs * 10, 'a level takes longer');
  assert.ok(BUILDINGS.fort.cost * 0.5 === baseCost('fort', 1).silver);
  assert.ok(speedupSilver(3600) < 2000 && speedupSilver(3600) > 300, 'an hour for a few hundred silver');
  for (const k of PRODUCER_KINDS) assert.ok(PRODUCERS[k].rate * 3 < 40, 'no producer floods the sea');
});

test('both languages: every word of the base in English and Russian', () => {
  const table = { ...serverTable(), ...SERVER_RU_B };
  const said = extract().filter((p) => /yard|builders|plot|speed-up|Raise the island|keeps \{0\} of these|land does not bear|Your island:|Nothing stands|work is done|Into the island/.test(p));
  assert.ok(said.length >= 10, 'the base speaks');
  for (const p of said) assert.ok(table[p], `Russian for ${JSON.stringify(p)}`);
  for (const k of PRODUCER_KINDS) {
    assert.ok(/[а-я]/i.test(PRODUCERS[k].name[1]) && /[а-я]/i.test(PRODUCERS[k].text[1]));
    assert.ok(table[PRODUCERS[k].name[0]], `the server's word for ${k}`);
  }
  assert.deepEqual(Object.keys(BASE_RU).sort(), Object.keys(BASE_EN).sort());
  const ru = BASE_RU as Record<string, string>;
  for (const k of Object.keys(BASE_EN)) assert.ok(/[а-яё]/i.test(ru[k]), `${k} in Russian`);
  setLang('ru');
  try {
    assert.match(serverText('All your builders are at work.'), /[а-я]/i);
    assert.match(serverText('Raise the island to level 3 first.'), /3/);
    assert.match(serverText('The quarry on Gallows Key is finished.'), /Каменоломня|каменоломня/);
    assert.match(serverText('Tar Kiln on Gallows Key: level 2.'), /Смолокурня/);
  } finally {
    setLang('en');
  }
});
