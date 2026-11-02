// The wire of «Лоцманская книга» (2026-11-02; shared/src/data/guide/, server/src/game/guide.ts). Kept apart from
// protocol.ts, which only takes these unions in.

import type { GuideSection } from './data/guide/types.ts';

/** What she has learnt, as the server keeps it for her account. */
export interface GuideView {
  /** Articles read (their last slide reached). */
  read: string[];
  /** First-time tips already shown (GUIDE_TRIGGERS). */
  seen: string[];
  /** Sections whose silver is paid. */
  paid: GuideSection[];
}

export type GuideClientMsg =
  /** An article's last slide reached. */
  | { t: 'guide_read'; id: string }
  /** A first-time tip shown (once an account). */
  | { t: 'guide_seen'; key: string };

export type GuideServerMsg =
  /** On coming aboard and after every change; `got`: a section just completed and its silver paid. */
  | { t: 'guide'; view: GuideView; got?: { section: GuideSection; silver: number } };
