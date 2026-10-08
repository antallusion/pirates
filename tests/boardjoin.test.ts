// The beaten who come over after a boarding won (owner, 2026-10-08: «при успешном абордаже я должен забирать часть
// команды убитого корабля к себе, небольшую, чтобы поддерживать состав как-то и чтобы не посещать острова»): a small
// share of the men she beat, by her Leadership, as the men they were (a faction's as the pirate kind they stood for)
// where her army has room, deckhands otherwise, never past her hammocks; shown on the battle's end and the plunder card;
// the survivors among them come off her prize, so the prisoners she is offered after are not the same men twice; none
// to a cruel officer's ship, one that gives no quarter, nor from a guard of the map, a beast or the Dutchman's dead.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec } from '../shared/src/math.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { JOIN_LOYALTY, joinAs, joinCount, joinKinds, joinShare, joinsFrom, maxRecruits } from '../server/src/game/crew.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

test('a small share of the beaten: 13% with no Leadership, two hundredths more a rank (10–20% to an expert); never past her hammocks', () => {
  assert.ok(joinShare(0) >= 0.1 && joinShare(0) <= 0.15);
  assert.ok(joinShare(3) > joinShare(1) && joinShare(3) <= 0.2);
  assert.equal(joinCount(100, 0, 999), Math.round(100 * joinShare(0)));
  assert.equal(joinCount(100, 0, 4), 4, 'her free hammocks bound it');
  assert.equal(joinCount(100, 2, 0), 0, 'a full ship takes none');
  assert.equal(joinCount(0, 3, 50), 0);
});

test('as the men they were: a faction\'s man as the pirate kind he stood for; no creature, great one or the shop\'s; the deep\'s dead only to a crew that keeps them', () => {
  assert.equal(joinAs('marine', false), 'marine');
  assert.equal(joinAs('crown_marine', false), 'marine');
  assert.equal(joinAs('crown_line', false), 'musketeer');
  assert.equal(joinAs('drowned', false), null);
  assert.equal(joinAs('drowned', true), 'drowned');
  assert.equal(joinAs('crown_diver', false), null, 'the Crown\'s divers stand for the drowned');
  assert.equal(joinAs('crab', true), null, 'a creature follows by its own offer (tame.ts)');
  const beaten: ArmyStack[] = [{ u: 'deckhand', n: 60 }, { u: 'crown_marine', n: 25 }, { u: 'drowned', n: 15 }];
  const k = joinKinds(beaten, 12, false);
  assert.equal(k.reduce((a, x) => a + x.n, 0), 12);
  assert.deepEqual(k.map((x) => x.u).sort(), ['deckhand', 'marine']);
  assert.ok(k.find((x) => x.u === 'deckhand')!.n > k.find((x) => x.u === 'marine')!.n, 'by their numbers');
});

function atSea(game: Game, name: string): { c: FakeConn; ship: ShipEntity } {
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
  ship.loadout.classId = 'brig';
  ship.recompute(game.now);
  ship.crew = ship.stats.crewMax;
  ship.morale = 80;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, ship };
}

