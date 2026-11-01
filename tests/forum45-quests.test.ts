// Forum post 45 (approved by the owner): the routine notices out of the post into «Хроника»; the crew's upkeep while
// the captain is away (provisions at sea, silver in port, gentle); hands short on the sails slow her; the navigator's
// charting perks go by the distance sailed (her log), not by discoveries; the journal's quests grouped by their giver.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AWAY_CAP_H, DESERT_MAX, MORALE_FLOOR, settleAwayCrew } from '../shared/src/data/crewaway.ts';
import { logIn } from '../shared/src/data/captainlog.ts';
import { HANDS_LOSS, gunCrewFactor, handsSpeedMul } from '../shared/src/sim/shipstats.ts';
import { voyageCrew } from '../shared/src/data/voyage.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { toPrivateState } from '../server/src/game/player.ts';
import { notice } from '../server/src/game/post.ts';
import { chronicleOnLogin, logAccount } from '../server/src/game/captainlog.ts';
import { crewAwayOnLogin } from '../server/src/game/crewaway.ts';
import { DAY_PAGES, HOUR_KM, LEG_M, PAGE_KM, RECKONING_MAX_SEC, RECKONING_SEC, logSecond, navLog, reckoningSec } from '../server/src/game/charting.ts';
import { reloadTime } from '../server/src/game/combat.ts';
import { join, makeGame } from './helpers.ts';

function captain(game: Game, name: string, cap: Parameters<typeof join>[2] = 'corsair'): PlayerSession {
  join(game, name, cap);
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = 30000;
  ship.state.y = 60000;
  ship.state.speed = 0;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return s;
}

const mailOf = (game: Game, acc: number) => game.db.getKv<{ letters: { subject: string }[] }>(`mail:${acc}`)?.letters ?? [];

test('a routine notice is a line of «Хроника» (Остров), not a letter; one with an enclosure stays a letter', () => {
  const { game } = makeGame();
  const s = captain(game, 'Quartermistress');
  const acc = s.accountId;
  notice(game, acc, { from: 'Your supply routes', subject: 'The week’s supply', body: 'The supply boats from Isla are in: 12 Timber in your island\'s yard.', gold: 0, goods: null }, 'good');
  assert.equal(mailOf(game, acc).length, 0, 'no letter for the week\'s supply');
  const line = (s.profile!.log ?? []).at(-1)!;
  assert.equal(line.kind, 'build');
  assert.ok(logIn(line.kind, 'isle'), 'under «Остров»');
  notice(game, acc, { from: 'Your supply routes', subject: 'A gift', body: 'Silver from the routes.', gold: 50, goods: null });
  assert.equal(mailOf(game, acc).length, 1, 'an enclosure still comes as a letter');
  // Away: the line waits, and is written when she is back.
  const by = (game as unknown as { byAccount: Map<number, PlayerSession> }).byAccount;
  by.delete(acc);
  const n0 = s.profile!.log!.length;
  logAccount(game, acc, 'build', ['The supply boats from Isla are in, but your island\'s yard is full.']);
  assert.equal(s.profile!.log!.length, n0, 'not in her log while she is away');
  by.set(acc, s);
  chronicleOnLogin(game, s);
  assert.equal(s.profile!.log!.length, n0 + 1, 'written on her return');
  chronicleOnLogin(game, s);
  assert.equal(s.profile!.log!.length, n0 + 1, 'once');
});

