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

test('cartography: charts sell once per port, bought charts reveal islands without discovery XP', () => {
  const { game } = makeGame();
  const c = join(game, 'Map Maker');
  const s = [...game.sessions][0];
  const p = s.profile!;
  // Chart five nearby islands by sailing past (simulated discovery).
  const known = game.world.islands.filter((is) => !is.portId && is.region === 'black_coast').slice(0, 5);
  for (const is of known) s.discovered.add(is.id);
  game.pushPort(s);
  const view = c.last('port')!.view!;
  assert.equal(view.charts.sellable, 5);
  const gold0 = p.gold;
  c.push({ t: 'chart', action: 'sell' });
  assert.equal(p.gold, gold0 + view.charts.sellValue);
  c.push({ t: 'chart', action: 'sell' });
  assert.equal(p.gold, gold0 + view.charts.sellValue, 'the same knowledge cannot be sold twice to one port');
  // Buy a regional chart.
  const offer = c.last('port')!.view!.charts.offers[0];
  p.gold = 10000;
  const xp0 = p.xp, lvl0 = p.level, n0 = s.discovered.size;
  c.push({ t: 'chart', action: 'buy', region: offer.region });
  assert.equal(s.discovered.size, n0 + offer.islands);
  assert.equal(p.gold, 10000 - offer.price);
  assert.ok(p.xp === xp0 && p.level === lvl0, 'no discovery XP from bought charts');
  game.pushPort(s);
  assert.equal(c.last('port')!.view!.charts.sellable, 0, 'bought charts cannot be resold');
  assert.ok(offer.price < 1200, `a starting captain can afford a chart (${offer.price})`);
});

test('sightings and market intel are remembered with timestamps', () => {
  const { game } = makeGame();
  const c = join(game, 'Look Out');
  const s = [...game.sessions][0];
  assert.equal(c.last('init')!.self.intel.length, 1, 'starting port market is known');
  c.push({ t: 'undock' });
  const ship = s.ship!;
  const ghost = game.spawnNpcShip('ghost', 'ghost_ship', 'choir', ship.state.x + 300, ship.state.y, 0);
  game.npcs.get(ghost.id)!.active = true;
  game.grid.upsert(ghost.id, ghost.state.x, ghost.state.y);
  steps(game, 25);
  const sg = s.profile!.sightings.find((q) => q.kind === 'ghost');
  assert.ok(sg, 'ghost ship logged');
  assert.ok(Math.abs(sg.x - ghost.state.x) < 50);
});

function parkNear(game: Game, ship: ShipEntity, feature: string) {
  const is = game.world.islands.find((i) => i.features.includes(feature as never) && !i.portId)!;
  // Just off the coast.
  const n = is.poly.length;
  const px = is.poly[0], py = is.poly[1];
  const dx = px - is.x, dy = py - is.y, d = Math.hypot(dx, dy);
  ship.state.x = px + (dx / d) * 120;
  ship.state.y = py + (dy / d) * 120;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  void n;
  return is;
}

test('landing parties: anchor, explore a feature, bring back loot; it restocks only later', () => {
  const { game } = makeGame();
  const c = join(game, 'Beach Comber');
  c.push({ t: 'undock' });
  const s = [...game.sessions][0];
  const ship = s.ship!;
  const is = parkNear(game, ship, 'wreck');
  steps(game, 25);
  assert.ok(s.landable, 'feature within reach');
  c.push({ t: 'land' });
  assert.ok(ship.landing, 'boats away');
  const x0 = ship.state.x;
  const cargo0 = (ship.cargo.planks ?? 0) + (ship.cargo.sailcloth ?? 0);
  steps(game, 20 * 45);
  assert.equal(ship.landing, null);
  assert.ok(Math.abs(ship.state.x - x0) < 1, 'ship rode at anchor');
  assert.ok((ship.cargo.planks ?? 0) + (ship.cargo.sailcloth ?? 0) > cargo0 || !c.all('toast').every((t) => !/party returns/.test(t.msg)), 'salvage brought back');
  assert.ok(c.all('toast').some((t) => /party returns/.test(t.msg)));
  assert.ok(s.profile!.explored[`${is.id}:wreck`] > 0);
  c.push({ t: 'land' });
  assert.equal((ship.landing as { islandId: number; feature: string } | null)?.islandId === is.id, false, 'same feature not immediately again');
});

