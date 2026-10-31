// Forum post 40 (2026-10-31, a desk player): «БОЙ — НАГЛУХО СЛОМАНО ВСЁ, кроме ручного боя».
//  1. a pirate left with a drop of hull strikes; «Позже» on the card and she was out of reach of every button — now
//     «Атаковать» (or «Огонь» at her) puts her surrender aside and the guns sink her;
//  2. «Атаковать» keeps the gunnery distance and shoots (outside the grapples' 100 m), «Сближение» closes, «На выстрел»
//     opens out again, «На абордаж» throws the grapples — never the helmsman by himself;
//  3. the autopilot sailed at the hull's top speed against the wind with torn sails (the boarding run's +70 % way and its
//     own wind) — now it sails by the wind and the canvas as her own hand does;
//  4. the beasts: «Огонь» fires at a beast by hand (whichever biting her bears), the autobattle takes only its mark's
//     pack or a beast biting her (never the quiet sea round her) and breaks off below a quarter of the hull, and a
//     beast's teeth never leave her rudder past steering.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_OFFER, hullOf, hullsGap } from '../shared/src/data/reach.ts';
import type { ServerMsg } from '../shared/src/protocol.ts';
import { headingVec } from '../shared/src/math.ts';
import { targetSpeed } from '../shared/src/sim/sailing.ts';
import { BEAST_RUDDER_FLOOR, COIL_WARD, spawnBeast, stepBeasts } from '../server/src/game/beasts.ts';
import { engage } from '../server/src/game/npc.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { BEAST_BREAK_OFF, SURRENDER_REFUSED, aimedVolley, pursuitOf, startPursuit } from '../server/src/game/pursuit.ts';
import { struck } from '../server/src/game/struck.ts';
import { buildActs } from '../client/src/ui/actbar.ts';
import { setLang } from '../client/src/i18n.ts';
import { RU as SFRU } from '../client/src/lang/ui/seafight.ts';
import { RU as HUDRU } from '../client/src/lang/ui/seahud.ts';
import { serverText } from '../client/src/lang/server.ts';
import { duelSea, openWater, putSide } from './balance/duel.ts';
import { seaCaptain } from './balance/seafight.ts';
import type { FakeConn } from './helpers.ts';

const conn = (s: PlayerSession) => s.conn as unknown as FakeConn;
const pursuitMsgs = (s: PlayerSession) => conn(s).inbox.filter((m): m is Extract<ServerMsg, { t: 'pursuit' }> => m.t === 'pursuit');

test('forum 40 · the autopilot sails by the wind and her canvas: torn sails, her mark dead to windward — never faster than her own hand could make her', () => {
  const game = duelSea();
  const at = openWater(game, 21);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const me = s.ship!;
  me.sails = me.stats.sailHpMax * 0.15; // «паруса почти в ноль»
  const wind = game.windFor(me);
  const up = headingVec(wind.dir + Math.PI); // where the wind comes from
  const foe = putSide(game, { cls: 'brig', level: 5, craft: 'idle' }, at.x + up.x * 1100, at.y + up.y * 1100, 0).ship;
  foe.input = { rudder: 0, sailTarget: 0 };
  // The most her own hand could get out of her: full sail on the best heading there is, by the same physics.
  const cap = (): number => {
    let best = 0;
    for (const night of [false, true]) {
      const p = me.sailParams(night, game.now);
      assert.equal(p.personalWind, false, 'no wind of her own');
      for (let h = 0; h < Math.PI * 2; h += Math.PI / 90) best = Math.max(best, targetSpeed({ ...me.state, heading: h, sail: 1 }, p, game.windFor(me)));
    }
    return best;
  };
  for (const mode of ['board', 'guns'] as const) {
    me.state = { ...me.state, x: at.x, y: at.y, speed: 0, sail: 0 };
    me.sails = me.stats.sailHpMax * 0.15;
    game.grid.upsert(me.id, me.state.x, me.state.y);
    assert.equal(startPursuit(game, s, foe.id, mode), null);
    let top = 0, over = 0;
    for (let i = 0; i < 20 * 45; i++) {
      game.step();
      me.sails = me.stats.sailHpMax * 0.15; // (no carpenters at sea mid-test)
      top = Math.max(top, me.state.speed);
      over = Math.max(over, me.state.speed - cap());
    }
    assert.ok(over <= 0.05, `${mode}: ${top.toFixed(2)} over her best by her own hand (${cap().toFixed(2)})`);
    assert.ok(top < me.stats.maxSpeed * 0.75, `${mode}: ${top.toFixed(2)} of the hull's ${me.stats.maxSpeed.toFixed(2)} with rags for sails`);
  }
});

