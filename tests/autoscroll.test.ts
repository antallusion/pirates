// «Свиток автобоя» (owner, 2026-10-11: «автобой в абордаже только специальной премиум свитками, которую можно за дублоны
// купить»; docs/25 §5): «Авто» refused without a scroll, given with one and exactly one spent for the battle (taken back
// and given again for nothing more); the quick fight free against a clearly weaker ship of the sea and on a scroll
// otherwise (against a captain it is «Авто»); ashore the same; the packs bought for doubloons in one transaction; the
// disconnect's fallback free, the helm hers again when she is back; the admin's /scrolls and its Russian HELP pair; a
// top seal's weekly scroll; every new line in Russian.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armyForLevel } from '../shared/src/data/army.ts';
import { AUTO_SCROLL_PACKS, SEAL_SCROLL_LV, scrollPack } from '../shared/src/data/premium.ts';
import { headingVec } from '../shared/src/math.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { tacAction } from '../server/src/game/tactical.ts';
import { landTac, startCreatureFight } from '../server/src/game/beastlairs.ts';
import { premiumMessage } from '../server/src/game/premium.ts';
import { NO_SCROLL, grantScrolls, helmFallback } from '../server/src/game/autoscroll.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { sealScroll } from '../server/src/game/seals.ts';
import { serverText } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { setLang } from '../client/src/i18n.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function atSea(game: Game, name: string): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name, 'corsair');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  Object.assign(ship.state, { x: 30000, y: 80000, heading: 0, speed: 0 });
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  s.profile!.level = 22; // docs/31: a captain of ⚓5's own band (19–25), as the pirate brig of her level is
  ship.loadout.classId = 'brig';
  ship.loadout.level = 5;
  ship.recompute(game.now);
  ship.hull = ship.stats.hullMax;
  ship.crew = ship.stats.crewMax;
  ship.setArmy(armyForLevel(5, ship.crew, ship.armySlots, 'player'));
  ship.morale = 80;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s, ship };
}

