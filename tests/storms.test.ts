// Storm chasers (docs/12 P10 #14): the heart of the Storm of the Century wanders open water; bolts fall near it (a
// lightning rod grounds most of each); held in its core, a captain catches it — two a storm at most, and the sky needs
// a while to make another; hearts are forged into the Storm-Chaser set, and one goes into a ship's keel for ⚓10.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARGE_NEED, CORE_R, HEARTS_PER_STORM, HEART_R, STORM_FORGE, stormPatterns } from '../shared/src/data/storms.ts';
import { refitCost } from '../shared/src/data/shiplevel.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { startEvent } from '../server/src/game/events.ts';
import type { WorldEvent } from '../server/src/game/events.ts';
import { orderRefit, refitView } from '../server/src/game/refit.ts';
import { forgeStorm, heartAt, stepStorms, strike } from '../server/src/game/storms.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

function storm(game: Game): WorldEvent {
  const [x, y] = [56000, 74000];
  return startEvent(game, { kind: 'storm_century', region: 'gravewater', x, y, ends: game.wallNow() + 3 * 3600_000, title: 'The Storm of the Century over Gravewater Sea', stage: 'storm' }, 'The Storm of the Century is breaking over Gravewater Sea. Make for harbour — or for the wrecks after.')!;
}

function putAt(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.region = 'gravewater';
  game.grid.upsert(ship.id, x, y);
}

test('the heart wanders open water; a bolt with a lightning rod does 40% of one without', () => {
  const { game } = makeGame();
  const e = storm(game);
  const t0 = game.wallNow();
  const seen: { x: number; y: number }[] = [];
  let wet = 0;
  for (let m = 0; m < 60; m += 5) {
    game.wallNow = () => t0 + m * 60_000;
    const h = heartAt(game, e);
    if (!isLand(game.world, h.x, h.y)) wet++;
    assert.ok(Math.hypot(h.x - e.x, h.y - e.y) < 9000, 'about the storm’s centre');
    seen.push(h);
  }
  assert.ok(wet >= seen.length * 0.7, 'over open water, mostly');
  assert.ok(Math.hypot(seen[0].x - seen.at(-1)!.x, seen[0].y - seen.at(-1)!.y) > 500, 'it moves');
  join(game, 'Bare Mast');
  join(game, 'Rod Mast');
  const sa = game.sessionByName('Bare Mast')!, sb = game.sessionByName('Rod Mast')!;
  putAt(game, sa, e.x, e.y);
  putAt(game, sb, e.x + 400, e.y);
  const a = sa.ship!, b = sb.ship!;
  b.stats.flags.add('lightning_rod');
  assert.ok(b.hasFlag('lightning_rod'));
  const ha = a.hull, hb = b.hull;
  strike(game, a);
  strike(game, b);
  const da = ha - a.hull, db = hb - b.hull;
  assert.ok(da > 0);
  assert.ok(Math.abs(db / da - 0.4) < 0.05, `${db} vs ${da}`);
});

test('held in the core the charge builds and the heart is caught; then it rests, and two a storm at most', () => {
  const { game } = makeGame();
  const e = storm(game);
  const c = join(game, 'Chaser Cora');
  const s = game.sessionByName('Chaser Cora')!;
  const oc = join(game, 'Onlooker Otto');
  const o = game.sessionByName('Onlooker Otto')!;
  s.ship!.stats.flags.add('lightning_rod');
  let wall = game.wallNow();
  game.wallNow = () => wall;
  const h = heartAt(game, e);
  putAt(game, s, h.x + 50, h.y);
  putAt(game, o, h.x + HEART_R - 100, h.y);
  for (let i = 0; i < CHARGE_NEED - 1; i++) stepStorms(game);
  assert.equal(s.profile!.stormHearts ?? 0, 0);
  assert.equal(c.last('storm')!.view!.charge, CHARGE_NEED - 1);
  assert.ok(c.all('toast').some((t) => t.msg === 'You are in the heart of the storm: hold here to catch it.'));
  stepStorms(game);
  assert.equal(s.profile!.stormHearts, 1);
  assert.ok(c.all('toast').some((t) => t.msg === 'You have caught the heart of the storm! (1 in all)'));
  assert.ok(oc.all('toast').some((t) => t.msg === 'Chaser Cora has caught the heart of the storm over Gravewater Sea.'));
  stepStorms(game);
  assert.ok(oc.last('storm')!.view!.rest > 0, 'the heart rests');
  assert.equal(c.last('storm')!.view!.charge, 0);
  // Out of the core the charge bleeds away.
  wall += 9 * 60_000;
  const h2 = heartAt(game, e);
  putAt(game, s, h2.x, h2.y);
  for (let i = 0; i < 10; i++) stepStorms(game);
  putAt(game, s, h2.x + CORE_R * 3, h2.y);
  for (let i = 0; i < 3; i++) stepStorms(game);
  assert.equal(c.last('storm')!.view!.charge, 4);
  // A second heart, then no more from this storm.
  for (let k = 0; k < 2; k++) {
    const hh = heartAt(game, e);
    putAt(game, s, hh.x, hh.y);
    for (let i = 0; i < CHARGE_NEED; i++) stepStorms(game);
    wall += 9 * 60_000;
  }
  assert.equal(s.profile!.stormHearts, HEARTS_PER_STORM);
  assert.ok(c.all('toast').some((t) => t.msg === 'You have caught all this storm will give you.'));
  // Docked, the panel goes.
  s.ship!.docked = game.world.ports[0].id;
  stepStorms(game);
  assert.equal(c.last('storm')!.view, null);
});

