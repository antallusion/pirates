import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, RENT, islandSize, islandSlots } from '../shared/src/data/holdings.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { GRACE_MS, shoreWitness } from '../server/src/game/holdings.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const DAY = 86_400_000;

function pick(game: Game, pred: (i: Island) => boolean): Island {
  const i = game.world.islands.find((x) => !x.portId && pred(x));
  assert.ok(i, 'a suitable island exists');
  return i!;
}

/** Lie stopped off the island's shore. */
function offShore(s: PlayerSession, isl: Island, extra = 150): void {
  const sh = s.ship!;
  sh.docked = null;
  s.profile!.docked = null;
  sh.state.x = isl.x + isl.radius + extra;
  sh.state.y = isl.y;
  sh.state.speed = 0;
  sh.state.sail = 0;
  sh.input = { rudder: 0, sailTarget: 0 };
  sh.lastCombat = -1000;
  sh.region = isl.region;
}

function setup(pred: (i: Island) => boolean = (i) => i.region === 'gravewater' && islandSize(i.radius) === 'medium') {
  const { game } = makeGame();
  let clock = 1_700_000_000_000;
  game.wallNow = () => clock;
  const a = join(game, 'Anne Isle');
  const A = game.sessionByName('Anne Isle')!;
  A.profile!.gold = 500_000;
  const isl = pick(game, pred);
  offShore(A, isl);
  return { game, a, A, isl, advance: (ms: number) => (clock += ms) };
}

const holding = (game: Game, isl: Island) => game.holdings.get(game, isl.id)!;

test('leasing an island: the price by size and zone, one of your own, nobody else’s', () => {
  const { game, a, A, isl } = setup();
  a.push({ t: 'isle', action: 'rent', island: isl.id, days: 7 });
  const h = holding(game, isl);
  assert.ok(h, 'leased');
  assert.equal(h.owner.name, 'Anne Isle');
  assert.equal(A.profile!.gold, 500_000 - RENT.medium[7]);
  assert.equal(a.last('holdings')!.mine[0].slots, islandSlots(isl.radius, isl.region));
  // Extending adds to the end.
  const until = h.until;
  a.push({ t: 'isle', action: 'rent', island: isl.id, days: 14 });
  assert.equal(h.until, until + 14 * DAY);
  // A second island of your own: no.
  const other = pick(game, (i) => i.region === 'gravewater' && i.id !== isl.id && islandSize(i.radius) === 'small');
  offShore(A, other);
  a.push({ t: 'isle', action: 'rent', island: other.id, days: 7 });
  assert.match(a.last('toast')!.msg, /one island/);
  // Someone else cannot take hers.
  const b = join(game, 'Bram Isle');
  const B = game.sessionByName('Bram Isle')!;
  B.profile!.gold = 500_000;
  offShore(B, isl);
  b.push({ t: 'isle', action: 'rent', island: isl.id, days: 7 });
  assert.match(b.last('toast')!.msg, /leased to Anne Isle/);
  // Not the Abyss, not a large island on the Crown's coast, and only from nearby or a harbour office in the region.
  const far = pick(game, (i) => i.region === 'whispering');
  b.push({ t: 'isle', action: 'rent', island: far.id, days: 7 });
  assert.match(b.last('toast')!.msg, /Sail to/);
  const abyss = game.world.islands.find((i) => i.region === 'the_abyss' && !i.portId);
  if (abyss) {
    offShore(B, abyss);
    b.push({ t: 'isle', action: 'rent', island: abyss.id, days: 7 });
    assert.match(b.last('toast')!.msg, /Abyss/);
  }
});

test('building: slots, prerequisites, the rock and the soil; materials from the hold or the store', () => {
  const { game, a, A, isl } = setup((i) => i.region === 'gravewater' && islandSize(i.radius) === 'medium' && !i.features.includes('mine'));
  a.push({ t: 'isle', action: 'rent', island: isl.id, days: 30 });
  const h = holding(game, isl);
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'warehouse' });
  assert.match(a.last('toast')!.msg, /planks/);
  A.ship!.cargo = { planks: 200, iron: 60, weapons: 40, rum: 10 };
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'warehouse' });
  assert.equal(h.buildings[0].id, 'warehouse');
  assert.equal(A.ship!.cargo.planks, 160);
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'dry_dock' });
  assert.match(a.last('toast')!.msg, /shipyard first/);
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'mine' });
  assert.match(a.last('toast')!.msg, /no ore/);
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'warehouse' });
  assert.match(a.last('toast')!.msg, /already has/);
  // Fill the slots.
  const slots = islandSlots(isl.radius, isl.region);
  for (let i = 0; i < 12; i++) a.push({ t: 'isle', action: 'build', island: isl.id, building: 'battery' });
  const used = h.buildings.reduce((n, b) => n + BUILDINGS[b.id].slots, 0);
  assert.equal(used, slots);
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'chapel' });
  assert.match(a.last('toast')!.msg, /No room/);
  a.push({ t: 'isle', action: 'demolish', island: isl.id, index: h.buildings.length - 1 });
  assert.equal(h.buildings.reduce((n, b) => n + BUILDINGS[b.id].slots, 0), slots - 1);
});

