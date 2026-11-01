// Forum 45 (Нефигугум): no escaping a fight by closing the tab. A dropped line leaves her ship at sea for two minutes
// with her last order on — a mark like any other, sunk into her save; in port she leaves at once; «Выход» at sea is a
// safe half-minute that any order of hers calls off; back aboard within the two minutes, the same ship is hers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOGOUT_TIMER_SEC, PROTOCOL_VERSION, SAFE_EXIT_SEC } from '../shared/src/constants.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { applyDamage } from '../server/src/game/combat.ts';
import { autosailOf, startAutosail } from '../server/src/game/autosail.ts';
import { breaksExit, EXIT_BREAKS } from '../server/src/game/exit.ts';
import { FakeConn, join, makeGame, steps } from './helpers.ts';

function atSea(game: Game, name: string, x = 30000, y = 80000): { c: FakeConn; s: PlayerSession } {
  const c = join(game, name);
  const s = game.sessionByName(name)!;
  s.ship!.docked = null;
  s.profile!.docked = null;
  s.ship!.state.x = x;
  s.ship!.state.y = y;
  s.ship!.protectedUntil = 0;
  s.profile!.pvp.bubbleUntil = 0;
  game.grid.upsert(s.ship!.id, x, y);
  return { c, s };
}
const secs = (game: Game, n: number) => steps(game, Math.round(n * 20));
const playerShips = (game: Game, account: number) => [...game.ships.values()].filter((x) => x.accountId === account);

test('a dropped line at sea: her ship stays two minutes, still a mark — hit, then gone after the linger', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Нефигугум');
  const { s: foe } = atSea(game, 'Охотник', 30200, 80000);
  const ship = s.ship!;
  assert.equal(LOGOUT_TIMER_SEC, 120);
  c.close(); // the tab closed
  assert.notEqual(s.disconnectedAt, null);
  assert.ok(game.ships.has(ship.id), 'she is still on the sea');
  secs(game, 60);
  assert.ok(game.ships.has(ship.id), 'a minute on: still there');
  const before = ship.hull;
  applyDamage(game, ship, { hull: 50 }, foe.ship!);
  assert.ok(ship.hull < before, 'and she can be hit');
  secs(game, 60 + 65); // the two minutes, and the fight's own minute past them (she was hit)
  assert.ok(!game.ships.has(ship.id), 'then she leaves');
  assert.equal(game.sessionByAccount(s.accountId), null);
});

test('her last order goes on while she lingers: the helmsman sails her on to her mark', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Пофигум');
  const ship = s.ship!;
  startAutosail(game, s, ship.state.x + 3000, ship.state.y, 1);
  assert.ok(autosailOf(ship), 'her course set');
  secs(game, 3);
  c.close();
  const x0 = ship.state.x, y0 = ship.state.y;
  secs(game, 20);
  assert.ok(autosailOf(ship), 'the course is still hers');
  assert.ok(Math.hypot(ship.state.x - x0, ship.state.y - y0) > 20, 'she sails on');
});

test('sunk while she lingers: the save reflects it (the purse, the port she is towed to)', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Тонущий');
  const { s: foe } = atSea(game, 'Топитель', 30200, 80000);
  const p = s.profile!;
  p.gold = 10_000;
  c.close();
  applyDamage(game, s.ship!, { hull: s.ship!.hull + 10_000 }, foe.ship!);
  secs(game, 30);
  const row = game.db.loadCaptain(s.accountId)!;
  const saved = JSON.parse(row.data) as { gold: number; docked: string | null };
  assert.ok(saved.gold < 10_000, `the sinking's losses saved (${saved.gold})`);
  assert.ok(saved.docked, 'saved at the quay she was towed to');
});

test('in port the exit is at once: a dropped line and «Выход» both', () => {
  const { game } = makeGame();
  const c = join(game, 'Причал');
  const s = game.sessionByName('Причал')!;
  assert.ok(s.ship!.docked);
  const id = s.ship!.id;
  c.close();
  assert.ok(!game.ships.has(id), 'docked: gone with the line');
  const c2 = join(game, 'Причал2');
  const s2 = game.sessionByName('Причал2')!;
  c2.push({ t: 'logout' });
  assert.equal(c2.last('exit')?.done, true, '«Вы вышли»');
  assert.ok(c2.closed, 'her line closed');
  assert.ok(!game.ships.has(s2.ship!.id));
  assert.equal(game.sessionByAccount(s2.accountId), null);
});

