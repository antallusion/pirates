// Owner, 2026-10-22: «любое действие, типа там победа над кораблем, над нпс, абордаж, посещение чего либо, рыбалка,
// короче вообще все это должно останавливать корабль … я могу доплыть до сражения с нпс, начать битву там условно с
// тюленями, победить и мой корабль после того как окно закроется победное — продолжает плыть» (server allstop.ts).
//
// Every scene: she comes to the thing under sail, her phone beating its helm four times a second with the old sail step;
// the thing is done (a fight won and its card closed, a boarding, a net cast, a wreck worked, a waystation); the phone
// keeps sending that step — and her way comes off and stays off for a minute. A new step of hers sails her at once.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAIL_STEPS, TICK_RATE } from '../shared/src/constants.ts';
import { FISH } from '../shared/src/data/fishing.ts';
import type { Item } from '../shared/src/data/items.ts';
import { OBJ_R, REACH_OBJ } from '../shared/src/data/reach.ts';
import { WAY_MOOR_RANGE, waystations } from '../shared/src/world/waystations.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { STOP_CARDS, STOP_ORDERS, lastAllStop, stopsOrder } from '../server/src/game/allstop.ts';
import { approachOf } from '../server/src/game/approach.ts';
import { autosailOf, pausedCourse, startAutosail } from '../server/src/game/autosail.ts';
import { closeFight, landFighting, landTac } from '../server/src/game/beastlairs.ts';
import { startBoarding } from '../server/src/game/boarding.ts';
import { shoalsOf, stepFishing } from '../server/src/game/fishing.ts';
import { routeOf } from '../server/src/game/goalroute.ts';
import { battleBlocked, untouchable } from '../server/src/game/inbattle.ts';
import { pursuitOf } from '../server/src/game/pursuit.ts';
import { markBusy, markById } from '../server/src/game/seamarks.ts';
import { mooredAt } from '../server/src/game/waystations.ts';
import { roamWhereId } from '../server/src/game/roamers.ts';
import { quietAdv } from '../server/src/game/advmap.ts';
import type { FakeConn } from './helpers.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

function captain(game: Game, name: string, cls = 'brig'): { s: PlayerSession; c: FakeConn; ship: ShipEntity } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.profile!.gold = 5000;
  if (s.profile!.tutorial) s.profile!.tutorial.on = false;
  onHull(game, s.ship!, cls, 4);
  runAdmin(game, s, '/tp gravewater');
  const ship = s.ship!;
  ship.protectedUntil = 0;
  ship.lastCombat = -1000;
  return { s, c, ship };
}

/** No other ship about her and none coming (the scene is the stop, not a pirate's fight). */
function clearSea(game: Game, ship: ShipEntity): void {
  for (const o of [...game.ships.values()]) if (o !== ship && Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < 4000) game.removeShip(o.id);
  game.directorOn = false;
  ship.protectedUntil = game.now + 1e6;
}

let seq = 1;
/** Her phone's helm: rudder amidships, `sail`, every quarter second for `sec` seconds; the most way she had. */
function beat(game: Game, s: PlayerSession, c: FakeConn, sail: number, sec: number, each?: () => void): number {
  let max = 0;
  for (let i = 0; i < sec * TICK_RATE; i++) {
    if (i % 5 === 0) {
      s.msgCount = 0; // (the flood guard counts by the wall's clock)
      c.push({ t: 'input', rudder: 0, sail, seq: ++seq });
    }
    each?.();
    game.step();
    max = Math.max(max, Math.abs(s.ship!.state.speed));
  }
  return max;
}

/** She lies still: her way off within 25 s and none for a minute after, her phone still sending its old `sail`; no
 *  course of the helmsman's, none kept to be taken up, no run to a goal; and a new step of hers sails her at once. */
