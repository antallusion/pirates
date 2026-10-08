// The hour of a captain's play and the curve of experience (docs/26_XP_CURVE.md): what an hour teaches a captain of a
// level by the way she plays, and the time and the ships a level costs her. A model, not the world: each kind of play
// is a loop of things done one after another, their seconds taken from the game's own measures (docs/23: an equal duel
// ≤ 30 s, 5–10 s to grapple; the boarding battle's rounds; the quests' legs between the ports), their experience from
// the game's own reckonings. Two sets of rules are kept: LEGACY, the reckonings before docs/26 (the commit f094f45a),
// and CURRENT, the live ones — the report shows both.
//
//   node tools/balance-xp.ts            the whole report (before and after)
//   tests/xpcurve.test.ts               holds the targets

import { PLOTS } from '../../shared/src/data/questgen.ts';
import type { Plot, StepKind } from '../../shared/src/data/questgen.ts';
import { DAILY_COUNT, DAILY_DEFS, DAILY_KINDS, chestReward, dailyReward } from '../../shared/src/data/dailies.ts';
import { REF_MEN } from '../../shared/src/data/advmap.ts';
import { UNITS, armyForLevel } from '../../shared/src/data/army.ts';
import { hullsFor } from '../../shared/src/data/shiplevel.ts';
import { SHIP_CLASSES } from '../../shared/src/data/ships.ts';
import { MAX_LEVEL } from '../../shared/src/constants.ts';
import * as X from '../../shared/src/data/xpcurve.ts';
import { streakMul } from '../../server/src/game/streak.ts';
import { xpHour as stacksHour } from './roamers.ts';
import { plotSize } from '../../shared/src/data/questgen.ts';
import { contractXp } from '../../shared/src/data/xpcurve.ts';

// ------------------------------------------------------------------------------------------------ the pace of play

/** Seconds, by the ship level ⚓v she sails. */
export const PACE = {
  /** Finding the next ship of her level in the dense sea (docs/19 D3), a little longer in the wide wild waters. */
  seek: (v: number): number => 30 + 3 * (v - 1),
  /** docs/23 item 36: 5–10 s from «Attack» to the grapples or the first broadside. */
  approach: 8,
  /** docs/23 item 47: an equal duel by broadsides to the bottom ≤ 30 s (median about 22–25 s). */
  sinkFight: 25,
  /** The boarding battle on the hexes, half quick combat and half played out (tests/balance/roamers.ts fightSecs). */
  boardBattle: (v: number): number => 70 + 4 * (v - 1),
  /** The wreck's loot picked up; the prize's choice (ransom, cargo, the prize to port). */
  afterSink: 12,
  afterBoard: 20,
  /** Every so many fights a port: sell, mend, sign on men, the streak ends (docs/16 #4). */
  portEvery: 8,
  portSec: 150,
  /** A leg between two harbours of her waters at the autosail's pace (docs/23: two touches), the sea wider in the wild. */
  leg: (v: number): number => (8000 + 1000 * (v - 1)) / 30,
  /** Quests taken together share their legs (three for one port and back, as a captain does). */
  bundle: 2.5,
  /** An island explored: sail to it, chart it, land at one or two of its features. */
  island: 165,
  /** The share of her kills a hunter carries a port's bounty for (its pirates only, four contracts a port, one bounty a
   *  ship since docs/26). */
  bountyShare: 0.4,
  /** A day's three orders and their chest come once in this many hours of play. */
  daySession: 2,
};

/** The share of the time of the mixed captain (WoW's questing levels: quests first, the fights between them). */
export const MIX = { quests: 0.45, hunt: 0.15, board: 0.15, stacks: 0.1, explore: 0.15 };

export type Style = 'hunt' | 'board' | 'quests' | 'stacks' | 'explore' | 'mixed';
export const STYLES: Style[] = ['hunt', 'board', 'quests', 'stacks', 'explore', 'mixed'];
export const LEVELS = [1, 3, 5, 10, 20, 30, 45, 59];

// ------------------------------------------------------------------------------------------------ the rules

