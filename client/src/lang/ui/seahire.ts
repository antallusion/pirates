// Words of the hiring of a ship of the sea as a guard and of her chip (owner, 2026-10-25; client/src/ui/seahire.ts).

export const EN = {
  'hr.tm': 'Hire',
  'hr.tmT': 'Hire her as your guard for 10–20 minutes',
  'hr.title': 'Hire as a guard',
  'hr.ship': '{cls} · ⚓{lvl}',
  'hr.guns': '{n} guns',
  'hr.crew': '{n}/{max} men',
  'hr.hull': 'hull {n}/{max}',
  'hr.min': '{n} min',
  'hr.silver': 'Your silver: {n}',
  'hr.rules': 'She sails off your beam and answers whoever attacks you. She does not enter port: she waits off the harbour, the time runs on. Sunk or dismissed early: nothing is refunded.',
  'hr.close': 'Close',
  'hr.short': 'not enough silver',
  'hr.chipT': 'Your hired guard: time left, her hull. Tap to dismiss her.',
  'hr.wait': 'waits off the harbour',
  'hr.dismiss': 'Dismiss {name}? Nothing is refunded.',
  'hr.mapLabel': 'Guard · {t}',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  'hr.tm': 'Нанять',
  'hr.tmT': 'Нанять в охрану на 10–20 минут',
  'hr.title': 'Нанять в охрану',
  'hr.ship': '{cls} · ⚓{lvl}',
  'hr.guns': 'пушек: {n}',
  'hr.crew': 'людей: {n}/{max}',
  'hr.hull': 'корпус {n}/{max}',
  'hr.min': '{n} мин',
  'hr.silver': 'Ваше серебро: {n}',
  'hr.rules': 'Идёт у вашего борта и бьёт всех, кто нападёт на вас. В порт не заходит: ждёт у гавани, время идёт. Потоплен или отпущен раньше срока — плата не возвращается.',
  'hr.close': 'Закрыть',
  'hr.short': 'не хватает серебра',
  'hr.chipT': 'Ваша наёмная охрана: сколько осталось и корпус. Нажмите, чтобы отпустить.',
  'hr.wait': 'ждёт у гавани',
  'hr.dismiss': 'Отпустить: {name}? Плата не возвращается.',
  'hr.mapLabel': 'Охрана · {t}',
};
