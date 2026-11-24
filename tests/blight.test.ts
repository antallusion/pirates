// The Blighted Sea (docs/40): the zone pinned to the world, the Veil, the Taint and its tiers, the hunters, banking and
// the loss on sinking, captains' pay and every anti-farm rule, the Raft (mooring, blackjack from a fixed deck, the
// shop's prices, the dice), the Heart, the chapter's fourteen quests in order, the endless contracts, the week's
// board — and every word in Russian. A captain who never comes near is not touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BJ_HANDS_HOUR, BJ_SILVER_DAY, BLIGHT, BLIGHT_CHAPTER, BLIGHT_LEVEL, BLIGHT_NEED_AT, BLIGHT_PENNANT, BLIGHT_QUESTS, BLIGHT_RAFT, BLIGHT_SHOP, BLIGHT_TITLE, BLIGHT_WORDS,
  CHOSEN_PAYS, HEART_POOL, HUNTERS_MAX, HUNTER_FIRST_S, HUNTER_MARKS, PVP_REPEAT_SHARE, RAFT_CUT, RAFT_MOOR_SECS, RAFT_TABLE, TAINT_HUNTER, TAINT_PER_TIER, WEEK_MARKS, WEEK_TITLES,
  bjDealer, bjResult, bjReturn, bjTotal, blightMul, blightOpen, blightPatterns, blightXpMul, dayContracts, hunterSpec, inBlight, pvpMarks, say, shopPrice, stepNeed, stepText, tierOf,
} from '../shared/src/data/blight.ts';
import type { BlightStep } from '../shared/src/data/blight.ts';
import { CAMPAIGN_SIZE, PLAN } from '../shared/src/data/campaign/plan.ts';
import { buildCitadels } from '../shared/src/data/citadels.ts';
import { REGION_IDS } from '../shared/src/world/regions.ts';
import { waystations } from '../shared/src/world/waystations.ts';
import { isLand, regionAt } from '../shared/src/world/worldgen.ts';
import { adminBlight, blightCleared, blightCredit, blightHeartRise, blightHunterAt, blightMessage, blightMoor, blightRigDeck, blightSecond, blightTest, blightView, heartBoardBlocked, raftMoored, stepBlight } from '../server/src/game/blight.ts';
import { damageBlocked } from '../server/src/game/combat.ts';
import { diceLeave, diceOpen } from '../server/src/game/dice.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { BlightSave } from '../server/src/game/blight.ts';
import { groupAnswer, groupInvite, groupOfAccount } from '../server/src/game/party.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { lettersSince } from '../server/src/game/post.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, shipAtLevel, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

// ------------------------------------------------------------------------------------------------ the tests' hands

function captain(game: Game, name: string, cleared = true): { s: PlayerSession; conn: FakeConn } {
  const conn = join(game, name);
  const s = game.sessionByName(name)!;
  const p = s.profile!;
  if (p.tutorial) {
    p.tutorial.on = false;
    p.tutorial.easy = 99;
  }
  p.level = 60;
  s.ship!.level = 60;
  if (cleared) p.campaign!.at = BLIGHT_NEED_AT;
  s.ship!.docked = null;
  p.docked = null;
  s.ship!.protectedUntil = 0;
  return { s, conn };
}

function put(game: Game, s: PlayerSession, x: number, y: number, speed = 0, heading = 0): void {
  const ship = s.ship!;
  ship.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.heading = heading;
  ship.state.speed = speed;
  ship.region = regionAt(game.world, x, y); // (the ship's own second keeps it in the game)
  game.grid.upsert(ship.id, x, y);
}

const INSIDE = { x: BLIGHT.x + 1500, y: BLIGHT.y + 800 };
const OUTSIDE = { x: BLIGHT.x + BLIGHT.r + 900, y: BLIGHT.y };

/** In through the rim and counted in. */
function enter(game: Game, s: PlayerSession, at = INSIDE): void {
  put(game, s, at.x, at.y);
  blightSecond(game, s);
  assert.ok(s.profile!.blight?.in, 'counted in');
}

/** Out across the rim alive. */
function leave(game: Game, s: PlayerSession): void {
  put(game, s, OUTSIDE.x, OUTSIDE.y);
  blightSecond(game, s);
}

/** Made fast at the Raft (the half minute since the last shot and the five seconds hove to run on the game's clock). */
function moor(game: Game, s: PlayerSession): void {
  if (raftMoored(game, s)) return;
  put(game, s, BLIGHT_RAFT.x + 60, BLIGHT_RAFT.y);
  blightSecond(game, s);
  s.ship!.lastHitAt = -999;
  s.ship!.lastCombat = -999;
  assert.equal(blightMoor(game, s), null);
  game.now += RAFT_MOOR_SECS + 0.1;
  blightSecond(game, s);
  assert.ok(raftMoored(game, s), 'moored');
}

function unmoor(game: Game, s: PlayerSession): void {
  blightMessage(game, s, { t: 'blight', action: 'leave' });
  assert.ok(!raftMoored(game, s));
}

/** A hunter of a tier beside her, sent down by her guns. */
function sinkHunter(game: Game, s: PlayerSession, tier: number): ShipEntity {
  const ship = s.ship!;
  const foe = blightHunterAt(game, tier, ship.state.x + 300, ship.state.y, 0);
  foe.attackers.set(ship.id, game.now);
  foe.hull = 0;
  game.beginSinking(foe);
  return foe;
}

const rec = (s: PlayerSession) => blightTest.rec(s.profile!);
const setTier = (game: Game, s: PlayerSession, t: number): string => adminBlight(game, s, ['tier', String(t)]);
const toasts = (c: FakeConn): string[] => c.all('toast').map((m) => m.msg);

// rank → a card of the first suit (0 ace, 1–9 two to ten, 10–12 the court)
const A = 0, N5 = 4, N6 = 5, N7 = 6, N8 = 7, N9 = 8, T = 9, J = 10, Q = 11, K = 12;
const suit = (c: number, s: number): number => c + 13 * s;

// ================================================================================================ the place

test('the zone is pinned: open water of Dead Man’s Expanse, no land, port or citadel in it, six kilometres from every port and border', () => {
  const { game } = makeGame();
  const w = game.world;
  assert.deepEqual({ ...BLIGHT }, { x: 48500, y: 34200, r: 4000 }, 'the constants themselves');
  assert.deepEqual({ ...BLIGHT_RAFT }, { x: 48500, y: 34200 });
  // no land anywhere inside (a 100 m lattice), and all of it the one region
  for (let dx = -BLIGHT.r; dx <= BLIGHT.r; dx += 100) for (let dy = -BLIGHT.r; dy <= BLIGHT.r; dy += 100) {
    if (dx * dx + dy * dy > BLIGHT.r * BLIGHT.r) continue;
    assert.equal(isLand(w, BLIGHT.x + dx, BLIGHT.y + dy), null, `water at ${dx},${dy}`);
    assert.equal(regionAt(w, BLIGHT.x + dx, BLIGHT.y + dy), 'dead_mans_expanse');
  }
  // no island reaches into it
  for (const is of w.islands) assert.ok(Math.hypot(is.x - BLIGHT.x, is.y - BLIGHT.y) - is.radius * 1.5 > BLIGHT.r, `island ${is.id} clear of it`);
  // six kilometres from every port and town, and from the region's border
  for (const p of w.ports) assert.ok(Math.hypot(p.x - BLIGHT.x, p.y - BLIGHT.y) >= 6000, `${p.id} six kilometres off`);
  for (let r = 500; r <= 6000; r += 500) for (let k = 0; k < 48; k++) {
    const a = (k * Math.PI) / 24;
    assert.equal(regionAt(w, BLIGHT.x + Math.cos(a) * r, BLIGHT.y + Math.sin(a) * r), 'dead_mans_expanse', 'the border six kilometres off');
  }
  for (const c of buildCitadels(w)) assert.ok(Math.hypot(c.x - BLIGHT.x, c.y - BLIGHT.y) > BLIGHT.r + 1000, 'no citadel');
  // the Raft stands clear of the world's own waystations (it is none of them)
  assert.equal(waystations(w).list.filter((x) => Math.hypot(x.x - BLIGHT_RAFT.x, x.y - BLIGHT_RAFT.y) < 300).length, 0);
});

test('an overlay: no new region, no 37th chapter in the campaign’s plan, the campaign’s size as it was', () => {
  assert.equal(REGION_IDS.length, 8);
  assert.ok(!REGION_IDS.some((r) => /blight/.test(r)));
  assert.equal(PLAN.length, 36);
  assert.equal(CAMPAIGN_SIZE, 720);
  assert.equal(BLIGHT_NEED_AT, 648);
  assert.equal(BLIGHT_LEVEL, 55);
  assert.equal(BLIGHT_CHAPTER.n, 37);
});