export interface Rules {
  name: string;
  xpForLevel(L: number): number;
  /** A ship of ⚓v sunk / taken by a captain of level L; the boarding battle's lesson. */
  sink(L: number, v: number): number;
  board(L: number, v: number): number;
  battle(L: number, v: number): number;
  /** A port's bounty for one ship (beside the prize). */
  bounty(L: number, v: number): number;
  /** A quest of a plot at its level qL, done by a captain of level L in waters whose captains reach `top`. */
  quest(L: number, plot: Plot, qL: number, top: number): number;
  /** The quest levels a port of waters `safety` gives a plot (its level + the waters' base). */
  questBase: Record<'safe' | 'contested' | 'lawless', number>;
  /** How many quests one ship sunk moved on at once (before docs/26 every quest that wanted her: three hunts held
   *  together were done by the ships of one), and the share of a hunter's ships her bounties paid for (before, a ship
   *  counted on every bounty she held). */
  stacked: number;
  bountyShare: number;
  /** A day's orders and chest. */
  day(L: number): number;
  /** An hour of the roaming stacks of ⚓v for a captain of level L. */
  stacks(L: number, v: number): number;
  /** An island explored (charted and landed at). */
  island(L: number, v: number): number;
}

/** The ⚓ a captain of level L sails: the highest she may command (canon D12). */
export const shipOf = (L: number): number => X.shipBandOf(L);
/** Her waters by her ⚓: the Black Coast, the contested seas, the lawless. */
export const watersOf = (v: number): 'safe' | 'contested' | 'lawless' => (v <= 2 ? 'safe' : v <= 5 ? 'contested' : 'lawless');

/** The hull tier of the sea's pirates at ⚓v (the old prize reckoned by it). */
export function pirateTier(v: number): number {
  const hs = hullsFor('pirate', v);
  return hs.reduce((a, c) => a + SHIP_CLASSES[c].tier, 0) / hs.length;
}

/** Hit points of a pirate's crew of ⚓v (the ladder's usual men, armyForLevel). */
export function crewHp(v: number): number {
  return armyForLevel(v, REF_MEN[v], 7, 'pirate').reduce((a, s) => a + s.n * UNITS[s.u].hp, 0);
}

/** The share of the enemy's men a won boarding battle cuts down (some strike, some are ransomed). */
export const KILL_SHARE = 0.85;

// ---- before docs/26 (commit f094f45a): the old reckonings, kept to measure against.
const oldLevel = (L: number): number => Math.round(120 * Math.pow(L, 1.55));
const oldGap = (gap: number): number => (gap <= -3 ? 0 : gap === -2 ? 0.6 : gap === -1 ? 0.8 : gap === 0 ? 1 : gap === 1 ? 1.25 : gap === 2 ? 1.5 : 2);
const oldPrize = (base: number, L: number, v: number): number => {
  const t = pirateTier(v);
  return base * t * (1 + (t * 3) / 12) * oldGap(v - shipOf(L));
};
/** The old seaHourXp (six prizes of the mean of 40 and 90), and the share of it the stacks' hour came to, measured
 *  by node tools/balance-roamers.ts on f094f45a. */
const oldSeaHour = (v: number): number => {
  const t = pirateTier(v);
  return 6 * 65 * t * (1 + (t * 3) / 12);
};
const OLD_STACK_SHARE = [0, 0.7, 0.63, 0.66, 0.71, 0.7, 0.69, 0.69, 0.69, 0.71, 0.7];
const OLD_DAILY_CHEST = 300;

export const LEGACY: Rules = {
  name: 'before',
  xpForLevel: oldLevel,
  sink: (L, v) => oldPrize(40, L, v),
  board: (L, v) => oldPrize(90, L, v),
  battle: (_L, v) => crewHp(v) * KILL_SHARE * 0.2,
  bounty: () => 180,
  quest: (_L, plot, qL) => Math.round(plot.xp * (1 + qL / 10)),
  questBase: { safe: 0, contested: 6, lawless: 14 },
  stacked: 3,
  bountyShare: 0.8,
  day: (L) => {
    const kinds = DAILY_KINDS.filter((k) => DAILY_DEFS[k].minLevel <= L);
    const avg = kinds.reduce((a, k) => a + DAILY_DEFS[k].xp, 0) / kinds.length;
    return (1 + L / 10) * (avg * DAILY_COUNT + OLD_DAILY_CHEST * 1.2);
  },
  stacks: (_L, v) => oldSeaHour(v) * OLD_STACK_SHARE[v],
  // A new island charted (12 + its size + its strangeness, ~30) and one or two features landed at (~45 each).
  island: () => 30 + 1.5 * 45,
};

