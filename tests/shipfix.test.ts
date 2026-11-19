// A ship's level put right once (owner, 2026-11-19): ⚓10 back to ⚓9, the men over paid off by letter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyShipFix } from '../server/src/game/shipfix.ts';
import { lettersSince } from '../server/src/game/post.ts';
import { join, makeGame } from './helpers.ts';

test('a Great Xebec ⚓10 she was never refitted to goes back to ⚓9; the men over her hammocks paid off in a letter', () => {
  const { game } = makeGame();
  join(game, 'Eduard');
  const s = game.sessionByName('Eduard')!;
  const p = s.profile!, ship = s.ship!;
  p.loadout = { ...p.loadout, classId: 'great_xebec', level: 10, modules: { hull_plating: 3 } };
  ship.loadout = p.loadout;
  ship.recompute(game.now);
  ship.crew = ship.stats.crewMax;
  const full = ship.crew;
  assert.ok(full > 0);
  const r = applyShipFix(game, s, { ref: 't', account: s.accountId, cls: 'great_xebec', to: 9 })!;
  assert.equal(r.from, 10);
  assert.equal(r.to, 9);
  assert.equal(ship.shipLevel, 9);
  assert.equal(p.loadout.level, 9);
  assert.ok(ship.crew <= ship.stats.crewMax, `crew ${ship.crew} fits ${ship.stats.crewMax}`);
  assert.equal(r.men, full - ship.crew);
  if (r.men > 0) assert.ok(r.silver > 0);
  const letter = lettersSince(game, s.accountId, 0).at(-1)!;
  assert.equal(letter.gold, r.silver);
  assert.match(letter.body, /9-й уровень/);
  assert.equal(p.loadout.modules.hull_plating, 3, 'the modules stay');
  assert.equal(applyShipFix(game, s, { ref: 't', account: s.accountId, cls: 'great_xebec', to: 9 }), null, 'once');
});
