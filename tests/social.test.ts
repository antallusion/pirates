import { test } from 'node:test';
import assert from 'node:assert/strict';
import { damageBlocked } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import { groupOfAccount, inConvoy } from '../server/src/game/party.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { LISTING_MS, PACKET_DELAY_MS, POSTAGE } from '../server/src/game/post.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function sess(game: Game, name: string): PlayerSession {
  return game.sessionByName(name)!;
}

/** Puts a captain at sea, stopped, at a spot. */
function atSea(game: Game, c: FakeConn, s: PlayerSession, x: number, y: number): void {
  c.push({ t: 'undock' });
  s.ship!.docked = null;
  s.ship!.state.x = x;
  s.ship!.state.y = y;
  s.ship!.state.speed = 0;
  s.ship!.input = { rudder: 0, sailTarget: 0 };
  s.ship!.state.sail = 0;
  void game;
}

function group(game: Game, a: FakeConn, b: FakeConn, bName: string): void {
  a.push({ t: 'group', action: 'invite', name: bName });
  const inv = b.last('party')!.invites[0];
  assert.ok(inv, 'the invitation arrives');
  b.push({ t: 'group', action: 'accept', id: inv.id });
  void game;
}

test('groups: invite, accept, allies who cannot hurt each other, a group channel, leaving disbands', () => {
  const { game } = makeGame();
  const a = join(game, 'Anne Gale');
  const b = join(game, 'Bram Gale');
  const c = join(game, 'Cora Gale');
  group(game, a, b, 'bram gale');
  const A = sess(game, 'Anne Gale'), B = sess(game, 'Bram Gale'), C = sess(game, 'Cora Gale');
  const g = groupOfAccount(game, A.accountId)!;
  assert.deepEqual(g.members, [A.accountId, B.accountId]);
  assert.equal(g.leader, A.accountId);
  assert.equal(a.last('party')!.group!.members.length, 2);
  assert.ok(game.areAllies(A.ship!, B.ship!));
  assert.ok(!game.areAllies(A.ship!, C.ship!));
  // Out at sea in lawless water they still cannot hurt each other.
  A.ship!.docked = null;
  B.ship!.docked = null;
  A.profile!.level = B.profile!.level = 20;
  A.ship!.region = B.ship!.region = 'dead_mans_expanse';
  assert.equal(damageBlocked(game, A.ship!, B.ship!), 'friendly');
  // Only the leader invites; a full group is refused later.
  b.push({ t: 'group', action: 'invite', name: 'Cora Gale' });
  assert.match(b.last('toast')!.msg, /leader/);
  a.push({ t: 'group', action: 'say', text: 'Wind is backing west' });
  assert.equal(b.last('chat')!.ch, 'group');
  assert.equal(c.last('chat'), undefined, 'outsiders do not hear it');
  a.push({ t: 'group', action: 'lead', name: 'Bram Gale' });
  assert.equal(g.leader, B.accountId);
  a.push({ t: 'group', action: 'leave' });
  assert.equal(groupOfAccount(game, B.accountId), null, 'two less one is no group');
  assert.equal(b.last('party')!.group, null);
  // Declining.
  a.push({ t: 'group', action: 'invite', name: 'Cora Gale' });
  c.push({ t: 'group', action: 'decline', id: c.last('party')!.invites[0].id });
  assert.match(a.last('toast')!.msg, /declines/);
  assert.equal(groupOfAccount(game, C.accountId), null);
});

