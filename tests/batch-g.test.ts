// docs/16 Batch G — company and groups: the "looking for company" flag with its goal and levels, and asking to join
// with one tap; the sea's goals of the week with one bar and pay for every hand; trade alongside at sea with gear,
// locks and confirmations, atomic and called off when the ships part, fight or a captain goes; the guild's shipyard on
// the admiral's island; the signal flags to the group, rate-limited.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUILD_PROJECT_DEFS, LFG_GOALS, SIGNAL_BURST, SIGNAL_GAP, SIGNAL_WINDOW, TRADE_ITEMS_MAX, TRADE_RANGE, WORLD_GOAL_DEFS, WORLD_GOALS_AT_ONCE,
  guildShipClass, lfgRange, lfgTag, parseLfgTag, signalAllowed, socialPatterns, worldGoalMin, worldGoalReward, worldGoalsFor,
} from '../shared/src/data/social.ts';
import { makeItem, STASH_SIZE } from '../shared/src/data/items.ts';
import type { Item } from '../shared/src/data/items.ts';
import { weekNumber } from '../shared/src/data/renown.ts';
import { Rng } from '../shared/src/rng.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { EN as SOC_EN, RU as SOC_RU } from '../client/src/lang/ui/social.ts';
import type { Game } from '../server/src/game/Game.ts';
import { groupOfAccount } from '../server/src/game/party.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { stepWorldGoals, worldGoalKill, worldGoalSale, worldGoals, worldGoalsView } from '../server/src/game/worldgoals.ts';
import { gyardGive, gyardStart, gyardView } from '../server/src/game/guildyard.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { ownIsland } from '../server/src/game/estate.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { Port } from '../shared/src/world/worldgen.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

function cap(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.level = 20; // past the Green Pennant
  return { c, s };
}

/** At sea, at a spot, in the Gravewater. */
function atSea(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.region = 'gravewater';
  game.grid.upsert(ship.id, x, y);
}

function item(uid: number, extra: Partial<Item> = {}): Item {
  return { ...makeItem(new Rng(uid), uid, { ilvl: 3, rarity: 2 }), ...extra };
}

const toasts = (c: FakeConn) => c.all('toast').map((t) => t.msg).join(' | ');
const errs = (c: FakeConn) => [...c.all('toast').map((t) => t.msg), ...c.all('err').map((t) => t.msg)].join(' | ');

// ================================================================== 31. looking for company

test('a posting carries a goal and a level range, flies over her ship and shows where she is', () => {
  assert.deepEqual(lfgRange(10), [7, 13], 'her own level ±3 by default');
  assert.deepEqual(lfgRange(10, 15, 5), [5, 15], 'turned the right way');
  assert.deepEqual(lfgRange(2, -4, 999), [1, 60], 'within the levels there are');
  assert.deepEqual(parseLfgTag(lfgTag('boss', 4, 9)), { goal: 'boss', lo: 4, hi: 9 });
  assert.equal(parseLfgTag('nonsense:1-2'), null);
  const { game } = makeGame();
  const a = cap(game, 'Lena Flag'), b = cap(game, 'Hugo Flag');
  atSea(game, a.s, 50_000, 50_000);
  atSea(game, b.s, 52_000, 50_000);
  a.c.push({ t: 'group', action: 'lfg', note: 'Kraken  soon', goal: 'boss', lo: 15, hi: 25 });
  const row = b.c.last('party')!.lfg!.find((e) => e.name === 'Lena Flag')!;
  assert.equal(row.goal, 'boss');
  assert.equal(row.lo, 15);
  assert.equal(row.hi, 25);
  assert.equal(row.fits, true, 'Hugo is level 20');
  assert.equal(row.x, 50_000);
  assert.equal(row.size, 1);
  assert.equal(a.c.last('party')!.lfgGoal!.goal, 'boss');
  assert.equal(a.s.ship!.info().lfg, 'boss:15-25', 'the flag over her ship');
  // A strange goal falls back to the hunt.
  a.c.push({ t: 'group', action: 'lfg', note: '', goal: 'dance' as never });
  assert.equal(a.c.last('party')!.lfgGoal!.goal, 'hunt');
  a.c.push({ t: 'group', action: 'lfg_clear' });
  assert.equal(a.s.ship!.info().lfg, undefined, 'lowered');
  assert.equal(b.c.last('party')!.lfg!.length, 0);
  assert.ok(LFG_GOALS.length === 5);
});

