// The retention batch (owner, 2026-10-16, «да»): the daily login gift (shared/src/data/dailygift.ts,
// server/src/game/dailygift.ts) — once a UTC day by the server's clock, the streak and its one day of grace, the
// rewards and their modesty; the Telegram notices (server/src/game/tgnotify.ts) — her yes, each kind's switch, the cap
// of three a Moscow day, the quiet hours 23:00–09:00, the gaps, «давно не заходили» once, the bot blocked (403) turning
// them off, the deep link and «Отключить» under each, the Mini App's write access; every word in both languages.
// No real Telegram: the Bot API is faked (fakeBotApi or a stub answering 403).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GIFT_GRACE, GIFT_TRACK, GIFT_WEEK, giftOf, giftSlot, giftStreak, giftView } from '../shared/src/data/dailygift.ts';
import { TGN_CATS, TG_TEXTS } from '../shared/src/data/telegram.ts';
import { claimGift, giftState, giftViewFor } from '../server/src/game/dailygift.ts';
import { TGN_CAP, judge, moscowHour, newTgnState, noticeLink, notify, quietHours, setNoticeDesk, setNotices, stepNotices, tgnState, tgnView } from '../server/src/game/tgnotify.ts';
import type { NoticeDesk, TgnState } from '../server/src/game/tgnotify.ts';
import { TelegramService, fakeBotApi, signInitData } from '../server/src/telegram.ts';
import type { FetchFn, TgUpdate } from '../server/src/telegram.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { EN as G_EN, RU as G_RU } from '../client/src/lang/ui/dailygift.ts';
import { extract } from '../tools/i18n-server.ts';
import { join, makeGame, steps } from './helpers.ts';

const DAY = 86_400_000;
const H = 3_600_000;
/** 09:00 UTC = 12:00 Moscow: out of the quiet hours. */
const NOON_MSK = 20_000 * DAY + 9 * H;

function world(at = NOON_MSK) {
  const w = makeGame();
  const clock = { t: at };
  w.game.wallNow = () => clock.t;
  return { ...w, clock };
}

function captain(game: Game, name: string): { s: PlayerSession; conn: ReturnType<typeof join> } {
  const conn = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.level = 10;
  return { s, conn };
}

// ------------------------------------------------------------------------------------------------ the gift's table

test('the gift grows day by day through a week; the seventh brings doubloons, the fourth week the most; modest by docs/32', () => {
  const L = 10;
  const week = Array.from({ length: GIFT_WEEK }, (_, i) => giftOf(i + 1, L));
  assert.ok(week[0].silver! > 0 && !week[0].doubloons);
  assert.ok(week[1].res?.timber && week[1].res?.iron, 'day 2: the island\'s stuff');
  assert.ok(week[2].speed && week[2].silver! > week[0].silver!, 'day 3: more silver and speed-ups');
  assert.ok(week[3].speed! > week[2].speed!, 'day 4: more speed-ups');
  assert.equal(week[4].scrolls, 1, 'day 5: an auto-battle scroll');
  assert.ok(week[5].silver! > week[2].silver! && week[5].res, 'day 6');
  assert.equal(week[6].doubloons, 10, 'day 7: a few doubloons');
  assert.equal(giftOf(28, L).doubloons, 25, 'the fourth week\'s seventh day');
  assert.ok(giftOf(22, L).silver! > giftOf(1, L).silver!, 'the later weeks pay more');
  // the whole track: under one day of the captain's subscription (100 doubloons a day, docs/32) in doubloons
  let dbl = 0, scrolls = 0, speed = 0;
  for (let d = 1; d <= GIFT_TRACK; d++) {
    const g = giftOf(d, L);
    dbl += g.doubloons ?? 0;
    scrolls += g.scrolls ?? 0;
    speed += g.speed ?? 0;
  }
  assert.equal(dbl, 55);
  assert.ok(dbl < 100 && scrolls <= 6 && speed <= 40, `${dbl} doubloons, ${scrolls} scrolls, ${speed} speed-ups in 28 days`);
  // the 29th day starts the track's first week again
  assert.deepEqual(giftSlot(29), { week: 0, day: 1 });
  assert.deepEqual(giftSlot(28), { week: 3, day: 7 });
});

