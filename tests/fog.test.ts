// The fog of war and the island's scouts (owner, 2026-10-17: «туман войны … на личном острове в верфи можно строить
// специальные разведовательные корабли … разведку надо сделать беслпатной»): the bits and their base64, a save from
// before the fog given what she knew, the sea cleared by her ship, her island (by its hall) and her scouts; scouts free,
// by the shipyard's level, sailing by the wall clock out and home, «авто» from fog to fog, recalled, swept on her
// return, the bot's word; the charts hide what the fog covers; a course into the fog still sails; the cost of a tick.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOG_BYTES, FOG_CELL, FOG_CELLS, SCOUT_BUILD_SECS, SCOUT_SPEED, START_SIGHT, cellMid, courseAt, courseLength, fogCell, fogCount, fogDecode, fogDisc, fogEncode, fogHas, fogNearest,
  fogSeen, isleSight, newFog, scoutLimit,
} from '../shared/src/data/fog.ts';
import { TG_TEXTS } from '../shared/src/data/telegram.ts';
import { BASE_RES } from '../shared/src/data/base.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import {
  fogFlush, fogInit, fogReset, fogSecond, fogState, homeOf, knownSea, scoutAuto, scoutBuild, scoutRecall, scoutSend, scoutsView, stepScoutNotices, stepScouts,
} from '../server/src/game/fog.ts';
import type { Holding } from '../server/src/game/holdings.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { autosailOf } from '../server/src/game/autosail.ts';
import { visibleOnChart } from '../client/src/render/fog.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

let clock = 20_000 * 86_400_000;

function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  return game;
}

function offShore(game: Game, s: PlayerSession, is: Island): void {
  const ship = s.ship!;
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

function captain(game: Game, name: string): { s: PlayerSession; conn: FakeConn } {
  const conn = join(game, name, 'admiral');
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  return { s, conn };
}

function owner(game: Game, name = 'Fog Mistress', yard = 1): { s: PlayerSession; conn: FakeConn; home: Island; h: Holding } {
  const { s, conn } = captain(game, name);
  s.profile!.gold = 1_000_000;
  const taken = new Set(Object.values(game.holdings.map(game)).map((h) => h.island));
  const home = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && i.radius > 150 && !taken.has(i.id) && !lairIsland(game, i.id))!;
  offShore(game, s, home);
  assert.equal(buyIsland(game, s, home.id), null);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  for (const g of BASE_RES) y.res[g] = 10_000;
  if (yard) h.buildings.push({ id: 'shipyard', condition: 1, unpaid: false, level: yard });
  return { s, conn, home, h };
}

/** The sea's far side from her: a square of open water in the fog, `km` away from her island. */
function fogTarget(game: Game, s: PlayerSession, from: { x: number; y: number }, km: number): { x: number; y: number } {
  const bits = fogState(game, s).bits;
  for (let a = 0; a < 64; a++) {
    const ang = (a / 64) * Math.PI * 2;
    const x = from.x + Math.cos(ang) * km * 1000, y = from.y + Math.sin(ang) * km * 1000;
    if (x < 4000 || y < 4000 || x > 92_000 || y > 92_000) continue;
    if (isLand(game.world, x, y) || fogSeen(bits, x, y)) continue;
    return { x, y };
  }
  throw new Error('no fogged water');
}

test('the bits: a disc, base64 both ways, nearest fog, a few KB a captain', () => {
  assert.equal(FOG_CELLS, 96 * 96);
  assert.equal(FOG_BYTES, 1152);
  const b = newFog();
  const out: number[] = [];
  const n = fogDisc(b, 50_500, 40_500, 2400, out);
  assert.equal(n, out.length);
  assert.ok(n >= 17 && n <= 25, `${n} squares in a 2.4 km disc`);
  assert.ok(fogSeen(b, 50_500, 40_500) && fogSeen(b, 52_400, 40_500) && !fogSeen(b, 54_000, 40_500));
  assert.equal(fogDisc(b, 50_500, 40_500, 2400), 0, 'seen once only');
  const s = fogEncode(b);
  assert.ok(s.length <= 1540, `${s.length} chars`);
  assert.deepEqual([...fogDecode(s)], [...b]);
  assert.equal(fogCount(fogDecode(s)), n);
  assert.equal(fogCount(fogDecode('!!garbage')), 0, 'a broken copy gives nothing, never throws');
  assert.equal(fogCount(fogDecode(undefined)), 0);
  const near = fogNearest(b, 50_500, 40_500, 10_000, 3);
  assert.equal(near.length, 3);
  for (const i of near) assert.ok(!fogHas(b, i));
  const [mx, my] = cellMid(near[0]);
  assert.ok(Math.hypot(mx - 50_500, my - 40_500) <= 3500);
  assert.equal(fogCell(-1, 5), -1);
  const c = [0, 0, 300, 0, 300, 400];
  assert.equal(courseLength(c), 700);
  assert.deepEqual([courseAt(c, 500).x, courseAt(c, 500).y], [300, 200]);
});

