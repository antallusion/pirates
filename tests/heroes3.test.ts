// docs/17 H3 — the Heroes' economy: the week and its name (its own dice, the sea's rng untouched), the ports'
// dwellings and the recruit window (the stacks, the hammocks, the slots, the resources of the higher tiers, the
// tavern's waterfront shared with the old hiring), training stacks up, the island's town (hall, keep, dwellings,
// market, guild) on the builders' timers, the mines and their flags (the landing, the dawn's pay, the raiders, another
// captain's flag), the admin's commands and every word in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../shared/src/data/army.ts';
import { DAY_LENGTH_SEC } from '../shared/src/constants.ts';
import { WEEKS, WEEK_DAYS, WEEK_KINDS, dayIndex, weekGrowth, weekKind, weekRng } from '../shared/src/data/week.ts';
import { GROWTH, HALL_INCOME, KEEP_GROWTH, MARKET_BUY, MARKET_GOODS, MARKET_SELL, PORT_MARKUP, TOWN, TOWN_IDS, UNIT_GOODS, portDwellings, recruitPrice, townCost, upgradePrice } from '../shared/src/data/town.ts';
import { FLAG_SECS, MINES, MINES_PER_REGION, RES_GOODS, buildMines, mineKindOf } from '../shared/src/data/mines.ts';
import { GOODS } from '../shared/src/data/goods.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { adminWeek, stepCalendar, thisWeek, today, weekNow } from '../server/src/game/calendar.ts';
import { dwellView, portPools, recruit, train } from '../server/src/game/dwell.ts';
import { buildTown, marketTrade, townState, townView } from '../server/src/game/town.ts';
import { baseView, reckonBase, speedup, yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { mineLandable, mineSites, mineState, minesDay, minesView, startFlag } from '../server/src/game/mines.ts';
import { stepLanding } from '../server/src/game/exploration.ts';
import { hireTrade } from '../server/src/game/crew.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { join, makeGame, onHull } from './helpers.ts';

let clock = 20_000 * 86_400_000;

function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  return game;
}