// ---- the live reckonings (shared/src/data/xpcurve.ts and the sources that use it).
const stackCache = new Map<number, number>();
export const CURRENT: Rules = {
  name: 'after',
  xpForLevel: X.xpForLevel,
  sink: (L, v) => X.prizeXp(L, v, 'sunk'),
  board: (L, v) => X.prizeXp(L, v, 'boarded'),
  battle: (L, v) => X.battleXp(L, v, KILL_SHARE, 1),
  bounty: (L) => contractXp(L, 'bounty', 1),
  quest: (L, plot, qL, top) => X.questXpFor(L, X.questXp(qL, plotSize(plot)), qL, top),
  questBase: { safe: 0, contested: 6, lawless: 14 },
  stacked: 1,
  bountyShare: PACE.bountyShare,
  day: (L) => {
    const kinds = DAILY_KINDS.filter((k) => DAILY_DEFS[k].minLevel <= L);
    const avg = kinds.reduce((a, k) => a + dailyReward(k, L).xp, 0) / kinds.length;
    return avg * DAILY_COUNT + chestReward(L, 2).xp;
  },
  stacks: (L, v) => {
    let ref = stackCache.get(v);
    if (ref === undefined) stackCache.set(v, (ref = stacksHour(v).xp));
    return X.xpAt(L, v, ref);
  },
  island: (L) => X.pointsXp(L, 30) + 1.5 * X.pointsXp(L, 45),
};

// ------------------------------------------------------------------------------------------------ the loops

export interface Hour {
  /** Experience an hour, and the part of it from quests (the board's, the ports' contracts, the day's orders). */
  xp: number;
  quests: number;
  /** Ships sunk or taken an hour. */
  kills: number;
}

const cycleSink = (v: number): number => PACE.seek(v) + PACE.approach + PACE.sinkFight + PACE.afterSink + PACE.portSec / PACE.portEvery;
const cycleBoard = (v: number): number => PACE.seek(v) + PACE.approach + PACE.boardBattle(v) + PACE.afterBoard + PACE.portSec / PACE.portEvery;
/** The mean streak bonus over a run between two ports. */
export function streakAvg(): number {
  let s = 0;
  for (let n = 1; n <= PACE.portEvery; n++) s += streakMul(n);
  return s / PACE.portEvery;
}

export function huntHour(R: Rules, L: number): Hour {
  const v = shipOf(L), n = 3600 / cycleSink(v);
  const bounty = R.bountyShare * R.bounty(L, v);
  return { xp: n * (R.sink(L, v) * streakAvg() + bounty), quests: n * bounty, kills: n };
}

export function boardHour(R: Rules, L: number): Hour {
  const v = shipOf(L), n = 3600 / cycleBoard(v);
  const bounty = R.bountyShare * R.bounty(L, v);
  return { xp: n * (R.board(L, v) * streakAvg() + R.battle(L, v) + bounty), quests: n * bounty, kills: n };
}

/** Seconds a step of a quest takes (beside the legs) and the ships it sinks or takes. */
function stepCost(k: StepKind, v: number): { sec: number; leg: number; sink: number; board: number } {
  const sink = cycleSink(v) - PACE.portSec / PACE.portEvery, board = cycleBoard(v) - PACE.portSec / PACE.portEvery;
  switch (k) {
    case 'visit2': case 'visit3': case 'deliver2': case 'deliver3': case 'home': case 'back': case 'race2': return { sec: 15, leg: 1, sink: 0, board: 0 };
    case 'reach': return { sec: 0, leg: 1.5, sink: 0, board: 0 };
    case 'pickup': return { sec: 15, leg: 0, sink: 0, board: 0 };
    case 'sink_pirates': case 'sink_ghosts': case 'sink_hunters': case 'sink_any': return { sec: 2 * sink, leg: 0, sink: 2, board: 0 };
    case 'board': return { sec: 2 * board, leg: 0, sink: 0, board: 2 };
    case 'prize': return { sec: board + 60, leg: 0, sink: 0, board: 1 };
    case 'sink_named': return { sec: 2 * sink + 60, leg: 0, sink: 1, board: 0 };
    case 'land_site': case 'land_any': case 'land_any2': return { sec: 90, leg: 0, sink: 0, board: 0 };
    case 'dive': return { sec: 2 * 90, leg: 0, sink: 0, board: 0 };
    case 'chart': return { sec: 3.5 * 50, leg: 0, sink: 0, board: 0 };
    case 'time_in': return { sec: 5.5 * 60, leg: 0, sink: 0, board: 0 };
    case 'contraband': case 'customs': case 'tribute': return { sec: 60, leg: 0, sink: 0, board: 0 };
    case 'find_letter': return { sec: 90, leg: 0, sink: 0, board: 0 };
    case 'catch_any': return { sec: 20 * 10, leg: 0, sink: 0, board: 0 };
    case 'catch_big': return { sec: 150, leg: 0, sink: 0, board: 0 };
    case 'hunt_whale': return { sec: 1.5 * 70, leg: 0, sink: 0, board: 0 };
    case 'hunt_orca': return { sec: 3.5 * 70, leg: 0, sink: 0, board: 0 };
    case 'hunt_shark': return { sec: 3 * 70, leg: 0, sink: 0, board: 0 };
    default: return { sec: 60, leg: 0, sink: 0, board: 0 };
  }
}

