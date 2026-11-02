// «Лоцманская книга» on the server (2026-11-02; the articles: shared/src/data/guide/). It keeps, for her account, the
// articles she has read through (the client says `guide_read` when an article's last slide is reached), the first-time
// tips already shown (`guide_seen`, so a tip comes once an account, on any device), and the sections whose silver is
// paid. A section all of whose articles are read pays GUIDE_SECTION_REWARD silver once: the mark is written before
// the silver, so a second message never pays twice. Only ids of the shared index and keys of GUIDE_TRIGGERS are taken.

import { GUIDE, GUIDE_SECTION_REWARD, guideArticle } from '../../../shared/src/data/guide/index.ts';
import type { GuideSection } from '../../../shared/src/data/guide/types.ts';
import { GUIDE_TRIGGERS } from '../../../shared/src/data/guide/triggers.ts';
import { guideSectionsDone } from '../../../shared/src/data/guide/book.ts';
import type { GuideView } from '../../../shared/src/guideproto.ts';
import type { Game } from './Game.ts';
import type { PlayerSession } from './player.ts';

const key = (acc: number) => `guide:acc:${acc}`;
const TRIGGERS = new Set<string>(GUIDE_TRIGGERS);

interface GuideStore {
  r: string[];
  s: string[];
  p: GuideSection[];
}

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function guideStore(game: Game, acc: number): GuideStore {
  const v = game.db.getKv<Partial<GuideStore>>(key(acc));
  return { r: strs(v?.r), s: strs(v?.s), p: strs(v?.p) as GuideSection[] };
}

export function guideView(game: Game, acc: number): GuideView {
  const st = guideStore(game, acc);
  return { read: st.r, seen: st.s, paid: st.p };
}

export function sendGuide(game: Game, s: PlayerSession, got?: { section: GuideSection; silver: number }): void {
  if (!s.authed) return;
  game.sendTo(s, got ? { t: 'guide', view: guideView(game, s.accountId), got } : { t: 'guide', view: guideView(game, s.accountId) });
}

/** An article read through: recorded; a section it completes pays its silver once. What was paid (0: nothing). */
export function guideRead(game: Game, s: PlayerSession, id: unknown): number {
  if (!s.authed || !s.profile || typeof id !== 'string' || !guideArticle(id)) return 0;
  const st = guideStore(game, s.accountId);
  if (st.r.includes(id)) return 0;
  st.r.push(id);
  const due = guideSectionsDone(GUIDE, st.r).filter((x) => !st.p.includes(x));
  st.p.push(...due);
  // the marks first (a second tab, a crash half-way — never paid twice)
  game.db.setKv(key(s.accountId), st);
  let paid = 0;
  for (const section of due) {
    s.profile.gold += GUIDE_SECTION_REWARD;
    game.db.ledger(s.accountId, 'guide', GUIDE_SECTION_REWARD, `guide:${section}`);
    paid += GUIDE_SECTION_REWARD;
  }
  if (paid) {
    game.saveSession(s);
    game.pushSelf(s, true);
  }
  sendGuide(game, s, due.length ? { section: due[due.length - 1], silver: paid } : undefined);
  return paid;
}

/** A first-time tip shown: never again for this account. */
export function guideSeen(game: Game, s: PlayerSession, k: unknown): boolean {
  if (!s.authed || typeof k !== 'string' || !TRIGGERS.has(k)) return false;
  const st = guideStore(game, s.accountId);
  if (st.s.includes(k)) return false;
  st.s.push(k);
  game.db.setKv(key(s.accountId), st);
  return true;
}

export function guideMessage(game: Game, s: PlayerSession, msg: { t: 'guide_read'; id: string } | { t: 'guide_seen'; key: string }): void {
  if (msg.t === 'guide_read') guideRead(game, s, msg.id);
  else if (guideSeen(game, s, msg.key)) sendGuide(game, s);
}