test('scouts a shipyard keeps: 1 at the first level, 2 at the third, 3 at the fifth', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(scoutLimit), [0, 1, 1, 2, 2, 3]);
  assert.ok(isleSight(5, { lighthouse: true, signal: true, chart: true }) > isleSight(3) && isleSight(3) > isleSight(1));
  for (const [en, ru] of [TG_TEXTS['n.scout']]) {
    assert.ok(en.includes('{name}') && ru.includes('{name}'));
    assert.doesNotMatch(ru, /[A-Za-z]{3,}(?![^{]*\})/, 'the Russian has no Latin');
  }
});

test('a new captain starts with her port’s waters seen, the whole fog sent at the start, compact', () => {
  const game = world();
  const { s, conn } = captain(game, 'New Hand');
  const p = s.profile!;
  const port = game.portById(p.lastPort)!;
  const init = conn.all('fog').find((m) => m.all);
  assert.ok(init?.all, 'the whole fog at the start');
  const bits = fogDecode(init!.all!);
  assert.ok(fogSeen(bits, port.x, port.y) && fogSeen(bits, port.x + START_SIGHT * 0.8, port.y));
  assert.ok(!fogSeen(bits, port.x + 30_000, port.y) || port.x + 30_000 > 96_000);
  assert.equal(typeof p.fog, 'string');
  assert.ok(p.fog!.length < 2048, 'a few KB at most');
});

test('a save from before the fog: every island on her chart, every port she put in at, her lookouts, her ship', () => {
  const game = world();
  const { s } = captain(game, 'Old Salt');
  const p = s.profile!;
  const far = game.world.islands.filter((i) => !i.minor && !i.hidden).slice(40, 43);
  const port = game.world.ports[7];
  p.discovered = far.map((i) => i.id);
  p.regionsSeen.push(`visited:${port.id}`);
  const look = game.world.islands[123];
  p.isles = { lookouts: { [look.id]: 1 }, tides: {} };
  const bits = knownSea(game, s);
  for (const is of far) assert.ok(fogSeen(bits, is.x, is.y), `island ${is.id}`);
  assert.ok(fogSeen(bits, port.x, port.y));
  assert.ok(fogSeen(bits, look.x + 3000, look.y) || look.x + 3000 > 95_000);
  assert.ok(fogSeen(bits, s.ship!.state.x, s.ship!.state.y));
  // Run on her start: the fog made once and kept; never less than she knew.
  delete p.fog;
  fogReset(s);
  const st = fogState(game, s);
  for (const is of far) assert.ok(fogSeen(st.bits, is.x, is.y));
  assert.equal(typeof p.fog, 'string');
});

test('her ship clears the sea as she sails; the client is told the new squares only', () => {
  const game = world();
  const { s, conn } = captain(game, 'Lookout');
  const ship = s.ship!;
  ship.docked = null;
  fogFlush(game, s);
  const before = fogCount(fogState(game, s).bits);
  // somewhere far in the fog, on open water
  let x = 60_000, y = 30_000;
  for (let k = 0; isLand(game.world, x, y) && k < 50; k++) x += 700;
  assert.ok(!fogSeen(fogState(game, s).bits, x, y));
  ship.state.x = x;
  ship.state.y = y;
  game.grid.upsert(ship.id, x, y);
  conn.inbox.length = 0;
  fogSecond(game, s);
  assert.ok(fogSeen(fogState(game, s).bits, x, y));
  const add = conn.all('fog').flatMap((m) => m.add ?? []);
  assert.ok(add.length >= 9, `${add.length} new squares told`);
  assert.equal(fogCount(fogState(game, s).bits), before + add.length);
  conn.inbox.length = 0;
  fogSecond(game, s);
  assert.equal(conn.all('fog').length, 0, 'nothing new: nothing sent');
  // the profile's copy follows (a save)
  fogFlush(game, s);
  assert.ok(fogSeen(fogDecode(s.profile!.fog), x, y));
});

test('a charted island’s waters leave the fog (a bought chart, a lookout, a star fix)', () => {
  const game = world();
  const { s } = captain(game, 'Chart Buyer');
  const is = game.world.islands.find((i) => !i.minor && !i.hidden && !s.discovered.has(i.id) && !fogSeen(fogState(game, s).bits, i.x, i.y))!;
  game.chartIsland(s, is);
  assert.ok(fogSeen(fogState(game, s).bits, is.x, is.y));
});

