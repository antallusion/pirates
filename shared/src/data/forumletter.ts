// The forum's answers by post (owner, 2026-10-29: «сделай так чтобы ответы личные на форуме отсылали письма людям, что
// мол вам ответили»): a member answered, quoted or mentioned on the forum gets a letter in her captain's port mailbox
// (server/src/game/forummail.ts), and an e-mail where she has a verified address. The letter goes in English and the
// client shows it in her language (client/src/lang/server.ts takes forumLetterPatterns); the e-mail is written in hers.

export type ForumLetterKind = 'reply' | 'quote' | 'mention';
export type ForumLetterLang = 'en' | 'ru';

export interface ForumNote {
  kind: ForumLetterKind;
  /** Who wrote it (her forum name). */
  from: string;
  topic: number;
  /** The topic's title. */
  title: string;
  post: number;
  /** The first ~120 characters of the post, in one line. */
  excerpt: string;
}

export const FORUM_LETTER_FROM: [string, string] = ['The Forum', 'Форум'];
export const FORUM_LETTER_SUBJECT: [string, string] = ['You have a reply on the forum', 'Вам ответили на форуме'];
/** The post's excerpt: at most this many characters. */
export const FORUM_EXCERPT = 120;

const LEAD: Record<ForumLetterKind, [string, string]> = {
  reply: ['{0} replied to you on the forum, in the topic “{1}”:', '{0} ответил(а) вам на форуме, в теме «{1}»:'],
  quote: ['{0} quoted you on the forum, in the topic “{1}”:', '{0} процитировал(а) вас на форуме, в теме «{1}»:'],
  mention: ['{0} mentioned you on the forum, in the topic “{1}”:', '{0} упомянул(а) вас на форуме, в теме «{1}»:'],
};
const TAIL: [string, string] = ['Read it on the forum: {3}', 'Читать на форуме: {3}'];

/** A post's words cut to the excerpt: one line, at most FORUM_EXCERPT characters (an ellipsis when cut). */
export function forumExcerpt(text: string): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > FORUM_EXCERPT ? `${s.slice(0, FORUM_EXCERPT - 1).trimEnd()}…` : s;
}

/** The post's address on the forum. */
export function forumPostUrl(base: string, post: number, lang: ForumLetterLang = 'ru'): string {
  return `${base.replace(/\/$/, '')}${lang === 'en' ? '/site/en/forum/' : '/site/forum/'}p/${post}`;
}

const fill = (tpl: string, v: string[]) => tpl.replace(/\{(\d)\}/g, (_, i) => v[Number(i)] ?? '');

/** The letter's (or the e-mail's) words in a language. */
export function forumLetterWords(n: ForumNote, lang: ForumLetterLang, url: string): { from: string; subject: string; body: string } {
  const i = lang === 'ru' ? 1 : 0;
  const v = [n.from, n.title, n.excerpt, url];
  const q = lang === 'ru' ? ['«', '»'] : ['“', '”'];
  return { from: FORUM_LETTER_FROM[i], subject: FORUM_LETTER_SUBJECT[i], body: `${fill(LEAD[n.kind][i], v)}\n${q[0]}${n.excerpt}${q[1]}\n${fill(TAIL[i], v)}` };
}

/** English → Russian for the client's table (client/src/lang/server.ts). */
export function forumLetterPatterns(): [string, string][] {
  const out: [string, string][] = [FORUM_LETTER_FROM, FORUM_LETTER_SUBJECT];
  for (const k of Object.keys(LEAD) as ForumLetterKind[]) out.push([`${LEAD[k][0]}\n“{2}”\n${TAIL[0]}`, `${LEAD[k][1]}\n«{2}»\n${TAIL[1]}`]);
  return out;
}
