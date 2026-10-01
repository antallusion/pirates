// The server's lines of docs/18 V (the tie-in), English → Russian: the land's resources (the store's cap, the
// workshop, the ship's fittings, the market), the settled creature dwellings, the bestiary's pages, the admin's
// replies. The fittings' names the sentences carry are here too.

import { FITTINGS } from '../../../shared/src/data/landecon.ts';

const names: Record<string, string> = {};
for (const f of Object.values(FITTINGS)) names[f.name[0]] = f.name[1];

export const SERVER_RU_V18: Record<string, string> = {
  ...names,
  // the land's resources
  'Your store holds no more than {0} {1}: {2} rot on the beach.': 'Склад держит не больше {0} ({1}): ещё {2} гниёт на берегу.',
  'Needs {0} more {1} (from the lairs of the islands).': 'Не хватает: {1} — ещё {0} (из логов на островах).',
  'No {0} in your store.': 'На складе нет: {0}.',
  // the ship's fittings
  'Lie off your island: its carpenters fit her out.': 'Встаньте у своего острова: оснастку ставят его плотники.',
  'No such fitting': 'Такой оснастки нет',
  '{0}: rank {1} fitted.': '{0}: поставлена ступень {1}.',
  // the workshop
  'No such work': 'Такой работы нет',
  'Build a market in your town first: its workshop makes it.': 'Сначала постройте в городе рынок: это делает его мастерская.',
  'Raise the market to level {0} first.': 'Сначала поднимите рынок до уровня {0}.',
  'Lie off your island: its workshop makes it.': 'Встаньте у своего острова: это делает его мастерская.',
  'No room in your locker for it.': 'В вашем сундуке для этого нет места.',
  'The workshop makes the {0} for you.': 'Мастерская делает для вас: {0}.',
  // the creature dwellings
  'Raise your flag over it first.': 'Сначала поднимите над ним свой флаг.',
  'It is settled already.': 'Оно уже обустроено.',
  'The dwelling of the {0} on {1} is settled: half as many again each week, for {2} bone a week.': 'Жилище — {0} — на острове {1} обустроено: в полтора раза больше прироста каждую неделю; кость — {2} в неделю.',
  // the bestiary
  'A new page of the bestiary: {0}.': 'Новая страница бестиария: {0}.',
  // the admin
  'The bestiary: {0} of {1} pages written.': 'Бестиарий: вписано страниц — {0} из {1}.',
  '{0}: rank {1}.': '{0}: ступень {1}.',
  'Fittings: {0}.': 'Оснастка: {0}.',
  'The store full: {0} of shell, bone and venom.': 'Склад полон: по {0} панциря, кости и яда.',
  'Store: {0} shell, {1} bone, {2} venom (cap {3}). Fittings: {4}.': 'Склад: панцирь {0}, кость {1}, яд {2} (предел {3}). Оснастка: {4}.',
};
