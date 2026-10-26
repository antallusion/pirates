// Owner, 2026-10-25: a ship of the sea hired at sea as a guard for 10–20 minutes, of the captain's own level, for a price
// that is a real decision (shared/src/data/seahire.ts, server/src/game/seahire.ts, npc.ts hiredFoe / waitOffHarbour).

import { dailyRollover } from '../server/src/game/dailies.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HIRE_MINUTES, HIRE_REACH, REHIRE_SEC, hirePrice, hireRefund, hireSlots, powerMul, priceMinutes } from '../shared/src/data/seahire.ts';
import type { HireOffer } from '../shared/src/data/seahire.ts';
import { hourSilver, shipBandOf } from '../shared/src/data/xpcurve.ts';
import { CAPTAIN_LEVEL_FOR_SHIP, hullsFor } from '../shared/src/data/shiplevel.ts';
import type { ShipClassId } from '../shared/src/data/ships.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { isLand, nearHarbour, regionAt } from '../shared/src/world/worldgen.ts';
import { applyDamage, damageBlocked } from '../server/src/game/combat.ts';
import { startBoarding } from '../server/src/game/boarding.ts';
import { untouchable } from '../server/src/game/inbattle.ts';
import { HIRE_WAIT_R, npcHostileTo } from '../server/src/game/npc.ts';
import { dismiss, hire, hireOffer, hireWhy, hiresOf, resetHires, restoreHires } from '../server/src/game/seahire.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame } from './helpers.ts';
import { serverText } from '../client/src/lang/server.ts';
import { EN, RU } from '../client/src/lang/ui/seahire.ts';

function water(game: Game, x: number, y: number): { x: number; y: number } {
  for (let r = 0; r < 6000; r += 150) {
    for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a * 0.39) * r, py = y + Math.sin(a * 0.39) * r;
      if (!isLand(game.world, px, py) && !isLand(game.world, px + 300, py) && !isLand(game.world, px - 300, py) && !isLand(game.world, px, py + 300) && !isLand(game.world, px, py - 300) && !nearHarbour(game.world, px, py, 2500)) return { x: px, y: py };
    }
  }
  throw new Error('no water');
}

/** A captain of level `level` at sea (⚓ band shipBandOf). */
function captain(game: Game, name: string, at: { x: number; y: number }, level = CAPTAIN_LEVEL_FOR_SHIP[3]): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  s.profile!.level = level;
  s.profile!.gold = 50000;
  // (no daily orders: the day's roll paid +126 for a region found on 2026-10-26 and «nothing back» failed by the date)
  dailyRollover(game, s);
  s.profile!.daily.orders = [];
  const ship = s.ship!;
  Object.assign(ship.state, { x: at.x, y: at.y, heading: 0, speed: 0 });
  ship.region = regionAt(game.world, at.x, at.y);
  ship.protectedUntil = 0;
  ship.battleGraceUntil = 0;
  ship.battleCardAt = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, at.x, at.y);
  return { c, s, ship };
}

function npcAt(game: Game, role: 'pirate' | 'merchant' | 'patrol' | 'ghost', x: number, y: number, level = 3, cls?: ShipClassId): ShipEntity {
  const npc = game.spawnNpcShip(role, cls ?? hullsFor(role, level)[0], role === 'pirate' ? 'confederacy' : role === 'ghost' ? 'choir' : 'league', x, y, 0);
  game.setNpcLevel(npc, level);
  npc.region = regionAt(game.world, x, y);
  const b = game.npcs.get(npc.id)!;
  b.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  game.grid.upsert(npc.id, x, y);
  return npc;
}

function sea(region: 'safe' | 'contested') {
  const { game } = makeGame();
  game.directorOn = false;
  const c0 = region === 'safe' ? REGIONS.black_coast.center : REGIONS.gravewater.center;
  const at = water(game, c0[0], c0[1]);
  return { game, at };
}

const steps = (game: Game, sec: number) => {
  for (let i = 0; i < sec * 20; i++) game.step();
};

// ------------------------------------------------------------------ the price

