// docs/16 Batch D — the crew and the captain: officers speak on the sea's events, the men's mood shows (grumbling,
// the shanty and its lift), the trades grow in practice by doing, the wounded after a fight and the surgeon, and the
// captain's log of the last few days.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFICER_ROLES, PROFESSIONS } from '../shared/src/data/crew.ts';
import type { Officer, OfficerRole } from '../shared/src/data/crew.ts';
import {
  GRUMBLES, GRUMBLE_EVERY, PRACTICE_LEVELS, SHANTIES, SHANTY_EVERY, SHANTY_TIME, TALK, TALK_EVENTS, TALK_EVENT_GAP, TALK_GAP, TALK_PREFERS, WOUNDED_BASE,
  practiceLevel, woundRates,
} from '../shared/src/data/crewtalk.ts';
import { LOG_DAYS } from '../shared/src/data/captainlog.ts';
import { DAY_LENGTH_SEC } from '../shared/src/constants.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession, WorldView } from '../server/src/game/player.ts';
import { toPrivateState } from '../server/src/game/player.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { companyMods, hireTrade, poolTotal, reconcile } from '../server/src/game/crew.ts';
import { crewOnKill, gunPractice, officerSays, practise, resetTalk, singing, stepCrewLife } from '../server/src/game/crewlife.ts';
import { logNote, pruneLog } from '../server/src/game/captainlog.ts';
import { sagaNote } from '../server/src/game/saga.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame } from './helpers.ts';

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.speed = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.protectedUntil = 0;
  ship.lastCombat = -1000;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s };
}

function officer(game: Game, s: PlayerSession, role: OfficerRole, name = `Officer ${role}`): Officer {
  const o: Officer = { id: `o${game.allocId()}`, name, role, level: 3, xp: 0, traits: [], loyalty: 60, wound: null, hiredAt: game.now, orderReady: 0 };
  s.profile!.company.officers.push(o);
  return o;
}

function priv(game: Game, s: PlayerSession) {
  return toPrivateState(s, game.now, (game as unknown as { worldView(x: PlayerSession): WorldView }).worldView(s));
}

/** One second of the crew's life at a time, with the world clock moving. */
function live(game: Game, s: PlayerSession, seconds: number): void {
  for (let i = 0; i < seconds; i++) {
    game.now += 1;
    stepCrewLife(game, s);
  }
}

// ------------------------------------------------------------------ 16. officers speak

test('every officer has several lines for every event, in both tongues, keeping the name hole', () => {
  for (const role of OFFICER_ROLES) {
    for (const ev of TALK_EVENTS) {
      const lines = TALK[role][ev];
      assert.ok(lines.length >= 3, `${role} ${ev}`);
      assert.equal(new Set(lines.map((l) => l[0])).size, lines.length, `${role} ${ev}: all different`);
      for (const [en, ru] of lines) {
        assert.ok(en.length > 8 && ru.length > 8 && /[а-яё]/i.test(ru), `${role} ${ev}: ${en}`);
        assert.equal(en.includes('{x}'), ru.includes('{x}'), `${role} ${ev}: the hole in both: ${en}`);
        assert.ok(en.length <= 110, `short: ${en}`);
      }
    }
    for (const ev of TALK_EVENTS) for (const r of TALK_PREFERS[ev]) assert.ok(OFFICER_ROLES.includes(r));
  }
  assert.ok(GRUMBLES.length >= 5 && SHANTIES.length >= 5);
});

