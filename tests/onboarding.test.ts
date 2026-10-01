import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { onboardingReport, onboardingVolley, STAGES } from '../server/src/game/onboarding.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import type { Port } from '../shared/src/world/worldgen.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';
import { hireTrade, startMutiny } from '../server/src/game/crew.ts';
import { advMap, advOf, parkNear, quietAdv, visit } from '../server/src/game/advmap.ts';
import { startBoarding } from '../server/src/game/boarding.ts';
import { tacAction } from '../server/src/game/tactical.ts';
import { pendingChoices, pickSkill } from '../server/src/game/hero.ts';

function recruit(game: Game, name: string, captain: 'corsair' | 'reaver' = 'corsair'): { c: FakeConn; s: PlayerSession } {
  const c = new FakeConn();
  game.attach(c as unknown as WsConnection);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name });
  c.push({ t: 'create_captain', captain, shipName: 'First Watch', tutorial: true });
  return { c, s: game.sessionByName(name)! };
}

function dockAt(game: Game, s: PlayerSession, port: Port): void {
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  (game as unknown as { dockShip(x: PlayerSession, p: Port): void }).dockShip(s, port);
}

const stage = (c: FakeConn) => c.last('onboarding')!.view.stage;

test('the First Watch (docs/17 H5): seven steps of the Heroes’ loop, each by doing; the HUD comes in a block at a time; the goals follow', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  quietAdv(game, false);
  const { c, s } = recruit(game, 'Nell Novice');
  const ship = s.ship!;
  const p = s.profile!;
  assert.equal(stage(c), 'cast_off');
  assert.deepEqual(c.last('onboarding')!.view.hud!.sort(), ['nav', 'ship']);
  // 1. Cast off and make way.
  c.push({ t: 'undock' });
  ship.state.speed = 4;
  ship.state.sail = 0.6;
  steps(game, 21);
  assert.equal(stage(c), 'gunnery');
  assert.ok(c.all('onb').some((m) => m.kind === 'stage' && m.id === 'cast_off'));
  const v = c.last('onboarding')!.view;
  assert.ok(v.hud!.includes('guns') && v.hud!.includes('target'));
  assert.ok([...game.ships.values()].some((x) => x.name === 'Red Novice'), 'a raider comes for the novice');
  // The raider is lost (a restart, another captain's broadside): within a minute another comes.
  for (const x of [...game.ships.values()]) if (x.name === 'Red Novice') game.removeShip(x.id);
  steps(game, 20 * 50);
  const raider = [...game.ships.values()].find((x) => x.name === 'Red Novice')!;
  assert.ok(raider, 'a new raider replaces the lost one');
  assert.equal(game.npcs.get(raider.id)?.target, ship.id, 'she has the novice for her target');
  assert.ok(Object.entries(raider.ammo).every(([k, n]) => k === 'round' || n === 0), 'round shot only: a lesson, not a massacre');
  startMutiny(game, s, 'a test');
  assert.equal(p.company.mutiny, null, 'no mutiny during the First Watch');
  // 2. Three broadsides into the sea — the hint about the lead; then two that land.
  for (let i = 0; i < 3; i++) onboardingVolley(game, ship, 0);
  assert.ok(c.all('onb').some((m) => m.kind === 'hint' && m.id === 'lead'));
  onboardingVolley(game, ship, 2);
  steps(game, 21);
  assert.equal(stage(c), 'gunnery', 'one is not enough');
  onboardingVolley(game, ship, 1);
  steps(game, 21);
  assert.equal(stage(c), 'board');
  // 3. Alongside, the grapples: the boarding battle opens.
  raider.state = { ...raider.state, x: ship.state.x + 20, y: ship.state.y, speed: 0, sail: 0 };
  game.grid.upsert(raider.id, raider.state.x, raider.state.y);
  ship.state.speed = 0;
  startBoarding(game, ship, raider, 'standard');
  assert.ok(ship.boarding?.fight.tac, 'the battle of H1');
  steps(game, 21);
  assert.equal(stage(c), 'battle');
  // 4. The battle fought out (quick battle): over, the step is done.
  assert.equal(tacAction(game, ship, { a: 'quick' }), null);
  steps(game, 20 * 8);
  assert.ok(!ship.boarding);
  steps(game, 21);
  assert.equal(stage(c), 'recruit');
  assert.ok(c.last('onboarding')!.view.hud!.includes('captain'));
  // 5. A tavern's men into the stacks.
  const port = game.portById('saltmarrow')!;
  dockAt(game, s, port);
  if (ship.crew >= ship.stats.crewMax) ship.crew = ship.stats.crewMax - 5;
  game.tavernCrew.set(port.id, 30);
  assert.equal(hireTrade(game, s, port, 'sailor', 2), null);
  steps(game, 21);
  assert.equal(stage(c), 'skill');
  // 6. A level's skill: a choice waits (the step makes sure of it); she takes one.
  assert.ok(pendingChoices(p) > 0, 'a choice waiting');
  assert.equal(pickSkill(game, s, 0), null);
  steps(game, 21);
  assert.equal(stage(c), 'visit');
  assert.ok(c.last('onboarding')!.view.hud!.includes('talents'));
  // 7. A thing on the map, put on her chart.
  c.push({ t: 'undock' });
  const o = advMap(game).objs.filter((x) => advOf(p).seen.includes(x.id) && !x.guard && x.kind !== 'obelisk' && x.kind !== 'prison')[0];
  assert.ok(o, 'a thing on her chart');
  parkNear(game, s, o.x, o.y, 120);
  assert.equal(visit(game, s, o.id, o.kind === 'chest' ? 'silver' : undefined), null);
  steps(game, 21);
  const done = c.last('onboarding')!.view;
  assert.equal(done.stage, null);
  assert.equal(done.hud, null, 'the whole HUD');
  assert.equal(done.goals!.length, 3);
  assert.equal(done.goals![0], 'g_duel', 'a corsair’s calling first');
  const r = onboardingReport(game);
  assert.equal(r.started, 1);
  assert.equal(r.finished, 1);
  assert.equal(r.funnel.length, STAGES.length);
  assert.deepEqual(STAGES.map((x) => x.id), ['cast_off', 'gunnery', 'board', 'battle', 'recruit', 'skill', 'visit']);
  assert.equal(r.hints[0].id, 'lead');
  // Skippable: every step (a second novice).
  const n2 = recruit(game, 'Skip Step');
  n2.c.push({ t: 'onboarding', action: 'skip_stage' });
  assert.equal(stage(n2.c), 'gunnery');
});

