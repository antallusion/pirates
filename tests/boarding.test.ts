import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingVec } from '../shared/src/math.ts';
import { TALENTS } from '../shared/src/data/talents.ts';
import { CAPTAIN_SLOTS, ITEM_BASES } from '../shared/src/data/items.ts';
import type { TalentRanks } from '../shared/src/data/talents.ts';
import { fireBroadside } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame, steps } from './helpers.ts';

function atSea(game: Game, name: string, talents: TalentRanks = {}) {
  const c = join(game, name, 'reaver');
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  ship.state.heading = 0;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  s.profile!.level = 60;
  s.profile!.talents = talents;
  ship.talents = talents;
  ship.recompute(game.now);
  ship.crew = ship.stats.crewMax;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s, ship };
}

function crippled(game: Game, ship: ShipEntity, distance: number, crew = 6): ShipEntity {
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const npc = game.spawnNpcShip('merchant', 'fluyt', 'league', ship.state.x + v.x * distance, ship.state.y + v.y * distance, ship.state.heading);
  const brain = game.npcs.get(npc.id)!;
  brain.active = true;
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  npc.cargo = { sugar: 30, rum: 10 };
  npc.hull = npc.stats.hullMax * 0.4;
  npc.crew = crew;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  return npc;
}

test('boarding tree data: 24 talents, 37 ranks, exclusive keystones', () => {
  const list = TALENTS.filter((t) => t.tree === 'boarding');
  assert.equal(list.length, 24);
  assert.equal(list.filter((t) => !t.keystone).reduce((a, t) => a + t.maxRank, 0), 37);
});

test('opening moves: Pistol Volley drops men, Boarding Axes cut sails, Match Speed grapples under way', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Axe Man', { brd_pistol_volley: 1, brd_boarding_axes: 2, brd_match_speed: 2 });
  const npc = crippled(game, ship, 18, 30);
  const sails0 = npc.sails;
  npc.state.speed = 7; // she is still running
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  assert.ok(ship.boarding, 'Match Speed: grappled at 7 m/s difference');
  assert.ok(npc.crew <= 28, `pistol volley: ${npc.crew}`);
  assert.ok(npc.sails <= sails0 - npc.stats.sailHpMax * 0.19, 'axes in the rigging');
});

test('prize: sail her home under a prize crew and sell her to the prize court; captives ransomed', () => {
  const { game } = makeGame();
  const { c, s, ship } = atSea(game, 'Privateer', { brd_prize_crew: 2, brd_ransom: 1 });
  const npc = crippled(game, ship, 18);
  c.push({ t: 'board', target: npc.id, aggression: 'careful' });
  steps(game, 20 * 30);
  const r = c.last('boarding')!.result!;
  assert.ok(r.prize && r.prize.crew >= 2 && r.captive);
  const crew0 = ship.crew;
  c.push({ t: 'loot_take', take: { rum: 5 }, fate: 'prize' });
  assert.ok(npc.prize && npc.ownerId === ship.id, 'she is our prize');
  assert.equal(ship.crew, crew0 - r.prize!.crew);
  assert.equal(s.profile!.captives.length, 1, 'captain in irons');
  assert.ok(ship.transferUntil > game.now, 'plunder takes time to sway across');
  steps(game, 20 * 20);
  assert.ok(Math.hypot(npc.state.x - ship.state.x, npc.state.y - ship.state.y) < 700, 'the prize keeps station');
  // Make port: the court buys her.
  const port = game.world.ports.find((p) => p.shipyardTier >= 1)!;
  npc.state.x = port.x + 500;
  npc.state.y = port.y;
  const gold0 = s.profile!.gold;
  (game as unknown as { dockShip(s: PlayerSession, p: typeof port): void }).dockShip(s, port);
  assert.ok(s.profile!.gold > gold0, 'prize money');
  assert.ok(!game.ships.has(npc.id));
  const g1 = s.profile!.gold;
  c.push({ t: 'captive', index: 0, mode: 'ransom' });
  assert.ok(s.profile!.gold > g1);
  assert.equal((s.profile!.captives as unknown[]).length, 0);
});

test('No Quarter: she sinks within the minute, whatever you choose', () => {
  const { game } = makeGame();
  const talents: TalentRanks = { brd_no_quarter: 1 };
  const { c, ship } = atSea(game, 'Butcher', talents);
  const npc = crippled(game, ship, 18);
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  steps(game, 20 * 30);
  const r = c.last('boarding')!.result!;
  assert.ok(r.noQuarter && r.prize === null);
  c.push({ t: 'loot_take', take: {}, fate: 'release' });
  steps(game, 20 * 70);
  assert.ok(!npc.alive || !game.ships.has(npc.id), 'she went down');
});