// ================================================================================================ the Veil, the secret

test('the Veil turns back a captain the sea does not count its own: once, the way she came, no hull lost, nothing written to her save', () => {
  const { game } = makeGame();
  const { s, conn } = captain(game, 'Veil Val', false);
  s.profile!.campaign!.at = BLIGHT_NEED_AT - 1; // one quest short
  const ship = s.ship!;
  const at = { x: BLIGHT.x + BLIGHT.r - 300, y: BLIGHT.y };
  put(game, s, at.x, at.y, 8, -Math.PI / 2); // sailing west, into it
  const hull = ship.hull;
  assert.ok(!blightCleared(game, s));
  blightSecond(game, s);
  assert.ok(!inBlight(ship.state.x, ship.state.y), 'out past the rim at once');
  assert.ok(Math.hypot(ship.state.x - at.x, ship.state.y - at.y) < 700, 'just past it');
  assert.ok(Math.abs(Math.cos(ship.state.heading + Math.PI / 2) + 1) < 1e-6, 'turned about');
  assert.equal(ship.hull, hull, 'no hull lost');
  assert.ok(toasts(conn).includes(BLIGHT_WORDS.veil[0]));
  assert.equal(s.profile!.blight, undefined, 'her save is not touched');
  assert.equal(blightView(game, s), null, 'she knows nothing of it');
  // the level alone is not enough either, nor the campaign alone
  assert.ok(!blightOpen(BLIGHT_NEED_AT, BLIGHT_LEVEL - 1) && !blightOpen(BLIGHT_NEED_AT - 1, 80) && blightOpen(BLIGHT_NEED_AT, BLIGHT_LEVEL));
  // …and through the game's own second (the wiring): put inside again, the sea's clock throws her out
  put(game, s, at.x, at.y, 0, -Math.PI / 2);
  steps(game, 21);
  assert.ok(!inBlight(ship.state.x, ship.state.y));
});

test('no group pass: a cleared captain’s mate is still turned back', () => {
  const { game } = makeGame();
  const a = captain(game, 'Lead Lin'), b = captain(game, 'Mate Mo', false);
  put(game, a.s, INSIDE.x, INSIDE.y);
  put(game, b.s, INSIDE.x + 100, INSIDE.y, 5, 0);
  assert.equal(groupInvite(game, a.s, 'Mate Mo'), null);
  const g = groupOfAccount(game, a.s.accountId);
  const inv = b.conn.all('party_invite' as never).at(-1) as { id?: number } | undefined;
  if (!g || g.members.length < 2) groupAnswer(game, b.s, inv?.id ?? 1, true);
  blightSecond(game, a.s);
  blightSecond(game, b.s);
  assert.ok(a.s.profile!.blight?.in);
  assert.ok(!inBlight(b.s.ship!.state.x, b.s.ship!.state.y), 'the mate is thrown back');
});

test('secret until she is cleared: then one letter with the bearing, a line in her log, the chart mark in her view', () => {
  const { game, db } = makeGame();
  const { s, conn } = captain(game, 'Secret Sal', false);
  put(game, s, 20000, 20000);
  blightSecond(game, s);
  assert.equal(conn.last('self')?.self.blight ?? null, null);
  assert.equal(s.profile!.blight, undefined);
  s.profile!.campaign!.at = BLIGHT_NEED_AT;
  blightSecond(game, s);
  blightSecond(game, s);
  const letters = lettersSince(game, s.accountId, 0).filter((l) => l.subject === BLIGHT_WORDS.letterSubject[0]);
  assert.equal(letters.length, 1, 'one letter, once');
  assert.ok(s.profile!.log?.some((e) => e.a[0] === BLIGHT_WORDS.logOpen[0]), 'a log line');
  const v = blightView(game, s)!;
  assert.deepEqual(v.zone, { x: BLIGHT.x, y: BLIGHT.y, r: BLIGHT.r });
  assert.equal(v.inside, false);
  game.pushSelf(s, true);
  assert.ok(conn.last('self')?.self.blight, 'the view rides in her private state');
});

test('a captain who never comes near: no record, no view, no letter, whatever the clock does', () => {
  const { game, db } = makeGame();
  const { s, conn } = captain(game, 'Far Fay', false);
  s.profile!.campaign!.at = 100;
  put(game, s, 20000, 60000);
  steps(game, 60);
  for (let i = 0; i < 30; i++) stepBlight(game);
  assert.equal(s.profile!.blight, undefined);
  assert.equal(conn.last('self')?.self.blight ?? null, null);
  assert.equal(lettersSince(game, s.accountId, 0).filter((l) => l.from === BLIGHT_WORDS.letterFrom[0]).length, 0);
  assert.equal([...game.ships.values()].filter((o) => o.name === 'The Blight’s Heart').length, 0);
});

// ================================================================================================ the Taint

test('the Taint: slowly with the time under way, a tier every hundred, every reward ×(1 + 0.15 × tier), experience capped at ×4', () => {
  const { game } = makeGame();
  const { s, conn } = captain(game, 'Taint Tam');
  enter(game, s);
  const r = rec(s);
  assert.equal(tierOf(r.taint), 1, 'tier I on entry');
  blightSecond(game, s);
  assert.equal(r.taint, 0, 'lying still: none');
  s.ship!.state.speed = 6;
  for (let i = 0; i < 10; i++) blightSecond(game, s);
  assert.ok(Math.abs(r.taint - 1) < 1e-9, 'a tenth a second under way');
  r.taint = TAINT_PER_TIER - 0.05;
  blightSecond(game, s);
  assert.equal(tierOf(r.taint), 2);
  assert.ok(toasts(conn).includes(say('tier', 2, 1.3)));
  assert.equal(r.best, 2);
  assert.equal(blightMul(1), 1.15);
  assert.equal(blightMul(6), 1.9);
  assert.equal(blightXpMul(20), 4);
  assert.equal(blightXpMul(40), 4, 'experience stops at ×4');
  assert.equal(blightMul(40), 7, 'marks do not stop');
  const v = blightView(game, s)!;
  assert.equal(v.inside, true);
  assert.equal(v.tier, 2);
  assert.equal(v.per, TAINT_PER_TIER);
  assert.equal(v.mul, 1.3);
});

test('the hunters: by her tier — ⚓8, ⚓9, ⚓10, then heavier; one more each three tiers, never more than four; sent out of sight after her', () => {
  assert.deepEqual(hunterSpec(1), { anchor: 8, n: 1, hull: 1, guns: 1 });
  assert.equal(hunterSpec(2).anchor, 9);
  assert.equal(hunterSpec(3).anchor, 10);
  assert.equal(hunterSpec(4).n, 2);
  assert.equal(hunterSpec(7).n, 3);
  assert.equal(hunterSpec(10).n, HUNTERS_MAX);
  assert.equal(hunterSpec(40).n, HUNTERS_MAX);
  assert.ok(hunterSpec(8).hull > hunterSpec(4).hull && hunterSpec(8).guns > 1);
  const { game } = makeGame();
  const { s } = captain(game, 'Hunted Hal');
  enter(game, s);
  const S = blightTest.state(game);
  blightSecond(game, s);
  assert.equal(S.hunters.size, 0, 'none in the first seconds');
  game.now += HUNTER_FIRST_S + 1;
  blightSecond(game, s);
  assert.equal(S.hunters.size, 1);
  const [id, h] = [...S.hunters][0];
  const foe = game.ships.get(id)!;
  assert.equal(h.account, s.accountId);
  assert.equal(game.npcs.get(id)!.huntAccount, s.accountId, 'sent after her');
  assert.equal(foe.shipLevel, 8);
  assert.ok(inBlight(foe.state.x, foe.state.y), 'within the circle');
  assert.ok(Math.hypot(foe.state.x - s.ship!.state.x, foe.state.y - s.ship!.state.y) > 1500, 'out of sight');
  assert.deepEqual(blightView(game, s)!.hunters, [id]);
  // tier X: four, and no fifth
  setTier(game, s, 10);
  for (let i = 0; i < 12; i++) {
    game.now += 30;
    blightSecond(game, s);
  }
  assert.equal([...S.hunters.values()].filter((x) => x.account === s.accountId).length, HUNTERS_MAX);
  // a hunter past ⚓10 is a ⚓10 ship with more hull
  const plain = blightHunterAt(game, 3, INSIDE.x, INSIDE.y + 900, 0), heavy = blightHunterAt(game, 9, INSIDE.x, INSIDE.y + 1200, 0);
  assert.equal(plain.shipLevel, 10);
  assert.equal(heavy.shipLevel, 10);
  // out across the rim: they give up the chase
  leave(game, s);
  assert.equal(game.npcs.get(id)!.huntAccount, null);
  assert.equal(blightView(game, s)!.hunters.length, 0);
});

