// «Переход» between hub ports (owner, 2026-10-30, Нефигугум's post 22 in forum topic 7): server/src/game/ferry.ts.
// The price, the cooldown, refusal outside a hub, the trip ×10 and the arrival in the other hub, the generic far
// voyage still off.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICK_RATE } from '../shared/src/constants.ts';
import { FERRY_COOLDOWN_SEC, FERRY_HOLD_MAX, FERRY_HUBS, FERRY_MIN, FERRY_TOP, ferryPrice } from '../shared/src/data/ferry.ts';
import { VOYAGE, VOYAGE_MUL } from '../shared/src/data/passage.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { autosailOf } from '../server/src/game/autosail.ts';
import { FERRY_WORDS, ferryBound, ferryCost, ferryGo, ferryLeft, ferryView } from '../server/src/game/ferry.ts';
import { untouchable } from '../server/src/game/inbattle.ts';
import { finishVoyage, voyageOf, voyageSpeed, voyaging } from '../server/src/game/passage.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame } from './helpers.ts';

function captain(name: string, at = 'gravesend'): { game: Game; s: PlayerSession; c: FakeConn } {
  const { game } = makeGame();
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  dockAt(game, s, at);
  s.profile!.gold = 100_000;
  // (a light hold: a passage takes a ship at most 60% laden)
  s.ship!.cargo = {} as NonNullable<typeof s.ship>["cargo"];
  return { game, s, c };
}

function dockAt(game: Game, s: PlayerSession, id: string): void {
  const port = game.portById(id)!;
  s.ship!.docked = port.id;
  s.profile!.docked = port.id;
  s.ship!.state.x = port.x;
  s.ship!.state.y = port.y;
  game.grid.upsert(s.ship!.id, port.x, port.y);
}

function beat(game: Game, s: PlayerSession, c: FakeConn, i: number): void {
  if (i % 5) return;
  s.msgCount = 0;
  c.push({ t: 'input', rudder: 0, sail: 4, seq: 10_000 + i });
}

test('ferry: 6–8 hubs, in the law\'s and the trade\'s seas only, spread over the map', () => {
  const { game } = makeGame();
  assert.ok(FERRY_HUBS.length >= 6 && FERRY_HUBS.length <= 8);
  const regions = new Set<string>();
  for (const id of FERRY_HUBS) {
    const p = game.portById(id);
    assert.ok(p, `${id} is a port`);
    assert.notEqual(REGIONS[p!.region].safety, 'lawless', `${id} not in lawless waters`);
    regions.add(p!.region);
  }
  assert.ok(regions.size >= 4, 'every sea of the law and the trade has one');
});

test('ferry: the price — steep with distance: the nearest hubs about 1 700, across the whole sea 50 000', () => {
  assert.equal(ferryPrice(0), FERRY_MIN);
  assert.equal(ferryPrice(1_000_000), FERRY_TOP);
  assert.ok(ferryPrice(40_000) > ferryPrice(20_000), 'rises with the way');
  const { game } = makeGame();
  let lo = Infinity, hi = 0;
  for (const a of FERRY_HUBS) for (const b of FERRY_HUBS) {
    if (a === b) continue;
    const c = ferryCost(game, a, b)!;
    lo = Math.min(lo, c);
    hi = Math.max(hi, c);
    assert.equal(c, ferryCost(game, b, a), 'the same both ways');
  }
  assert.ok(lo >= 1_500 && lo <= 2_000, `the nearest ${lo}`);
  assert.ok(hi >= 49_000 && hi <= FERRY_TOP, `the farthest ${hi}`);
  assert.equal(ferryCost(game, 'gravesend', 'gravesend'), null);
  assert.equal(ferryCost(game, 'gravesend', 'cinderhold'), null, 'not a hub');
});

test('ferry: refused outside a hub, to a port not a hub, without the silver, in a fight; nothing paid', () => {
  const { game, s } = captain('Ferry Nohub', 'saltmarrow');
  assert.equal(ferryGo(game, s, 'hollowmere'), FERRY_WORDS.notHub);
  assert.equal(ferryView(game, s, 'saltmarrow'), null, 'no «Переход» there');
  dockAt(game, s, 'gravesend');
  assert.equal(ferryGo(game, s, 'cinderhold'), FERRY_WORDS.badTo);
  assert.equal(ferryGo(game, s, 'gravesend'), FERRY_WORDS.badTo);
  s.profile!.gold = 10;
  assert.match(ferryGo(game, s, 'hollowmere')!, /costs \d+ silver/);
  s.profile!.gold = 100_000;
  s.profile!.infamy = 500;
  assert.equal(ferryGo(game, s, 'hollowmere'), FERRY_WORDS.wanted);
  s.profile!.infamy = 0;
  // a laden hold (more than 60% full) is refused (owner, 2026-10-30)
  const keep = s.ship!.cargo;
  s.ship!.cargo = { timber: Math.ceil(s.ship!.stats.holdVolume * (FERRY_HOLD_MAX + 0.1)) } as typeof keep;
  assert.equal(ferryGo(game, s, 'hollowmere'), FERRY_WORDS.laden);
  s.ship!.cargo = keep;
  assert.equal(s.ship!.docked, 'gravesend', 'still in port');
  assert.equal(s.profile!.gold, 100_000, 'nothing paid');
});

