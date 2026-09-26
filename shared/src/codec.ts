// Binary codec for the hot path: world snapshots (10 Hz per player). Everything else stays JSON.
// Little-endian, quantized: positions 0.1 m (int32), headings 1e-4 rad (int16), fractions 1/250 (uint8).
// Layout version is the first byte so the format can evolve without breaking old clients silently.

import { AMMO_IDS, emptyAmmo } from './data/ships.ts';
import type { AmmoId } from './data/ships.ts';
import { wrapAngle } from './math.ts';
import type { LootRow, SelfRow, ServerMsg, ShipRow, WeatherKind } from './protocol.ts';
import { STATIONS } from './protocol.ts';
import { REGION_IDS } from './world/regions.ts';
import type { RegionId } from './world/regions.ts';

export const SNAP_CODEC_VERSION = 6;
const WEATHER: WeatherKind[] = ['calm', 'breeze', 'wind', 'fog', 'rain', 'storm', 'black_storm'];

type Snap = Extract<ServerMsg, { t: 'snap' }>;

const HEADER = 1 + 4 + 8 + 4 + 2 + 1 + 1 + 1 + 1 + 1;
const SELF = 4 + 4 + 2 + 2 + 1 + 1 + 1 + 2 * 4 + 1 + 2 * 2 + 1 + 1 + 1 + 1 + 1 + 1 + 2 * AMMO_IDS.length + 4 + 1 + 3 + 1 + 3;
const SHIP = 4 + 4 + 4 + 2 + 2 + 1 + 2 + 1 + 4 + 1;
const LOOT = 4 + 4 + 4;

const q8 = (v: number) => Math.max(0, Math.min(250, Math.round(v * 250)));
const u16 = (v: number) => Math.max(0, Math.min(65535, Math.round(v)));
const ang = (v: number) => Math.round(wrapAngle(v) * 10000);

export function encodeSnap(m: Snap): Uint8Array {
  const size = HEADER + (m.you ? SELF : 0) + 2 + m.ships.length * SHIP + 2 + m.loot.length * LOOT;
  const buf = new ArrayBuffer(size);
  const d = new DataView(buf);
  let o = 0;
  d.setUint8(o, SNAP_CODEC_VERSION); o += 1;
  d.setUint32(o, m.tick, true); o += 4;
  d.setFloat64(o, m.time, true); o += 8;
  d.setUint32(o, m.ack >>> 0, true); o += 4;
  d.setInt16(o, ang(m.wind[0]), true); o += 2;
  d.setUint8(o, Math.round(Math.min(2.5, m.wind[1]) * 100)); o += 1;
  d.setUint8(o, WEATHER.indexOf(m.weather)); o += 1;
  d.setUint8(o, REGION_IDS.indexOf(m.region)); o += 1;
  d.setUint8(o, q8(m.fog)); o += 1;
  // Bit 0: a self row follows; bits 1-7: the admin time scale ×4 (0 = normal time).
  d.setUint8(o, (m.you ? 1 : 0) | (m.k && m.k !== 1 ? Math.max(1, Math.min(127, Math.round(m.k * 4))) << 1 : 0)); o += 1;
  if (m.you) {
    const y = m.you;
    d.setInt32(o, Math.round(y.x * 10), true); o += 4;
    d.setInt32(o, Math.round(y.y * 10), true); o += 4;
    d.setInt16(o, ang(y.h), true); o += 2;
    d.setUint16(o, u16(y.spd * 100), true); o += 2;
    d.setUint8(o, q8(y.sail)); o += 1;
    d.setInt8(o, Math.round(Math.max(-1, Math.min(1, y.rud)) * 100)); o += 1;
    d.setUint8(o, q8(y.sailT)); o += 1;
    d.setUint16(o, u16(y.hull), true); o += 2;
    d.setUint16(o, u16(y.hullMax), true); o += 2;
    d.setUint16(o, u16(y.sails), true); o += 2;
    d.setUint16(o, u16(y.sailsMax), true); o += 2;
    d.setUint8(o, q8(y.rudderHp)); o += 1;
    d.setUint16(o, u16(y.crew), true); o += 2;
    d.setUint16(o, u16(y.crewMax), true); o += 2;
    d.setUint8(o, Math.round(Math.max(0, Math.min(100, y.morale)))); o += 1;
    d.setUint8(o, q8(y.reload.port)); o += 1;
    d.setUint8(o, q8(y.reload.starboard)); o += 1;
    d.setUint8(o, q8(y.reload.bow)); o += 1;
    d.setUint8(o, q8(y.reload.stern)); o += 1;
    d.setUint8(o, q8(y.reload.mount)); o += 1;
    d.setUint8(o, AMMO_IDS.indexOf(y.ammoSel)); o += 1;
    for (const a of AMMO_IDS) { d.setUint16(o, u16(y.ammo[a]), true); o += 2; }
    d.setUint32(o, y.flags >>> 0, true); o += 4;
    d.setUint8(o, y.combat ? 1 : 0); o += 1;
    d.setUint8(o, q8(y.water)); o += 1;
    d.setUint8(o, Math.min(255, y.leaks)); o += 1;
    d.setUint8(o, STATIONS.indexOf(y.station)); o += 1;
    d.setUint8(o, Math.round(Math.max(0, Math.min(100, y.resolve)))); o += 1;
    d.setUint8(o, Math.round(Math.max(0, Math.min(100, y.dread)))); o += 1;
    d.setUint8(o, Math.round(Math.max(0, Math.min(100, y.sanity)))); o += 1;
  }
  d.setUint16(o, m.ships.length, true); o += 2;
  for (const r of m.ships) {
    d.setUint32(o, r[0], true); o += 4;
    d.setInt32(o, Math.round(r[1] * 10), true); o += 4;
    d.setInt32(o, Math.round(r[2] * 10), true); o += 4;
    d.setInt16(o, ang(r[3]), true); o += 2;
    d.setUint16(o, u16(r[4] * 100), true); o += 2;
    d.setUint8(o, q8(r[5])); o += 1;
    d.setUint16(o, u16(Math.max(0, Math.min(1, r[6])) * 10000), true); o += 2;
    d.setUint8(o, q8(r[7])); o += 1;
    d.setUint32(o, r[8] >>> 0, true); o += 4;
    d.setUint8(o, q8(r[9])); o += 1;
  }
  d.setUint16(o, m.loot.length, true); o += 2;
  for (const l of m.loot) {
    d.setUint32(o, l[0], true); o += 4;
    d.setInt32(o, Math.round(l[1]), true); o += 4;
    d.setInt32(o, Math.round(l[2]), true); o += 4;
  }
  return new Uint8Array(buf);
}

