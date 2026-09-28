// One's own island and outposts (docs/12 P7): bought outright (a lease bought out for less), never besieged, grown
// through its levels on the store and the treasury; home from a port; residents who settle, are hired and work for
// +40%; outposts founded on fitting wild islands with materials brought, working by the hour to their store, raised
// a level, hauled; raids with a warning (driven off, or the store stripped; a fort holds); robbers in lawless water;
// the trophy hall and its guests; the island's forge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISLE_LEVELS, OUTPOST_BUILD, OUTPOST_KINDS, ROB_SEC, estatePatterns, outpostCap, outpostFits } from '../shared/src/data/estate.ts';
import type { OutpostKind } from '../shared/src/data/estate.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import {
  assignResident, buyIsland, buyPrice, clearOutposts, estateView, foundOutpost, goHome, hireResident, isleForge, isleLevelUp, outpostById, outpostOrder, ownIsland,
  raid, settleRefugees, stepEstate, trophyBonus, visitHall,
} from '../server/src/game/estate.ts';
import { rentIsland, slotsOf, stepHoldings } from '../server/src/game/holdings.ts';
import { declareSiege } from '../server/src/game/siege.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

let clock = 20_000 * 86_400_000;

function world(): Game {
  const { game } = makeGame();
  clock = 20_000 * 86_400_000;
  game.wallNow = () => clock;
  clearOutposts(game);
  return game;
}

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = 2_000_000;
  return { c, s, ship: s.ship! };
}

/** Puts a ship at sea just off an island's shore. */
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
  ship.state.speed = 0;
  ship.region = is.region;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

function wildIsland(game: Game, region: RegionId, pred: (is: Island) => boolean = () => true): Island {
  const is = game.world.islands.find((i) => !i.portId && i.region === region && i.radius > 150 && pred(i) && !game.holdings.get(game, i.id));
  assert.ok(is, `a wild island in ${region}`);
  return is!;
}

function owner(game: Game, name = 'Isle Owner'): { c: FakeConn; s: PlayerSession; ship: ShipEntity; home: Island } {
  const cap = captain(game, name);
  const home = wildIsland(game, 'gravewater');
  offShore(game, cap.ship, home);
  assert.equal(buyIsland(game, cap.s, home.id), null);
  return { ...cap, home };
}

test('buying an island outright: for ever, never besieged; a lease bought out costs less; not in lawless water', () => {
  const game = world();
  const { c, s, home } = owner(game);
  const h = ownIsland(game, s.accountId)!;
  assert.ok(h.owned);
  assert.equal(h.level, 1);
  assert.ok(h.until > clock + 50 * 365 * 86_400_000, 'no lease to run out');
  assert.ok(c.all('toast').some((t) => t.msg.includes('is yours for ever')));
  assert.ok(slotsOf(home, h) >= ISLE_LEVELS[1].slots && slotsOf(home, h) <= ISLE_LEVELS[1].slots + 2, 'slots by the level and the island size');
  // Another captain would lay siege: no.
  const { s: foe } = captain(game, 'Siege Lord');
  assert.equal(declareSiege(game, foe, home.id), 'A captain’s own island cannot be besieged.');
  // A lease bought out.
  const { s: b, ship: bs } = captain(game, 'Lease Holder');
  const other = wildIsland(game, 'whispering');
  offShore(game, bs, other);
  assert.equal(rentIsland(game, b, other.id, 30), null);
  const g0 = b.profile!.gold;
  assert.equal(buyIsland(game, b, other.id), null);
  assert.ok(g0 - b.profile!.gold < buyPrice(other), 'the lease left counts');
  // The lawless seas are for outposts.
  const { s: c2, ship: cs } = captain(game, 'Lawless Larry');
  const wild = wildIsland(game, 'ashen_isles');
  offShore(game, cs, wild);
  assert.equal(buyIsland(game, c2, wild.id), 'Islands are bought outright only in the safe and contested seas.');
});

test('the island grows a level on its store and treasury; home from a port once in half an hour', () => {
  const game = world();
  const { s, ship, home } = owner(game);
  const h = ownIsland(game, s.accountId)!;
  assert.match(isleLevelUp(game, s, home.id)!, /store lacks/);
  h.store.planks = 60;
  h.treasury = 1000;
  assert.match(isleLevelUp(game, s, home.id)!, /treasury lacks/);
  h.treasury = 5000;
  assert.equal(isleLevelUp(game, s, home.id), null);
  assert.equal(h.level, 2);
  assert.equal(h.store.planks ?? 0, 0);
  // Home.
  const port = game.world.ports.find((p) => p.region === 'gravewater')!;
  ship.docked = port.id;
  s.profile!.docked = port.id;
  ship.cargo = { rum: 3 };
  assert.equal(goHome(game, s), 'Home is only from a port, with an empty hold.');
  ship.cargo = {};
  assert.equal(goHome(game, s), null);
  assert.equal(ship.docked, null);
  assert.ok(Math.hypot(ship.state.x - home.x, ship.state.y - home.y) < home.radius + 400, 'off her island');
  ship.docked = port.id;
  assert.match(goHome(game, s)!, /Home again in/);
});

