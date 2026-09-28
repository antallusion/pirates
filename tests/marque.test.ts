// Letters of marque (docs/12 P10 #15): enlisting under the Crown, the League or the Brethren; ranks and titles by
// merit; the day's pay; fleet orders by sunset (intercept, hunt, deliver, patrol); the quartermaster; the livery; the
// letter revoked for firing on one's own flag or turning outlaw under a lawful one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeOfDay } from '../shared/src/constants.ts';
import { encodeLook } from '../shared/src/data/looks.ts';
import { ORDER_FAIL_MERIT, ORDER_PAY, RANK_MERIT, RANK_PAY, liveryOf, servicePatterns } from '../shared/src/data/marque.ts';
import type { Game } from '../server/src/game/Game.ts';
import { buyWare, enlist, flyLivery, resign, serviceKill, serviceOnDock, servicePortView, stepService, sunsetAfter, takeOrder } from '../server/src/game/marque.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { join, makeGame } from './helpers.ts';

function officer(game: Game, name: string, port = 'gravesend'): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  s.ship!.docked = port;
  s.profile!.docked = port;
  return s;
}

function atSeaNear(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  s.profile!.docked = null;
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const px = x + Math.sin(a) * 60 * (1 + (k % 4)), py = y - Math.cos(a) * 60 * (1 + (k % 4));
    if (isLand(game.world, px, py)) continue;
    ship.state.x = px;
    ship.state.y = py;
    break;
  }
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

test('enlisting: standing first; the Code bars a lawful flag; a title, the Crown letter and the day’s pay', () => {
  const { game } = makeGame();
  const s = officer(game, 'Ensign Eve');
  const p = s.profile!;
  const port = game.portById('gravesend')!;
  p.reputation.crown = 5;
  assert.equal(enlist(game, s, port), 'Your standing is too low (needs 10).');
  p.reputation.crown = 20;
  p.oath = 'code';
  assert.equal(enlist(game, s, port), 'A captain sworn to the Code serves no lawful flag.');
  p.oath = null;
  const g0 = p.gold;
  assert.equal(enlist(game, s, port), null);
  assert.equal(p.service!.id, 'crown');
  assert.equal(p.oath, 'marque');
  assert.equal(p.title, 'Midshipman of the Crown');
  assert.equal(p.gold, g0 + RANK_PAY[0], 'the first day’s pay at once');
  serviceOnDock(game, s, port);
  assert.equal(p.gold, g0 + RANK_PAY[0], 'once a day');
  assert.equal(enlist(game, s, port), 'You already serve.');
  // A Brethren port offers its own service; the Crown's man cannot take it.
  const tortuga = game.world.ports.find((x) => x.faction === 'confederacy')!;
  assert.equal(servicePortView(game, s, tortuga).offer, 'confederacy');
  assert.equal(resign(game, s), null);
  assert.equal(p.title, null);
  assert.equal(p.oath, null);
});

test('orders by sunset: hunt, patrol, deliver and intercept pay silver and merit; merit raises the rank', () => {
  const { game } = makeGame();
  const s = officer(game, 'Captain Cole');
  const p = s.profile!;
  p.reputation.crown = 30;
  const port = game.portById('gravesend')!;
  assert.equal(enlist(game, s, port), null);
  const sv = p.service!;
  // Hunt: two Confederacy ships in the order's sea.
  assert.equal(takeOrder(game, s, port), null);
  assert.equal(takeOrder(game, s, port), 'You already have an order.');
  sv.order = { kind: 'hunt', port: port.id, region: port.region, n: 0, need: 2, until: sunsetAfter(game.now) };
  const g0 = p.gold;
  for (let i = 0; i < 2; i++) {
    const npc = game.spawnNpcShip('pirate', 'brig', 'confederacy', port.x + 3000, port.y, 0);
    npc.region = port.region;
    serviceKill(game, s, npc, 'sunk');
  }
  assert.equal(sv.order, null);
  assert.ok(p.gold >= g0 + ORDER_PAY.hunt.silver, 'pay for the order (and the bounties)');
  assert.ok(sv.merit >= ORDER_PAY.hunt.merit);
  // Patrol: three marks passed.
  const marks: [number, number][] = [[port.x + 2000, port.y], [port.x, port.y + 2000], [port.x - 2000, port.y]];
  sv.order = { kind: 'patrol', port: port.id, region: port.region, n: 0, need: 3, until: sunsetAfter(game.now), marks, passed: [] };
  for (const [mx, my] of marks) {
    s.ship!.docked = null;
    s.ship!.state.x = mx + 100;
    s.ship!.state.y = my;
    stepService(game);
  }
  assert.equal(sv.order, null, 'the patrol is done');
  // Deliver: the goods handed over in the order's port.
  const other = game.world.ports.find((x) => x.faction === 'crown' && x.id !== port.id)!;
  sv.order = { kind: 'deliver', port: other.id, region: other.region, n: 0, need: 20, until: sunsetAfter(game.now), good: 'gunpowder' };
  s.ship!.cargo.gunpowder = 12;
  serviceOnDock(game, s, other);
  assert.equal(sv.order!.n, 12);
  s.ship!.cargo.gunpowder = 30;
  serviceOnDock(game, s, other);
  assert.equal(sv.order, null);
  assert.equal(s.ship!.cargo.gunpowder, 22);
  // Intercept: the quarry comes out when she nears the port; taking it is the order.
  sv.order = { kind: 'intercept', port: port.id, region: port.region, n: 0, need: 1, until: sunsetAfter(game.now), target: null };
  atSeaNear(game, s, port.x + 2500, port.y);
  stepService(game);
  const q = game.ships.get(sv.order!.target!)!;
  assert.ok(q && q.alive && q.faction === 'brokers');
  serviceKill(game, s, q, 'boarded');
  assert.equal(sv.order, null);
  // Enough merit: a lieutenant, with the title.
  sv.merit = RANK_MERIT[1] - 1;
  sv.order = { kind: 'patrol', port: port.id, region: port.region, n: 0, need: 1, until: sunsetAfter(game.now), marks: [[s.ship!.state.x, s.ship!.state.y]], passed: [] };
  stepService(game);
  assert.equal(sv.rank, 1);
  assert.equal(p.title, 'Lieutenant of the Crown');
});