test('her island keeps its waters clear, farther with a higher hall', () => {
  const game = world();
  const { s, home, h } = owner(game, 'Hall Keeper', 0);
  const r1 = homeOf(game, s)!.sight;
  assert.equal(r1, isleSight(1));
  fogInit(game, s);
  const bits = fogState(game, s).bits;
  assert.ok(fogSeen(bits, home.x + r1 - 600, home.y) || home.x + r1 > 95_000);
  // the hall at 4: a wider reach, cleared within ten seconds
  yardOf(game, h).town!.b.hall = 4;
  const r4 = homeOf(game, s)!.sight;
  assert.ok(r4 >= r1 + 3000);
  game.tick = 0;
  fogSecond(game, s);
  const far = [home.x + r4 - 600, home.x - r4 + 600].find((x) => x > 1000 && x < 95_000)!;
  assert.ok(fogSeen(fogState(game, s).bits, far, home.y), 'the hall’s reach seen');
  // and the islands within it are on her chart
  const inReach = game.world.islands.filter((i) => !i.minor && !i.hidden && Math.hypot(i.x - home.x, i.y - home.y) < r4 - 800);
  assert.ok(inReach.length > 0);
  for (const i of inReach) assert.ok(s.discovered.has(i.id), `island ${i.id} charted`);
});

test('a scout is built for nothing, by the shipyard’s limits', () => {
  const game = world();
  const { s, h } = owner(game, 'Free Builder', 1);
  const gold = s.profile!.gold;
  const res = { ...yardOf(game, h).res };
  assert.equal(scoutBuild(game, s), null);
  assert.equal(s.profile!.gold, gold, 'no silver');
  assert.deepEqual(yardOf(game, h).res, res, 'no goods');
  assert.equal(scoutsView(game, s).list[0].state, 'building');
  clock += SCOUT_BUILD_SECS * 1000 + 1;
  assert.equal(scoutsView(game, s).list[0].state, 'home');
  assert.match(scoutBuild(game, s)!, /keeps 1 scouts/);
  h.buildings.find((b) => b.id === 'shipyard')!.level = 3;
  assert.equal(scoutBuild(game, s), null);
  assert.match(scoutBuild(game, s)!, /keeps 2 scouts|on the slipway/);
  clock += SCOUT_BUILD_SECS * 1000 + 1;
  assert.match(scoutBuild(game, s)!, /keeps 2 scouts/);
  h.buildings.find((b) => b.id === 'shipyard')!.level = 5;
  assert.equal(scoutBuild(game, s), null);
  clock += SCOUT_BUILD_SECS * 1000 + 1;
  assert.match(scoutBuild(game, s)!, /keeps 3 scouts/);
  assert.equal(scoutsView(game, s).list.length, 3);
  assert.equal(scoutsView(game, s).max, 3);
  // without a shipyard, or an island, none
  const { s: s2 } = owner(game, 'No Yard', 0);
  assert.match(scoutBuild(game, s2)!, /shipyard/);
  const { s: s3 } = captain(game, 'No Island');
  assert.match(scoutBuild(game, s3)!, /island/);
});

test('sent into the fog she sails out and home by the wall clock, clearing her course; the toast; the bot’s due', () => {
  const game = world();
  const { s, conn, home } = owner(game, 'Scout Mother', 1);
  fogInit(game, s);
  assert.equal(scoutBuild(game, s), null);
  const id = scoutsView(game, s).list[0].id;
  assert.match(scoutSend(game, s, id, home.x, home.y)!, /slipway/);
  clock += SCOUT_BUILD_SECS * 1000 + 1;
  const t = fogTarget(game, s, home, 12);
  assert.match(scoutSend(game, s, id, home.x + 60_000, home.y)!, /far|maelstrom/);
  assert.equal(scoutSend(game, s, id, t.x, t.y), null);
  const v = scoutsView(game, s).list[0];
  assert.equal(v.state, 'out');
  assert.ok(v.route!.length >= 4 && v.total! > 20_000 && v.back! > 10_000 && v.back! < v.total!);
  assert.match(scoutSend(game, s, id, t.x, t.y)!, /at sea/);
  assert.ok((game.db.getKv<Record<string, number[]>>('scout:due') ?? {})[s.accountId]?.length === 1, 'the bot knows when she is due');
  const seen0 = fogCount(fogState(game, s).bits);
  // halfway out: the course so far swept
  clock += (v.back! / SCOUT_SPEED / 2) * 1000;
  stepScouts(game, s, true);
  const seen1 = fogCount(fogState(game, s).bits);
  assert.ok(seen1 > seen0 + 10, `${seen1 - seen0} squares halfway`);
  assert.ok(!fogSeen(fogState(game, s).bits, t.x, t.y), 'not there yet');
  // home
  conn.inbox.length = 0;
  clock += (v.total! / SCOUT_SPEED) * 1000;
  stepScouts(game, s, true);
  assert.ok(fogSeen(fogState(game, s).bits, t.x, t.y), 'her point seen');
  assert.equal(scoutsView(game, s).list[0].state, 'home');
  const toast = conn.all('toast').find((m) => /scout .* is home/.test(m.msg));
  assert.ok(toast, 'the toast');
  setLang('ru');
  try {
    assert.match(serverText(toast!.msg), /^Разведчик .* вернулся/);
    assert.doesNotMatch(serverText('No fog is left within a scout’s reach.'), /[A-Za-z]{3}/);
  } finally {
    setLang('en');
  }
  assert.equal((game.db.getKv<Record<string, number[]>>('scout:due') ?? {})[s.accountId], undefined, 'nothing left for the bot');
  assert.ok(conn.all('scouts').length >= 1);
});

