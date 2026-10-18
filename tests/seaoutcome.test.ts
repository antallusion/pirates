// Owner, 2026-10-18: a ship of the sea beaten — two choices only (shared/src/data/outcome.ts) — one like her put back at
// once elsewhere (server/src/game/density.ts), and the ceasefire talks with the ships attacking her and every check that
// the ship paid really stops (server/src/game/ceasefire.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_CREW, RELEASE_SILVER, SCUTTLE_SINK_SEC, SINK_CREW, wreckTimber } from '../shared/src/data/outcome.ts';
import { REFUSED_SEC, TALK_COOLDOWN, TRUCE_SEC, TRUCE_SHARE, refuseChance, trucePrice } from '../shared/src/data/ceasefire.ts';
import type { CeasefireView } from '../shared/src/data/ceasefire.ts';
import { SF } from '../shared/src/protocol.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { isLand, nearHarbour, regionAt } from '../shared/src/world/worldgen.ts';
import { claimPrize, startBoarding } from '../server/src/game/boarding.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { HARBOUR_CLEAR, WORLD_SIGHT_R, replaceDefeated, replaced } from '../server/src/game/density.ts';
import { attackersOf, negotiate, quote, resetTalks, truceHolds } from '../server/src/game/ceasefire.ts';
import { npcHostileTo } from '../server/src/game/npc.ts';
import { NEAR_R, localTraffic, stepTraffic } from '../server/src/game/traffic.ts';
import { TWO_CHOICES } from '../server/src/game/Game.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame } from './helpers.ts';

/** Open water near (x, y). */
function water(game: Game, x: number, y: number): { x: number; y: number } {
  for (let r = 0; r < 6000; r += 150) {
    for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a * 0.39) * r, py = y + Math.sin(a * 0.39) * r;
      if (!isLand(game.world, px, py) && !isLand(game.world, px + 120, py) && !isLand(game.world, px - 120, py) && !isLand(game.world, px, py + 120) && !isLand(game.world, px, py - 120) && !nearHarbour(game.world, px, py, 2500)) return { x: px, y: py };
    }
  }
  throw new Error('no water');
}

function captain(game: Game, name: string, at: { x: number; y: number }): { c: FakeConn; s: PlayerSession; ship: ShipEntity } {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  const ship = s.ship!;
  Object.assign(ship.state, { x: at.x, y: at.y, heading: 0, speed: 0 });
  ship.region = regionAt(game.world, at.x, at.y);
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, at.x, at.y);
  return { c, s, ship };
}

function npcAt(game: Game, role: 'pirate' | 'merchant' | 'patrol', x: number, y: number, level = 3): ShipEntity {
  const npc = game.spawnNpcShip(role, 'brig', role === 'pirate' ? 'confederacy' : 'league', x, y, 0);
  game.setNpcLevel(npc, level);
  npc.region = regionAt(game.world, x, y);
  const b = game.npcs.get(npc.id)!;
  b.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  game.grid.upsert(npc.id, x, y);
  return npc;
}

/** She beat `npc` (as a boarding won, careful: nothing lost): the card with the two choices. */
function beat(game: Game, ship: ShipEntity, npc: ShipEntity, c: FakeConn) {
  claimPrize(game, ship, npc, 0, 0, 0, 'careful');
  return c.last('boarding')!.result;
}

// ------------------------------------------------------------------ the two choices

test('the card of a ship of the sea beaten: two choices with their numbers, no ransom, prize crew or trophy', () => {
  const { game } = makeGame();
  const at = water(game, 30000, 80000);
  const { c, s, ship } = captain(game, 'Two Ways', at);
  ship.crew = Math.max(1, ship.stats.crewMax - 30);
  const npc = npcAt(game, 'merchant', at.x + 60, at.y);
  npc.crew = 40;
  npc.purse = 500;
  npc.cargo = { rum: 6 };
  const r = beat(game, ship, npc, c);
  assert.ok(r && r.npc && r.outcome, 'the card');
  assert.equal(r.prize, null);
  assert.equal(r.ransom, 0);
  assert.ok(!r.trophy);
  assert.equal(r.outcome!.sink.silver, 500);
  assert.equal(r.outcome!.sink.take, 6);
  assert.equal(r.outcome!.sink.timber, wreckTimber(npc.cls.tier));
  assert.equal(r.outcome!.sink.crew, Math.floor(npc.crew * SINK_CREW));
  assert.equal(r.outcome!.release.crew, Math.floor(npc.crew * RELEASE_CREW));
  assert.equal(r.outcome!.release.silver, Math.round(500 * RELEASE_SILVER));
  assert.ok(r.outcome!.release.crew > r.outcome!.sink.crew, '(B) brings more men');
  assert.ok(r.outcome!.release.silver < r.outcome!.sink.silver, '(B) less silver');
  // Any other fate is refused, the card stays open.
  for (const fate of ['ransom', 'prize', 'trophy'] as const) {
    c.push({ t: 'loot_take', take: {}, fate });
    assert.equal(c.last('toast')!.msg, TWO_CHOICES);
    assert.ok(s.pendingBoarding, `${fate}: the choice still to make`);
  }
});

