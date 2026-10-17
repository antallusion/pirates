// docs/35: the floating waystations and the resurrection of the fallen — the waystations' grid on the open sea, the
// «Причалить к плавучему дому» button and the server's mooring rules, the record of the fallen after battles, the
// resurrection for silver and the shop's creatures for doubloons only at half price, the room aboard, the request's id,
// the quick «Воскресить» after a boarding, the scrolls of resurrection, and the economy against the sea's income.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SEED } from '../shared/src/constants.ts';
import { UNITS } from '../shared/src/data/army.ts';
import type { UnitId } from '../shared/src/data/army.ts';
import { FALLEN_BATTLES, FIELD_MUL, PREMIUM_RES_OFF, RES_SHARE, resDoubloonsPer, resPrice, resSilverPer } from '../shared/src/data/resurrect.ts';
import { recruitPrice } from '../shared/src/data/town.ts';
import { isShipBeast } from '../shared/src/data/shipbeasts.ts';
import { TAC_RAISE_MAX, TAC_WOUNDED } from '../shared/src/data/tactical.ts';
import { closestOnPolygon, pointInPolygon } from '../shared/src/math.ts';
import { chunkKey, chunkOf, generateWorld, isLand } from '../shared/src/world/worldgen.ts';
import type { World } from '../shared/src/world/worldgen.ts';
import {
  WAY_CHUNK_CAP, WAY_JITTER, WAY_LAND_GAP, WAY_LEAVE_RANGE, WAY_MOOR_RANGE, WAY_PORT_GAP, WAY_SPACING, WAY_START_GAP, WAY_START_PORT, wayNear, waystations, wayStats,
} from '../shared/src/world/waystations.ts';
import type { Waystation } from '../shared/src/world/waystations.ts';
import type { Game } from '../server/src/game/Game.ts';
import { afterBattle } from '../server/src/game/hero.ts';
import { killMen } from '../server/src/game/combat.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { creditPremium } from '../server/src/game/premium.ts';
import { buyOffer, shopState } from '../server/src/game/shop.ts';
import { lossesOf } from '../server/src/game/tacbattle.ts';
import {
  castOff, fallenOf, hireKinds, moor, mooredAt, recordFallen, resPlace, resView, resurrect, wayDwellView, wayRecruit, waySecond,
} from '../server/src/game/waystations.ts';
import { buildActs } from '../client/src/ui/actbar.ts';
import { makeGame, join, onHull } from './helpers.ts';
import { playBoard, sidesAt, slOf } from './balance/boardlen.ts';
import { KILLS_HOUR, seaHour } from './balance/island.ts';

let world: World | null = null;
const W = (): World => (world ??= generateWorld(WORLD_SEED));

// ------------------------------------------------------------------------------------------------ the grid