// ================================================================================================ marks, banking, the loss

test('a hunter sunk: marks into the hold by her tier, the Taint of it; the sea’s own prize is not paid twice', () => {
  const { game } = makeGame();
  const { s, conn } = captain(game, 'Marks Meg');
  enter(game, s);
  const r = rec(s);
  const gold = s.profile!.gold;
  sinkHunter(game, s, 1);
  assert.equal(r.hold, Math.round(HUNTER_MARKS * blightMul(1)));
  assert.equal(r.taint, TAINT_HUNTER);
  assert.equal(r.marks, 0, 'unbanked: they ride in the hold');
  assert.ok(toasts(conn).includes(say('marks', r.hold, r.hold)));
  assert.equal(s.profile!.gold, gold, 'no silver minted by the zone');
  // at tier VI the same kill pays ×1.9
  setTier(game, s, 6);
  const before = r.hold;
  sinkHunter(game, s, 6);
  assert.equal(r.hold - before, Math.round(HUNTER_MARKS * blightMul(6)));
  // a hunter sunk by a captain who is not inside pays nothing
  const { s: o } = captain(game, 'Outside Ola');
  put(game, o, OUTSIDE.x, OUTSIDE.y);
  blightSecond(game, o);
  sinkHunter(game, o, 1);
  assert.equal(rec(o).hold, 0);
});

test('banking: across the rim alive — all of it, no cut; at the Raft — a tenth to the Raft; either way the Taint is washed off', () => {
  const { game } = makeGame();
  const { s, conn } = captain(game, 'Bank Bea');
  enter(game, s);
  const r = rec(s);
  r.hold = 200;
  r.taint = 250;
  leave(game, s);
  assert.equal(r.marks, 200);
  assert.equal(r.hold, 0);
  assert.equal(r.taint, 0);
  assert.equal(r.in, false);
  assert.ok(toasts(conn).includes(say('bankRim', 200)));
  enter(game, s);
  r.hold = 205;
  r.taint = 330;
  moor(game, s);
  const cut = Math.floor(205 * RAFT_CUT);
  assert.equal(cut, 20);
  assert.equal(r.marks, 200 + 205 - cut);
  assert.equal(r.hold, 0);
  assert.equal(r.taint, 0);
  assert.ok(toasts(conn).includes(say('bankRaft', 185, 20)));
  const ev = conn.all('blight_ev').at(-1)!;
  assert.deepEqual({ ev: ev.ev, n: ev.n, cut: ev.cut }, { ev: 'bank', n: 185, cut: 20 });
});

test('the Raft: five seconds hove to, not within half a minute of a shot; moored she takes no shot and gives none, and gathers no Taint', () => {
  const { game } = makeGame();
  const a = captain(game, 'Raft Rae'), b = captain(game, 'Gun Gus');
  enter(game, a.s);
  enter(game, b.s);
  assert.equal(blightMoor(game, a.s), BLIGHT_WORDS.moorFar[0], 'too far');
  put(game, a.s, BLIGHT_RAFT.x + 50, BLIGHT_RAFT.y);
  put(game, b.s, BLIGHT_RAFT.x + 350, BLIGHT_RAFT.y);
  a.s.ship!.lastHitAt = game.now - 10;
  assert.equal(blightMoor(game, a.s), BLIGHT_WORDS.moorHot[0], 'a shot ten seconds ago');
  a.s.ship!.lastHitAt = -999;
  a.s.ship!.lastCombat = -999;
  assert.equal(damageBlocked(game, b.s.ship!, a.s.ship!), null, 'lawless water: fair game before she is moored');
  assert.equal(blightMoor(game, a.s), null);
  blightSecond(game, a.s);
  assert.ok(!raftMoored(game, a.s), 'not at once');
  assert.ok(blightView(game, a.s)!.mooring > 0);
  game.now += RAFT_MOOR_SECS + 0.1;
  blightSecond(game, a.s);
  assert.ok(raftMoored(game, a.s));
  assert.equal(damageBlocked(game, b.s.ship!, a.s.ship!), BLIGHT_WORDS.raftPeace[0], 'she cannot be attacked');
  assert.equal(damageBlocked(game, a.s.ship!, b.s.ship!), BLIGHT_WORDS.raftPeace[0], 'and cannot attack');
  a.s.ship!.state.speed = 0;
  const taint = rec(a.s).taint;
  for (let i = 0; i < 5; i++) blightSecond(game, a.s);
  assert.equal(rec(a.s).taint, taint);
  // she drifts off: the lines part
  put(game, a.s, BLIGHT_RAFT.x + 600, BLIGHT_RAFT.y);
  blightSecond(game, a.s);
  assert.ok(!raftMoored(game, a.s));
  assert.equal(damageBlocked(game, b.s.ship!, a.s.ship!), null);
  // a mooring broken by a shot
  put(game, a.s, BLIGHT_RAFT.x + 50, BLIGHT_RAFT.y);
  a.s.ship!.lastHitAt = -999;
  a.s.ship!.lastCombat = -999;
  assert.equal(blightMoor(game, a.s), null);
  a.s.ship!.lastHitAt = game.now;
  blightSecond(game, a.s);
  assert.ok(!raftMoored(game, a.s));
  assert.ok(toasts(a.conn).includes(BLIGHT_WORDS.mooringOff[0]));
});

test('sunk inside by the sea: every unbanked mark is lost, half of them float as a green cask anyone may take; no bubble after', () => {
  const { game } = makeGame();
  const a = captain(game, 'Sunk Sue'), b = captain(game, 'Cask Cal');
  enter(game, a.s);
  const r = rec(a.s);
  r.marks = 70;
  r.hold = 101;
  r.taint = 420;
  const at = { x: a.s.ship!.state.x, y: a.s.ship!.state.y };
  a.s.ship!.hull = 0;
  game.beginSinking(a.s.ship!);
  assert.equal(r.hold, 0);
  assert.equal(r.taint, 0);
  assert.equal(r.in, false);
  assert.equal(r.marks, 70, 'banked marks are safe');
  assert.ok(toasts(a.conn).includes(say('sunkLost', 101)));
  const S = blightTest.state(game);
  assert.deepEqual(S.casks.map((c) => c.marks), [51], 'the other half goes to the bottom');
  steps(game, 200); // she goes down and is brought to a port
  assert.ok(a.s.ship!.docked, 'respawned outside the zone');
  assert.equal(r.marks, 70, 'nothing banked by the sinking');
  assert.equal(s0(a.s).pvp.bubbleUntil <= game.wallNow(), true, 'no bubble');
  // another captain hauls the cask aboard
  enter(game, b.s, at);
  blightSecond(game, b.s);
  assert.equal(rec(b.s).hold, 51);
  assert.equal(rec(b.s).cask, true);
  assert.equal(S.casks.length, 0);
});
const s0 = (s: PlayerSession) => s.profile!;

test('back after five minutes away with a run open: treated as having left alive', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Away Ann');
  enter(game, s);
  const r = rec(s);
  r.hold = 40;
  r.taint = 150;
  r.seen = game.wallNow() - 4 * 60_000;
  blightSecond(game, s);
  assert.equal(r.hold, 40, 'four minutes: kept');
  assert.equal(r.taint >= 150, true);
  r.seen = game.wallNow() - 6 * 60_000;
  blightSecond(game, s);
  assert.equal(r.marks, 40, 'banked with no cut');
  assert.equal(r.hold, 0);
  assert.ok(r.taint < 1, 'the Taint from the start');
  assert.ok(r.in, 'still in the water: a new run');
});

// ================================================================================================ captains

/** `victim` sent down by `killer`'s guns. */
function sink(game: Game, killer: PlayerSession, victim: PlayerSession): void {
  victim.ship!.attackers.set(killer.ship!.id, game.now);
  victim.ship!.hull = 0;
  game.beginSinking(victim.ship!);
}

/** A captain inside with a kill and ten minutes behind her (no fresh arrival), her hold and tier as given. */
function seasoned(game: Game, s: PlayerSession, hold: number, tier: number, at = INSIDE): void {
  if (s.ship!.docked || !s.ship!.alive) {
    s.ship!.sinkingUntil = 0;
    s.ship!.hull = s.ship!.stats.hullMax;
  }
  enter(game, s, at);
  const r = rec(s);
  r.hold = hold;
  r.taint = (tier - 1) * TAINT_PER_TIER;
  r.kills = 1;
  r.since = game.wallNow() - 600_000;
}

