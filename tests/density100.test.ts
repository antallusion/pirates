// Owner, 2026-10-18: «если там условно 100 человек играет в одной зоне. Плотность кораблей всегда должна быть одинакова».
// A hundred captains farming one region hard — about twelve ships of the sea beaten a second, sunk by the guns or let
// go — and the sea's two layers kept (server/src/game/density.ts): the zone's own ships by role within ±10 % of the
// director's quota and of what that region held, the traffic within 2.5 km of each captain within ±10 % of what it was
// before the killing began; and the cost of putting each one back.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS } from '../shared/src/world/regions.ts';
import { isLand, regionAt } from '../shared/src/world/worldgen.ts';
import { QUOTA } from '../server/src/game/npc.ts';
import { seasonMods } from '../server/src/game/seasons.ts';
import { livingByRole, replaceDefeated, replaceable, replaced } from '../server/src/game/density.ts';
import { NEAR_R, localTraffic, stepTraffic } from '../server/src/game/traffic.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame } from './helpers.ts';

test('100 captains in one region, ~12 ships beaten a second: the zone keeps its ships and each captain her near traffic (±10 %), cheaply', () => {
  const { game } = makeGame();
  game.directorOn = true;
  game.bootPopulation();
  const region = 'gravewater';
  const [cx, cy] = REGIONS[region].center;
  // A hundred captains over the region's open water.
  const caps: ShipEntity[] = [];
  let k = 0;
  while (caps.length < 100 && k < 20000) {
    k++;
    const x = cx + game.rng.range(-11000, 11000), y = cy + game.rng.range(-11000, 11000);
    if (isLand(game.world, x, y) || regionAt(game.world, x, y) !== region) continue;
    const name = `Crowd ${caps.length}`;
    join(game, name);
    const s = game.sessionByName(name)!;
    if (s.profile!.tutorial) s.profile!.tutorial.on = false;
    s.profile!.level = 20;
    const ship = s.ship!;
    if (ship.docked) game.undock(s);
    Object.assign(ship.state, { x, y, speed: 0 });
    ship.region = region;
    ship.protectedUntil = 0;
    game.grid.upsert(ship.id, x, y);
    caps.push(ship);
  }
  assert.equal(caps.length, 100);
  const target: Record<string, number> = { merchant: QUOTA.merchants, pirate: Math.round(QUOTA.pirates * seasonMods(game).pirateMul), fisher: QUOTA.fishers };
  const inRegion = () => {
    let n = 0;
    const local = localTraffic(game);
    for (const b of game.npcs.values()) {
      const o = game.ships.get(b.id);
      // (the zone's own ships of the director's quota: not a revenue cutter sent after a raider, raiding.ts)
      if (o && !local.has(o.id) && !o.sinkingUntil && o.region === region && b.role in target) n++;
    }
    return n;
  };
  const ringAvg = () => {
    let n = 0;
    for (const c of caps) game.forShipsNear(c.state.x, c.state.y, NEAR_R, (o) => {
      if (o.npcRole && !o.sinkingUntil && localTraffic(game).has(o.id) && Math.hypot(o.state.x - c.state.x, o.state.y - c.state.y) < NEAR_R) n++;
    });
    return n / caps.length;
  };
  const second = (kills: number, onKill?: (t: number) => void) => {
    for (const [id, o] of game.ships) if (o.sinkingUntil && o.sinkingUntil <= game.now) game.removeShip(id); // (finalizeSink)
    for (let i = 0; i < kills; i++) onKill?.(i);
    stepTraffic(game);
    if (Math.floor(game.now) % 2 === 0) game.director();
    game.now += 1;
    game.tick += 20; // (the director's every-ten-seconds chores keep their pace: the abstract fights far off)
  };
  // Warm: the sea fills about them, the director tops up its quota.
  for (let t = 0; t < 45; t++) second(0);
  let base = 0;
  let regionBase = 0;
  for (let t = 0; t < 10; t++) {
    second(0);
    base += ringAvg() / 10;
    regionBase += inRegion() / 10;
  }
  for (const r of Object.keys(target)) {
    const n = livingByRole(game)[r] ?? 0;
    assert.ok(Math.abs(n - target[r]) <= target[r] * 0.1, `${r} before: ${n} of ${target[r]}`);
  }
  // The killing: a captain beats the nearest of the sea's ordinary ships about her — by the guns, or lets her go.
  let kills = 0, costMs = 0, tries = 0;
  const kill = (i: number) => {
    const c = caps[(kills * 37 + i) % caps.length];
    let victim: ShipEntity | null = null, bd = Infinity;
    const world = ++tries % 4 === 0; // one in four a ship of the zone's own (far off ones are not on the grid: abstract)
    const look = (o: ShipEntity) => {
      if (o.isPlayer || o.sinkingUntil || !o.alive || !replaceable(game, o) || localTraffic(game).has(o.id) === world) return;
      const d = Math.hypot(o.state.x - c.state.x, o.state.y - c.state.y);
      if (d < bd && (!world || o.region === region)) {
        bd = d;
        victim = o;
      }
    };
    if (world) for (const o of game.ships.values()) look(o);
    else game.forShipsNear(c.state.x, c.state.y, NEAR_R, look);
    if (!victim) return;
    const v = victim as ShipEntity;
    kills++;
    const t0 = performance.now();
    if (kills % 2) {
      v.attackers.set(c.id, game.now);
      game.beginSinking(v);
      v.sinkingUntil = Math.min(v.sinkingUntil, game.now + 1); // (as the choice sinks her)
    } else {
      replaceDefeated(game, v);
      game.removeShip(v.id);
    }
    costMs += performance.now() - t0;
  };
  const worst: Record<string, number> = {};
  let ringWorst = 0, regionWorst = 0;
  const regionSeen: number[] = [];
  const T = 120;
  for (let t = 0; t < T; t++) {
    second(12, kill);
    const by = livingByRole(game);
    for (const r of Object.keys(target)) worst[r] = Math.max(worst[r] ?? 0, Math.abs((by[r] ?? 0) - target[r]) / target[r]);
    ringWorst = Math.max(ringWorst, Math.abs(ringAvg() - base) / base);
    // (the region's by ten-second means: the sea's own churn — a merchant taken far off by a rover, the abstract fights —
    // takes two or three at a time and the director's next passes put them back, with or without the captains' killing)
    regionSeen.push(inRegion());
    if (regionSeen.length >= 10) regionWorst = Math.max(regionWorst, Math.abs(regionSeen.slice(-10).reduce((a, b) => a + b, 0) / 10 - regionBase) / regionBase);
    if (process.env.DENSITY_LOG && t % 10 === 0) console.log(t, ringAvg().toFixed(1), inRegion(), JSON.stringify(livingByRole(game)), localTraffic(game).size, kills);
  }
  const tally = replaced.get(game) ?? { world: 0, ring: 0, missed: 0 };
  console.log(`density: ${kills} beaten in ${T} s; put back ${tally.world} of the zone's, ${tally.ring} on rings, ${tally.missed} left to the top-ups; worst off by role ${JSON.stringify(Object.fromEntries(Object.entries(worst).map(([r, v]) => [r, Math.round(v * 1000) / 10])))} %, region ${(regionWorst * 100).toFixed(1)} % of ${regionBase.toFixed(0)}, ring ${(ringWorst * 100).toFixed(1)} % of ${base.toFixed(1)}; ${(costMs / Math.max(1, kills)).toFixed(3)} ms a ship beaten`);
  assert.ok(kills >= 12 * T * 0.9, `the kill rate: ${kills}`);
  for (const r of Object.keys(target)) assert.ok(worst[r] <= 0.1, `${r}: ${(worst[r] * 100).toFixed(1)} % off`);
  assert.ok(regionWorst <= 0.1, `the region's own ships: ${(regionWorst * 100).toFixed(1)} % off`);
  assert.ok(ringWorst <= 0.1, `the near ring: ${(ringWorst * 100).toFixed(1)} % off ${base.toFixed(1)}`);
  // The tick's cost: a ship beaten costs well under a millisecond to put back (12 a second: under a tenth of a tick's
  // budget of 50 ms spread over the second's twenty ticks).
  assert.ok(costMs / kills < 2, `${(costMs / kills).toFixed(3)} ms a ship beaten`);
});
