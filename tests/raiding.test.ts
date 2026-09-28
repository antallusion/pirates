// The raider's trade (docs/12 P6): League convoys with their escorts and rockets, tribute from a merchant who has
// struck (and the word it gives), the glass on a hold and the clerk's manifest, the tavern's tips, the heat of the
// lanes on the prices, the havens' fences, the Brethren's fame, and a merchant under a friend's guns.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRETHREN_RANKS, DEED_CONVOYS, TERROR_TITLE, brethrenRank, heatPrices, raidPatterns } from '../shared/src/data/raiding.ts';
import { SF } from '../shared/src/protocol.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import { isLand, regionAt } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { groupAnswer, groupInvite } from '../server/src/game/party.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { priceMods } from '../server/src/game/ports.ts';
import { appraise, bribeClerk, buyTip, cargoValue, convoyFoe, convoysAt, demandTribute, heatOf, raidView, respondersDue, sailConvoy, stepRaiding, tipViews } from '../server/src/game/raiding.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { portFence } from '../server/src/game/smugglefx.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import * as combat from '../server/src/game/combat.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function raider(game: Game, name: string, region: RegionId, cls = 'brig', level = 6): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  onHull(game, ship, cls, level);
  const [cx, cy] = REGIONS[region].center;
  for (let k = 0; k < 400; k++) {
    const x = cx + ((k * 7919) % 16000) - 8000, y = cy + ((k * 104729) % 16000) - 8000;
    if (regionAt(game.world, x, y) !== region || isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.region = region;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s, ship };
}

function merchantBy(game: Game, ship: ShipEntity, cargo: Record<string, number>): ShipEntity {
  const m = game.spawnNpcShip('merchant', 'fluyt', 'league', ship.state.x + 200, ship.state.y, 0);
  game.setNpcLevel(m, 4);
  m.cargo = cargo;
  m.purse = 100;
  m.region = ship.region;
  game.grid.upsert(m.id, m.state.x, m.state.y);
  return m;
}

test('the Brethren’s ranks by fame; hot lanes make goods dearer and runners richer', () => {
  assert.equal(brethrenRank(0), 0);
  assert.equal(brethrenRank(BRETHREN_RANKS[3]), 3);
  assert.equal(brethrenRank(1e6), 5);
  const cold = heatPrices(0), hot = heatPrices(100);
  assert.equal(cold.buy, 1);
  assert.ok(hot.buy > 1.2 && hot.sell > 1.35);
});

test('tribute: a merchant who struck pays a share and sails on; twice she will not; fired on again, the word is broken', () => {
  const { game } = makeGame();
  const { c, s, ship } = raider(game, 'Tithe Taker', 'gravewater');
  const m = merchantBy(game, ship, { spices: 40 });
  const value = cargoValue(m);
  assert.equal(demandTribute(game, s, m.id), 'Only a merchant who has struck pays tribute.');
  m.surrendered = true;
  const gold0 = s.profile!.gold, inf0 = s.profile!.infamy;
  assert.equal(demandTribute(game, s, m.id), null);
  const got = s.profile!.gold - gold0;
  assert.ok(got >= value * 0.2 - 1 && got <= value * 0.4 + 1, `tribute ${got} of ${value}`);
  assert.equal(m.surrendered, false, 'she sails on');
  assert.equal(s.profile!.infamy - inf0, 4);
  assert.equal(s.profile!.piracy!.fame, 2);
  assert.equal(s.profile!.piracy!.tributes, 1);
  assert.ok(heatOf(game, 'gravewater') >= 5);
  assert.ok(c.all('toast').some((t) => t.msg === `${m.name} pays tribute: ${got} silver. She sails on.`));
  m.surrendered = true;
  assert.equal(demandTribute(game, s, m.id), 'She has paid you already.');
  // Firing on her again: the word is broken.
  const inf1 = s.profile!.infamy;
  m.attackers.clear();
  game.now += 5;
  combat.applyDamage(game, m, { hull: 10 }, ship);
  assert.ok(s.profile!.infamy - inf1 >= 10, 'the broken word');
  assert.ok(c.all('toast').some((t) => t.msg === `You broke your word to ${m.name}: the lanes will remember.`));
});