test('the price: by her ⚓, the minutes and her hull; 20 minutes of an even warship = half an hour at sea, never cheap', () => {
  for (let v = 1; v <= 10; v++) {
    const [p10, p15, p20] = HIRE_MINUTES.map((m) => hirePrice(v, m, 1));
    assert.ok(p10 < p15 && p15 < p20, `⚓${v}: longer costs more`);
    // (owner: «дешевым эту услугу не делай» — 20 min ≈ 20–30 min of her waters' income, 10 min well over 10)
    assert.ok(priceMinutes(v, p20) >= 25 && priceMinutes(v, p20) <= 32, `⚓${v} 20 min = ${priceMinutes(v, p20)} min at sea`);
    assert.ok(priceMinutes(v, p10) >= 15, `⚓${v} 10 min = ${priceMinutes(v, p10)} min at sea`);
    if (v > 1) assert.ok(p20 > hirePrice(v - 1, 20, 1), 'a higher ⚓ costs more');
  }
  // her hull: a frigate at ⚓6 above a schooner at ⚓6; a battered ship cheaper, but never below 60 %
  assert.ok(powerMul('frigate', 6) > powerMul('schooner', 6));
  assert.ok(hirePrice(6, 20, powerMul('frigate', 6)) > hirePrice(6, 20, powerMul('schooner', 6)));
  assert.ok(hirePrice(5, 20, 1, 0.2) === hirePrice(5, 20, 1, 0.6) && hirePrice(5, 20, 1, 0.6) < hirePrice(5, 20, 1, 1));
  assert.equal(hireSlots(7), 1);
  assert.equal(hireSlots(8), 2);
  assert.equal(HIRE_REACH, 450);
});

// ------------------------------------------------------------------ the rules

test('the hire rules: her own ⚓ only, peaceful, not in a fight, within the hail; the card says why', () => {
  const { game, at } = sea('contested');
  const { s, ship } = captain(game, 'Hirer', at);
  const band = shipBandOf(s.profile!.level);
  assert.equal(band, 3);
  const even = npcAt(game, 'merchant', at.x + 200, at.y, 3);
  const low = npcAt(game, 'merchant', at.x - 200, at.y, 2);
  const far = npcAt(game, 'merchant', at.x, at.y + 900, 3);
  const ghost = npcAt(game, 'ghost', at.x, at.y - 250, 3);
  assert.equal(hireWhy(game, s, even), null);
  assert.match(hireWhy(game, s, low)!, /own level \(⚓3\).*⚓2/);
  assert.equal(hireWhy(game, s, far), 'She is too far off to hail');
  assert.equal(hireWhy(game, s, ghost), 'She is not for hire');
  // a rover at her
  const rover = npcAt(game, 'pirate', at.x + 300, at.y + 100, 3);
  game.npcs.get(rover.id)!.target = ship.id;
  rover.attackers.set(ship.id, game.now);
  assert.equal(hireWhy(game, s, rover), 'She is hostile to you: no hire');
  // a merchant fired on by somebody else: no hiring another's prey
  even.attackers.set(rover.id, game.now);
  even.lastCombat = game.now;
  assert.equal(hireWhy(game, s, even), 'She is in a fight: no hire now');
  even.attackers.clear();
  even.lastCombat = -999;
  // the captain herself under fire, or in a battle
  ship.lastHitAt = game.now;
  assert.match(hireWhy(game, s, even)!, /Not under fire/);
  ship.lastHitAt = -999;
  ship.battleGraceUntil = game.now + 10;
  assert.equal(hireWhy(game, s, even), 'Finish your battle first.');
  ship.battleGraceUntil = 0;
  // the card
  const o: HireOffer = hireOffer(game, s, even);
  assert.equal(o.ok, true);
  assert.equal(o.shipLevel, 3);
  assert.equal(o.prices.length, 3);
  assert.ok(o.guns > 0 && o.crewMax > 0 && o.hullMax > 0);
  assert.equal(hireOffer(game, s, low).ok, false);
});