test('asking to join: one tap, the levels asked, the leader takes her aboard, the posting stays while there is room', () => {
  const { game } = makeGame();
  const a = cap(game, 'Mira Post'), b = cap(game, 'Tom Ask'), c = cap(game, 'Low Ned');
  c.s.profile!.level = 5;
  for (const x of [a, b, c]) atSea(game, x.s, 50_000, 50_000);
  b.c.push({ t: 'group', action: 'ask', name: 'Mira Post' });
  assert.match(errs(b.c), /not looking for company/);
  a.c.push({ t: 'group', action: 'lfg', note: '', goal: 'hunt', lo: 15, hi: 25 });
  c.c.push({ t: 'group', action: 'ask', name: 'Mira Post' });
  assert.match(errs(c.c), /levels 15–25/, 'out of the range asked');
  b.c.push({ t: 'group', action: 'ask', name: 'Mira Post' });
  b.c.push({ t: 'group', action: 'ask', name: 'Mira Post' });
  assert.match(errs(b.c), /already asked/);
  const inv = a.c.last('party')!.invites.find((i) => i.ask)!;
  assert.equal(inv.from, 'Tom Ask');
  assert.match(toasts(a.c), /Tom Ask \(level 20\) asks to join/);
  a.c.push({ t: 'group', action: 'accept', id: inv.id });
  const g = groupOfAccount(game, a.s.accountId)!;
  assert.deepEqual(g.members, [a.s.accountId, b.s.accountId]);
  assert.equal(g.leader, a.s.accountId, 'the poster leads');
  assert.ok(game.social.lfg.has(a.s.accountId), 'the leader still looks for more hands');
  assert.equal(b.c.last('party')!.lfg!.length, 1);
  // Tom, in the group now, may not post; Mira as the leader may.
  b.c.push({ t: 'group', action: 'lfg', note: 'x', goal: 'trade' });
  assert.match(errs(b.c), /already sail in a group/);
  // A declined ask tells the asker.
  const d = cap(game, 'Dora Ask');
  atSea(game, d.s, 50_000, 50_000);
  d.c.push({ t: 'group', action: 'ask', name: 'Mira Post' });
  a.c.push({ t: 'group', action: 'decline', id: a.c.last('party')!.invites.find((i) => i.ask)!.id });
  assert.match(toasts(d.c), /Mira Post declines/);
  assert.equal(groupOfAccount(game, d.s.accountId), null);
});

// ================================================================== 32. the sea's goals of the week

test('the week’s goals: two, drawn with their own dice from the week, sized about their base; a share is half a percent', () => {
  const ports = ['saint_maw', 'tidewrack', 'port_x'];
  const a = worldGoalsFor(2900, ports), b = worldGoalsFor(2900, ports), c = worldGoalsFor(2901, ports);
  assert.deepEqual(a, b, 'the same week, the same goals');
  assert.notDeepEqual(a, c);
  for (let w = 2800; w < 2900; w++) {
    const list = worldGoalsFor(w, ports);
    assert.equal(list.length, WORLD_GOALS_AT_ONCE);
    assert.notEqual(list[0].kind, list[1].kind);
    for (const g of list) {
      const base = WORLD_GOAL_DEFS[g.kind].base;
      assert.ok(g.target >= base * 0.75 && g.target <= base * 1.25, `${g.kind} ${g.target}`);
      if (g.kind === 'deliver') assert.ok(ports.includes(g.port!));
    }
  }
  assert.equal(worldGoalMin(500), 3);
  assert.equal(worldGoalMin(20_000), 100);
  assert.ok(worldGoalReward(20, 200, 500).silver > worldGoalReward(20, 3, 500).silver, 'a bigger share, more pay');
  // The sea's own stream is not drawn on.
  const g1 = makeGame().game, g2 = makeGame().game;
  stepWorldGoals(g1);
  worldGoals(g1);
  assert.equal(g1.rng.float(), g2.rng.float());
});

