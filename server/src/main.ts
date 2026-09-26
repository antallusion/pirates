// GRAVETIDE world entry point: HTTP (static client, accounts) + WebSocket (game) on one port.
// With LINK_PORT and LINK_SECRET set it also takes sessions relayed by dedicated Gateways
// (server/src/gateway.ts, net/link.ts); without them it serves players directly.

import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_NAME, PROTOCOL_VERSION } from '../../shared/src/constants.ts';
import { AuthService } from './auth.ts';
import { Game } from './game/Game.ts';
import { createStaticHandler } from './net/static.ts';
import { LinkServer } from './net/link.ts';
import { acceptUpgrade } from './net/websocket.ts';
import { Database } from './persistence/db.ts';
import type { Db } from './persistence/db.ts';
import { PgDatabase } from './persistence/pgdb.ts';
import { SharedState } from './persistence/redis.ts';
import { handleAuth } from './http/auth-routes.ts';
import { mailerFromEnv } from './mail.ts';
import { OAuthFlow, providersFromEnv } from './oauth.ts';

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

const server = createServer(async (req, res) => {
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
});

async function shutdown(): Promise<void> {
  console.log('[server] saving world and shutting down…');
  game.stop();
  await link?.close();
  await db.close();
  await shared?.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