/** A pirate brig of her level alongside, `crew` men (few: clearly the weaker). */
function pirate(game: Game, ship: ShipEntity, crew: number): ShipEntity {
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const npc = game.spawnNpcShip('pirate', 'brig', 'free', ship.state.x + v.x * 18, ship.state.y + v.y * 18, ship.state.heading);
  game.setNpcLevel(npc, 5);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  npc.morale = 80;
  npc.crew = crew;
  npc.hull = npc.stats.hullMax;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

function boarded(name: string, crew: number) {
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const { c, s, ship } = atSea(game, name);
  const npc = pirate(game, ship, crew);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  const bt = ship.boarding?.fight.tac;
  assert.ok(bt, 'the hex battle');
  return { game, c, s, ship, npc, bt };
}

const scrolls = (game: Game, s: PlayerSession) => game.db.scrolls(s.accountId);

test('«Авто» in a boarding: refused without a scroll (locked on her screen); with one it plays her side and spends exactly one for the battle — the helm taken back and «Авто» again cost nothing more', () => {
  const { game, c, s, bt } = boarded('Auto Ada', 40);
  assert.equal(scrolls(game, s), 0);
  assert.equal(tacAction(game, s.ship!, { a: 'auto', on: true }), NO_SCROLL);
  assert.equal(bt.heroes[0].auto, false, 'her side is still hers');
  assert.deepEqual(c.last('board_tac')!.view!.scrolls, { n: 0 }, 'her screen: no scroll, none spent (the lock and the price)');
  // Two scrolls on the account (bought, or the admin's).
  assert.equal(grantScrolls(game, s.accountId, 2, 'admin', 'test'), 2);
  assert.equal(tacAction(game, s.ship!, { a: 'auto', on: true }), null);
  assert.equal(bt.heroes[0].auto, true);
  assert.equal(scrolls(game, s), 1, 'one scroll spent');
  assert.deepEqual(c.last('board_tac')!.view!.scrolls, { n: 1, paid: true }, 'her screen: spent on this battle');
  // She takes the helm back (nothing refunded) and gives «Авто» again: free in this battle.
  assert.equal(tacAction(game, s.ship!, { a: 'auto', on: false }), null);
  assert.equal(bt.heroes[0].auto, false);
  assert.equal(scrolls(game, s), 1, 'no refund');
  assert.equal(tacAction(game, s.ship!, { a: 'auto', on: true }), null);
  assert.equal(scrolls(game, s), 1, 'the same battle: no second scroll');
  for (let i = 0; i < 20 * 600 && !bt.over; i++) game.step();
  assert.ok(bt.over, 'the sea’s mind fought her side to the end');
  const rows = game.db.ledgerFlows(0).filter((f) => f.kind.startsWith('autoscroll'));
  assert.deepEqual(rows.map((r) => [r.kind, Number(r.inflow), Number(r.outflow)]).sort(), [['autoscroll_admin', 2, 0], ['autoscroll_use', 0, 1]], 'every move a ledger row');
});

test('the quick fight: free against a clearly weaker ship of the sea (×1.5, docs/25 item 49) — the honest end at once; otherwise it spends a scroll, refused without one', () => {
  {
    const { game, s, bt } = boarded('Quick Quin', 3);
    assert.equal(bt.quick?.[0], true, 'three hands against her brig: clearly the weaker');
    assert.equal(tacAction(game, s.ship!, { a: 'quick' }), null);
    assert.ok(bt.over, 'settled at once');
    assert.equal(bt.over?.winner, 0);
    assert.equal(scrolls(game, s), 0, 'no scroll asked');
    assert.equal(game.db.ledgerFlows(0).filter((f) => f.kind.startsWith('autoscroll')).length, 0);
  }
  {
    const { game, s, bt } = boarded('Even Eve', 40);
    assert.equal(bt.quick?.[0], false, 'a ship of her level: not clearly the weaker');
    assert.equal(tacAction(game, s.ship!, { a: 'quick' }), NO_SCROLL);
    assert.equal(bt.over, null, 'refused: the fight goes on by hand');
    grantScrolls(game, s.accountId, 3, 'admin', 'test');
    assert.equal(tacAction(game, s.ship!, { a: 'quick' }), null);
    assert.ok(bt.over, 'fought out at once on a scroll');
    assert.equal(scrolls(game, s), 2, 'exactly one spent');
  }
});

test('ashore the same: «Авто» and a quick fight that is not the free one need a scroll; the free quick fight against creatures clearly the weaker', () => {
  const { game } = makeGame();
  const { s } = atSea(game, 'Shore Sue');
  const ext = { type: 'sand', kind: 'test', place: 'Test Isle', level: 5, onEnd: () => undefined };
  assert.equal(startCreatureFight(game, s, ext, 'crabs', [{ u: 'deckhand', n: 400 }], 'unit.deckhand', 5), null);
  assert.equal(landTac(game, s, { a: 'auto', on: true }), NO_SCROLL);
  assert.equal(landTac(game, s, { a: 'quick' }), NO_SCROLL);
  grantScrolls(game, s.accountId, 1, 'admin', 'test');
  assert.equal(landTac(game, s, { a: 'auto', on: true }), null);
  assert.equal(scrolls(game, s), 0, 'one spent');
  assert.equal(landTac(game, s, { a: 'quick' }), null, 'the scroll is the battle’s: its quick fight too');
  assert.equal(scrolls(game, s), 0);
  steps(game, 20 * 50); // the screen closes, the party back aboard
  // A handful of creatures: clearly the weaker — the quick fight is free.
  const { game: g2 } = makeGame();
  const w = atSea(g2, 'Shore Will');
  assert.equal(startCreatureFight(g2, w.s, ext, 'crabs', [{ u: 'deckhand', n: 2 }], 'unit.deckhand', 5), null);
  assert.equal(landTac(g2, w.s, { a: 'quick' }), null);
  assert.equal(g2.db.scrolls(w.s.accountId), 0);
});

test('a pack of scrolls for doubloons is one transaction: no doubloons, no scroll; the doubloons spent once; a failure leaves both as they were', () => {
  const { game } = makeGame();
  const { s, c } = atSea(game, 'Buyer Bea');
  const p5 = scrollPack('scroll5')!;
  assert.deepEqual(AUTO_SCROLL_PACKS.map((p) => [p.n, p.price]), [[1, 25], [5, 100], [20, 300]], 'the packs and their prices');
  premiumMessage(game, s, { t: 'premium', action: 'buy_scrolls', pack: 'scroll5' });
  assert.equal(game.db.doubloons(s.accountId), 0);
  assert.equal(scrolls(game, s), 0, 'no doubloons: no scroll');
  assert.match(c.last('toast')?.msg ?? '', /Not enough doubloons/);
  game.db.addDoubloons(s.accountId, 150);
  premiumMessage(game, s, { t: 'premium', action: 'buy_scrolls', pack: 'scroll5' });
  premiumMessage(game, s, { t: 'premium', action: 'buy_scrolls', pack: 'scroll5' }); // a second tap: 50 left, refused
  assert.equal(game.db.doubloons(s.accountId), 150 - p5.price, 'spent once');
  assert.equal(scrolls(game, s), 5);
  assert.equal(c.last('doubloons')?.scrolls, 5, 'her client told');
  assert.equal(c.last('premium')?.view.scrolls, 5, 'the shop shows them');
  premiumMessage(game, s, { t: 'premium', action: 'buy_scrolls', pack: 'nope' });
  assert.equal(scrolls(game, s), 5, 'no such pack');
  // The scrolls cannot be written: the doubloons come back with them (the transaction rolls back).
  const real = game.db.addScrolls.bind(game.db);
  game.db.addScrolls = () => null;
  assert.throws(() => premiumMessage(game, s, { t: 'premium', action: 'buy_scrolls', pack: 'scroll1' }));
  game.db.addScrolls = real;
  assert.equal(game.db.doubloons(s.accountId), 50, 'not a doubloon moved');
  assert.equal(scrolls(game, s), 5);
  const buy = game.db.ledgerFlows(0).find((f) => f.kind === 'autoscroll_buy')!;
  assert.equal(Number(buy.n), 1, 'one purchase in the ledger');
});

test('the disconnect’s fallback: gone from the helm, her side fights on by itself and no scroll is spent; back, the helm is hers again (a scroll spent keeps «Авто»)', () => {
  const { game, c, s, bt } = boarded('Gone Gwen', 40);
  c.close(); // her connection lost; her ship lingers at sea
  assert.notEqual(s.disconnectedAt, null);
  steps(game, 3);
  assert.equal(bt.heroes[0].auto, true, 'her side plays by itself');
  assert.equal(bt.heroes[0].gone, true);
  assert.equal(scrolls(game, s), 0, 'free: fair play');
  const seq = bt.seq;
  steps(game, 20 * 4);
  assert.ok(bt.seq > seq || bt.over, 'the battle goes on');
  // Back at the helm (a reconnect takes the same ship over).
  s.disconnectedAt = null;
  steps(game, 2);
  if (!bt.over) {
    assert.equal(bt.heroes[0].auto, false, 'the helm is hers again: the fallback is no free auto-battle');
    assert.equal(bt.heroes[0].gone, false);
  }
  // With a scroll spent on the battle her «Авто» stays.
  const h = { auto: true, gone: true, paid: true } as Parameters<typeof helmFallback>[0];
  assert.equal(helmFallback(h, false), false);
  assert.equal(h.auto, true);
});

test('the admin’s /scrolls N (and −N), its HELP pair command for command; a top seal’s weekly scroll; every new line in Russian', () => {
  const { game } = makeGame();
  const { s } = atSea(game, 'Admin Ann');
  assert.match(runAdmin(game, s, '/scrolls') ?? '', /^Auto-battle scrolls: 0\. Usage/);
  assert.equal(runAdmin(game, s, '/scrolls 7'), 'Auto-battle scrolls: 7.');
  assert.equal(runAdmin(game, s, '/scrolls -2'), 'Auto-battle scrolls: 5.');
  assert.match(runAdmin(game, s, '/scrolls -9') ?? '', /Not that many/);
  const help = runAdmin(game, s, '/help')!;
  assert.ok(help.includes('/scrolls [N|-N]'));
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru?.includes('/scrolls [N|-N]'), 'the Russian HELP');
  assert.equal(ru.split(' · ').length, help.split(' · ').length, 'command for command');
  assert.ok(SEAL_SCROLL_LV >= 10, 'a top seal only');
  const seal = { lv: SEAL_SCROLL_LV, kind: 'grotto', runs: 0, timed: 0 } as unknown as Parameters<typeof sealScroll>[2];
  assert.equal(sealScroll(game, s, seal, SEAL_SCROLL_LV - 1), false, 'below the top: none');
  assert.equal(sealScroll(game, s, seal, SEAL_SCROLL_LV), true, 'a top seal won in time: one');
  assert.equal(sealScroll(game, s, seal, SEAL_SCROLL_LV + 2), false, 'once a week');
  assert.equal(scrolls(game, s), 6);
  seal.scrollWeek = (seal.scrollWeek ?? 0) - 1; // the next week
  assert.equal(sealScroll(game, s, seal, SEAL_SCROLL_LV), true);
  assert.equal(scrolls(game, s), 7);
  setLang('ru');
  try {
    for (const line of [NO_SCROLL, 'Auto-battle scrolls: +5 for 100 doubloons (12 in all).', 'Auto-battle scrolls: 3. Usage: /scrolls N|-N', 'Auto-battle scrolls: 3.']) {
      const t = serverText(line);
      assert.ok(!/[A-Za-z]{3,}/.test(t.replace(/\/scrolls N\|-N/g, '')), `${line} → ${t}`);
    }
  } finally {
    setLang('en');
  }
});
