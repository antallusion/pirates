// VK moderation 4.1.6.4 (2026-11-18): «Кривая сложности недостаточно проработана… после обучения первый уровень довольно
// сложный, его не получается пройти с первого раза». The gentle start, locked: the newcomer's first stretch (the First
// Watch's raider and the campaign's first chapter) is won at the first try by a captain who plays it at no skill; the
// opening's stack and the first lair are ones her party beats; her first battles are tutored (a turn let run out is played
// by her crew, the quick battle free); and no predator nor stronger pirate of the sea falls on her in her first quarter of
// an hour. The canon ladder for the rest is untouched (tests/balance/*).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstStretch } from './balance/firststretch.ts';
import { TUTOR_LEVEL, tutored } from '../server/src/game/firstfights.ts';
import { tutorSide } from '../server/src/game/tactical.ts';
import { NEUTRAL_EASY, routeFor } from '../server/src/game/goalroute.ts';
import { campaignActive, campaignNext, noviceLairOdds, NOVICE_LAIR_ODDS } from '../server/src/game/campaign.ts';
import { roamersAbout, roamRatio, roamWhere } from '../server/src/game/roamers.ts';
import { lairBeach, lairList } from '../server/src/game/beastlairs.ts';
import { noviceSpared } from '../server/src/game/npc.ts';
import { newBattle, stepBattle, LESSON_TURN } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { FRESH_SECS } from '../server/src/game/onboarding.ts';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { Rng } from '../shared/src/rng.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import type { Game } from '../server/src/game/Game.ts';

function newcomer(game: Game, name: string) {
  const c = new FakeConn();
  game.attach(c as unknown as WsConnection);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'First Wake', tutorial: true });
  return game.sessionByName(name)!;
}

test('a fresh captain wins the First Watch and every fight of the first chapter at the first try, at no skill', () => {
  // (the measure: tools/balance-firststretch.ts; the battles by the quick battle, her side at a human's skill — none)
  const fights = firstStretch(101, 17);
  const rows = fights.map((f) => `${f.quest} ${f.kind} L${f.level}: ${f.foe} ${f.won ? 'won' : 'LOST'}`);
  console.log(rows.join('\n'));
  assert.ok(fights.length >= 7, `the stretch's fights: ${fights.length}`);
  assert.deepEqual(fights.slice(0, 3).map((f) => f.won), [true, true, true], 'the first three');
  const won = fights.filter((f) => f.won).length;
  assert.ok(won / fights.length >= 0.9, `${won}/${fights.length} won at the first try`);
  // one mechanic at a time: the watch's boarding, then guns, then a boarding, then creatures, then a lair
  assert.deepEqual(fights.slice(0, 5).map((f) => f.kind), ['watch', 'sink', 'board', 'neutral', 'board']);
});

test('«Твари на отмели»: «Плыть» marks a stack her party clearly beats, never the ⚓2 barracudas on the lane', () => {
  const { game } = makeGame();
  join(game, 'Shoal Opener');
  const s = game.sessionByName('Shoal Opener')!;
  const p = s.profile!;
  p.campaign!.at = 3;
  p.quests.active = [];
  campaignNext(game, s);
  assert.equal(campaignActive(p)?.id, 'c01_04');
  const lane = (QUESTS_BY_ID.c01_04.steps[0] as { near: { x: number; y: number; r: number } }).near;
  // from every side of the lane, and from beside its strongest stack
  const about = roamersAbout(game, lane.x, lane.y, lane.r).map((sp) => ({ sp, w: roamWhere(game, sp), ratio: roamRatio(game, s, sp) }));
  const strong = about.filter((x) => x.ratio < 1);
  assert.ok(strong.length, 'the lane has stacks she would lose to (the test means something)');
  const from = [...strong.map((x) => ({ x: x.w.x + 40, y: x.w.y })), ...[0, 1, 2, 3].map((k) => ({ x: lane.x + Math.sin(k * 1.57) * 1200, y: lane.y - Math.cos(k * 1.57) * 1200 }))];
  for (const at of from) {
    s.ship!.docked = null;
    s.ship!.state = { ...s.ship!.state, x: at.x, y: at.y };
    game.grid.upsert(s.ship!.id, at.x, at.y);
    const r = routeFor(game, s, 'q:c01_04');
    assert.ok('x' in r, 'a mark');
    const sp = about.sort((a, b) => Math.hypot(a.w.x - r.x, a.w.y - r.y) - Math.hypot(b.w.x - r.x, b.w.y - r.y))[0];
    assert.ok(sp.ratio >= NEUTRAL_EASY, `from ${Math.round(at.x)},${Math.round(at.y)}: ${sp.sp.kind} ⚓${sp.sp.level} ×${sp.ratio.toFixed(2)}`);
  }
});