test('every hand’s deeds fill one bar; met, each hand with a share is paid, one below is not, one ashore later; the chronicle tells it', () => {
  const { game, db } = makeGame();
  const a = cap(game, 'Ivy Hand'), b = cap(game, 'Oto Hand'), c = cap(game, 'Pim Few');
  const st = worldGoals(game);
  st.week = weekNumber(game.wallNow());
  st.goals = [{ id: 1, kind: 'choir', target: 400, port: null, progress: 0, hands: {}, names: {}, done: false }, { id: 2, kind: 'deliver', target: 20_000, port: game.world.ports[0].id, progress: 0, hands: {}, names: {}, done: false }];
  const choir = { faction: 'choir', npcRole: 'hunter' } as unknown as ShipEntity;
  const merchant = { faction: 'league', npcRole: 'merchant' } as unknown as ShipEntity;
  worldGoalKill(game, c.s, choir, 'sunk'); // one: below the share of two
  worldGoalKill(game, a.s, merchant, 'sunk');
  assert.equal(st.goals[0].progress, 1, 'only the Choir counts');
  for (let i = 0; i < 300; i++) worldGoalKill(game, a.s, choir, 'sunk');
  // Oto goes ashore with his share.
  for (let i = 0; i < 50; i++) worldGoalKill(game, b.s, choir, 'sunk');
  const view = worldGoalsView(game, a.s.accountId)[0];
  assert.equal(view.mine, 300);
  assert.equal(view.min, 2);
  assert.equal(view.hands, 3);
  assert.equal(view.leaders[0].name, 'Ivy Hand');
  b.c.close();
  const goldA = a.s.profile!.gold, goldC = c.s.profile!.gold;
  for (let i = 0; i < 60; i++) worldGoalKill(game, a.s, choir, 'sunk');
  assert.equal(st.goals[0].done, true);
  assert.equal(st.goals[0].progress, 400, 'never past its target');
  assert.ok(a.s.profile!.gold > goldA, 'Ivy is paid');
  assert.equal(c.s.profile!.gold, goldC, 'one ship is below a share');
  assert.ok(st.owed[String(b.s.accountId)]?.silver > 0, 'Oto is owed');
  assert.match(toasts(a.c), /The sea’s goal is met: Sink 400 ships of the Choir this week/);
  const book = db.getKv<{ msg: string }[]>('world_chronicle') ?? [];
  assert.ok(book.some((l) => /The sea’s goal was met: Sink 400 ships of the Choir/.test(l.msg)));
  // Goods sold at the goal's port are delivered; elsewhere they are not.
  worldGoalSale(game, a.s, game.world.ports[1] as Port, 'rum', 500);
  assert.equal(st.goals[1].progress, 0);
  worldGoalSale(game, a.s, game.world.ports[0] as Port, 'rum', 500);
  assert.equal(st.goals[1].progress, 500);
  // The lines read in Russian.
  const table = serverTable();
  for (const d of Object.values(WORLD_GOAL_DEFS)) assert.ok(table[d.text[0].replace('{n}', '{0}').replace('{port}', '{1}')]);
  assert.ok(socialPatterns().length > 10);
});

test('a new week brings new goals and keeps what is owed', () => {
  const { game } = makeGame();
  let clock = Date.UTC(2026, 8, 30, 12);
  game.wallNow = () => clock;
  stepWorldGoals(game);
  const st = worldGoals(game);
  st.owed['77'] = { silver: 5, xp: 5 };
  const w = st.week;
  clock += 7 * 86_400_000;
  stepWorldGoals(game);
  assert.equal(worldGoals(game).week, w + 1);
  assert.equal(worldGoals(game).owed['77'].silver, 5);
  assert.equal(worldGoals(game).goals.every((g) => g.progress === 0), true);
});

