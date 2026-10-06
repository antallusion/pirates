// Words of the sea HUD on a phone (docs/23 phase 2: the sea and five buttons; client/src/ui/seahud.ts).

export const EN = {
  'fire': 'Fire',
  'fireAria': 'Fire: a broadside now. Hold for shots, abilities and talents',
  'act': 'Action',
  'actMore': 'Hold for {n} more',
  'special': 'Special: {name}',
  'menu': 'Menu',
  'news': 'Goals and news',
  'newsEmpty': 'Nothing new at sea.',
  'more': 'More',
  'wheelFire': 'Shots, abilities, talents',
  'wheelAct': 'What to do here',
  'cd': '{n} s',
  'lv6': 'Lv 6',
  'stick': 'Helm: pull to steer, farther for more sail; hold the middle to take sail in; double-tap to dash',
  'reefed': 'Sails taken in',
  'target': 'Target',
};

export const RU: Record<keyof typeof EN, string> = {
  'fire': 'Огонь',
  'fireAria': 'Огонь: залп сейчас. Удерживать — снаряды, умения, таланты',
  'act': 'Действие',
  'actMore': 'Удерживать — ещё {n}',
  'special': 'Особое: {name}',
  'menu': 'Меню',
  'news': 'Цели и вести',
  'newsEmpty': 'На море ничего нового.',
  'more': 'Ещё',
  'wheelFire': 'Снаряды, умения, таланты',
  'wheelAct': 'Что можно сделать',
  'cd': '{n} с',
  'lv6': 'Ур. 6',
  'stick': 'Штурвал: тяните, куда плыть, дальше от центра — больше парусов; удержать центр — убрать паруса; двойной тап — рывок',
  'reefed': 'Паруса убраны',
  'target': 'Цель',
};
