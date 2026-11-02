// Promo codes (owner, 2026-11-02: «добавим в игру возможность вставлять промокоды где-то в настройках … сделаем три
// разных промокода … для новичков полезное»): shared/src/data/promocodes.ts, server/src/game/promocodes.ts,
// client/src/ui/promocode.ts. A valid code pays once an account; a second try, an unknown code, a captain over the
// level, a code run out are refused; ten tries in ten minutes at most; the rewards land in their stores; case and
// spaces do not matter; the admin's /promo and its HELP pair; the words in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROMO_CODES, PROMO_TRIES, PROMO_TRY_WINDOW, normCode, promoByCode, promoPatterns } from '../shared/src/data/promocodes.ts';
import type { PromoCode } from '../shared/src/data/promocodes.ts';
import { codeStat, redeemCode, usedCodes } from '../server/src/game/promocodes.ts';
import { shopState } from '../server/src/game/shop.ts';
import { lettersSince } from '../server/src/game/post.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { EN as P_EN, RU as P_RU } from '../client/src/lang/ui/promocode.ts';
import { gotText as ruGot, resultText as ruText } from '../client/src/ui/promocode.ts';
import { setLang } from '../client/src/i18n.ts';
import { join, makeGame } from './helpers.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 2, 12);

function world(at = NOW) {
  const w = makeGame();
  const clock = { t: at };
  w.game.wallNow = () => clock.t;
  return { ...w, clock };
}

function captain(game: Game, name: string, level = 3): { s: PlayerSession; conn: ReturnType<typeof join> } {
  const conn = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.level = level;
  return { s, conn };
}

const code = (c: string): PromoCode => promoByCode(c)!;

test('three codes for newcomers: the start, the army, the island — modest, far end, levels 15 on the first two', () => {
  assert.equal(PROMO_CODES.length, 3);
  const [start, army, isle] = ['PERVYYREYS', 'MORSKOYVOLK', 'GRAVETIDE2026'].map(code);
  assert.ok(start && army && isle);
  assert.equal(start.rewards.silver, 5_000);
  assert.ok(start.rewards.cargo!.some((c) => c.good === 'provisions') && start.rewards.cargo!.some((c) => c.good === 'planks') && start.rewards.cargo!.some((c) => c.good === 'sailcloth'));
  assert.ok(start.rewards.grants!.some((g) => g.k === 'kit'));
  assert.deepEqual(army.rewards.unit, { u: 'musketeer', n: 8 });
  assert.ok(army.rewards.grants!.some((g) => g.k === 'xp'));
  assert.equal(isle.rewards.doubloons, 50);
  assert.ok(isle.rewards.grants!.some((g) => g.k === 'speed') && isle.rewards.grants!.some((g) => g.k === 'map'));
  assert.ok(isle.rewards.res!.timber && isle.rewards.res!.coal && isle.rewards.res!.iron);
  assert.equal(start.maxLevel, 15);
  assert.equal(army.maxLevel, 15);
  assert.equal(isle.maxLevel, undefined);
  for (const pc of PROMO_CODES) {
    assert.match(pc.code, /^[A-Z0-9]{6,20}$/);
    assert.ok(pc.until! > Date.UTC(2027, 0, 30), 'through January 2027');
  }
});

test('case, spaces and dashes do not matter; Cyrillic look-alikes are read as Latin', () => {
  assert.equal(normCode('  pervyy reys '), 'PERVYYREYS');
  assert.equal(normCode('Morskoy-Volk'), 'MORSKOYVOLK');
  assert.equal(normCode('gravetide2026\n'), 'GRAVETIDE2026');
  assert.equal(normCode('МОRSKОYVОLK'), 'MORSKOYVOLK', 'Cyrillic М and О');
  assert.equal(promoByCode(' gravetide 2026 ')?.code, 'GRAVETIDE2026');
  assert.equal(promoByCode('NOPE'), undefined);
});