test('an officer speaks on an event, with his name and role; not twice in a breath, nor of the same thing too soon', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Talker');
  assert.equal(officerSays(game, s, 'storm'), false, 'no officers, nobody speaks');
  const o = officer(game, s, 'pilot', 'Ezra Holloway');
  assert.equal(officerSays(game, s, 'storm'), true);
  const m = c.last('crew_say')!;
  assert.equal(m.who?.name, 'Ezra Holloway');
  assert.equal(m.who?.role, 'pilot');
  assert.equal(m.ev, 'storm');
  assert.ok(m.i >= 0 && m.i < TALK.pilot.storm.length);
  assert.equal(officerSays(game, s, 'hunger'), false, 'a moment ago someone spoke');
  game.now += TALK_GAP + 1;
  assert.equal(officerSays(game, s, 'storm'), false, 'the storm was spoken of lately');
  assert.equal(officerSays(game, s, 'hunger'), true, 'another event may be');
  game.now += TALK_EVENT_GAP + 1;
  assert.equal(officerSays(game, s, 'storm'), true);
  // Never the same line twice running.
  const said = c.all('crew_say').filter((x) => x.ev === 'storm').map((x) => x.i);
  assert.notEqual(said[0], said[1]);
  // A wounded-out or captive officer is silent; an acting one never speaks.
  o.awayUntil = game.now + 999;
  game.now += TALK_EVENT_GAP + 1;
  assert.equal(officerSays(game, s, 'storm'), false);
});

test('the officer the event concerns speaks first more often; the victory names the ship', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Chorus');
  officer(game, s, 'pilot');
  officer(game, s, 'alchemist');
  let pilot = 0;
  for (let i = 0; i < 200; i++) {
    resetTalk(s);
    officerSays(game, s, 'storm');
    if (c.last('crew_say')!.who!.role === 'pilot') pilot++;
  }
  assert.ok(pilot > 120 && pilot < 185, `the pilot on storms: ${pilot} of 200`);
  resetTalk(s);
  officerSays(game, s, 'victory', 'Black Bess', true);
  assert.equal(c.last('crew_say')!.x, 'Black Bess');
});

test('the sea tells them when to speak: a storm breaking, a new sea, the last biscuit, low spirits, a rich merchant', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Watchful');
  const ship = s.ship!;
  officer(game, s, 'lieutenant');
  ship.morale = 60;
  let weather = 'breeze';
  (game as unknown as { weatherOf: () => string }).weatherOf = () => weather;
  live(game, s, 2);
  weather = 'storm';
  live(game, s, 1);
  assert.equal(c.last('crew_say')?.ev, 'storm');
  assert.ok(s.profile!.log!.some((e) => e.kind === 'storm'), 'the storm is in the log');
  game.now += TALK_GAP + 1;
  ship.cargo.provisions = 0;
  live(game, s, 1);
  assert.equal(c.last('crew_say')?.ev, 'hunger');
  game.now += TALK_GAP + 1;
  ship.cargo.provisions = 50;
  ship.morale = 20;
  live(game, s, 1);
  assert.equal(c.last('crew_say')?.ev, 'low_morale');
  // A rich merchant within the lookout's sight.
  ship.morale = 60;
  game.now += TALK_GAP + 1;
  const m = game.spawnNpcShip('merchant', 'brig', 'crown', ship.state.x + 600, ship.state.y, 0);
  m.cargo = { spices: 40, sugar: 30 };
  game.grid.upsert(m.id, m.state.x, m.state.y);
  live(game, s, 4);
  const said = c.last('crew_say')!;
  assert.equal(said.ev, 'merchant');
  assert.equal(said.x, m.name);
});

// ------------------------------------------------------------------ 17. the men's mood on deck