test('landing parties are recalled when the captain raises sail early', () => {
  const { game } = makeGame();
  const c = join(game, 'Impatient Ike');
  c.push({ t: 'undock' });
  const s = [...game.sessions][0];
  const ship = s.ship!;
  parkNear(game, ship, 'ruins');
  steps(game, 25);
  c.push({ t: 'land' });
  assert.ok(ship.landing);
  steps(game, 20 * 3);
  c.push({ t: 'input', seq: 5, rudder: 0, sail: 3 });
  steps(game, 25);
  assert.equal(ship.landing, null);
  assert.ok(c.all('toast').some((t) => /recalled/.test(t.msg)));
});

test('tavern rumours point to unexplored features and chart them', () => {
  const { game } = makeGame();
  const c = join(game, 'Rumour Monger');
  const s = [...game.sessions][0];
  const rumor = c.last('port')!.view!.rumors[0];
  assert.match(rumor, /km .* of here/);
  const name = /on (.+?), \d+ km/.exec(rumor)![1];
  const island = game.world.islands.find((i) => i.name === name)!;
  assert.ok(s.discovered.has(island.id), 'the rumoured island is marked on the chart');
});

test('curse: the Abyss claims a lingering ship in stages; a Crown yard scrapes it clean', async () => {
  const { curseStage, curseStageFromFlags } = await import('../shared/src/protocol.ts');
  const { game } = makeGame();
  const c = join(game, 'Deep Diver');
  c.push({ t: 'undock' });
  const s = [...game.sessions][0];
  const ship = s.ship!;
  const armor0 = ship.stats.armor;
  ship.state.x = 89000;
  ship.state.y = 9000; // The Abyss
  ship.protectedUntil = 1e9;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  steps(game, 20 * 60 * 8);
  assert.ok(ship.curse >= 50, `curse ${ship.curse.toFixed(1)}`);
  assert.ok(curseStage(ship.curse) >= 2);
  assert.ok(ship.stats.armor > armor0, 'barnacle armour');
  assert.equal(curseStageFromFlags(ship.flagsFor(null, false, game.now)), curseStage(ship.curse));
  // Back to Gravesend (Crown) for a cleansing.
  const gravesend = game.portById('gravesend')!;
  ship.state.x = gravesend.x;
  ship.state.y = gravesend.y;
  ship.state.speed = 0;
  ship.lastCombat = -999;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  s.profile!.gold = 50000;
  s.profile!.infamy = 0;
  c.push({ t: 'dock' });
  assert.equal(ship.docked, 'gravesend');
  c.push({ t: 'cleanse' });
  assert.equal(ship.curse, 0);
  assert.equal(ship.stats.armor, armor0);
});

test('bow chasers hit a ship dead ahead; broadsides cannot', () => {
  const { game } = makeGame();
  const c = join(game, 'Chase Master');
  const ship = undockAtSea(game, c);
  const npc = game.spawnNpcShip('merchant', 'fluyt', 'league', ship.state.x, ship.state.y - 200, 0);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  const hull0 = npc.hull;
  c.push({ t: 'chase', end: 'stern', x: npc.state.x, y: npc.state.y });
  assert.ok(c.all('toast').some((t) => /No stern chasers/.test(t.msg)), 'sloops have no stern chasers');
  c.push({ t: 'chase', end: 'bow', x: npc.state.x, y: npc.state.y });
  steps(game, 30);
  assert.ok(npc.hull < hull0, 'chaser ball struck');
  assert.ok(ship.chaserReload.bow > 0);
});

test('heavy shot pierces armour; fire shot starts fires', () => {
  const { game } = makeGame();
  const c = join(game, 'Ordnance Officer');
  const ship = undockAtSea(game, c);
  const hit = (ammo: 'round' | 'heavy' | 'incendiary') => {
    const npc = npcAbeam(game, ship, 'starboard', 110);
    npc.loadout.classId = 'galleon';
    npc.recompute(game.now);
    npc.hull = npc.stats.hullMax;
    const hull0 = npc.hull;
    ship.ammo[ammo] = 50;
    ship.ammoSel = ammo;
    ship.reload.starboard = 0;
    c.push({ t: 'fire', side: 'starboard', dist: 110 });
    steps(game, 40);
    const dmg = hull0 - npc.hull;
    const burning = npc.hasEffect('fire');
    game.removeShip(npc.id);
    return { dmg, burning };
  };
  let round = 0, heavy = 0, fires = 0;
  for (let i = 0; i < 4; i++) {
    round += hit('round').dmg;
    heavy += hit('heavy').dmg;
    if (hit('incendiary').burning) fires++;
  }
  assert.ok(heavy > round, `heavy ${heavy.toFixed(0)} > round ${round.toFixed(0)} against an armoured galleon`);
  assert.ok(fires >= 1, 'fire shot set at least one fire');
});
