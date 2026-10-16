// Binary codec for the hot path: world snapshots (10 Hz per player). Everything else stays JSON.
// Little-endian, quantized: positions 0.1 m (int32), headings 1e-4 rad (int16), fractions 1/250 (uint8).
// Layout version is the first byte so the format can evolve without breaking old clients silently.
//
// v7 (2026-10-16, docs/33 §Сеть): field-level DELTAS against what this client already holds. Both ends keep a
// SnapState per connection (the server per session, the client per socket; both start empty again at 'init'):
//  - a ship row is `varint(id·2 + abs)`; abs = the whole row with absolute positions (first sight, or a jump too far
//    for 16 bits); otherwise a mask byte of the fields that changed, positions as 16-bit deltas of 0.1 m;
//  - the self row is a 48-bit mask of its 42 fields and only the changed ones.
// The quantised values are the base on both sides, so deltas never drift. A delta for a row the receiver does not
// hold (a stray snapshot across a zone handoff) throws MissingBase, and the receiver drops that one snapshot.
// Called without a state, the encoder writes everything whole and the decoder reads that (the tests' round trips).

import { AMMO_IDS, emptyAmmo } from './data/ships.ts';
import type { AmmoId } from './data/ships.ts';
import { wrapAngle } from './math.ts';
import type { LootRow, SelfRow, ServerMsg, ShipRow, WeatherKind } from './protocol.ts';
import { STATIONS } from './protocol.ts';
import { REGION_IDS } from './world/regions.ts';
import type { RegionId } from './world/regions.ts';

export const SNAP_CODEC_VERSION = 7;
const WEATHER: WeatherKind[] = ['calm', 'breeze', 'wind', 'fog', 'rain', 'storm', 'black_storm'];

type Snap = Extract<ServerMsg, { t: 'snap' }>;

/** What one end of one connection holds: the last quantised row of every ship and of the self row. */
export class SnapState {
  ships = new Map<number, number[]>();
  self: number[] | null = null;
  reset(): void {
    this.ships.clear();
    this.self = null;
  }
}

export class MissingBase extends Error {}

const HEADER = 1 + 4 + 8 + 4 + 2 + 1 + 1 + 1 + 1 + 1;
const LOOT = 4 + 4 + 4;

const q8 = (v: number) => Math.max(0, Math.min(250, Math.round(v * 250)));
const u16 = (v: number) => Math.max(0, Math.min(65535, Math.round(v)));
const ang = (v: number) => Math.round(wrapAngle(v) * 10000);
const pct = (v: number) => Math.round(Math.max(0, Math.min(100, v)));

// ---------------------------------------------------------------- the self row: 42 quantised fields

type Kind = 'i32' | 'i16' | 'u16' | 'u8' | 'i8' | 'u32';
const WIDTH: Record<Kind, number> = { i32: 4, i16: 2, u16: 2, u8: 1, i8: 1, u32: 4 };
interface Field { k: Kind; q: (y: SelfRow) => number }
const SELF_FIELDS: Field[] = [
  { k: 'i32', q: (y) => Math.round(y.x * 10) },
  { k: 'i32', q: (y) => Math.round(y.y * 10) },
  { k: 'i16', q: (y) => ang(y.h) },
  { k: 'u16', q: (y) => u16(y.spd * 100) },
  { k: 'u8', q: (y) => q8(y.sail) },
  { k: 'i8', q: (y) => Math.round(Math.max(-1, Math.min(1, y.rud)) * 100) },
  { k: 'u8', q: (y) => q8(y.sailT) },
  { k: 'u16', q: (y) => u16(y.hull) },
  { k: 'u16', q: (y) => u16(y.hullMax) },
  { k: 'u16', q: (y) => u16(y.sails) },
  { k: 'u16', q: (y) => u16(y.sailsMax) },
  { k: 'u8', q: (y) => q8(y.rudderHp) },
  { k: 'u16', q: (y) => u16(y.crew) },
  { k: 'u16', q: (y) => u16(y.crewMax) },
  { k: 'u8', q: (y) => pct(y.morale) },
  { k: 'u8', q: (y) => q8(y.reload.port) },
  { k: 'u8', q: (y) => q8(y.reload.starboard) },
  { k: 'u8', q: (y) => q8(y.reload.bow) },
  { k: 'u8', q: (y) => q8(y.reload.stern) },
  { k: 'u8', q: (y) => q8(y.reload.mount) },
  { k: 'u8', q: (y) => AMMO_IDS.indexOf(y.ammoSel) },
  ...AMMO_IDS.map((a): Field => ({ k: 'u16', q: (y) => u16(y.ammo[a]) })),
  { k: 'u32', q: (y) => y.flags >>> 0 },
  { k: 'u8', q: (y) => (y.combat ? 1 : 0) | (y.underFire ? 2 : 0) }, // (bit 2: another ship's fire on her, 2026-10-07)
  { k: 'u8', q: (y) => q8(y.water) },
  { k: 'u8', q: (y) => Math.min(255, y.leaks) },
  { k: 'u8', q: (y) => STATIONS.indexOf(y.station) },
  { k: 'u8', q: (y) => pct(y.resolve) },
  { k: 'u8', q: (y) => pct(y.dread) },
  { k: 'u8', q: (y) => pct(y.sanity) },
];
const NSELF = SELF_FIELDS.length;
const SELF_MASK = Math.ceil(NSELF / 8);
const SELF_MAX = SELF_MASK + SELF_FIELDS.reduce((a, f) => a + WIDTH[f.k], 0);