// ================================================================== 33. trade alongside at sea

/** Two captains alongside, the table open. */
function table(game: Game, gap = 200): { a: ReturnType<typeof cap>; b: ReturnType<typeof cap> } {
  const a = cap(game, 'Ada Trade'), b = cap(game, 'Ben Trade');
  atSea(game, a.s, 50_000, 50_000);
  atSea(game, b.s, 50_000 + gap, 50_000);
  a.c.push({ t: 'barter', action: 'propose', name: 'Ben Trade' });
  b.c.push({ t: 'barter', action: 'propose', name: 'Ada Trade' });
  return { a, b };
}

test('trade at sea within 300 m and no nearer need: sailing ships may trade, a ship beyond reach may not', () => {
  assert.equal(TRADE_RANGE, 300);
  const { game } = makeGame();
  const a = cap(game, 'Ada Trade'), b = cap(game, 'Ben Trade');
  atSea(game, a.s, 50_000, 50_000);
  atSea(game, b.s, 50_301, 50_000);
  a.c.push({ t: 'barter', action: 'propose', name: 'Ben Trade' });
  assert.match(errs(a.c), /Come within 300 m/);
  b.s.ship!.state.x = 50_300;
  b.s.ship!.state.speed = 6; // under way: no need to heave to
  a.c.push({ t: 'barter', action: 'propose', name: 'Ben Trade' });
  b.c.push({ t: 'barter', action: 'propose', name: 'Ada Trade' });
  const v = a.c.last('barter')!.view!;
  assert.ok(v.atSea);
  assert.equal(v.dist, 300);
  assert.equal(v.range, 300);
});

test('trade: silver, goods and gear; both lock, both confirm the table they saw; it all changes hands at once', () => {
  const { game, db } = makeGame();
  const { a, b } = table(game);
  const A = a.s, B = b.s;
  A.profile!.stash = [item(101), item(102), item(103, { bound: true })];
  A.profile!.itemSeq = 200;
  B.profile!.stash = [];
  B.profile!.itemSeq = 500;
  A.ship!.cargo = { rum: 10 };
  B.ship!.cargo = {};
  const goldA = A.profile!.gold, goldB = B.profile!.gold;
  // Gear that is bound, or not hers, stays off the table; too many pieces are refused.
  a.c.push({ t: 'barter', action: 'offer', gold: 0, cargo: {}, items: [103] });
  assert.match(errs(a.c), /Bound gear/);
  a.c.push({ t: 'barter', action: 'offer', gold: 0, cargo: {}, items: [999] });
  assert.match(errs(a.c), /not in your locker/);
  A.profile!.stash.push(...[1, 2, 3, 4, 5, 6].map((k) => item(300 + k)));
  a.c.push({ t: 'barter', action: 'offer', gold: 0, cargo: {}, items: [101, 102, 301, 302, 303, 304, 305] });
  assert.match(errs(a.c), new RegExp(`${TRADE_ITEMS_MAX} pieces`));
  A.profile!.stash = A.profile!.stash.filter((x) => x.uid < 300);
  a.c.push({ t: 'barter', action: 'offer', gold: 0, cargo: { rum: 4 }, items: [101, 102, 101] });
  b.c.push({ t: 'barter', action: 'offer', gold: 700, cargo: {} });
  const seen = b.c.last('barter')!.view!;
  assert.deepEqual(seen.them.items!.map((x) => x.uid), [101, 102], 'each piece once; Ben sees them');
  // Confirming before both lock is refused.
  a.c.push({ t: 'barter', action: 'ready' });
  assert.match(errs(a.c), /lock their offers first/);
  a.c.push({ t: 'barter', action: 'lock' });
  // A locked offer cannot be changed.
  a.c.push({ t: 'barter', action: 'offer', gold: 1, cargo: {}, items: [] });
  assert.match(errs(a.c), /Unlock your offer/);
  b.c.push({ t: 'barter', action: 'lock' });
  const rev = a.c.last('barter')!.view!.rev!;
  a.c.push({ t: 'barter', action: 'ready', rev });
  assert.equal(a.c.last('barter')!.view!.me.ready, true);
  // Ben unlocks to change his mind: Ada's confirmation is called back, and her old revision is stale.
  b.c.push({ t: 'barter', action: 'unlock' });
  assert.equal(a.c.last('barter')!.view!.me.ready, false);
  b.c.push({ t: 'barter', action: 'offer', gold: 600, cargo: {} });
  b.c.push({ t: 'barter', action: 'lock' });
  a.c.push({ t: 'barter', action: 'ready', rev });
  assert.match(errs(a.c), /table has changed/);
  const rev2 = a.c.last('barter')!.view!.rev!;
  assert.ok(rev2 > rev);
  a.c.push({ t: 'barter', action: 'ready', rev: rev2 });
  b.c.push({ t: 'barter', action: 'ready', rev: rev2 });
  assert.ok(a.c.last('barter')!.view!.transfer > 0, 'the boats are under way');
  assert.equal(B.profile!.stash.length, 0, 'nothing yet');
  steps(game, 20 * 12);
  assert.equal(a.c.last('barter')!.view, null, 'the table is cleared');
  assert.deepEqual(A.profile!.stash.map((x) => x.uid), [103], 'the bound piece stays');
  assert.equal(B.profile!.stash.length, 2);
  assert.deepEqual(B.profile!.stash.map((x) => x.uid), [500, 501], 'new numbers in the new locker');
  assert.equal(A.profile!.gold, goldA + 600);
  assert.equal(B.profile!.gold, goldB - 600);
  assert.equal(A.ship!.cargo.rum, 6);
  assert.equal(B.ship!.cargo.rum, 4);
  assert.match(toasts(b.c), /Into your locker/);
  const flow = db.ledgerFlows(0).find((f) => f.kind === 'barter')!;
  assert.equal(flow.inflow, 600, 'the silver is in the ledger');
  assert.equal(Math.abs(flow.outflow), 600);
});

