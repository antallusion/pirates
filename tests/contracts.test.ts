// docs/19 E15: the Admiralty's contracts — three hard ones a week for the captains of the cap, three of four kinds by
// turns, the same everywhere for a week; taken at an Admiralty board (a great harbour), beside the five quests; the
// rogue legend boarded at her mark (what is cut stays cut; struck — the warrant served, groupmates in company too); a
// seal's depth won in time; the citadels' watches kept by account; the cargo run with the raiders' bands; the pay in
// silver, glory and a relic part's chance; the lapse with the week; the tester's command; the words in Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL } from '../shared/src/constants.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import {
  ADM_GARRISON_MEN, ADM_KINDS, ADM_LEGEND_R, ADM_PAY, ADM_SEAL_ASKS, ADM_WATCH, ADM_WATCHES, admPay, admiraltyPatterns, admiraltyPorts, admiraltyWeek, sealHours,
  weekKinds,
} from '../shared/src/data/admiralty.ts';
import type { AdmContract, AdmKind } from '../shared/src/data/admiralty.ts';
import { openWater } from '../shared/src/data/advmap.ts';
import { raidArmy } from '../shared/src/data/abyssraid.ts';
import { QUESTS_BY_ID } from '../shared/src/data/quests.ts';
import { seaHourXp } from '../shared/src/data/roamers.ts';
import { seaHourOf } from '../shared/src/data/seamarks.ts';
import { Rng } from '../shared/src/rng.ts';
import { LEGENDS } from '../shared/src/data/throne.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { sectorAt } from '../shared/src/world/sectors.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { admView, admWeek, contractCitadel, contractGarrison, contractSeal, stepContracts } from '../server/src/game/admiralty.ts';
import { MAX_ACTIVE_QUESTS, questsUnderWay } from '../server/src/game/quests.ts';
import { act } from '../server/src/game/tacbattle.ts';
import { isTrialShip, throneOf } from '../server/src/game/throne.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { EN as UI_EN, RU as UI_RU } from '../client/src/lang/ui/contracts.ts';
import { setLang } from '../client/src/i18n.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

/** A Monday noon of the Admiralty's calendar, the clock held (the week's dice and the week's end are the test's). */
const T0 = Date.UTC(2026, 9, 5, 12);

function world(): { game: Game; clock: { t: number } } {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const clock = { t: T0 };
  game.wallNow = () => clock.t;
  return { game, clock };
}

