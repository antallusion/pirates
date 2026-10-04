// The premium shop (owner, 2026-10-03; docs/01 P7): doubloons — the account's, bought with money only, never below
// nought, every change a ledger row, a payment credited once — the hulls and creatures they buy (in port, the old ship
// berthed; into the army as a tamer's, or refused with nothing charged), the free sources that pass a premium kind
// over, the admin's console, the wire and every word in both languages. The real catalogue comes from other work: the
// tests mark a few existing kinds and hulls premium for their own length (`withPremium`) and put them back.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pathJoin } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { UNITS } from '../shared/src/data/army.ts';
import type { PremiumUnit, UnitId } from '../shared/src/data/army.ts';
import { DRIFTS, driftKindsFor, tamerStock } from '../shared/src/data/drifts.ts';
import { LAIRS, lairKindsFor } from '../shared/src/data/lairs.ts';
import type { LairRole } from '../shared/src/data/lairs.ts';
import { CREDIT_MAX, DOUBLOON_PACKS, PAYMENTS_OPEN, PREMIUM_SAMPLE, premiumLeaks, premiumShips, premiumUnits } from '../shared/src/data/premium.ts';
import { ROAMS, roamKindsFor } from '../shared/src/data/roamers.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import type { PremiumShip, ShipClassId } from '../shared/src/data/ships.ts';
import { captainLevelFor, levelRange } from '../shared/src/data/shiplevel.ts';
import { ISLE_TYPES } from '../shared/src/world/archipelago.ts';
import { REGION_IDS } from '../shared/src/world/regions.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { economyReport } from '../server/src/game/econmetrics.ts';
import { Game } from '../server/src/game/Game.ts';
import { creditPremium, premiumView } from '../server/src/game/premium.ts';
import { MAX_BERTHS } from '../server/src/game/shipbuilding.ts';
import { captureOffer } from '../server/src/game/tame.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { AuthService } from '../server/src/auth.ts';
import { Database } from '../server/src/persistence/db.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { EN as P_EN, RU as P_RU } from '../client/src/lang/ui/premium.ts';
import { EN as M_EN, RU as M_RU } from '../client/src/lang/ui/menu.ts';
import { MENU_ITEMS } from '../client/src/ui/menu.ts';
import { setLang } from '../client/src/i18n.ts';
import { FakeConn, join, makeGame, onHull } from './helpers.ts';

/** Marks kinds and hulls premium for one test, and puts them back as they were after it. */
function withPremium<T>(marks: { units?: Partial<Record<UnitId, PremiumUnit>>; ships?: Partial<Record<ShipClassId, PremiumShip>> }, fn: () => T): T {
  const undo: (() => void)[] = [];
  for (const [u, p] of Object.entries(marks.units ?? {}) as [UnitId, PremiumUnit][]) {
    const was = UNITS[u].premium;
    UNITS[u].premium = p;
    undo.push(() => (was ? (UNITS[u].premium = was) : delete UNITS[u].premium));
  }
  for (const [c, p] of Object.entries(marks.ships ?? {}) as [ShipClassId, PremiumShip][]) {
    const was = SHIP_CLASSES[c].premium;
    SHIP_CLASSES[c].premium = p;
    undo.push(() => (was ? (SHIP_CLASSES[c].premium = was) : delete SHIP_CLASSES[c].premium));
  }
  try {
    return fn();
  } finally {
    for (const f of undo) f();
  }
}

/** The account's doubloons rows of the ledger, oldest first. */
function rows(db: Database, account: number): { kind: string; amount: number; detail: string }[] {
  const raw = (db as unknown as { db: DatabaseSync }).db.prepare(`SELECT kind, amount, detail FROM ledger WHERE account_id = ? AND kind LIKE 'doubloons%' ORDER BY id`).all(account) as { kind: string; amount: number; detail: string }[];
  return raw.map((r) => ({ kind: String(r.kind), amount: Number(r.amount), detail: String(r.detail) }));
}

const note: [string, string] = ['A test of the shop.', 'Проверка лавки.'];

// ------------------------------------------------------------------------------------------------ the balance

