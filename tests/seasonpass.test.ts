// «Сезонная карта» (owner, 2026-10-30; shared/src/data/seasonpass.ts, server/src/game/seasonpass.ts): the calendar of
// two-month seasons, the tier math and the 300-hour pace, the season experience from the substantial things only (with
// the day's caps and the captains' rule), the challenges, the claims (free, premium, once), the passes (the super's
// +20 tiers and frame, the step between them), a payment granting a pass once on every desk (the web shop, VK's votes),
// the season's end delivering what was earned and not taken, and the hull and the frame no longer in the doubloon shop.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../shared/src/data/army.ts';
import { ARTIFACTS } from '../shared/src/data/artifacts.ts';
import { FRAMES, cosItem } from '../shared/src/data/cosmetics.ts';
import { premiumShips } from '../shared/src/data/premium.ts';
import { premiumFrom } from '../shared/src/data/premiumbeasts.ts';
import {
  CHALLENGES, MILESTONES, PASS_CAP, PASS_PRICES, PASS_SHIP, PASS_TIERS, PASS_TOTAL_XP, PASS_XP, SEASONS, SUPER_FRAME, SUPER_TIERS,
  mskMidnight, passBounds, passFullHours, passModel, passPatterns, passProductOpen, passSeason, passSeasonAt, rollChallenges, tierOf, tierXp, xpToTier,
} from '../shared/src/data/seasonpass.ts';
import type { PassReward } from '../shared/src/data/seasonpass.ts';
import { OFFERS } from '../shared/src/data/shop.ts';
import { SHIP_CLASSES, SHIP_CLASS_IDS } from '../shared/src/data/ships.ts';
import { levelRange } from '../shared/src/data/shiplevel.ts';
import { WEB_ITEMS, gameShopIds, webItem } from '../shared/src/data/webshop.ts';
import { webDetail } from '../shared/src/data/webdetail.ts';
import { passLine } from '../shared/src/data/passlines.ts';
import { buyShip } from '../server/src/game/premium.ts';
import { cosState, forgetCos, ownsCos } from '../server/src/game/cosmetics.ts';
import { lettersSince } from '../server/src/game/post.ts';
import { adminPass, claimAll, claimTier, passBuy, passOnLogin, passPaid, passPvp, passState, seasonNow, seasonXp } from '../server/src/game/seasonpass.ts';
import { shopState, forgetShop } from '../server/src/game/shop.ts';
import { WebShop } from '../server/src/game/webshop.ts';
import { VkService, paySig } from '../server/src/vk.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { EN as SP_EN, RU as SP_RU } from '../client/src/lang/ui/seasonpass.ts';
import { MORE_ITEMS } from '../client/src/ui/hudmore.ts';
import { join, makeGame, shipAtLevel } from './helpers.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';

const H = 3_600_000;
/** A wall time inside the first season (2026-11-10, noon UTC). */
const T1 = Date.UTC(2026, 10, 10, 12);

function aboard(name = 'Pass Polly'): { game: Game; db: ReturnType<typeof makeGame>['db']; s: PlayerSession } {
  const { game, db } = makeGame();
  game.wallNow = () => T1;
  join(game, name);
  const s = game.sessionByName(name)!;
  return { game, db, s };
}

const ledger = (db: unknown, acc: number, kind: string) =>
  (db as { db: { prepare(s: string): { all(...a: unknown[]): { kind: string; amount: number; detail: string }[] } } }).db.prepare('SELECT kind, amount, detail FROM ledger WHERE account_id = ? AND kind = ?').all(acc, kind);

// ------------------------------------------------------------------------------------------------ the calendar

