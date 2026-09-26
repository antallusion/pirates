import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moduleCost } from '../shared/src/data/ships.ts';
import { AuthService } from '../server/src/auth.ts';
import { Game } from '../server/src/game/Game.ts';
import { rightsCost, sitesNearPort, tickSites } from '../server/src/game/resources.ts';
import type { ResourceSite } from '../server/src/game/resources.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame, steps } from './helpers.ts';

function parkOffIsland(game: Game, ship: ShipEntity, islandId: number): void {
  const is = game.world.islands[islandId];
  const px = is.poly[0], py = is.poly[1];
  const dx = px - is.x, dy = py - is.y, d = Math.hypot(dx, dy);
  ship.state.x = px + (dx / d) * 120;
  ship.state.y = py + (dy / d) * 120;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

test('resource sites exist for mines, groves and pearl banks and fill their stockpile over time', () => {
  const { game } = makeGame();
  assert.ok(game.sites.length > 20, `${game.sites.length} sites`);
  assert.ok(game.sites.some((x) => x.good === 'timber'));
  const site = game.sites[0];
  site.stock = 0;
  tickSites(game, 900);
  assert.ok(Math.abs(site.stock - site.rate) < 1e-6, 'one economy hour yields `rate` units');
  tickSites(game, 900 * 100);
  assert.equal(site.stock, site.capacity, 'stockpile is capped');
});

test('buy extraction rights, sail out, haul the stockpile with the boats, store it in a warehouse', () => {
  const { game } = makeGame();
  const c = join(game, 'Quarry Master');
  const s = [...game.sessions][0];
  const p = s.profile!;
  const ship = s.ship!;
  game.pushPort(s);
  const view = c.last('port')!.view!;
  assert.ok(view.sites.length > 0, 'harbour master sells rights nearby');
  const port = game.world.ports.find((x) => x.id === view.portId)!;
  const site = sitesNearPort(game, port).find((x) => x.good !== 'pearls') ?? sitesNearPort(game, port)[0];
  p.gold = 50000;
  const gold0 = p.gold;
  c.push({ t: 'rights', site: site.id });
  assert.equal(site.holder, s.accountId);
  assert.equal(gold0 - p.gold, rightsCost(site));
  assert.ok(c.last('port')!.view!.sites.find((x) => x.id === site.id)!.mine);

  // A second captain cannot buy rights someone else holds.
  const c2 = join(game, 'Claim Jumper');
  const s2 = [...game.sessions].find((x) => x !== s)!;
  s2.profile!.gold = 50000;
  c2.push({ t: 'rights', site: site.id });
  assert.equal(site.holder, s.accountId);
  assert.ok(c2.all('toast').some((t) => /holds those rights/.test(t.msg)));

  // Sail out and haul.
  c.push({ t: 'undock' });
  ship.cargo = {};
  site.stock = 10;
  parkOffIsland(game, ship, site.islandId);
  steps(game, 25);
  assert.ok(s.landable && /stockpile/.test(s.landable.feature), 'HUD offers the stockpile');
  assert.ok(s.siteViews.some((x) => x.id === site.id));
  c.push({ t: 'land' });
  assert.equal(ship.landing?.feature, 'haul');
  steps(game, 20 * 17);
  assert.equal(ship.landing, null);
  assert.ok((ship.cargo[site.good] ?? 0) >= 10, `hauled ${ship.cargo[site.good]}`);
  assert.ok(site.stock < 1);
});

test('warehouse: rent on first deposit, stored goods lose stolen marks, withdraw back into the hold', () => {
  const { game } = makeGame();
  const c = join(game, 'Store Keeper');
  const s = [...game.sessions][0];
  const p = s.profile!;
  const ship = s.ship!;
  game.pushPort(s);
  const portId = c.last('port')!.view!.portId;
  p.gold = 1000;
  ship.cargo = { rum: 20 };
  p.stolen.rum = 20;
  c.push({ t: 'warehouse', good: 'rum', qty: 15 });
  assert.equal(p.gold, 700, 'rent paid');
  assert.equal(p.warehouses[portId].rum, 15);
  assert.equal(ship.cargo.rum, 5);
  assert.equal(p.stolen.rum, 5, 'laundered by the warehouse');
  const v = c.last('port')!.view!.warehouse;
  assert.ok(v.rented);
  assert.equal(v.goods.rum, 15);
  c.push({ t: 'warehouse', good: 'rum', qty: -10 });
  assert.equal(ship.cargo.rum, 15);
  assert.equal(p.warehouses[portId].rum, 5);
  assert.equal(p.gold, 700, 'rent charged only once');
  c.push({ t: 'warehouse', good: 'rum', qty: 100000 });
  assert.equal(ship.cargo.rum, 15, 'absurd orders refused');
});

test('shipyard takes materials from hold and warehouse for up to 30% off a module', () => {
  const { game } = makeGame();
  const c = join(game, 'Ship Wright');
  const s = [...game.sessions][0];
  const p = s.profile!;
  const ship = s.ship!;
  game.pushPort(s);
  const portId = c.last('port')!.view!.portId;
  p.gold = 100000;
  const full = moduleCost('hull_plating', 1, ship.cls.tier);
  ship.cargo = { timber: 8 };
  p.warehouses[portId] = { timber: 30 };
  const g0 = p.gold;
  c.push({ t: 'shipyard', action: 'module', module: 'hull_plating' });
  assert.equal(ship.loadout.modules.hull_plating, 1);
  assert.equal(g0 - p.gold, Math.round(full * 0.7));
  assert.equal(ship.cargo.timber ?? 0, 0, 'hold emptied first');
  assert.equal(p.warehouses[portId].timber, 18, 'rest from the warehouse');
  // No materials: full price.
  const full2 = moduleCost('sail_plan', 1, ship.cls.tier);
  const g1 = p.gold;
  c.push({ t: 'shipyard', action: 'module', module: 'sail_plan' });
  assert.equal(g1 - p.gold, full2);
});

test('rights lapse and sites persist across restarts', () => {
  const { game, db } = makeGame();
  const site: ResourceSite = game.sites[3];
  site.holder = 42;
  site.holderName = 'Ghost';
  site.until = game.now + 10;
  site.stock = 7;
  game.saveAll();
  const again = new Game({ db, auth: new AuthService(db), log: () => {} });
  const restored = again.sites.find((x) => x.id === site.id)!;
  assert.equal(restored.holder, 42);
  assert.ok(Math.abs(restored.stock - 7) < 0.1);
  steps(game, 20 * 12);
  assert.equal(site.holder, null, 'rights lapsed');
});
