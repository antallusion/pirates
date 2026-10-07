import { test } from 'node:test';
import assert from 'node:assert/strict';
import { islandSize, islandSlots } from '../shared/src/data/holdings.ts';
import { damageBlocked } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import { NODE_HOLD_SEC, WAR_COST } from '../server/src/game/guilds.ts';
import { legalTarget } from '../server/src/game/pvp.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const DAY = 86_400_000;

function world() {
  const { game } = makeGame();
  game_ = game;
  let clock = 1_700_000_000_000;
  game.wallNow = () => clock;
  return { game, advance: (ms: number) => (clock += ms) };
}

function captain(game: Game, name: string, gold = 200_000): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.gold = gold;
  s.profile!.level = 30;
  s.ship!.level = 30;
  return { c, s };
}

let game_: Game;
function atSea(s: PlayerSession, x: number, y: number, region: string): void {
  const sh = s.ship!;
  sh.docked = null;
  s.profile!.docked = null;
  sh.state.x = x;
  sh.state.y = y;
  sh.state.speed = 0;
  sh.state.sail = 0;
  sh.input = { rudder: 0, sailTarget: 0 };
  sh.region = region as never;
  sh.protectedUntil = 0;
  sh.lastCombat = -1000;
  game_.grid.upsert(sh.id, x, y);
}

function found(game: Game, c: FakeConn, s: PlayerSession, name: string, tag: string) {
  c.push({ t: 'guild', action: 'found', name, tag });
  const g = game.guilds.of(game, s.accountId);
  assert.ok(g, c.last('toast')?.msg);
  return g!;
}

function recruit(game: Game, admiral: FakeConn, g: { id: number }, who: { c: FakeConn; s: PlayerSession }): void {
  admiral.push({ t: 'guild', action: 'invite', name: who.s.name });
  who.c.push({ t: 'guild', action: 'answer', id: g.id, accept: true });
  assert.equal(game.guilds.of(game, who.s.accountId)?.id, g.id);
}

test('founding, the tag on the ship, invitations, ranks and their limits', () => {
  const { game } = world();
  const A = captain(game, 'Anne Keel'), B = captain(game, 'Bram Keel'), C = captain(game, 'Cora Keel');
  const g = found(game, A.c, A.s, 'The Salt Court', 'salt');
  assert.equal(g.tag, 'SALT');
  assert.equal(A.s.profile!.gold, 200_000 - 10_000);
  assert.equal(A.s.ship!.info().guild, 'SALT');
  B.c.push({ t: 'guild', action: 'found', name: 'Other Court', tag: 'SALT' });
  assert.match(B.c.last('toast')!.msg, /tag is taken/);
  recruit(game, A.c, g, B);
  assert.equal(g.members.find((m) => m.account === B.s.accountId)!.rank, 'cabin_boy');
  assert.equal(B.s.ship!.guildTag, 'SALT');
  // A cabin boy cannot invite; the admiral promotes.
  B.c.push({ t: 'guild', action: 'invite', name: 'Cora Keel' });
  assert.match(B.c.last('toast')!.msg, /Commodores/);
  A.c.push({ t: 'guild', action: 'rank', account: B.s.accountId, rank: 'vice' });
  assert.equal(g.members.find((m) => m.account === B.s.accountId)!.rank, 'vice');
  recruit(game, B.c, g, C);
  // A vice-admiral cannot make another vice-admiral.
  B.c.push({ t: 'guild', action: 'rank', account: C.s.accountId, rank: 'vice' });
  assert.match(B.c.last('toast')!.msg, /cannot give/);
  B.c.push({ t: 'guild', action: 'kick', account: C.s.accountId });
  assert.equal(game.guilds.of(game, C.s.accountId), null);
  assert.equal(C.s.ship!.guildTag, null);
  // Handing over the admiralty.
  A.c.push({ t: 'guild', action: 'rank', account: B.s.accountId, rank: 'admiral' });
  assert.equal(g.members.find((m) => m.account === B.s.accountId)!.rank, 'admiral');
  assert.equal(g.members.find((m) => m.account === A.s.accountId)!.rank, 'vice');
  // Guild chat.
  A.c.push({ t: 'guild', action: 'say', text: 'Muster at dawn' });
  assert.equal(B.c.last('chat')!.ch, 'guild');
  assert.equal(C.c.all('chat').filter((m) => m.ch === 'guild').length, 0);
});

