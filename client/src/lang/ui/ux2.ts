// ux2 (owner, 2026-10-11): the course to a quest's place and the small automations — «после взятия квеста должна быть
// метка куда плыть, нажатие на эту метку корабль начинает плавание до места. вообще нужно максимум автоматизировать все».

export const EN = {
  'goal.set': 'Course to “{name}”: the helmsman has the wheel.',
  'goal.afterPort': 'Course to “{name}” is set: the helmsman takes her there as soon as she casts off.',
  'goal.arrived': 'At the place: “{name}”.',
  'goal.atPort': 'Off {port}: press «Dock» to put in.',
  'goal.noPlace': 'The next step has no place on the chart: {text}',
  'goal.none': 'Nowhere to sail: this step has no place on the chart.',
  'goal.auto': 'Off the quay: course to “{name}”. Touch the helm to take it back.',
  'goal.tracked': 'Marked on the sea: “{name}”. Tap the gold mark to sail there.',
  'goal.trackedSail': 'Marked on the sea: “{name}”. Tap “Sail” at the bottom to go there.',
  'goal.toppedUp': 'Topped up for the voyage: {cost} silver.',
  'opt.autoTopUp': 'Always top up',
  'opt.autoTopUpHint': 'Casting off, buy what the voyage lacks (food, repairs, shot, hands) without the window — only when the purse covers all of it',
  'opt.autoGoal': 'Course to the quest',
  'opt.autoGoalHint': 'Casting off, the helmsman takes her to the followed quest’s place; at a port she puts in by herself, at an island lands the party',
  'depart.always': 'Always top up',
  'depart.alwaysHint': 'Next time buy all of it by itself when the purse covers it (Settings)',
};

export const RU: Record<keyof typeof EN, string> = {
  'goal.set': 'Курс к цели «{name}»: штурвал у рулевого.',
  'goal.afterPort': 'Курс к цели «{name}» проложен: рулевой поведёт корабль, как только вы отчалите.',
  'goal.arrived': 'На месте: «{name}».',
  'goal.atPort': 'Вы у порта {port}: нажмите «Причалить».',
  'goal.noPlace': 'У следующего шага нет места на карте: {text}',
  'goal.none': 'Плыть некуда: у этого шага нет места на карте.',
  'goal.auto': 'Отчалили: курс к цели «{name}». Тронете штурвал — он снова ваш.',
  'goal.tracked': 'Метка на море: «{name}». Нажмите на золотую метку — и корабль поплывёт туда.',
  'goal.trackedSail': 'Метка на море: «{name}». Нажмите «Плыть» внизу — и корабль пойдёт туда.',
  'goal.toppedUp': 'Докуплено в дорогу: {cost} серебра.',
  'opt.autoTopUp': 'Всегда докупать',
  'opt.autoTopUpHint': 'При выходе из порта докупать нужное в рейс (еду, ремонт, ядра, людей) без окна — только когда хватает серебра на всё',
  'opt.autoGoal': 'Курс к заданию',
  'opt.autoGoalHint': 'При выходе из порта рулевой ведёт к месту отслеживаемого задания; в порту сам заходит, у острова высаживает десант',
  'depart.always': 'Всегда докупать',
  'depart.alwaysHint': 'В следующий раз покупать всё самим, если хватает серебра (Настройки)',
};
