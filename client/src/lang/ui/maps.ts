// Words of the treasure map cards (client/src/ui/maps.ts).

export const EN = {
  'spot': 'the very spot',
  'search': 'search {r} m',
  'sealed': "Brokers' seal",
  'genuine': 'appraised genuine',
  'forgery': 'appraised a forgery',
  'copy': 'a copy',
  'needle': 'the needle pulls {dir}',
  'pt.N': 'N',
  'pt.NE': 'NE',
  'pt.E': 'E',
  'pt.SE': 'SE',
  'pt.S': 'S',
  'pt.SW': 'SW',
  'pt.W': 'W',
  'pt.NW': 'NW',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  'spot': 'точное место',
  'search': 'искать в {r} м',
  'sealed': 'Печать маклеров',
  'genuine': 'оценена как подлинная',
  'forgery': 'оценена как подделка',
  'copy': 'список',
  'needle': 'стрелка тянет на {dir}',
  'pt.N': 'норд',
  'pt.NE': 'норд-ост',
  'pt.E': 'ост',
  'pt.SE': 'зюйд-ост',
  'pt.S': 'зюйд',
  'pt.SW': 'зюйд-вест',
  'pt.W': 'вест',
  'pt.NW': 'норд-вест',
};
