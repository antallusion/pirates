// The season's trials and the world's events sailed to (forum 2026-11-07, Эдуард; the owner: «при нажатии на задания
// надо модалку открывать где все написано и может даже автодобраться»): the route keys `ch:<challenge>` (a trial's
// nearest place), `cr` (the nearest fight with the sea's creatures: a lair's beach, a roaming stack, a drift of hers)
// and `hunt` (a boss, a great one ashore, a world event's squadron, the Choir).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGES } from '../shared/src/data/seasonpass.ts';
import { GOAL_KEYS, ROUTE_HINTS, ROUTE_WORDS, resolveGoal, routeFor } from '../server/src/game/goalroute.ts';
import { passState } from '../server/src/game/seasonpass.ts';
import { join, makeGame } from './helpers.ts';

const T1 = Date.UTC(2026, 10, 10, 12);

function aboard(name: string) {
  const { game } = makeGame();
  game.wallNow = () => T1;
  join(game, name);
  const s = game.sessionByName(name)!;
  s.ship!.docked = null;
  return { game, s };
}

test('the new keys are goal keys', () => {
  for (const k of ['ch', 'cr', 'hunt']) assert.ok((GOAL_KEYS as readonly string[]).includes(k), k);
});

test('«cr»: the nearest creature fight — lairs ashore by their beach, roaming stacks at sea', () => {
  const { game, s } = aboard('Lair Lena');
  const r = resolveGoal(game, s, 'cr');
  assert.ok('cands' in r, JSON.stringify(r));
  assert.ok(r.cands.some((c) => c.kind === 'lair' && c.hint === ROUTE_HINTS.lair), 'a lair');
  const v = routeFor(game, s, 'cr');
  assert.ok('x' in v, JSON.stringify(v));
});

test('«hunt»: nothing up — the words say where to learn of one; a world event\'s squadron — her ships', () => {
  const { game, s } = aboard('Hunt Hedda');
  for (const f of [...game.bosses.fights.keys()]) game.bosses.fights.delete(f);
  game.zoneBosses.live.clear();
  game.worldEvents.fleets.clear();
  const none = resolveGoal(game, s, 'hunt');
  if (!('cands' in none)) assert.deepEqual(none, { none: ROUTE_WORDS.noHunt });
  const o = game.spawnNpcShip('crown', 'sloop', 'crown', s.ship!.state.x + 900, s.ship!.state.y, 0);
  game.worldEvents.fleets.set(4242, [o.id]);
  const r = resolveGoal(game, s, 'hunt');
  assert.ok('cands' in r);
  assert.ok(r.cands.some((c) => c.ship === o.id && c.name === 'event'));
});

test('«ch:<trial>»: a boarding trial — ships to board; a creature trial — creatures; the orders\' chest — not at sea; done — done', () => {
  const { game, s } = aboard('Trial Tove');
  const b = resolveGoal(game, s, 'ch:d_board');
  assert.ok('cands' in b || ('none' in b && b.none === ROUTE_WORDS.none), JSON.stringify(b));
  const l = resolveGoal(game, s, 'ch:w_lair');
  assert.ok('cands' in l && l.cands.length > 0);
  assert.deepEqual(resolveGoal(game, s, 'ch:d_orders'), { none: ROUTE_WORDS.noPlace });
  assert.deepEqual(resolveGoal(game, s, 'ch:nope'), { none: ROUTE_WORDS.unknown });
  const st = passState(game, s.accountId);
  st.wch = { at: st.wch?.at ?? 0, ids: ['w_lair', 'w_board', 'w_boss', 'w_pvp'], prog: [15, 0, 0, 0], done: [true, false, false, false] };
  game.db.setKv(`spass:${s.accountId}`, st);
  assert.deepEqual(resolveGoal(game, s, 'ch:w_lair'), { done: true });
  // every trial resolves to something (never a throw)
  for (const c of CHALLENGES) resolveGoal(game, s, `ch:${c.id}`);
});