test('forum 40 · a pirate struck with a drop of hull, her card put off («Позже»): «Атаковать» puts the surrender aside and the guns sink her', () => {
  const game = duelSea();
  const at = openWater(game, 22);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const me = s.ship!;
  const B = putSide(game, { cls: 'brig', level: 5, craft: 'idle' }, at.x + 200, at.y, 0);
  const foe = B.ship;
  foe.npcRole = 'pirate';
  B.brain.role = 'pirate';
  foe.hull = foe.stats.hullMax * 0.04;
  foe.attackers.set(me.id, game.now);
  struck(game, foe, B.brain, me);
  assert.ok(foe.surrendered);
  assert.ok(conn(s).last('surrender_offer')?.offer, 'the card');
  // «Позже»: the card hidden (client only); she lies struck. «Атаковать» on her:
  assert.equal(startPursuit(game, s, foe.id, 'guns'), null);
  assert.equal(foe.surrendered, false, 'her surrender put aside');
  assert.equal(conn(s).last('surrender_offer')?.offer, null, 'the card closes');
  assert.ok(conn(s).inbox.some((m) => m.t === 'toast' && m.msg === SURRENDER_REFUSED), 'said why');
  let secs = 0;
  for (; secs < 45 && foe.alive && !foe.sinkingUntil; secs += 0.05) game.step();
  assert.ok(!foe.alive || foe.sinkingUntil, `sunk by the guns (${secs.toFixed(1)} s)`);
  assert.ok(!me.grapple && !me.boarding, 'never boarded by the helmsman');
  setLang('ru');
  assert.notEqual(serverText(SURRENDER_REFUSED), SURRENDER_REFUSED, 'in Russian');
  setLang('en');
});

test('forum 40 · «Огонь» at a ship lying struck: her surrender put aside, the broadside fires', () => {
  const game = duelSea();
  const at = openWater(game, 23);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const me = s.ship!;
  const B = putSide(game, { cls: 'brig', level: 5, craft: 'idle' }, at.x + 150, at.y, 0);
  B.ship.npcRole = 'pirate';
  B.ship.attackers.set(me.id, game.now);
  struck(game, B.ship, B.brain, me);
  me.reload.port = me.reload.starboard = 0;
  assert.equal(aimedVolley(game, s, B.ship.id), null);
  assert.equal(B.ship.surrendered, false);
  assert.ok(me.reload.starboard > 0, 'the starboard broadside went');
});

test('forum 40 · «Атаковать» (the guns) keeps her outside the grapples: no run in, no grapples of the helmsman\'s, her mark held beyond 100 m', () => {
  const game = duelSea();
  const at = openWater(game, 24);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const me = s.ship!;
  const B = putSide(game, { cls: 'brig', level: 5, craft: 'bot' }, at.x + 700, at.y, Math.PI);
  B.brain.role = 'hunter';
  me.lastStandUntil = Infinity;
  assert.equal(startPursuit(game, s, B.ship.id, 'guns'), null);
  const gaps: number[] = [];
  let next = 0;
  for (let i = 0; i < 20 * 90 && B.ship.alive && me.alive; i++) {
    if (game.now >= next) {
      next = game.now + 0.5;
      engage(game, B.ship, B.brain, me, Math.hypot(me.state.x - B.ship.state.x, me.state.y - B.ship.state.y));
    }
    game.step();
    assert.ok(!me.hasEffect('board_run'), 'no boarding run under «Атаковать»');
    assert.ok(!me.grapple?.attacker && !me.boarding, 'the helmsman never throws the grapples');
    if (i > 20 * 25 && i % 10 === 0) gaps.push(hullsGap(hullOf(me), hullOf(B.ship)));
  }
  gaps.sort((a, b) => a - b);
  const med = gaps[Math.floor(gaps.length / 2)];
  assert.ok(med > BOARD_OFFER, `held ${Math.round(med)} m hull to hull (the grapples reach ${BOARD_OFFER})`);
});

test('forum 40 · the bottom buttons: «Атаковать», then «Сближение» / «На выстрел» by the mode, «Отставить»', () => {
  setLang('ru');
  const guns = buildActs({ attack: { name: 'Red', pursuing: true, mode: 'guns' } });
  assert.deepEqual(guns.map((a) => a.label), [SFRU['a.close'], SFRU['a.stop']]);
  assert.equal(SFRU['a.close'], 'Сближение');
  const board = buildActs({ attack: { name: 'Red', pursuing: true, mode: 'board' } });
  assert.deepEqual(board.map((a) => a.label), [SFRU['a.guns'], SFRU['a.stop']]);
  assert.equal(SFRU['a.guns'], 'На выстрел');
  // alongside on the closing run: «На абордаж» comes up first (the grapples only when pressed)
  const near = buildActs({ board: { name: 'Red' }, attack: { name: 'Red', pursuing: true, mode: 'board' } });
  assert.equal(near[0].id, 'board');
  assert.ok(SFRU['why.hurt'] && HUDRU['tm.sink'] === 'Утопить' && HUDRU['tm.release'] === 'Отпустить');
  setLang('en');
});