test('a League convoy: a column of one hull with escorts that answer whoever fires on it; broken, it is the raider’s', () => {
  const { game } = makeGame();
  const { c, s, ship } = raider(game, 'Convoy Cutter', 'gravewater');
  const cv = sailConvoy(game, 'gravewater')!;
  assert.ok(cv, 'a convoy sails');
  assert.ok(cv.members.length >= 3 && cv.members.length <= 6);
  assert.ok(cv.escorts.length >= 1 && cv.escorts.length <= 2);
  const hulls = new Set(cv.members.map((id) => game.ships.get(id)!.loadout.classId));
  assert.equal(hulls.size, 1, 'one hull, one speed');
  const esc = game.ships.get(cv.escorts[0])!;
  assert.equal(game.npcs.get(esc.id)!.leader, cv.members[0]);
  assert.equal(npcHostileTo(game, esc, ship), false);
  // Fire on one of them.
  const m0 = game.ships.get(cv.members[0])!;
  m0.attackers.set(ship.id, game.now);
  stepRaiding(game);
  assert.ok(convoyFoe(game, cv.id, ship));
  assert.equal(npcHostileTo(game, esc, ship), true, 'the escort answers');
  assert.ok(respondersDue(game) >= 0);
  // Every merchant strikes: broken.
  for (const id of cv.members) game.ships.get(id)!.surrendered = true;
  s.profile!.piracy!.convoys = DEED_CONVOYS - 1;
  stepRaiding(game);
  assert.equal(convoysAt(game).length, 0);
  assert.equal(s.profile!.piracy!.convoys, DEED_CONVOYS);
  assert.ok(s.profile!.deeds.includes('deed_convoy_breaker'));
  assert.ok(c.all('toast').some((t) => t.msg === `WORLD: Convoy Cutter broke a League convoy in ${REGIONS.gravewater.name}!`));
  assert.ok(heatOf(game, 'gravewater') >= 19.9);
});

test('a merchant under fire in contested water sends up a rocket: a League cutter comes for the raider', () => {
  const { game } = makeGame();
  const { c, ship } = raider(game, 'Rocket Rook', 'gravewater');
  const cv = sailConvoy(game, 'gravewater')!;
  const m = game.ships.get(cv.members[0])!;
  m.state.x = ship.state.x + 300;
  m.state.y = ship.state.y;
  game.npcs.get(m.id)!.active = true;
  m.attackers.set(ship.id, game.now);
  stepRaiding(game);
  assert.ok(c.all('toast').some((t) => t.msg === `${m.name} sends up a rocket — a patrol will come!`));
  const before = [...game.ships.values()].filter((x) => x.npcRole === 'hunter').length;
  game.now += 95;
  stepRaiding(game);
  const hunters = [...game.ships.values()].filter((x) => x.npcRole === 'hunter');
  assert.ok(hunters.length > before, 'a cutter comes');
  assert.equal(game.npcs.get(hunters[hunters.length - 1].id)!.huntAccount, game.sessionByName('Rocket Rook')!.accountId);
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('A League cutter answers the rocket')));
});

test('the glass weighs a hold roughly; the clerk’s manifest makes it exact and names her port', () => {
  const { game } = makeGame();
  const { s, ship } = raider(game, 'Glass Gil', 'gravewater');
  const m = merchantBy(game, ship, { spices: 50 });
  const v = appraise(game, s, m.id);
  assert.ok(typeof v !== 'string');
  const real = cargoValue(m);
  if (typeof v !== 'string') {
    assert.ok(Math.abs(v.value - real) <= real * 0.16 + 100, `${v.value} ~ ${real}`);
    assert.equal(v.exact, false);
    assert.ok(v.fill > 0);
  }
  // The clerk.
  const port = game.world.ports.find((p) => p.region === 'gravewater')!;
  m.originPort = port.id;
  game.npcs.get(m.id)!.destPort = game.world.ports.find((p) => p.id !== port.id)!.id;
  s.profile!.gold = 10000;
  assert.equal(bribeClerk(game, s, port), null);
  const w = appraise(game, s, m.id);
  assert.ok(typeof w !== 'string' && w.exact && w.value === Math.round(real / 100) * 100 && w.dest);
});