test('convoy: in station everyone makes the slowest ship’s speed ×1.05 and sees 30% farther', () => {
  const { game } = makeGame();
  const a = join(game, 'Anne Line');
  const b = join(game, 'Bram Line');
  group(game, a, b, 'Bram Line');
  const A = sess(game, 'Anne Line'), B = sess(game, 'Bram Line');
  B.ship!.addEffect({ id: 'test_foul_bottom', until: Infinity, mods: { maxSpeed: -0.3 } }, game.now);
  const fast = A.ship!.stats.maxSpeed, slow = B.ship!.stats.maxSpeed, sight = A.ship!.stats.detection;
  assert.ok(slow < fast);
  atSea(game, a, A, 30_000, 30_000);
  atSea(game, b, B, 30_400, 30_000);
  a.push({ t: 'group', action: 'convoy', on: true });
  steps(game, 21);
  assert.ok(A.ship!.hasEffect('convoy') && B.ship!.hasEffect('convoy'));
  assert.ok(Math.abs(A.ship!.stats.maxSpeed - slow * 1.05) < 0.05, `${A.ship!.stats.maxSpeed} vs ${slow * 1.05}`);
  assert.ok(Math.abs(B.ship!.stats.maxSpeed - slow * 1.05) < 0.05);
  assert.ok(A.ship!.stats.detection > sight * 1.2);
  assert.equal(a.last('party')!.group!.members.every((m) => m.inConvoy), true);
  assert.ok(inConvoy(game, A), 'League premiums −30% under the convoy signal');
  // Out of station: back to her own pace.
  B.ship!.state.x = 40_000;
  steps(game, 21);
  assert.ok(!A.ship!.hasEffect('convoy'));
  assert.ok(Math.abs(A.ship!.stats.maxSpeed - fast) < 1e-6);
  // Signal down.
  B.ship!.state.x = 30_400;
  steps(game, 21);
  assert.ok(A.ship!.hasEffect('convoy'));
  a.push({ t: 'group', action: 'convoy', on: false });
  assert.ok(!A.ship!.hasEffect('convoy') && !B.ship!.hasEffect('convoy'));
});

test('the victor and their group have the first 30 seconds on the wreckage', () => {
  const { game } = makeGame();
  const a = join(game, 'Anne Salvo');
  const b = join(game, 'Bram Salvo');
  const c = join(game, 'Cora Salvo');
  group(game, a, b, 'Bram Salvo');
  const A = sess(game, 'Anne Salvo'), B = sess(game, 'Bram Salvo'), C = sess(game, 'Cora Salvo');
  atSea(game, a, A, 20_000, 20_000);
  atSea(game, b, B, 25_000, 20_000);
  atSea(game, c, C, 22_000, 20_000);
  for (const s of [A, B, C]) s.ship!.cargo = {};
  const put = (x: number) => {
    const id = 900_000 + x;
    game.loot.set(id, { id, x, y: 20_000, cargo: { rum: 3 }, gold: 0, expires: game.now + 600, claim: { account: A.accountId, until: game.now + 30 } } as never);
    return id;
  };
  const atC = put(22_000);
  const atB = put(25_000);
  steps(game, 21);
  assert.ok(game.loot.has(atC), 'an outsider must wait');
  assert.ok(!game.loot.has(atB), 'the group takes it');
  assert.equal(B.ship!.cargo.rum, 3);
  game.now += 31;
  steps(game, 21);
  assert.ok(!game.loot.has(atC), 'after 30 s it is anyone’s');
});

