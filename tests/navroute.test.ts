// Routes that never cross the land, and the line that always shows (owner, 2026-10-18: «по автоплаванию косяк, маршруты
// надо строить минуя заграждения, потому что часто врезаешься в острова когда путь проложен. далее косяк есть по пути, я
// например выбрал плыть по кампании нету линии плавания и не показано сколько плыть. всегда должно быть показано
// направление линией и путь.»)
//  1. The planner: random runs across the sea and through its island clusters — every leg clear of land, reefs and the
//     solid things by the hull's margin; the grid's string-pulling never keeps a leg over a thin neck of land; a mark
//     on land ends on safe water by it.
//  2. The helmsman: a plan gone stale (a leg over an island) is planned afresh, not sailed; arrived, she stays hove to
//     though her phone resends its sail (it ran her on onto the shore), and is kept off a coast until her own hand
//     takes the wheel. tools/nav/autosail-sim.ts, 200 random runs with the phone's helm: 35 run aground before (34 of
//     them after the wheel came back), 0 after; the live sea (its ships, its weather), 60 runs: 13 before, 0 after.
//  3. The line: every run sends its planned way (a tap's, a goal's — the campaign's —, a new plan), and a goal's place
//     waiting in port has its way too; the client draws it from where she is and reckons the km by it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SIZE } from '../shared/src/constants.ts';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { isLand, reefDepthAt } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { autosailOf, guardOf, pathClear, plan, planFrom, planWater, startAutosail } from '../server/src/game/autosail.ts';
import { gotoGoal } from '../server/src/game/goalroute.ts';
import { findPath, lineFree } from '../server/src/game/nav.ts';
import { hullWater, reefOnLine, REEF_MARGIN, runClear, waterAt } from '../server/src/game/seaway.ts';
import { touches } from '../server/src/game/strike.ts';
import { courseAhead, courseOf } from '../client/src/ui/course.ts';
import { openAt, sceneWind, seaCaptainAt } from '../tools/nav/harness.ts';
import { makeGame } from './helpers.ts';

function fair(game: Game): void {
  if (!Object.getOwnPropertyDescriptor(game, 'fronts')?.get) Object.defineProperty(game, 'fronts', { get: () => [], set: () => {}, configurable: true });
  for (const w of Object.values(game.weather)) {
    w.kind = 'breeze';
    w.until = game.now + 1e6;
  }
}

/** A generator of the test's own (the sea's dice untouched). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Land (and a reef shallower than the keel) on a straight leg, every 8 m. */
function legOnLand(game: Game, a: [number, number], b: [number, number], draft: number): string | null {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8));
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n, y = a[1] + ((b[1] - a[1]) * i) / n;
    if (isLand(game.world, x, y)) return `land at ${Math.round(x)},${Math.round(y)}`;
    if (reefDepthAt(game.world, x, y) < draft) return `reef at ${Math.round(x)},${Math.round(y)}`;
  }
  return null;
}

/** The random runs: from open water to a mark 1.5–9 km off — half of them by the busiest island clusters. */
function pairs(game: Game, n: number, seed: number): { from: [number, number]; to: [number, number] }[] {
  const r = rng(seed);
  const w = game.world;
  // the clusters: islands with three others or more within 2.5 km
  const isles = w.islands.filter((i) => !i.slot && !i.hidden && i.poly.length > 0);
  const busy = isles.filter((i, k) => k % 3 === 0 && isles.filter((o) => o !== i && Math.abs(o.x - i.x) < 2500 && Math.abs(o.y - i.y) < 2500).length >= 3);
  const out: { from: [number, number]; to: [number, number] }[] = [];
  for (let guard = 0; out.length < n && guard < n * 400; guard++) {
    let x: number, y: number;
    if (out.length % 2 && busy.length) {
      const is = busy[Math.floor(r() * busy.length)];
      const a = r() * Math.PI * 2, d = is.radius + 300 + r() * 900;
      x = is.x + Math.sin(a) * d;
      y = is.y - Math.cos(a) * d;
    } else {
      x = 3000 + r() * (WORLD_SIZE - 6000);
      y = 3000 + r() * (WORLD_SIZE - 6000);
    }
    if (!openAt(w, x, y, 90)) continue;
    const a = r() * Math.PI * 2, d = 1500 + r() * 7500;
    const tx = x + Math.sin(a) * d, ty = y - Math.cos(a) * d;
    if (tx < 2500 || ty < 2500 || tx > WORLD_SIZE - 2500 || ty > WORLD_SIZE - 2500) continue;
    out.push({ from: [x, y], to: [tx, ty] });
  }
  return out;
}

