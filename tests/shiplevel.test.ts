// Ship levels and the ladder of strength (canon D12, docs/12 §3): every hull has a level ⚓1–⚓10; a lone junior
// never beats a senior captain; a merchant fights two levels below her own but carries far more; the sea's ships are
// levelled by their waters and sized to the captain they are sent after.

import { sectorAt } from '../shared/src/world/sectors.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPTAIN_LEVEL_FOR_SHIP, LEVEL_RANGE, SHIP_LEVEL_MAX, combatLevelOf, hullRole, hullsFor, initialLevel, ladder, levelRange, npcSkill,
  questShipLevel, refitCost, threatOf, watersBand, xpForGap,
} from '../shared/src/data/shiplevel.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import type { ShipClassId } from '../shared/src/data/ships.ts';
import { computeShipStats } from '../shared/src/sim/shipstats.ts';
import { REGIONS } from '../shared/src/world/regions.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { canBoard } from '../server/src/game/boarding.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { sanitizeProfile } from '../server/src/game/player.ts';
import { spawnMerchant, spawnPirate } from '../server/src/game/npc.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame, onHull } from './helpers.ts';

function sea(game: Game, name: string, x: number, region = 'gravewater' as const): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  const sh = s.ship!;
  sh.docked = null;
  s.profile!.docked = null;
  s.profile!.level = 60; // past the Green Pennant: captains may fight
  sh.level = 60;
  sh.state.x = x;
  sh.state.y = 30_000;
  sh.state.speed = 0;
  sh.region = region;
  sh.protectedUntil = 0;
  game.grid.upsert(sh.id, sh.state.x, sh.state.y);
  return s;
}

test('every hull that sails has a level range; the ranges cover ⚓1–⚓10 and join end to end', () => {
  const sailed = (Object.keys(SHIP_CLASSES) as ShipClassId[]).filter((c) => SHIP_CLASSES[c].purchasable || c === 'ghost_ship');
  for (const c of sailed) assert.ok(LEVEL_RANGE[c], `${c} has levels`);
  const covered = new Set<number>();
  for (const c of sailed) for (let l = levelRange(c)[0]; l <= levelRange(c)[1]; l++) covered.add(l);
  for (let l = 1; l <= SHIP_LEVEL_MAX; l++) assert.ok(covered.has(l), `⚓${l} is sailed by some hull`);
  // A sloop tops out where a schooner starts; a brig where a galleon is near.
  assert.equal(levelRange('sloop')[1], levelRange('schooner')[0]);
  for (let l = 2; l <= SHIP_LEVEL_MAX; l++) assert.ok(CAPTAIN_LEVEL_FOR_SHIP[l] > CAPTAIN_LEVEL_FOR_SHIP[l - 1], 'each level asks more of the captain');
  for (let l = 3; l <= SHIP_LEVEL_MAX; l++) assert.ok(refitCost(l)!.silver > refitCost(l - 1)!.silver, 'and costs more to reach');
  assert.equal(refitCost(1), null, 'nobody refits down to the first');
});

test('a level makes her tougher and harder-hitting (+14% each), a little roomier; her class still decides her way', () => {
  const lo = computeShipStats({ classId: 'sloop', name: 'A', guns: { port: 'light_6', starboard: 'light_6' }, modules: {}, level: 1 }, 'corsair', {});
  const hi = computeShipStats({ classId: 'sloop', name: 'A', guns: { port: 'light_6', starboard: 'light_6' }, modules: {}, level: 3 }, 'corsair', {});
  assert.equal(hi.hullMax, Math.round(900 * 1.14 * 1.14));
  assert.ok(Math.abs(hi.gunDamageMul / lo.gunDamageMul - 1.14 * 1.14) < 1e-9);
  assert.ok(hi.holdVolume > lo.holdVolume && hi.crewMax > lo.crewMax);
  assert.ok(hi.maxSpeed / lo.maxSpeed < 1.03, 'way barely grows');
  // A level past her class is clamped.
  const over = computeShipStats({ classId: 'sloop', name: 'A', guns: { port: 'light_6', starboard: 'light_6' }, modules: {}, level: 9 }, 'corsair', {});
  assert.equal(over.hullMax, hi.hullMax);
});

test('a merchant carries at least two and a half times a warship of her level, and fights two levels below it', () => {
  for (let l = 1; l <= SHIP_LEVEL_MAX; l++) {
    const at = (role: string) => (Object.keys(LEVEL_RANGE) as ShipClassId[]).filter((c) => hullRole(c) === role && levelRange(c)[0] <= l && l <= levelRange(c)[1]);
    const trade = at('trade'), war = at('war');
    if (!trade.length || !war.length) continue;
    const hold = (c: ShipClassId) => computeShipStats({ classId: c, name: 'x', guns: { port: 'light_6', starboard: 'light_6' }, modules: {}, level: l }, 'corsair', {}).holdVolume;
    assert.ok(Math.min(...trade.map(hold)) >= 2.5 * Math.max(...war.map(hold)), `⚓${l}: ${trade} vs ${war}`);
  }
  assert.equal(combatLevelOf('fluyt', 5), 3);
  assert.equal(combatLevelOf('galleon', 9), 7);
  assert.equal(combatLevelOf('brig', 5), 5);
});

