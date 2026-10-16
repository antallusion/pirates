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
/** Owner, 2026-10-16 («я щас тут около смоляного причала и вокруг ваще ниче нет … насели прям густо все море всем»):
 *  the wide ring's 32–40 within 5 km were met by ships flowing past 2–4 km off, and within her chart's nearer reach
 *  (2.5 km) there were four now and then. So the sea also keeps this many within NEAR_R of her, put out NEAR_SPAWN off
 *  (beyond her screen: it shows some 300–600 m of the sea), before the wide ring is counted. */
export const NEAR_R = 2500;
export const NEAR_WANT: Record<string, number> = { safe: 10, contested: 12, lawless: 12 };
const NEAR_SPAWN: [number, number] = [1100, 2300];
/** No more local ships than this in the whole sea, whatever the crowd: CAP, or CAP_EACH a captain at sea in a big
 *  crowd (per-captain spawning: a crowd spread over the sea has her own ships about each). */
const CAP = 1800; // docs/19 D3: twice the 900
const CAP_EACH = 16;
/** A crowd at sea: past this many captains the wide ring's number about each is cut (as CROWD ÷ captains, never below
 *  her near reach's number and two), and a ship of the sea is let go at CROWD_GONE_R — the server's tick is shared. */
export const CROWD = 40;
const CROWD_GONE_R = 6500;
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
  let atSea = 0;
  for (const s of game.sessions) if (s.ship && !s.ship.docked && s.ship.alive) atSea++;
  const goneR = atSea > CROWD ? CROWD_GONE_R : GONE_R;
  // The captains in cells of goneR: a ship of the sea looks in the nine about her (each against every captain was the
  // second's spike with a crowd at sea).
  const cells = new Map<number, { x: number; y: number }[]>();
  const ck = (x: number, y: number) => Math.floor(y / goneR) * 4096 + Math.floor(x / goneR);
  for (const s of game.sessions) {
    if (!s.ship) continue;
    const k = ck(s.ship.state.x, s.ship.state.y);
    const c = cells.get(k);
    if (c) c.push(s.ship.state);
    else cells.set(k, [s.ship.state]);
  }
  for (const id of [...mine]) {
    const ship = game.ships.get(id);
    if (!ship || !ship.alive) {
      mine.delete(id);
      continue;
    }
    if (ship.inCombat(game.now) || ship.boarding) continue;
    let near = false;
    const x = ship.state.x, y = ship.state.y;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) {
      for (const p of cells.get(ck(x + dx * goneR, y + dy * goneR)) ?? []) if (dist(p.x, p.y, x, y) < goneR) {
        near = true;
        break;
      }
    }
    if (!near) {
      mine.delete(id);
      game.removeShip(id);
    }
  }
  const tick = Math.floor(game.now);
  const cap = Math.max(CAP, CAP_EACH * atSea);
  const crowd = atSea > CROWD ? CROWD / atSea : 1;
  for (const s of game.sessions) {
    const ship = s.ship;
    // In port the rovers' count starts again: none is due at the harbour mouth the moment she casts off (it was —
    // the clock ran on through her stay, and a rover, his pack and a fireship met every captain leaving a wild port).
    if (ship?.docked || (ship && !ship.alive)) hunts.get(game)?.delete(s.accountId);
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
    if (mine.size >= cap) continue;
    // In the First Watch the sea is peaceful but not empty: merchants, fishers and patrols, no rovers.
    const novice = onboardingProtected(s);
    const safety = REGIONS[ship.region].safety;
    let count = 0, near = 0;
    const sx = ship.state.x, sy = ship.state.y;
    game.forShipsNear(sx, sy, TRAFFIC_R, (o) => {
      if (!o.npcRole || !COUNTED.has(o.npcRole) || !o.alive) return;
      count++;
      if ((o.state.x - sx) ** 2 + (o.state.y - sy) ** 2 < NEAR_R * NEAR_R) near++;
    });
    const nearWant = NEAR_WANT[safety] ?? 10;
    const want = crowd < 1 ? Math.max(nearWant + 2, Math.round((TRAFFIC_WANT[safety] ?? 5) * crowd)) : TRAFFIC_WANT[safety] ?? 5;
    const close = near < nearWant;
    if (count >= want && !close) continue;
    const mix = (MIX[safety] ?? MIX.contested).filter(([r]) => !novice || r !== 'pirate');
    // Up to three at a turn while the sea about her is thin, so a new sea fills within a minute.
    for (let n = Math.min(3, Math.max(close ? nearWant - near : 0, want - count)); n > 0; n--) {
    const role = game.rng.weighted(mix);
    // Mostly ahead of her or abeam, where she will meet it; now and then astern, overtaking.
    for (let k = 0; k < 6; k++) {
      const a = ship.state.heading + (game.rng.chance(0.8) ? game.rng.range(-1.8, 1.8) : Math.PI + game.rng.range(-0.8, 0.8));
      const ring = close ? NEAR_SPAWN : SPAWN_R;
      const r = game.rng.range(ring[0], ring[1]);
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