test('ferry: the trip — paid, ×10 at once, untouchable, in at the other hub; the cooldown kept an hour', () => {
  assert.equal(VOYAGE.on, false, 'the generic far voyage stays off');
  const { game, s, c } = captain('Ferry Rider', 'gravesend');
  const ship = s.ship!;
  const view = ferryView(game, s, 'gravesend')!;
  const route = view.routes.find((r) => r.to === 'hollowmere')!;
  assert.ok(route && route.price === ferryCost(game, 'gravesend', 'hollowmere'));
  assert.equal(view.why, null);
  assert.equal(ferryGo(game, s, 'hollowmere'), null);
  assert.equal(s.profile!.gold, 100_000 - route.price, 'paid');
  assert.ok(voyaging(ship), 'the passage at once');
  assert.ok(!ship.docked);
  assert.equal(voyageOf(ship)!.v, voyageSpeed(ship));
  assert.equal(VOYAGE_MUL, 10);
  assert.ok(untouchable(game, ship), 'out of everyone\'s reach');
  const on = c.last('voyage') as { on: boolean; ferry?: string };
  assert.ok(on.on && on.ferry === 'hollowmere', 'her screen told where to');
  assert.equal(ferryBound(game, s), 'hollowmere');
  // a second trip is refused: the cooldown
  assert.ok(ferryLeft(game, s) > FERRY_COOLDOWN_SEC - 5);
  // carried there
  let i = 0;
  for (; i < 900 * TICK_RATE && !ship.docked; i++) {
    beat(game, s, c, i);
    game.step();
  }
  assert.equal(ship.docked, 'hollowmere', `put in at the other hub (${Math.round(i / TICK_RATE)} s)`);
  assert.ok(i / TICK_RATE < 600, `under ten minutes (${Math.round(i / TICK_RATE)} s)`);
  const off = c.all('voyage').filter((m) => !(m as { on: boolean }).on).at(-1) as { why: string; ferry?: string };
  assert.equal(off.why, 'arrived');
  assert.equal(off.ferry, 'hollowmere');
  // the cooldown, then free again
  assert.match(ferryGo(game, s, 'gravesend')!, /next passage in (5\d|60) min/);
  assert.equal(s.ship!.docked, 'hollowmere');
  const skew = (game as unknown as { wallSkew: number });
  skew.wallSkew = (skew.wallSkew ?? 0) + FERRY_COOLDOWN_SEC * 1000;
  assert.equal(ferryLeft(game, s), 0);
  assert.equal(ferryView(game, s, 'hollowmere')!.why, null, 'free to go again');
});

test('ferry: the cooldown survives a reload (kept in her save)', () => {
  const { game, s } = captain('Ferry Saver', 'fogmouth');
  assert.equal(ferryGo(game, s, 'widows_wick'), null);
  const saved = JSON.parse(JSON.stringify(s.profile)) as { ferryAt?: number };
  assert.ok(saved.ferryAt && saved.ferryAt <= game.wallNow());
});

test('ferry: every hub-to-hub route has open water from the harbour mouth (the planner finds it)', () => {
  const { game } = makeGame();
  for (const from of FERRY_HUBS) {
    const name = `Ferry ${from.slice(0, 8)}`;
    const c = join(game, name);
    const s = game.sessionByName(name)!;
    for (const to of FERRY_HUBS) {
      if (to === from) continue;
      dockAt(game, s, from);
      s.profile!.gold = 100_000;
      s.profile!.ferryAt = 0;
      s.ship!.cargo = {} as NonNullable<typeof s.ship>['cargo'];
      assert.equal(ferryGo(game, s, to), null, `${from} → ${to}`);
      assert.ok(voyaging(s.ship!), `${from} → ${to} carried`);
      const v = voyageOf(s.ship!)!;
      assert.ok(v.left > 1000);
      assert.ok(autosailOf(s.ship!));
      // (put at its end, and into port for the next: the trip itself is tested above)
      finishVoyage(game, s.ship!);
    }
    void c;
  }
});
