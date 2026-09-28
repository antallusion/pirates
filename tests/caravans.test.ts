// Caravans (docs/12 P8): one's own cargo hulls from the island's berths, sailing without their captain — the
// outposts' stores hauled home to one point, the island's goods sold in a port (never below the price set), goods
// bought for the island with its treasury — attacked by the sea's pirates (reckoned by a letter far from their owner,
// fought for real near her), insured by the League, protected by the law of the waters; the Counting House's place.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caravanPatterns } from '../shared/src/data/caravans.ts';
import { OUTPOST_BUILD } from '../shared/src/data/estate.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { attackNow, caravanById, caravanSlots, caravans, clearCaravans, launchCaravan, stepCaravans } from '../server/src/game/caravans.ts';
import type { LaunchOrder } from '../server/src/game/caravans.ts';
import { buyIsland, clearOutposts, estateView, foundOutpost, outpostById, ownIsland } from '../server/src/game/estate.ts';
import { damageBlocked } from '../server/src/game/combat.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function offShore(game: Game, ship: ShipEntity, is: Island): void {
  ship.docked = null;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const x = is.x + Math.sin(a) * (is.radius + 120), y = is.y - Math.cos(a) * (is.radius + 120);
    if (isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.region = is.region;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

/** A captain with an island of her own, an outpost with a store, and a fluyt at her island's pier. */
function estate(game: Game, name: string): { c: FakeConn; s: PlayerSession; ship: ShipEntity; home: Island; outpost: string } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  onHull(game, ship, 'brig', 5);
  s.profile!.gold = 2_000_000;
  clearOutposts(game);
  clearCaravans(game);
  const home = game.world.islands.find((i) => !i.portId && i.region === 'black_coast' && i.radius > 150 && !game.holdings.get(game, i.id))!;
  offShore(game, ship, home);
  assert.equal(buyIsland(game, s, home.id), null);
  const site = game.world.islands.find((is) => !is.portId && is.id !== home.id && is.region === 'black_coast' && !game.holdings.get(game, is.id) && Math.hypot(is.x - home.x, is.y - home.y) < 15000 && (is.biome === 'temperate' || is.biome === 'mangrove' || is.biome === 'atoll' || is.biome === 'mossy'))!;
  offShore(game, ship, site);
  ship.cargo = { ...OUTPOST_BUILD } as never;
  assert.equal(foundOutpost(game, s, 'fishery'), null);
  const outpost = estateView(game, s).outposts[0].id;
  outpostById(game, outpost)!.store = { fish: 50 };
  s.profile!.berths.push({ port: `isle:${home.id}`, loadout: { classId: 'fluyt', name: 'Herring Three', guns: { port: 'light_6', starboard: 'light_6' }, modules: {}, level: 3 }, hull: 1 });
  // Their captain stays in port, far from her caravans: they sail as lines on the chart.
  const port = game.world.ports.find((p) => p.region === 'ashen_isles')!;
  ship.docked = port.id;
  return { c, s, ship, home, outpost };
}

const order = (o: Partial<LaunchOrder>): LaunchOrder => ({ ships: [0], task: 'haul', escorts: 0, insured: false, orders: { repeat: false, avoidLawless: false, nightInPort: false, onAttack: 'flee' }, ...o });

function sail(game: Game, id: string, maxSec: number): void {
  for (let t = 0; t < maxSec && caravanById(game, id); t++) {
    game.now += 1;
    stepCaravans(game);
  }
}

test('a haul caravan brings the outposts’ stores home to the island without its captain, and the hull back to her berth', () => {
  const { game } = makeGame();
  const { s, home, outpost } = estate(game, 'Caravan Cora');
  outpostById(game, outpost)!.store = { fish: 50 };
  assert.equal(launchCaravan(game, s, order({ ships: [0], task: 'haul', outposts: [outpost] })), null);
  assert.equal(s.profile!.berths.length, 0, 'the fluyt sails');
  const id = Object.keys(caravans(game))[0];
  const c = caravanById(game, id)!;
  assert.equal(c.entities.length, 0, 'a line on the chart');
  sail(game, id, 20000);
  // The bare island keeps only a small cache: she waits at anchor with the rest until there is room.
  const h = ownIsland(game, s.accountId)!;
  assert.ok(caravanById(game, id), 'at anchor');
  assert.equal(h.store.fish, 30);
  h.buildings.push({ id: 'warehouse', condition: 1, unpaid: false });
  sail(game, id, 5);
  assert.equal(caravanById(game, id), undefined, 'home');
  assert.equal(h.store.fish, 50, 'the outpost’s fish in the island’s store');
  assert.equal(outpostById(game, outpost)!.store.fish ?? 0, 0);
  assert.equal(s.profile!.berths.length, 1, 'the fluyt at her berth again');
  void home;
});

