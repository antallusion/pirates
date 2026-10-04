// The zone bosses' squad sim (docs/21 §4): N average captains of her level on average ships of her level against
// her. Two parts:
//  - each captain's weight of shot on her is measured on the real sea: one average captain (tests/balance/duel.ts's
//    craft, the sea's own fighting mind) against the boss herself, sailing and turning as she does, for ten minutes
//    from three bearings (kept afloat for the measure: what she does to him is the second part's);
//  - the squad's fight is then played out second by second: her hull under the squad's shot, her rounds of
//    broadsides every few seconds spread over every captain still afloat (zonebosses.ts's own rule and numbers),
//    each captain's hull under his share, until she sinks, the squad does, or her hour is up.

import { SHIP_CLASSES } from '../../shared/src/data/ships.ts';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { ZB_LIFE, ZONE_BOSSES } from '../../shared/src/data/zonebosses.ts';
import type { ZoneBossDef } from '../../shared/src/data/zonebosses.ts';
import { computeShipStats } from '../../shared/src/sim/shipstats.ts';
import { defaultGunFor } from '../../shared/src/data/ships.ts';
import { REGION_IDS } from '../../shared/src/world/regions.ts';
import type { RegionId } from '../../shared/src/world/regions.ts';
import type { Game } from '../../server/src/game/Game.ts';
import { engage } from '../../server/src/game/npc.ts';
import { rise } from '../../server/src/game/zonebosses.ts';
import { duelSea, putSide } from './duel.ts';

/** The average ship of each level (the balance tables' hulls, tests/balance/report.ts). */
export const AVERAGE_HULL: Record<number, ShipClassId> = { 3: 'schooner', 5: 'brig', 6: 'brig', 7: 'frigate', 8: 'frigate', 9: 'man_o_war', 10: 'man_o_war' };

/** An average ship of a level: her hull and armour as the stats reckon them. */
export function averageShip(level: number): { cls: ShipClassId; hull: number; armor: number } {
  const cls = AVERAGE_HULL[level];
  const gun = defaultGunFor(SHIP_CLASSES[cls]);
  const st = computeShipStats({ classId: cls, name: 'x', guns: { port: gun, starboard: gun }, modules: {}, level }, 'corsair', {});
  return { cls, hull: st.hullMax, armor: st.armor };
}

/** The average day at sea: a working wind everywhere, no storm, no fog, no front (the sea's weather swings a
 *  captain's aim from nothing at all in a black storm to the whole of it; the sim weighs her on the mean). */
export function fairWeather(game: Game): void {
  for (const r of REGION_IDS) game.weather[r] = { kind: 'wind', until: 1e15 };
  game.fronts = [];
}

/** One average captain's hull off her a second, on the real sea (the mean of `starts` bearings, `sec` seconds each,
 *  counted from his first hit). */
export function soloDps(region: RegionId, starts = 6, sec = 600): number {
  const def = ZONE_BOSSES[region];
  const { cls } = averageShip(def.level);
  let dealt = 0, time = 0;
  for (let k = 0; k < starts; k++) {
    const game = duelSea();
    fairWeather(game);
    const boss = rise(game, region, 0, game.wallNow() + ZB_LIFE)!;
    const a = (k / starts) * Math.PI * 2 + 0.4;
    const me = putSide(game, { cls, level: def.level, craft: 'average' }, boss.state.x + Math.sin(a) * 1100, boss.state.y - Math.cos(a) * 1100, a + Math.PI);
    me.ship.accountId = 9000 + k; // a captain: she answers his fire
    me.ship.god = true; // kept afloat for the measure (her fire on him is the squad sim's)
    const h0 = boss.hull, t0 = game.now;
    let first = -1, next = 0;
    while (game.now - t0 < sec) {
      if (game.now >= next) {
        next = game.now + (me.brain.skill?.react ?? 0.5);
        engage(game, me.ship, me.brain, boss, Math.hypot(boss.state.x - me.ship.state.x, boss.state.y - me.ship.state.y));
      }
      game.step();
      if (game.fronts.length) game.fronts = [];
      if (first < 0 && boss.hull < h0) first = game.now;
    }
    if (first >= 0) {
      dealt += h0 - boss.hull;
      time += game.now - first;
    }
  }
  return time > 0 ? dealt / time : 0;
}

export interface SquadResult {
  /** Seconds to sink her; null when she outlived the squad or her hour. */
  killSec: number | null;
  /** Captains still afloat at the end. */
  alive: number;
  /** The hull the survivors lost, on average (0..1). */
  hullLost: number;
  /** When the last of them sank (seconds), if they all did. */
  sunkSec: number | null;
}

/** The squad's fight, second by second (no repairs under her fire: carpenters cannot work under it). */
export function squad(def: ZoneBossDef, bossHull: number, n: number, dps: number, ship: { hull: number; armor: number }): SquadResult {
  const hulls = Array.from({ length: n }, () => ship.hull);
  let boss = bossHull, nextVolley = 3;
  const end = ZB_LIFE / 1000;
  for (let t = 1; t <= end; t++) {
    const afloat = hulls.filter((h) => h > 0).length;
    if (!afloat) return { killSec: null, alive: 0, hullLost: 1, sunkSec: t - 1 };
    boss -= afloat * dps;
    if (boss <= 0) return { killSec: t, alive: afloat, hullLost: lost(hulls, ship.hull), sunkSec: null };
    if (t >= nextVolley) {
      nextVolley = t + def.every;
      const share = (def.volley / afloat) * (1 - Math.min(0.85, ship.armor)); // zonebosses.ts zbHullHit
      for (let i = 0; i < n; i++) if (hulls[i] > 0) hulls[i] -= share;
    }
  }
  const alive = hulls.filter((h) => h > 0).length;
  return { killSec: null, alive, hullLost: lost(hulls, ship.hull), sunkSec: alive ? null : end };
}

function lost(hulls: number[], max: number): number {
  const up = hulls.filter((h) => h > 0);
  return up.length ? up.reduce((a, h) => a + (1 - h / max), 0) / up.length : 1;
}
