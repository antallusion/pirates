// Words of a group's boarding on the sea (docs/25 block Е; client/src/ui/boardoffer.ts): a mate of the group boards
// within reach, and she may come aboard with one or two stacks of her own.

export const EN = {
  'title': '{mate} boards the {foe}',
  'titleDef': '{foe} boards {mate}',
  'sub': 'Bring {n} of your stacks; you play them and give your own orders. Up to round {last}.',
  'sub1': 'Bring one of your stacks; you play it and give your own orders. Up to round {last}.',
  'round': 'Round {n} under way: you come aboard as the next opens.',
  'join': 'Come aboard',
  'no': 'Not now',
  'auto': 'Come at once next time',
  'pick': 'Your stack: tap to bring it or leave it',
};

export const RU: Record<keyof typeof EN, string> = {
  'title': '{mate}: абордаж — «{foe}»',
  'titleDef': '«{foe}» берёт на абордаж: {mate}',
  'sub': 'Возьмите {n} своих отряда: ведёте их сами и отдаёте свои приказы. Вступить можно до {last}-го раунда.',
  'sub1': 'Возьмите один свой отряд: ведёте его сами и отдаёте свои приказы. Вступить можно до {last}-го раунда.',
  'round': 'Идёт {n}-й раунд: вы вступите в начале следующего.',
  'join': 'На абордаж',
  'no': 'Не сейчас',
  'auto': 'В следующий раз — сразу',
  'pick': 'Ваш отряд: коснитесь, чтобы взять или оставить',
};
