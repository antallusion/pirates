// Forum post 40 (approved by the owner): two of a player's asks, server side.
//  1. «Пересесть» takes time: the berthed ship «плывёт к вам» from where she lay and comes in two minutes (as new colours
//     go up); the swap is made when she comes, if her captain is still in that harbour; casting off calls her back;
//     «Пересесть» again calls her off; saved with the captain; everything checked by the server, now and when she comes.
//  2. A bump costs her own hull: on the rocks (strike.ts, as it was) and against a peaceful ship under the neutral and the
//     city flags — by her way into it, a little; the other ship loses nothing and nobody is struck on the record: no
//     aggression, no skull, no infamy. Under the pirate flag a ram she meant stays a ram (and a skull).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BERTH_CALL_MS } from '../shared/src/data/berths.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { wantedLevel } from '../shared/src/data/factions.ts';
import { strikeDamage } from '../shared/src/sim/hull.ts';
import { BUMP_BITE } from '../server/src/game/bump.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import { startAutosail } from '../server/src/game/autosail.ts';
import { berthCallSecond, calledBerth, sanitizeShipbuilding } from '../server/src/game/shipbuilding.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession, Profile } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { duelSea, openWater } from './balance/duel.ts';
import { seaCaptain } from './balance/seafight.ts';
import type { FakeConn } from './helpers.ts';
import { berthArrives, join, knowHulls, makeGame, steps } from './helpers.ts';

// ------------------------------------------------------------------------------------------------ 1. the berth's two minutes

function withBerth(name: string): { game: Game; c: FakeConn; s: PlayerSession; db: ReturnType<typeof makeGame>['db']; wall: { t: number } } {
  const { game, db } = makeGame();
  const wall = { t: 1_900_000_000_000 };
  game.wallNow = () => wall.t;
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.level = 30;
  s.profile!.gold = 100_000;
  knowHulls(s.profile!);
  s.ship!.crew = 10;
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'cutter', keep: true });
  assert.equal(s.ship!.loadout.classId, 'cutter');
  assert.equal(s.profile!.berths[0].loadout.classId, 'sloop');
  return { game, c, s, db, wall };
}

test('«Пересесть» sends for her: she comes in two minutes, the countdown in her view, and the swap is made when she comes', () => {
  const { game, c, s, wall } = withBerth('Wait Wen');
  const p = s.profile!, ship = s.ship!;
  assert.equal(BERTH_CALL_MS, 120_000, 'two minutes, as the colours');
  c.push({ t: 'berth', action: 'swap', index: 0 });
  assert.equal(ship.loadout.classId, 'cutter', 'not yet: she is on her way');
  assert.ok(p.berthCall, 'sent for');
  assert.equal(p.berthCall!.at, wall.t + BERTH_CALL_MS);
  assert.match(c.last('toast')!.msg, /The Test Wake is warped round from her berth: she comes alongside in 2 min, if you are still in port\./);
  const view = c.last('self')!.self!.berthCall!;
  assert.deepEqual({ ...view }, { index: 0, name: p.berths[0].loadout.name, port: ship.docked, at: wall.t + BERTH_CALL_MS }, 'the countdown is the client’s');
  // a minute on: still coming
  wall.t += 60_000;
  steps(game, 20);
  assert.equal(ship.loadout.classId, 'cutter');
  // two minutes: alongside, and she is changed into
  wall.t += 61_000;
  steps(game, 20);
  assert.equal(ship.loadout.classId, 'sloop', 'she sails the berthed sloop');
  assert.equal(p.berths[0].loadout.classId, 'cutter', 'the cutter takes the berth');
  assert.equal(p.berthCall, null);
  assert.equal(c.last('self')!.self!.berthCall, null);
  assert.ok(c.all('toast').some((t) => /You take the Test Wake out of her berth\./.test(t.msg)));
});

