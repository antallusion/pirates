// The words of the great ones ashore on the battle's screen (owner, 2026-10-03; server/src/game/shorebosses.ts): their
// moves in the battle's line, the warned ground, what one beaten leaves. Their names and their moves' names are in
// shared/src/data/shorebosses.ts in both languages.

export const EN = {
  'log.boss': '{move}: {who}',
  'log.bossAlone': '{move}!',
  'hint.warn': 'The glowing hexes are where the great one falls as the next round opens — step off them.',
  'loot.trophy': 'A trophy: {t}',
  'loot.first': 'The first on all the seas to beat it!',
  'loot.title': 'Spoils of the great one',
  'why.won': 'The great one has fallen and its kin scatter.',
  'why.retreat': 'The party falls back to the boats.',
  'why.lost': 'The great one throws your party back into the surf.',
};

export const RU: typeof EN = {
  'log.boss': '{move}: {who}',
  'log.bossAlone': '{move}!',
  'hint.warn': 'Светящиеся гексы — туда ударит исполин в начале следующего раунда: уйдите с них.',
  'loot.trophy': 'Трофей: {t}',
  'loot.first': 'Первая победа над ним на всех морях!',
  'loot.title': 'Добыча с исполина',
  'why.won': 'Исполин пал, и его свита разбегается.',
  'why.retreat': 'Отряд отходит к шлюпкам.',
  'why.lost': 'Исполин отбрасывает ваш отряд в прибой.',
};
