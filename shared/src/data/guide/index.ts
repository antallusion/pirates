// «Лоцманская книга»: every article of every section, in the section order. Owned by the engine; content goes in the
// per-section files only.
import type { GuideArticle, GuideSection } from './types.ts';
import { ARTICLES as SEA } from './sea.ts';
import { ARTICLES as SEA2 } from './sea2.ts';
import { ARTICLES as COMBAT } from './combat.ts';
import { ARTICLES as FLAGS } from './flags.ts';
import { ARTICLES as TRADE } from './trade.ts';
import { ARTICLES as ISLAND } from './island.ts';
import { ARTICLES as ARMY } from './army.ts';
import { ARTICLES as EXPLORE } from './explore.ts';
import { ARTICLES as TRAVEL } from './travel.ts';
import { ARTICLES as PROGRESS } from './progress.ts';
import { ARTICLES as FAQ } from './faq.ts';

export type { GuideArticle, GuideSection, GuideSlide } from './types.ts';

/** The sections in the book's order. */
export const GUIDE_SECTIONS: GuideSection[] = ['sea', 'combat', 'flags', 'trade', 'island', 'army', 'explore', 'travel', 'progress', 'faq'];

export const GUIDE: GuideArticle[] = [...SEA, ...SEA2, ...COMBAT, ...FLAGS, ...TRADE, ...ISLAND, ...ARMY, ...EXPLORE, ...TRAVEL, ...PROGRESS, ...FAQ];

/** Silver paid once for a section whose every article is read. */
export const GUIDE_SECTION_REWARD = 300;

const BY_ID = new Map<string, GuideArticle>(GUIDE.map((a) => [a.id, a]));
export function guideArticle(id: string): GuideArticle | undefined { return BY_ID.get(id); }
export function guideSectionIds(section: GuideSection): string[] { return GUIDE.filter((a) => a.section === section).map((a) => a.id); }