test('low morale: the men grumble every few minutes and the mark shows; high: a shanty, a small lift, then a rest', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Moody');
  const ship = s.ship!;
  ship.morale = 20;
  live(game, s, 25);
  const grumbles = () => c.all('crew_say').filter((m) => m.ev === 'grumble' && m.who === null).length;
  assert.equal(grumbles(), 1, 'the first grumble a little after spirits fall');
  assert.equal(priv(game, s).company.mood, 'grumble');
  live(game, s, GRUMBLE_EVERY);
  assert.equal(grumbles(), 2);
  // High spirits, out of a fight: a shanty after half a minute.
  ship.morale = 90;
  ship.lastCombat = game.now - 200;
  const before = ship.stats.reloadMul;
  const turn = ship.stats.turnRate;
  live(game, s, 31);
  assert.equal(c.last('crew_say')?.ev, 'shanty');
  assert.ok(ship.hasEffect('shanty'));
  assert.ok(ship.stats.reloadMul < before - 0.02, `reload ${before} → ${ship.stats.reloadMul}`);
  assert.ok(ship.stats.turnRate > turn, 'turns a little better');
  const v = priv(game, s).company;
  assert.equal(v.mood, 'shanty');
  assert.ok((v.shantyUntil ?? 0) > game.now);
  live(game, s, SHANTY_TIME + 2);
  assert.ok(!singing(ship, game.now), 'the lift passes');
  const n = c.all('crew_say').filter((m) => m.ev === 'shanty').length;
  live(game, s, SHANTY_EVERY - SHANTY_TIME - 40);
  assert.equal(c.all('crew_say').filter((m) => m.ev === 'shanty').length, n, 'not again so soon');
  live(game, s, 60);
  assert.equal(c.all('crew_say').filter((m) => m.ev === 'shanty').length, n + 1);
  // No shanty in a fight.
  ship.effects = ship.effects.filter((e) => e.id !== 'shanty');
  ship.lastCombat = game.now;
  resetTalk(s);
  live(game, s, 40);
  assert.ok(!singing(ship, game.now));
});

// ------------------------------------------------------------------ 18. the trades' practice

test('practice grows slowly by doing the work, only in a trade aboard, and gives a small edge a level', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Drill');
  const ship = s.ship!;
  const c = s.profile!.company;
  assert.equal(practiceLevel(0), 0);
  assert.equal(practiceLevel(PRACTICE_LEVELS[1]), 1);
  assert.equal(practiceLevel(1e9), 5);
  // Gunners: a broadside of ten guns is 2.5 points; a level is 80 broadsides.
  gunPractice(game, ship, 10, 0);
  assert.equal(c.practice.gunner, 2.5);
  gunPractice(game, ship, 0, 4);
  assert.equal(c.practice.gunner, 4.5);
  // Helmsmen: none aboard, no practice.
  c.pools.helmsman = 0;
  practise(game, s, 'helmsman', 100);
  assert.equal(c.practice.helmsman, 0);
  // Leagues sailed train the sailors (and helmsmen, when there are any).
  c.pools.helmsman = 1;
  ship.distanceLog = 5000;
  stepCrewLife(game, s);
  assert.equal(c.practice.helmsman, 20);
  assert.equal(c.practice.sailor, 10);
  // The edge: a gunner's level is 1% off the reload.
  const m0 = companyMods(ship, c, game.now).mods.reloadMul ?? 0;
  c.practice.gunner = PRACTICE_LEVELS[3];
  const m3 = companyMods(ship, c, game.now).mods.reloadMul ?? 0;
  assert.ok(Math.abs(m3 - m0 + 0.03) < 1e-9, `${m0} → ${m3}`);
  c.practice.carpenter = PRACTICE_LEVELS[2];
  const r0 = companyMods(ship, { ...c, practice: { ...c.practice, carpenter: 0 } }, game.now).mods.repairRate ?? 0;
  assert.ok(Math.abs((companyMods(ship, c, game.now).mods.repairRate ?? 0) - r0 - 0.06) < 1e-9);
  // New hands of a trade thin its practice by their share.
  c.pools.gunner = 10;
  c.practice.gunner = 1000;

  const port = game.world.ports.find((p) => p.id === 'saltmarrow') ?? game.world.ports[0];
  ship.docked = port.id;
  s.profile!.gold = 1e6;
  ship.crew = Math.min(poolTotal(c.pools), ship.stats.crewMax - 20);
  reconcile(game, c, ship.crew);
  const g0 = c.pools.gunner;
  const err = hireTrade(game, s, port, 'gunner', 2);
  if (!err) assert.ok(Math.abs(c.practice.gunner - 1000 * g0 / (g0 + 2)) < 1e-6, `diluted: ${c.practice.gunner}`);
  // Level-ups are told; the crew window shows the points.
  c.practice.marine = PRACTICE_LEVELS[1] - 1;
  c.pools.marine = Math.max(1, c.pools.marine);
  const toasts = (s.conn as unknown as FakeConn).all('toast').length;
  practise(game, s, 'marine', 5);
  assert.equal((s.conn as unknown as FakeConn).all('toast').length, toasts + 1);
  assert.equal(priv(game, s).company.practice?.marine, PRACTICE_LEVELS[1] + 4);
  for (const k of PROFESSIONS) assert.ok(typeof priv(game, s).company.practice?.[k] === 'number');
});

