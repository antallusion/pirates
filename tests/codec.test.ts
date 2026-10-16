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
      crew: 21, crewMax: 28, morale: 64, reload: { port: 0.5, starboard: 1, bow: 0.2, stern: 1, mount: 0.6 }, ammoSel: 'chain', ammo: { round: 57, chain: 12, grape: 20, incendiary: 5, heavy: 9, cursed: 3, bar: 7, long_shot: 0, star: 4, salt: 11, stinkpot: 2, drag: 6 }, flags: 128 | 512, combat: true, water: 0.4, leaks: 3, station: 'damage_control', resolve: 73, dread: 41, sanity: 88 },
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

test('the snapshot carries an admin time scale without growing, and none in normal time', async () => {
  const { encodeSnap, decodeSnap } = await import('../shared/src/codec.ts');
  const base = { t: 'snap' as const, tick: 1, time: 10, ack: 0, you: null, ships: [], loot: [], wind: [0, 0.5] as [number, number], weather: 'calm' as const, region: 'black_coast' as const, fog: 0.1 };
  assert.equal(decodeSnap(encodeSnap(base)).k, undefined);
  assert.equal(decodeSnap(encodeSnap({ ...base, k: 5 })).k, 5);
  assert.equal(decodeSnap(encodeSnap({ ...base, k: 0.25 })).k, 0.25);
  assert.equal(encodeSnap({ ...base, k: 5 }).byteLength, encodeSnap(base).byteLength);
});

test('codec v7: field deltas against the connection\'s base round-trip exactly, and a moving crowd costs about half', async () => {
  const { encodeSnap, decodeSnap, SnapState, MissingBase } = await import('../shared/src/codec.ts');
  const tx = new SnapState(), rx = new SnapState();
  let m = sample(20);
  let whole = 0, delta = 0;
  for (let k = 0; k < 30; k++) {
    // every ship moves a little and turns; one of them jumps far (a whole row again), one has her hull struck
    m = { ...m, tick: m.tick + 2, you: { ...m.you!, x: m.you!.x + 1.3, h: m.you!.h + 0.01, reload: { ...m.you!.reload, port: (k % 10) / 10 } },
      ships: m.ships.map((r, i) => [r[0], r[1] + 1.37 + (i === 3 && k === 17 ? 9000 : 0), r[2] - 0.71, r[3] + 0.02, r[4], r[5], i === 5 ? 0.9 - k / 100 : r[6], r[7], r[8], r[9]] as ShipRow) };
    const plain = decodeSnap(encodeSnap(m));
    const bytes = encodeSnap(m, tx);
    whole += encodeSnap(m).byteLength;
    delta += bytes.byteLength;
    assert.deepEqual(decodeSnap(bytes, rx), plain, `snapshot ${k} decodes as the whole one does`);
  }
  assert.ok(delta < whole * 0.6, `deltas ${delta} B vs whole ${whole} B`);
  // A delta for a ship this end never held: refused whole, and the base is left as it was.
  const fresh = new SnapState();
  assert.throws(() => decodeSnap(encodeSnap(m, tx), fresh), MissingBase);
  assert.equal(fresh.ships.size, 0);
  assert.equal(fresh.self, null);
});

test('codec v7: an unchanged row costs its id and one byte; ids beyond 2^31 survive the varint', async () => {
  const { encodeSnap, decodeSnap, SnapState } = await import('../shared/src/codec.ts');
  const tx = new SnapState(), rx = new SnapState();
  const m = { ...sample(1), you: null };
  m.ships[0][0] = 4_000_000_000;
  decodeSnap(encodeSnap(m, tx), rx);
  const again = encodeSnap(m, tx);
  assert.equal(again.byteLength, 24 + 2 + 5 + 1 + 2 + 12);
  assert.equal(decodeSnap(again, rx).ships[0][0], 4_000_000_000);
});
