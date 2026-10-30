// PvP points and the monthly season (owner, 2026-10-30; server/src/game/pvprank.ts, shared/src/data/pvprank.ts): the
// points' rules, the farm's rule, the assists and the duels, the month's turn and its rewards paid once, the season's
// title through the next month, the site's board and its past seasons (no private data), and the forum's «кто в сети».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import {
  PVP_REWARDS, PVP_REWARD_MIN, daysLeft, monthLabel, monthOf, monthStart, rewardFor, strengthMul, winPoints, assistPoints,
} from '../shared/src/data/pvprank.ts';
import {
  closeSeasonIfDue, farmBlock, forgetPvpRank, monthTally, publicAddress, pvpRankDuel, pvpRankKill, pvpRankView, rankOf, setPvpNews, stepPvpRank,
} from '../server/src/game/pvprank.ts';
import { forgetCos, ownsCos, cosState } from '../server/src/game/cosmetics.ts';
import { SiteRating } from '../server/src/game/siterating.ts';
import type { RatingRow } from '../server/src/game/siterating.ts';
import { siteRoutes } from '../server/src/http/site-routes.ts';
import { ForumService } from '../server/src/forum/service.ts';
import type { GameLink } from '../server/src/forum/service.ts';
import { ForumStore } from '../server/src/forum/store.ts';
import type { RegionId } from '../shared/src/world/regions.ts';
import { join, makeGame } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const OCT = Date.UTC(2026, 9, 15, 12);
const NOV = monthStart(monthOf(OCT) + 1) + 60_000; // a minute into November, Moscow time
const DEC = monthStart(monthOf(OCT) + 2) + 60_000;

function sea(s: PlayerSession, x: number, level = 20, region: RegionId = 'gravewater'): void {
  const sh = s.ship!;
  sh.docked = null;
  s.profile!.docked = null;
  sh.state.x = x;
  sh.state.y = 30_000;
  sh.region = region;
  s.profile!.level = level;
  sh.level = level;
  Object.defineProperty(sh, 'combatLevel', { get: () => level, configurable: true }); // (a hull's level is her class's range)
}

let ipSeq = 1;
function captain(game: Game, name: string, level = 20): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  (c as unknown as { remote: string }).remote = `203.0.113.${ipSeq++}`;
  const s = game.sessionByName(name)!;
  sea(s, 30_000 + ipSeq * 300, level);
  return { c, s };
}

function world(at = OCT) {
  const g = makeGame();
  const game = g.game;
  game.wallNow = () => at;
  forgetPvpRank(game);
  return { ...g, game, at: (t: number) => { game.wallNow = () => t; } };
}

const toasts = (c: FakeConn) => c.inbox.filter((m) => m.t === 'toast').map((m) => (m as { msg: string }).msg);

test('the points: 10 a ship sunk, 14 taken, 5 a duel; scaled by strength; nothing for a minnow; the same victim fades', () => {
  assert.equal(winPoints('sunk', 1, 0), 10);
  assert.equal(winPoints('boarded', 1, 0), 14);
  assert.equal(winPoints('duel', 1, 0), 5);
  assert.equal(strengthMul(0.49), 0, 'under half her strength: a minnow');
  assert.ok(strengthMul(0.5) > 0.5 && strengthMul(0.5) < 1, 'a little weaker: a little less');
  assert.equal(strengthMul(10), 2.5, 'the bonus is capped');
  assert.ok(winPoints('sunk', 2, 0) > 10, 'punching up pays more');
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => winPoints('sunk', 1, n)), [10, 5, 3, 0, 0], 'the same victim within a day: ×1, ×½, ×¼, nothing');
  assert.equal(winPoints('sunk', 1, 0, true), 15, 'a guild war’s kill ×1.5');
  assert.equal(winPoints('duel', 1, 0, true), 5, 'a duel is no war');
  assert.equal(assistPoints('sunk', 1, 0), 4, 'an assist: 40%');
  // the month in Moscow: 31 Oct 21:30 UTC is already November
  assert.equal(monthLabel(monthOf(Date.UTC(2026, 9, 31, 21, 30))), '2026-11');
  assert.equal(monthLabel(monthOf(Date.UTC(2026, 9, 31, 20, 30))), '2026-10');
  assert.equal(daysLeft(Date.UTC(2026, 9, 31, 12)), 1);
  assert.equal(rewardFor(1, PVP_REWARD_MIN - 1), null, 'under the minimum: nothing');
  assert.equal(rewardFor(1, 500)?.doubloons, 500);
  assert.equal(rewardFor(11, 60)?.doubloons, 0, 'a share of silver past the tenth');
});