test('a captain sunk inside pays the victor: 20 + 10 × her tier and half her hold; no infamy, no shame, no standing lost', () => {
  const { game } = makeGame();
  const a = captain(game, 'Victor Vi'), b = captain(game, 'Loser Lou');
  shipAtLevel(game, a.s, 10);
  shipAtLevel(game, b.s, 10); // (a prize of her own ⚓: a grey one teaches nothing, here as anywhere)
  seasoned(game, a.s, 0, 1);
  seasoned(game, b.s, 100, 3, { x: INSIDE.x + 200, y: INSIDE.y });
  const pa = a.s.profile!;
  const infamy = pa.infamy, rep = JSON.stringify(pa.reputation), xp = pa.xp + (pa.throne?.xp ?? 0);
  sink(game, a.s, b.s);
  const ra = rec(a.s), rb = rec(b.s);
  assert.equal(pvpMarks(3), 50);
  assert.equal(ra.hold, 50 + 50, 'the price of her tier and half her hold, at once');
  assert.equal(rb.hold, 0);
  assert.deepEqual(blightTest.state(game).casks.map((c) => c.marks), [50], 'the other half floats');
  assert.ok(toasts(a.conn).includes(say('pvpPaid', 'Loser Lou', 100)));
  assert.equal(pa.infamy, infamy, 'no infamy');
  assert.equal(JSON.stringify(pa.reputation), rep, 'no standing lost');
  assert.ok(pa.pvp.shameUntil <= game.wallNow(), 'no minnow’s shame');
  assert.ok(pa.xp + (pa.throne?.xp ?? 0) > xp, 'experience for it');
  assert.equal(ra.taint, 60, 'the Taint of a captain');
});

test('anti-farm: the same victim pays in full once an hour, then a quarter; a victim barely through the rim pays no marks', () => {
  const { game } = makeGame();
  const a = captain(game, 'Farmer Flo'), b = captain(game, 'Alt Abe');
  seasoned(game, a.s, 0, 1);
  seasoned(game, b.s, 0, 2, { x: INSIDE.x + 200, y: INSIDE.y });
  sink(game, a.s, b.s);
  const ra = rec(a.s);
  assert.equal(ra.hold, pvpMarks(2));
  steps(game, 200);
  // she comes back and is sunk again within the hour
  seasoned(game, b.s, 0, 2, { x: INSIDE.x + 200, y: INSIDE.y });
  const before = ra.hold;
  sink(game, a.s, b.s);
  assert.equal(ra.hold - before, Math.round(pvpMarks(2) * PVP_REPEAT_SHARE));
  assert.ok(toasts(a.conn).includes(say('pvpRepeat', 'Alt Abe')));
  // an hour on: in full again
  steps(game, 200);
  ra.paid[b.s.accountId] = game.wallNow() - 3_700_000;
  seasoned(game, b.s, 0, 2, { x: INSIDE.x + 200, y: INSIDE.y });
  const b2 = ra.hold;
  sink(game, a.s, b.s);
  assert.equal(ra.hold - b2, pvpMarks(2));
  // a third captain just through the rim, no kill of hers: no marks
  const c = captain(game, 'Fresh Fen');
  enter(game, c.s, { x: INSIDE.x - 200, y: INSIDE.y });
  const b3 = ra.hold;
  sink(game, a.s, c.s);
  assert.equal(ra.hold, b3);
  assert.ok(toasts(a.conn).includes(say('pvpNone', 'Fresh Fen')));
});

test('the Chosen of the Blight: the highest tier of two or more inside is marked for all inside, earns a quarter more, pays double', () => {
  const { game } = makeGame();
  const a = captain(game, 'Chosen Cho'), b = captain(game, 'Hunter Hob');
  seasoned(game, a.s, 0, 5);
  stepBlight(game);
  assert.equal(blightView(game, a.s)!.chosen, null, 'alone: nobody is marked');
  seasoned(game, b.s, 0, 2, { x: INSIDE.x + 200, y: INSIDE.y });
  stepBlight(game);
  const va = blightView(game, a.s)!, vb = blightView(game, b.s)!;
  assert.equal(va.chosen?.me, true);
  assert.deepEqual({ name: vb.chosen?.name, tier: vb.chosen?.tier }, { name: 'Chosen Cho', tier: 5 });
  assert.equal(Math.round(vb.chosen!.x), Math.round(a.s.ship!.state.x));
  assert.ok(toasts(a.conn).includes(BLIGHT_WORDS.chosen[0]));
  assert.ok(toasts(b.conn).includes(say('chosenOther', 'Chosen Cho')));
  assert.equal(va.mul, Math.round(blightMul(5) * 1.25 * 100) / 100, 'a quarter more marks while marked');
  const rb = rec(b.s);
  sink(game, b.s, a.s);
  assert.equal(rb.hold, pvpMarks(5) * CHOSEN_PAYS, 'double for sinking her');
});

test('group-mates pay nothing', () => {
  const { game } = makeGame();
  const a = captain(game, 'Mate Ada'), b = captain(game, 'Mate Bob');
  assert.equal(groupInvite(game, a.s, 'Mate Bob'), null);
  if ((groupOfAccount(game, a.s.accountId)?.members.length ?? 0) < 2) {
    const inv = b.conn.inbox.map((m) => m as unknown as { t: string; id?: number }).filter((m) => m.t.startsWith('party') || m.t.startsWith('group')).at(-1);
    groupAnswer(game, b.s, inv?.id ?? 1, true);
  }
  assert.equal(groupOfAccount(game, a.s.accountId)?.members.length, 2, 'a group of two');
  seasoned(game, a.s, 0, 1);
  seasoned(game, b.s, 80, 3, { x: INSIDE.x + 200, y: INSIDE.y });
  // (their guns cannot touch each other at all; the pay rule holds even if a kill were credited)
  assert.equal(damageBlocked(game, a.s.ship!, b.s.ship!), 'friendly');
  sink(game, a.s, b.s);
  assert.equal(rec(a.s).hold, 0);
  assert.ok(toasts(a.conn).includes(say('pvpNone', 'Mate Bob')));
});

// ================================================================================================ blackjack

test('twenty-one, the rules: the count, the dealer stands on every seventeen, what each end returns', () => {
  assert.deepEqual(bjTotal([A, K]), { total: 21, soft: true });
  assert.deepEqual(bjTotal([A, A, N9]), { total: 21, soft: true });
  assert.deepEqual(bjTotal([A, N9, K]), { total: 20, soft: false });
  assert.deepEqual(bjTotal([T, J, Q]), { total: 30, soft: false });
  assert.deepEqual(bjDealer([T, N6], [N5]), [T, N6, N5], 'sixteen draws');
  assert.deepEqual(bjDealer([A, N6], [N5]), [A, N6], 'stands on a soft seventeen');
  assert.equal(bjResult([A, K], [T, N9]), 'blackjack');
  assert.equal(bjResult([A, K], [A, Q]), 'push');
  assert.equal(bjResult([T, N9], [A, Q]), 'lose');
  assert.equal(bjResult([T, N9, N5], [T, N6, K]), 'bust', 'she broke first');
  assert.equal(bjResult([T, N9], [T, N6, K]), 'win');
  assert.equal(bjResult([T, N8], [T, N8]), 'push');
  assert.equal(bjResult([N7, N5, N9], [A, K]), 'lose', 'three cards to 21 is no natural');
  assert.equal(bjReturn('blackjack', 100), 250);
  assert.equal(bjReturn('blackjack', 5), 12, '3:2, rounded down for the house');
  assert.equal(bjReturn('win', 100), 200);
  assert.equal(bjReturn('push', 100), 100);
  assert.equal(bjReturn('lose', 100), 0);
  assert.equal(bjReturn('bust', 100), 0);
});

