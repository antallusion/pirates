import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { canLearn } from '../shared/src/data/talents.ts';
import { learnContext } from '../server/src/game/progression.ts';
import { questEvent, questOffers } from '../server/src/game/quests.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import { join, makeGame } from './helpers.ts';

function captain(game: Game, name: string, cap: CaptainId, level = 30) {
  const c = join(game, name, cap);
  const s = [...game.sessions].find((x) => x.name === name)!;
  s.profile!.level = level;
  s.profile!.gold = 1e5;
  return { c, s, ship: s.ship!, p: s.profile! };
}

function dock(game: Game, s: PlayerSession, portId: string) {
  const port = game.portById(portId)!;
  s.ship!.docked = port.id;
  s.profile!.docked = port.id;
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  return port;
}

function atSea(game: Game, s: PlayerSession, x = 30000, y = 80000) {
  s.ship!.docked = null;
  s.profile!.docked = null;
  s.ship!.state.x = x;
  s.ship!.state.y = y;
  game.grid.upsert(s.ship!.id, x, y);
}

test('mentors offer their Path to captains who do not walk it yet', () => {
  const { game } = makeGame();
  const reaver = captain(game, 'Reaver', 'reaver');
  const corsair = captain(game, 'Corsair', 'corsair');
  const gravesend = game.portById('gravesend')!;
  assert.ok(questOffers(reaver.p, gravesend).some((o) => o.q.id === 'q_path_corsair' && o.blocked === null));
  assert.ok(!questOffers(corsair.p, gravesend).some((o) => o.q.id === 'q_path_corsair'));
  assert.deepEqual(reaver.p.paths, ['reaver']);
});

test('The Last Volley: sink, deliver, sink bigger, report — and the Corsair\'s Path is yours', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Student', 'reaver');
  dock(game, s, 'gravesend');
  c.push({ t: 'quest', action: 'accept', id: 'q_path_corsair' });
  assert.equal(p.quests.active.length, 1);
  atSea(game, s);
  for (let i = 0; i < 4; i++) {
    const v = game.spawnNpcShip('pirate', 'sloop', 'confederacy', ship.state.x + 500, ship.state.y, 0);
    questEvent(game, s, { k: 'sink', victim: v });
  }
  assert.equal(p.quests.active[0].step, 1);
  // Arriving without the powder does nothing.
  questEvent(game, s, { k: 'dock', port: dock(game, s, 'blackwater') });
  assert.equal(p.quests.active[0].step, 1);
  ship.cargo.gunpowder = 25;
  questEvent(game, s, { k: 'dock', port: game.portById('blackwater')! });
  assert.equal(p.quests.active[0].step, 2);
  assert.equal(ship.cargo.gunpowder, 5);
  atSea(game, s);
  questEvent(game, s, { k: 'sink', victim: game.spawnNpcShip('pirate', 'sloop', 'confederacy', 0, 0, 0) });
  assert.equal(p.quests.active[0].step, 2, 'a sloop is not second rate');
  questEvent(game, s, { k: 'sink', victim: game.spawnNpcShip('pirate', 'brig', 'confederacy', 0, 0, 0) });
  const g0 = p.gold;
  questEvent(game, s, { k: 'dock', port: dock(game, s, 'gravesend') });
  assert.equal(p.quests.active.length, 0);
  assert.ok(p.quests.done.includes('q_path_corsair'));
  assert.ok(p.paths.includes('corsair'));
  assert.ok(p.gold > g0);
});

test('Captain\'s House: change to a Path you have learned, once an hour', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Switcher', 'reaver');
  dock(game, s, 'gravesend');
  c.push({ t: 'path', to: 'corsair' });
  assert.equal(p.captain, 'reaver', 'not learned');
  p.paths.push('corsair', 'navigator');
  dock(game, s, 'blackwater');
  c.push({ t: 'path', to: 'corsair' });
  assert.equal(p.captain, 'reaver', 'no Captain\'s House in Blackwater');
  dock(game, s, 'gravesend');
  c.push({ t: 'path', to: 'corsair' });
  assert.equal(p.captain, 'corsair');
  assert.equal(ship.captain, 'corsair');
  c.push({ t: 'path', to: 'navigator' });
  assert.equal(p.captain, 'corsair', 'once an hour');
  game.now += 3601;
  c.push({ t: 'path', to: 'navigator' });
  assert.equal(p.captain, 'navigator');
});

