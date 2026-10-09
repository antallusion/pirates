// docs/19 E14: the Colosseum — the draft's rules (bans, the snake of picks, the budget, a lot to one side), both armies
// weighing the same; the template hero (nothing grown or bought counts); Elo; on the server two captains matched, the
// draft by their words and the steward's on a turn run out, the bout on the sand with nothing of either ship touched, the
// ratings moved; a legend at practice after the wait; the season's end (rewards, the Pantheon); the admin's HELP pair and
// every line in Russian; the balance (mirror armies, the draft's order, every kind's pick, the paths).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_BANS, ARENA_BUDGET, ARENA_CAL, ARENA_MIN_BOUTS, ARENA_PENNANT, ARENA_POINT, ARENA_POOL, ARENA_SKILLS, ARENA_SLOTS, ARENA_START, ARENA_TITLE, ARENA_TURN, ARENA_WAIT,
  arenaHero, arenaLot, arenaPrims, draftAct, draftAffordable, draftArmy, draftChoice, draftLeft, draftOpen, draftTurn, eloShift, newDraft,
} from '../shared/src/data/arena.ts';
import type { Draft } from '../shared/src/data/arena.ts';
import { armyForLevel, armyMen, armyWeight } from '../shared/src/data/army.ts';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import { MAX_LEVEL } from '../shared/src/constants.ts';
import { Rng } from '../shared/src/rng.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { arenaLive, arenaView } from '../server/src/game/arena.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { seasonView } from '../server/src/game/seasons.ts';
import { isTrialShip } from '../server/src/game/throne.ts';
import { act } from '../server/src/game/tacbattle.ts';
import { serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { setLang } from '../client/src/i18n.ts';
import { kindTable, mirror, pathMatrix, share } from '../tools/balance-arena.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

// ------------------------------------------------------------------ the draft

/** A whole draft by the steward for both sides. */
function stewardDraft(seed: number): Draft {
  const d = newDraft();
  const rng = new Rng(seed);
  for (let g = 0; g < 64 && draftTurn(d).stage !== 'done'; g++) {
    const t = draftTurn(d);
    assert.equal(draftAct(d, t.side, draftChoice(d, t.side, rng, 'corsair', 1)), null);
  }
  return d;
}

test('the draft: three bans each by turns, then the lots by a snake within the budget, a lot to one side only', () => {
  const d = newDraft();
  assert.equal(ARENA_POOL.length, 22);
  assert.deepEqual(draftTurn(d), { stage: 'ban', side: 0 });
  assert.equal(draftAct(d, 1, { op: 'ban', u: 'guard' }), 'Not your turn.');
  assert.equal(draftAct(d, 0, { op: 'pick', u: 'guard' }), 'Ban first.');
  const bans = ['deep_spawn', 'life_guard', 'cutthroat', 'wreck_titan', 'sharpshooter', 'cultist'] as const;
  bans.forEach((u, i) => assert.equal(draftAct(d, (i % 2) as 0 | 1, { op: 'ban', u }), null));
  assert.equal(d.bans[0].length, ARENA_BANS);
  assert.equal(d.bans[1].length, ARENA_BANS);
  assert.equal(draftAct(d, 1, { op: 'pick', u: 'deep_spawn' }), 'That lot is gone.', 'a banned kind is off the table');
  // The picks: seat 1 first, then by twos.
  const seq: (0 | 1)[] = [];
  for (let g = 0; g < 6; g++) {
    const t = draftTurn(d);
    seq.push(t.side);
    const can = draftAffordable(d, t.side);
    assert.equal(draftAct(d, t.side, { op: 'pick', u: can[0] }), null);
  }
  assert.deepEqual(seq, [1, 0, 0, 1, 1, 0]);
  assert.equal(draftAct(d, draftTurn(d).side, { op: 'pick', u: d.picks[0][0] }), 'That lot is gone.', 'taken by the other side');
  // The budget: a lot dearer than what is left cannot be taken; «Done» ends a side's picks.
  const side = draftTurn(d).side;
  assert.ok(draftLeft(d, side) < ARENA_BUDGET);
  assert.equal(draftAct(d, side, { op: 'pass' }), null);
  assert.equal(d.done[side], true);
  assert.notEqual(draftTurn(d).side, side, 'the other side picks on alone');
  // Played out: nobody over the budget or the slots; the done side took nothing more.
  for (let g = 0; g < 40 && draftTurn(d).stage !== 'done'; g++) {
    const t = draftTurn(d);
    assert.notEqual(t.side, side);
    const can = draftAffordable(d, t.side);
    assert.equal(draftAct(d, t.side, can.length ? { op: 'pick', u: can[can.length - 1] } : { op: 'pass' }), null);
  }
  assert.equal(draftTurn(d).stage, 'done');
  for (const s of [0, 1] as const) {
    assert.ok(draftLeft(d, s) >= 0);
    assert.ok(d.picks[s].length <= ARENA_SLOTS);
  }
  assert.equal(new Set([...d.picks[0], ...d.picks[1], ...d.bans[0], ...d.bans[1]]).size, d.picks[0].length + d.picks[1].length + 6, 'every kind once');
});

test('a lot weighs its price; the points left reinforce the stacks: both armies weigh the same', () => {
  for (const u of ARENA_POOL) {
    const lot = arenaLot(u);
    assert.ok(lot.n >= 1 && lot.price >= 8 && lot.price <= 22, u);
  }
  // A whole budget weighs what the ladder's army of ⚓10 does (600 men), the army a hero of the cap leads.
  const ladder = armyWeight(armyForLevel(10, 600, 7, 'player'));
  assert.ok(Math.abs(ARENA_BUDGET * ARENA_POINT - ladder) / ladder < 0.02, `${ladder}`);
  for (let k = 0; k < 30; k++) {
    const d = stewardDraft(k + 1);
    // Each stack's weight by its kind's own measure (ARENA_CAL): both armies the whole budget's.
    const w = [0, 1].map((s) => draftArmy(d, s as 0 | 1).reduce((n, x) => n + armyWeight([x]) * (ARENA_CAL[x.u] ?? 1), 0));
    for (const x of w) assert.ok(Math.abs(x / (ARENA_BUDGET * ARENA_POINT) - 1) < 0.03, `${w.map(Math.round)}`);
    for (const s of [0, 1] as const) assert.ok(armyMen(draftArmy(d, s)) > 0);
  }
  // Took nothing: the budget's worth of deckhands.
  const empty = newDraft();
  assert.equal(draftArmy(empty, 0)[0].u, 'deckhand');
});

test('the hero of the Colosseum: her path\'s standard primaries, the same eight skills at expert, her book — the same for every captain of a path', () => {
  for (const c of CAPTAIN_IDS) {
    const h = arenaHero(c);
    assert.equal(h.path, c);
    assert.equal(h.level, MAX_LEVEL);
    assert.deepEqual(arenaHero(c), h, 'no dice');
    const p = arenaPrims(c);
    assert.equal(h.atk, p.atk);
    assert.ok(p.atk + p.def + p.pow + p.will >= 55, `${c}: ${JSON.stringify(p)}`);
    assert.equal(h.mana, h.manaMax, 'a full store');
    assert.ok(h.book.length > 0);
  }
  assert.equal(ARENA_SKILLS.length, 8);
});

test('Elo: even ratings move by half the step; an upset by more; the first bouts of a season by a larger step', () => {
  assert.equal(eloShift(1000, 1000, true, 20), 16);
  assert.equal(eloShift(1000, 1000, false, 20), -16);
  assert.equal(eloShift(1000, 1000, true, 0), 24);
  assert.ok(eloShift(1000, 1200, true, 20) > 16);
  assert.ok(eloShift(1200, 1000, true, 20) < 16);
});

// ------------------------------------------------------------------ the server

function capped(game: Game, name: string, captain: 'corsair' | 'reaver' | 'smuggler' | 'navigator' | 'drowned' | 'admiral' = 'corsair'): PlayerSession {
  join(game, name, captain);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'man_o_war', 10);
  s.profile!.level = MAX_LEVEL;
  s.ship!.setArmy(armyForLevel(10, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
  s.ship!.morale = 80;
  if (s.ship!.docked) game.undock(s);
  return s;
}

const inbox = (s: PlayerSession) => (s as unknown as { conn: { inbox: { t: string; msg?: string }[] } }).conn.inbox;
const said = (s: PlayerSession, from: number) => inbox(s).slice(from).filter((m) => m.t === 'toast').map((m) => m.msg ?? '');
const push = (s: PlayerSession, m: unknown) => (s as unknown as { conn: { push: (m: unknown) => void } }).conn.push(m);

/** The draft played out by the captains' own words (each move the steward's choice for her). */
function draftByWords(game: Game, byAcc: Map<number, PlayerSession>, acc: number, skipFirst = false): void {
  const rng = new Rng(5);
  let skipped = !skipFirst;
  for (let g = 0; g < 80; g++) {
    const d = arenaLive(game).draftOf(acc);
    if (!d || draftTurn(d).stage === 'done') return;
    const t = draftTurn(d);
    const bout = arenaLive(game).bouts.find((b) => b.seats.includes(acc))!;
    const seat = bout.seats[t.side];
    if (seat === null) {
      // A legend's turn: hers after a breath.
      steps(game, 40);
      continue;
    }
    const who = byAcc.get(seat)!;
    if (!skipped) {
      // A turn run out: the steward takes it for her.
      skipped = true;
      const n = inbox(who).length;
      const was = d.bans[0].length + d.bans[1].length + d.picks[0].length + d.picks[1].length;
      steps(game, ARENA_TURN * 20 + 30);
      assert.ok(said(who, n).includes('Your time ran out: the steward of the Colosseum chose for you.'), said(who, n).join(' | '));
      assert.equal(d.bans[0].length + d.bans[1].length + d.picks[0].length + d.picks[1].length, was + 1);
      continue;
    }
    const a = draftChoice(d, t.side, rng, who.profile!.captain, 1);
    push(who, { t: 'throne', action: 'arena', op: a.op, ...(a.u ? { u: a.u } : {}) });
  }
}

test('two captains of the cap matched: the draft by their words, the bout on the sand, nothing of either ship touched, the ratings moved', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const a = capped(game, 'Sand Ann'), b = capped(game, 'Sand Bea', 'reaver');
  // Far apart, and she wears glory: none of it counts on the sand.
  runAdmin(game, a, '/glory 120');
  b.ship!.state.x = a.ship!.state.x + 3000;
  b.ship!.state.y = a.ship!.state.y + 2000;
  // Below the cap: the door is shut.
  const low = capped(game, 'Sand Low');
  low.profile!.level = 30;
  assert.equal(arenaView(game, low), undefined);
  push(low, { t: 'throne', action: 'arena', op: 'queue' });
  assert.equal(arenaLive(game).queue.length, 0);
  push(a, { t: 'throne', action: 'arena', op: 'queue' });
  assert.equal(arenaView(game, a)!.why, 'You are in the queue already.');
  push(b, { t: 'throne', action: 'arena', op: 'queue' });
  steps(game, 12);
  const live = arenaLive(game);
  assert.equal(live.queue.length, 0);
  assert.equal(live.bouts.length, 1);
  assert.equal(live.bouts[0].rated, true);
  assert.equal(live.bouts[0].practice, false);
  const v = arenaView(game, a)!;
  assert.ok(v.draft, 'her draft on the tab');
  assert.equal(v.draft!.pool.length, ARENA_POOL.length);
  assert.equal(v.draft!.stage, 'ban');
  // The draft, one turn run out to the steward.
  draftByWords(game, new Map([[a.accountId, a], [b.accountId, b]]), a.accountId, true);
  steps(game, 12);
  const fight = a.ship!.boarding?.fight;
  assert.ok(fight?.tac, 'the bout is laid out');
  assert.equal(b.ship!.boarding?.fight, fight);
  assert.equal(fight!.tac!.arena, true, 'on the sand of the Colosseum');
  assert.equal(arenaView(game, a)!.draft!.stage, 'fight');
  // The template heroes: her glory nowhere; the drafted armies, not the ships'.
  const side = a.ship!.boarding!.attacker ? 0 : 1;
  const hero = fight!.tac!.heroes[side].input.hero!;
  assert.deepEqual(hero, arenaHero('corsair'));
  assert.equal(fight!.tac!.heroes[side].input.officers.length, 0);
  const drafted = arenaLive(game).draftOf(a.accountId)!;
  assert.deepEqual(fight!.tac!.heroes[side].input.army!.map((x) => x.u), draftArmy(drafted, side as 0 | 1).map((x) => x.u));
  // As they came to the sand (the sea went on while they drafted).
  const before = [a, b].map((s) => ({ army: JSON.stringify(s.ship!.army), gold: s.profile!.gold, xp: s.profile!.xp, glory: s.profile!.throne?.xp ?? 0 }));
  // The ships stay where they are, apart; no grapples to cut.
  const at = [a, b].map((s) => s.ship!.state.x + s.ship!.state.y);
  steps(game, 60);
  assert.ok(Math.abs(a.ship!.state.x + a.ship!.state.y - at[0]) < 2 && Math.abs(b.ship!.state.x + b.ship!.state.y - at[1]) < 2, 'the ships stay where they are');
  assert.ok(Math.hypot(a.ship!.state.x - b.ship!.state.x, a.ship!.state.y - b.ship!.state.y) > 1000, 'apart');
  const n = inbox(a).length;
  push(a, { t: 'board_cut' });
  assert.ok(said(a, n).some((m) => m.startsWith('No grapples on the sand')), said(a, n).join(' | '));
  // She yields (either side may): the other wins, the ratings move.
  act(fight!.tac!, side as 0 | 1, { a: 'surrender' }, game.now, new Rng(9));
  steps(game, 120);
  assert.equal(a.ship!.boarding, null);
  assert.equal(b.ship!.boarding, null);
  const va = arenaView(game, a)!, vb = arenaView(game, b)!;
  assert.equal(va.draft, undefined);
  assert.equal(va.rating, ARENA_START - 24);
  assert.equal(vb.rating, ARENA_START + 24);
  assert.equal(vb.wins, 1);
  assert.equal(va.bouts, 1);
  assert.deepEqual(va.last, { won: false, delta: -24, foe: 'Sand Bea' });
  assert.equal(va.table[0].name, 'Sand Bea');
  // Nothing of the sea's: the men, the silver, the experience, the place.
  [a, b].forEach((s, k) => {
    assert.equal(JSON.stringify(s.ship!.army), before[k].army, `${s.name}: her men`);
    assert.equal(s.profile!.gold, before[k].gold);
    assert.equal(s.profile!.xp, before[k].xp);
    assert.equal(s.profile!.throne?.xp ?? 0, before[k].glory);
    assert.equal(s.ship!.docked, null, 'not sent home');
  });
  // The same pair: rated three times a day, then friendly.
  for (let k = 0; k < 3; k++) {
    push(a, { t: 'throne', action: 'arena', op: 'queue' });
    push(b, { t: 'throne', action: 'arena', op: 'queue' });
    steps(game, 12);
    const bout = arenaLive(game).bouts[0];
    assert.equal(bout.rated, k < 2, `bout ${k + 2}`);
    draftByWords(game, new Map([[a.accountId, a], [b.accountId, b]]), a.accountId);
    steps(game, 12);
    runAdmin(game, a, '/arena win');
    steps(game, 120);
  }
  assert.equal(arenaView(game, a)!.bouts, 3, 'the friendly bout moved nothing');
});

test('alone in the queue: after the wait a legend of the sea spars — the same draft, no rating; her ship gone after', () => {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const s = capped(game, 'Lone Gull', 'admiral');
  push(s, { t: 'throne', action: 'arena', op: 'queue' });
  steps(game, ARENA_WAIT * 20 - 40);
  assert.equal(arenaLive(game).bouts.length, 0, 'still waiting');
  const n = inbox(s).length;
  steps(game, 60);
  assert.ok(said(s, n).some((m) => m.includes('comes to spar on the sand of the Colosseum')), said(s, n).join(' | '));
  const bout = arenaLive(game).bouts[0];
  assert.equal(bout.practice, true);
  assert.equal(bout.rated, false);
  draftByWords(game, new Map([[s.accountId, s]]), s.accountId);
  steps(game, 12);
  const fight = s.ship!.boarding?.fight;
  assert.ok(fight?.tac);
  const legend = game.ships.get(s.ship!.boarding!.with)!;
  assert.ok(isTrialShip(legend), 'no artifact on her, none of hers joins');
  const mine = s.ship!.boarding!.attacker ? 0 : 1;
  act(fight!.tac!, (1 - mine) as 0 | 1, { a: 'surrender' }, game.now, new Rng(3));
  steps(game, 120);
  assert.equal(game.ships.has(legend.id), false, 'the legend gone');
  const v = arenaView(game, s)!;
  assert.equal(v.rating, ARENA_START);
  assert.equal(v.bouts, 0);
  assert.equal(v.last?.practice, true);
  assert.equal(v.last?.won, true);
});

test('the season\'s end: its rewards by place, the champion\'s title and pennant, the Pantheon\'s Hall of the Colosseum', () => {
  const { game, db } = makeGame();
  const a = capped(game, 'Champ Ada'), b = capped(game, 'Second Bo'), c = capped(game, 'Few Bouts');
  runAdmin(game, a, '/arena rating 1320');
  runAdmin(game, b, '/arena rating 1180');
  runAdmin(game, c, '/arena win');
  const gold = [a, b].map((s) => s.profile!.gold);
  const glory = a.profile!.throne?.xp ?? 0;
  assert.equal(runAdmin(game, a, '/arena season'), 'The season of the Colosseum is closed: Champ Ada is its champion.');
  steps(game, 2);
  assert.ok(a.profile!.titles.includes(ARENA_TITLE[0]));
  assert.ok(a.profile!.pennants.includes(ARENA_PENNANT));
  assert.ok(a.profile!.pantheon.some((k) => k.startsWith('arena:')));
  assert.ok(b.profile!.pennants.includes(ARENA_PENNANT), 'the second place has the pennant too');
  assert.ok(!b.profile!.titles.includes(ARENA_TITLE[0]));
  assert.ok(a.profile!.gold > gold[0] + 30_000, `${a.profile!.gold - gold[0]}`);
  assert.ok(b.profile!.gold > gold[1] + 20_000);
  assert.ok((a.profile!.throne?.xp ?? 0) > glory || (a.profile!.throne?.rank ?? 0) > 0, 'glory');
  assert.ok(!c.profile!.pennants.includes(ARENA_PENNANT), `fewer than ${ARENA_MIN_BOUTS} rated bouts: nothing`);
  const hall = seasonView(game, a).halls.find((h) => h.hall === 'The Hall of the Colosseum')!;
  assert.deepEqual(hall.members.map((m) => m.name), ['Champ Ada']);
  assert.ok((db.getKv<{ msg: string }[]>('world_chronicle') ?? []).some((x) => /Champ Ada is the Champion of the Colosseum/.test(x.msg)));
  assert.equal(arenaView(game, a)!.table.length, 0, 'the table begins again');
  assert.equal(arenaView(game, a)!.champion?.name, 'Champ Ada');
});

test('the tester\'s /arena in HELP in both languages; every line of the Colosseum in Russian', () => {
  const { game } = makeGame();
  const s = capped(game, 'Help Ida');
  const help = runAdmin(game, s, '/help')!;
  assert.ok(help.endsWith('/arena [queue|bot|win|lose|rating N|season|reset]') || help.includes('/arena [queue|bot|win|lose|rating N|season|reset]'));
  assert.ok(SERVER_RU_ADMIN[help]?.includes('/arena [queue|bot|win|lose|rating N|season|reset]'), 'the Russian HELP');
  assert.match(runAdmin(game, s, '/arena bot') ?? '', /legend of the sea/);
  assert.match(runAdmin(game, s, '/arena') ?? '', /Your draft is under way/);
  setLang('ru');
  try {
    for (const line of [
      'The Colosseum opens at level 60.', 'You join the queue of the Colosseum. If no captain comes within 45 s, a legend of the sea will spar with you.',
      'The Colosseum: Bea (rating 1016) is your match. Ban three kinds, then draft your army.', 'The Colosseum: Bea again — a friendly bout, the rating stands.',
      'Grim Halloran comes to spar on the sand of the Colosseum: a practice bout, the rating stands. Ban three kinds, then draft your army.',
      'Your time ran out: the steward of the Colosseum chose for you.', 'The draft is done: the bout begins on the sand of the Colosseum.',
      'The bout is called off: Bea cannot come to the sand. The rating stands.', 'The Colosseum: you beat Bea. Rating 1016 (+16).', 'The Colosseum: Bea beats you. Rating 984 (-16).',
      'The Colosseum: you beat Mother Cinder. A practice bout: the rating stands.', 'WORLD: Bea is the Champion of the Colosseum of season 4.',
      "The Colosseum's season 3 is over: place 2, rating 1180.", 'The Colosseum pays you 30,542 silver.', 'The title «Champion of the Colosseum» is yours.',
      "The Colosseum's pennant is yours.", 'You enter the Pantheon: the Hall of the Colosseum.', 'Not enough points for that lot.', 'The bans are over: pick.',
      'Colosseum, season 2: rating 1000, bouts 0, won 0, in the queue 1. Your draft is under way.', 'Rating 1016 (+16), bouts 1.', 'Usage: /arena rating N',
      'No grapples on the sand of the Colosseum: strike your colours to yield the bout.', 'The Hall of the Colosseum',
    ]) {
      const ru = serverText(line);
      assert.ok(!/[A-Za-z]{3,}/.test(ru.replace(/Bea|Mother Cinder|\/arena rating N/g, '')), `${line} → ${ru}`);
    }
  } finally {
    setLang('en');
  }
});

// ------------------------------------------------------------------ the balance (tools/balance-arena.ts)

test('balance: mirror armies and the draft\'s order are even; the steward drafts no worse than the dice', () => {
  const m = mirror(300);
  assert.ok(m > 0.43 && m < 0.57, `mirror ${m}`);
  const first = share('steward', 'steward', 300, 9, 1);
  assert.ok(first > 0.43 && first < 0.57, `seat 1 (picks first) ${first}`);
  const sd = share('steward', 'dice', 300);
  assert.ok(sd > 0.44, `steward against the dice ${sd}`);
});

test('balance: no kind wins its takers far more than half; no kind is banned in nearly every draft', () => {
  const t = kindTable(['dice', 'dice'], 1200, 77);
  for (const u of ARENA_POOL) {
    const wr = t[u].won / Math.max(1, t[u].picks);
    assert.ok(wr > 0.4 && wr < 0.6, `${u}: ${wr}`);
  }
  const st = kindTable(['steward', 'steward'], 400, 78);
  for (const u of ARENA_POOL) assert.ok(st[u].bans / 400 < 0.75, `${u} banned ${st[u].bans / 400}`);
});

test('balance: the paths stand near even on the sand (their weights, ARENA_PATH)', () => {
  const m = pathMatrix(40);
  for (const a of CAPTAIN_IDS) {
    const mean = CAPTAIN_IDS.reduce((x, b) => x + m[a][b], 0) / CAPTAIN_IDS.length;
    assert.ok(mean > 0.4 && mean < 0.6, `${a}: ${mean}`);
  }
  void draftOpen;
});
