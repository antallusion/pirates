// Captains' treasure (docs/12 P10 #7): a chest buried off an island's shore with silver, a good and a riddle, and its
// map; the map posted on a port's board and bought; the chest dug up by the buyer — hers the silver and the good, the
// author's the fame (and a title at five); a second copy finds an empty pit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chestPatterns } from '../shared/src/data/chests.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { CHEST_COST, boardAction, boardView, buryChest } from '../server/src/game/chests.ts';
import { resolveDig } from '../server/src/game/explorefx.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

/** Off the shore of an island without a port, in water. */
function offIsland(game: Game, s: PlayerSession): number {
  const is = game.world.islands.find((i) => !i.portId && i.radius > 200)!;
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const x = is.x + Math.sin(a) * (is.radius + 150), y = is.y - Math.cos(a) * (is.radius + 150);
    if (isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
  return is.id;
}

test('a chest buried off a shore: its map, the board, a buyer who digs it up; the author’s fame', () => {
  const { game } = makeGame();
  join(game, 'Burier Bea');
  const a = game.sessionByName('Burier Bea')!;
  const bc = join(game, 'Digger Dan');
  const b = game.sessionByName('Digger Dan')!;
  a.profile!.gold = 10_000;
  b.profile!.gold = 10_000;
  a.ship!.docked = game.world.ports[0].id;
  assert.equal(buryChest(game, a, 1000, 'Where the gulls quarrel', null, 0), 'A chest is buried from a boat off an island’s shore.');
  offIsland(game, a);
  assert.equal(buryChest(game, a, 1000, 'short', null, 0), 'Write a riddle for the map (eight letters at least).');
  a.ship!.cargo = { rum: 10 };
  assert.equal(buryChest(game, a, 1000, 'Where the gulls quarrel over bones', 'rum', 5), null);
  assert.equal(a.profile!.gold, 10_000 - 1000 - CHEST_COST);
  assert.equal(a.ship!.cargo.rum, 5);
  const map = a.profile!.explore.maps.find((m) => m.kind === 'player')!;
  assert.ok(map, 'its map');
  assert.equal(map.clue, 'Where the gulls quarrel over bones');
  assert.ok(isLand(game.world, map.sx, map.sy), 'the spot is ashore');
  // Posted on a board, bought.
  const port = game.world.ports[0];
  a.ship!.docked = port.id;
  b.ship!.docked = port.id;
  assert.equal(boardAction(game, a, 'post', map.id, 800), null);
  assert.equal(a.profile!.explore.maps.some((m) => m.id === map.id), false);
  const posted = boardView(game, b, port.id);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].riddle, 'Where the gulls quarrel over bones');
  assert.equal(boardAction(game, b, 'buy', String(posted[0].id), 0), null);
  assert.equal(b.profile!.gold, 10_000 - 800);
  const boxA = game.db.getKv<{ letters: { gold: number }[] }>(`mail:${a.accountId}`)!;
  assert.equal(boxA.letters.at(-1)!.gold, Math.floor(800 * 0.95), 'paid by letter, less the board’s cut');
  // She digs it up.
  const bm = b.profile!.explore.maps.find((m) => m.kind === 'player')!;
  b.ship!.docked = null;
  b.ship!.state.x = bm.sx;
  b.ship!.state.y = bm.sy;
  const g0 = b.profile!.gold;
  resolveDig(game, b, bm.id, 1);
  assert.equal(b.profile!.gold, g0 + 1000);
  assert.equal(b.ship!.cargo.rum, 5);
  assert.ok(bc.all('toast').some((t) => t.msg === "Burier Bea's chest! 1000 silver inside."));
  assert.equal(a.profile!.cartoFame, 1);
});

test('three chests at most; a copy of a dug map finds an empty pit', () => {
  const { game } = makeGame();
  join(game, 'Many Mo');
  const a = game.sessionByName('Many Mo')!;
  a.profile!.gold = 100_000;
  offIsland(game, a);
  for (let i = 0; i < 3; i++) assert.equal(buryChest(game, a, 100, 'A riddle of the sea', null, 0), null);
  assert.equal(buryChest(game, a, 100, 'A riddle of the sea', null, 0), 'Three chests of yours are buried already.');
  const m = a.profile!.explore.maps.find((x) => x.kind === 'player')!;
  a.profile!.explore.maps.push({ ...m, id: 'copy' });
  a.ship!.state.x = m.sx;
  a.ship!.state.y = m.sy;
  resolveDig(game, a, m.id, 1);
  const g = a.profile!.gold;
  resolveDig(game, a, 'copy', 1);
  assert.equal(a.profile!.gold, g, 'nothing the second time');
  assert.equal(a.profile!.cartoFame ?? 0, 0, 'no fame for digging one’s own');
});

test('captains’ treasure reads in Russian', () => {
  setLang('ru');
  assert.equal(serverText("Ada's Chest on Skull Rock").replace(/\u00a0/g, ' '), 'Сундук капитана Ada на острове Skull Rock');
  for (const [en, ru] of chestPatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
