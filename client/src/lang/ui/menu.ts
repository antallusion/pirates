// The ship's menu (phones and the micro-menu): the screens a captain opens from the helm.

export const EN = {
  journal: 'Journal',
  title: "Captain's cabin",
  map: 'Chart',
  ship: 'Ship',
  crew: 'Crew',
  talents: 'Talents',
  hero: 'Captain',
  company: 'Company',
  help: 'Handbook',
  options: 'Options',
  chat: 'Chat',
  base: 'My Island',
  close: 'Back to the helm',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  journal: 'Журнал',
  title: 'Каюта капитана',
  map: 'Карта',
  ship: 'Корабль',
  crew: 'Экипаж',
  talents: 'Таланты',
  hero: 'Капитан',
  company: 'Компания',
  help: 'Справочник',
  options: 'Настройки',
  chat: 'Чат',
  base: 'Мой остров',
  close: 'К штурвалу',
};
