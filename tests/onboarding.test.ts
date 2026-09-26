import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { onboardingReport, onboardingVolley, STAGES } from '../server/src/game/onboarding.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import type { Port } from '../shared/src/world/worldgen.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';

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

test('the First Watch: seven steps, each by doing; the HUD comes in a block at a time; the goals follow', () => {
  const { game } = makeGame();
  const { c, s } = recruit(game, 'Nell Novice');
  const ship = s.ship!;
  assert.equal(stage(c), 'cast_off');
  assert.deepEqual(c.last('onboarding')!.view.hud!.sort(), ['nav', 'ship']);
  // 1. Cast off and make way.
  c.push({ t: 'undock' });
  ship.state.speed = 4;
  ship.state.sail = 0.6;
  steps(game, 21);
  assert.equal(stage(c), 'first_trade');
  const v = c.last('onboarding')!.view;
  assert.ok(v.hud!.includes('cargo'));
  assert.ok(v.tip && v.tip.port !== 'saltmarrow', 'the tavern note names another port');
  assert.ok(c.all('onb').some((m) => m.kind === 'stage' && m.id === 'cast_off'));
  // 2. Sell something.
  dockAt(game, s, game.portById('saltmarrow')!);
  const good = Object.keys(ship.cargo)[0] as 'rum';
  c.push({ t: 'trade', good, qty: -1 });
  steps(game, 21);
  assert.equal(stage(c), 'lights');
  // 3. Lanterns: a League merchantman passes close.
  c.push({ t: 'undock' });
  const m = game.spawnNpcShip('merchant', 'fluyt', 'league', ship.state.x + 300, ship.state.y, 0);
  game.grid.upsert(m.id, m.state.x, m.state.y);
  steps(game, 21);
  assert.equal(stage(c), 'first_fight');
  assert.ok([...game.ships.values()].some((x) => x.name === 'Red Novice'), 'a raider comes for the novice');
  // 4. Three broadsides into the sea — the hint about the lead; then one that lands.
  for (let i = 0; i < 3; i++) onboardingVolley(game, ship, 0);
  assert.ok(c.all('onb').some((m) => m.kind === 'hint' && m.id === 'lead'));
  onboardingVolley(game, ship, 2);
  steps(game, 21);
  assert.equal(stage(c), 'gravesend');
  assert.ok(c.last('onboarding')!.view.hud!.includes('talents'));
  // 5. The capital.
  dockAt(game, s, game.portById('gravesend')!);
  steps(game, 21);
  assert.equal(stage(c), 'strange');
  // 6. Skippable: every step.
  c.push({ t: 'onboarding', action: 'skip_stage' });
  assert.equal(stage(c), 'edge');
  // 7. Across the line into the Gravewater Sea.
  c.push({ t: 'undock' });
  const [gx, gy] = REGIONS.gravewater.center;
  ship.state.x = gx;
  ship.state.y = gy;
  ship.region = 'gravewater';
  steps(game, 21);
  const done = c.last('onboarding')!.view;
  assert.equal(done.stage, null);
  assert.equal(done.hud, null, 'the whole HUD');
  assert.equal(done.goals!.length, 3);
  assert.equal(done.goals![0], 'g_duel', 'a corsair\'s calling first');
  assert.ok(c.all('onb').some((m) => m.kind === 'edge'), 'the edge of safe waters, once');
  const r = onboardingReport(game);
  assert.equal(r.started, 1);
  assert.equal(r.finished, 1);
  assert.equal(r.funnel.length, STAGES.length);
  assert.equal(r.funnel.find((f) => f.stage === 'strange')!.skipped, 1);
  assert.equal(r.hints[0].id, 'lead');
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