test('the treasury: deposits, rank caps, the first day; the tax on members’ sales', () => {
  const { game, advance } = world();
  const A = captain(game, 'Anne Coin'), B = captain(game, 'Bram Coin');
  const g = found(game, A.c, A.s, 'Coin Guild', 'COIN');
  recruit(game, A.c, g, B);
  A.c.push({ t: 'guild', action: 'treasury', amount: 100_000 });
  assert.equal(g.treasury, 100_000);
  B.c.push({ t: 'guild', action: 'treasury', amount: -100 });
  assert.match(B.c.last('toast')!.msg, /only deposit/);
  A.c.push({ t: 'guild', action: 'rank', account: B.s.accountId, rank: 'vice' });
  B.c.push({ t: 'guild', action: 'treasury', amount: -100 });
  assert.match(B.c.last('toast')!.msg, /first day/);
  advance(DAY + 1);
  B.c.push({ t: 'guild', action: 'treasury', amount: -60_000 });
  assert.match(B.c.last('toast')!.msg, /50000 worth a day/);
  B.c.push({ t: 'guild', action: 'treasury', amount: -30_000 });
  assert.equal(g.treasury, 70_000);
  // The tax.
  A.c.push({ t: 'guild', action: 'tax', pct: 10 });
  B.s.ship!.cargo = { salt: 20 };
  const before = g.treasury, gold = B.s.profile!.gold;
  B.c.push({ t: 'trade', good: 'salt', qty: -20 });
  const earned = B.s.profile!.gold - gold;
  const cut = g.treasury - before;
  assert.ok(cut > 0 && Math.abs(cut - (earned + cut) * 0.1) <= 1, `cut ${cut} of ${earned + cut}`);
});

test('offices, the store, contracts paid from the treasury, and the guild fleet on loan', () => {
  const { game, advance } = world();
  const A = captain(game, 'Anne Dock'), B = captain(game, 'Bram Dock');
  const g = found(game, A.c, A.s, 'Dock Guild', 'DOCK');
  recruit(game, A.c, g, B);
  A.c.push({ t: 'guild', action: 'office' });
  assert.match(A.c.last('toast')!.msg, /treasury/);
  A.c.push({ t: 'guild', action: 'treasury', amount: 50_000 });
  A.c.push({ t: 'guild', action: 'office' });
  const port = A.s.ship!.docked!;
  assert.ok(g.offices[port] > game.wallNow());
  A.c.push({ t: 'guild', action: 'contract', good: 'salt', qty: 10, reward: 25 });
  B.s.ship!.cargo = { salt: 15 };
  const gold = B.s.profile!.gold;
  B.c.push({ t: 'guild', action: 'store', good: 'salt', qty: 15 });
  assert.equal(g.stores[port].salt, 15);
  assert.equal(B.s.profile!.gold, gold + 250, 'ten delivered under contract');
  assert.equal(g.contracts.length, 0);
  // A cabin boy deposits only; a bosun withdraws after the first day.
  B.c.push({ t: 'guild', action: 'store', good: 'salt', qty: -5 });
  assert.match(B.c.last('toast')!.msg, /only deposit/);
  A.c.push({ t: 'guild', action: 'rank', account: B.s.accountId, rank: 'bosun' });
  advance(DAY + 1);
  B.c.push({ t: 'guild', action: 'store', good: 'salt', qty: -5 });
  assert.equal(B.s.ship!.cargo.salt, 5);
  // The fleet: a captain gives a berthed hull; another borrows her against a deposit and returns her.
  A.s.profile!.berths.push({ port, loadout: { classId: 'brig', name: 'Guild Hull', guns: A.s.ship!.loadout.guns, modules: {} }, hull: 1 });
  A.c.push({ t: 'guild', action: 'give_ship', berth: 0 });
  assert.equal(g.fleet.length, 1);
  A.c.push({ t: 'guild', action: 'rank', account: B.s.accountId, rank: 'captain' });
  const bg = B.s.profile!.gold;
  B.c.push({ t: 'guild', action: 'borrow_ship', id: g.fleet[0].id });
  assert.equal(g.fleet[0].lentTo, B.s.accountId);
  assert.ok(B.s.profile!.gold < bg);
  assert.equal(B.s.profile!.berths[0].loadout.guild!.g, g.id);
  B.c.push({ t: 'guild', action: 'leave' });
  assert.match(B.c.last('toast')!.msg, /Return/);
  B.c.push({ t: 'guild', action: 'return_ship' });
  assert.equal(g.fleet[0].lentTo, null);
  assert.equal(B.s.profile!.gold, bg, 'deposit back');
});

