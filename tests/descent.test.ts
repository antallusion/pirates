// The Descent into the Abyss (docs/12 P10 #17): the week's Stair on clear open water; a captain and her group near go
// down; a tier's creatures cleared pay silver and bring the choice (two blessings and a curse) for the leader alone; a
// curse weighs on the week's board; the currents carry every hull in the arena; leaving the arena ends a descent, and
// the descent is recorded when the last of them comes up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_R, BOONS, BREATH_SEC, OUT_SEC, WEEK_MS, descentPatterns, glory, tierSilver } from '../shared/src/data/descent.ts';
import type { BoonId } from '../shared/src/data/descent.ts';
import type { DescentView } from '../shared/src/protocol.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { chooseBoon, gateOf, inDescent, startDescent, stepDescent, stepDescentSea, weekBoard } from '../server/src/game/descent.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

function diver(game: Game, name: string, dx = 0): { s: PlayerSession; c: ReturnType<typeof join> } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  const g = gateOf(game);
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = g.x + 200 + dx;
  ship.state.y = g.y;
  ship.region = g.region;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { s, c };
}

/** The tier's creatures, gone (sunk by the divers, as far as the Descent is concerned). */
function clearCreatures(game: Game): void {
  const g = gateOf(game);
  for (const o of [...game.ships.values()]) if (!o.isPlayer && Math.hypot(o.state.x - g.x, o.state.y - g.y) < ARENA_R + 700) game.removeShip(o.id);
}

function view(c: ReturnType<typeof join>): DescentView['run'] {
  return (c.last('descent') as { view: DescentView | null } | undefined)?.view?.run ?? null;
}

test('the week’s Stair: open water, the arena clear of land; the same all week, elsewhere the next', () => {
  const { game } = makeGame();
  const t0 = game.wallNow();
  const a = gateOf(game);
  assert.equal(isLand(game.world, a.x, a.y), null);
  for (let k = 0; k < 12; k++) {
    const b = (k / 12) * Math.PI * 2;
    assert.equal(isLand(game.world, a.x + Math.sin(b) * ARENA_R, a.y - Math.cos(b) * ARENA_R), null);
  }
  game.wallNow = () => t0 + 60_000;
  assert.deepEqual(gateOf(game), a);
  game.wallNow = () => t0 + WEEK_MS;
  const n = gateOf(game);
  assert.ok(n.x !== a.x || n.y !== a.y);
});

test('down the Stair: creatures cleared for silver, then two blessings and a curse for the leader, then a breath', () => {
  const { game } = makeGame();
  const { s, c } = diver(game, 'Diver Dee');
  assert.equal(startDescent(game, s), null);
  assert.ok(inDescent(game, s.accountId));
  assert.equal(startDescent(game, s), 'You are already going down.');
  const g = gateOf(game);
  const creatures = [...game.ships.values()].filter((o) => !o.isPlayer && Math.hypot(o.state.x - g.x, o.state.y - g.y) < ARENA_R + 700);
  assert.ok(creatures.length >= 2, 'the first tier brings two at least');
  stepDescent(game);
  assert.equal(view(c)!.phase, 'fight');
  assert.equal(view(c)!.tier, 1);
  const g0 = s.profile!.gold;
  clearCreatures(game);
  stepDescent(game);
  assert.equal(s.profile!.gold, g0 + tierSilver(1, s.ship!.shipLevel));
  const run = view(c)!;
  assert.equal(run.phase, 'choice');
  assert.equal(run.offers!.length, 3);
  assert.equal(run.offers!.filter((b) => BOONS[b].curse).length, 1, 'one curse');
  const notOffered = (Object.keys(BOONS) as BoonId[]).find((b) => !run.offers!.includes(b))!;
  assert.equal(chooseBoon(game, s, notOffered), 'Nothing to choose now.');
  assert.equal(chooseBoon(game, s, run.offers![0]), null);
  stepDescent(game);
  assert.equal(view(c)!.phase, 'breath');
  assert.equal(view(c)!.boons.length, 1);
  game.now += BREATH_SEC + 1;
  stepDescent(game);
  assert.equal(view(c)!.tier, 2);
  assert.equal(view(c)!.phase, 'fight');
});

test('her group goes down with her; a curse on the board; the currents; out of the arena her descent ends', () => {
  const { game } = makeGame();
  const { s } = diver(game, 'Deep Dora');
  const { s: mate } = diver(game, 'Mate Milo', 300);
  game.social.groups.set(99, { id: 99, leader: s.accountId, members: [s.accountId, mate.accountId], convoy: false });
  game.social.groupOf.set(s.accountId, 99);
  game.social.groupOf.set(mate.accountId, 99);
  assert.equal(startDescent(game, s), null);
  assert.ok(inDescent(game, mate.accountId), 'her group near goes down with her');
  let cursed = false;
  for (let tier = 1; tier <= 3; tier++) {
    clearCreatures(game);
    stepDescent(game);
    assert.equal(chooseBoon(game, mate, 'salt_fury'), 'Only the leader chooses.');
    // The curse when it is Blood in the Water, else the first blessing: the leader's call.
    if (!cursed && chooseBoon(game, s, 'blood_in_water') === null) cursed = true;
    else for (const b of ['salt_fury', 'swift_current', 'iron_skin', 'quick_hands', 'tide_mending', 'lantern', 'drowned_hands', 'black_water', 'undertow_curse'] as BoonId[]) if (chooseBoon(game, s, b) === null) break;
    game.now += BREATH_SEC + 1;
    stepDescent(game);
  }
  // The currents carry her (whatever this tier's is, still water aside).
  const g = gateOf(game);
  const ship = s.ship!;
  const x0 = ship.state.x, y0 = ship.state.y;
  stepDescentSea(game, 1);
  const moved = Math.hypot(ship.state.x - x0, ship.state.y - y0);
  assert.ok(moved === 0 || moved > 0.5);
  // Out of the arena and staying out: her descent is over; her mate's goes on.
  ship.state.x = g.x + ARENA_R + 500;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  for (let k = 0; k <= OUT_SEC + 2; k++) {
    stepDescent(game);
    game.now += 1;
  }
  assert.ok(!inDescent(game, s.accountId));
  assert.ok(inDescent(game, mate.accountId));
  // The mate comes up: the descent is on the week's board.
  mate.ship!.docked = 'gravesend';
  stepDescent(game);
  assert.ok(!inDescent(game, mate.accountId));
  const row = weekBoard(game)[0];
  assert.ok(row && row.depth >= 3, JSON.stringify(weekBoard(game)));
  assert.deepEqual([...row.names].sort(), ['Deep Dora', 'Mate Milo']);
  if (cursed) assert.ok(row.glory > row.depth, 'a curse weighs on the board');
  assert.equal(glory(3, ['blood_in_water']), 4.5);
});

test('the descent reads in Russian', () => {
  setLang('ru');
  const t = (x: string) => serverText(x).replace(/\u00a0/g, ' ');
  assert.equal(t('Tier 2: Orcas; Eddy; Dusk.'), 'Ярус 2: Касатки; Водоворот; Сумрак.');
  assert.equal(t('Tier 5: Sharks and Echoes of the drowned; Rip; Pitch dark.'), 'Ярус 5: Акулы и Эхо утонувших; Разрывное течение; Кромешная тьма.');
  assert.equal(t('The descent is over at tier 4 (glory 5.2).'), 'Спуск окончен на ярусе 4 (слава 5.2).');
  for (const [en, ru] of descentPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
