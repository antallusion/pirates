// Dynamic combat (docs/11 P2): the sea's captains fight smarter — pirate packs come round both quarters,
// merchants throw cargo over the side to run lighter, pirates lie in wait in fog and darkness, patrols sail in
// line behind their flagship.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNight } from '../shared/src/constants.ts';
import { headingVec } from '../shared/src/math.ts';
import type { Game } from '../server/src/game/Game.ts';
import { FLANK_SEC, beatAngle, rallyPack, runLighter, spawnPatrols } from '../server/src/game/npc.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { legacyWorld } from '../shared/src/world/worldgen.ts';
import { join, makeGame, steps } from './helpers.ts';

function captainAtSea(game: Game, name: string): ShipEntity {
  const c = join(game, name);
  c.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => x.name === name)!;
  const ship = s.ship!;
  s.profile!.level = 60;
  ship.state.x = 56000;
  ship.state.y = 70000;
  ship.state.heading = 0;
  ship.protectedUntil = 0;
  ship.region = game.regionAt(ship.state.x, ship.state.y);
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return ship;
}

function npcAt(game: Game, role: 'pirate' | 'merchant', x: number, y: number): ShipEntity {
  const o = game.spawnNpcShip(role, role === 'pirate' ? 'brig' : 'fluyt', role === 'pirate' ? 'free' : 'league', x, y, 0);
  game.npcs.get(o.id)!.active = true;
  game.grid.upsert(o.id, o.state.x, o.state.y);
  return o;
}

test('a wolf pack: the pirate who goes for a captain calls two idle pirates, one to each quarter', () => {
  const { game } = makeGame();
  const prey = captainAtSea(game, 'Hunted');
  // A steady wind blowing from the pack toward her: this test is of the pack's teamwork, not of beating to windward.
  game.windFor = () => ({ dir: -Math.PI / 2, strength: 0.7 });
  const first = npcAt(game, 'pirate', prey.state.x + 900, prey.state.y);
  const a = npcAt(game, 'pirate', first.state.x + 1500, first.state.y + 800);
  const b = npcAt(game, 'pirate', first.state.x - 1200, first.state.y + 1500);
  const far = npcAt(game, 'pirate', first.state.x + 6000, first.state.y);
  const n = rallyPack(game, first, prey);
  assert.equal(n, 2, 'two came');
  const ba = game.npcs.get(a.id)!, bb = game.npcs.get(b.id)!;
  assert.equal(ba.target, prey.id);
  assert.equal(bb.target, prey.id);
  assert.ok(ba.flank !== undefined && bb.flank !== undefined && Math.sign(ba.flank) !== Math.sign(bb.flank), 'from either side');
  assert.equal(game.npcs.get(far.id)!.target, null, 'a pirate beyond 3 km did not hear');
  // They close in.
  const d0 = Math.hypot(a.state.x - prey.state.x, a.state.y - prey.state.y);
  // She swings out to her quarter of the prey first (which may take her further off), then closes: within two
  // minutes she has been nearer than she began.
  let best = d0;
  for (let i = 0; i < 24; i++) {
    steps(game, 20 * 5);
    best = Math.min(best, Math.hypot(a.state.x - prey.state.x, a.state.y - prey.state.y));
  }
  assert.ok(best < d0 - 200, `the pack closes (${Math.round(d0)} → ${Math.round(best)} m)`);
});

test('beating to windward (docs/16 P5): a pack dead to leeward of a hove-to captain closes on her within two minutes', () => {
  // The best beat is well inside the no-go edge (the sea never lies dead, sailing.ts): a square-rigger pinches up.
  const beat = beatAngle('square', 65, false, 0.7);
  assert.ok(beat > 10 && beat < 65, `square rig beats at ${beat}°`);
  const { game } = makeGame();
  // The beat is weighed on the open water it was tuned on: the islands of docs/18 III taken off this sea (one lies 2 km
  // off her, and what lives on it draws the pack's eye).
  const w = game.world;
  w.islands.length = w.isleFrom;
  for (const [k, list] of w.chunks) w.chunks.set(k, list.filter((id) => id < w.isleFrom));
  w.navGrid = legacyWorld(w).navGrid;
  const prey = captainAtSea(game, 'Hove To');
  prey.input = { rudder: 0, sailTarget: 0 };
  prey.state.sail = 0;
  prey.state.speed = 0;
  // The wind blows from her to the pack: every pirate has her dead to windward.
  game.windFor = () => ({ dir: Math.PI / 2, strength: 0.7 });
  const first = npcAt(game, 'pirate', prey.state.x + 900, prey.state.y);
  const a = npcAt(game, 'pirate', prey.state.x + 2600, prey.state.y + 300);
  const b = npcAt(game, 'pirate', prey.state.x + 2400, prey.state.y - 500);
  assert.equal(rallyPack(game, first, prey), 2);
  for (const o of [a, b]) assert.ok((game.npcs.get(o.id)!.flankUntil ?? 0) <= game.now + FLANK_SEC, 'the swing round is capped');
  // The one who called them sails off: were she to grapple the captain first, the pack would leave a ship locked in a
  // boarding alone (combat.ts) — this test is of the beat to windward.
  game.removeShip(first.id);
  const d0 = [a, b].map((o) => Math.hypot(o.state.x - prey.state.x, o.state.y - prey.state.y));
  const best = [...d0];
  for (let i = 0; i < 24; i++) {
    steps(game, 20 * 5);
    [a, b].forEach((o, k) => (best[k] = Math.min(best[k], Math.hypot(o.state.x - prey.state.x, o.state.y - prey.state.y))));
  }
  // Before the fix she reached off along the no-go edge and made ~100 m to windward in two minutes.
  [0, 1].forEach((k) => assert.ok(best[k] < d0[k] - 800, `pack member ${k} beats up to her (${Math.round(d0[k])} → ${Math.round(best[k])} m)`));
  // A quarter dead to windward is not worth the beat: she forgot it and went straight in.
  assert.ok([a, b].some((o) => game.npcs.get(o.id)!.flank === undefined), 'the upwind quarter was given up');
});