test('trade is checked again as it changes hands: gear gone, silver spent or a full locker leave everything where it was', () => {
  // Gear gone from the locker after the lock.
  {
    const { game } = makeGame();
    const { a, b } = table(game);
    a.s.profile!.stash = [item(11)];
    b.s.profile!.stash = [];
    b.s.ship!.cargo = { sugar: 5 };
    a.c.push({ t: 'barter', action: 'offer', gold: 0, cargo: {}, items: [11] });
    b.c.push({ t: 'barter', action: 'offer', gold: 0, cargo: { sugar: 5 } });
    a.c.push({ t: 'barter', action: 'lock' });
    b.c.push({ t: 'barter', action: 'lock' });
    a.c.push({ t: 'barter', action: 'ready' });
    b.c.push({ t: 'barter', action: 'ready' });
    a.s.profile!.stash = []; // sold, mailed, broken down — gone
    steps(game, 20 * 12);
    assert.match(toasts(b.c), /Trade called off: Ada Trade no longer has that gear/);
    assert.equal(b.s.ship!.cargo.sugar, 5, 'his goods stay his');
    assert.equal(a.s.ship!.cargo.sugar, undefined);
  }
  // Silver spent after the lock.
  {
    const { game } = makeGame();
    const { a, b } = table(game);
    a.s.profile!.gold = 1000;
    b.s.profile!.stash = [item(21)];
    a.s.profile!.stash = [];
    a.c.push({ t: 'barter', action: 'offer', gold: 1000, cargo: {} });
    b.c.push({ t: 'barter', action: 'offer', gold: 0, cargo: {}, items: [21] });
    a.c.push({ t: 'barter', action: 'lock' });
    b.c.push({ t: 'barter', action: 'lock' });
    a.c.push({ t: 'barter', action: 'ready' });
    b.c.push({ t: 'barter', action: 'ready' });
    a.s.profile!.gold = 10;
    steps(game, 20 * 12);
    assert.match(toasts(a.c), /no longer has the silver/);
    assert.equal(b.s.profile!.stash.length, 1, 'the piece stays with Ben');
    assert.equal(a.s.profile!.stash.length, 0);
  }
  // No room in the locker: the confirmations are called back, nothing moves.
  {
    const { game } = makeGame();
    const { a, b } = table(game);
    a.s.profile!.stash = [item(31)];
    b.s.profile!.stash = Array.from({ length: STASH_SIZE }, (_, k) => item(1000 + k));
    a.c.push({ t: 'barter', action: 'offer', gold: 0, cargo: {}, items: [31] });
    a.c.push({ t: 'barter', action: 'lock' });
    b.c.push({ t: 'barter', action: 'lock' });
    a.c.push({ t: 'barter', action: 'ready' });
    b.c.push({ t: 'barter', action: 'ready' });
    steps(game, 20 * 12);
    assert.match(toasts(a.c), /locker has no room/);
    assert.equal(a.s.profile!.stash.length, 1);
    assert.equal(b.s.profile!.stash.length, STASH_SIZE);
    assert.equal(a.c.last('barter')!.view!.me.ready, false);
  }
  // A captain under the Green Pennant takes no gear from others.
  {
    const { game } = makeGame();
    const { a, b } = table(game);
    b.s.profile!.level = 3;
    b.s.profile!.pvp.played = 0;
    a.s.profile!.stash = [item(41)];
    a.c.push({ t: 'barter', action: 'offer', gold: 0, cargo: {}, items: [41] });
    a.c.push({ t: 'barter', action: 'lock' });
    b.c.push({ t: 'barter', action: 'lock' });
    a.c.push({ t: 'barter', action: 'ready' });
    b.c.push({ t: 'barter', action: 'ready' });
    steps(game, 20 * 12);
    assert.match(toasts(a.c), /Green Pennant/);
    assert.equal(a.s.profile!.stash.length, 1);
  }
});

