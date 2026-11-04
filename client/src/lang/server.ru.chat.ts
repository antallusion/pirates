// The server's lines of the chat (docs/28; server/src/game/chat.ts), English → Russian.

export const SERVER_RU_CHAT: Record<string, string> = {
  'You are silenced for {0} min': 'Вам нельзя говорить ещё {0} мин',
  'You are silenced for {0} s': 'Вам нельзя говорить ещё {0} с',
  'Too many lines: you are silenced for {0} s': 'Слишком много строк: помолчите {0} с',
  'You have said that already': 'Вы это уже говорили',
  'You have no ship': 'У вас нет корабля',
  'You are in no guild': 'Вы не состоите в гильдии',
  'Report sent: the harbour master will look into it.': 'Жалоба отправлена: начальник порта разберётся.',
  'Usage: /mute name minutes': 'Как писать: /mute имя минуты',
  '{0} is silenced for {1} min.': '{0} молчит {1} мин.',
  '{0} may speak again.': '{0} снова может говорить.',
  'The harbour master silences you for {0} min.': 'Начальник порта запретил вам говорить на {0} мин.',
  // the name filter and the free rename (forum post 66: shared/src/namefilter.ts, server/src/game/names.ts)
  'That name will not do: choose another.': 'Имя не подходит: выберите другое.',
  'You have no free rename.': 'Бесплатной смены имени у вас нет.',
  'That is your name already.': 'Это и так ваше имя.',
  'The Harbour Office': 'Портовая контора',
  'Your captain has a new name': 'У вашего капитана новое имя',
  'Your ship has a new name': 'У вашего корабля новое имя',
  'Your guild has a new name': 'У вашей гильдии новое имя',
  'The name «{0}» does not keep to the rules of the sea, so your captain sails as «{1}» now. A free rename is yours: tap your portrait (top left) and choose «Change name».': 'Имя «{0}» нарушает правила моря, поэтому теперь ваш капитан ходит под именем «{1}». Смена имени для вас бесплатна: нажмите на свой портрет (вверху слева) и выберите «Сменить имя».',
  'The name «{0}» does not keep to the rules of the sea, so your ship sails as «{1}» now.': 'Имя «{0}» нарушает правила моря, поэтому теперь ваш корабль ходит под именем «{1}».',
  'The name «{0}» does not keep to the rules of the sea, so your guild is «{1}» now.': 'Имя «{0}» нарушает правила моря, поэтому теперь ваша гильдия зовётся «{1}».',
  'Names: nothing the filter refuses.': 'Имена: фильтр ничего не нашёл.',
  'Names: nothing to fix.': 'Имена: исправлять нечего.',
  'Usage: /names scan · /names fix <id|all>': 'Как писать: /names scan · /names fix <id|all>',
};