// ------------------------------------------------------------------ 1. the planner

test('random runs across the sea and its island clusters: every leg of every plan clear of land, reefs and the solid things by her hull\'s margin', () => {
  const { game } = makeGame();
  const runs = pairs(game, 60, 18);
  assert.ok(runs.length >= 55, `${runs.length} runs`);
  let planned = 0, wide = 0;
  for (const [k, cls] of (['sloop', 'brig', 'frigate', 'man_o_war'] as const).entries()) {
    const { ship } = seaCaptainAt(game, cls, 50000, 50000, 0);
    const hw = hullWater(ship), pw = planWater(ship);
    assert.ok(pw.r >= hw.r + ship.stats.length * 0.3, `${cls}: the planner's margin grows with her length`);
    for (const run of runs.slice(k * 15, k * 15 + 15)) {
      ship.state = { ...ship.state, x: run.from[0], y: run.from[1] };
      const p = plan(game, ship, run.to[0], run.to[1]);
      if (!p) continue;
      planned++;
      if (pathClear(game, p, pw)) wide++;
      for (let i = 1; i < p.length; i++) {
        const where = `${cls} ${run.from.map(Math.round)}→${run.to.map(Math.round)} leg ${i}`;
        assert.equal(legOnLand(game, p[i - 1], p[i], ship.cls.draft), null, where);
        assert.ok(runClear(game.world, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], hw), `${where}: clear for her hull`);
      }
      // its end on water she may lie in, clear by the margin
      const e = p[p.length - 1];
      assert.ok(waterAt(game.world, e[0], e[1], hw), `${cls}: the end is her water`);
    }
  }
  assert.ok(planned >= 55, `planned ${planned}`);
  // (the bare hull's water only where a harbour is too narrow for the margin)
  assert.ok(wide >= planned * 0.9, `${wide} of ${planned} clear by the full margin`);
});

test('the grid\'s string-pulling never keeps a leg over a thin neck of land: a hull\'s plan is sounded leg by leg', () => {
  const { game } = makeGame();
  const w = game.world;
  // the coarse grid's own pulled path (no hull) does cross land somewhere among these — the hull's never does
  const runs = pairs(game, 40, 77);
  const hw = { r: 15, draft: 3.4, shallow: false };
  let coarseOver = 0;
  for (const run of runs) {
    const coarse = findPath(w, run.from[0], run.from[1], run.to[0], run.to[1], 80_000);
    if (coarse) for (let i = 1; i < coarse.length; i++) if (!runClear(w, coarse[i - 1][0], coarse[i - 1][1], coarse[i][0], coarse[i][1], { ...hw, r: 1 })) coarseOver++;
    const p = findPath(w, run.from[0], run.from[1], run.to[0], run.to[1], 80_000, hw);
    if (!p) continue;
    for (let i = 1; i < p.length; i++) {
      assert.ok(runClear(w, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], hw), `leg ${i} of ${run.from.map(Math.round)}→${run.to.map(Math.round)}`);
      assert.ok(hw.shallow || !reefOnLine(w, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], REEF_MARGIN, hw.draft), 'no reef on it');
    }
  }
  assert.ok(coarseOver > 0, 'the coarse grid alone cuts a corner somewhere (what the sounding is there for)');
  void lineFree;
});

