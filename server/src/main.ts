// GRAVETIDE server entry point: HTTP (static client) + WebSocket (game) on one port.
// In production the Gateway, World Simulation and Persistence roles split into separate
// processes (docs/04_TECHNICAL_ARCHITECTURE.md); the prototype runs them in one.

import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_NAME, PROTOCOL_VERSION } from '../../shared/src/constants.ts';
import { AuthService } from './auth.ts';
import { Game } from './game/Game.ts';
import { createStaticHandler } from './net/static.ts';
import { acceptUpgrade } from './net/websocket.ts';
import { Database } from './persistence/db.ts';
import type { Db } from './persistence/db.ts';
import { PgDatabase } from './persistence/pgdb.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const DB_PATH = process.env.DB_PATH ?? resolve(root, 'data/gravetide.db');

// PostgreSQL when DATABASE_URL is set (postgres://user:pass@host:port/db), SQLite otherwise.
const DATABASE_URL = process.env.DATABASE_URL;
const db: Db = DATABASE_URL ? await PgDatabase.open(DATABASE_URL) : new Database(DB_PATH);
const auth = new AuthService(db);
const game = new Game({ db, auth });
const serveStatic = createStaticHandler(root);

const server = createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION, ...game.stats() }));
    return;
  }
  if (req.url?.startsWith('/economy')) {
    // Faucets, sinks, money supply and price level. ?window=seconds (default one hour).
    const w = Number(new URL(req.url, 'http://x').searchParams.get('window') ?? 3600);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ...game.economy(Number.isFinite(w) && w > 0 ? Math.min(w, 30 * 86400) : 3600), history: game.econHistory }));
    return;
  }
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
server.listen(PORT, HOST, () => {
  console.log(`[${GAME_NAME}] listening on http://localhost:${PORT}  (protocol v${PROTOCOL_VERSION}, db ${DATABASE_URL ? 'postgresql' : DB_PATH})`);
});

async function shutdown(): Promise<void> {
  console.log('[server] saving world and shutting down…');
  game.stop();
  await db.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