test('(A) take all and sink her: her hold as fits, her purse, a share of her men; she goes down at once; her wreck at once, hers alone, with timber and what did not fit', () => {
  const { game } = makeGame();
  const at = water(game, 30000, 80000);
  const { c, s, ship } = captain(game, 'Scuttler', at);
  const other = captain(game, 'Onlooker', { x: at.x + 200, y: at.y + 200 });
  ship.crew = Math.max(1, ship.stats.crewMax - 30);
  const crew0 = ship.crew;
  // Her hold nearly full: room for 10 units of rum (a unit's volume each), the rest stays in the wreck.
  const room = 10;
  ship.cargo = { iron: Math.max(0, Math.floor(ship.stats.holdVolume - room)) };
  const used = (game as unknown as { holdFit: (a: ShipEntity, c: object) => Record<string, number> }).holdFit(ship, { rum: 1000 }).rum ?? 0;
  const npc = npcAt(game, 'merchant', at.x + 60, at.y);
  npc.crew = 40;
  npc.purse = 400;
  npc.cargo = { rum: 30 };
  const gold0 = s.profile!.gold;
  beat(game, ship, npc, c);
  c.push({ t: 'loot_take', take: {}, fate: 'sink' });
  assert.equal(ship.cargo.rum, Math.min(30, used), 'her rum as far as the hold goes');
  assert.ok(s.profile!.gold > gold0 + 400 * 0.5, `her purse (the crew's share off): ${s.profile!.gold - gold0}`);
  assert.equal(ship.crew - crew0, Math.floor(40 * SINK_CREW), 'a share of her men');
  assert.ok(npc.sinkingUntil > 0 && npc.sinkingUntil <= game.now + SCUTTLE_SINK_SEC + 1e-9, 'she goes down at once');
  const wrecks = [...game.loot.values()].filter((l) => Math.hypot(l.x - npc.state.x, l.y - npc.state.y) < 1);
  assert.equal(wrecks.length, 1, 'one wreck, not a second from the sinking');
  const w = wrecks[0];
  assert.equal(w.ownerOnly, s.accountId, 'hers alone');
  assert.ok((w.cargo.timber ?? 0) >= wreckTimber(npc.cls.tier) && (w.cargo.planks ?? 0) > 0, 'timber and planks');
  assert.equal(w.cargo.rum, 30 - (ship.cargo.rum ?? 0), 'what did not fit');
  // The onlooker never sees it; she picks it up.
  other.c.inbox.length = 0;
  for (let i = 0; i < 6; i++) game.step();
  assert.ok(!other.c.all('snap').some((m) => m.loot.some((l) => l[0] === w.id)), 'nobody else sees it');
  for (let i = 0; i < 20 * 3; i++) game.step();
  assert.ok(!game.ships.has(npc.id), 'gone under');
});

test('(B) take her crew and let her go: more of her men, a little of her purse, no cargo; gone at once', () => {
  const { game } = makeGame();
  const at = water(game, 30000, 80000);
  const { c, s, ship } = captain(game, 'Merciful', at);
  ship.crew = Math.max(1, ship.stats.crewMax - 30);
  const crew0 = ship.crew;
  const npc = npcAt(game, 'merchant', at.x + 60, at.y);
  npc.crew = 40;
  npc.purse = 1000;
  npc.cargo = { rum: 30 };
  const gold0 = s.profile!.gold;
  const loot0 = game.loot.size;
  beat(game, ship, npc, c);
  c.push({ t: 'loot_take', take: { rum: 30 }, fate: 'release' });
  assert.equal(ship.crew - crew0, Math.floor(40 * RELEASE_CREW), 'her men');
  const got = s.profile!.gold - gold0;
  assert.ok(got > 0 && got <= 1000 * RELEASE_SILVER, `a little silver: ${got}`);
  assert.ok(!ship.cargo.rum, 'no cargo');
  assert.ok(!game.ships.has(npc.id) && !game.npcs.has(npc.id), 'gone at once');
  assert.equal(game.loot.size, loot0, 'no wreck');
  assert.equal(s.pendingBoarding, null);
});