test('a mark on land (an island\'s middle, a lair ashore, a point of the coast) ends on safe water by it, within the boats\' reach', () => {
  const { game } = makeGame();
  const w = game.world;
  const isles = w.islands.filter((i) => !i.slot && !i.hidden && !i.raft && !i.portId && i.poly.length >= 6 && i.radius >= 120 && i.radius <= 900);
  const { ship } = seaCaptainAt(game, 'frigate', 50000, 50000, 0);
  const hw = hullWater(ship);
  let n = 0;
  for (const is of isles.filter((_, k) => k % Math.ceil(isles.length / 30) === 0)) {
    // she lies 1.5 km off, out at sea
    let from: [number, number] | null = null;
    for (let a = 0; a < 12 && !from; a++) {
      const x = is.x + Math.sin(a * 0.52) * (is.radius + 1500), y = is.y - Math.cos(a * 0.52) * (is.radius + 1500);
      if (openAt(w, x, y, 90)) from = [x, y];
    }
    if (!from) continue;
    ship.state = { ...ship.state, x: from[0], y: from[1] };
    // a point of its coast, 20 m inland
    const j = (n * 6) % (is.poly.length / 2) * 2;
    const cx = is.poly[j] + (is.x - is.poly[j]) * 0.05, cy = is.poly[j + 1] + (is.y - is.poly[j + 1]) * 0.05;
    for (const [mx, my, what] of [[is.x, is.y, 'middle'], [cx, cy, 'coast']] as const) {
      const p = planFrom(game, ship, from[0], from[1], mx, my);
      if (!p) continue;
      const e = p[p.length - 1];
      assert.ok(!isLand(w, e[0], e[1]), `isle ${is.id} ${what}: the end not ashore`);
      assert.ok(waterAt(w, e[0], e[1], hw), `isle ${is.id} ${what}: water her hull may lie in`);
      if (what === 'coast') assert.ok(Math.hypot(e[0] - mx, e[1] - my) < 450, `isle ${is.id}: within the boats' reach of the shore (${Math.round(Math.hypot(e[0] - mx, e[1] - my))} m)`);
      n++;
    }
  }
  assert.ok(n >= 30, `${n} marks`);
});

// ------------------------------------------------------------------ 2. the helmsman

/** Her phone: no rudder, the helmsman's sail, four times a second (of the sea's clock: the flood guard counts by the
 *  wall clock, and a test's second passes in milliseconds). */
function phone(game: Game, cap: Pick<ReturnType<typeof seaCaptainAt>, 'c' | 's'>, sec: number, sail = 4, each?: () => void): void {
  const { c, s } = cap;
  for (let i = 0; i < sec * 20; i++) {
    if (i % 5 === 0) {
      s.msgCount = 0;
      c.push({ t: 'input', seq: 1000 + i, rudder: 0, sail });
    }
    game.step();
    each?.();
  }
}

test('a plan gone stale (a leg straight over an island) is planned afresh from where she is, and she arrives without a touch', () => {
  const { game } = makeGame();
  fair(game);
  const w = game.world;
  // an island with open water both sides of it
  const is = w.islands.find((i) => !i.slot && !i.hidden && !i.raft && !i.portId && i.radius >= 250 && i.radius <= 600 && openAt(w, i.x - i.radius - 900, i.y, 120) && openAt(w, i.x + i.radius + 900, i.y, 120))!;
  assert.ok(is, 'an island to go round');
  const calm = sceneWind(game, `stale ${is.id}`);
  const { s, c, ship } = seaCaptainAt(game, 'brig', is.x - is.radius - 900, is.y, Math.PI / 2);
  const to: [number, number] = [is.x + is.radius + 900, is.y];
  assert.equal(startAutosail(game, s, to[0], to[1], 4), null);
  const run = autosailOf(ship)!;
  // the stale plan: straight across
  run.path = [[ship.state.x, ship.state.y], to];
  run.i = 1;
  run.plannedAt = -1e9;
  const t0 = touches.get(ship)?.touch ?? 0;
  let replanned = false, why = '';
  phone(game, { c, s }, 300, 4, () => {
    const r = autosailOf(ship);
    if (r && r.path.length > 2) replanned = true;
    if (!why && !r) why = (c.last('autosail') as { why?: string } | undefined)?.why ?? 'off';
  });
  calm();
  assert.ok(replanned, 'planned afresh round the island');
  assert.equal(why, 'arrived');
  assert.equal((touches.get(ship)?.touch ?? 0) - t0, 0, 'not a touch of her hull on the way');
  // the new plan went to her screen
  const sent = c.inbox.filter((m) => m.t === 'autosail' && m.on) as { path?: [number, number][] }[];
  assert.ok(sent.some((m) => (m.path?.length ?? 0) > 2), 'the new way sent');
});

