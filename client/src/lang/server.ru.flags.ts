// The server's lines of docs/24 C1, D1–D3 (owner, 2026-10-07), English → Russian: a captain's colours (neutral, her
// city's or guild's, the pirate flag), «Абордаж: выкл», and the tester's /flag and /noboard.

export const SERVER_RU_FLAGS: Record<string, string> = {
  // Who may attack whom.
  'You sail under neutral colours: you fire on no captain and board none. Change them in port.': 'Вы под нейтральным флагом: не стреляете по капитанам и не берёте их на абордаж. Сменить флаг можно в порту.',
  'She sails under neutral colours: no captain may fire on her or board her.': 'Она под нейтральным флагом: ни один капитан не может стрелять по ней или брать её на абордаж.',
  'Her city is at peace with yours: hoist the pirate flag in port to attack her.': 'Её город не враждует с вашим: чтобы напасть, поднимите в порту пиратский флаг.',
  'Its captain sails under neutral colours.': 'Его капитан ходит под нейтральным флагом.',
  '{0} sails under neutral colours and may take no goods from other captains': '{0} под нейтральным флагом и не может брать товары у других капитанов',
  // Boarding off.
  'Boarding is off on your ship: guns only. Turn it on in port.': 'На вашем корабле абордаж выключен: только ядра. Включить можно в порту.',
  'Boarding is off on her ship: guns only, until one of you sinks.': 'На её корабле абордаж выключен: только ядра, пока кто-то не пойдёт ко дну.',
  'Boarding is turned on or off only in port.': 'Абордаж включается и выключается только в порту.',
  'Boarding is off: your ship boards nobody and nobody boards her. Guns only.': 'Абордаж выключен: вы никого не берёте на абордаж, и вас никто. Только ядра.',
  'Boarding is on again.': 'Абордаж снова включён.',
  // The colours in port.
  'Colours are changed only in port.': 'Флаг меняют только в порту.',
  'No such colours': 'Такого флага нет',
  'The harbour master will not register neutral colours for a captain the law wants.': 'Начальник порта не запишет нейтральный флаг капитану, которого ищет закон.',
  'The order for new colours is struck: yours stay.': 'Заказ на новый флаг отменён: остаётся прежний.',
  'Neutral colours go up in {0} min, if you are still in port.': 'Нейтральный флаг поднимут через {0} мин, если вы ещё будете в порту.',
  'The pirate flag goes up in {0} min, if you are still in port.': 'Пиратский флаг поднимут через {0} мин, если вы ещё будете в порту.',
  'Your city’s colours go up in {0} min, if you are still in port.': 'Флаг вашего города поднимут через {0} мин, если вы ещё будете в порту.',
  'Neutral colours are up.': 'Поднят нейтральный флаг.',
  'Your city’s colours are up.': 'Поднят флаг вашего города.',
  'The pirate flag is up.': 'Поднят пиратский флаг.',
  'You sailed before your new colours went up: the order is struck.': 'Вы вышли в море раньше, чем подняли новый флаг: заказ отменён.',
  'The law wants you: your neutral colours are struck, and your city’s go up.': 'Вас ищет закон: нейтральный флаг спущен, поднят флаг вашего города.',
  // The tester's console.
  'Colours: {0} of {1}; {2}; {3}.': 'Флаг: {0} ({1}); {2}; {3}.',
  'Colours: {0} of {1}.': 'Флаг: {0} ({1}).',
  'neutral colours': 'нейтральный',
  'the city flag': 'города или гильдии',
  'the pirate flag': 'пиратский',
  'ordered {0}': 'заказан {0}',
  'nothing ordered': 'ничего не заказано',
  'boarding off': 'абордаж выключен',
  'boarding on': 'абордаж включён',
  'Usage: /flag [neutral|faction|pirate] [city]': 'Использование: /flag [neutral|faction|pirate] [город]',
  'Usage: /noboard on|off': 'Использование: /noboard on|off',
  'Boarding off: guns only.': 'Абордаж выключен: только ядра.',
  'Boarding on.': 'Абордаж включён.',
};
