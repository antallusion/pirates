// Words of the island's loot from the creatures of the islands (docs/29 §9, owner 2026-10-17): the battle's spoils and
// the lair card's «Возможная добыча» (client/src/ui/isleloot.ts).

export const EN = {
  head: 'For your island',
  maybe: 'Possible loot for your island',
  speed: 'Speed-up {m}',
  speedTip: 'Build speed-up: {m} into your store of speed-ups',
  speedAny: 'Speed-up {list}',
  res: '{g} {n}',
  resTip: 'Into your island’s yard',
  resAny: 'Goods for the yard ×{n}',
  prod: 'Harvest +{p}% · {h} h',
  prodTip: 'The island’s producers yield {p}% more for {h} hours',
  builder: 'Brigade · {h} h',
  builderTip: 'A hired builders’ brigade on your island for {h} hours',
  min: '{n} min',
  hour: '{n} h',
};

export const RU: Record<keyof typeof EN, string> = {
  head: 'Для острова',
  maybe: 'Возможная добыча для острова',
  speed: 'Ускоритель {m}',
  speedTip: 'Ускоритель стройки: {m} в запас ускорителей',
  speedAny: 'Ускоритель {list}',
  res: '{g} {n}',
  resTip: 'Во двор вашего острова',
  resAny: 'Товары во двор ×{n}',
  prod: 'Урожай +{p}% · {h} ч',
  prodTip: 'Промыслы острова дают на {p}% больше {h} ч',
  builder: 'Бригада · {h} ч',
  builderTip: 'Наёмная бригада строителей на острове на {h} ч',
  min: '{n} мин',
  hour: '{n} ч',
};
