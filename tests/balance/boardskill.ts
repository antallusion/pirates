// docs/25 block Д (items 53–63, owner 2026-10-09: «Абордаж должен быть интересный, чтобы капитанские навыки, группа и
// умения решали … делай все пункты»): what each of a path's moves lays «in its role», reckoned in the engine's own
// terms on a real build of her level (tests/balance/boardlen.ts captainAt: a skill a level, the artifacts of her band)
// in a boarding against a captain of her level. Shared by tests/balance/boarding.test.ts and tools/balance-paths.ts.
//
// The roles, each a share of a side's strength:
// - strike: the harm of one cast (the blow on the stack pointed at, a half-blow on one beside it, a blow on every
//   stack or every shooter, a sickness's bites) as a share of her whole army as it came aboard — her captain's blast
//   (7% of her side's strength, the boarding's scale at its level from round 2) × the page × her school's lift;
// - drain: the share of each of her stacks dragged under; mend: the share of each of yours stood up again;
// - hold: what it lays while it holds, as a share of a side's blows — a blow or a shot harder by x on the share of
//   the side's strength that strikes so (melee, shooters), harm taken less by x, her shots blind on her shooters'
//   share; the points at the engine's rates (luck and morale: 4% a point, TAC_CHANCE_PER_POINT — a blow doubled, a turn
//   more; initiative 6% and speed 3% a point, measured: a side given the point for three rounds wins as often as one
//   whose blows land that much harder, `node tools/balance-paths.ts --rates`); on one stack the stack's share of the
//   side; blows that draw no answer half a stack's blow each;
// - again: the share of her side that acts once more.
// A move with a strike in it is weighed as a strike; with a heal, as a mend.

import type { CaptainId } from '../../shared/src/data/captains.ts';
import { UNITS } from '../../shared/src/data/army.ts';
import type { ArmyStack } from '../../shared/src/data/army.ts';
import { homeMul } from '../../shared/src/data/hero.ts';
import type { HeroBattle } from '../../shared/src/data/hero.ts';
import {
  HOME_MUL, PAGE_UNLOCK, PATH_PAGES, PATH_SCHOOL, ULT_LEVEL, drainCap, moveFx, pathBook, pathHoldExtra, powered, raiseCap,
} from '../../shared/src/data/paths.ts';
import type { BtMods, PageFx, PathPageId } from '../../shared/src/data/paths.ts';
import { SICK_TURNS } from '../../shared/src/data/paths.ts';
import { TAC_CHANCE_PER_POINT, boardSlots } from '../../shared/src/data/tactical.ts';
import { captainAt, playerArmy } from './boardlen.ts';

export type Role = 'strike' | 'drain' | 'mend' | 'hold' | 'again';
export interface RoleOf {
  role: Role;
  /** Its share in its role. */
  v: number;
  /** Rounds it holds (0: no hold), the one it is given in counted. */
  rounds: number;
}
export type MoveId = PathPageId | 'innate' | 'ult';

/** The engine's rates for a point against a share of blows (see above). */
export const POINT_RATE = { luck: TAC_CHANCE_PER_POINT, morale: TAC_CHANCE_PER_POINT, speed: 0.03, init: 0.06 } as const;

/** Her army's strength by how it strikes: the shooters' share (by the threat the sea's mind weighs: men × blow ×
 *  attack). */
export function shooterShare(army: readonly ArmyStack[]): number {
  let all = 0, sh = 0;
  for (const x of army) {
    const d = UNITS[x.u];
    if (!d) continue;
    const t = x.n * ((d.dmin + d.dmax) / 2) * (1 + 0.05 * d.atk);
    all += t;
    if (d.shots > 0) sh += t;
  }
  return all > 0 ? sh / all : 0;
}

