import type { GuideArticle } from './types.ts';

export const ARTICLES: GuideArticle[] = [
  {
    id: 'sea-sailing',
    section: 'sea',
    title: ['Sailing', 'Как ходить под парусом'],
    tags: ['sail', 'move', 'wind', 'парус', 'ход', 'плыть', 'ветер', 'движение'],
    summary: ['Tap the sea to set a course; the ship sails there on its own.', 'Коснитесь моря, чтобы задать курс: корабль сам пойдёт туда.'],
    slides: [
      { text: ['Tap any point of the sea: the ship turns and sails there.', 'Коснитесь любой точки моря: корабль развернётся и пойдёт туда.'] },
      { text: ['The chart shows the whole sea: open it to plan a long voyage.', 'Карта показывает всё море: откройте её, чтобы проложить дальний путь.'], show: { open: 'map' } },
    ],
    related: ['sea-ports'],
    window: 'map',
  },
  {
    id: 'sea-ports',
    section: 'sea',
    title: ['Ports', 'Порты'],
    tags: ['port', 'harbour', 'dock', 'порт', 'гавань', 'причал', 'торговля'],
    summary: ['A port repairs the ship, trades goods and hires crew.', 'В порту чинят корабль, торгуют и нанимают команду.'],
    slides: [
      { text: ['Sail close to a port and press «Enter port».', 'Подойдите к порту и нажмите «Войти в порт».'] },
      { text: ['Inside: the market, the shipyard, the tavern and the flag office.', 'Внутри: рынок, верфь, таверна и контора флагов.'] },
      { text: ['Crews are hired in the tavern.', 'Команду нанимают в таверне.'], show: { open: 'hire' } },
    ],
    related: ['sea-sailing'],
    window: 'port',
    firstTime: 'first-port',
  },
];
