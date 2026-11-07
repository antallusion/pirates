// «Услуга контрабандиста» (forum, Эдуард, post 92): the question the harbour's refusal asks (client/src/ui/smuggler.ts).

export const EN = {
  'title': 'Smuggler’s passage',
  'patent': '{port} is shut to you: your patent is at war with its flag.',
  'standing': '{port} is shut to you: its flag holds you an enemy.',
  'ways': 'Ways in:',
  'wait': 'wait out the patent — {n} days;',
  'strike': 'strike its colours — the patent burns;',
  'mend': 'mend your standing with its flag;',
  'boat': 'or the smuggler: his boat puts you in by night — no customs, no harbour master.',
  'quest': 'A step of your quest waits here: the smugglers take a quest’s fare.',
  'trade': 'For plain trade the fare is dearer: a quest’s step here costs a third of it.',
  'keep': 'For {n} minutes after it the boat takes you in and out of this harbour again.',
  'yes': 'Land in secret · {price} silver',
  'no': 'Not now',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  'title': 'Услуга контрабандиста',
  'patent': 'Порт {port} закрыт для вас: ваш патент воюет с его флагом.',
  'standing': 'Порт {port} закрыт для вас: его флаг считает вас врагом.',
  'ways': 'Как попасть:',
  'wait': 'дождаться конца патента — дней: {n};',
  'strike': 'спустить его флаг — патент сгорит;',
  'mend': 'поправить отношения с этим флагом;',
  'boat': 'или контрабандист: его лодка тайно высадит вас ночью — без таможни и начальника порта.',
  'quest': 'Здесь вас ждёт шаг задания: контрабандисты берут за него меньше.',
  'trade': 'Для простой торговли дороже: за шаг задания здесь взяли бы втрое меньше.',
  'keep': 'Ещё {n} мин. после этого лодка возит вас в эту гавань и обратно.',
  'yes': 'Тайно высадиться · {price} серебра',
  'no': 'Не сейчас',
};
