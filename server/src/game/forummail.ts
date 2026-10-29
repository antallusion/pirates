// The forum's answers by post (owner, 2026-10-29: «ответы личные на форуме отсылали письма людям, что мол вам ответили»):
// a member answered, quoted or mentioned on the forum (server/src/forum/service.ts, through gamelink.ts) gets
//  - a letter in her captain's port mailbox (post.ts deliver): «Вам ответили на форуме», who, in which topic, the first
//    words and the post's link (shared/src/data/forumletter.ts; the client shows it in her language);
//  - an e-mail, when the account has a verified address and has not unsubscribed (the advice mailer's `emailOff` and its
//    one-click /auth/unsub): only while she is away from the game, and one a day at most (the advice mailer's limit).
// Coalesced: one letter per member per topic in ten minutes, so a busy thread does not flood the box. Kept in the kv
// table (`forummail:<account>`). Never to a bot or test account.

import { notACaptain } from '../../../shared/src/data/advice.ts';
import { forumLetterWords, forumPostUrl } from '../../../shared/src/data/forumletter.ts';
import type { ForumLetterLang, ForumNote } from '../../../shared/src/data/forumletter.ts';
import { adviceLang, adviceState, adviceUnsubUrl } from './advice.ts';
import type { Game } from './Game.ts';
import { deliver } from './post.ts';

const MIN = 60_000;
const DAY = 86_400_000;
/** One letter per member per topic in this long. */
export const FORUM_MAIL_COALESCE = 10 * MIN;
/** One e-mail a day at most. */
export const FORUM_MAIL_EMAIL_EVERY = DAY;

interface Throttle {
  /** topic → when the last letter about it went. */
  t: Record<string, number>;
  /** When the last e-mail went. */
  mail?: number;
}
const key = (acc: number) => `forummail:${acc}`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The e-mail: the letter's words in her language, the «open» button, the one-click unsubscribe. */
export function forumMail(n: ForumNote, lang: ForumLetterLang, base: string, unsubUrl: string): { subject: string; text: string; html: string } {
  const url = forumPostUrl(base, n.post, lang);
  const w = forumLetterWords(n, lang, url);
  const ru = lang === 'ru';
  const readL = ru ? 'Открыть сообщение' : 'Open the post';
  const offL = ru ? 'Больше не присылать письма на почту' : 'Stop these e-mails';
  const subject = `GRAVETIDE — ${w.subject}`;
  const text = `${w.body}\n\n${offL}: ${unsubUrl}`;
  const [lead, quote] = w.body.split('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#0b1620;font-family:Georgia,'Times New Roman',serif;color:#e8dcc0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1620;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#13222e;border:1px solid #6b5a33;border-radius:8px">
<tr><td style="padding:22px 28px 6px;font-size:13px;letter-spacing:4px;color:#c9a45c">GRAVETIDE</td></tr>
<tr><td style="padding:4px 28px 0;font-size:22px;color:#f1e3c2">${esc(w.subject)}</td></tr>
<tr><td style="padding:14px 28px 4px;font-size:16px;line-height:1.55"><p style="margin:0 0 12px">${esc(lead ?? '')}</p><p style="margin:0 0 12px;padding-left:12px;border-left:3px solid #6b5a33;color:#d6c8a6">${esc(quote ?? '')}</p></td></tr>
<tr><td style="padding:6px 28px 22px"><a href="${esc(url)}" style="display:inline-block;background:#c9a45c;color:#13222e;text-decoration:none;font-weight:bold;padding:11px 26px;border-radius:5px">${readL}</a></td></tr>
</table>
<p style="font-size:12px;color:#7d8a93;margin:14px 0 0"><a href="${esc(unsubUrl)}" style="color:#7d8a93">${offL}</a></p>
</td></tr></table></body></html>`;
  return { subject, text, html };
}

/** A forum answer told to her captain: the letter (and the e-mail) unless one about this topic went in ten minutes.
 *  What went: `letter`, `email`. */
export function forumLetter(game: Game, acc: number, n: ForumNote): string[] {
  const a = game.db.accountById(acc);
  if (!a || notACaptain(a.name)) return [];
  const now = game.wallNow();
  const th = game.db.getKv<Throttle>(key(acc)) ?? { t: {} };
  if (now - (th.t[String(n.topic)] ?? 0) < FORUM_MAIL_COALESCE) return [];
  for (const [k, at] of Object.entries(th.t)) if (now - at >= FORUM_MAIL_COALESCE) delete th.t[k];
  th.t[String(n.topic)] = now;
  const base = game.auth?.publicUrl ?? '';
  const w = forumLetterWords(n, 'en', forumPostUrl(base, n.post));
  deliver(game, acc, { from: w.from, subject: w.subject, body: w.body, gold: 0, goods: null });
  const done = ['letter'];
  // the e-mail: a verified address, not unsubscribed, away from the game, one a day
  const s = game.sessionByAccount(acc);
  const aboard = !!s && s.disconnectedAt === null;
  const mailer = game.auth?.mailer ?? null;
  if (mailer && a.email && a.email_verified && !aboard && !adviceState(game, acc).emailOff && now - (th.mail ?? 0) >= FORUM_MAIL_EMAIL_EVERY) {
    th.mail = now;
    const m = forumMail(n, adviceLang(game, acc), base, adviceUnsubUrl(game, acc, base));
    void mailer.send({ to: a.email, subject: m.subject, text: m.text, html: m.html }).catch(() => {
      // (the mailer logs a masked address)
    });
    done.push('email');
  }
  game.db.setKv(key(acc), th);
  return done;
}
