// GRAVETIDE world entry point: HTTP (static client, accounts) + WebSocket (game) on one port.
// With LINK_PORT and LINK_SECRET set it also takes sessions relayed by dedicated Gateways
// (server/src/gateway.ts, net/link.ts); without them it serves players directly.

import { onboardingReport } from './game/onboarding.ts';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_NAME, PROTOCOL_VERSION } from '../../shared/src/constants.ts';
import { AuthService } from './auth.ts';
import { Game } from './game/Game.ts';
import { createStaticHandler } from './net/static.ts';
import { LinkServer } from './net/link.ts';
import { ZoneRuntime } from './zones/zone.ts';
import { parseLayout } from '../../shared/src/world/zones.ts';
import { acceptUpgrade } from './net/websocket.ts';
import { Database } from './persistence/db.ts';
import type { Db } from './persistence/db.ts';
import { PgDatabase } from './persistence/pgdb.ts';
import { SharedState } from './persistence/redis.ts';
import { handleAuth } from './http/auth-routes.ts';
import { mailerFromEnv } from './mail.ts';
import { OAuthFlow, providersFromEnv } from './oauth.ts';
import { telegramFromEnv } from './telegram.ts';
import { handleTelegram } from './http/tg-routes.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const DB_PATH = process.env.DB_PATH ?? resolve(root, 'data/gravetide.db');

// PostgreSQL when DATABASE_URL is set (postgres://user:pass@host:port/db), SQLite otherwise.
const DATABASE_URL = process.env.DATABASE_URL;
const db: Db = DATABASE_URL ? await PgDatabase.open(DATABASE_URL) : new Database(DB_PATH);
// Public address for links in letters and OAuth callbacks.
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;
const auth = new AuthService(db, mailerFromEnv(), PUBLIC_URL);
const oauth = new OAuthFlow(providersFromEnv(), PUBLIC_URL);
// Redis when REDIS_URL is set: presence, the chat bus between processes, leaderboards.
const shared = process.env.REDIS_URL ? await SharedState.open(process.env.REDIS_URL, `world-${process.pid}`) : undefined;
const game = new Game({ db, auth, shared });
const serveStatic = createStaticHandler(root);
// Telegram (docs/27): the Mini App's sign-in, «Войти через Телеграм», the bot's webhook, Stars — null without TELEGRAM_BOT_TOKEN.
const tg = telegramFromEnv({ db, auth, game, publicUrl: PUBLIC_URL });

const server = createServer(async (req, res) => {
  if (req.url === '/onboarding') {
    // The First Watch funnel (docs/07 §13.3): steps passed and skipped, time per step, hints, retention.
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(onboardingReport(game)));
    return;
  }
  if (req.url === '/health/profile') {
    // Per-subsystem step timings over the last 30 s (mean, worst, share of the step).
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ...game.stats(), profile: game.prof.report() }));
    return;
  }
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION, ...game.stats(), gateways: link?.peers.size, relayed: link?.sessions, online: shared?.onlineCount }));
    return;
  }
  if (req.url?.startsWith('/leaderboard')) {
    // Top captains by ships sunk, taken and islands charted (needs Redis).
    const board = new URL(req.url, 'http://x').searchParams.get('board') ?? 'sunk';
    if (!shared || !['sunk', 'boarded', 'charted'].includes(board)) {
      res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: shared ? 'unknown board' : 'leaderboards need REDIS_URL' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ board, top: await shared.top(board, 20) }));
    return;
  }
  if (req.url?.startsWith('/economy')) {
    // Faucets, sinks, money supply and price level. ?window=seconds (default one hour).
    const w = Number(new URL(req.url, 'http://x').searchParams.get('window') ?? 3600);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ...game.economy(Number.isFinite(w) && w > 0 ? Math.min(w, 30 * 86400) : 3600), history: game.econHistory }));
    return;
  }
  if (await handleTelegram(req, res, tg)) return;
  if (await handleAuth(req, res, auth, oauth)) return;
  if (await serveStatic(req, res)) return;
  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
});

server.on('upgrade', (req, socket) => {
  if (!req.url?.startsWith('/ws')) {
    socket.destroy();
    return;
  }
  const conn = acceptUpgrade(req, socket);
  if (conn) game.attach(conn);
});

// A zone of a multi-process world (docs/04 §4.4): ZONE=west ZONE_LAYOUT="west=black_coast;east=…" ZONE_PORT=9300
// ZONE_PEERS="east=127.0.0.1:9301" LINK_SECRET=… — all zones share DB_PATH and are reached through the Gateway.
let zone: ZoneRuntime | null = null;
if (process.env.ZONE) {
  if (DATABASE_URL) throw new Error('Zones share one SQLite database file (DB_PATH); run PostgreSQL with a single world process.');
  const peers = (process.env.ZONE_PEERS ?? '').split(',').filter(Boolean).map((x) => {
    const m = /^([\w-]+)=([^:]+):(\d+)$/.exec(x.trim());
    if (!m) throw new Error(`bad ZONE_PEERS entry "${x}"`);
    return { id: m[1], host: m[2], port: Number(m[3]) };
  });
  zone = new ZoneRuntime(game, { id: process.env.ZONE, layout: parseLayout(process.env.ZONE_LAYOUT ?? ''), secret: process.env.LINK_SECRET ?? '', peers });
  const zp = await zone.listen(Number(process.env.ZONE_PORT ?? 9300), process.env.ZONE_HOST ?? '127.0.0.1');
  console.log(`[${GAME_NAME}] zone ${process.env.ZONE} (${[...zone.regions].join(', ')}), mesh on ${zp}`);
}
game.start();
// Dedicated gateways relay their players here over the internal link.
const link = process.env.LINK_PORT
  ? new LinkServer({ secret: process.env.LINK_SECRET ?? '', zone: process.env.ZONE_NAME ?? 'main', attach: (c) => game.attach(c) })
  : null;
if (link) {
  const lp = await link.listen(Number(process.env.LINK_PORT), process.env.LINK_HOST ?? '127.0.0.1');
  console.log(`[${GAME_NAME}] gateway link on ${process.env.LINK_HOST ?? '127.0.0.1'}:${lp}`);
}
server.listen(PORT, HOST, () => {
  console.log(`[${GAME_NAME}] listening on http://localhost:${PORT}  (protocol v${PROTOCOL_VERSION}, db ${DATABASE_URL ? 'postgresql' : DB_PATH})`);
  if (tg && process.env.TELEGRAM_FAKE !== '1') void tg.setup();
});

async function shutdown(): Promise<void> {
  console.log('[server] saving world and shutting down…');
  game.stop();
  await link?.close();
  zone?.stop();
  await db.close();
  await shared?.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
