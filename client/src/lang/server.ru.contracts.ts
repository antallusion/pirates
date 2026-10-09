// The server's lines of the Admiralty's contracts (docs/19 E15), English → Russian: the contracts' own words (their
// names, givers, stories and steps — shared/src/data/admiralty.ts), the board's refusals, the legend alongside, the
// raiders after the cargo, the pay, the week's lapse, the tester's replies.

import { ADM_KIND_NAMES, admiraltyPatterns } from '../../../shared/src/data/admiralty.ts';

export const SERVER_RU_CONTRACTS: Record<string, string> = {
  ...Object.fromEntries(admiraltyPatterns()),
  ...Object.fromEntries(Object.values(ADM_KIND_NAMES)),
  // the board
  'No such contract this week.': 'Такого контракта на этой неделе нет.',
  'The Admiralty gives its contracts to captains of level {0}.': 'Адмиралтейство даёт контракты капитанам {0}-го уровня.',
  'You have that contract already.': 'Этот контракт уже у вас.',
  'That contract is done this week.': 'Этот контракт на этой неделе уже выполнен.',
  'Contracts are taken at an Admiralty board, in a great harbour.': 'Контракты берут на доске Адмиралтейства — в большой гавани.',
  'The Admiralty gives its contracts at its own boards': 'Адмиралтейство раздаёт контракты только на своих досках',
  'The Admiralty’s contract is yours: {0}.': 'Контракт Адмиралтейства ваш: «{0}».',
  'Contract fulfilled: {0}. The Admiralty pays {1} silver and {2} glory.': 'Контракт выполнен: «{0}». Адмиралтейство платит {1} серебра и {2} славы.',
  'The week is out: the Admiralty’s contract {0} has lapsed.': 'Неделя кончилась: контракт Адмиралтейства «{0}» истёк.',
  '{0} fulfils all three of the Admiralty’s contracts this week.': '{0} выполняет все три контракта Адмиралтейства этой недели.',
  // the legend
  'Take the Admiralty’s contract first.': 'Сначала возьмите контракт Адмиралтейства.',
  'The legend is boarded already.': 'Абордаж легенды уже идёт.',
  'Bring your ship to the gold mark: the legend sails there.': 'Подведите корабль к золотой метке: легенда ходит там.',
  '{0} comes about to meet you aboard the {1}: the Admiralty’s warrant is served.': '{0} разворачивает «{1}» вам навстречу: ордер Адмиралтейства вручён.',
  'The {0} strikes her colours: the Admiralty’s warrant is served.': '«{0}» спускает флаг: ордер Адмиралтейства исполнен.',
  'The {0} struck to {1}: your warrant is served too.': 'Флаг «{0}» спущен перед капитаном {1}: ваш ордер тоже исполнен.',
  'The {0} holds her deck. You have cut {1}% of her army; what is left of it waits for your next boarding.': '«{0}» отбивается. Вы выбили {1}% её армии; остаток ждёт вашего следующего абордажа.',
  // the cargo
  'Raiders close in: they have word of the Admiralty’s cargo.': 'Налётчики идут на сближение: они прознали о грузе Адмиралтейства.',
  // the tester's console
  'Admiralty week {0}, {1} h left.': 'Неделя Адмиралтейства {0}, осталось {1} ч.',
  'Admiralty week {0}, {1} h left.{2}': 'Неделя Адмиралтейства {0}, осталось {1} ч.{2}',
  ' {0}: {1}, {2} silver, {3} glory — {4}.': ' {0}: {1}, {2} серебра, {3} славы — {4}.',
  'Admiralty week {0}, {1} h left. 1: {2}, {3} silver, {4} glory — {5}. 2: {6}, {7} silver, {8} glory — {9}. 3: {10}, {11} silver, {12} glory — {13}.':
    'Неделя Адмиралтейства {0}, осталось {1} ч. 1: {2}, {3} серебра, {4} славы — {5}. 2: {6}, {7} серебра, {8} славы — {9}. 3: {10}, {11} серебра, {12} славы — {13}.',
  'taken {0}/{1}': 'взят, {0}/{1}',
  done: 'выполнен', // (its «open» is the general table's «открыт»)
  'Taken: {0}.': 'Взят: «{0}».',
  'Fulfilled: {0}.': 'Выполнен: «{0}».',
  'Your Admiralty contracts are forgotten.': 'Ваши контракты Адмиралтейства забыты.',
  'Nowhere to sail for it.': 'Плыть некуда.',
  'Off the mark of {0}.': 'У метки контракта «{0}».',
  'Usage: /contract take 1-3': 'Формат: /contract take 1-3',
  'Usage: /contract done 1-3': 'Формат: /contract done 1-3',
  'Usage: /contract go 1-3': 'Формат: /contract go 1-3',
  'Usage: /contract [list|take N|done N|week|reset|go N]': 'Формат: /contract [list|take N|done N|week|reset|go N]',
};
