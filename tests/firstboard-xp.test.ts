// The owner's case (2026-10-17): «я тут сплавал, взял на абордаж корабль 1 и получил сразу 2 уровня — это че ваще».
// A fresh captain of the first level boards one ship of ⚓1 and takes her: before docs/26 §11 that one fight paid the
// prize (2 units), the prize scuttled once more as «Sank» (1 unit, a second prize), the deed of the first prize (4 units:
// two thirds of the first level, and a talent point beside the level's), the captain's goal «take a prize» (1.5) and the
// battle's lesson — ~460 XP of a 300 XP level, more than two levels with the shop's elixir and the subscription. Now one
// boarding is a fraction of the level, whatever she has bought; the First Watch's own boarding brings no level either.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION, xpForLevel } from '../shared/src/constants.ts';
import { DEED_LEVEL_SHARE, deedXp, lumpXp, XP_UNITS } from '../shared/src/data/xpcurve.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { startBoarding } from '../server/src/game/boarding.ts';
import { tacAction } from '../server/src/game/tactical.ts';
import { shopState } from '../server/src/game/shop.ts';
import { onboardingVolley } from '../server/src/game/onboarding.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { putSide } from './balance/duel.ts';
import { dayOf } from '../shared/src/data/dailies.ts';
import { FakeConn, giveScrolls, makeGame, steps } from './helpers.ts';

function fresh(tutorial: boolean, name: string): { game: Game; c: FakeConn; s: PlayerSession } {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  quietAdv(game, false);
  const c = new FakeConn();
  game.attach(c as unknown as WsConnection);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'First', tutorial });
  const s = game.sessionByName(name)!;
  // The day's orders are rolled by the real UTC day (dailies.ts): on 2026-10-23 one was «take 3 prizes», +150 XP on the
  // third boarding. This file weighs the boardings and the first quests, not the day's dice: no orders today.
  if (s.profile!.daily) Object.assign(s.profile!.daily, { day: dayOf(game.wallNow()), orders: [] });
  return { game, c, s };
}

/** Her experience from the first level on, in levels (1.4 = the second level and two fifths of it). */
const levels = (s: PlayerSession): number => s.profile!.level + s.profile!.xp / xpForLevel(s.profile!.level);

/** One boarding of the ship alongside: the hex battle by the quick fight, the prize's hold taken and she scuttled. */
function boardAndScuttle(game: Game, c: FakeConn, s: PlayerSession, foe: Parameters<typeof startBoarding>[1]): void {
  const me = s.ship!;
  me.state.speed = 0;
  startBoarding(game, me, foe, 'standard');
  assert.ok(me.boarding?.fight.tac, 'the hex battle');
  giveScrolls(game);
  assert.equal(tacAction(game, me, { a: 'quick' }), null);
  for (let i = 0; i < 20 * 30 && me.boarding; i++) game.step();
  assert.ok(!me.boarding, 'the battle over');
  if (s.pendingBoarding) c.push({ t: 'loot_take', take: {}, fate: 'sink' });
  steps(game, 60); // the scuttled prize goes down; the captain's goals are looked at once a second
}

