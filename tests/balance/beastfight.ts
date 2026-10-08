// The beasts' sea fight (owner, 2026-10-07: «акулы всякие они не должны убивать моих людей… я вот уже сражаюсь с
// акулой минуты 2, это не нормально вообще»): a captain's real session gives «Атаковать» on a beast of the sea and her
// helmsman and gun captains do the rest (server/src/game/pursuit.ts), as on a phone — the same captain the sea-fight
// clock sails (seafight.ts captainRun). Counted: the fight's length from the order and from her first broadside, the
// men she lost, the hull she lost, and whether the beast got away (the chase given up) or beat her.

import assert from 'node:assert/strict';
import type { BeastId } from '../../shared/src/data/beasts.ts';
import { BEASTS, yieldScale } from '../../shared/src/data/beasts.ts';
import { GOODS } from '../../shared/src/data/goods.ts';
import type { GoodId } from '../../shared/src/data/goods.ts';
import { clampLevel } from '../../shared/src/data/shiplevel.ts';
import type { ShipClassId } from '../../shared/src/data/ships.ts';
import { beastBrain, clearBeasts, spawnBeast, spawnGroup, spawnWhiteOrca } from '../../server/src/game/beasts.ts';
import type { Game } from '../../server/src/game/Game.ts';
import { pursuitOf, startPursuit, stopPursuit } from '../../server/src/game/pursuit.ts';
import type { ShipEntity } from '../../server/src/game/ship.ts';
import type { FakeConn } from '../helpers.ts';
import { openWater } from './duel.ts';
import { seaCaptain } from './seafight.ts';

/** The hull a captain of each level sails (the sea's own pirate hulls of that level, as the sea-fight clock's). */
export const BEAST_HULL: Record<number, ShipClassId> = { 1: 'sloop', 2: 'sloop', 3: 'schooner', 4: 'brigantine', 5: 'brig', 6: 'brig', 7: 'frigate', 8: 'frigate', 9: 'razee' };

/** The bands the owner set (2026-10-07): an ordinary beast of her level dies in 10–20 s of guns at close range, a big
 *  whale in 20–30 s, a rare one in no more than 40 s. */
export const BEAST_BAND: Record<BeastId, [number, number]> = {
  shark: [10, 20], orca: [10, 20], narwhal: [10, 20],
  humpback: [20, 30], sperm_whale: [20, 30],
  white_orca: [20, 40], young_serpent: [20, 40],
};

export interface BeastRun {
  /** Seconds from «Атаковать» to the beast dead; −1 if it lived. */
  sec: number;
  /** Seconds from her first broadside to the beast dead; −1 if it lived or she never fired. */
  fight: number;
  killed: boolean;
  /** The chase given up (the beast got away out of sight or the forty seconds without a hit either way). */
  escaped: boolean;
  /** Her men lost, and her hull lost (share of its whole). */
  men: number;
  hull: number;
  /** The beast's level and hers. */
  level: number;
  blevel: number;
}

let n = 0;

/** «Атаковать» on one beast `from` metres off (on her beam's side), until it is dead, she is beaten to a plank, the chase
 *  is given up or `maxSec` runs out. The pod the White Orca brings when `pod` is set. */