const safetyFits = (plot: Plot, w: 'safe' | 'contested' | 'lawless'): boolean => {
  switch (plot.where ?? 'any') {
    case 'safe': return w !== 'lawless';
    case 'unsafe': return w !== 'safe';
    case 'lawless': return w === 'lawless';
    case 'strange': return w !== 'safe';
    default: return true;
  }
};

/** The quests a captain of level L picks on a board of her waters: the eight nearest her level she may take. */
export function boardFor(R: Rules, L: number): { plot: Plot; qL: number }[] {
  const w = watersOf(shipOf(L));
  const base = R.questBase[w];
  return PLOTS.filter((p) => safetyFits(p, w) && p.level + base <= L).map((p) => ({ plot: p, qL: p.level + base })).sort((a, b) => b.qL - a.qL || a.plot.id.localeCompare(b.plot.id)).slice(0, 8);
}

/** The top level of the waters she takes her quests in: her own band's (a port of a square of her level, docs/16 P2). */
export const watersTop = (L: number): number => X.bandLevels(Math.min(10, shipOf(L) + 1))[1];

export function questHour(R: Rules, L: number): Hour {
  const v = shipOf(L);
  const board = boardFor(R, L);
  if (!board.length) return { xp: 0, quests: 0, kills: 0 };
  let sec = 0, qxp = 0, kxp = 0, kills = 0;
  for (const { plot, qL } of board) {
    let s = 0, legs = 0, sk = 0, bd = 0;
    for (const k of plot.steps) {
      const c = stepCost(k, v);
      const shared = c.sink + c.board > 0 ? R.stacked : 1; // (the ships of one hunt counted on the others too, before)
      s += c.sec / shared;
      legs += c.leg;
      sk += c.sink / shared;
      bd += c.board / shared;
    }
    sec += s + (legs * PACE.leg(v)) / PACE.bundle + 20; // and the quest taken and handed in
    qxp += R.quest(L, plot, qL, watersTop(L));
    kxp += sk * R.sink(L, v) + bd * (R.board(L, v) + R.battle(L, v));
    kills += sk + bd;
  }
  const k = 3600 / sec;
  return { xp: (qxp + kxp) * k, quests: qxp * k, kills: kills * k };
}

export function stackHour(R: Rules, L: number): Hour {
  return { xp: R.stacks(L, shipOf(L)), quests: 0, kills: 0 };
}

export function exploreHour(R: Rules, L: number): Hour {
  return { xp: (3600 / PACE.island) * R.island(L, shipOf(L)), quests: 0, kills: 0 };
}

/** The mixed captain: her time shared as MIX says, the day's orders on top (they ride on what she does anyway). */
export function mixedHour(R: Rules, L: number): Hour {
  const parts: [number, Hour][] = [[MIX.quests, questHour(R, L)], [MIX.hunt, huntHour(R, L)], [MIX.board, boardHour(R, L)], [MIX.stacks, stackHour(R, L)], [MIX.explore, exploreHour(R, L)]];
  const day = R.day(L) / PACE.daySession;
  let xp = day, quests = day, kills = 0;
  for (const [w, h] of parts) {
    xp += w * h.xp;
    quests += w * h.quests;
    kills += w * h.kills;
  }
  return { xp, quests, kills };
}

export function styleHour(R: Rules, style: Style, L: number): Hour {
  switch (style) {
    case 'hunt': return huntHour(R, L);
    case 'board': return boardHour(R, L);
    case 'quests': return questHour(R, L);
    case 'stacks': return stackHour(R, L);
    case 'explore': return exploreHour(R, L);
    default: return mixedHour(R, L);
  }
}

// ------------------------------------------------------------------------------------------------ the road

/** Own-level ships sunk to the next level. */
export const killsPerLevel = (R: Rules, L: number): number => R.xpForLevel(L) / R.sink(L, shipOf(L));

