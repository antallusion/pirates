// docs/16 Batch F — progress and goals: careers under the Crown, the League and the Brethren; the week's challenges by
// sea with their tables and prizes; the album of collections; titles for feats flown with the ship's name; and the
// welcome back after twelve hours or more ashore.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AWAY_CAP_DAYS, CAREERS, CAREER_IDS, CAREER_POINTS, CAREER_REP, FEATS, SET_IDS, WEEKLY, WEEKLY_KINDS, WEEKLY_PRIZES, WEEKLY_TITLE, WEEK_MS,
  awayGift, careerRank, careerTitle, renownPatterns, setDefs, weekNumber, weeklyChallenges,
} from '../shared/src/data/renown.ts';
import { FISH_IDS } from '../shared/src/data/fishing.ts';
import { OMEN_IDS } from '../shared/src/data/omens.ts';
import { SEA_LETTERS } from '../shared/src/data/encounters.ts';
import { serverTable } from '../client/src/lang/server.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession, WorldView } from '../server/src/game/player.ts';
import { toPrivateState } from '../server/src/game/player.ts';
import {
  awayMark, awayReturn, chronicle, awayTake, careerBuyMul, careerOf, checkCareers, checkFeats, checkSets, closeWeek, renownKill, renownTrade, renownView,
  rn, stepRenown, weeklyAdd, weeklyView,
} from '../server/src/game/renown.ts';
import { buildPortView, priceMods, shipyardBuy } from '../server/src/game/ports.ts';
import { deliver, lettersSince } from '../server/src/game/post.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame } from './helpers.ts';

const T0 = Date.UTC(2026, 8, 30, 12);

function captain(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = [...game.sessions].find((x) => x.name === name)!;
  return { c, s };
}

function atSea(game: Game, s: PlayerSession, x = 56000, y = 74000): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.region = 'gravewater';
  game.grid.upsert(ship.id, x, y);
}

/** A stand-in for a ship of the sea, enough for the tallies. */
function victim(faction: string, role: string | null, region = 'gravewater'): ShipEntity {
  return { faction, npcRole: role, region, cls: { monster: false, tier: 2 }, name: 'Dummy' } as unknown as ShipEntity;
}

function priv(game: Game, s: PlayerSession) {
  return toPrivateState(s, game.now, (game as unknown as { worldView(x: PlayerSession): WorldView }).worldView(s));
}

// ------------------------------------------------------------------ 26. careers

test('three careers of five ranks each, every rank a title in both tongues; rank needs both points and standing', () => {
  assert.deepEqual(CAREER_IDS, ['crown', 'league', 'confederacy']);
  const table = serverTable();
  for (const id of CAREER_IDS) {
    assert.equal(CAREERS[id].ranks.length, 5);
    for (const [en, ruName] of CAREERS[id].ranks) {
      assert.ok(/[а-яё]/i.test(ruName), en);
      assert.equal(table[en], ruName, `the title ${en} is translated for the ship's label`);
    }
  }
  assert.equal(careerRank(0, 0), 0);
  assert.equal(careerRank(CAREER_REP[0], CAREER_POINTS[0]), 1);
  assert.equal(careerRank(CAREER_REP[0] - 1, 99999), 0, 'no rank without the standing');
  assert.equal(careerRank(100, CAREER_POINTS[2] - 1), 2, 'no third rank without the points');
  assert.equal(careerRank(100, 99999), 5);
});