test('trade is called off when the ships part, a fight starts or a captain goes — with nothing moved', () => {
  const setup = () => {
    const { game } = makeGame();
    const { a, b } = table(game);
    a.s.profile!.stash = [item(51)];
    b.s.ship!.cargo = { tobacco: 7 };
    a.c.push({ t: 'barter', action: 'offer', gold: 0, cargo: {}, items: [51] });
    b.c.push({ t: 'barter', action: 'offer', gold: 0, cargo: { tobacco: 7 } });
    a.c.push({ t: 'barter', action: 'lock' });
    b.c.push({ t: 'barter', action: 'lock' });
    a.c.push({ t: 'barter', action: 'ready' });
    b.c.push({ t: 'barter', action: 'ready' });
    return { game, a, b };
  };
  const untouched = (game: Game, a: ReturnType<typeof cap>, b: ReturnType<typeof cap>) => {
    assert.equal(a.s.profile!.stash.length, 1);
    assert.equal(b.s.ship!.cargo.tobacco, 7);
    assert.equal(a.s.ship!.cargo.tobacco, undefined);
    assert.equal(game.social.barters.size, 0, 'the table is gone');
  };
  {
    const { game, a, b } = setup();
    b.s.ship!.state.x = 50_000 + 400;
    steps(game, 21);
    assert.match(toasts(a.c), /Trade called off/);
    untouched(game, a, b);
  }
  {
    const { game, a, b } = setup();
    a.s.ship!.lastCombat = game.now;
    steps(game, 21);
    assert.match(toasts(b.c), /Trade called off: Not in the middle of a fight/);
    untouched(game, a, b);
  }
  {
    const { game, a, b } = setup();
    b.c.close();
    steps(game, 21);
    assert.match(toasts(a.c), /Trade called off/);
    untouched(game, a, b);
  }
  {
    const { game, a, b } = setup();
    b.s.ship!.docked = game.world.ports[0].id;
    steps(game, 21);
    assert.match(toasts(a.c), /Trade called off/);
    untouched(game, a, b);
  }
});

// ================================================================== 34. the guild's shipyard