test('a merchant run down throws a third of her hold over the side, at most three times, to run lighter', () => {
  const { game } = makeGame();
  const chaser = captainAtSea(game, 'Chaser');
  const m = npcAt(game, 'merchant', chaser.state.x + 600, chaser.state.y);
  m.cargo = { sugar: 30, rum: 15 };
  const brain = game.npcs.get(m.id)!;
  const loot0 = game.loot.size;
  assert.ok(runLighter(game, m, brain, chaser));
  assert.deepEqual(m.cargo, { sugar: 20, rum: 10 });
  assert.equal(game.loot.size, loot0 + 1, 'crates on the water');
  assert.equal(runLighter(game, m, brain, chaser), false, 'not again at once');
  for (let i = 0; i < 3; i++) {
    game.now += 21;
    runLighter(game, m, brain, chaser);
  }
  assert.equal(brain.dumped, 3, 'three times at most');
  const far = npcAt(game, 'merchant', chaser.state.x + 3000, chaser.state.y);
  far.cargo = { sugar: 30 };
  assert.equal(runLighter(game, far, game.npcs.get(far.id)!, chaser), false, 'no need while the chaser is far');
});

test('in darkness an idle pirate lies low and waits; the first broadside from hiding is an ambush', () => {
  const { game } = makeGame();
  let t = game.now;
  while (!isNight(t)) t += 30;
  game.now = t;
  const p = npcAt(game, 'pirate', 40000, 40000);
  const brain = game.npcs.get(p.id)!;
  brain.nextThink = 0;
  steps(game, 20 * 2);
  assert.ok(brain.ambushing, 'lying in wait');
  assert.ok(p.hasFlag('dark_running') && p.hasFlag('shadow_strike'));
  assert.ok(p.input.sailTarget <= 0.2, 'sails furled low');
});

test('a patrol sails in line: the rest keep station behind their flagship', () => {
  const { game } = makeGame();
  spawnPatrols(game);
  const followers = [...game.npcs.values()].filter((b) => b.role === 'patrol' && b.leader !== undefined);
  assert.ok(followers.length > 0, 'patrols have lines');
  for (const b of followers) {
    const lead = game.npcs.get(b.leader!);
    assert.ok(lead && lead.role === 'patrol' && lead.leader === undefined, 'led by a flagship');
  }
  // Keeping station: a follower placed far off comes back toward the flagship.
  const b = followers[0];
  const ship = [...game.ships.values()].find((s) => s.id === [...game.npcs.entries()].find(([, x]) => x === b)![0])!;
  const lead = game.ships.get(b.leader!)!;
  // Open water, away from the port the patrol was raised in.
  lead.state.x = 30000;
  lead.state.y = 80000;
  lead.state.heading = 0;
  game.grid.upsert(lead.id, lead.state.x, lead.state.y);
  // A captain close by keeps the patrol awake (a sea without captains is only sketched).
  const watcher = captainAtSea(game, 'Watcher');
  watcher.state.x = lead.state.x + 400;
  watcher.state.y = lead.state.y + 400;
  game.grid.upsert(watcher.id, watcher.state.x, watcher.state.y);
  b.active = true;
  game.npcs.get(lead.id)!.active = true;
  const v = headingVec(lead.state.heading);
  ship.state.x = lead.state.x + v.x * 1200;
  ship.state.y = lead.state.y + v.y * 1200;
  const d0 = Math.hypot(ship.state.x - lead.state.x, ship.state.y - lead.state.y);
  steps(game, 20 * 40);
  assert.ok(Math.hypot(ship.state.x - lead.state.x, ship.state.y - lead.state.y) < d0, 'back toward her flagship');
});