function foeAlongside(game: Game, ship: ShipEntity, crew: number, role: 'pirate' | 'merchant' = 'merchant', cls: 'brig' | 'fluyt' = 'fluyt'): ShipEntity {
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const npc = game.spawnNpcShip(role, cls, 'free', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  npc.hull = npc.stats.hullMax * 0.4;
  npc.crew = crew;
  npc.morale = 80;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

/** A boarding fought out by quick combat; her crew before it as she wishes it (her free hammocks). */
function boardAndWin(game: Game, name: string, room: number, foeCrew = 80) {
  game.tacticalBoarding = true;
  const { c, ship } = atSea(game, name);
  ship.crew = ship.stats.crewMax - room;
  const npc = foeAlongside(game, ship, foeCrew);
  const s = [...game.sessions].find((x) => x.name === name)!;
  const loyal0 = s.profile!.company.loyalty;
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  const bt = ship.boarding!.fight.tac!;
  const fight = ship.boarding!.fight;
  const crew0 = ship.crew;
  c.push({ t: 'tac', act: { a: 'quick' } });
  return { c, ship, npc, bt, fight, crew0, s, loyal0 };
}

test('a boarding won: a share of the beaten come over to her army, shown on the battle\'s end and the plunder card; the survivors among them come off her prize', () => {
  const { game } = makeGame();
  const { c, ship, npc, bt, fight, crew0, s, loyal0 } = boardAndWin(game, 'Turncoat', 60);
  assert.equal(bt.over?.winner, 0, 'she takes the merchant');
  const came = fight.tacJoined?.[0] ?? [];
  const n = came.reduce((a, x) => a + x.n, 0);
  const beaten = bt.stacks.filter((x) => x.side === 1).reduce((a, x) => a + x.start, 0);
  assert.ok(n > 0, 'some come over');
  assert.ok(n <= Math.round(beaten * joinShare(0)), `a small share: ${n} of ${beaten}`);
  const fell = Math.min(bt.dead[0], crew0 - Math.max(2, Math.round(crew0 * 0.1)));
  assert.equal(ship.crew, crew0 - fell + n, 'into her army');
  assert.ok(ship.crew <= ship.stats.crewMax);
  assert.ok(s.profile!.company.loyalty <= Math.max(loyal0, JOIN_LOYALTY) + 1e-9, 'turncoats\' heart');
  // The battle's end tells it.
  const v = c.last('board_tac')!.view!;
  assert.deepEqual(v.result?.joined, came, '«К вам примкнули» on the battle\'s end');
  // The survivors' part of them came off her books: the prisoners offered are what is left.
  const survivors = Math.max(2, Math.round(80 * 0.1));
  assert.ok(npc.crew < survivors || npc.crew <= survivors, 'the struck who came over are not on her books');
  steps(game, 200);
  const r = c.last('boarding')?.result;
  assert.ok(r, 'the plunder card');
  assert.deepEqual(r.joined, came, 'and the plunder card');
  assert.equal(r.recruits, maxRecruits(ship, npc, s.profile!.company), 'the prisoners from what is left');
});

test('never past her hammocks; none to a cruel officer\'s ship or one that gives no quarter; none from a guard of the map, a beast or the Dutchman\'s dead', () => {
  {
    const { game } = makeGame();
    const { ship, fight } = boardAndWin(game, 'Fullhouse', 0);
    assert.equal(fight.tac!.over?.winner, 0);
    const n = (fight.tacJoined?.[0] ?? []).reduce((a, x) => a + x.n, 0);
    assert.ok(ship.crew <= ship.stats.crewMax && n <= ship.stats.crewMax - (ship.crew - n), 'only to the hammocks her losses freed');
  }
  {
    const { game } = makeGame();
    game.tacticalBoarding = true;
    const { c, ship } = atSea(game, 'Cruel');
    const s = [...game.sessions].find((x) => x.name === 'Cruel')!;
    s.profile!.company.officers.push({ id: 'o-cruel', name: 'Black Ned', role: 'boatswain', level: 3, xp: 0, traits: ['cruel'], loyalty: 60, wound: null, hiredAt: 0, orderReady: 0 } as never);
    ship.crew = ship.stats.crewMax - 40;
    const npc = foeAlongside(game, ship, 80);
    c.push({ t: 'board', target: npc.id, aggression: 'standard' });
    const fight = ship.boarding!.fight;
    c.push({ t: 'tac', act: { a: 'quick' } });
    assert.equal(fight.tac!.over?.winner, 0);
    assert.equal(fight.tacJoined, undefined, 'a cruel officer: no turncoats');
  }
  {
    const { game } = makeGame();
    const npc = game.spawnNpcShip('merchant', 'fluyt', 'free', 30000, 80000, 0);
    assert.equal(joinsFrom(npc), true);
    npc.npcRole = 'ghost';
    assert.equal(joinsFrom(npc), false, 'the Dutchman\'s dead');
    npc.npcRole = 'beast';
    assert.equal(joinsFrom(npc), false, 'a beast');
    npc.npcRole = 'merchant';
    npc.guardOf = 'g1';
    assert.equal(joinsFrom(npc), false, 'a guard of the map has its own offer');
  }
});