test('a captain sunk: points, the kill, the victim’s death, the streak; the same victim again pays less, then nothing', () => {
  const { game } = world();
  const { c: a, s: A } = captain(game, 'Anne Brine');
  const { s: B } = captain(game, 'Bram Brine');
  pvpRankKill(game, A.ship!, B.ship!, 'sunk');
  const ra = rankOf(game, A.profile!), rb = rankOf(game, B.profile!);
  assert.equal(ra.season.pts, 10);
  assert.equal(ra.season.kills, 1);
  assert.equal(ra.season.sunk, 1);
  assert.equal(ra.streak, 1);
  assert.equal(rb.season.deaths, 1);
  assert.match(toasts(a).at(-1)!, /^PvP: \+10 points for Bram Brine\.$/);
  pvpRankKill(game, A.ship!, B.ship!, 'boarded');
  pvpRankKill(game, A.ship!, B.ship!, 'sunk');
  pvpRankKill(game, A.ship!, B.ship!, 'sunk');
  assert.equal(ra.season.pts, 10 + 7 + 3 + 0);
  assert.equal(ra.season.kills, 4, 'every kill counts, though the points fade');
  assert.equal(ra.best, 4);
  assert.match(toasts(a).at(-1)!, /beaten too often today/);
  // a day later she pays in full again
  game.wallNow = () => OCT + 25 * 3_600_000;
  pvpRankKill(game, A.ship!, B.ship!, 'sunk');
  assert.equal(rankOf(game, A.profile!).season.pts, 30);
  // a prize taken and then scuttled counts once
  pvpRankKill(game, A.ship!, B.ship!, 'sunk', true);
  assert.equal(rankOf(game, A.profile!).season.kills, 5);
  // the victim's death ends her streak
  pvpRankKill(game, B.ship!, A.ship!, 'sunk');
  assert.equal(rankOf(game, A.profile!).streak, 0);
  assert.equal(rankOf(game, A.profile!).best, 5, 'the best stays');
});

test('the minnow pays nothing; a stronger foe pays more', () => {
  const { game } = world();
  const { c: a, s: A } = captain(game, 'Anne Brine', 30);
  const { s: B } = captain(game, 'Bram Brine', 20);
  const { s: C } = captain(game, 'Cora Brine', 40);
  pvpRankKill(game, A.ship!, B.ship!, 'sunk');
  assert.equal(rankOf(game, A.profile!).season.pts, 0);
  assert.equal(rankOf(game, A.profile!).season.kills, 1);
  assert.match(toasts(a).at(-1)!, /far weaker/);
  pvpRankKill(game, A.ship!, C.ship!, 'sunk');
  assert.equal(rankOf(game, A.profile!).season.pts, 25, 'ten levels up: the cap, ×2.5');
});