test('arrived by a shore: she stays hove to though her phone resends the sail, and is kept off the coast until her own hand takes the wheel', () => {
  const { game } = makeGame();
  fair(game);
  const w = game.world;
  const is = w.islands.find((i) => !i.slot && !i.hidden && !i.raft && !i.portId && i.radius >= 300 && i.radius <= 900 && openAt(w, i.x - i.radius - 2500, i.y, 120))!;
  const calm = sceneWind(game, `shore ${is.id}`);
  const { s, c, ship } = seaCaptainAt(game, 'frigate', is.x - is.radius - 2500, is.y, Math.PI / 2);
  // a tap on the island itself (its middle), her mark close in
  assert.equal(startAutosail(game, s, is.x, is.y, 4, 60), null);
  let arrived = -1;
  const t0 = touches.get(ship)?.touch ?? 0;
  phone(game, { c, s }, 400, 4, () => {
    if (arrived < 0 && !autosailOf(ship)) arrived = game.now;
  });
  calm();
  assert.ok(arrived > 0, 'she arrived');
  assert.equal((c.last('autosail') as { why?: string }).why, 'arrived');
  assert.ok(ship.state.speed < 1, `hove to, not sailing on (${ship.state.speed.toFixed(1)})`);
  assert.equal(ship.input.sailTarget, 0, 'the sail the phone resends is held off');
  assert.equal((touches.get(ship)?.touch ?? 0) - t0, 0, 'not a touch on the island');
  // her own sail set: hers again
  s.msgCount = 0;
  c.push({ t: 'input', seq: 99_000, rudder: 0, sail: 2 });
  assert.ok(ship.input.sailTarget > 0, 'a new sail of hers is set');
  void guardOf;
});

test('broken off by a shot near a coast: the lead line keeps her off it until she takes the wheel', () => {
  const { game } = makeGame();
  fair(game);
  const w = game.world;
  const is = w.islands.find((i) => !i.slot && !i.hidden && !i.raft && !i.portId && i.radius >= 400 && i.radius <= 900 && openAt(w, i.x - i.radius - 700, i.y, 120))!;
  const calm = sceneWind(game, `guard ${is.id}`);
  // heading straight at the island, 700 m off, at speed
  const { s, c, ship } = seaCaptainAt(game, 'brig', is.x - is.radius - 700, is.y, Math.PI / 2);
  ship.state.speed = ship.stats.maxSpeed * 0.9;
  assert.equal(startAutosail(game, s, is.x - is.radius - 700, is.y - 3000, 4), null);
  // a shot at her: the helmsman lets go with her bow on the island
  ship.state.heading = Math.PI / 2;
  ship.lastCombat = game.now + 0.01;
  const t0 = touches.get(ship)?.touch ?? 0;
  let broke = false;
  const t1 = game.now;
  phone(game, { c, s }, 60, 4, () => {
    if (!autosailOf(ship)) broke = true;
    if (game.now - t1 < 20) ship.lastCombat = game.now; // (the fight goes on a while: no course taken up again)
  });
  calm();
  assert.ok(broke, 'the course broken off');
  assert.equal((touches.get(ship)?.touch ?? 0) - t0, 0, 'not run onto the island she was heading for');
});

// ------------------------------------------------------------------ 3. the line