export function decodeSnap(input: ArrayBuffer | Uint8Array): Snap {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = 0;
  const version = d.getUint8(o); o += 1;
  if (version !== SNAP_CODEC_VERSION) throw new Error(`snapshot codec v${version} unsupported`);
  const tick = d.getUint32(o, true); o += 4;
  const time = d.getFloat64(o, true); o += 8;
  const ack = d.getUint32(o, true); o += 4;
  const windDir = d.getInt16(o, true) / 10000; o += 2;
  const windS = d.getUint8(o) / 100; o += 1;
  const weather = WEATHER[d.getUint8(o)]; o += 1;
  const region = REGION_IDS[d.getUint8(o)] as RegionId; o += 1;
  const fog = d.getUint8(o) / 250; o += 1;
  const flags = d.getUint8(o); o += 1;
  const hasYou = (flags & 1) === 1;
  const k = flags >> 1 ? (flags >> 1) / 4 : undefined;
  let you: SelfRow | null = null;
  if (hasYou) {
    const x = d.getInt32(o, true) / 10; o += 4;
    const y = d.getInt32(o, true) / 10; o += 4;
    const h = d.getInt16(o, true) / 10000; o += 2;
    const spd = d.getUint16(o, true) / 100; o += 2;
    const sail = d.getUint8(o) / 250; o += 1;
    const rud = d.getInt8(o) / 100; o += 1;
    const sailT = d.getUint8(o) / 250; o += 1;
    const hull = d.getUint16(o, true); o += 2;
    const hullMax = d.getUint16(o, true); o += 2;
    const sails = d.getUint16(o, true); o += 2;
    const sailsMax = d.getUint16(o, true); o += 2;
    const rudderHp = d.getUint8(o) / 250; o += 1;
    const crew = d.getUint16(o, true); o += 2;
    const crewMax = d.getUint16(o, true); o += 2;
    const morale = d.getUint8(o); o += 1;
    const port = d.getUint8(o) / 250; o += 1;
    const starboard = d.getUint8(o) / 250; o += 1;
    const bow = d.getUint8(o) / 250; o += 1;
    const stern = d.getUint8(o) / 250; o += 1;
    const mount = d.getUint8(o) / 250; o += 1;
    const ammoSel = AMMO_IDS[d.getUint8(o)] as AmmoId; o += 1;
    const ammo = emptyAmmo();
    for (const a of AMMO_IDS) { ammo[a] = d.getUint16(o, true); o += 2; }
    const flags = d.getUint32(o, true); o += 4;
    const combat = d.getUint8(o) === 1; o += 1;
    const water = d.getUint8(o) / 250; o += 1;
    const leaks = d.getUint8(o); o += 1;
    const station = STATIONS[d.getUint8(o)] ?? 'balanced'; o += 1;
    const resolve = d.getUint8(o); o += 1;
    const dread = d.getUint8(o); o += 1;
    const sanity = d.getUint8(o); o += 1;
    you = { x, y, h, spd, sail, rud, sailT, hull, hullMax, sails, sailsMax, rudderHp, crew, crewMax, morale, reload: { port, starboard, bow, stern, mount }, ammoSel, ammo, flags, combat, water, leaks, station, resolve, dread, sanity };
  }
  const nShips = d.getUint16(o, true); o += 2;
  const ships: ShipRow[] = [];
  for (let i = 0; i < nShips; i++) {
    const id = d.getUint32(o, true); o += 4;
    const x = d.getInt32(o, true) / 10; o += 4;
    const y = d.getInt32(o, true) / 10; o += 4;
    const h = d.getInt16(o, true) / 10000; o += 2;
    const spd = d.getUint16(o, true) / 100; o += 2;
    const sail = d.getUint8(o) / 250; o += 1;
    const hull = d.getUint16(o, true) / 10000; o += 2;
    const sails = d.getUint8(o) / 250; o += 1;
    const flags = d.getUint32(o, true); o += 4;
    const crew = d.getUint8(o) / 250; o += 1;
    ships.push([id, x, y, h, spd, sail, hull, sails, flags, crew]);
  }
  const nLoot = d.getUint16(o, true); o += 2;
  const loot: LootRow[] = [];
  for (let i = 0; i < nLoot; i++) {
    const id = d.getUint32(o, true); o += 4;
    const x = d.getInt32(o, true); o += 4;
    const y = d.getInt32(o, true); o += 4;
    loot.push([id, x, y]);
  }
  return { t: 'snap', tick, time, ack, you, ships, loot, wind: [windDir, windS], weather, region, fog, ...(k ? { k } : {}) };
}
