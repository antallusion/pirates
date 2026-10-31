// Forum, Нефигугум 2026-10-30 (topic «Я - НОВИЧЕК(НУБ)», post 26): four of a newcomer's troubles.
//  1. Boarding a small fast pirate: «Атаковать → абордаж» is an intercept — the helmsman cuts her off at full sail and
//     the grapples fly by themselves alongside; a pirate holed past her nerve runs low in the water, chain or grape from a
//     ship on her boarding run fouls her rigging; a ⚓3–5 captain boards a small pirate within a minute.
//  2. «Причал»: two berths free (the owner's numbers), +1 for 300 doubloons to ten; a new hull bought «и оставить старый»
//     keeps the old one with all her fittings; «Пересесть» at any harbour with a yard; the hold and the men asked about;
//     persisted.
//  3. A bump between ships at peace is no ram: no infamy, no quarrel, no escort's answer; her squadron starts nothing with a
//     lawful ship; the autopilot gives the other ships a berth; the squadron keeps up.
//  4. The escorts' repair: with her own ship's in port at a price shown, slowly at sea out of a fight.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BERTH_PRICE, BERTHS_CAP, BERTHS_FREE } from '../shared/src/data/berths.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { headingVec } from '../shared/src/math.ts';
import { creditPremium } from '../server/src/game/premium.ts';
import { berthCap, berthFit } from '../server/src/game/shipbuilding.ts';
import { ESCORT_CALM_SEC, escortMends, mendEscortsAtSea, spawnEscortShip } from '../server/src/game/fleet.ts';
import { hiredFoe, npcHostileTo } from '../server/src/game/npc.ts';
import { pursuitOf } from '../server/src/game/pursuit.ts';
import { startAutosail } from '../server/src/game/autosail.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { duelSea, openWater } from './balance/duel.ts';
import { seaCaptain } from './balance/seafight.ts';
import type { FakeConn } from './helpers.ts';
import { join, knowHulls, makeGame, steps } from './helpers.ts';

function inPort(name: string): { game: Game; c: FakeConn; s: PlayerSession; db: ReturnType<typeof makeGame>['db'] } {
  const { game, db } = makeGame();
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.level = 30;
  s.profile!.gold = 100_000;
  knowHulls(s.profile!);
  return { game, c, s, db };
}

// ------------------------------------------------------------------------------------------------ 2. «Причал»

test('«Причал»: three berths free, +1 for 300 doubloons each to ten, the doubloons off in one ledger row; saved with her', () => {
  const { game, c, s, db } = inPort('Berth Buyer');
  const p = s.profile!;
  assert.equal(BERTHS_FREE, 3);
  assert.equal(BERTH_PRICE, 300);
  assert.equal(berthCap(p), 3);
  c.push({ t: 'berth', action: 'buy' });
  assert.match(c.last('toast')!.msg, /A berth costs 300 doubloons/);
  assert.equal(berthCap(p), 3, 'too poor: nothing bought');
  creditPremium(game, s.accountId, 5000, 'admin', 'berths');
  c.push({ t: 'berth', action: 'buy' });
  assert.equal(berthCap(p), 4);
  assert.equal(db.doubloons(s.accountId), 5000 - 300);
  for (let i = 0; i < 20; i++) c.push({ t: 'berth', action: 'buy' });
  assert.equal(berthCap(p), BERTHS_CAP, 'ten at most');
  assert.equal(db.doubloons(s.accountId), 5000 - 300 * (BERTHS_CAP - BERTHS_FREE));
  assert.match(c.last('toast')!.msg, /10 berths at most/);
  game.saveSession(s);
  assert.equal(JSON.parse(db.loadCaptain(s.accountId)!.data).berthsBought, BERTHS_CAP - BERTHS_FREE, 'persisted');
  assert.equal(c.last('self')?.self?.berthCap ?? berthCap(p), BERTHS_CAP);
});

