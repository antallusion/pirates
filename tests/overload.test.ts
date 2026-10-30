// Forum 2026-10-30 (Нефигугум): the hold's bar, «ПЕРЕГРУЗ», the jettison's crate, the escorts' bars in the self state.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import type { ShipClassId } from '../shared/src/data/ships.ts';
import { GOODS } from '../shared/src/data/goods.ts';
import type { GoodId } from '../shared/src/data/goods.ts';
import { OVERLOAD_AT, OVERLOAD_AT_TRADE, holdView, overloadAt, overloadMul } from '../shared/src/data/overload.ts';
import type { Game } from '../server/src/game/Game.ts';
import { JETSAM_OWN_SEC } from '../server/src/game/Game.ts';
import type { PlayerSession, WorldView } from '../server/src/game/player.ts';
import { toPrivateState } from '../server/src/game/player.ts';
import { newFleet, spawnEscortShip } from '../server/src/game/fleet.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

function captain(game: Game, name: string) {
  const c = join(game, name);
  const s = [...game.sessions].find((x) => x.name === name)!;
  return { c, s, ship: s.ship!, p: s.profile! };
}

function atSea(game: Game, s: PlayerSession, x = 56000, y = 70000): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.state.heading = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.state.sail = 0;
  ship.region = game.regionAt(x, y);
  game.grid.upsert(ship.id, x, y);
}

/** Fill her hold to a share with one good of volume 1 (its multipliers untouched). */
function fillTo(ship: { cargo: Partial<Record<GoodId, number>>; stats: { holdVolume: number } }, share: number): GoodId {
  const g: GoodId = 'sugar'; // a plain good of volume 1 nobody aboard eats or drinks
  assert.equal(GOODS[g].volume, 1);
  ship.cargo = { [g]: Math.ceil(ship.stats.holdVolume * share) };
  return g;
}

const priv = (game: Game, s: PlayerSession) => toPrivateState(s, game.now, (game as unknown as { worldView(x: PlayerSession): WorldView }).worldView(s));

test('overload: the merchantmen (trade, hauler) at 99 %, every other hull at 90 %; −20 % then −35 % over the brim', () => {
  const trade = (Object.keys(SHIP_CLASSES) as ShipClassId[]).filter((id) => SHIP_CLASSES[id].list === 'trade' || SHIP_CLASSES[id].list === 'hauler');
  assert.ok(trade.includes('fluyt') && trade.includes('galleon'), 'the fluyt and the galleon are merchantmen');
  for (const id of trade) assert.equal(overloadAt(id), OVERLOAD_AT_TRADE, id);
  for (const id of ['sloop', 'brig', 'frigate', 'war_galley', 'schooner', 'man_o_war'] as ShipClassId[]) assert.equal(overloadAt(id), OVERLOAD_AT, id);
  assert.equal(OVERLOAD_AT, 0.9);
  assert.equal(OVERLOAD_AT_TRADE, 0.99);
  // A warship: free under 90 %, −20 % from it, −35 % over the brim.
  assert.equal(overloadMul('frigate', 0.89), 1);
  assert.equal(overloadMul('frigate', 0.9), 0.8);
  assert.equal(overloadMul('frigate', 1), 0.8);
  assert.equal(overloadMul('frigate', 1.05), 0.65);
  // A trader at 92 % sails free; from 99 % she is slowed as well.
  assert.equal(overloadMul('fluyt', 0.92), 1);
  assert.equal(overloadMul('fluyt', 0.98), 1);
  assert.equal(overloadMul('fluyt', 0.99), 0.8);
  assert.equal(overloadMul('fluyt', 1.02), 0.65);
});

test('overload slows her at sea (the server\'s sail params), not a ship of the sea; the hold view says so', () => {
  const { game } = makeGame();
  const { s, ship } = captain(game, 'Deep Hold');
  onHull(game, ship, 'brig');
  atSea(game, s);
  ship.cargo = {};
  const free = ship.sailParams(false).speedMul;
  fillTo(ship, 0.92);
  const v = holdView(ship.loadout.classId, ship.cargo, ship.stats);
  assert.equal(v.over, 1);
  assert.equal(v.slow, 20);
  assert.equal(v.at, 90);
  assert.ok(v.pct >= 92 && v.pct <= 93, `pct ${v.pct}`);
  assert.ok(Math.abs(ship.sailParams(false).speedMul - free * 0.8) < 1e-9, 'speed ×0.8');
  // A merchant hull at the same fill sails free.
  onHull(game, ship, 'fluyt');
  fillTo(ship, 0.92);
  assert.ok(Math.abs(ship.sailParams(false).speedMul - free) < 1e-9, 'a fluyt at 92 % is not overloaded');
  assert.equal(holdView(ship.loadout.classId, ship.cargo, ship.stats).over, 0);
});

