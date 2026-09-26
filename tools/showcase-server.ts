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
// SHOWCASE=port: redock each new captain at a League port with a bank, an exchange and an open buy order.
const portMode = process.env.SHOWCASE === 'port';
setInterval(() => {
  for (const s of game.sessions) {
    const ship = s.ship;
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