test('a new hull: «Обменять» trades the old one in; «Купить и оставить старый» berths her with every fitting, gun and level', () => {
  const { game, c, s } = inPort('Keeper Kit');
  const p = s.profile!;
  const ship = s.ship!;
  const port = ship.docked!;
  // her sloop fitted out: a level up, a fitting, guns
  ship.loadout.modules = { ...ship.loadout.modules, reinforced_hull: 1 } as never;
  ship.loadout.name = 'Old Faithful';
  ship.crew = 10; // (her men fit the cutter: the hammocks are another test's)
  const before = JSON.stringify({ m: ship.loadout.modules, g: ship.loadout.guns });
  const gold = p.gold;
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'cutter', keep: true });
  assert.equal(ship.loadout.classId, 'cutter', 'she sails the new hull');
  assert.equal(p.berths.length, 1);
  const b = p.berths[0];
  assert.equal(b.loadout.classId, 'sloop');
  assert.equal(b.loadout.name, 'Old Faithful');
  assert.equal(b.port, port);
  assert.equal(JSON.stringify({ m: b.loadout.modules, g: b.loadout.guns }), before, 'her fittings and guns kept');
  assert.equal(gold - p.gold, SHIP_CLASSES.cutter.price, 'paid in full: no trade-in');
  // «Обменять (сдать старый)»: the old one goes to the yard, nothing berthed
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'pinnace' });
  assert.equal(ship.loadout.classId, 'pinnace');
  assert.equal(p.berths.length, 1, 'traded in, not berthed');
  // the berths full: «оставить» refused, the trade-in still open
  p.berths.push({ port, loadout: { ...ship.loadout, name: 'Filler' }, hull: 1 });
  p.berths.push({ port, loadout: { ...ship.loadout, name: 'Filler 2' }, hull: 1 });
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'lugger', keep: true });
  assert.match(c.last('toast')!.msg, /You already berth 3 ships/);
  assert.equal(ship.loadout.classId, 'pinnace');
});

test('«Пересесть» at any harbour with a yard: the berthed ship out with her fittings, the old one in her place there; the army and hold go across', () => {
  const { game, c, s } = inPort('Swap Sal');
  const p = s.profile!;
  const ship = s.ship!;
  ship.crew = 10;
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'cutter', keep: true });
  assert.equal(p.berths[0].loadout.classId, 'sloop');
  // sail her to another harbour with a yard (the berth is at Saltmarrow)
  const far = game.world.ports.find((x) => x.shipyardTier > 0 && x.id !== ship.docked)!;
  ship.docked = far.id;
  p.docked = far.id;
  ship.cargo = { rum: 3 } as never;
  const men = ship.crew;
  c.push({ t: 'berth', action: 'swap', index: 0 });
  assert.equal(ship.loadout.classId, 'sloop', 'she sails the berthed sloop');
  assert.equal(p.berths[0].loadout.classId, 'cutter', 'the cutter takes the berth');
  assert.equal(p.berths[0].port, far.id, 'berthed where she changed');
  assert.equal(ship.cargo.rum, 3, 'the hold went across');
  assert.equal(ship.crew, Math.min(men, ship.stats.crewMax), 'the men went across');
  // an island's caravan hull is taken out at the island, not here
  p.berths.push({ port: 'isle:1', loadout: { ...p.berths[0].loadout, name: 'Isle Hull' }, hull: 1 });
  c.push({ t: 'berth', action: 'swap', index: 1 });
  assert.match(c.last('toast')!.msg, /berthed at your island/);
  // a harbour with no yard
  const noYard = game.world.ports.find((x) => !(x.shipyardTier > 0));
  if (noYard) {
    ship.docked = noYard.id;
    p.docked = noYard.id;
    c.push({ t: 'berth', action: 'swap', index: 0 });
    assert.match(c.last('toast')!.msg, /No yard here/);
  }
});