test('paid in silver, refused with nothing taken when short; she becomes her guard; one at a time below ⚓8', () => {
  const { game, at } = sea('contested');
  const { s, ship } = captain(game, 'Payer', at);
  const m = npcAt(game, 'merchant', at.x + 200, at.y, 3, 'schooner');
  const purse = m.purse;
  const price = hireOffer(game, s, m).prices[2];
  s.profile!.gold = price - 1;
  assert.match(hire(game, s, m.id, 20)!, /Not enough silver/);
  assert.equal(s.profile!.gold, price - 1, 'nothing taken');
  s.profile!.gold = price + 100;
  assert.equal(hire(game, s, m.id, 20), null);
  assert.equal(s.profile!.gold, 100);
  assert.equal(m.purse, purse, 'the ship\'s purse gets nothing');
  assert.equal(m.ownerId, ship.id);
  assert.equal(m.npcRole, 'escort');
  assert.equal(hiresOf(game, s.accountId).length, 1);
  const two = npcAt(game, 'merchant', at.x - 200, at.y, 3);
  assert.match(hireWhy(game, s, two)!, /A guard sails with you already/);
});

// ------------------------------------------------------------------ the behaviour

test('she keeps station off her beam as her captain sails, and answers a rover that fires on her captain', () => {
  const { game, at } = sea('contested');
  const { s, ship } = captain(game, 'Guarded', at);
  const m = npcAt(game, 'patrol', at.x + 200, at.y, 3);
  assert.equal(hire(game, s, m.id, 10), null);
  ship.input = { rudder: 0, sailTarget: 1 };
  steps(game, 40);
  const d = Math.hypot(m.state.x - ship.state.x, m.state.y - ship.state.y);
  assert.ok(d < 350, `she keeps up: ${d.toFixed(0)} m`);
  // a rover passing in contested water, not at her: the guard starts nothing
  ship.input = { rudder: 0, sailTarget: 0 };
  const rover = npcAt(game, 'pirate', ship.state.x + 260, ship.state.y + 60, 3);
  game.npcs.get(rover.id)!.target = null;
  if (!npcHostileTo(game, rover, ship)) assert.equal(npcHostileTo(game, m, rover), false, 'starts nothing');
  // ...the rover fires on her captain: her guard answers and her shot lands
  ship.attackers.set(rover.id, game.now);
  rover.attackers.set(ship.id, game.now - 200);
  assert.equal(npcHostileTo(game, m, rover), true);
  steps(game, 25);
  assert.ok((rover.attackers.get(m.id) ?? -999) > game.now - 30, 'the guard fired on the rover');
});

test('she engages her captain\'s own mark once the captain fires on it; never a captain in safe water', () => {
  const { game, at } = sea('contested');
  const { s, ship } = captain(game, 'Marker', at);
  const m = npcAt(game, 'merchant', at.x + 200, at.y, 3);
  hire(game, s, m.id, 10);
  const prey = npcAt(game, 'merchant', at.x + 380, at.y + 120, 2);
  assert.equal(npcHostileTo(game, m, prey), false);
  prey.attackers.set(ship.id, game.now);
  assert.equal(npcHostileTo(game, m, prey), true, 'her mark');
  // another captain in the Crown's safe water: never, whatever the quarrel
  const other = captain(game, 'Bystander', { x: at.x + 300, y: at.y - 200 });
  other.ship.attackers.set(ship.id, game.now);
  other.ship.region = 'black_coast';
  assert.equal(npcHostileTo(game, m, other.ship), false);
  assert.ok(damageBlocked(game, m, other.ship));
});

test('combat isolation: her captain grappled — the guard cannot touch the ship at her rails, nor be drawn in', () => {
  const { game, at } = sea('contested');
  const { s, ship } = captain(game, 'Boarder', at);
  const m = npcAt(game, 'patrol', at.x + 200, at.y, 3);
  hire(game, s, m.id, 10);
  const foe = npcAt(game, 'pirate', at.x + 14, at.y, 3);
  foe.state.heading = ship.state.heading;
  const err = startBoarding(game, ship, foe, 'standard');
  if (err === null || ship.grappled) {
    assert.ok(untouchable(game, ship), 'her captain is in battle');
    assert.ok(damageBlocked(game, m, foe), 'the ship at her rails is nobody\'s to touch');
    assert.ok(!m.boarding && !m.grappled, 'the guard is not in the battle');
  }
});

