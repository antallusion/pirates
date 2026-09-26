// The captain selection screen.

export const EN = {
  premium: 'PREMIUM · SIDE-GRADE',
  favoured: 'Favoured trees: {list}.',
  passive: 'Passive — {name}',
  cooldown: '{n}s',
  starts: 'Starts with a {ship} ({gun}s), {crew} crew, {gold} silver, in Saltmarrow on the Black Coast.',
  shipName: 'Name your ship',
  takeCommand: 'Take command',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  premium: 'ПРЕМИУМ · РАВНОЦЕННАЯ ЗАМЕНА',
  favoured: 'Излюбленные ветви талантов: {list}.',
  passive: 'Врождённый дар — {name}',
  cooldown: '{n} с',
  starts: 'Начинает на судне класса «{ship}» ({gun}), экипаж {crew}, {gold} серебра, в Солтмарроу на Чёрном берегу.',
  shipName: 'Наречь корабль',
  takeCommand: 'Принять командование',
};