test('«авто»: the nearest fog, then the next, as far as her reach, and home; recalled she turns at once', () => {
  const game = world();
  const { s, home } = owner(game, 'Auto Scout', 3);
  fogInit(game, s);
  scoutBuild(game, s);
  clock += SCOUT_BUILD_SECS * 1000 + 1;
  scoutBuild(game, s);
  clock += SCOUT_BUILD_SECS * 1000 + 1;
  const [a, b] = scoutsView(game, s).list.map((x) => x.id);
  const t0 = performance.now();
  assert.equal(scoutAuto(game, s, a), null);
  const ms = performance.now() - t0;
  assert.ok(ms < 400, `planned in ${ms.toFixed(0)} ms`);
  const v = scoutsView(game, s).list[0];
  assert.ok(v.auto && v.route!.length >= 8, `${v.route!.length / 2} points`);
  const seen0 = fogCount(fogState(game, s).bits);
  clock += (v.total! / SCOUT_SPEED) * 1000 + 1000;
  stepScouts(game, s, true);
  const got = fogCount(fogState(game, s).bits) - seen0;
  assert.ok(got >= 60, `${got} squares on an auto voyage`);
  // the next voyage goes on into new fog
  assert.equal(scoutAuto(game, s, a), null);
  // recall: from where she is, straight home
  const t = fogTarget(game, s, home, 14);
  assert.equal(scoutSend(game, s, b, t.x, t.y), null);
  const vb = scoutsView(game, s).list[1];
  clock += (vb.back! / SCOUT_SPEED / 3) * 1000;
  assert.equal(scoutRecall(game, s, b), null);
  const r = scoutsView(game, s).list[1];
  assert.equal(r.back, 0);
  assert.ok(r.total! < vb.total! * 0.6, 'the way home is shorter than the voyage left');
  assert.match(scoutRecall(game, s, b)!, /home already/);
  clock += (r.total! / SCOUT_SPEED) * 1000 + 1000;
  stepScouts(game, s, true);
  assert.equal(scoutsView(game, s).list[1].state, 'home');
});

test('a voyage run while she was away is swept on her return; the bot tells her once', () => {
  const game = world();
  const { s, home, conn } = owner(game, 'Away Scout', 1);
  fogInit(game, s);
  scoutBuild(game, s);
  clock += SCOUT_BUILD_SECS * 1000 + 1;
  const id = scoutsView(game, s).list[0].id;
  const t = fogTarget(game, s, home, 10);
  assert.equal(scoutSend(game, s, id, t.x, t.y), null);
  const total = scoutsView(game, s).list[0].total!;
  // she goes away: the profile keeps the scout; the voyage ends while she is gone
  game.saveSession(s);
  const saved = JSON.parse(JSON.stringify(s.profile!.scouts));
  assert.equal(saved[0].route.length >= 4, true);
  conn.close();
  steps(game, 2);
  clock += (total / SCOUT_SPEED) * 1000 + 5000;
  stepScoutNotices(game);
  assert.equal(game.db.getKv<Record<string, number[]>>('scout:due')?.[s.accountId], undefined, 'the bot’s word given');
  // back aboard: the voyage swept, the point seen
  const s2 = { ...s } as PlayerSession;
  void s2;
  const p = s.profile!;
  p.scouts = saved;
  const st = fogState(game, s);
  assert.ok(!fogSeen(st.bits, t.x, t.y));
  fogInit(game, s);
  assert.ok(fogSeen(fogState(game, s).bits, t.x, t.y));
  assert.equal(scoutsView(game, s).list[0].state, 'home');
});