function liesStill(game: Game, s: PlayerSession, c: FakeConn, sail: number, what: string): void {
  const ship = s.ship!;
  beat(game, s, c, sail, 25);
  assert.ok(ship.state.speed < 0.1, `${what}: the way off her (${ship.state.speed.toFixed(2)})`);
  const max = beat(game, s, c, sail, 60);
  assert.ok(max < 0.1, `${what}: still for 60 s with her phone sending sail ${sail} (at most ${max.toFixed(2)})`);
  assert.equal(ship.input.sailTarget, 0, `${what}: no canvas`);
  assert.equal(autosailOf(ship), null, `${what}: no helmsman's course`);
  assert.equal(pausedCourse(ship), null, `${what}: no course kept to be taken up`);
  assert.equal(routeOf(game, s), null, `${what}: no run to a goal`);
  assert.equal(pursuitOf(ship), null, `${what}: no «Атаковать»`);
  assert.ok(c.all('allstop').length > 0, `${what}: her phone told to put its sail down`);
  // her own hand: another step sails her at once
  const other = sail === 2 ? 3 : 2;
  c.push({ t: 'input', rudder: 0, sail: other, seq: ++seq });
  assert.equal(ship.input.sailTarget, SAIL_STEPS[other], `${what}: a new sail step sets sail at once`);
  beat(game, s, c, other, 6);
  assert.ok(ship.state.sail >= SAIL_STEPS[other] - 0.01, `${what}: her canvas set again (${ship.state.sail.toFixed(2)})`);
}

// ------------------------------------------------------------------ the table: every action is hooked

