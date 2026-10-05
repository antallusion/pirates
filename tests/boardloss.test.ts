// A boarding lost (owner, 2026-10-05: «бесконечный абордаж при проигрыше. при проигрыше надо в ближайший порт
// отправлять и забирать ценности»): whether she boarded and was thrown back or was boarded and taken, the victors
// have her hold and a share of her chest, she is let go into the nearest port that will have her (the screen of a
// ship lost, its boarded card), the battle is over for good, and no grapples bite her again for a while.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec } from '../shared/src/math.ts';
import { canBoard, startBoarding } from '../server/src/game/boarding.ts';
import { BOARD_LOSS_PURSE, BOARD_LOSS_SHIELD } from '../server/src/game/Game.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame } from './helpers.ts';

function setUp(name: string): { game: Game; c: FakeConn; ship: ShipEntity; foe: ShipEntity; gold: number } {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const c = join(game, name, 'corsair');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  s.profile!.level = 60;
  s.profile!.gold = 5000;
  ship.cargo = { rum: 10, sugar: 6 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  // A frigate of pirates, many times her men.
  const v = headingVec(ship.state.heading + Math.PI / 2);
  const foe = game.spawnNpcShip('pirate', 'frigate', 'free', ship.state.x + v.x * 30, ship.state.y + v.y * 30, ship.state.heading);
  game.setNpcLevel(foe, ship.shipLevel);
  game.npcs.get(foe.id)!.active = true;
  foe.input = { rudder: 0, sailTarget: 0 };
  foe.state.speed = 0;
  game.grid.upsert(foe.id, foe.state.x, foe.state.y);
  return { game, c, ship, foe, gold: s.profile!.gold };
}

/** Quick combat to the end, then the moment the end is held, then a minute more of the sea. */
function fightOut(game: Game, c: FakeConn, ship: ShipEntity): number {
  let grapples = 0, was = false;
  for (let i = 0; i < 20 * 120; i++) {
    if (ship.boarding?.fight.tac && !ship.boarding.fight.tac.over) c.push({ t: 'tac', act: { a: 'quick' } });
    game.step();
    if (ship.boarding && !was) grapples++;
    was = !!ship.boarding;
  }
  return grapples;
}

function lost(game: Game, c: FakeConn, ship: ShipEntity, foe: ShipEntity, gold: number, foeCargo0: number): void {
  const p = game.sessionOf(ship)!.profile!;
  assert.equal(ship.boarding, null, 'the boarding is over');
  assert.equal(c.last('board_tac')?.view, null, 'the battle screen closed');
  assert.ok(ship.docked, 'she is in port');
  const port = game.portById(ship.docked!)!;
  const nearest = game.nearestPort(30000, 80000)!;
  assert.ok(Math.hypot(port.x - 30000, port.y - 80000) <= Math.hypot(nearest.x - 30000, nearest.y - 80000) + 3000, 'the nearest port (that will have her)');
  assert.deepEqual(ship.cargo, {}, 'her hold is theirs');
  assert.ok((foe.cargo.rum ?? 0) + (foe.cargo.sugar ?? 0) > foeCargo0, 'in their hold');
  assert.ok(p.gold < gold && p.gold >= gold - Math.ceil(gold * BOARD_LOSS_PURSE) - 1, `a share of her chest (${gold} → ${p.gold})`);
  const card = c.last('sunk_self');
  assert.ok(card?.boarded, 'the card of a ship lost, its boarded side');
  assert.equal(card.respawnPort, ship.docked);
  assert.ok(card.boarded.silver > 0 && card.lost.cargoValue > 0);
  assert.ok(ship.crew >= 1 && !ship.surrendered && ship.lootLockedFor === null);
  assert.ok(ship.boardShieldUntil > game.now && ship.boardShieldUntil - game.now <= BOARD_LOSS_SHIELD, 'a respite from the grapples');
}

test('boarding a much stronger ship and thrown back: in port, robbed, over, and not grappled again', () => {
  const { game, c, ship, foe, gold } = setUp('Thrown');
  const r0 = (foe.cargo.rum ?? 0) + (foe.cargo.sugar ?? 0);
  startBoarding(game, ship, foe, 'standard');
  assert.ok(ship.boarding?.fight.tac, 'the battle is laid out');
  const grapples = fightOut(game, c, ship);
  assert.equal(grapples, 1, 'one boarding, not a loop');
  lost(game, c, ship, foe, gold, r0);
  assert.equal(c.last('sunk_self')!.boarded!.repelled, true, 'the card of boarders thrown back');
  // Brought out of port beside them again within the respite: no grapples.
  c.push({ t: 'undock' });
  ship.state.x = foe.state.x + 20;
  ship.state.y = foe.state.y;
  ship.state.speed = foe.state.speed = 0;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.match(canBoard(game, foe, ship) ?? '', /boarded only now/, 'she is let be');
  for (let i = 0; i < 20 * 60; i++) game.step();
  assert.equal(ship.boarding, null, 'a minute alongside them: no new boarding');
});

test('boarded by a much stronger ship and taken: in port, robbed, over, and not grappled again', () => {
  const { game, c, ship, foe, gold } = setUp('Taken');
  const r0 = (foe.cargo.rum ?? 0) + (foe.cargo.sugar ?? 0);
  startBoarding(game, foe, ship, 'standard');
  assert.ok(ship.boarding?.fight.tac && !ship.boarding.attacker, 'she defends');
  const grapples = fightOut(game, c, ship);
  assert.equal(grapples, 1, 'one boarding, not a loop');
  lost(game, c, ship, foe, gold, r0);
  assert.ok(foe.purse > 0, 'her silver in their purse');
  assert.equal(c.last('sunk_self')!.boarded!.repelled, undefined, 'the card of a ship taken');
  c.push({ t: 'undock' });
  ship.state.x = foe.state.x + 20;
  ship.state.y = foe.state.y;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.ok(canBoard(game, foe, ship), 'no grapples within the respite');
  // When it is over she can be boarded again — and boarding another ends it at once.
  ship.boardShieldUntil = game.now - 1;
  assert.equal(canBoard(game, foe, ship), null);
});
