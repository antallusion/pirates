// The captain selection screen.

export const EN = {
  premium: 'PREMIUM · SIDE-GRADE',
  // the card's badge on a phone, where six cards share the screen
  premiumShort: 'Premium',
  favoured: 'Favoured trees: {list}.',
  passive: 'Passive — {name}',
  cooldown: '{n}s',
  starts: 'Starts with a {ship} ({gun}s), {crew} crew, {gold} silver, in Saltmarrow on the Black Coast.',
  // the start in one line on a phone held sideways
  startsShort: 'Starts on a {ship} · {crew} crew · {gold} silver',
  shipName: 'Name your ship',
  takeCommand: 'Take command',
  // The ship's name offered in the field (a Russian captain met «Iron Verdict» in Latin at the head of every battle).
  'ship.corsair': 'Iron Verdict',
  'ship.smuggler': 'Quiet Ledger',
  'ship.reaver': 'Red Hook',
  'ship.navigator': 'Northern Wren',
  'ship.drowned': 'Saint Verity',
  'ship.admiral': 'Black Signal',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  premium: 'ПРЕМИУМ · РАВНОЦЕННАЯ ЗАМЕНА',
  premiumShort: 'Премиум',
  favoured: 'Излюбленные ветви талантов: {list}.',
  passive: 'Врождённый дар — {name}',
  cooldown: '{n} с',
  starts: 'Начинает на судне класса «{ship}» ({gun}), экипаж {crew}, {gold} серебра, в Солтмарроу на Чёрном берегу.',
  startsShort: 'Старт: «{ship}» · экипаж {crew} · {gold} серебра',
  shipName: 'Наречь корабль',
  takeCommand: 'Принять командование',
  'ship.corsair': 'Железный приговор',
  'ship.smuggler': 'Тихая книга',
  'ship.reaver': 'Красный крюк',
  'ship.navigator': 'Северный крапивник',
  'ship.drowned': 'Святая Верность',
  'ship.admiral': 'Чёрный сигнал',
};