test('waystations: a jittered grid of about 500 m on open water — never on land, off the coasts, reefs, harbours and the first roads; the same world, the same waystations', () => {
  const w = W();
  const idx = waystations(w);
  const st = wayStats(w);
  assert.ok(st.n > 12_000 && st.n < 36_000, `${st.n} waystations`);
  assert.ok(st.maxChunk <= WAY_CHUNK_CAP, `at most ${WAY_CHUNK_CAP} a chunk (${st.maxChunk})`);
  const start = w.ports.find((p) => p.id === WAY_START_PORT)!;
  for (const x of idx.list) {
    assert.equal(isLand(w, x.x, x.y), null, `#${x.id} on land`);
    for (const p of w.ports) assert.ok(Math.hypot(p.x - x.x, p.y - x.y) >= WAY_PORT_GAP, `#${x.id} in ${p.id}'s waters`);
    assert.ok(Math.hypot(start.x - x.x, start.y - x.y) >= WAY_START_GAP, `#${x.id} in the first roads`);
  }
  // The coasts kept off by the gap (a sample, every island near it measured).
  for (let i = 0; i < idx.list.length; i += 37) {
    const x = idx.list[i];
    for (const is of w.islands) {
      if (is.slot || Math.abs(is.x - x.x) > is.radius + 400 || Math.abs(is.y - x.y) > is.radius + 400) continue;
      assert.ok(!pointInPolygon(x.x, x.y, is.poly) && closestOnPolygon(x.x, x.y, is.poly).d2 >= (WAY_LAND_GAP - 1) ** 2, `#${x.id} by ${is.name}`);
    }
  }
  // The spacing: never nearer than the grid allows, about 500 m to the nearest as a rule.
  const near: number[] = [];
  for (let i = 0; i < idx.list.length; i += 11) {
    const a = idx.list[i];
    let best = Infinity;
    for (const id of nearIds(idx, a)) {
      const b = idx.list[id];
      if (b.id !== a.id) best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y));
    }
    if (Number.isFinite(best)) near.push(best);
  }
  near.sort((a, b) => a - b);
  assert.ok(near[0] >= WAY_SPACING - 2 * WAY_JITTER - 1, `the nearest pair ${near[0].toFixed(0)} m`);
  const median = near[Math.floor(near.length / 2)];
  assert.ok(median >= 380 && median <= 560, `the nearest one ${median.toFixed(0)} m as a rule`);
  // On the open sea a waystation is never far: from points of open water clear of every coast, harbour and roads.
  let open = 0, served = 0;
  for (let k = 0; k < 4000; k++) {
    const x = 6000 + ((k * 7919) % 84000), y = 6000 + ((k * 104729) % 84000);
    if (isLand(w, x, y) || w.ports.some((p) => Math.hypot(p.x - x, p.y - y) < WAY_PORT_GAP + 500) || Math.hypot(start.x - x, start.y - y) < WAY_START_GAP + 500) continue;
    if (w.islands.some((is) => !is.slot && Math.hypot(is.x - x, is.y - y) < is.radius + 700)) continue;
    if (w.reefs.some((r) => Math.hypot(r.x - x, r.y - y) < r.radius + 600)) continue;
    open++;
    if (wayNear(w, x, y, 600)) served++;
  }
  assert.ok(open > 500 && served / open >= 0.9, `open sea within 600 m of a waystation: ${served}/${open}`);
  // Deterministic: the same seed, the same list (a world made anew).
  const again = waystations(generateWorld(WORLD_SEED)).list;
  assert.equal(again.length, idx.list.length);
  for (let i = 0; i < again.length; i += 97) assert.deepEqual(again[i], idx.list[i]);
  assert.ok(new Set(idx.list.map((x) => x.kind)).size === 3, 'all three flavours');
});

