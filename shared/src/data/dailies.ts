// Daily orders (docs/11 P6): three a day for every captain, drawn from what the sea asks of a captain of that level.
// Each pays silver and experience; all three open a chest, and days in a row add to what the chest holds.

import { Rng, hashString } from '../rng.ts';
import { XP_UNITS, lumpXp } from './xpcurve.ts';

export type DailyKind = 'sink' | 'sink_pirates' | 'board' | 'prize' | 'land' | 'chart' | 'ports' | 'contraband' | 'fleet' | 'dive' | 'fish' | 'beast';

export interface DailyDef {
  kind: DailyKind;
  min: number;
  max: number;
  minLevel: number;
  /** Silver and experience for the order at level 1 (they grow with the level). */
  silver: number;
  xp: number;
  text: [string, string]; // English and Russian, {n} the count
}

export const DAILY_DEFS: Record<DailyKind, DailyDef> = {
  sink: { kind: 'sink', min: 3, max: 6, minLevel: 1, silver: 90, xp: 120, text: ['Sink ships: {n}.', 'Потопите корабли: {n}.'] },
  sink_pirates: { kind: 'sink_pirates', min: 2, max: 4, minLevel: 3, silver: 110, xp: 140, text: ['Sink pirate ships: {n}.', 'Потопите пиратские корабли: {n}.'] },
  board: { kind: 'board', min: 1, max: 2, minLevel: 5, silver: 140, xp: 170, text: ['Take ships by boarding: {n}.', 'Возьмите корабли на абордаж: {n}.'] },
  prize: { kind: 'prize', min: 1, max: 1, minLevel: 8, silver: 160, xp: 180, text: ['Bring prizes home: {n}.', 'Приведите призы домой: {n}.'] },
  land: { kind: 'land', min: 2, max: 4, minLevel: 1, silver: 80, xp: 110, text: ['Land a party ashore: {n}.', 'Высадите десант на берег: {n}.'] },
  chart: { kind: 'chart', min: 2, max: 5, minLevel: 1, silver: 70, xp: 100, text: ['Chart islands: {n}.', 'Нанесите острова на карту: {n}.'] },
  ports: { kind: 'ports', min: 3, max: 5, minLevel: 1, silver: 80, xp: 100, text: ['Put in at different ports: {n}.', 'Зайдите в разные порты: {n}.'] },
  contraband: { kind: 'contraband', min: 5, max: 15, minLevel: 10, silver: 150, xp: 150, text: ['Sell contraband: {n}.', 'Продайте контрабанду: {n}.'] },
  fleet: { kind: 'fleet', min: 1, max: 2, minLevel: 20, silver: 180, xp: 220, text: ['Win fleet actions (two ships with you): {n}.', 'Выиграйте бои флотом (с вами два корабля): {n}.'] },
  fish: { kind: 'fish', min: 10, max: 25, minLevel: 1, silver: 80, xp: 100, text: ['Take fish: {n}.', 'Наловите рыбы: {n}.'] },
  beast: { kind: 'beast', min: 1, max: 3, minLevel: 8, silver: 150, xp: 180, text: ['Take beasts of the sea: {n}.', 'Добудьте морских зверей: {n}.'] },
  dive: { kind: 'dive', min: 1, max: 1, minLevel: 35, silver: 220, xp: 260, text: ['Go down in a diving bell: {n}.', 'Спуститесь в водолазном колоколе: {n}.'] },
};

export const DAILY_KINDS = Object.keys(DAILY_DEFS) as DailyKind[];
export const DAILY_COUNT = 3;
/** Days in a row add a tenth each to the chest, up to half again. */
export const STREAK_STEP = 0.1;
export const STREAK_MAX = 5;

export interface DailyOrder {
  kind: DailyKind;
  need: number;
  progress: number;
  done: boolean;
  /** Ports already put in at today (the "different ports" order). */
  seen?: string[];
}

export interface DailyState {
  /** The days a captain came to sea in a row, and the last of them (the login bonus). */
  login?: { day: number; streak: number };
  day: number; // days since 1970 (UTC)
  orders: DailyOrder[];
  streak: number; // days in a row with all three done, before today
  lastFullDay: number;
  chest: boolean; // today's chest opened
}

export function dayOf(ms: number): number {
  return Math.floor(ms / 86_400_000);
}

/** Today's three orders for a captain: the same all day, different each day and for each captain. */
export function rollDailies(accountId: string, day: number, level: number): DailyOrder[] {
  const rng = new Rng((hashString(`${accountId}:${day}`) ^ 0x5bd1e995) >>> 0);
  const pool = DAILY_KINDS.filter((k) => DAILY_DEFS[k].minLevel <= level);
  const out: DailyOrder[] = [];
  while (out.length < DAILY_COUNT && pool.length) {
    const i = Math.floor(rng.float() * pool.length);
    const def = DAILY_DEFS[pool.splice(i, 1)[0]];
    out.push({ kind: def.kind, need: rng.int(def.min, def.max), progress: 0, done: false });
  }
  return out;
}

/** An order's pay at a level. */
export function dailyReward(kind: DailyKind, level: number): { silver: number; xp: number } {
  const d = DAILY_DEFS[kind], k = 1 + level / 10;
  return { silver: Math.round(d.silver * k), xp: lumpXp(level, d.xp / DAILY_XP_POINT) };
}

/** An order's experience: its weight (`xp`, written for the first level) over this, in units of her own level's ship
 *  sunk (docs/26: a sinking order of three to six ships teaches as three more). */
export const DAILY_XP_POINT = 40;

/** The chest for all three: twice an order's silver, with the streak's share on top. */
export function chestReward(level: number, streak: number): { silver: number; xp: number } {
  const s = 1 + STREAK_STEP * Math.min(STREAK_MAX, streak);
  return { silver: Math.round(250 * (1 + level / 10) * s), xp: lumpXp(level, XP_UNITS.dailyChest * s) };
}

export function dailyText(kind: DailyKind, need: number, lang: 0 | 1): string {
  return DAILY_DEFS[kind].text[lang].replace('{n}', String(need));
}

/** The server's lines about the orders, English → Russian, for the client's translator ({0} a number, {1} a text). */
export function dailyPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const d of Object.values(DAILY_DEFS)) {
    const [en, ru] = d.text;
    out.push([en.replace('{n}', '{0}'), ru.replace('{n}', '{0}')]);
    out.push([`Daily order done: ${en.replace('{n}', '{0}')} +{1} silver.`, `Поручение дня выполнено: ${ru.replace('{n}', '{0}')} +{1} серебра.`]);
  }
  out.push(['All three daily orders done: the chest holds {0} silver. Days in a row: {1}.', 'Все три поручения дня выполнены: в сундуке {0} серебра. Дней подряд: {1}.']);
  return out;
}
