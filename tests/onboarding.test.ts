import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { FIRST_FIGHTS, fresh, FRESH_REFUSAL, FRESH_SECS, onboardingReport, onboardingVolley, sanitizeTutorial, STAGES } from '../server/src/game/onboarding.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import type { Port } from '../shared/src/world/worldgen.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';
import { startMutiny } from '../server/src/game/crew.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { startBoarding } from '../server/src/game/boarding.ts';
import { tacAction } from '../server/src/game/tactical.ts';

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

test('the First Watch (docs/23 item 79): five steps, one action each — sail, «Атаковать», «Огонь», «На абордаж» with the hex battle, «В порт»; the HUD comes in a block at a time; the goals follow', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  quietAdv(game, false);
  const { c, s } = recruit(game, 'Nell Novice');
  const ship = s.ship!;
  const p = s.profile!;
  assert.equal(stage(c), 'sail');
  assert.deepEqual(c.last('onboarding')!.view.hud!.sort(), ['nav', 'ship']);
  assert.deepEqual(c.last('onboarding')!.view.locked, ['tattoos', 'dice', 'auction', 'guilds'], 'the optional things shut in the watch');
  // 1. Sail: off the quay and under way (the stick).
  c.push({ t: 'undock' });
  ship.state.speed = 4;
  ship.state.sail = 0.6;
  steps(game, 21);
  assert.equal(stage(c), 'attack');
  assert.ok(c.all('onb').some((m) => m.kind === 'stage' && m.id === 'sail'));
  const v = c.last('onboarding')!.view;
  assert.ok(v.hud!.includes('target') && !v.hud!.includes('guns'), '«Огонь» waits for its own step');
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
  // 2. «Атаковать»: the helmsman takes her for his mark.
  raider.state = { ...raider.state, x: ship.state.x + 600, y: ship.state.y };
  game.grid.upsert(raider.id, raider.state.x, raider.state.y);
  c.push({ t: 'attack', target: raider.id, mode: 'board' });
  steps(game, 21);
  assert.equal(stage(c), 'fire');
  assert.ok(c.last('onboarding')!.view.hud!.includes('guns'), '«Огонь» comes in');
  assert.equal(raider.softFor, ship.id, 'the lesson’s fight is the first of the three easy ones');
  // 3. «Огонь»: broadsides of the gun crews alone do not end it; three into the sea bring the hint on the lead.
  for (let i = 0; i < 3; i++) onboardingVolley(game, ship, 0);
  assert.ok(c.all('onb').some((m) => m.kind === 'hint' && m.id === 'lead'));
  onboardingVolley(game, ship, 2);
  steps(game, 21);
  assert.equal(stage(c), 'fire', 'the gun crews’ broadside is not her hand on the guns');
  c.push({ t: 'attack', target: raider.id, mode: 'guns' }); // «Огонь» on a mark that does not bear: the guns laid on her
  onboardingVolley(game, ship, 1);
  steps(game, 21);
  assert.equal(stage(c), 'board');
  // 4. «На абордаж»: alongside, the grapples, the hex battle fought out (quick battle).
  raider.state = { ...raider.state, x: ship.state.x + 20, y: ship.state.y, speed: 0, sail: 0 };
  game.grid.upsert(raider.id, raider.state.x, raider.state.y);
  ship.state.speed = 0;
  startBoarding(game, ship, raider, 'standard');
  assert.ok(ship.boarding?.fight.tac, 'the battle of H1');
  steps(game, 21);
  assert.equal(stage(c), 'board', 'not over until the battle is');
  assert.equal(tacAction(game, ship, { a: 'quick' }), null);
  steps(game, 20 * 8);
  assert.ok(!ship.boarding);
  steps(game, 21);
  assert.equal(stage(c), 'port');
  assert.ok(c.last('onboarding')!.view.hud!.includes('captain'));
  // 5. «В порт».
  dockAt(game, s, game.portById('saltmarrow')!);
  steps(game, 21);
  assert.ok(c.all('onb').some((m) => m.kind === 'stage' && m.id === 'port'));
  const done = c.last('onboarding')!.view;
  assert.equal(done.stage, null);
  assert.equal(done.hud, null, 'the whole HUD');
  assert.equal(done.goals!.length, 3);
  assert.equal(done.goals![0], 'g_duel', 'a corsair’s calling first');
  assert.ok((p.tutorial.easy ?? 0) >= 1, 'the lesson’s fight counted');
  const r = onboardingReport(game);
  assert.equal(r.started, 1);
  assert.equal(r.finished, 1);
  assert.equal(r.funnel.length, STAGES.length);
  assert.deepEqual(STAGES.map((x) => x.id), ['sail', 'attack', 'fire', 'board', 'port']);
  assert.equal(r.hints[0].id, 'lead');
  // docs/23 item 83: the watch over, the first quarter of an hour still keeps the optional things shut…
  assert.ok(fresh(p), 'the watch over, the quarter of an hour still on');
  {
    assert.equal(done.locked!.length, 4);
    c.push({ t: 'dice', action: 'open', stake: 10 });
    assert.ok(c.all('toast').some((m) => m.msg === FRESH_REFUSAL), 'a typed order is refused in words');
    // …and when it is over they open, told once.
    p.tutorial.played = FRESH_SECS - 1;
    steps(game, 21);
    assert.ok(c.all('onb').some((m) => m.kind === 'unlock'));
    assert.deepEqual(c.last('onboarding')!.view.locked, []);
  }
  // Skippable: every step (a second novice).
  const n2 = recruit(game, 'Skip Step');
  n2.c.push({ t: 'onboarding', action: 'skip_stage' });
  assert.equal(stage(n2.c), 'attack');
});