test('The First Descent opens the Abyssal tree', () => {
  const { game } = makeGame();
  const { c, s, ship, p } = captain(game, 'Diver', 'navigator', 25);
  assert.match(canLearn({}, 'abs_whispers_below', 5, learnContext(p))!, /Abyss/);
  dock(game, s, 'saint_maw');
  ship.cargo.abyssal_ore = 3;
  c.push({ t: 'quest', action: 'accept', id: 'q_first_descent' });
  assert.equal(p.quests.active[0].step, 1, 'the tithe was aboard');
  questEvent(game, s, { k: 'dive' });
  atSea(game, s, 89000, 8000);
  ship.region = 'the_abyss';
  for (let i = 0; i < 121; i++) questEvent(game, s, { k: 'tick', dt: 1 });
  assert.equal(p.quests.active[0].step, 3);
  questEvent(game, s, { k: 'dock', port: dock(game, s, 'saint_maw') });
  assert.ok(p.deeds.includes('deed_first_descent'));
  assert.equal(canLearn({}, 'abs_whispers_below', 5, learnContext(p)), null);
});

test('Drown Once: the Choir\'s friends or the deep-touched; the ship must go down in the Drowned Crown', () => {
  const { game } = makeGame();
  const { s, p } = captain(game, 'Legend', 'corsair', 30);
  const saintMaw = game.portById('saint_maw')!;
  assert.ok(questOffers(p, saintMaw).find((o) => o.q.id === 'q_legend_drowned')!.blocked);
  p.reputation.choir = 25;
  assert.equal(questOffers(p, saintMaw).find((o) => o.q.id === 'q_legend_drowned')!.blocked, null);
  p.quests.active.push({ id: 'q_legend_drowned', step: 3, progress: 0, startedAt: 0 });
  questEvent(game, s, { k: 'die', region: 'gravewater' });
  assert.equal(p.quests.active[0].step, 3);
  questEvent(game, s, { k: 'die', region: 'drowned_crown' });
  assert.equal(p.quests.active[0].step, 4);
  questEvent(game, s, { k: 'dock', port: dock(game, s, 'saint_maw') });
  assert.ok(p.paths.includes('drowned'));
  assert.ok(p.deeds.includes('deed_legend_quest'));
});

test('oaths: the Code keeps pirates off you; a letter of marque pays for Confederacy hulls', () => {
  const { game } = makeGame();
  const pir = captain(game, 'Brother', 'reaver');
  dock(game, pir.s, 'cinderhold');
  pir.c.push({ t: 'oath', oath: 'code' });
  assert.equal(pir.p.oath, null, 'the Brethren do not know you yet');
  pir.p.reputation.confederacy = 20;
  pir.c.push({ t: 'oath', oath: 'code' });
  assert.equal(pir.p.oath, 'code');
  assert.ok(pir.p.deeds.includes('deed_black_flag_oath'));
  atSea(game, pir.s, 84000, 70000);
  pir.ship.region = 'ashen_isles';
  pir.ship.protectedUntil = 0;
  const pirate = game.spawnNpcShip('pirate', 'brig', 'confederacy', 84300, 70000, 0);
  assert.equal(npcHostileTo(game, pirate, pir.ship), false);
  const priv = captain(game, 'Privateer', 'corsair');
  priv.p.reputation.crown = 20;
  dock(game, priv.s, 'gravesend');
  priv.c.push({ t: 'oath', oath: 'marque' });
  assert.equal(priv.p.oath, 'marque');
});