test('seasons are two calendar months by Moscow time: the first from the launch to 2026-12-31 23:59 MSK, then Jan–Feb, Mar–Apr …', () => {
  const msk = (y: number, m: number, d: number, h = 0, min = 0) => mskMidnight(y, m, d) + h * H + min * 60_000;
  assert.equal(passSeasonAt(msk(2026, 9, 30)), 1);
  assert.equal(passSeasonAt(msk(2026, 11, 31, 23, 59)), 1);
  assert.equal(passSeasonAt(msk(2027, 0, 1)), 2);
  assert.equal(passSeasonAt(msk(2027, 1, 28, 23, 59)), 2);
  assert.equal(passSeasonAt(msk(2027, 2, 1)), 3);
  assert.equal(passSeasonAt(msk(2027, 11, 31, 23)), 7);
  assert.equal(passSeasonAt(msk(2028, 0, 1)), 8);
  assert.equal(passSeasonAt(Date.UTC(2020, 0, 1)), 1, 'before the launch: the first');
  assert.deepEqual(passBounds(1), { from: msk(2026, 9, 30), until: msk(2027, 0, 1) });
  assert.equal(new Date(passBounds(1).until - 60_000 + 3 * H).toISOString().slice(0, 16), '2026-12-31T23:59', 'the first ends 23:59 MSK of the 31st');
  assert.deepEqual(passBounds(2), { from: msk(2027, 0, 1), until: msk(2027, 2, 1) });
  for (let n = 2; n < 12; n++) assert.equal(passBounds(n).until, passBounds(n + 1).from, `season ${n} meets ${n + 1}`);
  // each season its own table: the first authored, the second drafted, past them a rerun of one under its own number
  assert.equal(SEASONS.length >= 2, true);
  assert.notDeepEqual(passSeason(1).name, passSeason(2).name);
  assert.ok(passSeason(2).draft && !passSeason(1).draft);
  assert.equal(passSeason(5).n, 5);
  assert.match(passSeason(5).name[1], /Сезон 5/);
});

// ------------------------------------------------------------------------------------------------ the tiers and the pace

test('the tier math: 100 tiers on a gentle straight rise, the experience to each, the tier of an experience', () => {
  assert.equal(PASS_TIERS, 100);
  assert.equal(tierXp(1), 1120);
  assert.equal(tierXp(100), 2800);
  for (let t = 2; t <= 100; t++) assert.ok(tierXp(t) >= tierXp(t - 1) && tierXp(t) - tierXp(t - 1) <= 30, `tier ${t}: a gentle rise`);
  assert.equal(xpToTier(0), 0);
  assert.equal(xpToTier(1), 1120);
  assert.equal(xpToTier(100), PASS_TOTAL_XP);
  assert.deepEqual(tierOf(0), { tier: 0, into: 0, need: 1120 });
  assert.deepEqual(tierOf(1119), { tier: 0, into: 1119, need: 1120 });
  assert.deepEqual(tierOf(1120), { tier: 1, into: 0, need: tierXp(2) });
  assert.equal(tierOf(PASS_TOTAL_XP).tier, 100);
  assert.equal(tierOf(PASS_TOTAL_XP * 3).tier, 100);
});

test('the pace: about 300 hours of play close all 100 tiers (±15%); an hour a day reaches about the 30th', () => {
  const full = passFullHours();
  assert.ok(full.hours >= 255 && full.hours <= 345, `${full.hours.toFixed(0)} hours (${full.perDay.toFixed(2)} a day) close the card`);
  // a typical hour of the mixed play, its season experience
  const hour = passModel(1, 1).xp - passModel(0, 1).xp;
  assert.ok(hour > 0);
  // an hour a day, for several captains (their challenges drawn apart), with and without an island
  const tiers = [1, 2, 3, 4, 5, 77, 1234].flatMap((acc) => [passModel(1, 61, acc, true).tier, passModel(1, 61, acc, false).tier]);
  for (const t of tiers) assert.ok(t >= 24 && t <= 36, `an hour a day: tier ${t}`);
  const mean = tiers.reduce((a, b) => a + b, 0) / tiers.length;
  assert.ok(Math.abs(mean - 30) <= 3, `an hour a day, on the mean: tier ${mean.toFixed(1)}`);
  // more play, more tiers; and the pass's experience never comes from the hours alone
  assert.ok(passModel(2).tier > passModel(1).tier && passModel(3).tier > passModel(2).tier);
  assert.equal(passModel(0).xp, 0, 'no play, no experience');
});

// ------------------------------------------------------------------------------------------------ the tables

const all = (n: number, track: 'free' | 'premium'): PassReward[] => passSeason(n).tiers.flatMap((x) => x[track]);