test('forum 40 · «Огонь» by hand at the beasts: a shark under her bow does not bear — the broadside goes at the one biting her abeam, and no helmsman\'s run', () => {
  const game = duelSea();
  const at = openWater(game, 25);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const me = s.ship!;
  const ahead = spawnBeast(game, 'shark', at.x, at.y - 70, 5);
  const abeam = spawnBeast(game, 'shark', at.x + 60, at.y, 5);
  me.reload.port = me.reload.starboard = 0;
  assert.equal(aimedVolley(game, s, ahead.id), 'She is not on your beam', 'nothing biting her: said, no run');
  assert.equal(pursuitOf(me), null);
  me.attackers.set(abeam.id, game.now); // it bites her
  assert.equal(aimedVolley(game, s, ahead.id), null);
  assert.ok(me.reload.starboard > 0 && me.reload.port === 0, 'the starboard side fired');
  assert.equal(pursuitOf(me), null, 'the helm is still hers');
});

test('forum 40 · the autobattle on a beast takes only its pack or a beast biting her — the quiet sea round her is left alone; below a quarter of her hull it breaks off', () => {
  const game = duelSea();
  const at = openWater(game, 26);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const me = s.ship!;
  const mark = spawnBeast(game, 'shark', at.x + 150, at.y, 3);
  const quiet = spawnBeast(game, 'shark', at.x - 500, at.y, 3);
  assert.equal(startPursuit(game, s, mark.id, 'board'), null);
  assert.equal(pursuitOf(me)?.mode, 'guns');
  mark.hull = 0;
  game.beginSinking(mark);
  game.step();
  assert.equal(pursuitOf(me), null, 'her mark gone: the wheel back — not a run on the quiet one');
  assert.ok(!quiet.attackers.has(me.id));
  // one biting her is the next mark
  const mark2 = spawnBeast(game, 'shark', at.x + 150, at.y, 3);
  const biter = spawnBeast(game, 'shark', at.x, at.y + 200, 3);
  assert.equal(startPursuit(game, s, mark2.id, 'guns'), null);
  me.attackers.set(biter.id, game.now);
  mark2.hull = 0;
  game.beginSinking(mark2);
  game.step();
  assert.equal(pursuitOf(me)?.target, biter.id, 'the shark biting her is next');
  // her hull below a quarter: the helmsman breaks off
  me.hull = me.stats.hullMax * (BEAST_BREAK_OFF - 0.02);
  game.step();
  assert.equal(pursuitOf(me), null);
  assert.equal(pursuitMsgs(s).at(-1)?.why, 'hurt');
});

test('forum 40 · a beast\'s teeth never take her rudder past steering, and a serpent\'s coils let her sail clear', () => {
  const game = duelSea();
  const at = openWater(game, 27);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const me = s.ship!;
  for (let k = 0; k < 4; k++) spawnBeast(game, 'shark', at.x + 30 * Math.cos(k), at.y + 30 * Math.sin(k), 5);
  for (let k = 0; k < 3; k++) spawnBeast(game, 'orca', at.x - 40, at.y + 20 * k, 5);
  const serpent = spawnBeast(game, 'young_serpent', at.x + 40, at.y + 40, 5);
  let least = 1, coiledAt = -1, freedAt = -Infinity, recoil = Infinity;
  for (let t = 0; t < 180; t += 0.05) {
    me.hull = me.stats.hullMax; // (she does not sink in this test: the beasts keep at her)
    me.state.speed = 0;
    stepBeasts(game, 0.05);
    game.now += 0.05;
    least = Math.min(least, me.rudderHp);
    const coiled = me.hasEffect('coiled');
    if (coiled && coiledAt < 0) {
      coiledAt = game.now;
      if (Number.isFinite(freedAt)) recoil = Math.min(recoil, game.now - freedAt);
    }
    if (!coiled && coiledAt >= 0) {
      coiledAt = -1;
      freedAt = game.now;
    }
  }
  assert.ok(least >= BEAST_RUDDER_FLOOR - 1e-9, `her rudder ${least.toFixed(2)}`);
  assert.ok(Number.isFinite(freedAt), 'the serpent coiled and let go');
  assert.ok(recoil >= COIL_WARD - 0.1, `coiled again ${recoil.toFixed(1)} s after it let go`);
  void serpent;
});