test('the farm’s rule: a group, a guild, friends, a barter tie, one address — no points, no kill, no death', () => {
  const { game } = world();
  const { c: a, s: A } = captain(game, 'Anne Brine');
  const { c: b, s: B } = captain(game, 'Bram Brine');
  const none = () => {
    pvpRankKill(game, A.ship!, B.ship!, 'sunk');
    const r = rankOf(game, A.profile!);
    return r.season.pts === 0 && r.season.kills === 0 && rankOf(game, B.profile!).season.deaths === 0;
  };
  const grp = {} as never;
  game.social.groupOf.set(A.accountId, grp);
  game.social.groupOf.set(B.accountId, grp);
  assert.equal(farmBlock(game, A, B), 'group');
  assert.ok(none());
  game.social.groupOf.delete(A.accountId);
  game.social.groupOf.delete(B.accountId);
  A.profile!.friends = [{ id: B.accountId, name: B.name }];
  assert.equal(farmBlock(game, B, A), 'friend', 'either list');
  assert.ok(none());
  A.profile!.friends = [];
  B.profile!.pvp.ties[A.accountId] = game.wallNow();
  assert.equal(farmBlock(game, A, B), 'tie');
  assert.ok(none());
  delete B.profile!.pvp.ties[A.accountId];
  (b as unknown as { remote: string }).remote = (a as unknown as { remote: string }).remote;
  assert.equal(farmBlock(game, A, B), 'address');
  assert.ok(none());
  // a proxy's or a loopback address tells nobody apart: no block by it
  for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.0.0.5', '192.168.1.2', '172.20.0.3', '?', '']) assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('203.0.113.9'), true);
  (a as unknown as { remote: string }).remote = '127.0.0.1';
  (b as unknown as { remote: string }).remote = '127.0.0.1';
  assert.equal(farmBlock(game, A, B), null);
  // a guild and its allies
  const g1 = { id: 1, alliance: [] as number[], pacts: [] as number[] }, g2 = { id: 2, alliance: [1], pacts: [] as number[] };
  const of = game.guilds.of.bind(game.guilds);
  game.guilds.of = ((_g: Game, acc: number | null) => (acc === A.accountId ? g1 : acc === B.accountId ? g2 : null)) as typeof game.guilds.of;
  assert.equal(farmBlock(game, B, A), 'guild');
  game.guilds.of = of;
  assert.equal(farmBlock(game, A, B), null);
});

test('an assist: the captain whose shots landed in the last minute gets 40%; a duel won pays by the levels', () => {
  const { game } = world();
  const { s: A } = captain(game, 'Anne Brine');
  const { s: B } = captain(game, 'Bram Brine');
  const { c: c, s: C } = captain(game, 'Cora Brine');
  B.ship!.attackers.set(C.ship!.id, game.now);
  pvpRankKill(game, A.ship!, B.ship!, 'sunk');
  assert.equal(rankOf(game, C.profile!).season.pts, 4);
  assert.equal(rankOf(game, C.profile!).season.assists, 1);
  assert.equal(rankOf(game, C.profile!).season.kills, 0, 'an assist is no kill');
  assert.match(toasts(c).at(-1)!, /an assist on Bram Brine/);
  pvpRankDuel(game, A.accountId, C.accountId);
  assert.equal(rankOf(game, A.profile!).season.duels, 1);
  assert.equal(rankOf(game, A.profile!).season.pts, 10 + 5);
});

test('the month turns: the tally kept as the month before, the table read from every save, the view’s top ten and her place', () => {
  const { game, at } = world();
  const { s: A } = captain(game, 'Anne Brine');
  const { s: B } = captain(game, 'Bram Brine');
  rankOf(game, A.profile!).season.pts = 60;
  rankOf(game, B.profile!).season.pts = 80;
  const v = pvpRankView(game, A);
  assert.equal(v.rank, 2);
  assert.deepEqual(v.top.map((r) => r.name), ['Bram Brine', 'Anne Brine']);
  assert.doesNotMatch(JSON.stringify(v), /"acc"|accountId|email|token/);
  at(NOV);
  const r = rankOf(game, A.profile!);
  assert.equal(r.season.pts, 0, 'a new month, a new table');
  assert.equal(r.all.pts, 0, '(all time is only what she won: the test set the season alone)');
  assert.equal(monthTally(A.profile!.pvpr, monthOf(OCT))?.pts, 60, 'October kept');
});