test('a watch saved in the nine old steps goes on in the five', () => {
  const { game } = makeGame();
  const { s } = recruit(game, 'Old Nine');
  const t = s.profile!.tutorial;
  for (const [old, now] of [[0, 'sail'], [1, 'attack'], [2, 'board'], [3, 'board'], [4, 'port']] as const) {
    t.v = 1;
    t.on = true;
    t.stage = old;
    sanitizeTutorial(s.profile!);
    assert.equal(STAGES[t.stage].id, now, `old step ${old}`);
  }
  // Past the old «recruit» she had been to port: the watch is done, nothing shut (docs/23 item 96).
  for (const old of [5, 8]) {
    t.v = 1;
    t.on = true;
    t.stage = old;
    sanitizeTutorial(s.profile!);
    assert.equal(t.on, false, `old step ${old}: done`);
    assert.equal(t.stage, STAGES.length);
  }
  // A profile from before the counts: an old hand, nothing shut, no easy fights.
  delete t.played;
  delete t.easy;
  t.on = false;
  sanitizeTutorial(s.profile!);
  assert.equal(fresh(s.profile!), false);
  assert.equal(t.easy, FIRST_FIGHTS);
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

test('the grapples thrown before «Атаковать»: the battle counts for the steps before it, the watch goes on to «В порт»', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const { c, s } = recruit(game, 'Early Grapple');
  const ship = s.ship!;
  c.push({ t: 'undock' });
  ship.state.speed = 4;
  ship.state.sail = 0.6;
  steps(game, 21);
  assert.equal(stage(c), 'attack');
  const raider = [...game.ships.values()].find((x) => x.name === 'Red Novice')!;
  raider.state = { ...raider.state, x: ship.state.x + 20, y: ship.state.y, speed: 0, sail: 0 };
  game.grid.upsert(raider.id, raider.state.x, raider.state.y);
  ship.state.speed = 0;
  startBoarding(game, ship, raider, 'standard');
  steps(game, 21);
  assert.equal(tacAction(game, ship, { a: 'quick' }), null);
  steps(game, 20 * 8);
  assert.ok(!ship.boarding);
  steps(game, 20 * 4);
  assert.equal(stage(c), 'port', 'attack, fire and board done by the one battle');
});