function captain(game: Game, name = 'Heroes Tester'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 2_000_000;
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

function offShore(game: Game, s: PlayerSession, is: Island): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2;
    const x = is.x + Math.sin(a) * (is.radius + 100), y = is.y - Math.cos(a) * (is.radius + 100);
    if (isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.state.speed = 0;
  ship.region = is.region;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

/** A captain with an island of her own, lying off it. */
function islander(game: Game, name = 'Town Builder'): { s: PlayerSession; home: Island } {
  const s = captain(game, name);
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  offShore(game, s, home);
  assert.equal(buyIsland(game, s, home.id), null);
  return { s, home };
}

const finishAll = (game: Game, s: PlayerSession) => {
  const h = ownIsland(game, s.accountId)!;
  for (const j of [...yardOf(game, h).jobs]) speedup(game, s, j.id, 'silver');
  reckonBase(game, h);
};

// ------------------------------------------------------------------------------------------------ 10. the week

test('the week: seven of the sea\'s days, dawning at six; named by its own dice, the same for the same week', () => {
  assert.equal(WEEK_DAYS, 7);
  assert.equal(dayIndex(0), 0);
  // The world's clock starts at 08:24 (timeOfDay's 0.35); the next day dawns at 06:00, 0.9 of a day on.
  assert.equal(dayIndex(0.9 * DAY_LENGTH_SEC - 1), 0);
  assert.equal(dayIndex(0.9 * DAY_LENGTH_SEC + 1), 1);
  for (let w = 0; w < 50; w++) assert.equal(weekKind(w), weekKind(w), 'replayed');
  assert.equal(weekRng(7).float(), weekRng(7).float());
  const seen = new Set<string>();
  for (let w = 0; w < 400; w++) seen.add(weekKind(w));
  assert.deepEqual([...seen].sort(), [...WEEK_KINDS].sort(), 'every kind of week comes');
  assert.equal(weekGrowth('marine', 2), 1.5);
  assert.equal(weekGrowth('marine', 3), 1);
  assert.equal(weekGrowth('fever', 5), 0.5);
  for (const k of WEEK_KINDS) assert.ok(WEEKS[k].name[1] && WEEKS[k].text[1], `${k} in Russian`);
});

test('the calendar never touches the sea\'s rng; /week next begins a week, cries it, and the mines pay each dawn', () => {
  const a = world(), b = world();
  const s = captain(a);
  captain(b);
  const w0 = thisWeek(a);
  stepCalendar(a);
  const c = a.sessionByName('Heroes Tester')!;
  const reply = adminWeek(a, 'next');
  assert.equal(thisWeek(a), w0 + 1);
  assert.equal(today(a) % WEEK_DAYS, 0, 'at the week\'s first dawn');
  assert.match(reply, /^Week \d+ begins: /);
  adminWeek(a, 'plenty');
  assert.equal(weekNow(a), 'plenty');
  stepCalendar(a);
  // The same number of draws from the sea's rng in both games: nothing of the calendar used it.
  assert.equal(a.rng.float(), b.rng.float());
  assert.ok(c === s);
  const msgs = (s as unknown as { conn: { inbox: { t: string; view?: unknown }[] } }).conn;
  void msgs;
});

// ------------------------------------------------------------------------------------------------ 11. dwellings

test('the ports keep dwellings by what they are: the tavern everywhere, barracks, guilds, foundries, dens, admiralties, shrines', () => {
  const game = world();
  const by = (id: string) => portDwellings(game.portById(id)!).map((d) => d.tier);
  assert.deepEqual(by('gravesend'), [1, 2, 3, 4, 6], 'the Crown\'s great port: all but the den and the shrine');
  assert.ok(by('cinderhold').includes(5) && by('cinderhold').includes(4), 'the Confederacy\'s: veterans and guns');
  assert.ok(by('saint_maw').includes(7), 'the Choir\'s: the drowned');
  assert.deepEqual(by('raft_0'), [1], 'a raft: its tavern only');
  for (const p of game.world.ports) assert.equal(portDwellings(p)[0].tier, 1, `${p.id} has its tavern`);
  const up = game.world.ports.filter((p) => portDwellings(p).some((d) => d.tier > 1 && d.up));
  assert.ok(up.length >= 5 && up.every((p) => p.key), 'the upgrade buildings are in the key ports');
});

test('recruiting in port: men into the stacks at a quarter over their worth, the pool drawn, hammocks and slots kept', () => {
  const game = world();
  const s = captain(game);
  const port = dockAt(game, s, 'gravesend');
  const ship = s.ship!;
  ship.setArmy([{ u: 'deckhand', n: 30 }]);
  const pool = portPools(game, port)[2];
  assert.ok(pool >= 9, `a week of marines in a great port (${pool})`);
  const gold = s.profile!.gold;
  assert.equal(recruit(game, s, 'port', 'marine', 5), null);
  assert.equal(ship.army.find((x) => x.u === 'marine')?.n, 5);
  assert.equal(s.profile!.gold, gold - Math.round(5 * UNITS.marine.cost * PORT_MARKUP));
  assert.equal(portPools(game, port)[2], pool - 5);
  assert.equal(s.profile!.company.pools.marine >= 5, true, 'counted with the marines of the company');
  // Gunners ask powder and iron: the hold must carry them.
  assert.match(recruit(game, s, 'port', 'gunner', 4) ?? '', /The hold lacks/);
  ship.cargo.gunpowder = 10;
  ship.cargo.iron = 10;
  assert.equal(recruit(game, s, 'port', 'gunner', 4), null);
  assert.equal(ship.cargo.gunpowder, 10 - Math.ceil(4 * UNIT_GOODS.gunner!.gunpowder!));
  // The hammocks: no more than crewMax.
  const room = ship.stats.crewMax - ship.crew;
  s.profile!.gold = 1e9;
  ship.cargo.gunpowder = 1000;
  recruit(game, s, 'port', 'musketeer', 10_000);
  assert.ok(ship.crew <= ship.stats.crewMax && ship.crew >= ship.stats.crewMax - room, 'the hammocks are the limit');
  // The slots: a full army takes no new kind.
  ship.setArmy([{ u: 'deckhand', n: 5 }, { u: 'marine', n: 5 }, { u: 'musketeer', n: 5 }, { u: 'gunner', n: 5 }, { u: 'boarder', n: 5 }, { u: 'sailor', n: 5 }]);
  assert.equal(ship.army.length, ship.armySlots);
  assert.match(recruit(game, s, 'port', 'sea_guard', 1) ?? '', /No free slot/);
  // No shrine in Gravesend; the drowned only for the Choir and the cursed.
  assert.match(recruit(game, s, 'port', 'drowned', 1) ?? '', /No dwelling/);
});

test('the tavern\'s waterfront is the first tier\'s dwelling: the old hiring and the window draw on one pool', () => {
  const game = world();
  const s = captain(game);
  const port = dockAt(game, s, 'blackwater');
  s.ship!.setArmy([{ u: 'deckhand', n: 20 }]);
  game.tavernCrew.set(port.id, 30);
  assert.equal(hireTrade(game, s, port, 'sailor', 5), null, 'the tavern still hires');
  assert.equal(game.tavernCrew.get(port.id), 25);
  const v = dwellView(game, s, 'port')!;
  assert.equal(v.rows[0].name, 'tavern');
  assert.equal(v.rows[0].pool, 25);
  assert.equal(recruit(game, s, 'port', 'deckhand', 10), null);
  assert.equal(game.tavernCrew.get(port.id), 15);
  assert.equal(s.ship!.crew, 35);
});

test('training up: the upgraded dwelling trains a stack for the difference in price', () => {
  const game = world();
  const s = captain(game);
  dockAt(game, s, 'gravesend');
  const ship = s.ship!;
  ship.setArmy([{ u: 'deckhand', n: 20 }, { u: 'musketeer', n: 8 }]);
  ship.cargo.gunpowder = 10;
  const gold = s.profile!.gold;
  const p = upgradePrice('musketeer', 8, true)!;
  assert.equal(p.silver, Math.round(8 * (UNITS.sharpshooter.cost - UNITS.musketeer.cost) * PORT_MARKUP));
  assert.equal(train(game, s, 'port', 'musketeer', 8), null);
  assert.equal(ship.army.find((x) => x.u === 'sharpshooter')?.n, 8);
  assert.ok(!ship.army.some((x) => x.u === 'musketeer'));
  assert.equal(s.profile!.gold, gold - p.silver);
  assert.equal(ship.crew, 28, 'the same men');
  // A village's dwelling does not train.
  const t = captain(game, 'Village Tester');
  dockAt(game, t, 'saltmarrow');
  t.ship!.setArmy([{ u: 'deckhand', n: 10 }, { u: 'marine', n: 4 }]);
  assert.match(train(game, t, 'port', 'marine', 4) ?? '', /upgraded dwelling/);
});

test('prices: a man costs his worth (a quarter more in port); the higher tiers ask powder, iron, rum and pearls', () => {
  assert.deepEqual(recruitPrice('deckhand', 10, false), { silver: 200, goods: {} });
  assert.deepEqual(recruitPrice('marine', 4, true), { silver: 300, goods: {} });
  assert.deepEqual(recruitPrice('gunner', 3, false).goods, { gunpowder: 2, iron: 1 });
  assert.deepEqual(recruitPrice('guard', 5, false).goods, { pearls: 1 });
  assert.deepEqual(recruitPrice('drowned', 2, false).goods, { pearls: 1 });
  for (const u of Object.keys(UNIT_GOODS)) for (const g of Object.keys(UNIT_GOODS[u as keyof typeof UNIT_GOODS]!)) assert.ok(RES_GOODS.includes(g as never), `${u} asks one of the seven resources`);
});

// ------------------------------------------------------------------------------------------------ 13. the town

test('the island\'s town: hall, keep, dwellings on the builders\' timers; growth by the keep; the hall pays each dawn', () => {
  const game = world();
  const { s } = islander(game);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  for (const g of [...RES_GOODS, 'coal']) y.res[g as 'timber'] = 5000;
  assert.match(buildTown(game, s, 'dw1') ?? '', /Build the keep first/);
  assert.equal(buildTown(game, s, 'hall'), null);
  assert.ok(y.jobs.some((j) => j.what === 't:hall' && j.plot === -1), 'a job of the yard with no plot');
  finishAll(game, s);
  assert.equal(townState(y).b.hall, 1);
  assert.equal(buildTown(game, s, 'keep'), null);
  finishAll(game, s);
  assert.equal(buildTown(game, s, 'dw1'), null);
  finishAll(game, s);
  // Island level 1: the second tier waits for the island.
  assert.equal(h.level ?? 1, 1);
  assert.match(buildTown(game, s, 'dw2') ?? '', /Raise the island to level 2/);
  h.level = 6;
  assert.equal(buildTown(game, s, 'dw2'), null, 'the second tier at island level 2');
  finishAll(game, s);
  const t = townState(y);
  assert.equal(t.b.dw1, 1);
  assert.equal(Math.floor(t.pool[1]), GROWTH[1] * (weekGrowth(weekNow(game), 1)), 'a new dwelling opens with a week\'s men');
  // The dawn: the hall's silver into the treasury.
  const before = h.treasury;
  adminWeek(game, 'deckhand');
  const d0 = today(game);
  (game as unknown as { now: number }).now += DAY_LENGTH_SEC;
  stepCalendar(game);
  assert.ok(today(game) > d0);
  assert.equal(h.treasury, before + HALL_INCOME[1] * (today(game) - d0));
  // The keep's walls: a castle twice the growth.
  t.b.keep = 3;
  const v = townView(game, s, h, y);
  assert.equal(v.growthMul, KEEP_GROWTH[3]);
  assert.equal(v.things.find((x) => x.id === 'dw1')!.growth, GROWTH[1] * 2 * weekGrowth(weekNow(game), 1));
  // Next week: the pools grow, and keep no more than two weeks.
  const p0 = t.pool[1];
  adminWeek(game, 'next');
  townView(game, s, h, y);
  assert.ok(t.pool[1] > p0);
  for (let k = 0; k < 4; k++) adminWeek(game, 'next');
  townView(game, s, h, y);
  assert.ok(t.pool[1] <= 2 * GROWTH[1] * 2 * 1.5 + 1e-6, `two weeks at most (${t.pool[1]})`);
  // The base's view carries the town; the town's levels count to the island's power.
  const bv = baseView(game, s)!;
  assert.ok(bv.town && bv.town.things.length === TOWN_IDS.length);
});

test('recruiting from the island: lying off it, into the stacks at their worth; the drowned only for the Choir and the cursed', () => {
  const game = world();
  const { s, home } = islander(game);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  const t = townState(y);
  t.b = { hall: 1, keep: 1, dw1: 2, dw2: 1, dw7: 1 };
  t.w = thisWeek(game);
  t.pool = [0, 20, 9, 0, 0, 0, 0, 2];
  s.ship!.setArmy([{ u: 'deckhand', n: 10 }]);
  const gold = s.profile!.gold;
  assert.equal(recruit(game, s, 'isle', 'marine', 4), null);
  assert.equal(s.profile!.gold, gold - 4 * UNITS.marine.cost, 'no port\'s markup at one\'s own dwelling');
  assert.equal(recruit(game, s, 'isle', 'sailor', 3), null, 'the upgraded dwelling offers the upgrade');
  assert.match(recruit(game, s, 'isle', 'sea_guard', 1) ?? '', /upgraded dwelling/);
  assert.match(recruit(game, s, 'isle', 'drowned', 1) ?? '', /Choir/);
  s.ship!.curse = 60;
  y.res.pearls = 10;
  assert.equal(recruit(game, s, 'isle', 'drowned', 2), null);
  // Away from the island: the men wait.
  s.ship!.state.x += 20_000;
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  assert.match(recruit(game, s, 'isle', 'deckhand', 1) ?? '', /Bring your ship/);
  void home;
});

test('the market trades at poor rates: it pays less than the cheapest port and asks more than most', () => {
  const game = world();
  const { s } = islander(game);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  assert.match(marketTrade(game, s, 'silver', 'timber', 1000) ?? '', /no market/);
  townState(y).b.market = 1;
  y.res.timber = 100;
  const gold = s.profile!.gold;
  assert.equal(marketTrade(game, s, 'timber', 'silver', 100), null);
  assert.equal(s.profile!.gold, gold + Math.floor(100 * GOODS.timber.basePrice * MARKET_SELL[1] * (weekNow(game) === 'fair' ? 1.15 : 1)));
  assert.equal(marketTrade(game, s, 'silver', 'pearls', 5000), null);
  assert.ok((y.res.pearls ?? 0) >= 1);
  for (let L = 1; L <= 3; L++) {
    assert.ok(MARKET_SELL[L] * 1.15 < 0.35, 'it pays under the cheapest port (0.35 of the base) even at a fair');
    assert.ok(MARKET_BUY[L] * 0.85 > 2, 'it asks more than twice the base price even at a fair');
  }
  for (const g of MARKET_GOODS) assert.ok(GOODS[g], g);
});

test('town data: every building named in both languages at every level, its art on the sheet, costs rising', () => {
  for (const id of TOWN_IDS) {
    const d = TOWN[id];
    assert.equal(d.names.length, d.max, id);
    for (const n of d.names) assert.ok(n[0] && n[1] && !/[a-z]/i.test(n[1]), `${id}: ${n[0]}`);
    assert.ok(d.text[1] && /[а-я]/i.test(d.text[1]));
    for (let L = 2; L <= d.max; L++) assert.ok(townCost(id, L).silver > townCost(id, L - 1).silver, `${id} ${L}`);
  }
  assert.ok(townCost('dw7', 1).goods.pearls! > 0 && townCost('dw4', 1).goods.gunpowder! > 0, 'the higher dwellings ask the rare resources');
});

// ------------------------------------------------------------------------------------------------ 12. the mines

test('the mines: six to a region (none in the Abyss), on wild islands, by what lies ashore', () => {
  const game = world();
  const sites = buildMines(game.world);
  const regions = new Set(sites.map((x) => x.region));
  assert.ok(!regions.has('the_abyss'));
  for (const r of regions) assert.ok(sites.filter((x) => x.region === r).length <= MINES_PER_REGION);
  assert.ok(sites.length >= 30, `${sites.length} mines`);
  assert.equal(new Set(sites.map((x) => x.kind)).size, 7, 'all seven resources are mined');
  for (const x of sites) {
    const is = game.world.islands[x.islandId];
    assert.ok(!is.portId && !is.minor && !is.raft);
    assert.equal(mineKindOf(is), x.kind);
  }
  assert.deepEqual(buildMines(game.world), sites, 'fixed by the world');
});

test('a flag on a mine: a short landing takes it; each dawn it pays the island; the raiders and another captain take it', () => {
  const game = world();
  const { s } = islander(game);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  s.ship!.setArmy([{ u: 'deckhand', n: 50 }, { u: 'marine', n: 20 }]);
  const x = mineSites(game).find((m) => REGIONS[m.region].safety === 'contested' && m.kind !== 'silver' && mineState(game, m.id).owner === undefined)!;
  offShore(game, s, game.world.islands[x.islandId]);
  const l = mineLandable(game, s);
  assert.ok(l && /plant your flag/.test(l.feature), JSON.stringify(l));
  assert.equal(startFlag(game, s), null);
  assert.equal(s.ship!.landing?.feature, 'flag');
  (game as unknown as { now: number }).now += FLAG_SECS + 1;
  stepLanding(game, s.ship!);
  assert.equal(mineState(game, x.id).owner, s.accountId);
  assert.ok(minesView(game, s).some((m) => m.id === x.id && m.holder === 'you'), 'on her chart');
  // A dawn: the goods into the island's yard.
  const before = y.res[x.kind as 'timber'] ?? 0;
  minesDay(game, 1, false);
  minesDay(game, 2, false);
  assert.ok((y.res[x.kind as 'timber'] ?? 0) > before, 'paid into the yard');
  // Another captain's flag over it (once the first flag has stood its while).
  const t = captain(game, 'Flag Thief');
  t.ship!.setArmy([{ u: 'deckhand', n: 40 }]);
  offShore(game, t, game.world.islands[x.islandId]);
  assert.match(startFlag(game, t) ?? '', /only minutes ago/);
  (game as unknown as { now: number }).now += 700;
  assert.equal(startFlag(game, t), null);
  (game as unknown as { now: number }).now += FLAG_SECS + 1;
  stepLanding(game, t.ship!);
  assert.equal(mineState(game, x.id).owner, t.accountId);
  // The raiders: some day they come (the mine's own dice).
  let day = 3;
  while (mineState(game, x.id).owner === t.accountId && day < 3000) minesDay(game, day++);
  assert.equal(mineState(game, x.id).owner, -1, 'the raiders took it');
  // Beating them ashore costs men.
  offShore(game, s, game.world.islands[x.islandId]);
  const men = s.ship!.crew;
  assert.equal(startFlag(game, s), null);
  (game as unknown as { now: number }).now += FLAG_SECS + 1;
  stepLanding(game, s.ship!);
  assert.equal(mineState(game, x.id).owner, s.accountId);
  assert.ok(s.ship!.crew < men, 'some of the party fell');
});

test('a captain without an island: the yield piles at the mine and her boats haul it aboard', () => {
  const game = world();
  const s = captain(game, 'No Island');
  s.ship!.setArmy([{ u: 'deckhand', n: 60 }]);
  const x = mineSites(game).find((m) => m.kind === 'silver' && mineState(game, m.id).owner === undefined)!;
  offShore(game, s, game.world.islands[x.islandId]);
  assert.equal(startFlag(game, s), null);
  (game as unknown as { now: number }).now += FLAG_SECS + 1;
  stepLanding(game, s.ship!);
  for (let d = 0; d < 3; d++) minesDay(game, 10 + d, false);
  const pile = mineState(game, x.id).stock?.silver ?? 0;
  assert.ok(pile > 0, 'piled up');
  assert.match(mineLandable(game, s)?.feature ?? '', /your pile/);
  const gold = s.profile!.gold;
  assert.equal(startFlag(game, s), null);
  (game as unknown as { now: number }).now += FLAG_SECS + 1;
  stepLanding(game, s.ship!);
  assert.equal(s.profile!.gold, gold + pile);
});

// ------------------------------------------------------------------------------------------------ the admin, the words

test('the admin: /week next|now|kind, /dwell [fill], /mine, /res, /town; the Russian HELP is the English command for command', () => {
  const game = world();
  const { s } = islander(game);
  dockAt(game, s, 'gravesend');
  assert.match(runAdmin(game, s, '/week next')!, /^Week \d+ begins/);
  assert.match(runAdmin(game, s, '/week marine')!, /Week of the Marine/);
  assert.match(runAdmin(game, s, '/week now')!, /^Week \d+, day \d/);
  assert.match(runAdmin(game, s, '/dwell fill')!, /are full/);
  assert.match(runAdmin(game, s, '/dwell')!, /^Dwellings — Port Gravesend/);
  assert.match(runAdmin(game, s, '/res 20')!, /20 of each resource/);
  assert.equal(s.ship!.cargo.pearls, 20);
  assert.match(runAdmin(game, s, '/town')!, /^Town raised/);
  assert.match(runAdmin(game, s, '/mine')!, /^Mines: \d+/);
  assert.match(runAdmin(game, s, '/mine take')!, /is now yours/);
  const help = runAdmin(game, s, '/help')!;
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru, 'the HELP has its Russian twin');
  const cmds = (x: string) => [...x.matchAll(/\/[a-z]+/g)].map((m) => m[0]);
  assert.deepEqual(cmds(ru), cmds(help), 'command for command');
  for (const c of ['/week', '/dwell', '/mine', '/res', '/town']) assert.ok(cmds(help).includes(c), c);
});

test('every sentence of the Heroes\' economy reads in Russian, with no English left', () => {
  const table = serverTable();
  const mine = extract('server/src/game').filter((p) => /mine|flag|dwelling|Week |market|keep|raiders|trained|sign on|pile|Town raised|resource|hammock|Choir/i.test(p));
  const missing = mine.filter((p) => table[p] === undefined);
  assert.ok(missing.length <= 12, `untranslated: ${JSON.stringify(missing)}`);
  setLang('ru');
  applyDataLocale('ru');
  try {
    const lines = [
      'Week 12 begins: Week of the Marine. Marines and sea guards grow half as many again.',
      '5 marines sign on for 375 silver.',
      'Your flag flies over the pearl bed on Grey Hollow: 1 pearls a day.',
      'City Hall rises on Grey Hollow.',
      'The market pays 60 silver for 100 timber.',
      'silver mine (held by raiders, 14 men)',
    ];
    for (const l of lines) {
      const r = serverText(l);
      assert.notEqual(r, l, l);
      assert.ok(!/\b(Week|of the|sign on|silver|flag|rises|market|raiders|timber|pearl|mine)\b/.test(r), `${l} → ${r}`);
    }
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});
