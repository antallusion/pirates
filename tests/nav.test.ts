// The sea's navigation after the island collision (2026-10-09; tools/nav/measure.ts has the whole tables):
//  1. «Атаковать» and the sea's chases: the helm's lead line sounds the whole of its look (seaway.ts) — the reefs her
//     keel drags on as well as the coast's band and the solid things — so the guns' fight no longer circles its
//     broadside's course over a reef (before: 6 of 45 such fights ground on a reef, 5 of them sank on it; after: 2
//     grazed one for 2% of a hull, none sank); held fast, she plans a way from where she lies, then gives it up.
//  2. The planner (nav.ts) knows the solid things for a hull: its end the water by a mark on a hulk or a pier, every leg
//     clear of them; the helmsman never goes round and round a thing by his mark.
//  3. A town's piers are each their own box, as the painting draws them: the water between them is water.
//  4. The balance sims' open sea is untouched: no lead line of the new kind turns a helm there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SEED } from '../shared/src/constants.ts';
import { QUAY_LINE, QUAY_PIERS } from '../shared/src/data/quays.ts';
import { headingOf, headingVec } from '../shared/src/math.ts';
import { blockerProbe, hullClearance } from '../shared/src/sim/hull.ts';
import type { Blocker } from '../shared/src/sim/hull.ts';
import { blockersNear, portLayout, quayArt, quayBlockers } from '../shared/src/world/solids.ts';
import { generateWorld } from '../shared/src/world/worldgen.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { autosailOf, plan } from '../server/src/game/autosail.ts';
import type { Game } from '../server/src/game/Game.ts';
import { findPath } from '../server/src/game/nav.ts';
import { courseFoul } from '../server/src/game/npc.ts';
import { pursuitOf, startPursuit, STUCK_GIVE_UP, STUCK_SEC } from '../server/src/game/pursuit.ts';
import { fineDetour, hullWater, reefOnLine, REEF_MARGIN, runClear, waterAt } from '../server/src/game/seaway.ts';
import { touches } from '../server/src/game/strike.ts';
import { clientBlockers } from '../client/src/collide.ts';
import type { IslandData } from '../shared/src/protocol.ts';
import { chaseRun, chaseScenes, sailRun, sailScenes, seaCaptainAt } from '../tools/nav/harness.ts';
import { duelSea, openWater } from './balance/duel.ts';
import { makeGame, steps } from './helpers.ts';

const world = generateWorld(WORLD_SEED);
const rounded = (is: Island) => ({ id: is.id, x: Math.round(is.x), y: Math.round(is.y), r: Math.round(is.radius), poly: is.poly.map((v) => Math.round(v)) });

/** A steady breeze everywhere (no storm hands the wheel back; no front). */
function fair(game: Game): void {
  if (!Object.getOwnPropertyDescriptor(game, 'fronts')?.get) Object.defineProperty(game, 'fronts', { get: () => [], set: () => {}, configurable: true });
  for (const w of Object.values(game.weather)) {
    w.kind = 'breeze';
    w.until = game.now + 1e6;
  }
}

// ------------------------------------------------------------------ 1. the lead line and the chase

test('the lead line sounds the reefs along the whole run: across one, by one within the margin, past one', () => {
  const rf = world.reefs.find((r) => r.depth < 3 && r.radius > 120)!;
  // Across the reef's middle (a run of 600 m: the old soundings at its half and its end were both off it).
  assert.equal(reefOnLine(world, rf.x - 300, rf.y - rf.radius * 0.1, rf.x + 300, rf.y - rf.radius * 0.1, REEF_MARGIN, 4), true, 'across it');
  // A keel that clears it floats over it.
  assert.equal(reefOnLine(world, rf.x - 300, rf.y, rf.x + 300, rf.y, REEF_MARGIN, rf.depth - 0.1), false, 'a shallow keel');
  // Well off it.
  assert.equal(reefOnLine(world, rf.x - 300, rf.y - rf.radius - 200, rf.x + 300, rf.y - rf.radius - 200, REEF_MARGIN, 4), false, 'past it');
});