for (const bought of [false, true]) {
  test(`the owner's case: a level-1 captain boards one ⚓1 ship — a fraction of a level, never a level-up${bought ? ' (with the elixir and the subscription)' : ''}`, () => {
    const { game, c, s } = fresh(false, bought ? 'Rich Rookie' : 'Plain Rookie');
    const p = s.profile!;
    if (bought) {
      const st = shopState(game, s.accountId);
      st.xp = st.sub = game.wallNow() + 3_600_000;
    }
    c.push({ t: 'undock' });
    steps(game, 25);
    const before = levels(s);
    assert.equal(p.level, 1);
    const me = s.ship!;
    const foe = putSide(game, { cls: 'sloop', level: 1, craft: 'bot' }, me.state.x + 20, me.state.y, Math.PI).ship;
    assert.equal(foe.combatLevel, 1, 'a ship of ⚓1');
    boardAndScuttle(game, c, s, foe);
    assert.ok(p.deeds.includes('deed_first_prize'), 'her first prize, the deed');
    assert.equal(p.stats.boarded, 1);
    const gained = levels(s) - before;
    const toasts = c.all('toast').map((m) => m.msg);
    assert.equal(p.level, 1, `still the first level (${toasts.filter((m) => /XP|Level/.test(m)).join(' | ')})`);
    assert.ok(gained <= (bought ? 0.6 : 0.45), `one boarding: ${gained.toFixed(2)} of a level`);
    assert.ok(gained >= 0.15, `but a real step: ${gained.toFixed(2)}`);
    // One ship, one prize: «Took» and never «Sank» after it.
    assert.ok(toasts.some((m) => /^\+\d+ XP — Took /.test(m)));
    assert.ok(!toasts.some((m) => /^\+\d+ XP — Sank /.test(m)), 'the scuttled prize is not paid a second time');
  });
}

test('the next boardings: the first level in a few fights (with the first quests), not one', () => {
  const { game, c, s } = fresh(false, 'Steady Sal');
  const p = s.profile!;
  c.push({ t: 'undock' });
  steps(game, 25);
  let fights = 0;
  while (p.level === 1 && fights < 20) {
    const me = s.ship!;
    me.hull = me.stats.hullMax;
    me.crew = me.stats.crewMax;
    const foe = putSide(game, { cls: 'sloop', level: 1, craft: 'bot' }, me.state.x + 20, me.state.y, Math.PI).ship;
    boardAndScuttle(game, c, s, foe);
    fights++;
  }
  // Prize 1 unit + battle ≤ 0.1 a fight, the deed and the goal once: 300 XP takes four boardings and more.
  assert.ok(fights >= 4 && fights <= 7, `${fights} boardings to the second level`);
});

test('the First Watch: the second level before its boarding (as docs/23 item 81 weighs it), and its boarding brings no third', () => {
  const { game, c, s } = fresh(true, 'Watch Wren');
  const p = s.profile!;
  const ship = s.ship!;
  c.push({ t: 'undock' });
  ship.state.speed = 4;
  ship.state.sail = 0.6;
  steps(game, 21);
  const raider = [...game.ships.values()].find((x) => x.name === 'Red Novice')!;
  raider.state = { ...raider.state, x: ship.state.x + 600, y: ship.state.y };
  game.grid.upsert(raider.id, raider.state.x, raider.state.y);
  c.push({ t: 'attack', target: raider.id, mode: 'board' });
  steps(game, 21);
  for (let i = 0; i < 3; i++) onboardingVolley(game, ship, 0);
  onboardingVolley(game, ship, 2);
  c.push({ t: 'attack', target: raider.id, mode: 'guns' });
  onboardingVolley(game, ship, 1);
  steps(game, 21);
  assert.equal(p.level, 2, 'sail, «Атаковать», «Огонь»: the second level before the boarding');
  const before = levels(s);
  raider.state = { ...raider.state, x: ship.state.x + 20, y: ship.state.y, speed: 0, sail: 0 };
  game.grid.upsert(raider.id, raider.state.x, raider.state.y);
  boardAndScuttle(game, c, s, raider);
  assert.equal(p.level, 2, 'the lesson\'s boarding (its stage, the prize, the deed) brings no third level');
  assert.ok(levels(s) - before <= 0.5, `the boarding: ${(levels(s) - before).toFixed(2)} of a level`);
});

test('a deed pays at most a twentieth of her level: a little at the first levels, its four units later', () => {
  assert.equal(deedXp(1), Math.round(xpForLevel(1) * DEED_LEVEL_SHARE));
  assert.ok(deedXp(1) < 0.1 * xpForLevel(1));
  assert.equal(deedXp(40), lumpXp(40, XP_UNITS.deed), 'the four units once a level is long');
  for (let L = 1; L < 60; L++) assert.ok(deedXp(L) <= xpForLevel(L) * DEED_LEVEL_SHARE + 1, `L${L}`);
});