test('carpenters learn from mending, marines from a boarding won', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Mend');
  const ship = s.ship!;
  const c = s.profile!.company;
  c.pools.carpenter = 2;
  ship.repairing = true;
  ship.hull = ship.stats.hullMax * 0.5;
  stepCrewLife(game, s);
  ship.hull += ship.stats.hullMax * 0.05; // five points of the hull mended
  stepCrewLife(game, s);
  assert.ok(Math.abs(c.practice.carpenter - 10) < 1e-6, `${c.practice.carpenter}`);
  c.pools.marine = 5;
  const prize = game.spawnNpcShip('merchant', 'sloop', 'crown', ship.state.x + 300, ship.state.y, 0);
  crewOnKill(game, s, prize, 'boarded');
  assert.equal(c.practice.marine, 40);
  assert.equal(s.profile!.log!.at(-1)!.kind, 'prize');
});

// ------------------------------------------------------------------ 19. the wounded

test('a quarter of the men struck down aboard a captain\'s ship are only wounded (more with a surgeon)', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Bloodied');
  const ship = s.ship!;
  ship.crew = ship.stats.crewMax;
  s.profile!.company.pools.surgeon = 0;
  ship.companyKey = '';
  const crew0 = ship.crew;
  for (let i = 0; i < 20; i++) applyDamage(game, ship, { crew: 2 }, null);
  const struck = crew0 - ship.crew;
  assert.ok(struck > 20, `struck ${struck}`);
  assert.equal(ship.wounded, Math.floor(struck * WOUNDED_BASE + 1e-9), `wounded ${ship.wounded} of ${struck}`);
  // An NPC keeps the old rule: none wounded without a surgeon.
  const npc = game.spawnNpcShip('pirate', 'brig', 'confederacy', ship.state.x + 3000, ship.state.y, 0);
  for (let i = 0; i < 10; i++) applyDamage(game, npc, { crew: 2 }, null);
  assert.equal(npc.wounded, 0);
});

test('the surgeon and the medicine chest bring the wounded back; alone, some die below and the log notes it', () => {
  // The rates themselves.
  assert.deepEqual(woundRates(20, 0, false), { healPerMin: 1, diePerMin: 20 * 0.08 });
  assert.equal(woundRates(20, 1, false).healPerMin, 3);
  assert.equal(woundRates(20, 1, true).healPerMin, 6);
  assert.equal(woundRates(20, 1, true).diePerMin, 0);
  assert.ok(woundRates(20, 0, true).diePerMin < woundRates(20, 0, false).diePerMin);
  assert.equal(woundRates(2, 3, true).healPerMin, 2, 'no more than there are');

  const { game } = makeGame();
  // Alone: no surgeon, no medicine.
  const a = captain(game, 'Alone').s;
  a.profile!.company.pools.surgeon = 0;
  delete a.ship!.cargo.medicine;
  a.ship!.crew -= 20;
  a.ship!.wounded = 20;
  live(game, a, 600);
  const aw = a.ship!.wounded;
  const dead = a.profile!.log!.filter((e) => e.kind === 'wounded_died').reduce((x, e) => x + (e.n ?? 0), 0);
  assert.ok(dead >= 5, `some died: ${dead}`);
  assert.ok(20 - aw - dead >= 5, `some came back slowly: ${20 - aw - dead}`);
  // A surgeon and medicine: all back well inside ten minutes, none dead, a chest used for ten men.
  const b = captain(game, 'Tended').s;
  b.profile!.company.pools.surgeon = 1;
  b.ship!.cargo.medicine = 5;
  b.ship!.crew -= 20;
  const crew0 = b.ship!.crew;
  b.ship!.wounded = 20;
  live(game, b, 240);
  assert.equal(b.ship!.wounded, 0);
  assert.equal(b.ship!.crew, crew0 + 20);
  assert.ok(!(b.profile!.log ?? []).some((e) => e.kind === 'wounded_died'));
  assert.equal(b.ship!.cargo.medicine, 3);
  assert.ok((b.profile!.company.practice.surgeon ?? 0) >= 60, 'the surgeon learns');
  // Not while the fight is on.
  b.ship!.crew -= 5;
  b.ship!.wounded = 5;
  b.ship!.lastCombat = game.now;
  live(game, b, 20);
  assert.equal(b.ship!.wounded, 5);
  // The screens: the crew window and the ship panel read it from the company.
  const w = priv(game, b).company.wounded!;
  assert.equal(w.n, 5);
  assert.equal(w.surgeons, 1);
  assert.equal(w.medicine, 3);
  assert.ok(w.healPerMin > 0 && w.diePerMin === 0);
  // In harbour the port's surgeons take them all at once.
  b.ship!.docked = game.world.ports[0].id;
  stepCrewLife(game, b);
  assert.equal(b.ship!.wounded, 0);
});

