// The local traffic (owner, 2026-09-29: the sea is empty, nobody sails, nothing to meet). The world's own ships are a
// hundred and some over ninety-six kilometres a side — one in eight kilometres. So about every captain at sea the
// sea keeps a few of its own within a few kilometres: merchants crossing her track, fishers working the water,
// patrols on their beat in the law's waters and rovers in the wild ones. They are the sea's ordinary ships (their
// levels, their brains, their loot, the quests that count them); when no captain is near any more, they are gone.

import { REGIONS } from '../../../shared/src/world/regions.ts';
import { dist, headingVec } from '../../../shared/src/math.ts';
import { onboardingProtected } from './onboarding.ts';
import { spawnPirate, spawnTraffic } from './npc.ts';
import { neutralSpared, pirateSworn } from './colours.ts';
import { quietSea } from './director.ts';
import { stirWars } from './npcwars.ts';
import type { Game } from './Game.ts';

/** How near counts as about her, and how far off a new ship is put out (beyond her screen, inside her chart). */
// Owner, 2026-09-30: four times the ships to meet. A wider ring about her, and many more in it.
export const TRAFFIC_R = 5000;
const SPAWN_R: [number, number] = [2200, 4400];
/** Gone when no captain is within this and she is not fighting. */
const GONE_R = 9000;
/** How many of the sea's ships about her, by her waters. */
// docs/19 D3: twice the 8/10/9 of docs/16 and again twice the 16/20/18 of 2026-09-30.
export const TRAFFIC_WANT: Record<string, number> = { safe: 32, contested: 40, lawless: 36 };
/** Who sails where. */
const MIX: Record<string, [Role, number][]> = {
  safe: [['merchant', 45], ['fisher', 35], ['patrol', 20]],
  contested: [['merchant', 40], ['fisher', 20], ['patrol', 15], ['pirate', 25], ['hunter', 8]],
  lawless: [['merchant', 25], ['fisher', 10], ['pirate', 65], ['hunter', 7]],
};
/** No more local ships than this in the whole sea, whatever the crowd. */
const CAP = 1800; // docs/19 D3: twice the 900
type Role = 'merchant' | 'fisher' | 'patrol' | 'pirate' | 'hunter';
const COUNTED = new Set(['merchant', 'fisher', 'patrol', 'pirate', 'escort', 'hunter', 'ghost']);

const local = new WeakMap<Game, Set<number>>();
/** When each captain is next hunted (wild waters only). */
const hunts = new WeakMap<Game, Map<number, number>>();
/** Seconds between two rovers put out after a captain in contested and lawless waters. */
export const HUNT_EVERY: [number, number] = [90, 150];

