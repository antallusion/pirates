// Forum 143 (2026-11-23): the legendary ship's commission shown at her yard's shipyard with its «hand in» — it was only
// in the Legends window, and a captain at the yard itself found nowhere to deliver.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGENDARY } from '../shared/src/data/legendary.ts';
import { onFirstKill } from '../server/src/game/legendary.ts';
import { buildPortView } from '../server/src/game/ports.ts';
import { join, makeGame } from './helpers.ts';

test('forum 143: the yard of a laid keel shows her commission; other ports and an unlaid keel show none', () => {
  const { game } = makeGame();
  join(game, 'Yard Legend');
  const s = game.sessionByName('Yard Legend')!;
  const yard = game.portById(LEGENDARY.first_rib.port)!;
  const other = game.world.ports.find((p) => p.id !== yard.id && !Object.values(LEGENDARY).some((d) => d.port === p.id))!;
  s.ship!.docked = yard.id;
  assert.equal(buildPortView(game, s, yard).legend, undefined, 'no keel yet');
  onFirstKill(game, 'leviathan');
  const v = buildPortView(game, s, yard).legend!;
  assert.equal(v.id, 'first_rib');
  assert.equal(v.canDeliver, true);
  assert.equal(v.need.length, 3);
  s.ship!.docked = other.id;
  assert.equal(buildPortView(game, s, other).legend, undefined);
});