// ------------------------------------------------------------------ 20. the captain's log

test('the captain\'s log writes the day by itself: sinkings, storms, discoveries, levels, the saga — the last days only', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Chronicler');
  const p = s.profile!;
  const victim = game.spawnNpcShip('pirate', 'sloop', 'confederacy', s.ship!.state.x + 400, s.ship!.state.y, 0);
  crewOnKill(game, s, victim, 'sunk');
  const e = p.log!.at(-1)!;
  assert.equal(e.kind, 'sank');
  assert.equal(e.a[0], victim.name);
  assert.ok(e.a[1].length > 0, 'where');
  assert.ok(e.day >= 1 && e.tod >= 0 && e.tod < 1);
  // A storm twice within the hour is one line.
  logNote(game, s, 'storm', ['Graywater']);
  logNote(game, s, 'storm', ['Graywater']);
  assert.equal(p.log!.filter((x) => x.kind === 'storm').length, 1);
  // A level through the experience it takes.
  const lv = p.level;
  game.grantXp(s, 1e5, null);
  assert.ok(p.log!.some((x) => x.kind === 'level' && x.n === p.level) && p.level > lv);
  // A chapter of the saga is the day's great moment in the log too.
  sagaNote(game, s, 'wonder', ['The Glass Lagoon']);
  const last = p.log!.at(-1)!;
  assert.equal(last.kind, 'saga');
  assert.deepEqual(last.a, ['wonder', 'The Glass Lagoon']);
  // The private state carries it.
  assert.equal(priv(game, s).log?.length, p.log!.length);
  // Only the last few days are kept.
  const old = p.log!.map((x) => ({ ...x }));
  const today = old.at(-1)!.day + LOG_DAYS + 1;
  const kept = [...old.map((x) => ({ ...x, day: 1 })), { ...old[0], day: today - LOG_DAYS + 1 }, { ...old[0], day: today }];
  pruneLog(kept, today);
  assert.deepEqual(kept.map((x) => x.day), [today - LOG_DAYS + 1, today]);
  void DAY_LENGTH_SEC;
});

test('the log of a fight: the dead and the wounded, told when the guns fall silent', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Scarred');
  const ship = s.ship!;
  ship.crew = ship.stats.crewMax;
  stepCrewLife(game, s);
  ship.lastCombat = game.now;
  for (let i = 0; i < 12; i++) applyDamage(game, ship, { crew: 2 }, null);
  const wounded = ship.wounded;
  const struck = ship.crewDeaths;
  stepCrewLife(game, s);
  ship.crewDeaths = 0; // the company counted them
  game.now += 25;
  stepCrewLife(game, s);
  const e = s.profile!.log!.find((x) => x.kind === 'crew_lost')!;
  assert.ok(e, 'the fight is logged');
  assert.equal(e.n, struck - wounded);
  assert.equal(e.a[1], String(wounded));
});