test('the hammocks bound the men who join; a cruel officer takes none', () => {
  const { game } = makeGame();
  const at = water(game, 30000, 80000);
  const { c, ship } = captain(game, 'Full Decks', at);
  ship.crew = ship.stats.crewMax - 2;
  const npc = npcAt(game, 'merchant', at.x + 60, at.y);
  npc.crew = 60;
  beat(game, ship, npc, c);
  c.push({ t: 'loot_take', take: {}, fate: 'release' });
  assert.equal(ship.crew, ship.stats.crewMax, 'two hammocks, two men');
});

// ------------------------------------------------------------------ one like her, elsewhere

test('one like her put back at once: a ship of the zone in her own region out of every captain\'s sight, clear of the harbours, her role and level', () => {
  const { game } = makeGame();
  game.directorOn = true;
  const at = water(game, REGIONS.gravewater.center[0], REGIONS.gravewater.center[1]);
  const { c, ship } = captain(game, 'Farmer', at);
  const npc = npcAt(game, 'pirate', at.x + 60, at.y, 4);
  const before = replaced.get(game)?.world ?? 0;
  const ids = new Set(game.ships.keys());
  beat(game, ship, npc, c);
  c.push({ t: 'loot_take', take: {}, fate: 'release' });
  const fresh = [...game.ships.values()].filter((o) => !ids.has(o.id) && o.npcRole);
  assert.equal(fresh.length, 1, 'one put back');
  const r = fresh[0];
  assert.equal((replaced.get(game)?.world ?? 0) - before, 1);
  assert.equal(r.npcRole, 'pirate');
  assert.equal(r.region, npc.region, 'in her own region');
  assert.ok(Math.abs(r.shipLevel - 4) <= 1, `her level (${r.shipLevel})`);
  assert.ok(Math.hypot(r.state.x - ship.state.x, r.state.y - ship.state.y) >= WORLD_SIGHT_R, 'out of sight');
  assert.ok(!nearHarbour(game.world, r.state.x, r.state.y, HARBOUR_CLEAR) && !isLand(game.world, r.state.x, r.state.y), 'on open water, clear of the harbours');
  assert.ok(!localTraffic(game).has(r.id), 'a ship of the zone, as she was');
});

test('a captain\'s traffic beaten (sunk by the guns too) is put back by her ring on the next second, her role and level, if the ring is short; not the named, not with the director still', () => {
  const { game } = makeGame();
  game.directorOn = true;
  const at = water(game, REGIONS.gravewater.center[0], REGIONS.gravewater.center[1]);
  const { ship } = captain(game, 'Ringer', at);
  const npc = npcAt(game, 'merchant', at.x + 300, at.y, 3);
  localTraffic(game).add(npc.id);
  npc.attackers.set(ship.id, game.now);
  game.setNpcLevel(npc, 3);
  const ids = new Set(game.ships.keys());
  game.beginSinking(npc);
  assert.equal([...game.ships.values()].filter((o) => !ids.has(o.id) && o.npcRole).length, 0, 'nothing on top of the ring' + "'" + 's own');
  stepTraffic(game); // the next second, whatever her turn
  const fresh = [...game.ships.values()].filter((o) => !ids.has(o.id) && o.npcRole && localTraffic(game).has(o.id));
  assert.ok(fresh.length >= 1, 'her ring, short, tops up at once');
  const r = fresh[0];
  const d = Math.hypot(r.state.x - ship.state.x, r.state.y - ship.state.y);
  assert.ok(d >= 1000 && d <= NEAR_R, `on her near ring, beyond her screen (${Math.round(d)} m)`);
  assert.equal(r.npcRole, 'merchant', 'one like her');
  assert.ok(Math.abs(r.shipLevel - 3) <= 1, `her level (${r.shipLevel})`);
  // The named are their own; a still director puts back nothing.
  const named = npcAt(game, 'pirate', at.x + 400, at.y);
  named.named = 'nemesis';
  assert.equal(replaceDefeated(game, named), null);
  game.directorOn = false;
  assert.equal(replaceDefeated(game, npcAt(game, 'pirate', at.x + 500, at.y)), null);
});

