import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';
import type { AddressInfo } from 'node:net';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { REGION_IDS } from '../shared/src/world/regions.ts';
import { parseLayout, zoneAt } from '../shared/src/world/zones.ts';
import { AuthService } from '../server/src/auth.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { Game } from '../server/src/game/Game.ts';
import { Gateway } from '../server/src/net/gateway.ts';
import { LinkServer } from '../server/src/net/link.ts';
import { Database } from '../server/src/persistence/db.ts';
import { ZoneRuntime } from '../server/src/zones/zone.ts';

const SECRET = 'zones-test-secret-0123456789';
const LAYOUT = parseLayout(`west=black_coast;east=${REGION_IDS.filter((r) => r !== 'black_coast').join(',')}`);
const BORDER_X = 41_000; // where the Black Coast meets Gravewater, at Saltmarrow's latitude
const LAT = 87_180;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function world() {
  const dir = mkdtempSync(pathJoin(tmpdir(), 'zones-'));
  const file = pathJoin(dir, 'world.db');
  const mk = () => {
    const db = new Database(file);
    const game = new Game({ db, auth: new AuthService(db), log: () => {} });
    return { db, game };
  };
  const W = mk(), E = mk();
  const ze = new ZoneRuntime(E.game, { id: 'east', layout: LAYOUT, secret: SECRET, peers: [{ id: 'west', host: '127.0.0.1', port: 0 }], log: () => {} });
  const ePort = await ze.listen(0);
  const zw = new ZoneRuntime(W.game, { id: 'west', layout: LAYOUT, secret: SECRET, peers: [{ id: 'east', host: '127.0.0.1', port: ePort }], log: () => {} });
  await zw.listen(0);
  const lw = new LinkServer({ secret: SECRET, zone: 'west', attach: (c) => W.game.attach(c), log: () => {} });
  const le = new LinkServer({ secret: SECRET, zone: 'east', attach: (c) => E.game.attach(c), log: () => {} });
  const pw = await lw.listen(0), pe = await le.listen(0);
  const gw = new Gateway({ zones: [{ name: 'west', host: '127.0.0.1', port: pw }, { name: 'east', host: '127.0.0.1', port: pe }], secret: SECRET, log: () => {} });
  gw.start();
  const http = createServer((_q, r) => r.writeHead(404).end());
  http.on('upgrade', (req, sock) => gw.handleUpgrade(req, sock));
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${(http.address() as AddressInfo).port}/ws`;
  // Both zones tick together; the network gets a moment between ticks.
  const pump = async (ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      W.game.step();
      E.game.step();
      if (i % 4 === 0) await wait(2);
    }
    await wait(20);
  };
  const until = async (cond: () => boolean, ticks = 400) => {
    for (let i = 0; i < ticks && !cond(); i += 10) await pump(10);
    assert.ok(cond(), 'timed out');
  };
  const close = async () => {
    gw.stop();
    http.close();
    zw.stop();
    ze.stop();
    await lw.close();
    await le.close();
    W.db.close();
    E.db.close();
    rmSync(dir, { recursive: true, force: true });
  };
  await until(() => gw.zones.every((z) => z.up) && zw.up('east') && ze.up('west'));
  return { W: W.game, E: E.game, gw, url, pump, until, close };
}

class Client {
  ws: WebSocket;
  msgs: { t: string; [k: string]: unknown }[] = [];
  closed: number | null = null;
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) this.msgs.push(JSON.parse(String(ev.data)));
    };
    this.ws.onclose = (ev) => (this.closed = ev.code);
  }
  open(): Promise<void> {
    return new Promise((r) => (this.ws.onopen = () => r()));
  }
  send(m: unknown): void {
    this.ws.send(JSON.stringify(m));
  }
  count(t: string): number {
    return this.msgs.filter((m) => m.t === t).length;
  }
}

test('the layout covers every region once; a point belongs to the zone of its region', () => {
  assert.throws(() => parseLayout('a=black_coast'), /in no zone/);
  assert.throws(() => parseLayout(`a=black_coast;b=black_coast,${REGION_IDS.slice(1).join(',')}`), /two zones/);
  const g = new Game({ db: new Database(':memory:'), auth: new AuthService(new Database(':memory:')), log: () => {} });
  assert.equal(zoneAt(LAYOUT, g.world, BORDER_X - 500, LAT), 'west');
  assert.equal(zoneAt(LAYOUT, g.world, BORDER_X + 500, LAT), 'east');
});

test('two zones: a captain is handed to the zone of her waters, seen across the line as a ghost, hit across it, and handed over when she crosses', async () => {
  const z = await world();
  try {
    const c = new Client(z.url);
    await c.open();
    c.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Zoe Line' });
    await z.until(() => c.count('welcome') > 0);
    c.send({ t: 'create_captain', captain: 'corsair', shipName: 'Line Runner' });
    // Saltmarrow is in the west: wherever the gateway first sent her, she ends up there.
    await z.until(() => !!z.W.sessionByName('Zoe Line')?.ship);
    const s = z.W.sessionByName('Zoe Line')!;
    const id = s.ship!.id;
    assert.equal(z.E.sessionByName('Zoe Line'), undefined);
    // Out to sea, near the line (still western water): the east sees a ghost.
    c.send({ t: 'undock' });
    await z.pump(10);
    const ship = s.ship!;
    ship.state.x = BORDER_X - 600;
    ship.state.y = LAT;
    ship.input = { rudder: 0, sailTarget: 0 };
    ship.state.speed = 0;
    ship.state.sail = 0;
    ship.protectedUntil = 0;
    z.W.grid.upsert(id, ship.state.x, ship.state.y);
    await z.until(() => !!z.E.ships.get(id)?.ghost);
    const ghost = z.E.ships.get(id)!;
    assert.ok(Math.abs(ghost.state.x - ship.state.x) < 1);
    // An eastern shot at the ghost lands on the real ship in the west.
    const hull = ship.hull;
    applyDamage(z.E, ghost, { hull: 40 }, null);
    await z.until(() => ship.hull < hull);
    assert.ok(Math.abs(hull - ship.hull - 40) < 1e-6);
    // An eastern merchant, sunk by her across the line: the credit is paid in the west.
    const m = z.E.spawnNpcShip('merchant', 'fluyt', 'league', BORDER_X + 500, LAT, 0, { ship: 'Line Fluyt', captain: 'F' });
    z.E.npcs.delete(m.id);
    m.input = { rudder: 0, sailTarget: 0 };
    m.state.sail = 0;
    z.E.grid.upsert(m.id, m.state.x, m.state.y);
    await z.until(() => !!z.W.ships.get(m.id)?.ghost);
    const xp = s.profile!.xp + s.profile!.level * 1e6;
    m.attackers.set(id, z.E.now);
    m.hull = 0;
    z.E.beginSinking(m);
    await z.until(() => s.profile!.xp + s.profile!.level * 1e6 > xp);
    assert.ok(c.msgs.some((x) => x.t === 'toast' && String(x.msg).includes('Line Fluyt')), 'she hears of it');
    // She crosses: frozen, handed over, the session moved by the gateway, the same ship id in the east.
    const inits = c.count('init');
    ship.state.x = BORDER_X + 400;
    z.W.grid.upsert(id, ship.state.x, ship.state.y);
    await z.until(() => !!z.E.sessionByName('Zoe Line')?.ship);
    const es = z.E.sessionByName('Zoe Line')!;
    assert.equal(es.ship!.id, id, 'the same ship');
    assert.ok(!es.ship!.ghost);
    assert.ok(Math.abs(es.ship!.hull - ship.hull) < 1, 'her damage came with her');
    assert.equal(z.W.sessionByName('Zoe Line'), undefined);
    await z.until(() => c.count('init') > inits);
    assert.equal(c.closed, null, 'the client never lost its socket');
    assert.equal(z.gw.stats().moves >= 1, true);
    // Now the west sees her as a ghost of the east.
    await z.until(() => !!z.W.ships.get(id)?.ghost);
    c.ws.close();
  } finally {
    await z.close();
  }
});

test('shared records: a guild founded in one zone is known in the other', async () => {
  const z = await world();
  try {
    const W = z.W, E = z.E;
    // A captain created directly in the east (a port there), founding a guild.
    const port = E.zonePorts()[0];
    assert.ok(port && E.inZone(port.x, port.y));
    const acct = E.auth.register('Gil Founder') as { accountId: number };
    E.guilds.store(E); // load
    const st = E.guilds.store(E);
    st.guilds[99] = { id: 99, name: 'Cross Guild', tag: 'XG', created: 0, members: [{ account: acct.accountId, name: 'Gil Founder', rank: 'admiral', joined: 0, out: { day: 0, value: 0 } }], treasury: 0, tax: 0, offices: {}, stores: {}, contracts: [], fleet: [], flagship: null, tornUntil: 0, log: [], invites: [], alliance: [], pacts: [], offers: [], bans: {}, nextId: 1 };
    st.next = 100;
    E.guilds.touch();
    W.guilds.store(W); // the west has its own (now stale) copy
    assert.equal(W.guilds.of(W, acct.accountId), null);
    await z.pump(4); // the east writes and tells the west
    assert.equal(W.guilds.of(W, acct.accountId)?.tag, 'XG');
  } finally {
    await z.close();
  }
});

test('NPCs spawn only in their own zone, and ids never collide between zones', async () => {
  const z = await world();
  try {
    z.W.bootPopulation();
    z.E.bootPopulation();
    for (const s of z.W.ships.values()) if (!s.ghost && !s.isPlayer) assert.ok(z.W.inZone(s.state.x, s.state.y) || s.ownerId !== null, `${s.name} at ${s.state.x},${s.state.y}`);
    for (const s of z.E.ships.values()) if (!s.ghost && !s.isPlayer) assert.ok(z.E.inZone(s.state.x, s.state.y) || s.ownerId !== null);
    const wIds = new Set([...z.W.ships.values()].filter((s) => !s.ghost).map((s) => s.id));
    for (const s of z.E.ships.values()) if (!s.ghost) assert.ok(!wIds.has(s.id), 'no shared ids');
  } finally {
    await z.close();
  }
});
