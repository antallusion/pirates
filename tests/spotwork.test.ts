// The work at a spot (owner, 2026-11-02: «надо сделать какой-то обратный отсчёт до квестов, где надо доплыть и что-то
// сделать, типа с водолазами … показывай таймер с обратным отсчётом и зафиксируй корабль … ещё типа пройтись по
// острову тоже не получается сразу»): the countdown's end sent, the ship held at anchor, the helm's abort, the landing
// begun on arrival with no wait; the pill's and the effects' row's words.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { abortSpot, spotOf } from '../server/src/game/spotwork.ts';
import { canDive } from '../server/src/game/explorefx.ts';
import { findLandable } from '../server/src/game/exploration.ts';
import { findBusy, putFind } from '../server/src/game/seafinds.ts';
import { approachOf } from '../server/src/game/approach.ts';
import { WAY_WORDS } from '../server/src/game/underfire.ts';
import type { SpotView } from '../shared/src/data/spotwork.ts';
import { spotClock, spotPhase } from '../shared/src/data/spotwork.ts';
import { SAIL_STEPS } from '../shared/src/constants.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { spotLine } from '../client/src/ui/spotclock.ts';
import { fxList } from '../client/src/ui/fxrow.ts';
import { EN as SPOT_EN, RU as SPOT_RU } from '../client/src/lang/ui/spot.ts';
import { SERVER_RU_SPOT } from '../client/src/lang/server.ru.spot.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, offCoast, steps } from './helpers.ts';

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name, 'navigator');
  const s = game.sessionByName(name)!;
  s.profile!.level = 30;
  s.profile!.gold = 1e5;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.protectedUntil = 0;
  ship.lastCombat = -1000;
  return { c, s };
}

/** Puts her at a point with way on her and her canvas set. */
function at(game: Game, s: PlayerSession, x: number, y: number, speed = 0, sail = 0): void {
  const ship = s.ship!;
  ship.state = { ...ship.state, x, y, speed, sail };
  ship.input = { rudder: 0, sailTarget: sail };
  game.grid.upsert(ship.id, x, y);
}

/** A wreck in her divers' reach (8 m), and her over it at full sail. */
function overWreck(game: Game, s: PlayerSession, speed = 7): number {
  const w = game.wrecks.find((x) => x.depth <= 8 && canDive(game, s, x) === null)!;
  assert.ok(w, 'a shallow wreck');
  at(game, s, w.x, w.y, speed, 1);
  return w.id;
}

/** The phone's helm (its sail step and wheel), as main.ts sends it. */
let seq = 1;
const helm = (c: FakeConn, sail: number, rudder = 0, hand = false) => c.push({ t: 'input', seq: seq++, rudder, sail, ...(hand ? { helm: true } : {}) });
const toasts = (c: FakeConn) => c.all('toast').map((m) => m.msg);
/** The glide to a stop when the work begins (SPOT_BRAKE_SEC, owner 2026-11-02: «2–3 секунды»): ~3 s of the sea. */
const glide = (game: Game) => { for (let i = 0; i < 3 * 20; i++) game.step(); };
const lastSpot = (c: FakeConn): SpotView | null | undefined => c.last('self')?.self.spot;

test('the divers: the countdown\'s end is sent at once, and she is brought up and held at anchor until they surface', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Diver Dora');
  const ship = s.ship!;
  helm(c, SAIL_STEPS.length - 1); // her phone at full sail
  overWreck(game, s, 7);
  const t0 = game.now;
  c.push({ t: 'land' });
  assert.equal(ship.landing?.feature, 'dive', 'the divers go down at once — no «heave to first», no wait for her way');
  assert.ok(ship.state.speed > 0, 'she glides on: not dead in the water at once');
  const v = lastSpot(c);
  assert.ok(v, 'the countdown is sent with the order');
  assert.equal(v!.kind, 'dive');
  assert.equal(v!.started, t0);
  assert.equal(v!.until, ship.landing!.until, 'its end on the sea\'s clock');
  assert.equal(Math.round(v!.until - v!.started), 25);
  assert.deepEqual(spotOf(game, s), v);
  assert.ok(!toasts(c).some((m) => WAY_WORDS.has(m)), 'nothing waits for her way');
  glide(game);
  assert.equal(ship.state.speed, 0, 'the anchor brings her up after a short glide');
  const x0 = ship.state.x, y0 = ship.state.y, h0 = ship.state.heading;
  // Held: wind and current, her phone still sending its old sail — she does not move, turn or set canvas.
  for (let i = 0; i < 20; i++) {
    helm(c, SAIL_STEPS.length - 1);
    steps(game, 10);
  }
  assert.ok(ship.landing, 'still down after 10 s');
  assert.ok(Math.hypot(ship.state.x - x0, ship.state.y - y0) < 0.01, 'not a metre of drift');
  assert.equal(ship.state.heading, h0, 'her head kept');
  assert.equal(ship.state.speed, 0);
  assert.ok(ship.state.sail < 0.01, 'her sails furled');
  assert.equal(spotPhase(v!, game.now), 'search', 'ten seconds in: searching the bottom');
  steps(game, 20 * 16);
  assert.equal(ship.landing, null, 'up');
  assert.equal(spotOf(game, s), null);
  assert.equal(ship.spotHold, false, 'let go');
  assert.equal(lastSpot(c), null, 'the countdown taken down');
  assert.ok(toasts(c).some((m) => /The divers come up from the/.test(m)), 'the result in a toast');
});