test('the self state carries the hold\'s bar and her escorts\' bars (entity, hull, crew)', () => {
  const { game } = makeGame();
  const { s, ship, p } = captain(game, 'Flagship');
  onHull(game, ship, 'brig');
  atSea(game, s);
  fillTo(ship, 0.92);
  p.fleet = newFleet();
  p.fleet.escorts.push({ id: 'e1', classId: 'cutter', name: 'Tenacity', hull: 1 }, { id: 'e2', classId: 'brig', name: 'Warrant', hull: 1 });
  const ships = p.fleet.escorts.map((e, i) => spawnEscortShip(game, s, e, i));
  ships[1].hull = ships[1].stats.hullMax * 0.5;
  const st = priv(game, s);
  assert.ok(st.hold, 'hold view');
  assert.equal(st.hold!.over, 1);
  assert.equal(st.hold!.slow, 20);
  assert.ok(st.hold!.pct >= 92);
  const es = st.fleet.escorts;
  assert.equal(es.length, 2);
  assert.deepEqual(es.map((e) => e.eid), ships.map((x) => x.id));
  assert.equal(es[0].hull, 100);
  assert.equal(es[1].hull, 50);
  for (const e of es) assert.ok(typeof e.crew === 'number' && e.crew > 0 && e.crew <= 100, `crew ${e.crew}`);
});

test('jettison: the cargo floats astern in a crate anyone may fish up; its thrower not straight back; it lightens her', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Lightener');
  onHull(game, ship, 'brig');
  atSea(game, s);
  const g = fillTo(ship, 0.95);
  const had = ship.cargo[g]!;
  const over0 = holdView(ship.loadout.classId, ship.cargo, ship.stats).over;
  assert.equal(over0, 1);
  const before = new Set(game.loot.keys());
  // In port: not allowed.
  ship.docked = 'x';
  c.push({ t: 'jettison', good: g, qty: 5 });
  assert.equal(ship.cargo[g], had, 'not in port');
  ship.docked = null;
  const k = Math.ceil(ship.stats.holdVolume * 0.1);
  c.push({ t: 'jettison', good: g, qty: k });
  steps(game, 20 * 6); // five seconds of heaving
  assert.equal(ship.cargo[g], had - k);
  assert.equal(holdView(ship.loadout.classId, ship.cargo, ship.stats).over, 0, 'no longer overloaded');
  const crate = [...game.loot.values()].find((l) => !before.has(l.id) && l.jetsam?.account === s.accountId)!;
  assert.ok(crate, 'a crate in the water');
  assert.equal(crate.cargo[g], k);
  assert.equal(crate.ownerOnly, undefined, 'anyone may take it');
  assert.ok(crate.expires - game.now > 590 && crate.expires - game.now <= 600, 'ten minutes');
  // She sits on it: not straight back aboard.
  ship.state.x = crate.x;
  ship.state.y = crate.y;
  game.grid.upsert(ship.id, crate.x, crate.y);
  steps(game, 20);
  assert.equal(ship.cargo[g], had - k, 'her own jetsam waits');
  // Another captain sails over it and fishes it up.
  const { s: s2, ship: other } = captain(game, 'Scavenger');
  atSea(game, s2, 56000 + 3000, 70000);
  other.cargo = {};
  ship.state.x = 56000 - 3000;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  other.state.x = crate.x;
  other.state.y = crate.y;
  game.grid.upsert(other.id, crate.x, crate.y);
  steps(game, 40);
  assert.equal(other.cargo[g], k, 'fished up');
  assert.ok(!game.loot.has(crate.id), 'gone from the water');
  assert.ok(JETSAM_OWN_SEC > 0 && JETSAM_OWN_SEC <= 30);
});

test('jettison: her own crate comes back aboard once the wait is over; a full hold leaves it afloat', () => {
  const { game } = makeGame();
  const { c, s, ship } = captain(game, 'Second Thoughts');
  onHull(game, ship, 'brig');
  atSea(game, s);
  const g = fillTo(ship, 0.5);
  const had = ship.cargo[g]!;
  c.push({ t: 'jettison', good: g, qty: 10 });
  steps(game, 20 * 6);
  const crate = [...game.loot.values()].find((l) => l.jetsam?.account === s.accountId)!;
  assert.ok(crate);
  // A full hold: it stays afloat, not broken up for silver.
  const keep = ship.cargo;
  ship.cargo = { [g]: Math.floor(ship.stats.holdVolume) };
  const gold = s.profile!.gold;
  ship.state.x = crate.x;
  ship.state.y = crate.y;
  game.grid.upsert(ship.id, crate.x, crate.y);
  steps(game, 20 * (JETSAM_OWN_SEC + 1));
  assert.ok(game.loot.has(crate.id), 'still afloat');
  assert.equal(s.profile!.gold, gold, 'not broken up');
  ship.cargo = keep;
  ship.state.x = crate.x;
  ship.state.y = crate.y;
  game.grid.upsert(ship.id, crate.x, crate.y);
  steps(game, 40);
  assert.equal(ship.cargo[g], had, 'back aboard');
  assert.ok(!game.loot.has(crate.id));
});
