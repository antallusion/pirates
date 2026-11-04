// Forum posts 57 (Пофигум) and 70 (Эдуард), 2026-11-04: «корабль разворачивается на месте без разгона»; «при открытии
// острова кораблик … тупо останавливается»; the convoy's warship «постоянно агрился на патруль», its merchant sunk by
// the first pirate; the talents' «перезарядка», «Беглый огонь (K)», «Призовая команда», the ★ of the ram's Path; the
// healer's «юнги 24/43».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STEER_DEAD, STEER_FULL_AT, steerageAt, stepSailing } from '../shared/src/sim/sailing.ts';
import type { SailParams, SailState } from '../shared/src/sim/sailing.ts';
import { spawnEscortShip } from '../server/src/game/fleet.ts';
import { auxStation, hiredFoe, npcHostileTo } from '../server/src/game/npc.ts';
import { PRIZE_BOATS_R } from '../server/src/game/Game.ts';
import { killMen } from '../server/src/game/combat.ts';
import { takeWounded, woundedBack } from '../server/src/game/crewlife.ts';
import { fallenOf, recordFallen, resView } from '../server/src/game/waystations.ts';
import { TALENTS } from '../shared/src/data/talents.ts';
import { DATA_RU_TALENTS } from '../client/src/lang/data.talents.ru.ts';
import { PATH_PICKS } from '../client/src/ui/talents.ts';
import { duelSea, openWater } from './balance/duel.ts';
import { seaCaptain } from './balance/seafight.ts';
import { makeGame, join, steps } from './helpers.ts';

// ------------------------------------------------------------------------------------------------ 1. steerage way

function params(o: Partial<SailParams> = {}): SailParams {
  return {
    rig: 'square', maxSpeed: 12, accel: 0, turnRate: 0.5, noGoDeg: 60, sailChangeRate: 1, crewFactor: 1, rudderHealth: 1,
    sailHealth: 1, speedMul: 1, currentMul: 0, loadFactor: 1, sweeps: false, weatherly: false, personalWind: false, ...o,
  } as SailParams;
}

/** Radians she comes round in `secs` under hard rudder, held at `speed` (accel 0, the sail at what keeps her way). */
function turned(speed: number, secs: number): number {
  let s: SailState = { x: 0, y: 0, heading: 0, speed, sail: 0, rudder: 1 };
  let h = 0;
  for (let t = 0; t < secs; t += 0.05) {
    const n = stepSailing(s, { rudder: 1, sailTarget: 0 }, params(), { dir: Math.PI, strength: 0 }, { x: 0, y: 0 }, 0.05);
    h += Math.abs(n.heading - s.heading) < Math.PI ? Math.abs(n.heading - s.heading) : 0;
    s = { ...n, speed }; // her way held where the test puts it
  }
  return h;
}

test('steerage way: dead in the water she turns at a fifth of her rate, in full from half her top speed', () => {
  assert.ok(STEER_DEAD >= 0.2 && STEER_DEAD <= 0.25);
  assert.equal(STEER_FULL_AT, 0.5);
  assert.equal(steerageAt(0, 12), STEER_DEAD);
  assert.equal(steerageAt(6, 12), 1);
  assert.equal(steerageAt(12, 12), 1);
  assert.ok(Math.abs(steerageAt(3, 12) - (STEER_DEAD + (1 - STEER_DEAD) / 2)) < 1e-9, 'straight between');
  const still = turned(0, 3), half = turned(6, 3);
  assert.ok(still > 0.05, `a stopped ship still comes round a little (${still.toFixed(2)} rad)`);
  assert.ok(still / half < 0.26 && still / half > 0.18, `stopped ${still.toFixed(2)} vs at half speed ${half.toFixed(2)}`);
});

// ------------------------------------------------------------------------------------------------ 2. the island screen

test('the island screen no longer halts her: «Остров» sends no «halt», drops no course, no autosail, no «Атаковать»', () => {
  const src = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  const open = src.slice(src.indexOf('function openBase(): void {'), src.indexOf('isleScene.enter(state);', src.indexOf('function openBase(): void {')));
  assert.ok(open.length > 100);
  assert.doesNotMatch(open, /t: 'halt'|haltFor|touch\.course = null|goalRun = null|homeRun = null|state\.input\.sail = 0/);
  assert.doesNotMatch(src, /haltForIsle/);
});

// ------------------------------------------------------------------------------------------------ 3. the squadron