test('the streak: the next day goes on; one missed day is forgiven (the grace); two start the track again', () => {
  assert.equal(GIFT_GRACE, 1);
  assert.equal(giftStreak(-1, 0, 100), 1, 'the first claim');
  assert.equal(giftStreak(99, 4, 100), 5, 'yesterday');
  assert.equal(giftStreak(98, 4, 100), 5, 'one day missed: kept');
  assert.equal(giftStreak(97, 4, 100), 1, 'two days missed: again from the first');
  assert.equal(giftStreak(100, 4, 100), 4, 'today already');
  const v = giftView(98, 4, 100, 10, 100 * DAY);
  assert.ok(v.can && v.kept && !v.reset && v.day === 5 && v.cells.length === 7);
  const r = giftView(90, 6, 100, 10, 100 * DAY);
  assert.ok(r.can && r.reset && r.day === 1);
});

// ------------------------------------------------------------------------------------------------ the claim

test('the gift is taken once a UTC day by the server\'s clock: a second claim, a repeated message, pays nothing', () => {
  const { game, db, clock } = world();
  const { s, conn } = captain(game, 'Gift Gale');
  assert.ok(conn.last('gift')?.view.can, 'the calendar comes aboard with her, its gift to take');
  const g0 = s.profile!.gold;
  const r1 = claimGift(game, s);
  assert.ok('got' in r1 && r1.got.silver! > 0);
  assert.equal(s.profile!.gold, g0 + r1.got.silver!);
  const r2 = claimGift(game, s);
  assert.ok('why' in r2, 'the same day: refused');
  assert.equal(s.profile!.gold, g0 + (r1 as { got: { silver: number } }).got.silver);
  conn.push({ t: 'premium', action: 'gift_claim' });
  assert.equal(s.profile!.gold, g0 + (r1 as { got: { silver: number } }).got.silver, 'a repeated message pays nothing');
  assert.equal(giftState(game, s.accountId).total, 1);
  // the next UTC day: day 2 (the island's stuff, in silver with no island)
  clock.t += DAY;
  assert.equal(giftViewFor(game, s).day, 2);
  const r3 = claimGift(game, s);
  assert.ok('got' in r3 && r3.got.silver! > 0 && !r3.got.res, 'no island: the stuff paid in silver');
  // days 3–7, the doubloons on the seventh with their own ledger row, once
  for (let d = 3; d <= 7; d++) {
    clock.t += DAY;
    const r = claimGift(game, s);
    assert.ok('got' in r, `day ${d}`);
    if (d === 5) assert.equal(r.got.scrolls, 1);
    if (d === 7) assert.equal(r.got.doubloons, 10);
  }
  assert.equal(db.doubloons(s.accountId), 10);
  assert.equal(db.scrolls(s.accountId) >= 1, true);
  assert.equal(giftState(game, s.accountId).streak, 7);
});

test('a missed day keeps the streak, two missed start it again; the client\'s message gets the gift and what it held', () => {
  const { game, clock } = world();
  const { s, conn } = captain(game, 'Grace Grey');
  conn.push({ t: 'premium', action: 'gift_claim' });
  const m = conn.last('gift')!;
  assert.ok(m.got && !m.view.can && m.view.streak === 1);
  clock.t += 2 * DAY; // one day missed
  assert.ok(giftViewFor(game, s).kept);
  conn.push({ t: 'premium', action: 'gift_claim' });
  assert.equal(giftState(game, s.accountId).streak, 2);
  clock.t += 3 * DAY; // two days missed
  const v = giftViewFor(game, s);
  assert.ok(v.reset && v.day === 1);
  conn.push({ t: 'premium', action: 'gift_claim' });
  assert.equal(giftState(game, s.accountId).streak, 1);
  // a new UTC day sends the calendar again by itself (stepGift, from the game's second)
  const n = conn.all('gift').length;
  clock.t += DAY;
  steps(game, 25);
  assert.ok(conn.all('gift').length > n, 'the new day\'s calendar');
});