test('her own hand calls them back: a sail set before halfway brings nothing (and costs nobody); after it, half', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Hasty Hal');
  const ship = s.ship!;
  helm(c, 3);
  overWreck(game, s, 5);
  c.push({ t: 'land' });
  assert.ok(ship.landing);
  steps(game, 20 * 5);
  const crew = ship.crew, gold = s.profile!.gold;
  helm(c, 0); // (her phone's sail put down by the stop)
  helm(c, 2); // …and set again by her hand
  assert.equal(ship.landing, null, 'called back at once');
  assert.equal(ship.spotHold, false, 'she sails');
  assert.ok(ship.input.sailTarget > 0, 'under her canvas');
  assert.ok(toasts(c).includes('The divers are hauled up early: nothing brought up.'));
  assert.equal(ship.crew, crew, 'nobody lost');
  assert.equal(s.profile!.gold, gold, 'nothing brought up');
  steps(game, 20 * 3);
  assert.ok(ship.state.speed > 0, 'under way');

  // After halfway, by the wheel (her hand on it, put hard over): half the haul.
  const { game: g2 } = makeGame();
  const b = captain(g2, 'Patient Pat');
  helm(b.c, 0);
  overWreck(g2, b.s, 0);
  b.c.push({ t: 'land' });
  steps(g2, 20 * 14);
  const g0 = b.s.profile!.gold;
  helm(b.c, 0, 1, true);
  assert.equal(b.s.ship!.landing, null, 'the wheel put over calls them back');
  assert.ok(toasts(b.c).includes('Called back past halfway: half the haul.'));
  assert.ok(b.s.profile!.gold > g0, 'half the silver');

  // «Прервать» on the countdown.
  const { game: g3 } = makeGame();
  const d = captain(g3, 'Button Bea');
  overWreck(g3, d.s, 0);
  d.c.push({ t: 'land' });
  assert.ok(d.s.ship!.landing);
  d.c.push({ t: 'spot', action: 'abort' });
  assert.equal(d.s.ship!.landing, null);
  assert.equal(abortSpot(g3, d.s), false, 'nothing left to call off');
  // A brush of the stick (no hand on it, a little rudder) is no abort.
  overWreck(g3, d.s, 0);
  d.s.profile!.explore.dived = {};
  d.c.push({ t: 'land' });
  assert.ok(d.s.ship!.landing);
  helm(d.c, 0, 0.2, true);
  helm(d.c, 0, 0.9);
  assert.ok(d.s.ship!.landing, 'still down');
});

test('a walk across the island: the landing begins the moment she is in reach — no heave-to, no wait for her way', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Walker Wynn');
  const ship = s.ship!;
  const is = game.world.islands.find((i) => !i.portId && i.radius > 250 && i.radius < 600 && offCoast(game, ship, i))!;
  assert.ok(is, 'an island to land on');
  assert.ok(findLandable(game, s), 'something ashore in reach');
  helm(c, SAIL_STEPS.length - 1);
  ship.state.speed = 8;
  ship.state.sail = 1;
  ship.input = { rudder: 0, sailTarget: 1 };
  const from = c.inbox.length;
  c.push({ t: 'land' });
  assert.ok(ship.landing, 'the boats away at once at 8 m/s');
  glide(game);
  assert.equal(ship.state.speed, 0, 'brought up after a short glide');
  assert.equal(s.whenClear, null, 'nothing held for her way');
  const said = c.inbox.slice(from).filter((m) => m.t === 'toast').map((m) => (m as { msg: string }).msg);
  assert.ok(!said.some((m) => WAY_WORDS.has(m) || /Heave to/.test(m)), `no heave-to (${JSON.stringify(said)})`);
  assert.ok(game.now - (lastSpot(c)?.started ?? 0) < 3.5, 'its countdown from the order');
});