test('residents: the rescued settle when their captain comes home, the tavern hires, a resident at a farm works for +40%', () => {
  const game = world();
  const { s, ship, home } = owner(game);
  const h = ownIsland(game, s.accountId)!;
  s.profile!.refugees = 5;
  settleRefugees(game, s);
  assert.equal(h.residents!.length, ISLE_LEVELS[1].residents, 'as many as there are roofs');
  assert.equal(s.profile!.refugees, 5 - ISLE_LEVELS[1].residents);
  h.residents = [];
  assert.equal(hireResident(game, s), 'Build a tavern on the island to hire there');
  h.buildings.push({ id: 'tavern', condition: 1, unpaid: false }, { id: 'farm', condition: 1, unpaid: false });
  assert.equal(hireResident(game, s), null);
  assert.equal(h.residents!.length, 1);
  // A day of the farm alone, then a day with a resident on it.
  h.store = {};
  h.lastWork = clock;
  clock += 24 * 3_600_000;
  for (let i = 0; i < 10; i++) {
    game.now += 1;
    stepHoldings(game);
  }
  const alone = h.store.provisions ?? 0;
  assert.equal(assignResident(game, s, h.residents![0].id, 'farm'), null);
  h.store = {};
  clock += 24 * 3_600_000;
  for (let i = 0; i < 10; i++) {
    game.now += 1;
    stepHoldings(game);
  }
  assert.ok((h.store.provisions ?? 0) >= alone * 1.35, `${h.store.provisions} vs ${alone}`);
  void ship;
});

test('outposts: founded on a fitting island with materials brought, working by the hour to their store; raised; hauled; a lapsed claim abandons it', () => {
  const game = world();
  const { s, ship } = owner(game);
  // A fitting wild island for some kind.
  let site: Island | null = null, kind: OutpostKind | null = null;
  for (const is of game.world.islands) {
    if (is.portId || game.holdings.get(game, is.id) || REGIONS[is.region].safety === 'lawless') continue;
    const k = OUTPOST_KINDS.find((x) => outpostFits(x, is) && x !== 'whaling');
    if (k) {
      site = is;
      kind = k;
      break;
    }
  }
  assert.ok(site && kind);
  offShore(game, ship, site!);
  ship.cargo = {};
  assert.match(foundOutpost(game, s, kind!)!, /Bring/);
  ship.cargo = { ...OUTPOST_BUILD } as never;
  assert.equal(foundOutpost(game, s, kind!), null);
  const v = estateView(game, s);
  assert.equal(v.outposts.length, 1);
  const o = outpostById(game, v.outposts[0].id)!;
  // A second on another island: the island allows one at level 1.
  assert.match(foundOutpost(game, s, kind!)!, /(allows|already works)/);
  // Hours pass: the store fills to its cap and no more.
  clock += 100 * 3_600_000;
  stepEstate(game);
  const cap = outpostCap(o.kind, 1);
  const used = Object.values(o.store).reduce((a, n) => a + (n ?? 0), 0);
  assert.ok(Math.abs(used - cap) < 1, `full: ${used}/${cap}`);
  // Hauled into the hold.
  assert.equal(outpostOrder(game, s, o.id, 'haul'), null);
  assert.ok(Object.values(ship.cargo).reduce((a, n) => a + (n ?? 0), 0) > 0);
  // Raised a level.
  ship.cargo = { planks: 30, iron: 10 } as never;
  assert.equal(outpostOrder(game, s, o.id, 'upgrade'), null);
  assert.equal(o.level, 2);
  // The claim lapses.
  clock += 11 * 86_400_000;
  stepEstate(game);
  assert.equal(outpostById(game, o.id), undefined, 'abandoned');
});