function capped(game: Game, name: string): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'man_o_war', 10);
  s.profile!.level = MAX_LEVEL;
  s.ship!.level = MAX_LEVEL;
  s.ship!.setArmy(armyForLevel(10, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
  s.ship!.morale = 80;
  return s;
}

const inbox = (s: PlayerSession) => (s as unknown as { conn: { inbox: { t: string; msg?: string }[] } }).conn.inbox;
const said = (s: PlayerSession, from: number) => inbox(s).slice(from).filter((m) => m.t === 'toast').map((m) => m.msg ?? '');
const push = (s: PlayerSession, m: unknown) => (s as unknown as { conn: { push: (m: unknown) => void } }).conn.push(m);

/** The tester turns the Admiralty's weeks until the week's three hold this kind; the contract of it. */
function weekWith(game: Game, s: PlayerSession, kind: AdmKind): AdmContract {
  for (let k = 0; k < 4 && !weekKinds(admWeek(game)).includes(kind); k++) runAdmin(game, s, '/contract week');
  const c = admiraltyWeek(admWeek(game), game.world).find((x) => x.kind === kind);
  assert.ok(c, `a week with ${kind}`);
  return c;
}

const docked = (game: Game, s: PlayerSession, portId: string) => {
  runAdmin(game, s, `/tp ${portId}`);
  steps(game, 2);
  push(s, { t: 'dock' });
  steps(game, 2);
  assert.equal(s.ship!.docked, portId, `docked at ${portId}`);
};

test('three a week, three of four kinds by turns, the same for every call; each a quest of its own, its pay by its hours', () => {
  const { game } = world();
  const seen: Record<string, number> = {};
  for (let w = 100; w < 108; w++) {
    const list = admiraltyWeek(w, game.world);
    assert.equal(list.length, 3, `week ${w}`);
    assert.deepEqual(list.map((c) => c.kind), weekKinds(w));
    assert.equal(new Set(list.map((c) => c.kind)).size, 3, 'three kinds');
    assert.deepEqual(admiraltyWeek(w, game.world).map((c) => c.quest), list.map((c) => c.quest), 'the same week, the same three');
    for (const c of list) {
      seen[c.kind] = (seen[c.kind] ?? 0) + 1;
      assert.equal(QUESTS_BY_ID[c.id], c.quest, 'registered as a quest');
      assert.equal(c.quest.category, 'admiralty');
      assert.equal(c.quest.requires.level, MAX_LEVEL);
      // 1–3 hours of a geared captain, paid by them.
      assert.ok(c.hours >= 1 && c.hours <= 3, `${c.kind}: ${c.hours} h`);
      assert.deepEqual(c.pay, admPay(c.hours));
      assert.ok(Math.abs(c.pay.silver - seaHourOf(10) * c.hours * ADM_PAY.silver) <= 10);
      assert.ok(c.pay.part >= ADM_PAY.partBase && c.pay.part <= ADM_PAY.partMax);
      assert.ok(c.quest.portrait && /^giver_/.test(c.quest.portrait));
      if (c.legend) {
        // Open deep water of the deepest squares, within a harbour's reach, off the citadels.
        assert.ok(openWater(game.world, c.legend.x, c.legend.y));
        assert.ok(sectorAt(game.world, c.legend.x, c.legend.y).level >= 9, `⚓${sectorAt(game.world, c.legend.x, c.legend.y).level}`);
        const near = Math.min(...game.world.ports.filter((p) => !p.raft).map((p) => Math.hypot(p.x - c.legend!.x, p.y - c.legend!.y)));
        assert.ok(near >= 4000 && near <= 15000, `${Math.round(near)} m to a harbour`);
        assert.ok([2, 3, 4].includes(c.legend.tier));
      }
      if (c.delivery) {
        const from = game.portById(c.delivery.from)!, to = game.portById(c.delivery.to)!;
        assert.ok(from.key && REGIONS[from.region].safety !== 'lawless', 'from an Admiralty depot');
        assert.equal(REGIONS[to.region].safety, 'lawless', 'into lawless waters');
        assert.ok(c.delivery.km >= 16 && c.delivery.km <= 32, `${c.delivery.km} km`);
        assert.deepEqual(c.quest.steps.map((x) => x.type), ['pickup', 'deliver'], 'questgen’s own cargo steps');
      }
      if (c.seal) assert.ok(c.seal.lv >= 10 && ADM_SEAL_ASKS.some((a) => a.lv === c.seal!.lv && a.count === c.seal!.count));
    }
  }
  for (const k of ADM_KINDS) assert.equal(seen[k], 6, `${k} in six of eight weeks`);
  // The boards: the great harbours.
  assert.equal(admiraltyPorts(game.world).length, 10);
});

test('the board: a captain of the cap takes a contract at a great harbour, beside her five quests; once a week; not from the open sea', () => {
  const { game } = world();
  const s = capped(game, 'Board Reader');
  const c = weekWith(game, s, 'seal');
  // Out at sea: the board is in port.
  game.undock(s);
  let n = inbox(s).length;
  push(s, { t: 'throne', action: 'contract', op: 'take', id: c.id });
  assert.ok(said(s, n).includes('Contracts are taken at an Admiralty board, in a great harbour.'), said(s, n).join(' | '));
  // At a small port: no board either.
  const small = game.world.ports.find((p) => !p.key && !p.raft && REGIONS[p.region].safety === 'safe')!;
  docked(game, s, small.id);
  assert.equal(admView(game, s)!.board, false);
  assert.equal(admView(game, s)!.rows.find((r) => r.id === c.id)!.why, 'Contracts are taken at an Admiralty board, in a great harbour.');
  // At Gravesend: taken, into her journal, beside five quests of her own.
  docked(game, s, 'gravesend');
  const v = admView(game, s)!;
  assert.equal(v.board, true);
  assert.equal(v.rows.length, 3);
  assert.ok(v.endsIn > 0 && v.endsIn <= 7 * 86400);
  n = inbox(s).length;
  push(s, { t: 'throne', action: 'contract', op: 'take', id: c.id });
  assert.ok(s.profile!.quests.active.some((a) => a.id === c.id));
  assert.ok(said(s, n).some((m) => m.startsWith('The Admiralty’s contract is yours: ')));
  assert.equal(questsUnderWay(s.profile!), 0, 'a contract stands beside the five');
  assert.ok(MAX_ACTIVE_QUESTS >= 5);
  assert.equal(admView(game, s)!.rows.find((r) => r.id === c.id)!.state, 'taken');
  // Twice: no.
  n = inbox(s).length;
  push(s, { t: 'throne', action: 'contract', op: 'take', id: c.id });
  assert.ok(said(s, n).includes('You have that contract already.'));
  // Below the cap: no contract.
  const young = capped(game, 'Young Reader');
  young.profile!.level = MAX_LEVEL - 2;
  docked(game, young, 'gravesend');
  assert.equal(admView(game, young)!.rows[0].why, `The Admiralty gives its contracts to captains of level ${MAX_LEVEL}.`);
  young.profile!.level = MAX_LEVEL - 6;
  assert.equal(admView(game, young), undefined, 'not shown far below the cap');
  // A contract is not shared from the journal: the Admiralty's own boards give it.
  push(s, { t: 'quest', action: 'share', id: c.id });
});

test('the seal: depths of its seal or higher won in time count; lower ones do not; fulfilled — silver, glory, the week’s board', () => {
  const { game } = world();
  const s = capped(game, 'Deep Seeker');
  const c = weekWith(game, s, 'seal');
  runAdmin(game, s, `/contract take ${c.n + 1}`);
  const p = s.profile!;
  const gold = p.gold;
  const glory = throneOf(p).rank * 1e9 + throneOf(p).xp;
  contractSeal(game, s, c.seal!.lv - 1);
  assert.equal(p.quests.active.find((a) => a.id === c.id)!.progress, 0, 'a lower seal does not count');
  for (let i = 0; i < c.seal!.count; i++) contractSeal(game, s, c.seal!.lv + i);
  assert.ok(!p.quests.active.some((a) => a.id === c.id), 'fulfilled');
  assert.ok(p.quests.done.includes(c.id));
  assert.equal(p.gold - gold, c.pay.silver, 'the Admiralty’s silver');
  assert.ok(throneOf(p).rank * 1e9 + throneOf(p).xp > glory, 'glory past the cap');
  const row = admView(game, s)!.rows.find((r) => r.id === c.id)!;
  assert.equal(row.state, 'done');
  assert.equal(admView(game, s)!.done, 1);
  // Done this week: not again.
  assert.equal(runAdmin(game, s, `/contract take ${c.n + 1}`), 'That contract is done this week.');
});

test('the citadels: the watches of the week kept by account — an assault, a citadel taken or held, the hours of her men in the garrison', () => {
  const { game, clock } = world();
  const s = capped(game, 'Wall Watcher');
  const c = weekWith(game, s, 'citadel');
  // A watch before she took it does not count.
  contractCitadel(game, s.accountId, 'assault');
  runAdmin(game, s, `/contract take ${c.n + 1}`);
  steps(game, 21);
  const qs = () => s.profile!.quests.active.find((a) => a.id === c.id);
  assert.equal(qs()!.progress, 0);
  // An assault: four of twelve.
  contractCitadel(game, s.accountId, 'assault');
  steps(game, 21);
  assert.equal(qs()!.progress, ADM_WATCH.assault);
  // Her guild's citadel and her men in its garrison: an hour a watch (only with enough of them there).
  runAdmin(game, s, '/cit guild');
  runAdmin(game, s, '/cit own 3');
  runAdmin(game, s, '/cit go 3');
  steps(game, 2);
  const big = [...s.ship!.army].sort((x, y) => y.n - x.n)[0];
  assert.ok(big.n >= ADM_GARRISON_MEN);
  const crew = s.ship!.crew;
  push(s, { t: 'throne', action: 'cit', op: 'leave', cit: 2, u: big.u, n: ADM_GARRISON_MEN });
  assert.equal(s.ship!.crew, crew - ADM_GARRISON_MEN, 'her men in the garrison');
  clock.t += 3 * 3_600_000;
  steps(game, 41); // (the hours of holding paid, then her watches counted in the next second)
  assert.equal(qs()!.progress, ADM_WATCH.assault + 3 * ADM_WATCH.hour, 'three hours in the garrison');
  contractGarrison(game, { [s.accountId]: { men: ADM_GARRISON_MEN - 1 } }, 5);
  steps(game, 21);
  assert.equal(qs()!.progress, ADM_WATCH.assault + 3 * ADM_WATCH.hour, 'too few men: no watch');
  // A siege held: the rest at once.
  contractCitadel(game, s.accountId, 'hold');
  steps(game, 21);
  assert.ok(!qs(), 'fulfilled');
  assert.ok(s.profile!.quests.done.includes(c.id));
  assert.equal(ADM_WATCH.take, ADM_WATCHES);
});

test('the rogue legend: at her mark she comes alongside and grapples; held — what was cut stays cut; struck — the warrant served, her groupmate’s too', () => {
  const { game } = world();
  const s = capped(game, 'Warrant Bearer'), mate = capped(game, 'Warrant Mate');
  const c = weekWith(game, s, 'legend');
  game.social.groups.set(9101, { id: 9101, leader: s.accountId, members: [s.accountId, mate.accountId], convoy: false });
  game.social.groupOf.set(s.accountId, 9101);
  game.social.groupOf.set(mate.accountId, 9101);
  // Not taken yet: the legend keeps away.
  let n = inbox(s).length;
  push(s, { t: 'throne', action: 'contract', op: 'board', id: c.id });
  assert.ok(said(s, n).includes('Take the Admiralty’s contract first.'), said(s, n).join(' | '));
  for (const x of [s, mate]) runAdmin(game, x, `/contract take ${c.n + 1}`);
  // Far from her mark: told where.
  if (s.ship!.docked) game.undock(s);
  steps(game, 2);
  assert.equal(admView(game, s)!.rows.find((r) => r.id === c.id)!.legend!.why, 'Bring your ship to the gold mark: the legend sails there.');
  for (const x of [s, mate]) assert.match(runAdmin(game, x, `/contract go ${c.n + 1}`) ?? '', /^Off the mark of /);
  steps(game, 2);
  assert.ok(Math.hypot(s.ship!.state.x - c.legend!.x, s.ship!.state.y - c.legend!.y) <= ADM_LEGEND_R);
  const row = admView(game, s)!.rows.find((r) => r.id === c.id)!;
  assert.equal(row.legend!.why, null);
  assert.equal(row.legend!.share, 100);
  // The first boarding: she strikes at once — the legend holds; her army stays as it was cut.
  push(s, { t: 'throne', action: 'contract', op: 'board', id: c.id });
  const bt = s.ship!.boarding?.fight.tac;
  assert.ok(bt, 'the battle is laid out');
  const legend = game.ships.get(s.ship!.boarding!.with)!;
  assert.ok(isTrialShip(legend), 'no artifact on her, none of hers joins');
  assert.equal(bt.heroes[1].input.name, legend.captainName);
  assert.equal(legend.name, LEGENDS[c.legend!.skill].ship[0]);
  assert.equal(admView(game, s)!.rows.find((r) => r.id === c.id)!.legend!.fighting, true);
  act(bt, 0, { a: 'surrender' }, game.now, new Rng(1));
  steps(game, 80);
  assert.equal(s.ship!.boarding, null);
  assert.equal(game.ships.has(legend.id), false, 'the legend gone');
  assert.ok(s.profile!.quests.active.some((a) => a.id === c.id), 'still to serve');
  assert.equal(s.ship!.docked, null, 'not sent home');
  // Again: the legend strikes — the warrant served, and her groupmate's in company too.
  const gold = s.profile!.gold, mateGold = mate.profile!.gold;
  n = inbox(mate).length;
  push(s, { t: 'throne', action: 'contract', op: 'board', id: c.id });
  const bt2 = s.ship!.boarding!.fight.tac!;
  const left = bt2.stacks.filter((x) => x.side === 1).reduce((a, x) => a + x.count, 0);
  assert.ok(left <= raidArmy(c.legend!.tier).reduce((a, x) => a + x.n, 0), 'what was left of her');
  act(bt2, 1, { a: 'surrender' }, game.now, new Rng(2));
  steps(game, 80);
  assert.ok(s.profile!.quests.done.includes(c.id), 'the warrant served');
  assert.equal(s.profile!.gold - gold, c.pay.silver);
  assert.ok(mate.profile!.quests.done.includes(c.id), 'her groupmate’s too');
  assert.equal(mate.profile!.gold - mateGold, c.pay.silver);
  assert.ok(said(mate, n).some((m) => /struck to Warrant Bearer: your warrant is served too\.$/.test(m)), said(mate, n).join(' | '));
});

test('the cargo run: taken on at the depot, the raiders’ bands at her level on the way, delivered in the lawless port', () => {
  const { game } = world();
  const s = capped(game, 'Powder Runner');
  const c = weekWith(game, s, 'delivery');
  const d = c.delivery!;
  docked(game, s, d.from);
  push(s, { t: 'throne', action: 'contract', op: 'take', id: c.id });
  const qs = s.profile!.quests.active.find((a) => a.id === c.id)!;
  assert.equal(qs.step, 1, 'the cargo aboard at once at the depot');
  assert.ok((s.ship!.cargo[d.good] ?? 0) >= d.qty);
  // At sea in the lawless waters: the bands come, of her level, one after another, no more than their number.
  const to = game.portById(d.to)!;
  runAdmin(game, s, `/tp ${Math.round(to.x + 3000)} ${Math.round(to.y)}`);
  const before = [...game.ships.values()].filter((x) => x.alive).length;
  let bands = 0;
  for (let t = 0; t < 40 && bands < d.bands; t++) {
    const n = inbox(s).length;
    (game as unknown as { now: number }).now += 400;
    stepContracts(game, s);
    if (said(s, n).includes('Raiders close in: they have word of the Admiralty’s cargo.')) bands++;
  }
  assert.equal(bands, d.bands);
  const raiders = [...game.ships.values()].filter((x) => x.alive && game.npcs.get(x.id)?.huntAccount === s.accountId);
  assert.ok(raiders.length >= d.bands, `${raiders.length} raiders after her`);
  assert.ok(raiders.every((x) => x.shipLevel >= 9), 'of her level');
  assert.ok([...game.ships.values()].filter((x) => x.alive).length > before);
  (game as unknown as { now: number }).now += 400;
  stepContracts(game, s);
  assert.equal([...game.ships.values()].filter((x) => x.alive && game.npcs.get(x.id)?.huntAccount === s.accountId).length, raiders.length, 'no more than its bands');
  // Delivered: fulfilled.
  const gold = s.profile!.gold;
  docked(game, s, d.to);
  assert.ok(s.profile!.quests.done.includes(c.id), 'fulfilled');
  assert.equal(s.profile!.gold - gold, c.pay.silver);
});

test('the week turns: a contract of the week before lapses; the tester’s command, its replies and HELP in both tongues', () => {
  const { game } = world();
  const s = capped(game, 'Week Turner');
  assert.match(runAdmin(game, s, '/contract') ?? '', /^Admiralty week \d+, \d+ h left\. 1: /);
  assert.match(runAdmin(game, s, '/contract take 1') ?? '', /^Taken: /);
  const id = s.profile!.quests.active.find((a) => a.id.startsWith('adm_'))!.id;
  const n = inbox(s).length;
  runAdmin(game, s, '/contract week');
  assert.ok(!s.profile!.quests.active.some((a) => a.id === id), 'lapsed');
  assert.ok(said(s, n).some((m) => /^The week is out: the Admiralty’s contract .+ has lapsed\.$/.test(m)));
  assert.match(runAdmin(game, s, '/contract done 2') ?? '', /^Fulfilled: /);
  assert.match(runAdmin(game, s, '/contract') ?? '', /— done\./);
  assert.equal(runAdmin(game, s, '/contract reset'), 'Your Admiralty contracts are forgotten.');
  assert.ok(!s.profile!.quests.done.some((x) => x.startsWith('adm_')));
  assert.match(runAdmin(game, s, '/contract nonsense') ?? '', /^Usage: \/contract/);
  // HELP: /contract at its end, command for command in Russian.
  const help = runAdmin(game, s, '/help')!;
  assert.ok(help.endsWith('/contract [list|take N|done N|week|reset|go N]'));
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru, 'the Russian HELP');
  const cmds = (x: string) => [...x.matchAll(/\/[a-z]+/g)].map((m) => m[0]);
  assert.deepEqual(cmds(ru), cmds(help));
  // Its replies in Russian.
  setLang('ru');
  applyDataLocale('ru');
  try {
    for (const line of [runAdmin(game, s, '/contract')!, runAdmin(game, s, '/contract take 1')!]) {
      const t = serverText(line);
      assert.ok(!/[A-Za-z]{3,}/.test(t), `${line} → ${t}`);
    }
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
});

test('every word of the contracts reads in Russian: their names, givers, stories, steps; the server’s lines; the tab’s', () => {
  const { game } = world();
  const table = serverTable();
  for (const [en, ru] of admiraltyPatterns()) {
    assert.ok(!ru.includes('{-1}'), `${en} → ${ru}`);
    assert.equal(table[en], ru);
  }
  setLang('ru');
  applyDataLocale('ru');
  try {
    for (let w = 200; w < 212; w++) for (const c of admiraltyWeek(w, game.world)) {
      for (const t of [c.quest.name, c.quest.mentor, c.quest.summary, ...c.quest.steps.map((x) => x.text)]) {
        const ru = serverText(t);
        assert.ok(!/[A-Za-z]{3,}/.test(ru), `${t} → ${ru}`);
      }
    }
    for (const line of [
      'No such contract this week.', 'The Admiralty gives its contracts to captains of level 60.', 'Contracts are taken at an Admiralty board, in a great harbour.',
      'The Admiralty’s contract is yours: A Watch on the Walls.', 'Contract fulfilled: Through the Gauntlet. The Admiralty pays 16370 silver and 34894 glory.',
      'The week is out: the Admiralty’s contract Seals for the Admiralty has lapsed.', 'Bring your ship to the gold mark: the legend sails there.',
      'Grim Halloran comes about to meet you aboard the Red Ladder: the Admiralty’s warrant is served.', 'The Red Ladder strikes her colours: the Admiralty’s warrant is served.',
      'The Red Ladder holds her deck. You have cut 42% of her army; what is left of it waits for your next boarding.', 'Raiders close in: they have word of the Admiralty’s cargo.',
      'Ann fulfils all three of the Admiralty’s contracts this week.', 'The Admiralty gives its contracts at its own boards',
    ]) {
      const ru = serverText(line);
      assert.ok(!/[A-Za-z]{3,}/.test(ru.replace(/Ann/g, '')), `${line} → ${ru}`);
    }
  } finally {
    applyDataLocale('en');
    setLang('en');
  }
  assert.deepEqual(Object.keys(UI_RU).sort(), Object.keys(UI_EN).sort());
  for (const v of Object.values(UI_RU)) assert.ok(!/[A-Za-z]{3,}/.test(v.replace(/\{\w+\}/g, '')), v);
});

test('balance: an hour of a contract pays 0.6 h at sea ⚓10 in silver and an hour’s experience in glory; the relic part 20–55 %', () => {
  for (const h of [1, 1.5, 2, 3]) {
    const pay = admPay(h);
    assert.ok(Math.abs(pay.silver / h - 0.6 * seaHourOf(10)) < 20, `${h} h: ${pay.silver}`);
    assert.ok(Math.abs(pay.glory / h - seaHourXp(10)) < 2);
    assert.ok(pay.part >= 0.2 && pay.part <= 0.55);
  }
  // The seal's asks: about an hour of a geared captain at the seal.
  for (const a of ADM_SEAL_ASKS) assert.ok(sealHours(a.lv, a.count) >= 1 && sealHours(a.lv, a.count) <= 1.5, `${a.lv}×${a.count}: ${sealHours(a.lv, a.count)}`);
});