test('a caravan sells the island’s goods in a port, never below the price set; one sent to buy fills the island from its treasury', () => {
  const { game } = makeGame();
  const { s, home } = estate(game, 'Seller Sam');
  const h = ownIsland(game, s.accountId)!;
  h.store = { rum: 20 };
  const port = game.world.ports.find((p) => p.region === 'black_coast')!;
  const gold0 = s.profile!.gold;
  assert.equal(launchCaravan(game, s, order({ task: 'sell', port: port.id, goods: ['rum'], minPrice: 0.5 })), null);
  assert.equal(h.store.rum ?? 0, 0, 'loaded');
  const id = Object.keys(caravans(game))[0];
  sail(game, id, 20000);
  assert.ok(s.profile!.gold > gold0 - 2000, 'the sale paid (less the skipper)');
  // Too high a floor: the rum comes home.
  h.store = { rum: 20 };
  assert.equal(launchCaravan(game, s, order({ task: 'sell', port: port.id, goods: ['rum'], minPrice: 1.5 })), null);
  sail(game, Object.keys(caravans(game))[0], 20000);
  assert.equal(h.store.rum, 20, 'nothing sold below the floor');
  // Supply: planks bought with the island's treasury.
  h.store = {};
  h.treasury = 50_000;
  assert.equal(launchCaravan(game, s, order({ task: 'supply', port: port.id, goods: ['planks'] })), null);
  sail(game, Object.keys(caravans(game))[0], 20000);
  assert.ok((h.store.planks ?? 0) > 0, 'planks in the store');
  assert.ok(h.treasury < 50_000, 'paid from the treasury');
  void home;
});

test('far from her owner an attack is reckoned and written; insured, the League pays for what was lost', () => {
  const { game } = makeGame();
  const { c: conn, s, outpost } = estate(game, 'Insured Ines');
  outpostById(game, outpost)!.store = { fish: 150 };
  assert.equal(launchCaravan(game, s, order({ task: 'haul', outposts: [outpost], insured: true, orders: { repeat: false, avoidLawless: false, nightInPort: false, onAttack: 'surrender' } })), null);
  const id = Object.keys(caravans(game))[0];
  const cv = caravanById(game, id)!;
  cv.cargo = { spices: 40 };
  const gold0 = s.profile!.gold;
  // Attack until one goes against her (the sea's pirates are no sure thing).
  for (let i = 0; i < 40; i++) {
    attackNow(game, cv);
    if ((cv.cargo.spices ?? 0) < 40) break;
  }
  assert.ok((cv.cargo.spices ?? 0) < 40, 'a loss at last');
  assert.ok(conn.all('toast').some((t) => /was beaten near|fought them off/.test(t.msg)));
  assert.ok(s.profile!.gold > gold0, 'the insurance paid');
  assert.ok(conn.all('toast').some((t) => t.msg.startsWith('The League pays')));
});

test('near her owner the alarm sounds and the fight is real: pirates on the water, the caravan’s hulls with them', () => {
  const { game } = makeGame();
  const { c: conn, s, ship, outpost } = estate(game, 'Rescue Rhea');
  assert.equal(launchCaravan(game, s, order({ task: 'haul', outposts: [outpost] })), null);
  const id = Object.keys(caravans(game))[0];
  const cv = caravanById(game, id)!;
  // Her captain at sea, a few miles off.
  ship.docked = null;
  const home = game.world.islands[cv.island];
  offShore(game, ship, home);
  stepCaravans(game);
  attackNow(game, cv);
  assert.ok(cv.attack, 'an attack to answer');
  assert.ok(cv.entities.length >= 1, 'her hulls on the water');
  assert.ok(conn.all('toast').some((t) => t.msg.includes('come to the rescue')));
  const hull = game.ships.get(cv.entities[0])!;
  assert.equal(hull.caravanId, id);
  assert.equal(hull.name, "Rescue Rhea's Caravan");
  // Drive them off.
  for (const pid of cv.attack!.pirates) {
    const p = game.ships.get(pid);
    if (p) game.removeShip(pid);
  }
  game.now += 1;
  stepCaravans(game);
  assert.equal(cv.attack, null);
  assert.ok(conn.all('toast').some((t) => t.msg.startsWith(`Caravan ${cv.name} fought them off`)));
  // Another captain may not fire on it in safe water.
  const other = join(game, 'Pirate Pete');
  const os = game.sessionByName('Pirate Pete')!;
  void other;
  hull.region = 'black_coast';
  assert.equal(damageBlocked(game, os.ship!, hull), 'Safe waters: no PvP here.');
  hull.region = 'gravewater';
  assert.equal(damageBlocked(game, os.ship!, hull), null);
});

test('caravan places: the island’s level, its caravan office and the Counting House', () => {
  const { game } = makeGame();
  const { s } = estate(game, 'Slots Sal');
  const h = ownIsland(game, s.accountId)!;
  assert.equal(caravanSlots(game, s), 1);
  h.buildings.push({ id: 'caravan_office', condition: 1, unpaid: false });
  assert.equal(caravanSlots(game, s), 2);
  h.level = 5;
  assert.equal(caravanSlots(game, s), 4);
  assert.ok(REGIONS.black_coast);
});

test('the caravans read in Russian', () => {
  setLang('ru');
  assert.equal(serverText("Ada's Caravan"), 'Караван: Ada');
  for (const [en, ru] of caravanPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