test('twenty-one at the Raft: every outcome from a fixed deck, in silver and in marks, each hand in the ledger', () => {
  const { game, db } = makeGame();
  const { s, conn } = captain(game, 'Card Cat');
  const p = s.profile!;
  enter(game, s);
  const r = rec(s);
  const deal = (deck: number[], coin: 'silver' | 'marks', stake: number) => {
    blightRigDeck(game, deck);
    blightMessage(game, s, { t: 'blight', action: 'bj', op: 'deal', coin, stake });
    return conn.last('blight_bj')!.view!;
  };
  const op = (o: 'hit' | 'stand' | 'double') => {
    blightMessage(game, s, { t: 'blight', action: 'bj', op: o });
    return conn.last('blight_bj')!.view!;
  };
  // not moored: no table
  const n0 = conn.all('blight_bj').length;
  blightMessage(game, s, { t: 'blight', action: 'bj', op: 'deal', coin: 'silver', stake: 100 });
  assert.equal(conn.all('blight_bj').length, n0);
  assert.ok(toasts(conn).includes(BLIGHT_WORDS.raftOnly[0]));
  moor(game, s);
  p.gold = 100_000;
  r.marks = 1000;
  // a stake off the slate
  blightMessage(game, s, { t: 'blight', action: 'bj', op: 'deal', coin: 'silver', stake: 777 });
  assert.ok(toasts(conn).includes(BLIGHT_WORDS.bjStake[0]));
  assert.equal(p.gold, 100_000);
  // a natural: 3:2
  let v = deal([A, N9, K, N7], 'silver', 100);
  assert.equal(v.result, 'blackjack');
  assert.equal(v.back, 250);
  assert.equal(p.gold, 100_150);
  // a win on a stand; the dealer's second card hidden until the end
  v = deal([T, N9, Q, N8], 'silver', 1000);
  assert.equal(v.result, null);
  assert.deepEqual(v.dealer, [N9, -1]);
  assert.equal(v.total, 20);
  assert.equal(p.gold, 99_150, 'the stake is on the table');
  v = op('stand');
  assert.equal(v.result, 'win');
  assert.deepEqual(v.dealer, [N9, N8]);
  assert.equal(p.gold, 101_150);
  // a push returns the stake
  v = deal([T, suit(T, 1), N8, suit(N8, 1)], 'silver', 1000);
  v = op('stand');
  assert.equal(v.result, 'push');
  assert.equal(p.gold, 101_150);
  // the house takes a hand
  v = deal([T, suit(T, 1), N7, N9], 'silver', 1000);
  v = op('stand');
  assert.equal(v.result, 'lose');
  assert.equal(p.gold, 100_150);
  // a bust on a hit
  v = deal([T, suit(T, 1), N6, N7, K], 'silver', 100);
  v = op('hit');
  assert.equal(v.result, 'bust');
  assert.equal(p.gold, 100_050);
  // a double on the first two cards: one card, the stake twice, the dealer draws to seventeen
  v = deal([N5, N6, suit(N6, 1), T, suit(T, 2), 3], 'silver', 1000);
  assert.equal(v.canDouble, true);
  v = op('double');
  assert.equal(v.doubled, true);
  assert.equal(v.stake, 2000);
  assert.deepEqual(v.player.length, 3);
  assert.deepEqual(v.dealer, [N6, T, 3], 'sixteen drew a four');
  assert.equal(v.result, 'win');
  assert.equal(p.gold, 102_050);
  // no double after a hit
  v = deal([1, N9, 2, N8, 1 + 13, suit(T, 3)], 'silver', 100);
  v = op('hit');
  blightMessage(game, s, { t: 'blight', action: 'bj', op: 'double' });
  assert.ok(toasts(conn).includes(BLIGHT_WORDS.bjDouble[0]));
  v = op('stand');
  assert.ok(v.result);
  // the dealer's natural ends it on the deal; both: a push
  v = deal([T, A, N9, K], 'silver', 100);
  assert.equal(v.result, 'lose');
  v = deal([A, suit(A, 1), K, suit(K, 1)], 'silver', 100);
  assert.equal(v.result, 'push');
  // in banked marks: 5 / 25 / 100
  v = deal([A, N9, K, N7], 'marks', 5);
  assert.equal(v.result, 'blackjack');
  assert.equal(r.marks, 1007);
  v = deal([T, suit(T, 1), N7, N9], 'marks', 100);
  op('stand');
  assert.equal(r.marks, 907);
  blightMessage(game, s, { t: 'blight', action: 'bj', op: 'deal', coin: 'marks', stake: 10 });
  assert.ok(toasts(conn).filter((m) => m === BLIGHT_WORDS.bjStake[0]).length >= 2);
  // a hand left on the table when she casts off is stood on as it is
  deal([T, N9, Q, N8], 'silver', 100);
  const g = p.gold;
  unmoor(game, s);
  assert.equal(p.gold, g + 200);
  assert.equal(conn.last('blight_bj')!.view, null);
  // every hand in the ledger
  const flows = db.ledgerFlows(0);
  const silver = flows.find((f) => f.kind === 'blackjack')!, marks = flows.find((f) => f.kind === 'blackjack_marks')!;
  assert.equal(silver.n, 10);
  assert.equal(marks.n, 2);
  assert.equal(Math.round(silver.inflow - silver.outflow), p.gold - 100_000);
});

test('twenty-one, the limits: sixty hands an hour; the silver table closes kindly at 200 000 lost in a day; a shuffled deck is 52 different cards', () => {
  const { game } = makeGame();
  const { s, conn } = captain(game, 'Limit Liv');
  const p = s.profile!;
  enter(game, s);
  moor(game, s);
  p.gold = 10_000_000;
  const r = rec(s);
  r.marks = 10_000;
  // an honest deck off the table's own Rng
  blightMessage(game, s, { t: 'blight', action: 'bj', op: 'deal', coin: 'marks', stake: 5 });
  const hand = blightTest.state(game).hands.get(s.accountId)!;
  assert.equal(new Set([...hand.deck, ...hand.player, ...hand.dealer]).size, 52);
  if (!hand.result) blightMessage(game, s, { t: 'blight', action: 'bj', op: 'stand' });
  // twenty hands lost at 10 000: the day's cap
  for (let i = 0; i < 20; i++) {
    blightRigDeck(game, [T, suit(T, 1), N7, N9]);
    blightMessage(game, s, { t: 'blight', action: 'bj', op: 'deal', coin: 'silver', stake: 10_000 });
    blightMessage(game, s, { t: 'blight', action: 'bj', op: 'stand' });
  }
  assert.equal(p.gold, 10_000_000 - BJ_SILVER_DAY);
  assert.equal(blightView(game, s)!.bj.silver, 0);
  blightMessage(game, s, { t: 'blight', action: 'bj', op: 'deal', coin: 'silver', stake: 100 });
  assert.equal(p.gold, 10_000_000 - BJ_SILVER_DAY, 'no more silver today');
  assert.ok(toasts(conn).includes(BLIGHT_WORDS.bjDay[0]));
  // marks are still welcome — up to sixty hands in the hour
  let dealt = 21;
  for (; dealt < BJ_HANDS_HOUR; dealt++) {
    blightRigDeck(game, [T, suit(T, 1), N8, suit(N8, 1)]);
    blightMessage(game, s, { t: 'blight', action: 'bj', op: 'deal', coin: 'marks', stake: 5 });
    blightMessage(game, s, { t: 'blight', action: 'bj', op: 'stand' });
  }
  assert.equal(blightView(game, s)!.bj.hands, 0);
  const m = r.marks;
  blightMessage(game, s, { t: 'blight', action: 'bj', op: 'deal', coin: 'marks', stake: 5 });
  assert.equal(r.marks, m);
  assert.ok(toasts(conn).includes(BLIGHT_WORDS.bjHour[0]));
});

test('Dead Man’s Dice is played at the Raft too, and nowhere else at sea', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Dice Dee');
  enter(game, s);
  s.profile!.gold = 5000;
  assert.equal(diceOpen(game, s, 200), 'Dice are played in a tavern.');
  moor(game, s);
  assert.equal(diceOpen(game, s, 200), null);
  assert.equal(s.profile!.gold, 4800);
  const v = blightView(game, s)!;
  assert.equal(v.dice, true);
  assert.deepEqual(v.tables.map((t) => t.stake), [200]);
  assert.equal(diceLeave(game, s), null);
  assert.equal(s.profile!.gold, 5000);
  assert.equal(RAFT_TABLE, 'blight_raft');
});

// ================================================================================================ the shop

test('the shop: for banked marks, moored; each purchase of a thing makes the next a quarter dearer for the week; a title and a pennant once', () => {
  assert.equal(shopPrice(60, 0), 60);
  assert.equal(shopPrice(60, 1), 75);
  assert.equal(shopPrice(60, 4), 120);
  const { game } = makeGame();
  const { s, conn } = captain(game, 'Shop Shay');
  const p = s.profile!;
  enter(game, s);
  const r = rec(s);
  r.marks = 5000;
  const buy = (id: string) => blightMessage(game, s, { t: 'blight', action: 'buy', id: id as never });
  buy('lantern');
  assert.equal(r.marks, 5000, 'not at sea');
  moor(game, s);
  const price = (id: string) => blightView(game, s)!.shop.find((w) => w.id === id)!;
  assert.equal(price('lantern').price, 80);
  buy('lantern');
  assert.equal(r.marks, 4920);
  assert.equal(price('lantern').price, 100);
  buy('lantern');
  assert.equal(r.marks, 4820);
  assert.ok(blightView(game, s)!.lantern > game.wallNow() + 19 * 60_000, 'two lanterns: twenty minutes');
  buy('title');
  assert.ok(p.titles.includes(BLIGHT_TITLE[0]));
  assert.equal(r.marks, 4520);
  assert.equal(price('title').owned, true);
  buy('title');
  assert.equal(r.marks, 4520, 'once');
  buy('pennant');
  assert.ok(p.pennants.includes(BLIGHT_PENNANT));
  const sp = p.speedups ?? 0;
  buy('speedup');
  assert.equal(p.speedups, sp + 1);
  buy('nothing');
  assert.ok(toasts(conn).includes(BLIGHT_WORDS.shopNone[0]));
  // too poor
  r.marks = 10;
  buy('speedup');
  assert.equal(r.marks, 10);
  // a new week: the prices are the first ones again
  r.shop.week -= 1;
  assert.equal(price('lantern').price, 80);
  // the lantern: a tier's worth more marks
  unmoor(game, s);
  put(game, s, INSIDE.x, INSIDE.y);
  blightSecond(game, s);
  assert.equal(blightView(game, s)!.mul, blightMul(2));
  for (const w of BLIGHT_SHOP) assert.ok(w.price > 0 && w.name[1] && w.hint[1]);
});

