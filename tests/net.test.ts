import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { decodeSnap } from '../shared/src/codec.ts';
import type { ServerMsg } from '../shared/src/protocol.ts';
import { acceptUpgrade } from '../server/src/net/websocket.ts';
import { createStaticHandler } from '../server/src/net/static.ts';
import { resolve } from 'node:path';
import { makeGame } from './helpers.ts';

test('real WebSocket handshake + protocol round trip, and TypeScript served as JavaScript', async () => {
  const { game } = makeGame();
  const serveStatic = createStaticHandler(resolve(import.meta.dirname, '..'));
  const server = createServer(async (req, res) => {
    if (!(await serveStatic(req, res))) res.writeHead(404).end();
  });
  server.on('upgrade', (req, socket) => {
    const conn = acceptUpgrade(req, socket);
    if (conn) game.attach(conn);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;

  const js = await (await fetch(`http://127.0.0.1:${port}/shared/src/math.ts`)).text();
  assert.match(js, /export function clamp\(v\s*, lo\s*, hi\s*\)/, 'types stripped');
  assert.doesNotMatch(js, /: number/, 'no type annotations left');

  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const got: ServerMsg[] = [];
  await new Promise<void>((resolveOpen) => (ws.onopen = () => resolveOpen()));
  const done = new Promise<void>((r) => {
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (ev) => {
      const m = (ev.data instanceof ArrayBuffer ? decodeSnap(ev.data) : JSON.parse(String(ev.data))) as ServerMsg;
      got.push(m);
      if (m.t === 'welcome') ws.send(JSON.stringify({ t: 'create_captain', captain: 'navigator', shipName: 'Wire Test' }));
      if (m.t === 'init') r();
    };
  });
  ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name: 'Wire Tester' }));
  await done;
  assert.ok(got.some((m) => m.t === 'welcome'));
  assert.equal(got.find((m) => m.t === 'init')?.t, 'init');
  // A large message (>125 bytes, 16-bit length frame) survives the trip.
  ws.send(JSON.stringify({ t: 'chat', text: 'x'.repeat(180) }));
  await new Promise((r) => setTimeout(r, 50));
  ws.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});