test('the ladder: among captains a junior is cut hard and floored; at sea he is cut softer; a group of juniors lifts the floor or the cut', () => {
  const j1 = ladder(1, 2, true);
  assert.deepEqual([j1.dealt, j1.crits, j1.board, j1.floorHull], [0.5, 0, false, 0.25]);
  assert.equal(ladder(2, 1, true).dealt, 1.25);
  assert.equal(ladder(1, 4, true).dealt, 0, 'three levels up: the shot does nothing');
  assert.equal(ladder(1, 2, true, true).floorHull, 0, 'a company of juniors may finish her');
  const e1 = ladder(1, 2, false);
  assert.deepEqual([e1.dealt, e1.crits, e1.board, e1.floorHull], [0.5, 0.35, true, 0]);
  assert.equal(ladder(1, 2, false, true).dealt, 1, 'a company of juniors fights a bot a level up as her equals');
  assert.ok(ladder(1, 4, false, true).floorHull > 0, 'three levels up she is a skull to a company too');
  assert.equal(ladder(1, 3, false).board, false);
  assert.ok(ladder(1, 4, false).floorHull > 0, 'a bot three levels up cannot be sunk');
  assert.deepEqual(ladder(3, 3, true), { dealt: 1, crits: 1, board: true, floorHull: 0, floorCrew: 0 });
  assert.equal(threatOf(3, 0), 'trivial');
  assert.equal(threatOf(3, 3), 'even');
  assert.equal(threatOf(3, 4), 'hard');
  assert.equal(threatOf(3, 6), 'skull');
});

test('a lone junior captain never sinks a senior one, however long he fires and however idle she is', () => {
  const { game } = makeGame();
  const A = sea(game, 'Junior Jack', 30_000), B = sea(game, 'Senior Sue', 30_150);
  onHull(game, B.ship!, 'sloop', 2);
  assert.equal(A.ship!.shipLevel, 1);
  assert.equal(B.ship!.shipLevel, 2);
  const h0 = B.ship!.hull;
  for (let i = 0; i < 200; i++) applyDamage(game, B.ship!, { hull: 400, crew: 10 }, A.ship!);
  assert.ok(B.ship!.alive, 'still afloat');
  assert.ok(Math.abs(B.ship!.hull - B.ship!.stats.hullMax * 0.25) < 1, `held at a quarter: ${B.ship!.hull} of ${h0}`);
  assert.ok(B.ship!.crew >= Math.ceil(B.ship!.stats.crewMax * 0.5), 'half her crew stands');
  B.ship!.state.speed = 0;
  B.ship!.state.x = A.ship!.state.x + 20;
  assert.equal(canBoard(game, A.ship!, B.ship!), 'She is above your level: your boarders would not reach her deck');
  // The senior sinks the junior as usual, and harder.
  const a0 = A.ship!.hull;
  applyDamage(game, A.ship!, { hull: 100 }, B.ship!);
  assert.ok(Math.abs(a0 - A.ship!.hull - 125) < 0.01);
});

test('juniors together outweighing a senior may sink her; a merchant never sinks a warship of her own level', () => {
  const { game } = makeGame();
  const A = sea(game, 'Pack One', 30_000), C = sea(game, 'Pack Two', 30_050), B = sea(game, 'Lone Brig', 30_150);
  onHull(game, B.ship!, 'sloop', 2);
  // Two sloops of ⚓1 (1 + 1) against one of ⚓2 (1.3): they outweigh her by far more than 1.2.
  applyDamage(game, B.ship!, { hull: 1 }, C.ship!);
  for (let i = 0; i < 60 && B.ship!.alive; i++) applyDamage(game, B.ship!, { hull: 200 }, A.ship!);
  assert.ok(!B.ship!.alive || B.ship!.hull <= 0, 'the pack finished her');
  // A fluyt at ⚓3 fights at ⚓1; a cutter at ⚓3 is a warship at ⚓3.
  const { game: g2 } = makeGame();
  const M = sea(g2, 'Merchant Mae', 30_000), W = sea(g2, 'Warship Wes', 30_150);
  onHull(g2, M.ship!, 'fluyt', 3);
  onHull(g2, W.ship!, 'cutter', 3);
  for (let i = 0; i < 300; i++) applyDamage(g2, W.ship!, { hull: 300, crew: 5 }, M.ship!);
  assert.ok(W.ship!.alive && W.ship!.hull >= W.ship!.stats.hullMax * 0.5 - 1, 'the warship holds at half');
  assert.ok(M.ship!.stats.holdVolume > 5 * W.ship!.stats.holdVolume, 'but look at that hold');
});