test('«Атаковать» with the guns by a reef and in the dense sea: her broadside\'s course never over a reef, not one blow (before: 5 of these 13 fights sank on a reef)', () => {
  const { game } = makeGame();
  const scenes = chaseScenes(game.world, 5).filter((s) => s.kind === 'reef' || s.kind === 'dense');
  assert.ok(scenes.length >= 10, `${scenes.length} scenes`);
  let reef = 0, blows = 0, stuck = 0, sunk = 0;
  for (const sc of scenes) {
    const r = chaseRun(game, sc, 'guns', sc.kind === 'reef' ? 'frigate' : 'brig', 45);
    reef += r.reef;
    blows += r.blows;
    stuck += r.stuck ? 1 : 0;
    sunk += r.end === 'sunk' ? 1 : 0;
  }
  assert.equal(reef, 0, 'no hull lost on a reef');
  assert.equal(sunk, 0, 'none sunk');
  assert.equal(blows, 0, 'no blow');
  assert.equal(stuck, 0, 'never held fast');
});

test('«Атаковать» to board past a hulk, a skerry, a graveyard\'s hulks and a town\'s piers: the grapples in time, no blow, never held fast', () => {
  const { game } = makeGame();
  const all = chaseScenes(game.world, 5);
  const scenes = (['wreck', 'skerry', 'hulks', 'pier', 'reef', 'isle'] as const).map((k) => all.find((s) => s.kind === k)!);
  for (const sc of scenes) {
    const r = chaseRun(game, sc, 'captain', sc.kind === 'reef' ? 'frigate' : 'brig', 60);
    assert.ok(r.grapple > 0 && r.grapple < 40, `${sc.kind} ${sc.of}: the grapples at ${r.grapple} s`);
    assert.equal(r.blows, 0, `${sc.kind}: no blow`);
    assert.equal(r.reef, 0, `${sc.kind}: no reef`);
    assert.equal(r.stuck, false, `${sc.kind}: never held fast`);
  }
});

test('her mark behind an island: the helmsman takes her round it and boards her, no blow, never held fast', () => {
  const { game } = makeGame();
  const sc = chaseScenes(game.world, 5).find((s) => s.kind === 'behind')!;
  const r = chaseRun(game, sc, 'captain', 'brig', 120);
  assert.ok(r.grapple > 0, `boarded (${r.grapple} s)`);
  assert.equal(r.blows + r.reef, 0);
  assert.equal(r.stuck, false);
});

test('held fast with her mark beyond a cable: planned afresh, then the mark is lost (the wheel back), not ground on for ever', () => {
  const { game } = makeGame();
  const sc = chaseScenes(game.world, 1).find((s) => s.kind === 'wreck')!;
  const { s, c, ship } = seaCaptainAt(game, 'brig', sc.me.x, sc.me.y, sc.me.h);
  const T = game.spawnNpcShip('pirate', 'brigantine', 'confederacy', sc.route[0][0], sc.route[0][1], 0);
  game.npcs.delete(T.id);
  T.protectedUntil = 0;
  assert.equal(startPursuit(game, s, T.id, 'board'), null);
  // Her way taken off her every tick (a calm, a fouled rudder): she cannot close.
  let gone = -1, planned = false;
  for (let i = 0; i < 20 * (STUCK_SEC + 1) * (STUCK_GIVE_UP + 1) && gone < 0; i++) {
    ship.state.speed = 0;
    T.attackers.set(ship.id, game.now);
    game.step();
    if (pursuitOf(ship)?.way) planned = true;
    if (!pursuitOf(ship)) gone = game.now;
  }
  assert.ok(planned, 'held fast: a way planned from where she lies');
  assert.ok(gone > 0, 'the pursuit ends');
  assert.equal(c.last('pursuit')?.why, 'lost', 'the mark is lost');
});

// ------------------------------------------------------------------ 2. the planner and the helmsman's runs