test('/gift for the tester: set a day, claim, reset — in HELP in both languages', () => {
  const { game } = world();
  const { s } = captain(game, 'Admin Ada');
  const out = runAdmin(game, s, '/gift day 6');
  assert.match(String(out), /day 7 of week 1, streak 7, ready to take/);
  assert.match(String(runAdmin(game, s, '/gift claim')), /taken today/);
  assert.match(String(runAdmin(game, s, '/gift reset')), /day 1 of week 1/);
  const help = Object.keys(SERVER_RU_ADMIN).find((k) => k.startsWith('/speed N') && k.includes('/offers'))!;
  assert.match(help, /\/gift \[reset\|day N\|claim\]/);
  assert.match(SERVER_RU_ADMIN[help], /\/gift \[reset\|day N\|claim\]/);
});

// ------------------------------------------------------------------------------------------------ the rules

const yes = (o: Partial<TgnState> = {}): TgnState => ({ ...newTgnState(4242, 'ru'), on: true, ...o });

test('notices: only with her yes and the kind on, never while aboard; three a Moscow day; the gaps', () => {
  const t = NOON_MSK;
  assert.equal(judge(newTgnState(0), 'build', t, false).v, 'drop', 'no Telegram');
  assert.equal(judge(newTgnState(4242), 'build', t, false).why, 'unasked', 'never asked: nothing');
  assert.equal(judge(yes({ on: false }), 'build', t, false).why, 'unasked', 'she said no');
  assert.equal(judge(yes(), 'build', t, false).v, 'send');
  assert.equal(judge(yes({ cats: { build: false } }), 'build', t, false).why, 'kindoff');
  assert.equal(judge(yes(), 'boss', t, false).why, 'kindoff', 'the zone boss is off unless she asks');
  assert.equal(judge(yes({ cats: { boss: true } }), 'boss', t, false).v, 'send');
  assert.equal(judge(yes(), 'raid', t, true).why, 'aboard');
  assert.equal(judge(yes({ blocked: true }), 'raid', t, false).why, 'blocked');
  // the cap: three a Moscow day, all kinds together; a new Moscow day starts again
  const day = Math.floor((t + 3 * H) / DAY);
  assert.equal(TGN_CAP, 3);
  assert.equal(judge(yes({ day, n: 2 }), 'raid', t, false).v, 'send');
  assert.equal(judge(yes({ day, n: 3 }), 'raid', t, false).why, 'cap');
  assert.equal(judge(yes({ day: day - 1, n: 3 }), 'raid', t, false).v, 'send');
  // the gaps: the gift and the offer once a Moscow day; the island's work every two hours; the idle word once
  assert.equal(judge(yes({ last: { offer: t - 3 * H } }), 'offer', t, false).why, 'gap');
  assert.equal(judge(yes({ last: { offer: t - 13 * H } }), 'offer', t + 10 * H, false).v, 'send', 'the next Moscow day');
  assert.equal(judge(yes({ last: { build: t - H } }), 'build', t, false).why, 'gap');
  assert.equal(judge(yes({ last: { build: t - 3 * H } }), 'build', t, false).v, 'send');
  assert.equal(judge(yes({ idle: true }), 'idle', t, false).why, 'once');
});

test('the quiet hours 23:00–09:00 Moscow: the island\'s news waits for the morning, the rest is not sent', () => {
  const night = 20_000 * DAY + 21 * H; // 00:00 Moscow
  assert.equal(moscowHour(night), 0);
  assert.ok(quietHours(night) && quietHours(20_000 * DAY + 20 * H) && quietHours(20_000 * DAY + 5 * H));
  assert.ok(!quietHours(20_000 * DAY + 6 * H), '09:00 Moscow');
  assert.ok(!quietHours(20_000 * DAY + 19 * H), '22:00 Moscow');
  assert.equal(judge(yes(), 'build', night, false).v, 'defer');
  assert.equal(judge(yes(), 'raid', night, false).v, 'defer');
  for (const c of ['daily', 'offer', 'boss', 'idle'] as const) assert.equal(judge(yes({ cats: { boss: true } }), c, night, false).v, 'drop', c);
});

// ------------------------------------------------------------------------------------------------ sending

function desk(answer: 'ok' | 'blocked' | 'error' = 'ok'): NoticeDesk & { sent: { chat: number; cat: string; text: string }[] } {
  const sent: { chat: number; cat: string; text: string }[] = [];
  return { sent, send: async (chat, cat, text) => (sent.push({ chat, cat, text }), answer) };
}