test('the season’s turn: the top paid by letter and doubloons once — a restart pays nothing twice; the news; the title for a month', () => {
  const { game, at, db } = world();
  const news: string[] = [];
  setPvpNews((title) => news.push(title));
  const caps = ['Anne Brine', 'Bram Brine', 'Cora Brine', 'Dora Brine', 'Earl Brine'].map((n) => captain(game, n));
  const pts = [300, 200, 100, 55, 20];
  caps.forEach(({ s }, i) => (rankOf(game, s.profile!).season.pts = pts[i]));
  stepPvpRank(game); // October: the store opened, nothing closed
  assert.equal(news.length, 0);
  at(NOV);
  forgetPvpRank(game);
  closeSeasonIfDue(game);
  const mail = (s: PlayerSession) => (db.getKv<{ letters: { subject: string; gold: number }[] }>(`mail:${s.accountId}`)?.letters ?? []).filter((l) => /PvP season/.test(l.subject));
  const [A, B, C, D, E] = caps.map((x) => x.s);
  assert.equal(mail(A)[0].gold, PVP_REWARDS[0].silver);
  assert.match(mail(A)[0].subject, /PvP season 2026-10: place 1/);
  assert.equal(db.doubloons(A.accountId), PVP_REWARDS[0].doubloons);
  assert.equal(db.doubloons(B.accountId), PVP_REWARDS[1].doubloons);
  assert.equal(db.doubloons(D.accountId), PVP_REWARDS[3].doubloons, '4th place: a small sum');
  assert.equal(mail(E).length, 0, 'under 50 points: nothing');
  assert.equal(news.length, 1);
  assert.match(news[0], /Итоги ПвП-сезона: Октябрь 2026/);
  assert.ok(caps.some(({ c }) => toasts(c).some((m) => /^WORLD: The PvP season 2026-10 is over\. 1st Anne Brine, 2nd Bram Brine, 3rd Cora Brine\.$/.test(m))));
  // again, and after a «restart»: nothing more
  closeSeasonIfDue(game);
  forgetPvpRank(game);
  closeSeasonIfDue(game);
  assert.equal(mail(A).length, 1);
  assert.equal(db.doubloons(A.accountId), PVP_REWARDS[0].doubloons);
  assert.equal(news.length, 1);
  // a turn cut short resumes where it stopped: the paid are not paid again
  const st = db.getKv<{ v: 1; open: number; seasons: { m: number; done?: boolean; pay?: unknown[]; paid?: number[]; announced?: boolean }[] }>('pvprank')!;
  st.seasons[0].done = false;
  st.seasons[0].announced = false;
  st.seasons[0].pay = [{ acc: A.accountId, name: A.name, place: 1, pts: 300 }, { acc: C.accountId, name: C.name, place: 3, pts: 100 }];
  st.seasons[0].paid = [A.accountId];
  db.setKv('pvprank', st);
  forgetPvpRank(game);
  closeSeasonIfDue(game);
  assert.equal(mail(A).length, 1, 'A was marked paid');
  assert.equal(mail(C).length, 2, 'C, not marked, was paid on the resume (the test’s own forged debt)');
  assert.equal(db.doubloons(C.accountId), PVP_REWARDS[2].doubloons, 'the doubloons by their reference: never twice');
  // the title: worn in November by the top three, the banner for good; gone in December
  forgetCos(game);
  stepPvpRank(game);
  assert.ok(ownsCos(game, A.accountId, 'title:pvp1') && ownsCos(game, B.accountId, 'title:pvp2') && ownsCos(game, C.accountId, 'title:pvp3'));
  assert.ok(ownsCos(game, A.accountId, 'cloth:pvp'));
  assert.ok(!ownsCos(game, D.accountId, 'title:pvp1') && !ownsCos(game, D.accountId, 'cloth:pvp'));
  cosState(game, A.accountId).eq.title = 'pvp1';
  cosState(game, A.accountId).eq.plate = 'driftwood';
  at(DEC);
  forgetPvpRank(game);
  stepPvpRank(game);
  assert.ok(!ownsCos(game, A.accountId, 'title:pvp1'), 'the month is over');
  assert.equal(cosState(game, A.accountId).eq.title, 'seawolf', 'the free words step in');
  assert.ok(ownsCos(game, A.accountId, 'cloth:pvp'), 'the banner stays');
  setPvpNews(null);
});

