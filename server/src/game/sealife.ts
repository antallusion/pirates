// The small life of the sea (owner, 2026-09-29: something should turn up every twenty seconds or so, small or big).
// Between the director's encounters, every 16–26 s of quiet sailing one small thing shows near the ship: flotsam
// to fish up ahead of her, a shoal breaking the surface, or beasts passing a mile off. Nothing opens a window; the
// sea is simply fuller. The same quiet as the director's: under way, out of a fight and a harbour.

import type { GoodId } from '../../../shared/src/data/goods.ts';
import { headingVec } from '../../../shared/src/math.ts';
import { isLand } from '../../../shared/src/world/worldgen.ts';
import { beastsPass } from './beasts.ts';
import { POD_CHANCE, podJoins } from './omenpod.ts';
import { quietSea } from './director.ts';
import { onboardingProtected } from './onboarding.ts';
import { shoalNear } from './fishing.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

/** Seconds of quiet sailing between two small things. */
export const LIFE_EVERY: [number, number] = [16, 26];
/** How long flotsam floats before it sinks. */
const FLOTSAM_TTL = 240;

/** What drifts: a good, how many, how often. */
const FLOTSAM: [GoodId, [number, number], number][] = [
  ['provisions', [3, 8], 5], ['rum', [2, 5], 3], ['timber', [2, 6], 3], ['planks', [2, 4], 2], ['sailcloth', [1, 3], 2],
  ['tar', [2, 4], 2], ['salt', [2, 5], 2], ['cloth', [1, 3], 1], ['pearls', [1, 1], 0.3],
];

const next = new WeakMap<Game, Map<number, number>>();

function clock(game: Game): Map<number, number> {
  let m = next.get(game);
  if (!m) next.set(game, (m = new Map()));
  return m;
}

/** Flotsam a few hundred metres ahead of her, off to one side of the course. */
function flotsam(game: Game, s: PlayerSession): boolean {
  const ship = s.ship!;
  for (let k = 0; k < 8; k++) {
    const a = ship.state.heading + game.rng.range(-0.6, 0.6);
    const r = game.rng.range(250, 600);
    const v = headingVec(a);
    const x = ship.state.x + v.x * r, y = ship.state.y + v.y * r;
    if (isLand(game.world, x, y) || !game.inZone(x, y)) continue;
    const [good, [lo, hi]] = game.rng.weighted(FLOTSAM.map((f) => [f, f[2]] as [typeof f, number]));
    game.dropPrivateLoot(s.accountId, x, y, { [good]: game.rng.int(lo, hi) }, FLOTSAM_TTL);
    return true;
  }
  return false;
}

/** Every second: the next small thing for each captain under way. */
export function stepSeaLife(game: Game): void {
  if (!game.directorOn) return;
  const due = clock(game);
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !s.profile || ship.docked || !ship.alive || ship.ghost) continue;
    const at = due.get(s.accountId);
    if (at === undefined) {
      due.set(s.accountId, game.now + game.rng.range(LIFE_EVERY[0], LIFE_EVERY[1]));
      continue;
    }
    // The First Watch keeps the director's cards away, not the sea's small life (no beasts for a novice, though).
    const novice = onboardingProtected(s);
    const calm = novice ? !ship.inCombat(game.now) && ship.state.speed >= 1.5 && !ship.boarding : quietSea(game, s);
    if (!calm) {
      due.set(s.accountId, Math.max(at, game.now + 8)); // a fight or a harbour puts it off, not ahead
      continue;
    }
    if (game.now < at) continue;
    due.set(s.accountId, game.now + game.rng.range(LIFE_EVERY[0], LIFE_EVERY[1]));
    // Now and then a good omen: dolphins, a humpback or orcas take station alongside (docs/16 #9).
    if (game.rng.chance(POD_CHANCE) && podJoins(game, s)) continue;
    const roll = game.rng.float();
    const done = roll < 0.45 ? flotsam(game, s) : roll < 0.75 || novice ? shoalNear(game, ship.state.x, ship.state.y, ship.region) : beastsPass(game, ship);
    if (!done) flotsam(game, s);
  }
}
