// Words of the diving bell panel (client/src/ui/dive.ts).

export const EN = {
  'surface': 'Surface',
  'steerHint': 'Shift+arrows steer the bell',
  'allySteers': 'Your ally steers the bell — guard the anchorage.',
  'title': 'The Bell — {site}',
  'status': '{tide} · drowned rise in {wave} s · {min} min left',
  'stats': 'Air {air}/{max} · divers {divers} · keys {keys} · {silver} silver',
  'room.entry': 'entry',
  'room.hall': 'hall',
  'room.relic': 'relic',
  'room.trap': 'trap',
  'room.guardian': 'guardian',
  'room.key': 'key',
  'room.vault': 'vault',
  'room.shrine': 'shrine',
  'room.?': 'unexplored',
} as const;

export const RU: Record<keyof typeof EN, string> = {
  'surface': 'Всплыть',
  'steerHint': 'Shift+стрелки ведут колокол',
  'allySteers': 'Колоколом правит союзник — стерегите якорную стоянку.',
  'title': 'Колокол — {site}',
  'status': '{tide} · утопленники поднимутся через {wave} с · осталось {min} мин',
  'stats': 'Воздух {air}/{max} · водолазы {divers} · ключи {keys} · серебро {silver}',
  'room.entry': 'вход',
  'room.hall': 'зал',
  'room.relic': 'реликвия',
  'room.trap': 'ловушка',
  'room.guardian': 'страж',
  'room.key': 'ключ',
  'room.vault': 'сокровищница',
  'room.shrine': 'святилище',
  'room.?': 'не исследовано',
};