test('allStop: the table of the orders and cards that stop her — every one a real order or card of the protocol', () => {
  const proto = ['protocol', 'h4proto', 'lairproto', 'driftproto', 'findproto', 'roamproto', 'wayproto', 'isleproto'].map((f) => readFileSync(`shared/src/${f}.ts`, 'utf8')).join('\n');
  // [what the owner named, the order, its action]
  const orders: [string, string, string | null][] = [
    ['a landing, a dig, a wreck raised ashore', 'land', null],
    ['a bottle, flying fish, a fog searched, a shoal marked, castaways, a chest afloat', 'seafind', 'work'],
    ['a wreck field, a sea mark', 'seamark', 'work'],
    ['a lair ashore', 'lair', 'fight'],
    ['a drift (seals on a floe)', 'drift', 'fight'],
    ['a drift\'s rescue', 'drift', 'way'],
    ['a creature stack', 'roam', 'attack'],
    ['a creature stack joined', 'roam', 'join'],
    ['a map object', 'h4', 'visit'],
    ['a map object\'s guard', 'h4', 'guard'],
    ['the Grail\'s dig', 'h4', 'dig'],
    ['a waystation', 'way', 'moor'],
    ['the net cast', 'fishing', 'cast'],
    ['a trap hauled', 'fishing', 'haul'],
    ['a carcass flensed', 'hunt', 'flense'],
    ['a tribute paid', 'tribute', null],
    ['a struck ship\'s terms', 'surrender', null],
    ['a boarding\'s spoils', 'loot_take', null],
    ['a ceasefire bought', 'ceasefire', 'pay'],
    ['an encounter', 'encounter', null],
    ['an island claimed', 'estate', 'buy'],
    ['a floating house supplied', 'isle18', 'supply'],
    ['a group mate\'s boarding joined', 'board_join', null],
  ];
  for (const [what, t, action] of orders) {
    assert.ok(stopsOrder({ t, ...(action ? { action } : {}) }), `${what}: stops her`);
    assert.match(proto, new RegExp(`t: '${t}'${action ? `; (action|op): [^}]*'${action}'` : ''}`), `${what}: a real order`);
  }
  for (const t of Object.keys(STOP_ORDERS)) assert.match(proto, new RegExp(`t: '${t}'`), `${t}: a real order`);
  // the orders that do nothing at sea do not
  for (const m of [{ t: 'input' }, { t: 'chat' }, { t: 'way', action: 'view' }, { t: 'seafind', action: 'cancel' }, { t: 'hunt', action: 'slack' }, { t: 'estate', action: 'view' }, { t: 'autosail' }, { t: 'goto' }]) assert.ok(!stopsOrder(m), `${m.t} ${'action' in m ? m.action : ''}: no stop`);
  // the cards
  const cards: [string, string][] = [['a boarding\'s spoils', 'boarding'], ['a struck ship\'s terms', 'surrender_offer'], ['an encounter', 'encounter'], ['a fish on the line', 'fishfight'],
    ['the net hauled', 'nethaul'], ['a trek ashore', 'trek'], ['a dive', 'dive'], ['a duel', 'duel'], ['a battle\'s field', 'board_tac'], ['a boarding round by round', 'board_fight'], ['a find\'s game', 'minigame']];
  for (const [what, t] of cards) {
    assert.ok(STOP_CARDS[t], `${what}: its card stops her`);
    assert.match(proto, new RegExp(`t: '${t}'; ${STOP_CARDS[t]}: `), `${what}: a real card`);
  }
  // the battles' start and end, read
  const src = (f: string) => readFileSync(`server/src/game/${f}.ts`, 'utf8');
  assert.match(src('inbattle'), /export function battleEnded[\s\S]{0,500}allStopShip\(game, ship, 'battle_end'\)/, 'every battle\'s end');
  assert.match(src('boarding'), /allStopShip\(game, a, 'boarding'\)[\s\S]{0,80}allStopShip\(game, b, 'boarding'\)/, 'a boarding\'s start');
  assert.equal((src('beastlairs').match(/S\.fights\.set\([^\n]*\n\s*allStop\(game, s, 'battle'/g) ?? []).length, 2, 'a fight ashore\'s start (lairs, stacks, drifts, seals, shore bosses)');
  assert.match(src('arena'), /allStopShip\(game, A, 'battle', 'arena'\)/, 'the arena');
  assert.match(src('pvp'), /allStop\(game, s, 'battle_end', 'duel'\)/, 'a duel\'s end');
  const game = src('Game');
  assert.ok(game.includes("allStop(this, s, 'sunk', '', victim.id)"), 'a ship sunk by her');
  assert.ok(game.includes('cardSent(this, s, msg)'), 'every card sent');
  assert.ok(game.includes('orderDone(this, s, msg, h.refused === true, approachOf(this, s)?.msg === msg || s.whenClear?.msg === msg)'), 'every order done (not one still sailed to)');
  // the page: its sail control down
  const main = readFileSync('client/src/main.ts', 'utf8');
  assert.match(main, /case 'allstop':\s*allStopHere\(\);/);
  assert.match(main, /function allStopHere\(\): void \{[\s\S]{0,120}state\.input\.sail = 0;[\s\S]{0,40}state\.input\.rudder = 0;\s*touch\.course = null;/);
});

// ------------------------------------------------------------------ the scenes

test('allStop: seals on a floe — sailed to, fought and won, the card closed: with her phone still sending its old sail she lies still a minute; nobody may touch her during and right after', () => {
  const { game } = makeGame();
  quietAdv(game, false);
  const { s, c, ship } = captain(game, 'Seal Sally');
  clearSea(game, ship);
  s.profile!.army = [{ u: 'marine', n: 60 }] as never;
  runAdmin(game, s, '/drift seal_floe go');
  const d = (c.last('drifts') as { list: { id: number; x: number; y: number; kind: string }[] }).list.find((x) => x.kind === 'seal_floe')!;
  assert.ok(d, 'seals adrift off her bow');
  // she comes in under sail, a helmsman's course set past them besides
  assert.equal(startAutosail(game, s, ship.state.x + 3000, ship.state.y), null);
  beat(game, s, c, 3, 1);
  c.push({ t: 'drift', action: 'fight', id: d.id });
  let t = 0;
  for (; t < 90 * TICK_RATE && !landFighting(game, s); t++) beat(game, s, c, 3, 1 / TICK_RATE);
  assert.ok(landFighting(game, s), `the fight ashore (${c.all('toast').slice(-3).map((m) => (m as { msg: string }).msg).join(' | ')})`);
  assert.ok(lastAllStop(s), 'its start stops her');
  assert.equal(ship.input.sailTarget, 0);
  assert.equal(autosailOf(ship), null, 'the helmsman’s course dropped at its start');
  // nobody touches her in it (inbattle.ts)
  const pirate = game.spawnNpcShip('pirate', 'brig', 'free', ship.state.x + 300, ship.state.y, 0);
  assert.ok(untouchable(game, ship) && battleBlocked(game, pirate, ship), 'untouchable in the fight');
  game.removeShip(pirate.id);
  landTac(game, s, { a: 'quick' }, true);
  beat(game, s, c, 3, 1);
  assert.equal(lastAllStop(s)?.why, 'battle_end', 'its end stops her');
  assert.ok(untouchable(game, ship), 'untouchable with the reckoning up');
  // the card put away (her «Закрыть»)
  c.push({ t: 'tac_done' });
  closeFight(game, s);
  assert.ok(!landFighting(game, s), 'the card closed');
  assert.ok(untouchable(game, ship), 'a moment\'s grace after it');
  liesStill(game, s, c, 3, 'seals');
});

test('allStop: a creature stack — «Атаковать» from afar, the battle won and closed: no course taken up by itself, she lies still', () => {
  const { game } = makeGame();
  quietAdv(game, false);
  const { s, c, ship } = captain(game, 'Stack Stan');
  clearSea(game, ship);
  s.profile!.army = [{ u: 'marine', n: 80 }] as never;
  runAdmin(game, s, '/stack go');
  const sp = (c.last('roams') as { list: { id: number }[] }).list[0];
  assert.ok(sp, 'a stack near');
  // half a kilometre off it, under full sail
  const p = roamWhereId(game, sp.id)!;
  ship.state = { ...ship.state, x: p.x, y: p.y - (OBJ_R + ship.stats.beam / 2 + 500), heading: Math.PI / 2, speed: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  beat(game, s, c, 4, 3);
  c.push({ t: 'attack', roam: sp.id });
  assert.ok(pursuitOf(ship), 'the helmsman sails her in');
  for (let i = 0; i < 120 && !landFighting(game, s); i++) beat(game, s, c, 4, 1);
  assert.ok(landFighting(game, s), 'the battle opens');
  landTac(game, s, { a: 'quick' }, true);
  beat(game, s, c, 4, 1);
  closeFight(game, s);
  liesStill(game, s, c, 4, 'a stack');
});

test('allStop: a boarding won and its spoils taken — she lies still; a course she had before it is not taken up', () => {
  const { game } = makeGame();
  const { s, c, ship } = captain(game, 'Board Bea');
  clearSea(game, ship);
  ship.crew = ship.stats.crewMax;
  assert.equal(startAutosail(game, s, ship.state.x + 3000, ship.state.y), null);
  beat(game, s, c, 3, 3);
  const npc = game.spawnNpcShip('merchant', 'sloop', 'league', ship.state.x, ship.state.y + 40, ship.state.heading);
  npc.crew = 2;
  startBoarding(game, ship, npc, 'standard');
  assert.ok(ship.boarding, 'grappled');
  assert.ok(['boarding', 'card'].includes(lastAllStop(s)?.why ?? ''), 'its start stops her');
  assert.equal(autosailOf(ship), null, 'her course dropped');
  for (let i = 0; i < 300 && (ship.boarding || ship.grappled); i++) beat(game, s, c, 3, 1);
  assert.ok(!ship.boarding, 'the boarding over');
  if (s.pendingBoarding) c.push({ t: 'loot_take', take: {}, fate: 'sink' });
  liesStill(game, s, c, 3, 'a boarding');
});

test('allStop: the net cast over a shoal — she lies still', () => {
  const { game } = makeGame();
  const { s, c, ship } = captain(game, 'Net Nell');
  clearSea(game, ship);
  s.profile!.loadout.gear = { ...s.profile!.loadout.gear, tackle: { uid: 1, base: 'drift_net', ilvl: 1, rarity: 1, affixes: [], dur: 100 } as Item };
  let sh = null as ReturnType<typeof shoalsOf>[number] | null;
  for (let k = 0; k < 40 && !sh; k++) {
    stepFishing(game);
    game.now += 10;
    sh = shoalsOf(game).find((a) => FISH[a.fish].methods.includes('net') && FISH[a.fish].skill <= 1) ?? null;
  }
  assert.ok(sh, 'a net shoal');
  sh!.vx = sh!.vy = 0;
  sh!.until = game.now + 99999;
  sh!.stock = sh!.max = 999;
  ship.state = { ...ship.state, x: sh!.x, y: sh!.y, speed: ship.stats.maxSpeed * 0.25 };
  game.grid.upsert(ship.id, sh!.x, sh!.y);
  c.push({ t: 'input', rudder: 0, sail: 1, seq: ++seq });
  c.push({ t: 'fishing', action: 'cast' });
  assert.ok(c.last('nethaul')?.view, `the net goes out (${c.all('toast').slice(-2).map((m) => (m as { msg: string }).msg).join(' | ')})`);
  assert.equal(lastAllStop(s)?.what, 'fishing:cast');
  // the haul played out on her screen and in
  const v = c.last('nethaul')!.view!;
  beat(game, s, c, 1, 20);
  c.push({ t: 'fishing', action: 'net', id: v.id, pulls: [] });
  liesStill(game, s, c, 1, 'the net');
});

test('allStop: a wreck field worked from afar — the helmsman takes her in, the boats work it, and then she lies still', () => {
  const { game } = makeGame();
  const { s, c, ship } = captain(game, 'Wreck Wren');
  clearSea(game, ship);
  const id = Number(/mark (\d+)/.exec(runAdmin(game, s, '/seamark wreck go') ?? '')?.[1]);
  const m = markById(game, id)!;
  ship.state = { ...ship.state, x: m.x, y: m.y - (m.r + ship.stats.beam / 2 + 400), heading: Math.PI / 2, speed: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  c.push({ t: 'seamark', action: 'work', id });
  assert.ok(approachOf(game, s), 'sailing in');
  assert.equal(lastAllStop(s), null, 'not stopped while she sails to it');
  let i = 0;
  // (her phone takes the helmsman's sail from his word — main.ts — and beats it on)
  const hs = (c.last('autosail') as { sail?: number } | undefined)?.sail ?? 3;
  for (; i < 150 && !markBusy(game, s); i++) beat(game, s, c, hs, 1);
  assert.ok(markBusy(game, s), 'the boats at it');
  assert.equal(lastAllStop(s)?.what, 'seamark:work', 'done on arrival: she lies still');
  liesStill(game, s, c, hs, 'a wreck field');
});

test('allStop: a waystation moored at and left — she lies still until her own hand sets sail', () => {
  const { game } = makeGame();
  const { s, c, ship } = captain(game, 'Way Wanda');
  const w = waystations(game.world).list.find((x) => x.region === 'gravewater')!;
  ship.state = { ...ship.state, x: w.x + WAY_MOOR_RANGE + OBJ_R + REACH_OBJ - 40, y: w.y, speed: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  clearSea(game, ship);
  beat(game, s, c, 2, 2);
  c.push({ t: 'way', action: 'moor', id: w.id });
  for (let i = 0; i < 120 && !mooredAt(game, s); i++) beat(game, s, c, 2, 1);
  assert.equal(mooredAt(game, s)?.id, w.id, 'moored');
  assert.equal(lastAllStop(s)?.what, 'way:moor');
  c.push({ t: 'way', action: 'leave' });
  liesStill(game, s, c, 2, 'a waystation');
});

test('allStop: an order still sailed to does not stop her; one refused does nothing', () => {
  const { game } = makeGame();
  const { s, c, ship } = captain(game, 'Far Fay');
  clearSea(game, ship);
  const id = Number(/mark (\d+)/.exec(runAdmin(game, s, '/seamark wreck go') ?? '')?.[1]);
  const m = markById(game, id)!;
  ship.state = { ...ship.state, x: m.x, y: m.y - 900, heading: Math.PI / 2, speed: 0 };
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  c.push({ t: 'seamark', action: 'work', id });
  assert.ok(autosailOf(ship), 'the helmsman sails her there');
  assert.equal(lastAllStop(s), null);
  c.push({ t: 'seamark', action: 'work', id: 999_999 });
  assert.equal(lastAllStop(s), null, 'a refused order stops nothing');
  assert.ok(autosailOf(ship), 'still sailing there');
  steps(game, 2);
});
