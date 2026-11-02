// «Лоцманская книга» — the in-game encyclopedia (2026-11-02). The shared FORMAT: the content helpers write articles
// in the per-section files (sea.ts … faq.ts), the client engine (client/src/ui/guide*.ts) shows them, the server
// (server/src/guide.ts) knows the list to validate `guide_read` and pay a completed section once.

export type GuideSection = 'sea' | 'combat' | 'flags' | 'trade' | 'island' | 'army' | 'explore' | 'travel' | 'progress' | 'faq';

export interface GuideSlide {
  /** assets/guide/<file>.webp — give the key 'guide.<file>' or a path (e.g. 'assets/ui/x.webp'). */
  img?: string;
  /** [en, ru] */
  text: [string, string];
  /** «Показать в игре»: open — a window id the client can open (e.g. 'port:flag', 'isle', 'hire', 'map', 'journal',
   *  'settings:promo'); point — a CSS selector to point the finger at. */
  show?: { open: string; point?: string };
}

export interface GuideArticle {
  id: string;
  section: GuideSection;
  /** [en, ru] */
  title: [string, string];
  /** Search words, RU and EN. */
  tags: string[];
  /** [en, ru] */
  summary: [string, string];
  slides: GuideSlide[];
  related?: string[];
  /** The in-game window this article explains: the «?» button there opens it. */
  window?: string;
  /** A trigger key for a first-time tip, e.g. 'wreck-near', 'first-isle', 'struck-pirate'. */
  firstTime?: string;
}
