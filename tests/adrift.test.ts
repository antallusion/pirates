// Torn sails with no sailcloth (owner, 2026-10-20: «без парусины корабль ваще не плывет, надо что-то с этим сделать.
// может какое-то самоуничтожение. кстати в обломках которые раскиданы по морю надо сделать так чтобы помимо бабок всегда
// было чутка парусины и дерева»): the speed floor, the jury rig, the stranded prompt, scuttling home, the wreckage's
// sailcloth and planks, the words in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOTH_SCRAP, JURY_BELOW, JURY_SEC, JURY_TO, SAIL_FLOOR, SCUTTLE_CD_MS, STRANDED_FAR, STRANDED_SEC, isStranded, juryStep, juryWanted,
  sailHealthMul, sailShape, scuttleQuote, scuttleWhy, wreckExtras,
} from '../shared/src/data/adrift.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { targetSpeed } from '../shared/src/sim/sailing.ts';
import type { SailParams } from '../shared/src/sim/sailing.ts';
import { cargoValue } from '../shared/src/sim/shipstats.ts';
import { WRECK_CELLS } from '../shared/src/data/wrecks.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { canDock } from '../server/src/game/player.ts';
import { JURY_DONE, JURY_START, juryRigging, stepAdrift } from '../server/src/game/adrift.ts';
import { cellSpots, takeWreck } from '../server/src/game/wrecks.ts';
import { scatterWreckage } from '../server/src/game/events.ts';
import { buildActs } from '../client/src/ui/actbar.ts';
import { adriftFacts, adriftInfo } from '../client/src/ui/adrift.ts';
import { EN as AEN, RU as ARU } from '../client/src/lang/ui/adrift.ts';
import { SERVER_RU_ADRIFT } from '../client/src/lang/server.ru.adrift.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { applyDataLocale } from '../client/src/lang/data.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, steps } from './helpers.ts';

function atSea(game: Game, name: string): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.ship!.docked = null;
  s.profile!.docked = null;
  s.ship!.state.x = 30000;
  s.ship!.state.y = 80000;
  s.ship!.crew = s.ship!.stats.crewMax;
  return { c, s };
}

const toasts = (c: FakeConn, from = 0) => c.inbox.slice(from).filter((m) => m.t === 'toast') as { msg: string; kind: string }[];
const frac = (s: PlayerSession) => s.ship!.sails / s.ship!.stats.sailHpMax;

// ------------------------------------------------------------------------------------------------ the speed floor

const PARAMS: SailParams = {
  rig: 'square', maxSpeed: 14, accel: 1.5, turnRate: 0.3, noGoDeg: 65, sailChangeRate: 0.5, currentMul: 0, sailHealth: 1,
  rudderHealth: 1, crewFactor: 1, loadFactor: 1, speedMul: 1, personalWind: false, weatherly: false,
};
const STATE = { x: 0, y: 0, heading: Math.PI / 2, speed: 0, sail: 1, rudder: 0 };
const WIND = { dir: Math.PI / 2, strength: 0.7 };

test('the speed floor: at no sails she keeps 40 % of her way, never under 35 % with her crew and her hold — and never more than sound sails', () => {
  assert.equal(sailHealthMul(0), 0.4);
  assert.equal(sailHealthMul(1), 1);
  for (const crewFactor of [1, 0.6, 0.3, 0]) {
    for (const loadFactor of [1, 0.85, 0.7, 0.55]) {
      const sound = targetSpeed(STATE, { ...PARAMS, crewFactor, loadFactor }, WIND);
      const torn = targetSpeed(STATE, { ...PARAMS, crewFactor, loadFactor, sailHealth: 0 }, WIND);
      const fresh = targetSpeed(STATE, { ...PARAMS }, WIND); // her normal way: sound sails, full crew, empty hold
      assert.ok(torn < sound, `torn sails always cost something (crew ${crewFactor}, load ${loadFactor})`);
      const fit = (0.45 + 0.55 * crewFactor) * loadFactor;
      if (fit >= SAIL_FLOOR / 0.85) assert.ok(torn / fresh >= SAIL_FLOOR - 1e-9, `≥ 35 % of her way: ${(torn / fresh).toFixed(2)} (crew ${crewFactor}, load ${loadFactor})`);
    }
  }
  // the numbers of the report: a laden ship with a full crew (hold at 0.8), before (0.25 + 0.75·h) and now
  const before = 0.25 * 0.8, now = sailShape(0, 0.8);
  assert.ok(Math.abs(before - 0.2) < 1e-9);
  assert.ok(now >= 0.35 && now <= 0.4, `now ${now}`);
});

