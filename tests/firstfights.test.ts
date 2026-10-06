// A new captain's first three fights (docs/23 item 81): short and winnable. «Атаковать» on one of the sea's ships of
// her level softens her — half her hull, a little over half her men, and what she fires hurts less — and the fight is
// one of the three when she is gone. The fourth is as the sea is; «I know the sea» never had them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { canBoard, startBoarding } from '../server/src/game/boarding.ts';
import { boardOdds } from '../server/src/game/boardodds.ts';
import { easyLeft, FOE_IDLE, SOFT_DEALT, SOFT_HULL, softDealt } from '../server/src/game/firstfights.ts';
import { npcSkill } from '../shared/src/data/shiplevel.ts';
import { engage } from '../server/src/game/npc.ts';
import { startPursuit } from '../server/src/game/pursuit.ts';
import { tacAction } from '../server/src/game/tactical.ts';
import { duelSea, openWater, putSide } from './balance/duel.ts';
import { LEVEL_HULL, seaCaptain } from './balance/seafight.ts';
import { steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

test('the first three fights of a new captain are short and won; the fourth is not softened', () => {
  const game = duelSea();
  game.tacticalBoarding = true;
  const L = 3;
  const at0 = openWater(game, 40);
  const s = seaCaptain(game, LEVEL_HULL[L], L, at0.x, at0.y, 0);
  const me = s.ship!;
  const army: ArmyStack[] = me.army.map((x) => ({ ...x }));
  s.profile!.tutorial.easy = 0; // a captain who took the First Watch
  const rows: string[] = [];
  for (let k = 0; k < 4; k++) {
    // Her ship whole again and somewhere new; a ship of her level 700 m off, both under way.
    const at = openWater(game, 41 + k);
    me.setArmy(army);
    me.hull = me.stats.hullMax;
    me.morale = 80;
    me.state = { ...me.state, x: at.x, y: at.y, heading: 0, speed: me.stats.maxSpeed * 0.7 };
    game.grid.upsert(me.id, at.x, at.y);
    const B = putSide(game, { cls: LEVEL_HULL[L], level: L, craft: 'bot' }, at.x + 700, at.y, Math.PI);
    B.brain.role = 'hunter';
    const foe = B.ship;
    const men0 = foe.crew;
    const left = easyLeft(s);
    const t0 = game.now;
    assert.equal(startPursuit(game, s, foe.id, 'board'), null);
    const soft = foe.softFor === me.id;
    assert.equal(soft, k < 3, `fight ${k + 1}: softened ${soft}`);
    if (soft) {
      assert.ok(foe.hull <= foe.stats.hullMax * SOFT_HULL + 1e-6, 'half her hull');
      assert.ok(foe.crew < men0 * 0.7, `her men thinned (${men0} → ${foe.crew})`);
      assert.equal(softDealt(game, foe, me), SOFT_DEALT, 'what she fires hurts less');
    }
    // «Атаковать»: the helmsman runs alongside.
    let next = 0;
    while (game.now - t0 < 30 && canBoard(game, me, foe) !== null && foe.alive) {
      if (game.now >= next) {
        next = game.now + npcSkill(L).react;
        engage(game, foe, B.brain, me, Math.hypot(me.state.x - foe.state.x, me.state.y - foe.state.y));
      }
      game.step();
    }
    const run = Math.round((game.now - t0) * 10) / 10;
    const odds = Math.round(boardOdds(game, me, foe).chance * 100);
    if (soft) assert.ok(odds >= 90, `fight ${k + 1}: the boarding won ${odds}% of the time`);
    if (!soft) {
      rows.push(`fight ${k + 1}: not softened (as the sea is), alongside in ${run} s, boarding won ${odds}%`);
      game.removeShip(foe.id);
      break;
    }
    if (foe.alive) {
      assert.equal(canBoard(game, me, foe), null, `fight ${k + 1}: alongside in ${run} s`);
      startBoarding(game, me, foe, 'standard');
      assert.ok(me.boarding?.fight.tac, 'the hex battle');
      assert.equal(tacAction(game, me, { a: 'quick' }), null);
      for (let i = 0; i < 20 * 20 && me.boarding; i++) game.step();
      // The spoils: she is sunk once the hold is emptied (the prize's screen).
      if (s.pendingBoarding) (s.conn as unknown as FakeConn).push({ t: 'loot_take', take: {}, fate: 'sink' });
    }
    assert.ok(!me.boarding && me.alive, `fight ${k + 1}: over, and she afloat`);
    assert.ok(!foe.alive || foe.prize || foe.surrendered || !game.ships.has(foe.id), `fight ${k + 1}: won`);
    const sec = Math.round((game.now - t0) * 10) / 10;
    assert.ok(sec <= 30, `fight ${k + 1}: ${sec} s`);
    steps(game, 21);
    assert.equal(easyLeft(s), left - 1, 'one of the three behind her');
    rows.push(`fight ${k + 1}: alongside ${run} s, won in ${sec} s (boarding won ${odds}%)`);
    if (game.ships.has(foe.id)) game.removeShip(foe.id);
  }
  assert.equal(easyLeft(s), 0);
  console.log(rows.join('\n'));
});

test('«I know the sea»: an old hand’s fights are as the sea is', () => {
  const game = duelSea();
  const at = openWater(game, 50);
  const s = seaCaptain(game, LEVEL_HULL[3], 3, at.x, at.y, 0);
  assert.equal(easyLeft(s), 0);
  const B = putSide(game, { cls: LEVEL_HULL[3], level: 3, craft: 'bot' }, at.x + 700, at.y, Math.PI);
  const hull = B.ship.hull;
  assert.equal(startPursuit(game, s, B.ship.id, 'board'), null);
  assert.equal(B.ship.softFor, undefined);
  assert.equal(B.ship.hull, hull);
});

test('a fresh captain idle at sea with nothing to fight: within half a minute a pirate of her level comes for her', () => {
  const game = duelSea();
  const at = openWater(game, 60);
  const s = seaCaptain(game, LEVEL_HULL[1], 1, at.x, at.y, 0);
  s.profile!.tutorial.easy = 0;
  s.profile!.tutorial.on = false;
  const me = s.ship!;
  me.input = { rudder: 0, sailTarget: 0.5 };
  const before = new Set(game.ships.keys());
  steps(game, 20 * (FOE_IDLE + 3));
  const brought = (who: number) => [...game.ships.values()].filter((x) => !before.has(x.id) && x.npcRole === 'pirate' && game.npcs.get(x.id)?.chase?.id === who);
  const come = brought(me.id);
  assert.equal(come.length, 1, 'one pirate');
  const d = Math.hypot(come[0].state.x - me.state.x, come[0].state.y - me.state.y);
  assert.ok(d < 1600, `near enough for «Атаковать» (${Math.round(d)} m)`);
  assert.equal(come[0].loadout.classId, me.loadout.classId, 'her own hull');
  // While she is about, no second one.
  steps(game, 20 * (FOE_IDLE + 3));
  assert.equal(brought(me.id).length, 1);
  // An old hand is never brought one.
  const s2 = seaCaptain(game, LEVEL_HULL[1], 1, at.x + 8000, at.y, 0);
  const b2 = new Set(game.ships.keys());
  steps(game, 20 * (FOE_IDLE + 3));
  assert.ok(![...game.ships.values()].some((x) => !b2.has(x.id) && game.npcs.get(x.id)?.chase?.id === s2.ship!.id));
});
