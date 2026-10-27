// The weak army's next step (owner, 2026-10-28: «посмотри остров … качаешь остров — открываются новые бойцы рангом
// выше, нанимать можно в портах или плавучих портах. ключ — это остров»). The top captains of the live sea sailed at
// level 11–14 with nothing but deckhands and a few marines: they never found that the island's dwellings open the
// higher tiers for hire in every port and at every floating waystation. `armyAdvice` reads a captain as plain data and
// says whether her army is weak for her level and the one concrete thing to do next:
//  - «наймите <существ> в любом порту или плавучем доме — у вас уже открыто» (a tier her island opened, not aboard yet);
//  - «постройте/улучшите <здание> на острове → откроются <существа ранга N>» (the next dwelling, or what it asks first);
//  - «займите свой остров» (no island yet);
//  - «не хватает серебра: …» (the next step is there, the purse is not).
// Pure and shared: the HUD's hint, the port's hire window, the island's window, the level-up card and the letters
// (in-game mail, e-mail, VK/TG — delivered elsewhere) all read the same answer.

import { UNITS, armyForLevel, armyPower } from './army.ts';
import type { ArmyStack, UnitId } from './army.ts';
import { TIER_SHIP_LEVEL, TIER_UNIT, TOWN, PORT_MARKUP, dwellingOf } from './town.ts';
import type { TownId } from './town.ts';
import { DWELL_UP_LEVEL, isTree, treeNeeds } from './isletree.ts';
import type { TreeId } from './isletree.ts';

/** A captain as the advice reads her (server: a profile and her ship; client: the state). */
export interface AdviceCaptain {
  /** The captain's level. */
  level: number;
  /** Her ship's level ⚓1–⚓10. */
  shipLevel: number;
  army: readonly ArmyStack[];
  /** Hammocks and stacks of her hull. */
  crewMax: number;
  slots: number;
  /** Her silver. */
  gold: number;
  /** Her island's buildings by id (hall, keep, market, dw1…dw7, warehouse, shipyard…) and their levels; null: no
   *  island of her own. */
  isle: Partial<Record<string, number>> | null;
  /** She keeps the drowned (the Choir, a cursed ship): tier 7 counts for her. */
  deep?: boolean;
}

export type AdviceKind = 'hire' | 'build' | 'upgrade' | 'claim' | 'silver' | 'fill';

export interface AdviceStep {
  kind: AdviceKind;
  textRu: string;
  textEn: string;
  /** The island's building to found or raise (build, upgrade, and what a dwelling asks first). */
  building?: TownId | TreeId;
  /** Its level to reach. */
  level?: number;
  /** The kind to hire (hire), or the kind the building opens (build, upgrade). */
  unit?: UnitId;
  tier?: number;
  /** Silver the step wants (a stack of ten in a port, the building's level). */
  silver?: number;
}

export interface ArmyAdvice {
  /** Her army is weak for her level (under ADVICE_WEAK of the norm). */
  weak: boolean;
  /** Her army's power against the norm of her ship's level and hammocks (1: on the norm). */
  ratio: number;
  power: number;
  norm: number;
  /** The next step (null: nothing to do — strong, or nothing more opens for her ship's level). */
  step: AdviceStep | null;
  /** The best kind she may hire now in any port or floating waystation (the island's open tiers), if any. */
  best: UnitId | null;
}

/** The advice speaks from this captain level (the island is not for the first hours). */
export const ADVICE_FROM_LEVEL = 5;
/** Under this share of the norm the army is weak. */
export const ADVICE_WEAK = 0.85;
/** A stack worth hiring: this many men of a kind. */
export const ADVICE_STACK = 10;