test('the chain shot still pays: shot to no sails, a sound ship with a full crew loses three-fifths of her way', () => {
  const sound = targetSpeed(STATE, PARAMS, WIND);
  const torn = targetSpeed(STATE, { ...PARAMS, sailHealth: 0 }, WIND);
  const half = targetSpeed(STATE, { ...PARAMS, sailHealth: 0.5 }, WIND);
  assert.ok(Math.abs(torn / sound - 0.4) < 1e-9, `${torn / sound}`);
  assert.ok(half / sound < 0.75 && half / sound > torn / sound, 'every bolt of sail shot away still slows her');
});

// ------------------------------------------------------------------------------------------------ the jury rig

test('the jury rig (pure): only under a fifth with no sailcloth; up to a quarter in a minute and never above', () => {
  assert.equal(juryWanted(0.1, 0, false), true);
  assert.equal(juryWanted(0.1, CLOTH_SCRAP, false), false, 'sailcloth aboard: the carpenters, not the rig');
  assert.equal(juryWanted(JURY_BELOW, 0, false), false, 'a fifth or more: no rig');
  assert.equal(juryWanted(0.22, 0, true), true, 'once rigging, on to a quarter');
  assert.equal(juryWanted(JURY_TO, 0, true), false);
  let f = 0;
  for (let t = 0; t < JURY_SEC; t++) f = juryStep(f, 1);
  assert.ok(Math.abs(f - JURY_TO) < 1e-9, `a quarter in ${JURY_SEC} s: ${f}`);
  assert.equal(juryStep(0.3, 10), 0.3, 'no free healing above a quarter');
  assert.equal(juryStep(f, 100), JURY_TO);
});

test('the jury rig at sea: sails shot away, no sailcloth — a quarter in a minute, a toast at each end, and again when shot away again', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Torn Tess');
  const ship = s.ship!;
  ship.cargo = {};
  ship.sails = 0;
  const t0 = c.inbox.length;
  steps(game, 20 * 30);
  assert.ok(juryRigging(ship), 'the crew is at it');
  assert.ok(frac(s) > 0.09 && frac(s) < 0.16, `half way after 30 s: ${frac(s).toFixed(3)}`);
  assert.ok(toasts(c, t0).some((t) => t.msg === JURY_START), 'the toast as they start');
  const ad = c.last('adrift');
  assert.ok(ad?.v && ad.v.jury !== null && ad.v.jury > 0.3 && ad.v.jury < 0.7, `the progress sent: ${JSON.stringify(ad?.v)}`);
  steps(game, 20 * 32);
  assert.ok(Math.abs(frac(s) - JURY_TO) < 0.005, `a quarter: ${frac(s).toFixed(3)}`);
  assert.ok(toasts(c, t0).some((t) => t.msg === JURY_DONE), 'the toast when it is set');
  assert.equal(juryRigging(ship), false);
  steps(game, 20 * 60);
  assert.ok(frac(s) <= JURY_TO + 0.005, `no higher than a quarter: ${frac(s).toFixed(3)}`);
  // shot away again: they rig again
  ship.sails = ship.stats.sailHpMax * 0.05;
  steps(game, 20 * 5);
  assert.ok(juryRigging(ship) && frac(s) > 0.05, 'rigged again');
});