test('the Storm-Chaser forge: two hearts and silver for an epic bound piece; a forge is wanted', () => {
  const { game } = makeGame();
  join(game, 'Smith Sela');
  const s = game.sessionByName('Smith Sela')!;
  const p = s.profile!;
  p.gold = 10_000;
  const small = game.world.ports.find((x) => x.shipyardTier === 1)!;
  const forge = game.world.ports.find((x) => x.shipyardTier >= 2)!;
  p.stormHearts = 1;
  assert.equal(forgeStorm(game, s, small, 'sails'), 'No forge here: the Storm-Chaser set wants a yard of the second rank or better');
  assert.equal(forgeStorm(game, s, forge, 'sails'), `Needs ${STORM_FORGE.hearts} hearts of the storm`);
  assert.equal(forgeStorm(game, s, forge, 'guns' as never), 'That is not a piece of the Storm-Chaser set');
  p.stormHearts = 3;
  const n0 = p.stash.length;
  assert.equal(forgeStorm(game, s, forge, 'sails'), null);
  const it = p.stash.at(-1)!;
  assert.equal(p.stash.length, n0 + 1);
  assert.equal(it.set, 'storm');
  assert.equal(it.rarity, 3);
  assert.equal(it.bound, true);
  assert.equal(p.stormHearts, 1);
  assert.equal(p.gold, 10_000 - STORM_FORGE.silver);
});

test('a ship’s tenth level wants a heart of the storm in her keel', () => {
  const { game } = makeGame();
  join(game, 'Admiral Ash');
  const s = game.sessionByName('Admiral Ash')!;
  const p = s.profile!;
  // The greatest yard takes a first-rate in hand (none builds them).
  const yard = game.world.ports.find((x) => x.shipyardTier >= 4)!;
  p.loadout.classId = 'man_o_war';
  p.loadout.level = 9;
  p.level = 60;
  p.gold = 500_000;
  s.ship!.docked = yard.id;
  p.docked = yard.id;
  const cost = refitCost(10)!;
  assert.equal(cost.hearts, 1);
  for (const g of cost.goods) s.ship!.cargo[g.good] = g.qty;
  const v = refitView(game, s, yard);
  assert.deepEqual(v.next!.hearts, { qty: 1, have: 0 });
  assert.equal(v.blocked, 'Needs a heart of the storm in her keel (caught in the Storm of the Century)');
  p.stormHearts = 1;
  assert.equal(refitView(game, s, yard).blocked, null);
  assert.equal(orderRefit(game, s, yard), null);
  assert.equal(p.stormHearts, 0);
});

test('storm chasers read in Russian', () => {
  setLang('ru');
  assert.equal(serverText('You have caught the heart of the storm! (2 in all)').replace(/\u00a0/g, ' '), 'Вы поймали сердце шторма! (всего: 2)');
  assert.equal(serverText('Needs a heart of the storm in her keel (caught in the Storm of the Century)').replace(/\u00a0/g, ' '), 'Нужно сердце шторма в киль (ловят в шторм века)');
  for (const [en, ru] of stormPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