test('doubloons are the account\'s: none at first, never below nought, kept across a restart — and an older database gains the column', () => {
  const dir = mkdtempSync(pathJoin(tmpdir(), 'gravetide-dbl-'));
  const path = pathJoin(dir, 'old.db');
  try {
    // A database from before the shop: accounts without the column.
    const old = new DatabaseSync(path);
    old.exec('CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, token_hash TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL)');
    old.prepare('INSERT INTO accounts (name, token_hash, created_at, last_seen) VALUES (?, ?, ?, ?)').run('Old Salt', 'h-old', 1, 1);
    old.close();
    const db = new Database(path);
    const id = db.accountByName('old salt')!.id;
    assert.equal(db.doubloons(id), 0, 'an old account holds none');
    assert.equal(db.addDoubloons(id, 120), 120);
    assert.equal(db.addDoubloons(id, -200), null, 'never below nought: refused');
    assert.equal(db.doubloons(id), 120, 'and nothing moved');
    assert.equal(db.addDoubloons(9999, 5), null, 'no such account');
    assert.throws(() => (db as unknown as { db: DatabaseSync }).db.prepare('UPDATE accounts SET doubloons = -1 WHERE id = ?').run(id), /CHECK/, 'the database itself will not hold a debt');
    const fresh = db.createAccount('New Hand', 'h-new');
    assert.equal(db.doubloons(fresh), 0);
    db.close();
    const again = new Database(path);
    assert.equal(again.doubloons(id), 120, 'kept across a restart');
    again.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('creditPremium is the one door in: a ledger row each time, a payment credited once, bad sums and strangers refused, the captain told', () => {
  const { game, db } = makeGame();
  const conn = join(game, 'Payer');
  const s = game.sessionByName('Payer')!;
  const id = s.accountId;
  assert.equal(conn.last('doubloons')?.n, 0, 'the balance comes with the captain');
  assert.equal(creditPremium(game, id, 550, 'pay', 'pay_001'), 550);
  assert.equal(conn.last('doubloons')?.n, 550, 'her client hears of it at once');
  assert.match(conn.last('toast')!.msg, /Doubloons credited to your account: 550/);
  assert.equal(creditPremium(game, id, 550, 'pay', 'pay_001'), 550, 'the webhook knocking twice: the balance answered…');
  assert.equal(db.doubloons(id), 550, '…and not credited again');
  assert.equal(creditPremium(game, id, 100, 'pay', 'pay_002'), 650);
  for (const bad of [0, -5, Number.NaN, CREDIT_MAX + 1]) assert.equal(creditPremium(game, id, bad, 'pay', `bad_${bad}`), null, `refused: ${bad}`);
  assert.equal(creditPremium(game, 987654, 100, 'pay', 'stranger'), null, 'no such account');
  assert.deepEqual(rows(db, id), [{ kind: 'doubloons_pay', amount: 550, detail: 'pay_001' }, { kind: 'doubloons_pay', amount: 100, detail: 'pay_002' }]);
  // Doubloons are not silver: the economy's report of silver leaves them out.
  const r = economyReport(game);
  assert.ok(![...r.topFaucets, ...r.topSinks].some((f) => f.kind.startsWith('doubloons')));
  assert.equal(r.faucets, 0);
  // Coming aboard again (the same database, a new world process): the balance is there.
  const token = conn.last('welcome')!.token;
  const game2 = new Game({ db, auth: new AuthService(db), log: () => {} });
  game2.directorOn = false;
  const c2 = new FakeConn();
  game2.attach(c2 as unknown as WsConnection);
  c2.push({ t: 'hello', v: PROTOCOL_VERSION, token });
  assert.equal(c2.last('doubloons')?.n, 650);
});

// ------------------------------------------------------------------------------------------------ buying

test('a kind for doubloons joins the army as a tamer\'s do — or is refused with nothing charged: too poor, no slot, no hammocks, in a fight', () => {
  withPremium({ units: { mermaid: { price: 250, n: 6, note } } }, () => {
    const { game, db } = makeGame();
    const conn = join(game, 'Kind Buyer');
    const s = game.sessionByName('Kind Buyer')!;
    const ship = s.ship!;
    onHull(game, ship, 'brig', 5);
    ship.setArmy([{ u: 'deckhand', n: 20 }]);
    const has = () => ship.army.find((x) => x.u === 'mermaid')?.n ?? 0;
    const why = () => {
      conn.push({ t: 'premium', action: 'view' });
      return conn.last('premium')!.view.units.find((x) => x.id === 'mermaid')!.why;
    };
    const buy = () => conn.push({ t: 'premium', action: 'buy_unit', id: 'mermaid' });
    assert.equal(why(), 'poor');
    buy();
    assert.match(conn.last('toast')!.msg, /Not enough doubloons/);
    assert.equal(has(), 0);
    creditPremium(game, s.accountId, 1000, 'pay', 'p-1');
    assert.equal(why(), null);
    // Every slot of her class taken by other kinds.
    ship.setArmy([{ u: 'deckhand', n: 10 }, { u: 'marine', n: 5 }, { u: 'musketeer', n: 5 }, { u: 'gunner', n: 5 }, { u: 'boarder', n: 5 }, { u: 'guard', n: 5 }]);
    assert.equal(ship.army.length, ship.armySlots);
    assert.equal(why(), 'slot');
    buy();
    assert.match(conn.last('toast')!.msg, /No free slot in the army/);
    // A slot, but hammocks for three only.
    ship.setArmy([{ u: 'deckhand', n: ship.stats.crewMax - 3 }]);
    assert.equal(why(), 'room');
    buy();
    assert.match(conn.last('toast')!.msg, /No hammocks aboard for 6 more/);
    // Under fire.
    ship.setArmy([{ u: 'deckhand', n: 20 }]);
    ship.lastCombat = game.now;
    assert.equal(why(), 'fight');
    buy();
    assert.equal(has(), 0);
    assert.equal(db.doubloons(s.accountId), 1000, 'every refusal cost nothing');
    ship.lastCombat = -999;
    buy();
    assert.equal(has(), 6, 'the whole stack aboard');
    assert.equal(db.doubloons(s.accountId), 750);
    assert.equal(conn.last('doubloons')?.n, 750);
    assert.deepEqual(rows(db, s.accountId).at(-1), { kind: 'doubloons_buy', amount: -250, detail: 'unit:mermaid:6' });
    const saved = JSON.parse(db.loadCaptain(s.accountId)!.data) as { army: { u: string; n: number }[] };
    assert.ok(saved.army.some((x) => x.u === 'mermaid' && x.n === 6), 'saved with the payment, in one transaction');
  });
});

test('a hull for doubloons: in port only, the old ship berthed at the quay — refused at sea, too poor, below her level, every berth taken', () => {
  withPremium({ ships: { xebec: { price: 900, note } } }, () => {
    const { game, db } = makeGame();
    const conn = join(game, 'Hull Buyer');
    const s = game.sessionByName('Hull Buyer')!;
    const p = s.profile!;
    const ship = s.ship!;
    const port = ship.docked!;
    assert.ok(port, 'a new captain lies in port');
    const why = () => {
      conn.push({ t: 'premium', action: 'view' });
      return conn.last('premium')!.view.ships.find((x) => x.id === 'xebec')!.why;
    };
    const buy = () => conn.push({ t: 'premium', action: 'buy_ship', id: 'xebec' });
    const was = ship.loadout.classId;
    assert.ok(captainLevelFor(levelRange('xebec')[0]) > p.level);
    assert.equal(why(), 'level');
    buy();
    assert.match(conn.last('toast')!.msg, /Captain level \d+ is needed to command a Xebec/);
    p.level = 30;
    assert.equal(why(), 'poor');
    creditPremium(game, s.accountId, 1000, 'pay', 'p-hull');
    assert.equal(why(), null);
    const berths = p.berths.length;
    p.berths.push(...Array.from({ length: MAX_BERTHS - berths }, () => ({ port, loadout: { ...ship.loadout }, hull: 1 })));
    assert.equal(why(), 'berths');
    p.berths.length = berths;
    conn.push({ t: 'undock' });
    assert.equal(ship.docked, null);
    assert.equal(why(), 'port');
    buy();
    assert.match(conn.last('toast')!.msg, /delivered in port/);
    assert.equal(ship.loadout.classId, was);
    assert.equal(db.doubloons(s.accountId), 1000, 'nothing charged');
    // Back in port: bought, the old ship at the quay.
    const back = game.portById(port)!;
    ship.state = { ...ship.state, x: back.x, y: back.y, speed: 0 };
    ship.docked = port;
    buy();
    assert.equal(ship.loadout.classId, 'xebec');
    assert.equal(p.loadout.classId, 'xebec');
    assert.equal(ship.hull, ship.stats.hullMax, 'she comes sound');
    assert.equal(p.berths.length, berths + 1);
    assert.equal(p.berths.at(-1)!.port, port);
    assert.equal(p.berths.at(-1)!.loadout.classId, was, 'the ship she sailed is berthed here');
    assert.equal(ship.loadout.name, p.berths.at(-1)!.loadout.name, 'the new hull bears her ship\'s name, as at a yard');
    assert.equal(db.doubloons(s.accountId), 100);
    assert.deepEqual(rows(db, s.accountId).at(-1), { kind: 'doubloons_buy', amount: -900, detail: 'ship:xebec' });
    assert.equal(JSON.parse(db.loadCaptain(s.accountId)!.data).loadout.classId, 'xebec', 'saved with the payment');
    assert.equal(why(), 'yours');
  });
});

test('a hull sold with her own creatures: they come aboard with her — and with no room for them in her, nothing is sold and all is as it was', () => {
  withPremium({ ships: { bomb_ketch: { price: 1400, note, beasts: [{ u: 'sea_turtle', n: 4 }] } } }, () => {
    const { game, db } = makeGame();
    const conn = join(game, 'Ketch Buyer');
    const s = game.sessionByName('Ketch Buyer')!;
    const p = s.profile!;
    const ship = s.ship!;
    p.level = 40;
    onHull(game, ship, 'brig', 5);
    creditPremium(game, s.accountId, 2000, 'pay', 'p-ketch');
    // Six kinds aboard: her six slots full, none for the turtles.
    const six = [{ u: 'deckhand', n: 10 }, { u: 'marine', n: 5 }, { u: 'musketeer', n: 5 }, { u: 'gunner', n: 5 }, { u: 'boarder', n: 5 }, { u: 'guard', n: 5 }] as { u: UnitId; n: number }[];
    ship.setArmy(six);
    const berths = p.berths.length;
    conn.push({ t: 'premium', action: 'buy_ship', id: 'bomb_ketch' });
    assert.match(conn.last('toast')!.msg, /No room aboard her for the creatures/);
    assert.equal(ship.loadout.classId, 'brig', 'all put back as it was');
    assert.equal(p.berths.length, berths);
    assert.deepEqual(ship.army.map((x) => x.u).sort(), six.map((x) => x.u).sort());
    assert.equal(db.doubloons(s.accountId), 2000);
    ship.setArmy(six.slice(0, 5));
    conn.push({ t: 'premium', action: 'buy_ship', id: 'bomb_ketch' });
    assert.equal(ship.loadout.classId, 'bomb_ketch');
    assert.equal(ship.army.find((x) => x.u === 'sea_turtle')?.n, 4, 'her turtles aboard');
    assert.equal(db.doubloons(s.accountId), 600);
  });
});

// ------------------------------------------------------------------------------------------------ the free sources

test('a premium kind never comes free: the tamer\'s pens, the lairs, the drifts, the roaming stacks and the beaten\'s offer pass it over', () => {
  assert.deepEqual(premiumLeaks(), [], 'the catalogue as it stands leaks nothing');
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const tamerHas = (u: UnitId) => {
    for (let w = 0; w < 80; w++) for (const L of [3, 5, 8]) if (tamerStock(`port_${w % 9}`, L, w, false).some((x) => x.u === u)) return true;
    return false;
  };
  const driftHas = (u: UnitId) => REGION_IDS.some((r) => levels.some((L) => driftKindsFor(L, r).some(([k]) => DRIFTS[k].u === u)));
  const roamHas = (u: UnitId) => REGION_IDS.some((r) => levels.some((L) => roamKindsFor(L, r).some(([k]) => ROAMS[k].u === u)));
  const lairHas = (u: UnitId) => ISLE_TYPES.some((t) => levels.some((L) => (['shore', 'grotto', 'guardian'] as LairRole[]).some((role) => lairKindsFor(t, L, role).some((k) => LAIRS[k].mix.some(([x]) => x === u)))));
  const beaten = () => {
    const { game } = makeGame();
    join(game, 'Victor');
    const s = game.sessionByName('Victor')!;
    onHull(game, s.ship!, 'brig', 5);
    s.ship!.setArmy([{ u: 'deckhand', n: 30 }]);
    s.ship!.morale = 80;
    return captureOffer(game, s, [{ u: 'crab', n: 60 }], 4, 'yes');
  };
  // Unmarked, the sea turtle and the crab are had at sea as ever…
  assert.ok(tamerHas('sea_turtle') && driftHas('sea_turtle') && roamHas('sea_turtle') && lairHas('crab'));
  assert.equal(beaten()?.u, 'crab');
  // …marked premium, nothing hands them out.
  withPremium({ units: { sea_turtle: { price: 180, n: 8, note }, crab: { price: 50, n: 20, note } } }, () => {
    assert.ok(!tamerHas('sea_turtle') && !tamerHas('crab'), 'the tamer\'s pens');
    assert.ok(!driftHas('sea_turtle'), 'the drifts');
    assert.ok(!roamHas('sea_turtle'), 'the roaming stacks');
    assert.ok(!lairHas('crab'), 'the lairs (their brood, dwellings and eggs)');
    assert.equal(beaten(), undefined, 'the beaten\'s offer');
    const leaks = premiumLeaks();
    assert.ok(leaks.includes('drift turtle_weed: sea_turtle') && leaks.includes('roam sea_turtle: sea_turtle') && leaks.includes('lair crab_beach: crab'), 'and the tables that hold them are named');
  });
  // A premium hull a yard would sell for silver is a leak too.
  withPremium({ ships: { xebec: { price: 900, note } } }, () => assert.deepEqual(premiumLeaks(), ['yard xebec']));
});

// ------------------------------------------------------------------------------------------------ the console, the window, the words

test('the admin\'s console grants doubloons (only with GRAVETIDE_ADMIN=1), takes them never below nought, and lays out the sample', () => {
  const was = process.env.GRAVETIDE_ADMIN;
  delete process.env.GRAVETIDE_ADMIN;
  try {
    const { game, db } = makeGame();
    const conn = join(game, 'Console');
    const s = game.sessionByName('Console')!;
    conn.push({ t: 'chat', text: '/doubloons 500' });
    assert.equal(db.doubloons(s.accountId), 0, 'on a normal server a slash line is chat');
    process.env.GRAVETIDE_ADMIN = '1';
    conn.push({ t: 'chat', text: '/doubloons 500' });
    assert.equal(db.doubloons(s.accountId), 500);
    assert.equal(conn.last('toast')?.msg, 'Doubloons: 500.');
    assert.equal(runAdmin(game, s, '/doubloons -200'), 'Doubloons: 300.');
    assert.equal(runAdmin(game, s, '/doubloons -1000'), 'Not that many: 300 on the account.');
    assert.match(runAdmin(game, s, '/doubloons')!, /^Doubloons: 300\. Usage/);
    assert.deepEqual(rows(db, s.accountId), [{ kind: 'doubloons_admin', amount: 500, detail: 'console:Console' }, { kind: 'doubloons_admin', amount: -200, detail: 'console:Console' }]);
    // The sample catalogue: the shop's cards before the real ones, and gone again.
    assert.match(runAdmin(game, s, '/doubloons sample')!, /sample catalogue is in the shop/);
    const v = conn.last('premium')!.view;
    // The sample's cards beside the real catalogue (the fleet of eighty's forty hulls, docs/02 §1.A.9; the shop's own creatures, docs/18 VII).
    assert.deepEqual(v.ships.map((x) => x.id).sort(), [...premiumShips(), ...Object.keys(PREMIUM_SAMPLE.ships)].sort());
    assert.deepEqual(v.units.map((x) => x.id).sort(), [...premiumUnits(), ...Object.keys(PREMIUM_SAMPLE.units)].sort());
    assert.ok(v.ships.find((x) => x.id === 'bomb_ketch')!.beasts.length > 0);
    assert.equal(UNITS.mermaid.premium, undefined, 'the tables stay unmarked');
    runAdmin(game, s, '/doubloons sample');
    assert.equal(conn.last('premium')!.view.ships.length, premiumShips().length);
  } finally {
    if (was === undefined) delete process.env.GRAVETIDE_ADMIN;
    else process.env.GRAVETIDE_ADMIN = was;
  }
});

test('the shop\'s window on the wire: an empty shop says so, the catalogue lists every marked hull and kind with its reason', () => {
  const { game } = makeGame();
  const conn = join(game, 'Browser');
  const s = game.sessionByName('Browser')!;
  s.ship!.setArmy([{ u: 'deckhand', n: 6 }]);
  conn.push({ t: 'premium', action: 'view' });
  const v = conn.last('premium')!.view;
  // The fleet of eighty's forty premium hulls (docs/02 §1.A.9) and the shop's own creatures (docs/18 VII), the cheapest first.
  assert.deepEqual([v.ships.map((x) => x.id), v.units.map((x) => x.id), v.balance, v.pay], [premiumShips(), premiumUnits(), 0, PAYMENTS_OPEN]);
  assert.equal(premiumShips().length, 48); // the forty, and the third batch's eight (tests/batch3)
  assert.equal(PAYMENTS_OPEN, false, 'no payment provider yet');
  assert.ok(v.port, 'docked: the port she lies in');
  for (let i = 1; i < premiumShips().length; i++) assert.ok(SHIP_CLASSES[premiumShips()[i]].premium!.price >= SHIP_CLASSES[premiumShips()[i - 1]].premium!.price, 'the cheapest first');
  const prices = premiumUnits().map((u) => UNITS[u].premium!.price);
  for (let i = 1; i < prices.length; i++) assert.ok(prices[i - 1] <= prices[i], 'the cheapest first');
  const shelf = premiumUnits();
  withPremium({ units: { mermaid: { price: 250, n: 6, note }, seal: { price: 90, n: 10, note } }, ships: { xebec: { price: 900, note } } }, () => {
    assert.deepEqual(premiumUnits().filter((u) => !shelf.includes(u)), ['seal', 'mermaid'], 'the cheapest first');
    const w = premiumView(game, s);
    // A new captain's ⚓1 hull: the fourth tier is sold from ⚓3 (docs/18 VII).
    assert.deepEqual(w.units.filter((x) => x.id === 'seal' || x.id === 'mermaid').map((x) => [x.id, x.price, x.n, x.why]), [['seal', 90, 10, 'poor'], ['mermaid', 250, 6, 'tier']]);
    assert.deepEqual(w.ships.filter((x) => x.id === 'xebec').map((x) => [x.id, x.lv, x.why]), [['xebec', captainLevelFor(levelRange('xebec')[0]), 'level']]);
  });
  // A bad id is no sale (and no throw).
  conn.push({ t: 'premium', action: 'buy_unit', id: '__proto__' as UnitId });
  assert.equal(conn.last('toast')?.msg, 'Not for sale');
  // The packs of the top-up: 100, 550, 1200, 2600 and 7000, the bonus growing.
  assert.deepEqual(DOUBLOON_PACKS.map((p) => p.n + p.bonus), [100, 550, 1200, 2600, 7000]);
  for (let i = 1; i < DOUBLOON_PACKS.length; i++) assert.ok(DOUBLOON_PACKS[i].bonus / DOUBLOON_PACKS[i].n > DOUBLOON_PACKS[i - 1].bonus / DOUBLOON_PACKS[i - 1].n);
});

test('every word of the shop in both languages: the server\'s lines, the window, the menu', () => {
  const table = serverTable();
  const mine = extract('server/src/game').filter((x) => /[Dd]oubloon|delivered in port|on the ways|keeps the deep|sample catalogue|creatures that come with her|for \{0\} more|middle of a fight|Not that many|at once\.|needed to command a/.test(x));
  assert.ok(mine.length >= 14, `the shop's sentences found (${mine.length})`);
  for (const x of mine) assert.ok(table[x] !== undefined, `untranslated: ${x}`);
  setLang('ru');
  try {
    assert.equal(serverText('Doubloons credited to your account: 550.'), 'Зачислено дублонов на ваш счёт: 550.');
    assert.match(serverText('6 mermaids join your army for 250 doubloons.'), /6.*250 дубл\./);
  } finally {
    setLang('en');
  }
  assert.deepEqual(Object.keys(P_RU).sort(), Object.keys(P_EN).sort());
  for (const k of Object.keys(P_EN) as (keyof typeof P_EN)[]) assert.ok(/[а-яё]/i.test(P_RU[k]), k);
  assert.ok(MENU_ITEMS.some((m) => m.id === 'shop') && M_EN.shop && M_RU.shop === 'Лавка');
  for (const [, x] of Object.entries(PREMIUM_SAMPLE.units)) assert.ok(/[а-яё]/i.test(x!.note[1]));
  for (const [, x] of Object.entries(PREMIUM_SAMPLE.ships)) assert.ok(/[а-яё]/i.test(x!.note[1]));
});
