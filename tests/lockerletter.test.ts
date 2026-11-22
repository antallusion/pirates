// Forum 140 (2026-11-23): a find with the locker full waits in one letter, never in the water; taken in port as far as
// the locker has room; the Stair's prize given back once to the captain who lost it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STASH_SIZE, makeItem } from '../shared/src/data/items.ts';
import { keepItem } from '../server/src/game/gear.ts';
import { lettersSince, mailTake } from '../server/src/game/post.ts';
import { applyDescentFix } from '../server/src/game/descentfix.ts';
import { join, makeGame } from './helpers.ts';

test('forum 140: a full locker sends finds to one letter; port takes as many as fit, the rest wait', () => {
  const { game } = makeGame();
  join(game, 'Locker Full');
  const s = game.sessionByName('Locker Full')!;
  const p = s.profile!;
  p.stash = Array.from({ length: STASH_SIZE }, (_, k) => ({ ...makeItem(game.rng, 0, { ilvl: 3 }), uid: 5000 + k }));
  assert.ok(keepItem(game, s, makeItem(game.rng, 0, { ilvl: 5, rarity: 2 })));
  assert.ok(keepItem(game, s, makeItem(game.rng, 0, { ilvl: 5, rarity: 3 })));
  assert.equal(p.stash.length, STASH_SIZE, 'never past the locker');
  const letters = lettersSince(game, s.accountId, 0).filter((l) => l.locker);
  assert.equal(letters.length, 1, 'one letter gathers them');
  assert.equal(letters[0].items!.length, 2);
  assert.equal(letters[0].taken, false);
  s.ship!.docked = game.world.ports[0].id;
  assert.match(mailTake(game, s, letters[0].id) ?? '', /locker is full: 2 more/);
  p.stash.pop();
  assert.match(mailTake(game, s, letters[0].id) ?? '', /1 more/);
  assert.equal(p.stash.length, STASH_SIZE);
  p.stash.splice(0, 3);
  assert.equal(mailTake(game, s, letters[0].id), null);
  const after = lettersSince(game, s.accountId, 0).find((l) => l.id === letters[0].id)!;
  assert.equal(after.taken, true);
  assert.equal(after.items!.length, 0);
  assert.equal(new Set(p.stash.map((x) => x.uid)).size, p.stash.length, 'fresh uids');
});

test('forum 140: the Stair prize given back — into the locker when there is room, with the letter', () => {
  const { game } = makeGame();
  join(game, 'Eduard Stair');
  const s = game.sessionByName('Eduard Stair')!;
  const n = s.profile!.stash.length;
  const r = applyDescentFix(game, s, { ref: 't', account: s.accountId, depth: 5 })!;
  assert.equal(r.length, 2);
  assert.equal(s.profile!.stash.length, n + 2);
  assert.ok(s.profile!.stash.some((x) => x.rarity === 3));
  assert.match(lettersSince(game, s.accountId, 0).at(-1)!.body, /Лестнице Мальстрёма/);
});
