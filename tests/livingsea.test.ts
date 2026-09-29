// The living sea's reasons to sail (owner, 2026-09-29): ten-minute errands in port, encounters that lead on, rovers that
// come for a captain in the wild waters with the lookout's warning, and a welcome for every day at sea.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateContracts } from '../server/src/game/ports.ts';
import { FOLLOW, chooseEncounter, startEncounter, stepDirector } from '../server/src/game/director.ts';
import { HUNT_EVERY, compassPoint, stepTraffic } from '../server/src/game/traffic.ts';
import { dailyRollover } from '../server/src/game/dailies.ts';
import { dayOf } from '../shared/src/data/dailies.ts';
import { join, makeGame } from './helpers.ts';

function atSea(name: string, x = 56000, y = 74000, region = 'gravewater') {
  const { game } = makeGame();
  game.directorOn = true;
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.region = region as never;
  ship.protectedUntil = 0;
  ship.lastCombat = -1000;
  game.grid.upsert(ship.id, x, y);
  return { game, c, s, ship };
}

test('a port posts errands of ten minutes: letters to the next harbour, a rover in the wild waters', () => {
  const { game } = makeGame();
  const wild = game.world.ports.find((p) => p.region === 'gravewater')!;
  const list = generateContracts(game, wild);
  const urgent = list.filter((c) => c.title.startsWith('Urgent'));
  assert.ok(urgent.length >= 1, 'an errand');
  for (const c of urgent) assert.equal(c.expiresAt, game.now + 600);
  assert.ok(urgent.some((c) => c.kind === 'bounty'), 'a rover off the harbour mouth in contested water');
});

test('an encounter leads on: the raft taken, a bottle follows', () => {
  const { game, c, s, ship } = atSea('Chain Chaz');
  const keep = FOLLOW.raft![0].chance;
  FOLLOW.raft![0].chance = 1;
  try {
    const live = startEncounter(game, s, 'raft')!;
    ship.state.x = live.x + 50;
    ship.state.y = live.y;
    ship.state.speed = 0;
    stepDirector(game);
    assert.equal(chooseEncounter(game, s, live.id, 'take'), null);
    let bottle = false;
    for (let t = 0; t < 90 && !bottle; t++) {
      ship.state.speed = 8;
      stepDirector(game);
      game.now += 1;
      bottle = c.all('sights').some((m) => m.list.some((x) => x.kind === 'glint'));
    }
    assert.ok(bottle, 'the bottle the castaways spoke of');
  } finally {
    FOLLOW.raft![0].chance = keep;
  }
});

test('in the wild waters a rover comes for her, and the lookout says from where', () => {
  const { game, c, ship } = atSea('Hunted Hal');
  let hunter = false;
  for (let t = 0; t < HUNT_EVERY[1] + 30 && !hunter; t++) {
    ship.state.speed = 8;
    stepTraffic(game);
    game.now += 1;
    hunter = [...game.npcs.values()].some((b) => b.chase?.id === ship.id);
  }
  assert.ok(hunter, 'a pirate on her trail');
  assert.ok(c.all('toast').some((m) => /a pirate is coming for you/.test(m.msg)), 'the warning');
  assert.equal(compassPoint(0), 'north');
  assert.equal(compassPoint(Math.PI / 2), 'east');
  assert.equal(compassPoint(-Math.PI / 4), 'north-west');
});

test('no rover in the Crown’s safe water', () => {
  const { game, ship } = atSea('Safe Sue', 20000, 20000, 'black_coast');
  for (let t = 0; t < HUNT_EVERY[1] + 30; t++) {
    stepTraffic(game);
    game.now += 1;
  }
  assert.ok(![...game.npcs.values()].some((b) => b.chase?.id === ship.id));
});

test('each day at sea is welcomed, more for days in a row', () => {
  const { game, c, s } = atSea('Daily Dee');
  const today = dayOf(game.wallNow());
  s.profile!.daily.day = today - 1;
  s.profile!.daily.login = { day: today - 1, streak: 2 };
  const g0 = s.profile!.gold;
  assert.equal(dailyRollover(game, s), true);
  assert.equal(s.profile!.daily.login!.streak, 3);
  assert.ok(s.profile!.gold > g0, 'silver for the day');
  assert.ok(c.all('toast').some((m) => /Day 3 at sea in a row/.test(m.msg)));
  // Twice the same day pays once.
  const g1 = s.profile!.gold;
  assert.equal(dailyRollover(game, s), false);
  assert.equal(s.profile!.gold, g1);
});