test('the sea’s ships: in the band of their waters, sized to the captain they hunt, craftier the higher they sail', () => {
  const { game } = makeGame();
  assert.deepEqual(watersBand('safe'), [1, 3]);
  assert.deepEqual(watersBand('lawless', true), [8, 10]);
  for (let l = 1; l <= SHIP_LEVEL_MAX; l++) assert.ok(hullsFor('pirate', l).length > 0);
  assert.deepEqual(hullsFor('merchant', 8), ['galleon']);
  const P = sea(game, 'Bait Bob', 30_000, 'gravewater');
  for (let i = 0; i < 12; i++) {
    const ship = spawnPirate(game, P.ship!);
    if (!ship) continue;
    assert.ok(Math.abs(ship.shipLevel - P.ship!.combatLevel) <= 3, `an ambusher near her prey: ⚓${ship.shipLevel}`);
    game.removeShip(ship.id);
  }
  // Merchants put out in the band of their port's square of the sea (docs/16 P2; as far as their hull allows).
  const before = new Set(game.ships.keys());
  for (let i = 0; i < 12; i++) spawnMerchant(game);
  const fresh = [...game.ships.values()].filter((x) => !before.has(x.id) && x.npcRole === 'merchant');
  assert.ok(fresh.length > 5, `${fresh.length} merchants`);
  for (const m of fresh) {
    const [lo, hi] = sectorAt(game.world, m.state.x, m.state.y).band;
    const [clo, chi] = levelRange(m.loadout.classId);
    assert.ok(m.shipLevel >= Math.max(lo, clo) - 0 || m.shipLevel === clo, `⚓${m.shipLevel} ${m.loadout.classId} under ${lo}-${hi} at ${Math.round(m.state.x)},${Math.round(m.state.y)}`);
    assert.ok(m.shipLevel <= Math.max(hi, clo) && m.shipLevel <= chi, `⚓${m.shipLevel} ${m.loadout.classId} in ${lo}-${hi} at ${Math.round(m.state.x)},${Math.round(m.state.y)}`);
  }
  assert.ok(npcSkill(1).spread > npcSkill(9).spread && npcSkill(1).lead < npcSkill(9).lead && !npcSkill(1).dash && npcSkill(9).dash);
  for (const r of Object.values(REGIONS)) assert.ok(watersBand(r.safety)[0] >= 1);
});

test('ships from before the levels come aboard at their class’s first, one more when nearly all fitted', () => {
  assert.equal(initialLevel('brig', {}), 5);
  assert.equal(initialLevel('brig', { hull_plating: 3, sail_plan: 3, rudder: 2 }), 6);
  const { game } = makeGame();
  join(game, 'Old Salt');
  const p = game.sessionByName('Old Salt')!.profile!;
  p.loadout = { classId: 'frigate', name: 'Old', guns: { port: 'heavy_18', starboard: 'heavy_18' }, modules: { hull_plating: 3, sail_plan: 3, hold_expansion: 2 } };
  sanitizeProfile(p);
  assert.equal(p.loadout.level, 7);
});

test('the ladder’s refusal reads in Russian', () => {
  setLang('ru');
  const ru = serverText('She is above your level: your boarders would not reach her deck');
  setLang('en');
  assert.doesNotMatch(ru, /[A-Za-z]{3,}/);
});

test('a quest with a fight names the ship level it asks for; the waters and a group contract raise it', () => {
  const safety = (r: string) => REGIONS[r as keyof typeof REGIONS]?.safety ?? 'safe';
  assert.equal(questShipLevel({ requires: { level: 1 }, steps: [{ type: 'visit' }] }, safety), null, 'no fight, no level');
  assert.equal(questShipLevel({ requires: { level: 13 }, steps: [{ type: 'sink' }] }, safety), 3);
  assert.equal(questShipLevel({ requires: { level: 1 }, steps: [{ type: 'sink', region: 'dead_mans_expanse' }] }, safety), 5, 'lawless waters ask ⚓5 at the least');
  assert.equal(questShipLevel({ requires: { level: 1 }, steps: [{ type: 'sink', role: 'elite', region: 'gravewater' }] }, safety), 6, 'a contested contract’s flagship');
  assert.equal(xpForGap(-3), 0, 'a grey prize gives nothing');
  assert.ok(xpForGap(1) > xpForGap(0) && xpForGap(0) > xpForGap(-1));
});
