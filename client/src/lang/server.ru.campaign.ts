// The main campaign's own lines (docs/36, server/src/game/campaign.ts), English → Russian. The campaign's quests
// themselves (titles, briefings, steps, completion lines) are patterns of shared/src/data/campaign/patterns.ts.

export const SERVER_RU_CAMPAIGN: Record<string, string> = {
  'Campaign, chapter {0}: {1}': 'Кампания, глава {0}: {1}',
  'Chapter {0} is done: {1}.': 'Глава {0} пройдена: «{1}».',
  'The campaign is done. The tide sleeps.': 'Кампания пройдена. Прилив спит.',
  'The next campaign quest waits for level {0}.': 'Следующее задание кампании ждёт {0}-го уровня.',
  'That is not the campaign’s quest now': 'Сейчас кампания ждёт другого задания',
  'The campaign’s quest is under way': 'Задание кампании уже взято',
  'The campaign is done': 'Кампания пройдена',
  'Level {0}': 'Уровень {0}',
  'A purse for the chapter: {0} silver.': 'Награда за главу: {0} серебра.',
  'Shot for the guns: the chapter’s stores are aboard.': 'Ядра для пушек: припасы главы погружены на борт.',
  'Galt has round shot carried aboard: your guns are fed.': 'Галт велел погрузить ядра: пушки снова заряжены.',
  'The campaign is walked alone': 'Кампанию проходят в одиночку',
  'Enemy sails close in: the campaign’s fight comes to you.': 'Вражеские паруса идут на сближение: бой кампании сам идёт к вам.',
  'The Brethren’s {0} puts to sea near you: sink that ship.': 'Капитан Братства {0} выходит в море рядом с вами: потопите этот корабль.',
  'Nobody here offers that': 'Здесь такого не предлагают',
  'The campaign’s quest is not set aside: it goes on by itself': 'Задание кампании не откладывается: она идёт сама',
  // owner, 2026-10-21: a step of buying or hiring already done, or one that cannot be (quests.ts stepMoot, skipGuideStep)
  'The crew is already full — the step is counted.': 'Экипаж уже полон — шаг засчитан.',
  'No room in the hold for provisions — the step is counted.': 'В трюме нет места для провизии — шаг засчитан.',
  'No room in the hold for sailcloth — the step is counted.': 'В трюме нет места для парусины — шаг засчитан.',
  'The hold is full — the step is counted.': 'Трюм полон — шаг засчитан.',
  // retention, 2026-10-25: the opening's lessons of the shops already satisfied
  'Sailcloth is aboard — the step is counted.': 'Парусина уже в трюме — шаг засчитан.',
  'A good to trade is aboard — the step is counted.': 'Товар на продажу уже в трюме — шаг засчитан.',
  'Every island of the sea is on your chart already — the step is counted.': 'Все острова моря уже на вашей карте — шаг засчитан.',
  'Only a lesson of the shops can be skipped': 'Пропустить можно только урок лавок',
  'A ship waits to take you to {0}: cast off, and she takes you there.': 'Вас ждёт корабль до порта {0}: выйдите в море, и он доставит вас туда.',
};