test('the tables: 100 tiers each; something free on most; the premium richer; every 20th a milestone of men, an artifact, a cosmetic, a title, the hull at 100', () => {
  for (const n of [1, 2]) {
    const s = passSeason(n);
    assert.deepEqual(s.tiers.map((x) => x.t), Array.from({ length: 100 }, (_, i) => i + 1), `season ${n}: 100 tiers in order`);
    assert.ok(s.tiers.filter((x) => x.free.length).length >= 85, `season ${n}: something free on most tiers`);
    assert.ok(s.tiers.filter((x) => x.premium.length).length >= 75, `season ${n}: premium on many tiers`);
    for (const t of MILESTONES) {
      const p = s.tiers[t - 1].premium;
      assert.ok(p.some((r) => r.k === 'units' || r.k === 'ship'), `season ${n}, tier ${t}: men or the hull`);
    }
    const prem = all(n, 'premium');
    // men of tier 4–5, small stacks (5–10), line kinds — never a premium kind (only money buys those, premium.ts)
    const men = prem.filter((r): r is Extract<PassReward, { k: 'units' }> => r.k === 'units');
    assert.equal(men.length, 4);
    for (const m of men) {
      assert.ok(UNITS[m.u] && UNITS[m.u].tier >= 4 && UNITS[m.u].tier <= 5, m.u);
      assert.ok(m.n >= 5 && m.n <= 10, `${m.u} ×${m.n}`);
      assert.ok(!UNITS[m.u].premium, `${m.u}: not a premium kind`);
    }
    const arts = prem.filter((r): r is Extract<PassReward, { k: 'art' }> => r.k === 'art');
    assert.equal(arts.length, 2);
    for (const a of arts) assert.equal(ARTIFACTS[a.id]?.cls, 'major', `${a.id}: a rare artifact`);
    const cos = prem.filter((r): r is Extract<PassReward, { k: 'cos' }> => r.k === 'cos').map((r) => r.key);
    assert.ok(cos.filter((k) => k.startsWith('title:')).length >= 2, 'premium titles');
    assert.ok(cos.some((k) => k.startsWith('trail:')), 'an exclusive wake');
    for (const k of cos) assert.equal(cosItem(k)?.only, 'spass', `${k}: the pass's own`);
    assert.deepEqual(s.tiers[99].premium.find((r) => r.k === 'ship'), { k: 'ship', c: PASS_SHIP });
    // the free track barely moves the balance: no men, no artifacts, no hull, no elixirs, no resurrection
    for (const r of all(n, 'free')) assert.ok(['silver', 'res', 'speed', 'map', 'scrolls', 'kit', 'charm', 'cos'].includes(r.k), `free: ${r.k}`);
    for (const r of all(n, 'free')) if (r.k === 'cos') assert.equal(cosItem(r.key)?.only, 'spass');
  }
  assert.equal(levelRange(PASS_SHIP)[0], 7, 'the hull is of ⚓7');
  // every reward reads in both languages, with a picture
  for (const n of [1, 2]) for (const r of [...all(n, 'free'), ...all(n, 'premium')]) {
    const l = passLine(r, 50);
    assert.ok(l.icon && l.name[0] && l.name[1] && !/[A-Za-z]{3,}/.test(l.name[1]), `${JSON.stringify(r)}: ${l.name[1]}`);
  }
});

test('the premium track is meaningful but not dominant: each stack of men is a gift (never made good) and at most a sixth of the hammocks of the least ship that signs that tier on', () => {
  for (const r of all(1, 'premium')) {
    if (r.k !== 'units') continue;
    const lv = premiumFrom(UNITS[r.u].tier);
    const hulls = SHIP_CLASS_IDS.filter((c) => levelRange(c)[0] === lv);
    const least = Math.min(...hulls.map((c) => SHIP_CLASSES[c].crewMax));
    assert.ok(r.n <= least / 6, `${r.u} ×${r.n}: against ${least} hammocks at ⚓${lv}`);
  }
  // the line of a creature reward says it is a gift
  assert.match(passLine({ k: 'units', u: 'gunner', n: 6 }).hint![1], /подарочный/);
});

test('the challenges: three a day and four a week, drawn the same for the same account and day, the island\'s only with one', () => {
  const a = rollChallenges(42, 'day', 20400, true);
  assert.equal(a.length, 3);
  assert.deepEqual(rollChallenges(42, 'day', 20400, true), a);
  assert.equal(new Set(a).size, 3);
  assert.equal(rollChallenges(42, 'week', 2914, true).length, 4);
  for (let d = 0; d < 200; d++) for (const id of rollChallenges(7, 'day', d, false)) assert.ok(!CHALLENGES.find((c) => c.id === id)!.isle, id);
  for (const c of CHALLENGES) {
    assert.ok(c.need >= 1 && c.xp > 0);
    assert.ok(c.src.every((s) => s !== 'challenge'));
    assert.ok(!/[A-Za-z]/.test(c.text[1].replace('{n}', '')), c.id);
  }
});

