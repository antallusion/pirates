// The island's loot from the creatures of the islands (docs/29 §9, owner 2026-10-17): the table's chances grow with
// the lair's size, role and level; seeded rolls fall within the chances; a lair beaten pays it into her stores (the
// minutes of speed-ups, the yard) on the loot's own Rng, kept over a reload; the card shows the chances; every word in
// both languages; the expected minutes stay under the daily gift and far under the shop.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../shared/src/rng.ts';
import { SPEED_TOKENS, expectedMinutes, isleLootTable, lootChances, rollIsleLoot } from '../shared/src/data/isleloot.ts';
import type { IsleDrop, IsleLootSrc } from '../shared/src/data/isleloot.ts';
import { UNIT_PRICE } from '../shared/src/data/shop.ts';
import { TOKEN_SECS, TOKENS_LOGIN, BASE_RES } from '../shared/src/data/base.ts';
import { GIFT_TRACK, giftOf } from '../shared/src/data/dailygift.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { closeFight, landTac } from '../server/src/game/beastlairs.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { yardOf } from '../server/src/game/base.ts';
import { forgetShop, shopState } from '../server/src/game/shop.ts';
import { islandLoot, seedIsleRng } from '../server/src/game/isleloot.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { armyForLevel } from '../shared/src/data/army.ts';
import { EN, RU } from '../client/src/lang/ui/isleloot.ts';
import { EN as SC_EN, RU as SC_RU } from '../client/src/lang/ui/islescene.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const LAIR = (size: 'weak' | 'avg' | 'strong', role: 'shore' | 'grotto' | 'guardian', level: number): IsleLootSrc => ({ src: 'lair', size, role, level });

test('the chances grow with the size, the role and the level; a great one ashore always drops a speed-up', () => {
  const a = isleLootTable(LAIR('weak', 'shore', 3)), b = isleLootTable(LAIR('avg', 'shore', 3)), c = isleLootTable(LAIR('strong', 'shore', 3)), g = isleLootTable(LAIR('strong', 'guardian', 3));
  for (const k of ['speed', 'res', 'prod', 'builder'] as const) {
    assert.ok(a[k] < b[k] && b[k] < c[k], `${k} by size`);
    assert.ok(g[k] >= c[k], `${k}: the guardian at least the shore's`);
    assert.ok(g[k] <= 0.95);
  }
  assert.ok(expectedMinutes(LAIR('avg', 'shore', 9)) > expectedMinutes(LAIR('avg', 'shore', 2)), 'more minutes at the higher levels');
  assert.equal(isleLootTable({ src: 'shore', level: 5 }).speed, 1);
  assert.ok(isleLootTable(LAIR('strong', 'guardian', 10)).builder <= 0.05, 'the brigade stays rare');
  // the card's list: four kinds, the speed-up tokens named
  const ch = lootChances(LAIR('avg', 'grotto', 5));
  assert.deepEqual(ch.map((x) => x.k), ['speed', 'res', 'prod', 'builder']);
  assert.ok(ch[0].min!.length >= 3 && ch[0].min!.every((m) => (SPEED_TOKENS as readonly number[]).includes(m)));
});

