// The ship's army (docs/17 H1, «Heroes of Might and Magic III, only pirate»): a crew as up to seven stacks of seven
// tiers with their upgrades; the head count always the stacks' sum; saves from before the stacks migrated by level;
// cannon fire killing men out of the stacks by exposure, grape the killer and the hull the wall, on both sides and
// between the sea's own ships; boarding at once; the sea's ships carrying armies by the level of their waters, seen
// from afar in HoMM3's words.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARMY_SLOTS_MAX, ARMY_WORD_MIN, UNITS, UNIT_IDS, armyAdd, armyCost, armyForLevel, armyFromSave, armyKillFactor, armyMen, armyPower, armyRemove, armySlots, armyWord, exposure,
} from '../shared/src/data/army.ts';
import type { ArmyStack } from '../shared/src/data/army.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { headingVec } from '../shared/src/math.ts';
import type { GameEvent } from '../shared/src/protocol.ts';
import { sanitizeProfile } from '../server/src/game/player.ts';
import type { Profile } from '../server/src/game/player.ts';
import { applyDamage, fireBroadside, stepProjectiles } from '../server/src/game/combat.ts';
import { canBoard } from '../server/src/game/boarding.ts';
import { killFactor, npcWouldBoard, wallsOf } from '../server/src/game/army.ts';
import { SINK_LOOT, SINK_PURSE, XP_BOARDED, XP_SUNK } from '../server/src/game/Game.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { join, makeGame } from './helpers.ts';

test('the kinds of men: seven tiers, each with its upgrade that is the better man, and their specials', () => {
  assert.equal(UNIT_IDS.length, 14);
  const tiers = new Set(UNIT_IDS.map((u) => UNITS[u].tier));
  assert.deepEqual([...tiers].sort(), [1, 2, 3, 4, 5, 6, 7]);
  for (const u of UNIT_IDS) {
    const d = UNITS[u];
    assert.ok(d.dmin <= d.dmax && d.hp > 0 && d.speed > 0 && d.init > 0, u);
    assert.ok(d.art.startsWith('portrait.') || d.art.startsWith('icon.'), `${u}: art from assets/`);
    if (d.up) continue;
    const up = UNITS[d.upgrade!];
    assert.equal(up.base, u);
    assert.equal(up.tier, d.tier);
    assert.ok(up.atk >= d.atk && up.def >= d.def && up.hp >= d.hp && up.cost > d.cost, `${up.id} is the better ${u}`);
  }
  // Each tier is tougher than the one below.
  for (let t = 2; t <= 7; t++) {
    const a = UNIT_IDS.find((u) => UNITS[u].tier === t - 1 && !UNITS[u].up)!, b = UNIT_IDS.find((u) => UNITS[u].tier === t && !UNITS[u].up)!;
    assert.ok(UNITS[b].cost > UNITS[a].cost, `${b} dearer than ${a}`);
  }
  assert.ok(UNITS.musketeer.specials.includes('shooter') && UNITS.gunner.specials.includes('blast'));
  assert.ok(UNITS.boarder.specials.includes('double_strike') && UNITS.cutthroat.specials.includes('no_retaliation'));
  assert.ok(UNITS.drowned.specials.includes('fear') && UNITS.drowned.specials.includes('undead') && UNITS.drowned.deep);
  // Slots by the class: a sloop four, a brig six, a galleon and up seven.
  assert.equal(armySlots(SHIP_CLASSES.sloop.tier), 4);
  assert.equal(armySlots(SHIP_CLASSES.brig.tier), 6);
  assert.equal(armySlots(SHIP_CLASSES.galleon.tier), ARMY_SLOTS_MAX);
  assert.equal(armySlots(SHIP_CLASSES.man_o_war.tier), 7);
});