test('chapter one: a sunk ship is towed home and nothing is lost; the old hand sinks as ever', () => {
  const { game } = makeGame();
  const { c, s } = recruit(game, 'Tow Tess');
  c.push({ t: 'undock' });
  const ship = s.ship!;
  steps(game, 21); // cast off (and its reward) first
  const gold = s.profile!.gold;
  const cargo = JSON.stringify(ship.cargo);
  ship.hull = 0;
  game.beginSinking(ship);
  steps(game, 20 * 8);
  const m = c.last('sunk_self')!;
  assert.equal(m.towed, true);
  assert.equal(s.profile!.gold, gold);
  assert.equal(JSON.stringify(ship.cargo), cargo);
  assert.ok(ship.docked);
  assert.equal(ship.hull, ship.stats.hullMax);
  // "I know the sea": the full HUD, the goals, no tow.
  const o = join(game, 'Old Hand', 'reaver');
  const O = game.sessionByName('Old Hand')!;
  const view = o.last('onboarding')!.view;
  assert.equal(view.hud, null);
  assert.equal(view.goals![0], 'g_first_board');
  o.push({ t: 'undock' });
  O.ship!.hull = 0;
  game.beginSinking(O.ship!);
  steps(game, 20 * 8);
  assert.notEqual(o.last('sunk_self')!.towed, true);
  // A goal met: the next one comes up.
  O.profile!.stats.boarded++;
  steps(game, 21);
  assert.ok(o.all('onb').some((x) => x.kind === 'goal' && x.id === 'g_first_board'));
  assert.ok(!o.last('onboarding')!.view.goals!.includes('g_first_board'));
  assert.equal(o.last('onboarding')!.view.goals!.length, 3);
  o.push({ t: 'onboarding', action: 'hide_goals' });
  assert.equal(o.last('onboarding')!.view.goals, null, 'hidden, and not back on its own');
  assert.equal(onboardingReport(game).knewTheSea, 1);
});

test('skipping the whole watch counts in the funnel; hints stop for the old hand', () => {
  const { game } = makeGame();
  const { c, s } = recruit(game, 'Skip Sam');
  c.push({ t: 'onboarding', action: 'skip_all' });
  assert.equal(c.last('onboarding')!.view.stage, null);
  assert.equal(s.profile!.tutorial.skipped, true);
  const r = onboardingReport(game);
  assert.equal(r.skippedMidway, 1);
  assert.equal(r.funnel[0].skipped, 1);
  for (let i = 0; i < 6; i++) onboardingVolley(game, s.ship!, 0);
  assert.ok(!c.all('onb').some((m) => m.kind === 'hint'));
});