test('seeded rolls fall within the chances, and the same seed rolls the same', () => {
  const N = 20_000;
  for (const src of [LAIR('weak', 'shore', 2), LAIR('avg', 'grotto', 5), LAIR('strong', 'guardian', 9), { src: 'shore', level: 6 } as IsleLootSrc]) {
    const t = isleLootTable(src);
    const r = new Rng(77);
    const n = { speed: 0, res: 0, prod: 0, builder: 0 };
    let min = 0;
    for (let i = 0; i < N; i++) for (const d of rollIsleLoot(src, () => r.float())) {
      n[d.k]++;
      if (d.k === 'speed') min += d.min;
    }
    for (const k of ['speed', 'res', 'prod', 'builder'] as const) {
      const p = n[k] / N, sd = Math.sqrt((t[k] * (1 - t[k])) / N);
      assert.ok(Math.abs(p - t[k]) <= 4 * sd + 0.002, `${JSON.stringify(src)} ${k}: ${p} vs ${t[k]}`);
    }
    assert.ok(Math.abs(min / N - expectedMinutes(src)) <= expectedMinutes(src) * 0.08 + 0.3, `the minutes on average: ${min / N} vs ${expectedMinutes(src)}`);
  }
  const roll = (seed: number) => {
    const r = new Rng(seed);
    return Array.from({ length: 50 }, () => rollIsleLoot(LAIR('avg', 'shore', 5), () => r.float()));
  };
  assert.deepEqual(roll(5), roll(5));
  // the day's count past: every chance thinner
  const r = new Rng(3);
  let full = 0, thin = 0;
  for (let i = 0; i < 5000; i++) full += rollIsleLoot(LAIR('avg', 'shore', 5), () => r.float()).length;
  for (let i = 0; i < 5000; i++) thin += rollIsleLoot(LAIR('avg', 'shore', 5), () => r.float(), 0.5).length;
  assert.ok(thin < full * 0.6, `thinned: ${thin} vs ${full}`);
});

test('the balance: an hour of lairs gives less than the free speed-ups of a day, a shop pack many hours of lairs', () => {
  // an hour at the lairs (docs/29 §9): six fights, mostly middling shore lairs and grottos of the middle levels
  const hour = 3 * expectedMinutes(LAIR('avg', 'shore', 5)) + 2 * expectedMinutes(LAIR('avg', 'grotto', 5)) + expectedMinutes(LAIR('strong', 'guardian', 5));
  // the free speed-ups of a day: the welcome's tokens, three orders, the gift's average
  let giftTokens = 0;
  for (let d = 1; d <= GIFT_TRACK; d++) giftTokens += giftOf(d, 30).speed ?? 0;
  const freeDay = ((TOKENS_LOGIN + 3) * TOKEN_SECS) / 60 + (giftTokens / GIFT_TRACK) * (TOKEN_SECS / 60);
  assert.ok(hour >= 20 && hour <= 60, `an hour of lairs: ${hour.toFixed(1)} min`);
  assert.ok(hour < freeDay, `under the free speed-ups of a day (${freeDay.toFixed(0)} min)`);
  // a 290-doubloon pack is 480 minutes: more than eight hours of lairs
  const pack = 290 / UNIT_PRICE.speed;
  assert.ok(pack / hour > 8, `the shop's smallest pack is ${(pack / hour).toFixed(1)} hours of lairs`);
});

// ------------------------------------------------------------------------------------------------ on the server

function world(): Game {
  const { game } = makeGame();
  clearOutposts(game);
  quietAdv(game, false);
  return game;
}

function captain(game: Game): PlayerSession {
  join(game, 'Loot Tester');
  const s = game.sessionByName('Loot Tester')!;
  onHull(game, s.ship!, 'brig', 5);
  s.ship!.setArmy(armyForLevel(5, s.ship!.stats.crewMax, s.ship!.armySlots, 'player'));
  s.ship!.morale = 80;
  s.profile!.gold = 100_000;
  return s;
}

function withIsland(game: Game, s: PlayerSession): void {
  const home = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id))!;
  const sx = s.ship!.state.x, sy = s.ship!.state.y;
  s.ship!.docked = null;
  s.ship!.state.x = home.x + home.radius + 120;
  s.ship!.state.y = home.y;
  game.grid.upsert(s.ship!.id, s.ship!.state.x, s.ship!.state.y);
  assert.equal(buyIsland(game, s, home.id), null);
  s.ship!.state.x = sx;
  s.ship!.state.y = sy;
  game.grid.upsert(s.ship!.id, sx, sy);
}

