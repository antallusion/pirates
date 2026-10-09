// The server's lines of the citadels and the Throne war (docs/19 E4–E8), English → Russian: the siege declared and the
// summons, the assault, the citadel taken and held, the men left in its garrison, its titan, the season's Masters of the
// Throne. The castellans' names come from the shared data; a citadel's name is «Цитадель …» or «Форт …» with its island's.

import { CASTELLAN_NAMES, THRONE_TITLE } from '../../../shared/src/data/citadels.ts';

export const SERVER_RU_CIT: Record<string, string> = {
  ...Object.fromEntries(CASTELLAN_NAMES),
  [THRONE_TITLE[0]]: THRONE_TITLE[1],
  'Citadel of {0}': 'Цитадель {0}',
  'Fort of {0}': 'Форт {0}',
  'The Hall of the Throne': 'Зал Престола',
  '{0} h {1} min': '{0} ч {1} мин',
  '{0} min': '{0} мин',
  // declaring a siege (E7)
  'The Throne war opens at level {0}.': 'Война за Престол открывается на {0}-м уровне.',
  'Only a guild may besiege a citadel.': 'Осаждать цитадель может только гильдия.',
  'Only a captain of your guild or above may declare a siege.': 'Объявить осаду может капитан гильдии или выше по званию.',
  'Your guild holds it already.': 'Она уже принадлежит вашей гильдии.',
  'Your ally holds it.': 'Ею владеет ваш союзник.',
  'Your guild has declared a siege on it already.': 'Ваша гильдия уже объявила ей осаду.',
  '[{0}] has declared a siege on it already.': 'Ей уже объявила осаду гильдия [{0}].',
  'Two sieges at a time at the most for a guild.': 'У гильдии не больше двух осад одновременно.',
  'No such citadel.': 'Такой цитадели нет.',
  'No such order.': 'Такого приказа нет.',
  '{0} declares a siege on the {1}.': '{0} объявляет осаду: {1}.',
  'Your guild besieges the {0}. The window opens in {1}.': 'Ваша гильдия осаждает: {0}. Окно штурма откроется через {1}.',
  'Summons: [{0}] besieges the {1}': 'Призыв: [{0}] осаждает {1}',
  'Summons: [{0}] besieges the {1}. The window opens in {2}.': 'Призыв: [{0}] осаждает {1}. Окно штурма откроется через {2}.',
  '[{0}] {1} declares a siege on the {2}. The window opens in {3}: leave men in its garrison before then.': '[{0}] {1} объявляет осаду: {2}. Окно штурма откроется через {3}: успейте оставить людей в гарнизоне.',
  '[{0}] gathers to besiege the {1}.': '[{0}] собирается осаждать: {1}.',
  // the assault (E5)
  'Declare a siege on it first: only the besiegers assault it.': 'Сначала объявите осаду: штурмуют только осаждающие.',
  'The window opens in {0}.': 'Окно штурма откроется через {0}.',
  'The window is closed.': 'Окно штурма закрыто.',
  'You have assaulted it once in this siege.': 'Вы уже штурмовали её в этой осаде.',
  'Another captain of the siege is at the walls now.': 'Сейчас у стен другой капитан осады.',
  'The siege is fought on the hexes.': 'Осада идёт только на гексах.',
  'Come to its anchorage: the assault begins before its gate.': 'Подойдите к её якорной стоянке: штурм начинается у ворот.',
  'Its garrison is gone: it is yours to take.': 'Гарнизона больше нет: берите её.',
  '{0} holds the {1}: the assault begins before its walls.': '{0} держит оборону — {1}: штурм начинается у стен.',
  'The garrison of the {0} holds. Your assault cut {1}% of it; what is left of it and of its walls waits for the next of your siege.': 'Гарнизон держится — {0}. Ваш штурм выбил {1}%; остаток гарнизона и стен ждёт следующего капитана осады.',
  '[{0}] takes the {1}.': '[{0}] берёт: {1}.',
  '[{0}] {1} takes the {2}.': '[{0}] {1} берёт: {2}.',
  'The {0} has fallen': 'Пала: {0}',
  '[{0}] {1} has taken the {2} from your guild.': '[{0}] {1} отняла у вашей гильдии: {2}.',
  'Your guild takes the {0}.': 'Ваша гильдия берёт: {0}.',
  'The {0} is your guild’s: your assault was one of those that broke it.': 'Теперь за вашей гильдией — {0}: ваш штурм был среди тех, что её сломили.',
  // holding it (E6)
  'Only its guild’s captains may do that.': 'Это могут только капитаны гильдии-владелицы.',
  'Bring your ship to its anchorage.': 'Приведите корабль к её якорной стоянке.',
  'Not while its walls are under assault.': 'Не во время штурма её стен.',
  'You have none of them aboard.': 'У вас на борту нет таких людей.',
  'Keep hands enough aboard to sail her.': 'Оставьте на борту людей, чтобы корабль мог идти.',
  'Seven kinds of men in a garrison at the most.': 'В гарнизоне не больше семи видов отрядов.',
  '{0} of your men stand in the garrison of the {1} now.': 'Ваших людей в гарнизоне — {1}: {0}.',
  'Its titan of the week is taken: another rises next week.': 'Титан этой недели уже взят: следующий поднимется через неделю.',
  'No such titan.': 'Такого титана нет.',
  'Needs {0} pearls in the hold': 'Нужно {0} жемчуга в трюме',
  'The {0} rises from the citadel’s sea-gate and follows your ship.': '{0} поднимается у морских ворот цитадели и идёт за вашим кораблём.',
  // the windows (E7)
  'The window of the {0} is open: assault it before {1} are out.': 'Окно штурма открыто — {0}: штурмуйте, пока не прошло {1}.',
  '[{0}] is at the walls of the {1}.': '[{0}] у стен: {1}.',
  'The siege of the {0} is lifted: its garrison held.': 'Осада снята — {0}: гарнизон выстоял.',
  // the season (E8)
  '[{0}] {1} are the Masters of the Throne of season {2}.': '[{0}] {1} — Хозяева Престола {2}-го сезона.',
  'Your guild are the Masters of the Throne: the Pantheon, a title and the Throne’s pennant are yours.': 'Ваша гильдия — Хозяева Престола: Пантеон, титул и вымпел Престола ваши.',
  'A citadel of the Throne war stands on that island.': 'На этом острове стоит цитадель Войны за Престол.',
  // the tester's list
  'Citadels: {0}': 'Цитадели: {0}',
  'Usage: /cit [go|guild|window|siege|win|own|lose|free|points N|season|reset] [n]': 'Формат: /cit [go|guild|window|siege|win|own|lose|free|points N|season|reset] [n]', // (docs/19 E19)
};