function nearIds(idx: ReturnType<typeof waystations>, a: Waystation): number[] {
  // (the neighbours: the chunks about her)
  const out: number[] = [];
  for (const dx of [-1000, 0, 1000]) for (const dy of [-1000, 0, 1000]) {
    for (const id of idx.chunks.get(chunkKey(...chunkOf(a.x + dx, a.y + dy))) ?? []) if (!out.includes(id)) out.push(id);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the button and the mooring

test('the button: «Причалить к плавучему дому» within reach — a harbour\'s comes first, the waystation\'s leads alone; never moored by herself', () => {
  const acts = buildActs({ way: { id: 7, name: 'Плот-таверна' } });
  assert.equal(acts[0].id, 'moor_way');
  assert.equal(acts[0].arg, '7');
  assert.equal(acts[0].key, 'dock');
  const both = buildActs({ way: { id: 7, name: 'x' }, port: { name: 'Saltmarrow' } });
  assert.ok(!both.some((a) => a.id === 'moor_way'), 'a harbour\'s waters: the harbour\'s button only');
  const fight = buildActs({ way: { id: 7, name: 'x' }, board: { name: 'Sloop' } });
  assert.equal(fight[0].id, 'board', 'a ship to board leads');
  assert.ok(fight.some((a) => a.id === 'moor_way'));
});

function seaCaptain(game: Game, name: string, gold = 1_000_000): { s: PlayerSession; w: Waystation } {
  join(game, name, 'admiral');
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.gold = gold;
  s.profile!.level = 30;
  s.ship!.docked = null;
  // A waystation of the contested seas, far from the first roads.
  const w = waystations(game.world).list.find((x) => x.region === 'gravewater' && x.kind === 'market')!;
  at(game, s, w.x + 60, w.y);
  return { s, w };
}

function at(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.lastCombat = -1000;
  ship.lastHitAt = -1000;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, x, y);
}

test('mooring: only within reach and on her own tap; the window comes, a drift past the leave range or a fight casts her off', () => {
  const { game } = makeGame();
  const { s, w } = seaCaptain(game, 'Moor');
  at(game, s, w.x + WAY_MOOR_RANGE + 200, w.y);
  for (let i = 0; i < 40; i++) game.step();
  assert.equal(mooredAt(game, s), null, 'never moored by herself');
  assert.match(moor(game, s, w.id)!, /closer/);
  at(game, s, w.x + WAY_MOOR_RANGE - 20, w.y);
  assert.equal(moor(game, s, w.id), null);
  assert.equal(mooredAt(game, s)?.id, w.id);
  assert.equal(resPlace(game, s), 'way');
  at(game, s, w.x + WAY_LEAVE_RANGE + 50, w.y);
  waySecond(game, s);
  assert.equal(mooredAt(game, s), null, 'drifted off');
  at(game, s, w.x, w.y + 30);
  assert.equal(moor(game, s, w.id), null);
  s.ship!.lastHitAt = game.now;
  waySecond(game, s);
  assert.equal(mooredAt(game, s), null, 'a fight casts her off');
  assert.match(moor(game, s, w.id)!, /under fire/);
  s.ship!.lastHitAt = -1000;
  assert.equal(moor(game, s, w.id), null);
  castOff(game, s);
  assert.equal(mooredAt(game, s), null);
});

// ------------------------------------------------------------------------------------------------ the record

test('the record of the fallen: a battle\'s dead past the wounded who stood again; the guns\' dead less those carried below; a day and twenty battles at most', () => {
  const { game } = makeGame();
  let clock = 1_000_000_000_000;
  game.wallNow = () => clock;
  const { s } = seaCaptain(game, 'Rec');
  const ship = s.ship!;
  ship.setArmy([{ u: 'marine', n: 30 }, { u: 'deckhand', n: 40 }]);
  // A boarding: 20 marines and 10 deckhands lost, a third stand again (the wounded and First Aid).
  ship.loseFrom('marine', 20);
  ship.loseFrom('deckhand', 10);
  afterBattle(game, ship, -1, [{ u: 'marine', n: 20 }, { u: 'deckhand', n: 10 }], 1 / 3, -1, [], true, false);
  const rec = fallenOf(game, s);
  const by = (u: string) => rec.list.filter((e) => e.u === u).reduce((a, e) => a + e.n, 0);
  assert.equal(by('marine'), 20 - Math.floor(20 / 3));
  assert.equal(by('deckhand'), 10 - Math.floor(10 / 3));
  assert.equal(ship.army.find((x) => x.u === 'marine')!.n, 10 + Math.floor(20 / 3), 'the raised are aboard, not on the record');
  // The guns: the dead less the wounded below (the cheapest kinds counted out first).
  const before = rec.list.reduce((a, e) => a + e.n, 0);
  const w0 = ship.wounded;
  const fell = killMen(game, ship, 12, null);
  const wounded = ship.wounded - w0;
  const after = fallenOf(game, s).list.reduce((a, e) => a + e.n, 0);
  assert.equal(after - before, fell - wounded, `${fell} fell, ${wounded} below`);
  // A day on, the record is forgotten.
  clock += 25 * 3_600_000;
  assert.equal(fallenOf(game, s).list.length, 0);
  // Twenty battles at most.
  for (let i = 0; i < FALLEN_BATTLES + 5; i++) {
    clock += 60_000 * 5;
    recordFallen(game, s, [{ u: 'deckhand', n: 1 }]);
  }
  assert.equal(fallenOf(game, s).list.reduce((a, e) => a + e.n, 0), FALLEN_BATTLES);
  // The premium hulls' own and the legends are not kept (they muster again, they are never had for silver).
  const legend = (Object.keys(UNITS) as UnitId[]).find((u) => UNITS[u].legend);
  if (legend) {
    recordFallen(game, s, [{ u: legend, n: 1 }]);
    assert.ok(!fallenOf(game, s).list.some((e) => e.u === legend));
  }
});

// ------------------------------------------------------------------------------------------------ the prices

test('the prices: the line kinds for silver at 50–70 % of a man\'s worth by tier (under any hire); the shop\'s creatures for doubloons only, half their price a head', () => {
  for (const u of Object.keys(UNITS) as UnitId[]) {
    const d = UNITS[u];
    if (isShipBeast(u)) continue; // (a premium hull's own: never on the record, they muster again by themselves)
    if (d.premium) {
      const one = resPrice(u, 1);
      assert.equal(one.silver, 0, `${u}: never for silver`);
      assert.ok(Math.abs(resDoubloonsPer(u) - (d.premium.price / d.premium.n) * (1 - PREMIUM_RES_OFF)) < 1e-9, u);
      assert.equal(resPrice(u, d.premium.n).doubloons, Math.ceil(d.premium.price * 0.5 - 1e-9), `${u}: a purchase's worth raised for half its price`);
      continue;
    }
    if (d.titan || d.legend || !(d.cost > 0)) continue;
    const per = resSilverPer(u);
    assert.ok(per >= 1 && per <= d.cost * 0.7 + 0.5 && per >= d.cost * 0.5 - 0.5, `${u}: ${per} of ${d.cost}`);
    assert.ok(resPrice(u, 10).silver < recruitPrice(u, 10, false).silver, `${u}: under the dwelling's price`);
    assert.equal(resPrice(u, 10, 'field').silver, Math.ceil(10 * per * FIELD_MUL - 1e-9), `${u}: the field surgeon's fee`);
  }
  assert.deepEqual(RES_SHARE.slice(1, 8), [0.5, 0.55, 0.55, 0.6, 0.6, 0.65, 0.7]);
  assert.equal(resPrice('golden_crab', 2).doubloons, 50, 'a pair of golden crabs (100 doubloons a pair): 50');
  assert.equal(resPrice('golden_crab', 1).doubloons, 25);
});

// ------------------------------------------------------------------------------------------------ raising

test('raising for silver at a waystation: the ledger, the record, the toast; nothing far from a waystation or port but the doubloons\' infirmary', () => {
  const { game, db } = makeGame();
  const { s, w } = seaCaptain(game, 'Res', 10_000);
  const ship = s.ship!;
  ship.setArmy([{ u: 'marine', n: 10 }, { u: 'deckhand', n: 30 }]);
  recordFallen(game, s, [{ u: 'marine', n: 8 }, { u: 'deckhand', n: 6 }]);
  assert.equal(moor(game, s, w.id), null);
  const v = resView(game, s);
  assert.equal(v.place, 'way');
  assert.equal(v.silver, resPrice('marine', 8).silver + resPrice('deckhand', 6).silver);
  const gold = s.profile!.gold;
  assert.equal(resurrect(game, s, 'marine', 'silver', 'rid-one-1'), null);
  assert.equal(ship.army.find((x) => x.u === 'marine')!.n, 18);
  assert.equal(s.profile!.gold, gold - resPrice('marine', 8).silver);
  const rows = (db as unknown as { db: { prepare(q: string): { all(...a: unknown[]): { amount: number; detail: string }[] } } }).db.prepare(`SELECT amount, detail FROM ledger WHERE account_id = ? AND kind = 'resurrect'`).all(s.accountId);
  assert.deepEqual(rows.map((r) => [Number(r.amount), r.detail]), [[-resPrice('marine', 8).silver, 'way:marine:8']]);
  assert.ok(!fallenOf(game, s).list.some((e) => e.u === 'marine'), 'off the record');
  // Far from any waystation or port: refused (the infirmary for doubloons remains).
  castOff(game, s);
  at(game, s, 50_000, 36_000); // the Widow's Eye's waters: no waystation within its ring
  assert.equal(resPlace(game, s), 'none');
  assert.match(resurrect(game, s, 'deckhand', 'silver', 'rid-two-22')!, /waystation or a port/);
  assert.ok(resView(game, s).instant >= 290, 'the infirmary\'s price');
});

test('the shop\'s creatures stand again for doubloons only, at half price; a scroll never raises them', () => {
  const { game, db } = makeGame();
  const { s, w } = seaCaptain(game, 'Prem');
  const ship = s.ship!;
  ship.setArmy([{ u: 'golden_crab', n: 2 }, { u: 'deckhand', n: 40 }]);
  recordFallen(game, s, [{ u: 'golden_crab', n: 4 }]);
  assert.equal(moor(game, s, w.id), null);
  assert.match(resurrect(game, s, 'golden_crab', 'silver', 'prem-rid-1')!, /Needs 100 doubloons/, 'silver will not do');
  assert.equal(ship.army.find((x) => x.u === 'golden_crab')!.n, 2);
  shopState(game, s.accountId).rscrolls = 5;
  assert.match(resurrect(game, s, 'golden_crab', 'scroll', 'prem-rid-2')!, /doubloons only/);
  assert.ok(creditPremium(game, s.accountId, 500, 'admin', 'test') !== null);
  assert.equal(resurrect(game, s, 'golden_crab', 'silver', 'prem-rid-3'), null);
  assert.equal(ship.army.find((x) => x.u === 'golden_crab')!.n, 6);
  assert.equal(db.doubloons(s.accountId), 400, 'four crabs: 100 doubloons (a pair costs 100 in the shop)');
  assert.ok(db.doubloonRef(s.accountId, 'doubloons_res', 'res:prem-rid-3:golden_crab:4'));
});

test('the room aboard: the hammocks, the army\'s slots, the might cap of the trained men', () => {
  const { game } = makeGame();
  const { s, w } = seaCaptain(game, 'Room');
  const ship = s.ship!;
  assert.equal(moor(game, s, w.id), null);
  // Hammocks: full, nothing comes back.
  ship.setArmy([{ u: 'deckhand', n: ship.stats.crewMax }]);
  recordFallen(game, s, [{ u: 'deckhand', n: 10 }]);
  assert.equal(resView(game, s).rows[0].room, 0);
  assert.match(resurrect(game, s, 'deckhand', 'silver', 'room-rid-1')!, /hammocks/);
  // Slots: every slot taken by other kinds, a new kind does not come.
  const kinds: UnitId[] = ['deckhand', 'sailor', 'marine', 'sea_guard', 'musketeer', 'sharpshooter', 'gunner'].slice(0, ship.armySlots) as UnitId[];
  ship.setArmy(kinds.map((u) => ({ u, n: 2 })));
  recordFallen(game, s, [{ u: 'boarder', n: 3 }]);
  const row = resView(game, s).rows.find((r) => r.u === 'boarder')!;
  assert.equal(row.room, 0);
  assert.match(row.why!, /slot/);
  // The might cap: a ship of ⚓5 takes no more guards than her might allows.
  ship.setArmy([{ u: 'guard', n: 40 }, { u: 'deckhand', n: 20 }]);
  recordFallen(game, s, [{ u: 'guard', n: 60 }]);
  const g = resView(game, s).rows.find((r) => r.u === 'guard')!;
  assert.ok(g.room < 60, `guards back: ${g.room} of 60`);
});

test('a request\'s id: sent twice, raised and charged once', () => {
  const { game } = makeGame();
  const { s, w } = seaCaptain(game, 'Once');
  const ship = s.ship!;
  ship.setArmy([{ u: 'deckhand', n: 20 }]);
  recordFallen(game, s, [{ u: 'deckhand', n: 10 }]);
  assert.equal(moor(game, s, w.id), null);
  const gold = s.profile!.gold;
  assert.equal(resurrect(game, s, 'deckhand', 'silver', 'same-rid-77'), null);
  recordFallen(game, s, [{ u: 'deckhand', n: 5 }]);
  assert.equal(resurrect(game, s, 'deckhand', 'silver', 'same-rid-77'), null);
  assert.equal(ship.crew, 30, 'raised once');
  assert.equal(s.profile!.gold, gold - resPrice('deckhand', 10).silver, 'charged once');
  assert.match(resurrect(game, s, 'deckhand', 'silver', 'bad id')!, /Not now/);
});

test('the quick «Воскресить» after a boarding: near a waystation the field surgeon\'s price, all at once; never in the fight', () => {
  const { game } = makeGame();
  const { s, w } = seaCaptain(game, 'Quick');
  const ship = s.ship!;
  at(game, s, w.x + 900, w.y + 300); // a boarding fought out of mooring reach, a waystation in sight
  ship.setArmy([{ u: 'marine', n: 12 }, { u: 'deckhand', n: 30 }]);
  ship.loseFrom('marine', 8);
  afterBattle(game, ship, -1, [{ u: 'marine', n: 8 }], TAC_WOUNDED, -1, [], true, false);
  const lost = 8 - Math.floor(8 * TAC_WOUNDED);
  assert.equal(resPlace(game, s), 'field');
  const v = resView(game, s);
  assert.equal(v.silver, resPrice('marine', lost, 'field').silver);
  ship.lastHitAt = game.now;
  assert.match(resurrect(game, s, undefined, 'silver', 'quick-rid-1')!, /under fire/, 'never in a fight');
  ship.lastHitAt = -1000;
  const gold = s.profile!.gold;
  assert.equal(resurrect(game, s, undefined, 'silver', 'quick-rid-2'), null);
  assert.equal(ship.army.find((x) => x.u === 'marine')!.n, 12);
  assert.equal(s.profile!.gold, gold - Math.ceil(lost * resSilverPer('marine') * FIELD_MUL - 1e-9));
  // And moored, the price as it stands (a quarter less).
  assert.ok(resPrice('marine', lost, 'way').silver < resPrice('marine', lost, 'field').silver);
});

test('the scrolls of resurrection: bought on the 290–9 900 ladder, one raises a stack free anywhere out of a fight; the infirmary at once for doubloons', () => {
  const { game, db } = makeGame();
  const { s } = seaCaptain(game, 'Scroll');
  const ship = s.ship!;
  at(game, s, 50_000, 36_000);
  assert.ok(creditPremium(game, s.accountId, 2000, 'admin', 'test') !== null);
  assert.equal(buyOffer(game, s, 'rs_290', 'scroll-pid-1'), null);
  assert.equal(shopState(game, s.accountId).rscrolls, 3);
  assert.equal(db.doubloons(s.accountId), 1710);
  ship.setArmy([{ u: 'marine', n: 10 }, { u: 'deckhand', n: 20 }]);
  recordFallen(game, s, [{ u: 'marine', n: 6 }, { u: 'deckhand', n: 9 }]);
  const gold = s.profile!.gold;
  assert.match(resurrect(game, s, undefined, 'scroll', 'scroll-rid-0')!, /one stack/);
  assert.equal(resurrect(game, s, 'marine', 'scroll', 'scroll-rid-1'), null);
  assert.equal(ship.army.find((x) => x.u === 'marine')!.n, 16);
  assert.equal(s.profile!.gold, gold, 'free of silver');
  assert.equal(shopState(game, s.accountId).rscrolls, 2);
  // The infirmary: the rest at once for doubloons, far from everything.
  const price = resView(game, s).instant;
  assert.ok(price >= 290);
  assert.equal(buyOffer(game, s, 'refill', 'refill-pid-1'), null);
  assert.equal(ship.army.find((x) => x.u === 'deckhand')!.n, 29);
  assert.equal(db.doubloons(s.accountId), 1710 - price);
  assert.equal(fallenOf(game, s).list.length, 0);
});

test('the hire at a waystation: a few kinds a day by its waters, silver only, the day\'s pool', () => {
  const { game } = makeGame();
  const { s, w } = seaCaptain(game, 'Hire');
  const ship = s.ship!;
  ship.setArmy([{ u: 'deckhand', n: 10 }]);
  assert.equal(wayDwellView(game, s), null, 'moored only');
  assert.equal(moor(game, s, w.id), null);
  const kinds = hireKinds(game, w);
  assert.ok(kinds.length >= 2 && kinds.length <= 3 && UNITS[kinds[0]].tier === 1, kinds.join());
  const v = wayDwellView(game, s)!;
  assert.equal(v.src, 'way');
  const gold = s.profile!.gold;
  assert.equal(wayRecruit(game, s, kinds[0], 5), null);
  assert.equal(ship.crew, 15);
  assert.ok(s.profile!.gold < gold);
  assert.equal(wayRecruit(game, s, kinds[0], 100), null, 'as many as the day keeps');
  assert.match(wayRecruit(game, s, kinds[0], 1)!, /today/);
});

// ------------------------------------------------------------------------------------------------ the economy

test('the economy: raising a won boarding\'s dead at a waystation is 5–30 % of an hour at sea and well under the hire (docs/35 balance note)', () => {
  for (const L of [3, 13, 23, 33, 43, 53]) {
    let res = 0, hire = 0, wins = 0;
    for (let i = 0; i < 8; i++) {
      const [a, b] = sidesAt(L, false, 'corsair', 'corsair', i);
      const run = playBoard(a, b, i * 37 + 5);
      if (run.winner !== 0) continue;
      wins++;
      const raise = Math.min(TAC_RAISE_MAX, (a.hero?.raise ?? 0) + TAC_WOUNDED);
      for (const x of lossesOf(run.end, 0)) {
        const k = x.n - Math.floor(x.n * raise);
        res += resPrice(x.u as UnitId, k, 'way').silver;
        hire += recruitPrice(x.u as UnitId, k, true).silver;
      }
    }
    assert.ok(wins >= 4, `L${L}: ${wins} of 8 won`);
    const per = res / wins, hour = seaHour(slOf(L));
    assert.ok(per / hour >= 0.03 && per / hour <= 0.35, `L${L}: ${Math.round(per)} silver a boarding, ${(per / hour).toFixed(2)} of a sea hour`);
    assert.ok(res <= hire * 0.5, `L${L}: raising ${Math.round(res)} against hiring ${Math.round(hire)}`);
    assert.ok(per * FIELD_MUL / (hour / KILLS_HOUR) < 2.5, `L${L}: the field price against a kill's income`);
  }
});