test('barter across the quay: offers, both ready, silver and goods change hands with their taint', () => {
  const { game } = makeGame();
  const a = join(game, 'Anne Quay');
  const b = join(game, 'Bram Quay');
  const A = sess(game, 'Anne Quay'), B = sess(game, 'Bram Quay');
  A.profile!.level = B.profile!.level = 20;
  A.ship!.cargo = { rum: 10 };
  A.profile!.stolen = { rum: 4 };
  B.ship!.cargo = {};
  a.push({ t: 'barter', action: 'propose', name: 'Bram Quay' });
  assert.match(b.last('toast')!.msg, /wants to trade/);
  b.push({ t: 'barter', action: 'propose', name: 'Anne Quay' });
  assert.ok(a.last('barter')!.view, 'the table is open');
  a.push({ t: 'barter', action: 'offer', gold: 0, cargo: { rum: 6 } });
  b.push({ t: 'barter', action: 'offer', gold: 300, cargo: {} });
  a.push({ t: 'barter', action: 'lock' });
  b.push({ t: 'barter', action: 'lock' });
  a.push({ t: 'barter', action: 'ready' });
  // A change of terms calls both back to the table.
  b.push({ t: 'barter', action: 'unlock' });
  b.push({ t: 'barter', action: 'offer', gold: 250, cargo: {} });
  b.push({ t: 'barter', action: 'lock' });
  assert.equal(a.last('barter')!.view!.me.ready, false);
  assert.equal(a.last('barter')!.view!.them.gold, 250);
  a.push({ t: 'barter', action: 'ready' });
  const goldA = A.profile!.gold, goldB = B.profile!.gold;
  b.push({ t: 'barter', action: 'ready' });
  assert.equal(A.profile!.gold, goldA + 250);
  assert.equal(B.profile!.gold, goldB - 250);
  assert.equal(A.ship!.cargo.rum, 4);
  assert.equal(B.ship!.cargo.rum, 6);
  assert.equal(B.profile!.stolen.rum, 4, 'plunder stays plunder');
  assert.equal(a.last('barter')!.view, null);
  // You cannot offer what you do not have.
  a.push({ t: 'barter', action: 'propose', name: 'Bram Quay' });
  b.push({ t: 'barter', action: 'propose', name: 'Anne Quay' });
  a.push({ t: 'barter', action: 'offer', gold: 999_999, cargo: {} });
  assert.match(a.last('toast')!.msg, /silver/);
});

test('barter at sea: within reach, the boats take time, and parting calls it off', () => {
  const { game } = makeGame();
  const a = join(game, 'Anne Swell');
  const b = join(game, 'Bram Swell');
  const A = sess(game, 'Anne Swell'), B = sess(game, 'Bram Swell');
  A.profile!.level = B.profile!.level = 20;
  A.profile!.pvp.flag = B.profile!.pvp.flag = 'faction'; // a neutral captain takes no goods at sea (docs/24)
  atSea(game, a, A, 50_000, 50_000);
  atSea(game, b, B, 50_400, 50_000);
  A.ship!.cargo = { sugar: 8 };
  B.ship!.cargo = {};
  a.push({ t: 'barter', action: 'propose', name: 'Bram Swell' });
  assert.match(a.last('toast')!.msg, /Come within/);
  B.ship!.state.x = 50_060;
  a.push({ t: 'barter', action: 'propose', name: 'Bram Swell' });
  b.push({ t: 'barter', action: 'propose', name: 'Anne Swell' });
  a.push({ t: 'barter', action: 'offer', gold: 0, cargo: { sugar: 8 } });
  b.push({ t: 'barter', action: 'offer', gold: 100, cargo: {} });
  a.push({ t: 'barter', action: 'lock' });
  b.push({ t: 'barter', action: 'lock' });
  a.push({ t: 'barter', action: 'ready' });
  b.push({ t: 'barter', action: 'ready' });
  assert.ok(a.last('barter')!.view!.transfer > 0, 'boats under way');
  assert.equal(B.ship!.cargo.sugar, undefined);
  steps(game, 20 * 15);
  assert.equal(B.ship!.cargo.sugar, 8);
  // Again, but the ships drift apart mid-transfer.
  B.ship!.cargo.sugar = 8;
  b.push({ t: 'barter', action: 'propose', name: 'Anne Swell' });
  a.push({ t: 'barter', action: 'propose', name: 'Bram Swell' });
  b.push({ t: 'barter', action: 'offer', gold: 0, cargo: { sugar: 8 } });
  a.push({ t: 'barter', action: 'lock' });
  b.push({ t: 'barter', action: 'lock' });
  a.push({ t: 'barter', action: 'ready' });
  b.push({ t: 'barter', action: 'ready' });
  B.ship!.state.x = 51_000;
  steps(game, 21);
  assert.match(a.all('toast').map((t) => t.msg).join('|'), /Trade called off/);
  assert.equal(B.ship!.cargo.sugar, 8);
});

