// The server's lines of the Throne of the Sea, part 1 (docs/19 E1–E3), English → Russian: glory's ranks and boons,
// the mastery tree, the trials of mastery and their legends, the chronicle's line, the tester's replies. The names
// the sentences carry (the nodes, the branches, the legends and their ships) come from the shared data.

import { thronePatterns } from '../../../shared/src/data/throne.ts';

export const SERVER_RU_THRONE: Record<string, string> = {
  ...Object.fromEntries(thronePatterns()),
  // glory
  'The Throne of the Sea opens: past the cap your experience is glory. Open it from the captain’s plate.': 'Открывается Престол Моря: после потолка опыт идёт в славу. Откройте его с плашки капитана.',
  'Glory rank {0}!': 'Ранг славы {0}!',
  'Glory rank {0}! A point of mastery is yours.': 'Ранг славы {0}! Вам очко мастерства.',
  'A boon of glory to choose: open the Throne.': 'Выберите дар славы: откройте окно «Престол».',
  'No such boon': 'Такого дара нет',
  'No boon of glory to choose now': 'Сейчас выбирать дар славы не из чего',
  'That boon is at its height': 'Этот дар уже на пределе',
  'The Throne opens at level {0}': 'Престол открывается на уровне {0}',
  // mastery
  'No such node': 'Такого узла нет',
  'That node is whole': 'Этот узел уже изучен целиком',
  'No point of mastery to spend': 'Нет свободного очка мастерства',
  'It wants {0} points in its branch first': 'Сначала нужно {0} очка в этой ветке',
  'Mastery: {0}.': 'Мастерство: «{0}».',
  'Nothing to forget': 'Забывать нечего',
  'Your mastery is forgotten: the points are yours to spend again.': 'Мастерство забыто: очки снова ваши.',
  // trials
  'No such skill': 'Такого навыка нет',
  'The trials open at level {0}': 'Испытания открываются на уровне {0}',
  'You are a grandmaster of that skill already': 'Вы уже грандмастер этого навыка',
  'The legend fights only an expert of her skill': 'Легенда бьётся только с экспертом своего навыка',
  'The legend will fight you again in {0} min': 'Легенда снова примет бой через {0} мин',
  'Put to sea first': 'Сначала выйдите в море',
  'The crew holds the ship': 'Команда захватила корабль',
  'A trial is under way': 'Испытание уже идёт',
  '{0} comes alongside: the trial of {1} begins.': '{0} подходит борт о борт: начинается испытание навыка «{1}».',
  'Grandmaster of {0}!': 'Грандмастер навыка «{0}»!',
  '{0} beat {1} and became a grandmaster of {2}.': '{0} стал грандмастером навыка «{2}», одолев легенду: {1}.',
  '{0} strikes her colours to you. Her steel was blunted, and so was yours: your men stand again.': '{0} спускает перед вами флаг. Её клинки были затуплены, ваши тоже: ваши люди снова на ногах.',
  '{0} holds her deck. Your men stand again; she will fight you once more in three hours.': '{0} удерживает палубу. Ваши люди снова на ногах; легенда примет бой ещё раз через три часа.',
  // the tester's replies
  'Glory {0} ({1}/{2}) · boons {3} · to choose {4} · mastery {5}/{6}.': 'Слава {0} ({1}/{2}) · дары {3} · к выбору {4} · мастерство {5}/{6}.',
  'Usage: /glory [n|xp N|reset]': 'Формат: /glory [n|xp N|reset]',
  'Mastery: {0} ({1}/{2}).': 'Мастерство: {0} ({1}/{2}).',
  'Usage: /mastery [node|branch|all|reset] · {0}': 'Формат: /mastery [узел|ветка|all|reset] · {0}',
  'Trials: none tried.': 'Испытания: ни одного.',
  'Grandmaster of {0}.': 'Грандмастер навыка «{0}».',
  'The legend of {0} waits {1} h.': 'Легенда навыка «{0}» ждёт {1} ч.',
  'The trial of {0}: {1} alongside.': 'Испытание навыка «{0}»: {1} борт о борт.',
};