test('she does not follow into port: she lies off the harbour, the clock running', () => {
  const { game } = makeGame();
  game.directorOn = false;
  const port = game.world.ports.find((p) => {
    for (let a = 0; a < 16; a++) {
      const x = p.x + Math.cos(a * 0.39) * 300, y = p.y + Math.sin(a * 0.39) * 300;
      if (!isLand(game.world, x, y)) return true;
    }
    return false;
  })!;
  let spot = { x: 0, y: 0 };
  for (let a = 0; a < 16; a++) {
    const x = port.x + Math.cos(a * 0.39) * 300, y = port.y + Math.sin(a * 0.39) * 300;
    if (!isLand(game.world, x, y)) {
      spot = { x, y };
      break;
    }
  }
  const { s, ship } = captain(game, 'Ashore', spot);
  const m = npcAt(game, 'merchant', spot.x, spot.y, 3);
  s.profile!.level = CAPTAIN_LEVEL_FOR_SHIP[3];
  assert.equal(hire(game, s, m.id, 10), null);
  const until = hiresOf(game, s.accountId)[0].until;
  ship.docked = port.id;
  Object.assign(ship.state, { x: port.x, y: port.y });
  steps(game, 30);
  assert.equal(m.docked, null);
  const d = Math.hypot(m.state.x - port.x, m.state.y - port.y);
  assert.ok(d >= 300, `she stays out of the harbour: ${d.toFixed(0)} m off`);
  assert.ok(d <= HIRE_WAIT_R + 200, `...and near it: ${d.toFixed(0)} m`);
  assert.equal(hiresOf(game, s.accountId)[0].until, until, 'the clock is not stopped');
  assert.ok(game.now < until);
});

test('the time out: she says goodbye and is her own again; dismissed early: nothing back, no rehire loop', () => {
  const { game, at } = sea('contested');
  const { c, s, ship } = captain(game, 'Timer', at);
  const m = npcAt(game, 'merchant', at.x + 200, at.y, 3);
  hire(game, s, m.id, 10);
  hiresOf(game, s.accountId)[0].until = game.now + 0.5;
  c.inbox.length = 0;
  steps(game, 2);
  assert.equal(hiresOf(game, s.accountId).length, 0);
  assert.equal(m.ownerId, null);
  assert.equal(m.npcRole, 'merchant');
  assert.equal(game.npcs.get(m.id)!.role, 'merchant');
  assert.ok(c.all('toast').some((t) => /Our contract is done/.test(t.msg)), 'the goodbye');
  // the same ship again at once: she keeps her own course a while
  m.state.x = ship.state.x + 200;
  m.state.y = ship.state.y;
  assert.match(hireWhy(game, s, m)!, /keeps her own course/);
  // dismissed: no refund
  const n = npcAt(game, 'merchant', at.x - 200, at.y, 3);
  hire(game, s, n.id, 20);
  const gold = s.profile!.gold;
  assert.equal(dismiss(game, s, n.id), null);
  assert.equal(s.profile!.gold, gold, 'nothing back');
  assert.equal(n.ownerId, null);
  assert.ok((game.now + REHIRE_SEC - 1) > game.now);
  assert.match(hireWhy(game, s, n)!, /keeps her own course/);
});

test('sunk: the contract over, nothing back; her kill alone is a group mate\'s share, not the prize', () => {
  const { game, at } = sea('contested');
  const { c, s, ship } = captain(game, 'Loser', at);
  const m = npcAt(game, 'patrol', at.x + 200, at.y, 3);
  hire(game, s, m.id, 20);
  const gold = s.profile!.gold;
  const rover = npcAt(game, 'pirate', at.x + 400, at.y, 3);
  c.inbox.length = 0;
  applyDamage(game, m, { hull: m.stats.hullMax * 5 }, rover);
  steps(game, 1);
  assert.equal(hiresOf(game, s.accountId).length, 0);
  assert.equal(s.profile!.gold, gold, 'nothing back');
  assert.ok(c.all('toast').some((t) => /is sunk: the contract is over/.test(t.msg)));
  // her guard sinks a rover alone: no kill of hers (no «sunk» on her tally), a mate's experience
  const g = npcAt(game, 'patrol', at.x - 200, at.y, 3);
  game.npcs.get(g.id)!.target = null;
  s.profile!.gold = 50000;
  hire(game, s, g.id, 10);
  const r2 = npcAt(game, 'pirate', at.x - 400, at.y, 3);
  const sunk = s.profile!.stats.sunk, xp = s.profile!.xp;
  applyDamage(game, r2, { hull: r2.stats.hullMax * 5 }, g);
  steps(game, 1);
  assert.equal(s.profile!.stats.sunk, sunk, 'not her kill');
  assert.ok(s.profile!.xp > xp || s.profile!.level > CAPTAIN_LEVEL_FOR_SHIP[3], 'a mate\'s share of the lesson');
});