test('casting off calls her back; «Пересесть» again calls her off; a ship on her way is not sold', () => {
  const { game, c, s, wall } = withBerth('Leave Lou');
  const p = s.profile!, ship = s.ship!;
  c.push({ t: 'berth', action: 'swap', index: 0 });
  c.push({ t: 'berth', action: 'sell', index: 0 });
  assert.match(c.last('toast')!.msg, /She is on her way to you: call her off first/);
  assert.equal(p.berths.length, 1, 'not sold');
  // «Отменить»: the same button again
  c.push({ t: 'berth', action: 'swap', index: 0 });
  assert.equal(p.berthCall, null, 'called off');
  assert.match(c.last('toast')!.msg, /goes back to her berth/);
  // sent for again, and she casts off before the ship comes
  c.push({ t: 'berth', action: 'swap', index: 0 });
  assert.ok(p.berthCall);
  c.push({ t: 'undock' });
  assert.equal(ship.docked, null);
  assert.equal(p.berthCall, null, 'the order struck');
  assert.ok(c.all('toast').some((t) => /You sailed before the Test Wake came: she goes back to her berth\./.test(t.msg)));
  wall.t += BERTH_CALL_MS * 2;
  steps(game, 20);
  assert.equal(ship.loadout.classId, 'cutter', 'nothing changed at sea');
});

test('a ship sent for from another harbour «плывёт к вам»; the server asks again when she comes (the hold grown meanwhile)', () => {
  const { game, c, s, wall } = withBerth('Far Fen');
  const p = s.profile!, ship = s.ship!;
  const home = ship.docked!;
  const far = game.world.ports.find((x) => x.shipyardTier > 0 && x.id !== home)!;
  ship.docked = far.id;
  p.docked = far.id;
  c.push({ t: 'berth', action: 'swap', index: 0 });
  assert.match(c.last('toast')!.msg, new RegExp(`The Test Wake sails to you from ${game.portById(home)!.name}: she comes in 2 min, if you are still in port\\.`));
  // her hold filled past the sloop's while she waited: refused when the ship comes, said why
  ship.cargo = { planks: 400 } as never;
  wall.t += BERTH_CALL_MS;
  berthCallSecond(game, s);
  assert.equal(ship.loadout.classId, 'cutter', 'refused');
  assert.equal(p.berthCall, null);
  assert.ok(c.all('toast').some((t) => /came, but you cannot change into her now/.test(t.msg)));
  assert.match(c.last('toast')!.msg, /Her hold takes \d+/);
  // a harbour with no yard refuses at once, as before
  const noYard = game.world.ports.find((x) => !(x.shipyardTier > 0));
  if (noYard) {
    ship.docked = noYard.id;
    p.docked = noYard.id;
    c.push({ t: 'berth', action: 'swap', index: 0 });
    assert.match(c.last('toast')!.msg, /No yard here/);
    assert.equal(p.berthCall, null);
  }
});

test('the ship on her way is saved with the captain (a reload keeps the clock) and found again if the berths changed', () => {
  const { game, c, s, db, wall } = withBerth('Save Sid');
  const p = s.profile!;
  c.push({ t: 'berth', action: 'swap', index: 0 });
  const at = p.berthCall!.at;
  game.saveSession(s);
  const saved = JSON.parse(db.loadCaptain(s.accountId)!.data) as Profile;
  assert.equal(saved.berthCall?.at, at, 'persisted');
  sanitizeShipbuilding(saved);
  assert.equal(saved.berthCall?.at, at, 'kept on load');
  // a berth before hers gone meanwhile: still hers, by her class and name
  p.berths.unshift({ port: p.berths[0].port, loadout: { ...p.berths[0].loadout, classId: 'cutter', name: 'Other' }, hull: 1 });
  assert.equal(calledBerth(p), 1);
  // a call naming no berth is dropped on load
  const stale = { ...saved, berths: [] } as Profile;
  sanitizeShipbuilding(stale);
  assert.equal(stale.berthCall, null);
  wall.t = at + 1;
  berthArrives(game, s);
  assert.equal(s.ship!.loadout.classId, 'sloop');
  assert.equal(p.berths[1].loadout.classId, 'cutter');
});