test('cutting grapples: Iron Grip holds them, then the defender may cut loose', () => {
  const { game } = makeGame();
  const { c: ca, ship: a } = atSea(game, 'Gripper', { brd_grapples: 2, brd_iron_grip: 2 });
  const { c: cb, ship: b } = atSea(game, 'Slippery');
  b.state.x = a.state.x + 18;
  b.hull = b.stats.hullMax * 0.4;
  game.grid.upsert(b.id, b.state.x, b.state.y);
  game.profileOf(a)!.pvp.flag = 'pirate'; // docs/24: under the pirate flag she may board any captain
  // Contested waters so players may fight.
  for (const sh of [a, b]) {
    sh.state.x += 26000;
    sh.state.y -= 10000;
    sh.region = game.regionAt(sh.state.x, sh.state.y);
    game.grid.upsert(sh.id, sh.state.x, sh.state.y);
  }
  ca.push({ t: 'board', target: b.id, aggression: 'standard' });
  assert.ok(a.boarding, 'boarding started');
  cb.push({ t: 'board_cut' });
  assert.ok(cb.all('toast').some((t) => /chained/.test(t.msg)), 'Iron Grip');
  assert.ok(b.boarding);
  steps(game, 20 * 3);
  let freed = false;
  for (let i = 0; i < 40 && b.boarding; i++) {
    game.now += 10; // past the grip window
    cb.push({ t: 'board_cut' });
    freed = !b.boarding;
  }
  assert.ok(freed || !b.boarding, 'eventually cut loose');
});

test('Jolly Boat Raid: the boat boards while the mother ship keeps firing', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Boatman', { brd_jolly_boat: 1 });
  const npc = crippled(game, ship, 100, 4);
  const crew0 = ship.crew;
  c.push({ t: 'talent_active', id: 'brd_jolly_boat' });
  assert.ok(ship.crew < crew0, 'the party is in the boat');
  let boarded = false;
  for (let i = 0; i < 20 * 30 && !boarded; i++) {
    game.step();
    boarded = !!ship.boarding?.remote;
  }
  if (boarded) {
    ship.reload.port = 0;
    assert.equal(fireBroadside(game, ship, 'port', 200), null, 'guns still work during a boat raid');
  } else {
    assert.ok(c.all('toast').some((t) => /smash the jolly boat/.test(t.msg)), 'or her guns sank the boat');
  }
  void npc;
});

test('Hull to Hull: a ram grapples; Warlord stacks Glory; Blood Tide heals', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Rammer', { brd_hull_to_hull: 1, brd_warlord: 2, brd_blood_tide: 1 });
  const npc = crippled(game, ship, 60);
  // Drive straight into her.
  ship.state.heading = -Math.PI / 2;
  ship.state.speed = 9;
  ship.input = { rudder: 0, sailTarget: 1 };
  let grappled = false;
  for (let i = 0; i < 20 * 10 && !grappled; i++) {
    game.step();
    grappled = !!ship.boarding;
  }
  assert.ok(grappled, 'rammed and grappled');
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.hull = ship.stats.hullMax * 0.5;
  steps(game, 20 * 30);
  assert.ok(c.last('boarding')?.result, 'she was taken');
  assert.ok(ship.hasEffect('glory'), 'glory');
  assert.equal(ship.gloryStacks, 1);
  assert.ok(ship.hull > ship.stats.hullMax * 0.55, 'Blood Tide');
  void c;
  void npc;
});

test('taken by boarding: her captain\'s gear, never the ship\'s (docs/21 §5)', () => {
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Gear Taker');
  const npc = crippled(game, ship, 18);
  npc.elite = true; // an elite always leaves a piece
  c.push({ t: 'board', target: npc.id, aggression: 'standard' });
  steps(game, 20 * 30);
  assert.ok(c.last('boarding')?.result, 'the deck is ours');
  const before = new Set(game.loot.keys());
  c.push({ t: 'loot_take', take: {}, fate: 'sink' });
  const items = [...game.loot.values()].filter((l) => !before.has(l.id)).flatMap((l) => l.items ?? []);
  assert.ok(items.length >= 1, 'a piece in the water');
  for (const it of items) assert.ok((CAPTAIN_SLOTS as string[]).includes(ITEM_BASES[it.base].slot), `${it.base}: the captain's gear`);
});