test('the planner for a hull: a mark on a hulk, a skerry, a pier ends in the water by it; every leg clear of what her keel strikes', () => {
  const { game } = makeGame();
  const w = game.world;
  const { ship } = seaCaptainAt(game, 'frigate', 20000, 70000, 0);
  const hw = hullWater(ship);
  let n = 0;
  for (const sc of sailScenes(w, 3).filter((x) => x.kind !== 'anchorage')) {
    ship.state.x = sc.from.x;
    ship.state.y = sc.from.y;
    const path = plan(game, ship, sc.to.x, sc.to.y)!;
    assert.ok(path && path.length >= 2, `${sc.kind} ${sc.of}: a route`);
    const end = path[path.length - 1];
    assert.ok(waterAt(w, end[0], end[1], hw), `${sc.kind} ${sc.of}: her route ends in water her hull may lie in`);
    assert.ok(Math.hypot(end[0] - sc.to.x, end[1] - sc.to.y) < 460, `${sc.kind}: by her mark (${Math.round(Math.hypot(end[0] - sc.to.x, end[1] - sc.to.y))} m)`);
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1], [bx, by] = path[i];
      // (Her own start may lie in a coast's band she was put in; the legs after it are clear.)
      if (i > 1 || waterAt(w, ax, ay, hw)) assert.ok(runClear(w, ax, ay, bx, by, hw), `${sc.kind} ${sc.of}: leg ${i} clear`);
    }
    n++;
  }
  assert.ok(n >= 12, `${n} routes`);
});

test('a way round a hulk on a short leg: the fine grid\'s detour, every leg of it clear', () => {
  const m = world.marks.find((k) => k.kind === 'wreck' && k.r > 70 && blockersNear(world, k.x, k.y, 600, []).every((b) => b.shape !== 'coast'))!;
  const hw = { r: 13, draft: 4, shallow: false };
  const [x0, y0, x1, y1] = [m.x - 300, m.y - 10, m.x + 300, m.y + 10];
  assert.equal(runClear(world, x0, y0, x1, y1, hw), false, 'the hulk lies on the straight leg');
  const way = fineDetour(world, x0, y0, x1, y1, hw)!;
  assert.ok(way && way.length >= 3, 'a way round');
  for (let i = 1; i < way.length; i++) assert.ok(runClear(world, way[i - 1][0], way[i - 1][1], way[i][0], way[i][1], hw), `leg ${i}`);
  const len = way.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - way[i][0], p[1] - way[i][1]), 0);
  assert.ok(len < 600 * 1.3, `and not far round (${Math.round(len)} m for 600)`);
  // The planner's own route for a hull past it: the same.
  const path = findPath(world, x0 - 1500, y0, x1 + 1500, y1, 60000, hw)!;
  for (let i = 1; i < path.length; i++) assert.ok(runClear(world, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1], hw), `route leg ${i}`);
});

test('the helmsman\'s runs onto hulks, skerries, piers and through the dense sea: every one arrives, not one blow', () => {
  const { game } = makeGame();
  const scenes = sailScenes(game.world, 2).filter((s) => s.kind !== 'across' && s.kind !== 'anchorage');
  assert.ok(scenes.length >= 9, `${scenes.length} runs`);
  for (const sc of scenes) {
    const r = sailRun(game, sc, 'brig', 240);
    assert.equal(r.why, 'arrived', `${sc.kind} ${sc.of}: ${r.why}, ${r.left} m off`);
    assert.equal(r.blows, 0, `${sc.kind} ${sc.of}: no blow`);
  }
});

test('never nearer her mark in a minute (thrown back from water she has no leave for, round and round a thing): planned afresh, then the wheel back', () => {
  const { game } = makeGame();
  // A mark past the Abyss's wall for a captain without leave: the wall throws her back each time she comes to it.
  const { c, ship } = seaCaptainAt(game, 'brig', 80038, 14428, Math.PI / 2);
  ship.state.speed = 0;
  c.push({ t: 'autosail', x: 81532, y: 14556, sail: 4 });
  assert.ok(autosailOf(ship), 'the helmsman takes her');
  let why = '';
  for (let i = 0; i < 20 * 400 && !why; i++) {
    if (i % 200 === 0) fair(game);
    game.step();
    if (!autosailOf(ship)) why = (c.last('autosail') as { why?: string } | undefined)?.why ?? 'off';
  }
  assert.equal(why, 'stuck', 'the wheel back: no open water leads to that mark');
});

// ------------------------------------------------------------------ 3. the piers as drawn

