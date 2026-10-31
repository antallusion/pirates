// The owner's four of 2026-10-30:
//  1. «увеличь дальность всего оружия абсолютно всего на 100м» — every gun, shot, mount and aimed order +100 m;
//  2. «абордаж должен быть доступен на расстоянии 100м … показать после кнопки сближение кораблей» — «На абордаж» within
//     100 m of her hull, the grapples haul the two alongside over 2–4 s, then the battle;
//  3. «паруса должны уничтожаться по сути только картечью, от обычных ядер … минимальный дамаг» — round shot an eighth of
//     its canvas, chain and grape the rigging's shot, a broadside's canvas capped;
//  4. «подбавь всем кораблям нпс где-то 25% хп» — the sea's own ×0.5 → ×0.625, a captain's own escort keeps ×0.5.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REACH_BONUS, closeRange, gunRange } from '../shared/src/data/gunnery.ts';
import { BOARD_OFFER, grappleSecs, hullOf, hullsGap } from '../shared/src/data/reach.ts';
import { NPC_HP_MUL, NPC_OWNED_HP_MUL } from '../shared/src/data/seabalance.ts';
import { AMMO, AMMO_IDS, GUNS, MOUNTS } from '../shared/src/data/ships.ts';
import type { GunId } from '../shared/src/data/ships.ts';
import { headingVec } from '../shared/src/math.ts';
import { tx } from '../shared/src/sim/shipstats.ts';
import { SAIL_VOLLEY_CAP, effectiveRange, sailVolleyCap } from '../server/src/game/combat.ts';
import type { Game } from '../server/src/game/Game.ts';
import { grappleWhy } from '../server/src/game/grapple.ts';
import { NPC_CHAIN_TO_CAPTAIN, NPC_HELM_REACH, NPC_OPEN_FIRE, engage } from '../server/src/game/npc.ts';
import { pursuitOf, startPursuit, stopPursuit } from '../server/src/game/pursuit.ts';
import { duelSea, openWater, putSide } from './balance/duel.ts';
import { LEVEL_HULL, seaCaptain } from './balance/seafight.ts';
import { join, makeGame } from './helpers.ts';

function atSea(game: Game, name: string) {
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
  ship.crew = ship.stats.crewMax;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return { c, s, ship };
}

// ------------------------------------------------------------------------------------------------ 1. +100 m

test('1: every gun with every shot reaches +100 m (after every ×), the mounts +100 m, the aimed orders +100 m, the sea\'s own open fire from 250 m', () => {
  assert.equal(REACH_BONUS, 100);
  const { game } = makeGame();
  const { ship } = atSea(game, 'Reach Rhea');
  for (const g of Object.keys(GUNS) as GunId[]) {
    ship.loadout.guns.port = g;
    for (const a of AMMO_IDS) {
      const chain = a === 'chain' ? 1 + tx(ship.stats, 'chainRange') : 1;
      const old = GUNS[g].range * ship.stats.rangeMul * AMMO[a].rangeMul * chain;
      assert.ok(Math.abs(effectiveRange(ship, 'port', a) - (old + 100)) < 1e-6, `${g}/${a}: ${effectiveRange(ship, 'port', a)} vs ${old}`);
    }
  }
  // the long 9-pounder: 205 → 305 m with round, grape 113 → 213 m; the client's own reckoning is the same function
  assert.equal(gunRange(205), 305);
  assert.equal(Math.round(gunRange(205, 1, AMMO.grape.rangeMul)), 213);
  // the mounts (their data): the long tom 400 m, the mortar 550 m (its least 125 m as it was), the harpoon 185 m
  assert.equal(MOUNTS.long_tom.range, 400);
  assert.equal(MOUNTS.mortar.range, 550);
  assert.equal(MOUNTS.mortar.minRange, 125);
  assert.equal(MOUNTS.harpoon.range, 185);
  assert.equal(MOUNTS.smoke_pots.range, 0, 'where she lies, as it was');
  // the sea's own: open fire from 250 m (was 150), the fighting helm's band where it was (≤150 m: on her screen)
  assert.equal(NPC_OPEN_FIRE, 250);
  assert.equal(NPC_HELM_REACH, 150);
  // the close fight's band keeps its metres: at most 140 m, its far edge inside the reach
  const b = closeRange(gunRange(205));
  assert.ok(b.best <= 140 && b.far <= 305, JSON.stringify(b));
});

// ------------------------------------------------------------------------------------------------ 2. boarding at 100 m

