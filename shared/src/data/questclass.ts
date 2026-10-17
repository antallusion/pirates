// One taxonomy of quests for every screen (owner, 2026-10-17: «беру задание, например сети мики … открываю "цели и
// вести" в море и у меня сети мики числится как побочное»). The port's «Задания» put everything that was not a board's
// job under «Сюжет» (paths, legends, the regions' arcs and the side chains alike), «Цели и вести» set the side chains
// (`side_…`) apart as «Побочное», and the journal called them all «Сюжет» — three screens, three rules. Now one:
//
//   campaign — the main campaign's quests (shared/src/data/campaign, `kind: 'campaign'`): «Кампания»;
//   side     — the side chains (`side_…`), the regions' arcs (`a_…`), the Paths, the Legends, the First Descent and the
//              Last Leaf — stories of their own, beside the campaign: «Побочное»;
//   job      — the boards' jobs, the islands' people's, the day's group contract, the Admiralty's: «Поручение»;
//   daily    — the day's orders (not quests: dailies.ts), «На день».
//
// The port's switches, the journal's rows and «Цели и вести» all read the class and its word from here
// (client/src/ui/questclass.ts).

export type QuestKind = 'path' | 'legend' | 'story' | 'job' | 'campaign';
export type QuestClass = 'campaign' | 'side' | 'job';
export const QUEST_CLASSES: readonly QuestClass[] = ['campaign', 'side', 'job'];

/** The class of a quest, by its kind (and nothing else: the id's prefix is the kind's business, not the screen's). */
export function questClass(q: { kind: QuestKind | string }): QuestClass {
  if (q.kind === 'campaign') return 'campaign';
  if (q.kind === 'job') return 'job';
  return 'side';
}

/** A quest of the main campaign's id: `c<chapter>_<n>` (and `…b`, a branch's second way). */
export const isCampaignId = (id: string): boolean => /^c\d{2}_\d{2}b?$/.test(id);
