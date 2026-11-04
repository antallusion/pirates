// Forum, Нефигугум 2026-10-30 (post 26): «Причал», the escorts' repair (server shipbuilding.ts, fleet.ts), English → Russian.

export const SERVER_RU_BERTH: Record<string, string> = {
  'She is berthed at your island: take her out at its yard': 'Этот корабль стоит у вашего острова: забрать его можно на верфи острова',
  'No yard here: change ships at a harbour with a shipyard': 'Здесь нет верфи: пересесть можно в порту с верфью',
  'Her hold takes {0}: sell or store {1} more in the warehouse first': 'Его трюм вмещает {0}: сначала продайте или сложите на склад ещё {1}',
  '{0} berths at most': 'Мест на причале не больше {0}',
  'A berth costs {0} doubloons': 'Место на причале стоит {0} дублонов',
  'A new berth is yours: {0} in all.': 'Новое место на причале ваше: всего {0}.',
  'Your escorts are sound': 'Сопровождение цело',
  // forum 40: «Пересесть» takes two minutes — the ship sent for sails round to her
  'The {0} is warped round from her berth: she comes alongside in {1} min, if you are still in port.': 'Корабль «{0}» подводят от причала: будет у борта через {1} мин, если вы останетесь в порту.',
  'The {0} sails to you from {1}: she comes in {2} min, if you are still in port.': 'Корабль «{0}» плывёт к вам с места стоянки ({1}): прибудет через {2} мин, если вы останетесь в порту.',
  'The {0} goes back to her berth.': 'Корабль «{0}» возвращается на место стоянки.',
  'You sailed before the {0} came: she goes back to her berth.': 'Вы вышли в море раньше, чем пришёл «{0}»: корабль вернулся на место стоянки.',
  'The {0} came, but you cannot change into her now: she goes back to her berth.': 'Корабль «{0}» пришёл, но пересесть на него сейчас нельзя: он возвращается на место стоянки.',
  '{0} of your men will not fit her: send for her again.': 'Людей больше, чем гамаков на нём ({0} лишних): вызовите корабль снова.',
  // forum 40: a bump between ships at peace costs her own hull (server bump.ts)
  'Bumped the {0} −{1}': 'Столкновение с «{0}» −{1}',
  'She is on her way to you: call her off first': 'Этот корабль уже плывёт к вам: сначала отмените вызов',
  // forum, Эдуард, post 70: a berthed ship lies in her port — changed into only there, or brought round («Перегнать сюда»)
  'The {0} lies at {1}: change into her there, or have her brought here.': '«{0}» стоит в порту {1}: пересесть можно только там — или перегоните его сюда.',
  'The {0} is on her way to {1}: change into her when she comes in.': '«{0}» идёт в {1}: пересесть можно, когда он придёт.',
  'The {0} is already on her way to {1}.': '«{0}» уже идёт в {1}.',
  'She already lies here.': 'Этот корабль уже стоит здесь.',
  'No delivery crew sails from there.': 'Оттуда перегонную команду не отправить.',
  'A delivery crew sails the {0} from {1}: she comes into the berth here in {2} min ({3} silver).': 'Перегонная команда ведёт «{0}» из порта {1}: он встанет у здешнего причала через {2} мин ({3} серебра).',
  'The {0} has come into {1}: she lies at the berth there.': '«{0}» пришёл в {1} и стоит там у причала.',
  // forum, Эдуард, post 72: nobody is paid off — the men stay aboard the old ship, or wait ashore
  '{0} men stay aboard the {1} at the berth: they come back aboard when you change into her again.': '{0} чел. остались на борту «{1}» у причала: вернутся к вам, когда снова пересядете на него.',
  '{0} of your men aboard her go ashore here: they wait in the tavern {1} days.': '{0} ваших людей с этого корабля сошли на берег здесь: ждут в таверне {1} дн.',
  '{0} of your men go ashore here: they wait in the tavern {1} days and sign on again free when there is room.': '{0} ваших людей сошли на берег здесь: ждут в таверне {1} дн. и вернутся на борт бесплатно, когда будут свободные койки.',
  'None of your men wait ashore here.': 'Здесь на берегу ваших людей нет.',
  'No hammocks free aboard: they wait ashore until there is room.': 'На борту нет свободных коек: люди подождут на берегу, пока не освободится место.',
  '{0} of your men come back aboard.': 'На борт вернулись ваши люди: {0} чел.',
  // forum, Эдуард, post 70: a rank in the service put back
  'The Admiralty restores your rank: {0}.': 'Звание на службе восстановлено: {0}.',
};