// ------------------------------------------------------------------ the ceasefire

/** Two raiders on her in contested water (the law's patrol none). */
function underFire(name: string, lawless = false) {
  const { game } = makeGame();
  const c0 = lawless ? REGIONS.dead_mans_expanse.center : REGIONS.gravewater.center;
  const at = water(game, c0[0], c0[1]);
  const cap = captain(game, name, at);
  const p = cap.s.profile!;
  p.gold = 2000;
  cap.ship.cargo = { rum: 10 }; // the hold at base prices
  const a = npcAt(game, 'pirate', at.x + 500, at.y, 3);
  const b = npcAt(game, 'pirate', at.x - 500, at.y, 3);
  for (const n of [a, b]) {
    game.npcs.get(n.id)!.target = cap.ship.id;
    cap.ship.attackers.set(n.id, game.now);
  }
  return { game, ...cap, a, b };
}

test('the talks: the ships firing on her, each at 15% of what she carries, the total; paid only by those who agree', () => {
  const { game, s, ship, a, b } = underFire('Talker');
  const carried = 2000 + 10 * 34; // her silver and her rum at base price
  const v = quote(game, s, a.id) as CeasefireView;
  assert.equal(typeof v, 'object');
  assert.deepEqual(v.ships.map((x) => x.id), [a.id, b.id], 'the one she tapped first, then the rest');
  const price = trucePrice(v.silver + v.cargo);
  assert.equal(price, Math.round((v.silver + v.cargo) * TRUCE_SHARE));
  assert.ok(Math.abs(v.silver + v.cargo - carried) < 200, `what she carries: ${v.silver + v.cargo}`);
  assert.equal(v.total, price * 2);
  // One paid (d): she is quiet; the other fires on.
  const gold = s.profile!.gold;
  const out = negotiate(game, s, [a.id], 'silver') as CeasefireView;
  assert.deepEqual(out.result, [{ id: a.id, name: a.name, agreed: true }]);
  assert.equal(gold - s.profile!.gold, price, 'the price, in silver');
  assert.ok(truceHolds(game, a, ship));
  assert.ok(!npcHostileTo(game, a, ship), '(a) no foe of hers');
  assert.ok(npcHostileTo(game, b, ship), '(d) the other is not included');
  assert.deepEqual(attackersOf(game, ship).map((x) => x.id), [b.id]);
});

