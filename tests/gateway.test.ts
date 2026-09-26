import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { decodeSnap } from '../shared/src/codec.ts';
import { Gateway, parseZones, passThrough } from '../server/src/net/gateway.ts';
import { F, frame, FrameReader, LinkServer, closePayload, readClose } from '../server/src/net/link.ts';
import { makeGame } from './helpers.ts';

const SECRET = 'a-long-enough-link-secret';

async function waitFor(cond: () => boolean, ms = 4000): Promise<void> {
  const until = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > until) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 15));
  }
}

async function world(port = 0) {
  const { game, db } = makeGame();
  const link = new LinkServer({ secret: SECRET, zone: 'w', attach: (c) => game.attach(c), log: () => {} });
  const lp = await link.listen(port);
  return { game, db, link, port: lp };
}

async function gateway(zones: { name: string; port: number }[], opts: Partial<{ rate: number; burst: number; secret: string; perIp: number }> = {}) {
  const gw = new Gateway({ zones: zones.map((z) => ({ name: z.name, host: '127.0.0.1', port: z.port })), secret: opts.secret ?? SECRET, log: () => {}, ...opts });
  gw.start();
  const http = createServer((_q, r) => r.writeHead(404).end());
  http.on('upgrade', (req, sock) => gw.handleUpgrade(req, sock));
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${(http.address() as AddressInfo).port}/ws`;
  return { gw, http, url, stop: () => (gw.stop(), http.close()) };
}

class Client {
  ws: WebSocket;
  texts: { t: string; [k: string]: unknown }[] = [];
  bins = 0;
  lastSnap: ReturnType<typeof decodeSnap> | null = null;
  closeCode: number | null = null;
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        this.bins++;
        this.lastSnap = decodeSnap(ev.data);
      } else this.texts.push(JSON.parse(String(ev.data)));
    };
    this.ws.onclose = (ev) => (this.closeCode = ev.code);
  }
  open(): Promise<void> {
    return new Promise((r, j) => {
      this.ws.onopen = () => r();
      this.ws.onerror = () => j(new Error('ws error'));
    });
  }
  send(m: unknown): void {
    this.ws.send(JSON.stringify(m));
  }
  got(t: string) {
    return this.texts.find((m) => m.t === t);
  }
}

test('link frames survive being cut anywhere', () => {
  const a = frame(F.TEXT, 7, '{"t":"hello"}');
  const b = frame(F.CLOSE, 0xfffffffe, closePayload(4002, 'outdated'));
  const c = frame(F.BIN, 3, new Uint8Array([1, 2, 3, 250]));
  const all = Buffer.concat([a, b, c]);
  for (let cut = 1; cut < all.length; cut += 3) {
    const got: [number, number, Buffer][] = [];
    const r = new FrameReader();
    r.push(all.subarray(0, cut), (t, id, p) => got.push([t, id, Buffer.from(p)]));
    r.push(all.subarray(cut), (t, id, p) => got.push([t, id, Buffer.from(p)]));
    assert.equal(got.length, 3);
    assert.equal(got[0][2].toString(), '{"t":"hello"}');
    assert.equal(got[1][1], 0xfffffffe);
    assert.deepEqual(readClose(got[1][2]), { code: 4002, reason: 'outdated' });
    assert.deepEqual([...got[2][2]], [1, 2, 3, 250]);
  }
  assert.throws(() => new FrameReader().push(Buffer.from([0xff, 0xff, 0xff, 0xff, 0]), () => {}), /bad link frame/);
  assert.deepEqual(parseZones('main=10.0.0.5:9100@http://10.0.0.5:8081/, 10.0.0.6:9100'), [
    { name: 'main', host: '10.0.0.5', port: 9100, http: 'http://10.0.0.5:8081' },
    { name: 'world-2', host: '10.0.0.6', port: 9100, http: undefined },
  ]);
  assert.throws(() => new LinkServer({ secret: 'short', zone: 'x', attach: () => {} }), /16 characters/);
});

test('a player sails through the gateway: hello, welcome, captain, binary snapshots, disconnect', async () => {
  const w = await world();
  const g = await gateway([{ name: 'main', port: w.port }]);
  try {
    await waitFor(() => g.gw.zones[0].up);
    const c = new Client(g.url);
    await c.open();
    c.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Relay Rook' });
    await waitFor(() => !!c.got('welcome'));
    assert.equal(c.got('welcome')!.name, 'Relay Rook');
    assert.equal(w.link.sessions, 1);
    const s = [...(w.game as unknown as { sessions: Set<{ conn: { remote: string } }> }).sessions][0];
    assert.match(s.conn.remote, /127\.0\.0\.1/, 'the world sees the player address, not the gateway');
    c.send({ t: 'create_captain', captain: 'corsair', shipName: 'Relayed Wake' });
    await waitFor(() => !!c.got('init'));
    for (let i = 0; i < 6; i++) w.game.step();
    await waitFor(() => c.bins > 0);
    assert.equal(c.lastSnap?.t, 'snap');
    assert.deepEqual(g.gw.stats().zones, [{ name: 'main', up: true, sessions: 1 }]);
    c.ws.close();
    await waitFor(() => w.link.sessions === 0);
    assert.equal(g.gw.stats().sessions, 0);
  } finally {
    g.stop();
    await w.link.close();
  }
});

test('an outdated client is refused at the gateway and told not to retry; floods are cut off', async () => {
  const w = await world();
  const g = await gateway([{ name: 'main', port: w.port }], { rate: 5, burst: 5 });
  try {
    await waitFor(() => g.gw.zones[0].up);
    const old = new Client(g.url);
    await old.open();
    old.send({ t: 'hello', v: PROTOCOL_VERSION - 1, name: 'Old Salt' });
    await waitFor(() => old.closeCode !== null);
    assert.equal(old.closeCode, 4002);
    assert.match(String(old.got('err')?.msg), /out of date/);
    assert.equal(w.link.sessions, 0, 'never reached the world');

    const loud = new Client(g.url);
    await loud.open();
    loud.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Loud Lark' });
    await waitFor(() => !!loud.got('welcome'));
    for (let i = 0; i < 40; i++) loud.send({ t: 'ping', c: i });
    await waitFor(() => loud.closeCode !== null);
    assert.equal(loud.closeCode, 1008);
    assert.equal(g.gw.stats().kicked.flood, 1);
    await waitFor(() => w.link.sessions === 0);
  } finally {
    g.stop();
    await w.link.close();
  }
});

test('a gateway with the wrong secret is not let in', async () => {
  const w = await world();
  const g = await gateway([{ name: 'main', port: w.port }], { secret: 'not-the-right-secret-at-all' });
  try {
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(g.gw.zones[0].up, false);
    const c = new Client(g.url);
    await c.open();
    c.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Locked Out' });
    await waitFor(() => c.closeCode !== null);
    assert.equal(c.closeCode, 1013, 'no world: try again later');
  } finally {
    g.stop();
    await w.link.close();
  }
});

test('a world restart sends players to reconnect; a captain returns to their own world', async () => {
  const a = await world();
  const b = await world();
  const g = await gateway([{ name: 'a', port: a.port }, { name: 'b', port: b.port }]);
  try {
    await waitFor(() => g.gw.zones.every((z) => z.up));
    const c1 = new Client(g.url);
    await c1.open();
    c1.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'First Mate' });
    await waitFor(() => !!c1.got('welcome'));
    const token = String(c1.got('welcome')!.token);
    const c2 = new Client(g.url);
    await c2.open();
    c2.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Second Mate' });
    await waitFor(() => !!c2.got('welcome'));
    assert.deepEqual([a.link.sessions, b.link.sessions], [1, 1], 'spread over the least crowded worlds');
    const home = a.link.sessions === 1 && [...(a.game as unknown as { sessions: Set<{ name: string }> }).sessions][0].name === 'First Mate' ? a : b;
    const other = home === a ? b : a;
    // First Mate reconnects with their token: back to their own world, not merely the emptier one.
    c1.ws.close();
    await waitFor(() => home.link.sessions === 0);
    const again = new Client(g.url);
    await again.open();
    again.send({ t: 'hello', v: PROTOCOL_VERSION, token });
    await waitFor(() => !!again.got('welcome'));
    assert.equal(home.link.sessions, 1);
    assert.equal(other.link.sessions, 1);

    // The home world goes down: its players are told to reconnect.
    const port = home.port;
    await home.link.close();
    await waitFor(() => again.closeCode !== null);
    assert.equal(again.closeCode, 1012);
    assert.equal(c2.closeCode, null, 'the other world sails on');
    // …and comes back on the same port; the gateway links up again by itself.
    const back = new LinkServer({ secret: SECRET, zone: 'w', attach: (c) => home.game.attach(c), log: () => {} });
    await back.listen(port);
    await waitFor(() => g.gw.zones.every((z) => z.up), 8000);
    const third = new Client(g.url);
    await third.open();
    third.send({ t: 'hello', v: PROTOCOL_VERSION, token });
    await waitFor(() => !!third.got('welcome'));
    assert.equal(third.got('welcome')!.name, 'First Mate');
    assert.equal(back.sessions, 1);
    c2.ws.close();
    third.ws.close();
    await back.close();
  } finally {
    g.stop();
    await a.link.close();
    await b.link.close();
  }
});

test('HTTP routes pass through to a world with the player address forwarded', async () => {
  let seen = '';
  const up = createServer((req, res) => {
    seen = String(req.headers['x-forwarded-for']);
    res.writeHead(201, { 'Content-Type': 'application/json' }).end(JSON.stringify({ path: req.url }));
  });
  await new Promise<void>((r) => up.listen(0, '127.0.0.1', r));
  const target = `http://127.0.0.1:${(up.address() as AddressInfo).port}`;
  const front = createServer((req, res) => passThrough(req, res, target));
  await new Promise<void>((r) => front.listen(0, '127.0.0.1', r));
  try {
    const r = await fetch(`http://127.0.0.1:${(front.address() as AddressInfo).port}/auth/login`, { method: 'POST', body: '{}' });
    assert.equal(r.status, 201);
    assert.deepEqual(await r.json(), { path: '/auth/login' });
    assert.equal(seen, '127.0.0.1');
    up.close();
    await new Promise((r) => setTimeout(r, 50));
    const down = await fetch(`http://127.0.0.1:${(front.address() as AddressInfo).port}/health`);
    assert.equal(down.status, 502);
  } finally {
    up.close();
    front.close();
  }
});