test('RU and EN: the card\'s words and the server\'s sentences', () => {
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  for (const k of Object.keys(RU) as (keyof typeof RU)[]) assert.ok(!/[A-Za-z]{3,}/.test(RU[k].replace(/\{\w+\}/g, '')), `RU ${k}: ${RU[k]}`);
  for (const en of ['She is not for hire', 'She is too far off to hail', 'She is hostile to you: no hire', 'She is in a fight: no hire now', 'Only a ship of your own level (⚓3) will sign on: she is ⚓2', 'Not enough silver: 900 asked, you have 12',
    'Brig Wren signs on as your guard for 20 minutes (2740 silver).', 'Brig Wren: «Our contract is done, captain. Fair winds!» She returns to her course.', 'Your guard Brig Wren is under fire!', 'Your guard Brig Wren is sunk: the contract is over, nothing is refunded.', 'Brig Wren is dismissed and returns to her course. Nothing is refunded.']) {
    const ru = serverText(en);
    assert.notEqual(ru, en, en);
    assert.ok(/[а-яё]/i.test(ru), ru);
  }
});

test('a guard, not a hunter: she lets a foe go far from her captain; her captain\'s own shot at her is friendly, silent', () => {
  const { game, at } = sea('contested');
  const { s, ship } = captain(game, 'Leash', at);
  const m = npcAt(game, 'patrol', at.x + 200, at.y, 3);
  hire(game, s, m.id, 10);
  const far = npcAt(game, 'pirate', at.x + 900, at.y, 3);
  ship.attackers.set(far.id, game.now);
  assert.equal(npcHostileTo(game, m, far), false, 'beyond the leash');
  far.state.x = at.x + 400;
  game.grid.upsert(far.id, far.state.x, far.state.y);
  assert.equal(npcHostileTo(game, m, far), true, 'within it');
  ship.region = 'black_coast';
  m.region = 'black_coast';
  assert.equal(damageBlocked(game, ship, m), 'friendly');
  assert.equal(damageBlocked(game, m, ship), 'friendly');
});

// ------------------------------------------------------------------ a restart, a relog

test('a server restart: the contract sails again with her, the time left kept; in port she waits off the harbour', async () => {
  const { Game } = await import('../server/src/game/Game.ts');
  const { AuthService } = await import('../server/src/auth.ts');
  const { PROTOCOL_VERSION } = await import('../shared/src/constants.ts');
  const { FakeConn } = await import('./helpers.ts');
  const { game, db } = makeGame();
  const at = water(game, REGIONS.gravewater.center[0], REGIONS.gravewater.center[1]);
  const { s, ship } = captain(game, 'Restarted', at);
  const m = npcAt(game, 'patrol', at.x + 200, at.y, 3);
  assert.equal(hire(game, s, m.id, 20), null);
  const gold = s.profile!.gold;
  steps(game, 30);
  game.saveSession(s);
  const left0 = s.profile!.seaHire![0].left;
  assert.ok(left0 > 20 * 60 - 40 && left0 <= 20 * 60 - 29, `kept: ${left0} s left`);
  // the deploy: a new server on the same database, the captain back with her token
  const g2 = new Game({ db, auth: new AuthService(db), log: () => {} });
  g2.directorOn = false;
  const c2 = new FakeConn();
  const s2 = g2.attach(c2 as never);
  c2.push({ t: 'hello', v: PROTOCOL_VERSION, token: s.token });
  assert.ok(s2.ship, 'her ship');
  const h = hiresOf(g2, s2.accountId);
  assert.equal(h.length, 1, 'her guard again');
  const e = g2.ships.get(h[0].shipId)!;
  assert.equal(e.name, m.name);
  assert.equal(e.shipLevel, 3);
  assert.equal(e.ownerId, s2.ship!.id);
  assert.ok(Math.abs(h[0].until - g2.now - left0) <= 1, 'the time left');
  assert.equal(s2.profile!.gold, gold, 'nothing charged again');
  assert.ok(Math.hypot(e.state.x - s2.ship!.state.x, e.state.y - s2.ship!.state.y) < 400, 'beside her');
  // ...and a captain saved in port: off the harbour
  const port = g2.world.ports[0];
  s2.profile!.seaHire = [{ ...s2.profile!.seaHire![0], left: 300 }];
  for (const x of [...hiresOf(g2, s2.accountId)]) g2.removeShip(x.shipId);
  resetHires(g2);
  s2.ship!.docked = port.id;
  Object.assign(s2.ship!.state, { x: port.x, y: port.y });
  restoreHires(g2, s2);
  const w = hiresOf(g2, s2.accountId);
  if (w.length) {
    const e2 = g2.ships.get(w[0].shipId)!;
    assert.ok(Math.hypot(e2.state.x - port.x, e2.state.y - port.y) >= HIRE_WAIT_R - 5, 'off the harbour');
  } else assert.ok(s2.profile!.gold > gold, 'or the unused share back');
});