function selfRow(v: number[]): SelfRow {
  let i = 0;
  const n = () => v[i++];
  const x = n() / 10, y = n() / 10, h = n() / 10000, spd = n() / 100, sail = n() / 250, rud = n() / 100, sailT = n() / 250;
  const hull = n(), hullMax = n(), sails = n(), sailsMax = n(), rudderHp = n() / 250, crew = n(), crewMax = n(), morale = n();
  const port = n() / 250, starboard = n() / 250, bow = n() / 250, stern = n() / 250, mount = n() / 250;
  const ammoSel = AMMO_IDS[n()] as AmmoId;
  const ammo = emptyAmmo();
  for (const a of AMMO_IDS) ammo[a] = n();
  const flags = n(), fight = n(), water = n() / 250, leaks = n(), station = STATIONS[n()] ?? 'balanced', resolve = n(), dread = n(), sanity = n();
  return {
    x, y, h, spd, sail, rud, sailT, hull, hullMax, sails, sailsMax, rudderHp, crew, crewMax, morale, reload: { port, starboard, bow, stern, mount },
    ammoSel, ammo, flags, combat: (fight & 1) === 1, underFire: (fight & 2) === 2, water, leaks, station, resolve, dread, sanity,
  };
}

// ---------------------------------------------------------------- ship rows: 9 quantised fields, 8 mask groups

/** [x·10, y·10, h·1e4, spd·100, sail q8, hull·1e4, sails q8, flags, crew q8] */
function shipInts(r: ShipRow): number[] {
  return [Math.round(r[1] * 10), Math.round(r[2] * 10), ang(r[3]), u16(r[4] * 100), q8(r[5]), u16(Math.max(0, Math.min(1, r[6])) * 10000), q8(r[7]), r[8] >>> 0, q8(r[9])];
}
const SHIP_KINDS: Kind[] = ['i32', 'i32', 'i16', 'u16', 'u8', 'u16', 'u8', 'u32', 'u8'];
const SHIP_MAX = 5 + SHIP_KINDS.reduce((a, k) => a + WIDTH[k], 0);

class W {
  d: DataView;
  o = 0;
  constructor(buf: ArrayBuffer) { this.d = new DataView(buf); }
  put(k: Kind, v: number): void {
    const d = this.d;
    switch (k) {
      case 'i32': d.setInt32(this.o, v, true); break;
      case 'u32': d.setUint32(this.o, v >>> 0, true); break;
      case 'i16': d.setInt16(this.o, v, true); break;
      case 'u16': d.setUint16(this.o, v, true); break;
      case 'u8': d.setUint8(this.o, v); break;
      case 'i8': d.setInt8(this.o, v); break;
    }
    this.o += WIDTH[k];
  }
  varint(v: number): void {
    while (v >= 0x80) { this.d.setUint8(this.o++, (v % 0x80) | 0x80); v = Math.floor(v / 0x80); }
    this.d.setUint8(this.o++, v);
  }
}

class R {
  o = 0;
  d: DataView;
  constructor(d: DataView) { this.d = d; }
  get(k: Kind): number {
    const d = this.d, o = this.o;
    this.o += WIDTH[k];
    switch (k) {
      case 'i32': return d.getInt32(o, true);
      case 'u32': return d.getUint32(o, true);
      case 'i16': return d.getInt16(o, true);
      case 'u16': return d.getUint16(o, true);
      case 'u8': return d.getUint8(o);
      case 'i8': return d.getInt8(o);
    }
  }
  varint(): number {
    let v = 0, mul = 1, b: number;
    do { b = this.d.getUint8(this.o++); v += (b & 0x7f) * mul; mul *= 0x80; } while (b & 0x80);
    return v;
  }
}