test('letters: postage, the packet boat’s delay, a silver draft collected in port, offline captains', () => {
  const { game, db } = makeGame();
  let clock = 1_000_000;
  game.wallNow = () => clock;
  const a = join(game, 'Anne Quill');
  const b = join(game, 'Bram Quill');
  const A = sess(game, 'Anne Quill'), B = sess(game, 'Bram Quill');
  const gold0 = A.profile!.gold;
  a.push({ t: 'mail', action: 'send', to: 'bram quill', subject: 'Terms', body: 'Meet me at the Hanged Man.', gold: 100 });
  assert.equal(A.profile!.gold, gold0 - 100 - POSTAGE - 2);
  b.push({ t: 'mail', action: 'list' });
  assert.equal(b.last('mail')!.letters.length, 0, 'still at sea');
  clock += PACKET_DELAY_MS;
  steps(game, 21);
  const m = b.last('mail')!;
  assert.equal(m.unread, 1);
  const letter = m.letters[0];
  assert.equal(letter.from, 'Anne Quill');
  assert.equal(letter.gold, 100);
  const bGold = B.profile!.gold;
  b.push({ t: 'mail', action: 'delete', id: letter.id });
  assert.match(b.last('toast')!.msg, /Collect/);
  b.push({ t: 'mail', action: 'take', id: letter.id });
  assert.equal(B.profile!.gold, bGold + 100);
  b.push({ t: 'mail', action: 'take', id: letter.id });
  assert.equal(B.profile!.gold, bGold + 100, 'once');
  b.push({ t: 'mail', action: 'delete', id: letter.id });
  assert.equal(b.last('mail')!.letters.length, 0);
  // To a captain not in the world: it waits in the box.
  const off = db.createAccount('Absent Friend', 'x'.repeat(64));
  a.push({ t: 'mail', action: 'send', to: 'Absent Friend', subject: 'Where are you', body: '', gold: 0 });
  assert.equal(db.getKv<{ letters: unknown[] }>(`mail:${off}`)!.letters.length, 1);
  a.push({ t: 'mail', action: 'send', to: 'Nobody At All', subject: 'x', body: '', gold: 0 });
  assert.match(a.last('toast')!.msg, /No captain/);
});

test('the market board: sell listings, buy orders, duty, goods waiting in port, expiry', () => {
  const { game } = makeGame();
  let clock = 5_000_000;
  game.wallNow = () => clock;
  const a = join(game, 'Anne Board');
  const b = join(game, 'Bram Board');
  const A = sess(game, 'Anne Board'), B = sess(game, 'Bram Board');
  A.ship!.cargo = { sugar: 10 };
  B.ship!.cargo = {};
  a.push({ t: 'market', action: 'sell', good: 'sugar', qty: 10, price: 40 });
  assert.equal(A.ship!.cargo.sugar, undefined, 'the goods go into the harbour store');
  b.push({ t: 'market', action: 'list' });
  const view = b.last('market')!.view;
  assert.equal(view.port, 'saltmarrow');
  assert.equal(view.listings.length, 1);
  const lid = view.listings[0].id;
  const bGold = B.profile!.gold;
  b.push({ t: 'market', action: 'fill', id: lid, qty: 4 });
  assert.equal(B.ship!.cargo.sugar, 4);
  assert.equal(B.profile!.gold, bGold - 160);
  const sold = a.last('mail')!.letters.find((l) => l.subject.startsWith('Sold'))!;
  assert.equal(sold.gold, Math.floor(160 * (1 - view.saleTax)));
  a.push({ t: 'market', action: 'fill', id: lid, qty: 1 });
  assert.match(a.last('toast')!.msg, /own listing/);
  // A buy order: Bram holds silver for rum; Anne fills it and is paid at once; the rum waits for Bram here.
  A.ship!.cargo = { rum: 5 };
  const held = B.profile!.gold;
  b.push({ t: 'market', action: 'buy_order', good: 'rum', qty: 5, price: 30 });
  assert.equal(B.profile!.gold, held - 150 - 5);
  a.push({ t: 'market', action: 'list' });
  const order = a.last('market')!.view.listings.find((l) => l.kind === 'buy')!;
  const aGold = A.profile!.gold;
  a.push({ t: 'market', action: 'fill', id: order.id, qty: 5 });
  assert.equal(A.profile!.gold, aGold + Math.floor(150 * (1 - view.saleTax)));
  const bought = b.last('mail')!.letters.find((l) => l.goods?.good === 'rum')!;
  assert.equal(bought.goods!.port, 'saltmarrow');
  b.push({ t: 'mail', action: 'take', id: bought.id });
  assert.equal(B.ship!.cargo.rum, 5);
  // The rest of the sugar runs out and comes back as goods to collect here.
  clock += LISTING_MS + 1;
  steps(game, 201);
  const back = a.last('mail')!.letters.find((l) => l.subject.startsWith('Expired'))!;
  assert.deepEqual(back.goods, { good: 'sugar', qty: 6, port: 'saltmarrow' });
  a.push({ t: 'market', action: 'list' });
  assert.equal(a.last('market')!.view.listings.length, 0);
});

