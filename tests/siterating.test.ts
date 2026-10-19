// The website's captains' rating (owner, 2026-10-20: «рейтинг капитанов»; server/src/game/siterating.ts, /api/site/rating):
// the boards' shapes — public fields only — their order and filters, the hidden accounts (bots, testers, the banned, the
// owner's list), the top 100, the minute's cache, the search by name, the guilds, and what a captain wears.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL } from '../shared/src/constants.ts';
import { CAMPAIGN_SIZE } from '../shared/src/data/campaign/plan.ts';
import { BOARDS, SiteRating, TEST_NAME } from '../server/src/game/siterating.ts';
import type { GuildRow, RatingRow } from '../server/src/game/siterating.ts';
import { makeGame } from './helpers.ts';

type G = ReturnType<typeof makeGame>;

/** A saved captain without a session (the rating reads the saves). */
function cap(g: G, name: string, p: Record<string, unknown>): number {
  const id = g.db.createAccount(name, `h-${name}`);
  g.db.saveCaptain(id, { captain: 'corsair', level: 1, xp: 0, stats: { boarded: 0 }, ...p }, 0, 0, 0);
  return id;
}

const ROW_KEYS = new Set(['rank', 'name', 'captain', 'level', 'value', 'sub', 'guild', 'title', 'plate', 'frame']);

test('a board is public fields only, in order, the top 100 at most', () => {
  const g = makeGame();
  for (let i = 0; i < 130; i++) cap(g, `Captain ${String(i).padStart(3, '0')}`, { level: 1 + (i % 50), xp: i, stats: { boarded: i } });
  const r = new SiteRating(g.game);
  for (const b of BOARDS) {
    const v = r.board(b);
    assert.equal(v.board, b);
    assert.ok(v.rows.length <= 100, `${b}: the top 100`);
  }
  const lv = r.board('level').rows as RatingRow[];
  assert.equal(lv.length, 100);
  for (const row of lv) for (const k of Object.keys(row)) assert.ok(ROW_KEYS.has(k), `no ${k} on the wire`);
  const json = JSON.stringify(lv);
  assert.doesNotMatch(json, /"(acc|id|accountId|email|token)"/);
  for (let i = 1; i < lv.length; i++) assert.ok(lv[i - 1].level >= lv[i].level, 'the highest level first');
  assert.deepEqual(lv.map((x) => x.rank), lv.map((_, i) => i + 1));
  const bd = r.board('boarded').rows as RatingRow[];
  assert.equal(bd[0].name, 'Captain 129');
  assert.equal(bd[0].value, 129);
  assert.ok(bd.every((x) => x.value > 0), 'nobody with nought boardings');
});

test('the hidden are left out: the load-test bots, the testers, the banned, the owner’s list', () => {
  const g = makeGame();
  cap(g, 'Honest Gull', { level: 10 });
  cap(g, 'Bot k3j9x2', { level: 60 });
  cap(g, 'QA Runner', { level: 59 });
  cap(g, 'test_42', { level: 58 });
  const banned = cap(g, 'Rotten Plank', { level: 57 });
  cap(g, 'Hidden Hand', { level: 56 });
  g.db.setKv('site_hidden', ['hidden hand']);
  const r = new SiteRating(g.game, { banned: (acc) => acc === banned });
  const names = (r.board('level').rows as RatingRow[]).map((x) => x.name);
  assert.deepEqual(names, ['Honest Gull']);
  assert.equal(r.find('Bot k3j9x2'), null);
  assert.equal(r.find('Rotten Plank'), null);
  assert.ok(TEST_NAME.test('Bot abc123') && TEST_NAME.test('QA 2') && !TEST_NAME.test('Botswain Grey') && !TEST_NAME.test('Testudo'));
});

