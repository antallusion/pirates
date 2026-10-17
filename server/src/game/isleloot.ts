// The island's loot from the creatures of the islands (docs/29 §9, owner 2026-10-17; the table in
// shared/src/data/isleloot.ts): rolled on this system's own Rng when a lair of the land or a great one ashore is beaten
// (its spoils' once a week, the day's count thinning it as it thins them), and put into her stores at once — the
// minutes of speed-ups and the shop's other stores are kept in the kv table, the yard with the holdings.

import { Rng } from '../../../shared/src/rng.ts';
import { rollIsleLoot } from '../../../shared/src/data/isleloot.ts';
import type { IsleDrop, IsleLootSrc } from '../../../shared/src/data/isleloot.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';
import { isleLootGrant } from './shop.ts';

const rngs = new WeakMap<Game, Rng>();

/** The loot's own Rng (tests run the sea's on the same game: its rolls must not move them). */
export function isleRng(game: Game): Rng {
  let r = rngs.get(game);
  if (!r) rngs.set(game, (r = new Rng(0x15e1007)));
  return r;
}

/** For the tests: the loot's Rng from a seed. */
export function seedIsleRng(game: Game, seed: number): void {
  rngs.set(game, new Rng(seed));
}

/** Roll a creature's island loot and hand it over: what she got (what had nowhere to go left out). */
export function islandLoot(game: Game, s: PlayerSession, src: IsleLootSrc, thin = 1): IsleDrop[] {
  if (!s.authed || !s.profile) return [];
  const r = isleRng(game);
  const drops = rollIsleLoot(src, () => r.float(), thin);
  return drops.filter((d) => isleLootGrant(game, s, d));
}