/** The men's names: English, Russian (who), Russian (whom: «наймите …»). */
const MEN: Partial<Record<UnitId, [string, string, string]>> = {
  deckhand: ['deckhands', 'юнги', 'юнг'],
  sailor: ['seasoned sailors', 'бывалые матросы', 'бывалых матросов'],
  marine: ['marines', 'морпехи', 'морпехов'],
  sea_guard: ['sea guards', 'морская гвардия', 'морскую гвардию'],
  musketeer: ['musketeers', 'мушкетёры', 'мушкетёров'],
  sharpshooter: ['sharpshooters', 'меткие стрелки', 'метких стрелков'],
  gunner: ['gunners', 'канониры', 'канониров'],
  bombardier: ['bombardiers', 'бомбардиры', 'бомбардиров'],
  boarder: ['boarders', 'абордажники', 'абордажников'],
  cutthroat: ['cutthroats', 'головорезы', 'головорезов'],
  guard: ['officers’ guards', 'офицерская гвардия', 'офицерскую гвардию'],
  life_guard: ['life guards', 'лейб-гвардия', 'лейб-гвардию'],
  drowned: ['drowned', 'утопленники', 'утопленников'],
  deep_spawn: ['spawn of the deep', 'порождения бездны', 'порождений бездны'],
};
export const menName = (u: UnitId, ru: boolean, whom = false): string => {
  const m = MEN[u];
  if (!m) return u;
  return ru ? (whom ? m[2] : m[1]) : m[0];
};

/** A building's name at a level: English, Russian. */
function bName(id: TownId | TreeId, level: number): [string, string] {
  const t = (TOWN as Record<string, { names: [string, string][] } | undefined>)[id];
  if (t) {
    const n = t.names[Math.max(0, Math.min(t.names.length - 1, level - 1))];
    return [n[0], n[1]];
  }
  const BASE: Record<string, [string, string]> = { warehouse: ['Warehouse', 'Склад'], shipyard: ['Shipyard', 'Верфь'], battery: ['Shore battery', 'Береговая батарея'], fort: ['Fort', 'Форт'] };
  return BASE[id] ?? [id, id];
}

/** The tiers her island opens (tier → the upgraded kind too), as every port and waystation hires them. */
export function isleTiers(isle: AdviceCaptain['isle']): Map<number, boolean> {
  const out = new Map<number, boolean>();
  if (!isle) return out;
  for (let t = 1; t <= 7; t++) {
    const L = isle[dwellingOf(t)] ?? 0;
    if (L > 0) out.set(t, L >= DWELL_UP_LEVEL);
  }
  return out;
}

/** The norm: the ladder's own army of her ship's level in her hammocks (armyForLevel, the might cap's own measure). */
export function armyNorm(shipLevel: number, crewMax: number, slots: number): number {
  return armyPower(armyForLevel(Math.max(1, shipLevel), Math.max(1, crewMax), Math.max(1, slots), 'player'));
}

const per = (u: UnitId) => Math.round(UNITS[u].cost * PORT_MARKUP);

/** The first thing a building's level asks that her island lacks (itself when nothing). */
function firstNeed(isle: Partial<Record<string, number>>, id: TreeId, level: number): [TreeId, number] {
  for (const [k, n] of treeNeeds(id, level)) if ((isle[k] ?? 0) < n) return firstNeed(isle, k, (isle[k] ?? 0) + 1);
  return [id, level];
}

const SILVER_HOW: [string, string] = ['take port jobs, win boardings and sell the plunder', 'берите задания в порту, выигрывайте абордажи и продавайте добычу'];