export function beastRun(game: Game, beast: BeastId, level: number, k: number, o: { from?: number; maxSec?: number; blevel?: number; pod?: boolean; cls?: ShipClassId } = {}): BeastRun {
  const from = o.from ?? 400, maxSec = o.maxSec ?? 180;
  const cls = o.cls ?? BEAST_HULL[level] ?? 'frigate';
  const blevel = clampLevel(BEASTS[beast].cls, o.blevel ?? level);
  const at = openWater(game, 4000 + k);
  const h = (k * 2.399) % (Math.PI * 2);
  const s = seaCaptain(game, cls, level, at.x, at.y, h);
  const me = s.ship!;
  n++;
  const bx = at.x + Math.sin(h + 1.3) * from, by = at.y - Math.cos(h + 1.3) * from;
  let b: ShipEntity;
  if (beast === 'white_orca' && o.pod) b = spawnWhiteOrca(game, bx, by);
  else if (beast === 'white_orca') {
    b = spawnBeast(game, 'white_orca', bx, by, blevel);
    b.elite = true;
  } else b = spawnGroup(game, beast, bx, by, blevel, 1)[0] ?? spawnBeast(game, beast, bx, by, blevel);
  // A cruise, as she comes on it at sea.
  me.state.speed = me.stats.maxSpeed * 0.6;
  me.input = { rudder: 0, sailTarget: 0.75 };
  const crew0 = me.crew;
  me.lastStandUntil = Infinity; // never sent home: beaten to a plank, she has lost the run
  const t0 = game.now;
  let first = -1, escaped = false;
  const emit = game.emit.bind(game);
  game.emit = (ev, x, y) => {
    if (first < 0 && ev.k === 'volley' && ev.ship === me.id && (ev.side === 'port' || ev.side === 'starboard')) first = game.now;
    emit(ev, x, y);
  };
  assert.equal(startPursuit(game, s, b.id, 'guns'), null);
  const alive = () => b.alive && game.ships.has(b.id);
  while (game.now - t0 < maxSec && me.alive && me.hull > 1 && alive()) {
    game.step();
    if (alive() && !pursuitOf(me)) {
      escaped = true;
      break;
    }
  }
  game.emit = emit;
  const killed = !alive() && me.alive && me.hull > 1;
  const res: BeastRun = {
    sec: killed ? Math.round((game.now - t0) * 10) / 10 : -1,
    fight: killed && first >= 0 ? Math.round((game.now - first) * 10) / 10 : -1,
    killed, escaped,
    men: Math.max(0, crew0 - me.crew),
    hull: Math.round(((me.stats.hullMax - Math.max(0, me.hull)) / me.stats.hullMax) * 1000) / 1000,
    level, blevel,
  };
  void beastBrain;
  stopPursuit(game, s, 'off');
  clearBeasts(game);
  me.lastStandUntil = 0;
  me.state.x = 1000 + n * 50;
  me.docked = 'saltmarrow';
  const conn = s.conn as unknown as FakeConn;
  conn.inbox.length = 0;
  conn.send = () => {};
  conn.sendBinary = () => {};
  return res;
}

/** The nearest-rank quantile. */
export function q(xs: number[], p: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
}

export interface BeastRow {
  beast: BeastId;
  level: number;
  blevel: number;
  n: number;
  killed: number;
  escaped: number;
  /** From the first broadside: median, p90. From «Атаковать»: median, p90. */
  fightMed: number;
  fightP90: number;
  secMed: number;
  secP90: number;
  /** Men lost: mean and most; hull lost: mean share. */
  menMean: number;
  menMax: number;
  hullMean: number;
}

export function beastRows(game: Game, beast: BeastId, level: number, runs: number, o: { from?: number; maxSec?: number; blevel?: number; pod?: boolean } = {}): BeastRow {
  const xs: BeastRun[] = [];
  for (let k = 0; k < runs; k++) xs.push(beastRun(game, beast, level, k, o));
  const ok = xs.filter((x) => x.killed);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    beast, level, blevel: xs[0].blevel, n: runs, killed: ok.length, escaped: xs.filter((x) => x.escaped).length,
    fightMed: r1(q(ok.map((x) => x.fight), 0.5)), fightP90: r1(q(ok.map((x) => x.fight), 0.9)),
    secMed: r1(q(ok.map((x) => x.sec), 0.5)), secP90: r1(q(ok.map((x) => x.sec), 0.9)),
    menMean: r1(xs.reduce((a, x) => a + x.men, 0) / runs), menMax: Math.max(...xs.map((x) => x.men)),
    hullMean: Math.round((xs.reduce((a, x) => a + x.hull, 0) / runs) * 100) / 100,
  };
}

// ------------------------------------------------------------------------------------------------ the hunter's hour

/** The income model (owner's brief, 2026-10-07: «a faster kill must not double the income per hour»): the seconds from
 *  one beast flensed to the next one met and given «Атаковать» — the living sea raises a group about a captain some
 *  forty seconds apart, two and a half to four kilometres off (beasts.ts spawnAbout), and she cruises to it. */
export const HUNT_SEEK = 90;

/** What a carcass flensed is worth at the goods' base prices (the rare's share in), at a level. */
export function carcassValue(id: BeastId, level: number): number {
  const d = BEASTS[id];
  const k = yieldScale(id, level);
  let v = 0;
  for (const [g, [lo, hi]] of Object.entries(d.yields) as [GoodId, [number, number]][]) v += Math.max(0, (k * (lo + hi + 0.99)) / 2 - 0.49) * GOODS[g].basePrice;
  if (d.rare) v += d.rare.chance * GOODS[d.rare.good].basePrice;
  return Math.round(v);
}

/** Silver an hour hunting one kind at a level: each try the search (HUNT_SEEK), the fight from «Атаковать» (`sec`, or the
 *  clock's `cap` when it lived), and the flensing when it died; `kill` the share of tries that kill. */
export function huntHour(id: BeastId, level: number, sec: number, kill = 1, cap = 180): number {
  const per = HUNT_SEEK + kill * (sec + BEASTS[id].flense) + (1 - kill) * cap;
  return Math.round((3600 / per) * kill * carcassValue(id, level));
}