test('a tip in the tavern: bought, its merchant puts out at the hour with the goods, marked for the buyer', () => {
  const { game } = makeGame();
  const { c, s } = raider(game, 'Tip Tobias', 'gravewater');
  const port = game.world.ports.find((p) => p.region === 'gravewater' && p.size >= 2)!;
  const v = tipViews(game, s, port);
  assert.ok(v.tips.length >= 1);
  const tip = v.tips[0];
  s.profile!.gold = 10000;
  assert.equal(buyTip(game, s, port, tip.id), null);
  assert.equal(buyTip(game, s, port, tip.id), 'The tip is yours already.');
  game.now += tip.departIn + 1;
  stepRaiding(game);
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('The tipped merchant puts to sea')));
  const marks = raidView(game, s).marks;
  assert.equal(marks.length, 1);
  const m = game.ships.get(marks[0].id)!;
  assert.ok((m.cargo[tip.good] ?? 0) > 0, 'with the goods the tip named');
});

test('hot lanes lift the prices; the havens’ fences pay more to the Brethren’s own; the title at the top', () => {
  const { game } = makeGame();
  const { s, ship } = raider(game, 'Fence Fanny', 'ashen_isles');
  const port = game.world.ports.find((p) => p.region === 'ashen_isles' && p.faction === 'confederacy' && !p.blackMarket);
  if (port) {
    assert.equal(portFence(game, ship, port), 0.6);
    s.profile!.piracy!.fame = BRETHREN_RANKS[1];
    assert.equal(portFence(game, ship, port), 0.66);
  }
  const gp = game.world.ports.find((p) => p.region === 'gravewater')!;
  const m0 = priceMods(ship, gp, s.profile!, game.now, game);
  for (let i = 0; i < 12; i++) {
    const mm = merchantBy(game, ship, { spices: 60 });
    mm.surrendered = true;
    mm.region = 'gravewater';
    demandTribute(game, s, mm.id);
  }
  const m1 = priceMods(ship, gp, s.profile!, game.now, game);
  assert.ok(m1.buyMul > m0.buyMul && m1.sellMul > m0.sellMul, 'dearer in hot lanes');
  s.profile!.piracy!.fame = BRETHREN_RANKS[5] - 1;
  const mm = merchantBy(game, ship, { spices: 60 });
  mm.surrendered = true;
  demandTribute(game, s, mm.id);
  assert.ok(s.profile!.titles.includes(TERROR_TITLE));
});

test('a merchant under a friend’s guns sails guarded: a pirate of her level leaves her be', () => {
  const { game } = makeGame();
  const { s: a, ship: trader } = raider(game, 'Trader Tam', 'gravewater', 'fluyt', 5);
  const { s: b, ship: guard } = raider(game, 'Guard Gus', 'gravewater', 'frigate', 7);
  guard.state.x = trader.state.x + 300;
  guard.state.y = trader.state.y;
  game.grid.upsert(guard.id, guard.state.x, guard.state.y);
  assert.equal(groupInvite(game, a, b.name), null);
  const inv = [...game.social.invites.values()].find((i) => i.to === b.accountId)!;
  assert.equal(groupAnswer(game, b, inv.id, true), null);
  stepRaiding(game);
  assert.ok(trader.flagsFor(null, false, game.now) & SF.GUARDED, 'guarded');
  const pirate = game.spawnNpcShip('pirate', 'brig', 'confederacy', trader.state.x + 900, trader.state.y, 0);
  game.setNpcLevel(pirate, 5);
  pirate.region = 'gravewater';
  assert.equal(npcHostileTo(game, pirate, trader), false, 'she thinks twice');
  const big = game.spawnNpcShip('pirate', 'frigate', 'confederacy', trader.state.x + 900, trader.state.y, 0);
  game.setNpcLevel(big, 8);
  assert.equal(npcHostileTo(game, big, trader), true, 'one well above does not');
});

test('the raider’s trade reads in Russian', () => {
  setLang('ru');
  assert.equal(serverText(TERROR_TITLE), 'Гроза торговцев');
  assert.match(serverText('Swivel guns bark from her rail!'), /фальконеты/);
  for (const [en, ru] of raidPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
