import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSnap, encodeSnap } from '../shared/src/codec.ts';
import type { ServerMsg, ShipRow } from '../shared/src/protocol.ts';

type Snap = Extract<ServerMsg, { t: 'snap' }>;

function sample(n: number): Snap {
  const ships: ShipRow[] = [];
  for (let i = 0; i < n; i++) ships.push([1000 + i, 56000.3 + i * 17.7, 70123.9 - i * 9.1, -2.9 + i * 0.3, 11.37, 0.75, 0.6421, 0.48, 64 | 4096, 0.9]);
  return {
    t: 'snap', tick: 123456, time: 98765.43, ack: 77, weather: 'storm', region: 'gravewater', fog: 0.45, wind: [7.9, 1.21],
    you: { x: 56001.2, y: 70002.7, h: 1.2345, spd: 12.34, sail: 0.75, rud: -0.6, sailT: 1, hull: 812, hullMax: 900, sails: 77, sailsMax: 100, rudderHp: 0.8,
      crew: 21, crewMax: 28, morale: 64, reload: { port: 0.5, starboard: 1, bow: 0.2, stern: 1, mount: 0.6 }, ammoSel: 'chain', ammo: { round: 57, chain: 12, grape: 20, incendiary: 5, heavy: 9 }, flags: 128 | 512, combat: true, water: 0.4, leaks: 3, station: 'damage_control', resolve: 73, dread: 41, sanity: 88 },
    ships, loot: [[5, 56100, 70100]],
  };
}

test('snapshot codec round-trips with bounded quantisation error', () => {
  const m = sample(25);
  const d = decodeSnap(encodeSnap(m));
  assert.equal(d.tick, m.tick);
  assert.equal(d.time, m.time);
  assert.equal(d.weather, 'storm');
  assert.equal(d.region, 'gravewater');
  assert.ok(Math.abs(d.you!.x - m.you!.x) <= 0.05 && Math.abs(d.you!.h - m.you!.h) < 1e-4);
  assert.deepEqual(d.you!.ammo, m.you!.ammo);
  assert.equal(d.you!.ammoSel, 'chain');
  assert.equal(d.you!.flags, m.you!.flags);
  // Wind direction is wrapped to (-π, π]: same heading, possibly different representation.
  assert.ok(Math.abs(Math.sin(d.wind[0]) - Math.sin(7.9)) < 1e-3 && Math.abs(Math.cos(d.wind[0]) - Math.cos(7.9)) < 1e-3);
  for (let i = 0; i < m.ships.length; i++) {
    const a = m.ships[i], b = d.ships[i];
    assert.equal(b[0], a[0]);
    assert.ok(Math.abs(b[1] - a[1]) <= 0.05 && Math.abs(b[2] - a[2]) <= 0.05);
    assert.ok(Math.abs(Math.sin(b[3]) - Math.sin(a[3])) < 1e-3);
    assert.ok(Math.abs(b[6] - a[6]) < 1e-3);
    assert.equal(b[8], a[8]);
  }
  assert.deepEqual(d.loot, m.loot);
});

test('binary snapshots are several times smaller than JSON', () => {
  const m = sample(25);
  const bin = encodeSnap(m).byteLength;
  const json = JSON.stringify(m).length;
  assert.ok(bin * 2.5 < json, `binary ${bin} B vs JSON ${json} B`);
});