test('guilds, allies and pacts hold their fire; a war makes enemies fair game and keeps score; peace on terms', () => {
  const { game, advance } = world();
  const A = captain(game, 'Anne War'), B = captain(game, 'Bram War'), C = captain(game, 'Cora War'), D = captain(game, 'Dana War');
  const g1 = found(game, A.c, A.s, 'First Guild', 'ONE');
  const g2 = found(game, C.c, C.s, 'Second Guild', 'TWO');
  recruit(game, A.c, g1, B);
  A.c.push({ t: 'guild', action: 'treasury', amount: 60_000 });
  C.c.push({ t: 'guild', action: 'treasury', amount: 5_000 });
  for (const [s, x] of [[A.s, 0], [B.s, 200], [C.s, 400], [D.s, 600]] as const) atSea(s, 40_000 + x, 40_000, 'gravewater');
  assert.equal(damageBlocked(game, A.s.ship!, B.s.ship!), 'friendly', 'same guild');
  // One city's colours, no war (docs/24 D1): they hold their fire too.
  assert.match(String(damageBlocked(game, A.s.ship!, C.s.ship!)), /at peace with yours/);
  assert.ok(!legalTarget(game, A.s.ship!, C.s.ship!));
  // A pact.
  A.c.push({ t: 'guild', action: 'pact', tag: 'TWO' });
  C.c.push({ t: 'guild', action: 'pact', tag: 'ONE' });
  assert.equal(damageBlocked(game, A.s.ship!, C.s.ship!), 'friendly');
  A.c.push({ t: 'guild', action: 'war', tag: 'TWO' });
  assert.match(A.c.last('toast')!.msg, /pact/);
  A.c.push({ t: 'guild', action: 'break_pact', tag: 'TWO' });
  // War: the fee, a day to prepare, then fair game.
  A.c.push({ t: 'guild', action: 'war', tag: 'TWO' });
  assert.equal(g1.treasury, 60_000 - WAR_COST);
  assert.ok(!legalTarget(game, A.s.ship!, C.s.ship!), 'not yet');
  advance(DAY + 1);
  assert.ok(legalTarget(game, A.s.ship!, C.s.ship!), 'war');
  assert.equal(damageBlocked(game, A.s.ship!, C.s.ship!), null, 'at war: fair game under the guilds’ colours');
  assert.match(String(damageBlocked(game, A.s.ship!, D.s.ship!)), /at peace with yours/, 'not a bystander');
  assert.ok(!legalTarget(game, A.s.ship!, D.s.ship!), 'not a bystander');
  const w = game.guilds.store(game).wars[0];
  C.s.ship!.attackers.set(A.s.ship!.id, game.now);
  C.s.ship!.hull = 0;
  game.beginSinking(C.s.ship!);
  assert.equal(w.score[g1.id], 10);
  // Peace only after seven days; offered with tribute, accepted by offering back.
  A.c.push({ t: 'guild', action: 'peace', tag: 'TWO', tribute: 0 });
  assert.match(A.c.last('toast')!.msg, /seven days/);
  advance(7 * DAY);
  C.c.push({ t: 'guild', action: 'peace', tag: 'ONE', tribute: 5_000 });
  A.c.push({ t: 'guild', action: 'peace', tag: 'TWO', tribute: 0 });
  assert.equal(game.guilds.store(game).wars.length, 0);
  assert.equal(g1.treasury, 10_000 + 5_000);
  A.c.push({ t: 'guild', action: 'war', tag: 'TWO' });
  assert.match(A.c.last('toast')!.msg, /peace forbids/);
  // An alliance: allies too.
  A.c.push({ t: 'guild', action: 'alliance', tag: 'TWO' });
  C.c.push({ t: 'guild', action: 'alliance', tag: 'ONE' });
  assert.ok(game.areAllies(A.s.ship!, C.s.ship!));
  void g2;
});

