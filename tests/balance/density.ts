// docs/19 D1–D4: what the twice-as-full sea pays a captain an hour, before and after, and with the caps that keep it.
//
// A captain of ⚓L sails the real world for a day of `hours` at sea: straight legs across the waters of her level,
// turning off the land, at a cruising 12 m/s. On her way she takes what comes to hand, as a player does who is going
// somewhere and stops for what lies near her track — and every stop costs her the time it takes:
//   · the dense sea's marks within 500 m of her track (the world's own; «before» only those of step 5): the detour
//     there and back, shortening sail and making way again (15 s), the boats' work (MARK_TIME);
//   · the sea's small life (LIFE_EVERY; flotsam 45% of it, picked up for a 15 s detour);
//   · the director's events (its tension at her speed to its threshold; a sign a mile off: 90 s to it, 10 s at its card);
//   · the drifts (DRIFT_EVERY, found 75% of the time; 150 s to it and 25 s at the rescue, a gift's worth);
//   · the adventure map's open chests, windmills and warehouses within 900 m (the world's own; their weekly rule);
//   · the lairs of the islands she passes within 900 m of a shore lair (the world's own; a landing and a battle of 4 min,
//     its pay over the men it costs: LAIR_HOURS of an hour at sea);
//   · the sea's ships to fight: a prize every so often, the time to find one as the traffic about her is thinner or
//     thicker (TRAFFIC_WANT), a fight of 5 min, a sixth of the sea's hour.
// «Before» is the sea of docs/18 (step 5's marks, the old map and lairs, the old rates); «after» this one, with and
// without the per-captain caps (shared/src/data/seahaul.ts). What is valued: silver, and goods at their base price.
// The daily caps fall on a day's count; a day of one to four hours at sea is reckoned whole.

import { WORLD_SEED } from '../../shared/src/constants.ts';
import { advHour, buildAdv, chestPay, millLoad, MILL_DAYS, STORE_DAYS } from '../../shared/src/data/advmap.ts';
import { GOODS } from '../../shared/src/data/goods.ts';
import type { GoodId } from '../../shared/src/data/goods.ts';
import { LAIR_HOURS, buildLairs } from '../../shared/src/data/lairs.ts';
import type { Lair } from '../../shared/src/data/lairs.ts';
import { DRIFT_EVERY, DRIFT_FIND, driftGift } from '../../shared/src/data/drifts.ts';
import { MARK_TIME, markWorth } from '../../shared/src/data/seamarks.ts';
import { HAUL, haulMul } from '../../shared/src/data/seahaul.ts';
import type { HaulSource } from '../../shared/src/data/seahaul.ts';
import { Rng } from '../../shared/src/rng.ts';
import { sectorGrid, SECTOR_SIZE } from '../../shared/src/world/sectors.ts';
import { generateWorld, isLand, marksNear } from '../../shared/src/world/worldgen.ts';
import type { World } from '../../shared/src/world/worldgen.ts';
import { DIRECTOR_MUL } from '../../server/src/game/director.ts';
import { FLOTSAM, LIFE_EVERY } from '../../server/src/game/sealife.ts';
import { TRAFFIC_WANT } from '../../server/src/game/traffic.ts';

/** The rates of docs/19 D3 were exactly twice those before. */
const D3 = 2;
const SPEED = 12;
const LOOK = 500;

export type Sea = 'before' | 'after' | 'capped';
/** How she sails: an all-rounder takes everything that comes (the director's signs, the drifts, the sea's prizes
 *  too); a gleaner sails for the finds alone — the marks, the flotsam, the map's chests, the lairs, the small things. */
export type Way = 'all' | 'gleaner';

export interface DayIncome {
  /** Silver an hour at sea, by source, and in all. */
  by: Record<string, number>;
  total: number;
  /** How many of each she took in the day. */
  n: Record<string, number>;
}

let world: World | null = null;
function W(): World {
  return (world ??= generateWorld(WORLD_SEED));
}