test('a valid code pays once: silver, the hold\'s stores, the repair kits; a second try is refused and pays nothing', () => {
  const { game, db } = world();
  const { s, conn } = captain(game, 'Promo Pike');
  const g0 = s.profile!.gold;
  const ship = s.ship!;
  const prov0 = ship.cargo.provisions ?? 0;
  const kits0 = shopState(game, s.accountId).kits;
  // typed through the client's message, in lower case with spaces
  conn.push({ t: 'premium', action: 'promocode', code: ' pervyy reys ' });
  const r = conn.last('promocode')!.res;
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.code, 'PERVYYREYS');
  assert.ok(s.profile!.gold >= g0 + 5_000, 'the silver');
  assert.equal(r.got.silver, s.profile!.gold - g0);
  assert.equal((ship.cargo.provisions ?? 0) - prov0, r.got.cargo?.provisions ?? 0);
  assert.ok((r.got.cargo?.planks ?? 0) + (r.got.cargo?.sailcloth ?? 0) > 0 || r.got.silver! > 5_000, 'the planks and sailcloth, or their worth');
  assert.equal(shopState(game, s.accountId).kits, kits0 + 2, 'two repair kits in store');
  assert.equal(r.got.kit, 2);
  assert.ok(usedCodes(game, s.accountId).PERVYYREYS);
  assert.equal(codeStat(game, 'PERVYYREYS').n, 1);
  const rows = (db as unknown as { db: { prepare(q: string): { all(...a: unknown[]): unknown[] } } }).db.prepare("SELECT amount, detail FROM ledger WHERE account_id = ? AND kind = 'promo'").all(s.accountId) as { amount: number; detail: string }[];
  assert.deepEqual(rows.map((x) => x.detail), ['promo:PERVYYREYS']);
  // again: refused, nothing more
  const g1 = s.profile!.gold;
  const again = redeemCode(game, s, 'PERVYYREYS');
  assert.deepEqual(again, { ok: false, code: 'PERVYYREYS', why: 'used' });
  conn.push({ t: 'premium', action: 'promocode', code: 'pervyyreys' });
  assert.equal(conn.last('promocode')!.res.ok, false);
  assert.equal(s.profile!.gold, g1);
  assert.equal(shopState(game, s.accountId).kits, kits0 + 2);
  assert.equal(codeStat(game, 'PERVYYREYS').n, 1);
  // another captain takes it too: once an account, not once in all
  const b = captain(game, 'Promo Perch');
  assert.ok(redeemCode(game, b.s, 'PERVYYREYS').ok);
  assert.equal(codeStat(game, 'PERVYYREYS').n, 2);
});

test('the army\'s code: eight musketeers by a gift letter, the elixir of experience and the charms in store', () => {
  const { game } = world();
  const { s } = captain(game, 'Promo Roach');
  const st0 = shopState(game, s.accountId);
  const charms0 = st0.charms;
  const r = redeemCode(game, s, 'morskoyvolk');
  assert.ok(r.ok);
  assert.deepEqual(r.got.unit, { u: 'musketeer', n: 8 });
  const letter = lettersSince(game, s.accountId, 0).find((l) => l.units);
  assert.ok(letter, 'a letter with the men');
  assert.deepEqual(letter.units, { u: 'musketeer', n: 8, gift: 1 });
  const st = shopState(game, s.accountId);
  assert.ok(st.xp > NOW + 1.9 * 3_600_000, 'two hours of the elixir');
  assert.equal(st.charms, charms0 + 3);
  assert.equal(r.got.xp, 2);
});

test('the island\'s code: doubloons through the ledger (gift, promo:CODE), speed-ups, a treasure map; no island yet — the goods in silver', () => {
  const { game, db } = world();
  const { s } = captain(game, 'Promo Tench', 30);
  const speed0 = shopState(game, s.accountId).speed;
  const maps0 = s.profile!.explore.maps.length;
  const g0 = s.profile!.gold;
  const r = redeemCode(game, s, 'Gravetide2026');
  assert.ok(r.ok, 'no level cap on the third code');
  assert.equal(db.doubloons(s.accountId), 50);
  assert.ok(db.doubloonRef(s.accountId, 'doubloons_gift', 'promo:GRAVETIDE2026'), 'the ledger row');
  assert.equal(shopState(game, s.accountId).speed, speed0 + 120);
  assert.equal(s.profile!.explore.maps.length, maps0 + 1);
  assert.equal(r.got.map, 1);
  assert.equal(r.got.res, undefined, 'no island: no yard');
  assert.equal(s.profile!.gold - g0, 200 * 4 + 100 * 5 + 50 * 10, 'the goods at their worth');
  assert.equal(r.got.doubloons, 50);
});

test('refusals: an unknown code, a captain over the level, a code run out, an empty field — nothing paid', () => {
  const { game, clock } = world();
  const { s } = captain(game, 'Promo Carp', 16);
  const g0 = s.profile!.gold;
  assert.deepEqual(redeemCode(game, s, 'NOSUCHCODE'), { ok: false, code: 'NOSUCHCODE', why: 'unknown' });
  assert.deepEqual(redeemCode(game, s, 'pervyyreys'), { ok: false, code: 'PERVYYREYS', why: 'level', maxLevel: 15 });
  assert.equal(redeemCode(game, s, '   ').ok, false);
  assert.equal((redeemCode(game, s, '   ') as { why: string }).why, 'empty');
  s.profile!.level = 15;
  clock.t = code('MORSKOYVOLK').until! + DAY;
  assert.deepEqual(redeemCode(game, s, 'MORSKOYVOLK'), { ok: false, code: 'MORSKOYVOLK', why: 'expired' });
  assert.equal(s.profile!.gold, g0);
  assert.equal(codeStat(game, 'MORSKOYVOLK').n, 0);
  assert.deepEqual(usedCodes(game, s.accountId), {});
  // level 15 itself is let in
  clock.t = NOW;
  assert.ok(redeemCode(game, s, 'pervyyreys').ok);
});

