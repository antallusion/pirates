// The forum's shared tables (docs/32_FORUM.md): ranks, reactions, the captains' classes, page sizes and limits.
// Used by the server (server/src/forum) and the page (client/src/forum). Words for people live in client/src/lang/forum.ts.

export const TOPICS_PER_PAGE = 20;
export const POSTS_PER_PAGE = 15;
export const LIST_PER_PAGE = 30;

export const TITLE_MIN = 4;
export const TITLE_MAX = 100;
export const POST_MAX = 20_000;
export const MESSAGE_MAX = 4_000;
export const REPORT_MAX = 500;

export const IMAGE_MAX = 3 * 1024 * 1024;
export const VIDEO_MAX = 25 * 1024 * 1024;

/** The six reactions, in the order of the buttons. */
export const REACTIONS = ['like', 'heart', 'laugh', 'fire', 'think', 'dislike'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const REACTION_EMOJI: Record<Reaction, string> = { like: '👍', heart: '❤️', laugh: '😂', fire: '🔥', think: '🤔', dislike: '👎' };

export type Role = 'user' | 'moderator' | 'admin' | 'banned';
export const ROLES: Role[] = ['user', 'moderator', 'admin', 'banned'];
export const isStaff = (r: Role | null | undefined): boolean => r === 'moderator' || r === 'admin';

export const CLASSES = ['corsair', 'reaver', 'smuggler', 'navigator', 'drowned', 'admiral'] as const;
export type CaptainClass = (typeof CLASSES)[number];

/** Eight pirate ranks by the forum score (posts + twice the reputation): r1 … r8 badges in site/img/rank. */
export const RANK_SCORE = [0, 10, 40, 100, 250, 500, 1000, 2500];
export function rankOf(posts: number, rep: number): number {
  const score = Math.max(0, posts) + 2 * Math.max(0, rep);
  let r = 0;
  for (let i = 0; i < RANK_SCORE.length; i++) if (score >= RANK_SCORE[i]) r = i;
  return r;
}

/** A medal of the game's deeds by the deed's path (site/img/medal). */
export const DEED_MEDAL: Record<string, string> = {
  combat: 'cannon', trade: 'coins', smuggling: 'flag', factions: 'crown', exploration: 'chart', monsters: 'kraken', abyss: 'storm',
  survival: 'wave', crew: 'cutlass', command: 'compass', shipwright: 'ship', law: 'lighthouse', story: 'chest',
};

/** The forum's own medals: the id, its picture and when it is earned. */
export const FORUM_MEDALS: { id: string; icon: string; ok: (s: { posts: number; topics: number; rep: number; official: number }) => boolean }[] = [
  { id: 'first_post', icon: 'bell', ok: (s) => s.posts >= 1 },
  { id: 'posts_100', icon: 'pearl', ok: (s) => s.posts >= 100 },
  { id: 'topics_10', icon: 'island', ok: (s) => s.topics >= 10 },
  { id: 'rep_25', icon: 'crown', ok: (s) => s.rep >= 25 },
  { id: 'official', icon: 'flag', ok: (s) => s.official >= 1 },
];

/** A topic is «hot» with this many replies, or views. */
export const HOT_REPLIES = 25;
export const HOT_VIEWS = 500;

/** The forum's error codes (the page words them: client/src/lang/forum.ts `err.*`). */
export type ForumErrorCode =
  | 'auth' | 'banned' | 'forbidden' | 'not_found' | 'locked' | 'rate' | 'trap' | 'links' | 'title' | 'body' | 'too_large' | 'bad_file'
  | 'self' | 'bad_request' | 'no_user';