const flotsamWorth = (() => {
  const tot = FLOTSAM.reduce((a, f) => a + f[2], 0);
  return FLOTSAM.reduce((a, [g, [lo, hi], w]) => a + (w / tot) * ((lo + hi) / 2) * GOODS[g as GoodId].basePrice, 0);
})();

/** The director's average of an event in silver at ⚓L (half its signs pay a purse of 150–300 × the ship's level's
 *  multiple, the rest are hands, gear, standing or trouble: counted as nothing). */
const eventWorth = (L: number) => 0.5 * 225 * (1 + 0.5 * (L - 1));

/** One day of `hours` at sea at ⚓L in a sea; `seed` the route's own dice. */
export function seaDay(L: number, hours: number, sea: Sea, seed = 1, way: Way = 'all'): DayIncome {
  const all = way === 'all';
  const w = W();
  const rng = new Rng(seed * 7919 + L);
  const after = sea !== 'before';
  const capped = sea === 'capped';
  const k = after ? 1 : 1 / D3;
  const markLimit = after ? w.marks.length : w.marksFrom ?? w.marks.length;
  const adv = buildAdv(w);
  const objs = adv.objs.slice(0, after ? adv.objs.length : adv.legacy?.objs ?? adv.objs.length).filter((o) => o.kind === 'chest' && !o.guard || o.kind === 'mill' || o.kind === 'store');
  const lairs = buildLairs(w).filter((l: Lair) => l.role === 'shore' && l.island >= 0 && !w.islands[l.island].hidden && (after || !l.id.endsWith('d')));
  const by: Record<string, number> = {}, n: Record<string, number> = {};
  const count: Partial<Record<HaulSource, number>> = {};
  const take = (src: string, silver: number, haul?: HaulSource) => {
    let v = silver;
    if (haul && capped) {
      const mul = haulMul(count[haul] ?? 0, haul, t);
      v *= mul;
      if (mul === 1) count[haul] = (count[haul] ?? 0) + 1; // (the day's count is of the full ones)
    }
    by[src] = (by[src] ?? 0) + v;
    n[src] = (n[src] ?? 0) + 1;
  };
  // Her waters: the squares of her level.
  const squares = sectorGrid(w).filter((s) => s.level === L && s.region !== 'the_abyss');
  const sq = squares[rng.int(0, squares.length - 1)];
  let x = sq.sx * SECTOR_SIZE + SECTOR_SIZE / 2, y = sq.sy * SECTOR_SIZE + SECTOR_SIZE / 2;
  for (let i = 0; i < 50 && isLand(w, x, y); i++) {
    x += rng.range(-1500, 1500);
    y += rng.range(-1500, 1500);
  }
  let h = rng.range(0, Math.PI * 2), leg = 0;
  const worked = new Set<number>(), visited = new Set<string>();
  const T = hours * 3600;
  let t = 0, life = rng.range(LIFE_EVERY[0], LIFE_EVERY[1]) / k, tension = 0;
  const threshold = after ? 70 / DIRECTOR_MUL : 70;
  let drift = rng.range(DRIFT_EVERY[0], DRIFT_EVERY[1]) / k, prize = 0;
  // The traffic about her: the wait for a fight her level would take, by how many of the sea's ships sail about her.
  const want = TRAFFIC_WANT.contested * (after ? 1 : 1 / D3);
  const prizeWait = 2400 / want; // a fit prize among every so many ships passing (60 s with the old 20 about her)
  while (t < T) {
    // A leg of the course: on, unless land lies ahead.
    leg += SPEED;
    if (x < 6000 || y < 6000 || x > 90000 || y > 90000) h = Math.atan2(48000 - x, -(48000 - y)); // back from the Wall
    else if (leg > 4000 || isLand(w, x + Math.sin(h) * 400, y - Math.cos(h) * 400)) {
      h += rng.range(0.8, 2.2) * (rng.chance(0.5) ? 1 : -1);
      leg = 0;
      t += 3; // (the turn)
      if (isLand(w, x, y)) {
        x += rng.range(-300, 300);
        y += rng.range(-300, 300);
      }
      continue;
    }
    const fx = Math.sin(h), fy = -Math.cos(h);
    x += fx * SPEED;
    y += fy * SPEED;
    t += 1;
    // The marks near her track.
    if (Math.floor(t) % 5 === 0) {
      for (const m of marksNear(w, x, y, LOOK + 200)) {
        if (m.id >= markLimit || worked.has(m.id)) continue;
        const lat = Math.hypot(m.x - x, m.y - y);
        if (lat > LOOK) continue;
        worked.add(m.id);
        t += (2 * lat) / SPEED + 15 + MARK_TIME[m.kind];
        take('marks', m.kind === 'lantern' ? 0 : markWorth(L, 0.5), 'marks');
      }
      for (const o of objs) {
        if (visited.has(o.id) || Math.abs(o.x - x) > 900 || Math.abs(o.y - y) > 900 || Math.hypot(o.x - x, o.y - y) > 900) continue;
        visited.add(o.id);
        t += (2 * Math.hypot(o.x - x, o.y - y)) / SPEED + 20;
        const v = o.kind === 'chest' ? chestPay(o.level, false).silver : millLoad(o.good ?? 'timber', o.region, o.kind === 'mill' ? MILL_DAYS : STORE_DAYS) * GOODS[o.good ?? 'timber'].basePrice;
        take('adv', v, 'adv');
      }
      for (const l of lairs) {
        if (visited.has(l.id) || Math.abs(l.x - x) > 900 || Math.abs(l.y - y) > 900 || Math.hypot(l.x - x, l.y - y) > 900) continue;
        visited.add(l.id);
        t += (2 * Math.hypot(l.x - x, l.y - y)) / SPEED + 240;
        take('lairs', LAIR_HOURS.avg * advHour(l.level), 'lairs');
      }
    }
    // The small life.
    life -= 1;
    if (life <= 0) {
      life = rng.range(LIFE_EVERY[0], LIFE_EVERY[1]) / k;
      if (rng.chance(0.45)) {
        t += 15;
        take('life', flotsamWorth, 'life');
      }
    }
    // The director.
    tension += Math.min(2, 0.6 + SPEED / 12);
    if (all && tension >= threshold) {
      tension = 0;
      t += 100;
      take('events', eventWorth(L));
    }
    // The drifts.
    drift -= 1;
    if (drift <= 0) {
      drift = rng.range(DRIFT_EVERY[0], DRIFT_EVERY[1]) / k;
      if (all && rng.chance(DRIFT_FIND)) {
        t += 175;
        take('drifts', 0.6 * (driftGift('turtle_weed', L).silver + driftGift('turtle_weed', L).n * GOODS.tar.basePrice));
      }
    }
    // The sea's ships.
    prize += 1;
    if (all && prize >= prizeWait) {
      prize = 0;
      t += 300;
      take('prizes', advHour(L) / 6);
    }
  }
  const total = Object.values(by).reduce((a, b) => a + b, 0) / hours;
  for (const s of Object.keys(by)) by[s] = Math.round(by[s] / hours);
  return { by, total: Math.round(total), n };
}

/** The mean over a few routes of the hour's income in each sea. */
export function seaHourIncome(L: number, hours: number, sea: Sea, routes = 6, way: Way = 'all'): DayIncome {
  const runs = Array.from({ length: routes }, (_, i) => seaDay(L, hours, sea, i + 1, way));
  const by: Record<string, number> = {}, n: Record<string, number> = {};
  for (const r of runs) {
    for (const [s, v] of Object.entries(r.by)) by[s] = (by[s] ?? 0) + v / routes;
    for (const [s, v] of Object.entries(r.n)) n[s] = (n[s] ?? 0) + v / routes;
  }
  for (const s of Object.keys(by)) by[s] = Math.round(by[s]);
  for (const s of Object.keys(n)) n[s] = Math.round(n[s] * 10) / 10;
  return { by, total: Math.round(runs.reduce((a, r) => a + r.total, 0) / routes), n };
}

export { HAUL };
