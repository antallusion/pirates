// Repairs that are seen (owner, 2026-10-07: «нажимая на ремонт ничего не происходит вообще абсолютно, появляется только
// "хватит чинить" и всё»): the button turned to «Хватит чинить» and a sloop's hull gained a point a second — six
// hundredths a minute — or nothing at all with no planks aboard and no word why. Now the carpenters mend a third of the
// hull in half a minute; with nothing to mend her with she is told in plain words what is wanted and the button does not
// change; leaving port hurt, the window before sailing offers the planks and sailcloth they need (nothing bought by
// itself since the owner's 2026-10-09); in port the yard mends her.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voyageStores } from '../shared/src/data/voyage.ts';
import { tx } from '../shared/src/sim/shipstats.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { NO_PLANKS, NO_STORES, SOUND, seaRepairView } from '../server/src/game/searepair.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
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

const toasts = (c: FakeConn, from: number) => c.inbox.slice(from).filter((m) => m.t === 'toast') as { msg: string; kind: string }[];

test('the hull is seen to fill: a third of it in half a minute, the planks used as it goes', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Mender Mo');
  const ship = s.ship!;
  ship.hull = ship.stats.hullMax * 0.4;
  ship.sails = ship.stats.sailHpMax * 0.5;
  ship.cargo.planks = 40;
  ship.cargo.sailcloth = 20;
  c.push({ t: 'repair', on: true });
  assert.equal(ship.repairing, true);
  const samples: number[] = [];
  for (let i = 0; i < 6; i++) {
    steps(game, 20 * 5);
    samples.push(ship.hull / ship.stats.hullMax);
  }
  assert.ok(samples.every((x, i) => i === 0 || x > samples[i - 1]), `rising every five seconds: ${samples.map((x) => x.toFixed(2)).join(' ')}`);
  assert.ok(samples[5] - 0.4 >= 0.25, `a third in half a minute: +${((samples[5] - 0.4) * 100).toFixed(0)}%`);
  assert.ok(ship.sails > ship.stats.sailHpMax * 0.8, 'the sails too');
  assert.ok((ship.cargo.planks ?? 0) < 40);
});

test('nothing to mend her with: plain words of what is wanted, and the button does not turn', () => {
  const { game } = makeGame();
  const { c, s } = atSea(game, 'Bare Bo');
  const ship = s.ship!;
  ship.cargo = {};
  ship.hull = ship.stats.hullMax * 0.5;
  ship.sails = ship.stats.sailHpMax * 0.5;
  let from = c.inbox.length;
  c.push({ t: 'repair', on: true });
  assert.equal(ship.repairing, false, '«Чинить» stays «Чинить»');
  assert.deepEqual(toasts(c, from).map((t) => [t.msg, t.kind]), [[NO_STORES, 'info']]);
  // Planks but no sailcloth, the sails whole: to work; with the planks gone mid-work, why they stopped.
  ship.sails = ship.stats.sailHpMax;
  ship.cargo.planks = 2;
  c.push({ t: 'repair', on: true });
  assert.equal(ship.repairing, true);
  from = c.inbox.length;
  steps(game, 20 * 30);
  assert.equal(ship.repairing, false);
  assert.ok(toasts(c, from).some((t) => t.msg === NO_PLANKS && t.kind === 'info'), JSON.stringify(toasts(c, from)));
  // Whole: nothing to do.
  ship.hull = ship.stats.hullMax;
  from = c.inbox.length;
  c.push({ t: 'repair', on: true });
  assert.equal(ship.repairing, false);
  assert.deepEqual(toasts(c, from).map((t) => t.msg), [SOUND]);
  setLang('ru');
  for (const m of [NO_PLANKS, NO_STORES, SOUND]) assert.match(serverText(m), /[а-яё]/i, m);
  setLang('en');
});

test('leaving port hurt buys nothing by itself (owner, 2026-10-09); the window’s reckoning of planks and sailcloth is the carpenters’; in port the yard mends her', () => {
  const { game } = makeGame();
  const c = join(game, 'Leaver Lin');
  const s = game.sessionByName('Leaver Lin')!;
  const ship = s.ship!;
  const p = s.profile!;
  assert.ok(ship.docked, 'in port');
  ship.cargo = {};
  ship.hull = ship.stats.hullMax * 0.5;
  ship.sails = ship.stats.sailHpMax * 0.7;
  p.gold = 4000;
  // What the window before sailing offers for her carpenters: the planks and bolts seaRepairView reckons for the harm.
  const view = seaRepairView(ship);
  const want = voyageStores({ hull: ship.hull, hullMax: ship.stats.hullMax, sails: ship.sails, sailsMax: ship.stats.sailHpMax, rudderHp: ship.rudderHp, use: 1 + tx(ship.stats, 'materialUse'), planks: 0, cloth: 0 });
  assert.deepEqual(want, { planks: view.planks + (ship.rudderHp < 1 ? 1 : 0), cloth: view.cloth });
  assert.ok(want.planks > 0 && want.cloth > 0);
  assert.deepEqual(voyageStores({ hull: ship.hull, hullMax: ship.stats.hullMax, sails: ship.sails, sailsMax: ship.stats.sailHpMax, rudderHp: 1, use: 1, planks: 999, cloth: 999 }), { planks: 0, cloth: 0 }, 'enough aboard: none wanted');
  const from = c.inbox.length;
  c.push({ t: 'undock' });
  assert.equal(ship.docked, null);
  assert.equal(p.gold, 4000, 'not a coin spent on the way out');
  assert.equal(ship.cargo.planks ?? 0, 0, 'no planks taken on by themselves');
  assert.ok(!toasts(c, from).some((t) => /quartermaster/i.test(t.msg)), JSON.stringify(toasts(c, from)));
  c.push({ t: 'repair', on: true });
  assert.equal(ship.repairing, false, 'nothing to mend her with');
  // Back in port: «Чинить» is the yard's, at once, for silver.
  ship.docked = p.lastPort ?? game.world.ports[0].id;
  ship.hull = ship.stats.hullMax * 0.6;
  p.gold = 100_000;
  c.push({ t: 'repair', on: true });
  assert.equal(ship.hull, ship.stats.hullMax, 'sound at once');
});