test('a relog: the guard goes back to her course while she is away, and sails again when she is back; no room: refund pro rata', async () => {
  const { PROTOCOL_VERSION } = await import('../shared/src/constants.ts');
  const { FakeConn } = await import('./helpers.ts');
  const { game } = makeGame();
  const at = water(game, REGIONS.gravewater.center[0], REGIONS.gravewater.center[1]);
  const { c, s } = captain(game, 'Relogged', at);
  const m = npcAt(game, 'merchant', at.x + 200, at.y, 3);
  hire(game, s, m.id, 10);
  c.close();
  steps(game, 35); // the linger, then she is gone
  assert.equal(hiresOf(game, s.accountId).length, 0);
  assert.equal(m.ownerId, null, 'her own course again');
  const kept = s.profile!.seaHire!;
  assert.equal(kept.length, 1);
  assert.ok(kept[0].left > 500 && kept[0].left < 600, `${kept[0].left} s left`);
  // back: a new connection with her token
  const c2 = new FakeConn();
  game.attach(c2 as never);
  c2.push({ t: 'hello', v: PROTOCOL_VERSION, token: s.token });
  const s2 = game.sessionByAccount(s.accountId)!;
  assert.ok(s2.ship, 'her ship');
  if (s2.ship!.docked) {
    // (the linger brought her home? she is restored off the harbour or refunded)
    assert.ok(hiresOf(game, s.accountId).length === 1 || s2.profile!.gold > 0);
  } else assert.equal(hiresOf(game, s.accountId).length, 1, 'her guard again');
  // no water for her: the unused share back
  for (const x of [...hiresOf(game, s.accountId)]) game.removeShip(x.shipId);
  resetHires(game);
  s2.profile!.seaHire = [{ classId: 'sloop', level: 3, role: 'merchant', faction: 'league', name: 'Gull', captain: '', minutes: 10, paid: 1200, left: 300 }];
  let land = { x: 0, y: 0 };
  for (let x = 3000; x < 90000 && !land.x; x += 250) for (let y = 3000; y < 90000; y += 250) {
    if ([0, 400, -400].every((dx) => [0, 400, -400].every((dy) => isLand(game.world, x + dx, y + dy)))) {
      land = { x, y };
      break;
    }
  }
  Object.assign(s2.ship!.state, { x: land.x, y: land.y });
  s2.ship!.docked = null;
  const gold = s2.profile!.gold;
  restoreHires(game, s2);
  assert.equal(hiresOf(game, s.accountId).length, 0);
  assert.equal(s2.profile!.gold - gold, hireRefund({ paid: 1200, minutes: 10, left: 300 }));
  assert.equal(hireRefund({ paid: 1200, minutes: 10, left: 300 }), 600, 'half the time, half the price');
});