test('2: «На абордаж» within 100 m of her hull only («Подойдите ближе: N м» past it); the grapples haul the two alongside in 2–4 s, she cannot sail off, then the battle', () => {
  assert.equal(BOARD_OFFER, 100);
  assert.equal(grappleSecs(0), 2);
  assert.equal(grappleSecs(100), 4);
  const { game } = makeGame();
  const { c, ship } = atSea(game, 'Hook Hana');
  game.profileOf(ship)!.pvp.flag = 'pirate'; // forum 34: a peaceful ship is the pirate flag's prey only
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const npc = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + v.x * 200, ship.state.y + v.y * 200, ship.state.heading + 0.8);
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  const gapFar = hullsGap(hullOf(ship), hullOf(npc));
  assert.ok(gapFar > BOARD_OFFER + 10);
  assert.equal(grappleWhy(game, ship, npc), `Come closer: ${Math.ceil(gapFar - BOARD_OFFER)} m`);
  c.push({ t: 'board', target: npc.id, aggression: 'standard', risk: true });
  assert.ok(!ship.grapple && !ship.boarding && !pursuitOf(ship), 'nothing past 100 m');
  // 95 m of water between the hulls, her bow 46° off the mark's beam (not alongside: the old rule said no)
  const d = 95 + (ship.stats.beam + npc.stats.beam) / 2 + 2;
  npc.state.x = ship.state.x + v.x * d;
  npc.state.y = ship.state.y + v.y * d;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  assert.ok(hullsGap(hullOf(ship), hullOf(npc)) <= BOARD_OFFER, 'within the offer');
  assert.equal(grappleWhy(game, ship, npc), null);
  c.push({ t: 'board', target: npc.id, aggression: 'standard', risk: true });
  const grap = () => (ship as { grapple: { attacker: boolean } | null }).grapple;
  assert.ok(grap()?.attacker && (npc as { grapple: unknown }).grapple && !ship.boarding, 'the approach first');
  const evs = () => c.all('ev').flatMap((m) => m.list);
  for (let i = 0; i < 3; i++) game.step();
  assert.ok(evs().some((e) => e.k === 'grapple' && e.a === ship.id && e.b === npc.id), 'the grapples seen');
  // nobody else boards either of them while the lines hold
  assert.match(String(grappleWhy(game, ship, npc)), /Already locked/);
  // the mark crowds on sail to run: still hauled in
  npc.input = { rudder: 0.6, sailTarget: 1 };
  const t0 = game.now;
  let mid = -1;
  for (let i = 0; i < 20 * 6 && !ship.boarding; i++) {
    game.step();
    if (mid < 0 && game.now - t0 > 1.4) mid = hullsGap(hullOf(ship), hullOf(npc));
  }
  const took = game.now - t0;
  const bd = (ship as { boarding: { with: number } | null }).boarding;
  assert.ok(bd && bd.with === npc.id, 'the battle once alongside');
  assert.ok(took >= 1.9 && took <= 4.2, `the approach ${took.toFixed(1)} s`);
  assert.ok(mid > 5 && mid < 95, `mid-approach the gap closes (${mid.toFixed(0)} m)`);
  assert.ok(hullsGap(hullOf(ship), hullOf(npc)) < 25, `alongside at the battle (${hullsGap(hullOf(ship), hullOf(npc)).toFixed(0)} m)`);
  assert.equal(grap(), null);
});

test('2: «Атаковать → абордаж» (the intercept) sails her in and throws the grapples at 100 m — the approach, never the battle from afar', () => {
  const { game } = makeGame();
  const { s, ship } = atSea(game, 'Intercept Ida');
  game.profileOf(ship)!.pvp.flag = 'pirate'; // forum 34: a peaceful ship is the pirate flag's prey only
  const v = headingVec(ship.state.heading - Math.PI / 2);
  const npc = game.spawnNpcShip('merchant', 'brig', 'league', ship.state.x + v.x * 600, ship.state.y + v.y * 600, ship.state.heading);
  npc.crew = Math.ceil(npc.stats.crewMax * 0.3);
  npc.input = { rudder: 0, sailTarget: 0 };
  npc.state.speed = 0;
  game.npcs.get(npc.id)!.keep = true;
  game.grid.upsert(npc.id, npc.state.x, npc.state.y);
  assert.equal(startPursuit(game, s, npc.id, 'board'), null);
  pursuitOf(ship)!.grapple = true;
  let thrownAt = -1;
  for (let i = 0; i < 20 * 90 && !ship.boarding && !npc.surrendered; i++) {
    game.step();
    if (ship.grapple && thrownAt < 0) thrownAt = hullsGap(hullOf(ship), hullOf(npc));
  }
  if (npc.surrendered && !ship.boarding) return; // (she struck on the way in: her terms, not the grapples)
  assert.ok(thrownAt >= 0, 'the grapples thrown before the battle');
  assert.ok(thrownAt <= BOARD_OFFER + 10, `thrown within 100 m (${thrownAt.toFixed(0)})`);
  assert.ok(ship.boarding, 'the battle');
  stopPursuit(game, s, 'off');
});