test('a career rises from standing and deeds: titles, a price off in the flag’s ports, the quartermaster’s gift, the yard’s next class, the pennant', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Rose Carrow');
  const p = s.profile!;
  // Pirates sunk count for the Crown (and a little for the League).
  for (let i = 0; i < 10; i++) renownKill(game, s, victim('confederacy', 'pirate'), 'sunk');
  assert.equal(rn(p).deeds.crown, 120);
  assert.equal(rn(p).deeds.league, 80);
  assert.equal(rn(p).kills.pirate, 10);
  p.reputation.crown = 40;
  const c = careerOf(p, 'crown');
  assert.equal(c.points, 40 * 10 + 120);
  assert.equal(c.rank, 2);
  checkCareers(game, s);
  assert.ok(p.titles.includes(careerTitle('crown', 1)) && p.titles.includes(careerTitle('crown', 2)));
  const port = game.portById('gravesend')!;
  const plain = careerBuyMul(undefined, 'crown');
  assert.equal(plain, 1);
  assert.equal(careerBuyMul(p, 'crown'), 0.97);
  assert.equal(careerBuyMul(p, 'league'), 1, 'another flag’s ports give nothing');
  const mods = priceMods(s.ship!, port, p, game.now, game);
  p.reputation.crown = 0;
  const modsNone = priceMods(s.ship!, port, p, game.now, game);
  assert.ok(Math.abs(mods.buyMul / modsNone.buyMul - 0.97) < 1e-9, 'goods 3% cheaper at rank 2');
  // Rank 3: a gift in the locker; rank 4: the yard builds a man-o’-war at Gravesend (a yard of tier 4); rank 5: the pennant.
  p.reputation.crown = 80;
  rn(p).deeds.crown = 2000;
  const stash = p.stash.length;
  checkCareers(game, s);
  assert.equal(careerOf(p, 'crown').rank, 5);
  assert.equal(p.stash.length, stash + 2, 'two gifts: at rank 3 and rank 5');
  assert.ok(p.pennants.includes('#c9ced6'));
  const ships = buildPortView(game, s, port).shipyard.ships.map((x) => x.classId);
  assert.ok(ships.includes('man_o_war'), 'a class above the yard');
  p.level = 60;
  p.gold = 1e6;
  assert.equal(shipyardBuy(game, s, port, 'man_o_war'), null);
  // Gifts and titles are given once; standing lost takes the price off away, but not the titles.
  const after = p.stash.length;
  checkCareers(game, s);
  assert.equal(p.stash.length, after);
  p.reputation.crown = 5;
  assert.equal(careerOf(p, 'crown').rank, 0);
  assert.equal(careerBuyMul(p, 'crown'), 1);
  assert.ok(p.titles.includes(careerTitle('crown', 5)));
  // The view carries it all for the company window.
  const v = renownView(game, s).careers.find((x) => x.id === 'crown')!;
  assert.equal(v.rank, 0);
  assert.deepEqual(v.next, { points: CAREER_POINTS[0], rep: CAREER_REP[0] });
});

test('the Brethren count Crown and League ships and trade in the havens; the League counts its trade', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Jack Morrow');
  const p = s.profile!;
  renownKill(game, s, victim('league', 'merchant'), 'boarded');
  renownKill(game, s, victim('crown', 'patrol'), 'sunk');
  assert.equal(rn(p).deeds.confederacy, 16 + 12);
  assert.equal(rn(p).kills.league, 1);
  assert.equal(rn(p).kills.crown, 1);
  renownTrade(game, s, game.portById('hollowmere')!, 5000);
  assert.equal(Math.round(rn(p).deeds.league ?? 0), 50);
  renownTrade(game, s, game.portById('cinderhold')!, 1000);
  assert.equal(Math.round(rn(p).deeds.confederacy ?? 0), 28 + 10);
});

// ------------------------------------------------------------------ 27. the week's challenges

test('each week three challenges in three different seas; every kind turns up over five weeks; the same for everyone', () => {
  const seen = new Set<string>();
  for (let w = 2900; w < 2905; w++) {
    const list = weeklyChallenges(w);
    assert.equal(list.length, 3);
    assert.equal(new Set(list.map((c) => c.region)).size, 3);
    assert.equal(new Set(list.map((c) => c.kind)).size, 3);
    for (const c of list) {
      assert.ok(WEEKLY[c.kind].regions.includes(c.region));
      seen.add(c.kind);
    }
    assert.deepEqual(weeklyChallenges(w), list);
  }
  assert.deepEqual([...seen].sort(), [...WEEKLY_KINDS].sort());
  assert.equal(weekNumber(T0 + WEEK_MS) - weekNumber(T0), 1);
});