test('the first chapters’ lair: one a newcomer’s party beats nine times in ten', () => {
  const { game } = makeGame();
  join(game, 'Dune Opener');
  const s = game.sessionByName('Dune Opener')!;
  const p = s.profile!;
  p.campaign!.at = QUESTS_BY_ID.c01_16.campaign!.slot;
  p.quests.active = [];
  p.level = 3;
  campaignNext(game, s);
  assert.equal(campaignActive(p)?.id, 'c01_16');
  const t = game.questTargets(s).c01_16;
  const l = lairList(game).map((x) => ({ x, b: lairBeach(game, x) })).sort((a, b) => Math.hypot(a.b.x - t.x, a.b.y - t.y) - Math.hypot(b.b.x - t.x, b.b.y - t.y))[0].x;
  const odds = noviceLairOdds({ kind: l.kind, level: l.level, size: l.size, type: l.type });
  assert.ok(odds >= NOVICE_LAIR_ODDS, `${l.kind} ⚓${l.level} ${l.size}: ${Math.round(odds * 100)}%`);
  // (Ravencliff's seal rookery, the nearest to Saltmarrow: the newcomer's party loses it — never the first chapter's)
  const rookery = lairList(game).find((x) => x.kind === 'seal_rookery' && x.level === 1 && x.size === 'strong');
  if (rookery) assert.ok(noviceLairOdds({ kind: rookery.kind, level: rookery.level, size: rookery.size, type: rookery.type }) < NOVICE_LAIR_ODDS);
});

test('her first battles are tutored: the quick battle free, a turn she lets run out played by her crew', () => {
  const { game } = makeGame();
  const s = newcomer(game, 'Tutored One');
  const p = s.profile!;
  assert.equal(tutored(s), false, 'not in the First Watch (its fight is the lesson)');
  p.tutorial.on = false;
  p.tutorial.stage = 5;
  assert.equal(tutored(s), true, 'after it');
  p.tutorial.easy = 3;
  p.tutorial.played = FRESH_SECS;
  p.level = TUTOR_LEVEL;
  assert.equal(tutored(s), true, 'on the ladder up to the first chapter’s level');
  p.level = TUTOR_LEVEL + 1;
  assert.equal(tutored(s), false, 'past it: the battles as the sea fights them');
  p.level = 2;
  const foe = game.spawnNpcShip('pirate', 'sloop', 'confederacy', s.ship!.state.x + 30, s.ship!.state.y, 0);
  assert.equal(tutorSide(game, s.ship!, foe), 0);
  assert.equal(tutorSide(game, foe, s.ship!), 1);
  // a captain of before the ladder (an old hand) is never tutored; one made now who said «I know the sea» is, up to the
  // first chapter's level (the free quick battle and her crew on a turn let run out take nothing from her)
  join(game, 'Old Salt Hand');
  const old = game.sessionByName('Old Salt Hand')!;
  assert.equal(tutored(old), true);
  old.profile!.tutorial.ladder = undefined;
  assert.equal(tutored(old), false);
  // the clock: her turn run out, her crew plays it (not a defence)
  const side = (human: boolean): TacSideInput => ({ name: human ? 'Her' : 'Sea', ship: 'X', captain: human ? 'corsair' : null, hands: 0, marines: 0, gunners: 0, army: [{ u: 'deckhand', n: 20, src: 'deckhand' }], officers: [], skill: 3, morale: 70, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human });
  for (const tutor of [false, true]) {
    const rng = new Rng(7);
    const bt = newBattle(side(true), side(false), 7, 0, rng, {});
    if (tutor) bt.tutor = 0;
    let now = 0, crew = 0, defends = 0;
    for (let i = 0; i < 400 && !bt.over; i++) {
      now += 1;
      const before = bt.log.length;
      stepBattle(bt, now, rng);
      for (const e of bt.log.slice(before) as { k: string; id?: string; side?: number }[]) if (e.k === 'timeout' && e.side === 0) (e.id === 'crew' ? crew++ : defends++);
    }
    if (tutor) {
      assert.ok(crew > 0 && defends === 0, `tutored: her crew played ${crew} turns, ${defends} defended`);
      assert.equal(bt.over?.winner, 0, 'and won the even fight');
    } else assert.ok(defends > 0 && crew === 0, 'untutored: a turn run out is a defence');
  }
  assert.ok(LESSON_TURN <= 12);
});

test('no ambush in her first quarter of an hour: a predator or a stronger pirate of the sea leaves a newcomer be until she fires', () => {
  const { game } = makeGame();
  const s = newcomer(game, 'Spared One');
  const p = s.profile!;
  p.tutorial.on = false;
  p.tutorial.stage = 5;
  p.tutorial.played = 60;
  const me = s.ship!;
  me.docked = null;
  const pirate = game.spawnNpcShip('pirate', 'brig', 'confederacy', me.state.x + 400, me.state.y, 0);
  game.setNpcLevel(pirate, 4);
  const even = game.spawnNpcShip('pirate', 'sloop', 'confederacy', me.state.x - 400, me.state.y, 0);
  game.setNpcLevel(even, 1);
  assert.equal(noviceSpared(game, pirate, me), true, 'a ⚓4 pirate of the sea');
  assert.equal(noviceSpared(game, even, me), false, 'one of her own level: a fair fight, softened (firstfights.ts)');
  pirate.attackers.set(me.id, game.now);
  assert.equal(noviceSpared(game, pirate, me), false, 'she fired on it: it answers');
  pirate.attackers.clear();
  p.tutorial.played = FRESH_SECS;
  assert.equal(noviceSpared(game, pirate, me), false, 'past her first quarter of an hour: the sea as it is');
  steps(game, 1);
});