// ------------------------------------------------------------------------------------------------ the experience

test('season experience comes from the substantial things, each within its day\'s cap; the challenges count and pay', () => {
  const { game, s } = aboard();
  const acc = s.accountId;
  assert.equal(passState(game, acc).xp, 0);
  seasonXp(game, s, 'contract');
  assert.equal(passState(game, acc).xp, PASS_XP.contract);
  // a quest of the board, past its cap: the rest teach her nothing of the season
  const st0 = passState(game, acc).xp;
  for (let i = 0; i < PASS_CAP.quest + 10; i++) seasonXp(game, s, 'quest');
  const got = passState(game, acc).xp - st0;
  const ch = passState(game, acc);
  const paid = [...ch.dch!.ids, ...ch.wch!.ids].filter((id, i) => (i < 3 ? ch.dch!.done[i] : ch.wch!.done[i - 3])).reduce((a, id) => a + CHALLENGES.find((c) => c.id === id)!.xp, 0);
  assert.equal(got - paid, PASS_CAP.quest * PASS_XP.quest, 'capped at the day\'s count');
  // a new day: the cap is new
  game.wallNow = () => T1 + 24 * H;
  const st1 = passState(game, acc).xp;
  seasonXp(game, s, 'quest');
  assert.ok(passState(game, acc).xp >= st1 + PASS_XP.quest);
  // a source that is not one: nothing (the sailing, the sinking of the sea's ships never call it)
  const st2 = passState(game, acc).xp;
  seasonXp(game, s, 'sailing' as never);
  assert.equal(passState(game, acc).xp, st2);
  // a challenge done pays its own experience at once
  const day = passState(game, acc).dch!;
  const c = CHALLENGES.find((x) => x.id === day.ids[0])!;
  const before = passState(game, acc).xp;
  for (let i = 0; i < c.need; i++) seasonXp(game, s, c.src[0]);
  const after = passState(game, acc);
  assert.ok(after.dch!.done[0], `${c.id} done`);
  assert.ok(after.xp - before >= c.xp, 'its experience paid');
});

test('the game’s own moments feed it: a contract delivered (Game.ts completeContract), a building of her island finished while she is away', () => {
  const { game, s } = aboard('Hook Hana');
  const acc = s.accountId;
  s.profile!.contracts.push({ id: 'c-pass', kind: 'courier', title: 'A letter to Tidewrack', fromPort: 'gravesend', toPort: 'tidewrack', reward: 100, xp: 10, expiresAt: game.now + 9999, description: '' });
  (game as unknown as { completeContract(s: PlayerSession, id: string): void }).completeContract(s, 'c-pass');
  const st = passState(game, acc);
  assert.equal(st.count.contract, 1, 'the day’s count of contracts');
  assert.ok(st.xp >= PASS_XP.contract);
});

test('a captain beaten counts once in six hours, and not a much weaker one', () => {
  const { game, s } = aboard();
  const acc = s.accountId;
  s.profile!.level = 20;
  assert.equal(passPvp(game, s, 999, 20), true);
  assert.equal(passPvp(game, s, 999, 20), false, 'the same one again');
  assert.equal(passPvp(game, s, 998, 10), false, 'ten levels below');
  assert.equal(passPvp(game, s, acc, 20), false, 'herself');
  game.wallNow = () => T1 + 6 * H + 1;
  assert.equal(passPvp(game, s, 999, 20), true, 'six hours later');
  assert.ok(passState(game, acc).xp >= 2 * PASS_XP.pvp);
});

test('a tier up says so once, and the HUD\'s count of rewards waiting', () => {
  const { game, s } = aboard();
  const conn = (s as unknown as { conn: { inbox: { t: string; msg?: string }[] } }).conn;
  adminPass(game, s, ['xp', String(xpToTier(2) - 10)]);
  for (let i = 0; i < 3; i++) seasonXp(game, s, 'contract');
  const toasts = conn.inbox.filter((m) => m.t === 'toast' && /Season card: tier \d+/.test(m.msg ?? ''));
  assert.ok(toasts.length >= 1);
  const v = conn.inbox.filter((m) => m.t === 'spass').pop() as unknown as { view: { tier: number; claim: number } };
  assert.ok(v.view.tier >= 2 && v.view.claim >= 2, 'free rewards of the tiers reached wait');
});