test('ten tries in ten minutes at most an account (no guessing); the window passes and she may try again', () => {
  const { game, clock } = world();
  const { s } = captain(game, 'Promo Bream');
  for (let i = 0; i < PROMO_TRIES; i++) assert.equal((redeemCode(game, s, `GUESS${i}`) as { why: string }).why, 'unknown');
  const r = redeemCode(game, s, 'PERVYYREYS');
  assert.equal(r.ok, false);
  assert.equal((r as { why: string }).why, 'rate', 'even the right code waits');
  assert.ok((r as { wait: number }).wait > 0 && (r as { wait: number }).wait <= PROMO_TRY_WINDOW / 1000);
  // another captain is not held back
  const b = captain(game, 'Promo Ide');
  assert.ok(redeemCode(game, b.s, 'PERVYYREYS').ok);
  clock.t += PROMO_TRY_WINDOW + 1000;
  assert.ok(redeemCode(game, s, 'PERVYYREYS').ok, 'after the window');
});

test('the admin\'s /promo: list, stats, a grant to a captain aboard (once an account still); the HELP pair; its lines in Russian', () => {
  const { game } = world();
  const { s } = captain(game, 'Promo Admin', 20);
  const { s: t } = captain(game, 'Promo Guest', 40);
  const list = runAdmin(game, s, '/promo list')!;
  for (const pc of PROMO_CODES) assert.ok(list.includes(pc.code), pc.code);
  const g = runAdmin(game, s, '/promo grant pervyyreys Promo Guest')!;
  assert.equal(g, 'Code PERVYYREYS granted to Promo Guest.', 'over the level: the admin may');
  assert.ok(usedCodes(game, t.accountId).PERVYYREYS);
  assert.equal(runAdmin(game, s, '/promo grant PERVYYREYS Promo Guest'), 'The code is refused for Promo Guest: used.');
  assert.match(runAdmin(game, s, '/promo stats')!, /PERVYYREYS 1/);
  assert.equal(runAdmin(game, s, '/promo grant NOPE x'), 'Usage: /promo list|stats|grant CODE name');
  const help = runAdmin(game, s, '/help')!;
  assert.ok(help.includes('/promo list|stats|grant code name'));
  assert.ok(SERVER_RU_ADMIN[help]?.includes('/promo list|stats|grant код имя'), 'the Russian HELP');
  const table = serverTable();
  for (const [en, ru] of promoPatterns()) {
    assert.equal(table[en], ru);
    assert.doesNotMatch(ru.replace(/\/promo list\|stats\|grant/, ''), /[A-Za-z]{2,}/, en);
  }
});

test('the client\'s words: the result line in Russian and English; every key in both', () => {
  assert.deepEqual(Object.keys(P_RU).sort(), Object.keys(P_EN).sort());
  setLang('ru');
  const resultText = (r: Parameters<typeof ruText>[0]) => ruText(r).replace(/\s/g, ' ');
  const gotText = (g: Parameters<typeof ruGot>[0]) => ruGot(g).replace(/\s/g, ' ');
  try {
    const ok = resultText({ ok: true, code: 'PERVYYREYS', got: { silver: 5000, cargo: { provisions: 50 }, kit: 2 } });
    assert.equal(ok, 'Код принят: +5 000 серебра, провизия ×50, ремкомплекты ×2.');
    assert.equal(resultText({ ok: false, code: 'X', why: 'unknown' }), 'Код не найден. Проверьте буквы и попробуйте ещё раз.');
    assert.equal(resultText({ ok: false, code: 'X', why: 'used' }), 'Код уже использован на вашем аккаунте.');
    assert.equal(resultText({ ok: false, code: 'X', why: 'expired' }), 'Срок действия кода истёк.');
    assert.equal(resultText({ ok: false, code: 'X', why: 'level', maxLevel: 15 }), 'Код для капитанов до 15 уровня.');
    assert.match(resultText({ ok: false, code: 'X', why: 'rate', wait: 300 }), /через 5\s?мин/);
    assert.match(gotText({ unit: { u: 'musketeer', n: 8 } }), /мушкетёры ×8/);
  } finally {
    setLang('en');
  }
  assert.equal(ruText({ ok: true, code: 'X', got: { silver: 5000, doubloons: 50 } }), 'Code accepted: +5,000 silver, +50 doubloons.');
});