function guildWithYard(game: Game): { adm: ReturnType<typeof cap>; mem: ReturnType<typeof cap>; gid: number } {
  const adm = cap(game, 'Admiral Wren'), mem = cap(game, 'Bosun Kay');
  atSea(game, adm.s, 50_000, 50_000);
  runAdmin(game, adm.s, '/gyard found');
  const g = game.guilds.of(game, adm.s.accountId)!;
  g.members.push({ account: mem.s.accountId, name: mem.s.name, rank: 'sailor', joined: 0, out: { day: 0, value: 0 } });
  game.guilds.index(mem.s.accountId, g.id);
  g.yardProject = null; // /gyard found lays down a ship; the tests lay down their own
  return { adm, mem, gid: g.id };
}

test('the guild’s shipyard: the admiral lays a project down at her island; members bring goods lying off it and silver from anywhere', () => {
  const { game } = makeGame();
  const { adm, mem, gid } = guildWithYard(game);
  const g = game.guilds.get(game, gid)!;
  const h = ownIsland(game, adm.s.accountId)!;
  const isl = game.world.islands[h.island];
  assert.match(gyardStart(game, mem.s, 'ship') ?? '', /admiral lays down/);
  assert.equal(gyardStart(game, adm.s, 'ship'), null);
  assert.match(gyardStart(game, adm.s, 'yard') ?? '', /already/);
  // Far from the island: goods may not be brought; silver may.
  atSea(game, mem.s, isl.x + 20_000, isl.y);
  mem.s.ship!.cargo = { timber: 100, rum: 5 };
  assert.match(gyardGive(game, mem.s, 'timber', 50, 0) ?? '', /lie off the admiral’s island/);
  const gold = mem.s.profile!.gold;
  assert.equal(gyardGive(game, mem.s, undefined, 0, 500), null);
  assert.equal(mem.s.profile!.gold, gold - 500);
  // Lying off the island: from the hold, only what the project needs, never past its need.
  atSea(game, mem.s, isl.x + isl.radius + 60, isl.y);
  assert.match(gyardGive(game, mem.s, 'rum', 5, 0) ?? '', /does not need/);
  assert.equal(gyardGive(game, mem.s, 'timber', 80, 0), null);
  assert.equal(mem.s.ship!.cargo.timber, 20);
  const v = gyardView(game, mem.s)!;
  assert.equal(v.near, true);
  assert.equal(v.project!.goods.find((x) => x.good === 'timber')!.have, 80);
  assert.equal(v.project!.silver.have, 500);
  assert.equal(v.project!.hands[0].name, 'Bosun Kay');
  assert.equal(v.project!.hands[0].units, 85, '80 timber and 500 silver');
  assert.ok(v.project!.pct > 0 && v.project!.pct < 0.1);
  // The admiral brings from the island's own yard, wherever she is.
  const y = h.yard!;
  y.res.timber = 1000;
  assert.equal(gyardGive(game, adm.s, 'timber', 1000, 0), null);
  assert.equal(g.yardProject!.goods.timber, GUILD_PROJECT_DEFS.ship.goods.timber, 'never past its need');
  assert.equal(y.res.timber, 1000 - (GUILD_PROJECT_DEFS.ship.goods.timber! - 80));
});

test('a finished guild ship joins the guild fleet in the nearest port; a finished yard project raises the shipyard', () => {
  const { game } = makeGame();
  const { adm, gid } = guildWithYard(game);
  const g = game.guilds.get(game, gid)!;
  const h = ownIsland(game, adm.s.accountId)!;
  const yard = h.buildings.find((b) => b.id === 'shipyard')!;
  const fleet = g.fleet.length;
  assert.equal(gyardStart(game, adm.s, 'ship'), null);
  runAdmin(game, adm.s, '/gyard done');
  assert.equal(g.fleet.length, fleet + 1);
  const ship = g.fleet[g.fleet.length - 1];
  assert.equal(ship.loadout.classId, guildShipClass(yard.level ?? 1));
  assert.ok(game.portById(ship.port), 'she lies in a port');
  assert.equal(g.yardProject, null);
  assert.ok(g.log.some((l) => /launches the/.test(l.text)));
  const before = yard.level ?? 1;
  assert.equal(gyardStart(game, adm.s, 'yard'), null);
  runAdmin(game, adm.s, '/gyard done');
  assert.equal(yard.level, before + 1);
  assert.deepEqual(g.yardDone!.map((d) => d.kind), ['ship', 'yard']);
  assert.equal(guildShipClass(1), 'brigantine');
  assert.equal(guildShipClass(5), 'frigate');
});