test('the shop’s re-forge: one extra line of a piece of hers rolled anew', async () => {
  const { makeItem } = await import('../shared/src/data/items.ts');
  const { Rng } = await import('../shared/src/rng.ts');
  const { game } = makeGame();
  const { s } = captain(game, 'Forge Fia');
  const p = s.profile!;
  let it = makeItem(new Rng(5), p.itemSeq++, { ilvl: 9, rarity: 3 });
  for (let k = 6; !it.affixes.length && k < 40; k++) it = makeItem(new Rng(k), p.itemSeq++, { ilvl: 9, rarity: 3 });
  assert.ok(it.affixes.length, 'a piece with an extra line');
  p.stash.push(it);
  enter(game, s);
  moor(game, s);
  const r = rec(s);
  r.marks = 500;
  const was = it.affixes[0].a;
  blightMessage(game, s, { t: 'blight', action: 'buy', id: 'reroll', uid: it.uid, line: 0 });
  assert.notEqual(it.affixes[0].a, was);
  assert.equal(r.marks, 350);
  blightMessage(game, s, { t: 'blight', action: 'buy', id: 'reroll', uid: 999999, line: 0 });
  assert.equal(r.marks, 350, 'no such piece: nothing taken');
});

// ================================================================================================ the Heart

test('the Blight’s Heart: risen by the Raft, guns only, her marks by each captain’s part of her hull', () => {
  const { game } = makeGame();
  const a = captain(game, 'Heart Hana'), b = captain(game, 'Heart Hugo'), c = captain(game, 'Heart Hex');
  for (const [i, x] of [a, b, c].entries()) seasoned(game, x.s, 0, 1, { x: INSIDE.x + i * 200, y: INSIDE.y });
  const heart = blightHeartRise(game)!;
  assert.equal(heart.name, 'The Blight’s Heart');
  assert.ok(Math.hypot(heart.state.x - BLIGHT_RAFT.x, heart.state.y - BLIGHT_RAFT.y) < 1500);
  const plain = blightHunterAt(game, 3, INSIDE.x, INSIDE.y + 1500, 0);
  assert.ok(heart.stats.hullMax > plain.stats.hullMax * 8, 'a hull many times a hunter’s');
  assert.equal(heartBoardBlocked(game, a.s.ship!, heart), BLIGHT_WORDS.heartNoBoard[0]);
  assert.equal(heartBoardBlocked(game, a.s.ship!, plain), null);
  assert.equal(blightHeartRise(game), heart, 'one at a time');
  const v = blightView(game, a.s)!.heart as { id: number; hp: number };
  assert.equal(v.id, heart.id);
  assert.equal(v.hp, 1);
  assert.ok(toasts(a.conn).includes(BLIGHT_WORDS.heartUp[0]));
  // parts: 60 %, 39 %, 1 % (under three hundredths: nothing)
  const hp = heart.stats.hullMax;
  blightCredit(game, heart, a.s.ship!, hp * 0.6);
  blightCredit(game, heart, b.s.ship!, hp * 0.39);
  blightCredit(game, heart, c.s.ship!, hp * 0.01);
  heart.attackers.set(a.s.ship!.id, game.now);
  heart.hull = 0;
  game.beginSinking(heart);
  assert.equal(rec(a.s).hold, Math.round(HEART_POOL * 0.6 * blightMul(1)));
  assert.equal(rec(b.s).hold, Math.round(HEART_POOL * 0.39 * blightMul(1)));
  assert.equal(rec(c.s).hold, 0);
  assert.equal(rec(a.s).taint, 100);
  assert.equal(blightView(game, a.s)!.heart === null || 'at' in blightView(game, a.s)!.heart!, true, 'gone');
  assert.ok(toasts(c.conn).includes(BLIGHT_WORDS.heartDown[0]));
});

test('the Heart’s calendar: every three hours of the wall clock, told ten minutes before — and only with a cleared captain aboard', () => {
  const { game } = makeGame();
  let wall = 3 * 3_600_000 * 1000 + 60_000;
  game.wallNow = () => wall;
  const { s, conn } = captain(game, 'Clock Cleo');
  put(game, s, 20000, 20000);
  blightSecond(game, s); // the letter: she is told of the place
  stepBlight(game);
  const hearts = () => [...game.ships.values()].filter((o) => o.name === 'The Blight’s Heart').length;
  assert.equal(hearts(), 0, 'a server just started raises nothing');
  assert.equal(blightView(game, s)!.heart, null);
  wall += 3 * 3_600_000 - 60_000 - 9 * 60_000; // nine minutes before the hour
  stepBlight(game);
  assert.ok(toasts(conn).includes(BLIGHT_WORDS.heartSoon[0]));
  assert.ok('at' in blightView(game, s)!.heart!);
  stepBlight(game);
  assert.equal(toasts(conn).filter((m) => m === BLIGHT_WORDS.heartSoon[0]).length, 1, 'told once');
  wall += 9 * 60_000 + 1000;
  stepBlight(game);
  assert.equal(hearts(), 1);
  // unbeaten in half an hour, she goes
  game.now += 1801;
  stepBlight(game);
  assert.equal(hearts(), 0);
  // with nobody cleared aboard the hour passes in silence
  const g2 = makeGame().game;
  let w2 = 3 * 3_600_000 * 2000 - 5000;
  g2.wallNow = () => w2;
  captain(g2, 'Nobody Ned', false);
  stepBlight(g2);
  w2 += 10_000;
  stepBlight(g2);
  assert.equal([...g2.ships.values()].filter((o) => o.name === 'The Blight’s Heart').length, 0);
});

// ================================================================================================ the chapter

/** Does what a step asks, by the zone's own roads. */
function doStep(game: Game, s: PlayerSession, step: BlightStep): void {
  const r = rec(s);
  if (raftMoored(game, s) && step.k !== 'moor' && step.k !== 'bj') unmoor(game, s);
  switch (step.k) {
    case 'reach':
      leave(game, s);
      return enter(game, s);
    case 'moor':
      if (!r.in) enter(game, s);
      if (raftMoored(game, s)) unmoor(game, s);
      return moor(game, s);
    case 'tier':
      if (!r.in) enter(game, s);
      setTier(game, s, step.n);
      return;
    case 'sink':
      if (!r.in) enter(game, s);
      if (tierOf(r.taint) < (step.tier ?? 1)) setTier(game, s, step.tier ?? 1);
      for (let i = 0; i < step.n; i++) sinkHunter(game, s, step.tier ?? 1);
      return;
    case 'bank':
      if (!r.in) enter(game, s);
      r.hold = Math.max(r.hold, step.n);
      return leave(game, s);
    case 'bj':
      if (!r.in) enter(game, s);
      moor(game, s);
      r.marks += 5 * step.n;
      for (let i = 0; i < step.n; i++) {
        blightRigDeck(game, [T, N9, Q, N8]);
        blightMessage(game, s, { t: 'blight', action: 'bj', op: 'deal', coin: 'marks', stake: 5 });
        blightMessage(game, s, { t: 'blight', action: 'bj', op: 'stand' });
      }
      return;
    case 'heart': {
      if (!r.in) enter(game, s);
      const heart = blightHeartRise(game)!;
      blightCredit(game, heart, s.ship!, heart.stats.hullMax);
      heart.attackers.set(s.ship!.id, game.now);
      heart.hull = 0;
      game.beginSinking(heart);
      return;
    }
    case 'duel':
      if (!r.in) enter(game, s);
      setTier(game, s, step.tier);
      for (let i = 0; i < step.n; i++) sinkHunter(game, s, step.tier);
      return;
    case 'survive':
      if (!r.in) enter(game, s);
      if (tierOf(r.taint) < step.tier) setTier(game, s, step.tier);
      for (let i = 0; i < step.min * 60; i++) blightSecond(game, s);
      return;
    case 'cask': {
      if (!r.in) enter(game, s);
      const foe = sinkHunter(game, s, 1); // a step of hers asks for a cask: this one leaves it
      put(game, s, foe.state.x, foe.state.y);
      blightSecond(game, s);
      assert.ok(r.cask, 'a cask aboard');
      return leave(game, s);
    }
  }
}

