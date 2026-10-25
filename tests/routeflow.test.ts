// «Плыть» from quest to quest (owner, 2026-10-26: «я захожу в порт сдать квест, он мне дает следующий, я начинаю плыть,
// переключаюсь на цель и ниче не происходит»). The run to a harbour's step brought her off its quays, hove to, and left
// her there drifting on the current — «Причалить» lit a moment, then gone, nothing to press — and «Плыть» in port only
// kept a course for a casting off she had to find herself. Now: in port «Плыть» casts off and sails; a step done in the
// very port she lies in is done by it; arrived at a harbour's step she is put in; a stop (allstop.ts) never leaves «Плыть»
// dead.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import type { QuestDef } from '../shared/src/data/quests.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { autosailOf } from '../server/src/game/autosail.ts';
import { allStop } from '../server/src/game/allstop.ts';
import { ROUTE_WORDS, routeOf } from '../server/src/game/goalroute.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

function captain(game: Game, name: string): { s: PlayerSession; c: FakeConn } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  s.ship!.protectedUntil = 0;
  return { s, c };
}

function give(game: Game, s: PlayerSession, id: string, port: string, steps: QuestDef['steps']): void {
  QUESTS_BY_ID[id] = { id, kind: 'job', name: `Test ${id}`, mentor: 'Tester', port, summary: '', requires: {}, steps, reward: { xp: 1, silver: 1 } };
  s.profile!.quests.active.push({ id, step: 0, progress: 0, startedAt: game.now });
}

/** Sails on until she lies in port (or the time is out). */
function sailUntilDocked(game: Game, s: PlayerSession, sec: number): void {
  for (let k = 0; k < sec * 20 && !s.ship!.docked; k++) steps(game, 1);
}

test('the campaign’s «Отвезите вести в порт Солтмарроу» (c01_10 step 2): cast off, «Плыть» — she is put in, the step done', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Flow Fenna');
  runAdmin(game, s, '/camp slot 9');
  runAdmin(game, s, '/camp step');
  const qs = () => s.profile!.quests.active.find((a) => a.id === 'c01_10');
  assert.equal(qs()?.step, 1, 'the news step');
  assert.equal(s.ship!.docked, 'saltmarrow');
  c.push({ t: 'undock' });
  steps(game, 1);
  assert.equal(s.ship!.docked, null);
  c.push({ t: 'goto', key: 'q:c01_10' });
  steps(game, 1);
  assert.ok(routeOf(game, s), 'the run is on');
  sailUntilDocked(game, s, 90);
  assert.equal(s.ship!.docked, 'saltmarrow', 'arrived, she is put in (not left hove to off the quays)');
  assert.notEqual(qs()?.step ?? 99, 1, 'the step is done by putting in');
});

test('«Плыть» in port casts off at once and sails for another harbour; arrived, she is put in and the visit counts', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Cast Cora');
  const ship = s.ship!;
  const home = game.portById(ship.docked!)!;
  // the nearest other harbour
  const to = game.world.ports.filter((p) => p.id !== home.id && !p.raft).sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y))[0];
  give(game, s, 'rf_visit', home.id, [{ type: 'visit', port: to.id, text: 'Sail there.' }]);
  c.inbox.length = 0;
  c.push({ t: 'goto', key: 'q:rf_visit' });
  assert.equal(ship.docked, null, 'cast off by «Плыть» itself');
  assert.ok(c.all('toast').some((m) => m.msg === ROUTE_WORDS.castOff), 'she is told she casts off');
  steps(game, 2);
  assert.ok(autosailOf(ship), 'the helmsman has her at once');
  sailUntilDocked(game, s, 900);
  assert.equal(ship.docked, to.id, 'put in at the step’s harbour');
  assert.ok(!s.profile!.quests.active.some((a) => a.id === 'rf_visit'), 'the visit counted');
});

test('«Плыть» for a step done in the very port she lies in does it there (not «cast off and put in again»)', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Here Hild');
  const port = s.ship!.docked!;
  give(game, s, 'rf_here', port, [{ type: 'visit', port, text: 'Ask on the quays.' }, { type: 'visit', port: 'saltmarrow', text: 'Then on.' }]);
  c.inbox.length = 0;
  c.push({ t: 'goto', key: 'q:rf_here' });
  assert.equal(s.ship!.docked, port, 'she stays in port');
  assert.equal(s.profile!.quests.active.find((a) => a.id === 'rf_here')?.step, 1, 'the step is done here');
  assert.ok(!c.all('toast').some((m) => m.msg === ROUTE_WORDS.again));
});

test('the run survives the cast off, and an all-stop never leaves «Плыть» dead: pressed again, she sails', () => {
  const { game } = makeGame();
  const { s, c } = captain(game, 'Stop Stina');
  const ship = s.ship!;
  const home = game.portById(ship.docked!)!;
  const to = game.world.ports.filter((p) => p.id !== home.id && !p.raft).sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y))[0];
  give(game, s, 'rf_stop', home.id, [{ type: 'visit', port: to.id, text: 'Sail there.' }]);
  c.push({ t: 'goto', key: 'q:rf_stop' });
  // her phone keeps sending its helm, a sail step among it (the beat of an idle helm): the run is not taken from her
  for (let k = 0; k < 20 * 10; k++) {
    if (k % 5 === 0) c.push({ t: 'input', rudder: 0, sail: 2, seq: k } as never);
    steps(game, 1);
  }
  assert.ok(routeOf(game, s), 'the run is on after the cast off');
  assert.ok(autosailOf(ship), 'the helmsman still has her');
  // a card, a battle's end: everything stops
  allStop(game, s, 'card', 'test');
  assert.equal(routeOf(game, s), null);
  assert.equal(autosailOf(ship), null);
  steps(game, 21); // (the tap's own second gone)
  // the old sail step is held off (sailHold) — «Плыть» again sails her all the same
  c.push({ t: 'input', rudder: 0, sail: 2, seq: 999 } as never);
  c.push({ t: 'goto', key: 'q:rf_stop' });
  steps(game, 2);
  assert.ok(routeOf(game, s), 'the run is on again');
  assert.ok(autosailOf(ship), 'and the helmsman has her');
  assert.equal(s.sailHold, null, 'the hold is let go');
});