test('an army by the ladder: every man in a stack, no more stacks than slots, the higher tiers and upgrades as the level rises', () => {
  for (const mix of ['merchant', 'pirate', 'navy', 'deep', 'player', 'boss'] as const) {
    for (let lv = 1; lv <= 10; lv++) {
      for (const [men, slots] of [[28, 4], [110, 6], [400, 7], [3, 7]] as const) {
        const a = armyForLevel(lv, men, slots, mix);
        assert.equal(armyMen(a), men, `${mix} ⚓${lv} ${men}`);
        assert.ok(a.length <= slots);
        assert.equal(new Set(a.map((s) => s.u)).size, a.length, 'one stack of a kind');
      }
    }
  }
  const low = armyForLevel(1, 200, 7, 'navy'), high = armyForLevel(9, 200, 7, 'navy');
  assert.ok(low.every((s) => !UNITS[s.u].up), 'no upgrades at ⚓1');
  assert.ok(high.some((s) => UNITS[s.u].up) && high.some((s) => UNITS[s.u].tier >= 4), 'upgrades and higher tiers at ⚓9');
  assert.ok(armyPower(high) > armyPower(low) * 1.5, `a ⚓9 crew is the stronger (${Math.round(armyPower(low))} → ${Math.round(armyPower(high))})`);
  assert.ok(!armyForLevel(9, 200, 7, 'merchant').some((s) => UNITS[s.u].tier === 2), 'a merchant carries no marines');
  assert.ok(armyForLevel(8, 300, 7, 'deep').some((s) => UNITS[s.u].deep), 'the Choir carries the drowned');
  assert.ok(!armyForLevel(8, 300, 7, 'navy').some((s) => UNITS[s.u].deep), 'nobody else does');
  // The same ship always carries the same men.
  assert.deepEqual(armyForLevel(6, 90, 6, 'pirate'), armyForLevel(6, 90, 6, 'pirate'));
});

test('losses fall by exposure: exact in number, the weaker and the less armoured first', () => {
  const army: ArmyStack[] = [{ u: 'guard', n: 20 }, { u: 'deckhand', n: 80 }];
  const lost = armyRemove(army, 30);
  assert.equal(lost.reduce((n, x) => n + x.n, 0), 30, 'thirty men, no more, no less');
  assert.equal(armyMen(army), 70);
  const g = 20 - (army.find((s) => s.u === 'guard')?.n ?? 0), d = 80 - (army.find((s) => s.u === 'deckhand')?.n ?? 0);
  assert.ok(g / 20 < (d / 80) / 3, `the guard (${g} of 20) loses a far smaller share than the deckhands (${d} of 80)`);
  assert.ok(exposure('deckhand') === 1 && exposure('guard') < 0.25 && exposure('sailor') < 1);
  // More than there are: every man, and the empty stacks gone.
  const small: ArmyStack[] = [{ u: 'marine', n: 3 }, { u: 'deckhand', n: 2 }];
  armyRemove(small, 99);
  assert.deepEqual(small, []);
  // New hands: into their own stack, a free slot, or the lowest stack when the slots are full.
  const full: ArmyStack[] = [{ u: 'marine', n: 5 }, { u: 'deckhand', n: 5 }];
  armyAdd(full, 4, 2, 'musketeer');
  assert.equal(armyMen(full), 14);
  assert.equal(full.find((s) => s.u === 'deckhand')!.n, 9, 'the slots full: into the lowest');
  assert.ok(armyKillFactor([{ u: 'deckhand', n: 10 }]) === 1 && armyKillFactor([{ u: 'guard', n: 10 }]) < 0.3);
});

test('a save from before the stacks: the crew spread by the level, a save that disagrees made whole against the count', () => {
  const a = armyFromSave(undefined, 60, 5, 6);
  assert.equal(armyMen(a), 60);
  assert.ok(a.some((s) => s.u === 'deckhand') && a.some((s) => s.u === 'sailor'), 'deckhands and sailors');
  assert.ok(a.some((s) => UNITS[s.u].tier >= 2), 'and the tiers above by her level');
  assert.deepEqual(armyFromSave(undefined, 20, 1, 4).map((s) => UNITS[s.u].up), armyFromSave(undefined, 20, 1, 4).map(() => false), 'a ⚓1 ship: no upgrades');
  const b = armyFromSave([{ u: 'marine', n: 10 }, { u: 'deckhand', n: 10 }, { u: 'nonsense', n: 5 }, null, { u: 'guard', n: -3 }], 25, 3, 5);
  assert.equal(armyMen(b), 25, 'the count rules: five more hands signed on');
  assert.equal(b.find((s) => s.u === 'marine')!.n, 10);
  const c = armyFromSave([{ u: 'marine', n: 10 }, { u: 'deckhand', n: 30 }], 20, 3, 5);
  assert.equal(armyMen(c), 20, 'twenty lost by exposure');
  // A whole profile.
  const { game } = makeGame();
  const conn = join(game, 'Oldsave');
  const s = [...game.sessions].find((x) => (x.conn as unknown) === conn)!;
  const p = JSON.parse(JSON.stringify(s.profile)) as Profile;
  delete p.army;
  p.crew = 40;
  const q = sanitizeProfile(p);
  assert.equal(armyMen(q.army!), 40, 'the migrated profile carries every man in a stack');
});

