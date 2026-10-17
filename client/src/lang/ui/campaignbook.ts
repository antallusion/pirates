// The journal's «Кампания» page (docs/36, client/src/ui/campaignbook.ts).

export const EN = {
  tab: 'Campaign',
  tabHint: 'The main campaign: its chapters, where you stand, what lies ahead',
  head: 'The campaign: {n} of {of} quests',
  from: 'Begun for you at chapter {n}: the chapters before it stand as done.',
  chapter: 'Chapter {n}',
  levels: 'levels {a}–{b}',
  level: 'level {n}',
  quests: '{n} of {of}',
  loading: 'Opening the book…',
  done: 'The campaign is done: the tide sleeps.',
  way: 'your way: {w}',
  where: 'Chapter {ch} · quest {n} of {of}',
  nextAt: 'the next from level {n}',
  newQuest: 'A new campaign quest: {name}',
  fork: 'The campaign: choose your way',
  choose: 'Choose',
};

export const RU: Record<keyof typeof EN, string> = {
  tab: 'Кампания',
  tabHint: 'Главная кампания: её главы, где вы сейчас и что впереди',
  head: 'Кампания: пройдено {n} из {of}',
  from: 'Для вас она началась с главы {n}: главы до неё отмечены пройденными.',
  chapter: 'Глава {n}',
  levels: 'ур. {a}–{b}',
  level: 'ур. {n}',
  quests: '{n} из {of}',
  loading: 'Открываем книгу…',
  done: 'Кампания пройдена: прилив спит.',
  way: 'ваш путь: {w}',
  where: 'Глава {ch} · задание {n} из {of}',
  nextAt: 'следующее с уровня {n}',
  newQuest: 'Новое задание кампании: {name}',
  fork: 'Кампания: выберите путь',
  choose: 'Выбрать',
};
