// Titles for the work done (docs/11 P6), as WoW's achievement titles: quests finished, group contracts won and
// captains guided each earn a title to wear before one's name (chosen in the Legends tab).

export type TitleCount = 'quests' | 'contracts' | 'mentored';

export const QUEST_TITLES: { count: TitleCount; n: number; title: [string, string] }[] = [
  { count: 'quests', n: 10, title: ['Hand for Hire', 'Рука по найму'] },
  { count: 'quests', n: 50, title: ['Friend of the Quays', 'Друг причалов'] },
  { count: 'quests', n: 150, title: ['Pride of the Notice Boards', 'Гордость досок объявлений'] },
  { count: 'quests', n: 400, title: ['Legend of the Harbour Offices', 'Легенда портовых контор'] },
  { count: 'contracts', n: 5, title: ['Flagship Breaker', 'Гроза флагманов'] },
  { count: 'contracts', n: 25, title: ['Scourge of the Raiders', 'Бич налётчиков'] },
  { count: 'mentored', n: 10, title: ['Teacher of the Young', 'Учитель молодых'] },
  { count: 'mentored', n: 50, title: ['Old Salt of the Fleet', 'Старая соль флота'] },
];

/** The titles earned at these counts that are not yet held. */
export function titlesDue(counts: Record<TitleCount, number>, held: string[]): string[] {
  return QUEST_TITLES.filter((t) => counts[t.count] >= t.n && !held.includes(t.title[0])).map((t) => t.title[0]);
}

/** The server's lines about them, English → Russian. */
export function questTitlePatterns(): [string, string][] {
  return [...QUEST_TITLES.map((t) => t.title), ['A new title to wear before your name: “{0}” (the Legends tab).', 'Новое звание перед вашим именем: «{0}» (вкладка «Легенды»).']];
}
