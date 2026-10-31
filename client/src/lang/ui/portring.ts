// The harbour's ring (forum 40, approved by the owner: «Добавить на порты такое же радиальное меню как на пирате с
// разделами «Войти в порт», «Приблизиться», у порта с личным островом ещё «Мой остров»»; client/src/ui/portring.ts).

export const EN = {
  enter: 'Enter port',
  enterT: 'Sail there and put in: {port}',
  near: 'Approach',
  nearT: 'Sail into the roads off {port} and heave to',
  card: 'Port card',
  cardT: 'What {port} sells and buys, its services and news',
  isle: 'My island',
  isleT: 'Your island by {port}: its buildings',
  aria: 'Harbour: {port}',
};

export const RU: Record<keyof typeof EN, string> = {
  enter: 'Войти в порт',
  enterT: 'Доплыть и зайти в порт: {port}',
  near: 'Приблизиться',
  nearT: 'Подойти на рейд к порту {port} и лечь в дрейф',
  card: 'Карточка порта',
  cardT: 'Цены, услуги и новости порта {port}',
  isle: 'Мой остров',
  isleT: 'Ваш остров у порта {port}: постройки',
  aria: 'Порт: {port}',
};
