// docs/19 E9: the Seals of the Deep — a key, as Mythic+ keys go. A captain at the cap holds one seal: its level (2–20)
// and the grotto or guardian it opens. At any lair of that kind her boats reach, the seal opens the lair's mythic depth
// — her own fight, the lair at ⚓10 and stronger by the seal's level, with the week's afflictions on it (the poisoned
// tide, the fury, the shields of the deep, the reinforcements; one at seal 2, all four from 11) and a round limit.
// Won within the limit, the seal grows (by two when won fast) and turns to another lair; won late it holds; lost it
// falls a step. Her best of the week goes on the sea's table. Everything here is a function of the level and the week
// alone, the same for the server, the client and the balance tools.

import type { Tr } from './estate.ts';
import type { LairKind } from './lairs.ts';
import { seaHourOf } from './seamarks.ts';

export type SealAffix = 'tide' | 'fury' | 'shields' | 'reinforce';
export const SEAL_AFFIXES: readonly SealAffix[] = ['tide', 'fury', 'shields', 'reinforce'];

export const SEAL_AFFIX_NAMES: Record<SealAffix, Tr> = {
  tide: ['Poisoned tide', 'Ядовитый прилив'],
  fury: ['Fury', 'Ярость'],
  shields: ['Shields of the deep', 'Щиты глубин'],
  reinforce: ['Reinforcements', 'Подкрепления'],
};

export const SEAL_AFFIX_TEXT: Record<SealAffix, Tr> = {
  tide: ['Every round opens with the poisoned surf: each of her stacks loses 4% of its strength.', 'Каждый раунд начинается с ядовитого прибоя: каждый ваш отряд теряет 4 % сил.'],
  fury: ['Creatures cut below half strike 30% harder.', 'Существа, потерявшие больше половины, бьют на 30 % сильнее.'],
  shields: ['In the first two rounds the creatures take 35% less harm.', 'Первые два раунда существа получают на 35 % меньше урона.'],
  reinforce: ['In rounds 3 and 6 a fresh pack comes up out of the dark: a fifth of the lair more each time.', 'В 3-м и 6-м раундах из темноты выходит свежая стая: каждый раз ещё пятая часть логова.'],
};

/** The words the battle's line shows for the seal's own doings (the afflictions as they strike, the limit passed). */
export const SEAL_MOVES: Record<string, Tr> = {
  seal_tide: SEAL_AFFIX_NAMES.tide,
  seal_fury: SEAL_AFFIX_NAMES.fury,
  seal_shields: SEAL_AFFIX_NAMES.shields,
  seal_reinforce: SEAL_AFFIX_NAMES.reinforce,
  seal_late: ['The seal fades', 'Печать гаснет'],
};

/** The grottos and the guardians: the lairs a seal opens (the great islands' chains of the deeper waters). */
export const SEAL_KINDS: readonly LairKind[] = [
  'serpent_grotto', 'maw_pit', 'crab_hollow', 'wyrm_gallery', 'hydra_pool', 'banshee_hollow',
  'turtle_guardian', 'leviathan_shoal', 'ape_throne', 'roc_eyrie', 'titan_wreck', 'serpent_temple',
];

export const SEAL_MIN = 2;
export const SEAL_MAX = 20;
/** The army a mythic lair stands with: the lair at this level and size, times the seal's might. */
export const SEAL_LAIR_LEVEL = 10;
export const SEAL_LAIR_SIZE = 'avg' as const;

/** The poisoned tide's bite a round (a share of each of her stacks' hit points), the fury's lift below half, the
 *  shields' cut in the first rounds, the reinforcements' rounds and their share of the lair. */
export const SEAL_TIDE = 0.04;
export const SEAL_FURY = 0.3;
export const SEAL_SHIELDS = { cut: 0.35, rounds: 2 } as const;
export const SEAL_REINFORCE = { rounds: [3, 6] as readonly number[], share: 0.2 } as const;

/** Each level of the seal adds this share of the lair. */
export const SEAL_STEP = 0.07;