test('«Пересесть» into a smaller hull: a hold she cannot take is refused; men she has no hammocks for are asked about, then paid off', () => {
  const { game, c, s } = inPort('Small Swap');
  const p = s.profile!;
  const ship = s.ship!;
  // (a yard that builds a brig)
  const yard = game.world.ports.find((x) => x.shipyardTier >= SHIP_CLASSES.brig.tier)!;
  ship.docked = yard.id;
  p.docked = yard.id;
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'brig', keep: true });
  assert.equal(ship.loadout.classId, 'brig');
  ship.crew = ship.stats.crewMax;
  const fit = berthFit(s, p.berths[0].loadout);
  assert.ok(fit.menOver > 0, 'the sloop has fewer hammocks');
  ship.cargo = { planks: Math.ceil(fit.hold * 1.5) } as never;
  c.push({ t: 'berth', action: 'swap', index: 0 });
  assert.match(c.last('toast')!.msg, /Her hold takes \d+: sell or store \d+ more in the warehouse first/);
  assert.equal(ship.loadout.classId, 'brig');
  ship.cargo = {};
  c.inbox.length = 0;
  c.push({ t: 'berth', action: 'swap', index: 0 });
  const ask = c.last('berth_ask');
  assert.ok(ask, 'asked, not refused');
  assert.equal(ask!.men, berthFit(s, p.berths[0].loadout).menOver);
  assert.equal(ship.loadout.classId, 'brig', 'nothing done before the answer');
  c.push({ ...ask!.again, force: true });
  assert.equal(ship.loadout.classId, 'sloop');
  assert.ok(ship.crew <= ship.stats.crewMax);
});

// ------------------------------------------------------------------------------------------------ 4. the escorts' repair

test('the escorts mend with her own ship at the yard, at a price shown («Починить сопровождение»), and slowly at sea out of a fight', () => {
  const { game, c, s } = inPort('Mender Mo');
  const p = s.profile!;
  p.fleet.escorts.push({ id: 'e1', classId: 'cutter', name: 'Loyal Oath', hull: 0.4 });
  c.push({ t: 'shipyard', action: 'repair' }); // her own sound: the squadron alone
  game.pushPort(s);
  // making port no longer mends them by itself: the price is shown first
  p.fleet.escorts[0].hull = 0.4;
  game.pushPort(s);
  const view = c.last('port')!.view!;
  assert.ok(view.shipyard.escorts && view.shipyard.escorts.cost > 0, 'the line and its price');
  assert.equal(view.shipyard.escorts!.ships[0].hull, 40);
  assert.ok(view.shipyard.repairCost >= view.shipyard.escorts!.cost, 'the one button counts them');
  const gold = p.gold;
  c.push({ t: 'shipyard', action: 'repair_escorts' });
  assert.equal(p.fleet.escorts[0].hull, 1, 'mended');
  assert.equal(gold - p.gold, view.shipyard.escorts!.cost, 'for the price shown');
  c.push({ t: 'shipyard', action: 'repair_escorts' });
  assert.match(c.last('toast')!.msg, /Your escorts are sound/);
  // her own ship hurt and an escort hurt: one «Починить» for both
  p.fleet.escorts[0].hull = 0.5;
  s.ship!.hull = s.ship!.stats.hullMax * 0.5;
  c.push({ t: 'shipyard', action: 'repair' });
  assert.equal(s.ship!.hull, s.ship!.stats.hullMax);
  assert.equal(p.fleet.escorts[0].hull, 1);
  assert.equal(escortMends(game, s).length, 0);
  // at sea: out of a fight her carpenters mend her; under fire they wait
  c.push({ t: 'undock' });
  const esc = [...game.ships.values()].find((x) => x.fleetId === 'e1') ?? spawnEscortShip(game, s, p.fleet.escorts[0], 0);
  esc.hull = esc.stats.hullMax * 0.4;
  esc.lastHitAt = game.now;
  mendEscortsAtSea(game, 1);
  assert.equal(esc.hull, esc.stats.hullMax * 0.4, 'not under fire');
  esc.lastHitAt = game.now - ESCORT_CALM_SEC - 1;
  for (let i = 0; i < 60; i++) mendEscortsAtSea(game, 1);
  assert.ok(esc.hull > esc.stats.hullMax * 0.6, `a minute out of the fight: ${Math.round((esc.hull / esc.stats.hullMax) * 100)}%`);
  assert.ok(esc.hull < esc.stats.hullMax, 'slowly, not at once');
});

// ------------------------------------------------------------------------------------------------ 3. bumps, escorts, skulls

