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
};