/** What a powered move lays in its role (the hero `hb` gives it, `k` her school's lift on it). */
export function roleOfFx(fx: PageFx, k: number, level: number, hb: HeroBattle, path: CaptainId): RoleOf {
  const n = boardSlots(level);
  const fs = shooterShare(playerArmy(level)), fm = 1 - fs;
  const rounds = fx.self || fx.foe || fx.one ? 1 + pathHoldExtra(fx, hb.pow) : 0;
  const blast = 0.07 * k;
  const strike = (fx.dmg ?? 0) + (fx.ring ?? 0) + n * (fx.all ?? 0) + n * fs * (fx.shooters ?? 0) + 2 * (fx.row ?? 0) + SICK_TURNS * (fx.sicken ?? 0);
  if (strike > 0) return { role: 'strike', v: blast * strike, rounds };
  if (fx.heal || fx.raise || fx.mend) {
    const cap = fx.raise ? raiseCap(path, level) : 0.35;
    const v = fx.mend ? Math.min(0.5, fx.mend * k) / n : Math.min(cap, (fx.heal ?? fx.raise ?? 0) * k);
    return { role: 'mend', v, rounds };
  }
  if (fx.drain) return { role: 'drain', v: Math.min(drainCap(path, level), fx.drain * k), rounds };
  if (fx.allAgain) return { role: 'again', v: fx.allShare ?? 1, rounds };
  if (fx.again) return { role: 'again', v: 1 / n, rounds };
  const lay = (m: BtMods | undefined, mine: boolean, one: boolean): number => {
    if (!m) return 0;
    const sign = mine ? 1 : -1;
    let v = 0;
    v += Math.max(0, sign * (m.melee ?? 0)) * (one ? 1 : fm) + Math.max(0, sign * (m.shot ?? 0)) * (one ? 1 : fs);
    v += Math.max(0, -sign * (m.taken ?? 0)) + Math.max(0, -sign * (m.shotTaken ?? 0)) * (mine ? fs : fs);
    for (const p of ['luck', 'morale', 'speed', 'init'] as const) v += Math.max(0, sign * (m[p] ?? 0)) * POINT_RATE[p];
    if (m.blind && !mine) v += fs;
    if ((m.noAnswer && !mine) || (m.noRet && mine)) v += 0.5;
    if (m.still && !mine) v += 1;
    if (m.mad && !mine) v += 1.5;
    return one ? v / n : v;
  };
  const own = fx.target === 'own';
  let v = lay(fx.self, true, false) + lay(fx.foe, false, false) + lay(fx.one, own, true);
  if (fx.free) v += (Math.min(fx.free, Math.ceil(n * fm)) / n) * 0.5;
  return { role: 'hold', v, rounds };
}

/** Her school's lift on a move: a page's (spellMul's for her own path's pages), the innate move's and ultimate's. */
export function liftOf(hb: HeroBattle, path: CaptainId, id: MoveId): number {
  if (id === 'innate' || id === 'ult') return (hb.mul[PATH_SCHOOL[path]] ?? 1) * HOME_MUL * (hb.innateMul ?? 1);
  return (hb.mul[PATH_PAGES[id].school] ?? 1) * homeMul(path, id) * (hb.pageMul ?? 1);
}

/** A move of her path at her level on her real build (seed: her primaries' draws). */
export function roleOf(path: CaptainId, id: MoveId, level: number, seed = 11, hb = captainAt(path, level, seed)): RoleOf {
  const fx = id === 'innate' || id === 'ult' ? powered(moveFx(path, id, level), path, level, 'move') : powered(PATH_PAGES[id].fx, path, level);
  return roleOfFx(fx, liftOf(hb, path, id), level, hb, path);
}

/** The moves of her path open at her level: her innate move, her pages, her ultimate. */
export function movesAt(path: CaptainId, level: number): MoveId[] {
  return ['innate', ...pathBook(path).filter((id) => level >= PAGE_UNLOCK[PATH_PAGES[id].level]), ...(level >= ULT_LEVEL ? ['ult' as const] : [])];
}
/** A page of her home school. */
export const isHomePage = (path: CaptainId, id: MoveId): boolean => id !== 'innate' && id !== 'ult' && PATH_PAGES[id].school === PATH_SCHOOL[path];

/** Two levels a band (a quarter and three quarters in), as tests/balance/boarding.test.ts samples them. */
export const BAND_LEVELS = [3, 8, 13, 18, 23, 28, 33, 38, 43, 48, 53, 58];
