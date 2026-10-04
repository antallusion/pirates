// The server's lines of the zone bosses (owner, 2026-10-04; docs/21; server/src/game/zonebosses.ts), English → Russian.
// The great ship is «корабль «…»» in the sentence: her name is a name (Железный Лев, Мать Туманов), the verb the ship's.

export const SERVER_RU_ZONEBOSSES: Record<string, string> = {
  // The world's news.
  'WORLD: On the horizon of {0}: {1} sets sail in {2} min.': 'Вести: На горизонте — {0}: корабль «{1}» поднимет паруса через {2} мин.',
  'WORLD: {0} has risen in {1}. Captains, to her! Guns only — she leaves in an hour.': 'Вести: {1}: корабль «{0}» поднял паруса. Капитаны, к бою! Только пушками — через час он уйдёт в туман.',
  'WORLD: {0} has gone into the fog of {1}, unbeaten.': 'Вести: {1}: корабль «{0}» ушёл в туман непобеждённым.',
  'WORLD: {0} is sunk in {1} by {2}.': 'Вести: {1}: корабль «{0}» потоплен. Его потопили: {2}.',
  'captains unknown': 'неизвестные капитаны',
  // The rumours and the chronicle.
  '{0} sails {1}.': '{1}: в море корабль «{0}».',
  '{0} was sunk in {1} by {2}.': '{1}: корабль «{0}» потоплен. Его потопили: {2}.',
  '{0} lies on the bottom of {1}.': '{1}: корабль «{0}» лежит на дне.',
  // The boarding ban.
  'Her decks cannot be taken — guns only': 'Её не взять на абордаж — только пушками',
  // The spoils.
  '{0} is sunk! Your part {1}%, +{2} XP, ship gear ×{3}, prize money by letter.': '«{0}» потоплен! Доля {1}%, {2} опыта, снаряжение ×{3}, призовые — письмом.',
  'The Admiralty Prize Court': 'Призовой суд Адмиралтейства',
  'The spoils of {0}': 'Добыча с корабля «{0}»',
  'Your part of her: {0}%. Pieces of ship gear taken from her: {1}. Your share of her prize money is enclosed.': 'Ваша доля в её гибели: {0}%. Корабельного снаряжения снято: {1} шт. Ваша доля призовых — во вложении.',
  'the Sea': 'Море',
  // The admin's hand (QA).
  'Usage: /zboss [region] [rise|here|leave|kill|announce|reset]': 'Использование: /zboss [море] [rise|here|leave|kill|announce|reset]',
  'Zone bosses: {0} at sea of {1}.': 'Боссы морей: в море {0} из {1}.',
  '{0}: at sea, {1}% hull, {2} min left': '«{0}»: в море, корпус {1}%, осталось {2} мин',
  '{0}: rises in {1} min': '«{0}»: поднимет паруса через {1} мин',
  '{0} is already at sea.': 'Корабль «{0}» уже в море.',
  '{0} is not at sea.': 'Корабля «{0}» нет в море.',
  '{0} is not in this zone.': '{0} — не в этой зоне.',
  'No deep water beside you for her.': 'Рядом с вами нет для неё глубокой воды.',
  '{0} rises in {1}: an hour at sea.': '{1}: корабль «{0}» поднимает паруса — на час.',
  'No open water for {0} in {1}.': '{1}: нет открытой воды для корабля «{0}».',
  '{0} goes into the fog.': 'Корабль «{0}» уходит в туман.',
  '{0} is sunk by your guns alone.': 'Корабль «{0}» потоплен одними вашими пушками.',
  '{0}: announced.': '«{0}»: объявлено.',
  '{0}: her slain slot is forgotten.': '«{0}»: отметка о её гибели в этом окне стёрта.',
};
