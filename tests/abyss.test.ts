import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS } from '../shared/src/data/quests.ts';
import { dist } from '../shared/src/math.ts';
import { windAt } from '../shared/src/sim/wind.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { regionAt } from '../shared/src/world/worldgen.ts';
import { abyssCleared, abyssWind, compassSkew, phantoms, raisingRitual, recordEcho, spawnEcho } from '../server/src/game/abyss.ts';
import { reward, summon } from '../server/src/game/bosses.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { join, makeGame, steps } from './helpers.ts';
import type { FakeConn } from './helpers.ts';

const SEC = 20;

const conns = new Map<string, FakeConn>();

function captain(game: Game, name: string, cleared: boolean): PlayerSession {
  conns.set(name, join(game, name));
  const s = game.sessionByName(name)!;
  const p = s.profile!;
  p.level = cleared ? 50 : 30;
  if (cleared) p.quests.done.push('q_last_leaf');
  return s;
}

function at(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.state.sail = 0;
  ship.input = { rudder: 0, sailTarget: 0 };
  ship.protectedUntil = 1e9;
  ship.region = regionAt(game.world, x, y);
  game.grid.upsert(ship.id, x, y);
}

/** Open water well inside the Abyss, away from its lights and dead winds. */
function deep(game: Game): { x: number; y: number } {
  const [cx, cy] = REGIONS.the_abyss.center;
  for (let r = 3000; r < 12000; r += 500) for (let a = 0; a < 6.28; a += 0.4) {
    const x = cx + Math.sin(a) * r, y = cy - Math.cos(a) * r;
    if (regionAt(game.world, x, y) !== 'the_abyss') continue;
    if (game.abyss.lights.some((l) => dist(l.x, l.y, x, y) < 1500) || game.abyss.deadWinds.some((d) => dist(d.x, d.y, x, y) < d.r + 500)) continue;
    if (game.world.islands.some((i) => dist(i.x, i.y, x, y) < i.radius + 400)) continue;
    return { x, y };
  }
  throw new Error('no open water');
}

test('the way in: Wren\'s Last Leaf at level 45; the Maelstrom Wall throws back the uncleared, unless they sail with one who has it', () => {
  const q = QUESTS.find((x) => x.id === 'q_last_leaf')!;
  assert.equal(q.port, 'wrecktide');
  assert.equal(q.requires.level, 45);
  const { game } = makeGame();
  const pos = deep(game);
  const a = captain(game, 'Uncleared Ula', false);
  at(game, a, pos.x, pos.y);
  steps(game, SEC + 1);
  assert.ok(dist(a.ship!.state.x, a.ship!.state.y, pos.x, pos.y) > 300, 'thrown back');
  assert.ok(a.ship!.hull < a.ship!.stats.hullMax);
  // With a cleared captain of her group close by, she may pass.
  const b = captain(game, 'Cleared Cato', true);
  assert.equal(abyssCleared(game, b), true);
  // Form a group: Cato invites, Ula accepts.
  const cb = conns.get('Cleared Cato')!, ca = conns.get('Uncleared Ula')!;
  cb.push({ t: 'group', action: 'invite', name: 'Uncleared Ula' });
  ca.push({ t: 'group', action: 'accept', id: ca.last('party')!.invites[0].id });
  a.ship!.hull = a.ship!.stats.hullMax;
  at(game, a, pos.x, pos.y);
  at(game, b, pos.x + 300, pos.y);
  assert.equal(abyssCleared(game, a), true, 'in company');
  steps(game, SEC + 1);
  assert.ok(dist(a.ship!.state.x, a.ship!.state.y, pos.x, pos.y) < 100, 'she passes in company');
});

test('depth pressure: a point a minute (two in the black storm), whispers at 30, visions at 60, rot at 90; the Islands of Light wash it out', () => {
  const { game } = makeGame();
  const s = captain(game, 'Pressed Pim', true);
  const pos = deep(game);
  at(game, s, pos.x, pos.y);
  game.weather.the_abyss = { kind: 'calm', until: game.now + 1e9 };
  const ship = s.ship!;
  steps(game, SEC * 60);
  assert.ok(ship.pressure > 0.8 && ship.pressure < 1.3, `a minute: ${ship.pressure}`);
  // Visions.
  ship.pressure = 65;
  assert.equal(phantoms(game, ship).length, 3);
  steps(game, SEC * 2);
  assert.equal(s.profile!.chapters.includes('wall'), true);
  // Rot.
  ship.pressure = 95;
  const hullMax = ship.stats.hullMax, crew = ship.crew;
  steps(game, SEC * 2);
  assert.ok(ship.stats.hullMax < hullMax, 'the hull rots');
  assert.ok(ship.crew < crew, 'men vanish');
  // An Island of Light.
  const light = game.abyss.lights[0];
  assert.ok(light, 'there are lights');
  at(game, s, light.x, light.y);
  steps(game, SEC * 25);
  assert.equal(ship.pressure, 0);
  assert.equal(ship.hasEffect('abyss_rot'), false);
  assert.ok(s.profile!.chapters.includes('light'));
});

