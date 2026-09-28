// The Floating Bazaar (docs/12 P10 #19): a stall on her ship in port, goods and pieces in escrow at her prices; the
// captains in port buy from it; the takings by letter less the harbour's cut; closing it brings the rest aboard; a
// week-old stall closes and what was left waits for her; her shadow ship is seen by the sea near.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HARBOUR_CUT, PAY_EVERY_MIN, STALL_DAYS, STALL_FEE, bazaarPatterns } from '../shared/src/data/bazaar.ts';
import { makeItem } from '../shared/src/data/items.ts';
import type { Game } from '../server/src/game/Game.ts';
import { addGood, addItem, buyAtStall, claimBazaar, closeStall, openStall, removeLine, sendBazaarShadows, stallOf, stepBazaar } from '../server/src/game/bazaar.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

function trader(game: Game, name: string): { s: PlayerSession; c: ReturnType<typeof join> } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.gold = 100_000;
  return { s, c };
}

const mail = (game: Game, id: number) => game.db.getKv<{ letters: { gold: number; body: string }[] }>(`mail:${id}`)?.letters ?? [];

test('a stall: goods and pieces in escrow at her price; a captain in port buys; the takings by letter, less the cut', () => {
  const { game } = makeGame();
  const t0 = game.wallNow();
  const { s } = trader(game, 'Seller Sal');
  const { s: b } = trader(game, 'Buyer Ben');
  const port = game.portById(s.ship!.docked!)!;
  b.ship!.docked = port.id;
  assert.equal(addGood(game, s, port, 'rum', 5, 30), 'You keep no stall here.');
  assert.equal(openStall(game, s, port), null);
  assert.equal(s.profile!.gold, 100_000 - STALL_FEE);
  assert.match(openStall(game, s, port)!, /^You already keep a stall at /);
  s.ship!.cargo.rum = 40;
  assert.equal(addGood(game, s, port, 'rum', 50, 30), 'You have not that much aboard.');
  assert.equal(addGood(game, s, port, 'rum', 30, 1_000_000), 'That price will not do.');
  assert.equal(addGood(game, s, port, 'rum', 30, 40), null);
  assert.equal(s.ship!.cargo.rum, 10, 'in escrow');
  const it = makeItem(game.rng, s.profile!.itemSeq++, { ilvl: 3, rarity: 2 });
  s.profile!.stash.push(it);
  const bound = { ...makeItem(game.rng, s.profile!.itemSeq++, { ilvl: 3, rarity: 2 }), bound: true };
  s.profile!.stash.push(bound);
  assert.equal(addItem(game, s, port, bound.uid, 500), 'A bound piece is not for sale.');
  assert.equal(addItem(game, s, port, it.uid, 900), null);
  assert.ok(!s.profile!.stash.some((x) => x.uid === it.uid));
  // The buyer.
  assert.equal(buyAtStall(game, s, port, s.accountId, 'good', 0, 1), 'That is your own stall.');
  const bg0 = b.profile!.gold;
  assert.equal(buyAtStall(game, b, port, s.accountId, 'good', 0, 10), null);
  assert.equal(b.ship!.cargo.rum, 10);
  assert.equal(b.profile!.gold, bg0 - 400);
  assert.equal(buyAtStall(game, b, port, s.accountId, 'item', 0, 1), null);
  assert.ok(b.profile!.stash.some((x) => x.base === it.base && x.rarity === it.rarity));
  const st = stallOf(game, s.accountId)!;
  const take = Math.floor(400 * (1 - HARBOUR_CUT)) + Math.floor(900 * (1 - HARBOUR_CUT));
  assert.equal(st.sold, take);
  // Ten minutes on: the takings go by letter.
  game.wallNow = () => t0 + PAY_EVERY_MIN * 60_000 + 1000;
  stepBazaar(game);
  assert.ok(mail(game, s.accountId).some((l) => l.gold === take));
  assert.equal(stallOf(game, s.accountId)!.owed, 0);
});

test('taking back, closing, and a week-old stall: what was left comes home', () => {
  const { game } = makeGame();
  const t0 = game.wallNow();
  const { s } = trader(game, 'Keeper Kit');
  const port = game.portById(s.ship!.docked!)!;
  assert.equal(openStall(game, s, port), null);
  s.ship!.cargo = { sugar: 20 }; // an empty hold but for the sugar
  assert.equal(addGood(game, s, port, 'sugar', 20, 20), null);
  assert.equal(removeLine(game, s, port, 'good', 0), null);
  assert.equal(s.ship!.cargo.sugar, 20);
  assert.equal(addGood(game, s, port, 'sugar', 15, 20), null);
  assert.equal(closeStall(game, s, port), null);
  assert.equal(s.ship!.cargo.sugar, 20);
  assert.equal(stallOf(game, s.accountId), null);
  // Open again, set out, sail, and a week passes.
  assert.equal(openStall(game, s, port), null);
  assert.equal(addGood(game, s, port, 'sugar', 12, 20), null);
  const it = makeItem(game.rng, s.profile!.itemSeq++, { ilvl: 2, rarity: 1 });
  s.profile!.stash.push(it);
  assert.equal(addItem(game, s, port, it.uid, 300), null);
  const n0 = s.profile!.stash.length;
  game.wallNow = () => t0 + STALL_DAYS * 86_400_000 + 1000;
  stepBazaar(game);
  assert.equal(stallOf(game, s.accountId), null);
  assert.equal(s.profile!.warehouses[port.id]?.sugar, 12, 'the goods to her warehouse there');
  assert.equal(s.profile!.stash.length, n0 + 1, 'the piece to her locker');
  claimBazaar(game, s);
  assert.equal(s.profile!.warehouses[port.id]?.sugar, 12, 'nothing twice');
});

test('her shadow ship is seen by the sea near the port', () => {
  const { game } = makeGame();
  const { s } = trader(game, 'Shadow Sue');
  const { s: o, c } = trader(game, 'Passer Pip');
  const port = game.portById(s.ship!.docked!)!;
  assert.equal(openStall(game, s, port), null);
  o.ship!.docked = null;
  o.ship!.state.x = port.x + 800;
  o.ship!.state.y = port.y;
  sendBazaarShadows(game, o);
  const sh = (c.last('bazaar') as { shadows: { name: string; port: string }[] }).shadows;
  assert.deepEqual(sh.map((x) => [x.name, x.port]), [['Shadow Sue', port.id]]);
});

test('the bazaar reads in Russian', () => {
  setLang('ru');
  const t = (x: string) => serverText(x).replace(/\u00a0/g, ' ');
  assert.equal(t('You close your stall: what was left is back aboard.'), 'Вы закрыли лавку: всё непроданное вернулось на борт.');
  for (const [en, ru] of bazaarPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
