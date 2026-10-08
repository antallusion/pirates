// The common cause (docs/11 P6): one goal a day for the whole sea — every captain's deed counts toward it, a bar all
// can see fills, and when it is reached everyone who put a hand to it is paid; the more they did, the more.
import { XP_UNITS, lumpXp } from './xpcurve.ts'; // docs/26

export type CommonKind = 'pirates' | 'charts' | 'landings' | 'prizes' | 'boardings';

export interface CommonDef {
  kind: CommonKind;
  /** The goal for a quiet sea; it grows with the captains at sea when the day's goal is set. */
  base: number;
  text: [string, string]; // English and Russian, {n} the goal
}

export const COMMON_DEFS: Record<CommonKind, CommonDef> = {
  pirates: { kind: 'pirates', base: 60, text: ['Sink pirate ships across the sea: {n}.', 'Потопить пиратские корабли по всему морю: {n}.'] },
  charts: { kind: 'charts', base: 80, text: ['Chart islands: {n}.', 'Нанести острова на карту: {n}.'] },
  landings: { kind: 'landings', base: 80, text: ['Land parties ashore: {n}.', 'Высадить десанты на берег: {n}.'] },
  prizes: { kind: 'prizes', base: 20, text: ['Bring prizes home: {n}.', 'Привести призы домой: {n}.'] },
  boardings: { kind: 'boardings', base: 30, text: ['Take ships by boarding: {n}.', 'Взять корабли на абордаж: {n}.'] },
};
export const COMMON_KINDS = Object.keys(COMMON_DEFS) as CommonKind[];

/** The day's goal: the kind turns with the day, the size with the captains at sea (never under the base). */
export function commonGoalFor(day: number, captains: number): { kind: CommonKind; target: number } {
  const kind = COMMON_KINDS[((day % COMMON_KINDS.length) + COMMON_KINDS.length) % COMMON_KINDS.length];
  return { kind, target: Math.round(COMMON_DEFS[kind].base * Math.max(1, captains / 8)) };
}

/** What a hand in the common cause earns: by level, and a little more for every deed of one's own (up to double). */
export function commonReward(level: number, mine: number): { silver: number; xp: number } {
  const more = 1 + Math.min(1, mine / 10), k = (1 + level / 10) * more;
  return { silver: Math.round(300 * k), xp: lumpXp(level, XP_UNITS.goal * more) };
}

export function commonText(kind: CommonKind, target: number, lang: 0 | 1): string {
  return COMMON_DEFS[kind].text[lang].replace('{n}', String(target));
}

/** The server's lines about it, English → Russian, for the client's translator (world news comes as "WORLD: …"; the
 *  translator takes the heading off and reads the sentence). */
export function commonPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (const d of Object.values(COMMON_DEFS)) out.push([`The common cause is done: ${d.text[0].replace('{n}', '{0}')} Every hand in it is paid.`, `Общее дело сделано: ${d.text[1].replace('{n}', '{0}')} Каждому, кто приложил руку, заплачено.`]);
  out.push(['Your share of the common cause: {0} silver.', 'Ваша доля в общем деле: {0} серебра.']);
  return out;
}
