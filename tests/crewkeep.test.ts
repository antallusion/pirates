// Forum 135 (Эдуард, 2026-11-22): after the crew fell and a new one was signed, the surgeons' healing and the cooks'
// morale were gone from the crew window. The trades below decks fall last now and never come back multiplied by the
// head count; the first of a trade signed after nobody of it was left takes up the trade's practice whole; and the last
// of them fallen is told.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRACTICE_LEVELS, practiceLevel } from '../shared/src/data/crewtalk.ts';
import { BELOW_DECKS, LAST_GONE, hireTrade, poolTotal, reconcile, stepCompany, tavernOf } from '../server/src/game/crew.ts';
import { CREW_FIXES, applyCrewFix, practiceDue } from '../server/src/game/crewfix.ts';
import { lettersSince } from '../server/src/game/post.ts';
import { serverTable } from '../client/src/lang/server.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame } from './helpers.ts';

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = 20;
  s.profile!.gold = 1e6;
  return { c, s };
}

test('a lost fight takes the men on deck first: the surgeons and the cook are the last to fall', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Orlop');
  const ship = s.ship!;
  const co = s.profile!.company;
  ship.crew = 100;
  co.pools = { sailor: 70, gunner: 15, helmsman: 1, carpenter: 5, surgeon: 2, marine: 5, cook: 2 };
  assert.equal(poolTotal(co.pools), ship.crew);
  // The boarding is lost at 15% of her men left; the survivors and the men pulled out of the water make her least crew.
  reconcile(game, co, 15);
  assert.equal(co.pools.surgeon, 2);
  assert.equal(co.pools.cook, 2);
  assert.equal(poolTotal(co.pools), 15);
  reconcile(game, co, 60);
  assert.equal(poolTotal(co.pools), 60);
  assert.equal(co.pools.surgeon, 2, 'the returns are deck hands, not new surgeons');
  assert.equal(co.pools.cook, 2);
  // Only when nobody else is left do they fall: the last man standing is a cook or a surgeon.
  reconcile(game, co, 3);
  assert.equal(poolTotal(co.pools), 3);
  assert.ok(co.pools.surgeon + co.pools.cook === 3);
  reconcile(game, co, 0);
  assert.equal(poolTotal(co.pools), 0);
  // A whole crew lost: the new one comes aboard as sailors.
  reconcile(game, co, 40);
  assert.equal(co.pools.sailor, 40);
  for (const k of BELOW_DECKS) assert.equal(co.pools[k], 0);
});

test('the first cook or surgeon signed after none was left takes up the trade\'s practice whole; more of them thin it', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Galley');
  const ship = s.ship!;
  const co = s.profile!.company;
  const port = game.world.ports.find((p) => p.id === 'saltmarrow') ?? game.world.ports[0];
  ship.docked = port.id;
  s.profile!.docked = port.id;
  ship.crew = Math.max(1, ship.stats.crewMax - 30);
  co.pools = { sailor: ship.crew, gunner: 0, helmsman: 0, carpenter: 0, surgeon: 0, marine: 0, cook: 0 };
  co.practice.cook = PRACTICE_LEVELS[3];
  co.practice.surgeon = PRACTICE_LEVELS[2];
  const tav = tavernOf(game, port);
  tav.stock.cook = 5;
  tav.stock.surgeon = 5;
  assert.equal(hireTrade(game, s, port, 'cook', 1), null);
  assert.equal(co.pools.cook, 1);
  assert.equal(co.practice.cook, PRACTICE_LEVELS[3], 'the cooks\' practice is not wiped by the first cook');
  assert.equal(hireTrade(game, s, port, 'surgeon', 2), null);
  assert.equal(co.practice.surgeon, PRACTICE_LEVELS[2]);
  // Into a trade with men of it aboard the new hands still thin it by their share.
  assert.equal(hireTrade(game, s, port, 'cook', 1), null);
  assert.equal(co.practice.cook, PRACTICE_LEVELS[3] / 2);
});

test('the last surgeon or cook fallen is told once, with how to get one back; paying one off is not a death', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Told');
  const ship = s.ship!;
  const co = s.profile!.company;
  ship.crew = Math.min(ship.stats.crewMax, 60);
  co.pools = { sailor: ship.crew - 2, gunner: 0, helmsman: 0, carpenter: 0, surgeon: 1, marine: 0, cook: 1 };
  stepCompany(game, s);
  const told = () => c.all('toast').map((m) => (m as { msg: string }).msg).filter((m) => m === LAST_GONE.cook || m === LAST_GONE.surgeon);
  assert.equal(told().length, 0);
  // Everybody on deck falls, then the cook.
  ship.crew = 1;
  stepCompany(game, s);
  assert.equal(co.pools.cook + co.pools.surgeon, 1);
  assert.equal(told().length, 1);
  ship.crew = 0;
  stepCompany(game, s);
  assert.equal(told().length, 2);
  stepCompany(game, s);
  assert.equal(told().length, 2, 'told once');
  // Paid off at the quay by her own hand: no word of a death.
  const port = game.world.ports.find((p) => p.id === 'saltmarrow') ?? game.world.ports[0];
  ship.crew = 30;
  co.pools = { sailor: 29, gunner: 0, helmsman: 0, carpenter: 0, surgeon: 0, marine: 0, cook: 1 };
  stepCompany(game, s);
  assert.equal(hireTrade(game, s, port, 'cook', -1), null);
  stepCompany(game, s);
  assert.equal(told().length, 2);
  // Both lines are in Russian.
  const table = serverTable();
  for (const k of BELOW_DECKS) assert.ok(table[LAST_GONE[k]!], `RU for ${k}`);
});

test('forum 135 put right once: the cooks\' practice by her hours at sea, the surgeons\' to two levels, a letter; never lowered', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Eduard');
  const co = s.profile!.company;
  co.seaHours = 40;
  co.practice.cook = 0;
  co.practice.surgeon = 0;
  const due = practiceDue(40);
  assert.equal(due.cook, 1800); // 40 h × 60 × 0.75: level 3
  assert.equal(practiceLevel(due.cook), 3);
  assert.equal(due.surgeon, PRACTICE_LEVELS[2]);
  assert.ok(applyCrewFix(game, s));
  assert.equal(co.practice.cook, 1800);
  assert.equal(co.practice.surgeon, PRACTICE_LEVELS[2]);
  const letter = lettersSince(game, s.accountId, 0).at(-1)!;
  assert.match(letter.body, /сноровка коков — 3-й уровень/);
  assert.equal(letter.gold, 0);
  // A captain whose practice stands higher keeps it; nothing to do, no letter.
  co.practice.cook = PRACTICE_LEVELS[5];
  co.practice.surgeon = PRACTICE_LEVELS[4];
  const n = lettersSince(game, s.accountId, 0).length;
  assert.equal(applyCrewFix(game, s), null);
  assert.equal(co.practice.cook, PRACTICE_LEVELS[5]);
  assert.equal(lettersSince(game, s.accountId, 0).length, n);
  assert.deepEqual(CREW_FIXES.map((f) => f.account), [161]);
});