// ------------------------------------------------------------------------------------------------ the claims

test('claims: a free tier once; a tier not reached, the premium track without the pass refused; with it, taken once too', () => {
  const { game, db, s } = aboard();
  const acc = s.accountId;
  adminPass(game, s, ['tier', '12']);
  const gold = s.profile!.gold;
  assert.equal(claimTier(game, s, 1, 'free'), null);
  assert.ok(s.profile!.gold > gold, 'tier 1: silver');
  assert.match(claimTier(game, s, 1, 'free') ?? '', /taken already/);
  assert.match(claimTier(game, s, 13, 'free') ?? '', /not reached/);
  assert.match(claimTier(game, s, 1, 'premium') ?? '', /Premium Pass/);
  // the pass laid on (the admin's grant), the premium of tier 1: auto-battle scrolls and an elixir
  adminPass(game, s, ['grant', 'premium', s.name]);
  const scrolls = db.scrolls(acc);
  assert.equal(claimTier(game, s, 1, 'premium'), null);
  assert.equal(db.scrolls(acc), scrolls + 3);
  assert.ok(shopState(game, acc).xp > game.wallNow(), 'the elixir runs');
  assert.match(claimTier(game, s, 1, 'premium') ?? '', /taken already/);
  // «Забрать всё»: the rest up to her tier
  const r = claimAll(game, s);
  assert.ok(r.n >= 18, `${r.n} taken`);
  const st = passState(game, acc);
  assert.equal(st.free.length, 12);
  assert.equal(st.prem.filter((t) => t <= 12).length, passSeason(1).tiers.slice(0, 12).filter((x) => x.premium.length).length);
  assert.equal(claimAll(game, s).n, 0, 'nothing twice');
});

test('a milestone: the men by letter as a gift\'s stack, the title hers; the 100th tier\'s hull into a berth (a second one: its stand-in)', () => {
  const { game, s } = aboard();
  const acc = s.accountId;
  adminPass(game, s, ['grant', 'premium', s.name]);
  adminPass(game, s, ['tier', '100']);
  const t0 = game.wallNow();
  // tier 4 men serve a ship of ⚓3 and up (the Super Pass's twenty tiers put none on a newcomer's sloop)
  shipAtLevel(game, s, 1);
  assert.match(claimTier(game, s, 20, 'premium') ?? '', /Creatures of tier 4 serve a ship of level 3 and up/);
  shipAtLevel(game, s, 5);
  assert.equal(claimTier(game, s, 20, 'premium'), null);
  const letter = lettersSince(game, acc, t0).find((l) => l.units);
  assert.deepEqual(letter?.units, { u: 'gunner', n: 6, gift: 1 });
  forgetCos(game, acc);
  assert.ok(ownsCos(game, acc, 'title:stormwolf'));
  // the hull asks her level
  s.profile!.level = 1;
  assert.match(claimTier(game, s, 100, 'premium') ?? '', /Captain level \d+ is needed/);
  s.profile!.level = 40;
  const berths = s.profile!.berths.length;
  assert.equal(claimTier(game, s, 100, 'premium'), null);
  assert.equal(s.profile!.berths.length, berths + 1);
  assert.equal(s.profile!.berths.at(-1)!.loadout.classId, PASS_SHIP);
  assert.ok(ownsCos(game, acc, 'title:stormlord'));
  // an artifact asks room in her locker
  s.profile!.stash = Array.from({ length: 40 }, (_, i) => ({ ...(s.profile!.stash[0] ?? {}), id: 9000 + i }) as never);
  assert.match(claimTier(game, s, 40, 'premium') ?? '', /locker is full/);
});

// ------------------------------------------------------------------------------------------------ the passes

