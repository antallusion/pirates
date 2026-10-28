// The thank-you gift of 2026-10-28 (owner: «для всех кто зарегистрировался дай на почту 33333 серебра и 10 мушкетеров
// всем, но без возможности их восстановления»): one letter to every captain there was that day — 33 333 silver and a
// stack of 10 musketeers marked as a gift (army.ts `g`: it fights, trains and splits, but its losses are never made
// good). Sent once (server/src/game/gift28.ts); the words in both tongues here.

import type { UnitId } from './army.ts';

export const GIFT28_ID = 'gift:2026-10-28';
export const GIFT28_SILVER = 33_333;
export const GIFT28_UNIT: UnitId = 'musketeer';
export const GIFT28_N = 10;
export const GIFT28_FROM = 'The GRAVETIDE crew';

export const GIFT28_WORDS = {
  en: {
    from: GIFT28_FROM,
    subject: 'A bonus from the GRAVETIDE crew',
    body: 'Thank you for playing and for helping the game grow! Here is a bonus from us: 33,333 silver and a company of 10 musketeers. Collect this letter in any port. If there is no room aboard, dismiss someone in the Crew window to take the musketeers.',
  },
  ru: {
    from: 'Команда GRAVETIDE',
    subject: 'Бонус от команды GRAVETIDE',
    body: 'Спасибо, что играете и помогаете развивать проект! Вам бонус от нас: 33 333 серебра и отряд из 10 мушкетёров. Заберите письмо в любом порту. Если на корабле нет места — увольте кого-нибудь в окне «Команда», чтобы взять мушкетёров.',
  },
} as const;

/** The refusal when the musketeers find no room (a slot and ten hammocks), and its Russian (client/src/lang/server.ts). */
export const GIFT28_NO_ROOM = 'No room aboard: dismiss someone in the Crew window to take the musketeers.';

/** Room for the gift's stack: a free slot and a hammock for each of them. */
export const giftRoom = (stacks: number, slots: number, crew: number, crewMax: number, n = GIFT28_N): boolean => stacks < slots && crewMax - crew >= n;

export function giftPatterns(): [string, string][] {
  const { en, ru } = GIFT28_WORDS;
  return [
    [en.from, ru.from],
    [en.subject, ru.subject],
    [en.body, ru.body],
    [GIFT28_NO_ROOM, 'Нет места на корабле — увольте кого-нибудь, чтобы забрать мушкетёров.'],
    ['Collected {0} silver from the letter.', 'Из письма получено серебра: {0}.'],
    ['New men aboard from the letter: {0}, a stack of their own.', 'Из письма на борт пришли бойцы: {0}, отдельным отрядом.'],
    ['Gift letters sent: {0}.', 'Подарочных писем отправлено: {0}.'],
    ['Gift letters sent so far: {0}.', 'Подарочных писем отправлено всего: {0}.'],
    ['The gift letter has not gone out yet.', 'Подарочное письмо ещё не отправлялось.'],
    ['Gift dry run: {0} captains would get the letter; {1} of them have no room for the musketeers now.', 'Проверка подарка: письмо получат капитанов — {0}; из них сейчас нет места для мушкетёров у {1}.'],
  ];
}