test('no jury rig with sailcloth aboard, nor over a fifth of her sails; under fire the crew waits', () => {
  const { game } = makeGame();
  const { s } = atSea(game, 'Cloth Clem');
  const ship = s.ship!;
  ship.cargo = { sailcloth: 3 };
  ship.sails = 0;
  steps(game, 20 * 20);
  assert.equal(juryRigging(ship), false);
  assert.equal(ship.sails, 0, 'sailcloth aboard: nothing for free');
  ship.cargo = {};
  ship.sails = ship.stats.sailHpMax * 0.21;
  steps(game, 20 * 20);
  assert.equal(juryRigging(ship), false);
  assert.ok(Math.abs(frac(s) - 0.21) < 1e-6, 'over a fifth: nothing for free');
  ship.sails = 0;
  ship.lastHitAt = game.now; // under fire
  stepAdrift(game, s);
  const was = ship.sails;
  ship.lastHitAt = game.now;
  stepAdrift(game, s);
  assert.ok(juryRigging(ship));
  assert.equal(ship.sails, was, 'under fire the rig waits');
});

// ------------------------------------------------------------------------------------------------ stranded

test('stranded (pure): sails under a fifth and no sailcloth, and still for 20 s or far from a harbour', () => {
  const base = { sails: 0.05, cloth: 0, slowFor: 0, portDist: 1000 };
  assert.equal(isStranded(base), false, 'near a harbour and under way');
  assert.equal(isStranded({ ...base, slowFor: STRANDED_SEC }), true, 'lying still');
  assert.equal(isStranded({ ...base, portDist: STRANDED_FAR + 1 }), true, 'far from any harbour');
  assert.equal(isStranded({ ...base, portDist: 1e9, cloth: 1 }), false, 'sailcloth aboard');
  assert.equal(isStranded({ ...base, portDist: 1e9, sails: JURY_BELOW }), false, 'sails enough');
});

test('the stranded prompt: «Корабль без парусов» with the jury sail\'s progress, «Затопить · и в порт» and «В порт»', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Adrift Ada');
  s.ship!.cargo = {};
  s.ship!.sails = 0;
  steps(game, 20 * 3);
  const v = c.last('adrift')?.v;
  assert.ok(v, 'the view sent');
  const far = (game.nearestPort(s.ship!.state.x, s.ship!.state.y) ? Math.hypot(game.nearestPort(s.ship!.state.x, s.ship!.state.y)!.x - s.ship!.state.x, game.nearestPort(s.ship!.state.x, s.ship!.state.y)!.y - s.ship!.state.y) : 1e9) > STRANDED_FAR;
  if (far) assert.equal(v.stranded, true, 'far from any harbour: stranded');
  assert.ok(v.port, 'the harbour she would wake at');
  setLang('ru');
  const f = adriftFacts({ ...v, stranded: true }, 0)!;
  const acts = buildActs({ adrift: f, homeport: { name: 'Солтмарроу' } });
  assert.deepEqual(acts.map((a) => a.id), ['homeport', 'jury', 'scuttle']);
  assert.match(acts[1].label.replace(/\s/g, ' '), /^Аварийный парус \d+%$/);
  assert.equal(acts[2].label, 'Затопить');
  assert.match(adriftInfo(f).replace(/\s/g, ' '), /^Корабль без парусов · аварийный парус \d+% · \d+ с$/);
  // in a fight there is no scuttle button
  assert.ok(!buildActs({ adrift: f, attack: { name: 'X', pursuing: false, mode: 'board' } }).some((a) => a.id === 'scuttle'));
  // sails mended: the view goes
  s.ship!.sails = s.ship!.stats.sailHpMax;
  steps(game, 20 * 2);
  assert.equal(c.last('adrift')?.v, null);
  setLang('en');
});

// ------------------------------------------------------------------------------------------------ scuttling home

