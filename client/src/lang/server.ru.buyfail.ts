// Honest refusals of a purchase, with their numbers (owner, 2026-10-21: «тут ошибка в том, что либо в порту это не
// продается, либо купить невозможно из-за того, что нет места — одно из двух. похожих ошибок во всей игре быть не
// должно»; shared/src/data/buyfail.ts, server/src/game/buyfail.ts), English → Russian.

export const SERVER_RU_BUYFAIL: Record<string, string> = {
  // the purse: what is missing
  'Not enough silver: {0} more needed': 'Не хватает серебра: нужно ещё {0}',
  'Not enough doubloons: {0} more needed': 'Не хватает дублонов: нужно ещё {0}',
  'Not enough doubloons: {0} more needed — top up your account first.': 'Не хватает дублонов: нужно ещё {0} — сначала пополните счёт.',
  // the room
  'No room in the hold: {0} m³ needed, {1} free': 'Нет места в трюме: нужно {0} м³, свободно {1}',
  'Not enough to sell here to make room: {0} of {1} m³': 'Здесь не продать столько, чтобы освободить место: {0} из {1} м³',
  'The warehouse is full: {0} m³ needed, {1} free': 'Склад полон: нужно {0} м³, свободно {1}',
  'The store is full: {0} m³ needed, {1} free': 'Хранилище полно: нужно {0} м³, свободно {1}',
  'Make room in the hold: {0} {1} wait on the quay ({2} m³ needed, {3} free).': 'Освободите трюм: на причале ждут {1} × {0} (нужно {2} м³, свободно {3}).',
  // hammocks and slots
  'No hammocks left aboard: {0} of {1} taken': 'Свободных коек нет: занято {0} из {1}',
  'Hammocks for {0} more only, {1} wanted': 'Свободных коек только {0}, а нужно {1}',
  'No hammocks aboard for {0} more: {1} free.': 'На борту не хватает коек: нужно ещё {0}, свободно {1}.',
  'No free slot in the army for a new kind of man: {0} of {1} taken — merge or dismiss a stack': 'В армии нет места для нового рода войск: занято {0} из {1} — объедините или распустите отряд',
  'Your ship has berths for {0} officer: pay one off to sign another': 'На корабле место для {0} офицера: рассчитайте одного, чтобы нанять другого',
  'Your ship has berths for {0} officers: pay one off to sign another': 'На корабле места для {0} офицеров: рассчитайте одного, чтобы нанять другого',
  // not sold here, the stock
  '{0} does not sell {1}': '{0}: здесь не продают товар «{1}»',
  '{0} does not sell {1}: sold at {2}': '{0}: здесь не продают товар «{1}». Есть в портах: {2}',
  'Contraband cannot be traded here: sold at {0}': 'Здесь не торгуют контрабандой. Есть в портах: {0}',
  '{0} has no {1} left': '{0}: товар «{1}» распродан',
  '{0} has only {1} {2}, {3} asked': '{0}: товара «{2}» осталось только {1}, а нужно {3}',
  'Nobody here sells {0}': 'Здесь не продают: {0}',
  'Nobody here sells {0}: sold at {1}': 'Здесь не продают: {0}. Есть в портах: {1}',
};