test('the prices: 790, 1 350 and the step of 560 ₽; Stars at ¾ of a rouble\'s doubloon, votes at seven roubles — the step is the difference on every desk', () => {
  assert.deepEqual([PASS_PRICES.pass_premium.rub, PASS_PRICES.pass_super.rub, PASS_PRICES.pass_upgrade.rub], [790, 1350, 560]);
  assert.deepEqual([PASS_PRICES.pass_premium.stars, PASS_PRICES.pass_super.stars, PASS_PRICES.pass_upgrade.stars], [593, 1013, 420]);
  assert.deepEqual([PASS_PRICES.pass_premium.votes, PASS_PRICES.pass_super.votes, PASS_PRICES.pass_upgrade.votes], [113, 193, 80]);
  for (const k of ['rub', 'stars', 'votes'] as const) assert.equal(PASS_PRICES.pass_premium[k] + PASS_PRICES.pass_upgrade[k], PASS_PRICES.pass_super[k], k);
  assert.ok(passProductOpen(PASS_PRICES.pass_premium, null) && passProductOpen(PASS_PRICES.pass_super, null) && !passProductOpen(PASS_PRICES.pass_upgrade, null));
  assert.ok(!passProductOpen(PASS_PRICES.pass_premium, 'premium') && passProductOpen(PASS_PRICES.pass_upgrade, 'premium') && passProductOpen(PASS_PRICES.pass_super, 'premium'));
  assert.ok(!passProductOpen(PASS_PRICES.pass_super, 'super') && !passProductOpen(PASS_PRICES.pass_upgrade, 'super'));
});

test('the Super Pass: the premium track, +20 tiers at once (the progress kept) and the Abyssal frame; the step from the Premium Pass the same', () => {
  const { game, db, s } = aboard();
  const acc = s.accountId;
  adminPass(game, s, ['xp', String(xpToTier(3) + 100)]);
  assert.equal(passPaid(game, acc, 'pass_super', 'test:sup-1', 1350), null);
  const st = passState(game, acc);
  assert.equal(st.has, 'super');
  assert.equal(tierOf(st.xp).tier, 3 + SUPER_TIERS);
  assert.equal(tierOf(st.xp).into, 100, 'the way into the next tier kept');
  forgetCos(game, acc);
  assert.ok(ownsCos(game, acc, SUPER_FRAME));
  assert.equal(db.doubloons(acc), 0, 'its roubles came in as doubloons and went on the pass');
  // the step: premium first, then the difference
  const b = aboard('Step Sally');
  const a2 = b.s.accountId;
  assert.equal(passPaid(b.game, a2, 'pass_premium', 'test:p-1', 790), null);
  assert.equal(passState(b.game, a2).has, 'premium');
  assert.equal(tierOf(passState(b.game, a2).xp).tier, 0);
  assert.equal(passPaid(b.game, a2, 'pass_upgrade', 'test:u-1', 560), null);
  assert.equal(passState(b.game, a2).has, 'super');
  assert.equal(tierOf(passState(b.game, a2).xp).tier, SUPER_TIERS);
  // near the top: no more than the 100th
  const c = aboard('Top Tess');
  adminPass(c.game, c.s, ['tier', '95']);
  passPaid(c.game, c.s.accountId, 'pass_super', 'test:t-1', 1350);
  assert.equal(tierOf(passState(c.game, c.s.accountId).xp).tier, 100);
});

test('a payment is a pass once: the same reference again changes nothing; a pass she holds already leaves the doubloons on her account', () => {
  const { game, db, s } = aboard();
  const acc = s.accountId;
  assert.equal(passPaid(game, acc, 'pass_premium', 'web:aaa', 790), null);
  assert.equal(passPaid(game, acc, 'pass_premium', 'web:aaa', 790), null, 'a repeated notice');
  assert.equal(db.doubloons(acc), 0);
  assert.equal(ledger(db, acc, 'doubloons_pay').length, 1);
  assert.equal(ledger(db, acc, 'doubloons_buy').filter((r) => r.detail.includes('pass_premium')).length, 1);
  // a second payment for the pass she holds: the doubloons stay
  assert.match(passPaid(game, acc, 'pass_premium', 'web:bbb', 790) ?? '', /hold this pass already/);
  assert.equal(db.doubloons(acc), 790);
  // the purchase itself refuses the poor
  const b = aboard('Poor Pete');
  assert.match(passBuy(b.game, b.s.accountId, 'pass_premium', 'x') ?? '', /Not enough doubloons/);
  assert.equal(passState(b.game, b.s.accountId).has, null);
});

