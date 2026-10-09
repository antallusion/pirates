// docs/19 E9: the Seals of the Deep — the seal's rules (its afflictions by the week, its rounds, its step), the director
// on the field (the poisoned tide, the shields, the reinforcements, the fury, the limit passed), a mythic depth entered
// at a lair of its kind through the Throne and fought out, the seal moved, the week's table, the card's button and the
// words in Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armyForLevel } from '../shared/src/data/army.ts';
import { MAX_LEVEL } from '../shared/src/constants.ts';
import { landParty } from '../shared/src/data/lairs.ts';
import {
  SEAL_AFFIXES, SEAL_KINDS, SEAL_MAX, SEAL_MIN, fastRounds, sealAffixCount, sealAffixes, sealMight, sealPay, sealRounds, sealStep, weekAffixes,
} from '../shared/src/data/seals.ts';
import { Rng } from '../shared/src/rng.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { closeFight, landFighting, landTac } from '../server/src/game/beastlairs.ts';
import { clearOutposts } from '../server/src/game/estate.ts';
import { direct, sealArmy, sealOf, sealView, startDepth } from '../server/src/game/seals.ts';
import { throneMessage } from '../server/src/game/throne.ts';
import { aiAct, newBattle } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { depthFight } from './balance/seals.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

// ------------------------------------------------------------------ the rules