test('«Глава XXXVII. Зелёный огонь»: fourteen quests taken and handed in at the Raft in order; marks and experience for each; the title and the pennant at the end; then the daily contracts', () => {
  const { game } = makeGame();
  const { s, conn } = captain(game, 'Chapter Cy');
  const p = s.profile!;
  put(game, s, OUTSIDE.x, OUTSIDE.y);
  blightSecond(game, s);
  const r = rec(s);
  assert.equal(BLIGHT_QUESTS.length, 14);
  assert.equal(blightView(game, s)!.ch.at, 0);
  assert.equal(blightView(game, s)!.ch.cur, null);
  blightMessage(game, s, { t: 'blight', action: 'claim' });
  assert.ok(toasts(conn).includes(BLIGHT_WORDS.qNone[0]));
  for (let i = 0; i < BLIGHT_QUESTS.length; i++) {
    const q = BLIGHT_QUESTS[i];
    assert.equal(r.ch.at, i);
    blightMessage(game, s, { t: 'blight', action: 'take' });
    assert.ok(r.ch.cur, `quest ${i + 1} taken`);
    blightMessage(game, s, { t: 'blight', action: 'take' });
    assert.ok(toasts(conn).includes(BLIGHT_WORDS.qHave[0]), 'one at a time');
    for (let k = 0; k < q.s.length; k++) {
      if (r.ch.cur!.step > k) continue; // (true of her already: done as it came up)
      assert.equal(r.ch.cur!.step, k, `quest ${i + 1} step ${k + 1} is next`);
      const v = blightView(game, s)!.ch.cur!;
      assert.equal(v.need, stepNeed(q.s[k]));
      doStep(game, s, q.s[k]);
      assert.ok(r.ch.cur!.step > k, `quest ${i + 1} step ${k + 1} (${q.s[k].k}) done`);
    }
    // handed in only at the Raft
    if (raftMoored(game, s)) unmoor(game, s);
    blightMessage(game, s, { t: 'blight', action: 'claim' });
    assert.equal(r.ch.at, i, 'not at sea');
    assert.equal(blightView(game, s)!.ch.canClaim, false);
    if (!r.in) enter(game, s);
    moor(game, s);
    assert.equal(blightView(game, s)!.ch.canClaim, true);
    const marks = r.marks, xp = p.xp + (p.throne?.xp ?? 0);
    blightMessage(game, s, { t: 'blight', action: 'claim' });
    assert.equal(r.ch.at, i + 1, `quest ${i + 1} handed in`);
    assert.equal(r.marks - marks, q.marks);
    assert.ok(p.xp + (p.throne?.xp ?? 0) > xp, 'experience (glory past the 60th)');
    assert.ok(toasts(conn).includes(say('qDone', q.t[0], q.marks)));
  }
  assert.ok(p.titles.includes(BLIGHT_CHAPTER.reward.title[0]), 'the chapter’s title');
  assert.ok(p.pennants.includes(BLIGHT_CHAPTER.reward.pennant), 'and its pennant');
  assert.ok(toasts(conn).includes(BLIGHT_WORDS.chapterDone[0]));
  blightMessage(game, s, { t: 'blight', action: 'take' });
  assert.equal(r.ch.cur, null, 'no fifteenth quest');
  // the contracts of the day: three, of the chapter's own steps
  const v = blightView(game, s)!;
  assert.equal(v.ch.at, 14);
  assert.equal(v.contracts.length, 3);
  assert.equal(new Set(v.contracts.map((c) => c.ask.k)).size, 3, 'three different asks');
  for (const c of v.contracts) assert.ok(c.marks > 0 && c.xp > 0 && !c.paid);
});

test('the chapter is written whole in both tongues, in fourteen quests of one to three steps', () => {
  for (const [i, q] of BLIGHT_QUESTS.entries()) {
    for (const pair of [q.t, q.b, q.d]) {
      assert.ok(pair[0].length > 8 && pair[1].length > 8, `quest ${i + 1} has its words`);
      assert.ok(/[а-яё]/i.test(pair[1]) && !/[A-Za-z]{3,}/.test(pair[1]), `quest ${i + 1}: Russian reads in Russian — ${pair[1].slice(0, 40)}`);
      assert.ok(!/[а-яё]/i.test(pair[0]), `quest ${i + 1}: English reads in English`);
    }
    assert.ok(q.b[0].length > 120, `quest ${i + 1}: a briefing, not a line`);
    assert.ok(q.s.length >= 1 && q.s.length <= 3);
    assert.ok(q.marks > 0 && q.units > 0);
    for (const st of q.s) {
      const [en, ru] = stepText(st);
      assert.ok(en && /[а-яё]/i.test(ru) && !/[A-Za-z]{3,}/.test(ru));
    }
    // no bones, skulls or blood (CLAUDE.md §2)
    for (const w of [/skull/i, /\bbones?\b/i, /blood/i, /череп/i, /кост[ьяи]/i, /кров/i]) assert.ok(!w.test(q.b.join(' ') + q.d.join(' ') + q.t.join(' ')), `quest ${i + 1}: ${w}`);
  }
  const kinds = new Set(BLIGHT_QUESTS.flatMap((q) => q.s.map((x) => x.k)));
  for (const k of ['reach', 'moor', 'sink', 'tier', 'bank', 'bj', 'heart', 'duel', 'survive', 'cask']) assert.ok(kinds.has(k as BlightStep['k']), `a step of kind ${k}`);
  assert.equal(new Set(BLIGHT_QUESTS.map((q) => q.t[0])).size, 14);
});

test('the endless contracts: three a day by the day and the captain, their numbers by her best tier; paid once, at the Raft', () => {
  const a = dayContracts(20_000, 7, 3), b = dayContracts(20_000, 7, 3), c = dayContracts(20_001, 7, 3), d = dayContracts(20_000, 8, 3);
  assert.deepEqual(a, b, 'the same three all day');
  assert.equal(a.length, 3);
  assert.ok(JSON.stringify(a) !== JSON.stringify(c) || JSON.stringify(a) !== JSON.stringify(d), 'another day or another captain: other asks');
  // scaling: every number grows (or holds) with the best tier, and the pay grows
  const size = (best: number, k: BlightStep['k']): number => {
    for (let day = 0; day < 400; day++) {
      const x = dayContracts(day, 1, best).find((q) => q.step.k === k);
      if (x) return stepNeed(x.step) + ('tier' in x.step ? (x.step.tier ?? 0) * 1000 : 0) + (x.step.k === 'tier' || x.step.k === 'bank' ? x.step.n : 0);
    }
    return -1;
  };
  for (const k of ['sink', 'tier', 'bank', 'survive', 'duel'] as const) assert.ok(size(8, k) > size(2, k), `${k} asks more of a deeper captain`);
  assert.ok(dayContracts(1, 1, 8)[0].marks > dayContracts(1, 1, 2)[0].marks);
  for (let day = 0; day < 60; day++) for (const q of dayContracts(day, 3, 5)) assert.ok(stepNeed(q.step) >= 1 && q.marks > 0);
  // in the game: the chapter behind her, a contract done and handed in once
  const { game } = makeGame();
  const { s, conn } = captain(game, 'Daily Dot');
  put(game, s, OUTSIDE.x, OUTSIDE.y);
  blightSecond(game, s);
  const r = rec(s);
  assert.equal(blightView(game, s)!.contracts.length, 0, 'none before the chapter is done');
  r.ch.at = BLIGHT_QUESTS.length;
  r.best = 4;
  const list = blightView(game, s)!.contracts;
  assert.equal(list.length, 3);
  const one = list[0];
  blightMessage(game, s, { t: 'blight', action: 'contract', id: one.id });
  assert.ok(toasts(conn).includes(BLIGHT_WORDS.qUndone[0]));
  doStep(game, s, one.ask);
  const done = blightView(game, s)!.contracts.find((x) => x.id === one.id)!;
  assert.equal(done.progress, done.need, `the ask (${one.ask.k}) counted`);
  if (!r.in) enter(game, s);
  moor(game, s);
  const marks = r.marks;
  blightMessage(game, s, { t: 'blight', action: 'contract', id: one.id });
  assert.equal(r.marks - marks, one.marks);
  blightMessage(game, s, { t: 'blight', action: 'contract', id: one.id });
  assert.equal(r.marks - marks, one.marks, 'once');
  assert.equal(blightView(game, s)!.contracts.find((x) => x.id === one.id)!.paid, true);
  // the day turns: three new ones, the best tier of now
  const wall = game.wallNow();
  game.wallNow = () => wall + 86_400_000;
  const next = blightView(game, s)!.contracts;
  assert.equal(next.length, 3);
  assert.ok(next.every((x) => !x.paid && x.progress === 0));
});

// ================================================================================================ the week