test('«Выход» at sea: thirty safe seconds, called off by her own hand; done, the ship leaves at once (no linger)', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Беглец');
  const id = s.ship!.id;
  c.push({ t: 'input', seq: 1, rudder: 0, sail: 2 });
  c.push({ t: 'logout' });
  const at = c.last('exit')!;
  assert.ok(Math.abs(at.until - (game.now + SAFE_EXIT_SEC)) < 0.2, 'the moment told');
  secs(game, 5);
  c.push({ t: 'input', seq: 2, rudder: 0, sail: 2 }); // her phone's helm, as it was: nothing
  assert.ok(s.exitAt > 0, 'the same helm sent again does not call it off');
  c.push({ t: 'chat', text: 'пока' });
  assert.ok(s.exitAt > 0, 'a word in the chat does not');
  c.push({ t: 'input', seq: 3, rudder: 1, sail: 2 }); // the wheel put over
  assert.equal(s.exitAt, 0);
  assert.equal(c.last('exit')?.until, 0);
  assert.equal(c.last('exit')?.why, 'action');
  // again, untouched this time
  c.push({ t: 'logout' });
  secs(game, SAFE_EXIT_SEC - 2);
  assert.ok(game.ships.has(id), 'not yet');
  secs(game, 3);
  assert.equal(c.last('exit')?.done, true);
  assert.ok(c.closed);
  assert.ok(!game.ships.has(id), 'left the sea at once: no lingering ship');
  assert.equal(game.sessionByAccount(s.accountId), null);
});

test('«Выход» is called off by a shot on her, refused in a fight, and her own «cancel» drops it', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Стойкий');
  const { s: foe } = atSea(game, 'Стрелок', 30200, 80000);
  c.push({ t: 'logout' });
  assert.ok(s.exitAt > 0);
  c.push({ t: 'logout', cancel: true });
  assert.equal(s.exitAt, 0);
  assert.equal(c.last('exit')?.why, 'cancel');
  c.push({ t: 'logout' });
  applyDamage(game, s.ship!, { hull: 10 }, foe.ship!);
  secs(game, 1.2);
  assert.equal(s.exitAt, 0, 'hit: off');
  assert.equal(c.last('exit')?.why, 'fire');
  c.push({ t: 'logout' });
  assert.equal(s.exitAt, 0, 'under fire: refused');
  assert.equal(c.last('exit')?.why, 'fire');
  assert.ok(game.ships.has(s.ship!.id));
});

test('the orders that call an exit off: a shot, an ability, a course, a landing; not a look, not a word', () => {
  const s = { exitSail: 2 } as PlayerSession;
  for (const t of ['fire', 'ability', 'autosail', 'land', 'attack', 'dock', 'board']) assert.ok(EXIT_BREAKS.has(t), t);
  assert.ok(breaksExit(s, { t: 'fire', side: 'port', dist: 200 }));
  assert.ok(breaksExit(s, { t: 'ability', id: 'x' }));
  assert.ok(breaksExit(s, { t: 'input', seq: 1, rudder: 0, sail: 4 }), 'the sails set');
  assert.ok(!breaksExit(s, { t: 'input', seq: 1, rudder: 0, sail: 2 }));
  assert.ok(!breaksExit(s, { t: 'chat', text: 'x' }));
  assert.ok(!breaksExit(s, { t: 'base', action: 'view' }), 'a window looked into');
  assert.ok(!breaksExit(s, { t: 'hero', action: 'view' }));
  assert.ok(breaksExit(s, { t: 'seamark', action: 'work', id: 1 }), 'a thing done at sea');
});

test('back aboard within the two minutes: the same ship, no second one', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Вернувшийся');
  s.autoFire = true;
  const id = s.ship!.id;
  c.close();
  secs(game, 40);
  const c2 = new FakeConn();
  game.attach(c2 as unknown as WsConnection);
  c2.push({ t: 'hello', v: PROTOCOL_VERSION, token: s.token });
  const s2 = game.sessionByAccount(s.accountId)!;
  assert.notEqual(s2, s);
  assert.equal(s2.ship?.id, id, 'her own lingering ship');
  assert.equal(playerShips(game, s.accountId).length, 1, 'no duplicate');
  assert.equal(s2.autoFire, true, 'her gun crews’ switch with her');
  secs(game, LOGOUT_TIMER_SEC + 10);
  assert.ok(game.ships.has(id), 'aboard again: she stays');
});
