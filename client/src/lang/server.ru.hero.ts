// Russian for the hero's lines (docs/17 H2, server/src/game/hero.ts and the boarding battle): the level-up, First
// Aid, the orders' will, and the tester's console (/prim, /skill, /order, /art, /will).

export const SERVER_RU_HERO: Record<string, string> = {
  '{0} +1 at level {1}.': '{0} +1 на уровне {1}.',
  'First aid: {0} of your fallen stand again.': 'Первая помощь: на ноги встают павших — {0}.',
  'Not enough will': 'Не хватает воли',
  'none': 'нет',
  'All eight slots are taken.': 'Все восемь ячеек заняты.',
  'Attack {0} · Defense {1} · Power {2} · Will {3} ({4}/{5}).': 'Атака {0} · Защита {1} · Сила {2} · Воля {3} ({4}/{5}).',
  'Orders: {0}.': 'Приказов: {0}.',
  'Skills: {0}; choices waiting {1}.': 'Навыки: {0}; ждут выбора: {1}.',
  'Usage: /art [id | set regalia|hook|storm | list]': 'Как вызывать: /art [артефакт | set regalia|hook|storm | list]',
  'Usage: /art set regalia|hook|storm': 'Как вызывать: /art set regalia|hook|storm',
  'Usage: /order id | all | clear · {0}': 'Как вызывать: /order приказ | all | clear · {0}',
  'Usage: /prim [atk|def|pow|will N | reset]': 'Как вызывать: /prim [atk|def|pow|will N | reset]',
  'Usage: /skill id [0-3] | offer [n] | clear · {0}': 'Как вызывать: /skill навык [0-3] | offer [n] | clear · {0}',
  'Will {0}/{1}.': 'Воля {0}/{1}.',
};