/** Weak or not, and the next step. Null under ADVICE_FROM_LEVEL or with no hammocks. */
export function armyAdvice(c: AdviceCaptain): ArmyAdvice | null {
  if (!c || c.level < ADVICE_FROM_LEVEL || !(c.crewMax > 0)) return null;
  const power = armyPower(c.army);
  const norm = Math.max(1, armyNorm(c.shipLevel, c.crewMax, c.slots));
  const ratio = Math.round((power / norm) * 100) / 100;
  const weak = ratio < ADVICE_WEAK;
  const open = isleTiers(c.isle);
  // What her ship may carry (the tiers by the ship's level; the drowned only for the deep's own).
  const fits = (t: number) => c.shipLevel >= TIER_SHIP_LEVEL[t] && (t !== 7 || !!c.deep);
  const aboard = (u: UnitId) => c.army.find((x) => x.u === u)?.n ?? 0;
  // The best kind she may hire now: the island's highest open tier her ship carries (its upgraded kind if open).
  let best: UnitId | null = null;
  for (const [t, up] of [...open].sort((a, b) => b[0] - a[0])) {
    if (t < 2 || !fits(t)) continue;
    best = up ? UNITS[TIER_UNIT[t]].upgrade! : TIER_UNIT[t];
    break;
  }
  const out = (step: AdviceStep | null): ArmyAdvice => ({ weak, ratio, power: Math.round(power), norm: Math.round(norm), step, best });
  if (!weak) return out(null);
  const men = c.army.reduce((a, x) => a + x.n, 0);

  // 1. A tier the island opened and her ship carries, few of them aboard: hire them in any port.
  if (best && aboard(best) < ADVICE_STACK) {
    const t = UNITS[best].tier;
    const cost = per(best) * ADVICE_STACK;
    if (c.gold < per(best) * 3) {
      return out({ kind: 'silver', unit: best, tier: t, silver: cost,
        textRu: `Не хватает серебра на ${menName(best, true, true)} (${cost} за десяток): ${SILVER_HOW[1]}.`,
        textEn: `Not enough silver for ${menName(best, false)} (${cost} for ten): ${SILVER_HOW[0]}.` });
    }
    return out({ kind: 'hire', unit: best, tier: t, silver: cost,
      textRu: `Наймите ${menName(best, true, true)} (ранг ${t}) в любом порту или плавучем доме — у вас уже открыто.`,
      textEn: `Hire ${menName(best, false)} (tier ${t}) in any port or floating waystation — your island has opened them.` });
  }

  // 2. Empty hammocks: fill them first (cheap men are better than none).
  if (men < c.crewMax * 0.6) {
    const u: UnitId = best ?? 'sailor';
    return out({ kind: 'fill', unit: u, tier: UNITS[u].tier,
      textRu: `Половина гамаков пуста (${men} из ${c.crewMax}): наберите команду в таверне любого порта.`,
      textEn: `Half the hammocks are empty (${men} of ${c.crewMax}): sign men on at any port’s tavern.` });
  }

  // 3. No island: claim one — its dwellings open the stronger men.
  if (!c.isle) {
    return out({ kind: 'claim',
      textRu: 'Займите свой остров: жилища на нём открывают бойцов рангом выше для найма в любом порту.',
      textEn: 'Claim an island of your own: its dwellings open stronger men to hire in any port.' });
  }

  // 4. The next dwelling her ship can use: found it (or raise it to the upgraded kind).
  for (let t = 2; t <= 7; t++) {
    if (!fits(t)) continue;
    const id = dwellingOf(t) as TreeId;
    const L = c.isle[id] ?? 0;
    if (L > 0) continue;
    return out(buildStep(c, id, 1, TIER_UNIT[t], t));
  }
  for (let t = 7; t >= 2; t--) {
    if (!fits(t)) continue;
    const id = dwellingOf(t) as TreeId;
    const L = c.isle[id] ?? 0;
    if (L > 0 && L < DWELL_UP_LEVEL) return out(buildStep(c, id, L + 1, UNITS[TIER_UNIT[t]].upgrade!, t));
  }
  // 5. Everything her ship carries is open and aboard: a bigger hull or a refit raises the might cap.
  return out(null);
}

function buildStep(c: AdviceCaptain, id: TreeId, level: number, unit: UnitId, tier: number): AdviceStep {
  const isle = c.isle!;
  const [k, n] = isTree(id) ? firstNeed(isle, id, level) : [id, level];
  const [en, ru] = bName(id, level > 1 ? DWELL_UP_LEVEL : 1);
  const kind: AdviceKind = level > 1 ? 'upgrade' : 'build';
  const verbRu = level > 1 ? 'Улучшите' : 'Постройте';
  const verbEn = level > 1 ? 'Raise' : 'Build';
  const toRu = level > 1 ? ` до уровня ${DWELL_UP_LEVEL}` : '';
  const toEn = level > 1 ? ` to level ${DWELL_UP_LEVEL}` : '';
  if (k !== id) {
    const [fen, fru] = bName(k, n);
    return { kind, building: k, level: n, unit, tier,
      textRu: `${verbRu} «${ru}»${toRu} на острове → откроются ${menName(unit, true)} (ранг ${tier}). Сначала: «${fru}» до уровня ${n}.`,
      textEn: `${verbEn} the ${en}${toEn} on your island → ${menName(unit, false)} (tier ${tier}) open. First: the ${fen} to level ${n}.` };
  }
  return { kind, building: id, level, unit, tier,
    textRu: `${verbRu} «${ru}»${toRu} на острове → откроются ${menName(unit, true)} (ранг ${tier}) для найма в любом порту.`,
    textEn: `${verbEn} the ${en}${toEn} on your island → ${menName(unit, false)} (tier ${tier}) open for hire in any port.` };
}