test('a seal carries the week’s afflictions, one to four by its level; every order of them comes round in 24 weeks', () => {
  const seen = new Set<string>();
  for (let w = 0; w < 24; w++) {
    const a = weekAffixes(w);
    assert.equal(new Set(a).size, 4, 'each affliction once');
    seen.add(a.join(','));
  }
  assert.equal(seen.size, 24, 'every order in turn');
  assert.deepEqual(weekAffixes(3), weekAffixes(27), 'and round again');
  assert.deepEqual([2, 3, 4, 6, 7, 10, 11, 20].map(sealAffixCount), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual(sealAffixes(7, 5), weekAffixes(5).slice(0, 3));
  for (const a of sealAffixes(20, 9)) assert.ok(SEAL_AFFIXES.includes(a));
});

test('a seal’s rounds shorten and its might grows with its level; its step: +2 fast, +1 in time, 0 late, −1 lost', () => {
  assert.equal(sealRounds(SEAL_MIN), 8);
  assert.equal(sealRounds(SEAL_MAX), 4);
  for (let lv = SEAL_MIN; lv < SEAL_MAX; lv++) {
    assert.ok(sealRounds(lv + 1) <= sealRounds(lv), `rounds at ${lv}`);
    assert.ok(sealMight(lv + 1) > sealMight(lv), `might at ${lv}`);
    assert.ok(sealPay(lv + 1).silver > sealPay(lv).silver, `pay at ${lv}`);
  }
  assert.equal(sealStep(true, fastRounds(5), 5), 2);
  assert.equal(sealStep(true, sealRounds(5), 5), 1);
  assert.equal(sealStep(true, sealRounds(5) + 1, 5), 0);
  assert.equal(sealStep(false, 3, 5), -1);
  const a = sealArmy('hydra_pool', 2), b = sealArmy('hydra_pool', 12);
  assert.ok(b.reduce((n, x) => n + x.n, 0) > a.reduce((n, x) => n + x.n, 0) * 1.6, 'seal 12 a good deal more of them');
});

// ------------------------------------------------------------------ the director on the field

function side(army: { u: string; n: number }[], captain: TacSideInput['captain'] = null): TacSideInput {
  return {
    name: '', ship: '', captain, hands: 0, marines: 0, gunners: 0, army: army.map((x) => ({ u: x.u as never, n: x.n, src: x.u as never })), officers: [], skill: 3,
    morale: 60, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, noBook: true,
  };
}

test('on the field: the shields over the creatures, the poisoned tide each round, the reinforcements in round 3, the fury below half, the limit passed', () => {
  const party = landParty(armyForLevel(10, 600, 7, 'player'));
  const base = sealArmy('serpent_grotto', 12);
  const rng = new Rng(77);
  const bt = newBattle(side(party, 'corsair'), side(base), 77, 0, rng, { land: 'rocky' });
  startDepth(bt, 12, ['shields', 'tide', 'reinforce', 'fury'], base);
  assert.ok(bt.heroes[1].fx.some((f) => f.id === 'seal_shields' && f.mods?.taken === -0.35), 'the shields laid');
  // (the battle's line keeps its latest events only: what it said is gathered as it goes)
  const seen = new Map<string, number>();
  const look = () => {
    for (const e of bt.log) if (e.k === 'boss' && e.id && !seen.has(e.id)) seen.set(e.id, bt.round);
  };
  look();
  const n0 = bt.stacks.length;
  for (let i = 0; i < 4000 && !bt.over && bt.active !== null; i++) {
    aiAct(bt, 0, rng);
    direct(bt);
    look();
  }
  assert.ok(seen.has('seal_shields'), 'the shields said');
  assert.equal(seen.get('seal_tide'), 2, 'the tide bit as round 2 opened');
  if (bt.round >= 3) assert.ok(bt.stacks.length > n0 && seen.has('seal_reinforce'), 'a fresh pack in round 3');
  const halved = bt.stacks.some((x) => x.side === 1 && x.count <= x.start / 2);
  if (halved) assert.ok(seen.has('seal_fury') && bt.heroes[1].fx.some((f) => f.id === 'seal_fury'), 'the fury of the halved');
  if (bt.round > sealRounds(12)) assert.ok(seen.has('seal_late'), 'the seal fades past its rounds');
});

// ------------------------------------------------------------------ balance

test('balance: the reference captain at the cap wins seal 2 nearly always, seal 10 seldom; geared, seal 10 most times and seal 20 in time seldom', () => {
  const kinds = SEAL_KINDS.slice(0, 6), weeks = [0, 13];
  const f2 = depthFight(2, kinds, weeks), f10 = depthFight(10, kinds, weeks);
  const g10 = depthFight(10, kinds, weeks, 2, 1.5), g20 = depthFight(20, kinds, weeks, 2, 1.5);
  assert.ok(f2.timed >= 0.85, `seal 2 in time ${f2.timed}`);
  assert.ok(f2.loss <= 0.5, `seal 2 costs ${f2.loss}`);
  assert.ok(f10.timed <= 0.45, `seal 10 bare ${f10.timed}`);
  assert.ok(g10.timed >= 0.6, `seal 10 geared ${g10.timed}`);
  assert.ok(g20.timed <= 0.2, `seal 20 geared ${g20.timed}`);
});

// ------------------------------------------------------------------ the server

function world(): Game {
  const { game } = makeGame();
  clearOutposts(game);
  quietAdv(game, false);
  return game;
}

function capped(game: Game, name = 'Seal Tester'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'frigate', 10);
  s.profile!.level = MAX_LEVEL;
  s.ship!.setArmy(armyForLevel(10, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
  s.ship!.morale = 80;
  return s;
}

type Conn = { last: (t: string) => { view?: unknown; card?: unknown; msg?: string } | undefined };
const connOf = (s: PlayerSession) => (s as unknown as { conn: Conn }).conn;

test('below the cap there is no seal; at the cap the first is seal 2 of a lair the sea has', () => {
  const game = world();
  join(game, 'Young');
  const y = game.sessionByName('Young')!;
  assert.equal(sealOf(game, y.profile!), null);
  assert.equal(sealView(game, y), undefined);
  const s = capped(game);
  const seal = sealOf(game, s.profile!)!;
  assert.equal(seal.lv, 2);
  assert.ok(SEAL_KINDS.includes(seal.kind));
  const v = sealView(game, s)!;
  assert.ok(v.near && Math.hypot(v.near.x - s.ship!.state.x, v.near.y - s.ship!.state.y) > 0, 'its nearest lair on the sea');
  assert.ok(v.why, 'not in reach out here');
});

test('a mythic depth: entered off its lair through the Throne, fought out, the seal moved and the week’s table written', () => {
  const game = world();
  const s = capped(game);
  runAdmin(game, s, '/seal lv 3');
  assert.match(runAdmin(game, s, '/seal go') ?? '', /^Off /);
  steps(game, 25);
  const v = sealView(game, s)!;
  assert.ok(v.reach && !v.why, `in reach: ${v.why}`);
  const kind = v.kind;
  steps(game, 2);
  assert.match(s.landable?.feature ?? '', /^Seal 3, mythic depth: /, 'the land key offers the depth');
  const card = connOf(s).last('lair_card')?.card as { seal?: { lv: number; kind: string; why: string | null } } | undefined;
  assert.deepEqual(card?.seal, { lv: 3, kind, why: null }, 'the card offers the depth (whichever lair of the island it shows)');
  // The land key opens it (as the Throne's «Enter the depth» does).
  (s as unknown as { conn: { push: (m: unknown) => void } }).conn.push({ t: 'land' });
  assert.ok(landFighting(game, s), 'ashore in the depth by the land key');
  landTac(game, s, { a: 'quick' });
  steps(game, 2);
  const tac = connOf(s).last('board_tac')?.view as { over: { winner: number }; land: { lair: string } };
  assert.equal(tac.land.lair, kind);
  const seal = sealOf(game, s.profile!)!;
  assert.equal(seal.runs, 1);
  if (tac.over.winner === 0 && seal.timed) {
    assert.ok(seal.lv > 3 && seal.kind !== kind, 'grown and turned');
    assert.equal(runAdmin(game, s, '/seal board')?.startsWith('1. Seal Tester'), true, 'on the week’s table');
  } else assert.ok(seal.lv <= 3, 'held or fallen');
  closeFight(game, s);
  assert.ok(!landFighting(game, s));
  // The tester's win and loss move it by the rules.
  runAdmin(game, s, '/seal lv 5');
  runAdmin(game, s, `/seal win ${fastRounds(5)}`);
  assert.equal(sealOf(game, s.profile!)!.lv, 7);
  runAdmin(game, s, '/seal lose');
  assert.equal(sealOf(game, s.profile!)!.lv, 6);
  runAdmin(game, s, `/seal lv ${SEAL_MIN}`);
  runAdmin(game, s, '/seal lose');
  assert.equal(sealOf(game, s.profile!)!.lv, SEAL_MIN, 'never below 2');
});

test('the Throne’s «Enter the depth» out of the boats’ reach says why, and lands nobody', () => {
  const game = world();
  const s = capped(game);
  const inbox = (s as unknown as { conn: { inbox: { t: string; msg?: string }[] } }).conn.inbox;
  const said = (from: number) => inbox.slice(from).filter((m) => m.t === 'toast').map((m) => m.msg ?? '');
  let n = inbox.length;
  throneMessage(game, s, { t: 'throne', action: 'seal' });
  assert.ok(said(n).includes('Put to sea first.'), 'in port');
  game.undock(s);
  steps(game, 2);
  n = inbox.length;
  throneMessage(game, s, { t: 'throne', action: 'seal' });
  assert.ok(!landFighting(game, s));
  assert.ok(said(n).some((m) => m.startsWith('Come in to the shore of a lair of your seal')), said(n).join(' | '));
});

test('the seals’ words read in Russian', () => {
  setLang('ru');
  try {
    for (const line of [
      'Seal 4 opens the mythic depth: Hydra Pool, 8 rounds.',
      'The mythic depth throws your party back into the surf. The seal falls to 3.',
      'The depth is won, but late: 9 rounds of 8. The seal holds at 4.',
      'Seal 4 won in 5 rounds: the seal rises to 5 and now opens The Ancient Turtle.',
      'Come in to the shore of a lair of your seal: within the boats’ reach.',
      'Seal 4: Hydra Pool, 8 rounds.',
      'Seal 4, mythic depth: Hydra Pool',
    ]) {
      const ru = serverText(line);
      assert.ok(!/[A-Za-z]{3,}/.test(ru), `${line} → ${ru}`);
    }
  } finally {
    setLang('en');
  }
});
