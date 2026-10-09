// docs/19 E13: forging and reforging at the island's workshop (docs/18 V). An artifact at the anvil takes, at her
// choice, one of two works:
//  - «Перековать навыки» — its primaries spread anew over Attack, Defence, Power and Will (the same number of points);
//  - «Выковать свойство» / «Перековать свойство» — one forged line (FORGE_LINE: melee, shots, armour, orders, their
//    will, the fallen, the day's will), its kind and its size rolled anew, within its class's span.
// The new roll stands beside the old one until she chooses which to keep (as Diablo's mystic): nothing is ever lost
// to the dice, only paid for. Every time at the anvil asks half the first again (to three times the first): the sink.
//
// The cost is reckoned in hours at sea at ⚓10 (seaHourOf) by the artifact's class — half of it in the smith's silver,
// a fifth in pearls, a tenth each in shell, bone and venom (the land's resources: shared/src/data/landecon.ts).
// Pure data and reckoning: server/src/game/landecon.ts does the work, the town's screen shows it.

import { ARTIFACTS, FORGE_LINES, artPrimOf, forgeSpan, primSum } from './artifacts.ts';
import type { ArtClass, ArtForge, ForgeLine } from './artifacts.ts';
import { LAND_RES_DEF } from './bestiary.ts';
import { GOODS } from './goods.ts';
import type { Prims } from './hero.ts';
import type { Item } from './items.ts';
import type { LandCost } from './landecon.ts';
import { seaHourOf } from './seamarks.ts';
import type { Rng } from '../rng.ts';

export type ForgeWhat = 'prim' | 'line';

/** Hours at sea at ⚓10 a first time at the anvil asks, by the artifact's class (a relic's own part is a major). */
export const FORGE_HOURS: Record<ArtClass, number> = { treasure: 0.08, minor: 0.12, major: 0.2, relic: 0.3 };
/** Each time at the anvil the next asks this share of the first again, up to FORGE_RISE_MAX times. */
export const FORGE_RISE = 0.5;
export const FORGE_RISE_MAX = 4;
/** The level of the waters whose hour the cost is reckoned in (the cap's: the workshop is the endgame's sink). */
export const FORGE_SEA_LEVEL = 10;
/** The island's market the anvil needs (the workshop stands by it). */
export const FORGE_MARKET = 1;

export interface ForgeCost {
  silver: number;
  pearls: number;
  land: LandCost;
  /** What it is worth, in hours at sea at ⚓10. */
  hours: number;
}

/** What the next time at the anvil asks for this artifact. */
export function forgeCost(it: Item): ForgeCost {
  const cls = ARTIFACTS[it.art ?? '']?.cls ?? 'treasure';
  const n = Math.max(0, Math.min(FORGE_RISE_MAX, it.forge?.n ?? 0));
  const hours = FORGE_HOURS[cls] * (1 + FORGE_RISE * n);
  const worth = seaHourOf(FORGE_SEA_LEVEL) * hours;
  return {
    silver: Math.round((worth * 0.5) / 50) * 50,
    pearls: Math.max(1, Math.round((worth * 0.2) / GOODS.pearls.basePrice)),
    land: {
      shell: Math.max(1, Math.round((worth * 0.1) / LAND_RES_DEF.shell.value)),
      bone: Math.max(1, Math.round((worth * 0.1) / LAND_RES_DEF.bone.value)),
      venom: Math.max(1, Math.round((worth * 0.1) / LAND_RES_DEF.venom.value)),
    },
    hours: Math.round(hours * 100) / 100,
  };
}

/** The roll's new value of a forged line: its span by the artifact's class, to the half-percent. */
export function rollLine(rng: Rng, art: string, k: ForgeLine): number {
  const [lo, hi] = forgeSpan(art, k);
  return Math.round((lo + (hi - lo) * rng.float()) * 200) / 200;
}

/** The artifact's primaries spread anew: the same number of points, each to one of the four by the dice. */
export function rollPrims(rng: Rng, it: Item): Partial<Prims> {
  const total = primSum(artPrimOf(it));
  const out: Prims = { atk: 0, def: 0, pow: 0, will: 0 };
  const keys: (keyof Prims)[] = ['atk', 'def', 'pow', 'will'];
  for (let i = 0; i < total; i++) out[keys[rng.int(0, 3)]]++;
  const p: Partial<Prims> = {};
  for (const k of keys) if (out[k]) p[k] = out[k];
  return p;
}

/** A new roll at the anvil: the primaries' spread or the forged line anew, the rest as it was; one more time. */
export function forgeRoll(rng: Rng, it: Item, what: ForgeWhat): ArtForge {
  const was = it.forge;
  const next: ArtForge = { n: (was?.n ?? 0) + 1 };
  if (was?.p) next.p = { ...was.p };
  if (was?.k) {
    next.k = was.k;
    next.v = was.v;
  }
  if (what === 'prim') next.p = rollPrims(rng, it);
  else {
    const k = rng.pick(FORGE_LINES);
    next.k = k;
    next.v = rollLine(rng, it.art ?? '', k);
  }
  return next;
}

/** Can the anvil do this work on it: an artifact, and for the primaries, one with points to spread. */
export function forgeable(it: Item, what: ForgeWhat): boolean {
  if (!it.art || !ARTIFACTS[it.art]) return false;
  return what === 'line' || primSum(ARTIFACTS[it.art].prim) > 0;
}