test('a raid: ten minutes’ warning; driven off, the store is kept and the raiders’ plunder paid; too late, it is stripped; a fort holds', () => {
  const game = world();
  const { c, s, ship } = owner(game);
  const site = game.world.islands.find((is) => !is.portId && !game.holdings.get(game, is.id) && REGIONS[is.region].safety !== 'lawless' && outpostFits('fishery', is))!;
  offShore(game, ship, site);
  ship.cargo = { ...OUTPOST_BUILD } as never;
  assert.equal(foundOutpost(game, s, 'fishery'), null);
  const o = outpostById(game, estateView(game, s).outposts[0].id)!;
  const raidOf = () => o.raid as { ships: number[]; until: number } | null;
  o.store = { fish: 100 };
  raid(game, o, site);
  assert.ok(o.raid, 'raiders ashore');
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('Pirates have landed at your Fishing Crew')));
  // Driven off: every raider sunk.
  for (const id of o.raid!.ships) {
    const r = game.ships.get(id)!;
    r.hull = 0;
    game.beginSinking(r);
    game.removeShip(id);
  }
  const g0 = s.profile!.gold;
  stepEstate(game);
  assert.equal(o.raid, null);
  assert.equal(o.store.fish, 100);
  assert.ok(s.profile!.gold > g0);
  // Too late.
  raid(game, o, site);
  for (const id of raidOf()!.ships) game.removeShip(id);
  raidOf()!.ships = [];
  clock += 11 * 60_000;
  stepEstate(game);
  assert.ok((o.store.fish ?? 0) <= 70 && (o.store.fish ?? 0) >= 40, `stripped: ${o.store.fish}`);
  // A fort holds.
  o.guard = 'fort';
  o.store = { fish: 100 };
  raid(game, o, site);
  for (const id of raidOf()!.ships) game.removeShip(id);
  raidOf()!.ships = [];
  clock += 11 * 60_000;
  stepEstate(game);
  assert.equal(o.store.fish, 100);
});

test('a robber in lawless water: five minutes ashore, the owner warned, half the store taken', () => {
  const game = world();
  const { c, s, ship } = owner(game);
  const site = game.world.islands.find((is) => !is.portId && !game.holdings.get(game, is.id) && REGIONS[is.region].safety === 'lawless' && OUTPOST_KINDS.some((k) => outpostFits(k, is)))!;
  const kind = OUTPOST_KINDS.find((k) => outpostFits(k, site))!;
  offShore(game, ship, site);
  ship.cargo = { ...OUTPOST_BUILD } as never;
  assert.equal(foundOutpost(game, s, kind), null);
  const o = outpostById(game, estateView(game, s).outposts[0].id)!;
  o.store = { [Object.keys(o.store)[0] ?? 'iron']: 60 };
  const { s: rob, ship: rs } = captain(game, 'Robber Roy');
  offShore(game, rs, site);
  rs.cargo = {};
  assert.equal(outpostOrder(game, rob, o.id, 'rob'), null);
  assert.ok(c.all('toast').some((t) => t.msg.includes('is being robbed')));
  game.now += ROB_SEC + 1;
  stepEstate(game);
  const took = Object.values(rs.cargo).reduce((a, n) => a + (n ?? 0), 0);
  assert.equal(took, 30);
  assert.ok(rob.profile!.infamy >= 10);
});

test('the trophy hall lends its trades a little and shows guests round; the island’s forge serves gear', () => {
  const game = world();
  const { s, ship, home } = owner(game);
  const h = ownIsland(game, s.accountId)!;
  assert.equal(trophyBonus(game, s.accountId, 'flag'), 0);
  h.buildings.push({ id: 'trophy_hall', condition: 1, unpaid: false });
  s.profile!.hunter = { points: 0, captains: 6, seas: {} };
  assert.ok(Math.abs(trophyBonus(game, s.accountId, 'flag') - 0.03) < 1e-9);
  s.profile!.hunter.captains = 100;
  assert.equal(trophyBonus(game, s.accountId, 'flag'), 0.1, 'to a tenth');
  const { s: guest, ship: gs } = captain(game, 'Guest Gil');
  offShore(game, gs, home);
  const v = visitHall(game, guest, home.id);
  assert.ok(typeof v !== 'string' && v.flag === 100);
  assert.equal(h.visitors, 1);
  // The forge.
  assert.equal(isleForge(game, s), null);
  h.buildings.push({ id: 'forge', condition: 1, unpaid: false });
  offShore(game, ship, home);
  const fp = isleForge(game, s);
  assert.ok(fp && fp.shipyardTier >= 2);
});

test('the island and its outposts read in Russian', () => {
  setLang('ru');
  assert.equal(serverText('Outposts'), 'Аванпосты');
  assert.match(serverText('A captain’s own island cannot be besieged.'), /нельзя осадить/);
  for (const [en, ru] of estatePatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