/** A captain signed in with Telegram and gone away. */
function awayCaptain(game: Game, name: string, consent = true): number {
  const { s, conn } = captain(game, name);
  noticeLink(game, s.accountId, 5000 + s.accountId, 'ru', consent);
  conn.close();
  return s.accountId;
}

test('a notice goes to her chat in her language, counted; the day\'s cap holds across kinds; aboard nothing is sent', async () => {
  const { game, clock } = world();
  const d = desk();
  setNoticeDesk(game, d);
  const acc = awayCaptain(game, 'Note Nell');
  assert.equal(await notify(game, acc, 'build'), 'send');
  assert.equal(d.sent.length, 1);
  assert.equal(d.sent[0].chat, 5000 + acc);
  assert.equal(d.sent[0].text, TG_TEXTS['n.build'][1].replace('{name}', 'Note Nell'));
  assert.equal(await notify(game, acc, 'raid', { mins: 10 }), 'send');
  assert.match(d.sent[1].text, /До высадки 10 мин/);
  assert.equal(await notify(game, acc, 'raid', {}, 'n.rob'), 'drop', 'the raid\'s gap');
  clock.t += 2 * H + 1;
  assert.equal(await notify(game, acc, 'build'), 'send', 'the third');
  clock.t += 2 * H + 1;
  assert.equal(await notify(game, acc, 'raid'), 'drop', 'the fourth of the day: the cap');
  assert.equal(d.sent.length, 3);
  assert.equal(tgnView(game, acc)!.sent, 3);
  // aboard: nothing is sent while she plays
  clock.t += DAY;
  const { s } = captain(game, 'Here Hana');
  noticeLink(game, s.accountId, 77, 'ru', true);
  assert.equal(await notify(game, s.accountId, 'raid'), 'drop');
  assert.equal(d.sent.length, 3);
  setNoticeDesk(game, null);
});

test('the bot blocked (403): her notices stop until she turns them on again in the settings', async () => {
  const { game } = world();
  const d = desk('blocked');
  setNoticeDesk(game, d);
  const acc = awayCaptain(game, 'Blocked Bea');
  assert.equal(await notify(game, acc, 'build'), 'drop');
  assert.equal(tgnState(game, acc)!.blocked, true);
  assert.equal(tgnView(game, acc)!.on, false);
  assert.equal(await notify(game, acc, 'raid'), 'drop');
  assert.equal(d.sent.length, 1, 'tried once, then never again');
  setNotices(game, acc, 'all', true);
  assert.equal(tgnState(game, acc)!.blocked, false);
  setNoticeDesk(game, desk());
  assert.equal(await notify(game, acc, 'raid'), 'send');
  setNoticeDesk(game, null);
});

test('opt-out: all of them or one kind off from the settings; without her yes nothing is sent', async () => {
  const { game } = world();
  const d = desk();
  setNoticeDesk(game, d);
  const never = awayCaptain(game, 'Never Asked', false);
  assert.equal(await notify(game, never, 'build'), 'drop');
  const acc = awayCaptain(game, 'Opt Olga');
  setNotices(game, acc, 'build', false);
  assert.equal(await notify(game, acc, 'build'), 'drop');
  assert.equal(await notify(game, acc, 'raid'), 'send');
  setNotices(game, acc, 'all', false);
  assert.equal(await notify(game, acc, 'raid'), 'drop');
  assert.equal(d.sent.length, 1);
  // the client's switch through the wire
  const { s, conn } = captain(game, 'Wire Wanda');
  noticeLink(game, s.accountId, 78, 'ru', true);
  setNotices(game, s.accountId, 'build', false);
  const acc2 = s.accountId;
  conn.push({ t: 'premium', action: 'tgn_set', cat: 'all', on: true, lang: 'en' });
  const v = conn.last('tgn')!.view;
  assert.ok(v.on && !v.cats.build && v.cats.raid && !v.cats.boss);
  assert.equal(tgnState(game, acc2)!.lang, 'en');
  conn.push({ t: 'premium', action: 'tgn_set', cat: 'boss', on: true });
  assert.ok(conn.last('tgn')!.view.cats.boss);
  setNoticeDesk(game, null);
});