test('the week’s tables: sums and the heaviest catch, only in the challenge’s sea; places; the first three paid by letter, the first titled', () => {
  const { game } = makeGame();
  game.wallNow = () => T0;
  const a = captain(game, 'Anne Vey').s;
  const b = captain(game, 'Morrow Kett').s;
  const c = captain(game, 'Isabel Crane').s;
  const week = weekNumber(T0);
  const list = weeklyChallenges(week);
  const [c0, c1] = list;
  // The first challenge: a sum; counted only in its sea.
  weeklyAdd(game, a, c0.kind, c0.region, 5);
  weeklyAdd(game, a, c0.kind, c0.region, 4);
  weeklyAdd(game, a, c0.kind, 'the_abyss', 50);
  weeklyAdd(game, b, c0.kind, c0.region, 12);
  weeklyAdd(game, c, c0.kind, c0.region, 3);
  weeklyAdd(game, b, c1.kind, c1.region, 7);
  const va = weeklyView(game, a);
  assert.equal(va.challenges[0].mine, 9);
  assert.equal(va.challenges[0].place, 2);
  assert.deepEqual(va.challenges[0].top.map((t) => t.name), ['Morrow Kett', 'Anne Vey', 'Isabel Crane']);
  assert.equal(va.challenges[1].place, null);
  // A "best" kind keeps the heaviest, not the sum.
  const { game: g2 } = makeGame();
  g2.wallNow = () => T0;
  const d = captain(g2, 'Silas Gault').s;
  // Find a week with the catch.
  let w = week;
  while (!weeklyChallenges(w).some((x) => x.kind === 'catch')) w++;
  g2.wallNow = () => w * WEEK_MS + 3600_000;
  const cc = weeklyChallenges(w).find((x) => x.kind === 'catch')!;
  weeklyAdd(g2, d, 'catch', cc.region, 40);
  weeklyAdd(g2, d, 'catch', cc.region, 12);
  assert.equal(weeklyView(g2, d).challenges.find((x) => x.kind === 'catch')!.mine, 40);
  // The week turns: the lead closes it; the letters carry the prizes, the first is titled when aboard.
  stepRenown(game);
  game.wallNow = () => T0 + WEEK_MS;
  stepRenown(game);
  const hist = game.db.getKv<{ week: number }[]>('weekly_hist')!;
  assert.ok(hist.some((h) => h.week === week));
  const letB = lettersSince(game, b.accountId, T0);
  assert.equal(letB.reduce((x, l) => x + l.gold, 0), WEEKLY_PRIZES[0] + WEEKLY_PRIZES[0], 'first in both of her challenges');
  assert.equal(lettersSince(game, a.accountId, T0)[0].gold, WEEKLY_PRIZES[1]);
  assert.equal(lettersSince(game, c.accountId, T0)[0].gold, WEEKLY_PRIZES[2]);
  stepRenown(game); // aboard: the first's title
  assert.ok(b.profile!.titles.includes(WEEKLY_TITLE));
  assert.ok(!a.profile!.titles.includes(WEEKLY_TITLE));
  // Closing twice pays nobody twice.
  closeWeek(game, week);
  assert.equal(lettersSince(game, b.accountId, T0).length, 2);
  assert.ok(weeklyView(game, a).last?.length);
});

test('a pirate sunk in the week’s sea counts on its table, and a prize by boarding on its own', () => {
  const { game } = makeGame();
  let w = weekNumber(T0);
  while (!weeklyChallenges(w).some((x) => x.kind === 'pirates')) w++;
  game.wallNow = () => w * WEEK_MS + 3600_000;
  const { s } = captain(game, 'Rose Carrow');
  const ch = weeklyChallenges(w).find((x) => x.kind === 'pirates')!;
  renownKill(game, s, victim('confederacy', 'pirate', ch.region), 'sunk');
  renownKill(game, s, victim('confederacy', 'pirate', ch.region), 'sunk');
  renownKill(game, s, victim('confederacy', 'pirate', 'black_coast'), 'sunk');
  assert.equal(weeklyView(game, s).challenges.find((x) => x.kind === 'pirates')!.mine, 2);
});

// ------------------------------------------------------------------ 28. the album

test('the album: six sets from what she has gathered; a whole set pays once, with a title', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Rose Carrow');
  const p = s.profile!;
  const defs = setDefs(SEA_LETTERS.length);
  assert.deepEqual(SET_IDS, ['fish', 'wonders', 'omens', 'trophies', 'beasts', 'letters']);
  for (const id of SET_IDS) {
    assert.ok(defs[id].items.length >= 7, id);
    assert.ok(defs[id].silver > 0);
    assert.ok(/[а-яё]/i.test(defs[id].title[1]) && serverTable()[defs[id].title[0]] === defs[id].title[1]);
  }
  p.fishing!.caught = {};
  for (const f of FISH_IDS.filter((x) => x !== 'goldfish').slice(1)) p.fishing!.caught[f] = { n: 1, best: 1 };
  const gold = p.gold;
  checkSets(game, s);
  assert.equal(p.gold, gold, 'one fish short');
  assert.equal(renownView(game, s).sets.find((x) => x.id === 'fish')!.have.length, defs.fish.items.length - 1);
  p.fishing!.caught[FISH_IDS[0]] = { n: 1, best: 0.3 };
  checkSets(game, s);
  assert.equal(p.gold, gold + defs.fish.silver);
  assert.ok(p.titles.includes('Master Angler'));
  checkSets(game, s);
  assert.equal(p.gold, gold + defs.fish.silver, 'paid once');
  // Omens: those she was at sea under.
  atSea(game, s);
  stepRenown(game);
  assert.equal(rn(p).omens.length, 1);
  rn(p).omens = [...OMEN_IDS];
  checkSets(game, s);
  assert.ok(p.titles.includes('Reader of Omens'));
  assert.ok(renownView(game, s).sets.find((x) => x.id === 'omens')!.done);
});

