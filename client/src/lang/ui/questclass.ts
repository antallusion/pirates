// The one taxonomy of quests (docs/36 §1, shared/src/data/questclass.ts): its words, the same on the port's «Задания»,
// in the journal and in «Цели и вести».

export const EN = {
  'one.campaign': 'Campaign',
  'one.side': 'Side quest',
  'one.job': 'Job',
  'one.contract': 'Contract',
  'one.daily': 'Daily',
  'many.campaign': 'Campaign',
  'many.side': 'Side quests',
  'many.job': 'Jobs',
  'many.daily': 'Daily',
};

export const RU: Record<keyof typeof EN, string> = {
  'one.campaign': 'Кампания',
  'one.side': 'Побочное',
  'one.job': 'Поручение',
  'one.contract': 'Контракт',
  'one.daily': 'На день',
  'many.campaign': 'Кампания',
  'many.side': 'Побочные',
  'many.job': 'Поручения',
  'many.daily': 'На день',
};