test('the berth call’s lines are Russian', () => {
  setLang('ru');
  try {
    for (const en of [
      'The Wake is warped round from her berth: she comes alongside in 2 min, if you are still in port.',
      'The Wake sails to you from Saltmarrow: she comes in 2 min, if you are still in port.',
      'The Wake goes back to her berth.',
      'You sailed before the Wake came: she goes back to her berth.',
      'The Wake came, but you cannot change into her now: she goes back to her berth.',
      '3 of your men will not fit her: send for her again.',
      'She is on her way to you: call her off first',
      'Bumped the Fat Merchant −12',
    ]) {
      const ru = serverText(en);
      assert.notEqual(ru, en, en);
      assert.doesNotMatch(ru.replace(/Wake|Saltmarrow|Fat Merchant/g, ''), /[a-z]{3}/i, ru);
    }
  } finally {
    setLang('en');
  }
});

// ------------------------------------------------------------------------------------------------ 2. a bump costs her own hull

function scene(flag: 'neutral' | 'faction' | 'pirate', k: number): { game: Game; s: PlayerSession; c: FakeConn; me: ShipEntity; merchant: ShipEntity } {
  const game = duelSea();
  const at = openWater(game, k);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  s.profile!.pvp.flag = flag;
  const me = s.ship!;
  const merchant = game.spawnNpcShip('merchant', 'fluyt', 'league', at.x, at.y - 30, 0);
  game.setNpcLevel(merchant, 5);
  merchant.state.speed = 0;
  merchant.input = { rudder: 0, sailTarget: 0 };
  game.npcs.get(merchant.id)!.keep = true;
  game.grid.upsert(merchant.id, merchant.state.x, merchant.state.y);
  const r = (Object.keys(REGIONS) as (keyof typeof REGIONS)[]).find((id) => REGIONS[id].safety === 'contested')!;
  me.region = r;
  merchant.region = r;
  return { game, s, c: s.conn as unknown as FakeConn, me, merchant };
}

/** She runs bow-on into the merchant at `way` of her top speed: her hull lost, the merchant's. */
function bump(flag: 'neutral' | 'faction' | 'pirate', way: number, k = 3): { lost: number; merchantLost: number; s: PlayerSession; game: Game; me: ShipEntity; merchant: ShipEntity; c: FakeConn } {
  const sc = scene(flag, k);
  const { game, me, merchant } = sc;
  me.state.heading = 0;
  me.state.speed = me.stats.maxSpeed * way;
  me.input = { rudder: 0, sailTarget: way };
  const h0 = me.hull, m0 = merchant.hull;
  steps(game, 20);
  return { ...sc, lost: h0 - me.hull, merchantLost: m0 - merchant.hull };
}

test('a bump into a peaceful ship under the neutral and the city flags: her own hull a little, by her way; none of the merchant’s; no aggression', () => {
  for (const flag of ['neutral', 'faction'] as const) {
    const full = bump(flag, 1);
    assert.ok(full.lost > 0, `${flag}: her hull pays`);
    assert.ok(full.lost < full.me.stats.hullMax * 0.12, `${flag}: a little (${(full.lost / full.me.stats.hullMax * 100).toFixed(1)}%)`);
    assert.equal(full.merchantLost, 0, `${flag}: the merchant loses nothing`);
    assert.equal(full.merchant.attackers.has(full.me.id), false, `${flag}: no blow on the record`);
    assert.equal(full.me.attackers.has(full.merchant.id), false);
    assert.equal(full.s.profile!.infamy, 0, `${flag}: no infamy, no skull`);
    assert.equal(npcHostileTo(full.game, full.merchant, full.me), false, `${flag}: the merchant takes no offence`);
    assert.ok(full.c.all('toast').some((t) => /^Bumped the .+ −\d+$/.test(t.msg)), `${flag}: one short line`);
    const slow = bump(flag, 0.55, 4);
    assert.ok(slow.lost < full.lost, `${flag}: slower, less (${slow.lost.toFixed(0)} < ${full.lost.toFixed(0)})`);
  }
  // the blow is the rocks' by her knots, at half their bite
  assert.equal(BUMP_BITE, 0.5);
  assert.ok(strikeDamage(10, BUMP_BITE, 1000, 1000) < strikeDamage(10, 1, 1000, 1000));
});