test("the head count is the stacks' sum: old code that sets `crew` keeps working, the ship's slots are kept", () => {
  const { game } = makeGame();
  const ship = game.spawnNpcShip('pirate', 'brig', 'free', 30000, 80000, 0);
  game.setNpcLevel(ship, 6);
  assert.equal(ship.crew, armyMen(ship.army));
  assert.ok(ship.army.length > 2 && ship.army.length <= ship.armySlots);
  const before = ship.army.map((s) => ({ ...s }));
  ship.crew -= 10;
  assert.equal(ship.crew, armyMen(ship.army));
  assert.equal(armyMen(before) - ship.crew, 10);
  ship.crew += 5;
  assert.equal(ship.crew, armyMen(ship.army));
  // New hands sign on as her roster's deckhands (the Free Harbors' fishers on a ship of theirs).
  assert.ok(ship.army.some((s) => (UNITS[s.u].as ?? s.u) === 'deckhand'), 'new hands sign on as deckhands');
  ship.crew = 0;
  assert.deepEqual(ship.army, []);
  ship.setArmy([{ u: 'guard', n: 5 }, { u: 'marine', n: 5 }, { u: 'deckhand', n: 5 }, { u: 'sailor', n: 5 }, { u: 'musketeer', n: 5 }, { u: 'gunner', n: 5 }, { u: 'boarder', n: 5 }, { u: 'drowned', n: 5 }]);
  assert.equal(ship.army.length, 6, 'a brig carries six stacks');
  assert.equal(ship.crew, 40, 'no man lost in the folding');
  ship.loadout.classId = 'sloop';
  ship.recompute(game.now);
  assert.ok(ship.army.length <= 4 && ship.crew === Math.min(40, ship.stats.crewMax), 'a smaller hull: fewer stacks, the men kept up to her hammocks');
});

/** Two ships of the sea side by side at `d` metres, on even terms, the shooter's starboard on the target's port. */
function pair(game: Game, d: number): { a: ShipEntity; b: ShipEntity } {
  const a = game.spawnNpcShip('patrol', 'brig', 'league', 30000, 80000, 0);
  const v = headingVec(Math.PI / 2);
  const b = game.spawnNpcShip('pirate', 'brig', 'free', 30000 + v.x * d, 80000 + v.y * d, 0);
  for (const s of [a, b]) {
    game.setNpcLevel(s, 5);
    s.crew = s.stats.crewMax;
    game.npcs.get(s.id)!.active = true;
    s.input = { rudder: 0, sailTarget: 0 };
    s.state.speed = 0;
    s.ammo.grape = 200;
    s.ammo.round = 200;
    game.grid.upsert(s.id, s.state.x, s.state.y);
  }
  game.rng.gauss = () => 0;
  return { a, b };
}

function broadside(game: Game, a: ShipEntity, side: 'port' | 'starboard', ammo: 'round' | 'grape', d: number): { killed: number; events: GameEvent[] } {
  const evs: GameEvent[] = [];
  const emit = game.emit.bind(game);
  game.emit = (e, x, y) => {
    evs.push(e);
    emit(e, x, y);
  };
  a.ammoSel = ammo;
  a.reload[side] = 0;
  const target = [...game.ships.values()].find((s) => s !== a && Math.hypot(s.state.x - a.state.x, s.state.y - a.state.y) < d + 20)!;
  const before = target.crew;
  assert.equal(fireBroadside(game, a, side, d), null);
  for (let i = 0; i < 200 && game.projectiles.length; i++) stepProjectiles(game, 0.05);
  game.emit = emit;
  return { killed: before - target.crew, events: evs };
}