test('the charts hide what the fog covers until it is seen', () => {
  const bits = newFog();
  fogDisc(bits, 10_500, 10_500, 1500);
  const pois = [{ id: 'near', x: 10_400, y: 10_600 }, { id: 'far', x: 40_000, y: 40_000 }];
  assert.deepEqual(visibleOnChart(bits, pois).map((p) => p.id), ['near']);
  fogDisc(bits, 40_000, 40_000, 500);
  assert.deepEqual(visibleOnChart(bits, pois).map((p) => p.id), ['near', 'far']);
  assert.equal(visibleOnChart(null, pois).length, 2, 'no fog yet: nothing hidden');
});

test('a course into the fog still sails (the helmsman, the goals): the fog clears as she goes', () => {
  const game = world();
  const { s, conn } = captain(game, 'Into Fog');
  const ship = s.ship!;
  ship.docked = null;
  const t = fogTarget(game, s, ship.state, 6);
  // she starts by the edge of what she has seen, the fog a mile ahead
  for (let f = 0.75; f > 0.3; f -= 0.05) {
    const x = ship.state.x + (t.x - ship.state.x) * f, y = ship.state.y + (t.y - ship.state.y) * f;
    if (isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    game.grid.upsert(ship.id, x, y);
    break;
  }
  conn.push({ t: 'autosail', x: t.x, y: t.y });
  assert.ok(autosailOf(ship), 'the helmsman takes her into the fog');
  const before = fogCount(fogState(game, s).bits);
  const x0 = ship.state.x, y0 = ship.state.y;
  steps(game, 20 * 120);
  assert.ok(Math.hypot(ship.state.x - x0, ship.state.y - y0) > 800, 'she sails');
  assert.ok(fogCount(fogState(game, s).bits) > before, 'cleared as she sails');
});

test('the cost: 40 captains with 3 scouts each at sea, a second of fog for all of them', () => {
  const game = world();
  const caps: PlayerSession[] = [];
  for (let i = 0; i < 40; i++) {
    const { s } = owner(game, `Fleet ${i}`, 5);
    fogInit(game, s);
    caps.push(s);
  }
  for (let k = 0; k < 3; k++) {
    for (const s of caps) scoutBuild(game, s);
    clock += SCOUT_BUILD_SECS * 1000 + 1;
  }
  let sent = 0;
  for (const s of caps) {
    const home = homeOf(game, s)!;
    for (const x of scoutsView(game, s).list) {
      const t = { x: home.x + (Math.random() - 0.5) * 30_000, y: home.y + (Math.random() - 0.5) * 30_000 };
      if (scoutSend(game, s, x.id, Math.max(5000, Math.min(91_000, t.x)), Math.max(5000, Math.min(91_000, t.y))) === null) sent++;
    }
  }
  assert.ok(sent >= 80, `${sent} scouts at sea`);
  // ten seconds of the sea for every captain: her ship moved, her scouts swept
  const t0 = performance.now();
  let calls = 0;
  for (let sec = 0; sec < 10; sec++) {
    clock += 1000;
    for (const s of caps) {
      s.ship!.state.x += 30;
      fogSecond(game, s);
      calls++;
    }
  }
  const per = (performance.now() - t0) / calls;
  // a captain's second comes once in twenty ticks: her share of a tick is a twentieth of it
  const tick = (per * caps.length) / 20;
  console.log(`fog: ${per.toFixed(3)} ms a captain-second; ${tick.toFixed(3)} ms a tick for 40 captains and ${sent} scouts`);
  assert.ok(tick < 0.5, `${tick.toFixed(3)} ms a tick`);
});

test('every new line in both languages', () => {
  setLang('ru');
  try {
    for (const line of [
      'Claim an island of your own first.', 'Build a shipyard on the island first.', 'The shipyard keeps 2 scouts: raise it for more.', 'The shipyard keeps 3 scouts.',
      'A scout is on the slipway already.', 'No such scout.', 'She is still on the slipway.', 'She is at sea already.', 'That is beyond the maelstrom wall.',
      'Too far: a scout sails 30 km from the island at most.', 'No way by the water leads there.', 'No fog is left within a scout’s reach.', 'She is not at sea.',
      'She is on her way home already.', 'The scout Lark is home: 42 squares of the sea charted.',
    ]) assert.doesNotMatch(serverText(line), /[A-Za-z]{3,}/, line);
  } finally {
    setLang('en');
  }
});

void FOG_CELL;
