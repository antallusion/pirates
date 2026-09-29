// The local traffic (owner, 2026-09-29: the sea is empty, nobody sails, nothing to meet). The world's own ships are a
// hundred and some over ninety-six kilometres a side — one in eight kilometres. So about every captain at sea the
// sea keeps a few of its own within a few kilometres: merchants crossing her track, fishers working the water,
// patrols on their beat in the law's waters and rovers in the wild ones. They are the sea's ordinary ships (their
// levels, their brains, their loot, the quests that count them); when no captain is near any more, they are gone.

import { REGIONS } from '../../../shared/src/world/regions.ts';
import { dist, headingVec } from '../../../shared/src/math.ts';
import { onboardingProtected } from './onboarding.ts';
import { spawnTraffic } from './npc.ts';
import type { Game } from './Game.ts';

/** How near counts as about her, and how far off a new ship is put out (beyond her screen, inside her chart). */
export const TRAFFIC_R = 3800;
const SPAWN_R: [number, number] = [2400, 3400];
/** Gone when no captain is within this and she is not fighting. */
const GONE_R = 9000;
/** How many of the sea's ships about her, by her waters. */
export const TRAFFIC_WANT: Record<string, number> = { safe: 5, contested: 6, lawless: 5 };
/** Who sails where. */
const MIX: Record<string, [Role, number][]> = {
  safe: [['merchant', 45], ['fisher', 35], ['patrol', 20]],
  contested: [['merchant', 40], ['fisher', 20], ['patrol', 15], ['pirate', 25]],
  lawless: [['merchant', 25], ['fisher', 10], ['pirate', 65]],
};
/** No more local ships than this in the whole sea, whatever the crowd. */
const CAP = 220;
type Role = 'merchant' | 'fisher' | 'patrol' | 'pirate';
const COUNTED = new Set(['merchant', 'fisher', 'patrol', 'pirate', 'escort', 'hunter', 'ghost']);

const local = new WeakMap<Game, Set<number>>();

export function localTraffic(game: Game): Set<number> {
  let s = local.get(game);
  if (!s) local.set(game, (s = new Set()));
  return s;
}

/** Every second (a captain's turn every three): top up the traffic about her; let the far ones go. */
export function stepTraffic(game: Game): void {
  if (!game.directorOn) return;
  const mine = localTraffic(game);
  for (const id of [...mine]) {
    const ship = game.ships.get(id);
    if (!ship || !ship.alive) {
      mine.delete(id);
      continue;
    }
    if (ship.inCombat(game.now) || ship.boarding) continue;
    let near = false;
    for (const s of game.sessions) if (s.ship && dist(s.ship.state.x, s.ship.state.y, ship.state.x, ship.state.y) < GONE_R) {
      near = true;
      break;
    }
    if (!near) {
      mine.delete(id);
      game.removeShip(id);
    }
  }
  const tick = Math.floor(game.now);
  for (const s of game.sessions) {
    const ship = s.ship;
    if (!ship || !s.profile || ship.docked || !ship.alive || ship.ghost || (tick + s.accountId) % 3 !== 0) continue;
    if (mine.size >= CAP) continue;
    // In the First Watch the sea is peaceful but not empty: merchants, fishers and patrols, no rovers.
    const novice = onboardingProtected(s);
    const safety = REGIONS[ship.region].safety;
    let count = 0;
    game.forShipsNear(ship.state.x, ship.state.y, TRAFFIC_R, (o) => {
      if (o.npcRole && COUNTED.has(o.npcRole) && o.alive) count++;
    });
    if (count >= (TRAFFIC_WANT[safety] ?? 5)) continue;
    const mix = (MIX[safety] ?? MIX.contested).filter(([r]) => !novice || r !== 'pirate');
    const role = game.rng.weighted(mix);
    // Mostly ahead of her or abeam, where she will meet it; now and then astern, overtaking.
    for (let k = 0; k < 6; k++) {
      const a = ship.state.heading + (game.rng.chance(0.8) ? game.rng.range(-1.8, 1.8) : Math.PI + game.rng.range(-0.8, 0.8));
      const r = game.rng.range(SPAWN_R[0], SPAWN_R[1]);
      const v = headingVec(a);
      const out = spawnTraffic(game, role, ship.state.x + v.x * r, ship.state.y + v.y * r, { x: ship.state.x, y: ship.state.y });
      if (out) {
        mine.add(out.id);
        break;
      }
    }
  }
}