test('(a) her balls in the air do no harm, she drops her mark and chase; (b) the white flag and her bow turned away', () => {
  const { game, c, s, ship, a } = underFire('Flagwatcher');
  const brain = game.npcs.get(a.id)!;
  brain.chase = { id: ship.id, until: game.now + 200 };
  negotiate(game, s, [a.id], 'silver');
  assert.equal(brain.target, null);
  assert.equal(brain.chase, null);
  const hull = ship.hull;
  assert.equal(applyDamage(game, ship, { hull: 50 }, a), 0, 'her shot lands for nothing');
  assert.equal(ship.hull, hull);
  assert.ok(truceHolds(game, a, ship), 'her own ball does not break it');
  // The flag in the snapshot.
  c.inbox.length = 0;
  for (let i = 0; i < 4; i++) game.step();
  const row = c.all('snap').flatMap((m) => m.ships).find((r) => r[0] === a.id);
  assert.ok(row && row[8] & SF.TRUCE, 'a white flag over her');
  // She turns away from the captain.
  const away = Math.atan2(a.state.x - ship.state.x, -(a.state.y - ship.state.y));
  for (let i = 0; i < 20 * 6; i++) game.step();
  const dh = Math.abs(((a.state.heading - away + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  assert.ok(dh < 1.2, `her bow away from her (${dh.toFixed(2)} rad off)`);
  assert.ok(a.truceUntil >= game.now + TRUCE_SEC - 30, 'ten minutes');
});

test('(c) the captain firing on her (or grappling her) breaks the truce, nothing back', () => {
  const { game, s, ship, a, b } = underFire('Oathbreaker');
  negotiate(game, s, [a.id, b.id], 'silver');
  const gold = s.profile!.gold;
  applyDamage(game, a, { hull: 10 }, ship);
  assert.ok(!truceHolds(game, a, ship), 'broken');
  assert.ok(npcHostileTo(game, a, ship), 'she is a foe again');
  assert.equal(s.profile!.gold, gold, 'no refund');
  const h0 = ship.hull;
  applyDamage(game, ship, { hull: 10 }, a);
  assert.ok(ship.hull < h0, 'her guns bite again');
  assert.ok(truceHolds(game, b, ship), 'the other keeps hers');
  startBoarding(game, ship, b, 'standard');
  assert.ok(!truceHolds(game, b, ship), 'grappling her breaks it too');
});

test('(e) a rover in lawless water may refuse: the money is taken only from those who agree, and only once she was seen to have all of it', () => {
  const { game, s, a, b } = underFire('Lawless Lou', true);
  assert.ok(refuseChance(1) > 0.1 && refuseChance(2) >= 0.45 && refuseChance(0.2) === 0.1 && refuseChance(9) === 0.75);
  const v = quote(game, s) as CeasefireView;
  assert.ok(v.ships.every((x) => x.risk > 0), 'the risk shown');
  const price = v.ships[0].price;
  // Not enough for both: nothing is asked, nobody answers, nothing taken, no cool-down.
  s.profile!.gold = 10;
  game.ships.get(s.ship!.id)!.cargo = {};
  const poor = negotiate(game, s, [a.id, b.id], 'silver');
  assert.equal(typeof poor, 'string');
  assert.match(poor as string, /Not enough to pay/);
  assert.equal(s.profile!.gold, 10);
  // The first refuses, the second agrees: only the second is paid.
  s.profile!.gold = 5000;
  const p2 = trucePrice(5000);
  let n = 0;
  game.rng.chance = () => n++ === 0;
  const out = negotiate(game, s, [a.id, b.id], 'silver') as CeasefireView;
  assert.deepEqual(out.result!.map((r) => [r.id, r.agreed]), [[a.id, false], [b.id, true]]);
  assert.equal(5000 - s.profile!.gold, p2, 'one price, the one who agreed');
  assert.ok(!truceHolds(game, a, s.ship!) && truceHolds(game, b, s.ship!));
  assert.ok(price > 0);
});

test('(f) a talk every so often, and a ship that refused will not talk again so soon', () => {
  const { game, s, a, b } = underFire('Spammer', true);
  let n = 0;
  game.rng.chance = () => n++ === 0; // the first refuses
  negotiate(game, s, [a.id], 'silver');
  const again = negotiate(game, s, [b.id], 'silver');
  assert.match(again as string, /talk again in/);
  game.now += TALK_COOLDOWN + 1;
  const refused = negotiate(game, s, [a.id], 'silver');
  assert.match(refused as string, /will not talk again so soon/);
  const v = quote(game, s) as CeasefireView;
  assert.equal(v.ships.find((x) => x.id === a.id)!.ok, false);
  game.now += REFUSED_SEC;
  resetTalks(game, s.accountId);
  game.rng.chance = () => false;
  game.npcs.get(a.id)!.target = s.ship!.id;
  s.ship!.attackers.set(a.id, game.now);
  const ok = negotiate(game, s, [a.id], 'silver') as CeasefireView;
  assert.equal(ok.result![0].agreed, true);
});

test('(g) no bargain with the great ones, the beasts, the dead, the named, nor what was sent for her; an escort is not hers to buy', () => {
  const { game, s, a } = underFire('Picky');
  const cases: [string, (o: ShipEntity) => void][] = [
    ['named', (o) => (o.named = 'nemesis')],
    ['boss', (o) => (o.bossOf = 1)],
    ['zone boss', (o) => (o.zoneBoss = { region: 'gravewater', slot: 0, endsAt: game.now + 100 })],
    ['sent for her', (o) => (game.npcs.get(o.id)!.huntFor = s.ship!.id)],
    ['escort', (o) => (o.ownerId = 99999)],
  ];
  for (const [what, set] of cases) {
    const o = npcAt(game, 'pirate', a.state.x, a.state.y + 300);
    set(o);
    game.npcs.get(o.id)!.target = s.ship!.id;
    s.ship!.attackers.set(o.id, game.now);
    resetTalks(game, s.accountId);
    const gold = s.profile!.gold;
    const r = negotiate(game, s, [o.id], 'silver');
    assert.equal(typeof r, 'string', what);
    assert.equal(s.profile!.gold, gold, `${what}: nothing taken`);
    assert.ok(!truceHolds(game, o, s.ship!), `${what}: no truce`);
    game.removeShip(o.id);
  }
});

test('paid in goods she picks (the rest in silver); the price on the server, never what she does not have', () => {
  const { game, s, ship, a } = underFire('Trader');
  ship.cargo = { rum: 10, spices: 4 };
  s.profile!.gold = 100;
  const v = quote(game, s) as CeasefireView;
  const price = v.ships[0].price;
  const out = negotiate(game, s, [a.id], 'cargo', ['spices']) as CeasefireView;
  assert.equal(out.result![0].agreed, true);
  assert.ok((ship.cargo.spices ?? 0) < 4, 'spices given');
  assert.equal(ship.cargo.rum, 10, 'the rum she kept');
  assert.equal(out.paid!.silver + out.paid!.cargo >= price, true, 'paid in full');
  assert.ok(out.paid!.silver <= 100);
  // Goods she does not carry count for nothing.
  resetTalks(game, s.accountId);
  const { b } = { b: [...game.ships.values()].find((o) => o.npcRole === 'pirate' && o.id !== a.id)! };
  s.profile!.gold = 0;
  ship.cargo = {};
  const r = negotiate(game, s, [b.id], 'cargo', ['gold_bars' as never, 'rum']);
  assert.equal(typeof r, 'string');
});

test('QA 2026-10-18: after a turn-by-turn boarding won, bunks free are her bunks less the living aboard (the fallen take none); no men because none of hers stand, not «no hammocks»', async () => {
  const { tacAction } = await import('../server/src/game/tactical.ts');
  const { outcomeNote } = await import('../shared/src/data/outcome.ts');
  const { steps } = await import('./helpers.ts');
  const { game } = makeGame();
  game.tacticalBoarding = true;
  const c = join(game, 'Bunk Counter', 'reaver');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === 'Bunk Counter')!;
  const ship = s.ship!;
  Object.assign(ship.state, { x: 30000, y: 80000, heading: 0, speed: 0 });
  ship.protectedUntil = 0;
  s.profile!.level = 30;
  ship.recompute(game.now);
  ship.crew = ship.stats.crewMax; // every hammock full before the fight: the ones freed are the fallen's
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  const npc = game.spawnNpcShip('merchant', 'fluyt', 'league', ship.state.x, ship.state.y + 18, 0);
  game.npcs.get(npc.id)!.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  npc.crew = 17;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  for (let i = 0; i < 20 * 120 && !s.pendingBoarding; i++) {
    if (ship.boarding) tacAction(game, ship, { a: 'quick' });
    steps(game, 1);
  }
  const r = s.pendingBoarding!.result;
  const o = r.outcome!;
  const fallen = ((s.profile as unknown as { fallen?: { list: { n: number }[] } }).fallen?.list ?? []).reduce((n, x) => n + x.n, 0);
  const living = ship.army.reduce((n, x) => n + x.n, 0);
  assert.equal(living, ship.crew, 'the army is the crew aboard');
  assert.equal(o.room, ship.stats.crewMax - ship.crew, 'free bunks: her bunks less the living aboard');
  assert.ok(fallen > 0, `some fell (${fallen})`);
  assert.equal(ship.crew, ship.stats.crewMax - fallen + (r.joined ?? []).reduce((n, x) => n + x.n, 0), 'the living aboard: the fallen are off her books, the beaten who came over on them');
  assert.ok(o.room > 0, `the fallen freed their bunks (${o.room})`);
  assert.equal(o.survivors, npc.crew);
  assert.equal(o.sink.crew + o.release.crew, 0, 'too few of hers stand to join');
  assert.equal(outcomeNote(o), 'noMen', 'the card says why: not «no hammocks»');
  // And the exact numbers of the QA card: ten free, none of hers standing.
  assert.equal(outcomeNote({ sink: { silver: 0, take: 0, left: 0, timber: 4, crew: 0 }, release: { silver: 0, crew: 0 }, room: 10, survivors: 0 }), 'noMen');
  assert.equal(outcomeNote({ sink: { silver: 0, take: 0, left: 0, timber: 4, crew: 0 }, release: { silver: 0, crew: 0 }, room: 0, survivors: 20 }), 'noRoom');
});