test('route nodes: held by presence alone, then a toll on passing merchants and word of who passes', () => {
  const { game } = world();
  const A = captain(game, 'Anne Route'), B = captain(game, 'Bram Route');
  const g = found(game, A.c, A.s, 'Route Guild', 'RTE');
  const st = game.guilds.store(game);
  const node = Object.values(st.nodes)[0];
  assert.ok(node, 'there are lighthouse islands to hold');
  const isl = game.world.islands[node.island];
  atSea(A.s, isl.x + isl.radius + 400, isl.y, isl.region);
  node.progress[g.id] = NODE_HOLD_SEC - 3;
  steps(game, 20 * 5);
  assert.equal(node.holder, g.id);
  // A rival's ship alone contests nothing while the holder keeps it; passing captains are reported.
  atSea(B.s, isl.x + isl.radius + 600, isl.y, isl.region);
  steps(game, 21);
  assert.ok(g.log.some((l) => l.text.includes('Bram Route')));
  // Only this merchant passes (the day's toll has a cap the villages' own traders could fill first).
  for (const o of [...game.ships.values()]) if (!o.isPlayer && Math.hypot(o.state.x - isl.x, o.state.y - isl.y) < 12000) game.removeShip(o.id);
  node.tollToday = { day: 0, paid: 0 };
  const m = game.spawnNpcShip('merchant', 'fluyt', 'league', isl.x + isl.radius + 1000, isl.y + 200, 0, { ship: 'Tolled', captain: 'F' });
  m.cargo = { spices: 30 };
  m.input = { rudder: 0, sailTarget: 0 };
  const t = g.treasury;
  // She lies off the light (her own course would carry her out of reach before the minute's toll is taken).
  const [mx, my] = [m.state.x, m.state.y];
  for (let i = 0; i < 61; i++) {
    m.state.x = mx;
    m.state.y = my;
    m.state.speed = 0;
    steps(game, 20);
  }
  assert.ok(g.treasury > t, 'the toll');
});

test('guild islands: leased from the treasury, used by members, raised to a base with more slots', () => {
  const { game } = world();
  const A = captain(game, 'Anne Base'), B = captain(game, 'Bram Base');
  const g = found(game, A.c, A.s, 'Base Guild', 'BASE');
  recruit(game, A.c, g, B);
  A.c.push({ t: 'guild', action: 'treasury', amount: 150_000 });
  const isl = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && islandSize(i.radius) === 'medium')!;
  atSea(A.s, isl.x + isl.radius + 150, isl.y, isl.region);
  A.c.push({ t: 'guild', action: 'lease', island: isl.id, days: 7 });
  const h = game.holdings.get(game, isl.id)!;
  assert.equal(h.owner.kind, 'guild');
  assert.equal(g.treasury, 150_000 - 36_000);
  // Members use it; the admiral's own island limit is untouched.
  atSea(B.s, isl.x + isl.radius + 150, isl.y, isl.region);
  B.s.ship!.cargo = { salt: 5 };
  B.c.push({ t: 'isle', action: 'store', island: isl.id, good: 'salt', qty: 5 });
  assert.equal(h.store.salt, 5);
  A.c.push({ t: 'guild', action: 'base', island: isl.id });
  assert.equal(h.base, 1);
  A.c.push({ t: 'isle', action: 'list' });
  assert.equal(A.c.last('holdings')!.mine[0].slots, islandSlots(isl.radius, isl.region) + 2);
});

test('the flagship’s standard steadies the guild; if she sinks, the standard is torn', () => {
  const { game } = world();
  const A = captain(game, 'Anne Flag'), B = captain(game, 'Bram Flag'), C = captain(game, 'Cora Flag');
  const g = found(game, A.c, A.s, 'Flag Guild', 'FLAG');
  recruit(game, A.c, g, B);
  A.s.ship!.loadout = { ...A.s.ship!.loadout, classId: 'galleon' };
  A.s.ship!.recompute(game.now);
  A.c.push({ t: 'guild', action: 'flagship', account: A.s.accountId });
  assert.equal(g.flagship, A.s.accountId);
  atSea(A.s, 50_000, 50_000, 'gravewater');
  atSea(B.s, 50_300, 50_000, 'gravewater');
  steps(game, 21);
  assert.ok(B.s.ship!.hasEffect('guild_standard'));
  atSea(C.s, 50_600, 50_000, 'gravewater');
  A.s.ship!.attackers.set(C.s.ship!.id, game.now);
  A.s.ship!.hull = 0;
  game.beginSinking(A.s.ship!);
  assert.ok(g.tornUntil > game.wallNow());
  steps(game, 21);
  assert.ok(B.s.ship!.hasEffect('standard_torn'));
  assert.ok(C.c.last('mail')?.letters.some((l) => l.subject.includes('Torn Standard')));
});