function squadron(name: string) {
  const game = duelSea();
  const at = openWater(game, 7);
  const s = seaCaptain(game, 'brig', 5, at.x, at.y, 0);
  const me = s.ship!;
  me.region = 'gravewater';
  const p = s.profile!;
  p.fleet.escorts.push({ id: 'w1', classId: 'brig', name: 'Warden', hull: 1 });
  p.fleet.escorts.push({ id: 'm1', classId: 'fluyt', name: 'Ledger', hull: 1, own: 'o1_1', level: 4, role: 'merchant' });
  const war = spawnEscortShip(game, s, p.fleet.escorts[0], 0);
  const cargo = spawnEscortShip(game, s, p.fleet.escorts[1], 1);
  for (const x of [war, cargo]) x.region = 'gravewater';
  void name;
  return { game, s, me, war, cargo, at };
}

function foe(game: ReturnType<typeof duelSea>, role: 'pirate' | 'patrol', faction: 'crown' | 'confederacy' | 'free', x: number, y: number) {
  const o = game.spawnNpcShip(role, 'brig', faction, x, y, 0);
  game.setNpcLevel(o, 5);
  o.region = 'gravewater';
  const b = game.npcs.get(o.id)!;
  b.active = true;
  b.keep = true;
  game.grid.upsert(o.id, x, y);
  return { o, b };
}

test('her warship starts nothing with a patrol on her: answers it only once it fires, of any flag', () => {
  const { game, me, war } = squadron('Patent Polly');
  for (const f of ['crown', 'confederacy'] as const) {
    const { o, b } = foe(game, 'patrol', f, me.state.x + 200, me.state.y);
    b.target = me.id; // set on her (her patent, her flag)
    assert.equal(hiredFoe(game, war, me, o), false, `${f}: no first shot at the law`);
    assert.equal(npcHostileTo(game, war, o), false);
    o.attackers.clear();
    me.attackers.set(o.id, game.now); // it fires on her
    assert.equal(npcHostileTo(game, war, o), true, `${f}: answered`);
    me.attackers.delete(o.id);
    game.removeShip(o.id);
  }
});

test('a pirate on her merchant: the warship goes for it first, the merchant keeps close by her captain and goes for nobody', () => {
  const { game, me, war, cargo } = squadron('Convoy Connie');
  assert.equal(cargo.escortAux, true, 'her own merchant');
  assert.equal(war.escortAux, false);
  // a pirate nearer the warship but after nobody, and one bearing down on the merchant
  const idle = foe(game, 'pirate', 'free', war.state.x + 120, war.state.y - 200);
  idle.b.target = null;
  const raider = foe(game, 'pirate', 'free', cargo.state.x + 420, cargo.state.y + 60);
  raider.b.target = cargo.id;
  assert.equal(hiredFoe(game, war, me, raider.o), true, 'a raider bearing down on her merchant');
  cargo.attackers.set(raider.o.id, game.now);
  for (let i = 0; i < 8; i++) game.step();
  const wb = game.npcs.get(war.id)!, cb = game.npcs.get(cargo.id)!;
  assert.equal(wb.target, raider.o.id, 'the warship goes to the merchant\'s help');
  assert.equal(cb.target, null, 'the merchant fights nobody');
  // her station: close abeam of her captain, inside the warship's
  const st = auxStation(cargo.auxSlot);
  assert.ok(Math.hypot(st.x, st.y) < 60);
});

// ------------------------------------------------------------------------------------------------ 4. the talents

test('the talents\' words: guns\' reload said as such, no stray key letter, the ammo change is «смена зарядов»', () => {
  const ru = (id: string) => DATA_RU_TALENTS[`talents.TALENTS.${TALENTS.findIndex((t) => t.id === id)}.description`];
  assert.match(ru('gun_fast_hands'), /перезарядка орудий \(время между залпами\)/i);
  assert.match(ru('gun_red_hot_barrels'), /Перезарядка орудий/);
  assert.match(ru('gun_quick_swap'), /Смена зарядов/);
  assert.doesNotMatch(ru('gun_rolling_broadside'), /\((K|К)\)/);
  assert.doesNotMatch(TALENTS.find((t) => t.id === 'gun_rolling_broadside')!.description, /\(K\)/);
  assert.match(ru('gun_rolling_broadside'), /режим огня/);
  // an ability's cooldown is its «восстановление», never the guns' «перезарядка»
  for (const id of ['smg_false_colors', 'abs_voice_of_the_choir', 'cmd_rule_of_the_lash']) assert.doesNotMatch(ru(id), /перезаряд/i, id);
  assert.match(ru('brd_prize_crew'), /шлюпки забирают .* за 250 м/);
});

