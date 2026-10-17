// The one taxonomy of quests on the screens (docs/36 §1): a quest's class (shared/src/data/questclass.ts) and its word —
// the port's «Задания» switches, the journal's rows and «Цели и вести» all say it from here.

import { questClass } from '../../../shared/src/data/questclass.ts';
import type { QuestClass, QuestKind } from '../../../shared/src/data/questclass.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/questclass.ts';

const L = dict(EN, RU);

export { questClass };
export type { QuestClass };

/** The word of one quest's class (a row's tag): «Кампания», «Побочное», «Поручение»; a contract, a day's order. */
export function classWord(c: QuestClass | 'contract' | 'daily'): string {
  return L(`one.${c}`);
}

/** The word of a class's switch: «Кампания», «Побочные», «Поручения», «На день». */
export function classSwitch(c: QuestClass | 'daily'): string {
  return L(`many.${c}`);
}

/** A quest's word by its kind. */
export const kindWord = (kind: QuestKind): string => classWord(questClass({ kind }));