export function encodeSnap(m: Snap, st: SnapState = new SnapState()): Uint8Array {
  const buf = new ArrayBuffer(HEADER + (m.you ? SELF_MAX : 0) + 2 + m.ships.length * SHIP_MAX + 2 + m.loot.length * LOOT);
  const w = new W(buf);
  const d = w.d;
  w.put('u8', SNAP_CODEC_VERSION);
  w.put('u32', m.tick);
  d.setFloat64(w.o, m.time, true); w.o += 8;
  w.put('u32', m.ack >>> 0);
  w.put('i16', ang(m.wind[0]));
  w.put('u8', Math.round(Math.min(2.5, m.wind[1]) * 100));
  w.put('u8', WEATHER.indexOf(m.weather));
  w.put('u8', REGION_IDS.indexOf(m.region));
  w.put('u8', q8(m.fog));
  // Bit 0: a self row follows; bits 1-7: the admin time scale ×4 (0 = normal time).
  w.put('u8', (m.you ? 1 : 0) | (m.k && m.k !== 1 ? Math.max(1, Math.min(127, Math.round(m.k * 4))) << 1 : 0));
  if (m.you) {
    const v = SELF_FIELDS.map((f) => f.q(m.you!));
    const base = st.self;
    const at = w.o;
    w.o += SELF_MASK;
    for (let i = 0; i < NSELF; i++) {
      if (base && base[i] === v[i]) continue;
      d.setUint8(at + (i >> 3), d.getUint8(at + (i >> 3)) | (1 << (i & 7)));
      w.put(SELF_FIELDS[i].k, v[i]);
    }
    st.self = v;
  }
  w.put('u16', m.ships.length);
  for (const r of m.ships) {
    const v = shipInts(r);
    const id = r[0] >>> 0;
    const base = st.ships.get(id);
    const dx = base ? v[0] - base[0] : 0, dy = base ? v[1] - base[1] : 0;
    if (!base || Math.abs(dx) > 32767 || Math.abs(dy) > 32767) {
      w.varint(id * 2 + 1);
      for (let i = 0; i < 9; i++) w.put(SHIP_KINDS[i], v[i]);
    } else {
      w.varint(id * 2);
      const at = w.o++;
      let mask = 0;
      if (dx || dy) { mask |= 1; w.put('i16', dx); w.put('i16', dy); }
      for (let i = 2; i < 9; i++) if (v[i] !== base[i]) { mask |= 1 << (i - 1); w.put(SHIP_KINDS[i], v[i]); }
      d.setUint8(at, mask);
    }
    st.ships.set(id, v);
  }
  w.put('u16', m.loot.length);
  for (const l of m.loot) {
    w.put('u32', l[0]);
    w.put('i32', Math.round(l[1]));
    w.put('i32', Math.round(l[2]));
  }
  return new Uint8Array(buf, 0, w.o);
}

export function decodeSnap(input: ArrayBuffer | Uint8Array, st: SnapState = new SnapState()): Snap {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const r = new R(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  const version = r.get('u8');
  if (version !== SNAP_CODEC_VERSION) throw new Error(`snapshot codec v${version} unsupported`);
  const tick = r.get('u32');
  const time = r.d.getFloat64(r.o, true); r.o += 8;
  const ack = r.get('u32');
  const windDir = r.get('i16') / 10000;
  const windS = r.get('u8') / 100;
  const weather = WEATHER[r.get('u8')];
  const region = REGION_IDS[r.get('u8')] as RegionId;
  const fog = r.get('u8') / 250;
  const flags = r.get('u8');
  const hasYou = (flags & 1) === 1;
  const k = flags >> 1 ? (flags >> 1) / 4 : undefined;
  // Read whole before touching the state: a snapshot that cannot be decoded leaves the state as it was.
  let selfV: number[] | null = null;
  if (hasYou) {
    const at = r.o;
    r.o += SELF_MASK;
    selfV = st.self ? st.self.slice() : new Array<number>(NSELF);
    for (let i = 0; i < NSELF; i++) {
      if (r.d.getUint8(at + (i >> 3)) & (1 << (i & 7))) selfV[i] = r.get(SELF_FIELDS[i].k);
      else if (!st.self) throw new MissingBase('self');
    }
  }
  const nShips = r.get('u16');
  const rows: [number, number[]][] = [];
  for (let i = 0; i < nShips; i++) {
    const h = r.varint();
    const id = Math.floor(h / 2);
    let v: number[];
    if (h % 2) {
      v = SHIP_KINDS.map((kd) => r.get(kd));
    } else {
      const base = st.ships.get(id);
      if (!base) throw new MissingBase(`ship ${id}`);
      v = base.slice();
      const mask = r.get('u8');
      if (mask & 1) { v[0] += r.get('i16'); v[1] += r.get('i16'); }
      for (let f = 2; f < 9; f++) if (mask & (1 << (f - 1))) v[f] = r.get(SHIP_KINDS[f]);
    }
    rows.push([id, v]);
  }
  const nLoot = r.get('u16');
  const loot: LootRow[] = [];
  for (let i = 0; i < nLoot; i++) loot.push([r.get('u32'), r.get('i32'), r.get('i32')]);
  let you: SelfRow | null = null;
  if (selfV) { st.self = selfV; you = selfRow(selfV); }
  const ships: ShipRow[] = rows.map(([id, v]) => {
    st.ships.set(id, v);
    return [id, v[0] / 10, v[1] / 10, v[2] / 10000, v[3] / 100, v[4] / 250, v[5] / 10000, v[6] / 250, v[7], v[8] / 250];
  });
  return { t: 'snap', tick, time, ack, you, ships, loot, wind: [windDir, windS], weather, region, fog, ...(k ? { k } : {}) };
}