// ------------------------------------------------------------------ 29. titles for feats

test('feats bring titles; one is flown with the ship’s name, seen by the others and in her own frame', () => {
  const { game } = makeGame();
  const { c, s } = captain(game, 'Rose Carrow');
  const p = s.profile!;
  assert.ok(FEATS.some((f) => f.title[1] === 'Гроза Лиги') && FEATS.some((f) => f.title[1] === 'Друг китов') && FEATS.some((f) => f.title[1] === 'Кракеноборец'));
  for (const f of FEATS) assert.equal(serverTable()[f.title[0]], f.title[1], f.id);
  for (let i = 0; i < 24; i++) renownKill(game, s, victim('league', 'merchant'), 'sunk');
  checkFeats(game, s);
  assert.ok(!p.titles.includes('Scourge of the League'));
  renownKill(game, s, victim('league', 'merchant'), 'boarded');
  p.bossKills.kraken = 1;
  checkFeats(game, s);
  assert.ok(p.titles.includes('Scourge of the League'));
  assert.ok(p.titles.includes('Kraken-Slayer'));
  assert.ok(renownView(game, s).feats.find((f) => f.id === 'league_bane')!.done);
  // Chosen: on the ship's info (the label over her) and in her private state (the unit frame).
  c.push({ t: 'season', action: 'title', value: 'Scourge of the League' });
  assert.equal(p.title, 'Scourge of the League');
  assert.equal(s.ship!.title, 'Scourge of the League');
  assert.equal(priv(game, s).title, 'Scourge of the League');
  c.push({ t: 'season', action: 'title', value: 'Admiral of Nowhere' });
  assert.equal(p.title, 'Scourge of the League', 'an unearned title is refused');
  assert.ok(c.last('renown'));
});

// ------------------------------------------------------------------ 30. the welcome back

test('back after twelve hours: letters, the world’s great events, the week’s tables, and a gift by the time away (capped)', () => {
  assert.equal(awayGift(11.9, 10).silver, 0);
  const g1 = awayGift(24, 10), g3 = awayGift(72, 10), g30 = awayGift(24 * 30, 10);
  assert.ok(g1.silver > 0 && g3.silver > g1.silver);
  assert.equal(g30.silver, awayGift(24 * AWAY_CAP_DAYS, 10).silver, 'capped at a week');
  assert.equal(g1.speedups, 0);
  assert.equal(g3.speedups, 1);
  const { game } = makeGame();
  game.wallNow = () => T0;
  const { s } = captain(game, 'Rose Carrow');
  const p = s.profile!;
  awayMark(game, s);
  // While she is away: a letter from the auction house, a boss slain on the seas.
  game.wallNow = () => T0 + 3600_000;
  deliver(game, s.accountId, { from: 'The Auction House', subject: 'Sold: a cutlass', body: '...', gold: 400, goods: null });
  chronicle(game, 'Kraken was slain by Anne Vey.');
  game.wallNow = () => T0 + 36 * 3600_000;
  const v = awayReturn(game, s)!;
  assert.ok(v);
  assert.equal(v.hours, 36);
  assert.deepEqual(v.auction, ['Sold: a cutlass']);
  assert.equal(v.letters.n, 1);
  assert.deepEqual(v.world, ['Kraken was slain by Anne Vey.']);
  assert.equal(v.weekly.length, 3);
  assert.deepEqual(v.gift, awayGift(36, p.level));
  const gold = p.gold;
  assert.equal(awayTake(game, s), null);
  assert.equal(p.gold, gold + v.gift!.silver);
  assert.equal(awayTake(game, s), 'No gift waits for you.');
  // A short time ashore: nothing to tell, nothing given.
  awayMark(game, s);
  game.wallNow = () => T0 + 40 * 3600_000;
  assert.equal(awayReturn(game, s), null);
});

test('the lines of Batch F have their Russian twins with the same holes', () => {
  const holes = (x: string) => [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const [en, ruText] of renownPatterns()) {
    assert.ok(ruText && /[а-яё]/i.test(ruText), en);
    assert.equal(holes(en), holes(ruText), en);
  }
});
