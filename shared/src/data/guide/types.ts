export type GuideSection = 'sea' | 'combat' | 'flags' | 'trade' | 'island' | 'army' | 'explore' | 'travel' | 'progress' | 'faq';
export interface GuideSlide { img?: string; text: [string, string]; show?: { open: string; point?: string } }
export interface GuideArticle { id: string; section: GuideSection; title: [string, string]; tags: string[]; summary: [string, string]; slides: GuideSlide[]; related?: string[]; window?: string; firstTime?: string }