// ------------------------------------------------------------------------------------------------ 3. the canvas

test('3: round shot tears an eighth of the canvas it did; chain the most, grape now too; a broadside\'s canvas capped (chain 10 %, grape 3.5 %, round 1 %)', () => {
  assert.equal(AMMO.round.sailMul, 0.01, 'was 0.08');
  assert.equal(AMMO.chain.sailMul, 0.45);
  assert.equal(AMMO.grape.sailMul, 0.22, 'was 0.06');
  for (const a of AMMO_IDS) if (a !== 'chain' && a !== 'grape' && a !== 'bar') assert.ok(AMMO[a].sailMul <= 0.025, `${a}: ${AMMO[a].sailMul}`);
  assert.ok(sailVolleyCap('chain') > sailVolleyCap('bar') && sailVolleyCap('bar') > sailVolleyCap('grape') && sailVolleyCap('grape') > sailVolleyCap('round'));
  assert.equal(sailVolleyCap('round'), SAIL_VOLLEY_CAP.other);
  assert.equal(sailVolleyCap('heavy'), 0.01);
  assert.equal(NPC_CHAIN_TO_CAPTAIN, 0.8);
});

test('3: a captain comes out of a pirate of her level with most of her canvas — two such fights and more than half is left', () => {
  const game = duelSea();
  const rows: string[] = [];
  for (const level of [1, 5]) {
    const cls = LEVEL_HULL[level];
    for (let k = 0; k < 2; k++) {
      const at = openWater(game, k + level * 10);
      const h = (k * 2.399) % (Math.PI * 2);
      const s = seaCaptain(game, cls, level, at.x, at.y, h);
      const me = s.ship!;
      const B = putSide(game, { cls, level, craft: 'bot' }, at.x + Math.sin(h + 1.3) * 600, at.y - Math.cos(h + 1.3) * 600, h + Math.PI);
      B.brain.role = 'pirate';
      me.lastStandUntil = Infinity;
      startPursuit(game, s, B.ship.id, 'guns');
      const t0 = game.now;
      let next = 0;
      while (game.now - t0 < 150 && me.alive && me.hull > 1 && B.ship.alive && !me.boarding) {
        if (game.now >= next) {
          next = game.now + 0.5;
          engage(game, B.ship, B.brain, me, Math.hypot(me.state.x - B.ship.state.x, me.state.y - B.ship.state.y));
        }
        game.step();
      }
      const sails = me.sails / me.stats.sailHpMax;
      rows.push(`⚓${level} ${cls}: sails ${Math.round(sails * 100)}% after ${Math.round(game.now - t0)} s`);
      assert.ok(sails >= 0.72, rows.at(-1));
      stopPursuit(game, s, 'off');
      if (game.ships.has(B.ship.id)) game.removeShip(B.ship.id);
      me.lastStandUntil = 0;
      me.docked = 'saltmarrow';
      me.state.x = 500;
    }
  }
  console.log(rows.join('\n'));
});

// ------------------------------------------------------------------------------------------------ 4. +25 % HP

test('4: the sea\'s own ships +25 % hull and canvas (×0.5 → ×0.625); a captain\'s own escort keeps ×0.5', () => {
  assert.equal(NPC_HP_MUL, 0.625);
  assert.equal(NPC_OWNED_HP_MUL, 0.5);
  const { game } = makeGame();
  for (const role of ['pirate', 'merchant', 'patrol'] as const) {
    const npc = game.spawnNpcShip(role, 'brig', 'league', 30000, 80000 + 300, 0);
    const halved = npc.stats.hullMax, sails = npc.stats.sailHpMax;
    npc.npcHalved = false;
    npc.recompute(game.now);
    const whole = npc.stats.hullMax, wholeSails = npc.stats.sailHpMax;
    assert.ok(Math.abs(halved / whole - 0.625) < 0.01, `${role}: ${halved} of ${whole}`);
    assert.ok(Math.abs(sails / wholeSails - 0.625) < 0.02, `${role} canvas: ${sails} of ${wholeSails}`);
    npc.ownerId = 1; // a captain's own (escort, prize, guard)
    npc.recompute(game.now);
    const ownedWhole = npc.stats.hullMax;
    npc.npcHalved = true;
    npc.recompute(game.now);
    assert.ok(Math.abs(npc.stats.hullMax / ownedWhole - 0.5) < 0.01, `${role} owned: ${npc.stats.hullMax} of ${ownedWhole}`);
    game.removeShip(npc.id);
  }
});