/** The eight points of the compass, from a bearing (0 = north, clockwise). */
export function compassPoint(a: number): string {
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

/** A rover put out after her now and then in the wild waters, with the lookout's warning where she comes from. */
function hunt(game: Game, s: import('./player.ts').PlayerSession): void {
  const ship = s.ship!;
  let due = hunts.get(game);
  if (!due) hunts.set(game, (due = new Map()));
  const at = due.get(s.accountId);
  if (at === undefined) {
    due.set(s.accountId, game.now + game.rng.range(HUNT_EVERY[0] * 0.5, HUNT_EVERY[1] * 0.5));
    return;
  }
  if (game.now < at) return;
  if (REGIONS[ship.region].safety === 'safe' || onboardingProtected(s) || !quietSea(game, s)) return;
  // One rover at a time is enough.
  for (const b of game.npcs.values()) if (b.chase?.id === ship.id && game.ships.get(b.id)?.alive) return;
  due.set(s.accountId, game.now + game.rng.range(HUNT_EVERY[0], HUNT_EVERY[1]));
  // Neutral colours (docs/24 D1): the rovers let her be nine times in ten.
  if (neutralSpared(game, ship)) return;
  const p = spawnPirate(game, ship);
  if (!p) return;
  pirateSworn(game, game.npcs.get(p.id), ship);
  localTraffic(game).add(p.id);
  game.grid.upsert(p.id, p.state.x, p.state.y);
  const a = Math.atan2(p.state.x - ship.state.x, -(p.state.y - ship.state.y));
  const km = (dist(p.state.x, p.state.y, ship.state.x, ship.state.y) / 1000).toFixed(1);
  game.toastShip(ship, `Sail to the ${compassPoint(a)}, ${km} km off: a pirate is coming for you!`, 'bad');
}

export function localTraffic(game: Game): Set<number> {
  let s = local.get(game);
  if (!s) local.set(game, (s = new Set()));
  return s;
}

const hails = new WeakMap<Game, Map<number, number>>();

/** A patrol near her speaks: a salute to an honest captain, a long look at a known one, guns for a wanted one. */
function hail(game: Game, s: import('./player.ts').PlayerSession): void {
  const ship = s.ship!;
  let last = hails.get(game);
  if (!last) hails.set(game, (last = new Map()));
  if (game.now - (last.get(s.accountId) ?? -1e9) < 120) return;
  let patrol: import('./ship.ts').ShipEntity | null = null;
  game.forShipsNear(ship.state.x, ship.state.y, 700, (o) => {
    if (o.npcRole === 'patrol' && o.alive && !patrol) patrol = o;
  });
  if (!patrol) return;
  last.set(s.accountId, game.now);
  const w = ship.wantedCache;
  const msg = w >= 3 ? `${(patrol as import('./ship.ts').ShipEntity).name} runs out her guns: the Crown wants your head!` : w >= 1 ? `${(patrol as import('./ship.ts').ShipEntity).name} has her glasses on you: the Crown knows your face.` : `${(patrol as import('./ship.ts').ShipEntity).name} dips her ensign to you: fair winds, captain.`;
  game.toastShip(ship, msg, w >= 3 ? 'bad' : 'info');
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
    if (!ship || !s.profile || ship.docked || !ship.alive || ship.ghost) continue;
    hunt(game, s);
    hail(game, s);
    // The sea's own wars (docs/16 P1): now and then a fight staged in her sight.
    stirWars(game, s, onboardingProtected(s), (x, y, past) => {
      const p = spawnTraffic(game, 'pirate', x, y, past);
      if (p) mine.add(p.id);
      return p;
    });
    if ((tick + s.accountId) % 3 !== 0) continue;
    if (mine.size >= CAP) continue;
    // In the First Watch the sea is peaceful but not empty: merchants, fishers and patrols, no rovers.
    const novice = onboardingProtected(s);
    const safety = REGIONS[ship.region].safety;
    let count = 0;
    game.forShipsNear(ship.state.x, ship.state.y, TRAFFIC_R, (o) => {
      if (o.npcRole && COUNTED.has(o.npcRole) && o.alive) count++;
    });
    const want = TRAFFIC_WANT[safety] ?? 5;
    if (count >= want) continue;
    const mix = (MIX[safety] ?? MIX.contested).filter(([r]) => !novice || r !== 'pirate');
    // Up to three at a turn while the sea about her is thin, so a new sea fills within a minute.
    for (let n = Math.min(3, want - count); n > 0; n--) {
    const role = game.rng.weighted(mix);
    // Mostly ahead of her or abeam, where she will meet it; now and then astern, overtaking.
    for (let k = 0; k < 6; k++) {
      const a = ship.state.heading + (game.rng.chance(0.8) ? game.rng.range(-1.8, 1.8) : Math.PI + game.rng.range(-0.8, 0.8));
      const r = game.rng.range(SPAWN_R[0], SPAWN_R[1]);
      const v = headingVec(a);
      const out = spawnTraffic(game, role, ship.state.x + v.x * r, ship.state.y + v.y * r, { x: ship.state.x, y: ship.state.y });
      if (out) {
        mine.add(out.id);
        // Now and then a rich one, deep in the water: a prize worth the chase, and the lookout says so.
        if (role === 'merchant' && !novice && game.rng.chance(0.15)) {
          out.purse *= 4;
          for (const g in out.cargo) out.cargo[g as keyof typeof out.cargo] = (out.cargo[g as keyof typeof out.cargo] ?? 0) * 2;
          const b = Math.atan2(out.state.x - ship.state.x, -(out.state.y - ship.state.y));
          game.toastShip(ship, `Lookout: a rich merchant, ${out.name}, deep in the water to the ${compassPoint(b)}!`, 'gold');
        }
        break;
      }
    }
    }
  }
}