test('the Tidewrack trophy auction: reserve, outbids refunded by letter, buyout, commission', () => {
  const { game } = makeGame();
  let clock = 9_000_000;
  game.wallNow = () => clock;
  const a = join(game, 'Anne Gavel');
  const b = join(game, 'Bram Gavel');
  const c = join(game, 'Cora Gavel');
  const A = sess(game, 'Anne Gavel'), B = sess(game, 'Bram Gavel'), C = sess(game, 'Cora Gavel');
  A.ship!.cargo = { pearls: 3 };
  a.push({ t: 'market', action: 'auction', good: 'pearls', qty: 3, price: 500, buyout: 900, hours: 8 });
  assert.match(a.last('toast')!.msg, /Tidewrack/);
  for (const s of [A, B, C]) s.ship!.docked = 'tidewrack';
  for (const s of [A, B, C]) s.profile!.gold = 5000;
  a.push({ t: 'market', action: 'auction', good: 'pearls', qty: 3, price: 500, buyout: 900, hours: 8 });
  a.push({ t: 'market', action: 'list' });
  const lot = a.last('market')!.view.listings[0];
  assert.equal(lot.kind, 'auction');
  b.push({ t: 'market', action: 'bid', id: lot.id, price: 400 });
  assert.match(b.last('toast')!.msg, /at least 500/);
  b.push({ t: 'market', action: 'bid', id: lot.id, price: 500 });
  assert.equal(B.profile!.gold, 4500);
  c.push({ t: 'market', action: 'bid', id: lot.id, price: 510 });
  assert.match(c.last('toast')!.msg, /at least 525/);
  c.push({ t: 'market', action: 'bid', id: lot.id, price: 600 });
  assert.equal(b.last('mail')!.letters[0].gold, 500, 'outbid: silver back by letter');
  a.push({ t: 'market', action: 'cancel', id: lot.id });
  assert.match(a.last('toast')!.msg, /bids/);
  b.push({ t: 'market', action: 'bid', id: lot.id, price: 5000 });
  assert.equal(B.profile!.gold, 4500 - 900 + 0, 'a bid over the buyout pays the buyout');
  const won = b.last('mail')!.letters.find((l) => l.subject.startsWith('Won'))!;
  assert.deepEqual(won.goods, { good: 'pearls', qty: 3, port: 'tidewrack' });
  const paid = a.last('mail')!.letters.find((l) => l.subject.startsWith('Sold at auction'))!;
  assert.equal(paid.gold, 900 - 45);
  assert.equal(c.last('mail')!.letters[0].gold, 600);
  // An auction nobody wants comes home.
  A.ship!.cargo = { pearls: 1 };
  a.push({ t: 'market', action: 'auction', good: 'pearls', qty: 1, price: 800, buyout: 0, hours: 2 });
  clock += 2 * 3_600_000 + 1;
  steps(game, 201);
  assert.ok(a.last('mail')!.letters.some((l) => l.subject.startsWith('Unsold') && l.goods?.qty === 1));
});
