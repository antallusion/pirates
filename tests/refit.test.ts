// Refits (canon D12, docs/12 P0): a yard raises a ship one level for silver, materials (the hold first, then the
// warehouse in that port) and time; she stays in harbour while the yard works, by the wall clock; the captain's level
// must be up to her; a new hull asks the captain's level for its first level.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelPatterns, refitCost } from '../shared/src/data/shiplevel.ts';
import { setLang } from '../client/src/i18n.ts';
import { serverText } from '../client/src/lang/server.ts';
import { refitView } from '../server/src/game/refit.ts';
import { join, makeGame, steps, knowHulls } from './helpers.ts';

const bad = (c: ReturnType<typeof join>) => c.all('toast').filter((t) => t.kind === 'bad').map((t) => t.msg);

test('a refit: the captain’s level first, then silver and materials; the yard holds her in harbour, then she is a level up', () => {
  const { game } = makeGame();
  const c = join(game, 'Refit Rosa');
  const s = game.sessionByName('Refit Rosa')!;
  const p = s.profile!;
  const port = game.portById(s.ship!.docked!)!;
  assert.ok(port.shipyardTier >= 1);
  assert.equal(s.ship!.shipLevel, 1);
  c.push({ t: 'dock', bribe: false });
  const view = c.last('port')!.view!.shipyard.refit;
  assert.equal(view.level, 1);
  assert.equal(view.next!.to, 2);
  assert.equal(view.blocked, 'Captain level 4 is needed to command her at level 2');
  c.push({ t: 'shipyard', action: 'refit' });
  assert.equal(bad(c).at(-1), 'Captain level 4 is needed to command her at level 2');
  p.level = 5;
  p.gold = 5000;
  c.push({ t: 'shipyard', action: 'refit' });
  assert.match(bad(c).at(-1)!, /^Needs 40 planks/);
  // Thirty planks in the hold and ten in the warehouse make forty; the iron all in the hold.
  s.ship!.cargo.planks = 30;
  s.ship!.cargo.iron = 12;
  p.warehouses[port.id] = { planks: 15 };
  const hull0 = s.ship!.stats.hullMax;
  c.push({ t: 'shipyard', action: 'refit' });
  const cost = refitCost(2)!;
  assert.equal(p.gold, 5000 - cost.silver);
  assert.equal(s.ship!.cargo.planks, undefined, 'the hold emptied first');
  assert.equal(p.warehouses[port.id].planks, 5, 'then the warehouse');
  assert.equal(s.ship!.cargo.iron, 2);
  assert.ok(p.refit && p.refit.to === 2);
  c.push({ t: 'undock' });
  assert.match(bad(c).at(-1)!, /^The yard is still at work on her: \d+ min more$/);
  assert.ok(s.ship!.docked, 'still in harbour');
  c.push({ t: 'shipyard', action: 'refit' });
  assert.equal(bad(c).at(-1), 'The yard is already at work on her');
  // The wall clock runs on past the yard's time.
  const t0 = Date.now();
  game.wallNow = () => t0 + cost.sec * 1000 + 2000;
  steps(game, 25);
  assert.equal(p.refit, null);
  assert.equal(s.ship!.shipLevel, 2);
  assert.equal(p.loadout.level, 2);
  assert.ok(s.ship!.stats.hullMax > hull0 * 1.13);
  assert.ok(c.all('toast').some((t) => t.msg === `The yard is done: the ${p.loadout.name} is level 2 now.`));
  c.push({ t: 'undock' });
  assert.equal(s.ship!.docked, null, 'free to sail');
});

test('the height of her class stops a refit; a hull above the captain’s level is not sold to him', () => {
  const { game } = makeGame();
  const c = join(game, 'Topped Tom');
  const s = game.sessionByName('Topped Tom')!;
  const p = s.profile!;
  p.loadout.level = 3;
  s.ship!.recompute(game.now);
  const v = refitView(game, s, game.portById(s.ship!.docked!)!);
  assert.equal(v.next, null);
  assert.equal(v.blocked, 'She is at the height of her class: only a bigger hull goes higher');
  // A yard that builds brigs; a captain of the first level may not command one.
  const yard = game.world.ports.find((x) => x.shipyardTier >= 3)!;
  s.ship!.docked = yard.id;
  p.docked = yard.id;
  p.gold = 100_000;
  knowHulls(p); // the brig researched (docs/20): the level is what is tried here
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'brig' });
  assert.equal(bad(c).at(-1), 'Captain level 19 is needed to command a Brig');
  p.level = 19;
  c.push({ t: 'shipyard', action: 'buy_ship', classId: 'brig' });
  assert.equal(s.ship!.loadout.classId, 'brig');
  assert.equal(s.ship!.shipLevel, 5, 'a new hull comes at her class’s first level');
});

test('the refit lines read in Russian', () => {
  setLang('ru');
  const lines = [
    'Captain level 4 is needed to command her at level 2', 'Needs 40 planks (in the hold or your warehouse here)', 'The yard is still at work on her: 3 min more',
    'The yard is already at work on her', 'The yard is done: the Salt Wren is level 2 now.', 'The yard takes the Salt Wren in hand: level 2 in 2 min. She stays in harbour till then.',
    'She is at the height of her class: only a bigger hull goes higher', 'Captain level 19 is needed to command a Brig', 'Saltmarrow cannot take a Galleon in hand',
  ].map((l) => serverText(l));
  setLang('en');
  assert.deepEqual(lines.filter((l) => /[A-Za-z]{3,}/.test(l.replace(/Salt Wren|Saltmarrow|Galleon|Brig|planks/g, ''))), []);
  assert.ok(levelPatterns().length >= 12);
});