test('a broadside kills men out of her stacks: grape the most, round shot fewer through a sound hull; the "−N" rises over her', () => {
  const g1 = makeGame().game;
  const p1 = pair(g1, 110);
  const grape = broadside(g1, p1.a, 'starboard', 'grape', 110);
  const g2 = makeGame().game;
  const p2 = pair(g2, 110);
  const round = broadside(g2, p2.a, 'starboard', 'round', 110);
  assert.ok(grape.killed > 0 && round.killed >= 0, `grape ${grape.killed}, round ${round.killed}`);
  assert.ok(grape.killed > round.killed * 3, `grape kills far more (${grape.killed} against ${round.killed})`);
  assert.equal(p1.b.crew, armyMen(p1.b.army), 'the stacks carry the loss');
  const men = grape.events.filter((e) => e.k === 'men') as Extract<GameEvent, { k: 'men' }>[];
  assert.equal(men.length, 1, 'one number for the whole broadside');
  assert.equal(men[0].n, grape.killed);
  assert.equal(men[0].ship, p1.b.id);
  // Both sides lose men before the boarding: she answers from her port battery, the sea's own ships among themselves.
  const back = broadside(g1, p1.b, 'port', 'grape', 110);
  assert.ok(back.killed > 0, `the patrol loses ${back.killed} men too`);
});

test('the hull is the wall: a sound hull shelters the stacks, a shattered one exposes them; tougher men fall fewer', () => {
  const { game } = makeGame();
  const s = game.spawnNpcShip('pirate', 'brig', 'free', 30000, 80000, 0);
  game.setNpcLevel(s, 5);
  s.hull = s.stats.hullMax;
  const whole = wallsOf(s, false);
  s.hull = s.stats.hullMax * 0.1;
  const wreck = wallsOf(s, false);
  assert.ok(whole < 0.7 && wreck > 1.2, `${whole} → ${wreck}`);
  assert.equal(wallsOf(s, true), 1, 'grape sweeps the open deck whatever the planking');
  const k0 = killFactor(s);
  assert.ok(Math.abs(k0 - 1) < 0.25, `her level's usual make: about one (${k0.toFixed(2)})`);
  s.setArmy([{ u: 'life_guard', n: s.crew }]);
  assert.ok(killFactor(s) < k0 * 0.5, 'an army of guards loses far fewer men to the same shot');
  s.setArmy([{ u: 'deckhand', n: s.crew }]);
  assert.ok(killFactor(s) > k0, 'green hands more');
  // Men killed by a packet are taken off by exposure, and the old reckoning of a packet's men stands.
  s.setArmy([{ u: 'guard', n: 10 }, { u: 'deckhand', n: 40 }]);
  applyDamage(game, s, { crew: 10 }, null);
  assert.equal(s.crew, 40);
  assert.equal(s.army.find((x) => x.u === 'guard')?.n ?? 0, 10, 'the guard stands; the deckhands fall');
});

test('a fire aboard burns men out of the stacks', () => {
  const { game } = makeGame();
  // A captain's ship: she burns as any does, and nobody puts her to sleep for want of a captain near.
  const conn = join(game, 'Burning');
  conn.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => (x.conn as unknown) === conn)!.ship!;
  s.state.x = 30000;
  s.state.y = 80000;
  s.state.speed = 0;
  s.input = { rudder: 0, sailTarget: 0 };
  s.crew = s.stats.crewMax;
  const men0 = s.crew;
  s.addEffect({ id: 'fire', until: game.now + 30 }, game.now);
  for (let i = 0; i < 20 * 12; i++) {
    s.effects.find((e) => e.id === 'fire')!.until = game.now + 30;
    s.hull = s.stats.hullMax;
    game.step();
  }
  assert.ok(s.crew < men0 && s.crew >= men0 - 12, `${men0 - s.crew} men burned in twelve seconds`);
  assert.equal(s.crew, armyMen(s.army));
});