test('«Призовая команда»: the boats bring a sunk ship\'s casks in from 250 m; without it she sails onto them', () => {
  const { game } = makeGame();
  join(game, 'Prize Pat', 'reaver');
  const s = game.sessionByName('Prize Pat')!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  const at = openWater(game, 5);
  ship.state = { ...ship.state, x: at.x, y: at.y, speed: 0, sail: 0 };
  ship.input = { rudder: 0, sailTarget: 0 };
  game.grid.upsert(ship.id, at.x, at.y);
  const drop = () => {
    const id = 900000 + game.loot.size;
    game.loot.set(id, { id, x: at.x + 200, y: at.y, cargo: { rum: 3 }, gold: 0, expires: game.now + 600, wreck: ship.region });
    return id;
  };
  const a = drop();
  steps(game, 25);
  assert.ok(game.loot.has(a), 'out of reach without the talent');
  game.loot.delete(a);
  ship.talents.brd_prize_crew = 1;
  ship.recompute(game.now);
  assert.ok(PRIZE_BOATS_R >= 200);
  const b = drop();
  steps(game, 25);
  assert.equal(game.loot.has(b), false, 'the boats bring it in');
});

test('the ram\'s Path: ★ on «Усиленный нос» (the ram\'s blow), for «Таранный ход»', () => {
  assert.equal(PATH_PICKS.reaver?.shp_reinforced_bow, 'ramming_speed');
  const src = readFileSync(new URL('../client/src/ui/talents.ts', import.meta.url), 'utf8');
  assert.match(src, /rose-pick/);
  assert.match(src, /pickLine\(x\.id, self\.captain\)/);
});

// ------------------------------------------------------------------------------------------------ 4e. the healer

test('the wounded come back as what they were; the ones who die below are on the record, by kind', () => {
  const { game } = makeGame();
  join(game, 'Kinds Kit', 'corsair');
  const s = game.sessionByName('Kinds Kit')!;
  const ship = s.ship!;
  ship.setArmy([{ u: 'sailor', n: 30 }]);
  ship.talents.srv_ships_surgeon = 3;
  ship.recompute(game.now);
  const c0 = ship.crew;
  killMen(game, ship, 12, null);
  const lost = c0 - ship.crew;
  assert.ok(lost > 0);
  assert.ok(ship.wounded > 0, 'some only wounded');
  assert.equal(ship.woundedKinds.sailor, ship.wounded, 'wounded sailors');
  const w = ship.wounded;
  woundedBack(ship, w);
  ship.wounded = 0;
  assert.equal(ship.army.find((x) => x.u === 'deckhand'), undefined, 'no deckhands where sailors fell');
  assert.equal(ship.army.find((x) => x.u === 'sailor')!.n, c0 - lost + w);
  // the record holds the sailors who died, not deckhands
  const rec = fallenOf(game, s);
  assert.ok(rec.list.every((e) => e.u === 'sailor'));
  assert.equal(rec.list.reduce((a, e) => a + e.n, 0), lost - w);
  // the wounded who die below go on the record as what they were
  ship.woundedKinds = { sailor: 2 };
  const dead = takeWounded(ship, 2);
  recordFallen(game, s, dead);
  assert.equal(fallenOf(game, s).list.reduce((a, e) => a + e.n, 0), lost - w + 2);
});

test('the healer\'s offer: a part of a kind says why — the free hammocks', () => {
  const { game } = makeGame();
  join(game, 'Hammock Hal', 'corsair');
  const s = game.sessionByName('Hammock Hal')!;
  const ship = s.ship!;
  ship.setArmy([{ u: 'deckhand', n: Math.max(1, ship.stats.crewMax - 24) }]);
  recordFallen(game, s, [{ u: 'deckhand', n: 43 }]);
  const row = resView(game, s).rows.find((r) => r.u === 'deckhand')!;
  assert.equal(row.n, 43);
  assert.equal(row.room, 24);
  assert.match(row.why!, /Free hammocks aboard: 24/);
  const ru = readFileSync(new URL('../client/src/lang/ui/waystation.ts', import.meta.url), 'utf8');
  assert.match(ru, /'room': 'пало за сутки: \{n\} · встанут в строй сейчас: \{k\}'/);
});
