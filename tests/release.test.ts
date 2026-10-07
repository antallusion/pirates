// docs/23 phase 9 (items 93–96): what the review, the silent-failure hunt and the production audit found, each fix held
// by a test — the way out of port's purse, «Продать всё»'s lots and a quest's cargo, the easy fights across a
// reconnect, the pirates brought to an idle novice, the boarding run under the captain's own hand, an outdated tab, the
// QA's /foe in a safe sea.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASK_BELOW, RESERVE_MIN, departPlan } from '../client/src/ui/depart.ts';
import type { Offer } from '../client/src/ui/depart.ts';
import { sellAllOrders, sellableGoods } from '../client/src/ui/port.ts';
import type { ClientState } from '../client/src/state.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { FOE_BROUGHT_LIFE, FOE_IDLE, easyLeft, firstFightsSecond, softenFoe } from '../server/src/game/firstfights.ts';
import { pursuitInput, startPursuit } from '../server/src/game/pursuit.ts';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { duelSea, openWater, putSide } from './balance/duel.ts';
import { LEVEL_HULL, seaCaptain } from './balance/seafight.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r/g, '');

const offer = (kind: Offer['need']['kind'], cost: number, extra: Record<string, number> = {}): Offer => {
  const need = kind === 'repair' ? { kind, hull: extra.hull ?? 0.7, sails: extra.sails ?? 0.9 } : { kind, have: extra.have ?? 5, want: 30, buy: 25, minutes: 10 };
  return { need: need as Offer['need'], n: extra.n ?? 1, cost, msgs: [] };
};

test('the way out of port: repairs first, then food, a quarter of the purse kept back from shot and hands (item 96)', () => {
  // A newcomer's 200: the repairs (120) and the food (30) bought; shot and hands would eat the repair money.
  let p = departPlan([offer('food', 30), offer('crew', 40), offer('ammo', 20), offer('repair', 120)], 200);
  assert.deepEqual(p.buy.map((o) => o.need.kind), ['repair', 'food'], 'shot and hands wait: 50 left, 60 kept back');
  assert.equal(p.cost, 150);
  assert.equal(p.ask, false, 'nothing grave: she sails, and the line says what was bought');
  // A full purse buys it all, and keeps a quarter.
  p = departPlan([offer('food', 30), offer('crew', 40), offer('ammo', 20), offer('repair', 120)], 2000);
  assert.equal(p.buy.length, 4);
  assert.ok(2000 - p.cost >= RESERVE_MIN);
  // No silver for repairs: a scratched hull sails as she is, a hull under half is asked about.
  p = departPlan([offer('repair', 500, { hull: 0.7 })], 100);
  assert.equal(p.ask, false);
  p = departPlan([offer('repair', 500, { hull: ASK_BELOW - 0.1 })], 100);
  assert.equal(p.ask, true, 'a hull under half, unmended: asked');
  // No food aboard and none to be had: asked.
  assert.equal(departPlan([offer('food', 300, { have: 0 })], 100).ask, true);
  assert.equal(departPlan([offer('food', 300, { have: 12 })], 100).ask, false, 'some food aboard: she sails');
  // The departure sheet remembers she sailed anyway (not asked again for a while), and says what it bought.
  const dp = src('client/src/ui/depart.ts');
  assert.ok(dp.includes('sailedAnyway = { key: graveKey('));
  assert.ok(dp.includes("say(boughtLine(plan.buy, plan.cost), 'info')"));
  assert.ok(src('client/src/main.ts').includes('setDepartSay((msg, kind) => hud.toast(msg, kind));'));
});

/** A harbour and a captain as «Продать всё» sees them. */
function portState(cargo: Record<string, number>, quests: { id: string; step: number }[] = []): ClientState {
  const market = ['provisions', 'rum', 'gunpowder', 'sugar'].map((good) => ({ good, buy: 20, sell: 15, stock: 50, trend: 0, legal: true }));
  return {
    portView: { portId: 'p1', market, contracts: [], questOffers: [] },
    ports: [{ id: 'p1', blackMarket: false }],
    self: { cargo, contracts: [], quests, loadout: { classId: 'sloop' } },
  } as unknown as ClientState;
}