test('the store: capacity, contraband only with a smugglers’ store, back into the hold', () => {
  const { game, a, A, isl } = setup();
  a.push({ t: 'isle', action: 'rent', island: isl.id, days: 7 });
  const h = holding(game, isl);
  A.ship!.cargo = { salt: 10, dreamleaf: 2 };
  a.push({ t: 'isle', action: 'store', island: isl.id, good: 'salt', qty: 10 });
  assert.equal(h.store.salt, 10);
  a.push({ t: 'isle', action: 'store', island: isl.id, good: 'dreamleaf', qty: 2 });
  assert.match(a.last('toast')!.msg, /smugglers/);
  a.push({ t: 'isle', action: 'store', island: isl.id, good: 'salt', qty: -4 });
  assert.equal(A.ship!.cargo.salt, 4);
  assert.equal(h.store.salt, 6);
  A.ship!.cargo = { iron: 5000 };
  a.push({ t: 'isle', action: 'store', island: isl.id, good: 'iron', qty: 5000 });
  assert.match(a.last('toast')!.msg, /full/);
});

test('a day passes: produce into the store, pay upkeep from the treasury, half strength when unpaid', () => {
  const { game, a, A, isl, advance } = setup((i) => i.region === 'gravewater' && islandSize(i.radius) === 'medium' && ['temperate', 'mossy', 'volcanic', 'ruins'].includes(i.biome));
  a.push({ t: 'isle', action: 'rent', island: isl.id, days: 30 });
  const h = holding(game, isl);
  A.ship!.cargo = { planks: 200, iron: 60 };
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'farm' });
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'lighthouse' });
  a.push({ t: 'isle', action: 'treasury', island: isl.id, amount: 400 });
  assert.equal(h.treasury, 400);
  advance(DAY + 1000);
  game.now = Math.ceil(game.now / 10) * 10 + 10;
  game.step();
  assert.equal(h.store.provisions, 20, 'a day of the farm');
  // 450 of upkeep, 400 in the treasury: the farm (first) is paid, the lighthouse (and its whale oil) is not.
  assert.equal(h.buildings.find((b) => b.id === 'farm')!.unpaid, false);
  const light = h.buildings.find((b) => b.id === 'lighthouse')!;
  assert.equal(light.unpaid, true);
  assert.ok(Math.abs(light.condition - 0.9) < 1e-9);
  assert.ok(a.last('mail')!.letters.some((l) => l.subject.includes('upkeep unpaid')));
  assert.ok(shoreWitness(game, isl.x + isl.radius + 5000, isl.y), 'the lighthouse keeper sees for 6 km');
  assert.ok(!shoreWitness(game, isl.x + isl.radius + 7000, isl.y));
});

test('the lease runs out: renewed from the treasury, or lost after 72 hours with the store on the beach', () => {
  const { game, a, A, isl, advance } = setup();
  a.push({ t: 'isle', action: 'rent', island: isl.id, days: 7 });
  const h = holding(game, isl);
  A.ship!.cargo = { salt: 20 };
  a.push({ t: 'isle', action: 'store', island: isl.id, good: 'salt', qty: 20 });
  a.push({ t: 'isle', action: 'treasury', island: isl.id, amount: RENT.medium[7] });
  const until = h.until;
  advance(7 * DAY + 60_000);
  game.now = Math.ceil(game.now / 10) * 10 + 10;
  game.step();
  assert.equal(h.until, until + 7 * DAY, 'a week renewed from the treasury');
  assert.equal(h.treasury, 0);
  advance(7 * DAY + 60_000);
  game.now += 10;
  game.step();
  assert.ok(h.warned);
  advance(GRACE_MS);
  game.now += 10;
  const loot = game.loot.size;
  game.step();
  assert.equal(game.holdings.get(game, isl.id), undefined, 'the rights went back');
  assert.equal(game.loot.size, loot + 1, '30% of the store is on the beach');
  assert.equal([...game.loot.values()].pop()!.cargo.salt, 6);
});