test('the crew while she is away: provisions at sea, silver in port, at most a day counted, never below zero', () => {
  const base = { level: 20, crew: 200, crewMin: 60, eaters: 200, provisionUse: 1, wagesPerHour: 300, morale: 70 };
  // Fed and paid: nothing short, nobody leaves.
  const sea = settleAwayCrew({ ...base, hours: 8, atSea: true, provisions: 1000, gold: 0 });
  assert.ok(sea.food > 0 && sea.foodShort === 0 && sea.deserted === 0 && sea.silver === 0);
  const port = settleAwayCrew({ ...base, hours: 8, atSea: false, provisions: 0, gold: 100000 });
  assert.equal(port.silver, Math.round(300 * 8 * 0.25));
  assert.equal(port.food, 0);
  // A week away counts as a day.
  const week = settleAwayCrew({ ...base, hours: 24 * 7, atSea: false, provisions: 0, gold: 1e9 });
  assert.equal(week.hours, AWAY_CAP_H);
  assert.ok(week.capped);
  assert.equal(week.silver, Math.round(300 * AWAY_CAP_H * 0.25));
  // Nothing in the purse: the silver never goes below zero; morale falls, a few desert — never under her minimum.
  const broke = settleAwayCrew({ ...base, hours: 24, atSea: false, provisions: 0, gold: 0 });
  assert.equal(broke.silver, 0);
  assert.equal(broke.short, 1);
  assert.equal(broke.deserted, Math.floor(200 * DESERT_MAX));
  assert.ok(broke.morale >= MORALE_FLOOR && broke.morale < 70);
  const thin = settleAwayCrew({ ...base, crew: 62, hours: 24, atSea: true, provisions: 0, gold: 0 });
  assert.ok(62 - thin.deserted >= 60, 'never under the sailing minimum');
  // A newcomer back after a day at sea with her starting provisions: half the bill, nobody deserts.
  const newbie = settleAwayCrew({ level: 2, crew: 24, crewMin: 8, eaters: 24, provisionUse: 1, wagesPerHour: 30, morale: 80, hours: 24, atSea: true, provisions: 10, gold: 1200 });
  assert.equal(newbie.deserted, 0);
  assert.ok(newbie.newcomer && newbie.morale >= MORALE_FLOOR);
  const newbiePort = settleAwayCrew({ level: 2, crew: 24, crewMin: 8, eaters: 24, provisionUse: 1, wagesPerHour: 30, morale: 80, hours: 24, atSea: false, provisions: 0, gold: 1200 });
  assert.ok(newbiePort.silver <= 1200 * 0.1, `a newcomer's day in port is a trifle: ${newbiePort.silver}`);
});

test('back aboard: the reckoning settles her ship, writes «Хроника» and fills «Расчёт за время отсутствия»', () => {
  const { game } = makeGame();
  const s = captain(game, 'Returning Rae');
  const p = s.profile!, ship = s.ship!;
  p.level = 20;
  ship.docked = 'port_test';
  p.gold = 10_000;
  p.ashoreAt = game.wallNow() - 10 * 3_600_000;
  const before = p.gold;
  const v = crewAwayOnLogin(game, s)!;
  assert.ok(v && !v.atSea && v.silver > 0);
  assert.equal(p.gold, before - v.silver);
  assert.equal((p.log ?? []).at(-1)!.kind, 'upkeep');
  // At sea with an empty hold: hungry, a few desert.
  ship.docked = null;
  ship.cargo.provisions = 0;
  const crew0 = ship.crew;
  p.ashoreAt = game.wallNow() - 30 * 3_600_000;
  const w = crewAwayOnLogin(game, s)!;
  assert.ok(w.atSea && w.short === 1 && w.capped);
  assert.equal(ship.crew, crew0 - w.deserted);
  assert.equal(p.crew, ship.crew);
  // A reconnect within minutes: nothing to settle.
  p.ashoreAt = game.wallNow() - 60_000;
  assert.equal(crewAwayOnLogin(game, s), null);
});

