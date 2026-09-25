import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polarEfficiency, stepSailing } from '../shared/src/sim/sailing.ts';
import type { SailParams, SailState } from '../shared/src/sim/sailing.ts';
import { computeShipStats, cargoVolume } from '../shared/src/sim/shipstats.ts';
import { canLearn, TALENTS } from '../shared/src/data/talents.ts';
import { generateWorld, isLand, navBlocked } from '../shared/src/world/worldgen.ts';
import { NAV_CELL, WORLD_SEED } from '../shared/src/constants.ts';
import { segmentHitsHull } from '../shared/src/math.ts';

const params = (over: Partial<SailParams> = {}): SailParams => ({
  rig: 'square', maxSpeed: 14, accel: 1.5, turnRate: 0.3, noGoDeg: 65, sailChangeRate: 0.5, currentMul: 0, sailHealth: 1,
  rudderHealth: 1, crewFactor: 1, loadFactor: 1, speedMul: 1, personalWind: false, weatherly: false, ...over,
});

test('polar: head to wind is dead, a broad reach is the best point of sail', () => {
  assert.ok(polarEfficiency('square', 10, 65) < 0.05);
  assert.ok(polarEfficiency('square', 140, 65) > 0.95);
  assert.ok(polarEfficiency('fore_aft', 50, 42) > polarEfficiency('square', 50, 65), 'fore-and-aft rigs point higher');
});

test('polar: a smaller no-go angle (talents) opens up the close-hauled course', () => {
  assert.equal(polarEfficiency('square', 60, 65), 0.04 * (60 / 65));
  assert.ok(polarEfficiency('square', 60, 55) > 0.3);
});

test('sailing: a ship accelerates downwind and stays put head to wind', () => {
  const wind = { dir: Math.PI, strength: 0.8 }; // blowing south
  let down: SailState = { x: 0, y: 0, heading: Math.PI, speed: 0, sail: 1, rudder: 0 };
  let up: SailState = { x: 0, y: 0, heading: 0, speed: 0, sail: 1, rudder: 0 };
  for (let i = 0; i < 200; i++) {
    down = stepSailing(down, { rudder: 0, sailTarget: 1 }, params(), wind, { x: 0, y: 0 }, 0.05);
    up = stepSailing(up, { rudder: 0, sailTarget: 1 }, params(), wind, { x: 0, y: 0 }, 0.05);
  }
  assert.ok(down.speed > 8, `downwind speed ${down.speed}`);
  assert.ok(down.y > 50, 'moved south');
  assert.ok(up.speed < 1, `head-to-wind speed ${up.speed}`);
});

test('sailing: a stopped ship can still come about (no permanent irons)', () => {
  let s: SailState = { x: 0, y: 0, heading: 0, speed: 0, sail: 0, rudder: 0 };
  for (let i = 0; i < 60; i++) s = stepSailing(s, { rudder: 1, sailTarget: 0 }, params(), { dir: Math.PI, strength: 0.5 }, { x: 0, y: 0 }, 0.05);
  assert.ok(s.heading > 0.2, `heading ${s.heading}`);
});

test('ship stats: modules, talents and keystones stack as designed', () => {
  const loadout = { classId: 'sloop' as const, name: 'x', guns: { port: 'light_6' as const, starboard: 'light_6' as const }, modules: { hull_plating: 2 } };
  const base = computeShipStats({ ...loadout, modules: {} }, 'corsair', {});
  const plated = computeShipStats(loadout, 'corsair', {});
  assert.ok(plated.hullMax > base.hullMax && plated.maxSpeed < base.maxSpeed);
  const windborn = computeShipStats({ ...loadout, modules: {} }, 'corsair', { nav_windborn: 1 });
  assert.ok(windborn.maxSpeed > base.maxSpeed * 1.14 && windborn.hullMax < base.hullMax * 0.8);
  const smuggler = computeShipStats({ ...loadout, modules: {} }, 'smuggler', {});
  assert.ok(cargoVolume({ dreamleaf: 10 }, smuggler.contrabandVolumeMul) < 10, 'False Bottom shrinks contraband');
});

test('talents: tier gating, rank caps and the two-keystone limit are enforced', () => {
  assert.equal(canLearn({}, 'gun_fast_hands', 1), null);
  assert.match(canLearn({}, 'gun_tangled_rigging', 5) ?? '', /Requires 2/);
  assert.equal(canLearn({ gun_fast_hands: 3 }, 'gun_tangled_rigging', 5), null);
  assert.match(canLearn({ gun_fast_hands: 3 }, 'gun_fast_hands', 5) ?? '', /max rank/);
  assert.match(canLearn({}, 'gun_fast_hands', 0) ?? '', /No talent points/);
  const full = { gun_fast_hands: 3, gun_steady_aim: 3, gun_iron_rain: 1, nav_close_hauled: 3, nav_quick_trim: 2, nav_night_runner: 1, nav_windborn: 1, srv_carpenters: 3, srv_iron_hull: 3 };
  assert.match(canLearn(full, 'srv_unsinkable', 5) ?? '', /two keystones/);
  assert.ok(TALENTS.every((t) => t.maxRank >= 1));
});

test('world: generation is deterministic, ports are at sea and reachable', () => {
  const a = generateWorld(WORLD_SEED);
  const b = generateWorld(WORLD_SEED);
  assert.equal(a.islands.length, b.islands.length);
  assert.deepEqual(a.islands[100].poly, b.islands[100].poly);
  assert.ok(a.islands.length > 400, 'hundreds of islands');
  for (const p of a.ports) {
    assert.equal(isLand(a, p.x, p.y), null, `${p.id} anchor on land`);
    assert.equal(navBlocked(a, Math.floor(p.x / NAV_CELL), Math.floor(p.y / NAV_CELL)), false, `${p.id} unreachable`);
  }
});

test('math: segment vs hull ellipse', () => {
  // Hull centred at origin, heading north, 40 m long, 10 m wide.
  assert.ok(segmentHitsHull(-50, 0, 50, 0, 0, 0, 0, 20, 5) >= 0, 'broadside crossing hits');
  assert.equal(segmentHitsHull(-50, 30, 50, 30, 0, 0, 0, 20, 5), -1, 'passes ahead of the bow');
});