test('the web shop sells the passes (the site and the game\'s «Купить»): an order paid grants the pass once; the one she holds is «owned»', async () => {
  const { game, s } = aboard('Web Wendy');
  const acc = s.accountId;
  const shop = new WebShop(game, { provider: null, returnUrl: 'https://gravetidegame.com/site/shop/', payTest: true, log: () => {}, pumpMs: 0 });
  for (const id of ['pass_premium', 'pass_super', 'pass_upgrade']) assert.equal(webItem(id)?.kind, 'pass');
  assert.equal(shop.unavailable(acc).pass_upgrade, 'owned', 'the step needs the Premium Pass first');
  const r = await shop.orderInGame(acc, 'pass_premium', 'ru');
  assert.ok('orderId' in r);
  assert.equal(await shop.settleTest(r.orderId, true), true);
  assert.equal(shop.get(r.orderId)?.status, 'done');
  assert.equal(passState(game, acc).has, 'premium');
  // a second notice of the same payment: nothing more
  await shop.settleTest(r.orderId, true);
  assert.equal(game.db.doubloons(acc), 0);
  assert.equal(shop.unavailable(acc).pass_premium, 'owned');
  assert.equal(shop.unavailable(acc).pass_upgrade, undefined);
  // its card on the site
  const d = webDetail('pass_super', () => '/x.webp');
  assert.ok(d && d.facts.super === true && d.facts.great === 10);
});

test('VK votes buy a pass: get_item names it at its votes; a chargeable order grants it once', () => {
  const { game, db } = makeGame();
  game.wallNow = () => T1;
  const SECRET = 'qa-secret';
  const vk = new VkService({ db, auth: game.auth, game, appId: 5, secret: SECRET, publicUrl: 'https://gravetidegame.com', log: () => {} });
  const acc = db.createAccount('Vk Vera', 'h-vk');
  db.linkOAuth('vk', '4242', acc);
  const form = (p: Record<string, string>) => ({ ...p, sig: paySig(p, SECRET) });
  const item = vk.pay(form({ app_id: '5', item: 'pass_super', lang: 'ru_RU', notification_type: 'get_item', user_id: '4242' })) as { response: { price: number; title: string } };
  assert.equal(item.response.price, 193);
  assert.equal(item.response.title, 'Суперпропуск');
  const ord = form({ app_id: '5', item: 'pass_super', item_id: 'pass_super', item_price: '193', notification_type: 'order_status_change', order_id: '777', receiver_id: '4242', status: 'chargeable', user_id: '4242' });
  const a = vk.pay(ord) as { response: { order_id: number } };
  assert.equal(a.response.order_id, 777);
  assert.equal(passState(game, acc).has, 'super');
  vk.pay(ord);
  assert.equal(db.doubloons(acc), 0, 'once');
  // a price below the votes is refused
  const cheap = vk.pay(form({ app_id: '5', item: 'pass_premium', item_id: 'pass_premium', item_price: '50', notification_type: 'order_status_change', order_id: '778', receiver_id: '4242', status: 'chargeable', user_id: '4242' })) as { error?: unknown };
  assert.ok(cheap.error);
});

// ------------------------------------------------------------------------------------------------ the season's end

test('a season ends: the rewards earned and not taken are delivered (silver by letter, men by letter, the stores at once, the rest when she is aboard), then the card starts again', () => {
  const { game, db, s } = aboard('Late Lou');
  const acc = s.accountId;
  adminPass(game, s, ['grant', 'premium', s.name]);
  adminPass(game, s, ['tier', '45']);
  assert.equal(claimTier(game, s, 1, 'free'), null);
  const scrolls = db.scrolls(acc);
  const t0 = game.wallNow();
  // the next season (the admin's shift, as the calendar's turn)
  game.db.setKv('spass:shift', 1);
  assert.equal(seasonNow(game), 2);
  const st = passState(game, acc);
  assert.equal(st.season, 2);
  assert.equal(st.xp, 0);
  assert.equal(st.has, null, 'a pass is a season\'s');
  assert.deepEqual([st.free, st.prem], [[], []]);
  const letters = lettersSince(game, acc, t0);
  const summary = letters.find((l) => /Season 1 is over/.test(l.subject));
  assert.ok(summary && summary.gold > 0, 'silver in the letter');
  assert.ok(st.carry.filter((r) => r.k === 'units').length === 2, 'the men of tiers 20 and 40 wait for her ship to serve them');
  assert.ok(db.scrolls(acc) > scrolls, 'the auto-battle scrolls on her account at once');
  assert.ok(st.carry.some((r) => r.k === 'art') && st.carry.some((r) => r.k === 'map'), 'the artifact and the maps wait for her aboard');
  // read again: nothing twice
  passState(game, acc);
  assert.equal(lettersSince(game, acc, t0).length, letters.length);
  // she comes aboard: what waited is handed over (her ship serving the men's tiers)
  shipAtLevel(game, s, 5);
  forgetShop(game, acc);
  const stash = s.profile!.stash.length;
  passOnLogin(game, s);
  assert.equal(s.profile!.stash.length, stash + 1, 'the artifact in her locker');
  assert.equal(lettersSince(game, acc, t0).filter((l) => l.units).length, 2, 'the men by letter, each a gift stack');
  assert.ok(!passState(game, acc).carry.some((r) => r.k === 'art'));
});

