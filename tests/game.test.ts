import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { headingVec } from '../shared/src/math.ts';
import { AuthService } from '../server/src/auth.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';

function shipOf(game: Game, conn: FakeConn): ShipEntity {
  for (const s of game.sessions) if ((s.conn as unknown) === conn) return s.ship!;
  throw new Error('no session');
}
function profileOf(game: Game, conn: FakeConn) {
  for (const s of game.sessions) if ((s.conn as unknown) === conn) return s.profile!;
  throw new Error('no session');
}

/** Put an NPC right on the player's beam so a broadside must hit it. */
function npcAbeam(game: Game, player: ShipEntity, side: 'port' | 'starboard', distance: number): ShipEntity {
  const h = player.state.heading + (side === 'port' ? -Math.PI / 2 : Math.PI / 2);
  const v = headingVec(h);
  const npc = game.spawnNpcShip('merchant', 'fluyt', 'league', player.state.x + v.x * distance, player.state.y + v.y * distance, player.state.heading);
  const brain = game.npcs.get(npc.id)!;
  brain.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  npc.cargo = { sugar: 30, rum: 10 };
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

function undockAtSea(game: Game, conn: FakeConn): ShipEntity {
  conn.push({ t: 'undock' });
  const ship = shipOf(game, conn);
  // Move well clear of the harbour into open water for deterministic tests.
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return ship;
}

test('join: welcome, init and a docked ship in Saltmarrow with a port view', () => {
  const { game } = makeGame();
  const c = join(game, 'Anne Test');
  assert.ok(c.last('welcome'));
  const init = c.last('init')!;
  assert.equal(init.self.dockedAt, 'saltmarrow');
  assert.equal(init.self.level, 1);
  assert.ok(c.last('port')?.view, 'port screen pushed');
  assert.ok(c.all('chunk').length > 0, 'islands streamed');
});

test('trading is validated server-side and moves the market', () => {
  const { game } = makeGame();
  const c = join(game, 'Trader Joe');
  const p = profileOf(game, c);
  const ship = shipOf(game, c);
  const gold0 = p.gold;
  const stock0 = game.markets.get('saltmarrow')!.goods.salt!.stock;
  c.push({ t: 'trade', good: 'salt', qty: 5 });
  assert.equal(ship.cargo.salt, 5);
  assert.ok(p.gold < gold0);
  assert.equal(game.markets.get('saltmarrow')!.goods.salt!.stock, stock0 - 5);
  // Contraband cannot be sold in a Crown port, and nobody can sell what they do not have.
  ship.cargo.dreamleaf = 3;
  c.push({ t: 'trade', good: 'dreamleaf', qty: -3 });
  assert.equal(ship.cargo.dreamleaf, 3);
  c.push({ t: 'trade', good: 'sugar', qty: -50 });
  assert.equal(ship.cargo.sugar, undefined);
  // Out at sea, the market is closed.
  undockAtSea(game, c);
  const g = p.gold;
  c.push({ t: 'trade', good: 'salt', qty: 1 });
  assert.equal(p.gold, g);
});

test('the client cannot cheat: inputs are clamped, junk is ignored, outcomes are server-computed', () => {
  const { game } = makeGame();
  const c = join(game, 'Cheater McGee');
  const ship = undockAtSea(game, c);
  c.push({ t: 'input', seq: 1, rudder: 99, sail: 999 });
  assert.equal(ship.input.rudder, 1);
  assert.equal(ship.input.sailTarget, 1);
  c.onMessage('{"t":"gold","amount":100000}');
  c.onMessage('not json');
  c.onMessage(JSON.stringify({ t: 'trade', good: 'pearls', qty: 1e9 }));
  assert.equal(profileOf(game, c).gold, 1200);
  // Fire twice: the second broadside is refused until reloaded.
  c.push({ t: 'fire', side: 'port', dist: 300 });
  const ammo = ship.ammo.round;
  c.push({ t: 'fire', side: 'port', dist: 300 });
  assert.equal(ship.ammo.round, ammo, 'no second volley while reloading');
});

test('broadsides hit, damage subsystems and count as a crime against lawful ships', () => {
  const { game } = makeGame();
  const c = join(game, 'Gunner Grey');
  const ship = undockAtSea(game, c);
  const npc = npcAbeam(game, ship, 'starboard', 120);
  const hull0 = npc.hull;
  c.push({ t: 'fire', side: 'starboard', dist: 120 });
  steps(game, 40);
  assert.ok(npc.hull < hull0, `hull ${npc.hull} < ${hull0}`);
  assert.ok(profileOf(game, c).infamy > 0, 'attacking a League merchant is a crime');
  assert.ok(c.all('ev').some((m) => m.list.some((e) => e.k === 'hit')), 'hit events reached the client');
});

test('boarding a crippled ship: fight, cargo loss, plunder and fate', () => {
  const { game } = makeGame();
  const c = join(game, 'Red Test', 'reaver');
  const ship = undockAtSea(game, c);
  const npc = npcAbeam(game, ship, 'port', 18);
  npc.hull = npc.stats.hullMax * 0.4;
  npc.crew = 6;
  c.push({ t: 'board', target: npc.id, aggression: 'careful' });
  assert.ok(ship.boarding, 'boarding started');
  steps(game, 20 * 30);
  const result = c.last('boarding')?.result;
  assert.ok(result, 'boarding result delivered');
  const total = (result.cargo.sugar ?? 0) + (result.cargo.rum ?? 0) + (result.destroyed.sugar ?? 0) + (result.destroyed.rum ?? 0);
  assert.equal(total, 40, 'cargo is either plundered or destroyed');
  c.push({ t: 'loot_take', take: { rum: 5 }, fate: 'release' });
  assert.equal(ship.cargo.rum, 5);
  assert.equal(npc.surrendered, false, 'released prize sails on');
});

test('being sunk costs cargo and a fee, never the ship or the level', () => {
  const { game } = makeGame();
  const c = join(game, 'Unlucky Ned');
  const ship = undockAtSea(game, c);
  const p = profileOf(game, c);
  ship.cargo.rum = 20;
  const level0 = p.level;
  const pirate = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + 200, ship.state.y, 0);
  applyDamage(game, ship, { hull: 99999 }, pirate);
  assert.ok(ship.sinkingUntil > 0);
  steps(game, 20 * 7);
  const sunk = c.last('sunk_self');
  assert.ok(sunk, 'death screen sent');
  assert.equal(ship.docked, sunk.respawnPort);
  assert.equal(ship.hull, ship.stats.hullMax);
  assert.equal(ship.loadout.classId, 'sloop');
  assert.ok(p.level >= level0, 'levels are never lost');
  assert.equal(Object.keys(ship.cargo).length, 0);
  assert.ok(game.loot.size >= 1, 'some cargo floats where she sank');
});