test('«Продать всё» keeps a quest\'s cargo aboard and sells in lots the harbour takes (items 93–94)', () => {
  // The Corsair's path: step 2 carries 20 barrels of powder to Blackwater.
  const st = portState({ rum: 1200, gunpowder: 20, sugar: 3 }, [{ id: 'q_path_corsair', step: 1 }]);
  assert.deepEqual(sellableGoods(st).map((x) => x.good).sort(), ['rum', 'sugar'], 'the powder stays for the quest');
  // Its deliver step behind her: the powder is hers to sell.
  assert.ok(sellableGoods(portState({ gunpowder: 20 }, [{ id: 'q_path_corsair', step: 3 }])).some((x) => x.good === 'gunpowder'));
  const orders = sellAllOrders(st) as { good: string; qty: number }[];
  assert.deepEqual(orders.filter((m) => m.good === 'rum').map((m) => m.qty), [-500, -500, -200], '1200 rum in three lots');
  assert.ok(orders.every((m) => Math.abs(m.qty) <= 500));
});

test('an easy fight begun before a reconnect still counts after it — the softening runs out (item 94)', () => {
  const game = duelSea();
  const L = 3;
  const at = openWater(game, 40);
  const s = seaCaptain(game, LEVEL_HULL[L], L, at.x, at.y, 0);
  s.profile!.tutorial.easy = 0; // she took the First Watch
  const foe = putSide(game, { cls: LEVEL_HULL[L], level: L, craft: 'bot' }, at.x + 600, at.y, Math.PI).ship;
  softenFoe(game, s.ship!, foe);
  assert.equal(foe.softFor, s.ship!.id);
  // A reconnect: a new session takes the same profile and ship over.
  const s2 = Object.assign(Object.create(Object.getPrototypeOf(s)), s) as typeof s;
  foe.hull = 0;
  game.beginSinking(foe);
  firstFightsSecond(game, s2);
  assert.equal(easyLeft(s2), 2, 'the fight counted for the ship, whatever session holds her');
  assert.equal(foe.softFor, undefined);
});

test('the easy fights: no group elite, no captain\'s own escort; a foe softened for a captain gone is free again (item 94)', () => {
  const game = duelSea();
  const at = openWater(game, 42);
  const s = seaCaptain(game, LEVEL_HULL[3], 3, at.x, at.y, 0);
  s.profile!.tutorial.easy = 0;
  const elite = putSide(game, { cls: LEVEL_HULL[3], level: 3, craft: 'bot' }, at.x + 600, at.y, Math.PI).ship;
  elite.elite = true;
  softenFoe(game, s.ship!, elite);
  assert.equal(elite.softFor, undefined);
  const other = putSide(game, { cls: LEVEL_HULL[3], level: 3, craft: 'bot' }, at.x - 600, at.y, 0).ship;
  other.softFor = 999_999; // softened for a ship no longer at sea
  softenFoe(game, s.ship!, other);
  assert.equal(other.softFor, s.ship!.id);
});

test('a pirate brought to an idle novice leaves the sea in time (item 96)', () => {
  const { game } = makeGame();
  const conn = join(game, 'Idle Novice');
  conn.push({ t: 'undock' });
  steps(game, 5);
  const s = [...game.sessions].find((x) => (x.conn as unknown) === conn)!;
  const p = s.profile!;
  p.tutorial.on = false;
  p.tutorial.stage = 99;
  p.tutorial.played = 0; // her first quarter of an hour
  const before = new Set(game.ships.keys());
  for (let i = 0; i <= FOE_IDLE + 1; i++) firstFightsSecond(game, s);
  const brought = [...game.ships.values()].find((o) => !before.has(o.id) && o.npcRole === 'pirate');
  assert.ok(brought, 'a pirate brought');
  const brain = game.npcs.get(brought.id)!;
  assert.ok(brain.expiresAt > game.now && brain.expiresAt <= game.now + FOE_BROUGHT_LIFE + 1e-6, `expires ${brain.expiresAt} at ${game.now}`);
});

test('the boarding run is the helmsman\'s: off as soon as the captain takes the wheel herself (item 94)', () => {
  const game = duelSea();
  const at = openWater(game, 43);
  const s = seaCaptain(game, LEVEL_HULL[3], 3, at.x, at.y, Math.PI / 2);
  const me = s.ship!;
  const foe = putSide(game, { cls: LEVEL_HULL[3], level: 3, craft: 'bot' }, at.x + 900, at.y, Math.PI / 2).ship;
  assert.equal(startPursuit(game, s, foe.id, 'board'), null);
  for (let i = 0; i < 40 && !me.hasEffect('board_run'); i++) game.step();
  assert.ok(me.hasEffect('board_run'), 'the run on while the helmsman closes');
  pursuitInput(game, s, 1, 1, true); // her thumb on the stick
  game.step();
  assert.ok(!me.hasEffect('board_run'), 'her own hand: no −40% from every gun to sail off with');
});

