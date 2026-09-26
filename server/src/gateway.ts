// GRAVETIDE Gateway entry point: serves the client, takes the players' WebSockets and relays them to the
// world processes over the internal link; account and status routes pass through to a world's HTTP.
//   LINK_ZONES="main=127.0.0.1:9100@http://127.0.0.1:8081"  (comma-separated for several worlds)
//   LINK_SECRET=…  (the same on every world)   PORT=8080   TRUST_PROXY=1 behind a TLS terminator
// Each world runs `npm start` with LINK_PORT (and LINK_SECRET, TRUST_PROXY=1).

import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_NAME, PROTOCOL_VERSION } from '../../shared/src/constants.ts';
import { Gateway, parseZones, passThrough } from './net/gateway.ts';
import { createStaticHandler } from './net/static.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const SECRET = process.env.LINK_SECRET ?? '';
if (SECRET.length < 16) throw new Error('Set LINK_SECRET (at least 16 characters), the same as on the worlds.');
const gw = new Gateway({ zones: parseZones(process.env.LINK_ZONES ?? 'main=127.0.0.1:9100@http://127.0.0.1:8081'), secret: SECRET });
const serveStatic = createStaticHandler(root);
const PASS = /^\/(auth\/|health|economy|leaderboard|onboarding)/;

const server = createServer(async (req, res) => {
  if (req.url === '/gateway/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: gw.zones.some((z) => z.up), protocol: PROTOCOL_VERSION, ...gw.stats() }));
    return;
  }
  if (req.url && PASS.test(req.url)) {
    const target = gw.httpTarget();
    if (target) return passThrough(req, res, target);
  }
  if (await serveStatic(req, res)) return;
  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
});
server.on('upgrade', (req, socket) => gw.handleUpgrade(req, socket));

gw.start();
server.listen(PORT, HOST, () => {
  console.log(`[${GAME_NAME} gateway] listening on http://localhost:${PORT}  (protocol v${PROTOCOL_VERSION}, worlds: ${gw.zones.map((z) => `${z.spec.name}@${z.spec.host}:${z.spec.port}`).join(', ')})`);
});

function shutdown(): void {
  gw.stop();
  server.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