test('the season\'s end for a captain away: the letter waits for her; her card is closed on its first read', async () => {
  const { game, db } = makeGame();
  game.wallNow = () => T1;
  const acc = db.createAccount('Away Ann', 'h-away');
  const { addPassXp } = await import('../server/src/game/seasonpass.ts');
  for (let i = 0; i < 8; i++) addPassXp(game, acc, 'isle');
  assert.ok(passState(game, acc).xp > 0, 'her island\'s builders count while she is away');
  game.wallNow = () => passBounds(2).from + H;
  const st = passState(game, acc);
  assert.equal(st.season, 2);
  assert.equal(st.xp, 0);
});

// ------------------------------------------------------------------------------------------------ the exclusives

test('the hull and the frame of the pass are off the doubloon shop (the game\'s and the site\'s); a captain who has them keeps them', () => {
  assert.ok(SHIP_CLASSES[PASS_SHIP].premium?.pass);
  assert.ok(!premiumShips().includes(PASS_SHIP));
  assert.ok(!gameShopIds().includes(`ship_${PASS_SHIP}`));
  assert.equal(webItem(`ship_${PASS_SHIP}`), undefined);
  assert.ok(!WEB_ITEMS.some((x) => x.ship === PASS_SHIP));
  const frame = FRAMES.find((f) => `frame:${f.id}` === SUPER_FRAME)!;
  assert.equal(frame.price, undefined);
  assert.equal(frame.only, 'spass_super');
  assert.ok(!OFFERS.has('cos_frame_abyss'));
  assert.equal(webItem('cos_frame_abyss'), undefined);
  // the shop refuses the hull for doubloons
  const { game, db, s } = aboard('Rich Rita');
  game.db.addDoubloons(s.accountId, 20_000);
  s.ship!.docked = 'gravesend';
  s.profile!.level = 40;
  assert.equal(buyShip(game, s, PASS_SHIP), 'Not for sale');
  // one who bought the frame before keeps it
  const st = cosState(game, s.accountId);
  st.own.push(SUPER_FRAME);
  db.setKv(`cos:${s.accountId}`, st);
  forgetCos(game, s.accountId);
  assert.ok(ownsCos(game, s.accountId, SUPER_FRAME));
});

// ------------------------------------------------------------------------------------------------ the words and the HUD

test('the words: the server\'s lines in Russian, the window\'s both languages, the button in the «⋯» tray', () => {
  setLang('ru');
  assert.equal(serverText('Season card: tier 7!'), 'Сезонная карта: ступень 7!');
  assert.equal(serverText('Season card rewards taken: tier 3.'), 'Награды сезонной карты получены: ступень 3.');
  const nb = (x: string) => x.replace(/ /g, ' ');
  assert.equal(nb(serverText('Premium Pass is yours for this season!')), 'Премиум-пропуск на этот сезон — ваш!');
  const c = CHALLENGES[0];
  assert.equal(nb(serverText(`Season challenge done: ${c.text[0].replace('{n}', String(c.need))} (+${c.xp} season XP).`)), `Испытание сезона выполнено: ${c.text[1].replace('{n}', String(c.need))} (+${c.xp} опыта сезона).`);
  setLang('en');
  for (const [en, ru] of passPatterns()) assert.ok(!/[A-Za-z]{2,}/.test(ru.replace(/\{\d\}|\/pass|grant|premium|super|xp|tier|season|next|reset|N\b/g, '')), `${en} → ${ru}`);
  assert.deepEqual(Object.keys(SP_RU).sort(), Object.keys(SP_EN).sort());
  assert.ok(MORE_ITEMS.includes('#touch > #tc-pass' as never));
});