// ================================================================== 35. signal flags

test('signal flags: only to one’s group, at her ship, to every mate; at most five in thirty seconds, never two within two', () => {
  assert.equal(signalAllowed([], 0), true);
  assert.equal(signalAllowed([10], 10 + SIGNAL_GAP - 0.1), false);
  assert.equal(signalAllowed([0, 3, 6, 9, 12], 15), false, `${SIGNAL_BURST} in ${SIGNAL_WINDOW} s`);
  assert.equal(signalAllowed([0, 3, 6, 9, 12], 31), true);
  const { game } = makeGame();
  const a = cap(game, 'Sig Anne'), b = cap(game, 'Sig Bram'), c = cap(game, 'Sig Cole');
  for (const x of [a, b, c]) atSea(game, x.s, 60_000, 60_000);
  a.c.push({ t: 'signal', kind: 'help' });
  assert.match(errs(a.c), /no one to signal/);
  a.c.push({ t: 'group', action: 'invite', name: 'Sig Bram' });
  b.c.push({ t: 'group', action: 'accept', id: b.c.last('party')!.invites[0].id });
  a.s.ship!.state.x = 61_234;
  a.c.push({ t: 'signal', kind: 'help' });
  const got = b.c.last('signal')!;
  assert.equal(got.from, 'Sig Anne');
  assert.equal(got.kind, 'help');
  assert.equal(got.x, 61_234);
  assert.ok(a.c.last('signal'), 'the sender sees her own');
  assert.equal(c.c.last('signal'), undefined, 'not to those outside the group');
  a.c.push({ t: 'signal', kind: 'follow' });
  assert.match(errs(a.c), /halyard is still busy/);
  assert.equal(b.c.all('signal').length, 1);
  for (let i = 0; i < 4; i++) {
    game.now += SIGNAL_GAP + 0.5;
    a.c.push({ t: 'signal', kind: 'regroup' });
  }
  game.now += SIGNAL_GAP + 0.5;
  a.c.push({ t: 'signal', kind: 'attack' });
  assert.equal(b.c.all('signal').length, SIGNAL_BURST, 'the sixth within the window is held');
  game.now += SIGNAL_WINDOW;
  a.c.push({ t: 'signal', kind: 'treasure' });
  assert.equal(b.c.all('signal').length, SIGNAL_BURST + 1);
  // In port, no flags.
  a.s.ship!.docked = game.world.ports[0].id;
  game.now += SIGNAL_WINDOW;
  a.c.push({ t: 'signal', kind: 'follow' });
  assert.match(errs(a.c), /open sea/);
  // A mate who ignores her does not see them.
  a.s.ship!.docked = null;
  b.c.push({ t: 'friend', action: 'ignore', name: 'Sig Anne' });
  game.now += SIGNAL_WINDOW;
  a.c.push({ t: 'signal', kind: 'follow' });
  assert.equal(b.c.all('signal').length, SIGNAL_BURST + 1);
});

// ================================================================== words

test('the batch’s words: both dictionaries whole, the admin’s help translated command for command', () => {
  assert.deepEqual(Object.keys(SOC_RU).sort(), Object.keys(SOC_EN).sort());
  const { game } = makeGame();
  join(game, 'Help Me');
  const help = runAdmin(game, game.sessionByName('Help Me')!, '/help')!;
  for (const cmd of ['/lfg', '/near', '/wgoal', '/gyard', '/signal']) assert.ok(help.includes(cmd), cmd);
  const ru = SERVER_RU_ADMIN[help];
  assert.ok(ru, 'the help has its Russian twin');
  const cmds = (s: string) => s.split(' · ').map((x) => x.split(' ')[0]);
  assert.deepEqual(cmds(ru), cmds(help));
});