test('every run sends its planned way: a tap\'s, a goal\'s in port (from the harbour) and at sea; the client reckons the km by it', () => {
  const { game } = makeGame();
  fair(game);
  const { s, c, ship } = seaCaptainAt(game, 'brig', 50000, 50000, 0);
  // a tap on the sea behind an island: the way round it
  const w = game.world;
  const is = w.islands.find((i) => !i.slot && !i.hidden && !i.raft && !i.portId && i.radius >= 300 && i.radius <= 700 && openAt(w, i.x - i.radius - 900, i.y, 120) && openAt(w, i.x + i.radius + 900, i.y, 120))!;
  ship.state = { ...ship.state, x: is.x - is.radius - 900, y: is.y };
  c.push({ t: 'autosail', x: Math.round(is.x + is.radius + 900), y: Math.round(is.y), sail: 4 });
  const m = c.last('autosail') as { on: boolean; path?: [number, number][] };
  assert.ok(m.on && m.path && m.path.length > 2, 'the way round the island');
  for (let i = 1; i < m.path!.length; i++) assert.equal(legOnLand(game, m.path![i - 1], m.path![i], 0), null, `drawn leg ${i} not over the island`);
  // the client: from her bow along it, the km by the way, not straight across
  const state = { autosail: { x: m.path![m.path!.length - 1][0], y: m.path![m.path!.length - 1][1], path: m.path }, route: null, pausedCourse: null, lastPath: m.path! };
  const course = courseOf(state as never)!;
  const ahead = courseAhead(course, ship.state.x, ship.state.y);
  const straight = Math.hypot(course.to.x - ship.state.x, course.to.y - ship.state.y);
  assert.ok(ahead.left > straight * 1.02, `the km by the way round (${Math.round(ahead.left)} m against ${Math.round(straight)} straight)`);
  c.push({ t: 'autosail', stop: true });
  game.step();

  // the campaign's quest («Плыть» on it), in port: its place with its way from the harbour
  const q = s.profile!.quests.active.find((a) => a.id.startsWith('c0'));
  if (q) {
    const port = game.world.ports[0];
    ship.docked = port.id;
    ship.state = { ...ship.state, x: port.x, y: port.y };
    c.inbox.length = 0;
    gotoGoal(game, s, `q:${q.id}`);
    const r = c.last('route') as { on: boolean; view?: { x: number; y: number; path?: [number, number][] } } | undefined;
    assert.ok(r?.on && r.view, 'the campaign\'s place');
    assert.ok((r!.view!.path?.length ?? 0) >= 2, 'with its way from the harbour');
    // cast off: the helmsman's run sends its own plan
    ship.docked = null;
    s.profile!.docked = null;
    const at = r!.view!;
    for (let i = 0; i < 20 * 5 && !autosailOf(ship); i++) game.step();
    if (Math.hypot(at.x - ship.state.x, at.y - ship.state.y) > 300) {
      const a = c.inbox.filter((x) => x.t === 'autosail' && x.on).pop() as { path?: [number, number][] } | undefined;
      assert.ok(a && (a.path?.length ?? 0) >= 2, 'at sea: the helmsman\'s way to it');
    }
  }
});

test('a goal\'s place the helmsman cannot sail for yet (a hostile sail in range) is sent with its way all the same', () => {
  const { game } = makeGame();
  fair(game);
  const { s, c, ship } = seaCaptainAt(game, 'brig', 50000, 50000, 0);
  const w = game.world;
  let at: [number, number] | null = null;
  for (let k = 0; k < 200 && !at; k++) {
    const x = 20000 + (k % 14) * 4000, y = 20000 + Math.floor(k / 14) * 4000;
    if (openAt(w, x, y, 150) && w.ports.some((p) => Math.hypot(p.x - x, p.y - y) < 6000 && Math.hypot(p.x - x, p.y - y) > 2000)) at = [x, y];
  }
  assert.ok(at);
  ship.state = { ...ship.state, x: at![0], y: at![1] };
  game.grid.upsert(ship.id, at![0], at![1]);
  const was = game.weatherOf;
  game.weatherOf = () => 'storm';
  // the nearest port: a delivery's
  const port = w.ports.reduce((b, p) => (Math.hypot(p.x - at![0], p.y - at![1]) < Math.hypot(b.x - at![0], b.y - at![1]) ? p : b));
  s.profile!.quests.active.push({ id: 'nr_visit', step: 0, progress: 0, startedAt: game.now });
  QUESTS_BY_ID['nr_visit'] = { id: 'nr_visit', kind: 'job', name: 'Test', mentor: 'T', port: port.id, summary: '', requires: {}, steps: [{ type: 'visit', port: port.id, text: 'Go.' }], reward: { xp: 1, silver: 1 } } as never;
  c.inbox.length = 0;
  const e = gotoGoal(game, s, 'q:nr_visit');
  assert.ok(e, 'refused for now (a storm)');
  assert.equal(autosailOf(ship), null);
  const r = c.inbox.filter((m) => m.t === 'route' && m.on).pop() as { view?: { path?: [number, number][] } } | undefined;
  assert.ok((r?.view?.path?.length ?? 0) >= 2, 'the place sent with its way');
  game.weatherOf = was;
});