test('moorings mend and steady; the cove hides; the guns fire on pirates', () => {
  const { game, a, A, isl } = setup((i) => i.region === 'gravewater' && islandSize(i.radius) === 'medium');
  a.push({ t: 'isle', action: 'rent', island: isl.id, days: 30 });
  A.ship!.cargo = { planks: 300, iron: 60, weapons: 40, rum: 10 };
  for (const b of ['pier', 'chapel', 'hidden_cove', 'battery'] as const) a.push({ t: 'isle', action: 'build', island: isl.id, building: b });
  const ship = A.ship!;
  ship.hull = ship.stats.hullMax * 0.5;
  ship.sanity = 40;
  const hull = ship.hull;
  steps(game, 20 * 60);
  assert.ok(ship.hull > hull + ship.stats.hullMax * 0.004, 'the pier mends');
  assert.ok(ship.sanity > 40 + 2, 'the chapel steadies');
  assert.ok(ship.hasFlag('hidden'), 'the cove hides her');
  // The sea's own ships about the island sail off first: the battery takes the nearest hostile, and the world's dice
  // may have put one of the sea's pirates nearer than ours.
  const about: number[] = [];
  game.forShipsNear(isl.x, isl.y, isl.radius + 2000, (o) => {
    if (o.npcRole) about.push(o.id);
  });
  for (const id of about) game.removeShip(id);
  // A pirate comes in range.
  const pirate = game.spawnNpcShip('pirate', 'sloop', 'confederacy', isl.x + isl.radius + 700, isl.y + 300, 0, { ship: 'Sea Wolf', captain: 'Rook' });
  // An anchored pirate hull (no brain to sail her off): the guns go by her colours alone.
  game.npcs.delete(pirate.id);
  pirate.input = { rudder: 0, sailTarget: 0 };
  pirate.state.sail = 0;
  game.grid.upsert(pirate.id, pirate.state.x, pirate.state.y);
  const spawned = game.now;
  steps(game, 20 * 40);
  assert.ok(!pirate.alive || pirate.lastCombat > spawned, 'the battery fires on her');
});

test('the island yard repairs, and the island tavern signs on hands', () => {
  const { game, a, A, isl } = setup((i) => i.region === 'gravewater' && islandSize(i.radius) === 'medium');
  a.push({ t: 'isle', action: 'rent', island: isl.id, days: 30 });
  A.ship!.cargo = { planks: 300, iron: 60, rum: 10 };
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'shipyard' });
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'tavern' });
  const ship = A.ship!;
  ship.hull = ship.stats.hullMax * 0.3;
  a.push({ t: 'isle', action: 'service', island: isl.id, what: 'repair' });
  assert.equal(ship.hull, ship.stats.hullMax);
  game.tavernCrew.set(`isle:${isl.id}`, 5);
  ship.crew = Math.max(1, ship.crew - 4);
  const crew = ship.crew;
  a.push({ t: 'isle', action: 'service', island: isl.id, what: 'hire', arg: 3 });
  assert.equal(ship.crew, crew + 3);
  // Too far off: no service.
  ship.state.x += 2000;
  a.push({ t: 'isle', action: 'service', island: isl.id, what: 'repair' });
  assert.match(a.last('toast')!.msg, /Heave to/);
});

test('a lighthouse takes its toll from merchants passing', () => {
  const { game, a, A, isl } = setup();
  a.push({ t: 'isle', action: 'rent', island: isl.id, days: 30 });
  A.ship!.cargo = { planks: 50 };
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'lighthouse' });
  const h = holding(game, isl);
  const m = game.spawnNpcShip('merchant', 'fluyt', 'league', isl.x + isl.radius + 1500, isl.y, 0, { ship: 'Fat Purse', captain: 'Factor' });
  m.cargo = { spices: 40 };
  m.input = { rudder: 0, sailTarget: 0 };
  // Only this merchant passes: the villages' own traders (and any the sea puts out meanwhile) are kept away, a
  // second at a time, all the while.
  const alone = (seconds: number) => {
    for (let k = 0; k < seconds; k++) {
      for (const o of [...game.ships.values()]) if (o !== m && !o.isPlayer && Math.hypot(o.state.x - isl.x, o.state.y - isl.y) < 12000) game.removeShip(o.id);
      steps(game, 20);
    }
  };
  alone(61);
  assert.ok(h.treasury > 0, `toll ${h.treasury}`);
  const t = h.treasury;
  alone(61);
  assert.equal(h.treasury, t, 'once per passing');
});

test('the island yard lays down a hull and launches her where she was built; the old ship is berthed there', () => {
  const { game, a, A, isl } = setup((i) => i.region === 'gravewater' && islandSize(i.radius) === 'medium');
  a.push({ t: 'isle', action: 'rent', island: isl.id, days: 30 });
  A.ship!.cargo = { planks: 200, iron: 60 };
  a.push({ t: 'isle', action: 'build', island: isl.id, building: 'shipyard' });
  const p = A.profile!;
  p.level = 12;
  A.ship!.cargo = { timber: 50, planks: 20, sailcloth: 12, iron: 8 };
  a.push({ t: 'isle', action: 'yard_order', island: isl.id, req: { classId: 'schooner', name: 'Island Born', frame: 'pine', plank: 'pine', rares: {} } });
  assert.equal(p.builds.length, 1, a.last('toast')?.msg);
  assert.equal(p.builds[0].port, `isle:${isl.id}`);
  p.builds[0].done = game.now;
  const old = A.ship!.loadout.classId;
  a.push({ t: 'isle', action: 'yard_launch', island: isl.id, id: p.builds[0].id });
  assert.equal(A.ship!.loadout.classId, 'schooner');
  assert.equal(p.berths[0].port, `isle:${isl.id}`);
  assert.equal(p.berths[0].loadout.classId, old);
  a.push({ t: 'isle', action: 'yard_berth', island: isl.id, index: 0 });
  assert.equal(A.ship!.loadout.classId, old, 'and back out of the berth');
});