test('once a minute to captains away: the morning\'s kept news, the gift ready, the offer\'s last hour, «давно не заходили» once', async () => {
  const night = 20_000 * DAY + 21 * H; // 00:00 Moscow
  const { game, clock } = world(night);
  const d = desk();
  setNoticeDesk(game, d);
  const acc = awayCaptain(game, 'Step Stella');
  // at night: the island's work waits for the morning; the gift is not told
  assert.equal(await notify(game, acc, 'build'), 'defer');
  await Promise.all(stepNotices(game, true));
  assert.equal(d.sent.length, 0);
  // 09:00 Moscow: the kept news, and the gift ready (one claim before, so a streak is waiting)
  clock.t = 20_001 * DAY + 6 * H;
  await Promise.all(stepNotices(game, true));
  assert.deepEqual(d.sent.map((x) => x.cat).sort(), ['build', 'daily']);
  assert.match(d.sent.find((x) => x.cat === 'daily')!.text, /награда за вход/);
  // the gift is told once a day
  clock.t += 2 * H;
  await Promise.all(stepNotices(game, true));
  assert.equal(d.sent.filter((x) => x.cat === 'daily').length, 1);
  // three days away (from 00:00 Moscow of the first night): the idle word once, nothing about the gift after that
  clock.t = 20_004 * DAY + 9 * H;
  await Promise.all(stepNotices(game, true));
  await Promise.all(stepNotices(game, true));
  clock.t += DAY;
  await Promise.all(stepNotices(game, true));
  assert.equal(d.sent.filter((x) => x.cat === 'idle').length, 1);
  assert.equal(d.sent.filter((x) => x.cat === 'daily').length, 1);
  setNoticeDesk(game, null);
});

// ------------------------------------------------------------------------------------------------ the bot

const TOKEN = '123456:TEST-token_for-the-fake-bot';

function bot(fetchFn: FetchFn, mainApp = false) {
  const { game, db, clock } = world();
  const tg = new TelegramService({ db, auth: game.auth, game, token: TOKEN, fetch: fetchFn, publicUrl: 'https://gravetidegame.com', webappUrl: 'https://tg.gravetidegame.com', now: () => clock.t, log: () => {}, mainApp });
  return { game, db, clock, tg };
}

function initData(user: Record<string, unknown>, authDate: number): string {
  const fields: Record<string, string> = { auth_date: String(authDate), user: JSON.stringify(user) };
  return new URLSearchParams({ ...fields, hash: signInitData(fields, TOKEN) }).toString();
}

test('the bot\'s notice: the «Играть» deep link with its kind, «Отключить уведомления»; a 403 is «blocked»; the token never logged', async () => {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const { tg } = bot(fakeBotApi(calls));
  assert.equal(await tg.notice(4242, 'daily', 'hello', 'ru'), 'ok');
  const kb = (calls[0].params.reply_markup as { inline_keyboard: { text: string; url?: string; web_app?: { url: string }; callback_data?: string }[][] }).inline_keyboard;
  assert.equal(kb[0][0].web_app!.url, 'https://tg.gravetidegame.com/?n=daily');
  assert.equal(kb[1][0].callback_data, 'tgn:off');
  assert.equal(kb[1][0].text, TG_TEXTS['n.offBtn'][1]);
  const main = bot(fakeBotApi(calls), true).tg;
  assert.equal(main.playButton('ru', 'raid').text, 'Играть');
  assert.match((main.playButton('ru', 'raid') as { url: string }).url, /startapp=n_raid&mode=fullscreen/);
  // a 403 from Telegram: blocked, and the log has its code only
  const logs: string[] = [];
  const blocked: FetchFn = async () => ({ json: async () => ({ ok: false, error_code: 403, description: `Forbidden: bot was blocked by the user ${TOKEN}` }) });
  const w = world();
  const t403 = new TelegramService({ db: w.db, auth: w.game.auth, game: w.game, token: TOKEN, fetch: blocked, publicUrl: 'https://x', webappUrl: 'https://tg.x', log: (l) => logs.push(l) });
  assert.equal(await t403.notice(1, 'build', 'x', 'en'), 'blocked');
  assert.ok(logs.every((l) => !l.includes(TOKEN)));
  // and through the game: her notices off
  const acc = awayCaptain(w.game, 'Forbidden Fay');
  assert.equal(await notify(w.game, acc, 'build'), 'drop');
  assert.ok(tgnState(w.game, acc)!.blocked);
});