test('sailed in to a beach a cable off: the boats go the moment she is within reach, at whatever way she has', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Beach Bo');
  const ship = s.ship!;
  const is = game.world.islands.find((i) => !i.portId && i.radius > 250 && i.radius < 600 && offCoast(game, ship, i, 160))!;
  assert.ok(is && !findLandable(game, s), 'a cable off her beach');
  c.push({ t: 'land' });
  assert.ok(approachOf(game, s), 'the helmsman takes her in');
  let inReach = -1, landed = -1;
  for (let i = 0; i < 20 * 120 && landed < 0; i++) {
    game.step();
    if (inReach < 0 && findLandable(game, s)) inReach = game.now;
    if (ship.landing) landed = game.now;
  }
  assert.ok(landed >= 0, 'landed');
  assert.ok(landed - inReach <= 1.05, `begun on arrival (in reach at ${inReach.toFixed(2)}, landed at ${landed.toFixed(2)})`);
  glide(game);
  assert.equal(ship.state.speed, 0, 'and held');
});

test('the boats at a small find: begun at way, held, a sail set calls them back with nothing', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Finder Flo');
  const ship = s.ship!;
  at(game, s, 30000, 80000, 6, 1);
  const f = putFind(game, s, 'calm', { x: ship.state.x + 10, y: ship.state.y })!;
  assert.ok(f);
  c.push({ t: 'seafind', action: 'work', id: f.id });
  assert.ok(findBusy(game, s), 'the boats away at once');
  // (her glide to a stop is the divers' and the landings' tests: a calm find is done before she has stopped)
  assert.equal(spotOf(game, s)?.kind, 'find');
  assert.equal(lastSpot(c)?.kind, 'find', 'its countdown sent');
  helm(c, 0);
  helm(c, 3);
  assert.equal(findBusy(game, s), null, 'called back');
  assert.ok(toasts(c).includes('The boats are called back: she made sail.'));
});

test('the countdown in her words: the pill\'s line and the effects\' row, every line in Russian', () => {
  const v: SpotView = { kind: 'dive', started: 100, until: 125, fireBreaks: true };
  setLang('ru');
  try {
    assert.equal(spotLine(v, 100), 'Водолазы на дне · спуск · 0:25');
    assert.equal(spotLine(v, 108), 'Водолазы на дне · поиск на дне · 0:17');
    assert.equal(spotLine(v, 122), 'Водолазы на дне · всплытие · 0:03');
    assert.equal(spotLine({ ...v, kind: 'trek', until: 106 }, 100), 'Высадка на остров · шлюпки на воде · 0:06');
    assert.equal(spotLine({ kind: 'land', started: 0, until: 42, fireBreaks: true }, 0), 'Десант на острове · шлюпки на воде · 0:42');
    assert.equal(spotLine({ kind: 'dig', started: 0, until: 60, fireBreaks: true }, 51), 'Копают клад · гребут назад · 0:09');
    const row = fxList({ self: { captain: 'corsair', effects: [], protectedUntil: 0, wanted: 0, rested: 0, curse: 0, spot: v }, you: null, now: 108, wall: Date.now() });
    assert.equal(row[0].id, 'spot', 'first in the row');
    assert.equal(row[0].n, '0:17', 'its time on the icon');
    assert.equal(row[0].name, 'Водолазы на дне');
    for (const [en, ru] of Object.entries(SERVER_RU_SPOT)) assert.equal(serverText(en).replace(/\s/g, ' '), ru); // (its short words bound by a no-break space)
    for (const k of Object.keys(SPOT_EN) as (keyof typeof SPOT_EN)[]) assert.ok(!/[a-z]{3}/i.test(SPOT_RU[k]), `${k}: in Russian`);
  } finally {
    setLang('en');
  }
  assert.equal(spotClock(65.2), '1:06');
  assert.equal(spotClock(0), '0:00');
});