test('progression: xp → level → talent point → learned talent changes stats', () => {
  const { game } = makeGame();
  const c = join(game, 'Scholar Sam');
  const ship = shipOf(game, c);
  const s = [...game.sessions][0];
  game.grantXp(s, 5000, 'test');
  assert.ok(s.profile!.level > 3);
  const reload0 = ship.stats.reloadMul;
  c.push({ t: 'learn_talent', id: 'gun_fast_hands' });
  assert.equal(s.profile!.talents.gun_fast_hands, 1);
  assert.ok(ship.stats.reloadMul < reload0);
  c.push({ t: 'learn_talent', id: 'gun_iron_rain' });
  assert.equal(s.profile!.talents.gun_iron_rain, undefined, 'keystone gated by tree points');
});

test('persistence: a captain survives a server restart and resumes by token', () => {
  const { game, db } = makeGame();
  const c = join(game, 'Persistent Pat');
  c.push({ t: 'trade', good: 'salt', qty: 3 });
  const token = c.last('welcome')!.token;
  game.saveAll();
  const game2 = new Game({ db, auth: new AuthService(db), log: () => {} });
  const c2 = new FakeConn();
  game2.attach(c2 as unknown as WsConnection);
  c2.push({ t: 'hello', v: PROTOCOL_VERSION, token });
  assert.equal(c2.last('welcome')?.hasCaptain, true);
  assert.equal(c2.last('init')?.self.cargo.salt, 3);
});