test('every port painting\'s piers as it draws them: the boxes from its foot, gaps of water between them', () => {
  const arts = Object.keys(QUAY_PIERS);
  assert.ok(arts.length >= 26, `${arts.length} paintings`);
  for (const a of arts) {
    for (const [l, r, d] of QUAY_PIERS[a]) assert.ok(l >= 0 && r <= 1 && l < r && d > 0 && d <= 1 - QUAY_LINE + 0.002, `${a}: [${l}, ${r}, ${d}]`);
  }
  // The faction towns: three or four piers with water between (crown: three at a quarter of the painting apart).
  const crown = QUAY_PIERS['prop.port_crown'].filter((b) => b[2] > 0.15);
  assert.equal(crown.length, 3);
  for (let i = 1; i < crown.length; i++) assert.ok(crown[i][0] - crown[i - 1][1] > 0.15, 'a wide slip between two piers');
  // (The confederacy's foot has no piers out over the water.)
  assert.equal(QUAY_PIERS['prop.port_confederacy'].length, 0);
});

test('a town\'s piers are each their own box: a sloop lies in the water between two of them, where the one old box was solid', () => {
  const w = world;
  let slips = 0;
  for (const p of w.ports) {
    if (p.raft) continue;
    const is = rounded(w.islands[p.islandId]);
    const art = quayArt(p);
    if (!art) continue;
    const lay = portLayout(p, is);
    const bs = quayBlockers(p, is);
    assert.equal(bs.length, QUAY_PIERS[art].length, `${p.id}: one box a pier`);
    // The water between two boxes the painting's foot leaves (from the quay line down), wide enough for her.
    const piers = QUAY_PIERS[art];
    for (let i = 1; i < piers.length; i++) {
      const gap = (piers[i][0] - piers[i - 1][1]) * lay.size;
      if (gap < 30 || Math.min(piers[i - 1][2], piers[i][2]) < 0.1) continue;
      // Her place in the slip: its middle, a third of the way down the shallower pier, bow to the quay.
      const u = ((piers[i - 1][1] + piers[i][0]) / 2 - 0.5) * lay.size, v = (QUAY_LINE - 0.5) * lay.size + Math.min(piers[i - 1][2], piers[i][2]) * lay.size * 0.66;
      const x = lay.x + u * Math.cos(lay.ang) - v * Math.sin(lay.ang), y = lay.y + u * Math.sin(lay.ang) + v * Math.cos(lay.ang);
      const st = { x, y, heading: lay.ang + Math.PI };
      const near: Blocker[] = blockersNear(w, x, y, 40, []);
      if (near.some((b) => b.shape === 'coast' && hullClearance(st, 18, 6, [b]) < 0)) continue; // (the shore runs into this slip)
      assert.ok(hullClearance(st, 18, 6, bs) >= 0, `${p.id}: a sloop in the slip between piers ${i - 1} and ${i} (${Math.round(gap)} m)`);
      // The old box over the whole foot had her inside it.
      const P = { d: 0, nx: 0, ny: 0, qx: 0, qy: 0 };
      const ox = lay.x - Math.sin(lay.ang) * lay.size * 0.355, oy = lay.y + Math.cos(lay.ang) * lay.size * 0.355;
      blockerProbe({ shape: 'box', coast: null, x: ox, y: oy, reach: lay.size, r: 0, hw: lay.size * 0.32, hh: lay.size * 0.115, ca: Math.cos(lay.ang), sa: Math.sin(lay.ang), pad: 3, kind: 'pier', dmg: 0.8 }, x, y, P);
      if (P.d < 0) slips++;
    }
  }
  assert.ok(slips >= 25, `${slips} slips that were solid are water`);
});

test('the docking spot stays reachable: every town\'s anchorage clear of its piers for a frigate lying broadside to the quay', () => {
  for (const p of world.ports) {
    if (p.raft) continue;
    const is = rounded(world.islands[p.islandId]);
    const lay = portLayout(p, is);
    const bs = quayBlockers(p, is);
    const h = headingOf(Math.cos(lay.ang), Math.sin(lay.ang)); // (along the shore)
    assert.ok(hullClearance({ x: Math.round(p.x), y: Math.round(p.y), heading: h }, 42, 11, bs) >= 0, `${p.id}`);
  }
});

