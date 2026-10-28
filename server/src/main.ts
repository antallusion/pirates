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
import { handleBootReport } from './http/boot-report.ts';
import { Telemetry, setTelemetry } from './http/telemetry.ts';
import { OpsPanel } from './http/ops.ts';
import { LiveOps, attachLiveOps } from './game/liveops.ts';
import { wireLiveOps } from './game/liveopsfire.ts';
import { mailerFromEnv } from './mail.ts';
import { OAuthFlow, providersFromEnv } from './oauth.ts';
import { telegramFromEnv } from './telegram.ts';
import { handleTelegram } from './http/tg-routes.ts';
import { vkFromEnv } from './vk.ts';
import { handleVk } from './http/vk-routes.ts';
import { vkIdFromEnv } from './vkid.ts';
import { handleVkId } from './http/vkid-routes.ts';
import { readFileSync } from 'node:fs';
import { ForumStore } from './forum/store.ts';
import { ForumService } from './forum/service.ts';
import { gameLink } from './forum/gamelink.ts';
import { forumRoutes } from './http/forum-routes.ts';
import { SiteRating } from './game/siterating.ts';
import { SiteProfile } from './game/siteprofile.ts';
import { WebShop } from './game/webshop.ts';
import { siteRoutes } from './http/site-routes.ts';
import { yookassaFromEnv } from './pay/yookassa.ts';

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
// Real-device telemetry (docs/33): daily aggregates in their own SQLite file next to the game's database.
const telemetry = new Telemetry(process.env.TELEMETRY_DB_PATH ?? (DB_PATH === ':memory:' ? ':memory:' : resolve(dirname(DB_PATH), 'telemetry.db')));
setTelemetry(telemetry);
// Live ops (docs/34): the panel's prices, offers and events, the funnel — in their own SQLite file too.
const liveops = new LiveOps(process.env.LIVEOPS_DB_PATH ?? (DB_PATH === ':memory:' ? ':memory:' : resolve(dirname(DB_PATH), 'liveops.db')));
attachLiveOps(game, liveops);
wireLiveOps();
const opsPanel = new OpsPanel(game, liveops);
// Telegram (docs/27): the Mini App's sign-in, «Войти через Телеграм», the bot's webhook, Stars — null without TELEGRAM_BOT_TOKEN.
const tg = telegramFromEnv({ db, auth, game, publicUrl: PUBLIC_URL });
// The VK Mini App (docs/36): the launch's sign-in and the votes' payments callback — null without VK_APP_SECRET.
const vk = vkFromEnv({ db, auth, game, publicUrl: PUBLIC_URL });
if (vk) console.log(`[${GAME_NAME}] VK Mini App: app ${vk.appId ?? '(any)'}${vk.payTest ? ', test payments credited' : ''}`);
// «Войти через VK ID» on the website (docs/36 §8): OAuth 2.1 + PKCE, the same VK account as the Mini App — null without VKID_APP_ID.
const vkid = vkIdFromEnv({ db, auth, game });
if (vkid) console.log(`[${GAME_NAME}] VK ID: app ${vkid.appId}, redirect ${vkid.redirectUri}${vkid.apiBase === 'https://id.vk.com' ? '' : ` (API ${vkid.apiBase})`}`);
// The community forum (docs/32_FORUM.md): its own SQLite file and uploads folder beside the game's database.
const forumDir = DB_PATH === ':memory:' ? null : dirname(DB_PATH);
const ids = (v: string | undefined) => (v ?? '').split(',').map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x > 0);
const portraits = (() => {
  try {
    const m = JSON.parse(readFileSync(resolve(root, 'assets/manifest.json'), 'utf8')) as { assets: Record<string, { local: string }> };
    return Object.keys(m.assets).filter((k) => k.startsWith('portrait.') && !k.startsWith('portrait.baron_')).map((k) => k.slice('portrait.'.length));
  } catch {
    return undefined;
  }
})();
const forum = new ForumService({
  store: new ForumStore(process.env.FORUM_DB_PATH ?? (forumDir ? resolve(forumDir, 'forum.db') : ':memory:')),
  link: gameLink(game, db), admins: ids(process.env.FORUM_ADMINS), mods: ids(process.env.FORUM_MODS),
  uploadsDir: forumDir ? resolve(forumDir, 'forum-uploads') : null, avatars: portraits,
});
const handleForum = forumRoutes(forum, auth);
// The website's captains' rating and shop (owner, 2026-10-20): YooKassa when YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY are
// set, else the test mode (its fake checkout opens with GRAVETIDE_PAY_TEST=1 or for SITE_ADMINS / FORUM_ADMINS).
const rating = new SiteRating(game, { banned: (acc) => forum.store.user(acc)?.role === 'banned' });
const webShop = new WebShop(game, {
  provider: yookassaFromEnv(), returnUrl: process.env.YOOKASSA_RETURN_URL ?? `${PUBLIC_URL}/site/shop/`,
  admins: ids(process.env.SITE_ADMINS ?? process.env.FORUM_ADMINS), payTest: process.env.GRAVETIDE_PAY_TEST === '1',
  testReceipt: process.env.GRAVETIDE_PAY_TEST_RECEIPT === '1', // QA: the test checkout asks the receipt's e-mail as live does
  hidden: (acc, name) => rating.hidden(acc, name),
});
console.log(`[${GAME_NAME}] web shop: ${webShop.mode === 'live' ? 'YooKassa' : `TEST MODE${process.env.GRAVETIDE_PAY_TEST === '1' ? ' (open to all)' : ' (admins only)'}`}`);
const handleSite = siteRoutes({ rating, profile: new SiteProfile(game, rating), shop: webShop, publicUrl: PUBLIC_URL });

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
  if (await handleBootReport(req, res)) return;
  if (req.url?.startsWith('/telemetry') && (await telemetry.handle(req, res))) return;
  if (req.url?.startsWith('/ops') && (await opsPanel.handle(req, res))) return;
  if (await handleTelegram(req, res, tg)) return;
  if (await handleVkId(req, res, vkid)) return;
  if (await handleVk(req, res, vk)) return;
  if (await handleAuth(req, res, auth, oauth)) return;
  if (req.url?.startsWith('/api/forum/') && (await handleForum(req, res))) return;
  if (req.url?.startsWith('/api/site/') && (await handleSite(req, res))) return;
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
  telemetry.close();
  liveops.close();
  forum.store.close();
  await shared?.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