test('hands short on the sails: −15 % at half crew, nothing at 70 %, a newcomer\'s sloop untouched; the guns load slower', () => {
  assert.equal(handsSpeedMul({ crewMax: 100 }, 100), 1);
  assert.equal(handsSpeedMul({ crewMax: 100 }, 70), 1);
  assert.ok(Math.abs(handsSpeedMul({ crewMax: 100 }, 50) - (1 - HANDS_LOSS)) < 1e-9);
  assert.ok(Math.abs(handsSpeedMul({ crewMax: 100 }, 20) - (1 - HANDS_LOSS)) < 1e-9, 'no more below half');
  for (const start of [20, 22, 24, 28]) assert.equal(handsSpeedMul({ crewMax: 28 }, start), 1, `a starting sloop of ${start}`);
  assert.equal(voyageCrew({ crewMin: 8, crewMax: 28 }), 20, 'the port asks for the hands on the sails');
  const { game } = makeGame();
  const s = captain(game, 'Thin Crew');
  const ship = s.ship!;
  ship.crew = ship.stats.crewMax;
  const full = ship.sailParams(false).speedMul;
  const r0 = reloadTime(ship, 'port', game.now);
  ship.crew = Math.floor(ship.stats.crewMax / 2);
  assert.ok(ship.sailParams(false).speedMul < full * 0.86, 'half crew: the sails lose way');
  if (gunCrewFactor(ship.stats, ship.loadout, ship.crew) < 1) assert.ok(reloadTime(ship, 'port', game.now) > r0, 'and the guns reload slower');
});

test('the navigator\'s log: only straight legs count (no AFK circles), an hourly cap, a page every 100 km for «Картограф» and «Первопроходец»', () => {
  const { game } = makeGame();
  const s = captain(game, 'Wren', 'navigator');
  const p = s.profile!, ship = s.ship!;
  p.talents.exp_pathfinder = 2;
  p.talents.exp_cartographer = 2;
  ship.talents = p.talents;
  ship.recompute(game.now);
  let wall = Date.UTC(2026, 10, 1, 6);
  game.wallNow = () => wall;
  logSecond(game, s);
  const L = navLog(game, s)!;
  // Circles about her mark: nothing.
  for (let i = 0; i < 2000; i++) {
    const a = (i / 50) * Math.PI * 2;
    ship.state.x = 30000 + Math.cos(a) * 2000;
    ship.state.y = 60000 + Math.sin(a) * 2000;
    logSecond(game, s);
  }
  assert.equal(L.km, 0, 'a circle of 2 km counts nothing');
  // Straight legs: 5 km each.
  const leg = () => {
    ship.state.x += LEG_M + 1;
    logSecond(game, s);
  };
  ship.state.x = L.x;
  ship.state.y = L.y;
  const xp0 = p.xp + p.level * 1e9;
  for (let i = 0; i < 19; i++) leg();
  assert.ok(!ship.effects.some((e) => e.id === 'pathfinder'), 'not yet a page');
  leg();
  assert.ok(Math.abs(L.km - PAGE_KM) < 0.1);
  assert.ok(ship.effects.some((e) => e.id === 'pathfinder'), '«Первопроходец» on a page of the log');
  assert.ok(p.xp + p.level * 1e9 > xp0, '«Картограф»: a page\'s experience');
  // The hour's cap.
  for (let i = 0; i < 40; i++) leg();
  assert.ok(L.km <= HOUR_KM + 1e-6, `the hour holds ${L.km.toFixed(1)} km at most`);
  // The day's cap on the Cartographer's pages.
  for (let h = 1; h < 30; h++) {
    wall += 3_600_000;
    for (let i = 0; i < 25; i++) leg();
  }
  assert.ok(L.dayPages <= DAY_PAGES);
  // The star fix: a minute more for every 10 km of the log since the last fix, ten at most.
  reckoningSec(game, s);
  assert.equal(reckoningSec(game, s), RECKONING_SEC, 'no way made: the base');
  wall += 3_600_000;
  for (let i = 0; i < 6; i++) leg();
  assert.equal(reckoningSec(game, s), RECKONING_SEC + 3 * 60);
  wall += 3_600_000;
  for (let i = 0; i < 24; i++) leg();
  assert.equal(reckoningSec(game, s), RECKONING_MAX_SEC);
});

test('the journal knows where each quest was taken (its port or island), to group them', () => {
  const { game } = makeGame();
  const s = captain(game, 'Grouper');
  const ps = toPrivateState(s, game.now, (game as unknown as { worldView(x: PlayerSession): Parameters<typeof toPrivateState>[2] }).worldView(s));
  for (const q of ps.quests) if (q.kind !== 'campaign') assert.ok(q.from?.port || q.from?.island !== undefined, `${q.id} has a giver's place`);
});