test('a sloop sails into a slip between two piers and lies there: no blow, her hull off both piers', () => {
  const { game } = makeGame();
  const p = game.world.ports.find((q) => quayArt(q) === 'prop.port_crown' && !q.raft)!;
  const is = rounded(game.world.islands[p.islandId]);
  const lay = portLayout(p, is);
  const piers = QUAY_PIERS['prop.port_crown'].filter((b) => b[2] > 0.15);
  const u = ((piers[0][1] + piers[1][0]) / 2 - 0.5) * lay.size;
  const at = (v: number) => [lay.x + u * Math.cos(lay.ang) - v * Math.sin(lay.ang), lay.y + u * Math.sin(lay.ang) + v * Math.cos(lay.ang)];
  const [x0, y0] = at((QUAY_LINE - 0.5) * lay.size + 0.25 * lay.size + 60); // off the slip's mouth
  const [x1, y1] = at((QUAY_LINE - 0.5) * lay.size + 0.24 * lay.size * 0.5); // halfway in
  const { ship } = seaCaptainAt(game, 'sloop', x0, y0, headingOf(x1 - x0, y1 - y0));
  ship.state.speed = 3 / 0.8; // three knots
  ship.input = { rudder: 0, sailTarget: 0.25 };
  const bs = quayBlockers(p, is);
  const before = touches.get(ship)?.blow ?? 0;
  let least = Infinity;
  for (let i = 0; i < 20 * 12; i++) {
    const want = headingOf(x1 - ship.state.x, y1 - ship.state.y);
    ship.input = { rudder: Math.max(-1, Math.min(1, Math.atan2(Math.sin(want - ship.state.heading), Math.cos(want - ship.state.heading)) * 2)), sailTarget: Math.hypot(x1 - ship.state.x, y1 - ship.state.y) > 30 ? 0.25 : 0 };
    game.step();
    least = Math.min(least, hullClearance(ship.state, ship.stats.length, ship.stats.beam, bs));
  }
  assert.ok(Math.hypot(ship.state.x - x1, ship.state.y - y1) < 60, `in the slip (${Math.round(Math.hypot(ship.state.x - x1, ship.state.y - y1))} m from its middle)`);
  assert.ok(least > -0.05, `her hull off the piers (${least.toFixed(2)})`);
  assert.equal((touches.get(ship)?.blow ?? 0) - before, 0, 'no blow');
});

test('the client reckons the same piers as the server: one box a pier, in the same place', () => {
  const { game } = makeGame();
  const w = game.world;
  const islands = new Map<number, IslandData>();
  for (const is of w.islands) if (!is.slot && !is.hidden) islands.set(is.id, game.islandData(is));
  const ports = w.ports.map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) }));
  let n = 0;
  for (const p of ports.filter((q) => !q.raft && quayArt(q)).slice(0, 12)) {
    const is = w.islands[p.islandId];
    const lay = portLayout(p, rounded(is));
    const fx = lay.x - Math.sin(lay.ang) * lay.size * 0.36, fy = lay.y + Math.cos(lay.ang) * lay.size * 0.36;
    const sv = blockersNear(w, fx, fy, lay.size * 0.4, []).filter((b) => b.kind === 'pier');
    const cl = clientBlockers({ islands, seaMarks: new Map(), ports, adv: null, wonders: null }, fx, fy, lay.size * 0.4, []).filter((b) => b.kind === 'pier');
    assert.equal(cl.length, sv.length, `${p.id}: as many piers`);
    for (const b of sv) assert.ok(cl.some((c) => Math.abs(c.x - b.x) < 0.01 && Math.abs(c.y - b.y) < 0.01 && Math.abs(c.hw - b.hw) < 0.01 && Math.abs(c.hh - b.hh) < 0.01), `${p.id}: the same box`);
    n += sv.length;
  }
  assert.ok(n >= 40, `${n} piers`);
});

// ------------------------------------------------------------------ 4. the open sea of the balance sims

test('the balance sims\' open sea: the new lead line turns no helm there (no reef, coast or solid thing in any look)', () => {
  const game = duelSea();
  const { ship } = seaCaptainAt(game, 'frigate', 0, 0, 0);
  for (let k = 0; k < 24; k++) {
    const at = openWater(game, k);
    ship.state.x = at.x;
    ship.state.y = at.y;
    for (let a = 0; a < 16; a++) {
      const h = (a / 16) * Math.PI * 2;
      assert.equal(courseFoul(game, ship, h, 180 + ship.stats.maxSpeed * 1.7 * 7), false, `open water ${k} at ${a * 22.5}°`);
      void headingVec;
    }
  }
  steps(game, 1);
});
