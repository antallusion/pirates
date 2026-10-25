// The captain's abilities on a touch screen (owner, 2026-10-26: «на мобиле не показаны иконки спецприёмов капитана,
// как сделано на десктопе, надо показывать как-то»): the round «Приёмы» button and the row it fans out (ui/seaabil.ts).

export const EN = {
  'btn': 'Abilities',
  'btnReady': 'Abilities: {n} ready',
  'fan': "The captain's abilities",
  'use': '{name}: tap to use, hold for details',
  'cd': 'Cooldown {n} s',
  'left': 'Ready in {n} s',
  'ready': 'Ready',
  'lv6': 'Opens at level 6',
  'resolve': 'Needs full resolve ({n}%)',
  'dread': 'Needs {n} Dread',
  'gold': 'Costs {n} silver',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  'btn': 'Приёмы',
  'btnReady': 'Приёмы: готово {n}',
  'fan': 'Приёмы капитана',
  'use': '{name}: тап — применить, удержание — описание',
  'cd': 'Перезарядка {n} с',
  'left': 'Готов через {n} с',
  'ready': 'Готов',
  'lv6': 'Откроется на 6-м уровне',
  'resolve': 'Нужна полная решимость ({n}%)',
  'dread': 'Нужно {n} Трепета',
  'gold': 'Стоит {n} серебра',
};