function seaPair(name: string): { game: Game; c: FakeConn; s: PlayerSession; me: ShipEntity; patrol: ShipEntity } {
  const game = duelSea();
  const at = openWater(game, 7);
  const s = seaCaptain(game, 'schooner', 3, at.x, at.y, 0);
  s.profile!.level = 6; // a newcomer's
  const me = s.ship!;
  const patrol = game.spawnNpcShip('patrol', 'brig', 'crown', at.x, at.y - 30, Math.PI);
  const b = game.npcs.get(patrol.id)!;
  b.active = true;
  b.keep = true;
  game.grid.upsert(patrol.id, patrol.state.x, patrol.state.y);
  void name;
  return { game, c: s.conn as unknown as FakeConn, s, me, patrol };
}

test('a bump between ships at peace is no ram: no hull lost, no infamy, no quarrel — under Ramming Speed it is one', () => {
  const { game, s, me, patrol } = seaPair('Bumper');
  me.state.heading = 0;
  me.state.speed = me.stats.maxSpeed;
  patrol.state.speed = patrol.stats.maxSpeed * 0.5;
  const h0 = patrol.hull, inf0 = s.profile!.infamy;
  let minD = Infinity;
  for (let i = 0; i < 20; i++) {
    game.step();
    minD = Math.min(minD, Math.hypot(patrol.state.x - me.state.x, patrol.state.y - me.state.y));
  }
  assert.ok(minD < (me.stats.length + patrol.stats.length) * 0.32 + 2, `the hulls met (${Math.round(minD)} m)`);
  assert.equal(patrol.attackers.has(me.id), false, 'no blow on the record');
  assert.equal(me.attackers.has(patrol.id), false);
  assert.equal(patrol.hull, h0, 'no hull lost');
  assert.equal(s.profile!.infamy, inf0, 'no infamy');
  assert.equal(npcHostileTo(game, patrol, me), false, 'the patrol keeps the peace');
  // Ramming Speed: a ram she meant — under the pirate flag (forum 34: under the city flag a patrol is no prey, a ram a bump)
  s.profile!.pvp.flag = 'pirate';
  patrol.state.x = me.state.x;
  patrol.state.y = me.state.y - 30;
  patrol.hull = patrol.stats.hullMax;
  me.addEffect({ id: 'ramming_speed', until: game.now + 5 }, game.now);
  me.state.heading = 0;
  me.state.speed = me.stats.maxSpeed;
  steps(game, 20);
  assert.equal(patrol.attackers.has(me.id), true, 'a ram under Ramming Speed counts');
});

test('her squadron starts nothing with a lawful ship: no quarrel from a brush, only who fired on her or her mark', () => {
  const { game, s, me, patrol } = seaPair('Squadron Sue');
  s.profile!.fleet.escorts.push({ id: 'e9', classId: 'cutter', name: 'Steadfast', hull: 1 });
  const esc = spawnEscortShip(game, s, s.profile!.fleet.escorts[0], 0);
  // an old blow on the record, two minutes and more ago (before: any ship that ever traded one with her was a foe for good)
  patrol.attackers.set(me.id, game.now - 300);
  me.attackers.set(patrol.id, game.now - 300);
  assert.equal(npcHostileTo(game, esc, patrol), false, 'an old quarrel is over');
  assert.equal(hiredFoe(game, esc, me, patrol), false);
  // the patrol fires on her: the squadron answers
  me.attackers.set(patrol.id, game.now);
  assert.equal(npcHostileTo(game, esc, patrol), true, 'defends her');
});