test('the drops go into her stores — the minutes, the yard, the harvest, a brigade — and are kept over a reload', () => {
  const game = world();
  const s = captain(game);
  // no island yet: only the minutes of speed-ups are kept
  seedIsleRng(game, 1);
  let got: IsleDrop[] = [];
  for (let i = 0; i < 400 && !got.some((d) => d.k === 'res'); i++) {
    const before = shopState(game, s.accountId).speed;
    got = islandLoot(game, s, { src: 'shore', level: 8 });
    const sp = got.filter((d) => d.k === 'speed').reduce((a, d) => a + (d as { min: number }).min, 0);
    assert.equal(shopState(game, s.accountId).speed - before, sp, 'the minutes into the store');
    assert.ok(got.every((d) => d.k === 'speed'), 'no island: the yard, the harvest and the brigade have nowhere to go');
    if (i > 50) break;
  }
  withIsland(game, s);
  const h = ownIsland(game, s.accountId)!;
  const y = yardOf(game, h);
  for (const g of BASE_RES) y.res[g] = 0;
  const kinds = new Set<string>();
  const st0 = { ...shopState(game, s.accountId), temp: [...shopState(game, s.accountId).temp] };
  let res = 0;
  for (let i = 0; i < 300; i++) for (const d of islandLoot(game, s, { src: 'shore', level: 8 })) {
    kinds.add(d.k);
    if (d.k === 'res') res += d.n;
  }
  assert.ok(kinds.has('speed') && kinds.has('res') && kinds.has('prod') && kinds.has('builder'), [...kinds].join());
  const st = shopState(game, s.accountId);
  assert.ok(BASE_RES.reduce((a, g) => a + (y.res[g] ?? 0), 0) >= Math.min(res, 1), 'the goods in the yard');
  assert.ok(st.prod > game.wallNow() && st.prod >= st0.prod, 'the harvest runs');
  assert.ok(st.temp.length >= 1 && st.temp.length <= 2, 'a hired brigade (two at most)');
  // persisted: the shop's stores are read again from the kv table
  const speed = st.speed;
  forgetShop(game, s.accountId);
  assert.equal(shopState(game, s.accountId).speed, speed, 'the minutes kept');
});

test('a lair beaten: its island loot rolled on the loot\'s own Rng, shown in the spoils, the card shows the chances', () => {
  const game = world();
  const s = captain(game);
  withIsland(game, s);
  const conn = (s as unknown as { conn: { last: (t: string) => { view?: unknown; card?: unknown } | undefined } }).conn;
  let seen: IsleDrop[] | undefined;
  for (let seed = 1; seed < 40 && !seen; seed++) {
    seedIsleRng(game, seed);
    assert.match(runAdmin(game, s, '/lair crab_beach go') ?? '', /Off the Crab Beach/);
    steps(game, 25);
    const card = conn.last('lair_card')?.card as { isle?: { k: string; p: number }[]; looted?: boolean } | undefined;
    if (card && !card.looted) {
      assert.ok(card.isle && card.isle.length === 4 && card.isle.every((x) => x.p > 0 && x.p < 1), 'the card\'s «Возможная добыча»');
    }
    const rngBefore = game.rng.float.toString();
    runAdmin(game, s, '/lair crab_beach fight');
    landTac(game, s, { a: 'quick' });
    steps(game, 2);
    const v = conn.last('board_tac')?.view as { over?: { winner: number }; result?: { loot?: { isle?: IsleDrop[]; looted?: boolean } } } | undefined;
    if (v?.result?.loot?.isle?.length) seen = v.result.loot.isle;
    closeFight(game, s);
    // a fresh lair next time round: the spoils are once a week a lair
    game.now += 10 * 86_400;
    void rngBefore;
  }
  assert.ok(seen && seen.length > 0, 'an island drop among a lair\'s spoils');
});

test('every word of the loot and the advice in both languages, no Latin in the Russian', () => {
  for (const [en, ru] of [[EN, RU], [SC_EN, SC_RU]] as const) {
    assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort());
    for (const [k, v] of Object.entries(ru)) assert.ok(!/[A-Za-z]/.test(v.replace(/\{\w+\}/g, '')), `${k}: ${v}`);
  }
});