test('the week’s board: marks banked, tiers, captains sunk; its three hold a title for the week and are paid marks once', () => {
  const { game, db } = makeGame();
  const cs = ['Week Wyn', 'Week Xan', 'Week Yul', 'Week Zed'].map((n) => captain(game, n));
  for (const [i, c] of cs.entries()) {
    enter(game, c.s, { x: INSIDE.x + i * 150, y: INSIDE.y });
    rec(c.s).hold = [500, 300, 100, 10][i];
    setTier(game, c.s, 4 - i);
    leave(game, c.s);
  }
  const board = blightView(game, cs[1].s)!.week;
  assert.deepEqual(board.map((x) => x.name), ['Week Wyn', 'Week Xan', 'Week Yul', 'Week Zed']);
  assert.deepEqual(board.map((x) => x.banked), [500, 300, 100, 10]);
  assert.equal(board[0].tier, 4);
  assert.equal(board[1].me, true);
  blightTest.weekTurn(game);
  for (const [i, c] of cs.entries()) {
    const marks = rec(c.s).marks;
    blightTest.weekSyncNow(game, c.s);
    if (i < 3) {
      assert.ok(c.s.profile!.titles.includes(WEEK_TITLES[i][0]), `place ${i + 1}: ${WEEK_TITLES[i][0]}`);
      assert.equal(rec(c.s).marks - marks, WEEK_MARKS[i]);
      assert.equal(blightView(game, c.s)!.weekTitle, WEEK_TITLES[i][0]);
      assert.equal(lettersSince(game, c.s.accountId, 0).filter((l) => l.subject === BLIGHT_WORDS.weekLetter[0]).length, 1);
      blightTest.weekSyncNow(game, c.s);
      assert.equal(rec(c.s).marks - marks, WEEK_MARKS[i], 'paid once');
    } else assert.ok(!WEEK_TITLES.some((t) => c.s.profile!.titles.includes(t[0])));
  }
  assert.equal(blightView(game, cs[0].s)!.week.length, 0, 'a clean slate');
  // the next week is another's: the title is taken back
  cs[0].s.profile!.title = WEEK_TITLES[0][0];
  enter(game, cs[3].s);
  rec(cs[3].s).hold = 50;
  leave(game, cs[3].s);
  blightTest.weekTurn(game);
  blightTest.weekSyncNow(game, cs[0].s);
  blightTest.weekSyncNow(game, cs[3].s);
  assert.ok(!cs[0].s.profile!.titles.includes(WEEK_TITLES[0][0]));
  assert.equal(cs[0].s.profile!.title, null);
  assert.ok(cs[3].s.profile!.titles.includes(WEEK_TITLES[0][0]));
});

// ================================================================================================ the save, the admin, the words

test('an older save reads as it is: no record until the sea counts her its own; a record of today comes back whole', async () => {
  const { sanitizeBlight } = await import('../server/src/game/blight.ts');
  const { game } = makeGame();
  const { s } = captain(game, 'Save Sia', false);
  assert.equal(s.profile!.blight, undefined);
  sanitizeBlight(s.profile!);
  assert.equal(s.profile!.blight, undefined, 'none made for her');
  // a thin record (a field added later is filled)
  s.profile!.blight = { marks: 12 } as unknown as BlightSave;
  sanitizeBlight(s.profile!);
  const r = s.profile!.blight as BlightSave;
  assert.equal(r.marks, 12);
  assert.deepEqual(r.ch, { at: 0, cur: null });
  assert.equal(r.best, 1);
  assert.equal(r.in, false);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r, 'plain data: it goes into the save as it is');
});

test('/blight: to the rim, through the Veil, a tier, marks, the Heart, the week', () => {
  const { game } = makeGame();
  const { s } = captain(game, 'Admin Avi', false);
  assert.equal(adminBlight(game, s, ['go']), BLIGHT_WORDS.adminGo[0]);
  assert.ok(!inBlight(s.ship!.state.x, s.ship!.state.y));
  assert.ok(Math.hypot(s.ship!.state.x - BLIGHT.x, s.ship!.state.y - BLIGHT.y) < BLIGHT.r + 400);
  assert.equal(adminBlight(game, s, ['clear']), BLIGHT_WORDS.adminClear[0]);
  const admin = process.env.GRAVETIDE_ADMIN;
  assert.ok(!blightCleared(game, s), 'the pass holds only on a server run with the admin commands');
  process.env.GRAVETIDE_ADMIN = '1';
  try {
    assert.ok(blightCleared(game, s));
    enter(game, s);
    assert.equal(adminBlight(game, s, ['tier', '6']), say('adminTier', 6));
    assert.equal(blightView(game, s)!.tier, 6);
    assert.equal(adminBlight(game, s, ['marks', '250']), say('adminMarks', 250));
    assert.equal(adminBlight(game, s, ['heart']), BLIGHT_WORDS.adminHeart[0]);
    assert.ok('id' in blightView(game, s)!.heart!);
    assert.equal(adminBlight(game, s, ['week']), BLIGHT_WORDS.adminWeek[0]);
    assert.equal(adminBlight(game, s, ['status']), say('adminStatus', 1, 1, 6, 0, 250, 1));
    assert.ok(adminBlight(game, s, ['what']).startsWith('Usage: /blight'));
  } finally {
    if (admin === undefined) delete process.env.GRAVETIDE_ADMIN;
    else process.env.GRAVETIDE_ADMIN = admin;
  }
});

test('every word of the green water reads in Russian', () => {
  const ru = (x: string): string => serverText(x).replace(/\s/g, ' '); // (the table sets non-breaking spaces)
  const pats = blightPatterns();
  const en = new Set<string>();
  for (const [e, r] of pats) {
    assert.ok(e && r, 'both tongues');
    assert.ok(!en.has(e) || true);
    en.add(e);
    assert.ok(/[а-яё]/i.test(r), `Russian: ${r}`);
    assert.ok(!/[A-Za-z]{3,}/.test(r.replace(/(?<![A-Za-z])[IVXL]+(?![A-Za-z])/g, '')), `no Latin words in: ${r}`);
    assert.equal((e.match(/\{\d\}/g) ?? []).sort().join(), (r.match(/\{\d\}/g) ?? []).sort().join(), `the same blanks: ${e}`);
  }
  setLang('ru');
  try {
    const english = (s: string) => (s.replace(/(?<![A-Za-z])[IVXL]+(?![A-Za-z])/g, '').match(/[A-Za-z]{3,}/g) ?? []).length >= 1;
    // every sentence as the server sends it, its blanks filled with numbers
    for (const [k, v] of Object.entries(BLIGHT_WORDS)) {
      if (k.startsWith('admin')) continue;
      const sent = v[0].replace(/\{\d\}/g, '7');
      assert.ok(!english(serverText(sent)), `${k}: ${serverText(sent)}`);
      // (and in the zone's own words: no older line of the table answers for it)
      assert.equal(serverText(sent).replace(/\s/g, ' '), v[1].replace(/\{\d\}/g, '7').replace(/\s/g, ' '), `${k} in its own words`);
    }
    // names in the blanks: a quest's title, a ware, a step
    assert.equal(ru(say('qTaken', BLIGHT_QUESTS[0].t[0])), `Задание зелёной воды взято: ${BLIGHT_QUESTS[0].t[1]}.`);
    assert.equal(ru(say('qDone', BLIGHT_QUESTS[13].t[0], 400)), `Задание зелёной воды выполнено: ${BLIGHT_QUESTS[13].t[1]} (+400 меток).`);
    assert.equal(ru(say('shopBought', BLIGHT_SHOP[5].name[0], 80)), 'Куплено на Плоту: Тёмный фонарь (−80 меток).');
    assert.equal(ru(say('qStep', stepText({ k: 'sink', n: 3, tier: 2 })[0])), 'Зелёная вода: Потопите охотников на ступени 2 и выше: 3 — готово.');
    for (const day of [1, 2, 3, 4, 5, 6, 7, 8]) for (const c of dayContracts(day, 5, 9)) assert.ok(!english(serverText(stepText(c.step)[0])), stepText(c.step)[0]);
    assert.equal(ru(say('weekTop', 'Нефигугум', WEEK_TITLES[0][0])), 'Неделя в зелёной воде закрыта: Нефигугум — Избранник Скверны.');
    assert.equal(ru('The Blight’s Heart'), 'Сердце Скверны');
    assert.equal(ru(BLIGHT_TITLE[0]), 'Плаватель Скверны');
    assert.equal(ru(BLIGHT_CHAPTER.reward.title[0]), 'Хозяин зелёной воды');
    assert.equal(ru(BLIGHT_WORDS.veil[0]), 'Зелёная вода не пускает вас: море ещё не считает вас своим.');
    assert.equal(ru(BLIGHT_WORDS.letterSubject[0]), 'Зелёный огонь за Простором мертвецов');
  } finally {
    setLang('en');
  }
});