/** Hours of a style from level a to level b (b > a): each level at its own hour. */
export function hoursBetween(R: Rules, a: number, b: number, style: Style = 'mixed'): number {
  let h = 0;
  for (let L = a; L < b; L++) h += R.xpForLevel(L) / styleHour(R, style, L).xp;
  return h;
}

/** Minutes for one level. */
export const minutesAt = (R: Rules, L: number, style: Style = 'mixed'): number => (60 * R.xpForLevel(L)) / styleHour(R, style, L).xp;

export const BANDS: [number, number][] = [[1, 2], [1, 10], [10, 20], [20, 30], [30, 40], [40, 50], [50, 60], [1, 60]];

/** The share of the mixed hour's experience from quests at a level. */
export const questShare = (R: Rules, L: number): number => {
  const h = mixedHour(R, L);
  return h.quests / h.xp;
};

/** The share over the whole road 1→60, weighted by the time spent at each level. */
export function questShareRoad(R: Rules): number {
  let q = 0, all = 0;
  for (let L = 1; L < MAX_LEVEL; L++) {
    const h = mixedHour(R, L), t = R.xpForLevel(L) / h.xp;
    q += h.quests * t;
    all += h.xp * t;
  }
  return q / all;
}

// ------------------------------------------------------------------------------------------------ the owner's fight

/** «Почти каждый бой даёт +1» (owner, 2026-10-08): one boarding at level L of a ship of ⚓v, with a bounty on her and
 *  three hunting quests of the board (each «sink two pirates») taken together. Before docs/26 one ship moved all three
 *  quests at once (two ships finished three quests); now a ship counts on one quest only. Returns the experience of
 *  the fight with its share of the quests' rewards, and the fights to a level at that rate. */
export function ownerFight(R: Rules, L: number, v: number): { prize: number; battle: number; bounty: number; quests: number; total: number; perLevel: number } {
  const hunts = PLOTS.filter((p) => p.steps.some((k) => k === 'sink_pirates')).map((p) => ({ plot: p, qL: Math.min(L + 1, p.level) }));
  const pick = hunts.sort((a, b) => b.qL - a.qL).slice(0, 3);
  const qxp = pick.reduce((a, q) => a + R.quest(L, q.plot, q.qL, watersTop(L)), 0) / pick.length;
  // Three quests of two ships each: before, two ships finished all three; now six ships do.
  const quests = (3 * qxp) / ((3 * 2) / R.stacked);
  const prize = R.board(L, v), battle = R.battle(L, v), bounty = R.bounty(L, v);
  const total = prize + battle + bounty + quests;
  return { prize, battle, bounty, quests, total, perLevel: R.xpForLevel(L) / total };
}

/** A new captain's first hour: the First Watch (five steps, three of the captain's goals), three ports seen for the
 *  first time, a new sea, the deed of the first prize — then mixed play to the hour's end. The level she ends it at. */
export function firstHour(R: Rules): { onceXp: number; level: number } {
  const once = R.name === 'before'
    ? [40, 55, 70, 85, 100, 120, 120, 120, 140, 140, 140, 186, 400]
    : null;
  let level = 1, xp = 0, t = 0;
  const add = (amount: number): void => {
    xp += amount;
    while (xp >= R.xpForLevel(level)) {
      xp -= R.xpForLevel(level);
      level++;
    }
  };
  let onceXp = 0;
  if (once) for (const a of once) {
    onceXp += a;
    add(a);
  } else {
    // The same deeds in units at her level as she grows (shared/src/data/xpcurve.ts XP_UNITS, XP_POINT).
    const units = [2, 2.5, 3, 3.5, 4, 1.5, 1.5, 1.5, 140 / 80, 140 / 80, 140 / 80, 186 / 80, 4];
    for (const u of units) {
      const a = X.lumpXp(level, u);
      onceXp += a;
      add(a);
    }
  }
  // The rest of the hour (the watch and the firsts take a quarter of it): mixed play, level by level.
  t = 0.25;
  while (t < 1) {
    const h = mixedHour(R, level).xp, need = R.xpForLevel(level) - xp;
    const dt = need / h;
    if (t + dt > 1) {
      xp += (1 - t) * h;
      break;
    }
    t += dt;
    xp = 0;
    level++;
  }
  return { onceXp: Math.round(onceXp), level: Math.round((level + xp / R.xpForLevel(level)) * 10) / 10 };
}