export function clampSeal(lv: number): number {
  return Math.max(SEAL_MIN, Math.min(SEAL_MAX, Math.round(lv) || SEAL_MIN));
}

/** The seal's might over the lair's own army (balance: tests/balance/seals.ts). */
export function sealMight(lv: number): number {
  return 1 + SEAL_STEP * (clampSeal(lv) - SEAL_MIN);
}

/** How many of the week's afflictions a seal of this level carries: one at 2, two from 4, three from 7, all from 11. */
export function sealAffixCount(lv: number): number {
  const l = clampSeal(lv);
  return l >= 11 ? 4 : l >= 7 ? 3 : l >= 4 ? 2 : 1;
}

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** The week's order of the afflictions (each of the 24 orders in turn, a new one each week). */
export function weekAffixes(week: number): SealAffix[] {
  const left = [...SEAL_AFFIXES];
  let k = ((Math.floor(week) % 24) + 24) % 24;
  const out: SealAffix[] = [];
  for (let n = left.length; n > 0; n--) {
    const f = factorial(n - 1);
    out.push(left.splice(Math.floor(k / f), 1)[0]);
    k %= f;
  }
  return out;
}

/** A seal's afflictions this week. */
export function sealAffixes(lv: number, week: number): SealAffix[] {
  return weekAffixes(week).slice(0, sealAffixCount(lv));
}

/** The rounds a seal gives (the mythic depth's clock): 8 at seal 2, a round fewer every four levels, at least 4. */
export function sealRounds(lv: number): number {
  return Math.max(4, 8 - Math.floor((clampSeal(lv) - SEAL_MIN) / 4));
}

/** Won within two thirds of the limit: the seal grows by two. */
export const fastRounds = (lv: number): number => Math.floor((sealRounds(lv) * 2) / 3);

/** What a mythic fight does to the seal: +2 won fast, +1 won in time, 0 won late, −1 lost. */
export function sealStep(won: boolean, rounds: number, lv: number): number {
  if (!won) return -1;
  if (rounds <= fastRounds(lv)) return 2;
  return rounds <= sealRounds(lv) ? 1 : 0;
}

/** What a mythic depth won in time leaves her over the men it cost (those are paid back at their price, as a guard's
 *  chest pays its fight back — docs/17 H4): a share of an hour at sea at ⚓10 growing with the seal, pearls, a chance
 *  of an artifact, and the lesson's multiple. */
export function sealPay(lv: number): { silver: number; pearls: number; art: number; xpMul: number } {
  const l = clampSeal(lv);
  return { silver: Math.round(seaHourOf(SEAL_LAIR_LEVEL) * (0.2 + 0.02 * l)), pearls: 1 + Math.floor(l / 2), art: Math.min(0.5, 0.08 + 0.02 * l), xpMul: 1 + 0.1 * l };
}

/** A captain's seal as it is kept on her (docs/19 E9). */
export interface SealRec {
  lv: number;
  kind: LairKind;
  /** Her best this week (the week's number, the level, the rounds it took). */
  best?: { week: number; lv: number; rounds: number };
  /** Mythic depths fought, and won in time. */
  runs: number;
  timed: number;
}

/** A row of the week's table. */
export interface SealRow {
  name: string;
  lv: number;
  rounds: number;
  you?: boolean;
}

/** Her seal as the Throne's tab shows it. */
export interface SealView {
  lv: number;
  kind: LairKind;
  affixes: SealAffix[];
  rounds: number;
  fast: number;
  week: number;
  best: { lv: number; rounds: number } | null;
  /** The nearest lair of its kind (where, how far, its island), and whether her boats reach one now. */
  near: { x: number; y: number; d: number; island: string } | null;
  reach: boolean;
  /** Why the mythic depth may not be entered now (null: it may). */
  why: string | null;
  pay: { silver: number; pearls: number; art: number };
  board: SealRow[];
  runs: number;
  timed: number;
  fighting?: boolean;
}
