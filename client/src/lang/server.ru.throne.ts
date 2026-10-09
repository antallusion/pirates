// The server's lines of the Throne of the Sea, part 1 (docs/19 E1–E3), English → Russian: glory's ranks and boons,
// the mastery tree, the trials of mastery and their legends, the chronicle's line, the tester's replies. The names
// the sentences carry (the nodes, the branches, the legends and their ships) come from the shared data.

import { thronePatterns } from '../../../shared/src/data/throne.ts';
import { TITAN_IDS, TITAN_NAMES } from '../../../shared/src/data/titans.ts';

export const SERVER_RU_THRONE: Record<string, string> = {
  ...Object.fromEntries(thronePatterns()),
  ...Object.fromEntries(TITAN_IDS.map((k) => TITAN_NAMES[k].name)), // the titans' names in the lines (docs/19 E10)
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
  // the seals of the deep (docs/19 E9)
  'Seal {0} opens the mythic depth: {1}, {2} rounds.': 'Печать {0} открывает мифическую глубину: «{1}», раундов: {2}.',
  'The mythic depth throws your party back into the surf. The seal falls to {0}.': 'Мифическая глубина отбрасывает ваш отряд в прибой. Печать падает до {0}.',
  'The depth is won, but late: {0} rounds of {1}. The seal holds at {2}.': 'Глубина взята, но поздно: раундов {0} из {1}. Печать остаётся на {2}.',
  'Seal {0} won in {1} rounds: the seal rises to {2} and now opens {3}.': 'Печать {0} взята за {1} р.: печать растёт до {2} и теперь открывает «{3}».',
  '{0} carries a seal of the deep to {1}.': '{0} поднимает печать глубин до {1}.',
  'The seals open at level {0}.': 'Печати открываются на {0}-м уровне.',
  'Seal {0}, mythic depth: {1}': 'Печать {0}, мифическая глубина: «{1}»',
  // the titans (docs/19 E10)
  'A titan serves a ship of level {0} and up.': 'Титан служит кораблю уровня {0} и выше.',
  'The Grail gives one titan a week: come again next week.': 'Грааль даёт одного титана в неделю: приходите на следующей неделе.',
  'The {0} serves you already: never two of a kind.': '{0} уже служит вам: двух одного вида не бывает.',
  'Two titans aboard at the most.': 'На борту не больше двух титанов.',
  'Raise the Grail over your town first.': 'Сначала поднимите Грааль над своим городом.',
  'The {0} rises at the Grail and follows your ship.': '{0} поднимается у Грааля и идёт за вашим кораблём.',
  'Come in to the shore of a lair of your seal: within the boats’ reach.': 'Подойдите к берегу логова вашей печати, на расстояние шлюпок.',
};