test('sunset comes first: the order fails and merit is lost; sunset is the nineteenth hour', () => {
  const { game } = makeGame();
  const s = officer(game, 'Late Lars');
  const p = s.profile!;
  p.reputation.crown = 30;
  assert.equal(enlist(game, s, game.portById('gravesend')!), null);
  const until = sunsetAfter(game.now);
  assert.ok(until - game.now >= 15 * 60);
  assert.ok(Math.abs(timeOfDay(until) * 24 - 19) < 0.01);
  p.service!.merit = 50;
  p.service!.order = { kind: 'hunt', port: 'gravesend', region: 'black_coast', n: 0, need: 2, until: game.now - 1 };
  stepService(game);
  assert.equal(p.service!.order, null);
  assert.equal(p.service!.merit, 50 - ORDER_FAIL_MERIT);
});

test('the letter revoked: fire on your own flag, or be wanted under a lawful one; a day before any flag takes her', () => {
  const { game } = makeGame();
  const s = officer(game, 'Turncoat Tam');
  const p = s.profile!;
  p.reputation.crown = 40;
  const port = game.portById('gravesend')!;
  assert.equal(enlist(game, s, port), null);
  const crownShip = game.spawnNpcShip('patrol', 'brig', 'crown', port.x + 3000, port.y, 0);
  serviceKill(game, s, crownShip, 'sunk');
  assert.equal(p.service, null);
  assert.ok((p.reputation.crown ?? 0) < 40 - 20);
  assert.equal(p.title, null);
  p.reputation.crown = 40;
  assert.equal(enlist(game, s, port), 'No service takes you yet: wait a day after losing a letter.');
  // A day on: back in, then wanted.
  const t0 = game.wallNow();
  game.wallNow = () => t0 + 25 * 3600_000;
  assert.equal(enlist(game, s, port), null);
  p.infamy = 200;
  stepService(game);
  assert.equal(p.service, null);
});

test('the quartermaster: three bound pieces for her rank at the service’s price, once each; the livery in port', () => {
  const { game } = makeGame();
  const s = officer(game, 'Stores Sal');
  const p = s.profile!;
  p.reputation.crown = 30;
  p.gold = 1_000_000;
  const port = game.portById('gravesend')!;
  assert.equal(enlist(game, s, port), null);
  const v = servicePortView(game, s, port);
  assert.equal(v.wares.length, 3);
  assert.ok(v.wares.every((w) => w.item.bound));
  const n0 = p.stash.length;
  assert.equal(buyWare(game, s, port, 1), null);
  assert.equal(p.stash.length, n0 + 1);
  assert.equal(buyWare(game, s, port, 1), 'The quartermaster has nothing more for you today.');
  assert.ok(servicePortView(game, s, port).wares[1].sold);
  assert.equal(flyLivery(game, s), null);
  assert.equal(s.ship!.look, encodeLook(liveryOf('crown', 0)));
  assert.equal(resign(game, s), null);
  assert.equal(s.ship!.look, null, 'the livery comes down with the letter');
});

test('letters of marque read in Russian', () => {
  setLang('ru');
  const t = (x: string) => serverText(x).replace(/\u00a0/g, ' ');
  assert.equal(t('Lieutenant of the Crown'), 'Лейтенант Короны');
  assert.equal(t('Commodore of the Brethren'), 'Коммодор Братства');
  assert.equal(t('Your letter of marque is revoked: you fired on your own flag.'), 'У вас отобрали каперский патент: вы подняли оружие на свой флаг.');
  assert.match(t('Intercept a smuggler off Gravesend by sunset.'), /^Перехватить контрабандиста до заката — .+\.$/);
  for (const [en, ru] of servicePatterns()) {
    const holes = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    assert.equal(holes(en), holes(ru), en);
  }
  setLang('en');
});