test('a newcomer under the autopilot in safe water: the other ships are given a berth, and she ends with no skulls', () => {
  const { game, s, me, patrol } = seaPair('Afk Annie');
  // the patrol lies still right across her course, 200 m ahead
  patrol.state.x = me.state.x;
  patrol.state.y = me.state.y - 200;
  patrol.state.speed = 0;
  patrol.input = { rudder: 0, sailTarget: 0 };
  game.npcs.delete(patrol.id); // lying to (no brain of her own)
  game.grid.upsert(patrol.id, patrol.state.x, patrol.state.y);
  me.state.heading = 0;
  assert.equal(startAutosail(game, s, me.state.x, me.state.y - 1500), null);
  let minD = Infinity;
  for (let i = 0; i < 20 * 60 && pursuitOf(me) === null; i++) {
    game.step();
    minD = Math.min(minD, Math.hypot(patrol.state.x - me.state.x, patrol.state.y - me.state.y));
  }
  assert.ok(minD > (me.stats.length + patrol.stats.length) * 0.32, `rounded her (${Math.round(minD)} m at the nearest)`);
  assert.equal(s.profile!.infamy, 0, 'no skulls');
  assert.equal(patrol.attackers.has(me.id), false);
});

test('her squadron keeps up: a slower escort astern a cable and more presses on and closes up', () => {
  const { game, s, me } = seaPair('Fleet Flo');
  s.profile!.fleet.escorts.push({ id: 'e7', classId: 'cog', name: 'Hard Bargain', hull: 1 });
  const esc = spawnEscortShip(game, s, s.profile!.fleet.escorts[0], 0);
  esc.state.x = me.state.x;
  esc.state.y = me.state.y + 500; // half a kilometre astern
  game.grid.upsert(esc.id, esc.state.x, esc.state.y);
  me.state.heading = 0;
  assert.equal(startAutosail(game, s, me.state.x, me.state.y - 6000, 1), null);
  const d0 = Math.hypot(esc.state.x - me.state.x, esc.state.y - me.state.y);
  steps(game, 20 * 60);
  const d1 = Math.hypot(esc.state.x - me.state.x, esc.state.y - me.state.y);
  assert.ok(d1 < 250, `closed up from ${Math.round(d0)} m to ${Math.round(d1)} m (a ${SHIP_CLASSES.cog.maxSpeed}-knot cog after a schooner)`);
});

// ------------------------------------------------------------------------------------------------ 1. the intercept

test('«Атаковать → абордаж» on a small fast pirate: a ⚓3–5 captain is alongside and boarding within a minute, whole or holed', () => {
  const game = duelSea();
  game.tacticalBoarding = false;
  const caps: [string, number][] = [['schooner', 3], ['brigantine', 4], ['xebec', 5]];
  const times: number[] = [];
  let k = 0;
  for (const [cls, lvl] of caps) for (const fc of ['cutter', 'felucca', 'lugger']) for (const hurt of [1, 0.3]) {
    k++;
    const at = openWater(game, k);
    const s = seaCaptain(game, cls as never, lvl, at.x, at.y, 0);
    const me = s.ship!;
    me.state.speed = me.stats.maxSpeed * 0.6;
    const h = (k * 2.399) % (Math.PI * 2);
    const v = headingVec(h);
    const foe = game.spawnNpcShip('pirate', fc as never, 'confederacy', at.x + v.x * 600, at.y + v.y * 600, h);
    game.setNpcLevel(foe, Math.max(1, lvl - 1));
    const b = game.npcs.get(foe.id)!;
    b.active = true;
    b.keep = true;
    foe.hull = foe.stats.hullMax * hurt;
    foe.state.speed = foe.stats.maxSpeed * 0.7;
    game.grid.upsert(foe.id, foe.state.x, foe.state.y);
    const c = s.conn as unknown as FakeConn;
    c.push({ t: 'attack', target: foe.id, mode: 'board' });
    if (c.last('board_risk')) c.push({ t: 'board', target: foe.id, aggression: 'standard', risk: true });
    const t0 = game.now;
    let at2 = -1;
    while (game.now - t0 < 60) {
      game.step();
      if (me.boarding || foe.grappled) {
        at2 = game.now - t0;
        break;
      }
    }
    assert.ok(at2 > 0, `${cls} ⚓${lvl} on a ${fc} at ${hurt * 100}%: boarded within 60 s`);
    times.push(Math.round(at2));
    if (game.ships.has(foe.id)) game.removeShip(foe.id);
    me.boarding = null;
    me.state.x = 1000 + k * 50;
    me.docked = 'saltmarrow';
    c.inbox.length = 0;
  }
  console.log(`intercept to the grapples, s: ${times.join(' ')}`);
});