test('the sea itself: dead winds, a leaping black-storm wind, stars that lie, currents back to the Eye', () => {
  const { game } = makeGame();
  const s = captain(game, 'Windless Wim', true);
  const dz = game.abyss.deadWinds[0];
  at(game, s, dz.x, dz.y);
  assert.ok(game.windFor(s.ship!).strength < 0.05, 'the dead wind');
  const pos = deep(game);
  at(game, s, pos.x, pos.y);
  game.weather.the_abyss = { kind: 'black_storm', until: game.now + 1e9 };
  const base = windAt(game.world.seed, game.now, pos.x, pos.y, 1);
  const w = abyssWind(game, s.ship!, base)!;
  assert.ok(w && Math.abs(Math.sin(w.dir - base.dir)) > 0.3, 'the wind leaps');
  for (let t = 0; t < 400; t += 37) {
    game.now += 37;
    assert.ok(Math.abs(compassSkew(game, s.ship!)) <= (30 * Math.PI) / 180 + 1e-9);
  }
  // The current runs toward the Eye.
  game.weather.the_abyss = { kind: 'calm', until: game.now + 1e9 };
  const eye = game.abyss.eye;
  const d0 = dist(pos.x, pos.y, eye.x, eye.y);
  at(game, s, pos.x, pos.y);
  steps(game, SEC * 10);
  assert.ok(dist(s.ship!.state.x, s.ship!.state.y, eye.x, eye.y) < d0 - 5, 'drawn toward the Eye');
});

test('Echoes: what the Abyss takes it sends back under the same name', () => {
  const { game } = makeGame();
  const s = captain(game, 'Echo Eda', true);
  const pos = deep(game);
  at(game, s, pos.x, pos.y);
  const lost = game.spawnNpcShip('merchant', 'galleon', 'league', pos.x + 200, pos.y, 0, { ship: 'Gilded Promise', captain: 'X' });
  lost.region = 'the_abyss';
  recordEcho(game, lost);
  const e = spawnEcho(game, s.ship!)!;
  assert.ok(e);
  assert.match(e.name, /^Echo of /);
  assert.equal(game.npcs.get(e.id)?.target, s.ship!.id);
});

test('the Raising Ritual: three shards and thirty cursed relics at the rim of the Eye raise a ghost ship into a berth', () => {
  const { game } = makeGame();
  const s = captain(game, 'Ritual Rook', true);
  const eye = game.abyss.eye;
  at(game, s, eye.x + 700, eye.y);
  assert.match(String(raisingRitual(game, s)), /shards/);
  s.profile!.ritualShards = 3;
  assert.match(String(raisingRitual(game, s)), /cursed relics/);
  s.ship!.cargo.cursed_relics = 30;
  assert.equal(raisingRitual(game, s), null);
  assert.equal(s.profile!.berths.at(-1)?.loadout.classId, 'ghost_ship');
  assert.equal(s.profile!.ritualShards, 0);
});

test('the Ancient Leviathan is three times the beast; the Eye shrugs off shot until it falls, and pays in shards and chapters', () => {
  const { game } = makeGame();
  const s = captain(game, 'Raider Rhea', true);
  const pos = deep(game);
  at(game, s, pos.x, pos.y);
  const lf = summon(game, 'ancient_leviathan', pos.x + 2000, pos.y);
  const body = game.ships.get(lf.id)!;
  assert.ok(Math.abs(body.stats.hullMax - 180000) < 1);
  const eye = game.abyss.eye;
  const f = summon(game, 'abyss_eye', eye.x, eye.y);
  const e = game.ships.get(f.id)!;
  at(game, s, eye.x + 600, eye.y);
  let hp = e.hull;
  applyDamage(game, e, { hull: 400 }, s.ship!);
  assert.ok(Math.abs(hp - e.hull - 100) < 1e-6, 'a quarter');
  // The dead wind.
  e.hull = e.stats.hullMax * 0.5;
  steps(game, SEC + 1);
  assert.equal(f.phase, 1);
  assert.ok(game.windFor(s.ship!).strength < 0.05);
  // The fall: only from within 900 m.
  e.hull = e.stats.hullMax * 0.3;
  steps(game, SEC + 1);
  assert.equal(f.phase, 2);
  at(game, s, eye.x + 1200, eye.y);
  hp = e.hull;
  applyDamage(game, e, { hull: 400 }, s.ship!);
  assert.equal(e.hull, hp);
  at(game, s, eye.x + 600, eye.y);
  applyDamage(game, e, { hull: 400 }, s.ship!);
  assert.ok(e.hull < hp);
  reward(game, f, eye.x, eye.y);
  assert.equal(s.profile!.ritualShards, 1);
  assert.ok(s.profile!.chapters.includes('eye'));
});