test('scuttling: not in a fight; out of it she goes down by the sinking\'s rules and wakes at the nearest friendly harbour; then a ten-minute wait', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Seacock Sal');
  const ship = s.ship!, p = s.profile!;
  ship.cargo = { rum: 10 };
  p.gold = 5000;
  // her last port far away: scuttled, she wakes at the nearest that will have her instead
  const near = game.nearestPort(ship.state.x, ship.state.y, (q) => canDock(p, q.faction).ok)!;
  const farPort = game.world.ports.filter((q) => canDock(p, q.faction).ok).sort((a, b) => Math.hypot(b.x - ship.state.x, b.y - ship.state.y) - Math.hypot(a.x - ship.state.x, a.y - ship.state.y))[0];
  p.lastPort = farPort.id;
  // in a fight: refused
  ship.lastCombat = game.now;
  c.push({ t: 'scuttle_home' });
  assert.ok(ship.alive && !ship.sinkingUntil, 'not under fire');
  assert.ok(toasts(c).some((t) => /Not in a fight/.test(t.msg)), 'said why');
  ship.lastCombat = -999;
  ship.lastHitAt = -999;
  const quote = scuttleQuote({ gold: p.gold, classPrice: SHIP_CLASSES[ship.loadout.classId].price, crew: ship.crew, cargoValue: cargoValue(ship.cargo), lifeboats: 0 });
  const crew0 = ship.crew;
  // (the silver she loses, by the ledger's lines of the sinking: a day's chart paid meanwhile is no part of it)
  const lost: Record<string, number> = {};
  const ledger = game.db.ledger.bind(game.db);
  game.db.ledger = ((acc: number, kind: string, n: number, ...rest: unknown[]) => {
    if (n < 0) lost[kind] = (lost[kind] ?? 0) - n;
    return (ledger as (...a: unknown[]) => unknown)(acc, kind, n, ...rest);
  }) as typeof game.db.ledger;
  c.push({ t: 'scuttle_home' });
  assert.ok(ship.sinkingUntil > 0, 'she goes down');
  steps(game, 20 * 12);
  const sunk = c.last('sunk_self');
  assert.ok(sunk?.scuttled, 'the scuttled card');
  assert.equal(sunk.respawnPort, near.id, 'the nearest friendly harbour, not her last');
  assert.equal(ship.docked, near.id);
  assert.equal(sunk.lost.repairFee, quote.fee, 'the yard\'s fee as the question said');
  // (within 2 %: a day's chart paid as she goes down swells the purse the tenth is taken of)
  const paid = (lost.loot_drop ?? 0) + (lost.sunk_purse ?? 0) + (lost.death ?? 0);
  assert.ok(Math.abs(paid - (quote.fee + quote.purse)) <= (quote.fee + quote.purse) * 0.02, `the fee and the purse, as the question said: ${JSON.stringify(lost)} vs ${quote.fee + quote.purse}`);
  assert.equal(crew0 - sunk.lost.crew, crew0 - quote.crew);
  assert.equal(Object.keys(ship.cargo).length, 0, 'the hold lost');
  // again at once: the wait
  ship.docked = null;
  p.docked = null;
  const n0 = c.inbox.length;
  c.push({ t: 'scuttle_home' });
  assert.ok(!ship.sinkingUntil, 'once in ten minutes');
  assert.ok(toasts(c, n0).some((t) => /not long ago/.test(t.msg)));
});

test('scuttleWhy: the fight first, then the wait', () => {
  const ok = { docked: false, sinking: false, boarding: false, combat: false, sinceMs: SCUTTLE_CD_MS };
  assert.equal(scuttleWhy(ok), null);
  assert.match(scuttleWhy({ ...ok, combat: true })!, /Not in a fight/);
  assert.match(scuttleWhy({ ...ok, boarding: true })!, /Not in a fight/);
  assert.match(scuttleWhy({ ...ok, sinceMs: 60_000 })!, /again in 9 min/);
  assert.match(scuttleWhy({ ...ok, docked: true })!, /in port/);
});

// ------------------------------------------------------------------------------------------------ the wreckage

test('every spot of the sea\'s wreckage carries 1–3 sailcloth and 2–5 planks besides its goods, by the sea\'s level', () => {
  assert.deepEqual(wreckExtras(1), { sailcloth: 1, planks: 2 });
  assert.deepEqual(wreckExtras(10), { sailcloth: 3, planks: 5 });
  for (let l = 1; l <= 10; l++) {
    const e = wreckExtras(l);
    assert.ok(e.sailcloth >= 1 && e.sailcloth <= 3 && e.planks >= 2 && e.planks <= 5, `level ${l}: ${JSON.stringify(e)}`);
  }
  const { game } = makeGame();
  let n = 0;
  for (let cy = 0; cy < WRECK_CELLS; cy += 3) {
    for (let cx = 0; cx < WRECK_CELLS; cx += 3) {
      for (const sp of cellSpots(game, 7, cx, cy)) {
        n++;
        assert.ok(sp.extras.sailcloth >= 1 && sp.extras.planks >= 2, `spot ${sp.id}: ${JSON.stringify(sp.extras)}`);
      }
    }
  }
  assert.ok(n > 50, `spots looked at: ${n}`);
});

