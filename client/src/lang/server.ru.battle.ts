// The server's lines of the battles' isolation (owner, 2026-10-22: a captain in any battle, and a short while after it,
// is out of the sea's reach — server/src/game/inbattle.ts) and the round «Атаковать» (approach.ts), English → Russian.

export const SERVER_RU_BATTLE: Record<string, string> = {
  'She is in battle: nobody may touch her until it is over.': 'Она в бою: пока бой не кончен, её никто не тронет.',
  'Finish your battle first.': 'Сначала закончите свой бой.',
  'No foe in sight: mark a ship (tap her) to fire on her.': 'Врага не видно: отметьте корабль (тапните по нему), чтобы стрелять по нему.',
  // QA 2026-10-22: the spoils' card always answered; every refusal of «Причалить» told
  'The order lapsed: its moment passed. Try again.': 'Приказ не выполнен: момент упущен. Попробуйте ещё раз.',
  'Settle the spoils of your boarding first.': 'Сначала разделите добычу абордажа.',
  'Your quartermaster shared out the spoils of the boarding.': 'Квартирмейстер сам разделил добычу абордажа.',
  'A practice fight: no colours to strike. Fight it out — the crew will help.': 'Учебный бой: флаг спускать не нужно. Бейтесь — команда поможет.',
  // a stray ball of a newcomer's on a lawful ship beside her fight (QA 2026-10-22): forgiven, and said so
  'A stray ball struck a lawful ship: the harbour forgives a newcomer this once.': 'Шальное ядро задело мирное судно: новичку гавань это прощает.',
};