test('each board its own number and filter: glory past the cap, the Colosseum, the campaign’s chapter', () => {
  const g = makeGame();
  cap(g, 'Capped', { level: MAX_LEVEL, throne: { rank: 7, xp: 10 } });
  cap(g, 'Capped Too', { level: MAX_LEVEL, throne: { rank: 9, xp: 0 } });
  cap(g, 'Midway', { level: 30, campaign: { at: 40 } });
  cap(g, 'Done It All', { level: 55, campaign: { at: CAMPAIGN_SIZE } });
  const r = new SiteRating(g.game);
  const glory = r.board('glory').rows as RatingRow[];
  assert.deepEqual(glory.map((x) => [x.name, x.value]), [['Capped Too', 9], ['Capped', 7]]);
  const lv = r.board('level').rows as RatingRow[];
  assert.equal(lv[0].name, 'Capped Too', 'glory breaks the tie at the cap');
  assert.equal(lv[0].sub, 9);
  const camp = r.board('campaign').rows as RatingRow[];
  assert.equal(camp[0].name, 'Done It All');
  assert.equal(camp[0].sub, 1, 'the campaign done');
  assert.ok(camp[1].value >= 1 && camp[1].sub === undefined);
  assert.deepEqual(r.board('arena').rows, [], 'nobody on the Colosseum’s table yet');
});

test('the wardrobe others see goes with the row: the title, its plate, the frame', () => {
  const g = makeGame();
  const id = cap(g, 'Dressed Up', { level: 20 });
  g.db.setKv(`cos:${id}`, { own: ['title:storm', 'plate:silver', 'frame:wheel'], eq: { title: 'storm', plate: 'silver', frame: 'wheel', emblem: null, cloth: null, trail: null } });
  const id2 = cap(g, 'Forged Gear', { level: 19 });
  g.db.setKv(`cos:${id2}`, { own: [], eq: { title: '<script>', plate: 'nonesuch', frame: 'abyss' } });
  const rows = new SiteRating(g.game).board('level').rows as RatingRow[];
  const a = rows.find((x) => x.name === 'Dressed Up')!;
  assert.deepEqual([a.title, a.plate, a.frame], ['storm', 'silver', 'wheel']);
  const b = rows.find((x) => x.name === 'Forged Gear')!;
  assert.deepEqual([b.title, b.plate, b.frame], [null, null, 'abyss'], 'only things of the tables go out');
});

test('a minute’s cache, then read afresh; a captain found by name has her places', () => {
  const g = makeGame();
  let now = 1_000_000;
  cap(g, 'Early Bird', { level: 5, stats: { boarded: 3 } });
  const r = new SiteRating(g.game, { now: () => now });
  assert.equal(r.board('level').rows.length, 1);
  cap(g, 'Late Comer', { level: 9 });
  now += 30_000;
  assert.equal(r.board('level').rows.length, 1, 'cached');
  now += 31_000;
  assert.equal(r.board('level').rows.length, 2, 'a minute on: read afresh');
  const f = r.find('early bird')!;
  assert.equal(f.captain.name, 'Early Bird');
  assert.equal(f.ranks.level, 2);
  assert.equal(f.ranks.boarded, 1);
  assert.equal(f.ranks.glory, null);
  assert.equal(r.find('Nobody'), null);
});

test('guilds: their members’ levels together, the hidden not counted', () => {
  const g = makeGame();
  const a = cap(g, 'Guild Head', { level: 40 });
  const b = cap(g, 'Guild Hand', { level: 20 });
  const c = cap(g, 'Bot zz', { level: 60 });
  const st = g.game.guilds.store(g.game);
  const member = (account: number, name: string) => ({ account, name, rank: 'sailor' as const, joined: 0, out: { day: 0, value: 0 } });
  st.guilds[1] = { id: 1, name: 'Salt Wolves', tag: 'SW', created: 0, members: [member(a, 'Guild Head'), member(b, 'Guild Hand'), member(c, 'Bot zz')] } as never;
  g.game.guilds.drop();
  g.db.setKv('guilds', st);
  const r = new SiteRating(g.game);
  const rows = r.board('guilds').rows as GuildRow[];
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0] }, { rank: 1, tag: 'SW', name: 'Salt Wolves', members: 2, value: 60, top: 40 });
  assert.equal((r.board('level').rows as RatingRow[]).find((x) => x.name === 'Guild Head')?.guild, 'SW');
});