test('a tab older than the server is told to reload and its socket shut with 4002 (item 96)', () => {
  const { game } = makeGame();
  const conn = new FakeConn();
  let code = 0;
  conn.close = (c?: number) => {
    code = c ?? 1000;
    conn.closed = true;
  };
  game.attach(conn as unknown as WsConnection);
  conn.push({ t: 'hello', v: PROTOCOL_VERSION - 1, name: 'Old Tab' });
  assert.match((conn.last('err') as { msg: string }).msg, /out of date/);
  assert.equal(code, 4002);
  // The client reloads on it (once a minute at most), and «Продолжить» opens no second socket.
  const net = src('client/src/net.ts');
  assert.ok(net.includes('if (ev.code === 4002) {') && net.includes('location.reload();'));
  assert.ok(src('client/src/main.ts').includes('if (!net.live) net.connect();'));
});

test('the QA\'s /foe holds her waters in a safe sea instead of leaving the sea the same second (item 90)', () => {
  const { game } = makeGame();
  const conn = join(game, 'Foe Tester');
  conn.push({ t: 'undock' });
  steps(game, 5);
  const s = [...game.sessions].find((x) => (x.conn as unknown) === conn)!;
  const ship = s.ship!;
  ship.state.x = 23363;
  ship.state.y = 69832; // the Black Coast, a safe sea: pirates leave captains be
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  assert.match(runAdmin(game, s, '/foe pirate sloop 150') ?? '', /off your beam/);
  const foe = [...game.ships.values()].find((o) => o !== ship && o.npcRole === 'pirate' && Math.hypot(o.state.x - ship.state.x, o.state.y - ship.state.y) < 400)!;
  steps(game, 200);
  assert.ok(game.ships.get(foe.id)?.alive, 'still at sea ten seconds on');
});

test('phone layout fixes of phase 9 (items 92, 97): the striking ship\'s terms in the bottom band, the board a picture, sea orders folded, the handbook of the new HUD, no native submit', () => {
  const feel = src('client/feel.css');
  assert.ok(feel.includes('body.touch #surrender { top: auto; bottom: calc(var(--sa-b) + 8px);'), 'the terms in the bottom band on a phone');
  assert.ok(feel.includes('body.touch #surrender .sur-choice { grid-row: 2; min-height: 44px;'), 'its choices a finger high');
  const css = src('client/styles.css');
  assert.ok(css.includes('body.touch .base-board .bplot .bground, body.touch .base-board .bhit { pointer-events: none; }'));
  assert.ok(css.includes('body.touch .center-card .btn { min-height: 44px;'));
  assert.ok(css.includes('body.touch.sea-target #hud-stack, body.touch.sea-target #hud #hud-stack { left: calc(var(--sa-l) + 172px); right: calc(var(--sa-r) + var(--mm) + 76px); }'), 'the stack clear of the menu in a fight');
  assert.ok(src('client/src/ui/base.ts').includes("touchBoard() ? '[data-plot]:not(.bplot)' : '[data-plot]'"), 'the board takes no finger on a phone');
  assert.ok(src('client/src/ui/hud.ts').includes("export const TOUCH_FOLDED = [...FOLDED, 'hud-orders', 'hud-signals'];"));
  const html = src('client/index.html');
  for (const f of ['login-form', 'email-form']) assert.ok(html.includes(`<form id="${f}" onsubmit="return false">`), f);
});

test('the handbook on a phone tells of the new HUD, not the broadside buttons and the sail ± (item 95)', async () => {
  const { EN, RU } = await import('../client/src/lang/ui/dialogs.ts');
  const en = EN as Record<string, string>, ru = RU as Record<string, string>;
  for (const k of ['help.t.sail', 'help.t.chasers', 'help.t.mount']) assert.equal(en[k], undefined, k);
  assert.match(ru['help.t.stick'], /двойное касание — рывок/);
  assert.match(ru['help.t.fire'], /Огонь/);
  assert.match(en['help.t.context'], /Attack/);
  assert.equal(Object.keys(EN).length, Object.keys(RU).length);
});
