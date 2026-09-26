// Test-only server entry: the real game, plus a director that drops each new captain into contested
// Gravewater next to a pirate and a merchant so screenshots and play-tests reach combat quickly.
// Never used in production (`npm start` runs server/src/main.ts).

import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthService } from '../server/src/auth.ts';
import { Game } from '../server/src/game/Game.ts';
import { createStaticHandler } from '../server/src/net/static.ts';
import { acceptUpgrade } from '../server/src/net/websocket.ts';
import { Database } from '../server/src/persistence/db.ts';
import { risingPoint, summon } from '../server/src/game/bosses.ts';
import { BOSSES } from '../shared/src/data/bosses.ts';
import type { BossId } from '../shared/src/data/bosses.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const db = new Database(':memory:');
const game = new Game({ db, auth: new AuthService(db) });
const serveStatic = createStaticHandler(root);
const server = createServer(async (req, res) => {
  if (!(await serveStatic(req, res))) res.writeHead(404).end();
});
server.on('upgrade', (req, socket) => {
  const conn = acceptUpgrade(req, socket);
  if (conn) game.attach(conn);
});
game.start();

const staged = new Set<number>();
// SHOWCASE=events: the Armada, a pirate blockade, a fever in Saltmarrow and the Storm of the Century, at once.
if (process.env.SHOWCASE === 'events') {
  const st = game.worldEvents.data(game);
  const now = game.wallNow();
  for (const k of ['armada', 'pirate_blockade', 'epidemic', 'storm:black_coast']) st.next[k] = now;
  for (const [id, m] of game.markets) if (m.goods.medicine) m.goods.medicine.stock = id === 'saltmarrow' ? 1 : m.goods.medicine.target;
}
// SHOWCASE=port: redock each new captain at a League port with a bank, an exchange and an open buy order.
const portMode = process.env.SHOWCASE === 'port';
// SHOWCASE=rich: each new captain is a seasoned, well-off level 30 in port (guilds, islands, the market).
const richMode = process.env.SHOWCASE === 'rich';
// SHOWCASE=boss:kraken (any boss id): a captain who puts to sea is set down 600 m from that boss, raised for her.
const bossKind = process.env.SHOWCASE?.startsWith('boss:') ? (process.env.SHOWCASE.slice(5) as BossId) : null;
// SHOWCASE=city | graveyard: a captain who puts to sea is set down at a sunken city's bell buoy or a graveyard.
const siteKind = process.env.SHOWCASE === 'city' || process.env.SHOWCASE === 'graveyard' ? process.env.SHOWCASE : null;
setInterval(() => {
  for (const s of game.sessions) {
    const ship = s.ship;
    if (siteKind) {
      if (!ship || ship.docked || staged.has(ship.id)) continue;
      staged.add(ship.id);
      const site = game.expeditions.sites.find((x) => x.kind === siteKind)!;
      ship.loadout.classId = 'brig';
      ship.recompute(game.now);
      ship.hull = ship.stats.hullMax;
      ship.crew = ship.stats.crewMax;
      ship.state.x = site.x + (siteKind === 'city' ? 30 : 0);
      ship.state.y = site.y + (siteKind === 'city' ? 0 : 520);
      ship.state.speed = 0;
      ship.state.sail = 0;
      ship.input = { rudder: 0, sailTarget: 0 };
      ship.protectedUntil = 0;
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      game.pushSelf(s, true);
      continue;
    }
    if (bossKind) {
      if (!ship || ship.docked || staged.has(ship.id)) continue;
      staged.add(ship.id);
      let f = [...game.bosses.fights.values()].find((x) => x.kind === bossKind);
      if (!f) {
        const def = BOSSES[bossKind];
        const spot = risingPoint(game, def, def.regions)!;
        if (def.window === 'storm') for (const r of def.regions) game.weather[r].kind = 'storm';
        f = summon(game, bossKind, spot.x, spot.y);
      }
      const body = game.ships.get(f.id)!;
      ship.state.x = body.state.x + 260;
      ship.state.y = body.state.y + 120;
      ship.protectedUntil = 0;
      s.profile!.level = 30;
      ship.level = 30;
      game.grid.upsert(ship.id, ship.state.x, ship.state.y);
      continue;
    }
    if (richMode) {
      if (!ship || !s.profile || staged.has(ship.id)) continue;
      staged.add(ship.id);
      s.profile.gold = 400_000;
      s.profile.level = 30;
      ship.level = 30;
      s.profile.pvp.played = 100 * 3600;
      game.pushSelf(s, true);
      continue;
    }
    if (portMode) {
      if (!ship || !ship.docked || staged.has(ship.id)) continue;
      staged.add(ship.id);
      const lp = game.world.ports.find((q) => q.faction === 'league' && q.size >= 2)!;
      ship.state.x = lp.x;
      ship.state.y = lp.y;
      (game as unknown as { dockShip(x: typeof s, p: typeof lp): void }).dockShip(s, lp);
      game.orders.push({ id: `bo_demo${ship.id}`, accountId: -1, name: 'Mistress Vane', portId: lp.id, good: 'provisions', qty: 30, filled: 0, price: 16, escrow: 480, expiresAt: game.now + 3600, pendingGoods: 0, pendingRefund: 0, closed: false });
      game.pushPort(s);
      continue;
    }
    if (!ship || ship.docked || staged.has(ship.id)) continue;
    staged.add(ship.id);
    ship.state.x = 56000;
    ship.state.y = 70200;
    ship.state.heading = Math.PI / 2;
    ship.protectedUntil = 0;
    game.grid.upsert(ship.id, ship.state.x, ship.state.y);
    const pirate = game.spawnNpcShip('pirate', 'brigantine', 'confederacy', 56450, 70050, -Math.PI / 2);
    const pb = game.npcs.get(pirate.id)!;
    pb.active = true;
    pb.chase = { id: ship.id, until: game.now + 600 };
    pb.area = { x: 56000, y: 70000, r: 1500 };
    game.grid.upsert(pirate.id, pirate.state.x, pirate.state.y);
    const merchant = game.spawnNpcShip('merchant', 'galleon', 'league', 55700, 69850, Math.PI * 0.3);
    merchant.cargo = { spices: 20, sugar: 60, rum: 30 };
    const mb = game.npcs.get(merchant.id)!;
    mb.active = true;
    mb.area = { x: 56000, y: 70000, r: 3000 };
    game.grid.upsert(merchant.id, merchant.state.x, merchant.state.y);
  }
}, 250);

const port = Number(process.env.PORT ?? 8091);
server.listen(port, () => console.log(`[showcase] http://localhost:${port}`));