test('taking a spot: the sailcloth and planks first; a full hold takes the silver and says what was left behind', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Salvor Sue');
  const ship = s.ship!;
  ship.cargo = {};
  takeWreck(game, s, { id: 1, x: 0, y: 0, good: 'rum', n: 4, extras: { sailcloth: 2, planks: 3 }, value: 0 });
  assert.equal(ship.cargo.sailcloth, 2);
  assert.equal(ship.cargo.planks, 3);
  assert.equal(ship.cargo.rum, 4);
  // the hold full of iron
  ship.cargo = { iron: 100000 };
  const gold0 = s.profile!.gold, n0 = c.inbox.length;
  takeWreck(game, s, { id: 2, x: 0, y: 0, good: 'rum', n: 4, extras: { sailcloth: 2, planks: 3 }, value: 0 });
  assert.ok(s.profile!.gold > gold0, 'the silver taken');
  assert.ok(toasts(c, n0).some((t) => /left behind 2 Sailcloth, 3 Planks/.test(t.msg)), toasts(c, n0).map((t) => t.msg).join(' | '));
});

test('every wreck on the water — a storm\'s, a sunk ship\'s — has the sailcloth and planks minimum', () => {
  const { game } = makeGame();
  scatterWreckage(game, game.world.ports[0].region, 6);
  const { s } = atSea(game, 'Gunner Gil');
  const npc = game.spawnNpcShip('merchant', 'sloop', 'crown', s.ship!.state.x + 300, s.ship!.state.y, 0);
  npc.cargo = { rum: 30 };
  npc.hull = 0;
  game.beginSinking(npc);
  const wrecks = [...game.loot.values()].filter((l) => l.wreck !== undefined);
  assert.ok(wrecks.length >= 2, `wrecks: ${wrecks.length}`);
  for (const l of wrecks) assert.ok((l.cargo.sailcloth ?? 0) >= 1 && (l.cargo.planks ?? 0) >= 2, JSON.stringify(l.cargo));
});

// ------------------------------------------------------------------------------------------------ the words

test('the words: every English line has its Russian, no Latin left in the Russian; the server\'s lines read in Russian', () => {
  for (const k of Object.keys(AEN) as (keyof typeof AEN)[]) {
    assert.ok(ARU[k], `RU ${k}`);
    assert.ok(!/[A-Za-z]/.test(ARU[k].replace(/\{\w+\}/g, '')), `Latin in RU ${k}: ${ARU[k]}`);
  }
  for (const [en, ru] of Object.entries(SERVER_RU_ADRIFT)) assert.ok(!/[A-Za-z]/.test(ru.replace(/\{\d\}/g, '')), `Latin in RU: ${en}`);
  setLang('ru');
  applyDataLocale('ru');
  const sp = (x: string) => x.replace(/\s/g, ' ');
  assert.equal(sp(serverText(JURY_START)), sp(SERVER_RU_ADRIFT[JURY_START]));
  assert.match(sp(serverText('You scuttled a ship not long ago: again in 7 min')), /снова через 7 мин/);
  assert.match(sp(serverText('No room in the hold: left behind 2 Sailcloth, 3 Planks & Pitch.')), /^В трюме нет места, на воде осталось: парусина — 2, доски и смола — 3\.$/);
  assert.match(serverText('Salvaged: 4 Rum, 2 Sailcloth, 3 Planks & Pitch.'), /^Поднято со дна: /);
  assert.ok(!/[A-Za-z]/.test(serverText('Salvaged: 4 Rum, 2 Sailcloth, 3 Planks & Pitch.')), serverText('Salvaged: 4 Rum, 2 Sailcloth, 3 Planks & Pitch.'));
  applyDataLocale('en');
  setLang('en');
});