test('her yes: the Mini App\'s write access, the bot\'s /start; /notify and «Отключить» turn them off', async () => {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const { game, tg, clock } = bot(fakeBotApi(calls));
  const anne = { id: 4242, first_name: 'Anne', language_code: 'ru', allows_write_to_pm: true };
  const r = tg.webappLogin(initData(anne, Math.floor(clock.t / 1000) - 10));
  assert.ok('accountId' in r);
  const acc = (r as { accountId: number }).accountId;
  assert.equal(tgnState(game, acc)!.on, true, 'the Mini App let the bot write');
  assert.equal(tgnState(game, acc)!.chat, 4242);
  const bob = { id: 777, first_name: 'Bob', language_code: 'en' };
  const r2 = tg.webappLogin(initData(bob, Math.floor(clock.t / 1000) - 10)) as { accountId: number };
  assert.equal(tgnState(game, r2.accountId)!.on, null, 'no write access: not asked yet');
  const msg = (text: string): TgUpdate => ({ message: { message_id: 1, from: bob, chat: { id: bob.id, type: 'private' }, text } });
  await tg.handleUpdate(msg('/start'));
  assert.equal(tgnState(game, r2.accountId)!.on, true, 'he wrote to the bot');
  await tg.handleUpdate(msg('/notify'));
  assert.equal(tgnState(game, r2.accountId)!.on, false);
  assert.equal(String(calls.at(-1)!.params.text), TG_TEXTS['n.off'][0]);
  await tg.handleUpdate(msg('/notify'));
  assert.equal(tgnState(game, r2.accountId)!.on, true);
  // «Отключить уведомления» under a notice
  await tg.handleUpdate({ callback_query: { id: 'q1', from: anne, data: 'tgn:off' } });
  assert.equal(tgnState(game, acc)!.on, false);
  assert.equal(calls.at(-1)!.method, 'answerCallbackQuery');
});

test('a notice\'s button opened the Mini App: counted once a session (the funnel\'s stub, track.ts)', () => {
  const { game } = world();
  const { s, conn } = captain(game, 'Click Cleo');
  noticeLink(game, s.accountId, 9, 'ru', true);
  conn.push({ t: 'premium', action: 'tgn_click', cat: 'daily' });
  conn.push({ t: 'premium', action: 'tgn_click', cat: 'daily' });
  conn.push({ t: 'premium', action: 'tgn_click', cat: 'nonsense' });
  const day = game.db.getKv<Record<string, number>>(`track:${Math.floor(game.wallNow() / DAY)}`)!;
  assert.equal(day.tg_notice_click, 1);
  claimGift(game, s);
  assert.equal(game.db.getKv<Record<string, number>>(`track:${Math.floor(game.wallNow() / DAY)}`)!.daily_claim, 1);
});

test('every word in both languages: the bot\'s notices, the server\'s lines, the calendar and the settings', () => {
  for (const k of Object.keys(TG_TEXTS).filter((x) => x.startsWith('n.'))) {
    const [en, ru] = TG_TEXTS[k as keyof typeof TG_TEXTS];
    assert.ok(en && ru && (en as string) !== ru && /[А-Яа-яЁё]/.test(ru) && !/[A-Za-z]/.test(ru.replace(/\{\w+\}|\/\w+/g, '')), k);
  }
  for (const c of TGN_CATS) assert.ok(`n.${c}` in TG_TEXTS, c);
  const table = serverTable();
  const mine = extract('server/src').filter((p) => /daily gift|Daily gift|gift is taken/.test(p));
  assert.ok(mine.length >= 3);
  for (const p of mine) assert.ok(table[p], p);
  for (const k of Object.keys(G_EN) as (keyof typeof G_EN)[]) {
    assert.ok(G_RU[k], k);
    assert.ok(!/[A-Za-z]/.test(G_RU[k].replace(/\{\w+\}/g, '')), `${k}: ${G_RU[k]}`);
  }
});