test('the site: the «pvp» board (points, kills, deaths), its past seasons, the profile — public fields only', async () => {
  const { game, at } = world();
  const { s: A } = captain(game, 'Anne Brine');
  const { s: B } = captain(game, 'Bram Brine');
  captain(game, 'QA Runner');
  pvpRankKill(game, A.ship!, B.ship!, 'sunk');
  rankOf(game, game.sessionByName('QA Runner')!.profile!).season.pts = 999;
  const rating = new SiteRating(game);
  const rows = rating.board('pvp').rows as RatingRow[];
  assert.deepEqual(rows.map((r) => [r.name, r.value, r.kills, r.deaths]), [['Anne Brine', 10, 1, 0]], 'the tester is hidden; Bram has no points');
  assert.doesNotMatch(JSON.stringify(rows), /"(acc|id|accountId|email|token|recent|ties)"/);
  assert.equal(rating.find('Anne Brine')?.ranks.pvp, 1);
  // the online filter
  assert.equal((rating.board('pvp', true).rows as RatingRow[]).length, 1);
  // the API
  const handle = siteRoutes({ rating, shop: {} as never, publicUrl: 'http://x' });
  const get = async (url: string) => {
    let status = 0, body = '';
    const res = { writeHead: (s: number) => void (status = s), end: (b: string) => void (body = b) };
    const req = Object.assign([] as unknown[], { url, method: 'GET', headers: {}, socket: { remoteAddress: '198.51.100.1' } });
    await handle(req as never, res as never);
    return { status, json: JSON.parse(body || 'null') };
  };
  const b = await get('/api/site/rating?board=pvp');
  assert.equal(b.status, 200);
  assert.equal(b.json.rows[0].name, 'Anne Brine');
  // the season closed: its top ten on «Прошлые сезоны», no account ids
  rankOf(game, A.profile!).season.pts = 120;
  stepPvpRank(game);
  at(NOV);
  forgetPvpRank(game);
  closeSeasonIfDue(game);
  const h = await get('/api/site/rating/pvp-seasons');
  assert.equal(h.status, 200);
  assert.equal(h.json.seasons[0].label, '2026-10');
  assert.deepEqual(h.json.seasons[0].top.map((r: { name: string }) => r.name), ['Anne Brine']);
  assert.doesNotMatch(JSON.stringify(h.json), /"(acc|accountId|id|pay|paid)"/);
});

test('the forum’s «кто в сети» is the game’s: every captain aboard, a forum profile or not; no «on the forum» count', () => {
  const link: GameLink = {
    accountName: (id) => `Captain ${id}`, character: (id) => ({ captain: 'corsair', level: id, ship: '', deeds: [] }), guildOf: () => null, guild: () => null,
    online: (id) => id === 1 || id === 2, inGame: () => 2, onlineIds: () => [1, 2], lastPlayed: () => Date.UTC(2026, 9, 29),
  };
  const svc = new ForumService({ store: new ForumStore(':memory:'), link, now: () => Date.UTC(2026, 9, 30) });
  svc.touch(1, 'Captain 1');
  svc.touch(3, 'Captain 3');
  const l = svc.list(null, 'online', 1, 'ru') as { members: { id: number; name: string; forum: boolean }[]; inGame: number; total: number };
  assert.deepEqual(l.members.map((m) => [m.name, m.forum]), [['Captain 1', true], ['Captain 2', false]], 'the one without a forum profile too');
  assert.equal(l.members[1].id, 0, 'no account id for her');
  assert.equal(l.inGame, 2);
  // a profile: «в игре сейчас» for one aboard, «был в игре» (the game's time) for another
  assert.equal(svc.profile(null, '1', 'ru').lastSeen, null);
  assert.equal(svc.profile(null, '3', 'ru').lastSeen, Date.UTC(2026, 9, 29));
  assert.equal(svc.stats().online, 2);
});
