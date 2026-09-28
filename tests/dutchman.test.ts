// The Flying Dutchman (docs/12 P10 #10): the week's five pages in five seas and his island, one page shown a day; a page
// taken by sailing to it (and shared with the group near); all five name his island, where he rises; the first to sink
// him wins his figurehead and a title; after that his echo pays silver.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, DUTCHMAN_TITLE, PAGES, WEEK_MS, dutchmanPatterns } from '../shared/src/data/dutchman.ts';
import { regionAt } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { dutchmanView, pagesShown, stepDutchman, weekPlan } from '../server/src/game/dutchman.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

function to(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  game.grid.upsert(ship.id, x, y);
}

test('five pages in five seas and his island, one page shown a day, the same for the week', () => {
  const { game } = makeGame();
  let wall = 2000 * WEEK_MS + 1000;
  game.wallNow = () => wall;
  const plan = weekPlan(game);
  assert.equal(plan.pages.length, PAGES);
  assert.equal(new Set(plan.pages.map((p) => regionAt(game.world, p.x, p.y))).size, PAGES, 'five seas');
  assert.equal(pagesShown(game), 1);
  wall += 2 * DAY_MS;
  assert.equal(pagesShown(game), 3);
  wall += 10 * DAY_MS;
  assert.notDeepEqual(weekPlan(game).pages, plan.pages, 'a new riddle next week');
});

test('pages taken by sailing to them, shared with the group near; all five: he rises at his island; the first to sink him wins', () => {
  const { game } = makeGame();
  const wall = 3000 * WEEK_MS + 6 * DAY_MS;
  game.wallNow = () => wall;
  const c = join(game, 'Ghost Hunter Gwen');
  const s = game.sessionByName('Ghost Hunter Gwen')!;
  const plan = weekPlan(game);
  for (const pg of plan.pages) {
    to(game, s, pg.x, pg.y);
    stepDutchman(game);
  }
  const v = dutchmanView(game, s);
  assert.equal(v.pages.filter((p) => p.taken).length, PAGES);
  assert.ok(v.pages.every((p) => p.text), 'the log’s lines read');
  assert.ok(v.battle, 'his island named');
  assert.ok(c.all('toast').some((t) => t.msg.startsWith('All five pages: the Dutchman waits off ')));
  // At his island he rises.
  to(game, s, plan.battle.x + 800, plan.battle.y);
  stepDutchman(game);
  const him = [...game.ships.values()].find((x) => x.dutchman)!;
  assert.ok(him, 'the Dutchman');
  assert.equal(him.name, 'The Flying Dutchman');
  // Sunk by her: the figurehead and the title.
  him.attackers.set(s.ship!.id, game.now);
  him.hull = 0;
  game.beginSinking(him);
  assert.ok(s.profile!.figureheads.includes('fh_dutchman'));
  assert.ok(s.profile!.titles.includes(DUTCHMAN_TITLE));
  assert.equal(dutchmanView(game, s).winner, 'Ghost Hunter Gwen');
  // Another captain with all five later: his echo, and silver.
  join(game, 'Late Lars');
  const b = game.sessionByName('Late Lars')!;
  b.profile!.dutchman = { week: plan.week, pages: [0, 1, 2, 3, 4] };
  to(game, b, plan.battle.x - 800, plan.battle.y);
  stepDutchman(game);
  const echo = [...game.ships.values()].find((x) => x.dutchman && x.alive && !x.sinkingUntil)!;
  const g0 = b.profile!.gold;
  echo.attackers.set(b.ship!.id, game.now);
  echo.hull = 0;
  game.beginSinking(echo);
  assert.equal(b.profile!.gold, g0 + 3000);
  assert.ok(!b.profile!.figureheads.includes('fh_dutchman'));
});

test('the Dutchman reads in Russian', () => {
  setLang('ru');
  assert.equal(serverText('A torn page of the Dutchman’s log (3 of 5).').replace(/\u00a0/g, ' '), 'Обрывок вахтенного журнала Голландца (3 из 5).');
  for (const [en, ru] of dutchmanPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