test('under the pirate flag a bump is a bump (her hull, no skull); a ram she meant is a ram and a skull, as before', () => {
  const b = bump('pirate', 1, 5);
  assert.ok(b.lost > 0);
  assert.equal(b.merchantLost, 0);
  assert.equal(b.s.profile!.infamy, 0, 'no skull from a bump');
  const sc = scene('pirate', 6);
  sc.me.addEffect({ id: 'ramming_speed', until: sc.game.now + 5 }, sc.game.now);
  sc.me.state.heading = 0;
  sc.me.state.speed = sc.me.stats.maxSpeed;
  const m0 = sc.merchant.hull;
  steps(sc.game, 20);
  assert.ok(sc.merchant.hull < m0, 'the ram lands');
  assert.equal(sc.merchant.attackers.has(sc.me.id), true, 'a ram she meant');
  assert.equal(wantedLevel(sc.s.profile!.infamy), 1, 'and a skull');
});

test('the rocks still cost her hull, by her way into them (strike.ts); a touch costs nothing', () => {
  const hm = 1000;
  assert.equal(strikeDamage(1, 1, hm, hm), 0, 'a touch');
  const half = strikeDamage(6, 1, hm, hm), full = strikeDamage(12, 1, hm, hm);
  assert.ok(half > 0 && full > half, `by her way: ${half.toFixed(0)} < ${full.toFixed(0)}`);
});

test('the helmsman still gives the ships on her course a berth: a course past an anchored merchant, no bump', () => {
  const sc = scene('faction', 7);
  const { game, me, merchant, s } = sc;
  // the merchant 200 m ahead on her line, lying to; the helmsman's course runs through her
  merchant.state.y = me.state.y - 200;
  game.npcs.delete(merchant.id);
  game.grid.upsert(merchant.id, merchant.state.x, merchant.state.y);
  me.state.heading = 0;
  assert.equal(startAutosail(game, s, me.state.x, me.state.y - 1500), null);
  const h0 = me.hull;
  let least = Infinity;
  for (let i = 0; i < 20 * 60; i++) {
    game.step();
    least = Math.min(least, Math.hypot(me.state.x - merchant.state.x, me.state.y - merchant.state.y));
  }
  assert.ok(least > (me.stats.length + merchant.stats.length) * 0.32, `kept off: ${least.toFixed(0)} m`);
  assert.equal(me.hull, h0, 'no bump');
});

// ------------------------------------------------------------------------------------------------ 3. the harbour's ring

test('the harbour’s ring: «Войти в порт», «Приблизиться», «Карточка порта», and «Мой остров» by her own island', async () => {
  const { portRingChoices } = await import('../client/src/ui/portring.ts');
  setLang('ru');
  try {
    assert.deepEqual(portRingChoices('Солтмарроу', false).map((c) => c.label.replace(/\s/g, ' ')),['Войти в порт', 'Приблизиться', 'Карточка порта']);
    const own = portRingChoices('Солтмарроу', true);
    assert.deepEqual(own.map((c) => c.id), ['enter', 'near', 'card', 'isle']);
    assert.equal(own[3].label.replace(/\s/g, ' '), 'Мой остров');
    assert.match(own[0].title, /Солтмарроу/);
  } finally {
    setLang('en');
  }
  assert.deepEqual(portRingChoices('Saltmarrow', true).map((c) => c.label), ['Enter port', 'Approach', 'Port card', 'My island']);
});
