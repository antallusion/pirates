// The reach of every hand-to-hand thing at sea on the action bar (owner, 2026-10-22: thirty metres, boarding alongside
// only — shared/src/data/reach.ts): what is left when she is close but not yet there.

export const EN = {
  near: '{what}: {m} m to go',
  abeam: 'Boarding {name}: come alongside — side by side, not astern or bow on',
  speed: 'Boarding {name}: match her speed',
  closer: 'Boarding {name}: come closer — {m} m',
  approach: 'Grapples on {name}: coming alongside… {s} s',
  attackFar: 'Attack: {m} m to her guns’ reach',
  board: 'Board',
  dock: 'Dock',
  moor: 'Moor at the waystation',
  stack: 'Attack the creatures',
  find: 'Boats away',
  mark: 'Boats to the mark',
  home: 'Your island',
};

export const RU: Record<keyof typeof EN, string> = {
  near: '{what}: ещё {m} м',
  abeam: 'Абордаж «{name}»: встаньте борт к борту — не с кормы и не носом',
  speed: 'Абордаж «{name}»: уравняйте с ней скорость',
  closer: 'Абордаж «{name}»: подойдите ближе — {m} м',
  approach: 'Кошки на «{name}»: сближаемся… {s} с',
  attackFar: 'Атака: ещё {m} м до дальности пушек',
  board: 'На абордаж',
  dock: 'Причалить',
  moor: 'К плавучему дому',
  stack: 'Атаковать существ',
  find: 'Шлюпки на воду',
  mark: 'Шлюпки к знаку',
  home: 'Ваш остров',
};