test('boarding at once: a whole ship within the grapples may be boarded; the sea\'s captains board when their men are the stronger', () => {
  const { game } = makeGame();
  const { a, b } = pair(game, 18);
  assert.equal(b.hull, b.stats.hullMax, 'she is whole');
  assert.equal(canBoard(game, a, b), null, 'no need to wreck her first');
  const c = game.spawnNpcShip('merchant', 'brig', 'league', 30000, 81000, 0);
  game.setNpcLevel(c, 5);
  assert.match(canBoard(game, a, c) ?? '', /Too far/, 'the grapples still have their reach');
  // A strong crew lays alongside a weak one at once; a weak one keeps the grape on her decks.
  b.setArmy([{ u: 'deckhand', n: 10 }]);
  assert.equal(npcWouldBoard(game, a, b), true);
  a.setArmy([{ u: 'deckhand', n: 10 }]);
  b.setArmy([{ u: 'guard', n: 60 }]);
  b.hull = b.stats.hullMax;
  assert.equal(npcWouldBoard(game, a, b), false);
});

test('the sea\'s ships carry armies by the level of their waters; the target frame sees their size in HoMM3\'s words', () => {
  const { game } = makeGame();
  const lo = game.spawnNpcShip('patrol', 'frigate', 'crown', 30000, 80000, 0);
  game.setNpcLevel(lo, 7);
  const hi = game.spawnNpcShip('patrol', 'frigate', 'crown', 31000, 80000, 0);
  game.setNpcLevel(hi, 10);
  assert.ok(armyPower(hi.army) / hi.crew > armyPower(lo.army) / lo.crew, 'man for man, the deeper waters\' crew is the stronger');
  const info = hi.info();
  assert.equal(info.crewMax, hi.stats.crewMax);
  assert.deepEqual(info.units, hi.army.map((s) => s.u));
  assert.deepEqual(ARMY_WORD_MIN, [1, 5, 10, 20, 50, 100, 250]);
  assert.equal(armyWord(1), 'few');
  assert.equal(armyWord(9), 'several');
  assert.equal(armyWord(10), 'pack');
  assert.equal(armyWord(49), 'lots');
  assert.equal(armyWord(50), 'horde');
  assert.equal(armyWord(120), 'throng');
  assert.equal(armyWord(999), 'swarm');
  assert.ok(armyCost(hi.army) > 0);
});

test('priorities: a ship carried by boarding pays more than one sent down', () => {
  assert.ok(SINK_LOOT <= 0.3 && SINK_PURSE < 0.5, 'sunk: a quarter of her hold, under a third of her purse');
  assert.ok(XP_BOARDED >= XP_SUNK * 2, 'and the captain learns twice as much from a ship carried');
});

test('admin: /army shows and sets the stacks, /foe lays a whole ship alongside, /board grapples her at once', async () => {
  const { runAdmin } = await import('../server/src/game/admin.ts');
  const { game } = makeGame();
  const conn = join(game, 'Tester');
  conn.push({ t: 'undock' });
  const s = [...game.sessions].find((x) => (x.conn as unknown) === conn)!;
  const ship = s.ship!;
  ship.state.x = 30000;
  ship.state.y = 80000;
  assert.match(runAdmin(game, s, '/army') ?? '', /^Army \(/);
  runAdmin(game, s, '/army marine 7');
  assert.equal(ship.army.find((x) => x.u === 'marine')?.n, 7);
  assert.equal(ship.crew, armyMen(ship.army));
  runAdmin(game, s, '/army level 8');
  assert.ok(ship.army.some((x) => UNITS[x.u].up), 'the ladder of ⚓8');
  assert.match(runAdmin(game, s, '/army nonsense 3') ?? '', /Units:/);
  const before = game.ships.size;
  assert.match(runAdmin(game, s, '/foe pirate sloop 18') ?? '', /off your beam/);
  assert.equal(game.ships.size, before + 1);
  const foe = [...game.ships.values()].find((o) => o !== ship && o.npcRole === 'pirate' && Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < 30)!;
  assert.equal(foe.hull, foe.stats.hullMax, 'whole');
  assert.match(runAdmin(game, s, '/board') ?? '', /Grappled/);
  assert.equal(ship.boarding?.with, foe.id, 'grappled the one alongside');
});
