// The battle's moves drawn as moves (owner, 2026-10-05: «надо прям ход нарисовать как-то чтобы это выглядело как
// ход»): the client's walk goes hex by hex round the masts, the guns and the other stacks — the way the server's reach
// goes — takes a short, bounded time, and its point runs the line's length from end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Rng } from '../shared/src/rng.ts';
import { TAC_BLOCKING, hexNeighbors } from '../shared/src/data/tactical.ts';
import { newBattle, reachOf } from '../server/src/game/tacbattle.ts';
import type { TacSideInput } from '../server/src/game/tacbattle.ts';
import { GLIDE_MS, WALK_MAX, WALK_MIN, along, easeWalk, walkMs, walkPath } from '../client/src/ui/tacwalk.ts';

const side = (o: Partial<TacSideInput> = {}): TacSideInput => ({
  name: 'Captain', ship: 'Wake', captain: 'corsair', hands: 60, marines: 10, gunners: 20, army: [{ u: 'marine', n: 20 }, { u: 'deckhand', n: 40 }, { u: 'musketeer', n: 12 }],
  officers: [], skill: 3, morale: 80, dealt: 1, power: 1, melee: 1, extraShots: 0, firstRush: 1, nets: 0, blooded: 0, castle: false, struck: false, human: false, ...o,
});

test('the walk to every hex in reach is a chain of free neighbours, no longer than the reach says', () => {
  for (let seed = 1; seed < 12; seed++) {
    const bt = newBattle(side(), side(), seed, 0, new Rng(seed));
    for (const s of bt.stacks) {
      if (s.count <= 0) continue;
      const reach = reachOf(bt, s);
      for (const [to, d] of reach) {
        const path = walkPath(bt.cells, bt.stacks, s.id, s.hex, to);
        assert.ok(path, `a walk from ${s.hex} to ${to}`);
        assert.equal(path[0], s.hex);
        assert.equal(path[path.length - 1], to);
        assert.equal(path.length - 1, d, 'as short as the reach');
        for (let i = 1; i < path.length; i++) {
          assert.ok(hexNeighbors(path[i - 1]).includes(path[i]), 'hex by hex');
          assert.ok(!TAC_BLOCKING.has(bt.cells[path[i]]), 'never through a mast, a gun or the sea');
          assert.ok(!bt.stacks.some((o) => o !== s && o.count > 0 && o.hex === path[i]), 'never through another stack');
        }
      }
    }
  }
});

test('a walk takes 0.3–0.6 s, a glide about half a second; its point runs the line end to end', () => {
  assert.equal(walkMs(1), WALK_MIN);
  assert.equal(walkMs(20), WALK_MAX);
  assert.ok(WALK_MIN >= 300 && WALK_MAX <= 600 && GLIDE_MS >= 300 && GLIDE_MS <= 600);
  assert.equal(easeWalk(0), 0);
  assert.equal(easeWalk(1), 1);
  assert.ok(easeWalk(0.25) < 0.25 && easeWalk(0.75) > 0.75, 'sets off and comes to rest');
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  assert.deepEqual(along(pts, 0), { x: 0, y: 0 });
  assert.deepEqual(along(pts, 0.5), { x: 10, y: 0 });
  assert.deepEqual(along(pts, 0.75), { x: 10, y: 5 });
  assert.deepEqual(along(pts, 1), { x: 10, y: 10 });
});

test('the field draws one figure a stack: the ghost on its own layer, dim, none while a stack walks; less motion: none', () => {
  const src = readFileSync(new URL('../client/src/ui/tactical.ts', import.meta.url), 'utf8');
  assert.ok(!/g\.globalAlpha = 0\.45;\s*this\.token\(g, active/.test(src), 'no ghost drawn straight on the field (its figure set its own alpha back to 1)');
  assert.match(src, /this\.ghost\(g, active, aim, v,/);
  assert.match(src, /aim !== null && active && !walking/);
  assert.match(src, /prefers-reduced-motion: reduce/);
});