test('the living ocean: NPC population boots and simulates with LOD', () => {
  const { game } = makeGame();
  game.bootPopulation();
  const n = game.npcs.size;
  assert.ok(n > 60, `${n} NPC ships`);
  const c = join(game, 'Watcher Wynn');
  undockAtSea(game, c);
  steps(game, 20 * 5);
  const st = game.stats();
  assert.ok(st.activeNpcs < st.npcs, 'far NPCs stay abstract');
  const snap = c.last('snap');
  assert.ok(snap && snap.you, 'snapshots flow');
});

test('NPC pirates hunt, fight at range, board once and spare the plundered victim', () => {
  const { game } = makeGame();
  const c = join(game, 'Prey Pete');
  const ship = undockAtSea(game, c);
  // Contested Gravewater: pirates do not attack in the safe Black Coast.
  ship.state.x = 56000;
  ship.state.y = 70000;
  ship.region = game.regionAt(ship.state.x, ship.state.y);
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  const pirate = game.spawnNpcShip('pirate', 'brigantine', 'confederacy', ship.state.x + 600, ship.state.y, -Math.PI / 2);
  const brain = game.npcs.get(pirate.id)!;
  brain.active = true;
  brain.chase = { id: ship.id, until: 1e9 };
  brain.area = { x: ship.state.x, y: ship.state.y, r: 2000 };
  game.grid.upsert(pirate.id, pirate.state.x, pirate.state.y);
  steps(game, 20 * 200);
  const evs = c.all('ev').flatMap((m) => m.list);
  assert.ok(evs.filter((e) => e.k === 'volley' && e.ship === pirate.id).length >= 3, 'pirate fired broadsides');
  assert.ok(ship.hull < ship.stats.hullMax, 'player hull damaged');
  const boards = evs.filter((e) => e.k === 'board_start').length;
  assert.ok(boards <= 1, `boarded ${boards} times`);
  assert.ok(ship.crew >= 2, 'survivors remain');
});

test('reefs: a deep galleon grounds and splinters, a shallow-running sloop skates over', () => {
  const { game } = makeGame();
  const reef = game.world.reefs.find((r) => r.depth < 2.0)!;
  assert.ok(reef, 'world has shallow reefs');
  const run = (classId: 'galleon' | 'sloop') => {
    const npc = game.spawnNpcShip('merchant', classId, 'league', reef.x, reef.y - reef.radius - 20, Math.PI);
    game.npcs.delete(npc.id); // drive it by hand, straight across the reef
    npc.state.speed = 9;
    npc.state.sail = 1;
    npc.input = { rudder: 0, sailTarget: 1 };
    game.grid.upsert(npc.id, npc.state.x, npc.state.y);
    const hull0 = npc.hull;
    let minSpeed = 99;
    for (let i = 0; i < 20 * 40; i++) {
      game.step();
      minSpeed = Math.min(minSpeed, npc.state.speed);
    }
    game.removeShip(npc.id);
    return { dmg: hull0 - npc.hull, minSpeed };
  };
  const galleon = run('galleon');
  const sloop = run('sloop');
  assert.ok(galleon.dmg > 0, `galleon damage ${galleon.dmg}`);
  assert.ok(sloop.dmg === 0, `sloop damage ${sloop.dmg}`);
  assert.ok(galleon.minSpeed < sloop.minSpeed, 'reef drags the galleon');
});
